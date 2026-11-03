// Display-only costing labels. Call only at a rendering boundary; raw server
// values remain authoritative for state, filters, sorting, exports and payloads.

export const COSTING_STATUS_DISPLAY_LABELS = Object.freeze({
  READY: "Ready",
  REVIEW_REQUIRED: "Review required",
  REVIEW: "Review",
  BLOCKER: "Blocker",
  BLOCKED: "Blocked",
  PENDING: "Pending",
  QUEUED: "Queued",
  RUNNING: "Running",
  IN_PROGRESS: "In progress",
  SUCCESS: "Succeeded",
  COMPLETED: "Completed",
  PARTIAL_SUCCESS: "Partly succeeded",
  FAILED: "Failed",
  ERROR: "Error",
  FAIL: "Fail",
  SKIPPED: "Skipped",
  PASS: "Passed",
  WARN: "Warn",
  WARNING: "Warning",
  UNKNOWN: "Unknown",
  RESOLVED: "Resolved",
  NOT_APPLICABLE: "Not applicable",
  OPERATIONAL: "Operational",
  ALL_EXISTING: "All existing",
});

export const COSTING_ISSUE_DISPLAY_LABELS = Object.freeze({
  MISSING_RM_BOM: "Missing RM BOM",
  EMPTY_RM_BOM: "Empty RM BOM",
  RM_FOUNDATION_PRESENT: "RM foundation present",
  MISSING_PM_REQUIREMENT: "Missing PM requirement",
  PM_FOUNDATION_PRESENT: "PM foundation present",
  NOT_EVALUATED_NO_SKU: "Not evaluated (no SKU)",
  MISSING_RM_AND_PM_FOUNDATION: "Missing RM and PM foundation",
  FOUNDATION_PRESENT: "Foundation present",
  STALE_RM_PURCHASE_RATE: "Stale RM purchase rate",
  STALE_PM_PURCHASE_RATE: "Stale PM purchase rate",
  STALE_PURCHASE_RATE: "Stale purchase rate",
  PM_STOCK_VALUATION_FALLBACK: "PM stock valuation fallback",
  STOCK_VALUATION_FALLBACK: "Stock valuation fallback",
  MISSING_MATERIAL_RATE: "Missing material rate",
  MANUAL_RATE_USED: "Manual rate used",
});

// U11: sentence-case labels for the server first_control_status codes the review
// worklist groups by (flag COSTING_UX_CONSISTENCY_V1 only). Codes stay raw
// everywhere else; unknown codes return "" so callers keep their own fallback.
export const COSTING_CONTROL_STATUS_DISPLAY_LABELS = Object.freeze({
  MATERIAL_COST_BLOCKED: "Material cost blocked",
  MATERIAL_REVIEW_REQUIRED: "Material review required",
  PRIME_COST_REVIEW_REQUIRED: "Prime cost review required",
  PRICING_BRIDGE_REVIEW_REQUIRED: "Pricing bridge review required",
});

export function costingControlStatusDisplayLabel(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(COSTING_CONTROL_STATUS_DISPLAY_LABELS, code)
    ? COSTING_CONTROL_STATUS_DISPLAY_LABELS[code]
    : "";
}

export function costingStatusDisplayLabel(value) {
  const raw = String(value ?? "");
  const code = raw.trim().toUpperCase();
  return COSTING_STATUS_DISPLAY_LABELS[code] || raw;
}

export function costingIssueDisplayLabel(value) {
  const raw = String(value ?? "");
  const code = raw.trim().toUpperCase();
  return COSTING_ISSUE_DISPLAY_LABELS[code] || COSTING_STATUS_DISPLAY_LABELS[code] || raw;
}

export function costingRunBadgeDisplayLabel(value) {
  const raw = String(value ?? "");
  const match = /^DRAFT run (\d+) - not approved$/.exec(raw);
  return match ? `Draft run ${match[1]} — not approved` : raw;
}
