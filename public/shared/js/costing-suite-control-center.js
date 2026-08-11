import {
  formatFirstControlStatusLabel,
  formatRecommendedUiRouteLabel,
  resolveRecommendedUiRouteTarget,
  resolveSkuControlPrimaryMessage,
  resolveSkuControlSecondaryMaterialMessage,
} from "./costing-suite-recommended-ui-route.js";

export const CONTROL_CENTER_LENS_IDS = [
  "dashboard",
  "costing-review-workbench",
  "sku-control-status",
];

export function isControlCenterLens(lensId) {
  return CONTROL_CENTER_LENS_IDS.includes(lensId);
}

/** Session cache key: exact frozen evidence belongs to period + product + SKU. */
export function buildSkuExactEvidenceCacheKey({
  periodStart,
  productId,
  skuId,
} = {}) {
  return `${periodStart || ""}|${productId ?? ""}|${skuId ?? ""}`;
}

/** Session cache key: current foundation diagnosis is live master data (no period). */
export function buildSkuFoundationDiagnosisCacheKey({
  productId,
  skuId,
} = {}) {
  return `${productId ?? ""}|${skuId ?? ""}`;
}

export function isUnverifiedFoundationRoute(routeCode) {
  const normalized = String(routeCode || "")
    .trim()
    .toUpperCase();
  return (
    normalized === "RM_BOM_MANAGEMENT" ||
    normalized === "PM_REQUIREMENT_MANAGEMENT"
  );
}

export function formatFoundationStatusLabel(statusCode) {
  const normalized = String(statusCode || "")
    .trim()
    .toUpperCase();
  const labels = {
    MISSING_RM_BOM: "Missing RM BOM",
    EMPTY_RM_BOM: "Empty RM BOM",
    RM_FOUNDATION_PRESENT: "Present",
    MISSING_PM_REQUIREMENT: "Missing PM requirement",
    PM_FOUNDATION_PRESENT: "Present",
    NOT_EVALUATED_NO_SKU: "Not evaluated (no SKU)",
    MISSING_RM_AND_PM_FOUNDATION: "Missing RM and PM foundation",
    FOUNDATION_PRESENT: "Present",
  };
  return labels[normalized] || (normalized ? normalized.replaceAll("_", " ") : "—");
}

export function formatSkuEvidenceAreaLabel(line) {
  const area = String(line?.material_area || line?.frozen_source_type || "")
    .trim()
    .toUpperCase();
  if (area === "PM" || area.startsWith("PM_")) return "PM";
  if (area === "RM" || area.startsWith("RM_")) return "RM";
  return area || "—";
}

export function formatMaterialIssueLabel(issueCode) {
  const code = String(issueCode || "").trim().toUpperCase();
  const labels = {
    STALE_RM_PURCHASE_RATE: "Stale purchase rate",
    STALE_PM_PURCHASE_RATE: "Stale purchase rate",
    STALE_PURCHASE_RATE: "Stale purchase rate",
    PM_STOCK_VALUATION_FALLBACK: "Stock valuation fallback",
    STOCK_VALUATION_FALLBACK: "Stock valuation fallback",
    MISSING_MATERIAL_RATE: "Missing material rate",
    MANUAL_RATE_USED: "Manual rate used",
  };
  if (labels[code]) return labels[code];
  if (!code) return "—";
  return code
    .replace(/^PM_/, "")
    .replace(/^RM_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatMaterialWarningLabel(warningCode) {
  const code = String(warningCode || "").trim().toUpperCase();
  const labels = {
    STALE_PURCHASE_RATE: "Stale purchase rate",
    STALE_RM_PURCHASE_RATE: "Stale purchase rate",
    STALE_PM_PURCHASE_RATE: "Stale purchase rate",
    STOCK_VALUATION_FALLBACK: "Stock valuation fallback",
    PM_STOCK_VALUATION_FALLBACK: "Stock valuation fallback",
    MANUAL_RATE_USED: "Manual rate used",
    MISSING_MATERIAL_RATE: "Missing material rate",
    RATE_WARNING: "Rate warning",
    CALCULATION_WARNING: "Calculation warning",
  };
  if (labels[code]) return labels[code];
  if (!code) return "—";
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

let evidenceDisclosureSeq = 0;

export function ensureAnchoredDisclosureWiring() {
  if (typeof document === "undefined" || document.__cpAnchoredDisclosureWired) {
    return;
  }
  document.__cpAnchoredDisclosureWired = true;
  const canHover =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover)").matches;

  function clearPopoverPlacement(panel) {
    if (!panel) return;
    panel.style.position = "";
    panel.style.top = "";
    panel.style.left = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.zIndex = "";
    panel.style.maxWidth = "";
    panel.style.width = "";
    panel.style.boxSizing = "";
    panel.style.whiteSpace = "";
  }

  function placePopover(trigger, panel) {
    if (!trigger || !panel || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const isAudit = panel.classList.contains("cp-anchored-popover--audit");
    const maxWidth = Math.min(isAudit ? 420 : 360, window.innerWidth - 16);
    panel.style.position = "fixed";
    panel.style.zIndex = "6000";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.boxSizing = "border-box";
    panel.style.width = `${maxWidth}px`;
    panel.style.maxWidth = `${maxWidth}px`;
    panel.style.whiteSpace = "normal";
    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - maxWidth - 8))}px`;
    panel.style.top = `${rect.bottom + gap}px`;
    const pr = panel.getBoundingClientRect();
    if (pr.bottom > window.innerHeight - 8) {
      panel.style.top = `${Math.max(8, rect.top - pr.height - gap)}px`;
    }
    if (pr.right > window.innerWidth - 8) {
      panel.style.left = `${Math.max(8, window.innerWidth - pr.width - 8)}px`;
    }
  }

  function setOpen(wrap, open, mode) {
    if (!wrap) return;
    const trigger = wrap.querySelector("[data-cp-disclosure-trigger]");
    const panel = wrap.querySelector("[data-cp-disclosure-panel]");
    wrap.classList.toggle("is-open", open && mode === "open");
    wrap.classList.toggle("is-preview", open && mode === "preview");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (panel) {
      if (open) {
        panel.removeAttribute("hidden");
        placePopover(trigger, panel);
      } else {
        panel.setAttribute("hidden", "");
        clearPopoverPlacement(panel);
      }
    }
  }

  function closeAll(except = null) {
    document
      .querySelectorAll(
        ".cp-anchored-disclosure.is-open, .cp-anchored-disclosure.is-preview",
      )
      .forEach((wrap) => {
        if (except && wrap === except) return;
        setOpen(wrap, false);
      });
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-cp-disclosure-trigger]");
    if (trigger) {
      const wrap = trigger.closest(".cp-anchored-disclosure");
      if (!wrap) return;
      event.preventDefault();
      event.stopPropagation();
      const wasOpen = wrap.classList.contains("is-open");
      closeAll();
      if (!wasOpen) setOpen(wrap, true, "open");
      return;
    }
    if (!event.target.closest?.(".cp-anchored-disclosure")) closeAll();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });

  document.addEventListener(
    "scroll",
    () => {
      closeAll();
    },
    true,
  );
  window.addEventListener("resize", () => {
    closeAll();
  });

  document.addEventListener("focusin", (event) => {
    const wrap = event.target.closest?.(".cp-anchored-disclosure");
    if (!wrap || wrap.classList.contains("is-open")) return;
    closeAll(wrap);
    setOpen(wrap, true, "preview");
  });

  document.addEventListener("focusout", (event) => {
    const wrap = event.target.closest?.(".cp-anchored-disclosure");
    if (!wrap || wrap.classList.contains("is-open")) return;
    const next = event.relatedTarget;
    if (next && wrap.contains(next)) return;
    setOpen(wrap, false);
  });

  if (canHover) {
    document.addEventListener("pointerover", (event) => {
      const wrap = event.target.closest?.(".cp-anchored-disclosure");
      if (!wrap || wrap.classList.contains("is-open")) return;
      setOpen(wrap, true, "preview");
    });
    document.addEventListener("pointerout", (event) => {
      const wrap = event.target.closest?.(".cp-anchored-disclosure");
      if (!wrap || wrap.classList.contains("is-open")) return;
      const next = event.relatedTarget;
      if (next && wrap.contains(next)) return;
      setOpen(wrap, false);
    });
  }
}

export function buildMaterialEvidenceGroupKey(line) {
  return [
    formatSkuEvidenceAreaLabel(line),
    line?.stock_item_id ?? "",
    line?.material_issue_code ?? "",
    line?.warning_code ?? "",
    line?.warning_text ?? "",
    line?.selected_rate ?? "",
    line?.rate_source ?? "",
    line?.rate_date ?? "",
    line?.approval_block_flag === true ? "1" : "0",
    line?.product_id ?? "",
    line?.sku_id ?? "",
  ].join("|");
}

export function groupMaterialEvidenceLines(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const groups = [];
  const indexByKey = new Map();
  for (const row of list) {
    const key = buildMaterialEvidenceGroupKey(row);
    if (indexByKey.has(key)) {
      groups[indexByKey.get(key)].members.push(row);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({ key, members: [row] });
  }
  return groups;
}

export function canShareMaterialEvidenceTraceTarget(members) {
  const list = Array.isArray(members) ? members.filter(Boolean) : [];
  if (!list.length) return false;
  const first = list[0];
  const area = formatSkuEvidenceAreaLabel(first);
  const stockItemId = first?.stock_item_id;
  const periodStart = first?.period_start;
  const productId = first?.product_id;
  const skuId = first?.sku_id;
  if (stockItemId == null || productId == null || skuId == null) return false;
  return list.every((line) => {
    return (
      formatSkuEvidenceAreaLabel(line) === area &&
      String(line?.stock_item_id) === String(stockItemId) &&
      String(line?.period_start || "") === String(periodStart || "") &&
      String(line?.product_id) === String(productId) &&
      String(line?.sku_id) === String(skuId)
    );
  });
}

export function buildWorkbenchEvidenceHierarchy(rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const productIds = new Set();
  const skuIds = new Set();
  const subgroupMap = new Map();

  for (const row of list) {
    if (row.product_id != null) productIds.add(String(row.product_id));
    if (row.sku_id != null) skuIds.add(String(row.sku_id));
    const key = [
      row?.period_start ?? "",
      formatSkuEvidenceAreaLabel(row),
      row?.stock_item_id ?? "",
      row?.product_id ?? "",
      row?.sku_id ?? "",
    ].join("|");
    if (!subgroupMap.has(key)) {
      subgroupMap.set(key, {
        key,
        period_start: row?.period_start ?? null,
        material_area: formatSkuEvidenceAreaLabel(row),
        stock_item_id: row?.stock_item_id ?? null,
        product_id: row?.product_id ?? null,
        product_name: row?.product_name || null,
        sku_id: row?.sku_id ?? null,
        pack_size: row?.pack_size ?? null,
        pack_uom: row?.pack_uom ?? null,
        sku_label:
          row?.sku_column_label ||
          [row?.pack_size, row?.pack_uom].filter(Boolean).join(" ") ||
          (row?.sku_id != null ? `SKU ${row.sku_id}` : "—"),
        members: [],
      });
    }
    subgroupMap.get(key).members.push(row);
  }

  const subgroups = [...subgroupMap.values()].sort((a, b) => {
    const productCmp = String(a.product_name || "").localeCompare(
      String(b.product_name || ""),
    );
    if (productCmp) return productCmp;
    return Number(a.sku_id) - Number(b.sku_id);
  });

  const first = list[0] || null;
  return {
    rawRows: list,
    frozenLineCount: list.length,
    productCount: productIds.size,
    skuCount: skuIds.size,
    representative: first,
    materialArea: formatSkuEvidenceAreaLabel(first),
    stockItemId: first?.stock_item_id ?? null,
    stockItemName: first?.stock_item_name || null,
    stockItemCode: first?.stock_item_code || null,
    subgroups,
  };
}

const HEADERS_BY_LENS = {
  dashboard: [
    "Period",
    "Costing Readiness",
    "Costing Risk",
    "Policy Coverage",
    "Scheme / Margin Risk",
    "Workbench Actions",
    "Last Refresh",
  ],
  "costing-review-workbench": [
    "Material",
    "Area",
    "Severity",
    "Route",
    "Affected Lines",
    "Affected Products",
    "Affected SKUs",
    "Blocking SKUs",
    "Review SKUs",
    "Action Note",
    "Snapshot Refreshed",
  ],
  "sku-control-status": [
    "Product",
    "SKU",
    "Pack",
    "Status",
    "Primary Control",
    "Recommended Route",
  ],
};

const ALIGNMENTS_BY_LENS = {
  dashboard: [
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ],
  "costing-review-workbench": [
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
  ],
  "sku-control-status": [
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ],
};

export function createControlCenterController(deps) {
  const {
    dom: { kpiStrip, workbenchSummary },
    costingFrom,
    fetchAllRows,
    text,
    escapeHtml,
    formatNumber,
    formatMoney,
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
    getActivePeriodStart,
    getSelectedRow,
    drillToLens,
    drillToPricingPolicyWorkspace,
    navigateToCostingRoute,
    costingRpc,
  } = deps;

  let DASHBOARD_SUMMARY = null;
  let BUSINESS_KPI_SUMMARY = null;
  let CONTROL_DASHBOARD_SUMMARY = null;
  let CONTROL_AUDIT_ROWS = [];
  let LAST_WORKBENCH_LINE_EVIDENCE_ROWS = [];
  let LAST_SKU_EXACT_EVIDENCE_ROWS = [];
  const SKU_EXACT_EVIDENCE_CACHE = new Map();
  const SKU_FOUNDATION_DIAGNOSIS_CACHE = new Map();

  function coverageValue(done, total) {
    return `${formatNumber(done)} / ${formatNumber(total)}`;
  }

  function riskTotal(...values) {
    return values.reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function firstValue(...values) {
    return values.find(
      (value) => value !== null && value !== undefined && value !== "",
    );
  }

  function firstNumber(...values) {
    const value = firstValue(...values);
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function getSummaryContext() {
    const control = CONTROL_DASHBOARD_SUMMARY || {};
    const business = BUSINESS_KPI_SUMMARY || {};
    const legacy = DASHBOARD_SUMMARY || {};
    return { control, business, legacy };
  }

  async function loadDashboardSummary(periodStart) {
    const { data, error } = await costingFrom("v_costing_pricing_dashboard_summary")
      .select("*")
      .eq("period_start", periodStart)
      .limit(1);
    if (error) throw error;
    DASHBOARD_SUMMARY = data?.[0] || null;
  }

  async function loadBusinessKpiSummary(periodStart) {
    const { data, error } = await costingFrom(
      "v_costing_pricing_business_kpi_summary",
    )
      .select("*")
      .eq("period_start", periodStart)
      .limit(1);
    if (error) throw error;
    BUSINESS_KPI_SUMMARY = data?.[0] || null;
  }

  async function loadControlDashboardSummary(periodStart) {
    const { data, error } = await costingFrom(
      "v_costing_pricing_control_dashboard_snapshot",
    )
      .select("*")
      .eq("period_start", periodStart)
      .limit(1);
    if (error) throw error;
    CONTROL_DASHBOARD_SUMMARY = data?.[0] || null;
  }

  async function loadControlAuditSnapshot(periodStart) {
    CONTROL_AUDIT_ROWS = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_control_integrity_audit_snapshot")
          .select("*")
          .eq("period_start", periodStart),
      1000,
    );
  }

  async function loadGlobalSummaries(periodStart) {
    await loadDashboardSummary(periodStart);
    await loadBusinessKpiSummary(periodStart);
    await loadControlDashboardSummary(periodStart);
    await loadControlAuditSnapshot(periodStart);
    renderKpiStrip();
  }

  async function loadDashboardRows(periodStart) {
    void periodStart;
    return CONTROL_DASHBOARD_SUMMARY ? [CONTROL_DASHBOARD_SUMMARY] : [];
  }

  async function loadWorkbenchRows(periodStart, materialCostCtrl) {
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
      materialCostCtrl.loadMaterialReviewAcceptanceRegister(periodStart),
    ]);

    const rows = [...(queueRows || [])];
    rows.sort((a, b) => {
      const severityRank = { BLOCKER: 0, REVIEW_REQUIRED: 1 };
      const left = severityRank[normalizeStatus(a.action_severity)] ?? 99;
      const right = severityRank[normalizeStatus(b.action_severity)] ?? 99;
      return left - right;
    });
    return rows;
  }

  function clearSkuExactEvidenceCache() {
    SKU_EXACT_EVIDENCE_CACHE.clear();
    LAST_SKU_EXACT_EVIDENCE_ROWS = [];
  }

  function clearSkuFoundationDiagnosisCache() {
    SKU_FOUNDATION_DIAGNOSIS_CACHE.clear();
  }

  function clearSkuControlSessionCaches() {
    clearSkuExactEvidenceCache();
    clearSkuFoundationDiagnosisCache();
  }

  async function loadSkuControlStatusRows(periodStart) {
    if (!periodStart) return [];
    clearSkuExactEvidenceCache();
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_sku_control_status_snapshot")
          .select("*")
          .eq("period_start", periodStart)
          .order("control_severity", { ascending: true })
          .order("product_name", { ascending: true })
          .order("sku_id", { ascending: true }),
      1000,
    );
    const list = [...(rows || [])];
    const severityRank = { BLOCKER: 0, REVIEW_REQUIRED: 1, READY: 2 };
    list.sort((a, b) => {
      const left = severityRank[normalizeStatus(a.control_severity)] ?? 99;
      const right = severityRank[normalizeStatus(b.control_severity)] ?? 99;
      if (left !== right) return left - right;
      const productCmp = String(a.product_name || "").localeCompare(
        String(b.product_name || ""),
      );
      if (productCmp) return productCmp;
      return Number(a.sku_id) - Number(b.sku_id);
    });
    return list;
  }

  function renderKpiStrip() {
    if (!kpiStrip) return;

    const periodStart = getActivePeriodStart();
    if (periodStart && !CONTROL_DASHBOARD_SUMMARY) {
      kpiStrip.innerHTML = `<div class="status" style="padding:4px 6px">Control snapshot is not available for this period. Request Costing Refresh from the toolbar to rebuild costing snapshots and the control summary.</div>`;
      return;
    }

    const { control, business, legacy } = getSummaryContext();

    const totalSkus = firstNumber(
      control.total_sku_count,
      business.total_pricing_sku_count,
      legacy.pricing_bridge_sku_count,
    );

    const costingReadyCount = firstNumber(
      control.ready_sku_count,
      business.costing_ready_sku_count,
    );

    const costingBlockedCount = firstNumber(
      control.blocked_sku_count,
      business.costing_blocked_sku_count,
      legacy.pricing_bridge_blocked_count,
    );

    const costingReviewCount = firstNumber(
      control.review_required_sku_count,
      business.costing_review_sku_count,
      legacy.pricing_bridge_review_required_count,
    );

    const workbenchBlockedActions =
      firstNumber(control.rm_blocker_item_count) +
      firstNumber(control.pm_blocker_item_count);

    const workbenchReviewActions =
      firstNumber(control.rm_review_item_count) +
      firstNumber(control.pm_review_item_count);

    const workbenchActions = workbenchBlockedActions + workbenchReviewActions;

    const sellingPolicyComplete = firstNumber(
      business.selling_policy_complete_count,
      legacy.selling_price_sku_count,
    );

    const sellingPolicyMissing = firstNumber(
      business.selling_policy_missing_count,
    );

    const schemePolicyComplete = firstNumber(
      business.scheme_policy_complete_count,
    );

    const schemePolicyMissing = firstNumber(business.scheme_policy_missing_count);

    const schemeRiskRows = riskTotal(
      business.scheme_blocked_row_count,
      business.scheme_review_row_count,
      legacy.scheme_blocked_count,
      legacy.scheme_review_required_count,
    );

    const readyClass =
      costingReadyCount === totalSkus && totalSkus > 0
        ? "ready"
        : costingReadyCount > 0
          ? "review"
          : "blocked";

    const cards = [
      {
        label: "Costing Readiness",
        value: coverageValue(costingReadyCount, totalSkus),
        cls: readyClass,
        title:
          "SKUs that are ready for reliable cost sheet and pricing decisions.",
        action: "costing-ready",
      },
      {
        label: "Costing Blocked",
        value: costingBlockedCount,
        cls: costingBlockedCount > 0 ? "blocked" : "ready",
        title:
          "SKUs where costing cannot be approved until blocking issues are corrected.",
        action: "costing-blocked",
      },
      {
        label: "Costing Review",
        value: costingReviewCount,
        cls: costingReviewCount > 0 ? "review" : "ready",
        title: "SKUs where costing exists but requires review before use.",
        action: "costing-review",
      },
      {
        label: "Selling Policy Coverage",
        value: coverageValue(sellingPolicyComplete, totalSkus),
        cls: sellingPolicyMissing > 0 ? "review" : "ready",
        title: "SKUs with GST, discount, and contingency policy coverage.",
        action: "selling-policy",
      },
      {
        label: "Scheme Policy Coverage",
        value: coverageValue(schemePolicyComplete, totalSkus),
        cls: schemePolicyMissing > 0 ? "review" : "ready",
        title: "SKUs with selected scheme policy for both IK and OK.",
        action: "scheme-policy",
      },
      {
        label: "Scheme / Margin Risk",
        value: schemeRiskRows,
        cls: schemeRiskRows > 0 ? "review" : "ready",
        title: "Scheme viability rows that are blocked or require review.",
        action: "scheme-risk",
      },
      {
        label: "Workbench Actions",
        value: workbenchActions,
        cls:
          workbenchBlockedActions > 0
            ? "blocked"
            : workbenchActions > 0
              ? "review"
              : "ready",
        title: "Material/rate/valuation items requiring correction or review.",
        action: "workbench-actions",
      },
    ];

    kpiStrip.innerHTML = cards
      .map(
        ({ label, value, cls, title, action }) =>
          `<button
          type="button"
          class="kpi ${cls} cp-kpi-action"
          data-kpi-action="${escapeHtml(action)}"
          title="${escapeHtml(title || label)}"
        >
          <div>${text(label)}</div>
          <div>${typeof value === "number" ? formatNumber(value) : text(value)}</div>
        </button>`,
      )
      .join("");

    kpiStrip.querySelectorAll("[data-kpi-action]").forEach((card) => {
      card.addEventListener("click", () =>
        handleKpiAction(card.dataset.kpiAction),
      );
    });
  }

  async function handleKpiAction(action) {
    try {
      if (action === "costing-ready") {
        await drillToLens("sku-cost-sheet", { status: ["READY"] });
        return;
      }

      if (action === "costing-blocked") {
        await drillToLens("sku-control-status", { status: ["BLOCKER"] });
        return;
      }

      if (action === "costing-review") {
        await drillToLens("costing-review-workbench", {
          status: ["REVIEW_REQUIRED"],
        });
        return;
      }

      if (action === "selling-policy") {
        await drillToPricingPolicyWorkspace("sku-overview", {
          status: [],
          issue: [],
          source: [],
        });
        showToast(
          "Pricing Policy Manager opened. Use SKU Policy Overview to review missing selling policy rows.",
          "info",
          5000,
        );
        return;
      }

      if (action === "scheme-policy") {
        await drillToPricingPolicyWorkspace("sku-overview", {
          status: [],
          issue: [],
          source: [],
        });
        showToast(
          "Pricing Policy Manager opened. Use SKU Policy Overview to review missing scheme policy rows.",
          "info",
          5000,
        );
        return;
      }

      if (action === "scheme-risk") {
        await drillToLens("scheme-comparison", {
          status: ["BLOCKED", "REVIEW_REQUIRED"],
        });
        return;
      }

      if (action === "workbench-actions") {
        await drillToLens("costing-review-workbench", {
          status: ["BLOCKER", "REVIEW_REQUIRED"],
        });
      }
    } catch (err) {
      handleError("Failed to open KPI drilldown", err);
    }
  }

  function getTableHeaders(lensId) {
    return HEADERS_BY_LENS[lensId] || null;
  }

  function getTableAlignments(lensId) {
    return ALIGNMENTS_BY_LENS[lensId] || null;
  }

  function renderDashboardTableRow(row, trAttrs) {
    const { control, business, legacy } = getSummaryContext();
    const totalSkus = firstNumber(
      control.total_sku_count,
      business.total_pricing_sku_count,
      legacy.pricing_bridge_sku_count,
    );
    const costingBlocked = firstNumber(
      control.blocked_sku_count,
      business.costing_blocked_sku_count,
      legacy.pricing_bridge_blocked_count,
    );
    const costingReview = firstNumber(
      control.review_required_sku_count,
      business.costing_review_sku_count,
      legacy.pricing_bridge_review_required_count,
    );
    const costingReady = firstNumber(
      control.ready_sku_count,
      business.costing_ready_sku_count,
      Math.max(totalSkus - costingBlocked - costingReview, 0),
    );
    const sellingComplete = firstNumber(
      business.selling_policy_complete_count,
      legacy.selling_price_sku_count,
    );
    const schemeComplete = firstNumber(business.scheme_policy_complete_count);
    const schemeRiskRows = riskTotal(
      business.scheme_blocked_row_count,
      business.scheme_review_row_count,
      legacy.scheme_blocked_count,
      legacy.scheme_review_required_count,
      legacy.scheme_viability_row_count,
    );
    const workbenchActions =
      firstNumber(control.rm_blocker_item_count) +
        firstNumber(control.pm_blocker_item_count) +
        firstNumber(control.rm_review_item_count) +
        firstNumber(control.pm_review_item_count) ||
      riskTotal(business.workbench_blocked_item_count, business.workbench_review_item_count);
    const refreshStatus =
      control.overall_control_status ||
      control.latest_refresh_status ||
      business.latest_refresh_status ||
      legacy.latest_refresh_status;
    const refreshFinished =
      control.snapshot_refreshed_at ||
      control.latest_refresh_finished_at ||
      business.latest_refresh_finished_at ||
      legacy.latest_refresh_finished_at;

    return `<tr ${trAttrs}>
      <td>
        <div class="cp-dashboard-main">${formatDate(row.period_start)}</div>
        <div class="cp-dashboard-sub">Active costing period</div>
      </td>
      <td>
        <div class="cp-dashboard-main">${coverageValue(costingReady, totalSkus)}</div>
        <div class="cp-dashboard-sub">Ready SKUs</div>
      </td>
      <td>
        <div class="cp-dashboard-main">${formatNumber(costingBlocked)} blocked</div>
        <div class="cp-dashboard-sub">${formatNumber(costingReview)} need review</div>
      </td>
      <td>
        <div class="cp-dashboard-main">Selling ${coverageValue(sellingComplete, totalSkus)}</div>
        <div class="cp-dashboard-sub">Scheme ${coverageValue(schemeComplete, totalSkus)}</div>
      </td>
      <td>
        <div class="cp-dashboard-main">${formatNumber(schemeRiskRows)} rows</div>
        <div class="cp-dashboard-sub">Blocked or review</div>
      </td>
      <td>
        <div class="cp-dashboard-main">${formatNumber(workbenchActions)} actions</div>
        <div class="cp-dashboard-sub">Material/rate issues</div>
      </td>
      <td>
        <div class="cp-dashboard-main">${statusChip(refreshStatus)}</div>
        <div class="cp-dashboard-sub">${formatDateTime(refreshFinished)}</div>
      </td>
    </tr>`;
  }

  function formatSkuPackLabel(row) {
    const skuId = row?.sku_id != null ? `SKU ${row.sku_id}` : "";
    const packBits = [row?.pack_size, row?.pack_uom].filter(
      (v) => v !== null && v !== undefined && v !== "",
    );
    const pack = packBits.length ? packBits.join(" ") : "";
    return [skuId, pack].filter(Boolean).join(" · ") || "--";
  }

  /** Main-grid SKU identity only — projection has sku_id, not a business SKU code. */
  function formatSkuControlSkuLabel(row) {
    return row?.sku_id != null ? `SKU ${row.sku_id}` : "--";
  }

  /** Main-grid Pack only — pack_size + pack_uom. */
  function formatSkuControlPackLabel(row) {
    const packBits = [row?.pack_size, row?.pack_uom].filter(
      (v) => v !== null && v !== undefined && v !== "",
    );
    return packBits.length ? packBits.join(" ") : "--";
  }

  /** Display-only SKU Control Status labels — raw control_severity unchanged. */
  function formatSkuControlStatusDisplayLabel(severity) {
    const s = normalizeStatus(severity);
    if (s === "BLOCKER" || s === "BLOCKED") return "Blocked";
    if (s === "REVIEW_REQUIRED" || s === "REVIEW") return "Review";
    if (s === "READY") return "Ready";
    return s || "--";
  }

  function renderSkuControlStatusTableRow(row, trAttrs) {
    const primaryLabel =
      formatFirstControlStatusLabel(row.first_control_status) ||
      row.first_control_status ||
      "--";
    const routeLabel =
      formatRecommendedUiRouteLabel(row.recommended_ui_route) || "--";
    const statusDisplay = formatSkuControlStatusDisplayLabel(
      row.control_severity,
    );
    const productLabel = row.product_name || row.product_id || "--";
    const skuLabel = formatSkuControlSkuLabel(row);
    const packLabel = formatSkuControlPackLabel(row);
    return `<tr ${trAttrs}>
    <td class="cp-sku-control-product" title="${text(productLabel, "")}">${cpCellPrimary(productLabel)}</td>
    <td class="cp-sku-control-sku" title="${text(skuLabel, "")}">${text(skuLabel)}</td>
    <td class="cp-sku-control-pack" title="${text(packLabel, "")}">${text(packLabel)}</td>
    <td class="cp-sku-control-status">${statusChip(statusDisplay)}</td>
    <td class="cp-sku-control-primary" title="${text(primaryLabel, "")}">${text(primaryLabel)}</td>
    <td class="cp-sku-control-route" title="${text(routeLabel, "")}">${text(routeLabel)}</td>
  </tr>`;
  }

  function renderWorkbenchTableRow(row, trAttrs) {
    return `<tr ${trAttrs}>
    <td>
      ${cpCellPrimary(row.stock_item_name || row.stock_item_id)}
      <div class="cp-muted-text">${text([row.stock_item_code, row.material_area].filter(Boolean).join(" / "))}</div>
    </td>
    <td>${text(row.material_area)}</td>
    <td>${statusChip(row.action_severity)}</td>
    <td>${text(row.recommended_ui_route)}</td>
    <td class="c-right">${formatNumber(row.affected_line_count)}</td>
    <td class="c-right">${formatNumber(row.affected_product_count)}</td>
    <td class="c-right">${formatNumber(row.affected_sku_count)}</td>
    <td class="c-right">${formatNumber(row.approval_blocking_sku_count)}</td>
    <td class="c-right">${formatNumber(row.review_sku_count)}</td>
    <td>${text(row.action_note_summary)}</td>
    <td>${formatDateTime(row.snapshot_refreshed_at)}</td>
  </tr>`;
  }

  function renderTableRow(lensId, row, trAttrs) {
    if (lensId === "dashboard") {
      return renderDashboardTableRow(row, trAttrs);
    }
    if (lensId === "costing-review-workbench") {
      return renderWorkbenchTableRow(row, trAttrs);
    }
    if (lensId === "sku-control-status") {
      return renderSkuControlStatusTableRow(row, trAttrs);
    }
    return "";
  }

  function renderWorkbenchSummary(_allRows, _lensId) {
    if (!workbenchSummary) return;
    workbenchSummary.classList.remove("is-visible");
    workbenchSummary.innerHTML = "";
  }

  function renderControlAuditSection() {
    if (!CONTROL_AUDIT_ROWS.length) {
      return `<div class="status" style="margin-top:12px">No control audit rows available for this period.</div>`;
    }

    return `
    <h3 class="cp-section-title" style="margin-top:12px">Control Snapshot Audit</h3>
    ${simpleTable(
      ["Check", "Status", "Observed", "Rule", "Note"],
      CONTROL_AUDIT_ROWS,
      (row) => `
        <tr>
          <td>${text(row.check_code)}</td>
          <td>${statusChip(row.check_status)}</td>
          <td class="c-right">${formatNumber(row.observed_count)}</td>
          <td>${text(row.expected_rule)}</td>
          <td>${text(row.diagnostic_note)}</td>
        </tr>
      `,
    )}
  `;
  }

  function renderDashboardSummaryTab() {
    const selected = getSelectedRow();
    const { control, business, legacy } = getSummaryContext();
    const row = selected || control;

    return detailPanel(
      [
        kvSection("Period", [
          [
            "Period",
            formatDate(
              row.period_start || business.period_start || legacy.period_start,
            ),
          ],
        ]),
        kvSection("SKU Readiness", [
          [
            "Pricing SKUs",
            formatNumber(
              firstNumber(
                control.total_sku_count,
                business.total_pricing_sku_count,
                legacy.pricing_bridge_sku_count,
              ),
            ),
          ],
          [
            "Costing Ready",
            formatNumber(
              firstNumber(
                control.ready_sku_count,
                business.costing_ready_sku_count,
              ),
            ),
          ],
          [
            "Pricing Blocked",
            formatNumber(
              firstNumber(
                control.blocked_sku_count,
                business.costing_blocked_sku_count,
                legacy.pricing_bridge_blocked_count,
              ),
            ),
          ],
          [
            "Pricing Review",
            formatNumber(
              firstNumber(
                control.review_required_sku_count,
                business.costing_review_sku_count,
                legacy.pricing_bridge_review_required_count,
              ),
            ),
          ],
        ]),
        kvSection("Policy Coverage", [
          [
            "Selling Price SKUs",
            formatNumber(
              firstNumber(
                business.selling_policy_complete_count,
                legacy.selling_price_sku_count,
              ),
            ),
          ],
          [
            "Scheme Rows",
            formatNumber(
              riskTotal(
                business.scheme_blocked_row_count,
                business.scheme_review_row_count,
                legacy.scheme_viability_row_count,
              ),
            ),
          ],
        ]),
        kvSection("Refresh", [
          [
            "Refresh Status",
            statusChip(
              control.latest_refresh_status ||
                control.overall_control_status ||
                business.latest_refresh_status ||
                legacy.latest_refresh_status,
            ),
          ],
          [
            "Refresh Scope",
            text(control.latest_refresh_scope || legacy.latest_refresh_scope),
          ],
          [
            "Finished At",
            formatDateTime(
              control.snapshot_refreshed_at ||
                control.latest_refresh_finished_at ||
                business.latest_refresh_finished_at ||
                legacy.latest_refresh_finished_at,
            ),
          ],
        ]),
      ],
      { columns: 2 },
    );
  }

  function renderDashboardMaterialImpactTab() {
    const { control, business } = getSummaryContext();

    return detailPanel([
      kvSection("Material Blockers & Review", [
        [
          "RM Blocker Items",
          formatNumber(firstNumber(control.rm_blocker_item_count)),
        ],
        [
          "PM Blocker Items",
          formatNumber(firstNumber(control.pm_blocker_item_count)),
        ],
        [
          "RM Review Items",
          formatNumber(firstNumber(control.rm_review_item_count)),
        ],
        [
          "PM Review Items",
          formatNumber(firstNumber(control.pm_review_item_count)),
        ],
      ]),
      kvSection("Workbench Impact", [
        [
          "Workbench Blocked Items",
          formatNumber(firstNumber(business.workbench_blocked_item_count)),
        ],
        [
          "Workbench Review Items",
          formatNumber(firstNumber(business.workbench_review_item_count)),
        ],
      ]),
    ]);
  }

  function renderDashboardIntegrityTab() {
    return renderControlAuditSection();
  }

  function renderDashboardDrawerTab(tabId) {
    if (tabId === "material-impact") {
      return renderDashboardMaterialImpactTab();
    }
    if (tabId === "integrity") {
      return renderDashboardIntegrityTab();
    }
    return renderDashboardSummaryTab();
  }

  function getDashboardDrawerConfig(preferredTab) {
    const tabs = [
      { id: "overview", label: "Summary" },
      { id: "material-impact", label: "Material Impact" },
      { id: "integrity", label: "Integrity Checks" },
    ];
    const active = tabs.some((tab) => tab.id === preferredTab)
      ? preferredTab
      : "overview";

    return {
      title: "Dashboard Summary",
      subtitle: "",
      tabs,
      activeTab: active,
    };
  }

  function formatReviewLineCountLabel(area, count) {
    const n = Number(count);
    const safe = Number.isFinite(n) && n > 0 ? n : 0;
    return `${area} — ${formatNumber(safe)} review line${safe === 1 ? "" : "s"}`;
  }

  function resolveTraceLensForMaterialArea(row) {
    const area = normalizeStatus(row?.material_area || row?.frozen_source_type);
    if (area === "PM" || area.startsWith("PM_")) return "pm-cost-trace";
    return "rm-cost-trace";
  }

  function resolveTraceComponentForMaterialArea(row) {
    return resolveTraceLensForMaterialArea(row) === "pm-cost-trace" ? "PM" : "RM";
  }

  async function loadWorkbenchLineEvidenceRows(row) {
    if (!row?.stock_item_id || !row?.material_area) return [];
    const periodStart = getActivePeriodStart();
    if (!periodStart) return [];

    if (
      row.action_severity != null &&
      row.action_severity !== "" &&
      row.recommended_ui_route != null &&
      row.recommended_ui_route !== ""
    ) {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_pricing_material_action_drilldown_snapshot")
            .select("*")
            .eq("period_start", periodStart)
            .eq("stock_item_id", row.stock_item_id)
            .eq("material_area", row.material_area)
            .eq("action_severity", row.action_severity)
            .eq("recommended_ui_route", row.recommended_ui_route)
            .order("product_name", { ascending: true })
            .order("sku_id", { ascending: true })
            .order("line_no", { ascending: true, nullsFirst: false }),
        1000,
      );
    }

    return fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_material_action_drilldown_snapshot")
          .select("*")
          .eq("period_start", periodStart)
          .eq("stock_item_id", row.stock_item_id)
          .eq("material_area", row.material_area)
          .order("product_name", { ascending: true })
          .order("sku_id", { ascending: true })
          .order("line_no", { ascending: true, nullsFirst: false }),
      1000,
    );
  }

  function renderAccessibleWarningDetail(line) {
    const code = String(line?.warning_code || "").trim();
    const warningText = String(line?.warning_text || "").trim();
    if (!code && !warningText) {
      return '<span class="cp-muted-text">--</span>';
    }
    ensureAnchoredDisclosureWiring();
    const label = formatMaterialWarningLabel(code || warningText);
    const panelId = `cp-evidence-warn-${++evidenceDisclosureSeq}`;
    return `
      <span class="cp-anchored-disclosure">
        <button
          type="button"
          class="cp-evidence-warning-chip"
          data-cp-disclosure-trigger="true"
          aria-expanded="false"
          aria-controls="${panelId}"
          aria-haspopup="dialog"
        >
          <span class="cp-evidence-warning-chip-label">${text(label)}</span>
        </button>
        <div
          id="${panelId}"
          class="cp-anchored-popover"
          role="dialog"
          data-cp-disclosure-panel="true"
          hidden
        >
          <div class="cp-anchored-popover-row">
            <div class="cp-muted-text">Code</div>
            <div>${text(code || "—")}</div>
          </div>
          <div class="cp-anchored-popover-row">
            <div class="cp-muted-text">Warning</div>
            <div>${text(warningText || "—")}</div>
          </div>
        </div>
      </span>
    `;
  }

  function renderEvidenceAreaChip(area) {
    return `<span class="cp-evidence-area-chip">${text(area || "—")}</span>`;
  }

  function renderFrozenLineAuditDetail(line) {
    return `
      <div class="cp-evidence-frozen-line">
        <div class="cp-anchored-popover-row">
          <div class="cp-muted-text">source_line_key</div>
          <div>${text(line?.source_line_key || "—")}</div>
        </div>
        <div class="cp-anchored-popover-row">
          <div class="cp-muted-text">frozen_rm_line_snapshot_id</div>
          <div>${text(line?.frozen_rm_line_snapshot_id ?? "—")}</div>
        </div>
        <div class="cp-anchored-popover-row">
          <div class="cp-muted-text">frozen_pm_line_snapshot_id</div>
          <div>${text(line?.frozen_pm_line_snapshot_id ?? "—")}</div>
        </div>
        <div class="cp-anchored-popover-row">
          <div class="cp-muted-text">bom_source</div>
          <div>${text(line?.bom_source || "—")}</div>
        </div>
        <div class="cp-anchored-popover-row">
          <div class="cp-muted-text">line_no</div>
          <div>${text(line?.line_no != null ? line.line_no : "—")}</div>
        </div>
        <div class="cp-anchored-popover-row">
          <div class="cp-muted-text">qty / reference</div>
          <div>${text(
            [
              line?.qty_per_reference_output != null
                ? formatNumber(line.qty_per_reference_output)
                : null,
              line?.uom_id != null ? `uom ${line.uom_id}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—",
          )}</div>
        </div>
      </div>
    `;
  }

  function renderWorkbenchAuditPopover(members) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    if (!list.length) return '<span class="cp-muted-text">—</span>';
    ensureAnchoredDisclosureWiring();
    const panelId = `cp-wb-audit-${++evidenceDisclosureSeq}`;
    const body =
      list.length === 1
        ? renderFrozenLineAuditDetail(list[0])
        : list
            .map(
              (member, idx) => `
            <div class="cp-evidence-group-member">
              <div class="cp-muted-text" style="margin-bottom:4px">Frozen line ${
                idx + 1
              }</div>
              ${renderFrozenLineAuditDetail(member)}
            </div>
          `,
            )
            .join("");
    return `
      <span class="cp-anchored-disclosure">
        <button
          type="button"
          class="icon-btn cp-wb-audit-btn"
          data-cp-disclosure-trigger="true"
          aria-expanded="false"
          aria-controls="${panelId}"
          aria-haspopup="dialog"
          aria-label="Audit frozen line identity"
          title="Audit"
        >Info</button>
        <div
          id="${panelId}"
          class="cp-anchored-popover cp-anchored-popover--audit"
          role="dialog"
          data-cp-disclosure-panel="true"
          hidden
        >
          ${body}
        </div>
      </span>
    `;
  }

  function renderMaterialEvidenceTraceButton({
    attrName,
    attrValue,
    area,
    disabled = false,
    buttonClass = "icon-btn cp-evidence-trace-btn",
  }) {
    const component = area === "PM" ? "PM" : "RM";
    const traceLabel =
      component === "PM" ? "Open PM Trace" : "Open RM Trace";
    if (disabled) {
      return '<span class="cp-muted-text">—</span>';
    }
    return `
      <button
        type="button"
        class="${escapeHtml(buttonClass)}"
        ${attrName}="${attrValue}"
        title="${escapeHtml(traceLabel)}"
        aria-label="${escapeHtml(traceLabel)}"
      >${text(traceLabel)}</button>
    `;
  }

  function renderDenseMaterialEvidenceTable(rows, { rowAttrPrefix }) {
    const groups = groupMaterialEvidenceLines(rows);
    if (!groups.length) {
      return `<div class="cp-muted-text">No exact material line evidence is available.</div>`;
    }

    const evidenceColCount = 9;
    const headerHtml = [
      "Material",
      "Code",
      "Area",
      "Issue",
      "Rate",
      "Source",
      "Date",
      "Warning",
      "Trace",
    ]
      .map((header, index) => {
        const sticky =
          index === evidenceColCount - 1
            ? ' class="cp-evidence-trace-col"'
            : "";
        return `<th${sticky}>${text(header)}</th>`;
      })
      .join("");

    const bodyHtml = groups
      .map((group, groupIdx) => {
        const line = group.members[0];
        const area = formatSkuEvidenceAreaLabel(line);
        const issueLabel = formatMaterialIssueLabel(line.material_issue_code);
        const issueTitle = line.material_issue_code || issueLabel;
        const materialLabel = line.stock_item_name || line.stock_item_id || "--";
        const codeLabel = line.stock_item_code || "--";
        const sourceLabel = line.rate_source || "--";
        const shareTrace = canShareMaterialEvidenceTraceTarget(group.members);
        const groupCount = group.members.length;
        const badge =
          groupCount > 1
            ? `<button type="button" class="cp-evidence-group-badge" data-evidence-group-toggle="${groupIdx}" aria-expanded="false">${text(
                `${groupCount} frozen lines`,
              )}</button>`
            : "";
        const summaryTrace = renderMaterialEvidenceTraceButton({
          attrName: `${rowAttrPrefix}-trace-group`,
          attrValue: groupIdx,
          area,
          disabled: !shareTrace,
        });
        const expandHtml =
          groupCount > 1
            ? `
          <tr class="cp-evidence-group-detail-row hidden" data-evidence-group-detail="${groupIdx}">
            <td colspan="${evidenceColCount}">
              <div class="cp-evidence-group-detail">
                <div class="cp-muted-text" style="margin-bottom:8px">
                  Exact frozen lines preserved separately (presentation grouping only).
                </div>
                ${group.members
                  .map((member, memberIdx) => {
                    const memberArea = formatSkuEvidenceAreaLabel(member);
                    const memberTrace = renderMaterialEvidenceTraceButton({
                      attrName: `${rowAttrPrefix}-trace-member`,
                      attrValue: `${groupIdx}:${memberIdx}`,
                      area: memberArea,
                    });
                    return `
                      <div class="cp-evidence-group-member">
                        ${renderFrozenLineAuditDetail(member)}
                        <div style="margin-top:6px">${memberTrace}</div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </td>
          </tr>
        `
            : "";

        return `
          <tr data-evidence-group-row="${groupIdx}">
            <td class="cp-evidence-material" title="${text(materialLabel, "")}">
              <span class="cp-evidence-material-line">${cpCellPrimary(materialLabel)}${badge ? ` ${badge}` : ""}</span>
            </td>
            <td class="cp-evidence-code" title="${text(codeLabel, "")}">${text(codeLabel)}</td>
            <td class="cp-evidence-area">${renderEvidenceAreaChip(area)}</td>
            <td class="cp-evidence-issue" title="${escapeHtml(issueTitle)}">${text(issueLabel)}</td>
            <td class="cp-evidence-rate-cell c-right">${formatMoney(line.selected_rate)}</td>
            <td class="cp-evidence-source" title="${text(sourceLabel, "")}">${text(sourceLabel)}</td>
            <td class="cp-evidence-date">${formatDate(line.rate_date)}</td>
            <td class="cp-evidence-warning">${renderAccessibleWarningDetail(line)}</td>
            <td class="cp-evidence-trace-col">${summaryTrace}</td>
          </tr>
          ${expandHtml}
        `;
      })
      .join("");

    return `
      <div class="cp-evidence-table-scroll">
        <table class="cp-table cp-evidence-dense-table cp-sku-evidence-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  }

  function wireDenseMaterialEvidenceActions(host, rows, { rowAttrPrefix, navigate }) {
    if (!host || !Array.isArray(rows)) return;
    const groups = groupMaterialEvidenceLines(rows);

    host.querySelectorAll("[data-evidence-group-toggle]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const groupIdx = Number(btn.getAttribute("data-evidence-group-toggle"));
        const detail = host.querySelector(
          `[data-evidence-group-detail="${groupIdx}"]`,
        );
        if (!detail) return;
        const open = detail.classList.toggle("hidden") === false;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });

    host.querySelectorAll(`[${rowAttrPrefix}-trace-group]`).forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const groupIdx = Number(btn.getAttribute(`${rowAttrPrefix}-trace-group`));
        const group = groups[groupIdx];
        if (!group || !canShareMaterialEvidenceTraceTarget(group.members)) {
          showToast?.("Trace target is ambiguous for this grouped evidence.", "info");
          return;
        }
        navigate?.(group.members[0]);
      });
    });

    host.querySelectorAll(`[${rowAttrPrefix}-trace-member]`).forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const raw = String(
          btn.getAttribute(`${rowAttrPrefix}-trace-member`) || "",
        );
        const [groupPart, memberPart] = raw.split(":");
        const group = groups[Number(groupPart)];
        const line = group?.members?.[Number(memberPart)];
        if (!line) return;
        navigate?.(line);
      });
    });
  }

  function navigateMaterialEvidenceTrace(line) {
    const area = formatSkuEvidenceAreaLabel(line);
    const component = area === "PM" ? "PM" : "RM";
    const lensId = component === "PM" ? "pm-cost-trace" : "rm-cost-trace";
    if (typeof navigateToCostingRoute !== "function") {
      showToast?.("Trace navigation is unavailable.", "info");
      return;
    }
    navigateToCostingRoute(
      "material-cost-manager",
      {
        lens: lensId,
        periodStart: line.period_start || getActivePeriodStart(),
        productId: line.product_id,
        skuId: line.sku_id,
        stockItemId: line.stock_item_id,
        materialArea: component,
        traceComponent: component,
      },
      { newTab: true },
    );
  }

  function renderWorkbenchLineEvidenceTable(rows) {
    if (!rows?.length) {
      return `<div class="cp-muted-text">No exact material line evidence is available for this queue row.</div>`;
    }
    return renderWorkbenchHierarchicalEvidenceTable(rows);
  }

  function renderWorkbenchHierarchicalEvidenceTable(rows) {
    const hierarchy = buildWorkbenchEvidenceHierarchy(rows);
    const rep = hierarchy.representative || {};
    const multiSku =
      hierarchy.productCount > 1 || hierarchy.skuCount > 1;
    const stockName =
      hierarchy.stockItemName ||
      rep.stock_item_name ||
      (hierarchy.stockItemId != null
        ? `Stock ${hierarchy.stockItemId}`
        : "Material");

    const bodyRows = hierarchy.subgroups
      .map((subgroup, subgroupIdx) => {
        const memberCount = subgroup.members.length;
        const shareTrace = canShareMaterialEvidenceTraceTarget(subgroup.members);
        const subgroupTrace = renderMaterialEvidenceTraceButton({
          attrName: "data-workbench-trace-subgroup",
          attrValue: subgroupIdx,
          area: subgroup.material_area,
          disabled: !shareTrace,
          buttonClass: "icon-btn cp-wb-trace-btn",
        });
        return `
          <tr data-workbench-l2="${subgroupIdx}">
            <td>${text(
              subgroup.product_name ||
                (subgroup.product_id != null
                  ? `Product ${subgroup.product_id}`
                  : "Product"),
            )}</td>
            <td class="c-center">${text(subgroup.sku_label)}</td>
            <td class="c-center">${formatNumber(memberCount)}</td>
            <td class="c-center">${subgroupTrace}</td>
            <td class="c-center">${renderWorkbenchAuditPopover(subgroup.members)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="cp-wb-hierarchy" data-workbench-raw-count="${hierarchy.frozenLineCount}">
        <div class="cp-wb-l1-card">
          <div class="cp-dashboard-main">${text(stockName)}</div>
          <div class="cp-wb-l1-ops">
            <div>${renderAccessibleWarningDetail(rep)}</div>
            <div><strong>${formatMoney(rep.selected_rate)}</strong></div>
            <div>${text(rep.rate_source || "—")}</div>
            <div>${formatDate(rep.rate_date)}</div>
          </div>
          <div class="cp-wb-l1-counts">
            <div><strong>${formatNumber(hierarchy.frozenLineCount)}</strong> frozen / affected lines</div>
            <div><strong>${formatNumber(hierarchy.productCount)}</strong> Products</div>
            <div><strong>${formatNumber(hierarchy.skuCount)}</strong> SKUs</div>
          </div>
          ${
            multiSku
              ? `<div class="cp-muted-text" style="margin-top:8px">Portfolio material issue across multiple Products/SKUs. Open Affected Products / SKUs — no single Trace target.</div>`
              : ""
          }
          <div class="cp-wb-l1-toggle-wrap">
            <button
              type="button"
              class="icon-btn icon-btn-primary cp-wb-l1-toggle-btn"
              data-workbench-l1-toggle="true"
              aria-expanded="false"
            >
              <span data-workbench-l1-toggle-label>${text(
                "Affected Products / SKUs",
              )}</span>
              <span class="cp-wb-l1-toggle-caret" aria-hidden="true">▾</span>
            </button>
          </div>
        </div>
        <div class="cp-wb-l2-list hidden" data-workbench-l2-list="true">
          <div class="cp-evidence-table-scroll">
            <table class="cp-table cp-evidence-dense-table cp-wb-affected-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="c-center">SKU / Pack</th>
                  <th class="c-center">Lines</th>
                  <th class="c-center">Trace</th>
                  <th class="c-center">Audit</th>
                </tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  async function renderWorkbenchLineEvidenceTab(row) {
    let rows = [];
    try {
      rows = await loadWorkbenchLineEvidenceRows(row);
    } catch (err) {
      handleError?.("Failed to load material line evidence", err);
      LAST_WORKBENCH_LINE_EVIDENCE_ROWS = [];
      return `<div class="status error">Unable to load exact material line evidence.</div>`;
    }

    LAST_WORKBENCH_LINE_EVIDENCE_ROWS = rows || [];
    const area = String(row?.material_area || "").trim().toUpperCase() || "—";
    return `
      <div class="cp-card" style="margin-bottom:12px">
        <div class="cp-card-label">Exact run line evidence</div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          Queue item area: ${text(area)}. Portfolio presentation below preserves every frozen line from the current successful costing run.
        </div>
      </div>
      ${renderWorkbenchLineEvidenceTable(LAST_WORKBENCH_LINE_EVIDENCE_ROWS)}
    `;
  }

  function wireWorkbenchLineEvidenceActions(host, rows) {
    if (!host || !Array.isArray(rows)) return;
    const hierarchy = buildWorkbenchEvidenceHierarchy(rows);
    ensureAnchoredDisclosureWiring();

    host.querySelectorAll("[data-workbench-l1-toggle]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const list = host.querySelector("[data-workbench-l2-list]");
        if (!list) return;
        const open = list.classList.toggle("hidden") === false;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.classList.toggle("is-expanded", open);
        const label = btn.querySelector("[data-workbench-l1-toggle-label]");
        if (label) {
          label.textContent = open
            ? "Hide affected Products / SKUs"
            : "Affected Products / SKUs";
        } else {
          btn.textContent = open
            ? "Hide affected Products / SKUs"
            : "Affected Products / SKUs";
        }
      });
    });

    host.querySelectorAll("[data-workbench-trace-subgroup]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idx = Number(btn.getAttribute("data-workbench-trace-subgroup"));
        const subgroup = hierarchy.subgroups[idx];
        if (
          !subgroup ||
          !canShareMaterialEvidenceTraceTarget(subgroup.members)
        ) {
          showToast?.(
            "Trace target is ambiguous for this Product/SKU subgroup.",
            "info",
          );
          return;
        }
        navigateMaterialEvidenceTrace(subgroup.members[0]);
      });
    });
  }

  function getWorkbenchDrawerConfig(row, preferredTab) {
    if (
      row?.final_action_status ||
      row?.costing_confidence_status ||
      row?.commercial_viability_status
    ) {
      return {
        title:
          row.sku_display_name ||
          row.sku_column_label ||
          row.sku_id ||
          "SKU Diagnosis",
        subtitle: row.product_name || row.product_id || "",
        tabs: [{ id: "action", label: "Diagnosis" }],
        activeTab: "action",
      };
    }

    const tabs = [
      { id: "resolve", label: "Resolve" },
      { id: "line-evidence", label: "Line Evidence" },
      { id: "affected", label: "Affected SKUs" },
    ];
    let requestedTab = preferredTab;
    if (
      requestedTab === "summary" ||
      requestedTab === "rate-action" ||
      requestedTab === "action"
    ) {
      requestedTab = "resolve";
    }
    const active = tabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : "resolve";

    return {
      title: row.stock_item_name || row.stock_item_id || "Material Action",
      subtitle: [row.material_area, row.action_severity, row.recommended_ui_route]
        .filter(Boolean)
        .join(" / "),
      tabs,
      activeTab: active,
    };
  }

  async function renderWorkbenchDrawerTab(tabId, row, materialCostCtrl) {
    if (!row) {
      return `<div class="status">No material action selected.</div>`;
    }

    if (tabId === "line-evidence") {
      return renderWorkbenchLineEvidenceTab(row);
    }

    if (tabId === "affected") {
      return materialCostCtrl.renderMaterialWorkbenchTab(
        "affected",
        row,
        "costing-review-workbench",
      );
    }

    return materialCostCtrl.renderMaterialWorkbenchTab(
      tabId === "action" ? "resolve" : tabId,
      row,
      "costing-review-workbench",
    );
  }

  function wireWorkbenchDrawerActions(tabId, row, materialCostCtrl) {
    if (tabId === "line-evidence") {
      wireWorkbenchLineEvidenceActions(
        document.getElementById("drawerContent"),
        LAST_WORKBENCH_LINE_EVIDENCE_ROWS,
      );
      return;
    }

    materialCostCtrl.wireMaterialWorkbenchDrawerActions(
      tabId === "action" ? "resolve" : tabId,
      "costing-review-workbench",
    );
  }

  function getSkuControlDrawerConfig(row, preferredTab) {
    const tabs = [
      { id: "control", label: "Control" },
      { id: "evidence", label: "Evidence" },
    ];
    const active = tabs.some((tab) => tab.id === preferredTab)
      ? preferredTab
      : "control";
    const primaryLabel =
      formatFirstControlStatusLabel(row?.first_control_status) ||
      row?.first_control_status ||
      "";
    return {
      title:
        row?.product_name ||
        (row?.product_id != null ? `Product ${row.product_id}` : "SKU Control"),
      subtitle: [formatSkuPackLabel(row), primaryLabel, row?.control_severity]
        .filter(Boolean)
        .join(" · "),
      tabs,
      activeTab: active,
    };
  }

  function buildSkuControlRouteContext(row) {
    return {
      productId: row?.product_id,
      skuId: row?.sku_id,
      periodStart: row?.period_start,
      rmBlockingLineCount: row?.rm_blocking_line_count,
      pmBlockingLineCount: row?.pm_blocking_line_count,
      sellingPriceBridgeStatus: row?.selling_price_bridge_status,
      pricingBridgeStatus: row?.pricing_bridge_status,
    };
  }

  function renderSkuControlNavSection(row) {
    const target = resolveRecommendedUiRouteTarget(
      row?.recommended_ui_route,
      buildSkuControlRouteContext(row),
    );
    const routeLabel =
      formatRecommendedUiRouteLabel(row?.recommended_ui_route) ||
      row?.recommended_ui_route ||
      "—";

    if (target.navigable) {
      return `
        <div class="cp-card" style="margin-bottom:12px">
          <div class="cp-card-label">Remediation</div>
          <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
            Recommended route: ${text(routeLabel)}
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            <button
              type="button"
              class="icon-btn icon-btn-primary"
              data-sku-control-nav="true"
              title="${escapeHtml(target.label)}"
              aria-label="${escapeHtml(target.label)}"
            >${text(target.label)}</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="cp-card" style="margin-bottom:12px">
        <div class="cp-card-label">Remediation</div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          Recommended route: ${text(routeLabel)}
        </div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          No dedicated navigation is configured for this control yet.
        </div>
      </div>
    `;
  }

  function isPermissionDeniedError(err) {
    const msg = String(err?.message || err?.error_description || err || "")
      .toLowerCase();
    const code = String(err?.code || "").toLowerCase();
    return (
      code.includes("42501") ||
      msg.includes("permission") ||
      msg.includes("not authorized") ||
      msg.includes("forbidden") ||
      msg.includes("access denied") ||
      msg.includes("require_permission")
    );
  }

  async function loadSkuExactEvidenceRows(row) {
    const periodStart =
      row?.period_start || getActivePeriodStart?.() || null;
    const productId = row?.product_id;
    const skuId = row?.sku_id;
    if (!periodStart || productId == null || skuId == null) return [];

    const cacheKey = buildSkuExactEvidenceCacheKey({
      periodStart,
      productId,
      skuId,
    });
    if (SKU_EXACT_EVIDENCE_CACHE.has(cacheKey)) {
      return SKU_EXACT_EVIDENCE_CACHE.get(cacheKey) || [];
    }

    const rows = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_material_action_drilldown_snapshot")
          .select("*")
          .eq("period_start", periodStart)
          .eq("product_id", productId)
          .eq("sku_id", skuId)
          .order("material_area", { ascending: true })
          .order("stock_item_name", { ascending: true })
          .order("line_no", { ascending: true, nullsFirst: false }),
      1000,
    );
    const list = Array.isArray(rows) ? rows : [];
    SKU_EXACT_EVIDENCE_CACHE.set(cacheKey, list);
    return list;
  }

  function renderSkuExactEvidenceRunBanner(rows) {
    const first = rows?.[0];
    if (!first) return "";
    const bits = [];
    if (first.valuation_date) {
      bits.push(`Valuation ${formatDate(first.valuation_date)}`);
    }
    if (first.refresh_run_id != null && first.refresh_run_id !== "") {
      bits.push(`Run ${first.refresh_run_id}`);
    }
    if (!bits.length) return "";
    return `<div class="cp-muted-text" style="margin-top:6px;line-height:1.45">Exact costing evidence: ${text(bits.join(" · "))}</div>`;
  }

  function renderSkuExactEvidenceTable(rows) {
    if (!rows?.length) {
      return `<div class="cp-muted-text">No exact material issue lines are available for this SKU in the current successful run snapshot.</div>`;
    }
    return renderDenseMaterialEvidenceTable(rows, {
      rowAttrPrefix: "data-sku-evidence",
    });
  }

  async function renderSkuControlEvidenceTab(row) {
    const secondaryMaterial = resolveSkuControlSecondaryMaterialMessage(
      row.material_costing_status,
    );
    const summaryHtml = detailPanel([
      kvSection("Secondary material evidence", [
        [
          "Material costing status",
          statusChip(row.material_costing_status),
        ],
        ["RM costing status", statusChip(row.rm_costing_status)],
        ["PM costing status", statusChip(row.pm_costing_status)],
        [
          "RM review lines",
          text(formatReviewLineCountLabel("RM", row.rm_review_rate_line_count)),
        ],
        [
          "PM review lines",
          text(formatReviewLineCountLabel("PM", row.pm_review_rate_line_count)),
        ],
        [
          "RM blocking lines",
          formatNumber(row.rm_blocking_line_count),
        ],
        [
          "PM blocking lines",
          formatNumber(row.pm_blocking_line_count),
        ],
      ]),
      secondaryMaterial
        ? `<div class="cp-muted-text" style="margin-top:8px;line-height:1.45">${text(secondaryMaterial)}</div>`
        : "",
    ]);

    let rows = [];
    try {
      rows = await loadSkuExactEvidenceRows(row);
    } catch (err) {
      handleError?.("Failed to load SKU exact material evidence", err);
      LAST_SKU_EXACT_EVIDENCE_ROWS = [];
      const failMsg = isPermissionDeniedError(err)
        ? "Exact material evidence is restricted for your access."
        : "Unable to load exact material issue lines.";
      return `
        ${summaryHtml}
        <div class="cp-card" style="margin-top:12px">
          <div class="cp-card-label">Exact material evidence</div>
          <div class="status error" style="margin-top:8px">${text(failMsg)}</div>
        </div>
      `;
    }

    LAST_SKU_EXACT_EVIDENCE_ROWS = rows || [];
    return `
      ${summaryHtml}
      <div class="cp-card" style="margin-top:12px;margin-bottom:12px">
        <div class="cp-card-label">Exact material evidence</div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          Frozen issue lines from the current successful costing run for this SKU. These do not rewrite live master data.
        </div>
        ${renderSkuExactEvidenceRunBanner(LAST_SKU_EXACT_EVIDENCE_ROWS)}
      </div>
      ${renderSkuExactEvidenceTable(LAST_SKU_EXACT_EVIDENCE_ROWS)}
    `;
  }

  async function loadSkuFoundationDiagnosis(row) {
    const productId = row?.product_id;
    if (productId == null || productId === "") return null;
    const skuId = row?.sku_id ?? null;
    const cacheKey = buildSkuFoundationDiagnosisCacheKey({
      productId,
      skuId,
    });
    if (SKU_FOUNDATION_DIAGNOSIS_CACHE.has(cacheKey)) {
      return SKU_FOUNDATION_DIAGNOSIS_CACHE.get(cacheKey);
    }
    if (typeof costingRpc !== "function") {
      throw new Error("Foundation diagnosis RPC is unavailable.");
    }
    const params = {
      p_product_id: Number(productId),
    };
    if (skuId != null && skuId !== "") {
      params.p_sku_id = Number(skuId);
    }
    const { data, error } = await costingRpc(
      "rpc_get_current_material_foundation_diagnosis",
      params,
    );
    if (error) throw error;
    const diagnosis = Array.isArray(data) ? data[0] || null : data || null;
    SKU_FOUNDATION_DIAGNOSIS_CACHE.set(cacheKey, diagnosis);
    return diagnosis;
  }

  function renderCurrentSourceDiagnosisSection(diagnosis) {
    if (!diagnosis) {
      return `
        <div class="cp-card" style="margin-bottom:12px">
          <div class="cp-card-label">CURRENT SOURCE STATE</div>
          <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
            Current source diagnosis is unavailable.
          </div>
        </div>
      `;
    }

    const overall = String(diagnosis.overall_foundation_status || "")
      .trim()
      .toUpperCase();
    const note =
      diagnosis.historical_evidence_note ||
      "This reflects live master data and may differ from the frozen costing run.";

    if (overall === "FOUNDATION_PRESENT") {
      return `
        <div class="cp-card" style="margin-bottom:12px">
          <div class="cp-card-label">CURRENT SOURCE STATE</div>
          <div style="margin-top:8px">Current source foundation: Present</div>
          <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
            ${text(note)}
          </div>
        </div>
      `;
    }

    const routeCode = diagnosis.recommended_ui_route;
    const routeLabel = routeCode
      ? formatRecommendedUiRouteLabel(routeCode) ||
        String(routeCode).replaceAll("_", " ")
      : "";
    // Diagnosis routes such as RM_BOM_MANAGEMENT / PM_REQUIREMENT_MANAGEMENT are
    // unverified client destinations: show label only; never invent a CTA.
    const routeHtml = routeCode
      ? `<div class="cp-muted-text" style="margin-top:6px;line-height:1.45">Route label: ${text(
          routeLabel || routeCode,
        )} (navigation not available)</div>`
      : "";

    return `
      <div class="cp-card" style="margin-bottom:12px">
        <div class="cp-card-label">CURRENT SOURCE STATE</div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          Live master-data diagnosis. Independent from frozen costing control above.
        </div>
        <div class="cp-muted-text" style="margin-top:6px;line-height:1.45">
          ${text(note)}
        </div>
        ${kvSection("Current source diagnosis", [
          [
            "RM Foundation",
            text(formatFoundationStatusLabel(diagnosis.rm_foundation_status)),
          ],
          [
            "PM Foundation",
            text(formatFoundationStatusLabel(diagnosis.pm_foundation_status)),
          ],
          [
            "Current Diagnosis",
            text(formatFoundationStatusLabel(diagnosis.overall_foundation_status)),
          ],
          [
            "RM BOM headers",
            formatNumber(diagnosis.rm_bom_header_count),
          ],
          [
            "RM BOM lines",
            formatNumber(diagnosis.rm_bom_line_count),
          ],
          [
            "PM requirement lines",
            diagnosis.pm_requirement_line_count == null
              ? "—"
              : formatNumber(diagnosis.pm_requirement_line_count),
          ],
          [
            "Recommended Action",
            text(diagnosis.recommended_action || "—"),
          ],
        ])}
        ${routeHtml}
      </div>
    `;
  }

  async function renderSkuControlControlTab(row) {
    const primaryMessage = resolveSkuControlPrimaryMessage({
      firstControlStatus: row.first_control_status,
      controlNote: row.control_note,
    });
    const secondaryMaterial = resolveSkuControlSecondaryMaterialMessage(
      row.material_costing_status,
    );
    const primaryLabel =
      formatFirstControlStatusLabel(row.first_control_status) ||
      row.first_control_status ||
      "—";
    const routeLabel =
      formatRecommendedUiRouteLabel(row.recommended_ui_route) ||
      row.recommended_ui_route ||
      "—";

    const frozenPrimaryPairs = [
      ["Severity", statusChip(row.control_severity)],
      ["Primary control", text(primaryLabel)],
      ["Control code", text(row.first_control_status)],
      ["Control note", text(primaryMessage || row.control_note)],
      ["Recommended route", text(routeLabel)],
      ["Cost sheet status", statusChip(row.cost_sheet_status)],
      ["Period", text(row.period_start || getActivePeriodStart?.() || "—")],
    ];
    if (row.snapshot_refreshed_at) {
      frozenPrimaryPairs.push([
        "Snapshot refreshed",
        formatDateTime(row.snapshot_refreshed_at),
      ]);
    }

    const frozenHtml = detailPanel([
      kvSection("PRIMARY CONTROL (frozen costing state)", frozenPrimaryPairs),
      secondaryMaterial
        ? `<div class="cp-card" style="margin-bottom:12px"><div class="cp-card-label">Secondary evidence</div><div class="cp-muted-text" style="margin-top:6px;line-height:1.45">${text(secondaryMaterial)}</div><div style="margin-top:6px">${statusChip(row.material_costing_status)}</div><div class="cp-muted-text" style="margin-top:8px">${text(formatReviewLineCountLabel("RM", row.rm_review_rate_line_count))}</div><div class="cp-muted-text" style="margin-top:4px">${text(formatReviewLineCountLabel("PM", row.pm_review_rate_line_count))}</div></div>`
        : kvSection("Secondary evidence", [
            [
              "Material costing status",
              statusChip(row.material_costing_status),
            ],
            [
              "RM review lines",
              text(formatReviewLineCountLabel("RM", row.rm_review_rate_line_count)),
            ],
            [
              "PM review lines",
              text(formatReviewLineCountLabel("PM", row.pm_review_rate_line_count)),
            ],
          ]),
      renderSkuControlNavSection(row),
    ]);

    let diagnosisHtml = "";
    try {
      const diagnosis = await loadSkuFoundationDiagnosis(row);
      diagnosisHtml = renderCurrentSourceDiagnosisSection(diagnosis);
    } catch (err) {
      handleError?.("Failed to load current source diagnosis", err);
      const failMsg = isPermissionDeniedError(err)
        ? "Current source diagnosis is restricted for your access."
        : "Unable to load current source diagnosis.";
      diagnosisHtml = `
        <div class="cp-card" style="margin-bottom:12px">
          <div class="cp-card-label">CURRENT SOURCE STATE</div>
          <div class="status error" style="margin-top:8px">${text(failMsg)}</div>
        </div>
      `;
    }

    return `${frozenHtml}${diagnosisHtml}`;
  }

  async function renderSkuControlDrawerTab(tabId, row) {
    if (!row) {
      return `<div class="status">SKU control details are unavailable.</div>`;
    }

    if (tabId === "evidence") {
      return renderSkuControlEvidenceTab(row);
    }

    return renderSkuControlControlTab(row);
  }

  function wireSkuExactEvidenceActions(host, rows) {
    wireDenseMaterialEvidenceActions(host, rows, {
      rowAttrPrefix: "data-sku-evidence",
      navigate: navigateMaterialEvidenceTrace,
    });
  }

  function wireSkuControlDrawerActions(tabId, row) {
    const host = document.getElementById("drawerContent");
    if (!host || !row) return;
    host.querySelectorAll("[data-sku-control-nav]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = resolveRecommendedUiRouteTarget(
          row.recommended_ui_route,
          buildSkuControlRouteContext(row),
        );
        if (!target.navigable || typeof navigateToCostingRoute !== "function") {
          showToast?.(
            "No dedicated navigation is configured for this control yet.",
            "info",
          );
          return;
        }
        navigateToCostingRoute(
          target.moduleKey,
          target.navigateParams || { lens: target.lensId },
          { newTab: target.newTab === true },
        );
      });
    });
    if (tabId === "evidence") {
      wireSkuExactEvidenceActions(host, LAST_SKU_EXACT_EVIDENCE_ROWS);
    }
  }

  function syncSelectedDashboardRow(selectedRow) {
    return CONTROL_DASHBOARD_SUMMARY || selectedRow;
  }

  function getControlDashboardSummary() {
    return CONTROL_DASHBOARD_SUMMARY;
  }

  function hasControlSnapshot() {
    return !!CONTROL_DASHBOARD_SUMMARY;
  }

  return {
    loadGlobalSummaries,
    loadDashboardRows,
    loadWorkbenchRows,
    loadSkuControlStatusRows,
    renderKpiStrip,
    handleKpiAction,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    renderWorkbenchSummary,
    getDashboardDrawerConfig,
    getWorkbenchDrawerConfig,
    getSkuControlDrawerConfig,
    renderDashboardDrawerTab,
    renderSkuControlDrawerTab,
    renderWorkbenchDrawerTab,
    wireWorkbenchDrawerActions,
    wireSkuControlDrawerActions,
    syncSelectedDashboardRow,
    getControlDashboardSummary,
    hasControlSnapshot,
    clearSkuExactEvidenceCache,
    clearSkuFoundationDiagnosisCache,
    clearSkuControlSessionCaches,
  };
}
