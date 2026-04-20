const { fetchPage, makeId, extractPhones } = require('./utils');
const { buildRichLocation, parseAddressLine, formatParsedAddress } = require('./address-parser');

// Extract location from nehnutelnosti.sk listing URL slug
// URLs look like: /byty/predaj/bratislava-ruzinov/... or /byty/predaj/kosice/...
// Only match valid location path segments — not query strings like ?price_from=200000
function extractLocationFromUrl(url) {
  if (!url) return '';
  // Require first char to be a letter (rejects ?price_from=... etc.)
  const m = url.match(/\/(?:byty|domy|pozemky|nehnutelnosti)\/predaj\/([a-z][a-z0-9\-]*)\/?(?:[?#]|$)/i);
  if (!m) return '';
  // Convert slug to readable: "bratislava-ruzinov" → "Bratislava Ružinov"
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

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
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

        // Build rich location using title + description + structured data
        // Turns "Bratislava" into "Bratislava - Petržalka, Hálova" when possible
        const fallbackCity = addressLocality || extractLocationFromUrl(url) || location || '';
        const richLocation = buildRichLocation({
          title: name,
          description: desc,
          streetAddress: streetAddress,
          addressLocality: addressLocality,
          postalCode: postalCode,
          fallbackCity: fallbackCity
        });

        const fullAddress = streetAddress;
        const locationValue = richLocation || fallbackCity || '';

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

  const trimmed = results.slice(0, 30);

  // Optional deep enrichment: fetch each detail page in parallel (concurrency-limited)
  // for richer location + phone + full description. Adds 3-8s but much better data.
  if (deep && trimmed.length > 0) {
    await enrichListingsDeep(trimmed, 8);
  }

  return trimmed;
}

// Fetch detail page for each listing in parallel with concurrency limit.
// Extracts full address, postal code, phone from detail HTML.
async function enrichListingsDeep(listings, concurrency) {
  let idx = 0;
  async function worker() {
    while (idx < listings.length) {
      const i = idx++;
      try {
        await enrichOne(listings[i]);
      } catch (e) {
        // silent fail — keep original data
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, listings.length) }, () => worker());
  await Promise.all(workers);
}

async function enrichOne(listing) {
  const html = await fetchPage(listing.url, 8000);
  if (!html) return;

  // STRATEGY 1: Look for the visible address element directly in the HTML.
  // Nehnutelnosti.sk detail pages have a <p class="MuiTypography-..." with the
  // primary address line: "Beňovského 6, Bratislava-Dúbravka, okres Bratislava IV"
  // This is FAR more reliable than JSON-LD which references addresses by @id.
  const primaryAddr = extractPrimaryAddressFromHtml(html);
  if (primaryAddr) {
    const parsed = parseAddressLine(primaryAddr);
    if (parsed) {
      const formatted = formatParsedAddress(parsed);
      if (formatted && formatted.length > (listing.location || '').length) {
        listing.location = formatted;
      }
      if (parsed.street && !listing.address) {
        listing.address = parsed.street;
      }
    }
  }

  // STRATEGY 2: JSON-LD fallback (for phone, description enrichment)
  let detailData = extractJsonLdFromRSC(html);
  if (!detailData) {
    const m = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (m) { try { detailData = JSON.parse(m[1]); } catch (e) {} }
  }

  // Only accept address from REAL-ESTATE node types (not Organization/LocalBusiness — those would
  // give us the office address like "Prievozská 14" for every listing).
  const REALTY_TYPES = new Set([
    'Product', 'Apartment', 'House', 'SingleFamilyResidence', 'Residence',
    'RealEstateListing', 'Accommodation', 'RealEstateAgent' // RealEstateAgent is fallback but we'll check
  ]);

  let streetAddress = '';
  let addressLocality = '';
  let postalCode = '';
  let fullDesc = '';

  if (detailData) {
    const graph = detailData['@graph'] || [detailData];
    for (const node of graph) {
      const t = node['@type'];
      // Accept only nodes that are real-estate items, never Organization/LocalBusiness
      const isRealty = REALTY_TYPES.has(t) && t !== 'RealEstateAgent';
      if (isRealty) {
        const addr = node.address || {};
        streetAddress = streetAddress || addr.streetAddress || '';
        addressLocality = addressLocality || addr.addressLocality || '';
        postalCode = postalCode || addr.postalCode || '';
      }
      // Grab description from ANY node that has it + looks like a listing
      if (isRealty && node.description) {
        fullDesc = fullDesc || node.description;
      }
    }
  }

  // Rebuild richer location — prefer street ONLY if it looks like a real address
  // (not a generic office address). Pass it to buildRichLocation which will combine with title clues.
  const enriched = buildRichLocation({
    title: listing.title,
    description: fullDesc,
    streetAddress: streetAddress,
    addressLocality: addressLocality,
    postalCode: postalCode || extractPostalCodeFromHtml(html),
    fallbackCity: listing.location
  });

  if (enriched && enriched.length > (listing.location || '').length) {
    listing.location = enriched;
  }
  if (streetAddress && !listing.address) {
    listing.address = streetAddress;
  }

  // Try to extract phone if missing
  if (!listing.phone && fullDesc) {
    const phones = extractPhones(fullDesc);
    if (phones.length > 0) listing.phone = phones[0];
  }
}

// Extract a single PSČ from visible HTML (not scripts). Only accept if near a Slovak city name.
function extractPostalCodeFromHtml(html) {
  if (!html) return null;
  // Remove scripts and styles to avoid matching in config
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const m = text.match(/\b(\d{3}\s?\d{2})\b\s*(Bratislava|Košice|Prešov|Nitra|Žilina|Banská Bystrica|Trnava|Trenčín)/i);
  return m ? m[1].replace(/(\d{3})\s?(\d{2})/, '$1 $2') : null;
}

// Find the primary address line on a nehnutelnosti.sk detail page.
// Matches pattern: "STREET N, Bratislava-DISTRICT, okres Bratislava [IVX]+"
// or "STREET, Bratislava-DISTRICT" or "STREET, CITY"
function extractPrimaryAddressFromHtml(html) {
  if (!html) return null;
  // Remove scripts/styles so we don't match inside JSON
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  // Try: STREET [number], CITY-DISTRICT, okres CITY [roman numeral]
  let m = text.match(/>([A-ZÁÄÉÍÓÔÚÝ][^<>,]{1,60}),\s*(Bratislava|Košice|Prešov|Nitra|Žilina|Banská Bystrica|Trnava|Trenčín)-([A-ZÁÄÉÍÓÔÚÝ][\wáäéíóôúýčďĺľňŕšťž\s]+?),\s*okres\s+[A-ZÁÄÉÍÓÔÚÝ][\wáäéíóôúýčďĺľňŕšťž]+(?:\s+[IVX]+)?\s*</);
  if (m) {
    return `${m[1].trim()}, ${m[2]}-${m[3].trim()}, okres ${m[2]}`.trim();
  }
  // Shorter form: STREET, CITY-DISTRICT
  m = text.match(/>([A-ZÁÄÉÍÓÔÚÝ][^<>,]{1,60}),\s*(Bratislava|Košice|Prešov|Nitra|Žilina|Banská Bystrica|Trnava|Trenčín)-([A-ZÁÄÉÍÓÔÚÝ][\wáäéíóôúýčďĺľňŕšťž\s]+?)\s*</);
  if (m) {
    return `${m[1].trim()}, ${m[2]}-${m[3].trim()}`;
  }
  return null;
}

module.exports = { scrape };
