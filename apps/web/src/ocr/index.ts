import { ocrFromText, OcrResultSchema, type OcrResult } from "@turism/domain";
import { callFunction, isCloudConfigured } from "@/lib/supabase";

/**
 * OCR em camadas (docs/01 §4.2):
 * 1. Online e com backend: Edge Function `ocr-receipt` (Claude visão, extração semântica).
 * 2. Caso contrário: Tesseract.js no dispositivo + heurística do domínio (confiança baixa).
 */
export async function recognizeReceipt(blob: Blob, opts: { preferOnline?: boolean; onProgress?: (p: number) => void } = {}): Promise<OcrResult> {
  const online = typeof navigator !== "undefined" && navigator.onLine;
  if (online && isCloudConfigured && opts.preferOnline !== false) {
    try {
      const b64 = await blobToBase64(blob);
      const data = await callFunction<unknown>("ocr-receipt", { image_base64: b64, media_type: blob.type || "image/jpeg" });
      return OcrResultSchema.parse({ ...(data as object), source: "ocr_online" });
    } catch (e) {
      console.warn("OCR online falhou; usando OCR local", e);
    }
  }
  return recognizeOffline(blob, opts.onProgress);
}

export async function recognizeOffline(blob: Blob, onProgress?: (p: number) => void): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["por", "eng"], 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/",
    langPath: "/ocr/lang",
    cacheMethod: "none", // o Service Worker (CacheFirst) guarda os dados de idioma
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(blob);
    const result = ocrFromText(data.text);
    // combina a confiança do Tesseract com a heurística de extração
    const tconf = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));
    return { ...result, confidence: Math.round(Math.min(result.confidence, tconf || result.confidence) * 100) / 100 };
  } finally {
    await worker.terminate();
  }
}

/** Aquece o cache do motor de OCR (worker, core e idiomas) para uso offline — chamado em "Preparar OCR offline". */
export async function warmOcrCache(): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 120; canvas.height = 40;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 120, 40);
  ctx.fillStyle = "#000"; ctx.font = "24px sans-serif"; ctx.fillText("TOTAL 1", 4, 28);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) await recognizeOffline(blob);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
