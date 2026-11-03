// WP11 / U11: historical package tests pin costing-status-labels.js to its pre-U11 text so flag-OFF code stays provably
// untouched. U11 adds exactly one block (sentence-case control-status labels for the review worklist, flag
// COSTING_UX_CONSISTENCY_V1). This helper removes exactly that block and nothing else; any other change to the file leaves
// the result different from the base and the historical test still fails.
const U11_BLOCK = /\/\/ U11: sentence-case labels[\s\S]*?\n\}\n\n(?=export function costingStatusDisplayLabel)/;

export function stripU11(rel, text) {
  return rel.endsWith("public/shared/js/costing-status-labels.js") ? text.replace(/\r\n/g, "\n").replace(U11_BLOCK, "") : text;
}
