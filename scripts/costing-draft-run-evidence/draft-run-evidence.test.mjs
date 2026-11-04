// CDE-1a: draft-run component evidence section (pure logic, loader, renderer, shell wiring, safety guards).
// Mock-backed: all fixtures live in this test file; the production module contains none. No network / Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as ev from "../../public/shared/js/costing-draft-run-evidence.js";
import { stripCde1aShell } from "../lib/cde1a-shell-strip.mjs";
import { stripN1Shell } from "../lib/n1-nav-strip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const MOD = read("public/shared/js/costing-draft-run-evidence.js");
const SHELL = read("public/shared/js/costing-suite-shell.js");
const BASE = "195b13c4df32a5fdcf22ee304066e96c1b138481";
const CDE1A_MERGE = "43a93ef9fbbaa8aeb41da2d0a9f0868d18fded20"; // squash merge of PR #149
const S = ev.DRAFT_EVIDENCE_STATUS;

const PERIOD = "2026-10-01";
const CONTEXT = Object.freeze({ periodStart: PERIOD, runId: "148", runKind: "draft", allowedRunIds: ["143", "148"] });
const row = (sku, extra = {}) => ({ period_start: PERIOD, refresh_run_id: 148, sku_id: sku, product_id: 900 + sku, product_name: `P${sku}`, rm_blocking_line_count: 0, pm_blocking_line_count: 0, ...extra });
const rec = (sku, extra = {}) => ({ period_start: PERIOD, refresh_run_id: 148, sku_id: sku, valuation_date: "2026-10-31", refreshed_at: "2026-11-01T02:00:00Z", ...extra });

// ---- fixtures mirroring the run-148 classes (independent audit, PR #141) ------------------------------------------
const FIX = {
  labourBasisOk: rec(11, { direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION", allocation_basis_status: "OK", allocation_resolution_status: "READY", direct_labour_component_model_code: "MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS", material_costing_status: "READY", internal_material_conversion_status: "READY" }),
  labourNoSku: rec(12, { direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION", allocation_basis_status: "NO_SKU_SALES_IN_LOOKBACK", allocation_resolution_status: "REVIEW_REQUIRED", material_costing_status: "READY", internal_material_conversion_status: "READY" }),
  labourNoProduct: rec(13, { direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION", allocation_basis_status: "NO_PRODUCT_SALES_IN_LOOKBACK", allocation_resolution_status: "REVIEW_REQUIRED", material_costing_status: "READY", internal_material_conversion_status: "READY" }),
  conversionOnly: rec(14, { direct_labour_allocation_status: "READY", material_costing_status: "READY", internal_material_conversion_status: "REVIEW_REQUIRED" }),
  dhanyamlam: rec(41, { material_costing_status: "READY", direct_labour_allocation_status: "READY", internal_material_conversion_status: "READY", regional: { IK: { regional_basis_source: "REGIONAL_ACTUAL_UNITS", regional_basis_status: "READY", marketing_expense_allocation_status: "READY" }, OK: { regional_basis_source: "REGION_SCALED_COMMON_BASIS", regional_basis_status: "REVIEW_REQUIRED", marketing_expense_allocation_status: "REVIEW_REQUIRED", note: "No positive regional SKU actual units or governed regional assumption." } } }),
  sku105: rec(105, { material_costing_status: "BLOCKED" }), // no verified note: must stay UNKNOWN-ish, never inferred
};
const rowFor = (r) => row(r.sku_id);

function provider(map, { delay = null, calls = [] } = {}) {
  return {
    calls,
    async readSkuEvidence(req) {
      calls.push(req);
      if (delay) await delay(req);
      const v = map(req);
      return v;
    },
  };
}
function loaderWith(p, current) {
  let cur = current;
  const changes = [];
  const loader = ev.createDraftRunEvidenceLoader({ getCurrentContext: () => cur, getProvider: () => p, onChange: (k, s) => changes.push([k, s.status]) });
  return { loader, changes, setCurrent: (c) => { cur = c; } };
}
const reqOf = (r, ctx = CONTEXT) => ev.resolveDraftEvidenceRequest(ctx, rowFor(r));
const html = (state, request, r) => ev.renderDraftRunEvidenceHtml({ state, request, row: r ? rowFor(r) : row(1) });

// ---- identity / allowed-run ---------------------------------------------------------------------------------------
test("request identity is (period, run, sku) and requires a server-advertised, non-approved run matching the row", () => {
  const r = reqOf(FIX.labourBasisOk);
  assert.deepEqual({ ...r }, { periodStart: PERIOD, runId: "148", skuId: "11", key: `${PERIOD}|148|11` });
  assert.equal(ev.resolveDraftEvidenceRequest({ ...CONTEXT, runId: "999" }, rowFor(FIX.labourBasisOk)), null, "run not advertised");
  assert.equal(ev.resolveDraftEvidenceRequest({ ...CONTEXT, allowedRunIds: [] }, rowFor(FIX.labourBasisOk)), null);
  assert.equal(ev.resolveDraftEvidenceRequest({ ...CONTEXT, runKind: "approved", runId: "143" }, { ...rowFor(FIX.labourBasisOk), refresh_run_id: 143 }), null, "approved runs never use this section");
  assert.equal(ev.resolveDraftEvidenceRequest(CONTEXT, { ...rowFor(FIX.labourBasisOk), refresh_run_id: 143 }), null, "row from another run");
  assert.equal(ev.resolveDraftEvidenceRequest(CONTEXT, { ...rowFor(FIX.labourBasisOk), period_start: "2026-11-01" }), null, "row from another period");
  assert.equal(ev.resolveDraftEvidenceRequest(CONTEXT, { ...rowFor(FIX.labourBasisOk), sku_id: null }), null);
  assert.equal(ev.resolveDraftEvidenceRequest(null, rowFor(FIX.labourBasisOk)), null);
  assert.equal(ev.resolveDraftEvidenceRequest(CONTEXT, null), null);
  assert.equal(ev.resolveDraftEvidenceRequest({ ...CONTEXT, runId: 148, allowedRunIds: [148, 143] }, rowFor(FIX.labourBasisOk))?.runId, "148", "numeric ids are normalised");
});

test("identity echo: every field must match; any mismatch is foreign-run", () => {
  const request = reqOf(FIX.labourBasisOk);
  assert.equal(ev.checkDraftEvidenceIdentity(FIX.labourBasisOk, request), "ok");
  for (const bad of [{ period_start: "2026-11-01" }, { refresh_run_id: 149 }, { sku_id: 12 }, { refresh_run_id: null }, { sku_id: undefined }]) {
    assert.equal(ev.checkDraftEvidenceIdentity({ ...FIX.labourBasisOk, ...bad }, request), "foreign-run", JSON.stringify(bad));
  }
  assert.equal(ev.checkDraftEvidenceIdentity(null, request), "foreign-run");
});

// ---- no provider (production) -------------------------------------------------------------------------------------
test("production default: no provider is connected; section says unavailable and every component is Unknown, no load button", () => {
  assert.equal(ev.getDraftRunEvidenceProvider(), null);
  const { loader } = loaderWith(null, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  const request = reqOf(FIX.labourBasisOk);
  const state = loader.stateFor(request);
  assert.equal(state.status, S.NO_PROVIDER);
  const h = html(state, request, FIX.labourBasisOk);
  assert.ok(h.includes(ev.DRAFT_EVIDENCE_UNAVAILABLE_TEXT));
  assert.ok(h.includes(ev.DRAFT_EVIDENCE_GOVERNED_WARNING_TEXT));
  assert.doesNotMatch(h, /data-cde-load/);
  const statuses = [...h.matchAll(/data-cde-status="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(statuses.length, 5);
  assert.deepEqual([...new Set(statuses)], ["UNKNOWN"]);
  assert.doesNotMatch(h, /READY/);
});

test("setDraftRunEvidenceProvider accepts only objects with readSkuEvidence; reset to null restores production behaviour", () => {
  ev.setDraftRunEvidenceProvider({});
  assert.equal(ev.getDraftRunEvidenceProvider(), null);
  ev.setDraftRunEvidenceProvider("x");
  assert.equal(ev.getDraftRunEvidenceProvider(), null);
  const p = provider(() => ({ status: "empty" }));
  ev.setDraftRunEvidenceProvider(p);
  assert.equal(ev.getDraftRunEvidenceProvider(), p);
  ev.setDraftRunEvidenceProvider(null);
  assert.equal(ev.getDraftRunEvidenceProvider(), null);
});

test("section does not apply (empty html) outside a draft-run context", () => {
  assert.equal(ev.renderDraftRunEvidenceHtml({ state: { status: S.NO_PROVIDER }, request: null, row: row(1) }), "");
  assert.equal(ev.renderDraftRunEvidenceHtml({ state: { status: S.NOT_APPLICABLE }, request: reqOf(FIX.labourBasisOk), row: row(1) }), "");
});

// ---- loader states ------------------------------------------------------------------------------------------------
test("not requested until an explicit load; the provider is never called automatically", async () => {
  const p = provider(() => ({ status: "ok", record: FIX.labourBasisOk }));
  const request = reqOf(FIX.labourBasisOk);
  const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  assert.equal(loader.stateFor(request).status, S.NOT_REQUESTED);
  assert.equal(p.calls.length, 0);
  const h = html(loader.stateFor(request), request, FIX.labourBasisOk);
  assert.match(h, /data-cde-load/);
  assert.match(h, /Not loaded yet/);
  await loader.load(request);
  assert.equal(p.calls.length, 1);
  assert.deepEqual(p.calls[0], { periodStart: PERIOD, runId: "148", skuId: "11" }, "exact request identity, nothing else");
});

test("ok: record is rendered; labour review with valid basis (52-class), NO_SKU_SALES (32-class), NO_PRODUCT_SALES (25-class)", async () => {
  for (const [fix, basis, resolution] of [[FIX.labourBasisOk, "OK", "READY"], [FIX.labourNoSku, "NO_SKU_SALES_IN_LOOKBACK", "REVIEW_REQUIRED"], [FIX.labourNoProduct, "NO_PRODUCT_SALES_IN_LOOKBACK", "REVIEW_REQUIRED"]]) {
    const p = provider(() => ({ status: "ok", record: fix }));
    const request = reqOf(fix);
    const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(fix) });
    await loader.load(request);
    const s = loader.stateFor(request);
    assert.equal(s.status, S.OK);
    const h = html(s, request, fix);
    assert.match(h, new RegExp(`Allocation basis: ${basis}`));
    assert.match(h, new RegExp(`Resolution: ${resolution}`));
    assert.match(h, /<code>REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION<\/code>/);
    assert.match(h, /data-cde-component="direct-labour"><th scope="row">Direct labour<\/th><td data-cde-status="REVIEW_REQUIRED">REVIEW REQUIRED</);
    assert.match(h, /data-cde-component="material"><th scope="row">Material<\/th><td data-cde-status="READY">READY</);
  }
});

test("conversion-only review shows direct labour READY and conversion REVIEW_REQUIRED", async () => {
  const p = provider(() => ({ status: "ok", record: FIX.conversionOnly }));
  const request = reqOf(FIX.conversionOnly);
  const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.conversionOnly) });
  await loader.load(request);
  const h = html(loader.stateFor(request), request, FIX.conversionOnly);
  assert.match(h, /data-cde-component="direct-labour"><th scope="row">Direct labour<\/th><td data-cde-status="READY"/);
  assert.match(h, /data-cde-component="conversion"><th scope="row">Internal conversion<\/th><td data-cde-status="REVIEW_REQUIRED"/);
  assert.match(h, /No dedicated screen for this row/);
});

test("Dhanyamlam SKU 41: IK ready (regional actual units); OK review (region-scaled common basis) with note and pricing-policy link", async () => {
  const p = provider(() => ({ status: "ok", record: FIX.dhanyamlam }));
  const request = reqOf(FIX.dhanyamlam);
  const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.dhanyamlam) });
  await loader.load(request);
  const h = html(loader.stateFor(request), request, FIX.dhanyamlam);
  assert.match(h, /data-cde-component="regional-IK"><th scope="row">Regional Marketing — IK<\/th><td data-cde-status="READY"/);
  assert.match(h, /data-cde-component="regional-OK"><th scope="row">Regional Marketing — OK<\/th><td data-cde-status="REVIEW_REQUIRED"/);
  assert.match(h, /<code>REGION_SCALED_COMMON_BASIS<\/code> — Region-scaled common basis/);
  assert.match(h, /No positive regional SKU actual units or governed regional assumption\./);
  assert.match(h, /<code>REGIONAL_ACTUAL_UNITS<\/code> — Regional actual units/);
  assert.equal((h.match(/data-cde-nav="regional-(IK|OK)"/g) || []).length, 2);
  const buttons = [...h.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  assert.ok(buttons.length >= 2);
  assert.ok(buttons.every((b) => !/accept|approve|finali[sz]e|submit/i.test(b)), "no governance action buttons");
});

test("SKU 105: no verified blocker note is invented; absent components are Unknown and flagged 'Not provided'", async () => {
  const p = provider(() => ({ status: "ok", record: FIX.sku105 }));
  const request = reqOf(FIX.sku105);
  const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.sku105) });
  await loader.load(request);
  const s = loader.stateFor(request);
  assert.equal(s.record.blocker_note, null);
  const h = html(s, request, FIX.sku105);
  assert.match(h, /data-cde-component="material"><th scope="row">Material<\/th><td data-cde-status="BLOCKED"/);
  assert.match(h, /data-cde-component="direct-labour">.*?data-cde-status="UNKNOWN"/s);
  assert.match(h, /Not provided by the evidence source\./);
  assert.doesNotMatch(h, /PM rate|missing required/i, "no cause text is inferred");
});

test("empty -> components Unknown (never Ready); forbidden; provider error with retry; provider throw", async () => {
  const cases = [
    [{ status: "empty" }, S.EMPTY, /No component evidence was returned/],
    [{ status: "forbidden" }, S.FORBIDDEN, /do not have permission/],
    [{ status: "error", error: "boom <b>x</b>" }, S.ERROR, /Evidence could not be read: boom &lt;b&gt;x&lt;\/b&gt;/],
  ];
  for (const [answer, status, re] of cases) {
    const p = provider(() => answer);
    const request = reqOf(FIX.labourBasisOk);
    const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
    await loader.load(request);
    const s = loader.stateFor(request);
    assert.equal(s.status, status);
    const h = html(s, request, FIX.labourBasisOk);
    assert.match(h, re);
    assert.deepEqual([...new Set([...h.matchAll(/data-cde-status="([^"]*)"/g)].map((m) => m[1]))], ["UNKNOWN"]);
    if (status === S.ERROR) assert.match(h, /data-cde-load="1">Retry</);
  }
  const throwing = { async readSkuEvidence() { throw new Error("socket closed"); } };
  const request = reqOf(FIX.labourBasisOk);
  const { loader } = loaderWith(throwing, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  await loader.load(request);
  assert.equal(loader.stateFor(request).status, S.ERROR);
  assert.equal(loader.stateFor(request).error, "socket closed");
  const unknown = loaderWith(provider(() => ({ status: "weird" })), { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  await unknown.loader.load(request);
  assert.equal(unknown.loader.stateFor(request).status, S.ERROR, "unrecognised provider status is an error, never ok");
});

test("retry after an error succeeds and replaces the state", async () => {
  let n = 0;
  const p = provider(() => (++n === 1 ? { status: "error", error: "x" } : { status: "ok", record: FIX.labourBasisOk }));
  const request = reqOf(FIX.labourBasisOk);
  const { loader } = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  await loader.load(request);
  assert.equal(loader.stateFor(request).status, S.ERROR);
  await loader.load(request);
  assert.equal(loader.stateFor(request).status, S.OK);
  assert.equal(p.calls.length, 2);
});

test("provider-reported stale / foreign-run and mismatching echoes render nothing from the record", async () => {
  for (const [answer, status] of [
    [{ status: "stale" }, S.STALE],
    [{ status: "foreign-run" }, S.FOREIGN_RUN],
    [{ status: "ok", record: { ...FIX.labourBasisOk, refresh_run_id: 143 } }, S.FOREIGN_RUN],
    [{ status: "ok", record: { ...FIX.labourBasisOk, period_start: "2026-09-01" } }, S.FOREIGN_RUN],
    [{ status: "ok", record: { ...FIX.labourBasisOk, sku_id: 99 } }, S.FOREIGN_RUN],
    [{ status: "ok" }, S.FOREIGN_RUN],
  ]) {
    const request = reqOf(FIX.labourBasisOk);
    const { loader } = loaderWith(provider(() => answer), { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
    await loader.load(request);
    const s = loader.stateFor(request);
    assert.equal(s.status, status);
    assert.equal(s.record, undefined);
    const h = html(s, request, FIX.labourBasisOk);
    assert.doesNotMatch(h, /Allocation basis|REVIEW_REQUIRED_DIRECT/);
    assert.deepEqual([...new Set([...h.matchAll(/data-cde-status="([^"]*)"/g)].map((m) => m[1]))], ["UNKNOWN"]);
  }
});

// ---- race safety --------------------------------------------------------------------------------------------------
test("late answer after switching SKU / run / period is discarded and never stored", async () => {
  for (const next of [
    { context: CONTEXT, row: rowFor(FIX.labourNoSku) }, // another SKU
    { context: { ...CONTEXT, runId: "143", runKind: "approved" }, row: { ...rowFor(FIX.labourBasisOk), refresh_run_id: 143 } }, // another run
    { context: { ...CONTEXT, periodStart: "2026-11-01" }, row: { ...rowFor(FIX.labourBasisOk), period_start: "2026-11-01" } }, // another period
    null, // drawer closed / flag off
  ]) {
    let release;
    const gate = new Promise((r) => { release = r; });
    const p = provider(() => ({ status: "ok", record: FIX.labourBasisOk }), { delay: () => gate });
    const request = reqOf(FIX.labourBasisOk);
    const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
    const pending = h.loader.load(request);
    assert.equal(h.loader.stateFor(request).status, S.LOADING);
    h.setCurrent(next);
    release();
    await pending;
    assert.equal(h.loader.stateFor(request).status, S.NOT_REQUESTED, "discarded: nothing stored");
    assert.ok(!h.changes.some(([, st]) => st === S.OK), "no ok notification");
  }
});

test("double click while loading issues exactly one request; reset() supersedes an in-flight answer", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const p = provider(() => ({ status: "ok", record: FIX.labourBasisOk }), { delay: () => gate });
  const request = reqOf(FIX.labourBasisOk);
  const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  const a = h.loader.load(request);
  const b = h.loader.load(request);
  h.loader.reset();
  release();
  await Promise.all([a, b]);
  assert.equal(p.calls.length, 1);
  assert.equal(h.loader.stateFor(request).status, S.NOT_REQUESTED);
});

test("results are keyed per (period, run, sku): loading one SKU does not populate another", async () => {
  const p = provider((req) => ({ status: "ok", record: req.skuId === "11" ? FIX.labourBasisOk : FIX.labourNoSku }));
  const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  const r11 = reqOf(FIX.labourBasisOk), r12 = reqOf(FIX.labourNoSku);
  await h.loader.load(r11);
  assert.equal(h.loader.stateFor(r11).status, S.OK);
  assert.equal(h.loader.stateFor(r12).status, S.NOT_REQUESTED);
});

// ---- sanitisation / no money / no mutation -----------------------------------------------------------------------
test("server strings are escaped; unknown and monetary fields on the record are never carried into the view", async () => {
  const hostile = { ...FIX.labourNoSku, allocation_resolution_note: '<img src=x onerror=alert(1)>"&', allocation_reason_code: "<script>x</script>", marketing_expense_cost_per_sku_region: 123.45, resolved_product_region_marketing_sales_value: 999, secret: "s3cret",
    regional: { IK: { note: "<b>ik</b>", marketing_value: 5 }, OK: {} } };
  const request = reqOf(hostile);
  const h = loaderWith(provider(() => ({ status: "ok", record: hostile })), { context: CONTEXT, row: rowFor(hostile) });
  await h.loader.load(request);
  const state = h.loader.stateFor(request);
  const allowed = new Set(["material_costing_status","direct_labour_allocation_status","allocation_reason_code","allocation_basis_status","allocation_resolution_status","allocation_resolution_note","direct_labour_component_model_code","internal_material_conversion_status","first_control_status","control_severity","blocker_note","valuation_date","refreshed_at","regional"]);
  assert.deepEqual(Object.keys(state.record).filter((k) => !allowed.has(k)), [], "whitelist copy only");
  assert.deepEqual(Object.keys(state.record.regional.IK).sort(), ["marketing_expense_allocation_status","note","regional_basis_source","regional_basis_status"]);
  assert.equal(JSON.stringify(state).includes("123.45"), false);
  const out = html(state, request, hostile);
  assert.doesNotMatch(out, /<img|<script|<b>ik|123\.45|s3cret|999/);
  assert.match(out, /&lt;img src=x onerror=alert\(1\)&gt;&quot;&amp;/);
  assert.equal(ev.escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});

test("renderer always carries the governed-run warning, the draft banner and the frozen/not-approval text, in every state", () => {
  const request = reqOf(FIX.labourBasisOk);
  for (const st of [{ status: S.NO_PROVIDER }, { status: S.NOT_REQUESTED }, { status: S.LOADING }, { status: S.EMPTY }, { status: S.FORBIDDEN }, { status: S.ERROR, error: "x" }, { status: S.STALE }, { status: S.FOREIGN_RUN }, { status: S.OK, record: ev.normalizeDraftEvidenceRecord(FIX.labourBasisOk) }]) {
    const h = html(st, request, FIX.labourBasisOk);
    assert.ok(h.includes('data-cde-governed-warning="1"'), st.status);
    assert.ok(h.includes(ev.DRAFT_EVIDENCE_GOVERNED_WARNING_TEXT), st.status);
    assert.ok(h.includes(ev.DRAFT_EVIDENCE_FROZEN_TEXT), st.status);
    assert.match(h, /Run 148 · not for pricing/);
    assert.match(h, /<caption class="cde-sr">/);
    assert.match(h, /<th scope="col">Component<\/th>/);
    assert.match(h, /<summary class="cde-summary">/);
  }
});

test("UX flag: status words use the shared U11 labels only when COSTING_UX_CONSISTENCY_V1 is exactly 1", async () => {
  const request = reqOf(FIX.labourBasisOk);
  const state = { status: S.OK, record: ev.normalizeDraftEvidenceRecord(FIX.labourBasisOk) };
  const withFlag = (value, fn) => {
    const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => value } });
    try { return fn(); } finally { if (prev) Object.defineProperty(globalThis, "localStorage", prev); else delete globalThis.localStorage; }
  };
  assert.match(withFlag(null, () => html(state, request, FIX.labourBasisOk)), /data-cde-status="REVIEW_REQUIRED">REVIEW REQUIRED</);
  assert.match(withFlag("1", () => html(state, request, FIX.labourBasisOk)), /data-cde-status="REVIEW_REQUIRED">Review required</);
  assert.match(withFlag("true", () => html(state, request, FIX.labourBasisOk)), /REVIEW REQUIRED</);
});

// ---- routes (existing resolver only) ------------------------------------------------------------------------------
test("remedy links use the existing resolver: labour -> Production Route Manager, regional -> Pricing Policy Manager, material only with blocking lines; none for conversion", () => {
  const request = reqOf(FIX.labourBasisOk);
  const state = { status: S.NOT_REQUESTED };
  const h = ev.renderDraftRunEvidenceHtml({ state: { status: S.NO_PROVIDER }, request, row: row(11, { rm_blocking_line_count: 0, pm_blocking_line_count: 0 }) });
  assert.match(h, /data-cde-nav="direct-labour">Open Production Route Manager</);
  assert.equal((h.match(/data-cde-nav="regional-/g) || []).length, 2);
  assert.match(h, /data-cde-nav="regional-IK">Open Pricing Policy Manager</);
  assert.doesNotMatch(h, /data-cde-nav="material"/, "no blocking RM/PM lines: resolver reports no navigable remediation");
  assert.doesNotMatch(h, /data-cde-nav="conversion"/);
  const h2 = ev.renderDraftRunEvidenceHtml({ state, request, row: row(11, { pm_blocking_line_count: 2 }) });
  assert.match(h2, /data-cde-nav="material">Open Material Rate Manager</);
});

// ---- shell wiring + safety guards ---------------------------------------------------------------------------------
test("module is read-only and data-free: no Supabase/costing access, no RPC, no mutation or acceptance wording, no fixtures", () => {
  const code = MOD.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(code, /supabase|costingFrom|costingRpc|\.rpc\(|\.from\(|fetch\(|XMLHttpRequest|localStorage|sessionStorage/i);
  assert.doesNotMatch(code, /costing\./, "no costing.* schema reference");
  assert.doesNotMatch(code, /\bimport\b[^;]*supabase/i);
  assert.doesNotMatch(code, /rpc_[a-z_]+/);
  assert.doesNotMatch(code, /\b(approve|accept|finali[sz]e|reject|submit)\b/i, "no governance action wording in code");
  assert.deepEqual([...MOD.matchAll(/^import .* from "(.*)";$/gm)].map((m) => m[1]).sort(), ["./costing-feature-flags.js", "./costing-status-labels.js", "./costing-suite-recommended-ui-route.js"]);
  assert.doesNotMatch(MOD, /Dhanyamlam|Kolakulathadi|sku_id:\s*\d/, "no fixture data in production code");
  assert.equal(ev.getDraftRunEvidenceProvider(), null);
});

test("shell wiring: flag-gated, lazy loader, one call in the SKU Control drawer branch, no provider is set by the shell, no data access added", () => {
  assert.match(SHELL, /import \{ createDraftRunEvidenceLoader, mountDraftRunEvidenceSection \} from "\.\/costing-draft-run-evidence\.js";/);
  assert.doesNotMatch(SHELL, /setDraftRunEvidenceProvider|readSkuEvidence/, "shell never connects a provider");
  const fnStart = SHELL.indexOf("function draftRunEvidenceContext()");
  const block = SHELL.slice(SHELL.indexOf("/**\n * CDE-1a"), SHELL.indexOf("function renderReviewWorklistPanel()"));
  assert.ok(fnStart > 0 && block.includes("function mountDraftRunEvidenceInDrawer()"));
  assert.equal((block.match(/isCostingReviewWorklistV1Enabled\(\) && CURRENT_LENS === "sku-control-status"/g) || []).length, 2, "both functions are flag + lens gated first");
  assert.match(block, /function mountDraftRunEvidenceInDrawer\(\) \{\n  if \(!\(isCostingReviewWorklistV1Enabled\(\) && CURRENT_LENS === "sku-control-status"\)\) return;/);
  assert.match(block, /DRAFT_RUN_EVIDENCE_LOADER \|\|= createDraftRunEvidenceLoader/, "loader created lazily, only after the gate");
  assert.doesNotMatch(block, /costingFrom|costingRpc|supabase|\.rpc\(|fetch\(/);
  assert.match(block, /choice\.kind === "approved"\) return null/);
  assert.match(block, /isCostingReviewWorklistV1Enabled\(\)/);
  const calls = SHELL.split("\n").filter((l) => l.includes("mountDraftRunEvidenceInDrawer()") && !l.includes("function "));
  assert.deepEqual(calls.map((l) => l.trim()), ["mountDraftRunEvidenceInDrawer();"]);
  const branch = SHELL.slice(SHELL.indexOf('} else if (CURRENT_LENS === "sku-control-status") {\n      drawerContent.innerHTML = await controlCenterCtrl.renderSkuControlDrawerTab'));
  assert.ok(branch.indexOf("mountDraftRunEvidenceInDrawer();") > branch.indexOf("wireSkuControlDrawerActions") && branch.indexOf("mountDraftRunEvidenceInDrawer();") < branch.indexOf('} else if (CURRENT_LENS === "costing-review-workbench")'));
});

test("flag-OFF parity: removing exactly the CDE-1a text restores the pre-CDE shell; nothing else changed; tampering is detected", () => {
  const base = execFileSync("git", ["show", `${BASE}:public/shared/js/costing-suite-shell.js`], { encoding: "utf8", cwd: root }).replace(/\r\n/g, "\n");
  assert.notEqual(SHELL, base);
  assert.equal(stripCde1aShell(SHELL), base);
  assert.equal(stripN1Shell(SHELL), stripN1Shell(base), "N1 helper strips CDE first");
  assert.equal(stripCde1aShell(base), base, "idempotent on the pre-CDE text");
  assert.notEqual(stripCde1aShell(SHELL.replace("let ROWS_LOAD_GENERATION = 0;", "let ROWS_LOAD_GENERATION = 1;")), base, "other edits are not masked");
  assert.notEqual(stripCde1aShell(SHELL.replace("      mountDraftRunEvidenceInDrawer();\n", "      mountDraftRunEvidenceInDrawer();\n      void 0;\n")), base);
  // Only the shell and the new module differ among public/ sources over the IMMUTABLE CDE-1a range (base..squash merge).
  // A fixed range, not the working tree, so later packages that legitimately change other files cannot trip this guard
  // and unrelated edits cannot hide in it (any commit missing from history fails loudly).
  execFileSync("git", ["cat-file", "-e", `${CDE1A_MERGE}^{commit}`], { cwd: root });
  const changed = execFileSync("git", ["diff", "--name-only", BASE, CDE1A_MERGE], { encoding: "utf8", cwd: root }).split("\n").filter((f) => f.startsWith("public/"));
  assert.deepEqual([...new Set(changed)].sort(), ["public/shared/js/costing-draft-run-evidence.js", "public/shared/js/costing-suite-shell.js"]);
});

test("no new tab, module, route or HTML: costing html files, registry, route config, flags and service worker are untouched", () => {
  execFileSync("git", ["cat-file", "-e", `${CDE1A_MERGE}^{commit}`], { cwd: root });
  const names = execFileSync("git", ["diff", "--name-only", BASE, CDE1A_MERGE], { encoding: "utf8", cwd: root }).split("\n").filter(Boolean);
  assert.deepEqual(names.filter((f) => /\.html$|sw\.js$|package(-lock)?\.json$|^supabase\/|^sql\/|costing-suite-registry|costing-route-config|costing-feature-flags|costing-review-worklist\.js|costing-status-labels/.test(f)), []);
});

// ---- drawer lifecycle (review of PR #149): close/reopen of the SAME SKU must start a new evidence session ----------
test("close -> reopen of the same SKU before the answer arrives: the old answer is discarded (identity alone is not a session)", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const p = provider(() => ({ status: "ok", record: { ...FIX.labourBasisOk, allocation_reason_code: "OLD_SESSION_MARKER" } }), { delay: () => gate });
  const request = reqOf(FIX.labourBasisOk);
  const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  const pending = h.loader.load(request);
  assert.equal(h.loader.stateFor(request).status, S.LOADING);
  h.setCurrent(null);                 // drawer closes (SELECTED_ROW = null)
  h.loader.reset();                   // shell: closeDetails -> session ends
  h.setCurrent({ context: CONTEXT, row: rowFor(FIX.labourBasisOk) }); // reopened for the very same period/run/SKU
  assert.equal(h.loader.stateFor(request).status, S.NOT_REQUESTED, "reopened drawer starts clean");
  release();
  await pending;
  assert.equal(h.loader.stateFor(request).status, S.NOT_REQUESTED, "old answer not shown although identity matches again");
  assert.ok(!h.changes.some(([, st]) => st === S.OK), "no ok notification for the old session");
  assert.equal(p.calls.length, 1);
});

test("without the session reset the same race WOULD show the old answer (guards the test itself against being vacuous)", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const p = provider(() => ({ status: "ok", record: FIX.labourBasisOk }), { delay: () => gate });
  const request = reqOf(FIX.labourBasisOk);
  const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  const pending = h.loader.load(request);
  h.setCurrent(null);
  h.setCurrent({ context: CONTEXT, row: rowFor(FIX.labourBasisOk) }); // reopen, but NO reset()
  release();
  await pending;
  assert.equal(h.loader.stateFor(request).status, S.OK, "identity-only validation cannot tell sessions apart; the reset is what protects");
});

test("close -> reopen with an already resolved answer: cached state is cleared; a fresh explicit load is required", async () => {
  const p = provider(() => ({ status: "ok", record: FIX.labourBasisOk }));
  const request = reqOf(FIX.labourBasisOk);
  const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  await h.loader.load(request);
  assert.equal(h.loader.stateFor(request).status, S.OK);
  h.loader.reset(); // drawer closed
  assert.equal(h.loader.stateFor(request).status, S.NOT_REQUESTED);
  assert.equal(p.calls.length, 1, "no automatic re-request");
  await h.loader.load(request);
  assert.equal(h.loader.stateFor(request).status, S.OK);
  assert.equal(p.calls.length, 2);
});

test("reset during flight then a NEW load of the same key: only the new answer is applied", async () => {
  const gates = [];
  const p = provider((req) => ({ status: "ok", record: { ...FIX.labourBasisOk, allocation_reason_code: `MARKER_${p.calls.length}` } }), { delay: () => new Promise((r) => gates.push(r)) });
  const request = reqOf(FIX.labourBasisOk);
  const h = loaderWith(p, { context: CONTEXT, row: rowFor(FIX.labourBasisOk) });
  const first = h.loader.load(request);
  h.loader.reset();
  const second = h.loader.load(request);
  gates[0](); await first;
  assert.equal(h.loader.stateFor(request).status, S.LOADING, "old answer did not complete the new load");
  gates[1](); await second;
  const s = h.loader.stateFor(request);
  assert.equal(s.status, S.OK);
  assert.equal(s.record.allocation_reason_code, "MARKER_2");
});

test("shell lifecycle wiring: the session is reset when the drawer opens and when it closes, optional-chained so flag OFF never instantiates the loader", () => {
  const open = SHELL.slice(SHELL.indexOf("function openDetails(row, preferredTab) {"));
  const openHead = open.slice(0, open.indexOf('const title = $("drawerTitle");'));
  assert.match(openHead, /  DRAFT_RUN_EVIDENCE_LOADER\?\.reset\(\);[^\n]*\n  SELECTED_ROW = row;\n  if \(!detailsModal\) return;\n/);
  const closeIdx = SHELL.indexOf('  SELECTED_ROW = null;\n  DRAFT_RUN_EVIDENCE_LOADER?.reset();');
  assert.ok(closeIdx > 0, "close path resets the session");
  assert.match(SHELL.slice(closeIdx, closeIdx + 260), /DRAFT_RUN_EVIDENCE_LOADER\?\.reset\(\);[^\n]*\n  detailsModal\.classList\.add\("hidden"\);/);
  assert.equal(SHELL.split("DRAFT_RUN_EVIDENCE_LOADER?.reset()").length - 1, 2, "exactly the open and close resets");
  assert.equal(SHELL.split("DRAFT_RUN_EVIDENCE_LOADER ||=").length - 1, 1, "single lazy creation, only inside the gated mount");
  assert.match(SHELL, /^let DRAFT_RUN_EVIDENCE_LOADER = null;$/m);
});

// ---- strip helper strictness (cannot over-strip) -----------------------------------------------------------------
test("strip helper: duplicated or missing anchors, or extra code inside the block, are left in place (never over-strip)", async () => {
  const { CDE1A_SHELL_BLOCK_SHA256 } = await import("../lib/cde1a-shell-strip.mjs");
  assert.match(CDE1A_SHELL_BLOCK_SHA256, /^[0-9a-f]{64}$/);
  const call = "      mountDraftRunEvidenceInDrawer();\n";
  const resetOpen = "  DRAFT_RUN_EVIDENCE_LOADER?.reset(); // CDE-1a: a newly opened drawer is a new evidence session\n";
  const endAnchor = "function renderReviewWorklistPanel() {";
  const importLine = 'import { createDraftRunEvidenceLoader, mountDraftRunEvidenceSection } from "./costing-draft-run-evidence.js";\n';
  const base = stripCde1aShell(SHELL);
  const tampers = {
    "duplicated call line": SHELL.replace(call, call + call),
    "duplicated open reset": SHELL.replace(resetOpen, resetOpen + resetOpen),
    "duplicated import": SHELL.replace(importLine, importLine + importLine),
    "duplicated block end anchor": SHELL.replace(endAnchor, `${endAnchor}\n}\n${endAnchor}`),
    "extra code inside block": SHELL.replace("let DRAFT_RUN_EVIDENCE_LOADER = null;", "let DRAFT_RUN_EVIDENCE_LOADER = null;\nlet SNEAKY_EXTRA = 1;"),
    "altered code inside block": SHELL.replace("choice.kind === \"approved\") return null", "choice.kind === \"approvedX\") return null"),
    "missing block end anchor": SHELL.replace(endAnchor, "function renderReviewWorklistPanelX() {"),
    "extra code smuggled between block and anchor": SHELL.replace(endAnchor, `const SNEAKY = 2;\n${endAnchor}`),
  };
  for (const [label, text] of Object.entries(tampers)) {
    const out = stripCde1aShell(text);
    assert.notEqual(out, base, label);
    assert.notEqual(out, execFileSync("git", ["show", `${BASE}:public/shared/js/costing-suite-shell.js`], { encoding: "utf8", cwd: root }).replace(/\r\n/g, "\n"), `${label}: historical comparison must still fail`);
  }
  assert.ok(stripCde1aShell(tampers["extra code inside block"]).includes("SNEAKY_EXTRA"), "extra code survives stripping");
  assert.ok(stripCde1aShell(tampers["extra code smuggled between block and anchor"]).includes("SNEAKY"));
  assert.ok(stripCde1aShell(tampers["altered code inside block"]).includes("approvedX"));
  // neighbouring (non-CDE) shell code is never removed by a successful strip
  const baseText = execFileSync("git", ["show", `${BASE}:public/shared/js/costing-suite-shell.js`], { encoding: "utf8", cwd: root }).replace(/\r\n/g, "\n");
  assert.equal(stripCde1aShell(SHELL).length, baseText.length);
});
