// Executive MIS G7 reporting-only client: pure logic (no DOM, no network, no writes).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EVIDENCE_RPC, WINDOWS, PAGE_SIZE, GOVERNANCE_STATES, HISTORICAL_AUDIT_SNAPSHOT, classifyRead, fetchEvidenceSummary, windowBounds,
  detailText, renderEvidenceShell, renderLive, renderItems,
} from "../../public/shared/js/mis-evidence-report.js";

const contract = JSON.parse(fs.readFileSync(new URL("../../docs/executive-mis-g7-server/client_rpc_contract.json", import.meta.url), "utf8"));

test("the only RPC used is the installed read-only exception summary, gated by executive-mis-dashboard view", () => {
  const r = contract.rpcs.find((x) => x.name === EVIDENCE_RPC);
  assert.ok(r, "RPC present in the machine-readable contract");
  assert.match(r.permission, /module:executive-mis-dashboard \(view\)/);
});

test("classifyRead: ok / unavailable / denied / invalid / error; never throws, never invents data", () => {
  assert.equal(classifyRead({ data: { ok: true, counts: {} } }).kind, "ok");
  assert.equal(classifyRead({ error: { code: "42883", message: "function x does not exist" } }).kind, "unavailable");
  assert.equal(classifyRead({ error: { code: "PGRST202", message: "x" } }).kind, "unavailable");
  assert.equal(classifyRead({ error: { code: "42501", message: "permission required" } }).kind, "denied");
  assert.equal(classifyRead({ error: { status: 403, message: "x" } }).kind, "denied");
  assert.equal(classifyRead({ data: { ok: false, code: "INVALID_INPUT" } }).kind, "invalid");
  assert.equal(classifyRead({ data: null, error: null }).kind, "error");
  assert.equal(classifyRead({ error: { message: "Failed to fetch" } }).kind, "error");
});

test("fetchEvidenceSummary sends exactly the documented arguments and survives a thrown transport error", async () => {
  const seen = [];
  const ok = { rpc: async (n, a) => { seen.push([n, a]); return { data: { ok: true }, error: null }; } };
  assert.equal((await fetchEvidenceSummary(ok, "2026-11-01", "2026-11-24", 25, 50)).kind, "ok");
  assert.deepEqual(seen[0], [EVIDENCE_RPC, { p_from: "2026-11-01", p_to: "2026-11-24", p_limit: 25, p_offset: 50 }]);
  const boom = { rpc: async () => { throw new Error("socket hang up"); } };
  assert.equal((await fetchEvidenceSummary(boom, "2026-11-01", "2026-11-24")).kind, "error");
});

test("windows stay inside the server's 92-day bound and are inclusive", () => {
  for (const d of WINDOWS) { const b = windowBounds("2026-11-24", d); assert.equal(b.to, "2026-11-24"); assert.ok((Date.parse(b.to) - Date.parse(b.from)) / 86400000 <= 92); assert.equal((Date.parse(b.to) - Date.parse(b.from)) / 86400000, d - 1); }
  assert.equal(windowBounds("2026-11-24", 5000).days, 30);
  assert.equal(windowBounds("2026-11-24", 92).from, "2026-08-25");
});

test("every state code the server can emit has operator wording and a tone; every detail code is explained", () => {
  for (const s of ["SIGNED", "UNSIGNED", "SOURCE_CHANGED", "MISSING_ROUTE", "MISSING_RECEIPT", "NOT_VERIFIED", "BMR_IDENTITY_REVIEW"]) assert.ok(GOVERNANCE_STATES[s]?.label && GOVERNANCE_STATES[s]?.tone, s);
  for (const c of ["NO_SOURCE_LEDGER", "LEDGER_MISMATCH", "PACKING_LINE_WITHOUT_DEPLETION", "MANDATORY_FG_STAGE_GAP", "PRODUCT_ROUTE_COVERAGE"]) assert.notEqual(detailText(c), c.replace(/_/g, " ").toLowerCase());
  assert.equal(detailText(null), "");
});

test("historical figures are labelled reference/not live, dated and sourced; receipt validator limitation is stated", () => {
  const h = renderEvidenceShell();
  assert.match(h, /Historical, not verified/); assert.match(h, /not live/); assert.match(h, /never backfilled/);
  assert.match(h, new RegExp(HISTORICAL_AUDIT_SNAPSHOT.window)); assert.match(h, /1,671 of 1,680/); assert.match(h, /9 have none/);
  assert.match(h, /only reports/); assert.doesNotMatch(h, /href=/); assert.doesNotMatch(h, /batch-governance/i);
});

test("live rendering escapes server text and shows unit, window and cut-over; items page shows range and disables edges", () => {
  const d = { from: "2026-10-25", to: "2026-11-24", count_unit: "distinct product/batch per state", total_batches: 3, governance_cutover: "2026-11-24", counts: { NOT_VERIFIED: 2, MISSING_RECEIPT: 1 }, line_counts: { PACKING_LINES: 90, PACKING_LINES_WITHOUT_DEPLETION: 29 },
    total_items: 60, items: [{ product: '<img src=x onerror=1>', batch_number: "B&1", state: "MISSING_RECEIPT", detail: "NO_SOURCE_LEDGER" }] };
  const live = renderLive(d); assert.match(live, /29 of 90/); assert.match(live, /cut-over 2026-11-24/); assert.match(live, /Not verified 2/);
  const items = renderItems(d, 0, PAGE_SIZE); assert.doesNotMatch(items, /<img/); assert.match(items, /&lt;img/); assert.match(items, /1–1 of 60/); assert.match(items, /id="govPrev" disabled/); assert.doesNotMatch(items, /id="govNext" disabled/);
  assert.match(renderItems({ ...d, items: [{ ...d.items[0] }] }, 59, PAGE_SIZE), /id="govNext" disabled/);
  assert.match(renderItems({ ...d, items: [], total_items: 0 }, 0, PAGE_SIZE), /No exceptions in this window/);
});
