// #273 static contract for the PREPARED (unapplied) scoped-RPC SQL. No DB. Complements run.sh (real PostgreSQL).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rd = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const prep = rd("docs/master-data-costing/prepared/PREPARED_20261111_csr_scoped_comparison_rpc.sql");
const rb = rd("docs/master-data-costing/prepared/PREPARED_20261111_csr_scoped_comparison_rpc_rollback.sql");
const design = rd("docs/master-data-costing/evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql");
const FN = "rpc_get_cost_sheet_sku_monthly_comparison_scoped";
const fnOf = (s) => s.slice(s.search(/^CREATE (OR REPLACE )?FUNCTION/m), s.indexOf("$csr$;\n", s.indexOf("AS $csr$")) + 7);

// body byte-identical to the reviewed design except the two declared edits
const expected = fnOf(design)
  .replace("CREATE OR REPLACE FUNCTION", "CREATE FUNCTION")
  .replace("SET search_path = pg_catalog, public, costing, pg_temp", "SET search_path = pg_catalog, pg_temp");
assert.equal(fnOf(prep), expected, "function text == design text modulo CREATE and search_path");

// not a migration: nothing under supabase/migrations references it, so no tooling can apply it by merge
for (const f of readdirSync(join(root, "supabase/migrations"))) assert.ok(!rd(`supabase/migrations/${f}`).includes(FN), `${f} must not contain the RPC`);

// guards and posture
for (const [re, why] of [
  [/63adf7946b8d7f99a01a05e5e54d00be/, "hash guard"],
  [/p\.proname = 'rpc_get_cost_sheet_sku_monthly_comparison_scoped'/, "any-overload guard"],
  [/REVOKE ALL ON FUNCTION [^;]+ FROM PUBLIC;/, "revoke PUBLIC"],
  [/REVOKE ALL ON FUNCTION [^;]+ FROM anon;/, "revoke anon"],
  [/GRANT EXECUTE ON FUNCTION [^;]+ TO authenticated;/, "grant authenticated only"],
  [/post: anon can execute/, "post-condition anon"],
  [/post: owner must be postgres/, "post-condition owner"],
  [/require_permission\('module:costing-control-center', false\)/, "view-only module gate"],
  [/^BEGIN;[\s\S]*\nCOMMIT;\s*$/m, "single transaction"],
]) assert.match(prep, re, why);
const code = prep.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
assert.doesNotMatch(code, /CREATE OR REPLACE/, "no silent overwrite");
assert.doesNotMatch(code, /GRANT[^;]*\bTO\b[^;]*\b(anon|PUBLIC|service_role)\b/i, "no grant to anon/PUBLIC/service_role");
assert.doesNotMatch(code, /(?<!SET LOCAL )\bstatement_timeout\b/i, "statement_timeout untouched");
assert.doesNotMatch(code, /\b(ALTER|DROP|CREATE (OR REPLACE )?(VIEW|TABLE|INDEX|POLICY|MATERIALIZED)|INSERT INTO|UPDATE costing|DELETE FROM|TRUNCATE|ANALYZE)\b/i, "no view/table/index/policy/data/stat change");
// rollback drops exactly one function
assert.equal((rb.match(/\bDROP\b/g) || []).length, 1);
assert.match(rb, new RegExp(`DROP FUNCTION public\\.${FN}\\(date,integer\\);`));
console.log("PASS: prepared scoped-RPC SQL static contract");
