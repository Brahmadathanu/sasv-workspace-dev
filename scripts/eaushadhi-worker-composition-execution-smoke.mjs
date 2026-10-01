import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  classifySave,
  createCompositionExecutor,
  recoveryDisposition,
} = require("../electron/eaushadhi-worker/composition-executor.js");
const {
  COMPOSITION_LIVE_ARM_DEFAULT,
  isCompositionLiveArmedFor,
} = require("../electron/eaushadhi-worker/composition-live-arm.js");
const {
  normalizeCompositionReread,
  normalizeNativeCompositionList,
  parseNativeCompositionRowId,
} = require("../electron/eaushadhi-worker/composition-native-normalizer.js");
const {
  parseCompositionRowId,
} = require("../electron/eaushadhi-worker/composition-contract.js");
const {
  buildCompositionLiveAdapters,
} = require("../electron/eaushadhi-worker/composition-live-adapters.js");

const HASH = "a".repeat(64);
const REF = "portal-262";
const runId = "11111111-1111-4111-8111-111111111111";

const line = (id, name, form, quantity = 1) => ({
  source_composition_line_id: id,
  review_status: "VERIFIED",
  ingredient_name: name,
  scientific_name: `${name} scientific`,
  ingredient_type: { portal_option_value: "1" },
  ingredient_form: { portal_option_value: form },
  part_used: { portal_option_value: "113" },
  quantity_value: quantity,
  measurement: { portal_option_value: "9", label: "ML" },
  reference: {
    reference_ready: true,
    source_to_canonical_ready: true,
    canonical_to_portal_ready: true,
    alias_mapping_status: "VERIFIED",
    portal_mapping_status: "VERIFIED",
    portal_value: "28",
    portal_label: "Sahasrayoga",
  },
});
const governed = [line(929, "Ajamoda", "60", 10), line(930, "Karpura", "66", 1.67), line(931, "Keram", "61", 10)];
const portalRow = (source, id) => ({
  portalRowId: id,
  ingredientName: source.ingredient_name,
  scientificName: source.scientific_name,
  ingredientTypeValue: source.ingredient_type.portal_option_value,
  ingredientFormValue: source.ingredient_form.portal_option_value,
  partUsedValue: source.part_used.portal_option_value,
  quantity: String(source.quantity_value),
  measurement: { representation: "VALUE", value: source.measurement.portal_option_value },
  reference: { representation: "VALUE", value: source.reference.portal_value },
});

function authority(rows, activeRun = null, overrides = {}) {
  return {
    ok: true,
    preflight: {
      product_id: 262,
      workflow_row_version: 11,
      portal_product_ref: REF,
      ready: true,
      content_hash: HASH,
      governed_line_count: 3,
      stage: { stage_status: rows.length ? "PARTIAL" : "NOT_STARTED", row_version: 2 },
      active_run: activeRun,
    },
    content: {
      product_id: 262,
      versions: { workflow_row_version: 11 },
      content_hash: HASH,
      composition: structuredClone(governed),
    },
    pageIdentityEvidence: {
      actualRoute: "/admin/addcomposition",
      expectedRoute: "/admin/addcomposition",
      actualProductId: 262,
      expectedProductId: 262,
      actualPortalProductRef: REF,
      expectedPortalProductRef: REF,
    },
    portalListEvidence: {
      settled: true,
      success: true,
      coverageComplete: true,
      totalCount: rows.length,
      requestedLength: 10,
      rows: structuredClone(rows),
    },
    ...overrides,
  };
}

function rawReread(source, id) {
  return {
    id,
    status: "1",
    ingredientName: source.ingredient_name,
    botanicalName: source.scientific_name,
    ingredientTypeId: source.ingredient_type.portal_option_value,
    ingredientFormId: source.ingredient_form.portal_option_value,
    partuseId: source.part_used.portal_option_value,
    quantity: source.quantity_value,
    unitname: source.measurement.portal_option_value,
    referenceId: source.reference.portal_value,
  };
}

function fakeDeps(authorities, options = {}) {
  const calls = [];
  let index = 0;
  const deps = {
    productId: options.productId ?? 262,
    liveArmed: options.liveArmed === true,
    calls,
    loadAuthority: async (request) => {
      calls.push(["loadAuthority", request]);
      const value = authorities[Math.min(index, authorities.length - 1)];
      index += 1;
      return structuredClone(value);
    },
    armRun: async (input) => {
      calls.push(["armRun", input]);
      return {
        run_id: runId,
        product_id: 262,
        target_source_composition_line_id: input.targetSourceCompositionLineId,
        run_status: "SAVE_ARMED",
        stage_status: "PARTIAL",
        stage_row_version: 3,
        workflow_row_version: 11,
        content_hash: HASH,
        portal_product_ref: REF,
        target_projection: structuredClone(governed.find((item) => item.source_composition_line_id === input.targetSourceCompositionLineId)),
      };
    },
    recheckMutationIdentity: async (portalProductRef) => {
      calls.push(["recheckMutationIdentity", portalProductRef]);
      return options.identityRecheck || { ok: true };
    },
    fillTarget: async (target) => calls.push(["fillTarget", target]),
    invokeSaveOnce: async () => {
      calls.push(["invokeSaveOnce"]);
      return options.saveObservation || {
        invoked: true, invokeCount: 1, settled: true, transportSuccess: true,
        businessSuccess: true, responseParsed: true, matchingRequestCount: 1, httpStatus: 200,
      };
    },
    recordSave: async (input) => {
      calls.push(["recordSave", input]);
      if (options.recordSaveError) throw options.recordSaveError;
      if (options.recordSaveResult) return structuredClone(options.recordSaveResult);
      return { run_id: input.runId, run_status: `SAVE_${input.outcome}`, stage_row_version: 4 };
    },
    rereadRow: async (id) => {
      calls.push(["rereadRow", id]);
      const target = governed.find((item) => item.source_composition_line_id === 930);
      return { ok: true, row: portalRow(target, id), evidence: rawReread(target, id) };
    },
    verifyRow: async (input) => {
      calls.push(["verifyRow", input]);
      return { run_status: "ROW_VERIFIED", stage_status: "PARTIAL", stage_row_version: 5 };
    },
    markStageVerified: async (input) => {
      calls.push(["markStageVerified", input]);
      return { stage_status: "PORTAL_VERIFIED", stage_row_version: 9 };
    },
  };
  return deps;
}

assert.equal(COMPOSITION_LIVE_ARM_DEFAULT, false);
assert.equal(isCompositionLiveArmedFor(262, { EAUSHADHI_COMPOSITION_LIVE_ARM: "true" }), false);

const parsedId = (markup) => parseCompositionRowId(markup);
const provenId = (markup, expected = "row-a") => {
  const result = parsedId(markup);
  assert.equal(result.ok, true);
  assert.equal(result.code, "ROW_ID_CONTRACT_PROVEN");
  assert.equal(result.rowId, expected);
};
const unprovenId = (markup) => {
  const result = parsedId(markup);
  assert.equal(result.ok, false);
  assert.equal(result.code, "ROW_ID_CONTRACT_UNPROVEN");
  assert.equal(result.rowId, null);
};

// Bounded native Composition row identity contracts.
provenId("<a onclick=\"GetCompositionDataUpdate('row-a')\">Edit</a>");
provenId('<a onclick="GetCompositionDataUpdate(\'row-a\')">Edit</a>');
provenId('<a data-composition-id="row-a">Edit</a>');
provenId("<a data-composition-id='row-a'>Edit</a>");
provenId('<input type="hidden" name="hid1" id="hid1" value="row-a">');
provenId("<input type='hidden' name='hid1' id='hid1' value='row-a'>");
provenId('<input value="row-a" id="hid1" type="hidden" name="hid1">');
provenId("<input id='hid12' value='row-a' name='hid12' type='hidden'>");
provenId('<input type="hidden" id="hid123" value="row-a">');
unprovenId('<input type="hidden" id="HID1" value="row-a">');
unprovenId('<input type="hidden" id="Hid1" value="row-a">');
assert.equal(parseNativeCompositionRowId({ edit: '<input type="hidden" id="hid1" value="row-a">' }).rowId, "row-a");
assert.equal(parseNativeCompositionRowId({ delete: '<input type="hidden" name="hid1" value="row-a">' }).rowId, "row-a");
assert.equal(parseNativeCompositionRowId({
  edit: '<input type="hidden" id="hid1" value="row-a">',
  delete: '<input type="hidden" name="hid1" value="row-a">',
}).rowId, "row-a");
assert.equal(parseNativeCompositionRowId({
  edit: '<input type="hidden" id="hid1" value="row-a">',
  delete: '<input type="hidden" id="hid1" value="row-b">',
}).code, "ROW_ID_CONTRACT_UNPROVEN");
provenId('<a onclick="GetCompositionDataUpdate(\'row-a\')"><input type="hidden" id="hid1" value="row-a"></a>');
unprovenId('<a onclick="GetCompositionDataUpdate(\'row-a\')"><input type="hidden" id="hid1" value="row-b"></a>');
unprovenId('<input type="hidden" id="other1" name="other1" value="row-a">');
unprovenId('<input type="text" id="hid1" name="hid1" value="row-a">');
unprovenId('<input type="hidden" id="hid1" name="hid2" value="row-a">');
unprovenId('<input type="hidden" id="hid1" value="">');
unprovenId('<input type="hidden" id="hid1" value="row a">');
unprovenId(`<input type="hidden" id="hid1" value="${"a".repeat(97)}">`);
unprovenId('<input type="hidden" id="hid1" value="row-a"><input type="hidden" id="hid2" value="row-b">');
unprovenId('<input type="hidden" id="hid1" id="hid1" value="row-a">');
unprovenId('<input type="hidden" id="hid1" value="row-a" id=hid2>');
unprovenId('<input type="hidden" id="hid1" value="row-a" ID=hid2>');
unprovenId('<input type="hidden" name="hid1" value="row-a" name=hid2>');
unprovenId('<input type="hidden" id="hid1" value="row-a" value=row-b>');
unprovenId('<input type="hidden" id="hid1" value="row-a" type=text>');
unprovenId('<input type="hidden" id=hid1 value="row-a">');
unprovenId('<input type="hidden" id="hid1" value=row-a>');
unprovenId("1 Ajamoda Apium leptophyllum");
unprovenId("Ajamoda");
unprovenId(`<input type="hidden" id="hid1" value="row-a">${"x".repeat(2049)}`);
assert.equal(parseNativeCompositionRowId({ srno: 1, ingredientName: "Ajamoda" }).code, "ROW_ID_CONTRACT_UNPROVEN");
assert.equal(parseNativeCompositionRowId({
  edit: '<input type="hidden" id="hid1" value="row-a">',
  delete: '<a data-composition-id="row-a">Delete</a>',
}).rowId, "row-a");
assert.equal(parseNativeCompositionRowId({
  edit: '<input type="hidden" id="hid1" value="row-a">',
  delete: '<a data-composition-id="row-b">Delete</a>',
}).code, "ROW_ID_CONTRACT_UNPROVEN");

const aRowNative = { edit: "<a onclick=\"GetCompositionDataUpdate('row-a')\">Edit</a>", delete: "" };
const normalizedReread = normalizeCompositionReread(rawReread(governed[0], "row-a"), "row-a");
assert.equal(normalizedReread.ok, true);
assert.equal(normalizedReread.row.reference.representation, "VALUE");
assert.equal(normalizeCompositionReread(rawReread(governed[0], "row-x"), "row-a").code, "REREAD_ID_MISMATCH");
assert.equal(normalizeCompositionReread({ ...rawReread(governed[0], "row-a"), status: "0" }, "row-a").code, "REREAD_STATUS_NOT_ACTIVE");
assert.equal(normalizeNativeCompositionList({ rows: [aRowNative], rereads: [rawReread(governed[0], "row-a")], totalCount: 1, requestedLength: 10 }).ok, true);
assert.equal(normalizeNativeCompositionList({ rows: [aRowNative, aRowNative], rereads: [rawReread(governed[0], "row-a"), rawReread(governed[0], "row-a")], totalCount: 2, requestedLength: 10 }).code, "DUPLICATE_PORTAL_ROW_ID");

const beforeRows = [portalRow(governed[0], "row-a")];
const completeRows = [portalRow(governed[0], "row-a"), portalRow(governed[1], "row-b"), portalRow(governed[2], "row-c")];

// Read-only preview.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(beforeRows)]);
  const result = await executor.preview(deps);
  assert.equal(result.code, "OFFLINE_MISSING");
  assert.equal(result.mutationAllowed, false);
  assert.deepEqual(result.missingSourceLineIds, [930, 931]);
  assert.deepEqual(deps.calls.map(([name]) => name), ["loadAuthority"]);
}

// Workflow authority uses only matching positive-integer versions from the canonical nested content path.
for (const [label, mutate] of [
  ["nested mismatch", (a) => { a.content.versions.workflow_row_version = 12; }],
  ["nested version missing", (a) => { delete a.content.versions.workflow_row_version; }],
  ["versions object missing", (a) => { delete a.content.versions; }],
  ["top-level-only version", (a) => {
    delete a.content.versions;
    a.content.workflow_row_version = 11;
  }],
  ["numeric string", (a) => { a.content.versions.workflow_row_version = "11"; }],
  ["zero version", (a) => { a.content.versions.workflow_row_version = 0; }],
  ["negative version", (a) => { a.content.versions.workflow_row_version = -1; }],
  ["non-integer version", (a) => { a.content.versions.workflow_row_version = 11.5; }],
]) {
  const sample = authority(beforeRows);
  mutate(sample);
  const result = await createCompositionExecutor().preview(fakeDeps([sample]));
  assert.equal(result.code, "WORKFLOW_VERSION_MISMATCH", label);
  assert.equal(result.mutated, false, label);
}

// Content-hash authority remains an independent fail-closed gate.
{
  const sample = authority(beforeRows);
  sample.content.content_hash = "b".repeat(64);
  const result = await createCompositionExecutor().preview(fakeDeps([sample]));
  assert.equal(result.code, "CONTENT_HASH_MISMATCH");
  assert.equal(result.mutated, false);
}

// Failed preview exposes only the bounded identity diagnostic selected by the executor.
{
  const diagnostics = {
    productid: { present: true, length: 10, blank: false },
    productidEqualsServerPortalRef: false,
    producthidEqualsServerPortalRef: true,
    actionMode: "EDIT_OR_UPDATE",
    id: { present: true, length: 4, blank: false, classification: "NONBLANK" },
  };
  const deps = fakeDeps([{ ok: false, code: "COMPOSITION_PORTAL_TOKEN_MISMATCH", pageIdentityDiagnostics: diagnostics }]);
  const result = await createCompositionExecutor().preview(deps);
  assert.equal(result.code, "COMPOSITION_PORTAL_TOKEN_MISMATCH");
  assert.deepEqual(result.pageIdentityDiagnostics, diagnostics);
  assert.equal(result.mutated, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(REF));
}

// Production disarm stops before authority, arm, fill, or Save.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(beforeRows)], { liveArmed: false });
  const result = await executor.startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true });
  assert.equal(result.code, "COMPOSITION_LIVE_NOT_ARMED");
  assert.equal(deps.calls.length, 0);
}

// Preview fail-closed matrix remains read-only.
for (const [label, mutate, code] of [
  ["non-262", (a, deps) => { deps.productId = 263; }, "PRODUCT_LOCK_REJECTED"],
  ["wrong origin evidence", (a) => { a.pageIdentityEvidence.actualRoute = "/admin/other"; }, "BLOCKED_PAGE_IDENTITY"],
  ["wrong product identity", (a) => { a.pageIdentityEvidence.actualProductId = 263; }, "BLOCKED_PAGE_IDENTITY"],
  ["wrong portal identity", (a) => { a.pageIdentityEvidence.actualPortalProductRef = "wrong"; }, "BLOCKED_PAGE_IDENTITY"],
  ["incomplete coverage", (a) => { a.portalListEvidence.coverageComplete = false; }, "COMPOSITION_EVIDENCE_INCOMPLETE"],
  ["label-only Reference", (a) => { a.portalListEvidence.rows[0].reference = { representation: "PROVEN_LABEL", value: "Sahasrayoga" }; }, "BLOCKED_REFERENCE_REPRESENTATION"],
]) {
  const sample = authority(beforeRows);
  const deps = fakeDeps([sample]);
  mutate(sample, deps);
  deps.loadAuthority = async () => sample;
  const result = await createCompositionExecutor().preview(deps);
  assert.equal(result.code, code, label);
  assert.equal(deps.calls.some(([name]) => ["armRun", "recordSave", "verifyRow", "invokeSaveOnce"].includes(name)), false);
}

// Confirmation and exact missing target are required before arm.
{
  const deps = fakeDeps([authority(beforeRows)], { liveArmed: true });
  assert.equal((await createCompositionExecutor().startLine(deps, { sourceCompositionLineId: 930, userConfirmed: false })).code, "USER_CONFIRMATION_REQUIRED");
  assert.equal(deps.calls.length, 0);
}
{
  const deps = fakeDeps([authority(beforeRows)], { liveArmed: true });
  const result = await createCompositionExecutor().startLine(deps, { sourceCompositionLineId: 999, userConfirmed: true });
  assert.equal(result.code, "TARGET_NOT_EXACTLY_MISSING");
  assert.equal(deps.calls.some(([name]) => name === "armRun"), false);
}

// Trusted injected arm exercises arm -> server projection -> one Save -> durable outcome -> verification.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(beforeRows), authority(completeRows)], { liveArmed: true });
  const result = await executor.startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true, rendererIngredientName: "FORGED" });
  assert.equal(result.code, "ROW_VERIFIED");
  assert.equal(result.mutated, true);
  assert.equal(result.invokeCount, 1);
  const names = deps.calls.map(([name]) => name);
  assert.deepEqual(names, ["loadAuthority", "armRun", "recheckMutationIdentity", "fillTarget", "invokeSaveOnce", "recordSave", "loadAuthority", "rereadRow", "verifyRow"]);
  assert.equal(deps.calls.find(([name]) => name === "fillTarget")[1].ingredient_name, "Karpura");
  assert.equal(deps.calls.find(([name]) => name === "recordSave")[1].outcome, "CONFIRMED");
  assert.equal(names.filter((name) => name === "invokeSaveOnce").length, 1);
}

// Ambiguous is recorded before return and never retried.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(beforeRows)], { liveArmed: true, saveObservation: { invoked: true, invokeCount: 1, settled: false } });
  const result = await executor.startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true });
  assert.equal(result.code, "SAVE_AMBIGUOUS");
  assert.equal(deps.calls.find(([name]) => name === "recordSave")[1].outcome, "AMBIGUOUS");
  assert.equal(deps.calls.filter(([name]) => name === "invokeSaveOnce").length, 1);
}

// Local run guard blocks a second Save invocation for the same server run ID.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(beforeRows), authority(beforeRows)], {
    liveArmed: true,
    saveObservation: { invoked: true, invokeCount: 1, settled: false },
  });
  assert.equal((await executor.startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true })).code, "SAVE_AMBIGUOUS");
  assert.equal((await executor.startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true })).code, "SAVE_ALREADY_INVOKED");
  assert.equal(deps.calls.filter(([name]) => name === "invokeSaveOnce").length, 1);
}

assert.equal(classifySave({ invoked: false, invokeCount: 0 }).outcome, "REJECTED");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: true, noMutationProven: true }).outcome, "REJECTED");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: true }).outcome, "AMBIGUOUS");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: true, transportSuccess: true, httpStatus: 200 }).outcome, "AMBIGUOUS");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: true, transportSuccess: true, businessSuccess: true, responseParsed: true, matchingRequestCount: 1 }).outcome, "CONFIRMED");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: false, matchingRequestCount: 1 }).outcome, "AMBIGUOUS");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: true, transportSuccess: true, businessSuccess: false, responseParsed: false, matchingRequestCount: 1 }).outcome, "AMBIGUOUS");
assert.equal(classifySave({ invoked: true, invokeCount: 1, settled: true, transportSuccess: true, businessSuccess: true, responseParsed: true, matchingRequestCount: 2 }).outcome, "AMBIGUOUS");

function nativeSaveHarness({ actionMode = "add", returnedFalse = false, requests = 1, body = '{"status":"1"}', httpOk = true } = {}) {
  const handlers = { request: new Set(), response: new Set() };
  const events = [];
  let invocationCount = 0;
  const request = () => ({
    url: () => "https://www.e-aushadhi.gov.in/admin/SaveCompositionData",
    method: () => "POST",
  });
  const response = (req) => ({
    request: () => req,
    text: async () => body,
    ok: () => httpOk,
    status: () => httpOk ? 200 : 500,
  });
  const page = {
    on(name, handler) { events.push(`on:${name}`); handlers[name].add(handler); },
    off(name, handler) { handlers[name].delete(handler); },
    async evaluate(fn) {
      const source = String(fn);
      if (!source.includes("const returned = window.SaveData()")) {
        return { actionMode, saveAvailable: true };
      }
      events.push("invoke:SaveData");
      invocationCount += 1;
      if (actionMode !== "add") return { invoked: false, returnedFalse: false };
      if (!returnedFalse) {
        queueMicrotask(() => {
          for (let index = 0; index < requests; index += 1) {
            const req = request();
            for (const handler of handlers.request) handler(req);
            for (const handler of handlers.response) handler(response(req));
          }
        });
      }
      return { invoked: true, returnedFalse };
    },
  };
  return { page, events, invocationCount: () => invocationCount };
}

// Durable arm is followed by a fresh full mutation identity recheck before fill or Save.
{
  const deps = fakeDeps([authority(beforeRows)], {
    liveArmed: true,
    identityRecheck: {
      ok: false,
      code: "COMPOSITION_PORTAL_TOKEN_MISMATCH",
      diagnostics: { productidEqualsServerPortalRef: false },
    },
  });
  const result = await createCompositionExecutor().startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true });
  assert.equal(result.code, "COMPOSITION_PORTAL_TOKEN_MISMATCH");
  assert.equal(result.pageIdentityDiagnostics.productidEqualsServerPortalRef, false);
  assert.equal(result.runStatus, "SAVE_REJECTED");
  assert.equal(deps.calls.some(([name]) => name === "fillTarget"), false);
  assert.equal(deps.calls.some(([name]) => name === "invokeSaveOnce"), false);
  const records = deps.calls.filter(([name]) => name === "recordSave");
  assert.equal(records.length, 1);
  assert.equal(records[0][1].outcome, "REJECTED");
  assert.equal(records[0][1].expectedStageRowVersion, 3);
  assert.equal(records[0][1].expectedContentHash, HASH);
  assert.deepEqual(records[0][1].saveEvidence, {
    outcome: "REJECTED",
    reason: "POST_ARM_IDENTITY_RECHECK_FAILED",
    identityFailureCode: "COMPOSITION_PORTAL_TOKEN_MISMATCH",
    invoked: false,
    invokeCount: 0,
    settled: true,
    noMutationProven: true,
  });
  assert.doesNotMatch(JSON.stringify(records[0][1].saveEvidence), new RegExp(REF));
  assert.ok(deps.calls.findIndex(([name]) => name === "recordSave") < deps.calls.length);
}

// Failure to record the no-mutation rejection stays fail-closed and requires recovery.
{
  const deps = fakeDeps([authority(beforeRows)], {
    liveArmed: true,
    identityRecheck: { ok: false, code: "COMPOSITION_WRONG_ROUTE", diagnostics: { actionMode: "ADD" } },
    recordSaveError: new Error("offline smoke rejection"),
  });
  const result = await createCompositionExecutor().startLine(deps, { sourceCompositionLineId: 930, userConfirmed: true });
  assert.equal(result.code, "COMPOSITION_POST_ARM_REJECTION_RECORD_FAILED");
  assert.equal(result.runStatus, "SAVE_ARMED");
  assert.match(result.message, /requires recovery/i);
  assert.equal(deps.calls.filter(([name]) => name === "recordSave").length, 1);
  assert.equal(deps.calls.some(([name]) => name === "fillTarget"), false);
  assert.equal(deps.calls.some(([name]) => name === "invokeSaveOnce"), false);
}

function pageIdentityHarness({
  origin = "https://www.e-aushadhi.gov.in",
  route = "/admin/addcomposition",
  productid = REF,
  productidPresent = true,
  producthid = "262",
  producthidPresent = true,
  id = "stale-edit-row",
  idPresent = true,
  actiontype = "edit",
  actiontypePresent = true,
  saveAvailable = false,
  listRows = [],
} = {}) {
  const calls = [];
  const page = {
    async evaluate(fn, input) {
      const source = String(fn);
      if (source.includes('productid: read("#productid")')) {
        calls.push(["measure"]);
        return {
          origin,
          route,
          productid: { present: productidPresent, value: productid },
          producthid: { present: producthidPresent, value: producthid },
          id: { present: idPresent, value: id },
          actiontype: { present: actiontypePresent, value: actiontype },
          saveAvailable,
        };
      }
      if (source.includes("LoadCompositionData")) {
        calls.push(["list", input.portalProductRef]);
        return {
          settled: true,
          success: true,
          httpStatus: 200,
          page: 0,
          requestedLength: input.length,
          totalCount: listRows.length,
          rows: structuredClone(listRows),
        };
      }
      throw new Error("UNEXPECTED_PAGE_EVALUATION");
    },
  };
  const callRpc = async (name) => {
    calls.push(["rpc", name]);
    if (name === "rpc_eaushadhi_require_permission") return { allowed: true };
    if (name === "rpc_eaushadhi_composition_execution_preflight") {
      return { product_id: 262, workflow_row_version: 11, portal_product_ref: REF, ready: true, content_hash: HASH };
    }
    if (name === "rpc_eaushadhi_worker_content_get") {
      return { product_id: 262, versions: { workflow_row_version: 11 }, content_hash: HASH, composition: [] };
    }
    throw new Error("UNEXPECTED_RPC");
  };
  return { page, callRpc, calls };
}

async function loadIdentityAuthority(options, request = {}) {
  const harness = pageIdentityHarness(options);
  const adapter = buildCompositionLiveAdapters({
    page: harness.page,
    callRpc: harness.callRpc,
    getWorkerState: () => "READY",
    liveArmed: false,
  });
  return { result: await adapter.loadAuthority(request), harness };
}

// Ambiguous native identity fails before any reread request is attempted.
{
  const { result, harness } = await loadIdentityAuthority({
    listRows: [{
      edit: '<input type="hidden" id="hid1" value="row-a">',
      delete: '<input type="hidden" id="hid1" value="row-b">',
    }],
  });
  assert.equal(result.code, "ROW_ID_CONTRACT_UNPROVEN");
  assert.equal(harness.calls.some(([name]) => name === "reread"), false);
}

// Native page identity: #productid is the sole opaque transport authority.
{
  const { result, harness } = await loadIdentityAuthority();
  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls.find(([name]) => name === "list"), ["list", REF]);
  assert.equal(result.pageIdentityDiagnostics.productidEqualsServerPortalRef, true);
  assert.equal(result.pageIdentityDiagnostics.producthidEqualsProduct262, true);
  assert.equal(result.pageIdentityDiagnostics.actionMode, "EDIT_OR_UPDATE");
  assert.equal(result.pageIdentityDiagnostics.id.classification, "NONBLANK");
  assert.doesNotMatch(JSON.stringify(result.pageIdentityDiagnostics), new RegExp(REF));
  assert.deepEqual(
    harness.calls.filter(([kind]) => kind === "rpc").map(([, name]) => name),
    [
      "rpc_eaushadhi_require_permission",
      "rpc_eaushadhi_composition_execution_preflight",
      "rpc_eaushadhi_worker_content_get",
    ],
  );
  assert.equal(harness.calls.some(([kind]) => kind === "save"), false);
}
{
  const { result } = await loadIdentityAuthority({ productid: "262", producthid: REF });
  assert.equal(result.code, "COMPOSITION_PORTAL_TOKEN_MISMATCH");
  assert.equal(result.pageIdentityDiagnostics.producthidEqualsServerPortalRef, true);
}
{
  const { result } = await loadIdentityAuthority({ productidPresent: false, productid: "" });
  assert.equal(result.code, "COMPOSITION_PRODUCT_TOKEN_MISSING");
}
{
  const { result } = await loadIdentityAuthority({ origin: "https://example.invalid" });
  assert.equal(result.code, "COMPOSITION_WRONG_ORIGIN");
}
{
  const { result } = await loadIdentityAuthority({ route: "/admin/addproduct" });
  assert.equal(result.code, "COMPOSITION_WRONG_ROUTE");
}
{
  const { result } = await loadIdentityAuthority({}, { requireSaveCapability: true, requireEditPermission: true });
  assert.equal(result.code, "COMPOSITION_MUTATION_MODE_NOT_ADD");
}
{
  const { result } = await loadIdentityAuthority(
    { actiontype: "add", id: "", saveAvailable: false },
    { requireSaveCapability: true, requireEditPermission: true },
  );
  assert.equal(result.code, "COMPOSITION_NATIVE_SAVE_UNAVAILABLE");
}
{
  const { result } = await loadIdentityAuthority(
    { actiontype: "add", id: "", saveAvailable: true },
    { requireSaveCapability: true, requireEditPermission: true },
  );
  assert.equal(result.ok, true);
}

// Native SaveData contract: observer first, exact endpoint, bounded business result.
{
  const harness = nativeSaveHarness();
  const adapters = buildCompositionLiveAdapters({ page: harness.page, callRpc: async () => ({}), liveArmed: true });
  const observed = await adapters.invokeSaveOnce(runId);
  assert.equal(harness.invocationCount(), 1);
  assert.ok(harness.events.indexOf("on:request") < harness.events.indexOf("invoke:SaveData"));
  assert.ok(harness.events.indexOf("on:response") < harness.events.indexOf("invoke:SaveData"));
  assert.equal(observed.matchingRequestCount, 1);
  assert.equal(classifySave(observed).outcome, "CONFIRMED");
}
{
  const harness = nativeSaveHarness({ returnedFalse: true, requests: 0 });
  const observed = await buildCompositionLiveAdapters({ page: harness.page, callRpc: async () => ({}), liveArmed: true }).invokeSaveOnce(runId);
  assert.equal(observed.rejectionReason, "NATIVE_SAVE_VALIDATION_REJECTED");
  assert.equal(classifySave(observed).outcome, "REJECTED");
}
{
  const harness = nativeSaveHarness({ requests: 2 });
  const observed = await buildCompositionLiveAdapters({ page: harness.page, callRpc: async () => ({}), liveArmed: true }).invokeSaveOnce(runId);
  assert.equal(observed.matchingRequestCount, 2);
  assert.equal(classifySave(observed).outcome, "AMBIGUOUS");
}
{
  const harness = nativeSaveHarness({ actionMode: "edit" });
  const observed = await buildCompositionLiveAdapters({ page: harness.page, callRpc: async () => ({}), liveArmed: true }).invokeSaveOnce(runId);
  assert.equal(observed.rejectionReason, "NATIVE_ACTION_MODE_NOT_ADD");
  assert.equal(harness.invocationCount(), 0);
}

const activeRun = (status) => ({
  run_id: runId,
  target_source_composition_line_id: 930,
  run_status: status,
  current_stage_row_version: 3,
  workflow_row_version: 11,
  content_hash: HASH,
});

// Interrupted SAVE_ARMED: exact target -> AMBIGUOUS before verify, never Save.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([
    authority(completeRows, activeRun("SAVE_ARMED")),
    authority(completeRows, activeRun("SAVE_AMBIGUOUS")),
  ]);
  const result = await executor.recoverRun(deps, { runId, userConfirmed: true });
  assert.equal(result.code, "ROW_VERIFIED");
  assert.equal(deps.calls.find(([name]) => name === "recordSave")[1].outcome, "AMBIGUOUS");
  assert.equal(deps.calls.some(([name]) => name === "invokeSaveOnce"), false);
  assert.ok(deps.calls.findIndex(([name]) => name === "recordSave") < deps.calls.findIndex(([name]) => name === "verifyRow"));
}

// Interrupted SAVE_ARMED: complete-list target absence -> REJECTED and stop.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(beforeRows, activeRun("SAVE_ARMED"))]);
  const result = await executor.recoverRun(deps, { runId, userConfirmed: true });
  assert.equal(result.code, "SAVE_REJECTED");
  const record = deps.calls.find(([name]) => name === "recordSave")[1];
  assert.equal(record.outcome, "REJECTED");
  assert.equal(record.saveEvidence.reason, "RECOVERY_COMPLETE_LIST_TARGET_ABSENT");
  assert.equal(deps.calls.some(([name]) => name === "invokeSaveOnce"), false);
}

// Interrupted SAVE_ARMED: conflict -> AMBIGUOUS and stop.
{
  const conflict = structuredClone(beforeRows);
  conflict.push({ ...portalRow(governed[1], "row-b"), ingredientFormValue: "999" });
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(conflict, activeRun("SAVE_ARMED"))]);
  const result = await executor.recoverRun(deps, { runId, userConfirmed: true });
  assert.equal(result.code, "SAVE_AMBIGUOUS");
  assert.equal(deps.calls.find(([name]) => name === "recordSave")[1].outcome, "AMBIGUOUS");
  assert.equal(deps.calls.some(([name]) => name === "invokeSaveOnce"), false);
}

// Existing SAVE_AMBIGUOUS remains read-only.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([
    authority(completeRows, activeRun("SAVE_AMBIGUOUS")),
    authority(completeRows, activeRun("SAVE_AMBIGUOUS")),
  ]);
  const result = await executor.recoverRun(deps, { runId, userConfirmed: true });
  assert.equal(result.code, "ROW_VERIFIED");
  assert.equal(deps.calls.some(([name]) => ["fillTarget", "invokeSaveOnce", "armRun", "recordSave"].includes(name)), false);
}

// Final stage proof is a distinct server-only action with no portal Save.
{
  const executor = createCompositionExecutor();
  const deps = fakeDeps([authority(completeRows, null, { preflight: { ...authority(completeRows).preflight, stage: { stage_status: "PARTIAL", row_version: 8 } } })]);
  const result = await executor.verifyStage(deps, { userConfirmed: true });
  assert.equal(result.code, "COMPOSITION_PORTAL_VERIFIED");
  assert.deepEqual(deps.calls.map(([name]) => name), ["loadAuthority", "markStageVerified"]);
}
{
  const deps = fakeDeps([authority(beforeRows)]);
  const result = await createCompositionExecutor().verifyStage(deps, { userConfirmed: true });
  assert.equal(result.code, "FINAL_EXACT_SET_UNPROVEN");
  assert.equal(deps.calls.some(([name]) => name === "markStageVerified"), false);
}

assert.equal(recoveryDisposition({ ok: true, matches: [{ sourceCompositionLineId: 930 }], missing: [], conflicts: [], duplicates: [], extras: [], blockers: [] }, 930), "PRESENT_EXACT_ONE");
assert.equal(recoveryDisposition({ ok: true, matches: [], missing: [{ sourceCompositionLineId: 930 }], conflicts: [], duplicates: [], extras: [], blockers: [] }, 930), "ABSENT_PROVEN");

const files = {
  contract: fs.readFileSync(path.join(root, "electron/eaushadhi-worker/composition-contract.js"), "utf8"),
  arm: fs.readFileSync(path.join(root, "electron/eaushadhi-worker/composition-live-arm.js"), "utf8"),
  executor: fs.readFileSync(path.join(root, "electron/eaushadhi-worker/composition-executor.js"), "utf8"),
  adapter: fs.readFileSync(path.join(root, "electron/eaushadhi-worker/composition-live-adapters.js"), "utf8"),
  normalizer: fs.readFileSync(path.join(root, "electron/eaushadhi-worker/composition-native-normalizer.js"), "utf8"),
  ipc: fs.readFileSync(path.join(root, "electron/eaushadhi-worker/ipc.js"), "utf8"),
  preload: fs.readFileSync(path.join(root, "preload.js"), "utf8"),
  control: fs.readFileSync(path.join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8"),
};
assert.equal((`${files.contract}\n${files.arm}`.match(/const COMPOSITION_LIVE_ARM_DEFAULT = false/g) || []).length, 1);
assert.doesNotMatch(files.executor, /eaushadhi_worker_run_begin|eaushadhi_worker_mark_entered|eaushadhi_worker_mark_portal_verified|createHash|node:crypto/);
assert.doesNotMatch(`${files.executor}\n${files.adapter}`, /QC Register|final Submit|submitProduct/);
assert.doesNotMatch(files.normalizer, /SaveCompositionData|UpdateCompositionData|DeleteCompositionData|\.rpc\(|page\.evaluate|createHash/);
assert.doesNotMatch(files.contract, /DOMParser|createElement|innerHTML|eval\s*\(|Function\s*\(/);
assert.doesNotMatch(files.adapter, /UpdateCompositionData|DeleteCompositionData|AddCompositionData/);
assert.match(files.adapter, /typeof window\.SaveData === "function"/);
assert.match(files.adapter, /const returned = window\.SaveData\(\)/);
assert.doesNotMatch(files.adapter, /window\.SaveCompositionData\s*\(/);
assert.match(files.adapter, /SAVE_ENDPOINT_PATH = "\/admin\/SaveCompositionData"/);
assert.doesNotMatch(files.adapter, /fetch\([^)]*SaveCompositionData/);
assert.ok(files.adapter.indexOf('page.on("request", onRequest)') < files.adapter.indexOf("const returned = window.SaveData()"));
assert.match(files.adapter, /request\.method\(\) === "POST"/);
assert.match(files.adapter, /actiontype !== "add"/);
assert.match(files.adapter, /productid: read\("#productid"\)/);
assert.match(files.adapter, /producthid: read\("#producthid"\)/);
assert.match(files.adapter, /id: read\("#id"\)/);
assert.match(files.adapter, /actiontype: read\("#actiontype"\)/);
assert.doesNotMatch(files.adapter, /#portalProductRef|#hdnPortalProductRef|input\[name=['"]portalProductRef['"]\]/);
assert.doesNotMatch(files.adapter, /Number\(productToken\)/);
assert.match(files.adapter, /captureCompleteList\(identity\.transportToken\)/);
assert.match(files.adapter, /LIST_MAX_ROWS = 50/);
assert.match(files.adapter, /rpc_eaushadhi_composition_execution_preflight/);
assert.match(files.adapter, /rpc_eaushadhi_composition_run_arm/);
assert.match(files.adapter, /rpc_eaushadhi_composition_run_record_save/);
assert.match(files.adapter, /rpc_eaushadhi_composition_run_verify_row/);
assert.match(files.adapter, /rpc_eaushadhi_composition_stage_mark_portal_verified/);
for (const channel of ["composition-preview", "composition-start-line", "composition-recover-run", "composition-verify-stage"]) {
  assert.match(files.ipc, new RegExp(channel));
  assert.match(files.preload, new RegExp(channel));
}
assert.match(files.control, /Composition live execution is not armed/);
assert.doesNotMatch(`${files.ipc}\n${files.preload}`, /page\.evaluate|rpcName|plannerReport.*payload/);

console.log("eaushadhi trusted Composition execution smoke: PASS");
