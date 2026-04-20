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

module.exports = async function handler(req, res) {
  if (handleCors(req, res, 'GET, OPTIONS')) return;

  const { location, priceMin, priceMax, type, sources, page, noAgency } = req.query;

  // Parse which sources to use
  let activeSources = Object.keys(SCRAPERS);
  if (sources) {
    activeSources = sources.split(',').filter(s => SCRAPERS[s]);
  }

  const params = {
    location: location || '',
    priceMin: priceMin ? parseInt(priceMin) : null,
    priceMax: priceMax ? parseInt(priceMax) : null,
    type: type || 'byt',
    page: page ? parseInt(page) : 1,
  };

  // Run all scrapers in parallel with timeout
  const results = await Promise.allSettled(
    activeSources.map(async (name) => {
      const start = Date.now();
      try {
        const listings = await SCRAPERS[name].scrape(params);
        return {
          name,
          status: 'ok',
          count: listings.length,
          listings,
          ms: Date.now() - start,
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

  // Filter broken/empty leads
  const validListings = allListings.filter(l => {
    if (!l.title || l.title.length < 5) return false;
    if (!l.url || !l.url.startsWith('http')) return false;
    return true;
  });

  // Filter out agency listings if requested
  const filterAgencies = noAgency !== '0' && noAgency !== 'false'; // ON by default
  let filtered = validListings;
  let agencyCount = 0;
  if (filterAgencies) {
    filtered = validListings.filter(listing => {
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
