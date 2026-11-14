#!/usr/bin/env node
// Mutation-sensitive PEC integration protected-file policy verification.
import assert from "node:assert/strict";
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
assert.deepEqual(Object.keys(REVIEWED_SERVER_MIGRATIONS), [addLine, ...r10], "exact Add Line and three reviewed R10 migrations");

console.log(`pec-protected-path-guard: ${passed}/${passed} PASS`);
