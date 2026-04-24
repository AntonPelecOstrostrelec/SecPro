const { fetchPage, extractPrice, stripTags, makeId, extractPhones } = require('./utils');
const { enrichListings } = require('./deep-enrich');
const { buildRichLocation } = require('./address-parser');

const BASE = 'https://www.mojereality.sk';

// Map our internal type → DJ-Classifieds category id + category URL prefix for filtering
const TYPE_MAP = {
  byt:     { catId: 1,  prefix: '/byty/' },
  dom:     { catId: 7,  prefix: '/domy/' },
  pozemok: { catId: 13, prefix: '/pozemky/' },
};

// Remove Slovak diacritics for loose matching
function deburr(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseArticles(html) {
  const out = [];
  const articleRe = /<article class="item_box[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[1];

    // URL + id + title
    const urlMatch = block.match(/href="(\/nehnutelnost\/(\d+)-[^"]+)"[^>]*itemprop="url"/);
    if (!urlMatch) continue;
    const urlPath = urlMatch[1];
    const id = urlMatch[2];

    const titleMatch = block.match(/itemprop="name"><a [^>]*>([^<]+)<\/a>/);
    const title = titleMatch ? stripTags(titleMatch[1]).trim() : '';

    // Image
    let imageUrl = null;
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*itemprop="image"/);
    if (imgMatch) {
      imageUrl = imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + imgMatch[1];
    }

    // Price — prefer visible price_val span (the meta itemprop="price" is often truncated)
    let price = null;
    let priceText = '';
    const priceValMatch = block.match(/<span class=['"]price_val['"]>([^<]+)<\/span>\s*<span class=['"]price_unit['"]>([^<]*)<\/span>/);
    if (priceValMatch) {
      const numStr = priceValMatch[1].replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        price = num;
        priceText = `${Math.round(num).toLocaleString('sk-SK')} €`;
      }
    }
    if (!price) {
      // fallback: strip tags and run extractPrice on the price block
      const priceBlockMatch = block.match(/<div class="price"[^>]*>([\s\S]*?)<\/div>/);
      if (priceBlockMatch) {
        const r = extractPrice(stripTags(priceBlockMatch[1]));
        if (r.price) { price = r.price; priceText = r.priceText; }
      }
    }

    // Location (areaServed)
    let locText = '';
    const locMatch = block.match(/<div class="loc_under_img"[^>]*>([\s\S]*?)<\/div>/);
    if (locMatch) {
      locText = stripTags(locMatch[1]).replace(/\s+/g, ' ').trim();
      // Usually "Slovensko - City" — strip leading "Slovensko - "
      locText = locText.replace(/^Slovensko\s*-\s*/i, '').trim();
    }

    // Category (for filtering by type)
    let categoryHref = '';
    const catMatch = block.match(/<div class="cat_on_img"[^>]*>\s*<a href="([^"]+)"/);
    if (catMatch) categoryHref = catMatch[1];

    // Type badge: bt_forsale = predaj, bt_forrent (or other) = prenájom
    const isForSale = /bt_forsale/.test(block);

    out.push({
      id, urlPath, title, imageUrl, price, priceText,
      locText, categoryHref, isForSale,
    });
  }
  return out;
}

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  const typeInfo = TYPE_MAP[type] || TYPE_MAP.byt;

  // The search only works reliably when we combine all filters server-side and then
  // also filter the results client-side (site's `se=` search is loose — it returns
  // everything and mixes rentals with sales).
  const params = new URLSearchParams();
  params.set('se_cats[]', String(typeInfo.catId));
  params.set('se_type_id', '1'); // 1 = Na predaj
  if (location) params.set('se', location);
  if (priceMin) params.set('se_price_from', String(priceMin));
  if (priceMax) params.set('se_price_to', String(priceMax));
  if (page && page > 1) params.set('limitstart', String((page - 1) * 60));

  const url = `${BASE}/component/djclassifieds/nehnutelnosti?${params.toString()}`;

  let html;
  try {
    html = await fetchPage(url, 15000);
  } catch (e) {
    return [];
  }

  const items = parseArticles(html);
  const locNorm = deburr(location || '');
  const results = [];

  for (const it of items) {
    // Only "Na predaj" (sale) — drop rentals / demand posts
    if (!it.isForSale) continue;

    // Type filter: category href should start with our prefix (/byty/, /domy/, /pozemky/)
    if (it.categoryHref && !it.categoryHref.startsWith(typeInfo.prefix)) continue;

    // Location filter: require the user's location substring to appear in title or locText
    if (locNorm) {
      const hay = deburr(`${it.title} ${it.locText}`);
      if (!hay.includes(locNorm)) continue;
    }

    // Price filter client-side (server params may be ignored)
    if (priceMin && it.price != null && it.price < priceMin) continue;
    if (priceMax && it.price != null && it.price > priceMax) continue;

    const richLocation = buildRichLocation({
      title: it.title,
      description: it.locText,
      fallbackCity: it.locText || location || ''
    });

    results.push({
      id: makeId('mojereality', it.id),
      source: 'mojereality.sk',
      title: it.title,
      address: '',
      location: richLocation || it.locText || location || '',
      price: it.price,
      priceText: it.priceText || 'Na vyžiadanie',
      phone: null,
      url: `${BASE}${it.urlPath}`,
      type: type || 'byt',
      size: null,
      imageUrl: it.imageUrl,
      scrapedAt: new Date().toISOString(),
    });
  }

  const trimmed = results.slice(0, 60);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
