/**
 * AML Sanctions & PEP Screening API
 *
 * Uses OpenSanctions.org to check against:
 * - EU Financial Sanctions
 * - UN Security Council Sanctions
 * - US OFAC SDN List
 * - PEP (Politically Exposed Persons) databases
 * - National sanctions lists
 *
 * POST /api/aml-check
 * Body: { name: string, birthDate?: string, nationality?: string }
 */

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, birthDate, nationality } = req.body || {};
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Meno je povinné (min. 2 znaky)' });
  }

  const query = name.trim();

  try {
    // Search OpenSanctions — sanctions and PEP datasets in parallel
    const [sanctionsRes, pepRes] = await Promise.allSettled([
      fetchWithTimeout(
        `https://api.opensanctions.org/search/sanctions?q=${encodeURIComponent(query)}&schema=Person&limit=10`,
        8000
      ),
      fetchWithTimeout(
        `https://api.opensanctions.org/search/peps?q=${encodeURIComponent(query)}&schema=Person&limit=10`,
        8000
      )
    ]);

    const sanctionsData = sanctionsRes.status === 'fulfilled'
      ? await sanctionsRes.value.json()
      : { results: [], total: 0 };

    const pepData = pepRes.status === 'fulfilled'
      ? await pepRes.value.json()
      : { results: [], total: 0 };

    // Process & filter results (score > 0.4 = possible match worth reviewing)
    const sanctionMatches = processResults(sanctionsData.results || [], birthDate);
    const pepMatches = processResults(pepData.results || [], birthDate);

    // Determine status: 'hit' (high confidence), 'review' (possible match), 'clear' (no match)
    const sanctionStatus = determineStatus(sanctionMatches);
    const pepStatus = determineStatus(pepMatches);

    return res.status(200).json({
      sanctions: {
        status: sanctionStatus,
        total: sanctionsData.total || 0,
        matches: sanctionMatches.slice(0, 5)
      },
      pep: {
        status: pepStatus,
        total: pepData.total || 0,
        matches: pepMatches.slice(0, 5)
      },
      checkedAt: new Date().toISOString(),
      query,
      source: 'OpenSanctions.org (EU, UN, OFAC, Interpol, národné zoznamy)'
    });

  } catch (err) {
    console.error('AML check error:', err);
    return res.status(500).json({
      error: 'Kontrola zlyhala',
      detail: err.message
    });
  }
};

function processResults(results, birthDate) {
  return results
    .map(r => {
      const props = r.properties || {};
      const match = {
        name: r.caption || '',
        score: r.score || 0,
        datasets: (r.datasets || []).join(', '),
        countries: (props.country || []).join(', '),
        birthDates: props.birthDate || [],
        topics: (props.topics || []).join(', '),
        position: (props.position || []).join(', ')
      };

      // Boost/reduce score based on birth date match
      if (birthDate && match.birthDates.length > 0) {
        const inputYear = birthDate.slice(0, 4);
        const hasYearMatch = match.birthDates.some(d => d.includes(inputYear));
        if (hasYearMatch) match.score = Math.min(1, match.score + 0.2);
        else match.score = Math.max(0, match.score - 0.15);
      }

      return match;
    })
    .filter(m => m.score > 0.4)
    .sort((a, b) => b.score - a.score);
}

function determineStatus(matches) {
  if (matches.length === 0) return 'clear';
  if (matches.some(m => m.score >= 0.85)) return 'hit';
  if (matches.some(m => m.score >= 0.6)) return 'review';
  return 'clear';
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
