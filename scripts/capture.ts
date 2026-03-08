#!/usr/bin/env tsx
/**
 * CLI script to capture a thought into Open Brain.
 *
 * Usage:
 *   npx tsx scripts/capture.ts --content "Your thought here"
 *   echo "Your thought" | npx tsx scripts/capture.ts
 *
 * Env vars (or .env in project root):
 *   CAPTURE_URL   - Full URL of the Supabase Edge Function
 *   CAPTURE_TOKEN - Optional Bearer token if function requires auth
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// Load .env from project root
const envPath = path.resolve(import.meta.dirname ?? __dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const CAPTURE_URL = process.env.CAPTURE_URL;
const CAPTURE_TOKEN = process.env.CAPTURE_TOKEN;

if (!CAPTURE_URL) {
  console.error("Error: CAPTURE_URL env var is required.");
  console.error("Set it in .env or export it before running.");
  process.exit(1);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    const lines: string[] = [];
    rl.on("line", (line) => lines.push(line));
    rl.on("close", () => resolve(lines.join("\n")));
  });
}

async function main() {
  const args = process.argv.slice(2);

  let content: string | undefined;
  let source = "cli";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--content" || args[i] === "-c") {
      content = args[++i];
    } else if (args[i] === "--source" || args[i] === "-s") {
      source = args[++i];
    } else if (!args[i].startsWith("-")) {
      content = args[i];
    }
  }

  // Fall back to stdin if no --content arg
  if (!content) {
    if (process.stdin.isTTY) {
      console.error("Error: provide --content or pipe text via stdin.");
      console.error('Usage: npx tsx scripts/capture.ts --content "Your thought"');
      process.exit(1);
    }
    content = await readStdin();
  }

  content = content.trim();
  if (!content) {
    console.error("Error: content is empty.");
    process.exit(1);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CAPTURE_TOKEN) {
    headers["Authorization"] = `Bearer ${CAPTURE_TOKEN}`;
  }

  let res: Response;
  try {
    res = await fetch(CAPTURE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, source }),
    });
  } catch (err) {
    console.error("Network error:", err);
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`Error ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json() as { id: string; created_at: string };
  console.log(`Captured memory: ${data.id}`);
  console.log(`Timestamp:       ${data.created_at}`);
}

main();
