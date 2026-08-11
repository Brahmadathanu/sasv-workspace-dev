/**
 * Costing Control Center — Cost Period Valuation Governance controller.
 * Gate 11Y.10C.0B. Chip + unified Overview/Change/History modal.
 * RPC-only context/history/set. No direct period-table reads. No refresh.
 */

import {
  COST_PERIOD_VALUATION_CHANGE_WARNING,
  COST_PERIOD_VALUATION_RPC_NAMES,
  buildGetCostPeriodGovernanceHistoryArgs,
  buildGetCostPeriodValuationContextArgs,
  buildSetCostPeriodValuationDateArgs,
  canChangeCostPeriodValuation,
  formatCostPeriodStatusLabel,
  formatCostPeriodValuationActor,
  formatCostPeriodValuationSourceLabel,
  formatCostPeriodValuationStatusLabel,
  normalizeCostPeriodValuationContext,
  unwrapCostPeriodGovernanceHistoryPayload,
} from "./costing-suite-cost-period-valuation-helpers.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  if (value == null || String(value).trim() === "") return fallback;
  return escapeHtml(value);
}

function formatDisplayDate(value) {
  if (value == null || value === "") return "—";
  const raw = String(value).slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return escapeHtml(raw);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[Number(m[2]) - 1] || m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}

function formatDateTime(value) {
  if (value == null || value === "") return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return text(value);
    return escapeHtml(d.toLocaleString());
  } catch {
    return text(value);
  }
}

function chip(label, tone = "") {
  if (!label) return `<span class="cp-muted-text">—</span>`;
  const cls = tone ? `status-chip ${tone}` : "status-chip";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function periodStatusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "OPEN") return "status-chip--ok";
  if (s === "LOCKED") return "status-chip--warn";
  if (s === "CLOSED") return "status-chip--danger";
  return "";
}

function valuationStatusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "status-chip--warn";
  if (s.includes("APPROV") || s === "ACTIVE") return "status-chip--ok";
  return "";
}

function formatActorFromContext(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    return (
      value.display_name ||
      value.name ||
      value.email ||
      formatCostPeriodValuationActor({
        actor_user_id: value.id || value.user_id,
        actor_display_name: value.display_name,
      }) ||
      "—"
    );
  }
  return (
    formatCostPeriodValuationActor({ actor_user_id: value }) || String(value)
  );
}

export function createCostPeriodValuationController(deps = {}) {
  const {
    costingRpc,
    showToast,
    canView = () => false,
    canEdit = () => false,
    getActivePeriodStart = () => null,
    isControlCenterRoute = () => false,
  } = deps;

  const state = {
    context: null,
    contextLoading: false,
    contextError: null,
    contextRequestId: 0,
    historyRows: [],
    historyLoading: false,
    historyError: null,
    historyRequestId: 0,
    historyLoaded: false,
    historyVisited: false,
    activeTab: "overview",
    mutationPending: false,
    eventsBound: false,
  };

  let stripEl = null;
  let modalEl = null;

  function ensureStrip() {
    if (stripEl) return stripEl;
    stripEl = document.getElementById("costPeriodValuationStrip");
    return stripEl;
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.getElementById("costPeriodValuationModal");
    return modalEl;
  }

  function isModalOpen() {
    const modal = ensureModal();
    if (!modal) return false;
    if (modal.classList.contains("hidden")) return false;
    if (modal.getAttribute("aria-hidden") === "true") return false;
    return true;
  }

  function setStripVisible(visible) {
    const strip = ensureStrip();
    if (!strip) return;
    strip.hidden = !visible;
    strip.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function getChangeGateReason() {
    if (canEdit() !== true) {
      return "Edit permission required to change valuation date.";
    }
    const ctx = state.context;
    if (!ctx) return "Valuation context is not loaded.";
    const status = String(ctx.period_status || "")
      .trim()
      .toUpperCase();
    if (status && status !== "OPEN") {
      return `Valuation date can only be changed while the period is OPEN (currently ${
        formatCostPeriodStatusLabel(ctx.period_status) || status
      }).`;
    }
    const queued = Number(ctx.queued_or_running_refresh_count || 0);
    if (Number.isFinite(queued) && queued > 0) {
      return `A costing refresh is queued or running for this period (${queued}). Wait until it finishes.`;
    }
    return null;
  }

  function renderStrip() {
    const strip = ensureStrip();
    if (!strip) return;

    if (!isControlCenterRoute() || !canView()) {
      setStripVisible(false);
      return;
    }

    setStripVisible(true);
    const body = strip.querySelector("[data-cpv-strip-body]");
    if (!body) return;

    let valueText = "…";
    let title = "Open valuation governance";
    let clickable = false;

    if (state.contextLoading && !state.context) {
      valueText = "…";
      title = "Loading valuation context";
    } else if (state.contextError && !state.context) {
      valueText = "unavailable";
      title = state.contextError;
    } else if (!state.context) {
      valueText = "…";
      title = "No valuation context";
    } else {
      valueText = formatDisplayDate(state.context.valuation_date);
      title = `Valuation governance · ${valueText}`;
      clickable = true;
    }

    body.innerHTML = `<button
      type="button"
      class="cpv-chip"
      id="cpvValuationChip"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(title)}"
      ${clickable && !state.mutationPending ? "" : "disabled"}
    >
      <span class="cpv-chip-label">Valuation</span>
      <span class="cpv-chip-value" data-cpv-chip-value>${escapeHtml(valueText)}</span>
    </button>`;

    document.getElementById("cpvValuationChip")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!clickable || state.mutationPending) return;
      openModal("overview");
    });
  }

  function syncChangeTabAvailability() {
    const tab = document.getElementById("cpvTabChange");
    if (!tab) return;
    const hasEdit = canEdit() === true;
    tab.hidden = !hasEdit;
    if (!hasEdit && state.activeTab === "change") {
      setActiveTab("overview");
    }
  }

  function setActiveTab(tabId) {
    const next = ["overview", "change", "history"].includes(tabId)
      ? tabId
      : "overview";
    if (next === "change" && canEdit() !== true) {
      state.activeTab = "overview";
    } else {
      state.activeTab = next;
    }

    document.querySelectorAll("[data-cpv-tab]").forEach((el) => {
      const id = el.getAttribute("data-cpv-tab");
      const active = id === state.activeTab;
      el.classList.toggle("active", active);
      el.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-cpv-panel]").forEach((panel) => {
      const id = panel.getAttribute("data-cpv-panel");
      panel.hidden = id !== state.activeTab;
    });

    const confirmBtn = document.getElementById("cpvChangeConfirm");
    if (confirmBtn) {
      confirmBtn.hidden = state.activeTab !== "change";
    }

    if (state.activeTab === "overview") renderOverview();
    if (state.activeTab === "change") fillChangeForm();
    if (state.activeTab === "history") {
      state.historyVisited = true;
      if (!state.historyLoaded && !state.historyLoading) {
        void loadHistory(getActivePeriodStart?.());
      } else {
        renderHistoryBody();
      }
    }
  }

  function renderOverview() {
    const warn = document.getElementById("cpvOverviewWarning");
    if (warn) warn.textContent = COST_PERIOD_VALUATION_CHANGE_WARNING;

    const queuedNote = document.getElementById("cpvOverviewQueuedNote");
    const ctx = state.context;
    if (queuedNote) {
      const queued = Number(ctx?.queued_or_running_refresh_count || 0);
      if (queued > 0) {
        queuedNote.hidden = false;
        queuedNote.textContent = `A costing refresh is currently queued or running for this period (${queued}).`;
      } else {
        queuedNote.hidden = true;
        queuedNote.textContent = "";
      }
    }

    const host = document.getElementById("cpvOverviewKv");
    if (!host) return;
    if (!ctx) {
      host.innerHTML = `<dt>Status</dt><dd class="cp-muted-text">${text(
        state.contextError || "No valuation context loaded.",
      )}</dd>`;
      return;
    }

    const rows = [
      ["Period", formatDisplayDate(ctx.period_start)],
      [
        "Period status",
        chip(
          formatCostPeriodStatusLabel(ctx.period_status),
          periodStatusTone(ctx.period_status),
        ),
      ],
      ["Valuation date", formatDisplayDate(ctx.valuation_date)],
      [
        "Valuation source",
        text(formatCostPeriodValuationSourceLabel(ctx.valuation_date_source)),
      ],
      [
        "Valuation status",
        chip(
          formatCostPeriodValuationStatusLabel(ctx.valuation_date_status),
          valuationStatusTone(ctx.valuation_date_status),
        ),
      ],
      ["Last change reason", text(ctx.valuation_date_change_reason)],
      ["Approval reference", text(ctx.valuation_date_approval_reference)],
      ["Set at", formatDateTime(ctx.valuation_date_set_at)],
      ["Set by", text(formatActorFromContext(ctx.valuation_date_set_by))],
    ];

    if (ctx.locked_at || ctx.lock_reason) {
      rows.push(["Locked at", formatDateTime(ctx.locked_at)]);
      rows.push(["Lock reason", text(ctx.lock_reason)]);
    }
    if (ctx.closed_at || ctx.close_reason) {
      rows.push(["Closed at", formatDateTime(ctx.closed_at)]);
      rows.push(["Close reason", text(ctx.close_reason)]);
    }
    if (ctx.remarks) {
      rows.push(["Remarks", text(ctx.remarks)]);
    }

    host.innerHTML = rows
      .map(
        ([label, value]) =>
          `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`,
      )
      .join("");
  }

  function fillChangeForm() {
    const ctx = state.context;
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value == null || value === "" ? "—" : String(value);
    };
    set("cpvChangePeriod", formatDisplayDate(ctx?.period_start));
    set(
      "cpvChangePeriodStatus",
      formatCostPeriodStatusLabel(ctx?.period_status) || "—",
    );
    set("cpvChangeCurrentDate", formatDisplayDate(ctx?.valuation_date));

    const warn = document.getElementById("cpvChangeWarning");
    if (warn) warn.textContent = COST_PERIOD_VALUATION_CHANGE_WARNING;

    const gateReason = getChangeGateReason();
    const canMutate =
      canChangeCostPeriodValuation(ctx, { canEdit: canEdit() === true }) &&
      !state.mutationPending;

    const disabledNote = document.getElementById("cpvChangeDisabledNote");
    if (disabledNote) {
      if (gateReason && canEdit() === true) {
        disabledNote.hidden = false;
        disabledNote.textContent = gateReason;
      } else {
        disabledNote.hidden = true;
        disabledNote.textContent = "";
      }
    }

    const queuedNote = document.getElementById("cpvChangeQueuedNote");
    if (queuedNote) {
      const queued = Number(ctx?.queued_or_running_refresh_count || 0);
      if (queued > 0) {
        queuedNote.hidden = false;
        queuedNote.textContent = `A costing refresh is currently queued or running for this period (${queued}). Valuation date cannot be changed until it finishes.`;
      } else {
        queuedNote.hidden = true;
        queuedNote.textContent = "";
      }
    }

    const dateInput = document.getElementById("cpvChangeNewDate");
    if (dateInput) {
      dateInput.value = ctx?.valuation_date || "";
      if (ctx?.period_start) dateInput.min = ctx.period_start;
      if (ctx?.period_end) dateInput.max = ctx.period_end;
      dateInput.disabled = !canMutate;
    }
    const reason = document.getElementById("cpvChangeReason");
    if (reason) {
      if (!reason.dataset.cpvTouched) reason.value = "";
      reason.disabled = !canMutate;
    }
    const approval = document.getElementById("cpvChangeApproval");
    if (approval) {
      if (!approval.dataset.cpvTouched) approval.value = "";
      approval.disabled = !canMutate;
    }
    const err = document.getElementById("cpvChangeError");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    const confirmBtn = document.getElementById("cpvChangeConfirm");
    if (confirmBtn) {
      confirmBtn.disabled = !canMutate;
      confirmBtn.title = gateReason || "Confirm valuation date change";
    }
  }

  function openModal(tabId = "overview") {
    if (!canView()) {
      showToast?.("View permission required.", "warning");
      return;
    }
    const modal = ensureModal();
    if (!modal) {
      showToast?.("Valuation modal is missing.", "error");
      return;
    }
    const period = getActivePeriodStart?.();
    const subtitle = document.getElementById("cpvModalSubtitle");
    if (subtitle) {
      subtitle.textContent = period
        ? `Period ${formatDisplayDate(period)}`
        : "Current period";
    }
    syncChangeTabAvailability();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    setActiveTab(tabId);
  }

  function hideModal() {
    const modal = ensureModal();
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    const reason = document.getElementById("cpvChangeReason");
    const approval = document.getElementById("cpvChangeApproval");
    if (reason) delete reason.dataset.cpvTouched;
    if (approval) delete approval.dataset.cpvTouched;
  }

  function showChangeError(message) {
    const err = document.getElementById("cpvChangeError");
    if (!err) {
      showToast?.(message, "error");
      return;
    }
    err.hidden = false;
    err.textContent = message;
  }

  async function confirmChange() {
    if (state.mutationPending) return;
    const ctx = state.context;
    if (!ctx) {
      showChangeError("Valuation context is not loaded.");
      return;
    }
    const gateReason = getChangeGateReason();
    if (gateReason) {
      showChangeError(gateReason);
      return;
    }

    const valuationDate = document.getElementById("cpvChangeNewDate")?.value;
    const reason = document.getElementById("cpvChangeReason")?.value;
    const approval = document.getElementById("cpvChangeApproval")?.value;

    const built = buildSetCostPeriodValuationDateArgs({
      period_start: ctx.period_start,
      period_end: ctx.period_end,
      valuation_date: valuationDate,
      reason,
      approval_reference: approval,
    });
    if (!built.ok) {
      showChangeError(built.errors.join(" "));
      return;
    }

    state.mutationPending = true;
    const confirmBtn = document.getElementById("cpvChangeConfirm");
    if (confirmBtn) confirmBtn.disabled = true;
    renderStrip();

    try {
      const { data, error } = await costingRpc(
        COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate,
        built.params,
      );
      if (error) throw error;
      showToast?.(
        data?.[0]?.action_result ||
          "Valuation date updated. Future refreshes will capture the new date.",
        "success",
      );
      const reasonEl = document.getElementById("cpvChangeReason");
      const approvalEl = document.getElementById("cpvChangeApproval");
      if (reasonEl) {
        reasonEl.value = "";
        delete reasonEl.dataset.cpvTouched;
      }
      if (approvalEl) {
        approvalEl.value = "";
        delete approvalEl.dataset.cpvTouched;
      }
      await loadForActivePeriod({ force: true });
      if (state.historyVisited) {
        state.historyLoaded = false;
        await loadHistory(ctx.period_start);
      }
      setActiveTab("overview");
      return { ok: true, data };
    } catch (err) {
      console.error("[cost-period-valuation] set failed", err);
      showChangeError(
        err?.message ||
          err?.error_description ||
          "Unable to set cost period valuation date.",
      );
      return { ok: false, error: err };
    } finally {
      state.mutationPending = false;
      if (confirmBtn) confirmBtn.disabled = false;
      renderStrip();
      if (state.activeTab === "change") fillChangeForm();
    }
  }

  async function loadForActivePeriod({ force = false } = {}) {
    if (!isControlCenterRoute()) {
      setStripVisible(false);
      state.context = null;
      return { ok: false, reason: "not_control_center" };
    }
    if (!canView()) {
      setStripVisible(false);
      state.context = null;
      state.contextError = "View permission required.";
      return { ok: false, reason: "permission" };
    }

    const periodStart = getActivePeriodStart?.();
    if (!periodStart) {
      state.context = null;
      state.contextError = null;
      renderStrip();
      return { ok: false, reason: "no_period" };
    }

    const built = buildGetCostPeriodValuationContextArgs({
      period_start: periodStart,
    });
    if (!built.ok) {
      state.contextError = built.errors.join("; ");
      renderStrip();
      return { ok: false, error: state.contextError };
    }

    const requestId = ++state.contextRequestId;
    const selectedPeriod = built.params.p_period_start;
    state.contextLoading = true;
    if (!force) state.contextError = null;
    renderStrip();

    try {
      const { data, error } = await costingRpc(
        COST_PERIOD_VALUATION_RPC_NAMES.context,
        built.params,
      );
      if (
        requestId !== state.contextRequestId ||
        selectedPeriod !==
          buildGetCostPeriodValuationContextArgs({
            period_start: getActivePeriodStart?.(),
          }).params?.p_period_start
      ) {
        return { ok: false, reason: "stale" };
      }
      if (error) throw error;
      state.context = normalizeCostPeriodValuationContext(data);
      state.contextLoading = false;
      state.contextError = state.context
        ? null
        : "No valuation context returned for this period.";
      renderStrip();
      if (isModalOpen()) {
        syncChangeTabAvailability();
        if (state.activeTab === "overview") renderOverview();
        if (state.activeTab === "change") fillChangeForm();
      }
      return { ok: true, context: state.context, requestId };
    } catch (err) {
      if (requestId !== state.contextRequestId) {
        return { ok: false, reason: "stale" };
      }
      console.error("[cost-period-valuation] context failed", err);
      state.contextLoading = false;
      state.contextError =
        err?.message ||
        err?.error_description ||
        "Unable to load cost period valuation context.";
      state.context = null;
      renderStrip();
      showToast?.(state.contextError, "error");
      return { ok: false, error: state.contextError };
    }
  }

  async function loadHistory(periodStart) {
    const built = buildGetCostPeriodGovernanceHistoryArgs({
      period_start: periodStart || getActivePeriodStart?.(),
    });
    if (!built.ok) {
      state.historyError = built.errors.join("; ");
      renderHistoryBody();
      return { ok: false, error: state.historyError };
    }
    const requestId = ++state.historyRequestId;
    const selectedPeriod = built.params.p_period_start;
    state.historyLoading = true;
    state.historyError = null;
    renderHistoryBody();
    try {
      const { data, error } = await costingRpc(
        COST_PERIOD_VALUATION_RPC_NAMES.history,
        built.params,
      );
      if (
        requestId !== state.historyRequestId ||
        selectedPeriod !==
          buildGetCostPeriodGovernanceHistoryArgs({
            period_start: getActivePeriodStart?.(),
          }).params?.p_period_start
      ) {
        return { ok: false, reason: "stale" };
      }
      if (error) throw error;
      state.historyRows = unwrapCostPeriodGovernanceHistoryPayload(data);
      state.historyLoading = false;
      state.historyLoaded = true;
      renderHistoryBody();
      return { ok: true, rows: state.historyRows };
    } catch (err) {
      if (requestId !== state.historyRequestId) {
        return { ok: false, reason: "stale" };
      }
      console.error("[cost-period-valuation] history failed", err);
      state.historyLoading = false;
      state.historyLoaded = false;
      state.historyError =
        err?.message ||
        err?.error_description ||
        "Unable to load valuation governance history.";
      state.historyRows = [];
      renderHistoryBody();
      return { ok: false, error: state.historyError };
    }
  }

  function renderHistoryBody() {
    const host = document.getElementById("cpvHistoryTableHost");
    if (!host) return;
    if (state.historyLoading) {
      host.innerHTML = `<div class="cp-muted-text">Loading governance history…</div>`;
      return;
    }
    if (state.historyError) {
      host.innerHTML = `<div class="cp-danger-text">${text(state.historyError)}</div>`;
      return;
    }
    if (!state.historyRows.length) {
      host.innerHTML = `<div class="cp-muted-text">No valuation governance history for this period.</div>`;
      return;
    }
    host.innerHTML = `<div class="table-scroll"><table class="generic-table" style="width:100%">
      <thead><tr>
        <th class="c-left">Occurred</th>
        <th class="c-left">Event</th>
        <th class="c-left">Old date</th>
        <th class="c-left">New date</th>
        <th class="c-left">Old status</th>
        <th class="c-left">New status</th>
        <th class="c-left">Reason</th>
        <th class="c-left">Approval</th>
        <th class="c-left">Source</th>
        <th class="c-left">Actor</th>
      </tr></thead>
      <tbody>
        ${state.historyRows
          .map((row) => {
            const actor = formatCostPeriodValuationActor(row) || "—";
            return `<tr>
              <td class="c-left">${formatDateTime(row.occurred_at)}</td>
              <td class="c-left">${text(row.event_type)}</td>
              <td class="c-left">${formatDisplayDate(row.previous_valuation_date)}</td>
              <td class="c-left">${formatDisplayDate(row.new_valuation_date)}</td>
              <td class="c-left">${text(
                formatCostPeriodValuationStatusLabel(
                  row.previous_valuation_date_status,
                ),
              )}</td>
              <td class="c-left">${text(
                formatCostPeriodValuationStatusLabel(
                  row.new_valuation_date_status,
                ),
              )}</td>
              <td class="c-left">${text(row.reason)}</td>
              <td class="c-left">${text(row.approval_reference)}</td>
              <td class="c-left">${text(row.event_source)}</td>
              <td class="c-left">${text(actor)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>`;
  }

  function handleEscapeKey() {
    if (isModalOpen()) {
      hideModal();
      return true;
    }
    return false;
  }

  function onRouteExit() {
    hideModal();
    setStripVisible(false);
    state.context = null;
    state.historyRows = [];
    state.historyLoaded = false;
    state.historyVisited = false;
  }

  function bindEvents() {
    if (state.eventsBound) return;
    state.eventsBound = true;

    document
      .getElementById("cpvModalClose")
      ?.addEventListener("click", () => hideModal());
    document
      .getElementById("cpvModalCancel")
      ?.addEventListener("click", () => hideModal());
    document
      .getElementById("cpvChangeConfirm")
      ?.addEventListener("click", () => {
        void confirmChange();
      });
    ensureModal()?.addEventListener("click", (e) => {
      if (e.target === ensureModal()) hideModal();
    });

    document.querySelectorAll("[data-cpv-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-cpv-tab");
        if (tab.hidden || tab.disabled) return;
        setActiveTab(id);
      });
    });

    document
      .getElementById("cpvChangeReason")
      ?.addEventListener("input", (e) => {
        e.currentTarget.dataset.cpvTouched = "1";
      });
    document
      .getElementById("cpvChangeApproval")
      ?.addEventListener("input", (e) => {
        e.currentTarget.dataset.cpvTouched = "1";
      });
  }

  bindEvents();

  return {
    loadForActivePeriod,
    renderStrip,
    handleEscapeKey,
    onRouteExit,
    openModal,
    getState: () => ({
      ...state,
      context: state.context ? { ...state.context } : null,
      historyRows: [...state.historyRows],
    }),
  };
}
