const crypto = require('crypto');
const { kvGet, kvSet, kvKeys, handleCors, getKV, validateToken } = require('../../lib/kv');

module.exports = async (req, res) => {
  if (handleCors(req, res, 'POST, OPTIONS')) return;

  const { KV_URL, KV_TOKEN, ok } = getKV();
  if (!ok) return res.status(500).json({ error: 'Server nie je nakonfigurovaný (KV)' });

  // Authenticate agent
  const authHeader = req.headers.authorization || '';
  const sessionToken = authHeader.replace('Bearer ', '');
  const session = await validateToken(KV_URL, KV_TOKEN, sessionToken);
  if (!session) return res.status(401).json({ error: 'Neautorizovaný prístup' });

  const {
    documentType,    // 'nabor', 'aml', 'zmluva', 'protokol', 'other'
    documentRef,     // human-readable reference e.g. "Náborový list – Hlavná 12"
    documentId,      // internal ID (property id, aml id, etc.)
    signerName,      // expected signer name
    signerEmail,     // optional, for display
    signerPhone,     // optional, for display
    signerRole,      // 'Predávajúci', 'Kupujúci', etc.
    documentHtml,    // HTML content to show to the signer
    expiresInHours,  // optional, default 48
    message,         // optional message for the signer
  } = req.body || {};

  if (!documentType || !documentRef || !signerName) {
    return res.status(400).json({ error: 'Chýba documentType, documentRef alebo signerName' });
  }

  // Generate a short URL-safe token (~16 chars, ~95 bits of entropy).
  // Use base64url so the link looks cleaner: /podpis/Nx7Qr2pK8vM3aBcD
  const token = crypto.randomBytes(12).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const expiresIn = Math.min((expiresInHours || 48), 168) * 3600; // max 7 days
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const record = {
    token,
    documentType,
    documentRef,
    documentId: documentId || null,
    signerName,
    signerEmail: signerEmail || null,
    signerPhone: signerPhone || null,
    signerRole: signerRole || null,
    documentHtml: documentHtml || null,
    message: message || null,
    agentId: session.userId,
    agentName: session.name || session.email,
    status: 'pending',   // pending | signed | expired
    createdAt: now,
    expiresAt,
    signedAt: null,
    signatureDataUrl: null,
    signedByName: null,
    signedByIp: null,
  };

  // Store with TTL (auto-cleanup after expiry + 30 days grace for audit)
  const ttl = expiresIn + (30 * 86400);
  await kvSet(KV_URL, KV_TOKEN, `sign:${token}`, record, ttl);

  // Add to agent's signing requests index
  const indexKey = `sign-index:${session.userId}`;
  const index = (await kvGet(KV_URL, KV_TOKEN, indexKey)) || [];
  index.unshift({ token, documentRef, signerName, documentType, status: 'pending', createdAt: now, expiresAt });
  // Keep last 200 entries
  if (index.length > 200) index.length = 200;
  await kvSet(KV_URL, KV_TOKEN, indexKey, index);

  // Build the signing URL
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'secpro-app.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const signUrl = `${protocol}://${host}/podpis/${token}`;

  return res.status(200).json({
    ok: true,
    token,
    signUrl,
    expiresAt,
  });
};
