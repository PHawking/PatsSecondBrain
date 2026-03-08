# Open Brain — CLAUDE.md

Persistent AI memory system using Supabase/pgvector + OpenAI embeddings, exposed via MCP.

## Architecture

```
scripts/capture.ts  -->  Supabase Edge Function (capture)
                                |
                         OpenAI Embeddings + gpt-4o-mini
                                |
                         Supabase (memories table + pgvector)
                                ^
                         mcp-server/src/index.ts  <--  Claude Desktop / Cursor
```

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/001_init.sql` | DB schema: vector extension, memories table, IVFFlat index, match_memories RPC |
| `supabase/functions/capture/index.ts` | Edge Function: receive text → embed → extract metadata → store |
| `mcp-server/src/index.ts` | MCP server with 3 tools: semantic_search, list_recent, get_stats |
| `scripts/capture.ts` | CLI to capture a thought from terminal |

## Environment Variables

### MCP Server (`mcp-server/.env` or set in Claude Desktop config)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
```

### CLI Script (`root .env`)
```
CAPTURE_URL=https://your-project.supabase.co/functions/v1/capture
CAPTURE_TOKEN=your-anon-or-service-key   # optional, if function requires auth
```

## Build Commands

```bash
# Install MCP server dependencies
cd mcp-server && npm install

# Build MCP server (compiles TypeScript → dist/index.js)
cd mcp-server && npm run build

# Run MCP server in dev mode (no build needed)
cd mcp-server && npm run dev

# Capture a thought via CLI
npx tsx scripts/capture.ts --content "Your thought here"
echo "Piped thought" | npx tsx scripts/capture.ts
```

## Supabase Setup Commands

```bash
# Link to your project (run once)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push

# Deploy the edge function
supabase functions deploy capture

# Set secrets for the edge function
supabase secrets set OPENAI_API_KEY=sk-...
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `semantic_search` | Embed query → cosine similarity search via pgvector |
| `list_recent` | Paginated list of memories by recency |
| `get_stats` | Total count, date range, top topics, action item count |

## Database Schema

```sql
memories (
  id          uuid        PK default gen_random_uuid(),
  content     text        NOT NULL,
  embedding   vector(1536),             -- text-embedding-3-small
  metadata    jsonb       default '{}', -- entities, topics, action_items, summary, source
  created_at  timestamptz default now()
)
```

### Metadata shape
```json
{
  "entities": ["Pat", "Anthropic"],
  "topics": ["AI", "memory", "MCP"],
  "action_items": ["Research pgvector limits"],
  "summary": "One-sentence digest",
  "source": "cli"
}
```
