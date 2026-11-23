#!/usr/bin/env node
// Static contract for the additive JIT MRP route migration (issue #502). No database, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { REVIEWED_SERVER_MIGRATIONS } from "./lib/pec-protected-path-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = "supabase/migrations/20261122163830_pec_jit_mrp_route_plan_and_generator.sql";
const sql = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const noComments = sql.replace(/--.*$/gm, "");

test("migration is additive: only the two new functions are created, no existing S4/legacy function is replaced", () => {
  const created = [...noComments.matchAll(/CREATE OR REPLACE FUNCTION\s+public\.(\w+)/gi)].map((m) => m[1]).sort();
  assert.deepEqual(created, ["proc_pec_jit_generate_pr", "proc_pec_jit_mrp_plan"]);
  assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE\s+FROM)\b/i.test(noComments), "no destructive or altering DDL/DML at migration level");
  assert.ok(!/proc_pec_s4_(new_pr_plan|generate_pr|reconcile_draft)|create_pr_from_mrp_plan\s*\(|proc_pr_rebuild/i.test(noComments.replace(/create_pr_from_mrp_plan_pec_internal/g, "")),
    "hybrid/legacy functions are referenced neither redefined nor called");
});

test("both functions are SECURITY DEFINER with pinned search_path and the right permission level", () => {
  const plan = noComments.slice(noComments.indexOf("proc_pec_jit_mrp_plan("), noComments.indexOf("proc_pec_jit_generate_pr("));
  const gen = noComments.slice(noComments.indexOf("CREATE OR REPLACE FUNCTION public.proc_pec_jit_generate_pr"));
  for (const body of [plan, gen]) assert.match(body, /SECURITY DEFINER SET search_path=public/);
  assert.match(plan, /require_permission\('module:procurement-execution-console',false\)/);
  assert.match(gen, /require_permission\('module:procurement-execution-console',true\)/);
  assert.match(gen, /p_confirm IS DISTINCT FROM true/);
  assert.match(gen, /JIT generator only accepts the RM \(JIT Only\) scope/);
});

test("ACL: PUBLIC and anon revoked, authenticated granted, nothing broader", () => {
  for (const sig of ["proc_pec_jit_mrp_plan\\(date,date,boolean\\)", "proc_pec_jit_generate_pr\\(text,date,date,date,jsonb,text,boolean,boolean\\)"]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${sig} FROM PUBLIC,anon;`));
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${sig} TO authenticated;`));
  }
  assert.ok(!/GRANT[^;]*\sTO\s[^;]*\b(anon|PUBLIC)\b/.test(noComments.replace(/REVOKE[^;]*;/gi, "")));
});

test("route semantics are server-owned: RM only, jit_procured only, MRP-led, no consumption-only candidates", () => {
  assert.match(sql, /si\.rm_procurement_mode='jit_procured'/);
  assert.match(sql, /p\.material_class_id=1/);
  assert.ok(!/consumption_only AS/i.test(noComments), "no consumption-only candidate CTE");
  assert.ok(!/STOCK_MAPPING_REVIEW|STALE_STOCK_REVIEW|NEGATIVE_STOCK_REVIEW/.test(noComments), "stock-mapping gates are not applied to the JIT route");
  for (const gate of ["UOM_REVIEW", "MOQ_POLICY_REVIEW", "MRP_HORIZON_REVIEW", "MRP_QUANTITY_REVIEW"]) assert.ok(noComments.includes(gate), gate);
  assert.match(sql, /'mode','jit_mrp'/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('PEC_S4_HORIZON'\)/);
});

test("migration is pinned in the protected-path guard to exact path, branch and LF SHA-256", () => {
  const pin = REVIEWED_SERVER_MIGRATIONS[file];
  assert.ok(pin, "pin exists");
  assert.equal(pin.sha256, createHash("sha256").update(sql).digest("hex"));
  assert.deepEqual([...pin.heads], ["feat/pec-jit-route-server-20261122"]);
});

test("original JIT migration precedes its registered forward-only timeout correction", () => {
  const names = fs.readdirSync(path.join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  const hotfix = "20261122174517_pec_jit_plan_indent_balance_once_timeout_fix.sql";
  assert.ok(names.indexOf(path.basename(file)) >= 0, "original registered JIT migration exists");
  assert.ok(names.indexOf(hotfix) > names.indexOf(path.basename(file)), "timeout fix follows original JIT migration");
  // Later migrations (for example S5) may follow; no other JIT-named migration may come after the correction.
  assert.ok(!names.slice(names.indexOf(hotfix) + 1).some((n) => /jit/i.test(n)), "no JIT migration follows the registered correction");
});
