// Costing Suite integrated-preview preflight. READ ONLY: no network, no Supabase, no flag writes.
// Usage: node scripts/costing-preview/verify-source-and-flags.mjs <40-char-reviewed-SHA>
// Run from a clean, detached checkout at the exact reviewed SHA; never on an operational workspace.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const expected = process.argv[2] ?? "";
assert.match(expected, /^[a-f0-9]{40}$/, "Pass an exact 40-character reviewed source commit");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", timeout: 10000 }).trim();
const head = git("rev-parse", "HEAD");
assert.equal(head, expected, "Checkout is NOT the reviewed commit; refuse attribution");
assert.equal(git("status", "--porcelain"), "", "Checkout contains uncommitted files; refuse attribution");
const read = (p) => readFileSync(resolve(p), "utf8").replace(/\r\n/g, "\n");
const shared = read("public/shared/js/costing-feature-flags.js");
const prm = read("public/shared/js/costing-suite-production-route-corrections.js");
const nav = read("public/shared/js/costing-suite-production-route-nav-context.js");
const flagFiles = [shared, prm, nav];
const required = [
  "COSTING_RECALC_WITH_DATE_V1",
  "COSTING_APPROVAL_SCREEN_V1",
  "COSTING_LOCK_SCREEN_V1",
  "COSTING_RUN_STATUS_V1",
  "COSTING_UX_CONSISTENCY_V1",
  "COSTING_DIALOGS_V1",
  "COSTING_TABLE_TOOLS_V1",
  "COSTING_REVIEW_WORKLIST_V1",
  "COSTING_NAV_GROUPS_V1",
  "COSTING_PRM_CORRECTIONS_V1",
  "COSTING_PRM_NAV_CONTEXT_V1",
];
assert.equal(new Set(required).size, 11, "Expected exactly eleven independent flags");
for (const name of required) {
  const declarations = flagFiles.filter((s) => s.includes('export const ' + name + ' = "' + name + '"'));
  assert.equal(declarations.length, 1, name + " must have one exported declaration");
}
for (const s of flagFiles) {
  const names = [...s.matchAll(/export const (COSTING_[A-Z0-9_]+_V1) = "([^"]+)";/g)];
  for (const [, key, value] of names) {
    if (!required.includes(key)) continue;
    assert.equal(key, value, "Flag name/value must coincide");
    assert.match(s, new RegExp('getItem\\?\\.\\(' + key + '\\) === "1"'), key + " must be exact-value enabled");
  }
}
const sweep = read("scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs");
const allowlist = read("scripts/costing-wp12-flag-sweep/console-rpc-allowlist.test.mjs");
assert.match(sweep, /const STATES = \[/, "WP12 mock sweep must exist");
assert.match(sweep, /const MODULES = Object\.keys\(COSTING_ROUTE_CONFIG\)/, "Six module route inventory must be sourced");
assert.match(allowlist, /const DOCUMENTED_CONSOLE_EXCEPTIONS = \[\]/, "No undocumented console exceptions");
const cache = read("public/sw.js").match(/const CACHE_NAME = "([^"]+)"/)?.[1];
assert.ok(cache, "Must be able to identify PWA cache generation");
const pkg = JSON.parse(read("package.json"));
const result = {
  status: "SOURCE_AND_TEST_CONTRACT_VERIFIED_ONLY",
  sourceCommit: head,
  electronVersion: pkg.version,
  repositoryPwaCache: cache,
  flagsCount: required.length,
  flags: required,
  wp12MockSweepPresent: true,
  authenticatedOnOffAcceptance: "NOT_TESTED",
  deployedPreviewUrl: null,
  servedAssetDigest: null,
  productionFlagsChanged: false,
  note: "This reads checked-out source only. A successful result is NOT a build or an authenticated test."
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
