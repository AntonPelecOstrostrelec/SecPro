// Apply Gemini extraction result to a listing row in Supabase.
// Idempotent — safe to re-run on the same listing.

const { supabase } = require('../lib/supabase');

/**
 * Take extraction JSON from Gemini and update `listings` row.
 * Only writes non-null fields (preserves existing data).
 */
async function applyExtraction(listingId, extracted) {
  const updates = {};

  // String fields
  for (const k of ['city_district','street','street_number','subtype','condition','energy_class','orientation','parking','heating','description_ai_summary']) {
    if (extracted[k] != null && extracted[k] !== '') updates[k] = extracted[k];
  }

  // Integer fields
  for (const k of ['rooms','bathrooms','floor','total_floors','construction_year','year_last_renovation']) {
    if (extracted[k] != null && Number.isFinite(extracted[k])) updates[k] = extracted[k];
  }

  // Boolean fields
  for (const k of ['balcony','terrace','loggia','cellar','elevator','furnished']) {
    if (extracted[k] != null) updates[k] = extracted[k];
  }

  // Seller type inference: only OVERRIDE if AI is confident AND current is 'unknown' or 'private'
  // (don't downgrade an explicit RK signal from offeredBy.@type to 'private' just because text is friendly)
  if (extracted.seller_type_inferred && extracted.seller_type_inferred !== 'unknown') {
    // Get current seller_type to decide whether to override
    const { data: cur } = await supabase
      .from('listings').select('seller_type').eq('id', listingId).single();
    if (!cur) return updates;
    if (cur.seller_type === 'unknown' || cur.seller_type === 'private') {
      // Trust AI to upgrade unknown → agency or private
      updates.seller_type = extracted.seller_type_inferred;
    }
    // If currently agency (from offeredBy.@type), keep it (structured data wins)
  }

  if (Object.keys(updates).length === 0) return updates;

  const { error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', listingId);
  if (error) throw error;

  return updates;
}

module.exports = { applyExtraction };
