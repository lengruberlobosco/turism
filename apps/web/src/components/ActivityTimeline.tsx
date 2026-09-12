import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { ACTIVITY_TYPES, type Activity, type TripDay } from "@turism/domain";
import { addActivity, updateActivity, deleteActivity, moveActivity } from "@/db/repo";
import { Sheet, Field } from "./ui";

export function ActivityTimeline({ day, activities, nextId }: { day: TripDay; activities: Activity[]; nextId?: string | null }) {
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  return (
    <div>
      <ol className="relative">
        {activities.map((a, i) => {
          const type = ACTIVITY_TYPES.find((t) => t.id === a.type);
          const isNext = a.id === nextId;
          return (
            <li key={a.id} className={`flex gap-3 py-2 ${a.status === "done" ? "opacity-60" : ""}`}>
              <div className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-400 pt-1">{a.start_time ?? "—"}</div>
              <div className="relative flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full mt-1.5 ${a.status === "done" ? "bg-ok" : isNext ? "bg-accent ring-4 ring-accent/30" : "bg-line"}`} />
                {i < activities.length - 1 && <span className="flex-1 w-px bg-line" />}
              </div>
              <button className="flex-1 text-left min-w-0" onClick={() => setEditing(a)}>
                <p className={`text-sm font-medium ${a.status === "done" ? "line-through" : ""}`}>{type?.icon} {a.title}</p>
                {(a.place_name || a.notes) && <p className="text-xs text-slate-400 truncate">{[a.place_name, a.notes].filter(Boolean).join(" · ")}</p>}
              </button>
              <button className={`p-2 rounded-lg ${a.status === "done" ? "text-ok" : "text-slate-500"}`} aria-label={a.status === "done" ? "Desmarcar" : "Concluir"} onClick={() => void updateActivity(a.id, { status: a.status === "done" ? "planned" : "done" })}>
                <Check size={18} />
              </button>
            </li>
          );
        })}
      </ol>
      <button className="btn-ghost w-full mt-2" onClick={() => setEditing("new")}><Plus size={16} /> Atividade</button>
      <ActivitySheet day={day} activity={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} activities={activities} />
    </div>
  );
}

function ActivitySheet({ day, activity, open, onClose, activities }: { day: TripDay; activity: Activity | null; open: boolean; onClose: () => void; activities: Activity[] }) {
  const [title, setTitle] = useState(activity?.title ?? "");
  const [type, setType] = useState(activity?.type ?? "visit");
  const [start, setStart] = useState(activity?.start_time ?? "");
  const [end, setEnd] = useState(activity?.end_time ?? "");
  const [place, setPlace] = useState(activity?.place_name ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  const [key, setKey] = useState(activity?.id);
  if (key !== activity?.id) {
    setKey(activity?.id); setTitle(activity?.title ?? ""); setType(activity?.type ?? "visit"); setStart(activity?.start_time ?? ""); setEnd(activity?.end_time ?? ""); setPlace(activity?.place_name ?? ""); setNotes(activity?.notes ?? "");
  }
  const idx = activity ? activities.findIndex((a) => a.id === activity.id) : -1;
  async function save() {
    if (!title.trim()) return;
    const patch = { title: title.trim(), type, start_time: start || null, end_time: end || null, place_name: place || null, notes: notes || null };
    if (activity) await updateActivity(activity.id, patch);
    else await addActivity(day, patch);
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title={activity ? "Editar atividade" : "Nova atividade"}>
      <Field label="Título"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Trem Florença → Roma" /></Field>
      <Field group label="Tipo">
        <div className="flex flex-wrap gap-2">{ACTIVITY_TYPES.map((t) => <button key={t.id} type="button" className={type === t.id ? "chip-on" : "chip"} onClick={() => setType(t.id)}>{t.icon} {t.label}</button>)}</div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início"><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Fim"><input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Local"><input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Estação Santa Maria Novella, plataforma 6" /></Field>
      <Field label="Notas"><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex gap-2">
        {activity && (
          <>
            <button className="btn-ghost" disabled={idx <= 0} aria-label="Mover para cima" onClick={() => void moveActivity(activity.id, activities[idx - 2] ?? null, activities[idx - 1] ?? null).then(onClose)}><ArrowUp size={16} /></button>
            <button className="btn-ghost" disabled={idx < 0 || idx >= activities.length - 1} aria-label="Mover para baixo" onClick={() => void moveActivity(activity.id, activities[idx + 1] ?? null, activities[idx + 2] ?? null).then(onClose)}><ArrowDown size={16} /></button>
            <button className="btn-danger" aria-label="Excluir" onClick={() => void deleteActivity(activity.id).then(onClose)}><Trash2 size={16} /></button>
          </>
        )}
        <button className="btn-primary flex-1" onClick={() => void save()}>Salvar</button>
      </div>
    </Sheet>
  );
}
