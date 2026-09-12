import type { OcrResult } from "./types";

const CURRENCY_HINTS: Array<[RegExp, string]> = [
  [/R\$|BRL|reais?/i, "BRL"],
  [/€|EUR|euros?/i, "EUR"],
  [/US\$|USD|dólar|dollar/i, "USD"],
  [/£|GBP/i, "GBP"],
  [/¥|JPY|yen/i, "JPY"],
  [/CHF/i, "CHF"],
  [/ARS/i, "ARS"],
  [/CLP/i, "CLP"],
];

const TOTAL_HINTS = /total|valor|amount|importe|montant|betrag|totale|a pagar|pago|paid/i;

/** Converte "1.234,56" / "1,234.56" / "1234.56" em número. */
export function parseLocalizedNumber(raw: string): number | null {
  let s = raw.replace(/\s/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function detectCurrency(text: string): string | null {
  for (const [re, code] of CURRENCY_HINTS) if (re.test(text)) return code;
  return null;
}

export function detectDate(text: string): string | null {
  const m1 = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = text.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m2) {
    const d = m2[1]!.padStart(2, "0");
    const mo = m2[2]!.padStart(2, "0");
    let y = m2[3]!;
    if (y.length === 2) y = `20${y}`;
    if (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) return `${y}-${mo}-${d}`;
  }
  return null;
}

/**
 * Heurística offline: encontra o valor total mais provável em texto de OCR.
 * Prioriza linhas com "total"/"valor"; senão, o maior valor com 2 casas decimais.
 */
export function extractMoney(text: string): { amount: number | null; confidence: number; merchant: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numRe = /(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{2})/g;
  let best: { amount: number; score: number } | null = null;
  for (const line of lines) {
    const hinted = TOTAL_HINTS.test(line);
    for (const m of line.matchAll(numRe)) {
      const n = parseLocalizedNumber(m[0]);
      if (n === null || n <= 0 || n > 1_000_000) continue;
      const score = (hinted ? 2 : 0) + Math.log10(n + 1) / 10;
      if (!best || score > best.score) best = { amount: n, score };
    }
  }
  const merchant = lines.find((l) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .&'-]{3,}$/.test(l) && !TOTAL_HINTS.test(l)) ?? null;
  if (!best) return { amount: null, confidence: 0, merchant };
  return { amount: best.amount, confidence: best.score >= 2 ? 0.6 : 0.3, merchant };
}

export function guessCategory(text: string): string | null {
  const t = text.toLowerCase();
  if (/posto|gasolina|diesel|fuel|petrol|shell|ipiranga|petrobras|combust/i.test(t)) return "fuel";
  if (/pedágio|pedagio|toll|autopista|péage|autostrade/i.test(t)) return "toll";
  if (/restaurante|restaurant|pizza|bar|café|cafe|padaria|lanch|burger|sushi|trattoria|bistro/i.test(t)) return "food";
  if (/hotel|hostel|pousada|airbnb|resort|inn/i.test(t)) return "lodging";
  if (/museu|museum|ingresso|ticket|tour|passeio|entrada/i.test(t)) return "tour";
  if (/uber|taxi|táxi|metro|metrô|bus|ônibus|train|trem|bilhete/i.test(t)) return "transport";
  return null;
}

/** Monta um OcrResult offline a partir do texto bruto do Tesseract. */
export function ocrFromText(rawText: string): OcrResult {
  const { amount, confidence, merchant } = extractMoney(rawText);
  return {
    amount,
    currency: detectCurrency(rawText),
    date: detectDate(rawText),
    merchant,
    category_guess: guessCategory(rawText),
    confidence,
    raw_text: rawText,
    source: "ocr_offline",
  };
}
