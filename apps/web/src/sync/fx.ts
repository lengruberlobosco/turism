import { db } from "@/db/schema";
import { ratesFromFrankfurter, CURRENCIES, type FxRate } from "@turism/domain";
import { setKV, getKV } from "@/db/repo";

const FRANKFURTER = "https://api.frankfurter.dev/v1";

/**
 * Atualiza as taxas para a moeda base da viagem (todas as moedas conhecidas, cruzadas via EUR).
 * Grava em fx_rates com a data da cotação. Silencioso se offline.
 */
export async function refreshRates(base: string, quotes: string[] = CURRENCIES.map((c) => c.code)): Promise<FxRate[]> {
  const res = await fetch(`${FRANKFURTER}/latest?base=EUR`);
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
  const payload = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
  const rates = ratesFromFrankfurter(payload, base, quotes);
  if (rates.length) await db.fx_rates.bulkPut(rates);
  await setKV(`fx:last:${base}`, { at: new Date().toISOString(), date: payload.date });
  return rates;
}

export async function lastFxRefresh(base: string) {
  return getKV<{ at: string; date: string }>(`fx:last:${base}`);
}

/** Taxa histórica para uma data específica (usada ao lançar gasto com data passada). */
export async function fetchHistoricalRate(base: string, quote: string, date: string): Promise<FxRate | null> {
  const res = await fetch(`${FRANKFURTER}/${date}?base=EUR&symbols=${encodeURIComponent([base, quote].filter((c) => c !== "EUR").join(","))}`);
  if (!res.ok) return null;
  const payload = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
  const [r] = ratesFromFrankfurter(payload, base, [quote]);
  if (r) await db.fx_rates.put(r);
  return r ?? null;
}
