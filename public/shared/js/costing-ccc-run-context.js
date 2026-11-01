// UX-F1: Costing Control Centre run context (flag COSTING_REVIEW_WORKLIST_V1,
// default OFF). Pure presentation helpers: compact header badge, KPI-strip run
// caption, dashboard run-context card and a latest-only loader. No data access,
// no clock, no DOM at import. Every run id, count and date comes from server
// rows passed in; nothing here is hard-coded per run.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function idText(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function numOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Header badge (compact)
// ---------------------------------------------------------------------------

/**
 * Compact header label from one period run-status row. The full server
 * explanation stays in the badge title / aria-label (set by the caller).
 */
export function describeCompactRunBadge(row) {
  if (!row) return Object.freeze({ text: "Status unavailable", draftText: null, newerDraftRunId: null });
  const state = String(row.display_state || "").trim().toUpperCase();
  const displayed = idText(row.displayed_run_id);
  const newerDraft = idText(row.newer_draft_run_id);
  let text;
  if (!displayed || state === "NO_SUCCESSFUL_RUN") text = "No run";
  else if (state === "APPROVED" || state === "APPROVED_NEWER_DRAFT") text = `Approved ${displayed}`;
  else if (state === "REFERENCE_NOT_APPROVED") text = `Reference ${displayed}`;
  else text = `Draft ${displayed}`;
  const draftText = newerDraft && newerDraft !== displayed ? `Draft ${newerDraft}` : null;
  return Object.freeze({ text, draftText, newerDraftRunId: draftText ? newerDraft : null });
}

/** Inner HTML for the compact badge (escaped). */
export function renderCompactRunBadgeHtml(compact) {
  const main = `<span class="sc-run-status-main">${escapeHtml(compact?.text || "")}</span>`;
  if (!compact?.draftText) return main;
  return `${main}<span class="sc-run-status-draft" aria-hidden="true">${escapeHtml(compact.draftText)}</span>`;
}

// ---------------------------------------------------------------------------
// KPI strip caption
// ---------------------------------------------------------------------------

/**
 * Caption for the global KPI strip. The strip's own data (the control
 * dashboard snapshot row) names its run; the status row (optional) says
 * whether that run is the approved one. If the worklist below shows another
 * run, the caption says so, so 143 KPIs never read as 148 KPIs.
 */
export function describeKpiRunCaption({ summary, statusRow = null, worklistRunId = null }) {
  const runId = idText(summary?.refresh_run_id);
  if (!runId) return null;
  const valuation = idText(summary?.valuation_date);
  const approved = idText(statusRow?.approved_run_id);
  let runLabel = `run ${runId}`;
  if (statusRow && approved && approved === runId) runLabel = `approved run ${runId}`;
  else if (statusRow && approved !== runId) runLabel = `run ${runId} (not approved)`;
  const other = idText(worklistRunId);
  return Object.freeze({
    runId,
    text: `KPIs: ${runLabel}${valuation ? ` · valuation ${valuation}` : ""}`,
    otherRunWarning: other && other !== runId ? `The worklist below shows run ${other}; these KPIs are not from it.` : null,
  });
}

export function renderKpiRunCaptionHtml(caption) {
  if (!caption) return "";
  return `<span class="ccc-kpi-caption-run">${escapeHtml(caption.text)}</span>${
    caption.otherRunWarning ? `<span class="ccc-kpi-caption-warn" role="note">${escapeHtml(caption.otherRunWarning)}</span>` : ""
  }`;
}

// ---------------------------------------------------------------------------
// Draft run summary (from rows of the run-scoped view)
// ---------------------------------------------------------------------------

export const CCC_DRAFT_SUMMARY_SELECT = "period_start,refresh_run_id,valuation_date,control_severity";

/**
 * Counts of one run's rows by raw server severity. Rows must all belong to the
 * period and run asked for; otherwise the summary is rejected.
 */
export function summariseRunRows(rows, { periodStart, runId }) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return Object.freeze({ ok: false, reason: "empty", runId: idText(runId) });
  for (const r of list) {
    if (String(r?.period_start ?? "") !== String(periodStart) || idText(r?.refresh_run_id) !== idText(runId)) {
      return Object.freeze({ ok: false, reason: "foreign", runId: idText(runId) });
    }
  }
  const counts = { BLOCKER: 0, REVIEW_REQUIRED: 0, READY: 0, OTHER: 0 };
  const dates = [];
  for (const r of list) {
    const sev = String(r?.control_severity ?? "").trim().toUpperCase();
    if (sev in counts) counts[sev] += 1;
    else counts.OTHER += 1;
    const d = idText(r?.valuation_date);
    if (d && !dates.includes(d)) dates.push(d);
  }
  return Object.freeze({ ok: true, reason: null, runId: idText(runId), total: list.length, counts: Object.freeze(counts), valuationDates: Object.freeze(dates) });
}

// ---------------------------------------------------------------------------
// Dashboard run-context card
// ---------------------------------------------------------------------------

/**
 * Model for the dashboard card. `status` and `draft` are loader states
 * ({ status: idle|loading|ready|error, row, error }).
 */
export function describeDashboardRunContext({ periodStart, status, summary, draft }) {
  const st = status?.status || "idle";
  const row = st === "ready" ? status.row : null;
  const displayed = idText(row?.displayed_run_id);
  const approved = idText(row?.approved_run_id);
  const newerDraft = idText(row?.newer_draft_run_id);
  const summaryRunId = idText(summary?.refresh_run_id);
  const shown = summary
    ? {
        runId: summaryRunId,
        approved: Boolean(approved && summaryRunId === approved),
        valuation: idText(summary.valuation_date),
        total: numOrNull(summary.total_sku_count),
        ready: numOrNull(summary.ready_sku_count),
        review: numOrNull(summary.review_required_sku_count),
        blocker: numOrNull(summary.blocked_sku_count),
        mismatch: Boolean(displayed && summaryRunId && summaryRunId !== displayed),
      }
    : null;
  let draftModel = null;
  if (newerDraft && newerDraft !== summaryRunId) {
    const ds = draft?.status || "idle";
    const d = ds === "ready" ? draft.row : null;
    draftModel = {
      runId: newerDraft,
      state: ds === "ready" ? (d?.ok ? "ready" : d?.reason || "empty") : ds,
      error: ds === "error" ? draft.error : null,
      total: d?.ok ? d.total : null,
      ready: d?.ok ? d.counts.READY : null,
      review: d?.ok ? d.counts.REVIEW_REQUIRED : null,
      blocker: d?.ok ? d.counts.BLOCKER : null,
      valuation: d?.ok && d.valuationDates.length === 1 ? d.valuationDates[0] : d?.ok ? d.valuationDates.join(", ") || null : null,
    };
  }
  return Object.freeze({
    periodStart: periodStart ? String(periodStart) : null,
    statusState: st,
    statusError: st === "error" ? status.error : null,
    serverLabel: row?.display_label ?? null,
    serverState: row?.display_state ?? null,
    displayedRunId: displayed,
    approvedRunId: approved,
    activeRunId: idText(row?.active_run_id),
    activeRunStatus: row?.active_run_status ?? null,
    shown,
    draft: draftModel,
  });
}

function stat(label, value, cls = "") {
  const v = value === null || value === undefined ? "--" : String(value);
  return `<div class="ccc-rc-stat${cls ? ` ${cls}` : ""}"><span class="ccc-rc-stat-value">${escapeHtml(v)}</span><span class="ccc-rc-stat-label">${escapeHtml(label)}</span></div>`;
}

/** HTML for the dashboard run-context card. All server text escaped. */
export function renderDashboardRunContextHtml(m) {
  if (!m) return "";
  const e = escapeHtml;
  const parts = [];
  parts.push(`<div class="ccc-rc-head"><h2 class="ccc-rc-title">Run context · ${e(m.periodStart || "--")}</h2>${
    m.serverLabel ? `<span class="ccc-rc-server" title="Server run status">${e(m.serverLabel)}</span>` : ""
  }</div>`);
  if (m.statusState === "loading") parts.push(`<div class="ccc-rc-note" role="status">Loading run status…</div>`);
  if (m.statusState === "error") {
    parts.push(`<div class="ccc-rc-note ccc-rc-warn" role="alert">Run status could not be read: ${e(m.statusError || "unknown error")}. Approved/draft designation is not verified.</div>`);
  }
  if (m.statusState === "ready" && !m.displayedRunId) {
    parts.push(`<div class="ccc-rc-note ccc-rc-warn">No run status for this period (no run yet, or no permission).</div>`);
  }
  const cards = [];
  if (m.shown) {
    const s = m.shown;
    const title = s.approved ? `Approved run ${e(s.runId)}` : `Run ${e(s.runId)} · not approved`;
    cards.push(`<div class="ccc-rc-card ${s.approved ? "ccc-rc-approved" : "ccc-rc-draftshown"}">
  <div class="ccc-rc-card-head"><span class="ccc-rc-card-title">${title}</span><span class="ccc-rc-tag">${s.approved ? "Displayed · KPIs" : "Displayed · not approved"}</span></div>
  <div class="ccc-rc-card-sub">Valuation ${e(s.valuation || "--")}</div>
  <div class="ccc-rc-stats">${stat("Ready", s.ready !== null && s.total !== null ? `${s.ready} / ${s.total}` : s.ready, "ccc-rc-ready")}${stat("Review", s.review, "ccc-rc-review")}${stat("Blocked", s.blocker, "ccc-rc-blocked")}</div>
  ${s.mismatch ? `<div class="ccc-rc-note ccc-rc-warn" role="alert">These KPIs are from run ${e(s.runId)}, but the server now displays run ${e(m.displayedRunId)}. Reload the period.</div>` : ""}
</div>`);
  } else if (m.statusState !== "loading") {
    cards.push(`<div class="ccc-rc-card"><div class="ccc-rc-note">No control snapshot for this period.</div></div>`);
  }
  if (m.draft) {
    const d = m.draft;
    let body;
    if (d.state === "ready") {
      body = `<div class="ccc-rc-card-sub">Valuation ${e(d.valuation || "--")}</div>
  <div class="ccc-rc-stats">${stat("Ready", d.ready !== null && d.total !== null ? `${d.ready} / ${d.total}` : d.ready, "ccc-rc-ready")}${stat("Review", d.review, "ccc-rc-review")}${stat("Blocked", d.blocker, "ccc-rc-blocked")}</div>`;
    } else if (d.state === "loading" || d.state === "idle") {
      body = `<div class="ccc-rc-note" role="status">Loading draft run counts…</div>`;
    } else if (d.state === "error") {
      body = `<div class="ccc-rc-note ccc-rc-warn" role="alert">Draft counts could not be read: ${e(d.error || "unknown error")}.</div>`;
    } else if (d.state === "foreign") {
      body = `<div class="ccc-rc-note ccc-rc-warn" role="alert">The server returned rows of another run; draft counts not shown.</div>`;
    } else {
      body = `<div class="ccc-rc-note ccc-rc-warn">No draft rows returned (no permission, or the run has no SKU rows).</div>`;
    }
    cards.push(`<div class="ccc-rc-card ccc-rc-draft">
  <div class="ccc-rc-card-head"><span class="ccc-rc-card-title">Draft run ${e(d.runId)}</span><span class="ccc-rc-tag ccc-rc-tag-draft">Not for pricing</span></div>
  ${body}
  <div class="ccc-rc-actions"><button type="button" class="ccc-rc-cta" data-ccc-review-draft="${e(d.runId)}">Review draft ${e(d.runId)}</button></div>
</div>`);
  } else if (m.statusState === "ready" && m.displayedRunId) {
    cards.push(`<div class="ccc-rc-card ccc-rc-none"><div class="ccc-rc-note">No newer draft run for this period.</div></div>`);
  }
  parts.push(`<div class="ccc-rc-cards">${cards.join("\n")}</div>`);
  if (m.activeRunId) {
    parts.push(`<div class="ccc-rc-note">Run ${e(m.activeRunId)} is ${e(m.activeRunStatus || "in progress")}; its figures appear when it finishes.</div>`);
  }
  parts.push(`<details class="ccc-rc-details"><summary>About these figures</summary>
  <p>The KPI strip and the approved card show the run displayed for this period (the governed run). Draft counts come from the draft run's own frozen SKU rows and are never mixed into the KPIs.</p>
  <p>A draft run is not used for pricing unless it is separately approved. Reviewing it here is read-only.</p>
  ${m.serverState ? `<p>Server state: <code>${e(m.serverState)}</code></p>` : ""}
</details>`);
  return `<section class="ccc-rc" aria-label="Run context">${parts.join("\n")}</section>`;
}

// ---------------------------------------------------------------------------
// Latest-only loader (generic; stale answers discarded)
// ---------------------------------------------------------------------------

/**
 * `query(arg)` returns a promise of { data, error } or a value. ensure(key,
 * arg, ref, onSettled) starts a new request whenever `key` or `ref` changes;
 * a late answer for an older key/ref is discarded.
 */
export function createLatestOnlyLoader({ query, map = (data) => data }) {
  let generation = 0;
  let current = { key: null, ref: null, status: "idle", row: null, error: null };
  const snapshot = () => Object.freeze({ ...current });
  function ensure(key, arg, ref, onSettled) {
    if (key === null || key === undefined) {
      if (current.key !== null) {
        generation += 1;
        current = { key: null, ref: null, status: "idle", row: null, error: null };
      }
      return snapshot();
    }
    if (current.key === key && current.ref === ref) return snapshot();
    const my = ++generation;
    current = { key, ref, status: "loading", row: null, error: null };
    Promise.resolve()
      .then(() => query(arg))
      .then(
        (result) => {
          if (my !== generation) return;
          if (result?.error) current = { key, ref, status: "error", row: null, error: String(result.error?.message || result.error) };
          else current = { key, ref, status: "ready", row: map(result?.data !== undefined ? result.data : result), error: null };
          onSettled?.();
        },
        (error) => {
          if (my !== generation) return;
          current = { key, ref, status: "error", row: null, error: String(error?.message || error) };
          onSettled?.();
        },
      );
    return snapshot();
  }
  return { ensure, state: snapshot };
}
