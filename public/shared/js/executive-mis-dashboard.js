import { CLASS_DIMENSIONS, KYC_ROUTE, INCOMPLETE_KYC_ROUTE, isKycRoute, roleAccess, classificationArgs, changeClassification, collectBillPages, debtorError } from "./ei-debtor-contract.js?kyc=1";
import { mountDebtorWorkspace, classificationFields } from "./ei-debtor-workspace.js?kyc=1";
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { mountModuleHome } from "./sasv-module-chrome.js";
import { iconHtml } from "./ui-icons.js";
import { renderEvidenceShell, mountEvidencePanel } from "./mis-evidence-report.js?mis-g7r=1";
import {
  LENSES,
  lensFromHash,
  hasValue,
  analyzeInventorySummary,
  inventoryCanonicalAvailable,
  sanitizeInventoryFilter,
  INVENTORY_CANONICAL_FILTERS,
  analyzeSalesSummary,
  financeBars,
  pipelineBars,
  comparisonBars, windowBars, monthlyTrend, facilityBars, subsetShare, alertSegments, fgStatusSegments, materialFgBars,
  mergeRows, listIsDone, exportLoadedScopeLine, recordCardModel, inlineBarPct,
  overviewNarrative,
  alertsViewModel,
  shouldResetPage,
  inventoryCoverage,
  classifyApiError,
  salesAccessFromResponse,
  HISTORY_GROUPS,
  HISTORY_SORTS,
  isMonthGrouping,
  COVERAGE_LABELS,
  ELIGIBILITY_LABELS,
  ACTIVITY_LABELS,
  label as labelOf,
  pivotMonthGrid,
  buildPageCsv,
  HIERARCHY_LEVELS,
  emptyHierarchy,
  hierarchyOptions,
  reconcileHierarchy,
  hierarchyArgs,
  hierarchyActive,
  hierarchyLabels,
  exportScopeLine,
  refreshJobModel,
  refreshFreshnessModel,
  facilityModel,
  freshnessModel,
  FRESHNESS_GROUP_LABELS,
  activityParts,
  AGE_MAX_BOUNDS, ageLabels, parseAgeBounds, parseAgeInt,
} from "./executive-intelligence-model.js?ei-r8=3";

const MODULE_ID = "executive-mis-dashboard";
const PLAN_WARNING_STATUS =
  "CURRENT_MONTH_PLAN_NOT_AVAILABLE_USING_NEXT_AVAILABLE_PLAN_MONTH";

let PERM_CAN_VIEW = false;
let DATA_REFRESH_TIME = null;
let ACTIVE_INFO_BUTTON = null;
let ACTIVE_POPOVER = null;
let POPOVER_OPENED_BY_HOVER = false;
// Capability discovered from the server (ei_sales_access) for users without the executive permission. Hiding lenses is a
// convenience only: every server contract enforces its own authorization and denied/unavailable responses fail closed.
let ACCESS = { state: "checking", executive: false, sales: false };
let KYC_HASH = isKycRoute(window.location.hash) ? window.location.hash : "";
let ACTIVE_TAB = KYC_HASH ? "finance" : lensFromHash(window.location.hash);
let KYC_PERMISSIONS = { kyc: { view: false, edit: false }, commercial: { view: false, edit: false } };
let disposeKyc;
let suspendedFinance;
let financeDirty = false;
let financeLookups;
let financeClass = { partition: "all" };
let financeFilterDraft;
let stopBillMore;
let financeScrollOnLoad = null;
const financeClassArgs = () => classificationArgs(financeClass);
const financeClassActive = () => Object.keys(financeClassArgs()).length > 0;
const financeGroupScope = () => financeClassActive() ? "receivables" : LISTS.finance.st.filter;

async function readDebtorRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
let FINANCE_LAST_FOCUS = null;
// ONE shared live pipeline response (v_mis_batch_pipeline) feeds the three headline production count cards AND the
// Production lens. It is deliberately NOT a tab request key: a tab switch must never discard it. status: idle | loading | ok | error.
let LIVE_PIPELINE = { status: "idle", data: null, asOf: null, message: "" };
let LIVE_PIPELINE_INFLIGHT = null;
let LAST_SUMMARY_ROW = null;
// Canonical inventory summary for the Overview (same view and same analysis as the Materials Inventory lens).
let OVERVIEW_TREND = { status: "idle", data: null };
let OVERVIEW_INV = { status: "idle", data: null, asOf: null, message: "" };
// Executive-summary snapshot (mv_mis_executive_summary). status: idle | loading | ok | empty | error. Own latest-wins key.
let SUMMARY_STATE = { status: "idle", row: null, message: "" };
const LIVE_PIPELINE_REUSE_MS = 30000;
// Canonical G7 production value summary (server computed; the browser never derives a rupee figure).
// status: loading | ok | error | denied | expired | invalid
let PRODUCTION_VALUE = { status: "loading", data: null, message: "" };
let PRODUCTION_VALUE_MONTH = ""; // first of month, YYYY-MM-01 (IST); set on first use
let PRODUCTION_VALUE_ASOF = ""; // optional YYYY-MM-DD cutoff, "" = server default (today IST)
let PRODUCTION_ASOF_NOTICE = ""; // visible explanation when a chosen cutoff is cleared (never a silent reset)
let PRODUCTION_VALUE_REQUESTED = ""; // "month|asof" last sent, to avoid duplicate identical requests

// ---------------------------------------------------------------------------
// Async request-state guards (MIS-C1).
// Every server query takes a token from beginRequest(key). Only the holder of
// the latest token for that key may touch state, DOM or the loading mask; an
// older completion is dropped. invalidateTabRequests() (tab switch / refresh)
// retires every in-flight tab query so none can repaint a different panel.
// ---------------------------------------------------------------------------
const REQUEST_SEQ = Object.create(null);
const TAB_REQUEST_KEYS = [
  "finance:summary",
  "finance:age-sum",
  "finance:page",
  "finance:modal",
  "sales:summary",
  "sales:page",
  "inventory:summary",
  "inventory:page",
  "fg:summary",
  "fg:page",
  "production",
  "production:value",
  "overview:inventory",
  "sales:dims",
  "sales:cmp",
  "sales:win",
  "sales:hist",
  "sales:exc",
  "sales:cov",
  "sales:refresh",
  "sales:fac",
  "alerts",
];
let ACTIVE_TAB_FAILED = false;

function beginRequest(key) {
  REQUEST_SEQ[key] = (REQUEST_SEQ[key] || 0) + 1;
  return REQUEST_SEQ[key];
}

function isLatestRequest(key, token) {
  return REQUEST_SEQ[key] === token;
}

function invalidateTabRequests() {
  TAB_REQUEST_KEYS.forEach((key) => beginRequest(key));
  disposeAllMore();
}

// A rejected/thrown request must still settle into the error state rather
// than leaving the loading mask up forever.
async function settle(promise) {
  try {
    return await promise;
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function errorMessage(error) {
  return (error && error.message) || "See console for details.";
}

// Re-render a toolbar after a page load, except while the user is typing in
// its search box: rebuilding it would steal focus and overwrite characters
// typed after the request was sent.
function renderToolbarUnlessTyping(searchInputId, renderFn) {
  if (document.activeElement?.id === searchInputId) return;
  // A keyboard user who just used a toolbar button keeps focus on it across the re-render.
  const activeId = document.activeElement?.tagName === "BUTTON" ? document.activeElement.id : "";
  renderFn();
  if (activeId && document.activeElement?.id !== activeId) document.getElementById(activeId)?.focus?.();
}

function renderTableState(prefix, { loading, error, loadingText, emptyText, errorText, retryKey }) {
  if (loading) {
    return `<div class="${prefix}-status" role="status">${escapeHtml(loadingText)}</div>`;
  }
  if (error) {
    return `<div class="${prefix}-status error" role="alert">${escapeHtml(errorText)} ${escapeHtml(error)}${
      retryKey
        ? ` <button type="button" class="mis-retry-btn" data-mis-retry="${escapeHtml(retryKey)}">Retry</button>`
        : ""
    }</div>`;
  }
  return `<div class="${prefix}-empty">${escapeHtml(emptyText)}</div>`;
}

const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const refreshBtn = $("refreshBtn");
const lastRefreshed = $("lastRefreshed");
const detailTabs = $("detailTabs");
const detailTabSelect = $("detailTabSelect");
const tabPanel = $("tabPanel");
const financeModalOverlay = $("financeModalOverlay");
const financeModalTitle = $("financeModalTitle");
const financeModalSubtitle = $("financeModalSubtitle");
const financeModalContent = $("financeModalContent");
const financeModalClose = $("financeModalClose");

function setStatus(message, type = "info") {
  if (!statusArea) return;
  statusArea.textContent = message;
  statusArea.className = `status ${type}`;
  statusArea.style.display = "block";
}

function clearStatus() {
  if (!statusArea) return;
  statusArea.textContent = "";
  statusArea.className = "status";
  statusArea.style.display = "none";
}

function formatCurrencyINR(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNumberIN(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(n);
}

function formatIntegerIN(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateIN(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatDateTimeIN(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(d);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d);
  const year = new Intl.DateTimeFormat("en-IN", { year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
  return `${day}-${month}-${year} ${time}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sourceText(value, label = "Source date") {
  return value ? `${label}: ${formatDateIN(value)}` : "";
}

function relativeTimeLabel(value) {
  if (!value) return "Not loaded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Data refreshed";
  const elapsedMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (elapsedMin < 1) return "Data refreshed";
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHr = Math.floor(elapsedMin / 60);
  if (elapsedHr < 24) return `${elapsedHr}h ago`;
  return `${Math.floor(elapsedHr / 24)}d ago`;
}

// Returns "granted" | "denied" | "error". Only the server-supplied can_view
// flag grants access; a failed lookup never opens the module.
async function loadPermissions(sessionUserId) {
  PERM_CAN_VIEW = false;
  let outcome = "error";
  try {
    const { data: perms, error: permsErr } = await supabase.rpc(
      "get_user_permissions",
      { p_user_id: sessionUserId },
    );
    if (!permsErr && Array.isArray(perms)) {
      const p = perms.find((r) => r && r.target === `module:${MODULE_ID}`);
      if (p) PERM_CAN_VIEW = !!p.can_view;
      KYC_PERMISSIONS = {
        kyc: roleAccess(perms, "role:ei-debtor-kyc"),
        commercial: roleAccess(perms, "role:ei-debtor-commercial"),
      };
      outcome = PERM_CAN_VIEW ? "granted" : "denied";
    } else {
      console.warn(
        "[MIS] Permission RPC failed",
        permsErr || "unexpected non-array result",
      );
    }
  } catch (e) {
    console.warn("[MIS] Permission RPC failed", e);
  }
  return outcome;
}

const FMT = {
  currency: (v) => formatCurrencyINR(v),
  integer: (v) => formatIntegerIN(v),
  date: (v) => formatDateIN(v),
};

// A missing figure is a word, never "0" or "-" that could be read as a value.
function orWord(value, formatter, word = "Unavailable") {
  return hasValue(value) ? formatter(value) : word;
}

// Production plan notice (legacy plan-month fallback) is only meaningful inside the Production Performance lens.
function planningNoticeHtml(row) {
  if (!row || row.planning_period_status !== PLAN_WARNING_STATUS) return "";
  return `<div class="planning-notice" role="note">Production plan notice: Current month production plan is not available. Showing next available planning month: ${escapeHtml(formatDateIN(row.planning_month_start))}.</div>`;
}

// Executive-summary snapshot. Independent latest-wins key ("summary"); the active lens never waits for it.
async function loadExecutiveSummary({ reloadLens = true } = {}) {
  if (!ACCESS.executive) return; // executive-only contract: never requested for a sales-only session
  const token = beginRequest("summary");
  try {
    if (refreshBtn) refreshBtn.disabled = true;
    closeKpiPopover();
    clearStatus();
    SUMMARY_STATE = { status: "loading", row: null, message: "" };
    updateFreshnessIndicator();
    // Refresh = one new live pipeline request (supersedes any older one) running beside the snapshot read.
    // A summary-only retry does not touch the pipeline.
    if (reloadLens) { loadLivePipeline({ force: true }); if (ACTIVE_TAB === "overview") { loadOverviewInventory({ force: true }); loadOverviewTrend({ force: true }); } }
    else loadLivePipeline();
    if (ACTIVE_TAB === "overview") renderOverview();
    else if (reloadLens) loadActiveTab();
    else renderSummaryConsumers();

    const { data, error } = await settle(
      supabase.from("mv_mis_executive_summary").select("*").eq("mis_summary_id", 1).single(),
    );
    if (!isLatestRequest("summary", token)) return;

    if (error && error.code === "PGRST116") {
      SUMMARY_STATE = { status: "empty", row: null, message: "No MIS executive summary data is available." };
    } else if (error) {
      console.error("[MIS] mv_mis_executive_summary load failed", error);
      SUMMARY_STATE = { status: "error", row: null, message: errorMessage(error) };
      if (ACTIVE_TAB === "overview") ACTIVE_TAB_FAILED = true;
    } else if (!data) {
      SUMMARY_STATE = { status: "empty", row: null, message: "No MIS executive summary data is available." };
    } else {
      LAST_SUMMARY_ROW = data;
      SUMMARY_STATE = { status: "ok", row: data, message: "" };
      DATA_REFRESH_TIME = data.mv_refreshed_at ? new Date(data.mv_refreshed_at) : null;
    }
    updateFreshnessIndicator();
    renderSummaryConsumers();
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

// Canonical inventory summary for the Overview: own latest-wins key, reused for 30 s like the shared pipeline.
function loadOverviewInventory({ force = false } = {}) {
  if (!ACCESS.executive) return Promise.resolve();
  if (!force && OVERVIEW_INV.status === "ok" && OVERVIEW_INV.asOf && Date.now() - OVERVIEW_INV.asOf.getTime() < LIVE_PIPELINE_REUSE_MS) return Promise.resolve();
  const token = beginRequest("overview:inventory");
  OVERVIEW_INV = { status: "loading", data: null, asOf: null, message: "" };
  renderOverview();
  return (async () => {
    const { data, error } = await settle(supabase.from("v_mis_inventory_tab_summary").select("*").single());
    if (!isLatestRequest("overview:inventory", token)) return;
    OVERVIEW_INV = error || !data ? { status: "error", data: null, asOf: null, message: errorMessage(error) } : { status: "ok", data, asOf: new Date(), message: "" };
    renderOverview();
  })();
}

// Overview sales trend: ONE bounded call on the existing authorised history contract (12 months, group = month), reused from the same
// request each time the Overview opens inside the reuse window; drawn only when the whole month series arrives in that response.
function loadOverviewTrend({ force = false } = {}) {
  if (!ACCESS.sales) return Promise.resolve();
  if (!force && (OVERVIEW_TREND.status === "ok" || OVERVIEW_TREND.status === "loading")) return Promise.resolve();
  const token = beginRequest("overview:trend");
  OVERVIEW_TREND = { status: "loading", data: null };
  return (async () => {
    const { data, error } = await settle(supabase.rpc("ei_sales_history", { p_months: 12, p_group: "month", p_sort: "key", p_limit: 50, p_offset: 0 }));
    if (!isLatestRequest("overview:trend", token)) return;
    OVERVIEW_TREND = error || !data || typeof data !== "object" ? { status: "unavailable", data: null } : { status: "ok", data };
    if (ACTIVE_TAB === "overview") renderOverview();
  })();
}
function overviewTrendHtml() {
  if (OVERVIEW_TREND.status === "idle" || OVERVIEW_TREND.status === "loading") return `<div class="ei-bars-note" role="status">Loading monthly sales...</div>`;
  const t = OVERVIEW_TREND.status === "ok" ? monthlyTrend(OVERVIEW_TREND.data, { group: "month" }) : { reason: "unavailable" };
  const link = `<button type="button" class="ei-text-link ei-inline-link" data-lens-link="sales" data-focus-key="link-sales-trend">Sales Performance</button>`;
  if (!t.months) return `<div class="ei-bars-note">No monthly trend is drawn here (the full month series was not available). Matched periods and history are on ${link}.</div>`;
  return `${trendHtml(t, { compact: true, label: "Monthly sales, last 12 months", format: formatCurrencyINR, unit: "* partial month; gaps are not zero; not certified.", asOf: `To ${formatDateIN(OVERVIEW_TREND.data.anchor)}` })}<div class="ei-bars-note">Matched periods and exports: ${link}.</div>`;
}

function renderSummaryConsumers() {
  if (ACTIVE_TAB === "overview") renderOverview();
  else if (ACTIVE_TAB === "finance") renderFinanceMetrics();
  else if (ACTIVE_TAB === "production") renderProductionPlanNotice();
}

function livePipelineValue(field) {
  if (LIVE_PIPELINE.status === "ok" && LIVE_PIPELINE.data) return formatIntegerIN(LIVE_PIPELINE.data[field]);
  return LIVE_PIPELINE.status === "error" ? "Unavailable" : "Loading...";
}

function livePipelineSource() {
  if (LIVE_PIPELINE.status === "ok" && LIVE_PIPELINE.asOf) return `Live, loaded ${formatDateTimeIN(LIVE_PIPELINE.asOf)}`;
  return LIVE_PIPELINE.status === "error" ? "Live pipeline unavailable" : "Live pipeline loading";
}

// Repaint every consumer of the shared live pipeline from the one state object: the Overview production group and the
// Production Performance lens.
function renderLivePipelineConsumers() {
  if (ACTIVE_TAB === "overview") renderOverview();
  renderProductionCountsBody();
}

// Single reader of v_mis_batch_pipeline. Concurrent callers share one in-flight promise; `force` (refresh/retry) starts a new request
// that supersedes any older one; a late older response can never overwrite a newer one (own latest-wins key, tab-independent).
function loadLivePipeline({ force = false } = {}) {
  if (!ACCESS.executive) return Promise.resolve();
  if (!force) {
    if (LIVE_PIPELINE_INFLIGHT) return LIVE_PIPELINE_INFLIGHT;
    if (LIVE_PIPELINE.status === "ok" && LIVE_PIPELINE.asOf && Date.now() - LIVE_PIPELINE.asOf.getTime() < LIVE_PIPELINE_REUSE_MS) return Promise.resolve();
  }
  const token = beginRequest("pipeline");
  LIVE_PIPELINE = { status: "loading", data: null, asOf: null, message: "" }; updateFreshnessIndicator();
  renderLivePipelineConsumers();
  const run = (async () => {
    const { data, error } = await settle(
      // Explicit six-field projection of the cheap live pipeline view. The legacy
      // v_mis_production_tab_summary (position x pipeline) is not queried: it times out (57014).
      supabase.from("v_mis_batch_pipeline").select(PRODUCTION_COUNT_FIELDS.join(",")).single(),
    );
    if (!isLatestRequest("pipeline", token)) return;
    if (error || !data) {
      console.error("[MIS] Live pipeline load failed", error);
      LIVE_PIPELINE = { status: "error", data: null, asOf: null, message: errorMessage(error) }; updateFreshnessIndicator();
      if (ACTIVE_TAB === "production") ACTIVE_TAB_FAILED = true;
    } else {
      LIVE_PIPELINE = { status: "ok", data, asOf: new Date(), message: "" }; updateFreshnessIndicator();
    }
    renderLivePipelineConsumers();
  })();
  const tracked = run.finally(() => { if (LIVE_PIPELINE_INFLIGHT === tracked) LIVE_PIPELINE_INFLIGHT = null; });
  LIVE_PIPELINE_INFLIGHT = tracked;
  return tracked;
}

// ---------------------------------------------------------------------------
// Overview: management narrative, reporting context, grouped domain indicators and
// real same-unit comparisons. No targets, trends or month-on-month claims exist
// in the source, so none are drawn.
// ---------------------------------------------------------------------------
function indicatorCard(card, index) {
  const info = encodeURIComponent(
    JSON.stringify({ title: card.title, note: card.note, source: card.source, detail: card.detail }),
  );
  return `
    <article class="kpi-card ${card.state || ""}">
      <div class="kpi-title">${escapeHtml(card.title)}</div>
      <div class="kpi-value">${escapeHtml(card.value)}</div>
      ${card.basis ? `<div class="kpi-basis">${escapeHtml(card.basis)}</div>` : ""}
      ${card.bar ? `<div class="kpi-bar">${dbar(card.bar.pct, card.bar.note)}</div>` : ""}
      <button class="kpi-info-btn" type="button" aria-label="Show details for ${escapeHtml(card.title)}" aria-expanded="false" data-kpi-index="${index}" data-kpi-info="${info}" data-focus-key="kpi-${index}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>
    </article>`;
}

// ---- R5 visual intelligence renderers: lightweight HTML/CSS, theme tokens only, text equivalent on every mark ----------------------
// A chart is titled, states its unit/basis (and as-of when known) and never relies on colour alone: every row carries its value as text.
function chartHead(title, asOf) {
  return title ? `<div class="ei-chart-head"><span class="ei-chart-title">${escapeHtml(title)}</span>${asOf ? `<span class="ei-asof">${escapeHtml(asOf)}</span>` : ""}</div>` : "";
}
// Inline data bar: the figure stays text beside it; the bar only adds relative size (never a second copy of the number).
const dbar = (pct, tip) => (pct === null || pct === undefined ? "" : `<span class="ei-dbar" role="img" aria-label="${escapeHtml(tip)}" title="${escapeHtml(tip)}"><span style="width:${pct}%"></span></span>`);
function barsHtml(series, { label, format, unit, title = "", asOf = "" }) {
  if (!series) return "";
  return `
    <figure class="ei-chart">
    ${chartHead(title || label, asOf)}
    <ul class="ei-bars" aria-label="${escapeHtml(label)}">
      ${series.rows
        .map((r) => {
          const text = r.pct === null ? r.missing || "Not available" : format(r.signed ?? r.value);
          return `<li class="ei-bar-row${r.pct === null ? " ei-bar-gap" : ""}" title="${escapeHtml(`${r.label}: ${text}`)}"><span class="ei-bar-label">${escapeHtml(r.label)}</span><span class="ei-bar-track" aria-hidden="true">${r.pct === null ? "" : `<span class="ei-bar-fill" style="width:${r.pct}%"></span>`}</span><span class="ei-bar-value">${escapeHtml(text)}</span></li>`;
        })
        .join("")}
    </ul>
    ${unit ? `<figcaption class="ei-bars-note">${escapeHtml(unit)}</figcaption>` : ""}
    </figure>`;
}

// A subset drawn inside its parent (e.g. overdue within work in process): visibly a part, never an additional stage.
function subsetHtml(share, { label, parent, part, unit }) {
  if (!share) return "";
  const text = `${formatIntegerIN(share.total)} ${parent}; ${formatIntegerIN(share.subset)} ${part} (${share.pct}%)`;
  return `<figure class="ei-chart">${chartHead(label)}
    <div class="ei-subset" role="img" aria-label="${escapeHtml(`${label}: ${text}`)}"><span class="ei-subset-track" aria-hidden="true"><span class="ei-subset-part" style="width:${share.pct}%"></span></span><span class="ei-subset-text">${escapeHtml(text)}</span></div>
    ${unit ? `<figcaption class="ei-bars-note">${escapeHtml(unit)}</figcaption>` : ""}</figure>`;
}

// Disjoint counts as one stacked bar with a text legend (counts, never colour only).
function segmentsHtml(series, { label, unit, noun = "items", cls = {} }) {
  if (!series) return "";
  const text = series.rows.map((r) => `${r.label} ${formatIntegerIN(r.value)}`).join(", ");
  return `<figure class="ei-chart">${chartHead(label)}
    <div class="ei-seg" role="img" aria-label="${escapeHtml(`${label}: ${text} of ${formatIntegerIN(series.total)} ${noun}`)}">${series.rows.filter((r) => r.value > 0).map((r) => `<span class="ei-seg-part ei-seg-${escapeHtml(cls[r.key] || "a")}" style="flex:${r.value} 1 0" title="${escapeHtml(`${r.label}: ${formatIntegerIN(r.value)}`)}"></span>`).join("")}</div>
    <ul class="ei-seg-legend">${series.rows.map((r) => `<li><span class="ei-seg-key ei-seg-${escapeHtml(cls[r.key] || "a")}" aria-hidden="true"></span>${escapeHtml(r.label)} <b>${escapeHtml(formatIntegerIN(r.value))}</b></li>`).join("")}</ul>
    ${unit ? `<figcaption class="ei-bars-note">${escapeHtml(unit)}</figcaption>` : ""}</figure>`;
}

// Complete chronological monthly columns. Missing months are labelled gaps, unavailable months are hollow, the anchor month is
// marked partial. Signed values are drawn from a shared zero line.
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (k) => `${MONTH_SHORT[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const INSIGHT_ICONS = { finance: "calculator", sales: "chart", inventory: "package", production: "factory", alerts: "activity" };
// Uniform tile anatomy: lead (what), hero figure, caption (one line), meta (as-at). Parsed from the narrative sentence; every word stays
// available (title attribute carries the full sentence) and unrecognised sentences fall back to the generic split below.
function insightTile(text) {
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const tile = (lead, fig, cap, meta) => `<span class="ei-insight-lead">${escapeHtml(lead)}</span> <strong class="ei-insight-figure">${escapeHtml(fig)}</strong> <span class="ei-insight-cap">${escapeHtml(cap)}</span> <span class="ei-insight-meta">${escapeHtml(meta)}</span>`;
  let m = /^Net sundry position is (-?₹[\d,]+(?:\.\d+)?): (.+?)(?: \(position (.+?)\))?\.$/.exec(text);
  if (m) return tile("Net sundry position", m[1], cap1(m[2]), m[3] ? "Position " + m[3] : "Current position");
  m = /^Month-to-date sales are (-?₹[\d,]+(?:\.\d+)?)(?: up to (.+?))?\.$/.exec(text);
  if (m) return tile("Month-to-date sales", m[1], "Month to date", m[2] ? "To " + m[2] : "Latest sales date");
  m = /^Stock on hand: materials (known value )?(-?₹[\d,]+(?:\.\d+)?)( \(not a certified total\))?(?:; finished goods (-?₹[\d,]+(?:\.\d+)?))?(?: \(report (.+?)\))?\.$/.exec(text);
  if (m) return tile(m[1] ? "Materials known value" : "Materials stock value", m[2], [m[3] ? "(not a certified total)" : "", m[4] ? "finished goods " + m[4] : ""].filter(Boolean).map((x, i) => (i ? x : cap1(x))).join(" · ") || "Materials only", m[5] ? "Report " + m[5] : "Current position");
  m = /^(\d[\d,]*) batch(?:es)? in Work in Process now(?:, (.+?))? \(live\)\.$/.exec(text);
  if (m) return tile("Batches in Work in Process", m[1], m[2] ? cap1(m[2]) : "None beyond the expected window", "Live");
  return insightHtml(text);
}
// Split a narrative sentence around its first key figure: lead-in, hero figure, remainder. Reading order and every word are unchanged.
function insightHtml(text) {
  const m = /(-?₹[\d,]+(?:\.\d+)?)|^(\d[\d,]*)(?= batch)/.exec(text);
  if (!m) return `<span class="ei-insight-rest">${escapeHtml(text)}</span>`;
  const fig = m[0], pre = text.slice(0, m.index).trim(), post = text.slice(m.index + fig.length);
  return `${pre ? `<span class="ei-insight-lead">${escapeHtml(pre)}</span> ` : ""}<strong class="ei-insight-figure">${escapeHtml(fig)}</strong> <span class="ei-insight-rest">${escapeHtml(post.replace(/^[s:;,]+/, ""))}</span>`;
}
const INSIGHT_LABELS = { finance: "Finance", sales: "Sales", inventory: "Stock", production: "Production", alerts: "Alerts" };
// Bold the money amounts and the leading count in an already-escaped sentence (presentation only; the words are unchanged).
const emphasiseFigures = (html) => html.replace(/(-?₹[\d,]+(?:\.\d+)?)/g, "<strong>$1</strong>").replace(/^(\d[\d,]*)(?= batch)/, "<strong>$1</strong>");
// Presentation helpers for the Overview cards. Pure formatting of figures the cards already hold.
function compositionHtml(parts, { title, fmt, unit }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!(total > 0) || parts.length < 2) return "";
  const pct = (v) => Math.round((v / total) * 1000) / 10;
  const text = parts.map((p) => `${p.label} ${fmt(p.value)} (${pct(p.value)}%)`).join(", ");
  return `<figure class="ei-chart"${unit ? ` title="${escapeHtml(unit)}"` : ""}>${chartHead(title)}
    <div class="ei-seg" role="img" aria-label="${escapeHtml(title + ": " + text)}">${parts.filter((p) => p.value > 0).map((p) => `<span class="ei-seg-part ei-seg-${p.cls}" style="width:${pct(p.value)}%" title="${escapeHtml(p.label + ": " + fmt(p.value))}"></span>`).join("")}</div>
    <ul class="ei-seg-legend ei-seg-legend-rows">${parts.map((p) => `<li><span class="ei-seg-key ei-seg-${p.cls}" aria-hidden="true"></span> <span class="ei-seg-name">${escapeHtml(p.label)}</span> <b>${escapeHtml(fmt(p.value))}</b> <em>${pct(p.value)}%</em></li>`).join("")}</ul>
    ${unit ? `<figcaption class="ei-bars-note">${escapeHtml(unit)}</figcaption>` : ""}</figure>`;
}
function receivablesCoverHtml(row) {
  const rec = Math.abs(Number(row.receivables_sundry_debtors)), pay = Math.abs(Number(row.payables_sundry_creditors));
  if (!Number.isFinite(rec) || !Number.isFinite(pay) || !(pay > 0) || row.receivables_sundry_debtors === null || row.payables_sundry_creditors === null) return "";
  const cover = Math.round((rec / pay) * 1000) / 10;
  const w = Math.min(100, cover);
  const tip = `Receivables cover ${cover}% of payables`;
  return `<figure class="ei-chart">${chartHead("Receivables cover of payables")}
    <div class="ei-cover" role="img" aria-label="${escapeHtml(tip)}"><span class="ei-cover-track" aria-hidden="true"><span class="ei-cover-fill" style="width:${w}%"></span></span><b class="ei-cover-value">${cover}%</b></div>
    <figcaption class="ei-bars-note">Receivables as a share of payables; 100% is fully covered.</figcaption></figure>`;
}
function overdueMeterHtml(share) {
  if (!share) return "";
  const tip = `${share.pct}% of work in process batches are beyond the expected window`;
  return `<figure class="ei-chart" title="Share of work in process beyond the expected production window (a subset of that stage).">${chartHead("Work in process running late")}
    <div class="ei-cover ei-cover-late" role="img" aria-label="${escapeHtml(tip)}"><span class="ei-cover-track" aria-hidden="true"><span class="ei-cover-fill" style="width:${Math.min(100, share.pct)}%"></span></span><b class="ei-cover-value">${share.pct}%</b></div>
    <figcaption class="ei-bars-note">Share of work in process beyond the expected window.</figcaption></figure>`;
}
let TREND_SEQ = 0;
function trendHtml(t, { label, format, unit, asOf = "", compact = false }) {
  if (!t || !t.months?.length) return "";
  // R8: the plot keeps its own aspect ratio (no stretching: points stay round, strokes stay constant), points sit on the month columns
  // below them, and the line carries a soft area, a labelled peak and the latest complete month. Every mark still has its text equivalent.
  const W = 600, H = compact ? 108 : 168, top = 12, bottom = H - 18, n = t.months.length;
  const range = t.hi - t.lo || 1;
  const x = (i) => ((i + 0.5) * W) / n;
  const y = (v) => top + ((t.hi - v) / range) * (bottom - top);
  const gid = "eiTrendFill" + ++TREND_SEQ;
  const points = t.months.map((m, i) => {
    const name = monthName(m.key) + (m.partial ? " (partial month, to the anchor date)" : "");
    const value = m.state === "ok" ? format(m.value) : m.state === "unavailable" ? "Unavailable" + (m.reported !== null ? "; source reported " + format(m.reported) + ", not certified" : "") : "No row returned (not zero)";
    return { m, i, name, value, x: x(i), y: m.state === "ok" ? y(m.value) : null };
  });
  const valued = t.months.filter((m) => m.state === "ok");
  const complete = valued.filter((m) => !m.partial);
  const peak = valued.reduce((a, m) => (a === null || m.value > a.value ? m : a), null);
  const low = complete.reduce((a, m) => (a === null || m.value < a.value ? m : a), null);
  const latest = complete.length ? complete[complete.length - 1] : null;
  // Continuous runs of valued months: a gap breaks the line and the area (a missing month is never drawn as zero).
  const runs = [];
  let cur = [];
  for (const p of points) { if (p.y === null) { if (cur.length) runs.push(cur); cur = []; } else cur.push(p); }
  if (cur.length) runs.push(cur);
  const area = runs.filter((r) => r.length > 1).map((r) => `<path class="ei-line-area" d="M${r[0].x} ${bottom} ${r.map((p) => "L" + p.x + " " + p.y).join(" ")} L${r[r.length - 1].x} ${bottom} Z" fill="url(#${gid})"/>`).join("");
  const segments = points.slice(1).map((p, i) => {
    const prev = points[i];
    if (prev.y === null || p.y === null) return "";
    return `<line class="ei-line-segment${p.m.partial || prev.m.partial ? " ei-line-partial" : ""}" x1="${prev.x}" y1="${prev.y}" x2="${p.x}" y2="${p.y}"/>`;
  }).join("");
  const marks = points.map((p) => {
    const desc = escapeHtml(p.name + ": " + p.value);
    if (p.y === null) return `<text class="ei-line-gap" x="${p.x}" y="${bottom - 6}" text-anchor="middle" tabindex="0" role="img" aria-label="${desc}"><title>${desc}</title>${p.m.state === "missing" ? "–" : "n/a"}</text>`;
    const isPeak = peak && p.m.key === peak.key;
    return `<circle class="ei-line-point${p.m.partial ? " ei-line-point-partial" : ""}${isPeak ? " ei-line-point-peak" : ""}" cx="${p.x}" cy="${p.y}" r="${isPeak ? 6 : 4.5}" tabindex="0" role="img" aria-label="${desc}"><title>${desc}</title></circle>`;
  }).join("");
  const grid = [0, 1, 2, 3].map((k) => { const gy = top + (k * (bottom - top)) / 3; return `<line class="ei-line-grid" x1="0" x2="${W}" y1="${gy}" y2="${gy}"/>`; }).join("");
  const zero = t.lo < 0 && t.hi > 0 ? `<line class="ei-line-grid ei-line-zero" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>` : "";
  const labels = points.map((p) => `<li class="ei-col-label"><span>${escapeHtml(MONTH_SHORT[Number(p.m.key.slice(5, 7)) - 1])}${p.m.partial ? "*" : ""}</span></li>`).join("");
  const values = points.map((p) => `<li>${escapeHtml(p.name)}: ${escapeHtml(p.value)}</li>`).join("");
  const gaps = t.months.length - valued.length;
  const stat = (k, m) => (m ? `<li><span>${k} · ${escapeHtml(monthName(m.key))}</span><b>${escapeHtml(format(m.value))}</b></li>` : "");
  const summary = monthName(t.months[0].key) + " to " + monthName(t.months[t.months.length - 1].key) + (gaps ? " · " + gaps + " month(s) without a value (shown as gaps, not zero)" : "");
  return `<figure class="ei-chart ei-trend">${chartHead(label, asOf)}
    <svg class="ei-line-plot" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="${escapeHtml(label)}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--mis-accent);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--mis-accent);stop-opacity:0"/></linearGradient></defs>
      ${grid}${zero}${area}${segments}${marks}
    </svg><ol class="ei-cols" aria-hidden="true">${labels}</ol>
    <ul class="ei-trend-stats">${stat("Latest", latest)}${stat("Peak", peak)}${stat("Lowest", low)}</ul>
    <div class="ei-trend-summary">${escapeHtml(summary)}</div>
    <details class="ei-trend-values"><summary>Monthly values</summary><ul>${values}</ul></details>
    ${unit ? `<figcaption class="ei-bars-note">${escapeHtml(unit)}</figcaption>` : ""}</figure>`;
}

// ---- infinite scroll plumbing ------------------------------------------------------------------------------------------------------
// One IntersectionObserver per scroll container, rooted at the actual scroll container (the table wrap). A failed chunk disarms the
// observer and shows Retry for that same chunk; without IntersectionObserver a keyboard-accessible Load more button is shown instead.
const MORE_OBS = new Map();
function disposeMore(key) { MORE_OBS.get(key)?.disconnect(); MORE_OBS.set(key, null); }
function disposeAllMore() { MORE_OBS.forEach((o) => o?.disconnect()); MORE_OBS.clear(); }
function moreHtml(key, { loading, error, done }) {
  if (done) return "";
  const noObserver = typeof IntersectionObserver !== "function";
  const inner = error
    ? `<span>Could not load more. ${escapeHtml(error)}</span> <button type="button" class="mis-retry-btn" data-more-retry="${key}">Retry</button>`
    : loading ? `<span class="table-loading-spinner" aria-hidden="true"></span> Loading more...`
    : noObserver ? `<button type="button" class="mis-retry-btn" data-more-retry="${key}">Load more</button>` : "";
  return `<div class="ei-more${error ? " error" : ""}" data-more="${key}" role="status">${inner}</div>`;
}
function armMore(root, key, load) {
  disposeMore(key);
  const sentinel = root?.querySelector(`[data-more="${key}"]`);
  if (!sentinel || sentinel.classList.contains("error") || typeof IntersectionObserver !== "function") return;
  // The scroll root is the list wrap where it scrolls (desktop) and the tab panel where the panel is the single scroller (phones).
  const oy = getComputedStyle(root).overflowY;
  const scroller = oy === "auto" || oy === "scroll" ? root : root.closest("#tabPanel") || root;
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) load(); }, { root: scroller, rootMargin: "160px", threshold: 0 });
  io.observe(sentinel);
  MORE_OBS.set(key, io);
}
window.addEventListener("pagehide", disposeAllMore);

// ---- compact record cards + in-page detail dialog -------------------------------------------------------------------------------
// At phone width (<= 640px, the module's phone breakpoint) an ordinary record table is REPLACED (never duplicated) by compact cards:
// title, secondary identity, one primary measure, a few key values and a critical status only. Every field of the record stays reachable
// in a detail dialog built from the same rendered cells (no new request, no information loss). The desktop table is unchanged and the
// month grid stays a contained scrolling matrix. Finance parties keep their existing bill drilldown.
const CARD_META = {
  finance: { title: "Party", sub: ["Group"], measure: "Outstanding", chips: ["Bills", "Signed Balance"] },
  "finance-age": { title: "Party", sub: ["Group"], measure: "Outstanding", chips: ["Bills", "Oldest (days)"] },
  inventory: { title: "Item", sub: ["Code", "Category"], measure: "Stock value", chips: ["Quantity", "Average rate"] },
  fg: { title: "Item", sub: ["Pack"], measure: "Stock Value", chips: ["Stock", "MOS"], status: "Status" },
  sales: { title: "Product", measure: "MTD billed sales", chips: ["SKUs", "MTD billed units"] },
  "Period comparison": { title: "Period", sub: ["Dates"], measure: "Sales value", chips: ["Net billed packages"], status: "Coverage" },
  "Trailing window totals": { title: "Window", measure: "Sales value", chips: ["Months observed", "Average per month"] },
  "Sales history": { title: 0, sub: ["Month"], measure: "Sales value", chips: ["Net billed packages"], status: "Coverage" },
  "Sales exceptions": { title: "Product", sub: ["Pack", "SKU"], measure: "Net billed", chips: ["Eligibility now"], status: "Activity this month" },
  "Daily coverage": { title: "Date", measure: "Mapped rows", chips: ["Raw rows", "Missing amounts"], status: "State" },
  "Facility sales by classification scope": { title: "Scope", measure: "Billed value", chips: ["Rows"] },
  "Management alerts": { title: "Check", sub: ["Evidence date"], measure: "Findings", status: "State" },
};
const phoneMQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
const isPhoneCards = () => !!phoneMQ?.matches;
function cardMetaFor(t) {
  if (t.classList.contains("ei-grid")) return null; // genuine matrix
  if (t.classList.contains("finance-table")) return t.closest("#financePartyTableWrap") ? (t.classList.contains("finance-age-table") ? CARD_META["finance-age"] : CARD_META.finance) : null;
  if (t.classList.contains("inventory-table")) return CARD_META.inventory;
  if (t.classList.contains("fg-table")) return CARD_META.fg;
  if (t.classList.contains("sales-table")) return CARD_META.sales;
  return CARD_META[t.getAttribute("aria-label")] || null;
}
const flat = (t) => t.replace(/\s+/g, " ").trim();
const cardText = (td) => { const c = td.cloneNode(true); c.querySelectorAll(".ei-cell-sub").forEach((e) => e.remove()); return flat(c.textContent); }; // the cell's own value; its small note stays in the detail view
const cardNote = (td) => flat(Array.from(td.querySelectorAll(".ei-cell-sub")).map((e) => e.textContent).join(" "));
function cardHtml(m, i, kycAlert) {
  const chips = m.chips.filter((c) => c.value).map((c) => `<span class="ei-rc-chip"><i>${escapeHtml(c.label)}</i> ${escapeHtml(c.value)}</span>`).join("");
  return `<li class="ei-rc"><button type="button" class="ei-rc-btn" data-rc="${i}" ${kycAlert ? 'aria-label="Open unclassified Debtor KYC"' : `aria-haspopup="dialog" aria-label="${escapeHtml(`Details for ${m.title}`)}"`}>
    <span class="ei-rc-top"><span class="ei-rc-title">${escapeHtml(m.title)}</span>${m.measure ? `<span class="ei-rc-measure"><b>${escapeHtml(m.measure.value)}</b><i>${escapeHtml(m.measure.label)}</i></span>` : ""}</span>
    ${m.sub.length ? `<span class="ei-rc-sub">${escapeHtml(m.sub.join(" · "))}</span>` : ""}
    ${chips || m.status ? `<span class="ei-rc-meta">${chips}${m.status ? `<span class="ei-rc-status">${escapeHtml(m.status)}</span>` : ""}</span>` : ""}
    <span class="ei-rc-go" aria-hidden="true">&rsaquo;</span></button></li>`;
}
function cardifyTable(t) {
  if (!isPhoneCards() || !t.isConnected) return;
  const meta = cardMetaFor(t);
  const head = t.tHead?.rows[0];
  if (!meta || !head) return;
  const labels = Array.from(head.cells).map((c) => c.textContent.trim());
  const rows = Array.from(t.tBodies[0]?.rows || []);
  if (!rows.length || rows.some((r) => r.cells.length !== labels.length)) return; // placeholder rows stay as they are
  const recs = rows.map((tr) => ({ party: tr.getAttribute("data-party-index"), kycAlert: !!tr.querySelector('[data-route="unclassified"]'), cells: Array.from(tr.cells).map((td) => ({ text: cardText(td), note: cardNote(td), html: td.innerHTML })) }));
  const models = recs.map((r) => {
    const m = recordCardModel(labels, r.cells.map((c) => c.text), meta);
    const tn = r.cells[labels.indexOf(typeof meta.title === "number" ? labels[meta.title] : meta.title)]?.note;
    if (tn) m.sub.push(tn); // e.g. an item's classification stays visible under its name
    return m;
  });
  const list = document.createElement("ul");
  list.className = "ei-rc-list";
  list.setAttribute("aria-label", t.getAttribute("aria-label") || meta.title || "Records");
  list.innerHTML = models.map((model, index) => cardHtml(model, index, recs[index].kycAlert)).join("");
  list.__rc = { labels, recs, models };
  t.replaceWith(list);
}
const CARD_TABLES = ".finance-table, .sales-table, .inventory-table, .fg-table, .ei-table";
function applyRecordCards(root = document) { if (isPhoneCards()) root.querySelectorAll(CARD_TABLES).forEach(cardifyTable); }
if (typeof MutationObserver === "function") {
  let queued = false;
  new MutationObserver((muts) => {
    if (queued || !isPhoneCards() || !muts.some((m) => m.addedNodes.length)) return;
    queued = true;
    queueMicrotask(() => { queued = false; applyRecordCards(); });
  }).observe(document.body, { childList: true, subtree: true });
}

let REC_OPEN = null; // { overlay, trigger, list, index }
function recOverlay() {
  let o = document.getElementById("eiRecOverlay");
  if (o) return o;
  o = document.createElement("div");
  o.id = "eiRecOverlay";
  o.className = "ei-rec-overlay";
  o.hidden = true;
  o.innerHTML = `<div class="ei-rec-dialog" role="dialog" aria-modal="true" aria-labelledby="eiRecTitle"><header class="ei-rec-head"><h3 id="eiRecTitle" class="ei-rec-title"></h3><button type="button" class="ei-drawer-close" data-rec-close aria-label="Close details">${iconHtml("close", 16)}</button></header><dl id="eiRecBody" class="ei-rec-body"></dl></div>`;
  document.body.appendChild(o);
  return o;
}
function openRecordDetails(btn) {
  const list = btn.closest(".ei-rc-list");
  const i = Number(btn.getAttribute("data-rc"));
  const rc = list?.__rc;
  if (!rc || !rc.recs[i]) return;
  if (rc.recs[i].kycAlert) { navigateFinance(INCOMPLETE_KYC_ROUTE); return; }
  if (rc.recs[i].party != null && list.closest("#financePartyTableWrap")) { const row = LISTS.finance.st.rows[Number(rc.recs[i].party)]; if (row) openFinancePartyDetails(row); return; }
  const overlay = recOverlay();
  const m = rc.models[i];
  overlay.querySelector("#eiRecTitle").textContent = m.title;
  overlay.querySelector("#eiRecBody").innerHTML = rc.recs[i].cells.map((c, k) => `<div class="ei-rec-row"><dt>${escapeHtml(rc.labels[k] || "")}</dt><dd>${c.html}</dd></div>`).join("");
  overlay.hidden = false;
  document.body.classList.add("ei-sheet-open");
  REC_OPEN = { overlay, trigger: btn, list, index: i, pushed: false };
  try { history.pushState({ eiRec: 1 }, ""); REC_OPEN.pushed = true; } catch { /* history unavailable */ }
  overlay.querySelector("[data-rec-close]").focus();
}
function closeRecordDetails({ restoreFocus = true, fromPop = false } = {}) {
  if (!REC_OPEN) return;
  const { overlay, trigger, pushed } = REC_OPEN;
  const list = REC_OPEN.list, index = REC_OPEN.index;
  REC_OPEN = null;
  overlay.hidden = true;
  if (!document.querySelector(".ei-drawer.open")) document.body.classList.remove("ei-sheet-open");
  if (pushed && !fromPop) { try { history.back(); } catch { /* ignore */ } }
  if (restoreFocus) (trigger?.isConnected ? trigger : document.querySelector(`.ei-rc-btn[data-rc="${index}"]`))?.focus?.({ preventScroll: true });
  void list;
}
document.addEventListener("click", (ev) => {
  const t = ev.target;
  const card = t.closest?.(".ei-rc-btn");
  if (card) { openRecordDetails(card); return; }
  if (!REC_OPEN) return;
  if (t.closest("[data-rec-close]") || t === REC_OPEN.overlay) { closeRecordDetails(); return; }
  if (t.closest("[data-hist-drill]")) { handleSalesClick(ev); closeRecordDetails({ restoreFocus: false }); }
});
document.addEventListener("keydown", (ev) => {
  if (!REC_OPEN) return;
  if (ev.key === "Escape") { ev.stopImmediatePropagation(); closeRecordDetails(); }
  else if (ev.key === "Tab") trapTab(REC_OPEN.overlay.querySelector(".ei-rec-dialog"), ev);
}, true);
window.addEventListener("popstate", () => { if (REC_OPEN) closeRecordDetails({ fromPop: true }); });
document.addEventListener("click", (ev) => {
  const r = ev.target.closest?.("[data-more-retry]");
  if (!r) return;
  const key = r.getAttribute("data-more-retry");
  if (LISTS[key]) loadList(key, { append: true, retry: true });
  else sxLoadMore(key, { retry: true });
});

// Breakpoint crossing: records are re-rendered by their own renderers from the state already held (no request).
function rerenderRecords() {
  closeRecordDetails({ restoreFocus: false });
  const list = { finance: "finance", inventory: "inventory", "finished-goods": "fg" }[ACTIVE_TAB] || (ACTIVE_TAB === "sales" && SX.view === "mtd" ? "sales" : "");
  if (list && LISTS[list].st.rows.length) renderListTable(list);
  else if (ACTIVE_TAB === "sales" && SX_SLOTS_FOR_VIEW[SX.view]) SX_SLOTS_FOR_VIEW[SX.view].forEach((sl) => SX_RENDER[sl] && renderSalesResults(sl));
  else if (ACTIVE_TAB === "alerts") renderAlertsLens();
}
phoneMQ?.addEventListener?.("change", rerenderRecords);

function overviewGroup({ id, title, lens, lensLabel, asOf, cards, extra = "", viz = "" }) {
  return `
    <section class="ei-group" data-domain="${id}" aria-labelledby="eiGroup-${id}">
      <header class="ei-group-head">
        <h3 class="ei-group-title" id="eiGroup-${id}">${escapeHtml(title)}</h3>
        ${asOf ? `<span class="ei-asof">${escapeHtml(asOf)}</span>` : ""}
        <button type="button" class="ei-link" data-lens-link="${lens}" data-focus-key="link-${lens}" aria-label="Open ${escapeHtml(lensLabel)}">${escapeHtml(lensLabel)}<span aria-hidden="true"> &rsaquo;</span></button>
      </header>
      <div class="ei-indicators">${cards}</div>
      <div class="ei-viz">${viz}</div>
      ${extra}
    </section>`;
}

function buildOverviewCards(row) {
  const st = SUMMARY_STATE.status;
  const snap = (v, fmt) => (st === "loading" || st === "idle" ? "Loading..." : st === "ok" ? orWord(v, fmt) : "Unavailable");
  const r = row || {};
  const financialDate = sourceText(r.financial_position_date, "Financial position");
  const salesDate = sourceText(r.sales_position_date, "Sales position");
  const inventoryDate = sourceText(r.report_generated_date, "Report generated");
  const productionDate = sourceText(r.production_report_month_start, "Production month");
  const invA = OVERVIEW_INV.status === "ok" ? analyzeInventorySummary(OVERVIEW_INV.data) : null;
  const invCov = invA?.state === "ok" ? inventoryCoverage(invA, FMT) : null;
  const invValue = OVERVIEW_INV.status === "loading" || OVERVIEW_INV.status === "idle" ? "Loading..." : invA?.state === "ok" ? orWord(invA.knownValue, formatCurrencyINR) : "Unavailable";
  const invBasis = invCov ? (invCov.certified ? "Current position" : "Known value, not certified") : "Current position";
  const pipeOk = LIVE_PIPELINE.status === "ok" && LIVE_PIPELINE.data;
  const overdue = pipeOk ? Number(LIVE_PIPELINE.data.overdue_work_in_process_batch_count) : NaN;
  let i = 0;
  // Integrated comparison: a thin bar inside the indicator that already carries the figure (no separate chart repeating the numbers).
  const bars = {};
  const fb = financeBars(r);
  if (fb) { bars["Receivables — Sundry Debtors"] = { pct: fb.rows[0].pct, note: "Magnitude vs payables" }; bars["Payables — Sundry Creditors"] = { pct: fb.rows[1].pct, note: "Magnitude vs receivables" }; }
  const mf = materialFgBars(r, invA?.state === "ok" ? invA.knownValue : null);
  if (mf && mf.rows.every((x) => x.pct !== null)) { bars["Materials Stock Value"] = { pct: mf.rows[0].pct, note: "Size vs finished goods; different bases, never added" }; bars["Finished Goods Inventory Value"] = { pct: mf.rows[1].pct, note: "Size vs materials; different bases, never added" }; }
  const lp = LIVE_PIPELINE.status === "ok" ? LIVE_PIPELINE.data : null;
  const pb = lp ? pipelineBars(lp) : null;
  if (pb) bars["Work in Process Batches"] = { pct: pb.rows[0].pct, note: "Stage size vs FG bulk and bottled; stages do not overlap" };
  const ss = lp ? subsetShare(lp.work_in_process_batch_count, lp.overdue_work_in_process_batch_count) : null;
  if (ss) bars["Overdue Work in Process Batches"] = { pct: ss.pct, note: `${ss.pct}% of work in process (a subset, not a stage)` };
  const c = (card) => indicatorCard({ ...card, bar: bars[card.title] }, i++);
  return {
    finance: [
      c({ title: "Payables — Sundry Creditors", value: snap(r.payables_sundry_creditors, formatCurrencyINR), basis: "Current position", note: "Outstanding balance under Sundry Creditors as per latest Tally outstanding snapshot.", source: financialDate, detail: "Financial liability position from Sundry Creditors." }),
      c({ title: "Receivables — Sundry Debtors", value: snap(r.receivables_sundry_debtors, formatCurrencyINR), basis: "Current position", note: "Outstanding balance under Sundry Debtors as per latest Tally outstanding snapshot.", source: financialDate, detail: "Financial asset position from Sundry Debtors." }),
      c({ title: "Net Sundry Position", value: snap(r.net_sundry_position, formatCurrencyINR), basis: "Current position", note: "Receivables minus Payables. Negative value means payables exceed receivables.", source: financialDate, detail: "Calculation: Sundry Debtors minus Sundry Creditors.", state: st === "ok" && Number(r.net_sundry_position) < 0 ? "caution" : "" }),
    ].join(""),
    sales: [
      c({ title: "Month-to-Date Sales", value: snap(r.sales_value_month_to_date, formatCurrencyINR), basis: "Month to date", note: "Sales from first day of the month up to latest available sales date.", source: salesDate, detail: "Month-to-date sales value for the current reporting month." }),
    ].join(""),
    stock: [
      c({ title: "Materials Stock Value", value: invValue, basis: invBasis, note: `Canonical manufacturing materials valuation (Raw Material, Packing Material, Indirect Materials & Utilities), the same figure and coverage as the Materials Inventory lens. ${invCov ? invCov.detail + "." : ""}`, source: inventoryDate, detail: "Known values exclude rows without a usable valuation; when coverage is incomplete this is not a certified total.", state: invA?.state === "ok" && !invA.certified ? "caution" : "" }),
      c({ title: "Finished Goods Inventory Value", value: snap(r.fg_inventory_value_overall, formatCurrencyINR), basis: "Current position", note: "Finished goods stock value from Inside Kerala, Kozhikode, and Outside Kerala stock.", source: inventoryDate, detail: "Overall finished goods inventory value across included locations." }),
    ].join(""),
    live: [
      c({ title: "Active Pipeline Batches", value: livePipelineValue("active_pipeline_batch_count"), basis: "Live now", note: "Batches currently in Not Initiated, Work in Process, Finished Goods Bulk, or Bottled Stock stages. Live count: same source as the Production Performance lens.", source: livePipelineSource(), detail: "Live count of active batches in the production pipeline (not the executive-summary snapshot)." }),
      c({ title: "Work in Process Batches", value: livePipelineValue("work_in_process_batch_count"), basis: "Live now", note: "Batches currently in Work in Process stage. Live count: same source as the Production Performance lens.", source: livePipelineSource(), detail: "Live subset of active pipeline batches currently in WIP (not the executive-summary snapshot)." }),
      c({ title: "Overdue Work in Process Batches", value: livePipelineValue("overdue_work_in_process_batch_count"), basis: "Live now", note: "Work in Process batches running beyond the expected production window. Live count: same source as the Production Performance lens.", source: livePipelineSource(), detail: "Live count. Positive values need operational follow-up.", state: pipeOk && overdue > 0 ? "caution" : "" }),
    ].join(""),
    flow: [
      c({ title: "Transferred to Finished Goods Value", value: snap(r.transferred_to_finished_goods_value, formatCurrencyINR), basis: "Snapshot period flow", note: "Executive-summary SNAPSHOT of production value moved into finished goods. A separate source from the Production Performance Tally book figure; the two are not expected to match.", source: productionDate, detail: "Source: executive summary (materialized view). Compare with the Tally book value in Production Performance only as a different basis." }),
    ].join(""),
  };
}

function withFocusRestore(fn) {
  const key = document.activeElement?.getAttribute?.("data-focus-key");
  fn();
  if (key) tabPanel?.querySelector(`[data-focus-key="${key}"]`)?.focus?.({ preventScroll: true });
}

function renderOverview() {
  if (!tabPanel || ACTIVE_TAB !== "overview") return;
  withFocusRestore(() => {
    closeKpiPopover();
    const st = SUMMARY_STATE;
    const row = st.status === "ok" ? st.row : null;
    const cards = buildOverviewCards(row);
    const invAnalysis = OVERVIEW_INV.status === "ok" ? analyzeInventorySummary(OVERVIEW_INV.data) : null;
    const narrative = overviewNarrative(row, LIVE_PIPELINE, FMT, invAnalysis);
    // R8.10: each domain card carries one visual that adds information the indicator rows do not already show, drawn from figures already
    // loaded (no new request). Finance: how far receivables cover payables. Stock: composition of the known materials value. Production:
    // where batches sit across stages and what share of work in process is overdue. Sales: the monthly line.
    const pipeData = LIVE_PIPELINE.status === "ok" ? LIVE_PIPELINE.data : null;
    const vizFinance = row ? receivablesCoverHtml(row) : "";
    const vizStock = invAnalysis?.state === "ok" ? compositionHtml(invAnalysis.groups.filter((g) => g.known !== null && g.known > 0).map((g, i) => ({ label: g.label, value: g.known, cls: ["d", "b", "e"][i] || "e" })), { title: "Materials by category", fmt: formatCurrencyINR, unit: "Known materials value; finished goods use another basis." }) : "";
    const stageSeries = pipeData ? pipelineBars(pipeData) : null;
    const overdueShare = pipeData ? subsetShare(pipeData.work_in_process_batch_count, pipeData.overdue_work_in_process_batch_count) : null;
    const vizProduction = stageSeries ? compositionHtml(stageSeries.rows.map((r, i) => ({ label: r.label, value: r.value, cls: ["d", "b", "e"][i] })), { title: "Batches by stage", fmt: formatIntegerIN, unit: "Distinct stages; Not Initiated batches are not included." }) + overdueMeterHtml(overdueShare) : "";
    const banner =
      st.status === "error"
        ? `<div class="ei-state error" role="alert">Executive summary could not be loaded. ${escapeHtml(st.message)} <button type="button" class="mis-retry-btn" data-mis-retry="summary">Retry</button></div>`
        : st.status === "empty"
          ? `<div class="ei-state" role="status">${escapeHtml(st.message)}</div>`
          : st.status === "loading" || st.status === "idle"
            ? `<div class="ei-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading executive summary...</div>`
            : "";
    tabPanel.setAttribute("aria-busy", st.status === "loading" ? "true" : "false");
    tabPanel.innerHTML = `
      <div class="ei-overview">
        <h2 class="ei-sr">Overview</h2>
        ${banner}
        ${
          narrative.length
            ? `<section class="ei-narrative ei-exec-summary" aria-labelledby="eiExecTitle"><h3 class="ei-exec-title" id="eiExecTitle">Executive Summary</h3><ul class="ei-insights">${narrative
                .map((n) => `<li class="ei-insight" data-domain="${n.lens}"><span class="ei-insight-chip" aria-hidden="true">${iconHtml(INSIGHT_ICONS[n.lens] || "chart", { size: 16 })}</span><span class="ei-insight-tag">${escapeHtml(INSIGHT_LABELS[n.lens] || n.lens)}</span><a href="#${n.lens}" class="ei-text-link" data-lens-link="${n.lens}" title="${escapeHtml(n.text)}">${insightTile(n.text)}</a></li>`)
                .join("")}</ul></section>`
            : ""
        }
        <div class="ei-groups" id="kpiGrid" aria-live="polite">
          ${overviewGroup({ id: "finance", viz: vizFinance, title: "Finance", lens: "finance", lensLabel: "Finance", asOf: row?.financial_position_date ? `Position ${formatDateIN(row.financial_position_date)}` : "", cards: cards.finance, extra: `<div class="ei-bars-note">Bars compare the size of the two balances; the signed figures are shown.</div>` })}
          ${overviewGroup({ id: "sales", title: "Sales", lens: "sales", lensLabel: "Sales Performance", asOf: row?.sales_position_date ? `To ${formatDateIN(row.sales_position_date)}` : "", cards: cards.sales, viz: overviewTrendHtml() })}
          ${overviewGroup({ id: "stock", viz: vizStock, title: "Stock on hand", lens: "inventory", lensLabel: "Materials Inventory", asOf: row?.report_generated_date ? `Report ${formatDateIN(row.report_generated_date)}` : "", cards: cards.stock, extra: `<div class="ei-bars-note">Bars compare size only: materials and finished goods are different valuation bases and are never added.</div><button type="button" class="ei-link ei-link-inline" data-lens-link="finished-goods" data-focus-key="link-finished-goods">Finished Goods <span aria-hidden="true">&rsaquo;</span></button>` })}
          ${overviewGroup({ id: "production", viz: vizProduction, title: "Production", lens: "production", lensLabel: "Production Performance", asOf: LIVE_PIPELINE.status === "ok" && LIVE_PIPELINE.asOf ? `Live ${formatDateTimeIN(LIVE_PIPELINE.asOf)}` : "", cards: cards.live + cards.flow, extra: `<div class="ei-bars-note">Bars: stage size against FG bulk and bottled stock (stages do not overlap); the overdue bar is its share of work in process, a subset.</div>` })}
          <section class="ei-group" data-domain="alerts" aria-labelledby="eiGroup-alerts">
            <header class="ei-group-head">
              <h3 class="ei-group-title" id="eiGroup-alerts">Management alerts</h3>
              <button type="button" class="ei-link" data-lens-link="alerts" data-focus-key="link-alerts">Management Alerts<span aria-hidden="true"> &rsaquo;</span></button>
            </header>
            <div class="ei-viz"><p class="ei-unavailable">Not connected yet. No alert figures are shown, and none are implied.</p></div>
          </section>
        </div>
      </div>`;
  });
}

function renderProductionPlanNotice() {
  const host = $("productionPlanNotice");
  if (host) host.innerHTML = planningNoticeHtml(LAST_SUMMARY_ROW);
}

// ---- consolidated data freshness (header) -----------------------------------------------------------------------------
// One indicator carries what the Overview used to repeat in a muted line: snapshot generation, live client-load time and source
// refresh timestamps. It only reflects data this page has already loaded (no extra request, nothing executive for sales-only).
function freshInput() {
  return {
    executive: ACCESS.executive,
    summary: { status: SUMMARY_STATE.status, at: DATA_REFRESH_TIME, message: SUMMARY_STATE.message },
    pipeline: { status: LIVE_PIPELINE.status, asOf: LIVE_PIPELINE.asOf },
    sales: { loadedAt: SX.loadedAt, status: SX.res?.dims?.status, refresh: SX.res?.refresh },
  };
}
let FRESH_PANEL = null;
function freshValue(r) {
  if (r.value) return formatDateTimeIN(r.value);
  return r.state === "loading" ? "Loading..." : r.state === "error" ? "Unavailable (could not be loaded)" : "Not available";
}
function freshPanelHtml(m) {
  return `<h2 class="ei-fresh-title" id="eiFreshTitle">Data freshness</h2>
    ${m.groups.map((g) => `<section class="ei-fresh-group" aria-label="${escapeHtml(FRESHNESS_GROUP_LABELS[g.kind])}"><h3>${escapeHtml(FRESHNESS_GROUP_LABELS[g.kind])}</h3><dl>${g.rows.map((r) => `<div class="ei-fresh-row ei-fresh-${r.state}"><dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(freshValue(r))}</dd></div>`).join("")}</dl></section>`).join("")}
    <p class="ei-fresh-note">Times describe when data was generated or read; they do not show that the underlying import is complete.</p>`;
}
function positionFreshPanel() {
  if (!FRESH_PANEL || !lastRefreshed) return;
  const margin = 12;
  const r = lastRefreshed.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - margin * 2);
  FRESH_PANEL.style.width = `${width}px`;
  const left = Math.max(margin, Math.min(r.right - width, vw - width - margin));
  const below = vh - r.bottom - margin - 8;
  const above = r.top - margin - 8;
  const openUp = below < Math.min(FRESH_PANEL.scrollHeight, 240) && above > below;
  const room = Math.max(120, openUp ? above : below);
  FRESH_PANEL.style.maxHeight = `${room}px`;
  const h = Math.min(FRESH_PANEL.scrollHeight, room);
  FRESH_PANEL.style.left = `${left}px`;
  FRESH_PANEL.style.top = `${Math.max(margin, openUp ? r.top - h - 8 : r.bottom + 8)}px`;
}
function closeFreshPanel({ restoreFocus = false } = {}) {
  if (FRESH_PANEL) { FRESH_PANEL.remove(); FRESH_PANEL = null; }
  lastRefreshed?.setAttribute("aria-expanded", "false");
  if (restoreFocus) lastRefreshed?.focus?.();
}
function toggleFreshPanel() {
  if (FRESH_PANEL) return closeFreshPanel({ restoreFocus: true });
  closeKpiPopover();
  FRESH_PANEL = document.createElement("div");
  FRESH_PANEL.id = "eiFreshPanel";
  FRESH_PANEL.className = "ei-fresh-panel";
  FRESH_PANEL.setAttribute("role", "dialog");
  FRESH_PANEL.setAttribute("aria-labelledby", "eiFreshTitle");
  FRESH_PANEL.innerHTML = freshPanelHtml(freshnessModel(freshInput()));
  document.body.appendChild(FRESH_PANEL);
  lastRefreshed.setAttribute("aria-expanded", "true");
  positionFreshPanel();
}
function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const m = freshnessModel(freshInput());
  const label = lastRefreshed.querySelector(".ei-fresh-label");
  const text = m.state === "loading" ? "Loading..." : m.state === "error" ? (m.fallbackAt ? relativeTimeLabel(m.fallbackAt) : "Unavailable") : m.fallbackAt ? relativeTimeLabel(m.fallbackAt) : "Not loaded";
  if (label) label.textContent = text;
  lastRefreshed.dataset.state = m.state;
  const aria = `Data freshness: ${text}${m.state === "error" ? " (some data could not be loaded)" : ""}. Show details.`;
  lastRefreshed.setAttribute("aria-label", aria);
  if (FRESH_PANEL) { FRESH_PANEL.innerHTML = freshPanelHtml(m); positionFreshPanel(); }
}

function closeKpiPopover() {
  if (ACTIVE_INFO_BUTTON) {
    ACTIVE_INFO_BUTTON.setAttribute("aria-expanded", "false");
  }
  if (ACTIVE_POPOVER) {
    ACTIVE_POPOVER.remove();
  }
  ACTIVE_INFO_BUTTON = null;
  ACTIVE_POPOVER = null;
  POPOVER_OPENED_BY_HOVER = false;
}

function positionKpiPopover(button, popover) {
  const margin = 12;
  const rect = button.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - margin * 2);
  popover.style.width = `${width}px`;
  const height = popover.offsetHeight;
  let left = rect.right - width;
  let top = rect.bottom + 8;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  if (top + height > window.innerHeight - margin) {
    top = rect.top - height - 8;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function openKpiPopover(button, toggle = true) {
  const raw = button.getAttribute("data-kpi-info");
  if (!raw) return;

  let info;
  try {
    info = JSON.parse(decodeURIComponent(raw));
  } catch (e) {
    console.warn("[MIS] KPI popover parse failed", e);
    return;
  }

  if (ACTIVE_INFO_BUTTON === button && toggle) {
    // A click right after a hover-open pins the popover instead of
    // immediately closing the one the pointer just opened.
    if (POPOVER_OPENED_BY_HOVER) {
      POPOVER_OPENED_BY_HOVER = false;
      return;
    }
    closeKpiPopover();
    return;
  }
  if (ACTIVE_INFO_BUTTON === button) return;

  closeKpiPopover();

  const popover = document.createElement("div");
  popover.className = "kpi-popover";
  popover.setAttribute("role", "dialog");
  popover.innerHTML = `
    <div class="kpi-popover-title">${escapeHtml(info.title)}</div>
    <div class="kpi-popover-row">
      <span class="kpi-popover-label">Explanation</span>
      ${escapeHtml(info.note)}
    </div>
    ${
      info.source
        ? `<div class="kpi-popover-row"><span class="kpi-popover-label">Source date</span>${escapeHtml(info.source)}</div>`
        : ""
    }
    ${
      info.detail
        ? `<div class="kpi-popover-row"><span class="kpi-popover-label">Calculation / interpretation</span>${escapeHtml(info.detail)}</div>`
        : ""
    }
  `;
  document.body.appendChild(popover);
  button.setAttribute("aria-expanded", "true");
  ACTIVE_INFO_BUTTON = button;
  ACTIVE_POPOVER = popover;
  POPOVER_OPENED_BY_HOVER = !toggle;
  positionKpiPopover(button, popover);
}

// Lens navigation. Compact tabs on wide screens; on narrow screens an always-reachable select. Both reflect ACTIVE_TAB.
// The URL hash is kept in step with replaceState so Back/Home semantics are unchanged (no extra history entries).
const visibleLenses = () => (ACCESS.state === "sales-only" ? LENSES.filter((l) => l.id === "sales") : LENSES);

function renderDetailTabs() {
  if (detailTabs) {
    detailTabs.innerHTML = visibleLenses().map(
      (tab) => `
      <button
        type="button"
        class="pill ${tab.id === ACTIVE_TAB ? "active" : ""}"
        data-tab="${tab.id}"
        id="lensTab-${tab.id}"
        role="tab"
        aria-selected="${tab.id === ACTIVE_TAB ? "true" : "false"}"
        aria-controls="tabPanel"
        tabindex="${tab.id === ACTIVE_TAB ? "0" : "-1"}"
      >${escapeHtml(tab.label)}</button>`,
    ).join("");
  }

  if (detailTabSelect) {
    detailTabSelect.innerHTML = visibleLenses().map(
      (tab) => `<option value="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</option>`,
    ).join("");
    detailTabSelect.value = ACTIVE_TAB;
  }
  if (tabPanel) {
    tabPanel.setAttribute("role", "tabpanel");
    tabPanel.setAttribute("aria-labelledby", `lensTab-${ACTIVE_TAB}`);
  }
  try {
    const want = ACTIVE_TAB === "finance" && KYC_HASH ? KYC_HASH : `#${ACTIVE_TAB}`;
    if (window.location.hash !== want) window.history.replaceState(null, "", want);
  } catch {
    /* hash sync is a convenience only */
  }
}

function lensHeadHtml(title, asOfHtml = "") {
  return `<div class="ei-lens-head"><h2 class="ei-sr">${escapeHtml(title)}</h2>${asOfHtml ? `<div class="ei-asof-row">${asOfHtml}</div>` : ""}</div>`;
}

// Single entry point for (re)loading the active tab. Retires every in-flight
// tab query first so a late response can never repaint the wrong panel.
function loadActiveTab() {
  // Strict permission isolation: a sales-only session can only ever load the Sales lens, whatever the hash or a stale call says.
  if (!ACCESS.executive && ACTIVE_TAB !== "sales") ACTIVE_TAB = "sales";
  if (!ACCESS.sales) return Promise.resolve();
  SX.filtersOpen = false; SX.sortOpen = false;
  document.body.classList.remove("ei-sheet-lock");
  ACTIVE_TAB_FAILED = false;
  invalidateTabRequests();
  cancelPendingSearches();
  closeAllFilterDrawers();
  tabPanel?.classList.toggle("production-panel", ACTIVE_TAB === "production");
  tabPanel?.classList.toggle("overview-panel", ACTIVE_TAB === "overview");
  tabPanel?.removeAttribute("aria-busy");
  if (ACTIVE_TAB === "overview") {
    renderOverview();
    // Reuses the shared live response when fresh; never a private duplicate request.
    return Promise.all([loadLivePipeline(), loadOverviewInventory(), loadOverviewTrend()]);
  }
  if (ACTIVE_TAB === "finance") return KYC_HASH ? loadKycWorkspace() : resumeFinance();
  leaveKycWorkspace();
  if (ACTIVE_TAB === "sales") return loadSalesTab();
  if (ACTIVE_TAB === "inventory") return loadInventoryTab();
  if (ACTIVE_TAB === "finished-goods") return loadFinishedGoodsTab();
  if (ACTIVE_TAB === "production") return loadProductionTab();
  return loadAlertsLens();
}

function renderActiveTab() {
  renderDetailTabs();
  return loadActiveTab();
}

// Choosing the tab that is already showing is a no-op (no duplicate request)
// unless its last load failed, in which case it acts as a retry.
function selectTab(tabId) {
  const next = visibleLenses().some((l) => l.id === tabId) ? tabId : visibleLenses()[0].id;
  if (KYC_HASH && next === "finance" && ACTIVE_TAB === "finance") {
    navigateFinance("");
    return;
  }
  if (next !== "finance") KYC_HASH = "";
  if (next === ACTIVE_TAB && !ACTIVE_TAB_FAILED) {
    if (detailTabSelect) detailTabSelect.value = ACTIVE_TAB;
    return;
  }
  const retry = next === ACTIVE_TAB && ACTIVE_TAB === "overview" && SUMMARY_STATE.status === "error";
  ACTIVE_TAB = next;
  renderDetailTabs();
  if (retry) {
    loadExecutiveSummary();
    return;
  }
  loadActiveTab();
}

function navigateFinance(hash, { push = true } = {}) {
  if (!ACCESS.executive || (ACTIVE_TAB === "finance" && KYC_HASH === hash)) return;
  const previous = ACTIVE_TAB;
  if (previous === "finance" && !KYC_HASH && hash) {
    closeAllFilterDrawers();
    closeFinanceModal();
    closeAgeBreakdown({ restoreFocus: false });
    closeAgeingDialog({ restoreFocus: false });
    const wrap = $("financePartyTableWrap");
    const pendingSearch = $("financeSearch")?.value.trim();
    const searchChanged = pendingSearch != null && pendingSearch !== LISTS.finance.st.search;
    if (searchChanged) LISTS.finance.st.search = pendingSearch;
    suspendedFinance = wrap ? {
      node: tabPanel.firstElementChild, top: tabPanel.scrollTop, listTop: wrap.scrollTop,
      ready: !searchChanged && !LISTS.finance.st.loading && LISTS.finance.sum.status !== "loading" && AGE.sum.status !== "loading",
    } : null;
    suspendedFinance?.node.remove();
    disposeMore("finance");
  }
  KYC_HASH = hash;
  ACTIVE_TAB = "finance";
  if (push) window.history.pushState(null, "", hash || "#finance");
  renderDetailTabs();
  loadActiveTab();
}

function leaveKycWorkspace() {
  disposeKyc?.();
  disposeKyc = null;
}

function loadKycWorkspace() {
  if (!ACCESS.executive) return;
  leaveKycWorkspace();
  const host = document.createElement("div");
  tabPanel.replaceChildren(host);
  disposeKyc = mountDebtorWorkspace(host, {
    read: readDebtorRpc, permissions: KYC_PERMISSIONS, esc: escapeHtml, money: formatCurrencyINR,
    partition: KYC_HASH === INCOMPLETE_KYC_ROUTE ? "unclassified" : "all",
    onChange: () => { financeDirty = true; financeLookups = null; },
    back: () => navigateFinance(""),
  });
}

function resumeFinance() {
  const returning = !!disposeKyc;
  leaveKycWorkspace();
  const saved = suspendedFinance;
  suspendedFinance = null;
  if (saved?.ready && !financeDirty) {
    tabPanel.replaceChildren(saved.node);
    const wrap = $("financePartyTableWrap");
    tabPanel.scrollTop = saved.top;
    wrap.scrollTop = saved.listTop;
    LISTS.finance.st.more.loading = false;
    renderListTable("finance");
    $("openDebtorKyc")?.focus({ preventScroll: true });
    return;
  }
  financeDirty = false;
  if (saved) financeScrollOnLoad = saved;
  if (AGE.sum.status === "loading" || returning) AGE.sum = { status: "idle" };
  const loading = loadFinanceTab();
  if (returning) $("openDebtorKyc")?.focus({ preventScroll: true });
  return loading;
}

function setTableLoading(
  shellSelector,
  isLoading,
  message = "Loading data...",
) {
  const shell = document.querySelector(shellSelector);
  if (!shell) return;

  let mask = shell.querySelector(".table-loading-mask");

  if (isLoading) {
    if (!mask) {
      mask = document.createElement("div");
      mask.className = "table-loading-mask";
      mask.setAttribute("role", "status");
      shell.appendChild(mask);
    }

    mask.innerHTML = `
      <div class="table-loading-card">
        <span class="table-loading-spinner" aria-hidden="true"></span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
    mask.hidden = false;
    shell.setAttribute("aria-busy", "true");
  } else {
    if (mask) mask.hidden = true;
    shell.removeAttribute("aria-busy");
  }
}

// ---------------------------------------------------------------------------
// Server-paged lenses (Finance, Sales Performance, Materials Inventory, Finished Goods).
// One generic implementation: per-list state, a latest-wins page request and a latest-wins summary request.
// All search, filter and paging happens on the server; the browser never scans or filters history.
// ---------------------------------------------------------------------------
function newListState(filter) {
  return { filter, search: "", page: 1, size: 25, offset: 0, total: 0, rows: [], loading: false, error: "", done: false, more: { loading: false, error: "" } };
}

const metric = ({ label, value, sub = "", state = "", title = "", bar = null }) => `
  <div class="ei-metric ${state}"${title ? ` title="${escapeHtml(title)}"` : ""}>
    <div class="ei-metric-label">${escapeHtml(label)}</div>
    <div class="ei-metric-value">${escapeHtml(value)}</div>
    ${sub ? `<div class="ei-metric-sub">${escapeHtml(sub)}</div>` : ""}
    ${bar ? dbar(bar.pct, bar.note) : ""}
  </div>`;

const summaryState = (L, loadingText) =>
  L.sum.status === "loading" || L.sum.status === "idle"
    ? `<div class="ei-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> ${escapeHtml(loadingText)}</div>`
    : L.sum.status === "error"
      ? `<div class="ei-state error" role="alert">${escapeHtml(L.errorText)} ${escapeHtml(L.sum.error)} <button type="button" class="mis-retry-btn" data-mis-retry="${L.retryKey}">Retry</button></div>`
      : "";

function financeMetricsHtml() {
  const st = SUMMARY_STATE;
  if (st.status === "loading" || st.status === "idle") {
    return `<div class="ei-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading position...</div>`;
  }
  if (st.status !== "ok") {
    return `<div class="ei-state ${st.status === "error" ? "error" : ""}" role="${st.status === "error" ? "alert" : "status"}">Outstanding position is unavailable${st.message ? `: ${escapeHtml(st.message)}` : "."} ${st.status === "error" ? `<button type="button" class="mis-retry-btn" data-mis-retry="summary">Retry</button>` : ""}</div>`;
  }
  const r = st.row;
  const fbars = financeBars(r);
  const date = r.financial_position_date ? `Outstanding position ${formatDateIN(r.financial_position_date)}` : "Outstanding position";
  return `
    <div class="ei-asof-row"><span>${escapeHtml(date)}</span><span>Signed Tally balances</span></div>
    <div class="ei-metrics">
      ${metric({ label: "Payables — Sundry Creditors", value: orWord(r.payables_sundry_creditors, formatCurrencyINR), bar: fbars && { pct: fbars.rows[1].pct, note: "Magnitude vs receivables" } })}
      ${metric({ label: "Receivables — Sundry Debtors", value: orWord(r.receivables_sundry_debtors, formatCurrencyINR), bar: fbars && { pct: fbars.rows[0].pct, note: "Magnitude vs payables" } })}
      ${metric({ label: "Net Sundry Position", value: orWord(r.net_sundry_position, formatCurrencyINR), sub: "Receivables minus payables", state: Number(r.net_sundry_position) < 0 ? "caution" : "" })}
    </div>`;
}

function renderFinanceMetrics() {
  const host = $("financeMetrics");
  if (host) host.innerHTML = financeMetricsHtml();
}

function basisDetails(lines) {
  const items = lines.filter(Boolean);
  if (!items.length) return "";
  return `<details class="ei-basis"><summary>Basis and definitions</summary><ul>${items.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul></details>`;
}

function salesSummaryHtml(L) {
  const wait = summaryState(L, "Loading sales summary...");
  if (wait) return wait;
  const m = analyzeSalesSummary(L.sum.data);
  if (m.state !== "ok") return `<div class="ei-state ei-state-unavailable" role="status">No mapped sales dates are available yet, so no sales figures are shown.</div>`;
  const period = m.monthStart ? `${formatDateIN(m.monthStart)} to ${formatDateIN(m.uptoDate)}` : `to ${formatDateIN(m.uptoDate)}`;
  const n = (v) => orWord(v, formatNumberIN, "Not reported");
  const c = (v) => orWord(v, formatCurrencyINR, "Not reported");
  return `
    <div class="ei-asof-row"><span>Latest mapped sales day <b>${escapeHtml(formatDateIN(m.latestDate))}</b></span><span>Month to date ${escapeHtml(period)}</span></div>
    <div class="ei-metric-groups">
      <section class="ei-metric-group" aria-label="Latest mapped day">
        <h3 class="ei-metric-group-title">Latest day</h3>
        <div class="ei-metrics">
          ${metric({ label: "Billed sales value", value: c(m.latest.value) })}
          ${metric({ label: "Actual units", value: n(m.latest.units) })}
          ${metric({ label: "Billed units", value: n(m.latest.billed) })}
        </div>
      </section>
      <section class="ei-metric-group" aria-label="Month to date">
        <h3 class="ei-metric-group-title">Month to date</h3>
        <div class="ei-metrics">
          ${metric({ label: "Billed sales value", value: c(m.mtd.value) })}
          ${metric({ label: "Actual units", value: n(m.mtd.units) })}
          ${metric({ label: "Billed units", value: n(m.mtd.billed) })}
          ${metric({ label: "Average per sales day", value: c(m.avgPerDay), sub: m.days != null ? `over ${formatIntegerIN(m.days)} sales days in the month` : "", title: "Month-to-date billed sales divided by the days in the month that have mapped sales" })}
          ${metric({ label: "Products sold", value: n(m.products) })}
          ${metric({ label: "SKUs sold", value: n(m.skus) })}
        </div>
      </section>
    </div>
    ${basisDetails([
      "Month to date runs from the first day of the latest mapped sales month to the latest mapped sales date; it does not use today's date.",
      "Billed sales value is the signed billed amount, so returns reduce it. Actual units and billed units are separate source measures and can differ.",
      "Average per sales day divides month-to-date billed sales by the days in the month that have mapped sales. In the product table, each product's average divides by the days that product itself sold.",
      "No historical series or comparison with earlier periods is shown here.",
    ])}`;
}

function inventorySummaryHtml(L) {
  const wait = summaryState(L, "Loading materials summary...");
  if (wait) return wait;
  const a = analyzeInventorySummary(L.sum.data);
  if (a.state !== "ok") {
    return `
      <div class="ei-state ei-state-unavailable" role="status">
        <b>Canonical materials valuation is unavailable.</b>
        The server has not supplied the canonical category and valuation fields, so category values and coverage are not shown and are not estimated.
        Item rows below are the source rows as supplied; category filters are switched off.
      </div>`;
  }
  const money = (g) => (g.valueState === "value" ? formatCurrencyINR(g.known) : g.valueState === "none" ? "No items" : "Unavailable");
  const maxKnown = Math.max(0, ...a.groups.filter((g) => g.valueState === "value").map((g) => Number(g.known)));
  const tiles = a.groups
    .map((g) =>
      metric({
        label: g.label,
        value: money(g),
        sub: `${formatIntegerIN(g.count)} ${a.rowWord}${g.gaps ? ` · ${formatIntegerIN(g.gaps)} without usable valuation` : ""}`,
        state: g.valueState === "unavailable" ? "unavailable" : "",
        bar: g.valueState === "value" ? { pct: inlineBarPct(g.known, maxKnown), note: "Size vs the largest category" } : null,
      }),
    )
    .join("");
  const cov = inventoryCoverage(a, FMT);
  const unclassified =
    a.unclassified.count > 0
      ? metric({ label: "Unclassified", value: a.unclassified.value != null ? formatCurrencyINR(a.unclassified.value) : "Unavailable", sub: `${formatIntegerIN(a.unclassified.count)} ${a.rowWord}`, state: "caution" })
      : "";
  return `
    <div class="ei-asof-row">
      <span>Raw Material · Packing Material · Indirect Materials &amp; Utilities</span>
      <span>Current stock, not period flows</span>
    </div>
    <div class="ei-metrics ei-metrics-wide">
      ${metric({ label: cov.headline, value: a.knownValue != null ? formatCurrencyINR(a.knownValue) : "Unavailable", sub: a.certified ? "All rows valued and classified" : "Not a certified total", state: a.certified ? "" : "caution" })}
      ${tiles}
      ${unclassified}
    </div>
    <div class="ei-coverage" role="status">
      Coverage: ${escapeHtml(cov.detail)}.
    </div>
    ${basisDetails([
      "Known values exclude rows whose valuation is not usable. A zero quantity with no rate is a valid zero; a non-zero quantity with a missing or non-positive rate is unavailable, not zero.",
      "The primary category is the server's category label. Source kind appears on each row only as supporting evidence.",
      a.rowWord === "source rows" ? "Counts are source rows, not items, because duplicate or missing item identities were found." : "",
      "Finished Goods stock is reported in its own lens.",
    ])}`;
}

function fgSummaryHtml(L) {
  const wait = summaryState(L, "Loading finished goods summary...");
  if (wait) return wait;
  const s = L.sum.data;
  if (!s) return `<div class="ei-state ei-state-unavailable" role="status">No finished goods summary is available.</div>`;
  const fgSegs = fgStatusSegments(s);
  return `
    <div class="ei-asof-row"><span>Current stock position</span>
      <span>Period transfers into finished goods are on the <button type="button" class="ei-text-link ei-inline-link" data-lens-link="production">Production Performance</button> lens</span></div>
    <div class="ei-metrics">
      ${metric({ label: "SKUs", value: orWord(s.sku_count, formatIntegerIN) })}
      ${metric({ label: "Stock value", value: orWord(s.stock_value_overall, formatCurrencyINR) })}
      ${fgSegs ? "" : [
        metric({ label: "Zero stock", value: orWord(s.zero_stock_sku_count, formatIntegerIN), sub: "SKUs with no stock", state: Number(s.zero_stock_sku_count) > 0 ? "caution" : "" }),
        metric({ label: "Below 1 month cover", value: orWord(s.below_1_month_cover_count, formatIntegerIN), sub: "Months-of-stock status" }),
        metric({ label: "Above 6 months cover", value: orWord(s.above_6_month_cover_count, formatIntegerIN), sub: "Months-of-stock status" }),
      ].join("")}
    </div>
    ${fgSegs ? compositionHtml(fgSegs.rows.map((r) => ({ label: r.label, value: r.value, cls: { ZERO: "c", LOW: "b", HIGH: "d", OTHER: "e" }[r.key] || "e" })), { title: "SKUs by months of stock", fmt: formatIntegerIN, unit: "Server statuses, each SKU in one status. Other statuses is SKUs minus the three listed, so it includes normal cover." }) : ""}
    ${basisDetails([
      "Zero stock and low cover are separate server statuses; neither is derived from an arbitrary threshold in the browser.",
      "Stock is the current position. Transfers into finished goods are period flows and are reported under Production Performance.",
    ])}`;
}

function financeBasisHtml(L) {
  const note = L.sum.status === "ok" ? L.sum.data?.finance_scope_note : "";
  return basisDetails([note, "Signed amount is the original Tally balance. The MIS total is calculated from signed balances, not by adding every absolute bill line."]);
}

const finParse = (data) => {
  if (Array.isArray(data)) {
    const t = data[0]?.total_rows ?? data[0]?.total_count;
    return { rows: data, total: Number(t ?? data.length) || 0 };
  }
  const rows = data?.rows || [];
  return { rows, total: Number(data?.total_rows ?? data?.total_count ?? rows.length) || 0 };
};
const arrParse = (data) => {
  const rows = Array.isArray(data) ? data : [];
  return { rows, total: Number(rows[0]?.total_rows ?? rows.length) || 0 };
};

function inventoryFilterConfig() {
  const L = LISTS.inventory;
  const canon = L.sum.status === "ok" ? inventoryCanonicalAvailable(L.sum.data) : null;
  return {
    title: "Material category",
    ariaLabel: "Materials filters",
    options: INVENTORY_CANONICAL_FILTERS.map((f) => ({ ...f, disabled: canon === false && f.value !== "all" })),
    note: canon === false ? "Category filters need the canonical inventory contract, which is not available yet." : "",
  };
}

// ---------------------------------------------------------------------------
// Finance ageing (R8.17). Optional analysis mode of the Finance lens: outstanding bills are aged from the bill date to an as-of date and
// grouped into owner-chosen day bands; an optional age range keeps only bills inside it. The party table and the band summary come from
// two read-only server contracts (see docs/executive-intelligence-r2/FINANCE_AGEING_SERVER_SPEC.md); when they are not installed the lens
// says so and shows no ageing figures. The existing outstanding position, party page and bill view are untouched while ageing is off.
// ---------------------------------------------------------------------------
const AGE_RPC_PAGE = "get_mis_finance_ageing_party_page";
const AGE_RPC_SUMMARY = "get_mis_finance_ageing_summary";
const AGE_PRESETS = [[30, 60, 90], [15, 30, 60, 90], [30, 60, 90, 180], [45, 90, 180, 365]];
const AGE_MISSING_TEXT = "Ageing analysis needs a server contract that is not installed yet, so no ageing figures are shown.";
const AGE = { on: false, open: false, asOf: "", bounds: [30, 60, 90], min: null, max: null, error: "", sum: { status: "idle", data: null, error: "", missing: false } };
const ageMissing = (err) => /PGRST202|42883|could not find the function|does not exist/i.test(`${err?.code || ""} ${err?.message || ""}`);
const todayISO = () => new Date().toISOString().slice(0, 10);
const ageAsOf = () => AGE.asOf || String(SUMMARY_STATE.row?.financial_position_date || "").slice(0, 10) || todayISO();
const ageArgs = () => ({ p_as_of: AGE.asOf || null, p_basis: "bill_date", p_bounds: AGE.bounds, p_age_min: AGE.min, p_age_max: AGE.max });
const AGE_BAND_STEPS = { 2: [0, 4], 3: [0, 2, 4], 4: [0, 1, 2, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
const ageBandClass = (i, n) => `fin-age-b${(AGE_BAND_STEPS[n] || AGE_BAND_STEPS[6])[i] ?? 0}`;

function ageingControlsHtml() {
  const n = AGE.bounds.length + 1;
  return `<button id="financeAgeBtn" type="button" class="ei-ctl fin-age-btn${AGE.on ? " is-active" : ""}" data-act="age-toggle" data-list="finance" aria-pressed="${AGE.on}" aria-expanded="${AGE.open}" aria-label="Ageing analysis" title="Ageing analysis">
    ${iconHtml("calendar", { size: 16 })}<span class="fin-age-btn-label">Ageing${AGE.on ? `: ${n} bands` : ""}</span></button>`;
}
// The settings open as an in-page dialog (a full-page dialog on phones), like the other overlays, so the table below never moves.
const ageingPanelHtml = () => "";
let AGE_DLG = null; // { overlay, trigger }
function ageBandSummaryText(text) {
  const b = parseAgeBounds(text);
  return b.error ? "" : `Bands: ${ageLabels(b.bounds).join(" · ")} days`;
}
function ageingDialogHtml() {
  const posDate = String(SUMMARY_STATE.row?.financial_position_date || "").slice(0, 10);
  const presets = AGE_PRESETS.map((b) => `<button type="button" class="fin-age-preset${b.join() === AGE.bounds.join() ? " is-active" : ""}" data-act="age-preset" data-bounds="${b.join(",")}" aria-pressed="${b.join() === AGE.bounds.join()}">${escapeHtml(b.join(" · "))}</button>`).join("");
  return `
    <div class="modal-window fin-age-dialog" role="dialog" aria-modal="true" aria-labelledby="financeAgeTitle">
      <div class="modal-header">
        <div><h2 id="financeAgeTitle" class="finance-modal-title">Ageing analysis</h2><div class="finance-modal-subtitle">Group the outstanding bills by how long they have been open.</div></div>
        <button type="button" class="modal-close-btn" data-act="age-close" aria-label="Close ageing settings" title="Close">${ICON_X}</button>
      </div>
      <div class="modal-content fin-age-body">
        <section class="fin-age-step" aria-labelledby="financeAgeStep1">
          <h3 id="financeAgeStep1"><span aria-hidden="true">1</span>Ageing as of</h3>
          <div class="fin-age-row"><input id="financeAgeAsOf" type="date" value="${escapeHtml(AGE.asOf || ageAsOf())}" aria-label="Ageing as of date" />${posDate ? `<button type="button" class="fin-age-link" data-act="age-asof-position" data-date="${escapeHtml(posDate)}">Use position date (${escapeHtml(formatDateIN(posDate))})</button>` : ""}</div>
          <p class="fin-age-hint">This sets the date each bill's age is measured to. It does not change the outstanding position, which stays as at ${posDate ? escapeHtml(formatDateIN(posDate)) : "the latest position date"}.</p>
        </section>
        <section class="fin-age-step" aria-labelledby="financeAgeStep2">
          <h3 id="financeAgeStep2"><span aria-hidden="true">2</span>Age bands (days)</h3>
          <div class="fin-age-presets" role="group" aria-label="Band presets">${presets}</div>
          <label class="fin-age-label" for="financeAgeBounds">Or enter your own limits, separated by commas (up to ${AGE_MAX_BOUNDS})</label>
          <input id="financeAgeBounds" type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(AGE.bounds.join(", "))}" placeholder="30, 60, 90" aria-describedby="financeAgeBandHint" />
          <p id="financeAgeBandHint" class="fin-age-bands" aria-live="polite">${escapeHtml(ageBandSummaryText(AGE.bounds.join(",")))}</p>
        </section>
        <section class="fin-age-step" aria-labelledby="financeAgeStep3">
          <h3 id="financeAgeStep3"><span aria-hidden="true">3</span>Only bills aged <em>(optional)</em></h3>
          <div class="fin-age-range-in"><input id="financeAgeMin" type="number" min="0" step="1" inputmode="numeric" value="${AGE.min ?? ""}" placeholder="from" aria-label="Minimum age in days" /><i>to</i><input id="financeAgeMax" type="number" min="0" step="1" inputmode="numeric" value="${AGE.max ?? ""}" placeholder="to" aria-label="Maximum age in days" /><i>days</i></div>
          <p class="fin-age-hint">Leave empty to include every bill. Both limits are inclusive. Bills without a usable date are always kept and shown separately.</p>
        </section>
        <div id="financeAgeError" class="fin-age-error" role="alert">${escapeHtml(AGE.error)}</div>
        <p class="fin-age-note">Age is days from the bill date to the as-of date. A bill dated after the as-of date counts as current. Credit lines keep their sign; amounts are shown in the direction of each party's net balance.</p>
      </div>
      <div class="fin-age-footer">
        ${AGE.on ? `<button type="button" class="ei-ctl fin-age-off" data-act="age-reset">Turn off ageing</button>` : "<span></span>"}
        <span class="fin-age-footer-main"><button type="button" class="ei-ctl" data-act="age-close">Cancel</button><button type="button" class="ei-ctl fin-age-apply" data-act="age-apply">Apply ageing</button></span>
      </div>
    </div>`;
}
function openAgeingDialog() {
  if (AGE_DLG) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay fin-age-overlay";
  overlay.innerHTML = ageingDialogHtml();
  document.body.appendChild(overlay);
  AGE_DLG = { overlay, trigger: document.activeElement };
  AGE.open = true; AGE.error = "";
  $("financeAgeBtn")?.setAttribute("aria-expanded", "true");
  const dlg = overlay.querySelector(".fin-age-dialog");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeAgeingDialog(); });
  overlay.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    switch (b.getAttribute("data-act")) {
      case "age-close": closeAgeingDialog(); break;
      case "age-apply": applyAgeingSettings(); break;
      case "age-reset": resetAgeing(); break;
      case "age-asof-position": { const i = $("financeAgeAsOf"); if (i) i.value = b.getAttribute("data-date") || ""; break; }
      case "age-preset": {
        const input = $("financeAgeBounds");
        if (input) input.value = String(b.getAttribute("data-bounds") || "").split(",").join(", ");
        overlay.querySelectorAll(".fin-age-preset").forEach((x) => { x.classList.toggle("is-active", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        const p = $("financeAgeBandHint"); if (p) p.textContent = ageBandSummaryText(input?.value);
        break;
      }
      default:
    }
  });
  overlay.addEventListener("input", (ev) => {
    if (ev.target.id !== "financeAgeBounds") return;
    const p = $("financeAgeBandHint");
    const t = ev.target.value;
    if (p) p.textContent = parseAgeBounds(t).error ? parseAgeBounds(t).error : ageBandSummaryText(t);
    overlay.querySelectorAll(".fin-age-preset").forEach((x) => { const on = String(x.getAttribute("data-bounds")).split(",").join() === String(t).split(/[\s,;]+/).filter(Boolean).join(); x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", String(on)); });
  });
  overlay.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab") trapTab(dlg, ev);
    else if (ev.key === "Enter" && ev.target.matches("input:not([type=date])")) { ev.preventDefault(); applyAgeingSettings(); }
  });
  setTimeout(() => { if (AGE_DLG) document.body.classList.add("ei-sheet-open"); }, 0); // after the opening click has finished its outside-click handlers
  dlg.querySelector(".modal-close-btn").focus({ preventScroll: true });
}
function closeAgeingDialog({ restoreFocus = true } = {}) {
  if (!AGE_DLG) return;
  const { overlay, trigger } = AGE_DLG;
  AGE_DLG = null;
  AGE.open = false; AGE.error = "";
  overlay.remove();
  document.body.classList.remove("ei-sheet-open");
  const btn = $("financeAgeBtn");
  btn?.setAttribute("aria-expanded", "false");
  if (restoreFocus) (btn || (trigger && document.contains(trigger) ? trigger : null))?.focus?.();
}
function renderFinanceAgeing() {
  const host = $("financeAgeing");
  if (host) host.innerHTML = financeAgeingHtml();
}
function financeAgeingHtml() {
  if (!AGE.on && !financeClassActive()) return "";
  const s = AGE.sum;
  if (s.status === "idle" || s.status === "loading") return `<div class="ei-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading ageing...</div>`;
  if (s.status === "error") return `<div class="ei-state ${s.missing ? "ei-state-unavailable" : "error"}" role="${s.missing ? "status" : "alert"}">${escapeHtml(s.missing ? AGE_MISSING_TEXT : `Ageing could not be loaded. ${s.error}`)}${s.missing ? "" : ` <button type="button" class="mis-retry-btn" data-act="age-retry" data-list="finance">Retry</button>`}</div>`;
  const d = s.data || {};
  if (!AGE.on) return d.filtered_receivables ? `<div class="ei-asof-row"><span>Filtered receivables</span><strong>${escapeHtml(formatCurrencyINR(d.filtered_receivables.total_amount))}</strong></div>` : "";
  const all = Array.isArray(d) ? d : d.groups || [];
  const want = LISTS.finance.st.filter;
  const groups = financeClassActive() ? [...all] : all.filter((g) => want === "all" || g.group === want);
  if (d.filtered_receivables && financeClassActive()) groups.push({ ...d.filtered_receivables, group: "filtered", label: "Filtered receivables" });
  const bounds = (Array.isArray(d.bounds) && d.bounds.length ? d.bounds : AGE.bounds).map(Number);
  const labels = ageLabels(bounds);
  const asOf = d.as_of || ageAsOf();
  if (!groups.length) return `<div class="ei-state ei-state-unavailable" role="status">No ageing figures were returned for this scope.</div>`;
  const range = AGE.min !== null || AGE.max !== null ? ` · bills aged ${AGE.min ?? 0}${AGE.max !== null ? `–${AGE.max}` : "+"} days only` : "";
  AGE_DETAIL.clear();
  return `<section class="fin-ageing" aria-label="Ageing summary">
    <header class="fin-ageing-head"><h3 class="fin-ageing-title">Ageing</h3><span class="ei-asof">As of ${escapeHtml(formatDateIN(asOf))} · from bill date${escapeHtml(range)}</span></header>
    <div class="fin-ageing-groups">${groups.map((g) => ageGroupHtml(g, labels)).join("")}</div>
  </section>`;
}
const AGE_DETAIL = new Map(); // group key -> { name, html, asOf } for the breakdown dialog
function ageGroupHtml(g, labels) {
  const amts = Array.isArray(g.bucket_amounts) ? g.bucket_amounts.map((v) => (v === null || v === undefined ? null : Number(v))) : [];
  const cnts = Array.isArray(g.bucket_bill_counts) ? g.bucket_bill_counts : [];
  const name = g.label || g.group || "Group";
  if (amts.length !== labels.length) return `<div class="ei-state error" role="alert">${escapeHtml(name)}: the ageing bands returned do not match the bands asked for.</div>`;
  const total = g.total_amount !== null && g.total_amount !== undefined ? Number(g.total_amount) : amts.reduce((a, v) => a + (v || 0), 0);
  const pos = amts.reduce((a, v) => a + Math.max(0, v || 0), 0);
  const cls = (i) => ageBandClass(i, labels.length);
  const money = (v) => (v === null ? "–" : formatCurrencyINR(v));
  const pct = (v) => (pos > 0 && v > 0 ? `${Math.round((v / pos) * 1000) / 10}%` : "–");
  const hasUndated = Number(g.undated_bill_count) > 0 || Number(g.undated_amount || 0) !== 0;
  // Slim distribution bar (positive balances only; credit bands and zero totals are stated in the table, never drawn as negative length).
  const bar = pos > 0 ? amts.map((v, i) => (v > 0 ? `<span class="fin-age-seg ${cls(i)}" style="width:${(v / pos) * 100}%" title="${escapeHtml(`${labels[i]} days: ${money(v)}`)}"></span>` : "")).join("") : "";
  const barAria = escapeHtml(`${name}: ${labels.map((l, i) => `${l} days ${money(amts[i])}`).join(", ")}`);
  const bth = (l, i) => `<th scope="col" class="num ${cls(i)}"><i class="fin-age-key" aria-hidden="true"></i>${escapeHtml(l)}</th>`;
  const table = `<table class="fin-age-mini fin-age-mini-h">
      <thead><tr><th scope="col">Age (days)</th>${labels.map(bth).join("")}${hasUndated ? `<th scope="col" class="num fin-age-und">No date</th>` : ""}</tr></thead>
      <tbody>
        <tr><th scope="row">Outstanding</th>${amts.map((v) => `<td class="num${v !== null && v < 0 ? " fin-age-neg" : ""}">${escapeHtml(money(v))}</td>`).join("")}${hasUndated ? `<td class="num fin-age-und">${escapeHtml(money(Number(g.undated_amount)))}</td>` : ""}</tr>
        <tr><th scope="row">Share</th>${amts.map((v) => `<td class="num">${pct(v)}</td>`).join("")}${hasUndated ? `<td class="num fin-age-und">–</td>` : ""}</tr>
        <tr><th scope="row">Bills</th>${amts.map((_, i) => `<td class="num">${cnts[i] != null ? escapeHtml(formatIntegerIN(cnts[i])) : "–"}</td>`).join("")}${hasUndated ? `<td class="num fin-age-und">${g.undated_bill_count != null ? escapeHtml(formatIntegerIN(g.undated_bill_count)) : "–"}</td>` : ""}</tr>
      </tbody></table>`;
  // Narrow screens: the same figures as a vertical band list (one row per band).
  const tableV = `<table class="fin-age-mini fin-age-mini-v"><thead><tr><th scope="col">Age (days)</th><th scope="col" class="num">Outstanding</th><th scope="col" class="num">Share</th><th scope="col" class="num">Bills</th></tr></thead><tbody>${labels.map((l, i) => `<tr><th scope="row"><i class="fin-age-key ${cls(i)}" aria-hidden="true"></i>${escapeHtml(l)}</th><td class="num${amts[i] !== null && amts[i] < 0 ? " fin-age-neg" : ""}">${escapeHtml(money(amts[i]))}</td><td class="num">${pct(amts[i])}</td><td class="num">${cnts[i] != null ? escapeHtml(formatIntegerIN(cnts[i])) : "–"}</td></tr>`).join("")}${hasUndated ? `<tr class="fin-age-und"><th scope="row">No date</th><td class="num">${escapeHtml(money(Number(g.undated_amount)))}</td><td class="num">–</td><td class="num">${g.undated_bill_count != null ? escapeHtml(formatIntegerIN(g.undated_bill_count)) : "–"}</td></tr>` : ""}</tbody></table>`;
  const stat = (k, v) => (v ? `<li><span class="fin-chip-lab">${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></li>` : "");
  const stats = [
    stat("Total outstanding", formatCurrencyINR(total)),
    stat("Oldest bill", g.oldest_age_days != null ? `${formatIntegerIN(g.oldest_age_days)} days` : ""),
    stat("Average age", g.weighted_avg_age_days != null ? `${formatIntegerIN(Math.round(Number(g.weighted_avg_age_days)))} days` : ""),
    stat("Parties", g.party_count != null ? formatIntegerIN(g.party_count) : ""),
    stat("Bills", g.bill_count != null ? formatIntegerIN(g.bill_count) : ""),
    hasUndated ? stat("Not aged (no usable date)", money(Number(g.undated_amount))) : "",
  ].join("");
  AGE_DETAIL.set(g.group || name, {
    name,
    html: `<ul class="fin-age-stats" aria-label="Ageing figures">${stats}</ul>
      <div class="fin-age-bar fin-age-bar-lg" role="img" aria-label="${barAria}">${bar}</div>
      ${table}${tableV}
      <p class="fin-age-meta">Average age is weighted by amount. Credit bands are shown in the table with their sign and are not drawn in the bar.</p>`,
  });
  return `<div class="fin-age-group" data-group="${escapeHtml(g.group || "")}">
    <button type="button" class="fin-age-row" data-act="age-detail" data-group="${escapeHtml(g.group || name)}" aria-haspopup="dialog" aria-label="Open ageing breakdown for ${escapeHtml(name)}">
      <span class="fin-age-name">${escapeHtml(name)}</span><b class="fin-age-total">${escapeHtml(formatCurrencyINR(total))}</b><span class="fin-age-go" aria-hidden="true">Breakdown <i></i></span>
      <span class="fin-age-bar" role="img" aria-label="${barAria}">${bar}</span>
    </button>
  </div>`;
}
let AGE_BRK = null; // { overlay, trigger }
function openAgeBreakdown(key) {
  const d = AGE_DETAIL.get(key);
  if (!d || AGE_BRK) return;
  const asOf = AGE.sum.data?.as_of || ageAsOf();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay fin-age-overlay fin-brk-overlay";
  overlay.innerHTML = `<div class="modal-window fin-age-dialog fin-brk-dialog" role="dialog" aria-modal="true" aria-labelledby="financeBrkTitle">
    <div class="modal-header"><div><h2 id="financeBrkTitle" class="finance-modal-title">${escapeHtml(d.name)}</h2><div class="finance-modal-subtitle">Ageing as of ${escapeHtml(formatDateIN(asOf))} · from bill date</div></div>
      <button type="button" class="modal-close-btn" data-act="brk-close" aria-label="Close ageing breakdown" title="Close">${ICON_X}</button></div>
    <div class="modal-content fin-brk-body">${d.html}</div></div>`;
  document.body.appendChild(overlay);
  AGE_BRK = { overlay, trigger: document.activeElement };
  setTimeout(() => { if (AGE_BRK) document.body.classList.add("ei-sheet-open"); }, 0);
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeAgeBreakdown(); });
  overlay.addEventListener("click", (ev) => { if (ev.target.closest('[data-act="brk-close"]')) closeAgeBreakdown(); });
  overlay.addEventListener("keydown", (ev) => { if (ev.key === "Tab") trapTab(overlay.querySelector(".fin-brk-dialog"), ev); });
  overlay.querySelector(".modal-close-btn")?.focus?.();
}
function closeAgeBreakdown({ restoreFocus = true } = {}) {
  if (!AGE_BRK) return;
  const { overlay, trigger } = AGE_BRK;
  AGE_BRK = null;
  overlay.remove();
  document.body.classList.remove("ei-sheet-open");
  if (restoreFocus && trigger && document.contains(trigger)) trigger.focus?.();
}
async function loadAgeingSummary() {
  if (!AGE.on && !financeClassActive()) return;
  const token = beginRequest("finance:age-sum");
  AGE.sum = { status: "loading", data: null, error: "", missing: false };
  renderFinanceAgeing();
  const { data, error } = await settle(supabase.rpc(AGE_RPC_SUMMARY, { ...(AGE.on ? ageArgs() : {}), ...financeClassArgs() }));
  if (!isLatestRequest("finance:age-sum", token) || (!AGE.on && !financeClassActive())) return;
  AGE.sum = error ? { status: "error", data: null, error: errorMessage(error), missing: ageMissing(error) } : { status: "ok", data: data || null, error: "", missing: false };
  renderFinanceAgeing();
}
function reloadFinanceAgeing() {
  closeAgeBreakdown({ restoreFocus: false });
  const L = LISTS.finance;
  L.st.rows = []; L.st.total = 0; L.st.done = false;
  renderListToolbar("finance");
  renderFinanceAgeing();
  loadAgeingSummary();
  loadList("finance");
}
function applyAgeingSettings() {
  const b = parseAgeBounds($("financeAgeBounds")?.value);
  const mn = parseAgeInt($("financeAgeMin")?.value), mx = parseAgeInt($("financeAgeMax")?.value);
  const asOf = $("financeAgeAsOf")?.value || "";
  const err = b.error || mn.error || mx.error || (mn.value !== null && mx.value !== null && mn.value > mx.value ? "The minimum age cannot be greater than the maximum age." : "") || (asOf && !Number.isFinite(Date.parse(asOf)) ? "Enter a valid as-of date." : "");
  if (err) { AGE.error = err; const e = $("financeAgeError"); if (e) e.textContent = err; return; }
  closeAgeingDialog({ restoreFocus: false });
  Object.assign(AGE, { on: true, open: false, error: "", bounds: b.bounds, min: mn.value, max: mx.value, asOf: asOf === String(SUMMARY_STATE.row?.financial_position_date || "").slice(0, 10) ? "" : asOf });
  reloadFinanceAgeing();
}
function resetAgeing() {
  closeAgeingDialog({ restoreFocus: false });
  const wasOn = AGE.on;
  Object.assign(AGE, { on: false, open: false, error: "", min: null, max: null, asOf: "", bounds: [30, 60, 90], sum: { status: "idle", data: null, error: "", missing: false } });
  beginRequest("finance:age-sum");
  if (wasOn) reloadFinanceAgeing(); else renderListToolbar("finance");
}
function ageTableHtml(rows) {
  const labels = ageLabels(AGE.bounds);
  const cell = (v) => (v === null || v === undefined || Number(v) === 0 ? `<td class="num fin-age-zero">–</td>` : `<td class="num">${escapeHtml(formatCurrencyINR(v))}</td>`);
  return `<table class="finance-table finance-age-table">
    <thead><tr>${th("Party")}${th("Group")}${th("Bills", true)}${labels.map((l, i) => `<th class="num ${ageBandClass(i, labels.length)}" data-band title="Outstanding aged ${escapeHtml(l)} days" scope="col">${escapeHtml(l)}</th>`).join("")}${th("Outstanding", true)}${th("Oldest (days)", true)}${th("Avg age (days)", true)}</tr></thead>
    <tbody>
      ${rows.map((row, index) => {
        const a = Array.isArray(row.bucket_amounts) && row.bucket_amounts.length === labels.length ? row.bucket_amounts : null;
        return `<tr data-party-index="${index}" tabindex="0" aria-haspopup="dialog" aria-label="View outstanding bills for ${escapeHtml(row.party_name || "party")}">
          <td>${escapeHtml(row.party_name || "-")}</td><td>${escapeHtml(row.mis_group_name || "-")}</td>
          <td class="num">${escapeHtml(formatIntegerIN(row.bill_count))}</td>
          ${a ? a.map(cell).join("") : labels.map(() => `<td class="num fin-age-zero" title="Bands returned do not match the bands asked for">n/a</td>`).join("")}
          <td class="num">${escapeHtml(formatCurrencyINR(row.outstanding_amount_mis_value))}</td>
          <td class="num">${row.oldest_age_days != null ? escapeHtml(formatIntegerIN(row.oldest_age_days)) : "–"}</td>
          <td class="num">${row.weighted_avg_age_days != null ? escapeHtml(formatIntegerIN(Math.round(Number(row.weighted_avg_age_days)))) : "–"}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>`;
}

const LISTS = {
  finance: {
    p: "finance", title: "Finance", noun: "parties", get rpc() { return AGE.on ? AGE_RPC_PAGE : "get_mis_finance_party_page"; }, wrapId: "financePartyTableWrap",
    shell: ".finance-table-shell", loadingMsg: "Loading finance parties...", retryKey: "finance",
    summaryTable: "v_mis_finance_tab_summary", summarySelect: "finance_scope_note", errorText: "Finance basis note could not be loaded.",
    placeholder: "Search party or group", st: newListState("payables"), sum: { status: "idle", data: null, error: "" },
    args: (st) => ({ p_group_filter: financeGroupScope(), p_search: st.search, p_limit: st.size, p_offset: st.offset, ...(AGE.on ? ageArgs() : {}), ...financeClassArgs() }),
    parse: finParse, summaryHtml: financeBasisHtml, key: (r) => `${r.party_name}|${r.mis_group_name}`,
    filterConfig: () => ({
      title: "Outstanding Group", ariaLabel: "Finance filters",
      options: [
        { value: "payables", label: "Payables — Sundry Creditors" },
        { value: "receivables", label: "Receivables — Sundry Debtors" },
        { value: "all", label: "All" },
      ],
    }),
    activeFilters: (st) => (st.filter === "all" ? 0 : 1) + Object.keys(financeClassArgs()).length, defaultFilter: "payables",
    emptyText: "No parties found for this scope.", loadErrText: "Failed to load finance parties.", loadingText: "Loading parties...",
  },
  sales: {
    p: "sales", title: "Sales Performance", noun: "products", rpc: "ei_sales_mtd_product_page", wrapId: "salesProductTableWrap",
    shell: ".sales-table-shell", loadingMsg: "Loading sales products...", retryKey: "sales",
    summaryTable: "v_ei_sales_mtd_summary", summarySelect: "*", errorText: "Sales summary could not be loaded.",
    host: () => $("salesView"), placeholder: "Search product", st: newListState(null), sum: { status: "idle", data: null, error: "" },
    args: (st) => ({ p_search: st.search, p_limit: st.size, p_offset: st.offset }),
    parse: arrParse, summaryHtml: salesSummaryHtml, key: (r) => String(r.product_id ?? r.product_name),
    emptyText: "No products found.", loadErrText: "Failed to load sales products.", loadingText: "Preparing sales table...",
  },
  inventory: {
    p: "inventory", title: "Materials Inventory", noun: "items", rpc: "get_mis_inventory_item_page", wrapId: "inventoryItemTableWrap",
    shell: ".inventory-table-shell", loadingMsg: "Loading inventory items...", retryKey: "inventory",
    summaryTable: "v_mis_inventory_tab_summary", summarySelect: "*", errorText: "Materials summary could not be loaded.",
    placeholder: "Search item, code, or classification", st: newListState("all"), sum: { status: "idle", data: null, error: "" },
    args: (st) => ({ p_source_kind: st.filter, p_search: st.search, p_limit: st.size, p_offset: st.offset }),
    parse: arrParse, summaryHtml: inventorySummaryHtml, filterConfig: inventoryFilterConfig, key: (r) => `${r.inv_stock_item_id ?? r.code ?? r.item_name}|${r.source_kind ?? ""}`,
    activeFilters: (st) => (st.filter === "all" ? 0 : 1), defaultFilter: "all",
    emptyText: "No items found.", loadErrText: "Failed to load inventory items.", loadingText: "Preparing inventory table...",
    // Called once the summary arrives: a non-canonical contract can never leave a category filter applied.
    onSummary(L) {
      const canon = L.sum.status === "ok" ? inventoryCanonicalAvailable(L.sum.data) : null;
      const safe = sanitizeInventoryFilter(L.st.filter, canon);
      if (safe !== L.st.filter) {
        L.st.filter = safe;
        L.st.page = 1;
        renderListToolbar("inventory");
        loadList("inventory");
      }
    },
  },
  fg: {
    p: "fg", title: "Finished Goods", noun: "SKUs", rpc: "get_mis_finished_goods_sku_page", wrapId: "fgSkuTableWrap",
    shell: ".fg-table-shell", loadingMsg: "Loading Finished Goods SKUs...", retryKey: "finished-goods",
    summaryTable: "v_mis_finished_goods_tab_summary", summarySelect: "*", errorText: "Finished goods summary could not be loaded.",
    placeholder: "Search SKU, item, or classification", st: newListState("all"), sum: { status: "idle", data: null, error: "" },
    args: (st) => ({ p_mos_filter: st.filter, p_search: st.search, p_limit: st.size, p_offset: st.offset }),
    parse: arrParse, summaryHtml: fgSummaryHtml, key: (r) => String(r.sku_id ?? `${r.item}|${r.pack_size}|${r.uom}`),
    filterConfig: () => ({
      title: "MOS Status", ariaLabel: "Finished Goods filters",
      options: [
        { value: "all", label: "All" },
        { value: "zero_stock", label: "Zero Stock" },
        { value: "below_1_month", label: "Below 1 Month" },
        { value: "one_to_three_months", label: "1 to 3 Months" },
        { value: "above_6_months", label: "Above 6 Months" },
        { value: "normal", label: "Normal" },
        { value: "shaded", label: "Same IK/OK MRP" },
      ],
    }),
    activeFilters: (st) => (st.filter === "all" ? 0 : 1), defaultFilter: "all",
    emptyText: "No SKUs found.", loadErrText: "Failed to load Finished Goods SKUs.", loadingText: "Preparing Finished Goods table...",
  },
};

// Canonical control glyphs: the shared ui-icons stroke grammar (filter / search / close). `sort` is not in the shared set, so it is drawn
// in the same grammar here (shared component untouched).
const GLYPH = (name, size = 16) => iconHtml(name, size);
const ICON_SORT = { value_desc: `<svg class="sasv-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16"/><path d="m3 16 4 4 4-4"/><path d="M14 6h7M14 12h5M14 18h3"/></svg>`, value_asc: `<svg class="sasv-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 20V4"/><path d="m3 8 4-4 4 4"/><path d="M14 6h3M14 12h5M14 18h7"/></svg>`, key: `<svg class="sasv-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M4 12h7M4 17h4"/><path d="m16 15 3 3 3-3"/><path d="M19 6v12"/></svg>` };
const ICON_X = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line></svg>`;
const ICON_FILTER_LEGACY = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`;

function listToolbarHtml(L) {
  const p = L.p;
  const st = L.st;
  const f = L.filterConfig ? L.filterConfig() : null;
  const active = L.activeFilters ? L.activeFilters(st) : 0;
  const filter = f
    ? `
      <div id="${p}FilterWrapper" class="${p}-filter-wrapper" data-list="${p}">
        <button id="${p}FilterBtn" type="button" class="${p}-filter-btn ${active ? `${p}-filter-btn--active` : ""}" title="Filters" aria-label="Filters" aria-haspopup="dialog" aria-expanded="false" aria-controls="${p}FilterDrawer" data-act="filter-toggle" data-list="${p}">
          ${GLYPH("filter")}
          <span class="${p}-filter-badge" style="${active ? "" : "display:none"}">${active || ""}</span>
        </button>
        <div id="${p}FilterDrawer" class="${p}-filter-drawer" role="dialog" aria-label="${escapeHtml(f.ariaLabel)}">
          <div class="ei-drawer-head"><span class="ei-drawer-title">${escapeHtml(f.title)}</span>
            <button type="button" class="ei-drawer-close" data-act="drawer-close" data-list="${p}" aria-label="Close filters" title="Close">${ICON_X}</button></div>
          <div class="${p}-filter-section-title">${escapeHtml(f.title)}</div>
          <ul class="${p}-filter-list">
            ${f.options.map((o) => `<li><label><input type="radio" name="${p}Filter" value="${escapeHtml(o.value)}" ${st.filter === o.value ? "checked" : ""} ${o.disabled ? "disabled" : ""} /> ${escapeHtml(o.label)}</label></li>`).join("")}
          </ul>
          ${p === "finance" ? `<div id="financeClassFields"></div><button class="ei-ctl" type="button" data-act="bill-export" data-list="finance">Export bills</button><p id="financeExportStatus" role="status"></p>` : ""}
          ${f.note ? `<div class="ei-drawer-note">${escapeHtml(f.note)}</div>` : ""}
        </div>
      </div>`
    : "";
  // Canonical order: filter, (sort where the contract has one), search. Lists page server-side in a fixed order, so no sort is offered.
  return `
    <div class="${p}-toolbar ei-toolbar">
      ${filter}
      <div class="${p}-search-wrap ei-searchbox">
        <span class="ei-search-icon" aria-hidden="true">${GLYPH("search", 14)}</span>
        <input id="${p}Search" type="text" value="${escapeHtml(st.search)}" placeholder="${escapeHtml(L.placeholder)}" aria-label="${escapeHtml(L.placeholder)}" />
        <button id="${p}SearchClear" type="button" class="input-clear-btn" title="Clear search" aria-label="Clear search" data-act="search-clear" data-list="${p}" style="${st.search ? "" : "display:none"}">${ICON_X}</button>
      </div>
      ${p === "finance" ? ageingControlsHtml() : ""}
    </div>
    ${p === "finance" ? ageingPanelHtml() : ""}`;
}

function renderListToolbar(p) {
  const host = $(`${p}Toolbar`);
  if (host && !filterDrawerOf(p).drawer?.classList.contains("open")) host.innerHTML = listToolbarHtml(LISTS[p]);
}

function renderListSummary(p) {
  const L = LISTS[p];
  const el = $(`${p}ScopeNote`);
  if (el) el.innerHTML = L.summaryHtml(L);
}

function renderListShell(p) {
  const L = LISTS[p];
  const host = L.host ? L.host() : tabPanel;
  if (!host) return;
  host.innerHTML = `
    <div class="ei-lens ei-lens-${p}">
      ${L.host ? "" : lensHeadHtml(L.title)}
      ${p === "finance" ? `<div class="ei-kyc-launch"><button id="openDebtorKyc" type="button" class="ei-ctl" data-act="open-kyc">Debtor KYC</button></div><div id="financeMetrics" class="ei-metrics-host"></div><div id="financeAgeing" class="fin-ageing-host"></div>` : ""}
      <div id="${p}ScopeNote" class="${p}-scope-note ei-scope"></div>
      <div id="${p}Toolbar"></div>
      <div class="${p}-table-shell">
        <div id="${L.wrapId}" class="${p}-table-wrap"></div>
      </div>
    </div>`;
  if (p === "finance") { renderFinanceMetrics(); renderFinanceAgeing(); if ((AGE.on || financeClassActive()) && AGE.sum.status === "idle") loadAgeingSummary(); }
  renderListSummary(p);
  renderListToolbar(p);
  renderListTable(p);
}

async function loadListTab(p) {
  if (!tabPanel) return;
  if (p !== "sales" && !ACCESS.executive) return; // finance / materials / finished goods are executive-only lenses
  const L = LISTS[p];
  L.st.rows = [];
  L.st.total = 0;
  L.st.loading = true;
  L.st.error = "";
  L.sum = { status: "loading", data: null, error: "" };
  renderListShell(p);
  await Promise.all([loadListSummary(p), loadList(p)]);
}

async function loadListSummary(p) {
  const L = LISTS[p];
  const token = beginRequest(`${p}:summary`);
  const r = await settle(supabase.from(L.summaryTable).select(L.summarySelect).single());
  if (!isLatestRequest(`${p}:summary`, token)) return;
  if (r.error) {
    console.error(`[MIS] ${L.title} summary load failed`, r.error);
    L.sum = { status: "error", data: null, error: errorMessage(r.error) };
  } else {
    L.sum = { status: "ok", data: r.data || null, error: "" };
  }
  renderListSummary(p);
  renderToolbarUnlessTyping(`${p}Search`, () => renderListToolbar(p));
  L.onSummary?.(L);
}

// Incremental retrieval over the installed offset/limit contract (deterministic server ORDER BY, total in every row). One request in
// flight per list; a reset (filter, search, lens change) advances the same latest-wins token so an older chunk is ignored.
async function loadList(p, { append = false, retry = false } = {}) {
  const L = LISTS[p];
  const st = L.st;
  const key = `${p}:page`;
  if (append) {
    if (st.loading || st.more.loading || st.done || (st.more.error && !retry)) return;
    st.more = { loading: true, error: "" };
    st.offset = st.rows.length;
  } else {
    st.offset = 0;
    st.done = false;
    st.more = { loading: false, error: "" };
    st.loading = true;
    st.error = "";
  }
  const token = beginRequest(key);
  if (append) renderListTable(p);
  else {
    if (!st.rows.length) renderListTable(p);
    setTableLoading(L.shell, true, L.loadingMsg);
  }

  const { data, error } = await settle(supabase.rpc(L.rpc, L.args(st)));
  if (!isLatestRequest(key, token)) return; // a newer query owns the state

  if (!append) { setTableLoading(L.shell, false); st.loading = false; }
  if (error) {
    console.error(`[MIS] ${L.title} page load failed`, error);
    if (append) {
      st.more = { loading: false, error: errorMessage(error) }; // earlier rows stay; Retry asks for the same chunk again
    } else {
      st.rows = [];
      st.total = 0;
      st.error = p === "finance" && AGE.on && ageMissing(error) ? AGE_MISSING_TEXT : errorMessage(error);
      ACTIVE_TAB_FAILED = true;
    }
    renderListTable(p);
    return;
  }
  const parsed = L.parse(data);
  const merged = append ? mergeRows(st.rows, parsed.rows, L.key) : { rows: parsed.rows, added: parsed.rows.length };
  if (!append) st.resetScroll = !(p === "finance" && financeScrollOnLoad); // a new query starts at the top; only appends and detail returns keep the position
  st.rows = merged.rows;
  st.total = parsed.total;
  st.more = { loading: false, error: "" };
  st.done = listIsDone({ held: st.rows.length, total: parsed.total, chunk: parsed.rows.length, size: st.size, added: merged.added });
  if (!append) renderToolbarUnlessTyping(`${p}Search`, () => renderListToolbar(p));
  renderListTable(p);
}

let PENDING_FOCUS_ID = "";
function restorePendingFocus() {
  if (!PENDING_FOCUS_ID) return;
  const el = $(PENDING_FOCUS_ID);
  PENDING_FOCUS_ID = "";
  el?.focus?.();
}

function setListFilter(p, value) {
  const L = LISTS[p];
  const canon = p === "inventory" && L.sum.status === "ok" ? inventoryCanonicalAvailable(L.sum.data) : null;
  L.st.filter = p === "inventory" ? sanitizeInventoryFilter(value, canon) : value || L.defaultFilter;
  L.st.page = 1;
  if (p === "finance" && value !== "receivables") {
    financeClass = { partition: "all" };
    if (!AGE.on) beginRequest("finance:age-sum");
  }
  closeAllFilterDrawers();
  renderListToolbar(p);
  if (p === "finance") { renderFinanceAgeing(); if (AGE.on) loadAgeingSummary(); }
  PENDING_FOCUS_ID = `${p}FilterBtn`;
  restorePendingFocus();
  loadList(p);
}

function setListSearch(p, value) {
  const next = String(value || "").trim();
  const L = LISTS[p];
  if (next === L.st.search) return;
  L.st.search = next;
  L.st.page = 1;
  loadList(p);
}

function clearListSearch(p) {
  const L = LISTS[p];
  L.st.search = "";
  L.st.page = 1;
  renderListToolbar(p);
  $(`${p}Search`)?.focus?.();
  loadList(p);
}

// ---- tables -------------------------------------------------------------------------------------------------------
const th = (label, num, title) => `<th${num ? ' class="num"' : ""}${title ? ` title="${escapeHtml(title)}"` : ""} scope="col">${escapeHtml(label)}</th>`;

function renderListTable(p) {
  const L = LISTS[p];
  const wrap = $(L.wrapId);
  if (!wrap) return;
  if (!L.st.rows.length) {
    disposeMore(p);
    wrap.innerHTML = renderTableState(p, {
      loading: L.st.loading, error: L.st.error, loadingText: L.loadingText,
      emptyText: L.st.search ? `No ${L.noun} match "${L.st.search}".` : L.emptyText,
      errorText: L.loadErrText, retryKey: L.retryKey,
    });
    return;
  }
  const top = L.st.resetScroll ? 0 : wrap.scrollTop; // appends and detail returns never jump the scroll position
  L.st.resetScroll = false;
  wrap.innerHTML = TABLES[p](L.st.rows);
  if (p === "finance") bindFinanceRows(wrap);
  applyRecordCards(wrap);
  wrap.insertAdjacentHTML("beforeend", moreHtml(p, { ...L.st.more, done: L.st.done }));
  wrap.scrollTop = top;
  if (p === "finance" && financeScrollOnLoad) {
    tabPanel.scrollTop = financeScrollOnLoad.top;
    wrap.scrollTop = financeScrollOnLoad.listTop;
    financeScrollOnLoad = null;
  }
  armMore(wrap, p, () => loadList(p, { append: true }));
}

function bindFinanceRows(wrap) {
  const rows = LISTS.finance.st.rows;
  wrap.querySelectorAll("tbody tr").forEach((tr) => {
    const open = () => {
      const row = rows[Number(tr.getAttribute("data-party-index"))];
      if (row) openFinancePartyDetails(row);
    };
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open();
      }
    });
  });
}

function formatMosStatusLabel(value) {
  switch (value) {
    case "ZERO_STOCK": return "Zero Stock";
    case "BELOW_1_MONTH": return "Below 1 Month";
    case "ONE_TO_THREE_MONTHS": return "1 to 3 Months";
    case "ABOVE_6_MONTHS": return "Above 6 Months";
    case "NORMAL": return "Normal";
    default: return value || "-";
  }
}

function formatInventoryClassification(row) {
  return [row.subcategory_label, row.group_label, row.subgroup_label]
    .filter((value) => value != null && String(value).trim() !== "")
    .join(" › ");
}

const TABLES = {
  finance: (rows) => AGE.on ? ageTableHtml(rows) : `
    <table class="finance-table">
      <thead><tr>${th("Party")}${th("Group")}${th("Bills", true)}${th("Outstanding", true)}${th("Signed Balance", true)}</tr></thead>
      <tbody>
        ${rows.map((row, index) => `
          <tr data-party-index="${index}" tabindex="0" aria-haspopup="dialog" aria-label="View outstanding bills for ${escapeHtml(row.party_name || "party")}">
            <td>${escapeHtml(row.party_name || "-")}</td>
            <td>${escapeHtml(row.mis_group_name || "-")}</td>
            <td class="num">${escapeHtml(formatIntegerIN(row.bill_count))}</td>
            <td class="num">${escapeHtml(formatCurrencyINR(row.outstanding_amount_mis_value))}</td>
            <td class="num">${escapeHtml(formatCurrencyINR(row.signed_outstanding_tally_value))}</td>
          </tr>`).join("")}
      </tbody>
    </table>`,
  sales: (rows) => `
    <table class="sales-table">
      <thead><tr>${th("Product")}${th("SKUs", true)}${th("MTD billed sales", true)}${th("MTD actual units", true)}${th("MTD billed units", true)}${th("Latest day sales", true)}${th("Latest day units", true)}${th("Avg per product sales day", true, "Month-to-date billed sales divided by the days this product had sales")}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.product_name || "-")}</td>
            <td class="num">${escapeHtml(formatIntegerIN(row.sku_count))}</td>
            <td class="num">${escapeHtml(orWord(row.sales_value, formatCurrencyINR, "Not reported"))}</td>
            <td class="num">${escapeHtml(orWord(row.sales_units, formatNumberIN, "Not reported"))}</td>
            <td class="num">${escapeHtml(orWord(row.billed_units, formatNumberIN, "Not reported"))}</td>
            <td class="num">${escapeHtml(orWord(row.latest_day_sales_value, formatCurrencyINR, "No sales"))}</td>
            <td class="num">${escapeHtml(orWord(row.latest_day_sales_units, formatNumberIN, "No sales"))}</td>
            <td class="num">${escapeHtml(orWord(row.average_daily_sales_value, formatCurrencyINR, "Not reported"))}</td>
          </tr>`).join("")}
      </tbody>
    </table>`,
  inventory: (rows) => `
    <table class="inventory-table" data-card-title="1">
      <thead><tr>${th("Code")}${th("Item")}${th("Category")}${th("Quantity", true)}${th("Average rate", true)}${th("Stock value", true, "Quantity x average rate; unavailable when the quantity is unknown or the rate is missing or not positive")}${th("Source")}</tr></thead>
      <tbody>
        ${rows.map((row) => {
          const sub = formatInventoryClassification(row);
          return `
          <tr>
            <td>${escapeHtml(row.code || "-")}</td>
            <td>${escapeHtml(row.item_name || "-")}${sub ? `<div class="ei-cell-sub">${escapeHtml(sub)}</div>` : ""}</td>
            <td>${escapeHtml(row.category_label || "Unclassified")}</td>
            <td class="num">${escapeHtml(orWord(row.qty_value, formatNumberIN))}</td>
            <td class="num">${escapeHtml(orWord(row.avg_rate_value, formatCurrencyINR, "No rate"))}</td>
            <td class="num">${escapeHtml(orWord(row.stock_value, formatCurrencyINR))}</td>
            <td><span class="ei-evidence">${escapeHtml(row.source_label || "-")}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`,
  fg: (rows) => `
    <table class="fg-table">
      <thead><tr>${th("Item")}${th("Pack")}${th("Stock", true)}${th("Forecast", true)}${th("MOS", true)}${th("Stock Value", true)}${th("Status")}${th("Classification")}</tr></thead>
      <tbody>
        ${rows.map((row) => {
          const pack = [row.pack_size, row.uom].filter((v) => v != null && String(v).trim() !== "").join(" ");
          return `
          <tr>
            <td>${escapeHtml(row.item || "-")}</td>
            <td>${escapeHtml(pack || "-")}</td>
            <td class="num">${escapeHtml(formatNumberIN(row.stock_overall))}</td>
            <td class="num">${escapeHtml(formatNumberIN(row.forecast_overall))}</td>
            <td class="num">${escapeHtml(formatNumberIN(row.mos_overall))}</td>
            <td class="num">${escapeHtml(formatCurrencyINR(row.stock_value_overall))}</td>
            <td>${escapeHtml(formatMosStatusLabel(row.mos_status))}</td>
            <td>${escapeHtml(row.classification || "-")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`,
};

const loadFinanceTab = () => loadListTab("finance");
const loadInventoryTab = () => loadListTab("inventory");
const loadFinishedGoodsTab = () => loadListTab("fg");

// ---------------------------------------------------------------------------
// Sales Performance (R3). Capability-gated read-only analytics over the frozen ei_sales_* contracts. Every slot is its own
// latest-wins request (keys sales:*), invalidated on a lens switch, so a late response can never repaint another view/lens.
// Field names are the SQL result keys; the browser never aggregates, infers coverage or substitutes reported for certified.
// ---------------------------------------------------------------------------
const SALES_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "mtd", label: "Month to date" },
  { id: "history", label: "History" },
  { id: "exceptions", label: "Exceptions" },
  { id: "facility", label: "Facility reconciliation" },
  { id: "coverage", label: "Coverage & refresh" },
];
const salesViews = () => SALES_VIEWS.filter((v) => !v.executiveOnly || ACCESS.executive);
const idleRes = () => ({ status: "idle", data: null, message: "" });
const freshSalesResults = () => ({ dims: idleRes(), cmp: idleRes(), win: idleRes(), hist: idleRes(), exc: idleRes(), cov: idleRes(), refresh: idleRes(), fac: idleRes() });
const SX = {
  loadedAt: null, sortOpen: false, view: "overview", anchor: "", region: "", godown: "", activeOnly: false, notice: "", hier: emptyHierarchy(), filtersOpen: false, facMonths: 1,
  hist: { group: "month", months: 12, sort: "value_desc", search: "", page: 1, size: 50, product: "", sku: "", grid: false },
  exc: { search: "", page: 1, size: 50 },
  res: freshSalesResults(),
  more: { hist: { loading: false, error: "", done: false }, exc: { loading: false, error: "", done: false } },
};
const SX_KEYS = { dims: "sales:dims", cmp: "sales:cmp", win: "sales:win", hist: "sales:hist", exc: "sales:exc", cov: "sales:cov", refresh: "sales:refresh", fac: "sales:fac" };
const intOrNull = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

function salesCommonArgs() {
  return { p_anchor: SX.anchor || null, p_region: intOrNull(SX.region), p_godown: intOrNull(SX.godown) };
}
// Hierarchy ids (p_category, p_subcategory, p_group_id, p_subgroup). NOT the history `p_group` grouping choice.
const hierArgs = () => hierarchyArgs(SX.hier);
// Exact parameter lists of the INSTALLED contracts (migration 20261126102211_executive_intelligence_r3_r4_reporting_parity.sql, final
// signatures); nothing else is sent. Comparison, window totals, history and exceptions accept the four hierarchy ids; coverage,
// refresh status and dimensions take none; the facility contract takes only anchor and months.
const SX_CALLS = {
  dims: () => ["ei_sales_dimensions", {}],
  cmp: () => ["ei_sales_comparison", { ...salesCommonArgs(), p_product: intOrNull(SX.hist.product), p_sku: intOrNull(SX.hist.sku), p_active_only: SX.activeOnly, ...hierArgs() }],
  win: () => ["ei_sales_window_totals", { ...salesCommonArgs(), p_product: intOrNull(SX.hist.product), p_sku: intOrNull(SX.hist.sku), p_active_only: SX.activeOnly, ...hierArgs() }],
  hist: () => ["ei_sales_history", {
    ...salesCommonArgs(), p_months: SX.hist.months, p_group: SX.hist.group, p_product: intOrNull(SX.hist.product), p_sku: intOrNull(SX.hist.sku),
    p_active_only: SX.activeOnly, p_search: SX.hist.search || null, p_sort: SX.hist.sort, p_limit: SX.hist.size, p_offset: 0, ...hierArgs(),
  }],
  exc: () => ["ei_sales_exceptions", { ...salesCommonArgs(), p_search: SX.exc.search || null, p_limit: SX.exc.size, p_offset: 0, ...hierArgs() }],
  cov: () => ["ei_sales_coverage", { p_anchor: SX.anchor || null }],
  refresh: () => ["ei_sales_refresh_status", {}],
  fac: () => ["ei_facility_sales_scope", { p_anchor: SX.anchor || null, p_months: SX.facMonths }],
};

async function sxFetch(slot) {
  const key = SX_KEYS[slot];
  const token = beginRequest(key);
  if (SX.more[slot]) SX.more[slot] = { loading: false, error: "", done: false }; // a reset advances the same token: an older chunk is ignored
  SX.res[slot] = { status: "loading", data: null, message: "" };
  renderSalesResults(slot);
  const [rpc, args] = SX_CALLS[slot]();
  const { data, error } = await settle(supabase.rpc(rpc, args));
  if (!isLatestRequest(key, token)) return;
  if (error) {
    const status = classifyApiError(error);
    if (status !== "unavailable") console.error(`[MIS] ${rpc} failed`, error);
    SX.res[slot] = { status, data: null, message: errorMessage(error) };
    if (status === "error") ACTIVE_TAB_FAILED = true;
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    SX.res[slot] = { status: "ok", data, message: "" };
    SX.loadedAt = new Date();
  } else {
    SX.res[slot] = { status: "error", data: null, message: "The server returned an unexpected response." };
  }
  renderSalesResults(slot);
  updateFreshnessIndicator();
  if (slot === "dims") {
    // A remembered hierarchy choice the server no longer lists is dropped; anything already loaded with it is reloaded.
    const r = SX.res.dims.status === "ok" ? reconcileHierarchy(SX.res.dims.data, SX.hier) : { sel: SX.hier, cleared: [] };
    if (r.cleared.length) {
      SX.hier = r.sel; SX.hist.page = 1; SX.exc.page = 1;
      SX.notice = `${r.cleared.map((k) => HIERARCHY_LEVELS.find((l) => l.key === k).label).join(", ")} filter cleared because it is no longer a valid choice.`;
      sxInvalidateFilterDependents();
      renderSalesFilters();
      return sxEnsureView();
    }
    renderSalesFilters();
  }
}

const SX_ROW_KEY = { hist: (r) => `${r.dimension_id}|${r.month ?? ""}`, exc: (r) => String(r.sku_id) };
// Done for the first chunk is derived from what the server reported; later chunks record it explicitly.
function sxMoreState(slot) {
  const m = SX.more[slot];
  const d = SX.res[slot].data;
  const held = d?.rows?.length || 0;
  const size = slot === "hist" ? SX.hist.size : SX.exc.size;
  return { ...m, done: m.done || (!m.loading && (held < size || (hasValue(d?.total) && held >= Number(d.total)))) };
}
async function sxLoadMore(slot, { retry = false } = {}) {
  const res = SX.res[slot];
  const m = SX.more[slot];
  if (!m || res.status !== "ok" || !Array.isArray(res.data?.rows) || m.loading || sxMoreState(slot).done || (m.error && !retry)) return;
  const key = SX_KEYS[slot];
  const token = beginRequest(key);
  SX.more[slot] = { loading: true, error: "", done: false };
  renderSalesResults(slot);
  const [rpc, args] = SX_CALLS[slot]();
  args.p_offset = res.data.rows.length;
  const { data, error } = await settle(supabase.rpc(rpc, args));
  if (!isLatestRequest(key, token)) return; // filters, search, sort or lens changed meanwhile
  if (error || !data || !Array.isArray(data.rows)) {
    SX.more[slot] = { loading: false, error: error ? errorMessage(error) : "The server returned an unexpected response.", done: false };
  } else {
    const merged = mergeRows(res.data.rows, data.rows, SX_ROW_KEY[slot]);
    res.data = { ...res.data, rows: merged.rows, total: data.total };
    const size = slot === "hist" ? SX.hist.size : SX.exc.size;
    SX.more[slot] = { loading: false, error: "", done: listIsDone({ held: merged.rows.length, total: data.total, chunk: data.rows.length, size, added: merged.added }) };
    SX.loadedAt = new Date();
  }
  renderSalesResults(slot);
}

const SX_SLOTS_FOR_VIEW = { overview: ["cmp", "win"], history: ["hist"], exceptions: ["exc"], facility: ["fac"], coverage: ["cov", "refresh"], mtd: [] };

function sxEnsureView() {
  if (SX.view === "mtd") return loadListTab("sales");
  return Promise.all(SX_SLOTS_FOR_VIEW[SX.view].filter((s) => SX.res[s].status === "idle").map((s) => sxFetch(s)));
}

function sxInvalidateFilterDependents() {
  ["cmp", "win", "hist", "exc", "cov", "fac"].forEach((s) => { SX.res[s] = idleRes(); beginRequest(SX_KEYS[s]); });
}

function loadSalesLens() {
  if (!tabPanel) return Promise.resolve();
  SX.res = freshSalesResults();
  if (!salesViews().some((v) => v.id === SX.view)) SX.view = "overview";
  renderSalesShell();
  return Promise.all([sxFetch("dims"), sxEnsureView()]);
}

function renderSalesShell() {
  tabPanel.innerHTML = `
    <div class="ei-lens ei-lens-sales">
      ${lensHeadHtml("Sales Performance")}
      <div class="ei-subnav" role="tablist" aria-label="Sales views">
        ${salesViews().map((v) => `<button type="button" role="tab" class="ei-subtab ${v.id === SX.view ? "active" : ""}" data-sales-view="${v.id}" aria-selected="${v.id === SX.view}" tabindex="${v.id === SX.view ? "0" : "-1"}">${escapeHtml(v.label)}</button>`).join("")}
      </div>
      <div class="ei-toolbar ei-toolbar-sales" id="salesCtlBar"><div id="salesFilters" class="ei-filters"></div><div id="salesToolExtra" class="ei-toolextra"></div></div>
      <div id="salesNotice" class="ei-notice-host"></div>
      <div id="salesView" class="ei-view"></div>
    </div>`;
  renderSalesFilters();
  renderSalesViewShell();
}

const SX_FILTERS = {
  overview: ["anchor", "region", "godown", "hier", "active"], history: ["anchor", "region", "godown", "hier", "active"], exceptions: ["anchor", "region", "godown", "hier"],
  facility: ["anchor", "facmonths"], coverage: ["anchor"], mtd: [],
};
const isPhoneFilters = () => !!window.matchMedia?.("(max-width: 640px)").matches;
const activeSalesFilterCount = () => (SX.anchor ? 1 : 0) + (SX.region ? 1 : 0) + (SX.godown ? 1 : 0) + (SX.activeOnly ? 1 : 0) + hierarchyActive(SX.hier);

function renderSalesFilters() {
  const host = $("salesFilters");
  if (!host) return;
  const show = SX_FILTERS[SX.view] || [];
  const noticeHost = $("salesNotice");
  host.hidden = !show.length;
  if (!show.length) { host.innerHTML = ""; host.classList.remove("is-open"); if (noticeHost) noticeHost.innerHTML = ""; return; }
  const dims = SX.res.dims;
  const ok = dims.status === "ok";
  const d = ok ? dims.data : {};
  const regions = Array.isArray(d.regions) ? d.regions : [];
  const godowns = (Array.isArray(d.godowns) ? d.godowns : []).filter((g) => !SX.region || String(g.region_id) === String(SX.region));
  const opts = (rows, current, all) => `<option value="">${escapeHtml(all)}</option>${rows.map((r) => `<option value="${escapeHtml(r.id)}"${String(r.id) === String(current) ? " selected" : ""}>${escapeHtml(r.name || r.code)}</option>`).join("")}`;
  const dis = ok ? "" : " disabled";
  const hierSelect = (l) => {
    const rows = ok ? hierarchyOptions(d, SX.hier, l.key) : [];
    return `<label class="ei-field"><span>${escapeHtml(l.label)}</span><select id="salesHier-${l.key}"${dis}>${opts(rows, SX.hier[l.key], ok ? l.all : "Unavailable")}</select></label>`;
  };
  const n = activeSalesFilterCount();
  const open = !!SX.filtersOpen;
  host.classList.toggle("is-open", open);
  host.innerHTML = `
    <button type="button" class="ei-ctl ei-ctl-filter${n ? " is-active" : ""}" id="salesFilterToggle" title="Filters${n ? ` (${n} active)` : ""}" aria-label="Filters${n ? `, ${n} active` : ""}" aria-haspopup="dialog" aria-expanded="${open}" aria-controls="salesFilterFields">${GLYPH("filter")}${n ? `<span class="ei-ctl-badge" aria-hidden="true">${n}</span>` : ""}</button>
    <div id="salesFilterFields" class="ei-filter-fields ei-pop" role="dialog" aria-label="Sales filters">
      <div class="ei-filter-sheet-head"><strong>Filters</strong><button type="button" class="ei-ctl ei-ctl-close" id="salesFilterClose" aria-label="Close filters" title="Close">${ICON_X}</button></div>
      ${show.includes("anchor") ? `<label class="ei-field"><span>As of</span><input type="date" id="salesAnchor" value="${escapeHtml(SX.anchor)}"${ok && d.first_mapped_date ? ` min="${escapeHtml(d.first_mapped_date)}"` : ""}${ok && d.last_mapped_date ? ` max="${escapeHtml(d.last_mapped_date)}"` : ""} aria-label="As-of date (latest mapped day when empty)" /></label>` : ""}
      ${show.includes("facmonths") ? `<label class="ei-field"><span>Months</span><select id="salesFacMonths">${Array.from({ length: 12 }, (_, i) => i + 1).map((m) => `<option value="${m}"${m === SX.facMonths ? " selected" : ""}>${m}</option>`).join("")}</select></label>` : ""}
      ${show.includes("region") ? `<label class="ei-field"><span>Region</span><select id="salesRegion"${dis}>${opts(regions, SX.region, ok ? "All regions" : "Unavailable")}</select></label>` : ""}
      ${show.includes("godown") ? `<label class="ei-field"><span>Godown</span><select id="salesGodown"${dis}>${opts(godowns, SX.godown, ok ? "All godowns" : "Unavailable")}</select></label>` : ""}
      ${show.includes("hier") ? HIERARCHY_LEVELS.map(hierSelect).join("") : ""}
      ${show.includes("active") ? `<label class="ei-check"><input type="checkbox" id="salesActive"${SX.activeOnly ? " checked" : ""} /> Active SKUs only <span class="ei-asof">(current master)</span></label>` : ""}
      <div class="ei-filter-foot"><button type="button" class="mis-retry-btn" id="salesFilterReset">Reset</button><button type="button" class="mis-retry-btn ei-primary" id="salesFilterDone">Done</button></div>
    </div>`;
  if (noticeHost) noticeHost.innerHTML = `
    ${SX.notice ? `<div class="ei-filter-note" role="status">${escapeHtml(SX.notice)}</div>` : ""}
    ${!ok && dims.status !== "idle" && dims.status !== "loading" ? `<div class="ei-filter-note" role="status">Region, godown, hierarchy and date bounds are unavailable (${escapeHtml(dims.status === "unavailable" ? "contract not installed yet" : dims.message || dims.status)}); views run unfiltered.</div>` : ""}
    ${SX.hist.product || SX.hist.sku ? `<div class="ei-filter-note">Filtered to ${SX.hist.product ? `product ${escapeHtml(SX.hist.product)}` : ""}${SX.hist.sku ? ` SKU ${escapeHtml(SX.hist.sku)}` : ""} <button type="button" class="mis-retry-btn" data-sales-clear-item>Clear</button></div>` : ""}`;
}

// Filter popover (desktop, bounded under its button) / full-page sheet (phone). Escape, Done, outside click and the close glyph close it
// and focus returns to the toggle.
function setSalesFiltersOpen(open, { restoreFocus = false } = {}) {
  SX.filtersOpen = !!open;
  if (open) SX.sortOpen = false;
  const host = $("salesFilters");
  if (!host) return;
  host.classList.toggle("is-open", SX.filtersOpen);
  $("salesFilterToggle")?.setAttribute("aria-expanded", String(SX.filtersOpen));
  document.body.classList.toggle("ei-sheet-lock", SX.filtersOpen && isPhoneFilters());
  if (SX.filtersOpen) { renderSalesSort(); $("salesFilterFields")?.querySelector("select,input")?.focus?.(); }
  else if (restoreFocus) $("salesFilterToggle")?.focus?.();
}

// ---- canonical sort control (history only: the only contract with a server sort) -------------------------------------------------------
function renderSalesSort() {
  const host = $("salesSortHost");
  if (!host) return;
  const h = SX.hist;
  const cur = HISTORY_SORTS.find((o) => o.value === h.sort) || HISTORY_SORTS[0];
  const dir = h.sort === "value_desc" ? "highest first" : h.sort === "value_asc" ? "lowest first" : "by name / month";
  host.classList.toggle("is-open", !!SX.sortOpen);
  host.innerHTML = `
    <button type="button" class="ei-ctl ei-ctl-sort" id="salesSortBtn" title="Sort: ${escapeHtml(cur.label)}" aria-label="Sort, currently ${escapeHtml(cur.label)} (${dir})" aria-haspopup="dialog" aria-expanded="${!!SX.sortOpen}" aria-controls="salesSortPanel" data-sort-state="${escapeHtml(h.sort)}">${ICON_SORT[h.sort] || ICON_SORT.key}<span class="ei-ctl-text">${escapeHtml(cur.label)}</span></button>
    <div id="salesSortPanel" class="ei-sort-panel ei-pop" role="dialog" aria-label="Sort history">
      <div class="ei-filter-sheet-head"><strong>Sort</strong><button type="button" class="ei-ctl ei-ctl-close" id="salesSortClose" aria-label="Close sort" title="Close">${ICON_X}</button></div>
      <ul class="ei-sort-list">${HISTORY_SORTS.map((o) => `<li><label><input type="radio" name="salesSort" value="${o.value}"${o.value === h.sort ? " checked" : ""} /> ${ICON_SORT[o.value] || ICON_SORT.key}<span>${escapeHtml(o.label)}</span></label></li>`).join("")}</ul>
    </div>`;
}
function setSalesSortOpen(open, { restoreFocus = false } = {}) {
  SX.sortOpen = !!open;
  if (open && SX.filtersOpen) setSalesFiltersOpen(false);
  renderSalesSort();
  document.body.classList.toggle("ei-sheet-lock", SX.sortOpen && isPhoneFilters());
  if (SX.sortOpen) $("salesSortPanel")?.querySelector("input:checked,input")?.focus?.();
  else if (restoreFocus) $("salesSortBtn")?.focus?.();
}
function renderSalesToolExtra() {
  const host = $("salesToolExtra");
  if (!host) return;
  if (SX.view === "history") {
    host.innerHTML = `<div id="salesSortHost" class="ei-sorthost"></div>${searchboxHtml("salesHistSearch", SX.hist.search, "Search name or id", "Search history by name or id")}`;
    renderSalesSort();
  } else if (SX.view === "exceptions") host.innerHTML = searchboxHtml("salesExcSearch", SX.exc.search, "Search product or SKU id", "Search exceptions by product or SKU id");
  else host.innerHTML = "";
}
const searchboxHtml = (id, value, placeholder, label) => `<div class="ei-searchbox"><span class="ei-search-icon" aria-hidden="true">${GLYPH("search", 14)}</span><input id="${id}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(label)}" /></div>`;

function renderSalesViewShell() {
  const host = $("salesView");
  if (!host) return;
  renderSalesToolExtra();
  if (SX.view === "overview") host.innerHTML = `<div id="salesCmp"></div><div id="salesWin"></div>`;
  else if (SX.view === "history") host.innerHTML = `<div id="salesHistControls">${historyControlsHtml()}</div><div id="salesHistResults"></div>`;
  else if (SX.view === "exceptions") host.innerHTML = `<div id="salesExcControls">${exceptionControlsHtml()}</div><div id="salesExcResults"></div>`;
  else if (SX.view === "facility") host.innerHTML = `<div id="salesFac"></div>`;
  else if (SX.view === "coverage") host.innerHTML = `<div id="salesRefresh"></div><div id="salesCov"></div>`;
  else if (SX.view === "mtd") { host.innerHTML = ""; return; }
  SX_SLOTS_FOR_VIEW[SX.view].forEach((s) => renderSalesResults(s));
}

function selectSalesView(id) {
  if (!salesViews().some((v) => v.id === id) || id === SX.view) return;
  SX.view = id;
  SX.filtersOpen = false; SX.sortOpen = false;
  document.body.classList.remove("ei-sheet-lock");
  cancelPendingSearches();
  tabPanel.querySelectorAll("[data-sales-view]").forEach((b) => {
    const on = b.getAttribute("data-sales-view") === id;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
    b.setAttribute("tabindex", on ? "0" : "-1");
  });
  renderSalesFilters();
  renderSalesViewShell();
  sxEnsureView();
}

// ---- result states -------------------------------------------------------------------------------------------------
function sxState(res, what, slot) {
  if (res.status === "idle" || res.status === "loading") return `<div class="ei-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading ${escapeHtml(what)}...</div>`;
  if (res.status === "ok") return "";
  const text = {
    unavailable: `${what} is not available on this server yet: the Executive Intelligence sales contract is not installed. Nothing is estimated in its place.`,
    denied: `Your account does not have access to ${what}.`,
    expired: "Your session has expired or could not be verified. Sign in again, then retry.",
    invalid: `The server rejected these filters: ${res.message}`,
    error: `${what} could not be loaded. ${res.message}`,
  }[res.status];
  const retry = res.status === "denied" || res.status === "unavailable" ? "" : ` <button type="button" class="mis-retry-btn" data-sales-retry="${slot}">Retry</button>`;
  return `<div class="ei-state ${res.status === "unavailable" ? "ei-state-unavailable" : "error"}" role="${res.status === "unavailable" ? "status" : "alert"}">${escapeHtml(text)}${retry}</div>`;
}

const money = (v, word = "Unavailable") => orWord(v, formatCurrencyINR, word);
const qty = (v, word = "Unavailable") => orWord(v, formatNumberIN, word);
const pct = (v) => (hasValue(v) ? `${Number(v) > 0 ? "+" : ""}${formatNumberIN(v)}%` : "Not available");
const periodLabel = { CURRENT: "Current", PREVIOUS_MONTH: "Previous month", PREVIOUS_YEAR: "Previous year" };
const dateRange = (a, b) => (a && b ? `${formatDateIN(a)} to ${formatDateIN(b)}` : "-");
const covText = (c) => labelOf(COVERAGE_LABELS, c);

function comparisonHtml(res) {
  const wait = sxState(res, "Period comparison", "cmp");
  if (wait) return wait;
  const d = res.data;
  const periods = Array.isArray(d.periods) ? d.periods : [];
  if (d.coverage === "NO_MAPPED_DATA" || !periods.length) return `<div class="ei-state ei-state-unavailable" role="status">No mapped sales data is available, so no comparison is shown.</div>`;
  const cb = comparisonBars(d);
  return `
    <div class="ei-asof-row"><span>Anchor <b>${escapeHtml(formatDateIN(d.anchor))}</b></span><span>Latest mapped day ${escapeHtml(formatDateIN(d.latest_mapped_date))}</span><span>Matched calendar day, capped at month end</span></div>
    <div class="ei-table-wrap"><table class="ei-table" aria-label="Period comparison">
      <thead><tr>${th("Period")}${th("Dates")}${th("Sales value", true)}${th("Net actual packages", true)}${th("Net billed packages", true)}${th("ASP per actual package", true, "Sales value divided by net actual packages")}${th("ASP per billed package", true, "Sales value divided by net billed packages")}${th("Observed days", true)}${th("Coverage")}</tr></thead>
      <tbody>${periods.map((p, pi) => `
        <tr>
          <td>${escapeHtml(periodLabel[p.label] || labelOf({}, p.label))}</td>
          <td>${escapeHtml(dateRange(p.start_date, p.end_date))}</td>
          <td class="num">${escapeHtml(money(p.sales_value))}${dbar(cb?.rows[pi]?.pct ?? null, "Size vs the other matched periods")}</td>
          <td class="num">${escapeHtml(qty(p.actual_packages))}</td>
          <td class="num">${escapeHtml(qty(p.billed_packages))}</td>
          <td class="num">${escapeHtml(money(p.asp_actual_package, "Not available"))}</td>
          <td class="num">${escapeHtml(money(p.asp_billed_package, "Not available"))}</td>
          <td class="num">${escapeHtml(formatIntegerIN(p.observed_dates))}</td>
          <td>${escapeHtml(covText(p.coverage))}${hasValue(p.negative_rows) && Number(p.negative_rows) > 0 ? `<div class="ei-cell-sub">${escapeHtml(formatIntegerIN(p.negative_rows))} return rows</div>` : ""}</td>
        </tr>`).join("")}</tbody>
    </table></div>
    <div class="ei-compare-line"><span>Month on month <b>${escapeHtml(pct(d.mom_pct))}</b></span><span>Year on year <b>${escapeHtml(pct(d.yoy_pct))}</b></span></div>
    ${basisDetails([
      "Each period runs from its month start to the same elapsed calendar day, capped at that month's end. A comparison percentage is only shown when the server has a positive prior value and a complete current value.",
      "Quantities are net package counts, not physical quantity; different units are never added. ASP is sales value divided by the net package count shown in its column header.",
      "A blank figure means a measure was missing in the source for that period; it is not zero. Import completeness is not certified.",
      `Active-SKU filtering uses the current SKU master (${d.active_filter_basis ? String(d.active_filter_basis).replace(/_/g, " ").toLowerCase() : "current master"}).`,
    ])}`;
}

function windowTotalsHtml(res) {
  const wait = sxState(res, "Trailing window totals", "win");
  if (wait) return wait;
  const d = res.data;
  const wins = Array.isArray(d.windows) ? d.windows : [];
  if (d.coverage === "NO_MAPPED_DATA" || !wins.length) return `<div class="ei-state ei-state-unavailable" role="status">No trailing window totals are available.</div>`;
  const wb = windowBars(d);
  return `
    <h3 class="ei-section-title">Trailing complete months <span class="ei-asof">excluding the anchor month</span></h3>
    <div class="ei-table-wrap"><table class="ei-table" aria-label="Trailing window totals">
      <thead><tr>${th("Window")}${th("Months observed", true)}${th("Sales value", true)}${th("Reported amount (not certified)", true)}${th("Average per month", true)}${th("Net actual packages", true)}${th("Net billed packages", true)}${th("ASP per actual package", true)}${th("ASP per billed package", true)}</tr></thead>
      <tbody>${wins.map((w, wi) => {
        const unavailable = !hasValue(w.sales_value);
        return `
        <tr>
          <td>Last ${escapeHtml(w.n)} months<div class="ei-cell-sub">${escapeHtml(dateRange(w.start_date, w.end_date))}</div></td>
          <td class="num">${escapeHtml(formatIntegerIN(w.observed_months))} of ${escapeHtml(w.n)}</td>
          <td class="num">${escapeHtml(unavailable ? "Unavailable" : formatCurrencyINR(w.sales_value))}${dbar(wb?.rows[wi]?.pct ?? null, "Average per month, size vs the other windows")}${unavailable ? `<div class="ei-cell-sub">${Number(w.observed_months) < Number(w.n) ? "months missing" : "ambiguous source amounts"}</div>` : ""}</td>
          <td class="num">${escapeHtml(money(w.source_reported_amount, "None"))}</td>
          <td class="num">${escapeHtml(money(w.average_monthly_sales, "Not available"))}</td>
          <td class="num">${escapeHtml(qty(w.actual_packages))}</td>
          <td class="num">${escapeHtml(qty(w.billed_packages))}</td>
          <td class="num">${escapeHtml(money(w.asp_actual_package, "Not available"))}</td>
          <td class="num">${escapeHtml(money(w.asp_billed_package, "Not available"))}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    ${basisDetails([
      "Windows are the preceding complete calendar months before the anchor month. A window is only valued when every month is present and no source amount is missing or zero-ambiguous; otherwise sales value is unavailable.",
      "The reported amount is the source's own sum, shown for reference. It is not a certified value and is never substituted for sales value.",
      "ASP is the window sales value divided by net packages, never an average of monthly ratios.",
    ])}`;
}

// ---- history ------------------------------------------------------------------------------------------------------
function historyControlsHtml() {
  const h = SX.hist;
  // View options (what to group and how far back). Filter, sort and search live in the canonical toolbar above.
  return `
    <div class="ei-viewopts">
      <label class="ei-field"><span>Group by</span><select id="salesHistGroup">${HISTORY_GROUPS.map((g) => `<option value="${g.value}"${g.value === h.group ? " selected" : ""}>${escapeHtml(g.label)}</option>`).join("")}</select></label>
      <label class="ei-field"><span>Months</span><select id="salesHistMonths">${Array.from({ length: 12 }, (_, i) => i + 1).map((n) => `<option value="${n}"${n === h.months ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    </div>`;
}

function historyColumns() {
  const monthly = isMonthGrouping(SX.hist.group);
  return [
    { label: SX.hist.group === "month" ? "Scope" : "Name", get: (r) => r.dimension_name },
    ...(monthly ? [{ label: "Month", get: (r) => r.month }] : []),
    { label: "Sales value", get: (r) => (hasValue(r.sales_value) ? r.sales_value : "Unavailable") },
    { label: "Reported amount (not certified)", get: (r) => r.source_reported_amount },
    { label: "Net actual packages", get: (r) => (hasValue(r.actual_packages) ? r.actual_packages : "Unavailable") },
    { label: "Net billed packages", get: (r) => (hasValue(r.billed_packages) ? r.billed_packages : "Unavailable") },
    { label: "ASP per actual package", get: (r) => r.asp_actual_package },
    { label: "ASP per billed package", get: (r) => r.asp_billed_package },
    { label: "Coverage", get: (r) => covText(r.coverage) },
  ];
}

function historyResultsHtml(res) {
  const wait = sxState(res, "Sales history", "hist");
  if (wait) return wait;
  const d = res.data;
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const total = Number(d.total) || 0;
  if (d.coverage === "NO_MAPPED_DATA") return `<div class="ei-state ei-state-unavailable" role="status">No mapped sales data is available.</div>`;
  const monthly = isMonthGrouping(SX.hist.group);
  const note = `<div class="ei-asof-row"><span>${escapeHtml(formatDateIN(d.start_date))} to anchor ${escapeHtml(formatDateIN(d.anchor))}</span><span>Closed months from the shared monthly aggregate; the anchor month from daily data</span><span>Import completeness not certified</span></div>`;
  const toolbar = `<div class="ei-viewbar">
      ${monthly && SX.hist.group !== "month" ? `<button type="button" class="mis-retry-btn" data-hist-grid aria-pressed="${SX.hist.grid}">${SX.hist.grid ? "Table view" : "Month grid view"}</button>` : ""}
      <button type="button" class="mis-retry-btn" data-sales-export="hist" ${rows.length ? "" : "disabled"}>Export loaded rows (CSV)</button>
      <span class="ei-asof">Exports only the rows loaded so far${rows.length >= total ? "" : " (more rows exist; keep scrolling to load them)"}, not the whole dataset.</span>
    </div>`;
  const trend = monthlyTrend(d, { group: SX.hist.group, search: SX.hist.search });
  const visuals = trend.months
    ? trendHtml(trend, { label: "Monthly sales value, all sales", format: formatCurrencyINR, unit: "Chronological complete calendar months from the shared monthly aggregate; the anchor month is partial. Not certified: import completeness is not verified.", asOf: `To ${formatDateIN(d.anchor)}` })
    : monthly && SX.hist.group === "month" ? `<div class="ei-note">No monthly trend is drawn: it needs the full month series in one response, and the current page or search does not give that.</div>`
 : "";
  if (!rows.length) return `${note}<div class="ei-state ei-state-unavailable" role="status">${SX.hist.search ? `No rows match "${escapeHtml(SX.hist.search)}".` : "The server returned no rows for these filters."}</div>`;
  let body;
  if (SX.hist.grid && monthly && SX.hist.group !== "month") {
    const g = pivotMonthGrid(rows);
    body = `<div class="ei-table-wrap"><table class="ei-table ei-grid" aria-label="Month grid for this page">
      <thead><tr>${th("Name")}${g.months.map((m) => th(m.slice(0, 7), true)).join("")}</tr></thead>
      <tbody>${g.rows.map((r) => `<tr><td>${escapeHtml(r.name || "Unmapped")}</td>${g.months.map((m) => {
        const c = r.cells[m];
        if (!c) return `<td class="num ei-missing" title="Not returned on this page; not zero">—</td>`;
        return hasValue(c.sales_value) ? `<td class="num">${escapeHtml(formatCurrencyINR(c.sales_value))}</td>` : `<td class="num ei-reported" title="Source reported amount, not certified">${escapeHtml(hasValue(c.source_reported_amount) ? `${formatCurrencyINR(c.source_reported_amount)} reported` : "Unavailable")}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table>${moreHtml("hist", sxMoreState("hist"))}</div>
      <div class="ei-note ei-grid-hint">Month grid: a genuine matrix, so it scrolls sideways inside its own panel (swipe or scroll to see every month).</div>
      <div class="ei-note">The grid shows only rows returned on this page. A dash means the cell was not returned, not zero; page through to see further rows.</div>`;
  } else {
    const histMax = Math.max(0, ...rows.filter((r) => hasValue(r.sales_value)).map((r) => Number(r.sales_value)));
    const drill = SX.hist.group === "product" || SX.hist.group === "product_month";
    body = `<div class="ei-table-wrap"><table class="ei-table" aria-label="Sales history">
      <thead><tr>${historyColumns().map((c, i) => th(c.label, i >= (monthly ? 2 : 1) && i < historyColumns().length - 1)).join("")}${drill ? th("") : ""}</tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${escapeHtml(r.dimension_name || "Unmapped")}</td>
        ${monthly ? `<td>${escapeHtml(r.month ? String(r.month).slice(0, 7) : "-")}</td>` : ""}
        <td class="num">${hasValue(r.sales_value) ? `${escapeHtml(formatCurrencyINR(r.sales_value))}${monthly ? "" : dbar(inlineBarPct(r.sales_value, histMax), "Size vs the largest value among the rows loaded so far; not a share of the total")}` : `Unavailable${Number(r.ambiguous_amount_groups) > 0 ? `<div class="ei-cell-sub">${escapeHtml(formatIntegerIN(r.ambiguous_amount_groups))} ambiguous source group${Number(r.ambiguous_amount_groups) === 1 ? "" : "s"}</div>` : ""}`}</td>
        <td class="num ei-reported">${escapeHtml(money(r.source_reported_amount, "None"))}</td>
        <td class="num">${escapeHtml(qty(r.actual_packages))}</td>
        <td class="num">${escapeHtml(qty(r.billed_packages))}</td>
        <td class="num">${escapeHtml(money(r.asp_actual_package, "Not available"))}</td>
        <td class="num">${escapeHtml(money(r.asp_billed_package, "Not available"))}</td>
        <td>${escapeHtml(covText(r.coverage))}</td>
        ${drill ? `<td><button type="button" class="ei-link" data-hist-drill="${escapeHtml(r.dimension_id)}">SKUs</button></td>` : ""}
      </tr>`).join("")}</tbody></table>${moreHtml("hist", sxMoreState("hist"))}</div>`;
  }
  return `${note}${visuals}${toolbar}${body}
    ${basisDetails([
      "Sales value is only shown when every contributing source amount is present and unambiguous. Otherwise it is Unavailable; the reported amount beside it is the source's own sum, not a certified value.",
      "Quantities are net package counts and are never added across different units. Category, subcategory, group and subgroup filters narrow by the product's current place in the product hierarchy; the Group by choice is a grouping, not a filter.",
    ])}`;
}

function exceptionControlsHtml() { return ""; }

function exceptionsResultsHtml(res) {
  const wait = sxState(res, "Sales exceptions", "exc");
  if (wait) return wait;
  const d = res.data;
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const total = Number(d.total) || 0;
  const head = `<div class="ei-asof-row"><span>${escapeHtml(formatDateIN(d.start_date))} to ${escapeHtml(formatDateIN(d.anchor))}</span><span>Eligibility is from the current SKU master, not what was listed historically</span><span>Import completeness not certified</span></div>`;
  if (d.coverage === "NO_MAPPED_DATA") return `<div class="ei-state ei-state-unavailable" role="status">No mapped sales data is available.</div>`;
  if (!rows.length) return `${head}<div class="ei-state ei-state-unavailable" role="status">${SX.exc.search ? `No exceptions match "${escapeHtml(SX.exc.search)}".` : "The server reported no exception rows for this scope."}</div>`;
  const exportBar = `<div class="ei-viewbar"><button type="button" class="mis-retry-btn" data-sales-export="exc">Export loaded rows (CSV)</button><span class="ei-asof">Exports only the rows loaded so far${rows.length >= total ? "" : " (more rows exist; keep scrolling to load them)"}, not the whole dataset.</span></div>`;
  return `${head}${exportBar}<div class="ei-table-wrap"><table class="ei-table" aria-label="Sales exceptions">
    <thead><tr>${th("Product")}${th("SKU", true)}${th("Pack")}${th("Eligibility now")}${th("Activity this month")}${th("Net billed", true)}${th("Sales rows", true)}${th("Return rows", true)}${th("Rows missing a measure", true)}</tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${escapeHtml(r.product_name || "-")}</td><td class="num">${escapeHtml(r.sku_id)}</td>
      <td>${escapeHtml([r.pack_size, r.uom].filter((v) => v != null && v !== "").join(" ") || "-")}</td>
      <td>${escapeHtml(labelOf(ELIGIBILITY_LABELS, r.eligibility))}</td>
      <td class="ei-activity">${(() => { const a = activityParts(r.activity_state, ACTIVITY_LABELS); return `<div class="ei-activity-box"><span class="ei-activity-label">${escapeHtml(a.label)}</span>${a.note ? `<div class="ei-cell-sub">${escapeHtml(a.note)}</div>` : ""}</div>`; })()}</td>
      <td class="num">${escapeHtml(qty(r.net_billed, "No rows"))}</td>
      <td class="num">${escapeHtml(orWord(r.positive_rows, formatIntegerIN, "No rows"))}</td>
      <td class="num">${escapeHtml(orWord(r.return_rows, formatIntegerIN, "No rows"))}</td>
      <td class="num">${escapeHtml(orWord(r.missing_rows, formatIntegerIN, "No rows"))}</td>
    </tr>`).join("")}</tbody></table>${moreHtml("exc", sxMoreState("exc"))}</div>
    ${basisDetails([
      "“No recorded rows” means nothing was found in the mapped data for that SKU and period. Because import coverage is not certified, it is not a certified zero seller.",
      "Sales offset by returns, missing measures and no recorded rows are different situations and are kept apart.",
    ])}`;
}

function coverageHtml(res) {
  const wait = sxState(res, "Data coverage", "cov");
  if (wait) return wait;
  const d = res.data;
  const days = Array.isArray(d.days) ? d.days : [];
  if (d.coverage === "NO_MAPPED_DATA") return `<div class="ei-state ei-state-unavailable" role="status">No mapped sales data is available.</div>`;
  return `
    <div class="ei-asof-row"><span>Latest mapped day <b>${escapeHtml(formatDateIN(d.latest_mapped_date))}</b></span><span>Latest raw voucher day ${escapeHtml(formatDateIN(d.latest_raw_date))}</span><span>${escapeHtml(formatIntegerIN(d.observed_raw_dates))} raw days · ${escapeHtml(formatIntegerIN(d.observed_mapped_dates))} mapped days observed</span><span>Import completeness not certified</span></div>
    <div class="ei-table-wrap"><table class="ei-table" aria-label="Daily coverage">
      <thead><tr>${th("Date")}${th("Raw rows", true)}${th("Mapped rows", true)}${th("Source keys", true)}${th("Missing amounts", true)}${th("Last ETL job")}${th("Job finished")}${th("State")}</tr></thead>
      <tbody>${days.map((r) => `<tr>
        <td>${escapeHtml(formatDateIN(r.transaction_date))}</td>
        <td class="num">${escapeHtml(orWord(r.raw_rows, formatIntegerIN, "None"))}</td><td class="num">${escapeHtml(orWord(r.mapped_rows, formatIntegerIN, "None"))}</td>
        <td class="num">${escapeHtml(orWord(r.distinct_source_keys, formatIntegerIN, "None"))}</td><td class="num">${escapeHtml(orWord(r.missing_amount_rows, formatIntegerIN, "None"))}</td>
        <td>${escapeHtml(r.latest_job_status || "No job recorded")}</td><td>${escapeHtml(r.latest_job_finished_at ? formatDateTimeIN(r.latest_job_finished_at) : "-")}</td>
        <td>${escapeHtml(covText(r.state))}</td></tr>`).join("")}</tbody></table></div>
    ${basisDetails(["A recorded job status describes the last run for that day. It is not proof that the import was complete.", "Raw and mapped counts are compared per day; a difference is reported as a mismatch, never explained away."])}`;
}

const fmtWhen = (v) => (v ? formatDateTimeIN(v) : "Unavailable");
function refreshStatusHtml(res) {
  const wait = sxState(res, "Source refresh status", "refresh");
  if (wait) return wait;
  const d = res.data;
  const job = refreshJobModel(d);
  const fr = refreshFreshnessModel(d);
  const row = (k, v, cls = "") => `<div class="ei-dl-row"><dt>${escapeHtml(k)}</dt><dd${cls ? ` class="${cls}"` : ""}>${escapeHtml(v)}</dd></div>`;
  const order = { daily_newer: "Daily source was loaded after the monthly aggregate", monthly_newer: "Monthly aggregate was loaded after the latest daily source", same: "Daily and monthly sources were loaded at the same time", unknown: "Load order cannot be determined" }[fr.order];
  const jobBlock = job.state === "unavailable" || job.state === "missing"
    ? `<dl class="ei-dl">${row("Refresh job", "Status unavailable. No success is inferred.")}</dl>`
    : `<dl class="ei-dl">
        ${row("Monthly refresh job", job.label, `ei-job-${job.tone}`)}
        ${job.active === false ? row("Schedule", "Job is not active") : ""}
        ${row("Last started", fmtWhen(job.startedAt))}
        ${row("Last finished", job.finishedAt ? fmtWhen(job.finishedAt) : job.status === "running" ? "Still running" : "Unavailable")}
      </dl>`;
  return `
    <h3 class="ei-section-title">Refresh status <span class="ei-asof">Latest run only; not a completeness certificate</span></h3>
    ${jobBlock}
    <h3 class="ei-section-title">Daily and monthly freshness <span class="ei-asof">Not certified</span></h3>
    <dl class="ei-dl">
      ${row("Latest monthly aggregate month", d.monthly_latest_month ? formatDateIN(d.monthly_latest_month) : "Unavailable")}
      ${row("Monthly source last loaded", fmtWhen(d.monthly_source_max_inserted_at))}
      ${row("Daily source last loaded", fmtWhen(d.daily_source_max_inserted_at))}
      ${row("Load order", order)}
      ${row("Last daily date in that month", d.daily_last_date_in_month ? formatDateIN(d.daily_last_date_in_month) : "Unavailable")}
      ${row("Monthly reported amount", money(d.monthly_reported_amount))}
      ${row("Daily reported amount", money(d.daily_reported_amount))}
      ${row("Difference (daily minus monthly)", money(d.amount_difference, "Not available"))}
    </dl>
    ${basisDetails([
      "The job status is the latest run of the monthly sales refresh job as recorded by the database scheduler. A finished run shows that a run completed; it does not show that the source import was complete or that figures are correct.",
      "Closed months in history come from the monthly aggregate and the anchor month from daily data. A difference between the two aggregates is reported as is and is not explained away.",
    ])}`;
}

// ---- facility classification and reconciliation -----------------------------------------------------------------------
function facilityHtml(res) {
  const wait = sxState(res, "Facility sales classification", "fac");
  if (wait) return wait;
  const m = facilityModel(res.data);
  if (m.state === "no-data") return `<div class="ei-state ei-state-unavailable" role="status">No raw sales vouchers are available, so no facility classification is shown.</div>`;
  if (m.state !== "ok") return `<div class="ei-state error" role="alert">The server returned an unrecognised facility response. Nothing is estimated in its place.</div>`;
  const n = (v) => orWord(v, formatIntegerIN, "Unavailable");
  const f = m.facility;
  const fbar = facilityBars(m);
  const facilityPct = (r) => fbar?.rows[m.rows.indexOf(r)]?.pct ?? null;
  const rowHtml = (r) => `<tr${r.review ? ' class="ei-review-row"' : ""}>
      <td>${escapeHtml(r.label)}${r.inProductAnalytics ? `<div class="ei-cell-sub">Counted in product analytics when the godown is also resolved</div>` : ""}${r.review ? `<div class="ei-cell-sub">Needs classification review (not a product-analytics figure)</div>` : ""}</td>
      <td class="num">${escapeHtml(n(r.recorded))}</td><td class="num">${escapeHtml(n(r.missing))}</td>
      <td class="num">${escapeHtml(money(r.billed, r.missing > 0 ? "Unavailable (amounts missing)" : "Unavailable"))}${dbar(facilityPct(r), "Billed value, size vs the other scopes")}</td>
      <td class="num ei-reported">${escapeHtml(money(r.reported, "None"))}</td>
      <td class="num">${escapeHtml(n(r.unresolvedGodown))}</td></tr>`;
  const reviewLine = m.review.length
    ? `${m.review.map((r) => `${escapeHtml(r.label)}: ${escapeHtml(n(r.recorded))} rows`).join(" · ")}`
    : "No rows in the unclassified or conflict scopes for this period";
  return `
    <div class="ei-asof-row"><span>${escapeHtml(formatDateIN(m.startDate))} to anchor ${escapeHtml(formatDateIN(m.anchor))}</span><span>Latest raw voucher day ${escapeHtml(formatDateIN(m.latestRawDate))}</span><span>Import completeness ${escapeHtml(String(m.importCompleteness).replace(/_/g, " ").toLowerCase())}</span></div>
    ${f ? `<div class="ei-metrics ei-metrics-facility">
      ${metric({ label: "Facility rows recorded", value: n(f.recorded), sub: "Every voucher row, incl. unresolved godowns" })}
      ${metric({ label: "Facility billed value", value: money(f.billed), sub: f.missing > 0 ? `${formatIntegerIN(f.missing)} rows missing an amount` : "No missing amounts" })}
      ${metric({ label: "Rows with unresolved godown", value: n(f.unresolvedGodown), sub: "Independent diagnostic" })}
      ${metric({ label: "Needs classification review", value: m.reviewRowCount === null ? "Unavailable" : formatIntegerIN(m.reviewRowCount), sub: reviewLine })}
    </div>` : ""}
    <h3 class="ei-section-title">Classification by scope <span class="ei-asof">Each voucher row is classified once</span></h3>
    <div class="ei-table-wrap"><table class="ei-table" aria-label="Facility sales by classification scope">
      <thead><tr>${th("Scope")}${th("Rows", true)}${th("Missing amounts", true)}${th("Billed value", true)}${th("Reported amount (not certified)", true)}${th("Unresolved godown rows", true)}</tr></thead>
      <tbody>${m.rows.map(rowHtml).join("") || `<tr><td colspan="6">The server returned no scope rows.</td></tr>`}</tbody>
    </table></div>
    <div class="ei-state ei-state-unavailable" role="note">Facility sales and product sales are different measures. The facility figure includes every recorded voucher row, including rows whose godown is not resolved, while product sales analytics needs a resolved SKU and a resolved godown. They are not expected to be equal and no difference between them is derived here.</div>
    ${basisDetails([
      m.scopeNote || "Each voucher row is assigned to exactly one scope. Conflicts are excluded from certified product scope.",
      "Billed value is only shown when no row in that scope is missing an amount; otherwise it is Unavailable and the source's own reported sum is shown separately as not certified.",
      "Unresolved godown is a separate diagnostic across scopes, not a classification scope. Classification assignment and approval are not available on this page.",
    ])}`;
}

const SX_RENDER = {
  cmp: ["salesCmp", comparisonHtml], win: ["salesWin", windowTotalsHtml], hist: ["salesHistResults", historyResultsHtml],
  exc: ["salesExcResults", exceptionsResultsHtml], cov: ["salesCov", coverageHtml], refresh: ["salesRefresh", refreshStatusHtml], fac: ["salesFac", facilityHtml],
};
function renderSalesResults(slot) {
  const r = SX_RENDER[slot];
  if (!r) return;
  const host = $(r[0]);
  if (!host) return;
  const top = host.querySelector(".ei-table-wrap")?.scrollTop || 0; // appends never jump the scroll position
  host.innerHTML = r[1](SX.res[slot]);
  applyRecordCards(host);
  const wrap = host.querySelector(".ei-table-wrap");
  if (wrap) wrap.scrollTop = top;
  if (SX.more[slot] && wrap) armMore(wrap, slot, () => sxLoadMore(slot)); else disposeMore(slot);
}

// ---- interaction ---------------------------------------------------------------------------------------------------
const debouncedSalesHistSearch = debounce((v) => { const n = String(v || "").trim(); if (n === SX.hist.search) return; SX.hist.search = n; SX.hist.page = 1; sxFetch("hist"); }, 250);
const debouncedSalesExcSearch = debounce((v) => { const n = String(v || "").trim(); if (n === SX.exc.search) return; SX.exc.search = n; SX.exc.page = 1; sxFetch("exc"); }, 250);

function salesFilterChanged() {
  SX.hist.page = 1; SX.exc.page = 1;
  sxInvalidateFilterDependents();
  renderSalesFilters();
  renderSalesViewShell();
  sxEnsureView();
}

function handleSalesChange(ev) {
  const id = ev.target?.id;
  if (id === "salesAnchor") {
    const d = SX.res.dims.status === "ok" ? SX.res.dims.data : {};
    const v = ev.target.value;
    if (v && ((d.first_mapped_date && v < d.first_mapped_date) || (d.last_mapped_date && v > d.last_mapped_date))) {
      SX.anchor = ""; SX.notice = `As-of date ${formatDateIN(v)} is outside the mapped range ${formatDateIN(d.first_mapped_date)} to ${formatDateIN(d.last_mapped_date)}, so the latest mapped day is used.`;
    } else { SX.anchor = v || ""; SX.notice = ""; }
  } else if (id === "salesRegion") {
    SX.region = ev.target.value; SX.notice = "";
    const gd = (SX.res.dims.data?.godowns || []).find((g) => String(g.id) === String(SX.godown));
    if (gd && SX.region && String(gd.region_id) !== String(SX.region)) SX.godown = "";
  } else if (id === "salesGodown") { SX.godown = ev.target.value; SX.notice = ""; }
  else if (id === "salesActive") SX.activeOnly = !!ev.target.checked;
  else if (id === "salesFacMonths") { SX.facMonths = Math.min(12, Math.max(1, Number(ev.target.value) || 1)); return void sxFetch("fac"); }
  else if (id && id.startsWith("salesHier-")) {
    // Cascading hierarchy: a choice clears every level below it, then pagination resets with the refreshed request.
    const key = id.slice("salesHier-".length);
    if (!HIERARCHY_LEVELS.some((l) => l.key === key)) return;
    const next = { ...SX.hier, [key]: ev.target.value };
    const r = reconcileHierarchy(SX.res.dims.status === "ok" ? SX.res.dims.data : null, next, key);
    SX.hier = r.sel;
    SX.notice = r.cleared.length ? `${r.cleared.map((k) => HIERARCHY_LEVELS.find((l) => l.key === k).label).join(", ")} cleared because the level above changed.` : "";
  }
  else if (id === "salesHistGroup") { SX.hist.group = ev.target.value; SX.hist.page = 1; if (!isMonthGrouping(SX.hist.group)) SX.hist.grid = false; return void sxFetch("hist"); }
  else if (id === "salesHistMonths") { SX.hist.months = Number(ev.target.value) || 12; SX.hist.page = 1; return void sxFetch("hist"); }
  else return;
  salesFilterChanged();
}
function renderSalesHistControls() { const h = $("salesHistControls"); if (h) h.innerHTML = historyControlsHtml(); renderSalesSort(); }

function downloadCsv(name, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Bounded export: only the page currently returned, with a scope line that states the filters, the total and has_more.
function salesExportFilters() {
  const dims = SX.res.dims.status === "ok" ? SX.res.dims.data : null;
  const name = (rows, id) => { const r = (rows || []).find((x) => String(x.id) === String(id)); return r && (r.name || r.code) ? r.name || r.code : `#${id}`; };
  return [
    SX.region && `Region: ${name(dims?.regions, SX.region)}`,
    SX.godown && `Godown: ${name(dims?.godowns, SX.godown)}`,
    ...hierarchyLabels(dims, SX.hier),
    SX.activeOnly && "Active SKUs only (current master)",
    SX.hist.product && `Product #${SX.hist.product}`,
    SX.hist.sku && `SKU #${SX.hist.sku}`,
  ].filter(Boolean);
}
function exportSalesPage(kind) {
  const slot = kind === "exc" ? "exc" : "hist";
  const d = SX.res[slot].data;
  const rows = Array.isArray(d?.rows) ? d.rows : [];
  if (SX.res[slot].status !== "ok" || !rows.length) return;
  const st = slot === "exc" ? SX.exc : SX.hist;
  const filters = salesExportFilters();
  if (st.search) filters.push(`Search: ${st.search}`);
  if (slot === "hist") {
    const scope = exportLoadedScopeLine({ title: "sales history", rowsLoaded: rows.length, total: d.total, anchor: d.anchor, filters, note: `grouped by ${SX.hist.group}; ${SX.hist.months} months; order ${SX.hist.sort}` });
    downloadCsv(`executive-intelligence-sales-history-loaded-rows.csv`, buildPageCsv(historyColumns(), rows, scope));
    return;
  }
  const cols = [
    { label: "Product", get: (r) => r.product_name }, { label: "SKU", get: (r) => r.sku_id }, { label: "Pack", get: (r) => [r.pack_size, r.uom].filter((v) => v != null && v !== "").join(" ") },
    { label: "Eligibility now", get: (r) => labelOf(ELIGIBILITY_LABELS, r.eligibility) }, { label: "Activity this month", get: (r) => labelOf(ACTIVITY_LABELS, r.activity_state) },
    { label: "Net billed", get: (r) => (hasValue(r.net_billed) ? r.net_billed : "No rows") }, { label: "Sales rows", get: (r) => (hasValue(r.positive_rows) ? r.positive_rows : "No rows") },
    { label: "Return rows", get: (r) => (hasValue(r.return_rows) ? r.return_rows : "No rows") }, { label: "Rows missing a measure", get: (r) => (hasValue(r.missing_rows) ? r.missing_rows : "No rows") },
  ];
  const scope = exportLoadedScopeLine({ title: "sales exceptions", rowsLoaded: rows.length, total: d.total, anchor: d.anchor, filters, note: "eligibility from the current SKU master" });
  downloadCsv(`executive-intelligence-sales-exceptions-loaded-rows.csv`, buildPageCsv(cols, rows, scope));
}

function handleSalesClick(ev) {
  const t = ev.target;
  const view = t.closest("[data-sales-view]");
  if (view) { selectSalesView(view.getAttribute("data-sales-view")); return true; }
  const retry = t.closest("[data-sales-retry]");
  if (retry) { sxFetch(retry.getAttribute("data-sales-retry")); if (retry.getAttribute("data-sales-retry") === "dims") renderSalesFilters(); return true; }
  if (t.closest("[data-hist-grid]")) { SX.hist.grid = !SX.hist.grid; renderSalesResults("hist"); return true; }
  const drill = t.closest("[data-hist-drill]");
  if (drill) { SX.hist.product = drill.getAttribute("data-hist-drill"); SX.hist.group = "sku"; SX.hist.page = 1; renderSalesHistControls(); salesFilterChanged(); return true; }
  if (t.closest("[data-sales-clear-item]")) { SX.hist.product = ""; SX.hist.sku = ""; SX.hist.page = 1; salesFilterChanged(); return true; }
  if (t.closest("#salesFilterToggle")) { setSalesFiltersOpen(!SX.filtersOpen); return true; }
  if (t.closest("#salesFilterClose") || t.closest("#salesFilterDone")) { setSalesFiltersOpen(false, { restoreFocus: true }); return true; }
  if (t.closest("#salesSortBtn")) { setSalesSortOpen(!SX.sortOpen); return true; }
  if (t.closest("#salesSortClose")) { setSalesSortOpen(false, { restoreFocus: true }); return true; }
  if (t.closest("#salesFilterReset")) { Object.assign(SX, { anchor: "", region: "", godown: "", activeOnly: false, notice: "", hier: emptyHierarchy() }); SX.hist.product = ""; SX.hist.sku = ""; renderSalesHistControls(); salesFilterChanged(); return true; }
  const exp = t.closest("[data-sales-export]");
  if (exp) {
    exportSalesPage(exp.getAttribute("data-sales-export"));
    return true;
  }
  return false;
}

const loadSalesTab = () => loadSalesLens();

// ---------------------------------------------------------------------------
// Management Alerts (R4 initial, review-only catalogue). Own latest-wins key; unavailable until the contract exists.
// ---------------------------------------------------------------------------
let ALERTS = { status: "idle", data: null, message: "" };

async function loadAlertsLens() {
  if (!tabPanel) return;
  if (!ACCESS.executive) { ALERTS = { status: "denied", data: null, message: "" }; renderAlertsLens(); return; } // never requested without executive access
  const token = beginRequest("alerts");
  ALERTS = { status: "loading", data: null, message: "" };
  renderAlertsLens();
  const { data, error } = await settle(supabase.rpc("ei_management_alerts"));
  if (!isLatestRequest("alerts", token)) return;
  if (error) {
    const status = classifyApiError(error);
    if (status !== "unavailable") console.error("[MIS] ei_management_alerts failed", error);
    ALERTS = { status, data: null, message: errorMessage(error) };
    if (status === "error") ACTIVE_TAB_FAILED = true;
  } else {
    ALERTS = data && typeof data === "object" && !Array.isArray(data) ? { status: "ok", data, message: "" } : { status: "error", data: null, message: "The server returned an unexpected response." };
  }
  renderAlertsLens();
}

function renderAlertsLens() {
  if (!tabPanel || ACTIVE_TAB !== "alerts") return;
  const vm = alertsViewModel(ALERTS);
  let body;
  if (vm.state === "loading") body = `<div class="ei-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading alerts...</div>`;
  else if (vm.state === "ok" || vm.state === "empty") {
    body = `
      <div class="ei-asof-row"><span>${vm.partial ? "Partial catalogue" : "Catalogue"}${vm.catalogue ? `: ${escapeHtml(vm.catalogue.replace(/_/g, " ").toLowerCase())}` : ""}</span><span>Review only; no actions are taken here</span></div>
      ${segmentsHtml(alertSegments(vm.items), { label: "Checks by state", noun: "checks", cls: { REVIEW: "c", CLEAR: "d", UNAVAILABLE: "a" }, unit: `Counts of checks, not of findings. Unavailable is its own state and is never counted as clear${vm.partial ? "; the catalogue is partial, so no all-clear is implied" : ""}.` })}
      ${vm.items.length ? `<div class="ei-table-wrap"><table class="ei-table" aria-label="Management alerts">
        <thead><tr>${th("Check")}${th("State")}${th("Findings", true)}${th("Evidence date")}${th("Severity")}</tr></thead>
        <tbody>${vm.items.map((a) => `<tr><td>${a.debtorKyc ? `<a class="ei-link" href="${INCOMPLETE_KYC_ROUTE}" data-act="open-kyc" data-route="unclassified">${escapeHtml(a.label)}</a>${a.exposureAmount === null ? "" : `<small class="ei-kyc-alert-exposure ei-cell-sub">${escapeHtml(formatCurrencyINR(a.exposureAmount))} exposure</small>`}` : escapeHtml(a.label)}</td><td><span class="ei-badge ei-badge-${a.state.toLowerCase()}">${escapeHtml(labelOf({ REVIEW: "Needs review", CLEAR: "No findings", UNAVAILABLE: "Unavailable" }, a.state))}</span></td>
          <td class="num">${escapeHtml(a.findings === null ? "Unavailable" : formatIntegerIN(a.findings))}</td><td>${escapeHtml(a.evidenceDate ? formatDateIN(a.evidenceDate) : "-")}</td><td>${escapeHtml(a.severity.replace(/_/g, " ").toLowerCase())}</td></tr>`).join("")}</tbody></table></div>` : `<div class="ei-state ei-state-unavailable" role="status">${escapeHtml(vm.title)}. This is a partial catalogue, so it is not an all-clear.</div>`}
      ${vm.partial ? `<div class="ei-note">This is a partial catalogue. “No findings” means nothing was found by that check only; it is not an all-clear for the business.</div>` : ""}`;
  } else {
    body = `<div class="ei-state ${vm.state === "unavailable" ? "ei-state-unavailable" : "error"}" role="${vm.state === "unavailable" ? "status" : "alert"}"><h3 class="ei-section-title" id="eiAlertsTitle">${escapeHtml(vm.title)}</h3><p>${escapeHtml(vm.body)}</p>${vm.state === "error" || vm.state === "expired" ? `<button type="button" class="mis-retry-btn" data-mis-retry="alerts">Retry</button>` : ""}</div>`;
  }
  tabPanel.innerHTML = `
    <div class="ei-lens">
      ${lensHeadHtml("Management Alerts")}
      <section class="ei-alerts" aria-label="Management alerts">
        ${body}
        <p class="ei-note">This lens only reports; it has no acknowledgement or other action controls. Historical not-verified evidence signatures on the Production Performance lens are not confirmed operational failures and are not raised as alerts here.</p>
      </section>
    </div>`;
}


// The Production tab is two independent sections: the canonical monetary section (mounted at once)
// and the subordinate legacy counts section. Each has its own request key, state, error and retry.
const PRODUCTION_COUNT_FIELDS = Object.freeze([
  "active_pipeline_batch_count",
  "work_in_process_batch_count",
  "overdue_work_in_process_batch_count",
  "finished_goods_bulk_batch_count",
  "bottled_stock_batch_count",
  "total_canonical_batch_count",
]);


function renderProductionShell() {
  tabPanel.innerHTML = `
    <div class="ei-lens ei-lens-production">
      ${lensHeadHtml("Production Performance")}
      <div id="productionPlanNotice">${planningNoticeHtml(LAST_SUMMARY_ROW)}</div>
      <section class="ei-section" aria-labelledby="eiProdLive">
        <h3 class="ei-section-title" id="eiProdLive">Live batch position <span class="ei-asof">Current state, not month-bound</span></h3>
        <div id="productionCounts" class="production-counts"></div>
      </section>
      ${renderProductionValueSection()}
      <section class="ei-section" aria-labelledby="eiProdExceptions">
        <h3 class="ei-section-title" id="eiProdExceptions">Exceptions and evidence</h3>
        ${renderEvidenceShell()}
      </section>
    </div>
  `;
  renderProductionValueBody();
  renderProductionCountsBody();
  mountEvidencePanel(tabPanel, supabase, istToday());
}

async function loadProductionTab() {
  if (!ACCESS.executive) return; // executive-only contract
  if (!tabPanel) return;
  if (!PRODUCTION_VALUE_MONTH) PRODUCTION_VALUE_MONTH = `${istToday().slice(0, 7)}-01`;
  renderProductionShell();
  await Promise.all([
    loadProductionValue(),
    loadProductionCounts(),
  ]);
}

async function loadProductionCounts({ force = false } = {}) {
  if (!ACCESS.executive) return; // executive-only contract
  // The lens reads the shared live pipeline (also feeding the headline cards); no private request of its own.
  renderProductionCountsBody();
  await loadLivePipeline({ force });
}

function istToday() {
  // YYYY-MM-DD in Asia/Kolkata (en-CA formats as ISO).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function productionValueMonthOptions() {
  const [y, m] = istToday().split("-").map(Number);
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    out.push({
      value: iso,
      label: new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(d),
    });
  }
  return out;
}

// Pure: selectable cutoff range for a report month (first of month) given today's IST date.
function asOfBoundsFor(monthStart, today) {
  const [y, m] = monthStart.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { min: monthStart, max: monthEnd < today ? monthEnd : today };
}

// Pure: every selectable day in [min, max], as ISO values with a readable label.
function asOfDayOptionsFor(bounds) {
  const out = [];
  const fmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short", timeZone: "UTC" });
  const last = Number(bounds.max.slice(8, 10));
  for (let d = Number(bounds.min.slice(8, 10)); d <= last; d += 1) {
    const iso = `${bounds.min.slice(0, 8)}${String(d).padStart(2, "0")}`;
    out.push({ value: iso, label: fmt.format(new Date(`${iso}T00:00:00Z`)).replace(/,/g, "") });
  }
  return out;
}

function productionValueAsOfBounds() {
  return asOfBoundsFor(PRODUCTION_VALUE_MONTH, istToday());
}

function renderAsOfOptionsHtml() {
  const b = productionValueAsOfBounds();
  return [`<option value=""${PRODUCTION_VALUE_ASOF === "" ? " selected" : ""}>Default (latest allowed)</option>`]
    .concat(asOfDayOptionsFor(b).map((o) => `<option value="${escapeHtml(o.value)}"${o.value === PRODUCTION_VALUE_ASOF ? " selected" : ""}>${escapeHtml(o.label)}</option>`))
    .join("");
}

function classifyValueError(error) {
  const code = String((error && (error.code || error.status)) || "");
  const msg = String((error && error.message) || "");
  if (code === "42501" || code === "403" || /permission required/i.test(msg)) return "denied";
  if (code === "401" || code === "PGRST301" || /jwt|not authenticated|session/i.test(msg)) return "expired";
  if (code === "22023") return "invalid";
  return "error";
}

async function loadProductionValue() {
  if (!ACCESS.executive) return; // executive-only contract
  if (!PRODUCTION_VALUE_MONTH) PRODUCTION_VALUE_MONTH = `${istToday().slice(0, 7)}-01`;
  const token = beginRequest("production:value");
  PRODUCTION_VALUE = { status: "loading", data: null, message: "" };
  renderProductionValueBody();

  const args = { p_report_month: PRODUCTION_VALUE_MONTH };
  if (PRODUCTION_VALUE_ASOF) args.p_as_of_date = PRODUCTION_VALUE_ASOF;
  PRODUCTION_VALUE_REQUESTED = `${PRODUCTION_VALUE_MONTH}|${PRODUCTION_VALUE_ASOF}`;
  const { data, error } = await settle(
    supabase.rpc("get_mis_production_value_summary", args),
  );
  if (!isLatestRequest("production:value", token)) return;

  if (error) {
    console.error("[MIS] Production value summary load failed", error);
    ACTIVE_TAB_FAILED = true;
    PRODUCTION_VALUE = {
      status: classifyValueError(error),
      data: null,
      message: errorMessage(error),
    };
  } else if (!data || typeof data !== "object" || Array.isArray(data)) {
    PRODUCTION_VALUE = {
      status: "error",
      data: null,
      message: "The server returned an unexpected response.",
    };
  } else {
    PRODUCTION_VALUE = { status: "ok", data, message: "" };
  }
  renderProductionValueBody();
}

function formatPercent(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${formatNumberIN(n)}%`;
}

const PV_STATUS_LABELS = {
  BULK_RECEIPT_COVERED_REFERENCE: "Bulk receipts, approved reference cost (covered subtotal)",
  NO_PREVIOUS_MONTH_APPROVED_COST: "No approved cost run for the previous month",
};
const PV_COMPONENT_POLICY_LABELS = {
  RM_STORES_PM_EXCLUDED:
    "Rate includes RM and RM materials-stores share only. PM stores, packing labour and PM costs are excluded from bulk.",
};

function pvCard({ cls = "", title, value, badge = "", caption = "", unavailable = false }) {
  return `
    <div class="pv-kpi ${cls}${unavailable ? " unavailable" : ""}">
      <div class="pv-kpi-title">${escapeHtml(title)}</div>
      <div class="pv-kpi-value">${escapeHtml(value)}</div>
      ${badge ? `<div class="pv-kpi-badge">${escapeHtml(badge)}</div>` : ""}
      ${caption ? `<div class="pv-kpi-caption">${escapeHtml(caption)}</div>` : ""}
    </div>`;
}

function pvHasValue(v) {
  return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
}

// Pure presentation of the server payload. No arithmetic: every rupee figure is shown exactly as
// supplied, and a missing figure is a word, never "₹0".
function buildProductionValueCards(d) {
  const noRun = d.status === "NO_PREVIOUS_MONTH_APPROVED_COST";
  const events = pvHasValue(d.receipt_event_count) ? Number(d.receipt_event_count) : null;
  const unvalued = pvHasValue(d.receipt_unvalued_count) ? Number(d.receipt_unvalued_count) : null;
  const corrections = pvHasValue(d.receipt_correction_event_count) ? Number(d.receipt_correction_event_count) : 0;
  const rStatus = d.receipt_value_status;

  // 1. Planned
  let planned;
  if (pvHasValue(d.planned_reference_covered_value)) {
    planned = pvCard({
      title: "Planned bulk value",
      value: formatCurrencyINR(d.planned_reference_covered_value),
      badge: d.plan_status === "FROZEN" ? "Frozen plan" : String(d.plan_status || "").replace(/_/g, " ").toLowerCase(),
      caption: pvHasValue(d.planned_unvalued_count) && Number(d.planned_unvalued_count) > 0
        ? `${formatIntegerIN(d.planned_unvalued_count)} planned product(s) unvalued - covered subtotal`
        : "Reference estimate",
    });
  } else {
    planned = pvCard({
      title: "Planned bulk value",
      value: "Unavailable",
      unavailable: true,
      badge: d.plan_status === "UNAVAILABLE_PENDING_FROZEN_PLAN" ? "Pending frozen plan" : "",
      caption: d.plan_status === "UNAVAILABLE_PENDING_FROZEN_PLAN"
        ? "No approved frozen plan snapshot yet; no planned amount is shown."
        : "No planned amount supplied for this period.",
    });
  }

  // 2. Actual bulk received (covered)
  let recv;
  if (noRun) {
    recv = pvCard({ title: "Bulk received - covered value", value: "Unavailable", unavailable: true, badge: "No approved cost", caption: "Previous month has no approved cost run, so receipts cannot be valued." });
  } else if (rStatus === "BLOCKED_CORRECTION_LINEAGE" || (!pvHasValue(d.receipt_reference_covered_value) && corrections > 0)) {
    recv = pvCard({ title: "Bulk received - covered value", value: "Withheld", unavailable: true, badge: "Correction lineage blocked", caption: `${formatIntegerIN(corrections)} correction event(s) in period; subtotal withheld until lineage is verified.` });
  } else if (!pvHasValue(d.receipt_reference_covered_value)) {
    const allUnvalued = events !== null && events > 0 && unvalued === events;
    recv = pvCard({
      title: "Bulk received - covered value",
      value: allUnvalued ? "Unvalued" : events === 0 ? "No receipts" : "Unavailable",
      unavailable: true,
      caption: allUnvalued ? `All ${formatIntegerIN(events)} receipt event(s) lack an approved rate.` : events === 0 ? "No bulk receipt events in this period." : "No covered value supplied.",
    });
  } else {
    const partial = rStatus === "PARTIAL_COVERAGE" || (unvalued !== null && unvalued > 0);
    recv = pvCard({
      title: "Bulk received - covered value",
      value: formatCurrencyINR(d.receipt_reference_covered_value),
      badge: partial ? "Partial coverage" : "Covered subtotal",
      caption: `${events === null ? "-" : formatIntegerIN(events)} receipt event(s)${unvalued ? `, ${formatIntegerIN(unvalued)} unvalued and excluded` : ""}. Not full cost or actual expense.`,
    });
  }

  // 3. Completed
  const completed = pvHasValue(d.completed_reference_value)
    ? pvCard({ title: "Completed bulk value", value: formatCurrencyINR(d.completed_reference_value), badge: String(d.completed_status || "").replace(/_/g, " ").toLowerCase(), caption: "Canonical completion events." })
    : pvCard({ title: "Completed bulk value", value: "N/A", unavailable: true, badge: d.completed_status === "NOT_VERIFIED" || !d.completed_status ? "Not verified" : String(d.completed_status).replace(/_/g, " ").toLowerCase(), caption: "No canonical batch-completion event is verified yet." });

  // 4. Transferred FG (Tally book basis; deliberately a separate card style)
  const lines = pvHasValue(d.transfer_line_count) ? Number(d.transfer_line_count) : null;
  const missing = pvHasValue(d.transfer_missing_amount_lines) ? Number(d.transfer_missing_amount_lines) : 0;
  const snap = d.tally_snapshot_as_of ? `Tally snapshot ${formatDateIN(d.tally_snapshot_as_of)}. ` : "";
  const recon = d.transfer_reconciliation_status === "NOT_CHECKED_BY_BOOK_TOTAL"
    ? "Not reconciled to batch log."
    : d.transfer_reconciliation_status ? `Reconciliation: ${String(d.transfer_reconciliation_status).replace(/_/g, " ").toLowerCase()}.` : "";
  const transfer = pvHasValue(d.tally_fg_transfer_book_value)
    ? pvCard({ cls: "book", title: "Transferred to FG - book value", value: formatCurrencyINR(d.tally_fg_transfer_book_value), badge: "Tally book basis", caption: `${lines === null ? "-" : formatIntegerIN(lines)} voucher line(s)${missing ? `, ${formatIntegerIN(missing)} without amount` : ""}. ${snap}${recon}` })
    : pvCard({ cls: "book", title: "Transferred to FG - book value", value: lines === 0 ? "No transfers" : "Unavailable", unavailable: true, badge: "Tally book basis", caption: lines === 0 ? `No Tally transfer lines in period. ${snap}`.trim() : `${snap}No book value supplied.`.trim() });

  return [planned, recv, completed, transfer].join("");
}

function renderProductionValueBody() {
  const body = $("productionValueBody");
  if (!body) return;
  const st = PRODUCTION_VALUE;
  body.setAttribute("aria-busy", st.status === "loading" ? "true" : "false");
  if (st.status === "loading") {
    body.innerHTML = `<div class="pv-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading production values...</div>`;
    return;
  }
  if (st.status !== "ok") {
    const text = {
      denied: "You do not have permission to view production values.",
      expired: "Your session has expired or could not be verified. Sign in again, then retry.",
      invalid: "That report month or cut-off date is not valid for the server.",
      error: "Failed to load production values.",
    }[st.status];
    const detail = st.status === "error" || st.status === "invalid" ? ` ${escapeHtml(st.message)}` : "";
    body.innerHTML = `<div class="pv-state error" role="alert">${escapeHtml(text)}${detail}${
      st.status === "denied" ? "" : ` <button type="button" class="mis-retry-btn" data-mis-retry="production-value">Retry</button>`
    }</div>`;
    return;
  }

  const d = st.data;
  const noRun = d.status === "NO_PREVIOUS_MONTH_APPROVED_COST";
  const comparable = d.comparability === "COMPARABLE" && pvHasValue(d.plan_achievement_pct);
  const policy = d.component_policy
    ? PV_COMPONENT_POLICY_LABELS[d.component_policy] || `Component policy: ${d.component_policy}`
    : "";
  const statusLabel = PV_STATUS_LABELS[d.status] || (d.status ? String(d.status).replace(/_/g, " ").toLowerCase() : "");
  const basis = [
    `Report month <b>${escapeHtml(formatDateIN(d.report_month))}</b>`,
    `Events to <b>${escapeHtml(formatDateIN(d.as_of_date))}</b>`,
    noRun ? "" : `Approved cost run <b>#${escapeHtml(d.approved_cost_run_id ?? "-")}</b> (valued ${escapeHtml(formatDateIN(d.approved_cost_valuation_date))})`,
  ].filter(Boolean).join(" &middot; ");

  body.innerHTML = `
    <div class="pv-basis">${basis}</div>
    <div class="pv-kpi-grid">${buildProductionValueCards(d)}</div>
    <div class="pv-achievement">
      <span class="pv-achievement-label">Plan achievement</span>
      <span class="pv-achievement-value">${comparable ? escapeHtml(formatPercent(d.plan_achievement_pct)) : "N/A"}</span>
      <span class="pv-achievement-note">${comparable ? "Server-confirmed comparable basis." : "Not comparable: no frozen plan or verified completion on the same cost basis. Receipts and Tally book value are never used as a plan percentage."}</span>
    </div>
    <details class="pv-notes">
      <summary>Basis, coverage and exclusions</summary>
      <ul>
        <li>Indicative covered subtotal at approved reference cost; it is not full COP or actual expense.</li>
        ${statusLabel ? `<li>Server status: ${escapeHtml(statusLabel)}.</li>` : ""}
        ${policy ? `<li>${escapeHtml(policy)}</li>` : ""}
        <li>Receipts use legacy physical storage postings; a stored receipt is not a formal batch completion.</li>
        <li>Tally book value is a separate accounting basis and is not comparable with the reference-cost figures.</li>
        <li>The Overview "Transferred to Finished Goods Value" indicator comes from the executive summary snapshot, not from this report; the two sources can differ.</li>
        <li>Planned bulk value and plan achievement stay unavailable until a governed frozen plan exists. Verified completed production is deferred to the Production Work Log; receipts and Tally book value are never presented as completion.</li>
        <li>Physical quantities in Kg, L and Nos are never added together.</li>
      </ul>
    </details>`;
}

function renderProductionValueSection() {
  const opts = productionValueMonthOptions();
  if (!opts.some((o) => o.value === PRODUCTION_VALUE_MONTH)) {
    opts.unshift({ value: PRODUCTION_VALUE_MONTH, label: formatDateIN(PRODUCTION_VALUE_MONTH) });
  }
  return `
    <section class="pv" id="productionValueSection" aria-labelledby="pvHeading">
      <div class="pv-head">
        <h3 class="pv-heading ei-section-title" id="pvHeading">Production value <span class="ei-asof">Selected period</span></h3>
        <div class="pv-controls">
          <label class="pv-field"><span>Month</span>
            <select id="pvMonth" class="pv-input">${opts
              .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === PRODUCTION_VALUE_MONTH ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
              .join("")}</select></label>
          <label class="pv-field"><span>As of</span>
            <select id="pvAsOf" class="pv-input" aria-describedby="pvAsOfStatus">${renderAsOfOptionsHtml()}</select></label>
        </div>
      </div>
      <div class="pv-asof-status" id="pvAsOfStatus" aria-live="polite">${renderAsOfStatusHtml()}</div>
      <div id="productionValueBody" class="pv-body"></div>
    </section>`;
}

// The cutoff is a select of exactly the days allowed for the chosen report month (1..last day, capped at
// today IST). A native date input cannot stop iOS from scrolling to other months, so it is not used. The
// range/ISO guard below stays as a safety net, and the chosen cutoff is also echoed as plain text.
function renderAsOfStatusHtml() {
  const b = productionValueAsOfBounds();
  const range = `${formatDateIN(b.min)} to ${formatDateIN(b.max)}`;
  const chosen = PRODUCTION_VALUE_ASOF
    ? `Cutoff: <b>${escapeHtml(formatDateIN(PRODUCTION_VALUE_ASOF))}</b> <button type="button" class="mis-retry-btn pv-asof-clear" data-pv-asof-clear>Use default</button>`
    : `Cutoff: <b>default</b> (latest allowed, ${escapeHtml(formatDateIN(b.max))})`;
  return `${chosen}<span class="pv-asof-range"> &middot; allowed ${escapeHtml(range)}</span>${
    PRODUCTION_ASOF_NOTICE ? `<div class="pv-asof-notice" role="status">${escapeHtml(PRODUCTION_ASOF_NOTICE)}</div>` : ""
  }`;
}

function refreshAsOfStatus() {
  const el = $("pvAsOfStatus");
  if (el) el.innerHTML = renderAsOfStatusHtml();
}

function applyProductionValueSelection({ monthChanged = false } = {}) {
  const input = $("pvAsOf");
  const b = productionValueAsOfBounds();
  // Month change keeps the stored choice (then range-checks it); a change on the day control takes its value.
  const raw = monthChanged ? PRODUCTION_VALUE_ASOF : input?.value || "";
  let asof = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  PRODUCTION_ASOF_NOTICE = "";
  if (asof && (asof < b.min || asof > b.max)) {
    PRODUCTION_ASOF_NOTICE = monthChanged
      ? `Cutoff ${formatDateIN(asof)} is outside the selected month, so the default cutoff is used.`
      : `Cutoff ${formatDateIN(asof)} is outside ${formatDateIN(b.min)} to ${formatDateIN(b.max)}, so the default cutoff is used.`;
    asof = "";
  }
  PRODUCTION_VALUE_ASOF = asof;
  if (input && (monthChanged || input.value !== asof)) {
    input.innerHTML = renderAsOfOptionsHtml();
    input.value = asof;
  }
  refreshAsOfStatus();
}

function onProductionValueControlChange(ev) {
  const monthChanged = ev?.target?.id === "pvMonth";
  if (monthChanged) {
    const month = $("pvMonth")?.value;
    if (month) PRODUCTION_VALUE_MONTH = month;
  }
  applyProductionValueSelection({ monthChanged });
  // One request per effective selection: skip when month and cutoff are what was last requested.
  if (!monthChanged && `${PRODUCTION_VALUE_MONTH}|${PRODUCTION_VALUE_ASOF}` === PRODUCTION_VALUE_REQUESTED) return;
  loadProductionValue();
}

function clearProductionAsOf() {
  PRODUCTION_VALUE_ASOF = "";
  PRODUCTION_ASOF_NOTICE = "";
  const input = $("pvAsOf");
  if (input) input.value = "";
  refreshAsOfStatus();
  loadProductionValue();
}

function renderProductionCountsBody() {
  const host = $("productionCounts");
  if (!host) return;
  const st = LIVE_PIPELINE;
  host.setAttribute("aria-busy", st.status === "loading" ? "true" : "false");
  if (st.status === "loading" || st.status === "idle") {
    host.innerHTML = `<div class="pv-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading batch counts...</div>`;
    return;
  }
  if (st.status === "error") {
    host.innerHTML = `<div class="pv-state error" role="alert">Failed to load production batch counts. ${escapeHtml(st.message)} <button type="button" class="mis-retry-btn" data-mis-retry="production-counts">Retry</button></div>`;
    return;
  }
  const s = st.data || {};
  const pstage = pipelineBars(s);
  const pover = subsetShare(s.work_in_process_batch_count, s.overdue_work_in_process_batch_count);
  // Counts only, straight from the server. Current state of the live pipeline; not month-bound.
  const cards = [
    { title: "Active Pipeline Batches", value: formatIntegerIN(s.active_pipeline_batch_count) },
    { title: "Work in Process Batches", value: formatIntegerIN(s.work_in_process_batch_count), bar: pstage && { pct: pstage.rows[0].pct, note: "Stage size vs FG bulk and bottled; stages do not overlap" } },
    {
      title: "Overdue WIP Batches",
      value: formatIntegerIN(s.overdue_work_in_process_batch_count),
      state: Number(s.overdue_work_in_process_batch_count) > 0 ? "warning" : "",
      bar: pover && { pct: pover.pct, note: `${pover.pct}% of work in process (a subset, not a stage)` },
    },
    { title: "FG Bulk Batches", value: formatIntegerIN(s.finished_goods_bulk_batch_count), bar: pstage && { pct: pstage.rows[1].pct, note: "Stage size vs the other stages" } },
    { title: "Bottled Stock Batches", value: formatIntegerIN(s.bottled_stock_batch_count), bar: pstage && { pct: pstage.rows[2].pct, note: "Stage size vs the other stages" } },
    { title: "Total Canonical Batches", value: formatIntegerIN(s.total_canonical_batch_count) },
  ];

  host.innerHTML = `
    <div class="production-scope-note">Batches as they stand now${st.asOf ? `, loaded ${escapeHtml(formatDateTimeIN(st.asOf))}` : ""}. The Overview uses this same response. Not tied to the report month selected below.</div>
    <div class="production-summary-grid">
      ${cards
        .map(
          (card) => `
            <div class="production-summary-card ${card.state || ""}">
              <div class="production-summary-title">${escapeHtml(card.title)}</div>
              <div class="production-summary-value">${escapeHtml(card.value)}</div>
              ${card.bar ? dbar(card.bar.pct, card.bar.note) : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Filter drawers: anchored popover on wide screens, full-page sheet on phones (CSS decides). One implementation for all
// lenses: focus moves in on open and back to the trigger on close; Escape closes the topmost layer only.
// ---------------------------------------------------------------------------
const FILTER_LISTS = ["finance", "inventory", "fg"];
const isPhoneSheet = () => !!window.matchMedia?.("(max-width: 640px)").matches;

function filterDrawerOf(p) {
  return { drawer: $(`${p}FilterDrawer`), btn: $(`${p}FilterBtn`) };
}

function openFilterDrawerList() {
  return FILTER_LISTS.find((p) => filterDrawerOf(p).drawer?.classList.contains("open")) || "";
}

function closeFilterDrawer(p, { restoreFocus = false } = {}) {
  const { drawer, btn } = filterDrawerOf(p);
  if (!drawer || !btn) return;
  const hadFocus = drawer.contains(document.activeElement);
  drawer.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
  if (!openFilterDrawerList()) document.body.classList.remove("ei-sheet-open");
  if (restoreFocus || hadFocus) btn.focus();
  if (p === "finance") financeFilterDraft = null;
}

function closeAllFilterDrawers(exceptP = "") {
  FILTER_LISTS.forEach((p) => {
    if (p !== exceptP) closeFilterDrawer(p);
  });
}

function openFilterDrawer(p) {
  const { drawer, btn } = filterDrawerOf(p);
  if (!drawer || !btn) return;
  closeAllFilterDrawers(p);
  drawer.classList.add("open");
  if (p === "finance") {
    financeFilterDraft = { ...financeClass };
    showFinanceClassFields();
  }
  btn.setAttribute("aria-expanded", "true");
  const sheet = isPhoneSheet();
  drawer.setAttribute("aria-modal", sheet ? "true" : "false");
  document.body.classList.toggle("ei-sheet-open", sheet);
  (drawer.querySelector('input[type="radio"]:checked:not(:disabled)') || drawer.querySelector("input:not(:disabled)") || drawer.querySelector("button"))?.focus?.();
}

function toggleFilterDrawer(p) {
  const { drawer } = filterDrawerOf(p);
  if (!drawer) return;
  if (drawer.classList.contains("open")) closeFilterDrawer(p, { restoreFocus: true });
  else openFilterDrawer(p);
}

const DEBOUNCED_SEARCH = Object.fromEntries(
  Object.keys(LISTS).map((p) => [p, debounce((value) => setListSearch(p, value), 250)]),
);

function isFinanceModalOpen() {
  return !!financeModalOverlay && !financeModalOverlay.classList.contains("hidden");
}

async function showFinanceClassFields(focus) {
  const host = $("financeClassFields");
  if (!host || !financeFilterDraft) return;
  if (!financeLookups) {
    host.textContent = "Loading classification filters…";
    try { financeLookups = await readDebtorRpc("ei_debtor_lookups"); }
    catch (error) {
      if (host.isConnected) host.innerHTML = `<p role="alert">${escapeHtml(debtorError(error))}</p><button class="ei-ctl" type="button" data-act="finance-class-retry">Retry</button>`;
      return;
    }
    if (!host.isConnected || !financeFilterDraft) return;
  }
  const draft = financeFilterDraft;
  host.innerHTML = `<fieldset class="ei-kyc-grid"><legend>Debtor classification</legend>
    <label>Partition<select name="partition" aria-label="Partition">${["all", "classified", "unclassified"].map((key) => `<option ${draft.partition === key ? "selected" : ""}>${key}</option>`).join("")}</select></label>
    ${classificationFields(escapeHtml, financeLookups, draft, { disabled: draft.partition === "unclassified", keepInactive: true })}
    <button class="ei-ctl" type="button" data-act="finance-class-apply">Apply classification</button></fieldset>`;
  if (focus) host.querySelector(`[name="${focus}"]`)?.focus();
}

function applyFinanceClassification() {
  if (!financeFilterDraft) return;
  financeClass = financeFilterDraft;
  if (financeClassActive()) LISTS.finance.st.filter = "receivables";
  closeFilterDrawer("finance", { restoreFocus: true });
  renderListToolbar("finance");
  $("financeFilterBtn")?.focus();
  if (AGE.on || financeClassActive()) loadAgeingSummary();
  else { beginRequest("finance:age-sum"); renderFinanceAgeing(); }
  loadList("finance");
}

const billScope = (row) => ({
  p_group_filter: row ? (row.mis_group_name.includes("Debtors") ? "receivables" : "payables") : financeGroupScope(),
  p_party: row?.party_name ?? null,
  ...(AGE.on ? ageArgs() : {}),
  ...financeClassArgs(),
});

async function exportFinanceBills(button, row) {
  button.disabled = true;
  const status = row ? $("financeBillStatus") : $("financeExportStatus");
  if (status) status.textContent = "Preparing export…";
  try {
    const scope = billScope(row);
    const search = row ? "" : LISTS.finance.st.search;
    const { rows: bills, date } = await collectBillPages(readDebtorRpc, scope);
    const query = search.toLocaleLowerCase("en-IN");
    const rows = query ? bills.filter((bill) => [bill.party_name, bill.mis_group_name].some((value) =>
      String(value ?? "").toLocaleLowerCase("en-IN").includes(query))) : bills;
    if (!rows.length) { if (status) status.textContent = "No bills in this scope."; return; }
    const columns = [
      ["Group", "mis_group_name"], ["Party", "party_name"], ["Bill date", "bill_date_text"], ["Bill reference", "bill_ref"],
      ["Age (days)", "age_days"], ["Bucket index", "bucket_no"], ["Tally signed", "outstanding_amount_tally_value"],
      ["Company oriented", "company_amount"], ["Party oriented", "party_amount"],
    ].map(([label, key]) => ({ label, get: (bill) => bill[key] }));
    const filters = CLASS_DIMENSIONS.filter(([key]) => scope[`p_${key}`]).map(([key, label, list, name]) => {
      const id = scope[`p_${key}`];
      return `${label} ${financeLookups?.[list]?.find((item) => item.id === id)?.[name] ?? id}`;
    });
    const description = [scope.p_party, search && `Search ${search}`, scope.p_partition, ...filters, scope.p_as_of && `Ageing as of ${scope.p_as_of}`, (scope.p_age_min != null || scope.p_age_max != null) && `Age ${scope.p_age_min ?? "any"} to ${scope.p_age_max ?? "any"} days plus undated`].filter(Boolean).join(" · ");
    downloadCsv("finance-outstanding-bills.csv", buildPageCsv(columns, rows, `Snapshot ${date} · ${scope.p_group_filter} · ${rows.length} bills${description ? ` · ${description}` : ""}`));
    if (status) status.textContent = "Export ready.";
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : debtorError(error);
  } finally { button.disabled = false; }
}

function financeBillBands(row, labels) {
  if (!Array.isArray(row.bucket_amounts) || row.bucket_amounts.length !== labels.length) return "";
  const amounts = row.bucket_amounts.map(Number);
  const counts = row.bucket_bill_counts || [];
  const positive = amounts.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const undatedCount = Number(row.bill_count) - counts.reduce((sum, count) => sum + Number(count), 0);
  const chip = (label, value, count, css, share = "–") => `<li class="${css}"><span class="fin-chip-lab">${escapeHtml(label)}</span><span class="fin-chip-share">${share}</span><b>${escapeHtml(formatCurrencyINR(value))}</b><span class="fin-chip-n">${escapeHtml(formatIntegerIN(count))} ${Number(count) === 1 ? "bill" : "bills"}</span></li>`;
  const bands = labels.map((label, index) => chip(label + " days", amounts[index], counts[index], ageBandClass(index, labels.length),
    positive && amounts[index] > 0 ? `${Math.round(amounts[index] / positive * 1000) / 10}%` : "–"));
  if (undatedCount > 0) bands.push(chip("No usable date", row.undated_amount, undatedCount, "fin-age-chip-undated"));
  return `<ul class="fin-age-chips" aria-label="Bands for this party">${bands.join("")}</ul>`;
}

function openFinancePartyDetails(row) {
  if (!ACCESS.executive) return;
  if (!financeModalContent) return;
  stopBillMore?.();
  const token = beginRequest("finance:modal");
  if (!isFinanceModalOpen()) FINANCE_LAST_FOCUS = document.activeElement;
  setTimeout(() => { if (isFinanceModalOpen()) document.body.classList.add("ei-sheet-open"); }, 0);
  const about = $("financeModalAbout");
  if (about) about.open = !window.matchMedia?.("(max-width: 640px)").matches;
  $("financeModalAboutExtra").textContent = AGE.on ? `Aged from the bill date to ${formatDateIN(ageAsOf())}. Bills with no usable date remain in the selected range.` : "";
  financeModalOverlay.classList.remove("hidden");
  financeModalOverlay.setAttribute("aria-hidden", "false");
  financeModalTitle.textContent = row.party_name || "—";
  financeModalSubtitle.textContent = `${row.mis_group_name || "—"} | ${formatCurrencyINR(row.outstanding_amount_mis_value)}${AGE.on ? ` | aged as of ${formatDateIN(ageAsOf())}` : ""}`;
  const aged = AGE.on;
  const labels = ageLabels(AGE.bounds);
  const scope = billScope(row);
  financeModalContent.innerHTML = `<div class="ei-kyc-actions"><button type="button" class="ei-ctl" id="financeBillExport">Export bills</button><span id="financeBillStatus" role="status"></span></div>
    <p id="financeBillTotals"></p><div id="financeBillBands">${aged ? financeBillBands(row, labels) : ""}</div>
    <div class="finance-table-wrap fin-bill-table"><table class="finance-table finance-modal-table ${aged ? "is-aged" : "is-plain"}">
    <colgroup><col class="fm-date"><col class="fm-ref">${aged ? '<col class="fm-age"><col class="fm-band">' : ""}<col class="fm-amt"><col class="fm-amt"></colgroup>
    <thead><tr>${th("Bill date")}${th("Bill ref")}${aged ? th("Age (days)", true) + th("Band") : ""}${th("Tally Signed Amount", true)}${th(aged ? "Party Amount" : "Line Absolute Amount", true)}</tr></thead><tbody></tbody></table></div>
    <ul class="fin-bill-cards" aria-label="Outstanding bills"></ul><div id="financeBillMore" role="status"></div>`;
  $("financeBillExport").onclick = (event) => exportFinanceBills(event.currentTarget, row);
  const status = $("financeBillMore");
  const tbody = financeModalContent.querySelector("tbody");
  const cards = financeModalContent.querySelector("ul");
  const observed = new Set();
  let offset = 0, total = Infinity, date, busy = false, retries = 0;
  const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !status.querySelector("button")) next(); });
  stopBillMore = () => observer.disconnect();
  const next = async () => {
    if (busy || offset >= total || !isLatestRequest("finance:modal", token)) return;
    busy = true;
    status.textContent = "Loading bills…";
    try {
      const page = await readDebtorRpc("get_mis_finance_bill_page", { ...scope, p_limit: 100, p_offset: offset });
      if (!isLatestRequest("finance:modal", token)) return;
      const pageDate = page.rows[0]?.report_date;
      if (offset && (pageDate !== date || Number(page.total_rows) !== total || page.rows.some((bill) => observed.has(bill.bill_id)))) {
        if (++retries > 2) throw new Error("The outstanding snapshot is changing. Retry.");
        offset = 0; total = Infinity; date = null;
        observed.clear(); tbody.replaceChildren(); cards.replaceChildren(); $("financeBillBands").replaceChildren();
        busy = false;
        return next();
      }
      if (!offset) {
        date = pageDate;
        total = Number(page.total_rows);
        $("financeBillTotals").textContent = page.groups.map((group) => `${group.bill_count} bills · party total ${formatCurrencyINR(group.party_amount)} · company-oriented total ${formatCurrencyINR(group.company_amount)}`).join(" · ");
      }
      for (const bill of page.rows) {
        if (observed.has(bill.bill_id)) continue;
        observed.add(bill.bill_id);
        const age = bill.age_days ?? "—";
        const band = bill.bucket_no == null ? "No usable date" : labels[bill.bucket_no] ?? "—";
        const signed = escapeHtml(formatCurrencyINR(bill.outstanding_amount_tally_value));
        const amount = escapeHtml(formatCurrencyINR(aged ? bill.party_amount : bill.outstanding_amount_abs_line_value));
        const ref = escapeHtml(bill.bill_ref || "—");
        const billDate = escapeHtml(bill.bill_date_text || "—");
        tbody.insertAdjacentHTML("beforeend", `<tr><td>${billDate}</td><td>${ref}</td>${aged ? `<td class="num">${escapeHtml(age)}</td><td>${escapeHtml(band)}</td>` : ""}<td class="num">${signed}</td><td class="num">${amount}</td></tr>`);
        cards.insertAdjacentHTML("beforeend", `<li class="fin-bill-card"><div class="fin-bill-top"><b>${ref}</b><span>${aged ? amount : signed}</span></div><div class="fin-bill-sub"><span>${billDate}</span>${aged ? `<span>${escapeHtml(age)} · ${escapeHtml(band)}</span>` : ""}</div><div class="fin-bill-line"><span>${aged ? "Tally signed" : "Line absolute amount"}</span><span>${aged ? signed : amount}</span></div></li>`);
      }
      offset += page.rows.length;
      status.textContent = total ? `${offset} of ${total} bills` : "No bills in this scope.";
      if (offset >= total) observer.disconnect();
      else { observer.unobserve(status); observer.observe(status); }
    } catch (error) {
      if (!isLatestRequest("finance:modal", token)) return;
      retries = 0;
      status.innerHTML = `${escapeHtml(debtorError(error))} <button type="button" class="ei-ctl">Retry</button>`;
      status.querySelector("button").onclick = next;
    } finally { busy = false; }
  };
  observer.observe(status);
  financeModalClose?.focus();
  next();
}

function closeFinanceModal() {
  if (!financeModalOverlay || !isFinanceModalOpen()) return;
  beginRequest("finance:modal");
  stopBillMore?.();
  if (financeModalOverlay.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  financeModalOverlay.classList.add("hidden");
  financeModalOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("ei-sheet-open");
  if (financeModalContent) financeModalContent.innerHTML = "";
  if (FINANCE_LAST_FOCUS && document.contains(FINANCE_LAST_FOCUS)) {
    FINANCE_LAST_FOCUS.focus?.();
  } else {
    // The table may have been re-rendered while the modal was open.
    ($("financeSearch") || tabPanel)?.focus?.();
  }
  FINANCE_LAST_FOCUS = null;
}

function focusLensPanel() {
  if (!tabPanel) return;
  tabPanel.setAttribute("tabindex", "-1");
  tabPanel.focus({ preventScroll: false });
}

function trapTab(container, ev) {
  const focusable = [
    ...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!container.contains(document.activeElement)) {
    ev.preventDefault();
    first.focus();
  } else if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault();
    first.focus();
  }
}

function wireEvents() {
  // Sales-only users never request executive data; refresh just reloads their lens.
  refreshBtn?.addEventListener("click", () => (ACCESS.executive ? loadExecutiveSummary() : loadActiveTab()));
  // Same lifecycle as Stock Checker: shared glyph/label/a11y via mountModuleHome, then Platform.goHome (PWA and Electron).
  const homeBtn = $("homeBtn");
  if (homeBtn) {
    mountModuleHome(homeBtn);
    homeBtn.addEventListener("click", () => Platform.goHome());
  }
  const freshIcon = lastRefreshed?.querySelector(".ei-fresh-icon");
  if (freshIcon) freshIcon.innerHTML = iconHtml("database", 16); // shared glyph; shown (icon only) at <=520px
  detailTabs?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".pill");
    if (!btn) return;
    selectTab(btn.getAttribute("data-tab"));
  });
  // Roving tabindex: arrows move focus between lens tabs; Enter/Space (native button) selects.
  detailTabs?.addEventListener("keydown", (ev) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(ev.key)) return;
    const tabs = [...detailTabs.querySelectorAll(".pill")];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    ev.preventDefault();
    const next = ev.key === "Home" ? 0 : ev.key === "End" ? tabs.length - 1 : (i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs.forEach((t, k) => t.setAttribute("tabindex", k === next ? "0" : "-1"));
    tabs[next].focus();
  });
  detailTabSelect?.addEventListener("change", () => {
    selectTab(detailTabSelect.value);
  });
  window.addEventListener("hashchange", () => {
    if (isKycRoute(window.location.hash) && ACCESS.executive) return navigateFinance(window.location.hash, { push: false });
    const next = lensFromHash(window.location.hash);
    if (KYC_HASH && next === "finance" && ACCESS.executive) return navigateFinance("", { push: false });
    if (next !== ACTIVE_TAB && visibleLenses().some((l) => l.id === next)) selectTab(next);
    else if (next !== ACTIVE_TAB) renderDetailTabs();
  });
  tabPanel?.addEventListener("change", (ev) => {
    if (ACTIVE_TAB === "sales" && /^sales(Anchor|Region|Godown|Active|FacMonths|Hier-(category|subcategory|group|subgroup)|Hist(Group|Months))$/.test(ev.target?.id || "")) {
      handleSalesChange(ev);
      return;
    }
    if (ACTIVE_TAB === "sales" && ev.target?.name === "salesSort") {
      const v = ev.target.value;
      if (HISTORY_SORTS.some((o) => o.value === v) && v !== SX.hist.sort) { SX.hist.sort = v; SX.hist.page = 1; sxFetch("hist"); }
      setSalesSortOpen(false, { restoreFocus: true });
      return;
    }
    if (ev.target.id === "pvMonth" || ev.target.id === "pvAsOf") {
      onProductionValueControlChange(ev);
      return;
    }
      if (ev.target.closest("#financeClassFields") && financeFilterDraft) {
      const { name, value } = ev.target;
      financeFilterDraft = name === "partition"
        ? value === "unclassified" ? { partition: value } : { ...financeFilterDraft, partition: value }
        : changeClassification(financeFilterDraft, name, value);
      showFinanceClassFields(name);
      return;
    }
    const m = /^(finance|inventory|fg)Filter$/.exec(ev.target?.name || "");
    if (m) setListFilter(m[1], ev.target.value);
  });
  tabPanel?.addEventListener("click", (ev) => {
    if (ACTIVE_TAB === "sales" && handleSalesClick(ev)) return;
    if (ev.target.closest("[data-pv-asof-clear]")) {
      clearProductionAsOf();
      return;
    }
    const retryBtn = ev.target.closest("[data-mis-retry]");
    if (retryBtn) {
      const retryKey = retryBtn.getAttribute("data-mis-retry");
      if (retryKey === "production-value") loadProductionValue();
      else if (retryKey === "production-counts") loadProductionCounts({ force: true });
      else if (retryKey === "summary") loadExecutiveSummary({ reloadLens: false });
      else loadActiveTab();
      return;
    }
    const link = ev.target.closest("[data-lens-link]");
    if (link) {
      ev.preventDefault();
      selectTab(link.getAttribute("data-lens-link"));
      focusLensPanel();
      return;
    }
    const kpiBtn = ev.target.closest(".kpi-info-btn");
    if (kpiBtn) {
      ev.stopPropagation();
      openKpiPopover(kpiBtn);
      return;
    }
    const act = ev.target.closest("[data-act]");
    if (!act) return;
    const p = act.getAttribute("data-list");
    switch (act.getAttribute("data-act")) {
      case "open-kyc": ev.preventDefault(); navigateFinance(act.dataset.route === "unclassified" ? INCOMPLETE_KYC_ROUTE : KYC_ROUTE); break;
      case "finance-class-retry": showFinanceClassFields(); break;
      case "finance-class-apply": applyFinanceClassification(); break;
      case "bill-export": exportFinanceBills(act); break;
      case "filter-toggle":
        ev.stopPropagation();
        toggleFilterDrawer(p);
        break;
      case "drawer-close":
        closeFilterDrawer(p, { restoreFocus: true });
        break;
      case "search-clear":
        clearListSearch(p);
        break;
      case "age-toggle":
        ev.stopPropagation();
        if (AGE_DLG) closeAgeingDialog(); else openAgeingDialog();
        break;
      case "age-retry": loadAgeingSummary(); break;
      case "age-detail": openAgeBreakdown(act.getAttribute("data-group")); break;
      default:
    }
  });
  tabPanel?.addEventListener("input", (ev) => {
    if (ev.target?.id === "salesHistSearch") return debouncedSalesHistSearch(ev.target.value);
    if (ev.target?.id === "salesExcSearch") return debouncedSalesExcSearch(ev.target.value);
    const m = /^(finance|sales|inventory|fg)Search$/.exec(ev.target?.id || "");
    if (!m) return;
    const clearBtn = $(`${m[1]}SearchClear`);
    if (clearBtn) clearBtn.style.display = ev.target.value ? "" : "none";
    DEBOUNCED_SEARCH[m[1]](ev.target.value);
  });
  // R8.11: on pointer devices an info popover lives only while the pointer is on the icon or the popover, or the icon holds keyboard focus;
  // leaving or blurring closes it (Escape too). On touch (no hover) a tap pins it until an outside tap, as before.
  const canHover = () => !!window.matchMedia?.("(hover: hover)").matches;
  let popoverLeaveTimer = null;
  const maybeCloseHoverPopover = () => {
    clearTimeout(popoverLeaveTimer);
    popoverLeaveTimer = setTimeout(() => {
      if (!ACTIVE_POPOVER || !canHover()) return;
      if (ACTIVE_INFO_BUTTON?.matches(":hover") || ACTIVE_POPOVER.matches(":hover")) return;
      closeKpiPopover();
    }, 140);
  };
  tabPanel?.addEventListener("mouseout", (ev) => { if (ev.target.closest?.(".kpi-info-btn")) maybeCloseHoverPopover(); });
  document.addEventListener("mouseout", (ev) => { if (ACTIVE_POPOVER && ev.target.closest?.(".kpi-popover")) maybeCloseHoverPopover(); });
  tabPanel?.addEventListener("focusout", (ev) => {
    if (!ACTIVE_POPOVER || !ev.target.closest?.(".kpi-info-btn")) return;
    if (ACTIVE_POPOVER.contains(ev.relatedTarget)) return;
    if (canHover() && ACTIVE_INFO_BUTTON?.matches(":hover")) return; // the pointer is still on the icon: mouseout will close it
    closeKpiPopover();
  });
  tabPanel?.addEventListener("mouseover", (ev) => {
    if (!window.matchMedia?.("(hover: hover)").matches) return;
    const btn = ev.target.closest?.(".kpi-info-btn");
    if (!btn) return;
    clearTimeout(popoverLeaveTimer);
    openKpiPopover(btn, false);
  });
  lastRefreshed?.addEventListener("click", (ev) => { ev.stopPropagation(); toggleFreshPanel(); });
  document.addEventListener("click", (ev) => { if (FRESH_PANEL && !FRESH_PANEL.contains(ev.target) && !lastRefreshed.contains(ev.target)) closeFreshPanel(); });
  document.addEventListener("click", (ev) => {
    // Sales filter and sort popovers: an outside click closes them (the phone sheets cover the page, so this only matters on desktop).
    // composedPath() is captured at dispatch, so a control that re-rendered itself while handling this click still counts as inside.
    const path = ev.composedPath ? ev.composedPath() : [];
    if (SX.filtersOpen && !path.includes($("salesFilters"))) setSalesFiltersOpen(false);
    if (SX.sortOpen && !path.includes($("salesSortHost"))) setSalesSortOpen(false);
  });
  document.addEventListener("click", (ev) => {
    // Desktop: a click outside an open filter popover closes it. (The phone sheet covers the page.)
    FILTER_LISTS.forEach((p) => {
      const wrap = $(`${p}FilterWrapper`);
      if (wrap && !wrap.contains(ev.target)) closeFilterDrawer(p);
    });
    if (!ACTIVE_POPOVER) return;
    if (ACTIVE_POPOVER.contains(ev.target)) return;
    if (ACTIVE_INFO_BUTTON && ACTIVE_INFO_BUTTON.contains(ev.target)) return;
    closeKpiPopover();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab") {
      if (FRESH_PANEL) { if (!FRESH_PANEL.contains(document.activeElement) && document.activeElement !== lastRefreshed) closeFreshPanel(); return; }
      if (isFinanceModalOpen()) {
        trapTab(financeModalOverlay, ev);
        return;
      }
      if (SX.filtersOpen && $("salesFilterFields") && isPhoneFilters()) { trapTab($("salesFilterFields"), ev); return; }
      if (SX.sortOpen && $("salesSortPanel") && isPhoneFilters()) { trapTab($("salesSortPanel"), ev); return; }
      const open = openFilterDrawerList();
      if (open && isPhoneSheet()) trapTab(filterDrawerOf(open).drawer, ev);
      return;
    }
    if (ev.key !== "Escape") return;
    if (AGE_BRK) { closeAgeBreakdown(); return; }
    if (AGE_DLG) { closeAgeingDialog(); return; }
    if (FRESH_PANEL) { closeFreshPanel({ restoreFocus: true }); return; }
    // Escape closes the topmost layer only: bill-detail modal, then a filter drawer/sheet, then an info popover.
    if (isFinanceModalOpen()) {
      closeFinanceModal();
      return;
    }
    if (SX.sortOpen) { setSalesSortOpen(false, { restoreFocus: true }); return; }
    if (SX.filtersOpen) {
      setSalesFiltersOpen(false, { restoreFocus: true });
      return;
    }
    const open = openFilterDrawerList();
    if (open) {
      closeFilterDrawer(open, { restoreFocus: true });
      return;
    }
    closeKpiPopover();
  });
  financeModalClose?.addEventListener("click", closeFinanceModal);
  financeModalOverlay?.addEventListener("click", (ev) => {
    if (ev.target === financeModalOverlay) closeFinanceModal();
  });
  window.addEventListener("resize", closeKpiPopover);
  window.addEventListener("resize", positionFreshPanel);
  window.addEventListener("scroll", (ev) => { if (FRESH_PANEL && !FRESH_PANEL.contains(ev.target)) closeFreshPanel(); }, { passive: true, capture: true });
  window.addEventListener("resize", () => document.body.classList.toggle("ei-sheet-lock", (SX.filtersOpen || SX.sortOpen) && isPhoneFilters()));
  window.addEventListener("scroll", closeKpiPopover, { passive: true });
  setInterval(updateFreshnessIndicator, 60000);
}

function debounce(fn, wait) {
  let timer = null;
  const debounced = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

// A debounced search typed just before a tab switch must not fire into the
// next panel; the rebuilt toolbar renders from committed state anyway.
function cancelPendingSearches() {
  Object.values(DEBOUNCED_SEARCH).forEach((d) => d.cancel());
  debouncedSalesHistSearch.cancel();
  debouncedSalesExcSearch.cancel();
}

(async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    if (Platform.isElectron) window.location.href = "/login.html";
    else Platform.goHome();
    return;
  }

  const permission = await loadPermissions(session.user.id);

  // Capability discovery for users without the executive permission: only an explicit ei_sales_access {sales:true} opens the
  // Sales lens, and only that lens. Any error, null or malformed answer fails closed to the denied state.
  ACCESS = PERM_CAN_VIEW ? { state: "executive", executive: true, sales: true } : { state: "denied", executive: false, sales: false };
  if (!PERM_CAN_VIEW) {
    const r = await settle(supabase.rpc("ei_sales_access"));
    ACCESS = salesAccessFromResponse(r.data, r.error);
    if (ACCESS.executive) PERM_CAN_VIEW = true; // the server is authoritative when the permission lookup itself failed
  }

  if (!ACCESS.sales) {
    // Deny by default. Access is decided server-side; the client only reflects the result and never loads module data without it.
    document.body.classList.add("mis-denied");
    setStatus(
      permission === "error"
        ? "Could not verify your access to this module. Please refresh the page or try again shortly."
        : "You do not have permission to view this module.",
      "error",
    );
    return;
  }

  wireEvents();
  if (ACCESS.state === "sales-only") {
    // No executive navigation, no executive requests: only the Sales lens, loaded directly.
    document.body.classList.add("ei-sales-only");
    updateFreshnessIndicator();
    clearStatus(); // the executive summary load normally clears the initial "Loading..." line; a sales-only session never runs it
    ACTIVE_TAB = "sales";
    renderDetailTabs();
    await loadActiveTab();
    return;
  }
  renderDetailTabs();
  updateFreshnessIndicator();
  await loadExecutiveSummary();
})();
