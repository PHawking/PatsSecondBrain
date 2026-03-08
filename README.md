# Open Brain

A private, persistent memory database for thoughts and notes. Any AI agent can query it via MCP (Model Context Protocol).

Captures raw text → enriches with OpenAI embeddings and LLM-extracted metadata → stores in Supabase/pgvector → exposes through a typed MCP server.

## Prerequisites

- [Supabase](https://supabase.com) project with pgvector enabled
- OpenAI API key
- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations + edge function deploy)

## Setup

### 1. Run the database migration

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste `supabase/migrations/001_init.sql` directly into the Supabase SQL editor.

### 2. Deploy the Edge Function

```bash
# Set required secrets
supabase secrets set OPENAI_API_KEY=sk-...

# Deploy
supabase functions deploy capture
```

### 3. Build the MCP server

```bash
cd mcp-server
npm install
npm run build
```

### 4. Configure environment

Copy `.env.example` and fill in your values:

```bash
cp mcp-server/.env.example mcp-server/.env
```

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
```

For the CLI capture script, create a `.env` in the project root:

```
CAPTURE_URL=https://your-project.supabase.co/functions/v1/capture
CAPTURE_TOKEN=your-anon-key   # optional
```

## Capturing a Thought

```bash
# Inline
npx tsx scripts/capture.ts --content "Idea: use pgvector for long-term AI memory"

# From stdin
echo "Follow up with team about MCP integration" | npx tsx scripts/capture.ts

# With source tag
npx tsx scripts/capture.ts --content "Note from meeting" --source "meeting"
```

Output:
```
Captured memory: 3f2a1b4c-...
Timestamp:       2025-01-15T10:32:00Z
```

## Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["D:/Claude_Code/PatsSecondBrain/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-role-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

Restart Claude Desktop. The following tools will be available:

| Tool | What it does |
|------|-------------|
| `semantic_search` | Find memories by meaning/similarity |
| `list_recent` | Browse most recent captures |
| `get_stats` | Overview: counts, topics, date range |

## Cursor Integration

Add to `.cursor/mcp.json` in your project or globally in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["D:/Claude_Code/PatsSecondBrain/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-role-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

## Architecture

```
CLI / any client
      |
      v
Supabase Edge Function (capture)
  - Generates embedding via text-embedding-3-small
  - Extracts metadata via gpt-4o-mini
  - Stores in memories table
      |
      v
Supabase Postgres + pgvector
      ^
      |
MCP Server (stdio)
  - semantic_search  → match_memories() RPC (cosine similarity)
  - list_recent      → SELECT ... ORDER BY created_at DESC
  - get_stats        → aggregate queries
      ^
      |
Claude Desktop / Cursor
```

## Verification Checklist

- [ ] SQL migration applied (check Supabase table editor for `memories` table)
- [ ] Edge function deployed and returning 201 on POST
- [ ] `npx tsx scripts/capture.ts --content "Test thought"` prints a UUID
- [ ] Row visible in Supabase dashboard
- [ ] `cd mcp-server && npm run build` succeeds
- [ ] MCP config added to Claude Desktop, app restarted
- [ ] `semantic_search` returns results with similarity scores
