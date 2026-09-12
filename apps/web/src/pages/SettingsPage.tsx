import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HardDrive, ShieldCheck, Smartphone, Trash2, Download, Upload } from "lucide-react";
import { db } from "@/db/schema";
import { ensurePersistentStorage, storageEstimate, isStandalone, formatBytes } from "@/lib/storage";
import { isCloudConfigured, supabase } from "@/lib/supabase";
import { onSyncStatus, syncNow, pullBlobsForTrip, type SyncStatus } from "@/sync/engine";
import { Progress } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { exportTripZip, importTripZip } from "@/lib/backup";
import { deleteTrip, tripStats } from "@/db/repo";
import { warmOcrCache } from "@/ocr";

/** Preparar para offline, armazenamento, conta e backup (docs/01 §3.2, docs/04 L10/L12). */
export function SettingsPage() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [ocrState, setOcrState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const trips = useLiveQuery(async () => {
    const rows = (await db.trips.toArray()).filter((t) => !t.deleted_at);
    return Promise.all(rows.map(async (t) => ({ t, stats: await tripStats(t.id) })));
  }, []);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
    void storageEstimate().then(setEst);
    const off = onSyncStatus(setSync);
    void supabase?.auth.getSession().then(({ data }) => setSession(data.session?.user.email ?? null));
    return off;
  }, []);

  async function prepare(tripId: string) {
    const ok = await ensurePersistentStorage();
    setPersisted(ok);
    setProgress((p) => ({ ...p, [tripId]: 0 }));
    await pullBlobsForTrip(tripId, (d, t) => setProgress((p) => ({ ...p, [tripId]: t ? d / t : 1 })));
    setProgress((p) => ({ ...p, [tripId]: 1 }));
    setEst(await storageEstimate());
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 grid gap-4">
      <h1 className="text-2xl font-semibold">Offline e configurações</h1>

      <section className="card">
        <h2 className="font-medium flex items-center gap-2 mb-2"><Smartphone size={18} /> Instalação</h2>
        {isStandalone() ? <p className="text-sm text-ok">App instalado na tela inicial. Os dados não são apagados automaticamente pelo navegador.</p> : (
          <p className="text-sm text-slate-300">Para garantir os documentos offline durante a viagem, <strong>instale o app</strong> (menu do navegador → “Adicionar à tela inicial”). No iPhone, sites não instalados podem ter os dados apagados após 7 dias sem uso.</p>
        )}
      </section>

      <section className="card">
        <h2 className="font-medium flex items-center gap-2 mb-2"><HardDrive size={18} /> Armazenamento</h2>
        <p className="text-sm text-slate-300">{est ? `${formatBytes(est.usage)} usados de ${formatBytes(est.quota)} disponíveis` : "Estimativa indisponível"} · persistência {persisted === null ? "?" : persisted ? "garantida" : "não garantida"}</p>
        {est && <div className="mt-2"><Progress value={est.quota ? est.usage / est.quota : 0} /></div>}
        <button className="btn-ghost mt-3 mr-2" onClick={() => { setOcrState("busy"); void warmOcrCache().then(() => setOcrState("ok")).catch(() => setOcrState("err")); }} disabled={ocrState === "busy"}>
          {ocrState === "busy" ? "Baixando motor de OCR…" : ocrState === "ok" ? "OCR offline pronto ✔" : ocrState === "err" ? "Falha ao preparar OCR" : "Preparar OCR offline (≈ 15 MB)"}
        </button>
        {persisted === false && <button className="btn-ghost mt-3" onClick={() => void ensurePersistentStorage().then(setPersisted)}><ShieldCheck size={16} /> Pedir armazenamento persistente</button>}
      </section>

      <section className="card">
        <h2 className="font-medium mb-2">Viagens neste dispositivo</h2>
        <div className="grid gap-3">
          {trips?.map(({ t, stats }) => (
            <div key={t.id} className="rounded-xl bg-ink/60 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-slate-400">{stats.days} dias · {stats.assets} arquivos ({formatBytes(stats.bytes)}) · {stats.expenses} gastos</p>
                </div>
                <button className="btn-ghost py-2 min-h-10" title="Exportar ZIP (JSON + arquivos)" onClick={() => void exportTripZip(t.id)}><Download size={16} /></button>
                <button className="btn-danger py-2 min-h-10" title="Excluir" onClick={() => { if (confirm(`Excluir “${t.title}” deste dispositivo?`)) void deleteTrip(t.id); }}><Trash2 size={16} /></button>
              </div>
              {isCloudConfigured && (
                <div className="mt-2">
                  <button className="btn-primary w-full py-2 min-h-10" onClick={() => void prepare(t.id)}>Preparar para offline</button>
                  {progress[t.id] != null && <div className="mt-2"><Progress value={progress[t.id]!} /></div>}
                </div>
              )}
              {!isCloudConfigured && <p className="text-xs text-slate-500 mt-2">Modo local: todos os arquivos desta viagem já estão no dispositivo.</p>}
            </div>
          ))}
        </div>
        <label className="btn-ghost mt-3 cursor-pointer"><Upload size={16} /> Importar backup ZIP<input type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importTripZip(f).then(() => alert("Viagem importada.")).catch((err) => alert(String(err))); }} /></label>
      </section>

      <section className="card">
        <h2 className="font-medium mb-2">Conta e sincronização</h2>
        {!isCloudConfigured ? (
          <p className="text-sm text-slate-400">Backend não configurado. O app funciona totalmente neste dispositivo. Para sincronizar entre aparelhos e usar IA online, defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</p>
        ) : session ? (
          <div className="text-sm">
            <p>Conectado como <strong>{session}</strong>. {sync?.pending ? `${sync.pending} alterações aguardando envio.` : "Tudo sincronizado."} Última sync {timeAgo(sync?.lastSyncAt)}.</p>
            {sync?.error && <p className="text-danger mt-1">{sync.error}</p>}
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost" onClick={() => void syncNow()}>Sincronizar agora</button>
              <button className="btn-ghost" onClick={() => void supabase!.auth.signOut().then(() => setSession(null))}>Sair</button>
            </div>
          </div>
        ) : (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } }).then(({ error }) => alert(error ? error.message : "Enviamos um link de acesso para o seu e-mail.")); }}>
            <input className="input" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="btn-primary" type="submit">Entrar</button>
          </form>
        )}
      </section>
    </div>
  );
}
