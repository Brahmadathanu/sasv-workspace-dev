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

export function referenceGovernanceLabel(mapping) {
  return mapping?.reference_ready === true
    ? "Verified globally"
    : "Global reference mapping required";
}

export function positiveReferenceSelectionId(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const selectedId = Number(value);
  return Number.isInteger(selectedId) && selectedId > 0 ? selectedId : null;
}

export function filterReferenceDictionary(rows, { search = "", statusFilter = "all" } = {}) {
  const needle = String(search || "").trim().toLowerCase();
  const status = String(statusFilter || "all").trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const searchMatch = !needle || [
      row?.source_reference_text,
      row?.canonical_code,
      row?.canonical_label,
      row?.portal_label,
      row?.portal_external_id,
    ].some((value) => String(value || "").toLowerCase().includes(needle));
    if (!searchMatch) return false;
    if (status === "ready") return row?.reference_ready === true;
    if (status === "mapping-required") return row?.reference_ready !== true;
    if (status === "suggested") {
      return row?.reference_ready !== true && (
        String(row?.alias_mapping_status || "").toUpperCase() === "DRAFT" ||
        String(row?.portal_mapping_status || "").toUpperCase() === "DRAFT"
      );
    }
    return true;
  });
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
