// SEC-A2 (4 Nov 2026): historical package tests pin costing-suite-shell.js and costing-approval-screen.js to older base text
// so flag-OFF code stays provably untouched. SEC-A2 aligns the approval screen with CCC-edit permission (live server
// migration 20261104160256 makes rpc_costing_preview_approval_impact edit-only). It changes exactly:
//   shell:     one injected line  `canEdit: () => PERM_CONTROL_CENTER_EDIT === true,`  in the approval controller wiring;
//   approval:  seven guarded hunks in costing-approval-screen.js (listed below).
// These helpers reverse exactly that text and nothing else. Deliberately strict, like cde1a-shell-strip.mjs: each piece is
// reversed only if its text occurs EXACTLY ONCE; a duplicated, missing, altered or extended piece is left in place, so any
// other change to those files still fails the historical comparison. The behaviour itself is covered by
// scripts/costing-approval/approval-controller.test.mjs, not here.

const norm = (src) => String(src).replace(/\r\n/g, "\n");
const once = (t, from, to) => (t.split(from).length - 1 === 1 ? t.replace(from, () => to) : t);

export const SEC_A2_SHELL_LINE = "      canEdit: () => PERM_CONTROL_CENTER_EDIT === true,\n";

// LOCK-P01 (8 Nov 2026, issue #211): the lock-screen controller gets the SAME CCC edit permission (SEC-A2 parity). Two shell hunks, each reversed
// only when it occurs EXACTLY ONCE, so any other shell change still fails the historical comparison.
export const LOCK_P01_SHELL_HELPER =
  "// LOCK-P01: same Costing Control Center edit permission the approval screen uses (SEC-A2); the lock controller also fails closed without it.\n" +
  "function canEditLockScreen() {\n  return PERM_CONTROL_CENTER_EDIT === true;\n}\n\n";
export const LOCK_P01_SHELL_LINE = "      canEdit: canEditLockScreen,\n";

export function stripSecA2Shell(src) {
  return once(once(once(norm(src), SEC_A2_SHELL_LINE, ""), LOCK_P01_SHELL_HELPER, ""), LOCK_P01_SHELL_LINE, "");
}

// [after SEC-A2, before SEC-A2]
export const SEC_A2_APPROVAL_HUNKS = Object.freeze([
  ["    isControlCenterRoute,\n    canEdit = () => false,\n    formatMoney = formatInr,\n", "    isControlCenterRoute,\n    formatMoney = formatInr,\n"],
  ["  function canSubmitApprove() {\n    if (canEdit() !== true) return false;\n    const preview = state.preview;\n", "  function canSubmitApprove() {\n    const preview = state.preview;\n"],
  [
    "        const reviewBtn = draft && canEdit() === true\n          ? `<button type=\"button\" class=\"cas-action\" data-cas-review=\"${escapeHtml(String(id))}\">Review for approval</button>`\n          : draft\n            ? `<span class=\"cas-muted\">View only — approval requires Costing Control Center edit permission.</span>`\n            : \"\";\n",
    "        const reviewBtn = draft\n          ? `<button type=\"button\" class=\"cas-action\" data-cas-review=\"${escapeHtml(String(id))}\">Review for approval</button>`\n          : \"\";\n",
  ],
  [
    "  async function openPreviewForRun(runId) {\n    // SEC-A2: preview creates a server acknowledgement; never call it for view-only users.\n    if (canEdit() !== true) {\n      showToast?.(\"Approval preview requires Costing Control Center edit permission.\", \"warn\");\n      return;\n    }\n    // Preview is intentionally",
    "  async function openPreviewForRun(runId) {\n    // Preview is intentionally",
  ],
  ["      if (error) throw error;\n      if (canEdit() !== true) {\n        closeModal();\n        return;\n      }\n      const preview = unwrapRpcJson(data);\n", "      if (error) throw error;\n      const preview = unwrapRpcJson(data);\n"],
  [
    "  async function submitDecision(kind) {\n    if (canEdit() !== true) {\n      showToast?.(\"Approval actions require Costing Control Center edit permission.\", \"warn\");\n      return;\n    }\n    if (state.inFlight) return;\n",
    "  async function submitDecision(kind) {\n    if (state.inFlight) return;\n",
  ],
  ["    if (!confirmFn(confirmText)) return;\n    if (canEdit() !== true) return;\n", "    if (!confirmFn(confirmText)) return;\n"],
]);

export function stripSecA2Approval(src) {
  let t = norm(src);
  for (const [after, before] of SEC_A2_APPROVAL_HUNKS) t = once(t, after, before);
  return t;
}

// LOCK-P01 lock-screen controller hunks [after LOCK-P01, before LOCK-P01]; each reversed only when it occurs exactly once (same strictness as above).
const LOCK_P01_NOTE = "    // LOCK-P01 (SEC-A2 parity): fail closed. Without an explicit edit-permission callback the lock UI never mounts or acts.\n";
export const LOCK_P01_CONTROLLER_HUNKS = Object.freeze([
  [`${LOCK_P01_NOTE}    canEdit = () => false,\n`, ""],
  ['  const VIEW_ONLY_TEXT = "Closing periods requires Costing Control Center edit permission.";\n', ""],
  ['  function denyViewOnly() {\n    showToast?.(VIEW_ONLY_TEXT, "warn");\n    return false;\n  }\n\n', ""],
  ["  function openBatch(periodStarts = selectedFromPanel()) {\n    if (canEdit() !== true) return denyViewOnly();\n", "  function openBatch(periodStarts = selectedFromPanel()) {\n"],
  ["  function openSingle(periodStart) {\n    if (canEdit() !== true) return denyViewOnly();\n", "  function openSingle(periodStart) {\n"],
  [
    "    if (state.inFlight || state.succeeded || !state.mode) return;\n    if (canEdit() !== true) {\n      denyViewOnly();\n      return;\n    }\n",
    "    if (state.inFlight || state.succeeded || !state.mode) return;\n",
  ],
  [
    "      onRouteExit();\n      return;\n    }\n    // View-only users get no lock panel, no controls and no period fetch for it (the server still enforces edit permission).\n    if (canEdit() !== true) {\n      onRouteExit();\n      return;\n    }\n",
    "      onRouteExit();\n      return;\n    }\n",
  ],
]);

export function stripLockP01Controller(src) {
  let t = norm(src);
  for (const [after, before] of LOCK_P01_CONTROLLER_HUNKS) t = once(t, after, before);
  return t;
}

/** Route by repo-relative path (suffix match, like stripN1). */
export function stripSecA2(rel, text) {
  if (rel.endsWith("public/shared/js/costing-suite-shell.js")) return stripSecA2Shell(text);
  if (rel.endsWith("public/shared/js/costing-approval-screen.js")) return stripSecA2Approval(text);
  if (rel.endsWith("public/shared/js/costing-lock-screen.js")) return stripLockP01Controller(text);
  return text;
}
