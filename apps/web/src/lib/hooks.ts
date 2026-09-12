import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/schema";
import { listDays, assetsForDay } from "@/db/repo";

export function useTrip(tripId: string | undefined) {
  return useLiveQuery(() => (tripId ? db.trips.get(tripId) : undefined), [tripId]);
}
export function useDays(tripId: string | undefined) {
  return useLiveQuery(() => (tripId ? listDays(tripId) : []), [tripId]) ?? [];
}
export function useActivities(dayId: string | undefined) {
  return (
    useLiveQuery(async () => {
      if (!dayId) return [];
      const rows = await db.activities.where("day_id").equals(dayId).toArray();
      return rows.filter((a) => !a.deleted_at).sort((a, b) => a.position - b.position);
    }, [dayId]) ?? []
  );
}
export function useDayAssets(dayId: string | undefined) {
  return useLiveQuery(() => (dayId ? assetsForDay(dayId) : []), [dayId]) ?? [];
}
export function useTripAssets(tripId: string | undefined) {
  return (
    useLiveQuery(async () => {
      if (!tripId) return [];
      const rows = await db.assets.where("trip_id").equals(tripId).toArray();
      return rows.filter((a) => !a.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }, [tripId]) ?? []
  );
}
export function useAssetLinks(tripId: string | undefined) {
  return useLiveQuery(async () => (tripId ? (await db.asset_days.where("trip_id").equals(tripId).toArray()).filter((l) => !l.deleted_at) : []), [tripId]) ?? [];
}
export function useExpenses(tripId: string | undefined, dayId?: string) {
  return (
    useLiveQuery(async () => {
      if (!tripId) return [];
      const rows = dayId ? await db.expenses.where("day_id").equals(dayId).toArray() : await db.expenses.where("trip_id").equals(tripId).toArray();
      return rows.filter((e) => !e.deleted_at).sort((a, b) => b.spent_at.localeCompare(a.spent_at));
    }, [tripId, dayId]) ?? []
  );
}
export function useBlob(assetId: string | undefined, thumb = false) {
  return useLiveQuery(async () => {
    if (!assetId) return undefined;
    const b = await db.asset_blobs.get(assetId);
    return thumb ? (b?.thumb ?? b?.blob) : b?.blob;
  }, [assetId, thumb]);
}
export function useSuggestions(tripId: string | undefined, dayId?: string) {
  return (
    useLiveQuery(async () => {
      if (!tripId) return [];
      const rows = await db.ai_suggestions.where("trip_id").equals(tripId).toArray();
      return rows.filter((s) => s.status === "proposed" && (!dayId || s.day_id === dayId));
    }, [tripId, dayId]) ?? []
  );
}
