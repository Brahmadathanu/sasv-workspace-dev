// Filters drawer (all viewports) — real controls live in #mobileFiltersModal
const mobileFiltersModal = document.getElementById("mobileFiltersModal");
const mobileFiltersClose = document.getElementById("mobileFiltersClose");
const mobileFiltersApply = document.getElementById("mobileFiltersApply");
const mobileFiltersReset = document.getElementById("mobileFiltersReset");

let _drawerFilterSnapshot = null;
let _drawerApplyCommitted = false;

function captureDrawerFilterSnapshot() {
  _drawerFilterSnapshot = {
    sourceKind: state.currentSourceKind || "all",
    categoryCode: state.currentCategoryCode || "all",
    subcategoryCode: state.currentSubcategoryCode || "all",
    groupCode: state.currentGroupCode || "all",
    subgroupCode: state.currentSubgroupCode || "all",
    fromDate: state.currentFromDate || "",
    toDate: state.currentToDate || "",
  };
}

function restoreDrawerFilterSnapshot() {
  if (!_drawerFilterSnapshot) return;
  const snap = _drawerFilterSnapshot;
  state.currentSourceKind = snap.sourceKind;
  state.currentCategoryCode = snap.categoryCode;
  state.currentSubcategoryCode = snap.subcategoryCode;
  state.currentGroupCode = snap.groupCode;
  state.currentSubgroupCode = snap.subgroupCode;
  state.currentFromDate = snap.fromDate;
  state.currentToDate = snap.toDate;

  if (classificationSelect) classificationSelect.value = snap.sourceKind;
  if (categoryFilter) categoryFilter.value = snap.categoryCode;
  if (snap.categoryCode && snap.categoryCode !== "all") {
    populateSubcategoriesForCategory(snap.categoryCode);
  } else {
    fillEmptySelect(subcategoryFilter, "(All sub-categories)");
    fillEmptySelect(groupFilter, "(All groups)");
    fillEmptySelect(subgroupFilter, "(All sub-groups)");
  }
  if (subcategoryFilter) subcategoryFilter.value = snap.subcategoryCode;
  if (snap.subcategoryCode && snap.subcategoryCode !== "all") {
    populateGroupsForSubcategory(snap.subcategoryCode);
  }
  if (groupFilter) groupFilter.value = snap.groupCode;
  if (snap.groupCode && snap.groupCode !== "all") {
    populateSubgroupsForGroup(snap.groupCode);
  }
  if (subgroupFilter) subgroupFilter.value = snap.subgroupCode;

  if (dateRangeInput) {
    const fpInst = dateRangeInput._flatpickr;
    if (fpInst) {
      if (snap.fromDate && snap.toDate) {
        fpInst.setDate([snap.fromDate, snap.toDate], false);
      } else if (snap.fromDate) {
        fpInst.setDate([snap.fromDate], false);
      } else {
        fpInst.clear();
      }
    } else {
      dateRangeInput.value =
        snap.fromDate && snap.toDate
          ? `${snap.fromDate} to ${snap.toDate}`
          : snap.fromDate || "";
    }
  }
}

function openMobileFiltersModal() {
  if (!mobileFiltersModal) return;
  captureDrawerFilterSnapshot();
  _drawerApplyCommitted = false;
  syncDateRangeAvailability();
  try {
    _lastActiveElement = document.activeElement;
    mobileFiltersModal.classList.add("open");
    mobileFiltersModal.setAttribute("aria-hidden", "false");
    if (filtersBtn) filtersBtn.setAttribute("aria-expanded", "true");
    setBackgroundInert(true, [mobileFiltersModal]);
    _mobileModalFocusable = _getFocusable(mobileFiltersModal);
    const firstField = mobileFiltersModal.querySelector(
      "select, input, button.modal-close",
    );
    if (firstField && typeof firstField.focus === "function") firstField.focus();
    else if (mobileFiltersClose) mobileFiltersClose.focus();
    document.addEventListener("focus", _maintainFocusMobile, true);
    document.addEventListener("keydown", _trapTabHandlerMobile);
  } catch {
    /* ignore errors opening modal */
  }
}

function closeMobileFiltersModal() {
  if (!mobileFiltersModal) return;
  try {
    document.removeEventListener("focus", _maintainFocusMobile, true);
    document.removeEventListener("keydown", _trapTabHandlerMobile);
  } catch {
    /* ignore */
  }
  _mobileModalFocusable = [];
  if (!_drawerApplyCommitted) restoreDrawerFilterSnapshot();
  _drawerFilterSnapshot = null;
  mobileFiltersModal.classList.remove("open");
  mobileFiltersModal.setAttribute("aria-hidden", "true");
  if (filtersBtn) filtersBtn.setAttribute("aria-expanded", "false");
  updateFiltersBtnActive();
  try {
    setBackgroundInert(false);
  } catch {
    /* ignore */
  }
  try {
    if (filtersBtn && typeof filtersBtn.focus === "function") filtersBtn.focus();
  } catch {
    /* ignore */
  }
}

function applyMobileFilters() {
  _drawerApplyCommitted = true;
  resetPages();
  reloadActiveTab();
  updateFiltersBtnActive();
  closeMobileFiltersModal();
  showStatusToast("Filters applied", "success", 2000);
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
}

function resetFilters() {
  if (classificationSelect) classificationSelect.value = "all";
  if (categoryFilter) categoryFilter.value = "all";
  fillEmptySelect(subcategoryFilter, "(All sub-categories)");
  fillEmptySelect(groupFilter, "(All groups)");
  fillEmptySelect(subgroupFilter, "(All sub-groups)");
  if (searchInput) searchInput.value = "";
  if (dateRangeInput) {
    if (dateRangeInput._flatpickr) dateRangeInput._flatpickr.clear();
    else dateRangeInput.value = "";
  }

  state.currentSourceKind = "all";
  state.currentCategoryCode = "all";
  state.currentSubcategoryCode = "all";
  state.currentGroupCode = "all";
  state.currentSubgroupCode = "all";
  state.currentSearchText = "";
  state.currentFromDate = "";
  state.currentToDate = "";

  _drawerApplyCommitted = true;
  try {
    if (mobileFiltersModal && mobileFiltersModal.classList.contains("open")) {
      closeMobileFiltersModal();
    }
  } catch {
    /* ignore */
  }

  resetPages();
  reloadActiveTab();
  updateFiltersBtnActive();
  if (typeof toggleMainClearButton === "function") toggleMainClearButton();
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
    resetDrawerFilters();
  });
}

const resetFiltersBtn = document.getElementById("resetFiltersBtn");
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    resetFilters();
  });
}

if (mobileFiltersModal) {
  mobileFiltersModal.addEventListener("click", (ev) => {
    if (ev.target === mobileFiltersModal) closeMobileFiltersModal();
  });
}

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

