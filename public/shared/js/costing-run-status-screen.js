export const RUN_DISPLAY_STATUS_VIEW = "v_costing_pricing_run_display_status";
export const RUN_DISPLAY_STATUS_SELECT =
  "refresh_run_id,valuation_date,overall_status,source_trigger,requested_at,finished_at,display_status,display_label,pricing_use_label";
export const RUN_STATUS_READ_RPCS = Object.freeze([
  "rpc_get_costing_refresh_status",
  "rpc_costing_health_check",
]);
export const RUN_STATUS_SCOPE = "FULL_COSTING_REFRESH";

const PM_BOM_FAILURE =
  /^NO_EFFECTIVE_PM_BOM_REVISION: valuation_date=(\d{4}-\d{2}-\d{2}) missing_count=(\d+) missing_sku_ids=([\d,]+)$/;

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

function normalizeStatus(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function explainRunFailure(message, formatDate = (value) => value) {
  const serverMessage = String(message || "");
  const match = serverMessage.match(PM_BOM_FAILURE);
  if (!match) {
    return { text: serverMessage, serverMessage, mapped: false };
  }
  const [, valuationDate, count, ids] = match;
  return {
    text: `No packing-material BOM was in force on ${formatDate(valuationDate)} for ${count} product(s): SKU ${ids.split(",").join(", ")}. This run was not used for pricing.`,
    serverMessage,
    mapped: true,
  };
}

export function healthRunLabel(row) {
  if (row?.run_id == null) return "";
  return `${String(row.check_code || "").startsWith("JOB_") ? "Job" : "Run"} ${row.run_id}`;
}

export function createCostingRunStatusScreenController(deps) {
  const {
    supabase,
    costingRpc,
    getActivePeriodStart,
    isControlCenterRoute,
    stageLabels = {},
    formatDate = (value) => String(value || "—"),
    formatDateTime = (value) => String(value || "—"),
    showToast,
    doc = globalThis.document,
  } = deps;
  const state = {
    mounted: false,
    loadGeneration: 0,
    activePeriod: "",
    rows: [],
    healthLoading: false,
    healthRequestId: 0,
  };

  function panel() {
    return $("costingRunStatusPanel", doc);
  }

  function setVisible(node, visible) {
    if (!node) return;
    node.hidden = !visible;
    node.setAttribute?.("aria-hidden", visible ? "false" : "true");
    node.classList?.toggle?.("hidden", !visible);
  }

  function renderRuns() {
    const host = $("crsRunList", doc);
    if (!host) return;
    if (!state.rows.length) {
      host.innerHTML = '<div class="cas-muted">No runs visible for this month.</div>';
      return;
    }
    host.innerHTML = state.rows
      .map((row) => {
        const failed = normalizeStatus(row.overall_status) === "FAILED";
        return `<article class="cas-run-card crs-run-card" data-crs-run-card="${escapeHtml(row.refresh_run_id)}">
          <div class="cas-run-head">
            <strong>Run ${escapeHtml(row.refresh_run_id)}</strong>
            <span class="cas-chip">${escapeHtml(row.pricing_use_label || "—")}</span>
          </div>
          <div class="cas-run-label">${escapeHtml(row.display_label || "—")}</div>
          <div class="cas-muted">Valuation ${escapeHtml(formatDate(row.valuation_date))} · ${escapeHtml(row.source_trigger || "—")}</div>
          <div class="cas-muted">Requested ${escapeHtml(formatDateTime(row.requested_at))}${row.finished_at ? ` · Finished ${escapeHtml(formatDateTime(row.finished_at))}` : ""}</div>
          ${failed ? `<button type="button" class="cas-action" data-crs-detail="${escapeHtml(row.refresh_run_id)}">Explain failed run</button>` : ""}
        </article>`;
      })
      .join("");
  }

  function renderDetail(row) {
    const host = $("crsRunDetail", doc);
    if (!host) return;
    const stages = Array.isArray(row?.stages) ? row.stages : [];
    const failedStage = String(row?.error_stage_code || "");
    const failedStageName =
      stages.find((stage) => String(stage.stage_code) === failedStage)?.stage_name ||
      stageLabels[failedStage] ||
      failedStage ||
      "Unknown stage";
    const explanation = explainRunFailure(row?.error_message, formatDate);
    host.innerHTML = `<div class="cas-block">
      <div class="cas-block-title">Failed stage: ${escapeHtml(failedStageName)}</div>
      <div class="crs-stage-list">${stages
        .map((stage) => {
          const name = stage.stage_name || stageLabels[stage.stage_code] || stage.stage_code || "Stage";
          return `<span class="cas-chip crs-stage-chip" data-stage-status="${escapeHtml(normalizeStatus(stage.stage_status))}">${escapeHtml(name)} · ${escapeHtml(stage.stage_status || "—")}</span>`;
        })
        .join("")}</div>
      <p class="crs-explanation">${escapeHtml(explanation.text || "No server explanation was returned.")}</p>
      <div class="cas-muted"><strong>Server message</strong><br>${escapeHtml(explanation.serverMessage || "—")}</div>
    </div>`;
  }

  async function loadRuns() {
    const periodStart = String(getActivePeriodStart?.() || "");
    const generation = ++state.loadGeneration;
    state.activePeriod = periodStart;
    state.rows = [];
    const host = $("crsRunList", doc);
    const detail = $("crsRunDetail", doc);
    if (host) host.innerHTML = '<div class="cas-muted">Loading runs…</div>';
    if (detail) detail.innerHTML = "";
    try {
      const result = await supabase
        .from(RUN_DISPLAY_STATUS_VIEW)
        .select(RUN_DISPLAY_STATUS_SELECT)
        .eq("period_start", periodStart)
        .order("refresh_run_id", { ascending: false });
      if (generation !== state.loadGeneration || periodStart !== getActivePeriodStart?.()) return;
      if (result.error) throw result.error;
      state.rows = Array.isArray(result.data) ? result.data : [];
      renderRuns();
    } catch (error) {
      if (generation !== state.loadGeneration) return;
      if (host) host.innerHTML = `<div class="cas-danger">${escapeHtml(error?.message || "Could not load runs.")}</div>`;
      showToast?.("Could not load run status.", "error");
    }
  }

  async function openRunDetail(refreshRunId) {
    const selected = state.rows.find(
      (row) => String(row.refresh_run_id) === String(refreshRunId),
    );
    if (!selected || normalizeStatus(selected.overall_status) !== "FAILED") return false;
    const generation = state.loadGeneration;
    const periodStart = state.activePeriod;
    const host = $("crsRunDetail", doc);
    if (host) host.innerHTML = '<div class="cas-muted">Loading run details…</div>';
    try {
      const { data, error } = await costingRpc(RUN_STATUS_READ_RPCS[0], {
        p_refresh_run_id: selected.refresh_run_id,
        p_period_start: periodStart,
        p_requested_scope: RUN_STATUS_SCOPE,
      });
      if (generation !== state.loadGeneration || periodStart !== getActivePeriodStart?.()) return false;
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        if (host) host.innerHTML = '<div class="cas-muted">Run details not found.</div>';
        return true;
      }
      if (String(row.period_start || "") !== periodStart) return false;
      renderDetail(row);
      return true;
    } catch (error) {
      if (generation !== state.loadGeneration || periodStart !== getActivePeriodStart?.()) return false;
      if (host) host.innerHTML = `<div class="cas-danger">${escapeHtml(error?.message || "Could not load run details.")}</div>`;
      return false;
    }
  }

  function renderHealth(rows) {
    const host = $("crsHealthList", doc);
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = '<div class="cas-muted">No health findings returned.</div>';
      return;
    }
    host.innerHTML = rows
      .map((row) => {
        const runLabel = healthRunLabel(row);
        const context = [row.period_start, runLabel].filter(Boolean).join(" · ");
        return `<article class="cas-run-card crs-health-row" data-severity="${escapeHtml(row.severity || "")}">
          <div class="cas-run-head"><span class="cas-chip">${escapeHtml(row.severity || "—")}</span><strong>${escapeHtml(row.check_code || "—")}</strong></div>
          ${context ? `<div class="cas-muted">${escapeHtml(context)}</div>` : ""}
          <div>${escapeHtml(row.detail || "")}</div>
        </article>`;
      })
      .join("");
  }

  async function loadHealth() {
    if (state.healthLoading) return;
    const generation = state.loadGeneration;
    const requestId = ++state.healthRequestId;
    state.healthLoading = true;
    const button = $("crsHealthRefresh", doc);
    if (button) button.disabled = true;
    const host = $("crsHealthList", doc);
    if (host) host.innerHTML = '<div class="cas-muted">Checking…</div>';
    try {
      const { data, error } = await costingRpc(RUN_STATUS_READ_RPCS[1]);
      if (requestId !== state.healthRequestId || generation !== state.loadGeneration || !isControlCenterRoute?.()) return;
      if (error) throw error;
      renderHealth(Array.isArray(data) ? data : []);
    } catch (error) {
      if (requestId !== state.healthRequestId || generation !== state.loadGeneration || !isControlCenterRoute?.()) return;
      if (host) host.innerHTML = `<div class="cas-danger">${escapeHtml(error?.message || "Could not load health findings.")}</div>`;
    } finally {
      if (requestId !== state.healthRequestId) return;
      state.healthLoading = false;
      if (button) button.disabled = false;
    }
  }

  function onPanelClick(event) {
    const detailButton = event.target.closest?.("[data-crs-detail]");
    if (!detailButton) return;
    event.preventDefault?.();
    void openRunDetail(detailButton.getAttribute("data-crs-detail"));
  }

  function bind() {
    if (state.mounted) return;
    state.mounted = true;
    panel()?.addEventListener?.("click", onPanelClick);
    $("crsHealthRefresh", doc)?.addEventListener?.("click", () => void loadHealth());
  }

  function mount() {
    if (!isControlCenterRoute?.()) {
      onRouteExit();
      return;
    }
    bind();
    setVisible(panel(), true);
    void loadRuns();
    void loadHealth();
  }

  function onRouteExit() {
    ++state.loadGeneration;
    ++state.healthRequestId;
    state.healthLoading = false;
    state.activePeriod = "";
    state.rows = [];
    const button = $("crsHealthRefresh", doc);
    if (button) button.disabled = false;
    setVisible(panel(), false);
  }

  return {
    mount,
    reload: loadRuns,
    reloadHealth: loadHealth,
    openRunDetail,
    onRouteExit,
    _state: state,
  };
}
