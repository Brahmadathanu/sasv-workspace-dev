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
assert.deepEqual(Object.keys(REVIEWED_SERVER_MIGRATIONS), [addLine], "exactly one reviewed server migration");
console.log(`pec-protected-path-guard: ${passed}/${passed} PASS`);
