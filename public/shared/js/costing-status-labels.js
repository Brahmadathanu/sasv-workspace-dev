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
