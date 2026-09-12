import type Anthropic from "@anthropic-ai/sdk";
import { parseItinerary, ocrReceipt, suggestPois, findReferenceImage } from "../../../supabase/functions/_shared/ai.ts";

export type JobType = "parse_itinerary" | "ocr_receipt" | "suggest_pois" | "find_images";

export interface JobRow {
  id: string;
  trip_id: string | null;
  type: JobType;
  input: Record<string, unknown>;
}

export interface Deps {
  client: Anthropic;
  /** Baixa um arquivo do Storage e devolve base64 (para OCR de recibos já enviados). */
  downloadBase64: (path: string) => Promise<{ base64: string; mime: string }>;
  /** Grava sugestões geradas (tabela ai_suggestions). */
  insertSuggestions: (rows: Array<{ trip_id: string; day_id: string | null; kind: string; payload: unknown; reason: string }>) => Promise<void>;
  /** Atualiza o OCR de um asset. */
  setAssetOcr: (asset_id: string, ocr: unknown, status: "done" | "failed") => Promise<void>;
}

/** Executa um job e devolve o `output` a gravar em ai_jobs. Erros sobem para marcar status=failed. */
export async function runJob(job: JobRow, deps: Deps): Promise<unknown> {
  switch (job.type) {
    case "parse_itinerary": {
      const input = job.input as { text?: string; pdf_base64?: string; storage_path?: string; start_date?: string | null };
      const pdf_base64 = input.pdf_base64 ?? (input.storage_path ? (await deps.downloadBase64(input.storage_path)).base64 : undefined);
      return parseItinerary(deps.client, { text: input.text, pdf_base64, start_date: input.start_date });
    }
    case "ocr_receipt": {
      const input = job.input as { asset_id: string; storage_path: string };
      try {
        const { base64, mime } = await deps.downloadBase64(input.storage_path);
        const out = await ocrReceipt(deps.client, base64, mime);
        await deps.setAssetOcr(input.asset_id, { ...out, source: "ocr_online" }, "done");
        return out;
      } catch (e) {
        await deps.setAssetOcr(input.asset_id, null, "failed");
        throw e;
      }
    }
    case "suggest_pois": {
      const input = job.input as { days: Array<{ id: string; day_index: number; date: string | null; title: string | null; narrative: string | null }> };
      const { suggestions } = await suggestPois(deps.client, input.days);
      const byIndex = new Map(input.days.map((d) => [d.day_index, d.id]));
      await deps.insertSuggestions(
        suggestions.map((s) => ({ trip_id: job.trip_id!, day_id: byIndex.get(s.day_index) ?? null, kind: s.kind, reason: s.reason, payload: { title: s.title, place_name: s.place_name, type: s.type, start_time: s.start_time, url: s.source_url } })),
      );
      return { count: suggestions.length };
    }
    case "find_images": {
      const input = job.input as { days: Array<{ id: string; day_index: number; title: string | null }> };
      const rows: Parameters<Deps["insertSuggestions"]>[0] = [];
      for (const d of input.days) {
        if (!d.title) continue;
        const img = await findReferenceImage(d.title);
        if (img) rows.push({ trip_id: job.trip_id!, day_id: d.id, kind: "image", reason: `Imagem de referência de ${d.title}`, payload: { title: d.title, image_url: img.url, url: img.page_url, attribution: img.attribution } });
      }
      await deps.insertSuggestions(rows);
      return { count: rows.length };
    }
    default:
      throw new Error(`Tipo de job desconhecido: ${String((job as { type: string }).type)}`);
  }
}
