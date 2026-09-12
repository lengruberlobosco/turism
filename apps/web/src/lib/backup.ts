import { db } from "@/db/schema";
import { listDays } from "@/db/repo";

/**
 * Backup/portabilidade (docs/04 L12): ZIP com trip.json + arquivos. Usa a implementação mínima de ZIP (store, sem compressão)
 * para não depender de bibliotecas; arquivos já são PDFs/WebP comprimidos.
 */
export async function exportTripZip(trip_id: string) {
  const trip = await db.trips.get(trip_id);
  if (!trip) return;
  const [days, activities, assets, asset_days, expenses, fx_rates] = await Promise.all([
    listDays(trip_id),
    db.activities.where("trip_id").equals(trip_id).toArray(),
    db.assets.where("trip_id").equals(trip_id).toArray(),
    db.asset_days.where("trip_id").equals(trip_id).toArray(),
    db.expenses.where("trip_id").equals(trip_id).toArray(),
    db.fx_rates.toArray(),
  ]);
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  const manifest = { version: 1, exported_at: new Date().toISOString(), trip, days, activities, assets, asset_days, expenses, fx_rates: fx_rates.filter((r) => r.base === trip.base_currency) };
  entries.push({ name: "trip.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  for (const a of assets) {
    if (a.deleted_at) continue;
    const b = await db.asset_blobs.get(a.id);
    if (b) entries.push({ name: `files/${a.id}`, data: new Uint8Array(await b.blob.arrayBuffer()) });
  }
  const blob = buildZip(entries);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${trip.title.replace(/[^\w\d-]+/g, "_")}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importTripZip(file: File) {
  const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
  const manifestEntry = entries.find((e) => e.name === "trip.json");
  if (!manifestEntry) throw new Error("ZIP inválido: trip.json ausente.");
  const m = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as Awaited<ReturnType<typeof buildManifest>>;
  await db.transaction("rw", [db.trips, db.trip_days, db.activities, db.assets, db.asset_days, db.expenses, db.fx_rates, db.asset_blobs], async () => {
    await db.trips.put(m.trip);
    await db.trip_days.bulkPut(m.days);
    await db.activities.bulkPut(m.activities);
    await db.assets.bulkPut(m.assets);
    await db.asset_days.bulkPut(m.asset_days);
    await db.expenses.bulkPut(m.expenses);
    await db.fx_rates.bulkPut(m.fx_rates);
    for (const e of entries) {
      if (!e.name.startsWith("files/")) continue;
      const id = e.name.slice(6);
      const a = m.assets.find((x) => x.id === id);
      await db.asset_blobs.put({ asset_id: id, blob: new Blob([e.data.buffer.slice(e.data.byteOffset, e.data.byteOffset + e.data.byteLength) as ArrayBuffer], { type: a?.mime ?? "application/octet-stream" }) });
    }
  });
}
// tipo auxiliar para o manifesto
async function buildManifest() {
  return { trip: (await db.trips.toArray())[0]!, days: await db.trip_days.toArray(), activities: await db.activities.toArray(), assets: await db.assets.toArray(), asset_days: await db.asset_days.toArray(), expenses: await db.expenses.toArray(), fx_rates: await db.fx_rates.toArray() };
}

// ---- ZIP mínimo (método store) ----
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(d: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]!) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function buildZip(entries: Array<{ name: string; data: Uint8Array }>): Blob {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name);
    const crc = crc32(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, 0, true); local.setUint16(12, 0, true); local.setUint32(14, crc, true); local.setUint32(18, e.data.length, true); local.setUint32(22, e.data.length, true);
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, e.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true); cd.setUint16(14, 0, true); cd.setUint32(16, crc, true); cd.setUint32(20, e.data.length, true); cd.setUint32(24, e.data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + e.data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)].map((p) => p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength) as ArrayBuffer), { type: "application/zip" });
}

export async function readZip(buf: Uint8Array): Promise<Array<{ name: string; data: Uint8Array }>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = buf.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("ZIP inválido.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Array<{ name: string; data: Uint8Array }> = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP corrompido.");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    let data = buf.subarray(start, start + csize);
    if (method === 8) {
      const ds = new DecompressionStream("deflate-raw");
      data = new Uint8Array(await new Response(new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer]).stream().pipeThrough(ds)).arrayBuffer());
    } else if (method !== 0) throw new Error(`Método ZIP não suportado: ${method}`);
    out.push({ name, data });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
