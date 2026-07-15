import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import {
  COSTING_SUITE_MODULES,
  LENS_REGISTRY,
  getLensMeta,
  getSuiteForLens,
  isLensPeriodScoped,
} from "./costing-suite-registry.js";
import {
  createCostSheetController,
  isCostSheetLens,
} from "./costing-suite-cost-sheet.js";
import {
  createPricingPolicyController,
  isPricingPolicyLens,
} from "./costing-suite-pricing-policy.js";
import {
  createCostBuildController,
  isCostBuildLens,
} from "./costing-suite-cost-build.js";
import {
  createMaterialCostController,
  isMaterialCostLens,
} from "./costing-suite-material-cost.js";
import {
  createControlCenterController,
  isControlCenterLens,
} from "./costing-suite-control-center.js";
import { normalizeClientRoute } from "./module-registry.js";
import {
  COSTING_ROUTE_CONFIG,
  getAllowedLensIdsForRoute,
  getModuleKeyForLens,
  normalizeCostingRouteModuleKey,
  resolveActiveRouteConfig,
} from "./costing-route-config.js";

let ACTIVE_ROUTE_CONFIG = null;
let MODULE_ID = null;
let BOOTSTRAPPED = false;

function resolveShellRouteConfig(explicitRouteModuleKey = null) {
  const explicitKey = explicitRouteModuleKey?.trim();
  if (explicitKey) {
    const moduleKey = normalizeCostingRouteModuleKey(explicitKey);
    return {
      config: COSTING_ROUTE_CONFIG[moduleKey],
      redirectedFromLegacy: explicitKey === "costing-pricing",
    };
  }

  return {
    config: resolveActiveRouteConfig(),
    redirectedFromLegacy: false,
  };
}

async function bootstrapCostingSuite(routeModuleKey = null) {
  if (BOOTSTRAPPED) {
    console.warn(
      "[costing-suite] bootstrapCostingSuite called more than once; ignoring.",
    );
    return;
  }

  BOOTSTRAPPED = true;
  const { config, redirectedFromLegacy } = resolveShellRouteConfig(routeModuleKey);
  ACTIVE_ROUTE_CONFIG = config;
  MODULE_ID = ACTIVE_ROUTE_CONFIG.moduleKey;
  CURRENT_LENS = ACTIVE_ROUTE_CONFIG.defaultLens;
  await init();

  if (redirectedFromLegacy) {
    showToast(
      "The legacy Costing & Pricing route has been replaced by Costing Control Center.",
      "info",
      5000,
    );
  }

  const routeModule = new URLSearchParams(window.location.search)
    .get("routeModule")
    ?.trim();
  if (!routeModuleKey && routeModule === "costing-pricing") {
    showToast(
      "The legacy Costing & Pricing route has been replaced by Costing Control Center.",
      "info",
      5000,
    );
  }
}

let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = false;
let PERM_CONTROL_CENTER_EDIT = false;

/** @type {"RM"|null} */
let CURRENT_TRACE_COMPONENT = "RM";
let CAN_VIEW_TRACE = false;
let CAN_EXPORT_TRACE = false;
let TRACE_PERMISSIONS_RESOLVED = false;
let LAUNCH_DRILL_CONTEXT = null;

const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableHead = $("tableHead");
const tableBody = $("tableBody");
const refreshBtn = $("refreshBtn");
const exportBtn = $("exportCsv");
const searchBox = $("search");
const searchClear = $("searchClear");
const lastRefreshed = $("lastRefreshed");
const kpiStrip = $("kpiStrip");
const kpiStripWrap = $("kpiStripWrap");
const globalSearchCard =
  $("globalSearchCard") || $("manualRateManagerControls");
const costingPeriodSelect = $("costingPeriodSelect");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const lensSuiteLabel = $("lensSuiteLabel");
const drawerClose = $("drawerClose");
const drawerTabs = $("drawerTabs");
const drawerContent = $("drawerContent");
const detailsModal = $("detailsModal");
const rowCount = $("peqRowCount");
const pageLabel = $("peqPage");
const prevPage = $("prevPage");
const nextPage = $("nextPage");
const workbenchSummary = $("workbenchSummary");
const genericTableMetaRow = $("genericTableMetaRow");
const genericTableMetaActions = $("genericTableMetaActions");
const costingLoadingMask = $("costingLoadingMask");
const costingLoadingText = $("costingLoadingText");
const costSheetModal = $("costSheetModal");
const costSheetA4 = $("costSheetA4");
const costSheetModalTitle = $("costSheetModalTitle");
const costSheetModalSubtitle = $("costSheetModalSubtitle");
const costSheetCloseBtn = $("costSheetCloseBtn");
const costSheetPdfBtn = $("costSheetPdfBtn");
const costSheetExplainDrawer = $("costSheetExplainDrawer");
const costSheetExplainBackdrop = $("costSheetExplainBackdrop");
const costSheetExplainCloseBtn = $("costSheetExplainCloseBtn");
const costSheetExplainContent = $("costSheetExplainContent");
const costSheetExplainTitle = $("costSheetExplainTitle");
const costSheetExplainSubtitle = $("costSheetExplainSubtitle");
const costSheetModalHint = $("costSheetModalHint");
const costSheetSignModal = $("costSheetSignModal");
const costSheetSignCloseBtn = $("costSheetSignCloseBtn");
const costSheetSignCancelBtn = $("costSheetSignCancelBtn");
const costSheetSignConfirmBtn = $("costSheetSignConfirmBtn");
const sellingPolicyEditModal = $("sellingPolicyEditModal");
const sellingPolicyEditCloseBtn = $("sellingPolicyEditCloseBtn");
const sellingPolicyEditCancelBtn = $("sellingPolicyEditCancelBtn");
const sellingPolicyEditSaveBtn = $("sellingPolicyEditSaveBtn");
const sellingPolicyEditSkuLabel = $("sellingPolicyEditSkuLabel");
const sellingPolicyGstPercent = $("sellingPolicyGstPercent");
const sellingPolicyIkDiscountPercent = $("sellingPolicyIkDiscountPercent");
const sellingPolicyOkDiscountPercent = $("sellingPolicyOkDiscountPercent");
const sellingPolicyIkDiscountAmount = $("sellingPolicyIkDiscountAmount");
const sellingPolicyOkDiscountAmount = $("sellingPolicyOkDiscountAmount");
const sellingPolicyContingencyPercent = $("sellingPolicyContingencyPercent");
const sellingPolicyEffectiveFrom = $("sellingPolicyEffectiveFrom");
const sellingPolicyRemarks = $("sellingPolicyRemarks");
const schemePolicyEditModal = $("schemePolicyEditModal");
const schemePolicyEditCloseBtn = $("schemePolicyEditCloseBtn");
const schemePolicyEditCancelBtn = $("schemePolicyEditCancelBtn");
const schemePolicyEditSaveBtn = $("schemePolicyEditSaveBtn");
const schemePolicyEditRegion = $("schemePolicyEditRegion");
const schemePolicyEditScheme = $("schemePolicyEditScheme");
const schemePolicyEditEffectiveFrom = $("schemePolicyEditEffectiveFrom");
const schemePolicyEditRemarks = $("schemePolicyEditRemarks");
const schemeRuleEditModal = $("schemeRuleEditModal");
const schemeRuleEditCloseBtn = $("schemeRuleEditCloseBtn");
const schemeRuleEditCancelBtn = $("schemeRuleEditCancelBtn");
const schemeRuleEditSaveBtn = $("schemeRuleEditSaveBtn");
const schemeRuleScope = $("schemeRuleScope");
const schemeRuleScopeSearch = $("schemeRuleScopeSearch");
const schemeRuleScopeSelect = $("schemeRuleScopeSelect");
const schemeRuleRegion = $("schemeRuleRegion");
const schemeRuleScheme = $("schemeRuleScheme");
const schemeRuleApplyMode = $("schemeRuleApplyMode");
const schemeRuleReplaceFromScheme = $("schemeRuleReplaceFromScheme");
const schemeRuleReplaceFromWrap = $("schemeRuleReplaceFromWrap");
const schemeRuleEffectiveFrom = $("schemeRuleEffectiveFrom");
const schemeRuleRemarks = $("schemeRuleRemarks");
const schemeRuleCloseModal = $("schemeRuleCloseModal");
const schemeRuleCloseCloseBtn = $("schemeRuleCloseCloseBtn");
const schemeRuleCloseCancelBtn = $("schemeRuleCloseCancelBtn");
const schemeRuleCloseSaveBtn = $("schemeRuleCloseSaveBtn");
const schemeRuleCloseLabel = $("schemeRuleCloseLabel");
const schemeRuleCloseEffectiveTo = $("schemeRuleCloseEffectiveTo");
const schemeRuleCloseRemarks = $("schemeRuleCloseRemarks");
const manualRateEditModal = $("manualRateEditModal");
const manualRateEditCloseBtn = $("manualRateEditCloseBtn");
const manualRateEditCancelBtn = $("manualRateEditCancelBtn");
const manualRateEditSaveBtn = $("manualRateEditSaveBtn");
const manualRateStockItemLabel = $("manualRateStockItemLabel");
const manualRateCurrentRate = $("manualRateCurrentRate");
const manualRateCurrentSource = $("manualRateCurrentSource");
const manualRateCurrentDate = $("manualRateCurrentDate");
const manualRateEvidenceStrip = $("manualRateEvidenceStrip");
const manualRateEvidenceSelectedRate = $("manualRateEvidenceSelectedRate");
const manualRateEvidenceSelectedSource = $("manualRateEvidenceSelectedSource");
const manualRateEvidenceSelectedDate = $("manualRateEvidenceSelectedDate");
const manualRateEvidenceLatestPurchaseRate = $(
  "manualRateEvidenceLatestPurchaseRate",
);
const manualRateEvidenceLatestPurchaseDate = $(
  "manualRateEvidenceLatestPurchaseDate",
);
const manualRateEvidenceActiveManualRate = $("manualRateEvidenceActiveManualRate");
const manualRateEvidenceManualRateStatus = $("manualRateEvidenceManualRateStatus");
const manualRateEvidenceNewerPurchase = $("manualRateEvidenceNewerPurchase");
const manualRateEvidenceOverrideFlag = $("manualRateEvidenceOverrideFlag");
const manualRateEvidenceAffectedSkuCount = $(
  "manualRateEvidenceAffectedSkuCount",
);
const manualRateValue = $("manualRateValue");
const manualRateEffectiveFrom = $("manualRateEffectiveFrom");
const manualRateReason = $("manualRateReason");
const manualRateCloseModal = $("manualRateCloseModal");
const manualRateCloseCloseBtn = $("manualRateCloseCloseBtn");
const manualRateCloseCancelBtn = $("manualRateCloseCancelBtn");
const manualRateCloseSaveBtn = $("manualRateCloseSaveBtn");
const manualRateCloseLabel = $("manualRateCloseLabel");
const manualRateCloseEffectiveTo = $("manualRateCloseEffectiveTo");
const manualRateCloseReason = $("manualRateCloseReason");
const materialReviewAcceptModal = $("materialReviewAcceptModal");
const materialReviewAcceptCloseBtn = $("materialReviewAcceptCloseBtn");
const materialReviewAcceptCancelBtn = $("materialReviewAcceptCancelBtn");
const materialReviewAcceptSaveBtn = $("materialReviewAcceptSaveBtn");
const materialReviewAcceptStockItem = $("materialReviewAcceptStockItem");
const materialReviewAcceptMaterialArea = $("materialReviewAcceptMaterialArea");
const materialReviewAcceptIssueCodes = $("materialReviewAcceptIssueCodes");
const materialReviewAcceptWarningCodes = $("materialReviewAcceptWarningCodes");
const materialReviewAcceptActionSummary = $("materialReviewAcceptActionSummary");
const materialReviewAcceptReason = $("materialReviewAcceptReason");
const materialReviewAcceptNote = $("materialReviewAcceptNote");
const materialReviewCloseAcceptanceModal = $("materialReviewCloseAcceptanceModal");
const materialReviewCloseAcceptanceCloseBtn = $(
  "materialReviewCloseAcceptanceCloseBtn",
);
const materialReviewCloseAcceptanceCancelBtn = $(
  "materialReviewCloseAcceptanceCancelBtn",
);
const materialReviewCloseAcceptanceSaveBtn = $(
  "materialReviewCloseAcceptanceSaveBtn",
);
const materialReviewCloseStockItem = $("materialReviewCloseStockItem");
const materialReviewCloseDetails = $("materialReviewCloseDetails");
const materialReviewCloseReason = $("materialReviewCloseReason");
const expenseMappingEditModal = $("expenseMappingEditModal");
const expenseMappingEditCloseBtn = $("expenseMappingEditCloseBtn");
const expenseMappingEditCancelBtn = $("expenseMappingEditCancelBtn");
const expenseMappingEditSaveBtn = $("expenseMappingEditSaveBtn");
const expenseMappingLabel = $("expenseMappingLabel");
const expenseMappingPool = $("expenseMappingPool");
const expenseMappingInclude = $("expenseMappingInclude");
const expenseMappingRemarks = $("expenseMappingRemarks");
const expenseMappingDetailModal = $("expenseMappingDetailModal");
const expenseMappingDetailCloseBtn = $("expenseMappingDetailCloseBtn");
const expenseMappingDetailEditBtn = $("expenseMappingDetailEditBtn");
const expenseMappingDetailCloseMappingBtn = $(
  "expenseMappingDetailCloseMappingBtn",
);
const expenseMappingDetailContent = $("expenseMappingDetailContent");
const expenseMappingCloseModal = $("expenseMappingCloseModal");
const expenseMappingCloseModalCloseBtn = $("expenseMappingCloseModalCloseBtn");
const expenseMappingCloseModalCancelBtn = $("expenseMappingCloseModalCancelBtn");
const expenseMappingCloseModalSaveBtn = $("expenseMappingCloseModalSaveBtn");
const expenseMappingCloseLabel = $("expenseMappingCloseLabel");
const expenseMappingCloseReason = $("expenseMappingCloseReason");
const staffGovernanceReviewModal = $("staffGovernanceReviewModal");
const staffGovernanceReviewCloseBtn = $("staffGovernanceReviewCloseBtn");
const staffGovernanceReviewOkBtn = $("staffGovernanceReviewOkBtn");
const staffClassificationEditModal = $("staffClassificationEditModal");
const staffClassificationEditCloseBtn = $("staffClassificationEditCloseBtn");
const staffClassificationEditCancelBtn = $("staffClassificationEditCancelBtn");
const staffClassificationEditSaveBtn = $("staffClassificationEditSaveBtn");
const staffClassificationLabel = $("staffClassificationLabel");
const staffClassificationClass = $("staffClassificationClass");
const staffClassificationPool = $("staffClassificationPool");
const staffClassificationEffectiveFrom = $("staffClassificationEffectiveFrom");
const staffClassificationWeight = $("staffClassificationWeight");
const staffClassificationRemarks = $("staffClassificationRemarks");
const manualProvisionEditModal = $("manualProvisionEditModal");
const manualProvisionEditTitle = $("manualProvisionEditTitle");
const manualProvisionEditCloseBtn = $("manualProvisionEditCloseBtn");
const manualProvisionEditBanner = $("manualProvisionEditBanner");
const manualProvisionPeriodStart = $("manualProvisionPeriodStart");
const manualProvisionAllocationPool = $("manualProvisionAllocationPool");
const manualProvisionType = $("manualProvisionType");
const manualProvisionKey = $("manualProvisionKey");
const manualProvisionLabel = $("manualProvisionLabel");
const manualProvisionAmount = $("manualProvisionAmount");
const manualProvisionSourceReference = $("manualProvisionSourceReference");
const manualProvisionRemarks = $("manualProvisionRemarks");
const manualProvisionSaveBtn = $("manualProvisionSaveBtn");
const manualProvisionCancelBtn = $("manualProvisionCancelBtn");
const manualProvisionDeactivateBtn = $("manualProvisionDeactivateBtn");
const manualProvisionDeactivateModal = $("manualProvisionDeactivateModal");
const manualProvisionDeactivateCloseBtn = $(
  "manualProvisionDeactivateCloseBtn",
);
const manualProvisionDeactivateLabel = $("manualProvisionDeactivateLabel");
const manualProvisionDeactivateReason = $("manualProvisionDeactivateReason");
const manualProvisionDeactivateSaveBtn = $("manualProvisionDeactivateSaveBtn");
const manualProvisionDeactivateCancelBtn = $(
  "manualProvisionDeactivateCancelBtn",
);
const csPreparedRole = $("csPreparedRole");
const csPreparedOrg = $("csPreparedOrg");
const csVerifiedRole = $("csVerifiedRole");
const csVerifiedOrg = $("csVerifiedOrg");
const csApprovedRole = $("csApprovedRole");
const csApprovedOrg = $("csApprovedOrg");

let ACTIVE_PERIOD_START = null;
let AVAILABLE_COSTING_PERIODS = [];
let CURRENT_LENS = null;
let ALL_ROWS = [];
let VIEW = [];
let CURRENT_PAGE = 1;
let PAGE_SIZE = 25;
let SELECTED_ROW = null;
let LAST_REFRESH_TIME = null;
let SKU_STATUS_DIAGNOSIS = [];
let DIAGNOSIS_BY_SKU_ID = new Map();
let CURRENT_EXPORT_USER = "--";
let DETAILS_RETURN_FOCUS = null;
let ACTIVE_FILTERS = {
  status: [],
  issue: [],
  source: [],
};
let _filterDrawerOpen = false;

const COSTING_REFRESH_SCOPE = "FULL_COSTING_REFRESH";
const COSTING_REFRESH_POLL_MS = 5000;
const COSTING_REFRESH_MAX_WAIT_MS = 45 * 60 * 1000;
const COSTING_REFRESH_SESSION_KEY = "costing-pricing:active-refresh-run";
const COSTING_PENDING_DRILL_CONTEXT_KEY = "costing-suite:pending-drill-context";

function parseDrillFilterJson(raw) {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function drillFilterValueArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStatus(String(entry))).filter(Boolean);
  }
  if (value == null || value === "") return [];
  return [normalizeStatus(String(value))].filter(Boolean);
}

function normalizeDrillId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeDrillContext(raw = {}) {
  const payload =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    status: drillFilterValueArray(payload.status),
    issue: drillFilterValueArray(payload.issue),
    source: drillFilterValueArray(payload.source),
    policyTab:
      String(payload.policyTab || payload.policy_tab || "").trim() || null,
    managerTab:
      String(payload.manager_tab || payload.managerTab || "").trim() || null,
    traceComponent:
      String(
        payload.trace_component || payload.traceComponent || "",
      ).trim() || null,
    materialArea:
      String(payload.material_area || payload.materialArea || "").trim() ||
      null,
    periodStart:
      normalizeMonthStart(
        payload.period_start || payload.periodStart || "",
      ) || null,
    search: String(
      payload.search || payload.q || payload.search_text || "",
    ).trim(),
    skuId: normalizeDrillId(payload.sku_id ?? payload.skuId),
    productId: normalizeDrillId(payload.product_id ?? payload.productId),
    stockItemId: normalizeDrillId(
      payload.stock_item_id ?? payload.stockItemId,
    ),
  };
}

function drillFiltersFromTraceabilityPayload(drillFilterJson) {
  return normalizeDrillContext(parseDrillFilterJson(drillFilterJson));
}

function mergeDrillContext(base = {}, overlay = {}) {
  const merged = { ...normalizeDrillContext(base) };
  const next = normalizeDrillContext(overlay);
  Object.keys(next).forEach((key) => {
    const value = next[key];
    if (Array.isArray(value)) {
      if (value.length) merged[key] = value;
      return;
    }
    if (value != null && value !== "") merged[key] = value;
  });
  return merged;
}

function resolveTraceabilityDrillTarget(row) {
  const primary = String(row?.drill_route_module_key || "").trim();
  const fallback = String(row?.source_module_key || "").trim();
  const rawModuleKey = primary || fallback;
  if (!rawModuleKey) return null;

  const moduleKey = COSTING_ROUTE_CONFIG[rawModuleKey]
    ? rawModuleKey
    : null;
  if (!moduleKey) return null;

  const config = COSTING_ROUTE_CONFIG[moduleKey];
  const requestedLens = String(
    row?.drill_route_lens_id || row?.source_lens_id || "",
  ).trim();
  let lensId = requestedLens;
  if (!lensId || !config.allowedLensIds.includes(lensId)) {
    lensId = config.defaultLens;
  }

  return { moduleKey, lensId, config };
}

function canNavigateTraceabilityDrill(row) {
  return Boolean(resolveTraceabilityDrillTarget(row));
}

function stashPendingDrillContext(filters) {
  const normalized = normalizeDrillContext(filters);
  const pending = {};
  if (normalized.search) pending.search = normalized.search;
  if (normalized.skuId != null) pending.skuId = normalized.skuId;
  if (normalized.productId != null) pending.productId = normalized.productId;
  if (normalized.stockItemId != null) {
    pending.stockItemId = normalized.stockItemId;
  }
  if (normalized.managerTab) pending.managerTab = normalized.managerTab;
  if (normalized.traceComponent) {
    pending.traceComponent = normalized.traceComponent;
  }
  if (normalized.materialArea) pending.materialArea = normalized.materialArea;
  if (normalized.periodStart) pending.periodStart = normalized.periodStart;
  if (normalized.policyTab) pending.policyTab = normalized.policyTab;
  if (normalized.status?.length) pending.status = normalized.status;
  if (normalized.issue?.length) pending.issue = normalized.issue;
  if (normalized.source?.length) pending.source = normalized.source;

  if (!Object.keys(pending).length) {
    sessionStorage.removeItem(COSTING_PENDING_DRILL_CONTEXT_KEY);
    return;
  }

  sessionStorage.setItem(
    COSTING_PENDING_DRILL_CONTEXT_KEY,
    JSON.stringify(pending),
  );
}

function consumePendingDrillContext() {
  const raw = sessionStorage.getItem(COSTING_PENDING_DRILL_CONTEXT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(COSTING_PENDING_DRILL_CONTEXT_KEY);
  try {
    return normalizeDrillContext(JSON.parse(raw));
  } catch (err) {
    console.warn("[costing-suite] pending drill context parse failed", err);
    return null;
  }
}

async function navigateTraceabilityDrill(row, { onBeforeNavigate } = {}) {
  const target = resolveTraceabilityDrillTarget(row);
  if (!target) {
    console.warn("[costing-suite] traceability drillback unavailable", row);
    return false;
  }

  const filters = drillFiltersFromTraceabilityPayload(row.drill_filter_json);
  stashPendingDrillContext(filters);
  onBeforeNavigate?.();

  await drillToCostingTarget(target.moduleKey, target.lensId, filters);
  return true;
}

function applyPendingDrillContext() {
  const pending = consumePendingDrillContext();
  if (!pending) return;

  if (pending.search && searchBox) {
    searchBox.value = String(pending.search);
    if (searchClear) searchClear.style.display = "";
  }

  LAUNCH_DRILL_CONTEXT = mergeDrillContext(LAUNCH_DRILL_CONTEXT, pending);
}
const COSTING_REFRESH_TERMINAL_STATUSES = new Set([
  "SUCCESS",
  "PARTIAL_SUCCESS",
  "FAILED",
  "CANCELLED",
  "SKIPPED_ALREADY_RUNNING",
]);
const COSTING_REFRESH_ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);
const COSTING_REFRESH_STAGE_LABELS = {
  "01_ENSURE_PERIOD": "Ensure period",
  "02_MATERIAL_SNAPSHOT": "Material snapshot",
  "03_COST_BUILD_TO_SCHEME": "Cost build to scheme",
  "04_COST_SHEET_SNAPSHOT": "Cost sheet snapshot",
  "05_CONTROL_MAINTENANCE": "Control maintenance",
  "06_FINAL_STATUS_CHECK": "Final status check",
};

const COSTING_REFRESH_STAGE_FALLBACK = [
  {
    stage_code: "01_ENSURE_PERIOD",
    stage_label: "Ensure period",
    status: "PENDING",
  },
  {
    stage_code: "02_MATERIAL_SNAPSHOT",
    stage_label: "Material snapshot",
    status: "PENDING",
  },
  {
    stage_code: "03_COST_BUILD_TO_SCHEME",
    stage_label: "Cost build to scheme",
    status: "PENDING",
  },
  {
    stage_code: "04_COST_SHEET_SNAPSHOT",
    stage_label: "Cost sheet snapshot",
    status: "PENDING",
  },
  {
    stage_code: "05_CONTROL_MAINTENANCE",
    stage_label: "Control maintenance",
    status: "PENDING",
  },
  {
    stage_code: "06_FINAL_STATUS_CHECK",
    stage_label: "Final status check",
    status: "PENDING",
  },
];

let costingRefreshOverlayWired = false;

function ensureCostingRefreshOverlayStyles() {
  if (document.getElementById("costingRefreshOverlayStyles")) return;

  const style = document.createElement("style");
  style.id = "costingRefreshOverlayStyles";
  style.textContent = `
    .costing-refresh-overlay {
      position: absolute;
      inset: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.22);
      pointer-events: auto;
    }
    .costing-refresh-overlay.is-hidden {
      display: none !important;
    }
    .costing-refresh-card {
      position: relative;
      width: 100%;
      max-width: 480px;
      max-height: 90%;
      overflow-y: auto;
      background: var(--panel-bg, #fff);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 12px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
      padding: 18px 20px;
      box-sizing: border-box;
    }
    .costing-refresh-header {
      position: relative;
      padding-right: 36px;
      margin-bottom: 14px;
    }
    .costing-refresh-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text, #111827);
      margin-bottom: 4px;
      padding-right: 4px;
    }
    .costing-refresh-subtitle {
      font-size: 12.5px;
      color: var(--muted, #6b7280);
      margin-bottom: 0;
      line-height: 1.4;
      padding-right: 4px;
    }
    .costing-refresh-close-icon {
      position: absolute;
      top: -4px;
      right: -6px;
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--muted, #6b7280);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .costing-refresh-close-icon:hover {
      color: var(--text, #111827);
      background: rgba(15, 23, 42, 0.06);
      border-color: var(--border, #e5e7eb);
    }
    .costing-refresh-close-icon:focus-visible {
      outline: 2px solid var(--primary, #2563eb);
      outline-offset: 2px;
    }
    .costing-refresh-stages {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .costing-refresh-stage {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 8px;
      background: var(--panel-bg, #fff);
    }
    .costing-refresh-stage-main {
      min-width: 0;
      flex: 1;
    }
    .costing-refresh-stage-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text, #111827);
    }
    .costing-refresh-stage-detail {
      display: block;
      margin-top: 2px;
      font-size: 11.5px;
      color: var(--muted, #6b7280);
      line-height: 1.35;
    }
    .costing-refresh-stage-pill {
      flex-shrink: 0;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--border, #e5e7eb);
      color: var(--muted, #6b7280);
      background: #f9fafb;
    }
    .costing-refresh-stage[data-status="RUNNING"] {
      border-color: #93c5fd;
      background: #eff6ff;
    }
    .costing-refresh-stage[data-status="RUNNING"] .costing-refresh-stage-pill {
      border-color: #93c5fd;
      color: #1d4ed8;
      background: #dbeafe;
    }
    .costing-refresh-stage[data-status="SUCCESS"] .costing-refresh-stage-pill {
      border-color: #86efac;
      color: #166534;
      background: #dcfce7;
    }
    .costing-refresh-stage[data-status="FAILED"] {
      border-color: #fca5a5;
      background: #fef2f2;
    }
    .costing-refresh-stage[data-status="FAILED"] .costing-refresh-stage-pill {
      border-color: #fca5a5;
      color: #991b1b;
      background: #fee2e2;
    }
    .costing-refresh-stage[data-status="QUEUED"] .costing-refresh-stage-pill,
    .costing-refresh-stage[data-status="PENDING"] .costing-refresh-stage-pill {
      border-color: #d1d5db;
      color: #6b7280;
      background: #f3f4f6;
    }
    .costing-refresh-message {
      font-size: 13px;
      line-height: 1.45;
      color: var(--text, #111827);
      margin-bottom: 10px;
    }
    .costing-refresh-message.is-success {
      color: #166534;
    }
    .costing-refresh-message.is-error {
      color: #991b1b;
    }
    .costing-refresh-message.is-warning {
      color: #b45309;
    }
    .costing-refresh-footer {
      margin-top: 4px;
    }
    .costing-refresh-note {
      font-size: 11.5px;
      color: var(--muted, #6b7280);
      line-height: 1.4;
    }
    [data-theme="dark"] .costing-refresh-overlay {
      background: rgba(2, 6, 23, 0.48);
    }
    [data-theme="dark"] .costing-refresh-card {
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 10px rgba(0, 0, 0, 0.25);
    }
    [data-theme="dark"] .costing-refresh-close-icon:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text, #f9fafb);
    }
    [data-theme="dark"] .costing-refresh-stage[data-status="RUNNING"] {
      background: rgba(30, 58, 138, 0.25);
    }
    [data-theme="dark"] .costing-refresh-stage[data-status="FAILED"] {
      background: rgba(127, 29, 29, 0.25);
    }
  `;
  document.head.appendChild(style);
}

function ensureCostingRefreshOverlay() {
  ensureCostingRefreshOverlayStyles();
  if (document.getElementById("costingRefreshOverlay")) {
    wireCostingRefreshOverlayControls();
    return document.getElementById("costingRefreshOverlay");
  }

  const loadingMask = document.getElementById("costingLoadingMask");
  const host =
    loadingMask?.closest(".table-card") ||
    document.querySelector(".table-card") ||
    document.body;

  if (host !== document.body && getComputedStyle(host).position === "static") {
    host.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.id = "costingRefreshOverlay";
  overlay.className = "costing-refresh-overlay is-hidden";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="costing-refresh-card">
      <div class="costing-refresh-header">
        <div class="costing-refresh-title">Refreshing Costing Snapshots</div>
        <div id="costingRefreshSubtitle" class="costing-refresh-subtitle"></div>
        <button
          type="button"
          id="costingRefreshOverlayClose"
          class="costing-refresh-close-icon"
          aria-label="Close refresh progress"
          title="Close"
        >
          ×
        </button>
      </div>
      <div id="costingRefreshStages" class="costing-refresh-stages"></div>
      <div id="costingRefreshMessage" class="costing-refresh-message"></div>
      <div class="costing-refresh-footer">
        <div class="costing-refresh-note">
          Refresh can continue in the background if this panel is closed.
        </div>
      </div>
    </div>
  `;

  host.appendChild(overlay);
  wireCostingRefreshOverlayControls();
  return overlay;
}

function wireCostingRefreshOverlayControls() {
  if (costingRefreshOverlayWired) return;
  const closeBtn = document.getElementById("costingRefreshOverlayClose");
  if (!closeBtn) return;
  closeBtn.addEventListener("click", () => hideCostingRefreshOverlay());
  costingRefreshOverlayWired = true;
}

function hideCostingRefreshOverlay() {
  const overlay = document.getElementById("costingRefreshOverlay");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
  overlay.hidden = true;
}

function showCostingRefreshOverlay(statusRow, options = {}) {
  const overlay = ensureCostingRefreshOverlay();
  overlay.classList.remove("is-hidden");
  overlay.hidden = false;
  updateCostingRefreshOverlay(statusRow, options);
}

function setCostingRefreshOverlayMessage(message, tone = "info") {
  const msgEl = document.getElementById("costingRefreshMessage");
  if (!msgEl) return;
  msgEl.textContent = message || "";
  msgEl.classList.remove("is-success", "is-error", "is-warning");
  if (tone === "success") msgEl.classList.add("is-success");
  else if (tone === "error") msgEl.classList.add("is-error");
  else if (tone === "warning") msgEl.classList.add("is-warning");
}

function getCostingRefreshStagesFromStatus(statusRow) {
  const raw = statusRow?.stages || statusRow?.stage_rows;
  if (!Array.isArray(raw) || !raw.length) {
    return COSTING_REFRESH_STAGE_FALLBACK.map((stage) => ({ ...stage }));
  }

  const order = COSTING_REFRESH_STAGE_FALLBACK.map((stage) => stage.stage_code);
  return [...raw].sort((left, right) => {
    const leftCode = left.stage_code || left.stageCode || "";
    const rightCode = right.stage_code || right.stageCode || "";
    const leftIdx = order.indexOf(leftCode);
    const rightIdx = order.indexOf(rightCode);
    return (
      (leftIdx === -1 ? 99 : leftIdx) - (rightIdx === -1 ? 99 : rightIdx)
    );
  });
}

function normalizeCostingRefreshStageStatus(stage, statusRow) {
  const raw = normalizeStatus(
    stage?.stage_status || stage?.status || stage?.run_status || "",
  );
  if (raw === "COMPLETED") return "SUCCESS";
  if (raw === "IN_PROGRESS") return "RUNNING";
  if (raw === "ERROR") return "FAILED";
  if (raw) return raw;

  const code = stage?.stage_code || stage?.stageCode || "";
  const errorStage = statusRow?.error_stage_code || statusRow?.failed_stage_code;
  if (errorStage && String(errorStage) === String(code)) return "FAILED";

  if (stage?.finished_at || stage?.completed_at) return "SUCCESS";
  if (stage?.started_at) return "RUNNING";
  return "PENDING";
}

function costingRefreshStagePillLabel(status) {
  const labels = {
    PENDING: "Pending",
    QUEUED: "Queued",
    RUNNING: "Running",
    SUCCESS: "Completed",
    FAILED: "Failed",
    SKIPPED: "Skipped",
    PARTIAL_SUCCESS: "Partial",
    UNKNOWN: "Unknown",
  };
  return labels[normalizeStatus(status)] || status || "Pending";
}

function getCostingRefreshStageLabel(stage) {
  const code = stage?.stage_code || stage?.stageCode || "";
  return (
    stage?.stage_label ||
    stage?.stageLabel ||
    COSTING_REFRESH_STAGE_LABELS[code] ||
    "Stage"
  );
}

function getCostingRefreshStageDetail(stage, statusRow) {
  const output =
    typeof stage?.output_json === "string"
      ? (() => {
          try {
            return JSON.parse(stage.output_json);
          } catch {
            return null;
          }
        })()
      : stage?.output_json;

  const parts = [];
  const rowCount =
    stage?.row_count ??
    output?.row_count ??
    output?.inserted_row_count ??
    output?.inserted_rows;
  if (rowCount != null && rowCount !== "") {
    parts.push(`${formatNumber(rowCount)} rows`);
  }

  const message =
    stage?.message ||
    stage?.error_message ||
    output?.message ||
    (codeMatchesFailedStage(stage, statusRow)
      ? statusRow?.error_message || statusRow?.failure_message
      : "");
  if (message) parts.push(String(message));

  return parts.join(" · ");
}

function codeMatchesFailedStage(stage, statusRow) {
  const code = stage?.stage_code || stage?.stageCode || "";
  const errorStage = statusRow?.error_stage_code || statusRow?.failed_stage_code;
  return errorStage && String(errorStage) === String(code);
}

function renderCostingRefreshStages(statusRow) {
  const wrap = document.getElementById("costingRefreshStages");
  if (!wrap) return;

  const stages = getCostingRefreshStagesFromStatus(statusRow);
  const currentStageCode = getCurrentRefreshStageInfo(statusRow)?.code || "";
  const overall = resolveRefreshOverallStatus(statusRow);
  const runIsActive = isRefreshRunActiveStatus(overall);

  wrap.innerHTML = stages
    .map((stage) => {
      const stageCode = stage?.stage_code || stage?.stageCode || "";
      let status = normalizeCostingRefreshStageStatus(stage, statusRow);
      if (
        runIsActive &&
        currentStageCode &&
        stageCode === currentStageCode &&
        (status === "PENDING" || status === "QUEUED")
      ) {
        status = "RUNNING";
      }
      const label = escapeHtml(getCostingRefreshStageLabel(stage));
      const detail = escapeHtml(getCostingRefreshStageDetail(stage, statusRow));
      const pill = escapeHtml(costingRefreshStagePillLabel(status));
      return `<div class="costing-refresh-stage" data-status="${escapeHtml(status)}">
        <div class="costing-refresh-stage-main">
          <span class="costing-refresh-stage-label">${label}</span>
          ${detail ? `<span class="costing-refresh-stage-detail">${detail}</span>` : ""}
        </div>
        <span class="costing-refresh-stage-pill">${pill}</span>
      </div>`;
    })
    .join("");
}

function getCostingRefreshOverlayRunningMessage(statusRow) {
  const overall = resolveRefreshOverallStatus(statusRow);
  if (overall === "QUEUED") {
    return "Refresh is queued and will continue in the background.";
  }
  return "Refresh is running. This may take a few minutes.";
}

function updateCostingRefreshOverlay(statusRow, options = {}) {
  ensureCostingRefreshOverlay();

  const subtitleEl = document.getElementById("costingRefreshSubtitle");
  const periodStart =
    options.periodStart ||
    statusRow?.period_start ||
    ACTIVE_PERIOD_START ||
    "";
  if (subtitleEl) {
    const periodText = periodStart
      ? `Costing period: ${formatPeriodMonth(periodStart)}`
      : "Updating costing snapshots for the active period.";
    subtitleEl.textContent = periodText;
  }

  renderCostingRefreshStages(statusRow);

  if (options.message) {
    setCostingRefreshOverlayMessage(options.message, options.tone || "info");
    return;
  }

  const overall = resolveRefreshOverallStatus(statusRow);
  if (options.requesting) {
    setCostingRefreshOverlayMessage("Requesting costing refresh...", "info");
    return;
  }

  if (isRefreshRunActiveStatus(overall)) {
    setCostingRefreshOverlayMessage(
      getCostingRefreshOverlayRunningMessage(statusRow),
      overall === "QUEUED" ? "warning" : "info",
    );
    return;
  }

  if (!statusRow) {
    setCostingRefreshOverlayMessage("Preparing refresh...", "info");
  }
}

function setCostingRefreshOverlayTerminalState(statusRow, outcome = {}) {
  showCostingRefreshOverlay(statusRow, outcome);

  const overall =
    outcome.overall || resolveRefreshOverallStatus(statusRow) || "UNKNOWN";
  const message =
    outcome.message ||
    formatCostingRefreshRunMessage(statusRow, { timedOut: outcome.timedOut });

  renderCostingRefreshStages(statusRow);

  let tone = "info";
  if (overall === "SUCCESS") tone = "success";
  else if (overall === "PARTIAL_SUCCESS") tone = "success";
  else if (overall === "FAILED") tone = "error";
  else if (outcome.timedOut) tone = "warning";

  setCostingRefreshOverlayMessage(message, tone);
}

let ACTIVE_REFRESH_RUN = null;
let refreshPollInFlight = false;

function getAllowedLensIds() {
  return getAllowedLensIdsForRoute(ACTIVE_ROUTE_CONFIG);
}

function buildActiveLenses() {
  return getAllowedLensIds().map((lensId) => ({
    id: lensId,
    label: LENS_REGISTRY[lensId]?.label || lensId,
  }));
}

function getActiveSuiteModules() {
  const allowed = new Set(getAllowedLensIds());

  return COSTING_SUITE_MODULES.filter(
    (suite) => suite.id === ACTIVE_ROUTE_CONFIG.suiteId,
  ).map((suite) => ({
    ...suite,
    lensIds: suite.lensIds.filter((lensId) => allowed.has(lensId)),
  }));
}

function isLensAllowedForRoute(lensId) {
  return getAllowedLensIds().includes(lensId);
}

function getCostingClientKey() {
  return Platform.isElectron ? "electron" : "pwa";
}

function isOnSharedCostingHtmlPage() {
  const path = window.location.pathname.replace(/\\/g, "/");
  return (
    /(?:^|\/)shared\/[^/]+\.html$/i.test(path) ||
    /(?:^|\/)public\/shared\/[^/]+\.html$/i.test(path)
  );
}

function sharedCostingHtmlFileName(routePath) {
  const raw = String(routePath || "").trim();
  const match =
    raw.match(/^(?:\/)?public\/shared\/([^/]+\.html)$/i) ||
    raw.match(/^(?:\/)?shared\/([^/]+\.html)$/i) ||
    raw.match(/^([^/]+\.html)$/i);
  return match?.[1] || null;
}

function resolveCostingRouteHref(routePath, clientKey) {
  const raw = String(routePath || "").trim();
  if (!raw) return "";

  const fileName = sharedCostingHtmlFileName(raw);
  if (fileName && isOnSharedCostingHtmlPage()) {
    return fileName;
  }

  return normalizeClientRoute(raw, clientKey);
}

function buildCostingRouteQuery(params = {}) {
  const qs = new URLSearchParams();
  if (params.lens) qs.set("lens", params.lens);
  if (params.status?.length) qs.set("status", params.status.join(","));
  if (params.issue?.length) qs.set("issue", params.issue.join(","));
  if (params.source?.length) qs.set("source", params.source.join(","));
  if (params.policyTab) qs.set("policyTab", params.policyTab);
  if (params.managerTab || params.manager_tab) {
    qs.set("manager_tab", params.managerTab || params.manager_tab);
  }
  if (params.traceComponent || params.trace_component) {
    qs.set(
      "trace_component",
      params.traceComponent || params.trace_component,
    );
  }
  if (params.materialArea || params.material_area) {
    qs.set("material_area", params.materialArea || params.material_area);
  }
  if (params.periodStart || params.period_start) {
    qs.set("period_start", params.periodStart || params.period_start);
  }
  if (params.productId != null || params.product_id != null) {
    qs.set("product_id", String(params.productId ?? params.product_id));
  }
  if (params.skuId != null || params.sku_id != null) {
    qs.set("sku_id", String(params.skuId ?? params.sku_id));
  }
  if (params.stockItemId != null || params.stock_item_id != null) {
    qs.set(
      "stock_item_id",
      String(params.stockItemId ?? params.stock_item_id),
    );
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

function navigateToCostingRoute(moduleKey, params = {}) {
  const config = COSTING_ROUTE_CONFIG[moduleKey];
  if (!config?.routePath) {
    showToast(`Route is not configured for ${moduleKey}.`, "error");
    return;
  }

  const clientKey = getCostingClientKey();
  const href = `${resolveCostingRouteHref(config.routePath, clientKey)}${buildCostingRouteQuery(params)}`;
  window.location.href = href;
}

function canUserTriggerCostingRefresh() {
  return PERM_CAN_EDIT || PERM_CONTROL_CENTER_EDIT;
}

function canEditMaterialCostActions() {
  if (CURRENT_LENS === "manual-rate-manager") {
    return PERM_CAN_EDIT;
  }
  if (CURRENT_LENS === "costing-review-workbench") {
    return PERM_CAN_EDIT || PERM_CONTROL_CENTER_EDIT;
  }
  return PERM_CAN_EDIT;
}

const COSTING_REFRESH_DIRTY_KEY = "costing-suite:refresh-dirty";
let costingRefreshDirty = false;
let costingRefreshDirtyReason = null;
let costingRefreshDirtyAt = null;

function loadCostingRefreshDirtyFromSession() {
  try {
    const raw = sessionStorage.getItem(COSTING_REFRESH_DIRTY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.dirty) {
      costingRefreshDirty = true;
      costingRefreshDirtyReason = parsed.reasonText || null;
      costingRefreshDirtyAt = parsed.markedAt || null;
    }
  } catch {
    /* ignore */
  }
}

function persistCostingRefreshDirtyToSession(source) {
  try {
    if (costingRefreshDirty) {
      sessionStorage.setItem(
        COSTING_REFRESH_DIRTY_KEY,
        JSON.stringify({
          dirty: true,
          reasonText: costingRefreshDirtyReason,
          source: source || "UNKNOWN",
          markedAt: costingRefreshDirtyAt,
        }),
      );
    } else {
      sessionStorage.removeItem(COSTING_REFRESH_DIRTY_KEY);
    }
  } catch {
    /* ignore */
  }
}

function isCostingRefreshDirty() {
  return costingRefreshDirty;
}

function markCostingRefreshDirty(reasonText, source = "UNKNOWN") {
  costingRefreshDirty = true;
  costingRefreshDirtyReason =
    reasonText ||
    "Costing changes were saved. Run costing refresh to apply them.";
  costingRefreshDirtyAt = new Date().toISOString();
  persistCostingRefreshDirtyToSession(source);
  updateCostingRefreshDirtyUi();
}

function clearCostingRefreshDirty() {
  costingRefreshDirty = false;
  costingRefreshDirtyReason = null;
  costingRefreshDirtyAt = null;
  persistCostingRefreshDirtyToSession();
  updateCostingRefreshDirtyUi();
}

function updateCostingRefreshDirtyUi() {
  if (refreshBtn) {
    refreshBtn.classList.toggle("costing-refresh-dirty", costingRefreshDirty);
    if (costingRefreshDirty) {
      const canRefresh = canUserTriggerCostingRefresh();
      refreshBtn.title = canRefresh
        ? "Material rate changes were saved. Run costing refresh to apply them to cost sheets and readiness counts."
        : "Refresh required. Ask an authorized user to run costing refresh.";
      refreshBtn.setAttribute("data-refresh-required", "true");
    } else {
      refreshBtn.removeAttribute("data-refresh-required");
      syncRefreshButtonDisabled();
    }
  }

  const lbl = lastRefreshed?.querySelector(".sc-snapshot-label");
  if (costingRefreshDirty) {
    if (lbl) lbl.textContent = "Refresh required";
    const statusDetail = $("sc-status-detail");
    if (statusDetail) {
      statusDetail.textContent =
        costingRefreshDirtyReason || "Refresh required after material rate change.";
    }
  } else {
    updateFreshnessIndicator();
  }
}

function applyRouteHeader() {
  document.title = ACTIVE_ROUTE_CONFIG.title;
  const h1 = document.querySelector(".page-header h1");
  if (h1) h1.textContent = ACTIVE_ROUTE_CONFIG.title;
  const subtitle = $("subtitle");
  if (subtitle) subtitle.textContent = ACTIVE_ROUTE_CONFIG.subtitle;
}

function shouldShowKpiStrip() {
  const dataAttr = document.body?.dataset?.costingShowKpi?.trim().toLowerCase();
  if (dataAttr === "false") return false;
  if (dataAttr === "true") return true;

  return ACTIVE_ROUTE_CONFIG?.moduleKey === "costing-control-center";
}

function applyKpiStripVisibility() {
  setVisible(kpiStripWrap, shouldShowKpiStrip(), "");
}

function applyRouteLaunchParams() {
  const qp = new URLSearchParams(window.location.search);
  const lens = qp.get("lens")?.trim();

  if (paramsFromQuery(qp, "status")) {
    ACTIVE_FILTERS.status = paramsFromQuery(qp, "status");
  }
  if (paramsFromQuery(qp, "issue")) {
    ACTIVE_FILTERS.issue = paramsFromQuery(qp, "issue");
  }
  if (paramsFromQuery(qp, "source")) {
    ACTIVE_FILTERS.source = paramsFromQuery(qp, "source");
  }

  const policyTab = qp.get("policyTab")?.trim();
  if (policyTab === "sku-overview") {
    pricingPolicyCtrl.setPolicyManagerTab("sku-overview");
  }

  const queryDrill = normalizeDrillContext({
    manager_tab: qp.get("manager_tab"),
    trace_component: qp.get("trace_component"),
    material_area: qp.get("material_area"),
    period_start: qp.get("period_start"),
    product_id: qp.get("product_id"),
    sku_id: qp.get("sku_id"),
    stock_item_id: qp.get("stock_item_id"),
    policyTab,
  });
  LAUNCH_DRILL_CONTEXT = mergeDrillContext(LAUNCH_DRILL_CONTEXT, queryDrill);
  applyPendingDrillContext();

  if (LAUNCH_DRILL_CONTEXT?.managerTab) {
    materialCostCtrl.setManualRateManagerTab(LAUNCH_DRILL_CONTEXT.managerTab);
  }

  if (!lens) {
    CURRENT_LENS = ACTIVE_ROUTE_CONFIG.defaultLens;
    return;
  }

  if (isLensAllowedForRoute(lens)) {
    CURRENT_LENS = lens;
    return;
  }

  showToast(
    `Lens "${lens}" is not available on this route. Showing the default view instead.`,
    "warning",
    4200,
  );
  CURRENT_LENS = ACTIVE_ROUTE_CONFIG.defaultLens;
}

function paramsFromQuery(qp, key) {
  const raw = qp.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => normalizeStatus(value.trim()))
    .filter(Boolean);
}

async function drillToCostingTarget(moduleKey, lensId, filters = {}) {
  const normalizedFilters = normalizeDrillContext(filters);

  const canStayOnRoute = ACTIVE_ROUTE_CONFIG.moduleKey === moduleKey;

  if (!canStayOnRoute) {
    const params = {
      lens: lensId,
      status: normalizedFilters.status,
      issue: normalizedFilters.issue,
      source: normalizedFilters.source,
    };
    if (normalizedFilters.policyTab) {
      params.policyTab = normalizedFilters.policyTab;
    } else if (
      moduleKey === "pricing-policy-manager" &&
      (lensId === "policy-manager" || lensId === "scheme-comparison")
    ) {
      params.policyTab = "sku-overview";
    }
    if (normalizedFilters.managerTab) {
      params.managerTab = normalizedFilters.managerTab;
    }
    if (normalizedFilters.traceComponent) {
      params.traceComponent = normalizedFilters.traceComponent;
    }
    if (normalizedFilters.materialArea) {
      params.materialArea = normalizedFilters.materialArea;
    }
    if (normalizedFilters.periodStart) {
      params.periodStart = normalizedFilters.periodStart;
    }
    if (normalizedFilters.productId != null) {
      params.productId = normalizedFilters.productId;
    }
    if (normalizedFilters.skuId != null) {
      params.skuId = normalizedFilters.skuId;
    }
    if (normalizedFilters.stockItemId != null) {
      params.stockItemId = normalizedFilters.stockItemId;
    }
    navigateToCostingRoute(moduleKey, params);
    return;
  }

  ACTIVE_FILTERS = {
    status: normalizedFilters.status,
    issue: normalizedFilters.issue,
    source: normalizedFilters.source,
  };
  syncFilterCheckboxes();

  if (moduleKey === "pricing-policy-manager" && lensId === "policy-manager") {
    if (normalizedFilters.policyTab) {
      pricingPolicyCtrl.setPolicyManagerTab(normalizedFilters.policyTab);
    } else {
      pricingPolicyCtrl.setPolicyManagerTab("sku-overview");
    }
  }

  if (moduleKey === "material-cost-manager") {
    if (lensId === "manual-rate-manager" && normalizedFilters.managerTab) {
      materialCostCtrl.setManualRateManagerTab(normalizedFilters.managerTab);
    }
    if (lensId === "rm-cost-trace") {
      materialCostCtrl.applyTraceLaunchContext(normalizedFilters);
    }
    if (normalizedFilters.periodStart && lensId === "rm-cost-trace") {
      ACTIVE_PERIOD_START = normalizedFilters.periodStart;
      renderCostingPeriodOptions();
      syncPeriodControlState();
    }
  }

  if (CURRENT_LENS !== lensId) {
    await switchLens(lensId);
  } else {
    applyFilters();
  }

  searchBox?.focus();
}

let LENSES = buildActiveLenses();

const VIEW_BY_LENS = {
  dashboard: "v_costing_pricing_dashboard_summary",
  "sku-cost-sheet": "v_costing_pricing_sku_selector",
  "printable-cost-sheet": "v_costing_pricing_printable_cost_sheet_lines",
  "cost-comparison": "v_cost_sheet_snapshot_sku_monthly_comparison",
  "policy-manager": "v_costing_policy_manager_sku_overview",
  "scheme-comparison": "v_costing_pricing_sku_scheme_comparison",
  "cost-governance": "v_costing_unmapped_expense_heads_for_mapping",
  "staff-governance": "v_costing_unclassified_staff_for_costing",
  "manual-provisions": "v_costing_manual_cost_pool_provision_register",
  "costing-review-workbench":
    "v_costing_pricing_material_action_queue_snapshot",
  "manual-rate-manager": "v_costing_manual_rate_manager_action_queue",
};

const PERIOD_PICKER_DISABLED_TITLE =
  "Period selection is not available on this tab";

function costingFrom(viewName) {
  return supabase.from(viewName);
}

async function costingRpc(name, params, options = null) {
  let query = supabase.rpc(name, params);
  if (
    options &&
    Number.isFinite(Number(options.rangeFrom)) &&
    Number.isFinite(Number(options.rangeTo))
  ) {
    query = query.range(Number(options.rangeFrom), Number(options.rangeTo));
  }
  return query;
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRefreshStatusRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function parseRefreshOutputJson(row) {
  const raw = row?.output_json ?? row?.final_output_json ?? null;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveRefreshOverallStatus(statusRow) {
  if (!statusRow) return "";

  const raw =
    statusRow.overall_status ??
    statusRow.run_overall_status ??
    statusRow.status ??
    "";
  const overall = normalizeStatus(raw);
  if (overall) return overall;

  if (statusRow.finished_at || statusRow.refresh_finished_at) {
    return "SUCCESS";
  }

  return "";
}

function extractFinalStageOutput(statusRow) {
  const stages = statusRow?.stages || statusRow?.stage_rows || [];
  if (!Array.isArray(stages) || !stages.length) return null;

  const finalStage =
    stages.find(
      (stage) =>
        (stage.stage_code || stage.stageCode) === "06_FINAL_STATUS_CHECK",
    ) || null;

  return finalStage ? parseRefreshOutputJson(finalStage) : null;
}

function extractRefreshFinalCounts(statusRow) {
  const output = parseRefreshOutputJson(statusRow);
  const finalStageOutput = extractFinalStageOutput(statusRow);

  return {
    blocked:
      statusRow?.final_blocked_count ??
      output?.final_blocked_count ??
      finalStageOutput?.final_blocked_count ??
      null,
    reviewRequired:
      statusRow?.final_review_required_count ??
      output?.final_review_required_count ??
      finalStageOutput?.final_review_required_count ??
      null,
    ready:
      statusRow?.final_ready_count ??
      output?.final_ready_count ??
      finalStageOutput?.final_ready_count ??
      null,
    controlStatus: normalizeStatus(
      output?.overall_control_status ??
        finalStageOutput?.overall_control_status ??
        statusRow?.overall_control_status,
    ),
  };
}

function isRefreshRunActiveStatus(status) {
  return COSTING_REFRESH_ACTIVE_STATUSES.has(normalizeStatus(status));
}

function isRefreshRunTerminalStatus(status) {
  return COSTING_REFRESH_TERMINAL_STATUSES.has(normalizeStatus(status));
}

function clearCompletedRefreshRunIfNeeded(statusRow) {
  const overall = resolveRefreshOverallStatus(statusRow);
  if (!isRefreshRunTerminalStatus(overall)) return false;
  clearActiveRefreshRunSession();
  syncRefreshButtonDisabled();
  return true;
}

function reconcileActiveRefreshRunStatus(statusRow) {
  const overall = resolveRefreshOverallStatus(statusRow);

  if (overall === "SUCCESS" || overall === "PARTIAL_SUCCESS") {
    clearActiveRefreshRunSession();
    clearCostingRefreshDirty();
    clearStatus();
    syncRefreshButtonDisabled();
    updateCostingRefreshDirtyUi();
    return { overall, terminal: true, success: true };
  }

  if (isRefreshRunActiveStatus(overall)) {
    return { overall, terminal: false, active: true };
  }

  if (isRefreshRunTerminalStatus(overall)) {
    clearActiveRefreshRunSession();
    syncRefreshButtonDisabled();
    return { overall, terminal: true, success: false };
  }

  if (!overall) {
    clearActiveRefreshRunSession();
    syncRefreshButtonDisabled();
    clearStatus();
    return { overall, terminal: false, unknown: true };
  }

  return { overall, terminal: false };
}

function extractRefreshRunId(row) {
  if (!row) return null;
  const id = row.refresh_run_id ?? row.p_refresh_run_id ?? row.run_id;
  if (id === null || id === undefined || id === "") return null;
  return id;
}

function saveActiveRefreshRunToSession(run) {
  if (!run?.refreshRunId) return;
  try {
    sessionStorage.setItem(COSTING_REFRESH_SESSION_KEY, JSON.stringify(run));
  } catch (err) {
    console.warn("[costing-suite] Failed to persist refresh run", err);
  }
}

function loadActiveRefreshRunFromSession() {
  try {
    const raw = sessionStorage.getItem(COSTING_REFRESH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.refreshRunId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearActiveRefreshRunSession() {
  try {
    sessionStorage.removeItem(COSTING_REFRESH_SESSION_KEY);
  } catch {
    /* ignore */
  }
  ACTIVE_REFRESH_RUN = null;
}

function syncRefreshButtonDisabled() {
  if (!refreshBtn) return;
  const status = ACTIVE_REFRESH_RUN?.overallStatus;
  const refreshLocked =
    refreshPollInFlight || isRefreshRunActiveStatus(status);
  const canRefresh = canUserTriggerCostingRefresh();
  refreshBtn.disabled = refreshLocked || !canRefresh;
  refreshBtn.title = !canRefresh
    ? "Request Costing Refresh requires Control Center edit access"
    : "Request Costing Refresh";
  refreshBtn.setAttribute(
    "aria-disabled",
    refreshBtn.disabled ? "true" : "false",
  );
  if (costingRefreshDirty) {
    refreshBtn.classList.add("costing-refresh-dirty");
    refreshBtn.title = canRefresh
      ? "Material rate changes were saved. Run costing refresh to apply them to cost sheets and readiness counts."
      : "Refresh required. Ask an authorized user to run costing refresh.";
  }
}

async function requestStagedCostingRefresh(options = {}) {
  const periodStart =
    options.periodStart || ACTIVE_PERIOD_START || getCurrentMonthStart();
  const scope = options.scope || COSTING_REFRESH_SCOPE;
  const sourceTrigger = options.sourceTrigger || "UI_TOOLBAR";
  const requestNote = options.requestNote ?? null;

  const { data, error } = await costingRpc("rpc_request_costing_refresh", {
    p_period_start: periodStart,
    p_requested_scope: scope,
    p_source_trigger: sourceTrigger,
    p_request_note: requestNote,
  });

  if (error) throw error;
  return normalizeRefreshStatusRow(data);
}

async function getCostingRefreshStatus(options = {}) {
  const refreshRunId = options.refreshRunId;
  const periodStart =
    options.periodStart || ACTIVE_PERIOD_START || getCurrentMonthStart();
  const scope = options.scope || COSTING_REFRESH_SCOPE;

  const { data, error } = await costingRpc("rpc_get_costing_refresh_status", {
    p_refresh_run_id: refreshRunId,
    p_period_start: periodStart,
    p_requested_scope: scope,
  });

  if (error) throw error;
  return normalizeRefreshStatusRow(data);
}

function getCurrentRefreshStageInfo(statusRow) {
  const overall = resolveRefreshOverallStatus(statusRow);
  if (isRefreshRunTerminalStatus(overall)) {
    return { code: "", label: "", status: "" };
  }

  const explicitCode =
    statusRow?.current_stage_code ||
    statusRow?.active_stage_code ||
    statusRow?.stage_code ||
    "";

  if (overall === "RUNNING") {
    const stages = statusRow?.stages || statusRow?.stage_rows || [];
    if (Array.isArray(stages) && stages.length) {
      const running = stages.find(
        (stage) =>
          normalizeStatus(stage.stage_status || stage.status) === "RUNNING",
      );
      const queued = stages.find(
        (stage) =>
          normalizeStatus(stage.stage_status || stage.status) === "QUEUED",
      );
      const current = running || queued;
      if (current) {
        const code = current.stage_code || current.stageCode || "";
        return {
          code,
          label: COSTING_REFRESH_STAGE_LABELS[code] || code || "stage",
          status: current.stage_status || current.status || "",
        };
      }
    }

    if (explicitCode) {
      return {
        code: explicitCode,
        label: COSTING_REFRESH_STAGE_LABELS[explicitCode] || explicitCode,
        status: statusRow?.current_stage_status || "RUNNING",
      };
    }

    return { code: "", label: "", status: "RUNNING" };
  }

  if (overall === "QUEUED" && explicitCode) {
    return {
      code: explicitCode,
      label: COSTING_REFRESH_STAGE_LABELS[explicitCode] || explicitCode,
      status: "QUEUED",
    };
  }

  return { code: "", label: "", status: "" };
}

function renderCostingRefreshProgress(statusRow) {
  if (!statusRow) return "Costing refresh status unavailable.";

  const overall = resolveRefreshOverallStatus(statusRow);

  if (isRefreshRunTerminalStatus(overall)) {
    return formatCostingRefreshRunMessage(statusRow);
  }

  if (overall === "QUEUED") {
    return "Costing refresh queued — waiting for server cron to start the next stage.";
  }

  if (overall === "RUNNING") {
    const stage = getCurrentRefreshStageInfo(statusRow);
    if (stage.code) {
      return `Costing refresh running: ${stage.code} ${stage.label}.`;
    }
    return "Costing refresh running.";
  }

  return "Costing refresh status unavailable.";
}

function formatCostingRefreshRunMessage(statusRow, options = {}) {
  if (!statusRow) {
    return options.timedOut
      ? "Costing refresh is still queued or running and will continue in the background by cron."
      : "Costing refresh status unavailable.";
  }

  const overall = resolveRefreshOverallStatus(statusRow);

  if (options.timedOut && isRefreshRunActiveStatus(overall)) {
    return "Costing refresh is still queued or running and will continue in the background by cron.";
  }

  const counts = extractRefreshFinalCounts(statusRow);

  if (overall === "FAILED") {
    const stage =
      statusRow.error_stage_code || statusRow.failed_stage_code || "-";
    const message =
      statusRow.error_message || statusRow.failure_message || "Unknown error.";
    return `Costing refresh failed at stage ${stage}: ${message}`;
  }

  if (overall === "CANCELLED") {
    return "Costing refresh was cancelled.";
  }

  if (overall === "SKIPPED_ALREADY_RUNNING") {
    return "Another costing refresh is already running.";
  }

  if (overall === "SUCCESS" || overall === "PARTIAL_SUCCESS") {
    const hasBusinessBlockers =
      counts.controlStatus === "BLOCKED" || Number(counts.blocked) > 0;

    if (hasBusinessBlockers) {
      return `Costing refresh completed, but costing remains blocked: ${counts.blocked ?? "-"} blocked, ${counts.reviewRequired ?? "-"} review-required, ${counts.ready ?? "-"} ready.`;
    }

    if (overall === "PARTIAL_SUCCESS") {
      return "Costing refresh completed with partial success.";
    }

    return "Costing refresh completed successfully.";
  }

  if (isRefreshRunActiveStatus(overall)) {
    return renderCostingRefreshProgress(statusRow);
  }

  return `Costing refresh status: ${overall || "unknown"}.`;
}

async function reloadCostingUiAfterRefreshRun() {
  costSheetCtrl.invalidatePrintableLinesCache();
  await loadRowsForLens();
  await refreshOpenDrawerIfNeeded();
  LAST_REFRESH_TIME = new Date();
  updateFreshnessIndicator();
}

async function pollCostingRefreshRun(refreshRunId, options = {}) {
  const periodStart =
    options.periodStart || ACTIVE_PERIOD_START || getCurrentMonthStart();
  const scope = options.scope || COSTING_REFRESH_SCOPE;
  const maxWaitMs = options.maxWaitMs ?? COSTING_REFRESH_MAX_WAIT_MS;
  const pollMs = options.pollMs ?? COSTING_REFRESH_POLL_MS;
  const onProgress = options.onProgress;
  const startedAt = Date.now();

  let statusRow = await getCostingRefreshStatus({
    refreshRunId,
    periodStart,
    scope,
  });

  while (true) {
    const overall = resolveRefreshOverallStatus(statusRow);

    if (isRefreshRunTerminalStatus(overall)) {
      clearCompletedRefreshRunIfNeeded(statusRow);
      syncRefreshButtonDisabled();
      return { statusRow, timedOut: false, terminal: true };
    }

    if (onProgress) onProgress(statusRow);

    if (Date.now() - startedAt >= maxWaitMs) {
      return { statusRow, timedOut: true, terminal: false };
    }

    await sleepMs(pollMs);
    statusRow = await getCostingRefreshStatus({
      refreshRunId,
      periodStart,
      scope,
    });
  }
}

async function handleRefreshRunOutcome(pollResult, options = {}) {
  const { statusRow, timedOut, terminal } = pollResult || {};
  const overall = resolveRefreshOverallStatus(statusRow);
  const message = formatCostingRefreshRunMessage(statusRow, { timedOut });
  const shouldReload =
    !timedOut &&
    (overall === "SUCCESS" || overall === "PARTIAL_SUCCESS");

  if (shouldReload) {
    setCostingRefreshOverlayTerminalState(statusRow, { overall, timedOut: false });
    clearActiveRefreshRunSession();
    clearCostingRefreshDirty();
    try {
      if (!options.skipReload) {
        await reloadCostingUiAfterRefreshRun();
      }
    } finally {
      syncRefreshButtonDisabled();
      updateCostingRefreshDirtyUi();
    }
    clearStatus();
    showToast(message, overall === "SUCCESS" ? "success" : "info", 9000, true);
    return;
  }

  if (timedOut && isRefreshRunActiveStatus(overall)) {
    setCostingRefreshOverlayTerminalState(statusRow, { timedOut: true, overall });
    showToast(message, "info", 9000, true);
    return;
  }

  if (isRefreshRunTerminalStatus(overall)) {
    clearCompletedRefreshRunIfNeeded(statusRow);
    syncRefreshButtonDisabled();
    const statusType = overall === "FAILED" ? "error" : "info";
    setCostingRefreshOverlayTerminalState(statusRow, { overall, timedOut: false });
    showToast(message, statusType, 9000, true);
    return;
  }

  if (terminal) {
    clearActiveRefreshRunSession();
    syncRefreshButtonDisabled();
    setCostingRefreshOverlayTerminalState(statusRow, { overall, timedOut: false });
    showToast(message, "info", 9000, true);
    return;
  }

  setCostingRefreshOverlayTerminalState(statusRow, { overall, timedOut: false });
  showToast(message, "info", 9000, true);
}

async function runStagedCostingRefreshAndReload(options = {}) {
  const periodStart =
    options.periodStart || ACTIVE_PERIOD_START || getCurrentMonthStart();
  const scope = options.scope || COSTING_REFRESH_SCOPE;
  const sourceTrigger = options.sourceTrigger || "UI_TOOLBAR";
  const requestNote = options.requestNote ?? null;
  const skipReload = !!options.skipReload;

  if (refreshPollInFlight) {
    showToast("Costing refresh is already in progress.", "info", 4200);
    return;
  }

  refreshPollInFlight = true;
  syncRefreshButtonDisabled();
  showCostingRefreshOverlay(null, { requesting: true, periodStart });

  let statusRow = null;

  try {
    let refreshRunId = null;
    const saved = loadActiveRefreshRunFromSession();

    if (saved?.refreshRunId) {
      try {
        statusRow = await getCostingRefreshStatus({
          refreshRunId: saved.refreshRunId,
          periodStart: saved.periodStart || periodStart,
          scope: saved.scope || scope,
        });
        const savedOverall = resolveRefreshOverallStatus(statusRow);
        if (isRefreshRunTerminalStatus(savedOverall)) {
          clearCompletedRefreshRunIfNeeded(statusRow);
          statusRow = null;
        } else if (isRefreshRunActiveStatus(savedOverall)) {
          refreshRunId = saved.refreshRunId;
          ACTIVE_REFRESH_RUN = {
            refreshRunId,
            periodStart: saved.periodStart || periodStart,
            scope: saved.scope || scope,
            sourceTrigger: saved.sourceTrigger || sourceTrigger,
            overallStatus: savedOverall,
          };
          showToast("Resuming in-progress costing refresh.", "info", 4200);
          showCostingRefreshOverlay(statusRow, { periodStart });
        } else {
          clearActiveRefreshRunSession();
        }
      } catch (err) {
        console.warn(
          "[costing-suite] Failed to read saved refresh run status",
          err,
        );
        clearActiveRefreshRunSession();
      }
    }

    if (!refreshRunId) {
      statusRow = await requestStagedCostingRefresh({
        periodStart,
        scope,
        sourceTrigger,
        requestNote,
      });
      refreshRunId = extractRefreshRunId(statusRow);
      if (!refreshRunId) {
        throw new Error("Refresh request did not return a refresh run id.");
      }
    }

    let overall = resolveRefreshOverallStatus(statusRow);

    if (isRefreshRunTerminalStatus(overall)) {
      clearCompletedRefreshRunIfNeeded(statusRow);
      syncRefreshButtonDisabled();
      await handleRefreshRunOutcome(
        { statusRow, timedOut: false, terminal: true },
        { skipReload },
      );
      return;
    }

    ACTIVE_REFRESH_RUN = {
      refreshRunId,
      periodStart,
      scope,
      sourceTrigger,
      overallStatus: overall,
    };
    saveActiveRefreshRunToSession(ACTIVE_REFRESH_RUN);
    syncRefreshButtonDisabled();
    updateCostingRefreshOverlay(statusRow, { periodStart });

    let pollResult;

    if (overall === "SKIPPED_ALREADY_RUNNING") {
      const existingId = extractRefreshRunId(statusRow);
      if (existingId) {
        refreshRunId = existingId;
        statusRow = await getCostingRefreshStatus({
          refreshRunId,
          periodStart,
          scope,
        });
        overall = resolveRefreshOverallStatus(statusRow);
        ACTIVE_REFRESH_RUN = {
          refreshRunId,
          periodStart,
          scope,
          sourceTrigger,
          overallStatus: overall,
        };
        saveActiveRefreshRunToSession(ACTIVE_REFRESH_RUN);
      }
    }

    if (isRefreshRunTerminalStatus(overall)) {
      pollResult = { statusRow, timedOut: false, terminal: true };
    } else {
      showCostingRefreshOverlay(statusRow, { periodStart });

      pollResult = await pollCostingRefreshRun(refreshRunId, {
        periodStart,
        scope,
        onProgress: (row) => {
          const rowOverall = resolveRefreshOverallStatus(row);
          if (isRefreshRunTerminalStatus(rowOverall)) return;
          if (!isRefreshRunActiveStatus(rowOverall)) return;

          ACTIVE_REFRESH_RUN = {
            ...ACTIVE_REFRESH_RUN,
            overallStatus: rowOverall,
          };
          saveActiveRefreshRunToSession(ACTIVE_REFRESH_RUN);
          updateCostingRefreshOverlay(row, { periodStart });
        },
      });
    }

    await handleRefreshRunOutcome(pollResult, { skipReload });
  } catch (err) {
    console.error("[costing-suite] Costing refresh failed", err);
    const detail = err?.message
      ? `Costing refresh failed: ${err.message}`
      : "Costing refresh failed.";
    setCostingRefreshOverlayTerminalState(statusRow, {
      overall: "FAILED",
      message: detail,
    });
    showToast("Costing refresh failed", "error", 4200);
  } finally {
    refreshPollInFlight = false;
    syncRefreshButtonDisabled();
  }
}

async function resumeInFlightRefreshRunIfNeeded() {
  const saved = loadActiveRefreshRunFromSession();
  if (!saved?.refreshRunId || refreshPollInFlight) return;

  try {
    const statusRow = await getCostingRefreshStatus({
      refreshRunId: saved.refreshRunId,
      periodStart: saved.periodStart,
      scope: saved.scope || COSTING_REFRESH_SCOPE,
    });
    const reconciled = reconcileActiveRefreshRunStatus(statusRow);
    const overall = reconciled.overall;

    if (reconciled.terminal || reconciled.unknown || !reconciled.active) {
      return;
    }

    ACTIVE_REFRESH_RUN = {
      ...saved,
      overallStatus: overall,
    };
    syncRefreshButtonDisabled();
    showCostingRefreshOverlay(statusRow, {
      periodStart: saved.periodStart,
    });

    refreshPollInFlight = true;
    syncRefreshButtonDisabled();

    const pollResult = await pollCostingRefreshRun(saved.refreshRunId, {
      periodStart: saved.periodStart,
      scope: saved.scope || COSTING_REFRESH_SCOPE,
      onProgress: (row) => {
        const rowOverall = resolveRefreshOverallStatus(row);
        if (isRefreshRunTerminalStatus(rowOverall)) return;
        if (!isRefreshRunActiveStatus(rowOverall)) return;

        ACTIVE_REFRESH_RUN = {
          ...ACTIVE_REFRESH_RUN,
          overallStatus: rowOverall,
        };
        saveActiveRefreshRunToSession(ACTIVE_REFRESH_RUN);
        updateCostingRefreshOverlay(row, { periodStart: saved.periodStart });
      },
    });

    await handleRefreshRunOutcome(pollResult);
  } catch (err) {
    console.warn("[costing-suite] Failed to resume refresh run", err);
  } finally {
    refreshPollInFlight = false;
    syncRefreshButtonDisabled();
  }
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function text(value, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(value);
}

function cpCellPrimary(value, fallback = "--") {
  return `<span class="cp-cell-primary">${text(value, fallback)}</span>`;
}

function cpCellPrimaryHtml(html) {
  return `<span class="cp-cell-primary">${html}</span>`;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOptionalMoney(value) {
  if (value === null || value === undefined || value === "") {
    return '<span class="cp-muted-text">Not set</span>';
  }
  return formatMoney(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleString("en-IN");
}

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function statusTokenMatches(entry, wanted) {
  const e = normalizeStatus(entry);
  const w = normalizeStatus(wanted);

  if (!e || !w) return false;
  if (e === w) return true;

  const equivalents = {
    BLOCKER: ["BLOCKER", "BLOCKED"],
    BLOCKED: ["BLOCKER", "BLOCKED"],
    REVIEW_REQUIRED: ["REVIEW_REQUIRED", "REVIEW"],
    READY: ["READY", "OK", "SUCCESS", "ACCEPTABLE", "COMMERCIALLY_ACCEPTABLE"],
  };

  const allowed = equivalents[w] || [w];
  return allowed.some((token) => e === token || e.includes(token));
}
function statusClass(status) {
  const s = normalizeStatus(status);
  if (s === "ACTIVE") return "green";
  if (s === "ZERO_AMOUNT") return "amber";
  if (s === "INACTIVE") return "gray";
  if (s.includes("MANUAL")) return "indigo";
  if (
    s === "READY" ||
    s === "SUCCESS" ||
    s === "OK" ||
    s === "ACCEPTABLE" ||
    s === "COMMERCIALLY_ACCEPTABLE"
  )
    return "green";
  if (
    s === "REVIEW_REQUIRED" ||
    s === "REVIEW_COST_INPUTS" ||
    s === "LOW_MARGIN" ||
    s === "REVIEW_COMMERCIAL_MARGIN" ||
    s === "WARNING" ||
    s.includes("REVIEW")
  )
    return "amber";
  if (
    s === "BLOCKER" ||
    s === "BLOCKED" ||
    s === "FAILED" ||
    s === "ERROR" ||
    s === "COMPLETE_MISSING_COST_DATA" ||
    s === "NOT_ACCEPTABLE" ||
    s === "REJECT_OR_REPRICE"
  )
    return "red";
  if (s === "NOT_EVALUATED") return "gray";
  if (s.includes("SCHEME")) return "indigo";
  return "gray";
}

function getStatusClass(status) {
  return statusClass(status);
}

function laneClass(row) {
  const status = getRowStatus(row);
  const cls = statusClass(status);
  if (cls === "green") return "ready";
  if (cls === "amber") return "review";
  if (cls === "red") return "blocked";
  if (cls === "indigo") return "scheme";
  return "";
}

function statusChip(status) {
  if (!status) return '<span class="status-chip gray">--</span>';
  return `<span class="status-chip ${getStatusClass(status)}">${text(status)}</span>`;
}

function compactStatusText(status) {
  if (!status)
    return '<span class="status-chip gray cp-status-chip-compact">--</span>';
  const cls = getStatusClass(status);
  return `<span class="status-chip ${cls} cp-status-chip-compact">${text(status)}</span>`;
}

function marginBandChip(value) {
  if (!value) return '<span class="status-chip gray">--</span>';
  const v = normalizeStatus(value);
  const cls =
    v.includes("NEG") || v.includes("LOW") || v.includes("LOSS")
      ? "red"
      : v.includes("WATCH") || v.includes("MID")
        ? "amber"
        : "green";
  return `<span class="status-chip ${cls}">${text(value)}</span>`;
}

function issueCodeLabel(code) {
  if (!code) return "--";
  return String(code).replace(/_/g, " ");
}

function setStatus(message, type = "info") {
  if (!statusArea) return;
  const colors = {
    error: "#b91c1c",
    warning: "#b45309",
    success: "#15803d",
  };
  const color = colors[type] || "var(--muted, #6b7280)";
  statusArea.style.display = "block";
  statusArea.style.color = color;
  statusArea.innerHTML = escapeHtml(message);
}

function clearStatus() {
  if (statusArea) statusArea.style.display = "none";
}

function setLoadingMask(visible, message = "Loading...") {
  if (!costingLoadingMask) return;
  if (costingLoadingText) costingLoadingText.textContent = message;
  costingLoadingMask.classList.toggle("hidden", !visible);
  costingLoadingMask.setAttribute("aria-busy", visible ? "true" : "false");
}

function formatPeriodMonth(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function getExportedAtIst() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function toKebabSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatTodayIsoIst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

function getCurrentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function loadPermissions(sessionUserId) {
  PERM_CAN_VIEW = true;
  PERM_CAN_EDIT = false;
  PERM_CONTROL_CENTER_EDIT = false;
  CAN_VIEW_TRACE = false;
  CAN_EXPORT_TRACE = false;
  TRACE_PERMISSIONS_RESOLVED = false;

  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: sessionUserId,
    });
    if (!error && Array.isArray(perms)) {
      applyPermissionEntriesFromRpc(perms);
      TRACE_PERMISSIONS_RESOLVED = true;
      syncRefreshButtonDisabled();
      syncTraceExportButtonState();
      return;
    }
    if (error) console.warn("[costing-suite] permission RPC failed", error);
  } catch (err) {
    console.warn("[costing-suite] permission RPC exception", err);
  }

  try {
    const { data } = await supabase
      .from("user_permissions")
      .select("module_id, can_view, can_edit")
      .eq("user_id", sessionUserId)
      .eq("module_id", MODULE_ID)
      .limit(1);
    if (Array.isArray(data) && data.length) {
      PERM_CAN_VIEW = !!data[0].can_view;
      PERM_CAN_EDIT = !!data[0].can_edit;
    }
  } catch (err) {
    console.warn("[costing-suite] permission fallback failed", err);
  }

  TRACE_PERMISSIONS_RESOLVED = true;
  syncRefreshButtonDisabled();
  syncTraceExportButtonState();
}

function applyPermissionEntriesFromRpc(perms) {
  const byTarget = new Map(
    perms.filter((row) => row?.target).map((row) => [row.target, row]),
  );

  const routeEntry = byTarget.get(ACTIVE_ROUTE_CONFIG.permissionTarget);
  if (routeEntry) {
    PERM_CAN_VIEW = !!routeEntry.can_view;
    PERM_CAN_EDIT = !!routeEntry.can_edit;
  }

  const controlCenterEntry = byTarget.get("module:costing-control-center");
  PERM_CONTROL_CENTER_EDIT = !!controlCenterEntry?.can_edit;

  const traceViewEntry = byTarget.get("role:material-cost-rm-trace");
  CAN_VIEW_TRACE = traceViewEntry?.can_view === true;

  const traceExportEntry = byTarget.get("role:material-cost-rm-trace-export");
  CAN_EXPORT_TRACE = traceExportEntry?.can_view === true;
}

async function resolveActivePeriodStart() {
  const currentMonth = getCurrentMonthStart();

  try {
    const { data: currentRows, error: currentErr } = await costingFrom(
      "v_costing_pricing_control_dashboard_snapshot",
    )
      .select("period_start")
      .eq("period_start", currentMonth)
      .limit(1);
    if (currentErr) throw currentErr;
    if (currentRows?.length) return currentMonth;

    const { data: latestRows, error: latestErr } = await costingFrom(
      "v_costing_pricing_control_dashboard_snapshot",
    )
      .select("period_start")
      .order("period_start", { ascending: false })
      .limit(1);
    if (latestErr) throw latestErr;
    if (latestRows?.[0]?.period_start) return latestRows[0].period_start;
    return currentMonth;
  } catch (err) {
    console.warn("Control dashboard snapshot period resolution failed", err);
  }

  const { data: fallbackRows, error: fallbackErr } = await costingFrom(
    "v_costing_pricing_dashboard_summary",
  )
    .select("period_start")
    .order("period_start", { ascending: false })
    .limit(1);
  if (fallbackErr) throw fallbackErr;
  return fallbackRows?.[0]?.period_start || currentMonth;
}

function isRmCostTraceLensActive() {
  return CURRENT_LENS === "rm-cost-trace";
}

function isPeriodScopedLens() {
  if (isLensPeriodScoped(CURRENT_LENS)) return true;
  if (
    CURRENT_LENS === "cost-governance" &&
    costBuildCtrl.getCostGovernanceTab() === "cost-pool-summary"
  ) {
    return true;
  }
  if (
    CURRENT_LENS === "staff-governance" &&
    costBuildCtrl.getStaffGovernanceTab() === "staff-pool-summary"
  ) {
    return true;
  }
  return false;
}

async function loadAvailableCostingPeriods() {
  try {
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_control_dashboard_snapshot")
          .select("period_start")
          .order("period_start", { ascending: false }),
      500,
    );
    AVAILABLE_COSTING_PERIODS = [
      ...new Set(
        rows.map((row) => normalizeMonthStart(row?.period_start)).filter(Boolean),
      ),
    ];
  } catch (err) {
    console.warn("[costing-suite] Failed to load costing periods", err);
    AVAILABLE_COSTING_PERIODS = [];
  }
  renderCostingPeriodOptions();
}

function renderCostingPeriodOptions() {
  if (!costingPeriodSelect) return;

  const periods = [...AVAILABLE_COSTING_PERIODS];
  const active = normalizeMonthStart(ACTIVE_PERIOD_START);
  if (active && !periods.includes(active)) {
    periods.push(active);
    periods.sort((a, b) => String(b).localeCompare(String(a)));
  }

  if (!periods.length) {
    costingPeriodSelect.innerHTML = `<option value="">No periods</option>`;
    return;
  }

  costingPeriodSelect.innerHTML = periods
    .map(
      (period) =>
        `<option value="${escapeHtml(period)}">${escapeHtml(formatPeriodMonth(period))}</option>`,
    )
    .join("");

  if (active) costingPeriodSelect.value = active;
}

function syncPeriodControlState() {
  const scoped = isPeriodScopedLens();

  if (costingPeriodSelect) {
    costingPeriodSelect.disabled = !scoped;
    costingPeriodSelect.title = scoped
      ? "Select costing period"
      : PERIOD_PICKER_DISABLED_TITLE;
    if (ACTIVE_PERIOD_START) {
      costingPeriodSelect.value = normalizeMonthStart(ACTIVE_PERIOD_START);
    }
  }
}

async function setActiveCostingPeriod(periodStart) {
  const normalized = normalizeMonthStart(periodStart);
  if (!normalized || normalized === ACTIVE_PERIOD_START) return;

  ACTIVE_PERIOD_START = normalized;
  costBuildCtrl.setManualProvisionPeriodFilter(normalized);
  costSheetCtrl.invalidatePrintableLinesCache();
  renderCostingPeriodOptions();
  syncPeriodControlState();

  try {
    await loadRowsForLens();
    await refreshOpenDrawerIfNeeded();
  } catch (err) {
    handleError("Failed to load costing period", err);
  }
}

async function fetchAllRows(queryBuilderFactory, pageSize = 1000) {
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const query = queryBuilderFactory().range(from, to);
    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function normalizeMonthStart(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  }
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-01`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function setVisible(el, visible, displayValue = "") {
  if (!el) return;
  el.classList.toggle("hidden", !visible);
  el.style.display = visible ? displayValue : "none";
}

async function loadSkuStatusDiagnosis(periodStart) {
  try {
    SKU_STATUS_DIAGNOSIS = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_sku_status_diagnosis")
          .select("*")
          .eq("period_start", periodStart)
          .order("product_name", { ascending: true })
          .order("pack_size", { ascending: true }),
      1000,
    );
    DIAGNOSIS_BY_SKU_ID = new Map(
      SKU_STATUS_DIAGNOSIS.map((row) => [Number(row.sku_id), row]),
    );
  } catch (err) {
    SKU_STATUS_DIAGNOSIS = [];
    DIAGNOSIS_BY_SKU_ID = new Map();
    console.error("Costing diagnosis could not be loaded", err);
    showToast(
      "Costing diagnosis could not be loaded. Existing cost and scheme data are still displayed.",
      "warning",
      5200,
    );
  }
}

function getSkuDiagnosis(skuId, periodStart = ACTIVE_PERIOD_START) {
  const row = DIAGNOSIS_BY_SKU_ID.get(Number(skuId));
  if (!row) return null;
  if (periodStart && String(row.period_start) !== String(periodStart))
    return null;
  return row;
}

async function loadRowsForLens({ preservePage = false } = {}) {
  const lensLabel = LENSES.find((l) => l.id === CURRENT_LENS)?.label || "view";
  setLoadingMask(true, `Loading ${lensLabel}...`);
  try {
    costBuildCtrl.syncManualProvisionLayout();
    tableWrap?.classList.remove("tw-visible");
    costSheetCtrl.onLensLoadStart();
    ALL_ROWS = [];
    VIEW = [];
    if (!preservePage) CURRENT_PAGE = 1;

    if (shouldShowKpiStrip()) {
      await controlCenterCtrl.loadGlobalSummaries(ACTIVE_PERIOD_START);
    }

    if (CURRENT_LENS === "manual-provisions") {
      SKU_STATUS_DIAGNOSIS = [];
      DIAGNOSIS_BY_SKU_ID = new Map();

      await costBuildCtrl.loadManualProvisionLensData(ACTIVE_PERIOD_START);

      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (
      CURRENT_LENS === "dashboard" ||
      CURRENT_LENS === "costing-review-workbench" ||
      CURRENT_LENS === "cost-governance" ||
      CURRENT_LENS === "staff-governance" ||
      CURRENT_LENS === "manual-rate-manager" ||
      CURRENT_LENS === "rm-cost-trace" ||
      CURRENT_LENS === "printable-cost-sheet"
    ) {
      SKU_STATUS_DIAGNOSIS = [];
      DIAGNOSIS_BY_SKU_ID = new Map();
    } else {
      await loadSkuStatusDiagnosis(ACTIVE_PERIOD_START);
    }

    const viewName = VIEW_BY_LENS[CURRENT_LENS];
    if (CURRENT_LENS === "dashboard") {
      ALL_ROWS = await controlCenterCtrl.loadDashboardRows(ACTIVE_PERIOD_START);
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "printable-cost-sheet") {
      const { groupedRows } = await costSheetCtrl.loadPrintableLensRows(
        ACTIVE_PERIOD_START,
      );
      ALL_ROWS = groupedRows;
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "scheme-comparison") {
      ALL_ROWS = await pricingPolicyCtrl.loadSchemeComparisonRows(
        ACTIVE_PERIOD_START,
      );
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "costing-review-workbench") {
      ALL_ROWS = await controlCenterCtrl.loadWorkbenchRows(
        ACTIVE_PERIOD_START,
        materialCostCtrl,
      );

      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "cost-governance") {
      ALL_ROWS = await costBuildCtrl.loadCostGovernanceRows(ACTIVE_PERIOD_START);
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "staff-governance") {
      ALL_ROWS = await costBuildCtrl.loadStaffGovernanceRows(ACTIVE_PERIOD_START);
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "rm-cost-trace") {
      materialCostCtrl.syncTracePageFromShell(CURRENT_PAGE, PAGE_SIZE);
      ALL_ROWS = await materialCostCtrl.loadRmCostTraceRows();
      VIEW = [...ALL_ROWS];
      materialCostCtrl.syncRmTraceChrome();
      syncTraceExportButtonState();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      renderTable();
      return;
    }

    if (CURRENT_LENS === "manual-rate-manager") {
      const activeTab = materialCostCtrl.getManualRateManagerTab();
      ALL_ROWS = await materialCostCtrl.loadManualRateManagerRows(activeTab);
      materialCostCtrl.syncRmTraceChrome();
      syncTraceExportButtonState();
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "policy-manager") {
      ALL_ROWS = await pricingPolicyCtrl.loadPolicyManagerRows();
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    let query = costingFrom(viewName).select("*");
    if (CURRENT_LENS === "dashboard") {
      query = query.eq("period_start", ACTIVE_PERIOD_START).limit(1);
    } else if (CURRENT_LENS === "cost-comparison") {
      query = query.eq("snapshot_period_start", ACTIVE_PERIOD_START);
    } else {
      query = query.eq("period_start", ACTIVE_PERIOD_START);
    }

    if (CURRENT_LENS === "sku-cost-sheet")
      query = query.order("product_name", { ascending: true });
    if (CURRENT_LENS === "printable-cost-sheet")
      query = query.order("product_name", { ascending: true });
    if (CURRENT_LENS === "cost-comparison")
      query = query
        .order("product_name", { ascending: true })
        .order("sku_column_label", { ascending: true });
    if (CURRENT_LENS === "scheme-comparison")
      query = query.order("sku_display_name", { ascending: true });
    if (CURRENT_LENS === "costing-review-workbench") {
      query = query
        .order("priority_sort", { ascending: true })
        .order("affected_sku_count", { ascending: false });
    }

    const { data, error } = await query.limit(2000);
    if (error) throw error;
    ALL_ROWS = data || [];
    applyFilters();
    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();
  } finally {
    applyKpiStripVisibility();
    setLoadingMask(false);
  }
}

function uniqueValues(rows, key) {
  return [
    ...new Set(
      rows
        .map((r) => r[key])
        .filter((v) => v !== null && v !== undefined && v !== ""),
    ),
  ];
}

function updateLensSuiteLabel() {
  if (!lensSuiteLabel) return;

  const suite = getSuiteForLens(CURRENT_LENS);
  const lens = getLensMeta(CURRENT_LENS);

  if (suite && lens) {
    lensSuiteLabel.textContent = `${ACTIVE_ROUTE_CONFIG.title} → ${lens.label}`;
    lensSuiteLabel.title = lens.description || suite.label;
    return;
  }

  lensSuiteLabel.textContent = ACTIVE_ROUTE_CONFIG.title;
  lensSuiteLabel.title = ACTIVE_ROUTE_CONFIG.subtitle || "";
}

function renderLensPillButton(lensId) {
  const meta = getLensMeta(lensId);
  if (!meta) return "";

  const activeClass = lensId === CURRENT_LENS ? " active" : "";
  return `<button type="button" class="pill${activeClass}" data-lens="${meta.id}">${text(meta.label)}</button>`;
}

function renderLensPills() {
  LENSES = buildActiveLenses();
  const activeSuites = getActiveSuiteModules();

  if (lensPills) {
    lensPills.innerHTML = activeSuites
      .map((suite) => {
        const pills = suite.lensIds.map(renderLensPillButton).join("");
        if (!pills) return "";
        return `<div class="cp-lens-suite-group" data-suite-id="${text(suite.id)}">${pills}</div>`;
      })
      .join("");

    lensPills.querySelectorAll(".pill").forEach((btn) => {
      btn.addEventListener("click", () => switchLens(btn.dataset.lens));
    });
  }

  if (lensSelect) {
    lensSelect.innerHTML = activeSuites
      .map((suite) => {
        const options = suite.lensIds
          .map((lensId) => {
            const meta = getLensMeta(lensId);
            if (!meta) return "";
            return `<option value="${text(meta.id)}">${text(meta.label)}</option>`;
          })
          .join("");
        if (!options) return "";
        return options;
      })
      .join("");
    if (isLensAllowedForRoute(CURRENT_LENS)) {
      lensSelect.value = CURRENT_LENS;
    }
  }

  updateLensSuiteLabel();
}

async function switchLens(lensId) {
  if (!lensId || lensId === CURRENT_LENS) return;
  if (!isLensAllowedForRoute(lensId)) {
    showToast(
      `Lens "${lensId}" is not available on this route.`,
      "warning",
      4200,
    );
    return;
  }
  costSheetCtrl.onLensSwitch();
  CURRENT_LENS = lensId;
  SELECTED_ROW = null;
  if (
    CURRENT_LENS === "cost-governance" ||
    CURRENT_LENS === "staff-governance"
  ) {
    ACTIVE_FILTERS = { status: [], issue: [], source: [] };
    syncFilterCheckboxes();
  }
  renderLensPills();
  closeDetails();
  try {
    await loadRowsForLens();
  } catch (err) {
    handleError("Failed to load selected lens", err);
  }
}

function getRowStatus(row) {
  return (
    row.action_severity ||
    row.control_severity ||
    row.first_control_status ||
    row.overall_control_status ||
    row.costing_status ||
    row.cost_sheet_status ||
    row.product_cost_sheet_status ||
    row.product_costing_status ||
    row.status ||
    row.pricing_bridge_status ||
    row.selling_price_bridge_status ||
    row.scheme_viability_status ||
    row.final_action_status ||
    row.costing_confidence_status ||
    row.commercial_viability_status ||
    row.material_line_status ||
    row.manager_action_code ||
    row.latest_refresh_status ||
    ""
  );
}

function getSearchBlob(row) {
  return [
    row.product_name,
    row.sku_display_name,
    row.sku_id,
    row.sku_column_label,
    row.product_id,
    row.category_name,
    row.subcategory_name,
    row.group_name,
    row.sub_group_name,
    row.product_hierarchy,
    row.sku_column_labels,
    row.stock_item_name,
    row.stock_item_code,
    row.material_area,
    row.action_severity,
    row.control_severity,
    row.first_control_status,
    row.overall_control_status,
    row.material_issue_code,
    row.warning_code,
    row.warning_text,
    row.manager_action_code,
    row.action_source,
    row.recommended_ui_route,
    row.action_note_summary,
    row.action_required,
    row.action_required_summary,
    row.provision_key,
    row.provision_label,
    row.provision_type,
    row.provision_type_label,
    row.provision_amount,
    row.source_reference,
    row.provision_status,
    row.provision_note,
    row.issue_codes,
    row.warning_codes,
    row.material_line_status,
    row.material_line_statuses,
    row.bom_source,
    row.bom_sources,
    row.source,
    row.cost_sheet_status,
    row.pricing_bridge_status,
    row.selling_price_bridge_status,
    row.latest_purchase_rate,
    row.latest_purchase_date,
    row.register_status,
    row.reason,
    row.recommended_action,
    row.manual_rate_id,
    row.latest_material_issue_code,
    row.latest_bom_source,
    row.latest_system_rate_source,
    row.costing_confidence_status,
    row.commercial_viability_status,
    row.final_action_status,
    row.material_costing_status,
    row.rm_costing_status,
    row.pm_costing_status,
    row.scheme_name,
    row.expense_group,
    row.head_name,
    row.allocation_pool,
    row.allocation_pool_label,
    row.mapping_status,
    row.include_in_costing,
    row.is_active,
    row.snapshot_count,
    row.first_seen_date,
    row.latest_seen_date,
    row.materiality_band,
    row.max_seen_value,
    row.suggested_review_note,
    row.pool_source_type,
    row.pool_status,
    row.remarks,
    row.staff_id,
    row.employee_code,
    row.staff_display_name,
    row.staff_name,
    row.full_name,
    row.employee_name,
    row.name,
    row.designation,
    row.costing_class,
    row.costing_class_label,
    row.classification_status,
    row.classification_note,
    row.latest_salary_period_start,
    row.total_salary_cost,
    row.salary_source_note,
    row.allocation_weight,
    row.rm_costing_status,
    row.pm_costing_status,
    row.scheme_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterMatch(row, group, selected) {
  if (!selected.length) return true;

  const issueFlags = [];
  const issueText = [
    row.rate_source,
    row.action_note_summary,
    row.action_required_summary,
    row.warning_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  if (issueText.includes("MANUAL RATE")) issueFlags.push("MANUAL_RATE_USED");

  const values = {
    status: [
      row.action_severity,
      row.control_severity,
      row.first_control_status,
      row.overall_control_status,
      row.costing_status,
      row.cost_sheet_status,
      row.product_cost_sheet_status,
      row.product_costing_status,
      row.status,
      row.pricing_bridge_status,
      row.selling_price_bridge_status,
      row.scheme_viability_status,
      row.costing_confidence_status,
      row.commercial_viability_status,
      row.final_action_status,
      row.material_costing_status,
      row.rm_costing_status,
      row.pm_costing_status,
      row.internal_loaded_cost_status,
      row.manufacturing_cop_status,
      row.material_line_status,
      row.manager_action_code,
      row.mapping_status,
      row.pool_status,
      row.classification_status,
      row.register_status,
      row.rule_status,
      row.provision_status,
    ],
    issue: [
      row.material_issue_code,
      row.primary_diagnostic_code,
      row.final_action_status,
      row.warning_code,
      row.action_required,
      row.action_required_summary,
      row.recommended_ui_route,
      row.issue_codes,
      row.warning_codes,
      ...issueFlags,
    ],
    source: [
      row.action_source,
      row.rate_source,
      row.bom_source,
      row.bom_sources,
      row.source,
      row.pool_source_type,
      row.allocation_pool,
      row.allocation_pool_label,
      row.provision_type,
      row.provision_type_label,
      row.provision_key,
      row.policy_scope,
      row.scope_name,
      row.region_code,
      row.scheme_name,
    ],
  };

  const tokens = values[group] || [];
  const haystack = tokens
    .flatMap((value) =>
      String(value || "")
        .split(/[|,]/)
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .map((value) => normalizeStatus(value));

  return selected.some((choice) => {
    const wanted = normalizeStatus(choice);
    if (group === "status") {
      return haystack.some((entry) => statusTokenMatches(entry, wanted));
    }
    return haystack.some((entry) => entry === wanted || entry.includes(wanted));
  });
}

function applyFilters() {
  if (isRmCostTraceLensActive()) {
    VIEW = [...ALL_ROWS];
    CURRENT_PAGE = 1;
    renderTable();
    updateSearchClear();
    return;
  }

  let rows = [...ALL_ROWS];
  rows = rows.filter(
    (row) =>
      filterMatch(row, "status", ACTIVE_FILTERS.status) &&
      filterMatch(row, "issue", ACTIVE_FILTERS.issue) &&
      filterMatch(row, "source", ACTIVE_FILTERS.source),
  );
  VIEW = rows;
  applySearch();
}

function applySearch() {
  const q = String(searchBox?.value || "")
    .trim()
    .toLowerCase();
  let rows = [...ALL_ROWS].filter(
    (row) =>
      filterMatch(row, "status", ACTIVE_FILTERS.status) &&
      filterMatch(row, "issue", ACTIVE_FILTERS.issue) &&
      filterMatch(row, "source", ACTIVE_FILTERS.source),
  );
  if (q) rows = rows.filter((row) => getSearchBlob(row).includes(q));
  VIEW = rows;
  CURRENT_PAGE = 1;
  renderTable();
  updateSearchClear();
}

function updateSearchClear() {
  if (searchClear) searchClear.style.display = searchBox?.value ? "" : "none";
}

function updateSearchPlaceholder() {
  if (!searchBox) return;

  let placeholder = "Search product, SKU, ID, or material issue item";

  if (CURRENT_LENS === "manual-provisions") {
    placeholder =
      costBuildCtrl.getManualProvisionTab() === "impact"
        ? "Search pool, manual amount, source type, or status"
        : "Search provision key, label, pool, type, source, remarks, or status";
  } else if (CURRENT_LENS === "cost-governance") {
    placeholder = "Search expense head, group, allocation pool, or status";
  } else if (CURRENT_LENS === "staff-governance") {
    placeholder = "Search staff, employee code, designation, class, or pool";
  } else if (CURRENT_LENS === "rm-cost-trace") {
    placeholder = "Use RM Cost Trace filters for material search";
  } else if (CURRENT_LENS === "manual-rate-manager") {
    const managerTab = materialCostCtrl.getManualRateManagerTab();
    if (managerTab === "history") {
      placeholder = "Search stock item, manual rate ID, reason, or status";
    } else {
      placeholder = "Search stock item, issue code, rate source, or action";
    }
  } else if (CURRENT_LENS === "policy-manager") {
    placeholder = "Search product, SKU, scheme, policy, or status";
  }

  searchBox.placeholder = placeholder;
  searchBox.title = placeholder;
  searchBox.setAttribute("aria-label", placeholder);
}

function renderTableHeaderForLens() {
  if (isCostBuildLens(CURRENT_LENS)) {
    const buildHeaders = costBuildCtrl.getTableHeaders(CURRENT_LENS);
    const buildAlignments = costBuildCtrl.getTableAlignments(CURRENT_LENS);
    if (buildHeaders && buildAlignments) {
      tableHead.innerHTML = `<tr>${buildHeaders
        .map((h, i) => {
          const classes = [buildAlignments[i] || "c-left"];
          if (i === 0 && h === "") classes.push("lane-col");
          return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
        })
        .join("")}</tr>`;
      return;
    }
  }

  if (isMaterialCostLens(CURRENT_LENS)) {
    const materialHeaders = materialCostCtrl.getTableHeaders(CURRENT_LENS);
    const materialAlignments = materialCostCtrl.getTableAlignments(CURRENT_LENS);
    if (materialHeaders && materialAlignments) {
      tableHead.innerHTML = `<tr>${materialHeaders
        .map((h, i) => {
          const classes = [materialAlignments[i] || "c-left"];
          if (i === 0 && h === "") classes.push("lane-col");
          return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
        })
        .join("")}</tr>`;
      return;
    }
  }

  if (isCostSheetLens(CURRENT_LENS)) {
    const sheetHeaders = costSheetCtrl.getTableHeaders(CURRENT_LENS);
    const sheetAlignments = costSheetCtrl.getTableAlignments(CURRENT_LENS);
    if (sheetHeaders && sheetAlignments) {
      tableHead.innerHTML = `<tr>${sheetHeaders
        .map((h, i) => {
          const classes = [sheetAlignments[i] || "c-left"];
          if (i === 0 && h === "") classes.push("lane-col");
          return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
        })
        .join("")}</tr>`;
      return;
    }
  }

  if (isPricingPolicyLens(CURRENT_LENS)) {
    const policyHeaders = pricingPolicyCtrl.getTableHeaders(CURRENT_LENS);
    const policyAlignments = pricingPolicyCtrl.getTableAlignments(CURRENT_LENS);
    if (policyHeaders && policyAlignments) {
      tableHead.innerHTML = `<tr>${policyHeaders
        .map((h, i) => {
          const classes = [policyAlignments[i] || "c-left"];
          return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
        })
        .join("")}</tr>`;
      return;
    }
  }

  if (isControlCenterLens(CURRENT_LENS)) {
    const ccHeaders = controlCenterCtrl.getTableHeaders(CURRENT_LENS);
    const ccAlignments = controlCenterCtrl.getTableAlignments(CURRENT_LENS);
    if (ccHeaders && ccAlignments) {
      tableHead.innerHTML = `<tr>${ccHeaders
        .map((h, i) => {
          const classes = [ccAlignments[i] || "c-left"];
          return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
        })
        .join("")}</tr>`;
      return;
    }
  }

  const headers = {
    "sku-cost-sheet": [
      "",
      "Product / SKU",
      "SKU ID",
      "MRP IK",
      "MRP OK",
      "Internal Loaded Cost",
      "IK Selling Price",
      "OK Selling Price",
      "Status",
    ],
    "printable-cost-sheet": [
      "Product",
      "Category",
      "Group",
      "SKU Columns",
      "Status",
      "Refreshed At",
    ],
    "cost-comparison": [
      "Product / SKU",
      "Manufacturing COP",
      "Previous Month COP",
      "MoM COP Change %",
      "Internal Loaded Cost",
      "Previous Month Internal Loaded Cost",
      "MoM Internal Loaded Cost Change %",
      "Profit IK",
      "MoM Profit IK Change",
      "Profit OK",
      "MoM Profit OK Change",
    ],
  }[CURRENT_LENS];
  const alignments =
    {
      "sku-cost-sheet": [
        "c-center",
        "c-left",
        "c-left",
        "c-right",
        "c-right",
        "c-right",
        "c-right",
        "c-right",
        "c-left",
      ],
      "printable-cost-sheet": [
        "c-left",
        "c-left",
        "c-left",
        "c-left",
        "c-left",
        "c-left",
      ],
      "cost-comparison": [
        "c-left",
        "c-right",
        "c-right",
        "c-center",
        "c-right",
        "c-right",
        "c-center",
        "c-right",
        "c-right",
        "c-right",
        "c-right",
      ],
    }[CURRENT_LENS] || [];
  tableHead.innerHTML = `<tr>${headers
    .map((h, i) => {
      const classes = [alignments[i] || "c-left"];
      if (i === 0 && h === "") classes.push("lane-col");
      return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
    })
    .join("")}</tr>`;
}

function productSkuLabel(row) {
  const product = row.product_name || row.product_id || "--";
  const sku = row.sku_display_name || row.sku_column_label || row.sku_id || "";
  return `${cpCellPrimary(product)}${sku ? `<div style="color:var(--muted,#6b7280);font-size:12px">${text(sku)}</div>` : ""}`;
}


function renderRowForLens(row, idx) {
  const trAttrs = `class="clickable" data-row-index="${idx}"`;
  if (isCostBuildLens(CURRENT_LENS)) {
    const rowHtml = costBuildCtrl.renderTableRow(CURRENT_LENS, row, trAttrs, idx);
    if (rowHtml) return rowHtml;
  }
  if (isControlCenterLens(CURRENT_LENS)) {
    const rowHtml = controlCenterCtrl.renderTableRow(CURRENT_LENS, row, trAttrs, idx);
    if (rowHtml) return rowHtml;
  }
  if (isCostSheetLens(CURRENT_LENS)) {
    const rowHtml = costSheetCtrl.renderTableRow(CURRENT_LENS, row, trAttrs);
    if (rowHtml) return rowHtml;
  }
  if (isPricingPolicyLens(CURRENT_LENS)) {
    const rowHtml = pricingPolicyCtrl.renderTableRow(CURRENT_LENS, row, trAttrs);
    if (rowHtml) return rowHtml;
  }
  if (isMaterialCostLens(CURRENT_LENS)) {
    const rowHtml = materialCostCtrl.renderTableRow(
      CURRENT_LENS,
      row,
      trAttrs,
      idx,
    );
    if (rowHtml) return rowHtml;
  }

  return "";
}


function renderTable() {
  costBuildCtrl.syncManualProvisionLayout();
  syncPeriodControlState();
  updateSearchPlaceholder();
  if (CURRENT_LENS === "manual-provisions") {
    costBuildCtrl.syncManualProvisionMetaActions();
  } else if (genericTableMetaActions) {
    genericTableMetaActions.innerHTML = "";
    setVisible(genericTableMetaActions, false);
  }
  if (tableWrap) {
    tableWrap.classList.remove("hidden");
    tableWrap.style.display = "";
  }
  renderTableHeaderForLens();
  if (tableWrap) {
    tableWrap.dataset.lens = CURRENT_LENS;
    tableWrap.dataset.managerTab =
      CURRENT_LENS === "manual-rate-manager"
        ? materialCostCtrl.getManualRateManagerTab()
        : CURRENT_LENS === "manual-provisions"
          ? costBuildCtrl.getManualProvisionTab()
          : CURRENT_LENS === "cost-governance"
            ? costBuildCtrl.getCostGovernanceTab()
            : CURRENT_LENS === "staff-governance"
              ? costBuildCtrl.getStaffGovernanceTab()
              : CURRENT_LENS === "policy-manager"
              ? pricingPolicyCtrl.getPolicyManagerTab()
              : "";
  }

  if (CURRENT_LENS === "manual-rate-manager") {
    materialCostCtrl.renderManualRateManagerTabs(workbenchSummary, async () => {
      CURRENT_PAGE = 1;
      try {
        await loadRowsForLens();
      } catch (err) {
        handleError("Failed to load Manual Rate Manager tab", err);
      }
    });
  } else if (CURRENT_LENS === "policy-manager") {
    pricingPolicyCtrl.renderPolicyManagerTabs(workbenchSummary, async () => {
      CURRENT_PAGE = 1;
      try {
        await loadRowsForLens();
      } catch (err) {
        handleError("Failed to load Policy Manager tab", err);
      }
    });
  } else if (CURRENT_LENS === "manual-provisions") {
    costBuildCtrl.renderManualProvisionTabs(workbenchSummary, async () => {
      CURRENT_PAGE = 1;
      SELECTED_ROW = null;
      closeDetails();
      costBuildCtrl.applyManualProvisionFilters();
    });
    costBuildCtrl.syncManualProvisionMetaActions();
  } else if (CURRENT_LENS === "cost-governance") {
    costBuildCtrl.renderCostGovernanceTabs(workbenchSummary, async () => {
      CURRENT_PAGE = 1;
      SELECTED_ROW = null;
      closeDetails();
      try {
        await loadRowsForLens();
      } catch (err) {
        handleError("Failed to load Cost Governance tab", err);
      }
    });
  } else if (CURRENT_LENS === "staff-governance") {
    costBuildCtrl.renderStaffGovernanceTabs(workbenchSummary, async () => {
      CURRENT_PAGE = 1;
      SELECTED_ROW = null;
      closeDetails();
      try {
        await loadRowsForLens();
      } catch (err) {
        handleError("Failed to load Staff Governance tab", err);
      }
    });
  } else {
    controlCenterCtrl.renderWorkbenchSummary(ALL_ROWS, CURRENT_LENS);
  }

  materialCostCtrl.syncRmTraceChrome();
  syncTraceExportButtonState();

  const rmTraceActive = isRmCostTraceLensActive();
  const rmTraceState = rmTraceActive
    ? materialCostCtrl.getTraceLoadState()
    : null;
  const totalCount = rmTraceActive
    ? Number(materialCostCtrl.getTraceTotalCount() || 0)
    : VIEW.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (!rmTraceActive && CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;
  const start = rmTraceActive ? 0 : (CURRENT_PAGE - 1) * PAGE_SIZE;
  const pageRows = rmTraceActive ? VIEW : VIEW.slice(start, start + PAGE_SIZE);

  if (rmTraceActive && rmTraceState === "restricted") {
    tableBody.innerHTML = "";
    tableWrap?.classList.remove("tw-visible");
    setStatus(
      "Restricted RM contribution detail. Your Material Cost Manager access does not include confidential raw-material contribution traceability.",
      "error",
    );
  } else if (rmTraceActive && rmTraceState === "error") {
    tableBody.innerHTML = "";
    tableWrap?.classList.remove("tw-visible");
    setStatus(
      materialCostCtrl.getTraceErrorMessage() ||
        "Unable to load RM Cost Trace.",
      "error",
    );
  } else if (!VIEW.length) {
    tableBody.innerHTML = "";
    tableWrap?.classList.remove("tw-visible");
    setStatus(
      CURRENT_LENS === "dashboard" && !controlCenterCtrl.hasControlSnapshot()
        ? "Control snapshot is not available for this period. Request Costing Refresh from the toolbar to rebuild costing snapshots and the control summary."
        : rmTraceActive
          ? "No RM contribution rows found for the selected filters."
          : `No rows found for ${LENSES.find((l) => l.id === CURRENT_LENS)?.label || CURRENT_LENS}.`,
    );
  } else {
    clearStatus();
    tableWrap?.classList.remove("hidden");
    tableWrap?.classList.add("tw-visible");
    tableBody.innerHTML = pageRows
      .map((row, idx) => renderRowForLens(row, start + idx))
      .join("");
  }

  tableBody.querySelectorAll("tr[data-row-index]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const row = VIEW[Number(tr.dataset.rowIndex)];
      if (!row) return;

      if (isRmCostTraceLensActive()) {
        return;
      }

      if (isCostBuildLens(CURRENT_LENS)) {
        costBuildCtrl.handleCostBuildRowClick(CURRENT_LENS, row, tr);
        return;
      }

      if (
        CURRENT_LENS === "policy-manager" &&
        pricingPolicyCtrl.getPolicyManagerTab() === "scheme-rule-register"
      ) {
        return;
      }

      if (CURRENT_LENS === "printable-cost-sheet") {
        void costSheetCtrl.handlePrintableRowClick(row);
        return;
      }

      let preferred;
      if (CURRENT_LENS === "scheme-comparison") preferred = "scheme";

      if (CURRENT_LENS === "manual-rate-manager") {
        const managerTab = materialCostCtrl.getManualRateManagerTab();
        if (managerTab === "register") {
          preferred = "manual-rate-register";
        } else if (managerTab === "history") {
          preferred = "manual-rate-history";
        } else {
          preferred = "manual-rate-action";
        }
      }

      openDetails(row, preferred);
    });
  });

  if (CURRENT_LENS === "staff-governance") {
    costBuildCtrl.wireStaffGovernanceTableActions(tableBody, (index) =>
      VIEW[index],
    );
  }

  if (
    CURRENT_LENS === "manual-rate-manager" &&
    materialCostCtrl.getManualRateManagerTab() === "register"
  ) {
    materialCostCtrl.wireManualRateManagerTableActions(tableBody, (index) =>
      VIEW[index],
    );
  }

  if (
    CURRENT_LENS === "policy-manager" &&
    pricingPolicyCtrl.getPolicyManagerTab() === "scheme-rule-register"
  ) {
    pricingPolicyCtrl.wirePolicyManagerTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (rowCount) {
    rowCount.style.display = "";
    rowCount.textContent = `${totalCount.toLocaleString("en-IN")} row${totalCount === 1 ? "" : "s"}`;
  }
  if (pageLabel) {
    const pageForLabel = rmTraceActive
      ? materialCostCtrl.getTracePage()
      : CURRENT_PAGE;
    pageLabel.textContent = `Page ${pageForLabel}/${totalPages}`;
  }
  if (prevPage) prevPage.disabled = (rmTraceActive ? materialCostCtrl.getTracePage() : CURRENT_PAGE) <= 1;
  if (nextPage) {
    nextPage.disabled =
      (rmTraceActive ? materialCostCtrl.getTracePage() : CURRENT_PAGE) >=
      totalPages;
  }
}

function kvCards(items) {
  return `<div class="cp-summary-strip">${items
    .map(
      ([label, value]) =>
        `<div class="cp-card"><div class="cp-card-label">${text(label)}</div><div class="cp-card-value">${value}</div></div>`,
    )
    .join("")}</div>`;
}

function kvSection(title, items) {
  if (!items?.length) return "";
  const rows = items
    .map(([label, value]) => `<dt>${text(label)}</dt><dd>${value}</dd>`)
    .join("");
  const heading = title
    ? `<h3 class="cp-section-title">${text(title)}</h3>`
    : "";
  return `<section class="cp-detail-section">${heading}<dl class="cp-kv cp-detail-kv">${rows}</dl></section>`;
}

function detailPanel(sections, { columns = 1 } = {}) {
  const body = sections.filter(Boolean).join("");
  if (!body) return "";
  const gridClass =
    columns === 2 ? " cp-detail-grid cp-detail-grid--2col" : "";
  return `<div class="cp-detail-panel${gridClass}">${body}</div>`;
}

function simpleTable(headers, rows, renderer) {
  if (!rows?.length) return `<div class="status">No rows available.</div>`;
  const renderedRows = rows.map(renderer);
  const rowCells = renderedRows.map((rowHtml) => [
    ...String(rowHtml).matchAll(/<td(?:\s+class="([^"]*)")?[^>]*>/g),
  ]);
  const headerHtml = headers
    .map((header, index) => {
      const columnClasses = rowCells
        .map((cells) => cells[index]?.[1] || "")
        .filter(Boolean);
      const hasRight = columnClasses.some((classes) =>
        /(?:^|\s)(?:c-right|cp-num-cell)(?:\s|$)/.test(classes),
      );
      const hasCenter = columnClasses.some((classes) =>
        /(?:^|\s)(?:c-center|cp-pct-cell|cp-blank-cell)(?:\s|$)/.test(classes),
      );
      const alignmentClass = hasRight
        ? "c-right"
        : hasCenter
          ? "c-center"
          : "c-left";
      return `<th class="${alignmentClass}">${text(header)}</th>`;
    })
    .join("");
  return `<div class="cp-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${renderedRows.join("")}</tbody></table></div>`;
}

async function fetchSkuDetail(row) {
  const skuId = row.sku_id;
  if (!skuId) return row;
  const { data, error } = await costingFrom(
    "v_costing_pricing_sku_detailed_cost_sheet",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .eq("sku_id", skuId)
    .limit(1);
  if (error) throw error;
  return data?.[0] || row;
}

async function fetchSkuSchemes(row) {
  if (!row.sku_id) return [];
  const { data, error } = await costingFrom(
    "v_costing_pricing_sku_scheme_comparison",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .eq("sku_id", row.sku_id)
    .limit(500);
  if (error) throw error;
  return data || [];
}

async function fetchSkuDiagnostics(row) {
  if (!row.sku_id) return null;
  const { data, error } = await costingFrom(
    "v_costing_pricing_workflow_diagnostics",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .eq("sku_id", row.sku_id)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}



function activePeriodIso() {
  return ACTIVE_PERIOD_START || getCurrentMonthStart();
}

function numberOrNullFromInput(input) {
  const raw = String(input?.value ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function numberOrZeroFromInput(input) {
  const n = numberOrNullFromInput(input);
  return n === null ? 0 : n;
}




function buildSkuDiagnosisSection(rowOrSkuId) {
  const skuId =
    typeof rowOrSkuId === "object" ? rowOrSkuId?.sku_id : rowOrSkuId;
  const d = getSkuDiagnosis(skuId);
  if (!d) return "";
  return kvSection("SKU Diagnosis", [
    ["Costing Confidence", statusChip(d.costing_confidence_status)],
    ["Commercial Viability", statusChip(d.commercial_viability_status)],
    ["Final Action", statusChip(d.final_action_status)],
    ["Primary Diagnostic Code", text(d.primary_diagnostic_code)],
    ["Primary Reason", text(d.primary_diagnostic_note)],
    ["Recommended Action", text(d.recommended_action)],
  ]);
}

function renderSkuDiagnosisPanel(rowOrSkuId) {
  const section = buildSkuDiagnosisSection(rowOrSkuId);
  if (!section) {
    return `<div class="status">No diagnosis available for the selected SKU and period.</div>`;
  }
  return detailPanel([section]);
}

async function renderSkuTab(tabId) {
  const detail = await fetchSkuDetail(SELECTED_ROW);
  const diagnosisPanel = renderSkuDiagnosisPanel(detail);
  if (tabId === "overview") {
    const diagnosisSection = buildSkuDiagnosisSection(detail);
    const evidenceSection =
      materialCostCtrl.buildMaterialEvidenceSection(detail);
    const overviewPanel = detailPanel(
      [
        diagnosisSection,
        evidenceSection,
        kvSection("Product & Pricing", [
          ["Product", text(detail.product_name || detail.product_id)],
          ["SKU", text(detail.sku_display_name || detail.sku_id)],
          [
            "MRP IK / OK",
            `${formatMoney(detail.mrp_ik)} / ${formatMoney(detail.mrp_ok)}`,
          ],
          [
            "Internal Loaded Cost",
            formatMoney(detail.internal_loaded_cost_per_sku),
          ],
          ["Pricing Cost", formatMoney(detail.pricing_cost_per_sku)],
          ["IK Selling Price", formatMoney(detail.ik_selling_price)],
          ["OK Selling Price", formatMoney(detail.ok_selling_price)],
          ["Status", statusChip(getRowStatus(detail))],
        ]),
      ],
      { columns: 2 },
    );

    if (!diagnosisSection) {
      return `<div class="status">No diagnosis available for the selected SKU and period.</div>${overviewPanel}`;
    }

    return overviewPanel;
  }
  if (tabId === "cost-layers") {
    const layers = [
      ["Material Cost", detail.material_cost_per_sku],
      ["Direct Labour", detail.direct_labour_cost_per_sku],
      ["Prime Cost", detail.prime_cost_per_sku],
      ["Production Overhead", detail.production_overhead_cost_per_sku],
      [
        "Quality Control Overhead",
        detail.quality_control_overhead_cost_per_sku,
      ],
      [
        "Materials / Stores Overhead",
        detail.materials_stores_overhead_cost_per_sku,
      ],
      ["Manufacturing COP", detail.manufacturing_cop_per_sku],
      ["Admin Overhead", detail.admin_overhead_cost_per_sku],
      ["Finance Admin Overhead", detail.finance_admin_overhead_cost_per_sku],
      ["Internal Loaded Cost", detail.internal_loaded_cost_per_sku],
      ["Marketing Expense", detail.marketing_expense_cost_per_sku],
      ["Pricing Cost", detail.pricing_cost_per_sku],
    ];
    return (
      diagnosisPanel +
      simpleTable(
        ["Layer", "Amount"],
        layers,
        ([label, value]) =>
          `<tr><td>${text(label)}</td><td class="c-right">${formatMoney(value)}</td></tr>`,
      )
    );
  }
  if (tabId === "selling-price") {
    const rows = [
      ["MRP", detail.mrp_ik, detail.mrp_ok],
      ["GST %", detail.gst_percent, detail.gst_percent],
      ["Basic Price", detail.ik_basic_price, detail.ok_basic_price],
      ["Discount %", detail.ik_discount_percent, detail.ok_discount_percent],
      ["Discount Amount", detail.ik_discount_amount, detail.ok_discount_amount],
      ["Selling Price", detail.ik_selling_price, detail.ok_selling_price],
      ["Contingency %", detail.contingency_percent, detail.contingency_percent],
      [
        "Contingency Value",
        detail.ik_contingency_value,
        detail.ok_contingency_value,
      ],
    ];
    return simpleTable(
      ["Metric", "IK", "OK"],
      rows,
      ([label, ik, ok]) =>
        `<tr><td>${text(label)}</td><td class="c-right">${label.includes("%") ? formatPercent(ik) : formatMoney(ik)}</td><td class="c-right">${label.includes("%") ? formatPercent(ok) : formatMoney(ok)}</td></tr>`,
    );
  }
  if (tabId === "scheme") {
    const rows = await fetchSkuSchemes(SELECTED_ROW);
    return (
      diagnosisPanel +
      simpleTable(
        [
          "Scheme",
          "IK Effective SP",
          "IK Net Sales",
          "IK Margin",
          "IK Margin %",
          "IK Scheme Margin Band",
          "OK Effective SP",
          "OK Net Sales",
          "OK Margin",
          "OK Margin %",
          "OK Scheme Margin Band",
          "Scheme Calculation Status",
        ],
        rows,
        (r) =>
          `<tr><td>${text(r.scheme_name)}</td><td class="c-right">${formatMoney(r.ik_scheme_effective_selling_price)}</td><td class="c-right">${formatMoney(r.ik_net_sales_realisation)}</td><td class="c-right">${formatMoney(r.ik_margin_amount_after_scheme)}</td><td class="c-right">${formatPercent(r.ik_margin_percent_after_scheme)}</td><td>${marginBandChip(r.ik_scheme_margin_band)}</td><td class="c-right">${formatMoney(r.ok_scheme_effective_selling_price)}</td><td class="c-right">${formatMoney(r.ok_net_sales_realisation)}</td><td class="c-right">${formatMoney(r.ok_margin_amount_after_scheme)}</td><td class="c-right">${formatPercent(r.ok_margin_percent_after_scheme)}</td><td>${marginBandChip(r.ok_scheme_margin_band)}</td><td>${compactStatusText(r.scheme_viability_status)}</td></tr>`,
      )
    );
  }
  const d = await fetchSkuDiagnostics(SELECTED_ROW);
  if (!d) return `<div class="status">No diagnostics found for this SKU.</div>`;
  return detailPanel([
    kvSection("Bridge Diagnostics", [
      ["Pricing Bridge Status", statusChip(d.pricing_bridge_status)],
      [
        "Selling Price Bridge Status",
        statusChip(d.selling_price_bridge_status),
      ],
      ["Scheme Viability Status", statusChip(d.scheme_viability_status)],
      [
        "Internal Loaded Cost Status",
        statusChip(d.internal_loaded_cost_status),
      ],
      ["Manufacturing COP Status", statusChip(d.manufacturing_cop_status)],
      [
        "Primary Diagnostic Code",
        text(issueCodeLabel(d.primary_diagnostic_code)),
      ],
      ["Primary Diagnostic Note", text(d.primary_diagnostic_note)],
    ]),
  ]);
}


function setModalTabs(tabs, activeId) {
  drawerTabs.innerHTML = tabs
    .map(
      (t) =>
        `<div class="tab ${t.id === activeId ? "active" : ""}" data-tab="${t.id}">${t.label}</div>`,
    )
    .join("");
  drawerTabs
    .querySelectorAll(".tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => setDrawerTab(tab.dataset.tab)),
    );
}

async function setDrawerTab(tabId) {
  if (!SELECTED_ROW) return;
  drawerTabs
    .querySelectorAll(".tab")
    .forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.tab === tabId),
    );
  drawerContent.innerHTML = `<div class="status">Loading...</div>`;
  try {
    if (CURRENT_LENS === "dashboard") {
      drawerContent.innerHTML = controlCenterCtrl.renderDashboardDrawerTab(tabId);
    } else if (
      CURRENT_LENS === "costing-review-workbench" ||
      CURRENT_LENS === "manual-rate-manager"
    ) {
      drawerContent.innerHTML = await materialCostCtrl.renderMaterialWorkbenchTab(
        tabId,
        SELECTED_ROW,
        CURRENT_LENS,
      );
      materialCostCtrl.wireMaterialWorkbenchDrawerActions(tabId, CURRENT_LENS);
    } else if (CURRENT_LENS === "cost-comparison") {
      drawerContent.innerHTML =
        await costSheetCtrl.renderComparisonDrawerTab(tabId, SELECTED_ROW);
    } else if (CURRENT_LENS === "policy-manager") {
      drawerContent.innerHTML =
        await pricingPolicyCtrl.renderPolicyManagerDrawerTab(tabId, SELECTED_ROW);
      pricingPolicyCtrl.wirePolicyManagerDrawerActions(tabId, SELECTED_ROW);
    } else {
      drawerContent.innerHTML = await renderSkuTab(tabId);
    }
  } catch (err) {
    handleError("Failed to load detail tab", err, true);
  }
}

function openDetails(row, preferredTab) {
  DETAILS_RETURN_FOCUS = document.activeElement;
  SELECTED_ROW = row;
  if (!detailsModal) return;
  const title = $("drawerTitle");
  const subtitle = $("drawerSubtitle");

  if (CURRENT_LENS === "manual-rate-manager") {
    const config = materialCostCtrl.getManualRateManagerDrawerConfig(
      row,
      preferredTab,
    );
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);

    detailsModal.classList.remove("hidden");
    detailsModal.setAttribute("aria-hidden", "false");
    return;
  } else if (CURRENT_LENS === "costing-review-workbench") {
    const config = controlCenterCtrl.getWorkbenchDrawerConfig(row, preferredTab);
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (CURRENT_LENS === "dashboard") {
    const config = controlCenterCtrl.getDashboardDrawerConfig(preferredTab);
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (CURRENT_LENS === "cost-comparison") {
    const config = costSheetCtrl.getComparisonDrawerConfig(row, preferredTab);
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (CURRENT_LENS === "policy-manager") {
    const config = pricingPolicyCtrl.getPolicyManagerDrawerConfig(
      row,
      preferredTab,
    );
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else {
    title.textContent = row.sku_display_name || row.sku_id || "SKU Details";
    subtitle.textContent = row.product_name || row.product_id || "";
    const active = preferredTab || "overview";
    setModalTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "cost-layers", label: "Cost Layers" },
        { id: "selling-price", label: "Selling Price" },
        { id: "scheme", label: "Scheme Comparison" },
        { id: "diagnostics", label: "Diagnostics" },
      ],
      active,
    );
    setDrawerTab(active);
  }
  detailsModal.classList.remove("hidden");
  detailsModal.setAttribute("aria-hidden", "false");
}

function closeDetails() {
  if (!detailsModal) return;

  const active = document.activeElement;
  if (active && detailsModal.contains(active)) {
    active.blur();
  }

  SELECTED_ROW = null;
  detailsModal.classList.add("hidden");
  detailsModal.setAttribute("aria-hidden", "true");

  const returnTarget =
    DETAILS_RETURN_FOCUS &&
    DETAILS_RETURN_FOCUS !== document.body &&
    document.contains(DETAILS_RETURN_FOCUS)
      ? DETAILS_RETURN_FOCUS
      : searchBox;
  DETAILS_RETURN_FOCUS = null;
  if (returnTarget && typeof returnTarget.focus === "function") {
    setTimeout(() => returnTarget.focus(), 0);
  }
}

async function refreshOpenDrawerIfNeeded() {
  if (!detailsModal || detailsModal.classList.contains("hidden") || !SELECTED_ROW) {
    return;
  }

  const activeTab = drawerTabs?.querySelector(".tab.active")?.dataset?.tab;
  if (!activeTab) return;

  if (CURRENT_LENS === "costing-review-workbench") {
    const updated = materialCostCtrl.syncSelectedWorkbenchRow(
      SELECTED_ROW,
      ALL_ROWS,
    );
    if (updated) SELECTED_ROW = updated;
  } else if (CURRENT_LENS === "dashboard") {
    const updated = controlCenterCtrl.syncSelectedDashboardRow(SELECTED_ROW);
    if (updated) SELECTED_ROW = updated;
  } else {
    const key = SELECTED_ROW.stock_item_id;
    if (key != null) {
      const updated = ALL_ROWS.find(
        (row) => String(row.stock_item_id) === String(key),
      );
      if (updated) SELECTED_ROW = updated;
    }
  }

  await setDrawerTab(activeTab);
}

async function requestCostingRefreshFromToolbar() {
  await runStagedCostingRefreshAndReload({
    sourceTrigger: "UI_TOOLBAR",
    requestNote: "Toolbar request costing refresh",
  });
}

let RM_TRACE_EXPORT_IN_PROGRESS = false;

function syncTraceExportButtonState() {
  if (!exportBtn) return;
  if (!isRmCostTraceLensActive()) {
    RM_TRACE_EXPORT_IN_PROGRESS = false;
    exportBtn.disabled = false;
    exportBtn.title = "Export CSV";
    exportBtn.setAttribute("aria-label", "Export CSV");
    exportBtn.removeAttribute("aria-disabled");
    exportBtn.classList.remove("is-disabled");
    setVisible(exportBtn, true);
    return;
  }

  const allowed =
    TRACE_PERMISSIONS_RESOLVED && CAN_VIEW_TRACE && CAN_EXPORT_TRACE;
  if (!allowed) {
    RM_TRACE_EXPORT_IN_PROGRESS = false;
    exportBtn.disabled = true;
    exportBtn.title =
      "Confidential RM Cost Trace export is restricted for your access.";
    exportBtn.setAttribute("aria-label", exportBtn.title);
    exportBtn.setAttribute("aria-disabled", "true");
    setVisible(exportBtn, false);
    return;
  }

  setVisible(exportBtn, true);
  if (RM_TRACE_EXPORT_IN_PROGRESS) {
    exportBtn.disabled = true;
    exportBtn.title = "Exporting…";
    exportBtn.setAttribute("aria-label", "Exporting…");
    exportBtn.setAttribute("aria-disabled", "true");
    exportBtn.classList.add("is-disabled");
    return;
  }

  exportBtn.disabled = false;
  exportBtn.title = "Export RM Cost Trace CSV";
  exportBtn.setAttribute("aria-label", "Export RM Cost Trace CSV");
  exportBtn.removeAttribute("aria-disabled");
  exportBtn.classList.remove("is-disabled");
}

function setRmTraceExportBusy(busy) {
  RM_TRACE_EXPORT_IN_PROGRESS = !!busy;
  syncTraceExportButtonState();
}

async function exportActiveViewCsv() {
  if (!isRmCostTraceLensActive()) {
    exportCsvForRows(VIEW);
    return;
  }

  if (
    !TRACE_PERMISSIONS_RESOLVED ||
    !CAN_VIEW_TRACE ||
    !CAN_EXPORT_TRACE
  ) {
    showToast(
      "Confidential RM Cost Trace export is restricted for your access.",
      "error",
    );
    return;
  }

  if (RM_TRACE_EXPORT_IN_PROGRESS) return;

  setRmTraceExportBusy(true);
  try {
    await materialCostCtrl.exportRmCostTraceCsv();
  } finally {
    setRmTraceExportBusy(false);
  }
}

const refreshCostingChain = requestCostingRefreshFromToolbar;

function exportCsvForRows(rows) {
  if (!rows.length) {
    showToast("No rows to export", "info");
    return;
  }
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    keys.map(csvEscape).join(","),
    ...rows.map((row) => keys.map((k) => csvEscape(row[k])).join(",")),
  ].join("\n");
  const yyyymm = String(ACTIVE_PERIOD_START || "")
    .slice(0, 7)
    .replace("-", "");
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const filename = `ERP_COSTING_PRICING_${CURRENT_LENS.toUpperCase().replace(/-/g, "_")}_PERIOD_${yyyymm}_ROWS_${rows.length}_TS_${ts}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} rows`, "success");
}

function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const statusDetail = $("sc-status-detail");
  const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
  if (!LAST_REFRESH_TIME) {
    if (lbl) lbl.textContent = "Not loaded";
    if (statusDetail) statusDetail.textContent = "Not yet loaded";
    lastRefreshed.setAttribute("aria-label", "Data not yet loaded");
    return;
  }
  const elapsedMin = Math.floor(
    (Date.now() - LAST_REFRESH_TIME.getTime()) / 60000,
  );
  let label = "Just now";
  let statusClass = "snapshot-fresh";
  if (elapsedMin >= 1 && elapsedMin < 15) label = `${elapsedMin}m ago`;
  else if (elapsedMin >= 15 && elapsedMin < 60) {
    label = `${elapsedMin}m ago`;
    statusClass = "snapshot-warning";
  } else if (elapsedMin >= 60) {
    label = `${Math.floor(elapsedMin / 60)}h ago`;
    statusClass = "snapshot-stale";
  }
  if (lbl) lbl.textContent = label;
  const detailText = `Last refreshed: ${LAST_REFRESH_TIME.toLocaleString()}`;
  if (statusDetail) statusDetail.textContent = detailText;
  lastRefreshed.className = `${lastRefreshed.className.replace(/snapshot-\w+/g, "").trim()} ${statusClass}`;
  lastRefreshed.setAttribute("aria-label", detailText);
}

function closeFreshnessDetail() {
  const detail = $("sc-status-detail");
  if (!lastRefreshed || !detail) return;
  lastRefreshed.classList.remove("sc-status-expanded");
  lastRefreshed.setAttribute("aria-expanded", "false");
  detail.style.display = "none";
}

function toggleFreshnessDetail() {
  const detail = $("sc-status-detail");
  if (!lastRefreshed || !detail) return;
  const expanded = lastRefreshed.classList.toggle("sc-status-expanded");
  lastRefreshed.setAttribute("aria-expanded", String(expanded));
  detail.style.display = expanded ? "block" : "none";
}

function showToast(message, type = "info", duration = 3200, multiline = false) {
  const container = $("peqToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `peq-toast toast-${type}`;
  toast.textContent = message;
  if (multiline) toast.style.whiteSpace = "pre-line";
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

function sanitizeActiveFiltersToVisibleOptions() {
  ["status", "issue", "source"].forEach((group) => {
    const visibleValues = new Set(
      [
        ...document.querySelectorAll(
          `#peqFilterDrawer input[data-filter-group="${group}"]`,
        ),
      ].map((cb) => normalizeStatus(cb.value)),
    );
    ACTIVE_FILTERS[group] = ACTIVE_FILTERS[group].filter((value) =>
      visibleValues.has(normalizeStatus(value)),
    );
  });
}

function updateFilterButtonState() {
  const btn = $("peqFilterBtn");
  if (!btn) return;
  const count = document.querySelectorAll(
    "#peqFilterDrawer input[data-filter-group]:checked",
  ).length;
  btn.classList.toggle("peq-filter-btn--active", count > 0);
  const badge = btn.querySelector(".peq-filter-badge");
  if (badge) {
    badge.textContent = count || "";
    badge.style.display = count ? "" : "none";
  }
  const summary = document.querySelector(".peq-filter-summary");
  if (summary)
    summary.textContent = count
      ? `${count} filter${count === 1 ? "" : "s"} applied`
      : "No filters applied";
}

function syncFilterCheckboxes() {
  sanitizeActiveFiltersToVisibleOptions();
  document
    .querySelectorAll("#peqFilterDrawer input[data-filter-group]")
    .forEach((cb) => {
      const group = cb.dataset.filterGroup;
      cb.checked = ACTIVE_FILTERS[group].includes(normalizeStatus(cb.value));
    });
  updateFilterButtonState();
}

function toggleFilterDrawer() {
  const drawer = $("peqFilterDrawer");
  if (!drawer) return;
  _filterDrawerOpen = !_filterDrawerOpen;
  drawer.classList.toggle("open", _filterDrawerOpen);
}

function closeFilterDrawer() {
  _filterDrawerOpen = false;
  $("peqFilterDrawer")?.classList.remove("open");
}

function wireFilterDrawer() {
  $("peqFilterBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFilterDrawer();
  });
  $("peqFilterDrawer")?.addEventListener("change", (e) => {
    const cb = e.target;
    if (!(cb instanceof HTMLInputElement) || !cb.dataset.filterGroup) return;
    const group = cb.dataset.filterGroup;
    const value = normalizeStatus(cb.value);
    if (cb.checked) {
      if (!ACTIVE_FILTERS[group].includes(value))
        ACTIVE_FILTERS[group].push(value);
    } else {
      ACTIVE_FILTERS[group] = ACTIVE_FILTERS[group].filter((v) => v !== value);
    }
    updateFilterButtonState();
    applyFilters();
  });
  $("peqFilterClear")?.addEventListener("click", () => {
    ACTIVE_FILTERS = { status: [], issue: [], source: [] };
    syncFilterCheckboxes();
    applyFilters();
  });
  $("peqFilterSelectAll")?.addEventListener("click", () => {
    document
      .querySelectorAll("#peqFilterDrawer input[data-filter-group]")
      .forEach((cb) => {
        const group = cb.dataset.filterGroup;
        const value = normalizeStatus(cb.value);
        if (!ACTIVE_FILTERS[group].includes(value))
          ACTIVE_FILTERS[group].push(value);
      });
    syncFilterCheckboxes();
    applyFilters();
  });
  document.addEventListener("click", (e) => {
    const wrapper = $("peqFilterWrapper");
    if (wrapper && !wrapper.contains(e.target)) closeFilterDrawer();
  });
}

function handleError(message, err, inModal = false) {
  console.error(`[costing-suite] ${message}`, err);
  const detail = err?.message ? `${message}: ${err.message}` : message;
  if (inModal && drawerContent)
    drawerContent.innerHTML = `<div class="status" style="color:#b91c1c">${escapeHtml(detail)}</div>`;
  else setStatus(detail, "error");
  showToast(message, "error", 4200);
}


async function resolveAuthenticatedUserId() {
  try {
    await supabase.auth.refreshSession();
  } catch {
    /* ignore */
  }

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getSession();
    if (authError) throw authError;

    const userId = authData?.session?.user?.id;
    if (userId) {
      CURRENT_EXPORT_USER = authData.session.user.email || "--";
      return userId;
    }
  } catch (err) {
    console.warn("[costing-suite] getSession failed", err);
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData?.user?.id) {
      CURRENT_EXPORT_USER = userData.user.email || "--";
      return userData.user.id;
    }
  } catch (err) {
    console.warn("[costing-suite] getUser failed", err);
  }

  try {
    const platformSession = await Platform.getSession?.();
    const userId = platformSession?.user?.id ?? null;
    if (userId) {
      CURRENT_EXPORT_USER =
        platformSession.user.email || platformSession.user.id || "--";
      return userId;
    }
  } catch (err) {
    console.warn("[costing-suite] Platform.getSession failed", err);
  }

  return null;
}

function resolveLoginPageUrl() {
  try {
    return new URL("../../login.html", window.location.href).pathname;
  } catch {
    return "/login.html";
  }
}

function redirectToLogin() {
  try {
    window.location.href = resolveLoginPageUrl();
  } catch {
    window.location.href = "/login.html";
  }
}

const costSheetCtrl = createCostSheetController({
  dom: {
    costSheetModal,
    costSheetA4,
    costSheetModalTitle,
    costSheetModalSubtitle,
    costSheetModalHint,
    costSheetCloseBtn,
    costSheetPdfBtn,
    costSheetSignModal,
    costSheetSignCloseBtn,
    costSheetSignCancelBtn,
    costSheetSignConfirmBtn,
    csPreparedRole,
    csPreparedOrg,
    csVerifiedRole,
    csVerifiedOrg,
    csApprovedRole,
    csApprovedOrg,
    searchBox,
    costSheetExplainDrawer,
    costSheetExplainBackdrop,
    costSheetExplainCloseBtn,
    costSheetExplainContent,
    costSheetExplainTitle,
    costSheetExplainSubtitle,
  },
  enableLineExplain:
    document.body?.dataset?.costingModuleKey === "cost-sheet-review",
  costingFrom,
  showToast,
  text,
  formatMoney,
  formatPercent,
  formatNumber,
  formatDateTime,
  formatPeriodMonth,
  statusChip,
  getRowStatus,
  laneClass,
  compactStatusText,
  productSkuLabel,
  cpCellPrimary,
  normalizeStatus,
  uniqueValues,
  detailPanel,
  kvSection,
  simpleTable,
  getExportedAtIst,
  formatTodayIsoIst,
  toKebabSlug,
  getCurrentExportUser: () => CURRENT_EXPORT_USER,
  canNavigateTraceabilityDrill,
  navigateTraceabilityDrill,
  getActivePeriodStart: () => ACTIVE_PERIOD_START,
  getCurrentLens: () => CURRENT_LENS,
  costingRpc,
});

const pricingPolicyCtrl = createPricingPolicyController({
  dom: {
    drawerClose,
    sellingPolicyEditModal,
    sellingPolicyEditCloseBtn,
    sellingPolicyEditCancelBtn,
    sellingPolicyEditSaveBtn,
    sellingPolicyEditSkuLabel,
    sellingPolicyGstPercent,
    sellingPolicyIkDiscountPercent,
    sellingPolicyOkDiscountPercent,
    sellingPolicyIkDiscountAmount,
    sellingPolicyOkDiscountAmount,
    sellingPolicyContingencyPercent,
    sellingPolicyEffectiveFrom,
    sellingPolicyRemarks,
    schemePolicyEditModal,
    schemePolicyEditCloseBtn,
    schemePolicyEditCancelBtn,
    schemePolicyEditSaveBtn,
    schemePolicyEditRegion,
    schemePolicyEditScheme,
    schemePolicyEditEffectiveFrom,
    schemePolicyEditRemarks,
    schemeRuleEditModal,
    schemeRuleEditCloseBtn,
    schemeRuleEditCancelBtn,
    schemeRuleEditSaveBtn,
    schemeRuleScope,
    schemeRuleScopeSearch,
    schemeRuleScopeSelect,
    schemeRuleRegion,
    schemeRuleScheme,
    schemeRuleApplyMode,
    schemeRuleReplaceFromScheme,
    schemeRuleReplaceFromWrap,
    schemeRuleEffectiveFrom,
    schemeRuleRemarks,
    schemeRuleCloseModal,
    schemeRuleCloseCloseBtn,
    schemeRuleCloseCancelBtn,
    schemeRuleCloseSaveBtn,
    schemeRuleCloseLabel,
    schemeRuleCloseEffectiveTo,
    schemeRuleCloseRemarks,
  },
  costingFrom,
  costingRpc,
  fetchAllRows,
  showToast,
  handleError,
  setLoadingMask,
  text,
  formatMoney,
  formatPercent,
  formatNumber,
  formatDate,
  formatDateTime,
  formatOptionalMoney,
  statusChip,
  compactStatusText,
  productSkuLabel,
  cpCellPrimary,
  cpCellPrimaryHtml,
  normalizeStatus,
  detailPanel,
  kvSection,
  simpleTable,
  activePeriodIso,
  numberOrNullFromInput,
  numberOrZeroFromInput,
  reloadRows: loadRowsForLens,
  onPolicyDataChanged: async ({ drawerTab, skuId } = {}) => {
    await loadRowsForLens();
    if (!skuId || !drawerTab) return;
    if (SELECTED_ROW?.sku_id && String(SELECTED_ROW.sku_id) === String(skuId)) {
      const updated = ALL_ROWS.find(
        (r) => String(r.sku_id) === String(skuId),
      );
      if (updated) {
        SELECTED_ROW = updated;
        await setDrawerTab(drawerTab);
      }
    }
  },
  getCurrentLens: () => CURRENT_LENS,
  getSelectedSkuId: () => SELECTED_ROW?.sku_id ?? null,
});

const costBuildCtrl = createCostBuildController({
  dom: {
    kpiStripWrap,
    globalSearchCard,
    genericTableMetaRow,
    genericTableMetaActions,
    tableWrap,
    statusArea,
    searchBox,
    manualProvisionEditModal,
    manualProvisionEditTitle,
    manualProvisionEditCloseBtn,
    manualProvisionEditBanner,
    manualProvisionPeriodStart,
    manualProvisionAllocationPool,
    manualProvisionType,
    manualProvisionKey,
    manualProvisionLabel,
    manualProvisionAmount,
    manualProvisionSourceReference,
    manualProvisionRemarks,
    manualProvisionSaveBtn,
    manualProvisionCancelBtn,
    manualProvisionDeactivateBtn,
    manualProvisionDeactivateModal,
    manualProvisionDeactivateCloseBtn,
    manualProvisionDeactivateLabel,
    manualProvisionDeactivateReason,
    manualProvisionDeactivateSaveBtn,
    manualProvisionDeactivateCancelBtn,
    expenseMappingEditModal,
    expenseMappingEditCloseBtn,
    expenseMappingEditCancelBtn,
    expenseMappingEditSaveBtn,
    expenseMappingLabel,
    expenseMappingPool,
    expenseMappingInclude,
    expenseMappingRemarks,
    expenseMappingDetailModal,
    expenseMappingDetailCloseBtn,
    expenseMappingDetailEditBtn,
    expenseMappingDetailCloseMappingBtn,
    expenseMappingDetailContent,
    expenseMappingCloseModal,
    expenseMappingCloseModalCloseBtn,
    expenseMappingCloseModalCancelBtn,
    expenseMappingCloseModalSaveBtn,
    expenseMappingCloseLabel,
    expenseMappingCloseReason,
    staffGovernanceReviewModal,
    staffGovernanceReviewCloseBtn,
    staffGovernanceReviewOkBtn,
    staffClassificationEditModal,
    staffClassificationEditCloseBtn,
    staffClassificationEditCancelBtn,
    staffClassificationEditSaveBtn,
    staffClassificationLabel,
    staffClassificationClass,
    staffClassificationPool,
    staffClassificationEffectiveFrom,
    staffClassificationWeight,
    staffClassificationRemarks,
  },
  costingFrom,
  costingRpc,
  fetchAllRows,
  showToast,
  handleError,
  setLoadingMask,
  setVisible,
  text,
  escapeHtml,
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  compactStatusText,
  normalizeStatus,
  cpCellPrimary,
  cpCellPrimaryHtml,
  detailPanel,
  kvSection,
  activePeriodIso,
  numberOrNullFromInput,
  normalizeMonthStart,
  getCurrentMonthStart,
  reloadRows: loadRowsForLens,
  renderTable,
  updateSearchClear,
  getSearchValue: () => searchBox?.value ?? "",
  getCurrentLens: () => CURRENT_LENS,
  getActivePeriodStart: () => ACTIVE_PERIOD_START,
  closeDetails,
  setRowsAndView: ({ allRows, view, currentPage }) => {
    ALL_ROWS = allRows;
    VIEW = view;
    if (currentPage != null) CURRENT_PAGE = currentPage;
  },
});

const controlCenterCtrl = createControlCenterController({
  dom: { kpiStrip, workbenchSummary },
  costingFrom,
  fetchAllRows,
  text,
  escapeHtml,
  formatNumber,
  formatDate,
  formatDateTime,
  statusChip,
  normalizeStatus,
  cpCellPrimary,
  kvSection,
  detailPanel,
  simpleTable,
  showToast,
  handleError,
  getActivePeriodStart: () => ACTIVE_PERIOD_START,
  getSelectedRow: () => SELECTED_ROW,
  pricingPolicyCtrl,
  drillToLens: async (lensId, filters) => {
    const moduleKey =
      getModuleKeyForLens(lensId) || ACTIVE_ROUTE_CONFIG.moduleKey;
    await drillToCostingTarget(moduleKey, lensId, filters);
  },
});

const materialCostCtrl = createMaterialCostController({
  dom: {
    drawerClose,
    manualRateEditModal,
    manualRateEditCloseBtn,
    manualRateEditCancelBtn,
    manualRateEditSaveBtn,
    manualRateStockItemLabel,
    manualRateCurrentRate,
    manualRateCurrentSource,
    manualRateCurrentDate,
    manualRateEvidenceStrip,
    manualRateEvidenceSelectedRate,
    manualRateEvidenceSelectedSource,
    manualRateEvidenceSelectedDate,
    manualRateEvidenceLatestPurchaseRate,
    manualRateEvidenceLatestPurchaseDate,
    manualRateEvidenceActiveManualRate,
    manualRateEvidenceManualRateStatus,
    manualRateEvidenceNewerPurchase,
    manualRateEvidenceOverrideFlag,
    manualRateEvidenceAffectedSkuCount,
    manualRateValue,
    manualRateEffectiveFrom,
    manualRateReason,
    manualRateCloseModal,
    manualRateCloseCloseBtn,
    manualRateCloseCancelBtn,
    manualRateCloseSaveBtn,
    manualRateCloseLabel,
    manualRateCloseEffectiveTo,
    manualRateCloseReason,
    materialReviewAcceptModal,
    materialReviewAcceptCloseBtn,
    materialReviewAcceptCancelBtn,
    materialReviewAcceptSaveBtn,
    materialReviewAcceptStockItem,
    materialReviewAcceptMaterialArea,
    materialReviewAcceptIssueCodes,
    materialReviewAcceptWarningCodes,
    materialReviewAcceptActionSummary,
    materialReviewAcceptReason,
    materialReviewAcceptNote,
    materialReviewCloseAcceptanceModal,
    materialReviewCloseAcceptanceCloseBtn,
    materialReviewCloseAcceptanceCancelBtn,
    materialReviewCloseAcceptanceSaveBtn,
    materialReviewCloseStockItem,
    materialReviewCloseDetails,
    materialReviewCloseReason,
  },
  costingFrom,
  costingRpc,
  fetchAllRows,
  showToast,
  handleError,
  setLoadingMask,
  text,
  formatMoney,
  formatNumber,
  formatPercent,
  formatDate,
  formatDateTime,
  compactStatusText,
  normalizeStatus,
  statusChip,
  laneClass,
  issueCodeLabel,
  cpCellPrimary,
  detailPanel,
  kvSection,
  simpleTable,
  activePeriodIso,
  numberOrNullFromInput,
  getCurrentMonthStart,
  getSkuDiagnosis,
  getCurrentLens: () => CURRENT_LENS,
  getActivePeriodStart: () => ACTIVE_PERIOD_START,
  getSelectedRow: () => SELECTED_ROW,
  setSelectedRow: (row) => {
    SELECTED_ROW = row;
  },
  getAllRows: () => ALL_ROWS,
  reloadRows: loadRowsForLens,
  setDrawerTab,
  refreshOpenDrawerIfNeeded,
  runStagedCostingRefreshAndReload,
  canEditMaterialCostActions,
  markCostingRefreshDirty,
  isCostingRefreshDirty,
  getTracePermissions: () => ({
    currentComponent: CURRENT_TRACE_COMPONENT,
    canViewTrace: CAN_VIEW_TRACE,
    canExportTrace: CAN_EXPORT_TRACE,
    permissionsResolved: TRACE_PERMISSIONS_RESOLVED,
  }),
  syncTraceExportButtonState,
});

function renderKpiStrip() {
  controlCenterCtrl.renderKpiStrip();
}

async function init() {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      redirectToLogin();
      return;
    }

    await loadPermissions(userId);
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }

    applyRouteHeader();
    applyKpiStripVisibility();
    applyRouteLaunchParams();
    ensureCostingRefreshOverlay();
    loadCostingRefreshDirtyFromSession();
    updateCostingRefreshDirtyUi();

    ACTIVE_PERIOD_START = await resolveActivePeriodStart();
    if (LAUNCH_DRILL_CONTEXT?.periodStart) {
      ACTIVE_PERIOD_START = LAUNCH_DRILL_CONTEXT.periodStart;
    }
    await loadAvailableCostingPeriods();
    costBuildCtrl.setManualProvisionPeriodFilter(
      normalizeMonthStart(ACTIVE_PERIOD_START || new Date()),
    );
    renderCostingPeriodOptions();
    syncPeriodControlState();
    if (LAUNCH_DRILL_CONTEXT) {
      if (
        LAUNCH_DRILL_CONTEXT.managerTab &&
        CURRENT_LENS === "manual-rate-manager"
      ) {
        materialCostCtrl.setManualRateManagerTab(LAUNCH_DRILL_CONTEXT.managerTab);
      }
      if (CURRENT_LENS === "rm-cost-trace") {
        materialCostCtrl.applyTraceLaunchContext(LAUNCH_DRILL_CONTEXT);
      }
      LAUNCH_DRILL_CONTEXT = null;
    }
    renderLensPills();
    syncFilterCheckboxes();
    wireFilterDrawer();
    costSheetCtrl.bindEvents();
    await pricingPolicyCtrl.loadOptions();
    pricingPolicyCtrl.bindEvents();
    await costBuildCtrl.loadOptions();
    costBuildCtrl.bindEvents();
    materialCostCtrl.bindEvents();

    await loadRowsForLens();
    void resumeInFlightRefreshRunIfNeeded();
  } catch (err) {
    handleError("Initialization error", err);
  }
}

refreshBtn?.addEventListener("click", refreshCostingChain);
costingPeriodSelect?.addEventListener("change", () => {
  if (costingPeriodSelect.disabled) return;
  setActiveCostingPeriod(costingPeriodSelect.value);
});
exportBtn?.addEventListener("click", () => {
  void exportActiveViewCsv();
});
$("homeBtn")?.addEventListener("click", () => Platform.goHome());
searchBox?.addEventListener("input", () => {
  if (isRmCostTraceLensActive()) return;
  if (CURRENT_LENS === "manual-provisions") {
    costBuildCtrl.applyManualProvisionFilters();
    return;
  }
  applySearch();
});
searchClear?.addEventListener("click", () => {
  if (isRmCostTraceLensActive()) return;
  searchBox.value = "";
  if (CURRENT_LENS === "manual-provisions") {
    costBuildCtrl.applyManualProvisionFilters();
  } else {
    applySearch();
  }
  searchBox.focus();
});
lensSelect?.addEventListener("change", () => switchLens(lensSelect.value));
prevPage?.addEventListener("click", () => {
  if (isRmCostTraceLensActive()) {
    const page = materialCostCtrl.getTracePage();
    if (page <= 1) return;
    CURRENT_PAGE = page - 1;
    void loadRowsForLens({ preservePage: true });
    return;
  }
  if (CURRENT_PAGE > 1) {
    CURRENT_PAGE -= 1;
    renderTable();
  }
});
nextPage?.addEventListener("click", () => {
  if (isRmCostTraceLensActive()) {
    const page = materialCostCtrl.getTracePage();
    const totalPages = Math.max(
      1,
      Math.ceil(Number(materialCostCtrl.getTraceTotalCount() || 0) / PAGE_SIZE),
    );
    if (page >= totalPages) return;
    CURRENT_PAGE = page + 1;
    void loadRowsForLens({ preservePage: true });
    return;
  }
  if (CURRENT_PAGE < Math.ceil(VIEW.length / PAGE_SIZE)) {
    CURRENT_PAGE += 1;
    renderTable();
  }
});
drawerClose?.addEventListener("click", closeDetails);
detailsModal?.addEventListener("click", (e) => {
  if (e.target === detailsModal) closeDetails();
});

function isReadonlyOverlayOpen(element) {
  if (!element) return false;
  if (element.classList.contains("hidden")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  return true;
}

function closeTopmostReadonlyOverlay() {
  const overlays = Array.from(
    document.querySelectorAll('[data-readonly-overlay="true"]'),
  ).filter(isReadonlyOverlayOpen);

  if (!overlays.length) return false;

  overlays.sort((a, b) => {
    const za = Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
    const zb = Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
    return za - zb;
  });

  const top = overlays[overlays.length - 1];
  if (top.id === "costSheetExplainDrawer") {
    costSheetCtrl.closeCostSheetExplainDrawer();
    return true;
  }
  if (top.id === "costSheetModal") {
    costSheetCtrl.closeCostSheetModal();
    return true;
  }
  if (top.id === "detailsModal") {
    closeDetails();
    return true;
  }
  return false;
}

function handleCostingEscapeKey() {
  closeFilterDrawer();
  closeFreshnessDetail();
  if (costSheetCtrl.handleEscapeKeyForEditForms?.()) return;
  if (pricingPolicyCtrl.handleEscapeKey()) return;
  if (costBuildCtrl.handleEscapeKey()) return;
  if (materialCostCtrl.handleEscapeKey()) return;
  closeTopmostReadonlyOverlay();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    handleCostingEscapeKey();
  }
});
lastRefreshed?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleFreshnessDetail();
});
document.addEventListener("click", (e) => {
  if (lastRefreshed && !lastRefreshed.contains(e.target)) {
    closeFreshnessDetail();
  }
});
setInterval(updateFreshnessIndicator, 60000);

export {
  bootstrapCostingSuite,
  init,
  loadPermissions,
  getCurrentMonthStart,
  resolveActivePeriodStart,
  refreshCostingChain,
  runStagedCostingRefreshAndReload,
  loadRowsForLens,
  applyFilters,
  applySearch,
  renderKpiStrip,
  renderLensPills,
  renderTable,
  openDetails,
  closeDetails,
  setDrawerTab,
  showToast,
  exportCsvForRows,
  updateFreshnessIndicator,
};
