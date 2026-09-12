import { createClient } from "@supabase/supabase-js";
import { handleOptions, json } from "../_shared/cors.ts";

const BASES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "UYU", "JPY", "CHF", "CAD", "MXN"];

/** Atualiza fx_rates para todas as moedas base conhecidas, cruzando via EUR (Frankfurter/BCE). Chamada por pg_cron a cada 6 h. */
Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR");
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const payload = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
    const all: Record<string, number> = { ...payload.rates, EUR: 1 };
    const rows: Array<{ id: string; base: string; quote: string; date: string; rate: number; provider: string }> = [];
    for (const base of BASES) {
      const b = all[base];
      if (!b) continue;
      for (const quote of BASES) {
        const q = all[quote];
        if (quote === base || !q) continue;
        rows.push({ id: `${base}:${quote}:${payload.date}`, base, quote, date: payload.date, rate: b / q, provider: "frankfurter" });
      }
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await supabase.from("fx_rates").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    return json({ ok: true, date: payload.date, rows: rows.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
