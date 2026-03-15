// GET /api/brain/household-search?category=paint&item=Living+Room&key=color
// All query params are optional — omit to return all entries
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-api-key'] !== process.env.BRAIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { category, item, key, limit = '50' } = req.query;
  const params = new URLSearchParams({
    select: 'id,category,item,key,value,notes,updated_at',
    order: 'category.asc,item.asc',
    limit: String(Math.min(parseInt(limit), 100)),
  });
  if (category) params.append('category', `eq.${category}`);
  if (item) params.append('item', `eq.${item}`);
  if (key) params.append('key', `eq.${key}`);

  try {
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/household_knowledge?${params}`,
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
