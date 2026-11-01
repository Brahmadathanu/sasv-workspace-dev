// Costing review worklist v1 (flag COSTING_REVIEW_WORKLIST_V1, default OFF).
// Read-only. Groups the sku-control-status rows the Control Centre already
// loaded by the server's own codes (control_severity, first_control_status,
// recommended_ui_route). No data access, no writes, no clock, no DOM at import.
// Labels come only from the existing label helpers; explanations only from the
// server control_note.

import {
  formatFirstControlStatusLabel,
  formatRecommendedUiRouteLabel,
  normalizeRecommendedUiRouteCode,
  resolveRecommendedUiRouteTarget,
} from "./costing-suite-recommended-ui-route.js";
import { costingStatusDisplayLabel } from "./costing-status-labels.js";
import { RUN_STATUS_SELECT_V1, RUN_STATUS_VIEW } from "./costing-run-status-badge.js";

/** Raw server severities shown in the worklist (READY rows are excluded). */
export const REVIEW_WORKLIST_SEVERITIES = Object.freeze(["BLOCKER", "REVIEW_REQUIRED"]);

export const REVIEW_WORKLIST_EMPTY_TEXT =
  "No blocked or review SKUs in the run shown for this period.";
export const REVIEW_WORKLIST_FROZEN_RUN_TEXT =
  "Fixes you make on the fix screens do not change this frozen run. They count only after a separate, approved recalculation.";
export const REVIEW_WORKLIST_MIXED_NOTES_TEXT = "Several server notes – open a row";
export const REVIEW_WORKLIST_NO_LINK_TEXT =
  "No dedicated screen link yet – open a SKU row for details.";
export const REVIEW_WORKLIST_NO_NAV_TOAST =
  "No dedicated navigation is configured for this control yet.";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const code = (value) => normalizeRecommendedUiRouteCode(value);

/** Group key of a row: raw server codes, trimmed upper-case. */
export function reviewWorklistGroupKey(row) {
  return `${code(row?.control_severity)}|${code(row?.first_control_status)}|${code(row?.recommended_ui_route)}`;
}

function distinctRaw(rows, field) {
  const out = [];
  for (const row of rows) {
    const v = row?.[field];
    if (v === null || v === undefined || v === "") continue;
    const s = String(v);
    if (!out.includes(s)) out.push(s);
  }
  return Object.freeze(out);
}

/**
 * Groups of BLOCKER / REVIEW_REQUIRED rows, BLOCKER first, then REVIEW_REQUIRED,
 * then by count (desc), then key. Rows keep input order and identity.
 */
export function groupReviewWorklistRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byKey = new Map();
  for (const row of list) {
    const severity = code(row?.control_severity);
    if (!REVIEW_WORKLIST_SEVERITIES.includes(severity)) continue;
    const key = reviewWorklistGroupKey(row);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        severity,
        firstControlStatus: code(row?.first_control_status),
        route: code(row?.recommended_ui_route),
        rows: [],
      });
    }
    byKey.get(key).rows.push(row);
  }
  const groups = [...byKey.values()].map((g) => {
    const notes = g.rows.map((r) =>
      r?.control_note === null || r?.control_note === undefined ? "" : String(r.control_note),
    );
    const notesDiffer = notes.some((n) => n !== notes[0]);
    return Object.freeze({
      key: g.key,
      severity: g.severity,
      firstControlStatus: g.firstControlStatus,
      route: g.route,
      count: g.rows.length,
      rows: Object.freeze(g.rows),
      note: notesDiffer || notes[0] === "" ? null : notes[0],
      notesDiffer,
      runIds: distinctRaw(g.rows, "refresh_run_id"),
      valuationDates: distinctRaw(g.rows, "valuation_date"),
    });
  });
  groups.sort((a, b) => {
    const sa = REVIEW_WORKLIST_SEVERITIES.indexOf(a.severity);
    const sb = REVIEW_WORKLIST_SEVERITIES.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    if (a.count !== b.count) return b.count - a.count;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return Object.freeze(groups);
}

/** Distinct raw run ids / valuation dates of the loaded rows (printed verbatim). */
export function reviewWorklistRunContext(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return Object.freeze({
    runIds: distinctRaw(list, "refresh_run_id"),
    valuationDates: distinctRaw(list, "valuation_date"),
  });
}

/** Same 7-key context the Control Centre builds for its row navigation. */
export function reviewWorklistRouteContext(row) {
  return {
    productId: row?.product_id,
    skuId: row?.sku_id,
    periodStart: row?.period_start,
    rmBlockingLineCount: row?.rm_blocking_line_count,
    pmBlockingLineCount: row?.pm_blocking_line_count,
    sellingPriceBridgeStatus: row?.selling_price_bridge_status,
    pricingBridgeStatus: row?.pricing_bridge_status,
  };
}

export function resolveReviewWorklistTarget(row) {
  return resolveRecommendedUiRouteTarget(row?.recommended_ui_route, reviewWorklistRouteContext(row));
}

/** Rows of `rows` in group `key` (input order kept); all rows when key is empty. */
export function filterReviewWorklistRows(rows, key) {
  const list = Array.isArray(rows) ? rows : [];
  if (!key) return list;
  return list.filter((row) => reviewWorklistGroupKey(row) === key);
}

function runLine(runContext) {
  const runIds = runContext?.runIds || [];
  const dates = runContext?.valuationDates || [];
  const runs = runIds.length ? runIds.map(escapeHtml).join(", ") : "--";
  const vals = dates.length ? dates.map(escapeHtml).join(", ") : "--";
  return `Run shown: ${runs} · valuation ${vals}`;
}

/** HTML for the worklist panel. All server text is escaped. */
export function renderReviewWorklistHtml(
  groups,
  { selectedKey = null, runContext = null, runDiagnosis = null, rowCount = null } = {},
) {
  const list = Array.isArray(groups) ? groups : [];
  const head = `<div class="rwl-head">
  <div class="rwl-title">Review worklist</div>
  <div class="rwl-run">${runLine(runContext)}</div>
  <div class="rwl-frozen">${escapeHtml(REVIEW_WORKLIST_FROZEN_RUN_TEXT)}</div>
  ${runDiagnosis ? renderReviewWorklistRunDiagnosisHtml(runDiagnosis) : ""}
  ${selectedKey ? `<button type="button" class="rwl-clear" data-rwl-clear="1">Clear group</button>` : ""}
</div>`;
  if (!list.length) {
    const emptyText = rowCount === 0 ? REVIEW_WORKLIST_NO_ROWS_TEXT : REVIEW_WORKLIST_EMPTY_TEXT;
    return `<div class="rwl-panel">${head}<div class="rwl-empty">${escapeHtml(emptyText)}</div></div>`;
  }
  const items = list
    .map((g) => {
      const primary = formatFirstControlStatusLabel(g.firstControlStatus) || g.firstControlStatus;
      const routeLabel = formatRecommendedUiRouteLabel(g.route) || g.route;
      const target = resolveReviewWorklistTarget(g.rows[0]);
      const note = g.notesDiffer
        ? `<div class="rwl-note">${escapeHtml(REVIEW_WORKLIST_MIXED_NOTES_TEXT)}</div>`
        : g.note
          ? `<div class="rwl-note">${escapeHtml(g.note)}</div>`
          : "";
      const open = target.navigable
        ? `<button type="button" class="rwl-open" data-rwl-open="${escapeHtml(g.key)}">Open fix screen</button>`
        : `<span class="rwl-nolink">${escapeHtml(target.label)} – ${escapeHtml(REVIEW_WORKLIST_NO_LINK_TEXT)}</span>`;
      const selected = selectedKey === g.key;
      return `<div class="rwl-group${selected ? " rwl-selected" : ""}" data-rwl-group="${escapeHtml(g.key)}">
  <div class="rwl-severity">${escapeHtml(costingStatusDisplayLabel(g.severity))}</div>
  <div class="rwl-primary">${escapeHtml(primary)}</div>
  <div class="rwl-route">${escapeHtml(routeLabel)}</div>
  <div class="rwl-count">${g.count} SKU${g.count === 1 ? "" : "s"}</div>
  ${note}
  <div class="rwl-actions"><button type="button" class="rwl-select" data-rwl-select="${escapeHtml(g.key)}"${selected ? ' aria-pressed="true"' : ""}>Show in table</button>${open}</div>
</div>`;
    })
    .join("\n");
  return `<div class="rwl-panel">${head}<div class="rwl-groups">${items}</div></div>`;
}

// ---------------------------------------------------------------------------
// C1: run context for the worklist (read-only; still behind
// COSTING_REVIEW_WORKLIST_V1). Server ids and labels are shown verbatim; the
// client only compares run ids to say which run the loaded rows belong to.
// ---------------------------------------------------------------------------

/** Same view and columns the existing run-status badge already reads. */
export const REVIEW_WORKLIST_RUN_STATUS_VIEW = RUN_STATUS_VIEW;
export const REVIEW_WORKLIST_RUN_STATUS_SELECT = RUN_STATUS_SELECT_V1;

export const REVIEW_WORKLIST_NO_ROWS_TEXT =
  "No SKU control rows were returned for this period. Either the period has no successful run, or your account cannot read Control Centre data.";
export const REVIEW_WORKLIST_DRAFT_UNAVAILABLE_TEXT =
  "Its SKU rows cannot be shown here: this screen's data source returns only the run in use for each month. Showing them needs a read-only, run-scoped view that is not available yet (pending owner approval).";
export const REVIEW_WORKLIST_FIX_SCREEN_TEXT =
  "Fix screens show current source data, not the frozen run values above.";

const SEVERITY_ORDER = ["BLOCKER", "REVIEW_REQUIRED", "READY"];

function idText(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

/** Raw severity counts of the loaded rows (server codes, in BLOCKER/REVIEW/READY/other order). */
export function reviewWorklistSeverityCounts(rows) {
  const counts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const severity = code(row?.control_severity) || "(none)";
    counts.set(severity, (counts.get(severity) || 0) + 1);
  }
  const ordered = [];
  for (const sev of SEVERITY_ORDER) if (counts.has(sev)) ordered.push([sev, counts.get(sev)]);
  for (const [sev, n] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!SEVERITY_ORDER.includes(sev)) ordered.push([sev, n]);
  }
  return Object.freeze(ordered.map(([severity, count]) => Object.freeze({ severity, count })));
}

/**
 * Loader for the period run status with stale-response protection. `query`
 * is (periodStart) => Promise<{ data, error }>. A new key (period or reloaded
 * rows) starts a new request; a response for an older key is discarded.
 */
export function createReviewWorklistRunStatusLoader({ query }) {
  let generation = 0;
  let current = { key: null, periodStart: null, status: "idle", row: null, error: null };
  function snapshot() {
    return Object.freeze({ ...current });
  }
  function ensure(periodStart, rowsRef, onSettled) {
    if (!periodStart) {
      if (current.status !== "idle" || current.key !== null) {
        generation += 1;
        current = { key: null, periodStart: null, status: "idle", row: null, error: null };
      }
      return snapshot();
    }
    if (current.key && current.key.periodStart === periodStart && current.key.rowsRef === rowsRef) {
      return snapshot();
    }
    const my = ++generation;
    const key = { periodStart, rowsRef };
    current = { key, periodStart, status: "loading", row: null, error: null };
    Promise.resolve()
      .then(() => query(periodStart))
      .then(
        (result) => {
          if (my !== generation) return;
          if (result?.error) {
            current = { key, periodStart, status: "error", row: null, error: String(result.error?.message || result.error) };
          } else {
            current = { key, periodStart, status: "ready", row: result?.data || null, error: null };
          }
          onSettled?.();
        },
        (error) => {
          if (my !== generation) return;
          current = { key, periodStart, status: "error", row: null, error: String(error?.message || error) };
          onSettled?.();
        },
      );
    return snapshot();
  }
  return { ensure, state: snapshot };
}

/**
 * Describe which run the loaded rows belong to, from the rows' own
 * refresh_run_id / period_start and the server period run status. Only ids are
 * compared; labels and codes are passed through unchanged.
 */
export function describeReviewWorklistRunContext({ rows, periodStart, runStatus }) {
  const list = Array.isArray(rows) ? rows : [];
  const ctx = reviewWorklistRunContext(list);
  const listRunIds = ctx.runIds;
  const listRunId = listRunIds.length === 1 ? listRunIds[0] : null;
  const periodMismatch = periodStart
    ? list.some((r) => r?.period_start && String(r.period_start) !== String(periodStart))
    : false;
  const status = runStatus?.status || "idle";
  const row = status === "ready" ? runStatus.row : null;
  const displayedRunId = idText(row?.displayed_run_id);
  const approvedRunId = idText(row?.approved_run_id);
  const newerDraftRunId = idText(row?.newer_draft_run_id);
  const activeRunId = idText(row?.active_run_id);
  let kind;
  if (status === "loading" || status === "idle") kind = status;
  else if (status === "error") kind = "status-error";
  else if (!row) kind = "status-missing";
  else if (!list.length) kind = "no-rows";
  else if (listRunIds.length > 1) kind = "mixed";
  else if (displayedRunId && listRunId !== displayedRunId) kind = "mismatch";
  else if (approvedRunId && listRunId === approvedRunId) kind = "approved";
  else kind = "not-approved";
  return Object.freeze({
    kind,
    periodStart: periodStart ? String(periodStart) : null,
    listRunIds,
    listValuationDates: ctx.valuationDates,
    listRunId,
    periodMismatch,
    rowCount: list.length,
    severityCounts: reviewWorklistSeverityCounts(list),
    serverState: row?.display_state ?? null,
    serverLabel: row?.display_label ?? null,
    displayedRunId,
    approvedRunId,
    newerDraftRunId,
    activeRunId,
    activeRunStatus: row?.active_run_status ?? null,
    error: status === "error" ? runStatus.error : null,
  });
}

/** HTML for the run-context block (all server text escaped). */
export function renderReviewWorklistRunDiagnosisHtml(d) {
  if (!d) return "";
  const lines = [];
  const e = escapeHtml;
  if (d.kind === "loading") lines.push(`<div class="rwl-rc-line" role="status">Loading run status for ${e(d.periodStart || "--")}…</div>`);
  if (d.kind === "idle") lines.push(`<div class="rwl-rc-line">No period selected.</div>`);
  if (d.kind === "status-error") {
    lines.push(`<div class="rwl-rc-line rwl-rc-warn" role="alert">Run status could not be read: ${e(d.error || "unknown error")}. The list below is still the run shown by the server for this period.</div>`);
  }
  if (d.kind === "status-missing") {
    lines.push(`<div class="rwl-rc-line rwl-rc-warn">The server returned no run status for ${e(d.periodStart || "--")} (no run yet, or no permission to read Control Centre status).</div>`);
  }
  if (d.serverLabel || d.serverState) {
    lines.push(`<div class="rwl-rc-line">Server run status: ${e(d.serverLabel || "--")}${d.serverState ? ` <span class="rwl-rc-code">[${e(d.serverState)}]</span>` : ""}</div>`);
  }
  if (d.kind === "approved") {
    lines.push(`<div class="rwl-rc-line">These rows are from approved run ${e(d.listRunId)}.</div>`);
  }
  if (d.kind === "not-approved") {
    lines.push(`<div class="rwl-rc-line rwl-rc-warn">These rows are from run ${e(d.listRunId)}, which is not an approved run.</div>`);
  }
  if (d.kind === "mismatch") {
    lines.push(`<div class="rwl-rc-line rwl-rc-warn" role="alert">The loaded rows are from run ${e(d.listRunId || "--")}, but the server now shows run ${e(d.displayedRunId)} for this period. Reload the period before acting.</div>`);
  }
  if (d.kind === "mixed") {
    lines.push(`<div class="rwl-rc-line rwl-rc-warn" role="alert">Rows from more than one run are loaded (${d.listRunIds.map(e).join(", ")}). Counts may mix runs. Reload the period.</div>`);
  }
  if (d.periodMismatch) {
    lines.push(`<div class="rwl-rc-line rwl-rc-warn" role="alert">Some loaded rows belong to another period than ${e(d.periodStart || "--")}. Reload the period.</div>`);
  }
  if (d.newerDraftRunId && d.newerDraftRunId !== d.listRunId) {
    lines.push(`<div class="rwl-rc-line">Newer draft run ${e(d.newerDraftRunId)} exists for this period and is not approved. ${e(REVIEW_WORKLIST_DRAFT_UNAVAILABLE_TEXT)}</div>`);
  }
  if (d.activeRunId) {
    lines.push(`<div class="rwl-rc-line">Run ${e(d.activeRunId)} is ${e(d.activeRunStatus || "in progress")} for this period; its results are not shown until it finishes.</div>`);
  }
  if (d.rowCount > 0) {
    const counts = d.severityCounts.map((c) => `${e(c.severity)} ${c.count}`).join(" · ");
    lines.push(`<div class="rwl-rc-line">Loaded rows${d.listRunId ? ` (run ${e(d.listRunId)})` : ""}: ${d.rowCount} — ${counts}</div>`);
  }
  lines.push(`<div class="rwl-rc-line rwl-rc-muted">${e(REVIEW_WORKLIST_FIX_SCREEN_TEXT)}</div>`);
  return `<div class="rwl-run-context" data-rwl-run-context="${e(d.kind)}">${lines.join("\n")}</div>`;
}
