import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { balances, settle, formatMoney, type Trip, type TripDay, type CurrentDayResult } from "@turism/domain";
import { useTravelers, useExpenses } from "@/lib/hooks";
import { addTraveler, deleteTraveler, updateTraveler } from "@/db/repo";
import { Empty } from "@/components/ui";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

/** Viajantes, quem pagou o quê e acerto de contas (docs/04 L2). */
export function TravelersPage() {
  const { trip } = useOutletContext<Ctx>();
  const travelers = useTravelers(trip.id);
  const expenses = useExpenses(trip.id);
  const [name, setName] = useState("");
  const bal = balances(expenses.map((e) => ({ amount_base: e.amount_base, paid_by: e.paid_by, split: e.split ?? null })), travelers);
  const transfers = settle(bal);
  const nameOf = (id: string) => travelers.find((t) => t.id === id)?.name ?? "?";
  const unassigned = expenses.filter((e) => !e.paid_by).reduce((s, e) => s + e.amount_base, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 grid gap-4">
      <h1 className="text-xl font-semibold">Viajantes e acerto de contas</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void addTraveler(trip.id, name).then(() => setName("")); }}>
        <input className="input" placeholder="Nome do viajante" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" type="submit"><Plus size={18} /></button>
      </form>
      {travelers.length === 0 ? (
        <Empty icon="👥" title="Cadastre quem viaja" hint="Com viajantes cadastrados, cada gasto registra quem pagou e como é dividido; ao final, o app calcula quem deve a quem." />
      ) : (
        <>
          <section className="card">
            <h2 className="section-title mb-2">Saldos</h2>
            <div className="grid gap-2">
              {bal.map((b) => {
                const t = travelers.find((x) => x.id === b.traveler_id)!;
                return (
                  <div key={b.traveler_id} className="flex items-center gap-3 rounded-xl bg-ink/60 px-3 py-2">
                    <span className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-ink" style={{ background: t.color }}>{t.name.slice(0, 1).toUpperCase()}</span>
                    <input className="bg-transparent flex-1 min-w-0 font-medium focus:outline-none" defaultValue={t.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== t.name) void updateTraveler(t.id, { name: e.target.value.trim() }); }} aria-label="Nome" />
                    <div className="text-right text-sm shrink-0">
                      <p className={b.net > 0.005 ? "text-ok" : b.net < -0.005 ? "text-danger" : "text-slate-400"}>{b.net > 0.005 ? "recebe " : b.net < -0.005 ? "deve " : "quite "}{formatMoney(Math.abs(b.net), trip.base_currency)}</p>
                      <p className="text-xs text-slate-500">pagou {formatMoney(b.paid, trip.base_currency)} · parte {formatMoney(b.owes, trip.base_currency)}</p>
                    </div>
                    <button className="p-2 text-slate-500 hover:text-danger" aria-label="Remover" onClick={() => { if (confirm(`Remover ${t.name}? Gastos pagos por essa pessoa ficam sem pagador.`)) void deleteTraveler(t.id); }}><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
            {unassigned > 0 && <p className="text-xs text-warn mt-2">{formatMoney(unassigned, trip.base_currency)} em gastos sem pagador definido (não entram no acerto).</p>}
          </section>
          <section className="card">
            <h2 className="section-title mb-2">Acerto de contas</h2>
            {transfers.length === 0 ? <p className="text-sm text-slate-400">Tudo quite.</p> : (
              <ul className="grid gap-2">
                {transfers.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{nameOf(t.from)}</span> <ArrowRight size={14} className="text-slate-500" /> <span className="font-medium">{nameOf(t.to)}</span>
                    <span className="ml-auto tabular-nums font-semibold shrink-0">{formatMoney(t.amount, trip.base_currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500 mt-2">Transferências mínimas para zerar os saldos, na moeda base, com as taxas congeladas de cada gasto.</p>
          </section>
        </>
      )}
    </div>
  );
}
