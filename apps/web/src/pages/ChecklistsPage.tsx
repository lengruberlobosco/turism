import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { CHECKLIST_KINDS, type ChecklistKind, type Trip, type TripDay, type CurrentDayResult } from "@turism/domain";
import { useChecklist } from "@/lib/hooks";
import { addChecklistItem, applyChecklistTemplate, deleteChecklistItem, toggleChecklistItem } from "@/db/repo";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

export function ChecklistsPage() {
  const { trip, days, current } = useOutletContext<Ctx>();
  const [kind, setKind] = useState<ChecklistKind>("packing");
  const [dayId, setDayId] = useState<string | null>(current.day?.id ?? days[0]?.id ?? null);
  const scopeDay = kind === "day" ? dayId : null;
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 grid gap-4">
      <h1 className="text-xl font-semibold">Checklists</h1>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
        {CHECKLIST_KINDS.map((k) => <button key={k.id} className={kind === k.id ? "chip-on" : "chip"} onClick={() => setKind(k.id)}>{k.icon} {k.label}</button>)}
      </div>
      {kind === "day" && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {days.map((d) => <button key={d.id} className={dayId === d.id ? "chip-on" : "chip"} onClick={() => setDayId(d.id)}>Dia {d.day_index}</button>)}
        </div>
      )}
      <Checklist tripId={trip.id} kind={kind} dayId={scopeDay} />
    </div>
  );
}

/** Lista reutilizável (também aparece na tela do dia). */
export function Checklist({ tripId, kind, dayId, compact }: { tripId: string; kind: ChecklistKind; dayId: string | null; compact?: boolean }) {
  const items = useChecklist(tripId, kind, dayId);
  const [text, setText] = useState("");
  const done = items.filter((i) => i.done).length;
  return (
    <section className={compact ? "" : "card"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-2">
          <h2 className="section-title flex-1">{done}/{items.length} concluídos</h2>
          {kind !== "day" && <button className="btn-ghost py-2 min-h-10" onClick={() => void applyChecklistTemplate(tripId, kind)}><Wand2 size={14} /> Usar modelo</button>}
        </div>
      )}
      <ul className="grid gap-1">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 min-h-11">
            <label className="flex items-center gap-3 flex-1 cursor-pointer">
              <input type="checkbox" className="h-5 w-5 accent-sky-400" checked={i.done} onChange={() => void toggleChecklistItem(i.id)} />
              <span className={i.done ? "line-through text-slate-500" : ""}>{i.text}</span>
            </label>
            <button className="p-2 text-slate-600 hover:text-danger" aria-label="Remover" onClick={() => void deleteChecklistItem(i.id)}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (!v) return; setText(""); void addChecklistItem(tripId, kind, v, dayId); }}>
        <input className="input min-h-10 py-2" placeholder={kind === "day" ? "Ex.: confirmar horário do trem" : "Novo item"} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-ghost min-h-10 py-2" type="submit" aria-label="Adicionar"><Plus size={16} /></button>
      </form>
    </section>
  );
}
