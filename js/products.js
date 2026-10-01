// js/products.js — Gate 5.11V governed Product Master writers
import { supabase } from "../public/shared/js/supabaseClient.js";
import { bootstrapApp } from "../public/shared/js/appBootstrap.js";
import {
  mountModuleHome,
  enhanceSearchableSelect,
  syncSearchableSelect,
  setSearchableSelectValue,
} from "../public/shared/js/sasv-module-chrome.js";

const MODULE_TARGET = "module:manage-products";

// DOM refs
const homeBtn = document.getElementById("homeBtn");
const productPicker = document.getElementById("productPicker");
const tabProductMaster = document.getElementById("tabProductMaster");
const tabSkus = document.getElementById("tabSkus");
const tabReadiness = document.getElementById("tabReadiness");
const productMasterPanel = document.getElementById("productMasterPanel");
const readinessPanel = document.getElementById("readinessPanel");
const readinessDetailSurface = document.getElementById("readinessDetailSurface");
const readinessDetailClose = document.getElementById("readinessDetailClose");
const skuEditorTitle = document.getElementById("skuEditorTitle");
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
const productContextName = document.getElementById("productContextName");
const productContextMalayalam = document.getElementById("productContextMalayalam");
const productContextStatus = document.getElementById("productContextStatus");
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
let skuDirty = false;
let editing = false;
let previousSelectedId = null;
let inNewMode = false;
let activeTab = "master";
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
  syncSkuAccessChrome();
  syncProductContext();
}

function syncProductContext() {
  if (!productContextName) return;
  const name = itemInput ? itemInput.value.trim() : "";
  const malayalam = malInput ? malInput.value.trim() : "";
  const status = statusSelect ? statusSelect.value : "";
  if (!selectedId && !inNewMode) {
    productContextName.textContent = "Select a product";
  } else if (inNewMode && !name) {
    productContextName.textContent = "New product";
  } else {
    productContextName.textContent = name || "Product";
  }
  if (productContextMalayalam) {
    productContextMalayalam.hidden = !malayalam;
    productContextMalayalam.textContent = malayalam;
  }
  if (productContextStatus) {
    const known = status === "Active" || status === "Inactive";
    productContextStatus.hidden = !known;
    productContextStatus.textContent = known ? status : "";
    productContextStatus.className =
      status === "Active" ? "badge badge-active" : "badge badge-inactive";
  }
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
  filtered = allProducts.slice();
  renderProductOptions();
}

function renderProductOptions() {
  if (!productPicker) return;
  const keep = selectedId ? String(selectedId) : "";
  productPicker.replaceChildren();
  productPicker.add(new Option("Select a product", ""));
  allProducts.forEach((product) => {
    productPicker.add(new Option(product.item, String(product.id)));
  });
  if (!productPicker._sasvSearch) {
    enhanceSearchableSelect(productPicker, {
      placeholder: "Search products",
      allowEmptyOption: true,
      debounceMs: 220,
      clearSelectedOnBackspace: true,
      resultCap: 40,
    });
  } else {
    syncSearchableSelect(productPicker);
  }
  setSearchableSelectValue(productPicker, keep, true);
  if (productCountPill) {
    const total = allProducts.length || 0;
    productCountPill.textContent = `${total} products`;
    productCountPill.title = `${total} products total`;
    productCountPill.setAttribute("aria-label", `${total} products total`);
  }
}

function applyFilter() {
  setSearchableSelectValue(productPicker, selectedId ? String(selectedId) : "", true);
}

function paintWorkspaceTabs() {
  const savedProduct = !!selectedId && !inNewMode;
  if (!savedProduct && activeTab !== "master") activeTab = "master";
  if (tabSkus) tabSkus.disabled = !savedProduct;
  if (tabReadiness) tabReadiness.disabled = !savedProduct;
  const tabs = [
    ["master", tabProductMaster, productMasterPanel],
    ["skus", tabSkus, skuLifecycleSection],
    ["readiness", tabReadiness, readinessPanel],
  ];
  tabs.forEach(([name, tab, panel]) => {
    const on = activeTab === name;
    if (tab) tab.setAttribute("aria-selected", on ? "true" : "false");
    if (panel) panel.hidden = !on;
  });
}

function setWorkspaceTab(tab) {
  if ((tab === "skus" || tab === "readiness") && (!selectedId || inNewMode)) return;
  activeTab = tab;
  paintWorkspaceTabs();
}

async function loadDetails(id) {
  let loaded = false;
  if (unsaved || skuDirty) {
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
    clearSkuState();
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
    await loadChildSkus(id);
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
    if (unsaved || skuDirty) {
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
    clearSkuState();
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

    if (unsaved || skuDirty) {
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

if (productPicker) {
  productPicker.addEventListener("change", async () => {
    const next = productPicker.value ? Number(productPicker.value) : null;
    if (!next && !selectedId && inNewMode) return;
    if (next && String(next) === String(selectedId) && !inNewMode) return;
    const ok = await loadDetails(next);
    if (!ok) {
      setSearchableSelectValue(productPicker, selectedId ? String(selectedId) : "", true);
      return;
    }
    inNewMode = false;
    previousSelectedId = null;
    setEditing(false);
  });
}

function bindWorkspaceTab(button, tab) {
  if (!button) return;
  button.addEventListener("click", () => setWorkspaceTab(tab));
}
bindWorkspaceTab(tabProductMaster, "master");
bindWorkspaceTab(tabSkus, "skus");
bindWorkspaceTab(tabReadiness, "readiness");

const workspaceTabs = document.querySelector(".mp-tabs");
if (workspaceTabs) {
  workspaceTabs.addEventListener("keydown", (event) => {
    const order = [tabProductMaster, tabSkus, tabReadiness].filter((tab) => tab && !tab.disabled);
    const index = order.indexOf(document.activeElement);
    if (index < 0) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight"
      ? order[(index + 1) % order.length]
      : order[(index - 1 + order.length) % order.length];
    next.focus();
    next.click();
  });
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
    syncProductContext();
  });
  el.addEventListener("change", () => {
    unsaved = true;
    updateDirtyIcons();
    syncProductContext();
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

const skuLifecycleSection = document.getElementById("skuLifecycleSection");
const skuCountSummary = document.getElementById("skuCountSummary");
const skuPeriodLabel = document.getElementById("skuPeriodLabel");
const skuRegisterBody = document.getElementById("skuRegisterBody");
const skuCardList = document.getElementById("skuCardList");
const readinessRegisterBody = document.getElementById("readinessRegisterBody");
const readinessCardList = document.getElementById("readinessCardList");
const skuDetail = document.getElementById("skuDetail");
const skuAddBtn = document.getElementById("skuAddBtn");
const skuPackSize = document.getElementById("skuPackSize");
const skuUom = document.getElementById("skuUom");
const skuIsSample = document.getElementById("skuIsSample");
const skuSaveBtn = document.getElementById("skuSaveBtn");
const skuCreateBtn = document.getElementById("skuCreateBtn");
const skuCancelBtn = document.getElementById("skuCancelBtn");
const skuToggleActiveBtn = document.getElementById("skuToggleActiveBtn");
const skuReadiness = document.getElementById("skuReadiness");

let skuRows = [];
let selectedSkuId = null;
let skuDraft = null;
let governedPeriodStart = null;
const skuReadinessById = new Map();

function clearSkuState() {
  skuRows = [];
  selectedSkuId = null;
  skuDraft = null;
  skuDirty = false;
  governedPeriodStart = null;
  skuReadinessById.clear();
  if (skuRegisterBody) skuRegisterBody.replaceChildren();
  if (skuCardList) skuCardList.replaceChildren();
  if (readinessRegisterBody) readinessRegisterBody.replaceChildren();
  if (readinessCardList) readinessCardList.replaceChildren();
  if (skuDetail) skuDetail.hidden = true;
  if (readinessDetailSurface) readinessDetailSurface.hidden = true;
  if (skuReadiness) skuReadiness.textContent = "Readiness unavailable";
  renderSkuSummary();
  syncSkuAccessChrome();
}

function syncSkuAccessChrome() {
  const show = !!selectedId && !inNewMode;
  const canEdit = canWriteModule();
  if (skuAddBtn) skuAddBtn.hidden = !show || !canEdit;
  const drafting = skuDraft === "new" || !!selectedSkuId;
  if (skuPackSize) skuPackSize.disabled = !canEdit || writeBusy || !drafting;
  if (skuUom) skuUom.disabled = !canEdit || writeBusy || !drafting;
  if (skuIsSample) skuIsSample.disabled = !canEdit || writeBusy || !drafting;
  if (skuCreateBtn) skuCreateBtn.hidden = !(show && canEdit && skuDraft === "new");
  if (skuSaveBtn) skuSaveBtn.hidden = !(show && canEdit && selectedSkuId && skuDirty);
  if (skuCancelBtn) skuCancelBtn.hidden = !(show && canEdit && (skuDraft === "new" || skuDirty));
  if (skuToggleActiveBtn) {
    const row = currentSkuRow();
    skuToggleActiveBtn.hidden = !(show && canEdit && row && skuDraft !== "new");
    skuToggleActiveBtn.textContent = row && row.is_active ? "Deactivate" : "Activate";
    skuToggleActiveBtn.classList.toggle("danger", !!(row && row.is_active));
    skuToggleActiveBtn.disabled = writeBusy;
  }
  paintWorkspaceTabs();
}

function currentSkuRow() {
  return skuRows.find((row) => String(row.id) === String(selectedSkuId)) || null;
}

function renderSkuSummary() {
  const total = skuRows.length;
  const active = skuRows.filter((row) => row.is_active).length;
  if (skuCountSummary) skuCountSummary.textContent = `${active} active / ${total} total`;
  if (skuPeriodLabel) {
    skuPeriodLabel.textContent = governedPeriodStart
      ? `Governed readiness period: ${governedPeriodStart}`
      : "Governed readiness period: unavailable";
  }
}

function readinessBadgeLabel(severity) {
  if (severity === "READY") return "Ready";
  if (severity === "REVIEW_REQUIRED") return "Review required";
  if (severity === "BLOCKER" || severity === "BLOCKED") return "Blocked";
  return "Unavailable";
}

function readinessBadgeClass(severity) {
  if (severity === "READY") return "badge badge-pass";
  if (severity === "REVIEW_REQUIRED") return "badge badge-warn";
  if (severity === "BLOCKER" || severity === "BLOCKED") return "badge badge-fail";
  return "badge badge-neutral";
}

function markSkuDirty() {
  if (!canWriteModule()) return;
  skuDirty = true;
  syncSkuAccessChrome();
}

async function loadGovernedPeriodStart() {
  governedPeriodStart = null;
  const { data, error } = await supabase.rpc(
    "rpc_get_latest_governed_cost_period_start",
  );
  if (error) {
    console.error(error);
    renderSkuSummary();
    return null;
  }
  governedPeriodStart = data || null;
  renderSkuSummary();
  return governedPeriodStart;
}

let skuLoadGeneration = 0;

async function loadChildSkus(productId) {
  const generation = ++skuLoadGeneration;
  skuDirty = false;
  skuDraft = null;
  selectedSkuId = null;
  skuReadinessById.clear();
  const { data, error } = await supabase
    .from("product_skus")
    .select("id, product_id, pack_size, uom, is_sample, is_active")
    .eq("product_id", productId);
  if (generation !== skuLoadGeneration) return;
  if (error) {
    skuRows = [];
    surfaceRpcError(error, "Unable to load SKUs.");
    renderSkuList();
    return;
  }
  skuRows = data || [];
  renderSkuList();
  await loadGovernedPeriodStart();
  if (generation !== skuLoadGeneration) return;
  await loadAllSkuReadiness(generation);
}

async function fetchSkuReadiness(skuId, options = {}) {
  if (!governedPeriodStart || skuId == null) return null;
  const { data, error } = await supabase.rpc("rpc_get_product_sku_readiness", {
    p_sku_id: skuId,
    p_period_start: governedPeriodStart,
    p_context_type: "LIVE_AS_OF",
    p_refresh_run_id: null,
  });
  if (error) {
    console.error(error);
    if (options.surfaceError) surfaceRpcError(error, "Readiness unavailable.");
    return null;
  }
  return data && typeof data === "object" ? data : null;
}

async function loadAllSkuReadiness(generation) {
  if (!governedPeriodStart || skuRows.length === 0) {
    renderSkuList();
    return;
  }
  const rows = skuRows.slice();
  const results = await Promise.all(
    rows.map(async (row) => fetchSkuReadiness(row.id)),
  );
  if (generation !== skuLoadGeneration) return;
  results.forEach((payload, index) => {
    const skuId = String(rows[index].id);
    if (payload) skuReadinessById.set(skuId, payload);
    else skuReadinessById.delete(skuId);
  });
  renderSkuList();
}

function skuPackLabel(row) {
  return `${row?.pack_size ?? "—"} ${row?.uom || ""}`.trim();
}

function serverStatusText(value) {
  return value == null || value === "" ? "Unavailable" : String(value);
}

function readinessDimensionHint(payload) {
  const summary = payload?.summary;
  if (!summary) return "";
  return [
    ["Product master", summary.product_master_foundation_status],
    ["SKU master", summary.sku_master_foundation_status],
    ["Costing", summary.costing_foundation_status],
    ["Evidence", summary.evidence_quality_status],
    ["Outcome", summary.costing_outcome_status],
  ]
    .filter(([, status]) => status === "BLOCKED" || status === "BLOCKER" || status === "REVIEW_REQUIRED")
    .map(([label, status]) => `${label}: ${status}`)
    .join(" · ");
}

function renderSkuList() {
  if (skuRegisterBody) skuRegisterBody.replaceChildren();
  if (skuCardList) skuCardList.replaceChildren();
  if (readinessRegisterBody) readinessRegisterBody.replaceChildren();
  if (readinessCardList) readinessCardList.replaceChildren();
  renderSkuSummary();
  skuRows.forEach((row) => {
    const payload = skuReadinessById.get(String(row.id));
    const summary = payload?.summary || {};
    const severity = summary.overall_severity;
    const selected = String(row.id) === String(selectedSkuId) && skuDraft !== "new";
    const pack = skuPackLabel(row);
    const typeLabel = row.is_sample ? "Sample" : "Standard";
    const lifecycle = document.createElement("span");
    lifecycle.className = row.is_active ? "badge badge-active" : "badge badge-inactive";
    lifecycle.textContent = row.is_active ? "Active" : "Inactive";
    const readiness = document.createElement("span");
    readiness.className = readinessBadgeClass(severity);
    readiness.textContent = readinessBadgeLabel(severity);

    const tr = document.createElement("tr");
    tr.setAttribute("aria-selected", selected ? "true" : "false");
    ["SKU " + row.id, pack, typeLabel].forEach((text) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      tr.appendChild(cell);
    });
    const lifeCell = document.createElement("td");
    lifeCell.appendChild(lifecycle);
    const readyCell = document.createElement("td");
    readyCell.appendChild(readiness);
    const actionCell = document.createElement("td");
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn secondary";
    openBtn.textContent = "Open";
    openBtn.setAttribute("aria-label", `Open SKU ${row.id}`);
    openBtn.addEventListener("click", () => selectSku(row.id));
    actionCell.appendChild(openBtn);
    tr.append(lifeCell, readyCell, actionCell);
    if (skuRegisterBody) skuRegisterBody.appendChild(tr);

    const card = document.createElement("article");
    card.className = "mp-sku-card";
    const line = document.createElement("div");
    line.className = "mp-sku-card-line";
    const skuName = document.createElement("span");
    skuName.textContent = `SKU ${row.id}`;
    const packName = document.createElement("span");
    packName.textContent = pack;
    line.append(skuName, packName);
    const meta = document.createElement("div");
    meta.className = "mp-sku-card-meta";
    meta.textContent = typeLabel;
    const statusRow = document.createElement("div");
    statusRow.className = "mp-sku-card-status";
    statusRow.append(lifecycle.cloneNode(true), readiness.cloneNode(true), openBtn.cloneNode(true));
    statusRow.lastChild.addEventListener("click", () => selectSku(row.id));
    card.append(line, meta, statusRow);
    if (skuCardList) skuCardList.appendChild(card);

    const readinessRow = document.createElement("tr");
    readinessRow.setAttribute("aria-selected", selected ? "true" : "false");
    [row.id, pack].forEach((text) => {
      const cell = document.createElement("td");
      cell.textContent = String(text);
      readinessRow.appendChild(cell);
    });
    const lifeCopy = document.createElement("td");
    lifeCopy.appendChild(lifecycle.cloneNode(true));
    readinessRow.appendChild(lifeCopy);
    [
      summary.product_master_foundation_status,
      summary.sku_master_foundation_status,
      summary.costing_foundation_status,
      summary.evidence_quality_status,
      summary.costing_outcome_status,
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.className = "mp-col-extra";
      cell.textContent = serverStatusText(value);
      readinessRow.appendChild(cell);
    });
    const overallCell = document.createElement("td");
    overallCell.appendChild(readiness.cloneNode(true));
    const detailCell = document.createElement("td");
    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "btn secondary";
    detailBtn.textContent = "Details";
    detailBtn.setAttribute("aria-label", `Readiness for SKU ${row.id}`);
    detailBtn.addEventListener("click", () => openReadinessDetail(row.id));
    detailCell.appendChild(detailBtn);
    readinessRow.append(overallCell, detailCell);
    if (readinessRegisterBody) readinessRegisterBody.appendChild(readinessRow);

    const readyCard = document.createElement("article");
    readyCard.className = "mp-sku-card";
    const readyLine = document.createElement("div");
    readyLine.className = "mp-sku-card-line";
    const readySku = document.createElement("span");
    readySku.textContent = `SKU ${row.id}`;
    const readyPack = document.createElement("span");
    readyPack.textContent = pack;
    readyLine.append(readySku, readyPack);
    const readyStatus = document.createElement("div");
    readyStatus.className = "mp-sku-card-status";
    readyStatus.append(lifecycle.cloneNode(true), readiness.cloneNode(true));
    readyCard.append(readyLine, readyStatus);
    const hint = readinessDimensionHint(payload);
    if (hint) {
      const hintLine = document.createElement("div");
      hintLine.className = "mp-sku-card-meta";
      hintLine.textContent = hint;
      readyCard.appendChild(hintLine);
    }
    const readyAction = detailBtn.cloneNode(true);
    readyAction.addEventListener("click", () => openReadinessDetail(row.id));
    readyCard.appendChild(readyAction);
    if (readinessCardList) readinessCardList.appendChild(readyCard);
  });
  syncSkuAccessChrome();
}

async function confirmDiscardSku() {
  if (!skuDirty) return true;
  return showModal("You have unsaved SKU changes. Discard?", "Discard", "Cancel");
}

function fillSkuMasterFields(row) {
  if (skuPackSize) skuPackSize.value = row?.pack_size ?? "";
  if (skuUom) skuUom.value = row?.uom || "";
  if (skuIsSample) skuIsSample.checked = !!row?.is_sample;
  if (skuEditorTitle) skuEditorTitle.textContent = row?.id ? `SKU ${row.id}` : "New SKU";
}

async function selectSku(skuId) {
  if (String(skuId) === String(selectedSkuId) && skuDraft !== "new") {
    if (readinessDetailSurface) readinessDetailSurface.hidden = true;
    if (skuDetail) skuDetail.hidden = false;
    return;
  }
  if (!(await confirmDiscardSku())) return;
  skuDraft = String(skuId);
  selectedSkuId = skuId;
  skuDirty = false;
  fillSkuMasterFields(currentSkuRow());
  if (readinessDetailSurface) readinessDetailSurface.hidden = true;
  if (skuDetail) skuDetail.hidden = false;
  setWorkspaceTab("skus");
  renderSkuList();
}

function beginNewSku() {
  skuDraft = "new";
  selectedSkuId = null;
  skuDirty = false;
  fillSkuMasterFields(null);
  if (readinessDetailSurface) readinessDetailSurface.hidden = true;
  if (skuDetail) skuDetail.hidden = false;
  if (skuReadiness) skuReadiness.textContent = "Readiness unavailable";
  setWorkspaceTab("skus");
  renderSkuList();
}

async function openReadinessDetail(skuId) {
  if (!(String(skuId) === String(selectedSkuId) && skuDraft !== "new")) {
    if (!(await confirmDiscardSku())) return;
    skuDraft = String(skuId);
    selectedSkuId = skuId;
    skuDirty = false;
    fillSkuMasterFields(currentSkuRow());
  }
  if (skuDetail) skuDetail.hidden = true;
  if (readinessDetailSurface) readinessDetailSurface.hidden = false;
  setWorkspaceTab("readiness");
  renderSkuList();
  await showSelectedSkuReadiness();
}

async function showSelectedSkuReadiness() {
  if (!skuReadiness) return;
  const row = currentSkuRow();
  if (!row || !governedPeriodStart) {
    skuReadiness.textContent = "Readiness unavailable";
    return;
  }
  const cached = skuReadinessById.get(String(row.id));
  if (cached) {
    renderSkuReadiness(cached);
    return;
  }
  skuReadiness.textContent = "Loading readiness…";
  const payload = await fetchSkuReadiness(row.id, { surfaceError: true });
  if (!payload) {
    skuReadinessById.delete(String(row.id));
    skuReadiness.textContent = "Readiness unavailable";
    renderSkuList();
    if (skuDetail) skuDetail.hidden = false;
    return;
  }
  skuReadinessById.set(String(row.id), payload);
  renderSkuReadiness(payload);
  renderSkuList();
  if (skuDetail) skuDetail.hidden = false;
}

function appendDefinition(list, label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value == null || value === "" ? "Unavailable" : String(value);
  list.append(term, detail);
}

function appendRemediation(parent, title, detail) {
  const item = document.createElement("p");
  item.className = "mp-remediation-item";
  const strong = document.createElement("strong");
  strong.textContent = title;
  item.append(strong, document.createTextNode(` — ${detail}`));
  parent.appendChild(item);
}

function renderSkuReadiness(payload) {
  if (!skuReadiness) return;
  skuReadiness.innerHTML = "";
  const summary = payload.summary || {};
  const lifecycle =
    payload.lifecycle && typeof payload.lifecycle === "object" ? payload.lifecycle : {};
  const severity = summary.overall_severity;
  const grid = document.createElement("dl");
  grid.className = "mp-readiness-grid";
  appendDefinition(grid, "Product lifecycle", lifecycle.product_status || "Unavailable");
  appendDefinition(
    grid,
    "SKU lifecycle",
    lifecycle.sku_is_active === true
      ? "Active"
      : lifecycle.sku_is_active === false
        ? "Inactive"
        : "Unavailable",
  );
  appendDefinition(
    grid,
    "Sample",
    lifecycle.sku_is_sample === true
      ? "Yes"
      : lifecycle.sku_is_sample === false
        ? "No"
        : "Unavailable",
  );
  appendDefinition(grid, "Product master foundation", summary.product_master_foundation_status);
  appendDefinition(grid, "SKU master foundation", summary.sku_master_foundation_status);
  appendDefinition(grid, "Costing foundation", summary.costing_foundation_status);
  appendDefinition(grid, "Evidence quality", summary.evidence_quality_status);
  appendDefinition(grid, "Costing outcome", summary.costing_outcome_status);
  const severityTerm = document.createElement("dt");
  severityTerm.textContent = "Overall severity";
  const severityValue = document.createElement("dd");
  const badge = document.createElement("span");
  badge.className = readinessBadgeClass(severity);
  badge.textContent = readinessBadgeLabel(severity);
  severityValue.appendChild(badge);
  grid.append(severityTerm, severityValue);
  skuReadiness.appendChild(grid);

  const control = payload.downstream_control || {};
  const controlGrid = document.createElement("dl");
  controlGrid.className = "mp-readiness-grid mp-readiness-control";
  if (control.control_note) appendDefinition(controlGrid, "Control note", control.control_note);
  if (control.control_severity) {
    appendDefinition(controlGrid, "Control severity", control.control_severity);
  }
  if (control.cost_sheet_status) {
    appendDefinition(controlGrid, "Cost sheet", control.cost_sheet_status);
  }
  if (control.first_control_status) {
    appendDefinition(controlGrid, "First control", control.first_control_status);
  }
  if (control.recommended_ui_route) {
    appendDefinition(controlGrid, "Recommended route", control.recommended_ui_route);
  }
  if (controlGrid.childElementCount) skuReadiness.appendChild(controlGrid);

  const remediation = document.createElement("div");
  remediation.className = "mp-remediation";
  const dependencies = Array.isArray(payload.dependencies) ? payload.dependencies : [];
  dependencies.forEach((issue) => {
    const status = issue.effective_status || issue.raw_status || "Unavailable";
    if (
      status === "READY" ||
      status === "RESOLVED" ||
      status === "NOT_REQUIRED" ||
      issue.applicability === "NOT_REQUIRED"
    ) {
      return;
    }
    appendRemediation(
      remediation,
      issue.label || "Dependency",
      [status, issue.reason_code, issue.note, issue.recommended_ui_route]
        .filter(Boolean)
        .join(" — "),
    );
  });
  const sharedIssues = Array.isArray(payload.shared_issues) ? payload.shared_issues : [];
  sharedIssues.forEach((issue) => {
    const title = issue.issue_code || issue.dependency_code || "Shared issue";
    appendRemediation(
      remediation,
      title,
      [
        issue.issue_code && issue.dependency_code && issue.dependency_code !== issue.issue_code
          ? issue.dependency_code
          : "",
        issue.status,
        issue.reason_code,
        issue.scope,
        issue.owner_module,
        issue.recommended_ui_route,
      ]
        .filter(Boolean)
        .join(" — "),
    );
  });
  if (remediation.childElementCount) {
    const heading = document.createElement("h4");
    heading.className = "mp-group-title";
    heading.textContent = "Remediation";
    remediation.prepend(heading);
    skuReadiness.appendChild(remediation);
  }
}

function skuFormValues() {
  return {
    p_pack_size: skuPackSize && skuPackSize.value !== "" ? Number(skuPackSize.value) : null,
    p_uom: skuUom ? skuUom.value : "",
    p_is_sample: !!(skuIsSample && skuIsSample.checked),
  };
}

function skuPackIdentity(packSize, uom, isSample) {
  const pack = `${packSize ?? "—"} ${uom || ""}`.trim();
  return isSample ? `${pack} (sample)` : pack;
}

function selectedProductLabel() {
  return loadedProductSnapshot?.item || itemInput?.value || `Product ${selectedId}`;
}

function skuMasterValidationMessage(values) {
  if (!values.p_uom) return "UOM is required.";
  if (
    values.p_pack_size === null ||
    Number.isNaN(values.p_pack_size) ||
    values.p_pack_size <= 0
  ) {
    return "Pack size must be greater than zero.";
  }
  return "";
}

async function createSku() {
  if (!canWriteModule() || !selectedId || writeBusy) return;
  const values = skuFormValues();
  const invalid = skuMasterValidationMessage(values);
  if (invalid) {
    showToast(invalid);
    return;
  }
  const governance = await promptGovernance({
    title: "Create SKU",
    confirmLabel: "Create SKU",
    danger: false,
    message: `Create an inactive SKU for "${selectedProductLabel()}"?\n\nPack: ${skuPackIdentity(values.p_pack_size, values.p_uom, values.p_is_sample)}\nSample: ${values.p_is_sample ? "Yes" : "No"}\n\nA business reason is required. An approval reference is optional.`,
  });
  if (!governance) return;
  writeBusy = true;
  syncSkuAccessChrome();
  showLoading();
  try {
    const { data, error } = await supabase.rpc("rpc_create_product_sku", {
      p_product_id: selectedId,
      p_pack_size: values.p_pack_size,
      p_uom: values.p_uom,
      p_is_sample: values.p_is_sample,
      p_is_active: false,
      p_reason: governance.reason,
      p_approval_reference: governance.approvalReference || null,
    });
    if (error) {
      surfaceRpcError(error, "Unable to create SKU.");
      return;
    }
    const created = Array.isArray(data) ? data[0] : data;
    const createdSkuId = created && created.sku_id;
    skuDirty = false;
    skuDraft = null;
    await loadChildSkus(selectedId);
    if (createdSkuId != null) await selectSku(createdSkuId);
    showToast("SKU created inactive. Activate it as a separate action when the product is active.", 6000);
  } finally {
    writeBusy = false;
    hideLoading();
    syncSkuAccessChrome();
  }
}

async function saveSkuPack() {
  if (!canWriteModule() || !selectedSkuId || writeBusy || skuDraft === "new") return;
  const values = skuFormValues();
  const invalid = skuMasterValidationMessage(values);
  if (invalid) {
    showToast(invalid);
    return;
  }
  const governance = await promptGovernance({
    title: "Update SKU",
    confirmLabel: "Update SKU",
    danger: false,
    message: `Update SKU ${selectedSkuId}?\n\nPack: ${skuPackIdentity(values.p_pack_size, values.p_uom, values.p_is_sample)}\nSample: ${values.p_is_sample ? "Yes" : "No"}\n\nA business reason is required. An approval reference is optional.`,
  });
  if (!governance) return;
  writeBusy = true;
  syncSkuAccessChrome();
  showLoading();
  try {
    const { error } = await supabase.rpc("rpc_update_product_sku", {
      p_sku_id: selectedSkuId,
      p_pack_size: values.p_pack_size,
      p_uom: values.p_uom,
      p_is_sample: values.p_is_sample,
      p_reason: governance.reason,
      p_approval_reference: governance.approvalReference || null,
    });
    if (error) {
      surfaceRpcError(error, "Unable to save SKU.");
      return;
    }
    const keepId = selectedSkuId;
    skuDirty = false;
    await loadChildSkus(selectedId);
    await selectSku(keepId);
    showToast("SKU master saved.", 4000);
  } finally {
    writeBusy = false;
    hideLoading();
    syncSkuAccessChrome();
  }
}

async function toggleSkuActive() {
  const row = currentSkuRow();
  if (!canWriteModule() || !row || writeBusy || skuDraft === "new") return;
  if (skuDirty) {
    showToast("Save or cancel SKU master edits before changing active state.");
    return;
  }
  const nextActive = !row.is_active;
  const packIdentity = skuPackIdentity(row.pack_size, row.uom, row.is_sample);
  const governance = await promptGovernance({
    title: nextActive ? "Activate SKU" : "Deactivate SKU",
    confirmLabel: nextActive ? "Activate SKU" : "Deactivate SKU",
    danger: !nextActive,
    message: nextActive
      ? `Activate SKU ${row.id} (${packIdentity})?\n\nThis lifecycle target will become Active.\n\nA business reason is required. An approval reference is optional.`
      : `Deactivate SKU ${row.id} (${packIdentity})?\n\nThis lifecycle target will become Inactive.\n\nA business reason is required. An approval reference is optional.`,
  });
  if (!governance) return;
  writeBusy = true;
  syncSkuAccessChrome();
  showLoading();
  try {
    const { error } = await supabase.rpc("rpc_set_product_sku_active", {
      p_sku_id: row.id,
      p_is_active: nextActive,
      p_reason: governance.reason,
      p_approval_reference: governance.approvalReference || null,
    });
    if (error) {
      surfaceRpcError(error, "Unable to change SKU active state.");
      return;
    }
    const keepId = row.id;
    skuDirty = false;
    await loadChildSkus(selectedId);
    await selectSku(keepId);
    showToast(nextActive ? "SKU activated." : "SKU deactivated.", 4000);
  } finally {
    writeBusy = false;
    hideLoading();
    syncSkuAccessChrome();
  }
}

if (skuAddBtn) {
  skuAddBtn.addEventListener("click", async () => {
    if (!canWriteModule()) return;
    if (!(await confirmDiscardSku())) return;
    beginNewSku();
  });
}
if (skuCreateBtn) skuCreateBtn.addEventListener("click", () => createSku());
if (skuSaveBtn) skuSaveBtn.addEventListener("click", () => saveSkuPack());
if (skuCancelBtn) {
  skuCancelBtn.addEventListener("click", async () => {
    if (!(await confirmDiscardSku())) return;
    skuDirty = false;
    if (skuDraft === "new") {
      skuDraft = null;
      if (skuDetail) skuDetail.hidden = true;
      renderSkuList();
      return;
    }
    const row = currentSkuRow();
    if (skuPackSize) skuPackSize.value = row?.pack_size ?? "";
    if (skuUom) skuUom.value = row?.uom || "";
    if (skuIsSample) skuIsSample.checked = !!row?.is_sample;
    syncSkuAccessChrome();
  });
}
if (skuToggleActiveBtn) skuToggleActiveBtn.addEventListener("click", () => toggleSkuActive());
if (readinessDetailClose) {
  readinessDetailClose.addEventListener("click", () => {
    if (readinessDetailSurface) readinessDetailSurface.hidden = true;
  });
}
[skuPackSize, skuUom, skuIsSample].forEach((control) => {
  if (!control) return;
  control.addEventListener("input", markSkuDirty);
  control.addEventListener("change", markSkuDirty);
});

mountModuleHome(homeBtn);
homeBtn.addEventListener("click", async () => {
  if (
    (unsaved || skuDirty) &&
    !(await showModal("You have unsaved changes. Leave anyway?", "Yes", "No"))
  )
    return;
  window.location.href = "index.html";
});

window.addEventListener("beforeunload", (event) => {
  if (!unsaved && !skuDirty) return;
  event.preventDefault();
  event.returnValue = "";
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

  setEditing(false);
  applyAccessChrome();
});
