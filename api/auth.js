const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { kvGet, kvSet, kvDel, handleCors, getKV, checkRateLimit, clearRateLimit } = require('../lib/kv');

// ── Email allowlist (TEMPORARY access lock) ──
// Set ALLOWED_EMAILS on Vercel (comma-separated). Empty = no restriction.
// Affects: login, register, send-reset-code, verify-reset-code.
function isAllowedEmail(email) {
  const raw = process.env.ALLOWED_EMAILS || '';
  const allow = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length === 0) return true;
  return allow.includes((email || '').trim().toLowerCase());
}

module.exports = async (req, res) => {
  if (handleCors(req, res, 'POST, OPTIONS')) return;

  const { KV_URL, KV_TOKEN, ok } = getKV();
  if (!ok) return res.status(500).json({ error: 'Server nie je nakonfigurovaný (KV)', errorKey: 'auth.error.server_misconfigured' });

  const { action } = req.body || {};
  const RATE_LIMIT_MSG = 'Príliš veľa pokusov. Skúste znova neskôr.';

  try {
    // ── Rate limiting for login, register, send-reset-code ──
    if (['login', 'register', 'send-reset-code'].includes(action)) {
      const email = (req.body.email || '').trim().toLowerCase();
      if (email) {
        const limits = {
          'login':           { max: 5,  window: 300 },
          'register':        { max: 3,  window: 600 },
          'send-reset-code': { max: 3,  window: 600 },
        };
        const { max, window } = limits[action];
        const rlKey = `rl:${action}:${email}`;
        const allowed = await checkRateLimit(KV_URL, KV_TOKEN, rlKey, max, window);
        if (!allowed) {
          return res.status(429).json({ error: RATE_LIMIT_MSG });
        }
      }
    }

    switch (action) {
      case 'register':          return await handleRegister(req, res, KV_URL, KV_TOKEN);
      case 'login':             return await handleLogin(req, res, KV_URL, KV_TOKEN);
      case 'session':           return await handleSession(req, res, KV_URL, KV_TOKEN);
      case 'logout':            return await handleLogout(req, res, KV_URL, KV_TOKEN);
      case 'seed':              return await handleSeed(req, res, KV_URL, KV_TOKEN);
      case 'reset-pw':          return await handleResetPw(req, res, KV_URL, KV_TOKEN);
      case 'send-reset-code':   return await handleSendResetCode(req, res);
      case 'verify-reset-code': return await handleVerifyResetCode(req, res, KV_URL, KV_TOKEN);
      case 'update-prefs':      return await handleUpdatePrefs(req, res, KV_URL, KV_TOKEN);
      default:
        return res.status(400).json({ error: 'Neznáma akcia: ' + action , errorKey: 'auth.error.unknown_action' });
    }
  } catch (err) {
    console.error('auth top-level error:', action, err.message, err.stack);
    return res.status(500).json({ error: 'Interná chyba servera.', errorKey: 'auth.error.server' , detail: err.message });
  }
};

// ── REGISTER ──
async function handleRegister(req, res, KV_URL, KV_TOKEN) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Meno, email a heslo sú povinné.', errorKey: 'auth.error.required_fields_register' });
  }

  const emailLower = email.trim().toLowerCase();
  const userKey = `user:${emailLower}`;

  // Generic response to prevent email enumeration
  const genericResponse = () =>
    new Promise(resolve => {
      const delay = 100 + Math.floor(Math.random() * 100);
      setTimeout(() => {
        resolve(
          res.status(200).json({
            ok: true,
            message: 'Ak účet neexistoval, bol vytvorený. Prihláste sa.',
          })
        );
      }, delay);
    });

  // Allowlist guard — silent reject to avoid enumeration of allowed addresses
  if (!isAllowedEmail(emailLower)) {
    return genericResponse();
  }

  try {
    const existing = await kvGet(KV_URL, KV_TOKEN, userKey);
    if (existing) {
      return genericResponse();
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await kvSet(KV_URL, KV_TOKEN, userKey, {
      name: name.trim(),
      email: emailLower,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    return genericResponse();
  } catch (err) {
    console.error('auth register error:', err.message);
    return res.status(500).json({ error: 'Chyba servera pri registrácii.', errorKey: 'auth.error.server_register' });
  }
}

// ── LOGIN ──
async function handleLogin(req, res, KV_URL, KV_TOKEN) {
  const { email, password, remember } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email a heslo sú povinné.', errorKey: 'auth.error.required_fields' });
  }

  const emailLower = email.trim().toLowerCase();
  const userKey = `user:${emailLower}`;

  // Allowlist guard — same generic error to avoid enumeration
  if (!isAllowedEmail(emailLower)) {
    return res.status(401).json({ error: 'Nesprávny e-mail alebo heslo.', errorKey: 'auth.error.wrong_credentials' });
  }

  try {
    const user = await kvGet(KV_URL, KV_TOKEN, userKey);
    if (!user) {
      return res.status(401).json({ error: 'Nesprávny e-mail alebo heslo.', errorKey: 'auth.error.wrong_credentials' });
    }

    const bcryptMatch = await bcrypt.compare(password, user.passwordHash);
    if (!bcryptMatch) {
      const sha256 = crypto.createHash('sha256').update(password).digest('hex');
      if (sha256 !== user.passwordHash) {
        return res.status(401).json({ error: 'Nesprávny e-mail alebo heslo.', errorKey: 'auth.error.wrong_credentials' });
      }
      // SHA-256 matched — migrate to bcrypt
      user.passwordHash = await bcrypt.hash(password, 12);
      await kvSet(KV_URL, KV_TOKEN, userKey, user);
    }

    // Clear rate limit on successful login
    await clearRateLimit(KV_URL, KV_TOKEN, `rl:login:${emailLower}`);

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
      user: { name: user.name, email: user.email, language: user.language || 'sk' },
      expiresAt,
    });
  } catch (err) {
    console.error('auth login error:', err.message);
    return res.status(500).json({ error: 'Chyba servera pri prihlásení.', errorKey: 'auth.error.server_login' });
  }
}

// ── UPDATE USER PREFS (language, future settings) ──
async function handleUpdatePrefs(req, res, KV_URL, KV_TOKEN) {
  const { token, language } = req.body;
  if (!token) return res.status(401).json({ error: 'Token chýba.', errorKey: 'auth.error.token_missing' });

  try {
    const session = await kvGet(KV_URL, KV_TOKEN, `session:${token}`);
    if (!session) return res.status(401).json({ error: 'Sedenie vypršalo.', errorKey: 'auth.error.session_expired' });
    if (new Date(session.expiresAt) < new Date()) {
      await kvDel(KV_URL, KV_TOKEN, `session:${token}`);
      return res.status(401).json({ error: 'Sedenie vypršalo.', errorKey: 'auth.error.session_expired' });
    }

    const userKey = `user:${session.email}`;
    const user = await kvGet(KV_URL, KV_TOKEN, userKey);
    if (!user) return res.status(404).json({ error: 'Účet nenájdený.', errorKey: 'auth.error.account_not_found' });

    // Whitelist of pref fields — only allow known keys to be saved
    if (language && ['sk', 'en'].includes(language)) {
      user.language = language;
    }
    user.updatedAt = new Date().toISOString();

    await kvSet(KV_URL, KV_TOKEN, userKey, user);
    return res.status(200).json({ success: true, user: { language: user.language || 'sk' } });
  } catch (err) {
    console.error('auth update-prefs error:', err.message);
    return res.status(500).json({ error: 'Chyba servera.', errorKey: 'auth.error.server' });
  }
}

// ── SESSION VALIDATE ──
async function handleSession(req, res, KV_URL, KV_TOKEN) {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'Token chýba.', errorKey: 'auth.error.token_missing' });

  try {
    const session = await kvGet(KV_URL, KV_TOKEN, `session:${token}`);
    if (!session) return res.status(401).json({ error: 'Sedenie vypršalo alebo neexistuje.', errorKey: 'auth.error.session_invalid' });

    if (new Date(session.expiresAt) < new Date()) {
      await kvDel(KV_URL, KV_TOKEN, `session:${token}`);
      return res.status(401).json({ error: 'Sedenie vypršalo.', errorKey: 'auth.error.session_expired' });
    }

    // Pull fresh language from user record (session is cached, prefs may have changed)
    let language = 'sk';
    try {
      const userKey = `user:${session.email}`;
      const user = await kvGet(KV_URL, KV_TOKEN, userKey);
      if (user && user.language) language = user.language;
    } catch {}

    return res.status(200).json({
      success: true,
      user: { name: session.name, email: session.email, language },
    });
  } catch (err) {
    console.error('auth session error:', err.message);
    return res.status(500).json({ error: 'Chyba servera pri overení sedenia.', errorKey: 'auth.error.server_session' });
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
    const passwordHash = await bcrypt.hash(u.password, 12);

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
    const passwordHash = await bcrypt.hash(newPassword, 12);
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

// ── Reset email template (SK + EN) ──
function renderResetEmail(code, lang) {
  const isEn = lang === 'en';
  const subject = isEn ? 'SecPro — Password reset code' : 'SecPro — Kód na obnovenie hesla';
  const heading = isEn ? 'Password reset code' : 'Kód na obnovenie hesla';
  const intro = isEn ? 'Use the code below to reset your password:' : 'Použite kód nižšie na obnovenie hesla:';
  const expiry = isEn
    ? 'This code is valid for 10 minutes. If you did not request a reset, you can safely ignore this email.'
    : 'Kód platí 10 minút. Ak ste o reset nepožiadali, môžete tento email ignorovať.';
  const tagline = isEn
    ? 'SecPro · The workbench for modern real estate agents'
    : 'SecPro · Centrum pre moderných maklérov';
  const logoB64 = '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';
  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E5E9F0">
      <div style="background:linear-gradient(135deg,#0B2A3C 0%,#1A7A8A 100%);padding:24px;text-align:center;color:#fff">
        <img src="data:image/png;base64,${logoB64}" alt="SecPro" width="48" height="48" style="display:block;margin:0 auto 12px;">
        <div style="font-size:22px;font-weight:700;letter-spacing:1px">SECPRO</div>
      </div>
      <div style="padding:32px 24px;text-align:center">
        <h2 style="color:#0B2A3C;margin:0 0 8px;font-size:20px;font-weight:600">${heading}</h2>
        <p style="color:#666;margin:0 0 24px;font-size:14px">${intro}</p>
        <div style="background:#f0f2f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0B2A3C;font-family:'SF Mono',Menlo,monospace">${code}</span>
        </div>
        <p style="color:#999;font-size:13px;margin:0">${expiry}</p>
      </div>
      <div style="background:#FAFBFC;padding:16px;text-align:center;color:#999;font-size:12px;border-top:1px solid #E5E9F0">
        ${tagline}
      </div>
    </div>
  `;
  return { subject, html };
}

// ── SEND RESET CODE (email via Resend) ──
async function handleSendResetCode(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required', errorKey: 'auth.error.email_required' , errorKey: 'auth.error.email_required' });

  // Allowlist guard — pretend success to avoid leaking who's allowed
  if (!isAllowedEmail(email)) {
    return res.status(200).json({ token: 'no-op' });
  }

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

  // Detect the user's language preference for email rendering
  let userLang = 'sk';
  try {
    const { KV_URL: KU, KV_TOKEN: KT, ok } = getKV();
    if (ok) {
      const user = await kvGet(KU, KT, `user:${email.trim().toLowerCase()}`);
      if (user && user.language) userLang = user.language;
    }
  } catch {}

  const { subject, html } = renderResetEmail(code, userLang);

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
        subject,
        html,
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

  // Allowlist guard — applies even if a stale token leaked
  if (!isAllowedEmail(payload.email)) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  if (Date.now() > payload.exp) {
    return res.status(400).json({ error: 'Kód vypršal. Požiadajte o nový.', errorKey: 'auth.error.code_expired' });
  }

  const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  if (codeHash !== payload.codeHash) {
    return res.status(400).json({ error: 'Nesprávny kód.', errorKey: 'auth.error.code_wrong' });
  }

  if (newPassword && KV_URL && KV_TOKEN) {
    try {
      const emailLower = payload.email.toLowerCase();
      const userKey = `user:${emailLower}`;
      const user = await kvGet(KV_URL, KV_TOKEN, userKey);
      const passwordHash = await bcrypt.hash(newPassword, 12);

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
