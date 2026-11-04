// WP05 / CDE-1a: historical package tests pin costing-suite-shell.js to older base text so flag-OFF code stays provably
// untouched. CDE-1a adds flag-gated (COSTING_REVIEW_WORKLIST_V1) code to that file:
//   1. one import line,
//   2. a block of two functions + one `let` placed directly before renderReviewWorklistPanel,
//   3. one call inside the SKU Control drawer branch of setDrawerTab,
//   4. two optional-chained session resets (openDetails start, closeDetails).
// This helper removes exactly that text and nothing else. It is deliberately strict so it cannot over-strip:
//   - single-line items are removed only when the exact line occurs exactly once (duplicate or missing => left in place);
//   - the block is removed only when its text matches the pinned SHA-256 (any extra or altered code inside the block,
//     or a missing/duplicated anchor, leaves it in place) - changing the block therefore requires updating this pin.
// Anything left in place makes the historical comparison fail, which is the intent. Called first by stripN1Shell.
import { createHash } from "node:crypto";

const IMPORT = 'import { createDraftRunEvidenceLoader, mountDraftRunEvidenceSection } from "./costing-draft-run-evidence.js";\n';
const CALL = "      mountDraftRunEvidenceInDrawer();\n";
const RESET_OPEN = "  DRAFT_RUN_EVIDENCE_LOADER?.reset(); // CDE-1a: a newly opened drawer is a new evidence session\n";
const RESET_CLOSE = "  DRAFT_RUN_EVIDENCE_LOADER?.reset(); // CDE-1a: closing the drawer ends the evidence session\n";
const BLOCK_START = "/**\n * CDE-1a (flag COSTING_REVIEW_WORKLIST_V1 only): context for the draft-run component evidence section";
const BLOCK_END = "function renderReviewWorklistPanel() {";
export const CDE1A_SHELL_BLOCK_SHA256 = "b4bc4c1e639f8df76a96c04566d64e468c11443ada4e604d97e9c0ffe46f7043";

export function stripCde1aShell(src) {
  let t = src.replace(/\r\n/g, "\n");
  const count = (needle) => t.split(needle).length - 1;
  const once = (from) => {
    if (count(from) !== 1) return;
    t = t.replace(from, "");
  };
  once(IMPORT);
  once(CALL);
  once(RESET_OPEN);
  once(RESET_CLOSE);
  if (count(BLOCK_START) === 1 && count(BLOCK_END) === 1) {
    const a = t.indexOf(BLOCK_START);
    const b = t.indexOf(BLOCK_END);
    if (b > a && createHash("sha256").update(t.slice(a, b)).digest("hex") === CDE1A_SHELL_BLOCK_SHA256) {
      t = t.slice(0, a) + t.slice(b);
    }
  }
  return t;
}
