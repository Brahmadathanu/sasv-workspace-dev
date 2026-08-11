/**
 * Cost Sheet Review — Materials / Stores Action Queue lens controller.
 * RPC-only: rpc_get_materials_stores_action_queue
 * Shell owns #search, PEQ Action Type, #prevPage/#nextPage/#peqPage/#peqRowCount.
 * Queue contains BLOCKED / REVIEW_REQUIRED rows only (server-filtered).
 */

import {
  MATERIALS_STORES_ACTION_QUEUE_LENS_ID,
  MS_ACTION_TYPE_SEED,
  clampMsQueuePagination,
  formatMsActionLabel,
  formatMsMoney,
  formatMsQuantity,
  formatMsRouteLabel,
  formatMsStatusLabel,
  isBlankMsValue,
  isMaterialsStoresActionQueueLens,
  mergeMsActionCodeOptions,
  msActionRowIdentity,
  normalizeMsCode,
  nextMsQueueOffsetOnFilterChange,
  pageToMsOffset,
  unwrapMaterialsStoresActionQueueRpcResult,
} from "./costing-suite-materials-stores-explain-helpers.js";

export {
  MATERIALS_STORES_ACTION_QUEUE_LENS_ID,
  MS_ACTION_TYPE_SEED,
  isMaterialsStoresActionQueueLens,
  msActionRowIdentity,
  pageToMsOffset,
};

export const MATERIALS_STORES_ACTION_QUEUE_DEBOUNCE_MS = 300;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  if (isBlankMsValue(value)) return fallback;
  return escapeHtml(value);
}

function isPermissionError(err) {
  if (!err) return false;
  const status = Number(err.status ?? err.statusCode ?? err.code);
  if (status === 401 || status === 403) return true;
  const msg = String(err.message || err.error_description || "").toLowerCase();
  return (
    msg.includes("permission") ||
    msg.includes("not authorized") ||
    msg.includes("forbidden") ||
    msg.includes("jwt") ||
    msg.includes("401") ||
    msg.includes("403")
  );
}

export function createMaterialsStoresActionQueueController(deps = {}) {
  const {
    costingRpc,
    showToast,
    text: shellText,
    statusChip,
    normalizeStatus,
    getActivePeriodStart,
    getCurrentLens,
    canView = () => true,
    navigateToCostingRoute,
    openSkuMaterialsStoresExplainFromQueue = null,
    openProductMaterialsStoresExplainFromQueue = null,
    onOpenRow = null,
  } = deps;

  const t = typeof shellText === "function" ? shellText : text;

  let disposed = false;
  let loadGeneration = 0;
  let searchTimer = null;
  let boundHandlers = [];
  let selectedIdentity = null;

  let state = {
    period_start: null,
    q: "",
    action_code: "",
    limit: 25,
    offset: 0,
    total_count: 0,
    rows: [],
    seen_action_codes: [],
    loading: false,
    error: null,
    permissionDenied: false,
  };

  function clearSearchTimer() {
    if (searchTimer != null) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
  }

  function unbindHandlers() {
    for (const { el, type, fn } of boundHandlers) {
      el?.removeEventListener?.(type, fn);
    }
    boundHandlers = [];
  }

  function on(el, type, fn) {
    if (!el) return;
    el.addEventListener(type, fn);
    boundHandlers.push({ el, type, fn });
  }

  function invalidatePendingRequests() {
    loadGeneration += 1;
  }

  function destroy() {
    disposed = true;
    clearSearchTimer();
    unbindHandlers();
    invalidatePendingRequests();
    selectedIdentity = null;
  }

  function dispose() {
    destroy();
  }

  function isActiveLens() {
    return isMaterialsStoresActionQueueLens(
      typeof getCurrentLens === "function" ? getCurrentLens() : null,
    );
  }

  function isLoadCurrent(gen) {
    return !disposed && gen === loadGeneration && isActiveLens();
  }

  function chip(status) {
    if (
      typeof statusChip === "function" &&
      typeof normalizeStatus === "function"
    ) {
      const raw = normalizeMsCode(status);
      if (!raw) return t("—");
      return statusChip(normalizeStatus(raw));
    }
    return escapeHtml(formatMsStatusLabel(status) || status || "—");
  }

  function getPage() {
    const size = Math.max(1, Number(state.limit) || 25);
    return Math.floor(Math.max(0, Number(state.offset) || 0) / size) + 1;
  }

  function getTotalCount() {
    return Number(state.total_count) || 0;
  }

  function syncPageFromShell(page, pageSize) {
    const size = Math.max(1, Number(pageSize) || 25);
    state.limit = size;
    state.offset = pageToMsOffset(page, size);
  }

  function getActionCode() {
    return state.action_code || "";
  }

  function getSeenActionCodes() {
    return [...state.seen_action_codes];
  }

  function getSelectedRow() {
    if (!selectedIdentity) return null;
    return (
      state.rows.find((row) => msActionRowIdentity(row) === selectedIdentity) ||
      null
    );
  }

  function selectRow(row) {
    selectedIdentity = row ? msActionRowIdentity(row) : null;
    return getSelectedRow() || row || null;
  }

  function findRowByIdentity(identity) {
    const id = String(identity || "");
    if (!id) return null;
    return state.rows.find((row) => msActionRowIdentity(row) === id) || null;
  }

  async function fetchQueue() {
    if (typeof costingRpc !== "function") {
      throw new Error("costingRpc is not available");
    }
    const period = String(
      state.period_start ||
        (typeof getActivePeriodStart === "function"
          ? getActivePeriodStart()
          : "") ||
        "",
    ).trim();
    const { data, error } = await costingRpc(
      "rpc_get_materials_stores_action_queue",
      {
        p_period_start: period || null,
        p_action_code: state.action_code || null,
        p_q: state.q || null,
        p_limit: state.limit,
        p_offset: state.offset,
      },
    );
    if (error) throw error;
    return unwrapMaterialsStoresActionQueueRpcResult(data);
  }

  async function load(options = {}) {
    if (disposed) return { ok: false, stale: true };
    if (typeof canView === "function" && !canView()) {
      state.permissionDenied = true;
      state.loading = false;
      state.error = null;
      state.rows = [];
      state.total_count = 0;
      render();
      return { ok: false, permissionDenied: true };
    }

    const gen = ++loadGeneration;
    state.loading = true;
    state.error = null;
    state.permissionDenied = false;
    if (options.period_start != null) {
      state.period_start = String(options.period_start || "").trim() || null;
    } else if (
      !state.period_start &&
      typeof getActivePeriodStart === "function"
    ) {
      state.period_start = getActivePeriodStart();
    }
    if (options.resetOffset) {
      state.offset = nextMsQueueOffsetOnFilterChange();
    }
    if (options.q != null) {
      state.q = String(options.q || "").trim();
    }
    if (options.action_code !== undefined) {
      state.action_code = normalizeMsCode(options.action_code);
    }
    render();

    try {
      const result = await fetchQueue();
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      const clamped = clampMsQueuePagination({
        offset: state.offset,
        limit: state.limit,
        total_count: result.total_count,
      });
      if (clamped.offset !== state.offset && result.total_count > 0) {
        state.offset = clamped.offset;
        const retry = await fetchQueue();
        if (!isLoadCurrent(gen)) return { ok: false, stale: true };
        state.rows = retry.rows;
        state.total_count = retry.total_count;
      } else {
        state.rows = result.rows;
        state.total_count = result.total_count;
      }
      state.seen_action_codes = mergeMsActionCodeOptions(
        state.seen_action_codes,
        state.rows.map((r) => r.action_code),
      );
      state.loading = false;
      state.error = null;
      render();
      return { ok: true, total_count: state.total_count, page: getPage() };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      console.warn(
        "[costing-suite] rpc_get_materials_stores_action_queue failed",
        err,
      );
      state.loading = false;
      if (isPermissionError(err)) {
        state.permissionDenied = true;
        state.error = null;
      } else {
        state.permissionDenied = false;
        state.error =
          err?.message || "Materials / Stores action queue could not be loaded.";
      }
      state.rows = [];
      render();
      if (typeof showToast === "function" && !state.permissionDenied) {
        showToast("Materials / Stores action queue could not be loaded.", "error");
      }
      return { ok: false, error: state.error };
    }
  }

  function setActionCode(code) {
    state.action_code = normalizeMsCode(code);
    state.offset = nextMsQueueOffsetOnFilterChange();
    return load({ resetOffset: true });
  }

  function copyText(value, label) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      showToast?.(`No ${label} to copy.`, "info");
      return;
    }
    const done = () => showToast?.(`${label} copied.`, "success");
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(raw)
        .then(done)
        .catch(() => {
          showToast?.(`Could not copy ${label}.`, "warning");
        });
      return;
    }
    showToast?.(`${label}: ${raw}`, "info");
  }

  function packText(row) {
    const size = formatMsQuantity(row.pack_size) ?? row.pack_size;
    const uom = row.pack_uom;
    if (isBlankMsValue(size) && isBlankMsValue(uom)) return "—";
    return [size, uom].filter((v) => !isBlankMsValue(v)).join(" ") || "—";
  }

  function openMaterialCostManagerRm(row) {
    if (typeof navigateToCostingRoute !== "function") {
      showToast?.("Material Cost Manager navigation is not available.", "warning");
      return;
    }
    const period = String(row.period_start || state.period_start || "").trim();
    navigateToCostingRoute(
      "material-cost-manager",
      {
        lens: "manual-rate-manager",
        issue: ["MATERIAL_RATE_MANAGER_RM"],
        source: ["RM"],
        period_start: period || undefined,
        product_id: row.product_id,
        sku_id: row.sku_id,
      },
      { newTab: true },
    );
  }

  function openMaterialCostManagerPm(row) {
    if (typeof navigateToCostingRoute !== "function") {
      showToast?.("Material Cost Manager navigation is not available.", "warning");
      return;
    }
    const period = String(row.period_start || state.period_start || "").trim();
    showToast?.(
      "Opening Material Cost Manager PM Manual Rate context. A dedicated PM cost-trace lens is not available.",
      "info",
      7200,
    );
    navigateToCostingRoute(
      "material-cost-manager",
      {
        lens: "manual-rate-manager",
        issue: ["MATERIAL_RATE_MANAGER_PM"],
        source: ["PM"],
        period_start: period || undefined,
        product_id: row.product_id,
        sku_id: row.sku_id,
      },
      { newTab: true },
    );
  }

  function openMonthlyBasisExplain(row) {
    if (typeof openSkuMaterialsStoresExplainFromQueue !== "function") {
      showToast?.(
        "Materials / Stores Explain is not available in this context.",
        "warning",
      );
      return;
    }
    void openSkuMaterialsStoresExplainFromQueue(row);
  }

  function resolveRecommendedRoute(row) {
    return normalizeMsCode(row.recommended_ui_route);
  }

  function hostEls() {
    return {
      workbenchSummary: document.getElementById("workbenchSummary"),
      tableHead: document.getElementById("tableHead"),
      tableBody: document.getElementById("tableBody"),
      tableWrap: document.getElementById("tableWrap"),
    };
  }

  function renderTableRows() {
    return state.rows
      .map((row) => {
        const identity = msActionRowIdentity(row);
        const storesCost = formatMsMoney(
          row.materials_stores_overhead_cost_per_sku,
        );
        return `<tr class="cp-ms-aq-row" tabindex="0" role="button" data-ms-aq-id="${escapeHtml(identity)}" aria-label="Open Materials / Stores action details for ${escapeHtml(row.product_name || row.sku_id || "SKU")}">
          <td class="c-left">
            <div class="cp-cell-primary">${t(row.product_name)}</div>
            <div class="cp-muted-text">Product ${t(row.product_id)} · SKU ${t(row.sku_id)}</div>
          </td>
          <td class="c-left">${text(packText(row))}</td>
          <td class="c-left">${escapeHtml(formatMsActionLabel(row.action_code) || row.action_code || "—")}</td>
          <td class="c-left">${chip(row.action_severity || row.allocation_status)}</td>
          <td class="c-left">${text(row.recommended_action)}</td>
          <td class="c-right">${storesCost != null ? escapeHtml(storesCost) : "—"}</td>
          <td class="c-left">${chip(row.allocation_status)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderCard(row) {
    const identity = msActionRowIdentity(row);
    const storesCost = formatMsMoney(row.materials_stores_overhead_cost_per_sku);
    return `<article class="cp-ms-aq-card" tabindex="0" role="button" data-ms-aq-id="${escapeHtml(identity)}" aria-label="Open Materials / Stores action details for ${escapeHtml(row.product_name || row.sku_id || "SKU")}">
      <div class="cp-ms-aq-card-head">
        <div>
          <div class="cp-ms-aq-card-title">${t(row.product_name)}</div>
          <div class="cp-muted-text">${text(packText(row))} · SKU ${t(row.sku_id)}</div>
          <div class="cp-muted-text">${escapeHtml(formatMsActionLabel(row.action_code) || row.action_code || "—")}</div>
        </div>
        <div class="cp-ms-aq-card-chips">
          ${chip(row.action_severity || row.allocation_status)}
          ${chip(row.allocation_status)}
          <div class="cp-ms-aq-card-cost">${storesCost != null ? escapeHtml(storesCost) : "—"}</div>
        </div>
      </div>
    </article>`;
  }

  function kv(label, valueHtml) {
    if (valueHtml == null || valueHtml === "") return "";
    return `<div class="cp-ms-aq-detail-kv"><span class="cp-muted-text">${escapeHtml(label)}</span><div>${valueHtml}</div></div>`;
  }

  function copyBtn(value, label, attr) {
    if (isBlankMsValue(value)) return "";
    return `<button type="button" class="icon-btn cp-ms-aq-copy-btn" data-ms-aq-copy="${escapeHtml(attr)}" data-ms-aq-copy-label="${escapeHtml(label)}">Copy ${escapeHtml(label)}</button>`;
  }

  function navigationHtml(row) {
    const route = resolveRecommendedRoute(row);
    const buttons = [];
    if (route === "MATERIAL_COST_MANAGER_RM") {
      buttons.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-ms-aq-nav="rm">Open Material Cost Manager (RM)</button>`,
      );
      buttons.push(
        `<p class="cp-muted-text cp-ms-aq-nav-note">Opens in a new tab with RM Manual Rate Manager filters.</p>`,
      );
    } else if (route === "MATERIAL_COST_MANAGER_PM") {
      buttons.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-ms-aq-nav="pm">Open Material Cost Manager (PM)</button>`,
      );
      buttons.push(
        `<p class="cp-muted-text cp-ms-aq-nav-note">Opens in a new tab. Closest existing PM context is Manual Rate Manager (no PM cost-trace lens).</p>`,
      );
    } else if (route === "COSTING_MONTHLY_ALLOCATION_BASIS") {
      buttons.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-ms-aq-nav="monthly">Open Materials / Stores Explain</button>`,
      );
      buttons.push(
        `<p class="cp-muted-text cp-ms-aq-nav-note">Stays in Cost Sheet Review. Opens SKU Explain with Materials / Stores and Monthly Allocation Driver sections.</p>`,
      );
    } else if (route === "COST_SHEET_REVIEW") {
      buttons.push(
        `<span class="cp-muted-text">Remain in Cost Sheet Review to continue governance review.</span>`,
      );
    } else if (route) {
      buttons.push(
        `<span class="cp-muted-text">Recommended route: ${escapeHtml(formatMsRouteLabel(route) || route)}</span>`,
      );
    } else {
      buttons.push(
        `<span class="cp-muted-text">No dedicated navigation route for this action yet.</span>`,
      );
    }
    return buttons.join("");
  }

  function renderDetailHtml(row) {
    if (!row) {
      return `<div class="status">Materials / Stores action details are unavailable.</div>`;
    }
    const storesCost = formatMsMoney(row.materials_stores_overhead_cost_per_sku);
    const skuExplainBtn =
      typeof openSkuMaterialsStoresExplainFromQueue === "function" &&
      !isBlankMsValue(row.sku_id)
        ? `<button type="button" class="icon-btn icon-btn-primary" data-ms-aq-nav="sku-explain">Open SKU Materials / Stores Explain</button>`
        : "";
    const productExplainBtn =
      typeof openProductMaterialsStoresExplainFromQueue === "function" &&
      !isBlankMsValue(row.product_id)
        ? `<button type="button" class="icon-btn" data-ms-aq-nav="product-explain">Open Product Materials / Stores Explain</button>`
        : "";

    return `<div class="cp-ms-aq-detail" data-ms-aq-detail-id="${escapeHtml(msActionRowIdentity(row))}">
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Immediate action</h3>
        <div class="cp-ms-aq-detail-grid">
          ${kv("Severity", chip(row.action_severity || row.allocation_status))}
          ${kv("Action", escapeHtml(formatMsActionLabel(row.action_code) || row.action_code || "—"))}
          ${kv("Action code", text(row.action_code))}
          ${kv("Recommended action", text(row.recommended_action))}
          ${kv("Recommended route", text(formatMsRouteLabel(row.recommended_ui_route) || row.recommended_ui_route))}
          ${kv("Action note", text(row.action_note))}
          ${kv("Priority", text(row.action_priority))}
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Product / SKU</h3>
        <div class="cp-ms-aq-detail-grid">
          ${kv("Product", text(row.product_name))}
          ${kv("Product ID", text(row.product_id))}
          ${kv("SKU ID", text(row.sku_id))}
          ${kv("Pack", text(packText(row)))}
          ${kv("Product base UOM", text(row.product_base_uom))}
        </div>
        <div class="cp-ms-aq-actions">
          ${copyBtn(row.product_id, "Product ID", "product_id")}
          ${copyBtn(row.sku_id, "SKU ID", "sku_id")}
          ${copyBtn(row.refresh_run_id, "refresh-run ID", "refresh_run_id")}
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Costing signals</h3>
        <div class="cp-ms-aq-detail-grid">
          ${kv("Stores cost per SKU", storesCost != null ? escapeHtml(storesCost) : "—")}
          ${kv("Monthly SKU units", text(formatMsQuantity(row.monthly_sku_units) ?? "—"))}
          ${kv("Unified workload units", text(formatMsQuantity(row.unified_workload_units) ?? "—"))}
          ${kv("Monthly SKU allocation", text(formatMsMoney(row.monthly_sku_allocation_amount) ?? "—"))}
          ${kv("Allocation status", chip(row.allocation_status))}
          ${kv("Projection source", text(row.projection_source))}
          ${kv("Period start", text(row.period_start))}
          ${kv("Valuation date", text(row.valuation_date))}
          ${kv("Refresh run ID", text(row.refresh_run_id))}
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Evidence status</h3>
        <div class="cp-ms-aq-detail-grid">
          ${kv("RM evidence", chip(row.rm_evidence_status))}
          ${kv("PM evidence", chip(row.pm_evidence_status))}
          ${kv("Monthly driver", chip(row.monthly_driver_status))}
          ${kv("Required RM lines", text(formatMsQuantity(row.required_rm_line_count, { maximumFractionDigits: 0 }) ?? "—"))}
          ${kv("Required PM lines", text(formatMsQuantity(row.required_pm_line_count, { maximumFractionDigits: 0 }) ?? "—"))}
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Navigation</h3>
        <div class="cp-ms-aq-actions">${navigationHtml(row)}</div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Explain</h3>
        <div class="cp-ms-aq-actions">
          ${skuExplainBtn}
          ${productExplainBtn}
        </div>
      </section>
    </div>`;
  }

  function getDrawerConfig(row) {
    return {
      title: row?.product_name || `SKU ${row?.sku_id || ""}` || "Materials / Stores action",
      subtitle: [
        formatMsActionLabel(row?.action_code) || row?.action_code,
        packText(row || {}),
      ]
        .filter((v) => v && v !== "—")
        .join(" · "),
      tabs: [{ id: "overview", label: "Overview" }],
      activeTab: "overview",
    };
  }

  function renderDrawerTab(_tabId, row) {
    return renderDetailHtml(row);
  }

  function wireDrawerActions(row) {
    const root = document.querySelector("#drawerContent .cp-ms-aq-detail");
    if (!root || !row) return;
    root.querySelectorAll("[data-ms-aq-copy]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.getAttribute("data-ms-aq-copy");
        const label = btn.getAttribute("data-ms-aq-copy-label") || key;
        copyText(row[key], label);
      });
    });
    root.querySelectorAll("[data-ms-aq-nav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nav = btn.getAttribute("data-ms-aq-nav");
        if (nav === "rm") openMaterialCostManagerRm(row);
        else if (nav === "pm") openMaterialCostManagerPm(row);
        else if (nav === "monthly" || nav === "sku-explain") {
          openMonthlyBasisExplain(row);
        } else if (nav === "product-explain") {
          openProductMaterialsStoresExplainFromQueue?.(row);
        }
      });
    });
  }

  function compactHeaderHtml() {
    return `<tr>
      <th class="c-left">Product</th>
      <th class="c-left">Pack</th>
      <th class="c-left">Action</th>
      <th class="c-left">Severity</th>
      <th class="c-left">Recommended</th>
      <th class="c-right">Stores cost</th>
      <th class="c-left">Status</th>
    </tr>`;
  }

  function render() {
    if (!isActiveLens()) return;
    const { workbenchSummary, tableHead, tableBody, tableWrap } = hostEls();
    if (tableWrap) {
      tableWrap.classList.add("cp-ms-aq-table-wrap");
      tableWrap.dataset.lens = MATERIALS_STORES_ACTION_QUEUE_LENS_ID;
    }

    if (state.permissionDenied) {
      if (tableHead) tableHead.innerHTML = compactHeaderHtml();
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="status cp-ms-aq-status" role="status">Permission denied. Materials / Stores Action Queue requires module:cost-sheet-review can_view.</div></td></tr>`;
      }
      if (workbenchSummary) {
        workbenchSummary.innerHTML = `<div class="cp-ms-aq-cards"><div class="status cp-ms-aq-status" role="status">Permission denied.</div></div>`;
      }
      return;
    }

    if (state.loading && !state.rows.length) {
      if (tableHead) tableHead.innerHTML = compactHeaderHtml();
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="cost-sheet-explain-loading"><span class="cp-loading-spinner" aria-hidden="true"></span><span>Loading Materials / Stores action queue…</span></div></td></tr>`;
      }
      return;
    }

    if (state.error) {
      if (tableHead) tableHead.innerHTML = compactHeaderHtml();
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="status cp-ms-aq-status" role="status">${escapeHtml(state.error)}</div></td></tr>`;
      }
      return;
    }

    if (!state.rows.length) {
      if (tableHead) tableHead.innerHTML = compactHeaderHtml();
      const emptyMsg =
        state.total_count > 0
          ? `No rows on this page. ${state.total_count.toLocaleString("en-IN")} action(s) exist — use Previous/Next to recover.`
          : "No Materials / Stores blockers or review actions for this period and filters.";
      if (tableBody) {
        tableBody.innerHTML = `<tr class="cp-ms-aq-desktop-only"><td colspan="7"><div class="status cp-ms-aq-status" role="status">${escapeHtml(emptyMsg)}</div></td></tr>`;
      }
      if (workbenchSummary) {
        workbenchSummary.innerHTML = `<div class="cp-ms-aq-cards"><div class="status cp-ms-aq-status" role="status">${escapeHtml(emptyMsg)}</div></div>`;
      }
      return;
    }

    if (tableHead) tableHead.innerHTML = compactHeaderHtml();
    if (tableBody) tableBody.innerHTML = renderTableRows();
    if (workbenchSummary) {
      workbenchSummary.innerHTML = `<div class="cp-ms-aq-cards">${state.rows.map(renderCard).join("")}</div>`;
    }
    bindRowOpenHandlers();
  }

  function bindRowOpenHandlers() {
    const openFromEl = (el) => {
      const id = el?.getAttribute?.("data-ms-aq-id");
      const row = findRowByIdentity(id);
      if (!row) return;
      if (el && typeof el.blur === "function") el.blur();
      selectRow(row);
      if (typeof onOpenRow === "function") onOpenRow(row);
    };

    const clickFn = (event) => {
      if (event.target.closest("button, a, input, select, textarea, label")) {
        return;
      }
      const el = event.target.closest("[data-ms-aq-id]");
      if (!el) return;
      event.preventDefault();
      openFromEl(el);
    };
    const keyFn = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const el = event.target.closest("[data-ms-aq-id]");
      if (!el || event.target !== el) return;
      event.preventDefault();
      openFromEl(el);
    };

    const tableBody = document.getElementById("tableBody");
    const cards = document.querySelector(".cp-ms-aq-cards");
    on(tableBody, "click", clickFn);
    on(tableBody, "keydown", keyFn);
    on(cards, "click", clickFn);
    on(cards, "keydown", keyFn);
  }

  function onLensLoadStart() {
    clearSearchTimer();
  }

  function onLensExit() {
    clearSearchTimer();
    invalidatePendingRequests();
    unbindHandlers();
  }

  function isShowingMsQueueRow(row) {
    if (!row) return false;
    return Boolean(msActionRowIdentity(row));
  }

  return {
    load,
    setActionCode,
    syncPageFromShell,
    getPage,
    getTotalCount,
    getActionCode,
    getSeenActionCodes,
    getSelectedRow,
    selectRow,
    render,
    getDrawerConfig,
    renderDrawerTab,
    wireDrawerActions,
    onLensLoadStart,
    onLensExit,
    isShowingMsQueueRow,
    destroy,
    dispose,
  };
}
