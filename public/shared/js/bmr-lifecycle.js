/** Shared client guard for BMR lifecycle-aware operational selectors. */
export const BMR_LIFECYCLE = Object.freeze({
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  CANCELLED: "CANCELLED",
  UNKNOWN: "UNKNOWN",
});

export function normalizeBmrLifecycle(value) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return [
    BMR_LIFECYCLE.ACTIVE,
    BMR_LIFECYCLE.SUPERSEDED,
    BMR_LIFECYCLE.CANCELLED,
  ].includes(normalized)
    ? normalized
    : BMR_LIFECYCLE.UNKNOWN;
}

export function isVerifiedActiveBmr(value) {
  return normalizeBmrLifecycle(value) === BMR_LIFECYCLE.ACTIVE;
}

export async function retainActiveBmrCandidates(supabase, rows, idKey = "bmr_id") {
  const candidates = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(candidates.map((row) => Number(row?.[idKey])).filter(Number.isFinite))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("bmr_details")
    .select("id,lifecycle_status")
    .in("id", ids)
    .eq("lifecycle_status", BMR_LIFECYCLE.ACTIVE);
  if (error) throw error;
  const activeIds = new Set((data || []).map((row) => Number(row.id)));
  return candidates.filter((row) => activeIds.has(Number(row?.[idKey])));
}
