const { kvGet, kvSet, kvDel, kvKeys, validateToken, handleCors, getKV } = require('../lib/kv');

const COLLECTIONS = [
  'properties', 'contacts', 'saved_leads', 'aml',
  'history', 'ai_settings', 'sample_ads', 'lead_statuses'
];

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  const { KV_URL, KV_TOKEN, ok } = getKV();
  if (!ok) return res.status(500).json({ error: 'Server nie je nakonfigurovaný (KV)' });

  // Authenticate
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '') || (req.body && req.body.token);
  const session = await validateToken(KV_URL, KV_TOKEN, token);
  if (!session) return res.status(401).json({ error: 'Neautorizovaný prístup.' });

  const email = session.email;
  const { action } = req.body || {};

  try {
    switch (action) {
      case 'get':     return await handleGet(req, res, KV_URL, KV_TOKEN, email);
      case 'get-all': return await handleGetAll(req, res, KV_URL, KV_TOKEN, email);
      case 'set':     return await handleSet(req, res, KV_URL, KV_TOKEN, email);
      case 'delete':  return await handleDelete(req, res, KV_URL, KV_TOKEN, email);
      case 'migrate': return await handleMigrate(req, res, KV_URL, KV_TOKEN, email);
      default:
        return res.status(400).json({ error: 'Neznáma akcia: ' + action });
    }
  } catch (err) {
    console.error('data top-level error:', action, email, err.message, err.stack);
    return res.status(500).json({ error: 'Interná chyba servera.', detail: err.message });
  }
};

// ── GET single collection ──
async function handleGet(req, res, KV_URL, KV_TOKEN, email) {
  const { collection } = req.body;
  if (!collection || !COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Neplatná kolekcia: ' + collection });
  }

  const key = `data:${email}:${collection}`;
  const data = await kvGet(KV_URL, KV_TOKEN, key);
  return res.status(200).json({ success: true, collection, data: data || null });
}

// ── GET ALL collections at once ──
async function handleGetAll(req, res, KV_URL, KV_TOKEN, email) {
  const result = {};
  const promises = COLLECTIONS.map(async (col) => {
    const key = `data:${email}:${col}`;
    result[col] = await kvGet(KV_URL, KV_TOKEN, key);
  });
  await Promise.all(promises);
  return res.status(200).json({ success: true, data: result });
}

// ── SET single collection ──
async function handleSet(req, res, KV_URL, KV_TOKEN, email) {
  const { collection, data } = req.body;
  if (!collection || !COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Neplatná kolekcia: ' + collection });
  }

  const key = `data:${email}:${collection}`;
  await kvSet(KV_URL, KV_TOKEN, key, data);
  return res.status(200).json({ success: true, collection });
}

// ── DELETE single collection ──
async function handleDelete(req, res, KV_URL, KV_TOKEN, email) {
  const { collection } = req.body;
  if (!collection || !COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Neplatná kolekcia: ' + collection });
  }

  const key = `data:${email}:${collection}`;
  await kvDel(KV_URL, KV_TOKEN, key);
  return res.status(200).json({ success: true, collection });
}

// ── MIGRATE — bulk import from localStorage ──
async function handleMigrate(req, res, KV_URL, KV_TOKEN, email) {
  const { collections } = req.body;
  if (!collections || typeof collections !== 'object') {
    return res.status(400).json({ error: 'collections object required' });
  }

  const results = [];
  for (const [col, data] of Object.entries(collections)) {
    if (!COLLECTIONS.includes(col)) {
      results.push({ collection: col, status: 'skipped', reason: 'unknown collection' });
      continue;
    }
    try {
      const key = `data:${email}:${col}`;
      // Only migrate if server doesn't already have data for this collection
      const existing = await kvGet(KV_URL, KV_TOKEN, key);
      if (existing !== null) {
        results.push({ collection: col, status: 'skipped', reason: 'already exists' });
        continue;
      }
      await kvSet(KV_URL, KV_TOKEN, key, data);
      results.push({ collection: col, status: 'ok' });
    } catch (err) {
      results.push({ collection: col, status: 'error', error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
}
