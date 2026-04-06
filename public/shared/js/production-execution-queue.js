/* production-execution-queue.js */
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "production-execution-queue";
let PERM_CAN_VIEW = true;

// Elements
const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableBody = $("tableBody");
const refreshBtn = $("refreshBtn");
const searchBox = $("search");
const lastRefreshed = $("lastRefreshed");
const kpiStrip = $("kpiStrip");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const drawerClose = $("drawerClose");
const drawerTabs = $("drawerTabs");
const searchClear = $("searchClear");

// Data
let LAST_REFRESH_TIME = null;

function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const statusDetail = document.getElementById("sc-status-detail");
  if (!LAST_REFRESH_TIME) {
    lastRefreshed.className = lastRefreshed.className
      .replace(/snapshot-\w+/g, "")
      .trim();
    const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
    if (lbl) lbl.textContent = "Not loaded";
    if (statusDetail) statusDetail.textContent = "Not yet loaded";
    lastRefreshed.setAttribute("aria-label", "Data not yet loaded");
    return;
  }
  const elapsedMs = Date.now() - LAST_REFRESH_TIME.getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  let label, statusClass;
  if (elapsedMin < 1) {
    label = "Just now";
    statusClass = "snapshot-fresh";
  } else if (elapsedMin < 15) {
    label = `${elapsedMin}m ago`;
    statusClass = "snapshot-fresh";
  } else if (elapsedMin < 60) {
    label = `${elapsedMin}m ago`;
    statusClass = "snapshot-warning";
  } else {
    const elapsedHr = Math.floor(elapsedMin / 60);
    label = `${elapsedHr}h ago`;
    statusClass = "snapshot-stale";
  }
  const detailText = `Last refreshed: ${LAST_REFRESH_TIME.toLocaleString()}`;
  const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
  if (lbl) lbl.textContent = label;
  if (statusDetail) statusDetail.textContent = detailText;
  lastRefreshed.className =
    lastRefreshed.className.replace(/snapshot-\w+/g, "").trim() +
    " " +
    statusClass;
  lastRefreshed.setAttribute("aria-label", detailText);
}
let QUEUE = [];
let VIEW = [];
let CURRENT_LENS = "ready";
let SELECTED_ROW = null;
let CURRENT_PAGE = 1;
let PAGE_SIZE = 25;
let LAST_PAGE_ROWS = [];
let CURRENT_ROWS = [];

// ── Product classification cache ─────────────────────────────────────────────
const PRODUCT_DETAILS_MAP = new Map();

async function loadProductDetails(force = false) {
  if (!force && PRODUCT_DETAILS_MAP.size > 0) {
    console.debug(
      "[PEQ] loadProductDetails: using cached map (",
      PRODUCT_DETAILS_MAP.size,
      "entries)",
    );
    return true;
  }
  try {
    PRODUCT_DETAILS_MAP.clear();

    const PAGE_SIZE = 1000;
    let from = 0;
    let allRows = [];

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("v_product_details")
        .select(
          "product_id,category_name,subcategory_name,group_name,sub_group_name",
        )
        .range(from, to);

      if (error) {
        console.warn("[PEQ] loadProductDetails error:", error);
        return false;
      }

      const rows = data || [];
      allRows = allRows.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    allRows.forEach((r) => {
      const key = String(r.product_id);
      PRODUCT_DETAILS_MAP.set(key, {
        category_name: r.category_name || "—",
        subcategory_name: r.subcategory_name || "—",
        group_name: r.group_name || "—",
        sub_group_name: r.sub_group_name || "—",
      });
    });

    console.debug("[PEQ] product details loaded:", PRODUCT_DETAILS_MAP.size);
    if (PRODUCT_DETAILS_MAP.size === 0) {
      console.warn(
        "[PEQ] loadProductDetails: map is empty after load — v_product_details may have returned no rows",
      );
    }
    return true;
  } catch (e) {
    console.warn("[PEQ] loadProductDetails failed:", e);
    return false;
  }
}

function enrichRowWithClassification(row) {
  if (row.product_id == null) {
    return Object.assign({}, row, {
      category_name: "—",
      subcategory_name: "—",
      group_name: "—",
      sub_group_name: "—",
      _classification_missing: true,
    });
  }
  const key = String(row.product_id);
  const det = PRODUCT_DETAILS_MAP.get(key);
  return Object.assign({}, row, {
    category_name: det?.category_name ?? "—",
    subcategory_name: det?.subcategory_name ?? "—",
    group_name: det?.group_name ?? "—",
    sub_group_name: det?.sub_group_name ?? "—",
    _classification_missing: !det,
  });
}

function reEnrichQueueRows() {
  if (!QUEUE.length) return;
  QUEUE = QUEUE.map(enrichRowWithClassification);
  logMissingClassificationSummary(QUEUE);
  applyLensFilter();
}

function logMissingClassificationSummary(rows) {
  const missing = rows.filter((r) => r._classification_missing);
  if (!missing.length) return;
  const sampleProductIds = [...new Set(missing.map((r) => r.product_id))].slice(
    0,
    10,
  );
  console.warn("[PEQ] Missing classification rows:", {
    count: missing.length,
    sampleProductIds,
  });
}

// ── Universal queue filter state ─────────────────────────────────────────────
const QUEUE_FILTER_STATES = [
  "NOT_INITIATED",
  "WIP",
  "FG_BULK",
  "BOTTLED",
  "MIXED",
];

function getDefaultQueueFilters() {
  return {
    states: [],
    categories: [],
    subcategories: [],
    groups: [],
    subgroups: [],
  };
}

let QUEUE_FILTERS = getDefaultQueueFilters();

function formatStateLabel(value) {
  const map = {
    NOT_INITIATED: "Not Initiated",
    WIP: "WIP",
    FG_BULK: "FG Bulk",
    BOTTLED: "Bottled",
    MIXED: "Mixed",
  };
  return (
    map[String(value || "").toUpperCase()] ||
    String(value || "").replace(/_/g, " ")
  );
}

function isAnyQueueFilterActive() {
  return (
    QUEUE_FILTERS.states.length > 0 ||
    QUEUE_FILTERS.categories.length > 0 ||
    QUEUE_FILTERS.subcategories.length > 0 ||
    QUEUE_FILTERS.groups.length > 0 ||
    QUEUE_FILTERS.subgroups.length > 0
  );
}

function applyQueueFilters(rows) {
  let out = rows;
  if (QUEUE_FILTERS.states.length) {
    out = out.filter((r) =>
      QUEUE_FILTERS.states.includes(
        String(r.primary_state || "").toUpperCase(),
      ),
    );
  }
  if (QUEUE_FILTERS.categories.length) {
    out = out.filter((r) =>
      QUEUE_FILTERS.categories.includes(r.category_name || "—"),
    );
  }
  if (QUEUE_FILTERS.subcategories.length) {
    out = out.filter((r) =>
      QUEUE_FILTERS.subcategories.includes(r.subcategory_name || "—"),
    );
  }
  if (QUEUE_FILTERS.groups.length) {
    out = out.filter((r) => QUEUE_FILTERS.groups.includes(r.group_name || "—"));
  }
  if (QUEUE_FILTERS.subgroups.length) {
    out = out.filter((r) =>
      QUEUE_FILTERS.subgroups.includes(r.sub_group_name || "—"),
    );
  }
  return out;
}

function setQueueStateFilter(value, checked) {
  const v = String(value || "").toUpperCase();
  if (checked) {
    if (!QUEUE_FILTERS.states.includes(v)) QUEUE_FILTERS.states.push(v);
  } else {
    QUEUE_FILTERS.states = QUEUE_FILTERS.states.filter((s) => s !== v);
  }
  _syncFilterDrawerUI();
  _updateFilterBtnState();
  CURRENT_PAGE = 1;
  applyLensFilter();
}

function setQueueClassificationFilter(dimension, value, checked) {
  const arr = QUEUE_FILTERS[dimension];
  if (!arr) return;
  if (checked) {
    if (!arr.includes(value)) arr.push(value);
  } else {
    QUEUE_FILTERS[dimension] = arr.filter((v) => v !== value);
  }
  _syncFilterDrawerUI();
  _updateFilterBtnState();
  CURRENT_PAGE = 1;
  applyLensFilter();
}

function clearQueueFilters() {
  QUEUE_FILTERS = getDefaultQueueFilters();
  _syncFilterDrawerUI();
  _updateFilterBtnState();
  CURRENT_PAGE = 1;
  applyLensFilter();
}

function _updateFilterBtnState() {
  const btn = document.getElementById("peqFilterBtn");
  if (!btn) return;
  const active = isAnyQueueFilterActive();
  btn.classList.toggle("peq-filter-btn--active", active);
  const badge = btn.querySelector(".peq-filter-badge");
  if (badge) {
    const count = [
      QUEUE_FILTERS.states,
      QUEUE_FILTERS.categories,
      QUEUE_FILTERS.subcategories,
      QUEUE_FILTERS.groups,
      QUEUE_FILTERS.subgroups,
    ].filter((arr) => arr.length > 0).length;
    badge.textContent = count || "";
    badge.style.display = count ? "" : "none";
  }
}

function _syncFilterDrawerUI() {
  const drawer = document.getElementById("peqFilterDrawer");
  if (!drawer) return;
  QUEUE_FILTER_STATES.forEach((val) => {
    const cb = drawer.querySelector(`input[data-state="${val}"]`);
    if (cb) cb.checked = QUEUE_FILTERS.states.includes(val);
  });
  const summary = drawer.querySelector(".peq-filter-summary");
  if (summary) {
    if (!QUEUE_FILTERS.states.length) {
      summary.textContent = "All states";
    } else {
      summary.textContent = QUEUE_FILTERS.states
        .map(formatStateLabel)
        .join(", ");
    }
  }
  // sync classification checkboxes
  [
    { dim: "categories", attr: "data-category" },
    { dim: "subcategories", attr: "data-subcategory" },
    { dim: "groups", attr: "data-group" },
    { dim: "subgroups", attr: "data-subgroup" },
  ].forEach(({ dim, attr }) => {
    drawer.querySelectorAll(`input[${attr}]`).forEach((cb) => {
      cb.checked = QUEUE_FILTERS[dim].includes(cb.getAttribute(attr));
    });
  });
}

// ── Master-driven classification option helpers ───────────────────────────
function _masterValues(key) {
  const vals = [];
  PRODUCT_DETAILS_MAP.forEach((det) => {
    const v = det[key];
    if (v && v !== "—") vals.push(v);
  });
  return [...new Set(vals)].sort((a, b) => a.localeCompare(b));
}
function getAllCategoryOptions() {
  return _masterValues("category_name");
}
function getAllSubcategoryOptions() {
  return _masterValues("subcategory_name");
}
function getAllGroupOptions() {
  return _masterValues("group_name");
}
function getAllSubgroupOptions() {
  return _masterValues("sub_group_name");
}

// ── Per-dimension count helpers (count from full QUEUE, before any filter) ──
function _countBy(key) {
  const map = {};
  QUEUE.forEach((r) => {
    const v = r[key];
    if (v && v !== "—") map[v] = (map[v] || 0) + 1;
  });
  return map;
}
function getCategoryCounts() {
  return _countBy("category_name");
}
function getSubcategoryCounts() {
  return _countBy("subcategory_name");
}
function getGroupCounts() {
  return _countBy("group_name");
}
function getSubgroupCounts() {
  return _countBy("sub_group_name");
}

// ── Label formatter with count ────────────────────────────────────────────
function formatFilterOptionLabel(value, count) {
  return `${value} (${count ?? 0})`;
}

function _populateClassificationFilters() {
  const drawer = document.getElementById("peqFilterDrawer");
  if (!drawer) return;

  // remove any previously injected classification sections
  drawer
    .querySelectorAll(".peq-filter-section--classification")
    .forEach((el) => el.remove());

  const actionsEl = drawer.querySelector(".peq-filter-actions");

  const dims = [
    {
      dim: "categories",
      attr: "data-category",
      label: "Category",
      getOptions: getAllCategoryOptions,
      getCounts: getCategoryCounts,
    },
    {
      dim: "subcategories",
      attr: "data-subcategory",
      label: "Sub-category",
      getOptions: getAllSubcategoryOptions,
      getCounts: getSubcategoryCounts,
    },
    {
      dim: "groups",
      attr: "data-group",
      label: "Group",
      getOptions: getAllGroupOptions,
      getCounts: getGroupCounts,
    },
    {
      dim: "subgroups",
      attr: "data-subgroup",
      label: "Sub-group",
      getOptions: getAllSubgroupOptions,
      getCounts: getSubgroupCounts,
    },
  ];

  dims.forEach(({ dim, attr, label, getOptions, getCounts }) => {
    // options from master; counts from current full queue
    const options = getOptions();
    if (!options.length) return;
    const counts = getCounts();

    const section = document.createElement("div");
    section.className = "peq-filter-section peq-filter-section--classification";

    const titleEl = document.createElement("div");
    titleEl.className = "peq-filter-section-title";
    titleEl.textContent = label;
    section.appendChild(titleEl);

    const ul = document.createElement("ul");
    ul.className = "peq-filter-checklist";
    options.forEach((val) => {
      const li = document.createElement("li");
      const lbl = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute(attr, val);
      cb.checked = QUEUE_FILTERS[dim].includes(val);
      lbl.appendChild(cb);
      lbl.appendChild(
        document.createTextNode(
          " " + formatFilterOptionLabel(val, counts[val] || 0),
        ),
      );
      li.appendChild(lbl);
      ul.appendChild(li);
    });
    section.appendChild(ul);

    if (actionsEl) {
      drawer.insertBefore(section, actionsEl);
    } else {
      drawer.appendChild(section);
    }
  });
}

let _filterDrawerOpen = false;

function toggleFilterDrawer() {
  const drawer = document.getElementById("peqFilterDrawer");
  if (!drawer) return;
  _filterDrawerOpen = !_filterDrawerOpen;
  drawer.classList.toggle("open", _filterDrawerOpen);
  if (_filterDrawerOpen) {
    _syncFilterDrawerUI();
    setTimeout(() => {
      document.addEventListener("click", _onFilterOutsideClick);
      document.addEventListener("keydown", _onFilterEsc);
    }, 0);
  } else {
    document.removeEventListener("click", _onFilterOutsideClick);
    document.removeEventListener("keydown", _onFilterEsc);
  }
}

function closeFilterDrawer() {
  if (!_filterDrawerOpen) return;
  _filterDrawerOpen = false;
  const drawer = document.getElementById("peqFilterDrawer");
  if (drawer) drawer.classList.remove("open");
  document.removeEventListener("click", _onFilterOutsideClick);
  document.removeEventListener("keydown", _onFilterEsc);
}

function _onFilterOutsideClick(e) {
  const wrapper = document.getElementById("peqFilterWrapper");
  if (wrapper && !wrapper.contains(e.target)) closeFilterDrawer();
}

function _onFilterEsc(e) {
  if (e.key === "Escape") closeFilterDrawer();
}

function _wireFilterDrawer() {
  const btn = document.getElementById("peqFilterBtn");
  const drawer = document.getElementById("peqFilterDrawer");
  if (!btn || !drawer) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFilterDrawer();
  });

  QUEUE_FILTER_STATES.forEach((val) => {
    const cb = drawer.querySelector(`input[data-state="${val}"]`);
    if (cb) {
      cb.addEventListener("change", () => setQueueStateFilter(val, cb.checked));
    }
  });

  // classification checkboxes are delegated (populated dynamically)
  drawer.addEventListener("change", (e) => {
    const cb = e.target;
    if (!(cb instanceof HTMLInputElement)) return;
    if (cb.hasAttribute("data-category"))
      setQueueClassificationFilter(
        "categories",
        cb.getAttribute("data-category"),
        cb.checked,
      );
    else if (cb.hasAttribute("data-subcategory"))
      setQueueClassificationFilter(
        "subcategories",
        cb.getAttribute("data-subcategory"),
        cb.checked,
      );
    else if (cb.hasAttribute("data-group"))
      setQueueClassificationFilter(
        "groups",
        cb.getAttribute("data-group"),
        cb.checked,
      );
    else if (cb.hasAttribute("data-subgroup"))
      setQueueClassificationFilter(
        "subgroups",
        cb.getAttribute("data-subgroup"),
        cb.checked,
      );
  });

  const selectAll = drawer.querySelector("#peqFilterSelectAll");
  if (selectAll) {
    selectAll.addEventListener("click", () => {
      QUEUE_FILTERS.states = [...QUEUE_FILTER_STATES];
      _syncFilterDrawerUI();
      _updateFilterBtnState();
      CURRENT_PAGE = 1;
      applyLensFilter();
    });
  }

  const clearBtn = drawer.querySelector("#peqFilterClear");
  if (clearBtn) clearBtn.addEventListener("click", clearQueueFilters);

  // stop clicks inside drawer from bubbling to outside-click handler
  drawer.addEventListener("click", (e) => e.stopPropagation());
}

function getFilteredRowCountText(filteredCount, totalCount) {
  if (filteredCount === totalCount)
    return `Showing ${totalCount} batch${totalCount !== 1 ? "es" : ""}`;
  return `Showing ${filteredCount} of ${totalCount} batch${totalCount !== 1 ? "es" : ""}`;
}

function _updateRowCount(filteredCount, totalCount) {
  const el = document.getElementById("peqRowCount");
  if (!el) return;
  el.textContent = getFilteredRowCountText(filteredCount, totalCount);
  el.style.display = "";
}

const LENSES = [
  { id: "ready", label: "Ready to Execute" },
  { id: "fast_conversion", label: "Fast Conversion" },
  { id: "pm_blocked", label: "PM Blocked" },
  { id: "rm_blocked", label: "RM Blocked" },
  { id: "all", label: "All Batches" },
];

// â”€â”€ Per-batch blocker caches (populated lazily on tab open) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PM_BLOCKER_CACHE = new Map();
const RM_BLOCKER_CACHE = new Map();

// â”€â”€ Currently open copy menu (one at a time) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _activeStatusMenu = null;

function getBatchKey(row) {
  return `${row.product_id}::${row.batch_number}`;
}

function setStatus(msg, type = "normal") {
  statusArea.textContent = msg;
  statusArea.style.display = "block";
  tableWrap.style.display = "none";
  tableWrap.classList.remove("tw-visible");

  // reflect type for styling or automated tests
  try {
    statusArea.dataset.type = type;
  } catch {
    // ignore in environments that disallow dataset
  }
}

async function refreshSnapshotAndReload() {
  // Heavy planning data refresh is handled by scheduled jobs;
  // this button only reloads served snapshot data.
  try {
    refreshBtn.disabled = true;
    setStatus("Reloading latest served snapshots…");
    PM_BLOCKER_CACHE.clear();
    RM_BLOCKER_CACHE.clear();
    await loadQueue();
    showToast("Latest queue and blocker snapshots reloaded", "success");
  } catch (e) {
    console.error("Refresh failed", e);
    setStatus("Refresh failed: " + (e.message || e), "error");
  } finally {
    refreshBtn.disabled = false;
  }
}

function clearStatus() {
  statusArea.style.display = "none";
  tableWrap.style.display = "block";
  tableWrap.classList.add("tw-visible");
}

async function loadPermissions(sessionUserId) {
  try {
    const { data: perms, error: permsErr } = await supabase.rpc(
      "get_user_permissions",
      { p_user_id: sessionUserId },
    );
    if (!permsErr && Array.isArray(perms)) {
      const p = perms.find((r) => r && r.target === `module:${MODULE_ID}`);
      if (p) PERM_CAN_VIEW = !!p.can_view;
    } else {
      // fallback
      try {
        const { data: permRows } = await supabase
          .from("user_permissions")
          .select("module_id, can_view")
          .eq("user_id", sessionUserId)
          .eq("module_id", MODULE_ID)
          .limit(1);
        if (Array.isArray(permRows) && permRows.length) {
          PERM_CAN_VIEW = !!permRows[0].can_view;
        }
      } catch (e) {
        console.warn("Permission fallback failed", e);
      }
    }
  } catch (e) {
    console.warn("Permission RPC failed", e);
  }
}

function renderLensPills() {
  lensPills.innerHTML = "";
  // keep compact select in sync (rebuild options)
  if (lensSelect) {
    lensSelect.innerHTML = "";
  }
  LENSES.forEach((l) => {
    const btn = document.createElement("button");
    btn.className = `pill${l.id === CURRENT_LENS ? " active" : ""}`;
    btn.textContent = l.label;
    btn.dataset.lens = l.id;

    btn.addEventListener("click", () => {
      CURRENT_LENS = l.id;
      renderLensPills();
      applyLensFilter();
    });

    lensPills.appendChild(btn);
    // add option for small-screen select
    if (lensSelect) {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.label;
      if (l.id === CURRENT_LENS) opt.selected = true;
      lensSelect.appendChild(opt);
    }
  });

  // sync select value
  if (lensSelect) lensSelect.value = CURRENT_LENS;
}

// Status helper utilities
function isPmOk(row) {
  const s = String(row?.pm_gate_status || "").toUpperCase();
  return s === "OK" || s === "PM_OK";
}
// Stage-aware RM readiness helper (preferred)
function isRmClearForExecution(row) {
  return row?.is_rm_ok_for_stage === true;
}

function isFastConversion(row) {
  const s = String(row?.primary_state || "").toUpperCase();
  return s === "FG_BULK" || s === "BOTTLED";
}

function getRmDisplay(row) {
  const state = String(row?.primary_state || "").toUpperCase();
  if (state === "FG_BULK" || state === "BOTTLED") {
    return { text: "N/A", cls: "rm-na" };
  }
  return isRmClearForExecution(row)
    ? { text: "RM OK", cls: "rm-ok" }
    : { text: "RM Blocked", cls: "rm-block" };
}

// â”€â”€ Modal display helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatStatusBadge(text, type) {
  const S = {
    ok: "background:#e7f8ef;color:#1d8f54",
    block: "background:#fdecea;color:#c0392b",
    warn: "background:#fff4e5;color:#d97706",
    na: "background:#f3f4f6;color:#6b7280",
    info: "background:#eff6ff;color:#2563eb",
  };
  return `<span class="peq-badge" style="${S[type] || S.na}">${text}</span>`;
}

function makeSummaryCardHtml(label, value) {
  return `<div class="peq-summary-card"><div class="peq-k">${label}</div><div class="peq-v">${value}</div></div>`;
}

function getLaneLabel(row) {
  const l = Number(row?.queue_lane);
  if (l === 1) return { text: "Ready", type: "ok" };
  if (l === 2) return { text: "PM Blocked", type: "warn" };
  if (l === 3) return { text: "RM Blocked", type: "block" };
  return { text: `Lane ${l || "?"}`, type: "na" };
}

function getRecommendedAction(row) {
  const fgBtl = isFastConversion(row);
  const rmClear = fgBtl || isRmClearForExecution(row);
  const pmClear = isPmOk(row);
  if (!rmClear)
    return {
      text: "Resolve raw material blocker first. Refer to the RM Status tab.",
      cls: "action-warn",
    };
  if (!pmClear)
    return {
      text: "Resolve packing material blocker first. Refer to the PM Status tab.",
      cls: "action-warn",
    };
  if (fgBtl)
    return {
      text: "Prioritize this batch for fast conversion into finished supply.",
      cls: "action-ok",
    };
  return {
    text: "All gates clear. Proceed with production execution for this batch.",
    cls: "action-ok",
  };
}

// Formatter: human-readable batch size
function formatBatchSize(row) {
  if (row?.batch_size_declared == null) return "-";
  const qty = row.batch_size_declared;
  const uom = row.batch_uom || "";
  return `${qty} ${uom}`.trim();
}

// Formatter: storage quantity depending on primary_state
function formatStorageQty(row) {
  const state = String(row?.primary_state || "").toUpperCase();

  if (state === "FG_BULK") {
    if (row?.fg_bulk_on_hand_base_qty == null) return "-";
    const uom = row.batch_uom || "";
    return `${row.fg_bulk_on_hand_base_qty} ${uom}`.trim();
  }

  if (state === "BOTTLED") {
    const units = row?.bottled_on_hand_units;
    const baseQty = row?.bottled_on_hand_base_qty;
    const uom = row.batch_uom || "";

    if (units == null && baseQty == null) return "-";
    if (units != null && baseQty != null) {
      return `${units} Nos / ${baseQty} ${uom}`.trim();
    }
    if (units != null) return `${units} Nos`;
    return `${baseQty} ${uom}`.trim();
  }

  if (state === "WIP") {
    if (row?.batch_size_declared == null) return "-";
    const uom = row.batch_uom || "";
    return `${row.batch_size_declared} ${uom}`.trim();
  }

  return "-";
}

function applyLensFilter() {
  if (!Array.isArray(QUEUE)) QUEUE = [];
  let rows = applyQueueFilters([...QUEUE]);
  switch (CURRENT_LENS) {
    case "ready":
      rows = rows.filter((r) => Number(r.queue_lane) === 1);
      break;
    case "fast_conversion":
      rows = rows.filter((r) => isFastConversion(r));
      break;
    case "pm_blocked":
      rows = rows.filter((r) => Number(r.queue_lane) === 2);
      break;
    case "rm_blocked":
      rows = rows.filter((r) => Number(r.queue_lane) === 3);
      break;
    case "all":
    default:
      break;
  }
  // Default sort by priority_rank_v4 ascending
  rows.sort((a, b) => {
    const A = Number(a.priority_rank_v4 ?? 0);
    const B = Number(b.priority_rank_v4 ?? 0);
    return A - B;
  });
  VIEW = rows;
  console.debug("PEQ rows after lens:", CURRENT_LENS, VIEW.length);
  // reset pagination when lens changes
  CURRENT_PAGE = 1;
  applySearch();
  // show copy button only for Ready to Execute lens
  const _copyBtn = document.getElementById("copyReadyBtn");
  if (_copyBtn) _copyBtn.style.display = CURRENT_LENS === "ready" ? "" : "none";
}

function applySearch() {
  const q = (searchBox.value || "").trim().toLowerCase();
  let filtered = VIEW;
  if (q) {
    filtered = VIEW.filter((r) => {
      const hay = [
        r.batch_number,
        r.product_id != null ? String(r.product_id) : null,
        r.product_name != null ? String(r.product_name) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  _updateRowCount(filtered.length, QUEUE.length);
  renderTable(filtered);
}

function renderSummaryStrip(rowsDisplayed) {
  const total = QUEUE.length || 0;
  const readyCount = QUEUE.filter((r) => Number(r.queue_lane) === 1).length;
  const pmBlocked = QUEUE.filter((r) => Number(r.queue_lane) === 2).length;
  const rmBlocked = QUEUE.filter((r) => Number(r.queue_lane) === 3).length;
  const fastConv = QUEUE.filter((r) => isFastConversion(r)).length;

  const visibleRows = Array.isArray(rowsDisplayed) ? rowsDisplayed : VIEW;
  const visibleRisk = (visibleRows || []).reduce(
    (s, r) => s + Number(r.total_risk_reduction_units || 0),
    0,
  );

  kpiStrip.innerHTML = "";
  function formatNumeric(v) {
    if (v == null || Number.isNaN(Number(v))) return "-";
    const n = Number(v);
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toFixed(2)));
  }

  const items = [
    { key: "total", label: "Total Batches", value: total },
    { key: "ready", label: "Ready to Execute", value: readyCount },
    { key: "pm-blocked", label: "PM Blocked", value: pmBlocked },
    { key: "rm-blocked", label: "RM Blocked", value: rmBlocked },
    { key: "fast-conv", label: "Fast Conversion", value: fastConv },
    {
      key: "visible-risk",
      label: "Visible Risk Reduction",
      value: visibleRisk,
    },
  ];

  items.forEach((it) => {
    const el = document.createElement("div");
    el.className = `kpi ${it.key}`;
    const displayVal =
      it.key === "visible-risk"
        ? formatNumeric(it.value)
        : formatNumeric(it.value);
    el.innerHTML = `<div>${it.label}</div><div>${displayVal}</div>`;
    kpiStrip.appendChild(el);
  });
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  if (!rows || rows.length === 0) {
    setStatus("No rows match the current filter.");
    document.getElementById("paginationInfo").textContent = "";
    CURRENT_ROWS = [];
    renderSummaryStrip([]);
    return;
  }
  clearStatus();
  CURRENT_ROWS = rows;

  // pagination
  const pageSize = PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;
  const start = (CURRENT_PAGE - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = rows.slice(start, end);
  console.debug("renderTable total rows:", rows.length);
  console.debug(
    "renderTable current page:",
    CURRENT_PAGE,
    "page size:",
    pageSize,
  );
  console.debug("renderTable pageRows:", pageRows.length, pageRows.slice(0, 3));

  pageRows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.tabIndex = 0;
    tr.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetails(r);
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.stopPropagation();
        openDetails(r);
      }
    });

    const make = (txt, cls) => {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = txt;
      return td;
    };

    // Lane indicator: narrow coloured td (background only, no content)
    const laneNum = Number(r.queue_lane);
    const laneCls =
      laneNum === 1
        ? "lane-ready"
        : laneNum === 2
          ? "lane-pm-block"
          : laneNum === 3
            ? "lane-rm-block"
            : "";
    const laneTd = document.createElement("td");
    laneTd.className = `lane-col${laneCls ? " " + laneCls : ""}`;

    // Priority
    const priorityTd = make(r.priority_rank_v4 ?? "", "c-center priority-col");

    // Product cell: name bold + muted id below
    const productTd = document.createElement("td");
    productTd.className = "product-cell c-left";
    const nameSpan = document.createElement("span");
    nameSpan.className = "product-name";
    nameSpan.textContent = r.product_name || String(r.product_id || "-");
    productTd.appendChild(nameSpan);
    if (r.product_id != null) {
      const idSpan = document.createElement("span");
      idSpan.className = "product-id-muted";
      idSpan.textContent = `ID ${r.product_id}`;
      productTd.appendChild(idSpan);
    }

    // Batch
    const batchTd = make(r.batch_number || "-", "c-center");

    // State
    const stateTd = make(r.primary_state || "-", "c-center");

    // PM chip
    const pmTd = document.createElement("td");
    pmTd.className = "c-center";
    const pmChip = document.createElement("span");
    pmChip.className = `status-chip ${isPmOk(r) ? "pm-ok" : "pm-block"}`;
    pmChip.textContent = isPmOk(r) ? "PM OK" : "PM Blocked";
    pmChip.title = isPmOk(r)
      ? "PM gates are clear"
      : "Blocked after priority-based reservation of packing material";
    pmTd.appendChild(pmChip);

    // RM chip
    const rmTd = document.createElement("td");
    rmTd.className = "c-center";
    const rmChip = document.createElement("span");
    const rmDisplay = getRmDisplay(r);
    rmChip.className = `status-chip ${rmDisplay.cls}`;
    rmChip.textContent = rmDisplay.text;
    rmChip.title =
      rmDisplay.cls === "rm-na"
        ? "RM is not an execution gate for FG_BULK / BOTTLED stages"
        : rmDisplay.cls === "rm-ok"
          ? "RM gates are clear"
          : "Blocked after priority-based reservation of raw material";
    rmTd.appendChild(rmChip);

    tr.appendChild(laneTd);
    tr.appendChild(priorityTd);
    tr.appendChild(productTd);
    tr.appendChild(batchTd);
    tr.appendChild(stateTd);
    tr.appendChild(pmTd);
    tr.appendChild(rmTd);

    tableBody.appendChild(tr);
  });

  const pageInfoEl = document.getElementById("peqPage");
  if (pageInfoEl) {
    pageInfoEl.textContent = `Page ${CURRENT_PAGE}/${totalPages}`;
    pageInfoEl.title = `Page ${CURRENT_PAGE} of ${totalPages}`;
  }
  // enable/disable prev/next buttons
  try {
    const _prev = document.getElementById("prevPage");
    const _next = document.getElementById("nextPage");
    if (_prev) _prev.disabled = CURRENT_PAGE <= 1;
    if (_next) _next.disabled = CURRENT_PAGE >= totalPages;
  } catch {
    /* ignore */
  }
  // remember for export
  LAST_PAGE_ROWS = pageRows;
  renderSummaryStrip(pageRows);
}

function openDetails(row) {
  try {
    SELECTED_ROW = enrichRowWithClassification(row);
    const _modal = document.getElementById("detailsModal");
    const _title = document.getElementById("drawerTitle");
    const _subtitle = document.getElementById("drawerSubtitle");
    if (_title)
      _title.textContent = `${row.product_name || ""} — Batch ${row.batch_number || ""}`;
    if (_subtitle) {
      const laneInfo = getLaneLabel(row);
      _subtitle.innerHTML =
        `<span>${row.primary_state || "-"}</span>` +
        `<span style="opacity:0.4">·</span>` +
        `<span>Priority #${row.priority_rank_v4 ?? "-"}</span>` +
        `<span style="opacity:0.4">·</span>` +
        formatStatusBadge(laneInfo.text, laneInfo.type);
    }
    if (_modal) {
      _modal.classList.remove("hidden");
      _modal.setAttribute("aria-hidden", "false");
    }
    // synchronous — #detailsModal is a sibling of .table-card, not an ancestor,
    // so row click events never bubble into it; setTimeout is not needed
    setDrawerTab("details");
  } catch (err) {
    console.error("[PEQ] openDetails error:", err);
  }
}

function closeDetails() {
  const _modal = document.getElementById("detailsModal");
  if (!_modal) return;
  const focused = document.activeElement;
  if (focused && _modal.contains(focused)) focused.blur();
  _modal.classList.add("hidden");
  _modal.setAttribute("aria-hidden", "true");
  SELECTED_ROW = null;
}

// â”€â”€ Blocker loaders (snapshot tables) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _getMonthStart() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-01"
  );
}

async function loadPmBlockers(row) {
  const key = getBatchKey(row);
  if (PM_BLOCKER_CACHE.has(key)) return PM_BLOCKER_CACHE.get(key);
  const { data, error } = await supabase
    .from("pm_status_snapshot_current_month")
    .select(
      "product_id,batch_number,pm_stock_item_id,pm_name,pm_uom," +
        "planned_pm_qty,issued_pm_qty,stock_qty,uncovered_qty," +
        "is_optional_pm,is_override_pm,is_blocking_line,pm_status_class,pm_status_reason",
    )
    .eq("month_start", _getMonthStart())
    .eq("product_id", row.product_id)
    .eq("batch_number", row.batch_number)
    .order("is_blocking_line", { ascending: false })
    .order("pm_name", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  PM_BLOCKER_CACHE.set(key, rows);
  return rows;
}

async function loadRmBlockers(row) {
  const key = getBatchKey(row);
  if (RM_BLOCKER_CACHE.has(key)) return RM_BLOCKER_CACHE.get(key);
  const { data, error } = await supabase
    .from("rm_status_snapshot_current_month")
    .select(
      "product_id,batch_number,rm_stock_item_id,rm_name,rm_uom," +
        "planned_rm_qty,issued_rm_qty,stock_qty,uncovered_qty," +
        "is_optional_rm,rm_procurement_mode,has_unassigned_issues," +
        "is_blocking_line,rm_status_class,rm_status_reason",
    )
    .eq("month_start", _getMonthStart())
    .eq("product_id", row.product_id)
    .eq("batch_number", row.batch_number)
    .order("is_blocking_line", { ascending: false })
    .order("rm_name", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  RM_BLOCKER_CACHE.set(key, rows);
  return rows;
}

// â”€â”€ Status class formatters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatPmStatusClass(value) {
  const map = {
    LABEL_OR_OVERRIDE_BLOCKING: "Label / Override Blocking",
    BLOCKING_SHORTAGE: "Blocking Shortage",
    OPTIONAL_PM: "Optional PM",
    SUFFICIENT_MANDATORY: "Sufficient Mandatory",
  };
  const k = String(value || "").toUpperCase();
  return map[k] || String(value || "-").replace(/_/g, " ");
}

function formatRmStatusClass(value) {
  const map = {
    BLOCKING_SHORTAGE: "Blocking Shortage",
    OPTIONAL_RM: "Optional RM",
    JIT_NON_BLOCKING: "JIT Non-blocking",
    SUFFICIENT_STOCK_REQUIRED: "Sufficient Stock",
  };
  const k = String(value || "").toUpperCase();
  return map[k] || String(value || "-").replace(/_/g, " ");
}

function formatRmProcurementMode(value) {
  const v = String(value || "").toLowerCase();
  if (v === "jit_procured" || v === "jit") return "JIT";
  if (v === "stock_required") return "Stock Required";
  return String(value || "-").replace(/_/g, " ");
}

function groupStatusRows(rows) {
  const blocking = rows.filter((r) => r.is_blocking_line);
  const nonBlocking = rows.filter((r) => !r.is_blocking_line);
  return { blocking, nonBlocking };
}

// â”€â”€ Status chip renderers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _pmStatusChip(value) {
  const k = String(value || "").toUpperCase();
  const isBlocking =
    k === "LABEL_OR_OVERRIDE_BLOCKING" || k === "BLOCKING_SHORTAGE";
  const isOptional = k === "OPTIONAL_PM";
  const isSufficient = k === "SUFFICIENT_MANDATORY";
  const cls = isBlocking
    ? "blocking"
    : isOptional
      ? "optional"
      : isSufficient
        ? "sufficient"
        : "optional";
  const label = isBlocking
    ? "Blocking"
    : isOptional
      ? "Optional"
      : isSufficient
        ? "Sufficient"
        : formatPmStatusClass(value);
  return `<span class="peq-status-chip peq-status-chip--${cls}">${label}</span>`;
}

function _rmStatusChip(value) {
  const k = String(value || "").toUpperCase();
  const isBlocking = k === "BLOCKING_SHORTAGE";
  const isOptional = k === "OPTIONAL_RM";
  const isJit = k === "JIT_NON_BLOCKING";
  const isSufficient = k === "SUFFICIENT_STOCK_REQUIRED";
  const cls = isBlocking
    ? "blocking"
    : isOptional
      ? "optional"
      : isJit
        ? "jit"
        : isSufficient
          ? "sufficient"
          : "optional";
  const label = isBlocking
    ? "Blocking"
    : isOptional
      ? "Optional"
      : isJit
        ? "JIT"
        : isSufficient
          ? "Sufficient"
          : formatRmStatusClass(value);
  return `<span class="peq-status-chip peq-status-chip--${cls}">${label}</span>`;
}

// â”€â”€ Copy helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildPmStatusCopyText(rows, row) {
  const product = row.product_name || row.product_id || "";
  const batch = row.batch_number || "";
  const header = [
    "Product",
    "Batch",
    "PM Item",
    "Planned",
    "Issued",
    "Stock",
    "Shortage",
    "Status",
    "Class",
    "Reason",
  ].join("\t");
  const toRow = (r) =>
    [
      product,
      batch,
      r.pm_name || r.pm_stock_item_id || "",
      r.planned_pm_qty ?? "",
      r.issued_pm_qty ?? "",
      r.stock_qty ?? "",
      r.uncovered_qty != null && Number(r.uncovered_qty) !== 0
        ? r.uncovered_qty
        : "",
      r.is_blocking_line ? "BLOCKING" : "NON_BLOCKING",
      formatPmStatusClass(r.pm_status_class),
      r.pm_status_reason || "",
    ].join("\t");
  return [header, ...rows.map(toRow)].join("\n");
}

function buildRmStatusCopyText(rows, row) {
  const product = row.product_name || row.product_id || "";
  const batch = row.batch_number || "";
  const header = [
    "Product",
    "Batch",
    "RM Item",
    "Planned",
    "Issued",
    "Stock",
    "Shortage",
    "Mode",
    "Status",
    "Class",
    "Reason",
  ].join("\t");
  const toRow = (r) =>
    [
      product,
      batch,
      r.rm_name || r.rm_stock_item_id || "",
      r.planned_rm_qty ?? "",
      r.issued_rm_qty ?? "",
      r.stock_qty ?? "",
      r.uncovered_qty != null && Number(r.uncovered_qty) !== 0
        ? r.uncovered_qty
        : "",
      formatRmProcurementMode(r.rm_procurement_mode),
      r.is_blocking_line ? "BLOCKING" : "NON_BLOCKING",
      formatRmStatusClass(r.rm_status_class),
      r.rm_status_reason || "",
    ].join("\t");
  return [header, ...rows.map(toRow)].join("\n");
}

function copyStatusToClipboard(text, label) {
  if (!text) {
    showToast("No status lines to copy", "info");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => showToast(`${label} copied`, "success"),
    () => showToast("Copy failed \u2014 check browser permissions", "error"),
  );
}

function closeStatusCopyMenus() {
  if (_activeStatusMenu) {
    _activeStatusMenu.classList.remove("open");
    _activeStatusMenu = null;
  }
}

function buildPmStatusShareableText(rows, row) {
  const product = row.product_name || row.product_id || "";
  const batch = row.batch_number || "";
  const { blocking, nonBlocking } = groupStatusRows(rows);
  const fmtQty = (v) => (v != null ? String(v) : "-");
  const fmtShortage = (r) => {
    const v = r.uncovered_qty;
    return v != null && Number(v) !== 0 ? String(v) : null;
  };
  const pmLine = (r, i) => {
    const parts = [
      `${i + 1}. ${r.pm_name || r.pm_stock_item_id || "-"}`,
      `Planned: ${fmtQty(r.planned_pm_qty)}`,
      `Issued: ${fmtQty(r.issued_pm_qty)}`,
      `Stock: ${fmtQty(r.stock_qty)}`,
    ];
    const shortage = fmtShortage(r);
    if (shortage) parts.push(`Shortage: ${shortage}`);
    parts.push(`Class: ${formatPmStatusClass(r.pm_status_class)}`);
    return [parts.join(" | "), `   Reason: ${r.pm_status_reason || "-"}`].join(
      "\n",
    );
  };
  const lines = ["PM Status List", `Product: ${product} | Batch: ${batch}`];
  if (blocking.length) {
    lines.push("", "Blocking lines");
    blocking.forEach((r, i) => lines.push(pmLine(r, i)));
  }
  if (nonBlocking.length) {
    lines.push("", "Non-blocking dependencies");
    nonBlocking.forEach((r, i) => {
      const parts = [
        `${i + 1}. ${r.pm_name || r.pm_stock_item_id || "-"}`,
        `Planned: ${fmtQty(r.planned_pm_qty)}`,
        `Issued: ${fmtQty(r.issued_pm_qty)}`,
        `Stock: ${fmtQty(r.stock_qty)}`,
        `Class: ${formatPmStatusClass(r.pm_status_class)}`,
      ];
      lines.push(parts.join(" | "), `   Reason: ${r.pm_status_reason || "-"}`);
    });
  }
  return lines.join("\n").trimEnd();
}

function buildRmStatusShareableText(rows, row) {
  const product = row.product_name || row.product_id || "";
  const batch = row.batch_number || "";
  const { blocking, nonBlocking } = groupStatusRows(rows);
  const fmtQty = (v) => (v != null ? String(v) : "-");
  const fmtShortage = (r) => {
    const v = r.uncovered_qty;
    return v != null && Number(v) !== 0 ? String(v) : null;
  };
  const rmLine = (r, i) => {
    const parts = [
      `${i + 1}. ${r.rm_name || r.rm_stock_item_id || "-"}`,
      `Planned: ${fmtQty(r.planned_rm_qty)}`,
      `Issued: ${fmtQty(r.issued_rm_qty)}`,
      `Stock: ${fmtQty(r.stock_qty)}`,
    ];
    const shortage = fmtShortage(r);
    if (shortage) parts.push(`Shortage: ${shortage}`);
    parts.push(
      `Mode: ${formatRmProcurementMode(r.rm_procurement_mode)}`,
      `Class: ${formatRmStatusClass(r.rm_status_class)}`,
    );
    return [parts.join(" | "), `   Reason: ${r.rm_status_reason || "-"}`].join(
      "\n",
    );
  };
  const lines = ["RM Status List", `Product: ${product} | Batch: ${batch}`];
  if (blocking.length) {
    lines.push("", "Blocking lines");
    blocking.forEach((r, i) => lines.push(rmLine(r, i)));
  }
  if (nonBlocking.length) {
    lines.push("", "Non-blocking dependencies");
    nonBlocking.forEach((r, i) => {
      const parts = [
        `${i + 1}. ${r.rm_name || r.rm_stock_item_id || "-"}`,
        `Planned: ${fmtQty(r.planned_rm_qty)}`,
        `Issued: ${fmtQty(r.issued_rm_qty)}`,
        `Stock: ${fmtQty(r.stock_qty)}`,
        `Mode: ${formatRmProcurementMode(r.rm_procurement_mode)}`,
        `Class: ${formatRmStatusClass(r.rm_status_class)}`,
      ];
      lines.push(parts.join(" | "), `   Reason: ${r.rm_status_reason || "-"}`);
    });
  }
  return lines.join("\n").trimEnd();
}

// â”€â”€ Blocker renderers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const _th = (t, align = "left") =>
  `<th style="text-align:${align};padding:5px 8px;border-bottom:2px solid var(--border);font-size:11px;text-transform:uppercase;color:var(--muted,#6b7280);font-weight:600;white-space:nowrap">${t}</th>`;
const _td = (t, align = "left") =>
  `<td style="text-align:${align};padding:6px 8px;border-bottom:1px solid var(--border);font-size:12.5px">${t ?? "-"}</td>`;

function _pmStatusRow(r, muted = false) {
  const rowStyle = muted ? ' style="opacity:0.72"' : "";
  const shortage =
    r.uncovered_qty != null && !muted
      ? r.uncovered_qty
      : r.uncovered_qty != null && Number(r.uncovered_qty) !== 0
        ? r.uncovered_qty
        : "\u2014";
  return `<tr${rowStyle}>
    ${_td(r.pm_name || r.pm_stock_item_id)}
    ${_td(r.planned_pm_qty ?? "-", "right")}
    ${_td(r.issued_pm_qty ?? "-", "right")}
    ${_td(r.stock_qty ?? "-", "right")}
    ${_td(shortage, "right")}
    ${_td(_pmStatusChip(r.pm_status_class))}
    ${_td(r.pm_status_reason || "-")}
  </tr>`;
}

function renderPmBlockers(row, rows) {
  const _content = document.getElementById("drawerContent");
  if (!_content) return;
  const pmOk = isPmOk(row);
  const headerHtml = `
    <div class="peq-card" style="margin-bottom:14px">
      <div class="peq-card-title">PM Gate</div>
      <div class="peq-kv"><span class="peq-k">Decision</span><span class="peq-v">${formatStatusBadge(pmOk ? "PM OK" : "PM Blocked", pmOk ? "ok" : "block")}</span></div>
      <div class="peq-kv"><span class="peq-k">Status</span><span class="peq-v">${row.pm_gate_status || "-"}</span></div>
    </div>`;

  if (!rows.length) {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">No PM status lines available for this batch.</p>`;
    return;
  }

  const { blocking, nonBlocking } = groupStatusRows(rows);
  const total = rows.length;
  const colHeaders = `${_th("PM Item")}${_th("Planned", "right")}${_th("Issued", "right")}${_th("Stock", "right")}${_th("Shortage", "right")}${_th("Class")}${_th("Reason")}`;
  const infoBox = `<div style="margin-bottom:12px;padding:8px 12px;background:rgba(37,99,235,0.04);border-left:3px solid var(--erp-accent,#2563eb);border-radius:4px;font-size:12.5px;color:var(--erp-text,#374151)">PM status is evaluated after allocating shared PM stock to higher-priority batches first.</div>`;
  const tabActionsHtml = `
    <div class="peq-tab-actions">
      <span class="peq-tab-actions-summary">${total} line${total !== 1 ? "s" : ""} &mdash; ${blocking.length} blocking, ${nonBlocking.length} non-blocking</span>
      <div class="peq-copy-wrapper">
        <button id="peq-pm-copy-btn" class="peq-copy-icon-btn" type="button" title="Copy list" aria-label="Copy list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <div id="peq-pm-copy-menu" class="peq-copy-menu" role="menu">
          <button class="peq-copy-menu-item" data-action="shareable" type="button">Copy shareable</button>
          <button class="peq-copy-menu-item" data-action="tsv" type="button">Copy TSV</button>
        </div>
      </div>
    </div>`;

  let html = headerHtml + tabActionsHtml + infoBox;

  if (blocking.length) {
    html += `<div class="peq-status-section">
      <div class="peq-status-section-title peq-status-section-title--blocking">Blocking lines</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${colHeaders}</tr></thead>
          <tbody>${blocking.map((r) => _pmStatusRow(r, false)).join("")}</tbody>
        </table>
      </div>
    </div>`;
  }

  if (nonBlocking.length) {
    html += `<div class="peq-status-section">
      <div class="peq-status-section-title peq-status-section-title--nonblocking">Non-blocking dependencies</div>
      <p class="peq-status-note">These PM lines are visible for execution awareness but are not currently blocking this batch.</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${colHeaders}</tr></thead>
          <tbody>${nonBlocking.map((r) => _pmStatusRow(r, true)).join("")}</tbody>
        </table>
      </div>
    </div>`;
  }

  _content.innerHTML = html;

  const _pmBtn = _content.querySelector("#peq-pm-copy-btn");
  const _pmMenu = _content.querySelector("#peq-pm-copy-menu");
  _pmBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = _pmMenu?.classList.contains("open");
    closeStatusCopyMenus();
    if (!isOpen && _pmMenu) {
      _pmMenu.classList.add("open");
      _activeStatusMenu = _pmMenu;
      setTimeout(() => {
        document.addEventListener("click", closeStatusCopyMenus, {
          once: true,
        });
        document.addEventListener("keydown", function _esc(ev) {
          if (ev.key === "Escape") {
            closeStatusCopyMenus();
            document.removeEventListener("keydown", _esc);
          }
        });
      }, 0);
    }
  });
  _pmMenu
    ?.querySelector('[data-action="shareable"]')
    ?.addEventListener("click", () => {
      closeStatusCopyMenus();
      if (!rows.length) {
        showToast("No status lines to copy", "info");
        return;
      }
      copyStatusToClipboard(
        buildPmStatusShareableText(rows, row),
        "Shareable list",
      );
    });
  _pmMenu
    ?.querySelector('[data-action="tsv"]')
    ?.addEventListener("click", () => {
      closeStatusCopyMenus();
      if (!rows.length) {
        showToast("No status lines to copy", "info");
        return;
      }
      copyStatusToClipboard(buildPmStatusCopyText(rows, row), "TSV list");
    });
}

function _rmStatusRow(r, muted = false) {
  const rowStyle = muted ? ' style="opacity:0.72"' : "";
  const shortage =
    r.uncovered_qty != null && !muted
      ? r.uncovered_qty
      : r.uncovered_qty != null && Number(r.uncovered_qty) !== 0
        ? r.uncovered_qty
        : "\u2014";
  return `<tr${rowStyle}>
    ${_td(r.rm_name || r.rm_stock_item_id)}
    ${_td(r.planned_rm_qty ?? "-", "right")}
    ${_td(r.issued_rm_qty ?? "-", "right")}
    ${_td(r.stock_qty ?? "-", "right")}
    ${_td(shortage, "right")}
    ${_td(formatRmProcurementMode(r.rm_procurement_mode))}
    ${_td(_rmStatusChip(r.rm_status_class))}
    ${_td(r.rm_status_reason || "-")}
  </tr>`;
}

function renderRmBlockers(row, rows) {
  const _content = document.getElementById("drawerContent");
  if (!_content) return;
  const rmD = getRmDisplay(row);
  const rmTypeKey =
    rmD.cls === "rm-ok" ? "ok" : rmD.cls === "rm-block" ? "block" : "na";
  const headerHtml = `
    <div class="peq-card" style="margin-bottom:14px">
      <div class="peq-card-title">RM Gate</div>
      <div class="peq-kv"><span class="peq-k">Decision</span><span class="peq-v">${formatStatusBadge(rmD.text, rmTypeKey)}</span></div>
      <div class="peq-kv"><span class="peq-k">Status</span><span class="peq-v">${row.rm_gate_status_display || row.rm_gate_status || "-"}</span></div>
    </div>`;

  if (String(row.rm_gate_status_display || "") === "N/A") {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">RM is not an active execution gate at this stage.</p>`;
    return;
  }

  if (!rows.length) {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">No RM status lines available for this batch.</p>`;
    return;
  }

  const { blocking, nonBlocking } = groupStatusRows(rows);
  const total = rows.length;
  const colHeaders = `${_th("RM Item")}${_th("Planned", "right")}${_th("Issued", "right")}${_th("Stock", "right")}${_th("Shortage", "right")}${_th("Mode")}${_th("Class")}${_th("Reason")}`;
  const infoBox = `<div style="margin-bottom:12px;padding:8px 12px;background:rgba(37,99,235,0.04);border-left:3px solid var(--erp-accent,#2563eb);border-radius:4px;font-size:12.5px;color:var(--erp-text,#374151)">RM status is evaluated after allocating shared RM stock to higher-priority batches first.</div>`;
  const tabActionsHtml = `
    <div class="peq-tab-actions">
      <span class="peq-tab-actions-summary">${total} line${total !== 1 ? "s" : ""} &mdash; ${blocking.length} blocking, ${nonBlocking.length} non-blocking</span>
      <div class="peq-copy-wrapper">
        <button id="peq-rm-copy-btn" class="peq-copy-icon-btn" type="button" title="Copy list" aria-label="Copy list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <div id="peq-rm-copy-menu" class="peq-copy-menu" role="menu">
          <button class="peq-copy-menu-item" data-action="shareable" type="button">Copy shareable</button>
          <button class="peq-copy-menu-item" data-action="tsv" type="button">Copy TSV</button>
        </div>
      </div>
    </div>`;

  let html = headerHtml + tabActionsHtml + infoBox;

  if (blocking.length) {
    html += `<div class="peq-status-section">
      <div class="peq-status-section-title peq-status-section-title--blocking">Blocking lines</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${colHeaders}</tr></thead>
          <tbody>${blocking.map((r) => _rmStatusRow(r, false)).join("")}</tbody>
        </table>
      </div>
    </div>`;
  }

  if (nonBlocking.length) {
    html += `<div class="peq-status-section">
      <div class="peq-status-section-title peq-status-section-title--nonblocking">Non-blocking dependencies</div>
      <p class="peq-status-note">These RM lines are visible for execution awareness but are not currently blocking this batch.</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${colHeaders}</tr></thead>
          <tbody>${nonBlocking.map((r) => _rmStatusRow(r, true)).join("")}</tbody>
        </table>
      </div>
    </div>`;
  }

  _content.innerHTML = html;

  const _rmBtn = _content.querySelector("#peq-rm-copy-btn");
  const _rmMenu = _content.querySelector("#peq-rm-copy-menu");
  _rmBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = _rmMenu?.classList.contains("open");
    closeStatusCopyMenus();
    if (!isOpen && _rmMenu) {
      _rmMenu.classList.add("open");
      _activeStatusMenu = _rmMenu;
      setTimeout(() => {
        document.addEventListener("click", closeStatusCopyMenus, {
          once: true,
        });
        document.addEventListener("keydown", function _esc(ev) {
          if (ev.key === "Escape") {
            closeStatusCopyMenus();
            document.removeEventListener("keydown", _esc);
          }
        });
      }, 0);
    }
  });
  _rmMenu
    ?.querySelector('[data-action="shareable"]')
    ?.addEventListener("click", () => {
      closeStatusCopyMenus();
      if (!rows.length) {
        showToast("No status lines to copy", "info");
        return;
      }
      copyStatusToClipboard(
        buildRmStatusShareableText(rows, row),
        "Shareable list",
      );
    });
  _rmMenu
    ?.querySelector('[data-action="tsv"]')
    ?.addEventListener("click", () => {
      closeStatusCopyMenus();
      if (!rows.length) {
        showToast("No status lines to copy", "info");
        return;
      }
      copyStatusToClipboard(buildRmStatusCopyText(rows, row), "TSV list");
    });
}

function setDrawerTab(id) {
  const _tabsEl = document.getElementById("drawerTabs");
  const _content = document.getElementById("drawerContent");
  if (!_tabsEl || !_content) {
    console.error("[PEQ] setDrawerTab: elements not found", {
      tabs: !!_tabsEl,
      content: !!_content,
    });
    return;
  }
  Array.from(_tabsEl.querySelectorAll(".tab")).forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === id),
  );
  if (!SELECTED_ROW) {
    _content.innerHTML = "<p>Select a row to view details.</p>";
    return;
  }
  if (id === "details") {
    try {
      renderDetailPanel(SELECTED_ROW);
    } catch (err) {
      console.error("[PEQ] renderDetailPanel threw:", err);
      _content.innerHTML = `<p style="color:red;padding:8px">Error rendering details: ${err.message || err}</p>`;
    }
  } else if (id === "why") {
    renderImpactTab(SELECTED_ROW);
  } else if (id === "pm") {
    const _r = SELECTED_ROW;
    _content.innerHTML = `<p style="color:var(--muted,#6b7280);font-size:13px;padding:8px">Loading PM blockers…</p>`;
    loadPmBlockers(_r)
      .then((rows) => renderPmBlockers(_r, rows))
      .catch((err) => {
        console.error("[PEQ] loadPmBlockers error:", err);
        _content.innerHTML = `<p style="color:red;padding:8px">Error loading PM blockers: ${err.message || err}</p>`;
      });
  } else if (id === "rm") {
    const _r = SELECTED_ROW;
    _content.innerHTML = `<p style="color:var(--muted,#6b7280);font-size:13px;padding:8px">Loading RM blockers…</p>`;
    loadRmBlockers(_r)
      .then((rows) => renderRmBlockers(_r, rows))
      .catch((err) => {
        console.error("[PEQ] loadRmBlockers error:", err);
        _content.innerHTML = `<p style="color:red;padding:8px">Error loading RM blockers: ${err.message || err}</p>`;
      });
  }
}

function renderDetailPanel(row) {
  console.log("[PEQ] renderDetailPanel:", row?.batch_number, row?.product_name);
  const _content = document.getElementById("drawerContent");
  if (!row) throw new Error("renderDetailPanel called with no row");
  if (!_content) throw new Error("#drawerContent not found in DOM");

  const laneInfo = getLaneLabel(row);
  const rmD = getRmDisplay(row);
  const action = getRecommendedAction(row);
  const fgBtl = isFastConversion(row);
  const rmTypeKey =
    rmD.cls === "rm-ok" ? "ok" : rmD.cls === "rm-block" ? "block" : "na";
  const _pmBlocked = !isPmOk(row);
  const _rmBlocked = !fgBtl && !isRmClearForExecution(row);
  const execLogic =
    _pmBlocked && _rmBlocked
      ? "Packing material not sufficient after higher-priority reservation. Raw material not sufficient after higher-priority reservation."
      : _pmBlocked
        ? "Packing material not sufficient after higher-priority reservation."
        : _rmBlocked
          ? "Raw material not sufficient after higher-priority reservation."
          : "Reservation-aware execution gates are clear.";
  const hasBlocker = _pmBlocked || _rmBlocked;

  _content.innerHTML = `
    <div class="peq-summary-strip">
      ${makeSummaryCardHtml("State", row.primary_state || "-")}
      ${makeSummaryCardHtml("PM Status", formatStatusBadge(isPmOk(row) ? "PM OK" : "PM Blocked", isPmOk(row) ? "ok" : "block"))}
      ${makeSummaryCardHtml("RM Status", formatStatusBadge(rmD.text, rmTypeKey))}
      ${makeSummaryCardHtml("Risk Reduc.", String(row.total_risk_reduction_units ?? "-"))}
      ${makeSummaryCardHtml("Storage Qty", formatStorageQty(row))}
      ${makeSummaryCardHtml("Gate Logic", "Reservation-aware")}
    </div>
    <div class="peq-section-grid">
      <div class="peq-card">
        <div class="peq-card-title">Product Classification</div>
        <div class="peq-kv"><span class="peq-k">Category</span><span class="peq-v">${row.category_name || "—"}</span></div>
        <div class="peq-kv"><span class="peq-k">Sub-category</span><span class="peq-v">${row.subcategory_name || "—"}</span></div>
        <div class="peq-kv"><span class="peq-k">Group</span><span class="peq-v">${row.group_name || "—"}</span></div>
        <div class="peq-kv"><span class="peq-k">Sub-group</span><span class="peq-v">${row.sub_group_name || "—"}</span></div>
        ${row._classification_missing ? '<div class="peq-note" style="margin-top:6px;font-size:11px;color:var(--muted,#6b7280)">Classification not available in current client mapping.</div>' : ""}
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Batch Identity</div>
        <div class="peq-kv"><span class="peq-k">Product ID</span><span class="peq-v">${row.product_id ?? "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Item</span><span class="peq-v">${row.product_name || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Batch Number</span><span class="peq-v">${row.batch_number || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Primary State</span><span class="peq-v">${row.primary_state || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Queue Lane</span><span class="peq-v">${formatStatusBadge(laneInfo.text, laneInfo.type)}</span></div>
        <div class="peq-kv"><span class="peq-k">Priority Rank</span><span class="peq-v">${row.priority_rank_v4 ?? "-"}</span></div>
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Batch Quantity &amp; Storage</div>
        <div class="peq-kv"><span class="peq-k">Batch Size</span><span class="peq-v">${formatBatchSize(row)}</span></div>
        <div class="peq-kv"><span class="peq-k">Storage Qty</span><span class="peq-v">${formatStorageQty(row)}</span></div>
        <div class="peq-kv"><span class="peq-k">Candidate Supply Qty</span><span class="peq-v">${row.candidate_supply_base_qty ?? "-"}</span></div>
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Execution Gate Status</div>
        <div class="peq-kv"><span class="peq-k">PM Gate</span><span class="peq-v">${formatStatusBadge(isPmOk(row) ? "PM OK" : "PM Blocked", isPmOk(row) ? "ok" : "block")}</span></div>
        <div class="peq-kv"><span class="peq-k">PM Status</span><span class="peq-v">${row.pm_gate_status || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">RM Gate</span><span class="peq-v">${formatStatusBadge(rmD.text, rmTypeKey)}</span></div>
        <div class="peq-kv"><span class="peq-k">RM Status</span><span class="peq-v">${row.rm_gate_status_display || row.rm_gate_status || "-"}</span></div>
        ${fgBtl ? '<div class="peq-note">RM is not an active gate for FG_BULK / BOTTLED stages.</div>' : ""}
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Priority Signals</div>
        <div class="peq-kv"><span class="peq-k">Time Sensitivity</span><span class="peq-v">${row.time_sensitivity_score ?? "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Supply Continuity</span><span class="peq-v">${row.supply_continuity_score ?? "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Top Region</span><span class="peq-v">${row.top_region || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Top SKU</span><span class="peq-v">${row.top_sku_label || row.top_sku_id || "-"}</span></div>
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Execution Logic</div>
        <div style="font-size:13px;color:var(--erp-text,#0f172a);line-height:1.5">${execLogic}</div>
      </div>
      <div class="peq-action-card ${action.cls}">
        <div class="peq-action-label">Recommended Action</div>
        ${action.text}
        ${hasBlocker ? '<div class="peq-note" style="margin-top:8px;font-size:12px;color:var(--muted,#6b7280)">This decision is reservation-aware, not raw-stock-only.</div>' : ""}
      </div>
    </div>`;
  console.log("[PEQ] renderDetailPanel: done");
}

function renderImpactTab(row) {
  const _content = document.getElementById("drawerContent");
  if (!_content || !row) return;
  const thStyle = `text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:11px;text-transform:uppercase;color:var(--muted,#6b7280);font-weight:600`;
  const tdL = `padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted,#6b7280)`;
  const tdR = `padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px;font-weight:500;text-align:right`;
  _content.innerHTML = `
    <div class="peq-card" style="margin-bottom:14px">
      <div class="peq-card-title">Batch Impact Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="${thStyle}">Metric</th>
            <th style="${thStyle};text-align:right">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="${tdL}">Risk Reduction Units</td><td style="${tdR}">${row.total_risk_reduction_units ?? "-"}</td></tr>
          <tr><td style="${tdL}">Top Impacted Region</td><td style="${tdR}">${row.top_region || "-"}</td></tr>
          <tr><td style="${tdL}">Top Impacted SKU</td><td style="${tdR}">${row.top_sku_label || row.top_sku_id || "-"}</td></tr>
          <tr><td style="${tdL}">Time Sensitivity Score</td><td style="${tdR}">${row.time_sensitivity_score ?? "-"}</td></tr>
          <tr><td style="${tdL}" style="border-bottom:none">Supply Continuity Score</td><td style="${tdR};border-bottom:none">${row.supply_continuity_score ?? "-"}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="peq-card-title" style="margin-bottom:8px">Risk Breakdown by Region &amp; SKU</div>
    <div id="whyRiskTable"><p style="color:var(--muted,#6b7280);font-size:13px">Loading risk breakdown…</p></div>`;
  loadWhyMatters(row);
}

async function loadWhyMatters(row) {
  const _target =
    document.getElementById("whyRiskTable") ||
    document.getElementById("drawerContent");
  try {
    const key = { column: "batch_number", value: row.batch_number };
    if (!key.value) {
      if (_target) _target.innerHTML = "<p>No batch identifier available.</p>";
      return;
    }
    const { data, error } = await supabase
      .from("v_batch_risk_reduction_current_month")
      .select(
        "sku_id, sku_label, region_code, risk_reduction_units, risk_reduction_base_qty",
      )
      .eq(key.column, key.value)
      .limit(100);
    if (error) throw error;
    if (!data || !data.length) {
      if (_target)
        _target.innerHTML =
          '<p style="color:var(--muted)">No risk-reduction info available for this batch.</p>';
      return;
    }
    const rows = data.map((d) => ({
      region: d.region_code || "-",
      sku: d.sku_label || d.sku_id || "-",
      units: Number(d.risk_reduction_units ?? 0),
    }));
    rows.sort((a, b) => b.units - a.units);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.innerHTML = `<thead><tr>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border)">Region</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border)">SKU</th>
      <th style="text-align:right;padding:6px 8px;border-bottom:2px solid var(--border)">Risk Reduction Units</th>
    </tr></thead>`;
    const tb = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td style="padding:6px 8px;border-bottom:1px solid var(--border)">${r.region}</td><td style="padding:6px 8px;border-bottom:1px solid var(--border)">${r.sku}</td><td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:right">${r.units}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    if (_target) {
      _target.innerHTML = "";
      _target.appendChild(table);
    }
  } catch (e) {
    console.error(e);
    if (_target)
      _target.innerHTML = `<p style="color:red">Error loading details: ${e.message || e}</p>`;
  }
}

function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("peqToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `peq-toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  }, duration);
}

function copyReadyList() {
  const now = new Date();
  const dateStr = now
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
  const lines = [`*READY TO EXECUTE (AS ON ${dateStr})*`, ""];
  (CURRENT_ROWS.length ? CURRENT_ROWS : LAST_PAGE_ROWS).forEach((r) => {
    const storage = formatStorageQty(r);
    lines.push(
      `${r.priority_rank_v4} ${r.product_name || r.product_id} - ${r.batch_number} - ${r.primary_state} - ${storage}`,
    );
  });
  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => {
      showToast("List copied to clipboard", "success");
    })
    .catch((err) => {
      console.error("Copy to clipboard failed:", err);
      showToast("Copy failed — check browser permissions", "error");
    });
}

function exportCsvForRows(rows, pageNumber) {
  if (!Array.isArray(rows)) rows = [];
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ts = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `production_execution_queue_${ym}_page${pageNumber}_${ts}.csv`;
  const headers = [
    "priority_rank_v4",
    "product_id",
    "product_name",
    "category_name",
    "subcategory_name",
    "group_name",
    "sub_group_name",
    "batch_number",
    "primary_state",
    "batch_size_declared",
    "batch_uom",
    "fg_bulk_on_hand_base_qty",
    "bottled_on_hand_units",
    "bottled_on_hand_base_qty",
    "candidate_supply_base_qty",
    "queue_lane",
    "pm_gate_status",
    "rm_gate_status",
    "rm_gate_status_display",
    "is_rm_ok_for_stage",
    "total_risk_reduction_units",
    "top_region",
    "top_sku_id",
    "top_sku_label",
    "time_sensitivity_score",
    "supply_continuity_score",
  ];
  const csv = [headers.join(",")];
  rows.forEach((r) => {
    const vals = headers.map((h) => {
      const v = r[h];
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      if (s.search(/[",\n]/) >= 0) return `"${s}"`;
      return s;
    });
    csv.push(vals.join(","));
  });
  const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("CSV exported", "info");
}

async function loadQueue() {
  setStatus("Loading snapshot...");
  try {
    if (PRODUCT_DETAILS_MAP.size === 0) {
      console.warn(
        "[PEQ] loadQueue: PRODUCT_DETAILS_MAP is empty — loading product details now",
      );
      await loadProductDetails();
    }
    if (PRODUCT_DETAILS_MAP.size < 1200) {
      console.warn(
        "[PEQ] product detail map looks smaller than expected:",
        PRODUCT_DETAILS_MAP.size,
      );
    }
    // build month start as YYYY-MM-01 (avoid timezone issues)
    const now = new Date();
    const monthStart =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-01";

    const cols = [
      "month_start",
      "product_id",
      "product_name",
      "batch_size_declared",
      "batch_uom",
      "fg_bulk_on_hand_base_qty",
      "bottled_on_hand_units",
      "bottled_on_hand_base_qty",
      "batch_number",
      "primary_state",
      "pm_gate_status",
      "rm_gate_status",
      "rm_gate_status_display",
      "is_pm_ok",
      "is_pm_blocked",
      "is_rm_ok_for_stage",
      "candidate_supply_base_qty",
      "top_region",
      "top_sku_id",
      "top_sku_label",
      "total_risk_reduction_units",
      "stage_rank",
      "queue_lane",
      "priority_rank_v4",
      "time_sensitivity_score",
      "supply_continuity_score",
    ].join(",");

    const { data, error } = await supabase
      .from("priority_queue_snapshot_current_month")
      .select(cols)
      .eq("month_start", monthStart)
      .order("priority_rank_v4", { ascending: true })
      .limit(1000);

    if (error) {
      console.error(
        "Snapshot load error",
        error,
        error?.message || error?.details || "",
      );
      setStatus("Failed to load snapshot.", "error");
      return;
    }

    QUEUE = (data || []).map(enrichRowWithClassification);
    logMissingClassificationSummary(QUEUE);
    console.debug("PEQ rows loaded:", QUEUE.length, QUEUE.slice(0, 5));
    if (!QUEUE.length) {
      setStatus("Snapshot not yet generated. Click Refresh.");
      tableBody.innerHTML = "";
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      renderLensPills();
      applyLensFilter();
      return;
    }

    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();
    renderLensPills();
    _populateClassificationFilters();
    console.debug("DOM check", {
      tableWrap: !!tableWrap,
      tableBody: !!tableBody,
      statusArea: !!statusArea,
      paginationInfo: !!document.getElementById("paginationInfo"),
      pageSize: !!document.getElementById("pageSize"),
      prevPage: !!document.getElementById("prevPage"),
      nextPage: !!document.getElementById("nextPage"),
      exportCsv: !!document.getElementById("exportCsv"),
    });
    applyLensFilter();
    return;
  } catch (e) {
    console.error("Load snapshot failed", e);
    setStatus("Failed to load snapshot.", "error");
  }
}

/* ---------------- Boot ---------------- */
(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "/login.html");
    await loadPermissions(session.user.id);
    if (!PERM_CAN_VIEW) {
      // friendly access denied
      statusArea.innerHTML = "You do not have permission to view this module.";
      statusArea.style.display = "block";
      return;
    }
    // wire UI
    _wireFilterDrawer();
    refreshBtn.addEventListener("click", refreshSnapshotAndReload);
    searchBox.addEventListener(
      "input",
      debounce(() => {
        CURRENT_PAGE = 1;
        applySearch();
      }, 200),
    );
    // show/hide clear button immediately when user types
    if (searchClear) {
      searchClear.style.display = searchBox.value ? "" : "none";
      searchBox.addEventListener("input", () => {
        try {
          searchClear.style.display = searchBox.value ? "" : "none";
        } catch {
          /* ignore */
        }
      });
      searchClear.addEventListener("click", () => {
        try {
          searchBox.value = "";
          searchClear.style.display = "none";
          CURRENT_PAGE = 1;
          applySearch();
          searchBox.focus();
        } catch (e) {
          console.warn("searchClear click failed", e);
        }
      });
    }
    drawerClose.addEventListener("click", closeDetails);
    drawerTabs.addEventListener("click", (ev) => {
      const t = ev.target.closest(".tab");
      if (t) setDrawerTab(t.dataset.tab);
    });
    // Pagination & export controls — registered once to avoid duplicate listeners on refresh
    const pageSizeEl = document.getElementById("pageSize");
    if (pageSizeEl) {
      try {
        pageSizeEl.value = String(PAGE_SIZE);
        pageSizeEl.addEventListener("change", () => {
          PAGE_SIZE = Number(pageSizeEl.value) || 25;
          CURRENT_PAGE = 1;
          applySearch();
        });
      } catch (e) {
        console.warn("pageSize element wiring failed", e);
      }
    }
    document.getElementById("prevPage").addEventListener("click", () => {
      if (CURRENT_PAGE > 1) {
        CURRENT_PAGE -= 1;
        applySearch();
      }
    });
    document.getElementById("nextPage").addEventListener("click", () => {
      CURRENT_PAGE += 1;
      applySearch();
    });
    document.getElementById("exportCsv").addEventListener("click", () => {
      exportCsvForRows(LAST_PAGE_ROWS, CURRENT_PAGE);
    });
    const _copyReadyBtn = document.getElementById("copyReadyBtn");
    if (_copyReadyBtn) {
      _copyReadyBtn.addEventListener("click", copyReadyList);
      _copyReadyBtn.style.display = CURRENT_LENS === "ready" ? "" : "none";
    }
    renderLensPills();
    // Home button
    const _homeBtn = document.getElementById("homeBtn");
    _homeBtn && _homeBtn.addEventListener("click", () => Platform.goHome());
    // Small-screen lens select: keep behavior consistent with pills
    if (lensSelect) {
      // sync initial value
      lensSelect.value = CURRENT_LENS;
      lensSelect.addEventListener("change", () => {
        const val = lensSelect.value;
        if (val) {
          CURRENT_LENS = val;
          renderLensPills();
          applyLensFilter();
        }
      });

      function syncLensSelectVisibility() {
        try {
          if (window.innerWidth <= 520) lensSelect.style.display = "block";
          else lensSelect.style.display = "none";
        } catch {
          /* ignore */
        }
      }
      syncLensSelectVisibility();
      window.addEventListener(
        "resize",
        debounce(() => {
          syncLensSelectVisibility();
        }, 120),
      );
    }
    // Freshness indicator — click to expand/collapse detail, matching stock-checker
    if (lastRefreshed) {
      const margin = 8;
      const MIN_WIDTH = 160;
      const PREFERRED_MIN = 180;
      const MAX_WIDTH = 420;
      function hideFreshnessDetail(detail) {
        try {
          if (!detail) return;
          detail.style.display = "none";
          detail.style.position = "";
          detail.style.left = "";
          detail.style.top = "";
          detail.style.width = "";
          detail.style.maxWidth = "";
          detail.style.boxSizing = "";
          detail.style.zIndex = "";
        } catch {
          void 0;
        }
      }
      function positionFreshnessDetail(detail) {
        try {
          if (!detail || !lastRefreshed) return;
          if (detail.parentElement !== document.body)
            document.body.appendChild(detail);
          detail.style.display = "block";
          detail.style.position = "absolute";
          detail.style.boxSizing = "border-box";
          detail.style.zIndex = 9999;
          const rect = lastRefreshed.getBoundingClientRect();
          const vw = Math.max(
            document.documentElement.clientWidth || 0,
            window.innerWidth || 0,
          );
          const scrollX = window.scrollX || window.pageXOffset || 0;
          const scrollY = window.scrollY || window.pageYOffset || 0;
          const availableRight = Math.max(0, vw - rect.right - margin);
          const availableLeft = Math.max(0, rect.left - margin);
          let side = "right";
          if (availableRight < PREFERRED_MIN && availableLeft >= PREFERRED_MIN)
            side = "left";
          else if (availableRight < MIN_WIDTH && availableLeft >= MIN_WIDTH)
            side = "left";
          else if (availableRight < MIN_WIDTH && availableLeft < MIN_WIDTH)
            side = availableLeft > availableRight ? "left" : "right";
          const avail = side === "right" ? availableRight : availableLeft;
          detail.style.width = "auto";
          const natural = Math.ceil(
            Math.max(
              detail.scrollWidth || 0,
              detail.getBoundingClientRect().width || 0,
            ),
          );
          const cap = Math.min(MAX_WIDTH, vw - margin * 2);
          let width;
          if (natural && natural <= cap && (!avail || natural <= avail)) {
            width = natural;
          } else {
            width = Math.min(
              cap,
              Math.max(PREFERRED_MIN, avail || PREFERRED_MIN),
            );
            if (avail && avail < PREFERRED_MIN)
              width = Math.max(MIN_WIDTH, avail);
            width = Math.min(width, cap);
          }
          let left;
          if (side === "right") {
            left = rect.left + scrollX;
            if (left + width > vw + scrollX - margin)
              left = vw + scrollX - width - margin;
            if (left < margin + scrollX) left = margin + scrollX;
          } else {
            left = rect.right + scrollX - width;
            if (left < margin + scrollX) left = margin + scrollX;
            if (left + width > vw + scrollX - margin)
              left = vw + scrollX - width - margin;
          }
          detail.style.left = left + "px";
          detail.style.top = rect.bottom + scrollY + 6 + "px";
          detail.style.width = width + "px";
          detail.style.maxWidth = Math.min(MAX_WIDTH, vw - margin * 2) + "px";
        } catch {
          try {
            detail.style.position = "";
            detail.style.display = "block";
          } catch {
            void 0;
          }
        }
      }
      lastRefreshed.addEventListener("click", (ev) => {
        try {
          ev.preventDefault();
          const expanded = lastRefreshed.classList.toggle("sc-status-expanded");
          lastRefreshed.setAttribute("aria-expanded", String(expanded));
          const detail = document.getElementById("sc-status-detail");
          if (!detail) return;
          if (expanded) positionFreshnessDetail(detail);
          else hideFreshnessDetail(detail);
        } catch {
          void 0;
        }
      });
      lastRefreshed.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          lastRefreshed.click();
        }
      });
      document.addEventListener("click", (ev) => {
        try {
          if (!lastRefreshed) return;
          const detail = document.getElementById("sc-status-detail");
          if (lastRefreshed.contains(ev.target)) return;
          if (detail && detail.contains(ev.target)) return;
          if (lastRefreshed.classList.contains("sc-status-expanded")) {
            lastRefreshed.classList.remove("sc-status-expanded");
            lastRefreshed.setAttribute("aria-expanded", "false");
            if (detail) hideFreshnessDetail(detail);
          }
        } catch {
          void 0;
        }
      });
      const _reposFreshness = debounce(() => {
        try {
          const detail = document.getElementById("sc-status-detail");
          if (detail && lastRefreshed.classList.contains("sc-status-expanded"))
            positionFreshnessDetail(detail);
        } catch {
          void 0;
        }
      }, 120);
      window.addEventListener("resize", _reposFreshness);
      window.addEventListener("scroll", _reposFreshness, { passive: true });
    }
    setInterval(updateFreshnessIndicator, 60000);
    await loadProductDetails();
    await loadQueue();
  } catch (e) {
    console.error(e);
    setStatus("Initialization error. See console.");
  }
})();

const _overlayEl = document.getElementById("detailsModal");
if (_overlayEl) {
  _overlayEl.addEventListener("click", (e) => {
    if (e.target === _overlayEl) closeDetails();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const _modal = document.getElementById("detailsModal");
    if (_modal && !_modal.classList.contains("hidden")) closeDetails();
  }
});

function debounce(fn, wait) {
  let t = null;
  return function (...a) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, a), wait);
  };
}

export {
  loadQueue,
  applyLensFilter,
  renderSummaryStrip,
  renderTable,
  openDetails,
  loadWhyMatters,
  reEnrichQueueRows,
};
