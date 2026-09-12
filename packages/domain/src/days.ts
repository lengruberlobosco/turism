/** Utilidades de datas e "dia corrente", respeitando o fuso de cada dia (IANA). */

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const a = Date.UTC(...(start.split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]);
  const b = Date.UTC(...(end.split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]);
  return Math.round((b - a) / 86_400_000);
}

/** Lista de datas (YYYY-MM-DD) entre start e end, inclusive. */
export function dateRange(start: string, end: string): string[] {
  const n = daysBetween(start, end);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

/** Data (YYYY-MM-DD) e hora local (0-23) de um instante em um fuso IANA. */
export function localDateParts(now: Date, timezone: string): { date: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = Number(get("hour")) % 24;
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour };
  } catch {
    return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
  }
}

export interface DayLike {
  id: string;
  day_index: number;
  date: string | null;
  timezone: string;
}

export interface CurrentDayResult<D extends DayLike = DayLike> {
  day: D | null;
  /** true quando são 00:00–03:59 no fuso do dia: a UI pergunta "ainda no dia anterior?" */
  lateNightAmbiguity: boolean;
  mode: "planning" | "active" | "done" | "undated";
}

/**
 * Escolhe o dia corrente. Regras (docs/03):
 * - Sem datas: Dia 1, modo "undated".
 * - Antes do início: Dia 1, modo "planning".
 * - Depois do fim: último dia, modo "done".
 * - Durante: o dia cuja data local (no fuso do dia) é hoje; entre 00h e 04h sinaliza ambiguidade.
 */
export function pickCurrentDay<D extends DayLike>(days: D[], now: Date = new Date()): CurrentDayResult<D> {
  const sorted = [...days].sort((a, b) => a.day_index - b.day_index);
  if (sorted.length === 0) return { day: null, lateNightAmbiguity: false, mode: "undated" };
  const dated = sorted.filter((d) => d.date);
  if (dated.length === 0) return { day: sorted[0]!, lateNightAmbiguity: false, mode: "undated" };

  for (const d of dated) {
    const { date, hour } = localDateParts(now, d.timezone);
    if (date === d.date) {
      return { day: d, lateNightAmbiguity: hour < 4 && d.day_index > 1, mode: "active" };
    }
  }
  const first = dated[0]!;
  const last = dated[dated.length - 1]!;
  const { date: todayFirst } = localDateParts(now, first.timezone);
  if (todayFirst < first.date!) return { day: first, lateNightAmbiguity: false, mode: "planning" };
  const { date: todayLast } = localDateParts(now, last.timezone);
  if (todayLast > last.date!) return { day: last, lateNightAmbiguity: false, mode: "done" };
  // dentro do intervalo mas sem dia com essa data (lacuna): o mais próximo anterior
  const before = dated.filter((d) => d.date! <= todayFirst);
  return { day: before[before.length - 1] ?? first, lateNightAmbiguity: false, mode: "active" };
}

export function formatDayLabel(dayIndex: number): string {
  return `Dia ${dayIndex}`;
}

export function formatDatePt(date: string | null, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }): string {
  if (!date) return "sem data";
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Minutos até HH:MM de hoje no fuso dado; negativo se já passou. */
export function minutesUntil(time: string, timezone: string, now: Date = new Date()): number {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hh * 60 + mm - (h * 60 + m);
}
