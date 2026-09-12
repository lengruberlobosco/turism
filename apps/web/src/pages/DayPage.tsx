import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Camera, Mic, Pin, PinOff, Trash2, Sparkles, Car } from "lucide-react";
import { formatDatePt, formatMoney, summarize, categoryIcon, localDateParts, type Trip, type TripDay, type Asset, type CurrentDayResult } from "@turism/domain";
import { useActivities, useDayAssets, useExpenses, useSuggestions } from "@/lib/hooks";
import { NowCard } from "@/components/NowCard";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { NarrativeEditor } from "@/components/NarrativeEditor";
import { AssetRow } from "@/components/AssetRow";
import { AssetViewer } from "@/components/AssetViewer";
import { AssetUploadSheet } from "@/components/AssetUploadSheet";
import { ExpenseSheet } from "@/components/ExpenseSheet";
import { Sheet, Field } from "@/components/ui";
import { addFileAsset, appendDay, deleteDay, setAssetPriority, updateDay, getKV, setKV } from "@/db/repo";
import { Checklist } from "./ChecklistsPage";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

export function DayPage() {
  const { trip, days, current } = useOutletContext<Ctx>();
  const { dayRef } = useParams();
  const nav = useNavigate();
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => { void getKV<{ day_id: string; until: string }>(`pin:${trip.id}`).then((p) => setPinned(p && p.until > new Date().toISOString() ? p.day_id : null)); }, [trip.id]);

  const day = useMemo(() => {
    if (dayRef === "current") return days.find((d) => d.id === pinned) ?? current.day ?? days[0] ?? null;
    return days.find((d) => String(d.day_index) === dayRef) ?? null;
  }, [dayRef, days, current.day, pinned]);

  const activities = useActivities(day?.id);
  const assets = useDayAssets(day?.id);
  const expenses = useExpenses(trip.id, day?.id);
  const suggestions = useSuggestions(trip.id, day?.id);
  const [viewer, setViewer] = useState<number | null>(null);
  const [upload, setUpload] = useState(false);
  const [expense, setExpense] = useState<null | { category?: string }>(null);
  const [dayPicker, setDayPicker] = useState(false);
  const [editDay, setEditDay] = useState(false);
  const [road, setRoad] = useState(false);
  const [ambiguityDismissed, setAmbiguityDismissed] = useState(false);

  // gesto: deslizar horizontalmente muda de dia
  const [touchX, setTouchX] = useState<number | null>(null);

  if (!day) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400 mb-3">Esta viagem ainda não tem dias.</p>
        <button className="btn-primary" onClick={() => void appendDay(trip.id).then((d) => nav(`../days/${d.day_index}`))}>Adicionar Dia 1</button>
      </div>
    );
  }
  const isCurrent = current.day?.id === day.id;
  const active = current.mode === "active" && isCurrent;
  const prev = days.find((d) => d.day_index === day.day_index - 1);
  const next = days.find((d) => d.day_index === day.day_index + 1);
  const { hour, date: localToday } = localDateParts(new Date(), day.timezone);
  const nowHm = `${String(hour).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
  const nextActivity = activities.find((a) => a.status !== "done" && (!active || !a.start_time || a.start_time >= nowHm)) ?? activities.find((a) => a.status !== "done") ?? null;
  const sums = summarize(expenses);
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const media = assets.filter((a) => a.kind === "photo" || a.kind === "audio");
  const docs = assets.filter((a) => a.kind !== "photo" && a.kind !== "audio");

  async function togglePin() {
    if (pinned === day!.id) {
      await setKV(`pin:${trip.id}`, null);
      setPinned(null);
    } else {
      const until = new Date(); until.setHours(24, 0, 0, 0);
      await setKV(`pin:${trip.id}`, { day_id: day!.id, until: until.toISOString() });
      setPinned(day!.id);
    }
  }
  async function quickCapture(kind: "photo" | "audio") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "photo" ? "image/*" : "audio/*";
    if (kind === "photo") input.setAttribute("capture", "environment");
    input.onchange = async () => {
      for (const f of Array.from(input.files ?? [])) await addFileAsset(trip.id, f, { title: `${kind === "photo" ? "Foto" : "Áudio"} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, category: kind, kind, day_ids: [day!.id] });
    };
    input.click();
  }

  return (
    <div
      className={`max-w-5xl mx-auto px-4 py-4 grid gap-4 lg:grid-cols-[1fr_320px] ${road ? "road-mode" : ""}`}
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const x = e.changedTouches[0]?.clientX ?? null;
        if (touchX != null && x != null && Math.abs(x - touchX) > 80) {
          if (x < touchX && next) nav(`../days/${next.day_index}`);
          if (x > touchX && prev) nav(`../days/${prev.day_index}`);
        }
        setTouchX(null);
      }}
    >
      <div className="grid gap-4 content-start">
        {/* cabeçalho do dia */}
        <div className="flex items-center gap-2">
          <Link to={prev ? `../days/${prev.day_index}` : "#"} aria-label="Dia anterior" className={`p-2 rounded-lg ${prev ? "hover:bg-panel" : "opacity-30 pointer-events-none"}`}><ChevronLeft /></Link>
          <button className="flex-1 text-left" onClick={() => setDayPicker(true)}>
            <p className="text-xl font-semibold">Dia {day.day_index} <span className="text-slate-500 text-sm">▾</span> {isCurrent && <span className="text-xs align-middle rounded-full bg-ok/15 text-ok px-2 py-0.5 ml-1">{current.mode === "active" ? "hoje" : current.mode === "planning" ? "primeiro" : "último"}</span>}</p>
            <p className="text-sm text-slate-400">{formatDatePt(day.date, { weekday: "short", day: "2-digit", month: "short" })}{day.title ? ` · ${day.title}` : ""}{day.timezone !== deviceTz ? ` · ${day.timezone.split("/").pop()} ${nowHm}` : ""}</p>
          </button>
          <button className={`p-2 rounded-lg ${pinned === day.id ? "text-accent" : "text-slate-500"}`} onClick={() => void togglePin()} aria-label="Fixar como dia corrente" title="Fixar como dia corrente até meia-noite">{pinned === day.id ? <Pin size={18} /> : <PinOff size={18} />}</button>
          <button className={`p-2 rounded-lg ${road ? "text-accent" : "text-slate-500"}`} onClick={() => setRoad((r) => !r)} aria-label="Modo estrada" title="Modo estrada: fonte e botões maiores"><Car size={18} /></button>
          <Link to={next ? `../days/${next.day_index}` : "#"} aria-label="Próximo dia" className={`p-2 rounded-lg ${next ? "hover:bg-panel" : "opacity-30 pointer-events-none"}`}><ChevronRight /></Link>
        </div>

        {active && current.lateNightAmbiguity && !ambiguityDismissed && prev && (
          <div className="rounded-xl bg-warn/10 border border-warn/30 p-3 text-sm flex items-center gap-2">
            <span className="flex-1">São {nowHm} em {day.timezone.split("/").pop()}. Ainda no Dia {prev.day_index}?</span>
            <Link to={`../days/${prev.day_index}`} className="btn-ghost py-2 min-h-10">Sim, voltar</Link>
            <button className="btn-primary py-2 min-h-10" onClick={() => setAmbiguityDismissed(true)}>Não, é o Dia {day.day_index}</button>
          </div>
        )}
        {localToday !== day.date && day.date && current.mode === "active" && !isCurrent && (
          <p className="text-xs text-slate-500 -mt-2">Você está vendo outro dia. <Link to="../days/current" className="text-accent">Ir para hoje</Link></p>
        )}

        <NowCard day={day} next={nextActivity} docs={docs} onOpenDoc={(a) => setViewer(Math.max(0, docs.findIndex((d) => d.id === a.id)))} active={active} />

        {/* documentos do dia */}
        <section className="card">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="section-title flex-1">Documentos do dia</h2>
            <Link to="../documents" className="text-xs text-accent">ver todos</Link>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum documento vinculado a este dia. <button className="text-accent" onClick={() => setUpload(true)}>Vincular documentos</button></p>
          ) : (
            <div className="grid gap-2">
              {docs.map((a, i) => (
                <AssetRow key={a.id} asset={a} lit={active} priority={a.priority} onOpen={() => setViewer(i)} onTogglePriority={() => void setAssetPriority(a.id, day.id, a.priority ? 0 : 1)} />
              ))}
            </div>
          )}
          <button className="btn-ghost w-full mt-2" onClick={() => setUpload(true)}><Plus size={16} /> Documento ou link</button>
        </section>

        {/* roteiro */}
        <section className="card">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="section-title flex-1">Roteiro</h2>
            {suggestions.length > 0 && <Link to="../suggestions" className="text-xs text-accent flex items-center gap-1"><Sparkles size={12} /> {suggestions.length} sugestões</Link>}
          </div>
          <ActivityTimeline day={day} activities={activities} nextId={nextActivity?.id} />
        </section>

        {/* dinâmica do dia */}
        <section className="card">
          <h2 className="section-title mb-2">Dinâmica do dia</h2>
          <NarrativeEditor day={day} field="narrative" placeholder="Como será o dia: horários, deslocamentos, atividades programadas…" />
          <h3 className="section-title mt-3 mb-2">Deslocamentos previstos</h3>
          <NarrativeEditor day={day} field="logistics_notes" placeholder="Ex.: 180 km, 2h30 de estrada, pedágio em Barreiras; abastecer em Correntina." />
          <button className="text-xs text-slate-400 mt-2 hover:text-slate-200" onClick={() => setEditDay(true)}>Editar data, título e fuso do dia</button>
        </section>
      </div>

      <div className="grid gap-4 content-start">
        {/* gastos do dia */}
        <section className="card">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="section-title flex-1">Gastos hoje</h2>
            <Link to="../expenses" className="text-xs text-accent">planilha</Link>
          </div>
          <p className="text-2xl font-semibold">{formatMoney(sums.total, trip.base_currency)}</p>
          {Object.keys(sums.byCurrency).filter((c) => c !== trip.base_currency).length > 0 && (
            <p className="text-xs text-slate-400">{Object.entries(sums.byCurrency).filter(([c]) => c !== trip.base_currency).map(([c, v]) => formatMoney(v, c)).join(" · ")}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2 text-sm">
            {Object.entries(sums.byCategory).map(([c, v]) => <span key={c} className="chip">{categoryIcon(c)} {formatMoney(v, trip.base_currency)}</span>)}
            {expenses.length === 0 && <span className="text-slate-500 text-sm">Nenhum gasto ainda.</span>}
          </div>
          {road && <button className="btn-ghost w-full mt-3" onClick={() => setExpense({ category: "fuel" })}>⛽ Gasto de combustível</button>}
        </section>

        <section className="card">
          <h2 className="section-title mb-2">Checklist do dia</h2>
          <Checklist tripId={trip.id} kind="day" dayId={day.id} compact />
        </section>

        {/* fotos e notas */}
        <section className="card">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="section-title flex-1">Fotos e notas ({media.length})</h2>
            <button className="p-2 rounded-lg hover:bg-ink" aria-label="Tirar foto" onClick={() => void quickCapture("photo")}><Camera size={18} /></button>
            <button className="p-2 rounded-lg hover:bg-ink" aria-label="Gravar áudio" onClick={() => void quickCapture("audio")}><Mic size={18} /></button>
          </div>
          {media.length === 0 ? <p className="text-sm text-slate-500">Registre fotos e notas de voz do dia.</p> : (
            <div className="grid gap-2">{media.map((a) => <AssetRow key={a.id} asset={a} onOpen={() => setViewer(assets.indexOf(a))} />)}</div>
          )}
        </section>
      </div>

      {/* FAB */}
      <button className="fixed right-4 bottom-20 lg:bottom-6 z-30 btn-primary rounded-full shadow-xl shadow-accent/20 px-5 py-4 text-base" onClick={() => setExpense({})} aria-label="Novo gasto"><Plus size={20} /> Gasto</button>

      {viewer !== null && <AssetViewer assets={viewer < docs.length ? docs : assets} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}
      <AssetUploadSheet open={upload} onClose={() => setUpload(false)} tripId={trip.id} days={days} defaultDayId={day.id} />
      <ExpenseSheet open={expense !== null} onClose={() => setExpense(null)} trip={trip} day={day} presetCategory={expense?.category} />

      <Sheet open={dayPicker} onClose={() => setDayPicker(false)} title="Ir para o dia">
        <div className="grid gap-1">
          {days.map((d) => (
            <Link key={d.id} to={`../days/${d.day_index}`} onClick={() => setDayPicker(false)} className={`rounded-xl px-3 py-3 flex items-center gap-3 ${d.id === day.id ? "bg-accent/15 text-accent" : "hover:bg-ink"}`}>
              <span className={`h-2 w-2 rounded-full ${current.day?.id === d.id ? "bg-ok" : "bg-line"}`} />
              <span className="font-medium">Dia {d.day_index}</span>
              <span className="text-sm text-slate-400">{formatDatePt(d.date, { weekday: "short", day: "2-digit", month: "short" })}{d.title ? ` · ${d.title}` : ""}</span>
            </Link>
          ))}
          <button className="btn-ghost mt-2" onClick={() => void appendDay(trip.id).then((d) => { setDayPicker(false); nav(`../days/${d.day_index}`); })}><Plus size={16} /> Adicionar dia ao final</button>
        </div>
      </Sheet>

      <DayEditSheet open={editDay} onClose={() => setEditDay(false)} day={day} onDeleted={() => nav("../days/current")} />
    </div>
  );
}

function DayEditSheet({ open, onClose, day, onDeleted }: { open: boolean; onClose: () => void; day: TripDay; onDeleted: () => void }) {
  const [title, setTitle] = useState(day.title ?? "");
  const [date, setDate] = useState(day.date ?? "");
  const [tz, setTz] = useState(day.timezone);
  const [km, setKm] = useState(day.expected_km?.toString() ?? "");
  const [min, setMin] = useState(day.expected_travel_min?.toString() ?? "");
  const [k, setK] = useState(day.id);
  if (k !== day.id) { setK(day.id); setTitle(day.title ?? ""); setDate(day.date ?? ""); setTz(day.timezone); setKm(day.expected_km?.toString() ?? ""); setMin(day.expected_travel_min?.toString() ?? ""); }
  return (
    <Sheet open={open} onClose={onClose} title={`Editar Dia ${day.day_index}`}>
      <Field label="Título"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Florença → Roma" /></Field>
      <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Fuso horário (IANA)" hint="Define quando este dia é “hoje”."><input className="input" value={tz} onChange={(e) => setTz(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Km previstos"><input className="input" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></Field>
        <Field label="Min. de deslocamento"><input className="input" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
      </div>
      <div className="flex gap-2">
        <button className="btn-danger" onClick={() => { if (confirm(`Excluir o Dia ${day.day_index}? Documentos permanecem na viagem.`)) void deleteDay(day.id).then(() => { onClose(); onDeleted(); }); }}><Trash2 size={16} /></button>
        <button className="btn-primary flex-1" onClick={() => void updateDay(day.id, { title: title || null, date: date || null, timezone: tz || day.timezone, expected_km: km ? Number(km) : null, expected_travel_min: min ? Number(min) : null }).then(onClose)}>Salvar</button>
      </div>
    </Sheet>
  );
}

export type { Asset };
