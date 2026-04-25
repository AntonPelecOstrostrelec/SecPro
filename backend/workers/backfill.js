// Backfill orchestrator — runs scrapers for many city/type combinations.
//
// Run: node workers/backfill.js
// Tweak the matrix below for narrower/wider sweeps.

const { supabase, getPortalId } = require('../lib/supabase');
const { ingestListings } = require('../lib/ingest');
const { sleep } = require('../lib/http');

const bazosScraper = require('../scrapers/bazos');
const nehnutelnostiScraper = require('../scrapers/nehnutelnosti');

const CITIES = ['Bratislava', 'Košice', 'Trenčín', 'Žilina', 'Nitra', 'Trnava', 'Banská Bystrica', 'Prešov'];
const TYPES = ['byt', 'dom', 'pozemok'];
const PAGES_PER_RUN = 5;

// Matrix: [portal_slug, scraperFn]
const PORTALS = [
  { slug: 'bazos',          scraper: bazosScraper },
  { slug: 'nehnutelnosti',  scraper: nehnutelnostiScraper },
];

async function runOne(portalSlug, scraper, params) {
  const portalId = await getPortalId(portalSlug);

  const { data: runRow } = await supabase
    .from('scrape_runs')
    .insert({ portal_id: portalId, status: 'running' })
    .select()
    .single();
  const runId = runRow.id;

  let stats = { pages_fetched: 0, listings_seen: 0, new_sources: 0, updated_sources: 0, errors: 0 };
  const errors = [];

  for (let page = 1; page <= PAGES_PER_RUN; page++) {
    let result;
    try {
      result = await scraper.scrapePage({ ...params, page });
    } catch (e) {
      stats.errors++;
      errors.push({ page, error: e.message });
      continue;
    }
    stats.pages_fetched++;
    stats.listings_seen += result.listings.length;
    if (result.listings.length === 0) break; // stop early on empty page

    const ing = await ingestListings({ portalSlug, portalId, listings: result.listings });
    stats.new_sources += ing.stats.new_sources;
    stats.updated_sources += ing.stats.updated_sources;
    stats.errors += ing.stats.errors;
    errors.push(...ing.errors);

    if (page < PAGES_PER_RUN) await sleep(800 + Math.random() * 1200);
  }

  await supabase.from('scrape_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: stats.errors > 0 && stats.new_sources === 0 ? 'failed' : 'succeeded',
      ...stats,
      error_detail: errors.length ? errors.slice(0, 30) : null,
    })
    .eq('id', runId);

  return stats;
}

async function main() {
  const grandStart = Date.now();
  let total = { runs: 0, listings_seen: 0, new_sources: 0, updated_sources: 0, errors: 0 };
  const matrix = [];

  for (const city of CITIES) {
    for (const type of TYPES) {
      for (const portal of PORTALS) {
        matrix.push({ city, type, portal });
      }
    }
  }

  console.log(`🔄 Backfill: ${matrix.length} jobs (${CITIES.length} cities × ${TYPES.length} types × ${PORTALS.length} portals × ${PAGES_PER_RUN} pages each)`);
  console.log(`   Cities: ${CITIES.join(', ')}\n`);

  for (let i = 0; i < matrix.length; i++) {
    const { city, type, portal } = matrix[i];
    const t0 = Date.now();
    process.stdout.write(`[${i+1}/${matrix.length}] ${portal.slug.padEnd(15)} ${city.padEnd(18)} ${type.padEnd(8)} ... `);
    try {
      const s = await runOne(portal.slug, portal.scraper, { location: city, type });
      total.runs++;
      total.listings_seen += s.listings_seen;
      total.new_sources += s.new_sources;
      total.updated_sources += s.updated_sources;
      total.errors += s.errors;
      console.log(`new=${s.new_sources} upd=${s.updated_sources} err=${s.errors} (${Date.now()-t0}ms)`);
    } catch (e) {
      total.errors++;
      console.log(`💥 ${e.message.slice(0, 80)}`);
    }
    // Polite delay between portals
    await sleep(500);
  }

  console.log(`\n📊 BACKFILL DONE in ${((Date.now()-grandStart)/1000).toFixed(0)}s:`);
  Object.entries(total).forEach(([k, v]) => console.log(`   ${k.padEnd(18)} ${v}`));
}

main().catch(e => { console.error(e); process.exit(1); });
