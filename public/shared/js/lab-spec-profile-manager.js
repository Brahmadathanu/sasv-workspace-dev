/**
 * lab-spec-profile-manager.js
 * Tabbed Spec Profile Manager: Base Spec | Overrides | Effective Preview
 * FG: group-level base specs, product-level overrides and effective preview
 * RM: inventory-group base specs, stock-item overrides, effective preview
 * PM: inventory-group base specs, stock-item overrides, effective preview
 */

import { supabase, labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const homeBtn = document.getElementById("homeBtn");
const subjectPills = document.getElementById("subjectPills");
const tabStrip = document.getElementById("tabStrip");

// Tab buttons
const reviewQueueTab = document.getElementById("reviewQueueTab");
const baseSpecTab = document.getElementById("baseSpecTab");
const overridesTab = document.getElementById("overridesTab");
const effectivePreviewTab = document.getElementById("effectivePreviewTab");
const reviewQueueTabBadge = document.getElementById("reviewQueueTabBadge");

// Tab panels
const reviewQueuePanel = document.getElementById("reviewQueuePanel");
const baseSpecPanel = document.getElementById("baseSpecPanel");
const overridesPanel = document.getElementById("overridesPanel");
const effectivePreviewPanel = document.getElementById("effectivePreviewPanel");

const rqTotalPending = document.getElementById("rqTotalPending");
const rqFamilyPending = document.getElementById("rqFamilyPending");
const rqProductPending = document.getElementById("rqProductPending");
const rqOverduePending = document.getElementById("rqOverduePending");
const rqRefreshBtn = document.getElementById("rqRefreshBtn");
const rqSubjectFilter = document.getElementById("rqSubjectFilter");
const rqScopeFilter = document.getElementById("rqScopeFilter");
const rqSearchInput = document.getElementById("rqSearchInput");
const rqLineCount = document.getElementById("rqLineCount");
const reviewQueueTableBody = document.getElementById("reviewQueueTableBody");

// BASE SPEC tab
const bsFgCard = document.getElementById("bsFgCard");
const bsRmCard = document.getElementById("bsRmCard");
const rmControlCard = document.getElementById("rmControlCard");
const rmTableCard = document.getElementById("rmTableCard");
const pgProductSearchInput = document.getElementById("pgProductSearchInput");
const pgProductSearchResults = document.getElementById(
  "pgProductSearchResults",
);
const productGroupSelect = document.getElementById("productGroupSelect");
const bsContextStrip = document.getElementById("bsContextStrip");
const bsProtocolName = document.getElementById("bsProtocolName");
const bsBaseSpecName = document.getElementById("bsBaseSpecName");
const bsBaseSpecVersion = document.getElementById("bsBaseSpecVersion");
const bsControlCard = document.getElementById("bsControlCard");
const bsMetaProfileId = document.getElementById("bsMetaProfileId");
const bsMetaVersion = document.getElementById("bsMetaVersion");
const bsMetaEffDate = document.getElementById("bsMetaEffDate");
const bsGenerateSpecBtn = document.getElementById("bsGenerateSpecBtn");
const bsRebuildSpecBtn = document.getElementById("bsRebuildSpecBtn");
const bsBanner = document.getElementById("bsBanner");
const bsTableCard = document.getElementById("bsTableCard");
const bsTableBody = document.getElementById("bsTableBody");
const bsLineCount = document.getElementById("bsLineCount");
const bsPendingFamilyBtn = document.getElementById("bsPendingFamilyBtn");
const rmPendingFamilyBtn = document.getElementById("rmPendingFamilyBtn");
const pmPendingFamilyBtn = document.getElementById("pmPendingFamilyBtn");
const bsSaveSpecBtn = document.getElementById("bsSaveSpecBtn");
const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
const rmRebuildSpecBtn = document.getElementById("rmRebuildSpecBtn");
const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
const pmRebuildSpecBtn = document.getElementById("pmRebuildSpecBtn");

const rebuildModal = document.getElementById("rebuildModal");
const rebuildModalClose = document.getElementById("rebuildModalClose");
const rebuildCancelBtn = document.getElementById("rebuildCancelBtn");
const rebuildModalContext = document.getElementById("rebuildModalContext");
const rebuildSafeBtn = document.getElementById("rebuildSafeBtn");
const rebuildFullResetBtn = document.getElementById("rebuildFullResetBtn");

// OVERRIDES tab
const ovFgCard = document.getElementById("ovFgCard");
const ovRmCard = document.getElementById("ovRmCard");
const ovProductSearchInput = document.getElementById("ovProductSearchInput");
const ovProductSearchResults = document.getElementById(
  "ovProductSearchResults",
);
const ovProductSelect = document.getElementById("ovProductSelect");
const ovFgContextStrip = document.getElementById("ovFgContextStrip");
const ovFgGroupName = document.getElementById("ovFgGroupName");
const ovFgBaseSpecId = document.getElementById("ovFgBaseSpecId");
const ovBanner = document.getElementById("ovBanner");
const ovTableCard = document.getElementById("ovTableCard");
const ovTableBody = document.getElementById("ovTableBody");
const ovLineCount = document.getElementById("ovLineCount");
const ovPendingProductBtn = document.getElementById("ovPendingProductBtn");
// RM Overrides
const ovRmItemSelect = document.getElementById("ovRmItemSelect");
const ovRmContextStrip = document.getElementById("ovRmContextStrip");
const ovRmGroupName = document.getElementById("ovRmGroupName");
const ovRmBaseSpecId = document.getElementById("ovRmBaseSpecId");
const ovRmBanner = document.getElementById("ovRmBanner");
const ovRmTableCard = document.getElementById("ovRmTableCard");
const ovRmTableBody = document.getElementById("ovRmTableBody");
const ovRmLineCount = document.getElementById("ovRmLineCount");
const ovRmPendingProductBtn = document.getElementById("ovRmPendingProductBtn");

// EFFECTIVE PREVIEW tab
const epFgCard = document.getElementById("epFgCard");
const epRmCard = document.getElementById("epRmCard");
const epProductSearchInput = document.getElementById("epProductSearchInput");
const epProductSearchResults = document.getElementById(
  "epProductSearchResults",
);
const epProductSelect = document.getElementById("epProductSelect");
const epBanner = document.getElementById("epBanner");
const epTableCard = document.getElementById("epTableCard");
const epTableBody = document.getElementById("epTableBody");
const epLineCount = document.getElementById("epLineCount");
// RM Effective Preview
const epRmItemSelect = document.getElementById("epRmItemSelect");
const epRmBanner = document.getElementById("epRmBanner");
const epRmTableCard = document.getElementById("epRmTableCard");
const epRmTableBody = document.getElementById("epRmTableBody");
const epRmLineCount = document.getElementById("epRmLineCount");

// PM Base Spec
const bsPmCard = document.getElementById("bsPmCard");
const pmControlCard = document.getElementById("pmControlCard");
const pmTableCard = document.getElementById("pmTableCard");
// PM Overrides
const ovPmCard = document.getElementById("ovPmCard");
const ovPmItemSelect = document.getElementById("ovPmItemSelect");
const ovPmContextStrip = document.getElementById("ovPmContextStrip");
const ovPmGroupName = document.getElementById("ovPmGroupName");
const ovPmBaseSpecId = document.getElementById("ovPmBaseSpecId");
const ovPmBanner = document.getElementById("ovPmBanner");
const ovPmTableCard = document.getElementById("ovPmTableCard");
const ovPmTableBody = document.getElementById("ovPmTableBody");
const ovPmLineCount = document.getElementById("ovPmLineCount");
const ovPmPendingProductBtn = document.getElementById("ovPmPendingProductBtn");

const specRequestReviewModal = document.getElementById(
  "specRequestReviewModal",
);
const specRequestReviewTitle = document.getElementById(
  "specRequestReviewTitle",
);
const specRequestReviewContext = document.getElementById(
  "specRequestReviewContext",
);
const specRequestReviewClose = document.getElementById(
  "specRequestReviewClose",
);
const specRequestReviewList = document.getElementById("specRequestReviewList");
const specRequestReviewDetail = document.getElementById(
  "specRequestReviewDetail",
);
const specRequestReviewRemarks = document.getElementById(
  "specRequestReviewRemarks",
);
const specRequestReviewCancel = document.getElementById(
  "specRequestReviewCancel",
);
const specRequestRejectBtn = document.getElementById("specRequestRejectBtn");
const specRequestApproveBtn = document.getElementById("specRequestApproveBtn");
// PM Effective Preview
const epPmCard = document.getElementById("epPmCard");
const epPmItemSelect = document.getElementById("epPmItemSelect");
const epPmBanner = document.getElementById("epPmBanner");
const epPmTableCard = document.getElementById("epPmTableCard");
const epPmTableBody = document.getElementById("epPmTableBody");
const epPmLineCount = document.getElementById("epPmLineCount");

// ── Module state ──────────────────────────────────────────────────────────────
let currentSubjectType = null; // "FG" | "RM" | "PM"
let currentTab = "reviewQueue"; // "reviewQueue" | "baseSpec" | "overrides" | "effectivePreview"

// FG Base spec state
let bsCurrentProfileId = null;
let bsCurrentGroupId = null;
let bsCurrentGroupName = null;
let bsEditedSpecLines = new Map(); // seqNo -> {seq_no, spec_type, min_value, max_value, text_value, display_text, is_active}
let bsLoadedRows = []; // cached rows from last bsLoadSpecLines (for re-render after modal edit)

// RM Base spec state
let rmCurrentProfileId = null;
let rmCurrentGroupId = null;
let rmCurrentGroupLabel = null;
let rmEditedSpecLines = new Map(); // seqNo -> {seq_no, spec_type, min_value, max_value, text_value, display_text, is_active}
let rmLoadedRows = [];

// PM Base spec state
let pmCurrentProfileId = null;
let pmCurrentGroupId = null;
let pmCurrentGroupLabel = null;
let pmEditedSpecLines = new Map(); // seqNo -> {seq_no, spec_type, min_value, max_value, text_value, display_text, is_active}
let pmLoadedRows = [];

let rebuildSubject = null;
let rebuildFamilyId = null;
let rebuildFamilyLabel = null;
let fullResetConfirmModal = null;
let fullResetConfirmResolve = null;

// Base Spec Line edit modal state
let bsLineCurrentSubject = null; // "FG" | "RM" | "PM"
let bsLineCurrentSeqNo = null;

// Override editor modal state
let ovModalMode = "add"; // "add" | "edit"
let ovCachedTests = null; // test_master rows (lazy-loaded, shared)
let ovModalPrefill = {}; // pre-fill values for edit mode
let ovModalUomTouched = false;
let labUomRows = null; // cached active rows from lab_uom
// Item currently selected in the overrides tab per subject:
let ovFgProductId = null;
let ovRmItemId = null;
let ovPmItemId = null;
// Override base spec tracking (populated by each override context loader)
let ovBaseSpecProfileId = null; // numeric profile id or null
let ovBaseTestIds = new Set(); // Set of test_id numbers in the active base spec
let pendingSpecRequests = [];
let activePendingReviewRequests = [];
let selectedPendingReviewRequestId = null;
let selectedPendingReviewScope = null;
let reviewQueueRows = [];

// FG product picker cache (used by searchable combobox in OV + EP tabs)
let fgProductPickerRows = [];
// Product group picker cache (used by searchable combobox in BS FG tab)
let pgPickerRows = [];

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init();

async function init() {
  applyInitialHiddenState();
  homeBtn.addEventListener("click", () => Platform.goHome());
  wireSubjectPills();
  wireTabStrip();
  wireReviewQueueEvents();
  wireBaseSpecEvents();
  wireBaseSpecRmEvents();
  wireOverridesEvents();
  wireOverridesRmEvents();
  wireEffectivePreviewEvents();
  wireEffectivePreviewRmEvents();
  wireBaseSpecPmEvents();
  wireOverridesPmEvents();
  wireEffectivePreviewPmEvents();
  wireRebuildModal();
  wireOverrideModal();
  wireFgProductSearchComboboxes();
  wireProductGroupSearchCombobox();
  wireBsLineModal();
  wirePendingSpecRequestReviewModal();
  bsSaveSpecBtn.addEventListener("click", bsSaveSpec);
}

// ── Initial hidden state ──────────────────────────────────────────────────────
// Ensures a clean neutral state on load — nothing shown until subject is chosen.
// Add new subject cards here as additional subject types (e.g. PM) are introduced.
function applyInitialHiddenState() {
  // Tab strip + all panels
  tabStrip.classList.add("hidden");
  reviewQueuePanel?.classList.add("hidden");
  baseSpecPanel.classList.add("hidden");
  overridesPanel.classList.add("hidden");
  effectivePreviewPanel.classList.add("hidden");

  // Base Spec sub-cards (FG + RM)
  bsFgCard.classList.add("hidden");
  bsRmCard.classList.add("hidden");
  bsControlCard.classList.add("hidden");
  bsTableCard.classList.add("hidden");
  document.getElementById("rmControlCard")?.classList.add("hidden");
  document.getElementById("rmTableCard")?.classList.add("hidden");

  // Overrides sub-cards (FG + RM)
  ovFgCard.classList.add("hidden");
  ovRmCard.classList.add("hidden");
  ovTableCard.classList.add("hidden");
  ovRmTableCard.classList.add("hidden");

  // Effective Preview sub-cards (FG + RM)
  epFgCard.classList.add("hidden");
  epRmCard.classList.add("hidden");
  epTableCard.classList.add("hidden");
  epRmTableCard.classList.add("hidden");

  // Base Spec sub-cards (PM)
  bsPmCard.classList.add("hidden");
  pmControlCard.classList.add("hidden");
  pmTableCard.classList.add("hidden");
  // Overrides sub-cards (PM)
  ovPmCard.classList.add("hidden");
  ovPmTableCard.classList.add("hidden");
  // Effective Preview sub-cards (PM)
  epPmCard.classList.add("hidden");
  epPmTableCard.classList.add("hidden");
}

// ── Subject pills ─────────────────────────────────────────────────────────────
function wireSubjectPills() {
  subjectPills.querySelectorAll(".type-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const type = pill.dataset.type;
      if (type === currentSubjectType) return;
      currentSubjectType = type;
      subjectPills.querySelectorAll(".type-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.type === type);
        p.setAttribute(
          "aria-pressed",
          p.dataset.type === type ? "true" : "false",
        );
      });
      handleSubjectTypeChange();
    });
  });
}

// ── Subject state reset ──────────────────────────────────────────────────────
// Clears the outgoing subject's state/controls before activating a new subject.
// Add a new branch here when PM (or other) subject types are introduced.
function resetSubjectState(toSubjectType) {
  if (toSubjectType === "FG") {
    rmResetState();
    pmResetState();

    const rmGroupSelect = document.getElementById("rmGroupSelect");
    if (rmGroupSelect) rmGroupSelect.value = "";
    ovRmItemSelect.value = "";
    epRmItemSelect.value = "";
    ovRmContextStrip.classList.add("hidden");
    hideBanner(ovRmBanner);
    ovRmTableCard.classList.add("hidden");
    hideBanner(epRmBanner);
    epRmTableCard.classList.add("hidden");

    const pmGroupSelect = document.getElementById("pmGroupSelect");
    if (pmGroupSelect) pmGroupSelect.value = "";
    ovPmItemSelect.value = "";
    epPmItemSelect.value = "";
    ovPmContextStrip.classList.add("hidden");
    hideBanner(ovPmBanner);
    ovPmTableCard.classList.add("hidden");
    hideBanner(epPmBanner);
    epPmTableCard.classList.add("hidden");
  } else if (toSubjectType === "RM") {
    bsResetState();
    pmResetState();

    productGroupSelect.value = "";
    syncPgSearchInputFromSelect();
    ovProductSelect.value = "";
    epProductSelect.value = "";
    syncFgProductSearchInputFromSelect(ovProductSelect);
    syncFgProductSearchInputFromSelect(epProductSelect);
    ovFgContextStrip.classList.add("hidden");
    hideBanner(ovBanner);
    ovTableCard.classList.add("hidden");
    hideBanner(epBanner);
    epTableCard.classList.add("hidden");

    const pmGroupSelect = document.getElementById("pmGroupSelect");
    if (pmGroupSelect) pmGroupSelect.value = "";
    ovPmItemSelect.value = "";
    epPmItemSelect.value = "";
    ovPmContextStrip.classList.add("hidden");
    hideBanner(ovPmBanner);
    ovPmTableCard.classList.add("hidden");
    hideBanner(epPmBanner);
    epPmTableCard.classList.add("hidden");
  } else if (toSubjectType === "PM") {
    bsResetState();
    rmResetState();

    productGroupSelect.value = "";
    syncPgSearchInputFromSelect();
    ovProductSelect.value = "";
    epProductSelect.value = "";
    syncFgProductSearchInputFromSelect(ovProductSelect);
    syncFgProductSearchInputFromSelect(epProductSelect);
    ovFgContextStrip.classList.add("hidden");
    hideBanner(ovBanner);
    ovTableCard.classList.add("hidden");
    hideBanner(epBanner);
    epTableCard.classList.add("hidden");

    const rmGroupSelect = document.getElementById("rmGroupSelect");
    if (rmGroupSelect) rmGroupSelect.value = "";
    ovRmItemSelect.value = "";
    epRmItemSelect.value = "";
    ovRmContextStrip.classList.add("hidden");
    hideBanner(ovRmBanner);
    ovRmTableCard.classList.add("hidden");
    hideBanner(epRmBanner);
    epRmTableCard.classList.add("hidden");
  }
}

function handleSubjectTypeChange() {
  resetSubjectState(currentSubjectType);
  tabStrip.classList.remove("hidden");
  switchTab(currentTab, true);
}

// ── Tab strip ─────────────────────────────────────────────────────────────────
function wireTabStrip() {
  [reviewQueueTab, baseSpecTab, overridesTab, effectivePreviewTab].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId, forceRefresh = false) {
  if (tabId === currentTab && !forceRefresh) return;
  currentTab = tabId;

  // Update tab buttons
  [reviewQueueTab, baseSpecTab, overridesTab, effectivePreviewTab].forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Show/hide panels
  reviewQueuePanel?.classList.toggle("hidden", tabId !== "reviewQueue");
  baseSpecPanel.classList.toggle("hidden", tabId !== "baseSpec");
  overridesPanel.classList.toggle("hidden", tabId !== "overrides");
  effectivePreviewPanel.classList.toggle(
    "hidden",
    tabId !== "effectivePreview",
  );

  // Enforce subject-specific visibility for ALL sub-cards in ALL tabs.
  //
  // Selector cards (top pickers) are fully deterministic — show/hide based on
  // tab + subject combination.
  //
  // Data cards (control meta, tables) are only HIDDEN when the context is wrong
  // (wrong tab or wrong subject). When the context is correct they are left
  // untouched so the state set by data-loading functions is preserved. This
  // prevents the "card disappears on tab-switch and never comes back" problem.
  const isFG = currentSubjectType === "FG";
  const isRM = currentSubjectType === "RM";
  const isPM = currentSubjectType === "PM";
  const isRQ = tabId === "reviewQueue";
  const isBS = tabId === "baseSpec";
  const isOV = tabId === "overrides";
  const isEP = tabId === "effectivePreview";

  // ── Selector cards (fully deterministic) ─────────────────────────────────
  bsFgCard.classList.toggle("hidden", !(isBS && isFG));
  bsRmCard.classList.toggle("hidden", !(isBS && isRM));
  bsPmCard.classList.toggle("hidden", !(isBS && isPM));
  ovFgCard.classList.toggle("hidden", !(isOV && isFG));
  ovRmCard.classList.toggle("hidden", !(isOV && isRM));
  ovPmCard.classList.toggle("hidden", !(isOV && isPM));
  epFgCard.classList.toggle("hidden", !(isEP && isFG));
  epRmCard.classList.toggle("hidden", !(isEP && isRM));
  epPmCard.classList.toggle("hidden", !(isEP && isPM));

  // ── Data cards (hide-only when wrong context) ─────────────────────────────
  if (!(isBS && isFG)) {
    bsControlCard.classList.add("hidden");
    bsTableCard.classList.add("hidden");
  }
  if (!(isBS && isRM)) {
    rmControlCard.classList.add("hidden");
    rmTableCard.classList.add("hidden");
  }
  if (!(isBS && isPM)) {
    pmControlCard.classList.add("hidden");
    pmTableCard.classList.add("hidden");
  }
  if (!(isOV && isFG)) {
    ovTableCard.classList.add("hidden");
  }
  if (!(isOV && isRM)) {
    ovRmTableCard.classList.add("hidden");
  }
  if (!(isOV && isPM)) {
    ovPmTableCard.classList.add("hidden");
  }
  if (!(isEP && isFG)) {
    epTableCard.classList.add("hidden");
  }
  if (!(isEP && isRM)) {
    epRmTableCard.classList.add("hidden");
  }
  if (!(isEP && isPM)) {
    epPmTableCard.classList.add("hidden");
  }

  if (isRQ) {
    void loadReviewQueue();
    void loadReviewQueueCounts();
    return;
  }

  // Lazy-load pickers for active tab (FG only)
  if (isFG) {
    if (tabId === "baseSpec" && productGroupSelect.options.length <= 1) {
      loadProductGroups();
    }
    if (tabId === "overrides" && ovProductSelect.options.length <= 1) {
      loadFgProducts(ovProductSelect);
    }
    if (tabId === "effectivePreview" && epProductSelect.options.length <= 1) {
      loadFgProducts(epProductSelect);
    }
  }

  // Lazy-load pickers for active tab (RM only)
  if (isRM) {
    if (tabId === "baseSpec") {
      const rmGroupSelect = document.getElementById("rmGroupSelect");
      if (rmGroupSelect && rmGroupSelect.options.length <= 1) loadRmGroups();
    }
    if (tabId === "overrides" && ovRmItemSelect.options.length <= 1) {
      loadRmItems(ovRmItemSelect);
    }
    if (tabId === "effectivePreview" && epRmItemSelect.options.length <= 1) {
      loadRmItems(epRmItemSelect);
    }
  }

  // Lazy-load pickers for active tab (PM only)
  if (isPM) {
    if (tabId === "baseSpec") {
      const pmGroupSelect = document.getElementById("pmGroupSelect");
      if (pmGroupSelect && pmGroupSelect.options.length <= 1) loadPmGroups();
    }
    if (tabId === "overrides" && ovPmItemSelect.options.length <= 1) {
      loadPmItems(ovPmItemSelect);
    }
    if (tabId === "effectivePreview" && epPmItemSelect.options.length <= 1) {
      loadPmItems(epPmItemSelect);
    }
  }

  void refreshPendingSpecRequestIndicators({ reload: true });
}

function wirePendingSpecRequestReviewModal() {
  bsPendingFamilyBtn?.addEventListener("click", () =>
    openSpecRequestReviewModal("FAMILY"),
  );
  rmPendingFamilyBtn?.addEventListener("click", () =>
    openSpecRequestReviewModal("FAMILY"),
  );
  pmPendingFamilyBtn?.addEventListener("click", () =>
    openSpecRequestReviewModal("FAMILY"),
  );
  ovPendingProductBtn?.addEventListener("click", () =>
    openSpecRequestReviewModal("PRODUCT"),
  );
  ovRmPendingProductBtn?.addEventListener("click", () =>
    openSpecRequestReviewModal("PRODUCT"),
  );
  ovPmPendingProductBtn?.addEventListener("click", () =>
    openSpecRequestReviewModal("PRODUCT"),
  );

  specRequestReviewClose?.addEventListener(
    "click",
    closeSpecRequestReviewModal,
  );
  specRequestReviewCancel?.addEventListener(
    "click",
    closeSpecRequestReviewModal,
  );
  specRequestReviewModal?.addEventListener("click", (e) => {
    if (e.target === specRequestReviewModal) closeSpecRequestReviewModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (
      !specRequestReviewModal ||
      specRequestReviewModal.classList.contains("hidden")
    )
      return;
    e.preventDefault();
    closeSpecRequestReviewModal();
  });

  specRequestApproveBtn?.addEventListener("click", () =>
    submitSpecRequestReview("approve"),
  );
  specRequestRejectBtn?.addEventListener("click", () =>
    submitSpecRequestReview("reject"),
  );
}

function wireReviewQueueEvents() {
  rqRefreshBtn?.addEventListener("click", async () => {
    await loadReviewQueue();
    await loadReviewQueueCounts();
    toast("Review queue refreshed.", "info", 1800);
  });

  rqSubjectFilter?.addEventListener("change", renderReviewQueue);
  rqScopeFilter?.addEventListener("change", renderReviewQueue);
  rqSearchInput?.addEventListener("input", renderReviewQueue);
}

async function loadReviewQueueCounts() {
  const { data, error } = await labSupabase
    .from("v_spec_change_request_review_counts")
    .select("*")
    .single();

  if (error) {
    console.error("[SPM] review count load failed", error);
    return;
  }

  const total = Number(data?.total_pending ?? 0);
  const family = Number(data?.family_pending ?? 0);
  const product = Number(data?.product_pending ?? 0);
  const overdue = Number(data?.overdue_pending ?? 0);

  if (rqTotalPending) rqTotalPending.textContent = String(total);
  if (rqFamilyPending) rqFamilyPending.textContent = String(family);
  if (rqProductPending) rqProductPending.textContent = String(product);
  if (rqOverduePending) rqOverduePending.textContent = String(overdue);

  if (reviewQueueTabBadge) {
    reviewQueueTabBadge.textContent = String(total);
    reviewQueueTabBadge.classList.toggle("hidden", total <= 0);
  }
}

async function loadReviewQueue() {
  const { data, error } = await labSupabase
    .from("v_spec_change_request_review_queue")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) {
    toast("Failed to load review queue: " + error.message, "error");
    reviewQueueRows = [];
    renderReviewQueue();
    return;
  }

  reviewQueueRows = data ?? [];
  renderReviewQueue();
}

function getFilteredReviewQueueRows() {
  const subject = String(rqSubjectFilter?.value ?? "").toUpperCase();
  const scope = String(rqScopeFilter?.value ?? "").toUpperCase();
  const q = String(rqSearchInput?.value ?? "").trim().toLowerCase();

  return reviewQueueRows.filter((row) => {
    if (subject && String(row.subject_type ?? "").toUpperCase() !== subject) {
      return false;
    }

    if (scope && String(row.request_scope ?? "").toUpperCase() !== scope) {
      return false;
    }

    if (!q) return true;

    const haystack = [
      row.request_id,
      row.request_scope,
      row.subject_type,
      row.entity_label,
      row.family_label,
      row.product_name,
      row.stock_item_name,
      row.test_name,
      row.current_display_text,
      row.proposed_display_text,
      row.source_analysis_register_no,
      row.requested_by_name,
      row.request_remarks,
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" | ");

    return haystack.includes(q);
  });
}

function formatAgeHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return "--";
  if (n < 1) return "<1 h";
  if (n < 24) return `${Math.floor(n)} h`;
  return `${Math.floor(n / 24)} d`;
}

function renderReviewQueue() {
  const rows = getFilteredReviewQueueRows();

  if (rqLineCount) {
    rqLineCount.textContent = `${rows.length} request${rows.length !== 1 ? "s" : ""}`;
  }

  if (!reviewQueueTableBody) return;

  if (!rows.length) {
    reviewQueueTableBody.innerHTML = `<tr><td colspan="10">
      <div class="spec-empty-state">
        <strong>No pending manual requests</strong>
        There are no matching specification change requests pending review.
      </div>
    </td></tr>`;
    return;
  }

  reviewQueueTableBody.innerHTML = rows
    .map((r) => {
      const ageBucket = String(r.age_bucket ?? "").toUpperCase();
      const ageClass =
        ageBucket === "OVERDUE"
          ? "rq-age-overdue"
          : ageBucket === "DUE_SOON"
            ? "rq-age-due-soon"
            : "";

      return `<tr data-request-id="${esc(String(r.request_id))}">
        <td>#${esc(String(r.request_id ?? ""))}</td>
        <td>${esc(String(r.review_route_label ?? r.request_scope ?? ""))}</td>
        <td>${esc(String(r.subject_type ?? ""))}</td>
        <td>
          <strong>${esc(String(r.entity_label ?? "--"))}</strong>
          <div style="font-size:11.5px;color:var(--muted,#6b7280);">${esc(String(r.family_label ?? ""))}</div>
        </td>
        <td>${esc(String(r.test_name ?? "--"))}</td>
        <td>${esc(String(r.current_display_text ?? "--"))}</td>
        <td>${esc(String(r.proposed_display_text ?? "--"))}</td>
        <td>${esc(String(r.source_analysis_register_no ?? r.analysis_register_no ?? "--"))}</td>
        <td class="${ageClass}">${esc(formatAgeHours(r.age_hours))}</td>
        <td>
          <button type="button" class="rq-action-btn" data-rq-action="review" data-request-id="${esc(String(r.request_id))}">
            Review
          </button>
        </td>
      </tr>`;
    })
    .join("");

  reviewQueueTableBody
    .querySelectorAll("[data-rq-action='review']")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        openReviewQueueRequest(btn.dataset.requestId),
      );
    });
}

async function loadPendingSpecChangeRequests() {
  if (!currentSubjectType) {
    pendingSpecRequests = [];
    return pendingSpecRequests;
  }

  const { data, error } = await labSupabase
    .schema("lab")
    .from("v_pending_spec_change_requests")
    .select("*")
    .eq("subject_type", currentSubjectType)
    .order("requested_at", { ascending: false });

  if (error) {
    toast(
      "Failed to load pending specification requests: " + error.message,
      "error",
    );
    pendingSpecRequests = [];
    return pendingSpecRequests;
  }

  pendingSpecRequests = (data ?? []).filter((request) => {
    const status = String(
      request.request_status ?? request.status ?? "",
    ).toUpperCase();

    return status === "" || status === "PENDING";
  });
  return pendingSpecRequests;
}

async function refreshPendingSpecRequestIndicators({ reload = false } = {}) {
  if (reload) {
    await loadPendingSpecChangeRequests();
  }
  refreshPendingRequestButtons();
}

function refreshPendingRequestButtons() {
  const allButtons = [
    bsPendingFamilyBtn,
    rmPendingFamilyBtn,
    pmPendingFamilyBtn,
    ovPendingProductBtn,
    ovRmPendingProductBtn,
    ovPmPendingProductBtn,
  ];
  allButtons.forEach((btn) => {
    if (!btn) return;
    btn.classList.add("hidden");
  });

  if (!currentSubjectType) return;

  if (currentTab === "baseSpec") {
    setPendingRequestButton(
      getFamilyPendingButtonForSubject(),
      "Pending Family Requests",
      getCurrentFamilyPendingRequests().length,
    );
  }

  if (currentTab === "overrides") {
    setPendingRequestButton(
      getProductPendingButtonForSubject(),
      "Pending Product Requests",
      getCurrentProductPendingRequests().length,
    );
  }

  debugPendingFamilyMatch();
}

function setPendingRequestButton(button, label, count) {
  if (!button) return;
  if (!count) {
    button.classList.add("hidden");
    button.textContent = label;
    return;
  }
  button.textContent = `${label} (${count})`;
  button.classList.remove("hidden");
}

function getFamilyPendingButtonForSubject() {
  if (currentSubjectType === "FG") return bsPendingFamilyBtn;
  if (currentSubjectType === "RM") return rmPendingFamilyBtn;
  if (currentSubjectType === "PM") return pmPendingFamilyBtn;
  return null;
}

function getProductPendingButtonForSubject() {
  if (currentSubjectType === "FG") return ovPendingProductBtn;
  if (currentSubjectType === "RM") return ovRmPendingProductBtn;
  if (currentSubjectType === "PM") return ovPmPendingProductBtn;
  return null;
}

function normalizeFamilyLabel(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildFamilyMatchKey(subjectType, label) {
  const subject = String(subjectType ?? "").trim().toUpperCase();
  const normalizedLabel = normalizeFamilyLabel(label);
  return normalizedLabel ? `${subject}|${normalizedLabel}` : "";
}

function getCurrentFamilyContext() {
  if (currentSubjectType === "FG") {
    return {
      subjectType: "FG",
      familyId: bsCurrentGroupId,
      familyLabel: bsCurrentGroupName,
      familyMatchKey: buildFamilyMatchKey("FG", bsCurrentGroupName),
    };
  }

  if (currentSubjectType === "RM") {
    return {
      subjectType: "RM",
      familyId: rmCurrentGroupId,
      familyLabel: rmCurrentGroupLabel,
      familyMatchKey: buildFamilyMatchKey("RM", rmCurrentGroupLabel),
    };
  }

  if (currentSubjectType === "PM") {
    return {
      subjectType: "PM",
      familyId: pmCurrentGroupId,
      familyLabel: pmCurrentGroupLabel,
      familyMatchKey: buildFamilyMatchKey("PM", pmCurrentGroupLabel),
    };
  }

  return {
    subjectType: currentSubjectType,
    familyId: null,
    familyLabel: "",
    familyMatchKey: "",
  };
}

function pendingRequestMatchesCurrentFamily(request) {
  const ctx = getCurrentFamilyContext();

  if (!ctx.familyId && !ctx.familyMatchKey) return false;

  if (normalizePendingRequestScope(request.request_scope) !== "FAMILY") {
    return false;
  }

  const requestSubject = String(request?.subject_type ?? "")
    .trim()
    .toUpperCase();

  if (requestSubject && requestSubject !== ctx.subjectType) {
    return false;
  }

  if (isSameRequestId(request.family_id, ctx.familyId)) {
    return true;
  }

  if (
    ctx.subjectType === "FG" &&
    isSameRequestId(request.product_group_id, ctx.familyId)
  ) {
    return true;
  }

  if (
    ctx.subjectType === "RM" &&
    isSameRequestId(request.inv_group_id, ctx.familyId)
  ) {
    return true;
  }

  if (
    ctx.subjectType === "PM" &&
    isSameRequestId(request.subcategory_id, ctx.familyId)
  ) {
    return true;
  }

  const requestKey = String(request?.family_match_key ?? "")
    .trim()
    .toLowerCase();
  if (requestKey && ctx.familyMatchKey && requestKey === ctx.familyMatchKey) {
    return true;
  }

  const requestLabel = normalizeFamilyLabel(request?.family_label);
  const currentLabel = normalizeFamilyLabel(ctx.familyLabel);
  return !!requestLabel && !!currentLabel && requestLabel === currentLabel;
}

function getCurrentFamilyPendingRequests() {
  return pendingSpecRequests.filter(pendingRequestMatchesCurrentFamily);
}

function debugPendingFamilyMatch() {
  if (!currentSubjectType || currentTab !== "baseSpec") return;

  const ctx = getCurrentFamilyContext();
  console.debug("[SPM] Pending family match context", {
    ctx,
    pendingCount: pendingSpecRequests.length,
    matchedCount: getCurrentFamilyPendingRequests().length,
    matched: getCurrentFamilyPendingRequests().map((r) => ({
      request_id: getPendingRequestId(r),
      request_scope: r.request_scope,
      subject_type: r.subject_type,
      family_id: r.family_id,
      product_group_id: r.product_group_id,
      inv_group_id: r.inv_group_id,
      subcategory_id: r.subcategory_id,
      family_label: r.family_label,
      family_match_key: r.family_match_key,
      test_name: r.test_name,
    })),
  });
}

function getCurrentProductPendingRequests() {
  const entityId =
    currentSubjectType === "FG"
      ? ovFgProductId
      : currentSubjectType === "RM"
        ? ovRmItemId
        : ovPmItemId;
  if (!entityId) return [];

  return pendingSpecRequests.filter((request) => {
    if (normalizePendingRequestScope(request.request_scope) !== "PRODUCT") {
      return false;
    }
    if (currentSubjectType === "FG") {
      return isSameRequestId(request.product_id, entityId);
    }
    return isSameRequestId(request.stock_item_id, entityId);
  });
}

function normalizePendingRequestScope(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isSameRequestId(left, right) {
  if (left == null || left === "" || right == null || right === "")
    return false;
  return String(left) === String(right);
}

function pickPendingRequestValue(request, keys, fallback = "") {
  for (const key of keys) {
    const value = request?.[key];
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function getSnapshotValue(request, snapshotKey, valueKey, fallback = "—") {
  const snapshot = request?.[snapshotKey];
  if (snapshot && typeof snapshot === "object") {
    const value = snapshot[valueKey];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return fallback;
}

function getPendingRequestId(request) {
  return pickPendingRequestValue(request, ["request_id", "id"], "");
}

function getPendingRequestRequestedBy(request) {
  return pickPendingRequestValue(
    request,
    [
      "requested_by_name",
      "requested_by_display_name",
      "requested_by",
      "requested_by_email",
    ],
    "—",
  );
}

function getPendingRequestSourceAnalysisNo(request) {
  return pickPendingRequestValue(
    request,
    [
      "source_analysis_register_no",
      "analysis_register_no",
      "register_no",
      "source_register_no",
    ],
    "—",
  );
}

function getPendingRequestSubjectLabel(request) {
  const familyLabel = pickPendingRequestValue(
    request,
    [
      "family_label",
      "product_group_name",
      "inv_group_label",
      "subcategory_label",
    ],
    "",
  );
  const productLabel = pickPendingRequestValue(
    request,
    ["product_name", "stock_item_name", "item_name"],
    "",
  );
  if (normalizePendingRequestScope(request.request_scope) === "FAMILY") {
    return familyLabel || "—";
  }
  if (productLabel && familyLabel) {
    return `${productLabel} · ${familyLabel}`;
  }
  return productLabel || familyLabel || "—";
}

function getPendingRequestCurrentReference(request) {
  const snapshotDisplay = getSnapshotValue(
    request,
    "current_reference_snapshot",
    "display_text",
    "",
  );
  if (snapshotDisplay) return snapshotDisplay;
  return pickPendingRequestValue(
    request,
    [
      "current_reference",
      "current_display_text",
      "current_reference_display_text",
      "existing_display_text",
    ],
    "—",
  );
}

function getPendingRequestProposedReference(request) {
  const snapshotDisplay = getSnapshotValue(
    request,
    "proposed_reference_snapshot",
    "display_text",
    "",
  );
  if (snapshotDisplay) return snapshotDisplay;
  return pickPendingRequestValue(
    request,
    [
      "proposed_reference",
      "proposed_display_text",
      "proposed_reference_display_text",
      "display_text",
    ],
    "—",
  );
}

function getPendingRequestCurrentType(request) {
  const snapshotType = getSnapshotValue(
    request,
    "current_reference_snapshot",
    "spec_type",
    "",
  );
  if (snapshotType) return snapshotType;
  return pickPendingRequestValue(
    request,
    ["current_spec_type", "current_reference_spec_type", "existing_spec_type"],
    "—",
  );
}

function getPendingRequestProposedType(request) {
  const snapshotType = getSnapshotValue(
    request,
    "proposed_reference_snapshot",
    "spec_type",
    "",
  );
  if (snapshotType) return snapshotType;
  return pickPendingRequestValue(
    request,
    ["proposed_spec_type", "spec_type", "requested_spec_type"],
    "—",
  );
}

function getPendingRequestCurrentMethod(request) {
  return getSnapshotValue(
    request,
    "current_reference_snapshot",
    "method_name",
    "—",
  );
}

function getPendingRequestProposedMethod(request) {
  return getSnapshotValue(
    request,
    "proposed_reference_snapshot",
    "method_name",
    "—",
  );
}

function getPendingRequestCurrentUom(request) {
  const symbol = getSnapshotValue(
    request,
    "current_reference_snapshot",
    "uom_symbol",
    "",
  );
  if (symbol) return symbol;
  return getSnapshotValue(
    request,
    "current_reference_snapshot",
    "uom_code",
    "—",
  );
}

function getPendingRequestProposedUom(request) {
  const symbol = getSnapshotValue(
    request,
    "proposed_reference_snapshot",
    "uom_symbol",
    "",
  );
  if (symbol) return symbol;
  return getSnapshotValue(
    request,
    "proposed_reference_snapshot",
    "uom_code",
    "—",
  );
}

function getPendingRequestRemarks(request) {
  return pickPendingRequestValue(
    request,
    ["remarks", "request_remarks", "proposal_remarks", "note"],
    "—",
  );
}

function getPendingRequestTestName(request) {
  return pickPendingRequestValue(request, ["test_name", "test_label"], "—");
}

function getPendingRequestRequestedAt(request) {
  const raw = pickPendingRequestValue(
    request,
    ["requested_at", "created_at"],
    "",
  );
  return formatDateTime(raw);
}

function openSpecRequestReviewModal(scope) {
  const requests =
    scope === "FAMILY"
      ? getCurrentFamilyPendingRequests()
      : getCurrentProductPendingRequests();

  if (!requests.length) {
    toast(
      scope === "FAMILY"
        ? "No pending family requests for the current selection."
        : "No pending product requests for the current selection.",
      "warn",
    );
    return;
  }

  activePendingReviewRequests = requests;
  selectedPendingReviewScope = scope;
  selectedPendingReviewRequestId = getPendingRequestId(requests[0]);
  if (specRequestReviewTitle) {
    specRequestReviewTitle.textContent =
      scope === "FAMILY"
        ? "Pending Family Requests"
        : "Pending Product Requests";
  }
  if (specRequestReviewContext) {
    specRequestReviewContext.textContent = `${currentSubjectType} · ${getPendingReviewContextLabel(scope)}`;
  }
  if (specRequestReviewRemarks) {
    specRequestReviewRemarks.value = "";
  }
  renderSpecRequestReviewModal();
  specRequestReviewModal?.classList.remove("hidden");
}

function openReviewQueueRequest(requestId) {
  const request = reviewQueueRows.find(
    (r) => String(r.request_id) === String(requestId),
  );

  if (!request) {
    toast("Request not found in review queue.", "warn");
    return;
  }

  activePendingReviewRequests = reviewQueueRows;
  selectedPendingReviewScope = normalizePendingRequestScope(
    request.request_scope,
  );
  selectedPendingReviewRequestId = String(request.request_id);

  if (specRequestReviewTitle) {
    specRequestReviewTitle.textContent =
      "Manual Specification Request Review";
  }

  if (specRequestReviewContext) {
    specRequestReviewContext.textContent = `${request.subject_type ?? "--"} - ${request.review_route_label ?? request.request_scope ?? "--"} - ${request.entity_label ?? request.family_label ?? "--"}`;
  }

  if (specRequestReviewRemarks) {
    specRequestReviewRemarks.value = "";
  }

  renderSpecRequestReviewModal();
  specRequestReviewModal?.classList.remove("hidden");
}

function getPendingReviewContextLabel(scope) {
  if (scope === "FAMILY") {
    if (currentSubjectType === "FG")
      return bsCurrentGroupName || "Selected family";
    if (currentSubjectType === "RM")
      return rmCurrentGroupLabel || "Selected family";
    if (currentSubjectType === "PM")
      return pmCurrentGroupLabel || "Selected family";
  }
  if (currentSubjectType === "FG") {
    return (
      ovProductSelect.options[ovProductSelect.selectedIndex]?.text ||
      "Selected product"
    );
  }
  if (currentSubjectType === "RM") {
    return (
      ovRmItemSelect.options[ovRmItemSelect.selectedIndex]?.text ||
      "Selected stock item"
    );
  }
  return (
    ovPmItemSelect.options[ovPmItemSelect.selectedIndex]?.text ||
    "Selected stock item"
  );
}

function renderSpecRequestReviewModal() {
  renderSpecRequestReviewList();
  renderSpecRequestReviewDetail();
  const hasSelection = !!getSelectedPendingReviewRequest();
  if (specRequestApproveBtn) specRequestApproveBtn.disabled = !hasSelection;
  if (specRequestRejectBtn) specRequestRejectBtn.disabled = !hasSelection;
}

function renderSpecRequestReviewList() {
  if (!specRequestReviewList) return;
  specRequestReviewList.innerHTML = activePendingReviewRequests
    .map((request) => {
      const requestId = String(getPendingRequestId(request));
      const isActive = requestId === String(selectedPendingReviewRequestId);
      const requestType = pickPendingRequestValue(
        request,
        ["request_type", "request_scope"],
        "",
      );
      return `<button type="button" class="spec-request-item ${isActive ? "active" : ""}" data-request-id="${esc(requestId)}">
        <div class="spec-request-item-title">#${esc(requestId)} · ${esc(getPendingRequestTestName(request))}${
          requestType
            ? ` <span class="spec-request-type-badge">${esc(String(requestType).toUpperCase())}</span>`
            : ""
        }</div>
        <div class="spec-request-item-meta">${esc(getPendingRequestRequestedBy(request))}</div>
        <div class="spec-request-item-meta">${esc(getPendingRequestRequestedAt(request))}</div>
      </button>`;
    })
    .join("");

  specRequestReviewList
    .querySelectorAll(".spec-request-item")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPendingReviewRequestId = btn.dataset.requestId;
        renderSpecRequestReviewModal();
      });
    });
}

function renderSpecRequestReviewDetail() {
  if (!specRequestReviewDetail) return;
  const request = getSelectedPendingReviewRequest();
  if (!request) {
    specRequestReviewDetail.innerHTML = `<div class="spec-request-empty">Select a pending specification change request to review.</div>`;
    return;
  }

  specRequestReviewDetail.innerHTML = `
    <div class="spec-request-section-title">Reference Comparison</div>
    <div class="spec-request-detail-grid">
      <div class="spec-request-card">
        <div class="spec-request-card-title">Existing / Current</div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentType(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Display</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentReference(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Method</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentMethod(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Unit</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentUom(request))}</div></div>
        </div>
      </div>
      <div class="spec-request-card">
        <div class="spec-request-card-title">Requested Change</div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedType(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Display</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedReference(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Method</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedMethod(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Unit</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedUom(request))}</div></div>
        </div>
      </div>
    </div>
    <div class="spec-request-section-title">Request Metadata</div>
    <div class="spec-request-meta-grid">
      <div class="spec-request-meta-item">
        <div class="spec-request-meta-label">Request ID</div>
        <div class="spec-request-meta-value">${esc(String(getPendingRequestId(request) || "—"))}</div>
      </div>
      <div class="spec-request-meta-item">
        <div class="spec-request-meta-label">Requested By</div>
        <div class="spec-request-meta-value">${esc(getPendingRequestRequestedBy(request))}</div>
      </div>
      <div class="spec-request-meta-item">
        <div class="spec-request-meta-label">Source Analysis Register No</div>
        <div class="spec-request-meta-value">${esc(getPendingRequestSourceAnalysisNo(request))}</div>
      </div>
      <div class="spec-request-meta-item">
        <div class="spec-request-meta-label">Subject / Product / Family</div>
        <div class="spec-request-meta-value">${esc(getPendingRequestSubjectLabel(request))}</div>
      </div>
      <div class="spec-request-meta-item">
        <div class="spec-request-meta-label">Test Name</div>
        <div class="spec-request-meta-value">${esc(getPendingRequestTestName(request))}</div>
      </div>
      <div class="spec-request-meta-item">
        <div class="spec-request-meta-label">Remarks</div>
        <div class="spec-request-meta-value">${esc(getPendingRequestRemarks(request))}</div>
      </div>
    </div>
  `;
}

function getSelectedPendingReviewRequest() {
  return (
    activePendingReviewRequests.find(
      (request) =>
        String(getPendingRequestId(request)) ===
        String(selectedPendingReviewRequestId),
    ) ?? null
  );
}

function closeSpecRequestReviewModal() {
  specRequestReviewModal?.classList.add("hidden");
  activePendingReviewRequests = [];
  selectedPendingReviewRequestId = null;
  selectedPendingReviewScope = null;
  if (specRequestReviewRemarks) {
    specRequestReviewRemarks.value = "";
  }
}

async function submitSpecRequestReview(action) {
  console.log("Spec request review clicked", {
    action,
    selectedPendingReviewRequestId,
    selectedPendingReviewScope,
  });

  const approveLabel = specRequestApproveBtn?.textContent ?? "Approve";
  const rejectLabel = specRequestRejectBtn?.textContent ?? "Reject";
  let shouldRefresh = false;

  try {
    const request = getSelectedPendingReviewRequest();
    console.log("Selected spec request", request);

    const rawRequestId = getPendingRequestId(request);
    const numericRequestId = Number(rawRequestId);

    if (
      !request ||
      !Number.isFinite(numericRequestId) ||
      numericRequestId <= 0
    ) {
      toast("Select a valid request to review.", "warn");
      console.warn("Invalid spec request selection", { request, rawRequestId });
      return;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      const msg = "Login session not found. Please reload.";
      console.error("Spec request review auth error", userErr || msg);
      toast(msg, "error");
      return;
    }
    if (!userData?.user?.id) {
      toast("Login session not found. Please reload.", "error");
      return;
    }

    const reviewRemarks = specRequestReviewRemarks?.value.trim() || null;
    const scope = normalizePendingRequestScope(request.request_scope);

    const rpcName =
      action === "approve"
        ? scope === "PRODUCT"
          ? "fn_approve_product_spec_change_request"
          : "fn_approve_family_spec_change_request"
        : "fn_reject_spec_change_request";

    if (action === "approve" && specRequestApproveBtn)
      specRequestApproveBtn.textContent = "Approving...";
    if (action === "reject" && specRequestRejectBtn)
      specRequestRejectBtn.textContent = "Rejecting...";
    if (specRequestApproveBtn) specRequestApproveBtn.disabled = true;
    if (specRequestRejectBtn) specRequestRejectBtn.disabled = true;

    const payload = {
      p_user_id: userData.user.id,
      p_request_id: numericRequestId,
      p_review_remarks: reviewRemarks,
    };
    console.log("Calling RPC", {
      rpcName,
      payload,
      scope,
      rawRequestId,
    });

    const { error } = await labSupabase.rpc(rpcName, payload);

    if (error) {
      console.error("Spec request review RPC error", error);
      toast(
        `Failed to ${action === "approve" ? "approve" : "reject"} request: ${error.message}`,
        "error",
      );
      return;
    }

    toast(
      action === "approve"
        ? "Specification change request approved."
        : "Specification change request rejected.",
      "success",
    );
    closeSpecRequestReviewModal();
    shouldRefresh = true;
  } catch (err) {
    const message = err?.message || String(err);
    console.error("Spec request review unexpected error", err);
    toast(
      `Failed to ${action === "approve" ? "approve" : "reject"} request: ${message}`,
      "error",
    );
  } finally {
    if (specRequestApproveBtn) {
      specRequestApproveBtn.disabled = false;
      specRequestApproveBtn.textContent = approveLabel;
    }
    if (specRequestRejectBtn) {
      specRequestRejectBtn.disabled = false;
      specRequestRejectBtn.textContent = rejectLabel;
    }

    if (shouldRefresh) {
      await refreshCurrentSpecReviewContext();
      await refreshPendingSpecRequestIndicators({ reload: true });
      await loadReviewQueueCounts();

      if (currentTab === "reviewQueue") {
        await loadReviewQueue();
      }
    }
  }
}

async function refreshCurrentSpecReviewContext() {
  if (currentTab === "baseSpec") {
    if (currentSubjectType === "FG" && bsCurrentGroupId) {
      await bsLoadGroupContext(bsCurrentGroupId);
    } else if (currentSubjectType === "RM" && rmCurrentGroupId) {
      await rmLoadGroupContext(rmCurrentGroupId);
    } else if (currentSubjectType === "PM" && pmCurrentGroupId) {
      await pmLoadGroupContext(pmCurrentGroupId);
    }
    return;
  }

  if (currentTab === "overrides") {
    if (currentSubjectType === "FG" && ovFgProductId) {
      await onOvProductChange();
    } else if (currentSubjectType === "RM" && ovRmItemId) {
      await onRmOverrideItemChange();
    } else if (currentSubjectType === "PM" && ovPmItemId) {
      await onPmOverrideItemChange();
    }
  }
}

// ── BASE SPEC — FG ────────────────────────────────────────────────────────────

// FIX 1: use group_name, not name
async function loadProductGroups() {
  pgProductSearchInput.disabled = true;
  pgProductSearchInput.placeholder = "Loading product groups...";
  productGroupSelect.innerHTML = '<option value="">Loading...</option>';
  const { data, error } = await labSupabase
    .schema("public")
    .from("product_groups")
    .select("id, group_name")
    .order("group_name");
  if (error) {
    toast("Failed to load product groups: " + error.message, "error");
    productGroupSelect.innerHTML = '<option value="">-- Error --</option>';
    pgProductSearchInput.placeholder = "Error loading groups";
    pgProductSearchInput.disabled = false;
    return;
  }
  // Dedupe by normalised group_name; keep lowest numeric id per name, track all source ids
  const seen = new Map();
  for (const row of data ?? []) {
    const key = String(row.group_name ?? "")
      .trim()
      .toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        id: row.id,
        group_name: row.group_name,
        source_ids: [row.id],
      });
    } else {
      const existing = seen.get(key);
      existing.source_ids.push(row.id);
      if (row.id < existing.id) {
        existing.id = row.id;
      }
    }
  }
  const deduped = [...seen.values()].sort((a, b) =>
    (a.group_name ?? "").localeCompare(b.group_name ?? ""),
  );
  pgPickerRows = deduped;
  populateSelect(
    productGroupSelect,
    deduped,
    "id",
    "group_name",
    "-- Select Product Group --",
  );
  pgProductSearchInput.disabled = false;
  pgProductSearchInput.placeholder = "Type to search product group...";
  syncPgSearchInputFromSelect();
}

function wireBaseSpecEvents() {
  productGroupSelect.addEventListener("change", () => {
    syncPgSearchInputFromSelect();
    onProductGroupChange();
  });
  bsGenerateSpecBtn.addEventListener("click", bsGenerateSpec);
  bsRebuildSpecBtn?.addEventListener("click", () => openRebuildModal("FG"));
}

async function onProductGroupChange() {
  const groupId = productGroupSelect.value;
  if (!groupId) {
    bsResetState();
    return;
  }
  bsCurrentGroupId = groupId;
  bsCurrentGroupName =
    productGroupSelect.options[productGroupSelect.selectedIndex].text;

  // Show control card, reset state
  bsControlCard.classList.remove("hidden");
  bsTableCard.classList.add("hidden");
  bsBanner.classList.add("hidden");
  bsGenerateSpecBtn.classList.add("hidden");
  bsContextStrip.classList.add("hidden");
  bsEditedSpecLines.clear();
  bsSyncSaveBtn();

  setMetaValue(bsMetaProfileId, "--", true);
  setMetaValue(bsMetaVersion, "--", true);
  setMetaValue(bsMetaEffDate, "--", true);

  await bsLoadGroupContext(groupId);
  await refreshPendingSpecRequestIndicators({ reload: true });
}

async function bsLoadGroupContext(groupId) {
  showBanner(bsBanner, "info", "Loading group protocol and spec info...");

  // FIX 3 — Step A: fetch protocol_category_id from map
  const { data: mapRows, error: mapErr } = await labSupabase
    .from("protocol_category_product_group_map")
    .select("protocol_category_id")
    .eq("product_group_id", groupId)
    .eq("is_active", true)
    .limit(1);

  if (mapErr) {
    showBanner(
      bsBanner,
      "error",
      "Could not load protocol mapping: " + mapErr.message,
    );
    return;
  }

  const protocolCategoryId = mapRows?.[0]?.protocol_category_id ?? null;

  // FIX 3 — Step B: fetch category_name from protocol_category
  let protocolName = null;
  if (protocolCategoryId) {
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name, source_document")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (!catErr && catRows?.length) {
      protocolName = catRows[0].category_name ?? null;
    }
  }

  // Step C: resolve active spec profile via RPC (handles family-aware mapping)
  const { data: specProfileId, error: specMapErr } = await labSupabase.rpc(
    "fn_get_active_spec_profile_id_for_fg_group",
    {
      p_product_group_id: Number(groupId),
      p_as_of_date: todayISO(),
    },
  );

  if (specMapErr) {
    showBanner(
      bsBanner,
      "error",
      "Could not load base spec mapping: " + specMapErr.message,
    );
    return;
  }

  // FIX 4 — Step B: fetch spec_profile details
  let specProfile = null;
  if (specProfileId) {
    const { data: spRows, error: spErr } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from, is_active")
      .eq("id", specProfileId)
      .limit(1);
    if (!spErr && spRows?.length) {
      specProfile = spRows[0];
    }
  }

  // Populate context strip
  bsProtocolName.textContent = protocolName ?? "None";
  bsProtocolName.classList.toggle("not-set", !protocolName);
  bsBaseSpecName.textContent = specProfile
    ? (specProfile.spec_name ?? `Profile #${specProfile.id}`)
    : "Not set";
  bsBaseSpecName.classList.toggle("not-set", !specProfile);
  bsBaseSpecVersion.textContent = specProfile
    ? String(specProfile.version_no)
    : "--";
  bsBaseSpecVersion.classList.toggle("not-set", !specProfile);
  bsContextStrip.classList.remove("hidden");

  if (specProfile) {
    bsCurrentProfileId = specProfile.id;
    setMetaValue(bsMetaProfileId, String(specProfile.id), false);
    setMetaValue(bsMetaVersion, `v${specProfile.version_no}`, false);
    setMetaValue(bsMetaEffDate, formatDate(specProfile.effective_from), false);
    bsGenerateSpecBtn.classList.add("hidden");
    bsRebuildSpecBtn?.classList.remove("hidden");
    hideBanner(bsBanner);
    await bsLoadSpecLines(specProfile.id);
  } else {
    bsCurrentProfileId = null;
    setMetaValue(bsMetaProfileId, "--", true);
    setMetaValue(bsMetaVersion, "--", true);
    setMetaValue(bsMetaEffDate, "--", true);
    if (protocolName) {
      bsGenerateSpecBtn.classList.remove("hidden");
      bsRebuildSpecBtn?.classList.add("hidden");
      showBanner(
        bsBanner,
        "warn",
        "No base spec profile found for this product group. Use Generate Spec to create one from the protocol.",
      );
    } else {
      bsGenerateSpecBtn.classList.add("hidden");
      bsRebuildSpecBtn?.classList.add("hidden");
      showBanner(
        bsBanner,
        "info",
        "No protocol or base spec profile is configured for this product group.",
      );
    }
  }
}

async function bsLoadSpecLines(profileId) {
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_id, test_name, method_name, display_text, spec_type, min_value, max_value, text_value, spec_line_is_active, uom_id, uom_code, uom_name, uom_symbol",
    )
    .eq("spec_profile_id", profileId)
    .order("seq_no");

  if (error) {
    showBanner(
      bsBanner,
      "error",
      "Could not load spec lines: " + error.message,
    );
    return;
  }

  bsRenderSpecLines(data ?? []);
}

function bsRenderSpecLines(rows) {
  // Cache rows for re-render after modal edits (do NOT clear bsEditedSpecLines here)
  bsLoadedRows = rows;
  bsTableCard.classList.remove("hidden");

  // Line count accounts for pending active-state edits
  const countActive = rows.filter((r) => {
    const p = bsEditedSpecLines.get(r.seq_no);
    return p ? p.is_active : !!r.spec_line_is_active;
  }).length;
  const totalCount = rows.length;
  bsLineCount.textContent =
    countActive === totalCount
      ? `${totalCount} line${totalCount !== 1 ? "s" : ""}`
      : `${countActive} active / ${totalCount} total`;

  if (!rows.length) {
    bsTableBody.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    bsSyncSaveBtn();
    return;
  }

  bsTableBody.innerHTML = rows
    .map((r) => {
      const seqNo = r.seq_no;
      const pending = bsEditedSpecLines.get(seqNo);
      const dispType = pending
        ? normalizeBaseSpecTypeValue(pending.spec_type)
        : normalizeBaseSpecTypeValue(r.spec_type ?? "");
      const dispText = pending
        ? (pending.display_text ?? "")
        : (r.display_text ?? "");
      const isActive = pending ? pending.is_active : !!r.spec_line_is_active;
      const origActive = !!r.spec_line_is_active;
      return `<tr data-seq="${esc(String(seqNo))}"
          data-test-id="${esc(String(r.test_id ?? ""))}"
          data-test-name="${esc(r.test_name ?? "")}"
          data-method-name="${esc(r.method_name ?? "")}"
          data-orig-spec-type="${esc(normalizeBaseSpecTypeValue(r.spec_type ?? ""))}"
          data-orig-min="${esc(String(r.min_value ?? ""))}"
          data-orig-max="${esc(String(r.max_value ?? ""))}"
          data-orig-text="${esc(r.text_value ?? "")}"
          data-orig-display="${esc(r.display_text ?? "")}"
          data-orig-uom-id="${esc(String(r.uom_id ?? ""))}"
          data-orig-uom-symbol="${esc(r.uom_symbol ?? "")}"
          data-orig-active="${origActive ? "1" : "0"}"
          class="${isActive ? "" : "bs-row-inactive"}">
        <td class="td-seq">${esc(String(seqNo))}</td>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td class="td-method">${esc(r.method_name ?? "")}</td>
        <td>${typeBadge(dispType)}</td>
        <td class="bs-display-text-cell${pending ? " pending" : ""}">${esc(dispText)}</td>
        <td class="td-active">
          <input class="spec-active bs-active-chk" type="checkbox"
                 ${isActive ? "checked" : ""} aria-label="Active" />
        </td>
        <td class="td-edit-col">
          <button class="bs-edit-btn" aria-label="Edit spec line" title="Edit specification values">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  bsTableBody.querySelectorAll("tr[data-seq]").forEach((tr) => {
    const chk = tr.querySelector(".bs-active-chk");
    const editBtn = tr.querySelector(".bs-edit-btn");
    const seqNo = Number(tr.dataset.seq);
    const origActive = tr.dataset.origActive === "1";

    chk.addEventListener("change", () => {
      const newActive = chk.checked;
      const existing = bsEditedSpecLines.get(seqNo);
      if (existing) {
        bsEditedSpecLines.set(seqNo, { ...existing, is_active: newActive });
      } else if (newActive !== origActive) {
        bsEditedSpecLines.set(seqNo, {
          seq_no: seqNo,
          spec_type: tr.dataset.origSpecType || null,
          min_value:
            tr.dataset.origMin !== "" ? Number(tr.dataset.origMin) : null,
          max_value:
            tr.dataset.origMax !== "" ? Number(tr.dataset.origMax) : null,
          text_value: tr.dataset.origText || null,
          uom_id:
            tr.dataset.origUomId !== "" ? Number(tr.dataset.origUomId) : null,
          uom_symbol: tr.dataset.origUomSymbol || null,
          display_text: tr.dataset.origDisplay || null,
          is_active: newActive,
        });
      } else {
        bsEditedSpecLines.delete(seqNo);
      }
      tr.classList.toggle("bs-row-inactive", !newActive);
      bsSyncSaveBtn();
      bsSyncActiveAllCheckbox();
    });

    editBtn.addEventListener("click", () => openBsLineModal("FG", seqNo));
  });

  bsWireActiveAllCheckbox();
  bsSyncSaveBtn();
}

function bsSyncSaveBtn() {
  bsSaveSpecBtn.classList.toggle("hidden", bsEditedSpecLines.size === 0);
}

// Wire the master Active checkbox in the Base Spec table header.
// Clicking it checks/unchecks all rows and fires each row's syncRow via
// a native change event so bsEditedSpecLines stays consistent.
function bsWireActiveAllCheckbox() {
  const masterChk = document.getElementById("bsActiveAllChk");
  if (!masterChk) return;

  bsSyncActiveAllCheckbox(); // set initial indeterminate / checked state

  masterChk.addEventListener("change", () => {
    const target = masterChk.checked;
    bsTableBody.querySelectorAll(".bs-active-chk").forEach((chk) => {
      if (chk.checked !== target) {
        chk.checked = target;
        // dispatch 'change' so the row's own syncRow handler fires
        chk.dispatchEvent(new Event("change", { bubbles: false }));
      }
    });
    // After all rows synced, ensure master is clean (not indeterminate)
    masterChk.indeterminate = false;
    masterChk.checked = target;
  });
}

// Reflect the aggregate state of all row Active checkboxes onto the master.
function bsSyncActiveAllCheckbox() {
  const masterChk = document.getElementById("bsActiveAllChk");
  if (!masterChk) return;
  const all = [...bsTableBody.querySelectorAll(".bs-active-chk")];
  if (!all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
    return;
  }
  const checkedCount = all.filter((c) => c.checked).length;
  if (checkedCount === 0) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
  } else if (checkedCount === all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = true;
  } else {
    masterChk.indeterminate = true;
  }
}

async function bsGenerateSpec() {
  if (!bsCurrentGroupId) return;
  const btn = bsGenerateSpecBtn;
  btn.disabled = true;
  btn.textContent = "Generating...";
  showBanner(bsBanner, "info", "Generating base spec profile from protocol...");

  const specName = `FG | ${bsCurrentGroupName} | v1`;
  const { data: newProfileId, error } = await labSupabase.rpc(
    "fn_generate_fg_group_spec_profile",
    {
      p_product_group_id: Number(bsCurrentGroupId),
      p_spec_name: specName,
      p_version_no: 1,
      p_remarks: "Generated from protocol via Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(bsBanner, "error", "Generation failed: " + error.message);
    resetGenerateButton(btn);
    return;
  }

  toast("Base spec profile generated successfully.", "success");
  resetGenerateButton(btn);
  btn.classList.add("hidden");

  bsCurrentProfileId = Number(newProfileId) || null;
  bsEditedSpecLines.clear();
  bsSyncSaveBtn();

  await bsLoadGroupContext(bsCurrentGroupId);

  // Fallback: if context reload didn't find a profile (e.g. RPC not yet deployed),
  // load spec lines directly using the id returned from generate.
  if (!bsCurrentProfileId && newProfileId) {
    const resolvedId = Number(newProfileId);
    bsCurrentProfileId = resolvedId;
    const { data: spRows } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from")
      .eq("id", resolvedId)
      .limit(1);
    const sp = spRows?.[0];
    if (sp) {
      setMetaValue(bsMetaProfileId, String(sp.id), false);
      setMetaValue(bsMetaVersion, `v${sp.version_no}`, false);
      setMetaValue(bsMetaEffDate, formatDate(sp.effective_from), false);
    }
    hideBanner(bsBanner);
    btn.classList.add("hidden");
    await bsLoadSpecLines(resolvedId);
  }
}

async function bsSaveSpec() {
  if (!bsCurrentProfileId || bsEditedSpecLines.size === 0) return;
  const btn = bsSaveSpecBtn;
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const edits = Array.from(bsEditedSpecLines.values());
  const { data, error } = await labSupabase.rpc(
    "fn_create_new_spec_version_from_edits",
    {
      p_source_spec_profile_id: bsCurrentProfileId,
      p_edits: edits,
      p_remarks: "Edited via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Save failed: " + error.message, "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Save Spec";
    return;
  }

  const newProfileId = Number(data);
  bsCurrentProfileId = newProfileId;

  const getAffectedCount = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (
      typeof val === "string" &&
      val.trim() !== "" &&
      !Number.isNaN(Number(val))
    ) {
      return Number(val);
    }
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === "number") return first;
      if (first && typeof first === "object") {
        for (const k of ["count", "affected_count", "affected", "result"]) {
          if (first[k] !== undefined && !Number.isNaN(Number(first[k]))) {
            return Number(first[k]);
          }
        }
      }
    }
    if (val && typeof val === "object") {
      for (const k of ["count", "affected_count", "affected", "result"]) {
        if (val[k] !== undefined && !Number.isNaN(Number(val[k]))) {
          return Number(val[k]);
        }
      }
    }
    return null;
  };

  // Point the product-group mapping to the newly created spec version
  const { data: mapData, error: mapErr } = await labSupabase.rpc(
    "fn_set_active_fg_group_spec_profile_family",
    {
      p_product_group_id: Number(bsCurrentGroupId),
      p_spec_profile_id: newProfileId,
      p_remarks: "Activated via Spec Profile Manager family-aware save",
    },
  );
  if (mapErr) {
    toast(
      "Spec version saved but family-aware mapping update failed: " +
        mapErr.message,
      "warn",
    );
  } else {
    const affectedCount = getAffectedCount(mapData);
    if (affectedCount === null) {
      toast("Spec version saved and activated for product group.", "success");
    } else {
      toast(
        `Spec version saved and activated for ${affectedCount} equivalent product group record(s).`,
        "success",
      );
    }
  }
  bsEditedSpecLines.clear();
  bsSyncSaveBtn();
  btn.disabled = false;
  btn.classList.remove("loading");

  // Reload meta and lines
  const { data: meta, error: metaErr } = await labSupabase
    .from("spec_profile")
    .select("id, spec_name, version_no, effective_from")
    .eq("id", newProfileId)
    .single();

  if (!metaErr && meta) {
    setMetaValue(bsMetaProfileId, String(meta.id), false);
    setMetaValue(bsMetaVersion, `v${meta.version_no}`, false);
    setMetaValue(bsMetaEffDate, formatDate(meta.effective_from), false);
  }
  await bsLoadSpecLines(newProfileId);
}

function bsResetState() {
  bsCurrentProfileId = null;
  bsCurrentGroupId = null;
  bsCurrentGroupName = null;
  bsEditedSpecLines.clear();
  bsControlCard.classList.add("hidden");
  bsTableCard.classList.add("hidden");
  bsContextStrip.classList.add("hidden");
  hideBanner(bsBanner);
  bsGenerateSpecBtn.classList.add("hidden");
  bsRebuildSpecBtn?.classList.add("hidden");
  refreshPendingRequestButtons();
}

// ── BASE SPEC — RM ────────────────────────────────────────────────────────────

async function loadRmGroups() {
  const rmGroupSelect = document.getElementById("rmGroupSelect");
  if (!rmGroupSelect) return;
  rmGroupSelect.disabled = true;
  rmGroupSelect.innerHTML = '<option value="">Loading...</option>';

  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("inv_group_id, inv_group_label")
    .eq("category_code", "RM")
    .order("inv_group_label");

  if (error) {
    toast("Failed to load RM inventory groups: " + error.message, "error");
    rmGroupSelect.innerHTML = '<option value="">-- Error --</option>';
    rmGroupSelect.disabled = false;
    return;
  }

  // Dedupe by inv_group_id
  const seen = new Map();
  for (const row of data ?? []) {
    if (!seen.has(row.inv_group_id)) {
      seen.set(row.inv_group_id, {
        inv_group_id: row.inv_group_id,
        inv_group_label: row.inv_group_label,
      });
    }
  }
  const deduped = [...seen.values()].sort((a, b) =>
    (a.inv_group_label ?? "").localeCompare(b.inv_group_label ?? ""),
  );

  populateSelect(
    rmGroupSelect,
    deduped,
    "inv_group_id",
    "inv_group_label",
    "-- Select Inventory Group --",
  );
  rmGroupSelect.disabled = false;
}

function wireBaseSpecRmEvents() {
  const rmGroupSelect = document.getElementById("rmGroupSelect");
  const rmSaveSpecBtn = document.getElementById("rmSaveSpecBtn");
  if (rmGroupSelect) rmGroupSelect.addEventListener("change", onRmGroupChange);
  if (rmGenerateSpecBtn)
    rmGenerateSpecBtn.addEventListener("click", rmGenerateSpec);
  if (rmRebuildSpecBtn)
    rmRebuildSpecBtn.addEventListener("click", () => openRebuildModal("RM"));
  if (rmSaveSpecBtn) rmSaveSpecBtn.addEventListener("click", rmSaveSpec);
}

async function onRmGroupChange() {
  const rmGroupSelect = document.getElementById("rmGroupSelect");
  const groupId = rmGroupSelect?.value;
  if (!groupId) {
    rmResetState();
    return;
  }
  rmCurrentGroupId = groupId;
  rmCurrentGroupLabel = rmGroupSelect.options[rmGroupSelect.selectedIndex].text;

  const rmBanner = document.getElementById("rmBanner");
  const rmContextStrip = document.getElementById("rmContextStrip");
  const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
  const rmMetaProfileId = document.getElementById("rmMetaProfileId");
  const rmMetaVersion = document.getElementById("rmMetaVersion");
  const rmMetaEffDate = document.getElementById("rmMetaEffDate");

  rmControlCard.classList.remove("hidden");
  rmTableCard.classList.add("hidden");
  hideBanner(rmBanner);
  rmGenerateSpecBtn.classList.add("hidden");
  rmContextStrip.classList.add("hidden");
  rmEditedSpecLines.clear();
  rmSyncSaveBtn();

  setMetaValue(rmMetaProfileId, "--", true);
  setMetaValue(rmMetaVersion, "--", true);
  setMetaValue(rmMetaEffDate, "--", true);

  await rmLoadGroupContext(groupId);
  await refreshPendingSpecRequestIndicators({ reload: true });
}

async function rmLoadGroupContext(groupId) {
  const rmBanner = document.getElementById("rmBanner");
  const rmContextStrip = document.getElementById("rmContextStrip");
  const rmProtocolName = document.getElementById("rmProtocolName");
  const rmBaseSpecName = document.getElementById("rmBaseSpecName");
  const rmBaseSpecVersion = document.getElementById("rmBaseSpecVersion");
  const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
  const rmMetaProfileId = document.getElementById("rmMetaProfileId");
  const rmMetaVersion = document.getElementById("rmMetaVersion");
  const rmMetaEffDate = document.getElementById("rmMetaEffDate");

  showBanner(rmBanner, "info", "Loading group protocol and spec info...");

  // Step A: protocol via protocol_category_inv_group_map
  const { data: mapRows, error: mapErr } = await labSupabase
    .from("protocol_category_inv_group_map")
    .select("protocol_category_id")
    .eq("inv_group_id", groupId)
    .eq("subject_type", "RM")
    .eq("is_active", true)
    .limit(1);

  if (mapErr) {
    showBanner(
      rmBanner,
      "error",
      "Could not load protocol mapping: " + mapErr.message,
    );
    return;
  }

  const protocolCategoryId = mapRows?.[0]?.protocol_category_id ?? null;

  // Step B: protocol name
  let protocolName = null;
  if (protocolCategoryId) {
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (!catErr && catRows?.length) {
      protocolName = catRows[0].category_name ?? null;
    }
  }

  // Step C: spec profile via spec_profile_inv_group_map
  const { data: specMapRows, error: specMapErr } = await labSupabase
    .from("spec_profile_inv_group_map")
    .select("spec_profile_id")
    .eq("inv_group_id", groupId)
    .eq("subject_type", "RM")
    .eq("is_active", true)
    .limit(1);

  if (specMapErr) {
    showBanner(
      rmBanner,
      "error",
      "Could not load base spec mapping: " + specMapErr.message,
    );
    return;
  }

  const specProfileId = specMapRows?.[0]?.spec_profile_id ?? null;

  // Step D: spec profile details
  let specProfile = null;
  if (specProfileId) {
    const { data: spRows, error: spErr } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from, is_active")
      .eq("id", specProfileId)
      .limit(1);
    if (!spErr && spRows?.length) {
      specProfile = spRows[0];
    }
  }

  // Populate context strip
  rmProtocolName.textContent = protocolName ?? "None";
  rmProtocolName.classList.toggle("not-set", !protocolName);
  rmBaseSpecName.textContent = specProfile
    ? (specProfile.spec_name ?? `Profile #${specProfile.id}`)
    : "Not set";
  rmBaseSpecName.classList.toggle("not-set", !specProfile);
  rmBaseSpecVersion.textContent = specProfile
    ? String(specProfile.version_no)
    : "--";
  rmBaseSpecVersion.classList.toggle("not-set", !specProfile);
  rmContextStrip.classList.remove("hidden");

  if (specProfile) {
    rmCurrentProfileId = specProfile.id;
    setMetaValue(rmMetaProfileId, String(specProfile.id), false);
    setMetaValue(rmMetaVersion, `v${specProfile.version_no}`, false);
    setMetaValue(rmMetaEffDate, formatDate(specProfile.effective_from), false);
    rmGenerateSpecBtn?.classList.add("hidden");
    rmRebuildSpecBtn?.classList.remove("hidden");
    hideBanner(rmBanner);
    await rmLoadSpecLines(specProfile.id);
  } else {
    rmCurrentProfileId = null;
    setMetaValue(rmMetaProfileId, "--", true);
    setMetaValue(rmMetaVersion, "--", true);
    setMetaValue(rmMetaEffDate, "--", true);
    if (protocolName) {
      rmGenerateSpecBtn?.classList.remove("hidden");
      rmRebuildSpecBtn?.classList.add("hidden");
      showBanner(
        rmBanner,
        "warn",
        "No base spec profile found for this inventory group. Use Generate Spec to create one from the protocol.",
      );
    } else {
      rmGenerateSpecBtn?.classList.add("hidden");
      rmRebuildSpecBtn?.classList.add("hidden");
      showBanner(
        rmBanner,
        "info",
        "No protocol or base spec profile is configured for this inventory group.",
      );
    }
  }
}

async function rmLoadSpecLines(profileId) {
  const rmBanner = document.getElementById("rmBanner");
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_id, test_name, method_name, display_text, spec_type, min_value, max_value, text_value, spec_line_is_active, uom_id, uom_code, uom_name, uom_symbol",
    )
    .eq("spec_profile_id", profileId)
    .order("seq_no");

  if (error) {
    showBanner(
      rmBanner,
      "error",
      "Could not load spec lines: " + error.message,
    );
    return;
  }

  rmRenderSpecLines(data ?? []);
}

function rmRenderSpecLines(rows) {
  const rmTableCard = document.getElementById("rmTableCard");
  const rmLineCount = document.getElementById("rmLineCount");
  const rmTableBody = document.getElementById("rmTableBody");

  // Cache rows for re-render after modal edits (do NOT clear rmEditedSpecLines here)
  rmLoadedRows = rows;
  rmTableCard.classList.remove("hidden");

  const countActive = rows.filter((r) => {
    const p = rmEditedSpecLines.get(r.seq_no);
    return p ? p.is_active : !!r.spec_line_is_active;
  }).length;
  const totalCount = rows.length;
  rmLineCount.textContent =
    countActive === totalCount
      ? `${totalCount} line${totalCount !== 1 ? "s" : ""}`
      : `${countActive} active / ${totalCount} total`;

  if (!rows.length) {
    rmTableBody.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    rmSyncSaveBtn();
    return;
  }

  rmTableBody.innerHTML = rows
    .map((r) => {
      const seqNo = r.seq_no;
      const pending = rmEditedSpecLines.get(seqNo);
      const dispType = pending
        ? normalizeBaseSpecTypeValue(pending.spec_type)
        : normalizeBaseSpecTypeValue(r.spec_type ?? "");
      const dispText = pending
        ? (pending.display_text ?? "")
        : (r.display_text ?? "");
      const isActive = pending ? pending.is_active : !!r.spec_line_is_active;
      const origActive = !!r.spec_line_is_active;
      return `<tr data-seq="${esc(String(seqNo))}"
          data-test-id="${esc(String(r.test_id ?? ""))}"
          data-test-name="${esc(r.test_name ?? "")}"
          data-method-name="${esc(r.method_name ?? "")}"
          data-orig-spec-type="${esc(normalizeBaseSpecTypeValue(r.spec_type ?? ""))}"
          data-orig-min="${esc(String(r.min_value ?? ""))}"
          data-orig-max="${esc(String(r.max_value ?? ""))}"
          data-orig-text="${esc(r.text_value ?? "")}"
          data-orig-display="${esc(r.display_text ?? "")}"
          data-orig-uom-id="${esc(String(r.uom_id ?? ""))}"
          data-orig-uom-symbol="${esc(r.uom_symbol ?? "")}"
          data-orig-active="${origActive ? "1" : "0"}"
          class="${isActive ? "" : "bs-row-inactive"}">
        <td class="td-seq">${esc(String(seqNo))}</td>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td class="td-method">${esc(r.method_name ?? "")}</td>
        <td>${typeBadge(dispType)}</td>
        <td class="bs-display-text-cell${pending ? " pending" : ""}">${esc(dispText)}</td>
        <td class="td-active">
          <input class="spec-active rm-active-chk" type="checkbox"
                 ${isActive ? "checked" : ""} aria-label="Active" />
        </td>
        <td class="td-edit-col">
          <button class="bs-edit-btn" aria-label="Edit spec line" title="Edit specification values">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  rmTableBody.querySelectorAll("tr[data-seq]").forEach((tr) => {
    const chk = tr.querySelector(".rm-active-chk");
    const editBtn = tr.querySelector(".bs-edit-btn");
    const seqNo = Number(tr.dataset.seq);
    const origActive = tr.dataset.origActive === "1";

    chk.addEventListener("change", () => {
      const newActive = chk.checked;
      const existing = rmEditedSpecLines.get(seqNo);
      if (existing) {
        rmEditedSpecLines.set(seqNo, { ...existing, is_active: newActive });
      } else if (newActive !== origActive) {
        rmEditedSpecLines.set(seqNo, {
          seq_no: seqNo,
          spec_type: tr.dataset.origSpecType || null,
          min_value:
            tr.dataset.origMin !== "" ? Number(tr.dataset.origMin) : null,
          max_value:
            tr.dataset.origMax !== "" ? Number(tr.dataset.origMax) : null,
          text_value: tr.dataset.origText || null,
          uom_id:
            tr.dataset.origUomId !== "" ? Number(tr.dataset.origUomId) : null,
          uom_symbol: tr.dataset.origUomSymbol || null,
          display_text: tr.dataset.origDisplay || null,
          is_active: newActive,
        });
      } else {
        rmEditedSpecLines.delete(seqNo);
      }
      tr.classList.toggle("bs-row-inactive", !newActive);
      rmSyncSaveBtn();
      rmSyncActiveAllCheckbox();
    });

    editBtn.addEventListener("click", () => openBsLineModal("RM", seqNo));
  });

  rmWireActiveAllCheckbox();
  rmSyncSaveBtn();
}

function rmSyncSaveBtn() {
  const rmSaveSpecBtn = document.getElementById("rmSaveSpecBtn");
  if (rmSaveSpecBtn)
    rmSaveSpecBtn.classList.toggle("hidden", rmEditedSpecLines.size === 0);
}

function rmWireActiveAllCheckbox() {
  const masterChk = document.getElementById("rmActiveAllChk");
  const rmTableBody = document.getElementById("rmTableBody");
  if (!masterChk || !rmTableBody) return;

  rmSyncActiveAllCheckbox();

  masterChk.addEventListener("change", () => {
    const target = masterChk.checked;
    rmTableBody.querySelectorAll(".rm-active-chk").forEach((chk) => {
      if (chk.checked !== target) {
        chk.checked = target;
        chk.dispatchEvent(new Event("change", { bubbles: false }));
      }
    });
    masterChk.indeterminate = false;
    masterChk.checked = target;
  });
}

function rmSyncActiveAllCheckbox() {
  const masterChk = document.getElementById("rmActiveAllChk");
  const rmTableBody = document.getElementById("rmTableBody");
  if (!masterChk || !rmTableBody) return;
  const all = [...rmTableBody.querySelectorAll(".rm-active-chk")];
  if (!all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
    return;
  }
  const checkedCount = all.filter((c) => c.checked).length;
  if (checkedCount === 0) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
  } else if (checkedCount === all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = true;
  } else {
    masterChk.indeterminate = true;
  }
}

async function rmGenerateSpec() {
  if (!rmCurrentGroupId) return;
  const btn = document.getElementById("rmGenerateSpecBtn");
  const rmBanner = document.getElementById("rmBanner");
  btn.disabled = true;
  btn.textContent = "Generating...";
  showBanner(rmBanner, "info", "Generating base spec profile from protocol...");

  const specName = `RM | ${rmCurrentGroupLabel} | v1`;
  const { error } = await labSupabase.rpc(
    "fn_generate_inv_group_spec_profile",
    {
      p_subject_type: "RM",
      p_inv_group_id: Number(rmCurrentGroupId),
      p_spec_name: specName,
      p_version_no: 1,
      p_remarks: "Generated from protocol via Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(rmBanner, "error", "Generation failed: " + error.message);
    resetGenerateButton(btn);
    return;
  }

  toast("RM base spec profile generated successfully.", "success");
  resetGenerateButton(btn);
  btn.classList.add("hidden");
  await rmLoadGroupContext(rmCurrentGroupId);
}

async function rmSaveSpec() {
  if (!rmCurrentProfileId || rmEditedSpecLines.size === 0) return;
  const btn = document.getElementById("rmSaveSpecBtn");
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const edits = Array.from(rmEditedSpecLines.values());
  const { data, error } = await labSupabase.rpc(
    "fn_create_new_spec_version_from_edits",
    {
      p_source_spec_profile_id: rmCurrentProfileId,
      p_edits: edits,
      p_remarks: "Edited via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Save failed: " + error.message, "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Save Spec";
    return;
  }

  const newProfileId = Number(data);
  rmCurrentProfileId = newProfileId;

  const getAffectedCount = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (
      typeof val === "string" &&
      val.trim() !== "" &&
      !Number.isNaN(Number(val))
    ) {
      return Number(val);
    }
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === "number") return first;
      if (first && typeof first === "object") {
        for (const k of ["count", "affected_count", "affected", "result"]) {
          if (first[k] !== undefined && !Number.isNaN(Number(first[k]))) {
            return Number(first[k]);
          }
        }
      }
    }
    if (val && typeof val === "object") {
      for (const k of ["count", "affected_count", "affected", "result"]) {
        if (val[k] !== undefined && !Number.isNaN(Number(val[k]))) {
          return Number(val[k]);
        }
      }
    }
    return null;
  };

  const { data: mapData, error: mapErr } = await labSupabase.rpc(
    "fn_set_active_rm_group_spec_profile_family",
    {
      p_inv_group_id: Number(rmCurrentGroupId),
      p_spec_profile_id: newProfileId,
      p_remarks: "Activated via Spec Profile Manager family-aware save",
    },
  );
  if (mapErr) {
    toast(
      "Spec version saved but family-aware mapping update failed: " +
        mapErr.message,
      "warn",
    );
  } else {
    const affectedCount = getAffectedCount(mapData);
    if (affectedCount === null) {
      toast(
        "RM spec version saved and activated for inventory group.",
        "success",
      );
    } else {
      toast(
        `Spec version saved and activated for ${affectedCount} equivalent raw material group record(s).`,
        "success",
      );
    }
  }

  rmEditedSpecLines.clear();
  rmSyncSaveBtn();
  btn.disabled = false;
  btn.classList.remove("loading");
  btn.textContent = "Save Spec";

  const { data: meta, error: metaErr } = await labSupabase
    .from("spec_profile")
    .select("id, spec_name, version_no, effective_from")
    .eq("id", newProfileId)
    .single();

  if (!metaErr && meta) {
    const rmMetaProfileId = document.getElementById("rmMetaProfileId");
    const rmMetaVersion = document.getElementById("rmMetaVersion");
    const rmMetaEffDate = document.getElementById("rmMetaEffDate");
    setMetaValue(rmMetaProfileId, String(meta.id), false);
    setMetaValue(rmMetaVersion, `v${meta.version_no}`, false);
    setMetaValue(rmMetaEffDate, formatDate(meta.effective_from), false);
  }
  await rmLoadSpecLines(newProfileId);
}

function rmResetState() {
  rmCurrentProfileId = null;
  rmCurrentGroupId = null;
  rmCurrentGroupLabel = null;
  rmEditedSpecLines.clear();
  const rmContextStrip = document.getElementById("rmContextStrip");
  const rmBanner = document.getElementById("rmBanner");
  rmControlCard.classList.add("hidden");
  rmTableCard.classList.add("hidden");
  if (rmContextStrip) rmContextStrip.classList.add("hidden");
  if (rmBanner) hideBanner(rmBanner);
  if (rmGenerateSpecBtn) rmGenerateSpecBtn.classList.add("hidden");
  if (rmRebuildSpecBtn) rmRebuildSpecBtn.classList.add("hidden");
  refreshPendingRequestButtons();
}

// ── BASE SPEC — PM ────────────────────────────────────────────────────────────

async function loadPmGroups() {
  const pmGroupSelect = document.getElementById("pmGroupSelect");
  if (!pmGroupSelect) return;
  pmGroupSelect.disabled = true;
  pmGroupSelect.innerHTML = '<option value="">Loading...</option>';

  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("subcategory_id, subcategory_label")
    .eq("category_code", "PLM")
    .order("subcategory_label");

  if (error) {
    toast("Failed to load PM inventory groups: " + error.message, "error");
    pmGroupSelect.innerHTML = '<option value="">-- Error --</option>';
    pmGroupSelect.disabled = false;
    return;
  }

  const seen = new Map();
  for (const row of data ?? []) {
    const key = row.subcategory_id;
    if (!seen.has(key)) {
      seen.set(key, {
        subcategory_id: row.subcategory_id,
        subcategory_label: row.subcategory_label,
      });
    }
  }
  const deduped = [...seen.values()].sort((a, b) =>
    (a.subcategory_label ?? "").localeCompare(b.subcategory_label ?? ""),
  );

  populateSelect(
    pmGroupSelect,
    deduped,
    "subcategory_id",
    "subcategory_label",
    "-- Select Packing Material Subcategory --",
  );
  pmGroupSelect.disabled = false;
}

function wireBaseSpecPmEvents() {
  const pmGroupSelect = document.getElementById("pmGroupSelect");
  const pmSaveSpecBtn = document.getElementById("pmSaveSpecBtn");
  if (pmGroupSelect) pmGroupSelect.addEventListener("change", onPmGroupChange);
  if (pmGenerateSpecBtn)
    pmGenerateSpecBtn.addEventListener("click", pmGenerateSpec);
  if (pmRebuildSpecBtn)
    pmRebuildSpecBtn.addEventListener("click", () => openRebuildModal("PM"));
  if (pmSaveSpecBtn) pmSaveSpecBtn.addEventListener("click", pmSaveSpec);
}

async function onPmGroupChange() {
  const pmGroupSelect = document.getElementById("pmGroupSelect");
  const groupId = pmGroupSelect?.value;
  if (!groupId) {
    pmResetState();
    return;
  }
  pmCurrentGroupId = groupId;
  pmCurrentGroupLabel = pmGroupSelect.options[pmGroupSelect.selectedIndex].text;

  const pmBanner = document.getElementById("pmBanner");
  const pmContextStrip = document.getElementById("pmContextStrip");
  const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
  const pmMetaProfileId = document.getElementById("pmMetaProfileId");
  const pmMetaVersion = document.getElementById("pmMetaVersion");
  const pmMetaEffDate = document.getElementById("pmMetaEffDate");

  pmControlCard.classList.remove("hidden");
  pmTableCard.classList.add("hidden");
  hideBanner(pmBanner);
  pmGenerateSpecBtn.classList.add("hidden");
  pmContextStrip.classList.add("hidden");
  pmEditedSpecLines.clear();
  pmSyncSaveBtn();

  setMetaValue(pmMetaProfileId, "--", true);
  setMetaValue(pmMetaVersion, "--", true);
  setMetaValue(pmMetaEffDate, "--", true);

  await pmLoadGroupContext(groupId);
  await refreshPendingSpecRequestIndicators({ reload: true });
}

async function pmLoadGroupContext(groupId) {
  const pmBanner = document.getElementById("pmBanner");
  const pmContextStrip = document.getElementById("pmContextStrip");
  const pmProtocolName = document.getElementById("pmProtocolName");
  const pmBaseSpecName = document.getElementById("pmBaseSpecName");
  const pmBaseSpecVersion = document.getElementById("pmBaseSpecVersion");
  const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
  const pmMetaProfileId = document.getElementById("pmMetaProfileId");
  const pmMetaVersion = document.getElementById("pmMetaVersion");
  const pmMetaEffDate = document.getElementById("pmMetaEffDate");

  showBanner(pmBanner, "info", "Loading group protocol and spec info...");

  // Step A: protocol via RPC
  const { data: protocolCategoryId, error: mapErr } = await labSupabase.rpc(
    "fn_get_active_protocol_category_id_for_pm_subcategory",
    {
      p_subcategory_id: Number(groupId),
    },
  );
  if (mapErr) {
    showBanner(
      pmBanner,
      "error",
      "Could not load protocol mapping: " + mapErr.message,
    );
    return;
  }

  // Step B: protocol name
  let protocolName = null;
  if (protocolCategoryId) {
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (!catErr && catRows?.length) {
      protocolName = catRows[0].category_name ?? null;
    }
  }

  // Step C: spec profile via RPC
  const { data: specProfileId, error: specMapErr } = await labSupabase.rpc(
    "fn_get_active_spec_profile_id_for_pm_subcategory",
    {
      p_subcategory_id: Number(groupId),
      p_as_of_date: new Date().toISOString().slice(0, 10),
    },
  );
  if (specMapErr) {
    showBanner(
      pmBanner,
      "error",
      "Could not load base spec mapping: " + specMapErr.message,
    );
    return;
  }

  // Step D: spec profile details
  let specProfile = null;
  if (specProfileId) {
    const { data: spRows, error: spErr } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from, is_active")
      .eq("id", specProfileId)
      .limit(1);
    if (!spErr && spRows?.length) {
      specProfile = spRows[0];
    }
  }

  pmProtocolName.textContent = protocolName ?? "None";
  pmProtocolName.classList.toggle("not-set", !protocolName);
  pmBaseSpecName.textContent = specProfile
    ? (specProfile.spec_name ?? `Profile #${specProfile.id}`)
    : "Not set";
  pmBaseSpecName.classList.toggle("not-set", !specProfile);
  pmBaseSpecVersion.textContent = specProfile
    ? String(specProfile.version_no)
    : "--";
  pmBaseSpecVersion.classList.toggle("not-set", !specProfile);
  pmContextStrip.classList.remove("hidden");

  if (specProfile) {
    pmCurrentProfileId = specProfile.id;
    setMetaValue(pmMetaProfileId, String(specProfile.id), false);
    setMetaValue(pmMetaVersion, `v${specProfile.version_no}`, false);
    setMetaValue(pmMetaEffDate, formatDate(specProfile.effective_from), false);
    pmGenerateSpecBtn?.classList.add("hidden");
    pmRebuildSpecBtn?.classList.remove("hidden");
    hideBanner(pmBanner);
    await pmLoadSpecLines(specProfile.id);
  } else {
    pmCurrentProfileId = null;
    setMetaValue(pmMetaProfileId, "--", true);
    setMetaValue(pmMetaVersion, "--", true);
    setMetaValue(pmMetaEffDate, "--", true);
    if (protocolName) {
      pmGenerateSpecBtn?.classList.remove("hidden");
      pmRebuildSpecBtn?.classList.add("hidden");
      showBanner(
        pmBanner,
        "warn",
        "No base spec profile found for this packing material subcategory. Use Generate Spec to create one from the protocol.",
      );
    } else {
      pmGenerateSpecBtn?.classList.add("hidden");
      pmRebuildSpecBtn?.classList.add("hidden");
      showBanner(
        pmBanner,
        "info",
        "No protocol or base spec profile is configured for this packing material subcategory.",
      );
    }
  }
}

async function pmLoadSpecLines(profileId) {
  const pmBanner = document.getElementById("pmBanner");
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_id, test_name, method_name, display_text, spec_type, min_value, max_value, text_value, spec_line_is_active, uom_id, uom_code, uom_name, uom_symbol",
    )
    .eq("spec_profile_id", profileId)
    .order("seq_no");

  if (error) {
    showBanner(
      pmBanner,
      "error",
      "Could not load spec lines: " + error.message,
    );
    return;
  }
  pmRenderSpecLines(data ?? []);
}

function pmRenderSpecLines(rows) {
  const pmLineCount = document.getElementById("pmLineCount");
  const pmTableBodyEl = document.getElementById("pmTableBody");

  // Cache rows for re-render after modal edits (do NOT clear pmEditedSpecLines here)
  pmLoadedRows = rows;
  pmTableCard.classList.remove("hidden");

  const countActive = rows.filter((r) => {
    const p = pmEditedSpecLines.get(r.seq_no);
    return p ? p.is_active : !!r.spec_line_is_active;
  }).length;
  const totalCount = rows.length;
  pmLineCount.textContent =
    countActive === totalCount
      ? `${totalCount} line${totalCount !== 1 ? "s" : ""}`
      : `${countActive} active / ${totalCount} total`;

  if (!rows.length) {
    pmTableBodyEl.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    pmSyncSaveBtn();
    return;
  }

  pmTableBodyEl.innerHTML = rows
    .map((r) => {
      const seqNo = r.seq_no;
      const pending = pmEditedSpecLines.get(seqNo);
      const dispType = pending
        ? normalizeBaseSpecTypeValue(pending.spec_type)
        : normalizeBaseSpecTypeValue(r.spec_type ?? "");
      const dispText = pending
        ? (pending.display_text ?? "")
        : (r.display_text ?? "");
      const isActive = pending ? pending.is_active : !!r.spec_line_is_active;
      const origActive = !!r.spec_line_is_active;
      return `<tr data-seq="${esc(String(seqNo))}"
          data-test-id="${esc(String(r.test_id ?? ""))}"
          data-test-name="${esc(r.test_name ?? "")}"
          data-method-name="${esc(r.method_name ?? "")}"
          data-orig-spec-type="${esc(normalizeBaseSpecTypeValue(r.spec_type ?? ""))}"
          data-orig-min="${esc(String(r.min_value ?? ""))}"
          data-orig-max="${esc(String(r.max_value ?? ""))}"
          data-orig-text="${esc(r.text_value ?? "")}"
          data-orig-display="${esc(r.display_text ?? "")}"
          data-orig-uom-id="${esc(String(r.uom_id ?? ""))}"
          data-orig-uom-symbol="${esc(r.uom_symbol ?? "")}"
          data-orig-active="${origActive ? "1" : "0"}"
          class="${isActive ? "" : "bs-row-inactive"}">
        <td class="td-seq">${esc(String(seqNo))}</td>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td class="td-method">${esc(r.method_name ?? "")}</td>
        <td>${typeBadge(dispType)}</td>
        <td class="bs-display-text-cell${pending ? " pending" : ""}">${esc(dispText)}</td>
        <td class="td-active">
          <input class="spec-active pm-active-chk" type="checkbox"
                 ${isActive ? "checked" : ""} aria-label="Active" />
        </td>
        <td class="td-edit-col">
          <button class="bs-edit-btn" aria-label="Edit spec line" title="Edit specification values">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  pmTableBodyEl.querySelectorAll("tr[data-seq]").forEach((tr) => {
    const chk = tr.querySelector(".pm-active-chk");
    const editBtn = tr.querySelector(".bs-edit-btn");
    const seqNo = Number(tr.dataset.seq);
    const origActive = tr.dataset.origActive === "1";

    chk.addEventListener("change", () => {
      const newActive = chk.checked;
      const existing = pmEditedSpecLines.get(seqNo);
      if (existing) {
        pmEditedSpecLines.set(seqNo, { ...existing, is_active: newActive });
      } else if (newActive !== origActive) {
        pmEditedSpecLines.set(seqNo, {
          seq_no: seqNo,
          spec_type: tr.dataset.origSpecType || null,
          min_value:
            tr.dataset.origMin !== "" ? Number(tr.dataset.origMin) : null,
          max_value:
            tr.dataset.origMax !== "" ? Number(tr.dataset.origMax) : null,
          text_value: tr.dataset.origText || null,
          uom_id:
            tr.dataset.origUomId !== "" ? Number(tr.dataset.origUomId) : null,
          uom_symbol: tr.dataset.origUomSymbol || null,
          display_text: tr.dataset.origDisplay || null,
          is_active: newActive,
        });
      } else {
        pmEditedSpecLines.delete(seqNo);
      }
      tr.classList.toggle("bs-row-inactive", !newActive);
      pmSyncSaveBtn();
      pmSyncActiveAllCheckbox();
    });

    editBtn.addEventListener("click", () => openBsLineModal("PM", seqNo));
  });

  pmWireActiveAllCheckbox();
  pmSyncSaveBtn();
}

function pmSyncSaveBtn() {
  const pmSaveSpecBtn = document.getElementById("pmSaveSpecBtn");
  if (pmSaveSpecBtn)
    pmSaveSpecBtn.classList.toggle("hidden", pmEditedSpecLines.size === 0);
}

function pmWireActiveAllCheckbox() {
  const masterChk = document.getElementById("pmActiveAllChk");
  const pmTableBodyEl = document.getElementById("pmTableBody");
  if (!masterChk || !pmTableBodyEl) return;

  pmSyncActiveAllCheckbox();

  masterChk.addEventListener("change", () => {
    const target = masterChk.checked;
    pmTableBodyEl.querySelectorAll(".pm-active-chk").forEach((chk) => {
      if (chk.checked !== target) {
        chk.checked = target;
        chk.dispatchEvent(new Event("change", { bubbles: false }));
      }
    });
    masterChk.indeterminate = false;
    masterChk.checked = target;
  });
}

function pmSyncActiveAllCheckbox() {
  const masterChk = document.getElementById("pmActiveAllChk");
  const pmTableBodyEl = document.getElementById("pmTableBody");
  if (!masterChk || !pmTableBodyEl) return;
  const all = [...pmTableBodyEl.querySelectorAll(".pm-active-chk")];
  if (!all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
    return;
  }
  const checkedCount = all.filter((c) => c.checked).length;
  if (checkedCount === 0) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
  } else if (checkedCount === all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = true;
  } else {
    masterChk.indeterminate = true;
  }
}

async function pmGenerateSpec() {
  if (!pmCurrentGroupId) return;
  const btn = document.getElementById("pmGenerateSpecBtn");
  const pmBanner = document.getElementById("pmBanner");
  btn.disabled = true;
  btn.textContent = "Generating...";
  showBanner(pmBanner, "info", "Generating base spec profile from protocol...");

  const specName = `PM | Subcategory | ${pmCurrentGroupLabel} | v1`;
  const { error } = await labSupabase.rpc(
    "fn_generate_pm_subcategory_spec_profile",
    {
      p_subcategory_id: Number(pmCurrentGroupId),
      p_spec_name: specName,
      p_version_no: 1,
      p_remarks: "Generated from protocol via Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(pmBanner, "error", "Generation failed: " + error.message);
    resetGenerateButton(btn);
    return;
  }

  toast("PM base spec profile generated successfully.", "success");
  resetGenerateButton(btn);
  btn.classList.add("hidden");
  await pmLoadGroupContext(pmCurrentGroupId);
}

async function pmSaveSpec() {
  if (!pmCurrentProfileId || pmEditedSpecLines.size === 0) return;
  const btn = document.getElementById("pmSaveSpecBtn");
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const edits = Array.from(pmEditedSpecLines.values());
  const { data, error } = await labSupabase.rpc(
    "fn_create_new_spec_version_from_edits",
    {
      p_source_spec_profile_id: pmCurrentProfileId,
      p_edits: edits,
      p_remarks: "Edited via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Save failed: " + error.message, "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Save Spec";
    return;
  }

  const newProfileId = Number(data);
  pmCurrentProfileId = newProfileId;

  const getAffectedCount = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (
      typeof val === "string" &&
      val.trim() !== "" &&
      !Number.isNaN(Number(val))
    ) {
      return Number(val);
    }
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === "number") return first;
      if (first && typeof first === "object") {
        for (const k of ["count", "affected_count", "affected", "result"]) {
          if (first[k] !== undefined && !Number.isNaN(Number(first[k]))) {
            return Number(first[k]);
          }
        }
      }
    }
    if (val && typeof val === "object") {
      for (const k of ["count", "affected_count", "affected", "result"]) {
        if (val[k] !== undefined && !Number.isNaN(Number(val[k]))) {
          return Number(val[k]);
        }
      }
    }
    return null;
  };

  const { data: mapData, error: mapErr } = await labSupabase.rpc(
    "fn_set_active_pm_subcategory_spec_profile_family",
    {
      p_subcategory_id: Number(pmCurrentGroupId),
      p_spec_profile_id: newProfileId,
      p_remarks: "Activated via Spec Profile Manager family-aware save",
    },
  );
  if (mapErr) {
    toast(
      "Spec version saved but family-aware mapping update failed: " +
        mapErr.message,
      "warn",
    );
  } else {
    const affectedCount = getAffectedCount(mapData);
    if (affectedCount === null) {
      toast(
        "PM spec version saved and activated for packing material subcategory.",
        "success",
      );
    } else {
      toast(
        `Spec version saved and activated for ${affectedCount} equivalent packing material subcategory record(s).`,
        "success",
      );
    }
  }

  pmEditedSpecLines.clear();
  pmSyncSaveBtn();
  btn.disabled = false;
  btn.classList.remove("loading");
  btn.textContent = "Save Spec";

  const { data: meta, error: metaErr } = await labSupabase
    .from("spec_profile")
    .select("id, spec_name, version_no, effective_from")
    .eq("id", newProfileId)
    .single();

  if (!metaErr && meta) {
    const pmMetaProfileId = document.getElementById("pmMetaProfileId");
    const pmMetaVersion = document.getElementById("pmMetaVersion");
    const pmMetaEffDate = document.getElementById("pmMetaEffDate");
    setMetaValue(pmMetaProfileId, String(meta.id), false);
    setMetaValue(pmMetaVersion, `v${meta.version_no}`, false);
    setMetaValue(pmMetaEffDate, formatDate(meta.effective_from), false);
  }
  await pmLoadSpecLines(newProfileId);
}

function pmResetState() {
  pmCurrentProfileId = null;
  pmCurrentGroupId = null;
  pmCurrentGroupLabel = null;
  pmEditedSpecLines.clear();
  const pmContextStrip = document.getElementById("pmContextStrip");
  const pmBanner = document.getElementById("pmBanner");
  pmControlCard.classList.add("hidden");
  pmTableCard.classList.add("hidden");
  if (pmContextStrip) pmContextStrip.classList.add("hidden");
  if (pmBanner) hideBanner(pmBanner);
  if (pmGenerateSpecBtn) pmGenerateSpecBtn.classList.add("hidden");
  if (pmRebuildSpecBtn) pmRebuildSpecBtn.classList.add("hidden");
  refreshPendingRequestButtons();
}

function wireRebuildModal() {
  rebuildModalClose?.addEventListener("click", closeRebuildModal);
  rebuildCancelBtn?.addEventListener("click", closeRebuildModal);

  rebuildModal?.addEventListener("click", (e) => {
    if (e.target === rebuildModal) closeRebuildModal();
  });

  rebuildSafeBtn?.addEventListener("click", () => executeRebuild("SAFE"));
  rebuildFullResetBtn?.addEventListener("click", () =>
    executeRebuild("FULL_RESET"),
  );
}

function ensureFullResetConfirmModal() {
  if (fullResetConfirmModal) return fullResetConfirmModal;

  const modal = document.createElement("div");
  modal.id = "fullResetConfirmModal";
  modal.className = "ov-modal-backdrop hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "fullResetConfirmTitle");
  modal.innerHTML = `
    <div class="ov-modal" style="max-width: 500px; width: calc(100% - 24px); min-width: 0; min-height: 320px; max-height: calc(100vh - 48px);">
      <div class="ov-modal-header">
        <h2 class="ov-modal-title" id="fullResetConfirmTitle">Confirm Full Reset</h2>
        <button type="button" class="ov-modal-close" id="fullResetConfirmClose" aria-label="Close">&times;</button>
      </div>
      <div class="ov-modal-body" id="fullResetConfirmBody" style="display:flex;flex-direction:column;gap:12px;padding:16px 18px 18px;min-height:0;">
        <div class="spec-info-banner warn" style="margin:0;padding:12px 14px;line-height:1.45;">
          Full Reset will create a new Base Spec version using only the current mapped protocol.
          Existing manually entered specification values will not be carried forward.
        </div>
        <div id="fullResetConfirmContext" style="font-size:13px;line-height:1.4;color:var(--muted,#6b7280);">
          —
        </div>
      </div>
      <div class="ov-modal-footer" style="padding:12px 18px;gap:10px;">
        <button type="button" class="btn-secondary" id="fullResetConfirmCancel">Cancel</button>
        <button type="button" class="btn-primary" id="fullResetConfirmOk" style="background:#dc2626;border-color:#dc2626;box-shadow:none;">
          Full Reset
        </button>
      </div>
    </div>
  `;

  const closeBtn = modal.querySelector("#fullResetConfirmClose");
  const cancelBtn = modal.querySelector("#fullResetConfirmCancel");
  const okBtn = modal.querySelector("#fullResetConfirmOk");

  const resolveAndClose = (value) => {
    if (fullResetConfirmResolve) {
      const resolver = fullResetConfirmResolve;
      fullResetConfirmResolve = null;
      resolver(value);
    }
    modal.classList.add("hidden");
  };

  closeBtn?.addEventListener("click", () => resolveAndClose(false));
  cancelBtn?.addEventListener("click", () => resolveAndClose(false));
  okBtn?.addEventListener("click", () => resolveAndClose(true));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) resolveAndClose(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal.classList.contains("hidden")) return;
    e.preventDefault();
    resolveAndClose(false);
  });

  document.body.appendChild(modal);
  fullResetConfirmModal = modal;
  return modal;
}

async function showFullResetConfirmModal(contextText) {
  const modal = ensureFullResetConfirmModal();
  const contextEl = modal.querySelector("#fullResetConfirmContext");
  if (contextEl) {
    contextEl.textContent =
      contextText || "Proceed with a full reset for this mapped protocol?";
  }

  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    fullResetConfirmResolve = resolve;
  });
}

function openRebuildModal(subject) {
  rebuildSubject = subject;

  if (subject === "FG") {
    rebuildFamilyId = bsCurrentGroupId;
    rebuildFamilyLabel = bsCurrentGroupName;
  } else if (subject === "RM") {
    rebuildFamilyId = rmCurrentGroupId;
    rebuildFamilyLabel = rmCurrentGroupLabel;
  } else if (subject === "PM") {
    rebuildFamilyId = pmCurrentGroupId;
    rebuildFamilyLabel = pmCurrentGroupLabel;
  }

  if (!rebuildFamilyId) {
    toast("Select a family before rebuilding.", "warn");
    return;
  }

  rebuildModalContext.textContent = `${subject} · ${rebuildFamilyLabel || "Selected family"}`;
  rebuildModal.classList.remove("hidden");
}

function closeRebuildModal() {
  rebuildModal.classList.add("hidden");
  rebuildSubject = null;
  rebuildFamilyId = null;
  rebuildFamilyLabel = null;
  setRebuildButtonsLoading(false);
}

function setRebuildButtonsLoading(isLoading) {
  [rebuildSafeBtn, rebuildFullResetBtn].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle("loading", isLoading);
  });
}

async function executeRebuild(mode) {
  if (!rebuildSubject || !rebuildFamilyId) {
    toast("Rebuild context is missing.", "error");
    return;
  }

  if (mode === "FULL_RESET") {
    const ok = await showFullResetConfirmModal(
      `${rebuildSubject} · ${rebuildFamilyLabel || "Selected family"}`,
    );
    if (!ok) return;
  }

  const subject = rebuildSubject;
  const familyId = Number(rebuildFamilyId);

  setRebuildButtonsLoading(true);

  const { data, error } = await labSupabase.rpc(
    "fn_rebuild_base_spec_from_protocol",
    {
      p_subject_type: subject,
      p_family_id: familyId,
      p_rebuild_mode: mode,
      p_remarks:
        mode === "SAFE"
          ? "Safe rebuild from mapped protocol via Spec Profile Manager"
          : "Full reset from mapped protocol via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Rebuild failed: " + error.message, "error");
    setRebuildButtonsLoading(false);
    return;
  }

  const result = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
  const newProfileId = Number(result.spec_profile_id || 0);
  const createdNew = result.created_new_version === true;
  const message =
    result.message ||
    (createdNew
      ? "Base spec rebuild completed. A new version was created."
      : "No rebuild required. Active base spec is already aligned with the mapped protocol.");

  toast(message, createdNew ? "success" : "info");

  closeRebuildModal();

  await refreshAfterRebuild(subject, newProfileId);
}

async function refreshAfterRebuild(subject, newProfileId) {
  if (subject === "FG") {
    const previousProfileId = bsCurrentProfileId;
    bsEditedSpecLines.clear();
    bsSyncSaveBtn();

    await bsLoadGroupContext(bsCurrentGroupId);

    if (newProfileId && previousProfileId !== newProfileId) {
      bsCurrentProfileId = newProfileId;
      await bsLoadSpecLines(newProfileId);
    }
    return;
  }

  if (subject === "RM") {
    const previousProfileId = rmCurrentProfileId;
    rmEditedSpecLines.clear();
    rmSyncSaveBtn();

    await rmLoadGroupContext(rmCurrentGroupId);

    if (newProfileId && previousProfileId !== newProfileId) {
      rmCurrentProfileId = newProfileId;
      await rmLoadSpecLines(newProfileId);
    }
    return;
  }

  if (subject === "PM") {
    const previousProfileId = pmCurrentProfileId;
    pmEditedSpecLines.clear();
    pmSyncSaveBtn();

    await pmLoadGroupContext(pmCurrentGroupId);

    if (newProfileId && previousProfileId !== newProfileId) {
      pmCurrentProfileId = newProfileId;
      await pmLoadSpecLines(newProfileId);
    }
  }
}

// ── OVERRIDES — PM ────────────────────────────────────────────────────────────

async function loadPmItems(selectEl) {
  selectEl.disabled = true;
  selectEl.innerHTML = '<option value="">Loading...</option>';
  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("stock_item_id, stock_item_name")
    .eq("category_code", "PLM")
    .order("stock_item_name");

  if (error) {
    toast("Failed to load PM stock items: " + error.message, "error");
    selectEl.innerHTML = '<option value="">-- Error --</option>';
    selectEl.disabled = false;
    return;
  }
  const seen = new Set();
  const unique = [];
  for (const row of data ?? []) {
    if (!seen.has(row.stock_item_id)) {
      seen.add(row.stock_item_id);
      unique.push(row);
    }
  }
  populateSelect(
    selectEl,
    unique,
    "stock_item_id",
    "stock_item_name",
    "-- Select Packing Material --",
  );
  selectEl.disabled = false;
}

function wireOverridesPmEvents() {
  ovPmItemSelect.addEventListener("change", onPmOverrideItemChange);
}

async function onPmOverrideItemChange() {
  const stockItemId = ovPmItemSelect.value;
  if (!stockItemId) {
    ovPmItemId = null;
    ovPmContextStrip.classList.add("hidden");
    ovPmTableCard.classList.add("hidden");
    hideBanner(ovPmBanner);
    refreshPendingRequestButtons();
    return;
  }
  ovPmItemId = stockItemId;
  ovPmContextStrip.classList.add("hidden");
  ovPmTableCard.classList.add("hidden");
  hideBanner(ovPmBanner);
  showBanner(ovPmBanner, "info", "Loading stock item context...");

  const { data: grpData, error: grpErr } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("subcategory_id, subcategory_label")
    .eq("stock_item_id", stockItemId)
    .eq("category_code", "PLM")
    .limit(1);

  if (grpErr) {
    showBanner(
      ovPmBanner,
      "error",
      "Could not resolve packing material subcategory: " + grpErr.message,
    );
    return;
  }

  const subcat = grpData?.[0];
  if (!subcat) {
    showBanner(
      ovPmBanner,
      "warn",
      "Packing material subcategory mapping not found for this stock item.",
    );
    return;
  }

  ovPmGroupName.textContent = subcat.subcategory_label ?? "--";
  ovPmGroupName.classList.toggle("not-set", !subcat.subcategory_label);

  let baseSpecProfileId = null;
  if (subcat.subcategory_id) {
    const { data: resolvedSpecId, error: specErr } = await labSupabase.rpc(
      "fn_get_active_spec_profile_id_for_pm_subcategory",
      {
        p_subcategory_id: Number(subcat.subcategory_id),
        p_as_of_date: todayISO(),
      },
    );

    if (specErr) {
      showBanner(
        ovPmBanner,
        "error",
        "Could not resolve PM base spec profile: " + specErr.message,
      );
      setOverrideAddButtonState("PM", false);
      ovBaseSpecProfileId = null;
      ovBaseTestIds = new Set();
      return;
    }

    baseSpecProfileId = resolvedSpecId ? Number(resolvedSpecId) : null;
  }

  ovPmBaseSpecId.textContent = baseSpecProfileId
    ? String(baseSpecProfileId)
    : "Not set";
  ovPmBaseSpecId.classList.toggle("not-set", !baseSpecProfileId);
  ovPmContextStrip.classList.remove("hidden");

  ovBaseSpecProfileId = baseSpecProfileId ? Number(baseSpecProfileId) : null;
  await loadOverrideBaseTestIds(baseSpecProfileId);
  const canAddOverride = !!baseSpecProfileId;
  setOverrideAddButtonState("PM", canAddOverride);

  const { data: overrides, error: ovErr } = await labSupabase
    .from("spec_override")
    .select(
      "id, test_id, action_type, override_method_id, override_spec_type, override_min_value, override_max_value, override_text_value, override_display_text, override_is_required, override_uom_id, is_active, reason",
    )
    .eq("subject_type", "PM")
    .eq("stock_item_id", stockItemId);

  if (ovErr) {
    showBanner(
      ovPmBanner,
      "error",
      "Could not load overrides: " + ovErr.message,
    );
    return;
  }

  if (!overrides?.length) {
    if (!canAddOverride)
      showBanner(
        ovPmBanner,
        "warn",
        "No active base spec profile is configured. Overrides cannot be added until base spec is generated and mapped.",
      );
    else hideBanner(ovPmBanner);
    renderPmOverrides([]);
    refreshPendingRequestButtons();
    return;
  }

  const testIds = [...new Set(overrides.map((r) => r.test_id).filter(Boolean))];
  const methodIds = [
    ...new Set(overrides.map((r) => r.override_method_id).filter(Boolean)),
  ];
  const uomIds = [
    ...new Set(overrides.map((r) => r.override_uom_id).filter(Boolean)),
  ];

  const [testRes, methodRes, uomRes] = await Promise.all([
    testIds.length
      ? labSupabase
          .from("test_master")
          .select("id, test_name")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    methodIds.length
      ? labSupabase
          .from("test_method")
          .select("id, method_name")
          .in("id", methodIds)
      : Promise.resolve({ data: [] }),
    uomIds.length
      ? labSupabase
          .from("lab_uom")
          .select("id, uom_code, uom_name, symbol")
          .in("id", uomIds)
      : Promise.resolve({ data: [] }),
  ]);

  const testMap = Object.fromEntries(
    (testRes.data ?? []).map((r) => [r.id, r.test_name]),
  );
  const methodMap = Object.fromEntries(
    (methodRes.data ?? []).map((r) => [r.id, r.method_name]),
  );
  const uomMap = Object.fromEntries((uomRes.data ?? []).map((u) => [u.id, u]));

  const enriched = overrides.map((r) => {
    const uom = uomMap[r.override_uom_id] ?? null;
    return {
      ...r,
      test_name: testMap[r.test_id] ?? `(test #${r.test_id})`,
      override_method_name:
        methodMap[r.override_method_id] ??
        (r.override_method_id ? `(method #${r.override_method_id})` : ""),
      uom_code: uom?.uom_code ?? "",
      uom_name: uom?.uom_name ?? "",
      uom_symbol: uom?.symbol ?? "",
    };
  });
  enriched.sort((a, b) => {
    if (b.is_active !== a.is_active) return b.is_active ? 1 : -1;
    return (a.test_name ?? "").localeCompare(b.test_name ?? "");
  });

  if (!canAddOverride)
    showBanner(
      ovPmBanner,
      "warn",
      "No active base spec profile is configured. Overrides cannot be added until base spec is generated and mapped.",
    );
  else hideBanner(ovPmBanner);
  renderPmOverrides(enriched);
  refreshPendingRequestButtons();
}

function renderPmOverrides(rows) {
  ovPmTableCard.classList.remove("hidden");
  ovPmLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    ovPmTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No overrides found</strong>
        This packing material has no spec overrides configured.
      </div></td></tr>`;
    return;
  }

  ovPmTableBody.innerHTML = rows.map((r) => renderOverrideRow(r)).join("");
  wireOverrideTableEvents(ovPmTableBody);
}

// ── EFFECTIVE PREVIEW — PM ────────────────────────────────────────────────────

function wireEffectivePreviewPmEvents() {
  epPmItemSelect.addEventListener("change", onPmEffectivePreviewItemChange);
}

async function onPmEffectivePreviewItemChange() {
  const stockItemId = epPmItemSelect.value;
  if (!stockItemId) {
    epPmLineCount.textContent = "0 lines";
    epPmTableBody.innerHTML = "";
    epPmTableCard.classList.add("hidden");
    hideBanner(epPmBanner);
    return;
  }

  epPmTableCard.classList.add("hidden");
  hideBanner(epPmBanner);
  showBanner(epPmBanner, "info", "Resolving effective PM spec preview...");

  const { data, error } = await labSupabase.rpc(
    "fn_preview_effective_pm_spec_for_item",
    {
      p_stock_item_id: Number(stockItemId),
      p_as_of_date: todayISO(),
    },
  );

  if (error) {
    showBanner(
      epPmBanner,
      "error",
      "Could not resolve effective spec preview: " + error.message,
    );
    epPmLineCount.textContent = "0 lines";
    epPmTableBody.innerHTML = "";
    epPmTableCard.classList.add("hidden");
    return;
  }

  const preview = data || {};
  const rows = Array.isArray(preview.lines) ? preview.lines : [];

  if (preview.ok !== true) {
    const failType = String(preview.reason_code ?? "")
      .toUpperCase()
      .includes("ERR")
      ? "error"
      : "warn";
    showBanner(
      epPmBanner,
      failType,
      preview.message ||
        "No effective spec could be resolved for this packing material.",
    );
    epPmLineCount.textContent = "0 lines";
    epPmTableBody.innerHTML = "";
    epPmTableCard.classList.add("hidden");
    return;
  }

  if (!rows.length) {
    showBanner(
      epPmBanner,
      "warn",
      "No active effective specification lines found.",
    );
    epPmLineCount.textContent = "0 lines";
    epPmTableBody.innerHTML = "";
    epPmTableCard.classList.add("hidden");
    return;
  }

  const msgParts = [
    "Effective PM specification resolved from base spec and stock-item overrides.",
  ];
  const metaParts = [];
  if (preview.base_spec_profile_id) {
    metaParts.push(`Base: ${preview.base_spec_profile_id}`);
  }
  if (preview.protocol_category_id) {
    metaParts.push(`Protocol: ${preview.protocol_category_id}`);
  }
  if (preview.subcategory_id) {
    metaParts.push(`Subcategory: ${preview.subcategory_id}`);
  }
  if (metaParts.length) msgParts.push(metaParts.join(" | "));
  showBanner(epPmBanner, "info", msgParts.join(" "));

  renderPmEffectivePreview(rows);
}

function renderPmEffectivePreview(rows) {
  epPmTableCard.classList.remove("hidden");
  epPmLineCount.textContent = `${rows.length} line${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    epPmTableBody.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No lines found</strong>
        The effective spec profile has no lines.
      </div></td></tr>`;
    return;
  }

  epPmTableBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td class="td-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td class="td-test">${esc(r.test_name ?? "")}</td>
      <td class="td-method">${esc(r.method_name ?? "")}</td>
      <td class="td-spec">${esc(r.display_text ?? "")}</td>
      <td>${typeBadge(r.spec_type)}</td>
      <td>${sourceBadge(r.source_type)}</td>
      <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
        ${r.is_active === false ? "No" : "Yes"}
      </td>
    </tr>`,
    )
    .join("");
}

// FIX 2: use product_id / product_name
async function loadFgProducts(selectEl) {
  const searchInput =
    selectEl === ovProductSelect
      ? ovProductSearchInput
      : selectEl === epProductSelect
        ? epProductSearchInput
        : null;

  selectEl.disabled = true;
  selectEl.innerHTML = '<option value="">Loading...</option>';
  if (searchInput) {
    searchInput.disabled = true;
    searchInput.placeholder = "Loading products...";
  }
  const pageSize = 1000;
  let from = 0;
  let allRows = [];
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await labSupabase
      .from("v_sample_receipt_fg_picker")
      .select("product_id, product_name")
      .order("product_name", { ascending: true })
      .range(from, to);
    if (error) {
      toast("Failed to load products: " + error.message, "error");
      selectEl.innerHTML = '<option value="">-- Error --</option>';
      selectEl.disabled = false;
      if (searchInput) {
        searchInput.disabled = false;
        searchInput.placeholder = "Type to search product...";
      }
      return;
    }
    const rows = data ?? [];
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  const seen = new Map();
  for (const row of allRows) {
    if (!row.product_id) continue;
    if (!seen.has(row.product_id)) {
      seen.set(row.product_id, row);
    }
  }
  const uniqueRows = [...seen.values()].sort((a, b) =>
    String(a.product_name ?? "").localeCompare(String(b.product_name ?? "")),
  );
  fgProductPickerRows = uniqueRows;
  populateSelect(
    selectEl,
    uniqueRows,
    "product_id",
    "product_name",
    "-- Select Product --",
  );
  selectEl.disabled = false;
  if (searchInput) {
    searchInput.disabled = false;
    searchInput.placeholder = "Type to search product...";
  }
  syncFgProductSearchInputFromSelect(selectEl);
}

function wireOverridesEvents() {
  ovProductSelect.addEventListener("change", () => {
    syncFgProductSearchInputFromSelect(ovProductSelect);
    onOvProductChange();
  });
}

async function onOvProductChange() {
  const productId = ovProductSelect.value;
  if (!productId) {
    ovFgProductId = null;
    ovFgContextStrip.classList.add("hidden");
    ovTableCard.classList.add("hidden");
    hideBanner(ovBanner);
    refreshPendingRequestButtons();
    return;
  }
  ovFgProductId = productId;
  ovFgContextStrip.classList.add("hidden");
  ovTableCard.classList.add("hidden");
  hideBanner(ovBanner);
  showBanner(ovBanner, "info", "Loading product context...");

  // FIX 6: v_fg_product_with_group — only use product_group_id and product_group_name
  const { data: grpData, error: grpErr } = await labSupabase
    .from("v_fg_product_with_group")
    .select("product_group_id, product_group_name")
    .eq("product_id", productId)
    .limit(1);

  if (grpErr) {
    showBanner(
      ovBanner,
      "error",
      "Could not resolve product group: " + grpErr.message,
    );
    return;
  }

  const grp = grpData?.[0];
  if (!grp) {
    showBanner(
      ovBanner,
      "warn",
      "Product group mapping not found for this product.",
    );
    return;
  }

  ovFgGroupName.textContent = grp.product_group_name ?? "--";
  ovFgGroupName.classList.toggle("not-set", !grp.product_group_name);

  // Resolve base spec profile through canonical FG resolver RPC
  let baseSpecProfileId = null;
  if (grp.product_group_id) {
    const { data: resolvedSpecId, error: specErr } = await labSupabase.rpc(
      "fn_get_active_spec_profile_id_for_fg_group",
      {
        p_product_group_id: Number(grp.product_group_id),
        p_as_of_date: todayISO(),
      },
    );

    if (specErr) {
      showBanner(
        ovBanner,
        "error",
        "Could not resolve FG base spec profile: " + specErr.message,
      );
      setOverrideAddButtonState("FG", false);
      ovBaseSpecProfileId = null;
      ovBaseTestIds = new Set();
      return;
    }

    baseSpecProfileId = resolvedSpecId ? Number(resolvedSpecId) : null;
  }

  ovFgBaseSpecId.textContent = baseSpecProfileId
    ? String(baseSpecProfileId)
    : "Not set";
  ovFgBaseSpecId.classList.toggle("not-set", !baseSpecProfileId);
  ovFgContextStrip.classList.remove("hidden");

  ovBaseSpecProfileId = baseSpecProfileId ? Number(baseSpecProfileId) : null;
  await loadOverrideBaseTestIds(baseSpecProfileId);
  const canAddOverride = !!baseSpecProfileId;
  setOverrideAddButtonState("FG", canAddOverride);

  // FIX 5: load overrides, then join test_master + test_method in memory
  const { data: overrides, error: ovErr } = await labSupabase
    .from("spec_override")
    .select(
      "id, test_id, action_type, override_method_id, override_spec_type, override_min_value, override_max_value, override_text_value, override_display_text, override_is_required, override_uom_id, is_active, reason",
    )
    .eq("subject_type", "FG")
    .eq("product_id", productId);

  if (ovErr) {
    showBanner(ovBanner, "error", "Could not load overrides: " + ovErr.message);
    return;
  }

  if (!overrides?.length) {
    if (!canAddOverride)
      showBanner(
        ovBanner,
        "warn",
        "No active base spec profile is configured. Overrides cannot be added until base spec is generated and mapped.",
      );
    else hideBanner(ovBanner);
    renderOverrides([]);
    refreshPendingRequestButtons();
    return;
  }

  // Collect unique IDs for batch lookup
  const testIds = [...new Set(overrides.map((r) => r.test_id).filter(Boolean))];
  const methodIds = [
    ...new Set(overrides.map((r) => r.override_method_id).filter(Boolean)),
  ];
  const uomIds = [
    ...new Set(overrides.map((r) => r.override_uom_id).filter(Boolean)),
  ];

  const [testRes, methodRes, uomRes] = await Promise.all([
    testIds.length
      ? labSupabase
          .from("test_master")
          .select("id, test_name")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    methodIds.length
      ? labSupabase
          .from("test_method")
          .select("id, method_name")
          .in("id", methodIds)
      : Promise.resolve({ data: [] }),
    uomIds.length
      ? labSupabase
          .from("lab_uom")
          .select("id, uom_code, uom_name, symbol")
          .in("id", uomIds)
      : Promise.resolve({ data: [] }),
  ]);

  const testMap = Object.fromEntries(
    (testRes.data ?? []).map((r) => [r.id, r.test_name]),
  );
  const methodMap = Object.fromEntries(
    (methodRes.data ?? []).map((r) => [r.id, r.method_name]),
  );
  const uomMap = Object.fromEntries((uomRes.data ?? []).map((u) => [u.id, u]));

  const enriched = overrides.map((r) => {
    const uom = uomMap[r.override_uom_id] ?? null;
    return {
      ...r,
      test_name: testMap[r.test_id] ?? `(test #${r.test_id})`,
      override_method_name:
        methodMap[r.override_method_id] ??
        (r.override_method_id ? `(method #${r.override_method_id})` : ""),
      uom_code: uom?.uom_code ?? "",
      uom_name: uom?.uom_name ?? "",
      uom_symbol: uom?.symbol ?? "",
    };
  });

  // Sort: active first, then by test name
  enriched.sort((a, b) => {
    if (b.is_active !== a.is_active) return b.is_active ? 1 : -1;
    return (a.test_name ?? "").localeCompare(b.test_name ?? "");
  });

  if (!canAddOverride)
    showBanner(
      ovBanner,
      "warn",
      "No active base spec profile is configured. Overrides cannot be added until base spec is generated and mapped.",
    );
  else hideBanner(ovBanner);
  renderOverrides(enriched);
  refreshPendingRequestButtons();
}

function renderOverrides(rows) {
  ovTableCard.classList.remove("hidden");
  ovLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    ovTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No overrides found</strong>
        This product has no spec overrides configured.
      </div></td></tr>`;
    return;
  }

  ovTableBody.innerHTML = rows.map((r) => renderOverrideRow(r)).join("");
  wireOverrideTableEvents(ovTableBody);
}

// ── OVERRIDES — RM ────────────────────────────────────────────────────────────

async function loadRmItems(selectEl) {
  selectEl.disabled = true;
  selectEl.innerHTML = '<option value="">Loading...</option>';
  // Filter strictly to RM category — excludes PM and other item types
  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("stock_item_id, stock_item_name")
    .eq("category_code", "RM")
    .order("stock_item_name");

  if (error) {
    toast("Failed to load RM stock items: " + error.message, "error");
    selectEl.innerHTML = '<option value="">-- Error --</option>';
    selectEl.disabled = false;
    return;
  }
  // Dedupe by stock_item_id (view may return multiple rows per item for different groups)
  const seen = new Set();
  const unique = [];
  for (const row of data ?? []) {
    if (!seen.has(row.stock_item_id)) {
      seen.add(row.stock_item_id);
      unique.push(row);
    }
  }
  populateSelect(
    selectEl,
    unique,
    "stock_item_id",
    "stock_item_name",
    "-- Select Stock Item --",
  );
  selectEl.disabled = false;
}

function wireOverridesRmEvents() {
  ovRmItemSelect.addEventListener("change", onRmOverrideItemChange);
}

async function onRmOverrideItemChange() {
  const stockItemId = ovRmItemSelect.value;
  if (!stockItemId) {
    ovRmItemId = null;
    ovRmContextStrip.classList.add("hidden");
    ovRmTableCard.classList.add("hidden");
    hideBanner(ovRmBanner);
    refreshPendingRequestButtons();
    return;
  }
  ovRmItemId = stockItemId;
  ovRmContextStrip.classList.add("hidden");
  ovRmTableCard.classList.add("hidden");
  hideBanner(ovRmBanner);
  showBanner(ovRmBanner, "info", "Loading stock item context...");

  // Resolve inventory group
  const { data: grpData, error: grpErr } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("inv_group_id, inv_group_label")
    .eq("stock_item_id", stockItemId)
    .eq("category_code", "RM")
    .limit(1);

  if (grpErr) {
    showBanner(
      ovRmBanner,
      "error",
      "Could not resolve inventory group: " + grpErr.message,
    );
    return;
  }

  const grp = grpData?.[0];
  if (!grp) {
    showBanner(
      ovRmBanner,
      "warn",
      "Inventory group mapping not found for this stock item.",
    );
    return;
  }

  ovRmGroupName.textContent = grp.inv_group_label ?? "--";
  ovRmGroupName.classList.toggle("not-set", !grp.inv_group_label);

  // Resolve base spec profile
  let baseSpecProfileId = null;
  if (grp.inv_group_id) {
    const { data: resolvedSpecId, error: specErr } = await labSupabase.rpc(
      "fn_get_active_spec_profile_id_for_inv_group",
      {
        p_subject_type: "RM",
        p_inv_group_id: Number(grp.inv_group_id),
        p_as_of_date: todayISO(),
      },
    );

    if (specErr) {
      showBanner(
        ovRmBanner,
        "error",
        "Could not resolve RM base spec profile: " + specErr.message,
      );
      setOverrideAddButtonState("RM", false);
      ovBaseSpecProfileId = null;
      ovBaseTestIds = new Set();
      return;
    }

    baseSpecProfileId = resolvedSpecId ? Number(resolvedSpecId) : null;
  }

  ovRmBaseSpecId.textContent = baseSpecProfileId
    ? String(baseSpecProfileId)
    : "Not set";
  ovRmBaseSpecId.classList.toggle("not-set", !baseSpecProfileId);
  ovRmContextStrip.classList.remove("hidden");

  ovBaseSpecProfileId = baseSpecProfileId ? Number(baseSpecProfileId) : null;
  await loadOverrideBaseTestIds(baseSpecProfileId);
  const canAddOverride = !!baseSpecProfileId;
  setOverrideAddButtonState("RM", canAddOverride);

  // Load overrides
  const { data: overrides, error: ovErr } = await labSupabase
    .from("spec_override")
    .select(
      "id, test_id, action_type, override_method_id, override_spec_type, override_min_value, override_max_value, override_text_value, override_display_text, override_is_required, override_uom_id, is_active, reason",
    )
    .eq("subject_type", "RM")
    .eq("stock_item_id", stockItemId);

  if (ovErr) {
    showBanner(
      ovRmBanner,
      "error",
      "Could not load overrides: " + ovErr.message,
    );
    return;
  }

  if (!overrides?.length) {
    if (!canAddOverride)
      showBanner(
        ovRmBanner,
        "warn",
        "No active base spec profile is configured. Overrides cannot be added until base spec is generated and mapped.",
      );
    else hideBanner(ovRmBanner);
    renderRmOverrides([]);
    refreshPendingRequestButtons();
    return;
  }

  const testIds = [...new Set(overrides.map((r) => r.test_id).filter(Boolean))];
  const methodIds = [
    ...new Set(overrides.map((r) => r.override_method_id).filter(Boolean)),
  ];
  const uomIds = [
    ...new Set(overrides.map((r) => r.override_uom_id).filter(Boolean)),
  ];

  const [testRes, methodRes, uomRes] = await Promise.all([
    testIds.length
      ? labSupabase
          .from("test_master")
          .select("id, test_name")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    methodIds.length
      ? labSupabase
          .from("test_method")
          .select("id, method_name")
          .in("id", methodIds)
      : Promise.resolve({ data: [] }),
    uomIds.length
      ? labSupabase
          .from("lab_uom")
          .select("id, uom_code, uom_name, symbol")
          .in("id", uomIds)
      : Promise.resolve({ data: [] }),
  ]);

  const testMap = Object.fromEntries(
    (testRes.data ?? []).map((r) => [r.id, r.test_name]),
  );
  const methodMap = Object.fromEntries(
    (methodRes.data ?? []).map((r) => [r.id, r.method_name]),
  );
  const uomMap = Object.fromEntries((uomRes.data ?? []).map((u) => [u.id, u]));

  const enriched = overrides.map((r) => {
    const uom = uomMap[r.override_uom_id] ?? null;
    return {
      ...r,
      test_name: testMap[r.test_id] ?? `(test #${r.test_id})`,
      override_method_name:
        methodMap[r.override_method_id] ??
        (r.override_method_id ? `(method #${r.override_method_id})` : ""),
      uom_code: uom?.uom_code ?? "",
      uom_name: uom?.uom_name ?? "",
      uom_symbol: uom?.symbol ?? "",
    };
  });
  enriched.sort((a, b) => {
    if (b.is_active !== a.is_active) return b.is_active ? 1 : -1;
    return (a.test_name ?? "").localeCompare(b.test_name ?? "");
  });

  if (!canAddOverride)
    showBanner(
      ovRmBanner,
      "warn",
      "No active base spec profile is configured. Overrides cannot be added until base spec is generated and mapped.",
    );
  else hideBanner(ovRmBanner);
  renderRmOverrides(enriched);
  refreshPendingRequestButtons();
}

function renderRmOverrides(rows) {
  ovRmTableCard.classList.remove("hidden");
  ovRmLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    ovRmTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No overrides found</strong>
        This stock item has no spec overrides configured.
      </div></td></tr>`;
    return;
  }

  ovRmTableBody.innerHTML = rows.map((r) => renderOverrideRow(r)).join("");
  wireOverrideTableEvents(ovRmTableBody);
}

// ── EFFECTIVE PREVIEW — FG ────────────────────────────────────────────────────
function wireEffectivePreviewEvents() {
  epProductSelect.addEventListener("change", () => {
    syncFgProductSearchInputFromSelect(epProductSelect);
    onEpProductChange();
  });
}

function wireFgProductSearchComboboxes() {
  wireSingleFgProductSearchCombobox(
    ovProductSelect,
    ovProductSearchInput,
    ovProductSearchResults,
  );
  wireSingleFgProductSearchCombobox(
    epProductSelect,
    epProductSearchInput,
    epProductSearchResults,
  );
}

function wireSingleFgProductSearchCombobox(selectEl, inputEl, resultsEl) {
  if (!selectEl || !inputEl || !resultsEl) return;

  inputEl.addEventListener("focus", () => {
    renderFgProductSearchResults(selectEl, inputEl, resultsEl, inputEl.value);
  });

  inputEl.addEventListener("input", () => {
    const q = inputEl.value.trim();
    if (!q) {
      if (selectEl.value) {
        selectEl.value = "";
        selectEl.dispatchEvent(new Event("change", { bubbles: false }));
      }
    }
    renderFgProductSearchResults(selectEl, inputEl, resultsEl, q);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resultsEl.classList.add("hidden");
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (resultsEl.classList.contains("hidden")) {
        renderFgProductSearchResults(
          selectEl,
          inputEl,
          resultsEl,
          inputEl.value,
        );
      }

      const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
      if (!items.length) return;

      const currentIndex = Number(resultsEl.dataset.activeIndex ?? "-1");
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(currentIndex + 1, items.length - 1)
          : currentIndex <= 0
            ? 0
            : currentIndex - 1;

      setFgProductSearchActiveIndex(resultsEl, nextIndex);
      const activeBtn = items[nextIndex];
      activeBtn?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key !== "Enter") return;
    const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
    if (!items.length) return;
    const activeIndex = Number(resultsEl.dataset.activeIndex ?? "-1");
    const targetBtn = activeIndex >= 0 ? items[activeIndex] : items[0];
    if (!targetBtn) return;
    e.preventDefault();
    targetBtn.click();
  });

  inputEl.addEventListener("blur", () => {
    window.setTimeout(() => resultsEl.classList.add("hidden"), 120);
  });
}

function renderFgProductSearchResults(selectEl, inputEl, resultsEl, query) {
  if (!resultsEl || !inputEl || !selectEl) return;

  const needle = String(query ?? "")
    .trim()
    .toLowerCase();
  const baseRows = fgProductPickerRows ?? [];
  const filtered = needle
    ? baseRows.filter((r) =>
        String(r.product_name ?? "")
          .toLowerCase()
          .includes(needle),
      )
    : baseRows.slice(0, 40);

  const rows = filtered.slice(0, 120);
  if (!rows.length) {
    resultsEl.innerHTML =
      '<div class="erp-combobox-empty">No matching products</div>';
    resultsEl.dataset.activeIndex = "-1";
    resultsEl.classList.remove("hidden");
    return;
  }

  resultsEl.innerHTML = rows
    .map(
      (
        r,
      ) => `<button type="button" class="erp-combobox-item" data-id="${esc(String(r.product_id))}">
      ${esc(r.product_name ?? "")}
    </button>`,
    )
    .join("");

  resultsEl.querySelectorAll(".erp-combobox-item").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("mouseenter", () => {
      const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
      const idx = items.indexOf(btn);
      setFgProductSearchActiveIndex(resultsEl, idx);
    });
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const row = rows.find((x) => String(x.product_id) === id);
      if (!row) return;
      inputEl.value = row.product_name ?? "";
      selectEl.value = String(row.product_id);
      resultsEl.classList.add("hidden");
      selectEl.dispatchEvent(new Event("change", { bubbles: false }));
    });
  });

  const selectedIdx = rows.findIndex(
    (x) => String(x.product_id) === String(selectEl.value),
  );
  setFgProductSearchActiveIndex(resultsEl, selectedIdx >= 0 ? selectedIdx : 0);
  resultsEl.classList.remove("hidden");
}

function setFgProductSearchActiveIndex(resultsEl, idx) {
  const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
  const safeIdx = idx >= 0 && idx < items.length ? idx : -1;
  resultsEl.dataset.activeIndex = String(safeIdx);
  items.forEach((item, i) => {
    item.classList.toggle("active", i === safeIdx);
    item.setAttribute("aria-selected", i === safeIdx ? "true" : "false");
  });
}

function syncFgProductSearchInputFromSelect(selectEl) {
  if (!selectEl) return;

  const isOv = selectEl === ovProductSelect;
  const inputEl = isOv ? ovProductSearchInput : epProductSearchInput;
  const resultsEl = isOv ? ovProductSearchResults : epProductSearchResults;
  if (!inputEl || !resultsEl) return;

  if (!selectEl.value) {
    inputEl.value = "";
    resultsEl.classList.add("hidden");
    return;
  }

  const selectedText =
    selectEl.options[selectEl.selectedIndex]?.text ??
    fgProductPickerRows.find(
      (r) => String(r.product_id) === String(selectEl.value),
    )?.product_name ??
    "";
  inputEl.value = selectedText;
  resultsEl.classList.add("hidden");
}

// ── Product Group searchable combobox (Base Spec FG tab) ──────────────────────

function wireProductGroupSearchCombobox() {
  const inputEl = pgProductSearchInput;
  const resultsEl = pgProductSearchResults;
  const selectEl = productGroupSelect;
  if (!inputEl || !resultsEl || !selectEl) return;

  inputEl.addEventListener("focus", () => {
    renderPgSearchResults(inputEl.value);
  });

  inputEl.addEventListener("input", () => {
    const q = inputEl.value.trim();
    if (!q) {
      if (selectEl.value) {
        selectEl.value = "";
        selectEl.dispatchEvent(new Event("change", { bubbles: false }));
      }
    }
    renderPgSearchResults(q);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resultsEl.classList.add("hidden");
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (resultsEl.classList.contains("hidden")) {
        renderPgSearchResults(inputEl.value);
      }
      const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
      if (!items.length) return;
      const currentIndex = Number(resultsEl.dataset.activeIndex ?? "-1");
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(currentIndex + 1, items.length - 1)
          : currentIndex <= 0
            ? 0
            : currentIndex - 1;
      setPgSearchActiveIndex(nextIndex);
      items[nextIndex]?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key !== "Enter") return;
    const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
    if (!items.length) return;
    const activeIndex = Number(resultsEl.dataset.activeIndex ?? "-1");
    const targetBtn = activeIndex >= 0 ? items[activeIndex] : items[0];
    if (!targetBtn) return;
    e.preventDefault();
    targetBtn.click();
  });

  inputEl.addEventListener("blur", () => {
    window.setTimeout(() => resultsEl.classList.add("hidden"), 120);
  });
}

function renderPgSearchResults(query) {
  const inputEl = pgProductSearchInput;
  const resultsEl = pgProductSearchResults;
  const selectEl = productGroupSelect;
  if (!resultsEl || !inputEl || !selectEl) return;

  const needle = String(query ?? "")
    .trim()
    .toLowerCase();
  const baseRows = pgPickerRows ?? [];
  const filtered = needle
    ? baseRows.filter((r) =>
        String(r.group_name ?? "")
          .toLowerCase()
          .includes(needle),
      )
    : baseRows.slice(0, 40);

  const rows = filtered.slice(0, 120);
  if (!rows.length) {
    resultsEl.innerHTML =
      '<div class="erp-combobox-empty">No matching product groups</div>';
    resultsEl.dataset.activeIndex = "-1";
    resultsEl.classList.remove("hidden");
    return;
  }

  resultsEl.innerHTML = rows
    .map(
      (r) =>
        `<button type="button" class="erp-combobox-item" data-id="${esc(String(r.id))}">${esc(r.group_name ?? "")}</button>`,
    )
    .join("");

  resultsEl.querySelectorAll(".erp-combobox-item").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("mouseenter", () => {
      const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
      setPgSearchActiveIndex(items.indexOf(btn));
    });
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const row = rows.find((x) => String(x.id) === id);
      if (!row) return;
      inputEl.value = row.group_name ?? "";
      selectEl.value = String(row.id);
      resultsEl.classList.add("hidden");
      selectEl.dispatchEvent(new Event("change", { bubbles: false }));
    });
  });

  const selectedIdx = rows.findIndex(
    (x) => String(x.id) === String(selectEl.value),
  );
  setPgSearchActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  resultsEl.classList.remove("hidden");
}

function setPgSearchActiveIndex(idx) {
  const resultsEl = pgProductSearchResults;
  if (!resultsEl) return;
  const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
  const safeIdx = idx >= 0 && idx < items.length ? idx : -1;
  resultsEl.dataset.activeIndex = String(safeIdx);
  items.forEach((item, i) => {
    item.classList.toggle("active", i === safeIdx);
    item.setAttribute("aria-selected", i === safeIdx ? "true" : "false");
  });
}

function syncPgSearchInputFromSelect() {
  const inputEl = pgProductSearchInput;
  const resultsEl = pgProductSearchResults;
  const selectEl = productGroupSelect;
  if (!inputEl || !resultsEl || !selectEl) return;

  if (!selectEl.value) {
    inputEl.value = "";
    resultsEl.classList.add("hidden");
    return;
  }

  const selectedText =
    selectEl.options[selectEl.selectedIndex]?.text ??
    pgPickerRows.find((r) => String(r.id) === String(selectEl.value))
      ?.group_name ??
    "";
  inputEl.value = selectedText;
  resultsEl.classList.add("hidden");
}

async function onEpProductChange() {
  const productId = epProductSelect.value;
  if (!productId) {
    epLineCount.textContent = "0 lines";
    epTableBody.innerHTML = "";
    epTableCard.classList.add("hidden");
    hideBanner(epBanner);
    return;
  }

  epTableCard.classList.add("hidden");
  hideBanner(epBanner);
  showBanner(epBanner, "info", "Resolving effective FG spec preview...");

  const { data, error } = await labSupabase.rpc(
    "fn_preview_effective_fg_spec_for_product",
    {
      p_product_id: Number(productId),
      p_as_of_date: todayISO(),
    },
  );

  if (error) {
    showBanner(
      epBanner,
      "error",
      "Could not resolve effective spec preview: " + error.message,
    );
    epLineCount.textContent = "0 lines";
    epTableBody.innerHTML = "";
    epTableCard.classList.add("hidden");
    return;
  }

  const preview = data || {};
  const rows = Array.isArray(preview.lines) ? preview.lines : [];

  if (preview.ok !== true) {
    const failType = String(preview.reason_code ?? "")
      .toUpperCase()
      .includes("ERR")
      ? "error"
      : "warn";
    showBanner(
      epBanner,
      failType,
      preview.message ||
        "No effective spec could be resolved for this product.",
    );
    epLineCount.textContent = "0 lines";
    epTableBody.innerHTML = "";
    epTableCard.classList.add("hidden");
    return;
  }

  if (!rows.length) {
    showBanner(
      epBanner,
      "warn",
      "No active effective specification lines found.",
    );
    epLineCount.textContent = "0 lines";
    epTableBody.innerHTML = "";
    epTableCard.classList.add("hidden");
    return;
  }

  const msgParts = [
    "Effective FG specification resolved from base spec and product-level overrides.",
  ];
  const metaParts = [];
  if (preview.base_spec_profile_id) {
    metaParts.push(`Base: ${preview.base_spec_profile_id}`);
  }
  if (preview.protocol_category_id) {
    metaParts.push(`Protocol: ${preview.protocol_category_id}`);
  }
  if (preview.product_group_id) {
    metaParts.push(`Group: ${preview.product_group_id}`);
  }
  if (metaParts.length) msgParts.push(metaParts.join(" | "));
  showBanner(epBanner, "info", msgParts.join(" "));

  renderEffectivePreview(rows);
}

function renderEffectivePreview(rows) {
  epTableCard.classList.remove("hidden");
  epLineCount.textContent = `${rows.length} line${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    epTableBody.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No lines found</strong>
        The effective spec profile has no lines.
      </div></td></tr>`;
    return;
  }

  epTableBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td class="td-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td class="td-test">${esc(r.test_name ?? "")}</td>
      <td class="td-method">${esc(r.method_name ?? "")}</td>
      <td class="td-spec">${esc(r.display_text ?? "")}</td>
      <td>${typeBadge(r.spec_type)}</td>
      <td>${sourceBadge(r.source_type)}</td>
      <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
        ${r.is_active === false ? "No" : "Yes"}
      </td>
    </tr>`,
    )
    .join("");
}

// ── EFFECTIVE PREVIEW — RM ────────────────────────────────────────────────────
function wireEffectivePreviewRmEvents() {
  epRmItemSelect.addEventListener("change", onRmEffectivePreviewItemChange);
}

async function onRmEffectivePreviewItemChange() {
  const stockItemId = epRmItemSelect.value;
  if (!stockItemId) {
    epRmLineCount.textContent = "0 lines";
    epRmTableBody.innerHTML = "";
    epRmTableCard.classList.add("hidden");
    hideBanner(epRmBanner);
    return;
  }

  epRmTableCard.classList.add("hidden");
  hideBanner(epRmBanner);
  showBanner(epRmBanner, "info", "Resolving effective RM spec preview...");

  const { data, error } = await labSupabase.rpc(
    "fn_preview_effective_rm_spec_for_item",
    {
      p_stock_item_id: Number(stockItemId),
      p_as_of_date: todayISO(),
    },
  );

  if (error) {
    showBanner(
      epRmBanner,
      "error",
      "Could not resolve effective spec preview: " + error.message,
    );
    epRmLineCount.textContent = "0 lines";
    epRmTableBody.innerHTML = "";
    epRmTableCard.classList.add("hidden");
    return;
  }

  const preview = data || {};
  const rows = Array.isArray(preview.lines) ? preview.lines : [];

  if (preview.ok !== true) {
    const failType = String(preview.reason_code ?? "")
      .toUpperCase()
      .includes("ERR")
      ? "error"
      : "warn";
    showBanner(
      epRmBanner,
      failType,
      preview.message ||
        "No effective spec could be resolved for this stock item.",
    );
    epRmLineCount.textContent = "0 lines";
    epRmTableBody.innerHTML = "";
    epRmTableCard.classList.add("hidden");
    return;
  }

  if (!rows.length) {
    showBanner(
      epRmBanner,
      "warn",
      "No active effective specification lines found.",
    );
    epRmLineCount.textContent = "0 lines";
    epRmTableBody.innerHTML = "";
    epRmTableCard.classList.add("hidden");
    return;
  }

  const msgParts = [
    "Effective RM specification resolved from base spec and stock-item overrides.",
  ];
  const metaParts = [];
  if (preview.base_spec_profile_id) {
    metaParts.push(`Base: ${preview.base_spec_profile_id}`);
  }
  if (preview.protocol_category_id) {
    metaParts.push(`Protocol: ${preview.protocol_category_id}`);
  }
  if (preview.inv_group_id) {
    metaParts.push(`Inv Group: ${preview.inv_group_id}`);
  }
  if (metaParts.length) msgParts.push(metaParts.join(" | "));
  showBanner(epRmBanner, "info", msgParts.join(" "));

  renderRmEffectivePreview(rows);
}

function renderRmEffectivePreview(rows) {
  epRmTableCard.classList.remove("hidden");
  epRmLineCount.textContent = `${rows.length} line${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    epRmTableBody.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No lines found</strong>
        The effective spec profile has no lines.
      </div></td></tr>`;
    return;
  }

  epRmTableBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td class="td-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td class="td-test">${esc(r.test_name ?? "")}</td>
      <td class="td-method">${esc(r.method_name ?? "")}</td>
      <td class="td-spec">${esc(r.display_text ?? "")}</td>
      <td>${typeBadge(r.spec_type)}</td>
      <td>${sourceBadge(r.source_type)}</td>
      <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
        ${r.is_active === false ? "No" : "Yes"}
      </td>
    </tr>`,
    )
    .join("");
}

// ── BASE SPEC LINE EDIT MODAL ─────────────────────────────────────────────────
// Shared modal for editing a single spec line across FG / RM / PM base specs.

function wireBsLineModal() {
  const modal = document.getElementById("bsLineModal");
  const closeBtn = document.getElementById("bsLineModalClose");
  const cancelBtn = document.getElementById("bsLineModalCancel");
  const applyBtn = document.getElementById("bsLineModalApply");
  const specTypeSel = document.getElementById("bsLineModalSpecType");
  const minEl = document.getElementById("bsLineModalMin");
  const maxEl = document.getElementById("bsLineModalMax");
  const exactEl = document.getElementById("bsLineModalExact");
  const textEl = document.getElementById("bsLineModalText");
  const passFailSel = document.getElementById("bsLineModalPassFail");
  const uomSel = document.getElementById("bsLineModalUom");

  if (!modal) return;

  closeBtn.addEventListener("click", closeBsLineModal);
  cancelBtn.addEventListener("click", closeBsLineModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeBsLineModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal.classList.contains("hidden")) return;
    e.preventDefault();
    closeBsLineModal();
  });

  specTypeSel.addEventListener("change", () => {
    applyBaseSpecTypeUI();
    buildBsDisplayText();
  });

  [minEl, maxEl, exactEl].forEach((el) => {
    el.addEventListener("input", () => {
      buildBsDisplayText();
    });
  });
  textEl.addEventListener("input", () => {
    buildBsDisplayText();
  });
  passFailSel.addEventListener("change", () => {
    buildBsDisplayText();
  });
  uomSel.addEventListener("change", () => {
    buildBsDisplayText();
  });

  applyBtn.addEventListener("click", saveBsLineModal);
}

async function ensureTestMasterCacheWithUom() {
  if (
    ovCachedTests &&
    ovCachedTests.length &&
    Object.prototype.hasOwnProperty.call(ovCachedTests[0], "default_uom_id")
  ) {
    return ovCachedTests;
  }

  const { data, error } = await labSupabase
    .from("test_master")
    .select("id, test_name, result_kind, default_uom_id")
    .eq("is_active", true)
    .order("test_name");

  if (error) {
    toast("Failed to load test master UOM defaults: " + error.message, "error");
    ovCachedTests = [];
    return ovCachedTests;
  }

  ovCachedTests = data ?? [];
  return ovCachedTests;
}

async function openBsLineModal(subject, seqNo) {
  const modal = document.getElementById("bsLineModal");
  const titleEl = document.getElementById("bsLineModalTitle");
  const ctxBar = document.getElementById("bsLineModalCtxBar");
  const specTypeSel = document.getElementById("bsLineModalSpecType");
  const minEl = document.getElementById("bsLineModalMin");
  const maxEl = document.getElementById("bsLineModalMax");
  const exactEl = document.getElementById("bsLineModalExact");
  const textEl = document.getElementById("bsLineModalText");
  const passFailSel = document.getElementById("bsLineModalPassFail");
  const uomSel = document.getElementById("bsLineModalUom");
  const displayEl = document.getElementById("bsLineModalDisplayText");
  const activeChk = document.getElementById("bsLineModalActive");
  const errEl = document.getElementById("bsLineModalError");

  bsLineCurrentSubject = subject;
  bsLineCurrentSeqNo = seqNo;

  titleEl.textContent = "Edit Specification Line";
  errEl.classList.add("hidden");
  errEl.textContent = "";

  // Find the table row to read data attributes
  const tbodyId =
    subject === "FG"
      ? "bsTableBody"
      : subject === "RM"
        ? "rmTableBody"
        : "pmTableBody";
  const tbodyEl = document.getElementById(tbodyId);
  const tr = tbodyEl?.querySelector(`tr[data-seq="${seqNo}"]`);
  if (!tr) return;

  const testName = tr.dataset.testName ?? "";
  const methodName = tr.dataset.methodName ?? "";
  const testId = Number(tr.dataset.testId ?? "0");
  ctxBar.textContent = testName + (methodName ? ` · ${methodName}` : "");

  // Resolve current values: pending edit takes precedence over server data
  const editedMap =
    subject === "FG"
      ? bsEditedSpecLines
      : subject === "RM"
        ? rmEditedSpecLines
        : pmEditedSpecLines;
  const existing = editedMap.get(seqNo);

  const curSpecType = normalizeBaseSpecTypeValue(
    existing?.spec_type ?? tr.dataset.origSpecType ?? "",
  );
  const curMin =
    existing?.min_value != null
      ? String(existing.min_value)
      : (tr.dataset.origMin ?? "");
  const curMax =
    existing?.max_value != null
      ? String(existing.max_value)
      : (tr.dataset.origMax ?? "");
  const curText = existing?.text_value ?? tr.dataset.origText ?? "";
  const curDisplay = existing?.display_text ?? tr.dataset.origDisplay ?? "";
  const curActive = existing
    ? existing.is_active
    : tr.dataset.origActive === "1";

  await ensureTestMasterCacheWithUom();
  const testRow = ovCachedTests.find((t) => Number(t.id) === testId);
  const resultKind = String(testRow?.result_kind ?? "").toUpperCase();
  // UOM selection logic (2026-05):
  // For first modal load, prefer Test Master default.
  // Only prefer existing/pending UOM when the user has already changed UOM in the modal.
  const pendingUomId = existing?.uom_id != null ? String(existing.uom_id) : "";
  const specLineUomId = tr.dataset.origUomId
    ? String(tr.dataset.origUomId)
    : "";
  const testDefaultUomId =
    testRow?.default_uom_id != null ? String(testRow.default_uom_id) : "";

  const curUomId = pendingUomId || testDefaultUomId || specLineUomId || "";

  await loadLabUoms();
  populateLabUomSelect(uomSel, curUomId);

  // Temporary debug log for UOM selection
  console.log("[BS Line UOM Debug]", {
    subject,
    seqNo,
    testId,
    testDefaultUomId,
    specLineUomId,
    pendingUomId,
    curUomId,
    selectedValue: uomSel.value,
  });

  // Populate Spec Type options based on result_kind
  specTypeSel.innerHTML = "";
  if (resultKind === "TEXT") {
    specTypeSel.innerHTML = `<option value="TEXT">TEXT — free text</option>`;
  } else if (resultKind === "PASS_FAIL") {
    specTypeSel.innerHTML = `<option value="PASS_FAIL">PASS / FAIL</option>`;
  } else {
    // NUMERIC (default)
    specTypeSel.innerHTML = `
      <option value="RANGE">Range</option>
      <option value="MIN_ONLY">Minimum only / NLT</option>
      <option value="MAX_ONLY">Maximum only / NMT</option>
      <option value="EXACT_NUMERIC">Exact numeric</option>
    `;
  }

  // Set selected spec type
  if ([...specTypeSel.options].some((o) => o.value === curSpecType)) {
    specTypeSel.value = curSpecType;
  } else if (specTypeSel.options.length) {
    specTypeSel.value = specTypeSel.options[0].value;
  }
  specTypeSel.disabled = false;
  specTypeSel.title =
    "Select how the reference value should be interpreted for this specification line.";

  // Pre-fill value fields
  minEl.value = curMin;
  maxEl.value = curMax;
  exactEl.value = curSpecType === "EXACT_NUMERIC" ? curMin : "";
  textEl.value = curText;
  passFailSel.value = curText || "PASS";
  displayEl.value = curDisplay;
  activeChk.checked = curActive;

  applyBaseSpecTypeUI();
  buildBsDisplayText();

  modal.classList.remove("hidden");
}

function closeBsLineModal() {
  document.getElementById("bsLineModal").classList.add("hidden");
  bsLineCurrentSubject = null;
  bsLineCurrentSeqNo = null;
}

function applyBaseSpecTypeUI() {
  const specType = document.getElementById("bsLineModalSpecType").value;
  const minMaxRow = document.getElementById("bsLineModalMinMaxRow");
  const exactRow = document.getElementById("bsLineModalExactRow");
  const textRow = document.getElementById("bsLineModalTextRow");
  const passFailRow = document.getElementById("bsLineModalPassFailRow");
  const uomSel = document.getElementById("bsLineModalUom");
  const minEl = document.getElementById("bsLineModalMin");
  const maxEl = document.getElementById("bsLineModalMax");
  const exactEl = document.getElementById("bsLineModalExact");
  const textEl = document.getElementById("bsLineModalText");
  const passFailSel = document.getElementById("bsLineModalPassFail");
  const minLabel = document.getElementById("bsLineModalMinLabel");
  const maxLabel = document.getElementById("bsLineModalMaxLabel");

  [minMaxRow, exactRow, textRow, passFailRow].forEach((r) =>
    r.classList.add("hidden"),
  );
  [minEl, maxEl, exactEl, textEl, passFailSel].forEach((el) => {
    el.disabled = true;
  });

  minEl.value =
    specType === "MIN_ONLY" || specType === "RANGE" ? minEl.value : "";
  maxEl.value =
    specType === "MAX_ONLY" || specType === "RANGE" ? maxEl.value : "";
  if (specType !== "EXACT_NUMERIC") exactEl.value = "";
  if (specType !== "TEXT") textEl.value = "";
  if (specType !== "PASS_FAIL") passFailSel.value = "PASS";

  uomSel.disabled = false;

  switch (specType) {
    case "RANGE":
      minMaxRow.classList.remove("hidden");
      minLabel.textContent = "Min Value (NLT) *";
      maxLabel.textContent = "Max Value (NMT) *";
      minEl.disabled = false;
      maxEl.disabled = false;
      break;
    case "MAX_ONLY":
      minMaxRow.classList.remove("hidden");
      minLabel.textContent = "Min Value";
      maxLabel.textContent = "Max Value (NMT) *";
      minEl.value = "";
      minEl.disabled = true;
      maxEl.disabled = false;
      break;
    case "MIN_ONLY":
      minMaxRow.classList.remove("hidden");
      minLabel.textContent = "Min Value (NLT) *";
      maxLabel.textContent = "Max Value";
      maxEl.value = "";
      minEl.disabled = false;
      maxEl.disabled = true;
      break;
    case "EXACT_NUMERIC":
      exactRow.classList.remove("hidden");
      exactEl.disabled = false;
      break;
    case "TEXT":
      textRow.classList.remove("hidden");
      textEl.disabled = false;
      break;
    case "PASS_FAIL":
      passFailRow.classList.remove("hidden");
      passFailSel.disabled = false;
      break;
  }
}

function buildBsDisplayText() {
  const specType = document.getElementById("bsLineModalSpecType").value;
  const minEl = document.getElementById("bsLineModalMin");
  const maxEl = document.getElementById("bsLineModalMax");
  const exactEl = document.getElementById("bsLineModalExact");
  const textEl = document.getElementById("bsLineModalText");
  const passFailSel = document.getElementById("bsLineModalPassFail");
  const displayEl = document.getElementById("bsLineModalDisplayText");
  const preview = document.getElementById("bsLineModalDisplayPreview");

  let generated = "";
  let isNumericType = false;
  const min = minEl.value.trim();
  const max = maxEl.value.trim();

  switch (specType) {
    case "RANGE":
      isNumericType = true;
      if (min && max) generated = `${min} - ${max}`;
      else if (min) generated = `NLT ${min}`;
      else if (max) generated = `NMT ${max}`;
      break;
    case "MAX_ONLY":
      isNumericType = true;
      if (max) generated = `NMT ${max}`;
      break;
    case "MIN_ONLY":
      isNumericType = true;
      if (min) generated = `NLT ${min}`;
      break;
    case "EXACT_NUMERIC":
      isNumericType = true;
      if (exactEl.value.trim()) generated = exactEl.value.trim();
      break;
    case "TEXT":
      generated = textEl.value.trim();
      break;
    case "PASS_FAIL":
      generated = passFailSel.value;
      break;
  }

  const finalText = isNumericType
    ? appendUomIfNeeded(generated, selectedUomSymbol())
    : generated;
  displayEl.value = finalText;
  preview.textContent = finalText || "—";
}

function saveBsLineModal() {
  const specTypeSel = document.getElementById("bsLineModalSpecType");
  const minEl = document.getElementById("bsLineModalMin");
  const maxEl = document.getElementById("bsLineModalMax");
  const exactEl = document.getElementById("bsLineModalExact");
  const textEl = document.getElementById("bsLineModalText");
  const passFailSel = document.getElementById("bsLineModalPassFail");
  const uomSel = document.getElementById("bsLineModalUom");
  const displayEl = document.getElementById("bsLineModalDisplayText");
  const activeChk = document.getElementById("bsLineModalActive");
  const errEl = document.getElementById("bsLineModalError");

  errEl.classList.add("hidden");
  errEl.textContent = "";

  const specType = normalizeBaseSpecTypeValue(specTypeSel.value);
  if (!specType) {
    showBanner(errEl, "error", "Spec Type is required.");
    return;
  }

  // Collect and validate values per spec type
  let minValue = null;
  let maxValue = null;
  let textValue = null;

  switch (specType) {
    case "RANGE":
      if (!minEl.value.trim() || !maxEl.value.trim()) {
        showBanner(errEl, "error", "RANGE requires both Min and Max values.");
        return;
      }
      minValue = Number(minEl.value);
      maxValue = Number(maxEl.value);
      if (minValue >= maxValue) {
        showBanner(
          errEl,
          "error",
          "Min value must be less than Max value for RANGE.",
        );
        return;
      }
      break;
    case "MAX_ONLY":
      if (!maxEl.value.trim()) {
        showBanner(errEl, "error", "MAX_ONLY requires a Max value.");
        return;
      }
      maxValue = Number(maxEl.value);
      break;
    case "MIN_ONLY":
      if (!minEl.value.trim()) {
        showBanner(errEl, "error", "MIN_ONLY requires a Min value.");
        return;
      }
      minValue = Number(minEl.value);
      break;
    case "EXACT_NUMERIC":
      if (!exactEl.value.trim()) {
        showBanner(errEl, "error", "Exact Value is required.");
        return;
      }
      minValue = Number(exactEl.value); // EXACT_NUMERIC stores in min_value
      break;
    case "TEXT":
      if (!textEl.value.trim()) {
        showBanner(errEl, "error", "Text Value is required.");
        return;
      }
      textValue = textEl.value.trim();
      break;
    case "PASS_FAIL":
      textValue = passFailSel.value;
      break;
  }

  // Display text is always system-generated from spec type, values, and selected UOM.
  buildBsDisplayText();
  const displayText = displayEl.value.trim();
  const uomId = uomSel.value ? Number(uomSel.value) : null;
  const uomRow = (labUomRows ?? []).find((u) => Number(u.id) === uomId);
  const isActive = activeChk.checked;
  const seqNo = bsLineCurrentSeqNo;

  // Write to the appropriate edits Map
  const editedMap =
    bsLineCurrentSubject === "FG"
      ? bsEditedSpecLines
      : bsLineCurrentSubject === "RM"
        ? rmEditedSpecLines
        : pmEditedSpecLines;

  const tbodyId =
    bsLineCurrentSubject === "FG"
      ? "bsTableBody"
      : bsLineCurrentSubject === "RM"
        ? "rmTableBody"
        : "pmTableBody";
  const tbodyEl = document.getElementById(tbodyId);
  const tr = tbodyEl?.querySelector(`tr[data-seq="${seqNo}"]`);
  const origSpecType = normalizeBaseSpecTypeValue(
    tr?.dataset.origSpecType || null,
  );
  const origMin =
    tr?.dataset.origMin !== undefined && tr.dataset.origMin !== ""
      ? Number(tr.dataset.origMin)
      : null;
  const origMax =
    tr?.dataset.origMax !== undefined && tr.dataset.origMax !== ""
      ? Number(tr.dataset.origMax)
      : null;
  const origText = tr?.dataset.origText || null;
  const origDisplay = tr?.dataset.origDisplay || null;
  const origUomId = tr?.dataset.origUomId ? Number(tr.dataset.origUomId) : null;
  const origActive = tr?.dataset.origActive === "1";

  const hasChanged =
    specType !== origSpecType ||
    minValue !== origMin ||
    maxValue !== origMax ||
    textValue !== origText ||
    displayText !== origDisplay ||
    uomId !== origUomId ||
    isActive !== origActive;

  if (!hasChanged) {
    editedMap.delete(seqNo);
  } else {
    editedMap.set(seqNo, {
      seq_no: seqNo,
      spec_type: specType,
      min_value: minValue,
      max_value: maxValue,
      text_value: textValue,
      uom_id: uomId,
      uom_symbol: uomRow?.symbol ?? null,
      display_text: displayText,
      is_active: isActive,
    });
  }

  // Re-render the table to reflect the new values
  if (bsLineCurrentSubject === "FG") {
    bsRenderSpecLines(bsLoadedRows);
  } else if (bsLineCurrentSubject === "RM") {
    rmRenderSpecLines(rmLoadedRows);
  } else {
    pmRenderSpecLines(pmLoadedRows);
  }

  closeBsLineModal();
}

function normalizeBaseSpecTypeValue(specType) {
  if (specType === "NMT") return "MAX_ONLY";
  if (specType === "NLT") return "MIN_ONLY";
  return String(specType ?? "").trim();
}

// ── OVERRIDE EDITOR MODAL ─────────────────────────────────────────────────────

// Loads the set of active test_ids from the base spec profile into ovBaseTestIds.
async function loadOverrideBaseTestIds(profileId) {
  ovBaseTestIds = new Set();
  if (!profileId) return;

  const { data, error } = await labSupabase
    .from("spec_line")
    .select("test_id")
    .eq("spec_profile_id", profileId)
    .eq("is_active", true);

  if (error) {
    toast("Could not load base spec test list: " + error.message, "error");
    return;
  }
  ovBaseTestIds = new Set((data ?? []).map((r) => Number(r.test_id)));
}

// Enables/disables the Add Override button for the given subject.
function setOverrideAddButtonState(subject, enabled) {
  const btn =
    subject === "FG"
      ? document.getElementById("ovAddBtn")
      : subject === "RM"
        ? document.getElementById("ovRmAddBtn")
        : document.getElementById("ovPmAddBtn");

  if (!btn) return;
  btn.disabled = !enabled;
  btn.title = enabled
    ? "Add item-level override"
    : "Base spec profile must be configured before adding overrides";
}

// Restricts Action Type options based on whether the selected test is in the base spec.
function applyActionOptionsForSelectedTest() {
  const actionSel = document.getElementById("ovModalAction");
  const testId = Number(document.getElementById("ovModalTest")?.value);

  if (!actionSel) return;

  if (!testId) {
    actionSel.innerHTML = `<option value="">-- Select test first --</option>`;
    actionSel.disabled = true;
    return;
  }

  const existsInBase = ovBaseTestIds.has(testId);

  if (existsInBase) {
    actionSel.innerHTML = `
      <option value="modify">Modify — change spec values for this inherited test</option>
      <option value="disable">Disable — exclude this inherited test from effective spec</option>
    `;
  } else {
    actionSel.innerHTML = `
      <option value="add">Add — inject this new test into effective spec</option>
    `;
  }

  actionSel.disabled = false;
}

// Sets a select's value only if that value exists among its options.
function setSelectValueIfExists(selectEl, value) {
  if (!selectEl) return false;
  const exists = [...selectEl.options].some((o) => o.value === value);
  if (exists) {
    selectEl.value = value;
    return true;
  }
  return false;
}

function getSelectedTestResultKind() {
  const testId = document.getElementById("ovModalTest")?.value;
  const test = (ovCachedTests ?? []).find(
    (t) => String(t.id) === String(testId),
  );
  return String(test?.result_kind ?? "").toUpperCase();
}

function applySpecTypeOptionsForSelectedTest() {
  const specSel = document.getElementById("ovModalSpecType");
  const resultKind = getSelectedTestResultKind();

  let options = [];

  if (resultKind === "NUMERIC") {
    options = [
      ["RANGE", "RANGE — min to max"],
      ["NMT", "NMT — Not More Than"],
      ["NLT", "NLT — Not Less Than"],
      ["EXACT_NUMERIC", "EXACT NUMERIC — equals value"],
    ];
  } else if (resultKind === "TEXT") {
    options = [["TEXT", "TEXT — expected text"]];
  } else if (resultKind === "PASS_FAIL") {
    options = [["PASS_FAIL", "PASS / FAIL"]];
  } else {
    options = [];
  }

  if (!options.length) {
    specSel.innerHTML = `<option value="">-- Select test first --</option>`;
    specSel.disabled = true;
    return;
  }

  const oldValue = specSel.value;
  specSel.innerHTML = options
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}">${esc(label)}</option>`,
    )
    .join("");

  if (options.some(([value]) => value === oldValue)) {
    specSel.value = oldValue;
  }

  specSel.disabled = options.length === 1;
}

function wireOverrideModal() {
  document
    .getElementById("ovModalClose")
    .addEventListener("click", closeOverrideModal);
  document
    .getElementById("ovModalCancel")
    .addEventListener("click", closeOverrideModal);
  document.getElementById("ovModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("ovModal")) closeOverrideModal();
  });
  document
    .getElementById("ovModalSave")
    .addEventListener("click", saveOverrideModal);
  document
    .getElementById("ovModalAction")
    .addEventListener("change", updateModalDynamics);
  document.getElementById("ovModalSpecType").addEventListener("change", () => {
    renderDynamicInputs();
    updateDisplayText();
  });
  document.getElementById("ovModalUom")?.addEventListener("change", () => {
    ovModalUomTouched = true;
    updateDisplayText();
  });
  document.getElementById("ovModalTest").addEventListener("change", () => {
    applyActionOptionsForSelectedTest();
    applySpecTypeOptionsForSelectedTest();
    const uomSel = document.getElementById("ovModalUom");
    if (ovModalMode === "add" && uomSel && !ovModalUomTouched) {
      const testId = Number(document.getElementById("ovModalTest").value || 0);
      const testRow = (ovCachedTests ?? []).find(
        (t) => Number(t.id) === testId,
      );
      const defaultUomId =
        testRow?.default_uom_id != null ? String(testRow.default_uom_id) : "";
      uomSel.value = defaultUomId;
    }
    updateModalDynamics();
  });

  // Add Override buttons — wired here; item context is read at open time
  document.getElementById("ovAddBtn")?.addEventListener("click", () => {
    if (!ovFgProductId) return;
    if (!ovBaseSpecProfileId) {
      toast(
        "Base spec profile must be configured before adding overrides.",
        "warn",
      );
      return;
    }
    openOverrideModal("add", null);
  });
  document.getElementById("ovRmAddBtn")?.addEventListener("click", () => {
    if (!ovRmItemId) return;
    if (!ovBaseSpecProfileId) {
      toast(
        "Base spec profile must be configured before adding overrides.",
        "warn",
      );
      return;
    }
    openOverrideModal("add", null);
  });
  document.getElementById("ovPmAddBtn")?.addEventListener("click", () => {
    if (!ovPmItemId) return;
    if (!ovBaseSpecProfileId) {
      toast(
        "Base spec profile must be configured before adding overrides.",
        "warn",
      );
      return;
    }
    openOverrideModal("add", null);
  });
}

// Opens the modal. mode = "add" | "edit". row = existing override row (edit only).
async function openOverrideModal(mode, row) {
  ovModalMode = mode;

  const modal = document.getElementById("ovModal");
  const titleEl = document.getElementById("ovModalTitle");
  const saveLabel = document.getElementById("ovModalSaveLabel");
  const ctxBar = document.getElementById("ovModalContextBar");
  const testSel = document.getElementById("ovModalTest");
  const actionSel = document.getElementById("ovModalAction");
  const specSel = document.getElementById("ovModalSpecType");
  const uomSel = document.getElementById("ovModalUom");
  const reasonEl = document.getElementById("ovModalReason");
  const banner = document.getElementById("ovModalBanner");

  ovModalUomTouched = false;

  titleEl.textContent = mode === "add" ? "Add Override" : "Edit Override";
  saveLabel.textContent = mode === "add" ? "Save Override" : "Update Override";
  hideBanner(banner);

  // Build context label
  const subj = currentSubjectType;
  let itemLabel;
  if (subj === "FG") {
    itemLabel =
      ovProductSelect.options[ovProductSelect.selectedIndex]?.text ??
      ovFgProductId;
  } else if (subj === "RM") {
    itemLabel =
      ovRmItemSelect.options[ovRmItemSelect.selectedIndex]?.text ?? ovRmItemId;
  } else {
    itemLabel =
      ovPmItemSelect.options[ovPmItemSelect.selectedIndex]?.text ?? ovPmItemId;
  }
  ctxBar.textContent = `${subj} — ${itemLabel}`;

  // Lazy-load tests (fetch result_kind so spec type options can be restricted)
  if (!ovCachedTests) {
    testSel.innerHTML = '<option value="">Loading tests…</option>';
    testSel.disabled = true;
    const { data, error } = await labSupabase
      .from("test_master")
      .select("id, test_name, result_kind, default_uom_id")
      .eq("is_active", true)
      .order("test_name");
    ovCachedTests = error ? [] : (data ?? []);
    testSel.disabled = false;
  }
  populateSelect(
    testSel,
    ovCachedTests,
    "id",
    "test_name",
    "-- Select Test --",
  );
  await loadLabUoms();

  const selectedUomId =
    mode === "edit" && row?.override_uom_id != null
      ? String(row.override_uom_id)
      : "";
  populateLabUomSelect(uomSel, selectedUomId);

  // Pre-fill form
  if (mode === "edit" && row) {
    testSel.value = String(row.test_id ?? "");
    reasonEl.value = row.reason ?? "";
    ovModalPrefill = {
      min: String(row.override_min_value ?? ""),
      max: String(row.override_max_value ?? ""),
      text: row.override_text_value ?? "",
      exact: String(row.override_min_value ?? ""), // EXACT_NUMERIC stores in min_value
    };
    // Restrict action options first, then restore saved action if valid
    applyActionOptionsForSelectedTest();
    setSelectValueIfExists(
      actionSel,
      String(row.action_type ?? "").toLowerCase(),
    );
    // Restrict spec type options, then restore saved spec type
    applySpecTypeOptionsForSelectedTest();
    specSel.value = row.override_spec_type ?? specSel.options[0]?.value ?? "";
    if (uomSel) {
      uomSel.value = selectedUomId;
    }
  } else {
    testSel.value = "";
    reasonEl.value = "";
    ovModalPrefill = { min: "", max: "", text: "", exact: "" };
    applyActionOptionsForSelectedTest(); // will show "-- Select test first --"
    applySpecTypeOptionsForSelectedTest(); // will show "-- Select test first --"
    if (uomSel) {
      const selectedTestId = Number(testSel.value || 0);
      const testRow = (ovCachedTests ?? []).find(
        (t) => Number(t.id) === selectedTestId,
      );
      const defaultUomId =
        testRow?.default_uom_id != null ? String(testRow.default_uom_id) : "";
      uomSel.value = defaultUomId;
    }
  }

  updateModalDynamics();
  modal.classList.remove("hidden");
  testSel.focus();
}

function closeOverrideModal() {
  document.getElementById("ovModal").classList.add("hidden");
  ovModalMode = "add";
  ovModalPrefill = {};
}

function updateModalDynamics() {
  const action = document.getElementById("ovModalAction").value;
  const specSection = document.getElementById("ovModalSpecSection");
  const isDisable = action === "disable";
  specSection.classList.toggle("hidden", isDisable);
  if (!isDisable) {
    renderDynamicInputs();
    updateDisplayText();
  }
}

function renderDynamicInputs() {
  const specType = document.getElementById("ovModalSpecType").value;
  const dyn = document.getElementById("ovModalDyn");
  const { min, max, text, exact } = ovModalPrefill;

  let html = "";
  if (specType === "RANGE") {
    html = `
      <div class="form-group">
        <label for="ovModalMin">Min Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalMin" class="form-control" step="any" placeholder="e.g. 95" value="${esc(min)}">
      </div>
      <div class="form-group">
        <label for="ovModalMax">Max Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalMax" class="form-control" step="any" placeholder="e.g. 105" value="${esc(max)}">
      </div>`;
  } else if (specType === "NMT") {
    html = `
      <div class="form-group">
        <label for="ovModalMax">Max Value (NMT) <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalMax" class="form-control" step="any" placeholder="e.g. 5" value="${esc(max)}">
      </div>`;
  } else if (specType === "NLT") {
    html = `
      <div class="form-group">
        <label for="ovModalMin">Min Value (NLT) <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalMin" class="form-control" step="any" placeholder="e.g. 98" value="${esc(min)}">
      </div>`;
  } else if (specType === "EXACT_NUMERIC") {
    html = `
      <div class="form-group">
        <label for="ovModalExact">Exact Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalExact" class="form-control" step="any" placeholder="e.g. 100" value="${esc(exact)}">
      </div>`;
  } else if (specType === "TEXT") {
    html = `
      <div class="form-group" style="grid-column:1/-1;">
        <label for="ovModalText">Spec Text <span style="color:#ef4444">*</span></label>
        <input type="text" id="ovModalText" class="form-control" placeholder="e.g. Clear, colourless liquid" value="${esc(text)}">
      </div>`;
  } else if (specType === "PASS_FAIL") {
    html = `<p style="grid-column:1/-1;color:var(--muted,#6b7280);font-size:13px;margin:0;">
      No value input required — result will be recorded as Pass or Fail.</p>`;
  }
  dyn.innerHTML = html;

  // Wire value inputs for live display-text preview
  ["ovModalMin", "ovModalMax", "ovModalText", "ovModalExact"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateDisplayText);
  });
  updateDisplayText();
}

function updateDisplayText() {
  const specType = document.getElementById("ovModalSpecType").value;
  const preview = document.getElementById("ovModalDisplayPreview");
  let text = "—";

  if (specType === "RANGE") {
    const minV = document.getElementById("ovModalMin")?.value.trim();
    const maxV = document.getElementById("ovModalMax")?.value.trim();
    if (minV && maxV) text = `${minV} – ${maxV}`;
    else if (minV) text = `≥ ${minV}`;
    else if (maxV) text = `≤ ${maxV}`;
  } else if (specType === "NMT") {
    const maxV = document.getElementById("ovModalMax")?.value.trim();
    if (maxV) text = `NMT ${maxV}`;
  } else if (specType === "NLT") {
    const minV = document.getElementById("ovModalMin")?.value.trim();
    if (minV) text = `NLT ${minV}`;
  } else if (specType === "EXACT_NUMERIC") {
    const val = document.getElementById("ovModalExact")?.value.trim();
    if (val) text = `= ${val}`;
  } else if (specType === "TEXT") {
    text = document.getElementById("ovModalText")?.value.trim() || "—";
  } else if (specType === "PASS_FAIL") {
    text = "Passes";
  }

  const isNumericType = ["RANGE", "NMT", "NLT", "EXACT_NUMERIC"].includes(
    specType,
  );
  const uomSel = document.getElementById("ovModalUom");
  const uomId = uomSel?.value ? Number(uomSel.value) : null;
  const uomRow = (labUomRows ?? []).find((u) => Number(u.id) === uomId);
  const uomToken = uomRow?.symbol || uomRow?.uom_code || "";
  if (isNumericType && text !== "—" && uomToken) {
    text = appendUomIfNeeded(text, uomToken);
  }

  preview.textContent = text;
}

async function saveOverrideModal() {
  const banner = document.getElementById("ovModalBanner");
  const saveBtn = document.getElementById("ovModalSave");
  const saveLabel = document.getElementById("ovModalSaveLabel");
  hideBanner(banner);

  const testId = document.getElementById("ovModalTest").value;
  const actionType = document.getElementById("ovModalAction").value;
  const reason = document.getElementById("ovModalReason").value.trim();
  const overrideUomId = document.getElementById("ovModalUom")?.value
    ? Number(document.getElementById("ovModalUom").value)
    : null;

  if (!testId) {
    showBanner(banner, "error", "Please select a test.");
    return;
  }

  if (!ovBaseSpecProfileId) {
    showBanner(
      banner,
      "error",
      "Cannot save override because no active base spec profile is configured.",
    );
    return;
  }

  const existsInBase = ovBaseTestIds.has(Number(testId));
  if ((actionType === "modify" || actionType === "disable") && !existsInBase) {
    showBanner(
      banner,
      "error",
      "This test is not present in base spec. Use ADD.",
    );
    return;
  }
  if (actionType === "add" && existsInBase) {
    showBanner(
      banner,
      "error",
      "This test already exists in base spec. Use MODIFY or DISABLE.",
    );
    return;
  }

  // Collect spec values
  let specType = null,
    minVal = null,
    maxVal = null,
    textVal = null,
    displayText = null;

  if (actionType !== "disable") {
    specType = document.getElementById("ovModalSpecType").value;

    if (specType === "RANGE") {
      minVal = document.getElementById("ovModalMin")?.value.trim() || null;
      maxVal = document.getElementById("ovModalMax")?.value.trim() || null;
      if (!minVal || !maxVal) {
        showBanner(
          banner,
          "error",
          "Both min and max values are required for RANGE.",
        );
        return;
      }
      displayText = `${minVal} – ${maxVal}`;
    } else if (specType === "NMT") {
      maxVal = document.getElementById("ovModalMax")?.value.trim() || null;
      if (!maxVal) {
        showBanner(banner, "error", "Max value is required for NMT.");
        return;
      }
      displayText = `NMT ${maxVal}`;
    } else if (specType === "NLT") {
      minVal = document.getElementById("ovModalMin")?.value.trim() || null;
      if (!minVal) {
        showBanner(banner, "error", "Min value is required for NLT.");
        return;
      }
      displayText = `NLT ${minVal}`;
    } else if (specType === "EXACT_NUMERIC") {
      minVal = document.getElementById("ovModalExact")?.value.trim() || null;
      if (!minVal) {
        showBanner(banner, "error", "Value is required for EXACT NUMERIC.");
        return;
      }
      displayText = `= ${minVal}`;
    } else if (specType === "TEXT") {
      textVal = document.getElementById("ovModalText")?.value.trim() || null;
      if (!textVal) {
        showBanner(banner, "error", "Spec text is required for TEXT type.");
        return;
      }
      displayText = textVal;
    } else if (specType === "PASS_FAIL") {
      displayText = "Passes";
    }

    updateDisplayText();
    const previewText =
      document.getElementById("ovModalDisplayPreview")?.textContent?.trim() ||
      "";
    displayText = previewText && previewText !== "—" ? previewText : null;
  }

  saveBtn.disabled = true;
  saveLabel.textContent = "Saving…";

  const subj = currentSubjectType;
  const itemId =
    subj === "FG" ? ovFgProductId : subj === "RM" ? ovRmItemId : ovPmItemId;

  const { data: userData, error: userErr } = await labSupabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    showBanner(banner, "error", "Login session not found. Please reload.");
    saveBtn.disabled = false;
    saveLabel.textContent =
      ovModalMode === "add" ? "Save Override" : "Update Override";
    return;
  }

  const { error } = await labSupabase.rpc("fn_save_spec_override_direct", {
    p_user_id: userData.user.id,
    p_subject_type: subj,
    p_product_id: subj === "FG" ? Number(itemId) : null,
    p_stock_item_id: subj === "FG" ? null : Number(itemId),
    p_test_id: Number(testId),
    p_action_type: actionType,
    p_spec_type: specType,
    p_min_value: minVal !== null ? Number(minVal) : null,
    p_max_value: maxVal !== null ? Number(maxVal) : null,
    p_text_value: textVal ?? null,
    p_display_text: displayText ?? null,
    p_override_uom_id: actionType === "disable" ? null : overrideUomId,
    p_reason: reason || null,
  });

  saveBtn.disabled = false;
  saveLabel.textContent =
    ovModalMode === "add" ? "Save Override" : "Update Override";

  if (error) {
    showBanner(banner, "error", "Failed to save override: " + error.message);
    return;
  }

  toast(
    ovModalMode === "add"
      ? "Override saved successfully."
      : "New override version saved successfully.",
    "success",
  );
  closeOverrideModal();

  // Reload the current subject's overrides
  if (subj === "FG") await onOvProductChange();
  else if (subj === "RM") await onRmOverrideItemChange();
  else await onPmOverrideItemChange();
}

// Render a single override row (shared across FG/RM/PM tables)
function renderOverrideRow(r) {
  const actionClass =
    {
      modify: "action-badge-replace",
      add: "action-badge-append",
      disable: "action-badge-exclude",
    }[String(r.action_type ?? "").toLowerCase()] ?? "action-badge-other";

  const inactiveStyle = r.is_active
    ? ""
    : 'style="opacity:0.55;background:#f9fafb;"';
  const uomSuffix = r.uom_symbol || r.uom_code || "";

  return `<tr ${inactiveStyle} data-ov-id="${esc(String(r.id))}">
    <td class="td-test">${esc(r.test_name ?? "")}${!r.is_active ? ` <span style="font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;">(inactive)</span>` : ""}</td>
    <td><span class="action-badge ${actionClass}">${esc(r.action_type ?? "")}</span></td>
    <td style="color:var(--muted,#6b7280);">${esc(r.override_spec_type ?? "—")}</td>
    <td>${esc(r.override_display_text ?? "—")}${uomSuffix ? `<span style="color:var(--muted,#6b7280);font-size:12px;"> ${esc(uomSuffix)}</span>` : ""}</td>
    <td class="td-active">
      <input type="checkbox" class="ov-active-chk" data-ov-id="${esc(String(r.id))}"
        ${r.is_active ? "checked" : ""} aria-label="Active">
    </td>
    <td>
      <button type="button" class="edit-ov-btn"
        data-ov-id="${esc(String(r.id))}"
        data-test-id="${esc(String(r.test_id ?? ""))}"
        data-action="${esc(r.action_type ?? "")}"
        data-spec-type="${esc(r.override_spec_type ?? "")}"
        data-min="${esc(String(r.override_min_value ?? ""))}"
        data-max="${esc(String(r.override_max_value ?? ""))}"
        data-text="${esc(r.override_text_value ?? "")}"
        data-display="${esc(r.override_display_text ?? "")}"
        data-uom-id="${esc(String(r.override_uom_id ?? ""))}"
        data-reason="${esc(r.reason ?? "")}"
        aria-label="Edit override for ${esc(r.test_name ?? "")}">Edit</button>
    </td>
  </tr>`;
}

// Wire active-toggle and edit-button events on an override tbody after innerHTML render
function wireOverrideTableEvents(tbody) {
  tbody.querySelectorAll(".ov-active-chk").forEach((chk) => {
    chk.addEventListener("change", async () => {
      const newActive = chk.checked;

      const { data: userData, error: userErr } =
        await labSupabase.auth.getUser();
      if (userErr || !userData?.user?.id) {
        toast("Login session not found.", "error");
        chk.checked = !newActive;
        return;
      }

      const { error } = await labSupabase.rpc("fn_toggle_spec_override", {
        p_user_id: userData.user.id,
        p_override_id: Number(chk.dataset.ovId),
        p_is_active: newActive,
      });
      if (error) {
        toast("Failed to update active status: " + error.message, "error");
        chk.checked = !newActive; // revert
      } else {
        toast(
          newActive ? "Override activated." : "Override deactivated.",
          "success",
        );
        // Reload override table to reflect updated active state
        if (currentSubjectType === "FG") await onOvProductChange();
        else if (currentSubjectType === "RM") await onRmOverrideItemChange();
        else if (currentSubjectType === "PM") await onPmOverrideItemChange();
      }
    });
  });

  tbody.querySelectorAll(".edit-ov-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset;
      openOverrideModal("edit", {
        id: d.ovId,
        test_id: d.testId || null,
        action_type: d.action,
        override_spec_type: d.specType || null,
        override_min_value: d.min !== "" ? d.min : null,
        override_max_value: d.max !== "" ? d.max : null,
        override_text_value: d.text || null,
        override_display_text: d.display,
        override_uom_id: d.uomId !== "" ? Number(d.uomId) : null,
        reason: d.reason,
      });
    });
  });
}

// ── Shared utilities ──────────────────────────────────────────────────────────
function typeBadge(type) {
  const t = String(type ?? "").toLowerCase();
  if (t.includes("numeric"))
    return `<span class="type-badge type-badge-numeric">${esc(type)}</span>`;
  if (t.includes("text"))
    return `<span class="type-badge type-badge-text">${esc(type)}</span>`;
  if (t.includes("pass"))
    return `<span class="type-badge type-badge-passfail">${esc(type)}</span>`;
  return `<span class="type-badge type-badge-other">${esc(type ?? "")}</span>`;
}

function sourceBadge(sourceType) {
  const src = String(sourceType ?? "BASE").toUpperCase();
  if (src === "ADD") {
    return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #86efac;background:#f0fdf4;color:#166534;">ADD</span>';
  }
  if (src === "MODIFY") {
    return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;">MODIFY</span>';
  }
  return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #d1d5db;background:#f9fafb;color:#374151;">BASE</span>';
}

async function loadLabUoms() {
  const { data, error } = await labSupabase.rpc("fn_get_lab_uom_picker");

  if (error) {
    toast("Failed to load lab UOMs: " + error.message, "error");
    labUomRows = [];
    return labUomRows;
  }

  labUomRows = data ?? [];
  return labUomRows;
}

function populateLabUomSelect(selectEl, selectedId) {
  if (!selectEl) return;
  const rows = labUomRows ?? [];
  selectEl.innerHTML =
    '<option value="">-- No Unit --</option>' +
    rows
      .map((u) => {
        const label = u.symbol
          ? `${u.uom_code} - ${u.symbol}`
          : `${u.uom_code} - ${u.uom_name}`;
        return `<option value="${esc(String(u.id))}" ${
          String(u.id) === String(selectedId ?? "") ? "selected" : ""
        }>${esc(label)}</option>`;
      })
      .join("");
}

function selectedUomSymbol() {
  const uomSel = document.getElementById("bsLineModalUom");
  const id = Number(uomSel?.value || 0);
  if (!id) return "";
  const row = (labUomRows ?? []).find((u) => Number(u.id) === id);
  return String(row?.symbol ?? "").trim();
}

function appendUomIfNeeded(text, symbol) {
  const value = String(text ?? "").trim();
  const unit = String(symbol ?? "").trim();
  if (!value || !unit) return value;
  if (value.toLowerCase().includes(unit.toLowerCase())) return value;
  return `${value} ${unit}`;
}

function populateSelect(sel, rows, valKey, labelKey, placeholder) {
  sel.innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    rows
      .map(
        (r) =>
          `<option value="${esc(String(r[valKey]))}">${esc(r[labelKey] ?? "")}</option>`,
      )
      .join("");
}

function resetGenerateButton(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove("loading");
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg><span>Generate Spec</span>`;
}

function setMetaValue(el, val, isEmpty) {
  el.textContent = val;
  el.classList.toggle("not-set", isEmpty);
}

function formatDate(val) {
  if (!val) return "--";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(val) {
  if (!val) return "--";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showBanner(el, type, msg) {
  el.className = `spec-info-banner ${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideBanner(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

function toast(msg, type = "info", duration = 3500) {
  const container = document.getElementById("labToastContainer");
  const t = document.createElement("div");
  t.className = `lab-toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add("toast-fade-out");
    t.addEventListener("animationend", () => t.remove(), { once: true });
  }, duration);
}
