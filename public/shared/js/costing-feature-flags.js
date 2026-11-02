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

// WP05-P02 Production Route corrections (candidate scope controls, governed family-creation handoff,
// product-route picker + supersede replacement selector, fixed-historical-context labels). Default OFF.
export const COSTING_PRM_CORRECTIONS_V1 = "COSTING_PRM_CORRECTIONS_V1";

export function isCostingPrmCorrectionsV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_PRM_CORRECTIONS_V1) === "1";
  } catch {
    return false;
  }
}
