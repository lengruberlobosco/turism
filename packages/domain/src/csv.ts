import type { Expense, TripDay } from "./types";
import { categoryLabel } from "./categories";

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function expensesToCsv(expenses: Expense[], days: TripDay[], baseCurrency: string): string {
  const dayById = new Map(days.map((d) => [d.id, d]));
  const header = ["dia", "data", "categoria", "estabelecimento", "valor", "moeda", "taxa", `valor_${baseCurrency}`, "origem", "observacoes"];
  const rows = expenses
    .filter((e) => !e.deleted_at)
    .sort((a, b) => a.spent_at.localeCompare(b.spent_at))
    .map((e) => {
      const d = e.day_id ? dayById.get(e.day_id) : undefined;
      return [
        d ? `Dia ${d.day_index}` : "",
        d?.date ?? e.spent_at.slice(0, 10),
        categoryLabel(e.category),
        e.merchant ?? "",
        e.amount.toFixed(2),
        e.currency,
        e.fx_rate.toFixed(6),
        e.amount_base.toFixed(2),
        e.source,
        e.notes ?? "",
      ]
        .map(esc)
        .join(";");
    });
  return [header.join(";"), ...rows].join("\n");
}

export function summarize(expenses: Expense[]): { total: number; byCategory: Record<string, number>; byCurrency: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  const byCurrency: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    if (e.deleted_at) continue;
    total += e.amount_base;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_base;
    byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + e.amount;
  }
  return { total: Math.round(total * 100) / 100, byCategory, byCurrency };
}
