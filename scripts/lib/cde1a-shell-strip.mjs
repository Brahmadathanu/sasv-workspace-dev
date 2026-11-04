// WP05 / CDE-1a: historical package tests pin costing-suite-shell.js to older base text so flag-OFF code stays provably
// untouched. CDE-1a adds flag-gated (COSTING_REVIEW_WORKLIST_V1) code to that file: one import, two functions placed
// directly before renderReviewWorklistPanel, and one call inside the SKU Control drawer branch. This helper removes
// exactly that text and nothing else; any other edit leaves the result different from the base and the historical test
// still fails. Called first by stripN1Shell so every historical comparison keeps working.
const IMPORT = 'import { createDraftRunEvidenceLoader, mountDraftRunEvidenceSection } from "./costing-draft-run-evidence.js";\n';
const CALL = "      mountDraftRunEvidenceInDrawer();\n";
const BLOCK_START = "/**\n * CDE-1a (flag COSTING_REVIEW_WORKLIST_V1 only): context for the draft-run component evidence section";
const BLOCK_END = "function renderReviewWorklistPanel() {";

export function stripCde1aShell(src) {
  let t = src.replace(/\r\n/g, "\n");
  const once = (from, to) => {
    const i = t.indexOf(from);
    if (i === -1 || t.indexOf(from, i + 1) !== -1) return;
    t = t.slice(0, i) + to + t.slice(i + from.length);
  };
  once(IMPORT, "");
  once(CALL, "");
  const a = t.indexOf(BLOCK_START);
  const b = a === -1 ? -1 : t.indexOf(BLOCK_END, a);
  if (a !== -1 && b !== -1) t = t.slice(0, a) + t.slice(b);
  return t;
}
