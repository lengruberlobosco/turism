import { db, type OutboxItem } from "@/db/schema";
import { supabase } from "@/lib/supabase";
import { getKV, setKV } from "@/db/repo";

/**
 * Motor de sincronização (docs/01 §3.3): empurra a fila de saída e puxa alterações por `updated_at`.
 * Last-writer-wins por linha, soft delete propagado. Só roda se houver backend configurado e sessão.
 */
const TABLES = ["trips", "trip_days", "activities", "assets", "asset_days", "expenses", "ai_suggestions", "travelers", "checklist_items"] as const;
type SyncTable = (typeof TABLES)[number];

export interface SyncStatus {
  pending: number;
  lastSyncAt: string | null;
  running: boolean;
  error: string | null;
}

let running = false;
const listeners = new Set<(s: SyncStatus) => void>();
let lastError: string | null = null;

async function status(): Promise<SyncStatus> {
  return { pending: await db.outbox.count(), lastSyncAt: (await getKV<string>("sync:last")) ?? null, running, error: lastError };
}
async function emit() {
  const s = await status();
  listeners.forEach((l) => l(s));
}
export function onSyncStatus(l: (s: SyncStatus) => void) {
  listeners.add(l);
  void status().then(l);
  return () => {
    listeners.delete(l);
  };
}

async function pushOutbox() {
  if (!supabase) return;
  const items = await db.outbox.orderBy("created_at").limit(200).toArray();
  // agrupa por tabela e envia o estado mais recente de cada linha
  const byTable = new Map<SyncTable, Map<string, OutboxItem>>();
  for (const it of items) {
    const m = byTable.get(it.table as SyncTable) ?? new Map();
    m.set(it.row_id, it);
    byTable.set(it.table as SyncTable, m);
  }
  for (const [table, rows] of byTable) {
    const payloads = Array.from(rows.values()).map((r) => r.payload as Record<string, unknown>);
    const { error } = await supabase.from(table).upsert(payloads, { onConflict: "id" });
    if (error) {
      lastError = `${table}: ${error.message}`;
      for (const r of rows.values()) await db.outbox.update(r.id!, { attempts: r.attempts + 1, last_error: error.message });
      continue;
    }
    await db.outbox.bulkDelete(items.filter((i) => i.table === table).map((i) => i.id!));
  }
}

async function pushBlobs() {
  if (!supabase) return;
  const pending = await db.assets.filter((a) => !a.storage_path && a.kind !== "link" && !a.deleted_at).limit(20).toArray();
  for (const a of pending) {
    const b = await db.asset_blobs.get(a.id);
    if (!b) continue;
    const path = `${a.trip_id}/${a.id}`;
    const { error } = await supabase.storage.from("assets").upload(path, b.blob, { contentType: a.mime ?? undefined, upsert: true });
    if (error) {
      lastError = `upload ${a.title}: ${error.message}`;
      continue;
    }
    await db.assets.update(a.id, { storage_path: path });
    await supabase.from("assets").update({ storage_path: path }).eq("id", a.id);
  }
}

async function pullChanges() {
  if (!supabase) return;
  const since = (await getKV<string>("sync:cursor")) ?? "1970-01-01T00:00:00Z";
  let maxSeen = since;
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*").gt("updated_at", since).order("updated_at").limit(1000);
    if (error) {
      lastError = `${table}: ${error.message}`;
      continue;
    }
    for (const row of data ?? []) {
      const local = await db.table(table).get(row.id);
      if (!local || local.updated_at < row.updated_at) await db.table(table).put(row);
      if (row.updated_at > maxSeen) maxSeen = row.updated_at;
    }
  }
  await setKV("sync:cursor", maxSeen);
}

/** Baixa para o cache local os arquivos de uma viagem que ainda não estão no dispositivo ("Preparar para offline"). */
export async function pullBlobsForTrip(trip_id: string, onProgress?: (done: number, total: number) => void) {
  if (!supabase) return;
  const assets = (await db.assets.where("trip_id").equals(trip_id).toArray()).filter((a) => a.storage_path && !a.deleted_at);
  const missing: typeof assets = [];
  for (const a of assets) if (!(await db.asset_blobs.get(a.id))) missing.push(a);
  missing.sort((a, b) => Number(b.critical) - Number(a.critical));
  let done = 0;
  for (const a of missing) {
    const { data, error } = await supabase.storage.from("assets").download(a.storage_path!);
    if (!error && data) await db.asset_blobs.put({ asset_id: a.id, blob: data });
    onProgress?.(++done, missing.length);
  }
}

export async function syncNow(): Promise<SyncStatus> {
  if (!supabase || running || !navigator.onLine) return status();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return status();
  running = true;
  lastError = null;
  await emit();
  try {
    await pushOutbox();
    await pushBlobs();
    await pullChanges();
    await setKV("sync:last", new Date().toISOString());
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  } finally {
    running = false;
    await emit();
  }
  return status();
}

let timer: number | undefined;
export function startAutoSync(intervalMs = 60_000) {
  if (!supabase) return;
  void syncNow();
  window.addEventListener("online", () => void syncNow());
  timer = window.setInterval(() => void syncNow(), intervalMs);
  db.outbox.hook("creating", () => {
    void emit();
  });
  return () => window.clearInterval(timer);
}
