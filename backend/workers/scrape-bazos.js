// Standalone runner: scrape bazos.sk and ingest into Supabase.
// Run: npm run scrape:bazos -- --location Bratislava --type byt --pages 5

const { supabase, getPortalId } = require('../lib/supabase');
const { scrapePage } = require('../scrapers/bazos');
const { ingestListings } = require('../lib/ingest');
const { sleep } = require('../lib/http');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const location = args.location || 'Bratislava';
  const type = args.type || 'byt';
  const operation = args.operation || 'predaj';
  const pages = parseInt(args.pages || '3');
  const priceMin = args.priceMin ? parseInt(args.priceMin) : null;
  const priceMax = args.priceMax ? parseInt(args.priceMax) : null;

  console.log(`🔎 Bazos scrape: location=${location} type=${type} op=${operation} pages=1..${pages}`);

  const portalId = await getPortalId('bazos');

  const { data: runRow, error: runErr } = await supabase
    .from('scrape_runs')
    .insert({ portal_id: portalId, status: 'running' })
    .select()
    .single();
  if (runErr) { console.error('Failed scrape_runs init:', runErr.message); process.exit(1); }
  const runId = runRow.id;

  let totalStats = { pages_fetched: 0, listings_seen: 0, new_sources: 0, updated_sources: 0, errors: 0 };
  const allErrors = [];

  try {
    for (let page = 1; page <= pages; page++) {
      console.log(`\n📄 Page ${page}/${pages}...`);
      let result;
      try {
        result = await scrapePage({ location, type, operation, priceMin, priceMax, page });
      } catch (e) {
        console.error(`  ✗ scrape error: ${e.message}`);
        totalStats.errors++;
        allErrors.push({ page, error: e.message });
        continue;
      }
      totalStats.pages_fetched++;
      totalStats.listings_seen += result.listings.length;
      console.log(`  found ${result.listings.length} listings`);
      if (result.listings.length === 0) break;

      const { stats, errors } = await ingestListings({
        portalSlug: 'bazos',
        portalId,
        listings: result.listings,
      });
      totalStats.new_sources += stats.new_sources;
      totalStats.updated_sources += stats.updated_sources;
      totalStats.errors += stats.errors;
      allErrors.push(...errors);
      console.log(`  ✓ new=${stats.new_sources} updated=${stats.updated_sources} errors=${stats.errors}`);

      if (page < pages) await sleep(1000 + Math.random() * 1500);
    }

    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: totalStats.errors > 0 && totalStats.new_sources === 0 ? 'failed' : 'succeeded',
        ...totalStats,
        error_detail: allErrors.length ? allErrors.slice(0, 50) : null,
      })
      .eq('id', runId);

    console.log('\n📊 Summary:');
    Object.entries(totalStats).forEach(([k, v]) => console.log(`   ${k.padEnd(18)} ${v}`));
    console.log('\n✅ Done.');
  } catch (e) {
    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        ...totalStats,
        error_detail: { fatal: e.message },
      })
      .eq('id', runId);
    console.error('💥 Fatal:', e);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
