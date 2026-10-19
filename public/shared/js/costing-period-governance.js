// W2: "Period & runs" panel (Costing Control Center).
// Calls the governed W2 RPCs only (public.rpc_costing_*). Every action asks for a reason and an approval
// reference; owner-only actions (approve, authorise supersession, supersede, close) are shown to the owner only.
// The database enforces every rule again; this module only decides what to offer. Pure helpers are exported for tests.

export const STATUS_VIEW = "v_costing_pricing_period_run_status";
export const SUPERSESSION_VALID_MINUTES = 120;

export const RPC = {
  context: "rpc_costing_period_governance_context",
  preflight: "rpc_costing_preflight_run",
  open: "rpc_costing_open_next_period",
  approve: "rpc_costing_approve_run",
  lock: "rpc_costing_lock_period",
  reopen: "rpc_costing_reopen_period",
  authorise: "rpc_costing_authorise_supersession",
  supersede: "rpc_costing_supersede_approved_run",
  close: "rpc_costing_close_period",
};

export const ACTION_LABELS = {
  open: "Open next month",
  approve: "Approve run",
  lock: "Lock month",
  reopen: "Reopen month",
  authorise: "Authorise supersession",
  supersede: "Supersede approved run",
  close: "Close month",
};

export const OWNER_ONLY = new Set(["approve", "authorise", "supersede", "close"]);

export const CHECK_LABELS = {
  RUN_EXISTS: "Run exists",
  RUN_SUCCESS: "Run finished successfully",
  NOT_ALREADY_DESIGNATED: "Run not already approved or revoked",
  PERIOD_OPEN: "Month is open",
  VALUATION_DATE_MATCHES: "Run valuation date = month valuation date",
  NO_ACTIVE_RUN: "No queued or running run",
  FINGERPRINT_CAPTURED: "Run fingerprint captured",
  FINGERPRINT_CLEAN: "Run data unchanged since capture",
  HAS_COST_SHEET: "Cost sheet present",
  NO_BLOCKED_SKUS: "No BLOCKED SKUs",
  REVIEW_REQUIRED_RECORDED: "REVIEW_REQUIRED SKUs (allowed, recorded)",
  NO_OTHER_APPROVED_RUN: "No other approved run this month",
  HAS_APPROVED_RUN_TO_SUPERSEDE: "Month has an approved run to supersede",
  NEWER_THAN_APPROVED: "Run is newer than the approved run",
  SUPERSESSION_AUTHORISATION_CONSUMED: "Run was created under a supersession authorisation",
};

function deny(reason) {
  return { enabled: false, reason };
}
function allow(extra = {}) {
  return { enabled: true, reason: "", ...extra };
}

// Decide which actions to offer for one month row (from v_costing_pricing_period_run_status).
// ctx = rpc_costing_period_governance_context(). Returns [{ id, label, ownerOnly, enabled, reason, runId? }].
// Owner-only actions are omitted entirely for non-owners; editor actions are omitted for view-only users.
export function allowedActions(ctx, row) {
  const out = [];
  if (!ctx || !ctx.can_view || !row) return out;
  const status = String(row.period_status || "");
  const busy = row.active_run_id ? `Run ${row.active_run_id} is ${String(row.active_run_status || "active").toLowerCase()}` : "";
  const approved = row.approved_run_id || null;
  const candidate = approved ? null : row.latest_success_run_id || null;
  const newer = approved ? row.newer_draft_run_id || null : null;
  const push = (id, verdict) => {
    if (OWNER_ONLY.has(id) && !ctx.is_owner) return;
    if (!OWNER_ONLY.has(id) && !ctx.can_edit) return;
    out.push({ id, label: ACTION_LABELS[id], ownerOnly: OWNER_ONLY.has(id), ...verdict });
  };
  if (status === "CLOSED") return out; // closed months are final: nothing to offer

  if (status === "OPEN") {
    push("approve",
      approved ? deny(`Run ${approved} is already approved; use supersede`)
      : !candidate ? deny("No successful run to approve")
      : busy ? deny(busy)
      : allow({ runId: candidate }));
    push("lock",
      !approved ? deny("Approve a run first")
      : busy ? deny(busy)
      : allow({ runId: approved }));
    if (approved) {
      // The database refuses a second unexpired authorisation; a newer draft that finished before approval
      // was not made under an authorisation, so it never blocks authorising.
      push("authorise", busy ? deny(busy) : allow({ runId: approved }));
      push("supersede",
        !newer ? deny("Authorise supersession and run a new refresh first")
        // Pre-checks (shown before confirming) verify the run was created under the authorisation.
        : busy ? deny(busy)
        : allow({ runId: newer }));
    }
    push("close", deny("Lock the month before closing"));
  } else if (status === "LOCKED") {
    push("reopen", allow());
    push("close", allow({ runId: approved }));
  }
  return out;
}

export function openNextAction(ctx) {
  if (!ctx || !ctx.can_edit || !ctx.next_period_start) return null;
  return {
    id: "open",
    label: `${ACTION_LABELS.open} (${monthLabel(ctx.next_period_start)})`,
    ownerOnly: false,
    enabled: true,
    reason: "",
    periodStart: ctx.next_period_start,
    defaultValuationDate: ctx.default_valuation_date || null,
  };
}

export function validateActionInput({ reason, approvalReference, valuationDate, periodStart } = {}) {
  const errors = [];
  if (String(reason || "").trim().length < 10) errors.push("Reason must be at least 10 characters.");
  if (!String(approvalReference || "").trim()) errors.push("Approval reference is required.");
  if (valuationDate && periodStart) {
    const start = String(periodStart).slice(0, 7);
    if (String(valuationDate).slice(0, 7) !== start) errors.push("Valuation date must be inside the month being opened.");
  }
  return errors;
}

// Map an action to its RPC call.
export function rpcCall(action, row, input) {
  const reason = String(input.reason || "").trim();
  const ref = String(input.approvalReference || "").trim();
  const p = row ? row.period_start : null;
  switch (action.id) {
    case "open":
      return { name: RPC.open, params: { p_reason: reason, p_approval_reference: ref, p_valuation_date: input.valuationDate || null } };
    case "approve":
      return { name: RPC.approve, params: { p_refresh_run_id: action.runId, p_reason: reason, p_approval_reference: ref } };
    case "supersede":
      return { name: RPC.supersede, params: { p_new_refresh_run_id: action.runId, p_reason: reason, p_approval_reference: ref } };
    case "lock":
    case "reopen":
    case "authorise":
    case "close":
      return { name: RPC[action.id], params: { p_period_start: p, p_reason: reason, p_approval_reference: ref } };
    default:
      throw new Error(`Unknown action ${action.id}`);
  }
}

export function preflightModeFor(actionId) {
  if (actionId === "approve") return "APPROVE";
  if (actionId === "supersede") return "SUPERSEDE";
  return null;
}

export function describePreflight(chk) {
  if (!chk || !Array.isArray(chk.checks)) return { ok: false, rows: [], summary: "Checks unavailable" };
  const rows = chk.checks.map((c) => ({ code: c.code, label: CHECK_LABELS[c.code] || c.code, pass: !!c.pass, detail: c.detail || "" }));
  const failed = rows.filter((r) => !r.pass).length;
  const counts = chk.counts || {};
  const summary = failed
    ? `${failed} check${failed === 1 ? "" : "s"} failed - this run cannot be ${chk.mode === "SUPERSEDE" ? "used to supersede" : "approved"}.`
    : `All checks pass. ${counts.total ?? 0} SKUs (${counts.review_required ?? 0} REVIEW_REQUIRED will be recorded).`;
  return { ok: !!chk.ok && failed === 0, rows, summary };
}

// Strip the W2_/AU2_ code prefix from a database refusal for display.
export function friendlyError(err) {
  const msg = String((err && (err.message || err.details)) || err || "Action refused");
  const m = msg.match(/^(?:W2|AU2)_[A-Z_]+:\s*(.*)$/s);
  if (/^W2_OWNER_ONLY/.test(msg)) return "Only the costing owner can do this.";
  if (/Permission denied/i.test(msg)) return "You do not have permission for this action.";
  return m ? m[1] : msg;
}

export function monthLabel(periodStart) {
  const d = new Date(`${String(periodStart).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(periodStart || "");
  return d.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------------------------
// DOM panel: a "Period & runs" button that opens a dialog listing months with the allowed actions.
export function createPeriodGovernancePanel({ supabase, anchor, doc = globalThis.document, notify = () => {}, onChanged = () => {} }) {
  let button = null;
  let dialog = null;
  let ctx = null;

  function el(tag, attrs = {}, ...children) {
    const n = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children) if (c) n.append(c);
    return n;
  }

  async function loadContext() {
    const { data, error } = await supabase.rpc(RPC.context);
    if (error) throw error;
    ctx = data;
    return ctx;
  }

  async function loadRows() {
    const { data, error } = await supabase
      .from(STATUS_VIEW)
      .select("period_start,period_status,valuation_date,valuation_date_status,approved_run_id,approved_at,approved_by,latest_success_run_id,newer_draft_run_id,active_run_id,active_run_status,display_state,display_label")
      .order("period_start", { ascending: false })
      .limit(12);
    if (error) throw error;
    return data || [];
  }

  function ensureButton() {
    if (button || !anchor || !doc) return button;
    button = el("button", { type: "button", class: "sc-period-runs-btn", id: "costingPeriodRunsBtn", hidden: true, text: "Period & runs",
      onclick: () => void openDialog() });
    anchor.insertAdjacentElement("beforebegin", button);
    return button;
  }

  async function setVisible(visible) {
    const b = ensureButton();
    if (!b) return;
    if (!visible) { b.hidden = true; return; }
    try {
      const c = ctx || (await loadContext());
      b.hidden = !c || !c.can_view;
    } catch (err) {
      console.warn("Period governance context unavailable", err);
      b.hidden = true;
    }
  }

  function closeDialog() {
    if (dialog) { dialog.close?.(); dialog.remove(); dialog = null; }
  }

  async function openDialog() {
    closeDialog();
    dialog = el("dialog", { class: "sc-period-runs-dialog", "aria-label": "Period and runs" });
    doc.body.append(dialog);
    dialog.showModal?.();
    const body = el("div", { class: "sc-pr-body", text: "Loading..." });
    dialog.append(el("header", { class: "sc-pr-head" }, el("h2", { text: "Period & runs" }),
      el("button", { type: "button", class: "sc-pr-x", "aria-label": "Close", text: "\u00d7", onclick: closeDialog })), body);
    try {
      await loadContext();
      const rows = await loadRows();
      renderList(body, rows);
    } catch (err) {
      body.textContent = `Could not load periods: ${friendlyError(err)}`;
    }
  }

  function renderList(body, rows) {
    body.textContent = "";
    const role = ctx.is_owner ? "Owner" : ctx.can_edit ? "Editor" : "View only";
    body.append(el("p", { class: "sc-pr-role", text: `Your role: ${role}. Approve, supersede and close are owner-only. Every action needs a reason and an approval reference and is recorded in the audit log.` }));
    const next = openNextAction(ctx);
    if (next) body.append(el("div", { class: "sc-pr-open" }, el("button", { type: "button", class: "sc-pr-action", text: next.label, onclick: () => renderForm(body, next, null, rows) })));
    const table = el("table", { class: "sc-pr-table" });
    table.append(el("thead", {}, el("tr", {}, ...["Month", "Status", "Valuation date", "Runs", "Actions"].map((h) => el("th", { text: h })))));
    const tb = el("tbody");
    for (const row of rows) {
      const acts = allowedActions(ctx, row);
      const cell = el("td", { class: "sc-pr-acts" });
      for (const a of acts) {
        cell.append(el("button", { type: "button", class: `sc-pr-action${a.ownerOnly ? " is-owner" : ""}`, disabled: !a.enabled, title: a.reason || (a.runId ? `Run ${a.runId}` : ""),
          text: a.runId && (a.id === "approve" || a.id === "supersede") ? `${a.label} ${a.runId}` : a.label,
          onclick: () => renderForm(body, a, row, rows) }));
      }
      if (!acts.length) cell.textContent = row.period_status === "CLOSED" ? "Closed (final)" : "-";
      tb.append(el("tr", {}, el("td", { text: monthLabel(row.period_start) }), el("td", { text: row.period_status }),
        el("td", { text: `${row.valuation_date || "-"} (${row.valuation_date_status || "-"})` }), el("td", { text: row.display_label || "-" }), cell));
    }
    table.append(tb);
    body.append(table);
  }

  async function renderForm(body, action, row, rows) {
    body.textContent = "";
    const title = row ? `${action.label} - ${monthLabel(row.period_start)}` : action.label;
    body.append(el("h3", { text: title }));
    const mode = preflightModeFor(action.id);
    let preflightOk = !mode;
    if (mode) {
      const box = el("div", { class: "sc-pr-checks", text: `Checking run ${action.runId}...` });
      body.append(box);
      const { data, error } = await supabase.rpc(RPC.preflight, { p_refresh_run_id: action.runId, p_mode: mode });
      box.textContent = "";
      if (error) { box.textContent = friendlyError(error); }
      else {
        const d = describePreflight(data);
        preflightOk = d.ok;
        box.append(el("p", { class: d.ok ? "is-ok" : "is-fail", text: d.summary }));
        const ul = el("ul");
        for (const r of d.rows) ul.append(el("li", { class: r.pass ? "is-ok" : "is-fail", text: `${r.pass ? "\u2713" : "\u2717"} ${r.label}${r.detail ? ` - ${r.detail}` : ""}` }));
        box.append(ul);
      }
    }
    if (action.id === "authorise") body.append(el("p", { class: "sc-pr-note", text: `The authorisation allows one new refresh run for this month and expires after ${SUPERSESSION_VALID_MINUTES} minutes. The approved run stays in use until you supersede it.` }));
    if (action.id === "close") body.append(el("p", { class: "sc-pr-note is-fail", text: "Closing is final: a closed month can never be reopened." }));
    const form = el("form", { class: "sc-pr-form" });
    let vd = null;
    if (action.id === "open") {
      vd = el("input", { type: "date", name: "valuation_date", value: action.defaultValuationDate || "", min: action.periodStart, required: true });
      form.append(el("label", { text: "Valuation date (default: the day it is opened; editable within the month)" }, vd));
    }
    const reason = el("textarea", { name: "reason", rows: 2, required: true, placeholder: "Why (at least 10 characters)" });
    const ref = el("input", { type: "text", name: "approval_reference", required: true, placeholder: "e.g. meeting note or approval id" });
    const msg = el("p", { class: "sc-pr-msg", role: "alert" });
    const submit = el("button", { type: "submit", class: "sc-pr-action is-primary", disabled: !preflightOk, text: action.label });
    form.append(el("label", { text: "Reason" }, reason), el("label", { text: "Approval reference" }, ref), msg,
      el("div", { class: "sc-pr-buttons" }, el("button", { type: "button", text: "Back", onclick: () => renderList(body, rows) }), submit));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const input = { reason: reason.value, approvalReference: ref.value, valuationDate: vd ? vd.value : null, periodStart: action.periodStart };
      if (vd && input.valuationDate === action.defaultValuationDate) input.valuationDate = null; // keep SYSTEM_DEFAULT source
      const errs = validateActionInput({ ...input, valuationDate: vd ? vd.value : null });
      if (errs.length) { msg.textContent = errs.join(" "); return; }
      submit.disabled = true;
      const call = rpcCall(action, row, input);
      const { error } = await supabase.rpc(call.name, call.params);
      if (error) { msg.textContent = friendlyError(error); submit.disabled = !preflightOk; return; }
      notify(`${action.label}: done.`, "success");
      onChanged();
      try { renderList(body, await loadRows()); } catch (err) { body.textContent = friendlyError(err); }
    });
    body.append(form);
  }

  return { setVisible, open: openDialog, close: closeDialog, invalidate: () => { ctx = null; } };
}
