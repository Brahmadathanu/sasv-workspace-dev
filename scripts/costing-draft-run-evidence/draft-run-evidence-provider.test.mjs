// CDE-1b (proposed, unconnected): RPC provider adapter. Mock-backed; the mock server shape follows CDE2_OWNER_REVIEW_PACKAGE §3.
// SYNTHETIC test data only. No network, no Supabase. Real server behaviour is NOT TESTED: the RPC does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ev from "../../public/shared/js/costing-draft-run-evidence.js";
import * as pv from "../../public/shared/js/costing-draft-run-evidence-provider.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel) => read(rel).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"); // comments removed: only executable text is counted
const REQ = { periodStart: "2026-10-01", runId: "148", skuId: "41" };
const record = (extra = {}) => ({
  period_start: "2026-10-01", refresh_run_id: 148, sku_id: 41, valuation_date: "2026-10-31", refreshed_at: "2026-11-02T04:30:00Z",
  material_costing_status: "READY", direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "NO_SKU_SALES_IN_LOOKBACK",
  allocation_basis_status: "REVIEW_REQUIRED", allocation_resolution_status: null, allocation_resolution_note: null, direct_labour_component_model_code: null,
  internal_material_conversion_status: "READY", first_control_status: "DIRECT_LABOUR_REVIEW_REQUIRED", control_severity: "REVIEW", blocker_note: null,
  regional: { IK: { regional_basis_source: "REGIONAL_ACTUAL_UNITS", regional_basis_status: "READY", marketing_expense_allocation_status: "READY", note: null },
    OK: { regional_basis_source: "REGION_SCALED_COMMON_BASIS", regional_basis_status: "REVIEW_REQUIRED", marketing_expense_allocation_status: "REVIEW_REQUIRED", note: null } },
  ...extra,
});
const caller = (response, calls = []) => async (name, args) => { calls.push({ name, args }); if (response instanceof Error) throw response; return typeof response === "function" ? response(name, args) : response; };

test("sends exactly one read RPC with typed arguments and returns an ok envelope unchanged", async () => {
  const calls = [];
  const p = pv.createDraftRunEvidenceRpcProvider({ callRpc: caller({ data: { status: "ok", record: record() }, error: null }, calls) });
  const answer = await p.readSkuEvidence(REQ);
  assert.deepEqual(calls, [{ name: "rpc_get_costing_draft_component_evidence_v1", args: { p_period_start: "2026-10-01", p_refresh_run_id: 148, p_sku_id: 41 } }]);
  assert.equal(answer.status, "ok");
  assert.equal(answer.record.sku_id, 41);
});

test("invalid requests never reach the server (bad date, non-integer, zero, negative, oversized, injection-like)", async () => {
  const calls = [];
  const p = pv.createDraftRunEvidenceRpcProvider({ callRpc: caller({ data: null, error: null }, calls) });
  for (const bad of [{ ...REQ, periodStart: "2026-10" }, { ...REQ, periodStart: "2026-10-01'; drop" }, { ...REQ, runId: "0" }, { ...REQ, runId: "-3" }, { ...REQ, runId: "1.5" },
    { ...REQ, skuId: "abc" }, { ...REQ, skuId: "" }, { ...REQ, skuId: "9".repeat(30) }, {}, undefined]) {
    const a = await p.readSkuEvidence(bad);
    assert.equal(a.status, "error", JSON.stringify(bad));
  }
  assert.equal(calls.length, 0);
});

test("envelope statuses map through; transport failures are classified, never leaked as evidence", async () => {
  const run = async (response) => pv.createDraftRunEvidenceRpcProvider({ callRpc: caller(response) }).readSkuEvidence(REQ);
  for (const s of ["empty", "forbidden", "stale", "foreign-run"]) assert.equal((await run({ data: { status: s }, error: null })).status, s);
  assert.equal((await run({ data: [], error: null })).status, "empty");
  assert.equal((await run({ data: null, error: null })).status, "empty");
  assert.equal((await run({ data: null, error: { code: "42501", message: "permission denied for function" } })).status, "forbidden");
  const timeout = await run({ data: null, error: { code: "57014", message: "canceling statement" } });
  assert.equal(timeout.status, "error"); assert.match(timeout.error, /timed out/);
  const absent = await run({ data: null, error: { code: "PGRST202", message: "Could not find the function public.rpc_get_costing_draft_component_evidence_v1" } });
  assert.equal(absent.status, "error"); assert.match(absent.error, /not available/);
  assert.equal((await run(new Error("network down"))).status, "error");
  for (const odd of [{ data: { status: "READY" } }, { data: { status: "ok" } }, { data: { status: "ok", record: [] } }, { data: "x" }, { data: [{ status: "ok" }, { status: "ok" }] }])
    assert.equal((await run({ ...odd, error: null })).status, "error", JSON.stringify(odd));
});

test("server error text is never echoed to the user (no existence disclosure)", async () => {
  const a = await pv.createDraftRunEvidenceRpcProvider({ callRpc: caller({ data: null, error: { code: "P0001", message: "run 148 does not belong to SKU 41 secret detail" } }) }).readSkuEvidence(REQ);
  assert.equal(a.status, "error"); assert.doesNotMatch(JSON.stringify(a), /secret|148|SKU 41/);
});

test("contract guard: monetary/personal keys and numbers outside identity are rejected, at any depth", async () => {
  const p = (rec) => pv.createDraftRunEvidenceRpcProvider({ callRpc: caller({ data: { status: "ok", record: rec }, error: null }) }).readSkuEvidence(REQ);
  for (const bad of [record({ material_cost_per_sku: 100 }), record({ selected_rate: "55" }), record({ regional: { IK: { note: null, marketing_amount: 5 }, OK: {} } }),
    record({ blocker_note: null, allocation_reason_code: 7 }), record({ regional: { IK: { regional_basis_status: 3 }, OK: {} } }), record({ approver_email: "a@b" }), record({ sales_units: "x" })]) {
    const a = await p(bad);
    assert.equal(a.status, "error", JSON.stringify(Object.keys(bad)));
    assert.match(a.error, /rejected/);
  }
  assert.equal((await p(record())).status, "ok", "the legitimate contract record passes (material_costing_status is not a cost field)");
});

test("end to end through the real CDE-1a loader: ok normalises with nulls kept UNKNOWN, foreign run is rejected, stale/forbidden surface", async () => {
  const ctx = { context: { periodStart: "2026-10-01", runId: "148", runKind: "draft", allowedRunIds: ["143", "148"] }, row: { period_start: "2026-10-01", refresh_run_id: 148, sku_id: 41 } };
  const make = (response) => ev.createDraftRunEvidenceLoader({ getCurrentContext: () => ctx, getProvider: () => pv.createDraftRunEvidenceRpcProvider({ callRpc: caller(response) }) });
  const request = ev.resolveDraftEvidenceRequest(ctx.context, ctx.row);
  let l = make({ data: { status: "ok", record: record({ blocker_note: null }) }, error: null });
  await l.load(request);
  const ok = l.stateFor(request);
  assert.equal(ok.status, ev.DRAFT_EVIDENCE_STATUS.OK);
  assert.equal(ok.record.blocker_note, null);
  assert.equal(ok.record.direct_labour_component_model_code, null, "absent field stays null (UNKNOWN), never READY");
  l = make({ data: { status: "ok", record: record({ refresh_run_id: 149 }) }, error: null });
  await l.load(request);
  assert.equal(l.stateFor(request).status, ev.DRAFT_EVIDENCE_STATUS.FOREIGN_RUN);
  for (const [server, expected] of [["forbidden", "forbidden"], ["stale", "stale"], ["empty", "empty"]]) {
    l = make({ data: { status: server }, error: null }); await l.load(request);
    assert.equal(l.stateFor(request).status, expected);
  }
});

test("a caller is required and this module can never reach another function name", () => {
  assert.throws(() => pv.createDraftRunEvidenceRpcProvider({}), TypeError);
  assert.throws(() => pv.createDraftRunEvidenceRpcProvider());
  const src = code("public/shared/js/costing-draft-run-evidence-provider.js");
  assert.equal([...src.matchAll(/callRpc\(/g)].length, 1, "exactly one call site");
  assert.ok(!/from\s+["'][^"']*supabase[^"']*["']/i.test(src) && !/\bcostingFrom\b|\bcostingRpc\b|\bfetch\(/.test(src), "no client import, no direct data access");
});

test("NOT CONNECTED: no application source calls connectDraftRunEvidenceProvider or setDraftRunEvidenceProvider; the production holder is still null", () => {
  const roots = ["public", "js", "electron"].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
  const hits = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(f); } else if (/\.(js|mjs|html)$/.test(e.name)) {
      const t = fs.readFileSync(f, "utf8");
      if (/connectDraftRunEvidenceProvider\s*\(|setDraftRunEvidenceProvider\s*\(/.test(t)) hits.push(path.relative(root, f)); } } };
  roots.forEach(walk);
  assert.deepEqual(hits.sort(), ["public/shared/js/costing-draft-run-evidence-provider.js", "public/shared/js/costing-draft-run-evidence.js"], "only the definition and the adapter's own unused connector mention it");
  assert.equal(ev.getDraftRunEvidenceProvider(), null);
  const src = code("public/shared/js/costing-draft-run-evidence-provider.js");
  assert.equal([...src.matchAll(/connectDraftRunEvidenceProvider\s*\(/g)].length, 1, "only the definition");
});
