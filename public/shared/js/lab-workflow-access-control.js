/* lab-workflow-access-control.js — Lab Workflow Access Control Manager */
import { labSupabase, supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "lab-workflow-access-control";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const statusArea = $("statusArea");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const lwacSearch = $("lwacSearch");
const lwacSearchClear = $("lwacSearchClear");
const lwacRowCount = $("lwacRowCount");
const lwacThead = $("lwacThead");
const lwacTbody = $("lwacTbody");
const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");
const filterBtn = $("filterBtn");
const filterBadge = $("filterBadge");
const filterPanel = $("filterPanel");
const filterPanelBody = $("filterPanelBody");
const filterPanelClose = $("filterPanelClose");
const filterApply = $("filterApply");
const filterClear = $("filterClear");

const kpiStaffWithRoles = $("kpiStaffWithRoles");
const kpiActiveRoles = $("kpiActiveRoles");
const kpiActions = $("kpiActions");
const kpiAssignments = $("kpiAssignments");
const kpiPermissions = $("kpiPermissions");

// Staff Role Modal
const staffRoleModal = $("staffRoleModal");
const staffRoleModalSubtitle = $("staffRoleModalSubtitle");
const staffRoleModalBanner = $("staffRoleModalBanner");
const staffRoleCurrentAssignments = $("staffRoleCurrentAssignments");
const staffRoleSelect = $("staffRoleSelect");
const staffRoleEffectiveFrom = $("staffRoleEffectiveFrom");
const staffRoleEffectiveTo = $("staffRoleEffectiveTo");
const staffRoleAssignBtn = $("staffRoleAssignBtn");
const staffRoleModalClose = $("staffRoleModalClose");
const staffRoleModalCancel = $("staffRoleModalCancel");

// Preview Modal
const previewModal = $("previewModal");
const previewModalSubtitle = $("previewModalSubtitle");
const previewModalContent = $("previewModalContent");
const previewModalClose = $("previewModalClose");

// ── State ─────────────────────────────────────────────────────────────────────
let staffRows = [];
let roleRows = [];
let actionRows = [];
let staffRoleMaps = [];
let roleActionMaps = [];
let staffPermissionPreviewRows = [];
let currentTab = "staffRoleAssignment";
let filteredRows = [];
let searchTerm = "";
let searchDebounceTimer = null;
let userId = null;
let prevFocus = null;
let hasLoadedOnce = false;

// Lookup maps
let staffById = new Map();
let roleById = new Map();
let actionById = new Map();
let activeRolesByStaffId = new Map();
let roleActionAllowedByKey = new Map(); // `${role_id}:${action_id}`

// Filters per tab
const filtersByTab = {
  staffRoleAssignment: {
    staffStatus: "all",
    role: "all",
    assignmentStatus: "all",
  },
  roleActionMatrix: {
    role: "all",
    action: "all",
    permission: "all",
  },
  staffPermissionPreview: {
    staff: "all",
    role: "all",
    action: "all",
  },
  workflowActionMaster: {
    actionStatus: "all",
  },
};

// Tab definitions
const TABS = [
  { id: "staffRoleAssignment", label: "Staff Role Assignment" },
  { id: "roleActionMatrix", label: "Role Action Matrix" },
  { id: "staffPermissionPreview", label: "Staff Permission Preview" },
  { id: "workflowActionMaster", label: "Workflow Action Master" },
];

// Search placeholders per tab
const SEARCH_PLACEHOLDERS = {
  staffRoleAssignment: "Search staff, employee code, designation, or role…",
  roleActionMatrix: "Search role, action, or permission…",
  staffPermissionPreview: "Search staff, role, or workflow action…",
  workflowActionMaster: "Search action code, action name, or description…",
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

async function resolveUserId() {
  try {
    const sess = await supabase.auth.getSession();
    if (sess?.data?.session?.user?.id) return sess.data.session.user.id;
  } catch {
    /* session unavailable */
  }

  if (Platform?.getSession) {
    const sess = Platform.getSession();
    if (sess?.user?.id) return sess.user.id;
  }

  return null;
}

async function checkModuleAccess(userId) {
  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: userId,
    });
    if (!error && Array.isArray(perms)) {
      const entry = perms.find((r) => r?.target === `module:${MODULE_ID}`);
      if (entry) return !!entry.can_view;
    }
  } catch {
    /* permission check failed */
  }

  // Fallback: check user_permissions_canonical
  try {
    const { data: row } = await supabase
      .from("user_permissions_canonical")
      .select("can_view")
      .eq("user_id", userId)
      .eq("target", `module:${MODULE_ID}`)
      .maybeSingle();
    if (row !== null && row !== undefined) return !!row.can_view;
  } catch {
    /* canonical check failed */
  }

  try {
    const { data: rows } = await supabase
      .from("user_permissions")
      .select("can_view")
      .eq("user_id", userId)
      .eq("module_id", MODULE_ID)
      .limit(1);
    if (Array.isArray(rows) && rows.length) return !!rows[0].can_view;
  } catch {
    /* allow access */
  }

  return true;
}

// ── Tab controls ──────────────────────────────────────────────────────────────
function renderTabControls() {
  lensPills.innerHTML = TABS.map(
    (t) =>
      `<button class="pill${t.id === currentTab ? " active" : ""}" data-tab="${t.id}" type="button">${escHtml(t.label)}</button>`,
  ).join("");

  syncMobileTabSelect();
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
  if (lwacSearch)
    lwacSearch.placeholder = SEARCH_PLACEHOLDERS[tabId] || "Search…";

  // Reset search
  searchTerm = "";
  if (lwacSearch) lwacSearch.value = "";
  if (lwacSearchClear) lwacSearchClear.classList.remove("visible");

  applyCurrentSearchAndFilters();
  renderCurrentTable();
  updateFilterBadge();
  buildFilterPanel();
}

// ── Wire events ───────────────────────────────────────────────────────────────
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

  refreshBtn.addEventListener("click", () => loadAllData());

  // Lens pills
  lensPills.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill[data-tab]");
    if (pill) switchTab(pill.dataset.tab);
  });

  // Mobile select
  lensSelect.addEventListener("change", () => switchTab(lensSelect.value));

  // Search
  lwacSearch.addEventListener("input", () => {
    searchTerm = lwacSearch.value.trim();
    lwacSearchClear.classList.toggle("visible", searchTerm.length > 0);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applyCurrentSearchAndFilters();
      renderCurrentTable();
    }, 280);
  });
  lwacSearchClear.addEventListener("click", () => {
    lwacSearch.value = "";
    searchTerm = "";
    lwacSearchClear.classList.remove("visible");
    applyCurrentSearchAndFilters();
    renderCurrentTable();
    lwacSearch.focus();
  });

  // Table row clicks
  lwacTbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr.lwac-row[data-id]");
    if (!row) return;
    const id = Number(row.dataset.id);
    if (!Number.isFinite(id)) return;

    if (currentTab === "staffRoleAssignment") openStaffRoleModal(id);
    else if (currentTab === "staffPermissionPreview")
      openStaffPermissionPreviewModal(id);
  });

  // Keyboard: Enter key on row
  lwacTbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const row = e.target.closest("tr.lwac-row[data-id]");
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

  // Staff Role Modal
  staffRoleModalClose.addEventListener("click", closeStaffRoleModal);
  staffRoleModalCancel.addEventListener("click", closeStaffRoleModal);
  staffRoleAssignBtn.addEventListener("click", assignRoleFromModal);
  staffRoleModal.addEventListener("click", (e) => {
    if (e.target === staffRoleModal) closeStaffRoleModal();
  });

  // Preview Modal
  previewModalClose.addEventListener("click", closePreviewModal);
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) closePreviewModal();
  });

  // Escape closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!staffRoleModal.classList.contains("hidden")) closeStaffRoleModal();
    else if (!previewModal.classList.contains("hidden")) closePreviewModal();
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
  setStatus("Loading lab workflow access control data…", "loading");
  refreshBtn.disabled = true;

  try {
    await loadWorkflowAccessSnapshot();
    buildLookupMaps();
    renderSummary();
    applyCurrentSearchAndFilters();
    renderCurrentTable();
    clearStatus();
    if (hasLoadedOnce) showToast("Data refreshed", "success");
    hasLoadedOnce = true;
  } catch (err) {
    console.error("[lab-workflow-access-control] loadAllData:", err);
    setStatus("Error loading data: " + (err.message || String(err)), "error");
  } finally {
    refreshBtn.disabled = false;
  }
}

async function loadWorkflowAccessSnapshot() {
  const { data, error } = await labSupabase.rpc(
    "fn_get_workflow_access_control_snapshot",
  );

  if (error) {
    throw new Error("Workflow access snapshot: " + error.message);
  }

  const snapshot = data || {};

  staffRows = Array.isArray(snapshot.staff) ? snapshot.staff : [];
  roleRows = Array.isArray(snapshot.roles) ? snapshot.roles : [];
  actionRows = Array.isArray(snapshot.actions) ? snapshot.actions : [];
  staffRoleMaps = Array.isArray(snapshot.staffRoleMaps)
    ? snapshot.staffRoleMaps
    : [];
  roleActionMaps = Array.isArray(snapshot.roleActionMaps)
    ? snapshot.roleActionMaps
    : [];
  staffPermissionPreviewRows = Array.isArray(snapshot.permissionPreview)
    ? snapshot.permissionPreview
    : [];
}

// ── Date & status helpers ─────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function isCurrentlyEffectiveRoleMap(map) {
  if (!map || map.is_active !== true) return false;
  const today = todayISO();
  if (map.effective_from && String(map.effective_from) > today) return false;
  if (map.effective_to && String(map.effective_to) < today) return false;
  return true;
}

function getRoleAssignmentStatus(m) {
  if (!m.is_active) return { label: "Inactive", cls: "badge-inactive" };
  const today = todayISO();
  if (m.effective_from && String(m.effective_from) > today)
    return { label: "Future", cls: "badge-not-allowed" };
  if (m.effective_to && String(m.effective_to) < today)
    return { label: "Expired", cls: "badge-inactive" };
  return { label: "Current", cls: "badge-active" };
}

function buildLookupMaps() {
  staffById = new Map(staffRows.map((s) => [s.id, s]));
  roleById = new Map(roleRows.map((r) => [r.id, r]));
  actionById = new Map(actionRows.map((a) => [a.id, a]));

  // Active roles by staff
  activeRolesByStaffId = new Map();
  staffRoleMaps
    .filter((m) => isCurrentlyEffectiveRoleMap(m))
    .forEach((m) => {
      if (!activeRolesByStaffId.has(m.staff_id)) {
        activeRolesByStaffId.set(m.staff_id, []);
      }
      activeRolesByStaffId.get(m.staff_id).push(m);
    });

  // Role-action permissions
  roleActionAllowedByKey = new Map();
  roleActionMaps.forEach((m) => {
    const key = `${m.role_id}:${m.action_id}`;
    roleActionAllowedByKey.set(key, m.is_allowed);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
function renderSummary() {
  const staffWithRoles = new Set(
    staffRoleMaps
      .filter((m) => isCurrentlyEffectiveRoleMap(m))
      .map((m) => m.staff_id),
  ).size;
  const activeRoles = roleRows.filter((r) => r?.is_active === true).length;
  const actions = actionRows.filter((a) => a?.is_active === true).length;
  const assignments = staffRoleMaps.filter((m) =>
    isCurrentlyEffectiveRoleMap(m),
  ).length;
  const permissions = roleActionMaps.filter(
    (m) => m?.is_allowed === true,
  ).length;

  kpiStaffWithRoles.textContent = String(staffWithRoles || 0);
  kpiActiveRoles.textContent = String(activeRoles || 0);
  kpiActions.textContent = String(actions || 0);
  kpiAssignments.textContent = String(assignments || 0);
  kpiPermissions.textContent = String(permissions || 0);
}

// ── Search & Filter ───────────────────────────────────────────────────────────
function applyCurrentSearchAndFilters() {
  const filters = filtersByTab[currentTab] || {};

  let source = [];
  if (currentTab === "staffRoleAssignment") {
    source = buildStaffRoleAssignmentRows();
  } else if (currentTab === "roleActionMatrix") {
    source = buildRoleActionMatrixRows();
  } else if (currentTab === "staffPermissionPreview") {
    source = buildStaffPermissionPreviewTableRows();
  } else if (currentTab === "workflowActionMaster") {
    source = buildWorkflowActionMasterRows();
  }

  filteredRows = source.filter((row) => {
    // Search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const searchText = JSON.stringify(row).toLowerCase();
      if (!searchText.includes(searchLower)) return false;
    }

    // Filter by tab
    if (currentTab === "staffRoleAssignment") {
      if (
        filters.staffStatus !== "all" &&
        row.staffStatus !== filters.staffStatus
      )
        return false;
      if (
        filters.role !== "all" &&
        !(row.roleIds || []).includes(Number(filters.role))
      )
        return false;
      if (
        filters.assignmentStatus !== "all" &&
        row.assignmentStatus !== filters.assignmentStatus
      )
        return false;
    } else if (currentTab === "roleActionMatrix") {
      if (filters.role !== "all" && row.roleId !== Number(filters.role))
        return false;
      if (filters.action !== "all" && row.actionId !== Number(filters.action))
        return false;
      if (
        filters.permission !== "all" &&
        row.isAllowed !== (filters.permission === "allowed")
      )
        return false;
    } else if (currentTab === "staffPermissionPreview") {
      if (filters.staff !== "all" && row.staffId !== Number(filters.staff))
        return false;
      if (filters.role !== "all" && row.roleId !== Number(filters.role))
        return false;
      if (filters.action !== "all" && row.actionId !== Number(filters.action))
        return false;
    } else if (currentTab === "workflowActionMaster") {
      if (
        filters.actionStatus !== "all" &&
        row.isActive !== (filters.actionStatus === "active")
      )
        return false;
    }

    return true;
  });
}

function buildStaffRoleAssignmentRows() {
  return staffRows.map((staff) => {
    const roles = activeRolesByStaffId.get(staff.id) || [];
    const roleLabels = roles
      .map((m) => roleById.get(m.role_id)?.role_label || "Unknown")
      .join(", ");

    return {
      id: staff.id,
      staff: staff.full_name,
      employeeCode: staff.employee_code,
      designation: staff.designation,
      roles: roleLabels || "No lab role assigned",
      roleCount: roles.length,
      updated: formatDate(staff.updated_at),
      staffStatus: staff.is_active ? "active" : "inactive",
      roleIds: roles.map((m) => Number(m.role_id)),
      roleId: roles.length > 0 ? roles[0].role_id : null,
      assignmentStatus: roles.length > 0 ? "assigned" : "unassigned",
      staffObj: staff,
      roleData: roles,
    };
  });
}

function buildRoleActionMatrixRows() {
  const rows = [];
  const activeRoles = roleRows.filter((r) => r.is_active);
  const activeActions = actionRows.filter((a) => a.is_active);
  activeRoles.forEach((role) => {
    activeActions.forEach((action) => {
      const key = `${role.id}:${action.id}`;
      const isAllowed = roleActionAllowedByKey.get(key) === true;
      rows.push({
        roleId: role.id,
        role: role.role_label,
        actionId: action.id,
        action: action.action_name,
        isAllowed: isAllowed,
        roleObj: role,
        actionObj: action,
      });
    });
  });
  return rows;
}

function buildStaffPermissionPreviewTableRows() {
  return staffPermissionPreviewRows.map((row) => {
    const actionObj = actionRows.find((a) => a.action_code === row.action_code);
    return {
      staffId: row.staff_id,
      staff: row.full_name,
      employeeCode: row.employee_code,
      designation: row.designation,
      roleId: row.role_id,
      role: row.role_label,
      actionId: actionObj ? actionObj.id : null,
      action: row.action_name || row.action_code || "Unknown",
      rawRow: row,
    };
  });
}

function buildWorkflowActionMasterRows() {
  return actionRows.map((action) => ({
    id: action.id,
    code: action.action_code,
    name: action.action_name,
    description: action.description || "",
    isActive: action.is_active,
    actionObj: action,
  }));
}

// ── Rendering tables ──────────────────────────────────────────────────────────
function renderCurrentTable() {
  lwacThead.innerHTML = "";
  lwacTbody.innerHTML = "";

  if (currentTab === "staffRoleAssignment") {
    renderStaffRoleAssignmentTable();
  } else if (currentTab === "roleActionMatrix") {
    renderRoleActionMatrixTable();
  } else if (currentTab === "staffPermissionPreview") {
    renderStaffPermissionPreviewTable();
  } else if (currentTab === "workflowActionMaster") {
    renderWorkflowActionMasterTable();
  }

  lwacRowCount.textContent = `${filteredRows.length} row${filteredRows.length !== 1 ? "s" : ""}`;
}

function renderStaffRoleAssignmentTable() {
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>Staff</th>
    <th>Designation</th>
    <th>Assigned Roles</th>
    <th class="col-hide-mobile">Active</th>
    <th class="col-hide-mobile">Updated</th>
  `;
  lwacThead.appendChild(headerRow);

  filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "lwac-row";
    tr.dataset.id = row.id;
    tr.innerHTML = `
      <td>
        <div class="item-primary">${escHtml(row.staff)}</div>
        <span class="item-secondary">${escHtml(row.employeeCode)}</span>
      </td>
      <td><span class="item-secondary">${escHtml(row.designation)}</span></td>
      <td>${
        row.roleCount > 0
          ? row.roleData
              .map((m) => {
                const role = roleById.get(m.role_id);
                return `<span class="badge badge-role">${escHtml(role?.role_label || "Unknown")}</span>`;
              })
              .join("")
          : '<span style="color: #9ca3af; font-size: 12px">No lab role assigned</span>'
      }</td>
      <td class="col-hide-mobile"><span class="badge ${row.staffStatus === "active" ? "badge-active" : "badge-inactive"}">${row.staffStatus}</span></td>
      <td class="col-hide-mobile"><span style="font-size: 11px; color: #6b7280">${escHtml(row.updated)}</span></td>
    `;
    lwacTbody.appendChild(tr);
  });

  if (filteredRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="empty-state">No staff found</td>`;
    lwacTbody.appendChild(tr);
  }
}

function renderRoleActionMatrixTable() {
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>Role</th>
    <th>Action</th>
    <th>Permission</th>
    <th>Action</th>
  `;
  lwacThead.appendChild(headerRow);

  filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    const statusBadge = row.isAllowed
      ? '<span class="badge badge-allowed">Allowed</span>'
      : '<span class="badge badge-not-allowed">Not Allowed</span>';
    const buttonText = row.isAllowed ? "Disallow" : "Allow";
    const buttonClass = row.isAllowed ? "btn-danger" : "btn-primary";
    tr.innerHTML = `
      <td><span class="item-primary">${escHtml(row.role)}</span></td>
      <td><span class="badge badge-action">${escHtml(row.action)}</span></td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn-xs ${buttonClass} toggle-permission" data-role-id="${row.roleId}" data-action-id="${row.actionId}">
          ${buttonText}
        </button>
      </td>
    `;
    lwacTbody.appendChild(tr);
  });

  if (filteredRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="empty-state">No role-action combinations found</td>`;
    lwacTbody.appendChild(tr);
  }

  // Wire permission toggle buttons
  lwacTbody.querySelectorAll(".toggle-permission").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const roleId = Number(btn.dataset.roleId);
      const actionId = Number(btn.dataset.actionId);
      const key = `${roleId}:${actionId}`;
      const currentValue = roleActionAllowedByKey.get(key) === true;
      await setRoleAction(roleId, actionId, !currentValue);
    });
  });
}

function renderStaffPermissionPreviewTable() {
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>Staff</th>
    <th>Role</th>
    <th>Workflow Action</th>
  `;
  lwacThead.appendChild(headerRow);

  filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "lwac-row";
    tr.dataset.id = row.staffId;
    tr.innerHTML = `
      <td>
        <div class="item-primary">${escHtml(row.staff)}</div>
        <span class="item-secondary">${escHtml(row.employeeCode)}</span>
      </td>
      <td><span class="badge badge-role">${escHtml(row.role)}</span></td>
      <td><span class="badge badge-action">${escHtml(row.action)}</span></td>
    `;
    lwacTbody.appendChild(tr);
  });

  if (filteredRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" class="empty-state">No staff permissions found</td>`;
    lwacTbody.appendChild(tr);
  }
}

function renderWorkflowActionMasterTable() {
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>Action Code</th>
    <th>Action Name</th>
    <th>Description</th>
    <th class="col-hide-mobile">Active</th>
  `;
  lwacThead.appendChild(headerRow);

  filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span style="font-weight: 600; font-family: monospace">${escHtml(row.code)}</span></td>
      <td><span class="item-primary">${escHtml(row.name)}</span></td>
      <td><span style="font-size: 12px; color: #6b7280">${escHtml(row.description)}</span></td>
      <td class="col-hide-mobile"><span class="badge ${row.isActive ? "badge-active" : "badge-inactive"}">${row.isActive ? "active" : "inactive"}</span></td>
    `;
    lwacTbody.appendChild(tr);
  });

  if (filteredRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="empty-state">No workflow actions found</td>`;
    lwacTbody.appendChild(tr);
  }
}

// ── Filter panel ──────────────────────────────────────────────────────────────
function buildFilterPanel() {
  filterPanelBody.innerHTML = "";
  const filters = filtersByTab[currentTab] || {};

  if (currentTab === "staffRoleAssignment") {
    addFilterGroup(
      "Staff Status",
      "staffStatus",
      ["all", "active", "inactive"],
      filters.staffStatus,
    );
    addFilterGroup(
      "Role",
      "role",
      ["all", ...roleRows.filter((r) => r.is_active).map((r) => r.id)],
      filters.role,
      (v) =>
        v === "all"
          ? "All roles"
          : roleById.get(Number(v))?.role_label || "Unknown",
    );
    addFilterGroup(
      "Assignment Status",
      "assignmentStatus",
      ["all", "assigned", "unassigned"],
      filters.assignmentStatus,
    );
  } else if (currentTab === "roleActionMatrix") {
    addFilterGroup(
      "Role",
      "role",
      ["all", ...roleRows.filter((r) => r.is_active).map((r) => r.id)],
      filters.role,
      (v) =>
        v === "all"
          ? "All roles"
          : roleById.get(Number(v))?.role_label || "Unknown",
    );
    addFilterGroup(
      "Action",
      "action",
      ["all", ...actionRows.filter((a) => a.is_active).map((a) => a.id)],
      filters.action,
      (v) =>
        v === "all"
          ? "All actions"
          : actionById.get(Number(v))?.action_name || "Unknown",
    );
    addFilterGroup(
      "Permission",
      "permission",
      ["all", "allowed", "not-allowed"],
      filters.permission,
    );
  } else if (currentTab === "staffPermissionPreview") {
    addFilterGroup(
      "Staff",
      "staff",
      ["all", ...staffRows.filter((s) => s.is_active).map((s) => s.id)],
      filters.staff,
      (v) =>
        v === "all"
          ? "All staff"
          : staffById.get(Number(v))?.full_name || "Unknown",
    );
    addFilterGroup(
      "Role",
      "role",
      ["all", ...roleRows.filter((r) => r.is_active).map((r) => r.id)],
      filters.role,
      (v) =>
        v === "all"
          ? "All roles"
          : roleById.get(Number(v))?.role_label || "Unknown",
    );
    addFilterGroup(
      "Action",
      "action",
      ["all", ...actionRows.filter((a) => a.is_active).map((a) => a.id)],
      filters.action,
      (v) =>
        v === "all"
          ? "All actions"
          : actionById.get(Number(v))?.action_name || "Unknown",
    );
  } else if (currentTab === "workflowActionMaster") {
    addFilterGroup(
      "Action Status",
      "actionStatus",
      ["all", "active", "inactive"],
      filters.actionStatus,
    );
  }
}

function addFilterGroup(label, key, options, current, labelFn) {
  const group = document.createElement("div");
  group.className = "filter-group";
  group.innerHTML = `<label>${escHtml(label)}</label>`;

  const select = document.createElement("select");
  select.dataset.filterKey = key;
  select.className = "form-control";

  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = labelFn ? labelFn(opt) : opt;
    option.selected = String(current) === String(opt);
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    const filters = filtersByTab[currentTab];
    if (filters) filters[key] = select.value;
  });

  group.appendChild(select);
  filterPanelBody.appendChild(group);
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

function closeFilterPanel() {
  filterPanel.classList.remove("open");
}

function applyFilters() {
  applyCurrentSearchAndFilters();
  renderCurrentTable();
  updateFilterBadge();
}

function clearFilters() {
  Object.keys(filtersByTab[currentTab]).forEach((key) => {
    filtersByTab[currentTab][key] = "all";
  });
  applyFilters();
  buildFilterPanel();
}

function updateFilterBadge() {
  const filters = filtersByTab[currentTab] || {};
  const activeCount = Object.values(filters).filter((v) => v !== "all").length;
  filterBadge.textContent = String(activeCount);
  filterBadge.classList.toggle("visible", activeCount > 0);
}

// ── Modals ────────────────────────────────────────────────────────────────────
async function openStaffRoleModal(staffId) {
  prevFocus = document.activeElement;
  const staff = staffById.get(staffId);
  if (!staff) return;

  staffRoleModalSubtitle.textContent = `${staff.full_name} · ${staff.employee_code} · ${staff.designation}`;
  staffRoleModalBanner.innerHTML = "";
  staffRoleModalBanner.style.display = "none";

  // Load current assignments
  const currentAssignments = staffRoleMaps.filter(
    (m) => m.staff_id === staffId,
  );
  if (currentAssignments.length === 0) {
    staffRoleCurrentAssignments.innerHTML =
      '<p style="color: #6b7280; margin: 0">No roles assigned</p>';
  } else {
    const rows = currentAssignments
      .map((m) => {
        const role = roleById.get(m.role_id);
        const status = getRoleAssignmentStatus(m);
        const effectiveFrom = formatDate(m.effective_from);
        const effectiveTo = m.effective_to ? formatDate(m.effective_to) : "—";
        const deactivateBtn = m.is_active
          ? `<button class="btn-xs btn-danger deactivate-role" data-mapping-id="${m.id}">Deactivate</button>`
          : "";
        return `
          <tr>
            <td>${escHtml(role?.role_label || "Unknown")}</td>
            <td><span class="badge ${status.cls}">${escHtml(status.label)}</span></td>
            <td><span style="font-size: 12px">${escHtml(effectiveFrom)}</span></td>
            <td><span style="font-size: 12px">${escHtml(effectiveTo)}</span></td>
            <td>${deactivateBtn}</td>
          </tr>
        `;
      })
      .join("");

    staffRoleCurrentAssignments.innerHTML = `
      <table class="modal-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Status</th>
            <th>Effective From</th>
            <th>Effective To</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Wire deactivate buttons
    staffRoleCurrentAssignments
      .querySelectorAll(".deactivate-role")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const mappingId = Number(btn.dataset.mappingId);
          const mapping = staffRoleMaps.find((m) => m.id === mappingId);
          if (mapping) {
            await deactivateRoleAssignmentFromModal(staffId, mapping.role_id);
          }
        });
      });
  }

  // Populate role select — active roles only
  staffRoleSelect.innerHTML = '<option value="">Select role...</option>';
  roleRows
    .filter((r) => r.is_active)
    .forEach((role) => {
      const option = document.createElement("option");
      option.value = role.id;
      option.textContent = role.role_label;
      staffRoleSelect.appendChild(option);
    });

  // Set default dates
  const today = new Date().toISOString().split("T")[0];
  staffRoleEffectiveFrom.value = today;
  staffRoleEffectiveTo.value = "";

  // Store staffId for form submission
  staffRoleModal.dataset.staffId = staffId;

  staffRoleModal.classList.remove("hidden");
  staffRoleSelect.focus();
}

function closeStaffRoleModal() {
  staffRoleModal.classList.add("hidden");
  if (prevFocus && typeof prevFocus.focus === "function") {
    prevFocus.focus();
  }
}

async function assignRoleFromModal() {
  const staffId = Number(staffRoleModal.dataset.staffId);
  const roleId = Number(staffRoleSelect.value);
  const effectiveFrom = staffRoleEffectiveFrom.value;
  const effectiveTo = staffRoleEffectiveTo.value || null;

  if (!roleId || !effectiveFrom) {
    showBannerError(
      staffRoleModalBanner,
      "Please select a role and effective from date.",
    );
    return;
  }

  if (effectiveTo && effectiveTo < effectiveFrom) {
    showBannerError(
      staffRoleModalBanner,
      "Effective To cannot be earlier than Effective From.",
    );
    return;
  }

  staffRoleAssignBtn.disabled = true;
  staffRoleModalBanner.innerHTML = "";
  staffRoleModalBanner.style.display = "none";

  try {
    const { error } = await labSupabase.rpc("fn_assign_staff_role", {
      p_staff_id: staffId,
      p_role_id: roleId,
      p_effective_from: effectiveFrom,
      p_effective_to: effectiveTo,
    });

    if (error) {
      showBannerError(
        staffRoleModalBanner,
        error.message || "Failed to assign role",
      );
      return;
    }

    showToast("Role assigned successfully", "success");
    await loadAllData();
    closeStaffRoleModal();
  } catch (err) {
    console.error("[lab-workflow-access-control] assignRoleFromModal:", err);
    showBannerError(
      staffRoleModalBanner,
      err.message || "Error assigning role",
    );
  } finally {
    staffRoleAssignBtn.disabled = false;
  }
}

async function deactivateRoleAssignmentFromModal(staffId, roleId) {
  if (!confirm("Deactivate this role assignment?")) return;

  try {
    const { error } = await labSupabase.rpc(
      "fn_deactivate_staff_role_assignment",
      {
        p_staff_id: staffId,
        p_role_id: roleId,
      },
    );

    if (error) {
      showBannerError(
        staffRoleModalBanner,
        error.message || "Failed to deactivate role",
      );
      return;
    }

    showToast("Role deactivated successfully", "success");
    await loadAllData();
    await openStaffRoleModal(staffId);
  } catch (err) {
    console.error(
      "[lab-workflow-access-control] deactivateRoleAssignmentFromModal:",
      err,
    );
    showBannerError(
      staffRoleModalBanner,
      err.message || "Error deactivating role",
    );
  }
}

async function setRoleAction(roleId, actionId, isAllowed) {
  try {
    const { error } = await labSupabase.rpc("fn_set_staff_role_action", {
      p_role_id: roleId,
      p_action_id: actionId,
      p_is_allowed: isAllowed,
    });

    if (error) {
      showToast(error.message || "Failed to update permission", "error");
      return;
    }

    showToast(
      `Permission updated to ${isAllowed ? "allowed" : "not allowed"}`,
      "success",
    );
    await loadAllData();
  } catch (err) {
    console.error("[lab-workflow-access-control] setRoleAction:", err);
    showToast(err.message || "Error updating permission", "error");
  }
}

async function openStaffPermissionPreviewModal(staffId) {
  prevFocus = document.activeElement;
  const staff = staffById.get(staffId);
  if (!staff) return;

  previewModalSubtitle.textContent = `${staff.full_name} · ${staff.employee_code}`;

  const permsForStaff = staffPermissionPreviewRows.filter(
    (r) => r.staff_id === staffId,
  );

  if (permsForStaff.length === 0) {
    previewModalContent.innerHTML =
      '<div class="empty-state">No permissions found for this staff member</div>';
  } else {
    const groupedByRole = {};
    permsForStaff.forEach((row) => {
      if (!groupedByRole[row.role_label]) {
        groupedByRole[row.role_label] = [];
      }
      groupedByRole[row.role_label].push(row.action_name);
    });

    const html = Object.entries(groupedByRole)
      .map(
        ([role, actions]) => `
        <div style="margin-bottom: 14px">
          <h4 style="margin: 0 0 8px; font-size: 13px; color: #374151">${escHtml(role)}</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 6px">
            ${actions.map((action) => `<span class="badge badge-action">${escHtml(action)}</span>`).join("")}
          </div>
        </div>
      `,
      )
      .join("");

    previewModalContent.innerHTML = html;
  }

  previewModal.classList.remove("hidden");
}

function closePreviewModal() {
  previewModal.classList.add("hidden");
  if (prevFocus && typeof prevFocus.focus === "function") {
    prevFocus.focus();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showBannerError(banner, message) {
  banner.textContent = message;
  banner.dataset.type = "error";
  banner.style.display = "block";
}

function setStatus(message, type) {
  statusArea.textContent = message;
  statusArea.dataset.type = type;
  statusArea.style.display =
    type === "error" || type === "loading" ? "block" : "none";
  if (type === "loading") {
    statusArea.innerHTML = `
      <svg style="display: inline; width: 14px; height: 14px; animation: spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2"/>
      </svg>
      ${message}
    `;
  }
}

function clearStatus() {
  statusArea.textContent = "";
  statusArea.style.display = "none";
}

function showToast(message, type = "info") {
  const container = document.getElementById("labToastContainer");
  const toast = document.createElement("div");
  toast.className = `lab-toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function escHtml(str) {
  if (!str) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}
