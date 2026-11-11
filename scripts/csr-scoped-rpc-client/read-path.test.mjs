// #273 client: offline unit + source-contract tests for the flag-gated scoped Cost Comparison read. No network, no DB.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPARISON_VIEW, COMPARISON_SCOPED_RPC, COMPARISON_ROW_LIMIT, COMPARISON_COLUMNS, COMPARISON_FLAG_NAME,
  readCostComparisonRows, scopedComparisonError,
} from "../../public/shared/js/costing-cost-comparison-read.js";
import { COSTING_CSR_SCOPED_COMPARISON_RPC_V1, isCostingCsrScopedComparisonRpcV1Enabled } from "../../public/shared/js/costing-feature-flags.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rd = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const row = (i) => Object.fromEntries(COMPARISON_COLUMNS.map((c) => [c, c === "sku_id" ? i : c === "product_name" ? `P${i}` : null]));

function mockSupabase({ viewResult = { data: [], error: null }, rpcResult = { data: [], error: null } } = {}) {
  const log = { from: [], chain: [], rpc: [] };
  const q = { select(a) { log.chain.push(["select", a]); return q; }, eq(c, v) { log.chain.push(["eq", c, v]); return q; },
    order(c, o) { log.chain.push(["order", c, o]); return q; }, limit(n) { log.chain.push(["limit", n]); return Promise.resolve(viewResult); } };
  return { log, from: (v) => { log.from.push(v); return q; }, rpc: (n, a) => { log.rpc.push([n, a]); return Promise.resolve(rpcResult); } };
}

test("flag is default OFF and only the exact value '1' enables it (failing storage is OFF)", () => {
  assert.equal(COSTING_CSR_SCOPED_COMPARISON_RPC_V1, "COSTING_CSR_SCOPED_COMPARISON_RPC_V1");
  assert.equal(COMPARISON_FLAG_NAME, COSTING_CSR_SCOPED_COMPARISON_RPC_V1);
  const mk = (v) => ({ getItem: () => v });
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled(mk(null)), false);
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled(mk(undefined)), false);
  for (const v of ["0", "true", "on", "", " 1", "11"]) assert.equal(isCostingCsrScopedComparisonRpcV1Enabled(mk(v)), false, v);
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled(mk("1")), true);
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled({ getItem() { throw new Error("blocked"); } }), false);
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled(undefined), false, "no localStorage in Node => OFF");
  assert.match(rd("public/shared/js/costing-feature-flags.js"), /export const COSTING_CSR_SCOPED_COMPARISON_RPC_V1[\s\S]*=== "1"/);
});

test("flag OFF: exactly the original view read (select *, period eq, product/label order, limit 2000), never the RPC", async () => {
  const rows = [row(1), row(2)];
  const s = mockSupabase({ viewResult: { data: rows, error: null } });
  const out = await readCostComparisonRows({ supabase: s, periodStart: "2026-11-01", scopedRpcEnabled: false });
  assert.deepEqual(s.log.from, [COMPARISON_VIEW]);
  assert.deepEqual(s.log.chain, [["select", "*"], ["eq", "snapshot_period_start", "2026-11-01"], ["order", "product_name", { ascending: true }], ["order", "sku_column_label", { ascending: true }], ["limit", 2000]]);
  assert.deepEqual(s.log.rpc, []);
  assert.deepEqual({ ...out, refreshedAt: undefined }, { rows, truncated: false, source: "view", refreshedAt: undefined });
  assert.ok(out.refreshedAt instanceof Date);
});

test("flag OFF treats anything but literal true as OFF (undefined, 1, 'true')", async () => {
  for (const v of [undefined, null, 1, "true", 0]) {
    const s = mockSupabase();
    await readCostComparisonRows({ supabase: s, periodStart: "2026-11-01", scopedRpcEnabled: v });
    assert.deepEqual(s.log.rpc, [], String(v));
  }
});

test("flag OFF: a view error is thrown unchanged (original behaviour, no mapping, no retry)", async () => {
  const err = { code: "57014", message: "canceling statement due to statement timeout" };
  const s = mockSupabase({ viewResult: { data: null, error: err } });
  await assert.rejects(readCostComparisonRows({ supabase: s, periodStart: "2026-11-01", scopedRpcEnabled: false }), (e) => e === err);
  assert.equal(s.log.from.length, 1, "one read, no retry");
});

test("flag ON: one RPC call with period and cap, never the view; rows returned as-is", async () => {
  const rows = [row(1), row(2), row(3)];
  const s = mockSupabase({ rpcResult: { data: rows, error: null } });
  const out = await readCostComparisonRows({ supabase: s, periodStart: "2026-11-01", scopedRpcEnabled: true });
  assert.deepEqual(s.log.rpc, [[COMPARISON_SCOPED_RPC, { p_period_start: "2026-11-01", p_limit: 2000 }]]);
  assert.deepEqual(s.log.from, []);
  assert.deepEqual({ ...out, refreshedAt: undefined }, { rows, truncated: false, source: "rpc", refreshedAt: undefined });
  assert.ok(out.refreshedAt instanceof Date);
  assert.equal(out.rows[0], rows[0], "no copying or relabelling of rows");
});

test("flag ON: empty period is an empty result, not an error", async () => {
  const s = mockSupabase({ rpcResult: { data: [], error: null } });
  const e0 = await readCostComparisonRows({ supabase: s, periodStart: "2025-11-01", scopedRpcEnabled: true });
  assert.deepEqual([e0.rows, e0.truncated, e0.source], [[], false, "rpc"]);
  const n = mockSupabase({ rpcResult: { data: null, error: null } });
  assert.deepEqual((await readCostComparisonRows({ supabase: n, periodStart: "2025-11-01", scopedRpcEnabled: true })).rows, []);
});

test("flag ON: 2000 rows => truncated=true (explicit), 1999 => false", async () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => row(i));
  assert.equal((await readCostComparisonRows({ supabase: mockSupabase({ rpcResult: { data: mk(2000), error: null } }), periodStart: "2026-11-01", scopedRpcEnabled: true })).truncated, true);
  assert.equal((await readCostComparisonRows({ supabase: mockSupabase({ rpcResult: { data: mk(1999), error: null } }), periodStart: "2026-11-01", scopedRpcEnabled: true })).truncated, false);
});

test("flag ON: invalid periods rejected before any network call", async () => {
  for (const p of ["2026-11-15", "2026-11", "11/01/2026", "", null, undefined, "2026-13-01x"]) {
    const s = mockSupabase();
    await assert.rejects(readCostComparisonRows({ supabase: s, periodStart: p, scopedRpcEnabled: true }), /first day of a month/, String(p));
    assert.deepEqual([s.log.rpc, s.log.from], [[], []]);
  }
});

test("flag ON: errors are mapped to safe messages, called once, NEVER retried and NEVER fall back to the view", async () => {
  const cases = [
    [{ code: "PGRST202", message: "Could not find the function public.rpc_x in the schema cache" }, /not available on this server.*COSTING_CSR_SCOPED_COMPARISON_RPC_V1/],
    [{ code: "42883", message: "function does not exist" }, /not available on this server/],
    [{ code: "42501", message: "permission denied for function rpc_x" }, /do not have permission/],
    [{ code: "P0001", message: "permission denied for module module:costing-control-center" }, /do not have permission/],
    [{ code: "P0001", message: "Not authenticated" }, /not signed in/],
    [{ code: "57014", message: "canceling statement due to statement timeout" }, /timed out.*not retried/],
    [{ code: "XX000", message: "boom" }, /^boom$/],
  ];
  for (const [err, re] of cases) {
    const s = mockSupabase({ rpcResult: { data: null, error: err } });
    await assert.rejects(readCostComparisonRows({ supabase: s, periodStart: "2026-11-01", scopedRpcEnabled: true }), (e) => re.test(e.message) && e.code === err.code);
    assert.equal(s.log.rpc.length, 1, `${err.code}: one call, no retry`);
    assert.equal(s.log.from.length, 0, `${err.code}: no silent fallback to the view`);
  }
  assert.doesNotMatch(scopedComparisonError({ code: "42501", message: "permission denied for schema costing" }).message, /costing|schema/i, "no internal object names leak to the UI");
});

test("flag ON: partial column sets and non-array shapes are refused, not rendered", async () => {
  const partial = row(1); delete partial.snapshot_run_label; delete partial.previous_year_selection_basis;
  await assert.rejects(readCostComparisonRows({ supabase: mockSupabase({ rpcResult: { data: [partial], error: null } }), periodStart: "2026-11-01", scopedRpcEnabled: true }), /missing 2 expected column/);
  await assert.rejects(readCostComparisonRows({ supabase: mockSupabase({ rpcResult: { data: { a: 1 }, error: null } }), periodStart: "2026-11-01", scopedRpcEnabled: true }), /unexpected shape/);
  const extra = { ...row(1), unexpected_new_column: 1 };
  assert.equal((await readCostComparisonRows({ supabase: mockSupabase({ rpcResult: { data: [extra], error: null } }), periodStart: "2026-11-01", scopedRpcEnabled: true })).rows.length, 1, "additive columns do not break the client");
});

test("the pinned 63 columns equal the public governed view in the W1 migration (names and order)", () => {
  const m = rd("supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql");
  const a = m.indexOf("create or replace view public.v_cost_sheet_snapshot_sku_monthly_comparison_governed as");
  const body = m.slice(a, m.indexOf(" from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed", a));
  const cols = body.slice(body.indexOf("select") + 6).replace(/\n/g, " ").split(",").map((c) => c.trim()).filter(Boolean);
  assert.equal(cols.length, 63);
  assert.deepEqual([...COMPARISON_COLUMNS], cols);
});

test("module has no writer, retry, abort or timeout wrapper; RPC name is a getter", () => {
  const src = rd("public/shared/js/costing-cost-comparison-read.js");
  assert.doesNotMatch(src, /readWithPgStatementTimeoutRetry|setTimeout|AbortController|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(COMPARISON_SCOPED_RPC, /^rpc_get_/, "matches the getter allowlist pattern of the WP12 RPC sweep");
  assert.equal((src.match(/supabase\.rpc\(/g) || []).length, 1);
});

test("shell integration: single flag-gated branch for the cost-comparison lens; original generic read is untouched", () => {
  const shell = rd("public/shared/js/costing-suite-shell.js");
  assert.equal((shell.match(/readCostComparisonRows\(/g) || []).length, 1);
  assert.match(shell, /if \(CURRENT_LENS === "cost-comparison" && isCostingCsrScopedComparisonRpcV1Enabled\(\)\) \{\s*const \{ rows, truncated, refreshedAt \} = await readCostComparisonRows\(\{\s*supabase,\s*periodStart: ACTIVE_PERIOD_START,\s*scopedRpcEnabled: true,/);
  // original lines still present, in order, after the gated branch
  const gated = shell.indexOf("isCostingCsrScopedComparisonRpcV1Enabled()) {");
  const original = shell.indexOf('let query = costingFrom(viewName).select("*");');
  assert.ok(gated > 0 && original > gated, "gated branch precedes the unchanged generic read");
  const tail = shell.slice(original, shell.indexOf("function uniqueValues("));
  assert.match(tail, /query = query\.eq\("snapshot_period_start", ACTIVE_PERIOD_START\)/);
  assert.match(tail, /\.order\("product_name", \{ ascending: true \}\)\s*\.order\("sku_column_label", \{ ascending: true \}\)/);
  assert.match(tail, /await query\.limit\(2000\)/);
  assert.match(shell, /"cost-comparison": "v_cost_sheet_snapshot_sku_monthly_comparison_governed"/);
  assert.match(shell, /if \(truncated\) \{\s*showToast\(/, "truncation is surfaced to the user");
});

test("release hygiene: this change set does not touch sw.js, other feature-flag defaults, or the original flag list", () => {
  const sw = rd("public/sw.js");
  assert.equal(sw.split("\n")[1].startsWith('const CACHE_NAME = "hub-cache-v393"'), true, "no cache bump in this PR (a release step for the owner)");
  const flags = rd("public/shared/js/costing-feature-flags.js");
  assert.equal((flags.match(/=== "1"/g) || []).length, 10, "ten earlier flags + the new one, all exact-'1'-only");
});
