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
  createSchemeComparisonController,
  isSchemeComparisonLens,
  SCHEME_COMPARISON_VIEW,
} from "./costing-suite-scheme-comparison.js";
import {
  createPricingPolicyController,
  isPricingPolicyLens,
  workspaceSupportsPeq,
  workspaceSupportsSearch,
  workspaceSupportsPeriod,
  PRICING_POLICY_NAV_GROUPS,
  PRICING_POLICY_AREA_IDS,
  PRICING_POLICY_DEFAULT_WORKSPACE,
  PRICING_POLICY_WORKSPACES,
  getLegacyLensForPricingPolicyWorkspace,
  getPricingPolicyGroupForWorkspace,
  getPricingPolicyWorkspaceMeta,
  resolveActivePricingPolicyDirectWorkspaceId,
  resolvePricingPolicyLaunchNavigation,
  toCanonicalPricingPolicyRouteParams,
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
  resolveRelocatedPricingPolicyTarget,
  buildSchemeComparisonRedirectParams,
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

let PERM_CAN_VIEW = false;
let PERM_CAN_EDIT = false;
let PERM_CONTROL_CENTER_EDIT = false;
/** True when permission RPC/fallback could not resolve a trustworthy result. */
let PERMISSIONS_LOAD_ERROR = false;

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
const pricingPolicyWorkspaceSelect = $("pricingPolicyWorkspaceSelect");
const pricingPolicyWorkspaceSelectWrap = $("pricingPolicyWorkspaceSelectWrap");
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
const schemePolicyEditSkuLabel = $("schemePolicyEditSkuLabel");
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
const schemeMasterCreateModal = $("schemeMasterCreateModal");
const schemeMasterCreateCloseBtn = $("schemeMasterCreateCloseBtn");
const schemeMasterCreateCancelBtn = $("schemeMasterCreateCancelBtn");
const schemeMasterCreateSaveBtn = $("schemeMasterCreateSaveBtn");
const schemeMasterCreateError = $("schemeMasterCreateError");
const schemeMasterCreateName = $("schemeMasterCreateName");
const schemeMasterCreatePaidQty = $("schemeMasterCreatePaidQty");
const schemeMasterCreateFreeQty = $("schemeMasterCreateFreeQty");
const schemeMasterCreateRemarks = $("schemeMasterCreateRemarks");
const schemeMasterCreateApprovalReference = $(
  "schemeMasterCreateApprovalReference",
);
const schemeMasterCreatePreview = $("schemeMasterCreatePreview");
const schemeMasterMetadataModal = $("schemeMasterMetadataModal");
const schemeMasterMetadataCloseBtn = $("schemeMasterMetadataCloseBtn");
const schemeMasterMetadataCancelBtn = $("schemeMasterMetadataCancelBtn");
const schemeMasterMetadataSaveBtn = $("schemeMasterMetadataSaveBtn");
const schemeMasterMetadataError = $("schemeMasterMetadataError");
const schemeMasterMetadataStructure = $("schemeMasterMetadataStructure");
const schemeMasterMetadataName = $("schemeMasterMetadataName");
const schemeMasterMetadataRemarks = $("schemeMasterMetadataRemarks");
const schemeMasterMetadataReason = $("schemeMasterMetadataReason");
const schemeMasterMetadataApprovalReference = $(
  "schemeMasterMetadataApprovalReference",
);
const schemeMasterDeactivateModal = $("schemeMasterDeactivateModal");
const schemeMasterDeactivateCloseBtn = $("schemeMasterDeactivateCloseBtn");
const schemeMasterDeactivateCancelBtn = $("schemeMasterDeactivateCancelBtn");
const schemeMasterDeactivateSaveBtn = $("schemeMasterDeactivateSaveBtn");
const schemeMasterDeactivateError = $("schemeMasterDeactivateError");
const schemeMasterDeactivateIdentity = $("schemeMasterDeactivateIdentity");
const schemeMasterDeactivateDirectPolicies = $(
  "schemeMasterDeactivateDirectPolicies",
);
const schemeMasterDeactivateHierarchyRules = $(
  "schemeMasterDeactivateHierarchyRules",
);
const schemeMasterDeactivateReplacementRefs = $(
  "schemeMasterDeactivateReplacementRefs",
);
const schemeMasterDeactivateReason = $("schemeMasterDeactivateReason");
const schemeMasterDeactivateApprovalReference = $(
  "schemeMasterDeactivateApprovalReference",
);
const schemeMasterReactivateModal = $("schemeMasterReactivateModal");
const schemeMasterReactivateCloseBtn = $("schemeMasterReactivateCloseBtn");
const schemeMasterReactivateCancelBtn = $("schemeMasterReactivateCancelBtn");
const schemeMasterReactivateSaveBtn = $("schemeMasterReactivateSaveBtn");
const schemeMasterReactivateError = $("schemeMasterReactivateError");
const schemeMasterReactivateIdentity = $("schemeMasterReactivateIdentity");
const schemeMasterReactivateReason = $("schemeMasterReactivateReason");
const schemeMasterReactivateApprovalReference = $(
  "schemeMasterReactivateApprovalReference",
);
const schemeMasterHistoryModal = $("schemeMasterHistoryModal");
const schemeMasterHistoryCloseBtn = $("schemeMasterHistoryCloseBtn");
const schemeMasterHistoryDismissBtn = $("schemeMasterHistoryDismissBtn");
const schemeMasterHistoryTitle = $("schemeMasterHistoryTitle");
const schemeMasterHistoryBody = $("schemeMasterHistoryBody");
const mrpPolicyEditModal = $("mrpPolicyEditModal");
const mrpPolicyEditTitle = $("mrpPolicyEditTitle");
const mrpPolicyEditError = $("mrpPolicyEditError");
const mrpPolicyEditCloseBtn = $("mrpPolicyEditCloseBtn");
const mrpPolicyEditCancelBtn = $("mrpPolicyEditCancelBtn");
const mrpPolicyEditSaveBtn = $("mrpPolicyEditSaveBtn");
const mrpPolicyEditSkuLabel = $("mrpPolicyEditSkuLabel");
const mrpPolicyEditCalcMode = $("mrpPolicyEditCalcMode");
const mrpPolicyEditMrpIk = $("mrpPolicyEditMrpIk");
const mrpPolicyEditMrpOk = $("mrpPolicyEditMrpOk");
const mrpPolicyEditOkPct = $("mrpPolicyEditOkPct");
const mrpPolicyEditEffectiveFrom = $("mrpPolicyEditEffectiveFrom");
const mrpPolicyEffectiveDateChip = $("mrpPolicyEffectiveDateChip");
const mrpPolicyEffectiveDateWarning = $("mrpPolicyEffectiveDateWarning");
const mrpPolicyEffectiveDateError = $("mrpPolicyEffectiveDateError");
const mrpPolicyEditReason = $("mrpPolicyEditReason");
const mrpPolicyEditApprovalReference = $("mrpPolicyEditApprovalReference");
const mrpPolicyEditPreview = $("mrpPolicyEditPreview");
const derivationPolicyEditModal = $("derivationPolicyEditModal");
const derivationPolicyEditTitle = $("derivationPolicyEditTitle");
const derivationPolicyEditError = $("derivationPolicyEditError");
const derivationPolicyEditCloseBtn = $("derivationPolicyEditCloseBtn");
const derivationPolicyEditCancelBtn = $("derivationPolicyEditCancelBtn");
const derivationPolicyEditDraftBtn = $("derivationPolicyEditDraftBtn");
const derivationPolicyEditConfirmBtn = $("derivationPolicyEditConfirmBtn");
const derivationPolicyConfirmModal = $("derivationPolicyConfirmModal");
const derivationPolicyConfirmCloseBtn = $("derivationPolicyConfirmCloseBtn");
const derivationPolicyConfirmCancelBtn = $("derivationPolicyConfirmCancelBtn");
const derivationPolicyConfirmProceedBtn = $("derivationPolicyConfirmProceedBtn");
const derivationPolicyEditProductWrap = $("derivationPolicyEditProductWrap");
const derivationPolicyEditProduct = $("derivationPolicyEditProduct");
const derivationPolicyEditProductLabelWrap = $(
  "derivationPolicyEditProductLabelWrap",
);
const derivationPolicyEditProductLabel = $("derivationPolicyEditProductLabel");
const derivationPolicyEditGovernanceNote = $(
  "derivationPolicyEditGovernanceNote",
);
const derivationPolicyEditReferenceSku = $("derivationPolicyEditReferenceSku");
const derivationPolicyEditRefMrpDisplay = $("derivationPolicyEditRefMrpDisplay");
const derivationPolicyEditSmallerPct = $("derivationPolicyEditSmallerPct");
const derivationPolicyEditLargerPct = $("derivationPolicyEditLargerPct");
const derivationPolicyEditCeiling = $("derivationPolicyEditCeiling");
const derivationPolicyEditEffectiveFrom = $("derivationPolicyEditEffectiveFrom");
const derivationPolicyEffectiveDateChip = $("derivationPolicyEffectiveDateChip");
const derivationPolicyEffectiveDateWarning = $(
  "derivationPolicyEffectiveDateWarning",
);
const derivationPolicyEffectiveDateError = $("derivationPolicyEffectiveDateError");
const derivationPolicyEditReason = $("derivationPolicyEditReason");
const derivationPolicyEditApprovalReference = $(
  "derivationPolicyEditApprovalReference",
);
const futurePolicyConfirmModal = $("futurePolicyConfirmModal");
const futurePolicyConfirmCloseBtn = $("futurePolicyConfirmCloseBtn");
const futurePolicyConfirmSummary = $("futurePolicyConfirmSummary");
const futurePolicyConfirmReviewBtn = $("futurePolicyConfirmReviewBtn");
const futurePolicyConfirmProceedBtn = $("futurePolicyConfirmProceedBtn");
const scheduledPolicyCancelModal = $("scheduledPolicyCancelModal");
const scheduledPolicyCancelCloseBtn = $("scheduledPolicyCancelCloseBtn");
const scheduledPolicyCancelError = $("scheduledPolicyCancelError");
const scheduledPolicyCancelSummary = $("scheduledPolicyCancelSummary");
const scheduledPolicyCancelReason = $("scheduledPolicyCancelReason");
const scheduledPolicyCancelReasonError = $("scheduledPolicyCancelReasonError");
const scheduledPolicyCancelApprovalReference = $(
  "scheduledPolicyCancelApprovalReference",
);
const scheduledPolicyCancelKeepBtn = $("scheduledPolicyCancelKeepBtn");
const scheduledPolicyCancelProceedBtn = $("scheduledPolicyCancelProceedBtn");
const mrpProposalGenerateModal = $("mrpProposalGenerateModal");
const mrpProposalGenerateError = $("mrpProposalGenerateError");
const mrpProposalGenerateCloseBtn = $("mrpProposalGenerateCloseBtn");
const mrpProposalGenerateCancelBtn = $("mrpProposalGenerateCancelBtn");
const mrpProposalGenerateSaveBtn = $("mrpProposalGenerateSaveBtn");
const mrpProposalGenerateProduct = $("mrpProposalGenerateProduct");
const mrpProposalGenerateContext = $("mrpProposalGenerateContext");
const mrpProposalGenerateEffectiveFrom = $("mrpProposalGenerateEffectiveFrom");
const mrpProposalGenerateReason = $("mrpProposalGenerateReason");
const mrpProposalGenerateApprovalReference = $(
  "mrpProposalGenerateApprovalReference",
);
const mrpProposalAdjustModal = $("mrpProposalAdjustModal");
const mrpProposalAdjustError = $("mrpProposalAdjustError");
const mrpProposalAdjustCloseBtn = $("mrpProposalAdjustCloseBtn");
const mrpProposalAdjustCancelBtn = $("mrpProposalAdjustCancelBtn");
const mrpProposalAdjustSaveBtn = $("mrpProposalAdjustSaveBtn");
const mrpProposalAdjustContext = $("mrpProposalAdjustContext");
const mrpProposalAdjustCalcMode = $("mrpProposalAdjustCalcMode");
const mrpProposalAdjustModeHint = $("mrpProposalAdjustModeHint");
const mrpProposalAdjustMrpIk = $("mrpProposalAdjustMrpIk");
const mrpProposalAdjustMrpOk = $("mrpProposalAdjustMrpOk");
const mrpProposalAdjustMrpOkWrap = $("mrpProposalAdjustMrpOkWrap");
const mrpProposalAdjustOkPct = $("mrpProposalAdjustOkPct");
const mrpProposalAdjustOkPctWrap = $("mrpProposalAdjustOkPctWrap");
const mrpProposalAdjustReason = $("mrpProposalAdjustReason");
const mrpProposalAdjustPreview = $("mrpProposalAdjustPreview");
const mrpProposalResetModal = $("mrpProposalResetModal");
const mrpProposalResetError = $("mrpProposalResetError");
const mrpProposalResetCloseBtn = $("mrpProposalResetCloseBtn");
const mrpProposalResetCancelBtn = $("mrpProposalResetCancelBtn");
const mrpProposalResetSaveBtn = $("mrpProposalResetSaveBtn");
const mrpProposalResetContext = $("mrpProposalResetContext");
const mrpProposalResetReason = $("mrpProposalResetReason");
const mrpProposalSubmitModal = $("mrpProposalSubmitModal");
const mrpProposalSubmitError = $("mrpProposalSubmitError");
const mrpProposalSubmitCloseBtn = $("mrpProposalSubmitCloseBtn");
const mrpProposalSubmitCancelBtn = $("mrpProposalSubmitCancelBtn");
const mrpProposalSubmitSaveBtn = $("mrpProposalSubmitSaveBtn");
const mrpProposalSubmitIdentity = $("mrpProposalSubmitIdentity");
const mrpProposalSubmitNote = $("mrpProposalSubmitNote");
const mrpDecisionLineModal = $("mrpDecisionLineModal");
const mrpDecisionLineModalTitle = $("mrpDecisionLineModalTitle");
const mrpDecisionLineModalError = $("mrpDecisionLineModalError");
const mrpDecisionLineModalCloseBtn = $("mrpDecisionLineModalCloseBtn");
const mrpDecisionLineModalCancelBtn = $("mrpDecisionLineModalCancelBtn");
const mrpDecisionLineModalSaveBtn = $("mrpDecisionLineModalSaveBtn");
const mrpDecisionLineModalNote = $("mrpDecisionLineModalNote");
const mrpDecisionLineModalContext = $("mrpDecisionLineModalContext");
const mrpDecisionLineModalReason = $("mrpDecisionLineModalReason");
const mrpApplicationApplyModal = $("mrpApplicationApplyModal");
const mrpApplicationApplyError = $("mrpApplicationApplyError");
const mrpApplicationApplyCloseBtn = $("mrpApplicationApplyCloseBtn");
const mrpApplicationApplyCancelBtn = $("mrpApplicationApplyCancelBtn");
const mrpApplicationApplySaveBtn = $("mrpApplicationApplySaveBtn");
const mrpApplicationApplyIdentity = $("mrpApplicationApplyIdentity");
const mrpApplicationApplyNote = $("mrpApplicationApplyNote");
const manualRateEditModal = $("manualRateEditModal");
const manualRateEditTitle = $("manualRateEditTitle");
const manualRateEditCloseBtn = $("manualRateEditCloseBtn");
const manualRateEditSaveBtn = $("manualRateEditSaveBtn");
const manualRateEvidenceStrip = $("manualRateEvidenceStrip");
const manualRateEvidenceSelectedRate = $("manualRateEvidenceSelectedRate");
const manualRateEvidenceSelectedMeta = $("manualRateEvidenceSelectedMeta");
const manualRateEvidenceLatestPurchaseRate = $(
  "manualRateEvidenceLatestPurchaseRate",
);
const manualRateEvidenceLatestPurchaseDate = $(
  "manualRateEvidenceLatestPurchaseDate",
);
const manualRateEvidenceActiveManualRate = $("manualRateEvidenceActiveManualRate");
const manualRateEvidenceManualRateStatus = $("manualRateEvidenceManualRateStatus");
const manualRateEvidenceNotes = $("manualRateEvidenceNotes");
const manualRateRateBasis = $("manualRateRateBasis");
const manualRateVendorOffersSection = $("manualRateVendorOffersSection");
const manualRateVendorOffersBody = $("manualRateVendorOffersBody");
const manualRateVendorSourceInfo = $("manualRateVendorSourceInfo");
const manualRateRateLabel = $("manualRateRateLabel");
const manualRateMaterialCombobox = $("manualRateMaterialCombobox");
const manualRateMaterialSearch = $("manualRateMaterialSearch");
const manualRateMaterialSuggestions = $("manualRateMaterialSuggestions");
const manualRateMaterialSearchStatus = $("manualRateMaterialSearchStatus");
const manualRateChangeMaterialBtn = $("manualRateChangeMaterialBtn");
const manualRateFormSections = $("manualRateFormSections");
const manualRateInactiveHint = $("manualRateInactiveHint");
const manualRateError = $("manualRateError");
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
    workspace:
      String(payload.workspace || "").trim() || null,
    policyTab:
      String(payload.policyTab || payload.policy_tab || "").trim() || null,
    mrpTab: String(payload.mrpTab || payload.mrp_tab || "").trim() || null,
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
  if (normalized.workspace) pending.workspace = normalized.workspace;
  if (normalized.policyTab) pending.policyTab = normalized.policyTab;
  if (normalized.mrpTab) pending.mrpTab = normalized.mrpTab;
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
  if (getAllowedLensIds().includes(lensId)) return true;
  if (!isPricingPolicyManagerRoute()) return false;
  if (PRICING_POLICY_AREA_IDS.includes(lensId)) return true;
  const legacy = getLegacyLensForPricingPolicyWorkspace(
    getDefaultWorkspaceForCompatLens(lensId),
  );
  return !!legacy && getAllowedLensIds().includes(legacy);
}

function getDefaultWorkspaceForCompatLens(lensId) {
  const id = String(lensId || "").trim();
  if (id === "mrp-workflow") return "mrp-proposals";
  if (
    id === "mrp-policies" ||
    id === "mrp-governance" ||
    id === "mrp-policy-setup" ||
    id === "mrp-change-workflow"
  ) {
    return "sku-mrp-policies";
  }
  if (
    id === "selling-schemes" ||
    id === "policy-manager"
  ) {
    return "sku-overview";
  }
  return PRICING_POLICY_DEFAULT_WORKSPACE;
}

/**
 * F4 — write canonical ?workspace= PPM navigation with replaceState.
 * Existing non-navigation query state remains unchanged.
 */
function replacePricingPolicyUrl() {
  if (!isPricingPolicyManagerRoute()) return;
  try {
    const workspaceId =
      pricingPolicyCtrl.getPricingPolicyWorkspace?.() ||
      PRICING_POLICY_DEFAULT_WORKSPACE;
    const url = new URL(window.location.href);
    const qs = new URLSearchParams(url.search);
    qs.set("workspace", workspaceId);
    qs.delete("lens");
    qs.delete("mrpTab");
    qs.delete("policyTab");
    qs.delete("mrp_tab");
    qs.delete("policy_tab");
    qs.delete("area");
    qs.delete("group");
    const next = `${url.pathname}?${qs.toString()}${url.hash || ""}`;
    const current = `${url.pathname}${url.search}${url.hash || ""}`;
    if (next !== current) {
      window.history.replaceState({}, "", next);
    }
  } catch (_err) {
    /* ignore history failures */
  }
}

function applyPricingPolicyLaunchNavigation(resolved) {
  const nav = pricingPolicyCtrl.setPricingPolicyWorkspace?.(
    resolved.workspaceId,
  );
  CURRENT_LENS =
    nav?.legacyLensId ||
    resolved.legacyLensId ||
    getLegacyLensForPricingPolicyWorkspace(resolved.workspaceId);
  replacePricingPolicyUrl();
  return nav;
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
  if (params.workspace) qs.set("workspace", params.workspace);
  if (params.status?.length) qs.set("status", params.status.join(","));
  if (params.issue?.length) qs.set("issue", params.issue.join(","));
  if (params.source?.length) qs.set("source", params.source.join(","));
  // PPM canonicalization happens before this shared builder. Legacy PPM tab
  // keys are inbound-only and are never emitted here.
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

function navigateToCostingRoute(moduleKey, params = {}, options = {}) {
  const config = COSTING_ROUTE_CONFIG[moduleKey];
  if (!config?.routePath) {
    showToast(`Route is not configured for ${moduleKey}.`, "error");
    return false;
  }

  const clientKey = getCostingClientKey();
  const routeParams =
    moduleKey === "pricing-policy-manager"
      ? toCanonicalPricingPolicyRouteParams(params)
      : params;
  const href = `${resolveCostingRouteHref(config.routePath, clientKey)}${buildCostingRouteQuery(routeParams)}`;
  if (options.replace === true) {
    window.location.replace(href);
  } else {
    window.location.href = href;
  }
  return true;
}

/**
 * SC5: when booting Pricing Policy Manager with a relocated Scheme Comparison
 * target, leave PPM before workspace fallback / first data load.
 * Module-scoped: only runs on pricing-policy-manager pages.
 * @returns {boolean} true when navigation was started (caller must abort init)
 */
function redirectRelocatedSchemeComparisonFromPpmIfNeeded() {
  if (!isPricingPolicyManagerRoute()) return false;
  if (isCostSheetReviewRoute()) return false;

  const qp = new URLSearchParams(window.location.search);
  const relocated = resolveRelocatedPricingPolicyTarget({
    lens: qp.get("lens"),
    workspace: qp.get("workspace"),
    mrpTab: qp.get("mrpTab"),
    policyTab: qp.get("policyTab"),
  });
  if (!relocated?.relocated) return false;

  const params = buildSchemeComparisonRedirectParams(qp);
  const started = navigateToCostingRoute("cost-sheet-review", params, {
    replace: true,
  });
  if (!started) {
    showToast(
      "Scheme Comparison is now available under Cost Sheet Review & Approval.",
      "warning",
      5200,
    );
  }
  return true;
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

function canEditPricingPolicyActions() {
  return PERM_CAN_EDIT === true;
}

function isPricingPolicyManagerRoute() {
  return MODULE_ID === "pricing-policy-manager";
}

function isCostSheetReviewRoute() {
  return MODULE_ID === "cost-sheet-review";
}

/** Authoritative Pricing Policy Manager module entry: view OR edit. */
function canAccessPricingPolicyModule() {
  return PERM_CAN_VIEW === true || PERM_CAN_EDIT === true;
}

/**
 * View-only banner for Pricing Policy Manager.
 * Visible only when can_view && !can_edit (not for edit-only or denied).
 */
function syncPricingPolicyPermissionUi() {
  if (!isPricingPolicyManagerRoute()) return;
  const banner = $("pricingPolicyViewOnlyBanner");
  const viewOnly = PERM_CAN_VIEW === true && PERM_CAN_EDIT !== true;
  if (banner) banner.hidden = !viewOnly;
  document.body.classList.toggle("pricing-policy-view-only", viewOnly);
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
  const mrpTab = qp.get("mrpTab")?.trim();
  const workspace = qp.get("workspace")?.trim();

  const queryDrill = normalizeDrillContext({
    manager_tab: qp.get("manager_tab"),
    trace_component: qp.get("trace_component"),
    material_area: qp.get("material_area"),
    period_start: qp.get("period_start"),
    product_id: qp.get("product_id"),
    sku_id: qp.get("sku_id"),
    stock_item_id: qp.get("stock_item_id"),
    policyTab,
    workspace,
  });
  LAUNCH_DRILL_CONTEXT = mergeDrillContext(LAUNCH_DRILL_CONTEXT, queryDrill);
  applyPendingDrillContext();

  if (LAUNCH_DRILL_CONTEXT?.managerTab) {
    materialCostCtrl.setManualRateManagerTab(LAUNCH_DRILL_CONTEXT.managerTab);
  }

  // F4: resolve once with workspace ownership, derive compatibility state, then
  // replace legacy/N4 input with the workspace-only canonical URL.
  if (isPricingPolicyManagerRoute()) {
    const resolved = resolvePricingPolicyLaunchNavigation({
      lens,
      workspace,
      mrpTab,
      policyTab,
    });
    const rawLensInvalid =
      !!lens &&
      !getPricingPolicyWorkspaceMeta(workspace) &&
      !PRICING_POLICY_AREA_IDS.includes(lens) &&
      lens !== "mrp-governance" &&
      lens !== "policy-manager";
    if (rawLensInvalid) {
      showToast(
        `Lens "${lens}" is not available on this route. Showing the default view instead.`,
        "warning",
        4200,
      );
    } else if (
      workspace !== null &&
      workspace !== undefined &&
      !getPricingPolicyWorkspaceMeta(workspace)
    ) {
      showToast(
        `Workspace "${workspace || "(blank)"}" is not available. Showing SKU Policy Overview instead.`,
        "warning",
        4200,
      );
    }
    applyPricingPolicyLaunchNavigation(resolved);
    return;
  }

  if (!lens) {
    CURRENT_LENS = ACTIVE_ROUTE_CONFIG.defaultLens;
    pricingPolicyCtrl.syncNavigationFromLegacyLens?.(CURRENT_LENS);
    return;
  }

  if (isLensAllowedForRoute(lens)) {
    CURRENT_LENS = lens;
    pricingPolicyCtrl.syncNavigationFromLegacyLens?.(CURRENT_LENS);
    return;
  }

  showToast(
    `Lens "${lens}" is not available on this route. Showing the default view instead.`,
    "warning",
    4200,
  );
  CURRENT_LENS = ACTIVE_ROUTE_CONFIG.defaultLens;
  pricingPolicyCtrl.syncNavigationFromLegacyLens?.(CURRENT_LENS);
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
      workspace: normalizedFilters.workspace,
      policyTab: normalizedFilters.policyTab,
      mrpTab: normalizedFilters.mrpTab,
    };
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

  if (moduleKey === "pricing-policy-manager") {
    const resolved = resolvePricingPolicyLaunchNavigation({
      lens: lensId,
      workspace: normalizedFilters.workspace,
      policyTab: normalizedFilters.policyTab,
      mrpTab: normalizedFilters.mrpTab,
    });
    applyPricingPolicyLaunchNavigation(resolved);
    renderLensPills();
    syncPricingPolicyLensChrome();
    closeDetails();
    try {
      await loadRowsForLens();
    } catch (err) {
      handleError("Failed to open Pricing Policy Manager drill", err);
    }
    searchBox?.focus();
    return;
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
  "scheme-comparison": SCHEME_COMPARISON_VIEW,
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
    s === "CANCELLED" ||
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

function renderRegisterEmptyTableMessage(message) {
  clearStatus();
  tableWrap?.classList.remove("hidden");
  tableWrap?.classList.add("tw-visible");
  const colCount = Math.max(
    1,
    tableHead?.querySelectorAll("th").length || 0,
  );
  tableBody.innerHTML = `
    <tr class="cp-register-empty-row">
      <td class="cp-register-empty-cell" colspan="${colCount}">
        <div class="cp-register-empty-message" role="status">${escapeHtml(message)}</div>
      </td>
    </tr>`;
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
  // Fail closed before resolution — never retain prior/optimistic grants.
  PERM_CAN_VIEW = false;
  PERM_CAN_EDIT = false;
  PERM_CONTROL_CENTER_EDIT = false;
  PERMISSIONS_LOAD_ERROR = false;
  CAN_VIEW_TRACE = false;
  CAN_EXPORT_TRACE = false;
  TRACE_PERMISSIONS_RESOLVED = false;
  syncPricingPolicyPermissionUi();

  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: sessionUserId,
    });
    if (!error && Array.isArray(perms)) {
      applyPermissionEntriesFromRpc(perms);
      TRACE_PERMISSIONS_RESOLVED = true;
      syncRefreshButtonDisabled();
      syncTraceExportButtonState();
      syncPricingPolicyPermissionUi();
      return;
    }
    if (error) {
      console.warn("[costing-suite] permission RPC failed", error);
      PERMISSIONS_LOAD_ERROR = true;
    }
  } catch (err) {
    console.warn("[costing-suite] permission RPC exception", err);
    PERMISSIONS_LOAD_ERROR = true;
  }

  try {
    const { data } = await supabase
      .from("user_permissions")
      .select("module_id, can_view, can_edit")
      .eq("user_id", sessionUserId)
      .eq("module_id", MODULE_ID)
      .limit(1);
    if (Array.isArray(data) && data.length) {
      PERM_CAN_VIEW = data[0].can_view === true;
      PERM_CAN_EDIT = data[0].can_edit === true;
      PERMISSIONS_LOAD_ERROR = false;
    }
  } catch (err) {
    console.warn("[costing-suite] permission fallback failed", err);
    PERMISSIONS_LOAD_ERROR = true;
  }

  TRACE_PERMISSIONS_RESOLVED = true;
  syncRefreshButtonDisabled();
  syncTraceExportButtonState();
  syncPricingPolicyPermissionUi();
}

function applyPermissionEntriesFromRpc(perms) {
  const byTarget = new Map(
    perms.filter((row) => row?.target).map((row) => [row.target, row]),
  );

  const routeEntry = byTarget.get(ACTIVE_ROUTE_CONFIG.permissionTarget);
  if (routeEntry) {
    // Malformed / non-boolean truthy values must not grant access.
    PERM_CAN_VIEW = routeEntry.can_view === true;
    PERM_CAN_EDIT = routeEntry.can_edit === true;
  } else {
    // Missing module permission row → deny both.
    PERM_CAN_VIEW = false;
    PERM_CAN_EDIT = false;
  }

  const controlCenterEntry = byTarget.get("module:costing-control-center");
  PERM_CONTROL_CENTER_EDIT = controlCenterEntry?.can_edit === true;

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
  if (isPricingPolicyManagerRoute()) {
    // F5: PPM has no period-capable workspace.
    const workspaceId =
      pricingPolicyCtrl.getPricingPolicyWorkspace?.() ||
      PRICING_POLICY_DEFAULT_WORKSPACE;
    if (workspaceSupportsPeriod(workspaceId)) return true;
    return false;
  }
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

function relocatePricingPolicyChromeHosts() {
  if (!isPricingPolicyManagerRoute()) return;
  const host = $("pricingPolicyMetaChrome");
  if (!host) return;

  const peqWrapper = $("peqFilterWrapper");

  // Filter button lives in meta row (period control is CSR-only after SC4).
  if (peqWrapper && peqWrapper.parentElement !== host) {
    host.appendChild(peqWrapper);
  }
}

function syncPricingPolicyLensChrome() {
  if (!isPricingPolicyManagerRoute()) return;

  relocatePricingPolicyChromeHosts();

  // F5: capability flags from flat workspace metadata.
  const workspaceId =
    pricingPolicyCtrl.getPricingPolicyWorkspace?.() ||
    getPricingPolicyActiveDirectWorkspaceId() ||
    PRICING_POLICY_DEFAULT_WORKSPACE;
  const legacyLensId = getLegacyLensForPricingPolicyWorkspace(workspaceId);
  const isMrpWorkspace = legacyLensId === "mrp-governance";
  const supportsPeq = workspaceSupportsPeq(workspaceId);
  const supportsSearch = workspaceSupportsSearch(workspaceId);
  const isSkuMrpRegister =
    isMrpWorkspace &&
    (pricingPolicyCtrl.isSkuMrpPoliciesTabActive?.() ||
      pricingPolicyCtrl.isProductDerivationPoliciesTabActive?.() ||
      pricingPolicyCtrl.isMrpProposalsTabActive?.() ||
      pricingPolicyCtrl.isMrpDecisionsTabActive?.() ||
      pricingPolicyCtrl.isMrpApplicationTabActive?.() ||
      pricingPolicyCtrl.isMrpAppliedHistoryTabActive?.());
  const showMetaFilter = supportsPeq || isSkuMrpRegister;
  const filterWrapper = $("peqFilterWrapper");
  const filterBtn = $("peqFilterBtn");
  const filterDrawer = $("peqFilterDrawer");
  const mrpFilterBody = $("mrpFilterDrawerBody");
  const peqFooterSummary = document.querySelector(
    '#peqFilterDrawer [data-peq-footer="summary"]',
  );
  const peqFooterActions = document.querySelector(
    '#peqFilterDrawer [data-peq-footer="actions"]',
  );

  // Selling PEQ or MRP workspace filters — funnel in meta row.
  if (filterWrapper) setVisible(filterWrapper, showMetaFilter);
  if (filterBtn) {
    filterBtn.disabled = !showMetaFilter;
    if (!showMetaFilter) {
      filterBtn.classList.remove("peq-filter-btn--active");
      const badge = filterBtn.querySelector(".peq-filter-badge");
      if (badge) badge.style.display = "none";
      closeFilterDrawer();
    }
  }

  const metaChrome = $("pricingPolicyMetaChrome");
  if (metaChrome) setVisible(metaChrome, showMetaFilter, "inline-flex");

  if (isSkuMrpRegister) {
    document
      .querySelectorAll("#peqFilterDrawer [data-peq-section]")
      .forEach((section) => setVisible(section, false));
    if (peqFooterSummary) setVisible(peqFooterSummary, false);
    if (peqFooterActions) setVisible(peqFooterActions, false);
    filterDrawer?.classList.add("is-mrp-mode");
    if (mrpFilterBody) {
      mrpFilterBody.hidden = false;
      mrpFilterBody.removeAttribute("hidden");
      const content = pricingPolicyCtrl.getActiveMrpFilterDrawerContent?.();
      if (content?.html) {
        mrpFilterBody.innerHTML = content.html;
        updateMrpFilterButtonBadge(content.activeCount || 0);
        pricingPolicyCtrl.wireActiveMrpFilterDrawer?.(mrpFilterBody);
      } else {
        mrpFilterBody.innerHTML = `<div class="peq-filter-summary">No filters for this view.</div>`;
        updateMrpFilterButtonBadge(0);
      }
    }
  } else {
    filterDrawer?.classList.remove("is-mrp-mode");
    if (mrpFilterBody) {
      mrpFilterBody.innerHTML = "";
      mrpFilterBody.hidden = true;
      mrpFilterBody.setAttribute("hidden", "");
    }
    if (peqFooterSummary) setVisible(peqFooterSummary, true);
    if (peqFooterActions) setVisible(peqFooterActions, true);

    // Status for Selling; no PPM period section after SC4.
    // Issue/Source stay hidden on PPM (material-cost leftovers).
    document
      .querySelectorAll("#peqFilterDrawer [data-peq-section]")
      .forEach((section) => {
        const key = section.getAttribute("data-peq-section");
        let show = false;
        if (key === "status") show = supportsPeq;
        setVisible(section, show);
      });
    if (supportsPeq) {
      sanitizeActiveFiltersToVisibleOptions();
      syncFilterCheckboxes();
    } else if (
      ACTIVE_FILTERS.issue?.length ||
      ACTIVE_FILTERS.source?.length ||
      ACTIVE_FILTERS.status?.length
    ) {
      // Leaving Selling: do not keep PEQ selections bleeding into MRP workspaces.
      ACTIVE_FILTERS = { status: [], issue: [], source: [] };
    }
  }

  if (searchBox) {
    const effectiveDisable = isMrpWorkspace
      ? !isSkuMrpRegister
      : !supportsSearch;
    searchBox.disabled = effectiveDisable;
    searchBox.readOnly = effectiveDisable;
  }
  if (searchClear && isMrpWorkspace && !isSkuMrpRegister) {
    searchClear.style.display = "none";
  }
}

function updateMrpFilterButtonBadge(activeCount) {
  const btn = $("peqFilterBtn");
  if (!btn) return;
  const count = Number(activeCount) || 0;
  btn.classList.toggle("peq-filter-btn--active", count > 0);
  const badge = btn.querySelector(".peq-filter-badge");
  if (badge) {
    badge.textContent = count || "";
    badge.style.display = count ? "" : "none";
  }
}

/** Original CSR Status checklist HTML (restored when leaving Scheme Comparison). */
let _csrStatusChecklistHtml = null;

/**
 * SC3: Cost Sheet Review chrome for Scheme Comparison.
 * Period → #costingPeriodSelect / ACTIVE_PERIOD_START (via syncPeriodControlState).
 * PEQ → Status only (scheme_viability_status); Issue/Source hidden.
 * Workbench → cleared like Cost Comparison.
 */
function syncCostSheetReviewLensChrome() {
  if (!isCostSheetReviewRoute()) return;

  const filterWrapper = $("peqFilterWrapper");
  const filterBtn = $("peqFilterBtn");
  const isScheme = isSchemeComparisonLens(CURRENT_LENS);

  if (filterWrapper) setVisible(filterWrapper, true);
  if (filterBtn) {
    filterBtn.disabled = false;
    updateFilterButtonState();
  }

  document
    .querySelectorAll("#peqFilterDrawer [data-peq-section]")
    .forEach((section) => {
      const key = section.getAttribute("data-peq-section");
      if (key === "period") {
        setVisible(section, false);
        return;
      }
      if (isScheme) {
        setVisible(
          section,
          !!schemeComparisonCtrl.supportsPeqGroup?.(key),
        );
      } else {
        setVisible(section, true);
      }
    });

  if (isScheme) {
    const deferredStatusRebuild = refreshSchemeComparisonStatusPeqOptions();
    ACTIVE_FILTERS.issue = [];
    ACTIVE_FILTERS.source = [];
    // When Status rebuild is deferred (prior-lens rows still loaded), do not
    // sanitize Status against a stale/empty checklist — that would wipe drill/URL filters.
    if (!deferredStatusRebuild) {
      sanitizeActiveFiltersToVisibleOptions();
    }
  } else {
    restoreCsrStatusPeqOptions();
    sanitizeActiveFiltersToVisibleOptions();
  }

  syncFilterCheckboxes();

  if (searchBox) {
    searchBox.disabled = false;
    searchBox.readOnly = false;
  }
}

function refreshSchemeComparisonStatusPeqOptions() {
  const statusSection = document.querySelector(
    '#peqFilterDrawer [data-peq-section="status"]',
  );
  const list = statusSection?.querySelector(".peq-filter-checklist");
  if (!list) return false;

  if (_csrStatusChecklistHtml == null) {
    _csrStatusChecklistHtml = list.innerHTML;
  }

  // Defer rebuild while prior-lens rows are still in ALL_ROWS (switchLens runs
  // chrome sync before loadRows). Avoid wiping Status filters set by drills/URL.
  const hasSchemeStatusField = (ALL_ROWS || []).some(
    (row) =>
      row != null &&
      Object.prototype.hasOwnProperty.call(row, "scheme_viability_status"),
  );
  if ((ALL_ROWS || []).length > 0 && !hasSchemeStatusField) {
    return true;
  }

  const values = [
    ...new Set(
      ALL_ROWS.map((row) => String(row.scheme_viability_status || "").trim()).filter(
        Boolean,
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const valid = new Set(values.map((value) => normalizeStatus(value)));
  ACTIVE_FILTERS.status = ACTIVE_FILTERS.status.filter((value) =>
    valid.has(normalizeStatus(value)),
  );

  list.innerHTML = values.length
    ? values
        .map(
          (value) => `<li>
                <label
                  ><input
                    type="checkbox"
                    data-filter-group="status"
                    value="${escapeHtml(value)}"
                  />
                  ${escapeHtml(value)}</label
                >
              </li>`,
        )
        .join("")
    : "";
  return false;
}

function restoreCsrStatusPeqOptions() {
  if (_csrStatusChecklistHtml == null) return;
  const statusSection = document.querySelector(
    '#peqFilterDrawer [data-peq-section="status"]',
  );
  const list = statusSection?.querySelector(".peq-filter-checklist");
  if (!list) return;
  list.innerHTML = _csrStatusChecklistHtml;
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
      CURRENT_LENS === "printable-cost-sheet" ||
      CURRENT_LENS === "mrp-governance"
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

    // Scheme Comparison owned by schemeComparisonCtrl (CSR only after SC4).
    if (isSchemeComparisonLens(CURRENT_LENS)) {
      if (isPricingPolicyManagerRoute()) {
        ALL_ROWS = [];
        VIEW = [];
        CURRENT_PAGE = 1;
        applyFilters();
        LAST_REFRESH_TIME = new Date();
        updateFreshnessIndicator();
        return;
      }
      ALL_ROWS = await schemeComparisonCtrl.loadRows(ACTIVE_PERIOD_START);
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "mrp-governance") {
      if (pricingPolicyCtrl.isSkuMrpPoliciesTabActive()) {
        ALL_ROWS = await pricingPolicyCtrl.loadSkuMrpPolicyRows();
        applyFilters();
      } else if (pricingPolicyCtrl.isProductDerivationPoliciesTabActive()) {
        ALL_ROWS = await pricingPolicyCtrl.loadProductDerivationPolicyRows();
        applyFilters();
      } else if (pricingPolicyCtrl.isMrpProposalsTabActive()) {
        ALL_ROWS = await pricingPolicyCtrl.loadMrpProposalRows();
        applyFilters();
      } else if (pricingPolicyCtrl.isMrpDecisionsTabActive()) {
        ALL_ROWS = await pricingPolicyCtrl.loadMrpDecisionRows();
        applyFilters();
      } else if (pricingPolicyCtrl.isMrpApplicationTabActive()) {
        ALL_ROWS = await pricingPolicyCtrl.loadMrpApplicationRows();
        applyFilters();
      } else if (pricingPolicyCtrl.isMrpAppliedHistoryTabActive()) {
        ALL_ROWS = await pricingPolicyCtrl.loadMrpAppliedHistoryRows();
        applyFilters();
      } else {
        ALL_ROWS = [];
        VIEW = [];
        CURRENT_PAGE = 1;
        SELECTED_ROW = null;
        closeDetails();
        applyFilters();
      }
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

  if (isPricingPolicyManagerRoute()) {
    const workspaceId =
      pricingPolicyCtrl.getPricingPolicyWorkspace?.() ||
      getPricingPolicyActiveDirectWorkspaceId();
    const workspaceMeta = workspaceId
      ? getPricingPolicyWorkspaceMeta(workspaceId)
      : null;
    if (workspaceMeta) {
      const groupMeta = getPricingPolicyGroupForWorkspace(workspaceMeta.id)
        ? PRICING_POLICY_NAV_GROUPS.find(
            (g) => g.id === workspaceMeta.groupId,
          )
        : null;
      const groupLabel = groupMeta?.label || "";
      lensSuiteLabel.textContent = groupLabel
        ? `${ACTIVE_ROUTE_CONFIG.title} → ${groupLabel} → ${workspaceMeta.label}`
        : `${ACTIVE_ROUTE_CONFIG.title} → ${workspaceMeta.label}`;
      lensSuiteLabel.title = workspaceMeta.purpose || workspaceMeta.label;
      return;
    }
  }

  const suite = getSuiteForLens(CURRENT_LENS);
  const lens = getLensMeta(CURRENT_LENS);

  if (suite && lens) {
    lensSuiteLabel.textContent = `${ACTIVE_ROUTE_CONFIG.title} → ${lens.label}`;
    lensSuiteLabel.title =
      isSchemeComparisonLens(CURRENT_LENS) && isCostSheetReviewRoute()
        ? schemeComparisonCtrl.getDescription?.() ||
          lens.description ||
          suite.label
        : lens.description || suite.label;
    return;
  }

  lensSuiteLabel.textContent = ACTIVE_ROUTE_CONFIG.title;
  lensSuiteLabel.title = ACTIVE_ROUTE_CONFIG.subtitle || "";
}

function renderPricingPolicyNarrowSelects() {
  const select =
    pricingPolicyWorkspaceSelect || $("pricingPolicyWorkspaceSelect");
  const wrap =
    pricingPolicyWorkspaceSelectWrap || $("pricingPolicyWorkspaceSelectWrap");
  if (!select || !wrap) return;

  // F3 narrow UX: one direct Workspace dropdown. Groups are presentation-only.
  const workspaceId = getPricingPolicyActiveDirectWorkspaceId();
  const workspaces = PRICING_POLICY_WORKSPACES || [];
  const groups = PRICING_POLICY_NAV_GROUPS || [];

  wrap.hidden = false;
  wrap.removeAttribute("hidden");
  wrap.removeAttribute("aria-hidden");
  select.disabled = false;
  select.innerHTML = groups
    .map((group) => {
      const options = workspaces
        .filter((workspace) => workspace.groupId === group.id)
        .map((workspace) => {
          const purpose = String(
            workspace.purpose || workspace.label || "",
          ).trim();
          return `<option value="${text(workspace.id)}" title="${text(purpose)}" ${
            workspaceId === workspace.id ? "selected" : ""
          }>${text(workspace.label)}</option>`;
        })
        .join("");
      if (!options) return "";
      return `<optgroup label="${text(group.label)}">${options}</optgroup>`;
    })
    .join("");

  const activeWs =
    workspaces.find((ws) => ws.id === workspaceId) || workspaces[0];
  if (activeWs?.id) select.value = activeWs.id;
  const activePurpose = String(
    activeWs?.purpose || activeWs?.label || "",
  ).trim();
  select.title = activePurpose;
  select.setAttribute("aria-description", activePurpose);
  select.setAttribute("aria-label", "Pricing policy workspace");
}

function renderLensPillButton(lensId) {
  const meta = getLensMeta(lensId);
  if (!meta) return "";

  const activeClass = lensId === CURRENT_LENS ? " active" : "";
  return `<button type="button" class="pill${activeClass}" data-lens="${meta.id}">${text(meta.label)}</button>`;
}

/**
 * PPM-C1H3.3-F2 — desktop/tablet (>520) direct workspace strip in #lensPills.
 * Narrow ≤520 uses the F3 grouped direct Workspace select.
 * Group separators are not interactive.
 */
function renderPricingPolicyDirectWorkspaceStripHtml(activeWorkspaceId) {
  const parts = [];
  let lastGroupId = null;
  for (const ws of PRICING_POLICY_WORKSPACES) {
    if (lastGroupId && lastGroupId !== ws.groupId) {
      parts.push(
        `<span class="cp-pricing-workspace-group-sep" aria-hidden="true"></span>`,
      );
    }
    lastGroupId = ws.groupId;
    const active = activeWorkspaceId === ws.id;
    const purpose = String(ws.purpose || ws.label || "").trim();
    parts.push(`
      <button
        type="button"
        class="cp-pricing-direct-workspace-tab ${active ? "active" : ""}"
        data-pricing-policy-workspace="${text(ws.id)}"
        role="tab"
        aria-selected="${active ? "true" : "false"}"
        aria-label="${text(ws.label)}"
        title="${text(purpose)}"
        data-tip="${text(purpose)}"
      >
        ${text(ws.label)}
      </button>`);
  }
  return `
    <div
      class="cp-pricing-workspace-nav-wrap"
      id="pricingPolicyWorkspaceTabsWrap"
    >
      <div
        class="cp-pricing-workspace-nav-strip"
        role="tablist"
        aria-label="Pricing policy workspaces"
      >
        ${parts.join("")}
      </div>
    </div>`;
}

function getPricingPolicyActiveDirectWorkspaceId() {
  return (
    pricingPolicyCtrl.getActiveDirectWorkspaceId?.() ||
    resolveActivePricingPolicyDirectWorkspaceId(
      pricingPolicyCtrl.getPricingPolicyWorkspace?.() ?? null,
    )
  );
}

function renderLensPills() {
  LENSES = buildActiveLenses();
  const activeSuites = getActiveSuiteModules();

  if (lensPills) {
    if (isPricingPolicyManagerRoute()) {
      const activeWorkspaceId = getPricingPolicyActiveDirectWorkspaceId();
      lensPills.innerHTML =
        renderPricingPolicyDirectWorkspaceStripHtml(activeWorkspaceId);
      lensPills
        .querySelectorAll("[data-pricing-policy-workspace]")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            void switchPricingPolicyWorkspace(btn.dataset.pricingPolicyWorkspace);
          });
        });
      requestAnimationFrame(() => {
        const activeTab = lensPills.querySelector(
          ".cp-pricing-direct-workspace-tab.active, .cp-pricing-direct-workspace-tab[aria-selected='true']",
        );
        if (activeTab?.scrollIntoView) {
          try {
            activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
          } catch (_err) {
            activeTab.scrollIntoView();
          }
        }
      });
      renderPricingPolicyNarrowSelects();
    } else {
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
  }

  if (lensSelect && !isPricingPolicyManagerRoute()) {
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

/**
 * Direct workspace switch (F2 desktop strip + narrow Workspace select).
 * Derives legacy loader lens from workspace metadata; one reload.
 */
async function switchPricingPolicyWorkspace(workspaceId) {
  if (!isPricingPolicyManagerRoute() || !workspaceId) return;
  const activeDirect = getPricingPolicyActiveDirectWorkspaceId();
  if (activeDirect === workspaceId) return;

  const nav = pricingPolicyCtrl.setPricingPolicyWorkspace?.(workspaceId);
  const legacyLensId =
    nav?.legacyLensId ||
    getLegacyLensForPricingPolicyWorkspace(nav?.workspaceId || workspaceId);

  if (!legacyLensId) return;

  const lensChanged = CURRENT_LENS !== legacyLensId;
  if (lensChanged) {
    costSheetCtrl.onLensSwitch();
    CURRENT_LENS = legacyLensId;
    if (legacyLensId === "mrp-governance") {
      closeFilterDrawer();
    }
  }

  SELECTED_ROW = null;
  CURRENT_PAGE = 1;
  replacePricingPolicyUrl();
  renderLensPills();
  syncPricingPolicyLensChrome();
  closeDetails();
  try {
    await loadRowsForLens();
  } catch (err) {
    handleError("Failed to load selected Pricing Policy workspace", err);
  }
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
  pricingPolicyCtrl.syncNavigationFromLegacyLens?.(CURRENT_LENS);
  SELECTED_ROW = null;
  if (
    CURRENT_LENS === "cost-governance" ||
    CURRENT_LENS === "staff-governance"
  ) {
    ACTIVE_FILTERS = { status: [], issue: [], source: [] };
    syncFilterCheckboxes();
  }
  if (CURRENT_LENS === "mrp-governance") {
    closeFilterDrawer();
  }
  renderLensPills();
  syncPricingPolicyLensChrome();
  syncCostSheetReviewLensChrome();
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

function isSkuMrpPoliciesLensActive() {
  return (
    CURRENT_LENS === "mrp-governance" &&
    !!pricingPolicyCtrl.isSkuMrpPoliciesTabActive?.()
  );
}

function isProductDerivationPoliciesLensActive() {
  return (
    CURRENT_LENS === "mrp-governance" &&
    !!pricingPolicyCtrl.isProductDerivationPoliciesTabActive?.()
  );
}

function isMrpProposalsLensActive() {
  return (
    CURRENT_LENS === "mrp-governance" &&
    !!pricingPolicyCtrl.isMrpProposalsTabActive?.()
  );
}

function isMrpDecisionsLensActive() {
  return (
    CURRENT_LENS === "mrp-governance" &&
    !!pricingPolicyCtrl.isMrpDecisionsTabActive?.()
  );
}

function isMrpApplicationLensActive() {
  return (
    CURRENT_LENS === "mrp-governance" &&
    !!pricingPolicyCtrl.isMrpApplicationTabActive?.()
  );
}

function isMrpAppliedHistoryLensActive() {
  return (
    CURRENT_LENS === "mrp-governance" &&
    !!pricingPolicyCtrl.isMrpAppliedHistoryTabActive?.()
  );
}

/** True when an implemented MRP register is active. */
function isMrpRegisterLensActive() {
  return (
    isSkuMrpPoliciesLensActive() ||
    isProductDerivationPoliciesLensActive() ||
    isMrpProposalsLensActive() ||
    isMrpDecisionsLensActive() ||
    isMrpApplicationLensActive() ||
    isMrpAppliedHistoryLensActive()
  );
}

function skuMrpEmptyStatusMessage() {
  const view = pricingPolicyCtrl.getSkuMrpPolicyView?.();
  return view === "history"
    ? "No approved SKU MRP policy history is available."
    : "No currently effective canonical SKU MRP policies are available.";
}

function productDerivationEmptyStatusMessage() {
  const view = pricingPolicyCtrl.getProductDerivationPolicyView?.();
  return view === "history"
    ? "No product MRP derivation policy history is available."
    : "No currently effective product MRP derivation policies are available.";
}

function mrpRegisterEmptyStatusMessage() {
  if (isMrpAppliedHistoryLensActive()) {
    return (
      pricingPolicyCtrl.getMrpAppliedHistoryEmptyStatusMessage?.() ||
      "No applied proposals exist yet."
    );
  }
  if (isMrpApplicationLensActive()) {
    return (
      pricingPolicyCtrl.getMrpApplicationEmptyStatusMessage?.() ||
      "No proposals are awaiting canonical MRP application."
    );
  }
  if (isMrpDecisionsLensActive()) {
    return (
      pricingPolicyCtrl.getMrpDecisionEmptyStatusMessage?.() ||
      "No proposals are awaiting decision."
    );
  }
  if (isMrpProposalsLensActive()) {
    return (
      pricingPolicyCtrl.getMrpProposalEmptyStatusMessage?.() ||
      "No Product MRP Proposals are available yet."
    );
  }
  return isProductDerivationPoliciesLensActive()
    ? productDerivationEmptyStatusMessage()
    : skuMrpEmptyStatusMessage();
}

function mrpRegisterNoMatchMessage() {
  if (isMrpAppliedHistoryLensActive()) {
    return (
      pricingPolicyCtrl.getMrpAppliedHistoryNoMatchMessage?.() ||
      "No applied proposals match the current filters."
    );
  }
  if (isMrpApplicationLensActive()) {
    return (
      pricingPolicyCtrl.getMrpApplicationNoMatchMessage?.() ||
      "No proposals match the current application filters."
    );
  }
  if (isMrpDecisionsLensActive()) {
    return (
      pricingPolicyCtrl.getMrpDecisionNoMatchMessage?.() ||
      "No proposals match the current decision filters."
    );
  }
  if (isMrpProposalsLensActive()) {
    return (
      pricingPolicyCtrl.getMrpProposalNoMatchMessage?.() ||
      "No proposals match the current search or filters."
    );
  }
  return isProductDerivationPoliciesLensActive()
    ? "No product MRP derivation policies match the current search or filters."
    : "No SKU MRP policies match the current search or filters.";
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
    row.scheme_type,
    row.scheme_status,
    row.scheme_viability_status,
    row.scheme_viability_note,
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
    row.pack_size,
    row.pack_uom,
    row.policy_id,
    row.approval_reference,
    row.lifecycle_label,
    row.source_type,
    row.source_quality,
    row.calc_mode,
    row.previous_policy_id,
    row.derivation_policy_id,
    row.reference_sku_id,
    row.reference_pack_size,
    row.reference_pack_uom,
    row.reference_selection_source,
    row.reference_mrp_policy_id,
    row.status,
    row.product_status,
    row.readiness_status,
    row.blocker_code,
    row.proposal_id,
    row.proposal_number,
    row.proposal_line_id,
    row.line_number,
    row.review_summary_status,
    row.submission_note,
    row.warning_code,
    row.eligibility_status,
    row.calculation_status,
    row.pack_direction,
    row.decision,
    row.__search_blob,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterMatch(row, group, selected) {
  if (!selected.length) return true;

  // SC3: Issue/Source have no columns on scheme comparison — never apply them.
  if (
    isSchemeComparisonLens(CURRENT_LENS) &&
    (group === "issue" || group === "source")
  ) {
    return true;
  }

  // SC3: Status maps only to scheme_viability_status on this lens.
  if (isSchemeComparisonLens(CURRENT_LENS) && group === "status") {
    const entry = normalizeStatus(row.scheme_viability_status);
    return selected.some((choice) => {
      const wanted = normalizeStatus(choice);
      return statusTokenMatches(entry, wanted);
    });
  }

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
    if (pricingPolicyCtrl.getPolicyManagerTab() === "scheme-master") {
      placeholder = "Search scheme name, status, or type";
    } else {
      placeholder = "Search product, SKU, scheme, policy, or status";
    }
  } else if (CURRENT_LENS === "mrp-governance") {
    if (pricingPolicyCtrl.isSkuMrpPoliciesTabActive()) {
      placeholder =
        "Search product, SKU, pack, policy ID, or approval reference";
    } else if (pricingPolicyCtrl.isProductDerivationPoliciesTabActive()) {
      placeholder =
        "Search product, Reference Pack, policy ID, or approval reference";
    } else if (pricingPolicyCtrl.isMrpProposalsTabActive()) {
      placeholder =
        pricingPolicyCtrl.getMrpProposalView?.() === "workspace"
          ? "Search SKU, pack, line, warning, or blocker"
          : "Search proposal number, product, Reference Pack, reason, or approval";
    } else if (pricingPolicyCtrl.isMrpDecisionsTabActive()) {
      placeholder =
        pricingPolicyCtrl.getMrpDecisionView?.() === "workspace"
          ? "Search SKU, pack, line, decision, warning, or blocker"
          : "Search proposal, product, submission note, or review summary";
    } else if (pricingPolicyCtrl.isMrpApplicationTabActive()) {
      placeholder =
        pricingPolicyCtrl.getMrpApplicationView?.() === "workspace"
          ? "Search SKU, pack, decision, outcome, or applied policy ID"
          : "Search proposal, product, Reference Pack, or approval reference";
    } else if (pricingPolicyCtrl.isMrpAppliedHistoryTabActive()) {
      placeholder =
        pricingPolicyCtrl.getMrpAppliedHistoryView?.() === "workspace"
          ? "Search SKU, pack, applied policy ID, previous policy, or outcome"
          : "Search applied proposal, product, applied by, or note";
    } else {
      placeholder = "Search is unavailable until this MRP workspace is implemented";
    }
  } else if (isSchemeComparisonLens(CURRENT_LENS)) {
    placeholder =
      schemeComparisonCtrl.getSearchPlaceholder?.() ||
      "Search product, SKU, scheme or status";
  }

  searchBox.placeholder = placeholder;
  searchBox.title = placeholder;
  searchBox.setAttribute("aria-label", placeholder);
}

function renderTableHeaderForLens() {
  if (CURRENT_LENS === "mrp-governance") {
    if (
      !pricingPolicyCtrl.isSkuMrpPoliciesTabActive() &&
      !pricingPolicyCtrl.isProductDerivationPoliciesTabActive() &&
      !pricingPolicyCtrl.isMrpProposalsTabActive() &&
      !pricingPolicyCtrl.isMrpDecisionsTabActive() &&
      !pricingPolicyCtrl.isMrpApplicationTabActive() &&
      !pricingPolicyCtrl.isMrpAppliedHistoryTabActive()
    ) {
      tableHead.innerHTML = "";
      return;
    }
  }

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

  if (isSchemeComparisonLens(CURRENT_LENS)) {
    const schemeHeaders = schemeComparisonCtrl.getTableHeaders();
    const schemeAlignments = schemeComparisonCtrl.getTableAlignments();
    if (schemeHeaders && schemeAlignments) {
      tableHead.innerHTML = `<tr>${schemeHeaders
        .map((h, i) => {
          const classes = [schemeAlignments[i] || "c-left"];
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
  if (isSchemeComparisonLens(CURRENT_LENS)) {
    const rowHtml = schemeComparisonCtrl.renderTableRow(row, trAttrs);
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
  syncPricingPolicyLensChrome();
  syncCostSheetReviewLensChrome();
  if (isPricingPolicyManagerRoute()) {
    renderPricingPolicyNarrowSelects();
  }
  updateLensSuiteLabel();
  updateSearchPlaceholder();
  if (CURRENT_LENS === "manual-provisions") {
    costBuildCtrl.syncManualProvisionMetaActions();
  } else if (CURRENT_LENS === "manual-rate-manager") {
    materialCostCtrl.syncRegisterMetaActions();
  } else if (isPricingPolicyManagerRoute()) {
    pricingPolicyCtrl.syncPricingPolicyMetaActions?.();
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
                : CURRENT_LENS === "mrp-governance"
                  ? pricingPolicyCtrl.getMrpGovernanceTab()
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
  } else if (CURRENT_LENS === "mrp-governance") {
    const reloadMrpLens = async () => {
      CURRENT_PAGE = 1;
      SELECTED_ROW = null;
      closeDetails();
      // Sync legacy CURRENT_LENS from active workspace (loader compatibility only).
      const legacyLensId =
        getLegacyLensForPricingPolicyWorkspace(
          pricingPolicyCtrl.getPricingPolicyWorkspace?.(),
        ) || CURRENT_LENS;
      if (legacyLensId && CURRENT_LENS !== legacyLensId) {
        CURRENT_LENS = legacyLensId;
      }
      replacePricingPolicyUrl();
      renderLensPills();
      syncPricingPolicyLensChrome();
      try {
        await loadRowsForLens();
      } catch (err) {
        handleError("Failed to load MRP Governance tab", err);
      }
    };
    pricingPolicyCtrl.renderMrpGovernanceTabs(
      workbenchSummary,
      reloadMrpLens,
      async (reason) => {
        CURRENT_PAGE = 1;
        SELECTED_ROW = null;
        closeDetails();
        try {
          if (reason === "filter") {
            ALL_ROWS = isMrpAppliedHistoryLensActive()
              ? pricingPolicyCtrl.getMrpAppliedHistoryFilteredRows()
              : isMrpApplicationLensActive()
                ? pricingPolicyCtrl.getMrpApplicationFilteredRows()
                : isMrpDecisionsLensActive()
                  ? pricingPolicyCtrl.getMrpDecisionFilteredRows()
                  : isMrpProposalsLensActive()
                    ? pricingPolicyCtrl.getMrpProposalFilteredRows()
                    : isProductDerivationPoliciesLensActive()
                      ? pricingPolicyCtrl.getProductDerivationFilteredRows()
                      : pricingPolicyCtrl.getSkuMrpFilteredRows();
            applyFilters();
            return;
          }
          await loadRowsForLens();
        } catch (err) {
          handleError("Failed to update MRP Governance register view", err);
        }
      },
    );
    // Drawer content + filter wiring needs the local-change handler set above.
    syncPricingPolicyLensChrome();
  } else if (CURRENT_LENS === "policy-manager") {
    pricingPolicyCtrl.renderPolicyManagerTabs(workbenchSummary, async () => {
      CURRENT_PAGE = 1;
      SELECTED_ROW = null;
      closeDetails();
      replacePricingPolicyUrl();
      renderLensPills();
      syncPricingPolicyLensChrome();
      try {
        await loadRowsForLens();
      } catch (err) {
        handleError("Failed to load Policy Manager tab", err);
      }
    });
    pricingPolicyCtrl.syncPricingPolicyMetaActions();
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
  } else if (CURRENT_LENS === "mrp-governance") {
    if (!isMrpRegisterLensActive()) {
      clearStatus();
      tableHead.innerHTML = "";
      tableWrap?.classList.remove("hidden");
      tableWrap?.classList.add("tw-visible");
      tableBody.innerHTML = `
      <tr class="cp-mrp-governance-empty-row">
        <td class="cp-mrp-governance-empty-cell">
          ${pricingPolicyCtrl.renderMrpGovernanceEmptyStateHtml()}
        </td>
      </tr>`;
    } else if (!VIEW.length) {
      renderRegisterEmptyTableMessage(
        searchBox?.value?.trim()
          ? mrpRegisterNoMatchMessage()
          : mrpRegisterEmptyStatusMessage(),
      );
    } else {
      clearStatus();
      tableWrap?.classList.remove("hidden");
      tableWrap?.classList.add("tw-visible");
      tableBody.innerHTML = pageRows
        .map((row, idx) => renderRowForLens(row, start + idx))
        .join("");
    }
  } else if (CURRENT_LENS === "policy-manager" && !VIEW.length) {
    const managerTab = pricingPolicyCtrl.getPolicyManagerTab?.();
    renderRegisterEmptyTableMessage(
      searchBox?.value?.trim()
        ? "No selling / scheme rows match the current filters."
        : managerTab === "scheme-master"
          ? "No schemes exist yet."
          : managerTab === "scheme-rule-register"
            ? "No scheme rules are available for this view."
            : "No policy overview rows are available yet.",
    );
  } else if (isSchemeComparisonLens(CURRENT_LENS) && !VIEW.length) {
    renderRegisterEmptyTableMessage(
      schemeComparisonCtrl.getEmptyStateMessage(),
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

      if (CURRENT_LENS === "mrp-governance") {
        if (!isMrpRegisterLensActive()) return;
        if (isMrpProposalsLensActive()) {
          openDetails(
            row,
            row.proposal_line_id != null ? "line-identity" : "proposal-summary",
          );
          return;
        }
        if (isMrpDecisionsLensActive()) {
          openDetails(
            row,
            row.proposal_line_id != null ? "line-decision" : "proposal-summary",
          );
          return;
        }
        if (isMrpApplicationLensActive()) {
          openDetails(
            row,
            row.proposal_line_id != null
              ? "line-application"
              : "proposal-summary",
          );
          return;
        }
        if (isMrpAppliedHistoryLensActive()) {
          openDetails(
            row,
            row.proposal_line_id != null ? "line-audit" : "proposal-summary",
          );
          return;
        }
        openDetails(row, "policy-detail");
        return;
      }

      if (isCostBuildLens(CURRENT_LENS)) {
        costBuildCtrl.handleCostBuildRowClick(CURRENT_LENS, row, tr);
        return;
      }

      if (CURRENT_LENS === "policy-manager") {
        const managerTab = pricingPolicyCtrl.getPolicyManagerTab();
        if (managerTab === "scheme-master") {
          openDetails(row, "scheme-detail");
          return;
        }
        if (managerTab === "scheme-rule-register") {
          openDetails(row, "rule-detail");
          return;
        }
      }

      if (CURRENT_LENS === "printable-cost-sheet") {
        void costSheetCtrl.handlePrintableRowClick(row);
        return;
      }

      let preferred;
      if (isSchemeComparisonLens(CURRENT_LENS)) {
        preferred = schemeComparisonCtrl.getPreferredDrawerTab?.() || "scheme";
      }

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

  if (isSkuMrpPoliciesLensActive()) {
    pricingPolicyCtrl.wireSkuMrpTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (isProductDerivationPoliciesLensActive()) {
    pricingPolicyCtrl.wireProductDerivationTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (isMrpProposalsLensActive()) {
    pricingPolicyCtrl.wireMrpProposalTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (isMrpDecisionsLensActive()) {
    pricingPolicyCtrl.wireMrpDecisionTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (isMrpApplicationLensActive()) {
    pricingPolicyCtrl.wireMrpApplicationTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (isMrpAppliedHistoryLensActive()) {
    pricingPolicyCtrl.wireMrpAppliedHistoryTableActions(tableBody, (matcher) =>
      VIEW.find(matcher),
    );
  }

  if (rowCount) {
    if (CURRENT_LENS === "mrp-governance" && !isMrpRegisterLensActive()) {
      rowCount.style.display = "none";
      rowCount.textContent = "";
    } else {
      rowCount.style.display = "";
      rowCount.textContent = `${totalCount.toLocaleString("en-IN")} row${totalCount === 1 ? "" : "s"}`;
    }
  }
  if (pageLabel) {
    if (CURRENT_LENS === "mrp-governance" && !isMrpRegisterLensActive()) {
      pageLabel.textContent = "";
    } else {
      const pageForLabel = rmTraceActive
        ? materialCostCtrl.getTracePage()
        : CURRENT_PAGE;
      pageLabel.textContent = `Page ${pageForLabel}/${totalPages}`;
    }
  }
  if (prevPage) {
    prevPage.disabled =
      (CURRENT_LENS === "mrp-governance" && !isMrpRegisterLensActive()) ||
      (rmTraceActive ? materialCostCtrl.getTracePage() : CURRENT_PAGE) <= 1;
  }
  if (nextPage) {
    nextPage.disabled =
      (CURRENT_LENS === "mrp-governance" && !isMrpRegisterLensActive()) ||
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
  const { data, error } = await costingFrom(SCHEME_COMPARISON_VIEW)
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
    } else if (isSkuMrpPoliciesLensActive()) {
      drawerContent.innerHTML = pricingPolicyCtrl.renderSkuMrpDrawerTab(
        tabId,
        SELECTED_ROW,
      );
      pricingPolicyCtrl.wireSkuMrpDrawerActions?.(tabId, SELECTED_ROW);
    } else if (isProductDerivationPoliciesLensActive()) {
      drawerContent.innerHTML = pricingPolicyCtrl.renderProductDerivationDrawerTab(
        tabId,
        SELECTED_ROW,
      );
      pricingPolicyCtrl.wireProductDerivationDrawerActions?.(tabId, SELECTED_ROW);
    } else if (isMrpProposalsLensActive()) {
      drawerContent.innerHTML = pricingPolicyCtrl.renderMrpProposalDrawerTab(
        tabId,
        SELECTED_ROW,
      );
      pricingPolicyCtrl.wireMrpProposalDrawerActions?.(tabId, SELECTED_ROW);
    } else if (isMrpDecisionsLensActive()) {
      drawerContent.innerHTML = pricingPolicyCtrl.renderMrpDecisionDrawerTab(
        tabId,
        SELECTED_ROW,
      );
      pricingPolicyCtrl.wireMrpDecisionDrawerActions?.(tabId, SELECTED_ROW);
    } else if (isMrpApplicationLensActive()) {
      drawerContent.innerHTML = pricingPolicyCtrl.renderMrpApplicationDrawerTab(
        tabId,
        SELECTED_ROW,
      );
      pricingPolicyCtrl.wireMrpApplicationDrawerActions?.(tabId, SELECTED_ROW);
    } else if (isMrpAppliedHistoryLensActive()) {
      drawerContent.innerHTML =
        pricingPolicyCtrl.renderMrpAppliedHistoryDrawerTab(tabId, SELECTED_ROW);
      pricingPolicyCtrl.wireMrpAppliedHistoryDrawerActions?.(tabId, SELECTED_ROW);
    } else {
      drawerContent.innerHTML = await renderSkuTab(tabId);
    }
  } catch (err) {
    handleError("Failed to load detail tab", err, true);
  }
}

function openDetails(row, preferredTab) {
  if (CURRENT_LENS === "mrp-governance" && !isMrpRegisterLensActive()) {
    return;
  }
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
  } else if (isSkuMrpPoliciesLensActive()) {
    const config = pricingPolicyCtrl.getSkuMrpDrawerConfig(row, preferredTab);
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (isProductDerivationPoliciesLensActive()) {
    const config = pricingPolicyCtrl.getProductDerivationDrawerConfig(
      row,
      preferredTab,
    );
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (isMrpProposalsLensActive()) {
    const config = pricingPolicyCtrl.getMrpProposalDrawerConfig(
      row,
      preferredTab,
    );
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (isMrpDecisionsLensActive()) {
    const config = pricingPolicyCtrl.getMrpDecisionDrawerConfig(
      row,
      preferredTab,
    );
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (isMrpApplicationLensActive()) {
    const config = pricingPolicyCtrl.getMrpApplicationDrawerConfig(
      row,
      preferredTab,
    );
    title.textContent = config.title;
    subtitle.textContent = config.subtitle;
    setModalTabs(config.tabs, config.activeTab);
    setDrawerTab(config.activeTab);
  } else if (isMrpAppliedHistoryLensActive()) {
    const config = pricingPolicyCtrl.getMrpAppliedHistoryDrawerConfig(
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
    const policyKey = SELECTED_ROW.policy_id;
    const skuKey = SELECTED_ROW.sku_id;
    const stockKey = SELECTED_ROW.stock_item_id;
    const schemeKey = SELECTED_ROW.scheme_id;
    const policyRuleKey = SELECTED_ROW.policy_rule_id;
    if (policyKey != null) {
      const updated = ALL_ROWS.find(
        (row) => String(row.policy_id) === String(policyKey),
      );
      if (updated) SELECTED_ROW = updated;
    } else if (policyRuleKey != null) {
      const updated = ALL_ROWS.find(
        (row) => String(row.policy_rule_id) === String(policyRuleKey),
      );
      if (updated) SELECTED_ROW = updated;
    } else if (schemeKey != null) {
      const updated = ALL_ROWS.find(
        (row) => String(row.scheme_id) === String(schemeKey),
      );
      if (updated) SELECTED_ROW = updated;
    } else if (skuKey != null) {
      const updated = ALL_ROWS.find(
        (row) => String(row.sku_id) === String(skuKey),
      );
      if (updated) SELECTED_ROW = updated;
    } else if (stockKey != null) {
      const updated = ALL_ROWS.find(
        (row) => String(row.stock_item_id) === String(stockKey),
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

function isPeqFilterCheckboxInteractable(cb) {
  if (!(cb instanceof HTMLInputElement)) return false;
  const section = cb.closest("[data-peq-section]");
  if (!section) return true;
  if (section.classList.contains("hidden")) return false;
  if (section.style.display === "none") return false;
  return true;
}

function getInteractablePeqFilterCheckboxes() {
  return [
    ...document.querySelectorAll("#peqFilterDrawer input[data-filter-group]"),
  ].filter(isPeqFilterCheckboxInteractable);
}

function sanitizeActiveFiltersToVisibleOptions() {
  ["status", "issue", "source"].forEach((group) => {
    const visibleValues = new Set(
      getInteractablePeqFilterCheckboxes()
        .filter((cb) => cb.dataset.filterGroup === group)
        .map((cb) => normalizeStatus(cb.value)),
    );
    ACTIVE_FILTERS[group] = ACTIVE_FILTERS[group].filter((value) =>
      visibleValues.has(normalizeStatus(value)),
    );
  });
}

function updateFilterButtonState() {
  const btn = $("peqFilterBtn");
  if (!btn) return;
  const count = getInteractablePeqFilterCheckboxes().filter(
    (cb) => cb.checked,
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
    getInteractablePeqFilterCheckboxes().forEach((cb) => {
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

const schemeComparisonCtrl = createSchemeComparisonController({
  costingFrom,
  fetchAllRows,
  text,
  formatMoney,
  formatPercent,
  compactStatusText,
  productSkuLabel,
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
    schemePolicyEditSkuLabel,
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
    schemeMasterCreateModal,
    schemeMasterCreateCloseBtn,
    schemeMasterCreateCancelBtn,
    schemeMasterCreateSaveBtn,
    schemeMasterCreateError,
    schemeMasterCreateName,
    schemeMasterCreatePaidQty,
    schemeMasterCreateFreeQty,
    schemeMasterCreateRemarks,
    schemeMasterCreateApprovalReference,
    schemeMasterCreatePreview,
    schemeMasterMetadataModal,
    schemeMasterMetadataCloseBtn,
    schemeMasterMetadataCancelBtn,
    schemeMasterMetadataSaveBtn,
    schemeMasterMetadataError,
    schemeMasterMetadataStructure,
    schemeMasterMetadataName,
    schemeMasterMetadataRemarks,
    schemeMasterMetadataReason,
    schemeMasterMetadataApprovalReference,
    schemeMasterDeactivateModal,
    schemeMasterDeactivateCloseBtn,
    schemeMasterDeactivateCancelBtn,
    schemeMasterDeactivateSaveBtn,
    schemeMasterDeactivateError,
    schemeMasterDeactivateIdentity,
    schemeMasterDeactivateDirectPolicies,
    schemeMasterDeactivateHierarchyRules,
    schemeMasterDeactivateReplacementRefs,
    schemeMasterDeactivateReason,
    schemeMasterDeactivateApprovalReference,
    schemeMasterReactivateModal,
    schemeMasterReactivateCloseBtn,
    schemeMasterReactivateCancelBtn,
    schemeMasterReactivateSaveBtn,
    schemeMasterReactivateError,
    schemeMasterReactivateIdentity,
    schemeMasterReactivateReason,
    schemeMasterReactivateApprovalReference,
    schemeMasterHistoryModal,
    schemeMasterHistoryCloseBtn,
    schemeMasterHistoryDismissBtn,
    schemeMasterHistoryTitle,
    schemeMasterHistoryBody,
    mrpPolicyEditModal,
    mrpPolicyEditTitle,
    mrpPolicyEditError,
    mrpPolicyEditCloseBtn,
    mrpPolicyEditCancelBtn,
    mrpPolicyEditSaveBtn,
    mrpPolicyEditSkuLabel,
    mrpPolicyEditCalcMode,
    mrpPolicyEditMrpIk,
    mrpPolicyEditMrpOk,
    mrpPolicyEditOkPct,
    mrpPolicyEditEffectiveFrom,
    mrpPolicyEffectiveDateChip,
    mrpPolicyEffectiveDateWarning,
    mrpPolicyEffectiveDateError,
    mrpPolicyEditReason,
    mrpPolicyEditApprovalReference,
    mrpPolicyEditPreview,
    derivationPolicyEditModal,
    derivationPolicyEditTitle,
    derivationPolicyEditError,
    derivationPolicyEditCloseBtn,
    derivationPolicyEditCancelBtn,
    derivationPolicyEditDraftBtn,
    derivationPolicyEditConfirmBtn,
    derivationPolicyConfirmModal,
    derivationPolicyConfirmCloseBtn,
    derivationPolicyConfirmCancelBtn,
    derivationPolicyConfirmProceedBtn,
    derivationPolicyEditProductWrap,
    derivationPolicyEditProduct,
    derivationPolicyEditProductLabelWrap,
    derivationPolicyEditProductLabel,
    derivationPolicyEditGovernanceNote,
    derivationPolicyEditReferenceSku,
    derivationPolicyEditRefMrpDisplay,
    derivationPolicyEditSmallerPct,
    derivationPolicyEditLargerPct,
    derivationPolicyEditCeiling,
    derivationPolicyEditEffectiveFrom,
    derivationPolicyEffectiveDateChip,
    derivationPolicyEffectiveDateWarning,
    derivationPolicyEffectiveDateError,
    derivationPolicyEditReason,
    derivationPolicyEditApprovalReference,
    futurePolicyConfirmModal,
    futurePolicyConfirmCloseBtn,
    futurePolicyConfirmSummary,
    futurePolicyConfirmReviewBtn,
    futurePolicyConfirmProceedBtn,
    scheduledPolicyCancelModal,
    scheduledPolicyCancelCloseBtn,
    scheduledPolicyCancelError,
    scheduledPolicyCancelSummary,
    scheduledPolicyCancelReason,
    scheduledPolicyCancelReasonError,
    scheduledPolicyCancelApprovalReference,
    scheduledPolicyCancelKeepBtn,
    scheduledPolicyCancelProceedBtn,
    mrpProposalGenerateModal,
    mrpProposalGenerateError,
    mrpProposalGenerateCloseBtn,
    mrpProposalGenerateCancelBtn,
    mrpProposalGenerateSaveBtn,
    mrpProposalGenerateProduct,
    mrpProposalGenerateContext,
    mrpProposalGenerateEffectiveFrom,
    mrpProposalGenerateReason,
    mrpProposalGenerateApprovalReference,
    mrpProposalAdjustModal,
    mrpProposalAdjustError,
    mrpProposalAdjustCloseBtn,
    mrpProposalAdjustCancelBtn,
    mrpProposalAdjustSaveBtn,
    mrpProposalAdjustContext,
    mrpProposalAdjustCalcMode,
    mrpProposalAdjustModeHint,
    mrpProposalAdjustMrpIk,
    mrpProposalAdjustMrpOk,
    mrpProposalAdjustMrpOkWrap,
    mrpProposalAdjustOkPct,
    mrpProposalAdjustOkPctWrap,
    mrpProposalAdjustReason,
    mrpProposalAdjustPreview,
    mrpProposalResetModal,
    mrpProposalResetError,
    mrpProposalResetCloseBtn,
    mrpProposalResetCancelBtn,
    mrpProposalResetSaveBtn,
    mrpProposalResetContext,
    mrpProposalResetReason,
    mrpProposalSubmitModal,
    mrpProposalSubmitError,
    mrpProposalSubmitCloseBtn,
    mrpProposalSubmitCancelBtn,
    mrpProposalSubmitSaveBtn,
    mrpProposalSubmitIdentity,
    mrpProposalSubmitNote,
    mrpDecisionLineModal,
    mrpDecisionLineModalTitle,
    mrpDecisionLineModalError,
    mrpDecisionLineModalCloseBtn,
    mrpDecisionLineModalCancelBtn,
    mrpDecisionLineModalSaveBtn,
    mrpDecisionLineModalNote,
    mrpDecisionLineModalContext,
    mrpDecisionLineModalReason,
    mrpApplicationApplyModal,
    mrpApplicationApplyError,
    mrpApplicationApplyCloseBtn,
    mrpApplicationApplyCancelBtn,
    mrpApplicationApplySaveBtn,
    mrpApplicationApplyIdentity,
    mrpApplicationApplyNote,
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
  formatTodayIsoIst,
  reloadRows: loadRowsForLens,
  canEditPricingPolicyActions,
  genericTableMetaActions,
  setVisible,
  onPolicyDataChanged: async ({ drawerTab, skuId, productId } = {}) => {
    await loadRowsForLens();

    if (
      productId != null &&
      SELECTED_ROW?.product_id != null &&
      String(SELECTED_ROW.product_id) === String(productId)
    ) {
      const updated =
        SELECTED_ROW.derivation_policy_id != null
          ? ALL_ROWS.find(
              (r) =>
                String(r.derivation_policy_id) ===
                  String(SELECTED_ROW.derivation_policy_id) ||
                String(r.product_id) === String(productId),
            )
          : ALL_ROWS.find((r) => String(r.product_id) === String(productId));
      if (updated) {
        SELECTED_ROW = updated;
        const activeTab =
          drawerTabs?.querySelector(".tab.active")?.dataset?.tab || drawerTab;
        const nextTab =
          activeTab === "policy-detail" ||
          activeTab === "reference-pack" ||
          activeTab === "configuration" ||
          activeTab === "evidence"
            ? activeTab
            : drawerTab || "policy-detail";
        if (nextTab) await setDrawerTab(nextTab);
      }
      return;
    }

    if (!skuId) return;
    if (SELECTED_ROW?.sku_id && String(SELECTED_ROW.sku_id) === String(skuId)) {
      const updated =
        SELECTED_ROW.policy_id != null
          ? ALL_ROWS.find(
              (r) =>
                String(r.policy_id) === String(SELECTED_ROW.policy_id) ||
                String(r.sku_id) === String(skuId),
            )
          : ALL_ROWS.find((r) => String(r.sku_id) === String(skuId));
      if (updated) {
        SELECTED_ROW = updated;
        const activeTab =
          drawerTabs?.querySelector(".tab.active")?.dataset?.tab || drawerTab;
        const nextTab =
          activeTab === "policy-history"
            ? "policy-history"
            : activeTab === "mrp-policy"
              ? "mrp-policy"
              : activeTab === "policy-detail" || activeTab === "provenance"
                ? activeTab
                : drawerTab;
        if (nextTab) await setDrawerTab(nextTab);
      }
    }
  },
  closeDetails,
  refreshOpenDrawerIfNeeded,
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
  drillToLens: async (lensId, filters) => {
    const moduleKey =
      getModuleKeyForLens(lensId) || ACTIVE_ROUTE_CONFIG.moduleKey;
    await drillToCostingTarget(moduleKey, lensId, filters);
  },
  drillToPricingPolicyWorkspace: async (workspaceId, filters = {}) => {
    await drillToCostingTarget("pricing-policy-manager", null, {
      ...filters,
      workspace: workspaceId,
    });
  },
});

const materialCostCtrl = createMaterialCostController({
  dom: {
    drawerClose,
    manualRateEditModal,
    manualRateEditTitle,
    manualRateEditCloseBtn,
    manualRateEditSaveBtn,
    manualRateEvidenceStrip,
    manualRateEvidenceSelectedRate,
    manualRateEvidenceSelectedMeta,
    manualRateEvidenceLatestPurchaseRate,
    manualRateEvidenceLatestPurchaseDate,
    manualRateEvidenceActiveManualRate,
    manualRateEvidenceManualRateStatus,
    manualRateEvidenceNotes,
    manualRateRateBasis,
    manualRateVendorOffersSection,
    manualRateVendorOffersBody,
    manualRateVendorSourceInfo,
    manualRateRateLabel,
    manualRateMaterialCombobox,
    manualRateMaterialSearch,
    manualRateMaterialSuggestions,
    manualRateMaterialSearchStatus,
    manualRateChangeMaterialBtn,
    manualRateFormSections,
    manualRateInactiveHint,
    manualRateError,
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
  genericTableMetaActions,
  setVisible,
  escapeHtml,
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

    // SC5: relocate legacy PPM Scheme Comparison URLs before PPM access gate /
    // workspace fallback / first data load. CSR enforces its own permission gate.
    if (redirectRelocatedSchemeComparisonFromPpmIfNeeded()) {
      return;
    }

    if (isPricingPolicyManagerRoute()) {
      if (!canAccessPricingPolicyModule()) {
        ALL_ROWS = [];
        VIEW = [];
        if (tableHead) tableHead.innerHTML = "";
        if (tableBody) tableBody.innerHTML = "";
        const peqRowCount = $("peqRowCount");
        if (peqRowCount) {
          peqRowCount.style.display = "none";
          peqRowCount.textContent = "";
        }
        setStatus(
          PERMISSIONS_LOAD_ERROR
            ? "Unable to verify module permissions. Access denied."
            : "You do not have permission to access this module.",
          "error",
        );
        syncPricingPolicyPermissionUi();
        pricingPolicyCtrl.syncPricingPolicyWriteUi?.();
        return;
      }
      syncPricingPolicyPermissionUi();
    } else if (!PERM_CAN_VIEW) {
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
    syncPricingPolicyLensChrome();
    costSheetCtrl.bindEvents();
    await pricingPolicyCtrl.loadOptions();
    pricingPolicyCtrl.bindEvents();
    pricingPolicyCtrl.syncPricingPolicyWriteUi?.();
    syncPricingPolicyPermissionUi();
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
pricingPolicyWorkspaceSelect?.addEventListener("change", () => {
  void switchPricingPolicyWorkspace(pricingPolicyWorkspaceSelect.value);
});
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
