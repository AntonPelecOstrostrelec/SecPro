const { fetchPage, extractPrice, stripTags, makeId, extractPhones } = require('./utils');
const { enrichListings } = require('./deep-enrich');
const { buildRichLocation } = require('./address-parser');

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  // bezmaklerov.sk - canonical path is /sk/nehnutelnosti/predaj (bare path 308-redirects).
  // Pagination uses ?strana=N (Slovak "page"); ?page=N is IGNORED and returns page 1.
  let url = `https://www.bezmaklerov.sk/sk/nehnutelnosti/predaj`;

  const params = new URLSearchParams();
  if (type === 'byt') params.set('type', 'byt');
  else if (type === 'dom') params.set('type', 'dom');
  else if (type === 'pozemok') params.set('type', 'pozemok');
  if (location) params.set('location', location);
  if (priceMin) params.set('priceFrom', priceMin);
  if (priceMax) params.set('priceTo', priceMax);
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

  // Try __NEXT_DATA__ first (React/Next.js app)
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const listings = data?.props?.pageProps?.listings || data?.props?.pageProps?.adverts || [];
      for (const item of listings) {
        const id = item.id || Math.random().toString(36).substr(2, 8);
        const baseCity = item.city || item.location || '';
        const richLoc = buildRichLocation({
          title: item.title || item.name || '',
          description: item.description || '',
          streetAddress: item.address || '',
          addressLocality: baseCity,
          fallbackCity: baseCity || location
        });
        results.push({
          id: makeId('bezmaklerov', id),
          source: 'bezmaklerov.sk',
          title: item.title || item.name || '',
          address: item.address || '',
          location: richLoc || baseCity,
          price: item.price ? parseFloat(item.price) : null,
          priceText: item.price ? `${Number(item.price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
          phone: item.phone || null,
          url: item.url || `https://www.bezmaklerov.sk/detail/${id}`,
          type: type || 'byt',
          size: item.area ? parseFloat(item.area) : null,
          imageUrl: item.image || item.mainImage || null,
          scrapedAt: new Date().toISOString()
        });
      }
    } catch (e) {}
  }

  // HTML parsing: listing cards are <a href="/sk/inzerat/ID">...</a> with img + h4 + price span
  if (results.length === 0) {
    const cardPattern = /<a[^>]*href="(\/sk\/inzerat\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let card;
    const seen = new Set();
    while ((card = cardPattern.exec(html)) !== null) {
      const href = card[1];
      if (seen.has(href)) continue;
      const block = card[2];

      // Must have h4 title to qualify as a listing card (skip minimal links)
      const titleMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
      if (!titleMatch) continue;
      seen.add(href);
      const title = stripTags(titleMatch[1]).trim();
      if (title.length < 3) continue;

      const id = href.split('/').pop();

      // Image: prefer src, fall back to first srcSet URL
      let imageUrl = null;
      const srcMatch = block.match(/<img[^>]*\ssrc="([^"]+)"/i);
      if (srcMatch) imageUrl = srcMatch[1];
      if (!imageUrl) {
        const srcsetMatch = block.match(/srcSet="([^"]+)"/i);
        if (srcsetMatch) {
          imageUrl = srcsetMatch[1].split(',')[0].trim().split(/\s+/)[0];
        }
      }

      // Price - span with € sign
      let price = null, priceText = '';
      const priceMatch = block.match(/<span[^>]*>([^<]*€[^<]*)<\/span>/i);
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

      const richLoc2 = buildRichLocation({
        title,
        description: stripTags(block),
        fallbackCity: location
      });

      results.push({
        id: makeId('bezmaklerov', id),
        source: 'bezmaklerov.sk',
        title,
        address: '',
        location: richLoc2 || location || '',
        price,
        priceText: priceText || 'Na vyžiadanie',
        phone: null,
        url: `https://www.bezmaklerov.sk${href}`,
        type: type || 'byt',
        size: null,
        imageUrl,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  const trimmed = results.slice(0, 60);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
