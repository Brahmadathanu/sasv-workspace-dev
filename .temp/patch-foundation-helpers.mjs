import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(
  root,
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const src = readFileSync(path, "utf8");
const marker =
  "\n/** Gate 11Y.10I.2B.3 — Foundation Review RPC args (bounded Run-82 context). */";
const keepIdx = src.indexOf(marker);
const keep =
  keepIdx >= 0
    ? src.slice(0, keepIdx)
    : src.replace(/\s+$/, "") + "\n";

const append = `
/** Gate 11Y.10I.2B.3 — Foundation Review RPC args (bounded Run-82 context). */
export function buildPrmFoundationReviewArgs({
  period_start = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.period_start,
  valuation_date = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.valuation_date,
  refresh_run_id = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
  as_of_date = null,
  lookback_months = null,
  group_evidence_class = null,
  product_group_id = null,
  search = null,
  limit = 25,
  offset = 0,
} = {}) {
  const errors = [];
  const period = normalizePrmAsOfDate(period_start, { fallbackToToday: false });
  const valuation = normalizePrmAsOfDate(valuation_date, {
    fallbackToToday: false,
  });
  const runId = normalizePrmIntegerId(refresh_run_id);
  if (!period) errors.push("p_period_start requires a valid YYYY-MM-DD date");
  if (!valuation) errors.push("p_valuation_date requires a valid YYYY-MM-DD date");
  if (runId == null) errors.push("p_refresh_run_id requires a positive integer");
  const asOf = normalizePrmAsOfDate(as_of_date, { fallbackToToday: true });
  const classRaw = isBlankPrmValue(group_evidence_class)
    ? ""
    : String(group_evidence_class).trim().toUpperCase();
  if (
    classRaw &&
    !PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES.includes(classRaw)
  ) {
    errors.push(
      "p_group_evidence_class is not a recognised foundation-review class",
    );
  }
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  const params = {
    p_period_start: period,
    p_valuation_date: valuation,
    p_refresh_run_id: runId,
    p_as_of_date: asOf,
    p_limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  if (classRaw) params.p_group_evidence_class = classRaw;
  const lookback = normalizePrmIntegerId(lookback_months);
  if (lookback != null) params.p_lookback_months = lookback;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  return { ok: true, params, errors: [] };
}

export function formatPrmFoundationGroupEvidenceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "ALL_PRODUCTS_SUFFICIENT") {
    return "All Products have sufficient historical evidence";
  }
  if (upper === "MIXED_WITH_SUFFICIENT") {
    return "Mixed evidence; some Products are sufficient";
  }
  if (upper === "LIMITED_ONLY") {
    return "Limited historical evidence only";
  }
  if (upper === "LIMITED_AND_NONE") {
    return "Limited evidence plus Products with no eligible history";
  }
  if (upper === "NO_EVIDENCE_ALL") {
    return "No eligible historical evidence";
  }
  return upper || "—";
}

export function formatPrmFoundationProductEvidenceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "HISTORICAL_EVIDENCE_SUFFICIENT") return "Sufficient";
  if (upper === "HISTORICAL_EVIDENCE_LIMITED") return "Limited";
  if (upper === "NO_ELIGIBLE_HISTORICAL_EVIDENCE") {
    return "No eligible historical evidence";
  }
  return upper || "—";
}

export function formatPrmFoundationFamilyStepEvidenceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "FAMILY_CORE_STEP") return "Core";
  if (upper === "FAMILY_COMMON_STEP") return "Common";
  if (upper === "FAMILY_OCCASIONAL_STEP") return "Occasional";
  if (upper === "FAMILY_EXCEPTION_STEP") return "Exception";
  return upper || "—";
}

export function formatPrmFoundationReviewGuidanceNote(groupEvidenceClass) {
  const upper = normalizePrmCode(groupEvidenceClass).toUpperCase();
  if (
    upper === "ALL_PRODUCTS_SUFFICIENT" ||
    upper === "MIXED_WITH_SUFFICIENT"
  ) {
    return "Foundation evidence available for governed design review.";
  }
  if (upper === "LIMITED_ONLY" || upper === "LIMITED_AND_NONE") {
    return "Historical evidence is incomplete and requires operator/domain review before Route Family design.";
  }
  if (upper === "NO_EVIDENCE_ALL") {
    return "Historical process evidence unavailable — governed manual foundation design required.";
  }
  return "Foundation evidence is review-only.";
}

export function normalizePrmFoundationReviewProduct(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name ?? null,
    evidence_class: normalizePrmCode(r.evidence_class).toUpperCase() || null,
    eligible_batches: Number(r.eligible_batches) || 0,
    candidate_status: r.candidate_status ?? null,
  };
}

export function normalizePrmFoundationReviewFamilyStep(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    activity_kind_id: normalizePrmIntegerId(r.activity_kind_id),
    activity_kind_name: r.activity_kind_name ?? null,
    activity_short_code: r.activity_short_code ?? null,
    family_evidence_class:
      normalizePrmCode(r.family_evidence_class).toUpperCase() || null,
    products_supporting_step: Number(r.products_supporting_step) || 0,
    products_with_any_evidence: Number(r.products_with_any_evidence) || 0,
    product_support_ratio:
      r.product_support_ratio == null || r.product_support_ratio === ""
        ? null
        : Number(r.product_support_ratio),
    average_product_batch_coverage:
      r.average_product_batch_coverage == null ||
      r.average_product_batch_coverage === ""
        ? null
        : Number(r.average_product_batch_coverage),
    modal_area_id: normalizePrmIntegerId(r.modal_area_id ?? r.area_id),
    modal_plant_id: normalizePrmIntegerId(r.modal_plant_id ?? r.plant_id),
    modal_section_id: normalizePrmIntegerId(r.modal_section_id),
    modal_subsection_id: normalizePrmIntegerId(r.modal_subsection_id),
  };
}

export function normalizePrmFoundationReviewGroup(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    category_id: normalizePrmIntegerId(r.category_id),
    category_name: r.category_name ?? null,
    sub_category_id: normalizePrmIntegerId(r.sub_category_id),
    subcategory_name: r.subcategory_name ?? null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name ?? null,
    product_count: Number(r.product_count) || 0,
    sufficient_products: Number(r.sufficient_products) || 0,
    limited_products: Number(r.limited_products) || 0,
    no_evidence_products: Number(r.no_evidence_products) || 0,
    total_eligible_batches: Number(r.total_eligible_batches) || 0,
    avg_eligible_batches:
      r.avg_eligible_batches == null || r.avg_eligible_batches === ""
        ? null
        : Number(r.avg_eligible_batches),
    max_eligible_batches: Number(r.max_eligible_batches) || 0,
    group_evidence_class:
      normalizePrmCode(r.group_evidence_class).toUpperCase() || null,
    products: coercePrmList(r.products).map(normalizePrmFoundationReviewProduct),
    family_steps: coercePrmList(r.family_steps).map(
      normalizePrmFoundationReviewFamilyStep,
    ),
    foundation_summary: r.foundation_summary ?? null,
    historical_policy: r.historical_policy ?? r.policy ?? null,
    approvable: false,
    approval_note:
      r.approval_note ||
      "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.",
  };
}

export function normalizePrmFoundationReviewPayload(raw) {
  const payload = normalizePrmRpcPayload(raw) || raw || {};
  const classSummary = coercePrmList(payload.class_summary).map((item) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      group_evidence_class:
        normalizePrmCode(row.group_evidence_class).toUpperCase() || null,
      group_count: Number(row.group_count) || 0,
      product_count: Number(row.product_count) || 0,
    };
  });
  return {
    period_start: payload.period_start ?? null,
    valuation_date: payload.valuation_date ?? null,
    refresh_run_id: normalizePrmIntegerId(payload.refresh_run_id),
    as_of_date: payload.as_of_date ?? null,
    lookback_months: normalizePrmIntegerId(payload.lookback_months),
    policy: payload.policy ?? null,
    target_product_count: Number(payload.target_product_count) || 0,
    target_product_group_count: Number(payload.target_product_group_count) || 0,
    filtered_group_count: Number(payload.filtered_group_count) || 0,
    limit: Number(payload.limit) || 25,
    offset: Number(payload.offset) || 0,
    class_summary: classSummary,
    groups: coercePrmList(payload.groups).map(normalizePrmFoundationReviewGroup),
    approvable: false,
    approval_note:
      payload.approval_note ||
      "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.",
  };
}

export function getPrmFoundationReviewClassSummaryMap(classSummary = []) {
  const list = Array.isArray(classSummary) ? classSummary : [];
  const out = {};
  for (const code of PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES) {
    const match = list.find(
      (item) =>
        normalizePrmCode(item?.group_evidence_class).toUpperCase() === code,
    );
    out[code] = {
      group_count: Number(match?.group_count) || 0,
      product_count: Number(match?.product_count) || 0,
    };
  }
  return out;
}

export function formatPrmFoundationSupportRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n <= 1) return Math.round(n * 1000) / 10 + "%";
  return String(n);
}

export function formatPrmFoundationIdLabel(kind, id) {
  const normalized = normalizePrmIntegerId(id);
  if (normalized == null) return "—";
  return String(kind) + " " + String(normalized);
}
`;

writeFileSync(path, keep.replace(/\s+$/, "\n") + append, "utf8");
console.log("patched", path);
