const { fetchPage, extractPrice, stripTags, makeId, extractPhones } = require('./utils');

async function scrape({ location, priceMin, priceMax, type, page }) {
  // bezmaklerov.sk - try to find API or parse HTML
  let url = `https://www.bezmaklerov.sk/nehnutelnosti/predaj`;

  const params = new URLSearchParams();
  if (type === 'byt') params.set('type', 'byt');
  else if (type === 'dom') params.set('type', 'dom');
  else if (type === 'pozemok') params.set('type', 'pozemok');
  if (location) params.set('location', location);
  if (priceMin) params.set('priceFrom', priceMin);
  if (priceMax) params.set('priceTo', priceMax);
  if (page && page > 1) params.set('page', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchPage(url);
  const results = [];

  // Try __NEXT_DATA__ first (React/Next.js app)
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const listings = data?.props?.pageProps?.listings || data?.props?.pageProps?.adverts || [];
      for (const item of listings) {
        const id = item.id || Math.random().toString(36).substr(2, 8);
        results.push({
          id: makeId('bezmaklerov', id),
          source: 'bezmaklerov.sk',
          title: item.title || item.name || '',
          address: item.address || '',
          location: item.city || item.location || '',
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

  // Fallback: parse HTML links
  if (results.length === 0) {
    const linkPattern = /href="(\/(?:nehnutelnost|detail|inzerat)\/[^"]+)"[^>]*>\s*([^<]+)/g;
    let m;
    while ((m = linkPattern.exec(html)) !== null) {
      const title = stripTags(m[2]).trim();
      if (title.length > 3) {
        const block = html.substring(Math.max(0, m.index - 100), m.index + 500);
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
        const id = m[1].match(/\/(\d+)/)?.[1] || Math.random().toString(36).substr(2, 8);

        // Extract image from HTML block
        const imgMatch = block.match(/(?:src|data-src)=["'](https?:\/\/[^"']*?\.(?:jpg|jpeg|png|webp)[^"']*?)["']/i);
        const imageUrl = imgMatch ? imgMatch[1] : null;

        results.push({
          id: makeId('bezmaklerov', id),
          source: 'bezmaklerov.sk',
          title: title,
          address: '',
          location: '',
          price: price,
          priceText: priceText || 'Na vyžiadanie',
          phone: null,
          url: `https://www.bezmaklerov.sk${m[1]}`,
          type: type || 'byt',
          size: null,
          imageUrl: imageUrl,
          scrapedAt: new Date().toISOString()
        });
      }
    }
  }

  return results.slice(0, 20);
}

module.exports = { scrape };
