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

export function associateReferenceMappingsByLine(lines, mappings) {
  const byLine = new Map();
  for (const mapping of Array.isArray(mappings) ? mappings : []) {
    for (const lineId of Array.isArray(mapping?.source_composition_line_ids)
      ? mapping.source_composition_line_ids
      : []) {
      const key = String(lineId ?? "").trim();
      if (!key || byLine.has(key)) continue;
      byLine.set(key, mapping);
    }
  }
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const key = String(line?.source_composition_line_id ?? "").trim();
    const mapping = byLine.get(key) || null;
    const sourceByLine = mapping?.source_reference_by_line;
    const mappedSource = sourceByLine && typeof sourceByLine === "object"
      ? sourceByLine[key]
      : null;
    return {
      ...line,
      raw_reference_text: line?.raw_reference_text || mappedSource || "",
      referenceMapping: mapping,
    };
  });
}
