const { fetchPage, extractPrice, stripTags, makeId, extractPhones } = require('./utils');

async function scrape({ location, priceMin, priceMax, type, page }) {
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

  const html = await fetchPage(url);
  const results = [];

  // Parse listing cards - look for links to detail pages
  const listingPattern = /href="(https?:\/\/www\.byty\.sk\/[^"]*\/\d+[^"]*)"[^>]*>\s*([^<]*)/g;
  let m;
  const seen = new Set();

  while ((m = listingPattern.exec(html)) !== null) {
    const detailUrl = m[1];
    const title = stripTags(m[2]).trim();

    // Skip duplicates and non-listing links
    if (seen.has(detailUrl) || title.length < 3) continue;
    seen.add(detailUrl);

    // Get surrounding context
    const block = html.substring(Math.max(0, m.index - 200), m.index + 600);
    const textBlock = stripTags(block);
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
      const res = extractPrice(textBlock);
      price = res.price;
      priceText = res.priceText;
    }
    // Sanity: priceText should be short (just the price), not a huge text block
    if (priceText && priceText.length > 30) priceText = '';

    // Extract area
    const areaMatch = textBlock.match(/([\d,]+)\s*m[²2]/);
    const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;

    const idMatch = detailUrl.match(/\/(\d+)/);
    const id = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 8);

    // Image
    const imgIdx = block.indexOf(detailUrl);
    const imgBlock = html.substring(Math.max(0, m.index - 500), m.index + 100);
    const imgMatch = imgBlock.match(/src="(https?:\/\/[^"]*(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);

    results.push({
      id: makeId('bytysk', id),
      source: 'byty.sk',
      title: title || 'Nehnuteľnosť',
      address: '',
      location: title,
      price: price,
      priceText: priceText || 'Na vyžiadanie',
      phone: null,
      url: detailUrl,
      type: type || 'byt',
      size: area,
      imageUrl: imgMatch ? imgMatch[1] : null,
      scrapedAt: new Date().toISOString()
    });
  }

  return results.slice(0, 20);
}

module.exports = { scrape };
