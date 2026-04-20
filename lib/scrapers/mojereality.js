const { fetchPage, extractPrice, stripTags, makeId, extractPhones } = require('./utils');
const { enrichListings } = require('./deep-enrich');

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  const typeMap = { 'byt': 'byty', 'dom': 'domy', 'pozemok': 'pozemky' };
  const cat = typeMap[type] || 'byty';

  let url = `https://www.mojereality.sk/${cat}/predaj/`;

  const params = new URLSearchParams();
  if (location) params.set('q', location);
  if (priceMin) params.set('cena_od', priceMin);
  if (priceMax) params.set('cena_do', priceMax);
  if (page && page > 1) params.set('strana', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchPage(url);
  const results = [];

  // Try JSON-LD first
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let jsonMatch;
  while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const items = data.itemListElement || [];
      for (const item of items) {
        const listing = item.item || item;
        const id = listing.url?.match(/\/(\d+)/)?.[1] || Math.random().toString(36).substr(2, 8);
        results.push({
          id: makeId('mojereality', id),
          source: 'mojereality.sk',
          title: listing.name || '',
          address: listing.address?.streetAddress || '',
          location: listing.address?.addressLocality || listing.name || '',
          price: listing.offers?.price ? parseFloat(listing.offers.price) : null,
          priceText: listing.offers?.price ? `${Number(listing.offers.price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
          phone: null,
          url: listing.url?.startsWith('http') ? listing.url : `https://www.mojereality.sk${listing.url || ''}`,
          type: type || 'byt',
          size: listing.floorSize?.value ? parseFloat(listing.floorSize.value) : null,
          imageUrl: listing.image || null,
          scrapedAt: new Date().toISOString()
        });
      }
    } catch (e) {}
  }

  // Fallback: parse HTML
  if (results.length === 0) {
    const linkPattern = /href="(\/(?:detail|nehnutelnost)\/[^"]+)"[^>]*>\s*([^<]+)/g;
    let m;
    while ((m = linkPattern.exec(html)) !== null) {
      const title = stripTags(m[2]).trim();
      if (title.length > 5) {
        const block = html.substring(m.index, m.index + 500);
        // Try targeted HTML element first (class containing price/cena)
        let price = null;
        let priceText = '';
        const priceElMatch = block.match(/<[^>]*class="[^"]*(?:price|cena)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
        if (priceElMatch) {
          const res = extractPrice(stripTags(priceElMatch[1]));
          price = res.price;
          priceText = res.priceText;
        }
        if (!price) {
          const res = extractPrice(stripTags(block));
          price = res.price;
          priceText = res.priceText;
        }
        // Sanity: priceText should be short (just the price), not a huge text block
        if (priceText && priceText.length > 30) priceText = '';
        const id = m[1].match(/(\d+)/)?.[1] || Math.random().toString(36).substr(2, 8);

        // Extract image from HTML block
        const imgMatch = block.match(/(?:src|data-src)=["'](https?:\/\/[^"']*?\.(?:jpg|jpeg|png|webp)[^"']*?)["']/i);
        const imageUrl = imgMatch ? imgMatch[1] : null;

        results.push({
          id: makeId('mojereality', id),
          source: 'mojereality.sk',
          title: title,
          address: '',
          location: '',
          price: price,
          priceText: priceText || 'Na vyžiadanie',
          phone: null,
          url: `https://www.mojereality.sk${m[1]}`,
          type: type || 'byt',
          size: null,
          imageUrl: imageUrl,
          scrapedAt: new Date().toISOString()
        });
      }
    }
  }

  const trimmed = results.slice(0, 20);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
