#!/usr/bin/env node
// Mutation-sensitive PEC integration protected-file policy verification.
import assert from "node:assert/strict";
import { rejectedProtectedPaths, INTEGRATION_PROTECTED_PATHS } from "./lib/pec-protected-path-guard.mjs";
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
assert.equal(INTEGRATION_PROTECTED_PATHS.size, 11, "exact 10 G0/G1 migrations + SW");
console.log(`pec-protected-path-guard: ${passed}/${passed} PASS`);
