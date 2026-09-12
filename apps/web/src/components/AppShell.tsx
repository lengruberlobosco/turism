import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { CloudOff, RefreshCw, Settings } from "lucide-react";
import { useOnline } from "@/lib/network";
import { onSyncStatus, syncNow, type SyncStatus } from "@/sync/engine";
import { isCloudConfigured } from "@/lib/supabase";

export function AppShell({ children }: { children: ReactNode }) {
  const online = useOnline();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const loc = useLocation();
  useEffect(() => onSyncStatus(setSync), []);
  const inTrip = loc.pathname.startsWith("/trips/") && !loc.pathname.endsWith("/new");
  return (
    <div className="min-h-full flex flex-col">
      {!inTrip && (
        <header className="safe-top sticky top-0 z-20 bg-ink/90 backdrop-blur border-b border-line/60">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/" className="font-semibold tracking-tight text-lg">
              <span className="text-accent">✈</span> Turism
            </Link>
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <StatusPill online={online} sync={sync} />
              <Link to="/settings" aria-label="Configurações" className="p-2 rounded-lg hover:bg-panel">
                <Settings size={18} />
              </Link>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export function StatusPill({ online, sync }: { online: boolean; sync: SyncStatus | null }) {
  if (!online)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 text-warn px-2 py-1" title="Você está offline. Tudo continua funcionando.">
        <CloudOff size={14} /> offline
      </span>
    );
  if (!isCloudConfigured) return <span className="rounded-full bg-panel px-2 py-1">local</span>;
  return (
    <button className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-1" onClick={() => void syncNow()} title={sync?.error ?? "Sincronizar agora"}>
      <RefreshCw size={14} className={sync?.running ? "animate-spin" : ""} />
      {sync?.pending ? `${sync.pending} pendentes` : "sincronizado"}
    </button>
  );
}
