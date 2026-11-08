// Issue #227: static checks only (no DB, no network). The candidate must stay unapplied, additive, and outside supabase/migrations.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = "docs/master-data-costing/scheme-master-perf-candidate-227";
const read = (f) => fs.readFileSync(path.join(root, dir, f), "utf8");
const code = (s) => s.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
test("candidate is a single additive concurrent index, nothing else", () => {
  const c = code(read("candidate_index.UNAPPLIED.sql")).trim();
  assert.match(c, /^create index concurrently if not exists idx_sku_scheme_viability_snapshot_scheme_period\s+on costing\.sku_scheme_viability_snapshot \(scheme_id, period_start\);$/);
  assert.doesNotMatch(c, /\b(grant|revoke|alter|drop|create or replace|set\s+statement_timeout|insert|update|delete)\b/i);
});
test("rollback is a pure index drop", () => {
  assert.match(code(read("candidate_index.ROLLBACK.sql")).trim(), /^drop index concurrently if exists costing\.idx_sku_scheme_viability_snapshot_scheme_period;$/);
});
test("candidate is not placed in supabase/migrations and is marked unapplied", () => {
  assert.ok(!fs.readdirSync(path.join(root, "supabase/migrations")).some((f) => /scheme_period|perf_candidate_227/.test(f)));
  assert.match(read("candidate_index.UNAPPLIED.sql"), /NOT APPLIED/);
});
test("verify script is read-only", () => {
  assert.doesNotMatch(code(read("candidate_index.VERIFY_READONLY.sql")), /\b(create|drop|alter|grant|revoke|insert|update|delete|analyze\s+\w)/i);
  assert.doesNotMatch(code(read("candidate_index.VERIFY_READONLY.sql")), /explain\s*\(\s*analyze/i);
});
