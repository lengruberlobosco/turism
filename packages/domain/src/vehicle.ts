/** Módulo veículo (docs/04 §2.3): consumo, custo por km e autonomia a partir dos abastecimentos. */

export interface FuelEntry {
  amount_base: number;
  liters: number | null;
  odometer_km: number | null;
  spent_at: string;
  deleted_at?: string | null;
}

export interface VehicleStats {
  fills: number;
  liters: number;
  cost_base: number;
  km: number | null; // odômetro final - inicial
  km_per_liter: number | null;
  cost_per_km: number | null;
  price_per_liter: number | null;
}

export function vehicleStats(entries: FuelEntry[]): VehicleStats {
  const fills = entries.filter((e) => !e.deleted_at).sort((a, b) => a.spent_at.localeCompare(b.spent_at));
  const liters = fills.reduce((s, e) => s + (e.liters ?? 0), 0);
  const cost_base = fills.reduce((s, e) => s + e.amount_base, 0);
  const odos = fills.map((e) => e.odometer_km).filter((v): v is number => v != null && v > 0);
  const km = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : null;
  // consumo: litros abastecidos entre a primeira e a última leitura de odômetro (exclui o primeiro tanque)
  let litersBetween = 0;
  if (odos.length >= 2) {
    const first = fills.findIndex((e) => e.odometer_km != null && e.odometer_km > 0);
    litersBetween = fills.slice(first + 1).reduce((s, e) => s + (e.liters ?? 0), 0);
  }
  const r = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    fills: fills.length,
    liters: r(liters),
    cost_base: r(cost_base),
    km,
    km_per_liter: km && litersBetween > 0 ? r(km / litersBetween) : null,
    cost_per_km: km && km > 0 ? r(cost_base / km) : null,
    price_per_liter: liters > 0 ? r(cost_base / liters) : null,
  };
}
