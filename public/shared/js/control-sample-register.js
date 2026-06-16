/* control-sample-register.js
 * Lab ERP - Control Sample Register
 *
 * Reads from verified lab control-sample views.
 * All write actions are routed through verified RPC functions only.
 */

import { labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const $ = (id) => document.getElementById(id);

const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableHead = $("tableHead");
const tableBody = $("tableBody");
const emptyState = $("emptyState");
const rowCount = $("rowCount");
const toastContainer = $("toastContainer");

const kpiPending = $("kpiPending");
const kpiCollected = $("kpiCollected");
const kpiReady = $("kpiReady");
const kpiRemoved = $("kpiRemoved");

const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");
const searchInput = $("searchInput");
const searchClear = $("searchClear");
const productGroupFilter = $("productGroupFilter");
const registerStatusFilter = $("registerStatusFilter");
const retentionStatusFilter = $("retentionStatusFilter");
const sampleStatusFilter = $("sampleStatusFilter");
const clearFiltersBtn = $("clearFiltersBtn");
const closeFiltersBtn = $("closeFiltersBtn");
const newRegisterBtn = $("newRegisterBtn");
const tabSelect = $("tabSelect");
const filterDrawerBtn = $("filterDrawerBtn");
const filterDrawer = $("filterDrawer");
const filterDrawerWrap = $("filterDrawerWrap");
const filterBadge = $("filterBadge");

const productGroupFilterWrap = $("productGroupFilterWrap");
const registerStatusFilterWrap = $("registerStatusFilterWrap");
const retentionStatusFilterWrap = $("retentionStatusFilterWrap");
const sampleStatusFilterWrap = $("sampleStatusFilterWrap");

const collectionModal = $("collectionModal");
const collectionForm = $("collectionForm");
const collectAnalysisNo = $("collectAnalysisNo");
const collectProduct = $("collectProduct");
const collectBatch = $("collectBatch");
const collectRegisterId = $("collectRegisterId");
const collectPageNo = $("collectPageNo");
const collectSkuId = $("collectSkuId");
const collectPackUom = $("collectPackUom");
const collectSampleCount = $("collectSampleCount");
const collectStorage = $("collectStorage");
const collectRemarks = $("collectRemarks");

const removeModal = $("removeModal");
const removeForm = $("removeForm");
const removeRef = $("removeRef");
const removeBatch = $("removeBatch");
const removeRetainUntil = $("removeRetainUntil");
const removedDate = $("removedDate");
const removalRemarks = $("removalRemarks");

const detailsModal = $("detailsModal");
const detailsModalSubtitle = $("detailsModalSubtitle");
const detailsBody = $("detailsBody");

const registerModal = $("registerModal");
const registerForm = $("registerForm");
const newRegisterCode = $("newRegisterCode");
const newRegisterRemarks = $("newRegisterRemarks");

const deactivateModal = $("deactivateModal");
const deactivateForm = $("deactivateForm");
const deactivateModalTitle = $("deactivateModalTitle");
const deactivateModalSubtitle = $("deactivateModalSubtitle");
const deactivateRegisterCode = $("deactivateRegisterCode");
const deactivateProductGroup = $("deactivateProductGroup");
const deactivateRemarks = $("deactivateRemarks");

let pendingRows = [];
let registerRows = [];
let readyRows = [];
let activeRegisterRows = [];
let skuOptionRows = [];
let filteredRows = [];
let activeTab = "pending";
let searchDebounceTimer = null;
let selectedPendingRow = null;
let selectedRemovalRow = null;
let selectedDeactivateRow = null;

const tabMeta = {
  pending: {
    empty: "No analyses are pending control sample collection.",
    searchPlaceholder: "Search analysis no, product, product group, batch",
  },
  register: {
    empty: "No control samples are registered yet.",
    searchPlaceholder:
      "Search sample ref, analysis no, product, batch, storage",
  },
  ready: {
    empty: "No control samples are ready for removal.",
    searchPlaceholder: "Search sample ref, product, batch, register",
  },
  master: {
    empty: "No control registers are configured yet.",
    searchPlaceholder: "Search register no, full register code, remarks",
  },
};
const tabOrder = ["pending", "register", "ready", "master"];

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalize(val) {
  return String(val ?? "")
    .trim()
    .toLowerCase();
}

function registerIdOf(row) {
  return row?.control_register_id ?? null;
}

function productGroupIdOf(row) {
  return row?.product_group_id ?? null;
}

function batchDisplay(row) {
  return (
    row?.batch_no_snapshot ??
    row?.batch_no ??
    row?.system_lot_no ??
    row?.supplier_lot_no ??
    "-"
  );
}

function packCountDisplay(row) {
  const pack =
    row?.sku_pack_display ||
    [row?.pack_size_snapshot, row?.pack_uom_snapshot]
      .filter(Boolean)
      .join(" ");
  const count = row?.sample_count ?? "-";
  if (!pack) return `Count ${esc(count)}`;
  return `${pack} \u00d7 ${count}`;
}

function skuOptionsForProduct(productId) {
  return skuOptionRows
    .filter(
      (row) =>
        String(row.product_id) === String(productId) && row.is_active === true,
    )
    .sort((a, b) => Number(a.pack_size ?? 0) - Number(b.pack_size ?? 0));
}

function selectedSkuOption() {
  const skuId = collectSkuId?.value;
  if (!skuId) return null;
  return (
    skuOptionRows.find((row) => String(row.sku_id) === String(skuId)) ?? null
  );
}

function populateSkuDropdownForPendingRow(row) {
  const options = skuOptionsForProduct(row.product_id);
  collectSkuId.innerHTML = "";
  if (!options.length) {
    collectSkuId.innerHTML = `<option value="">No active SKU configured</option>`;
    collectSkuId.disabled = true;
    collectPackUom.value = "";
    return false;
  }
  collectSkuId.disabled = false;
  collectSkuId.innerHTML = options
    .map((sku) => {
      const label =
        sku.sku_label || `${sku.pack_size ?? "-"} ${sku.pack_uom ?? ""}`.trim();
      return `<option value="${esc(sku.sku_id)}">${esc(label)}</option>`;
    })
    .join("");
  collectSkuId.value = String(options[0].sku_id);
  collectPackUom.value = options[0].pack_uom ?? "";
  return true;
}

function syncSelectedSkuUom() {
  const sku = selectedSkuOption();
  collectPackUom.value = sku?.pack_uom ?? "";
}

function combineRemarks(row) {
  return row?.remarks || "-";
}

function setStatus(msg, type = "loading") {
  statusArea.textContent = msg;
  statusArea.dataset.type = type;
  tableWrap.classList.remove("tw-visible");
}

function clearStatus() {
  statusArea.textContent = "";
  statusArea.dataset.type = "";
  tableWrap.classList.add("tw-visible");
}

function toast(message, kind = "info", duration = 3600) {
  const el = document.createElement("div");
  el.className = `cr-toast toast-${kind}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, duration);
}

function friendlyError(err) {
  const msg = err?.message || String(err || "Unknown error");
  if (/duplicate|unique|already|page/i.test(msg)) {
    return `Duplicate page/reference: ${msg}`;
  }
  if (/register.*missing|missing.*register|control_register/i.test(msg)) {
    return `Register missing: ${msg}`;
  }
  if (/user|auth|mapping|permission|staff/i.test(msg)) {
    return `User mapping/auth error: ${msg}`;
  }
  return msg;
}

async function getCurrentUserId() {
  const { data, error } = await labSupabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error("No authenticated user found.");
  return userId;
}

async function withSubmitLock(form, task) {
  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn?.disabled) return;
  if (submitBtn) submitBtn.disabled = true;
  try {
    await task();
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function loadAllData() {
  setStatus("Loading control sample register...");
  refreshBtn.disabled = true;
  try {
    const [pendingRes, registerRes, readyRes, activeRegisterRes, skuOptionRes] =
      await Promise.all([
        labSupabase.from("v_control_sample_pending_collection").select("*"),
        labSupabase.from("v_control_sample_register").select("*"),
        labSupabase.from("v_control_sample_ready_for_removal").select("*"),
        labSupabase
          .from("v_control_register_active")
          .select("*")
          .order("register_code"),
        labSupabase
          .from("v_control_sample_sku_option")
          .select("*")
          .order("product_name")
          .order("pack_size"),
      ]);

    if (pendingRes.error) throw pendingRes.error;
    if (registerRes.error) throw registerRes.error;
    if (readyRes.error) throw readyRes.error;
    if (activeRegisterRes.error) throw activeRegisterRes.error;
    if (skuOptionRes.error) throw skuOptionRes.error;

    pendingRows = pendingRes.data ?? [];
    registerRows = registerRes.data ?? [];
    readyRows = readyRes.data ?? [];
    activeRegisterRows = activeRegisterRes.data ?? [];
    skuOptionRows = skuOptionRes.data ?? [];

    populateProductGroupFilter();
    renderKpis();
    applyFilters();
  } catch (err) {
    console.error("[Control Sample Register] loadAllData error:", err);
    setStatus(
      `Failed to load control sample register: ${err.message || err}`,
      "error",
    );
    toast(`Load failed: ${err.message || err}`, "error", 6000);
  } finally {
    refreshBtn.disabled = false;
  }
}

function populateProductGroupFilter() {
  const current = productGroupFilter.value;
  const groups = getProductGroups();
  productGroupFilter.innerHTML = `<option value="">All Product Groups</option>`;
  groups.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = String(g.id);
    opt.textContent = g.name;
    productGroupFilter.appendChild(opt);
  });
  if ([...productGroupFilter.options].some((opt) => opt.value === current)) {
    productGroupFilter.value = current;
  }
}

function getProductGroups() {
  const map = new Map();
  [...pendingRows, ...registerRows].forEach((row) => {
    const id = productGroupIdOf(row);
    const name = row.product_group_name ?? row.product_group ?? null;
    if (id != null && name) map.set(String(id), { id, name });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderKpis() {
  kpiPending.textContent = pendingRows.length;
  kpiCollected.textContent = registerRows.filter(
    (r) => r.control_sample_status === "COLLECTED",
  ).length;
  kpiReady.textContent = readyRows.length;
  kpiRemoved.textContent = registerRows.filter(
    (r) =>
      r.control_sample_status === "REMOVED" || r.retention_status === "REMOVED",
  ).length;
}

function setActiveTab(tab) {
  if (!tabOrder.includes(tab)) return;
  activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
    if (isActive) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  if (tabSelect) tabSelect.value = tab;
  updateTabNavigator();
  searchInput.placeholder = tabMeta[tab].searchPlaceholder;
  updateFilterVisibility();
  applyFilters();
}

function updateTabNavigator() {
  if (tabSelect) tabSelect.value = activeTab;
}

function updateFilterVisibility() {
  registerStatusFilterWrap.classList.toggle("hidden", activeTab !== "pending");
  retentionStatusFilterWrap.classList.toggle(
    "hidden",
    activeTab !== "register",
  );
  sampleStatusFilterWrap.classList.toggle("hidden", activeTab !== "register");
  productGroupFilterWrap.classList.toggle(
    "hidden",
    !["pending", "register"].includes(activeTab),
  );
  newRegisterBtn.classList.toggle("visible", activeTab === "master");
  updateFilterButtonState();
}

function getActiveRows() {
  if (activeTab === "pending") return pendingRows;
  if (activeTab === "register") return registerRows;
  if (activeTab === "ready") return enrichReadyRows();
  if (activeTab === "master") return activeRegisterRows;
  return [];
}

function enrichReadyRows() {
  const byId = new Map(
    registerRows.map((row) => [String(row.control_sample_id ?? row.id), row]),
  );
  return readyRows.map((row) => {
    const key = String(row.control_sample_id ?? row.id);
    return { ...(byId.get(key) ?? {}), ...row };
  });
}

function applyFilters() {
  const searchTerm = normalize(searchInput.value);
  const productGroup = productGroupFilter.value;
  const registerStatus = registerStatusFilter.value;
  const retentionStatus = retentionStatusFilter.value;
  const sampleStatus = sampleStatusFilter.value;
  const shouldApplyProductGroup = ["pending", "register"].includes(activeTab);

  filteredRows = getActiveRows().filter((row) => {
    if (
      shouldApplyProductGroup &&
      productGroup &&
      String(productGroupIdOf(row)) !== productGroup
    ) {
      return false;
    }

    if (activeTab === "pending" && registerStatus) {
      const hasActiveRegister = activeRegisterRows.length > 0;
      if (registerStatus === "resolved" && !hasActiveRegister) return false;
      if (registerStatus === "missing" && hasActiveRegister) return false;
    }

    if (activeTab === "register") {
      if (retentionStatus && row.retention_status !== retentionStatus)
        return false;
      if (sampleStatus && row.control_sample_status !== sampleStatus)
        return false;
    }

    if (searchTerm && !searchHaystack(row).includes(searchTerm)) return false;
    return true;
  });

  renderActiveTab();
  updateFilterButtonState();
}

function getActiveFilterCount() {
  let count = 0;
  if (["pending", "register"].includes(activeTab) && productGroupFilter.value)
    count += 1;
  if (activeTab === "pending" && registerStatusFilter.value) count += 1;
  if (activeTab === "register" && retentionStatusFilter.value) count += 1;
  if (activeTab === "register" && sampleStatusFilter.value) count += 1;
  return count;
}

function updateFilterButtonState() {
  const count = getActiveFilterCount();
  filterDrawerBtn?.classList.toggle("active", count > 0);
  if (filterBadge) {
    filterBadge.textContent = count ? String(count) : "";
    filterBadge.style.display = count ? "block" : "none";
  }
}

function setFilterDrawerOpen(open) {
  filterDrawer?.classList.toggle("open", open);
  filterDrawerBtn?.setAttribute("aria-expanded", String(open));
}

function searchHaystack(row) {
  const fieldsByTab = {
    pending: [
      row.analysis_register_no,
      row.product_name,
      row.product_group_name,
      row.batch_no_snapshot,
    ],
    register: [
      row.control_sample_ref,
      row.analysis_register_no,
      row.product_name,
      row.product_group_name,
      row.batch_no_snapshot,
      row.sku_pack_display,
      row.storage_location,
    ],
    ready: [
      row.control_sample_ref,
      row.product_name,
      row.product_id,
      row.batch_no_snapshot,
      row.batch_no,
      row.sku_pack_display,
      row.control_register_code_snapshot,
    ],
    master: [row.register_short_code, row.register_code, row.remarks],
  };
  return fieldsByTab[activeTab].map(normalize).join(" ");
}

function renderActiveTab() {
  rowCount.textContent = `${filteredRows.length} record${filteredRows.length === 1 ? "" : "s"}`;
  emptyState.textContent = tabMeta[activeTab].empty;
  if (activeTab === "pending") renderPendingTable();
  if (activeTab === "register") renderRegisterTable();
  if (activeTab === "ready") renderReadyTable();
  if (activeTab === "master") renderMasterTable();
  clearStatus();
}

function setTable(columns, rowsHtml) {
  tableHead.innerHTML = `<tr>${columns.map((c) => `<th${c.className ? ` class="${c.className}"` : ""}>${esc(c.label)}</th>`).join("")}</tr>`;
  tableBody.innerHTML = rowsHtml;
  emptyState.classList.toggle("visible", filteredRows.length === 0);
}

function renderPendingTable() {
  const columns = [
    { label: "Product" },
    { label: "Batch No" },
    { label: "Sample Received Date", className: "col-hide-tablet" },
    { label: "Mfg Date", className: "col-hide-tablet" },
    { label: "Exp Date", className: "col-hide-tablet" },
    { label: "Retain Until", className: "col-hide-mobile" },
  ];
  setTable(columns, filteredRows.map(buildPendingRow).join(""));
}

function buildPendingRow(row, index) {
  return `
    <tr class="data-row" data-index="${index}" tabindex="0" title="Open pending collection details">
      <td class="mobile-primary-cell">
        <span class="item-primary">${esc(row.product_name ?? "-")}</span>
        <span class="item-secondary">${esc(row.analysis_register_no ?? "-")}</span>
        <span class="mobile-card-meta">Batch ${esc(batchDisplay(row))} | Exp ${esc(formatDate(row.exp_date))} | Retain ${esc(formatDate(row.retain_until_date))}</span>
      </td>
      <td class="mobile-meta-cell">${esc(batchDisplay(row))}</td>
      <td class="mobile-hide col-hide-tablet">${esc(formatDate(row.sample_received_date))}</td>
      <td class="mobile-hide col-hide-tablet">${esc(formatDate(row.mfg_date))}</td>
      <td class="mobile-hide col-hide-tablet">${esc(formatDate(row.exp_date))}</td>
      <td class="mobile-status-cell col-hide-mobile">${esc(formatDate(row.retain_until_date))}</td>
    </tr>`;
}

function renderRegisterTable() {
  const columns = [
    { label: "Control Sample Ref" },
    { label: "Product" },
    { label: "Pack / Count" },
    { label: "Batch No" },
    { label: "Page No" },
    { label: "Retain Until", className: "col-hide-mobile" },
    { label: "Retention Status" },
    { label: "Status" },
  ];
  setTable(columns, filteredRows.map(buildRegisterRow).join(""));
}

function buildRegisterRow(row, index) {
  return `
    <tr class="data-row" data-index="${index}" tabindex="0">
      <td class="mobile-primary-cell"><span class="item-primary">${esc(row.control_sample_ref ?? "-")}</span><span class="item-secondary">${esc(row.analysis_register_no ?? "")}</span></td>
      <td class="mobile-hide">${esc(row.product_name ?? "-")}</td>
      <td class="mobile-hide">${esc(packCountDisplay(row))}</td>
      <td class="mobile-meta-cell">${esc(batchDisplay(row))}<span class="mobile-card-meta">${esc(row.product_name ?? "-")} | ${esc(packCountDisplay(row))} | Page ${esc(row.page_no ?? "-")} | Retain ${esc(formatDate(row.retain_until_date))}</span></td>
      <td class="mobile-hide">${esc(row.page_no ?? "-")}</td>
      <td class="mobile-hide col-hide-mobile">${esc(formatDate(row.retain_until_date))}</td>
      <td class="mobile-status-cell">${statusBadge(row.retention_status)}</td>
      <td class="mobile-hide">${statusBadge(row.control_sample_status)}</td>
    </tr>`;
}

function renderReadyTable() {
  const columns = [
    { label: "Control Sample Ref" },
    { label: "Product" },
    { label: "Pack / Count" },
    { label: "Batch No" },
    { label: "Register Code" },
    { label: "Page No" },
    { label: "Retain Until" },
  ];
  setTable(columns, filteredRows.map(buildReadyRow).join(""));
}

function buildReadyRow(row, index) {
  const product = row.product_name ?? row.product_id ?? "-";
  return `
    <tr class="data-row" data-index="${index}" tabindex="0">
      <td class="mobile-primary-cell"><span class="item-primary">${esc(row.control_sample_ref ?? "-")}</span><span class="mobile-card-meta">${esc(product)} | Batch ${esc(batchDisplay(row))}</span></td>
      <td class="mobile-hide">${esc(product)}</td>
      <td class="mobile-hide">${esc(packCountDisplay(row))}</td>
      <td class="mobile-meta-cell">${esc(batchDisplay(row))}<span class="mobile-card-meta">${esc(packCountDisplay(row))} | Register ${esc(row.control_register_code_snapshot ?? "-")} | Page ${esc(row.page_no ?? "-")} | Retain ${esc(formatDate(row.retain_until_date))}</span></td>
      <td class="mobile-hide">${esc(row.control_register_code_snapshot ?? "-")}</td>
      <td class="mobile-hide">${esc(row.page_no ?? "-")}</td>
      <td class="mobile-status-cell">${esc(formatDate(row.retain_until_date))}</td>
    </tr>`;
}

function renderMasterTable() {
  const columns = [
    { label: "Register No" },
    { label: "Full Register Code" },
    { label: "Active" },
    { label: "Remarks" },
  ];
  setTable(columns, filteredRows.map(buildMasterRow).join(""));
}

function buildMasterRow(row, index) {
  return `
    <tr class="data-row" data-index="${index}" tabindex="0">
      <td class="mobile-primary-cell"><span class="item-primary">${esc(row.register_short_code ?? "-")}</span><span class="mobile-only-meta">${esc(row.register_code ?? "-")}</span></td>
      <td class="mobile-hide"><span class="item-primary">${esc(row.register_code ?? "-")}</span></td>
      <td class="mobile-status-cell">${booleanBadge(row.is_active)}</td>
      <td class="mobile-meta-cell">${esc(combineRemarks(row))}</td>
    </tr>`;
}

function statusBadge(value) {
  const val = value ?? "-";
  if (val === "COLLECTED")
    return `<span class="badge badge-green">${esc(val)}</span>`;
  if (val === "UNDER_RETENTION")
    return `<span class="badge badge-blue">${esc(val)}</span>`;
  if (val === "READY_FOR_REMOVAL")
    return `<span class="badge badge-amber">${esc(val)}</span>`;
  if (val === "REMOVED")
    return `<span class="badge badge-grey">${esc(val)}</span>`;
  return `<span class="badge badge-grey">${esc(val)}</span>`;
}

function booleanBadge(value) {
  const active =
    value === true || value === "true" || value === "Y" || value === 1;
  return active
    ? `<span class="badge badge-green">Active</span>`
    : `<span class="badge badge-grey">Inactive</span>`;
}

function openCollectionModal(row) {
  if (!activeRegisterRows.length) {
    toast("Cannot collect until an active control register exists.", "error");
    return;
  }
  selectedPendingRow = row;
  collectionForm.reset();
  collectAnalysisNo.value = row.analysis_register_no ?? "";
  collectProduct.value = row.product_name ?? "";
  collectBatch.value = batchDisplay(row);
  collectRegisterId.innerHTML = activeRegisterRows
    .map((register) => {
      const id = register.control_register_id;
      const label = `${register.register_short_code ?? "-"} \u2014 ${register.register_code ?? "-"}`;
      return `<option value="${esc(id)}">${esc(label)}</option>`;
    })
    .join("");
  if (activeRegisterRows.length === 1) {
    collectRegisterId.value = String(activeRegisterRows[0].control_register_id);
  }
  if (!populateSkuDropdownForPendingRow(row)) {
    toast(
      "No active SKU is configured for this product. Complete SKU master before collecting control sample.",
      "error",
      7000,
    );
    selectedPendingRow = null;
    return;
  }
  collectSampleCount.value = "1";
  syncSelectedSkuUom();
  collectionModal.classList.remove("hidden");
  collectRegisterId.focus();
}

async function submitCollection(event) {
  event.preventDefault();
  await withSubmitLock(collectionForm, async () => {
    if (!selectedPendingRow) return;
    const pageNo = Number(collectPageNo.value);
    if (!Number.isInteger(pageNo) || pageNo <= 0) {
      toast("Page No must be a positive integer.", "error");
      return;
    }
    try {
      const userId = await getCurrentUserId();
      const registerId = Number(collectRegisterId.value);
      if (!Number.isInteger(registerId) || registerId <= 0) {
        toast("Select a valid active control register.", "error");
        return;
      }
      const skuId = Number(collectSkuId.value);
      if (!Number.isInteger(skuId) || skuId <= 0) {
        toast("Select a valid pack size.", "error");
        return;
      }
      const sampleCount = Number(collectSampleCount.value);
      if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
        toast("Count must be a positive integer.", "error");
        return;
      }
      const { error } = await labSupabase.rpc(
        "fn_create_control_sample_from_analysis_with_register",
        {
          p_user_id: userId,
          p_analysis_id: selectedPendingRow.analysis_id,
          p_control_register_id: registerId,
          p_page_no: pageNo,
          p_sku_id: skuId,
          p_sample_count: sampleCount,
          p_storage_location: collectStorage.value.trim() || null,
          p_remarks: collectRemarks.value.trim() || null,
        },
      );
      if (error) throw error;
      toast("Control sample collected.", "success");
      closeModal(collectionModal);
      await loadAllData();
      setActiveTab("pending");
    } catch (err) {
      console.error("[Control Sample Register] collection error:", err);
      toast(friendlyError(err), "error", 7000);
    }
  });
}

function openRemovalModal(row) {
  selectedRemovalRow = row;
  removeForm.reset();
  removeRef.value = row.control_sample_ref ?? "";
  removeBatch.value = batchDisplay(row);
  removeRetainUntil.value = formatDate(row.retain_until_date);
  removedDate.value = todayIso();
  removeModal.classList.remove("hidden");
  removalRemarks.focus();
}

async function submitRemoval(event) {
  event.preventDefault();
  await withSubmitLock(removeForm, async () => {
    if (!selectedRemovalRow) return;
    const remarks = removalRemarks.value.trim();
    if (!remarks) {
      toast("Removal remarks are required.", "error");
      return;
    }
    try {
      const userId = await getCurrentUserId();
      const { error } = await labSupabase.rpc(
        "fn_mark_control_sample_removed",
        {
          p_user_id: userId,
          p_control_sample_id:
            selectedRemovalRow.control_sample_id ?? selectedRemovalRow.id,
          p_removed_date: removedDate.value,
          p_removal_remarks: remarks,
        },
      );
      if (error) throw error;
      toast("Control sample marked removed.", "success");
      closeModal(removeModal);
      await loadAllData();
      setActiveTab(activeTab === "ready" ? "ready" : "register");
    } catch (err) {
      console.error("[Control Sample Register] removal error:", err);
      toast(friendlyError(err), "error", 7000);
    }
  });
}

function detailFieldsHtml(fields) {
  return `
    <div class="form-grid">
      ${fields
        .map(
          ([label, value, layout]) => `
            <div class="form-group-modal${layout === "full" ? " form-group-full" : ""}">
              <label>${esc(label)}</label>
              <input class="form-control" readonly value="${esc(value ?? "-")}" />
            </div>`,
        )
        .join("")}
    </div>`;
}

function detailActionsHtml(row, context) {
  if (context === "pending") {
    if (!activeRegisterRows.length) {
      return `<div class="detail-action-note warning">No active control register is available. Create an active register before collection.</div>`;
    }
    if (!skuOptionsForProduct(row.product_id).length) {
      return `<div class="detail-action-note warning">No active SKU is configured for this product. Complete SKU master before collecting control sample.</div>`;
    }
    return `<div class="modal-action-row"><button class="btn-modal btn-modal-save" type="button" data-detail-action="collect">Collect Control Sample</button></div>`;
  }

  if (
    context === "register" &&
    row.retention_status === "READY_FOR_REMOVAL" &&
    row.control_sample_status === "COLLECTED"
  ) {
    return `<div class="modal-action-row"><button class="btn-modal btn-modal-save" type="button" data-detail-action="remove">Remove Control Sample</button></div>`;
  }

  if (context === "ready") {
    return `<div class="modal-action-row"><button class="btn-modal btn-modal-save" type="button" data-detail-action="remove">Remove Control Sample</button></div>`;
  }

  if (context === "master" && row.is_active) {
    return `<div class="modal-action-row"><button class="btn-action btn-deactivate" type="button" data-detail-action="deactivate-register">Deactivate Register</button></div>`;
  }

  return "";
}

function getDetailFields(row, context) {
  if (context === "pending") {
    return [
      ["Analysis Register No", row.analysis_register_no],
      ["Product", row.product_name],
      ["Product Group", row.product_group_name],
      ["Batch No", batchDisplay(row)],
      ["Sample Received Date", formatDate(row.sample_received_date)],
      ["Mfg Date", formatDate(row.mfg_date)],
      ["Exp Date", formatDate(row.exp_date)],
      ["Retain Until", formatDate(row.retain_until_date)],
    ];
  }

  if (context === "ready") {
    return [
      ["Control Sample Ref", row.control_sample_ref],
      ["Product", row.product_name ?? row.product_id],
      ["Pack Size", row.sku_pack_display],
      ["Count", row.sample_count],
      ["Batch No", batchDisplay(row)],
      ["Register Code", row.control_register_code_snapshot],
      ["Page No", row.page_no],
      ["Sample Received Date", formatDate(row.sample_received_date)],
      ["Mfg Date", formatDate(row.mfg_date_snapshot)],
      ["Exp Date", formatDate(row.exp_date_snapshot)],
      ["Retain Until", formatDate(row.retain_until_date)],
      ["Remarks", row.remarks],
    ];
  }

  if (context === "master") {
    return [
      ["Register No", row.register_short_code],
      ["Full Register Code", row.register_code],
      ["Active", row.is_active ? "Active" : "Inactive"],
      ["Created At", formatDate(row.created_at)],
      ["Updated At", formatDate(row.updated_at)],
      ["Remarks", row.remarks, "full"],
    ];
  }

  return [
    ["Control Sample Ref", row.control_sample_ref],
    ["Analysis Register No", row.analysis_register_no],
    ["Product", row.product_name],
    ["Product Group", row.product_group_name],
    ["Pack Size", row.sku_pack_display],
    ["Count", row.sample_count],
    ["Batch No", batchDisplay(row)],
    [
      "Register Code",
      row.control_register_code_snapshot ?? row.current_register_code,
    ],
    ["Page No", row.page_no],
    ["Sample Received Date", formatDate(row.sample_received_date)],
    ["Mfg Date", formatDate(row.mfg_date_snapshot)],
    ["Exp Date", formatDate(row.exp_date_snapshot)],
    ["Retain Until", formatDate(row.retain_until_date)],
    ["Retention Status", row.retention_status],
    ["Control Sample Status", row.control_sample_status],
    ["Storage Location", row.storage_location],
    ["Remarks", row.remarks],
  ];
}

function openRowDetails(row, context) {
  detailsModal.dataset.context = context;
  detailsModal.dataset.rowIndex = String(filteredRows.indexOf(row));
  const titleByContext = {
    pending: "Pending Collection Details",
    register: "Control Sample Details",
    ready: "Ready for Removal Details",
    master: "Register Details",
  };
  const subtitleByContext = {
    pending: row.analysis_register_no,
    register: row.control_sample_ref,
    ready: row.control_sample_ref,
    master: row.register_short_code,
  };
  $("detailsModalTitle").textContent = titleByContext[context] ?? "Details";
  detailsModalSubtitle.textContent = subtitleByContext[context] ?? "";
  const fields = getDetailFields(row, context);
  detailsBody.innerHTML = `
    ${detailFieldsHtml(fields)}
    <div class="detail-actions">${detailActionsHtml(row, context)}</div>`;
  detailsModal.classList.remove("hidden");
}

function openDetailsModal(row) {
  openRowDetails(row, "register");
}

function openRegisterModal() {
  registerForm.reset();
  registerModal.classList.remove("hidden");
  newRegisterCode.focus();
}

async function submitNewRegister(event) {
  event.preventDefault();
  await withSubmitLock(registerForm, async () => {
    const shortCode = newRegisterCode.value.trim();
    if (!shortCode) {
      toast("Register No is required.", "error");
      return;
    }
    try {
      const userId = await getCurrentUserId();
      const { error } = await labSupabase.rpc("fn_create_control_register", {
        p_user_id: userId,
        p_register_short_code: shortCode,
        p_remarks: newRegisterRemarks.value.trim() || null,
      });
      if (error) throw error;
      toast("Control register created.", "success");
      closeModal(registerModal);
      await loadAllData();
      setActiveTab("master");
    } catch (err) {
      console.error("[Control Sample Register] register create error:", err);
      toast(friendlyError(err), "error", 7000);
    }
  });
}

function openDeactivateModal(row) {
  selectedDeactivateRow = row;
  deactivateForm.reset();
  deactivateModalTitle.textContent = "Deactivate Register";
  deactivateModalSubtitle.textContent =
    "Deactivate this physical control sample register. Existing control sample rows will retain their register code snapshot.";
  deactivateRegisterCode.value =
    row.register_short_code ?? row.register_code ?? "";
  deactivateProductGroup.value = row.register_code ?? "";
  deactivateModal.classList.remove("hidden");
  deactivateRemarks.focus();
}

async function submitDeactivate(event) {
  event.preventDefault();
  await withSubmitLock(deactivateForm, async () => {
    if (!selectedDeactivateRow) return;
    const remarks = deactivateRemarks.value.trim();
    if (!remarks) {
      toast("Remarks are required.", "error");
      return;
    }
    const registerId = registerIdOf(selectedDeactivateRow);
    if (!Number.isInteger(Number(registerId)) || Number(registerId) <= 0) {
      toast("Invalid control register selected.", "error");
      return;
    }
    try {
      const userId = await getCurrentUserId();
      const { error } = await labSupabase.rpc(
        "fn_deactivate_control_register_mapping",
        {
          p_user_id: userId,
          p_control_register_id: registerId,
          p_product_group_id: null,
          p_mode: "REGISTER_AND_MAPPINGS",
          p_remarks: remarks,
        },
      );
      if (error) throw error;
      toast("Deactivation saved.", "success");
      closeModal(deactivateModal);
      await loadAllData();
      setActiveTab("master");
    } catch (err) {
      console.error("[Control Sample Register] deactivate error:", err);
      toast(friendlyError(err), "error", 7000);
    }
  });
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function closeAnyOpenModal() {
  document
    .querySelectorAll(".modal-overlay")
    .forEach((modal) => closeModal(modal));
}

function resetFilters() {
  searchInput.value = "";
  searchClear.classList.remove("visible");
  productGroupFilter.value = "";
  registerStatusFilter.value = "";
  retentionStatusFilter.value = "";
  sampleStatusFilter.value = "";
  applyFilters();
  setFilterDrawerOpen(false);
}

function handleAction(action, row) {
  if (action === "collect") openCollectionModal(row);
  if (action === "details") openDetailsModal(row);
  if (action === "remove") openRemovalModal(row);
  if (action === "deactivate-register") openDeactivateModal(row);
}

function wireEvents() {
  refreshBtn.addEventListener("click", () => loadAllData());
  homeBtn.addEventListener("click", () => {
    if (typeof Platform?.goHome === "function") {
      Platform.goHome();
    } else {
      window.location.href = "/";
    }
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
  tabSelect?.addEventListener("change", () => setActiveTab(tabSelect.value));

  searchInput.addEventListener("input", () => {
    searchClear.classList.toggle("visible", searchInput.value.length > 0);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => applyFilters(), 200);
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.remove("visible");
    applyFilters();
    searchInput.focus();
  });
  [
    productGroupFilter,
    registerStatusFilter,
    retentionStatusFilter,
    sampleStatusFilter,
  ].forEach((el) => {
    el.addEventListener("change", applyFilters);
  });
  clearFiltersBtn.addEventListener("click", resetFilters);
  closeFiltersBtn?.addEventListener("click", () => setFilterDrawerOpen(false));
  filterDrawerBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    setFilterDrawerOpen(!filterDrawer?.classList.contains("open"));
  });
  filterDrawer?.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", (event) => {
    if (!filterDrawerWrap?.contains(event.target)) setFilterDrawerOpen(false);
  });
  newRegisterBtn.addEventListener("click", openRegisterModal);

  tableBody.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("[data-action]");
    if (actionBtn) {
      const row = filteredRows[Number(actionBtn.dataset.index)];
      if (!row) return;
      handleAction(actionBtn.dataset.action, row);
      return;
    }

    const rowEl = event.target.closest(".data-row");
    if (!rowEl) return;
    const row = filteredRows[Number(rowEl.dataset.index)];
    if (!row) return;
    openRowDetails(row, activeTab);
  });

  tableBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const rowEl = event.target.closest(".data-row");
    if (!rowEl) return;
    const row = filteredRows[Number(rowEl.dataset.index)];
    if (row) openRowDetails(row, activeTab);
  });

  detailsBody.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-detail-action]");
    if (!btn) return;
    const index = Number(detailsModal.dataset.rowIndex);
    const row = filteredRows[index];
    if (!row) return;
    closeModal(detailsModal);
    handleAction(btn.dataset.detailAction, row);
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeAnyOpenModal());
  });
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setFilterDrawerOpen(false);
      closeAnyOpenModal();
    }
  });

  collectionForm.addEventListener("submit", submitCollection);
  collectSkuId.addEventListener("change", syncSelectedSkuUom);
  removeForm.addEventListener("submit", submitRemoval);
  registerForm.addEventListener("submit", submitNewRegister);
  deactivateForm.addEventListener("submit", submitDeactivate);
}

async function init() {
  wireEvents();
  setActiveTab(activeTab);
  await loadAllData();
}

init();


