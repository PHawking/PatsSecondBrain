// Vercel serverless function — list, edit, delete memories and household entries
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const base = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      const { resource, page = '0' } = req.query;
      const offset = parseInt(page) * 20;

      if (resource === 'memories') {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/memories?select=id,content,metadata,created_at&order=created_at.desc&limit=20&offset=${offset}`,
          { headers: base }
        );
        const data = r.ok ? await r.json() : [];
        return res.status(200).json(data);
      }

      if (resource === 'household') {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/household_knowledge?order=category.asc,item.asc`,
          { headers: base }
        );
        const data = r.ok ? await r.json() : [];
        return res.status(200).json(data);
      }

      if (resource === 'duplicates') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_duplicate_memories`, {
          method: 'POST',
          headers: base,
          body: JSON.stringify({ similarity_threshold: 0.85, max_pairs: 30 }),
        });
        if (!r.ok) {
          const err = await r.text();
          return res.status(500).json({ error: err });
        }
        const data = await r.json();
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'Unknown resource' });
    }

    if (req.method === 'DELETE') {
      const { resource, id } = req.body || {};
      if (!resource || !id) return res.status(400).json({ error: 'resource and id required' });

      const table = resource === 'memories' ? 'memories' : 'household_knowledge';
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: base,
      });
      return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
    }

    if (req.method === 'PATCH') {
      const { resource, id, ...fields } = req.body || {};
      if (!resource || !id) return res.status(400).json({ error: 'resource and id required' });

      const table = resource === 'memories' ? 'memories' : 'household_knowledge';
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...base, 'Prefer': 'return=representation' },
        body: JSON.stringify(fields),
      });
      const data = r.ok ? await r.json() : null;
      return res.status(r.ok ? 200 : 500).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
