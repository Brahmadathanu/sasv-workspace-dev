// W1: governed run label for the pricing screens ("Approved run N" / "DRAFT run N - not approved").
// Reads public.v_costing_pricing_period_run_status (one row per month). Pure helpers are exported for tests.
// When COSTING_APPROVAL_SCREEN_V1 is ON, prefer server display_label_v2 / official & draft dates.

import { isCostingApprovalScreenV1Enabled, isCostingRecalcWithDateV1Enabled, isCostingReviewWorklistV1Enabled, isCostingUxConsistencyV1Enabled } from "./costing-feature-flags.js";
import { describeCompactRunBadge, renderCompactRunBadgeHtml } from "./costing-ccc-run-context.js";
import { describeRunStatusForApprovalFlag } from "./costing-approval-labels.js";
import { costingRunBadgeDisplayLabel } from "./costing-status-labels.js";

export const RUN_STATUS_VIEW = "v_costing_pricing_period_run_status";

export const RUN_STATUS_SELECT_V1 =
  "period_start,display_state,display_label,displayed_run_id,approved_run_id,approved_at,approved_by,newer_draft_run_id,active_run_id,active_run_status";

export const RUN_STATUS_SELECT_APPROVAL_V1 =
  "period_start,display_state,display_label,display_label_v2,pricing_use_label,displayed_run_id,approved_run_id,approved_at,approved_by,newer_draft_run_id,active_run_id,active_run_status,official_valuation_date,latest_draft_valuation_date,latest_draft_run_id,approved_run_valuation_date,newer_draft_count,superseded_run_count";

// Lenses whose data come from a costing refresh run (pricing screens).
export const RUN_SCOPED_LENSES = new Set([
  "dashboard",
  "sku-cost-sheet",
  "printable-cost-sheet",
  "cost-comparison",
  "scheme-comparison",
  "sku-control-status",
]);

const TONE_BY_STATE = {
  APPROVED: "approved",
  APPROVED_NEWER_DRAFT: "approved-pending",
  DRAFT: "draft",
  REFERENCE_NOT_APPROVED: "draft",
  NO_SUCCESSFUL_RUN: "empty",
};

export function describeRunStatus(row) {
  if (!row) {
    return { text: "Run status unavailable", tone: "empty", title: "No run status for this month." };
  }
  const state = String(row.display_state || "");
  const tone = TONE_BY_STATE[state] || "draft";
  const text = String(row.display_label || "").trim() || "Run status unavailable";
  const parts = [text];
  if (row.approved_run_id && row.approved_at) {
    const by = row.approved_by ? ` by ${row.approved_by}` : "";
    parts.push(`Approved ${formatIst(row.approved_at)}${by}.`);
  }
  if (tone === "draft") parts.push("Figures are a draft and are not approved for pricing.");
  if (state === "APPROVED_NEWER_DRAFT") parts.push("Screens show the approved run; the newer draft is not used.");
  if (row.active_run_id) parts.push(`Run ${row.active_run_id} is ${String(row.active_run_status || "").toLowerCase()}.`);
  return { text, tone, title: parts.join(" ") };
}

export function formatIst(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST"
  );
}

export function applyRunStatusBadge(el, info, visible) {
  if (!el) return;
  el.hidden = !visible;
  if (!visible || !info) return;
  el.textContent = info.text;
  el.title = info.title;
  el.setAttribute("aria-label", info.title);
  el.dataset.tone = info.tone;
}

/**
 * CW-13: structured, server-derived run facts on the badge element (data-* only, no visible change). The mobile
 * header button/popover reads these instead of parsing text, so run ids and valuation dates always come from the
 * same governed row that produced the badge label. Keys are removed when the row does not carry the value.
 */
export function applyRunStatusDataset(el, row) {
  const ds = el?.dataset;
  if (!ds) return;
  const set = (key, value) => {
    if (value === null || value === undefined || value === "") delete ds[key];
    else ds[key] = String(value);
  };
  set("displayState", row?.display_state);
  set("runDisplayed", row?.displayed_run_id);
  set("runApproved", row?.approved_run_id);
  set("runDraft", row?.newer_draft_run_id ?? row?.latest_draft_run_id);
  set("valuationApproved", row?.approved_run_valuation_date ?? row?.official_valuation_date);
  set("valuationDraft", row?.latest_draft_valuation_date);
}

/**
 * UX-F1 (COSTING_REVIEW_WORKLIST_V1 ON only): compact header chip, e.g.
 * "Approved 143" + "Draft 148". The full explanation stays in title and
 * aria-label, exactly as computed for the long badge.
 */
export function applyCompactRunStatusBadge(el, compact, info) {
  if (!el) return;
  el.hidden = false;
  el.innerHTML = renderCompactRunBadgeHtml(compact);
  el.title = info.title;
  el.setAttribute("aria-label", info.title);
  el.dataset.tone = info.tone;
  el.dataset.compact = "1";
  if (compact.newerDraftRunId) el.dataset.newerDraft = compact.newerDraftRunId;
  else delete el.dataset.newerDraft;
  // Lets the narrow-screen header truncate the title instead of overlapping it (CSS, flag ON only).
  el.ownerDocument?.body?.classList?.add("ccc-compact-header");
}

export function createRunStatusBadge({ supabase, anchor, doc = globalThis.document }) {
  let el = null;
  let generation = 0;
  const cache = new Map();

  function ensureEl() {
    if (el || !anchor || !doc) return el;
    el = doc.createElement("span");
    el.id = "costingRunStatusBadge";
    el.className = "sc-run-status";
    el.setAttribute("role", "status");
    el.hidden = true;
    anchor.insertAdjacentElement("beforebegin", el);
    return el;
  }

  async function fetchRow(periodStart) {
    if (cache.has(periodStart)) return cache.get(periodStart);
    const approvalOn = isCostingApprovalScreenV1Enabled() || isCostingRecalcWithDateV1Enabled();
    const { data, error } = await supabase
      .from(RUN_STATUS_VIEW)
      .select(approvalOn ? RUN_STATUS_SELECT_APPROVAL_V1 : RUN_STATUS_SELECT_V1)
      .eq("period_start", periodStart)
      .maybeSingle();
    if (error) throw error;
    // Cache only settled months; an active run or draft can change soon.
    if (data && !data.active_run_id && data.display_state === "APPROVED") cache.set(periodStart, data);
    return data || null;
  }

  async function refresh({ periodStart, lensId, periodStatusRow }) {
    const node = ensureEl();
    if (!node) return;
    const my = ++generation;
    if (!periodStart || !RUN_SCOPED_LENSES.has(lensId)) {
      applyRunStatusDataset(node, null);
      applyRunStatusBadge(node, null, false);
      return;
    }
    try {
      const row = periodStatusRow === undefined ? await fetchRow(periodStart) : periodStatusRow;
      if (my !== generation) return;
      applyRunStatusDataset(node, row);
      const approvalOn = isCostingApprovalScreenV1Enabled();
      const info = approvalOn
        ? describeRunStatusForApprovalFlag(row)
        : describeRunStatus(row);
      if (isCostingUxConsistencyV1Enabled() && !approvalOn) {
        info.text = costingRunBadgeDisplayLabel(info.text);
      }
      if (isCostingReviewWorklistV1Enabled()) {
        applyCompactRunStatusBadge(node, describeCompactRunBadge(row), info);
        return;
      }
      applyRunStatusBadge(node, info, true);
    } catch (err) {
      if (my !== generation) return;
      applyRunStatusDataset(node, null);
      console.warn("Run status unavailable", err);
      applyRunStatusBadge(node, { text: "Run status unavailable", tone: "empty", title: "Could not read the run status." }, true);
    }
  }

  return { refresh, invalidate: () => cache.clear() };
}
