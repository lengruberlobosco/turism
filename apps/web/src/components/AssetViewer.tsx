import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, X, ZoomIn } from "lucide-react";
import type { Asset } from "@turism/domain";
import { useBlob } from "@/lib/hooks";
import { assetCategoryMeta } from "@turism/domain";

/**
 * Modo balcão (docs/03 §5.2): tela cheia, alto contraste, "Próximo documento" percorre os do dia.
 */
export function AssetViewer({ assets, index, onClose, onIndex }: { assets: Asset[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const asset = assets[index];
  const blob = useBlob(asset?.kind === "link" ? undefined : asset?.id);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const [zoom, setZoom] = useState(false);
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
        {url && isImage && <img src={url} alt={asset.title} className={`${zoom ? "max-w-none w-[200%]" : "max-w-full max-h-full"} object-contain`} />}
        {url && isPdf && <iframe src={url} title={asset.title} className="w-full h-full" />}
        {url && isAudio && <audio src={url} controls className="w-full max-w-md mx-4" />}
        {url && !isImage && !isPdf && !isAudio && (
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
