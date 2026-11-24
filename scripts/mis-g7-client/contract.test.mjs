// Client contract layer vs. an in-memory model of the documented server contract (no network, no writes).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  classifyRpc, callRpc, IntentRegistry, packScope, normalizeLines, validateExcess, signableSteps, loadCapabilities, modeLabel,
  RPC, REFUSALS, MIS_TARGETS, idArg, contextSteps, routeLabel, describePreview, eventState, getPreview, getStageStatus, getRouteContext, getExceptionSummary, stateFromRefusal, newIntentKey, describeRefusal, correctionReceipt, packReceipt,
} from "../../public/shared/js/mis-g7-contract.js";
import { createFake, defaultConfig } from "./fake-server.mjs";

const contract = JSON.parse(fs.readFileSync(new URL("../../docs/executive-mis-g7-server/client_rpc_contract.json", import.meta.url), "utf8"));
const noSleep = async () => {};
const pack = (c, over = {}) => ({ p_request_id: newIntentKey(), p_packaging_event_id: 5001, p_lines: [{ sku_id: 71, count: 20 }], p_excess: null, ...over });
const signB001 = async (c, sb) => callRpc(sb, RPC.sign, { p_idempotency_key: newIntentKey(), p_product_id: 7, p_batch_number: "B-001", p_work_log_id: 1002, p_route_step_id: 42, p_step_occurrence: 1, p_measured_qty_base: 10, p_evidence_ref: "WB-1" });

test("RPC names and refusal codes stay aligned with client_rpc_contract.json", () => {
  const names = new Set(contract.rpcs.map((r) => r.name));
  for (const k of ["sign", "correctStage", "pack", "correctPack", "readiness"]) assert.ok(names.has(RPC[k]), RPC[k]);
  for (const r of contract.rpcs.filter((x) => ["mis_sign_batch_stage_v1", "mis_correct_batch_stage_v1", "mis_pack_fg_bulk_v1", "mis_correct_pack_line_v1"].includes(x.name))) {
    for (const code of r.codes) assert.ok(REFUSALS[code], `no operator wording for ${r.name}:${code}`);
  }
  assert.equal(Object.keys(MIS_TARGETS).length, 5);
  assert.deepEqual(Object.values(MIS_TARGETS).sort(), ["module:mis-batch-stage-signer", "module:mis-fg-bulk-packing", "module:mis-fg-excess-adjustment", "module:mis-g7-core-migration-signoff", "module:mis-g7-enforcement-admin"]);
});

test("classifyRpc: ok / refused / insufficient / denied / raised / uncertain / retryable", () => {
  assert.equal(classifyRpc({ data: { ok: true, idempotent_replay: true } }).replay, true);
  assert.equal(classifyRpc({ data: { ok: false, code: "FG_STAGE_NOT_SIGNED", historical_state: "NOT_VERIFIED" } }).historical, true);
  assert.equal(classifyRpc({ data: { ok: false, code: "INSUFFICIENT_BULK", excess_permitted: true } }).kind, "insufficient");
  assert.equal(classifyRpc({ error: { code: "42501", message: "permission required" } }).kind, "denied");
  assert.equal(classifyRpc({ error: { code: "P0001", message: "MIS_G7_NEGATIVE_BALANCE" } }).kind, "raised");
  assert.equal(classifyRpc({ error: { message: "Failed to fetch" } }).kind, "uncertain");
  assert.equal(classifyRpc({ error: { code: "", status: 503, message: "x" } }).kind, "uncertain");
  assert.equal(classifyRpc({ error: { code: "40001", message: "x" } }).kind, "retryable");
  assert.equal(classifyRpc({ data: null, error: null }).kind, "uncertain");
});

test("IntentRegistry keeps one key per intent and drops it only on release", () => {
  const r = new IntentRegistry(); const a = r.keyFor("x"); assert.equal(r.keyFor("x"), a); assert.notEqual(r.keyFor("y"), a);
  r.release("x"); assert.notEqual(r.keyFor("x"), a);
  assert.equal(packScope(1, [{ sku_id: 2, count: 3 }, { sku_id: 1, count: 1 }]), packScope(1, [{ sku_id: 1, count: 1 }, { sku_id: 2, count: 3 }]));
});

test("line and excess validation", () => {
  assert.deepEqual(normalizeLines([{ sku_id: 71, count: "4" }, { sku_id: 72, count: "" }]).lines, [{ sku_id: 71, count: 4 }]);
  assert.ok(normalizeLines([{ sku_id: 71, count: "0" }]).errors.length);
  assert.ok(normalizeLines([{ sku_id: 71, count: "1.5" }]).errors.length);
  assert.ok(normalizeLines([{ sku_id: 71, count: 1 }, { sku_id: 71, count: 2 }]).errors.length);
  assert.ok(normalizeLines([]).errors.length);
  assert.equal(validateExcess({ qty_base: "0", reason: "r", evidence_ref: "e" }).ok, false);
  assert.equal(validateExcess({ qty_base: "1", reason: " ", evidence_ref: "e" }).ok, false);
  assert.equal(validateExcess({ qty_base: "1", reason: "r", evidence_ref: "" }).ok, false);
  assert.deepEqual(validateExcess({ qty_base: "2.5", reason: " r ", evidence_ref: " e " }).value, { qty_base: 2.5, evidence_ref: "e", reason: "r" });
});

test("signableSteps: route gaps, FG mandatory stage, override steps not signable", () => {
  const cfg = defaultConfig();
  const ok = signableSteps({ ...cfg.route[7] });
  assert.equal(ok.steps.find((s) => s.isFg).stepId, 42);
  assert.equal(ok.steps.find((s) => s.activity === "Labelling").signable, false);
  assert.ok(ok.gaps.some((g) => g.code === "OVERRIDE_STEP_NOT_SIGNABLE"));
  const blocked = signableSteps(cfg.route[8]); assert.ok(blocked.gaps.some((g) => g.code === "ROUTE_NOT_READY"));
  const noFg = signableSteps({ readiness_status: "READY", steps: [cfg.route[7].steps[0]] }); assert.ok(noFg.gaps.some((g) => g.code === "MANDATORY_FG_STAGE_GAP"));
});

test("capabilities require view AND edit; excess needs both packing and excess rights; nothing is assumed on error", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg);
  let c = await loadCapabilities(sb); assert.deepEqual([c.canSign, c.canPack, c.canExcess, c.canViewReadiness, c.canSwitchMode, c.canCoreSignoff], [true, true, true, false, false, false]);
  cfg.caps["module:mis-fg-excess-adjustment"] = [1, 0]; c = await loadCapabilities(sb); assert.equal(c.canExcess, false); assert.equal(c.canPack, true);
  cfg.caps["module:mis-batch-stage-signer"] = [0, 1]; c = await loadCapabilities(sb); assert.equal(c.canSign, false);
  const broken = { rpc: async () => { throw new Error("offline"); } }; c = await loadCapabilities(broken); assert.equal(c.canSign || c.canPack || c.canExcess, false);
});

test("mode label never claims ENFORCE unless the server says so", () => {
  assert.equal(modeLabel({ mode: "AUDIT" }).mode, "AUDIT"); assert.equal(modeLabel({ mode: "ENFORCE" }).mode, "ENFORCE");
  assert.equal(modeLabel(null).mode, "UNKNOWN"); assert.equal(modeLabel({ mode: "weird" }).mode, "UNKNOWN");
});

/* ── integrated flows against the server model ── */
test("authorized stage signing succeeds, replays idempotently, and unauthorized signing is refused with nothing written", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg);
  const key = newIntentKey(); const args = { p_idempotency_key: key, p_product_id: 7, p_batch_number: "B-001", p_work_log_id: 1002, p_route_step_id: 42, p_step_occurrence: 1, p_measured_qty_base: 10, p_evidence_ref: "WB-1" };
  const a = await callRpc(sb, RPC.sign, args); assert.equal(a.kind, "ok"); assert.equal(a.data.stage_role, "FG_BULK");
  const b = await callRpc(sb, RPC.sign, args); assert.equal(b.kind, "ok"); assert.equal(b.replay, true); assert.equal(cfg.signed.length, 1);
  const dup = await callRpc(sb, RPC.sign, { ...args, p_idempotency_key: newIntentKey() }); assert.equal(dup.code, "STAGE_ALREADY_SIGNED");
  const cfg2 = defaultConfig(); cfg2.caps["module:mis-batch-stage-signer"] = [1, 0]; const sb2 = createFake(cfg2);
  const d = await callRpc(sb2, RPC.sign, args); assert.equal(d.kind, "denied"); assert.equal(cfg2.signed.length, 0);
});

test("route ambiguity, BMR ambiguity and activity/step discrepancies are surfaced as server refusals", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg);
  const base = { p_idempotency_key: newIntentKey(), p_product_id: 7, p_batch_number: "B-DUP", p_work_log_id: 1201, p_route_step_id: 42, p_step_occurrence: 1, p_measured_qty_base: 5, p_evidence_ref: "WB" };
  assert.equal((await callRpc(sb, RPC.sign, base)).code, "BMR_IDENTITY_REVIEW");
  assert.equal((await callRpc(sb, RPC.sign, { ...base, p_batch_number: "T-001", p_product_id: 8, p_work_log_id: 2001 })).code, "PRODUCT_ROUTE_COVERAGE");
  assert.equal((await callRpc(sb, RPC.sign, { ...base, p_batch_number: "B-001", p_work_log_id: 1001, p_route_step_id: 42 })).code, "ACTIVITY_STEP_MISMATCH");
  assert.equal((await callRpc(sb, RPC.sign, { ...base, p_batch_number: "B-001", p_work_log_id: 1002, p_route_step_id: 42, p_measured_qty_base: null })).code, "MEASURED_QTY_REQUIRED");
  assert.equal((await callRpc(sb, RPC.sign, { ...base, p_batch_number: "B-001", p_work_log_id: 1002, p_route_step_id: 999 })).code, "STEP_NOT_IN_EFFECTIVE_ROUTE");
  assert.equal(stateFromRefusal("PRODUCT_ROUTE_COVERAGE"), "MISSING_ROUTE"); assert.equal(cfg.signed.length, 0);
});

test("mandatory FG receipt: packing is refused until the FG bulk stage is signed (historical NOT_VERIFIED)", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg);
  const r = await callRpc(sb, RPC.pack, pack()); assert.equal(r.kind, "refused"); assert.equal(r.code, "FG_STAGE_NOT_SIGNED"); assert.equal(r.historical, true); assert.equal(stateFromRefusal(r.code, r.historical), "NOT_VERIFIED");
  assert.equal(cfg.fg[0].qty_on_hand, 10);
});

test("successful packing, then insufficient stock, then authorized measured excess posts atomically", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg); await signB001(cfg, sb);
  const ok = await callRpc(sb, RPC.pack, pack(cfg, { p_lines: [{ sku_id: 71, count: 10 }] })); assert.equal(ok.kind, "ok"); assert.equal(packReceipt(ok.data).required, 5); assert.equal(ok.data.balance_after_base, 5);
  const key = newIntentKey(); const lines = [{ sku_id: 72, count: 100 }];                // 10 kg needed, 5 available
  const ins = await callRpc(sb, RPC.pack, { p_request_id: key, p_packaging_event_id: 5001, p_lines: lines, p_excess: null });
  assert.equal(ins.kind, "insufficient"); assert.deepEqual([ins.data.required_base, ins.data.available_base, ins.data.shortfall_base, ins.data.base_uom, ins.data.excess_permitted], [10, 5, 5, "kg", true]);
  assert.equal(cfg.fg[0].qty_on_hand, 5, "refusal wrote nothing");
  const bad = await callRpc(sb, RPC.pack, { p_request_id: key, p_packaging_event_id: 5001, p_lines: lines, p_excess: { qty_base: 2, reason: "r", evidence_ref: "e" } });
  assert.equal(bad.code, "INSUFFICIENT_AFTER_EXCESS"); assert.equal(cfg.fg[0].qty_on_hand, 5);
  const done = await callRpc(sb, RPC.pack, { p_request_id: key, p_packaging_event_id: 5001, p_lines: lines, p_excess: { qty_base: 5, reason: "measured on scale", evidence_ref: "WB-9" } });
  assert.equal(done.kind, "ok"); assert.equal(done.data.excess_base, 5); assert.equal(done.data.balance_after_base, 0); assert.equal(cfg.packCommits, 2);
});

test("unauthorized excess: server reports excess_permitted=false and rejects a forced excess", async () => {
  const cfg = defaultConfig(); cfg.caps["module:mis-fg-excess-adjustment"] = [0, 0]; const sb = createFake(cfg); await signB001(cfg, sb);
  const ins = await callRpc(sb, RPC.pack, pack(cfg, { p_lines: [{ sku_id: 72, count: 200 }] })); assert.equal(ins.kind, "insufficient"); assert.equal(ins.data.excess_permitted, false);
  const forced = await callRpc(sb, RPC.pack, pack(cfg, { p_lines: [{ sku_id: 72, count: 200 }], p_excess: { qty_base: 10, reason: "x", evidence_ref: "y" } })); assert.equal(forced.code, "EXCESS_NOT_AUTHORIZED"); assert.equal(cfg.fg[0].qty_on_hand, 10);
});

test("atomic failure and retry: deadlock retries reuse the same key; lost response retried with the same key never double-posts", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg); await signB001(cfg, sb);
  const args = pack(cfg, { p_lines: [{ sku_id: 71, count: 2 }] });
  cfg.faults.push({ rpc: RPC.pack, mode: "deadlock", times: 2 });
  const r1 = await callRpc(sb, RPC.pack, args, { sleep: noSleep }); assert.equal(r1.kind, "ok"); assert.equal(cfg.packCommits, 1);
  assert.ok(cfg.log.filter((l) => l.name === RPC.pack).every((l) => l.args.p_request_id === args.p_request_id));
  const a2 = pack(cfg, { p_lines: [{ sku_id: 72, count: 10 }] });
  cfg.faults.push({ rpc: RPC.pack, mode: "network-after" });                      // committed, response lost
  const lost = await callRpc(sb, RPC.pack, a2, { sleep: noSleep }); assert.equal(lost.kind, "uncertain"); assert.equal(cfg.packCommits, 2);
  const retry = await callRpc(sb, RPC.pack, a2, { sleep: noSleep }); assert.equal(retry.kind, "ok"); assert.equal(retry.replay, true); assert.equal(cfg.packCommits, 2, "no duplicate posting");
  cfg.faults.push({ rpc: RPC.pack, mode: "network-before" });
  const a3 = pack(cfg, { p_lines: [{ sku_id: 73, count: 1 }] }); assert.equal((await callRpc(sb, RPC.pack, a3, { sleep: noSleep })).kind, "uncertain"); assert.equal((await callRpc(sb, RPC.pack, a3, { sleep: noSleep })).kind, "ok"); assert.equal(cfg.packCommits, 3);
  const reuse = await callRpc(sb, RPC.pack, { ...a3, p_lines: [{ sku_id: 73, count: 5 }] }); assert.equal(reuse.code, "IDEMPOTENCY_KEY_REUSED");
  cfg.faults.push({ rpc: RPC.pack, mode: "deadlock", times: 9 });
  assert.equal((await callRpc(sb, RPC.pack, pack(cfg), { sleep: noSleep })).code, "RETRY_EXHAUSTED");
});

test("pack corrections: decrease, increase beyond stock with excess, removal, and historical no-basis refusal", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg); cfg.fg[1].qty_on_hand = 100;
  const c = (over) => ({ p_request_id: newIntentKey(), p_event_sku_id: 9001, p_new_count: 4, p_reason: "miscount", p_excess: null, ...over });
  const dec = await callRpc(sb, RPC.correctPack, c()); assert.equal(dec.kind, "ok"); const r = correctionReceipt(dec.data); assert.deepEqual([r.oldCount, r.newCount, r.stockDelta], [10, 4, 3]); assert.equal(r.balanceAfter, 103);
  const rem = await callRpc(sb, RPC.correctPack, c({ p_new_count: 0 })); assert.equal(rem.data.line_removed, true); assert.equal(correctionReceipt(rem.data).stockDelta, 2); assert.ok(!cfg.event_skus.some((l) => l.id === 9001));
  const hist = await callRpc(sb, RPC.correctPack, c({ p_event_sku_id: 9002, p_new_count: 5 })); assert.equal(hist.code, "CORRECTION_NO_DEPLETION_BASIS"); assert.equal(hist.historical, true);
  const same = await callRpc(sb, RPC.correctPack, c({ p_event_sku_id: 9002, p_new_count: 20 })); assert.equal(same.code, "CORRECTION_NO_CHANGE");
  cfg.fg[1].qty_on_hand = 1; const big = c({ p_event_sku_id: 9002, p_new_count: 99 });  // 9002 has no basis; use a freshly packed line instead
  cfg.depletionBasis[9002] = true; const ins = await callRpc(sb, RPC.correctPack, big); assert.equal(ins.kind, "insufficient"); assert.equal(ins.data.excess_permitted, true);
  const withEx = await callRpc(sb, RPC.correctPack, { ...big, p_excess: { qty_base: 10, reason: "re-weighed", evidence_ref: "WB-3" } }); assert.equal(withEx.kind, "ok");
  assert.equal((await callRpc(sb, RPC.correctPack, c({ p_event_sku_id: 9002, p_reason: " " }))).code, "INVALID_INPUT");
});

test("stage correction voids a signature; source revision then requires re-signing; Done closure alone does not", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg); const s = await signB001(cfg, sb);
  const wl = cfg.logs.find((l) => l.id === 1002);
  // S6: normal FG inventory closure (status -> Done) does not change the fingerprint
  wl.status = "Closed"; assert.equal((await callRpc(sb, RPC.pack, pack(cfg, { p_lines: [{ sku_id: 71, count: 1 }] }))).kind, "ok");
  // a genuine source revision (quantity) DOES: the server refuses and the operator must correct + re-sign
  wl.storage_qty = 9; const chg = await callRpc(sb, RPC.pack, pack(cfg, { p_lines: [{ sku_id: 71, count: 1 }] })); assert.equal(chg.code, "STAGE_SOURCE_CHANGED"); assert.equal(stateFromRefusal(chg.code), "SOURCE_CHANGED");
  const corr = await callRpc(sb, RPC.correctStage, { p_idempotency_key: newIntentKey(), p_event_id: s.data.event_id, p_reason: "log quantity corrected" }); assert.equal(corr.kind, "ok");
  assert.equal((await callRpc(sb, RPC.correctStage, { p_idempotency_key: newIntentKey(), p_event_id: s.data.event_id, p_reason: "again" })).code, "ALREADY_CORRECTED");
  assert.equal((await callRpc(sb, RPC.sign, { p_idempotency_key: newIntentKey(), p_product_id: 7, p_batch_number: "B-001", p_work_log_id: 1002, p_route_step_id: 42, p_step_occurrence: 1, p_measured_qty_base: 9, p_evidence_ref: "WB-2" })).kind, "ok");
});

test("readiness is admin-gated and AUDIT is reported as AUDIT; no enforcement or core sign-off RPC is wrapped by the client", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg);
  assert.equal((await callRpc(sb, RPC.readiness, { p_days: 7 })).kind, "denied");
  cfg.caps["module:mis-g7-enforcement-admin"] = [1, 0]; const r = await callRpc(sb, RPC.readiness, { p_days: 7 }); assert.equal(r.kind, "ok"); assert.equal(modeLabel(r.data).mode, "AUDIT");
  const rpcValues = Object.values(RPC); assert.ok(!rpcValues.some((v) => /set_enforcement|record_core_migration/.test(v)));
  assert.equal(describeRefusal("NOPE").kind, "other");
});

/* ───────── S7 client contract helpers ───────── */
test("S7 RPC names are in client_rpc_contract.json with their documented arguments", () => {
  const by = Object.fromEntries(contract.rpcs.map((r) => [r.name, r]));
  for (const k of ["routeContext", "stageStatus", "preview", "exceptions"]) assert.ok(by[RPC[k]], RPC[k]);
  assert.deepEqual(by[RPC.routeContext].args.map((a) => a[0]), ["p_product_id", "p_batch", "p_work_log_id"]);
  assert.deepEqual(by[RPC.preview].args.map((a) => a[0]), ["p_packaging_event_id", "p_lines", "p_event_sku_id", "p_new_count"]);
  assert.deepEqual(by[RPC.exceptions].args.map((a) => a[0]), ["p_from", "p_to", "p_limit", "p_offset"]);
  for (const code of by[RPC.routeContext].codes) assert.ok(REFUSALS[code], `no wording for ${code}`);
  for (const code of by[RPC.preview].preview_codes.filter((c) => c !== "OK" && c !== "INSUFFICIENT_BULK")) assert.ok(REFUSALS[code], `no wording for preview ${code}`);
});
test("absence of S7 is classified as unavailable (never as a failure of the operation)", () => {
  for (const e of [{ code: "42883", message: "x" }, { code: "PGRST202", message: "x" }, { message: "Could not find the function public.mis_get_batch_stage_status_v1" }]) assert.equal(classifyRpc({ error: e }).kind, "unavailable");
});
test("ids: bigint-safe argument passing; negative and >2^53 identities survive", () => {
  assert.equal(idArg("103"), 103); assert.equal(idArg("-701"), -701); assert.equal(idArg("9007199254740993"), "9007199254740993"); assert.equal(idArg(-9007199254740993n), "-9007199254740993");
});
test("context steps: all offered steps are signable, ADDED steps keep their negative text id, labels distinguish inherited from product routes", () => {
  const ctx = { route_kind: "ROUTE_FAMILY_INHERITED", family_route_id: "11", steps: [{ route_step_id: "103", step_kind: "BASE", sequence_no: 30, activity_name: "FG bulk storage", stage_role: "FG_BULK", activity_matches: true, is_mandatory: true }, { route_step_id: "-701", step_kind: "ADDED", sequence_no: 15, activity_name: "Heating", stage_role: "OTHER", activity_matches: false }] };
  const s = contextSteps(ctx); assert.deepEqual(s.map((x) => [x.stepId, x.isFg, x.matches, x.kind]), [["103", true, true, "BASE"], ["-701", false, false, "ADDED"]]);
  assert.equal(routeLabel(ctx), "inherited family route #11"); assert.equal(routeLabel({ product_route_id: "21" }), "product route #21");
});
test("preview wording: blocking outcomes block, insufficient does not, excess authority shapes the hint", () => {
  assert.equal(describePreview({ preview_code: "OK" }).blocking, false);
  assert.equal(describePreview({ preview_code: "INSUFFICIENT_BULK", excess_permitted: true }).blocking, false); assert.match(describePreview({ preview_code: "INSUFFICIENT_BULK", excess_permitted: true }).fix, /excess/i); assert.doesNotMatch(describePreview({ preview_code: "INSUFFICIENT_BULK", excess_permitted: false }).fix, /can be recorded/);
  for (const c of ["FG_STAGE_NOT_SIGNED", "STAGE_SOURCE_CHANGED", "FG_RECEIPT_MISSING", "CORRECTION_NO_DEPLETION_BASIS", "CORRECTION_LEDGER_MISMATCH", "CORRECTION_NO_CHANGE"]) assert.equal(describePreview({ preview_code: c }).blocking, true, c);
  assert.equal(describePreview({ preview_code: "FG_STAGE_NOT_SIGNED" }).state, "NOT_VERIFIED"); assert.equal(describePreview({ preview_code: "STAGE_SOURCE_CHANGED" }).state, "SOURCE_CHANGED");
  assert.equal(eventState({ state: "SIGNED" }), "SIGNED"); assert.equal(eventState({ state: "SOURCE_CHANGED" }), "SOURCE_CHANGED"); assert.equal(eventState({ state: "CORRECTED" }), null);
});
test("S7 reads send exactly the documented arguments (pack and correct previews are exclusive)", async () => {
  const seen = []; const client = { rpc: async (n, a) => { seen.push([n, a]); return { data: { ok: true }, error: null }; } };
  await getRouteContext(client, 21, "B", 5); await getStageStatus(client, 21, "B"); await getPreview(client, "5001", { lines: [{ sku_id: 1, count: 2 }] }); await getPreview(client, 5001, { eventSkuId: 9, newCount: 0 }); await getExceptionSummary(client, "2026-11-01", "2026-11-30", 25, 50);
  assert.deepEqual(seen.map((x) => x[0]), [RPC.routeContext, RPC.stageStatus, RPC.preview, RPC.preview, RPC.exceptions]);
  assert.deepEqual(seen[2][1], { p_packaging_event_id: 5001, p_lines: [{ sku_id: 1, count: 2 }], p_event_sku_id: null, p_new_count: null });
  assert.deepEqual(seen[3][1], { p_packaging_event_id: 5001, p_lines: null, p_event_sku_id: 9, p_new_count: 0 });
  assert.deepEqual(seen[4][1], { p_from: "2026-11-01", p_to: "2026-11-30", p_limit: 25, p_offset: 50 });
});
test("capabilities add the executive-MIS exception view without granting any write right", async () => {
  const cfg = defaultConfig(); cfg.caps["module:executive-mis-dashboard"] = [1, 0]; const c = await loadCapabilities(createFake(cfg));
  assert.equal(c.canViewExceptions, true); assert.equal(c.canSign && c.canPack, true); cfg.caps = { "module:executive-mis-dashboard": [1, 0] }; const only = await loadCapabilities(createFake(cfg)); assert.deepEqual([only.canViewExceptions, only.canSign, only.canPack, only.canExcess], [true, false, false, false]);
});
test("model parity: signing requires an evidence reference (live S2 contract)", async () => {
  const cfg = defaultConfig(); const sb = createFake(cfg);
  const r = await callRpc(sb, RPC.sign, { p_idempotency_key: newIntentKey(), p_product_id: 7, p_batch_number: "B-001", p_work_log_id: 1002, p_route_step_id: 42, p_step_occurrence: 1, p_measured_qty_base: 10, p_evidence_ref: null });
  assert.equal(r.code, "INVALID_INPUT"); assert.equal(cfg.signed.length, 0);
});
