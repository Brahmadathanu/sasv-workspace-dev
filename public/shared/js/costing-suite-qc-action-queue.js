/**
 * Cost Sheet Review — QC Action Queue lens controller.
 * RPC-only: rpc_get_qc_action_queue
 * Shell owns #search, PEQ Action Type, #prevPage/#nextPage/#peqPage/#peqRowCount.
 */

import {
  clampQcQueuePagination,
  formatQcActionLabel,
  formatQcCoveragePercent,
  formatQcProjectionSourceLabel,
  formatQcQuantity,
  formatQcQuantitySourceLabel,
  formatQcStatusLabel,
  isBlankQcValue,
  mergeQcActionCodeOptions,
  nextQcQueueOffsetOnFilterChange,
  normalizeQcCode,
  unwrapQcActionQueueRpcResult,
} from "./costing-suite-qc-explain-helpers.js";

export const QC_ACTION_QUEUE_LENS_ID = "qc-action-queue";
export const QC_ACTION_QUEUE_DEBOUNCE_MS = 300;

export const QC_ACTION_TYPE_SEED = Object.freeze([
  {
    code: "BLOCKED_MISSING_FG_PROTOCOL_MAPPING",
    label: "Missing FG protocol mapping",
  },
  {
    code: "REVIEW_REQUIRED_QC_ABSORPTION_BASIS",
    label: "QC absorption-basis review",
  },
]);

export function isQcActionQueueLens(lensId) {
  return String(lensId || "").trim() === QC_ACTION_QUEUE_LENS_ID;
}

export function qcActionRowIdentity(row) {
  if (!row || typeof row !== "object") return "";
  const run = row.refresh_run_id ?? "";
  const product = row.product_id ?? "";
  const action = normalizeQcCode(row.action_code);
  return `${run}|${product}|${action}`;
}

export function pageToQcOffset(page, pageSize = 25) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 25);
  return (p - 1) * size;
}

export function qcTotalPages(totalCount, pageSize = 25) {
  const total = Math.max(0, Number(totalCount) || 0);
  const size = Math.max(1, Number(pageSize) || 25);
  return total === 0 ? 1 : Math.ceil(total / size);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  if (isBlankQcValue(value)) return fallback;
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

export function createQcActionQueueController(deps = {}) {
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
    resolveSharedHtmlHref,
    openProductQcExplainFromQueue = null,
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
    return isQcActionQueueLens(
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
      const raw = normalizeQcCode(status);
      if (!raw) return t("—");
      return statusChip(normalizeStatus(raw));
    }
    return escapeHtml(formatQcStatusLabel(status) || status || "—");
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
    state.offset = pageToQcOffset(page, size);
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
      state.rows.find((row) => qcActionRowIdentity(row) === selectedIdentity) ||
      null
    );
  }

  function selectRow(row) {
    selectedIdentity = row ? qcActionRowIdentity(row) : null;
    return getSelectedRow() || row || null;
  }

  function findRowByIdentity(identity) {
    const id = String(identity || "");
    if (!id) return null;
    return state.rows.find((row) => qcActionRowIdentity(row) === id) || null;
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
    const { data, error } = await costingRpc("rpc_get_qc_action_queue", {
      p_period_start: period || null,
      p_action_code: state.action_code || null,
      p_q: state.q || null,
      p_limit: state.limit,
      p_offset: state.offset,
    });
    if (error) throw error;
    return unwrapQcActionQueueRpcResult(data);
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
      state.offset = nextQcQueueOffsetOnFilterChange();
    }
    if (options.q != null) {
      state.q = String(options.q || "").trim();
    }
    if (options.action_code !== undefined) {
      state.action_code = normalizeQcCode(options.action_code);
    }
    render();

    try {
      const result = await fetchQueue();
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      const clamped = clampQcQueuePagination({
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
      state.seen_action_codes = mergeQcActionCodeOptions(
        state.seen_action_codes,
        state.rows.map((r) => r.action_code),
      );
      state.loading = false;
      state.error = null;
      render();
      return { ok: true, total_count: state.total_count, page: getPage() };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      console.warn("[costing-suite] rpc_get_qc_action_queue failed", err);
      state.loading = false;
      if (isPermissionError(err)) {
        state.permissionDenied = true;
        state.error = null;
      } else {
        state.permissionDenied = false;
        state.error = err?.message || "QC action queue could not be loaded.";
      }
      state.rows = [];
      render();
      if (typeof showToast === "function" && !state.permissionDenied) {
        showToast("QC action queue could not be loaded.", "error");
      }
      return { ok: false, error: state.error };
    }
  }

  async function refresh() {
    return load({ resetOffset: false });
  }

  function setSearchQuery(raw, { immediate = false } = {}) {
    const next = String(raw || "").trim();
    clearSearchTimer();
    const apply = () => {
      if (disposed || !isActiveLens()) return;
      state.q = next;
      state.offset = nextQcQueueOffsetOnFilterChange();
      void load({ resetOffset: true });
    };
    if (immediate) {
      apply();
      return;
    }
    searchTimer = setTimeout(apply, QC_ACTION_QUEUE_DEBOUNCE_MS);
  }

  function setActionCode(code) {
    state.action_code = normalizeQcCode(code);
    state.offset = nextQcQueueOffsetOnFilterChange();
    return load({ resetOffset: true });
  }

  function navigateShared(fileName) {
    const href =
      typeof resolveSharedHtmlHref === "function"
        ? resolveSharedHtmlHref(fileName)
        : fileName;
    if (!href) {
      showToast?.("Navigation target is not available.", "warning");
      return false;
    }
    window.open(href, "_blank", "noopener,noreferrer");
    return true;
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

  function openProtocolManager(row) {
    const productName = row.product_name || row.product_id || "Product";
    const productId = row.product_id ?? "—";
    const groupId = row.product_group_id ?? "—";
    showToast?.(
      `Open LIMS Protocol Manager for ${productName} (Product ID ${productId}, Product Group ID ${groupId}). Locate Family Mapping manually — Product Group deep-link preselection is unavailable.`,
      "info",
      7800,
    );
    navigateShared("lab-protocol-manager.html");
  }

  function openSpecProfileManager(row) {
    const productName = row.product_name || row.product_id || "Product";
    const productId = row.product_id ?? "—";
    const groupId = row.product_group_id ?? "—";
    showToast?.(
      `Open Specification Profile Manager for ${productName} (Product ID ${productId}, Product Group ID ${groupId}). Automatic Product preselection is not available.`,
      "info",
      7800,
    );
    navigateShared("lab-spec-profile-manager.html");
  }

  function openAbsorptionReview(row) {
    const period = String(row.period_start || state.period_start || "").trim();
    const productId = Number(row.product_id);
    if (!period || !Number.isFinite(productId)) {
      showToast?.(
        "Open commercial-sales assumptions is unavailable for this row (period and product are required).",
        "warning",
        7200,
      );
      return;
    }
    if (typeof navigateToCostingRoute !== "function") {
      showToast?.(
        "Pricing Policy navigation is not available in this context.",
        "warning",
      );
      return;
    }
    showToast?.(
      "Opening commercial-sales assumptions. This governed quantity is used to absorb the Product QC allocation per base UOM. It does not determine the Product’s share of the QC pool.",
      "info",
      7800,
    );
    navigateToCostingRoute("pricing-policy-manager", {
      workspace: "commercial-sales-assumptions",
      period_start: period,
      product_id: productId,
    }, { newTab: true });
  }

  function basisText(row) {
    const code = normalizeQcCode(row.action_code);
    if (code === "REVIEW_REQUIRED_QC_ABSORPTION_BASIS") {
      return (
        formatQcQuantitySourceLabel(
          row.absorption_basis_source || row.absorption_source,
        ) ||
        row.absorption_basis_source ||
        row.absorption_source ||
        "—"
      );
    }
    return (
      row.protocol_category_name ||
      row.protocol_category ||
      row.protocol_category_id ||
      "—"
    );
  }

  function contextText(row) {
    return (
      row.valuation_date ||
      row.refreshed_at ||
      row.snapshot_refreshed_at ||
      row.period_start ||
      "—"
    );
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
        const identity = qcActionRowIdentity(row);
        return `<tr class="cp-qc-aq-row" tabindex="0" role="button" data-qc-aq-id="${escapeHtml(identity)}" aria-label="Open QC action details for ${escapeHtml(row.product_name || row.product_id || "product")}">
          <td class="c-left">
            <div class="cp-cell-primary">${t(row.product_name)}</div>
            <div class="cp-muted-text">${t(row.product_id)}</div>
          </td>
          <td class="c-left">${escapeHtml(formatQcActionLabel(row.action_code) || row.action_code || "—")}</td>
          <td class="c-left">${chip(row.action_severity || row.allocation_status)}</td>
          <td class="c-left">${text(basisText(row))}</td>
          <td class="c-left">${chip(row.allocation_status)}</td>
          <td class="c-left">${text(contextText(row))}</td>
        </tr>`;
      })
      .join("");
  }

  function renderCard(row) {
    const identity = qcActionRowIdentity(row);
    return `<article class="cp-qc-aq-card" tabindex="0" role="button" data-qc-aq-id="${escapeHtml(identity)}" aria-label="Open QC action details for ${escapeHtml(row.product_name || row.product_id || "product")}">
      <div class="cp-qc-aq-card-head">
        <div>
          <div class="cp-qc-aq-card-title">${t(row.product_name)}</div>
          <div class="cp-muted-text">${escapeHtml(formatQcActionLabel(row.action_code) || row.action_code || "—")}</div>
        </div>
        <div class="cp-qc-aq-card-chips">
          ${chip(row.action_severity || row.allocation_status)}
          ${chip(row.allocation_status)}
        </div>
      </div>
    </article>`;
  }

  function kv(label, valueHtml) {
    if (valueHtml == null || valueHtml === "") return "";
    return `<div class="cp-qc-aq-detail-kv"><span class="cp-muted-text">${escapeHtml(label)}</span><div>${valueHtml}</div></div>`;
  }

  function copyBtn(value, label, attr) {
    if (isBlankQcValue(value)) return "";
    return `<button type="button" class="icon-btn cp-qc-aq-copy-btn" data-qc-aq-copy="${escapeHtml(attr)}" data-qc-aq-copy-label="${escapeHtml(label)}">Copy ${escapeHtml(label)}</button>`;
  }

  function navigationHtml(row) {
    const code = normalizeQcCode(row.action_code);
    const buttons = [];
    if (code === "BLOCKED_MISSING_FG_PROTOCOL_MAPPING") {
      buttons.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-qc-aq-nav="protocol">Open LIMS Protocol Manager</button>`,
      );
      buttons.push(
        `<p class="cp-muted-text cp-qc-aq-nav-note">Opens in a new tab. Locate Family Mapping manually — Product Group deep-link preselection is unavailable.</p>`,
      );
    } else if (
      code === "BLOCKED_MISSING_EFFECTIVE_FG_BASE_SPEC" ||
      code === "BLOCKED_EFFECTIVE_SPEC_RESOLUTION_ERROR" ||
      code === "BLOCKED_NO_REQUIRED_EFFECTIVE_SPEC_LINES" ||
      code === "BLOCKED_MISSING_QC_ANALYTICAL_METHOD"
    ) {
      buttons.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-qc-aq-nav="spec">Open Specification Profile Manager</button>`,
      );
      buttons.push(
        `<p class="cp-muted-text cp-qc-aq-nav-note">Opens in a new tab. Automatic Product preselection is not available.</p>`,
      );
    } else if (code === "REVIEW_REQUIRED_QC_ABSORPTION_BASIS") {
      const canRoute =
        !isBlankQcValue(row.product_id) &&
        !isBlankQcValue(row.period_start || state.period_start);
      if (canRoute) {
        buttons.push(
          `<button type="button" class="icon-btn icon-btn-primary" data-qc-aq-nav="absorption">Open commercial-sales assumptions</button>`,
        );
        buttons.push(
          `<p class="cp-muted-text cp-qc-aq-nav-note">Opens in a new tab. This governed quantity is used to absorb the Product QC allocation per base UOM. It does not determine the Product’s share of the QC pool.</p>`,
        );
      } else {
        buttons.push(
          `<button type="button" class="icon-btn" disabled title="Period and product are required">Open commercial-sales assumptions unavailable</button>`,
        );
      }
    } else {
      buttons.push(
        `<span class="cp-muted-text">No dedicated navigation route for this action code yet.</span>`,
      );
    }
    return buttons.join("");
  }

  function renderDetailHtml(row) {
    if (!row) {
      return `<div class="status">QC action details are unavailable.</div>`;
    }
    const severity = row.action_severity || row.allocation_status;
    const absorptionQty = pick(
      row.product_absorption_base_qty,
      row.product_absorption_quantity,
      row.absorption_quantity,
    );
    const absorptionSource = pick(
      row.absorption_basis_source,
      row.absorption_source,
    );
    const absorptionStatus = pick(
      row.absorption_basis_status,
      row.absorption_status,
    );
    const evidenceParts = [
      kv("Workload units", text(formatQcQuantity(row.workload_units) ?? "", "")),
      kv(
        "Product absorption base qty",
        text(formatQcQuantity(absorptionQty) ?? "", ""),
      ),
      kv(
        "Absorption basis source",
        text(
          formatQcQuantitySourceLabel(absorptionSource) || absorptionSource || "",
          "",
        ),
      ),
      kv("Absorption basis status", chip(absorptionStatus)),
      kv(
        "Recipient Products",
        text(
          formatQcQuantity(row.recipient_product_count, {
            maximumFractionDigits: 0,
          }) ?? "",
          "",
        ),
      ),
      kv(
        "Included Products",
        text(
          formatQcQuantity(row.included_product_count, {
            maximumFractionDigits: 0,
          }) ?? "",
          "",
        ),
      ),
      kv(
        "Excluded Products",
        text(
          formatQcQuantity(row.excluded_product_count, {
            maximumFractionDigits: 0,
          }) ?? "",
          "",
        ),
      ),
      kv(
        "Resolved coverage",
        text(formatQcCoveragePercent(row.resolved_coverage_ratio) ?? "", ""),
      ),
    ].filter(Boolean);

    const explainBtn =
      typeof openProductQcExplainFromQueue === "function"
        ? `<button type="button" class="icon-btn icon-btn-primary" data-qc-aq-nav="explain">Open Product QC Explain</button>`
        : "";

    return `<div class="cp-qc-aq-detail" data-qc-aq-detail-id="${escapeHtml(qcActionRowIdentity(row))}">
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Immediate action</h3>
        <div class="cp-qc-aq-detail-grid">
          ${kv("Severity", chip(severity))}
          ${kv("Action", escapeHtml(formatQcActionLabel(row.action_code) || row.action_code || "—"))}
          ${kv("Action code", text(row.action_code))}
          ${kv("Recommended action", text(row.recommended_action))}
          ${kv("Action note", text(row.action_note))}
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Product context</h3>
        <div class="cp-qc-aq-detail-grid">
          ${kv("Product name", text(row.product_name))}
          ${kv("Product ID", text(row.product_id))}
          ${kv("Product Group ID", text(row.product_group_id))}
          ${kv("Protocol category", text(row.protocol_category_name || row.protocol_category || row.protocol_category_id))}
          ${kv("Base specification profile", text(row.base_specification_profile_id || row.base_spec_profile_id))}
        </div>
        <div class="cp-qc-aq-actions">
          ${copyBtn(row.product_id, "Product ID", "product_id")}
          ${copyBtn(row.product_group_id, "Product Group ID", "product_group_id")}
          ${copyBtn(row.protocol_category_id || row.protocol_category, "protocol category ID", "protocol_category_id")}
          ${copyBtn(row.base_specification_profile_id || row.base_spec_profile_id, "base-spec profile ID", "base_specification_profile_id")}
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Costing context</h3>
        <div class="cp-qc-aq-detail-grid">
          ${kv("Period", text(row.period_start || state.period_start))}
          ${kv("Valuation date", text(row.valuation_date))}
          ${kv("Refresh run", text(row.refresh_run_id))}
          ${kv("Projection source", escapeHtml(formatQcProjectionSourceLabel(row.projection_source) || row.projection_source || "—"))}
          ${kv("Allocation status", chip(row.allocation_status))}
        </div>
        <div class="cp-qc-aq-actions">
          ${copyBtn(row.refresh_run_id, "refresh-run ID", "refresh_run_id")}
        </div>
      </section>
      ${
        evidenceParts.length
          ? `<section class="cp-detail-section">
        <h3 class="cp-section-title">QC evidence</h3>
        <div class="cp-qc-aq-detail-grid">${evidenceParts.join("")}</div>
      </section>`
          : ""
      }
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Navigation</h3>
        <div class="cp-qc-aq-actions">${navigationHtml(row)}</div>
      </section>
      ${
        explainBtn
          ? `<section class="cp-detail-section">
        <h3 class="cp-section-title">Product QC Explain</h3>
        <div class="cp-qc-aq-actions">${explainBtn}</div>
      </section>`
          : ""
      }
    </div>`;
  }

  function pick(...values) {
    for (const value of values) {
      if (!isBlankQcValue(value)) return value;
    }
    return null;
  }

  function getDrawerConfig(row) {
    const selected = selectRow(row);
    const severity = selected?.action_severity || selected?.allocation_status || "";
    const actionLabel =
      formatQcActionLabel(selected?.action_code) ||
      selected?.action_code ||
      "QC action";
    return {
      title: selected?.product_name || `Product ${selected?.product_id || ""}`,
      subtitle: `${actionLabel}${severity ? ` · ${formatQcStatusLabel(severity) || severity}` : ""}`,
      tabs: [{ id: "overview", label: "Overview" }],
      activeTab: "overview",
      row: selected,
    };
  }

  function renderDrawerTab(_tabId, row) {
    const selected =
      findRowByIdentity(qcActionRowIdentity(row)) || getSelectedRow() || row;
    return renderDetailHtml(selected);
  }

  function bindDetailActions(root, row) {
    if (!root || !row) return;
    const handler = (event) => {
      const copyBtnEl = event.target.closest("[data-qc-aq-copy]");
      if (copyBtnEl && root.contains(copyBtnEl)) {
        event.preventDefault();
        event.stopPropagation();
        const key = copyBtnEl.getAttribute("data-qc-aq-copy");
        const label =
          copyBtnEl.getAttribute("data-qc-aq-copy-label") || key || "value";
        let value = row[key];
        if (key === "protocol_category_id") {
          value = row.protocol_category_id || row.protocol_category;
        }
        if (key === "base_specification_profile_id") {
          value =
            row.base_specification_profile_id || row.base_spec_profile_id;
        }
        copyText(value, label);
        return;
      }
      const navBtn = event.target.closest("[data-qc-aq-nav]");
      if (navBtn && root.contains(navBtn)) {
        event.preventDefault();
        event.stopPropagation();
        const action = navBtn.getAttribute("data-qc-aq-nav");
        if (action === "protocol") openProtocolManager(row);
        else if (action === "spec") openSpecProfileManager(row);
        else if (action === "absorption") openAbsorptionReview(row);
        else if (action === "explain") {
          if (typeof openProductQcExplainFromQueue === "function") {
            void openProductQcExplainFromQueue(row);
          }
        }
      }
    };
    root.addEventListener("click", handler);
    boundHandlers.push({ el: root, type: "click", fn: handler });
  }

  function wireDrawerActions(row) {
    const identity = qcActionRowIdentity(row);
    const root = document.querySelector("#drawerContent .cp-qc-aq-detail");
    if (!root) return;
    if (root.getAttribute("data-qc-aq-detail-id") !== identity) return;
    bindDetailActions(root, row);
  }

  function render() {
    if (disposed || !isActiveLens()) return;
    const { workbenchSummary, tableHead, tableBody, tableWrap } = hostEls();
    unbindHandlers();

    if (workbenchSummary) {
      workbenchSummary.innerHTML = "";
    }
    if (tableWrap) {
      tableWrap.dataset.lens = QC_ACTION_QUEUE_LENS_ID;
      tableWrap.classList.add("cp-qc-aq-table-wrap");
    }

    if (state.permissionDenied) {
      if (tableHead) tableHead.innerHTML = "";
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6"><div class="status cp-qc-aq-status" role="status">Permission denied. QC Action Queue requires module:cost-sheet-review can_view.</div></td></tr>`;
      }
      return;
    }

    if (state.loading) {
      if (tableHead) tableHead.innerHTML = "";
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6"><div class="cost-sheet-explain-loading"><span class="cp-loading-spinner" aria-hidden="true"></span><span>Loading QC action queue…</span></div></td></tr>`;
      }
      return;
    }

    if (state.error) {
      if (tableHead) tableHead.innerHTML = "";
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6"><div class="status cp-qc-aq-status" role="status">${escapeHtml(state.error)}</div></td></tr>`;
      }
      return;
    }

    if (!state.rows.length) {
      if (tableHead) {
        tableHead.innerHTML = compactHeaderHtml();
      }
      const emptyMsg =
        state.total_count > 0
          ? `No rows on this page. ${state.total_count.toLocaleString("en-IN")} action(s) exist — use Previous/Next to recover.`
          : "No QC actions for this period and filters.";
      if (tableBody) {
        tableBody.innerHTML = `<tr class="cp-qc-aq-desktop-only"><td colspan="6"><div class="status cp-qc-aq-status" role="status">${escapeHtml(emptyMsg)}</div></td></tr>`;
      }
      if (workbenchSummary) {
        workbenchSummary.innerHTML = `<div class="cp-qc-aq-cards"><div class="status cp-qc-aq-status" role="status">${escapeHtml(emptyMsg)}</div></div>`;
      }
      return;
    }

    if (tableHead) tableHead.innerHTML = compactHeaderHtml();
    if (tableBody) tableBody.innerHTML = renderTableRows();
    if (workbenchSummary) {
      workbenchSummary.innerHTML = `<div class="cp-qc-aq-cards">${state.rows.map(renderCard).join("")}</div>`;
    }
    bindRowOpenHandlers();
  }

  function compactHeaderHtml() {
    return `<tr>
      <th class="c-left">Product</th>
      <th class="c-left">Issue</th>
      <th class="c-left">Severity</th>
      <th class="c-left">Basis</th>
      <th class="c-left">Status</th>
      <th class="c-left">Context</th>
    </tr>`;
  }

  function bindRowOpenHandlers() {
    const openFromEl = (el) => {
      const id = el?.getAttribute?.("data-qc-aq-id");
      const row = findRowByIdentity(id);
      if (!row) return;
      // Avoid a sticky focus ring on the row after the details modal closes.
      if (el && typeof el.blur === "function") el.blur();
      selectRow(row);
      if (typeof onOpenRow === "function") {
        onOpenRow(row);
      }
    };

    const clickFn = (event) => {
      if (event.target.closest("button, a, input, select, textarea, label")) {
        return;
      }
      const el = event.target.closest("[data-qc-aq-id]");
      if (!el) return;
      event.preventDefault();
      openFromEl(el);
    };
    const keyFn = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const el = event.target.closest("[data-qc-aq-id]");
      if (!el || event.target !== el) return;
      event.preventDefault();
      openFromEl(el);
    };

    const tableBody = document.getElementById("tableBody");
    const cards = document.querySelector(".cp-qc-aq-cards");
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

  function isShowingQcQueueRow(row) {
    if (!row) return false;
    return Boolean(qcActionRowIdentity(row));
  }

  return {
    load,
    refresh,
    destroy,
    dispose,
    render,
    onLensLoadStart,
    onLensExit,
    syncPageFromShell,
    getTotalCount,
    getPage,
    getActionCode,
    getSeenActionCodes,
    setSearchQuery,
    setActionCode,
    clearSearchTimer,
    getSelectedRow,
    selectRow,
    findRowByIdentity,
    getDrawerConfig,
    renderDrawerTab,
    wireDrawerActions,
    isShowingQcQueueRow,
    getState: () => ({ ...state, rows: [...state.rows] }),
    isActive: isActiveLens,
  };
}
