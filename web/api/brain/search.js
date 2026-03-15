// POST /api/brain/search
// Body: { query: string, limit?: number, threshold?: number }
// Generates embedding via OpenAI, then calls match_memories RPC in Supabase
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-api-key'] !== process.env.BRAIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { query, limit = 10, threshold = 0.5 } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    // Step 1: generate embedding
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: query, model: 'text-embedding-3-small' }),
    });
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // Step 2: call match_memories RPC
    const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/match_memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: limit,
        match_threshold: threshold,
      }),
    });
    const results = await sbRes.json();
    return res.status(sbRes.ok ? 200 : sbRes.status).json(results);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
