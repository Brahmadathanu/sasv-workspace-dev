// WP12 keyset-first Cost Comparison CANDIDATE: offline parity / security / mutation tests.
// Throwaway local PostgreSQL only (unix socket, no network). Fixture-only: proves NOTHING about production timing or production data.
// The candidate function is installed under a NEW name beside the installed scoped RPC; neither is a deployed object.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildFixture, compare, extractFromMigration, HERE, REPO, UID, rd } from "./lib.mjs";
import { COMPARISON_COLUMNS } from "../../public/shared/js/costing-cost-comparison-read.js";

const CDIR = join(HERE, "candidates/keyset-first");
const FN_FILE = join(CDIR, "candidate-function.sql");
const FX_FILE = join(CDIR, "fixture-extra.sql");
const VIEW = join(HERE, "sql/baseline-view-read.sql");
const INST = join(HERE, "sql/candidate-installed-rpc.sql");
const KS = join(CDIR, "candidate-keyset-rpc.sql");
const GUC = `SET fixture.uid='${UID}'; SET fixture.perm='allow';`;
const NAME = "rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1";
const INST_NAME = "rpc_get_cost_sheet_sku_monthly_comparison_scoped";
const BASE_PERIODS = ["2026-11-01", "2026-10-01", "2026-09-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2027-03-01", "2024-01-01"];
const EXTRA_PERIODS = ["2028-05-01", "2028-04-01", "2028-06-01", "2027-05-01", "2028-07-01"];
let c;
const J = (s) => JSON.parse(s);
const q = (sql) => c.must(`${GUC} ${sql}`);
const rows = (fn, period, lim = 2000, cols = "*", where = "true") =>
  J(q(`SELECT coalesce(json_agg(t), '[]') FROM (SELECT ${cols} FROM public.${fn}('${period}', ${lim}) WHERE ${where}) t;`));
let tagN = 0;
/** candidate vs BOTH comparators, strict. */
const threeWay = (period, lim = 2000, candidate = KS) => {
  const tag = `k${tagN++}`;
  const vs = (baselineSql, label) => { const r = compare(c, { baselineSql, candidateSql: candidate, period, lim, tag: `${tag}${label}` }); return { label, ...r }; };
  return [vs(VIEW, "view"), vs(INST, "rpc")];
};
const assertParity = (period, lim = 2000, candidate = KS) => {
  for (const r of threeWay(period, lim, candidate)) assert.equal(r.pass, true, `${period} lim=${lim} vs ${r.label}: ${JSON.stringify(r)}`);
};

before(() => {
  c = buildFixture({ candidateFunctionSql: FN_FILE, extraFixtureSql: [FX_FILE] });
  c.must("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;", { db: "postgres" });
  c.must(rd(join(CDIR, "candidate-grants.sql")));
  // The installed function gets the identical stand-in grants so the two privilege surfaces can be compared in the fixture.
  c.must(`REVOKE ALL ON FUNCTION public.${INST_NAME}(date,integer) FROM PUBLIC; REVOKE ALL ON FUNCTION public.${INST_NAME}(date,integer) FROM anon; GRANT EXECUTE ON FUNCTION public.${INST_NAME}(date,integer) TO authenticated;`);
});
after(() => { c?.stop(); });

test("isolation: candidate lives only under scripts/, is absent from supabase/ and public/, and the installed migration is not edited", () => {
  assert.ok(existsSync(FN_FILE));
  for (const dir of [join(REPO, "supabase/migrations"), join(REPO, "public"), join(REPO, "electron"), join(REPO, "js")]) {
    if (!existsSync(dir)) continue;
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" ? [] : walk(join(d, e.name))) : [join(d, e.name)]);
    for (const f of walk(dir).filter((x) => /\.(sql|js|mjs|html)$/.test(x))) assert.ok(!readFileSync(f, "utf8").includes(NAME), `${f} must not reference the candidate`);
  }
});

test("textual provenance: pivot lists (x2), comparison projection, outer 63-column projection, guards and grant-relevant attributes are verbatim from the installed migration", () => {
  const { returnQuery, createFunction } = extractFromMigration();
  const cand = rd(FN_FILE);
  const pivot = returnQuery.match(/WITH line_pivot AS \(\n(\s+SELECT [\s\S]*?gr\.selection_basis AS snapshot_selection_basis)\n/)[1];
  assert.equal(cand.split(pivot).length - 1, 2, "pivot select list appears exactly twice (cur_pivot, hist_pivot) and is identical to the installed one");
  const grp = returnQuery.match(/GROUP BY gr\.refresh_run_id[^\n]*/)[0];
  assert.equal(cand.split(grp).length - 1, 2, "GROUP BY identical in both pivots");
  const join = "JOIN costing.v_current_successful_costing_refresh_run gr ON (((gr.refresh_run_id = cost_sheet_line_monthly_snapshot.refresh_run_id) AND (gr.period_start = cost_sheet_line_monthly_snapshot.snapshot_period_start))))";
  assert.ok(returnQuery.includes(join)); assert.equal(cand.split(join).length - 1, 2, "governed-run join identical in both pivots");
  const cmp = returnQuery.match(/comparison AS \(\n(\s+SELECT cur\.snapshot_period_start,[\s\S]*?yoy\.snapshot_selection_basis AS previous_year_selection_basis)\n/)[1];
  assert.ok(cand.includes(cmp), "comparison projection identical");
  const outer = returnQuery.match(/\n( SELECT snapshot_period_start,[\s\S]*?)\n   FROM comparison\n/)[1];
  assert.ok(cand.includes(outer), "outer projection (incl. derived MoM/YoY columns and run label CASE) identical");
  const guards = createFunction.match(/BEGIN\n([\s\S]*?)\n  RETURN QUERY/)[1];
  assert.ok(cand.includes(guards), "guard block identical");
  for (const attr of ["LANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER\nSET search_path = pg_catalog, pg_temp", "RETURNS SETOF costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed"]) {
    assert.ok(createFunction.includes(attr) && cand.includes(attr), attr);
  }
  assert.match(cand, /cur_keys AS MATERIALIZED/);
  assert.match(cand, /ORDER BY product_name, sku_column_label, sku_id\n\s+LIMIT p_limit/);
});

test("63-column contract: candidate returns exactly the client's pinned names, order and types (identical to installed RPC and governed view)", () => {
  const sig = (fn) => c.must(`SELECT string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = (SELECT typrelid FROM pg_type WHERE oid = (SELECT prorettype FROM pg_proc WHERE proname='${fn}')) AND a.attnum>0 AND NOT a.attisdropped;`);
  assert.equal(sig(NAME), sig(INST_NAME));
  assert.deepEqual(sig(NAME).split(",").map((x) => x.split(":")[0]), [...COMPARISON_COLUMNS]);
  // Result-set types actually produced (not just declared):
  const mk = (fn) => q(`DROP TABLE IF EXISTS scratch_ty_${fn.length}; CREATE TABLE scratch_ty_${fn.length} AS SELECT * FROM public.${fn}('2026-11-01', 5); SELECT string_agg(attname||':'||format_type(atttypid, atttypmod), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid='scratch_ty_${fn.length}'::regclass AND attnum>0 AND NOT attisdropped;`);
  assert.equal(mk(NAME), mk(INST_NAME));
  assert.equal(mk(NAME).split(",").length, 63);
});

test("function catalogue/security surface equals the installed function (SECURITY DEFINER, STABLE, pinned search_path, args/defaults, return set) and privileges mirror it", () => {
  const cat = (fn) => c.must(`SELECT pg_get_function_arguments(p.oid) || '|' || pg_get_function_result(p.oid) || '|' || p.prosecdef::text || '|' || p.provolatile::text || '|' || p.proretset::text || '|' || coalesce(array_to_string(p.proconfig, ';'), '') || '|' || l.lanname || '|' || p.pronargdefaults::text || '|' || pg_get_userbyid(p.proowner) FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.proname = '${fn}'`);
  assert.equal(cat(NAME), cat(INST_NAME));
  assert.match(cat(NAME), /\|true\|s\|true\|search_path=pg_catalog, pg_temp\|plpgsql\|1\|/);
  const priv = (fn, role) => c.must(`SELECT has_function_privilege('${role}', 'public.${fn}(date,integer)', 'EXECUTE')`);
  assert.equal(priv(NAME, "authenticated"), "t"); assert.equal(priv(NAME, "anon"), "f");
  assert.equal(c.must(`SELECT has_function_privilege('public', 'public.${NAME}(date,integer)', 'EXECUTE')`), "f");
  assert.equal(priv(INST_NAME, "authenticated"), priv(NAME, "authenticated")); assert.equal(priv(INST_NAME, "anon"), priv(NAME, "anon"));
  // Behavioural: anon is refused at the privilege layer, authenticated reaches the guards.
  const asRole = (role, fn) => c.psql(`SET ROLE ${role}; ${GUC} SELECT count(*) FROM public.${fn}('2026-11-01', 3);`);
  assert.equal(asRole("anon", NAME).ok, false); assert.match(asRole("anon", NAME).err, /permission denied/);
  const a = asRole("authenticated", NAME); assert.equal(a.ok, true, a.err); assert.equal(a.out, "3");
  assert.equal(asRole("authenticated", INST_NAME).out, a.out);
});

test("guards: unauthenticated, permission-denied (ID-N/X/O stand-in), bad period and bad limits give the SAME errors as the installed RPC; allowed viewer succeeds", () => {
  const call = (fn, a, b) => `SELECT count(*) FROM public.${fn}(${a}, ${b});`;
  const outcome = (fn, pre, a, b) => { const r = c.psql(`${pre} ${call(fn, a, b)}`); return { ok: r.ok, err: r.err.replace(/^psql:.*?ERROR:\s+/s, "").split("\n")[0].replace(/ \(.*$/, ""), out: r.out }; };
  const allow = `SET fixture.uid='${UID}'; SET fixture.perm='allow';`;
  const cases = [
    [`SET fixture.uid=''; SET fixture.perm='allow';`, "'2026-11-01'", 1, /Not authenticated/],
    [`SET fixture.uid='${UID}'; SET fixture.perm='deny';`, "'2026-11-01'", 1, /denied/],
    [allow, "'2026-11-15'", 1, /first day of month/], [allow, "NULL", 1, /first day of month/],
    [allow, "'2026-11-01'", 0, /Invalid limit/], [allow, "'2026-11-01'", 2001, /Invalid limit/], [allow, "'2026-11-01'", "NULL", /Invalid limit/], [allow, "'2026-11-01'", -5, /Invalid limit/],
  ];
  for (const [pre, a, b, re] of cases) {
    const k = outcome(NAME, pre, a, b), i = outcome(INST_NAME, pre, a, b);
    assert.equal(k.ok, false, `${a},${b}`); assert.match(k.err, re); assert.deepEqual(k, i, `${a},${b} must fail identically to the installed RPC`);
  }
  assert.equal(outcome(NAME, allow, "'2026-11-01'", 1).out, "1");
  assert.equal(outcome(NAME, allow, "'2026-11-01'", 2000).out, outcome(INST_NAME, allow, "'2026-11-01'", 2000).out);
  // Guards fire BEFORE any table access: with the snapshot table renamed the unauthenticated call still returns the guard error, not a missing-table error.
  assert.match(outcome(NAME, `SET fixture.uid=''; SET fixture.perm='allow';`, "'2026-11-01'", 1).err, /Not authenticated/);
});

test("parity matrix (base fixture): candidate == governed view AND == installed RPC for Sep/Oct/Nov, 7 synthetic periods, empty period and the 2105-SKU cap month", () => {
  for (const p of BASE_PERIODS) assertParity(p);
  assert.equal(threeWay("2024-01-01")[0].candidateRows, 0, "no governed run => empty result, not an error");
  const cap = threeWay("2027-03-01"); assert.equal(cap[0].candidateRows, 2000); assert.equal(cap[1].baselineRows, 2000);
});

test("parity matrix (extra fixture): name-change, duplicate-SKU, NULL, missing-history, draft/approved, NULL sku_id and decoy-run scenarios", () => {
  for (const p of EXTRA_PERIODS) assertParity(p);
  const r = threeWay("2028-05-01"); assert.ok(r[0].candidateRows > 30, "non-trivial extra period");
  assert.equal(threeWay("2028-07-01")[0].candidateRows, 0, "period with no governed run is empty");
});

test("independent oracle on the extra fixture (parity alone could hide a shared bug): multiplicity, names, NULLs, missing/decoy history, bases", () => {
  const cur = rows(NAME, "2028-05-01");
  const by = (id) => cur.filter((r) => r.sku_id === id);
  // A: name change - current name is the new one, previous month/year are matched by sku_id not by name; 2 yoy groups => 2 rows.
  assert.equal(by(200001).length, 2); assert.ok(by(200001).every((r) => r.product_name === "FX Alpha New" && r.previous_month_period_start === "2028-04-01" && r.previous_year_period_start === "2027-05-01"));
  assert.equal(new Set(by(200001).map((r) => r.previous_year_manufacturing_cop)).size, 2, "the two Y0 groups produce two distinct yoy COP values (no collapse)");
  // B: 2 current groups x 2 previous groups = 4 rows (bag multiplicity preserved).
  assert.equal(by(200002).length, 4); assert.equal(by(200002).filter((r) => r.product_name === "FX Beta").length, 2); assert.equal(by(200002).filter((r) => r.product_name === "FX Beta Renamed").length, 2);
  // C: everything NULL, derived columns NULL (not error, not 0).
  const gC = by(200003); assert.equal(gC.length, 1);
  for (const col of ["rm_cost", "manufacturing_cop", "previous_month_manufacturing_cop", "previous_year_manufacturing_cop", "manufacturing_cop_mom_change", "manufacturing_cop_mom_change_percent", "manufacturing_cop_yoy_change_percent", "cost_sheet_status", "sku_column_label"]) assert.equal(gC[0][col], null, col);
  assert.equal(gC[0].previous_month_period_start, "2028-04-01", "history rows exist even though all their values are NULL");
  // D/E/F: missing history => NULL period markers, one row each.
  assert.deepEqual([by(200004)[0].previous_month_period_start, by(200004)[0].previous_year_period_start], [null, "2027-05-01"]);
  assert.deepEqual([by(200005)[0].previous_month_period_start, by(200005)[0].previous_year_period_start], ["2028-04-01", null]);
  assert.deepEqual([by(200006)[0].previous_month_period_start, by(200006)[0].previous_year_period_start], [null, null]);
  // G: zero previous COP => NULL percent, numeric change defined; NULL product_name sorts last among named products.
  assert.equal(by(200007)[0].manufacturing_cop_mom_change_percent, null); assert.equal(Number(by(200007)[0].manufacturing_cop_mom_change), 150 + 5 * 1.25 - 0);
  const named = cur.filter((r) => r.sku_id !== null); assert.equal(named.at(-1).product_name, null);
  // NULL sku_id current group is kept and never joins history (even though a NULL-sku_id previous-month group exists).
  const ns = cur.filter((r) => r.sku_id === null); assert.equal(ns.length, 1); assert.deepEqual([ns[0].previous_month_period_start, ns[0].previous_year_period_start], [null, null]);
  // H: only a non-governed prior run exists => no previous month.
  assert.equal(by(200008)[0].previous_month_period_start, null); assert.ok(cur.every((r) => r.snapshot_refresh_run_id === 5003 && r.snapshot_selection_basis === "APPROVED" && r.previous_month_selection_basis !== "APPROVED"));
  assert.ok(cur.filter((r) => r.previous_month_period_start).every((r) => r.previous_month_refresh_run_id === 5002 && r.previous_month_selection_basis === "DRAFT"));
  assert.ok(cur.every((r) => !/ALT/.test(r.product_name ?? "")), "non-governed alternate run never appears");
  // Total multiplicity: 20 fillers + A(2) + B(4) + C + D + E + F + G + H + NULL-sku = 33 (filler groups are single, no fan-out).
  assert.equal(cur.length, 20 + 2 + 4 + 1 + 1 + 1 + 1 + 1 + 1 + 1);
});

test("limit boundaries: sweep p_limit 1..total+3 on the extra period; candidate == installed == governed prefix (strict where the cut is not inside a sort-key tie; sort-key sequence + membership where it is)", () => {
  const full = J(q(`SELECT json_agg(t) FROM (SELECT product_name, sku_column_label, sku_id FROM public.${INST_NAME}('2028-05-01', 2000)) t;`));
  const total = full.length; const keyOf = (r) => JSON.stringify([r.product_name, r.sku_column_label, r.sku_id]);
  let tieCuts = 0, strictCuts = 0;
  for (let L = 1; L <= total + 3; L++) {
    const insideTie = L < total && keyOf(full[L - 1]) === keyOf(full[L]);
    const res = J(q(`
      DROP TABLE IF EXISTS sw_k, sw_i, sw_f;
      CREATE TABLE sw_k AS SELECT * FROM public.${NAME}('2028-05-01', ${L});
      CREATE TABLE sw_i AS SELECT * FROM public.${INST_NAME}('2028-05-01', ${L});
      CREATE TABLE sw_f AS SELECT * FROM public.${INST_NAME}('2028-05-01', 2000);
      SELECT json_build_object(
        'kn', (SELECT count(*) FROM sw_k), 'in', (SELECT count(*) FROM sw_i),
        'kseqEqFull', (SELECT json_agg(json_build_array(product_name, sku_column_label, sku_id)) FROM (SELECT * FROM sw_k) a)::text
                      = (SELECT json_agg(json_build_array(product_name, sku_column_label, sku_id)) FROM (SELECT * FROM (SELECT * FROM sw_f LIMIT ${L}) z) b)::text,
        'kInFull', (SELECT count(*) FROM (SELECT t::text FROM sw_k t EXCEPT ALL SELECT t::text FROM sw_f t) y),
        'iInFull', (SELECT count(*) FROM (SELECT t::text FROM sw_i t EXCEPT ALL SELECT t::text FROM sw_f t) y),
        'kMinusI', (SELECT count(*) FROM (SELECT t::text FROM sw_k t EXCEPT ALL SELECT t::text FROM sw_i t) y),
        'iMinusK', (SELECT count(*) FROM (SELECT t::text FROM sw_i t EXCEPT ALL SELECT t::text FROM sw_k t) y))::text;`));
    assert.equal(res.kn, Math.min(L, total), `rows at L=${L}`); assert.equal(res.in, res.kn);
    assert.equal(res.kseqEqFull, true, `sort-key sequence at L=${L}`);
    assert.equal(res.kInFull, 0, `candidate rows at L=${L} are all members of the full result bag`);
    assert.equal(res.iInFull, 0);
    if (insideTie) tieCuts++;
    else { strictCuts++; assert.equal(res.kMinusI, 0, `strict bag L=${L}`); assert.equal(res.iMinusK, 0, `strict bag L=${L}`); }
  }
  assert.ok(tieCuts >= 2 && strictCuts >= 30, `sweep exercised both tie-cuts (${tieCuts}) and strict cuts (${strictCuts})`);
  q("DROP TABLE IF EXISTS sw_k, sw_i, sw_f;");
  // And through the strict comparator at hand-picked boundaries that do not cut a tie: 1, the A/B boundary, total, 2000.
  for (const L of [1, 2, total, 2000]) assertParity("2028-05-01", L);
  // Base-fixture cap month: 2000 exact, plus 1999/2001 neighbours of the cap and a small limit.
  for (const L of [1, 5, 1999, 2000]) assertParity("2027-03-01", L);
});

test("run selection: draft vs approved, pointer flips, missing and period-mismatched pointers behave identically to the installed RPC and governed view (pointer restored afterwards)", () => {
  const set = (sql) => c.must(sql);
  const snapshot = c.must("SELECT json_agg(t ORDER BY period_start) FROM costing.fixture_governed_run t");
  try {
    // (a) current period governed run -> alternate DRAFT run 5903
    set("UPDATE costing.fixture_governed_run SET refresh_run_id = 5903, selection_basis = 'DRAFT' WHERE period_start = '2028-05-01'");
    assertParity("2028-05-01");
    const a = rows(NAME, "2028-05-01", 2000, "sku_id, product_name, snapshot_refresh_run_id, snapshot_selection_basis, snapshot_run_label");
    assert.equal(a.length, 3, "SKU 200001 fans out x2 through its two previous-year groups + SKU 200010");
    assert.ok(a.every((r) => r.snapshot_run_label === "DRAFT run 5903 - not approved"));
    assert.deepEqual(a.map((r) => r.product_name), ["FX Alpha ALT", "FX Alpha ALT", "FX Fill 010 ALT"]);
    // (b) same run flagged APPROVED
    set("UPDATE costing.fixture_governed_run SET selection_basis = 'APPROVED' WHERE period_start = '2028-05-01'");
    assertParity("2028-05-01"); assert.ok(rows(NAME, "2028-05-01").every((r) => r.snapshot_run_label === "Approved run 5903"));
    // (c) previous month approved instead of draft
    set("UPDATE costing.fixture_governed_run SET refresh_run_id = 5003, selection_basis = 'APPROVED' WHERE period_start = '2028-05-01'; UPDATE costing.fixture_governed_run SET selection_basis = 'APPROVED' WHERE period_start = '2028-04-01'");
    assertParity("2028-05-01"); assert.ok(rows(NAME, "2028-05-01").filter((r) => r.previous_month_period_start).every((r) => r.previous_month_selection_basis === "APPROVED"));
    // (d) previous-month pointer missing => previous month NULL everywhere; previous-year pointer missing => yoy NULL
    set("DELETE FROM costing.fixture_governed_run WHERE period_start = '2028-04-01'");
    assertParity("2028-05-01"); assert.ok(rows(NAME, "2028-05-01").every((r) => r.previous_month_period_start === null && r.previous_month_refresh_run_id === null));
    set("DELETE FROM costing.fixture_governed_run WHERE period_start = '2027-05-01'");
    assertParity("2028-05-01"); assert.ok(rows(NAME, "2028-05-01").every((r) => r.previous_year_period_start === null));
    // (e) current pointer missing => empty; pointer to a run belonging to another period => period mismatch => empty
    set("DELETE FROM costing.fixture_governed_run WHERE period_start = '2028-05-01'");
    assertParity("2028-05-01"); assert.equal(rows(NAME, "2028-05-01").length, 0);
    set("INSERT INTO costing.fixture_governed_run VALUES ('2028-05-01', 5002, 'DRAFT')");
    assertParity("2028-05-01"); assert.equal(rows(NAME, "2028-05-01").length, 0, "run 5002 belongs to 2028-04: period equality in the join rejects it");
  } finally {
    set("TRUNCATE costing.fixture_governed_run");
    set(`INSERT INTO costing.fixture_governed_run SELECT period_start, refresh_run_id, selection_basis FROM json_populate_recordset(NULL::costing.fixture_governed_run, '${snapshot}'::json)`);
  }
  assertParity("2028-05-01"); assert.equal(rows(NAME, "2028-05-01").length, 33, "fixture restored");
});

test("mutation self-tests against the CANDIDATE: each plausible keyset-first mistake is detected by the strict comparator", () => {
  const base = rd(FN_FILE);
  const mutants = {
    "collapse-dup-keys": [/FROM cur_pivot\n          ORDER BY product_name, sku_column_label, sku_id\n          LIMIT p_limit/, "FROM (SELECT DISTINCT ON (sku_id) * FROM cur_pivot ORDER BY sku_id, product_name, sku_column_label) cp\n          ORDER BY product_name, sku_column_label, sku_id\n          LIMIT p_limit", ["2028-05-01"]],
    "history-too-narrow": [/SELECT k\.sku_id FROM cur_keys k\)/, "SELECT k.sku_id FROM cur_keys k ORDER BY k.sku_id LIMIT 3)", ["2026-11-01"]],
    "yoy-offset-wrong": [/\(p_period_start - INTERVAL '1 year'\)::date\n                    \)/, "(p_period_start - INTERVAL '2 year')::date\n                    )", ["2026-11-01"]],
    "run-join-drops-period": [/ AND \(gr\.period_start = cost_sheet_line_monthly_snapshot\.snapshot_period_start\)/g, "", ["2026-11-01"]],
    "keys-limit-off-by-one": [/ORDER BY product_name, sku_column_label, sku_id\n          LIMIT p_limit\n        \), hist_pivot/, "ORDER BY product_name, sku_column_label, sku_id\n          LIMIT p_limit - 1\n        ), hist_pivot", ["2027-03-01"]],
    "keys-unordered": [/ORDER BY product_name, sku_column_label, sku_id\n          LIMIT p_limit\n        \), hist_pivot/, "ORDER BY sku_id DESC\n          LIMIT p_limit\n        ), hist_pivot", ["2027-03-01", "2028-05-01"]],
    "limit-before-order-drops-ordering": [/   ORDER BY product_name, sku_column_label, sku_id\n   LIMIT p_limit;/, "   ORDER BY sku_id DESC\n   LIMIT p_limit;", ["2026-11-01"]],
  };
  let i = 0;
  for (const [name, [re, rep, periods]] of Object.entries(mutants)) {
    const mutated = base.replace(re, rep);
    assert.notEqual(mutated, base, `${name}: mutation must change the source`);
    const fn = `${NAME.replace("v1", "mut" + i++)}`;
    c.must(mutated.replaceAll(NAME, fn));
    const sqlFile = join(HERE, "candidates/keyset-first/candidate-keyset-rpc.sql");
    const mutSql = rd(sqlFile).replace(NAME, fn);
    const tmp = join(process.env.TMPDIR || "/tmp", `ks-mut-${i}-${process.pid}.sql`);
    // write via psql-free path: inline temp file
    writeTmp(tmp, mutSql);
    const fails = periods.map((p) => compare(c, { baselineSql: INST, candidateSql: tmp, period: p, lim: 2000, tag: `mu${i}` }).pass);
    assert.ok(fails.some((x) => x === false), `${name} must be detected on at least one of ${periods.join(", ")} (got pass=${fails})`);
  }
});

import { writeFileSync, mkdirSync } from "node:fs";
function writeTmp(p, s) { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, s); }
