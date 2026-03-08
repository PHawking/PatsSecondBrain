// Vercel serverless function — proxies POST to Supabase edge function.
// This keeps CAPTURE_URL server-side so it's not exposed in the HTML.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const captureUrl = process.env.CAPTURE_URL;
  if (!captureUrl) {
    return res.status(500).json({ error: 'CAPTURE_URL not configured' });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.CAPTURE_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.CAPTURE_TOKEN}`;
    }
    const upstream = await fetch(captureUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
