// WP05-W506-SEC-FIX-01 -- static (no database) checks of the proposed migration and rollback. Run: node --test scripts/costing-w506-sec-fix-01/migration-static.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIG_NAME = "20261109040000_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql";
const mig = readFileSync(join(root, "supabase/migrations", MIG_NAME), "utf8");
const rb = readFileSync(join(root, "docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql"), "utf8");
const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

test("migration version sorts after every other migration and is unique", () => {
  const names = readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  assert.equal(names[names.length - 1], MIG_NAME);
  assert.equal(names.filter((n) => n.startsWith(MIG_NAME.slice(0, 14))).length, 1);
});
test("single transaction", () => {
  const c = code(mig);
  assert.match(c, /^\s*begin;/m);
  assert.match(c, /^\s*commit;\s*$/m);
});
test("exact guard statement: CBM module, can_edit required, schema-qualified", () => {
  assert.ok(mig.includes("perform public.require_permission(''module:cost-build-manager'', true);"));
  assert.ok(!/require_permission\([^)]*false/i.test(code(mig)));
});
test("fingerprints recorded in the issue are present for internal function and wrapper", () => {
  assert.ok(mig.includes("553d103a5afedda3191c1aa62c33be7c"));
  assert.ok(mig.includes("6ba709477ecc7755fb6005b6e2203a2b"));
  assert.ok(rb.includes("553d103a5afedda3191c1aa62c33be7c"));
});
test("fail-closed assertions present", () => {
  for (const frag of ["fingerprint", "exactly one", "no BEGIN", "write token", "properties", "already guarded"])
    assert.ok(mig.includes(frag), `missing assertion text: ${frag}`);
});
test("no privilege, ownership, schema or wrapper changes, no function body copy", () => {
  const c = code(mig).toLowerCase();
  for (const bad of [/\bgrant\b/, /\brevoke\b/, /\bdrop\b/, /\balter\b/, /create\s+(or\s+replace\s+)?function/, /update\s+costing\./, /insert\s+into\s+costing\./])
    assert.ok(!bad.test(c), `forbidden construct ${bad}`);
  assert.ok(!c.includes("staff_costing_classification set"), "must not embed the writer body");
});
test("public wrapper is only read, never rebuilt", () => {
  const c = code(mig);
  assert.ok(!/execute\s+[^;]*wrapper/i.test(c));
  assert.equal((c.match(/\bexecute v_new_def\b/g) || []).length, 1);
});
test("rollback removes exactly the inserted text and re-checks the fingerprint", () => {
  assert.ok(rb.includes("perform public.require_permission(''module:cost-build-manager'', true);"));
  assert.ok(rb.includes("recorded pre-fix fingerprint"));
  assert.match(code(rb), /^\s*begin;/m);
  assert.match(code(rb), /^\s*commit;\s*$/m);
  assert.ok(!/\bgrant\b|\brevoke\b|\bdrop\b/i.test(code(rb)));
});
