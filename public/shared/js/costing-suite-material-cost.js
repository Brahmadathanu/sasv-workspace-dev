export const MATERIAL_COST_LENS_IDS = ["manual-rate-manager"];

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
};

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

  function isHardBlockedMaterialIssue(row) {
    const hardCodes = ["MISSING_REQUIRED_RM_RATE", "MISSING_REQUIRED_PM_RATE"];
    return splitCodeTokens(row?.issue_codes).some((token) =>
      hardCodes.includes(token),
    );
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

  function openManualRateEditModal(row) {
    if (!row || !manualRateEditModal) return;

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
      showToast("Reason / approval reference is required.", "error");
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
        "Manual rate saved. Request Costing Refresh from the toolbar when you want costing recalculated.",
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
                : "manual-rate-action";

          await setDrawerTab(nextTab);
        } else {
          await setDrawerTab("action");
        }
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
        "Manual rate closed. Request Costing Refresh from the toolbar when you want costing recalculated.",
        "success",
        5200,
      );

      if (getCurrentLens() === "manual-rate-manager") {
        await reloadRows();
      } else {
        await setDrawerTab("manual-rate-history");
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

  async function renderMaterialWorkbenchTab(tabId, row, lensId) {
    const workbenchTabId =
      {
        "manual-rate-action": "action",
        "affected-products": "affected",
        "raw-lines": "raw",
      }[tabId] || tabId;

    if (lensId === "costing-review-workbench") {
      if (workbenchTabId === "summary")
        return renderControlWorkbenchSummaryTab(row);
      if (workbenchTabId === "affected")
        return renderControlWorkbenchAffectedSkusTab(row);
      if (workbenchTabId === "action")
        return renderControlWorkbenchRateActionTab(row);
      return renderControlWorkbenchSummaryTab(row);
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

  function getManualRateManagerTab() {
    return manualRateManagerTab;
  }

  async function loadManualRateManagerRows(tab) {
    const activeTab = tab || manualRateManagerTab;
    if (activeTab === "register") {
      return fetchManualRateManagerRegisterRows();
    }
    if (activeTab === "history") {
      return fetchManualRateManagerHistoryRows();
    }
    return fetchAllRows(
      () =>
        costingFrom("v_costing_manual_rate_manager_action_queue")
          .select("*")
          .order("priority_sort", { ascending: true })
          .order("material_issue_code", { ascending: true })
          .order("stock_item_name", { ascending: true }),
      1000,
    );
  }

  function getTableHeaders(lensId) {
    if (lensId !== "manual-rate-manager") return null;
    return (
      MANUAL_RATE_HEADERS_BY_TAB[manualRateManagerTab] ||
      MANUAL_RATE_HEADERS_BY_TAB["action-queue"]
    );
  }

  function getTableAlignments(lensId) {
    if (lensId !== "manual-rate-manager") return null;
    return (
      MANUAL_RATE_ALIGNMENTS_BY_TAB[manualRateManagerTab] ||
      MANUAL_RATE_ALIGNMENTS_BY_TAB["action-queue"]
    );
  }

  function renderTableRow(lensId, row, trAttrs) {
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
        { id: "manual-rate-action", label: "Action" },
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

    const validPreferred = managerTabs.some((t) => t.id === preferredTab)
      ? preferredTab
      : managerTabs[0].id;

    return {
      title,
      subtitle,
      tabs: managerTabs,
      activeTab: validPreferred,
    };
  }

  function wireMaterialWorkbenchDrawerActions(tabId, lensId) {
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
    loadManualRateManagerRows,
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
  };
}
