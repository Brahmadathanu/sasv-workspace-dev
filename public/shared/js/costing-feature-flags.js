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
