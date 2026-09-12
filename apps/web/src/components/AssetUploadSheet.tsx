import { useState } from "react";
import { Sheet, Field } from "./ui";
import { ASSET_CATEGORIES, type TripDay } from "@turism/domain";
import { addFileAsset, addLinkAsset } from "@/db/repo";
import { parseExif } from "@turism/domain";

export function AssetUploadSheet({ open, onClose, tripId, days, defaultDayId, initialFiles, initialUrl }: { open: boolean; onClose: () => void; tripId: string; days: TripDay[]; defaultDayId?: string; initialFiles?: File[]; initialUrl?: string }) {
  const [mode, setMode] = useState<"file" | "link">(initialUrl ? "link" : "file");
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(initialUrl ? "map_link" : "hotel_voucher");
  const [critical, setCritical] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [expires, setExpires] = useState("");
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
        for (const f of files) await addFileAsset(tripId, f, { title: files.length === 1 && title ? title : f.name.replace(/\.[^.]+$/, ""), category, kind: category === "gps_route" ? "document" : undefined, critical, sensitive, day_ids: dayIds, expires_at: expires || null });
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
          <input className="input" type="file" multiple accept="application/pdf,image/*,audio/*,.gpx,.kml" onChange={async (e) => {
            const list = Array.from(e.target.files ?? []);
            setFiles(list);
            if (list.some((f) => /\.(gpx|kml)$/i.test(f.name))) setCategory("gps_route");
            else if (list.every((f) => f.type.startsWith("image/"))) setCategory("photo");
            // fotos com data EXIF: pré-seleciona o dia correspondente
            const dates = new Set<string>();
            for (const f of list.slice(0, 20)) if (/jpe?g/i.test(f.type)) { const d = parseExif(await f.slice(0, 256 * 1024).arrayBuffer()).date; if (d) dates.add(d); }
            const matched = days.filter((d) => d.date && dates.has(d.date)).map((d) => d.id);
            if (matched.length) setDayIds(matched);
          }} />
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
          {ASSET_CATEGORIES.filter((c) => (mode === "link" ? c.kind === "link" : c.kind !== "link" || c.id === "gps_route")).map((c) => (
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
      {mode === "file" && (category === "insurance" || category === "other" || category === "ticket") && (
        <Field label="Validade (passaporte, visto, seguro, CNH)" hint="Alertas 90, 30 e 7 dias antes da viagem e quando vencido.">
          <input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      )}
      {mode === "file" && <label className="flex items-center gap-2 mb-4 min-h-10"><input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} /> Sensível (passaporte, seguro): não é enviado à IA</label>}
      {err && <p className="text-danger text-sm mb-3">{err}</p>}
      <button className="btn-primary w-full" onClick={() => void save()} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
    </Sheet>
  );
}
