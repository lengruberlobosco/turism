import { describe, it, expect, vi } from "vitest";
import { runJob, type Deps } from "../src/jobs.ts";

function deps(parsed: unknown): Deps & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { insert: [], ocr: [] };
  return {
    calls,
    client: { messages: { parse: vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: parsed })), create: vi.fn() } } as unknown as Deps["client"],
    downloadBase64: vi.fn(async () => ({ base64: "AAAA", mime: "image/png" })),
    insertSuggestions: vi.fn(async (rows) => { calls.insert.push(rows); }),
    setAssetOcr: vi.fn(async (...a) => { calls.ocr.push(a); }),
  };
}

describe("runJob", () => {
  it("ocr_receipt baixa do storage, grava OCR no asset e devolve saída", async () => {
    const d = deps({ amount: 10, currency: "EUR", date: null, merchant: "Bar", category_guess: "food", confidence: 0.8, line_items: [] });
    const out = await runJob({ id: "j", trip_id: "t", type: "ocr_receipt", input: { asset_id: "a1", storage_path: "t/a1" } }, d);
    expect((out as { amount: number }).amount).toBe(10);
    expect(d.calls.ocr[0]).toMatchObject(["a1", { amount: 10, source: "ocr_online" }, "done"]);
  });
  it("ocr_receipt marca falha quando o download quebra", async () => {
    const d = deps(null);
    d.downloadBase64 = vi.fn(async () => { throw new Error("404"); });
    await expect(runJob({ id: "j", trip_id: "t", type: "ocr_receipt", input: { asset_id: "a1", storage_path: "x" } }, d)).rejects.toThrow("404");
    expect(d.calls.ocr[0]).toEqual(["a1", null, "failed"]);
  });
  it("suggest_pois mapeia day_index → day_id", async () => {
    const d = deps({ suggestions: [{ day_index: 2, kind: "stop", title: "Posto", place_name: null, type: "transfer", start_time: null, reason: "r", source_url: null }] });
    (d.client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "pesquisa" }] });
    await runJob({ id: "j", trip_id: "t", type: "suggest_pois", input: { days: [{ id: "d1", day_index: 1, date: null, title: "A", narrative: null }, { id: "d2", day_index: 2, date: null, title: "B", narrative: null }] } }, d);
    expect(d.calls.insert[0]).toMatchObject([{ trip_id: "t", day_id: "d2", kind: "stop" }]);
  });
});
