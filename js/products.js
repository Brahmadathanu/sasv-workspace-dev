// js/products.js — Gate 5.11V governed Product Master writers
import { supabase } from "../public/shared/js/supabaseClient.js";
import { bootstrapApp } from "../public/shared/js/appBootstrap.js";
import { mountModuleHome } from "../public/shared/js/sasv-module-chrome.js";

const MODULE_TARGET = "module:manage-products";

// DOM refs
const homeBtn = document.getElementById("homeBtn");
const searchInput = document.getElementById("searchInput");
const productList = document.getElementById("productList");
const form = document.getElementById("productForm");
const itemInput = document.getElementById("itemInput");
const malInput = document.getElementById("malInput");
const statusSelect = document.getElementById("statusSelect");
const categorySelect = document.getElementById("categorySelect");
const subcategorySelect = document.getElementById("subcategorySelect");
const groupSelect = document.getElementById("groupSelect");
const subgroupSelect = document.getElementById("subgroupSelect");
const isPtoCheckbox = document.getElementById("isPtoCheckbox");
const uomBaseSelect = document.getElementById("uomBaseSelect");
const conversionInput = document.getElementById("conversionInput");
const isSeasonalCheckbox = document.getElementById("isSeasonalCheckbox");
const seasonProfileSelect = document.getElementById("seasonProfileSelect");
const isLltCheckbox = document.getElementById("isLltCheckbox");
const leadTimeInput = document.getElementById("leadTimeMonths");
const deleteBtn = document.getElementById("deleteBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalMessage = document.getElementById("modalMessage");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");
const editToggleBtn = document.getElementById("editToggleBtn");
const toastEl = document.getElementById("toast");
const loadingOverlay = document.getElementById("loadingOverlay");
const saveIconBtn = document.getElementById("saveIconBtn");
const cancelIconBtn = document.getElementById("cancelIconBtn");
const inlineDeleteBtn = document.getElementById("inlineDeleteBtn");
const newInlineBtn = document.getElementById("newInlineBtn");
const productCountPill = document.getElementById("productCountPill");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const accessStatusEl = document.getElementById("accessStatus");
const viewOnlyBanner = document.getElementById("viewOnlyBanner");
const productMasterMain = document.getElementById("productMasterMain");

const governanceModalOverlay = document.getElementById("governanceModalOverlay");
const governanceModalBox = document.getElementById("governanceModalBox");
const governanceModalTitle = document.getElementById("governanceModalTitle");
const governanceModalMessage = document.getElementById("governanceModalMessage");
const governanceModalIcon = document.getElementById("governanceModalIcon");
const governanceReason = document.getElementById("governanceReason");
const governanceApprovalRef = document.getElementById("governanceApprovalRef");
const governanceReasonError = document.getElementById("governanceReasonError");
const governanceConfirm = document.getElementById("governanceConfirm");
const governanceCancel = document.getElementById("governanceCancel");

const accessState = {
  userId: null,
  canView: false,
  canEdit: false,
  loaded: false,
};

let allProducts = [];
let filtered = [];
let selectedId = null;
let unsaved = false;
let editing = false;
let previousSelectedId = null;
let inNewMode = false;
let keyboardIndex = -1;
let writeBusy = false;
let loadedProductSnapshot = null;
let classificationsWired = false;

function canAccessModule() {
  return Boolean(accessState.canView || accessState.canEdit);
}

function canWriteModule() {
  return Boolean(accessState.canEdit);
}

function showToast(text, timeout = 3500) {
  try {
    if (!toastEl) return alert(text);
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastEl._hideTimeout);
    toastEl._hideTimeout = setTimeout(() => {
      toastEl.classList.remove("show");
    }, timeout);
  } catch (e) {
    console.error(e);
  }
}

function showLoading() {
  try {
    if (!loadingOverlay) return;
    loadingOverlay.classList.add("show");
    loadingOverlay.setAttribute("aria-hidden", "false");
  } catch (err) {
    console.error(err);
  }
}

function hideLoading() {
  try {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove("show");
    loadingOverlay.setAttribute("aria-hidden", "true");
  } catch (err) {
    console.error(err);
  }
}

function setAccessDenied(message) {
  document.body.classList.add("access-denied");
  if (accessStatusEl) {
    accessStatusEl.hidden = false;
    accessStatusEl.textContent = message;
  }
  if (viewOnlyBanner) viewOnlyBanner.hidden = true;
  if (productMasterMain) productMasterMain.hidden = true;
}

function normalizeRpcRow(data, operationLabel) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error(
      `${operationLabel} did not return a product row. Please try again.`,
    );
  }
  return row;
}

function requireProductId(row, operationLabel) {
  const productId = Number(row.product_id);
  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error(
      `${operationLabel} did not return a valid product_id. Please try again.`,
    );
  }
  return productId;
}

function surfaceRpcError(error, fallback) {
  console.error(error);
  const message =
    (error && (error.message || error.details || error.hint)) ||
    fallback ||
    "The operation failed.";
  showToast(message, 6000);
}

function setWriteBusy(busy) {
  writeBusy = !!busy;
  applyAccessChrome();
}

function updateDirtyIcons() {
  const show = !!editing && !!unsaved && canWriteModule() && !writeBusy;
  if (saveIconBtn) saveIconBtn.style.display = show ? "inline-block" : "none";
  if (cancelIconBtn)
    cancelIconBtn.style.display =
      !!editing && !!unsaved && canWriteModule() ? "inline-block" : "none";
}

function setEditing(on) {
  if (on && !canWriteModule()) {
    editing = false;
    showToast("You do not have permission to edit products.");
    applyAccessChrome();
    return;
  }
  editing = !!on && canWriteModule();
  applyAccessChrome();
}

function applyAccessChrome() {
  const hasAccess = canAccessModule();
  const canEdit = canWriteModule();

  document.body.classList.toggle("view-only-mode", hasAccess && !canEdit);
  if (viewOnlyBanner) viewOnlyBanner.hidden = !(hasAccess && !canEdit);

  if (editToggleBtn) {
    editToggleBtn.classList.toggle("active", editing);
    if (!canEdit) {
      editToggleBtn.disabled = true;
      editToggleBtn.title = "You do not have edit permission";
    } else if (!selectedId && !inNewMode) {
      editToggleBtn.disabled = true;
      editToggleBtn.title = "Select a product to enable edit";
    } else if (inNewMode) {
      editToggleBtn.disabled = true;
      editToggleBtn.title = "Finish or cancel the new product first";
    } else {
      editToggleBtn.disabled = writeBusy;
      editToggleBtn.title = editing ? "Disable edit" : "Enable edit";
    }
  }

  if (newInlineBtn) {
    newInlineBtn.disabled = !canEdit || writeBusy;
    newInlineBtn.title = canEdit
      ? "New product"
      : "You do not have permission to create products";
  }

  if (inlineDeleteBtn) {
    const showDeactivate = !!selectedId && !inNewMode;
    inlineDeleteBtn.style.display = showDeactivate ? "inline-block" : "none";
    inlineDeleteBtn.disabled = !canEdit || writeBusy || !showDeactivate;
    inlineDeleteBtn.title = canEdit
      ? "Deactivate product"
      : "You do not have permission to deactivate products";
    inlineDeleteBtn.setAttribute("aria-label", "Deactivate product");
  }

  if (deleteBtn) deleteBtn.disabled = !editing || writeBusy;

  const knownControls = [
    itemInput,
    malInput,
    statusSelect,
    categorySelect,
    subcategorySelect,
    groupSelect,
    subgroupSelect,
    isPtoCheckbox,
    uomBaseSelect,
    conversionInput,
    isSeasonalCheckbox,
    seasonProfileSelect,
    isLltCheckbox,
    leadTimeInput,
  ];
  knownControls.forEach((c) => {
    if (!c) return;
    try {
      c.disabled = !editing || writeBusy;
    } catch (err) {
      console.error(err);
    }
  });

  if (uomBaseSelect && conversionInput) {
    conversionInput.disabled = !(
      editing &&
      !writeBusy &&
      uomBaseSelect.value
    );
  }
  if (seasonProfileSelect) {
    seasonProfileSelect.disabled = !(
      editing &&
      !writeBusy &&
      isSeasonalCheckbox &&
      isSeasonalCheckbox.checked
    );
  }
  if (leadTimeInput) {
    leadTimeInput.disabled = !(
      editing &&
      !writeBusy &&
      isLltCheckbox &&
      isLltCheckbox.checked
    );
  }

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.disabled = !editing || writeBusy;

  updateClassificationState();
  updateDirtyIcons();
}

async function loadProductMasterAccess() {
  accessState.userId = null;
  accessState.canView = false;
  accessState.canEdit = false;
  accessState.loaded = false;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user?.id) {
    throw sessionError || new Error("No active session");
  }

  accessState.userId = session.user.id;
  const uid = accessState.userId;
  let found = null;

  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: uid,
    });
    if (!error && Array.isArray(perms)) {
      const hit = perms.find((r) => r?.target === MODULE_TARGET);
      if (hit) found = hit;
    }
  } catch {
    // fall through
  }

  if (!found) {
    try {
      const { data: canonicalRows } = await supabase
        .from("user_permissions_canonical")
        .select("can_view, can_edit")
        .eq("user_id", uid)
        .eq("target", MODULE_TARGET)
        .limit(1);
      if (Array.isArray(canonicalRows) && canonicalRows.length) {
        found = canonicalRows[0];
      }
    } catch {
      // fail closed — do not guess legacy module ids
    }
  }

  if (found) {
    accessState.canView = Boolean(found.can_view);
    accessState.canEdit = Boolean(found.can_edit);
  }

  accessState.loaded = true;
}

// ─── prevent focus loss on Ctrl+Digit ─────────────────────
window.addEventListener(
  "keydown",
  (e) => {
    const a = document.activeElement;
    if (
      a &&
      ["INPUT", "SELECT", "TEXTAREA"].includes(a.tagName) &&
      e.ctrlKey &&
      e.code.startsWith("Digit")
    ) {
      e.preventDefault();
      if (e.code === "Digit5") itemInput.focus();
    }
  },
  true,
);

// ─── modal helper (enhanced ERP-styled) ────────────────────
const modalBox = document.getElementById("modalBox");
const modalTitle = document.getElementById("modalTitle");
const modalIcon = document.getElementById("modalIcon");
function showModal(msg, okText = "OK", cancelText = "Cancel", type = null) {
  const inferType = (ok) => {
    if (!ok) return "confirm";
    const o = ok.toLowerCase();
    if (o.includes("delete") || o.includes("deactivate")) return "delete";
    if (o.includes("save")) return "save";
    if (o.includes("discard") || o.includes("cancel")) return "warning";
    return "confirm";
  };
  const t = type || inferType(okText);
  if (modalBox) {
    modalBox.classList.remove(
      "type-delete",
      "type-save",
      "type-warning",
      "type-confirm",
    );
    modalBox.classList.add(`type-${t}`);
  }
  const titleMap = {
    delete: "Confirm",
    save: "Confirm Save",
    warning: "Warning",
    confirm: "Confirm",
  };
  const svgMap = {
    delete:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18" stroke="#d9534f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6l1-2h6l1 2" stroke="#d9534f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="7" y="6" width="10" height="13" rx="2" stroke="#d9534f" stroke-width="1.6" fill="none"/><path d="M10 10v6M14 10v6" stroke="#d9534f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    save: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 3h14v18H5z" stroke="#2d8f46" stroke-width="1.6" fill="none"/><path d="M9 11l2 2 4-4" stroke="#2d8f46" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#b36b00" stroke-width="1.4" fill="none"/><path d="M12 9v4M12 17h.01" stroke="#b36b00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    confirm:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#2b6ea3" stroke-width="1.4" fill="none"/><path d="M9 12l2 2 4-4" stroke="#2b6ea3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  if (modalTitle) modalTitle.textContent = titleMap[t] || "Confirm";
  if (modalIcon) modalIcon.innerHTML = svgMap[t] || svgMap.confirm;

  return new Promise((res) => {
    const previouslyFocused = document.activeElement;
    modalMessage.textContent = msg;
    if (modalConfirm) {
      modalConfirm.textContent = okText || "OK";
      modalConfirm.className =
        "btn primary" + (t === "delete" ? " danger" : "");
    }
    if (modalCancel) {
      modalCancel.textContent = cancelText || "Cancel";
      modalCancel.className = "btn secondary";
      modalCancel.style.display = cancelText === "" ? "none" : "";
    }
    if (modalOverlay) {
      modalOverlay.classList.add("show");
      modalOverlay.setAttribute("aria-hidden", "false");
    }
    try {
      if (modalConfirm && typeof modalConfirm.focus === "function")
        modalConfirm.focus();
    } catch {
      /* ignore */
    }
    const cleanup = () => {
      if (modalConfirm) modalConfirm.removeEventListener("click", onOk);
      if (modalCancel) modalCancel.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
      try {
        if (previouslyFocused && typeof previouslyFocused.focus === "function")
          previouslyFocused.focus();
      } catch {
        /* ignore */
      }
      if (modalOverlay) {
        modalOverlay.classList.remove("show");
        modalOverlay.setAttribute("aria-hidden", "true");
      }
    };
    const onOk = () => {
      cleanup();
      res(true);
    };
    const onCancel = () => {
      cleanup();
      res(false);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onCancel();
      }
    };
    if (modalConfirm) modalConfirm.addEventListener("click", onOk);
    if (modalCancel) modalCancel.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
  });
}

function promptGovernance({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    if (
      !governanceModalOverlay ||
      !governanceReason ||
      !governanceConfirm ||
      !governanceCancel
    ) {
      resolve(null);
      return;
    }

    const previouslyFocused = document.activeElement;
    if (governanceModalTitle) governanceModalTitle.textContent = title || "Confirm";
    if (governanceModalMessage) governanceModalMessage.textContent = message || "";
    if (governanceModalBox) {
      governanceModalBox.classList.toggle("type-danger", !!danger);
    }
    if (governanceModalIcon) {
      governanceModalIcon.innerHTML = danger
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#b42318" stroke-width="1.4" fill="none"/><path d="M12 9v4M12 17h.01" stroke="#b42318" stroke-width="1.6" stroke-linecap="round"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 3h14v18H5z" stroke="#2d8f46" stroke-width="1.6" fill="none"/><path d="M9 11l2 2 4-4" stroke="#2d8f46" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    governanceReason.value = "";
    if (governanceApprovalRef) governanceApprovalRef.value = "";
    if (governanceReasonError) governanceReasonError.textContent = "";
    governanceConfirm.textContent = confirmLabel || "Confirm";
    governanceConfirm.className = "btn primary" + (danger ? " danger" : "");

    governanceModalOverlay.classList.add("show");
    governanceModalOverlay.setAttribute("aria-hidden", "false");
    try {
      governanceReason.focus();
    } catch {
      /* ignore */
    }

    const cleanup = () => {
      governanceConfirm.removeEventListener("click", onOk);
      governanceCancel.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
      try {
        if (previouslyFocused && typeof previouslyFocused.focus === "function")
          previouslyFocused.focus();
      } catch {
        /* ignore */
      }
      governanceModalOverlay.classList.remove("show");
      governanceModalOverlay.setAttribute("aria-hidden", "true");
    };

    const onOk = () => {
      const reason = String(governanceReason.value || "").trim();
      if (!reason) {
        if (governanceReasonError) {
          governanceReasonError.textContent = "A business reason is required.";
        }
        try {
          governanceReason.focus();
        } catch {
          /* ignore */
        }
        return;
      }
      const approvalReference = String(
        governanceApprovalRef?.value || "",
      ).trim();
      cleanup();
      resolve({
        reason,
        approvalReference: approvalReference || null,
      });
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onCancel();
      }
    };

    governanceConfirm.addEventListener("click", onOk);
    governanceCancel.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
  });
}

function buildProductRpcPayloadFromForm({ reason, approvalReference }) {
  const newItem = itemInput.value.trim();
  const newMal = malInput.value.trim();
  const newStat = statusSelect.value;
  const newSg = subgroupSelect.value ? Number(subgroupSelect.value) : null;
  const newPto = isPtoCheckbox ? isPtoCheckbox.checked : false;
  const newUom = uomBaseSelect ? uomBaseSelect.value || null : null;
  const newConversion =
    conversionInput && conversionInput.value !== ""
      ? Number(conversionInput.value)
      : null;
  const newIsSeasonal = isSeasonalCheckbox ? isSeasonalCheckbox.checked : false;
  const newSeasonProfile =
    seasonProfileSelect && seasonProfileSelect.value
      ? Number(seasonProfileSelect.value)
      : null;
  const newIsLlt = isLltCheckbox ? isLltCheckbox.checked : false;
  const newLeadTime =
    leadTimeInput && leadTimeInput.value !== ""
      ? parseInt(leadTimeInput.value, 10)
      : null;

  return {
    p_item: newItem,
    p_sub_group_id: newSg,
    p_malayalam_name: newMal,
    p_status: newStat,
    p_uom_base: newUom,
    p_conversion_to_base: newConversion,
    p_is_seasonal: newIsSeasonal,
    p_is_llt: newIsLlt,
    p_manufacture_lead_time_months: newLeadTime,
    p_season_profile_id: newSeasonProfile,
    p_is_pto: newPto,
    p_reason: reason,
    p_approval_reference: approvalReference || null,
  };
}

function buildProductRpcPayloadFromSnapshot(
  snapshot,
  { reason, approvalReference, statusOverride } = {},
) {
  return {
    p_product_id: Number(snapshot.product_id),
    p_item: snapshot.item,
    p_sub_group_id: snapshot.sub_group_id,
    p_malayalam_name: snapshot.malayalam_name,
    p_status: statusOverride || snapshot.status,
    p_uom_base: snapshot.uom_base,
    p_conversion_to_base: snapshot.conversion_to_base,
    p_is_seasonal: !!snapshot.is_seasonal,
    p_is_llt: !!snapshot.is_llt,
    p_manufacture_lead_time_months: snapshot.manufacture_lead_time_months,
    p_season_profile_id: snapshot.season_profile_id,
    p_is_pto: !!snapshot.is_pto,
    p_reason: reason,
    p_approval_reference: approvalReference || null,
  };
}

function captureLoadedSnapshot(prod, productId) {
  loadedProductSnapshot = {
    product_id: Number(productId),
    item: prod.item,
    malayalam_name: prod.malayalam_name,
    status: prod.status,
    sub_group_id: prod.sub_group_id != null ? Number(prod.sub_group_id) : null,
    is_pto: !!prod.is_pto,
    uom_base: prod.uom_base || null,
    conversion_to_base:
      prod.conversion_to_base === null || prod.conversion_to_base === undefined
        ? null
        : Number(prod.conversion_to_base),
    is_seasonal: !!prod.is_seasonal,
    season_profile_id:
      prod.season_profile_id === null || prod.season_profile_id === undefined
        ? null
        : Number(prod.season_profile_id),
    is_llt: !!prod.is_llt,
    manufacture_lead_time_months:
      prod.manufacture_lead_time_months === null ||
      prod.manufacture_lead_time_months === undefined
        ? null
        : Number(prod.manufacture_lead_time_months),
  };
}

// ─── cascading classification loads ────────────────────────
async function loadClassifications() {
  const { data: cats, error } = await supabase
    .from("categories")
    .select("id, category_name")
    .order("category_name");
  if (error) return console.error(error);

  categorySelect.innerHTML = '<option value="">-- Select --</option>';
  cats.forEach((c) => categorySelect.add(new Option(c.category_name, c.id)));

  if (!classificationsWired) {
    categorySelect.addEventListener("change", () =>
      loadSubcats(categorySelect.value),
    );
    subcategorySelect.addEventListener("change", () =>
      loadGroups(subcategorySelect.value),
    );
    groupSelect.addEventListener("change", () =>
      loadSubgroups(groupSelect.value),
    );
    classificationsWired = true;
  }
  updateClassificationState();
}

async function loadSubcats(catId) {
  subcategorySelect.innerHTML = '<option value="">-- Select --</option>';
  groupSelect.innerHTML = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!catId) return;
  const { data, error } = await supabase
    .from("sub_categories")
    .select("id, subcategory_name")
    .eq("category_id", catId)
    .order("subcategory_name");
  if (error) return console.error(error);
  data.forEach((s) =>
    subcategorySelect.add(new Option(s.subcategory_name, s.id)),
  );
  updateClassificationState();
}

async function loadGroups(subId) {
  groupSelect.innerHTML = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!subId) return;
  const { data, error } = await supabase
    .from("product_groups")
    .select("id, group_name")
    .eq("sub_category_id", subId)
    .order("group_name");
  if (error) return console.error(error);
  data.forEach((g) => groupSelect.add(new Option(g.group_name, g.id)));
  updateClassificationState();
}

async function loadSubgroups(gId) {
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!gId) return;
  const { data, error } = await supabase
    .from("sub_groups")
    .select("id, sub_group_name")
    .eq("product_group_id", gId)
    .order("sub_group_name");
  if (error) return console.error(error);
  data.forEach((sg) =>
    subgroupSelect.add(new Option(sg.sub_group_name, sg.id)),
  );
  updateClassificationState();
}

function updateClassificationState() {
  const hasCat = !!categorySelect && !!categorySelect.value;
  if (subcategorySelect) {
    subcategorySelect.disabled = !(editing && !writeBusy && hasCat);
    if (!hasCat) subcategorySelect.value = "";
  }
  const hasSub = !!subcategorySelect && !!subcategorySelect.value;
  if (groupSelect) {
    groupSelect.disabled = !(editing && !writeBusy && hasSub);
    if (!hasSub) groupSelect.value = "";
  }
  const hasGroup = !!groupSelect && !!groupSelect.value;
  if (subgroupSelect) {
    subgroupSelect.disabled = !(editing && !writeBusy && hasGroup);
    if (!hasGroup) subgroupSelect.value = "";
  }
}

const CHUNK = 1000;
async function fetchAllProducts() {
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, item")
      .order("item")
      .range(from, from + CHUNK - 1);
    if (error) {
      console.error("fetchAllProducts error:", error);
      break;
    }
    all.push(...data);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

async function loadProducts() {
  allProducts = await fetchAllProducts();
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filtered = allProducts.filter((p) => p.item.toLowerCase().includes(term));
  productList.innerHTML = filtered
    .map(
      (p) =>
        `<li role="option" id="product-${p.id}" data-id="${
          p.id
        }" aria-selected="${p.id === selectedId ? "true" : "false"}"${
          p.id === selectedId ? ' class="selected"' : ""
        }>${p.item}</li>`,
    )
    .join("");
  const lis = Array.from(productList.querySelectorAll("li"));
  if (keyboardIndex >= 0 && keyboardIndex < lis.length) {
    updateKeyboardHighlight(lis, keyboardIndex);
  } else {
    productList.removeAttribute("aria-activedescendant");
  }
  try {
    if (productCountPill) {
      const total = allProducts.length || 0;
      if (!term) {
        productCountPill.textContent = `${total} products`;
        productCountPill.title = `${total} products total`;
        productCountPill.setAttribute("aria-label", `${total} products total`);
      } else {
        productCountPill.textContent = `${filtered.length} / ${total}`;
        productCountPill.title = `${filtered.length} matches of ${total} products`;
        productCountPill.setAttribute(
          "aria-label",
          `${filtered.length} matches of ${total} products`,
        );
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadDetails(id) {
  let loaded = false;
  if (unsaved) {
    const ok = await showModal(
      "You have unsaved changes. Discard?",
      "Discard",
      "Cancel",
    );
    if (!ok) return;
  }

  selectedId = id;
  applyFilter();

  if (!id) {
    form.reset();
    loadedProductSnapshot = null;
    if (isPtoCheckbox) isPtoCheckbox.checked = false;
    if (uomBaseSelect) uomBaseSelect.value = "";
    if (conversionInput) conversionInput.value = "";
    if (isSeasonalCheckbox) isSeasonalCheckbox.checked = false;
    if (seasonProfileSelect) seasonProfileSelect.value = "";
    if (isLltCheckbox) isLltCheckbox.checked = false;
    if (leadTimeInput) leadTimeInput.value = "";
    unsaved = false;
    applyAccessChrome();
    return true;
  }

  showLoading();
  try {
    const { data: prod, error } = await supabase
      .from("products")
      .select(
        "item, malayalam_name, status, sub_group_id, is_pto, uom_base, conversion_to_base, is_seasonal, season_profile_id, is_llt, manufacture_lead_time_months",
      )
      .eq("id", id)
      .single();
    if (error) {
      console.error(error);
      loadedProductSnapshot = null;
      return false;
    }

    itemInput.value = prod.item;
    malInput.value = prod.malayalam_name;
    statusSelect.value = prod.status;
    if (isPtoCheckbox) isPtoCheckbox.checked = !!prod.is_pto;
    if (uomBaseSelect) uomBaseSelect.value = prod.uom_base || "";
    if (conversionInput) conversionInput.value = prod.conversion_to_base ?? "";
    if (isSeasonalCheckbox) isSeasonalCheckbox.checked = !!prod.is_seasonal;
    if (seasonProfileSelect)
      seasonProfileSelect.value = prod.season_profile_id ?? "";
    if (isLltCheckbox) isLltCheckbox.checked = !!prod.is_llt;
    if (leadTimeInput)
      leadTimeInput.value = prod.manufacture_lead_time_months ?? "";

    const { data: sg } = await supabase
      .from("sub_groups")
      .select("product_group_id")
      .eq("id", prod.sub_group_id)
      .single();
    const pgId = sg.product_group_id;
    const { data: pg } = await supabase
      .from("product_groups")
      .select("sub_category_id")
      .eq("id", pgId)
      .single();
    const scId = pg.sub_category_id;
    const { data: sc } = await supabase
      .from("sub_categories")
      .select("category_id")
      .eq("id", scId)
      .single();

    categorySelect.value = sc.category_id;
    await loadSubcats(categorySelect.value);
    subcategorySelect.value = scId;
    await loadGroups(subcategorySelect.value);
    groupSelect.value = pgId;
    await loadSubgroups(groupSelect.value);
    subgroupSelect.value = prod.sub_group_id;

    captureLoadedSnapshot(prod, id);
    unsaved = false;
    loaded = true;
    applyAccessChrome();
  } finally {
    hideLoading();
  }
  return loaded;
}

function buildSaveSummary(fields) {
  const names = [
    categorySelect.selectedOptions[0]?.text || "—",
    subcategorySelect.selectedOptions[0]?.text || "—",
    groupSelect.selectedOptions[0]?.text || "—",
    subgroupSelect.selectedOptions[0]?.text || "—",
  ];
  return [
    `Item: ${fields.p_item}`,
    `Malayalam name: ${fields.p_malayalam_name}`,
    `Status: ${fields.p_status}`,
    `PTO: ${fields.p_is_pto ? "Yes" : "No"}`,
    `UOM Base: ${fields.p_uom_base || "None"}`,
    `Conversion: ${
      fields.p_conversion_to_base !== null ? fields.p_conversion_to_base : "—"
    }`,
    `Seasonal: ${fields.p_is_seasonal ? "Yes" : "No"}`,
    `Season Profile: ${
      fields.p_season_profile_id
        ? seasonProfileSelect?.selectedOptions?.[0]?.text ||
          fields.p_season_profile_id
        : "—"
    }`,
    `LLT: ${fields.p_is_llt ? "Yes" : "No"}`,
    `Lead time (m): ${
      fields.p_manufacture_lead_time_months !== null
        ? fields.p_manufacture_lead_time_months
        : "—"
    }`,
    `Category: ${names[0]}`,
    `Sub-category: ${names[1]}`,
    `Group: ${names[2]}`,
    `Sub-group: ${names[3]}`,
  ].join("\n");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!canWriteModule()) {
    showToast("You do not have permission to save products.");
    return;
  }
  if (writeBusy) return;

  const draft = buildProductRpcPayloadFromForm({
    reason: "__pending__",
    approvalReference: null,
  });

  if (!selectedId) {
    const dup = allProducts.find(
      (p) => p.item.toLowerCase() === draft.p_item.toLowerCase(),
    );
    if (dup) {
      const edit = await showModal(
        `Product "${draft.p_item}" exists. Edit instead?`,
        "Yes",
        "Cancel",
      );
      if (edit) {
        unsaved = false;
        inNewMode = false;
        return loadDetails(dup.id);
      }
      form.reset();
      unsaved = false;
      applyAccessChrome();
      return;
    }
  }

  if (
    !draft.p_item ||
    !draft.p_malayalam_name ||
    !draft.p_status ||
    !draft.p_sub_group_id
  ) {
    return showModal("Please fill in all fields.", "OK", "");
  }

  if (
    draft.p_uom_base &&
    (draft.p_conversion_to_base === null ||
      Number.isNaN(draft.p_conversion_to_base) ||
      draft.p_conversion_to_base <= 0)
  ) {
    return showModal(
      "Please provide a positive Conversion To Base when UOM Base is set.",
      "OK",
      "",
    );
  }
  if (draft.p_is_seasonal && !draft.p_season_profile_id) {
    return showModal(
      "Please select a Season Profile when 'Seasonal' is checked.",
      "OK",
      "",
    );
  }
  if (
    draft.p_is_llt &&
    (draft.p_manufacture_lead_time_months === null ||
      Number.isNaN(draft.p_manufacture_lead_time_months) ||
      draft.p_manufacture_lead_time_months < 0)
  ) {
    return showModal(
      "Please provide a non-negative manufacture lead time in months.",
      "OK",
      "",
    );
  }

  const isCreate = !selectedId;
  const summary = buildSaveSummary(draft);
  const governance = await promptGovernance({
    title: isCreate ? "Create product" : "Update product",
    message: `${isCreate ? "Create" : "Update"} this product?\n\n${summary}`,
    confirmLabel: isCreate ? "Create" : "Save",
    danger: false,
  });
  if (!governance) return;

  const payload = buildProductRpcPayloadFromForm(governance);
  setWriteBusy(true);
  showLoading();
  try {
    if (isCreate) {
      const { data, error } = await supabase.rpc("rpc_create_product", payload);
      if (error) {
        surfaceRpcError(error, "Failed to create product.");
        return;
      }
      let row;
      try {
        row = normalizeRpcRow(data, "Create product");
        selectedId = requireProductId(row, "Create product");
      } catch (normErr) {
        surfaceRpcError(normErr, "Failed to create product.");
        return;
      }
      showToast("Product created successfully.");
      searchInput.value = "";
      await loadProducts();
      unsaved = false;
      inNewMode = false;
      previousSelectedId = null;
      await loadDetails(selectedId);
      setEditing(false);
    } else {
      const updatePayload = {
        p_product_id: Number(selectedId),
        ...payload,
      };
      const { data, error } = await supabase.rpc(
        "rpc_update_product",
        updatePayload,
      );
      if (error) {
        surfaceRpcError(error, "Failed to update product.");
        return;
      }
      try {
        normalizeRpcRow(data, "Update product");
      } catch (normErr) {
        surfaceRpcError(normErr, "Failed to update product.");
        return;
      }
      showToast("Product updated successfully.");
      searchInput.value = "";
      await loadProducts();
      unsaved = false;
      await loadDetails(selectedId);
      setEditing(false);
    }
  } catch (err) {
    surfaceRpcError(err, "Unexpected error while saving the product.");
  } finally {
    hideLoading();
    setWriteBusy(false);
  }
});

if (saveIconBtn) {
  saveIconBtn.addEventListener("click", () => {
    if (!canWriteModule()) {
      showToast("You do not have permission to save products.");
      return;
    }
    if (writeBusy) return;
    try {
      form.requestSubmit();
    } catch {
      const ev = new Event("submit", { cancelable: true });
      form.dispatchEvent(ev);
    }
  });
}

if (cancelIconBtn) {
  cancelIconBtn.addEventListener("click", async () => {
    if (writeBusy) return;
    if (!selectedId) {
      if (inNewMode) {
        const ok = await showModal("Discard new product?", "Discard", "Cancel");
        if (!ok) return;
        inNewMode = false;
        unsaved = false;
        const prev = previousSelectedId;
        previousSelectedId = null;
        if (prev) {
          await loadDetails(prev);
        } else {
          form.reset();
          loadedProductSnapshot = null;
        }
        setEditing(false);
        return;
      }
      form.reset();
      unsaved = false;
      applyAccessChrome();
      return;
    }
    const ok = await showModal("Discard changes?", "Discard", "Cancel");
    if (!ok) return;
    unsaved = false;
    await loadDetails(selectedId);
    setEditing(false);
  });
}

if (newInlineBtn) {
  newInlineBtn.addEventListener("click", async () => {
    if (!canWriteModule()) {
      showToast("You do not have permission to create products.");
      return;
    }
    if (writeBusy) return;
    if (unsaved) {
      const ok = await showModal(
        "You have unsaved changes. Discard and create a new product?",
        "Discard",
        "Cancel",
      );
      if (!ok) return;
    }
    previousSelectedId = selectedId;
    selectedId = null;
    loadedProductSnapshot = null;
    inNewMode = true;
    form.reset();
    if (isPtoCheckbox) isPtoCheckbox.checked = false;
    if (uomBaseSelect) uomBaseSelect.value = "";
    if (conversionInput) conversionInput.value = "";
    if (isSeasonalCheckbox) isSeasonalCheckbox.checked = false;
    if (seasonProfileSelect) seasonProfileSelect.value = "";
    if (isLltCheckbox) isLltCheckbox.checked = false;
    if (leadTimeInput) leadTimeInput.value = "";
    unsaved = false;
    setEditing(true);
    if (itemInput) itemInput.focus();
  });
}

if (inlineDeleteBtn) {
  inlineDeleteBtn.addEventListener("click", async () => {
    if (!canWriteModule()) {
      showToast("You do not have permission to deactivate products.");
      return;
    }
    if (writeBusy) return;
    if (!selectedId) return;

    if (unsaved) {
      await showModal(
        "Save or cancel your edits before deactivating this product.",
        "OK",
        "",
      );
      return;
    }

    if (!loadedProductSnapshot || Number(loadedProductSnapshot.product_id) !== Number(selectedId)) {
      showToast("Product details are not fully loaded. Reopen the product and try again.");
      return;
    }

    if (String(loadedProductSnapshot.status) === "Inactive") {
      showToast("This product is already inactive.");
      return;
    }

    const governance = await promptGovernance({
      title: "Deactivate product",
      message: `Deactivate "${loadedProductSnapshot.item}"?\n\nStatus will become Inactive. The product record is retained.`,
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!governance) return;

    const payload = buildProductRpcPayloadFromSnapshot(loadedProductSnapshot, {
      ...governance,
      statusOverride: "Inactive",
    });

    setWriteBusy(true);
    showLoading();
    try {
      const { data, error } = await supabase.rpc("rpc_update_product", payload);
      if (error) {
        surfaceRpcError(error, "Failed to deactivate product.");
        return;
      }
      try {
        normalizeRpcRow(data, "Deactivate product");
      } catch (normErr) {
        surfaceRpcError(normErr, "Failed to deactivate product.");
        return;
      }
      showToast("Product deactivated successfully.");
      await loadProducts();
      unsaved = false;
      await loadDetails(selectedId);
      setEditing(false);
    } catch (err) {
      surfaceRpcError(err, "Unexpected error while deactivating the product.");
    } finally {
      hideLoading();
      setWriteBusy(false);
    }
  });
}

productList.addEventListener("click", async (e) => {
  const li = e.target.closest("li");
  if (li) {
    const id = Number(li.dataset.id);
    const ok = await loadDetails(id);
    if (ok) {
      inNewMode = false;
      previousSelectedId = null;
      setEditing(false);
      keyboardIndex = -1;
      Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
        n.classList.remove("focused"),
      );
      if (productList)
        productList.setAttribute("aria-activedescendant", `product-${id}`);
    }
  }
});

searchInput.addEventListener("input", () => {
  keyboardIndex = -1;
  if (productList) {
    Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
      n.classList.remove("focused"),
    );
    productList.removeAttribute("aria-activedescendant");
  }
  try {
    if (clearSearchBtn) {
      if (searchInput.value && searchInput.value.trim()) {
        clearSearchBtn.classList.add("visible");
        clearSearchBtn.setAttribute("aria-hidden", "false");
      } else {
        clearSearchBtn.classList.remove("visible");
        clearSearchBtn.setAttribute("aria-hidden", "true");
      }
    }
  } catch (e) {
    console.error(e);
  }
  applyFilter();
});

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      searchInput.value = "";
      clearSearchBtn.classList.remove("visible");
      clearSearchBtn.setAttribute("aria-hidden", "true");
      keyboardIndex = -1;
      if (productList) {
        Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
          n.classList.remove("focused"),
        );
        productList.removeAttribute("aria-activedescendant");
      }
      applyFilter();
      searchInput.focus();
    } catch (err) {
      console.error(err);
    }
  });
}

searchInput.addEventListener("keydown", (e) => {
  if (!productList) return;
  const lis = Array.from(productList.querySelectorAll("li"));
  if (!lis.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (keyboardIndex < 0) keyboardIndex = 0;
    else keyboardIndex = Math.min(keyboardIndex + 1, lis.length - 1);
    updateKeyboardHighlight(lis, keyboardIndex);
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (keyboardIndex < 0) keyboardIndex = lis.length - 1;
    else keyboardIndex = Math.max(keyboardIndex - 1, 0);
    updateKeyboardHighlight(lis, keyboardIndex);
    return;
  }
  if (e.key === "Enter") {
    if (keyboardIndex >= 0 && keyboardIndex < lis.length) {
      e.preventDefault();
      const id = Number(lis[keyboardIndex].dataset.id);
      loadDetails(id).then((ok) => {
        if (ok) setEditing(false);
      });
    }
  }
  if (e.key === "Escape") {
    keyboardIndex = -1;
    Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
      n.classList.remove("focused"),
    );
  }
});

function updateKeyboardHighlight(lis, idx) {
  lis.forEach((li) => {
    li.classList.remove("focused");
    if (Number(li.dataset.id) !== selectedId)
      li.setAttribute("aria-selected", "false");
  });
  if (idx >= 0 && idx < lis.length) {
    const node = lis[idx];
    node.classList.add("focused");
    node.setAttribute("aria-selected", "true");
    if (productList) productList.setAttribute("aria-activedescendant", node.id);
    node.scrollIntoView({ block: "nearest", behavior: "auto" });
  } else if (productList) {
    productList.removeAttribute("aria-activedescendant");
  }
}

[
  itemInput,
  malInput,
  statusSelect,
  categorySelect,
  subcategorySelect,
  groupSelect,
  subgroupSelect,
  isPtoCheckbox,
  uomBaseSelect,
  conversionInput,
  isSeasonalCheckbox,
  seasonProfileSelect,
  isLltCheckbox,
  leadTimeInput,
].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => {
    unsaved = true;
    updateDirtyIcons();
  });
  el.addEventListener("change", () => {
    unsaved = true;
    updateDirtyIcons();
  });
});

if (uomBaseSelect)
  uomBaseSelect.addEventListener("change", () => {
    if (conversionInput)
      conversionInput.disabled = !(editing && uomBaseSelect.value);
    unsaved = true;
    updateDirtyIcons();
  });
if (isSeasonalCheckbox)
  isSeasonalCheckbox.addEventListener("input", () => {
    if (seasonProfileSelect)
      seasonProfileSelect.disabled = !(
        editing && isSeasonalCheckbox.checked
      );
    unsaved = true;
    updateDirtyIcons();
  });
if (isLltCheckbox)
  isLltCheckbox.addEventListener("input", () => {
    if (leadTimeInput)
      leadTimeInput.disabled = !(editing && isLltCheckbox.checked);
    unsaved = true;
    updateDirtyIcons();
  });

async function loadSeasonProfiles() {
  if (!seasonProfileSelect) return;
  seasonProfileSelect.innerHTML =
    '<option value="">-- Select profile --</option>';
  const { data, error } = await supabase
    .from("season_profile")
    .select("id, label, entity_kind")
    .eq("entity_kind", "product")
    .order("label");
  if (error) return console.error(error);
  data.forEach((p) => {
    const text = p.entity_kind ? `${p.label} (${p.entity_kind})` : p.label;
    seasonProfileSelect.add(new Option(text, p.id));
  });
}

mountModuleHome(homeBtn);
homeBtn.addEventListener("click", async () => {
  if (
    unsaved &&
    !(await showModal("You have unsaved changes. Leave anyway?", "Yes", "No"))
  )
    return;
  window.location.href = "index.html";
});

window.addEventListener("DOMContentLoaded", async () => {
  const boot = await bootstrapApp({ loginPage: "login.html" });
  if (!boot.ok) return;

  try {
    await loadProductMasterAccess();
  } catch (err) {
    console.error(err);
    setAccessDenied("Unable to verify Product Master access.");
    return;
  }

  if (!canAccessModule()) {
    setAccessDenied("You do not have permission to open Product Master.");
    return;
  }

  if (editToggleBtn) {
    editToggleBtn.addEventListener("click", () => {
      if (!canWriteModule()) {
        showToast("You do not have permission to edit products.");
        return;
      }
      if (writeBusy) return;
      const target = !editing;
      setEditing(target);
    });
  }

  await loadClassifications();
  await loadSeasonProfiles();
  await loadProducts();
  await loadDetails(null);

  try {
    if (clearSearchBtn) {
      if (searchInput.value && searchInput.value.trim()) {
        clearSearchBtn.classList.add("visible");
        clearSearchBtn.setAttribute("aria-hidden", "false");
      } else {
        clearSearchBtn.classList.remove("visible");
        clearSearchBtn.setAttribute("aria-hidden", "true");
      }
    }
  } catch (e) {
    console.error(e);
  }

  setEditing(false);
  applyAccessChrome();
});
