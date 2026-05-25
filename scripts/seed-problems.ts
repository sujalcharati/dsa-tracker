// Seeds the `problems` table from data/striver-a2z.json using the Supabase
// service-role key. Re-runnable: upsert keyed on `id`, so editing the JSON and
// re-running picks up changes. Run via `npm run seed:problems` (loads
// .env.local via Node's --env-file flag).

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import WebSocket from "ws";

type ProblemSeed = {
  id: number;
  sheet_order: number;
  title: string;
  topic: string;
  subtopic: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  link: string | null;
  tags: string[];
};

const DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);

function assertValid(row: unknown, idx: number): asserts row is ProblemSeed {
  const r = row as Partial<ProblemSeed>;
  if (typeof r.id !== "number" || !Number.isInteger(r.id)) {
    throw new Error(`row ${idx}: id must be an integer`);
  }
  if (typeof r.sheet_order !== "number" || !Number.isInteger(r.sheet_order)) {
    throw new Error(`row ${idx} (id=${r.id}): sheet_order must be an integer`);
  }
  if (typeof r.title !== "string" || r.title.length === 0) {
    throw new Error(`row ${idx} (id=${r.id}): title must be a non-empty string`);
  }
  if (typeof r.topic !== "string" || r.topic.length === 0) {
    throw new Error(`row ${idx} (id=${r.id}): topic must be a non-empty string`);
  }
  if (r.subtopic !== null && typeof r.subtopic !== "string") {
    throw new Error(`row ${idx} (id=${r.id}): subtopic must be a string or null`);
  }
  if (typeof r.difficulty !== "string" || !DIFFICULTIES.has(r.difficulty)) {
    throw new Error(
      `row ${idx} (id=${r.id}): difficulty must be Easy|Medium|Hard, got ${r.difficulty}`,
    );
  }
  if (r.link !== null && typeof r.link !== "string") {
    throw new Error(`row ${idx} (id=${r.id}): link must be a string or null`);
  }
  if (!Array.isArray(r.tags) || !r.tags.every((t) => typeof t === "string")) {
    throw new Error(`row ${idx} (id=${r.id}): tags must be an array of strings`);
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.error("Run via `npm run seed:problems` so .env.local is loaded.");
  process.exit(1);
}

// Service role bypasses RLS. Never expose this client to the browser.
// `realtime.transport` is required because supabase-js's constructor always
// builds a RealtimeClient, and Node 20 has no global WebSocket.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

const CHUNK_SIZE = 100;

async function main() {
  const filePath = resolve(process.cwd(), "data/striver-a2z.json");
  const raw = await readFile(filePath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("seed file must contain a top-level JSON array");
  }
  parsed.forEach((row, i) => assertValid(row, i));
  const rows = parsed as ProblemSeed[];

  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("duplicate ids found in seed JSON");
  }

  console.log(`Validated ${rows.length} rows. Upserting in chunks of ${CHUNK_SIZE}...`);

  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from("problems")
      .upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`Chunk at index ${i} failed: ${error.message}`);
      process.exit(1);
    }
    done += chunk.length;
    console.log(`  ${done}/${rows.length}`);
  }

  console.log(`Done. Upserted ${done} problems.`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Seed failed: ${msg}`);
  process.exit(1);
});
