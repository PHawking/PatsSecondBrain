# PatsSecondBrain — Roadmap

## In Progress / Next Up

### File Drop + RAG
Drag & drop PDF, Word, or text files onto the web app to ingest them into memory.

- Drop zone on web UI → file sent to Vercel serverless function
- Extract text: `pdf-parse` (PDF), `mammoth` (Word), plain text passthrough
- **Pre-digest each chunk** via `gpt-4o-mini`: extract entities, topics, action items, summary — same pattern as the existing capture edge function
- **Document-level summary**: one LLM pass over the full doc → stored as a separate memory entry (`source: 'file-summary'`) as an index/anchor
- Chunk text (~500 words with overlap), embed via OpenAI `text-embedding-3-small`
- Store in `memories` table with metadata: `{ source: 'file', filename, chunk, totalChunks }`
- Search works automatically (already semantic)

**Known Limitations (v1):**
- Images in documents are silently dropped — embedded charts, diagrams, photos not captured
- Scanned PDFs (no text layer) will produce nothing — `pdf-parse` needs a text layer to work

**Constraints:**
- Vercel free tier: 4.5MB body limit, 10s timeout
- OpenAI embeddings: ~$0.00002/chunk (negligible)
- Pre-digestion: ~$0.001/page (gpt-4o-mini, negligible for personal use)
- Supabase: 500MB storage limit

---

## Backlog

### Image & Scanned Doc Support
Extend File Drop to handle images embedded in documents and scanned PDFs.

- **Word docs**: `mammoth` exports embedded images as base64 → vision LLM caption → embed as chunk
- **PDFs with images**: `pdfjs-dist` or `pdf2pic` to extract image bytes → vision LLM caption
- **Scanned PDFs**: OCR via Tesseract as primary extraction (replaces `pdf-parse` for image-only PDFs)
- Vision LLM cost: ~$0.01–0.02/image (GPT-4o) — acceptable for personal use
- Metadata: `{ source: 'file-image', filename, page, imageIndex }`

---

## Completed

| Feature | Date | Notes |
|---------|------|-------|
| Capture CLI | 2026-03-08 | `scripts/capture.ts` → Supabase Edge Function |
| Web capture page | 2026-03-08 | `pats-second-brain.vercel.app` |
| MCP server (search/stats) | 2026-03-08 | `semantic_search`, `list_recent`, `get_stats` |
| Household knowledge | 2026-03-14 | `household_add/search/list/update` MCP tools |
| Work knowledge | 2026-03-15 | `work_add/search/list/update` MCP tools + Custom GPT |
| Duplicate detection | 2026-03-15 | `find_duplicate_memories` SQL function |
| Teams Bot | 2026-03-18 | Built & deployed, but blocked by corporate IT policy |
