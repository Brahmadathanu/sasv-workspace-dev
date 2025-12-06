// js/stock-purchase-explorer.js
/* eslint-env browser */
import { supabase, handleSupabaseError } from "./supabaseClient.js";
import { Platform } from "./platform.js";

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
  pageSize: 30,
};

// DOM references
const homeBtn = document.getElementById("homeBtn");
// JS SNIPPET 2: DOM references including new classification filters
const classificationSelect = document.getElementById("classification"); // Tally source kind
const categoryFilter = document.getElementById("categoryFilter");
const subcategoryFilter = document.getElementById("subcategoryFilter");
const groupFilter = document.getElementById("groupFilter");
const subgroupFilter = document.getElementById("subgroupFilter");
const filtersCard = document.querySelector(".filters-card");

const searchInput = document.getElementById("search");
const dateRangeInput = document.getElementById("dateRange");
const advToggleBtn = document.getElementById("toggleAdvancedFilters");
const advancedDrawer = document.getElementById("advancedDrawer");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabSelect = document.getElementById("tabSelect");
const tableArea = document.getElementById("tableArea");
const tableCard = document.querySelector(".table-card");
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

// Pagination helpers: reset pages when filters change
function resetPages() {
  state.pageOverview = 1;
  state.pageStock = 1;
  state.pagePurchase = 1;
  state.pageConsumption = 1;
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
      resetPages();
      // Reload the active tab so all tab tables respect the selected date range
      reloadActiveTab();
    },
  });
}

// Event listeners
if (homeBtn) homeBtn.onclick = () => Platform.goHome();
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

classificationSelect.addEventListener("change", async () => {
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
        (o) => o.value === mapped
      );
      if (opt) {
        categoryFilter.value = mapped;
        state.currentCategoryCode = mapped;
        populateSubcategoriesForCategory(mapped);
        showAutoSelectHint();
      }
    }
  }
  resetPages();
  reloadActiveTab();
});

if (categoryFilter) {
  categoryFilter.addEventListener("change", () => {
    resetPages();
    state.currentCategoryCode = categoryFilter.value || "all";
    reloadActiveTab();
  });
}
if (subcategoryFilter) {
  subcategoryFilter.addEventListener("change", () => {
    resetPages();
    state.currentSubcategoryCode = subcategoryFilter.value || "all";
    reloadActiveTab();
  });
}
if (groupFilter) {
  groupFilter.addEventListener("change", () => {
    resetPages();
    state.currentGroupCode = groupFilter.value || "all";
    reloadActiveTab();
  });
}
if (subgroupFilter) {
  subgroupFilter.addEventListener("change", () => {
    resetPages();
    state.currentSubgroupCode = subgroupFilter.value || "all";
    reloadActiveTab();
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
    reloadActiveTab();
  });
}

// Advanced drawer toggle
if (advToggleBtn && advancedDrawer) {
  function setAdvancedOpen(open) {
    if (!advancedDrawer) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 520;

    if (open) {
      advancedDrawer.classList.add("open");
      advancedDrawer.setAttribute("aria-hidden", "false");
      if (advToggleBtn) {
        advToggleBtn.setAttribute("aria-expanded", "true");
        advToggleBtn.classList.add("open");
      }
      // Force a reflow on mobile to ensure proper rendering
      if (isMobile) {
        void advancedDrawer.offsetHeight;
      }
      const first = advancedDrawer.querySelector("select, input, button");
      if (first && typeof first.focus === "function") first.focus();
    } else {
      advancedDrawer.classList.remove("open");
      advancedDrawer.setAttribute("aria-hidden", "true");
      if (advToggleBtn) {
        advToggleBtn.setAttribute("aria-expanded", "false");
        advToggleBtn.classList.remove("open");
      }
    }
    // On wider screens (not the mobile slide-down mode) expand/collapse the
    // whole filters card. For mobile (<=520px) the advanced drawer should
    // always be accessible when the main drawer is open.
    try {
      if (
        window &&
        window.innerWidth &&
        window.innerWidth > 520 &&
        filtersCard
      ) {
        filtersCard.classList.toggle("expanded", open);
      }
    } catch {
      /* ignore */
    }
    // Recalculate table card height when advanced drawer changes visibility
    try {
      adjustTableCardHeight();
    } catch {
      /* ignore if function not yet defined */
    }
  }

  advToggleBtn.addEventListener("click", () => {
    const isOpen = advancedDrawer.classList.contains("open");
    setAdvancedOpen(!isOpen);
  });
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
              }</option>`
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
      err
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
          `<option value="${s.code}">${s.code} — ${s.label || s.code}</option>`
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
    (g) => String(g.subcategory_id) === String(sub.id)
  );
  groupFilter.innerHTML =
    `<option value="all">(All groups)</option>` +
    grps
      .map(
        (g) =>
          `<option value="${g.code}">${g.code} — ${g.label || g.code}</option>`
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
          `<option value="${s.code}">${s.code} — ${s.label || s.code}</option>`
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
    (f) => f.offsetParent !== null
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

// Mobile filters modal focus trap helpers
let _mobileModalFocusable = [];
function _trapTabHandlerMobile(e) {
  if (!mobileFiltersModal || !mobileFiltersModal.classList.contains("open"))
    return;
  if (e.key !== "Tab") return;
  if (!_mobileModalFocusable || !_mobileModalFocusable.length) return;
  const first = _mobileModalFocusable[0];
  const last = _mobileModalFocusable[_mobileModalFocusable.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || active === mobileFiltersModal) {
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

function _maintainFocusMobile(e) {
  if (!mobileFiltersModal || !mobileFiltersModal.classList.contains("open"))
    return;
  if (mobileFiltersModal.contains(e.target)) return;
  e.stopPropagation();
  if (mobileFiltersClose) mobileFiltersClose.focus();
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
      (el) => !exceptionEls.some((ex) => ex && ex.contains && ex.contains(el))
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

// Mobile filters modal elements
const mobileFiltersBtn = document.getElementById("mobileFiltersBtn");
const mobileFiltersModal = document.getElementById("mobileFiltersModal");
const mobileFiltersClose = document.getElementById("mobileFiltersClose");
const mobileFiltersContent = document.getElementById("mobileFiltersContent");
const mobileFiltersApply = document.getElementById("mobileFiltersApply");
const mobileFiltersReset = document.getElementById("mobileFiltersReset");
const mobileSearch = document.getElementById("mobileSearch");

// Debug: Check if close button is found
console.log("mobileFiltersClose element:", mobileFiltersClose);

// Store original filter values for comparison
let _mobileFilterValues = {
  sourceKind: "all",
  search: "",
  dateRange: "",
  categoryCode: "all",
  subcategoryCode: "all",
  groupCode: "all",
  subgroupCode: "all",
};

function openMobileFiltersModal() {
  if (!mobileFiltersModal) {
    console.error("mobileFiltersModal not found!");
    return;
  }

  console.log("Opening mobile filters modal...");
  // Build the mobile filters modal HTML
  _mobileFilterValues = {
    sourceKind: state.currentSourceKind || "all",
    search: state.currentSearchText || "",
    dateRange:
      (state.currentFromDate &&
        state.currentToDate &&
        `${state.currentFromDate} to ${state.currentToDate}`) ||
      state.currentFromDate ||
      state.currentToDate ||
      "",
    categoryCode: state.currentCategoryCode || "all",
    subcategoryCode: state.currentSubcategoryCode || "all",
    groupCode: state.currentGroupCode || "all",
    subgroupCode: state.currentSubgroupCode || "all",
  };

  const html = `
    <div class="filters-section">
      <h4>Primary Filters</h4>
      <div class="filter-row">
        <label for="mobileSourceKind">Source Kind</label>
        <select id="mobileSourceKind">
          <option value="all">(All)</option>
          <option value="rm">rm</option>
          <option value="plm">plm</option>
          <option value="consumable">consumable</option>
          <option value="fuel">fuel</option>
        </select>
      </div>

      <div class="filter-row">
        <label for="mobileSearchInput">Search</label>
        <input id="mobileSearchInput" type="search" placeholder="Code or name" value="${_mobileFilterValues.search}">
      </div>

      <div class="filter-row">
        <label for="mobileDateRange">Date Range</label>
        <input type="text" id="mobileDateRange" placeholder="Select date range" value="${_mobileFilterValues.dateRange}">
      </div>
    </div>

    <div class="filters-section">
      <h4>Classification Filters</h4>
      <div class="filter-row">
        <label for="mobileCategoryFilter">Category</label>
        <select id="mobileCategoryFilter">
          <option value="all">(All categories)</option>
        </select>
      </div>
      <div class="filter-row">
        <label for="mobileSubcategoryFilter">Sub-category</label>
        <select id="mobileSubcategoryFilter">
          <option value="all">(All sub-categories)</option>
        </select>
      </div>
      <div class="filter-row">
        <label for="mobileGroupFilter">Group</label>
        <select id="mobileGroupFilter">
          <option value="all">(All groups)</option>
        </select>
      </div>
      <div class="filter-row">
        <label for="mobileSubgroupFilter">Sub-group</label>
        <select id="mobileSubgroupFilter">
          <option value="all">(All sub-groups)</option>
        </select>
      </div>
    </div>
  `;
  mobileFiltersContent.innerHTML = html;

  // Set current values
  const mobileSourceKind = document.getElementById("mobileSourceKind");
  const mobileDateRange = document.getElementById("mobileDateRange");
  const mobileCategoryFilter = document.getElementById("mobileCategoryFilter");

  if (mobileSourceKind) mobileSourceKind.value = _mobileFilterValues.sourceKind;

  // Populate category options if available
  if (mobileCategoryFilter && cacheCat && cacheCat.length) {
    mobileCategoryFilter.innerHTML =
      `<option value="all">(All categories)</option>` +
      cacheCat
        .map(
          (c) =>
            `<option value="${c.code}">${c.code} — ${
              c.label || c.code
            }</option>`
        )
        .join("");
    mobileCategoryFilter.value = _mobileFilterValues.categoryCode;
  }

  // Set up date picker for mobile date range if flatpickr is available
  if (mobileDateRange && window.flatpickr) {
    window.flatpickr(mobileDateRange, {
      mode: "range",
      dateFormat: "d-m-Y",
      allowInput: true,
    });
  }

  // Open the modal and make background inert for accessibility
  try {
    _lastActiveElement = document.activeElement;
    mobileFiltersModal.classList.add("open");
    mobileFiltersModal.setAttribute("aria-hidden", "false");
    setBackgroundInert(true, [mobileFiltersModal]);

    // compute and store focusable elements for the mobile modal
    _mobileModalFocusable = _getFocusable(mobileFiltersModal);
    if (
      _mobileModalFocusable &&
      _mobileModalFocusable.length &&
      typeof _mobileModalFocusable[0].focus === "function"
    ) {
      _mobileModalFocusable[0].focus();
    } else if (
      mobileFiltersClose &&
      typeof mobileFiltersClose.focus === "function"
    ) {
      mobileFiltersClose.focus();
    }

    // attach focus-trap handlers for the mobile modal
    document.addEventListener("focus", _maintainFocusMobile, true);
    document.addEventListener("keydown", _trapTabHandlerMobile);
  } catch {
    /* ignore errors opening modal */
  }
}

function closeMobileFiltersModal() {
  if (!mobileFiltersModal) return;
  // remove focus-trap handlers first
  try {
    document.removeEventListener("focus", _maintainFocusMobile, true);
    document.removeEventListener("keydown", _trapTabHandlerMobile);
  } catch {
    /* ignore */
  }
  _mobileModalFocusable = [];

  mobileFiltersModal.classList.remove("open");
  mobileFiltersModal.setAttribute("aria-hidden", "true");
  // restore page accessibility
  try {
    setBackgroundInert(false);
  } catch {
    /* ignore */
  }
  // restore focus to open button
  try {
    if (mobileFiltersBtn && typeof mobileFiltersBtn.focus === "function")
      mobileFiltersBtn.focus();
  } catch {
    /* ignore */
  }
}

function applyMobileFilters() {
  // Get values from modal inputs
  const mobileSourceKind = document.getElementById("mobileSourceKind");
  const mobileSearchInput = document.getElementById("mobileSearchInput");
  const mobileDateRange = document.getElementById("mobileDateRange");
  const mobileCategoryFilter = document.getElementById("mobileCategoryFilter");
  const mobileSubcategoryFilter = document.getElementById(
    "mobileSubcategoryFilter"
  );
  const mobileGroupFilter = document.getElementById("mobileGroupFilter");
  const mobileSubgroupFilter = document.getElementById("mobileSubgroupFilter");

  // Update main filter state
  if (mobileSourceKind) {
    state.currentSourceKind = mobileSourceKind.value;
    if (classificationSelect)
      classificationSelect.value = mobileSourceKind.value;
  }

  if (mobileSearchInput) {
    state.currentSearchText = mobileSearchInput.value.trim();
    if (searchInput) searchInput.value = mobileSearchInput.value;
    if (mobileSearch) mobileSearch.value = mobileSearchInput.value;
  }

  if (mobileDateRange && dateRangeInput) {
    dateRangeInput.value = mobileDateRange.value;
    // Parse date range for state
    const dateStr = mobileDateRange.value;
    if (dateStr && dateStr.includes(" to ")) {
      const [fromDate, toDate] = dateStr.split(" to ");
      state.currentFromDate = fromDate.trim();
      state.currentToDate = toDate.trim();
    } else {
      state.currentFromDate = "";
      state.currentToDate = "";
    }
  }

  if (mobileCategoryFilter) {
    state.currentCategoryCode = mobileCategoryFilter.value;
    if (categoryFilter) categoryFilter.value = mobileCategoryFilter.value;
  }

  if (mobileSubcategoryFilter) {
    state.currentSubcategoryCode = mobileSubcategoryFilter.value;
    if (subcategoryFilter)
      subcategoryFilter.value = mobileSubcategoryFilter.value;
  }

  if (mobileGroupFilter) {
    state.currentGroupCode = mobileGroupFilter.value;
    if (groupFilter) groupFilter.value = mobileGroupFilter.value;
  }

  if (mobileSubgroupFilter) {
    state.currentSubgroupCode = mobileSubgroupFilter.value;
    if (subgroupFilter) subgroupFilter.value = mobileSubgroupFilter.value;
  }

  // Reset pagination and reload data
  resetPages();
  reloadActiveTab();

  // Update clear button visibility after applying values
  if (typeof toggleMobileClearButton === "function") {
    toggleMobileClearButton();
  }
  if (typeof toggleMainClearButton === "function") {
    toggleMainClearButton();
  }

  // Close modal
  closeMobileFiltersModal();

  // Show confirmation
  showStatusToast("Filters applied", "success", 2000);
}

function resetMobileFilters() {
  // Reset all filter inputs in modal to defaults
  const mobileSourceKind = document.getElementById("mobileSourceKind");
  const mobileSearchInput = document.getElementById("mobileSearchInput");
  const mobileDateRange = document.getElementById("mobileDateRange");
  const mobileCategoryFilter = document.getElementById("mobileCategoryFilter");
  const mobileSubcategoryFilter = document.getElementById(
    "mobileSubcategoryFilter"
  );
  const mobileGroupFilter = document.getElementById("mobileGroupFilter");
  const mobileSubgroupFilter = document.getElementById("mobileSubgroupFilter");

  if (mobileSourceKind) mobileSourceKind.value = "all";
  if (mobileSearchInput) mobileSearchInput.value = "";
  if (mobileDateRange) mobileDateRange.value = "";
  if (mobileCategoryFilter) mobileCategoryFilter.value = "all";
  if (mobileSubcategoryFilter) mobileSubcategoryFilter.value = "all";
  if (mobileGroupFilter) mobileGroupFilter.value = "all";
  if (mobileSubgroupFilter) mobileSubgroupFilter.value = "all";
}

// Reset main (desktop) filters to defaults
function resetFilters() {
  if (classificationSelect) classificationSelect.value = "all";
  if (categoryFilter) categoryFilter.value = "all";
  if (subcategoryFilter) subcategoryFilter.value = "all";
  if (groupFilter) groupFilter.value = "all";
  if (subgroupFilter) subgroupFilter.value = "all";
  if (searchInput) searchInput.value = "";
  if (dateRangeInput) dateRangeInput.value = "";

  // Update canonical state
  state.currentSourceKind = "all";
  state.currentCategoryCode = "all";
  state.currentSubcategoryCode = "all";
  state.currentGroupCode = "all";
  state.currentSubgroupCode = "all";
  state.currentSearchText = "";
  state.currentFromDate = "";
  state.currentToDate = "";

  // Ensure any mobile modal inputs reflect the reset as well
  try {
    const mobileSource = document.getElementById("mobileSourceKind");
    const mobileSearchInput = document.getElementById("mobileSearchInput");
    const mobileDateRange = document.getElementById("mobileDateRange");
    const mobileCategory = document.getElementById("mobileCategoryFilter");
    const mobileSubcategory = document.getElementById(
      "mobileSubcategoryFilter"
    );
    const mobileGroup = document.getElementById("mobileGroupFilter");
    const mobileSubgroup = document.getElementById("mobileSubgroupFilter");
    if (mobileSource) mobileSource.value = "all";
    if (mobileSearchInput) mobileSearchInput.value = "";
    if (mobileDateRange) mobileDateRange.value = "";
    if (mobileCategory) mobileCategory.value = "all";
    if (mobileSubcategory) mobileSubcategory.value = "all";
    if (mobileGroup) mobileGroup.value = "all";
    if (mobileSubgroup) mobileSubgroup.value = "all";
  } catch {
    /* ignore */
  }

  // Close advanced drawer if open
  try {
    if (advancedDrawer && advancedDrawer.classList.contains("open")) {
      advancedDrawer.classList.remove("open");
      advancedDrawer.setAttribute("aria-hidden", "true");
      if (advToggleBtn) {
        advToggleBtn.setAttribute("aria-expanded", "false");
        advToggleBtn.classList.remove("open");
      }
      if (filtersCard) filtersCard.classList.remove("expanded");
    }
  } catch {
    /* ignore */
  }

  // Close mobile filters modal if it's open
  try {
    if (mobileFiltersModal && mobileFiltersModal.classList.contains("open")) {
      closeMobileFiltersModal();
    }
  } catch {
    /* ignore */
  }

  // Reset pagination and reload
  resetPages();
  reloadActiveTab();

  // Update clear button visibility
  if (typeof toggleMainClearButton === "function") toggleMainClearButton();
  if (typeof toggleMobileClearButton === "function") toggleMobileClearButton();

  showStatusToast("Filters reset", "info", 1200);
}

if (mobileFiltersBtn) {
  mobileFiltersBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 520;
    if (isMobile) {
      openMobileFiltersModal();
    } else {
      // On larger screens, toggle the advanced drawer using the existing toggle button
      if (advToggleBtn) {
        advToggleBtn.click();
      }
    }
  });
}

// Mobile filters modal event handlers
if (mobileFiltersClose) {
  mobileFiltersClose.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeMobileFiltersModal();
  });
}

if (mobileFiltersApply) {
  mobileFiltersApply.addEventListener("click", (ev) => {
    ev.preventDefault();
    applyMobileFilters();
  });
}

if (mobileFiltersReset) {
  mobileFiltersReset.addEventListener("click", (ev) => {
    ev.preventDefault();
    resetMobileFilters();
  });
}

// Wire desktop Reset button
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    resetFilters();
  });
}

// Close modal when clicking backdrop
if (mobileFiltersModal) {
  mobileFiltersModal.addEventListener("click", (ev) => {
    if (ev.target === mobileFiltersModal) {
      closeMobileFiltersModal();
    }
  });
}

// Close modal on escape key
document.addEventListener("keydown", (ev) => {
  if (
    ev.key === "Escape" &&
    mobileFiltersModal &&
    mobileFiltersModal.classList.contains("open")
  ) {
    closeMobileFiltersModal();
  }
});

// Sync mobile search with main search input (two-way)
if (mobileSearch && searchInput) {
  // initialize
  mobileSearch.value = searchInput.value || "";
  mobileSearch.addEventListener("input", () => {
    searchInput.value = mobileSearch.value;
    // Update state immediately to keep UI in sync
    resetPages();
    state.currentSearchText = searchInput.value.trim();
    // Use the same debounce timer as main search to coordinate loading
    if (_searchDebounceTimer) {
      clearTimeout(_searchDebounceTimer);
    }
    _searchDebounceTimer = setTimeout(() => {
      _searchDebounceTimer = null;
      reloadActiveTab();
    }, 500);
  });
  // keep mobileSearch updated when main search changes (e.g., reset)
  searchInput.addEventListener("input", () => {
    if (mobileSearch.value !== searchInput.value)
      mobileSearch.value = searchInput.value;
  });
}

// Main search clear button functionality
const searchClear = document.getElementById("searchClear");
let toggleMainClearButton; // Declare function in outer scope
if (searchInput && searchClear) {
  // Show/hide clear button based on input content
  toggleMainClearButton = function () {
    if (searchInput.value.trim()) {
      searchClear.style.display = "flex";
    } else {
      searchClear.style.display = "none";
    }
  };

  // Initialize clear button visibility
  toggleMainClearButton();

  // Listen for input changes to show/hide clear button
  searchInput.addEventListener("input", toggleMainClearButton);

  // Clear button click handler
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    // Sync with mobile search
    if (mobileSearch) {
      mobileSearch.value = "";
    }
    // Update state and reload
    resetPages();
    state.currentSearchText = "";
    toggleMainClearButton();
    // Also update mobile clear button visibility if it exists
    if (mobileSearchClear && typeof toggleMobileClearButton === "function") {
      toggleMobileClearButton();
    }
    reloadActiveTab();
  });
}

// Mobile search clear button functionality
const mobileSearchClear = document.getElementById("mobileSearchClear");
let toggleMobileClearButton; // Declare function in outer scope
if (mobileSearch && mobileSearchClear) {
  // Show/hide clear button based on input content
  toggleMobileClearButton = function () {
    if (mobileSearch.value.trim()) {
      mobileSearchClear.style.display = "flex";
    } else {
      mobileSearchClear.style.display = "none";
    }
  };

  // Initialize clear button visibility
  toggleMobileClearButton();

  // Listen for input changes to show/hide clear button
  mobileSearch.addEventListener("input", toggleMobileClearButton);

  // Clear button click handler
  mobileSearchClear.addEventListener("click", () => {
    mobileSearch.value = "";
    mobileSearch.focus();
    // Sync with main search
    if (searchInput) {
      searchInput.value = "";
    }
    // Update state and reload
    resetPages();
    state.currentSearchText = "";
    toggleMobileClearButton();
    // Also update main clear button visibility if it exists
    if (searchClear && typeof toggleMainClearButton === "function") {
      toggleMainClearButton();
    }
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
    rpcParams
  );
  if (error) return { error: handleSupabaseError(error) };

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
        `name.ilike.%${searchText}%,code.ilike.%${searchText}%`
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
    rpcParams
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
    rpcParams
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
    rpcParams
  );
  if (error) {
    console.warn(
      "fn_consumption_summary_filtered RPC error, falling back to client aggregation:",
      error
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
      }
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
      `inv_stock_item_id,month_start_date,total_consumed_qty,rm_pm_issue_qty,consumable_out_qty,source_kind`
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
    .select("id,code,name,source_kind")
    .in("id", ids);
  if (itemsErr) return { error: handleSupabaseError(itemsErr) };

  const itemMap = new Map((items || []).map((it) => [it.id, it]));

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
        (r.code || "").toLowerCase().includes(lower)
    );
  }

  // Apply classification filters client-side since the monthly view lacks
  // classification columns in some deployments.
  if (state.currentCategoryCode && state.currentCategoryCode !== "all") {
    summaries = summaries.filter(
      (r) => r.category_code === state.currentCategoryCode
    );
  }
  if (state.currentSubcategoryCode && state.currentSubcategoryCode !== "all") {
    summaries = summaries.filter(
      (r) => r.subcategory_code === state.currentSubcategoryCode
    );
  }
  if (state.currentGroupCode && state.currentGroupCode !== "all") {
    summaries = summaries.filter(
      (r) => r.group_code === state.currentGroupCode
    );
  }
  if (state.currentSubgroupCode && state.currentSubgroupCode !== "all") {
    summaries = summaries.filter(
      (r) => r.subgroup_code === state.currentSubgroupCode
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

// Rendering functions
function renderLoading() {
  // Use the full-page loading mask for ERP parity; avoid duplicate inline loader
  tableArea.innerHTML = "";
  showLoadingMask();
}
function renderError(msg) {
  tableArea.innerHTML = `<div class="error">${msg}</div>`;
  hideLoadingMask();
}
function renderNoData() {
  tableArea.innerHTML = '<div class="no-data">No data found.</div>';
  hideLoadingMask();
  const p = document.getElementById("paginator");
  if (p) p.innerHTML = "";
}

// Page-wide ERP-style loading mask (blur + message). Uses setBackgroundInert but avoids interfering when modal is open.
let _loadingMaskEl = null;
function showLoadingMask() {
  if (_loadingMaskEl) return;
  // Create structure matching ERP pages: <div class="screen-mask"><div class="mask-box"><div class="spinner"></div><div id="pageMaskText">Loading…</div></div></div>
  _loadingMaskEl = document.createElement("div");
  _loadingMaskEl.className = "screen-mask open";
  _loadingMaskEl.setAttribute("aria-live", "polite");
  _loadingMaskEl.setAttribute("aria-busy", "true");

  const maskBox = document.createElement("div");
  maskBox.className = "mask-box";

  const spinner = document.createElement("div");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");

  const txt = document.createElement("div");
  txt.id = "pageMaskText";
  txt.textContent = "Loading…";

  maskBox.appendChild(spinner);
  maskBox.appendChild(txt);
  _loadingMaskEl.appendChild(maskBox);
  document.body.appendChild(_loadingMaskEl);
  // make background inert unless modal or drawer is open
  try {
    const activeModal = modalOverlay && modalOverlay.classList.contains("open");
    const activeDrawer = filtersCard && filtersCard.classList.contains("open");

    if (activeModal) {
      setBackgroundInert(true, [modalOverlay]);
    } else if (activeDrawer) {
      // Keep entire filters card and its children interactive during loading
      setBackgroundInert(true, [filtersCard]);
    } else {
      setBackgroundInert(true);
    }
  } catch (err) {
    void err;
  }
}

function hideLoadingMask() {
  if (!_loadingMaskEl) return;
  _loadingMaskEl.remove();
  _loadingMaskEl = null;
  // restore background inert only if modal is not open
  if (!(modalOverlay && modalOverlay.classList.contains("open"))) {
    setBackgroundInert(false);
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

function renderOverviewTable(rows) {
  // rows: array, totalCount passed via second arg when available
  const totalCount = arguments[1] || 0;
  if (!rows || !rows.length) return renderNoData();
  let html = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Current Stock Qty</th>
    <th style="vertical-align:middle; text-align:center">Current Stock Rate</th>
    <th style="vertical-align:middle; text-align:center">Total Purchased Qty</th>
    <th style="vertical-align:middle; text-align:center">Avg Purchase Rate</th>
      <th style="vertical-align:middle; text-align:center">Total Consumed Qty</th>
      <th style="vertical-align:middle; text-align:center">Usage Months</th>
      <th style="vertical-align:middle; text-align:center">Last Purchase Date</th>
  </tr></thead><tbody>`;
  rows.forEach((row) => {
    html += `<tr data-id="${row.inv_stock_item_id}"${
      row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
    }>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(
        row
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.current_stock_qty
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(
        row.current_stock_rate
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.total_purchased_qty
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(
        row.avg_purchase_rate
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.total_consumed_qty
      )}</td>
      <td style="vertical-align:middle; text-align:center">${
        row.months_with_usage ?? "–"
      }</td>
      <td style="vertical-align:middle; text-align:center">${
        row.last_purchase_date ?? "–"
      }</td>
    </tr>`;
  });
  html += "</tbody></table>";
  tableArea.innerHTML = html;
  hideLoadingMask();
  // render paginator
  renderPaginator(totalCount, state.pageOverview, state.pageSize, "overview");
  // Row click
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      // Select/highlight the clicked row but do not open the detail modal.
      // The user requested no in-page modal for overview row clicks.
      state.selectedItemId = tr.getAttribute("data-id");
      renderOverviewTable(rows); // re-render to apply 'selected' class
    });
  });
}

// side-panel removed; modal used for details.

function renderStockTable(rows) {
  const totalCount = arguments[1] || 0;
  if (!rows || !rows.length) return renderNoData();
  let html = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Current Stock</th>
    <th style="vertical-align:middle; text-align:center">Valuation Rate</th>
  </tr></thead><tbody>`;
  rows.forEach((row) => {
    html += `<tr>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(
        row
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.qty_value
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(
        row.avg_rate_value
      )}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  tableArea.innerHTML = html;
  hideLoadingMask();
  renderPaginator(totalCount, state.pageStock, state.pageSize, "stock");
}

function renderPurchaseSummaryTable(rows) {
  const totalCount = arguments[1] || 0;
  if (!rows || !rows.length) return renderNoData();
  let html = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Total Purchased Qty</th>
    <th style="vertical-align:middle; text-align:center">Avg Purchase Rate</th>
    <th style="vertical-align:middle; text-align:center">Last Purchase Date</th>
    <th style="vertical-align:middle; text-align:center">Transactions</th>
  </tr></thead><tbody>`;
  rows.forEach((row) => {
    html += `<tr data-id="${row.inv_stock_item_id}"${
      row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
    }>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(
        row
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.total_purchased_qty
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatCurrencyINR(
        row.avg_purchase_rate
      )}</td>
      <td style="vertical-align:middle; text-align:center">${
        row.last_purchase_date ?? "–"
      }</td>
      <td style="vertical-align:middle; text-align:center">${
        row.purchase_lines ?? "–"
      }</td>
    </tr>`;
  });
  html += "</tbody></table>";
  tableArea.innerHTML = html;
  hideLoadingMask();
  renderPaginator(totalCount, state.pagePurchase, state.pageSize, "purchase");
  // Row click
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      state.selectedItemId = tr.getAttribute("data-id");
      renderPurchaseSummaryTable(rows); // highlight
      loadAndRenderPurchaseDetail(state.selectedItemId);
    });
  });
  // If an item is selected, show its detail
  if (state.selectedItemId) loadAndRenderPurchaseDetail(state.selectedItemId);
  else sidePanel.classList.remove("active");
}

// NEW: render consumption summary table
function renderConsumptionTable(rows, totalCount) {
  if (!rows || !rows.length) return renderNoData();

  let html = `<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Total Consumed Qty</th>
    <th style="vertical-align:middle; text-align:center">RM/PLM Issues</th>
    <th style="vertical-align:middle; text-align:center">Consumables Out</th>
    <th style="vertical-align:middle; text-align:center">Usage Months</th>
    <th style="vertical-align:middle; text-align:center">First Month</th>
    <th style="vertical-align:middle; text-align:center">Last Month</th>
  </tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr data-id="${row.inv_stock_item_id}"${
      row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
    }>
      <td style="vertical-align:middle; text-align:center">${row.code}</td>
      <td style="vertical-align:middle; text-align:left">${row.name}</td>
      <td style="vertical-align:middle; text-align:center">${formatClassification(
        row
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.total_consumed_qty
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.rm_pm_issue_qty
      )}</td>
      <td style="vertical-align:middle; text-align:right">${formatIndianNumber(
        row.consumable_out_qty
      )}</td>
      <td style="vertical-align:middle; text-align:center">${
        row.months_with_usage ?? "–"
      }</td>
      <td style="vertical-align:middle; text-align:center">${
        row.first_month ?? "–"
      }</td>
      <td style="vertical-align:middle; text-align:center">${
        row.last_month ?? "–"
      }</td>
    </tr>`;
  });

  html += "</tbody></table>";
  tableArea.innerHTML = html;
  hideLoadingMask();

  renderPaginator(
    totalCount,
    state.pageConsumption,
    state.pageSize,
    "consumption"
  );

  // Row click: open monthly history modal
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      state.selectedItemId = tr.getAttribute("data-id");
      renderConsumptionTable(rows, totalCount); // re-render highlight
      loadAndRenderConsumptionMonthly(state.selectedItemId);
    });
  });
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
    modalContent.innerHTML = `<div class="error">${
      error.userMessage || error.message
    }</div>`;
    return;
  }
  if (!data || !data.length) {
    modalContent.innerHTML =
      '<div class="no-data">No consumption history found.</div>';
    return;
  }

  let html = `<h3 style="margin-top:0">Monthly Consumption</h3>
    <div class="modal-table-wrap">
      <table class="erp-table">
        <thead><tr>
          <th style="width:120px">Month</th>
          <th style="width:120px; text-align:right">RM/PLM Issues</th>
          <th style="width:140px; text-align:right">Consumables Out</th>
          <th style="width:140px; text-align:right">Total Consumed</th>
        </tr></thead>
        <tbody>`;

  data.forEach((row) => {
    html += `<tr>
      <td>${row.month_label ?? row.month_start_date ?? "–"}</td>
      <td class="numeric">${formatIndianNumber(row.rm_pm_issue_qty)}</td>
      <td class="numeric">${formatIndianNumber(row.consumable_out_qty)}</td>
      <td class="numeric">${formatIndianNumber(row.total_consumed_qty)}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  modalContent.innerHTML = html;
}

// Paginator renderer and navigation
function renderPaginator(total, page, pageSize, tab) {
  const p = document.getElementById("paginator");
  if (!p) return;
  if (!total || total <= 0) {
    p.innerHTML = "";
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // page-size selector
  const sizes = [10, 30, 50, 100];
  const selHtml = `<select id="pageSizeSel" aria-label="Rows per page">${sizes
    .map(
      (s) =>
        `<option value="${s}" ${s === pageSize ? "selected" : ""}>${s}</option>`
    )
    .join("")}</select>`;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  p.innerHTML = `
    <div class="p-left">${selHtml}</div>
    <div class="p-center"></div>
    <div class="p-right"><button id="p_prev" ${
      prevDisabled ? "disabled" : ""
    } aria-label="Previous page">‹</button>
    <div class="page-info">${from}–${to} of ${total}</div>
    <button id="p_next" ${
      nextDisabled ? "disabled" : ""
    } aria-label="Next page">›</button></div>
  `;

  // attach handlers
  const pSize = document.getElementById("pageSizeSel");
  if (pSize)
    pSize.addEventListener("change", (ev) => {
      const v = Number(ev.target.value) || 30;
      state.pageSize = v;
      resetPages();
      reloadActiveTab();
    });
  const prev = document.getElementById("p_prev");
  const next = document.getElementById("p_next");
  if (prev)
    prev.addEventListener("click", () => goToPage(tab, Math.max(1, page - 1)));
  if (next)
    next.addEventListener("click", () =>
      goToPage(tab, Math.min(totalPages, page + 1))
    );
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

function goToPage(tab, newPage) {
  if (!newPage || newPage < 1) return;
  if (tab === "overview") state.pageOverview = newPage;
  else if (tab === "stock") state.pageStock = newPage;
  else if (tab === "purchase") state.pagePurchase = newPage;
  else if (tab === "consumption") state.pageConsumption = newPage;
  else return;
  reloadActiveTab();
}

async function loadAndRenderPurchaseDetail(invStockItemId) {
  // show modal with loading
  openDetailModal('<div class="loading">Loading…</div>');
  const { data, error } = await loadPurchaseDetails({
    invStockItemId,
    fromDate: state.currentFromDate,
    toDate: state.currentToDate,
  });
  if (error)
    return (modalContent.innerHTML = `<div class="error">${
      error.userMessage || error.message
    }</div>`);
  if (!data || !data.length)
    return (modalContent.innerHTML =
      '<div class="no-data">No purchase history found.</div>');
  let html = `<h3 style="margin-top:0">Purchase History</h3>
    <div class="modal-table-wrap">
      <table class="erp-table">
        <thead><tr>
          <th style="width:110px">Date</th>
          <th>Supplier</th>
          <th style="width:140px">Godown</th>
          <th style="width:110px; text-align:right">Qty</th>
          <th style="width:120px; text-align:right">Rate</th>
          <th style="width:140px; text-align:right">Billed Amount</th>
        </tr></thead>
        <tbody>`;
  data.forEach((row) => {
    html += `<tr>
      <td>${row.voucher_date ?? "–"}</td>
      <td>${row.supplier_name ?? "–"}</td>
      <td>${row.godown_label ?? "–"}</td>
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
  renderLoading();
  // ensure modal closed and side-panel hidden
  closeDetailModal();
  state.selectedItemId = preselectId || null;
  // sync tab button UI with current state
  setActiveTab(state.currentTab);
  if (state.currentTab === "overview") {
    const res = await loadOverviewItems({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      page: state.pageOverview,
      pageSize: state.pageSize,
    });
    if (res.error)
      return renderError(res.error.userMessage || res.error.message);
    renderOverviewTable(res.data, res.count || 0);
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
    if (res.error)
      return renderError(res.error.userMessage || res.error.message);
    renderStockTable(res.data, res.count || 0);
  } else if (state.currentTab === "purchase") {
    const res = await loadPurchaseSummary({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      fromDate: state.currentFromDate,
      toDate: state.currentToDate,
      page: state.pagePurchase,
      pageSize: state.pageSize,
    });
    if (res.error)
      return renderError(res.error.userMessage || res.error.message);
    renderPurchaseSummaryTable(res.data, res.count || 0);
  } else if (state.currentTab === "consumption") {
    const res = await loadConsumptionSummary({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
      fromDate: state.currentFromDate,
      toDate: state.currentToDate,
      page: state.pageConsumption,
      pageSize: state.pageSize,
    });
    if (res.error)
      return renderError(res.error.userMessage || res.error.message);
    renderConsumptionTable(res.data, res.count || 0);
  }
  // table area uses CSS flex + internal scrolling; pagination controlled by page-size selector
  try {
    adjustTableCardHeight();
  } catch {
    /* ignore */
  }
}

// Initial load: populate classification selects then load the active tab
loadClassificationOptions()
  .catch((err) => console.error("Failed to load classification options", err))
  .finally(async () => {
    // Ensure initial render and sizing run after layout stabilizes.
    try {
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

// Comments:
// - All data queries use Supabase and follow the same pattern as WIP Stock.
// - Filters and tab state are managed in JS state.
// - Tables and side panels are fully re-rendered on state change.
// - Error and loading states are handled inline.
// - Code is modular and commented for maintainability.
