import Dexie, { type EntityTable } from "dexie";
import type { Trip, TripDay, Activity, Asset, AssetDay, Expense, FxRate, AiSuggestion, TravelerRow, ChecklistItem } from "@turism/domain";

/** Blob do arquivo, guardado localmente (IndexedDB) — é isso que garante o offline dos documentos. */
export interface AssetBlob {
  asset_id: string;
  blob: Blob;
  thumb?: Blob;
}

/** Fila de saída para sincronização com o servidor (quando configurado). */
export interface OutboxItem {
  id?: number;
  table: string;
  row_id: string;
  op: "upsert" | "delete";
  payload: unknown;
  created_at: string;
  attempts: number;
  last_error?: string;
}

export interface KV {
  key: string;
  value: unknown;
}

export class TurismDB extends Dexie {
  trips!: EntityTable<Trip, "id">;
  trip_days!: EntityTable<TripDay, "id">;
  activities!: EntityTable<Activity, "id">;
  assets!: EntityTable<Asset, "id">;
  asset_days!: EntityTable<AssetDay, "id">;
  expenses!: EntityTable<Expense, "id">;
  fx_rates!: EntityTable<FxRate, "id">;
  ai_suggestions!: EntityTable<AiSuggestion, "id">;
  travelers!: EntityTable<TravelerRow, "id">;
  checklist_items!: EntityTable<ChecklistItem, "id">;
  asset_blobs!: EntityTable<AssetBlob, "asset_id">;
  outbox!: EntityTable<OutboxItem, "id">;
  kv!: EntityTable<KV, "key">;

  constructor(name = "turism") {
    super(name);
    this.version(1).stores({
      trips: "id, status, updated_at",
      trip_days: "id, trip_id, [trip_id+day_index], date, updated_at",
      activities: "id, day_id, trip_id, [day_id+position], updated_at",
      assets: "id, trip_id, kind, category, ocr_status, updated_at",
      asset_days: "id, asset_id, day_id, trip_id, updated_at",
      expenses: "id, trip_id, day_id, spent_at, updated_at",
      fx_rates: "id, [base+quote], date",
      ai_suggestions: "id, trip_id, day_id, status, updated_at",
      asset_blobs: "asset_id",
      outbox: "++id, table, created_at",
      kv: "key",
    });
    this.version(2).stores({
      travelers: "id, trip_id, updated_at",
      checklist_items: "id, trip_id, day_id, [trip_id+kind], updated_at",
    });
  }
}

export const db = new TurismDB();
