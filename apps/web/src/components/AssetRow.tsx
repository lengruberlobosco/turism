import { Check, Download, Link2, Star } from "lucide-react";
import { assetCategoryMeta, expiryLevel, expiryLabel, type Asset } from "@turism/domain";
import { useBlob } from "@/lib/hooks";

export function AssetRow({ asset, onOpen, lit, priority, onTogglePriority, trailing }: { asset: Asset; onOpen: () => void; lit?: boolean; priority?: number; onTogglePriority?: () => void; trailing?: React.ReactNode }) {
  const blob = useBlob(asset.kind === "link" ? undefined : asset.id, true);
  const meta = assetCategoryMeta(asset.category);
  const offline = asset.kind === "link" || !!blob;
  const thumbUrl = blob && asset.kind === "photo" ? URL.createObjectURL(blob) : null;
  const today = new Date().toISOString().slice(0, 10);
  const level = expiryLevel(asset.expires_at, today);
  const expiry = expiryLabel(level, asset.expires_at, today);
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-ink/60 px-3 py-2 ${lit ? "lit" : ""} ${asset.critical ? "border border-warn/40" : "border border-transparent"}`}>
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-12" aria-label={`${asset.title}, ${meta.label}${offline ? ", disponível offline" : ", não baixado"}`}>
        {thumbUrl ? <img src={thumbUrl} alt="" className="h-10 w-10 rounded-lg object-cover" onLoad={() => URL.revokeObjectURL(thumbUrl)} /> : <span className="text-2xl w-10 text-center">{meta.icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{asset.title}</p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            {meta.label}
            {asset.kind === "link" ? <Link2 size={12} /> : offline ? <span className="inline-flex items-center gap-0.5 text-ok"><Check size={12} /> offline</span> : <span className="inline-flex items-center gap-0.5 text-slate-500"><Download size={12} /> não baixado</span>}
            {asset.ocr?.amount != null && <span className="text-accent">· OCR {asset.ocr.amount.toFixed(2)} {asset.ocr.currency ?? ""}</span>}
            {expiry && <span className={level === "expired" || level === "critical" ? "text-danger" : level === "warning" ? "text-warn" : "text-slate-400"}>· {expiry}</span>}
          </p>
        </div>
      </button>
      {onTogglePriority && (
        <button onClick={onTogglePriority} className={`p-2 rounded-lg ${priority ? "text-warn" : "text-slate-500"}`} aria-label={priority ? "Remover destaque" : "Destacar no dia"} title="Destacar no dia">
          <Star size={16} fill={priority ? "currentColor" : "none"} />
        </button>
      )}
      {trailing}
    </div>
  );
}
