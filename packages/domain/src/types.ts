import { z } from "zod";

const iso = z.string(); // timestamps ISO-8601 em UTC
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD

export const EmergencySchema = z.object({
  contacts: z.array(z.object({ name: z.string(), phone: z.string(), relation: z.string().nullable() })),
  insurance: z.object({ company: z.string(), policy: z.string(), phone: z.string() }).nullable(),
  embassy: z.string().nullable(),
  blood_type: z.string().nullable(),
  allergies: z.string().nullable(),
  medications: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Emergency = z.infer<typeof EmergencySchema>;

export const TripSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  start_date: dateStr.nullable(),
  end_date: dateStr.nullable(),
  base_currency: z.string().length(3),
  status: z.enum(["planning", "active", "done"]),
  cover_asset_id: z.string().nullable().optional(),
  budget_base: z.number().nullable().optional(),
  emergency: EmergencySchema.nullable().optional(),
  created_at: iso,
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type Trip = z.infer<typeof TripSchema>;

export const TripDaySchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_index: z.number().int().positive(),
  date: dateStr.nullable(),
  timezone: z.string(),
  title: z.string().nullable(),
  narrative: z.string().nullable(),
  logistics_notes: z.string().nullable(),
  expected_km: z.number().nullable().optional(),
  expected_travel_min: z.number().int().nullable().optional(),
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type TripDay = z.infer<typeof TripDaySchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_id: z.string(),
  position: z.number(),
  type: z.string(),
  title: z.string().min(1),
  start_time: z.string().nullable(), // HH:MM
  end_time: z.string().nullable(),
  place_name: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  notes: z.string().nullable(),
  status: z.enum(["planned", "done", "skipped"]),
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const OcrResultSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  date: dateStr.nullable(),
  merchant: z.string().nullable(),
  category_guess: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  raw_text: z.string().optional(),
  source: z.enum(["ocr_online", "ocr_offline"]),
});
export type OcrResult = z.infer<typeof OcrResultSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  kind: z.enum(["document", "photo", "audio", "link"]),
  category: z.string(),
  title: z.string().min(1),
  storage_path: z.string().nullable(),
  url: z.string().nullable(),
  mime: z.string().nullable(),
  size_bytes: z.number().nullable(),
  sha256: z.string().nullable(),
  sensitive: z.boolean(),
  critical: z.boolean(),
  ocr: OcrResultSchema.nullable().optional(),
  ocr_status: z.enum(["none", "pending", "done", "failed"]),
  captured_at: iso.nullable(),
  expires_at: dateStr.nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  attribution: z.string().nullable().optional(),
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetDaySchema = z.object({
  id: z.string(), // `${asset_id}:${day_id}`
  asset_id: z.string(),
  day_id: z.string(),
  trip_id: z.string(),
  priority: z.number().int(),
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type AssetDay = z.infer<typeof AssetDaySchema>;

export const ExpenseSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_id: z.string().nullable(),
  category: z.string(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  fx_rate: z.number().positive(),
  fx_rate_date: dateStr,
  amount_base: z.number(),
  paid_by: z.string().nullable(),
  split: z.record(z.number()).nullable().optional(),
  liters: z.number().nullable().optional(),
  odometer_km: z.number().nullable().optional(),
  payment_method: z.string().nullable(),
  merchant: z.string().nullable(),
  receipt_asset_id: z.string().nullable(),
  source: z.enum(["manual", "ocr_online", "ocr_offline"]),
  ocr_confidence: z.number().nullable(),
  notes: z.string().nullable(),
  spent_at: iso,
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const FxRateSchema = z.object({
  id: z.string(), // `${base}:${quote}:${date}`
  base: z.string().length(3),
  quote: z.string().length(3),
  date: dateStr,
  rate: z.number().positive(),
  provider: z.string(),
});
export type FxRate = z.infer<typeof FxRateSchema>;

export const AiSuggestionSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_id: z.string().nullable(),
  kind: z.enum(["activity", "stop", "poi", "image", "expense"]),
  payload: z.record(z.unknown()),
  reason: z.string().nullable(),
  status: z.enum(["proposed", "accepted", "dismissed"]),
  updated_at: iso,
});
export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;

/** Saída estruturada do parsing de roteiro (Módulo 4). */
export const ParsedItinerarySchema = z.object({
  title: z.string(),
  start_date: dateStr.nullable(),
  base_currency: z.string().length(3).nullable(),
  days: z.array(
    z.object({
      day_index: z.number().int().positive(),
      date: dateStr.nullable(),
      title: z.string(),
      narrative: z.string().nullable(),
      destination: z.string().nullable(),
      activities: z.array(
        z.object({
          title: z.string(),
          type: z.string(),
          start_time: z.string().nullable(),
          end_time: z.string().nullable(),
          place_name: z.string().nullable(),
          notes: z.string().nullable(),
        }),
      ),
    }),
  ),
});
export type ParsedItinerary = z.infer<typeof ParsedItinerarySchema>;

export const TravelerSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  name: z.string().min(1),
  color: z.string(),
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type TravelerRow = z.infer<typeof TravelerSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_id: z.string().nullable(),
  kind: z.enum(["packing", "day", "border", "vehicle"]),
  text: z.string().min(1),
  done: z.boolean(),
  position: z.number(),
  updated_at: iso,
  deleted_at: iso.nullable().optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
