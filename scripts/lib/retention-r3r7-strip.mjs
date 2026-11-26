// Retention R3/R7 (26 Nov 2026): historical package tests pin shared Costing files to older commits. R3 (exact-run guard, approval verify
// action) and R7 (Scheme Comparison lens retirement) edit exactly these files. Same convention as sec-a2-strip / n1-nav-strip: this helper
// reverses precisely those hunks (each must be present exactly once) so the historical comparisons keep proving that NOTHING ELSE changed.
// The hunks are generated against the checkpoint before this work (8d3570d) and verified by scripts/costing-retention/retention-strip.test.mjs.
import fs from "node:fs";
const HUNKS = JSON.parse(fs.readFileSync(new URL("./retention-r3r7-hunks.json", import.meta.url), "utf8"));
const lf = (t) => t.replace(/\r\n/g, "\n");

export function stripRetentionR3R7(rel, text) {
  const key = Object.keys(HUNKS).find((k) => rel.endsWith(k));
  if (!key) return text;
  let t = lf(text);
  for (const [cur, pre] of HUNKS[key]) {
    if (!t.includes(cur)) return text; // already pre-R3/R7 (older base) or foreign text: leave untouched, comparison still decides
    t = t.replace(cur, () => pre);
  }
  return t;
}
// Lines the retention hunks ADD to a file (present in the current side of a hunk, absent from its pre side).
export function retentionAddedLines(rel) {
  const key = Object.keys(HUNKS).find((k) => rel.endsWith(k));
  const out = new Set();
  for (const [cur, pre] of key ? HUNKS[key] : []) {
    const preSet = new Set(pre.split("\n"));
    for (const l of cur.split("\n")) if (!preSet.has(l)) out.add(l);
  }
  return out;
}
export const RETENTION_R3R7_FILES = Object.keys(HUNKS);
