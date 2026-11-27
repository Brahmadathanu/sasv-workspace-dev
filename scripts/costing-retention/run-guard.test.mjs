import test from "node:test";
import assert from "node:assert/strict";
import { createRunGuard, isRunReadable, RUN_GUARD_ERROR_CODES } from "../../public/shared/js/costing-run-guard.js";
import { parseRunDetailAvailability } from "../../public/shared/js/costing-run-detail-availability.js";

const av = (run, state, extra = {}) => ({ refresh_run_id: run, available: state.startsWith("AVAILABLE"), state, unverified: state === "AVAILABLE_UNVERIFIED", reason: null, ...extra });
function fakeSupabase({ states = {}, rows = {}, rpcRows = {}, availError = null, availThrows = false } = {}) {
  const log = { avail: 0, from: [], rpc: [] };
  const builder = (view) => {
    const q = { filters: {} };
    const b = {
      select() { return b; }, order() { return b; }, range() { return b; }, limit() { return b; },
      eq(c, v) { q.filters[c] = v; return b; },
      then(res, rej) { log.from.push({ view, filters: { ...q.filters } }); return Promise.resolve({ data: rows[q.filters.refresh_run_id] ?? [], error: null }).then(res, rej); },
    };
    return b;
  };
  return {
    log,
    from: builder,
    rpc(name, params) {
      if (name === "rpc_costing_run_detail_availability") {
        log.avail++;
        if (availThrows) throw new Error("net");
        if (availError) return Promise.resolve({ data: null, error: availError });
        return Promise.resolve({ data: states[params.p_refresh_run_id] ?? null, error: null });
      }
      log.rpc.push({ name, params });
      return Promise.resolve({ data: rpcRows[params.p_refresh_run_id] ?? [], error: null });
    },
  };
}

test("purged and purging runs: view reads return an explicit error and never hit the data view", async () => {
  for (const st of ["DETAILS_PURGED", "PURGE_IN_PROGRESS"]) {
    const sb = fakeSupabase({ states: { 87: av(87, st, { reason: "removed by retention" }) } });
    const g = createRunGuard({ supabase: sb });
    const res = await g.from("v_x").select("*").eq("period_start", "2026-09-01").eq("refresh_run_id", 87).order("sku_id");
    assert.equal(res.data, null);
    assert.equal(res.error.code, RUN_GUARD_ERROR_CODES.UNAVAILABLE);
    assert.match(res.error.message, /Run 87/);
    assert.equal(sb.log.from.length, 0, "no data query was issued");
  }
});
test("available (incl. unverified), in-progress and failed runs remain readable; metadata is not disabled", async () => {
  for (const st of ["AVAILABLE", "AVAILABLE_UNVERIFIED", "RUN_IN_PROGRESS", "DETAILS_INCOMPLETE", "INCOMPLETE"]) {
    const sb = fakeSupabase({ states: { 5: av(5, st) }, rows: { 5: [{ refresh_run_id: 5, sku_id: 1 }] } });
    const g = createRunGuard({ supabase: sb });
    const res = await g.from("v_x").select("*").eq("refresh_run_id", 5);
    assert.equal(res.error, null, st);
    assert.equal(res.data.length, 1);
  }
});
test("unknown / errored / thrown / malformed availability fails closed (unconfirmed), including contradictory run id", async () => {
  const cases = [
    fakeSupabase({}),                                              // null payload
    fakeSupabase({ availError: { message: "boom" } }),
    fakeSupabase({ availThrows: true }),
    fakeSupabase({ states: { 9: { available: true } } }),          // malformed
    fakeSupabase({ states: { 9: av(10, "AVAILABLE") } }),          // answer about a different run
    fakeSupabase({ states: { 9: av(9, "UNKNOWN_RUN") } }),
  ];
  for (const sb of cases) {
    const g = createRunGuard({ supabase: sb });
    const res = await g.from("v_x").select("*").eq("refresh_run_id", 9);
    assert.equal(res.data, null);
    assert.equal(res.error.code, RUN_GUARD_ERROR_CODES.UNCONFIRMED);
    assert.equal(sb.log.from.length, 0);
  }
});
test("rows for a different run are rejected (view and rpc)", async () => {
  const sb = fakeSupabase({ states: { 5: av(5, "AVAILABLE") }, rows: { 5: [{ refresh_run_id: 5 }, { refresh_run_id: 6 }] }, rpcRows: { 5: { refresh_run_id: 7 } } });
  const g = createRunGuard({ supabase: sb });
  const v = await g.from("v_x").select("*").eq("refresh_run_id", 5);
  assert.equal(v.error.code, RUN_GUARD_ERROR_CODES.MISMATCH); assert.equal(v.data, null);
  const r = await g.rpc("rpc_get_something", { p_refresh_run_id: 5 });
  assert.equal(r.error.code, RUN_GUARD_ERROR_CODES.MISMATCH);
});
test("rpc gating: only exact-run read families; writers, approval and the probe itself are untouched; null/default context passes", async () => {
  const sb = fakeSupabase({ states: { 87: av(87, "DETAILS_PURGED") } });
  const g = createRunGuard({ supabase: sb });
  assert.equal((await g.rpc("rpc_get_material_rate_rm_cost_trace", { p_refresh_run_id: 87 })).error.code, RUN_GUARD_ERROR_CODES.UNAVAILABLE);
  assert.equal((await g.rpc("rpc_export_material_rate_pm_cost_trace", { p_refresh_run_id: 87 })).error.code, RUN_GUARD_ERROR_CODES.UNAVAILABLE);
  assert.equal((await g.rpc("rpc_preview_production_overhead_workload", { p_refresh_run_id: 87 })).error.code, RUN_GUARD_ERROR_CODES.UNAVAILABLE);
  const before = sb.log.rpc.length;
  await g.rpc("rpc_costing_approve_run", { p_refresh_run_id: 87 });           // server-side gate owns approval
  await g.rpc("rpc_refresh_sku_prime_cost_snapshot", { p_refresh_run_id: 87 }); // writer: never guarded here
  assert.equal(sb.log.rpc.length, before + 2);
  const nullCtx = await g.rpc("rpc_get_material_rate_rm_cost_trace", { p_period_start: "2026-11-01", p_refresh_run_id: null });
  assert.equal(nullCtx.error, null);
  const probe = await g.rpc("rpc_costing_run_detail_availability", { p_refresh_run_id: 87 });
  assert.equal(probe.error, null);
});
test("availability is cached briefly, de-duplicated in flight, and re-probed after expiry or invalidation", async () => {
  let t = 0; const sb = fakeSupabase({ states: { 5: av(5, "AVAILABLE") }, rows: { 5: [{ refresh_run_id: 5 }] } });
  const g = createRunGuard({ supabase: sb, ttlMs: 1000, now: () => t });
  await Promise.all([g.from("v").select("*").eq("refresh_run_id", 5), g.from("v").select("*").eq("refresh_run_id", 5), g.rpc("rpc_get_x", { p_refresh_run_id: 5 })]);
  assert.equal(sb.log.avail, 1);
  await g.from("v").select("*").eq("refresh_run_id", 5); assert.equal(sb.log.avail, 1);
  t = 1500; await g.from("v").select("*").eq("refresh_run_id", 5); assert.equal(sb.log.avail, 2);
  g.invalidate(5); await g.from("v").select("*").eq("refresh_run_id", 5); assert.equal(sb.log.avail, 3);
});
test("a run that becomes purged between two requests is blocked on the second (stale-state race)", async () => {
  let t = 0; const states = { 5: av(5, "AVAILABLE") }; const sb = fakeSupabase({ states, rows: { 5: [{ refresh_run_id: 5 }] } });
  const g = createRunGuard({ supabase: sb, ttlMs: 1000, now: () => t });
  assert.equal((await g.from("v").select("*").eq("refresh_run_id", 5)).error, null);
  states[5] = av(5, "DETAILS_PURGED"); t = 2000;
  assert.equal((await g.from("v").select("*").eq("refresh_run_id", 5)).error.code, RUN_GUARD_ERROR_CODES.UNAVAILABLE);
});
test("queries without a run filter are untouched; isRunReadable semantics", async () => {
  const sb = fakeSupabase({ rows: { undefined: [{ a: 1 }] } });
  const g = createRunGuard({ supabase: sb });
  const res = await g.from("v_period").select("*").eq("period_start", "2026-11-01");
  assert.equal(sb.log.avail, 0); assert.equal(res.error, null);
  assert.equal(isRunReadable(parseRunDetailAvailability({ available: true, state: "AVAILABLE" })), true);
  assert.equal(isRunReadable(parseRunDetailAvailability({ available: false, state: "DETAILS_PURGED" })), false);
  assert.equal(isRunReadable(null), false);
});
