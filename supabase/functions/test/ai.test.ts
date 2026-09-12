import { describe, it, expect, vi } from "vitest";
import { normalizeItinerary, parseItinerary, ocrReceipt, findReferenceImage } from "../_shared/ai";

describe("normalizeItinerary", () => {
  it("renumera dias e preenche datas a partir da âncora", () => {
    const out = normalizeItinerary(
      { title: "t", start_date: null, base_currency: null, days: [
        { day_index: 3, date: null, title: "c", narrative: null, destination: null, activities: [] },
        { day_index: 1, date: null, title: "a", narrative: null, destination: null, activities: [] },
        { day_index: 2, date: "2026-05-11", title: "b", narrative: null, destination: null, activities: [] },
      ] },
      null,
    );
    expect(out.days.map((d) => [d.day_index, d.date])).toEqual([[1, "2026-05-10"], [2, "2026-05-11"], [3, "2026-05-12"]]);
    expect(out.start_date).toBe("2026-05-10");
  });
  it("usa start_date informado quando não há datas", () => {
    const out = normalizeItinerary({ title: "t", start_date: null, base_currency: null, days: [{ day_index: 1, date: null, title: "a", narrative: null, destination: null, activities: [] }] }, "2026-01-01");
    expect(out.days[0]?.date).toBe("2026-01-01");
  });
});

function fakeClient(parsed: unknown) {
  return { messages: { parse: vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: parsed })) } } as unknown as import("@anthropic-ai/sdk").default;
}

describe("parseItinerary", () => {
  it("envia PDF como document block e devolve roteiro normalizado", async () => {
    const client = fakeClient({ title: "Toscana", start_date: null, base_currency: "EUR", days: [{ day_index: 2, date: null, title: "Siena", narrative: null, destination: "Siena", activities: [] }] });
    const out = await parseItinerary(client, { pdf_base64: "JVBERi0=", start_date: "2026-05-10" });
    const call = (client.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { messages: Array<{ content: Array<{ type: string }> }>; output_config: { format: unknown } };
    expect(call.messages[0]!.content[0]!.type).toBe("document");
    expect(call.output_config.format).toBeTruthy();
    expect(out.days[0]).toMatchObject({ day_index: 1, date: "2026-05-10" });
  });
  it("propaga recusa", async () => {
    const client = { messages: { parse: vi.fn(async () => ({ stop_reason: "refusal", stop_details: { explanation: "x" }, parsed_output: null })) } } as unknown as import("@anthropic-ai/sdk").default;
    await expect(parseItinerary(client, { text: "Dia 1" })).rejects.toThrow(/recusada/);
  });
});

describe("ocrReceipt", () => {
  it("normaliza media_type desconhecido para jpeg", async () => {
    const client = fakeClient({ amount: 15.5, currency: "BRL", date: null, merchant: "Posto", category_guess: "fuel", confidence: 0.9, line_items: [] });
    const out = await ocrReceipt(client, "AAAA", "image/heic");
    const call = (client.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { messages: Array<{ content: Array<{ source: { media_type: string } }> }> };
    expect(call.messages[0]!.content[0]!.source.media_type).toBe("image/jpeg");
    expect(out.amount).toBe(15.5);
  });
});

describe("findReferenceImage", () => {
  it("só aceita imagens com licença livre e devolve atribuição", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ query: { pages: {
      "1": { title: "File:a.jpg", imageinfo: [{ url: "u1", thumburl: "t1", descriptionurl: "d1", extmetadata: { LicenseShortName: { value: "Fair use" } } }] },
      "2": { title: "File:b.jpg", imageinfo: [{ url: "u2", thumburl: "t2", descriptionurl: "d2", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "<a>Ana</a>" } } }] },
    } } }))) as unknown as typeof fetch;
    const img = await findReferenceImage("Florença", fetchImpl);
    expect(img).toEqual({ url: "t2", page_url: "d2", attribution: "Ana · CC BY-SA 4.0", license: "CC BY-SA 4.0" });
  });
});
