import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { CalendarDays, FolderOpen, Wallet, Sparkles, ChevronLeft, Settings } from "lucide-react";
import { useTrip, useDays, useSuggestions } from "@/lib/hooks";
import { useOnline } from "@/lib/network";
import { useEffect, useState } from "react";
import { onSyncStatus, type SyncStatus } from "@/sync/engine";
import { StatusPill } from "@/components/AppShell";
import { pickCurrentDay } from "@turism/domain";

export function TripLayout() {
  const { tripId } = useParams();
  const trip = useTrip(tripId);
  const days = useDays(tripId);
  const suggestions = useSuggestions(tripId);
  const online = useOnline();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  useEffect(() => onSyncStatus(setSync), []);
  if (trip === undefined) return <div className="p-6 text-slate-400">Carregando…</div>;
  if (!trip) return <div className="p-6">Viagem não encontrada. <Link to="/" className="text-accent">Voltar</Link></div>;
  const current = pickCurrentDay(days);

  const tabs = [
    { to: "days/current", icon: CalendarDays, label: "Dia" },
    { to: "documents", icon: FolderOpen, label: "Docs" },
    { to: "expenses", icon: Wallet, label: "Gastos" },
    { to: "suggestions", icon: Sparkles, label: "IA", badge: suggestions.length },
  ];
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[240px_1fr]">
      {/* coluna esquerda (desktop): navegação por dias e módulos */}
      <aside className="hidden lg:flex flex-col border-r border-line/60 bg-ink sticky top-0 h-screen overflow-y-auto p-4 gap-1">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 mb-2"><ChevronLeft size={14} /> Viagens</Link>
        <h1 className="font-semibold text-lg leading-tight mb-3 truncate" title={trip.title}>{trip.title}</h1>
        <p className="section-title mb-1">Dias</p>
        {days.map((d) => (
          <NavLink key={d.id} to={`days/${d.day_index}`} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${isActive ? "bg-panel text-accent" : "hover:bg-panel/60"}`}>
            <span className={`h-2 w-2 rounded-full ${current.day?.id === d.id ? "bg-ok" : "bg-line"}`} />
            Dia {d.day_index} <span className="text-slate-500 ml-auto">{d.date?.slice(5).replace("-", "/") ?? ""}</span>
          </NavLink>
        ))}
        <p className="section-title mt-4 mb-1">Módulos</p>
        {tabs.slice(1).map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${isActive ? "bg-panel text-accent" : "hover:bg-panel/60"}`}>
            <t.icon size={16} /> {t.label} {t.badge ? <span className="ml-auto text-xs rounded-full bg-accent/20 text-accent px-2">{t.badge}</span> : null}
          </NavLink>
        ))}
        <NavLink to="/settings" className="rounded-lg px-3 py-2 text-sm flex items-center gap-2 hover:bg-panel/60 mt-auto"><Settings size={16} /> Offline e configurações</NavLink>
      </aside>

      <div className="flex flex-col min-h-full">
        {/* cabeçalho mobile */}
        <header className="safe-top sticky top-0 z-20 bg-ink/90 backdrop-blur border-b border-line/60 lg:hidden">
          <div className="px-3 h-14 flex items-center gap-2">
            <Link to="/" aria-label="Voltar" className="p-2 -ml-2 rounded-lg hover:bg-panel"><ChevronLeft size={20} /></Link>
            <h1 className="font-semibold truncate flex-1">{trip.title}</h1>
            <StatusPill online={online} sync={sync} />
          </div>
        </header>
        <div className="flex-1 pb-24 lg:pb-8">
          <Outlet context={{ trip, days, current }} />
        </div>
        {/* barra inferior mobile */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-ink/95 backdrop-blur border-t border-line/60 safe-bottom pt-1">
          <div className="grid grid-cols-4">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-1.5 text-[11px] relative ${isActive ? "text-accent" : "text-slate-400"}`}>
                <t.icon size={20} /> {t.label}
                {t.badge ? <span className="absolute top-0 right-1/4 text-[10px] rounded-full bg-accent text-ink px-1.5">{t.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
