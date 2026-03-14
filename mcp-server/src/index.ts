import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  process.stderr.write(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function embedQuery(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

const server = new Server(
  { name: "open-brain", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "semantic_search",
      description:
        "Search memories by semantic similarity to a query. Returns the most relevant stored thoughts and notes.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find semantically similar memories",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10)",
          },
          threshold: {
            type: "number",
            description:
              "Minimum cosine similarity threshold 0-1 (default: 0.7). Lower = more results, less precise.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_recent",
      description: "List the most recently captured memories in chronological order.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of memories to return (default: 20)",
          },
          offset: {
            type: "number",
            description: "Pagination offset (default: 0)",
          },
        },
      },
    },
    {
      name: "capture",
      description:
        "Save a new memory or note to the database. Embeds and extracts metadata automatically.",
      inputSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The text content to store as a memory",
          },
          source: {
            type: "string",
            description: "Optional source label (default: 'claude-desktop')",
          },
        },
        required: ["content"],
      },
    },
    {
      name: "get_stats",
      description:
        "Get statistics about the memory database: total count, date range, top topics, and action item counts.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "household_add",
      description:
        "Add or update a piece of household knowledge. Use this to record facts like paint colors, appliance models, warranty dates, kids' shoe sizes, Wi-Fi passwords, service history, etc.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Category of knowledge, e.g. 'paint', 'appliance', 'vehicle', 'kids', 'network', 'contacts', 'home'",
          },
          item: {
            type: "string",
            description: "The specific item, e.g. 'Living Room', 'Dishwasher', 'Honda CRV', 'Emma'",
          },
          key: {
            type: "string",
            description: "The attribute name, e.g. 'color', 'model', 'last_service', 'shoe_size', 'wifi_password'",
          },
          value: {
            type: "string",
            description: "The value, e.g. 'Benjamin Moore Hail Navy', 'Bosch SHX78', '2024-11-15', '5Y'",
          },
          notes: {
            type: "string",
            description: "Any extra context or notes (optional)",
          },
        },
        required: ["category", "item", "key", "value"],
      },
    },
    {
      name: "household_search",
      description:
        "Search household knowledge by category, item, or key. All parameters are optional — omit to return everything.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter by category (optional)",
          },
          item: {
            type: "string",
            description: "Filter by item name (optional)",
          },
          key: {
            type: "string",
            description: "Filter by key/attribute name (optional)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 50)",
          },
        },
      },
    },
    {
      name: "household_list",
      description:
        "List all household knowledge entries, optionally filtered by category. Returns a summary grouped by category and item.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter by category (optional)",
          },
        },
      },
    },
    {
      name: "household_update",
      description:
        "Update the value or notes for an existing household knowledge entry by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The UUID of the entry to update",
          },
          value: {
            type: "string",
            description: "New value (optional)",
          },
          notes: {
            type: "string",
            description: "New notes (optional)",
          },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "capture") {
    const content = args?.content as string;
    const source = (args?.source as string) ?? "claude-desktop";

    if (!content) {
      return {
        content: [{ type: "text", text: "Error: content is required" }],
        isError: true,
      };
    }

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ content, source }),
      }
    );

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Error: ${JSON.stringify(data)}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Memory saved! ID: ${data.id}` }],
    };
  }

  if (name === "semantic_search") {
    const query = args?.query as string;
    const limit = (args?.limit as number) ?? 10;
    const threshold = (args?.threshold as number) ?? 0.7;

    if (!query) {
      return {
        content: [{ type: "text", text: "Error: query is required" }],
        isError: true,
      };
    }

    const embedding = await embedQuery(query);

    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data ?? [], null, 2),
        },
      ],
    };
  }

  if (name === "list_recent") {
    const limit = (args?.limit as number) ?? 20;
    const offset = (args?.offset as number) ?? 0;

    const { data, error } = await supabase
      .from("memories")
      .select("id, content, metadata, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data ?? [], null, 2),
        },
      ],
    };
  }

  if (name === "get_stats") {
    const [countRes, rangeRes, memoriesRes] = await Promise.all([
      supabase.from("memories").select("id", { count: "exact", head: true }),
      supabase
        .from("memories")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1),
      supabase.from("memories").select("metadata"),
    ]);

    const total = countRes.count ?? 0;

    const oldest =
      rangeRes.data && rangeRes.data.length > 0 ? rangeRes.data[0].created_at : null;

    // Get newest separately
    const { data: newestData } = await supabase
      .from("memories")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const newest = newestData && newestData.length > 0 ? newestData[0].created_at : null;

    // Aggregate topics from metadata
    const topicCounts: Record<string, number> = {};
    let memoriesWithActionItems = 0;

    for (const row of memoriesRes.data ?? []) {
      const meta = row.metadata as Record<string, unknown>;
      const topics = meta?.topics as string[] | undefined;
      if (Array.isArray(topics)) {
        for (const t of topics) {
          topicCounts[t] = (topicCounts[t] ?? 0) + 1;
        }
      }
      const actions = meta?.action_items as unknown[] | undefined;
      if (Array.isArray(actions) && actions.length > 0) {
        memoriesWithActionItems++;
      }
    }

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    const stats = {
      total_memories: total,
      oldest_memory: oldest,
      newest_memory: newest,
      top_topics: topTopics,
      memories_with_action_items: memoriesWithActionItems,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
    };
  }

  if (name === "household_add") {
    const category = args?.category as string;
    const item = args?.item as string;
    const key = args?.key as string;
    const value = args?.value as string;
    const notes = (args?.notes as string) ?? null;

    if (!category || !item || !key || !value) {
      return {
        content: [{ type: "text", text: "Error: category, item, key, and value are required" }],
        isError: true,
      };
    }

    const { data, error } = await supabase
      .from("household_knowledge")
      .insert({ category, item, key, value, notes })
      .select("id, category, item, key, value, notes, created_at")
      .single();

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Saved! ${JSON.stringify(data, null, 2)}` }],
    };
  }

  if (name === "household_search") {
    const category = args?.category as string | undefined;
    const item = args?.item as string | undefined;
    const key = args?.key as string | undefined;
    const limit = (args?.limit as number) ?? 50;

    let query = supabase
      .from("household_knowledge")
      .select("id, category, item, key, value, notes, updated_at")
      .order("category")
      .order("item")
      .limit(limit);

    if (category) query = query.ilike("category", `%${category}%`);
    if (item) query = query.ilike("item", `%${item}%`);
    if (key) query = query.ilike("key", `%${key}%`);

    const { data, error } = await query;

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
    };
  }

  if (name === "household_list") {
    const category = args?.category as string | undefined;

    let query = supabase
      .from("household_knowledge")
      .select("id, category, item, key, value, notes, updated_at")
      .order("category")
      .order("item")
      .order("key");

    if (category) query = query.ilike("category", `%${category}%`);

    const { data, error } = await query;

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
    };
  }

  if (name === "household_update") {
    const id = args?.id as string;
    const value = args?.value as string | undefined;
    const notes = args?.notes as string | undefined;

    if (!id) {
      return {
        content: [{ type: "text", text: "Error: id is required" }],
        isError: true,
      };
    }

    if (!value && !notes) {
      return {
        content: [{ type: "text", text: "Error: at least one of value or notes must be provided" }],
        isError: true,
      };
    }

    const updates: Record<string, string> = {};
    if (value) updates.value = value;
    if (notes) updates.notes = notes;

    const { data, error } = await supabase
      .from("household_knowledge")
      .update(updates)
      .eq("id", id)
      .select("id, category, item, key, value, notes, updated_at")
      .single();

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Updated! ${JSON.stringify(data, null, 2)}` }],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Open Brain MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
