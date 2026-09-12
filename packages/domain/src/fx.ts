import type { FxRate } from "./types";

export function fxId(base: string, quote: string, date: string): string {
  return `${base}:${quote}:${date}`;
}

/**
 * Escolhe a taxa quote→base mais adequada para uma data: a mais recente com date <= data pedida,
 * ou, na falta, a mais antiga posterior. Retorna null se não houver nada.
 */
export function pickRate(rates: FxRate[], base: string, quote: string, date: string): FxRate | null {
  if (base === quote) return { id: fxId(base, quote, date), base, quote, date, rate: 1, provider: "identity" };
  const candidates = rates.filter((r) => r.base === base && r.quote === quote).sort((a, b) => a.date.localeCompare(b.date));
  if (candidates.length === 0) return null;
  const before = candidates.filter((r) => r.date <= date);
  return before[before.length - 1] ?? candidates[0]!;
}

/** Converte `amount` em `quote` para a moeda base usando a taxa (1 quote = rate base). Arredonda a 2 casas. */
export function toBase(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function formatMoney(amount: number, currency: string, locale = "pt-BR"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Converte a resposta do Frankfurter (base=EUR, rates: {USD: 1.08, ...}) em pares base->quote para
 * a moeda base da viagem, via cruzamento por EUR. Resultado: 1 quote = rate base.
 */
export function ratesFromFrankfurter(
  payload: { base: string; date: string; rates: Record<string, number> },
  base: string,
  quotes: string[],
  provider = "frankfurter",
): FxRate[] {
  const all: Record<string, number> = { ...payload.rates, [payload.base]: 1 };
  const baseInPayload = all[base];
  if (!baseInPayload) return [];
  const out: FxRate[] = [];
  for (const q of quotes) {
    if (q === base) continue;
    const qInPayload = all[q];
    if (!qInPayload) continue;
    // 1 q = (baseInPayload / qInPayload) base
    const rate = baseInPayload / qInPayload;
    out.push({ id: fxId(base, q, payload.date), base, quote: q, date: payload.date, rate, provider });
  }
  return out;
}
