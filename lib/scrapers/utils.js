// Shared utilities for all scrapers

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sk-SK,sk;q=0.9,cs;q=0.8,en;q=0.7',
};

async function fetchPage(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Extract phone numbers from text using Slovak patterns
function extractPhones(text) {
  if (!text) return [];
  const patterns = [
    /(\+421\s?\d{3}\s?\d{3}\s?\d{3})/g,
    /(0\d{3}\s?\d{3}\s?\d{3})/g,
    /(\+421\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2})/g,
    /(09\d{2}\s?\d{3}\s?\d{3})/g,
  ];
  const phones = new Set();
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) matches.forEach(m => phones.add(m.replace(/\s+/g, ' ').trim()));
  }
  return [...phones];
}

// Parse price from text like "125 000 €" or "125000"
function parsePrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Extract price number from text with € sign
function extractPrice(text) {
  if (!text) return { price: null, priceText: '' };
  // Match patterns like "125 000 €", "1 250,50 €", "125000€"
  const m = text.match(/([\d\s,.]+)\s*€/);
  if (m) {
    const numStr = m[1].replace(/\s/g, '').replace(',', '.');
    return { price: parseFloat(numStr) || null, priceText: m[0].trim() };
  }
  return { price: null, priceText: '' };
}

// Simple HTML tag stripper
function stripTags(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

// Generate unique ID
function makeId(source, id) {
  return `${source}-${id}`;
}

// Normalize location text
function normalizeLocation(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// Detect if listing is from a real estate agency (not a private seller)
const AGENCY_KEYWORDS = [
  // Legal entity suffixes
  's.r.o.', 's.r.o', 'a.s.', 'a.s', 'k.s.', 'spol.', 'sro',
  // Agency names and patterns
  'reality', 'Reality', 'REALITY', 'realit', 'Realit', 'REALIT',
  'real estate', 'Real Estate',
  're/max', 'RE/MAX', 'Re/Max', 'remax', 'REMAX',
  'century 21', 'Century 21', 'CENTURY 21',
  'coldwell', 'Coldwell', 'COLDWELL',
  'sotheby', 'Sotheby',
  'bonard', 'Bonard', 'BONARD',
  'herrys', 'HERRYS', 'Herrys',
  'lexxus', 'LEXXUS', 'Lexxus',
  'proxenta', 'PROXENTA', 'Proxenta',
  'riality', 'Riality',
  'byty bratislava', 'Byty Bratislava',
  'nehnuteľnost', 'Nehnuteľnost',
  // Role keywords
  'realitná kancelária', 'realitna kancelaria',
  'realitná spoločnosť', 'realitna spolocnost',
  'realitný maklér', 'realitny makler',
  'maklér', 'makléř', 'makler',
  'broker', 'Broker', 'BROKER',
  'estate agent', 'Estate Agent',
  // Common RK prefixes in listings
  'RK ', 'R.K.', 'rk ',
];

function isAgencyListing(listing) {
  // Check title, location, address, and any agent/source info
  const textToCheck = [
    listing.title || '',
    listing.agent || '',
    listing.agentName || '',
    listing.offeredBy || '',
  ].join(' ');

  const lower = textToCheck.toLowerCase();

  for (const kw of AGENCY_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return true;
    }
  }

  // Check for common patterns: company abbreviations at word boundaries
  if (/\b(s\.?r\.?o\.?|a\.?s\.?)\b/i.test(textToCheck)) return true;

  return false;
}

module.exports = { fetchPage, extractPhones, parsePrice, extractPrice, stripTags, makeId, normalizeLocation, isAgencyListing, HEADERS };
