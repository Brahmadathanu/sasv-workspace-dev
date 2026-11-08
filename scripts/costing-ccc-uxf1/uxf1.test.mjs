// UX-F1: CCC dashboard-first run context, compact header chip, KPI caption and
// compact review worklist (flag COSTING_REVIEW_WORKLIST_V1, default OFF).
// node:test only, no deps, no network. Rows are FIXTURES shaped like the
// server views; nothing asserts live data.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { costingScopeReport, applyCw07Labels } from "../lib/costing-scope-guard.mjs";
import * as ccc from "../../public/shared/js/costing-ccc-run-context.js";
import * as worklist from "../../public/shared/js/costing-review-worklist.js";
import { applyCompactRunStatusBadge, createRunStatusBadge, describeRunStatus } from "../../public/shared/js/costing-run-status-badge.js";
import { readSourceLf } from "../lib/read-source-lf.mjs";
import { stripN2 } from "../lib/n2-nav-strip.mjs";
import { stripW6 } from "../lib/w6-nav-strip.mjs";
import { stripU11 } from "../lib/u11-label-strip.mjs";
import { stripSecA2 } from "../lib/sec-a2-strip.mjs";

const {
  createLatestOnlyLoader,
  describeCompactRunBadge,
  describeDashboardRunContext,
  describeKpiRunCaption,
  renderCompactRunBadgeHtml,
  renderDashboardRunContextHtml,
  renderKpiRunCaptionHtml,
  summariseRunRows,
} = ccc;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readSourceLf(root, rel); // LF-normalised: see scripts/lib/read-source-lf.mjs
const BASE = "9c189d60967c2efd3b99f4703416eb22123d96e2";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const readBase = (rel) => applyCw07Labels(git("show", `${BASE}:${rel}`)); // CW-07: label rename tolerated, nothing else
const SHELL = "public/shared/js/costing-suite-shell.js";
const OCT = "2026-10-01";
const SEP = "2026-09-01";
const flush = () => new Promise((r) => setImmediate(r));

const STATUS_OCT = Object.freeze({
  period_start: OCT,
  display_state: "APPROVED_NEWER_DRAFT",
  display_label: "Approved run 143 (newer DRAFT run 148 - not approved)",
  displayed_run_id: 143,
  approved_run_id: 143,
  approved_at: "2026-10-22T10:00:00+05:30",
  approved_by: "owner",
  newer_draft_run_id: 148,
  active_run_id: null,
  active_run_status: null,
});
const STATUS_SEP = Object.freeze({ period_start: SEP, display_state: "APPROVED", display_label: "Approved run 122", displayed_run_id: 122, approved_run_id: 122, newer_draft_run_id: null, active_run_id: null, active_run_status: null });
const SUMMARY_143 = Object.freeze({ period_start: OCT, refresh_run_id: 143, valuation_date: "2026-10-31", total_sku_count: 627, ready_sku_count: 627, review_required_sku_count: 0, blocked_sku_count: 0 });
const SUMMARY_122 = Object.freeze({ period_start: SEP, refresh_run_id: 122, valuation_date: "2026-09-30", total_sku_count: 600, ready_sku_count: 598, review_required_sku_count: 2, blocked_sku_count: 0 });
function draftRows(runId = 148, period = OCT) {
  const rows = [];
  const add = (n, sev) => {
    for (let i = 0; i < n; i += 1) rows.push({ period_start: period, refresh_run_id: runId, valuation_date: "2026-10-31", control_severity: sev, sku_id: rows.length + 1 });
  };
  add(1, "BLOCKER");
  add(113, "REVIEW_REQUIRED");
  add(514, "READY");
  return rows;
}

// 1. Compact header chip
test("compact badge: short labels from server state; newer draft indicated; escaped", () => {
  assert.deepEqual({ ...describeCompactRunBadge(STATUS_OCT) }, { text: "Approved 143", draftText: "Draft 148", newerDraftRunId: "148" });
  assert.deepEqual({ ...describeCompactRunBadge(STATUS_SEP) }, { text: "Approved 122", draftText: null, newerDraftRunId: null });
  assert.equal(describeCompactRunBadge({ display_state: "DRAFT", displayed_run_id: 150 }).text, "Draft 150");
  assert.equal(describeCompactRunBadge({ display_state: "REFERENCE_NOT_APPROVED", displayed_run_id: 90 }).text, "Reference 90");
  assert.equal(describeCompactRunBadge({ display_state: "NO_SUCCESSFUL_RUN" }).text, "No run");
  assert.equal(describeCompactRunBadge(null).text, "Status unavailable");
  assert.equal(
    renderCompactRunBadgeHtml(describeCompactRunBadge(STATUS_OCT)),
    '<span class="sc-run-status-main">Approved 143</span><span class="sc-run-status-draft" aria-hidden="true">Draft 148</span>',
  );
  assert.doesNotMatch(renderCompactRunBadgeHtml(describeCompactRunBadge({ display_state: "DRAFT", displayed_run_id: "<b>1</b>" })), /<b>/);
});

function fakeEl() {
  return {
    hidden: true, textContent: "", innerHTML: "", title: "", attrs: {}, dataset: {},
    setAttribute(k, v) { this.attrs[k] = v; },
  };
}
async function badgeWith({ flagOn, row }) {
  const store = new Map([["COSTING_REVIEW_WORKLIST_V1", flagOn ? "1" : null]]);
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null };
  const el = fakeEl();
  const doc = { createElement: () => el };
  const anchor = { insertAdjacentElement() {} };
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) };
  try {
    const b = createRunStatusBadge({ supabase, anchor, doc });
    await b.refresh({ periodStart: OCT, lensId: "sku-control-status" });
  } finally {
    globalThis.localStorage = prev;
  }
  return el;
}

test("header badge: flag OFF keeps the long server label exactly; flag ON shows the compact chip with full text in title/aria", async () => {
  const off = await badgeWith({ flagOn: false, row: STATUS_OCT });
  const long = describeRunStatus(STATUS_OCT);
  assert.equal(off.textContent, long.text);
  assert.equal(off.textContent, "Approved run 143 (newer DRAFT run 148 - not approved)");
  assert.equal(off.title, long.title);
  assert.equal(off.dataset.compact, undefined);
  assert.equal(off.innerHTML, "");
  const on = await badgeWith({ flagOn: true, row: STATUS_OCT });
  assert.equal(on.innerHTML, '<span class="sc-run-status-main">Approved 143</span><span class="sc-run-status-draft" aria-hidden="true">Draft 148</span>');
  assert.equal(on.title, long.title, "full explanation preserved");
  assert.equal(on.attrs["aria-label"], long.title);
  assert.match(on.title, /Approved run 143 \(newer DRAFT run 148 - not approved\)/);
  assert.equal(on.dataset.compact, "1");
  assert.equal(on.dataset.newerDraft, "148");
  assert.equal(on.dataset.tone, "approved-pending");
  assert.equal(on.hidden, false);
  // A later status without a newer draft clears the marker.
  applyCompactRunStatusBadge(on, describeCompactRunBadge(STATUS_SEP), describeRunStatus(STATUS_SEP));
  assert.equal(on.dataset.newerDraft, undefined);
});

test("badge module: flag-OFF code path is unchanged from main (only additions plus the flag import)", () => {
  const diff = git("diff", "-U0", BASE, "--", "public/shared/js/costing-run-status-badge.js").split("\n");
  const removed = diff.filter((l) => l.startsWith("-") && !l.startsWith("---"));
  assert.deepEqual(removed, ['-import { isCostingApprovalScreenV1Enabled, isCostingRecalcWithDateV1Enabled, isCostingUxConsistencyV1Enabled } from "./costing-feature-flags.js";']);
  const src = read("public/shared/js/costing-run-status-badge.js");
  assert.ok(src.includes("      if (isCostingReviewWorklistV1Enabled()) {\n        applyCompactRunStatusBadge(node, describeCompactRunBadge(row), info);\n        return;\n      }\n      applyRunStatusBadge(node, info, true);"));
  for (const fn of ["describeRunStatus", "applyRunStatusBadge", "formatIst"]) {
    const grab = (s) => s.slice(s.indexOf(`export function ${fn}(`), s.indexOf("\n}\n", s.indexOf(`export function ${fn}(`)));
    assert.equal(grab(src), grab(readBase("public/shared/js/costing-run-status-badge.js")), fn);
  }
});

// 2. KPI caption
test("KPI caption names the strip's own run; warns when the worklist shows another run", () => {
  const c = describeKpiRunCaption({ summary: SUMMARY_143, statusRow: STATUS_OCT });
  assert.equal(c.text, "KPIs: approved run 143 · valuation 2026-10-31");
  assert.equal(c.otherRunWarning, null);
  const w = describeKpiRunCaption({ summary: SUMMARY_143, statusRow: STATUS_OCT, worklistRunId: "148" });
  assert.equal(w.otherRunWarning, "The worklist below shows run 148; these KPIs are not from it.");
  assert.equal(describeKpiRunCaption({ summary: SUMMARY_143 }).text, "KPIs: run 143 · valuation 2026-10-31");
  assert.equal(describeKpiRunCaption({ summary: { ...SUMMARY_143, refresh_run_id: 150 }, statusRow: { approved_run_id: null } }).text, "KPIs: run 150 (not approved) · valuation 2026-10-31");
  assert.equal(describeKpiRunCaption({ summary: null }), null);
  assert.equal(describeKpiRunCaption({ summary: SUMMARY_143, worklistRunId: "143" }).otherRunWarning, null);
  const html = renderKpiRunCaptionHtml(w);
  assert.equal(html, '<span class="ccc-kpi-caption-run">KPIs: approved run 143 · valuation 2026-10-31</span><span class="ccc-kpi-caption-warn" role="note">The worklist below shows run 148; these KPIs are not from it.</span>');
  assert.doesNotMatch(renderKpiRunCaptionHtml(describeKpiRunCaption({ summary: { ...SUMMARY_143, valuation_date: "<x>" } })), /<x>/);
});

// 3. Draft summary
test("draft summary counts the draft's own rows by raw severity; rejects empty and foreign rows", () => {
  const s = summariseRunRows(draftRows(), { periodStart: OCT, runId: "148" });
  assert.equal(s.ok, true);
  assert.deepEqual({ ...s.counts }, { BLOCKER: 1, REVIEW_REQUIRED: 113, READY: 514, OTHER: 0 });
  assert.equal(s.total, 628);
  assert.deepEqual([...s.valuationDates], ["2026-10-31"]);
  assert.equal(summariseRunRows([], { periodStart: OCT, runId: "148" }).reason, "empty");
  assert.equal(summariseRunRows(draftRows(143), { periodStart: OCT, runId: "148" }).reason, "foreign");
  assert.equal(summariseRunRows(draftRows(148, SEP), { periodStart: OCT, runId: "148" }).reason, "foreign");
  assert.equal(ccc.CCC_DRAFT_SUMMARY_SELECT, "period_start,refresh_run_id,valuation_date,control_severity");
});

// 4. Dashboard card
const ready = (row) => ({ status: "ready", row, error: null });
test("dashboard card: approved KPIs and draft counts in separate, run-labelled cards; one CTA; no mixed denominators", () => {
  const draft = ready(summariseRunRows(draftRows(), { periodStart: OCT, runId: "148" }));
  const m = describeDashboardRunContext({ periodStart: OCT, status: ready(STATUS_OCT), summary: SUMMARY_143, draft });
  assert.equal(m.shown.runId, "143");
  assert.equal(m.shown.approved, true);
  assert.equal(m.draft.runId, "148");
  assert.deepEqual([m.draft.ready, m.draft.review, m.draft.blocker, m.draft.total], [514, 113, 1, 628]);
  const html = renderDashboardRunContextHtml(m);
  const approvedCard = html.split('class="ccc-rc-card ccc-rc-approved"')[1].split('class="ccc-rc-card ccc-rc-draft"')[0];
  const draftCard = html.split('class="ccc-rc-card ccc-rc-draft"')[1];
  assert.match(approvedCard, /Approved run 143/);
  assert.match(approvedCard, /Valuation 2026-10-31/);
  assert.match(approvedCard, /627 \/ 627/);
  assert.doesNotMatch(approvedCard, /148|514|113/);
  assert.match(draftCard, /Draft run 148/);
  assert.match(draftCard, /Not for pricing/);
  assert.match(draftCard, /514 \/ 628/);
  assert.match(draftCard, /<span class="ccc-rc-stat-value">113<\/span><span class="ccc-rc-stat-label">Review<\/span>/);
  assert.match(draftCard, /<span class="ccc-rc-stat-value">1<\/span><span class="ccc-rc-stat-label">Blocked<\/span>/);
  assert.doesNotMatch(draftCard, /627/);
  assert.equal((html.match(/data-ccc-review-draft="148"/g) || []).length, 1);
  assert.match(html, /<button type="button" class="ccc-rc-cta" data-ccc-review-draft="148">Review draft 148<\/button>/);
  assert.match(html, /<span class="ccc-rc-server" title="Server run status">Approved run 143 \(newer DRAFT run 148 - not approved\)<\/span>/);
  assert.match(html, /<details class="ccc-rc-details"><summary>About these figures<\/summary>/);
  assert.match(html, /^<section class="ccc-rc" aria-label="Run context">/);
});

test("dashboard card: loading, errors, foreign/empty draft rows, no newer draft, mismatch, active run, escaping", () => {
  const base = { periodStart: OCT, summary: SUMMARY_143 };
  assert.match(renderDashboardRunContextHtml(describeDashboardRunContext({ ...base, status: { status: "loading" } })), /role="status">Loading run status…/);
  assert.match(renderDashboardRunContextHtml(describeDashboardRunContext({ ...base, status: { status: "error", error: "permission denied" } })), /role="alert">Run status could not be read: permission denied\. Approved\/draft designation is not verified\./);
  const withDraft = (draft) => renderDashboardRunContextHtml(describeDashboardRunContext({ ...base, status: ready(STATUS_OCT), draft }));
  assert.match(withDraft({ status: "loading" }), /Loading draft run counts…/);
  assert.match(withDraft({ status: "error", error: "boom" }), /Draft counts could not be read: boom\./);
  assert.match(withDraft(ready(summariseRunRows(draftRows(143), { periodStart: OCT, runId: "148" }))), /rows of another run; draft counts not shown/);
  assert.match(withDraft(ready(summariseRunRows([], { periodStart: OCT, runId: "148" }))), /No draft rows returned \(no permission, or the run has no SKU rows\)\./);
  const sep = renderDashboardRunContextHtml(describeDashboardRunContext({ periodStart: SEP, status: ready(STATUS_SEP), summary: SUMMARY_122 }));
  assert.match(sep, /No newer draft run for this period\./);
  assert.doesNotMatch(sep, /data-ccc-review-draft/);
  assert.match(sep, /Approved run 122/);
  const mismatch = renderDashboardRunContextHtml(describeDashboardRunContext({ ...base, status: ready({ ...STATUS_OCT, displayed_run_id: 149, approved_run_id: 149 }) }));
  assert.match(mismatch, /These KPIs are from run 143, but the server now displays run 149\. Reload the period\./);
  assert.match(mismatch, /Run 143 · not approved/);
  const active = renderDashboardRunContextHtml(describeDashboardRunContext({ ...base, status: ready({ ...STATUS_OCT, active_run_id: 151, active_run_status: "RUNNING" }) }));
  assert.match(active, /Run 151 is RUNNING; its figures appear when it finishes\./);
  const evil = renderDashboardRunContextHtml(describeDashboardRunContext({ periodStart: "<p>", status: ready({ ...STATUS_OCT, display_label: "<img onerror=x>", display_state: "<b>" }), summary: { ...SUMMARY_143, valuation_date: "<i>" } }));
  assert.doesNotMatch(evil, /<img|<b>|<i>/);
  assert.ok(evil.includes("Run context · &lt;p&gt;"), "period escaped");
  assert.ok(evil.includes("&lt;img onerror=x&gt;"));
  assert.match(renderDashboardRunContextHtml(describeDashboardRunContext({ periodStart: OCT, status: ready(STATUS_OCT), summary: null })), /No control snapshot for this period\./);
});

// 5. Loader
test("latest-only loader discards stale answers and keys on key + ref", async () => {
  const pending = [];
  const loader = createLatestOnlyLoader({ query: (arg) => new Promise((resolve) => pending.push({ arg, resolve })) });
  let settled = 0;
  const refA = {};
  loader.ensure("A", "argA", refA, () => (settled += 1));
  loader.ensure("A", "argA", refA, () => (settled += 1));
  await flush();
  assert.equal(pending.length, 1);
  loader.ensure("B", "argB", refA, () => (settled += 1));
  await flush();
  pending[0].resolve({ data: "late", error: null });
  await flush();
  assert.equal(loader.state().status, "loading");
  pending[1].resolve({ data: "fresh", error: null });
  await flush();
  assert.deepEqual([loader.state().status, loader.state().row, settled], ["ready", "fresh", 1]);
  loader.ensure("B", "argB", {}, () => {});
  await flush();
  assert.equal(pending.length, 3, "new ref (reload) re-reads");
  pending[2].resolve([1, 2, 3]);
  await flush();
  assert.deepEqual(loader.state().row, [1, 2, 3], "plain values pass through");
  assert.equal(loader.ensure(null, null, null).status, "idle");
});

// 6. Worklist compact structure
test("worklist (UX-F3): one toolbar, draft marker + short drawer note, one chip row; run line and caveats in the disclosure", () => {
  const rows = draftRows();
  const groups = worklist.groupReviewWorklistRows(rows.map((r) => ({ ...r, first_control_status: r.control_severity === "BLOCKER" ? "MATERIAL_COST_BLOCKED" : "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: r.control_severity === "BLOCKER" ? "MATERIAL_RATE_MANAGER" : "COST_REVIEW_WORKBENCH", pm_blocking_line_count: 1 })));
  const d = worklist.describeReviewWorklistRunContext({ rows, periodStart: OCT, runStatus: ready(STATUS_OCT), selectedRunId: "148", runPickerAvailable: true });
  const html = worklist.renderReviewWorklistHtml(groups, { runContext: worklist.reviewWorklistRunContext(rows), runDiagnosis: d, rowCount: rows.length });
  const visible = html.replace(/<details class="rwl-details rwl-info rwl-info-warn">[\s\S]*?<\/details>/, "");
  // UX-F3: the header already names Approved 143 / Draft 148, so the toolbar repeats no run id or date; the draft
  // identity stays as one short marker, and drawer provenance as one short visible note (full text in the disclosure).
  assert.doesNotMatch(visible, /data-rwl-pill|Draft · not for pricing/); // UX-F5: the picker option carries the draft wording
  assert.match(visible, /<span class="rwl-drawer-note" role="note" title="Drawer evidence is from run 143, not draft 148\.">Drawer: run 143<\/span>/);
  assert.doesNotMatch(visible, /Run shown|valuation 2026|Draft run 148|class="rwl-alert/);
  // No long prose in the visible part.
  assert.doesNotMatch(visible, /Fixes you make|frozen SKU rows read-only|current-source diagnosis|Server run status|Loaded rows/);
  const details = html.match(/<details class="rwl-details rwl-info rwl-info-warn">([\s\S]*?)<\/details>/)[1];
  assert.match(details, /<summary aria-label="Run details and caveats\. Drawer evidence is from run 143, not draft 148\."/);
  assert.match(details, /<div class="rwl-run">Run shown: 148 · valuation 2026-10-31<\/div>/);
  assert.match(details, /Fixes you make on the fix screens do not change this frozen run\./);
  assert.match(details, /Row drawer evidence is not this run's evidence\.<\/strong> The per-line material evidence/);
  assert.match(details, /Loaded rows \(run 148\): 628 — BLOCKER 1 · REVIEW_REQUIRED 113 · READY 514/);
  // UX-F2 pills: toggle buttons (aria-pressed) with the count; no tall cards, route prose or fix links.
  assert.match(html, /<div class="rwl-chips" role="group" aria-label="Review groups/);
  assert.match(html, /<button type="button" class="rwl-chip rwl-sev-blocker" data-rwl-select="BLOCKER\|MATERIAL_COST_BLOCKED\|MATERIAL_RATE_MANAGER" data-rwl-group="[^"]+" aria-pressed="false" aria-label="[^"]*1 SKU[^"]*" title="[^"]*"><span class="rwl-chip-label">[^<]+<\/span><span class="rwl-count">1<\/span><\/button>/);
  assert.doesNotMatch(html, /rwl-card|rwl-groups|rwl-open|data-rwl-open|Open fix screen|No fix screen link|rwl-nolink|rwl-route|rwl-primary|Show in table<\/button>/);
  assert.doesNotMatch(html, /style=/, "no inline styles");
  // Pill kinds.
  const pill = (kind, extra = {}) => worklist.reviewWorklistStatusPill({ kind, listRunId: "143", listRunIds: ["143"], ...extra });
  assert.deepEqual(pill("approved"), { tone: "approved", text: "Approved run 143" });
  assert.deepEqual(pill("not-approved"), { tone: "draft", text: "Run 143 · Not approved" });
  assert.deepEqual(pill("status-error"), { tone: "warn", text: "Run 143 · status not verified" });
  assert.deepEqual(pill("loading"), { tone: "neutral", text: "Checking run status…" });
  // Exceptions stay visible.
  const mm = worklist.reviewWorklistVisibleAlerts({ kind: "mismatch", listRunId: "143", displayedRunId: "149", listRunIds: ["143"] });
  assert.deepEqual(mm.map((a) => [a.role, a.text]), [["alert", "Rows are from run 143; the server now shows run 149. Reload the period."]]);
});

// 7. Shell flow (real flag-gated helpers in a sandbox)
function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  if (start < 0) start = src.indexOf(`\nasync function ${name}(`);
  assert.ok(start >= 0, name);
  return src.slice(start + 1, src.indexOf("\n}\n", start) + 2);
}
function el(id) {
  const node = {
    id, innerHTML: "", hidden: false, className: "", classes: new Set(), handlers: [], children: [],
    classList: { add: (c) => node.classes.add(c), remove: (c) => node.classes.delete(c) },
    insertBefore(child) { this.children.unshift(child); },
    querySelectorAll(sel) {
      const attr = sel.match(/^\[data-([\w-]+)\]$/)?.[1];
      return [...node.innerHTML.matchAll(new RegExp(`data-${attr}="([^"]*)"`, "g"))].map((m) => {
        const n = {
          value: "",
          dataset: { [attr.replace(/-(\w)/g, (_, c) => c.toUpperCase())]: m[1] },
          addEventListener(type, fn) { node.handlers.push({ attr, key: m[1], type, fn, n }); },
        };
        return n;
      });
    },
  };
  return node;
}
function makeShell({ flagOn = true, lens = "dashboard", statusFor = { [OCT]: STATUS_OCT, [SEP]: STATUS_SEP }, summary = SUMMARY_143 } = {}) {
  const statusPending = [];
  const runPending = [];
  const reads = [];
  const qb = (view) => {
    const q = { view, select: null, eq: [] };
    reads.push(q);
    const api = {
      select(c) { q.select = c; return api; },
      eq(k, v) { q.eq.push([k, v]); return api; },
      order() { return api; },
      range() { return api; },
      maybeSingle: () => new Promise((resolve) => statusPending.push({ q, resolve })),
      then(onF, onR) { return new Promise((resolve) => runPending.push({ q, resolve })).then(onF, onR); },
    };
    return api;
  };
  const kpiStrip = el("kpiStrip");
  const kpiStripWrap = el("kpiStripWrap");
  const workbenchSummary = el("workbenchSummary");
  const created = {};
  const ctx = {
    ...worklist,
    CURRENT_LENS: lens,
    ACTIVE_PERIOD_START: OCT,
    ACTIVE_ROUTE_CONFIG: { moduleKey: "costing-control-center" },
    ALL_ROWS: [],
    VIEW: [],
    CURRENT_PAGE: 1,
    ROWS_LOAD_GENERATION: 1,
    REVIEW_WORKLIST_GROUP: null,
    ACTIVE_FILTERS: { status: [], issue: [], source: [] },
    searchBox: { value: "" },
    REVIEW_WORKLIST_RUN_STATUS: null,
    REVIEW_WORKLIST_RUN_SELECTION: null,
    REVIEW_WORKLIST_RUN_LOAD: null,
    REVIEW_WORKLIST_PENDING_RUN: null,
    CCC_RUN_STATUS_LOADER: null,
    CCC_DRAFT_SUMMARY_LOADER: null,
    isRowsLoadCurrent: (g) => g === ctx.ROWS_LOAD_GENERATION,
    isCostingReviewWorklistV1Enabled: () => flagOn,
    kpiStrip, kpiStripWrap, workbenchSummary,
    document: {
      getElementById: (id) => created[id] || null,
      createElement: () => { const n = el(""); Object.defineProperty(n, "id", { set(v) { created[v] = n; }, get() { return Object.keys(created).find((k) => created[k] === n); } }); return n; },
    },
    controlCenterCtrl: { getControlDashboardSummary: () => ctx.summary },
    summary,
    toasts: [],
    showToast: (m) => ctx.toasts.push(m),
    switched: [],
    switchLens: async (l) => { ctx.switched.push(l); ctx.CURRENT_LENS = l; },
    applyFilters() { ctx.VIEW = ctx.ALL_ROWS; vm.runInContext("renderReviewWorklistPanel()", ctx); },
    navigateToCostingRoute: () => {},
    queueMicrotask: (fn) => queueMicrotask(fn),
    supabase: { from: qb },
    costingFrom: qb,
  };
  vm.createContext(ctx);
  const src = read(SHELL);
  const names = ["cccSummaryIdentity", "renderCccKpiRunCaption", "renderCccRunContextChrome", "reviewWorklistSelectedKey", "reviewWorklistRunStatus", "reviewWorklistActiveRun", "reviewWorklistGovernedRows", "selectReviewWorklistRun", "renderReviewWorklistPanel", "setReviewWorklistGroup", "reviewWorklistFilterState", "syncReviewWorklistDrawerGroup", "removeInactiveReviewWorklistDrawerGroup", "clearReviewWorklistGroup"];
  vm.runInContext([...names.map((n) => extractFn(src, n)), `async function fetchAllRows(factory) { const res = await factory(); if (res.error) throw res.error; return res.data || []; }`].join("\n"), ctx);
  return {
    ctx, reads, kpiStripWrap, workbenchSummary, created,
    chrome: () => vm.runInContext("renderCccRunContextChrome()", ctx),
    caption: () => vm.runInContext("renderCccKpiRunCaption()", ctx),
    panel: () => vm.runInContext("renderReviewWorklistPanel()", ctx),
    async answerStatus(i = statusPending.length - 1) {
      const p = statusPending[i];
      const period = p.q.eq.find(([k]) => k === "period_start")?.[1];
      p.resolve({ data: statusFor[period] ?? null, error: null });
      await flush();
    },
    async answerRun(i, result) { runPending[i].resolve(result); await flush(); },
    runPending, statusPending,
  };
}

test("shell: flag OFF renders nothing and reads nothing", async () => {
  const s = makeShell({ flagOn: false });
  assert.equal(s.chrome(), null);
  assert.equal(s.caption(), null);
  await flush();
  assert.equal(s.reads.length, 0);
  assert.equal(s.created.cccKpiRunCaption, undefined);
  assert.equal(s.workbenchSummary.innerHTML, "");
});

test("shell dashboard: caption + run-context card from server reads; draft counts read by period AND run; CTA pre-selects only the advertised draft", async () => {
  const s = makeShell();
  s.chrome();
  await flush();
  assert.match(s.workbenchSummary.innerHTML, /Loading run status…/);
  assert.equal(s.reads[0].view, "v_costing_pricing_period_run_status");
  await s.answerStatus();
  // Draft summary read: run-scoped view, both filters, minimal columns.
  const draftRead = s.reads.find((q) => q.view === "v_costing_pricing_sku_control_status_by_run");
  assert.ok(draftRead);
  assert.deepEqual(draftRead.eq, [["period_start", OCT], ["refresh_run_id", "148"]]);
  assert.equal(draftRead.select, "period_start,refresh_run_id,valuation_date,control_severity");
  assert.match(s.workbenchSummary.innerHTML, /Loading draft run counts…/);
  await s.answerRun(0, { data: draftRows(), error: null });
  const html = s.workbenchSummary.innerHTML;
  assert.match(html, /Approved run 143/);
  assert.match(html, /514 \/ 628/);
  assert.ok(s.workbenchSummary.classes.has("is-visible"));
  const cap = s.created.cccKpiRunCaption;
  assert.ok(cap);
  assert.equal(cap.innerHTML, '<span class="ccc-kpi-caption-run">KPIs: approved run 143 · valuation 2026-10-31</span>');
  assert.equal(cap.hidden, false);
  // Re-render: no duplicate reads.
  const before = s.reads.length;
  s.chrome();
  await flush();
  assert.equal(s.reads.length, before);
  // CTA → SKU Control Status; the intent is in memory only.
  s.workbenchSummary.handlers.find((h) => h.attr === "ccc-review-draft").fn();
  assert.deepEqual(s.ctx.switched, ["sku-control-status"]);
  assert.deepEqual({ ...s.ctx.REVIEW_WORKLIST_PENDING_RUN }, { periodStart: OCT, runId: "148" });
  // On the SKU lens the worklist reads status, then honours the intent for the advertised draft only.
  s.ctx.ALL_ROWS = draftRows(143).map((r) => ({ ...r, control_severity: "READY" }));
  s.panel();
  await flush();
  await s.answerStatus();
  await flush();
  assert.equal(s.ctx.REVIEW_WORKLIST_PENDING_RUN, null);
  const runRead = s.reads.filter((q) => q.view === "v_costing_pricing_sku_control_status_by_run").at(-1);
  assert.deepEqual(runRead.eq, [["period_start", OCT], ["refresh_run_id", "148"]]);
  assert.equal(runRead.select, "*");
  await s.answerRun(s.runPending.length - 1, { data: draftRows().map((r) => ({ ...r, first_control_status: "X", recommended_ui_route: null })), error: null });
  assert.match(s.workbenchSummary.innerHTML, /<option value="148" selected>Run 148 — Draft — not for pricing<\/option>/);
  assert.doesNotMatch(s.workbenchSummary.innerHTML, /data-rwl-pill="selected-not-approved"/);
  // Caption on the SKU lens now warns that the worklist shows another run (reuses the worklist status read).
  const statusReads = s.reads.filter((q) => q.view === "v_costing_pricing_period_run_status").length;
  s.caption();
  assert.equal(s.created.cccKpiRunCaption.innerHTML, '<span class="ccc-kpi-caption-run">KPIs: approved run 143 · valuation 2026-10-31</span><span class="ccc-kpi-caption-warn" role="note">The worklist below shows run 148; these KPIs are not from it.</span>');
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_period_run_status").length, statusReads, "no extra status read on the SKU lens");
});

test("shell: a pending intent for a non-advertised id or another period is dropped, never selected", async () => {
  const s = makeShell({ lens: "sku-control-status" });
  s.ctx.ALL_ROWS = draftRows(143).map((r) => ({ ...r, control_severity: "READY" }));
  s.ctx.REVIEW_WORKLIST_PENDING_RUN = { periodStart: OCT, runId: "147" };
  s.panel();
  await flush();
  await s.answerStatus();
  await flush();
  assert.equal(s.ctx.REVIEW_WORKLIST_PENDING_RUN, null);
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_sku_control_status_by_run").length, 0);
  const t = makeShell({ lens: "sku-control-status" });
  t.ctx.ALL_ROWS = [];
  t.ctx.REVIEW_WORKLIST_PENDING_RUN = { periodStart: SEP, runId: "148" };
  t.panel();
  assert.equal(t.ctx.REVIEW_WORKLIST_PENDING_RUN, null, "other period: dropped immediately");
});

test("shell: period change re-reads status; September has no draft card CTA and no stale October text", async () => {
  const s = makeShell();
  s.chrome();
  await flush();
  await s.answerStatus();
  await s.answerRun(0, { data: draftRows(), error: null });
  s.ctx.ACTIVE_PERIOD_START = SEP;
  s.ctx.summary = SUMMARY_122;
  s.chrome();
  await flush();
  await s.answerStatus();
  const html = s.workbenchSummary.innerHTML;
  assert.match(html, /Run context · 2026-09-01/);
  assert.match(html, /Approved run 122/);
  assert.doesNotMatch(html, /143|148/);
  assert.equal(s.created.cccKpiRunCaption.innerHTML, '<span class="ccc-kpi-caption-run">KPIs: approved run 122 · valuation 2026-09-30</span>');
});

test("shell: only read views, no writes; new code is behind the flag", () => {
  const src = read(SHELL);
  const fnText = ["cccSummaryIdentity", "renderCccKpiRunCaption", "renderCccRunContextChrome"].map((n) => extractFn(src, n)).join("\n");
  assert.doesNotMatch(fnText, /\.rpc\(|costingRpc|\binsert\(|\bupsert\(|\.update\(|\.delete\(|service_role|new Date|Date\.now|location|URLSearchParams/);
  assert.doesNotMatch(read("public/shared/js/costing-ccc-run-context.js"), /supabase|\.rpc\(|\.from\(|fetch\(|new Date|Date\.now|document|window|localStorage/);
  for (const gated of [
    "    if (isCostingReviewWorklistV1Enabled()) {\n      renderCccRunContextChrome();\n    }\n",
    "      if (isCostingReviewWorklistV1Enabled()) {\n        renderCccKpiRunCaption();\n      }\n",
  ]) {
    assert.equal(src.split(gated).length, 2, gated);
  }
  const calls = src.split("\n").filter((l) => /renderCcc(RunContextChrome|KpiRunCaption)\(/.test(l) && !/function /.test(l));
  assert.deepEqual(calls.map((l) => l.trim()), [
    "renderCccKpiRunCaption();",
    "return renderCccRunContextChrome({ captionOnly: true });",
    "statusState = CCC_RUN_STATUS_LOADER.ensure(periodStart, periodStart, cccSummaryIdentity(summary), () => renderCccRunContextChrome());",
    "() => renderCccRunContextChrome(),",
    "renderCccRunContextChrome();",
  ]);
});

// 8. Scope and protected files
test("scope: no supabase/, migration, controller, protected-screen, HTML or cache changes; CSS append-only and scoped", () => {
  // Reconciled with WP-07 (#120): supabase/ and HTML checks use the shared Costing scope guard, so the WP-07
  // migration copy and e-Aushadhi HTML do not trip this UX-F1 test; Costing-owned paths stay protected.
  const scope = costingScopeReport({ git, root, base: BASE });
  assert.deepEqual(scope.supabase, [], "no Costing or history-rewriting supabase change");
  assert.deepEqual(scope.html, [], "no Costing HTML changed");
  assert.equal(git("diff", BASE, "--", "package.json", "package-lock.json"), "");
  const mig = "supabase/migrations/20261015045233_ppm_inactive_sku_mrp_policy_governance.sql";
  assert.equal(git("rev-parse", `${BASE}:${mig}`).trim(), git("hash-object", mig).trim());
  const unchanged = [
    "costing-suite-control-center.js", "costing-suite-recommended-ui-route.js", "costing-route-config.js",
    "costing-approval-screen.js", "costing-approval-errors.js", "costing-approval-labels.js", "costing-lock-screen.js",
    "costing-run-status-screen.js", "costing-recalculation.js", "costing-status-labels.js",
    "costing-table-tools.js", "costing-suite-pricing-policy.js", "costing-suite-cost-build.js", "costing-suite-material-cost.js",
  ].map((f) => `public/shared/js/${f}`);
  // WP05-P01: costing-suite-readiness.js is intentionally no longer pinned to the UX-F1 base (Readiness usability package;
  // it has its own contract tests in scripts/costing-readiness-usability and scripts/wp04-readiness-client-contract-smoke.mjs).
  // CW-07: costing-route-config.js may differ from the base only by the Cost Sheet label rename (applied to the base text).
  // MDC-07 N2: the two controllers may carry only the flag-gated N2 navigation additions (scripts/lib/n2-nav-strip.mjs).
  // MDC-07 W6: the PPM controller may carry only the flag-gated W6 five-group projection (scripts/lib/w6-nav-strip.mjs).
  // SEC-A2: costing-approval-screen.js may carry only the CCC-edit gate hunks (scripts/lib/sec-a2-strip.mjs).
  for (const rel of unchanged) assert.equal(stripU11(rel, stripW6(rel, stripN2(rel, stripSecA2(rel, read(rel))))), readBase(rel), rel);
  // MDC-07 N1: costing-feature-flags.js may only be appended to (the COSTING_NAV_GROUPS_V1 flag); nothing existing changes.
  const flagsRel = "public/shared/js/costing-feature-flags.js";
  assert.ok(read(flagsRel).startsWith(readBase(flagsRel)), "feature flags: existing content unchanged (append-only)");
  // UX-F1 changed only the service-worker cache line (v389 to v390); #208 later advanced it to v391 and LOCK-P01 (#212) to v392 without touching anything else here.
  const swChanged = git("diff", "-U0", BASE, "--", "public/sw.js").split("\n").filter((l) => /^[+-][^+-]/.test(l));
  // BASE is the historical v388 UX-F1 base, so the diff is -v388 / +v390 (WP-07's v389 sits in between).
  assert.ok(swChanged.every((l) => /^[+-]const CACHE_NAME = "hub-cache-v(?:388|389|390|391|392)";/.test(l)), "no UX-F1 cache allocation: " + swChanged.join(" | "));
  // Historical contract: UX-F1 released as v390. The current release line is now v392 (LOCK-P01); v391 (#208) and v390 must still be in sw.js history.
  assert.ok(swChanged.some((l) => /^\+const CACHE_NAME = "hub-cache-v392";/.test(l)), "current release cache line is v392: " + swChanged.join(" | "));
  assert.ok(git("log", "--format=%H", "-S", "hub-cache-v391", "--", "public/sw.js").trim().length > 0, "the v391 #208 release line remains in sw.js history");
  assert.ok(git("log", "--format=%H", "-S", "hub-cache-v390", "--", "public/sw.js").trim().length > 0, "the v390 UX-F1 release line remains in sw.js history");
  assert.ok(!swChanged.some((l) => /^\+const CACHE_NAME = "hub-cache-v38[89]";/.test(l)), "no stale cache line added: " + swChanged.join(" | "));
  const css = read("public/shared/css/sasv-costing.css");
  const cssBase = readBase("public/shared/css/sasv-costing.css");
  assert.ok(css.startsWith(cssBase));
  assert.match(css.slice(cssBase.length), /^\n\/\* =+\n {3}UX-F1: CCC run context/);
});


// 9. Audit follow-up: no repeated reads, stale handling, navigation, responsive header
test("shell: fresh summary OBJECTS on every render (same run) trigger no repeated status or 628-row draft reads", async () => {
  const s = makeShell();
  s.chrome();
  await flush();
  await s.answerStatus();
  await s.answerRun(0, { data: draftRows(), error: null });
  const before = s.reads.length;
  for (let i = 0; i < 5; i += 1) {
    s.ctx.summary = { ...SUMMARY_143 }; // controller hands back a new object each render
    s.chrome();
    s.caption();
    await flush();
  }
  assert.equal(s.reads.length, before, "no extra reads across 5 render cycles with new summary objects");
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_period_run_status").length, 1);
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_sku_control_status_by_run").length, 1);
  assert.match(s.workbenchSummary.innerHTML, /514 \/ 628/);
});

test("shell: a genuinely different governed run (new run id in the summary) re-reads once", async () => {
  const s = makeShell();
  s.chrome();
  await flush();
  await s.answerStatus();
  await s.answerRun(0, { data: draftRows(), error: null });
  s.ctx.summary = { ...SUMMARY_143, refresh_run_id: 150 };
  s.chrome();
  await flush();
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_period_run_status").length, 2);
  s.chrome();
  await flush();
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_period_run_status").length, 2, "and only once");
});

test("shell: stale status answer after a period change is discarded", async () => {
  const s = makeShell();
  s.chrome();
  await flush();
  s.ctx.ACTIVE_PERIOD_START = SEP;
  s.ctx.summary = SUMMARY_122;
  s.chrome();
  await flush();
  // October answer arrives late, September answer arrives after.
  await s.answerStatus(0);
  assert.doesNotMatch(s.workbenchSummary.innerHTML, /148/, "late October answer not shown for September");
  assert.equal(s.reads.filter((q) => q.view === "v_costing_pricing_sku_control_status_by_run").length, 0, "no draft read from a stale answer");
  await s.answerStatus(1);
  assert.match(s.workbenchSummary.innerHTML, /Approved run 122/);
});

test("shell: stale draft-summary answer after a period change is discarded", async () => {
  const s = makeShell();
  s.chrome();
  await flush();
  await s.answerStatus();
  s.ctx.ACTIVE_PERIOD_START = SEP;
  s.ctx.summary = SUMMARY_122;
  s.chrome();
  await flush();
  await s.answerRun(0, { data: draftRows(), error: null }); // late October draft rows
  await s.answerStatus(1);
  assert.doesNotMatch(s.workbenchSummary.innerHTML, /148|514/);
});

test("responsive header: compact chip rules, 520px breakpoint and title ellipsis are flag-scoped CSS", () => {
  const css = read("public/shared/css/sasv-costing.css");
  const block = css.slice(readBase("public/shared/css/sasv-costing.css").length);
  assert.match(block, /\.ccc-compact-header \.page-header h1\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(block, /@media \(max-width: 520px\)/);
  assert.match(block, /\.sc-run-status\[data-compact="1"\]/);
  assert.doesNotMatch(block, /(^|\n)\s*(\.sc-run-status|\.page-header|body)\s*[{,]/, "no unscoped header rules");
});
