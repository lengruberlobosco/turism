import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/schema";
import { createTrip, listDays, addActivity, moveActivity, addFileAsset, addLinkAsset, assetsForDay, setAssetPriority, addExpense, importItinerary, deleteDay, appendDay } from "@/db/repo";
import { parseItineraryText } from "@turism/domain";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("repo (IndexedDB local)", () => {
  it("cria viagem com um dia por data e registra na outbox", async () => {
    const trip = await createTrip({ title: "T", start_date: "2026-05-10", end_date: "2026-05-12", base_currency: "BRL", timezone: "Europe/Rome" });
    const days = await listDays(trip.id);
    expect(days.map((d) => [d.day_index, d.date, d.timezone])).toEqual([[1, "2026-05-10", "Europe/Rome"], [2, "2026-05-11", "Europe/Rome"], [3, "2026-05-12", "Europe/Rome"]]);
    expect(await db.outbox.count()).toBe(4);
  });

  it("ordena atividades por posição fracionária sem reescrever as demais", async () => {
    const trip = await createTrip({ title: "T", start_date: null, end_date: null, base_currency: "BRL" });
    const [day] = await listDays(trip.id);
    const a = await addActivity(day!, { title: "A" });
    const b = await addActivity(day!, { title: "B" });
    const c = await addActivity(day!, { title: "C" });
    await moveActivity(c.id, null, a); // C antes de A
    const rows = (await db.activities.where("day_id").equals(day!.id).toArray()).sort((x, y) => x.position - y.position);
    expect(rows.map((r) => r.title)).toEqual(["C", "A", "B"]);
    expect((await db.activities.get(b.id))!.position).toBe(b.position);
  });

  it("documentos do dia: prioridade, depois críticos, depois categoria", async () => {
    const trip = await createTrip({ title: "T", start_date: null, end_date: null, base_currency: "BRL" });
    const [day] = await listDays(trip.id);
    const pdf = new Blob(["%PDF-1.1"], { type: "application/pdf" });
    const v = await addFileAsset(trip.id, pdf, { title: "Voucher", category: "hotel_voucher", day_ids: [day!.id] });
    const t = await addFileAsset(trip.id, pdf, { title: "Trem", category: "train", critical: true, day_ids: [day!.id] });
    const l = await addLinkAsset(trip.id, { title: "Rota", url: "https://maps.example", category: "map_link", day_ids: [day!.id] });
    expect((await assetsForDay(day!.id)).map((a) => a.id)).toEqual([t.id, v.id, l.id]);
    await setAssetPriority(l.id, day!.id, 1);
    expect((await assetsForDay(day!.id)).map((a) => a.id)).toEqual([l.id, t.id, v.id]);
    expect((await db.asset_blobs.get(v.id))!.blob.size).toBe(8);
    expect(v.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gasto congela a taxa de câmbio e converte para a moeda base", async () => {
    const trip = await createTrip({ title: "T", start_date: null, end_date: null, base_currency: "BRL" });
    await db.fx_rates.put({ id: "BRL:EUR:2026-05-01", base: "BRL", quote: "EUR", date: "2026-05-01", rate: 6.2, provider: "t" });
    const e = await addExpense({ trip_id: trip.id, day_id: null, category: "food", amount: 10, currency: "EUR" }, "BRL");
    expect(e.fx_rate).toBe(6.2);
    expect(e.fx_rate_date).toBe("2026-05-01");
    expect(e.amount_base).toBe(62);
    await db.fx_rates.put({ id: "BRL:EUR:2027-01-01", base: "BRL", quote: "EUR", date: "2027-01-01", rate: 9, provider: "t" });
    expect((await db.expenses.get(e.id))!.amount_base).toBe(62);
    await expect(addExpense({ trip_id: trip.id, day_id: null, category: "food", amount: 1, currency: "JPY" }, "BRL")).rejects.toThrow(/taxa/);
  });

  it("importa roteiro estruturado em viagem nova e permite excluir/anexar dias", async () => {
    const parsed = parseItineraryText("Dia 1 - Florença\n09:40 Trem\nDia 2 - Siena\n- Almoço", { startDate: "2026-05-10" });
    const trip = await importItinerary(parsed, { base_currency: "EUR", timezone: "Europe/Rome" });
    expect(trip.end_date).toBe("2026-05-11");
    let days = await listDays(trip.id);
    expect(days.map((d) => d.title)).toEqual(["Florença", "Siena"]);
    expect(await db.activities.where("trip_id").equals(trip.id).count()).toBe(2);
    await deleteDay(days[0]!.id);
    days = await listDays(trip.id);
    expect(days.map((d) => [d.day_index, d.title])).toEqual([[1, "Siena"]]);
    const extra = await appendDay(trip.id);
    expect([extra.day_index, extra.date]).toEqual([2, "2026-05-12"]);
  });
});

describe("viajantes e checklists", () => {
  it("divide gastos entre viajantes e calcula o acerto", async () => {
    const { addTraveler, listTravelers, addExpense } = await import("@/db/repo");
    const { balances, settle } = await import("@turism/domain");
    const trip = await createTrip({ title: "T", start_date: null, end_date: null, base_currency: "BRL" });
    const ana = await addTraveler(trip.id, "Ana");
    const bia = await addTraveler(trip.id, "Bia");
    expect((await listTravelers(trip.id)).map((t) => t.color)).toHaveLength(2);
    await addExpense({ trip_id: trip.id, day_id: null, category: "food", amount: 100, currency: "BRL", paid_by: ana.id }, "BRL");
    await addExpense({ trip_id: trip.id, day_id: null, category: "fuel", amount: 40, currency: "BRL", paid_by: bia.id, split: { [ana.id]: 1, [bia.id]: 0 } }, "BRL");
    const rows = await db.expenses.where("trip_id").equals(trip.id).toArray();
    const bal = balances(rows.map((e) => ({ amount_base: e.amount_base, paid_by: e.paid_by, split: e.split ?? null })), await listTravelers(trip.id));
    expect(settle(bal)).toEqual([{ from: bia.id, to: ana.id, amount: 10 }]);
  });
  it("aplica template de checklist sem duplicar e alterna itens", async () => {
    const { applyChecklistTemplate, listChecklist, toggleChecklistItem, addChecklistItem } = await import("@/db/repo");
    const trip = await createTrip({ title: "T", start_date: null, end_date: null, base_currency: "BRL" });
    const n = await applyChecklistTemplate(trip.id, "packing");
    expect(n).toBeGreaterThan(5);
    expect(await applyChecklistTemplate(trip.id, "packing")).toBe(0);
    const [first] = await listChecklist(trip.id, "packing");
    await toggleChecklistItem(first!.id);
    expect((await listChecklist(trip.id, "packing"))[0]!.done).toBe(true);
    const [day] = await listDays(trip.id);
    await addChecklistItem(trip.id, "day", "Confirmar trem", day!.id);
    expect(await listChecklist(trip.id, "day", day!.id)).toHaveLength(1);
    expect(await listChecklist(trip.id, "day", null)).toHaveLength(0);
  });
});
