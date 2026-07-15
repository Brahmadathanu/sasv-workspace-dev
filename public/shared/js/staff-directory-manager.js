import { hrSupabase, supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "staff-directory-manager";

const $ = (id) => document.getElementById(id);

const statusArea = $("statusArea");
const lensPills = $("lensPills");
const tabSelect = $("tabSelect");
const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");
const staffSearch = $("staffSearch");
const staffSearchClear = $("staffSearchClear");
const addStaffBtn = $("addStaffBtn");
const rowCount = $("rowCount");
const tableHeadRow = $("tableHeadRow");
const staffTbody = $("staffTbody");
const filterBtn = $("filterBtn");
const filterBadge = $("filterBadge");
const filterPanel = $("filterPanel");
const filterPanelBody = $("filterPanelBody");
const filterPanelClose = $("filterPanelClose");
const filterApply = $("filterApply");
const filterClear = $("filterClear");

const kpiTotal = $("kpiTotal");
const kpiActive = $("kpiActive");
const kpiInactive = $("kpiInactive");
const kpiCategories = $("kpiCategories");
const kpiUnits = $("kpiUnits");
const kpiLabelTotal = $("kpiLabelTotal");
const kpiLabelActive = $("kpiLabelActive");
const kpiLabelInactive = $("kpiLabelInactive");
const kpiLabelFourth = $("kpiLabelFourth");
const kpiLabelFifth = $("kpiLabelFifth");

const staffModal = $("staffModal");
const staffModalTitle = $("staffModalTitle");
const staffModalSubtitle = $("staffModalSubtitle");
const staffModalClose = $("staffModalClose");
const staffModalBanner = $("staffModalBanner");
const staffEmployeeCode = $("staffEmployeeCode");
const staffFullName = $("staffFullName");
const staffDesignation = $("staffDesignation");
const staffCategoryId = $("staffCategoryId");
const staffStatusId = $("staffStatusId");
const staffUnitId = $("staffUnitId");
const staffSectionId = $("staffSectionId");
const staffSubsectionId = $("staffSubsectionId");
const staffAreaId = $("staffAreaId");
const staffContactNo = $("staffContactNo");
const staffDob = $("staffDob");
const staffJoiningDate = $("staffJoiningDate");
const staffWorkExpYears = $("staffWorkExpYears");
const staffIsActive = $("staffIsActive");
const staffRemarks = $("staffRemarks");
const staffSaveBtn = $("staffSaveBtn");
const staffDeactivateBtn = $("staffDeactivateBtn");
const staffCancelBtn = $("staffCancelBtn");

const compensationModal = $("compensationModal");
const compensationModalTitle = $("compensationModalTitle");
const compensationModalSubtitle = $("compensationModalSubtitle");
const compensationModalClose = $("compensationModalClose");
const compensationModalBanner = $("compensationModalBanner");
const compensationStaffId = $("compensationStaffId");
const compensationPeriodStart = $("compensationPeriodStart");
const compensationBasicSalary = $("compensationBasicSalary");
const compensationAllowanceAmount = $("compensationAllowanceAmount");
const compensationEmployerContribution = $(
  "compensationEmployerContribution",
);
const compensationOtherSalaryCost = $("compensationOtherSalaryCost");
const compensationTotalSalaryCost = $("compensationTotalSalaryCost");
const compensationSourceNote = $("compensationSourceNote");
const compensationSaveBtn = $("compensationSaveBtn");
const compensationCancelBtn = $("compensationCancelBtn");

const masterModal = $("masterModal");
const masterModalTitle = $("masterModalTitle");
const masterModalSubtitle = $("masterModalSubtitle");
const masterModalClose = $("masterModalClose");
const masterModalBanner = $("masterModalBanner");
const categoryFields = $("categoryFields");
const categoryCode = $("categoryCode");
const categoryLabel = $("categoryLabel");
const categoryIsActive = $("categoryIsActive");
const statusFields = $("statusFields");
const statusCode = $("statusCode");
const statusLabel = $("statusLabel");
const statusSortOrder = $("statusSortOrder");
const statusIsActive = $("statusIsActive");
const unitFields = $("unitFields");
const unitCode = $("unitCode");
const unitLabel = $("unitLabel");
const unitIsActive = $("unitIsActive");
const masterSaveBtn = $("masterSaveBtn");
const masterDeactivateBtn = $("masterDeactivateBtn");
const masterCancelBtn = $("masterCancelBtn");

const confirmModal = $("confirmModal");
const confirmModalTitle = $("confirmModalTitle");
const confirmModalMessage = $("confirmModalMessage");
const confirmModalClose = $("confirmModalClose");
const confirmModalCancel = $("confirmModalCancel");
const confirmModalOk = $("confirmModalOk");

const TABS = [
  { id: "staff", label: "Staff Directory" },
  { id: "categories", label: "Categories" },
  { id: "statuses", label: "Statuses" },
  { id: "units", label: "Units" },
  { id: "compensation", label: "Compensation" },
];

const SEARCH_PLACEHOLDERS = {
  staff:
    "Search staff name, employee code, designation, unit, section, or contact...",
  categories: "Search category code or category label...",
  statuses: "Search status code or status label...",
  units: "Search unit code or unit label...",
  compensation:
    "Search staff name, employee code, designation, period, salary note, or compensation status...",
};

const ADD_BUTTON_LABELS = {
  staff: "Add Staff",
  categories: "Add Category",
  statuses: "Add Status",
  units: "Add Unit",
  compensation: "Add Compensation",
};

const TABLE_CONFIG = {
  staff: {
    emptyLabel: "staff",
    columns: [
      { label: "Staff" },
      { label: "Designation" },
      { label: "Category", className: "col-hide-mobile" },
      { label: "HR Status" },
      { label: "Unit", className: "col-hide-mobile" },
      { label: "Section", className: "col-hide-mobile" },
      { label: "Active" },
      { label: "Updated", className: "col-hide-mobile" },
    ],
  },
  categories: {
    emptyLabel: "categories",
    columns: [
      { label: "Category Code" },
      { label: "Category Label" },
      { label: "Active" },
      { label: "Updated", className: "col-hide-mobile" },
    ],
  },
  statuses: {
    emptyLabel: "statuses",
    columns: [
      { label: "Status Code" },
      { label: "Status Label" },
      { label: "Sort Order" },
      { label: "Active" },
      { label: "Updated", className: "col-hide-mobile" },
    ],
  },
  units: {
    emptyLabel: "units",
    columns: [
      { label: "Unit Code" },
      { label: "Unit Label" },
      { label: "Active" },
      { label: "Updated", className: "col-hide-mobile" },
    ],
  },
  compensation: {
    emptyLabel: "compensation rows",
    columns: [
      { label: "Staff" },
      { label: "Period" },
      { label: "Basic" },
      { label: "Allowance", className: "col-hide-mobile" },
      { label: "Employer", className: "col-hide-mobile" },
      { label: "Other", className: "col-hide-mobile" },
      { label: "Total" },
      { label: "Status" },
      { label: "Updated", className: "col-hide-mobile" },
    ],
  },
};

const filtersByTab = {
  staff: {
    staffActive: "all",
    staffCategory: "all",
    hrStatus: "all",
    unit: "all",
    section: "all",
  },
  categories: {
    activeStatus: "all",
  },
  statuses: {
    activeStatus: "all",
  },
  units: {
    activeStatus: "all",
  },
  compensation: {
    activeStatus: "all",
  },
};

let userId = null;
let staffRows = [];
let categoryRows = [];
let statusRows = [];
let unitRows = [];
let sectionRows = [];
let subsectionRows = [];
let areaRows = [];
let compensationRows = [];
let allStaffRows = [];
let allCategoryRows = [];
let allStatusRows = [];
let allUnitRows = [];
let allCompensationRows = [];
let currentRows = [];
let activeTab = "staff";
let searchTerm = "";
let searchDebounceTimer = null;
let selectedStaffId = null;
let prevFocus = null;
let modalMode = "create";
let modalBusy = false;
let masterModalType = "categories";
let masterModalMode = "create";
let masterModalBusy = false;
let selectedMasterId = null;
let prevMasterFocus = null;
let selectedCompensationId = null;
let compensationModalMode = "create";
let compensationModalBusy = false;
let prevCompensationFocus = null;
let snapshotLoaded = false;
let confirmResolve = null;

initPage();

async function initPage() {
  renderTabControls();
  buildFilterPanel();
  wireEvents();

  const session = await resolveSession();
  if (!session?.user?.id) {
    window.location.href = "login.html";
    return;
  }

  userId = session.user.id;
  const canView = await checkModuleAccess(userId);
  if (!canView) {
    setStatus("You do not have permission to open this module.", "error");
    return;
  }

  await reloadSnapshotAndRender();
}

async function resolveSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session;
  } catch {
    // Continue to platform fallback.
  }

  try {
    const platformSession = await Platform.getSession?.();
    if (platformSession?.user?.id) return platformSession;
  } catch {
    // No-op; return null below.
  }

  return null;
}

async function checkModuleAccess(uid) {
  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: uid,
    });
    if (!error && Array.isArray(perms)) {
      const hit = perms.find((r) => r?.target === `module:${MODULE_ID}`);
      if (hit) return !!hit.can_view;
    }
  } catch {
    // Fall through.
  }

  try {
    const { data: canonicalRows } = await supabase
      .from("user_permissions_canonical")
      .select("can_view")
      .eq("user_id", uid)
      .eq("target", `module:${MODULE_ID}`)
      .limit(1);

    if (Array.isArray(canonicalRows) && canonicalRows.length) {
      return !!canonicalRows[0].can_view;
    }
  } catch {
    // Fall through.
  }

  try {
    const { data: rows } = await supabase
      .from("user_permissions")
      .select("can_view")
      .eq("user_id", uid)
      .eq("module_id", MODULE_ID)
      .limit(1);

    if (Array.isArray(rows) && rows.length) return !!rows[0].can_view;
  } catch {
    // Default allow.
  }

  return true;
}

function renderTabControls() {
  if (lensPills) {
    lensPills.innerHTML = TABS.map(
      (tab) =>
        `<button class="pill${tab.id === activeTab ? " active" : ""}" data-tab="${escHtml(tab.id)}" type="button" role="tab" aria-selected="${tab.id === activeTab ? "true" : "false"}">${escHtml(tab.label)}</button>`,
    ).join("");
  }

  syncMobileTabSelect();
  updateSearchPlaceholder();
  updateAddButtonState();
}

function syncMobileTabSelect() {
  if (tabSelect) tabSelect.value = activeTab;
}

function updateSearchPlaceholder() {
  if (!staffSearch) return;
  const placeholder = SEARCH_PLACEHOLDERS[activeTab] || "Search...";
  staffSearch.placeholder = placeholder;
  staffSearch.setAttribute("aria-label", placeholder);
}

function updateAddButtonState() {
  const label = ADD_BUTTON_LABELS[activeTab] || "Add";
  addStaffBtn.title = label;
  addStaffBtn.setAttribute("aria-label", label);
}

function switchTab(tabId) {
  if (!tabId || activeTab === tabId) return;
  activeTab = tabId;
  closeFilterPanel();

  lensPills?.querySelectorAll(".pill[data-tab]").forEach((pill) => {
    const isActive = pill.dataset.tab === tabId;
    pill.classList.toggle("active", isActive);
    pill.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  syncMobileTabSelect();

  searchTerm = "";
  staffSearch.value = "";
  staffSearchClear.classList.remove("visible");

  updateSearchPlaceholder();
  updateAddButtonState();
  renderCurrentView();
}

function wireEvents() {
  homeBtn.addEventListener("click", () => {
    if (typeof Platform.goHome === "function") {
      Platform.goHome();
    } else {
      const here = window.location.pathname || "";
      if (here.includes("/public/shared/")) {
        window.location.href = "../../index.html";
      } else if (here.includes("/shared/")) {
        window.location.href = "../index.html";
      } else {
        window.location.href = "index.html";
      }
    }
  });

  refreshBtn.addEventListener("click", () => reloadSnapshotAndRender(true));

  lensPills?.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill[data-tab]");
    if (pill) switchTab(pill.dataset.tab);
  });

  tabSelect?.addEventListener("change", () => switchTab(tabSelect.value));

  staffSearch.addEventListener("input", () => {
    searchTerm = staffSearch.value.trim();
    staffSearchClear.classList.toggle("visible", searchTerm.length > 0);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applySearchAndFilters();
      renderSummary();
      renderTable();
    }, 280);
  });

  staffSearchClear.addEventListener("click", () => {
    staffSearch.value = "";
    searchTerm = "";
    staffSearchClear.classList.remove("visible");
    applySearchAndFilters();
    renderSummary();
    renderTable();
    staffSearch.focus();
  });

  addStaffBtn.addEventListener("click", () => {
    if (activeTab === "staff") openStaffModal(null);
    else if (activeTab === "compensation") openCompensationModal(null);
    else openMasterModal(activeTab, null);
  });

  staffTbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr.manager-row[data-row-id]");
    if (!row) return;
    const rowId = parseOptionalId(row.dataset.rowId);
    if (rowId == null) return;

    if (activeTab === "staff") {
      openStaffModal(rowId);
      return;
    }

    if (activeTab === "compensation") {
      openCompensationModal(rowId);
      return;
    }

    openMasterModal(activeTab, rowId);
  });

  staffTbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr.manager-row[data-row-id]");
    if (!row) return;
    e.preventDefault();
    row.click();
  });

  filterBtn.addEventListener("click", () => {
    buildFilterPanel();
    positionFilterPanel();
    filterPanel.classList.toggle("open");
  });
  filterPanelClose.addEventListener("click", closeFilterPanel);
  filterApply.addEventListener("click", () => {
    applyFilters();
    closeFilterPanel();
  });
  filterClear.addEventListener("click", () => {
    clearFilters();
    closeFilterPanel();
  });

  staffSaveBtn.addEventListener("click", saveStaffFromModal);
  staffDeactivateBtn.addEventListener("click", deactivateStaffFromModal);
  staffCancelBtn.addEventListener("click", () => closeStaffModal());
  staffModalClose.addEventListener("click", () => closeStaffModal());
  staffModal.addEventListener("click", (e) => {
    if (e.target === staffModal) closeStaffModal();
  });

  compensationSaveBtn.addEventListener("click", saveCompensationFromModal);
  compensationCancelBtn.addEventListener("click", () =>
    closeCompensationModal(),
  );
  compensationModalClose.addEventListener("click", () =>
    closeCompensationModal(),
  );
  compensationModal.addEventListener("click", (e) => {
    if (e.target === compensationModal) closeCompensationModal();
  });
  [
    compensationBasicSalary,
    compensationAllowanceAmount,
    compensationEmployerContribution,
    compensationOtherSalaryCost,
  ].forEach((field) =>
    field.addEventListener("input", updateCompensationTotalPreview),
  );

  masterSaveBtn.addEventListener("click", saveMasterFromModal);
  masterDeactivateBtn.addEventListener("click", deactivateMasterFromModal);
  masterCancelBtn.addEventListener("click", () => closeMasterModal());
  masterModalClose.addEventListener("click", () => closeMasterModal());
  masterModal.addEventListener("click", (e) => {
    if (e.target === masterModal) closeMasterModal();
  });

  confirmModalOk?.addEventListener("click", () => finishConfirmModal(true));
  confirmModalCancel?.addEventListener("click", () => finishConfirmModal(false));
  confirmModalClose?.addEventListener("click", () => finishConfirmModal(false));
  confirmModal?.addEventListener("click", (e) => {
    if (e.target === confirmModal) finishConfirmModal(false);
  });

  document.addEventListener("click", (e) => {
    if (
      filterPanel.classList.contains("open") &&
      !filterPanel.contains(e.target) &&
      !filterBtn.contains(e.target)
    ) {
      closeFilterPanel();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (confirmResolve) {
      finishConfirmModal(false);
      return;
    }

    if (
      !compensationModal.classList.contains("hidden") &&
      !compensationModalBusy
    ) {
      closeCompensationModal();
    } else if (!masterModal.classList.contains("hidden") && !masterModalBusy) {
      closeMasterModal();
    } else if (!staffModal.classList.contains("hidden") && !modalBusy) {
      closeStaffModal();
    } else if (filterPanel.classList.contains("open")) {
      closeFilterPanel();
    }
  });
}

async function reloadSnapshotAndRender(showRefreshToast = false) {
  setStatus("Loading staff directory snapshot...", "loading");
  refreshBtn.disabled = true;
  snapshotLoaded = false;

  try {
    await loadSnapshot();
    await loadCompensationRows();
    snapshotLoaded = true;
    allStaffRows = buildStaffRows();
    allCategoryRows = buildCategoryMasterRows();
    allStatusRows = buildStatusMasterRows();
    allUnitRows = buildUnitMasterRows();
    allCompensationRows = buildCompensationRows();
    renderCurrentView();
    clearStatus();
    if (showRefreshToast) showToast("Data refreshed", "success");
  } catch (err) {
    snapshotLoaded = false;
    console.error("[staff-directory-manager] reloadSnapshotAndRender:", err);
    setStatus(
      "Error loading staff directory snapshot: " + (err.message || String(err)),
      "error",
    );
    staffTbody.innerHTML = "";
    rowCount.textContent = "";
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderCurrentView() {
  buildFilterPanel();
  applySearchAndFilters();
  renderSummary();
  renderTable();
  updateSearchPlaceholder();
  updateAddButtonState();
}

async function loadSnapshot() {
  const { data, error } = await hrSupabase.rpc(
    "fn_get_staff_directory_snapshot",
  );

  if (error)
    throw new Error(error.message || "Failed to load staff directory snapshot");

  staffRows = Array.isArray(data?.staff) ? data.staff : [];
  categoryRows = Array.isArray(data?.categories) ? data.categories : [];
  statusRows = Array.isArray(data?.statuses) ? data.statuses : [];
  unitRows = Array.isArray(data?.units) ? data.units : [];
  sectionRows = Array.isArray(data?.sections) ? data.sections : [];
  subsectionRows = Array.isArray(data?.subsections) ? data.subsections : [];
  areaRows = Array.isArray(data?.areas) ? data.areas : [];
}

async function loadCompensationRows() {
  const { data, error } = await hrSupabase
    .from("v_staff_compensation_monthly_manager")
    .select(
      `
      compensation_id,
      staff_id,
      employee_code,
      staff_display_name,
      designation,
      staff_is_active,
      period_start,
      basic_salary,
      allowance_amount,
      employer_contribution,
      other_salary_cost,
      total_salary_cost,
      source_note,
      compensation_is_active,
      compensation_status,
      compensation_note,
      created_at,
      updated_at
    `,
    )
    .order("period_start", { ascending: false })
    .order("staff_display_name", { ascending: true });

  if (error)
    throw new Error(error.message || "Failed to load staff compensation rows.");
  compensationRows = Array.isArray(data) ? data : [];
}

function buildStaffRows() {
  return staffRows.map((s) => ({
    staffId: parseOptionalId(s?.staff_id),
    employeeCode: String(s?.employee_code || "-"),
    fullName: String(s?.full_name || "-"),
    designation: String(s?.designation || "-"),
    categoryId: parseOptionalId(s?.category_id),
    categoryCode: String(s?.category_code || ""),
    categoryLabel: String(s?.category_label || "-"),
    statusId: parseOptionalId(s?.status_id),
    statusCode: String(s?.status_code || ""),
    statusLabel: String(s?.status_label || "-"),
    statusSortOrder: Number(s?.status_sort_order || 0),
    unitId: parseOptionalId(s?.unit_id),
    unitCode: String(s?.unit_code || ""),
    unitLabel: String(s?.unit_label || "-"),
    sectionId: parseOptionalId(s?.section_id),
    sectionName: String(s?.section_name || "-"),
    subsectionId: parseOptionalId(s?.subsection_id),
    subsectionName: String(s?.subsection_name || "-"),
    areaId: parseOptionalId(s?.area_id),
    areaName: String(s?.area_name || "-"),
    contactNo: String(s?.contact_no || "-"),
    dob: s?.dob || null,
    joiningDate: s?.joining_date || null,
    workExpYears: s?.work_exp_years || null,
    isActive: s?.is_active === true,
    remarks: String(s?.remarks || "-"),
    createdAt: s?.created_at || null,
    updatedAt: s?.updated_at || null,
  }));
}

function buildCategoryMasterRows() {
  return categoryRows.map((row) => ({
    id: parseOptionalId(row?.category_id),
    code: String(row?.category_code || "-"),
    label: String(row?.category_label || "-"),
    isActive: row?.is_active === true,
    updatedAt: row?.updated_at || null,
  }));
}

function buildStatusMasterRows() {
  return statusRows.map((row) => ({
    id: parseOptionalId(row?.status_id),
    code: String(row?.status_code || "-"),
    label: String(row?.status_label || "-"),
    sortOrder:
      (row?.sort_order ?? row?.status_sort_order) == null ||
      (row?.sort_order ?? row?.status_sort_order) === ""
        ? null
        : Number(row?.sort_order ?? row?.status_sort_order),
    isActive: row?.is_active === true,
    updatedAt: row?.updated_at || null,
  }));
}

function buildUnitMasterRows() {
  return unitRows.map((row) => ({
    id: parseOptionalId(row?.unit_id),
    code: String(row?.unit_code || "-"),
    label: String(row?.unit_label || "-"),
    isActive: row?.is_active === true,
    updatedAt: row?.updated_at || null,
  }));
}

function buildCompensationRows() {
  return compensationRows.map((r) => ({
    compensationId: parseOptionalId(r?.compensation_id),
    staffId: parseOptionalId(r?.staff_id),
    employeeCode: String(r?.employee_code || "-"),
    staffDisplayName: String(r?.staff_display_name || "-"),
    designation: String(r?.designation || "-"),
    staffIsActive: r?.staff_is_active === true,
    periodStart: r?.period_start || null,
    basicSalary: toMoneyNumber(r?.basic_salary),
    allowanceAmount: toMoneyNumber(r?.allowance_amount),
    employerContribution: toMoneyNumber(r?.employer_contribution),
    otherSalaryCost: toMoneyNumber(r?.other_salary_cost),
    totalSalaryCost: toMoneyNumber(r?.total_salary_cost),
    sourceNote: String(r?.source_note || ""),
    isActive: r?.compensation_is_active === true,
    compensationStatus: String(r?.compensation_status || "-"),
    compensationNote: String(r?.compensation_note || ""),
    createdAt: r?.created_at || null,
    updatedAt: r?.updated_at || null,
  }));
}

function toMoneyNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getRowsForTab(tabId = activeTab) {
  if (tabId === "categories") return allCategoryRows;
  if (tabId === "statuses") return allStatusRows;
  if (tabId === "units") return allUnitRows;
  if (tabId === "compensation") return allCompensationRows;
  return allStaffRows;
}

function applySearchAndFilters() {
  const activeFilters = filtersByTab[activeTab] || {};
  const searchLower = searchTerm.toLowerCase();

  currentRows = getRowsForTab().filter((row) => {
    if (searchLower) {
      let haystack = "";
      if (activeTab === "staff") {
        haystack = [
          row.employeeCode,
          row.fullName,
          row.designation,
          row.categoryLabel,
          row.statusLabel,
          row.unitLabel,
          row.sectionName,
          row.subsectionName,
          row.areaName,
          row.contactNo,
          row.remarks,
        ]
          .join(" ")
          .toLowerCase();
      } else if (activeTab === "statuses") {
        haystack = [
          row.code,
          row.label,
          row.sortOrder == null ? "" : String(row.sortOrder),
        ]
          .join(" ")
          .toLowerCase();
      } else if (activeTab === "compensation") {
        haystack = [
          row.employeeCode,
          row.staffDisplayName,
          row.designation,
          row.periodStart,
          row.basicSalary,
          row.allowanceAmount,
          row.employerContribution,
          row.otherSalaryCost,
          row.totalSalaryCost,
          row.sourceNote,
          row.compensationStatus,
          row.compensationNote,
        ]
          .join(" ")
          .toLowerCase();
      } else {
        haystack = [row.code, row.label].join(" ").toLowerCase();
      }

      if (!haystack.includes(searchLower)) return false;
    }

    if (activeTab === "staff") {
      if (activeFilters.staffActive === "active" && !row.isActive) return false;
      if (activeFilters.staffActive === "inactive" && row.isActive)
        return false;
      if (
        activeFilters.staffCategory !== "all" &&
        String(row.categoryId) !== activeFilters.staffCategory
      )
        return false;
      if (
        activeFilters.hrStatus !== "all" &&
        String(row.statusId) !== activeFilters.hrStatus
      )
        return false;
      if (
        activeFilters.unit !== "all" &&
        String(row.unitId) !== activeFilters.unit
      )
        return false;
      if (
        activeFilters.section !== "all" &&
        String(row.sectionId) !== activeFilters.section
      )
        return false;
    } else if (
      activeFilters.activeStatus !== "all" &&
      row.isActive !== (activeFilters.activeStatus === "active")
    ) {
      return false;
    }

    return true;
  });

  updateFilterBadge();
}

function renderSummary() {
  const allRows = getRowsForTab();
  const total = allRows.length;
  const active = allRows.filter((r) => r.isActive).length;
  const inactive = total - active;

  if (activeTab === "staff") {
    kpiLabelTotal.textContent = "Total Staff";
    kpiLabelActive.textContent = "Active Staff";
    kpiLabelInactive.textContent = "Inactive Staff";
    kpiLabelFourth.textContent = "Categories";
    kpiLabelFifth.textContent = "Units";
    kpiCategories.textContent = String(
      new Set(allRows.map((r) => r.categoryId).filter((v) => v != null)).size,
    );
    kpiUnits.textContent = String(
      new Set(allRows.map((r) => r.unitId).filter((v) => v != null)).size,
    );
  } else if (activeTab === "compensation") {
    kpiLabelTotal.textContent = "Total Compensation Rows";
    kpiLabelActive.textContent = "Active Rows";
    kpiLabelInactive.textContent = "Inactive Rows";
    kpiLabelFourth.textContent = "Visible Rows";
    kpiLabelFifth.textContent = "Zero Salary";
    kpiCategories.textContent = String(currentRows.length);
    kpiUnits.textContent = String(
      allRows.filter((r) => r.totalSalaryCost === 0).length,
    );
  } else {
    const noun =
      activeTab === "categories"
        ? "Categories"
        : activeTab === "statuses"
          ? "Statuses"
          : "Units";
    kpiLabelTotal.textContent = `Total ${noun}`;
    kpiLabelActive.textContent = `Active ${noun}`;
    kpiLabelInactive.textContent = `Inactive ${noun}`;
    kpiLabelFourth.textContent = "Visible Rows";
    kpiLabelFifth.textContent = "Recently Updated";
    kpiCategories.textContent = String(currentRows.length);
    kpiUnits.textContent = String(
      allRows.filter((r) => String(r.updatedAt || "").trim() !== "").length,
    );
  }

  kpiTotal.textContent = String(total);
  kpiActive.textContent = String(active);
  kpiInactive.textContent = String(inactive);
}

function renderTable() {
  const tableConfig = TABLE_CONFIG[activeTab] || TABLE_CONFIG.staff;
  tableHeadRow.innerHTML = tableConfig.columns
    .map(
      (column) =>
        `<th${column.className ? ` class="${column.className}"` : ""}>${escHtml(column.label)}</th>`,
    )
    .join("");

  staffTbody.innerHTML = "";
  if (!snapshotLoaded) return;

  if (!currentRows.length) {
    staffTbody.innerHTML = `
      <tr>
        <td colspan="${tableConfig.columns.length}">
          <div style="padding:14px;border:1px solid var(--border,#e5e7eb);border-radius:8px;background:var(--panel-bg,#fff);">
            <div style="font-weight:700;font-size:14px;color:var(--muted,#374151);">No matching ${tableConfig.emptyLabel} found.</div>
            <div style="margin-top:4px;color:var(--muted,#6b7280);font-size:12px;">Try clearing filters or search.</div>
          </div>
        </td>
      </tr>`;
    rowCount.textContent = "0 rows";
    return;
  }

  currentRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "staff-row manager-row";
    tr.dataset.rowId = String(
      activeTab === "staff"
        ? row.staffId
        : activeTab === "compensation"
          ? row.compensationId
          : row.id,
    );
    tr.tabIndex = 0;
    tr.setAttribute("role", "row");

    const activeBadge = row.isActive
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Inactive</span>';

    if (activeTab === "staff") {
      const staffCell = `
        <span class="item-primary">${escHtml(row.fullName)}</span>
        <span class="item-secondary">${escHtml(row.employeeCode)}</span>
      `;
      tr.innerHTML = `
        <td>${staffCell}</td>
        <td>${escHtml(row.designation)}</td>
        <td class="col-hide-mobile">${escHtml(row.categoryLabel)}</td>
        <td>${escHtml(row.statusLabel)}</td>
        <td class="col-hide-mobile">${escHtml(row.unitLabel)}</td>
        <td class="col-hide-mobile">${escHtml(row.sectionName)}</td>
        <td>${activeBadge}</td>
        <td class="col-hide-mobile">${escHtml(formatDateTime(row.updatedAt))}</td>
      `;
    } else if (activeTab === "compensation") {
      const compensationBadge = `<span class="badge ${row.isActive ? "badge-active" : "badge-inactive"}">${escHtml(row.compensationStatus)}</span>`;
      tr.innerHTML = `
        <td>
          <span class="item-primary">${escHtml(row.staffDisplayName)}</span>
          <span class="item-secondary">${escHtml(row.employeeCode)}</span>
          <span class="item-secondary">${escHtml(row.designation)}</span>
        </td>
        <td>${escHtml(formatDate(row.periodStart))}</td>
        <td>${escHtml(formatCurrency(row.basicSalary))}</td>
        <td class="col-hide-mobile">${escHtml(formatCurrency(row.allowanceAmount))}</td>
        <td class="col-hide-mobile">${escHtml(formatCurrency(row.employerContribution))}</td>
        <td class="col-hide-mobile">${escHtml(formatCurrency(row.otherSalaryCost))}</td>
        <td>${escHtml(formatCurrency(row.totalSalaryCost))}</td>
        <td>${compensationBadge}</td>
        <td class="col-hide-mobile">${escHtml(formatDateTime(row.updatedAt))}</td>
      `;
    } else if (activeTab === "categories") {
      tr.innerHTML = `
        <td>${escHtml(row.code)}</td>
        <td>${escHtml(row.label)}</td>
        <td>${activeBadge}</td>
        <td class="col-hide-mobile">${escHtml(formatDateTime(row.updatedAt))}</td>
      `;
    } else if (activeTab === "statuses") {
      tr.innerHTML = `
        <td>${escHtml(row.code)}</td>
        <td>${escHtml(row.label)}</td>
        <td>${row.sortOrder == null ? "-" : escHtml(String(row.sortOrder))}</td>
        <td>${activeBadge}</td>
        <td class="col-hide-mobile">${escHtml(formatDateTime(row.updatedAt))}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${escHtml(row.code)}</td>
        <td>${escHtml(row.label)}</td>
        <td>${activeBadge}</td>
        <td class="col-hide-mobile">${escHtml(formatDateTime(row.updatedAt))}</td>
      `;
    }

    staffTbody.appendChild(tr);
  });

  rowCount.textContent = `${currentRows.length} row${currentRows.length !== 1 ? "s" : ""}`;
}

function parseOptionalStaffId(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function openCompensationModal(compensationId = null) {
  prevCompensationFocus = document.activeElement;
  selectedCompensationId = parseOptionalId(compensationId);
  compensationModalMode =
    selectedCompensationId == null ? "create" : "edit";

  clearCompensationModalBanner();

  let row = null;
  if (compensationModalMode === "edit") {
    row = allCompensationRows.find(
      (item) => item.compensationId === selectedCompensationId,
    );
    if (!row) {
      showToast("Compensation record not found.", "error");
      return;
    }
  }

  populateCompensationStaffSelect(row?.staffId ?? null);
  setCompensationFormValues(row);

  if (compensationModalMode === "create") {
    compensationModalTitle.textContent = "Staff Compensation";
    compensationModalSubtitle.textContent =
      "Create or update a monthly staff compensation record.";
  } else {
    compensationModalTitle.textContent = "Edit Compensation";
    compensationModalSubtitle.textContent = `${row.staffDisplayName} \u00b7 ${row.employeeCode} \u00b7 ${formatDate(row.periodStart)}`;
  }

  setCompensationModalBusy(false);
  compensationModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (compensationModalMode === "edit") compensationBasicSalary.focus();
  else compensationStaffId.focus();
}

function closeCompensationModal(force = false) {
  if (compensationModalBusy && force !== true) return;

  compensationModal.classList.add("hidden");
  syncBodyOverflow();
  clearCompensationModalBanner();
  selectedCompensationId = null;
  compensationModalMode = "create";

  if (force !== true) {
    try {
      if (
        prevCompensationFocus &&
        typeof prevCompensationFocus.focus === "function"
      ) {
        prevCompensationFocus.focus();
      }
    } catch {
      // Ignore focus restore failures.
    }
  }
  prevCompensationFocus = null;
  if (force === true) ensureSearchInteractive();
}

function setCompensationModalBusy(isBusy) {
  compensationModalBusy = !!isBusy;
  compensationSaveBtn.disabled = compensationModalBusy;
  compensationCancelBtn.disabled = compensationModalBusy;
  compensationModalClose.disabled = compensationModalBusy;
  compensationStaffId.disabled = compensationModalBusy;
  compensationPeriodStart.disabled = compensationModalBusy;
  compensationBasicSalary.disabled = compensationModalBusy;
  compensationAllowanceAmount.disabled = compensationModalBusy;
  compensationEmployerContribution.disabled = compensationModalBusy;
  compensationOtherSalaryCost.disabled = compensationModalBusy;
  compensationSourceNote.disabled = compensationModalBusy;
  compensationSaveBtn.textContent = compensationModalBusy
    ? "Saving..."
    : "Save";
}

function clearCompensationModalBanner() {
  compensationModalBanner.textContent = "";
  compensationModalBanner.removeAttribute("data-type");
}

function showCompensationModalBanner(type, message) {
  compensationModalBanner.textContent = message || "";
  compensationModalBanner.setAttribute("data-type", type);
}

function populateCompensationStaffSelect(selectedStaffId = null) {
  const selectedId = parseOptionalId(selectedStaffId);
  const rows = allStaffRows
    .filter((staff) => staff.isActive || staff.staffId === selectedId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  compensationStaffId.innerHTML = [
    '<option value="">Select Staff</option>',
    ...rows.map(
      (staff) =>
        `<option value="${escHtml(String(staff.staffId))}">${escHtml(
          `${staff.fullName} \u2014 ${staff.employeeCode} \u2014 ${staff.designation}`,
        )}</option>`,
    ),
  ].join("");
}

function setCompensationFormValues(row) {
  compensationStaffId.value = asSelectValue(row?.staffId);
  compensationPeriodStart.value = row
    ? asDateInputValue(row.periodStart)
    : getCurrentMonthStart();
  compensationBasicSalary.value = String(row?.basicSalary ?? 0);
  compensationAllowanceAmount.value = String(row?.allowanceAmount ?? 0);
  compensationEmployerContribution.value = String(
    row?.employerContribution ?? 0,
  );
  compensationOtherSalaryCost.value = String(row?.otherSalaryCost ?? 0);
  compensationSourceNote.value = row?.sourceNote || "";
  updateCompensationTotalPreview();
}

function getCurrentMonthStart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function normalizeMonthStart(value) {
  const dateValue = asDateInputValue(value);
  return dateValue ? `${dateValue.slice(0, 7)}-01` : null;
}

function readCompensationFormValues() {
  const staffId = parseOptionalId(compensationStaffId.value);
  if (staffId == null) {
    showCompensationModalBanner("error", "Staff is required.");
    compensationStaffId.focus();
    return null;
  }

  const periodStart = normalizeMonthStart(compensationPeriodStart.value);
  if (!periodStart) {
    showCompensationModalBanner("error", "Period Start is required.");
    compensationPeriodStart.focus();
    return null;
  }

  const amountFields = [
    ["Basic Salary", compensationBasicSalary],
    ["Allowance Amount", compensationAllowanceAmount],
    ["Employer Contribution", compensationEmployerContribution],
    ["Other Salary Cost", compensationOtherSalaryCost],
  ];
  const amounts = [];
  for (const [label, field] of amountFields) {
    const raw = String(field.value ?? "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      showCompensationModalBanner(
        "error",
        `${label} must be a number greater than or equal to 0.`,
      );
      field.focus();
      return null;
    }
    amounts.push(value);
  }

  const sourceNote = String(compensationSourceNote.value || "").trim();
  const total = amounts.reduce((sum, value) => sum + value, 0);
  if (total === 0 && sourceNote.length < 5) {
    showCompensationModalBanner(
      "error",
      "Enter a source note of at least 5 characters to explain zero salary.",
    );
    compensationSourceNote.focus();
    return null;
  }

  return {
    staffId,
    periodStart,
    basicSalary: amounts[0],
    allowanceAmount: amounts[1],
    employerContribution: amounts[2],
    otherSalaryCost: amounts[3],
    sourceNote: sourceNote || null,
  };
}

function updateCompensationTotalPreview() {
  const total = [
    compensationBasicSalary,
    compensationAllowanceAmount,
    compensationEmployerContribution,
    compensationOtherSalaryCost,
  ].reduce((sum, field) => {
    const value = Number(field.value ?? 0);
    return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);
  compensationTotalSalaryCost.value = formatCurrency(total);
}

async function saveCompensationFromModal() {
  if (compensationModalBusy) return;
  clearCompensationModalBanner();

  const payload = readCompensationFormValues();
  if (!payload) return;

  compensationPeriodStart.value = payload.periodStart;
  setCompensationModalBusy(true);
  try {
    const { error } = await hrSupabase.rpc(
      "fn_save_staff_compensation_monthly",
      {
        p_staff_id: payload.staffId,
        p_period_start: payload.periodStart,
        p_basic_salary: payload.basicSalary,
        p_allowance_amount: payload.allowanceAmount,
        p_employer_contribution: payload.employerContribution,
        p_other_salary_cost: payload.otherSalaryCost,
        p_source_note: payload.sourceNote,
      },
    );
    if (error)
      throw new Error(error.message || "Failed to save staff compensation.");

    closeCompensationModal(true);
    await reloadSnapshotAndRender();
    ensureSearchInteractive();
    showToast("Staff compensation saved.", "success");
  } catch (err) {
    console.error("[staff-directory-manager] saveCompensationFromModal:", err);
    showCompensationModalBanner(
      "error",
      err.message || "Failed to save staff compensation.",
    );
    showToast(err.message || "Failed to save staff compensation.", "error");
  } finally {
    setCompensationModalBusy(false);
  }
}

function openStaffModal(staffId = null) {
  prevFocus = document.activeElement;
  selectedStaffId = parseOptionalStaffId(staffId);
  modalMode = selectedStaffId == null ? "create" : "edit";

  clearModalBanner();
  populateMasterDropdowns();

  if (modalMode === "create") {
    staffModalTitle.textContent = "Add Staff";
    staffModalSubtitle.textContent = "Create a new staff master record.";
    setFormValues(null);
    staffDeactivateBtn.style.display = "none";
  } else {
    const staff = allStaffRows.find((r) => r.staffId === selectedStaffId);
    if (!staff) {
      showToast("Staff record not found.", "error");
      return;
    }
    staffModalTitle.textContent = "Edit Staff";
    staffModalSubtitle.textContent = `${staff.fullName} · ${staff.employeeCode}`;
    setFormValues(staff);
    staffDeactivateBtn.style.display = staff.isActive ? "inline-flex" : "none";
  }

  setModalBusy(false);
  staffModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  staffEmployeeCode.focus();
}

function closeStaffModal(force = false) {
  const forceClose = force === true;
  if (modalBusy && !forceClose) return;

  staffModal.classList.add("hidden");
  syncBodyOverflow();
  clearModalBanner();
  selectedStaffId = null;
  modalMode = "create";

  if (!forceClose) {
    try {
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
    } catch {
      // Ignore focus restore failures.
    }
  }
  prevFocus = null;
  if (forceClose) ensureSearchInteractive();
}

function setFormValues(staff) {
  staffEmployeeCode.value =
    staff?.employeeCode && staff.employeeCode !== "-" ? staff.employeeCode : "";
  staffFullName.value =
    staff?.fullName && staff.fullName !== "-" ? staff.fullName : "";
  staffDesignation.value =
    staff?.designation && staff.designation !== "-" ? staff.designation : "";
  staffCategoryId.value = asSelectValue(staff?.categoryId);
  staffStatusId.value = asSelectValue(staff?.statusId);
  staffUnitId.value = asSelectValue(staff?.unitId);
  staffSectionId.value = asSelectValue(staff?.sectionId);
  staffSubsectionId.value = asSelectValue(staff?.subsectionId);
  staffAreaId.value = asSelectValue(staff?.areaId);
  staffContactNo.value =
    staff?.contactNo && staff.contactNo !== "-" ? staff.contactNo : "";
  staffDob.value = asDateInputValue(staff?.dob);
  staffJoiningDate.value = asDateInputValue(staff?.joiningDate);
  staffWorkExpYears.value =
    staff?.workExpYears == null || staff.workExpYears === ""
      ? ""
      : String(staff.workExpYears);
  staffIsActive.value = staff?.isActive === false ? "false" : "true";
  staffRemarks.value =
    staff?.remarks && staff.remarks !== "-" ? staff.remarks : "";
}

function populateMasterDropdowns() {
  setSelectOptions(staffCategoryId, categoryRows, "category_id", [
    "category_label",
    "category_code",
  ]);
  setSelectOptions(staffStatusId, statusRows, "status_id", [
    "status_label",
    "status_code",
  ]);
  setSelectOptions(staffUnitId, unitRows, "unit_id", [
    "unit_label",
    "unit_code",
  ]);
  setSelectOptions(staffSectionId, sectionRows, "section_id", ["section_name"]);
  setSelectOptions(staffSubsectionId, subsectionRows, "subsection_id", [
    "subsection_name",
  ]);
  setSelectOptions(staffAreaId, areaRows, "area_id", ["area_name"]);
}

function setSelectOptions(selectEl, rows, idKey, labelKeys) {
  if (!selectEl) return;
  const list = Array.isArray(rows) ? rows : [];
  const unique = [
    ...new Map(list.map((r) => [String(r?.[idKey] ?? ""), r])).values(),
  ]
    .filter((r) => String(r?.[idKey] ?? "") !== "")
    .sort((a, b) =>
      getLabel(a, labelKeys).localeCompare(getLabel(b, labelKeys)),
    );

  selectEl.innerHTML = [
    '<option value="">Not Set</option>',
    ...unique.map(
      (row) =>
        `<option value="${escHtml(String(row[idKey]))}">${escHtml(getLabel(row, labelKeys))}</option>`,
    ),
  ].join("");
}

function getLabel(row, labelKeys) {
  for (const key of labelKeys) {
    const v = String(row?.[key] || "").trim();
    if (v) return v;
  }
  return "Unknown";
}

function asSelectValue(v) {
  const id = parseOptionalId(v);
  return id == null ? "" : String(id);
}

function asDateInputValue(v) {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : "";
}

function normalizeText(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

function parseOptionalId(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseNullableId(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function clearModalBanner() {
  if (!staffModalBanner) return;
  staffModalBanner.textContent = "";
  staffModalBanner.removeAttribute("data-type");
}

function showModalBanner(type, message) {
  if (!staffModalBanner) return;
  staffModalBanner.textContent = message || "";
  staffModalBanner.setAttribute("data-type", type);
}

function setModalBusy(isBusy, busyLabel = "Saving...") {
  modalBusy = !!isBusy;
  staffSaveBtn.disabled = modalBusy;
  staffDeactivateBtn.disabled = modalBusy;
  staffCancelBtn.disabled = modalBusy;
  staffModalClose.disabled = modalBusy;
  if (!modalBusy) {
    staffSaveBtn.textContent = "Save";
    staffDeactivateBtn.textContent = "Deactivate";
  } else if (busyLabel === "Deactivating...") {
    staffDeactivateBtn.textContent = busyLabel;
  } else {
    staffSaveBtn.textContent = busyLabel;
  }
}

async function saveStaffFromModal() {
  if (modalBusy) return;
  clearModalBanner();

  if (modalMode === "edit") {
    const existingStaff = allStaffRows.find(
      (r) => r.staffId === selectedStaffId,
    );
    if (existingStaff?.isActive === true && staffIsActive.value === "false") {
      showModalBanner(
        "error",
        "Use the Deactivate button to deactivate an active staff record.",
      );
      staffIsActive.focus();
      return;
    }
  }

  const employeeCode = (staffEmployeeCode.value || "").trim();
  const fullName = (staffFullName.value || "").trim();
  const designation = (staffDesignation.value || "").trim();
  const workExpRaw = (staffWorkExpYears.value || "").trim();

  if (!employeeCode) {
    showModalBanner("error", "Employee Code is required.");
    staffEmployeeCode.focus();
    return;
  }
  if (!fullName) {
    showModalBanner("error", "Full Name is required.");
    staffFullName.focus();
    return;
  }
  if (!designation) {
    showModalBanner("error", "Designation is required.");
    staffDesignation.focus();
    return;
  }

  let workExpYears = null;
  if (workExpRaw) {
    const parsed = Number(workExpRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showModalBanner(
        "error",
        "Work Experience Years must be a number greater than or equal to 0.",
      );
      staffWorkExpYears.focus();
      return;
    }
    workExpYears = parsed;
  }

  const payload = {
    staff_id: modalMode === "edit" ? selectedStaffId : null,
    employee_code: employeeCode,
    full_name: fullName,
    designation,
    category_id: parseNullableId(staffCategoryId.value),
    status_id: parseNullableId(staffStatusId.value),
    unit_id: parseNullableId(staffUnitId.value),
    section_id: parseNullableId(staffSectionId.value),
    subsection_id: parseNullableId(staffSubsectionId.value),
    area_id: parseNullableId(staffAreaId.value),
    contact_no: normalizeText(staffContactNo.value),
    dob: normalizeText(staffDob.value),
    joining_date: normalizeText(staffJoiningDate.value),
    work_exp_years: workExpYears,
    is_active: staffIsActive.value !== "false",
    remarks: normalizeText(staffRemarks.value),
  };

  setModalBusy(true);
  try {
    const { error } = await hrSupabase.rpc("fn_save_staff", {
      p_payload: payload,
    });
    if (error) throw new Error(error.message || "Failed to save staff record.");

    closeStaffModal(true);
    await reloadSnapshotAndRender();
    ensureSearchInteractive();
    showToast("Staff record saved.", "success");
  } catch (err) {
    console.error("[staff-directory-manager] saveStaffFromModal:", err);
    showModalBanner("error", err.message || "Failed to save staff record.");
    showToast(err.message || "Failed to save staff record.", "error");
  } finally {
    setModalBusy(false);
  }
}

async function deactivateStaffFromModal() {
  if (modalBusy || modalMode !== "edit") return;
  if (!Number.isFinite(Number(selectedStaffId))) return;

  const ok = await showConfirmModal({
    title: "Confirm Deactivation",
    message: "Deactivate this staff record?",
    confirmLabel: "Deactivate",
  });
  if (!ok) return;

  setModalBusy(true, "Deactivating...");
  clearModalBanner();
  try {
    const { error } = await hrSupabase.rpc("fn_deactivate_staff", {
      p_staff_id: Number(selectedStaffId),
      p_status_id: parseNullableId(staffStatusId.value),
      p_remarks: normalizeText(staffRemarks.value),
    });
    if (error)
      throw new Error(error.message || "Failed to deactivate staff record.");

    closeStaffModal(true);
    await reloadSnapshotAndRender();
    ensureSearchInteractive();
    showToast("Staff record deactivated.", "success");
  } catch (err) {
    console.error("[staff-directory-manager] deactivateStaffFromModal:", err);
    showModalBanner(
      "error",
      err.message || "Failed to deactivate staff record.",
    );
    showToast(err.message || "Failed to deactivate staff record.", "error");
  } finally {
    setModalBusy(false);
  }
}

function getMasterRows(tabId = masterModalType) {
  if (tabId === "categories") return allCategoryRows;
  if (tabId === "statuses") return allStatusRows;
  return allUnitRows;
}

function getMasterModalHeading(tabId) {
  if (tabId === "categories") return "Category";
  if (tabId === "statuses") return "Status";
  return "Unit";
}

function toggleMasterFieldsets(tabId) {
  categoryFields.classList.toggle("hidden", tabId !== "categories");
  statusFields.classList.toggle("hidden", tabId !== "statuses");
  unitFields.classList.toggle("hidden", tabId !== "units");
}

function clearMasterModalBanner() {
  masterModalBanner.textContent = "";
  masterModalBanner.removeAttribute("data-type");
}

function showMasterModalBanner(type, message) {
  masterModalBanner.textContent = message || "";
  masterModalBanner.setAttribute("data-type", type);
}

function setMasterModalBusy(isBusy, busyLabel = "Saving...") {
  masterModalBusy = !!isBusy;
  masterSaveBtn.disabled = masterModalBusy;
  masterDeactivateBtn.disabled = masterModalBusy;
  masterCancelBtn.disabled = masterModalBusy;
  masterModalClose.disabled = masterModalBusy;
  if (!masterModalBusy) {
    masterSaveBtn.textContent = "Save";
    masterDeactivateBtn.textContent = "Deactivate";
  } else if (busyLabel === "Deactivating...") {
    masterDeactivateBtn.textContent = busyLabel;
  } else {
    masterSaveBtn.textContent = busyLabel;
  }
}

function setMasterFormValues(tabId, row) {
  categoryCode.value = tabId === "categories" && row ? row.code : "";
  categoryLabel.value = tabId === "categories" && row ? row.label : "";
  categoryIsActive.value =
    tabId === "categories" && row?.isActive === false ? "false" : "true";

  statusCode.value = tabId === "statuses" && row ? row.code : "";
  statusLabel.value = tabId === "statuses" && row ? row.label : "";
  statusSortOrder.value =
    tabId === "statuses" && row?.sortOrder != null ? String(row.sortOrder) : "";
  statusIsActive.value =
    tabId === "statuses" && row?.isActive === false ? "false" : "true";

  unitCode.value = tabId === "units" && row ? row.code : "";
  unitLabel.value = tabId === "units" && row ? row.label : "";
  unitIsActive.value =
    tabId === "units" && row?.isActive === false ? "false" : "true";
}

function getPrimaryMasterField(tabId = masterModalType) {
  if (tabId === "categories") return categoryCode;
  if (tabId === "statuses") return statusCode;
  return unitCode;
}

function openMasterModal(tabId, rowId = null) {
  if (!["categories", "statuses", "units"].includes(tabId)) return;

  prevMasterFocus = document.activeElement;
  masterModalType = tabId;
  selectedMasterId = parseOptionalId(rowId);
  masterModalMode = selectedMasterId == null ? "create" : "edit";

  clearMasterModalBanner();
  toggleMasterFieldsets(tabId);

  const heading = getMasterModalHeading(tabId);
  if (masterModalMode === "create") {
    masterModalTitle.textContent = `Add ${heading}`;
    masterModalSubtitle.textContent = `Create a new ${heading.toLowerCase()} master record.`;
    setMasterFormValues(tabId, null);
    masterDeactivateBtn.style.display = "none";
  } else {
    const row = getMasterRows(tabId).find(
      (item) => item.id === selectedMasterId,
    );
    if (!row) {
      showToast(`${heading} record not found.`, "error");
      return;
    }
    masterModalTitle.textContent = `Edit ${heading}`;
    masterModalSubtitle.textContent = `${row.label} · ${row.code}`;
    setMasterFormValues(tabId, row);
    masterDeactivateBtn.style.display = row.isActive ? "inline-flex" : "none";
  }

  setMasterModalBusy(false);
  masterModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  getPrimaryMasterField(tabId)?.focus();
}

function closeMasterModal(force = false) {
  const forceClose = force === true;
  if (masterModalBusy && !forceClose) return;

  masterModal.classList.add("hidden");
  syncBodyOverflow();
  clearMasterModalBanner();
  selectedMasterId = null;
  masterModalMode = "create";
  masterModalType = "categories";

  if (!forceClose) {
    try {
      if (prevMasterFocus && typeof prevMasterFocus.focus === "function") {
        prevMasterFocus.focus();
      }
    } catch {
      // Ignore focus restore failures.
    }
  }
  prevMasterFocus = null;
  if (forceClose) ensureSearchInteractive();
}

async function saveMasterFromModal() {
  if (masterModalBusy) return;
  clearMasterModalBanner();

  try {
    if (masterModalType === "categories") {
      const existing =
        masterModalMode === "edit"
          ? getMasterRows("categories").find((r) => r.id === selectedMasterId)
          : null;
      if (existing?.isActive === true && categoryIsActive.value === "false") {
        showMasterModalBanner(
          "error",
          "Use the Deactivate button to deactivate an active category.",
        );
        categoryIsActive.focus();
        return;
      }

      const code = (categoryCode.value || "").trim();
      const label = (categoryLabel.value || "").trim();
      if (!code) {
        showMasterModalBanner("error", "Category Code is required.");
        categoryCode.focus();
        return;
      }
      if (!label) {
        showMasterModalBanner("error", "Category Label is required.");
        categoryLabel.focus();
        return;
      }

      setMasterModalBusy(true);
      const { error } = await hrSupabase.rpc("fn_save_staff_category", {
        p_id: masterModalMode === "edit" ? selectedMasterId : null,
        p_category_code: code,
        p_category_label: label,
        p_is_active: categoryIsActive.value !== "false",
      });
      if (error) throw new Error(error.message || "Failed to save category.");

      closeMasterModal(true);
      await reloadSnapshotAndRender();
      ensureSearchInteractive();
      showToast("Category saved.", "success");
      return;
    }

    if (masterModalType === "statuses") {
      const existing =
        masterModalMode === "edit"
          ? getMasterRows("statuses").find((r) => r.id === selectedMasterId)
          : null;
      if (existing?.isActive === true && statusIsActive.value === "false") {
        showMasterModalBanner(
          "error",
          "Use the Deactivate button to deactivate an active status.",
        );
        statusIsActive.focus();
        return;
      }

      const code = (statusCode.value || "").trim();
      const label = (statusLabel.value || "").trim();
      const sortRaw = (statusSortOrder.value || "").trim();
      if (!code) {
        showMasterModalBanner("error", "Status Code is required.");
        statusCode.focus();
        return;
      }
      if (!label) {
        showMasterModalBanner("error", "Status Label is required.");
        statusLabel.focus();
        return;
      }

      let sortOrder = null;
      if (sortRaw) {
        const parsed = Number(sortRaw);
        if (!Number.isInteger(parsed)) {
          showMasterModalBanner("error", "Sort Order must be an integer.");
          statusSortOrder.focus();
          return;
        }
        sortOrder = parsed;
      }

      setMasterModalBusy(true);
      const { error } = await hrSupabase.rpc("fn_save_staff_status", {
        p_id: masterModalMode === "edit" ? selectedMasterId : null,
        p_status_code: code,
        p_status_label: label,
        p_sort_order: sortOrder,
        p_is_active: statusIsActive.value !== "false",
      });
      if (error) throw new Error(error.message || "Failed to save status.");

      closeMasterModal(true);
      await reloadSnapshotAndRender();
      ensureSearchInteractive();
      showToast("Status saved.", "success");
      return;
    }

    const existing =
      masterModalMode === "edit"
        ? getMasterRows("units").find((r) => r.id === selectedMasterId)
        : null;
    if (existing?.isActive === true && unitIsActive.value === "false") {
      showMasterModalBanner(
        "error",
        "Use the Deactivate button to deactivate an active unit.",
      );
      unitIsActive.focus();
      return;
    }

    const code = (unitCode.value || "").trim();
    const label = (unitLabel.value || "").trim();
    if (!code) {
      showMasterModalBanner("error", "Unit Code is required.");
      unitCode.focus();
      return;
    }
    if (!label) {
      showMasterModalBanner("error", "Unit Label is required.");
      unitLabel.focus();
      return;
    }

    setMasterModalBusy(true);
    const { error } = await hrSupabase.rpc("fn_save_unit", {
      p_id: masterModalMode === "edit" ? selectedMasterId : null,
      p_unit_code: code,
      p_unit_label: label,
      p_is_active: unitIsActive.value !== "false",
    });
    if (error) throw new Error(error.message || "Failed to save unit.");

    closeMasterModal(true);
    await reloadSnapshotAndRender();
    ensureSearchInteractive();
    showToast("Unit saved.", "success");
  } catch (err) {
    console.error("[staff-directory-manager] saveMasterFromModal:", err);
    showMasterModalBanner("error", err.message || "Failed to save record.");
    showToast(err.message || "Failed to save record.", "error");
  } finally {
    setMasterModalBusy(false);
  }
}

async function deactivateMasterFromModal() {
  if (
    masterModalBusy ||
    masterModalMode !== "edit" ||
    selectedMasterId == null
  ) {
    return;
  }

  const heading = getMasterModalHeading(masterModalType);
  const ok = await showConfirmModal({
    title: "Confirm Deactivation",
    message: `Deactivate this ${heading.toLowerCase()} record?`,
    confirmLabel: "Deactivate",
  });
  if (!ok) return;

  setMasterModalBusy(true, "Deactivating...");
  clearMasterModalBanner();
  try {
    let error = null;
    if (masterModalType === "categories") {
      ({ error } = await hrSupabase.rpc("fn_deactivate_staff_category", {
        p_id: selectedMasterId,
      }));
    } else if (masterModalType === "statuses") {
      ({ error } = await hrSupabase.rpc("fn_deactivate_staff_status", {
        p_id: selectedMasterId,
      }));
    } else {
      ({ error } = await hrSupabase.rpc("fn_deactivate_unit", {
        p_id: selectedMasterId,
      }));
    }

    if (error) {
      throw new Error(
        error.message || `Failed to deactivate ${heading.toLowerCase()}.`,
      );
    }

    closeMasterModal(true);
    await reloadSnapshotAndRender();
    ensureSearchInteractive();
    showToast(`${heading} deactivated.`, "success");
  } catch (err) {
    console.error("[staff-directory-manager] deactivateMasterFromModal:", err);
    showMasterModalBanner(
      "error",
      err.message || `Failed to deactivate ${heading.toLowerCase()}.`,
    );
    showToast(
      err.message || `Failed to deactivate ${heading.toLowerCase()}.`,
      "error",
    );
  } finally {
    setMasterModalBusy(false);
  }
}

function buildFilterPanel() {
  const activeFilters = filtersByTab[activeTab] || {};

  if (activeTab !== "staff") {
    filterPanelBody.innerHTML = buildFilterGroup(
      "Active Status",
      "activeStatus",
      [
        { value: "all", label: "All" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
      activeFilters.activeStatus || "all",
    );
    return;
  }

  const uniqueCategories = [
    ...new Map(categoryRows.map((c) => [c.category_id, c])).values(),
  ];
  const uniqueStatuses = [
    ...new Map(statusRows.map((s) => [s.status_id, s])).values(),
  ];
  const uniqueUnits = [
    ...new Map(unitRows.map((u) => [u.unit_id, u])).values(),
  ];
  const uniqueSections = [
    ...new Map(sectionRows.map((s) => [s.section_id, s])).values(),
  ];

  filterPanelBody.innerHTML = [
    buildFilterGroup(
      "Staff Active",
      "staffActive",
      [
        { value: "all", label: "All" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
      activeFilters.staffActive,
    ),
    buildFilterGroup(
      "Staff Category",
      "staffCategory",
      [
        { value: "all", label: "All" },
        ...uniqueCategories.map((c) => ({
          value: String(c.category_id),
          label: String(c.category_label || c.category_code || "Unknown"),
        })),
      ],
      activeFilters.staffCategory,
    ),
    buildFilterGroup(
      "HR Status",
      "hrStatus",
      [
        { value: "all", label: "All" },
        ...uniqueStatuses.map((s) => ({
          value: String(s.status_id),
          label: String(s.status_label || s.status_code || "Unknown"),
        })),
      ],
      activeFilters.hrStatus,
    ),
    buildFilterGroup(
      "Unit",
      "unit",
      [
        { value: "all", label: "All" },
        ...uniqueUnits.map((u) => ({
          value: String(u.unit_id),
          label: String(u.unit_label || u.unit_code || "Unknown"),
        })),
      ],
      activeFilters.unit,
    ),
    buildFilterGroup(
      "Section",
      "section",
      [
        { value: "all", label: "All" },
        ...uniqueSections.map((s) => ({
          value: String(s.section_id),
          label: String(s.section_name || "Unknown"),
        })),
      ],
      activeFilters.section,
    ),
  ].join("");
}

function buildFilterGroup(label, filterId, options, currentValue) {
  const optionsHtml = options
    .map(
      (opt) =>
        `<option value="${escHtml(opt.value)}" ${opt.value === currentValue ? "selected" : ""}>${escHtml(opt.label)}</option>`,
    )
    .join("");

  return `
    <div class="filter-group">
      <label for="filter_${filterId}">${escHtml(label)}</label>
      <select id="filter_${filterId}" class="filter-select" data-filter-id="${escHtml(filterId)}">
        ${optionsHtml}
      </select>
    </div>
  `;
}

function positionFilterPanel() {
  if (!filterBtn || !filterPanel) return;

  const vw = window.innerWidth || document.documentElement.clientWidth;

  if (vw <= 520) {
    filterPanel.style.left = "8px";
    filterPanel.style.right = "8px";
    filterPanel.style.top = "auto";
    filterPanel.style.bottom = "12px";
    filterPanel.style.width = "auto";
    filterPanel.style.maxWidth = "none";
    filterPanel.style.minWidth = "0";
    return;
  }

  const rect = filterBtn.getBoundingClientRect();
  const panelWidth = 320;
  let left = rect.right - panelWidth;

  if (left < 8) left = 8;
  if (left + panelWidth > vw - 8) left = vw - panelWidth - 8;

  filterPanel.style.top = rect.bottom + 6 + "px";
  filterPanel.style.left = left + "px";
  filterPanel.style.right = "auto";
  filterPanel.style.bottom = "auto";
  filterPanel.style.width = "";
  filterPanel.style.maxWidth = "320px";
  filterPanel.style.minWidth = "260px";
}

function closeFilterPanel() {
  filterPanel.classList.remove("open");
}

function applyFilters() {
  const activeFilters = filtersByTab[activeTab] || {};
  document.querySelectorAll(".filter-select").forEach((select) => {
    const filterId = select.dataset.filterId;
    if (
      filterId &&
      Object.prototype.hasOwnProperty.call(activeFilters, filterId)
    ) {
      activeFilters[filterId] = select.value;
    }
  });

  applySearchAndFilters();
  renderSummary();
  renderTable();
}

function clearFilters() {
  const activeFilters = filtersByTab[activeTab] || {};
  Object.keys(activeFilters).forEach((key) => {
    activeFilters[key] = "all";
    const select = document.getElementById(`filter_${key}`);
    if (select) select.value = "all";
  });

  applySearchAndFilters();
  renderSummary();
  renderTable();
}

function updateFilterBadge() {
  const activeFilterCount = Object.values(filtersByTab[activeTab] || {}).filter(
    (v) => v !== "all",
  ).length;
  if (activeFilterCount > 0) {
    filterBadge.textContent = String(activeFilterCount);
    filterBadge.classList.add("visible");
  } else {
    filterBadge.classList.remove("visible");
  }
}

function setStatus(message, type = "info") {
  statusArea.style.display = "";
  statusArea.textContent = message;
  statusArea.setAttribute("data-type", type);
}

function clearStatus() {
  statusArea.textContent = "";
  statusArea.removeAttribute("data-type");
  statusArea.style.display = "";
}

function showToast(message, type = "info") {
  const container = $("labToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.style.cssText = `
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 300px;
    animation: slideIn 0.2s ease-out;
  `;

  if (type === "error") {
    toast.style.background = "#fef2f2";
    toast.style.color = "#991b1b";
    toast.style.border = "1px solid #fecaca";
  } else if (type === "success") {
    toast.style.background = "#dcfce7";
    toast.style.color = "#166534";
    toast.style.border = "1px solid #bbf7d0";
  } else {
    toast.style.background = "#eff6ff";
    toast.style.color = "#1e40af";
    toast.style.border = "1px solid #bfdbfe";
  }

  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.2s ease-in";
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

function escHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatCurrency(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function anyPageModalOpen() {
  return (
    (staffModal && !staffModal.classList.contains("hidden")) ||
    (masterModal && !masterModal.classList.contains("hidden")) ||
    (compensationModal && !compensationModal.classList.contains("hidden")) ||
    (confirmModal && !confirmModal.classList.contains("hidden"))
  );
}

function syncBodyOverflow() {
  document.body.style.overflow = anyPageModalOpen() ? "hidden" : "";
}

function ensureSearchInteractive() {
  if (!staffSearch) return;
  staffSearch.disabled = false;
  staffSearch.removeAttribute("readonly");
  syncBodyOverflow();
}

function showConfirmModal({
  title = "Confirm",
  message = "",
  confirmLabel = "Confirm",
} = {}) {
  return new Promise((resolve) => {
    if (!confirmModal || !confirmModalOk) {
      resolve(false);
      return;
    }
    if (confirmResolve) {
      finishConfirmModal(false);
    }

    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalOk.textContent = confirmLabel || "Confirm";
    confirmResolve = resolve;
    confirmModal.classList.remove("hidden");
    syncBodyOverflow();
    confirmModalOk.focus();
  });
}

function finishConfirmModal(result) {
  if (!confirmResolve) return;
  const resolve = confirmResolve;
  confirmResolve = null;
  confirmModal?.classList.add("hidden");
  syncBodyOverflow();
  resolve(!!result);
}
