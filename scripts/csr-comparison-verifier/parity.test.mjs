// #282 deterministic offline PG fixture tests for the Cost Comparison contract. Requires local PostgreSQL binaries and FAILS CLOSED
// (test failure, never skip) if unavailable. Fixture-only: proves nothing about production timing or production data.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { buildFixture, compare, extractFromMigration, buildGovernedViewSql, HERE, UID } from "./lib.mjs";
import { COMPARISON_COLUMNS } from "../../public/shared/js/costing-cost-comparison-read.js";

const BASE = join(HERE, "sql/baseline-view-read.sql");
const CAND = join(HERE, "sql/candidate-installed-rpc.sql");
const MUT = (n) => join(HERE, "sql/mutants", n);
const GUC = `SET fixture.uid='${UID}'; SET fixture.perm='allow';`;
let c;
before(() => { c = buildFixture(); });
after(() => { c?.stop(); });
const rpcRows = (period, lim = 2000, cols = "*", where = "true") =>
  c.must(`${GUC} SELECT coalesce(json_agg(t), '[]') FROM (SELECT ${cols} FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('${period}', ${lim}) WHERE ${where}) t;`);
const J = (s) => JSON.parse(s);

test("migration source is the single source of truth: function body and derived unscoped view extract cleanly", () => {
  const { createFunction, returnQuery } = extractFromMigration();
  assert.match(createFunction, /SECURITY DEFINER/);
  assert.match(createFunction, /require_permission\('module:costing-control-center', false\)/);
  assert.match(buildGovernedViewSql(returnQuery), /^CREATE VIEW costing\.v_cost_sheet_snapshot_sku_monthly_comparison_governed/);
});

test("63-column contract: view and RPC expose exactly the client's pinned names in order", () => {
  const n = c.must("SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid='costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped;");
  assert.deepEqual(n.split(","), [...COMPARISON_COLUMNS]);
  assert.equal(COMPARISON_COLUMNS.length, 63);
});

test("parity matrix: installed RPC == baseline view read for Nov/Oct/Sep, 7 synthetic periods, empty period and the cap month (bidirectional EXCEPT ALL, strict text, order, cap)", () => {
  const periods = ["2026-11-01", "2026-10-01", "2026-09-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2027-03-01", "2024-01-01"];
  for (const period of periods) {
    const r = compare(c, { baselineSql: BASE, candidateSql: CAND, period, lim: 2000, tag: "m" });
    assert.equal(r.pass, true, JSON.stringify(r));
    assert.equal(r.baselineMinusCandidate, 0); assert.equal(r.candidateMinusBaseline, 0);
  }
  assert.equal(compare(c, { baselineSql: BASE, candidateSql: CAND, period: "2024-01-01", tag: "e" }).baselineRows, 0, "no governed run => empty, not error");
});

test("independent oracle (not just parity): governed run only, decoys excluded, labels and bases", () => {
  const nov = J(rpcRows("2026-11-01"));
  assert.equal(nov.length, 43);
  assert.ok(nov.every((r) => !/DECOY|MISMATCH/.test(`${r.product_name}${r.sku_column_label}${r.cost_sheet_status}`)), "non-governed run ids and period-mismatched rows never appear");
  assert.ok(nov.every((r) => r.snapshot_period_start === "2026-11-01" && r.snapshot_refresh_run_id === 1023 && r.snapshot_selection_basis === "APPROVED"));
  assert.ok(nov.every((r) => r.snapshot_run_label === "Approved run 1023"));
  const sku1 = nov.find((r) => r.sku_id === 1);
  assert.equal(sku1.previous_month_period_start, "2026-10-01"); assert.equal(sku1.previous_year_period_start, "2025-11-01");
  assert.equal(sku1.previous_month_selection_basis, "DRAFT", "Oct is a DRAFT run in the fixture");
  const oct = J(rpcRows("2026-10-01"));
  assert.ok(oct.every((r) => r.snapshot_run_label === "DRAFT run 1022 - not approved"));
});

test("period boundaries: Jan looks back to Dec of the prior year; missing prior months give NULL (not error)", () => {
  const jan = J(rpcRows("2026-01-01", 2000, "sku_id, previous_month_period_start, previous_year_period_start", "sku_id = 1"));
  assert.deepEqual(jan, [{ sku_id: 1, previous_month_period_start: "2025-12-01", previous_year_period_start: "2025-01-01" }]);
  const first = J(rpcRows("2025-01-01", 2000, "sku_id, previous_month_period_start, previous_year_period_start", "sku_id = 1"));
  assert.deepEqual(first, [{ sku_id: 1, previous_month_period_start: null, previous_year_period_start: null }]);
  const nov = J(rpcRows("2026-11-01", 2000, "sku_id, previous_month_period_start, previous_year_period_start", "sku_id IN (18, 22, 40)"));
  const by = Object.fromEntries(nov.map((r) => [r.sku_id, r]));
  assert.equal(by[18].previous_month_period_start, null, "SKU 18 missing in Oct => no previous month");
  assert.equal(by[22].previous_year_period_start, null, "SKU 22 missing Nov 2025 => no previous year");
  assert.deepEqual([by[40].previous_month_period_start, by[40].previous_year_period_start], [null, null], "brand-new SKU");
});

test("duplicate SKU/group keys fan out 2x2 and are preserved as a bag; duplicate line labels aggregate by max()", () => {
  const rows = J(rpcRows("2026-11-01", 2000, "sku_id, product_name, sku_column_label, previous_month_manufacturing_cop", "sku_id = 7"));
  assert.equal(rows.length, 4, "2 current groups x 2 previous groups for the same sku_id");
  assert.equal(rows.filter((r) => r.product_name === "Dup Product").length, 2);
  const sku8 = J(rpcRows("2026-11-01", 2000, "manufacturing_cop", "sku_id = 8"));
  assert.equal(Number(sku8[0].manufacturing_cop), 99999.99);
  assert.equal(compare(c, { baselineSql: BASE, candidateSql: CAND, period: "2026-11-01", tag: "d" }).pass, true);
});

test("NULLs and zero denominators: NULL names sort last, NULL values stay NULL, zero previous COP gives NULL percent but numeric change", () => {
  const nov = J(rpcRows("2026-11-01", 2000, "product_name, sku_column_label, sku_id"));
  assert.equal(nov.at(-1).product_name, null, "SKU 33 has NULL product_name => NULLS LAST");
  const p4 = nov.filter((r) => r.product_name === "Product 017");
  assert.equal(p4.at(-1).sku_column_label, null, "NULL label sorts last inside its product");
  const z = J(rpcRows("2026-11-01", 2000, "sku_id, previous_month_manufacturing_cop, manufacturing_cop_mom_change, manufacturing_cop_mom_change_percent", "sku_id IN (10, 20, 30)"));
  for (const r of z) {
    assert.equal(Number(r.previous_month_manufacturing_cop), 0);
    assert.equal(r.manufacturing_cop_mom_change_percent, null);
    assert.notEqual(r.manufacturing_cop_mom_change, undefined);
  }
});

test("2000 cap and order: 2105 SKUs => exactly 2000, ordered, deterministic prefix; smaller limits are prefixes of the same order", () => {
  const all = J(rpcRows("2027-03-01", 2000, "sku_id, product_name"));
  assert.equal(all.length, 2000);
  assert.equal(all[0].product_name, "Bulk 000001"); assert.equal(all.at(-1).product_name, "Bulk 002000");
  const five = J(rpcRows("2027-03-01", 5, "product_name"));
  assert.deepEqual(five.map((r) => r.product_name), all.slice(0, 5).map((r) => r.product_name));
  const prev = J(rpcRows("2027-03-01", 2000, "previous_month_period_start", "sku_id IN (100001, 100601)"));
  assert.deepEqual(prev.map((r) => r.previous_month_period_start), ["2027-02-01", null]);
  // Documented risk, not a failure: baseline view read orders by (product_name, sku_column_label) only; the RPC adds sku_id. They
  // coincide whenever that pair is unique at the cap boundary (true in this fixture); ties exactly at the cap could pick different rows.
});

test("RPC guards: unauthenticated, denied, bad period and bad limits fail with P0001 and the installed messages", () => {
  const run = (sql) => c.psql(sql);
  const ok = `SET fixture.uid='${UID}'; SET fixture.perm='allow';`;
  const call = (a, b) => `SELECT count(*) FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(${a}, ${b});`;
  let r = run(`SET fixture.uid=''; SET fixture.perm='allow'; ${call("'2026-11-01'", 1)}`);
  assert.equal(r.ok, false); assert.match(r.err, /Not authenticated/);
  r = run(`SET fixture.uid='${UID}'; SET fixture.perm='deny'; ${call("'2026-11-01'", 1)}`);
  assert.equal(r.ok, false); assert.match(r.err, /denied/); assert.match(r.err, /P0001|denied:true/);
  for (const [a, b, m] of [["'2026-11-15'", 1, /first day of month/], ["NULL", 1, /first day of month/], ["'2026-11-01'", 0, /Invalid limit/], ["'2026-11-01'", 2001, /Invalid limit/], ["'2026-11-01'", "NULL", /Invalid limit/]]) {
    r = run(`${ok} ${call(a, b)}`); assert.equal(r.ok, false, `${a},${b}`); assert.match(r.err, m);
  }
  assert.equal(run(`${ok} ${call("'2026-11-01'", 1)}`).out, "1");
});

test("mutation self-tests: the comparator FAILS every deliberately wrong candidate (proves it can detect regressions)", () => {
  const expectFail = (name, period, check) => {
    const r = compare(c, { baselineSql: BASE, candidateSql: MUT(name), period, tag: "x" });
    assert.equal(r.pass, false, `${name} must fail: ${JSON.stringify(r)}`);
    check?.(r);
  };
  expectFail("drop-row.sql", "2026-11-01", (r) => { assert.equal(r.baselineMinusCandidate, 1); assert.equal(r.candidateMinusBaseline, 0); });
  expectFail("duplicate-row.sql", "2026-11-01", (r) => { assert.equal(r.candidateMinusBaseline, 1); assert.equal(r.baselineMinusCandidate, 0); });
  expectFail("null-flip.sql", "2026-11-01", (r) => assert.ok(r.baselineMinusCandidate > 0 && r.candidateMinusBaseline > 0));
  expectFail("scale-drift.sql", "2026-11-01", (r) => { assert.equal(r.bagParity, true, "numeric EXCEPT ALL cannot see scale"); assert.equal(r.strictTextParity, false, "strict text bag does"); });
  expectFail("wrong-order.sql", "2026-11-01", (r) => { assert.equal(r.bagParity, true); assert.ok(r.candidateOrderViolations > 0); });
  expectFail("cap-1999.sql", "2027-03-01", (r) => assert.equal(r.candidateRows, 1999));
  expectFail("extra-column.sql", "2026-11-01", (r) => { assert.equal(r.candidateContract63, false); assert.equal(r.schemaIdentical, false); });
  expectFail("prev-cop-shift.sql", "2026-10-01", (r) => assert.ok(r.baselineMinusCandidate > 0));
});

test("CLI: candidate/baseline paths are parameters; exit 0 on parity, 1 on mutant, 2 (fail closed) when PostgreSQL is unavailable", () => {
  const cli = join(HERE, "verify.mjs");
  const run = (args, env = {}) => spawnSync("node", [cli, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  let r = run(["--periods", "2026-11-01"]);
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /VERIFIER OK/);
  r = run(["--periods", "2026-11-01", "--candidate-sql", MUT("drop-row.sql")]);
  assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout, /VERIFIER FAIL/);
  r = run(["--periods", "2026-11-01"], { CSR_VERIFIER_PG_BIN: "/nonexistent-pg-bin" });
  assert.equal(r.status, 2); assert.match(r.stderr, /fail closed/);
  r = run(["--periods", "2026-11-15"]); assert.equal(r.status, 2);
});
