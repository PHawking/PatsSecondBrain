// Vercel serverless function — semantic search across memories + household knowledge
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'query is required' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    // Step 1: Generate embedding for the query
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: query.trim() }),
    });
    const embedData = await embedRes.json();
    const embedding = embedData.data[0].embedding;

    // Step 2: Semantic search on memories
    const memRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query_embedding: embedding, match_threshold: 0.4, match_count: 8 }),
    });
    const memories = memRes.ok ? await memRes.json() : [];

    // Step 3: Text search on household_knowledge
    const q = encodeURIComponent(`%${query.trim()}%`);
    const hhRes = await fetch(
      `${SUPABASE_URL}/rest/v1/household_knowledge?or=(item.ilike.${q},value.ilike.${q},category.ilike.${q},notes.ilike.${q})&order=category.asc&limit=10`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const household = hhRes.ok ? await hhRes.json() : [];

    return res.status(200).json({ memories, household });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
