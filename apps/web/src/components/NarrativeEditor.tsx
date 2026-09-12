import { useEffect, useRef, useState } from "react";
import { updateDay } from "@/db/repo";
import type { TripDay } from "@turism/domain";

/** Editor inline com autosave (docs/03 §5.5). */
export function NarrativeEditor({ day, field, placeholder }: { day: TripDay; field: "narrative" | "logistics_notes"; placeholder: string }) {
  const [value, setValue] = useState(day[field] ?? "");
  const [saved, setSaved] = useState(true);
  const timer = useRef<number>(undefined);
  const lastDay = useRef(day.id);
  useEffect(() => {
    if (lastDay.current !== day.id) {
      lastDay.current = day.id;
      setValue(day[field] ?? "");
      setSaved(true);
    }
  }, [day, field]);
  function onChange(v: string) {
    setValue(v);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await updateDay(day.id, { [field]: v || null });
      setSaved(true);
    }, 600);
  }
  return (
    <div>
      <textarea className="input min-h-28 leading-relaxed" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <p className="text-[11px] text-slate-500 text-right mt-1">{saved ? "salvo no dispositivo" : "salvando…"}</p>
    </div>
  );
}
