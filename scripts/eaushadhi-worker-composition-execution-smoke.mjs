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
} = require("../electron/eaushadhi-worker/composition-native-normalizer.js");

const HASH = "a".repeat(64);
const REF = "portal-262";
const runId = "11111111-1111-4111-8111-111111111111";

const line = (id, name, form) => ({
  source_composition_line_id: id,
  review_status: "VERIFIED",
  ingredient_name: name,
  scientific_name: `${name} scientific`,
  ingredient_type: { portal_option_value: "1" },
  ingredient_form: { portal_option_value: form },
  part_used: { portal_option_value: "113" },
  quantity_value: "1",
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
const governed = [line(929, "Ajamoda", "60"), line(930, "Karpura", "66"), line(931, "Keram", "61")];
const portalRow = (source, id) => ({
  portalRowId: id,
  ingredientName: source.ingredient_name,
  scientificName: source.scientific_name,
  ingredientTypeValue: source.ingredient_type.portal_option_value,
  ingredientFormValue: source.ingredient_form.portal_option_value,
  partUsedValue: source.part_used.portal_option_value,
  quantity: source.quantity_value,
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
    content: { product_id: 262, workflow_row_version: 11, content_hash: HASH, composition: structuredClone(governed) },
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
    fillTarget: async (target) => calls.push(["fillTarget", target]),
    invokeSaveOnce: async () => {
      calls.push(["invokeSaveOnce"]);
      return options.saveObservation || { invoked: true, invokeCount: 1, settled: true, transportSuccess: true, businessSuccess: true, httpStatus: 200 };
    },
    recordSave: async (input) => {
      calls.push(["recordSave", input]);
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
  assert.deepEqual(names, ["loadAuthority", "armRun", "fillTarget", "invokeSaveOnce", "recordSave", "loadAuthority", "rereadRow", "verifyRow"]);
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
assert.doesNotMatch(files.adapter, /UpdateCompositionData|DeleteCompositionData|AddCompositionData/);
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
