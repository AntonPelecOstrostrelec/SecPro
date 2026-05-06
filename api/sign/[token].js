const { kvGet, kvSet, kvDel, handleCors, getKV, validateToken } = require('../../lib/kv');

module.exports = async (req, res) => {
  if (handleCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;

  const { KV_URL, KV_TOKEN, ok } = getKV();
  if (!ok) return res.status(500).json({ error: 'Server nie je nakonfigurovaný' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Chýba token' });

  const record = await kvGet(KV_URL, KV_TOKEN, `sign:${token}`);
  if (!record) return res.status(404).json({ error: 'Podpisová žiadosť neexistuje alebo vypršala' });

  // ── DELETE: remove sign record (used when agent re-edits a signed doc) ──
  if (req.method === 'DELETE') {
    // Auth — only the agent who created the request can delete it
    const authHeader = req.headers.authorization || '';
    const sessionToken = authHeader.replace('Bearer ', '');
    const session = await validateToken(KV_URL, KV_TOKEN, sessionToken);
    if (!session) return res.status(401).json({ error: 'Neautorizovaný prístup' });
    if (record.agentId !== session.userId) {
      return res.status(403).json({ error: 'Tento záznam vám nepatrí' });
    }

    await kvDel(KV_URL, KV_TOKEN, `sign:${token}`);

    // Remove from agent's index
    const indexKey = `sign-index:${record.agentId}`;
    const index = (await kvGet(KV_URL, KV_TOKEN, indexKey)) || [];
    const next = index.filter(e => e.token !== token);
    if (next.length !== index.length) {
      await kvSet(KV_URL, KV_TOKEN, indexKey, next);
    }
    return res.status(200).json({ ok: true });
  }

  // ── GET: return document info for the signing page ──
  if (req.method === 'GET') {
    if (record.status === 'signed') {
      return res.status(200).json({
        status: 'signed',
        signedAt: record.signedAt,
        signedByName: record.signedByName,
        documentRef: record.documentRef,
      });
    }

    if (new Date(record.expiresAt) < new Date()) {
      return res.status(200).json({ status: 'expired', documentRef: record.documentRef });
    }

    return res.status(200).json({
      status: 'pending',
      documentType: record.documentType,
      documentRef: record.documentRef,
      signerName: record.signerName,
      signerRole: record.signerRole,
      documentHtml: record.documentHtml,
      message: record.message,
      agentName: record.agentName,
      expiresAt: record.expiresAt,
    });
  }

  // ── POST: submit signature ──
  if (record.status === 'signed') {
    return res.status(400).json({ error: 'Dokument bol už podpísaný' });
  }
  if (new Date(record.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Platnosť odkazu vypršala' });
  }

  const { signatureDataUrl, signerName: submittedName } = req.body || {};
  if (!signatureDataUrl || !submittedName) {
    return res.status(400).json({ error: 'Chýba podpis alebo meno' });
  }

  // Validate signature is a data URL (basic check)
  if (!signatureDataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Neplatný formát podpisu' });
  }

  // Limit signature size (500KB max)
  if (signatureDataUrl.length > 500000) {
    return res.status(400).json({ error: 'Podpis je príliš veľký' });
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const now = new Date().toISOString();

  record.status = 'signed';
  record.signedAt = now;
  record.signatureDataUrl = signatureDataUrl;
  record.signedByName = submittedName;
  record.signedByIp = ip.split(',')[0].trim();

  // Keep for 30 days after signing for audit
  await kvSet(KV_URL, KV_TOKEN, `sign:${token}`, record, 30 * 86400);

  // Update agent's index
  const indexKey = `sign-index:${record.agentId}`;
  const index = (await kvGet(KV_URL, KV_TOKEN, indexKey)) || [];
  const entry = index.find(e => e.token === token);
  if (entry) {
    entry.status = 'signed';
    entry.signedAt = now;
    await kvSet(KV_URL, KV_TOKEN, indexKey, index);
  }

  return res.status(200).json({ ok: true, signedAt: now });
};
