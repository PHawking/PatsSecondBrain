// GET /api/brain/recent?limit=10&offset=0
// Returns most recent memories ordered by created_at DESC
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-api-key'] !== process.env.BRAIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/memories?select=id,content,metadata,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const data = await sbRes.json();
    return res.status(sbRes.ok ? 200 : sbRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
