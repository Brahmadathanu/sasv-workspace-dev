// WP05-W506: helper for the frozen-diff regression tests that compare Costing shell/controller sources with historical bases.
// It removes exactly the personnel-confidentiality additions (see personnel-shell-blocks.mjs) so those tests keep proving that
// NOTHING ELSE in those files changed. A missing or duplicated addition throws (the additions must be present exactly once).
import { PERSONNEL_SHELL_BLOCKS, PERSONNEL_COSTBUILD_EDITS } from "./personnel-shell-blocks.mjs";

export function unPersonnel(rel, text) {
  const lf = text.replace(/\r\n/g, "\n");
  if (rel.endsWith("costing-suite-shell.js")) {
    return PERSONNEL_SHELL_BLOCKS.reduce((t, b) => {
      if (t.split(b).length !== 2) throw new Error("personnel shell block not present exactly once");
      return t.replace(b, "");
    }, lf);
  }
  if (rel.endsWith("costing-suite-cost-build.js")) {
    return PERSONNEL_COSTBUILD_EDITS.reduce((t, [h, o]) => {
      if (t.split(h).length !== 2) throw new Error("personnel cost-build edit not present exactly once");
      return t.replace(h, o);
    }, lf);
  }
  return text;
}
