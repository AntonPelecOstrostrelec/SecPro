// Shared ingest pipeline: takes scraper output → upserts into Supabase.
//
// Each scraper emits an array of "listing rows" with shape:
//   {
//     external_id, url, source_title, source_price, source_seller_name,
//     raw_payload,
//     derived: {
//       type, operation, price, size_m2, title, description,
//       street, city, postal_code, image_url, seller_type, seller_name
//     }
//   }

const { supabase } = require('./supabase');

async function ingestListings({ portalSlug, portalId, listings }) {
  const stats = { new_sources: 0, updated_sources: 0, errors: 0 };
  const errors = [];

  for (const item of listings) {
    try {
      // Look up existing source
      const { data: existing } = await supabase
        .from('listing_sources')
        .select('id, listing_id')
        .eq('portal_id', portalId)
        .eq('external_id', item.external_id)
        .maybeSingle();

      let listingId = existing?.listing_id;

      if (!listingId) {
        // Create stub canonical listing
        const { data: newListing, error: cErr } = await supabase
          .from('listings')
          .insert({
            type: item.derived.type,
            operation: item.derived.operation,
            price: item.derived.price,
            size_m2: item.derived.size_m2,
            size_usable_m2: item.derived.size_m2,
            title: item.derived.title,
            description_raw: item.derived.description || null,
            city: item.derived.city,
            street: item.derived.street || null,
            postal_code: item.derived.postal_code || null,
            seller_type: item.derived.seller_type || 'unknown',
            seller_name: item.derived.seller_name || null,
            phone_primary: item.derived.phone || null,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            is_active: true,
          })
          .select('id')
          .single();
        if (cErr) throw cErr;
        listingId = newListing.id;

        // Insert phone into phones table if present
        if (item.derived.phone) {
          await supabase.from('phones').upsert({
            listing_id: listingId,
            phone_e164: item.derived.phone,
            phone_display: item.derived.phone,
          }, { onConflict: 'listing_id,phone_e164' });
        }
      } else {
        // Touch last_seen_at + update fields that may have changed
        // (price, city, phone — these can drift between runs)
        const updates = {
          last_seen_at: new Date().toISOString(),
          is_active: true,
          price: item.derived.price,
        };
        if (item.derived.city) updates.city = item.derived.city;
        if (item.derived.postal_code) updates.postal_code = item.derived.postal_code;
        if (item.derived.street) updates.street = item.derived.street;
        if (item.derived.phone) updates.phone_primary = item.derived.phone;
        if (item.derived.title) updates.title = item.derived.title;
        if (item.derived.size_m2) updates.size_m2 = item.derived.size_m2;
        await supabase
          .from('listings')
          .update(updates)
          .eq('id', listingId);
      }

      // Upsert listing_sources
      const sourceRow = {
        portal_id: portalId,
        external_id: item.external_id,
        listing_id: listingId,
        url: item.url,
        source_title: item.source_title,
        source_price: item.source_price,
        source_seller_name: item.source_seller_name,
        last_seen_at: new Date().toISOString(),
        is_active: true,
        raw_payload: item.raw_payload,
      };

      if (existing) {
        await supabase.from('listing_sources').update(sourceRow).eq('id', existing.id);
        stats.updated_sources++;
      } else {
        await supabase.from('listing_sources').insert(sourceRow);
        stats.new_sources++;
      }

      // Photo (URL only — no download until lead saved)
      if (item.derived.image_url) {
        await supabase
          .from('photos')
          .upsert({
            listing_id: listingId,
            url: item.derived.image_url,
            "order": 0,
            is_cover: true,
          }, { onConflict: 'listing_id,url' });
      }
    } catch (e) {
      stats.errors++;
      errors.push({ external_id: item.external_id, msg: e.message });
    }
  }

  return { stats, errors };
}

module.exports = { ingestListings };
