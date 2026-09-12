import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Link2 } from "lucide-react";
import { ASSET_CATEGORIES, type Trip, type TripDay, type CurrentDayResult, type Asset } from "@turism/domain";
import { useTripAssets, useAssetLinks } from "@/lib/hooks";
import { AssetRow } from "@/components/AssetRow";
import { AssetViewer } from "@/components/AssetViewer";
import { AssetUploadSheet } from "@/components/AssetUploadSheet";
import { Sheet, Empty } from "@/components/ui";
import { deleteAsset, linkAssetToDay, unlinkAssetFromDay, updateAsset } from "@/db/repo";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

export function DocumentsPage() {
  const { trip, days, current } = useOutletContext<Ctx>();
  const assets = useTripAssets(trip.id);
  const links = useAssetLinks(trip.id);
  const [filter, setFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [viewer, setViewer] = useState<number | null>(null);
  const [upload, setUpload] = useState(false);
  const [linking, setLinking] = useState<Asset | null>(null);

  const linksByAsset = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) m.set(l.asset_id, (m.get(l.asset_id) ?? new Set()).add(l.day_id));
    return m;
  }, [links]);

  const list = assets.filter((a) => (filter === "all" || a.category === filter) && (dayFilter === "all" || (dayFilter === "none" ? !linksByAsset.get(a.id)?.size : linksByAsset.get(a.id)?.has(dayFilter))));
  const bytes = assets.reduce((s, a) => s + (a.size_bytes ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <h1 className="text-xl font-semibold flex-1">Documentos <span className="text-sm text-slate-500 font-normal">{assets.length} · {(bytes / 1024 / 1024).toFixed(1)} MB no dispositivo</span></h1>
        <button className="btn-primary" onClick={() => setUpload(true)}><Plus size={18} /> Adicionar</button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <button className={filter === "all" ? "chip-on" : "chip"} onClick={() => setFilter("all")}>Todos</button>
        {ASSET_CATEGORIES.map((c) => <button key={c.id} className={filter === c.id ? "chip-on" : "chip"} onClick={() => setFilter(c.id)}>{c.icon} {c.label}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
        <button className={dayFilter === "all" ? "chip-on" : "chip"} onClick={() => setDayFilter("all")}>Qualquer dia</button>
        {days.map((d) => <button key={d.id} className={dayFilter === d.id ? "chip-on" : "chip"} onClick={() => setDayFilter(d.id)}>Dia {d.day_index}{current.day?.id === d.id ? " ●" : ""}</button>)}
        <button className={dayFilter === "none" ? "chip-on" : "chip"} onClick={() => setDayFilter("none")}>Sem dia</button>
      </div>
      {list.length === 0 ? (
        <Empty icon="📂" title="Nada por aqui" hint="Adicione vouchers, passagens, ingressos, fotos, áudios e links; depois vincule aos dias." action={<button className="btn-primary" onClick={() => setUpload(true)}>Adicionar</button>} />
      ) : (
        <div className="grid gap-2">
          {list.map((a, i) => (
            <AssetRow
              key={a.id}
              asset={a}
              onOpen={() => setViewer(i)}
              trailing={
                <>
                  <button className="p-2 rounded-lg text-slate-400 hover:text-accent" aria-label="Vincular a dias" title={`Dias: ${[...(linksByAsset.get(a.id) ?? [])].map((id) => days.find((d) => d.id === id)?.day_index).filter(Boolean).join(", ") || "nenhum"}`} onClick={() => setLinking(a)}>
                    <Link2 size={16} /> <span className="text-xs">{linksByAsset.get(a.id)?.size ?? 0}</span>
                  </button>
                  <button className="p-2 rounded-lg text-slate-500 hover:text-danger" aria-label="Excluir" onClick={() => { if (confirm(`Excluir “${a.title}”?`)) void deleteAsset(a.id); }}><Trash2 size={16} /></button>
                </>
              }
            />
          ))}
        </div>
      )}
      {viewer !== null && <AssetViewer assets={list} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}
      <AssetUploadSheet open={upload} onClose={() => setUpload(false)} tripId={trip.id} days={days} defaultDayId={current.day?.id} />
      <Sheet open={linking !== null} onClose={() => setLinking(null)} title={linking ? `Vincular “${linking.title}”` : ""}>
        {linking && (
          <div className="grid gap-2">
            {days.map((d) => {
              const on = linksByAsset.get(linking.id)?.has(d.id);
              return (
                <button key={d.id} className={`${on ? "chip-on" : "chip"} justify-start py-3`} onClick={() => void (on ? unlinkAssetFromDay(linking.id, d.id) : linkAssetToDay(linking, d.id))}>
                  Dia {d.day_index} {d.date ? `· ${d.date}` : ""} {d.title ? `· ${d.title}` : ""}
                </button>
              );
            })}
            <label className="flex items-center gap-2 mt-3 min-h-10"><input type="checkbox" checked={linking.critical} onChange={(e) => void updateAsset(linking.id, { critical: e.target.checked }).then(() => setLinking({ ...linking, critical: e.target.checked }))} /> Crítico (prioridade offline e no card “Agora”)</label>
          </div>
        )}
      </Sheet>
    </div>
  );
}
