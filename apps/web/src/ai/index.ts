import { parseItineraryText, ParsedItinerarySchema, type ParsedItinerary } from "@turism/domain";
import { callFunction, isCloudConfigured } from "@/lib/supabase";
import { addSuggestion } from "@/db/repo";
import type { TripDay } from "@turism/domain";

export type ItinerarySource = { kind: "text"; text: string } | { kind: "pdf"; file: File };

/**
 * Módulo 4 — leitura de roteiro. Com backend e rede usa a IA (PDF nativo + structured output);
 * sem isso, o parser heurístico local resolve texto (PDF exige IA ou colar o texto).
 */
export async function parseItinerary(src: ItinerarySource, opts: { startDate?: string | null }): Promise<{ parsed: ParsedItinerary; engine: "ai" | "local" }> {
  const online = navigator.onLine && isCloudConfigured;
  if (online) {
    try {
      const body = src.kind === "text" ? { text: src.text, start_date: opts.startDate ?? null } : { pdf_base64: await fileToBase64(src.file), start_date: opts.startDate ?? null };
      const data = await callFunction<unknown>("parse-itinerary", body);
      return { parsed: ParsedItinerarySchema.parse(data), engine: "ai" };
    } catch (e) {
      console.warn("IA indisponível; usando parser local", e);
    }
  }
  if (src.kind === "pdf") {
    const text = await extractPdfText(src.file);
    return { parsed: parseItineraryText(text, { startDate: opts.startDate }), engine: "local" };
  }
  return { parsed: parseItineraryText(src.text, { startDate: opts.startDate }), engine: "local" };
}

/** Extração de texto de PDF no cliente (pdf.js carregado sob demanda). */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let last: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = Math.round(item.transform[5] ?? 0);
      if (last !== null && Math.abs(y - last) > 2) {
        lines.push(line.trim());
        line = "";
      }
      line += item.str + " ";
      last = y;
    }
    lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

/** Sugestões contextuais (paradas, POIs, imagens) para os dias — exige IA no backend. */
export async function requestSuggestions(trip_id: string, days: TripDay[]): Promise<number> {
  if (!isCloudConfigured || !navigator.onLine) throw new Error("Sugestões de IA exigem conexão e backend configurado.");
  const data = await callFunction<{ suggestions: Array<{ day_index: number; kind: "activity" | "stop" | "poi" | "image"; payload: Record<string, unknown>; reason: string }> }>(
    "suggest-pois",
    { trip_id, days: days.map((d) => ({ day_index: d.day_index, date: d.date, title: d.title, narrative: d.narrative })) },
  );
  let n = 0;
  for (const s of data.suggestions) {
    const day = days.find((d) => d.day_index === s.day_index);
    await addSuggestion({ trip_id, day_id: day?.id ?? null, kind: s.kind, payload: s.payload, reason: s.reason });
    n++;
  }
  return n;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
