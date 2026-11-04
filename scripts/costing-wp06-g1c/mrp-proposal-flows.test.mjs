// WP06-G1c: payload, validation and permission tests for the existing MRP proposal workflow in the Pricing Policy
// Manager: generate -> adjust/reset -> submit -> decide (approve/reject) -> apply. Test-only; no source change.
// The real handler factories are driven through their real event bindings with a mocked costingRpc and fake DOM.
// GOVERNANCE (D7, open owner decision): these tests record what the client sends TODAY and are not a policy statement. They add no maker-checker, no identity check and
// no new approval rule; a test pins that no actor/submitter field is sent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadController } from "../costing-nav-mcm-cbm/load-controller.mjs";

const { createMrpDecisionHandlers } = await loadController("costing-suite-mrp-decisions.js");
const { createMrpApplicationHandlers } = await loadController("costing-suite-mrp-application.js");
const { createMrpProposalHandlers } = await loadController("costing-suite-mrp-proposals.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = (f) => fs.readFileSync(path.join(root, "public/shared/js", f), "utf8").replace(/\r\n/g, "\n");

// ---- fake DOM -----------------------------------------------------------------------------------------------------
function makeEl(id = "el") {
  const h = {};
  const cls = new Set(["hidden"]);
  return {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, attrs: {}, dataset: {},
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(t, fn) { (h[t] ||= []).push(fn); },
    fire(t, ev = {}) { return Promise.all((h[t] || []).map((fn) => fn({ target: this, preventDefault() {}, ...ev }))); },
    querySelector: () => null, querySelectorAll: () => [], focus() {}, blur() {}, contains: () => false, closest: () => null, style: {},
  };
}
const domProxy = () => new Proxy({}, { get: (t, k) => (typeof k === "symbol" ? undefined : (t[k] ||= makeEl(String(k)))) });
const settle = () => new Promise((r) => setTimeout(r, 10));
function installDocument() {
  const q = new Map();
  globalThis.document = {
    activeElement: null, body: {}, contains: () => false,
    getElementById: () => makeEl(), createElement: () => makeEl(),
    querySelector: (sel) => { if (!q.has(sel)) q.set(sel, makeEl(sel)); return q.get(sel); },
    querySelectorAll: () => [],
  };
  return (sel) => globalThis.document.querySelector(sel);
}

function baseDeps({ canEdit = true, views = {} } = {}) {
  const log = { rpc: [], toasts: [], errors: [], reloads: 0, masks: [] };
  const state = { canEdit, result: { data: null, error: null }, gate: null };
  const fetchAllRows = async (build) => {
    const probe = build();
    return views[probe.__view] ?? [];
  };
  const chain = (view) => { const c = new Proxy({ __view: view }, { get: (t, p) => (p in t ? t[p] : () => c) }); return c; };
  const deps = {
    dom: domProxy(), costingFrom: (v) => chain(v), fetchAllRows,
    costingRpc: async (name, payload) => { log.rpc.push({ name, payload }); if (state.gate) await state.gate; return state.result; },
    showToast: (...a) => log.toasts.push(a), handleError: (...a) => log.errors.push(a), setLoadingMask: (...a) => log.masks.push(a),
    text: String, formatPercent: String, formatDate: String, formatDateTime: String, formatOptionalMoney: String, formatMoney: String,
    statusChip: String, cpCellPrimary: String, detailPanel: String, kvSection: String,
    reloadRows: async () => { log.reloads += 1; },
    canEditPricingPolicyActions: () => state.canEdit,
    getMrpGovernanceTab: () => "x", setMrpGovernanceTab() {}, renderNestedSubviewNav: () => "",
    numberOrNullFromInput: (el) => { const r = String(el?.value ?? "").trim(); if (r === "") return null; const n = Number(r); return Number.isFinite(n) ? n : null; },
    formatTodayIsoIst: () => "2026-11-04",
  };
  return { deps, log, state };
}
const writes = (log) => log.rpc.filter((c) => !c.name.startsWith("rpc_get_"));
const READ_ONLY = (what) => `You do not have permission to ${what}.`;

// ================================ decisions: approve / reject ======================================================
const LINE = (extra = {}) => ({ proposal_line_id: 301, proposal_id: 10, sku_id: 41, decision: "PENDING", eligibility_status: "ELIGIBLE", proposal_status: "SUBMITTED", applied_mrp_policy_id: null, ...extra });
function decisionSetup(opts = {}) {
  const $q = installDocument();
  const b = baseDeps(opts);
  const h = createMrpDecisionHandlers({ ...b.deps, openMrpProposals: async () => {}, openApprovedForApplication: async () => {} });
  h.bindEvents();
  const open = async (row, which) => {
    h.wireDrawerActions("line-decision", row);
    await $q(which === "APPROVED" ? "[data-mrp-decision-drawer-approve]" : "[data-mrp-decision-drawer-reject]").fire("click");
  };
  return { ...b, h, open, dom: b.deps.dom };
}
const decide = async (s) => { await s.dom.mrpDecisionLineModalSaveBtn.fire("click"); await settle(); };

// The three-key payload is the CURRENT contract; an owner-approved maker-checker change (D7) may extend it and must update this test explicitly.
test("decide: approve sends exactly {p_proposal_line_id, p_decision, p_decision_reason}; reject likewise; no actor/submitter field (D7 unchanged)", async () => {
  for (const [decision, label, toast] of [["APPROVED", "Approve Line", "Line approved for later canonical application."], ["REJECTED", "Reject Line", "Line rejected."]]) {
    const s = decisionSetup();
    await s.open(LINE(), decision);
    assert.equal(s.dom.mrpDecisionLineModalSaveBtn.textContent, label);
    assert.equal(s.dom.mrpDecisionLineModal.classList.contains("hidden"), false, "modal opened");
    s.dom.mrpDecisionLineModalReason.value = "  Reviewed against purchase rates  ";
    await decide(s);
    assert.deepEqual(writes(s.log), [{ name: "rpc_decide_product_mrp_proposal_line", payload: { p_proposal_line_id: 301, p_decision: decision, p_decision_reason: "Reviewed against purchase rates" } }]);
    assert.deepEqual(Object.keys(writes(s.log)[0].payload).sort(), ["p_decision", "p_decision_reason", "p_proposal_line_id"]);
    assert.deepEqual(s.log.toasts.at(-1).slice(0, 2), [toast, "success"]);
    assert.equal(s.log.reloads, 1);
    assert.equal(s.dom.mrpDecisionLineModal.classList.contains("hidden"), true, "modal closed after success");
  }
});

test("decide: approval needs an ELIGIBLE PENDING unapplied line of a SUBMITTED/PARTIALLY_DECIDED proposal; reject only drops the eligibility requirement", async () => {
  const bad = {
    "blocked line": { eligibility_status: "BLOCKED" },
    "already approved": { decision: "APPROVED" },
    "already rejected": { decision: "REJECTED" },
    "already applied": { applied_mrp_policy_id: 9 },
    "draft proposal": { proposal_status: "DRAFT" },
    "applied proposal": { proposal_status: "APPLIED" },
    "cancelled proposal": { proposal_status: "CANCELLED" },
    "approved proposal": { proposal_status: "APPROVED" },
  };
  for (const [label, patch] of Object.entries(bad)) {
    const s = decisionSetup();
    await s.open(LINE(patch), "APPROVED");
    assert.equal(writes(s.log).length, 0, label);
    assert.match(s.log.toasts.at(-1)?.[0] ?? "", /cannot be approved/, label);
  }
  const ok = decisionSetup();
  await ok.open(LINE({ proposal_status: "PARTIALLY_DECIDED" }), "APPROVED");
  ok.dom.mrpDecisionLineModalReason.value = "reason given";
  await decide(ok);
  assert.equal(writes(ok.log).length, 1, "PARTIALLY_DECIDED is enabled");
  const blockedReject = decisionSetup();
  await blockedReject.open(LINE({ eligibility_status: "BLOCKED" }), "REJECTED");
  blockedReject.dom.mrpDecisionLineModalReason.value = "blocked, rejecting";
  await decide(blockedReject);
  assert.equal(writes(blockedReject.log)[0].payload.p_decision, "REJECTED", "a blocked line can be rejected");
  for (const [label, patch] of Object.entries({ "applied line": { applied_mrp_policy_id: 9 }, "decided line": { decision: "APPROVED" }, "draft proposal": { proposal_status: "DRAFT" } })) {
    const s = decisionSetup();
    await s.open(LINE(patch), "REJECTED");
    assert.equal(writes(s.log).length, 0, `reject: ${label}`);
    assert.match(s.log.toasts.at(-1)?.[0] ?? "", /cannot be rejected/, label);
  }
});

test("decide: a reason is required; view-only users are refused at open and at save; no RPC in either case", async () => {
  const s = decisionSetup();
  await s.open(LINE(), "APPROVED");
  s.dom.mrpDecisionLineModalReason.value = "   ";
  await decide(s);
  assert.equal(s.dom.mrpDecisionLineModalError.textContent, "Decision reason is required.");
  assert.equal(writes(s.log).length, 0);
  const v = decisionSetup({ canEdit: false });
  await v.open(LINE(), "APPROVED");
  assert.deepEqual(v.log.toasts.at(-1).slice(0, 2), [READ_ONLY("approve a proposal line"), "error"]);
  await v.open(LINE(), "REJECTED");
  assert.equal(v.log.toasts.at(-1)[0], READ_ONLY("reject a proposal line"));
  assert.equal(v.dom.mrpDecisionLineModalSaveBtn.disabled, true, "syncWriteUi disables Save for view-only");
  assert.equal(writes(v.log).length, 0);
  const r = decisionSetup();
  await r.open(LINE(), "APPROVED");
  r.dom.mrpDecisionLineModalReason.value = "reason given";
  r.state.canEdit = false;
  await decide(r);
  assert.equal(writes(r.log).length, 0, "revoked after opening");
  assert.equal(r.log.toasts.at(-1)[0], READ_ONLY("approve a proposal line"));
});

test("decide: RPC error keeps the modal open with the message and allows a retry; double click sends one RPC", async () => {
  const s = decisionSetup();
  await s.open(LINE(), "APPROVED");
  s.dom.mrpDecisionLineModalReason.value = "reason given";
  s.state.result = { data: null, error: { message: "line already decided" } };
  await decide(s);
  assert.equal(s.log.errors[0][0], "Failed to record proposal-line decision");
  assert.equal(s.dom.mrpDecisionLineModalError.textContent, "line already decided");
  assert.equal(s.dom.mrpDecisionLineModal.classList.contains("hidden"), false);
  assert.equal(s.log.reloads, 0);
  s.state.result = { data: null, error: null };
  await decide(s);
  assert.equal(writes(s.log).length, 2);
  assert.equal(s.dom.mrpDecisionLineModal.classList.contains("hidden"), true);
  const d = decisionSetup();
  await d.open(LINE(), "REJECTED");
  d.dom.mrpDecisionLineModalReason.value = "reason given";
  let release; d.state.gate = new Promise((r) => { release = r; });
  await d.dom.mrpDecisionLineModalSaveBtn.fire("click");
  await d.dom.mrpDecisionLineModalSaveBtn.fire("click");
  await settle(); release(); await settle();
  assert.equal(writes(d.log).length, 1);
});

test("CHARACTERISATION F-9 (pins today's behaviour; flip when fixed): closing the decision modal while its save is pending clears the saving flag, so a second decision can be sent", async () => {
  const s = decisionSetup();
  await s.open(LINE(), "APPROVED");
  s.dom.mrpDecisionLineModalReason.value = "first reason";
  let release; s.state.gate = new Promise((r) => { release = r; });
  await s.dom.mrpDecisionLineModalSaveBtn.fire("click");
  await settle();
  await s.dom.mrpDecisionLineModalCancelBtn.fire("click");   // user closes while pending
  await s.open(LINE(), "APPROVED");
  s.dom.mrpDecisionLineModalReason.value = "second reason";
  await s.dom.mrpDecisionLineModalSaveBtn.fire("click");
  await settle();
  assert.equal(writes(s.log).length, 2, "today two decisions are in flight for the same line (the server is the authority; a fix must make this 1)");
  release(); await settle();
});

// ================================ apply =============================================================================
const HEADER = (extra = {}) => ({ proposal_id: 7, proposal_number: "MRP-7", status: "APPROVED", product_id: 3, product_name: "Prod", ...extra });
const ALINE = (id, sku, extra = {}) => ({ proposal_line_id: id, proposal_id: 7, sku_id: sku, decision: "APPROVED", eligibility_status: "ELIGIBLE", applied_mrp_policy_id: null, ...extra });
async function applySetup({ header = HEADER(), lines = [ALINE(1, 41), ALINE(2, 42), ALINE(3, 41)], canEdit = true, extra = {} } = {}) {
  const $q = installDocument();
  const b = baseDeps({ canEdit, views: { v_product_mrp_proposal_register: [header], v_product_mrp_proposal_lines: lines } });
  const calls = { invalidated: [], changed: [] };
  const h = createMrpApplicationHandlers({ ...b.deps, invalidateMrpPolicyCache: (id) => calls.invalidated.push(id), onPolicyDataChanged: async (a) => { calls.changed.push(a); }, openAppliedHistory: async () => {}, ...extra });
  h.bindEvents();
  h.activateProposal(7);
  await h.loadMrpApplicationRows();
  const container = makeEl("container");
  const applyBtn = makeEl("apply");
  container.querySelector = (sel) => (sel === "#mrpApplicationApplyBtn" ? applyBtn : null);
  h.wireChromeEvents(container, () => {}, () => {});
  return { ...b, h, calls, dom: b.deps.dom, openApply: () => applyBtn.fire("click") };
}
const save = async (s) => { await s.dom.mrpApplicationApplySaveBtn.fire("click"); await settle(); };

test("apply: exact rpc_apply_product_mrp_proposal payload ({p_proposal_id}; note only when typed); success closes, toasts, invalidates each affected SKU once and notifies the policy-data hook", async () => {
  const s = await applySetup();
  await s.openApply();
  assert.equal(s.dom.mrpApplicationApplyModal.classList.contains("hidden"), false);
  await save(s);
  assert.deepEqual(writes(s.log), [{ name: "rpc_apply_product_mrp_proposal", payload: { p_proposal_id: 7 } }]);
  assert.deepEqual(s.log.toasts.at(-1).slice(0, 2), ["Approved MRP policies applied atomically.", "success"]);
  assert.deepEqual(s.calls.invalidated.sort(), [41, 42], "unique SKUs of the awaiting lines");
  assert.deepEqual(s.calls.changed, [{ drawerTab: "mrp-policy", productId: 3, skuId: 41 }]);
  assert.equal(s.dom.mrpApplicationApplyModal.classList.contains("hidden"), true);
  const n = await applySetup();
  await n.openApply();
  n.dom.mrpApplicationApplyNote.value = "  go-live note  ";
  await save(n);
  assert.deepEqual(writes(n.log)[0].payload, { p_proposal_id: 7, p_application_note: "go-live note" });
  const named = await applySetup();
  named.state.result = { data: [{ proposal_number: "MRP-7" }], error: null };
  await named.openApply();
  await save(named);
  assert.equal(named.log.toasts.at(-1)[0], "Proposal MRP-7 applied to canonical MRP.");
});

test("apply: only an APPROVED proposal with at least one awaiting approved/unapplied/unblocked line can be applied; view-only users cannot", async () => {
  const cases = {
    "proposal not approved": { header: HEADER({ status: "SUBMITTED" }) },
    "already applied": { header: HEADER({ status: "APPLIED" }) },
    "no lines": { lines: [] },
    "all rejected": { lines: [ALINE(1, 41, { decision: "REJECTED" })] },
    "all pending": { lines: [ALINE(1, 41, { decision: "PENDING" })] },
    "all blocked": { lines: [ALINE(1, 41, { eligibility_status: "BLOCKED" })] },
    "all already applied": { lines: [ALINE(1, 41, { applied_mrp_policy_id: 5 })] },
  };
  for (const [label, o] of Object.entries(cases)) {
    const s = await applySetup(o);
    await s.openApply();
    assert.equal(s.dom.mrpApplicationApplyModal.classList.contains("hidden"), true, label);
    assert.equal(s.log.toasts.at(-1)?.[0], "This proposal is not ready for canonical application.", label);
    assert.equal(writes(s.log).length, 0, label);
  }
  const v = await applySetup({ canEdit: false });
  await v.openApply();
  assert.equal(v.log.toasts.at(-1)[0], READ_ONLY("apply approved MRP policies"));
  assert.equal(v.dom.mrpApplicationApplySaveBtn.disabled, true);
  const r = await applySetup();
  await r.openApply();
  r.state.canEdit = false;
  await save(r);
  assert.equal(writes(r.log).length, 0, "revoked after opening");
  assert.equal(r.log.toasts.at(-1)[0], READ_ONLY("apply approved MRP policies"), "refused by the edit guard itself, not only by the readiness check");
  const mixed = await applySetup({ lines: [ALINE(1, 41), ALINE(2, 42, { decision: "REJECTED" }), ALINE(3, 43, { eligibility_status: "BLOCKED" })] });
  await mixed.openApply();
  await save(mixed);
  assert.deepEqual(mixed.calls.invalidated, [41], "rejected and blocked lines are excluded");
});

test("apply: server error is shown with the no-partial-application notice, the register is reloaded, the modal stays open; double click sends one RPC", async () => {
  const s = await applySetup();
  await s.openApply();
  s.state.result = { data: null, error: { message: "line 2 no longer eligible" } };
  await save(s);
  assert.equal(s.log.errors[0][0], "Failed to apply Product MRP Proposal");
  assert.match(s.dom.mrpApplicationApplyError.textContent, /line 2 no longer eligible/);
  assert.match(s.dom.mrpApplicationApplyError.textContent, /No partial application was retained/);
  assert.equal(s.dom.mrpApplicationApplyModal.classList.contains("hidden"), false);
  assert.equal(s.log.reloads, 1);
  assert.deepEqual(s.calls.invalidated, [], "no cache invalidation on failure");
  assert.deepEqual(s.calls.changed, []);
  const d = await applySetup();
  await d.openApply();
  let release; d.state.gate = new Promise((r) => { release = r; });
  await d.dom.mrpApplicationApplySaveBtn.fire("click");
  await d.dom.mrpApplicationApplySaveBtn.fire("click");
  await settle(); release(); await settle();
  assert.equal(writes(d.log).length, 1);
});

test("CHARACTERISATION F-9 (apply): closing the apply modal while the apply is pending clears the saving flag", async () => {
  const s = await applySetup();
  await s.openApply();
  let release; s.state.gate = new Promise((r) => { release = r; });
  await s.dom.mrpApplicationApplySaveBtn.fire("click");
  await settle();
  await s.dom.mrpApplicationApplyCancelBtn.fire("click");
  await s.openApply();
  await s.dom.mrpApplicationApplySaveBtn.fire("click");
  await settle();
  assert.equal(writes(s.log).length, 2, "today a second apply for the same proposal is sent (server is atomic/authoritative; a fix must make this 1)");
  release(); await settle();
});

// ================================ proposals: generate / adjust / reset / submit =====================================
async function proposalSetup({ canEdit = true, register = [], lines = [], derivation = [] } = {}) {
  const $q = installDocument();
  const b = baseDeps({ canEdit, views: { v_product_mrp_proposal_register: register, v_product_mrp_proposal_lines: lines, v_product_mrp_derivation_current: derivation } });
  const h = createMrpProposalHandlers({ ...b.deps, openProposalDecisions: async () => {} });
  h.bindEvents();
  await h.loadMrpProposalRows();
  return { ...b, h, $q, dom: b.deps.dom };
}
const DERIV = [
  { derivation_policy_id: 5, product_id: 3, product_name: "Prod A", status: "CONFIRMED", reference_sku_id: 41, reference_pack_size: 100, reference_pack_uom: "g", effective_from: "2026-01-01", effective_to: null },
  { derivation_policy_id: 6, product_id: 4, product_name: "Prod B", status: "DRAFT", reference_sku_id: 51, reference_pack_size: 50, reference_pack_uom: "g", effective_from: "2026-01-01", effective_to: null },
];

test("generate: exact rpc_generate_product_mrp_proposal payload (approval reference only when typed); Confirmed policy required; reason and date required; view-only refused", async () => {
  const s = await proposalSetup({ derivation: DERIV });
  await s.h.openGenerateModal();
  assert.equal(s.dom.mrpProposalGenerateEffectiveFrom.value, "2026-11-04", "defaults to today (IST)");
  assert.match(s.dom.mrpProposalGenerateProduct.innerHTML, /Prod A/);
  assert.doesNotMatch(s.dom.mrpProposalGenerateProduct.innerHTML, /Prod B/, "only CONFIRMED policies are offered when any exist");
  const click = async () => { await s.dom.mrpProposalGenerateSaveBtn.fire("click"); await settle(); };
  s.dom.mrpProposalGenerateProduct.value = "";
  await click();
  assert.equal(s.dom.mrpProposalGenerateError.textContent, "Select a product with a derivation policy.");
  s.dom.mrpProposalGenerateProduct.value = "5"; s.dom.mrpProposalGenerateEffectiveFrom.value = "";
  await click();
  assert.equal(s.dom.mrpProposalGenerateError.textContent, "Effective from date is required.");
  s.dom.mrpProposalGenerateEffectiveFrom.value = "2026-12-01"; s.dom.mrpProposalGenerateReason.value = "  ";
  await click();
  assert.equal(s.dom.mrpProposalGenerateError.textContent, "Reason is required.");
  assert.equal(writes(s.log).length, 0);
  s.dom.mrpProposalGenerateReason.value = " quarterly review ";
  s.dom.mrpProposalGenerateApprovalReference.value = "";
  s.state.result = { data: [{ proposal_id: 12, proposal_number: "MRP-12" }], error: null };
  await click();
  assert.deepEqual(writes(s.log), [{ name: "rpc_generate_product_mrp_proposal", payload: { p_derivation_policy_id: 5, p_proposed_effective_from: "2026-12-01", p_reason: "quarterly review" } }]);
  assert.equal(s.log.toasts.at(-1)[0], "Proposal MRP-12 generated.");
  const a = await proposalSetup({ derivation: DERIV });
  await a.h.openGenerateModal();
  a.dom.mrpProposalGenerateProduct.value = "5"; a.dom.mrpProposalGenerateReason.value = "r"; a.dom.mrpProposalGenerateApprovalReference.value = " AP-1 ";
  await a.dom.mrpProposalGenerateSaveBtn.fire("click"); await settle();
  assert.equal(writes(a.log)[0].payload.p_approval_reference, "AP-1");
  const unconfirmed = await proposalSetup({ derivation: [DERIV[1]] });
  await unconfirmed.h.openGenerateModal();
  unconfirmed.dom.mrpProposalGenerateProduct.value = "6"; unconfirmed.dom.mrpProposalGenerateReason.value = "r";
  await unconfirmed.dom.mrpProposalGenerateSaveBtn.fire("click"); await settle();
  assert.match(unconfirmed.dom.mrpProposalGenerateError.textContent, /not Confirmed/);
  assert.equal(writes(unconfirmed.log).length, 0);
  const v = await proposalSetup({ canEdit: false, derivation: DERIV });
  await v.h.openGenerateModal();
  assert.equal(v.log.toasts.at(-1)[0], READ_ONLY("generate a Product MRP Proposal"));
  assert.equal(v.log.rpc.length, 0);
});

const DRAFT_ROW = { proposal_id: 12, proposal_number: "MRP-12", status: "DRAFT", product_name: "Prod A", created_at: "2026-11-01" };

test("submit: only DRAFT proposals; note required; exact rpc_submit_product_mrp_proposal payload; view-only refused", async () => {
  const s = await proposalSetup({ register: [DRAFT_ROW, { ...DRAFT_ROW, proposal_id: 13, status: "SUBMITTED" }] });
  const drawer = (row) => { s.h.wireDrawerActions("proposal-summary", row); return s.$q("[data-mrp-proposal-drawer-submit]"); };
  await drawer({ ...DRAFT_ROW, proposal_id: 13 }).fire("click");
  assert.equal(s.log.toasts.at(-1)[0], "Only DRAFT proposals can be submitted.");
  await drawer({ ...DRAFT_ROW, proposal_id: 99 }).fire("click");
  assert.equal(s.log.toasts.at(-1)[0], "Proposal not found in the register.");
  await drawer(DRAFT_ROW).fire("click");
  assert.equal(s.dom.mrpProposalSubmitModal.classList.contains("hidden"), false);
  s.dom.mrpProposalSubmitNote.value = "  ";
  await s.dom.mrpProposalSubmitSaveBtn.fire("click"); await settle();
  assert.equal(s.dom.mrpProposalSubmitError.textContent, "Submission reason / note is required.");
  assert.equal(writes(s.log).length, 0);
  s.dom.mrpProposalSubmitNote.value = " ready for decision ";
  s.state.result = { data: [{ status: "SUBMITTED" }], error: null };
  await s.dom.mrpProposalSubmitSaveBtn.fire("click"); await settle();
  assert.deepEqual(writes(s.log), [{ name: "rpc_submit_product_mrp_proposal", payload: { p_proposal_id: 12, p_submission_note: "ready for decision" } }]);
  assert.match(s.log.toasts.at(-1)[0], /Proposal submitted/);
  const v = await proposalSetup({ canEdit: false, register: [DRAFT_ROW] });
  v.h.wireDrawerActions("proposal-summary", DRAFT_ROW);
  await v.$q("[data-mrp-proposal-drawer-submit]").fire("click");
  assert.equal(v.log.toasts.at(-1)[0], READ_ONLY("submit a Product MRP Proposal"));
});

const PLINE = (extra = {}) => ({ proposal_line_id: 401, proposal_id: 12, sku_id: 41, proposal_status: "DRAFT", decision: "PENDING", eligibility_status: "ELIGIBLE", applied_mrp_policy_id: null, is_reference_pack: false, ...extra });

test("adjust: SET_AUTO and SET_MANUAL payloads are exact (OK uplift percent -> fraction); validation matrix; ineligible lines and view-only refused", async () => {
  const s = await proposalSetup();
  const openAdjust = async (row) => { s.h.wireDrawerActions("line-identity", row); await s.$q("[data-mrp-proposal-drawer-adjust]").fire("click"); };
  const go = async () => { await s.dom.mrpProposalAdjustSaveBtn.fire("click"); await settle(); };
  await openAdjust(PLINE());
  assert.equal(s.dom.mrpProposalAdjustModal.classList.contains("hidden"), false);
  s.dom.mrpProposalAdjustCalcMode.value = "AUTO";
  s.dom.mrpProposalAdjustReason.value = "  ";
  await go();
  assert.equal(s.dom.mrpProposalAdjustError.textContent, "Adjustment reason is required.");
  s.dom.mrpProposalAdjustReason.value = "market review";
  s.dom.mrpProposalAdjustMrpIk.value = "0";
  await go();
  assert.equal(s.dom.mrpProposalAdjustError.textContent, "Proposed IK MRP must be greater than zero.");
  s.dom.mrpProposalAdjustMrpIk.value = "120";
  s.dom.mrpProposalAdjustOkPct.value = "-1";
  await go();
  assert.equal(s.dom.mrpProposalAdjustError.textContent, "OK uplift cannot be negative.");
  assert.equal(writes(s.log).length, 0);
  s.dom.mrpProposalAdjustOkPct.value = "5";
  await go();
  assert.deepEqual(writes(s.log)[0], { name: "rpc_adjust_product_mrp_proposal_line", payload: { p_proposal_line_id: 401, p_action: "SET_AUTO", p_proposed_mrp_ik: 120, p_proposed_mrp_ok: null, p_reason: "market review", p_proposed_ok_pct: 0.05 } });
  await openAdjust(PLINE());
  s.dom.mrpProposalAdjustCalcMode.value = "MANUAL";
  s.dom.mrpProposalAdjustReason.value = "manual override";
  s.dom.mrpProposalAdjustMrpIk.value = "130"; s.dom.mrpProposalAdjustMrpOk.value = "";
  await go();
  assert.equal(s.dom.mrpProposalAdjustError.textContent, "Proposed OK MRP must be greater than zero for manual mode.");
  s.dom.mrpProposalAdjustMrpOk.value = "140";
  await go();
  assert.deepEqual(writes(s.log)[1].payload, { p_proposal_line_id: 401, p_action: "SET_MANUAL", p_proposed_mrp_ik: 130, p_proposed_mrp_ok: 140, p_proposed_ok_pct: null, p_reason: "manual override" });
  for (const patch of [{ proposal_status: "SUBMITTED" }, { decision: "APPROVED" }, { eligibility_status: "BLOCKED" }, { applied_mrp_policy_id: 3 }, { is_reference_pack: true }]) {
    const f = await proposalSetup();
    f.h.wireDrawerActions("line-identity", PLINE(patch));
    await f.$q("[data-mrp-proposal-drawer-adjust]").fire("click");
    assert.deepEqual(f.log.toasts.map((t) => t[0]), ["This proposal line cannot be adjusted in its current state."], JSON.stringify(patch));
    assert.equal(f.dom.mrpProposalAdjustModal.classList.contains("hidden"), true);
    assert.equal(writes(f.log).length, 0);
  }
  const v = await proposalSetup({ canEdit: false });
  v.h.wireDrawerActions("line-identity", PLINE());
  await v.$q("[data-mrp-proposal-drawer-adjust]").fire("click");
  assert.equal(v.log.toasts.at(-1)[0], READ_ONLY("adjust a proposal line"));
});

test("reset: exact RESET payload through rpc_adjust_product_mrp_proposal_line; reason required; same eligibility rules; view-only refused", async () => {
  const s = await proposalSetup();
  const openReset = async (row) => { s.h.wireDrawerActions("line-identity", row); await s.$q("[data-mrp-proposal-drawer-reset]").fire("click"); };
  await openReset(PLINE({ is_manually_adjusted: true }));
  s.dom.mrpProposalResetReason.value = " ";
  await s.dom.mrpProposalResetSaveBtn.fire("click"); await settle();
  assert.equal(s.dom.mrpProposalResetError.textContent, "Reset reason is required.");
  assert.equal(writes(s.log).length, 0);
  s.dom.mrpProposalResetReason.value = " back to calculated ";
  await s.dom.mrpProposalResetSaveBtn.fire("click"); await settle();
  assert.deepEqual(writes(s.log), [{ name: "rpc_adjust_product_mrp_proposal_line", payload: { p_proposal_line_id: 401, p_action: "RESET", p_proposed_mrp_ik: null, p_proposed_mrp_ok: null, p_proposed_ok_pct: null, p_reason: "back to calculated" } }]);
  assert.equal(s.log.toasts.at(-1)[0], "Proposal line reset to calculated values.");
  for (const patch of [{ decision: "REJECTED" }, { is_manually_adjusted: false }, { proposal_status: "SUBMITTED" }, { eligibility_status: "BLOCKED" }, { applied_mrp_policy_id: 3 }]) {
    const f = await proposalSetup(); // fresh handlers: drawer wiring would otherwise accumulate listeners on the shared fake node
    f.h.wireDrawerActions("line-identity", PLINE({ is_manually_adjusted: true, ...patch }));
    await f.$q("[data-mrp-proposal-drawer-reset]").fire("click");
    assert.deepEqual(f.log.toasts.map((t) => t[0]), ["Reset is not available for this proposal line."], JSON.stringify(patch));
    assert.equal(f.dom.mrpProposalResetModal.classList.contains("hidden"), true);
  }
  const v = await proposalSetup({ canEdit: false });
  v.h.wireDrawerActions("line-identity", PLINE());
  await v.$q("[data-mrp-proposal-drawer-reset]").fire("click");
  assert.equal(v.log.toasts.at(-1)[0], READ_ONLY("reset a proposal line"));
});

// ================================ scope guards =====================================================================
test("source: the four MRP modules call exactly the six documented MRP write RPCs (generate, adjust, submit, decide, apply) - no approve/finalise/supersede family, no direct table writes, one write per handler", () => {
  const all = ["costing-suite-mrp-proposals.js", "costing-suite-mrp-decisions.js", "costing-suite-mrp-application.js", "costing-suite-mrp-applied-history.js"].map((f) => [f, SRC(f)]);
  const names = new Set();
  for (const [f, src] of all) {
    for (const m of src.matchAll(/costingRpc\(\s*"([a-z_]+)"/g)) names.add(m[1]);
    assert.doesNotMatch(src, /costingFrom\([^)]*\)[\s\S]{0,120}?\.(insert|update|upsert|delete)\(/, `${f}: no direct table write`);
    assert.doesNotMatch(src, /rpc_costing_|rpc_accept_|rpc_approve_/, f);
  }
  assert.deepEqual([...names].sort(), ["rpc_adjust_product_mrp_proposal_line", "rpc_apply_product_mrp_proposal", "rpc_decide_product_mrp_proposal_line", "rpc_generate_product_mrp_proposal", "rpc_submit_product_mrp_proposal"]);
  const dec = SRC("costing-suite-mrp-decisions.js");
  const body = dec.slice(dec.indexOf("async function saveDecision()"), dec.indexOf("function wireTableActions"));
  assert.equal((body.match(/costingRpc\(/g) || []).length, 1);
  assert.doesNotMatch(body, /\.forEach\(|for \(|\.map\(/, "a decision is single-line, never a bulk loop");
});

// D7 is an OPEN OWNER DECISION. This test records the CURRENT client state only (no current-user read, no
// submitter/decider comparison). It is deliberately NOT a statement of policy: a future governed maker-checker
// contract must update or replace it explicitly, together with the server contract, in the same package.
test("source (D7, current state only - NOT a policy lock): no module reads the current user or compares the deciding user with the submitter (submitted_by/decided_by are display-only)", () => {
  for (const f of ["costing-suite-mrp-decisions.js", "costing-suite-mrp-proposals.js", "costing-suite-mrp-application.js"]) {
    const src = SRC(f);
    assert.doesNotMatch(src, /auth\.getUser|getSession|auth\.uid|currentUser|userEmail/i, `${f}: no current-user identity is read`);
    assert.doesNotMatch(src, /(submitted_by|decided_by|created_by)\s*(===|!==|==|!=)/, `${f}: submitter/decider are display fields only, never compared`);
  }
});
