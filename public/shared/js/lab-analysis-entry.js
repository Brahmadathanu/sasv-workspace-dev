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
 *   fn_build_effective_rm_spec_for_item(
 *     p_stock_item_id,             -- uuid
 *     p_as_of_date,                -- date  (ISO string YYYY-MM-DD)
 *     p_remarks                    -- text
 *   )
 *   Returns: scalar spec_profile_id (bigint)
 *
 *   fn_receive_sample_and_create_analysis(
 *     p_user_id,                   -- uuid
 *     p_analysis_subject_type,     -- 'FG_BATCH' | 'RM_LOT'
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
 *             → eff. spec  (fn_build_effective_rm_spec_for_item)
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
const fgFields = $("fgFields");
const rmFields = $("rmFields");
const commonFields = $("commonFields");
const readinessSection = $("readinessSection");
const formActionsBar = $("formActionsBar");

const productSelect = $("productSelect");
const batchNoSelect = $("batchNoSelect");
const batchSizeDisplay = $("batchSizeDisplay");
const batchUomDisplay = $("batchUomDisplay");
const stockItemSelect = $("stockItemSelect");
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
let currentSampleType = null; // "FG_BATCH" | "RM_LOT"
let createdAnalysis = null; // result from fn_receive_sample_and_create_analysis
let currentUserId = null;
let fgBatchRows = []; // rows from v_sample_receipt_fg_batch_picker
let mappingCheckDebounceTimer = null;
let pendingSwitchType = null; // type pill click queued pending confirmation

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

// ── Entry point ───────────────────────────────────────────────────────────────
async function init() {
  // Get current session
  const { data: sessionData } = await supabase.auth.getSession();
  currentUserId = sessionData?.session?.user?.id ?? null;

  if (!currentUserId) {
    setStatusError("Session expired. Please log in again.");
    startAnalysisBtn.disabled = true;
    return;
  }

  // Default sample date to today
  sampleDate.value = todayISO();

  // Wire all events first (so UI responds even while pickers are loading)
  wireEvents();

  // Load pickers
  await loadPickers();
}

// ── Pickers ───────────────────────────────────────────────────────────────────
async function loadPickers() {
  setStatusLoading("Loading pickers…");

  try {
    const [fgRes, rmRes, staffRes] = await Promise.all([
      labSupabase
        .from("v_sample_receipt_fg_picker")
        .select("product_id, product_name")
        .order("product_name"),
      labSupabase
        .from("v_rm_pm_item_with_group")
        .select("stock_item_id, stock_item_name")
        .eq("category_code", "RM")
        .order("stock_item_name"),
      labSupabase
        .from("v_sample_receipt_staff_picker")
        .select("staff_id, full_name, designation, is_analyst, is_pic")
        .order("full_name"),
    ]);

    if (fgRes.error) throw new Error(`FG picker: ${fgRes.error.message}`);
    if (rmRes.error) throw new Error(`RM picker: ${rmRes.error.message}`);
    if (staffRes.error)
      throw new Error(`Staff picker: ${staffRes.error.message}`);

    // Load FG batch rows separately — non-blocking so a missing view doesn't
    // break the rest of the form.
    try {
      const fgBatchRes = await labSupabase
        .from("v_sample_receipt_fg_batch_picker")
        .select("bmr_id, product_id, batch_no, batch_size, uom")
        .order("batch_no");
      if (!fgBatchRes.error) fgBatchRows = fgBatchRes.data ?? [];
    } catch {
      // view not yet deployed — FG batch dropdown will show no options
    }

    // Populate FG product dropdown
    populateSelect(
      productSelect,
      fgRes.data ?? [],
      (r) => r.product_id,
      (r) => r.product_name,
      "— Select Product —",
    );

    // Populate RM raw material dropdown
    populateSelect(
      stockItemSelect,
      rmRes.data ?? [],
      (r) => r.stock_item_id,
      (r) => r.stock_item_name,
      "— Select Raw Material —",
    );

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

    clearStatus();
  } catch (err) {
    console.error("[lab-analysis-entry] loadPickers error:", err);
    setStatusError(
      `Could not load form data: ${err.message}. Please refresh the page.`,
    );
  }
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
  // Home navigation
  homeBtn.addEventListener("click", () => Platform.goHome());

  // Sample type pills — dirty-form guard
  typePills.querySelectorAll(".type-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const type = pill.dataset.type;
      if (!type || type === currentSampleType) return;
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

  // Product change → repopulate FG batch dropdown; protocol check deferred to batch selection
  productSelect.addEventListener("change", () => {
    populateFgBatchDropdown(productSelect.value);
    clearFieldError(batchNoSelect, batchSelectMsg);
    clearMappingState();
  });

  // Batch No dropdown → populate read-only fields + trigger mapping check
  batchNoSelect.addEventListener("change", () => {
    const opt = batchNoSelect.options[batchNoSelect.selectedIndex];
    if (batchNoSelect.value && opt) {
      batchSizeDisplay.value = opt.dataset.batchSize ?? "";
      batchUomDisplay.value = opt.dataset.uom ?? "";
      clearFieldError(batchNoSelect, batchSelectMsg);
      if (productSelect.value) scheduleProtocolCheck();
    } else {
      batchSizeDisplay.value = "";
      batchUomDisplay.value = "";
      clearMappingState();
    }
    updateStartButton();
  });

  // Stock item change → trigger mapping check
  stockItemSelect.addEventListener("change", () => {
    clearMappingState();
    if (stockItemSelect.value) scheduleProtocolCheck();
  });

  // Blur-validate required fields
  systemLotNo.addEventListener("blur", () =>
    validateField(systemLotNo, lotMsg, "System Lot No is required"),
  );
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
  systemLotNo.value = "";
  physRegRef.value = "";
  remarks.value = "";
  clearAllFieldErrors();
  startError.classList.add("hidden");
  startError.textContent = "";
  clearMappingState();
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
  } else {
    await checkRmReadiness(selectedId);
  }

  updateStartButton();
}

// ── FG readiness check (product-group level) ──────────────────────────────────
// Validates: product → product group → active protocol → active base spec
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

    // Step 3: check active FG base spec for the product group
    const { data: smRows, error: smErr } = await labSupabase
      .from("spec_profile_product_group_map")
      .select("spec_profile_id")
      .eq("product_group_id", grp.product_group_id)
      .eq("is_active", true)
      .limit(1);

    if (smErr) throw smErr;

    const specProfileId = smRows?.[0]?.spec_profile_id ?? null;
    if (!specProfileId) {
      showFgNotReady(
        "No active FG base specification exists for this product group.",
        "Please generate a base spec in the Spec Profile Manager before starting analysis.",
      );
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

    // FG preview: build effective spec from product, not raw protocol
    testPreview.classList.remove("hidden");
    await loadFgEffectiveSpecPreview(productId);
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
async function checkRmReadiness(stockItemId) {
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
      .limit(1);
    if (grpErr) throw grpErr;

    mappingLoading.classList.add("hidden");

    const grp = grpData?.[0];
    if (!grp?.inv_group_id) {
      showRmNotReady(
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
      showRmNotReady(
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
      showRmNotReady(
        "No active RM base specification exists for this inventory group.",
        "Please generate a base spec in the Spec Profile Manager before starting analysis.",
      );
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
    await loadRmEffectiveSpecPreview(stockItemId);
  } catch (err) {
    console.error("[lab-analysis-entry] checkRmReadiness error:", err);
    mappingLoading.classList.add("hidden");
    showRmNotReady("RM readiness check failed: " + err.message, "");
    toast("RM readiness check failed: " + err.message, "error");
  }
}

function showRmNotReady(labelMsg, subMsg) {
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
function populateFgBatchDropdown(productId) {
  batchSizeDisplay.value = "";
  batchUomDisplay.value = "";

  if (!productId) {
    batchNoSelect.innerHTML =
      '<option value="">— Select Product first —</option>';
    batchNoSelect.disabled = true;
    return;
  }

  const rows = fgBatchRows.filter(
    (r) => String(r.product_id) === String(productId),
  );

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
}

// ── FG effective-spec preview ─────────────────────────────────────────────────
// Calls fn_build_effective_fg_spec_for_product and shows active spec lines.
async function loadFgEffectiveSpecPreview(productId) {
  testPreviewLoading.classList.remove("hidden");
  testPreviewEmpty.classList.add("hidden");
  testPreviewTbody.innerHTML = "";

  try {
    const { data: rpcData, error: rpcErr } = await labSupabase.rpc(
      "fn_build_effective_fg_spec_for_product",
      {
        p_product_id: Number(productId),
        p_as_of_date: todayISO(),
        p_remarks: "Preview from analysis entry",
      },
    );
    if (rpcErr) throw rpcErr;

    const resolvedProfileId = Number(rpcData);
    if (!resolvedProfileId) {
      testPreviewLoading.classList.add("hidden");
      testPreviewEmpty.textContent =
        "No effective spec could be resolved for this product.";
      testPreviewEmpty.classList.remove("hidden");
      return;
    }

    const { data: lines, error: linesErr } = await labSupabase
      .from("v_spec_profile_detail")
      .select(
        "seq_no, test_name, method_name, display_text, spec_line_is_active",
      )
      .eq("spec_profile_id", resolvedProfileId)
      .eq("spec_line_is_active", true)
      .order("seq_no");
    if (linesErr) throw linesErr;

    testPreviewLoading.classList.add("hidden");

    const rows = lines ?? [];
    if (rows.length === 0) {
      testPreviewEmpty.textContent =
        "Effective spec resolved but has no active lines.";
      testPreviewEmpty.classList.remove("hidden");
      return;
    }

    testPreviewToggleLabel.textContent = `Show Effective Spec (${rows.length} active lines)`;

    const frag = document.createDocumentFragment();
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="pt-seq">${esc(String(r.seq_no ?? ""))}</td>
        <td>${esc(r.test_name ?? "—")}</td>
        <td>${esc(r.method_name ?? "—")}</td>
        <td class="pt-spec">${esc(r.display_text ?? "—")}</td>
      `;
      frag.appendChild(tr);
    });
    testPreviewTbody.appendChild(frag);
  } catch (err) {
    console.error(
      "[lab-analysis-entry] loadFgEffectiveSpecPreview error:",
      err,
    );
    testPreviewLoading.classList.add("hidden");
    testPreviewEmpty.textContent = `Could not load effective spec preview: ${err.message}`;
    testPreviewEmpty.classList.remove("hidden");
  }
}

// ── RM effective-spec preview ─────────────────────────────────────────────────
// Calls fn_build_effective_rm_spec_for_item and shows active spec lines.
async function loadRmEffectiveSpecPreview(stockItemId) {
  testPreviewLoading.classList.remove("hidden");
  testPreviewEmpty.classList.add("hidden");
  testPreviewTbody.innerHTML = "";

  try {
    const { data: rpcData, error: rpcErr } = await labSupabase.rpc(
      "fn_build_effective_rm_spec_for_item",
      {
        p_stock_item_id: stockItemId,
        p_as_of_date: todayISO(),
        p_remarks: "Preview from analysis entry",
      },
    );
    if (rpcErr) throw rpcErr;

    const resolvedProfileId = rpcData ? Number(rpcData) : null;
    if (!resolvedProfileId) {
      testPreviewLoading.classList.add("hidden");
      testPreviewEmpty.textContent =
        "No effective RM spec could be resolved for this stock item.";
      testPreviewEmpty.classList.remove("hidden");
      return;
    }

    const { data: lines, error: linesErr } = await labSupabase
      .from("v_spec_profile_detail")
      .select(
        "seq_no, test_name, method_name, display_text, spec_line_is_active",
      )
      .eq("spec_profile_id", resolvedProfileId)
      .eq("spec_line_is_active", true)
      .order("seq_no");
    if (linesErr) throw linesErr;

    testPreviewLoading.classList.add("hidden");

    const rows = lines ?? [];
    if (rows.length === 0) {
      testPreviewEmpty.textContent =
        "Effective RM spec resolved but has no active lines.";
      testPreviewEmpty.classList.remove("hidden");
      return;
    }

    testPreviewToggleLabel.textContent =
      "Show Effective RM Spec (" + rows.length + " active lines)";

    const frag = document.createDocumentFragment();
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="pt-seq">' +
        esc(String(r.seq_no ?? "")) +
        "</td>" +
        "<td>" +
        esc(r.test_name ?? "—") +
        "</td>" +
        "<td>" +
        esc(r.method_name ?? "—") +
        "</td>" +
        '<td class="pt-spec">' +
        esc(r.display_text ?? "—") +
        "</td>";
      frag.appendChild(tr);
    });
    testPreviewTbody.appendChild(frag);
  } catch (err) {
    console.error(
      "[lab-analysis-entry] loadRmEffectiveSpecPreview error:",
      err,
    );
    testPreviewLoading.classList.add("hidden");
    testPreviewEmpty.textContent =
      "Could not load RM effective spec preview: " + err.message;
    testPreviewEmpty.classList.remove("hidden");
  }
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
      setFieldError(productSelect, productMsg, "Product is required");
      errors.push("Product is required");
    }
    if (!batchNoSelect.value) {
      setFieldError(batchNoSelect, batchSelectMsg, "Batch No is required");
      errors.push("Batch No is required");
    }
  }

  if (currentSampleType === "RM_LOT") {
    if (!stockItemSelect.value) {
      setFieldError(stockItemSelect, stockItemMsg, "Raw Material is required");
      errors.push("Raw Material is required");
    }
    if (!systemLotNo.value.trim()) {
      setFieldError(systemLotNo, lotMsg, "System Lot No is required");
      errors.push("System Lot No is required");
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
  } else if (currentSampleType === "RM_LOT" && !rmReadiness.ok) {
    errors.push(
      "RM readiness check has not passed. A protocol and base spec are required at inventory-group level.",
    );
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
    [productSelect, productMsg],
    [batchNoSelect, batchSelectMsg],
    [stockItemSelect, stockItemMsg],
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
  const mappingReady = isFG ? fgReadiness.ok : rmReadiness.ok;

  const canStart = !!(
    currentSampleType &&
    mappingReady &&
    (isFG
      ? productSelect.value && batchNoSelect.value
      : stockItemSelect.value && systemLotNo.value.trim()) &&
    sampleDate.value &&
    physRegRef.value.trim() &&
    analysedBy.value &&
    personInCharge.value
  );
  startAnalysisBtn.disabled = !canStart;

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
  const readinessOk = isFGSubmit ? fgReadiness.ok : rmReadiness.ok;
  if (!readinessOk) {
    const msg = isFGSubmit
      ? "FG readiness not validated. Please recheck product-group protocol and base spec."
      : "Protocol mapping not validated. Please recheck.";
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
    p_analysis_subject_type: isFG ? "FG_BATCH" : "RM_LOT",
    p_product_id: isFG ? productSelect.value || null : null,
    p_batch_no_snapshot: isFG ? batchNoSelect.value || null : null,
    p_stock_item_id: !isFG ? stockItemSelect.value || null : null,
    p_system_lot_no: !isFG ? systemLotNo.value.trim() || null : null,
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
  const typeLabel = currentSampleType === "FG_BATCH" ? "FG Batch" : "RM Lot";
  const itemLabel =
    currentSampleType === "FG_BATCH"
      ? selectedOptionText(productSelect)
      : selectedOptionText(stockItemSelect);
  const refNo =
    currentSampleType === "FG_BATCH"
      ? batchNoSelect.value
      : systemLotNo.value.trim();

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
      <div class="sd-label">Item / Ref No</div>
      <div class="sd-value">${esc(itemLabel)} &mdash; ${esc(refNo)}</div>
    </div>
    <div class="sd-card">
      <div class="sd-label">Status</div>
      <div class="sd-value">${esc(formatStatus(status))}</div>
    </div>
    <div class="sd-card">
      <div class="sd-label">Protocol Category</div>
      <div class="sd-value">${esc(currentSampleType === "FG_BATCH" ? (fgReadiness.protocolName ?? "—") : (rmReadiness.protocolName ?? "—"))}</div>
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

function populateSelect(selectEl, rows, valueFn, labelFn, placeholder) {
  // Keep the first placeholder option
  selectEl.innerHTML = `<option value="">${esc(placeholder)}</option>`;
  rows.forEach((row) => {
    const opt = document.createElement("option");
    opt.value = valueFn(row) ?? "";
    opt.textContent = labelFn(row);
    selectEl.appendChild(opt);
  });
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
