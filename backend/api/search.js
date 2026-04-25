// Search API — query Supabase for listings matching broker filters.
//
// Compatible with the existing SecPro frontend response shape so we can
// flip a feature flag without touching frontend logic.
//
// Endpoint: GET /api/v2/leads?location=...&type=...&priceMin=...&priceMax=...
//                     &sources=bazos,nehnutelnosti&noAgency=1
//                     &page=1&pageSize=50

const { supabase } = require('../lib/supabase');

/**
 * Parse query params and run Supabase query.
 */
async function searchListings(query) {
  const {
    location,
    type = 'byt',
    operation = 'predaj',
    priceMin,
    priceMax,
    sizeMin,
    sizeMax,
    rooms,
    sources,           // comma-separated portal slugs
    noAgency = '1',    // default: only private
    cityDistrict,      // optional: filter by district (e.g. "Petržalka")
    page = '1',
    pageSize = '50',
    sortBy = 'first_seen',  // first_seen | price_asc | price_desc | size_asc
  } = query;

  let q = supabase
    .from('listings')
    .select(`
      id, type, subtype, operation, price, price_per_sqm, size_m2, size_usable_m2,
      rooms, bathrooms, floor, total_floors, condition, energy_class,
      construction_year, parking, balcony, terrace, loggia, cellar,
      city, city_district, street, postal_code,
      seller_type, seller_name, phone_primary, has_verified_phone,
      title, description_ai_summary,
      first_seen_at, last_seen_at, is_active,
      photos:photos(url, is_cover),
      sources:listing_sources(url, portals(slug, name))
    `, { count: 'exact' })
    .eq('is_active', true)
    .eq('type', type)
    .eq('operation', operation);

  if (location) {
    // Match city OR city_district (e.g. user types "Bratislava" → match all BA listings)
    const loc = location.trim();
    q = q.or(`city.ilike.%${loc}%,city_district.ilike.%${loc}%`);
  }

  if (priceMin) q = q.gte('price', parseInt(priceMin));
  if (priceMax) q = q.lte('price', parseInt(priceMax));
  if (sizeMin)  q = q.gte('size_usable_m2', parseFloat(sizeMin));
  if (sizeMax)  q = q.lte('size_usable_m2', parseFloat(sizeMax));
  if (rooms)    q = q.eq('rooms', parseInt(rooms));
  if (cityDistrict) q = q.ilike('city_district', cityDistrict);

  if (noAgency === '1' || noAgency === 'true') {
    q = q.in('seller_type', ['private', 'unknown']);
  }

  // Sort
  switch (sortBy) {
    case 'price_asc':  q = q.order('price', { ascending: true, nullsFirst: false }); break;
    case 'price_desc': q = q.order('price', { ascending: false, nullsFirst: false }); break;
    case 'size_asc':   q = q.order('size_usable_m2', { ascending: true, nullsFirst: false }); break;
    case 'first_seen':
    default:           q = q.order('first_seen_at', { ascending: false }); break;
  }

  // Pagination
  const pg = Math.max(1, parseInt(page) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
  const from = (pg - 1) * ps;
  const to = from + ps - 1;
  q = q.range(from, to);

  // If sources filter present, we need to apply it to listing_sources nested filter.
  // Supabase doesn't filter parent by nested join easily, so we do post-filter for now.
  let { data, error, count } = await q;
  if (error) throw new Error(error.message);

  if (sources) {
    const allowed = new Set(sources.split(',').map(s => s.trim()));
    data = data.filter(d => (d.sources || []).some(s => allowed.has(s.portals?.slug)));
  }

  // Reshape for frontend compatibility (mirrors current /api/leads result shape)
  const results = data.map(reshapeForFrontend);

  return {
    results,
    meta: {
      total: count,
      page: pg,
      pageSize: ps,
      pages: Math.ceil(count / ps),
      filtered_count: results.length,
    },
  };
}

function reshapeForFrontend(row) {
  const cover = (row.photos || []).find(p => p.is_cover) || (row.photos || [])[0];
  const primarySource = (row.sources || [])[0];
  return {
    id: row.id,
    source: primarySource?.portals?.slug || 'unknown',
    title: row.title,
    location: [row.street, row.city_district, row.city, row.postal_code]
      .filter(Boolean).join(', '),
    address: row.street || '',
    city: row.city,
    city_district: row.city_district,
    price: row.price ? parseFloat(row.price) : null,
    priceText: row.price ? `${Math.round(row.price).toLocaleString('sk-SK')} €` : 'Na vyžiadanie',
    size: row.size_usable_m2 || row.size_m2,
    rooms: row.rooms,
    type: row.type,
    seller_type: row.seller_type,
    seller_name: row.seller_name,
    phone: row.phone_primary,
    url: primarySource?.url || null,
    imageUrl: cover?.url || null,
    description: row.description_ai_summary,
    condition: row.condition,
    energy_class: row.energy_class,
    construction_year: row.construction_year,
    parking: row.parking,
    balcony: row.balcony,
    terrace: row.terrace,
    loggia: row.loggia,
    cellar: row.cellar,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    other_sources: (row.sources || []).slice(1).map(s => ({
      portal: s.portals?.slug,
      url: s.url,
    })),
  };
}

module.exports = { searchListings };
