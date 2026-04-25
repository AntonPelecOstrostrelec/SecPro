// Bazos.sk scraper (reality.bazos.sk)
//
// Strategy: static HTML parsing. Each listing is in <div class="inzeraty inzeratyflex">.
// No JSON-LD, no Apollo cache, no JS rendering needed.
//
// Bazos is the primary source of PRIVATE seller listings in Slovakia.
// Phones are in description plain text (no SMS verification gate for reading).

const { fetchText } = require('../lib/http');

const BASE = 'https://reality.bazos.sk';

const TYPE_MAP = {
  byt:     'byt',
  dom:     'dom',
  pozemok: 'pozemky',
};

// Inline helpers so we don't drag /lib/scrapers/utils.js into new backend
function stripTags(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

// Slovak/Czech phone formats: +421 9XX XXX XXX, 09XX XXX XXX, 9XX XXX XXX, etc.
function extractPhones(text) {
  if (!text) return [];
  const matches = text.match(/(?:\+421\s?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g) || [];
  return [...new Set(matches.map(p => p.replace(/[\s-]/g, '')))];
}

function extractPrice(text) {
  if (!text) return { price: null, priceText: '' };
  const t = text.replace(/\s/g, '');
  // "189000€" or "189000 €"
  const m = t.match(/(\d+[.,]?\d*)€/);
  if (m) {
    const price = parseFloat(m[1].replace(',', '.'));
    if (price > 100) return { price, priceText: text.trim() };
  }
  return { price: null, priceText: text.trim() };
}

// "Bratislava\n850 00" → "Bratislava 850 00"
function normalizeLocation(raw) {
  if (!raw) return '';
  return raw
    .replace(/(\D)(\d{3}\s?\d{2})/, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quick heuristic for RK listings on bazos.
 * Bazos is mostly private but RKs do post there. Real classification will come
 * from AI extraction (step 2). For now: simple text patterns.
 */
function detectSellerHint(title, description) {
  const t = (title + ' ' + description).toLowerCase();
  // High-confidence RK indicators
  if (/\b(rk|realitn[áa] kancel[aá]ria|rk\s+ponuka|provízia|provizia|hľadáme klientov|hladame|maklér|makler)\b/i.test(t)) {
    return 'agency';
  }
  if (/\bID\s+\d{4,}\b/i.test(title)) return 'agency'; // RK ID format e.g. "ID 12345"
  return 'private'; // optimistic default — AI will reclassify
}

/**
 * Scrape one page of bazos listings.
 */
async function scrapePage(opts) {
  const {
    location = '',
    type = 'byt',
    operation = 'predaj',     // bazos has /predam/ or /pronajem/
    priceMin,
    priceMax,
    page = 1,
  } = opts;

  const cat = TYPE_MAP[type] || 'byt';
  const opSlug = operation === 'prenajom' ? 'pronajem' : 'predam';
  const offset = (page - 1) * 20;

  let url = `${BASE}/${opSlug}/${cat}/${offset > 0 ? offset + '/' : ''}`;
  const params = new URLSearchParams();
  if (location) params.set('hledat', location);
  if (priceMin) params.set('cenaod', priceMin);
  if (priceMax) params.set('cenado', priceMax);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchText(url, { timeoutMs: 15000, retries: 2, label: `bazos p${page}` });

  const listings = [];
  const blockPattern = /<div class="inzeraty inzeratyflex">([\s\S]*?)(?=<div class="inzeraty inzeratyflex">|<div id="strankovani">|<\/body>)/g;

  let bm;
  while ((bm = blockPattern.exec(html)) !== null) {
    const block = bm[1];

    // Title link → URL + ID + title
    const titleLinkMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="(\/inzerat\/(\d+)\/[^"]*)"[^>]*>([^<]+)<\/a>/);
    if (!titleLinkMatch) continue;
    const listingPath = titleLinkMatch[1];
    const externalId = titleLinkMatch[2];
    const title = titleLinkMatch[3].trim();

    // Image — bazos uses predictable URL pattern; get the actual <img src> if present
    const imgMatch = block.match(/<img[^>]+src="(https?:\/\/[^"]*?bazos\.sk[^"]*?\.jpg[^"]*?)"/);
    const imageUrl = imgMatch ? imgMatch[1] : `https://www.bazos.sk/img/1t/${externalId.slice(-3)}/${externalId}.jpg`;

    // Price block
    const priceMatch = block.match(/<div class="inzeratycena">([\s\S]*?)<\/div>/);
    const priceBlock = priceMatch ? stripTags(priceMatch[1]).trim() : '';
    const { price, priceText } = extractPrice(priceBlock);

    // Location block (City + postal)
    const locMatch = block.match(/<div class="inzeratylok">([\s\S]*?)<\/div>/);
    const locText = normalizeLocation(locMatch ? stripTags(locMatch[1]).trim() : '');

    // Description (in summary card, not full)
    const descMatch = block.match(/<div class=popis>([\s\S]*?)<\/div>/);
    const descText = descMatch ? stripTags(descMatch[1]).trim() : '';

    // Phone(s) from description + title
    const phones = extractPhones(descText + ' ' + title);

    // Parse "City PSČ" → city, postal_code
    const psc = locText.match(/(\d{3}\s?\d{2})$/);
    const postalCode = psc ? psc[1] : null;
    const city = locText.replace(/\s*\d{3}\s?\d{2}\s*$/, '').trim() || null;

    const sellerType = detectSellerHint(title, descText);

    listings.push({
      external_id: externalId,
      url: `${BASE}${listingPath}`,
      source_title: title,
      source_price: price,
      source_seller_name: null,
      raw_payload: {
        title,
        priceText,
        locText,
        descText,
        imageUrl,
        phones,
      },
      derived: {
        type,
        operation,
        price,
        size_m2: null,                 // bazos rarely puts this in summary; AI will extract from full description
        title,
        description: descText,
        city,
        postal_code: postalCode,
        image_url: imageUrl,
        seller_type: sellerType,
        seller_name: null,
        phone: phones[0] || null,
      },
    });
  }

  return { listings, totalCount: 0, raw: { url, page } };
}

module.exports = { scrapePage };
