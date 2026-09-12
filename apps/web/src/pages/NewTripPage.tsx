import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Field } from "@/components/ui";
import { createTrip, defaultTimezone } from "@/db/repo";
import { CURRENCIES } from "@turism/domain";
import { refreshRates } from "@/sync/fx";

export function NewTripPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [tz, setTz] = useState(defaultTimezone());
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setErr("Dê um nome à viagem.");
    if (start && end && end < start) return setErr("A data final deve ser depois da inicial.");
    const trip = await createTrip({ title, start_date: start || null, end_date: end || start || null, base_currency: currency, timezone: tz });
    if (navigator.onLine) refreshRates(currency).catch(() => {});
    nav(`/trips/${trip.id}`);
  }

  return (
    <form onSubmit={submit} className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Nova viagem</h1>
      <Field label="Nome">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Expedição Patagônia 2026" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início" hint="Opcional: sem datas, os dias ficam relativos (Dia 1, Dia 2…)">
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Fim">
          <input className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Moeda base (planilha final)">
        <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Fuso horário dos dias" hint="Pode ser ajustado dia a dia depois (voos longos, fronteiras).">
        <input className="input" value={tz} onChange={(e) => setTz(e.target.value)} list="tz" />
        <datalist id="tz">
          {["America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/Santiago", "America/New_York", "Europe/Lisbon", "Europe/Madrid", "Europe/Paris", "Europe/Rome", "Europe/London", "Asia/Tokyo"].map((z) => <option key={z} value={z} />)}
        </datalist>
      </Field>
      {err && <p className="text-danger text-sm mb-3">{err}</p>}
      <button className="btn-primary w-full" type="submit">Criar viagem</button>
    </form>
  );
}
