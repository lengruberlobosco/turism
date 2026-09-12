import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, FileInput, MapPin } from "lucide-react";
import { db } from "@/db/schema";
import { Empty } from "@/components/ui";
import { formatDatePt } from "@/lib/format";
import { pickCurrentDay } from "@turism/domain";
import { listDays } from "@/db/repo";

export function TripsPage() {
  const trips = useLiveQuery(async () => {
    const rows = (await db.trips.toArray()).filter((t) => !t.deleted_at).sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
    return Promise.all(rows.map(async (t) => ({ trip: t, days: await listDays(t.id) })));
  }, []);
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-semibold flex-1">Minhas viagens</h1>
        <Link to="/import" className="btn-ghost">
          <FileInput size={18} /> <span className="hidden sm:inline">Importar roteiro</span>
        </Link>
        <Link to="/trips/new" className="btn-primary">
          <Plus size={18} /> Nova viagem
        </Link>
      </div>
      {trips && trips.length === 0 && (
        <Empty
          icon={<MapPin className="inline" />}
          title="Nenhuma viagem ainda"
          hint="Crie uma viagem do zero ou importe um esboço de roteiro em texto ou PDF."
          action={
            <div className="flex gap-2 justify-center">
              <Link to="/trips/new" className="btn-primary">Criar viagem</Link>
              <Link to="/import" className="btn-ghost">Importar roteiro</Link>
            </div>
          }
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {trips?.map(({ trip, days }) => {
          const cur = pickCurrentDay(days);
          return (
            <Link key={trip.id} to={`/trips/${trip.id}`} className="card hover:border-accent/60 transition block">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold truncate">{trip.title}</h2>
                  <p className="text-sm text-slate-400">
                    {trip.start_date ? `${formatDatePt(trip.start_date)} – ${formatDatePt(trip.end_date)}` : "sem datas"} · {days.length} {days.length === 1 ? "dia" : "dias"} · {trip.base_currency}
                  </p>
                </div>
                <span className={`text-xs rounded-full px-2 py-1 ${cur.mode === "active" ? "bg-ok/15 text-ok" : cur.mode === "done" ? "bg-panel text-slate-400" : "bg-accent/15 text-accent"}`}>
                  {cur.mode === "active" ? `Em viagem · Dia ${cur.day?.day_index}` : cur.mode === "done" ? "Concluída" : cur.mode === "undated" ? "Sem datas" : "Planejando"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
