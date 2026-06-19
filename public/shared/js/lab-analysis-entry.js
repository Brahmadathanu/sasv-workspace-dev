/* lab-analysis-entry.js
 * Lab — Sample Receipt & Analysis Entry
 *
 * BACKEND DEPENDENCIES
 * ─────────────────────────────────────────────────────────────────────────
 * labSupabase views  (schema: lab)
 *   v_sample_receipt_fg_picker      → { product_id, product_name }
 *   v_rm_pm_item_with_group         → { stock_item_id, stock_item_name,
 *                                        inv_group_id, inv_group_label, category_code, … }
 *   v_sample_receipt_staff_picker   → { staff_id, full_name, designation,
 *                                        is_analyst, is_pic }
 *   v_current_user_staff_context    → { user_id, staff_id, full_name, designation }

 *   v_spec_profile_detail           → { spec_profile_id, seq_no, test_name,
 *                                        method_name, display_text,
 *                                        spec_line_is_active }
 *
 * labSupabase tables  (schema: lab)
 *   protocol_category_inv_group_map → { inv_group_id, protocol_category_id,
 *                                        is_active }  (RM readiness)
 *   protocol_category               → { id, category_code, category_name,
 *                                        subject_type }
 *   spec_profile_inv_group_map      → { inv_group_id, spec_profile_id,
 *                                        is_active }  (RM readiness)
 *
 * labSupabase RPC  (schema: lab)
 *   fn_get_active_protocol_category_id_for_pm_subcategory(
 *     p_subcategory_id             -- integer
 *   )
 *   Returns: protocol_category_id (bigint) or null
 *
 *   fn_get_active_spec_profile_id_for_pm_subcategory(
 *     p_subcategory_id,            -- integer
 *     p_as_of_date                 -- date  (ISO string YYYY-MM-DD)
 *   )
 *   Returns: spec_profile_id (bigint) or null
 *
 *   fn_preview_effective_fg_spec_for_product(
 *     p_product_id,                -- bigint
 *     p_as_of_date                 -- date  (ISO string YYYY-MM-DD)
 *   )
 *   Returns: json { ok, message, line_count, lines[] }
 *
 *   fn_preview_effective_rm_spec_for_item(
 *     p_stock_item_id,             -- bigint
 *     p_as_of_date                 -- date  (ISO string YYYY-MM-DD)
 *   )
 *   Returns: json { ok, message, line_count, lines[] }
 *
 *   fn_preview_effective_pm_spec_for_item(
 *     p_stock_item_id,             -- bigint
 *     p_as_of_date                 -- date  (ISO string YYYY-MM-DD)
 *   )
 *   Returns: json { ok, message, line_count, lines[] }
 *
 *   fn_receive_sample_and_create_analysis(
 *     p_user_id,                   -- uuid
 *     p_analysis_subject_type,     -- 'FG_BATCH' | 'RM_LOT' | 'PM_LOT'
 *     p_product_id,                -- uuid | null  (FG only)
 *     p_batch_no_snapshot,         -- text | null  (FG only)
 *     p_stock_item_id,             -- uuid | null  (RM only)
 *     p_system_lot_no,             -- text | null  (RM only)
 *     p_sample_received_date,      -- date  (ISO string YYYY-MM-DD)
 *     p_physical_register_ref,     -- text | null
 *     p_analysed_by_staff_id,      -- uuid
 *     p_person_in_charge_staff_id, -- uuid
 *     p_remarks                    -- text | null
 *   )
 *   Returns: { analysis_id, analysis_register_no, status }
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NOTE: RM protocol and base-spec are mapped at INVENTORY-GROUP level, not
 * at stock-item level. The old v_protocol_subject_map item-level lookup is
 * only used internally; this file now resolves RM readiness via:
 *   stock_item → inv_group (v_rm_pm_item_with_group)
 *             → protocol   (protocol_category_inv_group_map)
 *             → base spec  (spec_profile_inv_group_map)
 *             → eff. preview (fn_preview_effective_rm_spec_for_item)
 * ─────────────────────────────────────────────────────────────────────────
 */

import { supabase, labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── DOM refs ──────────────────────────────────────────────────────────────────
const statusArea = $("statusArea");
const step1El = $("step1");
const step2El = $("step2");
const step3El = $("step3");
const line1El = $("line1");
const line2El = $("line2");

const typePills = $("typePills");
const receiptDetailsBtn = $("receiptDetailsBtn");
const receiptDetailsSub = $("receiptDetailsSub");
const receiptDetailsStatus = $("receiptDetailsStatus");
const fgFields = $("fgFields");
const rmFields = $("rmFields");
const rmPmDrawerTitle = $("rmPmDrawerTitle");
const rmPmDrawerSub = $("rmPmDrawerSub");
const commonFields = $("commonFields");
const mobileReceiptDrawer = $("mobileReceiptDrawer");
const mobileReceiptDrawerBody = $("mobileReceiptDrawerBody");
const mobileReceiptDrawerTitle = $("mobileReceiptDrawerTitle");
const mobileReceiptDrawerSub = $("mobileReceiptDrawerSub");
const mobileReceiptDrawerClose = $("mobileReceiptDrawerClose");
const mobileReceiptDrawerDone = $("mobileReceiptDrawerDone");
const readinessSection = $("readinessSection");
const formActionsBar = $("formActionsBar");

const productSelect = $("productSelect");
const productSearchInput = $("productSearchInput");
const productSearchList = $("productSearchList");
const batchNoSelect = $("batchNoSelect");
const batchSearchInput = $("batchSearchInput");
const batchSearchList = $("batchSearchList");
const batchSizeDisplay = $("batchSizeDisplay");
const batchUomDisplay = $("batchUomDisplay");
const stockItemSelect = $("stockItemSelect");
const stockItemSearchInput = $("stockItemSearchInput");
const stockItemSearchList = $("stockItemSearchList");
const systemLotNo = $("systemLotNo");
const sampleDate = $("sampleDate");
const physRegRef = $("physRegRef");
const analysedBy = $("analysedBy");
const personInCharge = $("personInCharge");
const remarks = $("remarks");

// Field messages
const productMsg = $("productMsg");
const batchSelectMsg = $("batchSelectMsg");
const stockItemMsg = $("stockItemMsg");
const lotMsg = $("lotMsg");
const dateMsg = $("dateMsg");
const physRegMsg = $("physRegMsg");
const analystMsg = $("analystMsg");
const picMsg = $("picMsg");

// Mapping area
const mappingLoading = $("mappingLoading");
const readinessOk = $("readinessOk");
const readinessMissing = $("readinessMissing");
const protocolInfoDisplay = $("protocolInfoDisplay");
const testPreview = $("testPreview");
const testPreviewToggle = $("testPreviewToggle");
const testPreviewToggleLabel = $("testPreviewToggleLabel");
const testPreviewBody = $("testPreviewBody");
const testPreviewLoading = $("testPreviewLoading");
const testPreviewEmpty = $("testPreviewEmpty");
const testPreviewTbody = $("testPreviewTbody");

// Actions
const startAnalysisBtn = $("startAnalysisBtn");
const startError = $("startError");

// Success panel
const successPanel = $("successPanel");
const successDetails = $("successDetails");
const btnOpenWorkspace = $("btnOpenWorkspace");
const btnOpenQueue = $("btnOpenQueue");
const btnStartAnother = $("btnStartAnother");

// Modals
const switchTypeModal = $("switchTypeModal");
const confirmSwitchTypeBtn = $("confirmSwitchTypeBtn");
const cancelSwitchTypeBtn = $("cancelSwitchTypeBtn");

// Toast
const labToastContainer = $("labToastContainer");

// Home btn
const homeBtn = $("homeBtn");

// ── Module state ──────────────────────────────────────────────────────────────
let currentSampleType = null; // "FG_BATCH" | "RM_LOT" | "PM_LOT"
let createdAnalysis = null; // result from fn_receive_sample_and_create_analysis
let currentUserId = null;
let workflowActionPermissions = new Map();
let receivePermissionVerified = false;
let fgBatchLoadRequestId = 0;
let rmItems = []; // RM items from v_rm_pm_item_with_group (category_code = 'RM')
let pmItems = []; // PM items from v_rm_pm_item_with_group (category_code = 'PLM')
let mappingCheckDebounceTimer = null;
let pendingSwitchType = null; // type pill click queued pending confirmation

const RECEIVE_SAMPLE_ACTION = "RECEIVE_SAMPLE";
const RECEIVE_DENIED_MSG =
  "You do not have permission to receive/register samples.";
const PERMISSION_VERIFY_FAILED_MSG =
  "Could not verify workflow permissions. Actions are disabled for safety.";

// FG readiness: resolved at product-group level
let fgReadiness = {
  ok: false,
  protocolOk: false,
  specOk: false,
  productGroupId: null,
  productGroupName: null,
  protocolCategoryId: null,
  protocolName: null,
};

// RM readiness: resolved at inventory-group level (NOT item-level)
let rmReadiness = {
  ok: false,
  protocolOk: false,
  specOk: false,
  invGroupId: null,
  invGroupLabel: null,
  protocolCategoryId: null,
  protocolName: null,
};

// PM readiness: resolved at packing-material subcategory level
let pmReadiness = {
  ok: false,
  protocolOk: false,
  specOk: false,
  subcategoryId: null,
  subcategoryLabel: null,
  protocolCategoryId: null,
  protocolName: null,
};

// ── Entry point ───────────────────────────────────────────────────────────────
async function init() {
  currentUserId = await resolveUserId();

  if (!currentUserId) {
    setStatusError("Session expired. Please log in again.");
    startAnalysisBtn.disabled = true;
    return;
  }

  // Default sample date to today
  sampleDate.value = todayISO();

  // Wire all events first (so UI responds even while pickers are loading)
  wireEvents();

  await loadReceiveSamplePermission();

  // Load pickers
  await loadPickers();
}

async function resolveUserId() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (session?.user?.id) return session.user.id;
  } catch {
    /* session unavailable */
  }

  try {
    const sess = await Platform.getSession?.();
    return sess?.user?.id ?? null;
  } catch {
    return null;
  }
}

function mayWorkflowAction(actionCode) {
  return workflowActionPermissions.get(String(actionCode || "")) === true;
}

async function loadReceiveSamplePermission() {
  workflowActionPermissions = new Map();
  receivePermissionVerified = false;

  try {
    const { data, error } = await labSupabase.rpc(
      "fn_get_user_workflow_action_permissions",
      {
        p_user_id: currentUserId,
        p_action_codes: [RECEIVE_SAMPLE_ACTION],
      },
    );

    if (error) throw error;

    (Array.isArray(data) ? data : []).forEach((row) => {
      const code = String(row?.action_code || "").toUpperCase();
      if (code) workflowActionPermissions.set(code, row?.is_allowed === true);
    });

    receivePermissionVerified = true;
    if (!mayWorkflowAction(RECEIVE_SAMPLE_ACTION)) {
      startAnalysisBtn.disabled = true;
      startAnalysisBtn.title = RECEIVE_DENIED_MSG;
      startError.textContent = RECEIVE_DENIED_MSG;
      startError.classList.remove("hidden");
    } else {
      startAnalysisBtn.title = "";
    }
  } catch (err) {
    console.error("[lab-analysis-entry] permission check failed:", err);
    receivePermissionVerified = false;
    startAnalysisBtn.disabled = true;
    startAnalysisBtn.title = PERMISSION_VERIFY_FAILED_MSG;
    setStatusError(PERMISSION_VERIFY_FAILED_MSG);
    startError.textContent = PERMISSION_VERIFY_FAILED_MSG;
    startError.classList.remove("hidden");
  }
}

// ── Pickers ───────────────────────────────────────────────────────────────────
async function loadAllPaged({
  table,
  select,
  order = [],
  pageSize = 1000,
  label = table,
}) {
  const rows = [];

  for (let from = 0; ; ) {
    let query = labSupabase.from(table).select(select, { count: "exact" });

    order.forEach((orderSpec) => {
      if (typeof orderSpec === "string") {
        query = query.order(orderSpec);
      } else if (orderSpec?.column) {
        query = query.order(orderSpec.column, orderSpec.options || {});
      }
    });

    const { data, error, count } = await query.range(
      from,
      from + pageSize - 1,
    );

    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length === 0 || (count !== null && rows.length >= count)) {
      break;
    }

    from += page.length;
  }

  return rows;
}

async function loadPickers() {
  setStatusLoading("Loading pickers…");

  try {
    const [fgRows, allItems, staffRes] = await Promise.all([
      loadAllFgProductsPaged(),
      loadAllRmPmItemsPaged(),
      labSupabase
        .from("v_sample_receipt_staff_picker")
        .select("staff_id, full_name, designation, is_analyst, is_pic")
        .order("full_name"),
    ]);

    if (staffRes.error)
      throw new Error(`Staff picker: ${staffRes.error.message}`);

    // Populate FG product dropdown
    populateSelect(
      productSelect,
      fgRows,
      (r) => r.product_id,
      (r) => r.product_name,
      "— Select Product —",
    );

    // Cache RM and PM items separately — populated on type selection
    rmItems = allItems.filter((i) => i.category_code === "RM");
    pmItems = allItems.filter((i) => i.category_code === "PLM");

    // Populate staff pickers
    const allStaff = staffRes.data ?? [];
    const analysts = allStaff.filter((s) => s.is_analyst === true);
    const pics = allStaff.filter((s) => s.is_pic === true);
    const staffLabel = (s) =>
      s.designation ? `${s.full_name} — ${s.designation}` : s.full_name;

    populateSelect(
      analysedBy,
      analysts,
      (s) => s.staff_id,
      staffLabel,
      "— Select Analyst —",
    );
    populateSelect(
      personInCharge,
      pics,
      (s) => s.staff_id,
      staffLabel,
      "— Select Person In-charge —",
    );

    // Apply staff defaults after populating
    await applyDefaultStaffSelections();

    console.debug("[lab-analysis-entry] pickers loaded", {
      fgProducts: fgRows.length,
      rmItems: rmItems.length,
      pmItems: pmItems.length,
    });

    clearStatus();
  } catch (err) {
    console.error("[lab-analysis-entry] loadPickers error:", err);
    setStatusError(
      `Could not load form data: ${err.message}. Please refresh the page.`,
    );
  }
}

async function loadAllFgProductsPaged() {
  return loadAllPaged({
    table: "v_sample_receipt_fg_picker",
    select: "product_id, product_name",
    order: ["product_name", "product_id"],
    label: "FG picker",
  });
}

async function loadAllRmPmItemsPaged() {
  return loadAllPaged({
    table: "v_rm_pm_item_with_group",
    select:
      "stock_item_id, stock_item_name, category_code, inv_group_id, inv_group_label, subcategory_id, subcategory_label",
    order: ["stock_item_name", "stock_item_id"],
    label: "RM/PM picker",
  });
}

// ── Resolve current user → staff context ────────────────────────────────────
async function loadCurrentUserStaffContext() {
  if (!currentUserId) return null;
  try {
    const { data, error } = await labSupabase
      .from("v_current_user_staff_context")
      .select("staff_id")
      .eq("user_id", currentUserId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (err) {
    console.warn("[lab-analysis-entry] loadCurrentUserStaffContext:", err);
    return null;
  }
}

// ── Default staff selections ──────────────────────────────────────────────────
// Soft defaults — the user can still change them after auto-selection.
async function applyDefaultStaffSelections() {
  // Analysed By: resolve logged-in user → staff_id via v_current_user_staff_context
  const ctx = await loadCurrentUserStaffContext();
  if (ctx?.staff_id) {
    const analystOptions = Array.from(analysedBy.options);
    const analystMatch = analystOptions.find(
      (o) => String(o.value) === String(ctx.staff_id),
    );
    if (analystMatch) {
      analysedBy.value = analystMatch.value;
    }
    // If not found in the analyst list, leave blank — no forced selection
  }

  // Person In-charge: default to staff_id 144
  const DEFAULT_PIC_STAFF_ID = 144;
  const picOptions = Array.from(personInCharge.options);
  const picMatch = picOptions.find(
    (o) => String(o.value) === String(DEFAULT_PIC_STAFF_ID),
  );
  if (picMatch) {
    personInCharge.value = picMatch.value;
  }
}

function wireEvents() {
  bindSearchInputToSelect(productSearchInput, productSelect, productMsg);
  bindSearchInputToSelect(batchSearchInput, batchNoSelect, batchSelectMsg);
  bindSearchInputToSelect(stockItemSearchInput, stockItemSelect, stockItemMsg);
  syncSearchUiForSelect(productSelect);
  syncSearchUiForSelect(batchNoSelect);
  syncSearchUiForSelect(stockItemSelect);

  // Home navigation
  homeBtn.addEventListener("click", () => Platform.goHome());

  // Sample type pills — dirty-form guard
  typePills.querySelectorAll(".type-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const type = pill.dataset.type;
      if (!type) return;
      if (type === currentSampleType) {
        openMobileFieldDrawer();
        return;
      }
      if (isFormDirty()) {
        pendingSwitchType = type;
        switchTypeModal.classList.remove("hidden");
      } else {
        handleSampleTypeChange(type);
      }
    });
  });

  // Switch-type modal buttons
  confirmSwitchTypeBtn.addEventListener("click", () => {
    switchTypeModal.classList.add("hidden");
    if (pendingSwitchType) {
      clearFormData();
      handleSampleTypeChange(pendingSwitchType);
      pendingSwitchType = null;
    }
  });
  cancelSwitchTypeBtn.addEventListener("click", () => {
    switchTypeModal.classList.add("hidden");
    pendingSwitchType = null;
  });
  switchTypeModal.addEventListener("click", (e) => {
    if (e.target === switchTypeModal) {
      switchTypeModal.classList.add("hidden");
      pendingSwitchType = null;
    }
  });

  document.querySelectorAll("[data-close-mobile-fields]").forEach((btn) => {
    btn.addEventListener("click", closeMobileFieldDrawer);
  });
  if (receiptDetailsBtn) {
    receiptDetailsBtn.addEventListener("click", openMobileFieldDrawer);
  }
  if (mobileReceiptDrawerClose) {
    mobileReceiptDrawerClose.addEventListener("click", closeMobileFieldDrawer);
  }
  if (mobileReceiptDrawerDone) {
    mobileReceiptDrawerDone.addEventListener("click", closeMobileFieldDrawer);
  }
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.body.classList.contains("mobile-field-drawer-open")
    ) {
      closeMobileFieldDrawer();
    }
  });
  window.addEventListener("resize", () => {
    if (!isMobileEntryLayout()) closeMobileFieldDrawer();
  });

  // Product change → repopulate FG batch dropdown; protocol check deferred to batch selection
  productSelect.addEventListener("change", async () => {
    syncSearchInputFromSelect(productSelect);
    clearFieldError(batchSearchInput, batchSelectMsg);
    clearMappingState();
    await populateFgBatchDropdown(productSelect.value);
    updateSampleTypeSummary();
  });

  // Batch No dropdown → populate read-only fields + trigger mapping check
  batchNoSelect.addEventListener("change", () => {
    syncSearchInputFromSelect(batchNoSelect);
    const opt = batchNoSelect.options[batchNoSelect.selectedIndex];
    if (batchNoSelect.value && opt) {
      batchSizeDisplay.value = opt.dataset.batchSize ?? "";
      batchUomDisplay.value = opt.dataset.uom ?? "";
      clearFieldError(batchSearchInput, batchSelectMsg);
      if (productSelect.value) scheduleProtocolCheck();
    } else {
      batchSizeDisplay.value = "";
      batchUomDisplay.value = "";
      clearMappingState();
    }
    updateStartButton();
    updateSampleTypeSummary();
  });

  // Stock item change → trigger mapping check
  stockItemSelect.addEventListener("change", () => {
    syncSearchInputFromSelect(stockItemSelect);
    clearMappingState();
    if (stockItemSelect.value) scheduleProtocolCheck();
    updateSampleTypeSummary();
  });

  // Effective specifications are date-sensitive. Keep readiness aligned with
  // the same sample date that will be passed to the create-analysis RPC.
  sampleDate.addEventListener("change", () => {
    clearMappingState();
    if (
      (currentSampleType === "FG_BATCH" &&
        productSelect.value &&
        batchNoSelect.value) ||
      (currentSampleType !== "FG_BATCH" && getSelectedItemId())
    ) {
      scheduleProtocolCheck();
    }
  });

  // Blur-validate required fields
  sampleDate.addEventListener("blur", () =>
    validateField(sampleDate, dateMsg, "Sample Received Date is required"),
  );
  physRegRef.addEventListener("blur", () =>
    validateField(
      physRegRef,
      physRegMsg,
      "Physical Register Serial No is required",
    ),
  );
  analysedBy.addEventListener("change", () =>
    validateField(analysedBy, analystMsg, "Please select an analyst"),
  );
  personInCharge.addEventListener("change", () =>
    validateField(personInCharge, picMsg, "Please select a person in-charge"),
  );

  // Enable/disable Start button when required fields change
  [
    productSelect,
    stockItemSelect,
    batchNoSelect,
    systemLotNo,
    sampleDate,
    physRegRef,
    analysedBy,
    personInCharge,
  ].forEach((el) => {
    el.addEventListener("change", updateStartButton);
    el.addEventListener("input", updateStartButton);
    el.addEventListener("change", updateSampleTypeSummary);
    el.addEventListener("input", updateSampleTypeSummary);
  });

  // Start analysis
  startAnalysisBtn.addEventListener("click", startAnalysis);

  // Test preview toggle
  testPreviewToggle.addEventListener("click", () => {
    const expanded = testPreviewToggle.getAttribute("aria-expanded") === "true";
    testPreviewToggle.setAttribute(
      "aria-expanded",
      expanded ? "false" : "true",
    );
    testPreviewBody.classList.toggle("hidden", expanded);
    testPreviewToggleLabel.textContent = expanded
      ? "Show Seeded Tests"
      : "Hide Seeded Tests";
  });

  // Post-create navigation buttons
  btnOpenWorkspace.addEventListener("click", () => {
    if (!createdAnalysis?.analysis_id) return;
    navigate(`analysis-workspace.html?id=${createdAnalysis.analysis_id}`);
  });
  btnOpenQueue.addEventListener("click", () => {
    navigate("lab-analysis-queue.html");
  });
  btnStartAnother.addEventListener("click", resetForm);
}

// ── Dirty-form detection ──────────────────────────────────────────────────────
function isFormDirty() {
  // FG fields
  if (productSelect.value) return true;
  if (batchNoSelect.value) return true;
  // RM fields
  if (stockItemSelect.value) return true;
  if (systemLotNo.value.trim()) return true;
  // Common fields (excluding auto-defaulted date)
  if (physRegRef.value.trim()) return true;
  if (remarks.value.trim()) return true;
  return false;
}

// ── Clear form data (without full state reset) ────────────────────────────────
function clearFormData() {
  productSelect.value = "";
  populateFgBatchDropdown(null);
  stockItemSelect.value = "";
  syncSearchInputFromSelect(productSelect);
  syncSearchInputFromSelect(stockItemSelect);
  systemLotNo.value = "";
  physRegRef.value = "";
  remarks.value = "";
  clearAllFieldErrors();
  startError.classList.add("hidden");
  startError.textContent = "";
  clearMappingState();
  updateSampleTypeSummary();
}

// ── Sample type change ────────────────────────────────────────────────────────
function handleSampleTypeChange(type) {
  currentSampleType = type;

  // Toggle pill active state
  typePills.querySelectorAll(".type-pill").forEach((pill) => {
    const isActive = pill.dataset.type === type;
    pill.classList.toggle("active", isActive);
    pill.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  // Show the right item fields
  if (type === "FG_BATCH") {
    fgFields.classList.remove("hidden");
    rmFields.classList.add("hidden");
  } else {
    rmFields.classList.remove("hidden");
    fgFields.classList.add("hidden");
    // System Lot No is backend-generated for RM/PM
    systemLotNo.value = "";
    systemLotNo.readOnly = true;
    systemLotNo.placeholder = "Auto-generated after saving";
    // Update label and populate dropdown for chosen type
    const isPM = type === "PM_LOT";
    const stockItemLabel = document.querySelector(
      "label[for='stockItemSearchInput']",
    );
    if (stockItemLabel) {
      stockItemLabel.innerHTML = isPM
        ? 'Packing Material <span class="req" aria-hidden="true">*</span>'
        : 'Raw Material <span class="req" aria-hidden="true">*</span>';
    }
    populateSelect(
      stockItemSelect,
      isPM ? pmItems : rmItems,
      (r) => r.stock_item_id,
      (r) => r.stock_item_name,
      isPM ? "— Select Packing Material —" : "— Select Raw Material —",
    );
    if (stockItemSearchInput) {
      stockItemSearchInput.placeholder = isPM
        ? "Type to search packing material"
        : "Type to search raw material";
    }
    updateRmPmDrawerCopy(isPM);
  }

  // Common fields always visible after type is chosen
  commonFields.classList.remove("hidden");

  // Show mapping section (will populate when item is selected)
  readinessSection.classList.remove("hidden");

  // Show actions bar
  formActionsBar.classList.remove("hidden");

  // Clear any existing mapping state
  clearMappingState();

  // Update step indicator
  setStepActive(1);

  // If the relevant item fields are already populated, trigger mapping check
  if (currentSampleType === "FG_BATCH") {
    if (productSelect.value && batchNoSelect.value) scheduleProtocolCheck();
  } else {
    if (getSelectedItemId()) scheduleProtocolCheck();
  }

  updateStartButton();
  updateSampleTypeSummary();
  openMobileFieldDrawer();
}

function isMobileEntryLayout() {
  return window.matchMedia("(max-width: 600px)").matches;
}

function updateRmPmDrawerCopy(isPM = currentSampleType === "PM_LOT") {
  if (rmPmDrawerTitle) {
    rmPmDrawerTitle.textContent = isPM ? "PM Lot Details" : "RM Lot Details";
  }
  if (rmPmDrawerSub) {
    rmPmDrawerSub.textContent = isPM
      ? "Select packing material lot details for the sample."
      : "Select raw material lot details for the sample.";
  }
}

function openMobileFieldDrawer() {
  if (!currentSampleType || !isMobileEntryLayout()) return;
  prepareMobileReceiptDrawer();
  moveStep1SectionsToMobileDrawer();
  if (mobileReceiptDrawer) mobileReceiptDrawer.classList.remove("hidden");
  document.body.classList.add("mobile-field-drawer-open");

  const focusTarget =
    currentSampleType === "FG_BATCH" ? productSearchInput : stockItemSearchInput;
  setTimeout(() => {
    try {
      focusTarget?.focus();
    } catch {
      /* ignore focus failures */
    }
  }, 0);
}

function closeMobileFieldDrawer() {
  restoreStep1SectionsFromMobileDrawer();
  if (mobileReceiptDrawer) mobileReceiptDrawer.classList.add("hidden");
  document.body.classList.remove("mobile-field-drawer-open");
  updateSampleTypeSummary();
}

function moveStep1SectionsToMobileDrawer() {
  if (!mobileReceiptDrawerBody) return;
  const activeTypeFields =
    currentSampleType === "FG_BATCH" ? fgFields : rmFields;
  if (activeTypeFields) mobileReceiptDrawerBody.appendChild(activeTypeFields);
  if (commonFields) mobileReceiptDrawerBody.appendChild(commonFields);
}

function restoreStep1SectionsFromMobileDrawer() {
  const mainCard = $("mainCard");
  if (!mainCard || !readinessSection) return;
  mainCard.insertBefore(fgFields, readinessSection);
  mainCard.insertBefore(rmFields, readinessSection);
  mainCard.insertBefore(commonFields, readinessSection);
}

function prepareMobileReceiptDrawer() {
  const typeLabel = sampleTypeLabel();
  if (mobileReceiptDrawerTitle) {
    mobileReceiptDrawerTitle.textContent = `${typeLabel} Receipt Details`;
  }
  if (mobileReceiptDrawerSub) {
    mobileReceiptDrawerSub.textContent =
      "Complete sample reference and receipt details for analysis entry.";
  }
}

function sampleTypeLabel(type = currentSampleType) {
  if (type === "FG_BATCH") return "FG Batch";
  if (type === "PM_LOT") return "PM Lot";
  if (type === "RM_LOT") return "RM Lot";
  return "";
}

function updateSampleTypeSummary() {
  if (!receiptDetailsBtn || !currentSampleType) return;

  let detail = "";
  if (currentSampleType === "FG_BATCH") {
    const product = productSelect.value ? selectedOptionText(productSelect) : "";
    const batch = batchNoSelect.value ? selectedOptionText(batchNoSelect) : "";
    detail = [product, batch].filter(Boolean).join(" / ");
  } else {
    detail = stockItemSelect.value ? selectedOptionText(stockItemSelect) : "";
  }

  const isComplete = isReceiptDetailsComplete();
  if (receiptDetailsSub) {
    receiptDetailsSub.textContent = detail
      ? `${sampleTypeLabel()}: ${detail}`
      : `${sampleTypeLabel()} selected. Details pending.`;
  }
  receiptDetailsBtn.classList.toggle("is-complete", isComplete);
  receiptDetailsBtn.classList.remove("hidden");
  receiptDetailsBtn.setAttribute(
    "aria-label",
    isComplete
      ? "Receipt details complete. Open receipt details."
      : "Receipt details incomplete. Open receipt details.",
  );
  if (receiptDetailsStatus) {
    receiptDetailsStatus.innerHTML = isComplete
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  }
}

function isReceiptDetailsComplete() {
  if (!currentSampleType) return false;
  const hasSubjectDetails =
    currentSampleType === "FG_BATCH"
      ? !!(productSelect.value && batchNoSelect.value)
      : !!stockItemSelect.value;
  return !!(
    hasSubjectDetails &&
    sampleDate.value &&
    physRegRef.value.trim() &&
    analysedBy.value &&
    personInCharge.value
  );
}

// ── Protocol mapping ──────────────────────────────────────────────────────────
function scheduleProtocolCheck() {
  clearTimeout(mappingCheckDebounceTimer);
  // Small debounce in case of rapid changes
  mappingCheckDebounceTimer = setTimeout(checkReadiness, 250);
}

async function checkReadiness() {
  const selectedId = getSelectedItemId();
  if (!selectedId || !currentSampleType) return;

  // Show loading
  mappingLoading.classList.remove("hidden");
  readinessOk.classList.add("hidden");
  readinessMissing.classList.add("hidden");
  testPreview.classList.add("hidden");

  setStepActive(2);

  if (currentSampleType === "FG_BATCH") {
    await checkFgReadiness(selectedId);
  } else if (currentSampleType === "PM_LOT") {
    await checkPmReadiness(selectedId);
  } else {
    await checkInventoryReadiness(selectedId);
  }

  updateStartButton();
}

// ── FG readiness check (product-group level) ──────────────────────────────────
// Validates: product → product group → active protocol → effective FG spec
async function checkFgReadiness(productId) {
  // Reset FG readiness state
  fgReadiness = {
    ok: false,
    protocolOk: false,
    specOk: false,
    productGroupId: null,
    productGroupName: null,
    protocolCategoryId: null,
    protocolName: null,
  };

  try {
    // Step 1: resolve product group via v_fg_product_with_group
    const { data: grpData, error: grpErr } = await labSupabase
      .from("v_fg_product_with_group")
      .select("product_group_id, product_group_name")
      .eq("product_id", productId)
      .limit(1);

    if (grpErr) throw grpErr;

    mappingLoading.classList.add("hidden");

    const grp = grpData?.[0];
    if (!grp?.product_group_id) {
      showFgNotReady(
        "No product group is mapped for the selected product.",
        "A product-group mapping is required before an FG analysis can be started.",
      );
      console.warn(
        "[FG Readiness] No product group for product_id:",
        productId,
      );
      return;
    }

    fgReadiness.productGroupId = grp.product_group_id;
    fgReadiness.productGroupName = grp.product_group_name;
    console.debug(
      "[FG Readiness] product_group_id:",
      grp.product_group_id,
      "| product_group_name:",
      grp.product_group_name,
    );

    // Step 2: check active FG protocol for the product group
    const { data: mapRows, error: mapErr } = await labSupabase
      .from("protocol_category_product_group_map")
      .select("protocol_category_id")
      .eq("product_group_id", grp.product_group_id)
      .eq("is_active", true)
      .limit(1);

    if (mapErr) throw mapErr;

    const protocolCategoryId = mapRows?.[0]?.protocol_category_id ?? null;
    if (!protocolCategoryId) {
      showFgNotReady(
        "No active FG protocol is mapped to this product group.",
        `Product group: ${grp.product_group_name ?? grp.product_group_id}`,
      );
      return;
    }

    // Fetch protocol category details
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name, category_code")
      .eq("id", protocolCategoryId)
      .limit(1);

    if (catErr) throw catErr;

    const cat = catRows?.[0];
    fgReadiness.protocolOk = true;
    fgReadiness.protocolCategoryId = protocolCategoryId;
    fgReadiness.protocolName = cat?.category_name ?? null;

    // Step 3: resolve read-only effective FG preview (source of truth)
    const { data: preview, error: specErr } = await labSupabase.rpc(
      "fn_preview_effective_fg_spec_for_product",
      {
        p_product_id: Number(productId),
        p_as_of_date: selectedSampleDate(),
      },
    );
    if (specErr) throw specErr;

    if (preview?.ok !== true) {
      readinessOk.classList.add("hidden");
      testPreview.classList.add("hidden");
      testPreviewLoading.classList.add("hidden");
      testPreviewTbody.innerHTML = "";
      testPreviewEmpty.textContent =
        preview?.message ||
        "No effective FG specification could be resolved for this product.";
      testPreviewEmpty.classList.remove("hidden");
      showFgNotReady(
        preview?.message ||
          "No effective FG specification could be resolved for this product.",
        "Please confirm base spec and overrides in the Spec Profile Manager.",
      );
      fgReadiness.specOk = false;
      fgReadiness.ok = false;
      return;
    }

    // FG preview: render canonical read-only effective lines
    testPreview.classList.remove("hidden");
    const rows = Array.isArray(preview?.lines) ? preview.lines : [];
    const activeLineCount = renderEffectiveSpecPreviewRows(rows);

    if (!activeLineCount || activeLineCount <= 0) {
      readinessOk.classList.add("hidden");
      showFgNotReady(
        "Effective FG specification has no active test lines.",
        "Please check the effective preview in the Spec Profile Manager before starting analysis.",
      );
      fgReadiness.specOk = false;
      fgReadiness.ok = false;
      return;
    }

    // All checks passed
    fgReadiness.specOk = true;
    fgReadiness.ok = true;

    // Update "found" card label and detail
    const foundLabel = readinessOk.querySelector(".mapping-found-label");
    if (foundLabel) foundLabel.textContent = "FG readiness check passed";

    const code = esc(cat?.category_code ?? "");
    const name = esc(cat?.category_name ?? "—");
    const groupName = esc(grp.product_group_name ?? "—");
    protocolInfoDisplay.innerHTML =
      `<div class="mapping-group-line">Product Group: ${groupName}</div>` +
      (code ? `<span class="mapping-category-code">${code}</span>` : "") +
      `FG protocol resolved at product-group level. ` +
      name;

    readinessOk.classList.remove("hidden");
  } catch (err) {
    console.error("[lab-analysis-entry] checkFgReadiness error:", err);
    mappingLoading.classList.add("hidden");
    showFgNotReady(`FG readiness check failed: ${err.message}`, "");
    toast(`FG readiness check failed: ${err.message}`, "error");
  }
}

function showFgNotReady(labelMsg, subMsg) {
  const warnLabel = readinessMissing.querySelector(".mapping-warn-label");
  const warnSub = readinessMissing.querySelector(".mapping-warn-sub");
  if (warnLabel) warnLabel.textContent = labelMsg;
  if (warnSub) warnSub.textContent = subMsg;
  readinessMissing.classList.remove("hidden");
}

// ── RM readiness check (inventory-group level) ────────────────────────────────
// Validates: stock item → inventory group → active RM protocol → active RM base spec
// PM_LOT is handled separately by checkPmReadiness(); never call this for PM.
async function checkInventoryReadiness(stockItemId) {
  rmReadiness = {
    ok: false,
    protocolOk: false,
    specOk: false,
    invGroupId: null,
    invGroupLabel: null,
    protocolCategoryId: null,
    protocolName: null,
  };

  try {
    // Step 1: resolve inventory group
    const { data: grpData, error: grpErr } = await labSupabase
      .from("v_rm_pm_item_with_group")
      .select("inv_group_id, inv_group_label")
      .eq("stock_item_id", stockItemId)
      .eq("category_code", "RM")
      .limit(1);
    if (grpErr) throw grpErr;

    mappingLoading.classList.add("hidden");

    const grp = grpData?.[0];
    if (!grp?.inv_group_id) {
      showInventoryNotReady(
        "No inventory group is mapped for the selected stock item.",
        "An inventory-group mapping is required before an RM analysis can be started.",
      );
      return;
    }
    rmReadiness.invGroupId = grp.inv_group_id;
    rmReadiness.invGroupLabel = grp.inv_group_label;

    // Step 2: check active RM protocol for the inventory group
    const { data: mapRows, error: mapErr } = await labSupabase
      .from("protocol_category_inv_group_map")
      .select("protocol_category_id")
      .eq("inv_group_id", grp.inv_group_id)
      .eq("is_active", true)
      .limit(1);
    if (mapErr) throw mapErr;

    const protocolCategoryId = mapRows?.[0]?.protocol_category_id ?? null;
    if (!protocolCategoryId) {
      showInventoryNotReady(
        "No active RM protocol is mapped to this inventory group.",
        "Inventory group: " + (grp.inv_group_label ?? grp.inv_group_id),
      );
      return;
    }

    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name, category_code")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (catErr) throw catErr;

    const cat = catRows?.[0];
    rmReadiness.protocolOk = true;
    rmReadiness.protocolCategoryId = protocolCategoryId;
    rmReadiness.protocolName = cat?.category_name ?? null;

    // Step 3: check active RM base spec for the inventory group
    const { data: smRows, error: smErr } = await labSupabase
      .from("spec_profile_inv_group_map")
      .select("spec_profile_id")
      .eq("inv_group_id", grp.inv_group_id)
      .eq("is_active", true)
      .limit(1);
    if (smErr) throw smErr;

    const specProfileId = smRows?.[0]?.spec_profile_id ?? null;
    if (!specProfileId) {
      showInventoryNotReady(
        "No active RM base specification exists for this inventory group.",
        "Please generate a base spec in the Spec Profile Manager before starting analysis.",
      );
      return;
    }

    // Step 4: resolve read-only effective RM preview
    const { data: preview, error: previewErr } = await labSupabase.rpc(
      "fn_preview_effective_rm_spec_for_item",
      {
        p_stock_item_id: Number(stockItemId),
        p_as_of_date: selectedSampleDate(),
      },
    );
    if (previewErr) throw previewErr;

    const rows = Array.isArray(preview?.lines) ? preview.lines : [];
    if (preview?.ok !== true || rows.length <= 0) {
      readinessOk.classList.add("hidden");
      testPreview.classList.remove("hidden");
      renderEffectiveSpecPreviewRows(rows);
      showInventoryNotReady(
        preview?.ok === true
          ? "Effective RM specification has no active test lines."
          : preview?.message ||
              "No effective RM specification could be resolved for this stock item.",
        "Please check the effective preview in the Spec Profile Manager before starting analysis.",
      );
      rmReadiness.specOk = false;
      rmReadiness.ok = false;
      return;
    }

    // All checks passed
    rmReadiness.specOk = true;
    rmReadiness.ok = true;

    const foundLabel = readinessOk.querySelector(".mapping-found-label");
    if (foundLabel) foundLabel.textContent = "RM readiness check passed";

    const code = esc(cat?.category_code ?? "");
    const name = esc(cat?.category_name ?? "—");
    const groupLabel = esc(grp.inv_group_label ?? "—");
    protocolInfoDisplay.innerHTML =
      '<div class="mapping-group-line">Inventory Group: ' +
      groupLabel +
      "</div>" +
      (code ? '<span class="mapping-category-code">' + code + "</span>" : "") +
      "RM protocol resolved at inventory-group level. " +
      name;

    readinessOk.classList.remove("hidden");
    testPreview.classList.remove("hidden");
    renderEffectiveSpecPreviewRows(rows);
  } catch (err) {
    console.error("[lab-analysis-entry] checkInventoryReadiness error:", err);
    mappingLoading.classList.add("hidden");
    showInventoryNotReady("RM readiness check failed: " + err.message, "");
    toast("RM readiness check failed: " + err.message, "error");
  }
}

// ── PM readiness check (packing-material subcategory level) ──────────────────
// Validates: stock item → subcategory → active PM protocol (RPC) → active PM base spec (RPC)
async function checkPmReadiness(stockItemId) {
  pmReadiness = {
    ok: false,
    protocolOk: false,
    specOk: false,
    subcategoryId: null,
    subcategoryLabel: null,
    protocolCategoryId: null,
    protocolName: null,
  };

  try {
    // Step 1: resolve packing material subcategory from v_rm_pm_item_with_group
    const { data: subcatData, error: subcatErr } = await labSupabase
      .from("v_rm_pm_item_with_group")
      .select("subcategory_id, subcategory_label")
      .eq("stock_item_id", stockItemId)
      .eq("category_code", "PLM")
      .limit(1);
    if (subcatErr) throw subcatErr;

    mappingLoading.classList.add("hidden");

    const subcat = subcatData?.[0];
    if (!subcat?.subcategory_id) {
      showInventoryNotReady(
        "No packing material subcategory is mapped for the selected packing material.",
        "A subcategory mapping is required before a PM analysis can be started.",
      );
      return;
    }

    pmReadiness.subcategoryId = subcat.subcategory_id;
    pmReadiness.subcategoryLabel = subcat.subcategory_label;

    // Step 2: resolve active PM protocol via RPC
    const { data: protocolCategoryId, error: mapErr } = await labSupabase.rpc(
      "fn_get_active_protocol_category_id_for_pm_subcategory",
      { p_subcategory_id: Number(subcat.subcategory_id) },
    );
    if (mapErr) throw mapErr;

    if (!protocolCategoryId) {
      showInventoryNotReady(
        "No active PM protocol is mapped to this packing material subcategory.",
        "Packing Material Subcategory: " +
          (subcat.subcategory_label ?? subcat.subcategory_id),
      );
      return;
    }

    // Step 3: fetch protocol category details
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name, category_code")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (catErr) throw catErr;

    const cat = catRows?.[0];
    pmReadiness.protocolOk = true;
    pmReadiness.protocolCategoryId = protocolCategoryId;
    pmReadiness.protocolName = cat?.category_name ?? null;

    // Step 4: resolve active PM base spec via RPC
    const { data: specProfileId, error: smErr } = await labSupabase.rpc(
      "fn_get_active_spec_profile_id_for_pm_subcategory",
      {
        p_subcategory_id: Number(subcat.subcategory_id),
        p_as_of_date: selectedSampleDate(),
      },
    );
    if (smErr) throw smErr;

    if (!specProfileId) {
      showInventoryNotReady(
        "No active PM base specification exists for this packing material subcategory.",
        "Please generate a base spec in the Spec Profile Manager before starting analysis.",
      );
      return;
    }

    // Step 5: resolve read-only effective PM preview
    const { data: preview, error: previewErr } = await labSupabase.rpc(
      "fn_preview_effective_pm_spec_for_item",
      {
        p_stock_item_id: Number(stockItemId),
        p_as_of_date: selectedSampleDate(),
      },
    );
    if (previewErr) throw previewErr;

    const rows = Array.isArray(preview?.lines) ? preview.lines : [];
    if (preview?.ok !== true || rows.length <= 0) {
      readinessOk.classList.add("hidden");
      testPreview.classList.remove("hidden");
      renderEffectiveSpecPreviewRows(rows);
      showInventoryNotReady(
        preview?.ok === true
          ? "Effective PM specification has no active test lines."
          : preview?.message ||
              "No effective PM specification could be resolved for this stock item.",
        "Please check the effective preview in the Spec Profile Manager before starting analysis.",
      );
      pmReadiness.specOk = false;
      pmReadiness.ok = false;
      return;
    }

    // All checks passed
    pmReadiness.specOk = true;
    pmReadiness.ok = true;

    const foundLabel = readinessOk.querySelector(".mapping-found-label");
    if (foundLabel) foundLabel.textContent = "PM readiness check passed";

    const code = esc(cat?.category_code ?? "");
    const name = esc(cat?.category_name ?? "—");
    const subcatLabel = esc(subcat.subcategory_label ?? "—");
    protocolInfoDisplay.innerHTML =
      '<div class="mapping-group-line">Packing Material Subcategory: ' +
      subcatLabel +
      "</div>" +
      (code ? '<span class="mapping-category-code">' + code + "</span>" : "") +
      "PM protocol resolved at packing-material subcategory level. " +
      name;

    readinessOk.classList.remove("hidden");
    testPreview.classList.remove("hidden");
    renderEffectiveSpecPreviewRows(rows);
  } catch (err) {
    console.error("[lab-analysis-entry] checkPmReadiness error:", err);
    mappingLoading.classList.add("hidden");
    showInventoryNotReady(
      "PM readiness check failed: " + err.message,
      "A protocol and base spec are required at packing-material subcategory level.",
    );
    toast("PM readiness check failed: " + err.message, "error");
  }
}

function showInventoryNotReady(labelMsg, subMsg) {
  const warnLabel = readinessMissing.querySelector(".mapping-warn-label");
  const warnSub = readinessMissing.querySelector(".mapping-warn-sub");
  if (warnLabel) warnLabel.textContent = labelMsg;
  if (warnSub) warnSub.textContent = subMsg;
  readinessMissing.classList.remove("hidden");
}

function clearMappingState() {
  fgReadiness = {
    ok: false,
    protocolOk: false,
    specOk: false,
    productGroupId: null,
    productGroupName: null,
    protocolCategoryId: null,
    protocolName: null,
  };
  rmReadiness = {
    ok: false,
    protocolOk: false,
    specOk: false,
    invGroupId: null,
    invGroupLabel: null,
    protocolCategoryId: null,
    protocolName: null,
  };
  pmReadiness = {
    ok: false,
    protocolOk: false,
    specOk: false,
    subcategoryId: null,
    subcategoryLabel: null,
    protocolCategoryId: null,
    protocolName: null,
  };
  mappingLoading.classList.add("hidden");
  readinessOk.classList.add("hidden");
  readinessMissing.classList.add("hidden");
  testPreview.classList.add("hidden");
  // Collapse preview
  testPreviewToggle.setAttribute("aria-expanded", "false");
  testPreviewBody.classList.add("hidden");
  testPreviewToggleLabel.textContent = "Show Seeded Tests";
  testPreviewTbody.innerHTML = "";
  updateStartButton();
}

// ── FG batch dropdown population ──────────────────────────────────────────────
async function populateFgBatchDropdown(productId) {
  const requestId = ++fgBatchLoadRequestId;
  batchSizeDisplay.value = "";
  batchUomDisplay.value = "";

  if (!productId) {
    batchNoSelect.innerHTML =
      '<option value="">— Select Product first —</option>';
    batchNoSelect.disabled = true;
    syncSearchUiForSelect(batchNoSelect);
    return;
  }

  batchNoSelect.innerHTML = '<option value="">— Loading batches… —</option>';
  batchNoSelect.disabled = true;
  syncSearchUiForSelect(batchNoSelect);
  updateStartButton();

  const rows = [];
  const pageSize = 1000;

  try {
    for (let from = 0; ; ) {
      const { data, error, count } = await labSupabase
        .from("v_sample_receipt_fg_batch_picker")
        .select("bmr_id, product_id, batch_no, batch_size, uom", {
          count: "exact",
        })
        .eq("product_id", productId)
        .order("batch_no")
        .order("bmr_id")
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (requestId !== fgBatchLoadRequestId) return;

      const page = data ?? [];
      rows.push(...page);
      if (page.length === 0 || (count !== null && rows.length >= count)) break;
      from += page.length;
    }
  } catch (error) {
    if (requestId !== fgBatchLoadRequestId) return;
    console.error("[lab-analysis-entry] Failed to load FG batches:", error);
    batchNoSelect.innerHTML =
      '<option value="">— Could not load batches —</option>';
    batchNoSelect.disabled = true;
    syncSearchUiForSelect(batchNoSelect);
    setFieldError(
      batchSearchInput,
      batchSelectMsg,
      "Could not load batches for the selected product.",
    );
    updateStartButton();
    return;
  }

  if (requestId !== fgBatchLoadRequestId) return;

  if (rows.length === 0) {
    batchNoSelect.innerHTML =
      '<option value="">— No batches available —</option>';
    batchNoSelect.disabled = true;
  } else {
    batchNoSelect.innerHTML = '<option value="">— Select Batch No —</option>';
    rows.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.batch_no ?? "";
      opt.textContent = r.batch_no ?? "—";
      opt.dataset.batchSize = r.batch_size ?? "";
      opt.dataset.uom = r.uom ?? "";
      batchNoSelect.appendChild(opt);
    });
    batchNoSelect.disabled = false;
  }
  syncSearchUiForSelect(batchNoSelect);
  updateStartButton();
}

// ── Effective-spec preview row renderer (read-only RPC output) ──────────────
function renderEffectiveSpecPreviewRows(rows) {
  testPreviewLoading.classList.remove("hidden");
  testPreviewEmpty.classList.add("hidden");
  testPreviewTbody.innerHTML = "";
  const safeRows = Array.isArray(rows) ? rows : [];

  testPreviewLoading.classList.add("hidden");

  if (!safeRows.length) {
    testPreviewEmpty.textContent =
      "No active effective specification lines found.";
    testPreviewEmpty.classList.remove("hidden");
    testPreviewToggleLabel.textContent = "Show Effective Spec";
    return 0;
  }

  testPreviewToggleLabel.textContent = `Show Effective Spec (${safeRows.length} active lines)`;

  const sourceBadgeMap = {
    BASE: "Base",
    MODIFY: "Modify",
    ADD: "Add",
  };

  const frag = document.createDocumentFragment();
  safeRows.forEach((r) => {
    const sourceType = String(r.source_type ?? "").toUpperCase();
    const sourceBadge = sourceBadgeMap[sourceType]
      ? ` <span class="preview-source-badge">${esc(sourceBadgeMap[sourceType])}</span>`
      : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="pt-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td>${esc(r.test_name ?? "—")}${sourceBadge}</td>
      <td>${esc(r.method_name ?? "—")}</td>
      <td class="pt-spec">${esc(r.display_text ?? "—")}</td>
    `;
    frag.appendChild(tr);
  });
  testPreviewTbody.appendChild(frag);
  return safeRows.length;
}

// ── Form validation ───────────────────────────────────────────────────────────
function validateForm() {
  const errors = [];

  clearAllFieldErrors();

  // Sample type
  if (!currentSampleType) {
    errors.push("Please select a Sample Type.");
  }

  if (currentSampleType === "FG_BATCH") {
    if (!productSelect.value) {
      setFieldError(productSearchInput, productMsg, "Product is required");
      errors.push("Product is required");
    }
    if (!batchNoSelect.value) {
      setFieldError(batchSearchInput, batchSelectMsg, "Batch No is required");
      errors.push("Batch No is required");
    }
  }

  if (currentSampleType === "RM_LOT" || currentSampleType === "PM_LOT") {
    const itemLabel =
      currentSampleType === "PM_LOT" ? "Packing Material" : "Raw Material";
    if (!stockItemSelect.value) {
      setFieldError(
        stockItemSearchInput,
        stockItemMsg,
        `${itemLabel} is required`,
      );
      errors.push(`${itemLabel} is required`);
    }
  }

  if (!sampleDate.value) {
    setFieldError(sampleDate, dateMsg, "Sample Received Date is required");
    errors.push("Sample Received Date is required");
  }

  if (!physRegRef.value.trim()) {
    setFieldError(
      physRegRef,
      physRegMsg,
      "Physical Register Serial No is required",
    );
    errors.push("Physical Register Serial No is required");
  }

  if (!analysedBy.value) {
    setFieldError(analysedBy, analystMsg, "Analysed By is required");
    errors.push("Analysed By is required");
  }

  if (!personInCharge.value) {
    setFieldError(personInCharge, picMsg, "Person In-charge is required");
    errors.push("Person In-charge is required");
  }

  if (currentSampleType === "FG_BATCH") {
    if (!fgReadiness.ok) {
      errors.push(
        "FG readiness check has not passed. A protocol and base spec are required at product-group level.",
      );
    }
  } else if (currentSampleType === "PM_LOT") {
    if (!pmReadiness.ok) {
      errors.push(
        "PM readiness check has not passed. A protocol and base spec are required at packing-material subcategory level.",
      );
    }
  } else if (currentSampleType === "RM_LOT") {
    if (!rmReadiness.ok) {
      errors.push(
        "RM readiness check has not passed. A protocol and base spec are required at inventory-group level.",
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateField(input, msgEl, message) {
  const val = input.value?.trim ? input.value.trim() : input.value;
  if (!val) {
    setFieldError(input, msgEl, message);
  } else {
    clearFieldError(input, msgEl);
  }
}

function setFieldError(input, msgEl, message) {
  input.classList.add("field-error");
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = "field-msg msg-error";
  }
}

function clearFieldError(input, msgEl) {
  input.classList.remove("field-error");
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.className = "field-msg";
  }
}

function clearAllFieldErrors() {
  [
    [productSearchInput, productMsg],
    [batchSearchInput, batchSelectMsg],
    [stockItemSearchInput, stockItemMsg],
    [systemLotNo, lotMsg],
    [sampleDate, dateMsg],
    [physRegRef, physRegMsg],
    [analysedBy, analystMsg],
    [personInCharge, picMsg],
  ].forEach(([inp, msg]) => clearFieldError(inp, msg));
}

// ── Update Start button state ─────────────────────────────────────────────────
function updateStartButton() {
  const isFG = currentSampleType === "FG_BATCH";
  const isPM = currentSampleType === "PM_LOT";
  const mappingReady = isFG
    ? fgReadiness.ok
    : isPM
      ? pmReadiness.ok
      : rmReadiness.ok;

  const permissionAllows =
    receivePermissionVerified && mayWorkflowAction(RECEIVE_SAMPLE_ACTION);

  const canStart = !!(
    currentSampleType &&
    mappingReady &&
    permissionAllows &&
    (isFG
      ? productSelect.value && batchNoSelect.value
      : stockItemSelect.value) &&
    sampleDate.value &&
    physRegRef.value.trim() &&
    analysedBy.value &&
    personInCharge.value
  );
  startAnalysisBtn.disabled = !canStart;
  if (!permissionAllows) {
    startAnalysisBtn.title = receivePermissionVerified
      ? RECEIVE_DENIED_MSG
      : PERMISSION_VERIFY_FAILED_MSG;
  } else {
    startAnalysisBtn.title = "";
  }

  if (canStart) {
    setStepActive(3);
  } else if (mappingReady) {
    setStepActive(2);
  }
}

// ── Step indicator ────────────────────────────────────────────────────────────
function setStepActive(activeStep) {
  // Reset all
  [step1El, step2El, step3El].forEach((s) => {
    s.classList.remove("step-active", "step-done", "step-pending");
  });
  [line1El, line2El].forEach((l) => {
    l.classList.remove("line-done", "line-active");
  });

  if (activeStep >= 1) {
    if (activeStep > 1) {
      step1El.classList.add("step-done");
      line1El.classList.add(activeStep > 2 ? "line-done" : "line-active");
    } else {
      step1El.classList.add("step-active");
    }
  }

  if (activeStep >= 2) {
    if (activeStep > 2) {
      step2El.classList.add("step-done");
      line2El.classList.add("line-active");
    } else {
      step2El.classList.add("step-active");
    }
    step1El.classList.remove("step-active");
    step1El.classList.add("step-done");
    line1El.classList.remove("line-active");
    line1El.classList.add("line-done");
  }

  if (activeStep >= 3) {
    step3El.classList.add("step-active");
    step2El.classList.remove("step-active");
    step2El.classList.add("step-done");
    line2El.classList.remove("line-active");
    line2El.classList.add("line-done");
  } else if (activeStep < 3) {
    step3El.classList.add("step-pending");
  }

  // Ensure steps below active are pending
  if (activeStep < 2) step2El.classList.add("step-pending");
  if (activeStep < 1) step1El.classList.add("step-pending");
}

// ── Start analysis ────────────────────────────────────────────────────────────
async function startAnalysis() {
  startError.classList.add("hidden");
  startError.textContent = "";

  if (!receivePermissionVerified) {
    startError.textContent = PERMISSION_VERIFY_FAILED_MSG;
    startError.classList.remove("hidden");
    toast(PERMISSION_VERIFY_FAILED_MSG, "error");
    return;
  }

  if (!mayWorkflowAction(RECEIVE_SAMPLE_ACTION)) {
    startError.textContent = RECEIVE_DENIED_MSG;
    startError.classList.remove("hidden");
    toast(RECEIVE_DENIED_MSG, "warn");
    return;
  }

  const { valid, errors } = validateForm();
  if (!valid) {
    const msg = errors[0] ?? "Please fill in all required fields.";
    startError.textContent = msg;
    startError.classList.remove("hidden");
    toast(msg, "warn");
    return;
  }

  // Revalidate readiness before submitting
  const isFGSubmit = currentSampleType === "FG_BATCH";
  const isPMSubmit = currentSampleType === "PM_LOT";
  const readinessOkFlag = isFGSubmit
    ? fgReadiness.ok
    : isPMSubmit
      ? pmReadiness.ok
      : rmReadiness.ok;
  if (!readinessOkFlag) {
    const msg = isFGSubmit
      ? "FG readiness not validated. Please recheck product-group protocol and base spec."
      : isPMSubmit
        ? "PM readiness not validated. Please recheck packing-material subcategory protocol and base spec."
        : "RM readiness not validated. Please recheck inventory-group protocol and base spec.";
    startError.textContent = msg;
    startError.classList.remove("hidden");
    toast(msg, "warn");
    return;
  }

  // Set loading state on button
  startAnalysisBtn.classList.add("loading");
  startAnalysisBtn.disabled = true;

  try {
    const params = buildRpcParams();

    const { data, error } = await labSupabase.rpc(
      "fn_receive_sample_and_create_analysis",
      params,
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.analysis_id) {
      throw new Error(
        "Server did not return an analysis_id. Please contact support.",
      );
    }

    createdAnalysis = result;
    toast("Analysis created successfully!", "success", 4000);
    showCreatedState(result);
  } catch (err) {
    console.error("[lab-analysis-entry] startAnalysis error:", err);
    const msg = err.message ?? "An unexpected error occurred.";
    startError.textContent = msg;
    startError.classList.remove("hidden");
    toast(`Failed to create analysis: ${msg}`, "error");
    startAnalysisBtn.classList.remove("loading");
    startAnalysisBtn.disabled = false;
  }
}

function buildRpcParams() {
  const isFG = currentSampleType === "FG_BATCH";
  return {
    p_user_id: currentUserId,
    p_analysis_subject_type:
      currentSampleType === "FG_BATCH"
        ? "FG_BATCH"
        : currentSampleType === "PM_LOT"
          ? "PM_LOT"
          : "RM_LOT",
    p_product_id: isFG ? productSelect.value || null : null,
    p_batch_no_snapshot: isFG ? batchNoSelect.value || null : null,
    p_stock_item_id: !isFG ? stockItemSelect.value || null : null,
    p_system_lot_no: null,
    p_sample_received_date: sampleDate.value || null,
    p_physical_register_ref: physRegRef.value.trim() || null,
    p_analysed_by_staff_id: analysedBy.value || null,
    p_person_in_charge_staff_id: personInCharge.value || null,
    p_remarks: remarks.value.trim() || null,
  };
}

// ── Show created state ────────────────────────────────────────────────────────
function showCreatedState(result) {
  const analysisId = result.analysis_id ?? "—";
  const analysisNo = result.analysis_register_no ?? "—";
  const status = result.status ?? "Draft";
  const typeLabel =
    currentSampleType === "FG_BATCH"
      ? "FG Batch"
      : currentSampleType === "PM_LOT"
        ? "PM Lot"
        : "RM Lot";
  const itemLabel =
    currentSampleType === "FG_BATCH"
      ? selectedOptionText(productSelect)
      : selectedOptionText(stockItemSelect);
  // Build detail cards
  successDetails.innerHTML = `
    <div class="sd-card">
      <div class="sd-label">Analysis ID</div>
      <div class="sd-value">${esc(String(analysisId))}</div>
    </div>
    <div class="sd-card">
      <div class="sd-label">Register No</div>
      <div class="sd-value">${esc(String(analysisNo ?? "—"))}</div>
    </div>
    <div class="sd-card">
      <div class="sd-label">Sample Type</div>
      <div class="sd-value">${esc(typeLabel)}</div>
    </div>
    <div class="sd-card">
      <div class="sd-label">${currentSampleType === "FG_BATCH" ? "Item / Ref No" : "Item"}</div>
      <div class="sd-value">${currentSampleType === "FG_BATCH" ? `${esc(itemLabel)} &mdash; ${esc(batchNoSelect.value)}` : esc(itemLabel)}</div>
    </div>
    ${
      currentSampleType !== "FG_BATCH"
        ? `
    <div class="sd-card">
      <div class="sd-label">Lot No</div>
      <div class="sd-value" style="font-style:italic;color:var(--color-text-muted,#666);">Auto-generated</div>
    </div>`
        : ""
    }
    <div class="sd-card">
      <div class="sd-label">Status</div>
      <div class="sd-value">${esc(formatStatus(status))}</div>
    </div>
    <div class="sd-card">
      <div class="sd-label">Protocol Category</div>
      <div class="sd-value">${esc(
        currentSampleType === "FG_BATCH"
          ? (fgReadiness.protocolName ?? "—")
          : currentSampleType === "PM_LOT"
            ? (pmReadiness.protocolName ?? "—")
            : (rmReadiness.protocolName ?? "—"),
      )}</div>
    </div>
    ${
      currentSampleType === "FG_BATCH" && fgReadiness.productGroupName
        ? `
    <div class="sd-card">
      <div class="sd-label">Product Group</div>
      <div class="sd-value">${esc(fgReadiness.productGroupName)}</div>
    </div>`
        : ""
    }
    ${
      currentSampleType === "PM_LOT" && pmReadiness.subcategoryLabel
        ? `
    <div class="sd-card">
      <div class="sd-label">Packing Material Subcategory</div>
      <div class="sd-value">${esc(pmReadiness.subcategoryLabel)}</div>
    </div>`
        : ""
    }
    ${
      currentSampleType === "RM_LOT" && rmReadiness.invGroupLabel
        ? `
    <div class="sd-card">
      <div class="sd-label">Inventory Group</div>
      <div class="sd-value">${esc(rmReadiness.invGroupLabel)}</div>
    </div>`
        : ""
    }
  `;

  // Hide main card, show success panel
  $("mainCard").classList.add("hidden");
  successPanel.classList.remove("hidden");

  // Scroll success panel into view
  successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Reset form ────────────────────────────────────────────────────────────────
function resetForm() {
  // Reset state
  currentSampleType = null;
  createdAnalysis = null;

  // Reset type pills
  typePills.querySelectorAll(".type-pill").forEach((p) => {
    p.classList.remove("active");
    p.setAttribute("aria-pressed", "false");
  });

  // Reset selects & inputs
  productSelect.value = "";
  populateFgBatchDropdown(null);
  stockItemSelect.value = "";
  syncSearchInputFromSelect(productSelect);
  syncSearchInputFromSelect(stockItemSelect);
  systemLotNo.value = "";
  sampleDate.value = todayISO();
  physRegRef.value = "";
  analysedBy.value = "";
  personInCharge.value = "";
  remarks.value = "";

  // Re-apply staff defaults after reset
  applyDefaultStaffSelections(); // fire-and-forget — avoids blocking reset UI

  // Clear validation
  clearAllFieldErrors();
  startError.classList.add("hidden");
  startError.textContent = "";

  // Hide dynamic sections
  fgFields.classList.add("hidden");
  rmFields.classList.add("hidden");
  commonFields.classList.add("hidden");
  readinessSection.classList.add("hidden");
  formActionsBar.classList.add("hidden");
  clearMappingState();
  closeMobileFieldDrawer();
  if (receiptDetailsBtn) {
    receiptDetailsBtn.classList.add("hidden");
    receiptDetailsBtn.classList.remove("is-complete");
  }
  if (receiptDetailsSub) {
    receiptDetailsSub.textContent = "Select a sample type to continue";
  }

  // Show main card / hide success panel
  $("mainCard").classList.remove("hidden");
  successPanel.classList.add("hidden");

  // Reset step to 1
  setStepActive(1);

  // Scroll back to top
  $("pageScroll").scrollTop = 0;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(url) {
  if (
    typeof Platform !== "undefined" &&
    typeof Platform.navigate === "function"
  ) {
    Platform.navigate(url);
  } else {
    window.location.href = url;
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(message, kind = "info", duration = 3500) {
  if (!labToastContainer) return;
  const el = document.createElement("div");
  el.className = `lab-toast toast-${kind}`;
  el.textContent = message;
  labToastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, duration);
}

// ── Status area ───────────────────────────────────────────────────────────────
function setStatusLoading(message) {
  statusArea.setAttribute("data-type", "loading");
  statusArea.innerHTML = `<div class="spinner"></div><span>${esc(message)}</span>`;
  statusArea.style.display = "flex";
}

function setStatusError(message) {
  statusArea.setAttribute("data-type", "error");
  statusArea.textContent = message;
}

function clearStatus() {
  statusArea.removeAttribute("data-type");
  statusArea.textContent = "";
  statusArea.style.display = "none";
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function selectedSampleDate() {
  return sampleDate.value || todayISO();
}

function getSelectedItemId() {
  if (!currentSampleType) return null;
  return currentSampleType === "FG_BATCH"
    ? productSelect.value || null
    : stockItemSelect.value || null;
}

function selectedOptionText(selectEl) {
  const opt = selectEl.options[selectEl.selectedIndex];
  return opt ? opt.text : "—";
}

function getSearchBindingForSelect(selectEl) {
  if (!selectEl) return null;
  if (selectEl.id === "productSelect") {
    return { input: productSearchInput, datalist: productSearchList };
  }
  if (selectEl.id === "batchNoSelect") {
    return { input: batchSearchInput, datalist: batchSearchList };
  }
  if (selectEl.id === "stockItemSelect") {
    return { input: stockItemSearchInput, datalist: stockItemSearchList };
  }
  return null;
}

function rebuildSearchListFromSelect(selectEl) {
  const binding = getSearchBindingForSelect(selectEl);
  if (!binding?.datalist) return;
  binding.datalist.innerHTML = "";
  Array.from(selectEl.options).forEach((opt) => {
    if (!opt.value) return;
    const datalistOpt = document.createElement("option");
    datalistOpt.value = opt.textContent ?? "";
    binding.datalist.appendChild(datalistOpt);
  });
}

function syncSearchInputFromSelect(selectEl) {
  const binding = getSearchBindingForSelect(selectEl);
  if (!binding?.input) return;
  const opt = selectEl.options[selectEl.selectedIndex];
  binding.input.value = selectEl.value ? (opt?.text ?? "") : "";
  binding.input.disabled = !!selectEl.disabled;
}

function syncSearchUiForSelect(selectEl) {
  rebuildSearchListFromSelect(selectEl);
  syncSearchInputFromSelect(selectEl);
}

function findOptionByLabel(selectEl, labelText) {
  const needle = String(labelText ?? "")
    .trim()
    .toLowerCase();
  if (!needle) return null;
  return (
    Array.from(selectEl.options).find(
      (o) =>
        !!o.value &&
        String(o.textContent ?? "")
          .trim()
          .toLowerCase() === needle,
    ) ?? null
  );
}

function bindSearchInputToSelect(inputEl, selectEl, msgEl) {
  if (!inputEl || !selectEl) return;

  const applyInput = (strict) => {
    const typed = String(inputEl.value ?? "").trim();
    if (!typed) {
      if (selectEl.value) {
        selectEl.value = "";
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        syncSearchInputFromSelect(selectEl);
      }
      clearFieldError(inputEl, msgEl);
      return;
    }

    const match = findOptionByLabel(selectEl, typed);

    if (match) {
      if (selectEl.value !== match.value) {
        selectEl.value = match.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        syncSearchInputFromSelect(selectEl);
      }
      clearFieldError(inputEl, msgEl);
      return;
    }

    if (strict && selectEl.value) {
      syncSearchInputFromSelect(selectEl);
    }
  };

  inputEl.addEventListener("input", () => applyInput(false));
  inputEl.addEventListener("change", () => applyInput(false));
  inputEl.addEventListener("blur", () => applyInput(true));
}

function populateSelect(selectEl, rows, valueFn, labelFn, placeholder) {
  // Keep the first placeholder option
  selectEl.innerHTML = `<option value="">${esc(placeholder)}</option>`;
  rows.forEach((row) => {
    const opt = document.createElement("option");
    opt.value = valueFn(row) ?? "";
    opt.textContent = labelFn(row);
    selectEl.appendChild(opt);
  });
  syncSearchUiForSelect(selectEl);
}

function formatStatus(status) {
  const STATUS_LABELS = {
    DRAFT: "Draft",
    IN_PROGRESS: "In Progress",
    PENDING_SCRUTINY: "Pending Scrutiny",
    SCRUTINY_PASSED: "Scrutiny Passed",
    APPROVED_FOR_COA: "Approved for COA",
    COA_GENERATED: "COA Generated",
  };
  const key = String(status ?? "")
    .toUpperCase()
    .replace(/ /g, "_");
  return STATUS_LABELS[key] ?? String(status ?? "—").replace(/_/g, " ");
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init().catch((err) => {
  console.error("[lab-analysis-entry] init error:", err);
  setStatusError("Failed to initialise the page. Please refresh.");
});
