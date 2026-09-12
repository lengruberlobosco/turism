import type { ParsedItinerary } from "./types";
import { addDays } from "./days";

const DAY_HEADING = /^\s*(?:#+\s*)?(?:dia|day|día|jour|giorno|tag)\s*(\d{1,2})\b\s*[:\-–—.)]?\s*(.*)$/i;
const DATE_HEADING = /^\s*(?:#+\s*)?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\s*[:\-–—]?\s*(.*)$/;
const TIME_RE = /^(\d{1,2})[:h](\d{2})?\s*[-–—]?\s*(.*)$/;

function guessType(title: string): string {
  const t = title.toLowerCase();
  if (/voo|flight|aeroporto|airport|embarque/.test(t)) return "flight";
  if (/trem|train|estação|station/.test(t)) return "train";
  if (/hotel|check-?in|check-?out|pousada|hospedagem|hostel/.test(t)) return "lodging";
  if (/almoço|jantar|café|lunch|dinner|breakfast|restaurante/.test(t)) return "meal";
  if (/dirigir|estrada|deslocamento|drive|transfer|km\b|rodovia/.test(t)) return "transfer";
  if (/visita|museu|passeio|tour|praia|parque|trilha|mirante/.test(t)) return "visit";
  return "other";
}

/**
 * Parser heurístico (funciona offline, sem IA) para esboços de roteiro em texto.
 * Reconhece cabeçalhos "Dia N", "Day N", ou datas "12/05", e linhas com horário "09:40 …".
 * A IA (worker) produz a versão rica; este parser garante que a importação nunca fique bloqueada.
 */
export function parseItineraryText(text: string, opts: { startDate?: string | null; title?: string } = {}): ParsedItinerary {
  const lines = text.split(/\r?\n/);
  const days: ParsedItinerary["days"] = [];
  let current: ParsedItinerary["days"][number] | null = null;
  let implicit = false; // dia criado sem cabeçalho (texto antes do primeiro "Dia N")
  let preamble: string | null = null;
  const narrative: string[] = [];
  const year = new Date().getUTCFullYear();

  const flush = () => {
    if (current) {
      current.narrative = narrative.join("\n").trim() || null;
      days.push(current);
    }
    narrative.length = 0;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const dh = line.match(DAY_HEADING);
    const dth = !dh ? line.match(DATE_HEADING) : null;
    if (dh || dth) {
      if (implicit && current && current.activities.length === 0) {
        // Texto antes do primeiro cabeçalho é o título/preâmbulo do roteiro, não um dia
        preamble = narrative.join(" ").trim() || null;
        current = null;
        narrative.length = 0;
      }
      implicit = false;
      flush();
      const idx = dh ? Number(dh[1]) : days.length + 1;
      let date: string | null = null;
      if (dth) {
        const d = dth[1]!.padStart(2, "0");
        const m = dth[2]!.padStart(2, "0");
        const y = dth[3] ? (dth[3].length === 2 ? `20${dth[3]}` : dth[3]) : String(year);
        date = `${y}-${m}-${d}`;
      } else if (opts.startDate) {
        date = addDays(opts.startDate, idx - 1);
      }
      const title = (dh ? dh[2] : dth![4])?.trim() || `Dia ${idx}`;
      current = { day_index: idx, date, title, narrative: null, destination: title.split(/→|->|-|–/)[0]?.trim() || null, activities: [] };
      continue;
    }
    if (!current) {
      current = { day_index: 1, date: opts.startDate ?? null, title: "Dia 1", narrative: null, destination: null, activities: [] };
      implicit = true;
    }
    const th = line.match(TIME_RE);
    if (th && th[3]) {
      const hh = th[1]!.padStart(2, "0");
      const mm = (th[2] ?? "00").padStart(2, "0");
      const title = th[3].replace(/^[-–—•*]\s*/, "").trim();
      current.activities.push({ title, type: guessType(title), start_time: `${hh}:${mm}`, end_time: null, place_name: null, notes: null });
      continue;
    }
    const bullet = line.match(/^[-–—•*]\s+(.*)$/);
    if (bullet && bullet[1]) {
      const title = bullet[1].trim();
      current.activities.push({ title, type: guessType(title), start_time: null, end_time: null, place_name: null, notes: null });
      continue;
    }
    narrative.push(line);
  }
  flush();

  // Renumera sequencialmente e preenche datas por deslocamento quando houver data inicial
  days.sort((a, b) => a.day_index - b.day_index);
  days.forEach((d, i) => {
    d.day_index = i + 1;
    if (!d.date && opts.startDate) d.date = addDays(opts.startDate, i);
  });

  return {
    title: opts.title ?? preamble?.split(/\r?\n/)[0]?.slice(0, 80) ?? (days[0]?.destination ? `Viagem: ${days[0].destination}` : "Roteiro importado"),
    start_date: days[0]?.date ?? opts.startDate ?? null,
    base_currency: null,
    days,
  };
}
