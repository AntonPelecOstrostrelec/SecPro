// Worker: pull listings without AI summary, run Gemini, write back fields.
//
// Run: npm run extract:pending -- --limit 50

const { supabase } = require('../lib/supabase');
const { extractListing } = require('../extraction/extract-listing');
const { applyExtraction } = require('../extraction/apply');
const { sleep } = require('../lib/http');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : true;
      args[k] = v;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const limit = parseInt(args.limit || '50');
  const delayMs = parseInt(args.delay || '500');

  console.log(`🤖 AI extraction — limit=${limit}, delay=${delayMs}ms`);

  // Pull listings that haven't been AI-extracted yet
  const { data: pending, error } = await supabase
    .from('listings')
    .select('id, title, description_raw, type, price, size_m2, city, seller_type, city_district')
    .is('description_ai_summary', null)
    .not('title', 'is', null)
    .order('first_seen_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('Query error:', error); process.exit(1); }
  console.log(`📋 ${pending.length} listings need extraction.`);

  let ok = 0, fail = 0;
  const startBatch = Date.now();

  for (let i = 0; i < pending.length; i++) {
    const listing = pending[i];
    const t0 = Date.now();
    try {
      const result = await extractListing(listing);
      const updates = await applyExtraction(listing.id, result);
      ok++;
      const fieldsApplied = Object.keys(updates).length;
      const tag = result.city_district ? `[${result.city_district}]` : '';
      console.log(`  ✓ ${i+1}/${pending.length} ${tag} ${(listing.title||'').slice(0,50).padEnd(52)} (+${fieldsApplied} fields, ${Date.now()-t0}ms)`);
    } catch (e) {
      fail++;
      console.error(`  ✗ ${i+1}/${pending.length} ${listing.id}: ${e.message.slice(0,150)}`);
      // Backoff on rate limit
      if (e.message.includes('429') || e.message.includes('Too Many') || e.message.includes('quota')) {
        const wait = 30000;
        console.log(`  ⏸  rate-limit backoff ${wait/1000}s...`);
        await sleep(wait);
      }
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const dur = ((Date.now() - startBatch) / 1000).toFixed(1);
  console.log(`\n📊 Done in ${dur}s — ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
