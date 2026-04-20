// Slovak address parser — extracts district/street info from titles and descriptions
// Goal: turn "Bratislava" into "Bratislava - Petržalka, Hálova" using text clues

// Bratislava parts (ordered: official districts first, then subneighborhoods)
const BRATISLAVA_PARTS = [
  // 17 official city districts
  'Staré Mesto', 'Ružinov', 'Vrakuňa', 'Podunajské Biskupice',
  'Nové Mesto', 'Rača', 'Vajnory', 'Karlova Ves', 'Dúbravka',
  'Lamač', 'Devín', 'Devínska Nová Ves', 'Záhorská Bystrica',
  'Petržalka', 'Jarovce', 'Rusovce', 'Čunovo',
  // Common subneighborhoods & project names people recognize
  'Rendez', 'Dvory', 'Pribinova', 'Trnávka', 'Staré Grunty',
  'Krasňany', 'Koliba', 'Kramáre', 'Slavín', 'Dlhé Diely',
  'Patrónka', 'Bory', 'Zlaté Piesky', 'Ovocné sady', 'Sihote',
  'Sídlisko III', 'Horský Park', 'Slavín', 'Drotárska',
  'Muchovo námestie', 'Ovsište', 'Lúky', 'Háje', 'Hálova',
  'Einsteinova', 'Petržalka-Dvory', 'Zwirn', 'Stein'
];

const KOSICE_PARTS = [
  'Staré Mesto', 'Sever', 'Západ', 'Juh', 'Dargovských hrdinov',
  'Ťahanovce', 'Sídlisko Ťahanovce', 'Luník IX', 'Nad jazerom',
  'KVP', 'Sídlisko KVP', 'Pereš', 'Šaca', 'Košická Nová Ves',
  'Barca', 'Myslava', 'Poľov', 'Kavečany', 'Lorinčík', 'Vyšné Opátske'
];

const PRESOV_PARTS = [
  'Sekčov', 'Sídlisko 3', 'Sídlisko Duklianska', 'Solivar', 'Šváby', 'Nižná Šebastová'
];

const NITRA_PARTS = [
  'Klokočina', 'Chrenová', 'Zobor', 'Staré Mesto', 'Diely', 'Čermáň',
  'Janíkovce', 'Dražovce', 'Horné Krškany', 'Mlynárce'
];

const ZILINA_PARTS = [
  'Vlčince', 'Solinky', 'Hájik', 'Hliny', 'Bôrik', 'Bulvár',
  'Staré Mesto', 'Bytčica', 'Brodno', 'Zádubnie', 'Žilinská Lehota'
];

const CITY_PARTS_MAP = {
  'bratislava': BRATISLAVA_PARTS,
  'košice': KOSICE_PARTS,
  'kosice': KOSICE_PARTS,
  'prešov': PRESOV_PARTS,
  'presov': PRESOV_PARTS,
  'nitra': NITRA_PARTS,
  'žilina': ZILINA_PARTS,
  'zilina': ZILINA_PARTS
};

// Detect city from any text — first match wins
function detectCity(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const cities = [
    ['bratislava', 'Bratislava'],
    ['košice', 'Košice'], ['kosice', 'Košice'],
    ['prešov', 'Prešov'], ['presov', 'Prešov'],
    ['nitra', 'Nitra'],
    ['žilina', 'Žilina'], ['zilina', 'Žilina'],
    ['banská bystrica', 'Banská Bystrica'], ['banska bystrica', 'Banská Bystrica'],
    ['trnava', 'Trnava'],
    ['trenčín', 'Trenčín'], ['trencin', 'Trenčín']
  ];
  for (const [slug, display] of cities) {
    if (t.includes(slug)) return display;
  }
  return null;
}

// Strip diacritics for loose matching
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Extract district/neighborhood from any text (title, description, address).
// Uses flexible matching — handles inflection like "Petržalky", "v Petržalke", "na Rendezi"
function extractDistrict(text, city) {
  if (!text || !city) return null;
  const cityKey = city.toLowerCase();
  const parts = CITY_PARTS_MAP[cityKey] || CITY_PARTS_MAP[stripDiacritics(cityKey)] || [];
  if (parts.length === 0) return null;

  const tStripped = stripDiacritics(text);

  // Sort by length desc so longer names win (e.g. "Devínska Nová Ves" over "Devín")
  const sortedParts = [...parts].sort((a, b) => b.length - a.length);

  for (const part of sortedParts) {
    const partStripped = stripDiacritics(part);
    // Root form — last vowel becomes flexible (match "petržalka", "petržalke", "petržalky")
    const root = partStripped.replace(/[aeiouy]+$/, '');
    if (!root || root.length < 3) continue;
    // Word boundary — root + optional suffix
    const regex = new RegExp('\\b' + escapeRegex(root) + '[a-z]{0,4}\\b', 'i');
    if (regex.test(tStripped)) {
      return part;
    }
  }
  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract street name from text.
// Strategies:
// 1. Explicit "na ulici X" / "ul. X" / "na X-ovej ulici"
// 2. Slovak street-name endings: -ova, -ská, -cká, -ského, -nová
// 3. Street with house number: "Hálova 5"
function extractStreet(text) {
  if (!text) return null;

  // Pattern 1: "na ulici Foo" or "ul. Foo"
  const patterns = [
    /(?:na\s+ulici|ul\.\s*|ulica\s+|ulice\s+)([A-ZÁÄÉÍÓÔÚÝČĎĹĽŇŔŠŤŽ][a-záäéíóôúýčďĺľňŕšťž]+(?:\s+[A-ZÁÄÉÍÓÔÚÝČĎĹĽŇŔŠŤŽ][a-záäéíóôúýčďĺľňŕšťž]+)?)/,
    // Street + house number: "Hálova 12"
    /\b([A-ZÁÄÉÍÓÔÚÝČĎĹĽŇŔŠŤŽ][a-záäéíóôúýčďĺľňŕšťž]+(?:ova|ská|cká|nská|nova|ovo))\s+(\d+[a-z]?)\b/,
    // Slovak street endings alone (e.g., "na Hálovej", "v Pribinovej")
    /(?:na|v)\s+([A-ZÁÄÉÍÓÔÚÝČĎĹĽŇŔŠŤŽ][a-záäéíóôúýčďĺľňŕšťž]+(?:ovej|skej|ckej|nskej|ninej))\b/
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let street = m[1];
      if (m[2]) street += ' ' + m[2];
      // Denormalize Slovak locative → nominative
      // -ovej → -ová (long á!), -skej → -ská, -ckej → -cká, -nskej → -nská
      street = street
        .replace(/ovej$/i, 'ová')
        .replace(/skej$/i, 'ská')
        .replace(/ckej$/i, 'cká')
        .replace(/nskej$/i, 'nská')
        .replace(/ninej$/i, 'nina');
      // Sanity check: reject garbage (too long, too many words, all-caps noise)
      if (!isValidStreetName(street)) return null;
      return street;
    }
  }
  return null;
}

// Validate that a captured street looks like a real street name
function isValidStreetName(s) {
  if (!s || typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return false;
  // Reject all-caps noise (like "KOMPLETNE PRECÍZNE ZREKONŠTRUOVANÝ")
  const letters = trimmed.replace(/[^A-Za-zÁÄÉÍÓÔÚÝáäéíóôúýČĎĹĽŇŔŠŤŽčďĺľňŕšťž]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) return false;
  // Reject too many words (real Slovak streets are 1-3 words like "Pri Šajbách")
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  // Reject if contains suspicious real-estate keywords (title pollution)
  const junk = /\b(izb|izbov|byt|dom|predaj|predajom|rekonstruk|zrekonstruov|kompletne|precizne|luxus|novostavba|projekt)/i;
  if (junk.test(trimmed)) return false;
  return true;
}

// Parse a full address line like "Beňovského 6, Bratislava-Dúbravka, okres Bratislava IV"
// Returns { street, city, district, okres } or null.
// Used by deep scrapers when they find the main address element on detail pages.
function parseAddressLine(line) {
  if (!line || line.length > 200) return null;
  // Match: STREET (with optional number), CITY-DISTRICT, okres CITY ROMAN
  const m1 = line.match(/^(.+?),\s*([A-ZÁÄÉÍÓÔÚÝ][\wáäéíóôúýčďĺľňŕšťž]+)-([A-ZÁÄÉÍÓÔÚÝ][\wáäéíóôúýčďĺľňŕšťž\s]+?)(?:,\s*okres\s+([A-ZÁÄÉÍÓÔÚÝ][\wáäéíóôúýčďĺľňŕšťž]+(?:\s+[IVX]+)?))?$/);
  if (m1) {
    return {
      street: m1[1].trim(),
      city: m1[2].trim(),
      district: m1[3].trim(),
      okres: m1[4] ? m1[4].trim() : null
    };
  }
  // Fallback: STREET, CITY (no dash district)
  const m2 = line.match(/^(.+?),\s*(Bratislava|Košice|Prešov|Nitra|Žilina|Banská Bystrica|Trnava|Trenčín)(?:\s+\d+\s?\d+)?$/);
  if (m2) {
    return { street: m2[1].trim(), city: m2[2].trim(), district: null, okres: null };
  }
  return null;
}

// Format a parsed address back to display: "Street, District, City"
function formatParsedAddress(parsed) {
  if (!parsed) return '';
  const parts = [];
  if (parsed.street) parts.push(parsed.street);
  if (parsed.district) parts.push(parsed.district);
  if (parsed.city) parts.push(parsed.city);
  return parts.filter(Boolean).join(', ');
}

// Extract postal code (Slovak format: "821 04" or "82104")
function extractPostalCode(text) {
  if (!text) return null;
  const m = text.match(/\b(\d{3}\s?\d{2})\b/);
  return m ? m[1].replace(/\s/g, ' ').replace(/(\d{3})(\d{2})/, '$1 $2') : null;
}

// Main entry: given title + description + structured fields, produce the best address line
function buildRichLocation({ title, description, streetAddress, addressLocality, postalCode, fallbackCity }) {
  const corpus = [title, description, streetAddress, addressLocality].filter(Boolean).join(' ');

  // 1. City detection
  const city = detectCity(corpus) || detectCity(fallbackCity || '') || addressLocality || fallbackCity || '';

  // 2. District
  const district = extractDistrict(corpus, city);

  // 3. Street
  const street = streetAddress || extractStreet(corpus);

  // 4. Postal code
  const pc = postalCode || extractPostalCode(corpus);

  // Build in priority: Street, District — City PSČ
  const parts = [];
  if (street) parts.push(street);
  if (district) parts.push(district);
  const cityLine = [city, pc].filter(Boolean).join(' ').trim();
  if (cityLine) parts.push(cityLine);

  return parts.filter(Boolean).join(', ');
}

module.exports = {
  buildRichLocation,
  detectCity,
  extractDistrict,
  extractStreet,
  extractPostalCode,
  parseAddressLine,
  formatParsedAddress
};
