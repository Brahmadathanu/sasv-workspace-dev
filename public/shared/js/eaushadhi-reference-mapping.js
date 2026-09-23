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
  return mapping?.reference_ready === true;
}

export function referenceMappingPresentation(mapping) {
  const ready = referenceMappingReady(mapping);
  const status = String(mapping?.mapping_status || "").trim().toUpperCase();
  if (ready) return { ready: true, label: "Verified", reviewable: false };
  if (status === "VERIFIED") {
    return { ready: false, label: "Verified — not currently usable", reviewable: false };
  }
  if (status === "DRAFT") return { ready: false, label: "Suggested", reviewable: true };
  return { ready: false, label: "Unavailable", reviewable: false };
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
