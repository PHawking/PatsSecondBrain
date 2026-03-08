import OpenAI from "openai";

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const METADATA_PROMPT = `You are a knowledge extraction assistant. Given a note or thought, extract structured metadata.
Return ONLY valid JSON with this exact shape:
{
  "entities": ["list of people, places, organizations mentioned"],
  "topics": ["list of topic tags (2-6 words, lowercase, relevant)"],
  "action_items": ["list of action items or TODOs found, if any"],
  "summary": "one sentence digest of the content"
}
If a field has no values, use an empty array or empty string.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { content: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { content, source = "api" } = body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return new Response(JSON.stringify({ error: "content is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Step 1: Generate embedding
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: content.trim(),
  });
  const embedding = embeddingRes.data[0].embedding;

  // Step 2: Extract metadata via LLM
  const metaRes = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: METADATA_PROMPT },
      { role: "user", content: content.trim() },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  let metadata: Record<string, unknown>;
  try {
    metadata = JSON.parse(metaRes.choices[0].message.content ?? "{}");
  } catch {
    metadata = {};
  }
  metadata.source = source;

  // Step 3: Insert into Supabase
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      content: content.trim(),
      embedding: `[${embedding.join(",")}]`,
      metadata,
    }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    return new Response(JSON.stringify({ error: "DB insert failed", detail: err }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [row] = await insertRes.json();
  return new Response(
    JSON.stringify({ id: row.id, created_at: row.created_at }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
});
