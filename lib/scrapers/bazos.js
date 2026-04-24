const { fetchPage, extractPrice, stripTags, makeId, normalizeLocation, extractPhones } = require('./utils');
const { buildRichLocation } = require('./address-parser');
const { enrichListings } = require('./deep-enrich');

// Map type to bazos category
const TYPE_MAP = {
  'byt': 'byt',
  'dom': 'dom',
  'pozemok': 'pozemky',
  'iny': ''
};

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  const cat = TYPE_MAP[type] || 'byt';
  const offset = ((page || 1) - 1) * 20;

  // Build URL
  let url = `https://reality.bazos.sk/predam/${cat}/${offset > 0 ? offset + '/' : ''}`;
  const params = new URLSearchParams();
  if (location) params.set('hledat', location);
  if (priceMin) params.set('cession', priceMin);
  if (priceMax) params.set('cena_do', priceMax);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchPage(url);
  const results = [];

  // Split HTML into listing blocks: each listing is inside <div class="inzeraty inzeratyflex">...</div>
  // We find each block and parse its structured elements
  const blockPattern = /<div class="inzeraty inzeratyflex">([\s\S]*?)(?=<div class="inzeraty inzeratyflex">|<div id="strankovani">|<\/body>)/g;
  let blockMatch;

  while ((blockMatch = blockPattern.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extract listing URL and ID from the h2 title link
    const titleLinkMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="(\/inzerat\/(\d+)\/[^"]*)"[^>]*>([^<]+)<\/a>/);
    if (!titleLinkMatch) continue;

    const listingUrl = titleLinkMatch[1];
    const listingId = titleLinkMatch[2];
    const title = titleLinkMatch[3].trim();

    // Extract price from <div class="inzeratycena">
    const priceMatch = block.match(/<div class="inzeratycena">([\s\S]*?)<\/div>/);
    const priceBlock = priceMatch ? stripTags(priceMatch[1]).trim() : '';
    const { price, priceText } = extractPrice(priceBlock);

    // Extract location from <div class="inzeratylok">
    const locMatch = block.match(/<div class="inzeratylok">([\s\S]*?)<\/div>/);
    const locRaw = locMatch ? stripTags(locMatch[1]).trim() : '';
    // Location is "City<br>PostalCode" → after stripTags becomes "CityPostalCode", add space before postal
    const locText = locRaw.replace(/(\D)(\d{3}\s?\d{2})/, '$1 $2').replace(/\s+/g, ' ').trim();

    // Extract description for phone numbers
    const descMatch = block.match(/<div class=popis>([\s\S]*?)<\/div>/);
    const descText = descMatch ? stripTags(descMatch[1]).trim() : '';
    const phones = extractPhones(descText + ' ' + title);

    // Filter by price if specified
    if (priceMin && price && price < priceMin) continue;
    if (priceMax && price && price > priceMax) continue;

    // Filter by location if specified
    if (location && locText && !locText.toLowerCase().includes(location.toLowerCase()) &&
        !title.toLowerCase().includes(location.toLowerCase())) continue;

    // Fast-scan rich location: parse title + description for district info
    const baseLocation = normalizeLocation(locText);
    const richLocation = buildRichLocation({
      title: title,
      description: descText,
      addressLocality: baseLocation,
      fallbackCity: baseLocation || location
    });

    results.push({
      id: makeId('bazos', listingId),
      source: 'bazos.sk',
      title: title,
      address: '',
      location: richLocation || baseLocation,
      price: price,
      priceText: priceText || (price ? `${price} €` : 'Dohodou'),
      phone: phones.length > 0 ? phones[0] : null,
      url: `https://reality.bazos.sk${listingUrl}`,
      type: type || 'byt',
      size: null,
      imageUrl: `https://www.bazos.sk/img/1t/${listingId.slice(-3)}/${listingId}.jpg`,
      scrapedAt: new Date().toISOString()
    });
  }

  const trimmed = results.slice(0, 60);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
