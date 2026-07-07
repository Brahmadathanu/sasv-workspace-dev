export const COST_BUILD_LENS_IDS = [
  "cost-governance",
  "staff-governance",
  "manual-provisions",
];

export function isCostBuildLens(lensId) {
  return COST_BUILD_LENS_IDS.includes(lensId);
}

function costGovernanceHeaders(tab) {
  if (tab === "cost-pool-summary") {
    return [
      "Period",
      "Allocation Pool",
      "Source Type",
      "Staff Amount",
      "Expense Provision",
      "Manual Provision",
      "Total Pool Amount",
      "Status",
    ];
  }
  if (tab === "mapping-register" || tab === "excluded") {
    return [
      "",
      "Expense Head",
      "Allocation Pool",
      "Mapping Status",
      "Include in Costing",
      "Remarks",
    ];
  }
  return [
    "",
    "Expense Head",
    "Materiality",
    "Max Seen Value",
    "Suggested Review Note",
  ];
}

function costGovernanceAlignments(tab) {
  if (tab === "cost-pool-summary") {
    return [
      "c-left",
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
    ];
  }
  if (tab === "mapping-register" || tab === "excluded") {
    return [
      "lane-col",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
    ];
  }
  return ["lane-col", "c-left", "c-left", "c-right", "c-left"];
}

function staffGovernanceHeaders(tab) {
  if (tab === "staff-register") {
    return [
      "",
      "Status",
      "Staff",
      "Designation",
      "Salary Cost",
      "Costing Class",
      "Allocation Pool",
      "Effective From",
      "Weight",
      "Remarks",
      "Action",
    ];
  }
  if (tab === "staff-pool-summary") {
    return [
      "Period",
      "Allocation Pool",
      "Costing Class",
      "Staff Count",
      "Pool Amount",
      "Status",
    ];
  }
  return [
    "",
    "Status",
    "Staff",
    "Designation",
    "Salary Period",
    "Salary Cost",
    "Costing Class",
    "Allocation Pool",
    "Note",
    "Action",
  ];
}

function staffGovernanceAlignments(tab) {
  if (tab === "staff-register") {
    return [
      "lane-col",
      "c-left",
      "c-left",
      "c-left",
      "c-right",
      "c-left",
      "c-left",
      "c-left",
      "c-right",
      "c-left",
      "c-center",
    ];
  }
  if (tab === "staff-pool-summary") {
    return [
      "c-left",
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-left",
    ];
  }
  return [
    "lane-col",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-center",
  ];
}

function manualProvisionHeaders(tab) {
  if (tab === "impact") {
    return [
      "Period",
      "Allocation Pool",
      "Staff Amount",
      "Expense Provision",
      "Manual Provision",
      "Total Pool Amount",
      "Source Type",
      "Status",
    ];
  }
  return [
    "Period",
    "Pool",
    "Type",
    "Key / Label",
    "Monthly Amount",
    "Source Ref",
    "Status",
    "Updated",
  ];
}

function manualProvisionAlignments(tab) {
  if (tab === "impact") {
    return [
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
      "c-left",
    ];
  }
  return [
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
  ];
}

export function createCostBuildController(deps) {
  const {
    dom,
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
    reloadRows,
    renderTable,
    updateSearchClear,
    getSearchValue,
    getCurrentLens,
    setRowsAndView,
    closeDetails,
    getActivePeriodStart,
  } = deps;

  const {
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
  } = dom;

  let costGovernanceTab = "unmapped";
  let staffGovernanceTab = "staff-review";
  let manualProvisionTab = "register";
  let expensePoolOptions = [];
  let staffClassOptions = [];
  let manualProvisionRows = [];
  let manualProvisionPoolImpactRows = [];
  let manualProvisionPoolOptions = [];
  let manualProvisionTypeOptions = [];
  let selectedManualProvisionId = null;
  let manualProvisionReturnFocus = null;
  let manualProvisionDeactivateReturnFocus = null;
  let manualProvisionBusy = false;
  let manualProvisionFilters = { periodStart: "" };
  let expenseMappingEditRow = null;
  let expenseMappingReturnFocus = null;
  let expenseMappingDetailRow = null;
  let expenseMappingDetailReturnFocus = null;
  let expenseMappingCloseRow = null;
  let expenseMappingCloseReturnFocus = null;
  let staffClassificationEditRow = null;
  let staffClassificationReturnFocus = null;
  let staffGovernanceReviewReturnFocus = null;
  let eventsBound = false;

  function staffDisplayName(row) {
    return (
      row.staff_display_name ||
      row.staff_name ||
      row.full_name ||
      row.employee_name ||
      row.name ||
      row.employee_code ||
      row.staff_id ||
      "--"
    );
  }

  function staffDisplayBlock(row) {
    const displayName = staffDisplayName(row);
    const code = row.employee_code || "--";
    const staffId = row.staff_id || "--";
    const designation = row.designation || "--";

    return `${cpCellPrimary(displayName)}<div class="cp-muted-text">Code: ${text(code)} / Staff ID: ${text(staffId)}</div><div class="cp-muted-text">${text(designation)}</div>`;
  }

  function isManualProvisionsLens() {
    return getCurrentLens() === "manual-provisions";
  }

  function getCostGovernanceTab() {
    return costGovernanceTab;
  }

  function getStaffGovernanceTab() {
    return staffGovernanceTab;
  }

  function getManualProvisionTab() {
    return manualProvisionTab;
  }

  function setManualProvisionPeriodFilter(periodStart) {
    manualProvisionFilters.periodStart = normalizeMonthStart(periodStart);
  }

  async function loadExpensePoolOptions() {
    const { data, error } = await costingFrom(
      "v_costing_expense_allocation_pool_options",
    )
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    expensePoolOptions = data || [];
  }

  async function loadStaffClassOptions() {
    const { data, error } = await costingFrom(
      "v_costing_staff_costing_class_options",
    )
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    staffClassOptions = data || [];
  }

  async function loadOptions() {
    try {
      await loadExpensePoolOptions();
    } catch (err) {
      console.warn(
        "[costing-suite-cost-build] Failed to load expense pool options",
        err,
      );
      expensePoolOptions = [];
    }

    try {
      await loadStaffClassOptions();
    } catch (err) {
      console.warn(
        "[costing-suite-cost-build] staff class options could not be loaded",
        err,
      );
      staffClassOptions = [];
    }
  }

  async function loadCostGovernanceRows(activePeriodStart) {
    if (costGovernanceTab === "mapping-register") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_expense_head_mapping_register")
            .select("*")
            .order("expense_group", { ascending: true })
            .order("head_name", { ascending: true }),
        1000,
      );
    }

    if (costGovernanceTab === "excluded") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_expense_head_mapping_register")
            .select("*")
            .eq("mapping_status", "EXCLUDED")
            .order("expense_group", { ascending: true })
            .order("head_name", { ascending: true }),
        1000,
      );
    }

    if (costGovernanceTab === "cost-pool-summary") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_cost_pool_monthly_summary")
            .select("*")
            .eq("period_start", activePeriodStart)
            .order("allocation_pool", { ascending: true }),
        1000,
      );
    }

    const rows = await fetchAllRows(
      () =>
        costingFrom("v_costing_unmapped_expense_heads_for_mapping")
          .select("*")
          .order("expense_group", { ascending: true })
          .order("head_name", { ascending: true }),
      1000,
    );

    const bandRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    rows.sort((a, b) => {
      const left =
        bandRank[String(a?.materiality_band || "").toUpperCase()] ?? 99;
      const right =
        bandRank[String(b?.materiality_band || "").toUpperCase()] ?? 99;
      if (left !== right) return left - right;
      const valueLeft = Number(a?.max_seen_value || 0);
      const valueRight = Number(b?.max_seen_value || 0);
      if (valueLeft !== valueRight) return valueRight - valueLeft;
      return String(a?.head_name || "").localeCompare(String(b?.head_name || ""));
    });

    return rows;
  }

  async function loadStaffGovernanceRows(activePeriodStart) {
    if (staffGovernanceTab === "staff-register") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_staff_classification_register")
            .select("*")
            .order("classification_status", { ascending: true })
            .order("employee_code", { ascending: true }),
        1000,
      );
    }

    if (staffGovernanceTab === "staff-pool-summary") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_staff_cost_pool_summary")
            .select("*")
            .eq("period_start", activePeriodStart)
            .order("allocation_pool", { ascending: true })
            .order("costing_class", { ascending: true }),
        1000,
      );
    }

    return fetchAllRows(
      () =>
        costingFrom("v_costing_unclassified_staff_for_costing")
          .select("*")
          .order("classification_status", { ascending: true })
          .order("total_salary_cost", { ascending: true })
          .order("employee_code", { ascending: true }),
      1000,
    );
  }

  function syncManualProvisionLayout() {
    const isManual = isManualProvisionsLens();

    setVisible(kpiStripWrap, true, "");
    setVisible(globalSearchCard, true, "flex");
    setVisible(genericTableMetaRow, true, "flex");

    if (tableWrap) {
      tableWrap.classList.remove("hidden");
      tableWrap.style.display = "";
    }

    if (isManual && statusArea) {
      statusArea.style.display = "none";
      statusArea.innerHTML = "";
    }
  }

  function manualProvisionStatusText(row) {
    const status =
      row?.provision_status || (row?.is_active ? "ACTIVE" : "INACTIVE");
    return compactStatusText(status);
  }

  function populateManualProvisionPoolSelect(selectEl, includeAll = false) {
    if (!selectEl) return;
    const options = [];
    if (includeAll) options.push(`<option value="all">All Pools</option>`);
    options.push(
      ...manualProvisionPoolOptions.map((row) => {
        const value = row.allocation_pool || "";
        const label = row.allocation_pool_label || value || "--";
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }),
    );
    selectEl.innerHTML = options.join("");
  }

  function populateManualProvisionTypeSelect(selectEl) {
    if (!selectEl) return;

    selectEl.innerHTML = [
      `<option value="">Select provision type</option>`,
      ...manualProvisionTypeOptions.map((row) => {
        const value = row.provision_type || "";
        const label = row.provision_type_label || value || "--";
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }),
    ].join("");
  }

  async function loadManualProvisionOptions() {
    const [poolRows, typeRows] = await Promise.all([
      fetchAllRows(() =>
        costingFrom("v_costing_manual_provision_pool_options")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("allocation_pool_label", { ascending: true }),
      ),
      fetchAllRows(() =>
        costingFrom("v_costing_manual_provision_type_options")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("provision_type_label", { ascending: true }),
      ),
    ]);

    manualProvisionPoolOptions = poolRows || [];
    manualProvisionTypeOptions = typeRows || [];

    populateManualProvisionPoolSelect(manualProvisionAllocationPool, false);
    populateManualProvisionTypeSelect(manualProvisionType);
  }

  async function loadManualProvisionRows() {
    let query = costingFrom("v_costing_manual_cost_pool_provision_register")
      .select("*")
      .order("period_start", { ascending: false })
      .order("allocation_pool", { ascending: true })
      .order("provision_type", { ascending: true })
      .order("provision_key", { ascending: true });

    if (manualProvisionFilters.periodStart) {
      query = query.eq("period_start", manualProvisionFilters.periodStart);
    }

    const { data, error } = await query;
    if (error) throw error;
    manualProvisionRows = data || [];
  }

  async function loadManualProvisionPoolImpactRows() {
    let query = costingFrom("v_costing_cost_pool_monthly_summary")
      .select(
        "period_start, allocation_pool, allocation_pool_label, staff_pool_amount, expense_provision_amount, manual_provision_amount, total_pool_amount, pool_source_type, pool_status",
      )
      .order("period_start", { ascending: false })
      .order("allocation_pool", { ascending: true });

    if (manualProvisionFilters.periodStart) {
      query = query.eq("period_start", manualProvisionFilters.periodStart);
    }

    const { data, error } = await query;
    if (error) throw error;
    manualProvisionPoolImpactRows = data || [];
  }

  function manualProvisionSearchBlob(row) {
    return [
      row.provision_key,
      row.provision_label,
      row.provision_type,
      row.provision_type_label,
      row.allocation_pool,
      row.allocation_pool_label,
      row.source_reference,
      row.remarks,
      row.provision_status,
      row.provision_note,
      row.provision_amount,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function manualProvisionImpactSearchBlob(row) {
    return [
      row.period_start,
      row.allocation_pool,
      row.allocation_pool_label,
      row.staff_pool_amount,
      row.expense_provision_amount,
      row.manual_provision_amount,
      row.total_pool_amount,
      row.pool_source_type,
      row.pool_status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function applyManualProvisionFilters() {
    const search = String(getSearchValue() || "")
      .trim()
      .toLowerCase();

    if (manualProvisionTab === "impact") {
      let rows = [...manualProvisionPoolImpactRows];

      if (search) {
        rows = rows.filter((row) =>
          manualProvisionImpactSearchBlob(row).includes(search),
        );
      }

      setRowsAndView({
        allRows: manualProvisionPoolImpactRows,
        view: rows,
        currentPage: 1,
      });
    } else {
      let rows = [...manualProvisionRows];

      if (search) {
        rows = rows.filter((row) =>
          manualProvisionSearchBlob(row).includes(search),
        );
      }

      setRowsAndView({
        allRows: manualProvisionRows,
        view: rows,
        currentPage: 1,
      });
    }

    renderTable();
    updateSearchClear();
  }

  function syncManualProvisionMetaActions() {
    if (!genericTableMetaActions) return;

    const showAdd =
      isManualProvisionsLens() && manualProvisionTab === "register";

    if (!showAdd) {
      genericTableMetaActions.innerHTML = "";
      setVisible(genericTableMetaActions, false);
      return;
    }

    genericTableMetaActions.innerHTML = `
    <button
      id="mpMetaAddBtn"
      type="button"
      class="icon-btn icon-btn-primary"
      title="Add Manual Provision"
      aria-label="Add Manual Provision"
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
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      </svg>
    </button>
  `;
    setVisible(genericTableMetaActions, true, "inline-flex");
  }

  function renderManualProvisionTabs(workbenchSummaryEl, onTabChange) {
    if (!workbenchSummaryEl) return;

    const tabs = [
      ["register", "Provision Register", "Manual entries"],
      ["impact", "Monthly Pool Impact", "Cost pool totals"],
    ];

    workbenchSummaryEl.classList.add("is-visible");
    workbenchSummaryEl.innerHTML = `
    <div class="cp-workbench-compact-summary" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
      ${tabs
        .map(
          ([id, label, hint]) => `
            <button
              type="button"
              class="cp-workbench-summary-card cp-manager-tab-card ${manualProvisionTab === id ? "active" : ""}"
              data-manual-provision-tab="${id}"
            >
              <div class="cp-card-label">${text(label)}</div>
              <div class="cp-card-value">${text(hint)}</div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

    workbenchSummaryEl
      .querySelectorAll("[data-manual-provision-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const nextTab = btn.dataset.manualProvisionTab;
          if (!nextTab || nextTab === manualProvisionTab) return;

          manualProvisionTab = nextTab;
          await onTabChange();
        });
      });
  }

  async function loadManualProvisionLensData(activePeriodStart) {
    setLoadingMask(true, "Loading Manual Provisions...");
    try {
      if (!manualProvisionFilters.periodStart) {
        manualProvisionFilters.periodStart =
          activePeriodStart || getCurrentMonthStart();
      }

      await loadManualProvisionOptions();
      await Promise.all([
        loadManualProvisionRows(),
        loadManualProvisionPoolImpactRows(),
      ]);

      applyManualProvisionFilters();
    } catch (err) {
      handleError("Failed to load Manual Provisions", err);
    } finally {
      setLoadingMask(false);
    }
  }

  function findManualProvisionRow(provisionId) {
    return (
      manualProvisionRows.find(
        (row) => Number(row.provision_id) === Number(provisionId),
      ) || null
    );
  }

  function openManualProvisionModal(provisionId = null, triggerEl = null) {
    if (!manualProvisionEditModal) return;
    const row =
      provisionId == null ? null : findManualProvisionRow(provisionId);
    selectedManualProvisionId = row?.provision_id ?? null;
    manualProvisionReturnFocus =
      triggerEl && document.contains(triggerEl)
        ? triggerEl
        : document.activeElement;
    if (manualProvisionEditTitle) {
      manualProvisionEditTitle.textContent = row
        ? "Edit Manual Provision"
        : "Add Manual Provision";
    }
    if (manualProvisionEditBanner) {
      manualProvisionEditBanner.textContent =
        "Saving updates the manual provision register. Enter monthly amount only. If the approved provision is annual, divide it by 12 and enter only the monthly value. Active provisions are included in cost pool totals. Request Costing Refresh from the toolbar when you want costing snapshots rebuilt.";
    }
    if (manualProvisionPeriodStart) {
      manualProvisionPeriodStart.value = normalizeMonthStart(
        row?.period_start ||
          manualProvisionFilters.periodStart ||
          getActivePeriodStart() ||
          new Date(),
      );
    }
    if (manualProvisionAllocationPool) {
      manualProvisionAllocationPool.value = row?.allocation_pool || "";
    }
    if (manualProvisionType) {
      manualProvisionType.value = row?.provision_type || "";
    }
    if (manualProvisionKey) {
      manualProvisionKey.value = row?.provision_key || "";
    }
    if (manualProvisionLabel) {
      manualProvisionLabel.value = row?.provision_label || "";
    }
    if (manualProvisionAmount) {
      manualProvisionAmount.value = row?.provision_amount ?? "";
    }
    if (manualProvisionSourceReference) {
      manualProvisionSourceReference.value = row?.source_reference || "";
    }
    if (manualProvisionRemarks) {
      manualProvisionRemarks.value = row?.remarks || "";
    }
    if (manualProvisionDeactivateBtn) {
      const showDeactivate = Boolean(row?.is_active);
      manualProvisionDeactivateBtn.classList.toggle("hidden", !showDeactivate);
      manualProvisionDeactivateBtn.disabled = !showDeactivate;
    }
    manualProvisionEditModal.classList.remove("hidden");
    manualProvisionEditModal.setAttribute("aria-hidden", "false");
    setTimeout(() => manualProvisionKey?.focus(), 0);
  }

  function closeManualProvisionModal(options = {}) {
    const { preserveSelection = false, skipFocusRestore = false } = options;
    if (!manualProvisionEditModal) return;

    const active = document.activeElement;
    if (active && manualProvisionEditModal.contains(active)) {
      active.blur();
    }

    manualProvisionEditModal.classList.add("hidden");
    manualProvisionEditModal.setAttribute("aria-hidden", "true");

    if (!preserveSelection) {
      selectedManualProvisionId = null;
    }

    if (manualProvisionDeactivateBtn) {
      manualProvisionDeactivateBtn.classList.add("hidden");
      manualProvisionDeactivateBtn.disabled = true;
    }

    if (skipFocusRestore) {
      manualProvisionReturnFocus = null;
      return;
    }

    const returnTarget =
      manualProvisionReturnFocus &&
      manualProvisionReturnFocus !== document.body &&
      document.contains(manualProvisionReturnFocus)
        ? manualProvisionReturnFocus
        : searchBox;

    manualProvisionReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function readManualProvisionForm() {
    const periodStart = normalizeMonthStart(
      manualProvisionPeriodStart?.value ||
        manualProvisionFilters.periodStart ||
        getActivePeriodStart() ||
        new Date(),
    );
    const allocationPool = manualProvisionAllocationPool?.value || "";
    const provisionType = manualProvisionType?.value || "";
    const provisionKey = manualProvisionKey?.value?.trim() || "";
    const provisionLabel = manualProvisionLabel?.value?.trim() || "";
    const amountRaw = String(manualProvisionAmount?.value ?? "").trim();
    const sourceReference = manualProvisionSourceReference?.value?.trim() || "";
    const remarks = manualProvisionRemarks?.value?.trim() || "";
    if (!periodStart) throw new Error("Period start is required.");
    if (!allocationPool) throw new Error("Allocation pool is required.");
    if (!provisionType) throw new Error("Provision type is required.");
    if (!provisionKey) throw new Error("Provision key is required.");
    if (!provisionLabel) throw new Error("Provision label is required.");
    if (amountRaw === "") {
      throw new Error("Monthly provision amount is required.");
    }
    const provisionAmount = Number(amountRaw);
    if (!Number.isFinite(provisionAmount) || provisionAmount < 0) {
      throw new Error(
        "Monthly provision amount must be a number greater than or equal to 0.",
      );
    }

    if (
      provisionAmount === 0 &&
      Math.max(sourceReference.length, remarks.length) < 5
    ) {
      throw new Error(
        "If monthly amount is 0, source reference or remarks must be at least 5 characters.",
      );
    }

    return {
      periodStart,
      allocationPool,
      provisionType,
      provisionKey,
      provisionLabel,
      provisionAmount,
      sourceReference,
      remarks,
    };
  }

  async function saveManualProvisionFromModal() {
    if (manualProvisionBusy) return;
    manualProvisionBusy = true;
    if (manualProvisionSaveBtn) manualProvisionSaveBtn.disabled = true;
    try {
      const values = readManualProvisionForm();
      const { error } = await costingRpc("rpc_save_manual_cost_pool_provision", {
        p_period_start: values.periodStart,
        p_allocation_pool: values.allocationPool,
        p_provision_type: values.provisionType,
        p_provision_key: values.provisionKey,
        p_provision_label: values.provisionLabel,
        p_provision_amount: values.provisionAmount,
        p_source_reference: values.sourceReference,
        p_remarks: values.remarks,
      });
      if (error) throw error;
      manualProvisionFilters.periodStart = values.periodStart;
      closeManualProvisionModal();
      await loadManualProvisionLensData(getActivePeriodStart());
      showToast(
        "Manual provision saved. Request Costing Refresh from the toolbar when you want costing snapshots rebuilt.",
        "success",
        6200,
      );
    } catch (err) {
      handleError("Failed to save Manual Provision", err);
    } finally {
      manualProvisionBusy = false;
      if (manualProvisionSaveBtn) manualProvisionSaveBtn.disabled = false;
    }
  }

  function openManualProvisionDeactivateModal(row, returnFocusEl = null) {
    if (!manualProvisionDeactivateModal) return;
    const provisionId = row?.provision_id ?? row;
    const resolvedRow = row?.provision_id != null ? row : findManualProvisionRow(provisionId);
    selectedManualProvisionId = resolvedRow?.provision_id ?? provisionId ?? null;
    manualProvisionDeactivateReturnFocus =
      returnFocusEl && document.contains(returnFocusEl)
        ? returnFocusEl
        : document.activeElement;
    if (manualProvisionDeactivateLabel) {
      manualProvisionDeactivateLabel.textContent = resolvedRow
        ? `${resolvedRow.provision_label || resolvedRow.provision_key || "--"} / ${formatMoney(resolvedRow.provision_amount)}`
        : "--";
    }
    if (manualProvisionDeactivateReason) {
      manualProvisionDeactivateReason.value = "";
    }
    manualProvisionDeactivateModal.classList.remove("hidden");
    manualProvisionDeactivateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => manualProvisionDeactivateReason?.focus(), 0);
  }

  function closeManualProvisionDeactivateModal() {
    if (!manualProvisionDeactivateModal) return;

    const active = document.activeElement;
    if (active && manualProvisionDeactivateModal.contains(active)) {
      active.blur();
    }

    manualProvisionDeactivateModal.classList.add("hidden");
    manualProvisionDeactivateModal.setAttribute("aria-hidden", "true");
    selectedManualProvisionId = null;

    const returnTarget =
      manualProvisionDeactivateReturnFocus &&
      manualProvisionDeactivateReturnFocus !== document.body &&
      document.contains(manualProvisionDeactivateReturnFocus)
        ? manualProvisionDeactivateReturnFocus
        : searchBox;

    manualProvisionDeactivateReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function openManualProvisionDeactivateFromEdit() {
    const provisionId = selectedManualProvisionId;
    if (!provisionId) return;
    const returnFocus =
      manualProvisionReturnFocus &&
      document.contains(manualProvisionReturnFocus)
        ? manualProvisionReturnFocus
        : searchBox;
    closeManualProvisionModal({
      preserveSelection: true,
      skipFocusRestore: true,
    });
    openManualProvisionDeactivateModal(provisionId, returnFocus);
  }

  async function deactivateManualProvisionFromModal() {
    if (manualProvisionBusy) return;
    if (!selectedManualProvisionId) {
      showToast("Select a manual provision to deactivate.", "error");
      return;
    }
    const reason = manualProvisionDeactivateReason?.value?.trim() || "";
    if (reason.length < 5) {
      showToast("Reason / remarks must be at least 5 characters.", "error");
      manualProvisionDeactivateReason?.focus();
      return;
    }
    manualProvisionBusy = true;
    if (manualProvisionDeactivateSaveBtn) {
      manualProvisionDeactivateSaveBtn.disabled = true;
    }
    try {
      const { error } = await costingRpc(
        "rpc_deactivate_manual_cost_pool_provision",
        {
          p_provision_id: selectedManualProvisionId,
          p_remarks: reason,
        },
      );
      if (error) throw error;
      closeManualProvisionDeactivateModal();
      await loadManualProvisionLensData(getActivePeriodStart());
      showToast(
        "Manual provision deactivated. Request Costing Refresh from the toolbar when you want costing snapshots rebuilt.",
        "success",
        6200,
      );
    } catch (err) {
      handleError("Failed to deactivate Manual Provision", err);
    } finally {
      manualProvisionBusy = false;
      if (manualProvisionDeactivateSaveBtn) {
        manualProvisionDeactivateSaveBtn.disabled = false;
      }
    }
  }

  function expenseGovernanceLaneClass(row) {
    const materiality = normalizeStatus(row.materiality_band);
    if (materiality === "HIGH") return "blocked";
    if (materiality === "MEDIUM") return "review";

    const mappingStatus = normalizeStatus(row.mapping_status || row.pool_status);
    if (mappingStatus === "ACTIVE" || mappingStatus === "READY") return "ready";
    return "";
  }

  function staffGovernanceLaneClass(row) {
    const status = normalizeStatus(row.classification_status);
    if (status === "UNCLASSIFIED" || status === "MISSING_SALARY") {
      return "blocked";
    }
    if (Number(row.total_salary_cost || 0) === 0) return "review";
    if (status === "CLASSIFIED") return "ready";
    if (status === "EXCLUDED") return "";
    return "review";
  }

  function getTableHeaders(lensId) {
    if (lensId === "cost-governance") {
      return costGovernanceHeaders(costGovernanceTab);
    }
    if (lensId === "staff-governance") {
      return staffGovernanceHeaders(staffGovernanceTab);
    }
    if (lensId === "manual-provisions") {
      return manualProvisionHeaders(manualProvisionTab);
    }
    return null;
  }

  function getTableAlignments(lensId) {
    if (lensId === "cost-governance") {
      return costGovernanceAlignments(costGovernanceTab);
    }
    if (lensId === "staff-governance") {
      return staffGovernanceAlignments(staffGovernanceTab);
    }
    if (lensId === "manual-provisions") {
      return manualProvisionAlignments(manualProvisionTab);
    }
    return null;
  }

  function renderTableRow(lensId, row, trAttrs, rowIndex) {
    if (lensId === "manual-provisions") {
      if (manualProvisionTab === "impact") {
        return `<tr data-row-index="${rowIndex}">
      <td>${formatDate(row.period_start)}</td>
      <td>${cpCellPrimary(row.allocation_pool_label || row.allocation_pool || "--")}</td>
      <td class="c-right">${formatMoney(row.staff_pool_amount)}</td>
      <td class="c-right">${formatMoney(row.expense_provision_amount)}</td>
      <td class="c-right">${cpCellPrimaryHtml(formatMoney(row.manual_provision_amount))}</td>
      <td class="c-right">${formatMoney(row.total_pool_amount)}</td>
      <td>${text(row.pool_source_type || "--")}</td>
      <td>${compactStatusText(row.pool_status)}</td>
    </tr>`;
      }

      return `<tr class="clickable" data-row-index="${rowIndex}">
    <td>${formatDate(row.period_start)}</td>
    <td>
      ${cpCellPrimary(row.allocation_pool_label || row.allocation_pool || "--")}
      <div class="cp-muted-text">${text(row.allocation_pool || "--")}</div>
    </td>
    <td>
      ${cpCellPrimary(row.provision_type_label || row.provision_type || "--")}
      <div class="cp-muted-text">${text(row.provision_type || "--")}</div>
    </td>
    <td title="${escapeHtml(row.provision_note || "")}">
      ${cpCellPrimary(row.provision_label || "--")}
      <div class="cp-muted-text">${text(row.provision_key || "--")}</div>
    </td>
    <td class="c-right">${formatMoney(row.provision_amount)}</td>
    <td>${text(row.source_reference || "--")}</td>
    <td>${manualProvisionStatusText(row)}</td>
    <td>${formatDateTime(row.updated_at || row.created_at)}</td>
  </tr>`;
    }

    if (lensId === "staff-governance") {
      const lane = staffGovernanceLaneClass(row);

      if (staffGovernanceTab === "staff-register") {
        return `<tr ${trAttrs}>
        <td class="lane-col"><span class="lane ${lane}"></span></td>
        <td>${compactStatusText(row.classification_status)}</td>
        <td>${staffDisplayBlock(row)}</td>
        <td>${text(row.designation || "--")}</td>
        <td class="c-right">${formatMoney(row.total_salary_cost)}</td>
        <td>${text(row.costing_class_label || row.costing_class || "--")}</td>
        <td>${text(row.allocation_pool || "--")}</td>
        <td>${formatDate(row.effective_from)}</td>
        <td class="c-right">${formatNumber(row.allocation_weight)}</td>
        <td>${text(row.remarks || "--")}</td>
        <td class="c-center">
          <button
            type="button"
            class="icon-btn"
            data-edit-staff-classification-index="${rowIndex}"
            title="Edit Staff Classification"
            aria-label="Edit Staff Classification"
          >
            Edit
          </button>
        </td>
      </tr>`;
      }

      if (staffGovernanceTab === "staff-pool-summary") {
        return `<tr ${trAttrs}>
        <td>${formatDate(row.period_start)}</td>
        <td>${cpCellPrimary(row.allocation_pool || "--")}</td>
        <td>${text(row.costing_class_label || row.costing_class || "--")}</td>
        <td class="c-right">${formatNumber(row.staff_count)}</td>
        <td class="c-right">${formatMoney(row.pool_amount)}</td>
        <td>${compactStatusText(row.pool_status)}</td>
      </tr>`;
      }

      return `<tr ${trAttrs}>
      <td class="lane-col"><span class="lane ${lane}"></span></td>
      <td>${compactStatusText(row.classification_status)}</td>
      <td>${staffDisplayBlock(row)}</td>
      <td>${text(row.designation || "--")}</td>
      <td>${formatDate(row.latest_salary_period_start)}</td>
      <td class="c-right">${formatMoney(row.total_salary_cost)}</td>
      <td>${text(row.costing_class_label || row.costing_class || "--")}</td>
      <td>${text(row.allocation_pool || "--")}</td>
      <td>${text(row.classification_note || row.salary_source_note || "--")}</td>
      <td class="c-center">
        <button
          type="button"
          class="icon-btn"
          data-edit-staff-classification-index="${rowIndex}"
          title="Review / Edit Staff Classification"
          aria-label="Review / Edit Staff Classification"
        >
          Review / Edit
        </button>
      </td>
    </tr>`;
    }

    if (lensId === "cost-governance") {
      const lane = expenseGovernanceLaneClass(row);

      if (costGovernanceTab === "cost-pool-summary") {
        return `<tr ${trAttrs}>
        <td>${formatDate(row.period_start)}</td>
        <td>${cpCellPrimary(row.allocation_pool_label || row.allocation_pool || "--")}</td>
        <td>${text(row.pool_source_type || "--")}</td>
        <td class="c-right">${formatMoney(row.staff_pool_amount)}</td>
        <td class="c-right">${formatMoney(row.expense_provision_amount)}</td>
        <td class="c-right">${formatMoney(row.manual_provision_amount)}</td>
        <td class="c-right">${formatMoney(row.total_pool_amount)}</td>
        <td>${compactStatusText(row.pool_status)}</td>
      </tr>`;
      }

      if (costGovernanceTab === "mapping-register") {
        return `<tr ${trAttrs}>
        <td class="lane-col"><span class="lane ${lane}"></span></td>
        <td>
          ${cpCellPrimary(row.expense_group || "--")}
          <div class="cp-muted-text">${text(row.head_name || "--")}</div>
        </td>
        <td>${text(row.allocation_pool_label || row.allocation_pool || "--")}</td>
        <td>${compactStatusText(row.mapping_status)}</td>
        <td>${row.include_in_costing === false ? text("No") : text("Yes")}</td>
        <td>${text(row.remarks || "--")}</td>
      </tr>`;
      }

      if (costGovernanceTab === "excluded") {
        return `<tr ${trAttrs}>
        <td class="lane-col"><span class="lane ${lane}"></span></td>
        <td>
          ${cpCellPrimary(row.expense_group || "--")}
          <div class="cp-muted-text">${text(row.head_name || "--")}</div>
        </td>
        <td>${text(row.allocation_pool_label || row.allocation_pool || "--")}</td>
        <td>${compactStatusText(row.mapping_status)}</td>
        <td>${row.include_in_costing === false ? text("No") : text("Yes")}</td>
        <td>${text(row.remarks || "--")}</td>
      </tr>`;
      }

      return `<tr ${trAttrs}>
      <td class="lane-col"><span class="lane ${lane}"></span></td>
      <td>
        ${cpCellPrimary(row.expense_group || "--")}
        <div class="cp-muted-text">${text(row.head_name || "--")}</div>
      </td>
      <td>${text(row.materiality_band || "--")}</td>
      <td class="c-right">${formatMoney(row.max_seen_value)}</td>
      <td>${text(row.suggested_review_note || "--")}</td>
    </tr>`;
    }

    return null;
  }

  function renderCostGovernanceTabs(workbenchSummaryEl, onTabChange) {
    if (!workbenchSummaryEl) return;

    const tabs = [
      ["unmapped", "Unmapped Heads", "Map new expense heads"],
      ["mapping-register", "Mapping Register", "Current governance map"],
      ["excluded", "Excluded", "Heads excluded from costing"],
      ["cost-pool-summary", "Cost Pool Summary", "Monthly cost pool totals"],
    ];

    workbenchSummaryEl.classList.add("is-visible");
    workbenchSummaryEl.innerHTML = `
    <div class="cp-workbench-compact-summary" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
      ${tabs
        .map(
          ([id, label, hint]) => `
            <button
              type="button"
              class="cp-workbench-summary-card cp-manager-tab-card ${costGovernanceTab === id ? "active" : ""}"
              data-cost-governance-tab="${id}"
            >
              <div class="cp-card-label">${text(label)}</div>
              <div class="cp-card-value">${text(hint)}</div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

    workbenchSummaryEl
      .querySelectorAll("[data-cost-governance-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const nextTab = btn.dataset.costGovernanceTab;
          if (!nextTab || nextTab === costGovernanceTab) return;

          costGovernanceTab = nextTab;
          await onTabChange();
        });
      });
  }

  function renderStaffGovernanceTabs(workbenchSummaryEl, onTabChange) {
    if (!workbenchSummaryEl) return;

    const tabs = [
      ["staff-review", "Staff Review Queue", "Unclassified / salary review"],
      [
        "staff-register",
        "Classification Register",
        "Current staff classifications",
      ],
      ["staff-pool-summary", "Staff Pool Summary", "Monthly staff pool totals"],
    ];

    workbenchSummaryEl.classList.add("is-visible");
    workbenchSummaryEl.innerHTML = `
    <div class="cp-workbench-compact-summary" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
      ${tabs
        .map(
          ([id, label, hint]) => `
            <button
              type="button"
              class="cp-workbench-summary-card cp-manager-tab-card ${staffGovernanceTab === id ? "active" : ""}"
              data-staff-governance-tab="${id}"
            >
              <div class="cp-card-label">${text(label)}</div>
              <div class="cp-card-value">${text(hint)}</div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

    workbenchSummaryEl
      .querySelectorAll("[data-staff-governance-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const nextTab = btn.dataset.staffGovernanceTab;
          if (!nextTab || nextTab === staffGovernanceTab) return;

          staffGovernanceTab = nextTab;
          await onTabChange();
        });
      });
  }

  function handleCostBuildRowClick(lensId, row, tr) {
    if (lensId === "manual-provisions") {
      if (manualProvisionTab === "register" && row.provision_id != null) {
        openManualProvisionModal(Number(row.provision_id), tr);
      }
      return;
    }

    if (lensId === "cost-governance") {
      if (costGovernanceTab === "unmapped") {
        openExpenseMappingEditModal(row);
      } else if (
        costGovernanceTab === "mapping-register" ||
        costGovernanceTab === "excluded"
      ) {
        openExpenseMappingDetailModal(row);
      }
    }
  }

  function wireStaffGovernanceTableActions(tableBody, getViewRow) {
    tableBody
      .querySelectorAll("[data-edit-staff-classification-index]")
      .forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const index = Number(btn.dataset.editStaffClassificationIndex);
          const row = getViewRow(index);
          if (row) openStaffClassificationEditModal(row);
        });
      });
  }

  function normalizeExpensePool(value) {
    return normalizeStatus(value);
  }

  function suggestedExpensePool(row) {
    const currentPool = normalizeExpensePool(
      row?.allocation_pool || row?.allocation_pool_label,
    );
    if (currentPool) return currentPool;

    const headText =
      `${row?.expense_group || ""} ${row?.head_name || ""}`.toUpperCase();
    if (/ROUND\s*OFF|FINE|PENALTY/.test(headText)) return "EXCLUDED";
    return "";
  }

  function populateExpensePoolSelect(selectedPool = "") {
    if (!expenseMappingPool) return;

    const normalized = normalizeExpensePool(selectedPool);
    const options = [
      '<option value="">Select allocation pool</option>',
      ...expensePoolOptions.map((option) => {
        const value =
          option.allocation_pool || option.pool_code || option.pool_name || "";
        const label =
          option.allocation_pool_label || option.pool_label || value || "--";
        const isSelected =
          normalizeExpensePool(value) === normalized ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${isSelected}>${escapeHtml(label)}</option>`;
      }),
    ];

    expenseMappingPool.innerHTML = options.join("");
    expenseMappingPool.value = selectedPool || "";
  }

  function syncExpenseMappingIncludeState() {
    if (!expenseMappingPool || !expenseMappingInclude) return;

    const isExcluded =
      normalizeExpensePool(expenseMappingPool.value) === "EXCLUDED";
    if (isExcluded) {
      expenseMappingInclude.checked = false;
      expenseMappingInclude.disabled = true;
      return;
    }

    expenseMappingInclude.disabled = false;
    expenseMappingInclude.checked = true;
  }

  function renderExpenseMappingDetailSummary(row) {
    const items = [
      ["Mapping ID", text(row.id)],
      ["Expense Group", text(row.expense_group || "--")],
      ["Head Name", text(row.head_name || "--")],
      [
        "Allocation Pool",
        `${text(row.allocation_pool_label || row.allocation_pool || "--")}${
          row.allocation_pool && row.allocation_pool_label
            ? `<div class="cp-muted-text">${text(row.allocation_pool)}</div>`
            : ""
        }`,
      ],
      ["Mapping Status", compactStatusText(row.mapping_status)],
      [
        "Include in Costing",
        row.include_in_costing === false ? text("No") : text("Yes"),
      ],
      ["Active", row.is_active === false ? text("No") : text("Yes")],
      ["Remarks", text(row.remarks || "--")],
    ];

    if (row.max_seen_value != null && row.max_seen_value !== "") {
      items.push(["Max Seen Value", formatMoney(row.max_seen_value)]);
    }
    if (row.snapshot_count != null && row.snapshot_count !== "") {
      items.push(["Snapshot Count", formatNumber(row.snapshot_count)]);
    }
    if (row.first_seen_date) {
      items.push(["First Seen", formatDate(row.first_seen_date)]);
    }
    if (row.latest_seen_date) {
      items.push(["Latest Seen", formatDate(row.latest_seen_date)]);
    }
    if (row.created_at) {
      items.push(["Created At", formatDateTime(row.created_at)]);
    }
    if (row.updated_at) {
      items.push(["Updated At", formatDateTime(row.updated_at)]);
    }

    return detailPanel([kvSection("Mapping Details", items)]);
  }

  function updateExpenseMappingDetailActions(row) {
    const isExcludedTab = costGovernanceTab === "excluded";
    const canClose =
      costGovernanceTab === "mapping-register" &&
      normalizeStatus(row?.mapping_status) === "ACTIVE" &&
      row?.id;

    if (expenseMappingDetailEditBtn) {
      expenseMappingDetailEditBtn.textContent = isExcludedTab
        ? "Edit / Reactivate Mapping"
        : "Edit Mapping";
      expenseMappingDetailEditBtn.title = expenseMappingDetailEditBtn.textContent;
      expenseMappingDetailEditBtn.setAttribute(
        "aria-label",
        expenseMappingDetailEditBtn.textContent,
      );
    }

    expenseMappingDetailCloseMappingBtn?.classList.toggle("hidden", !canClose);
  }

  function openExpenseMappingDetailModal(row, returnFocusEl = null) {
    if (!row || !expenseMappingDetailModal) return;

    expenseMappingDetailRow = row;
    expenseMappingDetailReturnFocus =
      returnFocusEl && document.contains(returnFocusEl)
        ? returnFocusEl
        : document.activeElement;

    if (expenseMappingDetailContent) {
      expenseMappingDetailContent.innerHTML =
        renderExpenseMappingDetailSummary(row);
    }

    updateExpenseMappingDetailActions(row);

    expenseMappingDetailModal.classList.remove("hidden");
    expenseMappingDetailModal.setAttribute("aria-hidden", "false");

    setTimeout(() => expenseMappingDetailEditBtn?.focus(), 0);
  }

  function closeExpenseMappingDetailModal() {
    if (!expenseMappingDetailModal) return;

    const active = document.activeElement;
    if (active && expenseMappingDetailModal.contains(active)) {
      active.blur();
    }

    expenseMappingDetailModal.classList.add("hidden");
    expenseMappingDetailModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      expenseMappingDetailReturnFocus &&
      expenseMappingDetailReturnFocus !== document.body &&
      document.contains(expenseMappingDetailReturnFocus)
        ? expenseMappingDetailReturnFocus
        : searchBox;

    expenseMappingDetailRow = null;
    expenseMappingDetailReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function openExpenseMappingEditModal(row, returnFocusEl = null) {
    if (!row || !expenseMappingEditModal) return;

    expenseMappingEditRow = row;
    expenseMappingReturnFocus =
      returnFocusEl && document.contains(returnFocusEl)
        ? returnFocusEl
        : document.activeElement;

    if (expenseMappingLabel) {
      expenseMappingLabel.textContent = `${row.expense_group || "--"} / ${row.head_name || "--"}`;
    }

    const defaultPool = suggestedExpensePool(row);
    populateExpensePoolSelect(defaultPool);

    if (expenseMappingInclude) {
      expenseMappingInclude.checked =
        normalizeExpensePool(defaultPool) === "EXCLUDED"
          ? false
          : row.include_in_costing !== false;
    }

    if (expenseMappingRemarks) {
      expenseMappingRemarks.value =
        row.remarks || row.suggested_review_note || "";
    }

    syncExpenseMappingIncludeState();

    expenseMappingEditModal.classList.remove("hidden");
    expenseMappingEditModal.setAttribute("aria-hidden", "false");

    setTimeout(() => expenseMappingPool?.focus(), 0);
  }

  function closeExpenseMappingEditModal() {
    if (!expenseMappingEditModal) return;

    const active = document.activeElement;
    if (active && expenseMappingEditModal.contains(active)) {
      active.blur();
    }

    expenseMappingEditModal.classList.add("hidden");
    expenseMappingEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      expenseMappingReturnFocus &&
      expenseMappingReturnFocus !== document.body &&
      document.contains(expenseMappingReturnFocus)
        ? expenseMappingReturnFocus
        : searchBox;

    expenseMappingReturnFocus = null;
    expenseMappingEditRow = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveExpenseMappingEdit() {
    const row = expenseMappingEditRow;
    if (!row) return;

    const pool = expenseMappingPool?.value || "";
    const remarks = expenseMappingRemarks?.value?.trim() || "";

    if (!pool) {
      showToast("Please select an allocation pool.", "error");
      expenseMappingPool?.focus();
      return;
    }

    const include =
      normalizeExpensePool(pool) === "EXCLUDED"
        ? false
        : !!expenseMappingInclude?.checked;

    expenseMappingEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving expense mapping...");

    try {
      const { error } = await costingRpc("rpc_set_expense_head_costing_map", {
        p_expense_group: row.expense_group,
        p_head_name: row.head_name,
        p_allocation_pool: pool,
        p_include_in_costing: include,
        p_remarks: remarks,
      });

      if (error) throw error;

      closeExpenseMappingEditModal();
      closeExpenseMappingDetailModal();
      showToast(
        "Expense mapping saved. Request Costing Refresh from the toolbar when you are ready to recalculate.",
        "success",
        5200,
      );
      await reloadRows();
    } catch (err) {
      handleError("Failed to save expense mapping", err);
    } finally {
      setLoadingMask(false);
      expenseMappingEditSaveBtn.disabled = false;
    }
  }

  function setExpenseMappingCloseSaveState() {
    if (!expenseMappingCloseModalSaveBtn) return;
    const reason = expenseMappingCloseReason?.value?.trim() || "";
    expenseMappingCloseModalSaveBtn.disabled = reason.length < 10;
  }

  function openExpenseMappingCloseModal(row, returnFocusEl = null) {
    if (!row?.id || !expenseMappingCloseModal) {
      showToast("Expense mapping ID missing.", "error");
      return;
    }

    expenseMappingCloseRow = row;
    expenseMappingCloseReturnFocus =
      returnFocusEl && document.contains(returnFocusEl)
        ? returnFocusEl
        : document.activeElement;

    if (expenseMappingCloseLabel) {
      expenseMappingCloseLabel.textContent = `${row.expense_group || "--"} / ${row.head_name || "--"}`;
    }
    if (expenseMappingCloseReason) expenseMappingCloseReason.value = "";

    expenseMappingCloseModal.classList.remove("hidden");
    expenseMappingCloseModal.setAttribute("aria-hidden", "false");
    setExpenseMappingCloseSaveState();
    setTimeout(() => expenseMappingCloseReason?.focus(), 0);
  }

  function closeExpenseMappingCloseModal() {
    if (!expenseMappingCloseModal) return;

    const active = document.activeElement;
    if (active && expenseMappingCloseModal.contains(active)) {
      active.blur();
    }

    expenseMappingCloseModal.classList.add("hidden");
    expenseMappingCloseModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      expenseMappingCloseReturnFocus &&
      expenseMappingCloseReturnFocus !== document.body &&
      document.contains(expenseMappingCloseReturnFocus)
        ? expenseMappingCloseReturnFocus
        : expenseMappingDetailModal?.classList.contains("hidden")
          ? searchBox
          : expenseMappingDetailCloseBtn;

    expenseMappingCloseRow = null;
    expenseMappingCloseReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveExpenseMappingClose() {
    const row = expenseMappingCloseRow;
    if (!row?.id) {
      showToast("Expense mapping ID missing.", "error");
      return;
    }

    const closeReason = expenseMappingCloseReason?.value?.trim() || "";
    if (closeReason.length < 10) {
      showToast("Close reason must be at least 10 characters.", "error");
      setExpenseMappingCloseSaveState();
      return;
    }

    if (expenseMappingCloseModalSaveBtn) {
      expenseMappingCloseModalSaveBtn.disabled = true;
    }
    setLoadingMask(true, "Closing expense mapping...");

    try {
      const { error } = await costingRpc("rpc_close_expense_head_costing_map", {
        p_mapping_id: row.id,
        p_remarks: closeReason,
      });

      if (error) throw error;

      closeExpenseMappingCloseModal();
      closeExpenseMappingDetailModal();
      showToast("Expense mapping closed.", "success");
      await reloadRows();
    } catch (err) {
      handleError("Failed to close expense mapping", err);
    } finally {
      setLoadingMask(false);
      setExpenseMappingCloseSaveState();
    }
  }

  function populateStaffClassificationClassSelect(selectedClass = "") {
    if (!staffClassificationClass) return;

    const normalized = normalizeStatus(selectedClass);
    const options = [
      '<option value="">Select costing class</option>',
      ...staffClassOptions.map((option) => {
        const value = option.costing_class || "";
        const label = option.costing_class_label || value || "--";
        const pool = option.default_allocation_pool || "";
        const selected =
          normalizeStatus(value) === normalized ? " selected" : "";
        return `<option value="${escapeHtml(value)}" data-pool="${escapeHtml(pool)}"${selected}>${escapeHtml(label)}</option>`;
      }),
    ];

    staffClassificationClass.innerHTML = options.join("");
    staffClassificationClass.value = selectedClass || "";
  }

  function syncStaffClassificationPool() {
    if (!staffClassificationClass || !staffClassificationPool) return;

    const selectedOption = staffClassificationClass.selectedOptions?.[0] || null;

    staffClassificationPool.value = selectedOption?.dataset?.pool || "";
  }

  function readStaffClassificationFormValues() {
    return {
      costingClass: staffClassificationClass?.value || "",
      allocationPool: staffClassificationPool?.value || "",
      effectiveFrom:
        staffClassificationEffectiveFrom?.value || activePeriodIso(),
      allocationWeight: numberOrNullFromInput(staffClassificationWeight),
      remarks: staffClassificationRemarks?.value?.trim() || "",
    };
  }

  function setStaffClassificationSaveState() {
    if (!staffClassificationEditSaveBtn) return;

    const values = readStaffClassificationFormValues();
    const valid =
      !!staffClassificationEditRow?.staff_id &&
      !!values.costingClass &&
      !!values.allocationPool &&
      !!values.effectiveFrom &&
      Number(values.allocationWeight || 0) > 0 &&
      Number(values.allocationWeight || 0) <= 1 &&
      values.remarks.length >= 5;

    staffClassificationEditSaveBtn.disabled = !valid;
  }

  function openStaffClassificationEditModal(row) {
    if (!row || !staffClassificationEditModal) return;

    staffClassificationEditRow = row;
    staffClassificationReturnFocus = document.activeElement;

    if (staffClassificationLabel) {
      staffClassificationLabel.textContent = [
        staffDisplayName(row),
        `Code: ${row.employee_code || "--"}`,
        `Staff ID: ${row.staff_id || "--"}`,
        row.designation || "--",
      ].join(" / ");
    }

    populateStaffClassificationClassSelect(row.costing_class || "");

    syncStaffClassificationPool();

    if (staffClassificationEffectiveFrom) {
      staffClassificationEffectiveFrom.value =
        row.effective_from || activePeriodIso();
    }

    if (staffClassificationWeight) {
      staffClassificationWeight.value =
        row.allocation_weight !== null &&
        row.allocation_weight !== undefined &&
        row.allocation_weight !== ""
          ? Number(row.allocation_weight)
          : 1;
    }

    if (staffClassificationRemarks) {
      staffClassificationRemarks.value =
        row.remarks ||
        row.classification_note ||
        "Staff costing classification review";
    }

    staffClassificationEditModal.classList.remove("hidden");
    staffClassificationEditModal.setAttribute("aria-hidden", "false");

    setStaffClassificationSaveState();

    setTimeout(() => staffClassificationClass?.focus(), 0);
  }

  function closeStaffClassificationEditModal() {
    if (!staffClassificationEditModal) return;

    const active = document.activeElement;
    if (active && staffClassificationEditModal.contains(active)) {
      active.blur();
    }

    staffClassificationEditModal.classList.add("hidden");
    staffClassificationEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      staffClassificationReturnFocus &&
      staffClassificationReturnFocus !== document.body &&
      document.contains(staffClassificationReturnFocus)
        ? staffClassificationReturnFocus
        : searchBox;

    staffClassificationEditRow = null;
    staffClassificationReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveStaffClassificationEdit() {
    const row = staffClassificationEditRow;
    if (!row?.staff_id) {
      showToast("Staff ID missing for selected row.", "error");
      return;
    }

    const values = readStaffClassificationFormValues();

    if (!values.costingClass) {
      showToast("Please select a costing class.", "error");
      staffClassificationClass?.focus();
      return;
    }

    if (!values.allocationPool) {
      showToast(
        "Allocation pool could not be resolved from costing class.",
        "error",
      );
      return;
    }

    if (!values.effectiveFrom) {
      showToast("Effective from date is required.", "error");
      staffClassificationEffectiveFrom?.focus();
      return;
    }

    if (
      !values.allocationWeight ||
      values.allocationWeight <= 0 ||
      values.allocationWeight > 1
    ) {
      showToast(
        "Allocation weight must be greater than 0 and not more than 1.",
        "error",
      );
      staffClassificationWeight?.focus();
      return;
    }

    if (!values.remarks || values.remarks.length < 5) {
      showToast("Remarks / approval reference is required.", "error");
      staffClassificationRemarks?.focus();
      return;
    }

    staffClassificationEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving staff classification...");

    try {
      const { error } = await costingRpc("rpc_set_staff_costing_classification", {
        p_staff_id: row.staff_id,
        p_costing_class: values.costingClass,
        p_allocation_pool: values.allocationPool,
        p_effective_from: values.effectiveFrom,
        p_allocation_weight: values.allocationWeight,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeStaffClassificationEditModal();

      showToast(
        "Staff classification saved. Request Costing Refresh from the toolbar when you are ready to recalculate.",
        "success",
        6200,
      );

      await reloadRows();
    } catch (err) {
      handleError("Failed to save staff classification", err);
    } finally {
      setLoadingMask(false);
      if (staffClassificationEditSaveBtn) {
        staffClassificationEditSaveBtn.disabled = false;
      }
      setStaffClassificationSaveState();
    }
  }

  function closeStaffGovernanceReviewModal() {
    if (!staffGovernanceReviewModal) return;

    const active = document.activeElement;
    if (active && staffGovernanceReviewModal.contains(active)) {
      active.blur();
    }

    staffGovernanceReviewModal.classList.add("hidden");
    staffGovernanceReviewModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      staffGovernanceReviewReturnFocus &&
      staffGovernanceReviewReturnFocus !== document.body &&
      document.contains(staffGovernanceReviewReturnFocus)
        ? staffGovernanceReviewReturnFocus
        : searchBox;

    staffGovernanceReviewReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      requestAnimationFrame(() => returnTarget.focus());
    }
  }

  function handleEscapeKey() {
    if (!expenseMappingEditModal?.classList.contains("hidden")) {
      closeExpenseMappingEditModal();
      return true;
    }
    if (!expenseMappingCloseModal?.classList.contains("hidden")) {
      closeExpenseMappingCloseModal();
      return true;
    }
    if (!expenseMappingDetailModal?.classList.contains("hidden")) {
      closeExpenseMappingDetailModal();
      return true;
    }
    if (!manualProvisionEditModal?.classList.contains("hidden")) {
      closeManualProvisionModal();
      return true;
    }
    if (!manualProvisionDeactivateModal?.classList.contains("hidden")) {
      closeManualProvisionDeactivateModal();
      return true;
    }
    if (
      staffClassificationEditModal &&
      !staffClassificationEditModal.classList.contains("hidden")
    ) {
      closeStaffClassificationEditModal();
      return true;
    }
    if (!staffGovernanceReviewModal?.classList.contains("hidden")) {
      closeStaffGovernanceReviewModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    staffClassificationEditCloseBtn?.addEventListener(
      "click",
      closeStaffClassificationEditModal,
    );
    staffClassificationEditCancelBtn?.addEventListener(
      "click",
      closeStaffClassificationEditModal,
    );
    staffClassificationEditSaveBtn?.addEventListener(
      "click",
      saveStaffClassificationEdit,
    );
    staffClassificationClass?.addEventListener("change", () => {
      syncStaffClassificationPool();
      setStaffClassificationSaveState();
    });
    staffClassificationEffectiveFrom?.addEventListener(
      "input",
      setStaffClassificationSaveState,
    );
    staffClassificationWeight?.addEventListener(
      "input",
      setStaffClassificationSaveState,
    );
    staffClassificationRemarks?.addEventListener(
      "input",
      setStaffClassificationSaveState,
    );
    manualProvisionEditCloseBtn?.addEventListener(
      "click",
      closeManualProvisionModal,
    );
    manualProvisionCancelBtn?.addEventListener("click", closeManualProvisionModal);
    manualProvisionDeactivateBtn?.addEventListener(
      "click",
      openManualProvisionDeactivateFromEdit,
    );
    manualProvisionSaveBtn?.addEventListener("click", saveManualProvisionFromModal);
    genericTableMetaActions?.addEventListener("click", (event) => {
      const addBtn = event.target?.closest?.("#mpMetaAddBtn");
      if (!addBtn) return;
      openManualProvisionModal(null, addBtn);
    });
    manualProvisionKey?.addEventListener("blur", () => {
      if (!manualProvisionKey) return;
      const normalized = manualProvisionKey.value
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase();
      if (normalized) manualProvisionKey.value = normalized;
    });
    manualProvisionEditModal?.addEventListener("click", (event) => {
      if (event.target === manualProvisionEditModal) closeManualProvisionModal();
    });
    manualProvisionDeactivateCloseBtn?.addEventListener(
      "click",
      closeManualProvisionDeactivateModal,
    );
    manualProvisionDeactivateCancelBtn?.addEventListener(
      "click",
      closeManualProvisionDeactivateModal,
    );
    manualProvisionDeactivateSaveBtn?.addEventListener(
      "click",
      deactivateManualProvisionFromModal,
    );
    manualProvisionDeactivateModal?.addEventListener("click", (event) => {
      if (event.target === manualProvisionDeactivateModal) {
        closeManualProvisionDeactivateModal();
      }
    });
    staffClassificationEditModal?.addEventListener("click", (event) => {
      if (event.target === staffClassificationEditModal) {
        closeStaffClassificationEditModal();
      }
    });
    expenseMappingEditCloseBtn?.addEventListener(
      "click",
      closeExpenseMappingEditModal,
    );
    expenseMappingEditCancelBtn?.addEventListener(
      "click",
      closeExpenseMappingEditModal,
    );
    expenseMappingEditSaveBtn?.addEventListener("click", saveExpenseMappingEdit);
    expenseMappingPool?.addEventListener("change", syncExpenseMappingIncludeState);
    expenseMappingEditModal?.addEventListener("click", (e) => {
      if (e.target === expenseMappingEditModal) closeExpenseMappingEditModal();
    });
    expenseMappingDetailCloseBtn?.addEventListener(
      "click",
      closeExpenseMappingDetailModal,
    );
    expenseMappingDetailEditBtn?.addEventListener("click", () => {
      const row = expenseMappingDetailRow;
      if (!row) return;
      const returnFocus = expenseMappingDetailReturnFocus;
      closeExpenseMappingDetailModal();
      openExpenseMappingEditModal(row, returnFocus);
    });
    expenseMappingDetailCloseMappingBtn?.addEventListener("click", () => {
      const row = expenseMappingDetailRow;
      if (!row) return;
      openExpenseMappingCloseModal(row, expenseMappingDetailCloseMappingBtn);
    });
    expenseMappingDetailModal?.addEventListener("click", (e) => {
      if (e.target === expenseMappingDetailModal) {
        closeExpenseMappingDetailModal();
      }
    });
    expenseMappingCloseModalCloseBtn?.addEventListener(
      "click",
      closeExpenseMappingCloseModal,
    );
    expenseMappingCloseModalCancelBtn?.addEventListener(
      "click",
      closeExpenseMappingCloseModal,
    );
    expenseMappingCloseModalSaveBtn?.addEventListener(
      "click",
      saveExpenseMappingClose,
    );
    expenseMappingCloseReason?.addEventListener(
      "input",
      setExpenseMappingCloseSaveState,
    );
    expenseMappingCloseModal?.addEventListener("click", (e) => {
      if (e.target === expenseMappingCloseModal) closeExpenseMappingCloseModal();
    });
    staffGovernanceReviewCloseBtn?.addEventListener(
      "click",
      closeStaffGovernanceReviewModal,
    );
    staffGovernanceReviewOkBtn?.addEventListener(
      "click",
      closeStaffGovernanceReviewModal,
    );
    staffGovernanceReviewModal?.addEventListener("click", (event) => {
      if (event.target === staffGovernanceReviewModal) {
        closeStaffGovernanceReviewModal();
      }
    });
  }

  return {
    bindEvents,
    handleEscapeKey,
    loadOptions,
    getCostGovernanceTab,
    getStaffGovernanceTab,
    getManualProvisionTab,
    setManualProvisionPeriodFilter,
    loadCostGovernanceRows,
    loadStaffGovernanceRows,
    loadManualProvisionLensData,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    renderCostGovernanceTabs,
    renderStaffGovernanceTabs,
    renderManualProvisionTabs,
    syncManualProvisionLayout,
    syncManualProvisionMetaActions,
    applyManualProvisionFilters,
    handleCostBuildRowClick,
    wireStaffGovernanceTableActions,
    openExpenseMappingEditModal,
    openExpenseMappingDetailModal,
    openExpenseMappingCloseModal,
    openStaffClassificationEditModal,
    closeStaffClassificationEditModal,
    closeStaffGovernanceReviewModal,
    openManualProvisionModal,
    closeManualProvisionModal,
    openManualProvisionDeactivateModal,
    closeManualProvisionDeactivateModal,
  };
}
