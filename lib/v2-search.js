// V2 Search backend — queries Supabase Postgres.
// Used by api/leads.js when ?backend=v2 is set.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
function getClient() {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase env vars missing');
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return supabase;
}

async function searchSupabase(query) {
  const sb = getClient();
  const {
    location,
    type = 'byt',
    operation = 'predaj',
    priceMin,
    priceMax,
    sizeMin,
    sizeMax,
    rooms,
    sources,
    noAgency = '1',
    cityDistrict,
    page = '1',
    pageSize = '50',
    sortBy = 'first_seen',
  } = query;

  let q = sb
    .from('listings')
    .select(`
      id, type, subtype, operation, price, price_per_sqm, size_m2, size_usable_m2,
      rooms, bathrooms, floor, total_floors, condition, energy_class,
      construction_year, parking, balcony, terrace, loggia, cellar,
      city, city_district, street, postal_code,
      seller_type, seller_name, phone_primary,
      title, description_ai_summary,
      first_seen_at, last_seen_at, is_active,
      photos:photos(url, is_cover),
      sources:listing_sources(url, portals(slug, name))
    `, { count: 'exact' })
    .eq('is_active', true)
    .eq('type', type)
    .eq('operation', operation);

  if (location) {
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

  switch (sortBy) {
    case 'price_asc':  q = q.order('price', { ascending: true, nullsFirst: false }); break;
    case 'price_desc': q = q.order('price', { ascending: false, nullsFirst: false }); break;
    case 'size_asc':   q = q.order('size_usable_m2', { ascending: true, nullsFirst: false }); break;
    case 'first_seen':
    default:           q = q.order('first_seen_at', { ascending: false }); break;
  }

  const pg = Math.max(1, parseInt(page) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
  q = q.range((pg - 1) * ps, pg * ps - 1);

  let { data, error, count } = await q;
  if (error) throw new Error(error.message);

  if (sources) {
    const allowed = new Set(sources.split(',').map(s => s.trim()));
    data = data.filter(d => (d.sources || []).some(s => allowed.has(s.portals?.slug)));
  }

  return {
    results: data.map(reshape),
    meta: {
      total: count,
      page: pg,
      pageSize: ps,
      pages: Math.ceil(count / ps),
    },
  };
}

function reshape(row) {
  const cover = (row.photos || []).find(p => p.is_cover) || (row.photos || [])[0];
  const primary = (row.sources || [])[0];
  return {
    id: row.id,
    source: primary?.portals?.slug || 'unknown',
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
    url: primary?.url || null,
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

module.exports = { searchSupabase };
