// CSR scoped read RPC proposal: exact-source transform, permission guards and synthetic-period semantics.
// This test does NOT compile PostgreSQL PL/pgSQL, execute production SQL, benchmark performance, or prove RLS.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const source = read("supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql");
const proposed = read("docs/master-data-costing/evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql");
const sourceAnchor = "create or replace view costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed as";
assert.equal(source.split(sourceAnchor).length, 2, "one authoritative original view");
const start = source.indexOf(sourceAnchor);
const end = source.indexOf(";\n", start);
assert.ok(end > start, "original view terminates");
let expected = source.slice(start + sourceAnchor.length, end).trim();
const sourceScan = "FROM (costing.cost_sheet_line_monthly_snapshot";
assert.equal(expected.split(sourceScan).length, 2, "one snapshot scan to scope");
expected = expected.replace(sourceScan, `FROM ((SELECT *
                    FROM costing.cost_sheet_line_monthly_snapshot
                    WHERE snapshot_period_start IN (
                      p_period_start,
                      (p_period_start - INTERVAL '1 month')::date,
                      (p_period_start - INTERVAL '1 year')::date
                    )) cost_sheet_line_monthly_snapshot`);
const sourceTail = "   FROM comparison";
assert.equal(expected.split(sourceTail).length, 2, "one comparison output");
expected = expected.replace(sourceTail, `${sourceTail}
   WHERE snapshot_period_start = p_period_start
   ORDER BY product_name, sku_column_label, sku_id
   LIMIT p_limit`);
const queryMatch = proposed.match(/\bRETURN QUERY\s*\n([\s\S]*?);\s*\nEND;\s*\n\$csr\$;/);
assert.ok(queryMatch, "RPC contains exactly one complete return-query body");
assert.equal(queryMatch[1].trim(), expected.trim(), "every original pivot, arithmetic, join, output field and run label remains byte-identical except two period filters, ordering, cap");
const checks = [
  [/IF auth\.uid\(\) IS NULL THEN/, "signed-in check"],
  [/PERFORM public\.require_permission\('module:costing-control-center', false\)/, "CCC view permission"],
  [/p_period_start <> date_trunc\('month', p_period_start::timestamp\)::date/, "first day of month validation"],
  [/p_limit < 1 OR p_limit > 2000/, "limit bounds"],
  [/SECURITY DEFINER/, "definer declaration requires separate staging review"],
  [/SET search_path = pg_catalog, public, costing, pg_temp/, "pinned path"],
  [/REVOKE ALL ON FUNCTION public\.rpc_get_cost_sheet_sku_monthly_comparison_scoped\(date,integer\) FROM PUBLIC/, "revoke PUBLIC"],
  [/REVOKE ALL ON FUNCTION public\.rpc_get_cost_sheet_sku_monthly_comparison_scoped\(date,integer\) FROM anon/, "revoke anon"],
  [/GRANT EXECUTE ON FUNCTION public\.rpc_get_cost_sheet_sku_monthly_comparison_scoped\(date,integer\) TO authenticated/, "grant authenticated"],
  [/to_regprocedure\('public\.rpc_get_cost_sheet_sku_monthly_comparison_scoped\(date,integer\)'\) IS NOT NULL/, "reject preexisting signature"],
  [/63adf7946b8d7f99a01a05e5e54d00be/, "view hash guard"],
  [/^BEGIN;[\s\S]*\nCOMMIT;\s*$/m, "atomic create and grants"],
];
for (const [pattern, name] of checks) assert.match(proposed, pattern, name);
assert.equal((proposed.match(/\bRETURN QUERY\b/g) || []).length, 1);
for (const pattern of [/\bINSERT\s+INTO\b/i, /\bDELETE\s+FROM\b/i, /\bUPDATE\s+costing\./i, /\bTRUNCATE\s+TABLE\b/i]) {
  assert.doesNotMatch(queryMatch[1], pattern, "no snapshot mutations in return query");
}

// Model equivalence of scope-filter transformation for synthetic selected-run snapshots.
// This is NOT PostgreSQL execution and cannot establish 63-column SQL parity.
const snapshots = [
  ["2026-11-01", 149, 1, 100], ["2026-11-01", 149, 2, 200],
  ["2026-11-01", 148, 1, 999], // unapproved November run must not leak
  ["2026-10-01", 143, 1, 90], ["2026-10-01", 143, 2, 180],
  ["2026-10-01", 145, 1, 888], // newer draft must not replace Oct approved
  ["2026-09-01", 122, 1, 80],
  ["2025-10-01", 19, 1, 75],
  ["2026-08-01", 119, 1, 70], // unrelated period excluded from scoped input
];
const designated = new Map([
  ["2026-11-01", { run: 149, basis: "LATEST_SUCCESS" }],
  ["2026-10-01", { run: 143, basis: "APPROVED" }],
  ["2026-09-01", { run: 122, basis: "APPROVED" }],
  ["2025-10-01", { run: 19, basis: "APPROVED" }],
  ["2026-08-01", { run: 119, basis: "APPROVED" }],
]);
function monthOffset(date, months) {
  const [y, m] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1 + months, 1));
  return value.toISOString().slice(0, 10);
}
function comparison(period, scoped) {
  const periods = new Set([period, monthOffset(period, -1), monthOffset(period, -12)]);
  const rows = snapshots.filter(([p, run]) => {
    const chosen = designated.get(p);
    return chosen && chosen.run === run && (!scoped || periods.has(p));
  });
  const byPeriodSku = new Map(rows.map(([p, , sku, value]) => [`${p}:${sku}`, value]));
  return rows.filter(([p]) => p === period).map(([p, run, sku, value]) => ({
    sku, value, run, basis: designated.get(p).basis,
    priorMonth: byPeriodSku.get(`${monthOffset(period, -1)}:${sku}`) ?? null,
    priorYear: byPeriodSku.get(`${monthOffset(period, -12)}:${sku}`) ?? null,
  })).sort((a, b) => a.sku - b.sku);
}
for (const period of ["2026-11-01", "2026-10-01", "2026-09-01", "2025-11-01", "2026-08-01"]) {
  assert.deepEqual(comparison(period, true), comparison(period, false), `${period}: scoped period matches all-period model`);
}
assert.deepEqual(comparison("2026-11-01", true), [
  { sku: 1, value: 100, run: 149, basis: "LATEST_SUCCESS", priorMonth: 90, priorYear: null },
  { sku: 2, value: 200, run: 149, basis: "LATEST_SUCCESS", priorMonth: 180, priorYear: null },
]);
console.log("PASS: exact source SELECT transform, permission/transaction guards, 5 synthetic period cases (not SQL compilation or live parity)");
