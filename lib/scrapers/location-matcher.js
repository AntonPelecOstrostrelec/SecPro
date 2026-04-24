// Deterministic Slovak location matching.
// Given a search location and a listing, decide: does this listing belong to that location?
//
// Strategy (positive whitelist):
//   1. Build a set of acceptance tokens for the search location
//      — city name + district/neighborhood names + postal code prefixes
//   2. Check if ANY acceptance token appears in listing's (location + title + URL)
//   3. Also check if listing has PSČ matching city's prefix
//   4. If match → accept, otherwise → reject

const CITY_DATA = {
  bratislava: {
    aliases: ['bratislava', 'ba-', '-ba-', 'bratislave', 'bratislavu'],
    districts: [
      'stare mesto', 'staromestska', 'ruzinov', 'petrzalka', 'nove mesto',
      'novemesto', 'karlova ves', 'karlovaves', 'dubravka', 'raca', 'lamac',
      'devin', 'devinska nova ves', 'vajnory', 'vrakuna', 'podunajske biskupice',
      'jarovce', 'rusovce', 'cunovo', 'zahorska bystrica',
      // Smaller neighborhoods
      'rendez', 'dvory', 'pribinova', 'trnavka', 'stare grunty',
      'krasnany', 'koliba', 'kramare', 'slavin', 'dlhe diely',
      'patronka', 'bory', 'zlate piesky', 'ovocne sady', 'sihote',
      'horsky park', 'drotarska', 'muchovo namestie', 'ovsiste',
      'luky', 'haje'
    ],
    pscPrefix: ['81', '82', '83', '84', '85']
  },
  kosice: {
    aliases: ['kosice', 'kosiciach'],
    districts: [
      'stare mesto', 'sever', 'zapad', 'juh', 'dargovskych hrdinov',
      'tahanovce', 'sidlisko tahanovce', 'lunik ix', 'nad jazerom',
      'kvp', 'sidlisko kvp', 'peres', 'saca', 'kosicka nova ves',
      'barca', 'myslava', 'polov', 'kavecany', 'lorincik', 'vysne opatske'
    ],
    pscPrefix: ['04']
  },
  presov: {
    aliases: ['presov', 'presove'],
    districts: ['sekcov', 'sidlisko 3', 'sidlisko duklianska', 'solivar', 'svaby', 'nizna sebastova'],
    pscPrefix: ['08']
  },
  nitra: {
    aliases: ['nitra', 'nitre'],
    districts: ['klokocina', 'chrenova', 'zobor', 'stare mesto', 'diely', 'cerman',
                'janikovce', 'drazovce', 'horne krskany', 'mlynarce'],
    pscPrefix: ['949', '950', '951']
  },
  zilina: {
    aliases: ['zilina', 'ziline'],
    districts: ['vlcince', 'solinky', 'hajik', 'hliny', 'borik', 'bulvar',
                'stare mesto', 'bytcica', 'brodno', 'zadubnie'],
    pscPrefix: ['010', '011', '012', '013']
  },
  'banska bystrica': {
    aliases: ['banska bystrica', 'banskej bystrici', 'banskabystrica'],
    districts: ['fonclora', 'radvan', 'sasova', 'podlavice', 'uhlisko', 'senica'],
    pscPrefix: ['974']
  },
  trnava: {
    aliases: ['trnava', 'trnave'],
    districts: ['prednadrazie', 'tulipan', 'dole', 'zavar'],
    pscPrefix: ['917']
  },
  trencin: {
    aliases: ['trencin', 'trencine'],
    districts: ['juh', 'sihot', 'kubrica', 'hanzlikova', 'biskupice', 'opatova',
                'kubra', 'zamarovce', 'zlatovce'],
    pscPrefix: ['911', '912']
  },
  martin: {
    aliases: ['martin', 'martine'],
    districts: ['priekopa', 'turcianska', 'kosuty', 'stred'],
    pscPrefix: ['036', '038', '039']
  },
  poprad: {
    aliases: ['poprad', 'poprade'],
    districts: ['velka', 'stara lesna', 'matejovce', 'spisska sobota', 'strazske'],
    pscPrefix: ['058', '059']
  },
  prievidza: {
    aliases: ['prievidza', 'prievidzi'],
    districts: ['necpaly', 'kopanice', 'luzna'],
    pscPrefix: ['971']
  },
  zvolen: {
    aliases: ['zvolen', 'zvolene'],
    districts: ['zolna', 'sasova', 'pustý hrad'],
    pscPrefix: ['960', '961', '962']
  },
  piestany: {
    aliases: ['piestany', 'piestanoch'],
    districts: [],
    pscPrefix: ['921']
  },
  michalovce: {
    aliases: ['michalovce', 'michalovciach'],
    districts: [],
    pscPrefix: ['071']
  },
  levice: {
    aliases: ['levice', 'leviciach'],
    districts: [],
    pscPrefix: ['934']
  },
  komarno: {
    aliases: ['komarno', 'komarne'],
    districts: [],
    pscPrefix: ['945']
  },
  'nove zamky': {
    aliases: ['nove zamky', 'novych zamkov', 'novezamky'],
    districts: [],
    pscPrefix: ['940']
  },
  lucenec: {
    aliases: ['lucenec', 'lucenci'],
    districts: [],
    pscPrefix: ['984']
  },
  'dunajska streda': {
    aliases: ['dunajska streda', 'dunajskej strede'],
    districts: [],
    pscPrefix: ['929']
  },
  galanta: {
    aliases: ['galanta'],
    districts: [],
    pscPrefix: ['924']
  },
  topolcany: {
    aliases: ['topolcany'],
    districts: [],
    pscPrefix: ['955']
  },
  partizanske: {
    aliases: ['partizanske'],
    districts: [],
    pscPrefix: ['958']
  },
  'povazska bystrica': {
    aliases: ['povazska bystrica', 'povazskej bystrici', 'povazska'],
    districts: [],
    pscPrefix: ['017']
  },
  ruzomberok: {
    aliases: ['ruzomberok', 'ruzomberku'],
    districts: [],
    pscPrefix: ['034']
  },
  'liptovsky mikulas': {
    aliases: ['liptovsky mikulas', 'liptovskom mikulasi', 'liptovskymikulas'],
    districts: [],
    pscPrefix: ['031']
  },
  bardejov: {
    aliases: ['bardejov', 'bardejove'],
    districts: [],
    pscPrefix: ['085']
  },
  humenne: {
    aliases: ['humenne'],
    districts: [],
    pscPrefix: ['066']
  },
  snina: {
    aliases: ['snina'],
    districts: [],
    pscPrefix: ['069']
  },
  skalica: {
    aliases: ['skalica'],
    districts: [],
    pscPrefix: ['909']
  },
  senica: {
    aliases: ['senica'],
    districts: [],
    pscPrefix: ['905']
  },
  malacky: {
    aliases: ['malacky', 'malackach'],
    districts: [],
    pscPrefix: ['901']
  },
  pezinok: {
    aliases: ['pezinok', 'pezinku'],
    districts: [],
    pscPrefix: ['902']
  },
  senec: {
    aliases: ['senec', 'senci'],
    districts: [],
    pscPrefix: ['903']
  }
};

// Strip diacritics + lowercase for robust matching
function deburr(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Normalize search location to CITY_DATA key
function normalizeCityKey(location) {
  if (!location) return null;
  const d = deburr(location.trim());
  // Direct match
  if (CITY_DATA[d]) return d;
  // Alias match
  for (const [key, data] of Object.entries(CITY_DATA)) {
    if (data.aliases.some(a => d === a || d.startsWith(a + ' '))) return key;
  }
  return null;
}

// Identify city by PSČ prefix. Returns city key or null.
function cityFromPsc(psc) {
  const normalized = psc.replace(/\s/g, '');
  for (const [key, data] of Object.entries(CITY_DATA)) {
    for (const prefix of data.pscPrefix) {
      if (normalized.startsWith(prefix)) return key;
    }
  }
  return null;
}

// Main: does this lead match the searched location?
//
// Rule of precedence (most reliable first):
//   1. PSČ is AUTHORITATIVE — if lead has one, it determines the city.
//      Search city matches PSČ → ACCEPT. Different city PSČ → REJECT (even if text mentions search city).
//   2. No PSČ → positive match on city name + district names.
//   3. Unknown search city → fallback substring match.
function matchesLocation(lead, searchLocation) {
  if (!searchLocation || searchLocation.trim().length < 2) return true;

  const searchDeburred = deburr(searchLocation.trim());
  const cityKey = normalizeCityKey(searchLocation);

  const hay = [
    lead.location || '',
    lead.title || '',
    lead.url || ''
  ].map(deburr).join(' ');

  // ── PSČ AUTHORITATIVE CHECK ──
  // Look for postal codes in location field specifically (most reliable),
  // fall back to full haystack if not found.
  const locStr = deburr(lead.location || '');
  const pscRegex = /\b(\d{3}\s?\d{2})\b/g;
  const pscMatches = [
    ...(locStr.match(pscRegex) || []),
    ...(hay.match(pscRegex) || [])
  ];

  // Deduplicate and extract first PSČ that maps to a known city
  let leadPscCity = null;
  for (const raw of pscMatches) {
    const mapped = cityFromPsc(raw);
    if (mapped) { leadPscCity = mapped; break; }
  }

  if (leadPscCity) {
    // Listing's real city determined by PSČ. Text claims are unreliable.
    if (!cityKey) return leadPscCity === searchDeburred; // search was unknown
    return leadPscCity === cityKey;
  }

  // ── NO PSČ: position-based + dominance checks ──

  if (!cityKey) {
    return hay.includes(searchDeburred);
  }

  // AUTHORITATIVE: location field should mention the city FIRST if it's really there.
  // If another known city appears in location BEFORE the search city, that's the real location
  // (scrapers that pollute fallbackCity append it at the end).
  const locDeburred = deburr(lead.location || '');
  if (locDeburred.length > 0) {
    const cityData = CITY_DATA[cityKey];
    const searchFirstIdx = firstCityOccurrence(locDeburred, cityData);

    for (const [otherKey, otherData] of Object.entries(CITY_DATA)) {
      if (otherKey === cityKey) continue;
      const otherIdx = firstCityOccurrence(locDeburred, otherData);
      if (otherIdx === -1) continue;
      // Another city found in location. If search city isn't there OR appears AFTER other city → reject.
      if (searchFirstIdx === -1 || otherIdx < searchFirstIdx) {
        return false;
      }
    }
  }

  // Fallback: dominance by occurrence count across haystack
  const cityScores = {};
  for (const [key, data] of Object.entries(CITY_DATA)) {
    let count = 0;
    for (const alias of data.aliases) {
      const re = new RegExp(escapeRegex(alias), 'g');
      const matches = hay.match(re);
      if (matches) count += matches.length;
    }
    for (const district of data.districts) {
      const re = new RegExp('\\b' + escapeRegex(district) + '\\b', 'g');
      const matches = hay.match(re);
      if (matches) count += matches.length;
    }
    if (count > 0) cityScores[key] = count;
  }

  const mentionedCities = Object.keys(cityScores);
  if (mentionedCities.length === 0) return false;
  if (mentionedCities.length === 1 && mentionedCities[0] === cityKey) return true;

  const sorted = mentionedCities.sort((a, b) => cityScores[b] - cityScores[a]);
  const topCity = sorted[0];
  if (cityScores[topCity] === cityScores[cityKey]) return true;
  return topCity === cityKey;
}

// First occurrence index of any of this city's aliases/districts in text (-1 if not found)
function firstCityOccurrence(text, cityData) {
  let minIdx = -1;
  const terms = [...cityData.aliases, ...cityData.districts];
  for (const term of terms) {
    const idx = text.indexOf(term);
    if (idx !== -1 && (minIdx === -1 || idx < minIdx)) minIdx = idx;
  }
  return minIdx;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { matchesLocation, normalizeCityKey, CITY_DATA };
