import { describe, it, expect } from "vitest";
import {
  uuidv7, dateRange, addDays, pickCurrentDay, pickRate, toBase, ratesFromFrankfurter,
  parseLocalizedNumber, extractMoney, ocrFromText, parseItineraryText, expensesToCsv, summarize,
} from "../src";

describe("ids", () => {
  it("gera uuid v7 válido e ordenável", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_001_000);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe("days", () => {
  it("gera intervalo de datas inclusivo", () => {
    expect(dateRange("2026-05-10", "2026-05-12")).toEqual(["2026-05-10", "2026-05-11", "2026-05-12"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  const days = [
    { id: "a", day_index: 1, date: "2026-05-10", timezone: "Europe/Rome" },
    { id: "b", day_index: 2, date: "2026-05-11", timezone: "Europe/Rome" },
    { id: "c", day_index: 3, date: "2026-05-12", timezone: "Europe/Rome" },
  ];
  it("escolhe o dia corrente pelo fuso do dia", () => {
    // 2026-05-11 23:30 UTC = 2026-05-12 01:30 em Roma (CEST)
    const r = pickCurrentDay(days, new Date("2026-05-11T23:30:00Z"));
    expect(r.day?.id).toBe("c");
    expect(r.mode).toBe("active");
    expect(r.lateNightAmbiguity).toBe(true);
  });
  it("antes e depois da viagem", () => {
    expect(pickCurrentDay(days, new Date("2026-05-01T12:00:00Z")).mode).toBe("planning");
    expect(pickCurrentDay(days, new Date("2026-06-01T12:00:00Z")).mode).toBe("done");
    expect(pickCurrentDay(days, new Date("2026-06-01T12:00:00Z")).day?.id).toBe("c");
  });
  it("sem datas cai no Dia 1", () => {
    const r = pickCurrentDay([{ id: "x", day_index: 1, date: null, timezone: "UTC" }]);
    expect(r.mode).toBe("undated");
    expect(r.day?.id).toBe("x");
  });
});

describe("fx", () => {
  const rates = [
    { id: "BRL:EUR:2026-05-01", base: "BRL", quote: "EUR", date: "2026-05-01", rate: 6.1, provider: "t" },
    { id: "BRL:EUR:2026-05-10", base: "BRL", quote: "EUR", date: "2026-05-10", rate: 6.2, provider: "t" },
  ];
  it("escolhe a taxa mais recente até a data", () => {
    expect(pickRate(rates, "BRL", "EUR", "2026-05-09")?.rate).toBe(6.1);
    expect(pickRate(rates, "BRL", "EUR", "2026-05-20")?.rate).toBe(6.2);
    expect(pickRate(rates, "BRL", "EUR", "2026-04-01")?.rate).toBe(6.1);
    expect(pickRate(rates, "BRL", "USD", "2026-05-09")).toBeNull();
    expect(pickRate([], "BRL", "BRL", "2026-05-09")?.rate).toBe(1);
  });
  it("converte e arredonda", () => {
    expect(toBase(10.005, 6.2)).toBe(62.03);
  });
  it("cruza taxas do Frankfurter para a moeda base", () => {
    const out = ratesFromFrankfurter({ base: "EUR", date: "2026-05-10", rates: { BRL: 6.2, USD: 1.1 } }, "BRL", ["EUR", "USD", "BRL"]);
    expect(out.map((r) => r.quote).sort()).toEqual(["EUR", "USD"]);
    expect(out.find((r) => r.quote === "EUR")?.rate).toBeCloseTo(6.2, 6);
    expect(out.find((r) => r.quote === "USD")?.rate).toBeCloseTo(6.2 / 1.1, 6);
  });
});

describe("ocr", () => {
  it("interpreta números localizados", () => {
    expect(parseLocalizedNumber("1.234,56")).toBe(1234.56);
    expect(parseLocalizedNumber("1,234.56")).toBe(1234.56);
    expect(parseLocalizedNumber("45,90")).toBe(45.9);
  });
  it("prioriza a linha de total", () => {
    const text = "POSTO SHELL\nGasolina 12,50\nÁgua 3,00\nTOTAL R$ 15,50\n12/05/2026";
    const r = ocrFromText(text);
    expect(r.amount).toBe(15.5);
    expect(r.currency).toBe("BRL");
    expect(r.date).toBe("2026-05-12");
    expect(r.category_guess).toBe("fuel");
    expect(r.merchant).toBe("POSTO SHELL");
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });
  it("sem total pega o maior valor", () => {
    expect(extractMoney("café 4,50\nsanduíche 18,00").amount).toBe(18);
  });
});

describe("itinerary parser", () => {
  it("estrutura dias e atividades a partir de texto", () => {
    const text = `Roteiro Toscana
Dia 1 - Florença
Chegada e passeio pelo centro.
09:40 Trem para Florença
- Check-in Hotel Brunelleschi
Dia 2: Siena
08h00 Dirigir até Siena (75 km)
13:00 Almoço na Piazza del Campo`;
    const p = parseItineraryText(text, { startDate: "2026-05-10" });
    expect(p.days).toHaveLength(2);
    expect(p.title).toBe("Roteiro Toscana");
    expect(p.days[0]?.title).toBe("Florença");
    expect(p.days[0]?.date).toBe("2026-05-10");
    expect(p.days[1]?.date).toBe("2026-05-11");
    expect(p.days[0]?.activities.map((a) => a.start_time)).toEqual(["09:40", null]);
    expect(p.days[0]?.activities[0]?.type).toBe("train");
    expect(p.days[1]?.activities[0]?.type).toBe("transfer");
    expect(p.days[1]?.activities[1]?.type).toBe("meal");
    expect(p.days[0]?.narrative).toContain("Chegada");
  });
  it("aceita cabeçalhos por data", () => {
    const p = parseItineraryText("12/05/2026 Roma\n- Coliseu\n13/05/2026 Nápoles");
    expect(p.days.map((d) => d.date)).toEqual(["2026-05-12", "2026-05-13"]);
  });
});

describe("csv", () => {
  const now = "2026-05-10T10:00:00.000Z";
  const e = {
    id: "1", trip_id: "t", day_id: "d", category: "food", amount: 10, currency: "EUR", fx_rate: 6.2, fx_rate_date: "2026-05-10",
    amount_base: 62, paid_by: null, payment_method: null, merchant: 'Bar "X"', receipt_asset_id: null, source: "manual" as const,
    ocr_confidence: null, notes: null, spent_at: now, updated_at: now,
  };
  it("exporta e resume", () => {
    const csv = expensesToCsv([e], [{ id: "d", trip_id: "t", day_index: 1, date: "2026-05-10", timezone: "UTC", title: null, narrative: null, logistics_notes: null, updated_at: now }], "BRL");
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain('"Bar ""X"""');
    expect(summarize([e]).total).toBe(62);
    expect(summarize([e]).byCurrency.EUR).toBe(10);
  });
});

describe("settle", () => {
  const T = [{ id: "a", name: "Ana" }, { id: "b", name: "Bia" }, { id: "c", name: "Caio" }];
  it("divide igualmente e joga o resto no maior peso", async () => {
    const { shareOf } = await import("../src");
    expect(shareOf({ amount_base: 100, paid_by: "a", split: null }, T)).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
    expect(shareOf({ amount_base: 90, paid_by: "a", split: { a: 2, b: 1, c: 0 } }, T)).toEqual({ a: 60, b: 30, c: 0 });
  });
  it("calcula saldos e transferências mínimas", async () => {
    const { balances, settle } = await import("../src");
    const bal = balances([
      { amount_base: 90, paid_by: "a", split: null },
      { amount_base: 30, paid_by: "b", split: { b: 1, c: 1 } },
    ], T);
    expect(bal.find((b) => b.traveler_id === "a")).toMatchObject({ paid: 90, owes: 30, net: 60 });
    expect(bal.find((b) => b.traveler_id === "c")).toMatchObject({ paid: 0, owes: 45, net: -45 });
    const tr = settle(bal);
    expect(tr).toEqual([{ from: "c", to: "a", amount: 45 }, { from: "b", to: "a", amount: 15 }]);
    expect(tr.reduce((s, t) => s + t.amount, 0)).toBe(60);
  });
});

describe("expiry", () => {
  it("classifica validade em relação à data de referência", async () => {
    const { expiryLevel, expiryLabel } = await import("../src");
    expect(expiryLevel("2026-05-01", "2026-05-10")).toBe("expired");
    expect(expiryLevel("2026-05-15", "2026-05-10")).toBe("critical");
    expect(expiryLevel("2026-06-01", "2026-05-10")).toBe("warning");
    expect(expiryLevel("2026-08-01", "2026-05-10")).toBe("notice");
    expect(expiryLevel("2027-01-01", "2026-05-10")).toBe("ok");
    expect(expiryLabel("critical", "2026-05-15", "2026-05-10")).toBe("vence em 5 dia(s)");
    expect(expiryLabel("ok", null, "2026-05-10")).toBeNull();
  });
});

describe("exif", () => {
  it("lê DateTimeOriginal e GPS de um JPEG mínimo", async () => {
    const { parseExif } = await import("../src");
    // JPEG: SOI + APP1 (Exif, TIFF little-endian) com IFD0 → ExifIFD(0x9003) e GPSIFD
    const enc = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
    const tiff: number[] = [];
    const u16 = (n: number) => [n & 0xff, n >> 8];
    const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
    tiff.push(...enc("II"), ...u16(42), ...u32(8));
    // IFD0 @8: 2 entradas → ExifIFD @ 8+2+24+4 = 38, GPS IFD @ 38 + 2 + 12 + 4 + 20 = 76
    tiff.push(...u16(2));
    tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(38));
    tiff.push(...u16(0x8825), ...u16(4), ...u32(1), ...u32(76));
    tiff.push(...u32(0));
    // Exif IFD @38: 1 entrada: DateTimeOriginal ASCII 20 bytes @ 38+2+12+4 = 56
    tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(56), ...u32(0));
    tiff.push(...enc("2026:05:12 09:41:00\0"));
    // GPS IFD @76: 4 entradas; rationals @ 76+2+48+4 = 130 (lat) e 154 (lng)
    tiff.push(...u16(4));
    tiff.push(...u16(1), ...u16(2), ...u32(2), ...enc("S\0"), 0, 0);
    tiff.push(...u16(2), ...u16(5), ...u32(3), ...u32(130));
    tiff.push(...u16(3), ...u16(2), ...u32(2), ...enc("W\0"), 0, 0);
    tiff.push(...u16(4), ...u16(5), ...u32(3), ...u32(154));
    tiff.push(...u32(0));
    for (const [d, m, s] of [[22, 54, 0], [43, 12, 0]]) tiff.push(...u32(d!), ...u32(1), ...u32(m!), ...u32(1), ...u32(s!), ...u32(1));
    const app1 = [...enc("Exif\0\0"), ...tiff];
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff, ...app1, 0xff, 0xd9]);
    const info = parseExif(jpeg.buffer);
    expect(info.date).toBe("2026-05-12");
    expect(info.taken_at).toBe("2026-05-12T09:41:00");
    expect(info.lat).toBeCloseTo(-22.9, 5);
    expect(info.lng).toBeCloseTo(-43.2, 5);
  });
  it("ignora arquivos sem EXIF", async () => {
    const { parseExif } = await import("../src");
    expect(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer).date).toBeNull();
  });
});

describe("gpx", () => {
  it("calcula distância, desnível e path SVG", async () => {
    const { parseTrack, trackToSvgPath } = await import("../src");
    const gpx = `<?xml version="1.0"?><gpx><trk><name>Serra</name><trkseg>
      <trkpt lat="-22.90" lon="-43.20"><ele>10</ele></trkpt>
      <trkpt lat="-22.90" lon="-43.10"><ele>110</ele></trkpt>
      <trkpt lat="-22.80" lon="-43.10"><ele>60</ele></trkpt></trkseg></trk>
      <wpt lat="-22.85" lon="-43.15"><name>Mirante</name></wpt></gpx>`;
    const t = parseTrack(gpx);
    expect(t.name).toBe("Serra");
    expect(t.points).toHaveLength(3);
    expect(t.distance_km).toBeCloseTo(21.4, 0);
    expect(t.ascent_m).toBe(100);
    expect(t.descent_m).toBe(50);
    expect(t.waypoints[0]?.name).toBe("Mirante");
    expect(trackToSvgPath(t, 200, 100)).toMatch(/^M[\d.]+ [\d.]+ L/);
  });
  it("lê KML", async () => {
    const { parseTrack } = await import("../src");
    const t = parseTrack(`<kml><Document><name>Rota</name><Placemark><LineString><coordinates>-43.2,-22.9,0 -43.1,-22.9,0</coordinates></LineString></Placemark></Document></kml>`);
    expect(t.points).toHaveLength(2);
    expect(t.distance_km).toBeGreaterThan(10);
  });
});

describe("vehicle", () => {
  it("calcula consumo e custo por km a partir dos abastecimentos", async () => {
    const { vehicleStats } = await import("../src");
    const s = vehicleStats([
      { amount_base: 300, liters: 50, odometer_km: 10000, spent_at: "2026-05-10T10:00:00Z" },
      { amount_base: 240, liters: 40, odometer_km: 10480, spent_at: "2026-05-12T10:00:00Z" },
    ]);
    expect(s).toMatchObject({ fills: 2, liters: 90, cost_base: 540, km: 480, km_per_liter: 12, price_per_liter: 6 });
    expect(s.cost_per_km).toBeCloseTo(1.13, 2);
    expect(vehicleStats([]).km).toBeNull();
  });
});
