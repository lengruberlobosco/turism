import { useState } from "react";
import { Sheet, Field } from "./ui";
import { ASSET_CATEGORIES, type TripDay } from "@turism/domain";
import { addFileAsset, addLinkAsset } from "@/db/repo";

export function AssetUploadSheet({ open, onClose, tripId, days, defaultDayId, initialFiles, initialUrl }: { open: boolean; onClose: () => void; tripId: string; days: TripDay[]; defaultDayId?: string; initialFiles?: File[]; initialUrl?: string }) {
  const [mode, setMode] = useState<"file" | "link">(initialUrl ? "link" : "file");
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(initialUrl ? "map_link" : "hotel_voucher");
  const [critical, setCritical] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [dayIds, setDayIds] = useState<string[]>(defaultDayId ? [defaultDayId] : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (id: string) => setDayIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "link") {
        if (!/^https?:\/\//i.test(url)) throw new Error("Informe um link válido (https://…).");
        await addLinkAsset(tripId, { title: title || url, url, category, day_ids: dayIds, critical });
      } else {
        if (files.length === 0) throw new Error("Escolha ao menos um arquivo.");
        for (const f of files) await addFileAsset(tripId, f, { title: files.length === 1 && title ? title : f.name.replace(/\.[^.]+$/, ""), category, critical, sensitive, day_ids: dayIds });
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Adicionar documento, mídia ou link">
      <div className="flex gap-2 mb-4">
        <button className={mode === "file" ? "chip-on" : "chip"} onClick={() => { setMode("file"); setCategory("hotel_voucher"); }}>Arquivo / foto / áudio</button>
        <button className={mode === "link" ? "chip-on" : "chip"} onClick={() => { setMode("link"); setCategory("map_link"); }}>Link (mapa, rota GPS)</button>
      </div>
      {mode === "file" ? (
        <Field label="Arquivos" hint="PDF, imagens, áudios. Fotos são comprimidas; tudo fica guardado no dispositivo para uso offline.">
          <input className="input" type="file" multiple accept="application/pdf,image/*,audio/*,.gpx,.kml" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          {files.length > 0 && <p className="text-xs text-slate-400 mt-1">{files.length} arquivo(s) · {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB</p>}
        </Field>
      ) : (
        <Field label="URL">
          <input className="input" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
      )}
      <Field label="Título">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "file" ? "Voucher Hotel Roma" : "Rota Roma centro"} />
      </Field>
      <Field group label="Categoria">
        <div className="flex flex-wrap gap-2">
          {ASSET_CATEGORIES.filter((c) => (mode === "link" ? c.kind === "link" : c.kind !== "link")).map((c) => (
            <button key={c.id} type="button" className={category === c.id ? "chip-on" : "chip"} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</button>
          ))}
        </div>
      </Field>
      <Field group label="Vincular aos dias" hint="Documentos ligados a um dia “acendem” automaticamente nele.">
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button key={d.id} type="button" className={dayIds.includes(d.id) ? "chip-on" : "chip"} onClick={() => toggleDay(d.id)}>Dia {d.day_index}{d.date ? ` · ${d.date.slice(5).replace("-", "/")}` : ""}</button>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-2 mb-2 min-h-10"><input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Crítico (passagem, voucher): prioridade no offline e destaque no card “Agora”</label>
      {mode === "file" && <label className="flex items-center gap-2 mb-4 min-h-10"><input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} /> Sensível (passaporte, seguro): não é enviado à IA</label>}
      {err && <p className="text-danger text-sm mb-3">{err}</p>}
      <button className="btn-primary w-full" onClick={() => void save()} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
    </Sheet>
  );
}
