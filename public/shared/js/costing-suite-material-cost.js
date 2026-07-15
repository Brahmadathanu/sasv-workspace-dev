export const MATERIAL_COST_LENS_IDS = ["manual-rate-manager", "rm-cost-trace"];

export function isMaterialCostLens(lensId) {
  return MATERIAL_COST_LENS_IDS.includes(lensId);
}

const MANUAL_RATE_HEADERS_BY_TAB = {
  "action-queue": [
    "",
    "Action",
    "Issue Code",
    "Stock Item",
    "Selected Rate",
    "Rate Source",
    "Latest Purchase Rate",
    "Affected Products",
    "Affected SKUs",
    "Recommended Action",
  ],
  register: [
    "",
    "Stock Item",
    "Manual Rate",
    "Effective From",
    "Effective To",
    "Status",
    "Register Status",
    "Latest Purchase Rate",
    "Latest Purchase Date",
    "Recommended Action",
    "Action",
  ],
  history: [
    "",
    "Manual Rate ID",
    "Stock Item",
    "Rate",
    "Effective From",
    "Effective To",
    "Status",
    "Reason / Approval Reference",
    "Created At",
    "Last Updated At",
  ],
  "rm-cost-trace": [
    "Stock Item Code",
    "Stock Item Name",
    "Product",
    "SKU",
    "SKU Quantity",
    "UOM",
    "Selected Rate",
    "Rate Source",
    "Rate Date",
    "RM Contribution",
    "Contribution %",
    "Review State",
    "Warning",
    "Semi-process Source",
  ],
};

const MANUAL_RATE_ALIGNMENTS_BY_TAB = {
  "action-queue": [
    "c-center",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
  ],
  register: [
    "c-center",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-center",
  ],
  history: [
    "c-center",
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ],
  "rm-cost-trace": [
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
  ],
};

const MANUAL_RATE_MANAGER_TAB_IDS = new Set([
  "action-queue",
  "register",
  "history",
]);

const RM_TRACE_EXPORT_BATCH_SIZE = 1000;

const RM_TRACE_EXPORT_COLUMNS = [
  "period_start",
  "product_name",
  "sku_column_label",
  "stock_item_code",
  "stock_item_name",
  "sku_quantity",
  "quantity_uom",
  "selected_rate",
  "rate_source",
  "rate_date",
  "rm_line_cost",
  "contribution_share_percent",
  "review_state",
  "warning_code",
  "warning_text",
  "semi_process_source",
  "expansion_note",
  "snapshot_refreshed_at",
];

const RM_TRACE_RESTRICTED_MESSAGE = `Restricted RM contribution detail

Your Material Cost Manager access does not include confidential raw-material contribution traceability.`;

const HARD_BLOCKER_ISSUE_CODES = [
  "MISSING_REQUIRED_RM_RATE",
  "MISSING_REQUIRED_PM_RATE",
];

const MATERIAL_RATE_UI_ROUTES = new Set([
  "MATERIAL_RATE_REVIEW",
  "MATERIAL_RATE_MANAGER_RM",
  "MATERIAL_RATE_MANAGER_PM",
]);

export const MATERIAL_ISSUE_GUIDANCE = {
  MISSING_REQUIRED_RM_RATE: {
    label: "Missing required RM rate",
    tier: "hard_blocker",
    guidanceText:
      "Required raw material rate is missing. Add a valid rate; this issue cannot be accepted as review.",
    recommendedPrimaryAction: "Add Manual Rate",
    canAcceptByPolicy: false,
  },
  MISSING_REQUIRED_PM_RATE: {
    label: "Missing required PM rate",
    tier: "hard_blocker",
    guidanceText:
      "Required packing material rate is missing. Add a valid rate; this issue cannot be accepted as review.",
    recommendedPrimaryAction: "Add Manual Rate",
    canAcceptByPolicy: false,
  },
  STALE_RM_PURCHASE_RATE: {
    label: "Stale RM purchase rate",
    tier: "review_required",
    guidanceText:
      "Latest raw material purchase rate is older than the allowed freshness window. Review evidence before accepting or set a manual rate.",
    recommendedPrimaryAction: "Review Evidence",
    canAcceptByPolicy: true,
  },
  STALE_PM_PURCHASE_RATE: {
    label: "Stale PM purchase rate",
    tier: "review_required",
    guidanceText:
      "Latest packing material purchase rate is older than the allowed freshness window. Review evidence before accepting or set a manual rate.",
    recommendedPrimaryAction: "Review Evidence",
    canAcceptByPolicy: true,
  },
  RM_STOCK_VALUATION_FALLBACK: {
    label: "RM stock valuation fallback",
    tier: "review_required",
    guidanceText:
      "Stock valuation fallback is being used for raw material costing. Review impact before accepting or set a manual rate.",
    recommendedPrimaryAction: "Review Evidence",
    canAcceptByPolicy: true,
  },
  PM_STOCK_VALUATION_FALLBACK: {
    label: "PM stock valuation fallback",
    tier: "review_required",
    guidanceText:
      "Stock valuation fallback is being used for packing material costing. Review impact before accepting or set a manual rate.",
    recommendedPrimaryAction: "Review Evidence",
    canAcceptByPolicy: true,
  },
  RM_MANUAL_RATE_USED: {
    label: "RM manual rate used",
    tier: "review_required",
    guidanceText:
      "Active manual rate is being used for raw material costing. Review whether it is still valid against current evidence.",
    recommendedPrimaryAction: "Review Manual Rate",
    canAcceptByPolicy: true,
  },
  PM_MANUAL_RATE_USED: {
    label: "PM manual rate used",
    tier: "review_required",
    guidanceText:
      "Active manual rate is being used for packing material costing. Review whether it is still valid against current evidence.",
    recommendedPrimaryAction: "Review Manual Rate",
    canAcceptByPolicy: true,
  },
  OPTIONAL_PM_RATE_MISSING: {
    label: "Optional PM rate missing",
    tier: "optional_review",
    guidanceText:
      "Optional packing material rate is missing. Review whether this is acceptable or set a manual rate if required.",
    recommendedPrimaryAction: "Review Optional Material",
    canAcceptByPolicy: true,
  },
};

const REVIEW_PRIORITY_ISSUE_CODES = Object.entries(MATERIAL_ISSUE_GUIDANCE)
  .filter(([, meta]) => meta.tier === "review_required" || meta.tier === "optional_review")
  .map(([code]) => code);

function normalizeIssueToken(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function splitIssueCodeField(value) {
  if (Array.isArray(value)) {
    const tokens = value
      .map((entry) => normalizeIssueToken(entry))
      .filter(Boolean);
    return [...new Set(tokens)];
  }

  const raw = String(value ?? "").trim();
  if (!raw) return [];

  if (!/[|,;]/.test(raw)) {
    const token = normalizeIssueToken(raw);
    return token ? [token] : [];
  }

  const tokens = raw
    .split(/[,|;]+/)
    .map((part) => normalizeIssueToken(part))
    .filter(Boolean);
  return [...new Set(tokens)];
}

export function normalizeMaterialIssueCodes(row) {
  if (!row || typeof row !== "object") return [];

  const issueCodes = [
    ...splitIssueCodeField(row.issue_codes),
    ...splitIssueCodeField(row.material_issue_code),
  ];

  const codes =
    issueCodes.length > 0
      ? issueCodes
      : splitIssueCodeField(row.warning_codes);

  return [...new Set(codes)];
}

export function getPrimaryMaterialIssueCode(row) {
  const codes = normalizeMaterialIssueCodes(row);
  if (!codes.length) return null;

  for (const code of HARD_BLOCKER_ISSUE_CODES) {
    if (codes.includes(code)) return code;
  }

  for (const code of REVIEW_PRIORITY_ISSUE_CODES) {
    if (codes.includes(code)) return code;
  }

  return codes[0] || null;
}

function resolveMaterialIssueSeverity(row) {
  return normalizeIssueToken(
    row?.action_severity || row?.material_line_status || "",
  );
}

export function getMaterialIssueGuidance(row) {
  const primaryCode = getPrimaryMaterialIssueCode(row);
  const known = primaryCode ? MATERIAL_ISSUE_GUIDANCE[primaryCode] : null;
  if (known) {
    return {
      code: primaryCode,
      ...known,
    };
  }

  const severity = resolveMaterialIssueSeverity(row);
  const fallbackLabel = primaryCode || "Material cost issue";
  const summary = String(
    row?.action_note_summary || row?.recommended_action || "",
  ).trim();

  if (severity === "BLOCKER") {
    return {
      code: primaryCode,
      label: fallbackLabel,
      tier: "blocker",
      guidanceText:
        summary ||
        "Blocking material costing issue. Correct rate or source data before refresh.",
      recommendedPrimaryAction: "Add / Update Rate",
      canAcceptByPolicy: false,
    };
  }

  if (severity === "REVIEW_REQUIRED") {
    return {
      code: primaryCode,
      label: fallbackLabel,
      tier: "review_required",
      guidanceText:
        summary ||
        "Material costing issue requires review before the period can be treated as ready.",
      recommendedPrimaryAction: "Review Evidence",
      canAcceptByPolicy: true,
    };
  }

  return {
    code: primaryCode,
    label: fallbackLabel,
    tier: "info",
    guidanceText:
      summary || "Review this material costing issue and take the recommended action.",
    recommendedPrimaryAction: "Review",
    canAcceptByPolicy: false,
  };
}

export function createMaterialCostController(deps) {
  const {
    dom,
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
    getSkuDiagnosis,
    getCurrentLens,
    getActivePeriodStart,
    getSelectedRow,
    setSelectedRow,
    getAllRows,
    reloadRows,
    setDrawerTab,
    refreshOpenDrawerIfNeeded,
    runStagedCostingRefreshAndReload,
    canEditMaterialCostActions,
    markCostingRefreshDirty,
    isCostingRefreshDirty,
    getTracePermissions,
    syncTraceExportButtonState,
  } = deps;

  const {
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
  } = dom;

  let manualRateManagerTab = "action-queue";
  let materialReviewAcceptanceRows = [];
  let materialReviewAcceptanceByKey = new Map();
  let materialActionDrilldownRows = [];
  let manualRateEditRow = null;
  let manualRateReturnFocus = null;
  let manualRateCloseRow = null;
  let manualRateCloseReturnFocus = null;
  let materialReviewAcceptRow = null;
  let materialReviewAcceptReturnFocus = null;
  let materialReviewCloseRow = null;
  let materialReviewCloseReturnFocus = null;
  let materialReviewAcceptBusy = false;
  let materialReviewCloseBusy = false;
  let eventsBound = false;
  let workbenchMatchRows = [];
  let workbenchMatchPeriodStart = null;
  let workbenchMatchLoaded = false;
  let workbenchMatchLoadPromise = null;

  const CURRENT_TRACE_COMPONENT = "RM";
  let TRACE_FILTERS = {
    product_id: null,
    sku_id: null,
    stock_item_id: null,
    search_text: "",
    bom_source: null,
    review_state: null,
    warning_status: null,
    has_semi_process: null,
  };
  let TRACE_ROWS = [];
  let TRACE_TOTAL_COUNT = 0;
  let TRACE_PAGE = 1;
  let TRACE_PAGE_SIZE = 25;
  let TRACE_LOAD_STATE = "idle";
  let TRACE_ERROR_MESSAGE = "";
  let TRACE_FILTER_OPTIONS = {
    period_start: null,
    products: [],
    skus: [],
    bom_sources: [],
    review_states: [],
    warning_statuses: [],
    trace_component: "RM",
    snapshot_refreshed_at: null,
  };
  let TRACE_SNAPSHOT_REFRESHED_AT = null;
  let rmTraceSearchTimer = null;
  let rmTraceEventsBound = false;

  const MATERIAL_COST_READ_ONLY_TOAST =
    "Read-only access. You do not have permission to change material costing actions.";

  function canWriteMaterialCostActions() {
    if (typeof canEditMaterialCostActions === "function") {
      return canEditMaterialCostActions();
    }
    return true;
  }

  function guardMaterialCostWriteAction() {
    if (canWriteMaterialCostActions()) return true;
    showToast(MATERIAL_COST_READ_ONLY_TOAST, "error");
    return false;
  }

  function manualRateEvidenceText(value, formatFn) {
    if (value === null || value === undefined || value === "") return "—";
    if (value === true) return "Yes";
    if (value === false) return "No";
    return formatFn ? formatFn(value) : String(value);
  }

  function populateManualRateEvidenceStrip(evidence) {
    const set = (el, displayValue) => {
      if (el) el.textContent = displayValue;
    };

    set(
      manualRateEvidenceSelectedRate,
      manualRateEvidenceText(evidence?.selectedRate, formatMoney),
    );
    set(
      manualRateEvidenceSelectedSource,
      manualRateEvidenceText(evidence?.selectedRateSource),
    );
    set(
      manualRateEvidenceSelectedDate,
      manualRateEvidenceText(evidence?.selectedRateDate, formatDate),
    );
    set(
      manualRateEvidenceLatestPurchaseRate,
      manualRateEvidenceText(evidence?.latestPurchaseRate, formatMoney),
    );
    set(
      manualRateEvidenceLatestPurchaseDate,
      manualRateEvidenceText(evidence?.latestPurchaseDate, formatDate),
    );
    set(
      manualRateEvidenceActiveManualRate,
      manualRateEvidenceText(evidence?.activeManualRate, formatMoney),
    );
    set(
      manualRateEvidenceManualRateStatus,
      manualRateEvidenceText(evidence?.activeManualRateStatus),
    );
    set(
      manualRateEvidenceNewerPurchase,
      manualRateEvidenceText(evidence?.newerPurchaseRateAvailable),
    );
    set(
      manualRateEvidenceOverrideFlag,
      manualRateEvidenceText(evidence?.manualRateOverridesPurchaseRate),
    );
    set(
      manualRateEvidenceAffectedSkuCount,
      manualRateEvidenceText(evidence?.affectedSkuCount, formatNumber),
    );
  }

  function splitCodeTokens(value) {
    return String(value || "")
      .split(/[|,]/)
      .map((part) => normalizeStatus(part))
      .filter(Boolean);
  }

  function materialReviewAcceptanceKey(row, periodStart = getActivePeriodStart()) {
    return [
      String(row?.period_start || periodStart || ""),
      String(row?.stock_item_id ?? ""),
      normalizeStatus(row?.material_area),
      normalizeStatus(row?.recommended_ui_route),
      normalizeStatus(row?.issue_codes),
      normalizeStatus(row?.warning_codes),
      normalizeStatus(row?.action_required_summary),
    ].join("|");
  }

  function isActiveMaterialReviewAcceptance(row) {
    if (!row) return false;
    if (normalizeStatus(row.acceptance_register_status) === "ACTIVE_MATCHED") {
      return true;
    }
    return normalizeStatus(row.acceptance_status) === "ACTIVE";
  }

  function rebuildMaterialReviewAcceptanceLookup() {
    materialReviewAcceptanceByKey = new Map();
    materialReviewAcceptanceRows.forEach((row) => {
      if (!isActiveMaterialReviewAcceptance(row)) return;
      materialReviewAcceptanceByKey.set(materialReviewAcceptanceKey(row), row);
    });
  }

  function findActiveMaterialReviewAcceptance(queueRow) {
    if (!queueRow) return null;
    return (
      materialReviewAcceptanceByKey.get(materialReviewAcceptanceKey(queueRow)) ||
      null
    );
  }

  function workbenchIssueCodesOverlap(mcmRow, workbenchRow) {
    const mcmCodes = new Set(normalizeMaterialIssueCodes(mcmRow));
    return normalizeMaterialIssueCodes(workbenchRow).some((code) =>
      mcmCodes.has(code),
    );
  }

  async function loadWorkbenchMatchIndex(periodStart = getActivePeriodStart()) {
    if (!periodStart) {
      workbenchMatchRows = [];
      workbenchMatchPeriodStart = null;
      workbenchMatchLoaded = false;
      workbenchMatchLoadPromise = null;
      return [];
    }

    if (
      workbenchMatchPeriodStart === periodStart &&
      workbenchMatchLoaded &&
      !workbenchMatchLoadPromise
    ) {
      return workbenchMatchRows;
    }

    if (
      workbenchMatchPeriodStart === periodStart &&
      workbenchMatchLoadPromise
    ) {
      return workbenchMatchLoadPromise;
    }

    workbenchMatchPeriodStart = periodStart;
    workbenchMatchLoaded = false;
    workbenchMatchLoadPromise = (async () => {
      try {
        const [queueRows] = await Promise.all([
          fetchAllRows(
            () =>
              costingFrom("v_costing_pricing_material_action_queue_snapshot")
                .select("*")
                .eq("period_start", periodStart)
                .order("action_severity", { ascending: true })
                .order("affected_sku_count", { ascending: false })
                .order("affected_product_count", { ascending: false })
                .order("affected_line_count", { ascending: false })
                .order("stock_item_name", { ascending: true }),
            1000,
          ),
          loadMaterialReviewAcceptanceRegister(periodStart),
        ]);
        workbenchMatchRows = queueRows || [];
        workbenchMatchLoaded = true;
        return workbenchMatchRows;
      } catch (err) {
        workbenchMatchRows = [];
        workbenchMatchPeriodStart = null;
        workbenchMatchLoaded = false;
        throw err;
      } finally {
        workbenchMatchLoadPromise = null;
      }
    })();

    return workbenchMatchLoadPromise;
  }

  function findWorkbenchRowForMaterialIssue(mcmRow) {
    if (!mcmRow?.stock_item_id || !workbenchMatchRows.length) return null;

    const periodStart = mcmRow.period_start || getActivePeriodStart();
    const mcmMaterialArea = normalizeStatus(mcmRow.material_area);

    const candidates = workbenchMatchRows.filter((workbenchRow) => {
      if (String(workbenchRow.period_start) !== String(periodStart)) return false;
      if (String(workbenchRow.stock_item_id) !== String(mcmRow.stock_item_id)) {
        return false;
      }

      const workbenchMaterialArea = normalizeStatus(workbenchRow.material_area);
      if (
        mcmMaterialArea &&
        workbenchMaterialArea &&
        mcmMaterialArea !== workbenchMaterialArea
      ) {
        return false;
      }

      return workbenchIssueCodesOverlap(mcmRow, workbenchRow);
    });

    if (!candidates.length) return null;

    candidates.sort((left, right) => {
      const leftReview =
        normalizeStatus(left.action_severity) === "REVIEW_REQUIRED" &&
        normalizeStatus(left.recommended_ui_route) === "MATERIAL_RATE_REVIEW";
      const rightReview =
        normalizeStatus(right.action_severity) === "REVIEW_REQUIRED" &&
        normalizeStatus(right.recommended_ui_route) === "MATERIAL_RATE_REVIEW";
      if (leftReview !== rightReview) return leftReview ? -1 : 1;

      const leftAreaMatch =
        normalizeStatus(left.material_area) === mcmMaterialArea;
      const rightAreaMatch =
        normalizeStatus(right.material_area) === mcmMaterialArea;
      if (leftAreaMatch !== rightAreaMatch) return leftAreaMatch ? -1 : 1;

      const leftSkuCount = Number(left.affected_sku_count) || 0;
      const rightSkuCount = Number(right.affected_sku_count) || 0;
      if (leftSkuCount !== rightSkuCount) return rightSkuCount - leftSkuCount;

      return String(left.stock_item_name || left.stock_item_id || "").localeCompare(
        String(right.stock_item_name || right.stock_item_id || ""),
      );
    });

    return candidates[0];
  }

  function isHardBlockedMaterialIssue(row) {
    return normalizeMaterialIssueCodes(row).some((code) =>
      HARD_BLOCKER_ISSUE_CODES.includes(code),
    );
  }

  function isMaterialRateRelatedIssue(row, codes = normalizeMaterialIssueCodes(row)) {
    if (!row) return false;
    const route = normalizeStatus(row.recommended_ui_route);
    if (MATERIAL_RATE_UI_ROUTES.has(route)) return true;
    return codes.some((code) => Boolean(MATERIAL_ISSUE_GUIDANCE[code]));
  }

  function classifyMaterialIssue(row, options = {}) {
    const codes = normalizeMaterialIssueCodes(row);
    const primaryCode = getPrimaryMaterialIssueCode(row);
    const guidance = getMaterialIssueGuidance(row);
    const workbenchRow = options.workbenchRow || null;
    const severity = resolveMaterialIssueSeverity(
      workbenchRow || row || {},
    );
    const materialArea = String(
      row?.material_area || workbenchRow?.material_area || "",
    ).trim();
    const isHardBlocker = codes.some((code) =>
      HARD_BLOCKER_ISSUE_CODES.includes(code),
    );
    const isReviewRequired =
      guidance.tier === "review_required" ||
      guidance.tier === "optional_review" ||
      severity === "REVIEW_REQUIRED";
    const activeAcceptance =
      options.activeAcceptance !== undefined
        ? options.activeAcceptance
        : workbenchRow
          ? findActiveMaterialReviewAcceptance(workbenchRow)
          : row
            ? findActiveMaterialReviewAcceptance(row)
            : null;
    const hasActiveAcceptance = Boolean(activeAcceptance);
    const stockItemId = row?.stock_item_id ?? workbenchRow?.stock_item_id;
    const canSetManualRate = Boolean(
      stockItemId && isMaterialRateRelatedIssue(row || workbenchRow || {}, codes),
    );

    let canAcceptReview = false;
    let blockAcceptReason = null;

    if (options.canEdit === false) {
      blockAcceptReason = "Read-only access.";
    } else if (isHardBlocker) {
      blockAcceptReason =
        "Required rate is missing. Add a manual rate first; this issue cannot be accepted as review.";
    } else if (!guidance.canAcceptByPolicy) {
      blockAcceptReason = "This issue type cannot be accepted as review.";
    } else if (severity !== "REVIEW_REQUIRED") {
      blockAcceptReason =
        "Accept Review is only available for review-required issues.";
    } else if (!workbenchRow) {
      blockAcceptReason =
        "No matching Control Workbench row was found for review acceptance.";
    } else if (hasActiveAcceptance) {
      blockAcceptReason =
        "An active acceptance already exists for this issue.";
    } else if (!isMaterialReviewAcceptEligible(workbenchRow)) {
      blockAcceptReason = "This queue row is not eligible for Accept Review.";
    } else {
      canAcceptReview = true;
    }

    const canCloseAcceptance =
      hasActiveAcceptance && options.canEdit !== false;

    return {
      codes,
      primaryCode,
      materialArea,
      severity,
      tier: guidance.tier,
      guidance,
      guidanceText: guidance.guidanceText,
      recommendedPrimaryAction: guidance.recommendedPrimaryAction,
      isHardBlocker,
      isReviewRequired,
      hasActiveAcceptance,
      canSetManualRate,
      canAcceptReview,
      canCloseAcceptance,
      blockAcceptReason,
    };
  }

  function evidenceValueOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    return value;
  }

  function buildMaterialIssueEvidenceFromRow(row) {
    if (!row || typeof row !== "object") {
      return {
        selectedRate: null,
        selectedRateSource: null,
        selectedRateDate: null,
        latestPurchaseRate: null,
        latestPurchaseDate: null,
        activeManualRate: null,
        activeManualRateEffectiveFrom: null,
        activeManualRateEffectiveTo: null,
        activeManualRateStatus: null,
        manualRateOverridesPurchaseRate: null,
        newerPurchaseRateAvailable: null,
        affectedLineCount: null,
        affectedProductCount: null,
        affectedSkuCount: null,
        approvalBlockingSkuCount: null,
        reviewSkuCount: null,
        snapshotRefreshedAt: null,
      };
    }

    return {
      selectedRate: evidenceValueOrNull(
        row.selected_rate ?? row.latest_system_selected_rate,
      ),
      selectedRateSource: evidenceValueOrNull(
        row.rate_source ?? row.latest_system_rate_source,
      ),
      selectedRateDate: evidenceValueOrNull(
        row.rate_date ?? row.latest_system_rate_date,
      ),
      latestPurchaseRate: evidenceValueOrNull(row.latest_purchase_rate),
      latestPurchaseDate: evidenceValueOrNull(row.latest_purchase_date),
      activeManualRate: evidenceValueOrNull(
        row.manual_rate_value ?? row.rate_value,
      ),
      activeManualRateEffectiveFrom: evidenceValueOrNull(
        row.manual_rate_effective_from ?? row.effective_from,
      ),
      activeManualRateEffectiveTo: evidenceValueOrNull(
        row.manual_rate_effective_to ?? row.effective_to,
      ),
      activeManualRateStatus: evidenceValueOrNull(
        row.manual_rate_status ?? row.status,
      ),
      manualRateOverridesPurchaseRate: evidenceValueOrNull(
        row.manual_rate_overrides_purchase_rate,
      ),
      newerPurchaseRateAvailable: evidenceValueOrNull(
        row.newer_purchase_rate_available,
      ),
      affectedLineCount: evidenceValueOrNull(row.affected_line_count),
      affectedProductCount: evidenceValueOrNull(row.affected_product_count),
      affectedSkuCount: evidenceValueOrNull(row.affected_sku_count),
      approvalBlockingSkuCount: evidenceValueOrNull(
        row.approval_blocking_sku_count,
      ),
      reviewSkuCount: evidenceValueOrNull(row.review_sku_count),
      snapshotRefreshedAt: evidenceValueOrNull(row.snapshot_refreshed_at),
    };
  }

  function mergeMaterialIssueEvidence(base, overlay) {
    const merged = { ...base };
    Object.entries(overlay || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        merged[key] = value;
      }
    });
    return merged;
  }

  function evidenceNeedsReviewFetch(evidence) {
    return (
      evidence.selectedRate == null &&
      evidence.latestPurchaseRate == null &&
      evidence.activeManualRate == null
    );
  }

  function evidenceFromManualRateReview(review) {
    if (!review) return {};
    return {
      latestPurchaseRate: evidenceValueOrNull(review.latest_purchase_rate),
      latestPurchaseDate: evidenceValueOrNull(review.latest_purchase_date),
      activeManualRate: evidenceValueOrNull(review.manual_rate_value),
      activeManualRateEffectiveFrom: evidenceValueOrNull(
        review.manual_rate_effective_from,
      ),
      activeManualRateEffectiveTo: evidenceValueOrNull(
        review.manual_rate_effective_to,
      ),
      activeManualRateStatus: evidenceValueOrNull(review.manual_rate_status),
      manualRateOverridesPurchaseRate: evidenceValueOrNull(
        review.manual_rate_overrides_purchase_rate,
      ),
      newerPurchaseRateAvailable: evidenceValueOrNull(
        review.newer_purchase_rate_available,
      ),
    };
  }

  async function enrichMaterialIssueEvidence(row, options = {}) {
    let evidence = buildMaterialIssueEvidenceFromRow(row);

    if (
      options.allowFetch === true &&
      row?.stock_item_id &&
      evidenceNeedsReviewFetch(evidence)
    ) {
      const review = await fetchManualRateReview(row);
      evidence = mergeMaterialIssueEvidence(
        evidence,
        evidenceFromManualRateReview(review),
      );
    }

    return evidence;
  }

  function isMaterialReviewAcceptEligible(row) {
    if (!row) return false;
    if (normalizeStatus(row.action_severity) === "BLOCKER") return false;
    if (normalizeStatus(row.action_severity) !== "REVIEW_REQUIRED") return false;

    const route = normalizeStatus(row.recommended_ui_route);
    if (route !== "MATERIAL_RATE_REVIEW") return false;
    if (
      route === "MATERIAL_RATE_MANAGER_RM" ||
      route === "MATERIAL_RATE_MANAGER_PM"
    ) {
      return false;
    }
    if (isHardBlockedMaterialIssue(row)) return false;
    if (findActiveMaterialReviewAcceptance(row)) return false;
    return true;
  }

  async function loadMaterialReviewAcceptanceRegister(
    periodStart = getActivePeriodStart(),
  ) {
    if (!periodStart) {
      materialReviewAcceptanceRows = [];
      rebuildMaterialReviewAcceptanceLookup();
      return;
    }

    const { data, error } = await costingFrom(
      "v_costing_material_review_acceptance_register",
    )
      .select("*")
      .eq("period_start", periodStart);

    if (error) throw error;

    materialReviewAcceptanceRows = data || [];
    rebuildMaterialReviewAcceptanceLookup();
  }

  function renderMaterialReviewAcceptancePanel(row) {
    const acceptance = findActiveMaterialReviewAcceptance(row);
    if (acceptance) {
      return `
      <div class="cp-card" style="margin-bottom:12px">
        <div class="cp-card-label">Accepted for this costing period</div>
        <div class="cp-card-value">${statusChip("Active Accepted")}</div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          ${text(acceptance.accepted_by_email || "--")} · ${formatDateTime(acceptance.accepted_at)}
        </div>
        ${
          acceptance.acceptance_reason
            ? `<div class="cp-muted-text" style="margin-top:6px">${text(acceptance.acceptance_reason)}</div>`
            : ""
        }
        ${
          acceptance.acceptance_note
            ? `<div class="cp-muted-text" style="margin-top:4px">${text(acceptance.acceptance_note)}</div>`
            : ""
        }
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <button
            type="button"
            class="icon-btn cp-danger-text-btn"
            id="closeMaterialReviewAcceptanceBtn"
            title="Close Acceptance"
            aria-label="Close Acceptance"
          >
            Close Acceptance
          </button>
        </div>
      </div>
    `;
    }

    if (isMaterialReviewAcceptEligible(row)) {
      return `
      <div class="cp-muted-text" style="margin-bottom:12px;line-height:1.45">
        This accepts the review issue for this costing period only. It does not
        change the material rate and does not approve the final cost sheet.
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="acceptMaterialReviewBtn"
          title="Accept Review"
          aria-label="Accept Review"
        >
          Accept Review
        </button>
      </div>
    `;
    }

    return "";
  }

  function wireMaterialReviewAcceptanceDrawerActions() {
    document
      .getElementById("acceptMaterialReviewBtn")
      ?.addEventListener("click", () => {
        const selectedRow = getSelectedRow();
        if (selectedRow) openMaterialReviewAcceptModal(selectedRow);
      });
    document
      .getElementById("closeMaterialReviewAcceptanceBtn")
      ?.addEventListener("click", () => {
        const selectedRow = getSelectedRow();
        const acceptance = findActiveMaterialReviewAcceptance(selectedRow);
        if (acceptance) openMaterialReviewCloseAcceptanceModal(acceptance);
      });
  }

  async function reloadMaterialReviewWorkbenchData() {
    try {
      await reloadRows();
    } catch (err) {
      console.warn(
        "[costing-suite] Failed to reload Control Workbench after acceptance action",
        err,
      );
      try {
        await loadMaterialReviewAcceptanceRegister();
      } catch (registerErr) {
        console.warn(
          "[costing-suite] Failed to reload acceptance register",
          registerErr,
        );
      }
      showToast(
        "Acceptance action saved, but workbench reload failed.",
        "info",
        6200,
      );
    }

    await refreshOpenDrawerIfNeeded();
  }

  async function refreshSelectedMaterialActionDrilldown(row) {
    const missing = [
      ["stock_item_id", row?.stock_item_id],
      ["material_area", row?.material_area],
      ["action_severity", row?.action_severity],
      ["recommended_ui_route", row?.recommended_ui_route],
    ]
      .filter(
        ([, value]) => value === null || value === undefined || value === "",
      )
      .map(([key]) => key);

    if (missing.length) {
      throw new Error(
        `Material action drilldown context missing: ${missing.join(", ")}`,
      );
    }

    const { error: refreshError } = await costingRpc(
      "rpc_refresh_material_action_drilldown_snapshot",
      {
        p_period_start: getActivePeriodStart(),
        p_stock_item_id: row.stock_item_id,
        p_material_area: row.material_area,
        p_action_severity: row.action_severity,
        p_recommended_ui_route: row.recommended_ui_route,
      },
    );

    if (refreshError) throw refreshError;

    materialActionDrilldownRows = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_material_action_drilldown_snapshot")
          .select("*")
          .eq("period_start", getActivePeriodStart())
          .eq("stock_item_id", row.stock_item_id)
          .eq("material_area", row.material_area)
          .eq("action_severity", row.action_severity)
          .eq("recommended_ui_route", row.recommended_ui_route)
          .order("product_name", { ascending: true })
          .order("sku_id", { ascending: true })
          .order("bom_source", { ascending: true })
          .order("line_no", { ascending: true, nullsFirst: false }),
      1000,
    );

    return materialActionDrilldownRows;
  }

  async function fetchLegacyActionDrilldown(row) {
    const readSnapshot = async () => {
      const { data, error } = await costingFrom(
        "v_costing_pricing_review_action_item_drilldown_snapshot",
      )
        .select("*")
        .eq("period_start", getActivePeriodStart())
        .eq("stock_item_id", row.stock_item_id)
        .eq("material_issue_code", row.material_issue_code)
        .eq("bom_source", row.bom_source)
        .limit(1000);

      if (error) throw error;
      return data || [];
    };

    const rows = await readSnapshot();
    if (rows.length) return rows;

    const { error: refreshError } = await costingRpc(
      "rpc_refresh_costing_review_action_drilldown_snapshot",
      {
        p_period_start: getActivePeriodStart(),
        p_stock_item_id: row.stock_item_id,
        p_material_issue_code: row.material_issue_code,
        p_bom_source: row.bom_source,
      },
    );

    if (refreshError) throw refreshError;

    return readSnapshot();
  }

  async function fetchActionDrilldown(row) {
    if (getCurrentLens() === "costing-review-workbench") {
      return refreshSelectedMaterialActionDrilldown(row);
    }

    return fetchLegacyActionDrilldown(row);
  }

  async function fetchManualRateHistory(row) {
    if (!row?.stock_item_id) return [];

    const { data, error } = await costingFrom(
      "v_costing_material_manual_rate_history",
    )
      .select("*")
      .eq("stock_item_id", row.stock_item_id)
      .order("effective_from", { ascending: false })
      .order("manual_rate_id", { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  }

  async function fetchManualRateManagerRegisterRows() {
    return fetchAllRows(
      () =>
        costingFrom("v_costing_material_manual_rate_register")
          .select("*")
          .order("register_status", { ascending: true })
          .order("stock_item_name", { ascending: true })
          .order("manual_rate_id", { ascending: false }),
      1000,
    );
  }

  async function fetchManualRateManagerHistoryRows() {
    return fetchAllRows(
      () =>
        costingFrom("v_costing_material_manual_rate_history")
          .select("*")
          .order("stock_item_name", { ascending: true })
          .order("effective_from", { ascending: false })
          .order("manual_rate_id", { ascending: false }),
      1000,
    );
  }

  async function fetchManualRateReview(row) {
    if (!row?.stock_item_id) return null;

    const { data, error } = await costingFrom(
      "v_costing_material_manual_rate_review",
    )
      .select("*")
      .eq("stock_item_id", row.stock_item_id)
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  }

  function buildMaterialEvidenceSection(rowOrSkuId) {
    const skuId =
      typeof rowOrSkuId === "object" ? rowOrSkuId?.sku_id : rowOrSkuId;
    const d = getSkuDiagnosis(skuId);
    if (!d) return "";
    return kvSection("Material Evidence", [
      ["RM Blocking Lines", formatNumber(d.rm_blocking_line_count)],
      ["PM Blocking Lines", formatNumber(d.pm_blocking_line_count)],
      ["RM Review Rate Lines", formatNumber(d.rm_review_rate_line_count)],
      ["PM Review Rate Lines", formatNumber(d.pm_review_rate_line_count)],
      [
        "RM Stale Purchase Rate Lines",
        formatNumber(d.rm_stale_purchase_rate_line_count),
      ],
      [
        "PM Stale Purchase Rate Lines",
        formatNumber(d.pm_stale_purchase_rate_line_count),
      ],
      [
        "RM Stock Valuation Fallback Lines",
        formatNumber(d.rm_stock_valuation_fallback_line_count),
      ],
      [
        "PM Stock Valuation Fallback Lines",
        formatNumber(d.pm_stock_valuation_fallback_line_count),
      ],
      ["RM Manual Rate Lines", formatNumber(d.rm_manual_rate_line_count)],
      ["PM Manual Rate Lines", formatNumber(d.pm_manual_rate_line_count)],
    ]);
  }

  function renderMaterialEvidencePanel(rowOrSkuId) {
    const section = buildMaterialEvidenceSection(rowOrSkuId);
    if (!section) return "";
    return detailPanel([section]);
  }

  function readManualRateFormValues() {
    return {
      rateValue: numberOrNullFromInput(manualRateValue),
      effectiveFrom: manualRateEffectiveFrom?.value || activePeriodIso(),
      reason: manualRateReason?.value?.trim() || "",
    };
  }

  function setManualRateSaveState() {
    if (!manualRateEditSaveBtn) return;

    const values = readManualRateFormValues();
    const validRate = Number(values.rateValue || 0) > 0;
    const validReason = values.reason.length >= 5;

    manualRateEditSaveBtn.disabled = !(validRate && validReason);
  }

  async function openManualRateEditModal(row) {
    if (!row || !manualRateEditModal) return;
    if (!guardMaterialCostWriteAction()) return;

    manualRateEditRow = row;
    manualRateReturnFocus = document.activeElement;

    if (manualRateStockItemLabel) {
      manualRateStockItemLabel.textContent =
        row.stock_item_name || row.stock_item_id || "--";
    }

    const currentRate =
      row.selected_rate ?? row.manual_rate_value ?? row.rate_value ?? null;

    const currentSource =
      row.rate_source ||
      (row.manual_rate_value !== undefined || row.rate_value !== undefined
        ? "MANUAL_RATE"
        : "--");

    const currentDate =
      row.rate_date ||
      row.manual_rate_effective_from ||
      row.effective_from ||
      null;

    if (manualRateCurrentRate) {
      manualRateCurrentRate.textContent = formatMoney(currentRate);
    }

    if (manualRateCurrentSource) {
      manualRateCurrentSource.textContent = currentSource;
    }

    if (manualRateCurrentDate) {
      manualRateCurrentDate.textContent = formatDate(currentDate);
    }

    try {
      populateManualRateEvidenceStrip(
        await enrichMaterialIssueEvidence(row, { allowFetch: false }),
      );
    } catch (err) {
      console.warn("Failed to populate manual rate evidence from row", err);
      populateManualRateEvidenceStrip({});
    }

    if (manualRateValue) {
      manualRateValue.value =
        currentRate !== null && currentRate !== undefined
          ? Number(currentRate)
          : "";
    }

    if (manualRateEffectiveFrom) {
      manualRateEffectiveFrom.value = activePeriodIso();
    }

    if (manualRateReason) {
      manualRateReason.value = "";
    }

    manualRateEditModal.classList.remove("hidden");
    manualRateEditModal.setAttribute("aria-hidden", "false");

    setManualRateSaveState();

    setTimeout(() => manualRateValue?.focus(), 0);

    enrichMaterialIssueEvidence(row, { allowFetch: true })
      .then((evidence) => populateManualRateEvidenceStrip(evidence))
      .catch((err) => {
        console.warn("Failed to fetch enriched manual rate evidence", err);
      });
  }

  function closeManualRateEditModal() {
    if (!manualRateEditModal) return;

    const active = document.activeElement;
    if (active && manualRateEditModal.contains(active)) {
      active.blur();
    }

    manualRateEditModal.classList.add("hidden");
    manualRateEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      manualRateReturnFocus &&
      manualRateReturnFocus !== document.body &&
      document.contains(manualRateReturnFocus)
        ? manualRateReturnFocus
        : drawerClose;

    manualRateReturnFocus = null;
    manualRateEditRow = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveManualRateEdit() {
    if (!guardMaterialCostWriteAction()) return;

    const row = manualRateEditRow;

    if (!row?.stock_item_id) {
      showToast("Stock item ID missing for selected Workbench row.", "error");
      return;
    }

    const values = readManualRateFormValues();

    if (!values.rateValue || values.rateValue <= 0) {
      showToast("Manual rate must be greater than zero.", "error");
      setManualRateSaveState();
      return;
    }

    if (!values.reason || values.reason.length < 5) {
      showToast("Reason / authority reference is required.", "error");
      setManualRateSaveState();
      return;
    }

    manualRateEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving manual material rate...");

    try {
      const { error } = await costingRpc("rpc_set_material_manual_rate", {
        p_stock_item_id: row.stock_item_id,
        p_rate_value: values.rateValue,
        p_effective_from: values.effectiveFrom,
        p_reason: values.reason,
      });

      if (error) throw error;

      closeManualRateEditModal();

      showToast(
        "Manual rate saved. Costing refresh required before readiness counts and cost sheets update.",
        "success",
        5200,
      );

      await reloadRows();

      const selectedRow = getSelectedRow();
      if (selectedRow?.stock_item_id) {
        const allRows = getAllRows();
        const updated = allRows.find(
          (r) =>
            String(r.stock_item_id) === String(row.stock_item_id) &&
            (!row.material_issue_code ||
              String(r.material_issue_code) ===
                String(row.material_issue_code)) &&
            (!row.bom_source || String(r.bom_source) === String(row.bom_source)),
        );

        if (updated) {
          setSelectedRow(updated);
        }

        if (getCurrentLens() === "manual-rate-manager") {
          const nextTab =
            manualRateManagerTab === "register"
              ? "manual-rate-register"
              : manualRateManagerTab === "history"
                ? "manual-rate-history"
                : "resolve";

          await setDrawerTab(nextTab);
        } else {
          await setDrawerTab("action");
        }
      }

      if (typeof markCostingRefreshDirty === "function") {
        markCostingRefreshDirty(
          "Manual material rate was saved. Run costing refresh to apply it to cost sheets and readiness counts.",
          "MATERIAL_MANUAL_RATE_SET",
        );
      }
    } catch (err) {
      handleError("Failed to save manual material rate", err);
    } finally {
      setLoadingMask(false);
      manualRateEditSaveBtn.disabled = false;
      setManualRateSaveState();
    }
  }

  function readManualRateCloseFormValues() {
    return {
      effectiveTo: manualRateCloseEffectiveTo?.value || activePeriodIso(),
      reason: manualRateCloseReason?.value?.trim() || "",
    };
  }

  function setManualRateCloseSaveState() {
    if (!manualRateCloseSaveBtn) return;

    const values = readManualRateCloseFormValues();
    manualRateCloseSaveBtn.disabled = values.reason.length < 5;
  }

  function openManualRateCloseModal(row) {
    if (!row || !manualRateCloseModal) return;
    if (!guardMaterialCostWriteAction()) return;

    manualRateCloseRow = row;
    manualRateCloseReturnFocus = document.activeElement;

    if (manualRateCloseLabel) {
      manualRateCloseLabel.textContent = `${row.stock_item_name || row.stock_item_id || "--"} | ${formatMoney(row.rate_value)}`;
    }

    if (manualRateCloseEffectiveTo) {
      manualRateCloseEffectiveTo.value = activePeriodIso();
    }

    if (manualRateCloseReason) {
      manualRateCloseReason.value = "";
    }

    manualRateCloseModal.classList.remove("hidden");
    manualRateCloseModal.setAttribute("aria-hidden", "false");

    setManualRateCloseSaveState();

    setTimeout(() => manualRateCloseReason?.focus(), 0);
  }

  function closeManualRateCloseModal() {
    if (!manualRateCloseModal) return;

    const active = document.activeElement;
    if (active && manualRateCloseModal.contains(active)) {
      active.blur();
    }

    manualRateCloseModal.classList.add("hidden");
    manualRateCloseModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      manualRateCloseReturnFocus &&
      manualRateCloseReturnFocus !== document.body &&
      document.contains(manualRateCloseReturnFocus)
        ? manualRateCloseReturnFocus
        : drawerClose;

    manualRateCloseRow = null;
    manualRateCloseReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveManualRateClose() {
    if (!guardMaterialCostWriteAction()) return;

    const row = manualRateCloseRow;

    if (!row?.manual_rate_id) {
      showToast("Manual rate ID missing.", "error");
      return;
    }

    const values = readManualRateCloseFormValues();

    if (!values.reason || values.reason.length < 5) {
      showToast("Close reason is required.", "error");
      setManualRateCloseSaveState();
      return;
    }

    manualRateCloseSaveBtn.disabled = true;
    setLoadingMask(true, "Closing manual material rate...");

    try {
      const { error } = await costingRpc("rpc_close_material_manual_rate", {
        p_manual_rate_id: row.manual_rate_id,
        p_effective_to: values.effectiveTo,
        p_close_reason: values.reason,
      });

      if (error) throw error;

      closeManualRateCloseModal();

      showToast(
        "Manual rate closed. Costing refresh required before readiness counts and cost sheets update.",
        "success",
        5200,
      );

      if (getCurrentLens() === "manual-rate-manager") {
        await reloadRows();
      } else {
        await setDrawerTab("manual-rate-history");
      }

      if (typeof markCostingRefreshDirty === "function") {
        markCostingRefreshDirty(
          "Manual material rate was closed. Run costing refresh to apply current rate evidence.",
          "MATERIAL_MANUAL_RATE_CLOSE",
        );
      }
    } catch (err) {
      handleError("Failed to close manual material rate", err);
    } finally {
      setLoadingMask(false);
      manualRateCloseSaveBtn.disabled = false;
      setManualRateCloseSaveState();
    }
  }

  function readMaterialReviewAcceptFormValues() {
    return {
      reason: materialReviewAcceptReason?.value?.trim() || "",
      note: materialReviewAcceptNote?.value?.trim() || "",
    };
  }

  function setMaterialReviewAcceptSaveState() {
    if (!materialReviewAcceptSaveBtn) return;
    const values = readMaterialReviewAcceptFormValues();
    materialReviewAcceptSaveBtn.disabled =
      materialReviewAcceptBusy || values.reason.length < 10;
  }

  function openMaterialReviewAcceptModal(row, returnFocusEl = null) {
    if (!row || !materialReviewAcceptModal) return;
    if (!guardMaterialCostWriteAction()) return;
    if (!isMaterialReviewAcceptEligible(row)) {
      showToast("This queue row is not eligible for Accept Review.", "info");
      return;
    }

    materialReviewAcceptRow = row;
    materialReviewAcceptReturnFocus =
      returnFocusEl && document.contains(returnFocusEl)
        ? returnFocusEl
        : document.activeElement;

    if (materialReviewAcceptStockItem) {
      materialReviewAcceptStockItem.textContent = `${row.stock_item_name || row.stock_item_id || "--"}${row.stock_item_code ? ` (${row.stock_item_code})` : ""}`;
    }
    if (materialReviewAcceptMaterialArea) {
      materialReviewAcceptMaterialArea.value = row.material_area || "";
    }
    if (materialReviewAcceptIssueCodes) {
      materialReviewAcceptIssueCodes.value = row.issue_codes || "";
    }
    if (materialReviewAcceptWarningCodes) {
      materialReviewAcceptWarningCodes.value = row.warning_codes || "";
    }
    if (materialReviewAcceptActionSummary) {
      materialReviewAcceptActionSummary.value =
        row.action_required_summary || row.action_note_summary || "";
    }
    if (materialReviewAcceptReason) materialReviewAcceptReason.value = "";
    if (materialReviewAcceptNote) materialReviewAcceptNote.value = "";

    materialReviewAcceptModal.classList.remove("hidden");
    materialReviewAcceptModal.setAttribute("aria-hidden", "false");
    setMaterialReviewAcceptSaveState();
    setTimeout(() => materialReviewAcceptReason?.focus(), 0);
  }

  function closeMaterialReviewAcceptModal() {
    if (!materialReviewAcceptModal) return;

    const active = document.activeElement;
    if (active && materialReviewAcceptModal.contains(active)) {
      active.blur();
    }

    materialReviewAcceptModal.classList.add("hidden");
    materialReviewAcceptModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      materialReviewAcceptReturnFocus &&
      materialReviewAcceptReturnFocus !== document.body &&
      document.contains(materialReviewAcceptReturnFocus)
        ? materialReviewAcceptReturnFocus
        : drawerClose;

    materialReviewAcceptRow = null;
    materialReviewAcceptReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function readMaterialReviewCloseAcceptanceFormValues() {
    return {
      reason: materialReviewCloseReason?.value?.trim() || "",
    };
  }

  function setMaterialReviewCloseAcceptanceSaveState() {
    if (!materialReviewCloseAcceptanceSaveBtn) return;
    const values = readMaterialReviewCloseAcceptanceFormValues();
    materialReviewCloseAcceptanceSaveBtn.disabled =
      materialReviewCloseBusy || values.reason.length < 10;
  }

  function openMaterialReviewCloseAcceptanceModal(
    acceptanceRow,
    returnFocusEl = null,
  ) {
    if (!acceptanceRow || !materialReviewCloseAcceptanceModal) return;
    if (!guardMaterialCostWriteAction()) return;

    materialReviewCloseRow = acceptanceRow;
    materialReviewCloseReturnFocus =
      returnFocusEl && document.contains(returnFocusEl)
        ? returnFocusEl
        : document.activeElement;

    if (materialReviewCloseStockItem) {
      materialReviewCloseStockItem.textContent = `${acceptanceRow.stock_item_name || acceptanceRow.stock_item_id || "--"}${acceptanceRow.stock_item_code ? ` (${acceptanceRow.stock_item_code})` : ""}`;
    }
    if (materialReviewCloseDetails) {
      materialReviewCloseDetails.value = [
        `Material area: ${acceptanceRow.material_area || "--"}`,
        `Accepted by: ${acceptanceRow.accepted_by_email || "--"}`,
        `Accepted at: ${formatDateTime(acceptanceRow.accepted_at)}`,
        `Reason: ${acceptanceRow.acceptance_reason || "--"}`,
        acceptanceRow.acceptance_note
          ? `Note: ${acceptanceRow.acceptance_note}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (materialReviewCloseReason) materialReviewCloseReason.value = "";

    materialReviewCloseAcceptanceModal.classList.remove("hidden");
    materialReviewCloseAcceptanceModal.setAttribute("aria-hidden", "false");
    setMaterialReviewCloseAcceptanceSaveState();
    setTimeout(() => materialReviewCloseReason?.focus(), 0);
  }

  function closeMaterialReviewCloseAcceptanceModal() {
    if (!materialReviewCloseAcceptanceModal) return;

    const active = document.activeElement;
    if (active && materialReviewCloseAcceptanceModal.contains(active)) {
      active.blur();
    }

    materialReviewCloseAcceptanceModal.classList.add("hidden");
    materialReviewCloseAcceptanceModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      materialReviewCloseReturnFocus &&
      materialReviewCloseReturnFocus !== document.body &&
      document.contains(materialReviewCloseReturnFocus)
        ? materialReviewCloseReturnFocus
        : drawerClose;

    materialReviewCloseRow = null;
    materialReviewCloseReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function finalizeMaterialReviewAcceptanceAction(
    successMessage,
    sourceTrigger,
    requestNote,
  ) {
    showToast(successMessage, "success", 5200);

    try {
      await runStagedCostingRefreshAndReload({
        sourceTrigger,
        requestNote,
      });
    } catch (err) {
      showToast(
        `Acceptance saved, but refresh failed: ${err?.message || String(err)}`,
        "info",
        9000,
        true,
      );
    }

    await reloadMaterialReviewWorkbenchData();
  }

  async function saveMaterialReviewAcceptance() {
    if (!guardMaterialCostWriteAction()) return;

    const row = materialReviewAcceptRow;
    if (!row?.stock_item_id) {
      showToast("Stock item ID missing for selected queue row.", "error");
      return;
    }
    if (!isMaterialReviewAcceptEligible(row)) {
      showToast("This queue row is not eligible for Accept Review.", "error");
      return;
    }

    const values = readMaterialReviewAcceptFormValues();
    if (values.reason.length < 10) {
      showToast("Acceptance reason must be at least 10 characters.", "error");
      setMaterialReviewAcceptSaveState();
      return;
    }

    materialReviewAcceptBusy = true;
    if (materialReviewAcceptSaveBtn) materialReviewAcceptSaveBtn.disabled = true;
    setLoadingMask(true, "Saving review acceptance...");

    try {
      const { error } = await costingRpc("rpc_accept_material_review_action", {
        p_period_start: row.period_start || getActivePeriodStart(),
        p_stock_item_id: row.stock_item_id,
        p_material_area: row.material_area,
        p_action_severity: row.action_severity,
        p_recommended_ui_route: row.recommended_ui_route,
        p_issue_codes: row.issue_codes,
        p_warning_codes: row.warning_codes,
        p_action_required_summary: row.action_required_summary,
        p_acceptance_reason: values.reason,
        p_acceptance_note: values.note || null,
      });

      if (error) throw error;

      closeMaterialReviewAcceptModal();
      await finalizeMaterialReviewAcceptanceAction(
        "Review accepted for this costing period.",
        "MATERIAL_REVIEW_ACCEPT",
        "Material review accepted",
      );
    } catch (err) {
      handleError("Failed to accept review", err);
    } finally {
      materialReviewAcceptBusy = false;
      setMaterialReviewAcceptSaveState();
      setLoadingMask(false);
    }
  }

  async function saveMaterialReviewCloseAcceptance() {
    if (!guardMaterialCostWriteAction()) return;

    const acceptance = materialReviewCloseRow;
    if (!acceptance?.acceptance_id) {
      showToast("Acceptance ID missing.", "error");
      return;
    }

    const values = readMaterialReviewCloseAcceptanceFormValues();
    if (values.reason.length < 10) {
      showToast("Close reason must be at least 10 characters.", "error");
      setMaterialReviewCloseAcceptanceSaveState();
      return;
    }

    materialReviewCloseBusy = true;
    if (materialReviewCloseAcceptanceSaveBtn) {
      materialReviewCloseAcceptanceSaveBtn.disabled = true;
    }
    setLoadingMask(true, "Closing review acceptance...");

    try {
      const { error } = await costingRpc("rpc_close_material_review_acceptance", {
        p_acceptance_id: acceptance.acceptance_id,
        p_close_reason: values.reason,
      });

      if (error) throw error;

      closeMaterialReviewCloseAcceptanceModal();
      await finalizeMaterialReviewAcceptanceAction(
        "Acceptance closed. Review issue will be active again after costing refresh completes.",
        "MATERIAL_REVIEW_CLOSE",
        "Material review acceptance closed",
      );
    } catch (err) {
      handleError("Failed to close acceptance", err);
    } finally {
      materialReviewCloseBusy = false;
      setMaterialReviewCloseAcceptanceSaveState();
      setLoadingMask(false);
    }
  }

  function renderControlWorkbenchSummaryTab(row) {
    const acceptance = findActiveMaterialReviewAcceptance(row);
    const acceptanceItems = acceptance
      ? [
          ["Acceptance", statusChip("Active Accepted")],
          ["Accepted By", text(acceptance.accepted_by_email || "--")],
          ["Accepted At", formatDateTime(acceptance.accepted_at)],
          ["Acceptance Reason", text(acceptance.acceptance_reason || "--")],
          ["Acceptance Note", text(acceptance.acceptance_note || "--")],
        ]
      : [];

    return (
      renderMaterialReviewAcceptancePanel(row) +
      detailPanel([
        kvSection("Material Action", [
          ["Stock Item", text(row.stock_item_name || row.stock_item_id)],
          ["Stock Code", text(row.stock_item_code)],
          ["Material Area", text(row.material_area)],
          ["Severity", statusChip(row.action_severity)],
          ["Route", text(row.recommended_ui_route)],
          ["Affected Lines", formatNumber(row.affected_line_count)],
          ["Affected Products", formatNumber(row.affected_product_count)],
          ["Affected SKUs", formatNumber(row.affected_sku_count)],
          ["Blocking SKUs", formatNumber(row.approval_blocking_sku_count)],
          ["Review SKUs", formatNumber(row.review_sku_count)],
          ["Issue Summary", text(row.action_note_summary)],
          ["Issue Codes", text(row.issue_codes)],
          ["Warning Codes", text(row.warning_codes)],
          ["BOM Sources", text(row.bom_sources)],
          ["Snapshot Time", formatDateTime(row.snapshot_refreshed_at)],
          ...acceptanceItems,
        ]),
      ])
    );
  }

  async function renderControlWorkbenchAffectedSkusTab(row) {
    const rows = await refreshSelectedMaterialActionDrilldown(row);

    return simpleTable(
      [
        "Product",
        "SKU",
        "Source",
        "Issue Code",
        "Warning",
        "Selected Rate",
        "Rate Source",
        "Rate Date",
        "Approval Block",
        "Resolution Type",
      ],
      rows,
      (x) =>
        `<tr>
        <td>${text(x.product_name)}</td>
        <td>
          ${cpCellPrimary(x.sku_id)}
          <div class="cp-muted-text">${text([x.pack_size, x.pack_uom || x.sku_uom].filter(Boolean).join(" "))}</div>
        </td>
        <td>${text(x.bom_source)}</td>
        <td>${text(issueCodeLabel(x.material_issue_code))}</td>
        <td>
          ${cpCellPrimary(x.warning_code)}
          <div class="cp-muted-text">${text(x.warning_text)}</div>
        </td>
        <td class="c-right">${formatMoney(x.selected_rate)}</td>
        <td>${text(x.rate_source)}</td>
        <td>${formatDate(x.rate_date)}</td>
        <td>${text(x.approval_block_flag)}</td>
        <td>${text(x.drilldown_resolution_type)}</td>
      </tr>`,
    );
  }

  function renderControlWorkbenchRateActionTab(row) {
    const manualRateRoutes = new Set([
      "MATERIAL_RATE_MANAGER_RM",
      "MATERIAL_RATE_MANAGER_PM",
      "MATERIAL_RATE_REVIEW",
    ]);
    const manualRateButton =
      manualRateRoutes.has(normalizeStatus(row.recommended_ui_route)) &&
      row.stock_item_id
        ? `
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <button
            type="button"
            class="icon-btn icon-btn-primary"
            id="setManualRateBtn"
            title="Set / Review Manual Rate"
            aria-label="Set / Review Manual Rate"
          >
            Set / Review Manual Rate
          </button>
        </div>
      `
        : "";

    return (
      renderMaterialReviewAcceptancePanel(row) +
      manualRateButton +
      detailPanel([
        kvSection("Rate Action", [
          ["Stock Item", text(row.stock_item_name || row.stock_item_id)],
          ["Material Area", text(row.material_area)],
          ["Severity", statusChip(row.action_severity)],
          ["Route", text(row.recommended_ui_route)],
          ["Current Selected Rate", formatMoney(row.selected_rate)],
          ["Rate Source", text(row.rate_source)],
          ["Rate Date", formatDate(row.rate_date)],
          [
            "Action Required",
            text(row.action_required_summary || row.action_note_summary),
          ],
        ]),
      ])
    );
  }

  function resolveTierChip(classification) {
    if (classification.isHardBlocker) return statusChip("Hard blocker");
    if (classification.severity === "BLOCKER") return statusChip("BLOCKER");
    if (classification.isReviewRequired) return statusChip("Review required");
    return statusChip(classification.severity || "--");
  }

  function resolveBooleanText(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "--";
  }

  async function renderMaterialIssueResolvePanel(row, context = {}) {
    if (!row) {
      return `<div class="cp-card"><div class="cp-card-value">No material issue selected.</div></div>`;
    }

    const lensId = context.lensId || "";
    const isMcm = lensId === "manual-rate-manager";
    let matchStatusNote = "";

    if (isMcm) {
      try {
        await loadWorkbenchMatchIndex(getActivePeriodStart());
      } catch (err) {
        matchStatusNote =
          "Review acceptance match could not be loaded. Manual rate actions are still available.";
        console.error("Failed to load workbench match index", err);
      }
    }

    const workbenchRow = isMcm
      ? context.workbenchRow !== undefined
        ? context.workbenchRow
        : findWorkbenchRowForMaterialIssue(row)
      : context.workbenchRow || row;

    const canEdit = canWriteMaterialCostActions();

    const activeAcceptance =
      context.activeAcceptance !== undefined
        ? context.activeAcceptance
        : workbenchRow
          ? findActiveMaterialReviewAcceptance(workbenchRow)
          : null;

    const classification = classifyMaterialIssue(row, {
      workbenchRow: isMcm ? workbenchRow : workbenchRow || row,
      activeAcceptance,
      canEdit,
    });
    const evidence = await enrichMaterialIssueEvidence(row, {
      allowFetch: false,
    });

    const codesText = classification.codes.length
      ? classification.codes.join(", ")
      : text(row.issue_codes || row.material_issue_code || "--");

    const diagnosisSection = kvSection("Diagnosis", [
      ["Stock Item", text(row.stock_item_name || row.stock_item_id)],
      ["Stock Code", text(row.stock_item_code)],
      ["Material Area", text(row.material_area)],
      ["Severity", resolveTierChip(classification)],
      ["Primary Issue", text(classification.guidance.label)],
      ["Issue Codes", codesText],
    ]);

    const guidanceCallout = `
      <div class="cp-card" style="margin-bottom:12px">
        <div class="cp-card-label">${
          classification.isHardBlocker ? "Hard blocker" : "Review required"
        }</div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          ${text(classification.guidanceText)}
        </div>
        <div class="cp-muted-text" style="margin-top:6px">
          Recommended: ${text(classification.recommendedPrimaryAction)}
        </div>
        ${
          classification.isHardBlocker
            ? `<div class="cp-muted-text" style="margin-top:6px;line-height:1.45">This issue cannot be accepted as review. Add or update a valid material rate.</div>`
            : ""
        }
      </div>
    `;

    const rateEvidenceItems = [
      ["Selected Rate", formatMoney(evidence.selectedRate)],
      ["Rate Source", text(evidence.selectedRateSource)],
      ["Rate Date", formatDate(evidence.selectedRateDate)],
    ];
    if (evidence.latestPurchaseRate != null) {
      rateEvidenceItems.push([
        "Latest Purchase Rate",
        formatMoney(evidence.latestPurchaseRate),
      ]);
    }
    if (evidence.latestPurchaseDate != null) {
      rateEvidenceItems.push([
        "Latest Purchase Date",
        formatDate(evidence.latestPurchaseDate),
      ]);
    }
    if (evidence.activeManualRate != null) {
      rateEvidenceItems.push([
        "Manual Rate",
        formatMoney(evidence.activeManualRate),
      ]);
    }
    if (evidence.activeManualRateStatus != null) {
      rateEvidenceItems.push([
        "Manual Rate Status",
        text(evidence.activeManualRateStatus),
      ]);
    }
    if (evidence.newerPurchaseRateAvailable != null) {
      rateEvidenceItems.push([
        "Newer Purchase Rate Available",
        resolveBooleanText(evidence.newerPurchaseRateAvailable),
      ]);
    }
    if (evidence.manualRateOverridesPurchaseRate != null) {
      rateEvidenceItems.push([
        "Manual Rate Overrides Purchase Rate",
        resolveBooleanText(evidence.manualRateOverridesPurchaseRate),
      ]);
    }

    const readinessSection = kvSection("Readiness Impact", [
      ["Affected Lines", formatNumber(row.affected_line_count)],
      ["Affected Products", formatNumber(row.affected_product_count)],
      ["Affected SKUs", formatNumber(row.affected_sku_count)],
      ["Blocking SKUs", formatNumber(row.approval_blocking_sku_count)],
      ["Review SKUs", formatNumber(row.review_sku_count)],
      ["BOM Sources", text(row.bom_sources)],
      ["Material Line Statuses", text(row.material_line_statuses)],
    ]);

    let acceptanceBlock = "";
    if (classification.hasActiveAcceptance && activeAcceptance) {
      acceptanceBlock = `
        <div class="cp-card" style="margin-bottom:12px">
          <div class="cp-card-label">Accepted for this costing period</div>
          <div class="cp-card-value">${statusChip("Active Accepted")}</div>
          <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
            ${text(activeAcceptance.accepted_by_email || "--")} · ${formatDateTime(activeAcceptance.accepted_at)}
          </div>
          ${
            activeAcceptance.acceptance_reason
              ? `<div class="cp-muted-text" style="margin-top:6px">${text(activeAcceptance.acceptance_reason)}</div>`
              : ""
          }
          ${
            activeAcceptance.acceptance_note
              ? `<div class="cp-muted-text" style="margin-top:4px">${text(activeAcceptance.acceptance_note)}</div>`
              : ""
          }
        </div>
      `;
    } else if (!classification.canAcceptReview && classification.blockAcceptReason) {
      acceptanceBlock = `
        <div class="cp-muted-text" style="margin-bottom:12px;line-height:1.45">
          Accept Review is not available: ${text(classification.blockAcceptReason)}
        </div>
      `;
    }

    if (matchStatusNote) {
      acceptanceBlock += `
        <div class="cp-muted-text" style="margin-bottom:12px;line-height:1.45">
          ${text(matchStatusNote)}
        </div>
      `;
    }

    const readOnlyBlock = !canEdit
      ? `<div class="cp-muted-text" style="margin-bottom:12px;line-height:1.45">Read-only access</div>`
      : "";

    const actionButtons = [];
    if (canEdit && classification.canSetManualRate) {
      actionButtons.push(
        `<button type="button" class="icon-btn icon-btn-primary" id="resolveSetManualRateBtn" title="Add / Update Manual Rate" aria-label="Add / Update Manual Rate">Add / Update Manual Rate</button>`,
      );
    }
    if (canEdit && classification.canAcceptReview) {
      actionButtons.push(
        `<button type="button" class="icon-btn" id="resolveAcceptReviewBtn" title="Accept Review" aria-label="Accept Review">Accept Review</button>`,
      );
    }
    if (canEdit && classification.canCloseAcceptance) {
      actionButtons.push(
        `<button type="button" class="icon-btn cp-danger-text-btn" id="resolveCloseAcceptanceBtn" title="Close Acceptance" aria-label="Close Acceptance">Close Acceptance</button>`,
      );
    }
    if (isMcm) {
      actionButtons.push(
        `<button type="button" class="icon-btn" id="resolveViewHistoryBtn" title="View Rate History" aria-label="View Rate History">View Rate History</button>`,
      );
      if (manualRateManagerTab === "action-queue") {
        actionButtons.push(
          `<button type="button" class="icon-btn" id="resolveViewAffectedBtn" title="Affected Products/SKUs" aria-label="Affected Products/SKUs">Affected Products/SKUs</button>`,
        );
      }
    } else {
      actionButtons.push(
        `<button type="button" class="icon-btn" id="resolveViewAffectedBtn" title="Affected SKUs" aria-label="Affected SKUs">Affected SKUs</button>`,
      );
    }

    const actionRow = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px">
        ${actionButtons.join("")}
      </div>
    `;

    return (
      guidanceCallout +
      readOnlyBlock +
      acceptanceBlock +
      detailPanel([
        diagnosisSection,
        kvSection("Rate Evidence", rateEvidenceItems),
        readinessSection,
      ]) +
      actionRow
    );
  }

  function wireMaterialIssueResolveActions(lensId) {
    if (
      lensId !== "costing-review-workbench" &&
      lensId !== "manual-rate-manager"
    ) {
      return;
    }

    const isMcm = lensId === "manual-rate-manager";

    document
      .getElementById("resolveSetManualRateBtn")
      ?.addEventListener("click", () => {
        if (!guardMaterialCostWriteAction()) return;
        const selectedRow = getSelectedRow();
        if (selectedRow) openManualRateEditModal(selectedRow);
      });

    document
      .getElementById("resolveAcceptReviewBtn")
      ?.addEventListener("click", async () => {
        if (!guardMaterialCostWriteAction()) return;
        const selectedRow = getSelectedRow();
        if (!selectedRow) return;

        if (isMcm) {
          try {
            await loadWorkbenchMatchIndex(getActivePeriodStart());
          } catch (err) {
            handleError("Failed to load review acceptance match", err);
            return;
          }
          const workbenchRow = findWorkbenchRowForMaterialIssue(selectedRow);
          if (workbenchRow) openMaterialReviewAcceptModal(workbenchRow);
          return;
        }

        openMaterialReviewAcceptModal(selectedRow);
      });

    document
      .getElementById("resolveCloseAcceptanceBtn")
      ?.addEventListener("click", async () => {
        if (!guardMaterialCostWriteAction()) return;
        const selectedRow = getSelectedRow();
        if (!selectedRow) return;

        let workbenchRow = selectedRow;
        if (isMcm) {
          try {
            await loadWorkbenchMatchIndex(getActivePeriodStart());
          } catch (err) {
            handleError("Failed to load review acceptance match", err);
            return;
          }
          workbenchRow = findWorkbenchRowForMaterialIssue(selectedRow);
        }

        const acceptance = workbenchRow
          ? findActiveMaterialReviewAcceptance(workbenchRow)
          : null;
        if (acceptance) openMaterialReviewCloseAcceptanceModal(acceptance);
      });

    document
      .getElementById("resolveViewAffectedBtn")
      ?.addEventListener("click", () => {
        setDrawerTab(isMcm ? "affected-products" : "affected");
      });

    document
      .getElementById("resolveViewHistoryBtn")
      ?.addEventListener("click", () => {
        setDrawerTab("manual-rate-history");
      });
  }

  async function renderMaterialWorkbenchTab(tabId, row, lensId) {
    const workbenchTabId =
      {
        "manual-rate-action":
          lensId === "manual-rate-manager" &&
          manualRateManagerTab === "action-queue"
            ? "resolve"
            : "action",
        "affected-products": "affected",
        "raw-lines": "raw",
      }[tabId] || tabId;

    if (lensId === "costing-review-workbench") {
      if (workbenchTabId === "resolve" || workbenchTabId === "summary")
        return renderMaterialIssueResolvePanel(row, {
          lensId,
          workbenchRow: row,
        });
      if (workbenchTabId === "affected")
        return renderControlWorkbenchAffectedSkusTab(row);
      if (workbenchTabId === "action")
        return renderControlWorkbenchRateActionTab(row);
      return renderMaterialIssueResolvePanel(row, {
        lensId,
        workbenchRow: row,
      });
    }

    if (
      lensId === "manual-rate-manager" &&
      manualRateManagerTab === "action-queue" &&
      (workbenchTabId === "resolve" || tabId === "manual-rate-action")
    ) {
      return renderMaterialIssueResolvePanel(row, {
        lensId: "manual-rate-manager",
      });
    }

    if (workbenchTabId === "action") {
      const manualRateButton = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="setManualRateBtn"
          title="Set Manual Material Rate"
          aria-label="Set Manual Material Rate"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
          </svg>
        </button>
      </div>
    `;

      return (
        manualRateButton +
        detailPanel([
          kvSection("Material Line", [
            ["Status", statusChip(row.material_line_status)],
            ["Issue Code", text(issueCodeLabel(row.material_issue_code))],
            ["Source", text(row.bom_source)],
            ["Stock Item ID", text(row.stock_item_id)],
            ["Stock Item", text(row.stock_item_name)],
            ["Selected Rate", formatMoney(row.selected_rate)],
            ["Rate Source", text(row.rate_source)],
            [
              "Manual Rate Status",
              row.rate_source === "MANUAL_RATE"
                ? statusChip("MANUAL RATE USED")
                : text("--"),
            ],
            ["Rate Date", formatDate(row.rate_date)],
            ["Affected Products", formatNumber(row.affected_product_count)],
            ["Affected SKUs", formatNumber(row.affected_sku_count)],
            ["Recommended Action", text(row.recommended_action)],
          ]),
        ])
      );
    }
    if (workbenchTabId === "manual-rate-register") {
      const managerRegisterRows = await fetchManualRateManagerRegisterRows();
      const registerRows = managerRegisterRows.filter(
        (registerRow) =>
          String(registerRow.stock_item_id) === String(row.stock_item_id),
      );

      return simpleTable(
        [
          "Manual Rate ID",
          "Rate",
          "Effective From",
          "Effective To",
          "Status",
          "Register Status",
          "Latest Purchase Rate",
          "Latest Purchase Date",
          "Recommended Action",
        ],
        registerRows,
        (registerRow) =>
          `<tr>
          <td>${text(registerRow.manual_rate_id)}</td>
          <td class="c-right">${formatMoney(registerRow.rate_value)}</td>
          <td>${formatDate(registerRow.effective_from)}</td>
          <td>${formatDate(registerRow.effective_to)}</td>
          <td>${statusChip(registerRow.status)}</td>
          <td>${compactStatusText(registerRow.register_status)}</td>
          <td class="c-right">${formatMoney(registerRow.latest_purchase_rate)}</td>
          <td>${formatDate(registerRow.latest_purchase_date)}</td>
          <td>${text(registerRow.recommended_action)}</td>
        </tr>`,
      );
    }
    if (workbenchTabId === "affected" || workbenchTabId === "raw") {
      const hasWorkbenchDrilldownContext =
        row?.stock_item_id && row?.material_issue_code && row?.bom_source;

      if (!hasWorkbenchDrilldownContext) {
        return `
        <div class="cp-card">
          <div class="cp-card-label">Workbench Drilldown</div>
          <div class="cp-card-value">
            Drilldown is available only for Action Queue / Workbench issue rows.
          </div>
          <div class="cp-muted-text" style="margin-top:6px">
            This selected row belongs to the Manual Rate Register or History, so it does not carry a Workbench issue code and BOM source.
          </div>
        </div>
      `;
      }

      const rows = await fetchActionDrilldown(row);

      if (workbenchTabId === "affected") {
        return simpleTable(
          [
            "Product",
            "SKU",
            "Pack",
            "UOM",
            "Line",
            "Qty / Ref Output",
            "Optional",
            "Action Required",
            "Warning",
          ],
          rows,
          (x) =>
            `<tr>
            <td>${text(x.product_name)}</td>
            <td>${text(x.sku_id || "Product-level RM")}</td>
            <td>${text(x.pack_size)}</td>
            <td>${text(x.sku_uom)}</td>
            <td>${text(x.line_no)}</td>
            <td class="c-right">${formatNumber(x.qty_per_reference_output)}</td>
            <td>${text(x.is_optional)}</td>
            <td>${text(x.action_required)}</td>
            <td>${text(x.warning_text)}</td>
          </tr>`,
        );
      }

      return simpleTable(
        [
          "Selected Rate",
          "Rate Source",
          "Rate Date",
          "Warning Code",
          "Warning Text",
          "Approval Block",
        ],
        rows,
        (x) => {
          const selectedRate = x.selected_rate ?? row.selected_rate;
          const rateSource = x.rate_source ?? row.rate_source;
          const rateDate = x.rate_date ?? row.rate_date;

          return `<tr>
          <td class="c-right">${formatMoney(selectedRate)}</td>
          <td class="c-center">${text(rateSource)}</td>
          <td class="c-center">${formatDate(rateDate)}</td>
          <td class="c-center">${text(x.warning_code)}</td>
          <td>${text(x.warning_text)}</td>
          <td class="c-center">${text(x.approval_block_flag)}</td>
        </tr>`;
        },
      );
    }
    if (workbenchTabId === "manual-rate-history") {
      const historyRows = await fetchManualRateHistory(row);
      const review = await fetchManualRateReview(row);

      const reviewCard = review
        ? `<div class="cp-card" style="margin-bottom:10px">
          <div class="cp-card-label">Manual Rate Review</div>
          <div class="cp-card-value">
            ${
              review.manual_rate_overrides_purchase_rate
                ? statusChip("REVIEW_REQUIRED")
                : statusChip("INFO")
            }
            <span style="margin-left:8px">${text(review.review_message)}</span>
          </div>
          <div class="cp-muted-text" style="margin-top:6px">
            Manual Rate: ${formatMoney(review.manual_rate_value)}
            |
            Latest Purchase Rate: ${formatMoney(review.latest_purchase_rate)}
            |
            Latest Purchase Date: ${formatDate(review.latest_purchase_date)}
          </div>
        </div>`
        : "";

      if (!historyRows.length) {
        return (
          reviewCard +
          `<div class="cp-card">
          <div class="cp-card-label">Manual Rate History</div>
          <div class="cp-card-value">No manual rate history found for this stock item.</div>
        </div>`
        );
      }

      return (
        reviewCard +
        simpleTable(
          [
            "Manual Rate ID",
            "Rate",
            "Effective From",
            "Effective To",
            "Status",
            "Reason / Approval Reference",
            "Created At",
            "Last Updated At",
          ],
          historyRows,
          (x) =>
            `<tr>
            <td>${text(x.manual_rate_id)}</td>
            <td class="c-right">${formatMoney(x.rate_value)}</td>
            <td>${formatDate(x.effective_from)}</td>
            <td>${formatDate(x.effective_to)}</td>
            <td>${statusChip(x.status)}</td>
            <td>${text(x.reason)}</td>
            <td>${formatDateTime(x.created_at)}</td>
            <td>${formatDateTime(x.last_updated_at)}</td>
          </tr>`,
        )
      );
    }
    return "";
  }

  function getTracePermissionsSafe() {
    if (typeof getTracePermissions === "function") {
      return getTracePermissions();
    }
    return {
      currentComponent: CURRENT_TRACE_COMPONENT,
      canViewTrace: false,
      canExportTrace: false,
      permissionsResolved: false,
    };
  }

  function canAccessRmTrace() {
    const perms = getTracePermissionsSafe();
    return (
      perms.permissionsResolved === true &&
      perms.canViewTrace === true &&
      (perms.currentComponent || CURRENT_TRACE_COMPONENT) === "RM"
    );
  }

  function canExportRmTrace() {
    const perms = getTracePermissionsSafe();
    return (
      canAccessRmTrace() && perms.canExportTrace === true
    );
  }

  function getManualRateManagerTab() {
    return manualRateManagerTab;
  }

  function setManualRateManagerTab(tabId) {
    const next = String(tabId || "").trim();
    if (!MANUAL_RATE_MANAGER_TAB_IDS.has(next)) return manualRateManagerTab;
    manualRateManagerTab = next;
    return manualRateManagerTab;
  }

  function syncTracePageFromShell(page, pageSize) {
    TRACE_PAGE = Math.max(1, Number(page) || 1);
    if (pageSize) TRACE_PAGE_SIZE = Number(pageSize) || 25;
  }

  function getTracePage() {
    return TRACE_PAGE;
  }

  function getTraceTotalCount() {
    return TRACE_TOTAL_COUNT;
  }

  function getTraceLoadState() {
    return TRACE_LOAD_STATE;
  }

  function getTraceErrorMessage() {
    return TRACE_ERROR_MESSAGE;
  }

  function clearTraceConfidentialState() {
    TRACE_ROWS = [];
    TRACE_TOTAL_COUNT = 0;
  }

  function applyTraceLaunchContext(context = {}) {
    const materialArea = String(context.materialArea || "").trim();
    const traceComponent = String(context.traceComponent || "").trim();
    if (materialArea && materialArea !== "RM") return;
    if (traceComponent && traceComponent !== "RM") return;

    if (context.productId != null) TRACE_FILTERS.product_id = context.productId;
    if (context.skuId != null) TRACE_FILTERS.sku_id = context.skuId;
    if (context.stockItemId != null) {
      TRACE_FILTERS.stock_item_id = context.stockItemId;
    }
    if (context.search) TRACE_FILTERS.search_text = context.search;
  }

  function resetOptionalTraceFilters({ keepPeriodOnly = true } = {}) {
    TRACE_FILTERS = {
      product_id: null,
      sku_id: null,
      stock_item_id: null,
      search_text: "",
      bom_source: null,
      review_state: null,
      warning_status: null,
      has_semi_process: null,
    };
    void keepPeriodOnly;
  }

  function getRmTraceDom() {
    return {
      chrome: document.getElementById("rmCostTraceChrome"),
      snapshot: document.getElementById("rmCostTraceSnapshot"),
      restricted: document.getElementById("rmCostTraceRestricted"),
      filters: document.getElementById("rmCostTraceFilters"),
      product: document.getElementById("rmTraceProduct"),
      sku: document.getElementById("rmTraceSku"),
      search: document.getElementById("rmTraceSearch"),
      bom: document.getElementById("rmTraceBomSource"),
      review: document.getElementById("rmTraceReviewState"),
      warning: document.getElementById("rmTraceWarningStatus"),
      semi: document.getElementById("rmTraceSemiProcess"),
      clear: document.getElementById("rmTraceClearFilters"),
      advancedBtn: document.getElementById("rmTraceAdvancedBtn"),
      advancedPanel: document.getElementById("rmTraceAdvancedPanel"),
      advancedWrap: document.getElementById("rmTraceAdvancedWrap"),
      filterBadge: document.getElementById("rmTraceFilterBadge"),
    };
  }

  function countActiveSecondaryTraceFilters() {
    let count = 0;
    if (TRACE_FILTERS.bom_source) count += 1;
    if (TRACE_FILTERS.review_state) count += 1;
    if (TRACE_FILTERS.warning_status) count += 1;
    if (TRACE_FILTERS.has_semi_process === true || TRACE_FILTERS.has_semi_process === false) {
      count += 1;
    }
    return count;
  }

  function updateRmTraceAdvancedButtonLabel() {
    const dom = getRmTraceDom();
    if (!dom.advancedBtn) return;
    const count = countActiveSecondaryTraceFilters();
    const badge =
      dom.filterBadge ||
      dom.advancedBtn.querySelector(".peq-filter-badge");
    if (badge) {
      if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = "";
      } else {
        badge.textContent = "";
        badge.style.display = "none";
      }
    }
    dom.advancedBtn.classList.toggle("peq-filter-btn--active", count > 0);
    const label = count > 0 ? `Filters (${count})` : "Filters";
    dom.advancedBtn.title = label;
    dom.advancedBtn.setAttribute("aria-label", label);
  }

  function closeRmTraceAdvancedPanel() {
    const dom = getRmTraceDom();
    if (!dom.advancedPanel || !dom.advancedBtn) return;
    dom.advancedPanel.classList.remove("open");
    dom.advancedBtn.setAttribute("aria-expanded", "false");
  }

  function toggleRmTraceAdvancedPanel() {
    const dom = getRmTraceDom();
    if (!dom.advancedPanel || !dom.advancedBtn) return;
    const open = !dom.advancedPanel.classList.contains("open");
    dom.advancedPanel.classList.toggle("open", open);
    dom.advancedBtn.setAttribute("aria-expanded", String(open));
  }

  function fillSelectOptions(selectEl, options, { valueKey, labelKey, selected, blankLabel }) {
    if (!selectEl) return;
    const items = Array.isArray(options) ? options : [];
    const opts = [`<option value="">${text(blankLabel || "All", "All")}</option>`];
    items.forEach((item) => {
      const value = item?.[valueKey];
      if (value == null || value === "") return;
      const label = item?.[labelKey] ?? value;
      const isSelected = String(selected ?? "") === String(value);
      opts.push(
        `<option value="${text(value, "")}"${isSelected ? " selected" : ""}>${text(label)}</option>`,
      );
    });
    selectEl.innerHTML = opts.join("");
  }

  function fillPlainOptions(selectEl, values, selected, blankLabel) {
    if (!selectEl) return;
    const items = Array.isArray(values) ? values : [];
    const opts = [`<option value="">${text(blankLabel || "All", "All")}</option>`];
    items.forEach((value) => {
      if (value == null || value === "") return;
      const isSelected = String(selected ?? "") === String(value);
      opts.push(
        `<option value="${text(value, "")}"${isSelected ? " selected" : ""}>${text(value)}</option>`,
      );
    });
    selectEl.innerHTML = opts.join("");
  }

  function renderRmTraceFilterControls() {
    const dom = getRmTraceDom();
    const skuOptions = (TRACE_FILTER_OPTIONS.skus || []).filter((sku) => {
      if (TRACE_FILTERS.product_id == null) return true;
      return String(sku.product_id) === String(TRACE_FILTERS.product_id);
    });

    fillSelectOptions(dom.product, TRACE_FILTER_OPTIONS.products, {
      valueKey: "product_id",
      labelKey: "product_name",
      selected: TRACE_FILTERS.product_id,
      blankLabel: "All products",
    });
    fillSelectOptions(dom.sku, skuOptions, {
      valueKey: "sku_id",
      labelKey: "sku_column_label",
      selected: TRACE_FILTERS.sku_id,
      blankLabel: "All SKUs",
    });
    fillPlainOptions(
      dom.bom,
      TRACE_FILTER_OPTIONS.bom_sources,
      TRACE_FILTERS.bom_source,
      "All BOM sources",
    );
    fillPlainOptions(
      dom.review,
      TRACE_FILTER_OPTIONS.review_states,
      TRACE_FILTERS.review_state,
      "All review states",
    );
    fillPlainOptions(
      dom.warning,
      TRACE_FILTER_OPTIONS.warning_statuses,
      TRACE_FILTERS.warning_status,
      "All warning statuses",
    );
    if (dom.semi) {
      const semiValue =
        TRACE_FILTERS.has_semi_process === true
          ? "true"
          : TRACE_FILTERS.has_semi_process === false
            ? "false"
            : "";
      dom.semi.value = semiValue;
    }
    if (dom.search && document.activeElement !== dom.search) {
      dom.search.value = TRACE_FILTERS.search_text || "";
    }
    updateRmTraceAdvancedButtonLabel();
  }

  function renderRmTraceSnapshotBanner() {
    const dom = getRmTraceDom();
    if (!dom.snapshot) return;
    const stamp =
      TRACE_SNAPSHOT_REFRESHED_AT ||
      TRACE_FILTER_OPTIONS.snapshot_refreshed_at ||
      null;
    const total = Number(TRACE_TOTAL_COUNT || 0);
    const totalLabel = `${total.toLocaleString("en-IN")} record${total === 1 ? "" : "s"}`;
    const snapshotLabel = stamp
      ? `Snapshot refreshed ${formatDateTime(stamp)}`
      : "Snapshot refreshed —";
    dom.snapshot.innerHTML = `
      <span class="rm-cost-trace-meta-title">RM Cost Trace</span>
      <span class="rm-cost-trace-meta-sep">·</span>
      <span>${text(totalLabel)}</span>
      <span class="rm-cost-trace-meta-sep">·</span>
      <span title="Current Costing Refresh">${text(snapshotLabel)}</span>`;
  }

  function syncManualRateManagerControlsVisibility() {
    const controls = document.getElementById("manualRateManagerControls");
    if (!controls) return;
    const show = getCurrentLens() === "manual-rate-manager";
    controls.classList.toggle("hidden", !show);
    controls.setAttribute("aria-hidden", show ? "false" : "true");
    if (!show) {
      document.getElementById("peqFilterDrawer")?.classList.remove("open");
    }
  }

  function syncRmTraceChrome() {
    const dom = getRmTraceDom();
    const active = getCurrentLens() === "rm-cost-trace";

    syncManualRateManagerControlsVisibility();

    if (!active) {
      if (dom.chrome) {
        dom.chrome.classList.add("hidden");
        dom.chrome.setAttribute("aria-hidden", "true");
      }
      closeRmTraceAdvancedPanel();
      if (typeof syncTraceExportButtonState === "function") {
        syncTraceExportButtonState();
      }
      return;
    }

    if (dom.chrome) {
      dom.chrome.classList.remove("hidden");
      dom.chrome.setAttribute("aria-hidden", "false");
    }

    const allowed = canAccessRmTrace();
    if (dom.restricted) {
      dom.restricted.classList.toggle("hidden", allowed);
      if (!allowed) {
        dom.restricted.innerHTML = `<div class="status error">${text(
          RM_TRACE_RESTRICTED_MESSAGE,
        ).replace(/\n/g, "<br>")}</div>`;
      }
    }
    if (dom.filters) {
      dom.filters.classList.toggle("hidden", !allowed);
    }
    if (dom.snapshot) {
      dom.snapshot.classList.toggle("hidden", !allowed);
    }
    if (!allowed) {
      closeRmTraceAdvancedPanel();
    } else {
      renderRmTraceFilterControls();
      renderRmTraceSnapshotBanner();
    }
    if (typeof syncTraceExportButtonState === "function") {
      syncTraceExportButtonState();
    }
  }

  function buildRmTraceRpcFilters() {
    const periodStart = getActivePeriodStart();
    return {
      p_period_start: periodStart || null,
      p_product_id: TRACE_FILTERS.product_id,
      p_sku_id: TRACE_FILTERS.sku_id,
      p_stock_item_id: TRACE_FILTERS.stock_item_id,
      p_review_state: TRACE_FILTERS.review_state,
      p_bom_source: TRACE_FILTERS.bom_source,
      p_warning_status: TRACE_FILTERS.warning_status,
      p_has_semi_process: TRACE_FILTERS.has_semi_process,
      p_search_text: TRACE_FILTERS.search_text || null,
    };
  }

  async function loadRmTraceFilterOptions() {
    if (!canAccessRmTrace()) return;
    const periodStart = getActivePeriodStart();
    if (!periodStart) return;

    const { data, error } = await costingRpc(
      "rpc_get_material_rate_rm_cost_trace_filter_options",
      {
        p_period_start: periodStart,
        p_product_id: TRACE_FILTERS.product_id,
      },
    );
    if (error) throw error;

    const payload = Array.isArray(data) ? data[0] : data;
    TRACE_FILTER_OPTIONS = {
      period_start: payload?.period_start ?? periodStart,
      products: Array.isArray(payload?.products) ? payload.products : [],
      skus: Array.isArray(payload?.skus) ? payload.skus : [],
      bom_sources: Array.isArray(payload?.bom_sources)
        ? payload.bom_sources
        : [],
      review_states: Array.isArray(payload?.review_states)
        ? payload.review_states
        : [],
      warning_statuses: Array.isArray(payload?.warning_statuses)
        ? payload.warning_statuses
        : [],
      trace_component: payload?.trace_component || "RM",
      snapshot_refreshed_at: payload?.snapshot_refreshed_at || null,
    };
    TRACE_SNAPSHOT_REFRESHED_AT =
      TRACE_FILTER_OPTIONS.snapshot_refreshed_at || TRACE_SNAPSHOT_REFRESHED_AT;

    if (
      TRACE_FILTERS.sku_id != null &&
      !TRACE_FILTER_OPTIONS.skus.some(
        (sku) => String(sku.sku_id) === String(TRACE_FILTERS.sku_id),
      )
    ) {
      TRACE_FILTERS.sku_id = null;
    }
  }

  async function loadRmCostTraceRows() {
    const perms = getTracePermissionsSafe();
    if (!perms.permissionsResolved) {
      TRACE_LOAD_STATE = "idle";
      clearTraceConfidentialState();
      return [];
    }
    if (!canAccessRmTrace()) {
      TRACE_LOAD_STATE = "restricted";
      TRACE_ERROR_MESSAGE = "";
      clearTraceConfidentialState();
      return [];
    }

    TRACE_LOAD_STATE = "loading";
    TRACE_ERROR_MESSAGE = "";
    try {
      await loadRmTraceFilterOptions();
      const offset = (TRACE_PAGE - 1) * TRACE_PAGE_SIZE;
      const { data, error } = await costingRpc(
        "rpc_get_material_rate_rm_cost_trace",
        {
          ...buildRmTraceRpcFilters(),
          p_limit: TRACE_PAGE_SIZE,
          p_offset: offset,
        },
      );
      if (error) {
        const msg = String(error.message || error.code || "");
        if (/permission|not authorized|forbidden|42501/i.test(msg)) {
          TRACE_LOAD_STATE = "restricted";
          clearTraceConfidentialState();
          return [];
        }
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      TRACE_ROWS = rows;
      TRACE_TOTAL_COUNT = rows.length
        ? Number(rows[0]?.total_row_count || 0)
        : 0;
      if (rows[0]?.snapshot_refreshed_at) {
        TRACE_SNAPSHOT_REFRESHED_AT = rows[0].snapshot_refreshed_at;
      }
      TRACE_LOAD_STATE = rows.length ? "ready" : "empty";
      return rows;
    } catch (err) {
      console.warn("[costing-suite] RM cost trace load failed", err);
      TRACE_LOAD_STATE = "error";
      TRACE_ERROR_MESSAGE =
        err?.message || "Unable to load RM Cost Trace.";
      clearTraceConfidentialState();
      return [];
    }
  }

  async function reloadRmTraceFromFilters() {
    TRACE_PAGE = 1;
    if (typeof reloadRows === "function") {
      await reloadRows();
    }
  }

  async function fetchAllRmTraceExportRows(rpcParams) {
    const allRows = [];
    let offset = 0;
    let expectedTotal = null;
    const maxOffset = 5_000_000;

    while (offset <= maxOffset) {
      const rangeTo = offset + RM_TRACE_EXPORT_BATCH_SIZE - 1;
      const { data, error } = await costingRpc(
        "rpc_export_material_rate_rm_cost_trace",
        rpcParams,
        { rangeFrom: offset, rangeTo },
      );
      if (error) {
        console.error("RM Cost Trace export batch failed", {
          offset,
          rangeTo,
          message: error?.message || String(error),
        });
        throw error;
      }

      const batch = Array.isArray(data) ? data : [];
      if (batch.length === 0) break;

      const batchTotalRaw = Number(batch[0]?.export_total_row_count);
      if (Number.isFinite(batchTotalRaw) && batchTotalRaw >= 0) {
        if (expectedTotal == null) {
          expectedTotal = batchTotalRaw;
        } else if (batchTotalRaw !== expectedTotal) {
          console.warn(
            "RM Cost Trace export_total_row_count differed across batches; retaining first total",
            {
              firstTotal: expectedTotal,
              laterTotal: batchTotalRaw,
              offset,
            },
          );
        }
      }

      allRows.push(...batch);

      if (batch.length < RM_TRACE_EXPORT_BATCH_SIZE) break;
      if (expectedTotal != null && allRows.length >= expectedTotal) break;

      offset += RM_TRACE_EXPORT_BATCH_SIZE;
    }

    if (expectedTotal != null && allRows.length > expectedTotal) {
      console.warn(
        "RM Cost Trace export received more rows than export_total_row_count; trimming excess",
        {
          retrieved: allRows.length,
          expectedTotal,
        },
      );
      allRows.length = expectedTotal;
    }

    if (expectedTotal != null && allRows.length < expectedTotal) {
      throw new Error(
        `Export could not retrieve all filtered RM trace rows. Retrieved ${allRows.length} of ${expectedTotal} rows. Please retry.`,
      );
    }

    return allRows;
  }

  async function exportRmCostTraceCsv() {
    if (!canExportRmTrace()) {
      showToast(
        "Confidential RM Cost Trace export is restricted for your access.",
        "error",
      );
      return;
    }

    let rows = [];
    try {
      setLoadingMask?.(true, "Exporting RM Cost Trace...");
      rows = await fetchAllRmTraceExportRows(buildRmTraceRpcFilters());
      if (!rows.length) {
        showToast("No rows to export", "info");
        return;
      }

      const csvEscape = (value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [
        RM_TRACE_EXPORT_COLUMNS.map(csvEscape).join(","),
        ...rows.map((row) =>
          RM_TRACE_EXPORT_COLUMNS.map((key) => csvEscape(row[key])).join(","),
        ),
      ].join("\n");
      const period = String(getActivePeriodStart() || "period").slice(0, 10);
      const filename = `rm-cost-trace_${period}.csv`;
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
    } catch (err) {
      rows = [];
      handleError("Failed to export RM Cost Trace", err);
    } finally {
      setLoadingMask?.(false);
      if (typeof syncTraceExportButtonState === "function") {
        syncTraceExportButtonState();
      }
    }
  }

  function bindRmTraceFilterEvents() {
    if (rmTraceEventsBound) return;
    const dom = getRmTraceDom();
    if (!dom.filters) return;
    rmTraceEventsBound = true;

    dom.product?.addEventListener("change", async () => {
      const value = dom.product.value;
      TRACE_FILTERS.product_id = value ? Number(value) : null;
      TRACE_FILTERS.sku_id = null;
      await reloadRmTraceFromFilters();
    });
    dom.sku?.addEventListener("change", async () => {
      const value = dom.sku.value;
      TRACE_FILTERS.sku_id = value ? Number(value) : null;
      await reloadRmTraceFromFilters();
    });
    dom.bom?.addEventListener("change", async () => {
      TRACE_FILTERS.bom_source = dom.bom.value || null;
      updateRmTraceAdvancedButtonLabel();
      await reloadRmTraceFromFilters();
    });
    dom.review?.addEventListener("change", async () => {
      TRACE_FILTERS.review_state = dom.review.value || null;
      updateRmTraceAdvancedButtonLabel();
      await reloadRmTraceFromFilters();
    });
    dom.warning?.addEventListener("change", async () => {
      TRACE_FILTERS.warning_status = dom.warning.value || null;
      updateRmTraceAdvancedButtonLabel();
      await reloadRmTraceFromFilters();
    });
    dom.semi?.addEventListener("change", async () => {
      const value = dom.semi.value;
      TRACE_FILTERS.has_semi_process =
        value === "true" ? true : value === "false" ? false : null;
      updateRmTraceAdvancedButtonLabel();
      await reloadRmTraceFromFilters();
    });
    dom.search?.addEventListener("input", () => {
      window.clearTimeout(rmTraceSearchTimer);
      rmTraceSearchTimer = window.setTimeout(async () => {
        TRACE_FILTERS.search_text = String(dom.search.value || "").trim();
        await reloadRmTraceFromFilters();
      }, 300);
    });
    dom.clear?.addEventListener("click", async () => {
      resetOptionalTraceFilters();
      if (dom.search) dom.search.value = "";
      updateRmTraceAdvancedButtonLabel();
      closeRmTraceAdvancedPanel();
      await reloadRmTraceFromFilters();
    });
    dom.advancedBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleRmTraceAdvancedPanel();
    });
    dom.advancedPanel?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.addEventListener("click", (event) => {
      const wrap = dom.advancedWrap;
      if (!wrap || wrap.contains(event.target)) return;
      closeRmTraceAdvancedPanel();
    });
  }

  function formatRmWarningCell(row) {
    const code = row.warning_code || "";
    const warningText = row.warning_text || "";
    const expansion = row.expansion_note || "";
    const titleParts = [warningText, expansion].filter(Boolean);
    const title = titleParts.length
      ? ` title="${text(titleParts.join(" — "), "")}"`
      : "";
    if (!code && !warningText) return '<span class="cp-muted-text">--</span>';
    return `<span class="rm-trace-warning-cell"${title}>${text(
      code || warningText,
    )}</span>`;
  }

  async function loadManualRateManagerRows(tab) {
    const activeTab = tab || manualRateManagerTab;
    if (activeTab === "register") {
      return fetchManualRateManagerRegisterRows();
    }
    if (activeTab === "history") {
      return fetchManualRateManagerHistoryRows();
    }
    const periodStart = getActivePeriodStart();
    return fetchAllRows(
      () => {
        let query = costingFrom("v_costing_manual_rate_manager_action_queue")
          .select("*");
        if (periodStart) {
          query = query.eq("period_start", periodStart);
        }
        return query
          .order("priority_sort", { ascending: true })
          .order("material_issue_code", { ascending: true })
          .order("stock_item_name", { ascending: true });
      },
      1000,
    );
  }

  function getTableHeaders(lensId) {
    if (lensId === "rm-cost-trace") {
      return MANUAL_RATE_HEADERS_BY_TAB["rm-cost-trace"];
    }
    if (lensId !== "manual-rate-manager") return null;
    return (
      MANUAL_RATE_HEADERS_BY_TAB[manualRateManagerTab] ||
      MANUAL_RATE_HEADERS_BY_TAB["action-queue"]
    );
  }

  function getTableAlignments(lensId) {
    if (lensId === "rm-cost-trace") {
      return MANUAL_RATE_ALIGNMENTS_BY_TAB["rm-cost-trace"];
    }
    if (lensId !== "manual-rate-manager") return null;
    return (
      MANUAL_RATE_ALIGNMENTS_BY_TAB[manualRateManagerTab] ||
      MANUAL_RATE_ALIGNMENTS_BY_TAB["action-queue"]
    );
  }

  function renderTableRow(lensId, row, trAttrs) {
    if (lensId === "rm-cost-trace") {
      const expansionTitle = row.expansion_note
        ? ` title="${text(row.expansion_note, "")}"`
        : "";
      return `<tr ${trAttrs}>
        <td>${text(row.stock_item_code)}</td>
        <td>${cpCellPrimary(row.stock_item_name || row.stock_item_id)}</td>
        <td>${text(row.product_name || row.product_id)}</td>
        <td>${text(row.sku_column_label || row.sku_id)}</td>
        <td class="c-right">${formatNumber(row.sku_quantity)}</td>
        <td>${text(row.quantity_uom)}</td>
        <td class="c-right">${formatMoney(row.selected_rate)}</td>
        <td>${text(row.rate_source)}</td>
        <td>${formatDate(row.rate_date)}</td>
        <td class="c-right">${formatMoney(row.rm_line_cost)}</td>
        <td class="c-right">${formatPercent(row.contribution_share_percent)}</td>
        <td>${compactStatusText(row.review_state)}</td>
        <td>${formatRmWarningCell(row)}</td>
        <td${expansionTitle}>${text(row.semi_process_source)}</td>
      </tr>`;
    }

    if (lensId !== "manual-rate-manager") return null;

    if (manualRateManagerTab === "register") {
      return `<tr ${trAttrs}>
        <td class="lane-col"><span class="lane ${laneClass(row)}"></span></td>
        <td>
          ${cpCellPrimary(row.stock_item_name || row.stock_item_id)}
          <div class="cp-muted-text">${text(row.stock_item_code || "")}</div>
        </td>
        <td class="c-right">${formatMoney(row.rate_value)}</td>
        <td>${formatDate(row.effective_from)}</td>
        <td>${formatDate(row.effective_to)}</td>
        <td>${statusChip(row.status)}</td>
        <td>${compactStatusText(row.register_status)}</td>
        <td class="c-right">${formatMoney(row.latest_purchase_rate)}</td>
        <td>${formatDate(row.latest_purchase_date)}</td>
        <td>${text(row.recommended_action)}</td>
        <td class="c-center">
          ${
            normalizeStatus(row.status) === "ACTIVE"
              ? `<button
                  type="button"
                  class="icon-btn cp-danger-icon-btn"
                  data-manager-close-manual-rate-id="${text(row.manual_rate_id)}"
                  title="Close Manual Rate"
                  aria-label="Close Manual Rate"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M9 9l6 6"></path>
                    <path d="M15 9l-6 6"></path>
                  </svg>
                </button>`
              : '<span class="cp-muted-text">--</span>'
          }
        </td>
      </tr>`;
    }

    if (manualRateManagerTab === "history") {
      return `<tr ${trAttrs}>
        <td class="lane-col"><span class="lane ${laneClass(row)}"></span></td>
        <td>${text(row.manual_rate_id)}</td>
        <td>
          ${cpCellPrimary(row.stock_item_name || row.stock_item_id)}
          <div class="cp-muted-text">${text(row.stock_item_code || "")}</div>
        </td>
        <td class="c-right">${formatMoney(row.rate_value)}</td>
        <td>${formatDate(row.effective_from)}</td>
        <td>${formatDate(row.effective_to)}</td>
        <td>${statusChip(row.status)}</td>
        <td>${text(row.reason)}</td>
        <td>${formatDateTime(row.created_at)}</td>
        <td>${formatDateTime(row.last_updated_at)}</td>
      </tr>`;
    }

    return `<tr ${trAttrs}>
      <td class="lane-col"><span class="lane ${laneClass(row)}"></span></td>
      <td>${compactStatusText(row.manager_action_code)}</td>
      <td>${text(issueCodeLabel(row.material_issue_code))}</td>
      <td>
        ${cpCellPrimary(row.stock_item_name || row.stock_item_id)}
        <div class="cp-muted-text">${text(row.stock_item_code || "")}</div>
      </td>
      <td class="c-right">${formatMoney(row.selected_rate)}</td>
      <td>${text(row.rate_source)}</td>
      <td class="c-right">${formatMoney(row.latest_purchase_rate)}</td>
      <td class="c-right">${formatNumber(row.affected_product_count)}</td>
      <td class="c-right">${formatNumber(row.affected_sku_count)}</td>
      <td>${text(row.recommended_action)}</td>
    </tr>`;
  }

  function renderManualRateManagerTabs(workbenchSummaryEl, onTabChange) {
    if (!workbenchSummaryEl) return;

    if (getCurrentLens() !== "manual-rate-manager") {
      return;
    }

    const tabs = [
      ["action-queue", "Action Queue"],
      ["register", "Register"],
      ["history", "History"],
    ];

    workbenchSummaryEl.classList.add("is-visible");
    workbenchSummaryEl.innerHTML = `
    <div class="cp-workbench-compact-summary" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
      ${tabs
        .map(
          ([id, label]) => `
            <button
              type="button"
              class="cp-workbench-summary-card cp-manager-tab-card ${manualRateManagerTab === id ? "active" : ""}"
              data-manual-rate-manager-tab="${id}"
            >
              <div class="cp-card-label">${text(label)}</div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

    workbenchSummaryEl
      .querySelectorAll("[data-manual-rate-manager-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const nextTab = btn.dataset.manualRateManagerTab;
          if (!nextTab || nextTab === manualRateManagerTab) return;

          manualRateManagerTab = nextTab;
          await onTabChange(nextTab);
        });
      });
  }

  function wireManualRateManagerTableActions(tableBody, getViewRow) {
    if (manualRateManagerTab !== "register") return;

    tableBody
      .querySelectorAll("[data-manager-close-manual-rate-id]")
      .forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();

          const manualRateId = btn.dataset.managerCloseManualRateId;
          const row = getViewRow((r) =>
            String(r.manual_rate_id) === String(manualRateId),
          );

          if (row) openManualRateCloseModal(row);
        });
      });
  }

  function getManualRateManagerDrawerConfig(row, preferredTab) {
    const title =
      row.stock_item_name || row.stock_item_id || "Manual Rate Manager";

    const subtitle = row.material_issue_code
      ? issueCodeLabel(row.material_issue_code)
      : row.register_status || row.status || "";

    let managerTabs = [];

    if (manualRateManagerTab === "action-queue") {
      managerTabs = [
        { id: "resolve", label: "Resolve" },
        { id: "manual-rate-register", label: "Register" },
        { id: "manual-rate-history", label: "History" },
        { id: "affected-products", label: "Affected Products/SKUs" },
        { id: "raw-lines", label: "Raw Issue Lines" },
      ];
    } else if (manualRateManagerTab === "register") {
      managerTabs = [
        { id: "manual-rate-action", label: "Action" },
        { id: "manual-rate-register", label: "Register" },
        { id: "manual-rate-history", label: "History" },
      ];
    } else {
      managerTabs = [
        { id: "manual-rate-register", label: "Register" },
        { id: "manual-rate-history", label: "History" },
      ];
    }

    let requestedTab = preferredTab;
    if (requestedTab === "manual-rate-action") {
      requestedTab = manualRateManagerTab === "action-queue" ? "resolve" : "manual-rate-action";
    }

    const validPreferred = managerTabs.some((t) => t.id === requestedTab)
      ? requestedTab
      : managerTabs[0].id;

    return {
      title,
      subtitle,
      tabs: managerTabs,
      activeTab: validPreferred,
    };
  }

  function wireMaterialWorkbenchDrawerActions(tabId, lensId) {
    if (
      lensId === "costing-review-workbench" &&
      (tabId === "resolve" || tabId === "summary")
    ) {
      wireMaterialIssueResolveActions(lensId);
      return;
    }

    if (
      lensId === "manual-rate-manager" &&
      manualRateManagerTab === "action-queue" &&
      (tabId === "resolve" || tabId === "manual-rate-action")
    ) {
      wireMaterialIssueResolveActions(lensId);
      return;
    }

    if (tabId === "action" || tabId === "manual-rate-action") {
      document
        .getElementById("setManualRateBtn")
        ?.addEventListener("click", () => {
          const selectedRow = getSelectedRow();
          if (selectedRow) openManualRateEditModal(selectedRow);
        });
    }

    if (
      lensId === "costing-review-workbench" &&
      (tabId === "summary" || tabId === "action")
    ) {
      wireMaterialReviewAcceptanceDrawerActions();
    }
  }

  function syncSelectedWorkbenchRow(selectedRow, allRows) {
    if (!selectedRow) return null;

    if (getCurrentLens() === "costing-review-workbench") {
      const selectedKey = materialReviewAcceptanceKey(selectedRow);
      const updated = allRows.find(
        (row) => materialReviewAcceptanceKey(row) === selectedKey,
      );
      return updated || selectedRow;
    }

    const key = selectedRow.stock_item_id;
    if (key != null) {
      const updated = allRows.find(
        (row) => String(row.stock_item_id) === String(key),
      );
      if (updated) return updated;
    }

    return selectedRow;
  }

  function handleEscapeKey() {
    const advancedPanel = document.getElementById("rmTraceAdvancedPanel");
    if (advancedPanel?.classList.contains("open")) {
      closeRmTraceAdvancedPanel();
      return true;
    }
    if (!manualRateEditModal?.classList.contains("hidden")) {
      closeManualRateEditModal();
      return true;
    }
    if (!manualRateCloseModal?.classList.contains("hidden")) {
      closeManualRateCloseModal();
      return true;
    }
    if (!materialReviewAcceptModal?.classList.contains("hidden")) {
      closeMaterialReviewAcceptModal();
      return true;
    }
    if (!materialReviewCloseAcceptanceModal?.classList.contains("hidden")) {
      closeMaterialReviewCloseAcceptanceModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    bindRmTraceFilterEvents();

    manualRateEditCloseBtn?.addEventListener("click", closeManualRateEditModal);
    manualRateEditCancelBtn?.addEventListener("click", closeManualRateEditModal);
    manualRateEditSaveBtn?.addEventListener("click", saveManualRateEdit);
    manualRateEditModal?.addEventListener("click", (e) => {
      if (e.target === manualRateEditModal) closeManualRateEditModal();
    });
    [manualRateValue, manualRateReason, manualRateEffectiveFrom].forEach(
      (input) => {
        input?.addEventListener("input", setManualRateSaveState);
      },
    );

    manualRateCloseCloseBtn?.addEventListener("click", closeManualRateCloseModal);
    manualRateCloseCancelBtn?.addEventListener("click", closeManualRateCloseModal);
    manualRateCloseSaveBtn?.addEventListener("click", saveManualRateClose);
    manualRateCloseModal?.addEventListener("click", (e) => {
      if (e.target === manualRateCloseModal) closeManualRateCloseModal();
    });
    [manualRateCloseReason, manualRateCloseEffectiveTo].forEach((input) => {
      input?.addEventListener("input", setManualRateCloseSaveState);
    });

    [materialReviewAcceptReason, materialReviewAcceptNote].forEach((input) => {
      input?.addEventListener("input", setMaterialReviewAcceptSaveState);
    });
    materialReviewAcceptCloseBtn?.addEventListener(
      "click",
      closeMaterialReviewAcceptModal,
    );
    materialReviewAcceptCancelBtn?.addEventListener(
      "click",
      closeMaterialReviewAcceptModal,
    );
    materialReviewAcceptSaveBtn?.addEventListener(
      "click",
      saveMaterialReviewAcceptance,
    );
    materialReviewAcceptModal?.addEventListener("click", (e) => {
      if (e.target === materialReviewAcceptModal) {
        closeMaterialReviewAcceptModal();
      }
    });

    materialReviewCloseReason?.addEventListener(
      "input",
      setMaterialReviewCloseAcceptanceSaveState,
    );
    materialReviewCloseAcceptanceCloseBtn?.addEventListener(
      "click",
      closeMaterialReviewCloseAcceptanceModal,
    );
    materialReviewCloseAcceptanceCancelBtn?.addEventListener(
      "click",
      closeMaterialReviewCloseAcceptanceModal,
    );
    materialReviewCloseAcceptanceSaveBtn?.addEventListener(
      "click",
      saveMaterialReviewCloseAcceptance,
    );
    materialReviewCloseAcceptanceModal?.addEventListener("click", (e) => {
      if (e.target === materialReviewCloseAcceptanceModal) {
        closeMaterialReviewCloseAcceptanceModal();
      }
    });
  }

  return {
    bindEvents,
    handleEscapeKey,
    getManualRateManagerTab,
    setManualRateManagerTab,
    loadManualRateManagerRows,
    loadRmCostTraceRows,
    loadMaterialReviewAcceptanceRegister,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    renderManualRateManagerTabs,
    wireManualRateManagerTableActions,
    getManualRateManagerDrawerConfig,
    renderMaterialWorkbenchTab,
    wireMaterialWorkbenchDrawerActions,
    openManualRateEditModal,
    closeManualRateEditModal,
    openManualRateCloseModal,
    closeManualRateCloseModal,
    openMaterialReviewAcceptModal,
    closeMaterialReviewAcceptModal,
    openMaterialReviewCloseAcceptanceModal,
    closeMaterialReviewCloseAcceptanceModal,
    syncSelectedWorkbenchRow,
    renderMaterialEvidencePanel,
    buildMaterialEvidenceSection,
    normalizeMaterialIssueCodes,
    getPrimaryMaterialIssueCode,
    getMaterialIssueGuidance,
    classifyMaterialIssue,
    enrichMaterialIssueEvidence,
    renderMaterialIssueResolvePanel,
    wireMaterialIssueResolveActions,
    loadWorkbenchMatchIndex,
    findWorkbenchRowForMaterialIssue,
    applyTraceLaunchContext,
    syncRmTraceChrome,
    syncTracePageFromShell,
    getTracePage,
    getTraceTotalCount,
    getTraceLoadState,
    getTraceErrorMessage,
    exportRmCostTraceCsv,
  };
}
