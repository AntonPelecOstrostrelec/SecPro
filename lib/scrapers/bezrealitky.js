const { fetchPage, makeId, extractPhones } = require('./utils');
const { buildRichLocation } = require('./address-parser');
const { enrichListings } = require('./deep-enrich');

const TYPE_MAP = {
  'byt': 'byt',
  'dom': 'dum',
  'pozemok': 'pozemek',
  'iny': ''
};

async function scrape({ location, priceMin, priceMax, type, page, deep }) {
  // bezrealitky.sk uses __NEXT_DATA__ with Apollo cache
  let url = `https://www.bezrealitky.sk/vypis/ponuka-predaj`;

  const params = new URLSearchParams();
  const cat = TYPE_MAP[type] || 'byt';
  if (cat) params.set('category', cat);
  if (location) params.set('location', location);
  if (priceMin) params.set('priceFrom', priceMin);
  if (priceMax) params.set('priceTo', priceMax);
  if (page && page > 1) params.set('page', page);
  const qs = params.toString();
  if (qs) url += '?' + qs;

  const html = await fetchPage(url);
  const results = [];

  // Try to extract __NEXT_DATA__
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);

      // Navigate Apollo cache for listings
      const cache = nextData?.props?.pageProps?.apolloCache || nextData?.props?.pageProps || {};

      // Find listings in ROOT_QUERY
      const rootQuery = cache['ROOT_QUERY'] || {};
      let adverts = [];

      // Look for listAdverts key
      for (const key of Object.keys(rootQuery)) {
        if (key.startsWith('listAdverts')) {
          const data = rootQuery[key];
          if (data?.list) {
            adverts = data.list;
          }
        }
      }

      // Also check direct props
      if (adverts.length === 0 && nextData?.props?.pageProps?.adverts) {
        adverts = nextData.props.pageProps.adverts;
      }

      for (const advert of adverts) {
        // Resolve from Apollo cache if it's a reference
        let listing = advert;
        if (advert?.__ref) {
          listing = cache[advert.__ref] || advert;
        }

        const id = listing.id || listing.uri || Math.random().toString(36).substr(2, 8);
        const uri = listing.uri || '';
        const name = listing.title || listing.name || '';
        const price = listing.price || listing.priceCzk || null;
        const surface = listing.surface || listing.area || null;
        const gps = listing.gps || {};
        const address = listing.address || listing.location || '';
        const image = listing.mainImage?.url || listing.imageUrl || null;

        const baseLocation = typeof address === 'string' ? address : (address?.city || '');
        const richLocation = buildRichLocation({
          title: name,
          description: listing.description || '',
          addressLocality: baseLocation,
          fallbackCity: baseLocation || location
        });

        results.push({
          id: makeId('bezrealitky', id),
          source: 'bezrealitky.sk',
          title: name || `Nehnuteľnosť ${uri}`,
          address: typeof address === 'string' ? address : '',
          location: richLocation || baseLocation,
          price: price ? parseFloat(price) : null,
          priceText: price ? `${Number(price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
          phone: null,
          url: `https://www.bezrealitky.sk/nehnutelnosti/${uri}`,
          type: type || 'byt',
          size: surface ? parseFloat(surface) : null,
          imageUrl: image,
          scrapedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      // Failed to parse __NEXT_DATA__
    }
  }

  const trimmed = results.slice(0, 20);
  if (deep && trimmed.length > 0) await enrichListings(trimmed, 8);
  return trimmed;
}

module.exports = { scrape };
