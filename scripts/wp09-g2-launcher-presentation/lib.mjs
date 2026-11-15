// WP09 G2 test helpers. READ-ONLY: loads committed evidence, never touches a network or a writer API.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot } from "../wp09-g1-launcher-audit/lib.mjs";

export { repoRoot };
export const AUTHORITY_HEAD = "7584c0f04cae2b4a713a12fe46b2db1fac580835";
export const snapshot = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json"), "utf8"));
export const optionCoverage = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/master-data-costing/WP09_G1_EVIDENCE/option-coverage.json"), "utf8"));
export const sectionRows = snapshot.sections.filter((s) => s.is_active);
export const registryFor = (client) => snapshot.registry.filter((r) => r.nav_enabled && r.client_key === client);

export function readFile(rel) { return fs.readFileSync(path.join(repoRoot, rel), "utf8"); }
export function baselineFile(rel) {
  // Authority-head copy of a file (the launcher as it was before G2). Needs the object in local history.
  return execFileSync("git", ["show", `${AUTHORITY_HEAD}:${rel}`], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
export async function importSource(src) {
  return import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
}
/** launcher-presentation.js (+ its contract) as one importable module, optionally mutated by a text transform. */
export async function loadPresentation(mutate = (s) => s) {
  const contract = readFile("public/shared/js/launcher-presentation-contract.js");
  const logic = readFile("public/shared/js/launcher-presentation.js").replace(/^import \{ LAUNCHER_PRESENTATION_CONTRACT \} from .*$/m, "");
  const merged = mutate(contract + "\n" + logic);
  return importSource(merged);
}
export function rowsToItems(rows) {
  return rows.map((r) => ({ moduleKey: r.module_key, label: r.label, description: r.description, order: r.sort_order, section: r.section_key }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}
export function bySection(rows) {
  const m = new Map();
  for (const it of rowsToItems(rows)) { if (!m.has(it.section)) m.set(it.section, []); m.get(it.section).push(it); }
  return m;
}
export function makeResults() {
  const results = [];
  const check = (name, ok, detail = "") => { results.push({ name, status: ok ? "PASS" : "FAIL", detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
  const skip = (name, why) => { results.push({ name, status: "BLOCKED", detail: why }); console.log(`BLOCKED  ${name}  — ${why}`); };
  return { results, check, skip, failed: () => results.filter((r) => r.status === "FAIL").length };
}
