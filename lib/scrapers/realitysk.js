const { fetchPage, makeId, extractPhones } = require('./utils');
const { buildRichLocation } = require('./address-parser');
const { enrichListings } = require('./deep-enrich');

const TYPE_MAP = {
  'byt': 'byty',
  'dom': 'domy',
  'pozemok': 'pozemky',
  'iny': 'nehnutelnosti'
};

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  const cat = TYPE_MAP[type] || 'byty';

  let url = `https://www.reality.sk/${cat}/predaj/`;
  if (location) {
    const slug = location.toLowerCase().replace(/\s+/g, '-')
      .replace(/[áä]/g, 'a').replace(/[é]/g, 'e').replace(/[íý]/g, 'i')
      .replace(/[óô]/g, 'o').replace(/[úů]/g, 'u').replace(/[č]/g, 'c')
      .replace(/[ď]/g, 'd').replace(/[ľĺ]/g, 'l').replace(/[ň]/g, 'n')
      .replace(/[ŕ]/g, 'r').replace(/[š]/g, 's').replace(/[ť]/g, 't').replace(/[ž]/g, 'z');
    url += `${slug}/`;
  }

  const params = new URLSearchParams();
  if (priceMin) params.set('price_from', priceMin);
  if (priceMax) params.set('price_to', priceMax);
  if (page && page > 1) params.set('page', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchPage(url);
  const results = [];

  // Parse JSON-LD structured data
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let jsonMatch;

  while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const items = data.itemListElement || data.mainEntity?.itemListElement || [];

      if (items.length === 0 && data['@graph']) {
        for (const node of data['@graph']) {
          if (node.itemListElement) {
            processItems(node.itemListElement, results, type);
          }
        }
      } else {
        processItems(items, results, type);
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  // Fallback: try to parse from HTML if no JSON-LD results
  if (results.length === 0) {
    const linkPattern = /href="(\/detail\/[^"]+)"[^>]*>([^<]*)</g;
    let m;
    while ((m = linkPattern.exec(html)) !== null) {
      const detailUrl = `https://www.reality.sk${m[1]}`;
      const title = m[2].trim();
      if (title && title.length > 5) {
        const id = m[1].match(/\/(\d+)/)?.[1] || Math.random().toString(36).substr(2, 8);
        results.push({
          id: makeId('realitysk', id),
          source: 'reality.sk',
          title: title,
          address: '',
          location: title,
          price: null,
          priceText: 'Na vyžiadanie',
          phone: null,
          url: detailUrl,
          type: type || 'byt',
          size: null,
          imageUrl: null,
          scrapedAt: new Date().toISOString()
        });
      }
    }
  }

  const trimmed = results.slice(0, 24);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

function processItems(items, results, type) {
  for (const item of items) {
    const listing = item.item || item.mainEntity || item;
    const name = listing.name || '';
    const listingUrl = listing.url || '';
    const price = listing.offers?.price || listing.priceSpecification?.price || null;
    const desc = listing.description || '';
    const image = Array.isArray(listing.image) ? listing.image[0] : listing.image;
    const area = listing.floorSize?.value || null;

    const phones = extractPhones(desc);
    const idMatch = listingUrl.match(/\/(\d+)/);
    const id = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 8);

    const baseLocality = listing.address?.addressLocality || '';
    const richLocation = buildRichLocation({
      title: name,
      description: desc,
      streetAddress: listing.address?.streetAddress || '',
      addressLocality: baseLocality,
      postalCode: listing.address?.postalCode || '',
      fallbackCity: baseLocality
    });

    results.push({
      id: makeId('realitysk', id),
      source: 'reality.sk',
      title: name,
      address: listing.address?.streetAddress || '',
      location: richLocation || baseLocality || name,
      price: price ? parseFloat(price) : null,
      priceText: price ? `${Number(price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
      phone: phones.length > 0 ? phones[0] : null,
      url: listingUrl.startsWith('http') ? listingUrl : `https://www.reality.sk${listingUrl}`,
      type: type || 'byt',
      size: area ? parseFloat(area) : null,
      imageUrl: image || null,
      scrapedAt: new Date().toISOString()
    });
  }
}

module.exports = { scrape };
