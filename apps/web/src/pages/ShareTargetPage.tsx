import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { db } from "@/db/schema";
import { AssetUploadSheet } from "@/components/AssetUploadSheet";
import { listDays } from "@/db/repo";
import type { TripDay } from "@turism/domain";

/**
 * Web Share Target (docs/04 §2.1): outro app compartilha PDF/foto/link → escolhe a viagem → sheet de upload.
 * O Service Worker repassa o POST como GET com os arquivos em cache temporário (ver sw-share.ts); aqui também aceitamos ?url/?text.
 */
export function ShareTargetPage() {
  const nav = useNavigate();
  const trips = useLiveQuery(async () => (await db.trips.toArray()).filter((t) => !t.deleted_at), []);
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const params = new URLSearchParams(location.search);
  const url = params.get("url") ?? (params.get("text")?.match(/https?:\/\/\S+/)?.[0] ?? undefined);

  useEffect(() => {
    (async () => {
      const cache = await caches.open("share-target");
      const res = await cache.match("/share-target/files");
      if (res) {
        const fd = await res.formData();
        setFiles(fd.getAll("files").filter((f): f is File => f instanceof File));
        await cache.delete("/share-target/files");
      }
    })();
  }, []);
  useEffect(() => { if (tripId) void listDays(tripId).then(setDays); }, [tripId]);

  if (!tripId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-2">Salvar em qual viagem?</h1>
        <p className="text-sm text-slate-400 mb-4">{files.length ? `${files.length} arquivo(s) recebido(s).` : url ? url : "Nada recebido."}</p>
        <div className="grid gap-2">{trips?.map((t) => <button key={t.id} className="btn-ghost justify-start" onClick={() => setTripId(t.id)}>{t.title}</button>)}</div>
      </div>
    );
  }
  return <AssetUploadSheet open onClose={() => nav(`/trips/${tripId}`)} tripId={tripId} days={days} initialFiles={files} initialUrl={url ?? undefined} />;
}
