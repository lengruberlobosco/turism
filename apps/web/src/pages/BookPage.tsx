import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Printer } from "lucide-react";
import { formatDatePt, formatMoney, summarize, categoryLabel, ACTIVITY_TYPES, type Trip, type TripDay, type CurrentDayResult, type Activity, type Asset } from "@turism/domain";
import { db } from "@/db/schema";
import { useExpenses, useTripAssets, useAssetLinks } from "@/lib/hooks";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

/** "Livro da viagem": relato imprimível (PDF via imprimir) com roteiro, fotos, documentos e planilha (docs/04 L12). */
export function BookPage() {
  const { trip, days } = useOutletContext<Ctx>();
  const expenses = useExpenses(trip.id);
  const assets = useTripAssets(trip.id);
  const links = useAssetLinks(trip.id);
  const [acts, setActs] = useState<Activity[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => { void db.activities.where("trip_id").equals(trip.id).toArray().then((r) => setActs(r.filter((a) => !a.deleted_at))); }, [trip.id]);
  useEffect(() => {
    let urls: string[] = [];
    (async () => {
      const out: Record<string, string> = {};
      for (const a of assets.filter((x) => x.kind === "photo")) {
        const b = await db.asset_blobs.get(a.id);
        if (b) { out[a.id] = URL.createObjectURL(b.thumb ?? b.blob); urls.push(out[a.id]!); }
      }
      setThumbs(out);
    })();
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [assets]);
  const total = summarize(expenses);
  const byDay = (id: string) => ({
    acts: acts.filter((a) => a.day_id === id).sort((a, b) => a.position - b.position),
    assets: links.filter((l) => l.day_id === id).map((l) => assets.find((a) => a.id === l.asset_id)).filter((a): a is Asset => !!a),
    exp: summarize(expenses.filter((e) => e.day_id === id)),
  });
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 print:max-w-none print:px-0 print:text-black">
      <style>{`@media print { nav, aside, header, .no-print { display: none !important; } body { background: #fff; color: #000; } .card { border-color: #ccc; background: #fff; } .page-break { break-before: page; } }`}</style>
      <div className="flex items-center gap-2 mb-4 no-print">
        <h1 className="text-xl font-semibold flex-1">Livro da viagem</h1>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Imprimir / PDF</button>
      </div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{trip.title}</h1>
        <p className="text-slate-400 print:text-slate-700">{trip.start_date ? `${formatDatePt(trip.start_date, { day: "2-digit", month: "long", year: "numeric" })} a ${formatDatePt(trip.end_date, { day: "2-digit", month: "long", year: "numeric" })}` : "sem datas"} · {days.length} dias · total {formatMoney(total.total, trip.base_currency)}</p>
      </header>
      {days.map((d) => {
        const x = byDay(d.id);
        return (
          <section key={d.id} className="card mb-4 print:mb-6 print:break-inside-avoid">
            <h2 className="text-xl font-semibold">Dia {d.day_index} <span className="text-slate-400 print:text-slate-600 font-normal">· {formatDatePt(d.date, { weekday: "long", day: "2-digit", month: "long" })}{d.title ? ` · ${d.title}` : ""}</span></h2>
            {d.narrative && <p className="mt-2 whitespace-pre-line">{d.narrative}</p>}
            {d.logistics_notes && <p className="mt-1 text-sm text-slate-400 print:text-slate-600 whitespace-pre-line">🚗 {d.logistics_notes}</p>}
            {x.acts.length > 0 && (
              <ul className="mt-3 grid gap-1 text-sm">
                {x.acts.map((a) => <li key={a.id} className="flex gap-2"><span className="w-12 tabular-nums text-slate-500">{a.start_time ?? ""}</span><span>{ACTIVITY_TYPES.find((t) => t.id === a.type)?.icon} {a.title}{a.place_name ? ` — ${a.place_name}` : ""}{a.status === "done" ? " ✓" : ""}</span></li>)}
              </ul>
            )}
            {x.assets.some((a) => a.kind === "photo") && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {x.assets.filter((a) => a.kind === "photo" && thumbs[a.id]).map((a) => <img key={a.id} src={thumbs[a.id]} alt={a.title} className="aspect-square object-cover rounded-lg" />)}
              </div>
            )}
            {x.assets.some((a) => a.kind !== "photo") && <p className="mt-2 text-xs text-slate-500">Documentos: {x.assets.filter((a) => a.kind !== "photo").map((a) => a.title).join(" · ")}</p>}
            {x.exp.total > 0 && <p className="mt-2 text-sm">Gastos do dia: <strong>{formatMoney(x.exp.total, trip.base_currency)}</strong> ({Object.entries(x.exp.byCategory).map(([c, v]) => `${categoryLabel(c)} ${formatMoney(v, trip.base_currency)}`).join(", ")})</p>}
          </section>
        );
      })}
      <section className="card page-break">
        <h2 className="text-xl font-semibold mb-2">Planilha de custos</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400 print:text-slate-600"><th className="py-1">Dia</th><th>Categoria</th><th>Estabelecimento</th><th className="text-right">Original</th><th className="text-right">{trip.base_currency}</th></tr></thead>
          <tbody>
            {[...expenses].sort((a, b) => a.spent_at.localeCompare(b.spent_at)).map((e) => {
              const d = days.find((x) => x.id === e.day_id);
              return <tr key={e.id} className="border-t border-line/40 print:border-slate-300"><td className="py-1">{d ? `Dia ${d.day_index}` : ""}</td><td>{categoryLabel(e.category)}</td><td>{e.merchant ?? ""}</td><td className="text-right tabular-nums">{formatMoney(e.amount, e.currency)}</td><td className="text-right tabular-nums">{formatMoney(e.amount_base, trip.base_currency)}</td></tr>;
            })}
          </tbody>
          <tfoot><tr className="border-t border-line font-semibold"><td colSpan={4} className="py-2">Total</td><td className="text-right tabular-nums">{formatMoney(total.total, trip.base_currency)}</td></tr></tfoot>
        </table>
        <p className="text-xs text-slate-500 mt-2">{Object.entries(total.byCategory).map(([c, v]) => `${categoryLabel(c)}: ${formatMoney(v, trip.base_currency)}`).join(" · ")}</p>
      </section>
    </div>
  );
}
