import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sparkles, FileText } from "lucide-react";
import { CURRENCIES, type ParsedItinerary } from "@turism/domain";
import { Field, Progress } from "@/components/ui";
import { parseItinerary } from "@/ai";
import { importItinerary, defaultTimezone } from "@/db/repo";
import { refreshRates } from "@/sync/fx";

const SAMPLE = `Roteiro Toscana e Roma
Dia 1 - Florença
Chegada, check-in e passeio pelo centro histórico.
09:40 Trem Pisa → Florença
- Check-in Hotel Brunelleschi
15:00 Galleria dell'Accademia (ingresso 15:15)
Dia 2 - Siena
08:00 Dirigir até Siena (75 km, pedágio)
13:00 Almoço na Piazza del Campo
Dia 3 - Roma
09:40 Trem Florença → Roma (plataforma 6)
11:30 Check-in Hotel Roma centro
15:00 Coliseu`;

/** Módulo 4 — importar esboço de roteiro (texto ou PDF) e revisar antes de gravar. */
export function ImportPage() {
  const nav = useNavigate();
  const { tripId } = useParams();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ parsed: ParsedItinerary; engine: "ai" | "local" } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null); setBusy(true);
    try {
      const src = file ? ({ kind: "pdf", file } as const) : ({ kind: "text", text } as const);
      if (!file && !text.trim()) throw new Error("Cole o texto do roteiro ou escolha um PDF.");
      const r = await parseItinerary(src, { startDate: start || null });
      if (r.parsed.days.length === 0) throw new Error("Não encontrei dias no roteiro. Use cabeçalhos como “Dia 1”, “Day 2” ou datas “12/05”.");
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!result) return;
    setBusy(true);
    const trip = await importItinerary(result.parsed, { trip_id: tripId, base_currency: currency, timezone: defaultTimezone() });
    if (navigator.onLine) refreshRates(trip.base_currency).catch(() => {});
    nav(`/trips/${trip.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-1">Importar roteiro</h1>
      <p className="text-sm text-slate-400 mb-4">Cole o esboço em texto ou envie um PDF. O sistema nomeia os dias cronologicamente e distribui as atividades. Você revisa antes de gravar.</p>
      {!result ? (
        <>
          <Field label="Texto do roteiro">
            <textarea className="input min-h-48 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
            <button type="button" className="text-xs text-accent mt-1" onClick={() => setText(SAMPLE)}>usar exemplo</button>
          </Field>
          <Field label="Ou PDF" hint="Com backend configurado, a IA lê o PDF diretamente; sem ele, o texto é extraído no dispositivo.">
            <input className="input" type="file" accept="application/pdf,text/plain" onChange={async (e) => { const f = e.target.files?.[0] ?? null; if (f && f.type === "text/plain") { setText(await f.text()); setFile(null); } else setFile(f); }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data do Dia 1" hint="Opcional; sem data, dias ficam relativos."><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            {!tripId && <Field label="Moeda base"><select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></Field>}
          </div>
          {err && <p className="text-danger text-sm mb-3">{err}</p>}
          {busy && <div className="mb-3"><Progress value={0.5} /><p className="text-xs text-slate-400 mt-1">Processando roteiro…</p></div>}
          <button className="btn-primary w-full" onClick={() => void run()} disabled={busy}><Sparkles size={18} /> Estruturar roteiro</button>
        </>
      ) : (
        <>
          <div className={`rounded-xl p-3 mb-4 text-sm ${result.engine === "ai" ? "bg-ok/10 border border-ok/30" : "bg-panel border border-line"}`}>
            {result.engine === "ai" ? "Estruturado pela IA." : "Estruturado pelo parser local (sem IA). Para PDFs complexos, configure o backend."} Revise abaixo e confirme.
          </div>
          <h2 className="text-lg font-semibold mb-2">{result.parsed.title}</h2>
          <div className="grid gap-3 mb-4">
            {result.parsed.days.map((d) => (
              <div key={d.day_index} className="card">
                <p className="font-medium">Dia {d.day_index} <span className="text-slate-400 font-normal">· {d.date ?? "sem data"} · {d.title}</span></p>
                {d.narrative && <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{d.narrative}</p>}
                <ul className="mt-2 text-sm grid gap-1">
                  {d.activities.map((a, i) => <li key={i} className="flex gap-2"><span className="w-12 text-slate-500 tabular-nums">{a.start_time ?? "—"}</span><FileText size={14} className="mt-0.5 text-slate-500" /><span>{a.title}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setResult(null)}>Voltar</button>
            <button className="btn-primary flex-1" onClick={() => void confirm()} disabled={busy}>{tripId ? "Adicionar à viagem" : "Criar viagem com este roteiro"}</button>
          </div>
        </>
      )}
    </div>
  );
}
