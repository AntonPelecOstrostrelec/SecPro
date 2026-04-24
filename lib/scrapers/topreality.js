const { fetchPage, extractPrice, stripTags, makeId, normalizeLocation } = require('./utils');
const { buildRichLocation } = require('./address-parser');
const { enrichListings } = require('./deep-enrich');

const TYPE_MAP = {
  'byt': '101',
  'dom': '201',
  'pozemok': '301',
  'iny': ''
};

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  const typeCode = TYPE_MAP[type] || '101';
  const pg = page || 1;

  let url;
  if (pg > 1) {
    url = `https://www.topreality.sk/vyhladavanie-nehnutelnosti-${pg}.html`;
  } else {
    url = `https://www.topreality.sk/vyhladavanie-nehnutelnosti.html`;
  }

  const params = new URLSearchParams();
  if (typeCode) params.set('type[]', typeCode);
  if (location) params.set('obec', location);
  if (priceMin) params.set('cena_od', priceMin);
  if (priceMax) params.set('cena_do', priceMax);
  params.set('n_search', 'search');
  url += '?' + params.toString();

  const html = await fetchPage(url);
  const results = [];

  // Match estate listing blocks: <div class="row estate" data-idinz="123456">
  const estatePattern = /data-idinz="(\d+)"([\s\S]*?)(?=data-idinz="|<div class="pagination|$)/g;
  let match;

  while ((match = estatePattern.exec(html)) !== null) {
    const id = match[1];
    const block = match[2];
    const text = stripTags(block);

    // Extract link
    const linkMatch = block.match(/href="(\/[^"]*\/\d+\.html)"/);
    const detailUrl = linkMatch ? `https://www.topreality.sk${linkMatch[1]}` : '';

    // Extract title from link text
    const titleMatch = block.match(/href="[^"]*"[^>]*>([^<]+)<\/a>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract price — try targeted HTML element first, then fallback
    let price = null;
    let priceText = '';
    const priceElMatch = block.match(/<[^>]*class="[^"]*(?:price|cena)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (priceElMatch) {
      const res = extractPrice(stripTags(priceElMatch[1]));
      price = res.price;
      priceText = res.priceText;
    }
    if (!price) {
      const res = extractPrice(text);
      price = res.price;
      priceText = res.priceText;
    }
    // Sanity: priceText should be short (just the price), not a huge text block
    if (priceText && priceText.length > 30) priceText = '';

    // Extract area (m2)
    const areaMatch = text.match(/([\d,]+)\s*m[²2]/);
    const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;

    // Extract image
    const imgMatch = block.match(/src="(https?:\/\/[^"]*(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    // Filter by price
    if (priceMin && price && price < priceMin) continue;
    if (priceMax && price && price > priceMax) continue;

    if (title || detailUrl) {
      const baseLocation = normalizeLocation(title);
      const richLocation = buildRichLocation({
        title: title,
        description: text,
        addressLocality: baseLocation,
        fallbackCity: baseLocation || location
      });

      results.push({
        id: makeId('topreality', id),
        source: 'topreality.sk',
        title: title || 'Nehnuteľnosť',
        address: '',
        location: richLocation || baseLocation,
        price: price,
        priceText: priceText || 'Na vyžiadanie',
        phone: null,
        url: detailUrl,
        type: type || 'byt',
        size: area,
        imageUrl: imageUrl,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  const trimmed = results.slice(0, 60);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
