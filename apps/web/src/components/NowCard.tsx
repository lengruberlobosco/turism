import { ExternalLink, FileText, Navigation } from "lucide-react";
import { minutesUntil, type Activity, type Asset, type TripDay } from "@turism/domain";

/** Card "Agora" (docs/03 §3): próxima atividade, contagem regressiva, documento crítico a um toque. */
export function NowCard({ day, next, docs, onOpenDoc, active }: { day: TripDay; next: Activity | null; docs: Asset[]; onOpenDoc: (a: Asset) => void; active: boolean }) {
  if (!next) {
    return (
      <div className="card bg-gradient-to-br from-panel to-ink">
        <p className="section-title mb-1">Agora</p>
        <p className="text-slate-300">{active ? "Nenhuma atividade pendente hoje." : "Sem atividades planejadas para este dia."}</p>
      </div>
    );
  }
  const mins = next.start_time ? minutesUntil(next.start_time, day.timezone) : null;
  const critical = docs.filter((d) => d.critical);
  const relevant = critical[0] ?? docs[0];
  const mapLink = docs.find((d) => d.kind === "link");
  const mapsUrl = next.place_name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.place_name)}` : null;
  return (
    <div className="card border-accent/40 bg-gradient-to-br from-panel to-ink">
      <p className="section-title mb-1">Agora</p>
      <div className="flex items-baseline gap-3">
        {next.start_time && <span className="text-2xl font-semibold tabular-nums">{next.start_time}</span>}
        <p className="text-lg font-medium flex-1">{next.title}</p>
      </div>
      <p className="text-sm text-slate-400 mt-1">
        {next.place_name ? `${next.place_name} · ` : ""}
        {mins != null && active ? (mins > 0 ? `começa em ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}` : mins > -120 ? "em andamento" : "hoje") : ""}
      </p>
      <div className="flex gap-2 mt-3 flex-wrap">
        {relevant && <button className="btn-primary" onClick={() => onOpenDoc(relevant)}><FileText size={18} /> {relevant.kind === "link" ? "Abrir rota" : "Abrir documento"}</button>}
        {mapLink && mapLink.id !== relevant?.id && <a className="btn-ghost" href={mapLink.url ?? "#"} target="_blank" rel="noreferrer"><Navigation size={18} /> Rota</a>}
        {!mapLink && mapsUrl && <a className="btn-ghost" href={mapsUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Mapa</a>}
      </div>
    </div>
  );
}
