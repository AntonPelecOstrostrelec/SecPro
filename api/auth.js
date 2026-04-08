const crypto = require('crypto');
const { kvGet, kvSet, kvDel, handleCors, getKV } = require('../lib/kv');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  const { KV_URL, KV_TOKEN, ok } = getKV();
  if (!ok) return res.status(500).json({ error: 'Server nie je nakonfigurovaný (KV)' });

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'register':          return await handleRegister(req, res, KV_URL, KV_TOKEN);
      case 'login':             return await handleLogin(req, res, KV_URL, KV_TOKEN);
      case 'session':           return await handleSession(req, res, KV_URL, KV_TOKEN);
      case 'logout':            return await handleLogout(req, res, KV_URL, KV_TOKEN);
      case 'seed':              return await handleSeed(req, res, KV_URL, KV_TOKEN);
      case 'reset-pw':          return await handleResetPw(req, res, KV_URL, KV_TOKEN);
      case 'send-reset-code':   return await handleSendResetCode(req, res);
      case 'verify-reset-code': return await handleVerifyResetCode(req, res, KV_URL, KV_TOKEN);
      default:
        return res.status(400).json({ error: 'Neznáma akcia: ' + action });
    }
  } catch (err) {
    console.error('auth top-level error:', action, err.message, err.stack);
    return res.status(500).json({ error: 'Interná chyba servera.', detail: err.message });
  }
};

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

    const token = crypto.randomBytes(32).toString('hex');
    const expiresIn = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
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
  if (!token) return res.status(401).json({ error: 'Token chýba.' });

  try {
    const session = await kvGet(KV_URL, KV_TOKEN, `session:${token}`);
    if (!session) return res.status(401).json({ error: 'Sedenie vypršalo alebo neexistuje.' });

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
    try { await kvDel(KV_URL, KV_TOKEN, `session:${token}`); } catch {}
  }
  return res.status(200).json({ success: true });
}

// ── SEED (one-time migration) ──
async function handleSeed(req, res, KV_URL, KV_TOKEN) {
  const SEED_SECRET = process.env.RESET_SECRET;
  const { secret, users } = req.body;

  if (secret !== SEED_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'users array required' });

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

// ── RESET PASSWORD (admin) ──
async function handleResetPw(req, res, KV_URL, KV_TOKEN) {
  const SEED_SECRET = process.env.RESET_SECRET;
  const { secret, email, newPassword } = req.body;

  if (!SEED_SECRET || secret !== SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized', hint: !SEED_SECRET ? 'RESET_SECRET not set' : 'secret mismatch' });
  }
  if (!email || !newPassword) return res.status(400).json({ error: 'email and newPassword required' });

  const emailLower = email.trim().toLowerCase();
  const userKey = `user:${emailLower}`;

  try {
    await kvDel(KV_URL, KV_TOKEN, userKey);
    const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    await kvSet(KV_URL, KV_TOKEN, userKey, {
      name: emailLower.split('@')[0],
      email: emailLower,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: 'Password updated for ' + emailLower });
  } catch (err) {
    console.error('reset-pw error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── SEND RESET CODE (email via Resend) ──
async function handleSendResetCode(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESET_SECRET = process.env.RESET_SECRET;
  if (!RESEND_API_KEY || !RESET_SECRET) {
    console.error('Missing env vars:', { hasResendKey: !!RESEND_API_KEY, hasResetSecret: !!RESET_SECRET });
    return res.status(500).json({ error: 'Server not configured', detail: 'Missing: ' + (!RESEND_API_KEY ? 'RESEND_API_KEY ' : '') + (!RESET_SECRET ? 'RESET_SECRET' : '') });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const exp = Date.now() + 10 * 60 * 1000;

  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const payload = JSON.stringify({ email: email.toLowerCase(), codeHash, exp });
  const payloadB64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', RESET_SECRET).update(payloadB64).digest('hex');
  const token = payloadB64 + '.' + signature;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SecPro <onboarding@resend.dev>',
        to: [email],
        subject: 'SecPro — Kód na obnovenie hesla',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px">
            <h2 style="color:#0B2A3C;margin-bottom:8px">SecPro</h2>
            <p style="color:#666;margin-bottom:24px">Váš kód na obnovenie hesla:</p>
            <div style="background:#f0f2f5;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
              <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0B2A3C">${code}</span>
            </div>
            <p style="color:#999;font-size:13px">Kód platí 10 minút. Ak ste o reset nepožiadali, ignorujte tento email.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend API error:', JSON.stringify(err));
      return res.status(500).json({ error: 'Failed to send email', detail: err.message || JSON.stringify(err) });
    }

    return res.status(200).json({ token });
  } catch (err) {
    console.error('Send email exception:', err.message, err.stack);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
}

// ── VERIFY RESET CODE ──
async function handleVerifyResetCode(req, res, KV_URL, KV_TOKEN) {
  const { token, code, newPassword } = req.body;
  if (!token || !code) return res.status(400).json({ error: 'Token and code are required' });

  const RESET_SECRET = process.env.RESET_SECRET;
  if (!RESET_SECRET) return res.status(500).json({ error: 'Server not configured' });

  const parts = token.split('.');
  if (parts.length !== 2) return res.status(400).json({ error: 'Invalid token' });

  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', RESET_SECRET).update(payloadB64).digest('hex');
  if (signature !== expectedSig) return res.status(400).json({ error: 'Invalid token' });

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  } catch {
    return res.status(400).json({ error: 'Invalid token' });
  }

  if (Date.now() > payload.exp) {
    return res.status(400).json({ error: 'Kód vypršal. Požiadajte o nový.' });
  }

  const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  if (codeHash !== payload.codeHash) {
    return res.status(400).json({ error: 'Nesprávny kód.' });
  }

  if (newPassword && KV_URL && KV_TOKEN) {
    try {
      const emailLower = payload.email.toLowerCase();
      const userKey = `user:${emailLower}`;
      const user = await kvGet(KV_URL, KV_TOKEN, userKey);
      const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

      if (user) {
        user.passwordHash = passwordHash;
        await kvSet(KV_URL, KV_TOKEN, userKey, user);
      } else {
        await kvSet(KV_URL, KV_TOKEN, userKey, {
          name: emailLower.split('@')[0],
          email: emailLower,
          passwordHash,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('verify-reset-code: Failed to update password:', err.message);
    }
  }

  return res.status(200).json({ verified: true, email: payload.email });
}
