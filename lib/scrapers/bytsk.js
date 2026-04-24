const { fetchPage, extractPrice, stripTags, makeId } = require('./utils');
const { enrichListings } = require('./deep-enrich');
const { buildRichLocation } = require('./address-parser');

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  let url = `https://www.byt.sk/predaj/`;
  if (type === 'dom') url = `https://www.byt.sk/domy/predaj/`;
  else if (type === 'pozemok') url = `https://www.byt.sk/pozemky/predaj/`;

  const params = new URLSearchParams();
  if (location) params.set('q', location);
  if (priceMin) params.set('cena_od', priceMin);
  if (priceMax) params.set('cena_do', priceMax);
  if (page && page > 1) params.set('strana', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  let html;
  try {
    html = await fetchPage(url, 30000);
  } catch (e) {
    return [];
  }
  const results = [];

  // Try JSON-LD
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let jsonMatch;
  while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const items = data.itemListElement || [];
      for (const item of items) {
        const listing = item.item || item;
        const id = listing.url?.match(/\/(\d+)/)?.[1] || Math.random().toString(36).substr(2, 8);
        const richLoc = buildRichLocation({
          title: listing.name || '',
          description: listing.description || '',
          streetAddress: listing.address?.streetAddress || '',
          addressLocality: listing.address?.addressLocality || '',
          postalCode: listing.address?.postalCode || '',
          fallbackCity: listing.address?.addressLocality || location
        });
        results.push({
          id: makeId('bytsk', id),
          source: 'byt.sk',
          title: listing.name || '',
          address: listing.address?.streetAddress || '',
          location: richLoc || listing.address?.addressLocality || '',
          price: listing.offers?.price ? parseFloat(listing.offers.price) : null,
          priceText: listing.offers?.price ? `${Number(listing.offers.price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
          phone: null,
          url: listing.url?.startsWith('http') ? listing.url : `https://www.byt.sk${listing.url || ''}`,
          type: type || 'byt',
          size: listing.floorSize?.value ? parseFloat(listing.floorSize.value) : null,
          imageUrl: listing.image || null,
          scrapedAt: new Date().toISOString()
        });
      }
    } catch (e) {}
  }

  // HTML parsing - split by listing cards (div.item.list-group-item with data-key)
  if (results.length === 0) {
    const cardPattern = /<div[^>]*class="[^"]*list-group-item[^"]*"[^>]*data-key="(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*list-group-item[^"]*"[^>]*data-key="|<\/div>\s*<\/div>\s*<div[^>]*id="pager)/g;
    let card;
    while ((card = cardPattern.exec(html)) !== null) {
      const adId = card[1];
      const block = card[2];

      // Title + detail URL
      const titleMatch = block.match(/<h2[^>]*>\s*<a\s+href="(\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;
      const detailPath = titleMatch[1];
      const title = stripTags(titleMatch[2]).trim();
      if (title.length < 3) continue;

      // Price
      let price = null, priceText = '';
      const priceMatch = block.match(/<h4[^>]*class="[^"]*cena[^"]*"[^>]*>([\s\S]*?)<\/h4>/i)
        || block.match(/<[^>]*class="[^"]*(?:price|cena)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
      if (priceMatch) {
        const res = extractPrice(stripTags(priceMatch[1]).replace(/&euro;/g, '€'));
        price = res.price;
        priceText = res.priceText;
      }
      if (priceText && priceText.length > 30) priceText = '';

      // Image - listing photo inside <figure> anchor
      let imageUrl = null;
      const figMatch = block.match(/<figure[\s\S]*?<img[^>]*\ssrc="([^"]+)"/i);
      if (figMatch) {
        let src = figMatch[1];
        if (src.startsWith('/')) src = `https://www.byt.sk${src}`;
        imageUrl = src;
      }

      // Address from map-marker paragraph
      let address = '';
      const addrMatch = block.match(/glyphicon-map-marker[\s\S]*?<strong>([^<]+)<\/strong>/i);
      if (addrMatch) address = stripTags(addrMatch[1]).trim();

      // Size
      let size = null;
      const sizeMatch = block.match(/Plocha:\s*<strong>([\d.,]+)/i);
      if (sizeMatch) size = parseFloat(sizeMatch[1].replace(',', '.'));

      const richLoc2 = buildRichLocation({
        title,
        description: address,
        streetAddress: address,
        addressLocality: address,
        fallbackCity: location
      });

      results.push({
        id: makeId('bytsk', adId),
        source: 'byt.sk',
        title,
        address,
        location: richLoc2 || address || location || '',
        price,
        priceText: priceText || 'Na vyžiadanie',
        phone: null,
        url: `https://www.byt.sk${detailPath}`,
        type: type || 'byt',
        size,
        imageUrl,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  const trimmed = results.slice(0, 20);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
