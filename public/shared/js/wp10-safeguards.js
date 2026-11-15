// WP10 G2 — pure logic for the Product/SKU safeguard surfaces (no DOM, no network, no Supabase import).
// Everything here is DEFAULT OFF behind one browser flag, same convention as the COSTING_*_V1 and LAUNCHER_PRESENTATION_V1 flags:
//   localStorage.setItem("WP10_SAFEGUARDS_V1", "1"); location.reload();     // ON : explanatory Readiness states, activation pre-check detail,
//                                                                              operational expiry horizon panel (inert if the RPC is absent)
//   localStorage.removeItem("WP10_SAFEGUARDS_V1"); location.reload();       // OFF: today's behaviour, unchanged
// Nothing here grants access, rebuilds anything, retries a writer or labels any status READY.

export const WP10_SAFEGUARDS_V1 = "WP10_SAFEGUARDS_V1";
export function isWp10SafeguardsV1Enabled(storage) {
  // R6: every property access (including globalThis.localStorage, whose getter can throw when storage is disabled) happens inside the try.
  try {
    const st = storage === undefined ? globalThis.localStorage : storage;
    return st?.getItem?.(WP10_SAFEGUARDS_V1) === "1";
  } catch {
    return false;
  }
}

/** Strip control characters and cap length: used for every server-supplied string before it is shown (always via textContent / escape). */
export function safeText(value, max = 300) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// ------------------------------------------------------------------------------------------------------------------
// 1. Readiness lens: why is readiness unavailable?
export const OWNER_ACCOUNTABILITY = "The programme owner is accountable for readiness follow-up until a named Costing Control Center operator is nominated. No appointment or access grant is implied by this screen.";
export const REVIEW_TARGET = "Review manually each working day. An unresolved stale or absent state is followed up by the next working day.";

export const READINESS_ERROR_KINDS = Object.freeze(["STALE", "ABSENT", "INCOMPLETE", "NO_GOVERNED_VALUATION", "NOT_AUTHENTICATED", "PERMISSION", "TIMEOUT", "TRANSPORT", "UNKNOWN"]);

export function classifyReadinessError(err) {
  const msg = String(err?.message ?? err?.error_description ?? err ?? "");
  const status = Number(err?.status ?? err?.statusCode);
  if (/READINESS_BUILD_STALE/.test(msg)) return { kind: "STALE", token: "READINESS_BUILD_STALE" };
  if (/READINESS_BUILD_ABSENT/.test(msg)) return { kind: "ABSENT", token: "READINESS_BUILD_ABSENT" };
  if (/READINESS_BUILD_INCOMPLETE/.test(msg)) return { kind: "INCOMPLETE", token: "READINESS_BUILD_INCOMPLETE" };
  if (/Governed valuation date missing/i.test(msg)) return { kind: "NO_GOVERNED_VALUATION", token: "GOVERNED_VALUATION_DATE_MISSING" };
  if (status === 401 || /Not authenticated|JWT|invalid token/i.test(msg)) return { kind: "NOT_AUTHENTICATED", token: "NOT_AUTHENTICATED" };
  if (status === 403 || /Permission denied|forbidden|not authori[sz]ed/i.test(msg)) return { kind: "PERMISSION", token: "PERMISSION_DENIED" };
  if (/statement timeout|canceling statement|timed out|timeout/i.test(msg) || status === 408 || status === 504) return { kind: "TIMEOUT", token: "TIMEOUT" };
  if (err instanceof TypeError || status === 0 || /failed to fetch|networkerror|network request failed|load failed/i.test(msg) || status >= 500) return { kind: "TRANSPORT", token: "TRANSPORT" };
  return { kind: "UNKNOWN", token: "UNKNOWN" };
}

const NEVER_BYPASS = "Until readiness is available, read nothing as READY. REVIEW_REQUIRED, BLOCKED and UNKNOWN statuses are never to be bypassed.";
const REBUILD_RULE = "Rebuilding the readiness snapshot is a production writer operation that needs its own exact operational authority. Do not run SQL or ask anyone to run it from this screen; this screen never rebuilds or retries a writer.";

const MODELS = {
  STALE: { title: "Readiness snapshot is out of date", meaning: "The stored snapshot for this governed period no longer matches the current source data (something it depends on changed since it was built). It does NOT mean a particular SKU lost a dependency; it means readiness must be re-evaluated before it is trusted.", fail: "Readiness is withheld (fail-closed) instead of showing possibly old statuses." },
  ABSENT: { title: "No readiness snapshot exists for this period", meaning: "No current snapshot has been built for this governed period (for example a newly opened period).", fail: "Readiness is withheld (fail-closed) because there is nothing to show." },
  INCOMPLETE: { title: "The readiness snapshot is not complete", meaning: "A snapshot exists but is not in a completed, promoted state.", fail: "Readiness is withheld (fail-closed) until a completed snapshot exists." },
  NO_GOVERNED_VALUATION: { title: "The governed period has no valuation date", meaning: "The selected period has no governed valuation date, so readiness cannot be anchored.", fail: "Readiness is withheld (fail-closed)." },
  NOT_AUTHENTICATED: { title: "You are not signed in", meaning: "The request was made without a valid session.", fail: "Readiness is withheld." },
  PERMISSION: { title: "You do not have access to portfolio readiness", meaning: "Your account is not permitted to read Costing Control Center readiness.", fail: "Readiness is withheld. This screen cannot grant access; use the normal access request process." },
  TIMEOUT: { title: "Readiness took too long to load", meaning: "The request exceeded the time limit. This says nothing about whether the snapshot is current.", fail: "Readiness is withheld; reloading this page is a read-only action." },
  TRANSPORT: { title: "Readiness could not be reached", meaning: "A network or server problem prevented the request. This says nothing about whether the snapshot is current.", fail: "Readiness is withheld; reloading this page is a read-only action." },
  UNKNOWN: { title: "Readiness is unavailable", meaning: "The server returned an error this screen does not recognise.", fail: "Readiness is withheld (fail-closed)." },
};

/** Structured, text-only description of an unavailable-readiness state. */
export function readinessStateModel(err, { periodStart = null } = {}) {
  const c = classifyReadinessError(err);
  const m = MODELS[c.kind] || MODELS.UNKNOWN;
  const period = /^\d{4}-\d{2}-\d{2}/.test(String(periodStart || "")) ? String(periodStart).slice(0, 10) : null;
  const steps = [];
  if (["STALE", "ABSENT", "INCOMPLETE"].includes(c.kind)) {
    steps.push("Record the governed period, the status shown here and the time in the daily readiness review.");
    steps.push("Tell the accountable owner (see above). Dependency owners fix source data in their specialist screens; they do not rebuild readiness.");
    steps.push(REBUILD_RULE);
    steps.push(NEVER_BYPASS);
    steps.push("If this is still unresolved by the next working day, escalate to the programme owner.");
  } else if (["PERMISSION", "NOT_AUTHENTICATED"].includes(c.kind)) {
    steps.push("Use the normal access or sign-in process. Do not share another person's session.");
    steps.push(NEVER_BYPASS);
  } else {
    steps.push("Reload this page (a read-only action). If it persists, record the time and the status shown here and tell the accountable owner.");
    steps.push(NEVER_BYPASS);
  }
  return {
    kind: c.kind,
    token: c.token,
    title: m.title,
    period: period ? `Governed period ${period} (LIVE_AS_OF)` : "Governed period not selected",
    meaning: m.meaning,
    failClosed: m.fail,
    owner: OWNER_ACCOUNTABILITY,
    cadence: REVIEW_TARGET,
    steps,
    automatic: "No automatic rebuild, retry or notification is performed.",
  };
}

// ------------------------------------------------------------------------------------------------------------------
// 2. Manage Products activation pre-check and structured rejection
export const ACTIVATION_CODES = Object.freeze({
  PM_BOM_REVISION: { screen: "PM BOM Manager", link: "pm-bom" },
  BATCH_SIZE_REFERENCE: { screen: "Batch Sizes (Supply / Batch Plan)", link: null },
  MANUFACTURING_ROUTE: { screen: "Production Route Manager", link: "route" },
  MRP_POLICY: { screen: "Pricing Policy Manager > MRP", link: null },
  SELLING_PRICE_POLICY: { screen: "Pricing Policy Manager > Selling & scheme policies", link: null },
});
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseMissing(list) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, 12).map((m) => {
    const code = safeText(m?.code, 40);
    const known = Object.prototype.hasOwnProperty.call(ACTIVATION_CODES, code);
    return { code, known, label: safeText(m?.label, 120) || code || "Unrecognised requirement", screen: known ? ACTIVATION_CODES[code].screen : safeText(m?.where, 120) || null, link: known ? ACTIVATION_CODES[code].link : null };
  });
}

/** Validates the rpc_get_sku_activation_check payload. Never returns "complete" for a malformed payload. */
export function parseActivationCheck(data, expectedSkuId = null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: "MALFORMED" };
  if (expectedSkuId != null && String(data.sku_id) !== String(expectedSkuId)) return { ok: false, reason: "SKU_MISMATCH" };
  const items = parseMissing(data.missing);
  if (!items) return { ok: false, reason: "MALFORMED" };
  return { ok: true, complete: items.length === 0, items, asOf: ISO.test(String(data.as_of_date || "")) ? String(data.as_of_date) : null, periodStart: ISO.test(String(data.period_start || "")) ? String(data.period_start) : null };
}

/** Classifies a failed pre-check or activation call. error: PostgREST/Postgres error object. */
export function parseActivationError(error) {
  const message = safeText(error?.message ?? error, 300);
  const hint = safeText(error?.hint, 300);
  let items = null;
  const raw = error?.details ?? error?.detail;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try { items = parseMissing(JSON.parse(raw)?.missing); } catch { items = null; }
  }
  let kind = "OTHER";
  if (/AMBIGUOUS_PM_BOM_REVISION/.test(message)) kind = "AMBIGUOUS_PM_BOM";
  else if (/Not authenticated/i.test(message)) kind = "NOT_AUTHENTICATED";
  else if (/Permission denied/i.test(message)) kind = "PERMISSION";
  else if (/inactive product|does not exist/i.test(message) && !items?.length) kind = "PARENT_OR_MISSING";
  else if (items && items.length) kind = "MISSING_ESSENTIALS";
  else if (/cannot be made active yet|Cannot activate SKU/i.test(message)) kind = "MISSING_ESSENTIALS";
  else if (/is already (active|inactive)/i.test(message)) kind = "STATE_CHANGED";
  else if (error?.status === 0 || error instanceof TypeError || /failed to fetch|network/i.test(message)) kind = "UNAVAILABLE";
  return { kind, message, hint, items };
}

/** Latest-request-wins guard for async pre-checks (stale responses, selection changes, cancellation). */
export function createLatestGuard() {
  let n = 0;
  return { next: () => ++n, isCurrent: (token) => token === n, cancel: () => { n += 1; } };
}

// ------------------------------------------------------------------------------------------------------------------
// 3. Operational expiry horizon (UNAPPLIED server proposal; client inert until the RPC exists AND the flag is on)
export const HORIZON_RPC = "rpc_wp10_get_operational_expiry_horizon";
export const HORIZON_DAYS = 30;
export const HORIZON_PAGE_LIMIT = 50;
export const HORIZON_MAX_PAGES = 20; // client-side budget: at most 20 pages (1,000 flagged rows) per panel session
export const HORIZON_CLASS_LABELS = Object.freeze({
  TODAY_MISSING: "Missing today",
  TODAY_AMBIGUOUS: "Ambiguous today",
  TODAY_UNKNOWN: "Unknown today",
  LAPSES_IN_WINDOW: "Lapses in window",
  GAP_RECOVERS_IN_WINDOW: "Gap that recovers",
  AMBIGUOUS_IN_WINDOW: "Ambiguous in window",
  UNKNOWN: "Unknown",
});
const CLASSES = new Set(Object.keys(HORIZON_CLASS_LABELS));
const STATES = new Set(["RESOLVED", "MISSING", "AMBIGUOUS", "UNKNOWN"]);

export function buildHorizonRequest({ afterSkuId = null, limit = HORIZON_PAGE_LIMIT, days = HORIZON_DAYS } = {}) {
  return { rpc: HORIZON_RPC, args: { p_horizon_days: days, p_after_sku_id: afterSkuId == null ? null : Number(afterSkuId), p_limit: limit } };
}

/** Unknown / not-yet-applied endpoint (PostgREST PGRST202, 404, "Could not find the function"). */
export function isMissingRpcError(err) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  return code === "PGRST202" || code === "42883" || Number(err?.status) === 404 || /could not find the function|schema cache/i.test(msg);
}

const posInt = (v) => typeof v === "number" ? Number.isSafeInteger(v) && v > 0 : typeof v === "string" && /^[1-9]\d{0,15}$/.test(v);
const dayNum = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
export const HORIZON_MAX_ROWS = 1000;
export const HORIZON_MAX_SCANNED = 20000;
export const HORIZON_TIME_BUDGET_MS = 120000;

/**
 * Validates one horizon page. `prev` (optional) is what the panel already accepted: { context, lastSkuId, expectedCursor, rowIds:Set, pageIndex }.
 * R4: a has_more page MUST carry a positive integral cursor at or beyond its last row and strictly past the cursor that was sent;
 * SQL proposal 03 returns the last SCANNED SKU, so equality with the last displayed row is valid (e.g. the flagged-row limit was reached).
 * rows must be positive-integral, strictly ascending and not seen before; the date window must be exactly [from, from+days] inclusive; and every page
 * of one panel session must carry the SAME context (date basis, window, route coverage, amounts flag) - otherwise the caller restarts or stops.
 */
export function validateHorizonEnvelope(data, prev = null, { sentCursor = null } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "Horizon response is not an object." };
  if (data.assessment_kind !== "OPERATIONAL_EXPIRY_HORIZON") return { ok: false, error: "Horizon assessment_kind mismatch." };
  const c = data.context;
  if (!c || c.date_basis !== "CURRENT_IST_DATE" || !ISO.test(String(c.evaluated_from)) || !ISO.test(String(c.evaluated_through))) return { ok: false, error: "Horizon date context is missing or not the current IST date." };
  const span = dayNum(String(c.evaluated_through)) - dayNum(String(c.evaluated_from));
  const days = Number(c.horizon_days);
  if (!Number.isInteger(days) || days < 1 || days > 90 || span !== days) return { ok: false, error: "Horizon window is inconsistent with its horizon_days." };
  if (typeof c.route_boundary_coverage !== "string" || !["COMPLETE", "PARTIAL"].includes(c.route_boundary_coverage)) return { ok: false, error: "Horizon route boundary coverage is missing or unrecognised." };
  if (typeof c.amounts_evaluated !== "boolean") return { ok: false, error: "Horizon amounts_evaluated flag is missing." };
  const context = { evaluated_from: String(c.evaluated_from), evaluated_through: String(c.evaluated_through), horizon_days: days, route_boundary_coverage: c.route_boundary_coverage, amounts_evaluated: c.amounts_evaluated };
  if (prev?.context) {
    for (const k of Object.keys(context)) if (prev.context[k] !== context[k]) return { ok: false, contextChanged: true, error: `Horizon context changed between pages (${k}); the assessment was restarted-needed.` };
  }
  if (!Array.isArray(data.rows)) return { ok: false, error: "Horizon rows must be an array." };
  const seen = new Set(prev?.rowIds || []);
  let last = Math.max(prev?.lastSkuId ?? 0, sentCursor == null ? 0 : Number(sentCursor));
  const rows = [];
  for (const r of data.rows) {
    if (!r || !posInt(r.sku_id) || !posInt(r.product_id) || !Array.isArray(r.essentials)) return { ok: false, error: "Horizon row is malformed." };
    const id = Number(r.sku_id);
    if (seen.has(id)) return { ok: false, error: "Horizon returned a duplicate SKU row." };
    if (id <= last) return { ok: false, error: "Horizon rows are out of order or do not move past the cursor." };
    seen.add(id); last = id;
    const essentials = [];
    for (const e of r.essentials) {
      if (!CLASSES.has(e?.classification) || !STATES.has(e?.today_state) || !STATES.has(e?.issue_state)) return { ok: false, error: "Horizon essential has an unknown classification or state." };
      const fi = ISO.test(String(e.first_issue_date)) ? String(e.first_issue_date) : null;
      const rc = e.recovers_on && ISO.test(String(e.recovers_on)) ? String(e.recovers_on) : null;
      if ((fi && (fi < context.evaluated_from || fi > context.evaluated_through)) || (rc && (rc < context.evaluated_from || rc > context.evaluated_through))) return { ok: false, error: "Horizon essential date is outside the evaluated window." };
      essentials.push({ code: safeText(e.code, 40), owner_screen: safeText(e.owner_screen, 120), today_state: e.today_state, issue_state: e.issue_state, classification: e.classification, first_issue_date: fi, recovers_on: rc });
    }
    rows.push({ sku_id: id, product_id: Number(r.product_id), essentials });
  }
  const st = data.statistics || {};
  const scanned = Number(st.scanned_count);
  if (!Number.isInteger(scanned) || scanned < 0) return { ok: false, error: "Horizon scanned_count is missing or invalid." };
  const hasMore = data.has_more === true;
  let next = null;
  if (hasMore) {
    if (!posInt(data.next_after_sku_id)) return { ok: false, error: "Horizon says more pages exist but gave no valid continuation cursor." };
    next = Number(data.next_after_sku_id);
    if (next <= (sentCursor == null ? 0 : Number(sentCursor)) || next < last) return { ok: false, error: "Horizon continuation cursor does not advance or precedes a returned row." };
    if (prev?.expectedCursor != null && sentCursor != null && Number(sentCursor) !== Number(prev.expectedCursor)) return { ok: false, error: "Horizon page was requested with an unexpected cursor." };
  } else if (data.next_after_sku_id != null) {
    return { ok: false, error: "Horizon returned a cursor on the last page." };
  }
  return { ok: true, value: { context, rows, hasMore, nextAfterSkuId: next, scannedCount: scanned, budgetExhausted: st.budget_exhausted === true, lastSkuId: last } };
}
