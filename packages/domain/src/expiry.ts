import { daysBetween } from "./days";

export type ExpiryLevel = "expired" | "critical" | "warning" | "notice" | "ok";

/** Alertas de validade de documentos (docs/04 L4): vencido, ≤7, ≤30, ≤90 dias antes da viagem. */
export function expiryLevel(expires_at: string | null | undefined, reference: string): ExpiryLevel {
  if (!expires_at) return "ok";
  const d = daysBetween(reference, expires_at);
  if (d < 0) return "expired";
  if (d <= 7) return "critical";
  if (d <= 30) return "warning";
  if (d <= 90) return "notice";
  return "ok";
}

export function expiryLabel(level: ExpiryLevel, expires_at: string | null | undefined, reference: string): string | null {
  if (!expires_at || level === "ok") return null;
  const d = daysBetween(reference, expires_at);
  if (level === "expired") return `vencido há ${-d} dia(s)`;
  return `vence em ${d} dia(s)`;
}
