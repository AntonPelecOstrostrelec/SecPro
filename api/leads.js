const bazos = require('../lib/scrapers/bazos');
const nehnutelnosti = require('../lib/scrapers/nehnutelnosti');
const topreality = require('../lib/scrapers/topreality');
const realitysk = require('../lib/scrapers/realitysk');
const bezrealitky = require('../lib/scrapers/bezrealitky');
const bezmaklerov = require('../lib/scrapers/bezmaklerov');
const bytysk = require('../lib/scrapers/bytysk');
const mojereality = require('../lib/scrapers/mojereality');
const bytsk = require('../lib/scrapers/bytsk');

const { isAgencyListing } = require('../lib/scrapers/utils');
const { matchesLocation } = require('../lib/scrapers/location-matcher');

const SCRAPERS = {
  'bazos': bazos,
  'nehnutelnosti': nehnutelnosti,
  'topreality': topreality,
  'realitysk': realitysk,
  'bezrealitky': bezrealitky,
  'bezmaklerov': bezmaklerov,
  'bytysk': bytysk,
  'mojereality': mojereality,
  'bytsk': bytsk,
};

const { handleCors } = require('../lib/kv');
const { searchSupabase } = require('../lib/v2-search');

module.exports = async function handler(req, res) {
  if (handleCors(req, res, 'GET, OPTIONS')) return;

  // ── V2 BACKEND ROUTING ──
  // If frontend opts in via ?backend=v2, query Supabase directly (no live scraping).
  // Returns same shape as live API. Falls back to live scrape on Supabase error.
  if (req.query.backend === 'v2') {
    try {
      const t0 = Date.now();
      const result = await searchSupabase(req.query);
      return res.status(200).json({
        results: result.results,
        meta: { ...result.meta, ms: Date.now() - t0, backend: 'supabase-v2' },
      });
    } catch (e) {
      console.error('v2 backend error, falling back to live scrape:', e.message);
      // continue with live scrape below
    }
  }

  const { location, priceMin, priceMax, type, sources, page, noAgency, deep, maxPages } = req.query;

  // Parse which sources to use
  let activeSources = Object.keys(SCRAPERS);
  if (sources) {
    activeSources = sources.split(',').filter(s => SCRAPERS[s]);
  }

  const deepMode = deep === '1' || deep === 'true';
  // How many pages to fetch per scraper (parallel). Default 5 → ~1000 listings max.
  // Capped at 10 to prevent abuse / long queries.
  const pagesPerScraper = Math.min(10, Math.max(1, parseInt(maxPages) || 5));

  const baseParams = {
    location: location || '',
    priceMin: priceMin ? parseInt(priceMin) : null,
    priceMax: priceMax ? parseInt(priceMax) : null,
    type: type || 'byt',
    deep: deepMode,
  };

  // Helper: fetch N pages of a scraper in parallel, dedupe by URL
  async function scrapeMultiPage(name, scraper, pagesToFetch) {
    const pagePromises = [];
    for (let p = 1; p <= pagesToFetch; p++) {
      pagePromises.push(
        scraper.scrape({ ...baseParams, page: p }).catch(() => [])
      );
    }
    const pageResults = await Promise.all(pagePromises);
    const seen = new Set();
    const merged = [];
    for (const pageListings of pageResults) {
      if (!Array.isArray(pageListings)) continue;
      for (const listing of pageListings) {
        const key = listing.url || listing.id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(listing);
      }
    }
    return merged;
  }

  // Run all scrapers (each fetching multiple pages) in parallel
  const results = await Promise.allSettled(
    activeSources.map(async (name) => {
      const start = Date.now();
      try {
        const listings = await scrapeMultiPage(name, SCRAPERS[name], pagesPerScraper);
        return {
          name,
          status: 'ok',
          count: listings.length,
          listings,
          ms: Date.now() - start,
          pages: pagesPerScraper,
        };
      } catch (err) {
        return {
          name,
          status: 'error',
          count: 0,
          listings: [],
          ms: Date.now() - start,
          error: err.message,
        };
      }
    })
  );

  // Merge results
  const allListings = [];
  const sourceMeta = {};

  for (const result of results) {
    const data = result.status === 'fulfilled' ? result.value : {
      name: 'unknown',
      status: 'error',
      count: 0,
      listings: [],
      ms: 0,
      error: result.reason?.message || 'Unknown error',
    };

    sourceMeta[data.name] = {
      status: data.status,
      count: data.count,
      ms: data.ms,
      error: data.error || null,
    };

    allListings.push(...data.listings);
  }

  // Czech cities commonly appearing on bezrealitky.sk (actually Czech portal).
  // Filter these out for Slovak users.
  const CZECH_CITY_SLUGS = [
    'praha', 'brno', 'ostrava', 'plzen', 'liberec', 'olomouc', 'budejovice',
    'hradec-kralove', 'pardubice', 'zlin', 'kladno', 'most-', 'opava', 'jihlava',
    'teplice', 'karvina', 'decin', 'chomutov', 'prerov', 'mlada-boleslav',
    'melnik', 'hlavni-mesto-praha'
  ];
  function isCzechListing(lead) {
    const u = (lead.url || '').toLowerCase();
    return CZECH_CITY_SLUGS.some(slug => u.includes('/' + slug) || u.includes('-' + slug) || u.endsWith(slug));
  }

  // Rental keywords in URL — for scrapers that leak rental listings into sale searches
  function isRentalListing(lead) {
    const u = (lead.url || '').toLowerCase();
    const t = (lead.title || '').toLowerCase();
    return /prenajom|prenájom|prenajem|najem|pren\.|rental|\bna\s+pren/.test(u + ' ' + t);
  }

  // Type mismatch — user searched X, scraper returned Y
  function isWrongType(lead, searchType) {
    if (!searchType) return false;
    const u = (lead.url || '').toLowerCase();
    const t = (lead.title || '').toLowerCase();
    const hay = u + ' ' + t;
    if (searchType === 'dom') {
      // Looking for house — reject apartments, studios, land, offices
      if (/\bbyt\b|izbov[ýy]\s+byt|[\/\-]byty?[\/\-]|[\/\-]apartman/.test(hay)) return true;
      if (/\bgarson|gars[oó]nka|studio\s+apart|1[\s\-]*izb/.test(hay)) return true;
      if (/\bpozemok\b|pozemku|stavebn[yý]\s+pozem|[\/\-]pozemk/.test(hay)) return true;
      if (/\bordin[aá]cia\b|\bkancel[aá]ri|\bobchodny\s+priest|\bkomer[cč]n/.test(hay)) return true;
    } else if (searchType === 'byt') {
      // Looking for apartment — reject obvious house/land listings
      if (/rodinny[\s-]dom|[\/\-]domy[\/\-]|[\/\-]pozemok|[\/\-]pozemky/.test(hay)) return true;
      if (/\bchata\b|\bchatky\b|\busadlos[tť]\b|\bvila\b/.test(hay)) return true;
    } else if (searchType === 'pozemok') {
      if (/\bbyt\b|[\/\-]byty?[\/\-]|rodinny[\s-]dom|gars[oó]nka/.test(hay)) return true;
    }
    return false;
  }

  // NOTE: Location matching is delegated to lib/scrapers/location-matcher.js
  // which uses a deterministic whitelist (city name + districts + postal code range)
  // — see matchesLocation() import above.

  // Filter broken/empty leads
  const validListings = allListings.filter(l => {
    if (!l.title || l.title.length < 5) return false;
    if (!l.url || !l.url.startsWith('http')) return false;
    // Strip Czech listings (bezrealitky.sk is actually bezrealitky.cz content)
    if (isCzechListing(l)) return false;
    // Strip rental listings when user searches for sale
    if (isRentalListing(l)) return false;
    // Strip listings whose type doesn't match the user's search
    if (isWrongType(l, baseParams.type)) return false;
    // POSITIVE location match — listing must clearly belong to searched city
    // (by name, district, or postal code). Unknown → reject.
    if (!matchesLocation(l, baseParams.location)) return false;
    return true;
  });

  // HARD price filter — enforce range even if scraper returned wrong results.
  // When user has set a price range, exclude listings with unknown price (can't verify).
  // Only keep price-unknowns if user did NOT set a price filter.
  const pMin = baseParams.priceMin;
  const pMax = baseParams.priceMax;
  const hasPriceFilter = (pMin !== null && pMin > 0) || (pMax !== null && pMax > 0);
  const priceFiltered = validListings.filter(l => {
    if (l.price === null || l.price === undefined || l.price === 0) {
      // If user set a price range, exclude listings without price (unverifiable)
      return !hasPriceFilter;
    }
    if (pMin !== null && l.price < pMin) return false;
    if (pMax !== null && l.price > pMax) return false;
    return true;
  });

  // Filter out agency listings if requested
  const filterAgencies = noAgency !== '0' && noAgency !== 'false'; // ON by default
  let filtered = priceFiltered;
  let agencyCount = 0;
  if (filterAgencies) {
    filtered = priceFiltered.filter(listing => {
      if (isAgencyListing(listing)) {
        agencyCount++;
        return false;
      }
      return true;
    });
  }

  // Sort by price (nulls last)
  filtered.sort((a, b) => {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

  return res.status(200).json({
    results: filtered,
    meta: {
      total: filtered.length,
      totalBeforeFilter: allListings.length,
      agencyFiltered: agencyCount,
      sources: sourceMeta,
    },
  });
};
