const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Server nie je nakonfigurovaný (KV)' });
  }

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'register': return await handleRegister(req, res, KV_URL, KV_TOKEN);
      case 'login':    return await handleLogin(req, res, KV_URL, KV_TOKEN);
      case 'session':  return await handleSession(req, res, KV_URL, KV_TOKEN);
      case 'logout':   return await handleLogout(req, res, KV_URL, KV_TOKEN);
      case 'seed':     return await handleSeed(req, res, KV_URL, KV_TOKEN);
      default:
        return res.status(400).json({ error: 'Neznáma akcia: ' + action });
    }
  } catch (err) {
    console.error('auth top-level error:', action, err.message, err.stack);
    return res.status(500).json({ error: 'Interná chyba servera.', detail: err.message });
  }
};

// ── Helper: Redis GET ──
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

// ── Helper: Redis SET ──
async function kvSet(KV_URL, KV_TOKEN, key, value, exSeconds) {
  const encoded = encodeURIComponent(JSON.stringify(value));
  const url = exSeconds
    ? `${KV_URL}/set/${encodeURIComponent(key)}/${encoded}/ex/${exSeconds}`
    : `${KV_URL}/set/${encodeURIComponent(key)}/${encoded}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  return r.ok;
}

// ── Helper: Redis DEL ──
async function kvDel(KV_URL, KV_TOKEN, key) {
  await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

// ── REGISTER ──
async function handleRegister(req, res, KV_URL, KV_TOKEN) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Meno, email a heslo sú povinné.' });
  }

  const emailLower = email.trim().toLowerCase();
  const userKey = `user:${emailLower}`;

  try {
    const existing = await kvGet(KV_URL, KV_TOKEN, userKey);
    if (existing) {
      return res.status(409).json({ error: 'Účet s týmto e-mailom už existuje.' });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    await kvSet(KV_URL, KV_TOKEN, userKey, {
      name: name.trim(),
      email: emailLower,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: 'Účet vytvorený.' });
  } catch (err) {
    console.error('auth register error:', err.message);
    return res.status(500).json({ error: 'Chyba servera pri registrácii.' });
  }
}

// ── LOGIN ──
async function handleLogin(req, res, KV_URL, KV_TOKEN) {
  const { email, password, remember } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email a heslo sú povinné.' });
  }

  const emailLower = email.trim().toLowerCase();
  const userKey = `user:${emailLower}`;

  try {
    const user = await kvGet(KV_URL, KV_TOKEN, userKey);
    if (!user) {
      return res.status(401).json({ error: 'Nesprávny e-mail alebo heslo.' });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({ error: 'Nesprávny e-mail alebo heslo.' });
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresIn = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 24h
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await kvSet(KV_URL, KV_TOKEN, `session:${token}`, {
      email: user.email,
      name: user.name,
      createdAt: new Date().toISOString(),
      expiresAt,
    }, expiresIn);

    return res.status(200).json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
      expiresAt,
    });
  } catch (err) {
    console.error('auth login error:', err.message);
    return res.status(500).json({ error: 'Chyba servera pri prihlásení.' });
  }
}

// ── SESSION VALIDATE ──
async function handleSession(req, res, KV_URL, KV_TOKEN) {
  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ error: 'Token chýba.' });
  }

  try {
    const session = await kvGet(KV_URL, KV_TOKEN, `session:${token}`);
    if (!session) {
      return res.status(401).json({ error: 'Sedenie vypršalo alebo neexistuje.' });
    }

    if (new Date(session.expiresAt) < new Date()) {
      await kvDel(KV_URL, KV_TOKEN, `session:${token}`);
      return res.status(401).json({ error: 'Sedenie vypršalo.' });
    }

    return res.status(200).json({
      success: true,
      user: { name: session.name, email: session.email },
    });
  } catch (err) {
    console.error('auth session error:', err.message);
    return res.status(500).json({ error: 'Chyba servera pri overení sedenia.' });
  }
}

// ── LOGOUT ──
async function handleLogout(req, res, KV_URL, KV_TOKEN) {
  const { token } = req.body;
  if (token) {
    try {
      await kvDel(KV_URL, KV_TOKEN, `session:${token}`);
    } catch {}
  }
  return res.status(200).json({ success: true });
}

// ── SEED (one-time migration) ──
async function handleSeed(req, res, KV_URL, KV_TOKEN) {
  const SEED_SECRET = process.env.RESET_SECRET;
  const { secret, users } = req.body;

  if (secret !== SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!users || !Array.isArray(users)) {
    return res.status(400).json({ error: 'users array required' });
  }

  const results = [];
  for (const u of users) {
    const emailLower = u.email.trim().toLowerCase();
    const userKey = `user:${emailLower}`;
    const passwordHash = crypto.createHash('sha256').update(u.password).digest('hex');

    try {
      await kvSet(KV_URL, KV_TOKEN, userKey, {
        name: u.name || emailLower.split('@')[0],
        email: emailLower,
        passwordHash,
        createdAt: u.createdAt || new Date().toISOString(),
      });
      results.push({ email: emailLower, status: 'ok' });
    } catch (err) {
      results.push({ email: emailLower, status: 'error', error: err.message });
    }
  }

  return res.status(200).json({ results });
}
