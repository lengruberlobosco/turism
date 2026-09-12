import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Bottom sheet (mobile) / modal (desktop). */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-panel border border-line shadow-2xl safe-bottom`}>
        <div className="sticky top-0 bg-panel/95 backdrop-blur flex items-center gap-2 px-4 py-3 border-b border-line/60">
          <div className="mx-auto sm:hidden absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-line" />
          <h2 className="font-semibold text-base flex-1 pt-1">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-lg hover:bg-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  // `group`: conjunto de chips/botões — usa div+aria-label para não herdar o rótulo no nome acessível de cada botão
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block mb-3" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </Tag>
  );
}

export function Empty({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card text-center py-8">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-ink overflow-hidden">
      <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
