// POST /api/brain/capture
// Body: { content: string }
// Proxies to Supabase edge function (same as /api/capture but with API key auth)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-api-key'] !== process.env.BRAIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const captureUrl = process.env.CAPTURE_URL;
  if (!captureUrl) return res.status(500).json({ error: 'CAPTURE_URL not configured' });

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.CAPTURE_TOKEN) headers['x-capture-token'] = process.env.CAPTURE_TOKEN;

    const upstream = await fetch(captureUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
