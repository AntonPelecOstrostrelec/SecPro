const { fetchPage, extractPrice, stripTags, makeId, extractPhones } = require('./utils');
const { enrichListings } = require('./deep-enrich');
const { buildRichLocation } = require('./address-parser');

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  let url = `https://www.byty.sk/predaj/`;
  if (type === 'dom') url = `https://www.byty.sk/domy/predaj/`;
  else if (type === 'pozemok') url = `https://www.byty.sk/pozemky/predaj/`;

  const params = new URLSearchParams();
  if (location) params.set('p[keyword]', location);
  if (priceMin) params.set('p[price_from]', priceMin);
  if (priceMax) params.set('p[price_to]', priceMax);
  if (page && page > 1) params.set('p[page]', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  let html;
  try {
    html = await fetchPage(url, 30000);
  } catch (e) {
    return [];
  }
  const results = [];

  // Each listing card is a <div class="inzerat zv2" id="iNNNNNN">...</div>
  const cardPattern = /<div\s+class="inzerat[^"]*"\s+id="i(\d+)"[^>]*>([\s\S]*?)(?=<div\s+class="inzerat[^"]*"\s+id="i\d+"|<div\s+class="clearer)/g;
  let card;
  const seen = new Set();
  while ((card = cardPattern.exec(html)) !== null) {
    const adId = card[1];
    if (seen.has(adId)) continue;
    seen.add(adId);
    const block = card[2];

    // Detail URL + title from h2 > a
    const titleMatch = block.match(/<h2[^>]*>\s*<a\s+href="(https?:\/\/www\.byty\.sk\/\d+\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;
    const detailUrl = titleMatch[1];
    const title = stripTags(titleMatch[2]).trim();
    if (title.length < 3) continue;

    // Image: first img inside advertisement-photo / advertPhoto anchor
    let imageUrl = null;
    const imgMatch = block.match(/<a[^>]*class="[^"]*advertPhoto[^"]*"[^>]*>\s*<img[^>]*\s(?:data-src|src)="([^"]+)"/i)
      || block.match(/<div[^>]*class="[^"]*advertisement-photo[^"]*"[\s\S]*?<img[^>]*\s(?:data-src|src)="([^"]+)"/i);
    if (imgMatch) imageUrl = imgMatch[1];

    // Price
    let price = null, priceText = '';
    const priceMatch = block.match(/<p[^>]*class="[^"]*(?:price|cena)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (priceMatch) {
      const res = extractPrice(stripTags(priceMatch[1]));
      price = res.price;
      priceText = res.priceText;
    }
    if (!price) {
      const res = extractPrice(stripTags(block));
      price = res.price;
      priceText = res.priceText;
    }
    if (priceText && priceText.length > 30) priceText = '';

    // Address / location text
    let address = '';
    const locMatch = block.match(/<div[^>]*class="[^"]*locationText[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (locMatch) address = stripTags(locMatch[1]).replace(/\s+/g, ' ').trim();

    // Area
    const areaMatch = block.match(/([\d,]+)\s*m(?:&sup2;|²|2)/i);
    const size = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;

    const richLocation = buildRichLocation({
      title,
      description: address,
      streetAddress: address,
      addressLocality: address,
      fallbackCity: location
    });

    results.push({
      id: makeId('bytysk', adId),
      source: 'byty.sk',
      title: title || 'Nehnuteľnosť',
      address,
      location: richLocation || address || location || '',
      price,
      priceText: priceText || 'Na vyžiadanie',
      phone: null,
      url: detailUrl,
      type: type || 'byt',
      size,
      imageUrl,
      scrapedAt: new Date().toISOString()
    });
  }

  const trimmed = results.slice(0, 20);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
