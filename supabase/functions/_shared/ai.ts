/**
 * Lógica de IA do Módulo 4 e do OCR online (Módulo 3). Compartilhada entre as Edge Functions (Deno) e o worker Node.
 * Usa a Claude API com structured outputs (JSON Schema via Zod): nada de parsear texto livre.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

export const MODEL_MAIN = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get("AI_MODEL_MAIN") ?? process.env.AI_MODEL_MAIN ?? "claude-opus-5";
export const MODEL_FAST = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get("AI_MODEL_FAST") ?? process.env.AI_MODEL_FAST ?? "claude-haiku-4-5";

export function makeClient(apiKey?: string): Anthropic {
  return new Anthropic(apiKey ? { apiKey } : undefined);
}

// ---------- Esquemas (espelham packages/domain) ----------

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const timeStr = z.string().regex(/^\d{2}:\d{2}$/).nullable();

export const ItineraryOut = z.object({
  title: z.string(),
  start_date: dateStr,
  base_currency: z.string().nullable(),
  days: z.array(
    z.object({
      day_index: z.number().int(),
      date: dateStr,
      title: z.string(),
      narrative: z.string().nullable(),
      destination: z.string().nullable(),
      activities: z.array(
        z.object({
          title: z.string(),
          type: z.enum(["transfer", "flight", "train", "lodging", "meal", "visit", "other"]),
          start_time: timeStr,
          end_time: timeStr,
          place_name: z.string().nullable(),
          notes: z.string().nullable(),
        }),
      ),
    }),
  ),
});
export type ItineraryOut = z.infer<typeof ItineraryOut>;

export const ReceiptOut = z.object({
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  date: dateStr,
  merchant: z.string().nullable(),
  category_guess: z.enum(["fuel", "food", "toll", "tour", "lodging", "transport", "shopping", "other"]).nullable(),
  confidence: z.number(),
  line_items: z.array(z.object({ description: z.string(), amount: z.number().nullable() })),
});
export type ReceiptOut = z.infer<typeof ReceiptOut>;

export const SuggestionsOut = z.object({
  suggestions: z.array(
    z.object({
      day_index: z.number().int(),
      kind: z.enum(["activity", "stop", "poi"]),
      title: z.string(),
      place_name: z.string().nullable(),
      type: z.enum(["transfer", "flight", "train", "lodging", "meal", "visit", "other"]),
      start_time: timeStr,
      reason: z.string(),
      source_url: z.string().nullable(),
    }),
  ),
});
export type SuggestionsOut = z.infer<typeof SuggestionsOut>;

// ---------- Roteiro (PDF ou texto) → estrutura ----------

const ITINERARY_SYSTEM = `Você estrutura esboços de roteiros de viagem em dias e atividades.
Regras:
- Numere os dias sequencialmente a partir de 1 (day_index) na ordem cronológica.
- Se houver data de início informada, calcule as datas (YYYY-MM-DD); se o texto trouxer datas, use-as; senão, deixe null.
- title do dia: curto (destino ou tema, ex.: "Florença → Roma"). narrative: a dinâmica operacional do dia em 1–4 frases, em português.
- Cada atividade tem título objetivo, tipo, horário HH:MM se houver (null se não), place_name quando identificável.
- Não invente atividades, horários nem lugares que não estejam no texto. Não resuma: preserve todas as atividades citadas.
- base_currency: código ISO se o texto deixar claro (ex.: viagem à Europa → "EUR"), senão null.`;

export async function parseItinerary(
  client: Anthropic,
  input: { text?: string; pdf_base64?: string; start_date?: string | null },
): Promise<ItineraryOut> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.pdf_base64) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdf_base64 } });
  content.push({
    type: "text",
    text: [input.start_date ? `Data do Dia 1: ${input.start_date}.` : "Sem data de início informada.", input.text ? `Roteiro:\n\n${input.text}` : "Estruture o roteiro do documento anexo."].join("\n"),
  });
  const response = await client.messages.parse({
    model: MODEL_MAIN,
    max_tokens: 16000,
    system: [{ type: "text", text: ITINERARY_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(ItineraryOut), effort: "high" },
  });
  if (response.stop_reason === "refusal") throw new Error(`Solicitação recusada: ${response.stop_details?.explanation ?? "sem detalhes"}`);
  if (!response.parsed_output) throw new Error("A IA não devolveu um roteiro estruturado válido.");
  return normalizeItinerary(response.parsed_output, input.start_date ?? null);
}

/** Garante numeração sequencial e datas coerentes (a IA pode pular índices). */
export function normalizeItinerary(it: ItineraryOut, startDate: string | null): ItineraryOut {
  const days = [...it.days].sort((a, b) => a.day_index - b.day_index).map((d, i) => ({ ...d, day_index: i + 1 }));
  const base = it.start_date ?? startDate ?? days.find((d) => d.date)?.date ?? null;
  if (base) {
    const firstDated = days.findIndex((d) => d.date);
    const anchorIdx = firstDated >= 0 ? firstDated : 0;
    const anchor = firstDated >= 0 ? days[anchorIdx]!.date! : base;
    days.forEach((d, i) => {
      if (!d.date) d.date = addDays(anchor, i - anchorIdx);
    });
  }
  return { ...it, start_date: days[0]?.date ?? base, days };
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---------- OCR de recibo (visão) ----------

const RECEIPT_SYSTEM = `Você extrai dados de recibos, notas fiscais e vouchers fotografados.
- amount: o valor TOTAL pago (não subtotal, não troco). Número com ponto decimal.
- currency: código ISO 4217 (BRL, EUR, USD…) inferido por símbolo, idioma ou país; null se impossível.
- date: data do recibo em YYYY-MM-DD; null se ilegível.
- merchant: nome do estabelecimento.
- category_guess: fuel (combustível), food, toll (pedágio), tour (ingressos/passeios), lodging, transport, shopping ou other.
- confidence: 0 a 1, sua confiança no valor total.
- line_items: itens legíveis (pode ser vazio).`;

export async function ocrReceipt(client: Anthropic, image_base64: string, media_type: string): Promise<ReceiptOut> {
  const mt = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(media_type) ? media_type : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const response = await client.messages.parse({
    model: MODEL_FAST,
    max_tokens: 2048,
    system: RECEIPT_SYSTEM,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mt, data: image_base64 } }, { type: "text", text: "Extraia os dados deste recibo." }] }],
    output_config: { format: zodOutputFormat(ReceiptOut) },
  });
  if (response.stop_reason === "refusal") throw new Error("Solicitação recusada pelo modelo.");
  if (!response.parsed_output) throw new Error("OCR sem resultado estruturado.");
  return response.parsed_output;
}

// ---------- Sugestões de passeios/paradas (pesquisa web + estruturação) ----------

const SUGGEST_SYSTEM = `Você é um planejador de viagens experiente. Dado um roteiro por dias, sugira passeios, paradas estratégicas
(abastecimento, almoço, mirantes) e pontos de interesse REAIS próximos ao trajeto de cada dia. Use pesquisa na web para confirmar
que cada lugar existe e está aberto. Explique em uma frase o porquê (distância do trajeto, horário, relevância). Máximo 3 por dia.
Nunca sugira lugares que você não conseguiu confirmar.`;

export async function suggestPois(
  client: Anthropic,
  days: Array<{ day_index: number; date: string | null; title: string | null; narrative: string | null }>,
): Promise<SuggestionsOut> {
  const brief = days.map((d) => `Dia ${d.day_index}${d.date ? ` (${d.date})` : ""}: ${d.title ?? ""}\n${d.narrative ?? ""}`).join("\n\n");
  // Passo 1: pesquisa (server tool web_search), com tratamento de pause_turn
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Roteiro:\n\n${brief}\n\nPesquise e liste as sugestões com fonte (URL).` }];
  let research = "";
  for (let i = 0; i < 4; i++) {
    const r = await client.messages.create({
      model: MODEL_MAIN,
      max_tokens: 16000,
      system: SUGGEST_SYSTEM,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    });
    if (r.stop_reason === "refusal") throw new Error("Solicitação recusada pelo modelo.");
    if (r.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: r.content });
      continue;
    }
    research = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
    break;
  }
  // Passo 2: estruturação
  const parsed = await client.messages.parse({
    model: MODEL_MAIN,
    max_tokens: 8000,
    system: "Converta a pesquisa em sugestões estruturadas. day_index deve existir no roteiro. kind: stop para paradas de trajeto, poi para pontos de interesse, activity para passeios com horário.",
    messages: [{ role: "user", content: `Roteiro:\n${brief}\n\nPesquisa:\n${research}` }],
    output_config: { format: zodOutputFormat(SuggestionsOut), effort: "low" },
  });
  if (!parsed.parsed_output) throw new Error("Sugestões sem resultado estruturado.");
  const valid = new Set(days.map((d) => d.day_index));
  return { suggestions: parsed.parsed_output.suggestions.filter((s) => valid.has(s.day_index)) };
}

// ---------- Imagens de referência (Wikimedia Commons, licença livre, com atribuição) ----------

export interface ReferenceImage {
  url: string;
  page_url: string;
  attribution: string;
  license: string;
}

export async function findReferenceImage(query: string, fetchImpl: typeof fetch = fetch): Promise<ReferenceImage | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1024",
    format: "json",
    origin: "*",
  });
  const res = await fetchImpl(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": "Turism/0.1 (travel planner)" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; url: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }> }> } };
  const pages = Object.values(data.query?.pages ?? {});
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    const license = meta.LicenseShortName?.value ?? "";
    if (!/^(CC|Public domain|PD)/i.test(license)) continue;
    const artist = (meta.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim();
    return { url: ii.thumburl ?? ii.url, page_url: ii.descriptionurl, attribution: `${artist || "Wikimedia Commons"} · ${license}`, license };
  }
  return null;
}
