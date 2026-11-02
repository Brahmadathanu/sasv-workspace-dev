// WP05-P02 unit + source-contract tests (node:test only; no network, no Supabase).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COSTING_PRM_CORRECTIONS_V1,
  isCostingPrmCorrectionsV1Enabled,
  PRM_FIXED_HISTORICAL_CONTEXTS,
  createSupersedeSelectionValidator,
  formatFixedHistoricalContextLabel,
  formatSupersedeOptionLabel,
  resolveCandidateScope,
  resolveSupersedeGate,
  selectSupersedeReplacementRoutes,
} from "../../public/shared/js/costing-suite-production-route-corrections.js";
import { failureReason, openRouteTextPromptModal } from "../../public/shared/js/costing-dialogs-route-input.js";
import { buildSupersedeProductRouteArgs, buildCreateRouteFamilyArgs } from "../../public/shared/js/costing-suite-production-route-rpc.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const MAIN = read("public/shared/js/costing-suite-production-route.js");

const H = [
  { product_route_id: 1, product_id: 7, status: "APPROVED", version_label: "v1" },
  { product_route_id: 2, product_id: 7, status: "APPROVED", version_label: "v2", effective_from: "2026-09-01", approval_reference: "AP" },
  { product_route_id: 3, product_id: 7, status: "DRAFT" },
  { product_route_id: 4, product_id: 7, status: "REVIEW_REQUIRED" },
  { product_route_id: 5, product_id: 7, status: "SUPERSEDED" },
  { product_route_id: 6, product_id: 7, status: "INACTIVE" },
  { product_route_id: 7, product_id: 7, status: "REJECTED" },
  { product_route_id: 8, product_id: 7, status: "APPROVED", archived_at: "2026-01-01T00:00:00Z" },
  { product_route_id: 9, product_id: 99, status: "APPROVED" },
  { product_route_id: 2, product_id: 7, status: "APPROVED" }, // duplicate id
  { status: "APPROVED", product_id: 7 }, // no id
];

test("flag COSTING_PRM_CORRECTIONS_V1 is default OFF and only '1' turns it on", () => {
  const mk = (v) => ({ getItem: (k) => (k === COSTING_PRM_CORRECTIONS_V1 ? v : null) });
  assert.equal(isCostingPrmCorrectionsV1Enabled(mk(null)), false);
  assert.equal(isCostingPrmCorrectionsV1Enabled(mk("0")), false);
  assert.equal(isCostingPrmCorrectionsV1Enabled(mk("true")), false);
  assert.equal(isCostingPrmCorrectionsV1Enabled(mk("1")), true);
  assert.equal(isCostingPrmCorrectionsV1Enabled({ getItem() { throw new Error("blocked"); } }), false);
});

test("supersede replacements: same Product, APPROVED, non-archived, never the old route, no duplicates", () => {
  const out = selectSupersedeReplacementRoutes({ oldRouteId: 1, productId: 7, versions: H });
  assert.deepEqual(out.map((r) => r.product_route_id), [2]);
  assert.deepEqual(selectSupersedeReplacementRoutes({ oldRouteId: 2, productId: 7, versions: H }).map((r) => r.product_route_id), [1]);
  assert.deepEqual(selectSupersedeReplacementRoutes({ oldRouteId: null, productId: 7, versions: H }), []);
  assert.deepEqual(selectSupersedeReplacementRoutes({ oldRouteId: 1, productId: null, versions: H }), []);
  assert.deepEqual(selectSupersedeReplacementRoutes({ oldRouteId: 1, productId: 7, versions: null }), []);
});

test("supersede gate: approved route with a replacement only; loading/error/none/not-approved hide the action", () => {
  const header = { product_route_id: 1, product_id: 7, status: "APPROVED" };
  assert.equal(resolveSupersedeGate({ header, choices: { status: "ready", versions: H } }).visible, true);
  assert.equal(resolveSupersedeGate({ header, choices: { status: "ready", versions: [H[0], H[2]] } }).visible, false);
  assert.match(resolveSupersedeGate({ header, choices: { status: "ready", versions: [H[0]] } }).note, /no other approved/);
  assert.match(resolveSupersedeGate({ header, choices: { status: "error", versions: [] } }).note, /could not be loaded/);
  assert.equal(resolveSupersedeGate({ header, choices: { status: "loading" } }).visible, false);
  assert.equal(resolveSupersedeGate({ header, choices: null }).visible, false);
  for (const status of ["DRAFT", "REVIEW_REQUIRED", "SUPERSEDED", "INACTIVE", "REJECTED", ""]) {
    const g = resolveSupersedeGate({ header: { ...header, status }, choices: { status: "ready", versions: H } });
    assert.equal(g.visible, false, status);
  }
  assert.equal(resolveSupersedeGate({ header: null }).visible, false);
});

test("supersede selection validator accepts only offered ids", () => {
  const v = createSupersedeSelectionValidator([H[1]]);
  assert.equal(v("").ok, false);
  assert.equal(v("1").ok, false);
  assert.equal(v("9").ok, false);
  assert.deepEqual(v(" 2 "), { ok: true, value: "2" });
  assert.match(formatSupersedeOptionLabel(H[1]), /Version v2 · ID 2 · effective from 2026-09-01 · ref AP/);
});

test("supersede payload names and shape are unchanged", () => {
  const built = buildSupersedeProductRouteArgs({ old_product_route_id: 9001, new_product_route_id: "9002" });
  assert.equal(built.ok, true);
  assert.deepEqual(built.params, { p_old_product_route_id: 9001, p_new_product_route_id: 9002 });
});

test("family creation requires both user-supplied p_family_code and p_family_name; nothing is derived", () => {
  assert.equal(buildCreateRouteFamilyArgs({ route_family_name: "Only a name" }).ok, false);
  const ok = buildCreateRouteFamilyArgs({ route_family_code: "ABC_1", route_family_name: "Abc", effective_from: "2026-11-02" });
  assert.equal(ok.ok, true);
  assert.equal(ok.params.p_family_code, "ABC_1");
  assert.equal(ok.params.p_family_name, "Abc");
});

test("candidate scope: user choice wins, else deep-link context, else empty", () => {
  assert.deepEqual(resolveCandidateScope({ scope: { familyId: "1", productId: "2", groupIds: [3, 4] } }), { familyId: "1", productId: "2", groupIds: ["3", "4"] });
  assert.deepEqual(resolveCandidateScope({ deepLink: { product_group_id: "502" }, selectedRouteFamilyId: "12", selectedProductId: "78" }), { familyId: "12", productId: "78", groupIds: ["502"] });
  assert.deepEqual(resolveCandidateScope({}), { familyId: "", productId: "", groupIds: [] });
});

test("fixed historical contexts: run 80 helper vs run 82 lenses, labelled and distinct from current costing", () => {
  const c = PRM_FIXED_HISTORICAL_CONTEXTS;
  assert.deepEqual({ ...c["route-readiness-exact-run-helper"] }, { period_start: "2026-07-01", valuation_date: "2026-07-22", refresh_run_id: 80 });
  for (const lens of ["shared-workload-preview", "route-family-mapping-review", "route-family-foundation-review"]) {
    assert.deepEqual({ ...c[lens] }, { period_start: "2026-08-01", valuation_date: "2026-08-07", refresh_run_id: 82 }, lens);
  }
  assert.match(formatFixedHistoricalContextLabel(c["shared-workload-preview"]), /^Fixed historical context · Run 82 · Aug 2026 · Valued 7 Aug 2026\..*not the current costing run/);
  assert.match(formatFixedHistoricalContextLabel(c["route-readiness-exact-run-helper"]), /Run 80 · Jul 2026 · Valued 22 Jul 2026/);
});

// ---- dialog: opt-in select + keep-open-on-failure ----
function dialog({ onSubmit, keepOpenOnFailure = true } = {}) {
  const listeners = [];
  const input = { id: "fld", value: "", focus() {}, setAttribute() {}, removeAttribute() {} };
  const err = { textContent: "", hidden: true };
  const btn = () => ({ disabled: false, setAttribute() {}, removeAttribute() {} });
  const submitBtn = btn(), cancelBtn = btn();
  const host = { querySelector: (s) => ({ "#fld": input, "#fldError": err, "[data-prm-prompt-submit]": submitBtn, "[data-prm-prompt-cancel]": cancelBtn })[s] ?? null };
  const out = { html: "", closed: 0, submitted: [], notices: [] };
  const promise = openRouteTextPromptModal({
    title: "T", fieldId: "fld", label: "L", notice: "Old <b>route</b>", selectOptions: [{ value: "2", label: "<v2>" }], keepOpenOnFailure,
    validate: (v) => (v ? { ok: true, value: v } : { ok: false, error: "pick" }),
    onSubmit: async (v) => { out.submitted.push(v); return onSubmit(v); },
    openModal: (cfg) => { out.html = cfg.html; cfg.bind(host); },
    closeModal: () => { out.closed += 1; },
    formShell: ({ notice, fieldsHtml }) => `<n>${notice}</n>${fieldsHtml}`,
    formField: ({ type, optionsHtml }) => `<${type}>${optionsHtml || ""}`,
    onModal: (_el, type, fn) => listeners.push({ type, fn }),
    withMutation: async (_b, work) => work(),
    escapeHtml: (v) => String(v).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    notify: (m) => out.notices.push(m),
  });
  const click = (what) => Promise.all(listeners.filter((l) => l.type === "click").map((l) => l.fn({ target: { closest: (q) => (q === what ? submitBtn : null) } })));
  return { out, err, input, promise, submit: () => { return click("[data-prm-prompt-submit]"); } };
}

test("dialog: renders an escaped select and notice when asked", () => {
  const d = dialog({ onSubmit: async () => ({ ok: true }) });
  assert.match(d.out.html, /<select><option value="">Select…<\/option><option value="2">&lt;v2&gt;<\/option>/);
  assert.match(d.out.html, /Old &lt;b&gt;route&lt;\/b&gt;/);
});

test("dialog keepOpenOnFailure: returned { ok:false } keeps it open with the reason; success closes once", async () => {
  let fail = true;
  const d = dialog({ onSubmit: async () => (fail ? { ok: false, error: { message: "server says no" } } : { ok: true }) });
  d.input.value = "2";
  await d.submit();
  assert.equal(d.out.closed, 0, "not dismissed after a refusal");
  assert.equal(d.err.textContent, "server says no");
  assert.equal(d.err.hidden, false);
  fail = false;
  await d.submit();
  assert.equal(d.out.closed, 1);
  assert.deepEqual(await d.promise, { submitted: true, result: { ok: true } });
  assert.equal(d.out.submitted.length, 2);
});

test("dialog without keepOpenOnFailure keeps the CW-06 behaviour (closes on any returned outcome)", async () => {
  const d = dialog({ keepOpenOnFailure: false, onSubmit: async () => ({ ok: false }) });
  d.input.value = "2";
  await d.submit();
  assert.equal(d.out.closed, 1);
});

test("failureReason: builder errors or server message as given, else a neutral line", () => {
  assert.equal(failureReason({ ok: false, error: { message: "m" } }), "m");
  assert.equal(failureReason({ ok: false, errors: ["a", "b"] }), "a; b");
  assert.match(failureReason({ ok: false }), /not completed/);
});

// ---- source contracts ----
test("source: every new behaviour is behind the flag; no new RPC names; no code derivation", () => {
  assert.ok((MAIN.match(/isCostingPrmCorrectionsV1Enabled\(\)/g) || []).length >= 8);
  const corr = read("public/shared/js/costing-suite-production-route-corrections.js");
  assert.doesNotMatch(corr, /\.rpc\(|costingRpc|supabase|window\.|document\./, "pure logic only");
  assert.doesNotMatch(corr, /toUpperCase\(\)\s*\.\s*replace|slugify|family_code\s*=/, "no code generation");
  // The only RPC names in the main file are the pre-existing registry; no new write RPC was introduced.
  const before = fs.readFileSync(path.join(root, "scripts/costing-prm-corrections/rpc-names.baseline.json"), "utf8");
  const names = [...new Set(MAIN.match(/"rpc_[a-z0-9_]+"/g) || [])].sort();
  assert.deepEqual(names, JSON.parse(before));
});

test("source: candidate handoff passes no code and never calls createRouteFamily itself", () => {
  const i = MAIN.indexOf("if (isCostingPrmCorrectionsV1Enabled()) {\n          // WP05-P02: hand off");
  assert.ok(i > 0);
  const block = MAIN.slice(i, MAIN.indexOf("return;", i));
  assert.match(block, /openCreateFamilyModal\(\{/);
  assert.doesNotMatch(block, /createRouteFamily|p_family_code|route_family_code/);
});

test("source: supersede selector reuses editor.supersedeProduct with only new_product_route_id", () => {
  assert.match(MAIN, /editor\.supersedeProduct\(\{ new_product_route_id: newId \}\)/);
  assert.doesNotMatch(MAIN, /supersedeProduct\(\{[^}]*effective/);
});

test("source: scope guard - no schema, migration, cache-version or e-Aushadhi file is part of this package's code", () => {
  const files = [
    "public/shared/js/costing-suite-production-route-corrections.js",
  ];
  for (const f of files) assert.doesNotMatch(read(f), /CACHE_VERSION|cacheVersion|migrations|eaushadhi/i, f);
});
