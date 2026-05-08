import { labSupabase, supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "product-shelf-life-manager";

const $ = (id) => document.getElementById(id);

const statusArea = $("statusArea");
const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");
const asOfDateInput = $("asOfDate");
const pslmSearch = $("pslmSearch");
const pslmSearchClear = $("pslmSearchClear");
const rowCount = $("rowCount");
const pslmTbody = $("pslmTbody");
const addBtn = $("addBtn");
const filterBtn = $("filterBtn");
const filterBadge = $("filterBadge");
const filterPanel = $("filterPanel");
const filterPanelBody = $("filterPanelBody");
const filterPanelClose = $("filterPanelClose");
const filterApply = $("filterApply");
const filterClear = $("filterClear");

const kpiProducts = $("kpiProducts");
const kpiWithCurrent = $("kpiWithCurrent");
const kpiWithoutCurrent = $("kpiWithoutCurrent");
const kpiActiveRules = $("kpiActiveRules");
const kpiHistoricalRules = $("kpiHistoricalRules");

const shelfLifeModal = $("shelfLifeModal");
const shelfLifeModalTitle = $("shelfLifeModalTitle");
const shelfLifeModalSubtitle = $("shelfLifeModalSubtitle");
const shelfLifeModalClose = $("shelfLifeModalClose");
const modalBanner = $("modalBanner");
const modalProductSelect = $("modalProductSelect");
const modalShelfLifeMonths = $("modalShelfLifeMonths");
const modalEffectiveFrom = $("modalEffectiveFrom");
const modalEffectiveTo = $("modalEffectiveTo");
const modalRemarks = $("modalRemarks");
const modalSave = $("modalSave");
const modalDeactivate = $("modalDeactivate");
const modalCancel = $("modalCancel");
const productSummary = $("productSummary");
const historyWrap = $("historyWrap");

let userId = null;
let products = [];
let shelfLifeRows = [];
let productById = new Map();
let shelfRowsByProductId = new Map();
let currentShelfLifeByProductId = new Map();
let asOfDate = todayISO();
let allProductRows = [];
let currentRows = [];
let searchTerm = "";
let searchDebounceTimer = null;
let selectedProductId = null;
let prevFocus = null;
let modalBusy = false;
let snapshotLoaded = false;

const filters = {
  productStatus: "all",
  shelfLifeStatus: "all",
  shelfLifeRange: "all",
  productFlags: "all",
};

initPage();

async function initPage() {
  if (asOfDateInput) asOfDateInput.value = asOfDate;
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

  if (asOfDateInput) {
    asOfDateInput.addEventListener("change", async () => {
      asOfDate = asOfDateInput.value || todayISO();
      asOfDateInput.value = asOfDate;
      await reloadSnapshotAndRender();
    });
  }

  pslmSearch.addEventListener("input", () => {
    searchTerm = pslmSearch.value.trim();
    pslmSearchClear.classList.toggle("visible", searchTerm.length > 0);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applySearchAndFilters();
      renderTable();
    }, 280);
  });

  pslmSearchClear.addEventListener("click", () => {
    pslmSearch.value = "";
    searchTerm = "";
    pslmSearchClear.classList.remove("visible");
    applySearchAndFilters();
    renderTable();
    pslmSearch.focus();
  });

  addBtn.addEventListener("click", () => openShelfLifeModal(null));

  pslmTbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr.pslm-row[data-product-id]");
    if (!row) return;
    const pid = Number(row.dataset.productId);
    if (!Number.isFinite(pid)) return;
    openShelfLifeModal(pid);
  });

  pslmTbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr.pslm-row[data-product-id]");
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

  modalProductSelect.addEventListener("change", () => {
    selectedProductId = modalProductSelect.value
      ? Number(modalProductSelect.value)
      : null;
    renderProductSummary();
    renderShelfLifeHistory(selectedProductId);
    updateDeactivateButtonVisibility();
    clearModalBanner();
  });

  modalSave.addEventListener("click", saveShelfLifeFromModal);
  modalDeactivate.addEventListener(
    "click",
    deactivateCurrentShelfLifeFromModal,
  );
  modalCancel.addEventListener("click", closeShelfLifeModal);
  shelfLifeModalClose.addEventListener("click", closeShelfLifeModal);
  shelfLifeModal.addEventListener("click", (e) => {
    if (e.target === shelfLifeModal) closeShelfLifeModal();
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
    if (!shelfLifeModal.classList.contains("hidden")) closeShelfLifeModal();
    else if (filterPanel.classList.contains("open")) closeFilterPanel();
  });
}

function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

async function reloadSnapshotAndRender(showRefreshToast = false) {
  setStatus("Loading product shelf-life snapshot...", "loading");
  refreshBtn.disabled = true;
  snapshotLoaded = false;

  try {
    await loadSnapshot();
    snapshotLoaded = true;
    buildLookups();
    allProductRows = buildProductRows();
    applySearchAndFilters();
    renderSummary();
    renderTable();
    clearStatus();
    if (showRefreshToast) showToast("Data refreshed", "success");
  } catch (err) {
    snapshotLoaded = false;
    console.error("[product-shelf-life-manager] reloadSnapshotAndRender:", err);
    setStatus(
      "Error loading shelf-life snapshot: " + (err.message || String(err)),
      "error",
    );
    pslmTbody.innerHTML = "";
    rowCount.textContent = "";
  } finally {
    refreshBtn.disabled = false;
  }
}

async function loadSnapshot() {
  const { data, error } = await labSupabase.rpc(
    "fn_get_product_shelf_life_manager_snapshot",
    { p_as_of_date: asOfDate },
  );

  if (error)
    throw new Error(error.message || "Failed to load shelf-life snapshot");

  products = Array.isArray(data?.products) ? data.products : [];
  shelfLifeRows = Array.isArray(data?.shelfLifeRows) ? data.shelfLifeRows : [];
}

function buildLookups() {
  productById = new Map();
  shelfRowsByProductId = new Map();
  currentShelfLifeByProductId = new Map();

  products.forEach((p) => {
    const pid = Number(p?.product_id);
    if (Number.isFinite(pid)) productById.set(pid, p);
  });

  shelfLifeRows.forEach((r) => {
    const pid = Number(r?.product_id);
    if (!Number.isFinite(pid)) return;
    if (!shelfRowsByProductId.has(pid)) shelfRowsByProductId.set(pid, []);
    shelfRowsByProductId.get(pid).push(r);
  });

  shelfRowsByProductId.forEach((rows, pid) => {
    rows.sort((a, b) => {
      const ad = Date.parse(
        a?.updated_at || a?.created_at || a?.effective_from || 0,
      );
      const bd = Date.parse(
        b?.updated_at || b?.created_at || b?.effective_from || 0,
      );
      return bd - ad;
    });

    const current = rows.find((r) => r?.is_current === true) || null;
    if (current) currentShelfLifeByProductId.set(pid, current);
  });
}

function renderSummary() {
  const productCount = allProductRows.length;
  const withCurrent = allProductRows.filter(
    (r) => r.hasCurrentShelfLife,
  ).length;
  const withoutCurrent = allProductRows.filter(
    (r) => !r.hasCurrentShelfLife,
  ).length;
  const activeRules = shelfLifeRows.filter((r) => r?.is_active === true).length;
  const historicalRules = shelfLifeRows.filter(
    (r) => r?.is_active !== true || r?.is_current !== true,
  ).length;

  kpiProducts.textContent = String(productCount);
  kpiWithCurrent.textContent = String(withCurrent);
  kpiWithoutCurrent.textContent = String(withoutCurrent);
  kpiActiveRules.textContent = String(activeRules);
  kpiHistoricalRules.textContent = String(historicalRules);
}

function buildProductRows() {
  return products.map((p) => {
    const productId = Number(p?.product_id);
    const rowsForProduct = shelfRowsByProductId.get(productId) || [];
    const current = currentShelfLifeByProductId.get(productId) || null;

    const hasAnyShelfLife = rowsForProduct.length > 0;
    const hasCurrentShelfLife = !!current;
    const currentShelfLifeMonths = hasCurrentShelfLife
      ? Number(current.shelf_life_months)
      : null;

    let activeRuleLabel = "Missing";
    if (hasCurrentShelfLife) activeRuleLabel = "Current";
    else if (hasAnyShelfLife) activeRuleLabel = "Inactive / Historical";

    return {
      productId,
      productName: p?.product_name || "",
      malayalamName: p?.malayalam_name || "",
      productStatus: String(p?.product_status || "").trim(),
      uomBase: p?.uom_base || "",
      isLlt: p?.is_llt === true,
      isPto: p?.is_pto === true,
      isSeasonal: p?.is_seasonal === true,
      currentShelfLifeMonths,
      effectiveFrom: current?.effective_from || null,
      effectiveTo: current?.effective_to || null,
      currentRuleId: current?.id ?? null,
      hasCurrentShelfLife,
      hasAnyShelfLife,
      updatedAt: current?.updated_at || current?.created_at || null,
      remarks: current?.remarks || "",
      activeRuleLabel,
      currentRow: current,
    };
  });
}

function applySearchAndFilters() {
  currentRows = allProductRows.filter((row) => {
    if (searchTerm) {
      const haystack = [
        row.productName,
        row.malayalamName,
        row.productStatus,
        row.currentShelfLifeMonths != null
          ? String(row.currentShelfLifeMonths)
          : "",
        row.remarks,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchTerm.toLowerCase())) return false;
    }

    if (filters.productStatus === "active") {
      if (String(row.productStatus || "").toLowerCase() !== "active")
        return false;
    } else if (filters.productStatus === "inactive") {
      if (String(row.productStatus || "").toLowerCase() === "active")
        return false;
    }

    if (
      filters.shelfLifeStatus === "withCurrentShelfLife" &&
      !row.hasCurrentShelfLife
    ) {
      return false;
    }
    if (
      filters.shelfLifeStatus === "withoutCurrentShelfLife" &&
      row.hasCurrentShelfLife
    ) {
      return false;
    }
    if (filters.shelfLifeStatus === "historicalInactive") {
      if (!(row.hasAnyShelfLife && !row.hasCurrentShelfLife)) return false;
    }

    if (filters.shelfLifeRange !== "all") {
      if (row.currentShelfLifeMonths == null) {
        if (filters.shelfLifeStatus !== "withoutCurrentShelfLife") return false;
      } else {
        const m = row.currentShelfLifeMonths;
        if (filters.shelfLifeRange === "upto24" && m > 24) return false;
        if (filters.shelfLifeRange === "25to60" && !(m >= 25 && m <= 60))
          return false;
        if (filters.shelfLifeRange === "61to120" && !(m >= 61 && m <= 120))
          return false;
        if (filters.shelfLifeRange === "above120" && m <= 120) return false;
      }
    }

    if (filters.productFlags === "lltOnly" && !row.isLlt) return false;
    if (filters.productFlags === "ptoOnly" && !row.isPto) return false;
    if (filters.productFlags === "seasonalOnly" && !row.isSeasonal)
      return false;

    return true;
  });

  updateFilterBadge();
}

function renderTable() {
  pslmTbody.innerHTML = "";

  if (!snapshotLoaded) return;

  if (!currentRows.length) {
    pslmTbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div style="padding:14px;border:1px solid var(--border,#e5e7eb);border-radius:8px;background:var(--panel-bg,#fff);">
            <div style="font-weight:700;font-size:14px;color:var(--muted,#374151);">No matching products found.</div>
            <div style="margin-top:4px;color:var(--muted,#6b7280);font-size:12px;">Try clearing filters or search.</div>
          </div>
        </td>
      </tr>`;
    rowCount.textContent = "0 rows";
    return;
  }

  currentRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "pslm-row";
    tr.dataset.productId = String(row.productId);
    tr.tabIndex = 0;
    tr.setAttribute("role", "row");

    const statusLower = String(row.productStatus || "").toLowerCase();
    const statusBadgeCls =
      statusLower === "active" ? "badge-active" : "badge-inactive";

    const currentShelf = row.hasCurrentShelfLife
      ? `${row.currentShelfLifeMonths} months`
      : "Not configured";

    let activeRuleChip = `<span class="badge badge-missing">Missing</span>`;
    if (row.activeRuleLabel === "Current") {
      activeRuleChip = `<span class="badge badge-current">Current</span>`;
    } else if (row.activeRuleLabel === "Inactive / Historical") {
      activeRuleChip = `<span class="badge badge-inactive">Inactive / Historical</span>`;
    }

    const secondaryBits = [];
    if (row.uomBase) secondaryBits.push(`UOM: ${escHtml(row.uomBase)}`);
    if (row.isLlt)
      secondaryBits.push('<span class="badge badge-flag">LLT</span>');
    if (row.isPto)
      secondaryBits.push('<span class="badge badge-flag">PTO</span>');
    if (row.isSeasonal)
      secondaryBits.push('<span class="badge badge-flag">Seasonal</span>');

    tr.innerHTML = `
      <td>
        <span class="item-primary">${escHtml(row.productName || "-")}</span>
        <span class="item-secondary">${secondaryBits.join(" · ") || "-"}</span>
      </td>
      <td class="col-hide-mobile">${escHtml(row.malayalamName || "-")}</td>
      <td><span class="badge ${statusBadgeCls}">${escHtml(row.productStatus || "Unknown")}</span></td>
      <td>${escHtml(currentShelf)}</td>
      <td class="col-hide-mobile">${escHtml(formatDate(row.effectiveFrom))}</td>
      <td>${activeRuleChip}</td>
      <td class="col-hide-mobile">${escHtml(formatDateTime(row.updatedAt))}</td>
    `;

    pslmTbody.appendChild(tr);
  });

  rowCount.textContent = `${currentRows.length} row${currentRows.length !== 1 ? "s" : ""}`;
}

function openShelfLifeModal(productId = null) {
  prevFocus = document.activeElement;
  selectedProductId = Number.isFinite(Number(productId))
    ? Number(productId)
    : null;

  clearModalBanner();
  populateProductDropdown();

  if (selectedProductId != null) {
    shelfLifeModalTitle.textContent = "Product Shelf Life";
    modalProductSelect.value = String(selectedProductId);
    modalProductSelect.disabled = true;
  } else {
    shelfLifeModalTitle.textContent = "New Shelf Life Rule";
    modalProductSelect.disabled = false;
    if (modalProductSelect.options.length > 0) {
      modalProductSelect.value = modalProductSelect.options[0].value;
      selectedProductId = Number(modalProductSelect.value);
    }
  }

  shelfLifeModalSubtitle.textContent =
    selectedProductId != null
      ? "Create a new shelf-life version for this product."
      : "Create shelf-life configuration for a product.";

  const current =
    selectedProductId != null
      ? currentShelfLifeByProductId.get(selectedProductId) || null
      : null;

  modalShelfLifeMonths.value =
    current && Number.isFinite(Number(current.shelf_life_months))
      ? String(Number(current.shelf_life_months))
      : "";
  modalEffectiveFrom.value = asOfDate || todayISO();
  modalEffectiveTo.value = "";
  modalRemarks.value = "";

  renderProductSummary();
  renderShelfLifeHistory(selectedProductId);
  updateDeactivateButtonVisibility();

  shelfLifeModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  modalProductSelect.focus();
}

function closeShelfLifeModal() {
  if (modalBusy) return;
  shelfLifeModal.classList.add("hidden");
  document.body.style.overflow = "";
  clearModalBanner();
  selectedProductId = null;

  try {
    if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
  } catch {
    // Ignore focus restore failures.
  }
  prevFocus = null;
}

function populateProductDropdown() {
  const sorted = [...products].sort((a, b) =>
    String(a?.product_name || "").localeCompare(String(b?.product_name || "")),
  );

  modalProductSelect.innerHTML = sorted
    .map((p) => {
      const pid = Number(p?.product_id);
      if (!Number.isFinite(pid)) return "";
      const text = `${p?.product_name || "Unnamed"} (${p?.product_status || "Unknown"})`;
      return `<option value="${pid}">${escHtml(text)}</option>`;
    })
    .join("");
}

function renderProductSummary() {
  if (selectedProductId == null) {
    productSummary.innerHTML =
      '<div class="summary-cell"><span class="summary-label">Product</span><span class="summary-value">Select a product</span></div>';
    return;
  }

  const p = productById.get(selectedProductId);
  if (!p) {
    productSummary.innerHTML =
      '<div class="summary-cell"><span class="summary-label">Product</span><span class="summary-value">Not found</span></div>';
    return;
  }

  const flags = [
    p?.is_llt ? "LLT" : null,
    p?.is_pto ? "PTO" : null,
    p?.is_seasonal ? "Seasonal" : null,
  ]
    .filter(Boolean)
    .join(" / ");

  productSummary.innerHTML = `
    <div class="summary-cell">
      <span class="summary-label">Product Name</span>
      <span class="summary-value">${escHtml(p?.product_name || "-")}</span>
    </div>
    <div class="summary-cell">
      <span class="summary-label">Malayalam Name</span>
      <span class="summary-value">${escHtml(p?.malayalam_name || "-")}</span>
    </div>
    <div class="summary-cell">
      <span class="summary-label">Product Status</span>
      <span class="summary-value">${escHtml(p?.product_status || "-")}</span>
    </div>
    <div class="summary-cell">
      <span class="summary-label">UOM</span>
      <span class="summary-value">${escHtml(p?.uom_base || "-")}</span>
    </div>
    <div class="summary-cell">
      <span class="summary-label">Flags</span>
      <span class="summary-value">${escHtml(flags || "None")}</span>
    </div>
  `;
}

function renderShelfLifeHistory(productId) {
  if (productId == null) {
    historyWrap.innerHTML =
      '<div style="padding:10px;font-size:12px;color:var(--muted,#6b7280);">Select a product to view history.</div>';
    return;
  }

  const rows = shelfRowsByProductId.get(Number(productId)) || [];
  if (!rows.length) {
    historyWrap.innerHTML =
      '<div style="padding:10px;font-size:12px;color:var(--muted,#6b7280);">No shelf-life history found for this product.</div>';
    return;
  }

  const body = rows
    .map((r) => {
      const currentChip = r?.is_current
        ? '<span class="badge badge-current">Current</span>'
        : '<span class="badge badge-inactive">No</span>';
      const activeChip = r?.is_active
        ? '<span class="badge badge-active">Active</span>'
        : '<span class="badge badge-inactive">Inactive</span>';

      return `
        <tr>
          <td>${escHtml(`${Number(r?.shelf_life_months) || 0} months`)}</td>
          <td>${escHtml(formatDate(r?.effective_from))}</td>
          <td>${escHtml(formatDate(r?.effective_to))}</td>
          <td>${currentChip}</td>
          <td>${activeChip}</td>
          <td>${escHtml(r?.remarks || "-")}</td>
          <td>${escHtml(formatDateTime(r?.updated_at || r?.created_at))}</td>
        </tr>
      `;
    })
    .join("");

  historyWrap.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Shelf Life Months</th>
          <th>Effective From</th>
          <th>Effective To</th>
          <th>Current</th>
          <th>Active</th>
          <th>Remarks</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

async function saveShelfLifeFromModal() {
  if (modalBusy) return;

  const p_product_id = Number(modalProductSelect.value || selectedProductId);
  const p_shelf_life_months = Number(modalShelfLifeMonths.value);
  const p_effective_from = modalEffectiveFrom.value || "";
  const p_effective_to = modalEffectiveTo.value || null;
  const p_remarks = (modalRemarks.value || "").trim() || null;

  if (!Number.isFinite(p_product_id)) {
    showModalBanner("error", "Please select a product.");
    return;
  }
  if (!Number.isFinite(p_shelf_life_months) || p_shelf_life_months <= 0) {
    showModalBanner("error", "Shelf life months must be a positive integer.");
    return;
  }
  if (!p_effective_from) {
    showModalBanner("error", "Effective from date is required.");
    return;
  }
  if (p_effective_to && p_effective_to < p_effective_from) {
    showModalBanner(
      "error",
      "Effective to date cannot be earlier than effective from date.",
    );
    return;
  }

  setModalBusy(true);

  try {
    const { error } = await labSupabase.rpc("fn_save_product_shelf_life", {
      p_product_id,
      p_shelf_life_months: Math.trunc(p_shelf_life_months),
      p_effective_from,
      p_effective_to,
      p_remarks,
    });

    if (error) throw new Error(error.message || "Failed to save shelf life");

    closeShelfLifeModal();
    await reloadSnapshotAndRender();
    showToast("Shelf life version saved.", "success");
  } catch (err) {
    console.error("[product-shelf-life-manager] saveShelfLifeFromModal:", err);
    showModalBanner("error", err.message || "Failed to save shelf life.");
    showToast(err.message || "Failed to save shelf life.", "error");
  } finally {
    setModalBusy(false);
  }
}

async function deactivateCurrentShelfLifeFromModal() {
  if (modalBusy) return;

  const pid = Number(modalProductSelect.value || selectedProductId);
  const current = currentShelfLifeByProductId.get(pid);
  if (!current?.id) {
    showModalBanner(
      "error",
      "No current shelf-life rule exists for this product.",
    );
    return;
  }

  if (
    !window.confirm("Deactivate the current shelf-life rule for this product?")
  ) {
    return;
  }

  const p_effective_to = modalEffectiveTo.value || asOfDate || todayISO();
  const p_remarks = (modalRemarks.value || "").trim() || null;

  setModalBusy(true);

  try {
    const { error } = await labSupabase.rpc(
      "fn_deactivate_product_shelf_life",
      {
        p_id: Number(current.id),
        p_effective_to,
        p_remarks,
      },
    );

    if (error)
      throw new Error(error.message || "Failed to deactivate shelf life");

    closeShelfLifeModal();
    await reloadSnapshotAndRender();
    showToast("Shelf life rule deactivated.", "info");
  } catch (err) {
    console.error(
      "[product-shelf-life-manager] deactivateCurrentShelfLife:",
      err,
    );
    showModalBanner("error", err.message || "Failed to deactivate shelf life.");
    showToast(err.message || "Failed to deactivate shelf life.", "error");
  } finally {
    setModalBusy(false);
  }
}

function updateDeactivateButtonVisibility() {
  const pid = Number(modalProductSelect.value || selectedProductId);
  const current = currentShelfLifeByProductId.get(pid) || null;
  modalDeactivate.style.display = current ? "inline-flex" : "none";
}

function setModalBusy(busy) {
  modalBusy = busy;
  modalSave.disabled = busy;
  modalDeactivate.disabled = busy;
  modalCancel.disabled = busy;
  modalProductSelect.disabled = busy || selectedProductId != null;
}

function buildFilterPanel() {
  filterPanelBody.innerHTML = `
    <div class="filter-group">
      <label>Product Status</label>
      <select id="fp_productStatus">
        <option value="all"${filters.productStatus === "all" ? " selected" : ""}>All</option>
        <option value="active"${filters.productStatus === "active" ? " selected" : ""}>Active</option>
        <option value="inactive"${filters.productStatus === "inactive" ? " selected" : ""}>Inactive</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Shelf Life Status</label>
      <select id="fp_shelfLifeStatus">
        <option value="all"${filters.shelfLifeStatus === "all" ? " selected" : ""}>All</option>
        <option value="withCurrentShelfLife"${filters.shelfLifeStatus === "withCurrentShelfLife" ? " selected" : ""}>With Current Shelf Life</option>
        <option value="withoutCurrentShelfLife"${filters.shelfLifeStatus === "withoutCurrentShelfLife" ? " selected" : ""}>Without Current Shelf Life</option>
        <option value="historicalInactive"${filters.shelfLifeStatus === "historicalInactive" ? " selected" : ""}>Historical / Inactive</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Shelf Life Range</label>
      <select id="fp_shelfLifeRange">
        <option value="all"${filters.shelfLifeRange === "all" ? " selected" : ""}>All</option>
        <option value="upto24"${filters.shelfLifeRange === "upto24" ? " selected" : ""}>Up to 24 months</option>
        <option value="25to60"${filters.shelfLifeRange === "25to60" ? " selected" : ""}>25 to 60 months</option>
        <option value="61to120"${filters.shelfLifeRange === "61to120" ? " selected" : ""}>61 to 120 months</option>
        <option value="above120"${filters.shelfLifeRange === "above120" ? " selected" : ""}>Above 120 months</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Product Flags</label>
      <select id="fp_productFlags">
        <option value="all"${filters.productFlags === "all" ? " selected" : ""}>All</option>
        <option value="lltOnly"${filters.productFlags === "lltOnly" ? " selected" : ""}>LLT only</option>
        <option value="ptoOnly"${filters.productFlags === "ptoOnly" ? " selected" : ""}>PTO only</option>
        <option value="seasonalOnly"${filters.productFlags === "seasonalOnly" ? " selected" : ""}>Seasonal only</option>
      </select>
    </div>
  `;
}

function applyFilters() {
  const getVal = (id, fallback) => $(id)?.value || fallback;
  filters.productStatus = getVal("fp_productStatus", "all");
  filters.shelfLifeStatus = getVal("fp_shelfLifeStatus", "all");
  filters.shelfLifeRange = getVal("fp_shelfLifeRange", "all");
  filters.productFlags = getVal("fp_productFlags", "all");

  applySearchAndFilters();
  renderTable();
}

function clearFilters() {
  filters.productStatus = "all";
  filters.shelfLifeStatus = "all";
  filters.shelfLifeRange = "all";
  filters.productFlags = "all";

  buildFilterPanel();
  applySearchAndFilters();
  renderTable();
}

function updateFilterBadge() {
  let count = 0;
  if (filters.productStatus !== "all") count += 1;
  if (filters.shelfLifeStatus !== "all") count += 1;
  if (filters.shelfLifeRange !== "all") count += 1;
  if (filters.productFlags !== "all") count += 1;

  filterBadge.textContent = String(count);
  filterBadge.classList.toggle("visible", count > 0);
}

function positionFilterPanel() {
  const rect = filterBtn.getBoundingClientRect();
  const panelWidth = filterPanel.offsetWidth || 300;
  const panelHeight = filterPanel.offsetHeight || 300;

  let left = rect.right - panelWidth;
  let top = rect.bottom + 8;

  if (left < 8) left = 8;
  if (left + panelWidth > window.innerWidth - 8) {
    left = window.innerWidth - panelWidth - 8;
  }

  if (top + panelHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - panelHeight - 8);
  }

  filterPanel.style.left = `${Math.round(left)}px`;
  filterPanel.style.top = `${Math.round(top)}px`;
}

function closeFilterPanel() {
  filterPanel.classList.remove("open");
}

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

function setStatus(message, type = "normal") {
  statusArea.textContent = message;
  statusArea.style.display = "block";
  statusArea.dataset.type = type;
}

function clearStatus() {
  statusArea.style.display = "none";
  statusArea.dataset.type = "";
  statusArea.textContent = "";
}

function showModalBanner(type, message) {
  modalBanner.dataset.type = type;
  modalBanner.textContent = message;
  modalBanner.style.display = "block";
}

function clearModalBanner() {
  modalBanner.dataset.type = "";
  modalBanner.textContent = "";
  modalBanner.style.display = "none";
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [y, m, d] = String(value).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt
    .toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\u200E/g, "");
}
