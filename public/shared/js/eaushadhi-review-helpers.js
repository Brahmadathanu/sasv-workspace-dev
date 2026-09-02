/**
 * Pure helpers for e-Aushadhi Review & Control.
 * No DOM, no Supabase, no rendering.
 */

export const MODULE_ID = "e-aushadhi-automation";
export const MODULE_TARGET = "module:e-aushadhi-automation";

export const PORTAL_DOMAINS = Object.freeze([
  "INGREDIENT_TYPE",
  "INGREDIENT_FORM",
  "PART_USED",
  "MEASUREMENT_UNIT",
]);

export const WORKSPACE_TABS = Object.freeze([
  "overview",
  "details",
  "composition",
  "actions",
  "evidence",
  "readiness",
]);

export const WORKFLOW_STAGES = Object.freeze([
  { id: "overview", step: 1, label: "Overview" },
  { id: "details", step: 2, label: "Product Details" },
  { id: "composition", step: 3, label: "Composition" },
  { id: "actions", step: 4, label: "Pharmacological Action" },
  { id: "evidence", step: 5, label: "Evidence" },
  { id: "readiness", step: 6, label: "Readiness" },
]);

export const QUEUE_RENDER_CHUNK = 40;
export const QUEUE_SCROLL_THRESHOLD_PX = 100;

export const REVIEW_LENSES = Object.freeze([
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "in_review", label: "In Review" },
  { id: "verified", label: "Verified" },
  { id: "blocked", label: "Blocked" },
  { id: "ready", label: "Ready" },
]);

export const SYSTEM_LENSES = Object.freeze([
  { id: "all", label: "All" },
  { id: "ayurveda", label: "Ayurveda" },
  { id: "siddha", label: "Siddha" },
]);

export const CLASS_LENSES = Object.freeze([
  { id: "all", label: "All" },
  { id: "classical", label: "Classical" },
  { id: "proprietary", label: "Proprietary" },
]);

export const COMPOSITION_REVIEW_LENSES = Object.freeze([
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "in_review", label: "In Review" },
  { id: "verified", label: "Verified" },
]);

export const COMPOSITION_ATTENTION_FILTERS = Object.freeze([
  { id: "all", label: "All" },
  { id: "issues", label: "Issues" },
  { id: "default_suggestions", label: "Default suggestions" },
]);

export const QUEUE_FILTERS = Object.freeze([
  ...REVIEW_LENSES.map((item) =>
    item.id === "pending" ? { ...item, label: "Pending Review" } : item,
  ),
  ...SYSTEM_LENSES.filter((item) => item.id !== "all"),
  ...CLASS_LENSES.filter((item) => item.id !== "all"),
]);

export const KPI_LENS_MAP = Object.freeze({
  products: "all",
  pending: "pending",
  in_review: "in_review",
  verified: "verified",
  blocked: "blocked",
  ready: "ready",
});

export const PROVENANCE = Object.freeze({
  VERIFIED: "verified",
  MANUALLY_CHANGED: "manually_changed",
  DEFAULT_SUGGESTION: "default_suggestion",
  EXACT_SUGGESTION: "exact_suggestion",
  NO_SUGGESTION: "no_suggestion",
});

export const PROVENANCE_LABELS = Object.freeze({
  verified: "Verified",
  manually_changed: "Manually changed",
  default_suggestion: "Default suggestion",
  exact_suggestion: "Exact suggestion",
  no_suggestion: "No suggestion",
});

export const DUMMY_REVIEW_DEFAULT = "DUMMY_REVIEW_DEFAULT";

export const SUGGESTION_FIELD_KEYS = Object.freeze({
  INGREDIENT_TYPE: "ingredient_type",
  INGREDIENT_FORM: "ingredient_form",
  PART_USED: "part_used",
  MEASUREMENT_UNIT: "measurement_unit",
});

export const ERROR_KIND = Object.freeze({
  AUTHORIZATION: "authorization",
  STALE: "stale",
  VALIDATION: "validation",
  BLOCKER: "blocker",
  NETWORK: "network",
  SERVER: "server",
});

const PORTAL_FIELD_SPECS = Object.freeze([
  {
    domain: "INGREDIENT_TYPE",
    selectedKey: "selected_ingredient_type_option_id",
    suggestedKey: "suggested_ingredient_type_option_id",
    draftKey: "ingredientTypeOptionId",
  },
  {
    domain: "INGREDIENT_FORM",
    selectedKey: "selected_ingredient_form_option_id",
    suggestedKey: "suggested_ingredient_form_option_id",
    draftKey: "ingredientFormOptionId",
  },
  {
    domain: "PART_USED",
    selectedKey: "selected_part_used_option_id",
    suggestedKey: "suggested_part_used_option_id",
    draftKey: "partUsedOptionId",
  },
  {
    domain: "MEASUREMENT_UNIT",
    selectedKey: "selected_measurement_option_id",
    suggestedKey: "suggested_measurement_option_id",
    draftKey: "measurementOptionId",
  },
]);

export function portalFieldSpecs() {
  return PORTAL_FIELD_SPECS;
}

export function safeText(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function displayText(value, empty = "-") {
  const text = safeText(value);
  return text || empty;
}

export const UI_HTML_SEP = " &middot; ";

export function joinHtmlParts(parts) {
  return (Array.isArray(parts) ? parts : [])
    .map((part) => safeText(part))
    .filter((part) => part && part !== "-")
    .join(UI_HTML_SEP);
}

export function sourceFieldDisplay(value) {
  const text = safeText(value);
  return text || "Not provided in source";
}

export function formatRawQuantityDisplay(quantityText, unitText) {
  const qty = safeText(quantityText);
  const unit = safeText(unitText);
  if (!qty) return unit;
  if (!unit) return qty;
  const qtyLower = qty.toLowerCase();
  const unitLower = unit.toLowerCase();
  if (qtyLower === unitLower) return qty;
  const escaped = unitLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenSuffix = new RegExp(`(?:^|[\\s])${escaped}$`, "i");
  if (tokenSuffix.test(qty)) return qty;
  if (
    qtyLower.endsWith(unitLower) &&
    /\d/.test(qtyLower.slice(0, Math.max(0, qtyLower.length - unitLower.length)))
  ) {
    return qty;
  }
  return `${qty} ${unit}`;
}

export function optionId(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  return text || null;
}

export function idsEqual(left, right) {
  const a = optionId(left);
  const b = optionId(right);
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a === b;
}

export function effectiveOptionId(selectedId, suggestedId) {
  return optionId(selectedId) ?? optionId(suggestedId);
}

export function normalizeReviewStatus(value) {
  return safeText(value).toUpperCase();
}

export function normalizeEntryStatus(value) {
  return safeText(value).toUpperCase() || "NOT_STARTED";
}

export function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatVerifiedTotal(verified, total) {
  return `${toInt(verified)} / ${toInt(total)}`;
}

export function parseSuggestionBasis(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const SOURCE_RESOLVABLE_ISSUE_CODES = Object.freeze([
  "SOURCE_SCIENTIFIC_IDENTITY_MISSING",
  "SOURCE_PART_USED_MISSING",
]);

export function suggestionBasisSummary(raw) {
  const basis = parseSuggestionBasis(raw);
  if (!basis) {
    const text = safeText(raw);
    if (!text || text.startsWith("{") || text.startsWith("[")) return "";
    return text;
  }
  const candidates = [
    basis.summary,
    basis.evidence_summary,
    basis.evidence_label,
    basis.basis_label,
    basis.display,
    typeof basis.basis === "string" ? basis.basis : "",
  ];
  for (const candidate of candidates) {
    const text = safeText(candidate);
    if (!text) continue;
    if (/_id$/i.test(text) || /^\d+$/.test(text)) continue;
    if (/^[A-Z0-9_]+$/.test(text) && text.includes("_")) {
      return text.toLowerCase().replace(/_/g, " ");
    }
    return text;
  }
  return "";
}

export function isResolvableSourceIssue(issue) {
  const code = safeText(issue?.issue_code).toUpperCase();
  const status = safeText(issue?.status).toUpperCase();
  if (status && status !== "OPEN" && status !== "IN_REVIEW") return false;
  return SOURCE_RESOLVABLE_ISSUE_CODES.includes(code);
}

export function lineHasResolvableSourceIssue(issues, sourceCompositionLineId) {
  return issuesForLine(issues, sourceCompositionLineId).some(isResolvableSourceIssue);
}

export function canSubmitSourceResolution({
  confirmIdentity = false,
  confirmPartUsed = false,
} = {}) {
  return confirmIdentity === true || confirmPartUsed === true;
}

export function suggestionFieldMode(suggestionBasis, fieldKey) {
  const basis = parseSuggestionBasis(suggestionBasis);
  if (!basis || !fieldKey) return "";
  const keys =
    fieldKey === "measurement_unit"
      ? ["measurement_unit", "measurement"]
      : [fieldKey];
  for (const key of keys) {
    const node = basis[key];
    if (node && typeof node === "object") {
      return safeText(node.mode).toUpperCase();
    }
    if (typeof node === "string") return node.trim().toUpperCase();
  }
  return "";
}

/**
 * Provenance for one portal-mapped field.
 * Server suggestion_basis is authoritative for dummy vs stronger suggestion.
 */
export function resolveFieldProvenance({
  reviewStatus,
  selectedId,
  suggestedId,
  suggestionBasis,
  fieldKey,
} = {}) {
  if (normalizeReviewStatus(reviewStatus) === "VERIFIED") {
    return PROVENANCE.VERIFIED;
  }
  const selected = optionId(selectedId);
  const suggested = optionId(suggestedId);
  if (selected && suggested && !idsEqual(selected, suggested)) {
    return PROVENANCE.MANUALLY_CHANGED;
  }
  if (!suggested) return PROVENANCE.NO_SUGGESTION;
  const mode = suggestionFieldMode(suggestionBasis, fieldKey);
  if (mode === DUMMY_REVIEW_DEFAULT) return PROVENANCE.DEFAULT_SUGGESTION;
  return PROVENANCE.EXACT_SUGGESTION;
}

export function provenanceLabel(code) {
  return PROVENANCE_LABELS[code] || PROVENANCE_LABELS.no_suggestion;
}

export function matchesSearch(row, query) {
  const q = safeText(query).toLowerCase();
  if (!q) return true;
  const hay = [
    row?.product_name,
    row?.system_label,
    row?.medicine_class_label,
    row?.dosage_form_label,
    row?.subtype_label,
    row?.review_status,
    row?.entry_status,
  ]
    .map((part) => safeText(part).toLowerCase())
    .join(" ");
  return hay.includes(q);
}

export function matchesReviewLens(row, lensId) {
  const id = safeText(lensId) || "all";
  if (id === "all") return true;
  const review = normalizeReviewStatus(row?.review_status);
  if (id === "pending") return review === "PENDING" || review === "";
  if (id === "in_review") return review === "IN_REVIEW";
  if (id === "verified") return review === "VERIFIED";
  if (id === "blocked") return toInt(row?.open_blockers) > 0;
  if (id === "ready") return row?.is_ready_for_entry === true;
  return true;
}

export function matchesSystemLens(row, lensId) {
  const id = safeText(lensId) || "all";
  if (id === "all") return true;
  const system = safeText(row?.system_label).toLowerCase();
  if (id === "ayurveda") return /\bayurveda\b/.test(system);
  if (id === "siddha") return /\bsiddha\b/.test(system);
  return true;
}

export function matchesClassLens(row, lensId) {
  const id = safeText(lensId) || "all";
  if (id === "all") return true;
  const medicineClass = safeText(row?.medicine_class_label).toLowerCase();
  if (id === "classical") return /\bclassical\b/.test(medicineClass);
  if (id === "proprietary") return /\bproprietary\b/.test(medicineClass);
  return true;
}

export function matchesQueueFilter(row, filterId) {
  const id = safeText(filterId) || "all";
  if (id === "all") return true;
  if (["pending", "in_review", "verified", "blocked", "ready"].includes(id)) {
    return matchesReviewLens(row, id);
  }
  if (id === "ayurveda" || id === "siddha") return matchesSystemLens(row, id);
  if (id === "classical" || id === "proprietary") return matchesClassLens(row, id);
  return true;
}

export function filterQueueRows(
  rows,
  {
    filterId,
    search = "",
    reviewLens = "all",
    systemLens = "all",
    classLens = "all",
  } = {},
) {
  const list = Array.isArray(rows) ? rows : [];
  let review = reviewLens;
  let system = systemLens;
  let klass = classLens;
  const legacy = safeText(filterId);
  if (legacy && legacy !== "all") {
    if (["pending", "in_review", "verified", "blocked", "ready"].includes(legacy)) {
      review = legacy;
    } else if (legacy === "ayurveda" || legacy === "siddha") {
      system = legacy;
    } else if (legacy === "classical" || legacy === "proprietary") {
      klass = legacy;
    }
  }
  return list.filter(
    (row) =>
      matchesReviewLens(row, review) &&
      matchesSystemLens(row, system) &&
      matchesClassLens(row, klass) &&
      matchesSearch(row, search),
  );
}

export function nextQueueRenderCount(
  currentCount,
  filteredTotal,
  chunk = QUEUE_RENDER_CHUNK,
) {
  const total = Math.max(0, toInt(filteredTotal));
  const current = Math.max(0, toInt(currentCount));
  const size = Math.max(1, toInt(chunk, QUEUE_RENDER_CHUNK));
  if (total === 0) return 0;
  if (current <= 0) return Math.min(size, total);
  return Math.min(total, current + size);
}

export function visibleQueueRows(rows, renderedCount) {
  const list = Array.isArray(rows) ? rows : [];
  const count = Math.max(0, toInt(renderedCount));
  return list.slice(0, count);
}

export function resetQueueRenderCount(filteredTotal, chunk = QUEUE_RENDER_CHUNK) {
  const total = Math.max(0, toInt(filteredTotal));
  const size = Math.max(1, toInt(chunk, QUEUE_RENDER_CHUNK));
  return Math.min(size, total);
}

export function shouldAppendQueueChunk({
  scrollTop = 0,
  clientHeight = 0,
  scrollHeight = 0,
  threshold = QUEUE_SCROLL_THRESHOLD_PX,
} = {}) {
  return (
    toInt(scrollTop) + toInt(clientHeight) >=
    toInt(scrollHeight) - Math.max(0, toInt(threshold))
  );
}

export function formatShowingCount(shown, total) {
  return `Showing ${toInt(shown)} of ${toInt(total)}`;
}

export function snapshotQueueView(view) {
  return {
    search: safeText(view?.search),
    reviewLens: safeText(view?.reviewLens) || "all",
    systemLens: safeText(view?.systemLens) || "all",
    classLens: safeText(view?.classLens) || "all",
    renderedCount: toInt(view?.renderedCount),
    scrollTop: toInt(view?.scrollTop),
  };
}

export function compositionIsComplete(row, evidence) {
  if (row?.composition_review_complete === true) return true;
  const total = toInt(row?.composition_lines ?? evidence?.composition_lines_total);
  const verified = toInt(
    row?.verified_lines ?? evidence?.composition_lines_verified,
  );
  return total > 0 && verified === total;
}

export function nextRequiredAction({
  reviewStatus,
  queueRow,
  evidence,
  pharmacologicalActionPresent,
} = {}) {
  const row = queueRow || {};
  const ev = evidence || {};
  if (normalizeReviewStatus(reviewStatus || row.review_status) !== "VERIFIED") {
    return {
      code: "details",
      tab: "details",
      label: "Next: Review Product Details",
    };
  }
  if (!compositionIsComplete(row, ev)) {
    return {
      code: "composition",
      tab: "composition",
      label: "Next: Review Composition",
    };
  }
  const actionPresent =
    pharmacologicalActionPresent === true ||
    ev.pharmacological_action_present === true;
  if (!actionPresent) {
    return {
      code: "actions",
      tab: "actions",
      label: "Next: Review Pharmacological Action",
    };
  }
  if (ev.approved_product_copy_present !== true) {
    return {
      code: "copy",
      tab: "evidence",
      label: "Next: Approved Product Copy pending",
    };
  }
  if (ev.approved_formulation_present !== true) {
    return {
      code: "promote",
      tab: "readiness",
      label: "Next: Promote verified formulation when eligible",
    };
  }
  if (row.is_ready_for_entry === true) {
    return {
      code: "ready",
      tab: "readiness",
      label: "Ready for e-Aushadhi",
    };
  }
  return {
    code: "verify",
    tab: "readiness",
    label: "Next: Verify Product internally",
  };
}

export function workflowStageComplete(stageId, ctx = {}) {
  const row = ctx.queueRow || {};
  const ev = ctx.evidence || {};
  const review = ctx.review || {};
  if (stageId === "overview") return true;
  if (stageId === "details") {
    return normalizeReviewStatus(review.review_status) === "VERIFIED";
  }
  if (stageId === "composition") return compositionIsComplete(row, ev);
  if (stageId === "actions") return ev.pharmacological_action_present === true;
  if (stageId === "evidence") {
    return (
      ev.approved_product_copy_present === true &&
      ev.approved_formulation_present === true &&
      ev.pharmacological_action_present === true
    );
  }
  if (stageId === "readiness") return row.is_ready_for_entry === true;
  return false;
}

export function isEditableKeyboardTarget(el) {
  if (!el || el === document.body) return false;
  const node = el.nodeType === 1 ? el : el.parentElement;
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = safeText(node.tagName).toUpperCase();
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "OPTION") {
    return true;
  }
  return Boolean(node.closest?.("input, select, textarea, [contenteditable='true']"));
}

export function nextRovingIndex(current, length, key, { wrap = true } = {}) {
  const len = Math.max(0, toInt(length));
  if (len <= 0) return 0;
  let index = toInt(current);
  if (index < 0) index = 0;
  if (index >= len) index = len - 1;
  if (key === "Home") return 0;
  if (key === "End") return len - 1;
  if (key === "ArrowRight" || key === "ArrowDown") {
    if (index + 1 >= len) return wrap ? 0 : len - 1;
    return index + 1;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    if (index - 1 < 0) return wrap ? len - 1 : 0;
    return index - 1;
  }
  return index;
}

export function matchesCompositionSearch(row, query) {
  const q = safeText(query).toLowerCase();
  if (!q) return true;
  const hay = [
    row?.raw_ingredient_name,
    row?.raw_scientific_name,
    row?.raw_part_used,
    row?.source_row_no,
    row?.source_composition_line_id,
  ]
    .map((part) => safeText(part).toLowerCase())
    .join(" ");
  return hay.includes(q);
}

export function lineHasLiveIssue(issues, sourceCompositionLineId) {
  return issuesForLine(issues, sourceCompositionLineId).some((issue) => {
    const status = safeText(issue?.status).toUpperCase();
    if (status && status !== "OPEN" && status !== "IN_REVIEW") return false;
    return severityRank(issue?.severity) >= 1;
  });
}

export function lineHasDefaultSuggestion(row) {
  return portalFieldSpecs().some((spec) => {
    const fieldKey = SUGGESTION_FIELD_KEYS[spec.domain];
    return suggestionFieldMode(row?.suggestion_basis, fieldKey) === DUMMY_REVIEW_DEFAULT;
  });
}

export function matchesCompositionReviewLens(row, lensId) {
  const id = safeText(lensId) || "all";
  if (id === "all") return true;
  const review = normalizeReviewStatus(row?.review_status);
  if (id === "pending") return review === "PENDING" || review === "";
  if (id === "in_review") return review === "IN_REVIEW";
  if (id === "verified") return review === "VERIFIED";
  return true;
}

export function filterCompositionLines(
  lines,
  issues,
  { search = "", reviewLens = "all", attention = "all" } = {},
) {
  const list = Array.isArray(lines) ? lines : [];
  return list.filter((row) => {
    if (!matchesCompositionSearch(row, search)) return false;
    if (!matchesCompositionReviewLens(row, reviewLens)) return false;
    const id = optionId(row?.source_composition_line_id);
    if (attention === "issues" && !lineHasLiveIssue(issues, id)) return false;
    if (attention === "default_suggestions" && !lineHasDefaultSuggestion(row)) {
      return false;
    }
    return true;
  });
}

export function compositionFiltersAreActive({ search, reviewLens, attention } = {}) {
  return Boolean(
    safeText(search) ||
      (safeText(reviewLens) && reviewLens !== "all") ||
      (safeText(attention) && attention !== "all"),
  );
}

export function promoteUnavailableReason(args = {}) {
  if (canPromoteFormulation(args)) return "";
  if (args.canEdit !== true) {
    return "Promote is unavailable with read-only access.";
  }
  return "Promote becomes available after Product Details and all composition lines are verified and blocking issues are cleared.";
}

export function verifyProductUnavailableReason(args = {}) {
  if (canVerifyProductWorkflow(args)) return "";
  if (args.canEdit !== true) {
    return "Internal verification is unavailable with read-only access.";
  }
  return "Verify Product internally becomes available after composition is complete and blocking issues are cleared.";
}

export function queueKpis(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    products: list.length,
    pending: list.filter((row) =>
      ["PENDING", ""].includes(normalizeReviewStatus(row?.review_status)),
    ).length,
    inReview: list.filter(
      (row) => normalizeReviewStatus(row?.review_status) === "IN_REVIEW",
    ).length,
    verified: list.filter(
      (row) => normalizeReviewStatus(row?.review_status) === "VERIFIED",
    ).length,
    blocked: list.filter((row) => toInt(row?.open_blockers) > 0).length,
    ready: list.filter((row) => row?.is_ready_for_entry === true).length,
  };
}

export function reviewStatusChipClass(status) {
  const value = normalizeReviewStatus(status);
  if (value === "VERIFIED") return "success";
  if (value === "IN_REVIEW") return "warning";
  return "neutral";
}

export function entryStatusChipClass(status) {
  const value = normalizeEntryStatus(status);
  if (value === "NOT_STARTED") return "neutral";
  if (value === "IN_PROGRESS") return "warning";
  if (value === "ENTERED" || value === "PORTAL_VERIFIED" || value === "SUBMITTED") {
    return "info";
  }
  return "neutral";
}

export function severityRank(severity) {
  const value = safeText(severity).toUpperCase();
  if (value === "BLOCKER") return 3;
  if (value === "ERROR") return 2;
  if (value === "WARNING") return 1;
  return 0;
}

export function severityLabel(severity) {
  const value = safeText(severity).toUpperCase();
  return value || "UNKNOWN";
}

export function issuesForLine(issues, sourceCompositionLineId) {
  const lineId = optionId(sourceCompositionLineId);
  const list = Array.isArray(issues) ? issues : [];
  if (!lineId) return [];
  return list.filter((issue) =>
    idsEqual(issue?.source_composition_line_id, lineId),
  );
}

export function lineHasBlockerOrError(issues, sourceCompositionLineId) {
  return issuesForLine(issues, sourceCompositionLineId).some(
    (issue) => severityRank(issue?.severity) >= 2,
  );
}

export function openErrorOrBlockerCount(issues) {
  const list = Array.isArray(issues) ? issues : [];
  return list.filter((issue) => {
    const status = safeText(issue?.status).toUpperCase();
    if (status && status !== "OPEN" && status !== "IN_REVIEW") return false;
    return severityRank(issue?.severity) >= 2;
  }).length;
}

export function formatIssueDetails(detailsJson) {
  const details = parseSuggestionBasis(detailsJson) || detailsJson;
  if (details == null || details === "") return "";
  if (typeof details !== "object") return safeText(details);
  const preferred = [
    "message",
    "detail",
    "reason",
    "raw_unit_text",
    "raw_quantity_text",
    "raw_part_used",
    "raw_scientific_name",
    "source_unit",
    "note",
  ];
  const parts = [];
  for (const key of preferred) {
    if (details[key] != null && safeText(details[key])) {
      parts.push(`${key}: ${safeText(details[key])}`);
    }
  }
  if (parts.length) return parts.join(" / ");
  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}

export function detailsDraftFromReview(review) {
  const row = review || {};
  return {
    permissionPurposeTermId: optionId(
      row.selected_permission_purpose_term_id ??
        row.suggested_permission_purpose_term_id,
    ),
    compositionTitle: row.selected_composition_title ?? "",
    diseasesConditions: row.selected_diseases_conditions_text ?? "",
    containsBhang: row.selected_contains_bhang,
    containsOpium: row.selected_contains_opium,
    containsOtherNarcotic: row.selected_contains_other_narcotic,
    containsScheduleE1: row.selected_contains_schedule_e1,
    containsSelfGeneratedAlcohol: row.selected_contains_self_generated_alcohol,
    reviewNotes: row.review_notes ?? "",
    rowVersion: row.row_version ?? null,
  };
}

export function lineDraftFromRow(row) {
  const source = row || {};
  return {
    sourceCompositionLineId: optionId(source.source_composition_line_id),
    ingredientTypeOptionId: effectiveOptionId(
      source.selected_ingredient_type_option_id,
      source.suggested_ingredient_type_option_id,
    ),
    ingredientFormOptionId: effectiveOptionId(
      source.selected_ingredient_form_option_id,
      source.suggested_ingredient_form_option_id,
    ),
    partUsedOptionId: effectiveOptionId(
      source.selected_part_used_option_id,
      source.suggested_part_used_option_id,
    ),
    measurementOptionId: effectiveOptionId(
      source.selected_measurement_option_id,
      source.suggested_measurement_option_id,
    ),
    reviewNotes: source.review_notes ?? "",
    rowVersion: source.row_version ?? null,
  };
}

export function actionsDraftFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .slice()
    .sort((a, b) => toInt(a?.sequence_no) - toInt(b?.sequence_no))
    .map((row) => safeText(row?.action_text))
    .filter(Boolean);
}

function omitRowVersion(draft) {
  if (!draft || typeof draft !== "object") return draft || {};
  const copy = { ...draft };
  delete copy.rowVersion;
  return copy;
}

export function detailsDirty(draft, baseline) {
  return (
    JSON.stringify(omitRowVersion(draft)) !==
    JSON.stringify(omitRowVersion(baseline))
  );
}

export function lineDirty(draft, baseline) {
  return (
    JSON.stringify(omitRowVersion(draft)) !==
    JSON.stringify(omitRowVersion(baseline))
  );
}

export function actionsDirty(draft, baseline) {
  const a = Array.isArray(draft) ? draft.map((item) => safeText(item)) : [];
  const b = Array.isArray(baseline) ? baseline.map((item) => safeText(item)) : [];
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function lineSelectionsComplete(draft) {
  return Boolean(
    optionId(draft?.ingredientTypeOptionId) &&
      optionId(draft?.ingredientFormOptionId) &&
      optionId(draft?.partUsedOptionId) &&
      optionId(draft?.measurementOptionId),
  );
}

export function canPromoteFormulation({
  canEdit,
  productReviewStatus,
  compositionReviewComplete,
  verifiedLines,
  compositionLines,
  openBlockers,
  errorOrBlockerIssueCount,
  approvedFormulationPresent,
  workflowRowVersion,
} = {}) {
  if (!canEdit) return false;
  if (normalizeReviewStatus(productReviewStatus) !== "VERIFIED") return false;
  const linesComplete =
    compositionReviewComplete === true ||
    (toInt(compositionLines) > 0 &&
      toInt(verifiedLines) === toInt(compositionLines));
  if (!linesComplete) return false;
  if (toInt(openBlockers) > 0) return false;
  if (toInt(errorOrBlockerIssueCount) > 0) return false;
  if (approvedFormulationPresent === true) return false;
  if (workflowRowVersion == null || workflowRowVersion === "") return false;
  return true;
}

export function canVerifyProductWorkflow({
  canEdit,
  compositionReviewComplete,
  verifiedLines,
  compositionLines,
  openBlockers,
  workflowRowVersion,
} = {}) {
  if (!canEdit) return false;
  const linesComplete =
    compositionReviewComplete === true ||
    (toInt(compositionLines) > 0 &&
      toInt(verifiedLines) === toInt(compositionLines));
  if (!linesComplete) return false;
  if (toInt(openBlockers) > 0) return false;
  if (workflowRowVersion == null || workflowRowVersion === "") return false;
  return true;
}

export function classifyRpcError(error) {
  const code = safeText(error?.code || error?.errcode);
  const message = safeText(error?.message || error?.error_description || error);
  const combined = `${code} ${message}`.toLowerCase();

  if (
    code === "42501" ||
    /not authenticated|permission is required|permission denied|42501/.test(
      combined,
    )
  ) {
    return {
      kind: ERROR_KIND.AUTHORIZATION,
      userMessage: "You do not have permission for this e-Aushadhi action.",
      retryable: false,
    };
  }

  if (
    code === "40001" ||
    /stale|row changed|changed or not found|refresh and retry|expected version/.test(
      combined,
    )
  ) {
    return {
      kind: ERROR_KIND.STALE,
      userMessage:
        "This record changed since you loaded it. Your edits were kept. Review the reloaded server values, then save again.",
      retryable: false,
    };
  }

  if (
    /blocker|open error|prevents formulation|still has .*unverified|not in scope|must be verified|already exists/.test(
      combined,
    )
  ) {
    return {
      kind: ERROR_KIND.BLOCKER,
      userMessage: message || "Readiness or blocker rules prevented this action.",
      retryable: false,
    };
  }

  if (
    /required|invalid|blank|duplicate|cannot be|unsupported|unusable quantity/.test(
      combined,
    )
  ) {
    return {
      kind: ERROR_KIND.VALIDATION,
      userMessage: message || "Please correct the highlighted fields and retry.",
      retryable: false,
    };
  }

  if (
    /failed to fetch|network|cors|timeout|fetch/.test(combined) ||
    error?.isCorsError
  ) {
    return {
      kind: ERROR_KIND.NETWORK,
      userMessage: "Network error. Check the connection and try again.",
      retryable: true,
    };
  }

  return {
    kind: ERROR_KIND.SERVER,
    userMessage: message || "The server could not complete this action.",
    retryable: false,
  };
}

export function userMessageForError(error) {
  return classifyRpcError(error).userMessage;
}

export function mergePreservedLineDraft(serverRow, localDraft) {
  const fresh = lineDraftFromRow(serverRow);
  if (!localDraft) return { draft: fresh, preserved: false };
  const baselineShape = {
    ...fresh,
    ingredientTypeOptionId: localDraft.ingredientTypeOptionId,
    ingredientFormOptionId: localDraft.ingredientFormOptionId,
    partUsedOptionId: localDraft.partUsedOptionId,
    measurementOptionId: localDraft.measurementOptionId,
    reviewNotes: localDraft.reviewNotes,
  };
  const wasDirty = lineDirty(localDraft, lineDraftFromRow(serverRow));
  if (!wasDirty) return { draft: fresh, preserved: false };
  return {
    draft: {
      ...baselineShape,
      rowVersion: fresh.rowVersion,
    },
    preserved: true,
  };
}

export function findQueueRow(rows, productId) {
  const id = optionId(productId);
  const list = Array.isArray(rows) ? rows : [];
  return list.find((row) => idsEqual(row?.product_id, id)) || null;
}
