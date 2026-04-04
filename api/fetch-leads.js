// Fetch customer leads from LEONES
// GET /api/fetch-leads

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const leonisUrl = process.env.LEONIS_INGEST_URL;
  const secret = process.env.SECPRO_INGEST_SECRET;

  if (!leonisUrl || !secret) {
    return res.status(500).json({ error: 'LEONIS integration not configured' });
  }

  // Derive the leads URL from the ingest URL (same domain)
  const baseUrl = leonisUrl.replace(/\/api\/ingest\/?$/, '');
  const leadsUrl = `${baseUrl}/api/leads`;

  try {
    const status = req.query.status || 'NEW';
    const limit = req.query.limit || 50;

    const response = await fetch(`${leadsUrl}?status=${status}&limit=${limit}`, {
      headers: {
        'x-secpro-secret': secret,
      },
    });

    if (!response.ok) {
      throw new Error(`LEONES API error: ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[fetch-leads] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
