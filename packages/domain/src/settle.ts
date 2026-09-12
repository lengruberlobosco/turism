/** Divisão de despesas e acerto de contas entre viajantes (docs/04 L2). */

export interface Traveler {
  id: string;
  name: string;
}

export interface SplittableExpense {
  amount_base: number;
  paid_by: string | null;
  /** peso por viajante; ausente ou vazio = divisão igual entre todos */
  split: Record<string, number> | null;
  deleted_at?: string | null;
}

/** Quanto cada viajante deve arcar desta despesa (moeda base). Arredonda a 2 casas e joga o resto no maior peso. */
export function shareOf(expense: SplittableExpense, travelers: Traveler[]): Record<string, number> {
  const ids = travelers.map((t) => t.id);
  const weights: Record<string, number> = {};
  const custom = expense.split && Object.values(expense.split).some((w) => w > 0);
  for (const id of ids) weights[id] = custom ? Math.max(0, expense.split![id] ?? 0) : 1;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  let acc = 0;
  let maxId = ids[0] ?? "";
  for (const id of ids) {
    out[id] = Math.round(((expense.amount_base * weights[id]!) / total) * 100) / 100;
    acc += out[id]!;
    if (weights[id]! > (weights[maxId] ?? 0)) maxId = id;
  }
  const diff = Math.round((expense.amount_base - acc) * 100) / 100;
  if (diff !== 0 && maxId) out[maxId] = Math.round((out[maxId]! + diff) * 100) / 100;
  return out;
}

export interface Balance {
  traveler_id: string;
  paid: number;
  owes: number;
  /** positivo: tem a receber; negativo: deve */
  net: number;
}

export function balances(expenses: SplittableExpense[], travelers: Traveler[]): Balance[] {
  const paid: Record<string, number> = {};
  const owes: Record<string, number> = {};
  for (const t of travelers) {
    paid[t.id] = 0;
    owes[t.id] = 0;
  }
  for (const e of expenses) {
    if (e.deleted_at) continue;
    if (e.paid_by && e.paid_by in paid) paid[e.paid_by]! += e.amount_base;
    const shares = shareOf(e, travelers);
    for (const [id, v] of Object.entries(shares)) owes[id]! += v;
  }
  return travelers.map((t) => ({
    traveler_id: t.id,
    paid: r2(paid[t.id]!),
    owes: r2(owes[t.id]!),
    net: r2(paid[t.id]! - owes[t.id]!),
  }));
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Menor conjunto de transferências que zera os saldos (guloso: maior devedor paga maior credor). */
export function settle(bal: Balance[]): Transfer[] {
  const debtors = bal.filter((b) => b.net < -0.005).map((b) => ({ id: b.traveler_id, v: -b.net })).sort((a, b) => b.v - a.v);
  const creditors = bal.filter((b) => b.net > 0.005).map((b) => ({ id: b.traveler_id, v: b.net })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!, c = creditors[j]!;
    const amount = r2(Math.min(d.v, c.v));
    if (amount > 0) out.push({ from: d.id, to: c.id, amount });
    d.v = r2(d.v - amount);
    c.v = r2(c.v - amount);
    if (d.v <= 0.005) i++;
    if (c.v <= 0.005) j++;
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
