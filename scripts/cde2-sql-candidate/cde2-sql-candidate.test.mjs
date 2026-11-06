// CDE-2 SQL candidate: static contract checks (always run) + isolated PostgreSQL security/contract tests.
// The PostgreSQL tests are SKIPPED (visibly) when no PostgreSQL 14+ server binaries exist; a skip is NOT evidence. Nothing here touches production or Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPgBin, startCluster } from "./pg-isolated.mjs";
import { createDraftRunEvidenceRpcProvider, findEvidenceContractViolation } from "../../public/shared/js/costing-draft-run-evidence-provider.js";
import * as ev from "../../public/shared/js/costing-draft-run-evidence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "docs/master-data-costing/cde2-sql-candidate");
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SQL = read(path.join(dir, "rpc_get_costing_draft_component_evidence_v1.candidate.sql"));
const GATE = "v_d3_decided boolean := false;";
const FN = "public.rpc_get_costing_draft_component_evidence_v1";
const DENY = '{"status": "empty"}';
const U = { view: "00000000-0000-4000-8000-000000000001", edit: "00000000-0000-4000-8000-000000000002", none: "00000000-0000-4000-8000-000000000003", noview: "00000000-0000-4000-8000-000000000004", other: "00000000-0000-4000-8000-000000000005" };
const code = (s) => s.split("\n").filter((l) => !/^\s*--/.test(l)).map((l) => l.replace(/\s--.*$/, "")).join("\n"); // executable text only

// ------------------------------------------------------------------ static (no database)
test("static: corrected live contract, whitelist projection, owner gate fail-closed, not a migration", () => {
  const c = code(SQL);
  assert.equal(SQL.split(GATE).length, 2, "exactly one D3 owner gate line, shipped false");
  assert.match(c, /public\.require_permission\('module:costing-control-center', false\)/, "live signature (text, boolean): false = view");
  assert.doesNotMatch(c, /require_permission\([^)]*'view'/);
  assert.match(c, /r\.id = p_refresh_run_id/, "run table key is id");
  assert.doesNotMatch(c, /costing_refresh_run[^;]*refresh_run_id\s*=/, "no refresh_run_id lookup on the run table");
  assert.doesNotMatch(c, /select\s+\*|row_to_json|to_jsonb\s*\(|jsonb_agg|%rowtype/i, "no whole-row projection");
  assert.match(c, /security definer/i); assert.match(c, /set search_path = pg_catalog, pg_temp/); assert.match(c, /\bstable\b/i);
  assert.match(c, /revoke all on function [^;]+ from public;/); assert.match(c, /revoke all on function [^;]+ from anon;/); assert.match(c, /grant execute on function [^;]+ to authenticated;/);
  assert.doesNotMatch(c, /\b(insert|update|delete|truncate|create table|alter table|create policy|create trigger|grant (select|insert|update|delete))\b/i, "no write, DDL or table grant");
  assert.equal([...c.matchAll(/v_deny/g)].length > 15, true);
  assert.doesNotMatch(c, /sqlerrm|raise exception|raise notice/i, "no error text can leak");
  assert.match(c, /'allocation_resolution_note',\s*null/); assert.match(c, /'blocker_note',\s*null/); assert.equal([...c.matchAll(/'note',\s*null/g)].length, 2);
  assert.ok(!fs.existsSync(path.join(root, "supabase/migrations/rpc_get_costing_draft_component_evidence_v1.sql")));
  assert.ok(!fs.readdirSync(path.join(root, "supabase/migrations")).some((f) => /cde2|draft_component_evidence/i.test(f)), "no migration file exists for this candidate");
  const keys = [...c.matchAll(/'([a-z_]+)',\s*(?:case|null|to_char|v_run|p_sku)/g)].map((m) => m[1]);
  assert.equal(findEvidenceContractViolation(Object.fromEntries(keys.map((k) => [k, "X"]))), null, "no projected key trips the adapter's monetary-key guard");
});
test("static: every source join carries the full identity and exactly-one cardinality", () => {
  const c = code(SQL);
  for (const t of ["sku_prime_cost_snapshot", "sku_costing_control_status_snapshot", "sku_direct_labour_allocation_snapshot", "sku_internal_material_conversion_snapshot", "sku_regional_marketing_expense_allocation_snapshot"]) {
    const uses = [...c.matchAll(new RegExp(`from costing\\.${t} t\\s+where ([^;]+);`, "g"))];
    assert.ok(uses.length >= 2, t + " is counted and then read");
    for (const u of uses) for (const k of ["t.period_start = v_run.period_start", "t.valuation_date = v_run.valuation_date", "t.refresh_run_id = v_run.id", "t.sku_id = p_sku_id"]) assert.ok(u[1].includes(k), `${t}: ${k}`);
  }
});

// ------------------------------------------------------------------ isolated PostgreSQL
const bin = findPgBin();
let cluster;
const cases = [];
test.before(() => {
  if (!bin) return;
  cluster = startCluster(bin);
  const stub = read(path.join(dir, "test/00_stub_schema.sql")), fix = read(path.join(dir, "test/01_fixtures.sql"));
  for (const db of ["closed", "open"]) {
    cluster.createDb(db);
    cluster.run(db, stub); cluster.run(db, fix);
  }
  cluster.privBefore = cluster.run("open", "select grantee, table_schema||'.'||table_name, privilege_type from information_schema.table_privileges where grantee in ('anon','authenticated','public') order by 1,2,3").out;
  cluster.run("closed", SQL);                                         // exactly as shipped (gate false)
  cluster.run("open", SQL.replace(GATE, "v_d3_decided boolean := true;"));   // TEST-ONLY copy with the owner gate opened, in the throw-away database
  cluster.privAfter = cluster.run("open", "select grantee, table_schema||'.'||table_name, privilege_type from information_schema.table_privileges where grantee in ('anon','authenticated','public') order by 1,2,3").out;
});
test.after(() => cluster?.stop());
const pgtest = (name, fn) => test(name, { skip: bin ? false : "no PostgreSQL server binaries: isolated tests NOT RUN (a skip is not evidence)" }, fn);

const call = (db, args, { uid = U.view, role = "authenticated", pre = "", post = "" } = {}) => {
  const a = `${args[0] === null ? "null" : `'${args[0]}'`}, ${args[1] ?? "null"}, ${args[2] ?? "null"}`;
  const sql = `${pre}\nset role ${role};\nselect set_config('request.jwt.claim.sub', ${uid ? `'${uid}'` : "''"}, false);\nselect ${FN}(${a.replace(/^'null'/, "null")});\n${post}`;
  const r = cluster.run(db, sql, { allowError: true });
  return { ...r, line: r.out.split("\n").filter(Boolean).pop() };
};
const ok = (db, args, o) => { const r = call(db, args, o); assert.equal(r.status, 0, r.err); return r.line; };
const rec = (db, args, o) => JSON.parse(ok(db, args, o));
const mut = (sql, args, o = {}) => ok("open", args, { ...o, pre: `begin;\n${sql};\n`, post: "rollback;" });

pgtest("as shipped (D3 gate false): every request, including a perfectly eligible one, returns the single denial envelope", () => {
  for (const args of [["2026-10-01", 148, 41], ["2026-11-01", 149, 41], ["2026-10-01", 143, 41], ["2026-11-01", 150, 41], ["2026-10-01", 999999, 41], ["2026-10-01", 148, 999999], [null, 148, 41], ["2026-10-15", 148, 41]])
    for (const uid of [U.view, U.edit, U.none]) assert.equal(ok("closed", args, { uid }), DENY, JSON.stringify(args) + " " + uid);
});
pgtest("gate opened in the isolated copy: run 148 / SKU 41 returns the exact whitelisted record with the run's frozen finish time", () => {
  const r = rec("open", ["2026-10-01", 148, 41]);
  assert.deepEqual(r, { status: "ok", record: {
    period_start: "2026-10-01", refresh_run_id: 148, sku_id: 41, valuation_date: "2026-10-31", refreshed_at: "2026-11-04T21:05:00Z",
    material_costing_status: "READY", direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "NO_SKU_SALES_IN_LOOKBACK", allocation_basis_status: "REVIEW_REQUIRED",
    allocation_resolution_status: null, allocation_resolution_note: null, direct_labour_component_model_code: "MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS",
    internal_material_conversion_status: "READY", first_control_status: "DIRECT_LABOUR_REVIEW_REQUIRED", control_severity: "REVIEW", blocker_note: null,
    regional: { IK: { regional_basis_source: "REGIONAL_ACTUAL_UNITS", regional_basis_status: "READY", marketing_expense_allocation_status: "READY", note: null },
      OK: { regional_basis_source: "REGION_SCALED_COMMON_BASIS", regional_basis_status: "REVIEW_REQUIRED", marketing_expense_allocation_status: "REVIEW_REQUIRED", note: null } } } });
  const raw = ok("open", ["2026-10-01", 148, 41]);
  for (const leak of ["Ramesh", "Rs 5", "55.50", "a@b.example", "1,20,000", "salary", "111.", "222.22", "44.44", "1200000", "33.33"]) assert.ok(!raw.includes(leak), "leaked " + leak);
  assert.equal(findEvidenceContractViolation(r.record), null);
  assert.equal(r.record.refreshed_at === "2026-11-04T21:05:00Z", true, "frozen run finish time, not a stage timestamp (prime 20:45, control 21:00)");
});
pgtest("exact period/run/SKU isolation: 148 vs 149 differ per run; swapped period/run pairs are denied", () => {
  assert.equal(rec("open", ["2026-10-01", 148, 41]).record.first_control_status, "DIRECT_LABOUR_REVIEW_REQUIRED");
  assert.equal(rec("open", ["2026-11-01", 149, 41]).record.first_control_status, "READY");
  assert.equal(rec("open", ["2026-11-01", 149, 41]).record.valuation_date, "2026-11-02");
  for (const args of [["2026-11-01", 148, 41], ["2026-10-01", 149, 41], ["2026-09-01", 148, 41]]) assert.equal(ok("open", args), DENY);
  assert.equal(rec("open", ["2026-10-01", 148, 105]).record.material_costing_status, "BLOCKED");
});
pgtest("indistinguishable denial: missing / wrong-period / approved / failed / non-selected / revoked / reference / wrong-context run, missing SKU, malformed input, no permission", () => {
  const denied = [
    ["missing run", ["2026-10-01", 999999, 41]], ["wrong period", ["2026-11-01", 148, 41]], ["approved 143", ["2026-10-01", 143, 41]], ["failed 150", ["2026-11-01", 150, 41]],
    ["approved+closed 122", ["2026-09-01", 122, 41]], ["superseded 155", ["2026-12-01", 155, 41]], ["revoked 160", ["2027-01-01", 160, 41]], ["reference 161", ["2027-02-01", 161, 41]],
    ["wrong context 170", ["2027-02-01", 170, 41]], ["missing SKU", ["2026-10-01", 148, 999999]], ["null period", [null, 148, 41]], ["null run", ["2026-10-01", null, 41]], ["null sku", ["2026-10-01", 148, null]],
    ["negative run", ["2026-10-01", -1, 41]], ["zero sku", ["2026-10-01", 148, 0]], ["mid-month", ["2026-10-15", 148, 41]]];
  for (const [label, args] of denied) assert.equal(ok("open", args), DENY, label);
  for (const [label, uid] of [["no permission row", U.none], ["edit without view", U.noview], ["other module only", U.other], ["no jwt subject", ""]]) assert.equal(ok("open", ["2026-10-01", 148, 41], { uid }), DENY, label);
  assert.equal(rec("open", ["2026-12-01", 156, 41]).status, "ok", "the selected (latest) run of a period is eligible once D3 is decided");
});
pgtest("KNOWN D3 GAP (documented, not fixed here): the structural predicate alone admits retained old OPEN drafts 80 and 82", () => {
  assert.equal(rec("open", ["2026-07-01", 80, 41]).status, "ok");
  assert.equal(rec("open", ["2026-08-01", 82, 41]).status, "ok");
  // Excluding them needs an owner policy (a review window or an explicit register): there is no such register in the repository.
});
pgtest("role contexts: CCC view and CCC edit are served (same data, no write side effect); anon cannot execute at all", () => {
  assert.deepEqual(rec("open", ["2026-10-01", 148, 41], { uid: U.view }), rec("open", ["2026-10-01", 148, 41], { uid: U.edit }));
  const anon = call("open", ["2026-10-01", 148, 41], { role: "anon", uid: "" });
  assert.notEqual(anon.status, 0); assert.match(anon.err, /permission denied for function/);
  assert.equal(cluster.run("open", `select has_function_privilege('anon','${FN}(date,bigint,bigint)','execute'), has_function_privilege('authenticated','${FN}(date,bigint,bigint)','execute'), has_function_privilege('public','${FN}(date,bigint,bigint)','execute')`).out, "f|t|t".replace("t|t", "t|f"));
});
pgtest("function properties: SECURITY DEFINER, STABLE, fixed search_path; creating it granted no table privilege; runs in a READ ONLY transaction; writes nothing", () => {
  assert.equal(cluster.run("open", `select prosecdef, provolatile, proconfig::text from pg_proc where oid = '${FN}(date,bigint,bigint)'::regprocedure`).out, "t|s|{\"search_path=pg_catalog, pg_temp\"}");
  assert.equal(cluster.privBefore, cluster.privAfter, "table privileges unchanged by applying the candidate");
  const counts = "select (select count(*) from costing.sku_prime_cost_snapshot)||'/'||(select count(*) from costing.sku_direct_labour_allocation_snapshot)||'/'||(select count(*) from costing.sku_costing_control_status_snapshot)||'/'||(select count(*) from costing.costing_refresh_run)||'/'||(select count(*) from public.user_permissions_canonical)";
  const before = cluster.run("open", counts).out;
  const r = call("open", ["2026-10-01", 148, 41], { pre: "begin read only;", post: "commit;" });
  assert.equal(r.status, 0, r.err); assert.match(r.line, /"status": "ok"/);
  assert.equal(cluster.run("open", counts).out, before);
});
pgtest("source integrity: duplicate, missing, mismatched-identity, parity-breaking, post-finish and internally-broken sources all return the same denial (never partial evidence)", () => {
  const tables = ["sku_prime_cost_snapshot", "sku_direct_labour_allocation_snapshot", "sku_internal_material_conversion_snapshot", "sku_costing_control_status_snapshot"];
  for (const t of tables) {
    assert.equal(mut(`insert into costing.${t} select * from costing.${t} where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "duplicate " + t);
    assert.equal(mut(`delete from costing.${t} where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "missing " + t);
    assert.equal(mut(`update costing.${t} set valuation_date = '2026-10-30' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "valuation mismatch " + t);
    assert.equal(mut(`update costing.${t} set period_start = '2026-09-01' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "period mismatch " + t);
  }
  const reg = "costing.sku_regional_marketing_expense_allocation_snapshot";
  assert.equal(mut(`insert into ${reg} select * from ${reg} where refresh_run_id = 148 and sku_id = 41 and region_code = 'IK'`, ["2026-10-01", 148, 41]), DENY, "duplicate IK");
  assert.equal(mut(`delete from ${reg} where refresh_run_id = 148 and sku_id = 41 and region_code = 'OK'`, ["2026-10-01", 148, 41]), DENY, "missing OK");
  assert.equal(mut(`update ${reg} set region_code = 'XX' where refresh_run_id = 148 and sku_id = 41 and region_code = 'OK'`, ["2026-10-01", 148, 41]), DENY, "unknown region replaces OK");
  assert.equal(mut(`update ${reg} set valuation_date = '2026-10-30' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "regional valuation mismatch");
  assert.equal(mut(`update costing.sku_costing_control_status_snapshot set material_costing_status = 'REVIEW_REQUIRED' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "prime vs control parity");
  assert.equal(mut(`update costing.sku_internal_material_conversion_snapshot set conversion_status = 'BLOCKED' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "prime vs conversion parity");
  for (const [t, c] of [["sku_prime_cost_snapshot", "refreshed_at"], ["sku_direct_labour_allocation_snapshot", "refreshed_at"], ["sku_costing_control_status_snapshot", "snapshot_refreshed_at"]])
    assert.equal(mut(`update costing.${t} set ${c} = '2026-11-05 00:00+00' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]), DENY, "rewritten after finish " + t);
  assert.equal(mut(`update ${reg} set refreshed_at = '2026-11-05 00:00+00' where refresh_run_id = 148 and sku_id = 41 and region_code = 'OK'`, ["2026-10-01", 148, 41]), DENY, "regional rewritten after finish");
  assert.equal(mut(`alter table costing.sku_direct_labour_allocation_snapshot rename column allocation_basis_status to x`, ["2026-10-01", 148, 41]), DENY, "internal error is swallowed, not leaked");
  assert.equal(mut(`update costing.cost_periods set status = 'CLOSED' where period_start = '2026-10-01'`, ["2026-10-01", 148, 41]), DENY, "closed period");
  assert.equal(mut(`update costing.costing_refresh_run set finished_at = null where id = 148`, ["2026-10-01", 148, 41]), DENY, "no finish time");
  assert.equal(mut(`update costing.costing_refresh_run set valuation_context_source = 'USER_SUPPLIED' where id = 148`, ["2026-10-01", 148, 41]), DENY, "context not captured at request");
  assert.equal(mut(`insert into costing.run_designation_stub values (148, 'APPROVED')`, ["2026-10-01", 148, 41]), DENY, "148 designated approved");
  assert.equal(mut(`update costing.costing_refresh_run set overall_status = 'RUNNING' where id = 148`, ["2026-10-01", 148, 41]), DENY, "not SUCCESS");
});
pgtest("free text and codes: notes never returned; a value that is not a machine code becomes null (UNKNOWN), never text", () => {
  const r = JSON.parse(mut(`update costing.sku_direct_labour_allocation_snapshot set allocation_reason_code = 'Rs 5000 paid to Ramesh', direct_labour_component_model_code = 'lower_case_code' where refresh_run_id = 148 and sku_id = 41`, ["2026-10-01", 148, 41]));
  assert.equal(r.status, "ok"); assert.equal(r.record.allocation_reason_code, null); assert.equal(r.record.direct_labour_component_model_code, null);
  assert.equal(r.record.allocation_resolution_note, null); assert.equal(r.record.blocker_note, null);
  const r2 = JSON.parse(mut(`update costing.sku_regional_marketing_expense_allocation_snapshot set regional_basis_status = 'READY 12,000' where refresh_run_id = 148 and sku_id = 41 and region_code = 'IK'`, ["2026-10-01", 148, 41]));
  assert.equal(r2.record.regional.IK.regional_basis_status, null);
});
pgtest("contract cross-check: the real CDE-1b adapter and CDE-1a loader accept the SQL's actual output (identity echo, no violation) and treat the denial as empty", async () => {
  const live = async (period, run, sku) => ({ data: JSON.parse(ok("open", [period, run, sku])), error: null });
  const provider = createDraftRunEvidenceRpcProvider({ callRpc: async (_n, a) => live(a.p_period_start, a.p_refresh_run_id, a.p_sku_id) });
  const ctx = { context: { periodStart: "2026-10-01", runId: "148", runKind: "draft", allowedRunIds: ["148"] }, row: { period_start: "2026-10-01", refresh_run_id: 148, sku_id: 41 } };
  const loader = ev.createDraftRunEvidenceLoader({ getCurrentContext: () => ctx, getProvider: () => provider });
  const req = ev.resolveDraftEvidenceRequest(ctx.context, ctx.row);
  await loader.load(req);
  assert.equal(loader.stateFor(req).status, ev.DRAFT_EVIDENCE_STATUS.OK);
  assert.equal(loader.stateFor(req).record.refreshed_at, "2026-11-04T21:05:00Z");
  assert.equal((await provider.readSkuEvidence({ periodStart: "2026-10-01", runId: "143", skuId: "41" })).status, "empty");
});
pgtest("immutability probe (isolated): the repo's CURRENT stage-05 control guard is a session-context check, not a run-status check", () => {
  const mig = read(path.join(root, "supabase/migrations/20260915025638_optimize_stage05_sku_control_context_validation_once.sql"));
  const fnText = mig.slice(mig.indexOf("create or replace function costing.fn_guard_stage05_exact_snapshot_write()"), mig.indexOf("$function$;", mig.indexOf("as $function$")) + "$function$;".length);
  assert.ok(fnText.length > 500 && !/overall_status/.test(fnText), "latest guard text never consults the run's overall_status");
  cluster.createDb("guard");
  cluster.run("guard", read(path.join(dir, "test/00_stub_schema.sql")));
  cluster.run("guard", read(path.join(dir, "test/01_fixtures.sql")));
  cluster.run("guard", `${fnText}\ncreate trigger a_stage05_exact_write_guard before insert or update or delete on costing.sku_costing_control_status_snapshot for each row execute function costing.fn_guard_stage05_exact_snapshot_write();`);
  const upd = "update costing.sku_costing_control_status_snapshot set first_control_status = 'TAMPERED' where refresh_run_id = 148 and sku_id = 41";
  const plain = cluster.run("guard", upd, { allowError: true });
  assert.notEqual(plain.status, 0); assert.match(plain.err, /writer-validated refresh context/);
  const withCtx = cluster.run("guard", `select set_config('costing.control_snapshot_refresh_run_id','148',false), set_config('costing.control_snapshot_valuation_date','2026-10-31',false), set_config('costing.control_snapshot_period_start','2026-10-01',false), set_config('costing.control_snapshot_stage05_validated','1',false);\n${upd};\nselect first_control_status from costing.sku_costing_control_status_snapshot where refresh_run_id = 148 and sku_id = 41;`, { allowError: true });
  assert.equal(withCtx.status, 0, withCtx.err);
  assert.equal(withCtx.out.split("\n").pop(), "TAMPERED", "a session that sets the context can rewrite a SUCCESS run's control row: protection rests on who may write, not on run status");
});
