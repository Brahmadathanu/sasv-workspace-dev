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

export function stripSecA2Shell(src) {
  return once(norm(src), SEC_A2_SHELL_LINE, "");
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

/** Route by repo-relative path (suffix match, like stripN1). */
export function stripSecA2(rel, text) {
  if (rel.endsWith("public/shared/js/costing-suite-shell.js")) return stripSecA2Shell(text);
  if (rel.endsWith("public/shared/js/costing-approval-screen.js")) return stripSecA2Approval(text);
  return text;
}
