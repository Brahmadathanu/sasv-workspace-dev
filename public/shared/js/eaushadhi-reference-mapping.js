export const REFERENCE_MATCH_LABELS = Object.freeze({
  EXACT: "Exact",
  NORMALIZED_EXACT: "Normalized match",
  ORTHOGRAPHIC_VARIANT: "Orthographic variant",
  TRANSLITERATION_VARIANT: "Transliteration variant",
  PARENT_WORK_MATCH: "Parent-work match",
  PARENT_WORK_TRANSLITERATION_MATCH: "Parent-work + transliteration",
  SEMANTIC_EQUIVALENT: "Semantic equivalent",
  MANUAL: "Manual selection",
});

export function referenceMatchLabel(value) {
  const code = String(value || "").trim().toUpperCase();
  return REFERENCE_MATCH_LABELS[code] || "Manual selection";
}

export function referenceMappingReady(mapping) {
  return mapping?.mapping_status === "VERIFIED" && String(mapping?.portal_external_id || "").trim() !== "";
}
