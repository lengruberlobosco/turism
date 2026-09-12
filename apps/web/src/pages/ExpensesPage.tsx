import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { formatMoney, summarize, categoryIcon, categoryLabel, expensesToCsv, vehicleStats, type Trip, type TripDay, type CurrentDayResult, type Expense } from "@turism/domain";
import { useExpenses } from "@/lib/hooks";
import { ExpenseSheet } from "@/components/ExpenseSheet";
import { deleteExpense, updateTrip } from "@/db/repo";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui";
import { useTravelers } from "@/lib/hooks";
import { refreshRates, lastFxRefresh } from "@/sync/fx";
import { useEffect } from "react";
import { timeAgo } from "@/lib/format";
import { useOnline } from "@/lib/network";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

export function ExpensesPage() {
  const { trip, days, current } = useOutletContext<Ctx>();
  const expenses = useExpenses(trip.id);
  const online = useOnline();
  const [sheet, setSheet] = useState(false);
  const [fx, setFx] = useState<{ at: string; date: string } | undefined>();
  const [busy, setBusy] = useState(false);
  const travelers = useTravelers(trip.id);
  const nameOf = (id: string | null) => travelers.find((t) => t.id === id)?.name;
  const vehicle = vehicleStats(expenses.filter((e) => e.category === "fuel").map((e) => ({ amount_base: e.amount_base, liters: e.liters ?? null, odometer_km: e.odometer_km ?? null, spent_at: e.spent_at })));
  useEffect(() => { void lastFxRefresh(trip.base_currency).then(setFx); }, [trip.base_currency, busy]);
  const sums = summarize(expenses);
  const byDay = new Map<string | null, Expense[]>();
  for (const e of expenses) byDay.set(e.day_id, [...(byDay.get(e.day_id) ?? []), e]);
  const dayOrder = [...days.map((d) => d.id), null];

  function exportCsv() {
    const csv = expensesToCsv(expenses, days, trip.base_currency);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${trip.title.replace(/[^\w\d-]+/g, "_")}-gastos.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function updateFx() {
    setBusy(true);
    try { await refreshRates(trip.base_currency); } catch (e) { alert(`Não foi possível atualizar o câmbio: ${e instanceof Error ? e.message : e}`); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h1 className="text-xl font-semibold flex-1">Gastos</h1>
        <button className="btn-ghost" onClick={exportCsv} disabled={expenses.length === 0}><Download size={16} /> CSV</button>
        <button className="btn-primary" onClick={() => setSheet(true)}><Plus size={18} /> Gasto</button>
      </div>
      <div className="card mb-3">
        <p className="section-title">Total da viagem</p>
        <p className="text-3xl font-semibold">{formatMoney(sums.total, trip.base_currency)}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(sums.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => <span key={c} className="chip">{categoryIcon(c)} {categoryLabel(c)} · {formatMoney(v, trip.base_currency)}</span>)}
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex-1">Orçamento: {trip.budget_base ? `${formatMoney(sums.total, trip.base_currency)} de ${formatMoney(trip.budget_base, trip.base_currency)} (${Math.round((sums.total / trip.budget_base) * 100)}%)` : "não definido"}</span>
            <button className="text-accent" onClick={() => { const v = prompt(`Orçamento total da viagem em ${trip.base_currency}:`, trip.budget_base ? String(trip.budget_base) : ""); if (v !== null) void updateTrip(trip.id, { budget_base: v ? Number(v.replace(",", ".")) : null }); }}>definir</button>
          </div>
          {trip.budget_base ? <div className="mt-1"><Progress value={Math.min(1, sums.total / trip.budget_base)} /></div> : null}
          {trip.budget_base && sums.total > trip.budget_base ? <p className="text-xs text-danger mt-1">Orçamento estourado em {formatMoney(sums.total - trip.budget_base, trip.base_currency)}.</p> : null}
        </div>
        {travelers.length > 0 && <Link to="../travelers" className="text-xs text-accent block mt-2">Ver acerto de contas entre {travelers.length} viajantes →</Link>}
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
          <span>Câmbio: {fx ? `cotação de ${fx.date}, atualizada ${timeAgo(fx.at)}` : "nunca atualizado"}</span>
          <button className="ml-auto inline-flex items-center gap-1 text-accent disabled:opacity-40" onClick={() => void updateFx()} disabled={!online || busy}><RefreshCw size={12} className={busy ? "animate-spin" : ""} /> atualizar</button>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Cada gasto guarda a taxa do momento do lançamento; o total não muda quando o câmbio muda.</p>
      </div>
      {vehicle.fills > 0 && (
        <section className="card mb-3">
          <h2 className="section-title mb-2">🚗 Veículo</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="chip">⛽ {vehicle.fills} abastecimento(s) · {vehicle.liters} L · {formatMoney(vehicle.cost_base, trip.base_currency)}</span>
            {vehicle.price_per_liter != null && <span className="chip">{formatMoney(vehicle.price_per_liter, trip.base_currency)}/L</span>}
            {vehicle.km != null && <span className="chip">📏 {vehicle.km} km</span>}
            {vehicle.km_per_liter != null && <span className="chip">{vehicle.km_per_liter} km/L</span>}
            {vehicle.cost_per_km != null && <span className="chip">{formatMoney(vehicle.cost_per_km, trip.base_currency)}/km</span>}
          </div>
          {vehicle.km == null && <p className="text-xs text-slate-500 mt-2">Informe o odômetro em cada abastecimento para ver km rodados, consumo e custo por km.</p>}
        </section>
      )}
      {dayOrder.map((dayId) => {
        const list = byDay.get(dayId);
        if (!list?.length) return null;
        const d = days.find((x) => x.id === dayId);
        const s = summarize(list);
        return (
          <section key={dayId ?? "none"} className="card mb-3">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="font-medium">{d ? `Dia ${d.day_index}` : "Sem dia"} <span className="text-slate-500 text-sm">{d?.date ?? ""}</span></h2>
              <span className="ml-auto font-semibold">{formatMoney(s.total, trip.base_currency)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-t border-line/40">
                    <td className="py-2 w-8">{categoryIcon(e.category)}</td>
                    <td className="py-2">
                      <p>{e.merchant ?? categoryLabel(e.category)}</p>
                      <p className="text-xs text-slate-500">{new Date(e.spent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{e.source !== "manual" ? " · OCR" : ""}{nameOf(e.paid_by) ? ` · pago por ${nameOf(e.paid_by)}` : ""}{e.notes ? ` · ${e.notes}` : ""}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <p>{formatMoney(e.amount_base, trip.base_currency)}</p>
                      {e.currency !== trip.base_currency && <p className="text-xs text-slate-500">{formatMoney(e.amount, e.currency)} @ {e.fx_rate.toFixed(3)}</p>}
                    </td>
                    <td className="py-2 w-8 text-right"><button className="p-1 text-slate-500 hover:text-danger" aria-label="Excluir" onClick={() => { if (confirm("Excluir gasto?")) void deleteExpense(e.id); }}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <ExpenseSheet open={sheet} onClose={() => setSheet(false)} trip={trip} day={current.day} />
    </div>
  );
}
