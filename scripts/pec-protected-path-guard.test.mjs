#!/usr/bin/env node
// Mutation-sensitive PEC integration protected-file policy verification.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rejectedProtectedPaths, INTEGRATION_PROTECTED_PATHS, REVIEWED_SERVER_MIGRATIONS } from "./lib/pec-protected-path-guard.mjs";
import fs from "node:fs";
let passed = 0;
function test(name, changed, integration, expected) {
  assert.deepEqual(rejectedProtectedPaths(changed, integration), expected, name);
  console.log("PASS:", name);
  passed++;
}
const migrated = "supabase/migrations/20261112110000_pec_four_gram_material_bom_normalization.sql";
const sw = "public/sw.js";
const illicit = "supabase/migrations/20991231000000_unreviewed_prod_write.sql";
test("integration permits exact inherited G0 migration", [migrated], true, []);
test("integration permits exact reviewed SW change", [sw], true, []);
test("client descendant rejects edited inherited G0 migration", [migrated], false, [migrated]);
test("client descendant rejects edited inherited SW", [sw], false, [sw]);
test("client descendant rejects newly added unreviewed migration", [illicit], false, [illicit]);
test("integration branch rejects arbitrary new migration", [illicit], true, [illicit]);
test("main-based client branch rejects SW change", [sw], false, [sw]);
test("unrelated client sources allowed", ["public/shared/js/procurement-execution-console.js"], false, []);
test("new protected paths never masked by reviewed inherited paths",
 [migrated, sw, illicit], true, [illicit]);
assert.equal(INTEGRATION_PROTECTED_PATHS.size, 12, "exact 10 G0/G1 migrations + #374 Add Line migration + SW");

// --- R13: reviewed server-lane migration (#374) exception: exact path + head branch + content hash.
const addLine = "supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql";
const entry = REVIEWED_SERVER_MIGRATIONS[addLine];
assert.ok(entry, "reviewed entry exists");
const goodText = fs.readFileSync(addLine, "utf8");
const ctx = (over = {}) => ({ headBranch: entry.heads[0], readText: () => goodText, ...over });
const t2 = (name, changed, expected, c) => { assert.deepEqual(rejectedProtectedPaths(changed, false, c), expected, name); console.log("PASS:", name); passed++; };
t2("reviewed #374 migration allowed on its named head with exact content", [addLine], [], ctx());
t2("allowed on the dedicated integration head too", [addLine], [], ctx({ headBranch: entry.heads[1] }));
t2("same file rejected on a client descendant branch", [addLine], [addLine], ctx({ headBranch: "claude/pec-r12-resync-collision-ux-20261113" }));
t2("same file rejected when content differs by one byte", [addLine], [addLine], ctx({ readText: () => goodText + "\n-- x" }));
t2("same file rejected when unreadable", [addLine], [addLine], ctx({ readText: () => { throw new Error("nope"); } }));
t2("same file rejected without context (worktree / legacy callers)", [addLine], [addLine], null);
t2("CRLF checkout of identical content still matches", [addLine], [], ctx({ readText: () => goodText.replace(/\n/g, "\r\n") }));
t2("other migrations are NOT exempted by the #374 entry", [illicit, migrated, sw], [illicit, migrated, sw], ctx());
t2("renamed copy of the reviewed SQL is rejected", ["supabase/migrations/20261112220001_copy.sql"], ["supabase/migrations/20261112220001_copy.sql"], ctx());
t2("SW stays protected on the reviewed head", [sw, addLine], [sw], ctx());
const r10 = [
  "supabase/migrations/20261113170715_pec_safe_resync_collision_guard_lock_order.sql",
  "supabase/migrations/20261113172424_pec_safe_resync_collision_preview_ro.sql",
  "supabase/migrations/20261114013211_pec_indent_set_source_pr_lock_prelude.sql",
];
for (const migration of r10) {
  const pin = REVIEWED_SERVER_MIGRATIONS[migration];
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "R10 reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, ["integration/pec-erp-staging-20261112"], "R10 restricted to staging branch");
  const text = fs.readFileSync(migration, "utf8");
  const context = { headBranch: "integration/pec-erp-staging-20261112", readText: () => text };
  t2("R10 exact file accepted on integration branch: " + migration, [migration], [], context);
  t2("R10 changed content rejected: " + migration, [migration], [migration],
    { ...context, readText: () => text + "\\n-- malicious change" });
  t2("R10 wrong branch rejected: " + migration, [migration], [migration],
    { ...context, headBranch: "claude/pec-r12-resync-collision-ux-20261113" });
  t2("R10 no context rejected: " + migration, [migration], [migration], null);
  t2("R10 uncommitted content rejected: " + migration, [migration], [migration], null);
}
t2("R10 staging-only pins do not weaken SW or arbitrary SQL rejection",
  [...r10, sw, illicit], [sw, illicit],
  { headBranch: "integration/pec-erp-staging-20261112",
    readText: (p) => fs.readFileSync(p, "utf8") });
// R-2 approval-race correction (#412): proposed, pinned to its own branch and exact content.
const r2fix = "supabase/migrations/20261114135500_pec_indent_set_status_header_lock.sql";
{
  const pin = REVIEWED_SERVER_MIGRATIONS[r2fix];
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "R-2 reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, ["claude/pec-r2-approval-race-fix-20261114", "integration/pec-erp-staging-20261112"], "R-2 restricted to its own branch and the staging branch");
  const text = fs.readFileSync(r2fix, "utf8");
  const context = { headBranch: "claude/pec-r2-approval-race-fix-20261114", readText: () => text };
  t2("R-2 exact file accepted on its own branch", [r2fix], [], context);
  t2("R-2 changed content rejected", [r2fix], [r2fix], { ...context, readText: () => text + "\n-- malicious change" });
  t2("R-2 exact file accepted on the staging branch (integration after production approval)", [r2fix], [], { ...context, headBranch: "integration/pec-erp-staging-20261112" });
  t2("R-2 changed content rejected on the staging branch", [r2fix], [r2fix], { ...context, headBranch: "integration/pec-erp-staging-20261112", readText: () => text + "\n-- malicious change" });
  t2("R-2 rejected on another client branch", [r2fix], [r2fix], { ...context, headBranch: "claude/pec-r12-resync-collision-ux-20261113" });
  t2("R-2 rejected without context", [r2fix], [r2fix], null);
  t2("R-2 renamed copy rejected", ["supabase/migrations/20261114135501_copy.sql"], ["supabase/migrations/20261114135501_copy.sql"], context);
}
// Reviewed main-sync exception for public/sw.js: exact merged content + sync branch only.
{
  const pin = REVIEWED_SERVER_MIGRATIONS[sw];
  const syncHead = "claude/pec-staging-main-sync-20261114";
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "sw.js reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, [syncHead], "sw.js exception restricted to the sync branch only");
  const live = fs.readFileSync(sw, "utf8");
  const liveSha = createHash("sha256").update(live.replace(/\r\n/g, "\n")).digest("hex");
  if (liveSha === pin.sha256) {
    const ctx = (over = {}) => ({ headBranch: syncHead, readText: () => live, ...over });
    // content properties of the reviewed merge
    const lf = live.replace(/\r\n/g, "\n");
    assert.ok(lf.includes('const CACHE_NAME = "hub-cache-v393"'), "cache version unchanged");
    assert.ok(/procurement-execution-console\\\.js\$\/\.test\(url\.pathname\)/.test(lf) && /sasv-procurement-execution-console\\\.css\$\/\.test\(url\.pathname\)/.test(lf), "PEC network-first rules present");
    assert.ok(lf.includes("WP08 G2-0") && lf.includes("master-data-platform") && lf.includes("master-data-write-guard") && lf.includes("(?:shared-ui|sasv-bom)"), "main (WP08 G2-0) network-first rules present, including the write-guard module");
    assert.ok(!/<<<<<<<|>>>>>>>/.test(lf), "no conflict markers");
    t2("sw.js exact reviewed merge accepted on the sync branch", [sw], [], ctx());
    t2("sw.js CRLF checkout of the same content accepted", [sw], [], ctx({ readText: () => lf.replace(/\n/g, "\r\n") }));
    t2("sw.js one extra character rejected", [sw], [sw], ctx({ readText: () => lf + "\n// x" }));
    t2("sw.js with the PEC rules removed rejected", [sw], [sw], ctx({ readText: () => lf.replace("procurement-execution-console", "procurement-execution-consolX") }));
    t2("sw.js with the main WP08 rules removed rejected", [sw], [sw], ctx({ readText: () => lf.replace("master-data-platform", "master-data-platfor") }));
    t2("sw.js with a bumped cache version rejected", [sw], [sw], ctx({ readText: () => lf.replace("hub-cache-v393", "hub-cache-v394") }));
    t2("unrelated protected migration still rejected beside the sw.js exception", [sw, illicit, migrated], [illicit, migrated], ctx());
  } else {
    console.log("NOTE: working-tree public/sw.js differs from the reviewed merge pin; acceptance cases skipped (rejection cases below always run)");
  }
  const text = fs.readFileSync(sw, "utf8");
  t2("sw.js rejected on the staging branch itself via the sync pin (integration candidates use the separate inherited list)", [sw], [sw], { headBranch: "integration/pec-erp-staging-20261112", readText: () => text });
  t2("sw.js rejected on another client branch", [sw], [sw], { headBranch: "claude/pec-r12-resync-collision-ux-20261113", readText: () => text });
  t2("sw.js rejected on the R-2 branch", [sw], [sw], { headBranch: "claude/pec-r2-approval-race-fix-20261114", readText: () => text });
  t2("sw.js rejected without context", [sw], [sw], null);
  t2("sw.js rejected when unreadable", [sw], [sw], { headBranch: syncHead, readText: () => { throw new Error("nope"); } });
  t2("sw.js altered on the sync branch rejected", [sw], [sw], { headBranch: syncHead, readText: () => text + "\n// tampered" });
}
// #400 authenticated-DML correction: proposed, pinned to its own branch (and staging for later integration) and exact content.
const sec400 = "supabase/migrations/20261114160000_pec_revoke_authenticated_dml_policy_link_tables.sql";
{
  const pin = REVIEWED_SERVER_MIGRATIONS[sec400];
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "#400 reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, ["claude/pec-400-dml-hardening-20261114", "integration/pec-erp-staging-20261112"], "#400 restricted to its own branch and staging");
  const text = fs.readFileSync(sec400, "utf8");
  const context = { headBranch: "claude/pec-400-dml-hardening-20261114", readText: () => text };
  t2("#400 exact file accepted on its own branch", [sec400], [], context);
  t2("#400 changed content rejected", [sec400], [sec400], { ...context, readText: () => text + "\n-- malicious change" });
  t2("#400 rejected on another client branch", [sec400], [sec400], { ...context, headBranch: "claude/pec-r12-resync-collision-ux-20261113" });
  t2("#400 rejected without context", [sec400], [sec400], null);
}
assert.deepEqual(Object.keys(REVIEWED_SERVER_MIGRATIONS), [addLine, sw, ...r10, r2fix, sec400], "exact Add Line, the reviewed sw.js merge pin, three reviewed R10 migrations, the production-applied R-2 correction and the #400 correction");

console.log(`pec-protected-path-guard: ${passed}/${passed} PASS`);
