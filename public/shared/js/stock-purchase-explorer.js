// js/stock-purchase-explorer.js
/* eslint-env browser */
import { supabase, handleSupabaseError } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { mountModuleHome, mountModuleIcon } from "./sasv-module-chrome.js";
import { iconHtml } from "./ui-icons.js";

// State management
// JS SNIPPET 1: extended state with canonical classification filters
const state = {
  currentTab: "overview",
  // Tally-origin classification (RM / PLM / consumable / fuel)
  currentSourceKind: "all",
  // Canonical classification (from inv_class_* tables)
  currentCategoryCode: "all",
  currentSubcategoryCode: "all",
  currentGroupCode: "all",
  currentSubgroupCode: "all",

  currentSearchText: "",
  currentFromDate: "",
  currentToDate: "",

  selectedItemId: null,
  // pagination state
  pageOverview: 1,
  pageStock: 1,
  pagePurchase: 1,
  // NEW: consumption tab paging
  pageConsumption: 1,
  // NEW: rm-receiving-stock tab paging
  pageRmReceivingStock: 1,
  pageSize: 30, // batch size for infinite scroll
  hasMore: false,
  loadingMore: false,
  knownTotal: 0,
};

// DOM references
const homeBtn = document.getElementById("homeBtn");
const stockValueChip = document.getElementById("stockValueChip");
const stockValueAmount = document.getElementById("stockValueAmount");
const stockValueModal = document.getElementById("stockValueModal");
const stockValueModalClose = document.getElementById("stockValueModalClose");
const stockValueModalBody = document.getElementById("stockValueModalBody");
// JS SNIPPET 2: DOM references including new classification filters
const classificationSelect = document.getElementById("classification"); // Tally source kind
const categoryFilter = document.getElementById("categoryFilter");
const subcategoryFilter = document.getElementById("subcategoryFilter");
const groupFilter = document.getElementById("groupFilter");
const subgroupFilter = document.getElementById("subgroupFilter");

const searchInput = document.getElementById("search");
const dateRangeInput = document.getElementById("dateRange");
const filtersBtn = document.getElementById("filtersBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabSelect = document.getElementById("tabSelect");
const tableArea = document.getElementById("tableArea");
const tableContextMeta = document.getElementById("tableContextMeta");
const tableCard = document.querySelector(".table-card");
const speCardsWrap = document.getElementById("spe-cards-wrap");
const speCardsList = document.getElementById("spe-cards-list");
const sidePanel = document.getElementById("sidePanel"); // preserved but hidden; modal used instead
const modalOverlay = document.getElementById("detailModal");
const modalContent = document.getElementById("modalContent");
const modalClose = document.querySelector(".modal-close");
let _lastActiveElement = null;

// Taxonomy caches (populated from inv_class_* tables)
let cacheCat = [];
let cacheSub = [];
let cacheGrp = [];
let cacheSGrp = [];

// Monotonically increasing counter for stale-result guard in reloadActiveTab
let _requestSeq = 0;
let LAST_ACTIVE_ROWS = [];
let LAST_RM_RECEIVING_ROWS = [];
// reference to avoid 'assigned but never used' warnings in some linters
void LAST_RM_RECEIVING_ROWS;
let LAST_RM_RECEIVING_TOTAL = 0;
let LAST_RM_RECEIVING_AS_OF_DATE = null;
let LAST_RM_RECEIVING_INSERTED_AT = null;
let STOCK_VALUE_SUMMARY = [];
let STOCK_VALUE_TOTAL = null;

// Pagination helpers: reset pages when filters change
function resetPages() {
  state.pageOverview = 1;
  state.pageStock = 1;
  state.pagePurchase = 1;
  state.pageConsumption = 1;
  state.pageRmReceivingStock = 1;
}

// Track if user manually changed page-size (don't override their choice)
// (Removed dynamic height/page-size auto-computation — table will use flex layout and internal scrolling)

// Initialize select placeholders so UI shows loading state until taxonomy is populated
if (categoryFilter) {
  categoryFilter.innerHTML = '<option value="all">Loading…</option>';
  categoryFilter.disabled = true;
}
if (subcategoryFilter) {
  subcategoryFilter.innerHTML = '<option value="all">(All)</option>';
  subcategoryFilter.disabled = true;
}
// Status toast helper (ERP-style stacked toasts)
function showStatusToast(msg, type = "info", timeout = 3000) {
  const container = document.getElementById("statusToastContainer");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast " + (type || "info");
  t.textContent = msg;
  container.appendChild(t);

  // entrance animation
  t.style.opacity = "0";
  t.style.transform = "translateY(6px)";
  requestAnimationFrame(() => {
    t.style.transition = "opacity .22s ease, transform .22s ease";
    t.style.opacity = "1";
    t.style.transform = "translateY(0)";
  });

  // auto-remove after timeout
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    setTimeout(() => {
      try {
        container.removeChild(t);
      } catch {
        /* ignore */
      }
    }, 240);
  }, timeout);
}

function updateTableContextMeta(text) {
  if (!tableContextMeta) return;
  tableContextMeta.textContent = text || "";
  tableContextMeta.style.display = text ? "inline-flex" : "none";
  syncTableHeaderBarVisibility();
}

function syncTableHeaderBarVisibility() {
  const bar = document.getElementById("tableHeaderBar");
  if (!bar) return;
  const actions = document.getElementById("tableHeaderActions");
  const hasMeta = !!(
    tableContextMeta &&
    tableContextMeta.textContent &&
    tableContextMeta.style.display !== "none"
  );
  const hasActions = !!(actions && actions.childElementCount > 0);
  bar.classList.toggle("spe-header-empty", !(hasMeta || hasActions));
}

function setHasMoreFromBatch(batchLen, totalCount, loadedLen) {
  const known = Number(totalCount) || 0;
  state.knownTotal = known;
  if (known > 0) {
    state.hasMore = loadedLen < known;
  } else {
    state.hasMore = batchLen >= state.pageSize;
  }
}

function isNarrowViewport() {
  return window.matchMedia("(max-width: 520px)").matches;
}

function getResultsPresentationMode() {
  return isNarrowViewport() ? "cards" : "table";
}

function applyResultsPresentationMode() {
  if (!tableCard) return;
  const mode = getResultsPresentationMode();
  tableCard.classList.toggle("spe-view-cards", mode === "cards");
  tableCard.classList.toggle("spe-view-table", mode === "table");
  if (speCardsWrap) speCardsWrap.hidden = mode !== "cards";
}

function ensureScrollSentinel() {
  if (!tableArea) return null;
  let el = document.getElementById("speScrollSentinel");
  if (!el) {
    el = document.createElement("div");
    el.id = "speScrollSentinel";
    el.className = "spe-scroll-sentinel";
    el.setAttribute("aria-live", "polite");
    tableArea.appendChild(el);
  } else if (el.parentNode !== tableArea) {
    tableArea.appendChild(el);
  }
  return el;
}

function sentinelLabel(text) {
  if (typeof text === "string") return text;
  if (state.loadingMore) return "Loading more…";
  if (state.hasMore) return "";
  if ((LAST_ACTIVE_ROWS || []).length)
    return state.knownTotal
      ? `${LAST_ACTIVE_ROWS.length} of ${state.knownTotal}`
      : "End of results";
  return "";
}

function updateScrollSentinel(text) {
  const label = sentinelLabel(text);
  const tableEl = ensureScrollSentinel();
  if (tableEl) tableEl.textContent = label;
  const cardsEl = document.getElementById("speCardsSentinel");
  if (cardsEl) cardsEl.textContent = label;
}

function selectResultCard(card) {
  if (!speCardsList) return;
  speCardsList.querySelectorAll(".spe-result-card.selected").forEach((el) => {
    el.classList.remove("selected");
  });
  if (card) card.classList.add("selected");
}

function selectTableRow(tr) {
  if (!tableArea) return;
  tableArea.querySelectorAll("tr.selected").forEach((el) => {
    el.classList.remove("selected");
  });
  if (tr) tr.classList.add("selected");
}

function syncRowSelection(id) {
  if (!id) return;
  const tr = tableArea
    ? tableArea.querySelector(`tr[data-id="${id}"]`)
    : null;
  selectTableRow(tr);
  const card = speCardsList
    ? speCardsList.querySelector(`.spe-result-card[data-id="${id}"]`)
    : null;
  selectResultCard(card);
}

function getTabPage(tab) {
  if (tab === "overview") return state.pageOverview;
  if (tab === "stock") return state.pageStock;
  if (tab === "purchase") return state.pagePurchase;
  if (tab === "consumption") return state.pageConsumption;
  if (tab === "rm-receiving-stock") return state.pageRmReceivingStock;
  return 1;
}

function setTabPage(tab, page) {
  if (tab === "overview") state.pageOverview = page;
  else if (tab === "stock") state.pageStock = page;
  else if (tab === "purchase") state.pagePurchase = page;
  else if (tab === "consumption") state.pageConsumption = page;
  else if (tab === "rm-receiving-stock") state.pageRmReceivingStock = page;
}

// ── Stock Value chip & modal ──────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadStockValueSummary() {
  const { data, error } = await supabase.rpc(
    "fn_stock_purchase_value_summary",
    {
      p_source_kind: state.currentSourceKind || "all",
      p_search: state.currentSearchText || null,
      p_category_code: state.currentCategoryCode || "all",
      p_subcategory_code: state.currentSubcategoryCode || "all",
      p_group_code: state.currentGroupCode || "all",
      p_subgroup_code: state.currentSubgroupCode || "all",
    },
  );
  if (error) {
    console.error("Stock value summary RPC failed:", error);
    return { data: [], error: handleSupabaseError(error) };
  }
  return { data: data || [], error: null };
}

async function refreshStockValueChip() {
  if (!stockValueChip || !stockValueAmount) return;

  stockValueAmount.textContent = "…";

  const res = await loadStockValueSummary();

  if (res.error) {
    stockValueAmount.textContent = "—";
    stockValueChip.setAttribute("title", "Stock value unavailable");
    stockValueChip.setAttribute("aria-label", "Stock value unavailable");
    return;
  }

  STOCK_VALUE_SUMMARY = res.data || [];
  STOCK_VALUE_TOTAL =
    STOCK_VALUE_SUMMARY.find((r) => r.row_type === "total") || null;

  const totalValue = STOCK_VALUE_TOTAL?.stock_value ?? null;
  const formattedHtml = formatCurrencyINR(totalValue);
  const formattedPlain = stripHtmlTags(formattedHtml);

  stockValueAmount.innerHTML = formattedHtml;

  const titleText = `Total Inventory Stock Value: ${formattedPlain}`;
  stockValueChip.setAttribute("title", titleText);
  stockValueChip.setAttribute("aria-label", titleText);
}

function openStockValueModal() {
  if (!stockValueModal || !stockValueModalBody) return;
  const SECTION_ORDER = [
    "rm_ready_to_use",
    "rm_receiving",
    "plm",
    "consumable",
    "fuel",
  ];
  const splitRows = STOCK_VALUE_SUMMARY.filter((r) => r.row_type === "split");
  // Sort by preferred section order, then alphabetically for unknown keys
  splitRows.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.section_key);
    const bi = SECTION_ORDER.indexOf(b.section_key);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return (a.section_label || "").localeCompare(b.section_label || "");
  });

  let html = "";
  if (!splitRows.length && STOCK_VALUE_TOTAL === null) {
    html =
      '<div class="no-data" style="padding:12px 0;color:#64748b;font-size:12.5px">No data available</div>';
  } else {
    // Split rows
    for (const row of splitRows) {
      const itemLabel =
        row.item_count != null
          ? `${row.item_count} item${row.item_count !== 1 ? "s" : ""}`
          : "";
      html += `<div class="stock-value-row">
        <div>
          <div class="stock-value-row-label">${escapeHtml(row.section_label || row.section_key)}</div>
          ${itemLabel ? `<div class="stock-value-row-meta">${escapeHtml(itemLabel)}</div>` : ""}
        </div>
        <div class="stock-value-row-amount">${formatCurrencyINR(row.stock_value ?? 0)}</div>
      </div>`;
    }
    // Total row
    if (STOCK_VALUE_TOTAL !== null) {
      html += `<div class="stock-value-row stock-value-row-total">
        <div class="stock-value-row-label">Total</div>
        <div class="stock-value-row-amount">${formatCurrencyINR(STOCK_VALUE_TOTAL?.stock_value ?? 0)}</div>
      </div>`;
    }
  }
  stockValueModalBody.innerHTML = html;
  stockValueModal.classList.add("open");
  stockValueModal.setAttribute("aria-hidden", "false");
  if (stockValueModalClose) stockValueModalClose.focus();
}

function closeStockValueModal() {
  if (!stockValueModal) return;
  stockValueModal.classList.remove("open");
  stockValueModal.setAttribute("aria-hidden", "true");
  if (stockValueChip) stockValueChip.focus();
}

// ── end Stock Value chip & modal ──────────────────────────────────────────────

// thin wrapper for the previous API
function showAutoSelectHint() {
  showStatusToast("Category auto-selected from Source Kind", "info", 3000);
}

// Date picker setup

// Ensure flatpickr and confirmDatePlugin are available from window (as loaded via <script> in HTML)
const fp = window.flatpickr;
const confirmPlugin = window.confirmDatePlugin;
// use a single compact range picker for dates
if (dateRangeInput) {
  fp(dateRangeInput, {
    mode: "range",
    dateFormat: "d-m-Y",
    allowInput: true,
    clickOpens: true,
    plugins: [confirmPlugin({ showTodayButton: true, showClearButton: true })],
    onChange: function (selectedDates, dateStr, instance) {
      if (!isDateRangeRelevant(state.currentTab)) return;
      // selectedDates may contain 0,1 or 2 dates
      if (!selectedDates || !selectedDates.length) {
        state.currentFromDate = "";
        state.currentToDate = "";
      } else if (selectedDates.length === 1) {
        state.currentFromDate = instance.formatDate(selectedDates[0], "d-m-Y");
        state.currentToDate = "";
      } else {
        state.currentFromDate = instance.formatDate(selectedDates[0], "d-m-Y");
        state.currentToDate = instance.formatDate(selectedDates[1], "d-m-Y");
      }
      updateFiltersBtnActive();
      resetPages();
      reloadActiveTab();
    },
  });
  syncDateRangeAvailability();
}

// Event listeners
if (homeBtn) {
  mountModuleHome(homeBtn);
  homeBtn.onclick = () => Platform.goHome();
}

/* Presentation: canonical close / filter icons (ui-icons) */
{
  if (filtersBtn) {
    mountModuleIcon(filtersBtn, "filter");
    filtersBtn.setAttribute("aria-label", "Filters");
    filtersBtn.setAttribute("title", "Filters");
  }
  const detailClose = document.querySelector("#detailModal .modal-close");
  if (detailClose) mountModuleIcon(detailClose, "close");
  if (stockValueModalClose) mountModuleIcon(stockValueModalClose, "close");
}

// Stock value chip events
if (stockValueChip) {
  stockValueChip.addEventListener("click", async () => {
    if (stockValueModal && stockValueModal.classList.contains("open")) {
      closeStockValueModal();
      return;
    }
    if (!STOCK_VALUE_SUMMARY.length) {
      await refreshStockValueChip();
    }
    openStockValueModal();
  });
}
if (stockValueModalClose) {
  stockValueModalClose.addEventListener("click", closeStockValueModal);
}
if (stockValueModal) {
  stockValueModal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close-stock-value-modal")) {
      closeStockValueModal();
    }
  });
}
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    stockValueModal &&
    stockValueModal.classList.contains("open")
  ) {
    closeStockValueModal();
  }
});
// JS SNIPPET 3: filter listeners (source kind + canonical classification)
// Map Source Kind to canonical category codes and auto-select category
function mapSourceKindToCategoryCode(kind) {
  if (!kind) return null;
  const k = String(kind).toLowerCase();
  const map = {
    rm: "RM",
    plm: "PLM",
    consumable: "IND",
    fuel: "IND",
  };
  return map[k] || null;
}

if (classificationSelect) classificationSelect.addEventListener("change", async () => {
  state.currentSourceKind = classificationSelect.value;
  // If user selected 'all', restore category and downstream selects to defaults
  if (state.currentSourceKind === "all" && categoryFilter) {
    // ensure taxonomy options are loaded so category select has correct '(All)'
    try {
      if (!cacheCat || !cacheCat.length) await loadClassificationOptions();
    } catch {
      /* ignore load errors */
    }
    categoryFilter.value = "all";
    state.currentCategoryCode = "all";
    fillEmptySelect(subcategoryFilter, "(All sub-categories)");
    fillEmptySelect(groupFilter, "(All groups)");
    fillEmptySelect(subgroupFilter, "(All sub-groups)");
  } else {
    // Try to map source kind to a category code and auto-select if present
    const mapped = mapSourceKindToCategoryCode(state.currentSourceKind);
    if (mapped && categoryFilter) {
      // Ensure classification options are loaded (safe no-op if already loaded)
      try {
        if (!cacheCat || !cacheCat.length) await loadClassificationOptions();
      } catch {
        /* ignore load errors here; we'll still reload tab */
      }
      // If the mapped code exists in the category select, pick it and populate downstream
      const opt = Array.from(categoryFilter.options).find(
        (o) => o.value === mapped,
      );
      if (opt) {
        categoryFilter.value = mapped;
        state.currentCategoryCode = mapped;
        populateSubcategoriesForCategory(mapped);
        showAutoSelectHint();
      }
    }
  }
  reloadIfDrawerClosed();
});

if (categoryFilter) {
  categoryFilter.addEventListener("change", () => {
    state.currentCategoryCode = categoryFilter.value || "all";
    reloadIfDrawerClosed();
  });
}
if (subcategoryFilter) {
  subcategoryFilter.addEventListener("change", () => {
    state.currentSubcategoryCode = subcategoryFilter.value || "all";
    reloadIfDrawerClosed();
  });
}
if (groupFilter) {
  groupFilter.addEventListener("change", () => {
    state.currentGroupCode = groupFilter.value || "all";
    reloadIfDrawerClosed();
  });
}
if (subgroupFilter) {
  subgroupFilter.addEventListener("change", () => {
    state.currentSubgroupCode = subgroupFilter.value || "all";
    reloadIfDrawerClosed();
  });
}

// Debounce search input to prevent focus loss during rapid typing
let _searchDebounceTimer = null;
if (searchInput) {
  searchInput.addEventListener("input", () => {
    resetPages();
    state.currentSearchText = searchInput.value.trim();
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      reloadActiveTab();
      _searchDebounceTimer = null;
    }, 300);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.currentTab = btn.dataset.tab;
    setActiveTab(state.currentTab);
    resetPages();
    reloadActiveTab();
  });
});

// Wire compact tab selector (mobile) to same behavior
if (tabSelect) {
  tabSelect.addEventListener("change", (ev) => {
    const v = ev.target.value;
    if (!v) return;
    state.currentTab = v;
    setActiveTab(state.currentTab);
    resetPages();
    reloadActiveTab();
  });
}

function isDateRangeRelevant(tab) {
  return tab === "purchase" || tab === "consumption";
}

function syncDateRangeAvailability() {
  const relevant = isDateRangeRelevant(state.currentTab);
  const dateItem = document.querySelector(
    "#mobileFiltersModal .filter-field.date",
  );
  if (dateItem) dateItem.classList.toggle("is-disabled", !relevant);
  if (dateRangeInput) {
    dateRangeInput.disabled = !relevant;
    dateRangeInput.setAttribute("aria-disabled", relevant ? "false" : "true");
    dateRangeInput.title = relevant
      ? "Filter Purchase History / Consumption by voucher date"
      : "Date Range applies only on Purchase History and Consumption";
    if (dateRangeInput._flatpickr) {
      dateRangeInput._flatpickr.set("clickOpens", relevant);
      dateRangeInput._flatpickr.set("allowInput", relevant);
    }
  }
}

function isFiltersDrawerOpen() {
  const modal = document.getElementById("mobileFiltersModal");
  return !!(modal && modal.classList.contains("open"));
}

function hasActiveDrawerFilters() {
  return (
    (state.currentSourceKind && state.currentSourceKind !== "all") ||
    (state.currentCategoryCode && state.currentCategoryCode !== "all") ||
    (state.currentSubcategoryCode && state.currentSubcategoryCode !== "all") ||
    (state.currentGroupCode && state.currentGroupCode !== "all") ||
    (state.currentSubgroupCode && state.currentSubgroupCode !== "all") ||
    !!state.currentFromDate ||
    !!state.currentToDate
  );
}

function updateFiltersBtnActive() {
  if (!filtersBtn) return;
  filtersBtn.classList.toggle("is-active", hasActiveDrawerFilters());
}

function reloadIfDrawerClosed() {
  updateFiltersBtnActive();
  resetPages();
  reloadActiveTab();
}

// Helper to visually mark the active tab and set aria attributes
function setActiveTab(name) {
  if (!tabButtons || !tabButtons.length) return;
  tabButtons.forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  // Keep compact select in sync on small screens
  if (tabSelect) {
    try {
      tabSelect.value = name;
    } catch {
      /* ignore */
    }
  }
  syncDateRangeAvailability();
}
// ---------- Classification / taxonomy population (cascading selects)
async function loadClassificationOptions(attempt = 1) {
  // fetch all four taxonomy tables in parallel; retry once on transient failures
  try {
    const [catRes, subRes, grpRes, sgrpRes] = await Promise.all([
      supabase
        .from("inv_class_category")
        .select("id,code,label,sort_order")
        .order("sort_order", { ascending: true })
        .order("code"),
      supabase
        .from("inv_class_subcategory")
        .select("id,category_id,code,label")
        .order("code"),
      supabase
        .from("inv_class_group")
        .select("id,subcategory_id,code,label")
        .order("code"),
      supabase
        .from("inv_class_subgroup")
        .select("id,group_id,code,label")
        .order("code"),
    ]);

    if (catRes.error || subRes.error || grpRes.error || sgrpRes.error) {
      throw catRes.error || subRes.error || grpRes.error || sgrpRes.error;
    }

    cacheCat = catRes.data || [];
    cacheSub = subRes.data || [];
    cacheGrp = grpRes.data || [];
    cacheSGrp = sgrpRes.data || [];

    // populate category select
    if (categoryFilter) {
      categoryFilter.innerHTML =
        `<option value="all">(All categories)</option>` +
        cacheCat
          .map(
            (c) =>
              `<option value="${c.code}">${c.code} — ${
                c.label || c.code
              }</option>`,
          )
          .join("");
      // ensure category select is enabled after population
      categoryFilter.disabled = false;
      // if state has a preselected category code, set it
      if (state.currentCategoryCode && state.currentCategoryCode !== "all") {
        categoryFilter.value = state.currentCategoryCode;
        // populate downstream selects
        populateSubcategoriesForCategory(state.currentCategoryCode);
      } else {
        // clear/disable downstream selects
        fillEmptySelect(subcategoryFilter, "(All sub-categories)");
        fillEmptySelect(groupFilter, "(All groups)");
        fillEmptySelect(subgroupFilter, "(All sub-groups)");
      }
    }
  } catch (err) {
    console.error(
      "Failed to load classification taxonomy (attempt",
      attempt,
      ")",
      err,
    );
    // Retry once after a small delay for transient network issues
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500));
      return loadClassificationOptions(attempt + 1);
    }
    // On persistent failure, ensure selects are in a usable state
    if (categoryFilter) {
      categoryFilter.innerHTML = `<option value="all">(All categories)</option>`;
      categoryFilter.disabled = false;
    }
    fillEmptySelect(subcategoryFilter, "(All sub-categories)");
    fillEmptySelect(groupFilter, "(All groups)");
    fillEmptySelect(subgroupFilter, "(All sub-groups)");
  }
}

function fillEmptySelect(el, label) {
  if (!el) return;
  el.innerHTML = `<option value="all">${label}</option>`;
  el.disabled = true;
}

function populateSubcategoriesForCategory(categoryCode) {
  if (!subcategoryFilter) return;
  const cat = cacheCat.find((c) => c.code === categoryCode);
  if (!cat) {
    fillEmptySelect(subcategoryFilter, "(All sub-categories)");
    fillEmptySelect(groupFilter, "(All groups)");
    fillEmptySelect(subgroupFilter, "(All sub-groups)");
    return;
  }
  const subs = cacheSub.filter((s) => String(s.category_id) === String(cat.id));
  subcategoryFilter.innerHTML =
    `<option value="all">(All sub-categories)</option>` +
    subs
      .map(
        (s) =>
          `<option value="${s.code}">${s.code} — ${s.label || s.code}</option>`,
      )
      .join("");
  subcategoryFilter.disabled = false;
  // reset downstream
  fillEmptySelect(groupFilter, "(All groups)");
  fillEmptySelect(subgroupFilter, "(All sub-groups)");
}

function populateGroupsForSubcategory(subcategoryCode) {
  if (!groupFilter) return;
  const sub = cacheSub.find((s) => s.code === subcategoryCode);
  if (!sub) {
    fillEmptySelect(groupFilter, "(All groups)");
    fillEmptySelect(subgroupFilter, "(All sub-groups)");
    return;
  }
  const grps = cacheGrp.filter(
    (g) => String(g.subcategory_id) === String(sub.id),
  );
  groupFilter.innerHTML =
    `<option value="all">(All groups)</option>` +
    grps
      .map(
        (g) =>
          `<option value="${g.code}">${g.code} — ${g.label || g.code}</option>`,
      )
      .join("");
  groupFilter.disabled = false;
  fillEmptySelect(subgroupFilter, "(All sub-groups)");
}

function populateSubgroupsForGroup(groupCode) {
  if (!subgroupFilter) return;
  const grp = cacheGrp.find((g) => g.code === groupCode);
  if (!grp) {
    fillEmptySelect(subgroupFilter, "(All sub-groups)");
    return;
  }
  const sgs = cacheSGrp.filter((s) => String(s.group_id) === String(grp.id));
  subgroupFilter.innerHTML =
    `<option value="all">(All sub-groups)</option>` +
    sgs
      .map(
        (s) =>
          `<option value="${s.code}">${s.code} — ${s.label || s.code}</option>`,
      )
      .join("");
  subgroupFilter.disabled = false;
}

// Wire cascading population on change (also update state handled earlier in listeners)
if (categoryFilter) {
  categoryFilter.addEventListener("change", () => {
    const code = categoryFilter.value || "all";
    if (code === "all") {
      fillEmptySelect(subcategoryFilter, "(All sub-categories)");
      fillEmptySelect(groupFilter, "(All groups)");
      fillEmptySelect(subgroupFilter, "(All sub-groups)");
    } else {
      populateSubcategoriesForCategory(code);
    }
  });
}
if (subcategoryFilter) {
  subcategoryFilter.addEventListener("change", () => {
    const code = subcategoryFilter.value || "all";
    if (code === "all") {
      fillEmptySelect(groupFilter, "(All groups)");
      fillEmptySelect(subgroupFilter, "(All sub-groups)");
    } else {
      populateGroupsForSubcategory(code);
    }
  });
}
if (groupFilter) {
  groupFilter.addEventListener("change", () => {
    const code = groupFilter.value || "all";
    if (code === "all") {
      fillEmptySelect(subgroupFilter, "(All sub-groups)");
    } else {
      populateSubgroupsForGroup(code);
    }
  });
}

// Modal open/close helpers with ARIA/inert fallback and focus trap
let _modalFocusable = [];
let _backgroundDisabled = [];

function _getFocusable(el) {
  if (!el) return [];
  const selectors = [
    "a[href]",
    "area[href]",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    "button:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(el.querySelectorAll(selectors)).filter(
    (f) => f.offsetParent !== null,
  );
}

function _trapTabHandler(e) {
  if (!modalOverlay || !modalOverlay.classList.contains("open")) return;
  if (e.key !== "Tab") return;
  if (!_modalFocusable || !_modalFocusable.length) return;
  const first = _modalFocusable[0];
  const last = _modalFocusable[_modalFocusable.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || active === modalOverlay) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function _maintainFocus(e) {
  if (!modalOverlay || !modalOverlay.classList.contains("open")) return;
  if (modalOverlay.contains(e.target)) return;
  e.stopPropagation();
  if (modalClose) modalClose.focus();
}

function setBackgroundInert(enable, exceptions = []) {
  const page = document.querySelector(".page");
  if (!page) return;
  // Use native inert if available
  if ("inert" in page) {
    page.inert = enable;
    return;
  }
  const selectors = [
    "a[href]",
    "area[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "button:not([disabled])",
    "[tabindex]",
  ].join(",");
  if (enable) {
    // Build a list of exception elements (keep them interactive)
    const exceptionEls = [modalOverlay]
      .concat(exceptions || [])
      .filter(Boolean);
    _backgroundDisabled = Array.from(page.querySelectorAll(selectors)).filter(
      (el) => !exceptionEls.some((ex) => ex && ex.contains && ex.contains(el)),
    );
    _backgroundDisabled.forEach((el) => {
      const prev = el.getAttribute("tabindex");
      el.dataset._savedTabindex = prev === null ? "null" : prev;
      el.setAttribute("tabindex", "-1");
    });
  } else {
    _backgroundDisabled.forEach((el) => {
      const prev = el.dataset._savedTabindex;
      if (prev === "null") el.removeAttribute("tabindex");
      else if (prev !== undefined) el.setAttribute("tabindex", prev);
      delete el.dataset._savedTabindex;
    });
    _backgroundDisabled = [];
  }
}

function openDetailModal(html) {
  if (!modalOverlay || !modalContent) return;
  _lastActiveElement = document.activeElement;
  modalContent.innerHTML = html;
  modalOverlay.classList.add("open");
  modalOverlay.setAttribute("aria-hidden", "false");
  // hide main page from assistive tech
  const page = document.querySelector(".page");
  if (page) page.setAttribute("aria-hidden", "true");
  // make background inert (or fallback)
  setBackgroundInert(true, [modalOverlay]);
  // compute focusable elements inside modal
  _modalFocusable = _getFocusable(modalOverlay);
  // ensure close button is focusable and focus it
  if (modalClose) modalClose.focus();
  // add focus trap handlers
  document.addEventListener("focus", _maintainFocus, true);
  document.addEventListener("keydown", _trapTabHandler);
}

function closeDetailModal() {
  if (!modalOverlay) return;
  // Remove focus-trap handlers first so focus can move freely.
  document.removeEventListener("focus", _maintainFocus, true);
  document.removeEventListener("keydown", _trapTabHandler);
  _modalFocusable = [];

  // If any element inside the modal still has focus, blur it so aria-hidden
  // can be applied without Chromium blocking it.
  try {
    const active = document.activeElement;
    if (active && modalOverlay && modalOverlay.contains(active)) {
      try {
        active.blur();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  // Now hide the modal and restore page accessibility.
  modalOverlay.classList.remove("open");
  modalOverlay.setAttribute("aria-hidden", "true");
  // restore main page visibility
  const page = document.querySelector(".page");
  if (page) page.removeAttribute("aria-hidden");
  // remove inert/fallback
  setBackgroundInert(false);
  // clear modal content
  modalContent.innerHTML = "";
  // restore focus to the element that was active before the modal opened
  try {
    if (_lastActiveElement && typeof _lastActiveElement.focus === "function") {
      _lastActiveElement.focus();
    }
  } catch {
    /* ignore focus restore errors */
  }
}

// Close handlers
if (modalClose) modalClose.addEventListener("click", closeDetailModal);
if (modalOverlay)
  modalOverlay.addEventListener("click", (ev) => {
    if (ev.target === modalOverlay) closeDetailModal();
  });
document.addEventListener("keydown", (ev) => {
  if (
    ev.key === "Escape" &&
    modalOverlay &&
    modalOverlay.classList.contains("open")
  ) {
    closeDetailModal();
  }
});

// Filters popover — real controls live in #mobileFiltersModal
const mobileFiltersModal = document.getElementById("mobileFiltersModal");
const mobileFiltersReset = document.getElementById("mobileFiltersReset");

function isFiltersFocusInside(node) {
  if (!node || !(node instanceof Node)) return false;
  if (filtersBtn && filtersBtn.contains(node)) return true;
  if (mobileFiltersModal && mobileFiltersModal.contains(node)) return true;
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (el && el.closest && (el.closest(".flatpickr-calendar") || el.closest(".flatpickr-confirm"))) {
    return true;
  }
  return false;
}

function openMobileFiltersModal() {
  if (!mobileFiltersModal) return;
  syncDateRangeAvailability();
  mobileFiltersModal.classList.add("open");
  mobileFiltersModal.setAttribute("aria-hidden", "false");
  if (filtersBtn) filtersBtn.setAttribute("aria-expanded", "true");
}

function closeMobileFiltersModal() {
  if (!mobileFiltersModal) return;
  mobileFiltersModal.classList.remove("open");
  mobileFiltersModal.setAttribute("aria-hidden", "true");
  if (filtersBtn) filtersBtn.setAttribute("aria-expanded", "false");
  updateFiltersBtnActive();
}

function resetDrawerFilters() {
  if (classificationSelect) classificationSelect.value = "all";
  if (categoryFilter) categoryFilter.value = "all";
  fillEmptySelect(subcategoryFilter, "(All sub-categories)");
  fillEmptySelect(groupFilter, "(All groups)");
  fillEmptySelect(subgroupFilter, "(All sub-groups)");
  if (dateRangeInput) {
    if (dateRangeInput._flatpickr) dateRangeInput._flatpickr.clear();
    else dateRangeInput.value = "";
  }
  state.currentSourceKind = "all";
  state.currentCategoryCode = "all";
  state.currentSubcategoryCode = "all";
  state.currentGroupCode = "all";
  state.currentSubgroupCode = "all";
  state.currentFromDate = "";
  state.currentToDate = "";
  updateFiltersBtnActive();
  resetPages();
  reloadActiveTab();
  showStatusToast("Filters reset", "info", 1200);
}

if (filtersBtn) {
  filtersBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (isFiltersDrawerOpen()) closeMobileFiltersModal();
    else openMobileFiltersModal();
  });
}

if (mobileFiltersReset) {
  mobileFiltersReset.addEventListener("click", (ev) => {
    ev.preventDefault();
    resetDrawerFilters();
  });
}

document.addEventListener("mousedown", (ev) => {
  if (!isFiltersDrawerOpen()) return;
  if (isFiltersFocusInside(ev.target)) return;
  const active = document.activeElement;
  if (
    active &&
    mobileFiltersModal &&
    mobileFiltersModal.contains(active) &&
    (active.tagName === "SELECT" || active.id === "dateRange")
  ) {
    return;
  }
  closeMobileFiltersModal();
});

document.addEventListener("focusin", (ev) => {
  if (!isFiltersDrawerOpen()) return;
  if (isFiltersFocusInside(ev.target)) return;
  closeMobileFiltersModal();
});

document.addEventListener("keydown", (ev) => {
  if (
    ev.key === "Escape" &&
    mobileFiltersModal &&
    mobileFiltersModal.classList.contains("open")
  ) {
    closeMobileFiltersModal();
  }
});

const searchClear = document.getElementById("searchClear");
let toggleMainClearButton;
if (searchInput && searchClear) {
  toggleMainClearButton = function () {
    searchClear.style.display = searchInput.value.trim() ? "flex" : "none";
  };
  toggleMainClearButton();
  searchInput.addEventListener("input", toggleMainClearButton);
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    resetPages();
    state.currentSearchText = "";
    toggleMainClearButton();
    reloadActiveTab();
  });
}

// Data loading functions
// JS SNIPPET 4: helper to apply canonical classification filters
function applyClassificationFilters(query) {
  const {
    currentCategoryCode,
    currentSubcategoryCode,
    currentGroupCode,
    currentSubgroupCode,
  } = state;

  if (currentCategoryCode && currentCategoryCode !== "all") {
    query = query.eq("category_code", currentCategoryCode);
  }
  if (currentSubcategoryCode && currentSubcategoryCode !== "all") {
    query = query.eq("subcategory_code", currentSubcategoryCode);
  }
  if (currentGroupCode && currentGroupCode !== "all") {
    query = query.eq("group_code", currentGroupCode);
  }
  if (currentSubgroupCode && currentSubgroupCode !== "all") {
    query = query.eq("subgroup_code", currentSubgroupCode);
  }
  return query;
}

// JS SNIPPET 5a: overview loader with canonical classification filters
async function loadOverviewItems({
  sourceKind,
  searchText,
  page = 1,
  pageSize = 30,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("v_item_supply_overview")
    .select("*", { count: "exact" });

  if (sourceKind && sourceKind !== "all") {
    query = query.eq("source_kind", sourceKind);
  }
  if (searchText) {
    query = query.or(`name.ilike.%${searchText}%,code.ilike.%${searchText}%`);
  }

  // apply category / subcategory / group / subgroup filters
  query = applyClassificationFilters(query);

  query = query.order("name");
  query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) return { error: handleSupabaseError(error) };
  // Attach UOM codes when missing by resolving default_uom_id from inv_stock_item
  try {
    const missingIds = (data || [])
      .filter((r) => !r.uom && !r.uom_code)
      .map((r) => r.inv_stock_item_id)
      .filter(Boolean);
    if (missingIds && missingIds.length) {
      const uomMap = await fetchUomsForItemIds(missingIds);
      (data || []).forEach((r) => {
        const v = uomMap.get(r.inv_stock_item_id);
        if (v) r.uom = v;
      });
    }
  } catch {
    /* ignore uom augmentation failures */
  }
  return { data, count };
}

// JS SNIPPET 5b: stock snapshot loader with canonical classification filters
async function loadStockSnapshot({
  sourceKind,
  searchText,
  page = 1,
  pageSize = 30,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("v_stock_current_by_item")
    .select("*", { count: "exact" });

  if (sourceKind && sourceKind !== "all") {
    query = query.eq("source_kind", sourceKind);
  }
  if (searchText) {
    query = query.or(`name.ilike.%${searchText}%,code.ilike.%${searchText}%`);
  }

  query = applyClassificationFilters(query);
  query = query.order("name");
  query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) return { error: handleSupabaseError(error) };
  // Attach UOM codes when missing
  try {
    const missingIds = (data || [])
      .filter((r) => !r.uom && !r.uom_code)
      .map((r) => r.inv_stock_item_id)
      .filter(Boolean);
    if (missingIds && missingIds.length) {
      const uomMap = await fetchUomsForItemIds(missingIds);
      (data || []).forEach((r) => {
        const v = uomMap.get(r.inv_stock_item_id);
        if (v) r.uom = v;
      });
    }
  } catch {
    /* ignore */
  }
  return { data, count };
}

// JS SNIPPET 5c: purchase summary loader with canonical classification filters
async function loadPurchaseSummary({
  sourceKind,
  searchText,
  fromDate,
  toDate,
  page = 1,
  pageSize = 30,
}) {
  // Use the server-side RPC to fetch paged, filtered purchase summary rows.
  const offset = (page - 1) * pageSize;
  const limit = pageSize;
  const rpcParams = {
    p_from_date: fromDate ? toIso(fromDate) : null,
    p_to_date: toDate ? toIso(toDate) : null,
    p_source_kind: sourceKind && sourceKind !== "all" ? sourceKind : null,
    p_search: searchText || null,
    p_category_code:
      state.currentCategoryCode && state.currentCategoryCode !== "all"
        ? state.currentCategoryCode
        : null,
    p_limit: limit,
    p_offset: offset,
  };

  const { data, error } = await supabase.rpc(
    "fn_purchase_summary_filtered",
    rpcParams,
  );
  if (error) return { error: handleSupabaseError(error) };

  // Augment purchase summary rows with UOM where missing
  try {
    const ids = (data || []).map((r) => r.inv_stock_item_id).filter(Boolean);
    if (ids && ids.length) {
      const uomMap = await fetchUomsForItemIds(ids);
      (data || []).forEach((r) => {
        const v = uomMap.get(r.inv_stock_item_id);
        if (v) r.uom = v;
      });
    }
  } catch {
    /* ignore uom augmentation errors */
  }

  // Obtain exact total count for pagination by querying the view head.
  try {
    let countQuery = supabase
      .from("v_purchases_summary_by_item")
      .select("inv_stock_item_id", { count: "exact", head: true });
    if (sourceKind && sourceKind !== "all") {
      countQuery = countQuery.eq("source_kind", sourceKind);
    }
    if (searchText) {
      countQuery = countQuery.or(
        `name.ilike.%${searchText}%,code.ilike.%${searchText}%`,
      );
    }
    if (fromDate)
      countQuery = countQuery.gte("last_purchase_date", toIso(fromDate));
    if (toDate)
      countQuery = countQuery.lte("last_purchase_date", toIso(toDate));
    countQuery = applyClassificationFilters(countQuery);
    const { error: cntErr, count } = await countQuery;
    if (cntErr) return { data, count: 0 };
    return { data, count: count || 0 };
  } catch {
    return { data, count: 0 };
  }
}

async function loadPurchaseDetails({ invStockItemId, fromDate, toDate }) {
  // Use RPC to fetch purchase lines for the item limited by voucher date
  const rpcParams = {
    p_inv_stock_item_id: invStockItemId,
    p_from_date: fromDate ? toIso(fromDate) : null,
    p_to_date: toDate ? toIso(toDate) : null,
  };
  const { data, error } = await supabase.rpc(
    "fn_purchase_details_filtered",
    rpcParams,
  );
  if (error) return { error: handleSupabaseError(error) };
  return { data };
}

// NEW: load monthly consumption rows for an item
async function loadConsumptionMonthly({ invStockItemId, fromDate, toDate }) {
  const rpcParams = {
    p_inv_stock_item_id: invStockItemId,
    p_from_date: fromDate ? toIso(fromDate) : null,
    p_to_date: toDate ? toIso(toDate) : null,
  };
  const { data, error } = await supabase.rpc(
    "fn_consumption_monthly_filtered",
    rpcParams,
  );
  if (error) return { error: handleSupabaseError(error) };
  return { data };
}
async function loadConsumptionSummary({
  sourceKind,
  searchText,
  fromDate,
  toDate,
  page = 1,
  pageSize = 30,
}) {
  // Call server-side RPC that returns per-item consumption summary (paged)
  const offset = (page - 1) * pageSize;
  const limit = pageSize;
  const rpcParams = {
    p_from_date: fromDate ? toIso(fromDate) : null,
    p_to_date: toDate ? toIso(toDate) : null,
    p_source_kind: sourceKind || null,
    p_search: searchText || null,
    p_category_code: state.currentCategoryCode || null,
    p_limit: limit,
    p_offset: offset,
  };

  const { data, error } = await supabase.rpc(
    "fn_consumption_summary_filtered",
    rpcParams,
  );
  if (error) {
    console.warn(
      "fn_consumption_summary_filtered RPC error, falling back to client aggregation:",
      error,
    );
    return await fallbackLoadConsumptionSummary({
      sourceKind,
      searchText,
      fromDate,
      toDate,
      page,
      pageSize,
    });
  }

  // Augment RPC consumption summary rows with UOM when missing
  try {
    const ids = (data || []).map((r) => r.inv_stock_item_id).filter(Boolean);
    if (ids && ids.length) {
      const uomMap = await fetchUomsForItemIds(ids);
      (data || []).forEach((r) => {
        const v = uomMap.get(r.inv_stock_item_id);
        if (v) r.uom = v;
      });
    }
  } catch {
    /* ignore */
  }

  // Try to obtain an exact total count via a companion RPC if available.
  // If such RPC isn't deployed, fall back to a best-effort count.
  let totalCount = 0;
  try {
    // Many deployments add a count RPC; try it but don't fail if absent.
    const { data: cntData, error: cntErr } = await supabase.rpc(
      "fn_consumption_summary_count_filtered",
      {
        p_from_date: rpcParams.p_from_date,
        p_to_date: rpcParams.p_to_date,
        p_source_kind: rpcParams.p_source_kind,
        p_search: rpcParams.p_search,
        p_category_code: rpcParams.p_category_code,
      },
    );
    if (!cntErr && cntData) {
      // Support common return shapes: [{ count: N }] or plain integer array
      if (
        Array.isArray(cntData) &&
        cntData.length === 1 &&
        cntData[0].count !== undefined
      ) {
        totalCount = Number(cntData[0].count) || 0;
      } else if (
        Array.isArray(cntData) &&
        cntData.length === 1 &&
        typeof cntData[0] === "number"
      ) {
        totalCount = Number(cntData[0]) || 0;
      } else if (Array.isArray(cntData)) {
        totalCount = cntData.length;
      }
    }
  } catch {
    // ignore errors from optional count RPC
  }

  // If count RPC wasn't available or didn't return a value, estimate safely
  if (!totalCount) {
    if (!data || !data.length) totalCount = 0;
    else if (data.length < limit) totalCount = offset + data.length;
    else totalCount = offset + data.length + 1; // unknown exact count, signal there may be more
  }

  return { data: data || [], count: totalCount };
}

// Fallback: client-side aggregation using the monthly view
async function fallbackLoadConsumptionSummary({
  sourceKind,
  searchText,
  fromDate,
  toDate,
  page = 1,
  pageSize = 30,
}) {
  // Query the monthly view for rows in range with allowed filters (avoid name/code filters here)
  // The monthly view does not expose classification code columns in some schemas.
  // Request only the monthly metrics and source_kind here; classification will
  // be resolved by fetching `inv_stock_item` metadata later.
  let query = supabase
    .from("v_item_consumption_monthly_by_item")
    .select(
      `inv_stock_item_id,month_start_date,total_consumed_qty,rm_pm_issue_qty,consumable_out_qty,source_kind`,
    );

  if (sourceKind && sourceKind !== "all")
    query = query.eq("source_kind", sourceKind);
  if (fromDate) query = query.gte("month_start_date", toIso(fromDate));
  if (toDate) query = query.lte("month_start_date", toIso(toDate));
  // NOTE: do NOT apply `applyClassificationFilters` here because the
  // monthly view `v_item_consumption_monthly_by_item` does not expose
  // classification columns in some deployments. We'll resolve classification
  // codes from `inv_stock_item_class_map` and apply filters client-side below.

  const { data: rows, error: rowsErr } = await query;
  if (rowsErr) return { error: handleSupabaseError(rowsErr) };
  if (!rows || !rows.length) return { data: [], count: 0 };

  // Aggregate by inv_stock_item_id
  const map = new Map();
  for (const r of rows) {
    const id = r.inv_stock_item_id;
    if (!map.has(id)) {
      map.set(id, {
        inv_stock_item_id: id,
        total_consumed_qty: 0,
        rm_pm_issue_qty: 0,
        consumable_out_qty: 0,
        months_set: new Set(),
        first_month: null,
        last_month: null,
        category_code: r.category_code || null,
        subcategory_code: r.subcategory_code || null,
        group_code: r.group_code || null,
        subgroup_code: r.subgroup_code || null,
        source_kind: r.source_kind || null,
      });
    }
    const cur = map.get(id);
    cur.total_consumed_qty += Number(r.total_consumed_qty || 0);
    cur.rm_pm_issue_qty += Number(r.rm_pm_issue_qty || 0);
    cur.consumable_out_qty += Number(r.consumable_out_qty || 0);
    const m = r.month_start_date;
    if (m) {
      cur.months_set.add(m);
      if (!cur.first_month || m < cur.first_month) cur.first_month = m;
      if (!cur.last_month || m > cur.last_month) cur.last_month = m;
    }
  }

  // Fetch metadata (code/name) for the items we aggregated (basic fields only)
  const ids = Array.from(map.keys());
  const { data: items, error: itemsErr } = await supabase
    .from("inv_stock_item")
    .select("id,code,name,source_kind,default_uom_id")
    .in("id", ids);
  if (itemsErr) return { error: handleSupabaseError(itemsErr) };

  // Build item map and fetch UOM codes for any default_uom_id present
  const itemMap = new Map((items || []).map((it) => [it.id, it]));
  try {
    const uomIds = Array.from(
      new Set((items || []).map((it) => it.default_uom_id).filter(Boolean)),
    );
    if (uomIds.length) {
      const { data: uoms, error: uomErr } = await supabase
        .from("inv_uom")
        .select("id,code")
        .in("id", uomIds);
      if (!uomErr && uoms) {
        const uomMap = new Map((uoms || []).map((u) => [u.id, u.code]));
        (items || []).forEach((it) => {
          if (it.default_uom_id) it.uom = uomMap.get(it.default_uom_id) || null;
          itemMap.set(it.id, it);
        });
      }
    }
  } catch {
    /* ignore uom fetch errors */
  }

  // Fetch class mapping entries for these items and then fetch class codes
  const { data: maps, error: mapsErr } = await supabase
    .from("inv_stock_item_class_map")
    .select("stock_item_id,category_id,subcategory_id,group_id,subgroup_id")
    .in("stock_item_id", ids);
  if (mapsErr) return { error: handleSupabaseError(mapsErr) };

  // Build id sets for each classification level
  const catIds = new Set();
  const subIds = new Set();
  const grpIds = new Set();
  const sgrpIds = new Set();
  const mapByItem = new Map();
  for (const m of maps || []) {
    mapByItem.set(m.stock_item_id, m);
    if (m.category_id) catIds.add(m.category_id);
    if (m.subcategory_id) subIds.add(m.subcategory_id);
    if (m.group_id) grpIds.add(m.group_id);
    if (m.subgroup_id) sgrpIds.add(m.subgroup_id);
  }

  // Helper to fetch code lookup for a table of class ids
  async function fetchCodes(tbl, idsSet) {
    if (!idsSet || idsSet.size === 0) return new Map();
    const idsArr = Array.from(idsSet);
    const { data: rows, error: err } = await supabase
      .from(tbl)
      .select("id,code")
      .in("id", idsArr);
    if (err) return { err };
    const m = new Map((rows || []).map((r) => [r.id, r.code]));
    return { map: m };
  }

  const [
    { map: catMap } = {},
    { map: subMap } = {},
    { map: grpMap } = {},
    { map: sgrpMap } = {},
  ] = await Promise.all([
    fetchCodes("inv_class_category", catIds),
    fetchCodes("inv_class_subcategory", subIds),
    fetchCodes("inv_class_group", grpIds),
    fetchCodes("inv_class_subgroup", sgrpIds),
  ]);

  // Build summaries array and apply searchText filter against code/name if provided
  let summaries = Array.from(map.values()).map((s) => {
    const it = itemMap.get(s.inv_stock_item_id) || {};
    const cm = mapByItem.get(s.inv_stock_item_id) || {};
    const category_code =
      cm.category_id && catMap ? catMap.get(cm.category_id) : null;
    const subcategory_code =
      cm.subcategory_id && subMap ? subMap.get(cm.subcategory_id) : null;
    const group_code = cm.group_id && grpMap ? grpMap.get(cm.group_id) : null;
    const subgroup_code =
      cm.subgroup_id && sgrpMap ? sgrpMap.get(cm.subgroup_id) : null;
    return {
      inv_stock_item_id: s.inv_stock_item_id,
      code: it.code || "–",
      name: it.name || "–",
      uom: it.uom || null,
      category_code: category_code || null,
      subcategory_code: subcategory_code || null,
      group_code: group_code || null,
      subgroup_code: subgroup_code || null,
      source_kind: s.source_kind || it.source_kind || null,
      total_consumed_qty: s.total_consumed_qty,
      rm_pm_issue_qty: s.rm_pm_issue_qty,
      consumable_out_qty: s.consumable_out_qty,
      months_with_usage: s.months_set.size,
      first_month: s.first_month,
      last_month: s.last_month,
    };
  });

  if (searchText) {
    const st = searchText.trim();
    const lower = st.toLowerCase();
    summaries = summaries.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(lower) ||
        (r.code || "").toLowerCase().includes(lower),
    );
  }

  // Apply classification filters client-side since the monthly view lacks
  // classification columns in some deployments.
  if (state.currentCategoryCode && state.currentCategoryCode !== "all") {
    summaries = summaries.filter(
      (r) => r.category_code === state.currentCategoryCode,
    );
  }
  if (state.currentSubcategoryCode && state.currentSubcategoryCode !== "all") {
    summaries = summaries.filter(
      (r) => r.subcategory_code === state.currentSubcategoryCode,
    );
  }
  if (state.currentGroupCode && state.currentGroupCode !== "all") {
    summaries = summaries.filter(
      (r) => r.group_code === state.currentGroupCode,
    );
  }
  if (state.currentSubgroupCode && state.currentSubgroupCode !== "all") {
    summaries = summaries.filter(
      (r) => r.subgroup_code === state.currentSubgroupCode,
    );
  }

  summaries.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const totalCount = summaries.length;
  const start = (page - 1) * pageSize;
  const pageRows = summaries.slice(start, start + pageSize);
  return { data: pageRows, count: totalCount };
}

// Utility: convert dd-mm-yyyy to ISO yyyy-mm-dd
function toIso(dstr) {
  if (!dstr) return "";
  const [dd, mm, yyyy] = dstr.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

// Number formatting helpers for Indian place value and INR currency
function _isNumeric(v) {
  return v !== null && v !== undefined && !Number.isNaN(Number(v));
}

function formatIndianNumber(v) {
  if (!_isNumeric(v)) return "–";
  const num = Number(v);
  if (!isFinite(num)) return "–";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  // Ensure three decimal places
  const fixed = abs.toFixed(3); // returns string
  let [intPart, decPart] = fixed.split(".");
  // Indian grouping: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let rest = intPart.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    intPart = rest + "," + last3;
  }
  // Wrap decimal part in a small span for ERP-style subtlety
  return sign + intPart + '.<span class="sp-decimal">' + decPart + "</span>";
}

function formatCurrencyINR(v) {
  const formatted = formatIndianNumber(v);
  if (formatted === "–") return "–";
  return `₹${formatted}`;
}

function stripHtmlTags(text) {
  return String(text || "").replace(/<[^>]*>/g, "");
}

function copyTextWithExecCommand(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = String(text || "");
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch (err) {
    console.warn("execCommand copy failed", err);
    return false;
  }
}

async function writeTextRobust(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed", err);
    }
  }

  if (copyTextWithExecCommand(text)) {
    return "copied";
  }

  if (navigator?.share) {
    try {
      await navigator.share({
        title: "RM Receiving Stock",
        text,
      });
      return "shared";
    } catch (err) {
      // user cancel is expected; treat as failure path below
      console.warn("navigator.share failed", err);
    }
  }

  return "failed";
}

function copyRmReceivingRows() {
  // Copy ALL mapped RM receiving rows (not just the currently loaded page)
  // and include only the Name and Qty columns.
  (async () => {
    try {
      const baseParams = {
        p_as_of_date: null,
        p_search: state.currentSearchText || null,
        p_category_code: state.currentCategoryCode || "all",
        p_subcategory_code: state.currentSubcategoryCode || "all",
        p_group_code: state.currentGroupCode || "all",
        p_subgroup_code: state.currentSubgroupCode || "all",
        p_mapping_status: "mapped",
      };

      const { data, error } = await supabase.rpc("fn_rm_rms_stock_filtered", {
        ...baseParams,
        p_limit: 10000,
        p_offset: 0,
      });

      if (error) {
        showStatusToast("Failed to load rows for copy", "error");
        return;
      }

      const allRows = Array.isArray(data) ? data : [];
      if (!allRows.length) {
        showStatusToast("No rows to copy", "info");
        return;
      }

      // Filter to non-zero qty only
      const nonZeroRows = allRows.filter((r) => {
        const q = parseFloat(r.qty_value);
        return !isNaN(q) && q !== 0;
      });

      if (!nonZeroRows.length) {
        showStatusToast("No non-zero rows to copy", "info");
        return;
      }

      // Derive the as-of date from the first row or today
      const asOfDate =
        nonZeroRows[0]?.as_of_date || new Date().toISOString().slice(0, 10);

      const lines = [
        "*RM Receiving Stock*",
        `Godown: Warehouse No.2 (RMS) | As of: ${asOfDate}`,
        "",
        "*Item Name | Qty*",
      ];

      nonZeroRows.forEach((row) => {
        const name = stripHtmlTags(row.name || row.tally_item_name || "—");
        const qty = stripHtmlTags(formatIndianNumber(row.qty_value));
        lines.push(`${name} | ${qty}`);
      });

      const outcome = await writeTextRobust(lines.join("\n"));
      if (outcome === "copied") {
        showStatusToast("Copied RM Receiving Stock", "success");
      } else if (outcome === "shared") {
        showStatusToast("Opened share sheet for RM Receiving Stock", "info");
      } else {
        showStatusToast("Copy failed on this device", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusToast("Copy failed — check clipboard permission", "error");
    }
  })();
}

// Rendering functions
function renderLoading() {
  tableArea.innerHTML = "";
  if (speCardsList) speCardsList.innerHTML = "";
  setBusy(true, "Loading\u2026");
}
function renderError(msg) {
  tableArea.innerHTML = `<div class="error">${msg}</div>`;
  renderSpeStatusCard(msg || "Error loading data");
  setBusy(false);
}
function renderNoData() {
  tableArea.innerHTML = '<div class="no-data">No data found.</div>';
  renderSpeStatusCard("No data found.");
  setBusy(false);
  state.hasMore = false;
  state.loadingMore = false;
  LAST_ACTIVE_ROWS = [];
  updateScrollSentinel("");
}

// Card-level busy overlay (inside .table-card, not full-page)
function setBusy(flag, msg) {
  const overlay = document.getElementById("tableCardBusy");
  if (!overlay) return;
  if (flag) {
    const txtEl = overlay.querySelector(".tco-msg");
    if (txtEl) txtEl.textContent = msg || "Loading\u2026";
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }
}

// JS SNIPPET 6: helper to format canonical classification for display
function formatClassification(row) {
  const parts = [];
  if (row.category_code) parts.push(row.category_code);
  if (row.subcategory_code) parts.push(row.subcategory_code);
  if (row.group_code) parts.push(row.group_code);
  if (row.subgroup_code) parts.push(row.subgroup_code);

  if (parts.length) return parts.join(" · ");
  return row.source_kind || "–";
}

// Helper to obtain a UOM string from a row using common field names
function getRowUOM(row) {
  if (!row) return "–";
  return (
    row.uom ||
    row.uom_code ||
    row.default_uom ||
    row.default_uom_code ||
    row.stock_uom ||
    row.inv_default_uom ||
    row.stock_uom_code ||
    "–"
  );
}

const SPE_CARD_CHEV = `<svg class="spe-result-card-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;

function speCardMetaHtml(parts) {
  return (parts || [])
    .filter((p) => p != null && String(p).trim() !== "")
    .map(
      (p) =>
        `<span class="spe-result-card-meta">${escapeHtml(String(p))}</span>`,
    )
    .join('<span class="spe-result-card-dot">·</span>');
}

function speResultCardHtml(index, spec) {
  const {
    id,
    selectable,
    actionable,
    name,
    metaParts,
    subLine,
    classLine,
    metrics,
  } = spec;
  const alt = index % 2 === 1 ? " spe-result-card--alt" : "";
  const selected =
    id && String(id) === String(state.selectedItemId) ? " selected" : "";
  const staticCls = !selectable && !actionable ? " spe-result-card--static" : "";
  const actionCls = actionable ? " spe-result-card--action" : "";
  const attrs = [];
  if (id) attrs.push(`data-id="${escapeHtml(String(id))}"`);
  if (selectable || actionable) {
    attrs.push('role="button"', 'tabindex="0"');
  }
  const metricsHtml = (metrics || [])
    .map((m, i) => {
      const extra = i > 0 ? " spe-result-card-metric--rule" : "";
      return `<div class="spe-result-card-metric${extra}"><span class="spe-result-card-k">${escapeHtml(m.label)}</span> ${m.html}</div>`;
    })
    .join("");
  return `<article class="spe-result-card${alt}${staticCls}${actionCls}${selected}" ${attrs.join(" ")}>
    ${actionable ? SPE_CARD_CHEV : ""}
    <div class="spe-result-card-line1">
      <span class="spe-result-card-name">${escapeHtml(name || "–")}</span>
    </div>
    <div class="spe-result-card-line-meta">${speCardMetaHtml(metaParts)}</div>
    ${subLine ? `<div class="spe-result-card-sub">${escapeHtml(subLine)}</div>` : ""}
    ${classLine ? `<div class="spe-result-card-class">${escapeHtml(classLine)}</div>` : ""}
    ${metricsHtml}
  </article>`;
}

function overviewCardHtml(row, index) {
  return speResultCardHtml(index, {
    id: row.inv_stock_item_id,
    selectable: true,
    actionable: false,
    name: row.name,
    metaParts: [row.code, getRowUOM(row)],
    classLine: formatClassification(row),
    metrics: [
      {
        label: "Stock:",
        html: `${formatIndianNumber(row.current_stock_qty)} @ ${formatCurrencyINR(row.current_stock_rate)}`,
      },
      {
        label: "Purchased:",
        html: `${formatIndianNumber(row.total_purchased_qty)} @ ${formatCurrencyINR(row.avg_purchase_rate)}`,
      },
      {
        label: "Consumed:",
        html: formatIndianNumber(row.total_consumed_qty),
      },
    ],
  });
}

function stockCardHtml(row, index) {
  return speResultCardHtml(index, {
    selectable: false,
    actionable: false,
    name: row.name,
    metaParts: [row.code, getRowUOM(row)],
    classLine: formatClassification(row),
    metrics: [
      { label: "Stock:", html: formatIndianNumber(row.qty_value) },
      { label: "Rate:", html: formatCurrencyINR(row.avg_rate_value) },
    ],
  });
}

function purchaseCardHtml(row, index) {
  const tx = row.purchase_lines ?? "–";
  return speResultCardHtml(index, {
    id: row.inv_stock_item_id,
    selectable: true,
    actionable: true,
    name: row.name,
    metaParts: [row.code, getRowUOM(row)],
    classLine: formatClassification(row),
    metrics: [
      {
        label: "Purchased:",
        html: `${formatIndianNumber(row.total_purchased_qty)} @ ${formatCurrencyINR(row.avg_purchase_rate)}`,
      },
      {
        label: "Last:",
        html: `${escapeHtml(row.last_purchase_date ?? "–")} · ${escapeHtml(String(tx))} txns`,
      },
    ],
  });
}

function consumptionCardHtml(row, index) {
  return speResultCardHtml(index, {
    id: row.inv_stock_item_id,
    selectable: true,
    actionable: true,
    name: row.name,
    metaParts: [row.code, getRowUOM(row)],
    classLine: formatClassification(row),
    metrics: [
      {
        label: "Consumed:",
        html: formatIndianNumber(row.total_consumed_qty),
      },
      {
        label: "Split:",
        html: `RM/PLM ${formatIndianNumber(row.rm_pm_issue_qty)} · Consumables ${formatIndianNumber(row.consumable_out_qty)}`,
      },
    ],
  });
}

function rmReceivingCardHtml(row, index) {
  return speResultCardHtml(index, {
    selectable: false,
    actionable: false,
    name: row.name,
    metaParts: [row.code ?? "–", row.as_of_date ?? "–"],
    subLine: row.tally_item_name || "",
    classLine: formatClassification(row),
    metrics: [
      { label: "Qty:", html: formatIndianNumber(row.qty_value) },
      {
        label: "Rate / Value:",
        html: `${formatCurrencyINR(row.rate_value)} · ${formatCurrencyINR(row.stock_value)}`,
      },
    ],
  });
}

function cardHtmlForTab(row, index) {
  if (state.currentTab === "overview") return overviewCardHtml(row, index);
  if (state.currentTab === "stock") return stockCardHtml(row, index);
  if (state.currentTab === "purchase") return purchaseCardHtml(row, index);
  if (state.currentTab === "consumption") return consumptionCardHtml(row, index);
  if (state.currentTab === "rm-receiving-stock")
    return rmReceivingCardHtml(row, index);
  return "";
}

function syncSpeCards(rows, { append = false, startIndex = 0 } = {}) {
  if (!speCardsList) return;
  const html = (rows || [])
    .map((row, i) => cardHtmlForTab(row, startIndex + i))
    .join("");
  if (!append) speCardsList.innerHTML = html;
  else speCardsList.insertAdjacentHTML("beforeend", html);
}

function renderSpeStatusCard(msg) {
  if (!speCardsList) return;
  speCardsList.innerHTML = `<article class="spe-result-card spe-result-card--status">${escapeHtml(msg)}</article>`;
}

function onSpeCardActivate(card) {
  if (
    !card ||
    card.classList.contains("spe-result-card--status") ||
    card.classList.contains("spe-result-card--static")
  )
    return;
  const id = card.getAttribute("data-id");
  if (!id) return;
  state.selectedItemId = id;
  syncRowSelection(id);
  if (state.currentTab === "purchase") loadAndRenderPurchaseDetail(id);
  else if (state.currentTab === "consumption")
    loadAndRenderConsumptionMonthly(id);
}

function wireSpeCardClicks() {
  if (!speCardsList || speCardsList.dataset.wired) return;
  speCardsList.dataset.wired = "1";
  speCardsList.addEventListener("click", (ev) => {
    const card = ev.target.closest(".spe-result-card");
    if (card) onSpeCardActivate(card);
  });
  speCardsList.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const card = ev.target.closest(".spe-result-card");
    if (!card) return;
    ev.preventDefault();
    onSpeCardActivate(card);
  });
}

// Fetch default UOM codes for a set of inv_stock_item ids and return map id->uomCode
async function fetchUomsForItemIds(ids) {
  if (!ids || !ids.length) return new Map();
  // fetch default_uom_id from inv_stock_item
  const { data: items, error: itemsErr } = await supabase
    .from("inv_stock_item")
    .select("id,default_uom_id")
    .in("id", ids);
  if (itemsErr || !items) return new Map();

  const uomIds = Array.from(
    new Set((items || []).map((it) => it.default_uom_id).filter(Boolean)),
  );
  if (!uomIds.length) {
    const m = new Map();
    (items || []).forEach((it) => m.set(it.id, null));
    return m;
  }

  const { data: uoms, error: uomErr } = await supabase
    .from("inv_uom")
    .select("id,code")
    .in("id", uomIds);
  if (uomErr || !uoms) return new Map();

  const uomMap = new Map((uoms || []).map((u) => [u.id, u.code]));
  const result = new Map();
  (items || []).forEach((it) => {
    const code = it.default_uom_id ? uomMap.get(it.default_uom_id) : null;
    result.set(it.id, code || null);
  });
  return result;
}

function overviewRowHtml(row) {
  return `<tr data-id="${row.inv_stock_item_id}"${
    row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
  }>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.current_stock_qty)}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(row.current_stock_rate)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.total_purchased_qty)}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(row.avg_purchase_rate)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.total_consumed_qty)}</td>
      <td style="vertical-align:middle; text-align:center">${row.months_with_usage ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">${row.last_purchase_date ?? "–"}</td>
    </tr>`;
}

function bindOverviewRowClicks() {
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.onclick = () => {
      state.selectedItemId = tr.getAttribute("data-id");
      syncRowSelection(state.selectedItemId);
    };
  });
}

function renderOverviewTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Current Stock Qty</th>
    <th style="vertical-align:middle; text-align:center">Current Stock Rate</th>
    <th style="vertical-align:middle; text-align:center">Total Purchased Qty</th>
    <th style="vertical-align:middle; text-align:center">Avg Purchase Rate</th>
    <th style="vertical-align:middle; text-align:center">Total Consumed Qty</th>
    <th style="vertical-align:middle; text-align:center">Usage Months</th>
    <th style="vertical-align:middle; text-align:center">Last Purchase Date</th>
  </tr></thead><tbody>${rows.map(overviewRowHtml).join("")}</tbody></table>`;
    LAST_ACTIVE_ROWS = [...rows];
    syncSpeCards(rows, { append: false, startIndex: 0 });
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody) return renderOverviewTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML("beforeend", rows.map(overviewRowHtml).join(""));
    const startIndex = LAST_ACTIVE_ROWS.length;
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
    syncSpeCards(rows, { append: true, startIndex });
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
  bindOverviewRowClicks();
}

function stockRowHtml(row) {
  return `<tr>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.qty_value)}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(row.avg_rate_value)}</td>
    </tr>`;
}

function renderStockTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Current Stock</th>
    <th style="vertical-align:middle; text-align:center">Valuation Rate</th>
  </tr></thead><tbody>${rows.map(stockRowHtml).join("")}</tbody></table>`;
    LAST_ACTIVE_ROWS = [...rows];
    syncSpeCards(rows, { append: false, startIndex: 0 });
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody) return renderStockTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML("beforeend", rows.map(stockRowHtml).join(""));
    const startIndex = LAST_ACTIVE_ROWS.length;
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
    syncSpeCards(rows, { append: true, startIndex });
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
}

function purchaseRowHtml(row) {
  return `<tr data-id="${row.inv_stock_item_id}"${
    row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
  }>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.total_purchased_qty)}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(row.avg_purchase_rate)}</td>
      <td style="vertical-align:middle; text-align:center">${row.last_purchase_date ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">${row.purchase_lines ?? "–"}</td>
    </tr>`;
}

function bindPurchaseRowClicks() {
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.onclick = () => {
      state.selectedItemId = tr.getAttribute("data-id");
      syncRowSelection(state.selectedItemId);
      loadAndRenderPurchaseDetail(state.selectedItemId);
    };
  });
}

function renderPurchaseSummaryTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Total Purchased Qty</th>
    <th style="vertical-align:middle; text-align:center">Avg Purchase Rate</th>
    <th style="vertical-align:middle; text-align:center">Last Purchase Date</th>
    <th style="vertical-align:middle; text-align:center">Transactions</th>
  </tr></thead><tbody>${rows.map(purchaseRowHtml).join("")}</tbody></table>`;
    LAST_ACTIVE_ROWS = [...rows];
    syncSpeCards(rows, { append: false, startIndex: 0 });
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody)
      return renderPurchaseSummaryTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML("beforeend", rows.map(purchaseRowHtml).join(""));
    const startIndex = LAST_ACTIVE_ROWS.length;
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
    syncSpeCards(rows, { append: true, startIndex });
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
  bindPurchaseRowClicks();
  if (!append && state.selectedItemId) {
    loadAndRenderPurchaseDetail(state.selectedItemId);
  } else if (!append && sidePanel) {
    sidePanel.classList.remove("active");
  }
}

function consumptionRowHtml(row) {
  return `<tr data-id="${row.inv_stock_item_id}"${
    row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
  }>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.total_consumed_qty)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.rm_pm_issue_qty)}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(row.consumable_out_qty)}</td>
      <td style="vertical-align:middle; text-align:center">${row.months_with_usage ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">${row.first_month ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">${row.last_month ?? "–"}</td>
    </tr>`;
}

function bindConsumptionRowClicks() {
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.onclick = () => {
      state.selectedItemId = tr.getAttribute("data-id");
      syncRowSelection(state.selectedItemId);
      loadAndRenderConsumptionMonthly(state.selectedItemId);
    };
  });
}

function renderConsumptionTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Total Consumed Qty</th>
    <th style="vertical-align:middle; text-align:center">RM/PLM Issues</th>
    <th style="vertical-align:middle; text-align:center">Consumables Out</th>
    <th style="vertical-align:middle; text-align:center">Usage Months</th>
    <th style="vertical-align:middle; text-align:center">First Month</th>
    <th style="vertical-align:middle; text-align:center">Last Month</th>
  </tr></thead><tbody>${rows.map(consumptionRowHtml).join("")}</tbody></table>`;
    LAST_ACTIVE_ROWS = [...rows];
    syncSpeCards(rows, { append: false, startIndex: 0 });
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody) return renderConsumptionTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML(
      "beforeend",
      rows.map(consumptionRowHtml).join(""),
    );
    const startIndex = LAST_ACTIVE_ROWS.length;
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
    syncSpeCards(rows, { append: true, startIndex });
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
  bindConsumptionRowClicks();
}

// NEW: open modal and render monthly consumption for an item
async function loadAndRenderConsumptionMonthly(invStockItemId) {
  openDetailModal('<div class="loading">Loading…</div>');
  const { data, error } = await loadConsumptionMonthly({
    invStockItemId,
    fromDate: state.currentFromDate,
    toDate: state.currentToDate,
  });
  if (error) {
    const errMsg =
      error.userMessage ||
      error.message ||
      "Failed to load consumption history";
    showStatusToast(errMsg, "error", 4000);
    modalContent.innerHTML = `<div class="error">${errMsg}</div>`;
    return;
  }
  if (!data || !data.length) {
    modalContent.innerHTML =
      '<div class="no-data">No consumption history found.</div>';
    return;
  }

  let html = `<h3 class="spe-modal-title">Monthly Consumption</h3>
    <div class="modal-table-wrap">
      <table class="erp-table">
        <thead><tr>
          <th class="col-date">Month</th>
          <th class="numeric">RM/PLM Issues</th>
          <th class="numeric">Consumables Out</th>
          <th class="numeric">Total Consumed</th>
        </tr></thead>
        <tbody>`;

  data.forEach((row) => {
    html += `<tr>
      <td class="col-date">${row.month_label ?? row.month_start_date ?? "–"}</td>
      <td class="numeric">${formatIndianNumber(row.rm_pm_issue_qty)}</td>
      <td class="numeric">${formatIndianNumber(row.consumable_out_qty)}</td>
      <td class="numeric">${formatIndianNumber(row.total_consumed_qty)}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  modalContent.innerHTML = html;
}

// ── RM Receiving Stock tab ─────────────────────────────────────────────────
async function loadRmReceivingStock({
  searchText,
  categoryCode,
  subcategoryCode,
  groupCode,
  subgroupCode,
  page = 1,
  pageSize = 30,
  mappingStatus = "mapped",
}) {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const baseParams = {
    p_as_of_date: null,
    p_search: searchText || null,
    p_category_code: categoryCode || "all",
    p_subcategory_code: subcategoryCode || "all",
    p_group_code: groupCode || "all",
    p_subgroup_code: subgroupCode || "all",
    p_mapping_status: mappingStatus || "mapped",
  };

  const [dataRes, countRes] = await Promise.all([
    supabase.rpc("fn_rm_rms_stock_filtered", {
      ...baseParams,
      p_limit: limit,
      p_offset: offset,
    }),
    supabase.rpc("fn_rm_rms_stock_filtered_count", baseParams),
  ]);

  if (dataRes.error) return { error: handleSupabaseError(dataRes.error) };
  if (countRes.error) return { error: handleSupabaseError(countRes.error) };

  let count = 0;
  const cd = countRes.data;
  if (typeof cd === "number") {
    count = cd;
  } else if (Array.isArray(cd) && cd.length && cd[0].count !== undefined) {
    count = Number(cd[0].count) || 0;
  } else if (Array.isArray(cd) && cd.length && typeof cd[0] === "number") {
    count = Number(cd[0]) || 0;
  }

  return { data: dataRes.data || [], count };
}

function rmReceivingRowHtml(row) {
  const classLabel = formatClassification(row);
  return `<tr>
      <td style="vertical-align:middle;text-align:center;white-space:nowrap">${row.as_of_date ?? "–"}</td>
      <td style="vertical-align:middle;text-align:left">${row.tally_item_name ?? "–"}</td>
      <td style="vertical-align:middle;text-align:center">${row.code ?? "–"}</td>
      <td style="vertical-align:middle;text-align:left">${row.name ?? "–"}</td>
      <td style="vertical-align:middle;text-align:center">${classLabel}</td>
      <td style="vertical-align:middle;text-align:right">${formatIndianNumber(row.qty_value)}</td>
      <td style="vertical-align:middle;text-align:right">${formatCurrencyINR(row.rate_value)}</td>
      <td style="vertical-align:middle;text-align:right">${formatCurrencyINR(row.stock_value)}</td>
    </tr>`;
}

function mountRmReceivingCopyAction() {
  try {
    const existing = document.getElementById("rmHeaderActions");
    if (existing) existing.remove();
    const host = document.getElementById("tableHeaderActions");
    if (!host) return;
    host.innerHTML = "";
    const actionsDiv = document.createElement("div");
    actionsDiv.id = "rmHeaderActions";
    const btn = document.createElement("button");
    btn.id = "copyRmReceivingRowsBtn";
    btn.type = "button";
    btn.className = "rm-copy-btn";
    btn.title = "Copy RM Receiving Stock";
    btn.setAttribute("aria-label", "Copy RM Receiving Stock");
    btn.innerHTML = iconHtml("document", 16);
    actionsDiv.appendChild(btn);
    host.appendChild(actionsDiv);
    btn.addEventListener("click", copyRmReceivingRows);
    syncTableHeaderBarVisibility();
  } catch (err) {
    console.debug(err);
  }
}

function clearTableHeaderActions() {
  const host = document.getElementById("tableHeaderActions");
  if (host) host.innerHTML = "";
  const existing = document.getElementById("rmHeaderActions");
  if (existing) existing.remove();
  syncTableHeaderBarVisibility();
}

function renderRmReceivingStockTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) {
      LAST_RM_RECEIVING_ROWS = [];
      LAST_ACTIVE_ROWS = [];
      LAST_RM_RECEIVING_TOTAL = 0;
      LAST_RM_RECEIVING_AS_OF_DATE = null;
      LAST_RM_RECEIVING_INSERTED_AT = null;
      updateTableContextMeta(
        "Stock Stage: Receiving · Godown: Warehouse No.2 (RMS)",
      );
      clearTableHeaderActions();
      return renderNoData();
    }
    LAST_RM_RECEIVING_AS_OF_DATE = rows[0]?.as_of_date || null;
    LAST_RM_RECEIVING_INSERTED_AT = rows[0]?.inserted_at || null;
    updateTableContextMeta(
      "Stock Stage: Receiving · Godown: Warehouse No.2 (RMS)",
    );
    tableArea.innerHTML = `<table><thead><tr>
    <th style="vertical-align:middle;text-align:center">Date</th>
    <th style="vertical-align:middle;text-align:left">Tally Item Name</th>
    <th style="vertical-align:middle;text-align:center">Code</th>
    <th style="vertical-align:middle;text-align:left">Name</th>
    <th style="vertical-align:middle;text-align:center">Classification</th>
    <th style="vertical-align:middle;text-align:right">Qty</th>
    <th style="vertical-align:middle;text-align:right">Rate</th>
    <th style="vertical-align:middle;text-align:right">Stock Value</th>
  </tr></thead><tbody>${rows.map(rmReceivingRowHtml).join("")}</tbody></table>`;
    LAST_RM_RECEIVING_ROWS = [...rows];
    LAST_ACTIVE_ROWS = [...rows];
    syncSpeCards(rows, { append: false, startIndex: 0 });
    mountRmReceivingCopyAction();
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody)
      return renderRmReceivingStockTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML(
      "beforeend",
      rows.map(rmReceivingRowHtml).join(""),
    );
    const startIndex = LAST_ACTIVE_ROWS.length;
    LAST_RM_RECEIVING_ROWS = LAST_RM_RECEIVING_ROWS.concat(rows);
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
    syncSpeCards(rows, { append: true, startIndex });
  }
  LAST_RM_RECEIVING_TOTAL = totalCount || 0;
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
}

async function loadMoreActiveTab() {
  if (state.loadingMore || !state.hasMore) return;
  const tab = state.currentTab;
  const nextPage = getTabPage(tab) + 1;
  state.loadingMore = true;
  updateScrollSentinel("Loading more…");
  const mySeq = _requestSeq;
  try {
    setTabPage(tab, nextPage);
    let res;
    if (tab === "overview") {
      res = await loadOverviewItems({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderOverviewTable(res.data || [], res.count || 0, { append: true });
    } else if (tab === "stock") {
      res = await loadStockSnapshot({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderStockTable(res.data || [], res.count || 0, { append: true });
    } else if (tab === "purchase") {
      res = await loadPurchaseSummary({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        fromDate: state.currentFromDate,
        toDate: state.currentToDate,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderPurchaseSummaryTable(res.data || [], res.count || 0, {
        append: true,
      });
    } else if (tab === "consumption") {
      res = await loadConsumptionSummary({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        fromDate: state.currentFromDate,
        toDate: state.currentToDate,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderConsumptionTable(res.data || [], res.count || 0, { append: true });
    } else if (tab === "rm-receiving-stock") {
      res = await loadRmReceivingStock({
        searchText: state.currentSearchText,
        categoryCode: state.currentCategoryCode,
        subcategoryCode: state.currentSubcategoryCode,
        groupCode: state.currentGroupCode,
        subgroupCode: state.currentSubgroupCode,
        page: nextPage,
        pageSize: state.pageSize,
        mappingStatus: "mapped",
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderRmReceivingStockTable(res.data || [], res.count || 0, {
        append: true,
      });
    }
  } catch (err) {
    setTabPage(tab, Math.max(1, nextPage - 1));
    showStatusToast(
      err?.userMessage || err?.message || "Failed to load more rows",
      "error",
      4000,
    );
    updateScrollSentinel();
  } finally {
    state.loadingMore = false;
    updateScrollSentinel();
  }
}

function isNearScrollBottom(el) {
  if (!el) return false;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
}

let __speInfiniteScrollWired = false;
function wireInfiniteScroll() {
  if (__speInfiniteScrollWired) return;
  __speInfiniteScrollWired = true;
  const onScroll = (el) => {
    if (state.loadingMore || !state.hasMore) return;
    if (isNearScrollBottom(el)) void loadMoreActiveTab();
  };
  if (tableArea) {
    tableArea.addEventListener(
      "scroll",
      () => onScroll(tableArea),
      { passive: true },
    );
  }
  if (speCardsWrap) {
    speCardsWrap.addEventListener(
      "scroll",
      () => onScroll(speCardsWrap),
      { passive: true },
    );
  }
}

function wireResultsPresentationMode() {
  applyResultsPresentationMode();
  const mq = window.matchMedia("(max-width: 520px)");
  const onChange = () => applyResultsPresentationMode();
  if (typeof mq.addEventListener === "function")
    mq.addEventListener("change", onChange);
  else if (typeof mq.addListener === "function") mq.addListener(onChange);
}

// Adjust the table card height so it fits within the viewport and provides
// a dedicated vertical scrollbar for the table area. This keeps the rest of
// the page static while the table can scroll internally when rows exceed
// the visible area (depending on `pageSize`).
function adjustTableCardHeight() {
  if (!tableCard) return;
  // compute distance from top of viewport to top of card
  const rect = tableCard.getBoundingClientRect();
  const top = rect.top;
  // reserve a small bottom gap so the card doesn't touch the viewport edge
  const bottomGap = 20;
  // compute available height
  let avail = Math.max(320, window.innerHeight - top - bottomGap);
  // avoid making card taller than viewport minus a header allowance
  const maxAllow = Math.max(360, window.innerHeight - 120);
  if (avail > maxAllow) avail = maxAllow;
  tableCard.style.height = avail + "px";
  // ensure tableArea uses internal scrolling (it already has overflow:auto). Keep a small reflow.
  if (tableArea) {
    tableArea.style.minHeight = "0";
    tableArea.style.flex = "1 1 auto";
  }
  if (speCardsWrap) {
    speCardsWrap.style.minHeight = "0";
    speCardsWrap.style.flex = "1 1 auto";
  }
  // After sizing the table card, ensure page-level overflow is correct
  try {
    adjustPageOverflow();
  } catch {
    /* ignore */
  }
}

// Compute whether the overall `.page` container needs a scrollbar. We prefer
// to keep the page free of scrollbars when all content fits; when content
// exceeds the viewport we let the page scroll. This function measures the
// page and decides whether to allow page scrolling.
function adjustPageOverflow() {
  const page = document.querySelector(".page");
  if (!page) return;
  // Use a more robust measurement to decide if the overall page needs a
  // scrollbar. Consider the page's top offset and prefer hiding the root
  // and body scrollbar when content fits the viewport. Use a slightly
  // larger tolerance to avoid 1px rounding artefacts in Chromium/Electron.
  // Larger tolerance to handle Chromium rounding and small layout shifts
  const tolerance = 24; // pixels
  const dbg =
    (typeof window !== "undefined" && window.__dbgOverflow === true) ||
    (typeof location !== "undefined" &&
      String(location.search).indexOf("dbgOverflow=1") !== -1);
  try {
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const pageTop = page.getBoundingClientRect().top || 0;
    const effectiveContentHeight = (page.scrollHeight || 0) + pageTop;

    const contentFits = effectiveContentHeight <= viewportHeight + tolerance;
    if (dbg) {
      console.debug("adjustPageOverflow:", {
        pageTop,
        pageScrollHeight: page.scrollHeight,
        viewportHeight,
        effectiveContentHeight,
        tolerance,
        contentFits,
        docOverflowY: document.documentElement.style.overflowY,
        bodyOverflowY:
          document.body && document.body.style
            ? document.body.style.overflowY
            : undefined,
      });
    }

    // When content fits, hide both root and body scrollbars to avoid the
    // persistent gutter; otherwise allow normal scrolling.
    if (contentFits) {
      document.documentElement.style.overflowY = "hidden";
      if (document.body) document.body.style.overflowY = "hidden";
      page.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflowY = "";
      if (document.body) document.body.style.overflowY = "";
      page.style.overflow = "";
    }
  } catch (err) {
    if (dbg) console.debug("adjustPageOverflow fallback error", err);
    // Fallback to a simple check on any unexpected failure.
    const simpleTolerance = 6;
    const contentHeight = page.scrollHeight || 0;
    if (contentHeight <= window.innerHeight + simpleTolerance) {
      document.documentElement.style.overflowY = "hidden";
      if (document.body) document.body.style.overflowY = "hidden";
      page.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflowY = "";
      if (document.body) document.body.style.overflowY = "";
      page.style.overflow = "";
    }
  }
}

// Debounced resize handler to avoid thrashing on window resize
let _resizeTimer = null;
window.addEventListener("resize", () => {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    adjustTableCardHeight();
  }, 120);
});

// Ensure card height is set after each reload (layout may shift) and on init
// We call adjustTableCardHeight() at the end of `reloadActiveTab` instead
// of wrapping it to avoid reassigning the function reference.

async function loadAndRenderPurchaseDetail(invStockItemId) {
  // show modal with loading
  openDetailModal('<div class="loading">Loading…</div>');
  const { data, error } = await loadPurchaseDetails({
    invStockItemId,
    fromDate: state.currentFromDate,
    toDate: state.currentToDate,
  });
  if (error) {
    const errMsg =
      error.userMessage || error.message || "Failed to load purchase history";
    showStatusToast(errMsg, "error", 4000);
    return (modalContent.innerHTML = `<div class="error">${errMsg}</div>`);
  }
  if (!data || !data.length)
    return (modalContent.innerHTML =
      '<div class="no-data">No purchase history found.</div>');
  let html = `<h3 class="spe-modal-title">Purchase History</h3>
    <div class="modal-table-wrap">
      <table class="erp-table">
        <thead><tr>
          <th class="col-date">Date</th>
          <th class="col-text">Supplier</th>
          <th class="col-text">Godown</th>
          <th class="numeric">Qty</th>
          <th class="numeric">Rate</th>
          <th class="numeric">Billed Amount</th>
        </tr></thead>
  <tbody>`;
  data.forEach((row) => {
    html += `<tr>
      <td class="col-date">${row.voucher_date ?? "–"}</td>
      <td class="col-text">${row.supplier_name ?? "–"}</td>
      <td class="col-text">${row.godown_label ?? "–"}</td>
      <td class="numeric">${formatIndianNumber(row.canonical_qty_value)}</td>
      <td class="numeric">${formatCurrencyINR(row.avg_rate_value)}</td>
      <td class="numeric">${formatCurrencyINR(row.billed_amount_value)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  modalContent.innerHTML = html;
}

// Main tab reload logic
async function reloadActiveTab(preselectId) {
  // Stale-result guard: capture sequence before going async; discard results
  // if a newer request has been started before this one resolves.
  const mySeq = ++_requestSeq;
  resetPages();
  state.loadingMore = false;
  state.hasMore = false;
  renderLoading();
  // ensure modal closed
  closeDetailModal();
  state.selectedItemId = preselectId || null;
  // sync tab button UI with current state (does NOT reset currentTab)
  setActiveTab(state.currentTab);
  if (state.currentTab !== "rm-receiving-stock") {
    updateTableContextMeta("");
    clearTableHeaderActions();
  }
  if (state.currentTab === "overview") {
    const res = await loadOverviewItems({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      page: state.pageOverview,
      pageSize: state.pageSize,
    });
    if (mySeq !== _requestSeq) {
      setBusy(false);
      return;
    }
    if (res.error) {
      showStatusToast(
        res.error.userMessage || res.error.message || "Error loading data",
        "error",
        4000,
      );
      return renderError(res.error.userMessage || res.error.message);
    }
    renderOverviewTable(res.data, res.count || 0);
    LAST_ACTIVE_ROWS = res.data || [];
    // Do not auto-open the overview item modal on reload. Selection/highlight
    // is preserved in `state.selectedItemId`, but the in-page modal will not
    // be shown for overview rows per user preference.
  } else if (state.currentTab === "stock") {
    const res = await loadStockSnapshot({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      page: state.pageStock,
      pageSize: state.pageSize,
    });
    if (mySeq !== _requestSeq) {
      setBusy(false);
      return;
    }
    if (res.error) {
      showStatusToast(
        res.error.userMessage || res.error.message || "Error loading data",
        "error",
        4000,
      );
      return renderError(res.error.userMessage || res.error.message);
    }
    renderStockTable(res.data, res.count || 0);
    LAST_ACTIVE_ROWS = res.data || [];
  } else if (state.currentTab === "purchase") {
    const res = await loadPurchaseSummary({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      fromDate: state.currentFromDate,
      toDate: state.currentToDate,
      page: state.pagePurchase,
      pageSize: state.pageSize,
    });
    if (mySeq !== _requestSeq) {
      setBusy(false);
      return;
    }
    if (res.error) {
      showStatusToast(
        res.error.userMessage || res.error.message || "Error loading data",
        "error",
        4000,
      );
      return renderError(res.error.userMessage || res.error.message);
    }
    renderPurchaseSummaryTable(res.data, res.count || 0);
    LAST_ACTIVE_ROWS = res.data || [];
  } else if (state.currentTab === "consumption") {
    const res = await loadConsumptionSummary({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      fromDate: state.currentFromDate,
      toDate: state.currentToDate,
      page: state.pageConsumption,
      pageSize: state.pageSize,
    });
    if (mySeq !== _requestSeq) {
      setBusy(false);
      return;
    }
    if (res.error) {
      showStatusToast(
        res.error.userMessage || res.error.message || "Error loading data",
        "error",
        4000,
      );
      return renderError(res.error.userMessage || res.error.message);
    }
    renderConsumptionTable(res.data, res.count || 0);
    LAST_ACTIVE_ROWS = res.data || [];
  } else if (state.currentTab === "rm-receiving-stock") {
    const res = await loadRmReceivingStock({
      searchText: state.currentSearchText,
      categoryCode: state.currentCategoryCode,
      subcategoryCode: state.currentSubcategoryCode,
      groupCode: state.currentGroupCode,
      subgroupCode: state.currentSubgroupCode,
      page: state.pageRmReceivingStock,
      pageSize: state.pageSize,
      mappingStatus: "mapped",
    });
    if (mySeq !== _requestSeq) {
      setBusy(false);
      return;
    }
    if (res.error) {
      showStatusToast(
        res.error.userMessage || res.error.message || "Error loading data",
        "error",
        4000,
      );
      return renderError(res.error.userMessage || res.error.message);
    }
    renderRmReceivingStockTable(res.data || [], res.count || 0);
  }
  // table area uses CSS flex + internal scrolling; pagination controlled by page-size selector
  // Refresh stock value chip (fire-and-forget) respecting current filters
  refreshStockValueChip().catch((err) =>
    console.warn("Stock value chip refresh failed", err),
  );
  try {
    adjustTableCardHeight();
  } catch {
    /* ignore */
  }
  updateFiltersBtnActive();
}

// Initial load: populate classification selects then load the active tab
loadClassificationOptions()
  .catch((err) => console.error("Failed to load classification options", err))
  .finally(async () => {
    // Ensure initial render and sizing run after layout stabilizes.
    try {
      wireInfiniteScroll();
      wireSpeCardClicks();
      wireResultsPresentationMode();
      await reloadActiveTab();
    } catch {
      // ignore
    }
    // run sizing in next paint frames to avoid 1px layout jitter in Chromium
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          adjustTableCardHeight();
        } catch {
          /* ignore */
        }
      });
    });
    // fallback retry in case fonts/images or other resources change layout
    setTimeout(() => {
      try {
        adjustTableCardHeight();
      } catch {
        /* ignore */
      }
    }, 120);
  });

updateFiltersBtnActive();

refreshStockValueChip().catch((err) =>
  console.warn("Initial stock value refresh failed", err),
);

// Comments:
// - All data queries use Supabase and follow the same pattern as WIP Stock.
// - Filters and tab state are managed in JS state.
// - Tables and side panels are fully re-rendered on state change.
// - Error and loading states are handled inline.
// - Code is modular and commented for maintainability.
