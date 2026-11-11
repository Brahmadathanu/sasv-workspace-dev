// Costing client feature flags. Default OFF unless explicitly enabled in this browser.
// Staging / authorized walkthrough only:
//   localStorage.setItem("COSTING_APPROVAL_SCREEN_V1", "1"); location.reload();
// Rollback: localStorage.removeItem("COSTING_APPROVAL_SCREEN_V1"); location.reload();

export const COSTING_RECALC_WITH_DATE_V1 = "COSTING_RECALC_WITH_DATE_V1";

export function isCostingRecalcWithDateV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_RECALC_WITH_DATE_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_APPROVAL_SCREEN_V1 = "COSTING_APPROVAL_SCREEN_V1";

export function isCostingApprovalScreenV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_APPROVAL_SCREEN_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_LOCK_SCREEN_V1 = "COSTING_LOCK_SCREEN_V1";

export function isCostingLockScreenV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_LOCK_SCREEN_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_RUN_STATUS_V1 = "COSTING_RUN_STATUS_V1";

export function isCostingRunStatusV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_RUN_STATUS_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_UX_CONSISTENCY_V1 = "COSTING_UX_CONSISTENCY_V1";

export function isCostingUxConsistencyV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_UX_CONSISTENCY_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_DIALOGS_V1 = "COSTING_DIALOGS_V1";

export function isCostingDialogsV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_DIALOGS_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_TABLE_TOOLS_V1 = "COSTING_TABLE_TOOLS_V1";

export function isCostingTableToolsV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_TABLE_TOOLS_V1) === "1";
  } catch {
    return false;
  }
}

export const COSTING_REVIEW_WORKLIST_V1 = "COSTING_REVIEW_WORKLIST_V1";

export function isCostingReviewWorklistV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_REVIEW_WORKLIST_V1) === "1";
  } catch {
    return false;
  }
}

// MDC-07 / N1: grouped Costing navigation + breadcrumb/context chip. Default OFF; only the exact value "1" enables it.
// Independent of COSTING_PRM_CORRECTIONS_V1 (a separate flag in costing-suite-production-route-corrections.js).
export const COSTING_NAV_GROUPS_V1 = "COSTING_NAV_GROUPS_V1";

export function isCostingNavGroupsV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_NAV_GROUPS_V1) === "1";
  } catch {
    return false;
  }
}

// #273 / WP05: Cost Comparison reads the period-scoped RPC instead of the governed view. Default OFF; only the exact value "1" enables it.
// Server function is PREPARED, NOT APPLIED, and this flag must stay OFF until the owner approves application and enablement.
// Rollback: localStorage.removeItem("COSTING_CSR_SCOPED_COMPARISON_RPC_V1"); location.reload();  (restores the original view read)
export const COSTING_CSR_SCOPED_COMPARISON_RPC_V1 = "COSTING_CSR_SCOPED_COMPARISON_RPC_V1";

export function isCostingCsrScopedComparisonRpcV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_CSR_SCOPED_COMPARISON_RPC_V1) === "1";
  } catch {
    return false;
  }
}
