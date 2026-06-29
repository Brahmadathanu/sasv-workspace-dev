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
const tabSelect = document.getElementById("tabSelect");

// Tab buttons
const reviewQueueTab = document.getElementById("reviewQueueTab");
const changeHistoryTab = document.getElementById("changeHistoryTab");
const overrideRegisterTab = document.getElementById("overrideRegisterTab");
const baseSpecTab = document.getElementById("baseSpecTab");
const overridesTab = document.getElementById("overridesTab");
const effectivePreviewTab = document.getElementById("effectivePreviewTab");
const reviewQueueTabBadge = document.getElementById("reviewQueueTabBadge");

const TAB_BUTTONS = [
  reviewQueueTab,
  overrideRegisterTab,
  changeHistoryTab,
  baseSpecTab,
  overridesTab,
  effectivePreviewTab,
];

// Tab panels
const reviewQueuePanel = document.getElementById("reviewQueuePanel");
const changeHistoryPanel = document.getElementById("changeHistoryPanel");
const overrideRegisterPanel = document.getElementById("overrideRegisterPanel");
const baseSpecPanel = document.getElementById("baseSpecPanel");
const overridesPanel = document.getElementById("overridesPanel");
const effectivePreviewPanel = document.getElementById("effectivePreviewPanel");

const rqSubjectFilter = document.getElementById("rqSubjectFilter");
const rqScopeFilter = document.getElementById("rqScopeFilter");
const rqSearchInput = document.getElementById("rqSearchInput");
const rqFilterBtn = document.getElementById("rqFilterBtn");
const rqFilterDrawer = document.getElementById("rqFilterDrawer");
const rqFilterBadge = document.getElementById("rqFilterBadge");
const rqFilterClear = document.getElementById("rqFilterClear");
const rqFilterClose = document.getElementById("rqFilterClose");
const rqFilterApply = document.getElementById("rqFilterApply");
const rqLineCount = document.getElementById("rqLineCount");
const rqExportBtn = document.getElementById("rqExportBtn");
const reviewQueueTableBody = document.getElementById("reviewQueueTableBody");

const chHistoryTypeFilter = document.getElementById("chHistoryTypeFilter");
const chStatusFilter = document.getElementById("chStatusFilter");
const chScopeFilter = document.getElementById("chScopeFilter");
const chSubjectFilter = document.getElementById("chSubjectFilter");
const chRouteFilter = document.getElementById("chRouteFilter");
const chAppliedTargetFilter = document.getElementById("chAppliedTargetFilter");
const chSearchInput = document.getElementById("chSearchInput");
const chExportBtn = document.getElementById("chExportBtn");
const chFilterBtn = document.getElementById("chFilterBtn");
const chFilterDrawer = document.getElementById("chFilterDrawer");
const chFilterBadge = document.getElementById("chFilterBadge");
const chFilterClear = document.getElementById("chFilterClear");
const chFilterClose = document.getElementById("chFilterClose");
const chFilterApply = document.getElementById("chFilterApply");
const chLineCount = document.getElementById("chLineCount");
const chHistoryTableBody = document.getElementById("chHistoryTableBody");

const specLifecycleHistoryModal = document.getElementById(
  "specLifecycleHistoryModal",
);
const specLifecycleHistoryClose = document.getElementById(
  "specLifecycleHistoryClose",
);
const specLifecycleHistoryFooterClose = document.getElementById(
  "specLifecycleHistoryFooterClose",
);
const specLifecycleHistoryTitle = document.getElementById(
  "specLifecycleHistoryTitle",
);
const specLifecycleHistoryContext = document.getElementById(
  "specLifecycleHistoryContext",
);
const specLifecycleHistoryDetail = document.getElementById(
  "specLifecycleHistoryDetail",
);

const orSubjectFilter = document.getElementById("orSubjectFilter");
const orLevelFilter = document.getElementById("orLevelFilter");
const orRouteFilter = document.getElementById("orRouteFilter");
const orActionFilter = document.getElementById("orActionFilter");
const orSearchInput = document.getElementById("orSearchInput");
const orExportBtn = document.getElementById("orExportBtn");
const orFilterBtn = document.getElementById("orFilterBtn");
const orFilterDrawer = document.getElementById("orFilterDrawer");
const orFilterBadge = document.getElementById("orFilterBadge");
const orFilterClear = document.getElementById("orFilterClear");
const orFilterClose = document.getElementById("orFilterClose");
const orFilterApply = document.getElementById("orFilterApply");
const orLineCount = document.getElementById("orLineCount");
const orRegisterTableBody = document.getElementById("orRegisterTableBody");

const specOverrideRegisterModal = document.getElementById(
  "specOverrideRegisterModal",
);
const specOverrideRegisterTitle = document.getElementById(
  "specOverrideRegisterTitle",
);
const specOverrideRegisterContext = document.getElementById(
  "specOverrideRegisterContext",
);
const specOverrideRegisterClose = document.getElementById(
  "specOverrideRegisterClose",
);
const specOverrideRegisterDetail = document.getElementById(
  "specOverrideRegisterDetail",
);
const specOverrideRegisterRemarks = document.getElementById(
  "specOverrideRegisterRemarks",
);
const specOverrideRegisterCancel = document.getElementById(
  "specOverrideRegisterCancel",
);
const specOverrideRegisterConfirmBtn = document.getElementById(
  "specOverrideRegisterConfirmBtn",
);
const specOverrideRegisterDeactivateBtn = document.getElementById(
  "specOverrideRegisterDeactivateBtn",
);
const specOverrideDeactivateConfirmModal = document.getElementById(
  "specOverrideDeactivateConfirmModal",
);
const specOverrideDeactivateConfirmClose = document.getElementById(
  "specOverrideDeactivateConfirmClose",
);
const specOverrideDeactivateConfirmDetail = document.getElementById(
  "specOverrideDeactivateConfirmDetail",
);
const specOverrideDeactivateConfirmRemarks = document.getElementById(
  "specOverrideDeactivateConfirmRemarks",
);
const specOverrideDeactivateConfirmCancel = document.getElementById(
  "specOverrideDeactivateConfirmCancel",
);
const specOverrideDeactivateConfirmBtn = document.getElementById(
  "specOverrideDeactivateConfirmBtn",
);
const specOverrideRegisterSupersedeBtn = document.getElementById(
  "specOverrideRegisterSupersedeBtn",
);
const specOverrideSupersedeModal = document.getElementById(
  "specOverrideSupersedeModal",
);
const specOverrideSupersedeClose = document.getElementById(
  "specOverrideSupersedeClose",
);
const specOverrideSupersedeContext = document.getElementById(
  "specOverrideSupersedeContext",
);
const specOverrideSupersedeAction = document.getElementById(
  "specOverrideSupersedeAction",
);
const specOverrideSupersedeSpecType = document.getElementById(
  "specOverrideSupersedeSpecType",
);
const specOverrideSupersedeUom = document.getElementById(
  "specOverrideSupersedeUom",
);
const specOverrideSupersedeDyn = document.getElementById(
  "specOverrideSupersedeDyn",
);
const specOverrideSupersedeDisplayPreview = document.getElementById(
  "specOverrideSupersedeDisplayPreview",
);
const specOverrideSupersedeMethodDisplay = document.getElementById(
  "specOverrideSupersedeMethodDisplay",
);
const specOverrideSupersedeReason = document.getElementById(
  "specOverrideSupersedeReason",
);
const specOverrideSupersedeRemarks = document.getElementById(
  "specOverrideSupersedeRemarks",
);
const specOverrideSupersedeBanner = document.getElementById(
  "specOverrideSupersedeBanner",
);
const specOverrideSupersedeCancel = document.getElementById(
  "specOverrideSupersedeCancel",
);
const specOverrideSupersedeReviewBtn = document.getElementById(
  "specOverrideSupersedeReviewBtn",
);
const specOverrideSupersedeConfirmModal = document.getElementById(
  "specOverrideSupersedeConfirmModal",
);
const specOverrideSupersedeConfirmClose = document.getElementById(
  "specOverrideSupersedeConfirmClose",
);
const specOverrideSupersedeConfirmDiff = document.getElementById(
  "specOverrideSupersedeConfirmDiff",
);
const specOverrideSupersedeConfirmRemarks = document.getElementById(
  "specOverrideSupersedeConfirmRemarks",
);
const specOverrideSupersedeConfirmCancel = document.getElementById(
  "specOverrideSupersedeConfirmCancel",
);
const specOverrideSupersedeConfirmBtn = document.getElementById(
  "specOverrideSupersedeConfirmBtn",
);

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
const specRequestReviewSummary = document.getElementById(
  "specRequestReviewSummary",
);
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
const specRequestRejectNextBtn = document.getElementById(
  "specRequestRejectNextBtn",
);
const specRequestApproveNextBtn = document.getElementById(
  "specRequestApproveNextBtn",
);
const specRequestRouteDecisionSection = document.getElementById(
  "specRequestRouteDecisionSection",
);
const specRequestOriginalRoute = document.getElementById(
  "specRequestOriginalRoute",
);
const specRequestApplyScope = document.getElementById("specRequestApplyScope");
const specRequestRouteChangeRemarks = document.getElementById(
  "specRequestRouteChangeRemarks",
);
const specRequestRouteChangeRemarksGroup = document.getElementById(
  "specRequestRouteChangeRemarksGroup",
);
const specRequestRouteWarning = document.getElementById(
  "specRequestRouteWarning",
);
// PM Effective Preview
const epPmCard = document.getElementById("epPmCard");
const epPmItemSelect = document.getElementById("epPmItemSelect");
const epPmBanner = document.getElementById("epPmBanner");
const epPmTableCard = document.getElementById("epPmTableCard");
const epPmTableBody = document.getElementById("epPmTableBody");
const epPmLineCount = document.getElementById("epPmLineCount");

// ── Module state ──────────────────────────────────────────────────────────────
let currentSubjectType = null; // "FG" | "RM" | "PM"
let currentTab = "reviewQueue"; // "reviewQueue" | "changeHistory" | "overrideRegister" | "baseSpec" | "overrides" | "effectivePreview"

// FG Base spec state
let bsCurrentProfileId = null;
let bsCurrentGroupId = null;
let bsCurrentGroupName = null;
let bsEditedSpecLines = new Map(); // seqNo -> {seq_no, spec_type, min_value, max_value, text_value, target_value, tolerance_value, tolerance_uom_id, display_text, is_active}
let bsLoadedRows = []; // cached rows from last bsLoadSpecLines (for re-render after modal edit)

// RM Base spec state
let rmCurrentProfileId = null;
let rmCurrentGroupId = null;
let rmCurrentGroupLabel = null;
let rmEditedSpecLines = new Map(); // seqNo -> {seq_no, spec_type, min_value, max_value, text_value, target_value, tolerance_value, tolerance_uom_id, display_text, is_active}
let rmLoadedRows = [];

// PM Base spec state
let pmCurrentProfileId = null;
let pmCurrentGroupId = null;
let pmCurrentGroupLabel = null;
let pmEditedSpecLines = new Map(); // seqNo -> {seq_no, spec_type, min_value, max_value, text_value, target_value, tolerance_value, tolerance_uom_id, display_text, is_active}
let pmLoadedRows = [];

let rebuildSubject = null;
let rebuildFamilyId = null;
let rebuildFamilyLabel = null;
let fullResetConfirmModal = null;
let fullResetConfirmResolve = null;

// Base Spec Line edit modal state
let bsLineCurrentSubject = null; // "FG" | "RM" | "PM"
let bsLineCurrentSeqNo = null;
let bsLineProtocolContext = null;
let bsLineModalOpenedSpecType = null;
let bsLineExceptionConfirmAcknowledged = false;

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
let changeHistoryRows = [];
let overrideRegisterRows = [];
let selectedLifecycleHistoryRow = null;
let selectedOverrideRegisterRow = null;
let overrideRegisterActionInFlight = false;
let pendingDeactivateOverrideRow = null;
let pendingDeactivateRemarks = "";
let overrideDeactivateConfirmOpen = false;
let pendingSupersedeOldRow = null;
let pendingSupersedePayload = null;
let pendingSupersedeRemarks = "";
let overrideSupersedeFormOpen = false;
let overrideSupersedeConfirmOpen = false;
let supersedeModalPrefill = {};
let supersedeLockedTestResultKind = "";
let rqFilterDrawerOpen = false;
let chFilterDrawerOpen = false;
let orFilterDrawerOpen = false;
let currentUserId = null;
let specRequestReviewMode = null; // "reviewQueue" | "context"
let specRequestReviewInFlight = false;

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
  wireChangeHistoryEvents();
  wireOverrideRegisterEvents();
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
  tabStrip?.classList.add("hidden");
  reviewQueuePanel?.classList.add("hidden");
  changeHistoryPanel?.classList.add("hidden");
  overrideRegisterPanel?.classList.add("hidden");
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
  TAB_BUTTONS.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  tabSelect?.addEventListener("change", () => {
    if (tabSelect.value) switchTab(tabSelect.value);
  });
}

function syncTabSelectValue(tabId) {
  if (tabSelect && tabSelect.value !== tabId) {
    tabSelect.value = tabId;
  }
}

function syncReviewQueueTabSelectLabel(totalPending = 0) {
  const rqOption = tabSelect?.querySelector('option[value="reviewQueue"]');
  if (!rqOption) return;
  const count = Number(totalPending);
  rqOption.textContent =
    count > 0 ? `Review Queue (${count})` : "Review Queue";
}

function switchTab(tabId, forceRefresh = false) {
  if (tabId === currentTab && !forceRefresh) return;
  currentTab = tabId;

  // Update tab buttons
  TAB_BUTTONS.forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  syncTabSelectValue(tabId);

  // Show/hide panels
  reviewQueuePanel?.classList.toggle("hidden", tabId !== "reviewQueue");
  changeHistoryPanel?.classList.toggle("hidden", tabId !== "changeHistory");
  overrideRegisterPanel?.classList.toggle("hidden", tabId !== "overrideRegister");
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
  const isCH = tabId === "changeHistory";
  const isOR = tabId === "overrideRegister";
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

  if (isCH) {
    void loadChangeHistory();
    return;
  }

  if (isOR) {
    void loadOverrideRegister();
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
  specRequestApproveNextBtn?.addEventListener("click", () =>
    submitSpecRequestReview("approve", { continueNext: true }),
  );
  specRequestRejectNextBtn?.addEventListener("click", () =>
    submitSpecRequestReview("reject", { continueNext: true }),
  );
  specRequestApplyScope?.addEventListener("change", () => {
    syncSpecRequestRouteDecisionUi(getSelectedPendingReviewRequest());
  });
}

function getReviewQueueDefaultFilters() {
  return {
    subject: "",
    scope: "",
    search: "",
  };
}

function getReviewQueueActiveFilterCount() {
  const defaults = getReviewQueueDefaultFilters();
  let count = 0;
  if (String(rqSubjectFilter?.value ?? "") !== defaults.subject) count += 1;
  if (String(rqScopeFilter?.value ?? "") !== defaults.scope) count += 1;
  if (String(rqSearchInput?.value ?? "").trim() !== defaults.search) count += 1;
  return count;
}

function updateRqFilterBadge() {
  const count = getReviewQueueActiveFilterCount();
  if (!rqFilterBadge) return;
  rqFilterBadge.textContent = String(count);
  rqFilterBadge.classList.toggle("hidden", count <= 0);
  rqFilterBtn?.classList.toggle(
    "rq-filter-btn--active",
    count > 0 || rqFilterDrawerOpen,
  );
}

function clearReviewQueueFilters() {
  const defaults = getReviewQueueDefaultFilters();
  if (rqSubjectFilter) rqSubjectFilter.value = defaults.subject;
  if (rqScopeFilter) rqScopeFilter.value = defaults.scope;
  if (rqSearchInput) rqSearchInput.value = defaults.search;
  renderReviewQueue();
  updateRqFilterBadge();
}

function toggleRqFilterDrawer() {
  if (rqFilterDrawerOpen) {
    closeRqFilterDrawer();
    return;
  }
  if (orFilterDrawerOpen) closeOrFilterDrawer();
  if (chFilterDrawerOpen) closeChFilterDrawer();
  rqFilterDrawerOpen = true;
  openSpecFilterDrawer(rqFilterBtn, rqFilterDrawer);
  rqFilterBtn?.classList.add("rq-filter-btn--active");
  updateRqFilterBadge();
}

function closeRqFilterDrawer() {
  if (!rqFilterDrawerOpen && !rqFilterDrawer?.classList.contains("open")) {
    return;
  }
  rqFilterDrawerOpen = false;
  closeSpecFilterDrawer(rqFilterBtn, rqFilterDrawer);
  rqFilterBtn?.classList.remove("rq-filter-btn--active");
  updateRqFilterBadge();
}

function wireReviewQueueEvents() {
  rqFilterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRqFilterDrawer();
  });
  rqFilterClose?.addEventListener("click", closeRqFilterDrawer);
  rqFilterApply?.addEventListener("click", closeRqFilterDrawer);
  rqFilterClear?.addEventListener("click", clearReviewQueueFilters);
  rqExportBtn?.addEventListener("click", exportReviewQueueCsv);

  const onFilterChange = () => {
    renderReviewQueue();
    updateRqFilterBadge();
  };
  rqSubjectFilter?.addEventListener("change", onFilterChange);
  rqScopeFilter?.addEventListener("change", onFilterChange);
  rqSearchInput?.addEventListener("input", onFilterChange);

  rqFilterDrawer?.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (!rqFilterDrawerOpen || !rqFilterDrawer || !rqFilterBtn) return;
    if (isSpecFilterDrawerClickInside(rqFilterBtn, rqFilterDrawer, e.target)) {
      return;
    }
    closeRqFilterDrawer();
  });

  reviewQueueTableBody?.addEventListener("click", (e) => {
    if (
      e.target.closest(
        "button, a, input, select, textarea, label, [data-no-row-open]",
      )
    ) {
      return;
    }
    const row = e.target.closest(
      "tr.spec-review-row-clickable[data-review-request-id]",
    );
    if (!row) return;
    openReviewQueueRequest(row.dataset.reviewRequestId);
  });

  reviewQueueTableBody?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(
      "tr.spec-review-row-clickable[data-review-request-id]",
    );
    if (!row) return;
    e.preventDefault();
    openReviewQueueRequest(row.dataset.reviewRequestId);
  });
}

function clearReviewQueueRowActiveState() {
  reviewQueueTableBody
    ?.querySelectorAll(".spec-review-row-active")
    .forEach((row) => row.classList.remove("spec-review-row-active"));
}

function setReviewQueueRowActive(requestId) {
  if (!reviewQueueTableBody || requestId == null || requestId === "") return;
  clearReviewQueueRowActiveState();
  reviewQueueTableBody
    .querySelectorAll("tr.spec-review-row-clickable[data-review-request-id]")
    .forEach((row) => {
      if (String(row.dataset.reviewRequestId) === String(requestId)) {
        row.classList.add("spec-review-row-active");
      }
    });
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

  if (reviewQueueTabBadge) {
    reviewQueueTabBadge.textContent = String(total);
    reviewQueueTabBadge.classList.toggle("hidden", total <= 0);
  }
  syncReviewQueueTabSelectLabel(total);
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
      row.reference_source_display,
      row.current_reference_source_display,
      row.proposed_reference_source_display,
      getRowCurrentReferenceSource(row),
      getRowProposedReferenceSource(row),
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" | ");

    return haystack.includes(q);
  });
}

function pickNextReviewQueueRequestId(reviewedId, priorOrderIds) {
  const refreshedIds = getFilteredReviewQueueRows().map((r) =>
    String(r.request_id),
  );
  if (!refreshedIds.length) return null;

  const reviewed = String(reviewedId);
  const idx = priorOrderIds.indexOf(reviewed);

  for (let i = idx + 1; i < priorOrderIds.length; i++) {
    const id = priorOrderIds[i];
    if (id !== reviewed && refreshedIds.includes(id)) return id;
  }

  const wrapEnd = idx >= 0 ? idx : priorOrderIds.length;
  for (let i = 0; i < wrapEnd; i++) {
    const id = priorOrderIds[i];
    if (id !== reviewed && refreshedIds.includes(id)) return id;
  }

  return refreshedIds.find((id) => id !== reviewed) ?? null;
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
    reviewQueueTableBody.innerHTML = `<tr><td colspan="8">
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

      const requestId = String(r.request_id);
      const testName = String(r.test_name ?? "test");

      return `<tr class="spec-review-row-clickable" data-request-id="${esc(requestId)}" data-review-request-id="${esc(requestId)}" tabindex="0" role="button" aria-label="Review request #${esc(requestId)}, ${esc(testName)}">
        <td class="${ageClass}">${esc(formatAgeHours(r.age_hours))}</td>
        <td>#${esc(requestId)}</td>
        <td>${esc(String(r.review_route_label ?? r.request_scope ?? ""))}</td>
        <td>${esc(String(r.subject_type ?? ""))}</td>
        <td>
          <strong>${esc(String(r.entity_label ?? "--"))}</strong>
          <div class="workflow-compact-cell-meta">${esc(String(r.family_label ?? ""))}</div>
        </td>
        <td>${esc(String(r.test_name ?? "--"))}</td>
        <td>
          <div>${esc(String(r.proposed_display_text ?? "--"))}</div>
          ${renderReferenceSourceSublineHtml(r, "workflow-compact-cell-meta")}
        </td>
        <td>${esc(String(r.source_analysis_register_no ?? r.analysis_register_no ?? "--"))}</td>
      </tr>`;
    })
    .join("");
}

// ── Floating filter drawers (Change History + Applied Overrides) ────────────

function positionSpecFilterDrawer(btn, drawer) {
  if (!btn || !drawer) return;
  const rect = btn.getBoundingClientRect();
  const margin = 6;
  const dropW = drawer.offsetWidth || 300;

  let left = rect.left;
  if (left + dropW > window.innerWidth - margin) {
    left = Math.max(margin, rect.right - dropW);
  }

  let top = rect.bottom + margin;
  const dropH = drawer.offsetHeight || 320;
  if (top + dropH > window.innerHeight - margin) {
    const up = rect.top - margin - dropH;
    if (up >= margin) top = up;
  }

  const availableBelow = Math.max(
    140,
    window.innerHeight - top - margin,
  );
  const maxH = Math.min(
    520,
    availableBelow,
    Math.floor(window.innerHeight * 0.8),
  );
  drawer.style.maxHeight = `${maxH}px`;
  drawer.style.position = "fixed";
  drawer.style.left = `${Math.round(left)}px`;
  drawer.style.top = `${Math.round(top)}px`;
  drawer.style.right = "auto";
  drawer.style.bottom = "auto";
  drawer.style.zIndex = "4000";
}

function stopSpecFilterDrawerTracking(drawer) {
  if (!drawer) return;
  if (typeof drawer._stopFollowPosition === "function") {
    drawer._stopFollowPosition();
    drawer._stopFollowPosition = null;
  }
}

function startSpecFilterDrawerTracking(btn, drawer) {
  if (!btn || !drawer) return;
  stopSpecFilterDrawerTracking(drawer);

  let rafId = 0;
  const tick = () => {
    if (!drawer.classList.contains("open")) {
      rafId = 0;
      return;
    }
    positionSpecFilterDrawer(btn, drawer);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  drawer._stopFollowPosition = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
}

function clearSpecFilterDrawerInlineStyles(drawer) {
  if (!drawer) return;
  drawer.style.position = "";
  drawer.style.left = "";
  drawer.style.top = "";
  drawer.style.right = "";
  drawer.style.bottom = "";
  drawer.style.zIndex = "";
  drawer.style.maxHeight = "";
}

function openSpecFilterDrawer(btn, drawer) {
  if (!btn || !drawer) return;

  if (!drawer._portalPlaceholder) {
    drawer._portalPlaceholder = document.createComment("spec-filter-drawer");
  }
  if (drawer.parentNode !== document.body) {
    const parent = drawer.parentNode;
    if (parent) {
      parent.insertBefore(drawer._portalPlaceholder, drawer);
      document.body.appendChild(drawer);
    }
  }

  drawer.classList.add("open", "spec-filter-drawer--floating");
  drawer._ownerBtn = btn;
  btn.setAttribute("aria-expanded", "true");
  positionSpecFilterDrawer(btn, drawer);
  startSpecFilterDrawerTracking(btn, drawer);
}

function closeSpecFilterDrawer(btn, drawer) {
  if (!drawer) return;
  const ownerBtn = btn || drawer._ownerBtn;
  drawer.classList.remove("open", "spec-filter-drawer--floating");
  if (ownerBtn) ownerBtn.setAttribute("aria-expanded", "false");
  stopSpecFilterDrawerTracking(drawer);
  clearSpecFilterDrawerInlineStyles(drawer);

  if (
    drawer._portalPlaceholder &&
    drawer._portalPlaceholder.parentNode instanceof Node
  ) {
    drawer._portalPlaceholder.parentNode.insertBefore(
      drawer,
      drawer._portalPlaceholder,
    );
    drawer._portalPlaceholder.remove();
    drawer._portalPlaceholder = null;
  }
  drawer._ownerBtn = null;
}

function isSpecFilterDrawerClickInside(btn, drawer, target) {
  if (!target) return false;
  if (btn?.contains(target)) return true;
  if (drawer?.contains(target)) return true;
  return false;
}

// ── CHANGE HISTORY (read-only) ────────────────────────────────────────────────

function wireChangeHistoryEvents() {
  chFilterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleChFilterDrawer();
  });
  chFilterClose?.addEventListener("click", closeChFilterDrawer);
  chFilterApply?.addEventListener("click", closeChFilterDrawer);
  chFilterClear?.addEventListener("click", clearChangeHistoryFilters);
  chExportBtn?.addEventListener("click", exportChangeHistoryCsv);

  const onFilterChange = () => {
    renderChangeHistory();
    updateChFilterBadge();
  };
  chHistoryTypeFilter?.addEventListener("change", onFilterChange);
  chStatusFilter?.addEventListener("change", onFilterChange);
  chScopeFilter?.addEventListener("change", onFilterChange);
  chSubjectFilter?.addEventListener("change", onFilterChange);
  chRouteFilter?.addEventListener("change", onFilterChange);
  chAppliedTargetFilter?.addEventListener("change", onFilterChange);
  chSearchInput?.addEventListener("input", onFilterChange);

  chFilterDrawer?.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (!chFilterDrawerOpen || !chFilterDrawer || !chFilterBtn) return;
    if (isSpecFilterDrawerClickInside(chFilterBtn, chFilterDrawer, e.target)) {
      return;
    }
    closeChFilterDrawer();
  });

  chHistoryTableBody?.addEventListener("click", (e) => {
    if (chFilterDrawerOpen) return;
    if (
      e.target.closest(
        "button, a, input, select, textarea, label, [data-no-row-open]",
      )
    ) {
      return;
    }
    const row = e.target.closest(
      "tr.spec-history-row-clickable[data-history-id]",
    );
    if (!row) return;
    openLifecycleHistoryModal(row.dataset.historyId);
  });

  chHistoryTableBody?.addEventListener("keydown", (e) => {
    if (chFilterDrawerOpen) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(
      "tr.spec-history-row-clickable[data-history-id]",
    );
    if (!row) return;
    e.preventDefault();
    openLifecycleHistoryModal(row.dataset.historyId);
  });

  specLifecycleHistoryClose?.addEventListener(
    "click",
    closeLifecycleHistoryModal,
  );
  specLifecycleHistoryFooterClose?.addEventListener(
    "click",
    closeLifecycleHistoryModal,
  );
  specLifecycleHistoryModal?.addEventListener("click", (e) => {
    if (e.target === specLifecycleHistoryModal) closeLifecycleHistoryModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (
      !specLifecycleHistoryModal ||
      specLifecycleHistoryModal.classList.contains("hidden")
    ) {
      return;
    }
    if (isHigherPriorityModalOpenForLifecycleHistory()) return;
    e.preventDefault();
    closeLifecycleHistoryModal();
  });
}

function toggleChFilterDrawer() {
  if (chFilterDrawerOpen) {
    closeChFilterDrawer();
    return;
  }
  if (rqFilterDrawerOpen) closeRqFilterDrawer();
  if (orFilterDrawerOpen) closeOrFilterDrawer();
  chFilterDrawerOpen = true;
  openSpecFilterDrawer(chFilterBtn, chFilterDrawer);
  chFilterBtn?.classList.add("ch-filter-btn--active");
  updateChFilterBadge();
}

function closeChFilterDrawer() {
  if (!chFilterDrawerOpen && !chFilterDrawer?.classList.contains("open")) {
    return;
  }
  chFilterDrawerOpen = false;
  closeSpecFilterDrawer(chFilterBtn, chFilterDrawer);
  chFilterBtn?.classList.remove("ch-filter-btn--active");
  updateChFilterBadge();
}

function getChangeHistoryDefaultFilters() {
  return {
    historyType: "",
    subject: "",
    status: "",
    scope: "",
    route: "",
    appliedTarget: "",
    search: "",
  };
}

function getChangeHistoryActiveFilterCount() {
  const defaults = getChangeHistoryDefaultFilters();
  let count = 0;
  if (String(chHistoryTypeFilter?.value ?? "") !== defaults.historyType) count += 1;
  if (String(chSubjectFilter?.value ?? "") !== defaults.subject) count += 1;
  if (String(chStatusFilter?.value ?? "") !== defaults.status) count += 1;
  if (String(chScopeFilter?.value ?? "") !== defaults.scope) count += 1;
  if (String(chRouteFilter?.value ?? "") !== defaults.route) count += 1;
  if (String(chAppliedTargetFilter?.value ?? "") !== defaults.appliedTarget)
    count += 1;
  if (String(chSearchInput?.value ?? "").trim() !== defaults.search) count += 1;
  return count;
}

function updateChFilterBadge() {
  const count = getChangeHistoryActiveFilterCount();
  if (!chFilterBadge) return;
  chFilterBadge.textContent = String(count);
  chFilterBadge.classList.toggle("hidden", count <= 0);
  chFilterBtn?.classList.toggle(
    "ch-filter-btn--active",
    count > 0 || chFilterDrawerOpen,
  );
}

function clearChangeHistoryFilters() {
  const defaults = getChangeHistoryDefaultFilters();
  if (chHistoryTypeFilter) chHistoryTypeFilter.value = defaults.historyType;
  if (chSubjectFilter) chSubjectFilter.value = defaults.subject;
  if (chStatusFilter) chStatusFilter.value = defaults.status;
  if (chScopeFilter) chScopeFilter.value = defaults.scope;
  if (chRouteFilter) chRouteFilter.value = defaults.route;
  if (chAppliedTargetFilter) chAppliedTargetFilter.value = defaults.appliedTarget;
  if (chSearchInput) chSearchInput.value = defaults.search;
  renderChangeHistory();
  updateChFilterBadge();
}

function isChangeHistoryRequestRow(row) {
  const t = String(row.history_type ?? "REQUEST").trim().toUpperCase();
  return t === "REQUEST";
}

function isChangeHistoryOverrideRow(row) {
  const t = String(row.history_type ?? "").trim().toUpperCase();
  return t === "OVERRIDE_LIFECYCLE" || t === "OVERRIDE";
}

function getChangeHistoryRequestStatus(row) {
  return String(row.history_status ?? row.request_status ?? "")
    .trim()
    .toUpperCase();
}

function getChangeHistoryRouteLabel(row) {
  return String(row.route_label ?? row.review_route_label ?? "").trim();
}

function getChangeHistoryEventAt(row) {
  return row.event_at ?? row.requested_at ?? row.performed_at ?? null;
}

function getChangeHistoryLifecycleAction(row) {
  return String(row.history_action ?? row.audit_action ?? "")
    .trim()
    .toUpperCase();
}

function normalizeRequestStatus(row) {
  return getChangeHistoryRequestStatus(row);
}

function normalizeRequestScope(row) {
  return String(row.request_scope ?? "").trim().toUpperCase();
}

function normalizeAppliedTargetType(row) {
  return String(row.applied_target_type ?? "").trim().toUpperCase();
}

function normalizeReviewRoute(row) {
  return getChangeHistoryRouteLabel(row);
}

function isChangeHistoryRowPending(row) {
  if (!isChangeHistoryRequestRow(row)) return false;
  const status = normalizeRequestStatus(row);
  const target = normalizeAppliedTargetType(row);
  return status === "PENDING" || target === "PENDING_REVIEW";
}

function isChangeHistoryRowApplied(row) {
  if (!isChangeHistoryRequestRow(row)) return false;
  const status = normalizeRequestStatus(row);
  const target = normalizeAppliedTargetType(row);
  return (
    status === "APPLIED" ||
    status === "APPROVED" ||
    target === "BASE_SPEC_VERSION" ||
    target === "PRODUCT_ITEM_OVERRIDE"
  );
}

function isChangeHistoryRowRejected(row) {
  if (!isChangeHistoryRequestRow(row)) return false;
  const status = normalizeRequestStatus(row);
  const target = normalizeAppliedTargetType(row);
  return status === "REJECTED" || target === "REJECTED_NO_APPLIED_TARGET";
}

function isChangeHistoryRowCancelled(row) {
  if (!isChangeHistoryRequestRow(row)) return false;
  return normalizeRequestStatus(row) === "CANCELLED";
}

function isChangeHistoryRowDeactivated(row) {
  if (!isChangeHistoryOverrideRow(row)) return false;
  return getChangeHistoryLifecycleAction(row) === "DEACTIVATE";
}

function isChangeHistoryRowReactivated(row) {
  if (!isChangeHistoryOverrideRow(row)) return false;
  return getChangeHistoryLifecycleAction(row) === "REACTIVATE";
}

function isChangeHistoryRowSuperseded(row) {
  if (!isChangeHistoryOverrideRow(row)) return false;
  return getChangeHistoryLifecycleAction(row) === "SUPERSEDE";
}

function shouldIncludeSupersedeRowInTable(row) {
  const action = String(
    row.history_action ?? row.audit_action ?? "",
  ).toUpperCase();
  if (action !== "SUPERSEDE") return true;
  const role = String(row.supersede_role ?? "").toUpperCase();
  if (!role) return true;
  return role === "PREDECESSOR";
}

function rowMatchesChangeHistoryScopeFilter(row, scope) {
  if (!scope) return true;
  if (isChangeHistoryOverrideRow(row)) {
    return scope === "PRODUCT";
  }
  return normalizeRequestScope(row) === scope;
}

function rowMatchesChangeHistoryAppliedTargetFilter(row, appliedTarget) {
  if (!appliedTarget) return true;
  if (isChangeHistoryOverrideRow(row)) {
    return appliedTarget === "PRODUCT_ITEM_OVERRIDE";
  }
  return normalizeAppliedTargetType(row) === appliedTarget;
}

function rowMatchesChangeHistoryRouteFilter(row, filter) {
  if (!filter) return true;

  if (isChangeHistoryOverrideRow(row)) {
    const subject = String(row.subject_type ?? "").toUpperCase();
    const levelLabel = String(
      row.override_level_label ?? row.route_label ?? "",
    ).toLowerCase();
    if (filter === "family" || filter === "base_spec") return false;
    if (filter === "product_override") {
      return subject === "FG" || levelLabel.includes("product");
    }
    if (filter === "item_override") {
      return (
        subject === "RM" ||
        subject === "PM" ||
        levelLabel.includes("item")
      );
    }
    return true;
  }

  const route = normalizeReviewRoute(row).toLowerCase();
  const scope = normalizeRequestScope(row);
  const subject = String(row.subject_type ?? "").toUpperCase();

  if (filter === "family") {
    return route.includes("family") || scope === "FAMILY";
  }
  if (filter === "base_spec") {
    return route.includes("base spec") || scope === "FAMILY";
  }
  if (filter === "product_override") {
    return (
      route.includes("product override") ||
      (scope === "PRODUCT" && subject === "FG")
    );
  }
  if (filter === "item_override") {
    return (
      route.includes("item override") ||
      (scope === "PRODUCT" && (subject === "RM" || subject === "PM"))
    );
  }
  return true;
}

function formatChangeHistoryLifecycleActionLabel(action) {
  const a = String(action ?? "").trim().toUpperCase();
  if (a === "DEACTIVATE") return "Deactivated";
  if (a === "REACTIVATE") return "Reactivated";
  if (a === "SUPERSEDE") return "Superseded";
  return action ? String(action) : "—";
}

function getChangeHistoryOverrideRouteLabel(row) {
  const route = getChangeHistoryRouteLabel(row);
  if (route) return route;
  const level = String(row.override_level_label ?? "").trim();
  if (level) return level;
  const subject = String(row.subject_type ?? "").toUpperCase();
  if (subject === "FG") return "Product Override";
  if (subject === "RM" || subject === "PM") return "Item Override";
  return "Product / Item Override";
}

function buildChangeHistorySearchHaystack(row) {
  return [
    row.search_text,
    row.history_id,
    row.history_type,
    row.history_action,
    row.history_status,
    row.request_id,
    row.audit_id,
    row.override_id,
    row.subject_type,
    row.entity_label,
    row.family_label,
    row.test_name,
    row.route_label,
    row.review_route_label,
    row.request_scope,
    row.override_scope,
    row.override_level_label,
    row.current_display_text,
    row.proposed_display_text,
    row.override_display_text,
    row.predecessor_display_text,
    row.successor_display_text,
    row.supersedes_override_label,
    row.superseded_by_override_label,
    row.supersede_role,
    row.source_analysis_register_no,
    row.analysis_register_no,
    row.source_context,
    row.requested_by_name,
    row.reviewed_by_name,
    row.request_remarks,
    row.review_remarks,
    row.audit_remarks,
    row.applied_target_label,
    row.applied_target_type,
    row.applied_spec_profile_name,
    row.applied_override_display_text,
    row.reference_source_display,
    row.current_reference_source_display,
    row.proposed_reference_source_display,
    getRowCurrentReferenceSource(row),
    getRowProposedReferenceSource(row),
    row.review_decision,
    row.review_apply_scope,
    row.review_applied_target_type,
    row.review_applied_route_label,
    row.route_changed_from_scope,
    row.route_changed_to_scope,
    row.route_changed_by_name,
    row.route_change_remarks,
    formatRouteChangedSummary(row),
    formatApplyScopeLabel(row.route_changed_from_scope, row.subject_type),
    formatApplyScopeLabel(row.route_changed_to_scope, row.subject_type),
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" | ");
}

async function loadChangeHistory() {
  let { data, error } = await labSupabase
    .from("v_spec_lifecycle_history")
    .select("*")
    .order("event_at", { ascending: false });

  if (error) {
    const fallback = await labSupabase
      .from("v_spec_lifecycle_history")
      .select("*")
      .order("history_id", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    toast("Failed to load change history: " + error.message, "error");
    changeHistoryRows = [];
    renderChangeHistory();
    return;
  }

  changeHistoryRows = data ?? [];
  renderChangeHistory();
  updateChFilterBadge();
}

function getFilteredChangeHistoryRows() {
  const historyType = String(chHistoryTypeFilter?.value ?? "")
    .trim()
    .toUpperCase();
  const status = String(chStatusFilter?.value ?? "").toLowerCase();
  const scope = String(chScopeFilter?.value ?? "").toUpperCase();
  const subject = String(chSubjectFilter?.value ?? "").toUpperCase();
  const route = String(chRouteFilter?.value ?? "").toLowerCase();
  const appliedTarget = String(chAppliedTargetFilter?.value ?? "").toUpperCase();
  const q = String(chSearchInput?.value ?? "").trim().toLowerCase();

  return changeHistoryRows.filter((row) => {
    if (!shouldIncludeSupersedeRowInTable(row)) return false;

    if (historyType === "REQUEST" && !isChangeHistoryRequestRow(row)) {
      return false;
    }
    if (
      historyType === "OVERRIDE_LIFECYCLE" &&
      !isChangeHistoryOverrideRow(row)
    ) {
      return false;
    }

    if (subject && String(row.subject_type ?? "").toUpperCase() !== subject) {
      return false;
    }

    if (!rowMatchesChangeHistoryScopeFilter(row, scope)) return false;

    if (status === "pending" && !isChangeHistoryRowPending(row)) return false;
    if (status === "applied" && !isChangeHistoryRowApplied(row)) return false;
    if (status === "rejected" && !isChangeHistoryRowRejected(row)) return false;
    if (status === "cancelled" && !isChangeHistoryRowCancelled(row)) {
      return false;
    }
    if (status === "deactivated" && !isChangeHistoryRowDeactivated(row)) {
      return false;
    }
    if (status === "reactivated" && !isChangeHistoryRowReactivated(row)) {
      return false;
    }
    if (status === "superseded" && !isChangeHistoryRowSuperseded(row)) {
      return false;
    }

    if (route && !rowMatchesChangeHistoryRouteFilter(row, route)) return false;

    if (!rowMatchesChangeHistoryAppliedTargetFilter(row, appliedTarget)) {
      return false;
    }

    if (!q) return true;
    return buildChangeHistorySearchHaystack(row).includes(q);
  });
}

function renderChangeHistoryStatusBadge(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const action = getChangeHistoryLifecycleAction(row);
    let cls = "ch-status-badge-other";
    if (action === "DEACTIVATE") cls = "ch-status-badge-deactivated";
    else if (action === "REACTIVATE") cls = "ch-status-badge-reactivated";
    else if (action === "SUPERSEDE") cls = "ch-status-badge-superseded";
    const label = formatChangeHistoryLifecycleActionLabel(action);
    return `<span class="ch-status-badge ${cls}">${esc(label)}</span><div class="ch-history-type-meta">Override lifecycle</div>`;
  }

  const status = normalizeRequestStatus(row);
  let cls = "ch-status-badge-other";
  if (status === "PENDING" || isChangeHistoryRowPending(row)) {
    cls = "ch-status-badge-pending";
  } else if (
    status === "APPLIED" ||
    status === "APPROVED" ||
    isChangeHistoryRowApplied(row)
  ) {
    cls = "ch-status-badge-applied";
  } else if (status === "REJECTED" || isChangeHistoryRowRejected(row)) {
    cls = "ch-status-badge-rejected";
  } else if (status === "CANCELLED" || isChangeHistoryRowCancelled(row)) {
    cls = "ch-status-badge-cancelled";
  }
  const label =
    row.history_status ?? row.request_status
      ? String(row.history_status ?? row.request_status)
      : "—";
  return `<span class="ch-status-badge ${cls}">${esc(label)}</span><div class="ch-history-type-meta">Request</div>`;
}

function renderChangeHistoryRouteCell(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const routeLabel = getChangeHistoryOverrideRouteLabel(row);
    return `<div><span class="ch-route-badge">${esc(routeLabel)}</span></div>`;
  }

  const requested = getRequestOriginalRouteLabel(row);
  const requestedHtml = `<div><span class="ch-route-badge">${esc(requested)}</span></div>`;

  const appliedLabel = String(row.review_applied_route_label ?? "").trim();
  const appliedHtml = appliedLabel
    ? `<div class="ch-audit-meta">Applied: ${esc(appliedLabel)}</div>`
    : "";

  const changedSummary = formatRouteChangedSummary(row);
  const changedHtml = changedSummary
    ? `<div class="ch-route-changed-meta">${esc(changedSummary)}</div>`
    : "";

  return requestedHtml + appliedHtml + changedHtml;
}

function renderChangeHistoryCurrentCell(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const action = getChangeHistoryLifecycleAction(row);
    if (action === "SUPERSEDE") {
      const pred = String(row.predecessor_display_text ?? "").trim();
      if (pred) return esc(pred);
    }
    const current = String(row.current_display_text ?? "").trim();
    if (current) return esc(current);
    const override = String(row.override_display_text ?? "").trim();
    return override ? esc(override) : "—";
  }
  return esc(String(row.current_display_text ?? "—"));
}

function renderChangeHistoryProposedCell(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const action = getChangeHistoryLifecycleAction(row);
    if (action === "SUPERSEDE") {
      const successor = String(row.successor_display_text ?? "").trim();
      if (successor) {
        const link = row.superseded_by_override_label
          ? `<div class="ch-audit-meta">${esc(String(row.superseded_by_override_label))}</div>`
          : "";
        return `<div>${esc(successor)}</div>${link}`;
      }
    }
    if (action === "DEACTIVATE") return "Inactive";
    if (action === "REACTIVATE") return "Active";
    const proposed = String(row.proposed_display_text ?? "").trim();
    return proposed ? esc(proposed) : "—";
  }

  return `<div>${esc(String(row.proposed_display_text ?? "—"))}</div>${renderReferenceSourceSublineHtml(row, "ch-audit-meta")}`;
}

function renderChangeHistoryRequestedCell(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const actionLabel = formatChangeHistoryLifecycleActionLabel(
      getChangeHistoryLifecycleAction(row),
    );
    const at = getChangeHistoryEventAt(row);
    return `<div>${esc(actionLabel)}</div><div class="ch-audit-meta">${esc(at ? formatDateTime(at) : "—")}</div>`;
  }

  const by = row.requested_by_name ? String(row.requested_by_name) : "—";
  const at = row.requested_at ? formatDateTime(row.requested_at) : "—";
  return `<div>${esc(by)}</div><div class="ch-audit-meta">${esc(at)}</div>`;
}

function renderChangeHistoryReviewedCell(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const remarks = row.audit_remarks ? String(row.audit_remarks).trim() : "";
    if (!remarks) return "—";
    return `<div class="ch-audit-meta">${esc(remarks.length > 80 ? `${remarks.slice(0, 80)}…` : remarks)}</div>`;
  }

  const by = row.reviewed_by_name ? String(row.reviewed_by_name) : "—";
  const at = row.reviewed_at ? formatDateTime(row.reviewed_at) : "—";
  const remarks = row.review_remarks ? String(row.review_remarks).trim() : "";
  const remarksHtml = remarks
    ? `<div class="ch-audit-meta">${esc(remarks.length > 60 ? `${remarks.slice(0, 60)}…` : remarks)}</div>`
    : "";
  return `<div>${esc(by)}</div><div class="ch-audit-meta">${esc(at)}</div>${remarksHtml}`;
}

function renderActiveStateLabel(isActive) {
  if (isActive === true) return "Active";
  if (isActive === false) return "Inactive";
  return "";
}

function renderChangeHistoryAppliedTarget(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const overrideId = row.override_id ?? row.applied_override_id;
    const idLabel = overrideId != null ? `#${overrideId}` : "Override";
    const display = String(row.override_display_text ?? "").trim();
    const displayHtml = display
      ? `<div class="ch-audit-meta">${esc(display)}</div>`
      : "";
    const supersedes = row.supersedes_override_label
      ? `<div class="ch-audit-meta">Supersedes: ${esc(String(row.supersedes_override_label))}</div>`
      : "";
    const supersededBy = row.superseded_by_override_label
      ? `<div class="ch-audit-meta">Superseded by: ${esc(String(row.superseded_by_override_label))}</div>`
      : "";
    return `<div><strong>${esc(idLabel)}</strong></div>${displayHtml}${supersedes}${supersededBy}`;
  }

  const target = normalizeAppliedTargetType(row);

  if (target === "PENDING_REVIEW") {
    return `<div>Pending review</div>`;
  }
  if (target === "REJECTED_NO_APPLIED_TARGET") {
    return `<div>Rejected</div>`;
  }
  if (target === "BASE_SPEC_VERSION") {
    const label = row.applied_target_label
      ? String(row.applied_target_label)
      : "Base Spec Version";
    const name = row.applied_spec_profile_name
      ? String(row.applied_spec_profile_name)
      : "";
    const version =
      row.applied_spec_profile_version != null &&
      row.applied_spec_profile_version !== ""
        ? String(row.applied_spec_profile_version)
        : row.version_no != null && row.version_no !== ""
          ? String(row.version_no)
          : "";
    const versionPart =
      name && version ? `${name} v${version}` : name || (version ? `v${version}` : "");
    const state = renderActiveStateLabel(row.applied_spec_profile_is_active);
    const stateHtml = state
      ? `<div class="ch-audit-meta">${esc(state)}</div>`
      : "";
    const detailHtml = versionPart
      ? `<div class="ch-audit-meta">${esc(versionPart)}</div>`
      : "";
    return `<div><strong>${esc(label)}</strong></div>${detailHtml}${stateHtml}`;
  }
  if (target === "PRODUCT_ITEM_OVERRIDE") {
    const label = row.applied_target_label
      ? String(row.applied_target_label)
      : "Product / Item Override";
    const display = row.applied_override_display_text
      ? String(row.applied_override_display_text)
      : "";
    const state = renderActiveStateLabel(row.applied_override_is_active);
    const displayHtml = display
      ? `<div class="ch-audit-meta">${esc(display)}</div>`
      : "";
    const stateHtml = state
      ? `<div class="ch-audit-meta">${esc(state)}</div>`
      : "";
    return `<div><strong>${esc(label)}</strong></div>${displayHtml}${stateHtml}`;
  }

  const fallback = row.applied_target_label
    ? String(row.applied_target_label)
    : "";
  return fallback ? `<div>${esc(fallback)}</div>` : `<div>—</div>`;
}

function renderChangeHistorySourceAnalysis(row) {
  const reg =
    row.source_analysis_register_no ?? row.analysis_register_no ?? null;
  if (reg) return esc(String(reg));
  if (isChangeHistoryOverrideRow(row)) {
    const ctx = String(row.source_context ?? "").trim();
    if (!ctx) return "—";
    return esc(ctx.length > 40 ? `${ctx.slice(0, 40)}…` : ctx);
  }
  return "—";
}

function truncateWorkflowCell(text, max = 48) {
  const s = String(text ?? "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function renderWorkflowEntityCell(row) {
  const entity = String(row.entity_label ?? "—");
  const family = String(row.family_label ?? "").trim();
  const familyHtml = family
    ? `<div class="workflow-compact-cell-meta">${esc(family)}</div>`
    : "";
  return `<strong>${esc(entity)}</strong>${familyHtml}`;
}

function renderChangeHistoryRouteCompact(row) {
  if (isChangeHistoryOverrideRow(row)) {
    return `<span class="ch-route-badge">${esc(getChangeHistoryOverrideRouteLabel(row))}</span>`;
  }
  const route =
    getRequestOriginalRouteLabel(row) || getChangeHistoryRouteLabel(row);
  return route
    ? `<span class="ch-route-badge">${esc(route)}</span>`
    : "—";
}

function formatLifecycleHistorySummary(row) {
  if (isChangeHistoryRequestRow(row)) {
    const cur = truncateWorkflowCell(row.current_display_text, 42);
    const prop = truncateWorkflowCell(row.proposed_display_text, 42);
    return `<span class="workflow-summary-cell">${esc(cur)} → ${esc(prop)}</span>`;
  }

  const action = getChangeHistoryLifecycleAction(row);
  if (action === "DEACTIVATE") {
    const ov = truncateWorkflowCell(row.override_display_text, 45);
    return `<span class="workflow-summary-cell">${esc(ov)} → Inactive</span>`;
  }
  if (action === "REACTIVATE") {
    const ov = truncateWorkflowCell(row.override_display_text, 45);
    return `<span class="workflow-summary-cell">${esc(ov)} → Active</span>`;
  }
  if (action === "SUPERSEDE") {
    const pred = truncateWorkflowCell(row.predecessor_display_text, 40);
    const succ = truncateWorkflowCell(row.successor_display_text, 40);
    return `<span class="workflow-summary-cell">${esc(pred)} → ${esc(succ)}</span>`;
  }

  const cur = truncateWorkflowCell(row.current_display_text, 42);
  const prop = truncateWorkflowCell(
    row.proposed_display_text ?? row.override_display_text,
    42,
  );
  if (cur !== "—" || prop !== "—") {
    return `<span class="workflow-summary-cell">${esc(cur)} → ${esc(prop)}</span>`;
  }
  return `<span class="workflow-summary-cell">${renderChangeHistoryCurrentCell(row)} → ${renderChangeHistoryProposedCell(row)}</span>`;
}

function formatLifecycleHistoryOutcome(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const overrideId = row.override_id ?? row.applied_override_id;
    const idLabel = overrideId != null ? `Override #${overrideId}` : "Override";
    const supersedes = row.supersedes_override_label
      ? `<div class="workflow-compact-cell-meta">Supersedes: ${esc(String(row.supersedes_override_label))}</div>`
      : "";
    const supersededBy = row.superseded_by_override_label
      ? `<div class="workflow-compact-cell-meta">Superseded by: ${esc(String(row.superseded_by_override_label))}</div>`
      : "";
    return `<div><strong>${esc(idLabel)}</strong></div>${supersedes}${supersededBy}`;
  }

  const targetLabel = row.applied_target_label
    ? String(row.applied_target_label)
    : "";
  if (targetLabel) {
    return `<div>${esc(truncateWorkflowCell(targetLabel, 50))}</div>`;
  }
  const targetType = formatAppliedTargetTypeLabel(row.applied_target_type);
  return targetType ? `<div>${esc(targetType)}</div>` : "—";
}

function getLifecycleHistorySummaryText(row) {
  const pair = (left, right) => {
    const a = normalizeExportValue(left);
    const b = normalizeExportValue(right);
    if (!a && !b) return "";
    return `${a || "—"} → ${b || "—"}`;
  };

  if (isChangeHistoryRequestRow(row)) {
    return pair(row.current_display_text, row.proposed_display_text);
  }

  const action = getChangeHistoryLifecycleAction(row);
  if (action === "DEACTIVATE") {
    return pair(row.override_display_text, "Inactive");
  }
  if (action === "REACTIVATE") {
    return pair(row.override_display_text, "Active");
  }
  if (action === "SUPERSEDE") {
    return pair(row.predecessor_display_text, row.successor_display_text);
  }

  return pair(
    row.current_display_text ?? row.override_display_text,
    row.proposed_display_text ?? row.successor_display_text,
  );
}

function getLifecycleHistoryOutcomeText(row) {
  if (isChangeHistoryOverrideRow(row)) {
    const parts = [];
    const overrideId = row.override_id ?? row.applied_override_id;
    if (overrideId != null && overrideId !== "") {
      parts.push(`Override #${overrideId}`);
    }
    if (row.supersedes_override_label) {
      parts.push(`Supersedes: ${row.supersedes_override_label}`);
    }
    if (row.superseded_by_override_label) {
      parts.push(`Superseded by: ${row.superseded_by_override_label}`);
    }
    return parts.join("; ");
  }

  const label = normalizeExportValue(row.applied_target_label);
  if (label) return label;
  return normalizeExportValue(formatAppliedTargetTypeLabel(row.applied_target_type));
}

function pickExportField(row, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    const v = row?.[key];
    if (v != null && String(v).trim() !== "") return v;
  }
  return "";
}

function pickExportRouteLabel(row) {
  return (
    pickExportField(row, [
      "review_route_label",
      "route_label",
      "request_scope",
    ]) || ""
  );
}

// ── Workflow tab CSV export ───────────────────────────────────────────────────

function formatExportDateForFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeExportValue(value) {
  if (value == null) return "";
  if (typeof value === "boolean") return formatExportBoolean(value);
  if (typeof value === "object") return jsonToCompactExportString(value);
  const s = String(value).trim();
  return s === "--" || s === "—" ? "" : s;
}

function formatExportDateTime(value) {
  if (value == null || value === "") return "";
  const formatted = formatDateTime(value);
  return formatted === "--" ? "" : formatted;
}

function formatExportBoolean(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

function jsonToCompactExportString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeCsvValue(value) {
  const s = normalizeExportValue(value);
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function buildDelimitedFile(rows, columns, delimiter = ",") {
  const lines = [columns.map((col) => escapeCsvValue(col.header)).join(delimiter)];
  rows.forEach((row) => {
    lines.push(
      columns
        .map((col) => {
          try {
            return escapeCsvValue(col.pick(row));
          } catch {
            return "";
          }
        })
        .join(delimiter),
    );
  });
  return lines.join("\n");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob(["\uFEFF", content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const REVIEW_QUEUE_EXPORT_COLUMNS = [
  { header: "Request ID", pick: (r) => r.request_id },
  {
    header: "Status",
    pick: (r) => pickExportField(r, ["request_status", "status"]),
  },
  { header: "Subject", pick: (r) => r.subject_type },
  { header: "Route", pick: (r) => pickExportRouteLabel(r) },
  { header: "Request Scope", pick: (r) => r.request_scope },
  { header: "Request Type", pick: (r) => r.request_type },
  { header: "Entity", pick: (r) => r.entity_label },
  { header: "Family", pick: (r) => r.family_label },
  { header: "Product ID", pick: (r) => r.product_id },
  { header: "Product Name", pick: (r) => r.product_name },
  { header: "Stock Item ID", pick: (r) => r.stock_item_id },
  { header: "Stock Item Name", pick: (r) => r.stock_item_name },
  { header: "Test ID", pick: (r) => r.test_id },
  { header: "Test Name", pick: (r) => r.test_name },
  { header: "Current Display", pick: (r) => r.current_display_text },
  { header: "Proposed Display", pick: (r) => r.proposed_display_text },
  {
    header: "Current Spec Type",
    pick: (r) =>
      pickExportField(r, [
        "current_spec_type",
        "current_reference_spec_type",
        "existing_spec_type",
      ]),
  },
  {
    header: "Proposed Spec Type",
    pick: (r) =>
      pickExportField(r, ["proposed_spec_type", "spec_type", "requested_spec_type"]),
  },
  {
    header: "Current Method",
    pick: (r) =>
      pickExportField(r, ["current_method_name", "current_reference_method_name"]),
  },
  {
    header: "Proposed Method",
    pick: (r) =>
      pickExportField(r, ["proposed_method_name", "proposed_reference_method_name"]),
  },
  {
    header: "Current UOM",
    pick: (r) => pickExportField(r, ["current_uom_symbol", "current_uom_code"]),
  },
  {
    header: "Proposed UOM",
    pick: (r) => pickExportField(r, ["proposed_uom_symbol", "proposed_uom_code"]),
  },
  { header: "Reference Source", pick: (r) => formatReferenceSourceSummary(r) },
  {
    header: "Current Reference Source",
    pick: (r) => getRowCurrentReferenceSource(r),
  },
  {
    header: "Proposed Reference Source",
    pick: (r) => getRowProposedReferenceSource(r),
  },
  { header: "Source Analysis ID", pick: (r) => r.source_analysis_id },
  {
    header: "Source Analysis Register No",
    pick: (r) => pickExportField(r, ["source_analysis_register_no", "analysis_register_no"]),
  },
  { header: "Source Analysis Result ID", pick: (r) => r.source_analysis_result_id },
  { header: "Requested By", pick: (r) => r.requested_by_name },
  { header: "Requested At", pick: (r) => formatExportDateTime(r.requested_at) },
  { header: "Request Remarks", pick: (r) => r.request_remarks },
  { header: "Age Hours", pick: (r) => r.age_hours },
  { header: "Age Bucket", pick: (r) => r.age_bucket },
  { header: "Search Text", pick: (r) => r.search_text },
];

const APPLIED_OVERRIDE_EXPORT_COLUMNS = [
  { header: "Override ID", pick: (r) => r.override_id },
  { header: "Subject", pick: (r) => r.subject_type },
  { header: "Level", pick: (r) => r.override_level_label },
  { header: "Scope", pick: (r) => pickExportField(r, ["override_scope", "scope"]) },
  { header: "Entity", pick: (r) => r.entity_label },
  { header: "Family", pick: (r) => r.family_label },
  { header: "Product ID", pick: (r) => r.product_id },
  { header: "Stock Item ID", pick: (r) => r.stock_item_id },
  { header: "Test ID", pick: (r) => r.test_id },
  { header: "Test Name", pick: (r) => r.test_name },
  { header: "Action Type", pick: (r) => pickExportField(r, ["action_type", "override_action_type"]) },
  { header: "Spec Type", pick: (r) => pickExportField(r, ["override_spec_type", "spec_type"]) },
  { header: "Override Display", pick: (r) => formatAppliedOverrideDisplay(r) },
  { header: "Min Value", pick: (r) => pickExportField(r, ["override_min_value", "min_value"]) },
  { header: "Max Value", pick: (r) => pickExportField(r, ["override_max_value", "max_value"]) },
  { header: "Text Value", pick: (r) => pickExportField(r, ["override_text_value", "text_value"]) },
  {
    header: "Target Value",
    pick: (r) => pickExportField(r, ["override_target_value", "target_value"]),
  },
  {
    header: "Tolerance Value",
    pick: (r) => pickExportField(r, ["override_tolerance_value", "tolerance_value"]),
  },
  {
    header: "Tolerance UOM",
    pick: (r) => pickExportField(r, ["override_tolerance_uom", "tolerance_uom"]),
  },
  {
    header: "UOM",
    pick: (r) => pickExportField(r, ["uom_symbol", "uom_code", "uom_name"]),
  },
  {
    header: "Method",
    pick: (r) => pickExportField(r, ["override_method_name", "method_name"]),
  },
  { header: "Required", pick: (r) => formatExportBoolean(r.is_required) },
  { header: "Active", pick: (r) => formatExportBoolean(r.is_active) },
  { header: "Override Status", pick: (r) => pickExportField(r, ["override_status", "status"]) },
  { header: "Reason", pick: (r) => pickExportField(r, ["reason", "override_reason"]) },
  { header: "Source Request ID", pick: (r) => r.source_request_id },
  { header: "Source Request Status", pick: (r) => r.source_request_status },
  { header: "Source Request Scope", pick: (r) => r.source_request_scope },
  { header: "Source Request Type", pick: (r) => r.source_request_type },
  { header: "Source Analysis ID", pick: (r) => r.source_analysis_id },
  { header: "Source Analysis Register No", pick: (r) => r.source_analysis_register_no },
  { header: "Requested By", pick: (r) => r.requested_by_name },
  { header: "Requested At", pick: (r) => formatExportDateTime(r.requested_at) },
  { header: "Reviewed By", pick: (r) => r.reviewed_by_name },
  { header: "Reviewed At", pick: (r) => formatExportDateTime(r.reviewed_at) },
  { header: "Request Remarks", pick: (r) => r.request_remarks },
  { header: "Review Remarks", pick: (r) => r.review_remarks },
  { header: "Last Audit Action", pick: (r) => r.last_audit_action },
  { header: "Last Audit At", pick: (r) => formatExportDateTime(r.last_audit_at) },
  { header: "Last Audit Remarks", pick: (r) => r.last_audit_remarks },
  { header: "Supersedes Override ID", pick: (r) => r.supersedes_override_id },
  { header: "Superseded By Override ID", pick: (r) => r.superseded_by_override_id },
  { header: "Supersedes Label", pick: (r) => r.supersedes_override_label },
  { header: "Superseded By Label", pick: (r) => r.superseded_by_override_label },
  { header: "Search Text", pick: (r) => r.search_text },
];

const CHANGE_HISTORY_EXPORT_COLUMNS = [
  { header: "History ID", pick: (r) => r.history_id },
  { header: "History Type", pick: (r) => r.history_type },
  {
    header: "History Action",
    pick: (r) => pickExportField(r, ["history_action", "audit_action"]),
  },
  {
    header: "History Status",
    pick: (r) => pickExportField(r, ["history_status", "request_status"]),
  },
  {
    header: "Event At",
    pick: (r) => formatExportDateTime(getChangeHistoryEventAt(r)),
  },
  { header: "Request ID", pick: (r) => r.request_id },
  { header: "Audit ID", pick: (r) => r.audit_id },
  { header: "Override ID", pick: (r) => pickExportField(r, ["override_id", "applied_override_id"]) },
  { header: "Subject", pick: (r) => r.subject_type },
  { header: "Entity", pick: (r) => r.entity_label },
  { header: "Family", pick: (r) => r.family_label },
  { header: "Product ID", pick: (r) => r.product_id },
  { header: "Product Name", pick: (r) => r.product_name },
  { header: "Stock Item ID", pick: (r) => r.stock_item_id },
  { header: "Stock Item Name", pick: (r) => r.stock_item_name },
  { header: "Product Group ID", pick: (r) => r.product_group_id },
  { header: "Product Group Name", pick: (r) => r.product_group_name },
  { header: "Test ID", pick: (r) => r.test_id },
  { header: "Test Name", pick: (r) => r.test_name },
  {
    header: "Route Label",
    pick: (r) =>
      pickExportField(r, ["route_label", "review_route_label"]) ||
      getChangeHistoryOverrideRouteLabel(r),
  },
  { header: "Request Scope", pick: (r) => r.request_scope },
  { header: "Request Type", pick: (r) => r.request_type },
  { header: "Applied Target Type", pick: (r) => r.applied_target_type },
  { header: "Applied Target Label", pick: (r) => r.applied_target_label },
  { header: "Current Display", pick: (r) => r.current_display_text },
  { header: "Proposed Display", pick: (r) => r.proposed_display_text },
  {
    header: "Current Spec Type",
    pick: (r) =>
      pickExportField(r, ["current_spec_type", "current_reference_spec_type"]),
  },
  {
    header: "Proposed Spec Type",
    pick: (r) => pickExportField(r, ["proposed_spec_type", "spec_type"]),
  },
  {
    header: "Current Method",
    pick: (r) => pickExportField(r, ["current_method_name", "current_reference_method_name"]),
  },
  {
    header: "Proposed Method",
    pick: (r) => pickExportField(r, ["proposed_method_name", "proposed_reference_method_name"]),
  },
  {
    header: "Current UOM",
    pick: (r) => pickExportField(r, ["current_uom_symbol", "current_uom_code"]),
  },
  {
    header: "Proposed UOM",
    pick: (r) => pickExportField(r, ["proposed_uom_symbol", "proposed_uom_code"]),
  },
  { header: "Requested By", pick: (r) => r.requested_by_name },
  { header: "Requested At", pick: (r) => formatExportDateTime(r.requested_at) },
  { header: "Request Remarks", pick: (r) => r.request_remarks },
  { header: "Reviewed By", pick: (r) => r.reviewed_by_name },
  { header: "Reviewed At", pick: (r) => formatExportDateTime(r.reviewed_at) },
  { header: "Review Remarks", pick: (r) => r.review_remarks },
  { header: "Source Analysis ID", pick: (r) => r.source_analysis_id },
  {
    header: "Source Analysis Register No",
    pick: (r) => pickExportField(r, ["source_analysis_register_no", "analysis_register_no"]),
  },
  { header: "Source Analysis Result ID", pick: (r) => r.source_analysis_result_id },
  { header: "Applied Override ID", pick: (r) => r.applied_override_id },
  {
    header: "Applied Override Active",
    pick: (r) => formatExportBoolean(r.applied_override_is_active),
  },
  { header: "Applied Override Display", pick: (r) => r.applied_override_display_text },
  { header: "Applied Spec Profile ID", pick: (r) => r.applied_spec_profile_id },
  { header: "Applied Spec Profile Name", pick: (r) => r.applied_spec_profile_name },
  {
    header: "Applied Spec Profile Version",
    pick: (r) => pickExportField(r, ["applied_spec_profile_version", "version_no"]),
  },
  { header: "Reference Source", pick: (r) => formatReferenceSourceSummary(r) },
  {
    header: "Current Reference Source",
    pick: (r) => getRowCurrentReferenceSource(r),
  },
  {
    header: "Proposed Reference Source",
    pick: (r) => getRowProposedReferenceSource(r),
  },
  { header: "Review Decision", pick: (r) => r.review_decision },
  { header: "Review Apply Scope", pick: (r) => r.review_apply_scope },
  { header: "Review Applied Target Type", pick: (r) => r.review_applied_target_type },
  { header: "Review Applied Route Label", pick: (r) => r.review_applied_route_label },
  {
    header: "Route Changed",
    pick: (r) => formatExportBoolean(isRouteWasChanged(r)),
  },
  {
    header: "Route Changed From",
    pick: (r) =>
      formatApplyScopeLabel(r.route_changed_from_scope ?? r.request_scope, r.subject_type),
  },
  {
    header: "Route Changed To",
    pick: (r) =>
      formatApplyScopeLabel(
        r.route_changed_to_scope ?? r.review_apply_scope,
        r.subject_type,
      ),
  },
  { header: "Route Changed By", pick: (r) => r.route_changed_by_name },
  {
    header: "Route Changed At",
    pick: (r) => formatExportDateTime(r.route_changed_at),
  },
  { header: "Route Change Remarks", pick: (r) => r.route_change_remarks },
  {
    header: "Audit Action",
    pick: (r) => pickExportField(r, ["audit_action", "history_action"]),
  },
  { header: "Old Is Active", pick: (r) => formatExportBoolean(r.old_is_active) },
  { header: "New Is Active", pick: (r) => formatExportBoolean(r.new_is_active) },
  { header: "Performed By User ID", pick: (r) => r.performed_by_user_id },
  {
    header: "Performed At",
    pick: (r) => formatExportDateTime(r.performed_at ?? r.event_at),
  },
  { header: "Audit Remarks", pick: (r) => r.audit_remarks },
  { header: "Source Context", pick: (r) => r.source_context },
  { header: "Override Scope", pick: (r) => r.override_scope },
  {
    header: "Override Level",
    pick: (r) => pickExportField(r, ["override_level_label", "override_level"]),
  },
  { header: "Override Status", pick: (r) => r.override_status },
  {
    header: "Override Action Type",
    pick: (r) => pickExportField(r, ["override_action_type", "action_type"]),
  },
  { header: "Override Method", pick: (r) => r.override_method_name },
  { header: "Override Spec Type", pick: (r) => r.override_spec_type },
  { header: "Override Min Value", pick: (r) => r.override_min_value },
  { header: "Override Max Value", pick: (r) => r.override_max_value },
  { header: "Override Text Value", pick: (r) => r.override_text_value },
  { header: "Override Target Value", pick: (r) => r.override_target_value },
  { header: "Override Tolerance Value", pick: (r) => r.override_tolerance_value },
  { header: "Override Tolerance UOM", pick: (r) => r.override_tolerance_uom },
  { header: "Override Display", pick: (r) => r.override_display_text },
  { header: "Override Reason", pick: (r) => pickExportField(r, ["reason", "override_reason"]) },
  { header: "Supersedes Override ID", pick: (r) => r.supersedes_override_id },
  { header: "Superseded By Override ID", pick: (r) => r.superseded_by_override_id },
  { header: "Supersedes Label", pick: (r) => r.supersedes_override_label },
  { header: "Superseded By Label", pick: (r) => r.superseded_by_override_label },
  { header: "Supersede Role", pick: (r) => r.supersede_role },
  { header: "Predecessor Override ID", pick: (r) => r.predecessor_override_id },
  { header: "Successor Override ID", pick: (r) => r.successor_override_id },
  { header: "Predecessor Display", pick: (r) => r.predecessor_display_text },
  { header: "Successor Display", pick: (r) => r.successor_display_text },
  { header: "Summary", pick: (r) => getLifecycleHistorySummaryText(r) },
  { header: "Outcome", pick: (r) => getLifecycleHistoryOutcomeText(r) },
  { header: "Search Text", pick: (r) => r.search_text },
];

function exportReviewQueueCsv() {
  const rows = getFilteredReviewQueueRows();
  if (!rows.length) {
    toast("No rows to export.", "warn");
    return;
  }
  const content = buildDelimitedFile(rows, REVIEW_QUEUE_EXPORT_COLUMNS, ",");
  downloadTextFile(
    `spec-review-queue-${formatExportDateForFilename()}.csv`,
    content,
    "text/csv;charset=utf-8",
  );
  toast(
    `Exported ${rows.length} row${rows.length !== 1 ? "s" : ""}.`,
    "success",
    2200,
  );
}

function exportAppliedOverridesCsv() {
  const rows = getFilteredOverrideRegisterRows();
  if (!rows.length) {
    toast("No rows to export.", "warn");
    return;
  }
  const content = buildDelimitedFile(rows, APPLIED_OVERRIDE_EXPORT_COLUMNS, ",");
  downloadTextFile(
    `spec-applied-overrides-${formatExportDateForFilename()}.csv`,
    content,
    "text/csv;charset=utf-8",
  );
  toast(
    `Exported ${rows.length} row${rows.length !== 1 ? "s" : ""}.`,
    "success",
    2200,
  );
}

function exportChangeHistoryCsv() {
  const rows = getFilteredChangeHistoryRows();
  if (!rows.length) {
    toast("No rows to export.", "warn");
    return;
  }
  const content = buildDelimitedFile(rows, CHANGE_HISTORY_EXPORT_COLUMNS, ",");
  downloadTextFile(
    `spec-change-history-${formatExportDateForFilename()}.csv`,
    content,
    "text/csv;charset=utf-8",
  );
  toast(
    `Exported ${rows.length} row${rows.length !== 1 ? "s" : ""}.`,
    "success",
    2200,
  );
}

function pickLifecycleRowValue(row, keys, fallback = "—") {
  for (const key of keys) {
    const v = row?.[key];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return fallback;
}

function renderLifecycleHistoryKv(label, value, { html = false } = {}) {
  const empty = value == null || value === "";
  const valueHtml = empty
    ? "—"
    : html
      ? String(value)
      : esc(String(value));
  return `<div class="lifecycle-history-kv">
    <div class="lifecycle-history-kv-label">${esc(label)}</div>
    <div class="lifecycle-history-kv-value">${valueHtml}</div>
  </div>`;
}

function renderLifecycleHistoryComparisonSection(row) {
  const currentDisplay = pickLifecycleRowValue(row, ["current_display_text"]);
  const currentType = pickLifecycleRowValue(row, [
    "current_spec_type",
    "current_reference_spec_type",
    "existing_spec_type",
  ]);
  const currentMethod = pickLifecycleRowValue(row, [
    "current_method_name",
    "current_reference_method_name",
  ]);
  const currentUom = pickLifecycleRowValue(row, [
    "current_uom_symbol",
    "current_uom_code",
  ]);
  const proposedDisplay = pickLifecycleRowValue(row, ["proposed_display_text"]);
  const proposedType = pickLifecycleRowValue(row, [
    "proposed_spec_type",
    "spec_type",
    "requested_spec_type",
  ]);
  const proposedMethod = pickLifecycleRowValue(row, [
    "proposed_method_name",
    "proposed_reference_method_name",
  ]);
  const proposedUom = pickLifecycleRowValue(row, [
    "proposed_uom_symbol",
    "proposed_uom_code",
  ]);

  return `<section class="lifecycle-history-section spec-request-panel">
    <div class="lifecycle-history-section-title">Current vs Proposed</div>
    <div class="spec-request-detail-grid">
      <div class="spec-request-card spec-request-card-current">
        <div class="spec-request-card-title">
          <span class="spec-request-card-role spec-request-card-role-current">Current</span>
          Existing / Current
        </div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(currentType)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Display</div><div class="spec-request-kv-value">${esc(currentDisplay)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Method</div><div class="spec-request-kv-value">${esc(currentMethod)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Unit</div><div class="spec-request-kv-value">${esc(currentUom)}</div></div>
        </div>
      </div>
      <div class="spec-request-card spec-request-card-proposed">
        <div class="spec-request-card-title">
          <span class="spec-request-card-role spec-request-card-role-proposed">Proposed</span>
          Requested Change
        </div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(proposedType)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Display</div><div class="spec-request-kv-value">${esc(proposedDisplay)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Method</div><div class="spec-request-kv-value">${esc(proposedMethod)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Unit</div><div class="spec-request-kv-value">${esc(proposedUom)}</div></div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderLifecycleHistoryRequestDetail(row) {
  const eventAt = getChangeHistoryEventAt(row);
  const statusLabel = String(
    row.history_status ?? row.request_status ?? "—",
  );

  let html = `<section class="lifecycle-history-section">
    <div class="lifecycle-history-section-title">Event Summary</div>
    <div class="lifecycle-history-detail-grid">
      ${renderLifecycleHistoryKv("History ID", row.history_id)}
      ${renderLifecycleHistoryKv("Request ID", row.request_id ? `#${row.request_id}` : "—")}
      ${renderLifecycleHistoryKv("Status", statusLabel)}
      ${renderLifecycleHistoryKv("Event Date", eventAt ? formatDateTime(eventAt) : "—")}
      ${renderLifecycleHistoryKv("Subject", row.subject_type)}
      ${renderLifecycleHistoryKv("Entity", row.entity_label)}
      ${renderLifecycleHistoryKv("Family", row.family_label)}
      ${renderLifecycleHistoryKv("Test", row.test_name)}
    </div>
    <div class="lifecycle-history-kv" style="margin-top:8px">
      <div class="lifecycle-history-kv-label">Route</div>
      <div class="lifecycle-history-kv-value">${renderChangeHistoryRouteCell(row)}</div>
    </div>
  </section>`;

  html += renderLifecycleHistoryComparisonSection(row);

  if (hasAnyReferenceSource(row)) {
    html += buildReferenceSourceDetailSectionHtml(row);
  }

  const requestRemarks = pickLifecycleRowValue(row, ["request_remarks"], "");
  const reviewRemarks = pickLifecycleRowValue(row, ["review_remarks"], "");

  html += `<section class="lifecycle-history-section spec-request-panel-muted spec-request-panel">
    <div class="lifecycle-history-section-title">Request / Review</div>
    <div class="lifecycle-history-detail-grid">
      <div class="lifecycle-history-kv">
        <div class="lifecycle-history-kv-label">Requested</div>
        <div class="lifecycle-history-kv-value">${renderChangeHistoryRequestedCell(row)}</div>
      </div>
      <div class="lifecycle-history-kv">
        <div class="lifecycle-history-kv-label">Reviewed</div>
        <div class="lifecycle-history-kv-value">${renderChangeHistoryReviewedCell(row)}</div>
      </div>
    </div>
    ${requestRemarks && requestRemarks !== "—" ? `<div class="lifecycle-history-kv" style="margin-top:8px"><div class="lifecycle-history-kv-label">Request Remarks</div><div class="lifecycle-history-kv-value">${esc(requestRemarks)}</div></div>` : ""}
    ${reviewRemarks && reviewRemarks !== "—" ? `<div class="lifecycle-history-kv" style="margin-top:8px"><div class="lifecycle-history-kv-label">Review Remarks</div><div class="lifecycle-history-kv-value">${esc(reviewRemarks)}</div></div>` : ""}
  </section>`;

  html += `<section class="lifecycle-history-section spec-request-panel">
    <div class="lifecycle-history-section-title">Applied Outcome</div>
    <div class="lifecycle-history-kv-value">${renderChangeHistoryAppliedTarget(row)}</div>
    ${renderLifecycleHistoryKv("Applied Target Type", formatAppliedTargetTypeLabel(row.applied_target_type))}
  </section>`;

  return html;
}

function formatLifecycleActiveState(value) {
  if (value === true) return "Active";
  if (value === false) return "Inactive";
  return "—";
}

function renderLifecycleHistoryOverrideDetail(row) {
  const eventAt = getChangeHistoryEventAt(row);
  const action = getChangeHistoryLifecycleAction(row);
  const actionLabel = formatChangeHistoryLifecycleActionLabel(action);

  let html = `<section class="lifecycle-history-section">
    <div class="lifecycle-history-section-title">Event Summary</div>
    <div class="lifecycle-history-detail-grid">
      ${renderLifecycleHistoryKv("History ID", row.history_id)}
      ${renderLifecycleHistoryKv("Audit ID", row.audit_id)}
      ${renderLifecycleHistoryKv("Override ID", row.override_id != null ? `#${row.override_id}` : "—")}
      ${renderLifecycleHistoryKv("Action", actionLabel)}
      ${renderLifecycleHistoryKv("Event Date", eventAt ? formatDateTime(eventAt) : "—")}
      ${renderLifecycleHistoryKv("Subject", row.subject_type)}
      ${renderLifecycleHistoryKv("Entity", row.entity_label)}
      ${renderLifecycleHistoryKv("Family", row.family_label)}
      ${renderLifecycleHistoryKv("Test", row.test_name)}
      ${renderLifecycleHistoryKv("Route / Level", getChangeHistoryOverrideRouteLabel(row))}
    </div>
  </section>`;

  const oldState = formatLifecycleActiveState(row.old_is_active);
  const newState = formatLifecycleActiveState(row.new_is_active);
  const auditRemarks = pickLifecycleRowValue(row, ["audit_remarks"], "");
  const sourceContext = pickLifecycleRowValue(row, ["source_context"], "");

  html += `<section class="lifecycle-history-section spec-request-panel">
    <div class="lifecycle-history-section-title">Lifecycle State</div>
    <div class="lifecycle-history-detail-grid">
      ${renderLifecycleHistoryKv("Previous State", oldState)}
      ${renderLifecycleHistoryKv("New State", newState)}
      ${renderLifecycleHistoryKv("State Change", oldState !== "—" || newState !== "—" ? `${oldState} → ${newState}` : "—")}
    </div>
    ${auditRemarks && auditRemarks !== "—" ? `<div class="lifecycle-history-kv" style="margin-top:8px"><div class="lifecycle-history-kv-label">Audit Remarks</div><div class="lifecycle-history-kv-value">${esc(auditRemarks)}</div></div>` : ""}
    ${sourceContext && sourceContext !== "—" ? `<div class="lifecycle-history-kv" style="margin-top:8px"><div class="lifecycle-history-kv-label">Source Context</div><div class="lifecycle-history-kv-value">${esc(sourceContext)}</div></div>` : ""}
  </section>`;

  const overrideDisplay = pickLifecycleRowValue(row, [
    "override_display_text",
    "current_display_text",
  ]);
  const overrideAction = pickLifecycleRowValue(row, [
    "override_action_type",
    "action_type",
  ]);
  const overrideSpecType = pickLifecycleRowValue(row, ["override_spec_type"]);
  const overrideMethod = pickLifecycleRowValue(row, ["override_method_name"]);
  const overrideReason = pickLifecycleRowValue(row, ["reason", "override_reason"]);

  html += `<section class="lifecycle-history-section spec-request-panel-muted spec-request-panel">
    <div class="lifecycle-history-section-title">Override Snapshot</div>
    <div class="lifecycle-history-detail-grid">
      ${renderLifecycleHistoryKv("Action Type", overrideAction)}
      ${renderLifecycleHistoryKv("Spec Type", overrideSpecType)}
      ${renderLifecycleHistoryKv("Method", overrideMethod)}
      ${renderLifecycleHistoryKv("Display", overrideDisplay)}
      ${renderLifecycleHistoryKv("Min Value", row.override_min_value ?? row.min_value)}
      ${renderLifecycleHistoryKv("Max Value", row.override_max_value ?? row.max_value)}
      ${renderLifecycleHistoryKv("Text Value", row.override_text_value ?? row.text_value)}
      ${renderLifecycleHistoryKv("Target Value", row.override_target_value ?? row.target_value)}
      ${renderLifecycleHistoryKv("Tolerance", row.override_tolerance_value ?? row.tolerance_value)}
      ${renderLifecycleHistoryKv("Reason", overrideReason)}
    </div>
  </section>`;

  if (action === "SUPERSEDE") {
    html += `<section class="lifecycle-history-section spec-request-panel">
      <div class="lifecycle-history-section-title">Supersede Details</div>
      <div class="lifecycle-history-detail-grid">
        ${renderLifecycleHistoryKv("Supersede Role", row.supersede_role)}
        ${renderLifecycleHistoryKv("Predecessor Override ID", row.predecessor_override_id)}
        ${renderLifecycleHistoryKv("Successor Override ID", row.successor_override_id)}
        ${renderLifecycleHistoryKv("Predecessor Display", row.predecessor_display_text)}
        ${renderLifecycleHistoryKv("Successor Display", row.successor_display_text)}
        ${renderLifecycleHistoryKv("Supersedes Label", row.supersedes_override_label)}
        ${renderLifecycleHistoryKv("Superseded By Label", row.superseded_by_override_label)}
      </div>
    </section>`;
  }

  html += `<section class="lifecycle-history-section spec-request-panel-muted spec-request-panel">
    <div class="lifecycle-history-section-title">Source Request Context</div>
    <div class="lifecycle-history-detail-grid">
      ${renderLifecycleHistoryKv("Source Request ID", row.source_request_id ? `#${row.source_request_id}` : row.request_id ? `#${row.request_id}` : "—")}
      <div class="lifecycle-history-kv">
        <div class="lifecycle-history-kv-label">Source Analysis Register No</div>
        <div class="lifecycle-history-kv-value">${renderChangeHistorySourceAnalysis(row)}</div>
      </div>
      ${renderLifecycleHistoryKv("Requested By", row.requested_by_name)}
      ${renderLifecycleHistoryKv("Reviewed By", row.reviewed_by_name)}
    </div>
  </section>`;

  return html;
}

function renderLifecycleHistoryModalDetail(row) {
  if (!row) return "";
  if (isChangeHistoryRequestRow(row)) {
    return renderLifecycleHistoryRequestDetail(row);
  }
  return renderLifecycleHistoryOverrideDetail(row);
}

function clearLifecycleHistoryRowActiveState() {
  chHistoryTableBody
    ?.querySelectorAll(".spec-history-row-active")
    .forEach((row) => row.classList.remove("spec-history-row-active"));
}

function setLifecycleHistoryRowActive(historyId) {
  if (!chHistoryTableBody || historyId == null || historyId === "") return;
  clearLifecycleHistoryRowActiveState();
  const row = chHistoryTableBody.querySelector(
    `tr.spec-history-row-clickable[data-history-id="${CSS.escape(String(historyId))}"]`,
  );
  row?.classList.add("spec-history-row-active");
}

function isHigherPriorityModalOpenForLifecycleHistory() {
  if (
    specOverrideSupersedeConfirmModal &&
    !specOverrideSupersedeConfirmModal.classList.contains("hidden")
  ) {
    return true;
  }
  if (
    specOverrideSupersedeModal &&
    !specOverrideSupersedeModal.classList.contains("hidden")
  ) {
    return true;
  }
  if (
    specOverrideDeactivateConfirmModal &&
    !specOverrideDeactivateConfirmModal.classList.contains("hidden")
  ) {
    return true;
  }
  if (
    specOverrideRegisterModal &&
    !specOverrideRegisterModal.classList.contains("hidden")
  ) {
    return true;
  }
  if (
    specRequestReviewModal &&
    !specRequestReviewModal.classList.contains("hidden")
  ) {
    return true;
  }
  return false;
}

function closeLifecycleHistoryModal() {
  specLifecycleHistoryModal?.classList.add("hidden");
  selectedLifecycleHistoryRow = null;
  clearLifecycleHistoryRowActiveState();
}

function openLifecycleHistoryModal(historyId) {
  if (chFilterDrawerOpen) return;

  if (
    selectedLifecycleHistoryRow &&
    String(selectedLifecycleHistoryRow.history_id) === String(historyId) &&
    specLifecycleHistoryModal &&
    !specLifecycleHistoryModal.classList.contains("hidden")
  ) {
    return;
  }

  const row = changeHistoryRows.find(
    (r) => String(r.history_id) === String(historyId),
  );
  if (!row) {
    toast("Lifecycle event not found.", "warn");
    return;
  }

  selectedLifecycleHistoryRow = row;

  if (specLifecycleHistoryTitle) {
    specLifecycleHistoryTitle.textContent = "Lifecycle Event Details";
  }

  if (specLifecycleHistoryContext) {
    const type = String(row.history_type ?? "REQUEST");
    const actionOrStatus = isChangeHistoryOverrideRow(row)
      ? formatChangeHistoryLifecycleActionLabel(
          getChangeHistoryLifecycleAction(row),
        )
      : String(row.history_status ?? row.request_status ?? "—");
    const entity = String(row.entity_label ?? "—");
    const test = String(row.test_name ?? "—");
    specLifecycleHistoryContext.textContent = `${type} · ${actionOrStatus} · ${entity} · ${test}`;
  }

  if (specLifecycleHistoryDetail) {
    specLifecycleHistoryDetail.innerHTML =
      renderLifecycleHistoryModalDetail(row);
  }

  setLifecycleHistoryRowActive(historyId);
  specLifecycleHistoryModal?.classList.remove("hidden");
}

function renderChangeHistory() {
  const rows = getFilteredChangeHistoryRows();

  if (chLineCount) {
    chLineCount.textContent = `${rows.length} event${rows.length !== 1 ? "s" : ""}`;
  }

  if (!chHistoryTableBody) return;

  if (!rows.length) {
    chHistoryTableBody.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No matching lifecycle events</strong>
        There are no specification lifecycle events matching the current filters.
      </div>
    </td></tr>`;
    return;
  }

  chHistoryTableBody.innerHTML = rows
    .map((r) => {
      const historyId = String(r.history_id ?? "");
      const testName = String(r.test_name ?? "event");
      const eventAt = getChangeHistoryEventAt(r);
      const dateLabel = eventAt ? formatDateTime(eventAt) : "—";

      return `<tr class="spec-history-row-clickable" data-history-id="${esc(historyId)}" tabindex="0" role="button" aria-label="View lifecycle event ${esc(historyId)}, ${esc(testName)}">
        <td>${esc(dateLabel)}</td>
        <td>${renderChangeHistoryStatusBadge(r)}</td>
        <td>${renderChangeHistoryRouteCompact(r)}</td>
        <td>${esc(String(r.subject_type ?? ""))}</td>
        <td>${renderWorkflowEntityCell(r)}</td>
        <td>${esc(String(r.test_name ?? "—"))}</td>
        <td>${formatLifecycleHistorySummary(r)}</td>
        <td>${formatLifecycleHistoryOutcome(r)}</td>
      </tr>`;
    })
    .join("");
}

// ── APPLIED OVERRIDES (internal tab id: overrideRegister) ─────────────────────

function wireOverrideRegisterEvents() {
  orFilterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOrFilterDrawer();
  });
  orFilterClose?.addEventListener("click", closeOrFilterDrawer);
  orFilterApply?.addEventListener("click", closeOrFilterDrawer);
  orFilterClear?.addEventListener("click", clearAppliedOverrideFilters);
  orExportBtn?.addEventListener("click", exportAppliedOverridesCsv);

  orSubjectFilter?.addEventListener("change", () => {
    renderOverrideRegister();
    updateOrFilterBadge();
  });
  orLevelFilter?.addEventListener("change", () => {
    renderOverrideRegister();
    updateOrFilterBadge();
  });
  orRouteFilter?.addEventListener("change", () => {
    renderOverrideRegister();
    updateOrFilterBadge();
  });
  orActionFilter?.addEventListener("change", () => {
    renderOverrideRegister();
    updateOrFilterBadge();
  });
  orSearchInput?.addEventListener("input", () => {
    renderOverrideRegister();
    updateOrFilterBadge();
  });

  orFilterDrawer?.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (!orFilterDrawerOpen || !orFilterDrawer || !orFilterBtn) return;
    if (rqFilterDrawerOpen) return;
    if (chFilterDrawerOpen) return;
    if (isSpecFilterDrawerClickInside(orFilterBtn, orFilterDrawer, e.target)) {
      return;
    }
    closeOrFilterDrawer();
  });

  specOverrideRegisterClose?.addEventListener("click", () => {
    if (
      overrideDeactivateConfirmOpen ||
      overrideSupersedeFormOpen ||
      overrideSupersedeConfirmOpen
    ) {
      return;
    }
    closeOverrideRegisterModal();
  });
  specOverrideRegisterCancel?.addEventListener("click", () => {
    if (
      overrideDeactivateConfirmOpen ||
      overrideSupersedeFormOpen ||
      overrideSupersedeConfirmOpen
    ) {
      return;
    }
    closeOverrideRegisterModal();
  });
  specOverrideRegisterModal?.addEventListener("click", (e) => {
    if (
      overrideDeactivateConfirmOpen ||
      overrideSupersedeFormOpen ||
      overrideSupersedeConfirmOpen
    ) {
      return;
    }
    if (e.target === specOverrideRegisterModal) closeOverrideRegisterModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (
      specOverrideSupersedeConfirmModal &&
      !specOverrideSupersedeConfirmModal.classList.contains("hidden")
    ) {
      e.preventDefault();
      closeSupersedeConfirmModal();
      return;
    }
    if (
      specOverrideSupersedeModal &&
      !specOverrideSupersedeModal.classList.contains("hidden")
    ) {
      e.preventDefault();
      closeSupersedeAppliedOverrideModal();
      return;
    }
    if (
      specOverrideDeactivateConfirmModal &&
      !specOverrideDeactivateConfirmModal.classList.contains("hidden")
    ) {
      e.preventDefault();
      closeOverrideDeactivateConfirmModal();
      return;
    }
    if (
      specOverrideRegisterModal &&
      !specOverrideRegisterModal.classList.contains("hidden")
    ) {
      e.preventDefault();
      closeOverrideRegisterModal();
      return;
    }
    if (rqFilterDrawerOpen) {
      e.preventDefault();
      closeRqFilterDrawer();
      return;
    }
    if (chFilterDrawerOpen) {
      e.preventDefault();
      closeChFilterDrawer();
      return;
    }
    if (orFilterDrawerOpen) {
      e.preventDefault();
      closeOrFilterDrawer();
    }
  });

  specOverrideRegisterConfirmBtn?.addEventListener(
    "click",
    () => void submitAppliedOverrideReview(),
  );
  specOverrideRegisterDeactivateBtn?.addEventListener(
    "click",
    () => void submitAppliedOverrideDeactivation(),
  );
  specOverrideRegisterSupersedeBtn?.addEventListener(
    "click",
    beginAppliedOverrideSupersede,
  );

  specOverrideDeactivateConfirmClose?.addEventListener(
    "click",
    closeOverrideDeactivateConfirmModal,
  );
  specOverrideDeactivateConfirmCancel?.addEventListener(
    "click",
    closeOverrideDeactivateConfirmModal,
  );
  specOverrideDeactivateConfirmBtn?.addEventListener(
    "click",
    () => void confirmAppliedOverrideDeactivation(),
  );
  specOverrideDeactivateConfirmModal?.addEventListener("click", (e) => {
    if (e.target === specOverrideDeactivateConfirmModal) {
      closeOverrideDeactivateConfirmModal();
    }
  });

  specOverrideSupersedeClose?.addEventListener(
    "click",
    closeSupersedeAppliedOverrideModal,
  );
  specOverrideSupersedeCancel?.addEventListener(
    "click",
    closeSupersedeAppliedOverrideModal,
  );
  specOverrideSupersedeReviewBtn?.addEventListener(
    "click",
    submitSupersedeFormForReview,
  );
  specOverrideSupersedeModal?.addEventListener("click", (e) => {
    if (overrideSupersedeConfirmOpen) return;
    if (e.target === specOverrideSupersedeModal) {
      closeSupersedeAppliedOverrideModal();
    }
  });
  specOverrideSupersedeAction?.addEventListener(
    "change",
    updateSupersedeModalDynamics,
  );
  specOverrideSupersedeSpecType?.addEventListener("change", () => {
    renderSupersedeDynamicInputs();
    updateSupersedeDisplayText();
  });
  specOverrideSupersedeUom?.addEventListener(
    "change",
    updateSupersedeDisplayText,
  );

  specOverrideSupersedeConfirmClose?.addEventListener(
    "click",
    closeSupersedeConfirmModal,
  );
  specOverrideSupersedeConfirmCancel?.addEventListener(
    "click",
    closeSupersedeConfirmModal,
  );
  specOverrideSupersedeConfirmBtn?.addEventListener(
    "click",
    () => void confirmAppliedOverrideSupersede(),
  );
  specOverrideSupersedeConfirmModal?.addEventListener("click", (e) => {
    if (e.target === specOverrideSupersedeConfirmModal) {
      closeSupersedeConfirmModal();
    }
  });

  orRegisterTableBody?.addEventListener("click", (e) => {
    if (
      e.target.closest(
        "button, a, input, select, textarea, label, [data-no-row-open]",
      )
    ) {
      return;
    }
    const row = e.target.closest(
      "tr.spec-override-row-clickable[data-override-id]",
    );
    if (!row) return;
    openAppliedOverrideReviewModal(row.dataset.overrideId);
  });

  orRegisterTableBody?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(
      "tr.spec-override-row-clickable[data-override-id]",
    );
    if (!row) return;
    e.preventDefault();
    openAppliedOverrideReviewModal(row.dataset.overrideId);
  });
}

function clearOverrideRegisterRowActiveState() {
  orRegisterTableBody
    ?.querySelectorAll(".spec-override-row-active")
    .forEach((row) => row.classList.remove("spec-override-row-active"));
}

function setOverrideRegisterRowActive(overrideId) {
  if (!orRegisterTableBody || overrideId == null || overrideId === "") return;
  clearOverrideRegisterRowActiveState();
  orRegisterTableBody
    .querySelectorAll("tr.spec-override-row-clickable[data-override-id]")
    .forEach((row) => {
      if (String(row.dataset.overrideId) === String(overrideId)) {
        row.classList.add("spec-override-row-active");
      }
    });
}

function toggleOrFilterDrawer() {
  if (orFilterDrawerOpen) {
    closeOrFilterDrawer();
    return;
  }
  if (rqFilterDrawerOpen) closeRqFilterDrawer();
  if (chFilterDrawerOpen) closeChFilterDrawer();
  orFilterDrawerOpen = true;
  openSpecFilterDrawer(orFilterBtn, orFilterDrawer);
  orFilterBtn?.classList.add("or-filter-btn--active");
  updateOrFilterBadge();
}

function closeOrFilterDrawer() {
  if (!orFilterDrawerOpen && !orFilterDrawer?.classList.contains("open")) {
    return;
  }
  orFilterDrawerOpen = false;
  closeSpecFilterDrawer(orFilterBtn, orFilterDrawer);
  orFilterBtn?.classList.remove("or-filter-btn--active");
  updateOrFilterBadge();
}

function getAppliedOverrideDefaultFilters() {
  return {
    subject: "",
    level: "",
    route: "",
    action: "",
    search: "",
  };
}

function getAppliedOverrideActiveFilterCount() {
  const defaults = getAppliedOverrideDefaultFilters();
  let count = 0;
  if (String(orSubjectFilter?.value ?? "") !== defaults.subject) count += 1;
  if (String(orLevelFilter?.value ?? "") !== defaults.level) count += 1;
  if (String(orRouteFilter?.value ?? "") !== defaults.route) count += 1;
  if (String(orActionFilter?.value ?? "") !== defaults.action) count += 1;
  if (String(orSearchInput?.value ?? "").trim() !== defaults.search) count += 1;
  return count;
}

function updateOrFilterBadge() {
  const count = getAppliedOverrideActiveFilterCount();
  if (!orFilterBadge) return;
  orFilterBadge.textContent = String(count);
  orFilterBadge.classList.toggle("hidden", count <= 0);
  orFilterBtn?.classList.toggle(
    "or-filter-btn--active",
    count > 0 || orFilterDrawerOpen,
  );
}

function clearAppliedOverrideFilters() {
  const defaults = getAppliedOverrideDefaultFilters();
  if (orSubjectFilter) orSubjectFilter.value = defaults.subject;
  if (orLevelFilter) orLevelFilter.value = defaults.level;
  if (orRouteFilter) orRouteFilter.value = defaults.route;
  if (orActionFilter) orActionFilter.value = defaults.action;
  if (orSearchInput) orSearchInput.value = defaults.search;
  renderOverrideRegister();
  updateOrFilterBadge();
}

function populateOrLevelFilterOptions() {
  if (!orLevelFilter) return;
  const current = orLevelFilter.value;
  const levels = [
    ...new Set(
      overrideRegisterRows
        .filter((row) => row.is_active === true)
        .map((row) => String(row.override_level_label ?? "").trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  orLevelFilter.innerHTML =
    `<option value="">All</option>` +
    levels
      .map(
        (level) =>
          `<option value="${esc(level)}"${level === current ? " selected" : ""}>${esc(level)}</option>`,
      )
      .join("");
}

async function loadOverrideRegister() {
  const { data, error } = await labSupabase
    .from("v_spec_override_register")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    toast("Failed to load applied overrides: " + error.message, "error");
    overrideRegisterRows = [];
    renderOverrideRegister();
    return;
  }

  overrideRegisterRows = data ?? [];
  populateOrLevelFilterOptions();
  renderOverrideRegister();
  updateOrFilterBadge();
}

function getFilteredOverrideRegisterRows() {
  const subject = String(orSubjectFilter?.value ?? "").toUpperCase();
  const level = String(orLevelFilter?.value ?? "").trim();
  const route = String(orRouteFilter?.value ?? "").trim();
  const action = String(orActionFilter?.value ?? "").toUpperCase();
  const q = String(orSearchInput?.value ?? "").trim().toLowerCase();

  return overrideRegisterRows.filter((row) => {
    if (row.is_active !== true) return false;

    if (subject && String(row.subject_type ?? "").toUpperCase() !== subject) {
      return false;
    }

    if (level && String(row.override_level_label ?? "").trim() !== level) {
      return false;
    }

    if (route && resolveOverrideRequestRoute(row) !== route) {
      return false;
    }

    if (action && String(row.action_type ?? "").toUpperCase() !== action) {
      return false;
    }

    if (!q) return true;

    const routeLabel = getOverrideRequestRouteMainLabel(
      resolveOverrideRequestRoute(row),
    );

    const haystack = [
      row.search_text,
      row.override_id,
      row.subject_type,
      row.override_level_label,
      routeLabel,
      "Product Override",
      "Item Override",
      "Family / Base Spec",
      "Direct / Manual Override",
      row.entity_label,
      row.family_label,
      row.test_name,
      row.override_display_text,
      row.reason,
      row.override_method_name,
      row.override_status,
      row.source_request_id,
      row.source_analysis_register_no,
      row.source_request_status,
      row.source_request_scope,
      row.source_applied_target_type,
      row.requested_by_name,
      row.reviewed_by_name,
      row.review_remarks,
      row.last_audit_action,
      row.last_audit_remarks,
      row.supersedes_override_label,
      row.superseded_by_override_label,
      row.uom_code,
      row.uom_name,
      row.uom_symbol,
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" | ");

    return haystack.includes(q);
  });
}

function renderOverrideRegisterStatusBadge(row) {
  const isActive = row.is_active === true;
  const statusLabel = row.override_status
    ? String(row.override_status)
    : isActive
      ? "ACTIVE"
      : "INACTIVE";
  const cls = isActive ? "or-status-badge-active" : "or-status-badge-inactive";
  return `<span class="or-status-badge ${cls}">${esc(statusLabel)}</span>`;
}

function formatAppliedTargetTypeLabel(raw) {
  const target = String(raw ?? "").trim().toUpperCase();
  if (target === "BASE_SPEC_VERSION") return "Base Spec Version";
  if (target === "PRODUCT_ITEM_OVERRIDE") return "Product / Item Override";
  if (target === "PENDING_REVIEW") return "Pending Review";
  if (target === "REJECTED_NO_APPLIED_TARGET") return "Rejected";
  return "";
}

function formatSourceRequestStatusLabel(raw) {
  const status = String(raw ?? "").trim();
  if (!status) return "";
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveOverrideRequestRoute(row) {
  const reqId = row.source_request_id;
  if (reqId == null || reqId === "") return "direct_manual";

  const scope = String(row.source_request_scope ?? "").trim().toUpperCase();
  const subject = String(row.subject_type ?? "").trim().toUpperCase();

  if (scope === "FAMILY") return "family_base_spec";
  if (scope === "PRODUCT" && subject === "FG") return "product_override";
  if (scope === "PRODUCT" && (subject === "RM" || subject === "PM")) {
    return "item_override";
  }
  return "unknown";
}

function getOverrideRequestRouteMainLabel(routeKey) {
  switch (routeKey) {
    case "direct_manual":
      return "Direct / Manual Override";
    case "family_base_spec":
      return "Family / Base Spec";
    case "product_override":
      return "Product Override";
    case "item_override":
      return "Item Override";
    default:
      return "—";
  }
}

function renderOverrideRegisterRequestRoute(row) {
  const routeKey = resolveOverrideRequestRoute(row);
  const mainLabel = getOverrideRequestRouteMainLabel(routeKey);

  if (routeKey === "direct_manual") {
    return `<div><strong>${esc(mainLabel)}</strong></div>`;
  }

  const statusLabel = formatSourceRequestStatusLabel(row.source_request_status);
  const statusHtml = statusLabel
    ? `<div class="or-audit-meta">Request ${esc(statusLabel)}</div>`
    : "";
  return `<div>${esc(mainLabel)}</div>${statusHtml}`;
}

const MEANINGLESS_APPLIED_OVERRIDE_UOM = new Set([
  "NONE",
  "NO UNIT",
  "NO UNIT / NOT APPLICABLE",
  "NOT APPLICABLE",
  "NA",
  "N/A",
  "-",
]);

function normalizeAppliedOverrideUomKey(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function isMeaningfulAppliedOverrideUom(uom) {
  const s = String(uom ?? "").trim();
  if (!s) return false;
  return !MEANINGLESS_APPLIED_OVERRIDE_UOM.has(normalizeAppliedOverrideUomKey(s));
}

function stripMeaninglessAppliedOverrideUnit(raw) {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  const suffixRe =
    /\s+(?:NO UNIT\s*\/\s*NOT APPLICABLE|NOT APPLICABLE|NO UNIT|NONE|N\/A|NA)\s*$/i;

  let prev;
  do {
    prev = text;
    text = text.replace(suffixRe, "").trim();
  } while (text !== prev);

  return text;
}

function overrideDisplayContainsUom(display, uom) {
  if (!display || !uom || !isMeaningfulAppliedOverrideUom(uom)) return false;
  return String(display)
    .toLowerCase()
    .includes(String(uom).trim().toLowerCase());
}

function formatAppliedOverrideDisplay(row) {
  const display = stripMeaninglessAppliedOverrideUnit(row.override_display_text);
  if (!display) return "—";

  const uomCandidates = [row.uom_symbol, row.uom_code, row.uom_name].filter(
    isMeaningfulAppliedOverrideUom,
  );

  for (const uom of uomCandidates) {
    if (overrideDisplayContainsUom(display, uom)) {
      return display;
    }
  }

  const uom = uomCandidates[0];
  if (uom && !overrideDisplayContainsUom(display, uom)) {
    return `${display} ${String(uom).trim()}`.trim();
  }

  return display;
}

function renderOverrideRegisterSourceRequest(row) {
  const reqId = row.source_request_id;
  if (reqId == null || reqId === "") {
    return `<div>—</div>`;
  }
  const regNo = row.source_analysis_register_no;
  const regHtml = regNo
    ? `<div class="or-audit-meta">${esc(String(regNo))}</div>`
    : "";
  return `<div><strong>Request #${esc(String(reqId))}</strong></div>${regHtml}`;
}

function renderOverrideRegisterRequestedCell(row) {
  const by = row.requested_by_name ? String(row.requested_by_name) : "—";
  const at = row.requested_at ? formatDateTime(row.requested_at) : "—";
  return `<div>${esc(by)}</div><div class="or-audit-meta">${esc(at)}</div>`;
}

function renderOverrideRegisterReviewedCell(row) {
  const by = row.reviewed_by_name ? String(row.reviewed_by_name) : "—";
  const at = row.reviewed_at ? formatDateTime(row.reviewed_at) : "—";
  const remarks = row.review_remarks ? String(row.review_remarks).trim() : "";
  const remarksHtml = remarks
    ? `<div class="or-audit-meta">${esc(remarks.length > 60 ? `${remarks.slice(0, 60)}…` : remarks)}</div>`
    : "";
  return `<div>${esc(by)}</div><div class="or-audit-meta">${esc(at)}</div>${remarksHtml}`;
}

function renderOverrideRegisterLastAudit(row) {
  const action = row.last_audit_action ? String(row.last_audit_action) : "—";
  const at = formatDateTime(row.last_audit_at);
  const remarks = row.last_audit_remarks
    ? String(row.last_audit_remarks).trim()
    : "";
  const remarksHtml = remarks
    ? `<div class="or-audit-meta">${esc(remarks.length > 80 ? `${remarks.slice(0, 80)}…` : remarks)}</div>`
    : "";
  return `<div>${esc(action)}</div><div class="or-audit-meta">${esc(at)}</div>${remarksHtml}`;
}

function renderOverrideRegisterLastLifecycleCompact(row) {
  const action = row.last_audit_action ? String(row.last_audit_action) : "—";
  const at = row.last_audit_at ? formatDateTime(row.last_audit_at) : "—";
  return `<div>${esc(action)}</div><div class="workflow-compact-cell-meta">${esc(at)}</div>`;
}

function renderOverrideRegister() {
  const rows = getFilteredOverrideRegisterRows();

  if (orLineCount) {
    orLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;
  }

  if (!orRegisterTableBody) return;

  if (!rows.length) {
    orRegisterTableBody.innerHTML = `<tr><td colspan="7">
      <div class="spec-empty-state">
        <strong>No active applied overrides</strong>
        There are no active applied overrides matching the current filters.
      </div>
    </td></tr>`;
    return;
  }

  orRegisterTableBody.innerHTML = rows
    .map((r) => {
      const overrideId = String(r.override_id);
      const testName = String(r.test_name ?? "test");
      const overrideDisplay = formatAppliedOverrideDisplay(r);
      const levelLabel = r.override_level_label
        ? String(r.override_level_label)
        : "—";

      return `<tr class="spec-override-row-clickable" data-override-id="${esc(overrideId)}" tabindex="0" role="button" aria-label="Review applied override #${esc(overrideId)}, ${esc(testName)}">
        <td>${esc(levelLabel)}</td>
        <td>${esc(String(r.subject_type ?? ""))}</td>
        <td>${renderWorkflowEntityCell(r)}</td>
        <td>${esc(String(r.test_name ?? "—"))}</td>
        <td>${esc(overrideDisplay)}</td>
        <td>${renderOverrideRegisterRequestRoute(r)}</td>
        <td>${renderOverrideRegisterLastLifecycleCompact(r)}</td>
      </tr>`;
    })
    .join("");
}

function renderOverrideRegisterModalDetail(row) {
  const overrideDisplay = formatAppliedOverrideDisplay(row);
  const reqBlock = renderOverrideRegisterSourceRequest(row);
  const requestStatusLabel = formatSourceRequestStatusLabel(
    row.source_request_status,
  );
  const appliedTargetLabel = formatAppliedTargetTypeLabel(
    row.source_applied_target_type,
  );
  return `
    <div class="or-register-detail-grid">
      <div class="or-register-kv">
        <div class="or-register-kv-label">Override ID</div>
        <div class="or-register-kv-value">#${esc(String(row.override_id ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Status</div>
        <div class="or-register-kv-value">${renderOverrideRegisterStatusBadge(row)}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Override Level</div>
        <div class="or-register-kv-value">${esc(String(row.override_level_label ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Request Route</div>
        <div class="or-register-kv-value">${renderOverrideRegisterRequestRoute(row)}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Source Request Status</div>
        <div class="or-register-kv-value">${requestStatusLabel ? esc(requestStatusLabel) : "—"}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Applied Target Type</div>
        <div class="or-register-kv-value">${appliedTargetLabel ? esc(appliedTargetLabel) : "—"}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Subject / Product / Item</div>
        <div class="or-register-kv-value">${esc(String(row.subject_type ?? "—"))} · ${esc(String(row.entity_label ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Family / Group Context</div>
        <div class="or-register-kv-value">${esc(String(row.family_label ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Test</div>
        <div class="or-register-kv-value">${esc(String(row.test_name ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Override</div>
        <div class="or-register-kv-value">${esc(overrideDisplay)}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Source Request</div>
        <div class="or-register-kv-value">${reqBlock}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Requested</div>
        <div class="or-register-kv-value">${renderOverrideRegisterRequestedCell(row)}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Reviewed</div>
        <div class="or-register-kv-value">${renderOverrideRegisterReviewedCell(row)}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Last Audit</div>
        <div class="or-register-kv-value">${renderOverrideRegisterLastAudit(row)}</div>
      </div>
      ${
        row.supersedes_override_label
          ? `<div class="or-register-kv">
        <div class="or-register-kv-label">Supersedes</div>
        <div class="or-register-kv-value">${esc(String(row.supersedes_override_label))}</div>
      </div>`
          : ""
      }
      ${
        row.superseded_by_override_label
          ? `<div class="or-register-kv">
        <div class="or-register-kv-label">Superseded By</div>
        <div class="or-register-kv-value">${esc(String(row.superseded_by_override_label))}</div>
      </div>`
          : ""
      }
    </div>
  `;
}

const OVERRIDE_REGISTER_CONFIRM_LABEL = "Confirm Review";
const OVERRIDE_REGISTER_DEACTIVATE_LABEL = "Deactivate Override";
const OVERRIDE_REGISTER_SUPERSEDE_LABEL = "Supersede Override";
const OVERRIDE_DEACTIVATE_CONFIRM_LABEL = "Confirm Deactivation";
const OVERRIDE_SUPERSEDE_CONFIRM_LABEL = "Confirm Supersede";

function isOverrideRegisterParentBlocked() {
  return (
    overrideRegisterActionInFlight ||
    overrideDeactivateConfirmOpen ||
    overrideSupersedeFormOpen ||
    overrideSupersedeConfirmOpen
  );
}

function isAppliedOverrideRowActive(row) {
  return row?.is_active === true;
}

function parseOverrideLifecycleRpcResponse(data) {
  if (data == null) return { ok: true, message: "" };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { ok: true, message: "" };

  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "").trim(),
      message: String(row.message ?? "Action was not completed.").trim(),
    };
  }

  return {
    ok: true,
    message: String(row.message ?? "").trim(),
  };
}

function syncOverrideRegisterModalActions(row) {
  const parentBlocked = isOverrideRegisterParentBlocked();
  const hasRow = !!row;
  const active = hasRow && isAppliedOverrideRowActive(row);
  const modalOpen =
    specOverrideRegisterModal &&
    !specOverrideRegisterModal.classList.contains("hidden");

  if (specOverrideRegisterDeactivateBtn) {
    const showDeactivate = modalOpen && active;
    specOverrideRegisterDeactivateBtn.classList.toggle(
      "hidden",
      !showDeactivate,
    );
    specOverrideRegisterDeactivateBtn.disabled =
      parentBlocked || !active;
    if (!parentBlocked) {
      specOverrideRegisterDeactivateBtn.textContent =
        OVERRIDE_REGISTER_DEACTIVATE_LABEL;
    }
  }

  if (specOverrideRegisterSupersedeBtn) {
    const showSupersede = modalOpen && active;
    specOverrideRegisterSupersedeBtn.classList.toggle("hidden", !showSupersede);
    specOverrideRegisterSupersedeBtn.disabled = parentBlocked || !active;
    if (!parentBlocked) {
      specOverrideRegisterSupersedeBtn.textContent =
        OVERRIDE_REGISTER_SUPERSEDE_LABEL;
    }
  }

  if (specOverrideRegisterConfirmBtn) {
    if (!parentBlocked) {
      specOverrideRegisterConfirmBtn.textContent = OVERRIDE_REGISTER_CONFIRM_LABEL;
    }
    specOverrideRegisterConfirmBtn.disabled = !hasRow || parentBlocked;
  }

  if (specOverrideRegisterCancel) {
    specOverrideRegisterCancel.disabled = parentBlocked;
  }
}

function renderOverrideDeactivateConfirmDetail(row) {
  const overrideDisplay = formatAppliedOverrideDisplay(row);
  return `
    <div class="or-register-detail-grid">
      <div class="or-register-kv">
        <div class="or-register-kv-label">Override ID</div>
        <div class="or-register-kv-value">#${esc(String(row.override_id ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Entity</div>
        <div class="or-register-kv-value">${esc(String(row.entity_label ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Test</div>
        <div class="or-register-kv-value">${esc(String(row.test_name ?? "—"))}</div>
      </div>
      <div class="or-register-kv">
        <div class="or-register-kv-label">Override</div>
        <div class="or-register-kv-value">${esc(overrideDisplay)}</div>
      </div>
    </div>
  `;
}

function syncOverrideDeactivateConfirmActions(inFlight) {
  if (specOverrideDeactivateConfirmCancel) {
    specOverrideDeactivateConfirmCancel.disabled = inFlight;
  }
  if (specOverrideDeactivateConfirmClose) {
    specOverrideDeactivateConfirmClose.disabled = inFlight;
  }
  if (specOverrideDeactivateConfirmBtn) {
    specOverrideDeactivateConfirmBtn.disabled = inFlight;
    specOverrideDeactivateConfirmBtn.textContent = inFlight
      ? "Deactivating..."
      : OVERRIDE_DEACTIVATE_CONFIRM_LABEL;
  }
}

function openOverrideDeactivateConfirmModal(row, remarks) {
  pendingDeactivateOverrideRow = row;
  pendingDeactivateRemarks = remarks;

  if (specOverrideDeactivateConfirmDetail) {
    specOverrideDeactivateConfirmDetail.innerHTML =
      renderOverrideDeactivateConfirmDetail(row);
  }
  if (specOverrideDeactivateConfirmRemarks) {
    specOverrideDeactivateConfirmRemarks.textContent = remarks || "—";
  }

  overrideDeactivateConfirmOpen = true;
  syncOverrideDeactivateConfirmActions(false);
  specOverrideDeactivateConfirmModal?.classList.remove("hidden");
  syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
}

function closeOverrideDeactivateConfirmModal() {
  specOverrideDeactivateConfirmModal?.classList.add("hidden");
  pendingDeactivateOverrideRow = null;
  pendingDeactivateRemarks = "";
  overrideDeactivateConfirmOpen = false;
  syncOverrideDeactivateConfirmActions(false);
  if (
    specOverrideRegisterModal &&
    !specOverrideRegisterModal.classList.contains("hidden")
  ) {
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
  }
}

function normalizeOverrideSpecTypeForForm(raw) {
  const t = String(raw ?? "").trim().toUpperCase();
  if (t === "MIN_ONLY") return "NLT";
  if (t === "MAX_ONLY") return "NMT";
  return t;
}

function mapRegisterRowToSupersedePrefill(row) {
  const specType = normalizeOverrideSpecTypeForForm(row.override_spec_type);
  const textVal = String(row.override_text_value ?? "").trim();
  return {
    actionType: String(row.action_type ?? "modify").toLowerCase(),
    specType,
    min: String(row.override_min_value ?? ""),
    max: String(row.override_max_value ?? ""),
    text: textVal,
    exact:
      specType === "EXACT_NUMERIC"
        ? String(row.override_min_value ?? "")
        : "",
    target: String(row.override_target_value ?? ""),
    tolerance: String(row.override_tolerance_value ?? ""),
    toleranceUomId:
      row.override_tolerance_uom_id != null
        ? String(row.override_tolerance_uom_id)
        : "",
    uomId: row.override_uom_id != null ? String(row.override_uom_id) : "",
    methodId:
      row.override_method_id != null ? Number(row.override_method_id) : null,
    methodName: String(row.override_method_name ?? "").trim(),
    reason: String(row.reason ?? "").trim(),
  };
}

function supersedeSpecTypeOptionsForResultKind(resultKind, currentSpecType) {
  const kind = String(resultKind ?? "").toUpperCase();
  const options = [];

  if (kind === "NUMERIC") {
    options.push(
      ["RANGE", "RANGE — min to max"],
      ["NMT", "NMT — Not More Than"],
      ["NLT", "NLT — Not Less Than"],
      ["EXACT_NUMERIC", "EXACT NUMERIC — equals value"],
      ["TOLERANCE", "TOLERANCE — target ± tolerance"],
    );
  } else if (kind === "TEXT") {
    options.push(
      ["TEXT", "TEXT — expected text"],
      ["BOOLEAN", "BOOLEAN — true/false text"],
    );
  } else if (kind === "PASS_FAIL") {
    options.push(["PASS_FAIL", "PASS / FAIL"]);
  }

  const current = normalizeOverrideSpecTypeForForm(currentSpecType);
  if (
    current &&
    !options.some(([value]) => value === current) &&
    current !== "MIN_ONLY" &&
    current !== "MAX_ONLY"
  ) {
    options.push([current, current]);
  }

  return options;
}

function applySupersedeSpecTypeOptions(resultKind, currentSpecType) {
  if (!specOverrideSupersedeSpecType) return;
  const options = supersedeSpecTypeOptionsForResultKind(
    resultKind,
    currentSpecType,
  );
  const oldValue = specOverrideSupersedeSpecType.value;
  if (!options.length) {
    specOverrideSupersedeSpecType.innerHTML =
      `<option value="">-- Spec type unavailable --</option>`;
    specOverrideSupersedeSpecType.disabled = true;
    return;
  }
  specOverrideSupersedeSpecType.innerHTML = options
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}">${esc(label)}</option>`,
    )
    .join("");
  const normalized = normalizeOverrideSpecTypeForForm(currentSpecType);
  if (options.some(([value]) => value === oldValue)) {
    specOverrideSupersedeSpecType.value = oldValue;
  } else if (options.some(([value]) => value === normalized)) {
    specOverrideSupersedeSpecType.value = normalized;
  }
  specOverrideSupersedeSpecType.disabled = options.length === 1;
}

function updateSupersedeUomRowVisibility() {
  const specType = specOverrideSupersedeSpecType?.value ?? "";
  const uomRow = document.getElementById("specOverrideSupersedeUomRow");
  const uomLabel = document.getElementById("specOverrideSupersedeUomLabel");
  if (!uomRow || !specOverrideSupersedeUom) return;
  uomRow.classList.remove("hidden");
  specOverrideSupersedeUom.disabled = false;
  if (uomLabel) {
    uomLabel.textContent =
      specType === "TOLERANCE" ? "Target Unit of Measure" : "Unit of Measure";
  }
}

function renderSupersedeDynamicInputs() {
  if (!specOverrideSupersedeDyn || !specOverrideSupersedeSpecType) return;
  const specType = specOverrideSupersedeSpecType.value;
  const { min, max, text, exact, target, tolerance, toleranceUomId } =
    supersedeModalPrefill;

  let html = "";
  if (specType === "RANGE") {
    html = `
      <div class="form-group">
        <label for="specOverrideSupersedeMin">Min Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeMin" class="form-control" step="any" value="${esc(min)}">
      </div>
      <div class="form-group">
        <label for="specOverrideSupersedeMax">Max Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeMax" class="form-control" step="any" value="${esc(max)}">
      </div>`;
  } else if (specType === "NMT") {
    html = `
      <div class="form-group">
        <label for="specOverrideSupersedeMax">Max Value (NMT) <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeMax" class="form-control" step="any" value="${esc(max)}">
      </div>`;
  } else if (specType === "NLT") {
    html = `
      <div class="form-group">
        <label for="specOverrideSupersedeMin">Min Value (NLT) <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeMin" class="form-control" step="any" value="${esc(min)}">
      </div>`;
  } else if (specType === "EXACT_NUMERIC") {
    html = `
      <div class="form-group">
        <label for="specOverrideSupersedeExact">Exact Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeExact" class="form-control" step="any" value="${esc(exact)}">
      </div>`;
  } else if (
    specType === "TEXT" ||
    specType === "PASS_FAIL" ||
    specType === "BOOLEAN"
  ) {
    const label =
      specType === "PASS_FAIL"
        ? "Pass/Fail Text"
        : specType === "BOOLEAN"
          ? "Boolean Text"
          : "Spec Text";
    const placeholder =
      specType === "PASS_FAIL"
        ? "e.g. Passes"
        : specType === "BOOLEAN"
          ? "e.g. true"
          : "e.g. Clear, colourless liquid";
    html = `
      <div class="form-group" style="grid-column:1/-1;">
        <label for="specOverrideSupersedeText">${label} <span style="color:#ef4444">*</span></label>
        <input type="text" id="specOverrideSupersedeText" class="form-control" placeholder="${esc(placeholder)}" value="${esc(text)}">
      </div>`;
  } else if (specType === "TOLERANCE") {
    html = `
      <div class="form-group">
        <label for="specOverrideSupersedeTarget">Target Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeTarget" class="form-control" step="any" value="${esc(target)}">
      </div>
      <div class="form-group">
        <label for="specOverrideSupersedeTolerance">Tolerance Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="specOverrideSupersedeTolerance" class="form-control" step="any" value="${esc(tolerance)}">
      </div>
      <div class="form-group">
        <label for="specOverrideSupersedeToleranceUom">Tolerance UOM <span style="color:#ef4444">*</span></label>
        <select id="specOverrideSupersedeToleranceUom" class="form-control"></select>
      </div>`;
  }

  specOverrideSupersedeDyn.innerHTML = html;

  if (specType === "TOLERANCE") {
    populateLabUomSelect(
      document.getElementById("specOverrideSupersedeToleranceUom"),
      toleranceUomId,
    );
  }

  updateSupersedeUomRowVisibility();

  [
    "specOverrideSupersedeMin",
    "specOverrideSupersedeMax",
    "specOverrideSupersedeText",
    "specOverrideSupersedeExact",
    "specOverrideSupersedeTarget",
    "specOverrideSupersedeTolerance",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateSupersedeDisplayText);
  });
  document
    .getElementById("specOverrideSupersedeToleranceUom")
    ?.addEventListener("change", updateSupersedeDisplayText);
  updateSupersedeDisplayText();
}

function updateSupersedeDisplayText() {
  if (!specOverrideSupersedeDisplayPreview || !specOverrideSupersedeSpecType) {
    return;
  }
  const specType = specOverrideSupersedeSpecType.value;
  let text = "—";

  if (specType === "RANGE") {
    const minV = document.getElementById("specOverrideSupersedeMin")?.value.trim();
    const maxV = document.getElementById("specOverrideSupersedeMax")?.value.trim();
    if (minV && maxV) text = `${minV} – ${maxV}`;
    else if (minV) text = `≥ ${minV}`;
    else if (maxV) text = `≤ ${maxV}`;
  } else if (specType === "NMT") {
    const maxV = document.getElementById("specOverrideSupersedeMax")?.value.trim();
    if (maxV) text = `NMT ${maxV}`;
  } else if (specType === "NLT") {
    const minV = document.getElementById("specOverrideSupersedeMin")?.value.trim();
    if (minV) text = `NLT ${minV}`;
  } else if (specType === "EXACT_NUMERIC") {
    const val = document.getElementById("specOverrideSupersedeExact")?.value.trim();
    if (val) text = `= ${val}`;
  } else if (
    specType === "TEXT" ||
    specType === "PASS_FAIL" ||
    specType === "BOOLEAN"
  ) {
    text =
      document.getElementById("specOverrideSupersedeText")?.value.trim() || "—";
  } else if (specType === "TOLERANCE") {
    const targetV = document
      .getElementById("specOverrideSupersedeTarget")
      ?.value.trim();
    const tolV = document
      .getElementById("specOverrideSupersedeTolerance")
      ?.value.trim();
    const tolUomSel = document.getElementById("specOverrideSupersedeToleranceUom");
    text = buildToleranceDisplayText(
      targetV,
      tolV,
      selectedUomSymbol(specOverrideSupersedeUom),
      selectedToleranceUomSymbol(tolUomSel),
    );
  }

  const isNumericType = ["RANGE", "NMT", "NLT", "EXACT_NUMERIC"].includes(
    specType,
  );
  const uomId = specOverrideSupersedeUom?.value
    ? Number(specOverrideSupersedeUom.value)
    : null;
  const uomRow = (labUomRows ?? []).find((u) => Number(u.id) === uomId);
  const uomToken = uomRow?.symbol || uomRow?.uom_code || "";
  if (isNumericType && text !== "—" && uomToken) {
    text = appendUomIfNeeded(text, uomToken);
  }

  specOverrideSupersedeDisplayPreview.textContent = text;
}

function updateSupersedeModalDynamics() {
  const action = specOverrideSupersedeAction?.value ?? "modify";
  const specSection = document.getElementById("specOverrideSupersedeSpecSection");
  const isDisable = action === "disable";
  specSection?.classList.toggle("hidden", isDisable);
  if (!isDisable) {
    renderSupersedeDynamicInputs();
    updateSupersedeDisplayText();
  } else if (specOverrideSupersedeDisplayPreview) {
    specOverrideSupersedeDisplayPreview.textContent = "—";
  }
}

function collectSupersedeFormPayload() {
  const remarks = specOverrideSupersedeRemarks?.value.trim() ?? "";
  if (!remarks) {
    return { error: "Supersede remarks are required." };
  }

  const actionType = String(specOverrideSupersedeAction?.value ?? "").trim();
  if (!actionType) {
    return { error: "Action type is required." };
  }

  const methodId =
    pendingSupersedeOldRow?.override_method_id != null
      ? Number(pendingSupersedeOldRow.override_method_id)
      : null;

  if (actionType === "disable") {
    return {
      payload: {
        actionType,
        specType: null,
        minValue: null,
        maxValue: null,
        textValue: null,
        targetValue: null,
        toleranceValue: null,
        toleranceUomId: null,
        displayText: null,
        reason: specOverrideSupersedeReason?.value.trim() || null,
        overrideUomId: null,
        overrideMethodId: methodId,
      },
      remarks,
    };
  }

  const specType = specOverrideSupersedeSpecType?.value ?? "";
  if (!specType) {
    return { error: "Spec type is required." };
  }

  let minVal = null;
  let maxVal = null;
  let textVal = null;
  let targetVal = null;
  let toleranceVal = null;
  let toleranceUomId = null;
  let displayText = null;
  const overrideUomId = specOverrideSupersedeUom?.value
    ? Number(specOverrideSupersedeUom.value)
    : null;

  if (specType === "RANGE") {
    const minRaw = document.getElementById("specOverrideSupersedeMin")?.value.trim();
    const maxRaw = document.getElementById("specOverrideSupersedeMax")?.value.trim();
    if (!minRaw || !maxRaw) {
      return { error: "Both min and max values are required for RANGE." };
    }
    minVal = Number(minRaw);
    maxVal = Number(maxRaw);
  } else if (specType === "NMT") {
    const maxRaw = document.getElementById("specOverrideSupersedeMax")?.value.trim();
    if (!maxRaw) return { error: "Max value is required for NMT." };
    maxVal = Number(maxRaw);
  } else if (specType === "NLT") {
    const minRaw = document.getElementById("specOverrideSupersedeMin")?.value.trim();
    if (!minRaw) return { error: "Min value is required for NLT." };
    minVal = Number(minRaw);
  } else if (specType === "EXACT_NUMERIC") {
    const exactRaw = document
      .getElementById("specOverrideSupersedeExact")
      ?.value.trim();
    if (!exactRaw) return { error: "Value is required for EXACT NUMERIC." };
    minVal = Number(exactRaw);
  } else if (
    specType === "TEXT" ||
    specType === "PASS_FAIL" ||
    specType === "BOOLEAN"
  ) {
    textVal = document.getElementById("specOverrideSupersedeText")?.value.trim();
    if (!textVal) {
      return {
        error: `Text value is required for ${specType.replace(/_/g, " ")}.`,
      };
    }
  } else if (specType === "TOLERANCE") {
    const targetRaw = document
      .getElementById("specOverrideSupersedeTarget")
      ?.value.trim();
    const tolRaw = document
      .getElementById("specOverrideSupersedeTolerance")
      ?.value.trim();
    const tolUomRaw =
      document.getElementById("specOverrideSupersedeToleranceUom")?.value ?? "";
    toleranceUomId = tolUomRaw ? Number(tolUomRaw) : null;
    if (!targetRaw || !tolRaw) {
      return {
        error: "Target and tolerance values are required for TOLERANCE.",
      };
    }
    if (!toleranceUomId) {
      return { error: "Tolerance UOM is required for TOLERANCE." };
    }
    targetVal = Number(targetRaw);
    toleranceVal = Number(tolRaw);
  }

  updateSupersedeDisplayText();
  const previewText = specOverrideSupersedeDisplayPreview?.textContent?.trim() ?? "";
  displayText = previewText && previewText !== "—" ? previewText : null;

  return {
    payload: {
      actionType,
      specType,
      minValue: minVal,
      maxValue: maxVal,
      textValue: textVal,
      targetValue: targetVal,
      toleranceValue: toleranceVal,
      toleranceUomId,
      displayText,
      reason: specOverrideSupersedeReason?.value.trim() || null,
      overrideUomId,
      overrideMethodId: methodId,
    },
    remarks,
  };
}

function formatSupersedePayloadSummary(payload) {
  if (!payload) return "—";
  if (payload.actionType === "disable") return "Disabled";
  if (payload.displayText) return payload.displayText;
  const parts = [];
  if (payload.specType) parts.push(payload.specType);
  if (payload.textValue) parts.push(payload.textValue);
  if (payload.minValue != null && payload.maxValue != null) {
    parts.push(`${payload.minValue} – ${payload.maxValue}`);
  } else if (payload.minValue != null) parts.push(`≥ ${payload.minValue}`);
  else if (payload.maxValue != null) parts.push(`≤ ${payload.maxValue}`);
  if (payload.targetValue != null && payload.toleranceValue != null) {
    parts.push(`${payload.targetValue} ± ${payload.toleranceValue}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

function renderSupersedeConfirmDiff(oldRow, payload) {
  const oldDisplay = formatAppliedOverrideDisplay(oldRow);
  const newDisplay = formatSupersedePayloadSummary(payload);
  const oldAction = String(oldRow.action_type ?? "—");
  const newAction = String(payload?.actionType ?? "—");
  const oldSpec = String(oldRow.override_spec_type ?? "—");
  const newSpec = String(payload?.specType ?? "—");
  const oldReason = String(oldRow.reason ?? "—");
  const newReason = String(payload?.reason ?? "—");

  return `
    <div class="spec-request-detail-grid">
      <div class="spec-request-card spec-request-card-current">
        <div class="spec-request-card-title">
          <span class="spec-request-card-role spec-request-card-role-current">Current</span>
          Current Applied Override
        </div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Override</div><div class="spec-request-kv-value">${esc(oldDisplay)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Action</div><div class="spec-request-kv-value">${esc(oldAction)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(oldSpec)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Reason</div><div class="spec-request-kv-value">${esc(oldReason)}</div></div>
        </div>
      </div>
      <div class="spec-request-card spec-request-card-proposed">
        <div class="spec-request-card-title">
          <span class="spec-request-card-role spec-request-card-role-proposed">Proposed</span>
          Replacement Override
        </div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Override</div><div class="spec-request-kv-value">${esc(newDisplay)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Action</div><div class="spec-request-kv-value">${esc(newAction)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(newSpec)}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Reason</div><div class="spec-request-kv-value">${esc(newReason)}</div></div>
        </div>
      </div>
    </div>`;
}

function syncSupersedeFormActions(inFlight) {
  if (specOverrideSupersedeCancel) {
    specOverrideSupersedeCancel.disabled = inFlight;
  }
  if (specOverrideSupersedeClose) {
    specOverrideSupersedeClose.disabled = inFlight;
  }
  if (specOverrideSupersedeReviewBtn) {
    specOverrideSupersedeReviewBtn.disabled = inFlight;
  }
}

function syncSupersedeConfirmActions(inFlight) {
  if (specOverrideSupersedeConfirmCancel) {
    specOverrideSupersedeConfirmCancel.disabled = inFlight;
  }
  if (specOverrideSupersedeConfirmClose) {
    specOverrideSupersedeConfirmClose.disabled = inFlight;
  }
  if (specOverrideSupersedeConfirmBtn) {
    specOverrideSupersedeConfirmBtn.disabled = inFlight;
    specOverrideSupersedeConfirmBtn.textContent = inFlight
      ? "Superseding..."
      : OVERRIDE_SUPERSEDE_CONFIRM_LABEL;
  }
}

async function openSupersedeAppliedOverrideModal(row) {
  pendingSupersedeOldRow = row;
  supersedeModalPrefill = mapRegisterRowToSupersedePrefill(row);
  supersedeLockedTestResultKind = "";

  hideBanner(specOverrideSupersedeBanner);
  if (specOverrideSupersedeRemarks) specOverrideSupersedeRemarks.value = "";

  const level = row.override_level_label ?? row.subject_type ?? "—";
  if (specOverrideSupersedeContext) {
    specOverrideSupersedeContext.textContent = `#${row.override_id} · ${level} · ${row.entity_label ?? "—"} · ${row.test_name ?? "—"}`;
  }

  if (specOverrideSupersedeAction) {
    setSelectValueIfExists(
      specOverrideSupersedeAction,
      supersedeModalPrefill.actionType,
    );
  }
  if (specOverrideSupersedeReason) {
    specOverrideSupersedeReason.value = supersedeModalPrefill.reason;
  }
  if (specOverrideSupersedeMethodDisplay) {
    specOverrideSupersedeMethodDisplay.value =
      supersedeModalPrefill.methodName || "—";
  }

  await loadLabUoms();
  populateLabUomSelect(
    specOverrideSupersedeUom,
    supersedeModalPrefill.uomId,
  );

  if (row.test_id) {
    const { data } = await labSupabase
      .from("test_master")
      .select("result_kind")
      .eq("id", Number(row.test_id))
      .maybeSingle();
    supersedeLockedTestResultKind = String(data?.result_kind ?? "").toUpperCase();
  }

  applySupersedeSpecTypeOptions(
    supersedeLockedTestResultKind,
    supersedeModalPrefill.specType,
  );
  if (specOverrideSupersedeSpecType) {
    setSelectValueIfExists(
      specOverrideSupersedeSpecType,
      supersedeModalPrefill.specType,
    );
  }

  updateSupersedeModalDynamics();

  overrideSupersedeFormOpen = true;
  syncSupersedeFormActions(false);
  specOverrideSupersedeModal?.classList.remove("hidden");
  syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
}

function closeSupersedeAppliedOverrideModal() {
  specOverrideSupersedeModal?.classList.add("hidden");
  pendingSupersedeOldRow = null;
  supersedeModalPrefill = {};
  supersedeLockedTestResultKind = "";
  overrideSupersedeFormOpen = false;
  if (specOverrideSupersedeDyn) specOverrideSupersedeDyn.innerHTML = "";
  hideBanner(specOverrideSupersedeBanner);
  syncSupersedeFormActions(false);
  if (
    specOverrideRegisterModal &&
    !specOverrideRegisterModal.classList.contains("hidden")
  ) {
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
  }
}

function openSupersedeConfirmModal(oldRow, payload, remarks) {
  pendingSupersedePayload = payload;
  pendingSupersedeRemarks = remarks;
  if (specOverrideSupersedeConfirmDiff) {
    specOverrideSupersedeConfirmDiff.innerHTML = renderSupersedeConfirmDiff(
      oldRow,
      payload,
    );
  }
  if (specOverrideSupersedeConfirmRemarks) {
    specOverrideSupersedeConfirmRemarks.textContent = remarks || "—";
  }
  overrideSupersedeConfirmOpen = true;
  syncSupersedeConfirmActions(false);
  specOverrideSupersedeConfirmModal?.classList.remove("hidden");
  syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
}

function closeSupersedeConfirmModal() {
  specOverrideSupersedeConfirmModal?.classList.add("hidden");
  pendingSupersedePayload = null;
  pendingSupersedeRemarks = "";
  overrideSupersedeConfirmOpen = false;
  syncSupersedeConfirmActions(false);
  if (
    specOverrideRegisterModal &&
    !specOverrideRegisterModal.classList.contains("hidden")
  ) {
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
  }
}

function beginAppliedOverrideSupersede() {
  if (isOverrideRegisterParentBlocked()) return;
  if (!selectedOverrideRegisterRow) return;
  if (!isAppliedOverrideRowActive(selectedOverrideRegisterRow)) {
    toast("Only an active applied override can be superseded.", "warn");
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    return;
  }
  void openSupersedeAppliedOverrideModal(selectedOverrideRegisterRow);
}

function submitSupersedeFormForReview() {
  hideBanner(specOverrideSupersedeBanner);
  const collected = collectSupersedeFormPayload();
  if (collected.error) {
    showBanner(specOverrideSupersedeBanner, "warn", collected.error);
    return;
  }
  if (!pendingSupersedeOldRow) return;
  openSupersedeConfirmModal(
    pendingSupersedeOldRow,
    collected.payload,
    collected.remarks,
  );
}

async function confirmAppliedOverrideSupersede() {
  if (overrideRegisterActionInFlight) return;
  const oldRow = pendingSupersedeOldRow;
  const payload = pendingSupersedePayload;
  const remarks = pendingSupersedeRemarks;
  if (!oldRow || !payload || !remarks) return;

  if (!isAppliedOverrideRowActive(oldRow)) {
    toast("This override is no longer active.", "warn");
    closeSupersedeConfirmModal();
    closeSupersedeAppliedOverrideModal();
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    return;
  }

  const overrideId = Number(oldRow.override_id);
  if (!Number.isFinite(overrideId) || overrideId <= 0) {
    toast("Invalid override selected.", "warn");
    closeSupersedeConfirmModal();
    return;
  }

  overrideRegisterActionInFlight = true;
  syncSupersedeConfirmActions(true);
  syncSupersedeFormActions(true);
  syncOverrideRegisterModalActions(selectedOverrideRegisterRow);

  let shouldRefresh = false;
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      toast("Login session not found. Please reload.", "error");
      closeSupersedeConfirmModal();
      return;
    }

    const { data, error } = await labSupabase.rpc("fn_supersede_spec_override", {
      p_user_id: userId,
      p_old_override_id: overrideId,
      p_supersede_remarks: remarks,
      p_action_type: String(payload.actionType ?? "modify").toUpperCase(),
      p_spec_type: payload.specType,
      p_min_value: payload.minValue,
      p_max_value: payload.maxValue,
      p_text_value: payload.textValue,
      p_display_text: payload.displayText,
      p_reason: payload.reason,
      p_override_uom_id: payload.overrideUomId,
      p_override_method_id: payload.overrideMethodId,
      p_override_target_value: payload.targetValue,
      p_override_tolerance_value: payload.toleranceValue,
      p_override_tolerance_uom_id: payload.toleranceUomId,
    });

    if (error) {
      toast("Failed to supersede override: " + error.message, "error");
      closeSupersedeConfirmModal();
      return;
    }

    const result = parseOverrideLifecycleRpcResponse(data);
    if (!result.ok) {
      toast(result.message || "Override supersede was not completed.", "warn");
      closeSupersedeConfirmModal();
      return;
    }

    toast(
      result.message || "Applied override superseded successfully.",
      "success",
    );
    closeSupersedeConfirmModal();
    closeSupersedeAppliedOverrideModal();
    closeOverrideRegisterModal();
    shouldRefresh = true;
  } catch (err) {
    toast(
      "Failed to supersede override: " + (err?.message || String(err)),
      "error",
    );
    closeSupersedeConfirmModal();
  } finally {
    overrideRegisterActionInFlight = false;
    if (
      specOverrideSupersedeConfirmModal &&
      !specOverrideSupersedeConfirmModal.classList.contains("hidden")
    ) {
      syncSupersedeConfirmActions(false);
    }
    if (
      specOverrideSupersedeModal &&
      !specOverrideSupersedeModal.classList.contains("hidden")
    ) {
      syncSupersedeFormActions(false);
    }
    if (
      specOverrideRegisterModal &&
      !specOverrideRegisterModal.classList.contains("hidden")
    ) {
      syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    }
    if (shouldRefresh) {
      await refreshAfterOverrideRegisterAction();
    }
  }
}

function openAppliedOverrideReviewModal(overrideId) {
  const row = overrideRegisterRows.find(
    (r) => String(r.override_id) === String(overrideId),
  );

  if (!row) {
    toast("Override not found.", "warn");
    return;
  }

  selectedOverrideRegisterRow = row;

  if (specOverrideRegisterTitle) {
    specOverrideRegisterTitle.textContent = "Review Applied Override";
  }

  if (specOverrideRegisterContext) {
    const level = row.override_level_label ?? row.subject_type ?? "—";
    specOverrideRegisterContext.textContent = `${level} · ${row.entity_label ?? "—"} · ${row.test_name ?? "—"}`;
  }

  if (specOverrideRegisterDetail) {
    specOverrideRegisterDetail.innerHTML =
      renderOverrideRegisterModalDetail(row);
  }

  if (specOverrideRegisterRemarks) {
    specOverrideRegisterRemarks.value = "";
    specOverrideRegisterRemarks.placeholder =
      "Required for review or deactivation";
  }

  if (specOverrideRegisterConfirmBtn) {
    specOverrideRegisterConfirmBtn.className = "btn-primary";
    specOverrideRegisterConfirmBtn.style.cssText = "";
    specOverrideRegisterConfirmBtn.textContent = OVERRIDE_REGISTER_CONFIRM_LABEL;
  }

  setOverrideRegisterRowActive(row.override_id);
  specOverrideRegisterModal?.classList.remove("hidden");
  syncOverrideRegisterModalActions(row);
}

function closeOverrideRegisterModal() {
  closeSupersedeConfirmModal();
  closeSupersedeAppliedOverrideModal();
  closeOverrideDeactivateConfirmModal();
  specOverrideRegisterModal?.classList.add("hidden");
  clearOverrideRegisterRowActiveState();
  selectedOverrideRegisterRow = null;
  overrideRegisterActionInFlight = false;
  if (specOverrideRegisterRemarks) specOverrideRegisterRemarks.value = "";
  if (specOverrideRegisterDetail) specOverrideRegisterDetail.innerHTML = "";
  if (specOverrideRegisterConfirmBtn) {
    specOverrideRegisterConfirmBtn.textContent = OVERRIDE_REGISTER_CONFIRM_LABEL;
    specOverrideRegisterConfirmBtn.disabled = false;
  }
  if (specOverrideRegisterDeactivateBtn) {
    specOverrideRegisterDeactivateBtn.textContent =
      OVERRIDE_REGISTER_DEACTIVATE_LABEL;
    specOverrideRegisterDeactivateBtn.classList.add("hidden");
    specOverrideRegisterDeactivateBtn.disabled = false;
  }
  if (specOverrideRegisterSupersedeBtn) {
    specOverrideRegisterSupersedeBtn.textContent =
      OVERRIDE_REGISTER_SUPERSEDE_LABEL;
    specOverrideRegisterSupersedeBtn.classList.add("hidden");
    specOverrideRegisterSupersedeBtn.disabled = false;
  }
  if (specOverrideRegisterCancel) {
    specOverrideRegisterCancel.disabled = false;
  }
  syncOverrideRegisterModalActions(null);
}

async function submitAppliedOverrideReview() {
  if (overrideRegisterActionInFlight) return;
  if (!selectedOverrideRegisterRow) return;

  const remarks = specOverrideRegisterRemarks?.value.trim() ?? "";
  if (!remarks) {
    toast("Review remarks are required.", "warn");
    return;
  }

  const overrideId = Number(selectedOverrideRegisterRow.override_id);
  if (!Number.isFinite(overrideId) || overrideId <= 0) {
    toast("Invalid override selected.", "warn");
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    toast("Login session not found. Please reload.", "error");
    return;
  }

  const confirmBtn = specOverrideRegisterConfirmBtn;
  overrideRegisterActionInFlight = true;
  syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
  if (confirmBtn) {
    confirmBtn.textContent = "Reviewing...";
  }

  let shouldRefresh = false;
  try {
    const { error } = await labSupabase.rpc("fn_review_spec_override", {
      p_user_id: userId,
      p_override_id: overrideId,
      p_review_remarks: remarks,
    });
    if (error) {
      toast("Failed to review override: " + error.message, "error");
      return;
    }

    toast("Override review recorded.", "success");
    closeOverrideRegisterModal();
    shouldRefresh = true;
  } catch (err) {
    toast(
      "Failed to review override: " + (err?.message || String(err)),
      "error",
    );
  } finally {
    overrideRegisterActionInFlight = false;
    if (
      specOverrideRegisterModal &&
      !specOverrideRegisterModal.classList.contains("hidden")
    ) {
      syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    }
    if (shouldRefresh) {
      await refreshAfterOverrideRegisterAction();
    }
  }
}

async function submitAppliedOverrideDeactivation() {
  if (overrideRegisterActionInFlight) return;
  if (!selectedOverrideRegisterRow) return;

  if (!isAppliedOverrideRowActive(selectedOverrideRegisterRow)) {
    toast("This override is already inactive.", "warn");
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    return;
  }

  const remarks = specOverrideRegisterRemarks?.value.trim() ?? "";
  if (!remarks) {
    toast("Remarks are required to deactivate an override.", "warn");
    return;
  }

  const overrideId = Number(selectedOverrideRegisterRow.override_id);
  if (!Number.isFinite(overrideId) || overrideId <= 0) {
    toast("Invalid override selected.", "warn");
    return;
  }

  openOverrideDeactivateConfirmModal(selectedOverrideRegisterRow, remarks);
}

async function confirmAppliedOverrideDeactivation() {
  if (overrideRegisterActionInFlight) return;

  const row = pendingDeactivateOverrideRow;
  const remarks = pendingDeactivateRemarks;
  if (!row || !remarks) return;

  if (!isAppliedOverrideRowActive(row)) {
    toast("This override is already inactive.", "warn");
    closeOverrideDeactivateConfirmModal();
    syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    return;
  }

  const overrideId = Number(row.override_id);
  if (!Number.isFinite(overrideId) || overrideId <= 0) {
    toast("Invalid override selected.", "warn");
    closeOverrideDeactivateConfirmModal();
    return;
  }

  overrideRegisterActionInFlight = true;
  syncOverrideDeactivateConfirmActions(true);
  syncOverrideRegisterModalActions(selectedOverrideRegisterRow);

  let shouldRefresh = false;
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      toast("Login session not found. Please reload.", "error");
      closeOverrideDeactivateConfirmModal();
      return;
    }

    const { data, error } = await labSupabase.rpc("fn_deactivate_spec_override", {
      p_user_id: userId,
      p_override_id: overrideId,
      p_deactivation_remarks: remarks,
    });

    if (error) {
      toast("Failed to deactivate override: " + error.message, "error");
      closeOverrideDeactivateConfirmModal();
      return;
    }

    const result = parseOverrideLifecycleRpcResponse(data);
    if (!result.ok) {
      toast(result.message || "Override deactivation was not completed.", "warn");
      closeOverrideDeactivateConfirmModal();
      return;
    }

    toast(
      result.message || "Applied override deactivated successfully.",
      "success",
    );
    closeOverrideDeactivateConfirmModal();
    closeOverrideRegisterModal();
    shouldRefresh = true;
  } catch (err) {
    toast(
      "Failed to deactivate override: " + (err?.message || String(err)),
      "error",
    );
    closeOverrideDeactivateConfirmModal();
  } finally {
    overrideRegisterActionInFlight = false;
    if (
      specOverrideDeactivateConfirmModal &&
      !specOverrideDeactivateConfirmModal.classList.contains("hidden")
    ) {
      syncOverrideDeactivateConfirmActions(false);
    }
    if (
      specOverrideRegisterModal &&
      !specOverrideRegisterModal.classList.contains("hidden")
    ) {
      syncOverrideRegisterModalActions(selectedOverrideRegisterRow);
    }
    if (shouldRefresh) {
      await refreshAfterOverrideRegisterAction();
    }
  }
}

async function refreshAfterOverrideRegisterAction() {
  await loadOverrideRegister();
  await refreshCurrentSpecReviewContext();
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

function formatApplyScopeLabel(scope, subjectType) {
  const normalized = normalizePendingRequestScope(scope);
  const subject = String(subjectType ?? "").trim().toUpperCase();
  if (normalized === "FAMILY") return "Family / Base Spec";
  if (normalized === "PRODUCT") {
    return subject === "FG" ? "Product Override" : "Item Override";
  }
  const raw = String(scope ?? "").trim();
  return raw || "—";
}

function getRequestOriginalRouteLabel(request) {
  const label = String(
    request?.route_label ?? request?.review_route_label ?? "",
  ).trim();
  if (label) return label;
  return formatApplyScopeLabel(request?.request_scope, request?.subject_type);
}

function getRequestOriginalApplyScope(request) {
  const scope = normalizePendingRequestScope(request?.request_scope);
  return scope === "PRODUCT" || scope === "FAMILY" ? scope : "";
}

function buildSpecChangeRequestDecisionPayload({
  action,
  mode,
  request,
  userId,
  requestId,
  reviewRemarks,
}) {
  const base = {
    p_user_id: userId,
    p_request_id: requestId,
    p_review_remarks: reviewRemarks,
  };

  if (action === "reject") {
    return {
      ...base,
      p_decision: "REJECT",
      p_apply_scope: null,
      p_route_change_remarks: null,
    };
  }

  if (mode === "reviewQueue") {
    const applyScope =
      normalizePendingRequestScope(specRequestApplyScope?.value) ||
      getRequestOriginalApplyScope(request);
    const routeChanged = isReviewRouteChanged(request, applyScope);
    const routeChangeRemarks =
      specRequestRouteChangeRemarks?.value.trim() || null;
    return {
      ...base,
      p_decision: "APPLY",
      p_apply_scope: applyScope,
      p_route_change_remarks: routeChanged ? routeChangeRemarks : null,
    };
  }

  const applyScope = getRequestOriginalApplyScope(request);
  return {
    ...base,
    p_decision: "APPLY",
    p_apply_scope: applyScope,
    p_route_change_remarks: null,
  };
}

function isValidSpecChangeApplyScope(scope) {
  const normalized = normalizePendingRequestScope(scope);
  return normalized === "PRODUCT" || normalized === "FAMILY";
}

function isReviewRouteChanged(request, selectedApplyScope) {
  const original = getRequestOriginalApplyScope(request);
  const selected = normalizePendingRequestScope(selectedApplyScope);
  if (!original || !selected) return false;
  return original !== selected;
}

function isRouteWasChanged(row) {
  const value = row?.route_was_changed;
  return value === true || String(value).toLowerCase() === "true";
}

function formatRouteChangedSummary(row) {
  if (!isRouteWasChanged(row)) return "";
  const subject = String(row?.subject_type ?? "").trim().toUpperCase();
  const fromScope = row.route_changed_from_scope ?? row.request_scope;
  const toScope = row.route_changed_to_scope ?? row.review_apply_scope;
  const from = formatApplyScopeLabel(fromScope, subject);
  const to = formatApplyScopeLabel(toScope, subject);
  if (!from || !to || from === "—" || to === "—") return "";
  return `Route changed: ${from} → ${to}`;
}

function resetSpecRequestRouteDecisionControls() {
  if (specRequestRouteChangeRemarks) specRequestRouteChangeRemarks.value = "";
  if (specRequestRouteChangeRemarksGroup) {
    specRequestRouteChangeRemarksGroup.classList.add("hidden");
  }
  if (specRequestRouteWarning) {
    specRequestRouteWarning.textContent = "";
    specRequestRouteWarning.classList.add("hidden");
  }
  if (specRequestRouteDecisionSection) {
    specRequestRouteDecisionSection.classList.add("hidden");
  }
  if (specRequestOriginalRoute) specRequestOriginalRoute.textContent = "—";
}

function syncSpecRequestRouteDecisionUi(request) {
  if (!request || specRequestReviewMode !== "reviewQueue") return;

  const selectedScope =
    specRequestApplyScope?.value || getRequestOriginalApplyScope(request);
  const routeChanged = isReviewRouteChanged(request, selectedScope);

  if (specRequestRouteChangeRemarksGroup) {
    specRequestRouteChangeRemarksGroup.classList.toggle("hidden", !routeChanged);
  }

  if (!routeChanged && specRequestRouteChangeRemarks) {
    specRequestRouteChangeRemarks.value = "";
  }

  if (!specRequestRouteWarning) return;

  const normalized = normalizePendingRequestScope(selectedScope);
  if (normalized === "FAMILY") {
    specRequestRouteWarning.textContent =
      "This will create a new active Base Spec version for the family/group.";
    specRequestRouteWarning.classList.remove("hidden");
    return;
  }
  if (normalized === "PRODUCT") {
    specRequestRouteWarning.textContent =
      "This will create or replace a Product / Item Override for this product/item.";
    specRequestRouteWarning.classList.remove("hidden");
    return;
  }
  specRequestRouteWarning.textContent = "";
  specRequestRouteWarning.classList.add("hidden");
}

function renderSpecRequestRouteDecision(request) {
  if (!specRequestRouteDecisionSection) return;

  if (specRequestReviewMode !== "reviewQueue") {
    specRequestRouteDecisionSection.classList.add("hidden");
    return;
  }

  specRequestRouteDecisionSection.classList.remove("hidden");

  if (!request) {
    if (specRequestOriginalRoute) specRequestOriginalRoute.textContent = "—";
    return;
  }

  if (specRequestOriginalRoute) {
    specRequestOriginalRoute.textContent = getRequestOriginalRouteLabel(request);
  }

  const originalScope = getRequestOriginalApplyScope(request);
  const subjectType = String(request.subject_type ?? "").toUpperCase();

  if (specRequestApplyScope) {
    const productLabel = formatApplyScopeLabel("PRODUCT", subjectType);
    const familyLabel = formatApplyScopeLabel("FAMILY", subjectType);
    specRequestApplyScope.innerHTML = `<option value="PRODUCT">${esc(productLabel)}</option><option value="FAMILY">${esc(familyLabel)}</option>`;
    specRequestApplyScope.value =
      originalScope === "FAMILY" ? "FAMILY" : "PRODUCT";
  }

  syncSpecRequestRouteDecisionUi(request);
}

function isSameRequestId(left, right) {
  if (left == null || left === "" || right == null || right === "")
    return false;
  return String(left) === String(right);
}

async function getCurrentUserId() {
  if (currentUserId) return currentUserId;

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id) {
    return null;
  }

  currentUserId = data.user.id;
  return currentUserId;
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

function normalizeReferenceSourceDisplay(value) {
  return String(value ?? "").trim();
}

function getSnapshotReferenceSourceDisplay(row, snapshotKey) {
  const snapshot = row?.[snapshotKey];
  if (snapshot && typeof snapshot === "object") {
    return normalizeReferenceSourceDisplay(snapshot.reference_source_display);
  }
  return "";
}

function getRowCurrentReferenceSource(row) {
  return (
    normalizeReferenceSourceDisplay(row?.current_reference_source_display) ||
    getSnapshotReferenceSourceDisplay(row, "current_reference_snapshot")
  );
}

function getRowProposedReferenceSource(row) {
  return (
    normalizeReferenceSourceDisplay(row?.proposed_reference_source_display) ||
    normalizeReferenceSourceDisplay(row?.reference_source_display) ||
    getSnapshotReferenceSourceDisplay(row, "proposed_reference_snapshot")
  );
}

function hasAnyReferenceSource(row) {
  return !!(
    getRowCurrentReferenceSource(row) || getRowProposedReferenceSource(row)
  );
}

function formatReferenceSourceSummary(row) {
  const current = getRowCurrentReferenceSource(row);
  const proposed = getRowProposedReferenceSource(row);
  if (!current && !proposed) return "";
  if (current && proposed && current !== proposed) {
    return `Source: ${current} → ${proposed}`;
  }
  return `Source: ${proposed || current}`;
}

function renderReferenceSourceSublineHtml(row, cssClass = "rq-ref-source-meta") {
  const summary = formatReferenceSourceSummary(row);
  if (!summary) return "";
  return `<div class="${cssClass}">${esc(summary)}</div>`;
}

function buildReferenceSourceDetailSectionHtml(request) {
  if (!hasAnyReferenceSource(request)) return "";

  const current = getRowCurrentReferenceSource(request);
  const proposed = getRowProposedReferenceSource(request);

  const currentCard = current
    ? `<div class="spec-request-card spec-request-card-current">
        <div class="spec-request-card-title">
          <span class="spec-request-card-role spec-request-card-role-current">Current</span>
          Current Reference Source
        </div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Source</div><div class="spec-request-kv-value">${esc(current)}</div></div>
        </div>
      </div>`
    : "";

  const proposedCard = proposed
    ? `<div class="spec-request-card spec-request-card-proposed">
        <div class="spec-request-card-title">
          <span class="spec-request-card-role spec-request-card-role-proposed">Proposed</span>
          Proposed Reference Source
        </div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Source</div><div class="spec-request-kv-value">${esc(proposed)}</div></div>
        </div>
      </div>`
    : "";

  return `
    <section class="spec-request-panel">
      <div class="spec-request-section-title">Reference Source</div>
      <div class="spec-request-detail-grid">
        ${currentCard}${proposedCard}
      </div>
    </section>`;
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
  specRequestReviewMode = "context";
  resetSpecRequestRouteDecisionControls();
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

  activePendingReviewRequests = [request];
  selectedPendingReviewScope = normalizePendingRequestScope(
    request.request_scope,
  );
  selectedPendingReviewRequestId = String(request.request_id);
  specRequestReviewMode = "reviewQueue";
  resetSpecRequestRouteDecisionControls();

  if (specRequestReviewTitle) {
    specRequestReviewTitle.textContent = `Review Request #${request.request_id ?? ""}`;
  }

  if (specRequestReviewContext) {
    specRequestReviewContext.textContent = `${request.subject_type ?? "--"} - ${request.review_route_label ?? request.request_scope ?? "--"} - ${request.entity_label ?? request.family_label ?? "--"}`;
  }

  if (specRequestReviewRemarks) {
    specRequestReviewRemarks.value = "";
  }

  renderSpecRequestReviewModal();
  setReviewQueueRowActive(request.request_id);
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

function isSpecRequestReviewSingleLayout() {
  if (specRequestReviewMode === "reviewQueue") return true;
  if (specRequestReviewMode === "context") {
    return activePendingReviewRequests.length <= 1;
  }
  return true;
}

function applySpecRequestReviewLayoutMode() {
  if (!specRequestReviewModal) return;
  const single = isSpecRequestReviewSingleLayout();
  specRequestReviewModal.classList.toggle("spec-request-modal--single", single);
  specRequestReviewModal.classList.toggle("spec-request-modal--multi", !single);
}

function renderSpecRequestReviewSummary(request) {
  if (!specRequestReviewSummary) return;
  if (!request) {
    specRequestReviewSummary.innerHTML = "";
    specRequestReviewSummary.classList.add("hidden");
    return;
  }

  const routeLabel =
    getRequestOriginalRouteLabel(request) ||
    String(request.review_route_label ?? request.request_scope ?? "—");
  const isSingle = isSpecRequestReviewSingleLayout();

  const pairHtml = (label, value, rowClass = "") =>
    `<span class="spec-request-summary-pair ${rowClass}"><span class="spec-request-meta-label">${esc(label)}:</span><span class="spec-request-meta-value">${esc(String(value ?? "—"))}</span></span>`;

  const primaryPairs = [
    ...(isSingle
      ? []
      : [["Request ID", String(getPendingRequestId(request) || "—")]]),
    ["Test", getPendingRequestTestName(request)],
    ["Route", routeLabel],
  ];

  const secondaryPairs = [
    ["Entity", getPendingRequestSubjectLabel(request)],
    ["Requested By", getPendingRequestRequestedBy(request)],
    ["Requested At", getPendingRequestRequestedAt(request)],
    ["Source Analysis", getPendingRequestSourceAnalysisNo(request)],
  ];

  specRequestReviewSummary.innerHTML = `<div class="spec-request-summary-row spec-request-summary-row-primary">${primaryPairs.map(([label, value]) => pairHtml(label, value)).join("")}</div>
    <div class="spec-request-summary-row spec-request-summary-row-secondary">${secondaryPairs.map(([label, value]) => pairHtml(label, value)).join("")}</div>`;
  specRequestReviewSummary.classList.toggle("hidden", !isSingle);
}

function renderSpecRequestComparisonHtml(request) {
  return `<section class="spec-request-panel">
    <div class="spec-request-section-title">Specification Comparison</div>
    <div class="spec-request-detail-grid">
      <div class="spec-request-card spec-request-card-current">
        <div class="spec-request-card-title"><span class="spec-request-card-role spec-request-card-role-current">Current</span>Existing / Current</div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentType(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Display</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentReference(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Method</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentMethod(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Unit</div><div class="spec-request-kv-value">${esc(getPendingRequestCurrentUom(request))}</div></div>
        </div>
      </div>
      <div class="spec-request-card spec-request-card-proposed">
        <div class="spec-request-card-title"><span class="spec-request-card-role spec-request-card-role-proposed">Proposed</span>Requested Change</div>
        <div class="spec-request-card-value">
          <div class="spec-request-kv"><div class="spec-request-kv-label">Spec Type</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedType(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Display</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedReference(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Method</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedMethod(request))}</div></div>
          <div class="spec-request-kv"><div class="spec-request-kv-label">Unit</div><div class="spec-request-kv-value">${esc(getPendingRequestProposedUom(request))}</div></div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderSpecRequestRequestRemarksPanel(request) {
  const remarks = getPendingRequestRemarks(request);
  if (!remarks || remarks === "—") return "";
  return `<section class="spec-request-panel spec-request-panel-muted">
    <div class="spec-request-section-title">Request Remarks</div>
    <div class="spec-request-meta-value">${esc(remarks)}</div>
  </section>`;
}

function renderSpecRequestReviewMetadataFallback(request) {
  return `<div class="spec-request-section-title">Request Metadata</div>
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
    </div>`;
}

function renderSpecRequestReviewModal() {
  applySpecRequestReviewLayoutMode();
  renderSpecRequestReviewList();
  const request = getSelectedPendingReviewRequest();
  renderSpecRequestReviewSummary(request);
  renderSpecRequestReviewDetail();
  renderSpecRequestRouteDecision(request);
  const hasSelection = !!request;
  const busy = specRequestReviewInFlight;
  const showNextButtons =
    specRequestReviewMode === "reviewQueue" && hasSelection;
  if (specRequestApproveBtn) {
    specRequestApproveBtn.disabled = !hasSelection || busy;
  }
  if (specRequestRejectBtn) {
    specRequestRejectBtn.disabled = !hasSelection || busy;
  }
  if (specRequestApproveNextBtn) {
    specRequestApproveNextBtn.classList.toggle("hidden", !showNextButtons);
    specRequestApproveNextBtn.disabled = !hasSelection || busy;
    if (!busy) specRequestApproveNextBtn.textContent = "Approve & Next";
  }
  if (specRequestRejectNextBtn) {
    specRequestRejectNextBtn.classList.toggle("hidden", !showNextButtons);
    specRequestRejectNextBtn.disabled = !hasSelection || busy;
    if (!busy) specRequestRejectNextBtn.textContent = "Reject & Next";
  }
  if (specRequestReviewCancel) {
    specRequestReviewCancel.disabled = busy;
  }
}

function renderSpecRequestReviewList() {
  if (!specRequestReviewList) return;
  if (isSpecRequestReviewSingleLayout()) {
    specRequestReviewList.innerHTML = "";
    return;
  }
  specRequestReviewList.innerHTML = activePendingReviewRequests
    .map((request) => {
      const requestId = String(getPendingRequestId(request));
      const isActive = requestId === String(selectedPendingReviewRequestId);
      const requestType = pickPendingRequestValue(
        request,
        ["request_type", "request_scope"],
        "",
      );
      const sourceSummary = formatReferenceSourceSummary(request);
      const sourceLineHtml = sourceSummary
        ? `<div class="spec-request-item-meta spec-request-item-source">${esc(sourceSummary)}</div>`
        : "";
      return `<button type="button" class="spec-request-item ${isActive ? "active" : ""}" data-request-id="${esc(requestId)}">
        <div class="spec-request-item-title">#${esc(requestId)} · ${esc(getPendingRequestTestName(request))}${
          requestType
            ? ` <span class="spec-request-type-badge">${esc(String(requestType).toUpperCase())}</span>`
            : ""
        }</div>
        <div class="spec-request-item-meta">${esc(getPendingRequestRequestedBy(request))}</div>
        <div class="spec-request-item-meta">${esc(getPendingRequestRequestedAt(request))}</div>
        ${sourceLineHtml}
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
    ${renderSpecRequestComparisonHtml(request)}
    ${buildReferenceSourceDetailSectionHtml(request)}
    ${renderSpecRequestRequestRemarksPanel(request)}
    ${isSpecRequestReviewSingleLayout() ? "" : renderSpecRequestReviewMetadataFallback(request)}
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
  clearReviewQueueRowActiveState();
  specRequestReviewModal?.classList.remove(
    "spec-request-modal--single",
    "spec-request-modal--multi",
  );
  activePendingReviewRequests = [];
  selectedPendingReviewRequestId = null;
  selectedPendingReviewScope = null;
  specRequestReviewMode = null;
  specRequestReviewInFlight = false;
  resetSpecRequestRouteDecisionControls();
  if (specRequestReviewRemarks) {
    specRequestReviewRemarks.value = "";
  }
  if (specRequestReviewSummary) {
    specRequestReviewSummary.innerHTML = "";
    specRequestReviewSummary.classList.add("hidden");
  }
  if (specRequestReviewCancel) {
    specRequestReviewCancel.disabled = false;
  }
  if (specRequestApproveNextBtn) {
    specRequestApproveNextBtn.textContent = "Approve & Next";
    specRequestApproveNextBtn.classList.add("hidden");
    specRequestApproveNextBtn.disabled = false;
  }
  if (specRequestRejectNextBtn) {
    specRequestRejectNextBtn.textContent = "Reject & Next";
    specRequestRejectNextBtn.classList.add("hidden");
    specRequestRejectNextBtn.disabled = false;
  }
}

async function submitSpecRequestReview(action, options = {}) {
  if (specRequestReviewInFlight) return;

  const continueNext =
    options.continueNext === true && specRequestReviewMode === "reviewQueue";
  const approveLabel = "Approve";
  const approveNextLabel = "Approve & Next";
  const rejectLabel = "Reject";
  const rejectNextLabel = "Reject & Next";
  let shouldRefresh = false;
  let shouldContinueNext = false;
  let reviewedRequestIdForNext = null;
  let priorOrderIdsForNext = null;

  console.log("Spec request review clicked", {
    action,
    selectedPendingReviewRequestId,
    selectedPendingReviewScope,
    specRequestReviewMode,
  });

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

    if (specRequestReviewMode === "reviewQueue" && action === "approve") {
      const selectedScope = normalizePendingRequestScope(
        specRequestApplyScope?.value,
      );
      const routeChanged = isReviewRouteChanged(request, selectedScope);
      const routeChangeRemarks =
        specRequestRouteChangeRemarks?.value.trim() || "";
      if (routeChanged && !routeChangeRemarks) {
        toast(
          "Route change remarks are required when applying through a different route.",
          "warn",
        );
        return;
      }
    }

    const payload = buildSpecChangeRequestDecisionPayload({
      action,
      mode: specRequestReviewMode,
      request,
      userId: userData.user.id,
      requestId: numericRequestId,
      reviewRemarks,
    });

    if (
      action === "approve" &&
      !isValidSpecChangeApplyScope(payload.p_apply_scope)
    ) {
      toast(
        "Cannot approve: request route scope is missing or invalid.",
        "warn",
      );
      return;
    }

    if (continueNext) {
      reviewedRequestIdForNext = String(rawRequestId);
      priorOrderIdsForNext = getFilteredReviewQueueRows().map((r) =>
        String(r.request_id),
      );
    }

    specRequestReviewInFlight = true;
    if (action === "approve") {
      if (specRequestApproveBtn) specRequestApproveBtn.textContent = "Approving...";
      if (specRequestApproveNextBtn) {
        specRequestApproveNextBtn.textContent = "Approving...";
      }
    }
    if (action === "reject") {
      if (specRequestRejectBtn) specRequestRejectBtn.textContent = "Rejecting...";
      if (specRequestRejectNextBtn) {
        specRequestRejectNextBtn.textContent = "Rejecting...";
      }
    }
    if (specRequestApproveBtn) specRequestApproveBtn.disabled = true;
    if (specRequestRejectBtn) specRequestRejectBtn.disabled = true;
    if (specRequestApproveNextBtn) specRequestApproveNextBtn.disabled = true;
    if (specRequestRejectNextBtn) specRequestRejectNextBtn.disabled = true;
    if (specRequestReviewCancel) specRequestReviewCancel.disabled = true;

    const rpcName = "fn_review_spec_change_request_decision";

    console.log("Calling RPC", {
      rpcName,
      payload,
      mode: specRequestReviewMode,
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

    if (continueNext) {
      shouldRefresh = true;
      shouldContinueNext = true;
    } else {
      toast(
        action === "approve"
          ? "Specification change request approved."
          : "Specification change request rejected.",
        "success",
      );
      closeSpecRequestReviewModal();
      shouldRefresh = true;
    }
  } catch (err) {
    const message = err?.message || String(err);
    console.error("Spec request review unexpected error", err);
    toast(
      `Failed to ${action === "approve" ? "approve" : "reject"} request: ${message}`,
      "error",
    );
  } finally {
    specRequestReviewInFlight = false;

    if (
      specRequestReviewModal &&
      !specRequestReviewModal.classList.contains("hidden")
    ) {
      const hasSelection = !!getSelectedPendingReviewRequest();
      if (specRequestApproveBtn) {
        specRequestApproveBtn.disabled = !hasSelection;
        specRequestApproveBtn.textContent = approveLabel;
      }
      if (specRequestRejectBtn) {
        specRequestRejectBtn.disabled = !hasSelection;
        specRequestRejectBtn.textContent = rejectLabel;
      }
      if (specRequestApproveNextBtn) {
        specRequestApproveNextBtn.disabled = !hasSelection;
        specRequestApproveNextBtn.textContent = approveNextLabel;
      }
      if (specRequestRejectNextBtn) {
        specRequestRejectNextBtn.disabled = !hasSelection;
        specRequestRejectNextBtn.textContent = rejectNextLabel;
      }
      if (specRequestReviewCancel) {
        specRequestReviewCancel.disabled = false;
      }
      renderSpecRequestReviewModal();
    }

    if (shouldRefresh) {
      await refreshCurrentSpecReviewContext();
      await refreshPendingSpecRequestIndicators({ reload: true });
      await loadReviewQueueCounts();

      if (currentTab === "reviewQueue") {
        await loadReviewQueue();
      }

      await loadChangeHistory();

      if (shouldContinueNext) {
        const nextId = pickNextReviewQueueRequestId(
          reviewedRequestIdForNext,
          priorOrderIdsForNext ?? [],
        );
        const actionWord = action === "approve" ? "approved" : "rejected";
        if (nextId) {
          openReviewQueueRequest(nextId);
          toast(
            `Request ${actionWord}. Opening next pending request.`,
            "info",
            2200,
          );
        } else {
          closeSpecRequestReviewModal();
          toast(
            `Request ${actionWord}. No more pending requests in the current queue.`,
            "success",
            2800,
          );
        }
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

const V_SPEC_PROFILE_DETAIL_SELECT =
  "spec_profile_id, seq_no, test_id, test_name, method_name, display_text, spec_type, min_value, max_value, text_value, target_value, tolerance_value, tolerance_uom_id, tolerance_uom_code, tolerance_uom_name, tolerance_uom_symbol, spec_line_is_active, uom_id, uom_code, uom_name, uom_symbol, protocol_default_spec_type, protocol_spec_type_locked, protocol_spec_type_source, protocol_spec_type_review_note, is_profile_spec_type_exception";

const PROTOCOL_DEFAULT_SPEC_TYPE_LABELS = {
  RANGE: "Range",
  MAX_ONLY: "Max Only",
  MIN_ONLY: "Min Only",
  TEXT: "Text",
  PASS_FAIL: "Pass / Fail",
  TOLERANCE: "Tolerance",
};

const PROTOCOL_SPEC_TYPE_SOURCE_LABELS = {
  AUTO_SINGLE_TYPE: "Auto",
  ADMIN_SET: "Admin Set",
  PROFILE_EXCEPTION_ALLOWED: "Exception Allowed",
  MIGRATED_LEGACY: "Migrated",
  MANUAL_REVIEW: "Review",
  MULTIPLE: "Multiple",
};

function normalizeProtocolDefaultSpecType(specType) {
  const t = String(specType ?? "")
    .trim()
    .toUpperCase();
  if (t === "NMT") return "MAX_ONLY";
  if (t === "NLT") return "MIN_ONLY";
  return t;
}

function formatProtocolDefaultSpecTypeLabel(specType) {
  const normalized = normalizeProtocolDefaultSpecType(specType);
  if (!normalized) return "";
  return PROTOCOL_DEFAULT_SPEC_TYPE_LABELS[normalized] ?? normalized;
}

function formatProtocolSpecTypeSourceLabel(source) {
  const key = String(source ?? "")
    .trim()
    .toUpperCase();
  if (!key) return "";
  return PROTOCOL_SPEC_TYPE_SOURCE_LABELS[key] ?? String(source).trim();
}

function isProtocolSpecTypeLocked(locked) {
  if (locked === true) return true;
  const s = String(locked ?? "")
    .trim()
    .toUpperCase();
  if (s === "TRUE" || s === "READY_LOCKED" || s === "LOCKED") return true;
  return false;
}

function isProtocolExceptionAllowedLine(locked, source) {
  const src = String(source ?? "")
    .trim()
    .toUpperCase();
  const s = String(locked ?? "")
    .trim()
    .toUpperCase();
  if (src === "PROFILE_EXCEPTION_ALLOWED") return true;
  if (
    s === "READY_EXCEPTION_ALLOWED" ||
    s === "PROFILE_EXCEPTION_ALLOWED"
  ) {
    return true;
  }
  if (
    (locked === false || s === "FALSE") &&
    src === "PROFILE_EXCEPTION_ALLOWED"
  ) {
    return true;
  }
  return false;
}

function formatProtocolLockStatusLabel(row) {
  const protocolDefault = normalizeProtocolDefaultSpecType(
    row?.protocol_default_spec_type,
  );
  if (!protocolDefault) return "Not mapped";
  if (
    isProtocolSpecTypeLocked(row?.protocol_spec_type_locked)
  ) {
    return "Locked";
  }
  if (
    isProtocolExceptionAllowedLine(
      row?.protocol_spec_type_locked,
      row?.protocol_spec_type_source,
    )
  ) {
    return "Exception Allowed";
  }
  return "Unlocked";
}

function getBaseSpecLoadedRow(subject, seqNo) {
  const rows =
    subject === "FG"
      ? bsLoadedRows
      : subject === "RM"
        ? rmLoadedRows
        : pmLoadedRows;
  return rows.find((r) => Number(r.seq_no) === Number(seqNo)) ?? null;
}

const BS_VALUES_LATER_DISPLAY_TEXTS = new Set([
  "Specification to be defined",
  "As per approved specification",
]);

function isBsValuesLaterDisplayText(text) {
  return BS_VALUES_LATER_DISPLAY_TEXTS.has(String(text ?? "").trim());
}

function resolveBsValuesLaterDisplayText(currentDisplay) {
  const t = String(currentDisplay ?? "").trim();
  if (isBsValuesLaterDisplayText(t)) return t;
  return "Specification to be defined";
}

function isBlankBsLineValueField(val) {
  if (val == null) return true;
  return String(val).trim() === "";
}

function bsLineHasBlankValuesForSpecType(specType, snapshot) {
  const type = normalizeBaseSpecTypeValue(specType);
  switch (type) {
    case "RANGE":
      return (
        isBlankBsLineValueField(snapshot.min) &&
        isBlankBsLineValueField(snapshot.max)
      );
    case "MAX_ONLY":
      return isBlankBsLineValueField(snapshot.max);
    case "MIN_ONLY":
      return isBlankBsLineValueField(snapshot.min);
    case "EXACT_NUMERIC":
      return isBlankBsLineValueField(snapshot.exact ?? snapshot.min);
    case "TEXT":
    case "PASS_FAIL":
      return isBlankBsLineValueField(snapshot.text);
    case "TOLERANCE":
      return (
        isBlankBsLineValueField(snapshot.target) &&
        isBlankBsLineValueField(snapshot.tolerance)
      );
    default:
      return true;
  }
}

function shouldAutoEnableBsValuesLater(specType, displayText, snapshot) {
  return (
    isBsValuesLaterDisplayText(displayText) &&
    bsLineHasBlankValuesForSpecType(specType, snapshot)
  );
}

function isBsLineValuesLaterMode() {
  return document.getElementById("bsLineModalValuesLater")?.checked === true;
}

function readBsModalToleranceUomId() {
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");
  const raw = String(toleranceUomSel?.value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBsModalTargetUomId() {
  const uomSel = document.getElementById("bsLineModalUom");
  const raw = String(uomSel?.value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBaseSpecEditForRpc(edit) {
  const normalized = { ...edit };
  const specType = normalizeBaseSpecTypeValue(edit?.spec_type);
  if (specType !== "TOLERANCE") return normalized;

  normalized.tolerance_uom_id =
    edit?.tolerance_uom_id != null && String(edit.tolerance_uom_id).trim() !== ""
      ? Number(edit.tolerance_uom_id)
      : null;
  normalized.uom_id =
    edit?.uom_id != null && String(edit.uom_id).trim() !== ""
      ? Number(edit.uom_id)
      : null;

  return normalized;
}

function prepareBaseSpecEditsForRpc(edits) {
  return (edits ?? []).map((edit) => normalizeBaseSpecEditForRpc(edit));
}

const BASE_SPEC_SAVE_BTN_LABEL = "Save Spec";
const BASE_SPEC_SAVE_BTN_SAVING_LABEL = "Saving...";

function isBaseSpecSaveButtonBusy(btn) {
  return btn?.dataset?.baseSpecSaving === "1";
}

function setBaseSpecSaveButtonSaving(btn) {
  if (!btn) return;
  btn.dataset.baseSpecSaving = "1";
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = BASE_SPEC_SAVE_BTN_SAVING_LABEL;
}

function resetBaseSpecSaveButtonState(btn, editedCount = 0) {
  if (!btn) return;
  delete btn.dataset.baseSpecSaving;
  btn.disabled = false;
  btn.classList.remove("loading");
  btn.textContent = BASE_SPEC_SAVE_BTN_LABEL;
  btn.classList.toggle("hidden", editedCount === 0);
}

function needsProfileExceptionConfirmOnApply(selectedSpecType) {
  const ctx = bsLineProtocolContext;
  if (!ctx) return false;
  const protocolDefault = normalizeProtocolDefaultSpecType(
    ctx.protocol_default_spec_type,
  );
  if (!protocolDefault) return false;
  if (
    !isProtocolSpecTypeLocked(ctx.protocol_spec_type_locked)
  ) {
    return false;
  }
  const selected = normalizeBaseSpecTypeValue(selectedSpecType);
  if (!selected || selected === protocolDefault) return false;
  const opened = normalizeBaseSpecTypeValue(bsLineModalOpenedSpecType);
  if (selected === opened) return false;
  return true;
}

function hideBsLineExceptionConfirm(resetAck = true) {
  document.getElementById("bsLineModalExceptionConfirm")?.classList.add("hidden");
  document.getElementById("bsLineModalFooter")?.classList.remove("hidden");
  if (resetAck) bsLineExceptionConfirmAcknowledged = false;
}

function showBsLineExceptionConfirm(protocolDefault, selectedSpecType) {
  const msgEl = document.getElementById("bsLineModalExceptionConfirmMsg");
  const protoLabel = formatProtocolDefaultSpecTypeLabel(protocolDefault);
  const selectedLabel =
    formatProtocolDefaultSpecTypeLabel(selectedSpecType) || selectedSpecType;
  if (msgEl) {
    msgEl.textContent =
      `This creates a base-profile exception. Protocol default is ${protoLabel}, but approved base spec type will be ${selectedLabel}. Continue?`;
  }
  document.getElementById("bsLineModalExceptionConfirm")?.classList.remove(
    "hidden",
  );
  document.getElementById("bsLineModalFooter")?.classList.add("hidden");
  document.getElementById("bsLineModalExceptionConfirmOk")?.focus();
}

function updateBsLineModalProtocolUi() {
  const ctx = bsLineProtocolContext;
  const defaultEl = document.getElementById("bsLineModalProtocolDefault");
  const sourceEl = document.getElementById("bsLineModalProtocolSource");
  const lockEl = document.getElementById("bsLineModalProtocolLock");
  const reviewEl = document.getElementById("bsLineModalProtocolReviewNote");
  const alignEl = document.getElementById("bsLineModalAlignmentStatus");
  const allowedEl = document.getElementById("bsLineModalExceptionAllowedInfo");
  const specTypeSel = document.getElementById("bsLineModalSpecType");
  const specTypeLabel = document.getElementById("bsLineModalSpecTypeLabel");

  setBsLineLabelRequired(specTypeLabel, "Approved Base Spec Type", true);

  if (!ctx) {
    if (defaultEl) defaultEl.textContent = "—";
    if (sourceEl) sourceEl.textContent = "—";
    if (lockEl) lockEl.textContent = "—";
    reviewEl?.classList.add("hidden");
    alignEl?.classList.add("hidden");
    allowedEl?.classList.add("hidden");
    return;
  }

  const protocolDefault = normalizeProtocolDefaultSpecType(
    ctx.protocol_default_spec_type,
  );
  const sourceLabel = formatProtocolSpecTypeSourceLabel(
    ctx.protocol_spec_type_source,
  );
  const lockLabel = formatProtocolLockStatusLabel(ctx);
  const reviewNote = String(ctx.protocol_spec_type_review_note ?? "").trim();
  const tooltip = buildProtocolDefaultTooltip(ctx);

  if (defaultEl) {
    defaultEl.textContent = protocolDefault
      ? formatProtocolDefaultSpecTypeLabel(protocolDefault)
      : "Not mapped";
    if (tooltip) defaultEl.title = tooltip;
    else defaultEl.removeAttribute("title");
  }
  if (sourceEl) {
    sourceEl.textContent = sourceLabel || "—";
  }
  if (lockEl) {
    lockEl.textContent = lockLabel;
  }
  if (reviewEl) {
    if (reviewNote) {
      reviewEl.textContent = reviewNote;
      reviewEl.classList.remove("hidden");
    } else {
      reviewEl.textContent = "";
      reviewEl.classList.add("hidden");
    }
  }

  const selected = normalizeBaseSpecTypeValue(specTypeSel?.value ?? "");
  if (alignEl) {
    if (!protocolDefault) {
      alignEl.classList.add("hidden");
      alignEl.textContent = "";
    } else if (selected === protocolDefault) {
      alignEl.className = "bs-line-alignment-status bs-line-alignment-match";
      alignEl.textContent = "Base spec follows protocol default.";
      alignEl.classList.remove("hidden");
    } else if (selected) {
      alignEl.className = "bs-line-alignment-status bs-line-alignment-exception";
      alignEl.innerHTML =
        '<span class="bs-profile-exception-badge">Profile Exception</span>';
      alignEl.classList.remove("hidden");
    } else {
      alignEl.classList.add("hidden");
      alignEl.textContent = "";
    }
  }

  if (allowedEl) {
    const showAllowed =
      protocolDefault &&
      !isProtocolSpecTypeLocked(ctx.protocol_spec_type_locked) &&
      isProtocolExceptionAllowedLine(
        ctx.protocol_spec_type_locked,
        ctx.protocol_spec_type_source,
      );
    allowedEl.classList.toggle("hidden", !showAllowed);
  }
}

function isBaseLineProfileSpecException(row, pending) {
  if (row.is_profile_spec_type_exception === true) return true;
  const protocolDefault = normalizeProtocolDefaultSpecType(
    row.protocol_default_spec_type,
  );
  if (!protocolDefault) return false;
  const baseType = pending
    ? normalizeBaseSpecTypeValue(pending.spec_type)
    : normalizeBaseSpecTypeValue(row.spec_type ?? "");
  if (!baseType) return false;
  return protocolDefault !== baseType;
}

function buildProtocolDefaultTooltip(row) {
  const parts = [];
  const sourceRaw = String(row.protocol_spec_type_source ?? "").trim();
  const reviewNote = String(row.protocol_spec_type_review_note ?? "").trim();
  const locked = row.protocol_spec_type_locked;
  if (sourceRaw) parts.push(`Source: ${sourceRaw}`);
  if (locked != null && String(locked).trim() !== "") {
    parts.push(`Lock: ${locked}`);
  }
  if (reviewNote) parts.push(`Review: ${reviewNote}`);
  return parts.join(" · ");
}

function renderProtocolDefaultSpecCell(row) {
  const protocolDefault = normalizeProtocolDefaultSpecType(
    row.protocol_default_spec_type,
  );
  const sourceLabel = formatProtocolSpecTypeSourceLabel(
    row.protocol_spec_type_source,
  );
  const tooltip = buildProtocolDefaultTooltip(row);
  const titleAttr = tooltip ? ` title="${esc(tooltip)}"` : "";

  if (!protocolDefault) {
    return `<div class="bs-protocol-default-cell"${titleAttr}>
      <span class="bs-protocol-default-muted">Not mapped</span>
      ${sourceLabel ? `<span class="bs-protocol-source-muted">${esc(sourceLabel)}</span>` : ""}
    </div>`;
  }

  const label = formatProtocolDefaultSpecTypeLabel(protocolDefault);
  return `<div class="bs-protocol-default-cell"${titleAttr}>
    <span class="type-badge type-badge-other bs-protocol-default-badge">${esc(label)}</span>
    ${sourceLabel ? `<span class="bs-protocol-source-muted">${esc(sourceLabel)}</span>` : ""}
  </div>`;
}

function renderBaseSpecTypeCell(row, dispType, pending) {
  const exceptionBadge = isBaseLineProfileSpecException(row, pending)
    ? `<span class="bs-profile-exception-badge" title="Approved base spec differs from protocol default">Profile Exception</span>`
    : "";
  return `<div class="bs-spec-type-cell">
    ${typeBadge(dispType)}
    ${exceptionBadge}
  </div>`;
}

function buildBaseSpecTableRowHtml(row, pending, activeChkClass) {
  const seqNo = row.seq_no;
  const dispType = pending
    ? normalizeBaseSpecTypeValue(pending.spec_type)
    : normalizeBaseSpecTypeValue(row.spec_type ?? "");
  const dispText = pending
    ? (pending.display_text ?? "")
    : (row.display_text ?? "");
  const isActive = pending ? pending.is_active : !!row.spec_line_is_active;
  const origActive = !!row.spec_line_is_active;

  return `<tr data-seq="${esc(String(seqNo))}"
      data-test-id="${esc(String(row.test_id ?? ""))}"
      data-test-name="${esc(row.test_name ?? "")}"
      data-method-name="${esc(row.method_name ?? "")}"
      data-orig-spec-type="${esc(normalizeBaseSpecTypeValue(row.spec_type ?? ""))}"
      data-orig-min="${esc(String(row.min_value ?? ""))}"
      data-orig-max="${esc(String(row.max_value ?? ""))}"
      data-orig-text="${esc(row.text_value ?? "")}"
      data-orig-target="${esc(String(row.target_value ?? ""))}"
      data-orig-tolerance="${esc(String(row.tolerance_value ?? ""))}"
      data-orig-tolerance-uom-id="${esc(String(row.tolerance_uom_id ?? ""))}"
      data-orig-tolerance-uom-code="${esc(row.tolerance_uom_code ?? "")}"
      data-orig-tolerance-uom-name="${esc(row.tolerance_uom_name ?? "")}"
      data-orig-tolerance-uom-symbol="${esc(row.tolerance_uom_symbol ?? "")}"
      data-orig-display="${esc(row.display_text ?? "")}"
      data-orig-uom-id="${esc(String(row.uom_id ?? ""))}"
      data-orig-uom-symbol="${esc(row.uom_symbol ?? "")}"
      data-orig-active="${origActive ? "1" : "0"}"
      class="${isActive ? "" : "bs-row-inactive"}">
    <td class="td-seq">${esc(String(seqNo))}</td>
    <td class="td-test">${esc(row.test_name ?? "")}</td>
    <td class="td-method">${esc(row.method_name ?? "")}</td>
    <td>${renderProtocolDefaultSpecCell(row)}</td>
    <td>${renderBaseSpecTypeCell(row, dispType, pending)}</td>
    <td class="bs-display-text-cell${pending ? " pending" : ""}">${esc(dispText)}</td>
    <td class="td-active">
      <input class="spec-active ${activeChkClass}" type="checkbox"
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
}

async function bsLoadSpecLines(profileId) {
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(V_SPEC_PROFILE_DETAIL_SELECT)
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
    bsTableBody.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    bsSyncSaveBtn();
    return;
  }

  bsTableBody.innerHTML = rows
    .map((r) =>
      buildBaseSpecTableRowHtml(
        r,
        bsEditedSpecLines.get(r.seq_no),
        "bs-active-chk",
      ),
    )
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
          target_value:
            tr.dataset.origTarget !== ""
              ? Number(tr.dataset.origTarget)
              : null,
          tolerance_value:
            tr.dataset.origTolerance !== ""
              ? Number(tr.dataset.origTolerance)
              : null,
          tolerance_uom_id:
            tr.dataset.origToleranceUomId !== ""
              ? Number(tr.dataset.origToleranceUomId)
              : null,
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
  if (isBaseSpecSaveButtonBusy(btn)) return;
  setBaseSpecSaveButtonSaving(btn);
  try {
    const edits = prepareBaseSpecEditsForRpc(
      Array.from(bsEditedSpecLines.values()),
    );
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
  } catch (err) {
    toast("Save failed: " + (err?.message ?? String(err)), "error");
  } finally {
    resetBaseSpecSaveButtonState(btn, bsEditedSpecLines.size);
  }
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
    .select(V_SPEC_PROFILE_DETAIL_SELECT)
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
    rmTableBody.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    rmSyncSaveBtn();
    return;
  }

  rmTableBody.innerHTML = rows
    .map((r) =>
      buildBaseSpecTableRowHtml(
        r,
        rmEditedSpecLines.get(r.seq_no),
        "rm-active-chk",
      ),
    )
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
          target_value:
            tr.dataset.origTarget !== ""
              ? Number(tr.dataset.origTarget)
              : null,
          tolerance_value:
            tr.dataset.origTolerance !== ""
              ? Number(tr.dataset.origTolerance)
              : null,
          tolerance_uom_id:
            tr.dataset.origToleranceUomId !== ""
              ? Number(tr.dataset.origToleranceUomId)
              : null,
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
  if (isBaseSpecSaveButtonBusy(btn)) return;
  setBaseSpecSaveButtonSaving(btn);
  try {
    const edits = prepareBaseSpecEditsForRpc(
      Array.from(rmEditedSpecLines.values()),
    );
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
  } catch (err) {
    toast("Save failed: " + (err?.message ?? String(err)), "error");
  } finally {
    resetBaseSpecSaveButtonState(btn, rmEditedSpecLines.size);
  }
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
    .select(V_SPEC_PROFILE_DETAIL_SELECT)
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
    pmTableBodyEl.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    pmSyncSaveBtn();
    return;
  }

  pmTableBodyEl.innerHTML = rows
    .map((r) =>
      buildBaseSpecTableRowHtml(
        r,
        pmEditedSpecLines.get(r.seq_no),
        "pm-active-chk",
      ),
    )
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
          target_value:
            tr.dataset.origTarget !== ""
              ? Number(tr.dataset.origTarget)
              : null,
          tolerance_value:
            tr.dataset.origTolerance !== ""
              ? Number(tr.dataset.origTolerance)
              : null,
          tolerance_uom_id:
            tr.dataset.origToleranceUomId !== ""
              ? Number(tr.dataset.origToleranceUomId)
              : null,
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
  if (isBaseSpecSaveButtonBusy(btn)) return;
  setBaseSpecSaveButtonSaving(btn);
  try {
    const edits = prepareBaseSpecEditsForRpc(
      Array.from(pmEditedSpecLines.values()),
    );
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
  } catch (err) {
    toast("Save failed: " + (err?.message ?? String(err)), "error");
  } finally {
    resetBaseSpecSaveButtonState(btn, pmEditedSpecLines.size);
  }
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
      "id, test_id, action_type, override_method_id, override_spec_type, override_min_value, override_max_value, override_text_value, override_target_value, override_tolerance_value, override_tolerance_uom_id, override_display_text, override_is_required, override_uom_id, is_active, reason",
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
      "id, test_id, action_type, override_method_id, override_spec_type, override_min_value, override_max_value, override_text_value, override_target_value, override_tolerance_value, override_tolerance_uom_id, override_display_text, override_is_required, override_uom_id, is_active, reason",
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
      "id, test_id, action_type, override_method_id, override_spec_type, override_min_value, override_max_value, override_text_value, override_target_value, override_tolerance_value, override_tolerance_uom_id, override_display_text, override_is_required, override_uom_id, is_active, reason",
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
  const targetEl = document.getElementById("bsLineModalTarget");
  const toleranceEl = document.getElementById("bsLineModalTolerance");
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");

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
    hideBsLineExceptionConfirm();
    updateBsLineModalProtocolUi();
  });

  document
    .getElementById("bsLineModalValuesLater")
    ?.addEventListener("change", () => {
      const displayEl = document.getElementById("bsLineModalDisplayText");
      if (isBsLineValuesLaterMode()) {
        displayEl.dataset.valuesLaterDisplayText = resolveBsValuesLaterDisplayText(
          displayEl.value,
        );
      } else {
        delete displayEl.dataset.valuesLaterDisplayText;
      }
      applyBaseSpecTypeUI();
      buildBsDisplayText();
      hideBsLineExceptionConfirm();
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
  targetEl?.addEventListener("input", () => {
    buildBsDisplayText();
  });
  toleranceEl?.addEventListener("input", () => {
    buildBsDisplayText();
  });
  toleranceUomSel?.addEventListener("change", () => {
    buildBsDisplayText();
  });

  applyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveBsLineModal();
  });

  document
    .getElementById("bsLineModalExceptionConfirmCancel")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBsLineExceptionConfirm();
    });
  document
    .getElementById("bsLineModalExceptionConfirmOk")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      bsLineExceptionConfirmAcknowledged = true;
      hideBsLineExceptionConfirm(false);
      saveBsLineModal();
    });
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
  const targetEl = document.getElementById("bsLineModalTarget");
  const toleranceEl = document.getElementById("bsLineModalTolerance");
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");

  bsLineCurrentSubject = subject;
  bsLineCurrentSeqNo = seqNo;
  bsLineProtocolContext = getBaseSpecLoadedRow(subject, seqNo);
  bsLineModalOpenedSpecType = null;
  hideBsLineExceptionConfirm();

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
  const curTarget =
    existing?.target_value != null
      ? String(existing.target_value)
      : (tr.dataset.origTarget ?? "");
  const curTolerance =
    existing?.tolerance_value != null
      ? String(existing.tolerance_value)
      : (tr.dataset.origTolerance ?? "");
  const curToleranceUomId =
    existing?.tolerance_uom_id != null
      ? String(existing.tolerance_uom_id)
      : (tr.dataset.origToleranceUomId ?? "");
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

  const curUomId = pendingUomId || specLineUomId || testDefaultUomId || "";

  await loadLabUoms();
  populateLabUomSelect(uomSel, curUomId);
  populateLabUomSelect(toleranceUomSel, curToleranceUomId);
  if (toleranceUomSel) {
    toleranceUomSel.dataset.displaySymbol =
      tr.dataset.origToleranceUomSymbol ?? "";
    toleranceUomSel.dataset.displayCode = tr.dataset.origToleranceUomCode ?? "";
  }

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
      <option value="TOLERANCE">Tolerance (target ± value)</option>
    `;
  }

  // Set selected spec type
  if ([...specTypeSel.options].some((o) => o.value === curSpecType)) {
    specTypeSel.value = curSpecType;
  } else if (specTypeSel.options.length) {
    specTypeSel.value = specTypeSel.options[0].value;
  }
  bsLineModalOpenedSpecType = normalizeBaseSpecTypeValue(specTypeSel.value);
  specTypeSel.disabled = false;
  specTypeSel.title =
    "Select the approved base specification type for this profile line.";

  // Pre-fill value fields
  minEl.value = curMin;
  maxEl.value = curMax;
  exactEl.value = curSpecType === "EXACT_NUMERIC" ? curMin : "";
  textEl.value = curText;
  targetEl.value = curTarget;
  toleranceEl.value = curTolerance;
  passFailSel.value = curText || "PASS";
  displayEl.value = curDisplay;
  activeChk.checked = curActive;

  const valuesLaterChk = document.getElementById("bsLineModalValuesLater");
  const valueSnapshot = {
    min: curMin,
    max: curMax,
    exact: curSpecType === "EXACT_NUMERIC" ? curMin : "",
    text: curText,
    target: curTarget,
    tolerance: curTolerance,
    toleranceUomId: curToleranceUomId,
  };
  if (valuesLaterChk) {
    valuesLaterChk.checked = shouldAutoEnableBsValuesLater(
      curSpecType,
      curDisplay,
      valueSnapshot,
    );
  }
  if (isBsValuesLaterDisplayText(curDisplay)) {
    displayEl.dataset.valuesLaterDisplayText = String(curDisplay).trim();
  } else {
    delete displayEl.dataset.valuesLaterDisplayText;
  }

  applyBaseSpecTypeUI();
  buildBsDisplayText();
  updateBsLineModalProtocolUi();

  modal.classList.remove("hidden");
}

function closeBsLineModal() {
  document.getElementById("bsLineModal").classList.add("hidden");
  bsLineCurrentSubject = null;
  bsLineCurrentSeqNo = null;
  bsLineProtocolContext = null;
  bsLineModalOpenedSpecType = null;
  const valuesLaterChk = document.getElementById("bsLineModalValuesLater");
  if (valuesLaterChk) valuesLaterChk.checked = false;
  document.getElementById("bsLineModalValuesLaterNote")?.classList.add("hidden");
  const displayEl = document.getElementById("bsLineModalDisplayText");
  if (displayEl) delete displayEl.dataset.valuesLaterDisplayText;
  hideBsLineExceptionConfirm();
}

function setBsLineLabelRequired(labelEl, text, required) {
  if (!labelEl) return;
  labelEl.textContent = text;
  const existing = labelEl.querySelector(".bs-line-req");
  if (existing) existing.remove();
  if (required) {
    const mark = document.createElement("span");
    mark.className = "bs-line-req";
    mark.style.color = "#ef4444";
    mark.textContent = " *";
    mark.setAttribute("aria-hidden", "true");
    labelEl.appendChild(mark);
  }
}

function setBsToleranceSubfieldVisibility(
  showTarget,
  showToleranceValue,
  showToleranceUom,
) {
  const targetEl = document.getElementById("bsLineModalTarget");
  const toleranceEl = document.getElementById("bsLineModalTolerance");
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");
  targetEl?.closest(".form-group")?.classList.toggle("hidden", !showTarget);
  toleranceEl
    ?.closest(".form-group")
    ?.classList.toggle("hidden", !showToleranceValue);
  toleranceUomSel
    ?.closest(".form-group")
    ?.classList.toggle("hidden", !showToleranceUom);
}

const BS_TARGET_UOM_LABEL_DEFAULT =
  "Unit of Measure (default from Test Master; editable for family-specific specification)";
const BS_TARGET_UOM_LABEL_TOLERANCE =
  "Target / Result UOM (optional; recommended)";
const BS_TARGET_UOM_LABEL_TOLERANCE_DEFERRED =
  "Target / Result UOM (optional reference metadata)";

function positionBsTargetUomForTolerance(inToleranceRow) {
  const uomRow = document.getElementById("bsLineModalUomRow");
  const home = document.getElementById("bsLineModalUomHome");
  const targetField = document
    .getElementById("bsLineModalTarget")
    ?.closest(".form-group");
  if (!uomRow || !home) return;
  if (inToleranceRow && targetField) {
    targetField.insertAdjacentElement("afterend", uomRow);
  } else {
    home.insertAdjacentElement("afterend", uomRow);
  }
}

function setBsTargetUomRowLabel(text) {
  const uomRowLabel = document.querySelector(
    "#bsLineModalUomRow label[for='bsLineModalUom']",
  );
  if (uomRowLabel) uomRowLabel.textContent = text;
}

function applyBaseSpecTypeUI() {
  const specType = document.getElementById("bsLineModalSpecType").value;
  const minMaxRow = document.getElementById("bsLineModalMinMaxRow");
  const exactRow = document.getElementById("bsLineModalExactRow");
  const textRow = document.getElementById("bsLineModalTextRow");
  const passFailRow = document.getElementById("bsLineModalPassFailRow");
  const toleranceRow = document.getElementById("bsLineModalToleranceRow");
  const uomRow = document.getElementById("bsLineModalUomRow");
  const uomSel = document.getElementById("bsLineModalUom");
  const minEl = document.getElementById("bsLineModalMin");
  const maxEl = document.getElementById("bsLineModalMax");
  const exactEl = document.getElementById("bsLineModalExact");
  const textEl = document.getElementById("bsLineModalText");
  const passFailSel = document.getElementById("bsLineModalPassFail");
  const targetEl = document.getElementById("bsLineModalTarget");
  const toleranceEl = document.getElementById("bsLineModalTolerance");
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");
  const minLabel = document.getElementById("bsLineModalMinLabel");
  const maxLabel = document.getElementById("bsLineModalMaxLabel");
  const targetLabel = document.getElementById("bsLineModalTargetLabel");
  const toleranceLabel = document.getElementById("bsLineModalToleranceLabel");
  const toleranceUomLabel = document.getElementById(
    "bsLineModalToleranceUomLabel",
  );
  const exactLabel = document.getElementById("bsLineModalExactLabel");
  const textLabel = document.getElementById("bsLineModalTextLabel");
  const passFailLabel = document.getElementById("bsLineModalPassFailLabel");
  const valuesLaterNote = document.getElementById("bsLineModalValuesLaterNote");
  const isTolerance = normalizeBaseSpecTypeValue(specType) === "TOLERANCE";

  setBsToleranceSubfieldVisibility(true, true, true);

  valuesLaterNote?.classList.toggle("hidden", !isBsLineValuesLaterMode());
  if (valuesLaterNote && isBsLineValuesLaterMode()) {
    valuesLaterNote.textContent = isTolerance
      ? "Values will remain to be defined. Target/result UOM and tolerance UOM can be selected separately as reference metadata."
      : "Only the approved spec expression will be changed. Values will remain reference-defined/to be defined.";
  }

  if (isBsLineValuesLaterMode()) {
    [minMaxRow, exactRow, textRow, passFailRow].forEach((r) =>
      r?.classList.add("hidden"),
    );
    [
      minEl,
      maxEl,
      exactEl,
      textEl,
      passFailSel,
      targetEl,
      toleranceEl,
    ].forEach((el) => {
      if (el) el.disabled = true;
    });
    setBsLineLabelRequired(minLabel, "Min Value (NLT)", false);
    setBsLineLabelRequired(maxLabel, "Max Value (NMT)", false);
    setBsLineLabelRequired(targetLabel, "Target Value", false);
    setBsLineLabelRequired(toleranceLabel, "Tolerance Value", false);
    setBsLineLabelRequired(toleranceUomLabel, "Tolerance UOM", false);
    setBsLineLabelRequired(exactLabel, "Exact Value", false);
    setBsLineLabelRequired(textLabel, "Text Value", false);
    setBsLineLabelRequired(passFailLabel, "Expected Result", false);

    if (isTolerance) {
      toleranceRow?.classList.remove("hidden");
      setBsToleranceSubfieldVisibility(false, false, true);
      positionBsTargetUomForTolerance(true);
      uomRow?.classList.remove("hidden");
      if (uomSel) uomSel.disabled = false;
      if (toleranceUomSel) toleranceUomSel.disabled = false;
      setBsTargetUomRowLabel(BS_TARGET_UOM_LABEL_TOLERANCE_DEFERRED);
    } else {
      positionBsTargetUomForTolerance(false);
      uomRow?.classList.add("hidden");
      if (uomSel) uomSel.disabled = true;
      toleranceRow?.classList.add("hidden");
      if (toleranceUomSel) toleranceUomSel.disabled = true;
    }
    return;
  }

  positionBsTargetUomForTolerance(false);

  [minMaxRow, exactRow, textRow, passFailRow, toleranceRow].forEach((r) =>
    r?.classList.add("hidden"),
  );
  [minEl, maxEl, exactEl, textEl, passFailSel, targetEl, toleranceEl].forEach(
    (el) => {
      if (el) el.disabled = true;
    },
  );
  if (toleranceUomSel) toleranceUomSel.disabled = true;

  setBsLineLabelRequired(minLabel, "Min Value (NLT)", false);
  setBsLineLabelRequired(maxLabel, "Max Value (NMT)", false);
  setBsLineLabelRequired(targetLabel, "Target Value", false);
  setBsLineLabelRequired(toleranceLabel, "Tolerance Value", false);
  setBsLineLabelRequired(toleranceUomLabel, "Tolerance UOM", false);
  setBsLineLabelRequired(exactLabel, "Exact Value", false);
  setBsLineLabelRequired(textLabel, "Text Value", false);
  setBsLineLabelRequired(passFailLabel, "Expected Result", false);

  minEl.value =
    specType === "MIN_ONLY" || specType === "RANGE" ? minEl.value : "";
  maxEl.value =
    specType === "MAX_ONLY" || specType === "RANGE" ? maxEl.value : "";
  if (specType !== "EXACT_NUMERIC") exactEl.value = "";
  if (specType !== "TEXT") textEl.value = "";
  if (specType !== "PASS_FAIL") passFailSel.value = "PASS";
  if (specType !== "TOLERANCE") {
    if (targetEl) targetEl.value = "";
    if (toleranceEl) toleranceEl.value = "";
    if (toleranceUomSel) toleranceUomSel.value = "";
  }

  if (specType === "TOLERANCE") {
    positionBsTargetUomForTolerance(true);
    if (uomRow) uomRow.classList.remove("hidden");
    if (uomSel) uomSel.disabled = false;
    setBsTargetUomRowLabel(BS_TARGET_UOM_LABEL_TOLERANCE);
  } else {
    positionBsTargetUomForTolerance(false);
    if (uomSel) uomSel.disabled = false;
    if (uomRow) uomRow.classList.remove("hidden");
    setBsTargetUomRowLabel(BS_TARGET_UOM_LABEL_DEFAULT);
  }

  switch (specType) {
    case "RANGE":
      minMaxRow.classList.remove("hidden");
      setBsLineLabelRequired(minLabel, "Min Value (NLT)", true);
      setBsLineLabelRequired(maxLabel, "Max Value (NMT)", true);
      minEl.disabled = false;
      maxEl.disabled = false;
      break;
    case "MAX_ONLY":
      minMaxRow.classList.remove("hidden");
      setBsLineLabelRequired(maxLabel, "Max Value (NMT)", true);
      minEl.value = "";
      minEl.disabled = true;
      maxEl.disabled = false;
      break;
    case "MIN_ONLY":
      minMaxRow.classList.remove("hidden");
      setBsLineLabelRequired(minLabel, "Min Value (NLT)", true);
      maxEl.value = "";
      minEl.disabled = false;
      maxEl.disabled = true;
      break;
    case "EXACT_NUMERIC":
      exactRow.classList.remove("hidden");
      setBsLineLabelRequired(exactLabel, "Exact Value", true);
      exactEl.disabled = false;
      break;
    case "TEXT":
      textRow.classList.remove("hidden");
      setBsLineLabelRequired(textLabel, "Text Value", true);
      textEl.disabled = false;
      break;
    case "PASS_FAIL":
      passFailRow.classList.remove("hidden");
      passFailSel.disabled = false;
      break;
    case "TOLERANCE":
      toleranceRow?.classList.remove("hidden");
      setBsLineLabelRequired(targetLabel, "Target Value", true);
      setBsLineLabelRequired(toleranceLabel, "Tolerance Value", true);
      setBsLineLabelRequired(toleranceUomLabel, "Tolerance UOM", true);
      if (targetEl) targetEl.disabled = false;
      if (toleranceEl) toleranceEl.disabled = false;
      if (toleranceUomSel) toleranceUomSel.disabled = false;
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
  const targetEl = document.getElementById("bsLineModalTarget");
  const toleranceEl = document.getElementById("bsLineModalTolerance");
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");
  const uomSel = document.getElementById("bsLineModalUom");
  const displayEl = document.getElementById("bsLineModalDisplayText");
  const preview = document.getElementById("bsLineModalDisplayPreview");

  if (isBsLineValuesLaterMode()) {
    const valuesLaterText = resolveBsValuesLaterDisplayText(
      displayEl.dataset.valuesLaterDisplayText || displayEl.value,
    );
    displayEl.value = valuesLaterText;
    preview.textContent = valuesLaterText || "—";
    return;
  }

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
    case "TOLERANCE":
      generated = buildToleranceDisplayText(
        targetEl?.value.trim() ?? "",
        toleranceEl?.value.trim() ?? "",
        selectedUomSymbol(uomSel),
        selectedToleranceUomSymbol(toleranceUomSel),
      );
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
  const targetEl = document.getElementById("bsLineModalTarget");
  const toleranceEl = document.getElementById("bsLineModalTolerance");
  const toleranceUomSel = document.getElementById("bsLineModalToleranceUom");
  const displayEl = document.getElementById("bsLineModalDisplayText");
  const activeChk = document.getElementById("bsLineModalActive");
  const errEl = document.getElementById("bsLineModalError");

  errEl.classList.add("hidden");
  errEl.textContent = "";

  const specType = normalizeBaseSpecTypeValue(specTypeSel.value);
  if (!specType) {
    showBanner(errEl, "error", "Approved Base Spec Type is required.");
    return;
  }

  const valuesLater = isBsLineValuesLaterMode();

  // Collect and validate values per spec type
  let minValue = null;
  let maxValue = null;
  let textValue = null;
  let targetValue = null;
  let toleranceValue = null;
  let toleranceUomId = null;

  if (valuesLater) {
    if (specType === "TOLERANCE") {
      toleranceUomId = readBsModalToleranceUomId();
    }
  } else {
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
      case "TOLERANCE":
        if (!targetEl?.value.trim() || !toleranceEl?.value.trim()) {
          showBanner(
            errEl,
            "error",
            "TOLERANCE requires Target Value and Tolerance Value.",
          );
          return;
        }
        if (!toleranceUomSel?.value) {
          showBanner(
            errEl,
            "error",
            "Tolerance UOM is required for tolerance specifications.",
          );
          return;
        }
        targetValue = Number(targetEl.value);
        toleranceValue = Number(toleranceEl.value);
        toleranceUomId = Number(toleranceUomSel.value);
        minValue = null;
        maxValue = null;
        textValue = null;
        break;
    }
  }

  if (
    needsProfileExceptionConfirmOnApply(specType) &&
    !bsLineExceptionConfirmAcknowledged
  ) {
    const protocolDefault = normalizeProtocolDefaultSpecType(
      bsLineProtocolContext?.protocol_default_spec_type,
    );
    showBsLineExceptionConfirm(protocolDefault, specType);
    return;
  }

  buildBsDisplayText();
  const displayText = valuesLater
    ? resolveBsValuesLaterDisplayText(
        displayEl.dataset.valuesLaterDisplayText || displayEl.value,
      )
    : displayEl.value.trim();
  let uomId = null;
  let uomRow = null;
  if (specType === "TOLERANCE") {
    uomId = readBsModalTargetUomId();
    uomRow = uomId
      ? (labUomRows ?? []).find((u) => Number(u.id) === uomId)
      : null;
  } else if (!valuesLater) {
    uomId = uomSel.value ? Number(uomSel.value) : null;
    uomRow = (labUomRows ?? []).find((u) => Number(u.id) === uomId);
  }
  const isActive = activeChk.checked;
  const seqNo = bsLineCurrentSeqNo;

  commitBsLineModalEdits({
    specType,
    minValue,
    maxValue,
    textValue,
    targetValue,
    toleranceValue,
    toleranceUomId,
    displayText,
    uomId,
    uomSymbol: uomRow?.symbol ?? null,
    isActive,
    seqNo,
  });
}

function commitBsLineModalEdits({
  specType,
  minValue,
  maxValue,
  textValue,
  targetValue,
  toleranceValue,
  toleranceUomId,
  displayText,
  uomId,
  uomSymbol,
  isActive,
  seqNo,
}) {
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
  const origTarget =
    tr?.dataset.origTarget !== undefined && tr.dataset.origTarget !== ""
      ? Number(tr.dataset.origTarget)
      : null;
  const origTolerance =
    tr?.dataset.origTolerance !== undefined && tr.dataset.origTolerance !== ""
      ? Number(tr.dataset.origTolerance)
      : null;
  const origToleranceUomId = tr?.dataset.origToleranceUomId
    ? Number(tr.dataset.origToleranceUomId)
    : null;
  const origDisplay = tr?.dataset.origDisplay || null;
  const origUomId = tr?.dataset.origUomId ? Number(tr.dataset.origUomId) : null;
  const origActive = tr?.dataset.origActive === "1";

  const hasChanged =
    specType !== origSpecType ||
    minValue !== origMin ||
    maxValue !== origMax ||
    textValue !== origText ||
    targetValue !== origTarget ||
    toleranceValue !== origTolerance ||
    toleranceUomId !== origToleranceUomId ||
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
      target_value: targetValue,
      tolerance_value: toleranceValue,
      tolerance_uom_id: toleranceUomId,
      uom_id: uomId,
      uom_symbol: uomSymbol,
      display_text: displayText,
      is_active: isActive,
    });
  }

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
      ["TOLERANCE", "TOLERANCE — target ± tolerance"],
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
    mode === "edit" && row
      ? String(
          String(row.override_spec_type ?? "").toUpperCase() === "TOLERANCE"
            ? (row.override_tolerance_uom_id ?? row.override_uom_id ?? "")
            : (row.override_uom_id ?? ""),
        )
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
      target: String(row.override_target_value ?? ""),
      tolerance: String(row.override_tolerance_value ?? ""),
      toleranceUomId:
        row.override_tolerance_uom_id != null
          ? String(row.override_tolerance_uom_id)
          : "",
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
    ovModalPrefill = { min: "", max: "", text: "", exact: "", target: "", tolerance: "", toleranceUomId: "" };
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

function updateOverrideUomRowVisibility() {
  const specType = document.getElementById("ovModalSpecType")?.value;
  const uomRow = document.getElementById("ovModalUomRow");
  const uomSel = document.getElementById("ovModalUom");
  const uomLabel = document.getElementById("ovModalUomLabel");
  if (!uomRow || !uomSel) return;
  uomRow.classList.remove("hidden");
  uomSel.disabled = false;
  if (uomLabel) {
    uomLabel.textContent =
      specType === "TOLERANCE"
        ? BS_TARGET_UOM_LABEL_TOLERANCE
        : "Unit of Measure";
  }
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
  const { min, max, text, exact, target, tolerance, toleranceUomId } =
    ovModalPrefill;

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
  } else if (specType === "TOLERANCE") {
    // TOLERANCE override: target ± tolerance with separate tolerance UOM
    html = `
      <div class="form-group">
        <label for="ovModalTarget">Target Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalTarget" class="form-control" step="any" placeholder="e.g. 500" value="${esc(target)}">
      </div>
      <div class="form-group">
        <label for="ovModalTolerance">Tolerance Value <span style="color:#ef4444">*</span></label>
        <input type="number" id="ovModalTolerance" class="form-control" step="any" placeholder="e.g. 10" value="${esc(tolerance)}">
      </div>
      <div class="form-group">
        <label for="ovModalToleranceUom">Tolerance UOM <span style="color:#ef4444">*</span></label>
        <select id="ovModalToleranceUom" class="form-control"></select>
      </div>`;
  }
  dyn.innerHTML = html;

  if (specType === "TOLERANCE") {
    populateLabUomSelect(
      document.getElementById("ovModalToleranceUom"),
      toleranceUomId,
    );
  }

  updateOverrideUomRowVisibility();

  // Wire value inputs for live display-text preview
  [
    "ovModalMin",
    "ovModalMax",
    "ovModalText",
    "ovModalExact",
    "ovModalTarget",
    "ovModalTolerance",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateDisplayText);
  });
  document
    .getElementById("ovModalToleranceUom")
    ?.addEventListener("change", updateDisplayText);
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
  } else if (specType === "TOLERANCE") {
    const targetV = document.getElementById("ovModalTarget")?.value.trim();
    const tolV = document.getElementById("ovModalTolerance")?.value.trim();
    const tolUomSel = document.getElementById("ovModalToleranceUom");
    const uomSel = document.getElementById("ovModalUom");
    text = buildToleranceDisplayText(
      targetV,
      tolV,
      selectedUomSymbol(uomSel),
      selectedToleranceUomSymbol(tolUomSel),
    );
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

async function resolveOverrideMethodIdForSave(testId, actionType) {
  const numericTestId = Number(testId);
  if (!numericTestId) return null;

  const normalizedAction = String(actionType ?? "").trim().toLowerCase();

  if (
    ovBaseSpecProfileId &&
    (normalizedAction === "modify" || normalizedAction === "disable")
  ) {
    const { data: baseLine, error: baseErr } = await labSupabase
      .from("spec_line")
      .select("method_id")
      .eq("spec_profile_id", Number(ovBaseSpecProfileId))
      .eq("test_id", numericTestId)
      .eq("is_active", true)
      .maybeSingle();

    if (baseErr) throw baseErr;

    if (baseLine?.method_id) {
      return Number(baseLine.method_id);
    }
  }

  const { data: viewRows, error: viewErr } = await labSupabase
    .from("v_test_with_default_method")
    .select("id, test_id, default_method_id")
    .or(`id.eq.${numericTestId},test_id.eq.${numericTestId}`)
    .limit(1);

  if (!viewErr) {
    const row = Array.isArray(viewRows) ? viewRows[0] : null;
    if (row?.default_method_id) {
      return Number(row.default_method_id);
    }
  }

  const { data: mapRows, error: mapErr } = await labSupabase
    .from("test_default_method_map")
    .select("method_id")
    .eq("test_id", numericTestId)
    .eq("is_active", true)
    .limit(1);

  if (mapErr) throw mapErr;

  const mappedMethodId = Array.isArray(mapRows)
    ? mapRows[0]?.method_id
    : null;

  return mappedMethodId ? Number(mappedMethodId) : null;
}

async function saveOverrideModal() {
  const banner = document.getElementById("ovModalBanner");
  const saveBtn = document.getElementById("ovModalSave");
  const saveLabel = document.getElementById("ovModalSaveLabel");
  const defaultSaveLabel =
    ovModalMode === "add" ? "Save Override" : "Update Override";
  hideBanner(banner);

  const testId = document.getElementById("ovModalTest").value;
  const actionType = document.getElementById("ovModalAction").value;
  const reason = document.getElementById("ovModalReason").value.trim();
  let overrideUomId = document.getElementById("ovModalUom")?.value
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

  let overrideMethodId = null;

  try {
    overrideMethodId = await resolveOverrideMethodIdForSave(testId, actionType);
  } catch (err) {
    console.error("[SPM] override method resolution failed", err);
    showBanner(
      banner,
      "error",
      "Could not resolve test method: " + (err.message || err),
    );
    return;
  }

  if (!overrideMethodId && actionType !== "disable") {
    showBanner(
      banner,
      "error",
      "No default method is mapped for the selected test. Please configure the test method before saving this override.",
    );
    return;
  }

  if (!overrideMethodId && actionType === "disable") {
    showBanner(
      banner,
      "error",
      "Could not resolve the base spec method for this test. Please review the base specification line before saving this override.",
    );
    return;
  }

  // Collect spec values
  let specType = null,
    minVal = null,
    maxVal = null,
    textVal = null,
    targetVal = null,
    toleranceVal = null,
    toleranceUomId = null,
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
    } else if (specType === "TOLERANCE") {
      targetVal = document.getElementById("ovModalTarget")?.value.trim() || null;
      toleranceVal =
        document.getElementById("ovModalTolerance")?.value.trim() || null;
      const tolUomRaw =
        document.getElementById("ovModalToleranceUom")?.value || "";
      toleranceUomId = tolUomRaw ? Number(tolUomRaw) : null;
      if (!targetVal || !toleranceVal) {
        showBanner(
          banner,
          "error",
          "Target and tolerance values are required for TOLERANCE.",
        );
        return;
      }
      if (!toleranceUomId) {
        showBanner(
          banner,
          "error",
          "Tolerance UOM is required for tolerance specifications.",
        );
        return;
      }
      minVal = null;
      maxVal = null;
      textVal = null;
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

  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      toast("User session not available. Please log in again.", "error", 4000);
      return;
    }

    const { error } = await labSupabase.rpc("fn_save_spec_override_direct", {
      p_user_id: userId,
      p_subject_type: subj,
      p_product_id: subj === "FG" ? Number(itemId) : null,
      p_stock_item_id: subj === "FG" ? null : Number(itemId),
      p_test_id: Number(testId),
      p_action_type: actionType,
      p_override_method_id: overrideMethodId,
      p_spec_type: specType,
      p_min_value: minVal !== null ? Number(minVal) : null,
      p_max_value: maxVal !== null ? Number(maxVal) : null,
      p_text_value: textVal ?? null,
      p_override_target_value:
        targetVal !== null ? Number(targetVal) : null,
      p_override_tolerance_value:
        toleranceVal !== null ? Number(toleranceVal) : null,
      p_override_tolerance_uom_id: toleranceUomId,
      p_display_text: displayText ?? null,
      p_override_uom_id: actionType === "disable" ? null : overrideUomId,
      p_reason: reason || null,
    });

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

    if (subj === "FG") await onOvProductChange();
    else if (subj === "RM") await onRmOverrideItemChange();
    else await onPmOverrideItemChange();
  } catch (err) {
    console.error("[SPM] saveOverrideModal failed", err);
    toast(`Failed to save override: ${err.message || err}`, "error", 5000);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (saveLabel) saveLabel.textContent = defaultSaveLabel;
  }
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
    <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
      ${r.is_active === false ? "No" : "Yes"}
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
        data-target="${esc(String(r.override_target_value ?? ""))}"
        data-tolerance="${esc(String(r.override_tolerance_value ?? ""))}"
        data-tolerance-uom-id="${esc(String(r.override_tolerance_uom_id ?? ""))}"
        data-display="${esc(r.override_display_text ?? "")}"
        data-uom-id="${esc(String(r.override_uom_id ?? ""))}"
        data-reason="${esc(r.reason ?? "")}"
        aria-label="Edit override for ${esc(r.test_name ?? "")}">Edit</button>
    </td>
  </tr>`;
}

// Wire edit-button events on an override tbody after innerHTML render
function wireOverrideTableEvents(tbody) {
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
        override_target_value: d.target !== "" ? d.target : null,
        override_tolerance_value: d.tolerance !== "" ? d.tolerance : null,
        override_tolerance_uom_id:
          d.toleranceUomId !== "" ? Number(d.toleranceUomId) : null,
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

function selectedUomSymbol(selectEl) {
  const uomSel = selectEl || document.getElementById("bsLineModalUom");
  const id = Number(uomSel?.value || 0);
  if (id) {
    const row = (labUomRows ?? []).find((u) => Number(u.id) === id);
    return normalizeToleranceUomSymbol(row?.symbol ?? row?.uom_code ?? "");
  }
  return "";
}

function normalizeToleranceUomSymbol(symbol) {
  const unit = String(symbol ?? "").trim();
  if (!unit || unit.toUpperCase() === "NONE") return "";
  return unit;
}

/** TOLERANCE display: target [targetUOM] ± tolerance [toleranceUOM] */
function buildToleranceDisplayText(
  target,
  tolerance,
  targetUomSymbol,
  toleranceUomSymbol,
) {
  const targetText = String(target ?? "").trim();
  const toleranceText = String(tolerance ?? "").trim();
  if (!targetText || !toleranceText) return "";
  const targetUnit = normalizeToleranceUomSymbol(targetUomSymbol);
  const toleranceUnit = normalizeToleranceUomSymbol(toleranceUomSymbol);
  let text = targetUnit ? `${targetText} ${targetUnit}` : targetText;
  text += ` ± ${toleranceText}`;
  if (toleranceUnit) text += ` ${toleranceUnit}`;
  return text.trim();
}

function selectedToleranceUomSymbol(selectEl) {
  const id = Number(selectEl?.value || 0);
  if (id) {
    const row = (labUomRows ?? []).find((u) => Number(u.id) === id);
    const fromPicker = normalizeToleranceUomSymbol(
      row?.symbol ?? row?.uom_code ?? "",
    );
    if (fromPicker) return fromPicker;
  }
  const fallbackSymbol = String(selectEl?.dataset?.displaySymbol ?? "").trim();
  const fallbackCode = String(selectEl?.dataset?.displayCode ?? "").trim();
  return normalizeToleranceUomSymbol(fallbackSymbol || fallbackCode);
}

function appendUomIfNeeded(text, symbol) {
  const value = String(text ?? "").trim();
  const unit = normalizeToleranceUomSymbol(symbol);
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
