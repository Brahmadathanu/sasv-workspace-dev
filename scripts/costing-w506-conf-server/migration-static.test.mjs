// WP05-W506-CONF-01 -- static (no database) checks of the personnel view-gate migration, rollback and runner.
// Run: node --test scripts/costing-w506-conf-server/migration-static.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NAME = "20261109130000_wp05_w506_conf_01_personnel_view_gate.sql";
const rd = (p) => readFileSync(join(root, p), "utf8");
const mig = rd(`supabase/migrations/${NAME}`);
const rb = rd("docs/master-data-costing/prepared/WP05_W506_CONF_01_ROLLBACK.sql");
const runner = rd("supabase/tests/w506_conf/run_view_gate_test.sh");
const matrix = rd("supabase/tests/w506_conf/matrix.sql");
const scaffold = rd("supabase/tests/w506_conf/scaffold.sql");
const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const PLACEHOLDERS = ["REGISTER", "REVIEW", "POOL", "GATE_FN"].map((k) => `<<W506_CONF_FP_${k}>>`);

test("migration version is unique and sorts after every other migration", () => {
  const names = readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  assert.equal(names[names.length - 1], NAME);
  assert.equal(names.filter((n) => n.startsWith(NAME.slice(0, 14))).length, 1);
});
test("fail closed: the four owner-readback fingerprints are unfilled placeholders and the DO block aborts on them", () => {
  for (const t of [mig, rb]) {
    for (const p of PLACEHOLDERS) assert.equal(t.split(p).length, 2, `${p} exactly once`);
    assert.ok(t.includes("live fingerprints have not been filled in from the owner readback"));
    assert.ok(t.includes("!~ '^[0-9a-f]{32}$'"));
  }
});
test("runner-compatible framing: no top-level transaction control; exactly one DO statement per file", () => {
  for (const t of [mig, rb]) {
    assert.ok(!/^\s*(begin|commit|rollback|start\s+transaction|savepoint\b[^;]*)\s*;/im.test(code(t)));
    assert.equal((code(t).match(/^do \$(migration|rollback)\$/gm) || []).length, 1);
  }
});
test("helper creation, comment, ACL and view changes share one atomic DO", () => {
  const doStart = mig.indexOf("do $migration$");
  const begin = mig.indexOf("\\nbegin\\n", doStart);
  const placeholderCheck = mig.indexOf("live fingerprints have not been filled in from the owner readback", begin);
  const helper = mig.indexOf("execute $helper_ddl$", begin);
  const comment = mig.indexOf("execute $comment_ddl$", begin);
  const revoke = mig.indexOf("execute 'revoke all on function", begin);
  const grant = mig.indexOf("execute 'grant execute on function", begin);
  const viewLoop = mig.indexOf("for v_i in 1 .. array_length(v_views, 1) loop", begin);
  assert.ok(doStart >= 0 && begin > doStart && placeholderCheck > begin);
  assert.ok(helper > placeholderCheck && comment > helper && revoke > comment && grant > revoke && viewLoop > grant);
  assert.ok(!mig.slice(0, doStart).includes("create or replace function public.fn_costing_personnel_view_allowed"));
  assert.ok(mig.includes("$helper_ddl$;") && mig.includes("$comment_ddl$;"));
});
test("policy: personnel gate = postgres/service_role OR CBM view AND edit; no identity hard-coded; no service-role bypass beyond the existing pattern", () => {
  const f = mig.match(/create or replace function public\.fn_costing_personnel_view_allowed\(\)[\s\S]*?\$f\$;/)[0];
  assert.ok(f.includes("current_user = any (array['postgres','service_role']::name[])"));
  assert.ok(f.includes("app_has_permission('module:cost-build-manager','view')") && f.includes("app_has_permission('module:cost-build-manager','edit')"));
  assert.ok(/view'\)\s+and public\.app_has_permission\('module:cost-build-manager','edit'\)/.test(f), "view AND edit");
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(code(mig)), "no uuid");
  assert.ok(f.includes("security invoker") && f.includes("set search_path = public, pg_temp"));
});
test("no privilege change on the views; only the new helper function is created or granted; broad gate untouched", () => {
  const c = code(mig).toLowerCase();
  assert.deepEqual(c.match(/create\s+(or\s+replace\s+)?function\s+[\w.]+/g), ["create or replace function public.fn_costing_personnel_view_allowed"]);
  const grants = c.match(/\b(grant|revoke)\b[^;]*;/g);
  assert.deepEqual(grants, [
    "revoke all on function public.fn_costing_personnel_view_allowed() from public, anon;",
    "grant execute on function public.fn_costing_personnel_view_allowed() to authenticated, service_role;",
  ]);
  for (const bad of [/\bdrop\b/, /\balter\b/, /\btruncate\b/, /\bdelete\b/, /\binsert\b/, /\bupdate\s+\w+\./, /create\s+or\s+replace\s+function\s+public\.fn_costing_view_allowed/]) assert.ok(!bad.test(c), String(bad));
  assert.ok(!/costing\.rpc_|rpc_set_staff|rpc_close_staff/.test(c), "Save/Close writers untouched");
});
test("exact-definition proofs: full-definition fingerprints for 3 views + gate function; exact-once anchors; reverse-substitution; metadata checks", () => {
  for (const frag of ["md5(pg_get_functiondef('public.fn_costing_view_allowed()'::regprocedure)) <> c_fp_gate_fn", "md5(v_def) <> v_fp", "replace(v_def, v_old_t, '')",
    "is neither the verified original nor the verified patched form", "md5(replace(v_rendered, v_new_t, v_old_t)) <> v_fp", "v_rendered is distinct from v_new",
    "columns/owner/ACL/reloptions of % changed unexpectedly", "c.reloptions::text", "c.relacl::text", "create or replace view public.%I%s as %s"]) assert.ok(mig.includes(frag), frag);
  assert.ok(mig.includes("c_old_gate    constant text := 'fn_costing_view_allowed()'") && mig.includes("c_new_gate    constant text := 'fn_costing_personnel_view_allowed()'"));
  assert.ok(mig.includes("c_pool_old    constant text := E'\\n            p.staff_details,\\n'"));
  assert.ok(mig.includes("ELSE NULL::") && mig.includes("END AS staff_details,"), "pool column keeps name/type via CASE");
});
test("pool-summary keeps the broad aggregate gate (only staff_details is masked); register and review switch to the personnel gate", () => {
  const targets = mig.match(/v_views text\[\] := array\[([^\]]*)\]/)[1];
  for (const v of ["v_costing_staff_classification_register", "v_costing_unclassified_staff_for_costing", "v_costing_staff_cost_pool_summary"]) assert.ok(targets.includes(v));
  assert.equal((targets.match(/'v_/g) || []).length, 3, "exactly the three views");
  assert.ok(mig.includes("if v_name = 'v_costing_staff_cost_pool_summary' then"));
  assert.ok(mig.includes("v_old_t := c_old_gate; v_new_t := c_new_gate;"));
});
test("rollback: security-regression warning, own owner-emergency interlock, drift proof, restores originals, helper kept", () => {
  for (const frag of ["SECURITY REGRESSION", "Containment-first", "w506.personnel_gate_rollback_owner_emergency_approval", "I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL",
    "owner emergency approval interlock not set", "is neither the verified original nor the verified patched form", "restored definition of % does not hash to the verified original", "intentionally left in place"])
    assert.ok(rb.includes(frag), frag);
  assert.ok(!/\bgrant\b|\brevoke\b|\bdrop\b/i.test(code(rb)));
});
test("TB2 migration (source of the repo-recorded definitions) is referenced, not modified", () => {
  assert.ok(runner.includes("20261019134900_tb2_costing_view_permission_gate.sql"));
  assert.ok(readdirSync(join(root, "supabase/migrations")).includes("20261019134900_tb2_costing_view_permission_gate.sql"));
});
test("runner: socket-only host, disposable-cluster marker, superuser, unique scratch DB, mktemp+trap; substitutes only the 4 placeholders in scratch copies", () => {
  const c = runner.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  assert.ok(c.includes('case "${PGHOST:-}" in /*)') && c.includes("w506-disposable-") && c.includes("rolsuper"));
  assert.ok(c.includes("mktemp -d") && c.includes("trap cleanup EXIT") && c.includes("w506_conf_$(date +%s)_$$"));
  assert.ok(!/drop database if exists/i.test(c));
  const subs = c.match(/s\/<<W506_CONF_FP_[A-Z_]+>>\//g) || [];
  assert.equal(subs.length, 4);
  assert.ok(c.includes('"${f%%:*}" > "${f##*:}"'), "scratch copies only; committed files never modified");
});
test("identity matrix covers: no grants, unauthenticated, other-module viewers, CBM view-only, edit-without-view, editor, postgres, service_role, anon, definer writer pattern", () => {
  for (const frag of ["ID-N no grants", "unauthenticated", "CSR view-only", "MCM view-only", "CCC view+edit", "CBM view-only", "CBM edit without view", "CBM view+edit (authorised editor)", "postgres", "service_role", "anon role", "definer-owned function"])
    assert.ok(matrix.includes(frag), frag);
});
test("scaffold is synthetic only", () => {
  assert.ok(scaffold.includes("SYNTHETIC") && scaffold.includes("SYN-001") && !/pg_dump|copy /i.test(scaffold));
});
