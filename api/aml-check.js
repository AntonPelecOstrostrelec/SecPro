/**
 * AML Sanctions Screening API
 *
 * Downloads and searches REAL sanctions lists:
 * - US OFAC SDN List (Treasury Department)
 * - UN Security Council Consolidated Sanctions
 *
 * Lists are cached in memory (warm Vercel function instances)
 * and refreshed every 24 hours.
 *
 * POST /api/aml-check
 * Body: { name: string, birthDate?: string }
 */

// Module-level cache — persists across warm invocations on Vercel
let sanctionsEntries = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, birthDate } = req.body || {};
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Meno je povinné (min. 2 znaky)' });
  }

  try {
    // Load lists if not cached or stale
    if (!sanctionsEntries || Date.now() - cacheTime > CACHE_TTL) {
      console.log('AML: Loading sanctions lists...');
      sanctionsEntries = await loadAllLists();
      cacheTime = Date.now();
      console.log('AML: Loaded ' + sanctionsEntries.length + ' entries');
    }

    const query = name.trim();
    const matches = searchSanctions(query, birthDate, sanctionsEntries);

    // Split by source for response
    const sanctionMatches = matches.filter(m => m.datasets === 'OFAC SDN' || m.datasets === 'UN Sanctions');
    const pepMatches = matches.filter(m => m.position && m.position.length > 0);

    const sanctionStatus = determineStatus(sanctionMatches);
    const pepStatus = determineStatus(pepMatches);

    return res.status(200).json({
      sanctions: {
        status: sanctionStatus,
        total: sanctionMatches.length,
        matches: sanctionMatches.slice(0, 5)
      },
      pep: {
        status: pepStatus,
        total: pepMatches.length,
        matches: pepMatches.slice(0, 5)
      },
      checkedAt: new Date().toISOString(),
      query,
      totalEntries: sanctionsEntries.length,
      source: 'US OFAC SDN + UN Security Council Consolidated List (priame zdroje)'
    });

  } catch (err) {
    console.error('AML check error:', err);
    return res.status(500).json({ error: 'Kontrola zlyhala', detail: err.message });
  }
};

// ---------- LOADING ----------

async function loadAllLists() {
  const [ofac, un] = await Promise.allSettled([loadOFAC(), loadUN()]);

  const entries = [];
  if (ofac.status === 'fulfilled') entries.push(...ofac.value);
  else console.error('OFAC load failed:', ofac.reason?.message);

  if (un.status === 'fulfilled') entries.push(...un.value);
  else console.error('UN load failed:', un.reason?.message);

  return entries;
}

async function loadOFAC() {
  const resp = await fetchFollow('https://www.treasury.gov/ofac/downloads/sdn.csv', 20000);
  const text = await resp.text();
  const entries = [];

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    // CSV format: ID,"NAME",TYPE,"PROGRAM",...,"REMARKS"
    const match = line.match(/^(\d+),"([^"]+)","?(\w+)"?,"([^"]*)"(?:,"([^"]*)")?/);
    if (!match) continue;

    const [, id, fullName, type, program, title] = match;
    if (type !== 'individual') continue; // Only people

    // Extract DOB from remarks
    const remarkMatch = line.match(/DOB\s+(\d{1,2}\s+\w+\s+\d{4})/);
    const dob = remarkMatch ? remarkMatch[1] : '';
    // Extract nationality
    const natMatch = line.match(/nationality\s+(\w+)/i);
    const nationality = natMatch ? natMatch[1] : '';
    // Extract aliases
    const aliases = [];
    const aliasMatches = line.matchAll(/a\.k\.a\.\s+'([^']+)'/g);
    for (const am of aliasMatches) aliases.push(am[1]);

    entries.push({
      name: cleanName(fullName),
      normalizedName: normalize(fullName),
      aliases: aliases.map(a => normalize(a)),
      dob,
      nationality,
      designation: title || '',
      list: 'OFAC SDN',
      program,
      countries: nationality
    });
  }

  return entries;
}

async function loadUN() {
  const resp = await fetchFollow('https://scsanctions.un.org/resources/xml/en/consolidated.xml', 20000);
  const xml = await resp.text();
  const entries = [];

  // Parse individuals from XML using regex (no XML parser needed)
  const individualBlocks = xml.match(/<INDIVIDUAL>[\s\S]*?<\/INDIVIDUAL>/g) || [];

  for (const block of individualBlocks) {
    const firstName = extractTag(block, 'FIRST_NAME');
    const secondName = extractTag(block, 'SECOND_NAME');
    const thirdName = extractTag(block, 'THIRD_NAME');
    const fullName = [firstName, secondName, thirdName].filter(Boolean).join(' ');
    if (!fullName) continue;

    // DOB
    const yearMatch = block.match(/<YEAR>(\d{4})<\/YEAR>/);
    const dob = yearMatch ? yearMatch[1] : '';

    // Nationality
    const nationalities = [];
    const natBlocks = block.match(/<NATIONALITY>[\s\S]*?<\/NATIONALITY>/g) || [];
    for (const nb of natBlocks) {
      const val = extractTag(nb, 'VALUE');
      if (val) nationalities.push(val);
    }

    // Aliases
    const aliases = [];
    const aliasBlocks = block.match(/<INDIVIDUAL_ALIAS>[\s\S]*?<\/INDIVIDUAL_ALIAS>/g) || [];
    for (const ab of aliasBlocks) {
      const aliasName = extractTag(ab, 'ALIAS_NAME');
      if (aliasName) aliases.push(normalize(aliasName));
    }

    // Designation
    const designation = extractTag(block, 'DESIGNATION>\\s*<VALUE') || '';
    const listType = extractTag(block, 'UN_LIST_TYPE') || '';

    entries.push({
      name: fullName,
      normalizedName: normalize(fullName),
      aliases,
      dob,
      nationality: nationalities.join(', '),
      designation,
      list: 'UN Sanctions',
      program: listType,
      countries: nationalities.join(', ')
    });
  }

  return entries;
}

// ---------- SEARCHING ----------

function searchSanctions(query, birthDate, entries) {
  const nQuery = normalize(query);
  const queryWords = nQuery.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length === 0) return [];

  const results = [];

  for (const entry of entries) {
    let score = calcScore(queryWords, nQuery, entry.normalizedName);

    // Also check aliases
    for (const alias of entry.aliases) {
      const aliasScore = calcScore(queryWords, nQuery, alias);
      if (aliasScore > score) score = aliasScore;
    }

    if (score < 0.45) continue;

    // Birth date boost/penalty
    if (birthDate && entry.dob) {
      const queryYear = birthDate.slice(0, 4);
      if (entry.dob.includes(queryYear)) {
        score = Math.min(1, score + 0.15);
      }
    }

    results.push({
      name: entry.name,
      score: Math.round(score * 100) / 100,
      datasets: entry.list,
      countries: entry.countries || '',
      birthDates: entry.dob ? [entry.dob] : [],
      position: entry.designation || '',
      program: entry.program || ''
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function calcScore(queryWords, nQuery, targetName) {
  if (!targetName) return 0;
  const targetWords = targetName.split(/\s+/).filter(w => w.length > 1);
  if (targetWords.length === 0) return 0;

  // Exact match
  if (nQuery === targetName) return 1.0;

  // Check how many query words appear in the target
  let matchedWords = 0;
  let partialScore = 0;

  for (const qw of queryWords) {
    // Exact word match
    if (targetWords.some(tw => tw === qw)) {
      matchedWords++;
      partialScore += 1.0;
    }
    // Partial word match (start of word)
    else if (targetWords.some(tw => tw.startsWith(qw) || qw.startsWith(tw))) {
      matchedWords += 0.7;
      partialScore += 0.7;
    }
    // Character-level: word contained in target
    else if (targetName.includes(qw)) {
      matchedWords += 0.4;
      partialScore += 0.4;
    }
  }

  // Score = proportion of query words matched, weighted
  const wordCoverage = partialScore / queryWords.length;

  // Also consider reverse: how much of target is covered
  let reverseMatched = 0;
  for (const tw of targetWords) {
    if (queryWords.some(qw => qw === tw)) reverseMatched++;
    else if (queryWords.some(qw => qw.startsWith(tw) || tw.startsWith(qw))) reverseMatched += 0.5;
  }
  const reverseCoverage = targetWords.length > 0 ? reverseMatched / targetWords.length : 0;

  // Combined score: mostly forward match, some reverse
  return wordCoverage * 0.7 + reverseCoverage * 0.3;
}

// ---------- HELPERS ----------

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(name) {
  // OFAC format: "LASTNAME, Firstname" → "Firstname LASTNAME"
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim());
    return parts.slice(1).join(' ') + ' ' + parts[0];
  }
  return name;
}

function extractTag(xml, tag) {
  const re = new RegExp('<' + tag + '>([^<]*)</', 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function determineStatus(matches) {
  if (matches.length === 0) return 'clear';
  if (matches.some(m => m.score >= 0.85)) return 'hit';
  if (matches.some(m => m.score >= 0.55)) return 'review';
  return 'clear';
}

async function fetchFollow(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' from ' + url);
    return resp;
  } finally {
    clearTimeout(timer);
  }
}
