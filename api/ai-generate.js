module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { provider, apiKey, model, property, sampleAds, mode, tone, length, style, formal, emoji, okolie, cta, customInstructions } = req.body;

    if (!apiKey) return res.status(400).json({ error: 'API kľúč je povinný' });
    if (!property) return res.status(400).json({ error: 'Údaje o nehnuteľnosti sú povinné' });

    const selectedProvider = provider || 'anthropic';
    const selectedModel = model || 'claude-sonnet-4-6';

    // Build property details string
    const details = [];
    if (property.type) details.push(`Typ: ${property.type}`);
    if (property.city) details.push(`Mesto: ${property.city}`);
    if (property.district) details.push(`Okres: ${property.district}`);
    if (property.address) details.push(`Adresa: ${property.address}`);
    if (property.price) details.push(`Cena: ${Number(property.price).toLocaleString('sk-SK')} €`);
    if (property.size) details.push(`Výmera: ${property.size} m²`);
    if (property.rooms) details.push(`Počet izieb: ${property.rooms}`);
    if (property.floor) details.push(`Poschodie: ${property.floor}`);
    if (property.year) details.push(`Rok výstavby: ${property.year}`);
    if (property.condition) details.push(`Stav: ${property.condition}`);
    const detailsStr = details.join('\n');

    // Build sample ads context
    let sampleContext = '';
    if (sampleAds && sampleAds.length > 0) {
      sampleContext = `\n\nUžívateľ má nasledujúce vzorové inzeráty, ktoré ukazujú jeho štýl písania. Napodobni tento štýl - rovnaký tón, štruktúru, dĺžku a frázy:\n\n${sampleAds.map((ad, i) => `--- Vzor ${i + 1} ---\n${ad}`).join('\n\n')}`;
    }

    // Build tone/style instructions from user settings
    const toneLabels = {
      profesionalny: 'profesionálny', priatelsky: 'priateľský a vrelý', luxusny: 'luxusný a exkluzívny',
      odborny: 'odborný a technický', dynamicky: 'dynamický a energický', emotivny: 'emotívny a pútavý'
    };
    const lengthMap = { kratky: '2-3 krátke odstavce', stredny: '3-5 odstavcov', dlhy: '5-7 podrobných odstavcov' };
    const styleMap = {
      informativny: 'informatívny - dôraz na fakty, parametre a čísla',
      predajny: 'predajný - dôraz na výhody a motiváciu ku kúpe',
      storytelling: 'rozprávačský - príbeh o živote v tejto nehnuteľnosti'
    };

    let toneStr = '';
    if (tone && tone.length > 0) {
      toneStr = `\nTón: ${tone.map(t => toneLabels[t] || t).join(', ')}.`;
    }
    const lengthStr = length ? `\nDĺžka: ${lengthMap[length] || 'stredný'}.` : '';
    const styleStr = style ? `\nŠtýl: ${styleMap[style] || 'informatívny'}.` : '';
    const formalStr = formal === false ? '\nPouži neformálne oslovovanie (tykanie).' : '\nPouži formálne oslovovanie (vykanie).';
    const emojiStr = emoji ? '\nMôžeš použiť vhodné emoji na oživenie textu.' : '\nNepoužívaj emoji.';
    const okolieStr = okolie !== false ? '' : '\nNezdôrazňuj okolie a občiansku vybavenosť, sústreď sa na nehnuteľnosť.';
    const ctaStr = cta !== false ? '' : '\nNepridávaj výzvu na kontaktovanie alebo obhliadku na konci.';
    const customStr = customInstructions ? `\n\nDodatočné pokyny od užívateľa: ${customInstructions}` : '';

    const settingsBlock = toneStr + lengthStr + styleStr + formalStr + emojiStr + okolieStr + ctaStr + customStr;

    let systemPrompt, userPrompt;

    if (mode === 'headline') {
      systemPrompt = `Si expert na tvorbu titulkov realitných inzerátov na Slovensku. Tvor krátke, chytľavé titulky v slovenčine. Vráť LEN titulok, nič iné.${toneStr}${formalStr}${emojiStr}${customStr}${sampleContext}`;
      userPrompt = `Vytvor chytľavý titulok inzerátu pre túto nehnuteľnosť:\n\n${detailsStr}`;
    } else {
      systemPrompt = `Si expert na tvorbu realitných inzerátov na Slovensku. Píš popisy nehnuteľností v slovenčine. Popis by mal byť atraktívny a mal by zdôrazniť výhody nehnuteľnosti. Nepoužívaj klamlivé tvrdenia. Vráť LEN text popisu, bez titulku a bez úvodzoviek.${settingsBlock}${sampleContext}`;
      const paragraphs = lengthMap[length] || '3-5 odstavcov';
      let structure = `Popis by mal mať ${paragraphs} a mal by zahŕňať:\n- Úvodné zhrnutie`;
      structure += '\n- Popis dispozície a vybavenia';
      if (okolie !== false) structure += '\n- Okolie a občianska vybavenosť';
      if (cta !== false) structure += '\n- Záver s výzvou na kontakt';
      userPrompt = `Napíš popis inzerátu pre túto nehnuteľnosť:\n\n${detailsStr}\n\n${structure}`;
    }

    const maxTokens = mode === 'headline' ? 100 : 1024;

    // Route to provider
    let result;
    switch (selectedProvider) {
      case 'anthropic':
        result = await callAnthropic(apiKey, selectedModel, systemPrompt, userPrompt, maxTokens);
        break;
      case 'openai':
        result = await callOpenAI(apiKey, selectedModel, systemPrompt, userPrompt, maxTokens);
        break;
      case 'google':
        result = await callGoogle(apiKey, selectedModel, systemPrompt, userPrompt, maxTokens);
        break;
      case 'groq':
        result = await callGroq(apiKey, selectedModel, systemPrompt, userPrompt, maxTokens);
        break;
      case 'openrouter':
        result = await callOpenRouter(apiKey, selectedModel, systemPrompt, userPrompt, maxTokens);
        break;
      default:
        return res.status(400).json({ error: `Neznámy poskytovateľ: ${selectedProvider}` });
    }

    return res.status(200).json({
      text: result.text.trim(),
      model: selectedModel,
      provider: selectedProvider,
      usage: result.usage || {},
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || `Serverová chyba` });
  }
};

// ── Anthropic (Claude) ──
async function callAnthropic(apiKey, model, systemPrompt, userPrompt, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw { status: response.status, message: err.error?.message || `Anthropic API chyba: ${response.status}` };
  }

  const data = await response.json();
  return { text: data.content?.[0]?.text || '', usage: data.usage };
}

// ── OpenAI (GPT) ──
async function callOpenAI(apiKey, model, systemPrompt, userPrompt, maxTokens) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw { status: response.status, message: err.error?.message || `OpenAI API chyba: ${response.status}` };
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '', usage: data.usage };
}

// ── Google (Gemini) ──
async function callGoogle(apiKey, model, systemPrompt, userPrompt, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw { status: response.status, message: err.error?.message || `Google API chyba: ${response.status}` };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text, usage: data.usageMetadata || {} };
}

// ── Groq ──
async function callGroq(apiKey, model, systemPrompt, userPrompt, maxTokens) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw { status: response.status, message: err.error?.message || `Groq API chyba: ${response.status}` };
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '', usage: data.usage };
}

// ── OpenRouter ──
async function callOpenRouter(apiKey, model, systemPrompt, userPrompt, maxTokens) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw { status: response.status, message: err.error?.message || `OpenRouter API chyba: ${response.status}` };
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '', usage: data.usage };
}
