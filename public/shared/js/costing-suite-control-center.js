export const CONTROL_CENTER_LENS_IDS = ["dashboard", "costing-review-workbench"];

export function isControlCenterLens(lensId) {
  return CONTROL_CENTER_LENS_IDS.includes(lensId);
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
};

export function createControlCenterController(deps) {
  const {
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
    getActivePeriodStart,
    getSelectedRow,
    drillToLens,
    drillToPricingPolicyWorkspace,
  } = deps;

  let DASHBOARD_SUMMARY = null;
  let BUSINESS_KPI_SUMMARY = null;
  let CONTROL_DASHBOARD_SUMMARY = null;
  let CONTROL_AUDIT_ROWS = [];

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
        await drillToLens("costing-review-workbench", { status: ["BLOCKER"] });
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
    renderKpiStrip,
    handleKpiAction,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    renderWorkbenchSummary,
    getDashboardDrawerConfig,
    getWorkbenchDrawerConfig,
    renderDashboardDrawerTab,
    syncSelectedDashboardRow,
    getControlDashboardSummary,
    hasControlSnapshot,
  };
}
