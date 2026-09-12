import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Phone, Pencil, Plus, Trash2 } from "lucide-react";
import type { Emergency, Trip, TripDay, CurrentDayResult } from "@turism/domain";
import { updateTrip } from "@/db/repo";
import { Field } from "@/components/ui";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };
const EMPTY: Emergency = { contacts: [], insurance: null, embassy: null, blood_type: null, allergies: null, medications: null, notes: null };

/** Cartão de emergência offline (docs/04 L14): leitura em alto contraste, edição simples. */
export function EmergencyPage() {
  const { trip } = useOutletContext<Ctx>();
  const data = trip.emergency ?? EMPTY;
  const [edit, setEdit] = useState(!trip.emergency);
  const [form, setForm] = useState<Emergency>(data);
  const set = <K extends keyof Emergency>(k: K, v: Emergency[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (!edit) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4 grid gap-3 text-lg">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold flex-1">🆘 Emergência</h1>
          <button className="btn-ghost" onClick={() => { setForm(data); setEdit(true); }}><Pencil size={16} /> Editar</button>
        </div>
        <div className="card bg-danger/10 border-danger/40">
          <p className="section-title mb-2">Contatos</p>
          {data.contacts.length === 0 && <p className="text-slate-400 text-base">Nenhum contato.</p>}
          {data.contacts.map((c, i) => (
            <a key={i} href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 py-2 border-t border-line/40 first:border-0">
              <Phone size={20} className="text-danger" />
              <span className="flex-1">{c.name}{c.relation ? <span className="text-slate-400 text-base"> · {c.relation}</span> : null}</span>
              <span className="tabular-nums">{c.phone}</span>
            </a>
          ))}
        </div>
        {data.insurance && (
          <div className="card"><p className="section-title mb-1">Seguro</p><p>{data.insurance.company} · apólice {data.insurance.policy}</p><a className="text-accent" href={`tel:${data.insurance.phone.replace(/\s/g, "")}`}>{data.insurance.phone}</a></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="card"><p className="section-title mb-1">Tipo sanguíneo</p><p className="text-3xl font-bold">{data.blood_type ?? "—"}</p></div>
          <div className="card"><p className="section-title mb-1">Alergias</p><p>{data.allergies ?? "—"}</p></div>
        </div>
        {data.medications && <div className="card"><p className="section-title mb-1">Medicamentos</p><p>{data.medications}</p></div>}
        {data.embassy && <div className="card"><p className="section-title mb-1">Embaixada / consulado</p><p className="whitespace-pre-line">{data.embassy}</p></div>}
        {data.notes && <div className="card"><p className="section-title mb-1">Observações</p><p className="whitespace-pre-line">{data.notes}</p></div>}
        <p className="text-xs text-slate-500">Disponível offline. Frases úteis: “Preciso de ajuda” · “I need help” · “Necesito ayuda” · “J’ai besoin d’aide” · “Ho bisogno di aiuto”.</p>
      </div>
    );
  }

  return (
    <form className="max-w-2xl mx-auto px-4 py-4" onSubmit={(e) => { e.preventDefault(); void updateTrip(trip.id, { emergency: form }).then(() => setEdit(false)); }}>
      <h1 className="text-xl font-semibold mb-3">Cartão de emergência</h1>
      <Field group label="Contatos">
        <div className="grid gap-2">
          {form.contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className="input" placeholder="Nome" value={c.name} onChange={(e) => set("contacts", form.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input" placeholder="+55 11 99999-9999" inputMode="tel" value={c.phone} onChange={(e) => set("contacts", form.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
              <button type="button" className="btn-ghost" aria-label="Remover" onClick={() => set("contacts", form.contacts.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => set("contacts", [...form.contacts, { name: "", phone: "", relation: null }])}><Plus size={16} /> Contato</button>
        </div>
      </Field>
      <Field group label="Seguro viagem">
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="Seguradora" value={form.insurance?.company ?? ""} onChange={(e) => set("insurance", { company: e.target.value, policy: form.insurance?.policy ?? "", phone: form.insurance?.phone ?? "" })} />
          <input className="input" placeholder="Apólice" value={form.insurance?.policy ?? ""} onChange={(e) => set("insurance", { company: form.insurance?.company ?? "", policy: e.target.value, phone: form.insurance?.phone ?? "" })} />
          <input className="input" placeholder="Telefone" inputMode="tel" value={form.insurance?.phone ?? ""} onChange={(e) => set("insurance", { company: form.insurance?.company ?? "", policy: form.insurance?.policy ?? "", phone: e.target.value })} />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo sanguíneo"><input className="input" placeholder="O+" value={form.blood_type ?? ""} onChange={(e) => set("blood_type", e.target.value || null)} /></Field>
        <Field label="Alergias"><input className="input" value={form.allergies ?? ""} onChange={(e) => set("allergies", e.target.value || null)} /></Field>
      </div>
      <Field label="Medicamentos"><input className="input" value={form.medications ?? ""} onChange={(e) => set("medications", e.target.value || null)} /></Field>
      <Field label="Embaixada / consulado"><textarea className="input" rows={2} value={form.embassy ?? ""} onChange={(e) => set("embassy", e.target.value || null)} /></Field>
      <Field label="Observações"><textarea className="input" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></Field>
      <div className="flex gap-2">
        {trip.emergency && <button type="button" className="btn-ghost" onClick={() => setEdit(false)}>Cancelar</button>}
        <button className="btn-primary flex-1" type="submit">Salvar</button>
      </div>
    </form>
  );
}
