import { db } from "./schema";
import {
  uuidv7, dateRange, pickRate, toBase,
  CHECKLIST_TEMPLATES,
  type Trip, type TripDay, type Activity, type Asset, type AssetDay, type Expense, type OcrResult, type AiSuggestion, type ParsedItinerary,
  type TravelerRow, type ChecklistItem, type ChecklistKind,
} from "@turism/domain";

const nowIso = () => new Date().toISOString();
const SYNC_TABLES = ["trips", "trip_days", "activities", "assets", "asset_days", "expenses", "ai_suggestions", "travelers", "checklist_items"] as const;
type SyncTable = (typeof SYNC_TABLES)[number];

/** Escreve localmente e enfileira para sync. Toda escrita passa por aqui. */
async function put<T extends { id: string; updated_at: string }>(table: SyncTable, row: T): Promise<T> {
  await db.transaction("rw", db.table(table), db.outbox, async () => {
    await db.table(table).put(row);
    await db.outbox.add({ table, row_id: row.id, op: "upsert", payload: row, created_at: nowIso(), attempts: 0 });
  });
  return row;
}

async function softDelete(table: SyncTable, id: string) {
  const row = await db.table(table).get(id);
  if (!row) return;
  await put(table, { ...row, deleted_at: nowIso(), updated_at: nowIso() });
}

export const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";

// ---------- Viagens e dias ----------

export async function createTrip(input: { title: string; start_date: string | null; end_date: string | null; base_currency: string; timezone?: string }): Promise<Trip> {
  const ts = nowIso();
  const trip: Trip = {
    id: uuidv7(), title: input.title.trim(), start_date: input.start_date, end_date: input.end_date,
    base_currency: input.base_currency, status: "planning", cover_asset_id: null, created_at: ts, updated_at: ts, deleted_at: null,
  };
  await put("trips", trip);
  const tz = input.timezone ?? defaultTimezone();
  if (trip.start_date && trip.end_date) {
    const dates = dateRange(trip.start_date, trip.end_date);
    for (let i = 0; i < dates.length; i++) await addDay(trip.id, i + 1, dates[i]!, tz);
  } else {
    await addDay(trip.id, 1, null, tz);
  }
  return trip;
}

export async function updateTrip(id: string, patch: Partial<Trip>) {
  const t = await db.trips.get(id);
  if (!t) return;
  await put("trips", { ...t, ...patch, updated_at: nowIso() });
}

export async function deleteTrip(id: string) {
  await softDelete("trips", id);
}

export async function addDay(trip_id: string, day_index: number, date: string | null, timezone: string, extra: Partial<TripDay> = {}): Promise<TripDay> {
  const day: TripDay = {
    id: uuidv7(), trip_id, day_index, date, timezone, title: null, narrative: null, logistics_notes: null,
    expected_km: null, expected_travel_min: null, updated_at: nowIso(), deleted_at: null, ...extra,
  };
  return put("trip_days", day);
}

/** Acrescenta um dia ao final da viagem (data = último dia + 1). */
export async function appendDay(trip_id: string): Promise<TripDay> {
  const days = await listDays(trip_id);
  const last = days[days.length - 1];
  const { addDays } = await import("@turism/domain");
  return addDay(trip_id, (last?.day_index ?? 0) + 1, last?.date ? addDays(last.date, 1) : null, last?.timezone ?? defaultTimezone());
}

export async function updateDay(id: string, patch: Partial<TripDay>) {
  const d = await db.trip_days.get(id);
  if (!d) return;
  await put("trip_days", { ...d, ...patch, updated_at: nowIso() });
}

export async function deleteDay(id: string) {
  const d = await db.trip_days.get(id);
  if (!d) return;
  await softDelete("trip_days", id);
  // renumera os seguintes
  const rest = (await listDays(d.trip_id)).filter((x) => x.day_index > d.day_index);
  for (const r of rest) await put("trip_days", { ...r, day_index: r.day_index - 1, updated_at: nowIso() });
}

export async function listDays(trip_id: string): Promise<TripDay[]> {
  const days = await db.trip_days.where("trip_id").equals(trip_id).toArray();
  return days.filter((d) => !d.deleted_at).sort((a, b) => a.day_index - b.day_index);
}

// ---------- Atividades ----------

export async function addActivity(day: TripDay, input: Partial<Activity> & { title: string }): Promise<Activity> {
  const existing = await db.activities.where("day_id").equals(day.id).toArray();
  const maxPos = existing.reduce((m, a) => Math.max(m, a.position), 0);
  const a: Activity = {
    id: uuidv7(), trip_id: day.trip_id, day_id: day.id, position: maxPos + 1, type: "other", start_time: null, end_time: null,
    place_name: null, lat: null, lng: null, notes: null, status: "planned", updated_at: nowIso(), deleted_at: null, ...input,
  };
  return put("activities", a);
}

export async function updateActivity(id: string, patch: Partial<Activity>) {
  const a = await db.activities.get(id);
  if (!a) return;
  await put("activities", { ...a, ...patch, updated_at: nowIso() });
}

export async function deleteActivity(id: string) {
  await softDelete("activities", id);
}

/** Move a atividade para entre `before` e `after` usando posição fracionária (sem reordenar as demais). */
export async function moveActivity(id: string, before: Activity | null, after: Activity | null) {
  const lo = before?.position ?? 0;
  const hi = after?.position ?? lo + 2;
  await updateActivity(id, { position: (lo + hi) / 2 });
}

// ---------- Documentos / mídia / links ----------

async function sha256(blob: Blob): Promise<string | null> {
  try {
    const buf = await blob.arrayBuffer();
    const h = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

async function makeThumb(blob: Blob): Promise<Blob | undefined> {
  if (!blob.type.startsWith("image/") || typeof createImageBitmap !== "function") return undefined;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? undefined), "image/webp", 0.75));
  } catch {
    return undefined;
  }
}

/** Reduz fotos grandes no cliente (máx. 2048px, WebP) antes de guardar. */
export async function compressImage(file: Blob, max = 2048): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    if (Math.max(bmp.width, bmp.height) <= max && file.size < 1_500_000) return file;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
    return out ?? file;
  } catch {
    return file;
  }
}

export async function addFileAsset(
  trip_id: string,
  file: File | Blob,
  input: { title: string; category: string; kind?: Asset["kind"]; critical?: boolean; sensitive?: boolean; day_ids?: string[]; captured_at?: string | null; expires_at?: string | null },
): Promise<Asset> {
  const mime = file.type || "application/octet-stream";
  const kind: Asset["kind"] = input.kind ?? (mime.startsWith("image/") ? "photo" : mime.startsWith("audio/") ? "audio" : "document");
  const blob = kind === "photo" ? await compressImage(file) : file;
  const asset: Asset = {
    id: uuidv7(), trip_id, kind, category: input.category, title: input.title, storage_path: null, url: null, mime: blob.type || mime,
    size_bytes: blob.size, sha256: await sha256(blob), sensitive: input.sensitive ?? false, critical: input.critical ?? false,
    ocr: null, ocr_status: "none", captured_at: input.captured_at ?? nowIso(), expires_at: input.expires_at ?? null, attribution: null, updated_at: nowIso(), deleted_at: null,
  };
  const thumb = await makeThumb(blob);
  await db.transaction("rw", db.assets, db.asset_blobs, db.asset_days, db.outbox, async () => {
    await put("assets", asset);
    await db.asset_blobs.put({ asset_id: asset.id, blob, thumb });
    for (const day_id of input.day_ids ?? []) await linkAssetToDay(asset, day_id);
  });
  return asset;
}

export async function addLinkAsset(trip_id: string, input: { title: string; url: string; category: string; day_ids?: string[]; critical?: boolean }): Promise<Asset> {
  const asset: Asset = {
    id: uuidv7(), trip_id, kind: "link", category: input.category, title: input.title, storage_path: null, url: input.url, mime: null,
    size_bytes: null, sha256: null, sensitive: false, critical: input.critical ?? false, ocr: null, ocr_status: "none",
    captured_at: nowIso(), attribution: null, updated_at: nowIso(), deleted_at: null,
  };
  await put("assets", asset);
  for (const day_id of input.day_ids ?? []) await linkAssetToDay(asset, day_id);
  return asset;
}

export async function updateAsset(id: string, patch: Partial<Asset>) {
  const a = await db.assets.get(id);
  if (!a) return;
  await put("assets", { ...a, ...patch, updated_at: nowIso() });
}

export async function deleteAsset(id: string) {
  await softDelete("assets", id);
  await db.asset_blobs.delete(id);
  const links = await db.asset_days.where("asset_id").equals(id).toArray();
  for (const l of links) await softDelete("asset_days", l.id);
}

export async function linkAssetToDay(asset: Asset, day_id: string, priority = 0): Promise<AssetDay> {
  const link: AssetDay = { id: `${asset.id}:${day_id}`, asset_id: asset.id, day_id, trip_id: asset.trip_id, priority, updated_at: nowIso(), deleted_at: null };
  return put("asset_days", link);
}

export async function unlinkAssetFromDay(asset_id: string, day_id: string) {
  await softDelete("asset_days", `${asset_id}:${day_id}`);
}

export async function setAssetPriority(asset_id: string, day_id: string, priority: number) {
  const l = await db.asset_days.get(`${asset_id}:${day_id}`);
  if (!l) return;
  await put("asset_days", { ...l, priority, updated_at: nowIso() });
}

export async function setAssetOcr(asset_id: string, ocr: OcrResult | null, status: Asset["ocr_status"]) {
  await updateAsset(asset_id, { ocr, ocr_status: status });
}

/** Documentos "acesos" para um dia: prioridade desc, críticos primeiro, depois categoria/título. */
export async function assetsForDay(day_id: string): Promise<Array<Asset & { priority: number }>> {
  const links = (await db.asset_days.where("day_id").equals(day_id).toArray()).filter((l) => !l.deleted_at);
  const assets = await db.assets.bulkGet(links.map((l) => l.asset_id));
  const out: Array<Asset & { priority: number }> = [];
  links.forEach((l, i) => {
    const a = assets[i];
    if (a && !a.deleted_at) out.push({ ...a, priority: l.priority });
  });
  return out.sort((a, b) => b.priority - a.priority || Number(b.critical) - Number(a.critical) || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

// ---------- Gastos e câmbio ----------

export async function ratesFor(base: string, quote: string) {
  return db.fx_rates.where("[base+quote]").equals([base, quote]).toArray();
}

export interface ExpenseInput {
  trip_id: string;
  day_id: string | null;
  category: string;
  amount: number;
  currency: string;
  merchant?: string | null;
  notes?: string | null;
  payment_method?: string | null;
  receipt_asset_id?: string | null;
  paid_by?: string | null;
  split?: Record<string, number> | null;
  source?: Expense["source"];
  ocr_confidence?: number | null;
  spent_at?: string;
  fx_rate?: number; // permite informar taxa manual
}

export async function addExpense(input: ExpenseInput, base_currency: string): Promise<Expense> {
  const spent_at = input.spent_at ?? nowIso();
  const date = spent_at.slice(0, 10);
  let rate = input.fx_rate ?? null;
  let rate_date = date;
  if (rate == null) {
    const picked = pickRate(await ratesFor(base_currency, input.currency), base_currency, input.currency, date);
    rate = picked?.rate ?? (input.currency === base_currency ? 1 : null);
    rate_date = picked?.date ?? date;
  }
  if (rate == null) throw new Error(`Sem taxa de câmbio ${input.currency}→${base_currency}. Conecte-se para atualizar o câmbio ou informe a taxa manualmente.`);
  const e: Expense = {
    id: uuidv7(), trip_id: input.trip_id, day_id: input.day_id, category: input.category, amount: input.amount, currency: input.currency,
    fx_rate: rate, fx_rate_date: rate_date, amount_base: toBase(input.amount, rate), paid_by: input.paid_by ?? null, split: input.split ?? null, payment_method: input.payment_method ?? null,
    merchant: input.merchant ?? null, receipt_asset_id: input.receipt_asset_id ?? null, source: input.source ?? "manual",
    ocr_confidence: input.ocr_confidence ?? null, notes: input.notes ?? null, spent_at, updated_at: nowIso(), deleted_at: null,
  };
  return put("expenses", e);
}

export async function updateExpense(id: string, patch: Partial<Expense>) {
  const e = await db.expenses.get(id);
  if (!e) return;
  const merged = { ...e, ...patch, updated_at: nowIso() };
  merged.amount_base = toBase(merged.amount, merged.fx_rate);
  await put("expenses", merged);
}

export async function deleteExpense(id: string) {
  await softDelete("expenses", id);
}

// ---------- IA: sugestões e importação de roteiro ----------

export async function addSuggestion(input: Omit<AiSuggestion, "id" | "updated_at" | "status">): Promise<AiSuggestion> {
  return put("ai_suggestions", { ...input, id: uuidv7(), status: "proposed", updated_at: nowIso() });
}

export async function setSuggestionStatus(id: string, status: AiSuggestion["status"]) {
  const s = await db.ai_suggestions.get(id);
  if (!s) return;
  await put("ai_suggestions", { ...s, status, updated_at: nowIso() });
}

/** Cria (ou completa) uma viagem a partir de um roteiro estruturado — resultado do parser local ou da IA. */
export async function importItinerary(parsed: ParsedItinerary, opts: { trip_id?: string; base_currency?: string; timezone?: string } = {}): Promise<Trip> {
  const tz = opts.timezone ?? defaultTimezone();
  let trip: Trip;
  if (opts.trip_id) {
    trip = (await db.trips.get(opts.trip_id))!;
  } else {
    const ts = nowIso();
    const last = parsed.days[parsed.days.length - 1];
    trip = {
      id: uuidv7(), title: parsed.title, start_date: parsed.start_date, end_date: last?.date ?? parsed.start_date,
      base_currency: opts.base_currency ?? parsed.base_currency ?? "BRL", status: "planning", cover_asset_id: null, created_at: ts, updated_at: ts, deleted_at: null,
    };
    await put("trips", trip);
  }
  const existing = await listDays(trip.id);
  for (const pd of parsed.days) {
    let day = existing.find((d) => d.day_index === pd.day_index);
    if (day) {
      await updateDay(day.id, { title: pd.title, narrative: pd.narrative ?? day.narrative, date: pd.date ?? day.date });
    } else {
      day = await addDay(trip.id, pd.day_index, pd.date, tz, { title: pd.title, narrative: pd.narrative });
    }
    for (const a of pd.activities) {
      await addActivity(day, { title: a.title, type: a.type, start_time: a.start_time, end_time: a.end_time, place_name: a.place_name, notes: a.notes });
    }
  }
  return trip;
}

// ---------- Viajantes e checklists ----------

const TRAVELER_COLORS = ["#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb923c", "#22d3ee", "#facc15"];

export async function listTravelers(trip_id: string): Promise<TravelerRow[]> {
  const rows = await db.travelers.where("trip_id").equals(trip_id).toArray();
  return rows.filter((t) => !t.deleted_at).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
}

export async function addTraveler(trip_id: string, name: string): Promise<TravelerRow> {
  const n = (await listTravelers(trip_id)).length;
  return put("travelers", { id: uuidv7(), trip_id, name: name.trim(), color: TRAVELER_COLORS[n % TRAVELER_COLORS.length]!, updated_at: nowIso(), deleted_at: null });
}

export async function updateTraveler(id: string, patch: Partial<TravelerRow>) {
  const t = await db.travelers.get(id);
  if (!t) return;
  await put("travelers", { ...t, ...patch, updated_at: nowIso() });
}

export async function deleteTraveler(id: string) {
  await softDelete("travelers", id);
}

export async function listChecklist(trip_id: string, kind?: ChecklistKind, day_id?: string | null): Promise<ChecklistItem[]> {
  const rows = await db.checklist_items.where("trip_id").equals(trip_id).toArray();
  return rows
    .filter((i) => !i.deleted_at && (!kind || i.kind === kind) && (day_id === undefined || i.day_id === day_id))
    .sort((a, b) => a.position - b.position);
}

export async function addChecklistItem(trip_id: string, kind: ChecklistKind, text: string, day_id: string | null = null): Promise<ChecklistItem> {
  const existing = await listChecklist(trip_id, kind, day_id);
  const pos = (existing[existing.length - 1]?.position ?? 0) + 1;
  return put("checklist_items", { id: uuidv7(), trip_id, day_id, kind, text: text.trim(), done: false, position: pos, updated_at: nowIso(), deleted_at: null });
}

export async function toggleChecklistItem(id: string) {
  const i = await db.checklist_items.get(id);
  if (!i) return;
  await put("checklist_items", { ...i, done: !i.done, updated_at: nowIso() });
}

export async function deleteChecklistItem(id: string) {
  await softDelete("checklist_items", id);
}

/** Preenche um checklist com o template (só itens ainda inexistentes). */
export async function applyChecklistTemplate(trip_id: string, kind: Exclude<ChecklistKind, "day">): Promise<number> {
  const existing = new Set((await listChecklist(trip_id, kind, null)).map((i) => i.text.toLowerCase()));
  let n = 0;
  for (const text of CHECKLIST_TEMPLATES[kind]) {
    if (existing.has(text.toLowerCase())) continue;
    await addChecklistItem(trip_id, kind, text, null);
    n++;
  }
  return n;
}

// ---------- Utilidades ----------

export async function tripStats(trip_id: string) {
  const [days, assets, expenses] = await Promise.all([
    listDays(trip_id),
    db.assets.where("trip_id").equals(trip_id).toArray(),
    db.expenses.where("trip_id").equals(trip_id).toArray(),
  ]);
  const live = assets.filter((a) => !a.deleted_at);
  return { days: days.length, assets: live.length, bytes: live.reduce((s, a) => s + (a.size_bytes ?? 0), 0), expenses: expenses.filter((e) => !e.deleted_at).length };
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export async function setKV(key: string, value: unknown) {
  await db.kv.put({ key, value });
}
