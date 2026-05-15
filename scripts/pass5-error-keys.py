#!/usr/bin/env python3
"""Pass 5: Inject errorKey into every error response in api/auth.js.

Backend keeps emitting the SK `error` string for backward compatibility, but
also includes `errorKey` so the i18n-aware frontend can translate."""
import os, re

AUTH_JS = "/Users/matej/Desktop/Projects/secpro/api/auth.js"
DICT_JS = "/Users/matej/Desktop/Projects/secpro/public/i18n-dict.js"

ERROR_MAP = {
    'Server nie je nakonfigurovaný (KV)': ('auth.error.server_misconfigured', 'Server not configured (KV).'),
    'Neznáma akcia: ':                    ('auth.error.unknown_action',       'Unknown action.'),
    'Interná chyba servera.':             ('auth.error.server',               'Internal server error.'),
    'Meno, email a heslo sú povinné.':    ('auth.error.required_fields_register', 'Name, email and password are required.'),
    'Chyba servera pri registrácii.':     ('auth.error.server_register',      'Server error during registration.'),
    'Email a heslo sú povinné.':          ('auth.error.required_fields',      'Email and password are required.'),
    'Nesprávny e-mail alebo heslo.':      ('auth.error.wrong_credentials',    'Incorrect email or password.'),
    'Chyba servera pri prihlásení.':      ('auth.error.server_login',         'Server error during sign-in.'),
    'Token chýba.':                       ('auth.error.token_missing',        'Token missing.'),
    'Sedenie vypršalo.':                  ('auth.error.session_expired',      'Session expired.'),
    'Sedenie vypršalo alebo neexistuje.': ('auth.error.session_invalid',      'Session expired or does not exist.'),
    'Účet nenájdený.':                    ('auth.error.account_not_found',    'Account not found.'),
    'Chyba servera.':                     ('auth.error.server',               'Server error.'),
    'Chyba servera pri overení sedenia.': ('auth.error.server_session',       'Server error during session check.'),
    'Kód vypršal. Požiadajte o nový.':    ('auth.error.code_expired',         'Code expired. Request a new one.'),
    'Nesprávny kód.':                     ('auth.error.code_wrong',           'Incorrect code.'),
    'Email is required':                  ('auth.error.email_required',       'Email is required.'),
}


def patch_auth_js():
    with open(AUTH_JS) as f: content = f.read()
    used = set()
    for sk, (key, _) in ERROR_MAP.items():
        v1 = re.compile(r"\{\s*error:\s*'" + re.escape(sk) + r"'\s*(,|\})")
        v2 = re.compile(r"\{\s*error:\s*'" + re.escape(sk) + r"'\s*\+\s*([^,}]+)\s*(,|\})")
        # Skip if already has errorKey
        if f"errorKey: '{key}'" in content:
            used.add(key)
        def sub_v1(m):
            used.add(key)
            return "{ error: '" + sk + "', errorKey: '" + key + "' " + m.group(1)
        content = v1.sub(sub_v1, content)
        def sub_v2(m):
            used.add(key)
            return "{ error: '" + sk + "' + " + m.group(1) + ", errorKey: '" + key + "' " + m.group(2)
        content = v2.sub(sub_v2, content)
    tmp = AUTH_JS + '.tmp'
    with open(tmp, 'w') as f: f.write(content)
    os.replace(tmp, AUTH_JS)
    print(f"errorKey injected for {len(used)} unique errors")
    return used


def patch_dict_js(used):
    with open(DICT_JS) as f: c = f.read()
    sk_new, en_new = [], []
    for sk, (key, en) in ERROR_MAP.items():
        if key not in used: continue
        if f"'{key}':" in c: continue
        sk_esc = sk.replace("\\", "\\\\").replace("'", "\\'")
        en_esc = en.replace("\\", "\\\\").replace("'", "\\'")
        sk_new.append(f"    '{key}': '{sk_esc}',")
        en_new.append(f"    '{key}': '{en_esc}',")
    if not sk_new:
        print("dict already complete")
        return
    sk_block = "\n    // ── Pass 5: backend errorKey ──\n" + "\n".join(sk_new) + "\n"
    en_block = "\n    // ── Pass 5: backend errorKey ──\n" + "\n".join(en_new) + "\n"
    sk_end = '\n  },\n\n  en: {'
    if sk_end not in c: sk_end = '\n  },\n  en: {'
    c = c.replace(sk_end, sk_block + sk_end, 1)
    en_end = '\n  },\n};'
    c = c.replace(en_end, en_block + en_end, 1)
    tmp = DICT_JS + '.tmp'
    with open(tmp, 'w') as f: f.write(c)
    os.replace(tmp, DICT_JS)
    print(f"Added {len(sk_new)} dict entries (sk+en)")


if __name__ == '__main__':
    used = patch_auth_js()
    patch_dict_js(used)
