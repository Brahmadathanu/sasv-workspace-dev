import {
  formatMappedErrorForDisplay,
  mapCostingLockError,
} from "./costing-approval-errors.js";
import {
  formatOfficialValuationDate,
  pickPeriodDisplayLabel,
  pickPricingUseLabel,
} from "./costing-approval-labels.js";

export const LOCK_PERIOD_STATUS_VIEW = "v_costing_pricing_period_run_status";
export const LOCK_RPC = Object.freeze({
  batch: "rpc_costing_lock_periods_for_close",
  single: "rpc_costing_lock_period",
});
export const LOCK_STATUS_SELECT =
  "period_start,period_status,display_label,display_label_v2,official_valuation_date,approved_run_id,pricing_use_label";

const STATE_ONLY_TEXT =
  "Locking changes the lock state only. It does not change any date, run or price. Unlocking needs a separate governed reopen.";
const MONTH_ENDED_REMINDER =
  "Lock only months that have ended. The server does not yet check this.";
const BATCH_ATOMIC_TEXT =
  "All or nothing: if any month cannot be locked, none is locked.";
const EXCEPTION_TEXT =
  "Normally months are locked together at quarter close. Use this only for an authorised exception.";

function $(id, doc) {
  return doc?.getElementById?.(id) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unwrapRpcJson(value) {
  const row = Array.isArray(value) ? value[0] : value;
  if (typeof row !== "string") return row;
  try {
    return JSON.parse(row);
  } catch {
    return row;
  }
}

export function quarterLabel(periodStart) {
  const text = String(periodStart || "");
  const year = text.slice(0, 4);
  const month = Number(text.slice(5, 7));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || month < 1 || month > 12) {
    return "Other periods";
  }
  return `${year} Q${Math.floor((month - 1) / 3) + 1}`;
}

export function buildSingleLockPayload(periodStart, reason, approvalReference) {
  return {
    p_period_start: String(periodStart || ""),
    p_reason: String(reason || "").trim(),
    p_approval_reference: String(approvalReference || "").trim(),
  };
}

export function buildBatchLockPayload(periodStarts, reason, approvalReference) {
  return {
    p_period_starts: Array.from(periodStarts || [], (value) => String(value)),
    p_reason: String(reason || "").trim(),
    p_approval_reference: String(approvalReference || "").trim(),
  };
}

export function lockSuccessLines(payload) {
  const data = unwrapRpcJson(payload) || {};
  const rows = Array.isArray(data.locked) ? data.locked : [data];
  return rows
    .filter((row) => row && row.period_start)
    .map(
      (row) =>
        `${row.period_start}: LOCKED; approved run ${row.approved_run}; official date ${row.official_valuation_date}; audit ${row.audit_id}`,
    );
}

export function createCostingLockScreenController(deps) {
  const {
    supabase,
    costingRpc,
    showToast,
    isControlCenterRoute,
    doc = globalThis.document,
  } = deps;
  const state = {
    mounted: false,
    inFlight: false,
    loadGeneration: 0,
    rows: [],
    mode: null,
    selectedPeriodStarts: [],
    succeeded: false,
  };

  function setVisible(node, visible) {
    if (!node) return;
    node.hidden = !visible;
    node.setAttribute?.("aria-hidden", visible ? "false" : "true");
    node.classList?.toggle?.("hidden", !visible);
  }

  function panel() {
    return $("costingLockPanel", doc);
  }

  function dialog() {
    return $("costingLockDialog", doc);
  }

  function ensureMarkup() {
    if (panel() && dialog()) return;
    const panelMarkup = `<div id="costingLockPanel" class="cas-panel cls-panel hidden" hidden aria-hidden="true" aria-label="Close costing periods">
        <div class="cas-panel-head">
          <div class="cas-panel-title">Close period</div>
          <div class="cas-muted">Select months explicitly. The server decides whether they can be locked.</div>
        </div>
        <div id="clsPeriodList" class="cas-run-list cls-period-list"></div>
        <button type="button" class="icon-btn icon-btn-primary" id="clsCloseQuarterBtn">Close quarter (lock months)</button>
      </div>`;
    const runStatusPanel = $("costingRunStatusPanel", doc);
    if (runStatusPanel?.insertAdjacentHTML) {
      runStatusPanel.insertAdjacentHTML("beforebegin", panelMarkup);
    } else {
      $("costingApprovalPanel", doc)?.insertAdjacentHTML?.("afterend", panelMarkup);
    }
    const dialogMarkup = `<div id="costingLockDialog" class="cost-sheet-sign-modal hidden" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="clsDialogTitle">
      <div class="cost-sheet-sign-panel cls-modal-panel">
        <div class="cost-sheet-sign-header">
          <span class="cp-modal-title" id="clsDialogTitle">Close quarter (lock months)</span>
          <button type="button" class="icon-btn" id="clsCloseBtn" title="Close" aria-label="Close">×</button>
        </div>
        <div class="cost-sheet-sign-body">
          <div id="clsDialogIntro" class="cls-dialog-intro"></div>
          <div id="clsSelectedPeriods" class="cas-block"></div>
          <form id="clsLockForm" class="cas-approve-form">
            <label>Reason <span style="color: #b91c1c">*</span><textarea id="clsReason" class="form-control" rows="3"></textarea></label>
            <label>Approval reference <span style="color: #b91c1c">*</span><input id="clsApprovalReference" class="form-control" type="text"></label>
            <div id="clsFormError" class="cas-danger" hidden role="alert"></div>
            <div id="clsResult" class="cas-block cls-result" hidden role="status"></div>
          </form>
        </div>
        <div class="cost-sheet-sign-actions">
          <button type="button" class="icon-btn" id="clsCancelBtn">Cancel</button>
          <button type="button" class="icon-btn icon-btn-primary" id="clsSubmitBtn">Lock selected month(s)</button>
        </div>
      </div>
    </div>`;
    const toast = $("peqToastContainer", doc);
    if (toast?.insertAdjacentHTML) toast.insertAdjacentHTML("beforebegin", dialogMarkup);
    else doc?.body?.insertAdjacentHTML?.("beforeend", dialogMarkup);
  }

  function renderRows(rows) {
    const host = $("clsPeriodList", doc);
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = '<div class="cas-muted">No costing periods returned.</div>';
      return;
    }
    const groups = new Map();
    for (const row of rows) {
      const group = quarterLabel(row.period_start);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(row);
    }
    host.innerHTML = [...groups.entries()]
      .map(
        ([group, groupRows]) => `<section class="cls-quarter">
          <div class="cas-panel-title">${escapeHtml(group)}</div>
          ${groupRows
            .map((row) => {
              const label = pickPeriodDisplayLabel(row) || row.period_status || "—";
              const pricing = pickPricingUseLabel(row) || "—";
              const run = row.approved_run_id == null ? "Not approved" : `Run ${row.approved_run_id}`;
              return `<article class="cas-run-card cls-period-row">
                <label class="cls-period-choice">
                  <input type="checkbox" data-cls-period="${escapeHtml(row.period_start)}">
                  <span><strong>${escapeHtml(row.period_start)}</strong> · ${escapeHtml(label)}</span>
                </label>
                <div class="cas-muted">${escapeHtml(pricing)} · ${escapeHtml(run)} · Official date ${escapeHtml(formatOfficialValuationDate(row))}</div>
                <button type="button" class="cas-action" data-cls-single="${escapeHtml(row.period_start)}">Lock a single month (authorised exception)</button>
              </article>`;
            })
            .join("")}
        </section>`,
      )
      .join("");
  }

  async function reload() {
    const generation = ++state.loadGeneration;
    const host = $("clsPeriodList", doc);
    if (host) host.innerHTML = '<div class="cas-muted">Loading periods…</div>';
    try {
      const result = await supabase
        .from(LOCK_PERIOD_STATUS_VIEW)
        .select(LOCK_STATUS_SELECT)
        .order("period_start", { ascending: false });
      if (generation !== state.loadGeneration) return;
      if (result.error) throw result.error;
      state.rows = Array.isArray(result.data) ? result.data : [];
      renderRows(state.rows);
    } catch (error) {
      if (generation !== state.loadGeneration) return;
      if (host) host.innerHTML = `<div class="cas-danger">${escapeHtml(error?.message || "Could not load periods.")}</div>`;
      showToast?.("Could not load period status.", "error");
    }
  }

  function renderDialog(mode, periodStarts) {
    state.mode = mode;
    state.selectedPeriodStarts = [...periodStarts];
    state.succeeded = false;
    $("clsDialogTitle", doc).textContent =
      mode === "batch" ? "Close quarter (lock months)" : "Lock a single month (authorised exception)";
    const intro = $("clsDialogIntro", doc);
    if (intro) {
      intro.innerHTML = `<p>${escapeHtml(STATE_ONLY_TEXT)}</p>
        <p>${escapeHtml(mode === "batch" ? BATCH_ATOMIC_TEXT : EXCEPTION_TEXT)}</p>
        <p class="cas-danger">${escapeHtml(MONTH_ENDED_REMINDER)}</p>`;
    }
    const list = $("clsSelectedPeriods", doc);
    if (list) {
      list.innerHTML = `<div class="cas-block-title">Months to lock</div><ul>${periodStarts
        .map((periodStart) => `<li>${escapeHtml(periodStart)}</li>`)
        .join("")}</ul>`;
    }
    const error = $("clsFormError", doc);
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    const result = $("clsResult", doc);
    if (result) {
      result.textContent = "";
      result.hidden = true;
    }
    setVisible(dialog(), true);
    $("clsReason", doc)?.focus?.();
    syncSubmit();
  }

  function selectedFromPanel() {
    return [...(doc?.querySelectorAll?.("[data-cls-period]:checked") || [])].map(
      (input) => input.getAttribute("data-cls-period"),
    );
  }

  function openBatch(periodStarts = selectedFromPanel()) {
    if (!periodStarts.length) {
      showToast?.("Choose at least one month.", "warn");
      return false;
    }
    renderDialog("batch", periodStarts);
    return true;
  }

  function openSingle(periodStart) {
    if (!periodStart) return false;
    renderDialog("single", [String(periodStart)]);
    return true;
  }

  function closeDialog() {
    if (state.inFlight) return;
    setVisible(dialog(), false);
    state.mode = null;
    state.selectedPeriodStarts = [];
  }

  function syncSubmit() {
    const submit = $("clsSubmitBtn", doc);
    if (submit) submit.disabled = state.inFlight || state.succeeded;
    $("clsCloseBtn", doc) && ($("clsCloseBtn", doc).disabled = state.inFlight);
    $("clsCancelBtn", doc) && ($("clsCancelBtn", doc).disabled = state.inFlight);
    $("clsLockForm", doc)?.setAttribute?.("aria-busy", state.inFlight ? "true" : "false");
  }

  async function submit() {
    if (state.inFlight || state.succeeded || !state.mode) return;
    const reason = $("clsReason", doc)?.value || "";
    const reference = $("clsApprovalReference", doc)?.value || "";
    const isBatch = state.mode === "batch";
    const rpcName = isBatch ? LOCK_RPC.batch : LOCK_RPC.single;
    const payload = isBatch
      ? buildBatchLockPayload(state.selectedPeriodStarts, reason, reference)
      : buildSingleLockPayload(state.selectedPeriodStarts[0], reason, reference);
    state.inFlight = true;
    syncSubmit();
    try {
      const { data, error } = await costingRpc(rpcName, payload);
      if (error) throw error;
      const parsed = unwrapRpcJson(data) || {};
      const lines = lockSuccessLines(parsed);
      const errorHost = $("clsFormError", doc);
      if (errorHost) {
        errorHost.textContent = "";
        errorHost.hidden = true;
      }
      const result = $("clsResult", doc);
      if (result) {
        result.textContent = `${lines.join("\n")}${isBatch ? `\nCount: ${parsed.count}` : ""}`;
        result.hidden = false;
      }
      state.succeeded = true;
      showToast?.("Period lock recorded by the server.", "success");
      await reload();
    } catch (error) {
      const mapped = mapCostingLockError(error);
      const host = $("clsFormError", doc);
      if (host) {
        host.textContent = formatMappedErrorForDisplay(mapped);
        host.hidden = false;
      }
      showToast?.(mapped.title, "error");
    } finally {
      state.inFlight = false;
      syncSubmit();
    }
  }

  function onPanelClick(event) {
    const single = event.target.closest?.("[data-cls-single]");
    if (single) {
      event.preventDefault?.();
      openSingle(single.getAttribute("data-cls-single"));
    }
  }

  function bind() {
    if (state.mounted) return;
    state.mounted = true;
    panel()?.addEventListener?.("click", onPanelClick);
    $("clsCloseQuarterBtn", doc)?.addEventListener?.("click", () => openBatch());
    $("clsSubmitBtn", doc)?.addEventListener?.("click", () => void submit());
    $("clsLockForm", doc)?.addEventListener?.("submit", (event) =>
      event.preventDefault?.(),
    );
    $("clsCloseBtn", doc)?.addEventListener?.("click", closeDialog);
    $("clsCancelBtn", doc)?.addEventListener?.("click", closeDialog);
  }

  function mount() {
    if (!isControlCenterRoute?.()) {
      onRouteExit();
      return;
    }
    ensureMarkup();
    bind();
    setVisible(panel(), true);
    void reload();
  }

  function onRouteExit() {
    ++state.loadGeneration;
    setVisible(panel(), false);
    if (!state.inFlight) setVisible(dialog(), false);
  }

  return {
    mount,
    reload,
    onRouteExit,
    openBatch,
    openSingle,
    submit,
    _state: state,
  };
}
