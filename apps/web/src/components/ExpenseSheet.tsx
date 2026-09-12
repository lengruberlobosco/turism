import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, PencilLine, Sparkles } from "lucide-react";
import { Sheet, Field, Progress } from "./ui";
import { EXPENSE_CATEGORIES, CURRENCIES, formatMoney, pickRate, toBase, type OcrResult, type Trip, type TripDay } from "@turism/domain";
import { addExpense, addFileAsset, ratesFor, setAssetOcr } from "@/db/repo";
import { recognizeReceipt } from "@/ocr";
import { fetchHistoricalRate } from "@/sync/fx";
import { useOnline } from "@/lib/network";
import { useTravelers } from "@/lib/hooks";

/**
 * Fluxo "+ Gasto" (docs/03 §5.3): câmera → OCR → card de sugestão → confirmar.
 * Também aceita lançamento manual. Grava taxa de câmbio congelada.
 */
export function ExpenseSheet({ open, onClose, trip, day, presetCategory }: { open: boolean; onClose: () => void; trip: Trip; day: TripDay | null; presetCategory?: string }) {
  const online = useOnline();
  const travelers = useTravelers(trip.id);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [split, setSplit] = useState<Record<string, number> | null>(null); // null = igual entre todos
  const [step, setStep] = useState<"choose" | "ocr" | "form">("choose");
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(trip.base_currency);
  const [category, setCategory] = useState(presetCategory ?? "food");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [liters, setLiters] = useState("");
  const [odometer, setOdometer] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [manualRate, setManualRate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPaidBy(null); setSplit(null); setLiters(""); setOdometer("");
      setStep("choose"); setReceipt(null); setOcr(null); setAmount(""); setMerchant(""); setNotes(""); setErr(null); setManualRate(""); setCurrency(trip.base_currency); setCategory(presetCategory ?? "food");
    }
  }, [open, trip.base_currency, presetCategory]);

  // taxa disponível para a moeda escolhida
  useEffect(() => {
    let alive = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      let r = pickRate(await ratesFor(trip.base_currency, currency), trip.base_currency, currency, today);
      if (!r && online) r = await fetchHistoricalRate(trip.base_currency, currency, today).catch(() => null);
      if (alive) setRate(r?.rate ?? null);
    })();
    return () => { alive = false; };
  }, [currency, trip.base_currency, online]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReceipt(file);
    setStep("ocr");
    setProgress(0);
    try {
      const result = await recognizeReceipt(file, { onProgress: setProgress });
      setOcr(result);
      if (result.amount != null) setAmount(String(result.amount));
      if (result.currency) setCurrency(result.currency);
      if (result.merchant) setMerchant(result.merchant);
      if (result.category_guess) setCategory(result.category_guess);
    } catch (e) {
      setErr(`OCR falhou (${e instanceof Error ? e.message : e}). Preencha manualmente.`);
    }
    setStep("form");
  }

  async function save() {
    setErr(null);
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return setErr("Informe um valor válido.");
    const fx = rate ?? (manualRate ? Number(manualRate.replace(",", ".")) : null);
    if (!fx) return setErr("Sem taxa de câmbio para esta moeda. Informe a taxa manualmente ou conecte-se.");
    setBusy(true);
    try {
      let receiptId: string | null = null;
      if (receipt) {
        const a = await addFileAsset(trip.id, receipt, { title: `Recibo ${merchant || category} ${new Date().toLocaleDateString("pt-BR")}`, category: "receipt", kind: "document", day_ids: day ? [day.id] : [] });
        receiptId = a.id;
        if (ocr) await setAssetOcr(a.id, ocr, "done");
      }
      await addExpense(
        { trip_id: trip.id, day_id: day?.id ?? null, category, amount: value, currency, merchant: merchant || null, notes: notes || null, receipt_asset_id: receiptId, source: ocr?.source ?? "manual", ocr_confidence: ocr?.confidence ?? null, fx_rate: fx, paid_by: paidBy ?? travelers[0]?.id ?? null, split, liters: category === "fuel" && liters ? Number(liters.replace(",", ".")) : null, odometer_km: category === "fuel" && odometer ? Number(odometer.replace(",", ".")) : null },
        trip.base_currency,
      );
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const value = Number(amount.replace(",", "."));
  const preview = rate && Number.isFinite(value) ? toBase(value, rate) : null;
  const low = (f: keyof OcrResult) => ocr && ocr.confidence < 0.6 && ocr[f] != null;

  return (
    <Sheet open={open} onClose={onClose} title={day ? `Novo gasto · Dia ${day.day_index}` : "Novo gasto"}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      {step === "choose" && (
        <div className="grid gap-3">
          <button className="btn-primary py-5 text-base" onClick={() => camRef.current?.click()}><Camera size={22} /> Fotografar recibo (OCR)</button>
          <button className="btn-ghost py-5 text-base" onClick={() => galRef.current?.click()}><ImageIcon size={22} /> Escolher da galeria</button>
          <button className="btn-ghost py-5 text-base" onClick={() => setStep("form")}><PencilLine size={22} /> Lançar manualmente</button>
          <p className="text-xs text-slate-500 text-center">{online ? "OCR online quando há backend configurado; senão, OCR no dispositivo." : "Offline: o OCR roda no seu dispositivo (menor precisão)."}</p>
        </div>
      )}
      {step === "ocr" && (
        <div className="py-6 text-center">
          <Sparkles className="inline mb-2 text-accent" />
          <p className="mb-3">Analisando recibo…</p>
          <Progress value={progress} />
        </div>
      )}
      {step === "form" && (
        <div>
          {ocr && (
            <div className={`rounded-xl p-3 mb-4 text-sm ${ocr.confidence >= 0.6 ? "bg-ok/10 border border-ok/30" : "bg-warn/10 border border-warn/30"}`}>
              <p className="font-medium flex items-center gap-1"><Sparkles size={14} /> Sugestão do OCR ({ocr.source === "ocr_online" ? "IA" : "no dispositivo"}) · confiança {Math.round(ocr.confidence * 100)}%</p>
              <p className="text-slate-300 mt-1">Revise os campos destacados antes de confirmar.</p>
            </div>
          )}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Valor">
              <input className={`input text-2xl ${low("amount") ? "border-warn" : ""}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" autoFocus />
            </Field>
            <Field label="Moeda">
              <select className={`input ${low("currency") ? "border-warn" : ""}`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-sm text-slate-400 -mt-1 mb-3">
            {currency === trip.base_currency ? "Moeda base da viagem." : rate ? `1 ${currency} = ${rate.toFixed(4)} ${trip.base_currency} · ${preview != null ? formatMoney(preview, trip.base_currency) : ""}` : "Sem taxa em cache."}
          </p>
          {!rate && currency !== trip.base_currency && (
            <Field label={`Taxa manual (1 ${currency} em ${trip.base_currency})`}>
              <input className="input" inputMode="decimal" value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder="ex.: 6,20" />
            </Field>
          )}
          <Field group label="Categoria">
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={category === c.id ? "chip-on" : "chip"} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</button>
              ))}
            </div>
          </Field>
          {category === "fuel" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Litros"><input className="input" inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="45,2" /></Field>
              <Field label="Odômetro (km)" hint="Permite calcular consumo e custo por km."><input className="input" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="102340" /></Field>
            </div>
          )}
          {travelers.length > 0 && (
            <>
              <Field group label="Quem pagou">
                <div className="flex flex-wrap gap-2">
                  {travelers.map((t) => <button key={t.id} type="button" className={(paidBy ?? travelers[0]?.id) === t.id ? "chip-on" : "chip"} onClick={() => setPaidBy(t.id)}><span className="h-3 w-3 rounded-full" style={{ background: t.color }} /> {t.name}</button>)}
                </div>
              </Field>
              <Field group label="Dividir entre" hint={split ? "Toque para incluir/excluir; pesos iguais entre os marcados." : "Igual entre todos."}>
                <div className="flex flex-wrap gap-2">
                  {travelers.map((t) => {
                    const on = !split || (split[t.id] ?? 0) > 0;
                    return <button key={t.id} type="button" className={on ? "chip-on" : "chip"} onClick={() => setSplit((s) => { const base = s ?? Object.fromEntries(travelers.map((x) => [x.id, 1])); return { ...base, [t.id]: on ? 0 : 1 }; })}>{t.name}</button>;
                  })}
                  {split && <button type="button" className="chip" onClick={() => setSplit(null)}>todos</button>}
                </div>
              </Field>
            </>
          )}
          <Field label="Estabelecimento">
            <input className={`input ${low("merchant") ? "border-warn" : ""}`} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </Field>
          <Field label="Observações">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {err && <p className="text-danger text-sm mb-3">{err}</p>}
          <button className="btn-primary w-full" onClick={() => void save()} disabled={busy}>{busy ? "Salvando…" : "Confirmar gasto"}</button>
        </div>
      )}
    </Sheet>
  );
}
