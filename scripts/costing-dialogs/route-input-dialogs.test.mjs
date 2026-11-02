// CW-06: in-page prompts for Production Route Manager (flag COSTING_DIALOGS_V1, default OFF).
// node:test only, no network, no Supabase: dialogs run against a fake PRM modal harness.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  GENERIC_SUBMIT_ERROR,
  STALE_ROUTE_MESSAGE,
  openRouteTextPromptModal,
  validateRouteFamilyName,
  validateSupersedeRouteId,
} from "../../public/shared/js/costing-dialogs-route-input.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

// ---- fake PRM modal harness (mirrors openModal/onModal/withMutation/closeModal contracts) ----
function makeHarness({ stale = () => false, onSubmit, validate } = {}) {
  const notices = [];
  const closeCalls = [];
  const listeners = [];
  const attrs = new Map();
  const state = { open: 0, closed: 0, submitted: [], busy: false, toasts: 0 };
  const input = {
    id: "fld", value: "", focused: false,
    focus() { input.focused = true; },
    setAttribute(k, v) { attrs.set(k, String(v)); },
    removeAttribute(k) { attrs.delete(k); },
  };
  const err = { textContent: "", hidden: true };
  const cancelBtn = { disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  const submitBtn = { disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  let cleanup = null;
  const host = {
    querySelector(sel) {
      if (sel === "#fld") return input;
      if (sel === "#fldError") return err;
      if (sel === "[data-prm-prompt-submit]") return submitBtn;
      if (sel === "[data-prm-prompt-cancel]") return cancelBtn;
      return null;
    },
  };
  const target = (sel) => ({ closest: (q) => (q === sel ? {} : null), id: sel === "input" ? "fld" : "" });
  const api = {
    input, err, submitBtn, cancelBtn, state, attrs, notices, closeCalls,
    click: (what) => Promise.all(listeners.filter((l) => l.type === "click").map((l) => l.fn({ target: { closest: (q) => (q === what ? (what === "[data-prm-prompt-submit]" ? submitBtn : what === "[data-prm-prompt-cancel]" ? cancelBtn : {}) : null) } }))),
    enter: () => Promise.all(listeners.filter((l) => l.type === "keydown").map((l) => l.fn({ key: "Enter", target: { id: "fld" }, preventDefault() {} }))),
    escape: () => { state.closed += 1; cleanup?.(); }, // PRM Escape/backdrop -> closeModal -> modal cleanup
    listenerCount: () => listeners.length,
  };
  const promise = openRouteTextPromptModal({
    title: "T", fieldId: "fld", label: "L", submitLabel: "Go",
    validate: validate || ((v) => (String(v).trim() ? { ok: true, value: String(v).trim() } : { ok: false, error: "needed" })),
    isStale: stale,
    onSubmit: async (value) => { state.submitted.push(value); return onSubmit ? onSubmit(value) : { ok: true }; },
    openModal: (cfg) => { state.open += 1; cleanup = cfg.cleanup; state.html = cfg.html; cfg.bind(host); },
    closeModal: (opts) => { state.closed += 1; closeCalls.push(opts); const c = cleanup; cleanup = null; c?.(); },
    notify: (message, level) => notices.push([message, level]),
    formShell: ({ fieldsHtml, actionsHtml }) => `<div>${fieldsHtml}${actionsHtml}</div>`,
    formField: ({ id, label }) => `<label for="${id}">${label}</label><input id="${id}" />`,
    onModal: (el, type, fn) => listeners.push({ type, fn }),
    withMutation: async (button, work) => {
      if (state.busy) return { ok: false, reason: "busy" };
      state.busy = true; button && (button.disabled = true);
      try { return await work(); } finally { state.busy = false; button && (button.disabled = false); }
    },
    escapeHtml: (v) => String(v),
  });
  api.promise = promise;
  return api;
}

test("validators: supersede id is a positive whole number different from the current route", () => {
  for (const bad of ["", "   ", "abc", "12a", "-3", "0", "1.5", "１２"]) assert.equal(validateSupersedeRouteId(bad).ok, false, JSON.stringify(bad));
  assert.deepEqual(validateSupersedeRouteId(" 42 "), { ok: true, value: "42" });
  const same = validateSupersedeRouteId("7", { currentRouteId: 7 });
  assert.equal(same.ok, false);
  assert.match(same.error, /different/);
  assert.equal(validateSupersedeRouteId("8", { currentRouteId: 7 }).ok, true);
  assert.equal(validateRouteFamilyName("   ").ok, false);
  assert.deepEqual(validateRouteFamilyName("  Churna family "), { ok: true, value: "Churna family" });
});

test("dialog: opens labelled with focus and described error region; no write on open", () => {
  const h = makeHarness();
  assert.equal(h.state.open, 1);
  assert.equal(h.input.focused, true);
  assert.equal(h.attrs.get("aria-describedby"), "fldError");
  assert.match(h.state.html, /role="alert"/);
  assert.match(h.state.html, /data-prm-prompt-cancel>Cancel</);
  assert.match(h.state.html, /data-prm-prompt-submit>Go</);
  assert.deepEqual(h.state.submitted, []);
});

test("approve: valid value submits once with the validated value and closes; promise reports submitted", async () => {
  const h = makeHarness({ onSubmit: async () => ({ ok: true, id: 9 }) });
  h.input.value = "  55 ";
  await h.click("[data-prm-prompt-submit]");
  assert.deepEqual(h.state.submitted, ["55"]);
  assert.deepEqual(await h.promise, { submitted: true, result: { ok: true, id: 9 } });
  assert.equal(h.state.closed, 1);
});

test("incorrect input: shows inline error, marks field invalid, refocuses, and sends nothing; fixing it submits", async () => {
  const h = makeHarness();
  h.input.value = "  ";
  await h.click("[data-prm-prompt-submit]");
  assert.deepEqual(h.state.submitted, []);
  assert.equal(h.err.textContent, "needed");
  assert.equal(h.err.hidden, false);
  assert.equal(h.attrs.get("aria-invalid"), "true");
  h.input.value = "ok";
  await h.click("[data-prm-prompt-submit]");
  assert.deepEqual(h.state.submitted, ["ok"]);
  assert.equal(h.attrs.has("aria-invalid"), false);
  assert.equal((await h.promise).submitted, true);
});

test("Enter in the field submits like the primary button", async () => {
  const h = makeHarness();
  h.input.value = "via-enter";
  await h.enter();
  assert.deepEqual(h.state.submitted, ["via-enter"]);
});

test("cancel: no write, dialog closed, promise resolves not-submitted", async () => {
  const h = makeHarness();
  await h.click("[data-prm-prompt-cancel]");
  assert.deepEqual(h.state.submitted, []);
  assert.deepEqual(await h.promise, { submitted: false });
  assert.equal(h.state.closed, 1);
});

test("Escape/backdrop cleanup: no write and the promise settles (callback cleanup)", async () => {
  const h = makeHarness();
  h.input.value = "typed but abandoned";
  h.escape();
  assert.deepEqual(await h.promise, { submitted: false });
  assert.deepEqual(h.state.submitted, []);
  // A late click after cleanup must not write.
  await h.click("[data-prm-prompt-submit]");
  assert.deepEqual(h.state.submitted, []);
});

test("repeated submission: double click and Enter+click send exactly one write", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = makeHarness({ onSubmit: async () => { await gate; return { ok: true }; } });
  h.input.value = "5";
  const first = h.click("[data-prm-prompt-submit]");
  const second = h.click("[data-prm-prompt-submit]");
  const third = h.enter();
  await Promise.resolve();
  assert.equal(h.submitBtn.disabled, true, "button disabled while pending");
  release();
  await Promise.all([first, second, third]);
  assert.deepEqual(h.state.submitted, ["5"]);
  assert.equal((await h.promise).submitted, true);
  assert.equal(h.submitBtn.disabled, false);
});

test("stale state: if the selected route changed, refuse before any write and keep the dialog open", async () => {
  let stale = false;
  const h = makeHarness({ stale: () => stale });
  h.input.value = "5";
  stale = true;
  await h.click("[data-prm-prompt-submit]");
  assert.deepEqual(h.state.submitted, []);
  assert.equal(h.err.textContent, STALE_ROUTE_MESSAGE);
  assert.equal(h.state.closed, 0);
  h.escape();
  assert.deepEqual(await h.promise, { submitted: false });
});

test("write failure: safe generic message, no raw error text leaked, dialog stays usable, then retry works", async () => {
  let fail = true;
  const h = makeHarness({ onSubmit: async () => { if (fail) throw new Error("secret rpc detail: relation x"); return { ok: true }; } });
  h.input.value = "5";
  await h.click("[data-prm-prompt-submit]");
  assert.equal(h.err.textContent, GENERIC_SUBMIT_ERROR);
  assert.doesNotMatch(h.err.textContent, /secret|relation/);
  assert.doesNotMatch(h.err.textContent, /nothing (was )?changed|no change|not (been )?(saved|changed)|failed to save/i, "never claims the server made no change");
  assert.equal(h.state.closed, 0);
  assert.equal(h.submitBtn.disabled, false);
  fail = false;
  await h.click("[data-prm-prompt-submit]");
  assert.equal(h.state.submitted.length, 2);
  assert.equal((await h.promise).submitted, true);
});

test("callback cleanup: each open registers its own handlers and a settled dialog never resolves twice", async () => {
  const a = makeHarness();
  const b = makeHarness();
  assert.equal(a.listenerCount(), 2);
  assert.equal(b.listenerCount(), 2);
  a.escape();
  a.escape();
  assert.deepEqual(await a.promise, { submitted: false });
  b.input.value = "x";
  await b.click("[data-prm-prompt-submit]");
  assert.equal((await b.promise).submitted, true);
});

// ---- source contracts: flag ON uses dialogs, flag OFF keeps the native prompts and identical payloads ----
const SRC = read("public/shared/js/costing-suite-production-route.js");

test("source: flag OFF keeps both native prompts verbatim; ON path is gated before them", () => {
  const supIdx = SRC.indexOf('window.prompt("New approved draft route ID:", "")');
  const famIdx = SRC.indexOf('window.prompt("Manufacturing Route Family name:", "")');
  assert.ok(supIdx > 0 && famIdx > 0, "native prompts remain for flag OFF");
  assert.ok(SRC.lastIndexOf("if (isCostingDialogsV1Enabled())", supIdx) > SRC.lastIndexOf("action === `supersede-${mode}`"), "supersede gated");
  assert.ok(SRC.lastIndexOf("if (isCostingDialogsV1Enabled())", famIdx) > SRC.lastIndexOf("data-prm-create-family"), "family gated");
  // Legacy bodies unchanged.
  assert.match(SRC, /const newId = window\.prompt\("New approved draft route ID:", ""\);\n\s+if \(newId\) \{\n\s+await editor\.supersedeProduct\(\{ new_product_route_id: newId \}\);/);
  assert.match(SRC, /const name = window\.prompt\("Manufacturing Route Family name:", ""\);\n\s+if \(name\) \{\n\s+const result = await candidates\.createRouteFamily\(\{\n\s+route_family_name: name,/);
});

test("source: ON path calls the same editor/candidates methods with the same argument shapes (payload parity)", () => {
  assert.match(SRC, /await editor\.supersedeProduct\(\{ new_product_route_id: newId \}\);/);
  assert.equal((SRC.match(/editor\.supersedeProduct\(/g) || []).length, 2, "legacy + dialog, nothing else");
  assert.equal((SRC.match(/candidates\.createRouteFamily\(\{\s*route_family_name: (?:familyName|name),/g) || []).length, 2);
  assert.doesNotMatch(read("public/shared/js/costing-dialogs-route-input.js"), /\.rpc\(|costingRpc|supabase|insert|upsert|\.from\(/, "dialog module has no data access");
  const dialogSrc = read("public/shared/js/costing-dialogs-route-input.js");
  assert.doesNotMatch(dialogSrc, /window\.(prompt|confirm|alert)|globalThis\.(prompt|confirm)/);
});

test("source: permission checks and server authority untouched (no new RPC names, canEdit paths intact)", () => {
  const edSrc = read("public/shared/js/costing-suite-production-route-editor.js");
  assert.match(edSrc, /async function supersedeProduct\([\s\S]*?if \(!canEdit\(\)\) return denied\(\);/);
  const candSrc = read("public/shared/js/costing-suite-production-route-candidates.js");
  assert.match(candSrc, /async function createRouteFamily\(input = \{\}\) \{\s*if \(!canEdit\(\)\)/);
  const rpcs = (s) => [...s.matchAll(/rpc_[a-z0-9_]+/g)].map((m) => m[0]).sort();
  const baseSrc = execFileSync("git", ["show", "28cfadb20de3e2f3daf0aadada096f541254819d:public/shared/js/costing-suite-production-route.js"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.deepEqual(rpcs(SRC), rpcs(baseSrc), "no RPC name added or removed in the route screen");
});

test("source: candidate-use review keeps its native fallback only when no in-page callback is injected", () => {
  const cand = read("public/shared/js/costing-suite-production-route-candidates.js");
  assert.match(cand, /typeof confirmCandidateUse === "function"\s*\?\s*await confirmCandidateUse\(review\)\s*:\s*window\.confirm\(review\.message\)/);
  assert.match(SRC, /confirmCandidateUse: openCandidateReviewModal/, "production route always injects the in-page review modal");
});

test("failure wording is non-committal: a lost response does not prove the server made no change", () => {
  assert.equal(
    GENERIC_SUBMIT_ERROR,
    "Unable to confirm whether the request completed. Refresh or check the current route or family state before retrying.",
  );
  assert.match(GENERIC_SUBMIT_ERROR, /Unable to confirm whether the request completed/);
  assert.match(GENERIC_SUBMIT_ERROR, /Refresh or check/);
  assert.doesNotMatch(GENERIC_SUBMIT_ERROR, /nothing|no change|not changed|check your connection/i);
  // The dialog module no longer carries the old claim anywhere.
  assert.doesNotMatch(read("public/shared/js/costing-dialogs-route-input.js").replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ""), /Nothing was changed/);
});

test("pending write: Cancel is disabled and ignored; the dialog stays open and the write completes once", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = makeHarness({ onSubmit: async () => { await gate; return { ok: true }; } });
  h.input.value = "5";
  const submit = h.click("[data-prm-prompt-submit]");
  await Promise.resolve();
  assert.equal(h.cancelBtn.disabled, true);
  assert.equal(h.cancelBtn.attrs["aria-disabled"], "true");
  await h.click("[data-prm-prompt-cancel]");
  assert.equal(h.state.closed, 0, "Cancel while pending does not close the modal");
  release();
  await submit;
  assert.deepEqual(h.state.submitted, ["5"]);
  assert.equal(h.state.closed, 1);
  assert.deepEqual(h.closeCalls, [{ restorePrevious: true }]);
  assert.equal((await h.promise).submitted, true);
});

test("failed write re-enables Cancel and Submit so the user can leave or retry after checking state", async () => {
  const h = makeHarness({ onSubmit: async () => { throw new Error("boom"); } });
  h.input.value = "5";
  await h.click("[data-prm-prompt-submit]");
  assert.equal(h.cancelBtn.disabled, false);
  assert.equal(h.cancelBtn.attrs["aria-disabled"], undefined);
  assert.equal(h.submitBtn.disabled, false);
  await h.click("[data-prm-prompt-cancel]");
  assert.deepEqual(await h.promise, { submitted: false });
  assert.equal(h.state.closed, 1);
});

test("Escape/backdrop while the write is pending: no second close or restore; promise resolves after the write with dismissed", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = makeHarness({ onSubmit: async () => { await gate; return { ok: true, id: 3 }; } });
  h.input.value = "5";
  const submit = h.click("[data-prm-prompt-submit]");
  await Promise.resolve();
  h.escape(); // modal closed externally; escape() itself counts one close in the harness
  const closedAtEscape = h.state.closed;
  let resolved = false;
  h.promise.then(() => { resolved = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(resolved, false, "promise waits for the pending write (the write cannot be cancelled)");
  release();
  await submit;
  assert.deepEqual(await h.promise, { submitted: true, dismissed: true, result: { ok: true, id: 3 } });
  assert.equal(h.state.closed, closedAtEscape, "late completion never calls closeModal again");
  assert.deepEqual(h.closeCalls, [], "and never restores a parent modal");
  assert.deepEqual(h.notices, []);
});

test("a modal opened after a dismissed-while-pending dialog is not closed by the late completion", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = makeHarness({ onSubmit: async () => { await gate; return { ok: true }; } });
  h.input.value = "5";
  const submit = h.click("[data-prm-prompt-submit]");
  await Promise.resolve();
  h.escape();
  const other = { open: true }; // the user opens another PRM modal while the write is still pending
  release();
  await submit;
  await h.promise;
  assert.equal(other.open, true);
  assert.equal(h.closeCalls.length, 0, "no closeModal call that could close the other modal");
});

test("late failure after dismissal is reported through notify with the non-committal wording, not through the gone DOM", async () => {
  let rejectIt;
  const gate = new Promise((_r, rej) => { rejectIt = rej; });
  const h = makeHarness({ onSubmit: async () => { await gate; } });
  h.input.value = "5";
  const submit = h.click("[data-prm-prompt-submit]");
  await Promise.resolve();
  h.escape();
  const errBefore = h.err.textContent;
  rejectIt(new Error("network down: secret detail"));
  await submit;
  assert.deepEqual(h.notices, [[GENERIC_SUBMIT_ERROR, "warning"]]);
  assert.equal(h.err.textContent, errBefore, "no write into the detached dialog");
  assert.deepEqual(await h.promise, { submitted: true, dismissed: true, failed: true });
  assert.doesNotMatch(JSON.stringify(h.notices), /secret|network down/);
  assert.equal(h.closeCalls.length, 0);
});

test("normal approve closes exactly once and restores the parent (nested modal contract)", async () => {
  const h = makeHarness();
  h.input.value = "7";
  await h.click("[data-prm-prompt-submit]");
  assert.deepEqual(h.closeCalls, [{ restorePrevious: true }]);
  assert.equal((await h.promise).submitted, true);
});

test("Cancel before any write closes once with restorePrevious and never writes", async () => {
  const h = makeHarness();
  await h.click("[data-prm-prompt-cancel]");
  assert.deepEqual(h.closeCalls, [{ restorePrevious: true }]);
  assert.deepEqual(h.state.submitted, []);
  assert.deepEqual(await h.promise, { submitted: false });
});

test("source: both route-screen dialogs pass showToast as notify; RPC calls and OFF-path prompts unchanged", () => {
  assert.equal((SRC.match(/notify: showToast,/g) || []).length, 2);
  assert.match(SRC, /const newId = window\.prompt\("New approved draft route ID:", ""\);/);
  assert.match(SRC, /const name = window\.prompt\("Manufacturing Route Family name:", ""\);/);
  assert.match(SRC, /await editor\.supersedeProduct\(\{ new_product_route_id: newId \}\);/);
});
