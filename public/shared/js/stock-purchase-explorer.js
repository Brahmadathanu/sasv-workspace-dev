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
const filtersCloseBtn = document.getElementById("filtersCloseBtn");

const searchInput = document.getElementById("search");
const dateRangeInput = document.getElementById("dateRange");
const advToggleBtn = document.getElementById("toggleAdvancedFilters");
const advancedDrawer = document.getElementById("advancedDrawer");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
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
      if (state.currentTab === "purchase") reloadActiveTab();
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

searchInput.addEventListener("input", () => {
  resetPages();
  state.currentSearchText = searchInput.value.trim();
  reloadActiveTab();
});

// Reset all filters to their default state and reload
function resetAllFilters() {
  // reset state
  state.currentSearchText = "";
  state.currentFromDate = "";
  state.currentToDate = "";
  state.currentSourceKind = "all";
  state.currentCategoryCode = "all";
  state.currentSubcategoryCode = "all";
  state.currentGroupCode = "all";
  state.currentSubgroupCode = "all";

  // reset UI elements
  if (searchInput) {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (dateRangeInput && dateRangeInput._flatpickr) {
    try {
      dateRangeInput._flatpickr.clear();
    } catch {
      dateRangeInput.value = "";
    }
  } else if (dateRangeInput) {
    dateRangeInput.value = "";
  }

  if (classificationSelect) classificationSelect.value = "all";
  if (categoryFilter) categoryFilter.value = "all";
  fillEmptySelect(subcategoryFilter, "(All sub-categories)");
  fillEmptySelect(groupFilter, "(All groups)");
  fillEmptySelect(subgroupFilter, "(All sub-groups)");

  // reset pagination and reload
  resetPages();
  // close advanced drawer if open
  if (advancedDrawer && advancedDrawer.classList.contains("open")) {
    advancedDrawer.classList.remove("open");
    advancedDrawer.setAttribute("aria-hidden", "true");
    if (advToggleBtn) {
      advToggleBtn.setAttribute("aria-expanded", "false");
      advToggleBtn.classList.remove("open");
    }
  }
  showStatusToast("Filters reset to defaults", "info", 1600);
  reloadActiveTab();
}

// wire reset button if present
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    resetAllFilters();
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.currentTab = btn.dataset.tab;
    setActiveTab(state.currentTab);
    reloadActiveTab();
  });
});

// Advanced drawer toggle
if (advToggleBtn && advancedDrawer) {
  function setAdvancedOpen(open) {
    if (!advancedDrawer) return;
    if (open) {
      advancedDrawer.classList.add("open");
      advancedDrawer.setAttribute("aria-hidden", "false");
      advToggleBtn.setAttribute("aria-expanded", "true");
      advToggleBtn.classList.add("open");
      const first = advancedDrawer.querySelector("select, input, button");
      if (first && typeof first.focus === "function") first.focus();
    } else {
      advancedDrawer.classList.remove("open");
      advancedDrawer.setAttribute("aria-hidden", "true");
      advToggleBtn.setAttribute("aria-expanded", "false");
      advToggleBtn.classList.remove("open");
    }
    // On wider screens (not the mobile slide-down mode) expand/collapse the
    // whole filters card. For mobile (<=520px) we use an absolutely
    // positioned slide-down drawer instead, so avoid toggling the card's
    // expanded class there to prevent layout conflicts.
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

function setBackgroundInert(enable) {
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
    _backgroundDisabled = Array.from(page.querySelectorAll(selectors)).filter(
      (el) => !modalOverlay.contains(el)
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
  setBackgroundInert(true);
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

// Mobile filters drawer elements
const mobileFiltersBtn = document.getElementById("mobileFiltersBtn");
const filtersBackdrop = document.getElementById("filtersBackdrop");
const mobileSearch = document.getElementById("mobileSearch");
let _drawerFocusable = [];
let _drawerKeyHandler = null;
let _drawerFocusMaintainer = null;

function openFiltersDrawer() {
  _lastActiveElement = document.activeElement;
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 520;
  const targetEl = isMobile ? filtersCard : advancedDrawer;
  if (!targetEl) return;

  if (isMobile) {
    // open left off-canvas filters card
    // compute header height so drawer sits below it and uses remaining viewport
    try {
      const header = document.querySelector(".page-header");
      const headerBottom = header
        ? Math.round(header.getBoundingClientRect().bottom)
        : 56;
      // make the drawer occupy the full viewport but offset internal content
      // below the header by setting paddingTop. This avoids the drawer being
      // visually clipped while keeping the header visible.
      filtersCard.style.top = "0px";
      filtersCard.style.height = window.innerHeight + "px";
      filtersCard.style.paddingTop = headerBottom + "px";
    } catch {
      /* ignore */
    }
    filtersCard.classList.add("open");
    // show close button inside drawer on mobile
    if (filtersCloseBtn) filtersCloseBtn.style.display = "inline-flex";
    // ensure the advanced drawer inside the card is visible on mobile
    try {
      if (advancedDrawer && !advancedDrawer.classList.contains("open")) {
        advancedDrawer.classList.add("open");
        advancedDrawer.setAttribute("aria-hidden", "false");
      }
    } catch {
      /* ignore */
    }
    if (filtersBackdrop) filtersBackdrop.classList.add("show");
  } else {
    // open slide-down advanced drawer via the toggle so shared logic runs
    if (
      advToggleBtn &&
      advancedDrawer &&
      !advancedDrawer.classList.contains("open")
    ) {
      try {
        advToggleBtn.click();
      } catch {
        advancedDrawer.classList.add("open");
        advancedDrawer.setAttribute("aria-hidden", "false");
        if (advToggleBtn) advToggleBtn.setAttribute("aria-expanded", "true");
      }
    }
    if (filtersBackdrop) filtersBackdrop.classList.add("show");
  }

  // make background inert for accessibility
  try {
    setBackgroundInert(true);
  } catch {
    /* ignore */
  }

  // focus first focusable element inside the target drawer
  _drawerFocusable = _getFocusable(targetEl);
  if (_drawerFocusable && _drawerFocusable.length) {
    try {
      _drawerFocusable[0].focus();
    } catch {
      /* ignore */
    }
  }

  // trap TAB inside the opened drawer
  _drawerKeyHandler = function (e) {
    if (e.key !== "Tab") return;
    if (!_drawerFocusable || !_drawerFocusable.length) return;
    const first = _drawerFocusable[0];
    const last = _drawerFocusable[_drawerFocusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === targetEl) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener("keydown", _drawerKeyHandler);

  // maintain focus: if focus moves outside the drawer, bring it back to the opener
  _drawerFocusMaintainer = function (ev) {
    if (!targetEl || targetEl.contains(ev.target)) return;
    ev.stopPropagation();
    if (mobileFiltersBtn) mobileFiltersBtn.focus();
  };
  document.addEventListener("focus", _drawerFocusMaintainer, true);
}

function closeFiltersDrawer() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 520;
  const targetEl = isMobile ? filtersCard : advancedDrawer;
  if (!targetEl) return;

  if (isMobile) {
    // close left off-canvas filters card
    filtersCard.classList.remove("open");
    // hide close button
    if (filtersCloseBtn) filtersCloseBtn.style.display = "none";
    // collapse internal advanced drawer when closing mobile card
    try {
      if (advancedDrawer && advancedDrawer.classList.contains("open")) {
        advancedDrawer.classList.remove("open");
        advancedDrawer.setAttribute("aria-hidden", "true");
      }
    } catch {
      /* ignore */
    }
    if (filtersBackdrop) filtersBackdrop.classList.remove("show");
    // remove any inline sizing to restore default
    if (filtersCard) {
      filtersCard.style.top = "";
      filtersCard.style.height = "";
      filtersCard.style.paddingTop = "";
    }
  } else {
    // close the advanced drawer via the toggle
    if (advToggleBtn && advancedDrawer.classList.contains("open")) {
      try {
        advToggleBtn.click();
      } catch {
        advancedDrawer.classList.remove("open");
        advancedDrawer.setAttribute("aria-hidden", "true");
        if (advToggleBtn) advToggleBtn.setAttribute("aria-expanded", "false");
      }
    }
    if (filtersBackdrop) filtersBackdrop.classList.remove("show");
  }

  try {
    setBackgroundInert(false);
  } catch {
    /* ignore */
  }

  if (_drawerKeyHandler) {
    document.removeEventListener("keydown", _drawerKeyHandler);
    _drawerKeyHandler = null;
  }
  if (_drawerFocusMaintainer) {
    document.removeEventListener("focus", _drawerFocusMaintainer, true);
    _drawerFocusMaintainer = null;
  }
  // restore focus
  try {
    if (_lastActiveElement && typeof _lastActiveElement.focus === "function")
      _lastActiveElement.focus();
  } catch {
    /* ignore */
  }
}

if (mobileFiltersBtn) {
  mobileFiltersBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 520;
    if (isMobile) {
      if (filtersCard && filtersCard.classList.contains("open"))
        closeFiltersDrawer();
      else openFiltersDrawer();
    } else {
      if (advancedDrawer && advancedDrawer.classList.contains("open"))
        closeFiltersDrawer();
      else openFiltersDrawer();
    }
  });
}
if (filtersCloseBtn) {
  filtersCloseBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeFiltersDrawer();
  });
}

// Sync mobile search with main search input (two-way)
if (mobileSearch && searchInput) {
  // initialize
  mobileSearch.value = searchInput.value || "";
  mobileSearch.addEventListener("input", (ev) => {
    searchInput.value = ev.target.value;
    // trigger existing handler
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // keep mobileSearch updated when main search changes (e.g., reset)
  searchInput.addEventListener("input", (ev) => {
    if (mobileSearch.value !== ev.target.value)
      mobileSearch.value = ev.target.value;
  });
}

// Prevent clicks on filter elements from closing the drawer
if (filtersCard) {
  filtersCard.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });
}

// Only close drawer when backdrop itself is clicked (not filter elements)
if (filtersBackdrop) {
  filtersBackdrop.addEventListener("click", (ev) => {
    if (ev.target === filtersBackdrop) {
      closeFiltersDrawer();
    }
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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("v_purchases_summary_by_item")
    .select("*", { count: "exact" });

  if (sourceKind && sourceKind !== "all") {
    query = query.eq("source_kind", sourceKind);
  }
  if (searchText) {
    query = query.or(`name.ilike.%${searchText}%,code.ilike.%${searchText}%`);
  }
  if (fromDate) query = query.gte("last_purchase_date", toIso(fromDate));
  if (toDate) query = query.lte("last_purchase_date", toIso(toDate));

  query = applyClassificationFilters(query);

  query = query.order("name");
  query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) return { error: handleSupabaseError(error) };
  return { data, count };
}

async function loadPurchaseDetails({ invStockItemId, fromDate, toDate }) {
  let query = supabase
    .from("v_purchases_by_item")
    .select()
    .eq("inv_stock_item_id", invStockItemId);
  if (fromDate) query = query.gte("voucher_date", toIso(fromDate));
  if (toDate) query = query.lte("voucher_date", toIso(toDate));
  query = query.order("voucher_date", { ascending: false });
  const { data, error } = await query;
  if (error) return { error: handleSupabaseError(error) };
  return { data };
}

// NEW: load monthly consumption rows for an item
async function loadConsumptionMonthly({ invStockItemId }) {
  let query = supabase
    .from("v_item_consumption_monthly_by_item")
    .select()
    .eq("inv_stock_item_id", invStockItemId)
    .order("month_start_date", { ascending: true });

  const { data, error } = await query;
  if (error) return { error: handleSupabaseError(error) };
  return { data };
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
  // make background inert unless modal is open (modal manages inert itself)
  if (!(modalOverlay && modalOverlay.classList.contains("open"))) {
    setBackgroundInert(true);
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
  const { data, error } = await loadConsumptionMonthly({ invStockItemId });
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
    const res = await loadOverviewItems({
      sourceKind: state.currentSourceKind,
      searchText: state.currentSearchText,
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
