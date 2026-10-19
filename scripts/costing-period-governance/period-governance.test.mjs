// node --test scripts/costing-period-governance/period-governance.test.mjs
// Rows/contexts in w2_local_snapshots.json were captured from the local W2 database during the lifecycle
// (capture_client_snapshots.py: Nov opened, BLOCKED run 140, run 141 approved, lock, reopen, authorise, run 144, supersede, close).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  allowedActions, openNextAction, validateActionInput, rpcCall, preflightModeFor, describePreflight,
  friendlyError, monthLabel, createPeriodGovernancePanel, OWNER_ONLY, RPC,
} from "../../public/shared/js/costing-period-governance.js";

const S = JSON.parse(readFileSync(new URL("./w2_local_snapshots.json", import.meta.url)));
const row = (stage, p = "2026-11-01") => S[stage].rows.find((r) => String(r.period_start).slice(0, 10) === p);
const ids = (acts) => acts.map((a) => `${a.id}${a.enabled ? "" : "(off)"}${a.runId ? ":" + a.runId : ""}`);
const ctx = (stage, who) => S[stage].ctx[who];

test("contexts: owner / editor / viewer resolved by the database", () => {
  const c = S.initial.ctx;
  assert.deepEqual([c.owner.is_owner, c.owner.can_edit], [true, true]);
  assert.deepEqual([c.editor.is_owner, c.editor.can_edit], [false, true]);
  assert.deepEqual([c.viewer.is_owner, c.viewer.can_edit, c.viewer.can_view], [false, false, true]);
  assert.equal(c.owner.next_period_start, "2026-11-01");
  assert.equal(c.owner.default_valuation_date, "2026-11-01");
});

test("open next month: editors and owner only; default valuation date offered", () => {
  const a = openNextAction(ctx("initial", "editor"));
  assert.equal(a.periodStart, "2026-11-01");
  assert.equal(a.defaultValuationDate, "2026-11-01");
  assert.match(a.label, /Nov 2026/);
  assert.equal(openNextAction(ctx("initial", "viewer")), null);
});

test("viewer sees no actions on any month", () => {
  for (const stage of Object.keys(S).filter((k) => S[k].rows)) {
    for (const r of S[stage].rows) assert.deepEqual(allowedActions(ctx(stage, "viewer"), r), []);
  }
});

test("editor never sees owner-only actions", () => {
  for (const stage of Object.keys(S).filter((k) => S[k].rows)) {
    for (const r of S[stage].rows) {
      for (const a of allowedActions(ctx(stage, "editor"), r)) assert.ok(!OWNER_ONLY.has(a.id), `${stage} ${a.id}`);
    }
  }
});

test("Nov open with draft runs: owner may approve latest run 141; lock waits for approval; close waits for lock", () => {
  assert.deepEqual(ids(allowedActions(ctx("nov_open_drafts", "owner"), row("nov_open_drafts"))), ["approve:141", "lock(off)", "close(off)"]);
  assert.deepEqual(ids(allowedActions(ctx("nov_open_drafts", "editor"), row("nov_open_drafts"))), ["lock(off)"]);
});

test("active run disables approve", () => {
  const acts = allowedActions(ctx("nov_active_run", "owner"), row("nov_active_run"));
  const ap = acts.find((a) => a.id === "approve");
  assert.equal(ap.enabled, false);
  assert.match(ap.reason, /Run 142 is running/);
});

test("after approval: approve gone (supersede instead), lock on, authorise on, supersede offered for the newer draft", () => {
  const acts = ids(allowedActions(ctx("nov_approved", "owner"), row("nov_approved")));
  assert.deepEqual(acts, ["approve(off)", "lock:141", "authorise:141", "supersede:142", "close(off)"]);
});

test("locked: editor may reopen; owner may reopen or close", () => {
  assert.deepEqual(ids(allowedActions(ctx("nov_locked", "editor"), row("nov_locked"))), ["reopen"]);
  assert.deepEqual(ids(allowedActions(ctx("nov_locked", "owner"), row("nov_locked"))), ["reopen", "close:141"]);
});

test("after authorise + new run 144: supersede targets 144", () => {
  const sup = allowedActions(ctx("nov_newer_draft", "owner"), row("nov_newer_draft")).find((a) => a.id === "supersede");
  assert.equal(sup.runId, 144);
  assert.equal(sup.enabled, true);
});

test("after supersession: run 144 approved, nothing to supersede", () => {
  const acts = ids(allowedActions(ctx("nov_superseded", "owner"), row("nov_superseded")));
  assert.deepEqual(acts, ["approve(off)", "lock:144", "authorise:144", "supersede(off)", "close(off)"]);
});

test("closed month is final: no actions for anyone", () => {
  for (const who of ["owner", "editor", "viewer"]) assert.deepEqual(allowedActions(ctx("nov_closed", who), row("nov_closed")), []);
});

test("September (LOCKED, live state) offers owner reopen/close only - panel never acts without a click", () => {
  assert.deepEqual(ids(allowedActions(ctx("initial", "owner"), row("initial", "2026-09-01"))), ["reopen", "close:122"]);
});

test("preflight display: BLOCKED run fails with a clear summary; good run lists REVIEW_REQUIRED count", () => {
  const b = describePreflight(S.preflight_blocked);
  assert.equal(b.ok, false);
  assert.deepEqual(b.rows.filter((r) => !r.pass).map((r) => r.code), ["NO_BLOCKED_SKUS"]);
  assert.match(b.summary, /1 check failed/);
  const g = describePreflight(S.preflight_ok);
  assert.equal(g.ok, true);
  assert.match(g.summary, /627 SKUs \(37 REVIEW_REQUIRED will be recorded\)/);
  const s = describePreflight(S.preflight_supersede);
  assert.equal(s.ok, true);
  assert.ok(s.rows.some((r) => r.code === "SUPERSESSION_AUTHORISATION_CONSUMED" && r.pass));
});

test("input validation: reason >= 10 chars, approval reference, valuation date inside month", () => {
  assert.equal(validateActionInput({ reason: "short", approvalReference: "" }).length, 2);
  assert.deepEqual(validateActionInput({ reason: "Month-end costing approval", approvalReference: "MEET-1" }), []);
  assert.equal(validateActionInput({ reason: "Month-end costing approval", approvalReference: "MEET-1", valuationDate: "2026-12-01", periodStart: "2026-11-01" }).length, 1);
});

test("rpc mapping uses only the governed W2 RPCs with trimmed text", () => {
  const input = { reason: "  Approve November run  ", approvalReference: " REF-9 " };
  assert.deepEqual(rpcCall({ id: "approve", runId: 141 }, row("nov_open_drafts"), input),
    { name: RPC.approve, params: { p_refresh_run_id: 141, p_reason: "Approve November run", p_approval_reference: "REF-9" } });
  assert.deepEqual(rpcCall({ id: "close" }, row("nov_locked"), input).params.p_period_start, row("nov_locked").period_start);
  assert.deepEqual(rpcCall({ id: "open" }, null, { ...input, valuationDate: null }).params.p_valuation_date, null);
  assert.equal(rpcCall({ id: "supersede", runId: 144 }, row("nov_newer_draft"), input).name, "rpc_costing_supersede_approved_run");
  assert.equal(preflightModeFor("approve"), "APPROVE");
  assert.equal(preflightModeFor("supersede"), "SUPERSEDE");
  assert.equal(preflightModeFor("lock"), null);
});

test("friendly errors", () => {
  assert.equal(friendlyError({ message: "W2_OWNER_ONLY: this action is reserved for the costing owner" }), "Only the costing owner can do this.");
  assert.equal(friendlyError({ message: "W2_CLOSE_REQUIRES_LOCKED: period 2026-11-01 is OPEN" }), "period 2026-11-01 is OPEN");
  assert.equal(friendlyError({ message: "Permission denied for module:costing-control-center (edit=t)" }), "You do not have permission for this action.");
  assert.equal(monthLabel("2026-11-01"), "Nov 2026");
});

test("panel button hidden for users without view permission; shown on Control Center for viewers", async () => {
  const made = [];
  const fakeDoc = { createElement: (t) => { const n = { tagName: t, hidden: false, attrs: {}, className: "", listeners: {}, setAttribute(k, v) { this.attrs[k] = v; if (k === "hidden") this.hidden = true; }, addEventListener(k, f) { this.listeners[k] = f; }, append() {} }; made.push(n); return n; } };
  const anchor = { insertAdjacentElement: () => {} };
  const mk = (data) => createPeriodGovernancePanel({ supabase: { rpc: async () => ({ data, error: null }) }, anchor, doc: fakeDoc });
  const p1 = mk({ can_view: false });
  await p1.setVisible(true);
  assert.equal(made.at(-1).hidden, true);
  const p2 = mk(ctx("initial", "viewer"));
  await p2.setVisible(true);
  assert.equal(made.at(-1).hidden, false);
  await p2.setVisible(false);
  assert.equal(made.at(-1).hidden, true);
});
