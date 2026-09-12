import { Sparkles } from "lucide-react";
import type { AiSuggestion, TripDay } from "@turism/domain";
import { addActivity, addLinkAsset, setSuggestionStatus } from "@/db/repo";
import { db } from "@/db/schema";

/** Sugestão de IA: nada é gravado sem Aceitar (docs/03 §5.4). */
export function SuggestionCard({ s, days }: { s: AiSuggestion; days: TripDay[] }) {
  const p = s.payload as { title?: string; place_name?: string; start_time?: string; type?: string; image_url?: string; attribution?: string; url?: string; notes?: string };
  const day = days.find((d) => d.id === s.day_id) ?? null;
  async function accept() {
    if (s.kind === "image" && p.image_url && day) {
      await addLinkAsset(s.trip_id, { title: p.title ?? "Imagem de referência", url: p.image_url, category: "other", day_ids: [day.id] });
    } else if (day) {
      await addActivity(day, { title: p.title ?? "Sugestão", type: p.type ?? (s.kind === "stop" ? "transfer" : "visit"), start_time: p.start_time ?? null, place_name: p.place_name ?? null, notes: [p.notes, s.reason].filter(Boolean).join(" — ") || null });
    } else {
      const first = days[0] ?? (await db.trip_days.where("trip_id").equals(s.trip_id).first());
      if (first) await addActivity(first, { title: p.title ?? "Sugestão", type: p.type ?? "visit", place_name: p.place_name ?? null, notes: s.reason });
    }
    await setSuggestionStatus(s.id, "accepted");
  }
  return (
    <div className="card border-accent/30">
      <div className="flex gap-3">
        {p.image_url && <img src={p.image_url} alt="" className="h-20 w-20 rounded-xl object-cover" loading="lazy" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-accent flex items-center gap-1"><Sparkles size={12} /> {s.kind === "stop" ? "Parada estratégica" : s.kind === "poi" ? "Ponto de interesse" : s.kind === "image" ? "Imagem de referência" : "Atividade"}{day ? ` · Dia ${day.day_index}` : ""}</p>
          <p className="font-medium">{p.title}</p>
          {p.place_name && <p className="text-sm text-slate-400">{p.place_name}</p>}
          {s.reason && <p className="text-sm text-slate-300 mt-1">{s.reason}</p>}
          {p.attribution && <p className="text-[11px] text-slate-500 mt-1">{p.attribution}</p>}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button className="btn-primary flex-1" onClick={() => void accept()}>Aceitar</button>
        <button className="btn-ghost" onClick={() => void setSuggestionStatus(s.id, "dismissed")}>Descartar</button>
      </div>
    </div>
  );
}
