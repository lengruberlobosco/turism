import Fastify from "fastify";
import PgBoss from "pg-boss";
import { createClient } from "@supabase/supabase-js";
import { makeClient } from "../../../supabase/functions/_shared/ai.ts";
import { runJob, type Deps, type JobRow } from "./jobs.ts";

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Defina DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ver .env.example).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const client = makeClient(process.env.ANTHROPIC_API_KEY);

const deps: Deps = {
  client,
  async downloadBase64(path) {
    const { data, error } = await supabase.storage.from("assets").download(path);
    if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
    return { base64: Buffer.from(await data.arrayBuffer()).toString("base64"), mime: data.type || "image/jpeg" };
  },
  async insertSuggestions(rows) {
    if (!rows.length) return;
    const { error } = await supabase.from("ai_suggestions").insert(rows.map((r) => ({ ...r, id: crypto.randomUUID(), status: "proposed", updated_at: new Date().toISOString() })));
    if (error) throw error;
  },
  async setAssetOcr(asset_id, ocr, status) {
    const { error } = await supabase.from("assets").update({ ocr, ocr_status: status, updated_at: new Date().toISOString() }).eq("id", asset_id);
    if (error) throw error;
  },
};

const boss = new PgBoss({ connectionString: DATABASE_URL, schema: "pgboss" });
await boss.start();
const QUEUE = "ai-jobs";
await boss.createQueue(QUEUE);

/** Enfileira jobs `queued` da tabela ai_jobs (a UI insere na tabela; o worker apenas observa). */
async function enqueuePending() {
  const { data } = await supabase.from("ai_jobs").select("id,trip_id,type,input").eq("status", "queued").limit(50);
  for (const j of data ?? []) {
    await supabase.from("ai_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", j.id);
    await boss.send(QUEUE, j as JobRow, { singletonKey: j.id, retryLimit: 2, retryDelay: 30, expireInMinutes: 15 });
  }
}
setInterval(() => void enqueuePending().catch((e) => console.error("enqueue", e)), 5_000);

await boss.work<JobRow>(QUEUE, { batchSize: 2 }, async (jobs) => {
  for (const job of jobs) {
    const row = job.data;
    try {
      const output = await runJob(row, deps);
      await supabase.from("ai_jobs").update({ status: "done", output, updated_at: new Date().toISOString() }).eq("id", row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`job ${row.id} (${row.type}) falhou:`, msg);
      await supabase.from("ai_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", row.id);
      throw e;
    }
  }
});

const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true, queue: QUEUE, models: { main: process.env.AI_MODEL_MAIN ?? "claude-opus-5", fast: process.env.AI_MODEL_FAST ?? "claude-haiku-4-5" } }));
await app.listen({ port: Number(process.env.PORT ?? 8787), host: "0.0.0.0" });
