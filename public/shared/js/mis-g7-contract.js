// MIS G7 client contract layer (pure logic, no DOM). Mirrors docs/executive-mis-g7-server/client_rpc_contract.json
// (contract_version mis-g7-s2-s5b/1). The server is authoritative for every decision; nothing here grants access,
// computes stock, or infers signed evidence. Clients never use service-role credentials or private-schema reads.

export const CONTRACT_VERSION = "mis-g7-s2-s5b/1";

/** The five NEW MIS permission targets (none assigned to any production user by this package). */
export const MIS_TARGETS = Object.freeze({
  signer: "module:mis-batch-stage-signer",
  packing: "module:mis-fg-bulk-packing",
  excess: "module:mis-fg-excess-adjustment",
  enforcementAdmin: "module:mis-g7-enforcement-admin",
  coreSignoff: "module:mis-g7-core-migration-signoff",
});
export const PAGE_MODULE_KEY = "mis-batch-governance";
export const PAGE_TARGET = `module:${PAGE_MODULE_KEY}`;

export const RPC = Object.freeze({
  sign: "mis_sign_batch_stage_v1",
  correctStage: "mis_correct_batch_stage_v1",
  pack: "mis_pack_fg_bulk_v1",
  correctPack: "mis_correct_pack_line_v1",
  readiness: "mis_g7_enforcement_readiness_v1",
  effectiveRoute: "rpc_get_effective_product_process_route",
  // S7 (prepared; absent until installed): shared route context, persistent status, advisory preview, live exceptions
  routeContext: "mis_get_batch_route_context_v1",
  stageStatus: "mis_get_batch_stage_status_v1",
  preview: "mis_preview_pack_fg_bulk_v1",
  exceptions: "mis_get_governance_exception_summary_v1",
});

/** Server refusal code -> operator wording. `kind` drives severity styling, `fix` is a short next step. */
export const REFUSALS = Object.freeze({
  // stage signing
  ACTIVITY_STEP_MISMATCH: { kind: "identity", title: "Work-log activity does not match the route step", fix: "Pick the work log whose activity is this step." },
  APPROVED_ROUTE_OVERLAP: { kind: "route", title: "More than one approved route covers this date", fix: "Route master must be corrected before signing." },
  BMR_IDENTITY_REVIEW: { kind: "identity", title: "Batch does not resolve to exactly one BMR", fix: "BMR identity needs review in BMR administration." },
  EFFECTIVE_DATE_ROUTE_GAP: { kind: "route", title: "Approved routes exist but none is effective on the work-log date", fix: "Route master needs an effective-dated version." },
  FG_RECEIPT_EVIDENCE_MISSING: { kind: "evidence", title: "No ledger receipt was posted for this FG work log", fix: "Transfers, packaging returns and manual stock entries are not receipts; the FG bulk storage log itself must have posted its receipt." },
  FG_RECEIPT_LEDGER_MISMATCH: { kind: "evidence", title: "The ledger receipt of this work log differs from the logged quantity", fix: "Reconcile the log and its stock receipt before signing." },
  FG_UOM_MISMATCH: { kind: "evidence", title: "FG receipt unit differs from the base unit", fix: "Correct the receipt unit at source." },
  IDEMPOTENCY_KEY_REUSED: { kind: "idempotency", title: "This request key was already used for a different request", fix: "Start the action again." },
  INVALID_INPUT: { kind: "input", title: "Input rejected by the server", fix: "Check the entered values." },
  MANDATORY_FG_STAGE_GAP: { kind: "route", title: "The effective route lacks exactly one mandatory FG bulk storage step", fix: "Route master deficiency; signing is blocked." },
  MEASURED_QTY_MISMATCH: { kind: "evidence", title: "Measured quantity differs from the logged receipt", fix: "Re-measure or correct the logged receipt." },
  MEASURED_QTY_REQUIRED: { kind: "input", title: "Measured quantity is required for this stage", fix: "Enter the measured quantity in the base unit." },
  PRODUCT_ROUTE_COVERAGE: { kind: "route", title: "No approved route covers this product", fix: "Route master deficiency; signing is blocked." },
  STAGE_ALREADY_SIGNED: { kind: "state", title: "This stage occurrence is already signed", fix: "Use governed correction if it must change." },
  STEP_NOT_IN_EFFECTIVE_ROUTE: { kind: "route", title: "Step is not part of the effective route", fix: "Select a step from the listed route." },
  WORK_LOG_IDENTITY_MISMATCH: { kind: "identity", title: "Work log does not belong to this product and batch", fix: "Re-select the work log." },
  // stage correction
  EVENT_NOT_FOUND: { kind: "state", title: "Signed event not found", fix: "Check the event number." },
  ONLY_SIGN_CAN_BE_CORRECTED: { kind: "state", title: "Only a signature can be corrected", fix: "Select the original signed event." },
  ALREADY_CORRECTED: { kind: "state", title: "This signature is already corrected", fix: "Sign the stage again if required." },
  // packing / pack correction
  BATCH_IDENTITY_MISSING: { kind: "identity", title: "Batch identity is missing on this packaging event", fix: "Resolve the batch identity first." },
  EVENT_NOT_BULK_AFFECTING: { kind: "state", title: "This packaging event does not move bulk stock", fix: "Select a depleting packaging event." },
  EVENT_NOT_DEPLETING: { kind: "state", title: "This packaging event does not deplete bulk stock", fix: "Select a depleting packaging event." },
  EXCESS_INVALID: { kind: "input", title: "Measured excess is incomplete", fix: "Enter quantity, reason and evidence reference." },
  EXCESS_NOT_AUTHORIZED: { kind: "permission", title: "You are not authorized to record measured excess", fix: "Ask an authorized operator." },
  EXCESS_NOT_NEEDED: { kind: "state", title: "Stock is sufficient; excess is not needed", fix: "Post without excess." },
  FG_RECEIPT_MISSING: { kind: "evidence", title: "No exact FG receipt evidence for the signed stage", fix: "The signed FG work log must have a ledger receipt equal to its logged quantity; transfers, returns and manual entries do not count." },
  FG_STAGE_NOT_SIGNED: { kind: "state", title: "FG bulk stage is not signed for this batch", fix: "Sign the FG bulk stage first.", historical: true },
  INSUFFICIENT_AFTER_EXCESS: { kind: "stock", title: "Stock is still insufficient after the measured excess", fix: "Re-measure the excess or reduce the counts." },
  INSUFFICIENT_BULK: { kind: "stock", title: "Insufficient bulk stock", fix: "Reduce counts or record measured excess if authorized." },
  PACKAGING_EVENT_CHANGED: { kind: "state", title: "Packaging event changed since it was loaded", fix: "Reload and review." },
  PACKAGING_EVENT_NOT_FOUND: { kind: "state", title: "Packaging event not found", fix: "Reload and select again." },
  SKU_CONVERSION_INVALID: { kind: "identity", title: "SKU cannot be converted to the bulk base unit", fix: "SKU master data needs correction." },
  SKU_LINE_EXISTS: { kind: "state", title: "A line for this SKU already exists on the event", fix: "Use a governed correction on that line." },
  SKU_NOT_FOUND: { kind: "identity", title: "SKU not found", fix: "Reload and select again." },
  SKU_PACK_SIZE_INVALID: { kind: "identity", title: "SKU pack size is invalid", fix: "SKU master data needs correction." },
  SKU_PRODUCT_MISMATCH: { kind: "identity", title: "SKU belongs to another product", fix: "Select this product's SKUs only." },
  STAGE_SOURCE_CHANGED: { kind: "state", title: "Source changed after the stage was signed", fix: "Correct the signature and sign the stage again.", resign: true },
  // S7 route context
  ROUTE_INVALID: { kind: "route", title: "The effective route is not valid", fix: "Route master deficiency; signing is blocked." },
  ROUTE_RESOLUTION_ERROR: { kind: "route", title: "The route could not be resolved", fix: "Route master needs review; signing is blocked." },
  // pack correction
  CORRECTION_LEDGER_MISMATCH: { kind: "evidence", title: "Stock ledger does not match this line's recorded depletion", fix: "Blocked; needs evidence-first repair." },
  CORRECTION_LINE_CHANGED: { kind: "state", title: "Line changed since it was loaded", fix: "Reload and review." },
  CORRECTION_LINE_NOT_FOUND: { kind: "state", title: "Line not found", fix: "Reload and select again." },
  CORRECTION_NO_CHANGE: { kind: "input", title: "Proposed count equals the existing count", fix: "Enter a different count." },
  CORRECTION_NO_DEPLETION_BASIS: { kind: "evidence", title: "This line has no recorded depletion evidence", fix: "Blocked: historical line; no backfill or correction is supported.", historical: true },
  // enforcement / core
  CORE_MIGRATION_NOT_ACCEPTED: { kind: "state", title: "Core migration not accepted", fix: "ENFORCE requires separately governed core sign-off." },
  MODE_UNCHANGED: { kind: "state", title: "Mode unchanged", fix: "" },
});

const RAISED = Object.freeze({
  MIS_G7_AUTH_REQUIRED: "Sign in again to continue.",
  MIS_G7_DEPLETION_MISMATCH: "Atomic posting failed: depletion did not reconcile. Nothing was posted.",
  MIS_G7_CORRECTION_MISMATCH: "Atomic correction failed: ledger did not reconcile. Nothing was changed.",
  MIS_G7_NEGATIVE_BALANCE: "Posting would make the bulk balance negative. Nothing was posted.",
  MIS_G7_SOURCE_ID_OVERFLOW: "Posting was refused by a server limit. Nothing was posted.",
  MIS_G7_DIRECT_PACKING_DENIED: "Direct packing writes are refused under ENFORCE. Use the governed packing screen.",
});

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

/** UUID v4 for one user intent. */
export function newIntentKey() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  (c?.getRandomValues ? c.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256))));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * One idempotency key per user intent. An intent is identified by a caller-supplied scope string (e.g. the
 * packaging event + SKU lines). The key survives retries after uncertain network outcomes and the
 * refusal -> measured-excess confirmation of the same intent (refusals store nothing server-side); it is
 * released only on a definitive outcome (success or a refusal the operator cannot resolve in place).
 */
export class IntentRegistry {
  constructor(keyFn = newIntentKey) { this.keyFn = keyFn; this.map = new Map(); }
  keyFor(scope) { if (!this.map.has(scope)) this.map.set(scope, this.keyFn()); return this.map.get(scope); }
  has(scope) { return this.map.has(scope); }
  release(scope) { this.map.delete(scope); }
  get size() { return this.map.size; }
}

/** Stable scope string for a pack / correction intent (order-independent for lines). */
export function packScope(eventId, lines) {
  const l = [...(lines || [])].map((x) => `${x.sku_id}:${x.count}`).sort().join(",");
  return `pack|${eventId}|${l}`;
}
export const correctPackScope = (eventSkuId, newCount) => `cpack|${eventSkuId}|${newCount}`;
export const correctStageScope = (eventId) => `cstage|${eventId}`;
export const signScope = (a) => `sign|${a.productId}|${a.batch}|${a.workLogId}|${a.routeStepId}|${a.occurrence}`;

/**
 * Classify a Supabase RPC response.
 * kind: ok | refused | insufficient | denied | retryable | raised | uncertain
 * `uncertain` = the request may or may not have been committed (network/timeout/5xx without a domain code).
 */
export function classifyRpc(res) {
  const { data, error } = res || {};
  if (error) {
    const code = String(error.code ?? "");
    const msg = String(error.message ?? "");
    const status = Number(error.status ?? error.statusCode ?? NaN);
    const m = /MIS_G7_[A-Z_]+/.exec(msg);
    if (code === "42883" || code === "PGRST202" || /could not find the function|function .* does not exist/i.test(msg)) return { kind: "unavailable", code: code || "UNAVAILABLE", message: "This server function is not installed." };
    if (code === "40P01" || code === "40001") return { kind: "retryable", code, message: msg };
    if (code === "42501" || status === 401 || status === 403) {
      const raisedCode = m?.[0];
      return { kind: "denied", code: raisedCode || "PERMISSION_DENIED", message: raisedCode && RAISED[raisedCode] ? RAISED[raisedCode] : "You do not have permission for this action." };
    }
    if (m) return { kind: "raised", code: m[0], message: RAISED[m[0]] || "The server rolled the whole request back. Nothing was changed." };
    if (code === "P0001" || code === "22003" || code === "22023") return { kind: "raised", code: code, message: "The server rolled the whole request back. Nothing was changed." };
    const network = !code && (!Number.isFinite(status) || status === 0 || status >= 500 || status === 408 || status === 429 ||
      /failed to fetch|network|timeout|timed out|abort|load failed|socket|ECONN/i.test(msg));
    if (network || status >= 500) return { kind: "uncertain", code: "NETWORK_UNCERTAIN", message: "Connection problem: the server may or may not have recorded this. Retry to confirm; the same request key prevents a duplicate." };
    return { kind: "raised", code: code || "ERROR", message: msg || "Request failed." };
  }
  if (data && typeof data === "object" && data.ok === false) {
    if (data.code === "INSUFFICIENT_BULK") return { kind: "insufficient", code: data.code, data, historical: data.historical_state === "NOT_VERIFIED" };
    return { kind: "refused", code: data.code || "REFUSED", data, historical: data.historical_state === "NOT_VERIFIED" || !!REFUSALS[data.code]?.historical };
  }
  if (data && typeof data === "object" && data.ok === true) return { kind: "ok", data, replay: data.idempotent_replay === true };
  return { kind: "uncertain", code: "UNEXPECTED_RESPONSE", message: "Unexpected server response; outcome could not be confirmed." };
}

/** Receipt-evidence finding codes of mis_g7_fg_receipt (preview receipt_code, exception detail, writer `receipt`). */
export const RECEIPT_CODES = Object.freeze({
  OK: "Exact receipt evidence",
  NO_SOURCE_LEDGER: "No ledger receipt posted by the FG work log (other positive stock does not count)",
  LEDGER_MISMATCH: "Ledger receipt differs from the logged quantity",
  NOT_FG_RECEIPT_LOG: "Not an FG bulk storage log of this product and batch",
  QTY_NOT_POSITIVE: "FG work log has no positive quantity",
  UOM_MISMATCH: "FG work log unit is not the product base unit",
  NO_FG_LOG: "No FG bulk storage log for this batch",
  PACKING_LINE_WITHOUT_DEPLETION: "Packing line without recorded depletion",
});
export const receiptText = (c) => RECEIPT_CODES[c] || REFUSALS[c]?.title || String(c || "").replace(/_/g, " ").toLowerCase();

export function describeRefusal(code) {
  return REFUSALS[code] || { kind: "other", title: code ? `Refused: ${code}` : "Refused", fix: "" };
}

/**
 * Call an RPC. Deadlock/serialization failures (40P01/40001) are retried up to 3x with the SAME arguments
 * (so the same idempotency key); a thrown/transport failure is reported as `uncertain`, never swallowed.
 */
export async function callRpc(client, name, args, { sleep = sleepDefault, maxRetries = 3, signal } = {}) {
  let attempt = 0;
  for (;;) {
    let res;
    try { res = await client.rpc(name, args); } catch (e) { res = { data: null, error: { message: String(e?.message || e) } }; }
    const c = classifyRpc(res);
    if (c.kind === "retryable" && attempt < maxRetries && !signal?.aborted) { attempt += 1; await sleep(120 * 2 ** attempt); continue; }
    if (c.kind === "retryable") return { kind: "uncertain", code: "RETRY_EXHAUSTED", message: "The server was busy. Retry shortly; the same request key prevents a duplicate." };
    return c;
  }
}

/* ───────── request builders / validation ───────── */

const isPosInt = (n) => Number.isInteger(n) && n > 0;

export function normalizeLines(rows) {
  const lines = []; const errors = []; const seen = new Set();
  for (const r of rows || []) {
    const raw = r.count; if (raw === "" || raw == null) continue;
    const count = Number(raw); const sku = Number(r.sku_id);
    if (!isPosInt(count)) { errors.push(`SKU ${r.label ?? sku}: count must be a whole number above 0`); continue; }
    if (!Number.isInteger(sku) || sku <= 0) { errors.push("Invalid SKU"); continue; }
    if (seen.has(sku)) { errors.push(`SKU ${r.label ?? sku} appears twice`); continue; }
    seen.add(sku); lines.push({ sku_id: sku, count });
  }
  if (!lines.length && !errors.length) errors.push("Enter at least one SKU count");
  return { lines, errors };
}

export function validateExcess(x) {
  const errors = [];
  const qty = Number(x?.qty_base);
  if (!(Number.isFinite(qty) && qty > 0)) errors.push("Measured excess must be a number above 0");
  if (!String(x?.reason ?? "").trim()) errors.push("Reason is required");
  if (!String(x?.evidence_ref ?? "").trim()) errors.push("Evidence reference is required");
  return { ok: !errors.length, errors, value: errors.length ? null : { qty_base: qty, evidence_ref: String(x.evidence_ref).trim(), reason: String(x.reason).trim() } };
}

export const fmtQty = (n, d = 3) => (n == null || n === "" || !Number.isFinite(Number(n)) ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d }));

/** Normalise a successful pack response into display rows (server values only). */
export function packReceipt(d) {
  return {
    replay: d.idempotent_replay === true, requestId: d.request_id, product: d.product_id, batch: d.batch_number,
    eventId: d.packaging_event_id, required: d.required_base, availableBefore: d.available_before_base,
    excess: d.excess_base, excessId: d.excess_id, balanceAfter: d.balance_after_base, uom: d.base_uom, skuLineIds: d.event_sku_ids || [],
  };
}
export function correctionReceipt(d) {
  return { replay: d.idempotent_replay === true, requestId: d.request_id, eventSkuId: d.event_sku_id, eventId: d.packaging_event_id,
    batch: d.batch_number, oldCount: d.old_count, newCount: d.new_count, removed: d.line_removed === true, stockDelta: d.stock_delta_base,
    excess: d.excess_base, balanceAfter: d.balance_after_base, uom: d.base_uom };
}

/**
 * Governance state of a batch/stage for operator and Executive MIS wording.
 * Only server facts are accepted; the client never marks anything SIGNED from history.
 */
export const GOVERNANCE_STATES = Object.freeze({
  SIGNED: { label: "Signed", tone: "ok", text: "Stage signed under the governed workflow; source unchanged since signing." },
  UNSIGNED: { label: "Unsigned", tone: "warn", text: "Governed record exists for the route but no signature yet." },
  SOURCE_CHANGED: { label: "Source changed", tone: "warn", text: "The work log changed after signing. Correct the signature and sign again." },
  MISSING_ROUTE: { label: "Missing route", tone: "danger", text: "No effective approved route (or route deficiency). Route master must be corrected; signing is blocked." },
  MISSING_RECEIPT: { label: "Missing FG receipt", tone: "danger", text: "No signed FG bulk receipt, so governed packing is blocked." },
  NOT_VERIFIED: { label: "Not verified", tone: "muted", text: "Historical record with no signed evidence. Not assumed correct and not backfilled." },
  BMR_IDENTITY_REVIEW: { label: "BMR review", tone: "danger", text: "The batch does not resolve to exactly one BMR. Identity must be reviewed before any signing." },
});

export function stateFromRefusal(code, historical) {
  if (code === "BMR_IDENTITY_REVIEW") return "BMR_IDENTITY_REVIEW";
  if (code === "ROUTE_INVALID" || code === "ROUTE_RESOLUTION_ERROR") return "MISSING_ROUTE";
  if (code === "STAGE_SOURCE_CHANGED") return "SOURCE_CHANGED";
  if (code === "FG_RECEIPT_MISSING" || code === "FG_RECEIPT_EVIDENCE_MISSING") return "MISSING_RECEIPT";
  if (["PRODUCT_ROUTE_COVERAGE", "EFFECTIVE_DATE_ROUTE_GAP", "APPROVED_ROUTE_OVERLAP", "MANDATORY_FG_STAGE_GAP", "STEP_NOT_IN_EFFECTIVE_ROUTE"].includes(code)) return "MISSING_ROUTE";
  if (historical || code === "FG_STAGE_NOT_SIGNED" || code === "CORRECTION_NO_DEPLETION_BASIS") return "NOT_VERIFIED";
  return null;
}

/** Owner-documented historical audit snapshot (1–21 Nov 2026). Reference only; not live counts, never a backfill input. */
export const HISTORICAL_AUDIT_SNAPSHOT = Object.freeze({
  window: "1–21 Nov 2026",
  source: "Executive MIS G7 handover, 24 Nov 2026",
  fgBulkLogs: 80,
  routeMasterDeficiencies: Object.freeze({ PRODUCT_ROUTE_COVERAGE: 52, MANDATORY_FG_STAGE_GAP: 17, APPROVED_ROUTE_OVERLAP: 1, ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED: 10 }),
  missingDepletionLines: 29,
  missingDepletionProductBatches: 20,
});

/* ───────── effective route -> signable steps ───────── */

/** Normalise rpc_get_effective_product_process_route output. Only BASE steps (base_step_id) match the signer's step identity. */
export function signableSteps(route) {
  const status = route?.readiness_status || "UNKNOWN";
  const steps = Array.isArray(route?.steps) ? route.steps : [];
  const rows = steps.map((s) => ({
    stepId: s.base_step_id != null ? Number(s.base_step_id) : null,
    key: s.effective_step_key, seq: Number(s.sequence_no), activity: s.activity_name, mandatory: !!s.is_mandatory,
    allowsRepeat: !!s.allows_repeat, expected: s.expected_occurrence_count != null ? Number(s.expected_occurrence_count) : null,
    isFg: s.activity_name === "FG bulk storage", source: s.source_type,
    signable: s.base_step_id != null,
  }));
  const fg = rows.filter((r) => r.isFg && r.mandatory);
  const gaps = [];
  if (status !== "READY") gaps.push({ code: "ROUTE_NOT_READY", text: `Route readiness: ${status}` });
  if (status === "READY" && fg.length !== 1) gaps.push({ code: "MANDATORY_FG_STAGE_GAP", text: "Effective route lacks exactly one mandatory FG bulk storage step." });
  if (rows.some((r) => !r.signable)) gaps.push({ code: "OVERRIDE_STEP_NOT_SIGNABLE", text: "Product-specific override steps are not signable under the current server contract." });
  return { status, routeId: route?.product_route_id ?? null, familyRouteId: route?.base_route_family_route_id ?? null, steps: rows, gaps, asOf: route?.as_of_date ?? null };
}

/* ───────── capabilities ───────── */

/** Resolve presentation capabilities from canonical app_has_permission results. Server stays authoritative. */
export async function loadCapabilities(client, { check } = {}) {
  const ask = check || (async (target, mode) => {
    try {
      const { data, error } = await client.rpc("app_has_permission", { p_target: target, p_mode: mode });
      return !error && data === true;
    } catch { return false; }
  });
  const entries = Object.entries(MIS_TARGETS);
  const out = {};
  await Promise.all(entries.map(async ([k, t]) => {
    const [v, e] = await Promise.all([ask(t, "view"), ask(t, "edit")]);
    out[k] = { view: v, edit: v && e };           // the server requires view AND edit for writes
  }));
  const execView = await ask("module:executive-mis-dashboard", "view");
  return {
    canViewExceptions: execView,
    canSign: out.signer.edit, canPack: out.packing.edit, canExcess: out.packing.edit && out.excess.edit,
    canViewReadiness: out.enforcementAdmin.view, canSwitchMode: out.enforcementAdmin.edit, canCoreSignoff: out.coreSignoff.edit,
    raw: out,
  };
}

/** Whether the AUDIT/ENFORCE banner should say ENFORCE. Anything unknown is shown as "Mode unknown". */
export function modeLabel(readiness) {
  const m = readiness?.mode;
  if (m === "ENFORCE") return { mode: "ENFORCE", tone: "danger", text: "ENFORCE: direct bulk packing writes are refused; use governed packing only." };
  if (m === "AUDIT") return { mode: "AUDIT", tone: "info", text: "AUDIT: legacy logging and packing still work and are only observed. Governed paths are available but not mandatory." };
  return { mode: "UNKNOWN", tone: "muted", text: "Enforcement mode not visible to your account. Legacy paths remain available unless the server refuses them." };
}

/* ───────── S7 read contracts (bigint-safe: ids are TEXT in responses) ───────── */

/** Signed integer argument for bigint RPC parameters: a safe number when possible, else the exact decimal string. */
export function idArg(v) {
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : String(v);
}
export const DAYS = 86400000;

export async function getRouteContext(client, productId, batch, workLogId, opts) {
  return callRpc(client, RPC.routeContext, { p_product_id: productId, p_batch: batch, p_work_log_id: workLogId }, opts);
}
export async function getStageStatus(client, productId, batch, opts) {
  return callRpc(client, RPC.stageStatus, { p_product_id: productId, p_batch: batch }, opts);
}
/** Advisory preview of a pack ({lines}) or a correction ({eventSkuId,newCount}). */
export async function getPreview(client, eventId, { lines, eventSkuId, newCount } = {}, opts) {
  const args = eventSkuId != null
    ? { p_packaging_event_id: idArg(eventId), p_lines: null, p_event_sku_id: idArg(eventSkuId), p_new_count: newCount }
    : { p_packaging_event_id: idArg(eventId), p_lines: lines, p_event_sku_id: null, p_new_count: null };
  return callRpc(client, RPC.preview, args, opts);
}
export async function getExceptionSummary(client, from, to, limit = 25, offset = 0, opts) {
  return callRpc(client, RPC.exceptions, { p_from: from, p_to: to, p_limit: limit, p_offset: offset }, opts);
}

/** classifyRpc treats ok:false as refused; the S7 reads use ok:true for state-dependent outcomes. */
export const PREVIEW_BLOCKING = Object.freeze(new Set(["FG_STAGE_NOT_SIGNED", "STAGE_SOURCE_CHANGED", "BATCH_IDENTITY_MISSING", "FG_RECEIPT_MISSING", "CORRECTION_NO_DEPLETION_BASIS", "CORRECTION_LEDGER_MISMATCH", "CORRECTION_NO_CHANGE"]));
export function describePreview(p) {
  if (!p) return null;
  const code = p.preview_code;
  const d = code === "OK" ? { title: "Ready to post", fix: "" } : code === "INSUFFICIENT_BULK" ? { title: "Insufficient bulk", fix: p.excess_permitted ? "Measured excess can be recorded when posting." : "Reduce the counts or ask an authorized operator." } : describeRefusal(code);
  return { code, blocking: PREVIEW_BLOCKING.has(code), title: d.title, fix: d.fix, state: stateFromRefusal(code, code === "FG_STAGE_NOT_SIGNED" || code === "CORRECTION_NO_DEPLETION_BASIS") };
}

/** Normalise a route context for the signing form. Every listed step is signable; activity_matches picks the step for the chosen work log. */
export function contextSteps(ctx) {
  const steps = Array.isArray(ctx?.steps) ? ctx.steps : [];
  return steps.map((s) => ({
    stepId: String(s.route_step_id), kind: s.step_kind, seq: Number(s.sequence_no), activity: s.activity_name, mandatory: !!s.is_mandatory,
    allowsRepeat: !!s.allows_repeat, expected: s.expected_occurrence_count != null ? Number(s.expected_occurrence_count) : null,
    isFg: s.stage_role === "FG_BULK", role: s.stage_role, matches: !!s.activity_matches, source: s.source_type,
  }));
}
export const routeLabel = (ctx) => (ctx?.route_kind === "ROUTE_FAMILY_INHERITED" ? `inherited family route #${ctx.family_route_id}` : ctx?.product_route_id ? `product route #${ctx.product_route_id}` : "route");

/** Display state of one stage event from mis_get_batch_stage_status_v1. */
export function eventState(e) {
  if (e.state === "SIGNED") return "SIGNED";
  if (e.state === "SOURCE_CHANGED") return "SOURCE_CHANGED";
  return null;   // CORRECTED / CORRECTION are history
}
