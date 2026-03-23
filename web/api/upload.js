// Vercel serverless function — file ingestion (PDF/TXT/DOCX → chunk → embed → store)
import mammoth from 'mammoth';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const body = req.body;
  if (!body || !body.type || !body.filename) {
    return res.status(400).json({ error: 'Missing type or filename' });
  }

  let text;
  try {
    if (body.type === 'text' || body.type === 'pdf') {
      text = body.text;
    } else if (body.type === 'docx') {
      const buffer = Buffer.from(body.data, 'base64');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }
  } catch (err) {
    return res.status(422).json({ error: `Text extraction failed: ${err.message}` });
  }

  if (!text || !text.trim()) {
    return res.status(422).json({ error: 'No text found in file. Scanned PDFs (image-only) are not supported.' });
  }

  const filename = body.filename;

  // ── Step 1: Document-level summary via gpt-4o-mini ──
  let docSummary = '';
  try {
    const summaryRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize this document in 2-3 sentences. Focus on the main topic, key points, and any action items. Be concise.' },
          { role: 'user', content: text.slice(0, 6000) },
        ],
        temperature: 0,
        max_tokens: 300,
      }),
    });
    const summaryData = await summaryRes.json();
    docSummary = summaryData.choices?.[0]?.message?.content || '';
  } catch (_) {
    docSummary = `Document: ${filename}`;
  }

  // ── Step 2: Chunk the text ──
  const chunks = chunkText(text, 500, 50);
  if (chunks.length === 0) {
    return res.status(422).json({ error: 'File produced no usable text chunks.' });
  }

  // ── Step 3: Batch embed summary + all chunks in one API call ──
  const inputs = [`[Summary of ${filename}] ${docSummary}`, ...chunks];
  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: inputs }),
  });
  if (!embedRes.ok) {
    const err = await embedRes.json();
    return res.status(502).json({ error: `Embedding failed: ${err.error?.message || embedRes.status}` });
  }
  const embedData = await embedRes.json();
  const embeddings = embedData.data.map(d => d.embedding);

  // ── Step 4: Build records ──
  const totalChunks = chunks.length;
  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  const summaryRecord = {
    content: `[Summary of ${filename}] ${docSummary}`,
    embedding: `[${embeddings[0].join(',')}]`,
    metadata: { source: 'file-summary', filename, totalChunks },
  };

  const chunkRecords = chunks.map((chunk, i) => ({
    content: chunk,
    embedding: `[${embeddings[i + 1].join(',')}]`,
    metadata: { source: 'file', filename, chunk: i + 1, totalChunks },
  }));

  // ── Step 5: Insert all records in parallel ──
  const allRecords = [summaryRecord, ...chunkRecords];
  const insertResults = await Promise.all(
    allRecords.map(record =>
      fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(record),
      })
    )
  );

  const failed = insertResults.filter(r => !r.ok).length;
  if (failed > 0) {
    return res.status(502).json({ error: `${failed} of ${allRecords.length} records failed to insert.` });
  }

  return res.status(200).json({
    ok: true,
    filename,
    chunks: totalChunks,
    inserted: allRecords.length,
    summary: docSummary,
  });
}

// Paragraph-aware chunking: ~targetWords per chunk, overlapWords carried forward
function chunkText(text, targetWords = 500, overlapWords = 50) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  const chunks = [];
  let current = [];
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    wordCount += words.length;
    current.push(para);

    if (wordCount >= targetWords) {
      chunks.push(current.join('\n\n'));
      // Carry last paragraph(s) as overlap for the next chunk
      const overlap = [];
      let overlapCount = 0;
      for (let i = current.length - 1; i >= 0 && overlapCount < overlapWords; i--) {
        const w = current[i].split(/\s+/).length;
        overlap.unshift(current[i]);
        overlapCount += w;
      }
      current = overlap;
      wordCount = overlapCount;
    }
  }

  if (current.length > 0 && current.join(' ').trim().length > 20) {
    chunks.push(current.join('\n\n'));
  }

  return chunks;
}
