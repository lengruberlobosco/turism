import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, X, ZoomIn } from "lucide-react";
import type { Asset } from "@turism/domain";
import { useBlob } from "@/lib/hooks";
import { assetCategoryMeta, isTrackFile, parseTrack, trackToSvgPath, type Track } from "@turism/domain";

/**
 * Modo balcão (docs/03 §5.2): tela cheia, alto contraste, "Próximo documento" percorre os do dia.
 */
export function AssetViewer({ assets, index, onClose, onIndex }: { assets: Asset[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const asset = assets[index];
  const blob = useBlob(asset?.kind === "link" ? undefined : asset?.id);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const [zoom, setZoom] = useState(false);
  const isTrack = !!asset && asset.kind !== "link" && isTrackFile(asset.title + (asset.mime?.includes("kml") ? ".kml" : asset.mime?.includes("gpx") ? ".gpx" : ""), asset.mime);
  const [track, setTrack] = useState<Track | null>(null);
  useEffect(() => {
    setTrack(null);
    if (!isTrack || !blob) return;
    let alive = true;
    void blob.text().then((xml) => { if (alive) setTrack(parseTrack(xml)); }).catch(() => {});
    return () => { alive = false; };
  }, [blob, isTrack]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % assets.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + assets.length) % assets.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, assets.length, onClose, onIndex]);
  if (!asset) return null;
  const meta = assetCategoryMeta(asset.category);
  const isImage = asset.mime?.startsWith("image/");
  const isPdf = asset.mime === "application/pdf";
  const isAudio = asset.mime?.startsWith("audio/");

  return (
    <div className="fixed inset-0 z-50 bg-white text-black flex flex-col" role="dialog" aria-modal="true" aria-label={asset.title}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white">
        <span className="text-xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{asset.title}</p>
          <p className="text-xs text-slate-500">{meta.label}{asset.critical ? " · crítico" : ""}{blob ? " · disponível offline" : asset.kind === "link" ? "" : " · não baixado"}</p>
        </div>
        {isImage && <button onClick={() => setZoom((z) => !z)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Ampliar"><ZoomIn size={20} /></button>}
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Fechar"><X size={22} /></button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center bg-white">
        {asset.kind === "link" && (
          <div className="text-center p-6">
            <p className="mb-4 break-all text-slate-600">{asset.url}</p>
            <a href={asset.url ?? "#"} target="_blank" rel="noreferrer" className="btn-primary"><ExternalLink size={18} /> Abrir no app de mapas</a>
            <p className="text-xs text-slate-500 mt-3">Links abrem o aplicativo do dispositivo; rotas offline exigem mapa baixado no app de mapas.</p>
          </div>
        )}
        {asset.kind !== "link" && !url && <p className="text-slate-500 p-6">Arquivo ainda não está neste dispositivo. Conecte-se e use “Preparar para offline”.</p>}
        {url && isTrack && track && <TrackView track={track} />}
        {url && isTrack && !track && <p className="text-slate-500 p-6">Lendo rota…</p>}
        {url && !isTrack && isImage && <img src={url} alt={asset.title} className={`${zoom ? "max-w-none w-[200%]" : "max-w-full max-h-full"} object-contain`} />}
        {url && isPdf && <iframe src={url} title={asset.title} className="w-full h-full" />}
        {url && isAudio && <audio src={url} controls className="w-full max-w-md mx-4" />}
        {url && !isTrack && !isImage && !isPdf && !isAudio && (
          <a href={url} download={asset.title} className="btn-primary">Baixar arquivo</a>
        )}
      </div>
      {assets.length > 1 && (
        <div className="border-t border-slate-200 p-3 flex items-center gap-2 bg-white safe-bottom">
          <span className="text-sm text-slate-500">{index + 1} / {assets.length}</span>
          <button onClick={() => onIndex((index + 1) % assets.length)} className="btn-primary ml-auto">Próximo documento <ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}

/** Trilha GPX/KML desenhada offline (sem tiles) com estatísticas e atalho para o app de mapas. */
function TrackView({ track }: { track: Track }) {
  const W = 800, H = 500;
  const path = trackToSvgPath(track, W, H, 24);
  const start = track.points[0], end = track.points[track.points.length - 1];
  const nav = start && end ? `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=driving` : null;
  return (
    <div className="w-full max-w-3xl p-4 text-black">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-slate-200 bg-slate-50" role="img" aria-label={`Trilha ${track.name ?? ""}`}>
        <path d={path} fill="none" stroke="#0284c7" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {start && <circle r="8" fill="#16a34a" cx={path.split(" ")[0]?.slice(1)} cy={path.split(" ")[1]} />}
        {end && <circle r="8" fill="#dc2626" cx={path.split(" ").slice(-2)[0]?.slice(1)} cy={path.split(" ").slice(-1)[0]} />}
      </svg>
      <div className="flex flex-wrap gap-3 mt-3 text-sm">
        <span className="chip border-slate-300">📏 {track.distance_km} km</span>
        <span className="chip border-slate-300">⛰ +{track.ascent_m} m / −{track.descent_m} m</span>
        <span className="chip border-slate-300">📍 {track.points.length} pontos{track.waypoints.length ? ` · ${track.waypoints.length} waypoints` : ""}</span>
      </div>
      {track.waypoints.length > 0 && <p className="text-xs text-slate-600 mt-2">Waypoints: {track.waypoints.map((w) => w.name || `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join(" · ")}</p>}
      {nav && <a href={nav} target="_blank" rel="noreferrer" className="btn-primary mt-3"><ExternalLink size={18} /> Navegar (início → fim)</a>}
      <p className="text-xs text-slate-500 mt-2">Traçado exibido sem mapa de fundo para funcionar offline; a navegação usa o app de mapas do dispositivo.</p>
    </div>
  );
}
