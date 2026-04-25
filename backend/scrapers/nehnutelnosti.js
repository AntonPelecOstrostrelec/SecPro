// Nehnutelnosti.sk scraper
//
// Strategy: hit /vysledky/{cat}/{location}/predaj — Next.js page that streams
// JSON-LD inside RSC chunks. Parse the SearchResultsPage entity with rich
// per-listing data including offeredBy.@type (RK detection signal).
//
// This is the primary Slovak portal. Most reliable + richest data.

const { fetchText } = require('../lib/http');

const BASE = 'https://www.nehnutelnosti.sk';

const TYPE_MAP = {
  byt:     'byty',
  dom:     'domy',
  pozemok: 'pozemky',
  iny:     'nehnutelnosti',
};

// Slovak city → URL slug (no diacritics, hyphens for spaces)
const CITY_SLUG = {
  'bratislava': 'bratislava',
  'kosice': 'kosice', 'košice': 'kosice',
  'zilina': 'zilina', 'žilina': 'zilina',
  'nitra': 'nitra',
  'banska bystrica': 'banska-bystrica', 'banská bystrica': 'banska-bystrica',
  'presov': 'presov', 'prešov': 'presov',
  'trnava': 'trnava',
  'trencin': 'trencin', 'trenčín': 'trencin',
  'martin': 'martin',
  'poprad': 'poprad',
  'piestany': 'piestany', 'piešťany': 'piestany',
  'zvolen': 'zvolen',
  'michalovce': 'michalovce',
  'levice': 'levice',
  'komarno': 'komarno', 'komárno': 'komarno',
  'nove zamky': 'nove-zamky', 'nové zámky': 'nove-zamky',
  'lucenec': 'lucenec', 'lučenec': 'lucenec',
  'prievidza': 'prievidza',
  'ruzomberok': 'ruzomberok', 'ružomberok': 'ruzomberok',
  'senec': 'senec', 'pezinok': 'pezinok', 'malacky': 'malacky',
  'senica': 'senica', 'skalica': 'skalica',
};

function citySlug(loc) {
  if (!loc) return '';
  const k = loc.toLowerCase().trim();
  if (CITY_SLUG[k]) return CITY_SLUG[k];
  return k.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
}

// Walk the RSC streamed payload. Each script tag pushes a chunk that may
// contain a JSON-LD blob. We scan for any `schema.org` reference and
// reconstruct the surrounding JSON.
function extractRscJsonLd(html) {
  const results = [];
  const pattern = /<script>self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)<\/script>/g;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const raw = m[1];
    if (!raw.includes('schema.org')) continue;
    try {
      const unescaped = JSON.parse('"' + raw + '"');
      // The chunk is RSC-prefixed (e.g. "13:{...}"). Find the JSON-LD doc.
      // Match `{` (any whitespace) `"@context"` — JSON.org allows whitespace.
      const ctxMatch = unescaped.match(/\{\s*"@context"/);
      if (!ctxMatch) continue;
      const jsonStart = ctxMatch.index;
      // Balanced brace search
      let depth = 0, end = -1;
      for (let i = jsonStart; i < unescaped.length; i++) {
        const c = unescaped[i];
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (end === -1) continue;
      const jsonStr = unescaped.slice(jsonStart, end);
      results.push(JSON.parse(jsonStr));
    } catch {}
  }
  return results;
}

// Fallback: standard JSON-LD <script type="application/ld+json"> tags
function extractStandardJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(JSON.parse(m[1])); } catch {}
  }
  return out;
}

function findListings(jsonLdDocs) {
  for (const doc of jsonLdDocs) {
    const graph = doc['@graph'] || [doc];
    for (const node of graph) {
      if (node['@type'] === 'SearchResultsPage' && node.mainEntity?.itemListElement) {
        return { items: node.mainEntity.itemListElement, graph };
      }
    }
  }
  return { items: [], graph: [] };
}

function detectSellerType(offeredBy, graph) {
  if (!offeredBy) return { type: 'unknown', name: null };
  if (typeof offeredBy === 'string') {
    return { type: 'agency', name: offeredBy };
  }

  // Resolve @id reference if present
  let node = offeredBy;
  if (offeredBy['@id']) {
    const found = graph.find(n => n['@id'] === offeredBy['@id']);
    if (found) node = found;
  }

  // Direct @type
  let t = node['@type'];

  // Fallback: parse type from @id URL path (e.g. ".../schema/RealEstateAgent/{uuid}")
  // — when graph lookup fails because Schema.org keeps the entity in a separate chunk.
  if (!t && node['@id']) {
    const m = node['@id'].match(/schema\/([A-Za-z]+)\//);
    if (m) t = m[1];
  }

  const name = node.name || null;
  if (t === 'RealEstateAgent' || t === 'Organization' || t === 'LocalBusiness') {
    return { type: 'agency', name };
  }
  if (t === 'Person') {
    return { type: 'private', name };
  }
  return { type: 'unknown', name };
}

/**
 * Scrape one page of nehnutelnosti.sk listings.
 * @param {Object} opts
 * @returns {Promise<{listings:Array, totalCount:number, raw:Object}>}
 */
async function scrapePage(opts) {
  const {
    location = '',
    type = 'byt',
    operation = 'predaj',
    priceMin,
    priceMax,
    page = 1,
  } = opts;

  const cat = TYPE_MAP[type] || 'byty';
  const slug = citySlug(location);
  const opPath = operation === 'prenajom' ? 'prenajom' : 'predaj';

  let url = `${BASE}/vysledky/${cat}/`;
  if (slug) url += `${slug}/`;
  url += opPath;

  const params = new URLSearchParams();
  if (priceMin) params.set('price_from', priceMin);
  if (priceMax) params.set('price_to', priceMax);
  if (page > 1) params.set('page', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchText(url, { timeoutMs: 20000, retries: 2, label: `nehnutelnosti p${page}` });

  let docs = extractRscJsonLd(html);
  if (docs.length === 0) docs = extractStandardJsonLd(html);
  if (docs.length === 0) {
    return { listings: [], totalCount: 0, raw: { error: 'no JSON-LD', url } };
  }

  const { items, graph } = findListings(docs);

  const listings = items.map(item => {
    const listing = item.item || item;
    const listingUrl = listing.url?.startsWith('http') ? listing.url : `${BASE}${listing.url || ''}`;
    const idMatch = listingUrl.match(/\/detail\/([^\/]+)/) || listingUrl.match(/\/(\d+)\/?$/);
    const externalId = idMatch ? idMatch[1] : Math.random().toString(36).slice(2, 12);

    const price = listing.priceSpecification?.price || listing.offers?.price || null;
    const area = listing.floorSize?.value || null;
    const desc = listing.description || '';
    const image = Array.isArray(listing.image) ? listing.image[0] : listing.image;

    const addr = listing.address || {};
    const streetAddress = addr.streetAddress || '';
    const addressLocality = addr.addressLocality || '';
    const postalCode = addr.postalCode || '';

    const seller = detectSellerType(listing.offeredBy, graph);

    // City: prefer structured addressLocality, fall back to the search location
    // (which we know is the canonical city since it's in the URL slug).
    const cityNormalized = addressLocality || (location ? location.charAt(0).toUpperCase() + location.slice(1).toLowerCase() : null);

    return {
      external_id: externalId,
      url: listingUrl,
      source_title: listing.name || null,
      source_price: price ? parseFloat(price) : null,
      source_seller_name: seller.name,
      raw_payload: listing,
      derived: {
        type,
        operation,
        price: price ? parseFloat(price) : null,
        size_m2: area ? parseFloat(area) : null,
        title: listing.name || null,
        description: desc,
        street: streetAddress,
        city: cityNormalized,
        postal_code: postalCode || null,
        image_url: typeof image === 'string' ? image : null,
        seller_type: seller.type,
        seller_name: seller.name,
      },
    };
  });

  // Try to get totalCount from page metadata
  let totalCount = 0;
  for (const doc of docs) {
    const graphArr = doc['@graph'] || [doc];
    for (const n of graphArr) {
      if (n.totalCount != null) totalCount = n.totalCount;
      if (n.numberOfItems != null) totalCount = totalCount || n.numberOfItems;
    }
  }

  return { listings, totalCount, raw: { url, page } };
}

module.exports = { scrapePage };
