// Shared deep-enrichment utility for all scrapers.
// Given a list of listings, fetches each detail page in parallel and upgrades:
//   - location (full address from visible HTML or JSON-LD)
//   - phone (from description text)
//   - address (street)

const { fetchPage, extractPhones } = require('./utils');
const { buildRichLocation, parseAddressLine, formatParsedAddress } = require('./address-parser');

// Patterns that find the primary visible address line on Slovak real-estate pages.
// Handles common formats across portals:
//   "Beňovského 6, Bratislava-Dúbravka, okres Bratislava IV"  (nehnutelnosti.sk)
//   "Hálova, Petržalka"
//   "Karloveská 5, 841 04 Bratislava"
//   "Staré Mesto, Bratislava"
const SLOVAK_CITIES = ['Bratislava', 'Košice', 'Prešov', 'Nitra', 'Žilina',
  'Banská Bystrica', 'Trnava', 'Trenčín', 'Martin', 'Poprad', 'Zvolen'];

function extractPrimaryAddressLine(html) {
  if (!html) return null;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  const cityAlt = SLOVAK_CITIES.map(c => c.replace(/\s/g, '\\s')).join('|');

  // Tier 1: Full form — "STREET [N], CITY-DISTRICT, okres CITY [ROMAN]"
  let m = text.match(new RegExp(
    `>\\s*([A-ZÁÄÉÍÓÔÚÝ][^<>,]{1,60}),\\s*(${cityAlt})-([A-ZÁÄÉÍÓÔÚÝ][\\wáäéíóôúýčďĺľňŕšťž\\s]+?),\\s*okres\\s+[A-ZÁÄÉÍÓÔÚÝ][\\wáäéíóôúýčďĺľňŕšťž]+(?:\\s+[IVX]+)?\\s*<`
  ));
  if (m) return `${m[1].trim()}, ${m[2]}-${m[3].trim()}`;

  // Tier 2: "STREET, CITY-DISTRICT"
  m = text.match(new RegExp(
    `>\\s*([A-ZÁÄÉÍÓÔÚÝ][^<>,]{1,60}),\\s*(${cityAlt})-([A-ZÁÄÉÍÓÔÚÝ][\\wáäéíóôúýčďĺľňŕšťž\\s]+?)\\s*<`
  ));
  if (m) return `${m[1].trim()}, ${m[2]}-${m[3].trim()}`;

  // Tier 3: "STREET N, 123 45 CITY" (street + postal code + city)
  m = text.match(new RegExp(
    `>\\s*([A-ZÁÄÉÍÓÔÚÝ][^<>,]{1,60}),\\s*(\\d{3}\\s?\\d{2})\\s+(${cityAlt})\\s*<`
  ));
  if (m) return `${m[1].trim()}, ${m[2]} ${m[3]}`;

  return null;
}

// Try to find a JSON-LD graph node with a real-estate type that has actual address data
function extractRealEstateJsonLd(html) {
  if (!html) return null;
  const scripts = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try { scripts.push(JSON.parse(match[1])); } catch (e) {}
  }

  const REALTY_TYPES = new Set([
    'Apartment', 'House', 'SingleFamilyResidence', 'Residence',
    'RealEstateListing', 'Accommodation', 'Product', 'Place'
  ]);

  const output = { streetAddress: '', addressLocality: '', postalCode: '', description: '' };

  for (const data of scripts) {
    const graph = data['@graph'] || (Array.isArray(data) ? data : [data]);
    for (const node of graph) {
      const t = node['@type'];
      if (REALTY_TYPES.has(t) && node.address && typeof node.address === 'object' && !node.address['@id']) {
        const a = node.address;
        output.streetAddress = output.streetAddress || a.streetAddress || '';
        output.addressLocality = output.addressLocality || a.addressLocality || '';
        output.postalCode = output.postalCode || a.postalCode || '';
      }
      if (REALTY_TYPES.has(t) && node.description) {
        output.description = output.description || node.description;
      }
    }
  }
  return output;
}

async function enrichOne(listing) {
  try {
    const html = await fetchPage(listing.url, 8000);
    if (!html) return;

    // Strategy 1: Primary visible address line from HTML
    const addrLine = extractPrimaryAddressLine(html);
    if (addrLine) {
      const parsed = parseAddressLine(addrLine);
      if (parsed && looksLikeRealAddress(parsed)) {
        const formatted = formatParsedAddress(parsed);
        // Only accept if meaningfully better than current and under sane length
        if (formatted && formatted.length <= 80 &&
            formatted.length > (listing.location || '').length) {
          listing.location = formatted;
        }
        if (parsed.street && !listing.address && looksLikeStreet(parsed.street)) {
          listing.address = parsed.street;
        }
      }
    }

    // Strategy 2: JSON-LD real-estate nodes
    const jsonld = extractRealEstateJsonLd(html);
    if (jsonld) {
      if (!listing.location || listing.location.length < 15) {
        const enriched = buildRichLocation({
          title: listing.title,
          description: jsonld.description,
          streetAddress: jsonld.streetAddress,
          addressLocality: jsonld.addressLocality,
          postalCode: jsonld.postalCode,
          fallbackCity: listing.location
        });
        if (enriched && enriched.length > (listing.location || '').length) {
          listing.location = enriched;
        }
      }
      if (jsonld.streetAddress && !listing.address) {
        listing.address = jsonld.streetAddress;
      }
      // Phone from description
      if (!listing.phone && jsonld.description) {
        const phones = extractPhones(jsonld.description);
        if (phones.length > 0) listing.phone = phones[0];
      }
    }
  } catch (e) {
    // silent — keep original data
  }
}

async function enrichListings(listings, concurrency = 8) {
  if (!listings || listings.length === 0) return;
  let idx = 0;
  async function worker() {
    while (idx < listings.length) {
      const i = idx++;
      await enrichOne(listings[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, listings.length) }, () => worker());
  await Promise.all(workers);
}

// Validate that a parsed street looks like a real Slovak street (not title pollution)
function looksLikeStreet(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length < 3 || t.length > 45) return false;
  // Reject all-caps noise (real streets aren't YELLED)
  const letters = t.replace(/[^A-Za-zÁÄÉÍÓÔÚÝáäéíóôúýČĎĹĽŇŔŠŤŽčďĺľňŕšťž]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) return false;
  // Reject too many words — Slovak streets are usually 1-3 words
  const words = t.split(/\s+/);
  if (words.length > 5) return false;
  // Reject real-estate listing keywords
  const junk = /\b(izb|izbov|byt|dom|predaj|predajom|rekonstruk|zrekonstruov|kompletne|precizne|luxus|novostavba|projekt|exkluzív|m²)/i;
  if (junk.test(t)) return false;
  return true;
}

function looksLikeRealAddress(parsed) {
  if (!parsed) return false;
  if (parsed.street && !looksLikeStreet(parsed.street)) return false;
  return true;
}

module.exports = { enrichListings, enrichOne, extractPrimaryAddressLine, looksLikeStreet };
