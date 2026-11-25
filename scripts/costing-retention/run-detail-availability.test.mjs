import test from "node:test";
import assert from "node:assert/strict";
import { parseRunDetailAvailability, fetchRunDetailAvailability, resolveRunSelection, isRunDetailsUnavailableError }
  from "../../public/shared/js/costing-run-detail-availability.js";

const avail = (o) => ({ refresh_run_id: 5, available: true, state: "AVAILABLE", unverified: false, ...o });

test("available payloads pass through", () => {
  assert.equal(parseRunDetailAvailability(avail()).available, true);
  const u = parseRunDetailAvailability(avail({ state: "AVAILABLE_UNVERIFIED", unverified: true }));
  assert.equal(u.available, true); assert.equal(u.unverified, true);
});
test("every non-available server state is blocked with an explicit message", () => {
  for (const state of ["DETAILS_PURGED", "PURGE_IN_PROGRESS", "RUN_IN_PROGRESS", "DETAILS_INCOMPLETE", "INCOMPLETE", "UNKNOWN_RUN"]) {
    const a = parseRunDetailAvailability({ refresh_run_id: 9, available: false, state, reason: null });
    assert.equal(a.available, false, state); assert.ok(a.message.length > 10, state);
  }
  assert.match(parseRunDetailAvailability({ available: false, state: "DETAILS_PURGED", reason: "custom server reason" }).message, /custom server reason/);
});
test("fail closed on malformed, contradictory or missing payloads", () => {
  for (const bad of [null, undefined, {}, "x", { available: "true", state: "AVAILABLE" }, { available: true }, { available: true, state: "" }]) {
    assert.equal(parseRunDetailAvailability(bad).available, false);
  }
  // server says available:true but state says purged -> still blocked
  assert.equal(parseRunDetailAvailability({ available: true, state: "DETAILS_PURGED" }).available, false);
  // available:false with an 'AVAILABLE' state is contradictory -> blocked/UNKNOWN
  const c = parseRunDetailAvailability({ available: false, state: "AVAILABLE" });
  assert.equal(c.available, false); assert.equal(c.state, "UNKNOWN");
});
test("RPC errors and thrown errors never become availability", async () => {
  assert.equal((await fetchRunDetailAvailability({ rpc: async () => ({ data: null, error: { message: "boom" } }) }, 5)).available, false);
  assert.equal((await fetchRunDetailAvailability({ rpc: async () => { throw new Error("net"); } }, 5)).available, false);
  assert.equal((await fetchRunDetailAvailability({ rpc: async () => ({ data: avail(), error: null }) }, null)).available, false);
  const calls = [];
  const ok = await fetchRunDetailAvailability({ rpc: async (n, a) => { calls.push([n, a]); return { data: avail(), error: null }; } }, 5);
  assert.equal(ok.available, true);
  assert.deepEqual(calls, [["rpc_costing_run_detail_availability", { p_refresh_run_id: 5 }]]);
});
test("run selection honours the requested run or blocks - no silent fallback", () => {
  const purged = parseRunDetailAvailability({ refresh_run_id: 87, available: false, state: "DETAILS_PURGED" });
  const r = resolveRunSelection(87, purged);
  assert.equal(r.blocked, true); assert.equal(r.selectedRunId, null); assert.equal(r.blockedRunId, 87);
  const ok = resolveRunSelection(143, parseRunDetailAvailability(avail({ refresh_run_id: 143 })));
  assert.deepEqual([ok.blocked, ok.selectedRunId], [false, 143]);
  assert.equal(resolveRunSelection(undefined, parseRunDetailAvailability(avail())).blocked, true);
  assert.equal(resolveRunSelection(1, undefined).blocked, true);
});
test("server exception text is recognised", () => {
  assert.equal(isRunDetailsUnavailableError(new Error("RUN_DETAILS_UNAVAILABLE: run 87 is DETAILS_PURGED")), true);
  assert.equal(isRunDetailsUnavailableError({ message: "other" }), false);
  assert.equal(isRunDetailsUnavailableError(null), false);
});
