const { fetchPage, makeId, extractPhones } = require('./utils');

// Extract location from nehnutelnosti.sk listing URL slug
// URLs look like: /byty/predaj/bratislava-ruzinov/... or /byty/predaj/kosice/...
function extractLocationFromUrl(url) {
  if (!url) return '';
  const m = url.match(/\/(?:byty|domy|pozemky|nehnutelnosti)\/predaj\/([^\/]+)/i);
  if (!m) return '';
  // Convert slug to readable: "bratislava-ruzinov" → "Bratislava - Ružinov"
  return m[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Map type to nehnutelnosti.sk URL path
const TYPE_MAP = {
  'byt': 'byty',
  'dom': 'domy',
  'pozemok': 'pozemky',
  'iny': 'nehnutelnosti'
};

// Map location to URL-friendly slug
function locationSlug(loc) {
  if (!loc) return '';
  const map = {
    'bratislava': 'bratislava',
    'košice': 'kosice', 'kosice': 'kosice',
    'žilina': 'zilina', 'zilina': 'zilina',
    'nitra': 'nitra',
    'banská bystrica': 'banska-bystrica', 'banska bystrica': 'banska-bystrica',
    'prešov': 'presov', 'presov': 'presov',
    'trnava': 'trnava',
    'trenčín': 'trencin', 'trencin': 'trencin',
    'martin': 'martin',
    'poprad': 'poprad',
    'piešťany': 'piestany', 'piestany': 'piestany',
    'zvolen': 'zvolen',
    'michalovce': 'michalovce',
    'levice': 'levice',
    'komárno': 'komarno', 'komarno': 'komarno',
    'nové zámky': 'nove-zamky', 'nove zamky': 'nove-zamky',
    'lučenec': 'lucenec', 'lucenec': 'lucenec',
    'dunajská streda': 'dunajska-streda', 'dunajska streda': 'dunajska-streda',
    'galanta': 'galanta',
    'topoľčany': 'topolcany', 'topolcany': 'topolcany',
    'partizánske': 'partizanske', 'partizanske': 'partizanske',
    'považská bystrica': 'povazska-bystrica', 'povazska bystrica': 'povazska-bystrica',
    'prievidza': 'prievidza',
    'ružomberok': 'ruzomberok', 'ruzomberok': 'ruzomberok',
    'liptovský mikuláš': 'liptovsky-mikulas', 'liptovsky mikulas': 'liptovsky-mikulas',
    'bardejov': 'bardejov',
    'humenné': 'humenne', 'humenne': 'humenne',
    'snina': 'snina',
    'vranov': 'vranov-nad-toplou',
    'skalica': 'skalica',
    'senica': 'senica',
    'malacky': 'malacky',
    'pezinok': 'pezinok',
    'senec': 'senec',
  };
  const key = loc.toLowerCase().trim();
  return map[key] || key.replace(/\s+/g, '-').replace(/[áä]/g, 'a').replace(/[é]/g, 'e').replace(/[íý]/g, 'i').replace(/[óô]/g, 'o').replace(/[úů]/g, 'u').replace(/[č]/g, 'c').replace(/[ď]/g, 'd').replace(/[ľĺ]/g, 'l').replace(/[ň]/g, 'n').replace(/[ŕ]/g, 'r').replace(/[š]/g, 's').replace(/[ť]/g, 't').replace(/[ž]/g, 'z');
}

// Extract JSON-LD from Next.js RSC streaming payload
function extractJsonLdFromRSC(html) {
  const schemaIdx = html.indexOf('schema.org');
  if (schemaIdx === -1) return null;

  // Find the opening brace before @context
  let start = schemaIdx;
  while (start > 0 && html[start] !== '{') start--;

  // Find the script tag that contains the start
  const scriptStart = html.lastIndexOf('<script>self.__next_f.push([1,"', schemaIdx);
  if (scriptStart === -1) return null;

  const contentStart = scriptStart + '<script>self.__next_f.push([1,"'.length;

  // Collect content from this chunk until the end marker
  const chunkEnd = html.indexOf('"])', contentStart);
  if (chunkEnd === -1) return null;

  const raw = html.substring(contentStart, chunkEnd);

  // Find the JSON object start
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return null;

  try {
    // Unescape JS string literals (\" -> ", \n -> newline, etc.)
    const unescaped = JSON.parse('"' + raw.substring(jsonStart) + '"');
    return JSON.parse(unescaped);
  } catch (e) {
    return null;
  }
}

async function scrape({ location, priceMin, priceMax, type, page }) {
  const cat = TYPE_MAP[type] || 'byty';
  const locSlug = locationSlug(location);

  // Build URL
  let url = `https://www.nehnutelnosti.sk/${cat}/predaj/`;
  if (locSlug) url += `${locSlug}/`;

  const params = new URLSearchParams();
  if (priceMin) params.set('price_from', priceMin);
  if (priceMax) params.set('price_to', priceMax);
  if (page && page > 1) params.set('p[page]', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchPage(url, 15000);
  const results = [];

  // Try RSC extraction first (Next.js streaming format)
  let data = extractJsonLdFromRSC(html);

  // Fallback: try standard JSON-LD script tag
  if (!data) {
    const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
    let jsonMatch;
    while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
      try {
        data = JSON.parse(jsonMatch[1]);
        break;
      } catch (e) {}
    }
  }

  if (!data) return results;

  // Process the graph
  const graph = data['@graph'] || (Array.isArray(data) ? data : [data]);

  for (const node of graph) {
    if (node['@type'] === 'SearchResultsPage' && node.mainEntity) {
      const items = node.mainEntity.itemListElement || [];

      for (const item of items) {
        const listing = item.item || item;

        const name = listing.name || '';
        const listingUrl = listing.url || '';
        const price = listing.priceSpecification?.price || listing.offers?.price || null;
        const area = listing.floorSize?.value || null;
        const desc = listing.description || '';
        const image = Array.isArray(listing.image) ? listing.image[0] : listing.image;

        const phones = extractPhones(desc);

        // Extract agent/offeredBy info for agency filtering
        const offeredBy = listing.offeredBy;
        let agentName = '';
        if (offeredBy) {
          if (typeof offeredBy === 'string') agentName = offeredBy;
          else if (offeredBy.name) agentName = offeredBy.name;
          else if (offeredBy['@id']) {
            // Resolve from graph
            const agentNode = graph.find(n => n['@id'] === offeredBy['@id']);
            if (agentNode) agentName = agentNode.name || '';
          }
        }

        // ID from /detail/JuRtQym6Qpm/slug or old /12345/ format
        const idMatch = listingUrl.match(/\/detail\/([^\/]+)/) || listingUrl.match(/\/(\d+)\/?$/);
        const id = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 8);

        // Build address from JSON-LD structured data or extract from description
        const structuredAddress = listing.address || {};
        const streetAddress = structuredAddress.streetAddress || '';
        const addressLocality = structuredAddress.addressLocality || '';
        const postalCode = structuredAddress.postalCode || '';

        let fullAddress = streetAddress;
        // Fallback chain: structured data → URL slug from search page → search param
        let locationValue = addressLocality || extractLocationFromUrl(url) || location || '';

        // If structured data has postal code, append it
        if (postalCode && !locationValue.includes(postalCode)) {
          locationValue = locationValue ? `${locationValue}, ${postalCode}` : postalCode;
        }

        results.push({
          id: makeId('nehnutelnosti', id),
          source: 'nehnutelnosti.sk',
          title: name,
          address: fullAddress,
          location: locationValue,
          price: price ? parseFloat(price) : null,
          priceText: price ? `${Number(price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
          phone: phones.length > 0 ? phones[0] : null,
          url: listingUrl.startsWith('http') ? listingUrl : `https://www.nehnutelnosti.sk${listingUrl}`,
          type: type || 'byt',
          size: area ? parseFloat(area) : null,
          imageUrl: image || null,
          agentName: agentName,
          scrapedAt: new Date().toISOString()
        });
      }
    }
  }

  return results.slice(0, 30);
}

module.exports = { scrape };
