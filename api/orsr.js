/**
 * ORSR.sk - Obchodný register SR - Search & Detail API
 * Serverless function for Vercel
 */

// Uses native fetch (Node 18+)

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Windows-1250 encoding for Slovak characters ───
// orsr.sk requires windows-1250 encoded URLs, not UTF-8

const WIN1250_MAP = {
  '\u00E1':'%E1', '\u00E4':'%E4', '\u010D':'%E8', '\u010F':'%CF', '\u00E9':'%E9', '\u011B':'%EC',
  '\u00ED':'%ED', '\u013E':'%BE', '\u013A':'%B9', '\u0148':'%F2', '\u00F3':'%F3', '\u00F4':'%F4',
  '\u0155':'%C0', '\u0159':'%F8', '\u0161':'%9A', '\u0165':'%9D', '\u00FA':'%FA', '\u016F':'%F9',
  '\u00FD':'%FD', '\u017E':'%9E',
  '\u00C1':'%C1', '\u00C4':'%C4', '\u010C':'%C8', '\u010E':'%CF', '\u00C9':'%C9', '\u011A':'%CC',
  '\u00CD':'%CD', '\u013D':'%A5', '\u0139':'%A6', '\u0147':'%D2', '\u00D3':'%D3', '\u00D4':'%D4',
  '\u0154':'%C0', '\u0158':'%D8', '\u0160':'%8A', '\u0164':'%8D', '\u00DA':'%DA', '\u016E':'%D9',
  '\u00DD':'%DD', '\u017D':'%8E',
};

function encodeWin1250(str) {
  let result = '';
  for (const ch of str) {
    if (WIN1250_MAP[ch]) {
      result += WIN1250_MAP[ch];
    } else if (ch.charCodeAt(0) < 128) {
      // Standard ASCII - use normal URL encoding
      result += encodeURIComponent(ch);
    } else {
      result += encodeURIComponent(ch);
    }
  }
  return result;
}

// ─── Helpers ───

async function fetchUrl(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sk,cs;q=0.9,en;q=0.8',
          'Referer': 'https://www.orsr.sk/',
        },
        redirect: 'follow',
      });
      const buf = Buffer.from(await resp.arrayBuffer());
      clearTimeout(timer);
      try {
        const { TextDecoder } = require('util');
        return new TextDecoder('windows-1250').decode(buf);
      } catch {
        return buf.toString('latin1');
      }
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw new Error('ORSR.sk neodpoved\u00E1 - sk\u00FAste to znova nesk\u00F4r');
    }
  }
}

function clean(s) {
  if (!s) return '';
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Search by ICO ───

async function searchByICO(ico) {
  ico = ico.replace(/\s/g, '').replace(/[^0-9]/g, '');
  if (!ico || ico.length < 6 || ico.length > 8) throw new Error('IČO musí mať 6-8 číslic');
  ico = ico.padStart(8, '0');
  const url = `https://www.orsr.sk/hladaj_ico.asp?ICO=${ico}&SID=0`;
  const html = await fetchUrl(url);
  return parseSearchResults(html);
}

// ─── Search by Name ───

async function searchByName(name) {
  if (!name || name.trim().length < 2) throw new Error('Zadajte aspoň 2 znaky');
  const encoded = encodeWin1250(name.trim());
  const url = `https://www.orsr.sk/hladaj_subjekt.asp?OBMENO=${encoded}&PF=0&R=on`;
  const html = await fetchUrl(url);
  return parseSearchResults(html);
}

// ─── Search by Person ───

async function searchByPerson(surname, firstname) {
  if (!surname || surname.trim().length < 2) throw new Error('Zadajte priezvisko (min 2 znaky)');
  const pr = encodeWin1250(surname.trim());
  const mn = firstname ? encodeWin1250(firstname.trim()) : '';
  const url = `https://www.orsr.sk/hladaj_osoba.asp?PR=${pr}&MENO=${mn}&SID=0&T=f0&R=on`;
  const html = await fetchUrl(url);
  return parseSearchResults(html);
}

// ─── Parse search result list ───

function parseSearchResults(html) {
  const results = [];
  const seen = new Set();
  const re = /<a\s+href="vypis\.asp\?ID=(\d+)&amp;SID=(\d+)&amp;P=0"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = clean(m[3]);
    if (!name || name.length < 3 || /^(aktu[aá]ln|[úu]pln|pln)/i.test(name)) continue;
    const key = m[1] + '-' + m[2];
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ id: m[1], sid: m[2], name });
  }
  return results;
}

// ─── Get Company Detail (full = úplný výpis) ───

async function getDetail(id, sid, full) {
  const p = full ? 1 : 0;
  const url = `https://www.orsr.sk/vypis.asp?ID=${id}&SID=${sid}&P=${p}`;
  const html = await fetchUrl(url);
  return parseDetail(html, url);
}

// ─── Parse detail page — extract ALL sections ───

function parseDetail(html, srcUrl) {
  const data = { srcUrl };

  // Court name
  const courtM = html.match(/[Vv][ýy]pis z [Oo]bchodn[ée]ho registra\s+([^<]+)/);
  if (courtM) data.prislusny_sud = clean(courtM[1]);

  // Oddiel + Vložka
  const oddielM = html.match(/Oddiel:(?:&nbsp;|\s)*<\/span>\s*<span[^>]*>\s*([^<]+)/i);
  if (oddielM) data.oddiel = clean(oddielM[1]);
  const vlozkaM = html.match(/[Vv]lo[žz]ka[^:]*:(?:&nbsp;|\s)*<\/span>\s*<span[^>]*>\s*([^<]+)/i);
  if (vlozkaM) data.vlozka = clean(vlozkaM[1]);

  // Split HTML into table sections — each section is one field
  // Each field starts with <span class="tl">Label:</span>
  const sectionRe = /<span\s+class="tl">\s*([\s\S]*?)\s*<\/span>([\s\S]*?)(?=<span\s+class="tl">|<hr|$)/gi;
  let sec;

  while ((sec = sectionRe.exec(html)) !== null) {
    const rawLabel = clean(sec[1]).replace(/:+$/, '').replace(/&nbsp;/g, ' ').trim();
    const rawContent = sec[2];

    // Extract all values from <span class='ra'> or <span class='ro'>
    const vals = [];
    const dateVals = [];
    const valRe = /<span\s+class='r([ao])'>\s*([\s\S]*?)\s*<\/span>/gi;
    let v;
    while ((v = valRe.exec(rawContent)) !== null) {
      const cleaned = clean(v[2]);
      if (!cleaned) continue;
      // Separate date annotations "(od: ...)" from actual values
      if (/^\(od:/.test(cleaned) || /^\(do:/.test(cleaned)) {
        dateVals.push(cleaned);
      } else {
        vals.push(cleaned);
      }
    }

    if (!vals.length && !rawLabel) continue;

    // Map labels to keys
    const label = rawLabel.toLowerCase();

    if (/obchodn[ée]\s*meno/i.test(label)) {
      data.obchodne_meno = vals.join(' ');
    } else if (/^s[ií]dlo$/i.test(label)) {
      data.sidlo = vals.join(', ');
    } else if (/bydlisko/i.test(label)) {
      data.bydlisko = vals.join(', ');
    } else if (/miesto\s*podnikania/i.test(label)) {
      data.miesto_podnikania = vals.join(', ');
    } else if (/^i[čc]o$/i.test(label)) {
      data.ico = vals.join('').replace(/\s/g, '');
    } else if (/de[ňn]\s*z[aá]pisu/i.test(label)) {
      data.den_zapisu = vals[0];
    } else if (/de[ňn]\s*v[ýy]mazu/i.test(label)) {
      data.den_vymazu = vals[0];
    } else if (/d[ôo]vod\s*v[ýy]mazu/i.test(label)) {
      data.dovod_vymazu = vals.join(' ');
    } else if (/pr[aá]vna\s*forma/i.test(label)) {
      data.pravna_forma = vals[0];
    } else if (/predmet\s*[čc]innosti/i.test(label) || /predmet\s*podnikania/i.test(label)) {
      data.predmet_cinnosti = (data.predmet_cinnosti || []).concat(vals);
    } else if (/[šs]tatut[aá]rny\s*org[aá]n/i.test(label)) {
      data.statutarny_organ_typ = vals[0] || '';
    } else if (/spolo[čc]n[ií]ci/i.test(label)) {
      // Will be parsed below in block mode
    } else if (/v[ýy][šs]ka\s*vkladu/i.test(label)) {
      data.vyska_vkladu = vals.join('; ');
    } else if (/z[aá]kladn[ée]\s*imanie/i.test(label)) {
      data.zakladne_imanie = vals.join(' ');
    } else if (/konanie\s*(menom)?/i.test(label) && !/^$/.test(label)) {
      data.konanie = vals.join(' ');
    } else if (/d[aá]tum\s*aktualiz[aá]cie/i.test(label)) {
      data.datum_aktualizacie = vals[0];
    } else if (/d[aá]tum\s*v[ýy]pisu/i.test(label)) {
      data.datum_vypisu = vals[0];
    } else if (/akcie/i.test(label)) {
      data.akcie = vals.join(', ');
    } else if (/likvid[aá]tor/i.test(label)) {
      data.likvidator = vals.join(', ');
    } else if (/likvid[aá]cia/i.test(label)) {
      data.likvidacia = vals.join(' ');
    } else if (/dozorn[aá]\s*rada/i.test(label)) {
      // Will be parsed below in block mode
    } else if (/[zz]astupovanie/i.test(label)) {
      data.zastupovanie = vals.join(' ');
    } else if (/ved[uú]ci\s*org/i.test(label)) {
      data.veduci_org_zlozky = vals.join(', ');
    } else if (/spr[aá]vca\s*konkur/i.test(label)) {
      data.spravca_konkurznej_podstaty = vals.join(', ');
    } else if (/vyhl[aá]senie\s*konkurzu/i.test(label)) {
      data.vyhlasenie_konkurzu = vals.join(' ');
    } else if (/pr[aá]vny\s*n[aá]stupca/i.test(label)) {
      data.pravny_nastupca = vals.join(', ');
    } else if (/zl[uú][čc]enie|splynutie/i.test(label)) {
      data.zlucenie_splynutie = vals.join(' ');
    } else if (/spolo[čc]nos[tť]\s*zru[šs]en[aá]/i.test(label)) {
      data.spolocnost_zrusena = vals.join(' ');
    }
  }

  // ─── Parse people blocks using <span class="tl"> section boundaries ───
  // Split HTML into labeled sections first, then extract person data from matching sections
  const tlRe = /<span\s+class="tl">\s*([\s\S]*?)\s*<\/span>/gi;
  const sections = [];
  let tlM;
  while ((tlM = tlRe.exec(html)) !== null) {
    sections.push({ label: clean(tlM[1]), startAfter: tlM.index + tlM[0].length });
  }

  // For each section, content runs from startAfter to the next section's match start
  function getSectionContent(secIdx) {
    const start = sections[secIdx].startAfter;
    const end = secIdx + 1 < sections.length ? sections[secIdx + 1].startAfter - 200 : html.length;
    return html.substring(start, Math.max(start, end));
  }

  function extractPersons(sectionHtml) {
    const allVals = [];
    const vRe = /<span\s+class='r[ao]'>\s*([\s\S]*?)\s*<\/span>/gi;
    let vm;
    while ((vm = vRe.exec(sectionHtml)) !== null) {
      const cl = clean(vm[1]);
      if (cl) allVals.push(cl);
    }

    const persons = [];
    let current = [];
    for (const val of allVals) {
      if (/^\(od:/.test(val)) {
        if (current.length) { persons.push(current.join(', ')); current = []; }
        continue;
      }
      if (/^-\s/.test(val) && current.length) {
        current.push(val);
        persons.push(current.join(', '));
        current = [];
        continue;
      }
      if (/^(konate|konatelia|predstavenstvo|spolo[čc]n[ií]k|[čc]len|predseda|podpredseda|dozorn|prok[úu]ra)/i.test(val) && current.length === 0) {
        persons.push(val);
        continue;
      }
      current.push(val);
    }
    if (current.length) persons.push(current.join(', '));
    return persons;
  }

  const personMappings = [
    { key: 'statutarny_organ', re: /[šs]tatut[aá]rny\s*org[aá]n/i },
    { key: 'spolocnici', labelRe: /^spolo[čc]n[ií]ci:?$/i },
    { key: 'dozorna_rada', re: /dozorn[aá]\s*rada/i },
  ];

  for (const pm of personMappings) {
    for (let si = 0; si < sections.length; si++) {
      const lbl = sections[si].label;
      const matches = pm.labelRe ? pm.labelRe.test(lbl) : pm.re.test(lbl);
      if (!matches) continue;
      // For spoločníci, use exact label match to avoid "Výška vkladu každého spoločníka"
      const content = getSectionContent(si);
      const persons = extractPersons(content);
      if (persons.length && !data[pm.key]) {
        data[pm.key] = persons;
      }
    }
  }

  return data;
}

// ─── Main handler ───

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    if (action === 'searchICO') {
      const results = await searchByICO(req.body.ico);
      return res.status(200).json({ results });
    }

    if (action === 'searchName') {
      const results = await searchByName(req.body.name);
      return res.status(200).json({ results });
    }

    if (action === 'searchPerson') {
      const results = await searchByPerson(req.body.surname, req.body.firstname);
      return res.status(200).json({ results });
    }

    if (action === 'detail') {
      const detail = await getDetail(req.body.id, req.body.sid, req.body.full || false);
      return res.status(200).json({ detail });
    }

    if (action === 'detailByICO') {
      const results = await searchByICO(req.body.ico);
      if (!results.length) throw new Error('Subjekt s daným IČO nebol nájdený');
      const detail = await getDetail(results[0].id, results[0].sid, false);
      return res.status(200).json({ detail });
    }

    return res.status(400).json({ error: 'Neznáma akcia' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Chyba pri komunikácii s ORSR.sk' });
  }
};
