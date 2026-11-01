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
export function renderReviewWorklistHtml(groups, { selectedKey = null, runContext = null } = {}) {
  const list = Array.isArray(groups) ? groups : [];
  const head = `<div class="rwl-head">
  <div class="rwl-title">Review worklist</div>
  <div class="rwl-run">${runLine(runContext)}</div>
  <div class="rwl-frozen">${escapeHtml(REVIEW_WORKLIST_FROZEN_RUN_TEXT)}</div>
  ${selectedKey ? `<button type="button" class="rwl-clear" data-rwl-clear="1">Clear group</button>` : ""}
</div>`;
  if (!list.length) {
    return `<div class="rwl-panel">${head}<div class="rwl-empty">${escapeHtml(REVIEW_WORKLIST_EMPTY_TEXT)}</div></div>`;
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
