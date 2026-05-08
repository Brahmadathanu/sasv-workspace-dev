/* test-method-master.js — refactored to match lab-analysis-queue patterns */
import { labSupabase, supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "lab-test-method-master";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const statusArea = $("statusArea");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const tmSearch = $("tmSearch");
const tmSearchClear = $("tmSearchClear");
const tmRowCount = $("tmRowCount");
const tmThead = $("tmThead");
const tmTbody = $("tmTbody");
const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");
const addBtn = $("addBtn");
const filterBtn = $("filterBtn");
const filterBadge = $("filterBadge");
const filterPanel = $("filterPanel");
const filterPanelBody = $("filterPanelBody");
const filterPanelClose = $("filterPanelClose");
const filterApply = $("filterApply");
const filterClear = $("filterClear");

const kpiActiveTests = $("kpiActiveTests");
const kpiActiveMethods = $("kpiActiveMethods");
const kpiMissingDefault = $("kpiMissingDefault");
const kpiInactiveTests = $("kpiInactiveTests");
const kpiInactiveMethods = $("kpiInactiveMethods");

// Test modal
const testModal = $("testModal");
const testModalTitle = $("testModalTitle");
const testModalSubtitle = $("testModalSubtitle");
const testModalId = $("testModalId");
const testModalCode = $("testModalCode");
const testModalName = $("testModalName");
const testModalKind = $("testModalKind");
const testModalUom = $("testModalUom");
const testModalMethod = $("testModalMethod");
const testModalActiveWrap = $("testModalActiveWrap");
const testModalActiveDisp = $("testModalActiveDisplay");
const testModalBanner = $("testModalBanner");
const testModalSave = $("testModalSave");
const testModalDeactivate = $("testModalDeactivate");
const testModalClose = $("testModalClose");
const testModalCancel = $("testModalCancel");

// Method modal
const methodModal = $("methodModal");
const methodModalTitle = $("methodModalTitle");
const methodModalSubtitle = $("methodModalSubtitle");
const methodModalId = $("methodModalId");
const methodModalCode = $("methodModalCode");
const methodModalName = $("methodModalName");
const methodModalDesc = $("methodModalDesc");
const methodModalActiveWrap = $("methodModalActiveWrap");
const methodModalActiveDisp = $("methodModalActiveDisplay");
const methodModalBanner = $("methodModalBanner");
const methodModalSave = $("methodModalSave");
const methodModalDeactivate = $("methodModalDeactivate");
const methodModalClose = $("methodModalClose");
const methodModalCancel = $("methodModalCancel");

// Mapping modal
const mappingModal = $("mappingModal");
const mappingModalTestId = $("mappingModalTestId");
const mappingModalTestName = $("mappingModalTestName");
const mappingModalResKind = $("mappingModalResultKind");
const mappingModalCurrent = $("mappingModalCurrent");
const mappingModalMethod = $("mappingModalMethod");
const mappingModalRemarks = $("mappingModalRemarks");
const mappingModalBanner = $("mappingModalBanner");
const mappingModalSave = $("mappingModalSave");
const mappingModalClear = $("mappingModalClear");
const mappingModalClose = $("mappingModalClose");
const mappingModalCancel = $("mappingModalCancel");
const mappingHistoryContent = $("mappingHistoryContent");

// ── State ─────────────────────────────────────────────────────────────────────
let tests = [];
let methods = [];
let mappings = [];
let activeDefaultMethodByTestId = new Map(); // testId -> mapping row

let currentTab = "testMaster";
let filteredRows = [];
let searchTerm = "";
let searchDebounceTimer = null;
let userId = null;
let prevFocus = null;

// Filters per tab (reset on tab switch)
const filtersByTab = {
  testMaster: {
    activeStatus: "all",
    resultKind: "all",
    defaultStatus: "all",
    methodId: "all",
  },
  methodMaster: { activeStatus: "all", usageStatus: "all" },
  defaultMapping: {
    activeStatus: "all",
    mappingStatus: "all",
    resultKind: "all",
    methodId: "all",
  },
};

// Tab definitions
const TABS = [
  { id: "testMaster", label: "Test Master" },
  { id: "methodMaster", label: "Method Master" },
  { id: "defaultMapping", label: "Default Method Mapping" },
];

// Search placeholders per tab
const SEARCH_PLACEHOLDERS = {
  testMaster: "Search test name, result kind, or default method…",
  methodMaster: "Search method name or description…",
  defaultMapping: "Search test name, default method, or mapping status…",
};

// ── Boot ──────────────────────────────────────────────────────────────────────
initPage();

async function initPage() {
  renderTabControls();
  wireEvents();

  userId = await resolveUserId();
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const canView = await checkModuleAccess(userId);
  if (!canView) {
    setStatus("You do not have permission to open this module.", "error");
    return;
  }

  await loadAllData();
}

// ── Tab controls ──────────────────────────────────────────────────────────────
function renderTabControls() {
  lensPills.innerHTML = TABS.map(
    (t) =>
      `<button class="pill${t.id === currentTab ? " active" : ""}" data-tab="${t.id}" type="button">${escHtml(t.label)}</button>`,
  ).join("");

  // Sync mobile select
  syncMobileTabSelect();
  updateAddButtonForTab();
}

function syncMobileTabSelect() {
  if (lensSelect) lensSelect.value = currentTab;
}

function switchTab(tabId) {
  if (!tabId || currentTab === tabId) return;
  closeFilterPanel();
  currentTab = tabId;

  // Update pills
  lensPills.querySelectorAll(".pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.tab === tabId);
  });
  syncMobileTabSelect();

  // Update search placeholder
  if (tmSearch) tmSearch.placeholder = SEARCH_PLACEHOLDERS[tabId] || "Search…";

  // Reset search
  searchTerm = "";
  if (tmSearch) tmSearch.value = "";
  if (tmSearchClear) tmSearchClear.classList.remove("visible");

  applyCurrentSearchAndFilters();
  renderCurrentTable();
  updateFilterBadge();
  updateAddButtonForTab();
  buildFilterPanel();
}

function updateAddButtonForTab() {
  if (!addBtn) return;
  const shouldShow =
    currentTab === "testMaster" || currentTab === "methodMaster";
  addBtn.style.display = shouldShow ? "inline-flex" : "none";
  addBtn.title =
    currentTab === "testMaster"
      ? "Add New Test"
      : currentTab === "methodMaster"
        ? "Add New Method"
        : "Add New";
  addBtn.setAttribute(
    "aria-label",
    currentTab === "testMaster"
      ? "Add new test"
      : currentTab === "methodMaster"
        ? "Add new method"
        : "Add new record",
  );
}

// ── Wire events ───────────────────────────────────────────────────────────────
function wireEvents() {
  homeBtn.addEventListener("click", () => {
    if (typeof Platform.goHome === "function") Platform.goHome();
    else window.location.href = "index.html";
  });

  refreshBtn.addEventListener("click", () => loadAllData());

  addBtn.addEventListener("click", () => {
    if (currentTab === "testMaster") openNewTestModal();
    else if (currentTab === "methodMaster") openNewMethodModal();
    else if (currentTab === "defaultMapping") return;
  });

  // Lens pills
  lensPills.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill[data-tab]");
    if (pill) switchTab(pill.dataset.tab);
  });

  // Mobile select
  lensSelect.addEventListener("change", () => switchTab(lensSelect.value));

  // Search
  tmSearch.addEventListener("input", () => {
    searchTerm = tmSearch.value.trim();
    tmSearchClear.classList.toggle("visible", searchTerm.length > 0);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applyCurrentSearchAndFilters();
      renderCurrentTable();
    }, 280);
  });
  tmSearchClear.addEventListener("click", () => {
    tmSearch.value = "";
    searchTerm = "";
    tmSearchClear.classList.remove("visible");
    applyCurrentSearchAndFilters();
    renderCurrentTable();
    tmSearch.focus();
  });

  // Table row clicks
  tmTbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr.tm-row[data-id]");
    if (!row) return;
    const id = Number(row.dataset.id);
    if (!Number.isFinite(id)) return;
    if (currentTab === "testMaster") openEditTestModal(id);
    else if (currentTab === "methodMaster") openEditMethodModal(id);
    else if (currentTab === "defaultMapping") openMappingModal(id);
  });

  // Keyboard: Enter key on row
  tmTbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const row = e.target.closest("tr.tm-row[data-id]");
    if (row) row.click();
  });

  // Filter
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

  // Test modal
  testModalSave.addEventListener("click", saveTestFromModal);
  testModalDeactivate.addEventListener("click", deactivateTestFromModal);
  testModalClose.addEventListener("click", closeTestModal);
  testModalCancel.addEventListener("click", closeTestModal);
  testModal.addEventListener("click", (e) => {
    if (e.target === testModal) closeTestModal();
  });

  // Method modal
  methodModalSave.addEventListener("click", saveMethodFromModal);
  methodModalDeactivate.addEventListener("click", deactivateMethodFromModal);
  methodModalClose.addEventListener("click", closeMethodModal);
  methodModalCancel.addEventListener("click", closeMethodModal);
  methodModal.addEventListener("click", (e) => {
    if (e.target === methodModal) closeMethodModal();
  });

  // Mapping modal
  mappingModalSave.addEventListener("click", saveMappingFromModal);
  mappingModalClear.addEventListener("click", clearMappingFromModal);
  mappingModalClose.addEventListener("click", closeMappingModal);
  mappingModalCancel.addEventListener("click", closeMappingModal);
  mappingModal.addEventListener("click", (e) => {
    if (e.target === mappingModal) closeMappingModal();
  });

  // Escape closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!testModal.classList.contains("hidden")) closeTestModal();
    else if (!methodModal.classList.contains("hidden")) closeMethodModal();
    else if (!mappingModal.classList.contains("hidden")) closeMappingModal();
    else if (filterPanel.classList.contains("open")) closeFilterPanel();
  });

  // Close filter panel when clicking outside
  document.addEventListener("click", (e) => {
    if (
      filterPanel.classList.contains("open") &&
      !filterPanel.contains(e.target) &&
      !filterBtn.contains(e.target)
    ) {
      closeFilterPanel();
    }
  });
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadAllData() {
  setStatus("Loading test and method masters…", "loading");
  refreshBtn.disabled = true;

  try {
    await Promise.all([loadTests(), loadMethods(), loadMappings()]);
    buildActiveDefaultsMap();
    renderSummary();
    applyCurrentSearchAndFilters();
    renderCurrentTable();
    clearStatus();
    showToast("Data refreshed", "success");
  } catch (err) {
    console.error("[test-method-master] loadAllData:", err);
    setStatus("Error loading data: " + (err.message || String(err)), "error");
  } finally {
    refreshBtn.disabled = false;
  }
}

async function loadTests() {
  const { data, error } = await labSupabase
    .from("test_master")
    .select("*")
    .order("is_active", { ascending: false })
    .order("test_name", { ascending: true });
  if (error) throw new Error("Tests: " + error.message);
  tests = Array.isArray(data) ? data : [];
}

async function loadMethods() {
  const { data, error } = await labSupabase
    .from("test_method")
    .select("*")
    .order("is_active", { ascending: false })
    .order("method_name", { ascending: true });
  if (error) throw new Error("Methods: " + error.message);
  methods = Array.isArray(data) ? data : [];
}

async function loadMappings() {
  const { data, error } = await labSupabase
    .from("test_default_method_map")
    .select(
      "id, test_id, method_id, is_active, remarks, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("Mappings: " + error.message);
  mappings = Array.isArray(data) ? data : [];
}

function buildActiveDefaultsMap() {
  activeDefaultMethodByTestId = new Map();
  const active = mappings
    .filter((r) => r?.is_active === true)
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0),
    );
  active.forEach((row) => {
    const key = Number(row.test_id);
    if (!activeDefaultMethodByTestId.has(key))
      activeDefaultMethodByTestId.set(key, row);
  });
}

// ── Summary KPIs ──────────────────────────────────────────────────────────────
function renderSummary() {
  const activeTests = tests.filter((t) => t.is_active).length;
  const inactiveTests = tests.filter((t) => !t.is_active).length;
  const activeMethods = methods.filter((m) => m.is_active).length;
  const inactiveMethods = methods.filter((m) => !m.is_active).length;
  const activeTestIds = tests
    .filter((t) => t.is_active)
    .map((t) => Number(t.id));
  const withoutDefault = activeTestIds.filter(
    (id) => !activeDefaultMethodByTestId.has(id),
  ).length;

  kpiActiveTests.textContent = activeTests;
  kpiActiveMethods.textContent = activeMethods;
  kpiMissingDefault.textContent = withoutDefault;
  kpiInactiveTests.textContent = inactiveTests;
  kpiInactiveMethods.textContent = inactiveMethods;
}

// ── Row computation ───────────────────────────────────────────────────────────
function getRowsForCurrentTab() {
  if (currentTab === "testMaster") return tests;
  if (currentTab === "methodMaster") return methods;
  if (currentTab === "defaultMapping") return tests; // built from tests
  return [];
}

function applyCurrentSearchAndFilters() {
  const baseRows = getRowsForCurrentTab();
  const f = filtersByTab[currentTab] || {};
  const q = searchTerm.toLowerCase();

  filteredRows = baseRows.filter((row) => {
    if (currentTab === "testMaster") {
      const activeMap = activeDefaultMethodByTestId.get(Number(row.id));
      const method = methods.find(
        (m) => Number(m.id) === Number(activeMap?.method_id),
      );
      const haystack = [
        row.test_name,
        row.result_kind,
        method?.method_name,
        row.test_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !haystack.includes(q)) return false;
      if (f.activeStatus === "active" && !row.is_active) return false;
      if (f.activeStatus === "inactive" && row.is_active) return false;
      if (f.resultKind !== "all" && row.result_kind !== f.resultKind)
        return false;
      if (
        f.defaultStatus === "mapped" &&
        !activeDefaultMethodByTestId.has(Number(row.id))
      )
        return false;
      if (
        f.defaultStatus === "unmapped" &&
        activeDefaultMethodByTestId.has(Number(row.id))
      )
        return false;
      if (f.methodId !== "all" && String(activeMap?.method_id) !== f.methodId)
        return false;
      return true;
    } else if (currentTab === "methodMaster") {
      const haystack = [row.method_name, row.description, row.method_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (f.activeStatus === "active" && !row.is_active) return false;
      if (f.activeStatus === "inactive" && row.is_active) return false;
      if (f.usageStatus === "used") {
        const isUsed = Array.from(activeDefaultMethodByTestId.values()).some(
          (map) => Number(map.method_id) === Number(row.id),
        );
        if (!isUsed) return false;
      }
      if (f.usageStatus === "unused") {
        const isUsed = Array.from(activeDefaultMethodByTestId.values()).some(
          (map) => Number(map.method_id) === Number(row.id),
        );
        if (isUsed) return false;
      }
      return true;
    } else if (currentTab === "defaultMapping") {
      const activeMap = activeDefaultMethodByTestId.get(Number(row.id));
      const method = methods.find(
        (m) => Number(m.id) === Number(activeMap?.method_id),
      );
      const isMapped = !!activeMap;
      const mappingLabel = isMapped ? "mapped" : "unmapped";
      const haystack = [
        row.test_name,
        row.result_kind,
        method?.method_name,
        mappingLabel,
        row.test_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !haystack.includes(q)) return false;
      if (f.activeStatus === "active" && !row.is_active) return false;
      if (f.activeStatus === "inactive" && row.is_active) return false;
      if (f.mappingStatus === "mapped" && !isMapped) return false;
      if (f.mappingStatus === "unmapped" && isMapped) return false;
      if (f.resultKind !== "all" && row.result_kind !== f.resultKind)
        return false;
      if (f.methodId !== "all" && String(activeMap?.method_id) !== f.methodId)
        return false;
      return true;
    }
    return true;
  });
}

// ── Table rendering ───────────────────────────────────────────────────────────
function renderCurrentTable() {
  if (currentTab === "testMaster") renderTestTable(filteredRows);
  else if (currentTab === "methodMaster") renderMethodTable(filteredRows);
  else if (currentTab === "defaultMapping")
    renderDefaultMappingTable(filteredRows);

  const total = getRowsForCurrentTab().length;
  const shown = filteredRows.length;
  tmRowCount.textContent =
    total === shown
      ? `Showing ${shown} record${shown !== 1 ? "s" : ""}`
      : `Showing ${shown} of ${total} records`;
}

function renderTestTable(rows) {
  tmThead.innerHTML = `<tr>
    <th>Test Name</th>
    <th class="col-hide-mobile">Result Kind</th>
    <th class="col-hide-mobile">Default Method</th>
    <th>Active</th>
    <th class="col-hide-mobile">Updated</th>
  </tr>`;

  if (!rows.length) {
    tmTbody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No tests found.</td></tr>';
    return;
  }

  tmTbody.innerHTML = rows
    .map((row) => {
      const activeMap = activeDefaultMethodByTestId.get(Number(row.id));
      const method = methods.find(
        (m) => Number(m.id) === Number(activeMap?.method_id),
      );
      const defaultLabel = method
        ? escHtml(method.method_name || "")
        : '<span style="color:#9ca3af;font-size:11.5px;">No default</span>';
      const kindChip = resultKindBadge(row.result_kind);

      return `<tr class="tm-row" data-id="${escHtml(row.id)}" tabindex="0">
      <td>
        <div class="item-primary">${escHtml(row.test_name || "")}</div>
        <span class="item-secondary col-hide-mobile" style="display:none"></span>
      </td>
      <td class="col-hide-mobile">${kindChip}</td>
      <td class="col-hide-mobile">${defaultLabel}</td>
      <td>${activeBadge(row.is_active)}</td>
      <td class="col-hide-mobile" style="font-size:12px;color:var(--muted,#6b7280)">${escHtml(formatDateTime(row.updated_at))}</td>
    </tr>`;
    })
    .join("");
}

function renderMethodTable(rows) {
  tmThead.innerHTML = `<tr>
    <th>Method Name</th>
    <th class="col-hide-mobile">Description</th>
    <th>Active</th>
    <th class="col-hide-mobile">Updated</th>
  </tr>`;

  if (!rows.length) {
    tmTbody.innerHTML =
      '<tr><td colspan="4" class="empty-state">No methods found.</td></tr>';
    return;
  }

  tmTbody.innerHTML = rows
    .map(
      (row) =>
        `<tr class="tm-row" data-id="${escHtml(row.id)}" tabindex="0">
      <td>
        <div class="item-primary">${escHtml(row.method_name || "")}</div>
        <span class="item-secondary" style="display:block;"></span>
      </td>
      <td class="col-hide-mobile" style="color:var(--muted,#6b7280);font-size:12.5px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(row.description || "—")}</td>
      <td>${activeBadge(row.is_active)}</td>
      <td class="col-hide-mobile" style="font-size:12px;color:var(--muted,#6b7280)">${escHtml(formatDateTime(row.updated_at))}</td>
    </tr>`,
    )
    .join("");
}

function renderDefaultMappingTable(rows) {
  tmThead.innerHTML = `<tr>
    <th>Test Name</th>
    <th class="col-hide-mobile">Result Kind</th>
    <th class="col-hide-mobile">Default Method</th>
    <th>Mapping</th>
    <th class="col-hide-mobile">Active</th>
    <th class="col-hide-mobile">Updated</th>
  </tr>`;

  if (!rows.length) {
    tmTbody.innerHTML =
      '<tr><td colspan="6" class="empty-state">No tests found.</td></tr>';
    return;
  }

  tmTbody.innerHTML = rows
    .map((row) => {
      const activeMap = activeDefaultMethodByTestId.get(Number(row.id));
      const method = methods.find(
        (m) => Number(m.id) === Number(activeMap?.method_id),
      );
      const isMapped = !!activeMap;
      const defaultLabel = method
        ? escHtml(method.method_name || "")
        : '<span style="color:#9ca3af;font-size:11.5px;">No default method assigned</span>';
      const mappingChip = isMapped
        ? '<span class="badge badge-mapped">Mapped</span>'
        : '<span class="badge badge-unmapped">Unmapped</span>';

      return `<tr class="tm-row" data-id="${escHtml(row.id)}" tabindex="0">
      <td><div class="item-primary">${escHtml(row.test_name || "")}</div></td>
      <td class="col-hide-mobile">${resultKindBadge(row.result_kind)}</td>
      <td class="col-hide-mobile">${defaultLabel}</td>
      <td>${mappingChip}</td>
      <td class="col-hide-mobile">${activeBadge(row.is_active)}</td>
      <td class="col-hide-mobile" style="font-size:12px;color:var(--muted,#6b7280)">${escHtml(formatDateTime(activeMap?.updated_at || row.updated_at))}</td>
    </tr>`;
    })
    .join("");
}

// ── Filter panel ──────────────────────────────────────────────────────────────
function buildFilterPanel() {
  const f = filtersByTab[currentTab];
  const activeMethods = methods.filter((m) => m.is_active);
  let html = "";

  if (currentTab === "testMaster") {
    html = `
      <div class="filter-group">
        <label>Active Status</label>
        <select id="fp_activeStatus">
          <option value="all"${f.activeStatus === "all" ? " selected" : ""}>All</option>
          <option value="active"${f.activeStatus === "active" ? " selected" : ""}>Active</option>
          <option value="inactive"${f.activeStatus === "inactive" ? " selected" : ""}>Inactive</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Result Kind</label>
        <select id="fp_resultKind">
          <option value="all"${f.resultKind === "all" ? " selected" : ""}>All</option>
          <option value="NUMERIC"${f.resultKind === "NUMERIC" ? " selected" : ""}>NUMERIC</option>
          <option value="TEXT"${f.resultKind === "TEXT" ? " selected" : ""}>TEXT</option>
          <option value="PASS_FAIL"${f.resultKind === "PASS_FAIL" ? " selected" : ""}>PASS_FAIL</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Default Method</label>
        <select id="fp_defaultStatus">
          <option value="all"${f.defaultStatus === "all" ? " selected" : ""}>All</option>
          <option value="mapped"${f.defaultStatus === "mapped" ? " selected" : ""}>With Default</option>
          <option value="unmapped"${f.defaultStatus === "unmapped" ? " selected" : ""}>Without Default</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Specific Method</label>
        <select id="fp_methodId">
          <option value="all"${f.methodId === "all" ? " selected" : ""}>All Methods</option>
          ${activeMethods.map((m) => `<option value="${escHtml(m.id)}"${f.methodId === String(m.id) ? " selected" : ""}>${escHtml(`${m.method_name || ""} (${m.method_code || "-"})`)}</option>`).join("")}
        </select>
      </div>`;
  } else if (currentTab === "methodMaster") {
    html = `
      <div class="filter-group">
        <label>Active Status</label>
        <select id="fp_activeStatus">
          <option value="all"${f.activeStatus === "all" ? " selected" : ""}>All</option>
          <option value="active"${f.activeStatus === "active" ? " selected" : ""}>Active</option>
          <option value="inactive"${f.activeStatus === "inactive" ? " selected" : ""}>Inactive</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Usage Status</label>
        <select id="fp_usageStatus">
          <option value="all"${f.usageStatus === "all" ? " selected" : ""}>All</option>
          <option value="used"${f.usageStatus === "used" ? " selected" : ""}>Used as Default</option>
          <option value="unused"${f.usageStatus === "unused" ? " selected" : ""}>Not Used as Default</option>
        </select>
      </div>`;
  } else if (currentTab === "defaultMapping") {
    html = `
      <div class="filter-group">
        <label>Mapping Status</label>
        <select id="fp_mappingStatus">
          <option value="all"${f.mappingStatus === "all" ? " selected" : ""}>All</option>
          <option value="mapped"${f.mappingStatus === "mapped" ? " selected" : ""}>Mapped</option>
          <option value="unmapped"${f.mappingStatus === "unmapped" ? " selected" : ""}>Unmapped</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Test Active Status</label>
        <select id="fp_activeStatus">
          <option value="all"${f.activeStatus === "all" ? " selected" : ""}>All</option>
          <option value="active"${f.activeStatus === "active" ? " selected" : ""}>Active Tests</option>
          <option value="inactive"${f.activeStatus === "inactive" ? " selected" : ""}>Inactive Tests</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Result Kind</label>
        <select id="fp_resultKind">
          <option value="all"${f.resultKind === "all" ? " selected" : ""}>All</option>
          <option value="NUMERIC"${f.resultKind === "NUMERIC" ? " selected" : ""}>NUMERIC</option>
          <option value="TEXT"${f.resultKind === "TEXT" ? " selected" : ""}>TEXT</option>
          <option value="PASS_FAIL"${f.resultKind === "PASS_FAIL" ? " selected" : ""}>PASS_FAIL</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Specific Method</label>
        <select id="fp_methodId">
          <option value="all"${f.methodId === "all" ? " selected" : ""}>All Methods</option>
          ${activeMethods.map((m) => `<option value="${escHtml(m.id)}"${f.methodId === String(m.id) ? " selected" : ""}>${escHtml(`${m.method_name || ""} (${m.method_code || "-"})`)}</option>`).join("")}
        </select>
      </div>`;
  }

  filterPanelBody.innerHTML = html;
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
  const panelWidth = 300;
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

function applyFilters() {
  const f = filtersByTab[currentTab];
  const get = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "all";
  };

  if (currentTab === "testMaster") {
    f.activeStatus = get("fp_activeStatus");
    f.resultKind = get("fp_resultKind");
    f.defaultStatus = get("fp_defaultStatus");
    f.methodId = get("fp_methodId");
  } else if (currentTab === "methodMaster") {
    f.activeStatus = get("fp_activeStatus");
    f.usageStatus = get("fp_usageStatus");
  } else if (currentTab === "defaultMapping") {
    f.mappingStatus = get("fp_mappingStatus");
    f.activeStatus = get("fp_activeStatus");
    f.resultKind = get("fp_resultKind");
    f.methodId = get("fp_methodId");
  }

  applyCurrentSearchAndFilters();
  renderCurrentTable();
  updateFilterBadge();
}

function clearFilters() {
  if (currentTab === "testMaster") {
    filtersByTab.testMaster = {
      activeStatus: "all",
      resultKind: "all",
      defaultStatus: "all",
      methodId: "all",
    };
  } else if (currentTab === "methodMaster") {
    filtersByTab.methodMaster = { activeStatus: "all", usageStatus: "all" };
  } else if (currentTab === "defaultMapping") {
    filtersByTab.defaultMapping = {
      activeStatus: "all",
      mappingStatus: "all",
      resultKind: "all",
      methodId: "all",
    };
  }
  applyCurrentSearchAndFilters();
  renderCurrentTable();
  updateFilterBadge();
  buildFilterPanel();
}

function countActiveFilters() {
  const f = filtersByTab[currentTab];
  return Object.values(f).filter((v) => v !== "all").length;
}

function updateFilterBadge() {
  const n = countActiveFilters();
  filterBadge.textContent = n;
  filterBadge.classList.toggle("visible", n > 0);
}

function closeFilterPanel() {
  filterPanel.classList.remove("open");
}

function rememberFocus() {
  try {
    prevFocus = document.activeElement;
  } catch {
    prevFocus = null;
  }
}

function restoreFocus() {
  try {
    if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
  } catch {
    // ignore
  }
  prevFocus = null;
}

// ── Test Modal ────────────────────────────────────────────────────────────────
function openNewTestModal() {
  rememberFocus();
  testModalTitle.textContent = "New Test";
  testModalSubtitle.textContent = "Create a new test master record.";
  testModalId.value = "";
  testModalCode.value = "";
  testModalName.value = "";
  testModalKind.value = "";
  testModalUom.value = "";
  testModalActiveWrap.style.display = "none";
  testModalDeactivate.style.display = "none";
  hideBanner(testModalBanner);
  populateTestMethodDropdown(null);
  testModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => testModalCode.focus(), 0);
}

function openEditTestModal(testId) {
  rememberFocus();
  const row = tests.find((t) => Number(t.id) === testId);
  if (!row) return;

  testModalTitle.textContent = "Edit Test";
  testModalSubtitle.textContent = escHtml(row.test_name || "");
  testModalId.value = String(row.id);
  testModalCode.value = row.test_code || "";
  testModalName.value = row.test_name || "";
  testModalKind.value = row.result_kind || "";
  testModalUom.value =
    row.default_uom_id != null ? String(row.default_uom_id) : "";
  testModalActiveWrap.style.display = "";
  testModalActiveDisp.innerHTML = activeBadge(row.is_active);
  testModalDeactivate.style.display = row.is_active ? "" : "none";
  hideBanner(testModalBanner);

  const activeMap = activeDefaultMethodByTestId.get(Number(row.id));
  populateTestMethodDropdown(activeMap ? Number(activeMap.method_id) : null);

  testModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => testModalName.focus(), 0);
}

function closeTestModal() {
  testModal.classList.add("hidden");
  document.body.style.overflow = "";
  restoreFocus();
}

function populateTestMethodDropdown(selectedMethodId) {
  const active = methods.filter((m) => m.is_active);
  testModalMethod.innerHTML =
    '<option value="">-- None --</option>' +
    active
      .map(
        (m) =>
          `<option value="${escHtml(m.id)}"${Number(m.id) === selectedMethodId ? " selected" : ""}>${escHtml(`${m.method_name || ""} (${m.method_code || "-"})`)}</option>`,
      )
      .join("");
}

async function saveTestFromModal() {
  const cleanCode = String(testModalCode.value || "")
    .trim()
    .toUpperCase();
  const cleanName = String(testModalName.value || "").trim();
  const kind = String(testModalKind.value || "").trim();
  const uomRaw = String(testModalUom.value || "").trim();
  const parsedUom = uomRaw ? Number(uomRaw) : null;
  const selMethod = testModalMethod.value
    ? Number(testModalMethod.value)
    : null;
  const editId = testModalId.value ? Number(testModalId.value) : null;

  if (!cleanCode) {
    showModalBanner(testModalBanner, "error", "Test code is required.");
    return;
  }
  if (!cleanName) {
    showModalBanner(testModalBanner, "error", "Test name is required.");
    return;
  }
  if (!["NUMERIC", "TEXT", "PASS_FAIL"].includes(kind)) {
    showModalBanner(testModalBanner, "error", "Result kind is required.");
    return;
  }

  testModalSave.disabled = true;
  hideBanner(testModalBanner);

  try {
    const { data: saveData, error: saveErr } = await labSupabase.rpc(
      "fn_save_test_master",
      {
        p_test_code: cleanCode,
        p_test_name: cleanName,
        p_result_kind: kind,
        p_default_uom_id:
          Number.isFinite(parsedUom) && parsedUom > 0 ? parsedUom : null,
        p_id: editId,
      },
    );
    if (saveErr) throw new Error(saveErr.message || "Failed to save test");

    const savedId = extractId(saveData) || editId;

    // Determine current default to detect change
    const currentMap = editId ? activeDefaultMethodByTestId.get(editId) : null;
    const currentMethodId = currentMap ? Number(currentMap.method_id) : null;

    let clearedDefault = false;
    if (savedId) {
      if (selMethod && selMethod !== currentMethodId) {
        const { error: mapErr } = await labSupabase.rpc(
          "fn_set_test_default_method",
          {
            p_test_id: savedId,
            p_method_id: selMethod,
            p_remarks: null,
          },
        );
        if (mapErr)
          throw new Error(mapErr.message || "Failed to set default method");
      } else if (!selMethod && currentMethodId) {
        const { error: clearErr } = await labSupabase.rpc(
          "fn_clear_test_default_method",
          {
            p_test_id: savedId,
            p_remarks: "Cleared while editing test master",
          },
        );
        if (clearErr) {
          throw new Error(clearErr.message || "Failed to clear default method");
        }
        clearedDefault = true;
      }
    }

    closeTestModal();
    showToast(editId ? "Test updated." : "Test created.", "success");
    if (clearedDefault) showToast("Default method cleared.", "success");
    await loadAllData();
  } catch (err) {
    console.error("[test-method-master] saveTest:", err);
    showModalBanner(testModalBanner, "error", err.message || "Failed to save.");
    showToast(err.message || "Failed to save test.", "error");
  } finally {
    testModalSave.disabled = false;
  }
}

async function deactivateTestFromModal() {
  const editId = testModalId.value ? Number(testModalId.value) : null;
  if (!editId) return;
  if (!window.confirm("Deactivate this test? This cannot be undone easily."))
    return;

  testModalDeactivate.disabled = true;
  try {
    const { error } = await labSupabase.rpc("fn_deactivate_test", {
      p_id: editId,
    });
    if (error) throw new Error(error.message || "Failed to deactivate test");
    closeTestModal();
    showToast("Test deactivated.", "info");
    await loadAllData();
  } catch (err) {
    console.error("[test-method-master] deactivateTest:", err);
    showModalBanner(
      testModalBanner,
      "error",
      err.message || "Failed to deactivate.",
    );
    showToast(err.message || "Failed to deactivate test.", "error");
  } finally {
    testModalDeactivate.disabled = false;
  }
}

// ── Method Modal ──────────────────────────────────────────────────────────────
function openNewMethodModal() {
  rememberFocus();
  methodModalTitle.textContent = "New Method";
  methodModalSubtitle.textContent = "Create a new analytical method record.";
  methodModalId.value = "";
  methodModalCode.value = "";
  methodModalName.value = "";
  methodModalDesc.value = "";
  methodModalActiveWrap.style.display = "none";
  methodModalDeactivate.style.display = "none";
  hideBanner(methodModalBanner);
  methodModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => methodModalCode.focus(), 0);
}

function openEditMethodModal(methodId) {
  rememberFocus();
  const row = methods.find((m) => Number(m.id) === methodId);
  if (!row) return;

  methodModalTitle.textContent = "Edit Method";
  methodModalSubtitle.textContent = escHtml(row.method_name || "");
  methodModalId.value = String(row.id);
  methodModalCode.value = row.method_code || "";
  methodModalName.value = row.method_name || "";
  methodModalDesc.value = row.description || "";
  methodModalActiveWrap.style.display = "";
  methodModalActiveDisp.innerHTML = activeBadge(row.is_active);
  methodModalDeactivate.style.display = row.is_active ? "" : "none";
  hideBanner(methodModalBanner);
  methodModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => methodModalName.focus(), 0);
}

function closeMethodModal() {
  methodModal.classList.add("hidden");
  document.body.style.overflow = "";
  restoreFocus();
}

async function saveMethodFromModal() {
  const cleanCode = String(methodModalCode.value || "")
    .trim()
    .toUpperCase();
  const cleanName = String(methodModalName.value || "").trim();
  const cleanDesc = String(methodModalDesc.value || "").trim();
  const editId = methodModalId.value ? Number(methodModalId.value) : null;

  if (!cleanCode) {
    showModalBanner(methodModalBanner, "error", "Method code is required.");
    return;
  }
  if (!cleanName) {
    showModalBanner(methodModalBanner, "error", "Method name is required.");
    return;
  }

  methodModalSave.disabled = true;
  hideBanner(methodModalBanner);

  try {
    const { error } = await labSupabase.rpc("fn_save_test_method", {
      p_method_code: cleanCode,
      p_method_name: cleanName,
      p_description: cleanDesc || null,
      p_id: editId,
    });
    if (error) throw new Error(error.message || "Failed to save method");

    closeMethodModal();
    showToast(editId ? "Method updated." : "Method created.", "success");
    await loadAllData();
  } catch (err) {
    console.error("[test-method-master] saveMethod:", err);
    showModalBanner(
      methodModalBanner,
      "error",
      err.message || "Failed to save.",
    );
    showToast(err.message || "Failed to save method.", "error");
  } finally {
    methodModalSave.disabled = false;
  }
}

async function deactivateMethodFromModal() {
  const editId = methodModalId.value ? Number(methodModalId.value) : null;
  if (!editId) return;
  if (!window.confirm("Deactivate this method?")) return;

  methodModalDeactivate.disabled = true;
  try {
    const { error } = await labSupabase.rpc("fn_deactivate_method", {
      p_id: editId,
    });
    if (error) throw new Error(error.message || "Failed to deactivate method");
    closeMethodModal();
    showToast("Method deactivated.", "info");
    await loadAllData();
  } catch (err) {
    console.error("[test-method-master] deactivateMethod:", err);
    // Show exact backend error (e.g. "method is active default somewhere")
    showModalBanner(
      methodModalBanner,
      "error",
      err.message || "Failed to deactivate.",
    );
    showToast(err.message || "Failed to deactivate method.", "error");
  } finally {
    methodModalDeactivate.disabled = false;
  }
}

// ── Mapping Modal ─────────────────────────────────────────────────────────────
function openMappingModal(testId) {
  rememberFocus();
  const row = tests.find((t) => Number(t.id) === testId);
  if (!row) return;

  mappingModalTestId.value = String(row.id);
  mappingModalTestName.textContent = row.test_name || "—";
  mappingModalResKind.textContent = row.result_kind || "—";

  const activeMap = activeDefaultMethodByTestId.get(Number(row.id));
  const method = activeMap
    ? methods.find((m) => Number(m.id) === Number(activeMap.method_id))
    : null;
  mappingModalCurrent.textContent = method
    ? method.method_name || "—"
    : "No default method assigned";

  // Populate method dropdown
  const activeMethods = methods.filter((m) => m.is_active);
  mappingModalMethod.innerHTML =
    '<option value="">-- Select active method --</option>' +
    activeMethods
      .map(
        (m) =>
          `<option value="${escHtml(m.id)}"${method && Number(m.id) === Number(method.id) ? " selected" : ""}>${escHtml(`${m.method_name || ""} (${m.method_code || "-"})`)}</option>`,
      )
      .join("");

  mappingModalRemarks.value = "";
  mappingModalClear.style.display = activeMap ? "" : "none";
  hideBanner(mappingModalBanner);

  mappingModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => mappingModalMethod.focus(), 0);

  // Load history
  renderMappingHistoryForTest(Number(row.id));
}

function closeMappingModal() {
  mappingModal.classList.add("hidden");
  document.body.style.overflow = "";
  restoreFocus();
}

async function saveMappingFromModal() {
  const testId = mappingModalTestId.value
    ? Number(mappingModalTestId.value)
    : null;
  const methodId = mappingModalMethod.value
    ? Number(mappingModalMethod.value)
    : null;
  const remarks = String(mappingModalRemarks.value || "").trim() || null;

  if (!testId) {
    showModalBanner(mappingModalBanner, "error", "Test not identified.");
    return;
  }
  if (!methodId) {
    showModalBanner(mappingModalBanner, "error", "Please select a method.");
    return;
  }

  const currentMap = activeDefaultMethodByTestId.get(Number(testId));
  const currentMethodId = currentMap ? Number(currentMap.method_id) : null;
  if (currentMethodId && Number(methodId) === currentMethodId) {
    showModalBanner(
      mappingModalBanner,
      "warn",
      "This method is already the active default method for this test.",
    );
    return;
  }

  mappingModalSave.disabled = true;
  hideBanner(mappingModalBanner);

  try {
    const { error } = await labSupabase.rpc("fn_set_test_default_method", {
      p_test_id: testId,
      p_method_id: methodId,
      p_remarks: remarks,
    });
    if (error) throw new Error(error.message || "Failed to set default method");

    closeMappingModal();
    showToast("Default method set successfully.", "success");
    await loadAllData();
  } catch (err) {
    console.error("[test-method-master] saveMapping:", err);
    showModalBanner(
      mappingModalBanner,
      "error",
      err.message || "Failed to save mapping.",
    );
    showToast(err.message || "Failed to save mapping.", "error");
  } finally {
    mappingModalSave.disabled = false;
  }
}

async function clearMappingFromModal() {
  const testId = mappingModalTestId.value
    ? Number(mappingModalTestId.value)
    : null;
  const remarksRaw = String(mappingModalRemarks.value || "").trim();
  const remarks = remarksRaw || "Cleared from Test & Method Master Manager";

  if (!testId) {
    showModalBanner(mappingModalBanner, "error", "Test not identified.");
    return;
  }

  const activeMap = activeDefaultMethodByTestId.get(Number(testId));
  if (!activeMap) {
    showModalBanner(
      mappingModalBanner,
      "warn",
      "This test has no active default method to clear.",
    );
    return;
  }

  if (!window.confirm("Clear the default method for this test?")) return;

  mappingModalClear.disabled = true;
  mappingModalSave.disabled = true;
  hideBanner(mappingModalBanner);

  try {
    const { error } = await labSupabase.rpc("fn_clear_test_default_method", {
      p_test_id: testId,
      p_remarks: remarks,
    });

    if (error)
      throw new Error(error.message || "Failed to clear default method");

    closeMappingModal();
    showToast("Default method cleared.", "success");
    await loadAllData();
  } catch (err) {
    console.error("[test-method-master] clearMapping:", err);
    showModalBanner(
      mappingModalBanner,
      "error",
      err.message || "Failed to clear default method.",
    );
    showToast(err.message || "Failed to clear default method.", "error");
  } finally {
    mappingModalClear.disabled = false;
    mappingModalSave.disabled = false;
  }
}

function renderMappingHistoryForTest(testId) {
  const history = mappings
    .filter((r) => Number(r.test_id) === testId)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (!history.length) {
    mappingHistoryContent.innerHTML =
      '<div class="empty-state" style="padding:12px 0;">No mapping history found.</div>';
    return;
  }

  const rows = history
    .map((r) => {
      const m = methods.find((x) => Number(x.id) === Number(r.method_id));
      return `<tr>
      <td>${escHtml(m?.method_name || "—")}</td>
      <td>${activeBadge(r.is_active)}</td>
      <td style="color:var(--muted,#6b7280);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.remarks || "—")}</td>
      <td style="font-size:12px;color:var(--muted,#6b7280)">${escHtml(formatDateTime(r.created_at))}</td>
    </tr>`;
    })
    .join("");

  mappingHistoryContent.innerHTML = `<table class="history-table">
    <thead><tr><th>Method</th><th>Active</th><th>Remarks</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Status ────────────────────────────────────────────────────────────────────
function setStatus(msg, type = "normal") {
  statusArea.textContent = msg;
  statusArea.style.display = "block";
  statusArea.dataset.type = type;
}

function clearStatus() {
  statusArea.style.display = "none";
  statusArea.dataset.type = "";
  statusArea.textContent = "";
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = $("labToastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `lab-toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3200);
}

// ── Modal banner ──────────────────────────────────────────────────────────────
function showModalBanner(el, type, msg) {
  if (!el) return;
  const palette = {
    error: {
      bg: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    },
    success: {
      bg: "#f0fdf4",
      border: "#86efac",
      color: "#166534",
    },
    warn: {
      bg: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    },
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      color: "#1e40af",
    },
  };

  const p = palette[type] || palette.info;
  el.style.display = "block";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "7px";
  el.style.fontSize = "13px";
  el.style.marginBottom = "4px";
  el.style.background = p.bg;
  el.style.color = p.color;
  el.style.border = `1px solid ${p.border}`;
  el.textContent = msg || "";
}

function hideBanner(el) {
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

// ── Auth / permissions ────────────────────────────────────────────────────────
async function resolveUserId() {
  try {
    const { data: sd } = await supabase.auth.getSession();
    const session = sd?.session ?? null;
    if (session?.user?.id) return session.user.id;
    const p = await Platform.getSession?.();
    return p?.user?.id ?? null;
  } catch {
    return null;
  }
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
    /* fallthrough */
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
    // fallthrough
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
    /* allow */
  }

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d
      .toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\u200E/g, "");
  } catch {
    return String(val);
  }
}

function activeBadge(isActive) {
  return isActive
    ? '<span class="badge badge-active">Yes</span>'
    : '<span class="badge badge-inactive">No</span>';
}

function resultKindBadge(kind) {
  if (!kind) return "—";
  const k = String(kind).toUpperCase();
  const cls =
    k === "NUMERIC"
      ? "badge-numeric"
      : k === "TEXT"
        ? "badge-text"
        : k === "PASS_FAIL"
          ? "badge-passfail"
          : "";
  return `<span class="badge ${cls}">${escHtml(kind)}</span>`;
}

function extractId(data) {
  if (data == null) return null;
  if (Array.isArray(data)) return data.length ? extractId(data[0]) : null;
  if (typeof data === "object") {
    for (const key of ["id", "test_id", "p_id"]) {
      const n = Number(data[key]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const fv = Object.values(data)[0];
    const n = Number(fv);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(data);
  return Number.isFinite(n) && n > 0 ? n : null;
}
