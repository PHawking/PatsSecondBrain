// POST /api/brain/work-add
// Body: { category, item, key, value, notes? }
// Inserts a new work knowledge entry
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-api-key'] !== process.env.BRAIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { category, item, key, value, notes } = req.body;
  if (!category || !item || !key || !value) {
    return res.status(400).json({ error: 'category, item, key, and value are required' });
  }

  try {
    const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/work_knowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ category, item, key, value, notes }),
    });
    const data = await sbRes.json();
    return res.status(sbRes.ok ? 201 : sbRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
