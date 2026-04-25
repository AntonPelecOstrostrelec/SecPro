// Gemini API wrapper for AI extraction.
// Uses gemini-2.0-flash-exp (free tier, 15 req/min, 1M tokens/day).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY in .env');

const genAI = new GoogleGenerativeAI(apiKey);

// Default model — Flash 2.0 (fast, cheap, strong JSON mode)
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

/**
 * Generate structured JSON from a prompt.
 * Uses Gemini's responseSchema feature for guaranteed JSON output.
 */
async function generateJson({
  prompt,
  systemInstruction = null,
  schema = null,
  temperature = 0.1,
  modelName = DEFAULT_MODEL,
  imageUrls = [],
}) {
  const modelConfig = {
    model: modelName,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: schema } : {}),
    },
  };
  if (systemInstruction) modelConfig.systemInstruction = systemInstruction;

  const model = genAI.getGenerativeModel(modelConfig);

  const parts = [{ text: prompt }];

  // If photos passed, fetch + embed as inlineData
  for (const url of imageUrls.slice(0, 5)) { // cap at 5 photos per call
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get('content-type') || 'image/jpeg';
      parts.push({
        inlineData: { data: buf.toString('base64'), mimeType },
      });
    } catch {}
  }

  const result = await model.generateContent(parts);
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

module.exports = { generateJson, genAI };
