import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Sparkles, FileInput } from "lucide-react";
import type { Trip, TripDay, CurrentDayResult } from "@turism/domain";
import { useSuggestions } from "@/lib/hooks";
import { SuggestionCard } from "@/components/SuggestionCard";
import { Empty } from "@/components/ui";
import { requestSuggestions } from "@/ai";
import { isCloudConfigured } from "@/lib/supabase";
import { useOnline } from "@/lib/network";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

export function SuggestionsPage() {
  const { trip, days } = useOutletContext<Ctx>();
  const suggestions = useSuggestions(trip.id);
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function ask() {
    setBusy(true); setMsg(null);
    try { const n = await requestSuggestions(trip.id, days); setMsg(`${n} sugestões recebidas.`); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h1 className="text-xl font-semibold flex-1">Sugestões da IA</h1>
        <Link to="../import" className="btn-ghost"><FileInput size={16} /> Importar roteiro</Link>
        <button className="btn-primary" onClick={() => void ask()} disabled={busy || !online || !isCloudConfigured} title={!isCloudConfigured ? "Exige backend configurado" : ""}><Sparkles size={16} /> {busy ? "Consultando…" : "Sugerir passeios e paradas"}</button>
      </div>
      {msg && <p className="text-sm text-slate-300 mb-3">{msg}</p>}
      {!isCloudConfigured && <p className="text-xs text-slate-500 mb-3">Sugestões automáticas e leitura de PDF por IA exigem o backend (Supabase + worker). A importação de roteiro em texto funciona localmente.</p>}
      {suggestions.length === 0 ? (
        <Empty icon="✦" title="Nenhuma sugestão pendente" hint="A IA propõe passeios, paradas estratégicas e imagens de referência a partir do seu roteiro. Você aceita ou descarta cada uma." />
      ) : (
        <div className="grid gap-3">{suggestions.map((s) => <SuggestionCard key={s.id} s={s} days={days} />)}</div>
      )}
    </div>
  );
}
