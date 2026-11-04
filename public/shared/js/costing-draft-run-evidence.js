// CDE-1a: draft-run component evidence section for the Costing Review Worklist SKU drawer
// (flag COSTING_REVIEW_WORKLIST_V1, default OFF; the shell only mounts this when that flag is exactly "1").
//
// SAFETY CONTRACT
//  - No data access: this module imports NO Supabase client, never calls costingFrom/costingRpc/rpc, never reads
//    costing.* tables and contains no write or approval action. All data arrives through an INJECTED provider.
//  - In production no provider is connected (the holder below is null). The section then shows an explicit
//    "provider not connected" state with every component UNKNOWN. No fixture or mock data exists in this file.
//  - Every request carries (periodStart, runId, skuId); the run must be one the server advertised for the period
//    and must not be an approved run; the response must echo the same identity or it is rejected.
//  - Late answers are discarded (generation + current-context check). Missing data is UNKNOWN, never READY.
//  - Other drawer / Cost Sheet evidence stays governed-run pinned; the section always says so.

import { isCostingUxConsistencyV1Enabled } from "./costing-feature-flags.js";
import { costingStatusDisplayLabel } from "./costing-status-labels.js";
import { resolveRecommendedUiRouteTarget } from "./costing-suite-recommended-ui-route.js";

export const DRAFT_EVIDENCE_STATUS = Object.freeze({
  NO_PROVIDER: "no-provider",
  NOT_REQUESTED: "not-requested",
  LOADING: "loading",
  OK: "ok",
  EMPTY: "empty",
  FORBIDDEN: "forbidden",
  ERROR: "error",
  STALE: "stale",
  FOREIGN_RUN: "foreign-run",
  NOT_APPLICABLE: "not-applicable",
});

export const DRAFT_EVIDENCE_UNAVAILABLE_TEXT = "Draft-run component evidence unavailable — provider not connected";
export const DRAFT_EVIDENCE_GOVERNED_WARNING_TEXT =
  "Other drawer and Cost Sheet evidence is pinned to the governed (approved) run and is not evidence from this draft run. This section covers only the components listed below.";
export const DRAFT_EVIDENCE_FROZEN_TEXT =
  "Frozen snapshot of this run, for diagnosis only. It is not an approval and not current master data. A cause fixed upstream appears only in a NEW refresh run.";

// ---- provider holder (production: null) ------------------------------------------------------------------------
let PROVIDER = null;
/** Only an authorised read adapter (CDE-1b) may call this; tests use it with stubs and reset to null. */
export function setDraftRunEvidenceProvider(provider) {
  PROVIDER = provider && typeof provider.readSkuEvidence === "function" ? provider : null;
}
export function getDraftRunEvidenceProvider() {
  return PROVIDER;
}

const idText = (v) => (v === null || v === undefined ? "" : String(v).trim());
const upper = (v) => String(v ?? "").trim().toUpperCase();
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// ---- identity ---------------------------------------------------------------------------------------------------
/**
 * Context for the drawer row, or null when the section does not apply. `context` comes from the shell:
 * { periodStart, runId, runKind, allowedRunIds }. The row is the drawer's run-scoped SKU row.
 */
export function resolveDraftEvidenceRequest(context, row) {
  if (!context || !row) return null;
  const periodStart = idText(context.periodStart);
  const runId = idText(context.runId);
  const skuId = idText(row.sku_id);
  if (!periodStart || !runId || !skuId) return null;
  if (idText(context.runKind).toLowerCase() === "approved") return null;
  const allowed = Array.isArray(context.allowedRunIds) ? context.allowedRunIds.map(idText) : [];
  if (!allowed.includes(runId)) return null;
  if (idText(row.period_start) !== periodStart || idText(row.refresh_run_id) !== runId) return null;
  return Object.freeze({ periodStart, runId, skuId, key: `${periodStart}|${runId}|${skuId}` });
}

const COMPONENT_FIELDS = Object.freeze([
  "material_costing_status",
  "direct_labour_allocation_status",
  "allocation_reason_code",
  "allocation_basis_status",
  "allocation_resolution_status",
  "allocation_resolution_note",
  "direct_labour_component_model_code",
  "internal_material_conversion_status",
  "first_control_status",
  "control_severity",
  "blocker_note",
]);
const REGION_FIELDS = Object.freeze(["regional_basis_source", "regional_basis_status", "marketing_expense_allocation_status", "note"]);

/** Whitelist-copy of the provider record (unknown / monetary fields are never carried into the view). */
export function normalizeDraftEvidenceRecord(record) {
  const out = {};
  for (const f of COMPONENT_FIELDS) out[f] = record?.[f] == null ? null : String(record[f]);
  out.valuation_date = record?.valuation_date == null ? null : String(record.valuation_date);
  out.refreshed_at = record?.refreshed_at == null ? null : String(record.refreshed_at);
  out.regional = {};
  for (const region of ["IK", "OK"]) {
    const r = record?.regional?.[region];
    out.regional[region] = {};
    for (const f of REGION_FIELDS) out.regional[region][f] = r?.[f] == null ? null : String(r[f]);
  }
  return Object.freeze(out);
}

/** The response must echo the request identity exactly. Returns "ok" | "foreign-run". */
export function checkDraftEvidenceIdentity(record, request) {
  const ok =
    record &&
    idText(record.period_start) === request.periodStart &&
    idText(record.refresh_run_id) === request.runId &&
    idText(record.sku_id) === request.skuId;
  return ok ? "ok" : "foreign-run";
}

// ---- race-safe loader -------------------------------------------------------------------------------------------
/**
 * One loader per drawer session. `getCurrentContext()` must return the shell's CURRENT { context, row }; an answer is
 * applied only if it still matches that identity, so a drawer / run / period switch discards late answers.
 */
export function createDraftRunEvidenceLoader({ getCurrentContext, getProvider = getDraftRunEvidenceProvider, onChange = () => {} } = {}) {
  const states = new Map();
  let generation = 0;
  let notify = onChange;
  const currentRequest = () => {
    const cur = typeof getCurrentContext === "function" ? getCurrentContext() : null;
    return cur ? resolveDraftEvidenceRequest(cur.context, cur.row) : null;
  };
  const set = (key, state) => { states.set(key, Object.freeze(state)); notify(key, state); };
  return {
    stateFor(request) {
      if (!request) return Object.freeze({ status: DRAFT_EVIDENCE_STATUS.NOT_APPLICABLE });
      if (!getProvider()) return Object.freeze({ status: DRAFT_EVIDENCE_STATUS.NO_PROVIDER });
      return states.get(request.key) || Object.freeze({ status: DRAFT_EVIDENCE_STATUS.NOT_REQUESTED });
    },
    /** Explicit user action only; never called automatically. */
    async load(request) {
      const provider = getProvider();
      if (!request || !provider) return;
      const existing = states.get(request.key);
      if (existing?.status === DRAFT_EVIDENCE_STATUS.LOADING) return; // double-click guard: one request in flight
      const myGeneration = ++generation;
      set(request.key, { status: DRAFT_EVIDENCE_STATUS.LOADING, generation: myGeneration });
      let answer;
      try {
        answer = await provider.readSkuEvidence({ periodStart: request.periodStart, runId: request.runId, skuId: request.skuId });
      } catch (error) {
        answer = { status: "error", error: String(error?.message || error) };
      }
      const now = currentRequest();
      if (!now || now.key !== request.key) { states.delete(request.key); return; } // switched away: discard silently
      if (states.get(request.key)?.generation !== myGeneration) return; // superseded
      const status = String(answer?.status ?? "");
      if (status === "ok") {
        const verdict = checkDraftEvidenceIdentity(answer.record, request);
        if (verdict !== "ok") return set(request.key, { status: DRAFT_EVIDENCE_STATUS.FOREIGN_RUN });
        return set(request.key, { status: DRAFT_EVIDENCE_STATUS.OK, record: normalizeDraftEvidenceRecord(answer.record) });
      }
      if (status === "empty") return set(request.key, { status: DRAFT_EVIDENCE_STATUS.EMPTY });
      if (status === "forbidden") return set(request.key, { status: DRAFT_EVIDENCE_STATUS.FORBIDDEN });
      if (status === "stale") return set(request.key, { status: DRAFT_EVIDENCE_STATUS.STALE });
      if (status === "foreign-run") return set(request.key, { status: DRAFT_EVIDENCE_STATUS.FOREIGN_RUN });
      return set(request.key, { status: DRAFT_EVIDENCE_STATUS.ERROR, error: String(answer?.error || "Evidence could not be read.") });
    },
    setOnChange(fn) { notify = typeof fn === "function" ? fn : () => {}; },
    reset() { generation += 1; states.clear(); },
  };
}

// ---- labels -----------------------------------------------------------------------------------------------------
const REASON_LABELS = Object.freeze({
  REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION: "Direct-labour component foundation needs review",
  NO_SKU_SALES_IN_LOOKBACK: "No SKU sales in the lookback period",
  NO_PRODUCT_SALES_IN_LOOKBACK: "No product sales in the lookback period",
  REGION_SCALED_COMMON_BASIS: "Region-scaled common basis (no positive regional SKU units or governed assumption)",
  REGIONAL_ACTUAL_UNITS: "Regional actual units",
  MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS: "Manufacturing route plus expected package units",
});
const reasonText = (code) => (code ? REASON_LABELS[upper(code)] || "" : "");
function statusText(raw) {
  const code = upper(raw);
  if (!code) return "Unknown";
  return isCostingUxConsistencyV1Enabled() ? costingStatusDisplayLabel(code) : code.replace(/_/g, " ");
}

// ---- view model + HTML (pure) -----------------------------------------------------------------------------------
const COMPONENTS = Object.freeze([
  { id: "material", label: "Material" },
  { id: "direct-labour", label: "Direct labour" },
  { id: "conversion", label: "Internal conversion" },
  { id: "regional-IK", label: "Regional Marketing — IK" },
  { id: "regional-OK", label: "Regional Marketing — OK" },
]);

function componentCells(id, record) {
  if (!record) return { status: null, reasonCode: null, detail: "", note: null };
  if (id === "material") return { status: record.material_costing_status, reasonCode: null, detail: "", note: record.blocker_note };
  if (id === "direct-labour") {
    const bits = [];
    if (record.allocation_basis_status) bits.push(`Allocation basis: ${record.allocation_basis_status}`);
    if (record.allocation_resolution_status) bits.push(`Resolution: ${record.allocation_resolution_status}`);
    if (record.direct_labour_component_model_code) bits.push(`Model: ${reasonText(record.direct_labour_component_model_code) || record.direct_labour_component_model_code}`);
    return { status: record.direct_labour_allocation_status, reasonCode: record.allocation_reason_code, detail: bits.join(" · "), note: record.allocation_resolution_note };
  }
  if (id === "conversion") return { status: record.internal_material_conversion_status, reasonCode: null, detail: "", note: null };
  const r = record.regional[id === "regional-IK" ? "IK" : "OK"];
  return {
    status: r.marketing_expense_allocation_status || r.regional_basis_status,
    reasonCode: r.regional_basis_source,
    detail: r.regional_basis_status ? `Basis status: ${r.regional_basis_status}` : "",
    note: r.note,
  };
}

/** Existing route resolver only; the link carries the governed period and ids, never a draft run id. */
function remedyFor(id, row) {
  const ctx = {
    productId: row?.product_id, skuId: row?.sku_id, periodStart: row?.period_start,
    rmBlockingLineCount: row?.rm_blocking_line_count, pmBlockingLineCount: row?.pm_blocking_line_count,
  };
  const code = id === "material" ? "MATERIAL_RATE_MANAGER" : id === "direct-labour" ? "PRODUCTION_ROUTE_MANAGER" : id.startsWith("regional") ? "PRICING_POLICY_REVIEW" : null;
  const none = { navigable: false, label: "No dedicated screen for this row" };
  if (!code) return none;
  const t = resolveRecommendedUiRouteTarget(code, ctx);
  return t.navigable ? { navigable: true, label: t.label, target: t } : none;
}

/** state: loader state; request: resolved request or null; row: drawer row. Returns { html } (empty string when not applicable). */
export function renderDraftRunEvidenceHtml({ state, request, row, open = false }) {
  if (!request || state?.status === DRAFT_EVIDENCE_STATUS.NOT_APPLICABLE) return "";
  const e = escapeHtml;
  const status = state?.status || DRAFT_EVIDENCE_STATUS.NOT_REQUESTED;
  const showData = status === DRAFT_EVIDENCE_STATUS.OK;
  const record = showData ? state.record : null;
  let msg = "";
  let action = "";
  if (status === DRAFT_EVIDENCE_STATUS.NO_PROVIDER) msg = `<div class="cde-msg cde-warn" role="status">${e(DRAFT_EVIDENCE_UNAVAILABLE_TEXT)}. Component values below are Unknown.</div>`;
  else if (status === DRAFT_EVIDENCE_STATUS.NOT_REQUESTED) {
    msg = `<div class="cde-msg" role="status">Not loaded yet. Values below are Unknown until the evidence is read.</div>`;
    action = `<button type="button" class="cde-load" data-cde-load="1">Load draft-run evidence</button>`;
  } else if (status === DRAFT_EVIDENCE_STATUS.LOADING) msg = `<div class="cde-msg" role="status">Loading draft-run evidence for run ${e(request.runId)}…</div>`;
  else if (status === DRAFT_EVIDENCE_STATUS.EMPTY) msg = `<div class="cde-msg cde-warn" role="status">No component evidence was returned for this SKU in run ${e(request.runId)}. Components are Unknown, not Ready.</div>`;
  else if (status === DRAFT_EVIDENCE_STATUS.FORBIDDEN) msg = `<div class="cde-msg cde-warn" role="alert">You do not have permission to read Control Centre evidence. Components are Unknown.</div>`;
  else if (status === DRAFT_EVIDENCE_STATUS.ERROR) {
    msg = `<div class="cde-msg cde-warn" role="alert">Evidence could not be read: ${e(state.error || "unknown error")}. Components are Unknown.</div>`;
    action = `<button type="button" class="cde-load" data-cde-load="1">Retry</button>`;
  } else if (status === DRAFT_EVIDENCE_STATUS.STALE) {
    msg = `<div class="cde-msg cde-warn" role="alert">This evidence is stale. Reload the period and run. Nothing is shown.</div>`;
    action = `<button type="button" class="cde-load" data-cde-load="1">Retry</button>`;
  } else if (status === DRAFT_EVIDENCE_STATUS.FOREIGN_RUN) {
    msg = `<div class="cde-msg cde-warn" role="alert">The evidence returned does not belong to run ${e(request.runId)}, this period and SKU, so nothing is shown. Components are Unknown.</div>`;
    action = `<button type="button" class="cde-load" data-cde-load="1">Retry</button>`;
  }
  const rows = COMPONENTS.map((c) => {
    const cells = componentCells(c.id, record);
    const remedy = remedyFor(c.id, row);
    const reason = cells.reasonCode
      ? `<div><code>${e(cells.reasonCode)}</code>${reasonText(cells.reasonCode) ? ` — ${e(reasonText(cells.reasonCode))}` : ""}</div>`
      : "";
    const note = cells.note ? `<div class="cde-note">${e(cells.note)}</div>` : "";
    const absent = showData && !cells.status && !cells.detail && !cells.note ? `<div class="cde-note">Not provided by the evidence source.</div>` : "";
    const fix = remedy.navigable
      ? `<button type="button" class="cde-nav" data-cde-nav="${e(c.id)}">${e(remedy.label)}</button>`
      : `<span class="cde-muted">${e(remedy.label)}</span>`;
    return `<tr data-cde-component="${e(c.id)}"><th scope="row">${e(c.label)}</th><td data-cde-status="${e(upper(cells.status) || "UNKNOWN")}">${e(statusText(cells.status))}</td><td>${reason}${cells.detail ? `<div>${e(cells.detail)}</div>` : ""}${note}${absent}</td><td>${fix}</td></tr>`;
  }).join("");
  const meta = showData && (record.valuation_date || record.refreshed_at)
    ? `<div class="cde-muted">${record.valuation_date ? `Valuation ${e(record.valuation_date)}` : ""}${record.valuation_date && record.refreshed_at ? " · " : ""}${record.refreshed_at ? `Frozen ${e(record.refreshed_at)}` : ""}</div>`
    : "";
  return `<details class="cde-section" data-cde-section="1" data-cde-state="${e(status)}"${open ? " open" : ""}>
<summary class="cde-summary"><span class="cde-heading">Draft-run component evidence</span> <span class="cde-run">Run ${e(request.runId)} · not for pricing</span></summary>
<div class="cde-body">
<div class="cde-msg cde-warn" role="note" data-cde-governed-warning="1"><strong>Not the whole drawer.</strong> ${e(DRAFT_EVIDENCE_GOVERNED_WARNING_TEXT)}</div>
<div class="cde-muted">${e(DRAFT_EVIDENCE_FROZEN_TEXT)}</div>
${msg}${action}${meta}
<table class="cde-table"><caption class="cde-sr">Draft run ${e(request.runId)} component evidence for SKU ${e(request.skuId)}</caption>
<thead><tr><th scope="col">Component</th><th scope="col">Status</th><th scope="col">Why</th><th scope="col">Where to fix</th></tr></thead>
<tbody>${rows}</tbody></table>
</div></details>`;
}


const STYLE_ID = "cde-style";
const STYLE_CSS = `
.cde-section{margin:12px 0;border:1px solid var(--border,#cfd4dc);border-radius:8px;background:var(--panel,transparent)}
.cde-summary{cursor:pointer;padding:8px 12px;font-weight:600}
.cde-summary:focus-visible,.cde-load:focus-visible,.cde-nav:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.cde-run{font-weight:400;margin-left:8px;opacity:.85}
.cde-body{padding:4px 12px 12px;overflow-wrap:anywhere}
.cde-msg{margin:6px 0;padding:6px 8px;border-left:4px solid currentColor;border-radius:4px}
.cde-warn{font-weight:500}
.cde-muted,.cde-note{opacity:.8;font-size:.92em}
.cde-table{width:100%;border-collapse:collapse;margin-top:8px}
.cde-table th,.cde-table td{padding:6px 8px;border-top:1px solid var(--border,#cfd4dc);text-align:left;vertical-align:top}
.cde-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:480px){.cde-table,.cde-table tbody,.cde-table tr,.cde-table th,.cde-table td{display:block;width:100%;box-sizing:border-box}.cde-table thead{display:none}.cde-table tr{border-top:2px solid var(--border,#cfd4dc);padding:4px 0}.cde-table th,.cde-table td{border-top:0}}
`;
function ensureStyle() {
  if (typeof document === "undefined" || document.getElementById?.(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  document.head?.appendChild(el);
}

// ---- DOM wiring (no data access) --------------------------------------------------------------------------------
/**
 * Renders the section into `host` and wires toggle/load/navigation. `navigate(target)` is supplied by the shell and
 * receives a target from the existing route resolver; this module never navigates by itself.
 */
export function mountDraftRunEvidenceSection(host, { loader, getCurrentContext, navigate, showToast }) {
  if (!host) return null;
  ensureStyle();
  let open = false;
  loader.setOnChange(() => { if (host.isConnected) paint(); });
  const paint = () => {
    const cur = typeof getCurrentContext === "function" ? getCurrentContext() : null;
    const request = cur ? resolveDraftEvidenceRequest(cur.context, cur.row) : null;
    if (!request) { host.innerHTML = ""; return; }
    host.innerHTML = renderDraftRunEvidenceHtml({ state: loader.stateFor(request), request, row: cur.row, open });
    const details = host.querySelector("[data-cde-section]");
    details?.addEventListener("toggle", () => { open = details.open; });
    host.querySelector("[data-cde-load]")?.addEventListener("click", () => { open = true; loader.load(request); });
    host.querySelectorAll("[data-cde-nav]").forEach((btn) =>
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const remedy = remedyFor(btn.getAttribute("data-cde-nav"), cur.row);
        if (!remedy.navigable) { showToast?.("No dedicated navigation is configured for this control yet.", "info"); return; }
        navigate?.(remedy.target);
      }),
    );
  };
  paint();
  return { paint };
}
