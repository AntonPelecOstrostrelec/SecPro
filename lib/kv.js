const crypto = require('crypto');

// ── Redis GET ──
async function kvGet(KV_URL, KV_TOKEN, key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const d = await r.json();
  if (!d.result) return null;
  try {
    return typeof d.result === 'string' ? JSON.parse(d.result) : d.result;
  } catch (e) {
    console.error('kvGet parse error for key', key, ':', typeof d.result, String(d.result).slice(0, 200));
    throw e;
  }
}

// ── Redis SET ──
async function kvSet(KV_URL, KV_TOKEN, key, value, exSeconds) {
  const encoded = encodeURIComponent(JSON.stringify(value));
  const url = exSeconds
    ? `${KV_URL}/set/${encodeURIComponent(key)}/${encoded}/ex/${exSeconds}`
    : `${KV_URL}/set/${encodeURIComponent(key)}/${encoded}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  return r.ok;
}

// ── Redis DEL ──
async function kvDel(KV_URL, KV_TOKEN, key) {
  await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

// ── Redis KEYS (scan pattern) ──
async function kvKeys(KV_URL, KV_TOKEN, pattern) {
  const r = await fetch(`${KV_URL}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const d = await r.json();
  return d.result || [];
}

// ── Validate session token, returns session object or null ──
async function validateToken(KV_URL, KV_TOKEN, token) {
  if (!token) return null;
  const session = await kvGet(KV_URL, KV_TOKEN, `session:${token}`);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    await kvDel(KV_URL, KV_TOKEN, `session:${token}`);
    return null;
  }
  return session;
}

// ── CORS + method guard ──
function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handleCors(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return true; }
  return false;
}

// ── Extract KV credentials ──
function getKV() {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  return { KV_URL, KV_TOKEN, ok: !!(KV_URL && KV_TOKEN) };
}

module.exports = { kvGet, kvSet, kvDel, kvKeys, validateToken, corsHeaders, handleCors, getKV };
