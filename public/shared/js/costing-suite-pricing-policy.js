export const PRICING_POLICY_LENS_IDS = ["policy-manager", "scheme-comparison"];

export function isPricingPolicyLens(lensId) {
  return PRICING_POLICY_LENS_IDS.includes(lensId);
}

const SCHEME_COMPARISON_HEADERS = [
  "Product / SKU",
  "Scheme",
  "IK Net Realisation",
  "IK Margin %",
  "IK Margin Band",
  "OK Net Realisation",
  "OK Margin %",
  "OK Margin Band",
  "Status",
];

const SCHEME_COMPARISON_ALIGNMENTS = [
  "c-left",
  "c-left",
  "c-right",
  "c-right",
  "c-left",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
];

function policyManagerHeaders(tab) {
  if (tab === "scheme-rule-register") {
    return [
      "Rule",
      "Scope",
      "Region",
      "Scheme",
      "Apply Mode",
      "Effective From",
      "Effective To",
      "Status",
      "Remarks",
      "Action",
    ];
  }
  return [
    "Product / SKU",
    "MRP IK",
    "MRP OK",
    "GST %",
    "Discount IK %",
    "Discount OK %",
    "Contingency %",
    "Scheme IK",
    "Scheme OK",
    "Pricing Status",
    "Selling Price Status",
  ];
}

function policyManagerAlignments(tab) {
  if (tab === "scheme-rule-register") {
    return [
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-center",
    ];
  }
  return [
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ];
}

export function createPricingPolicyController(deps) {
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
    reloadRows,
    onPolicyDataChanged,
    getCurrentLens,
    getSelectedSkuId,
  } = deps;

  let policyManagerTab = "sku-overview";
  let schemeOptions = [];
  let schemeRuleScopeOptions = [];
  let sellingPolicyEditRow = null;
  let sellingPolicyReturnFocus = null;
  let sellingPolicyInitial = null;
  let schemePolicyEditRow = null;
  let schemePolicyReturnFocus = null;
  let schemePolicyInitial = { region: null, schemeId: null };
  let schemeRuleEditReturnFocus = null;
  let schemeRuleCloseRow = null;
  let schemeRuleCloseReturnFocus = null;

  async function loadSchemeOptions() {
    const { data, error } = await costingFrom(
      "v_costing_policy_manager_scheme_options",
    )
      .select("*")
      .order("paid_qty", { ascending: true })
      .order("free_qty", { ascending: true })
      .order("scheme_name", { ascending: true });

    if (error) throw error;
    schemeOptions = data || [];
  }

  async function loadSchemeRuleScopeOptions() {
    schemeRuleScopeOptions = await fetchAllRows(
      () =>
        costingFrom("v_costing_scheme_policy_scope_options")
          .select("*")
          .order("policy_scope", { ascending: true })
          .order("display_name", { ascending: true }),
      1000,
    );
  }

  async function loadOptions() {
    await loadSchemeOptions();
    await loadSchemeRuleScopeOptions();
  }

  function getPolicyManagerTab() {
    return policyManagerTab;
  }

  function setPolicyManagerTab(tabId) {
    policyManagerTab = tabId || "sku-overview";
  }

  async function loadPolicyManagerRows() {
    if (policyManagerTab === "scheme-rule-register") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_scheme_policy_rule_register")
            .select("*")
            .order("rule_status", { ascending: true })
            .order("policy_rule_id", { ascending: false }),
        1000,
      );
    }
    return fetchAllRows(
      () =>
        costingFrom("v_costing_policy_manager_sku_overview")
          .select("*")
          .order("product_name", { ascending: true })
          .order("pack_size", { ascending: true }),
      1000,
    );
  }

  async function loadSchemeComparisonRows(periodStart) {
    return fetchAllRows(() =>
      costingFrom("v_costing_pricing_sku_scheme_comparison")
        .select("*")
        .eq("period_start", periodStart)
        .order("sku_display_name", { ascending: true }),
    );
  }

  async function fetchSellingPolicyHistory(row) {
    if (!row?.sku_id) return [];

    const { data, error } = await costingFrom(
      "v_costing_policy_manager_selling_policy_history",
    )
      .select("*")
      .eq("sku_id", row.sku_id)
      .order("effective_from", { ascending: false })
      .order("policy_id", { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  }

  async function fetchSchemePolicyHistory(row) {
    if (!row?.sku_id) return [];

    const { data, error } = await costingFrom(
      "v_costing_policy_manager_scheme_policy_history",
    )
      .select("*")
      .eq("sku_id", row.sku_id)
      .order("region_code", { ascending: true })
      .order("effective_from", { ascending: false })
      .order("policy_id", { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  }

  function normalizePolicyNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function samePolicyNumber(a, b) {
    const an = a === null || a === undefined || a === "" ? null : Number(a);
    const bn = b === null || b === undefined || b === "" ? null : Number(b);

    if (an === null && bn === null) return true;
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;

    return Math.abs(an - bn) < 0.000001;
  }

  function readSellingPolicyFormValues() {
    return {
      gstPercent: numberOrZeroFromInput(dom.sellingPolicyGstPercent),
      ikDiscountPercent: numberOrZeroFromInput(dom.sellingPolicyIkDiscountPercent),
      okDiscountPercent: numberOrZeroFromInput(dom.sellingPolicyOkDiscountPercent),
      ikDiscountAmount: numberOrNullFromInput(dom.sellingPolicyIkDiscountAmount),
      okDiscountAmount: numberOrNullFromInput(dom.sellingPolicyOkDiscountAmount),
      contingencyPercent: numberOrZeroFromInput(dom.sellingPolicyContingencyPercent),
      effectiveFrom: dom.sellingPolicyEffectiveFrom?.value || activePeriodIso(),
      remarks: dom.sellingPolicyRemarks?.value?.trim() || null,
    };
  }

  function setSellingPolicySaveState() {
    if (!dom.sellingPolicyEditSaveBtn || !sellingPolicyInitial) return;

    const current = readSellingPolicyFormValues();

    const changed =
      !samePolicyNumber(current.gstPercent, sellingPolicyInitial.gstPercent) ||
      !samePolicyNumber(
        current.ikDiscountPercent,
        sellingPolicyInitial.ikDiscountPercent,
      ) ||
      !samePolicyNumber(
        current.okDiscountPercent,
        sellingPolicyInitial.okDiscountPercent,
      ) ||
      !samePolicyNumber(
        current.ikDiscountAmount,
        sellingPolicyInitial.ikDiscountAmount,
      ) ||
      !samePolicyNumber(
        current.okDiscountAmount,
        sellingPolicyInitial.okDiscountAmount,
      ) ||
      !samePolicyNumber(
        current.contingencyPercent,
        sellingPolicyInitial.contingencyPercent,
      );

    dom.sellingPolicyEditSaveBtn.disabled = !changed;
  }

  function openSellingPolicyEditModal(row) {
    if (!row || !dom.sellingPolicyEditModal) return;

    sellingPolicyEditRow = row;
    sellingPolicyReturnFocus = document.activeElement;

    const skuLabel =
      row.sku_display_name || row.sku_column_label || row.sku_id || "--";

    if (dom.sellingPolicyEditSkuLabel) {
      dom.sellingPolicyEditSkuLabel.textContent = skuLabel;
    }

    const initial = {
      gstPercent: normalizePolicyNumber(row.gst_percent, 12),
      ikDiscountPercent: normalizePolicyNumber(row.ik_discount_percent, 0),
      okDiscountPercent: normalizePolicyNumber(row.ok_discount_percent, 0),
      ikDiscountAmount:
        row.ik_discount_amount === null || row.ik_discount_amount === undefined
          ? null
          : Number(row.ik_discount_amount),
      okDiscountAmount:
        row.ok_discount_amount === null || row.ok_discount_amount === undefined
          ? null
          : Number(row.ok_discount_amount),
      contingencyPercent: normalizePolicyNumber(row.contingency_percent, 2),
    };

    sellingPolicyInitial = initial;

    if (dom.sellingPolicyGstPercent)
      dom.sellingPolicyGstPercent.value = initial.gstPercent;
    if (dom.sellingPolicyIkDiscountPercent)
      dom.sellingPolicyIkDiscountPercent.value = initial.ikDiscountPercent;
    if (dom.sellingPolicyOkDiscountPercent)
      dom.sellingPolicyOkDiscountPercent.value = initial.okDiscountPercent;
    if (dom.sellingPolicyIkDiscountAmount)
      dom.sellingPolicyIkDiscountAmount.value =
        initial.ikDiscountAmount === null ? "" : initial.ikDiscountAmount;
    if (dom.sellingPolicyOkDiscountAmount)
      dom.sellingPolicyOkDiscountAmount.value =
        initial.okDiscountAmount === null ? "" : initial.okDiscountAmount;
    if (dom.sellingPolicyContingencyPercent)
      dom.sellingPolicyContingencyPercent.value = initial.contingencyPercent;
    if (dom.sellingPolicyEffectiveFrom) {
      dom.sellingPolicyEffectiveFrom.value =
        row.selling_price_effective_from || activePeriodIso();
    }
    if (dom.sellingPolicyRemarks) dom.sellingPolicyRemarks.value = "";

    dom.sellingPolicyEditModal.classList.remove("hidden");
    dom.sellingPolicyEditModal.setAttribute("aria-hidden", "false");

    setSellingPolicySaveState();

    setTimeout(() => dom.sellingPolicyGstPercent?.focus(), 0);
  }

  function closeSellingPolicyEditModal() {
    if (!dom.sellingPolicyEditModal) return;

    const active = document.activeElement;
    if (active && dom.sellingPolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.sellingPolicyEditModal.classList.add("hidden");
    dom.sellingPolicyEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      sellingPolicyReturnFocus &&
      sellingPolicyReturnFocus !== document.body &&
      document.contains(sellingPolicyReturnFocus)
        ? sellingPolicyReturnFocus
        : dom.drawerClose;

    sellingPolicyReturnFocus = null;
    sellingPolicyEditRow = null;
    sellingPolicyInitial = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSellingPolicyEdit() {
    const row = sellingPolicyEditRow;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }

    const values = readSellingPolicyFormValues();

    const changed =
      !samePolicyNumber(values.gstPercent, sellingPolicyInitial?.gstPercent) ||
      !samePolicyNumber(
        values.ikDiscountPercent,
        sellingPolicyInitial?.ikDiscountPercent,
      ) ||
      !samePolicyNumber(
        values.okDiscountPercent,
        sellingPolicyInitial?.okDiscountPercent,
      ) ||
      !samePolicyNumber(
        values.ikDiscountAmount,
        sellingPolicyInitial?.ikDiscountAmount,
      ) ||
      !samePolicyNumber(
        values.okDiscountAmount,
        sellingPolicyInitial?.okDiscountAmount,
      ) ||
      !samePolicyNumber(
        values.contingencyPercent,
        sellingPolicyInitial?.contingencyPercent,
      );

    if (!changed) {
      showToast("No selling policy change detected.", "info");
      setSellingPolicySaveState();
      return;
    }

    dom.sellingPolicyEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving selling price policy...");

    try {
      const { error } = await costingRpc("rpc_set_sku_selling_price_policy", {
        p_sku_id: row.sku_id,
        p_gst_percent: values.gstPercent,
        p_ik_discount_percent: values.ikDiscountPercent,
        p_ok_discount_percent: values.okDiscountPercent,
        p_ik_discount_amount: values.ikDiscountAmount,
        p_ok_discount_amount: values.okDiscountAmount,
        p_contingency_percent: values.contingencyPercent,
        p_effective_from: values.effectiveFrom,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeSellingPolicyEditModal();
      showToast(
        "Selling policy saved. Request Costing Refresh from the toolbar when you want derived values recalculated.",
        "success",
        5200,
      );

      await onPolicyDataChanged({ drawerTab: "selling-policy", skuId: row.sku_id });
    } catch (err) {
      handleError("Failed to save selling price policy", err);
    } finally {
      setLoadingMask(false);
      dom.sellingPolicyEditSaveBtn.disabled = false;
      setSellingPolicySaveState();
    }
  }

  function schemeIdForRegion(row, region) {
    if (!row) return null;
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row.ik_selected_scheme_id ?? null;
    if (r === "OK") return row.ok_selected_scheme_id ?? null;
    return null;
  }

  function schemeNameForRegion(row, region) {
    if (!row) return "";
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row.ik_selected_scheme_name || "";
    if (r === "OK") return row.ok_selected_scheme_name || "";
    return "";
  }

  function setSchemePolicySaveState() {
    if (!dom.schemePolicyEditSaveBtn) return;

    const currentSchemeId = Number(dom.schemePolicyEditScheme?.value || 0);
    const initialSchemeId = Number(schemePolicyInitial.schemeId || 0);

    const hasSchemeChange =
      currentSchemeId > 0 &&
      initialSchemeId > 0 &&
      currentSchemeId !== initialSchemeId;

    dom.schemePolicyEditSaveBtn.disabled = !hasSchemeChange;
  }

  function populateSchemePolicySelectionForRegion(region) {
    const row = schemePolicyEditRow;
    if (!row || !dom.schemePolicyEditScheme) return;

    const currentSchemeName = schemeNameForRegion(row, region);
    const currentSchemeId =
      schemeIdForRegion(row, region) ??
      schemeOptions.find(
        (s) => String(s.scheme_name || "") === String(currentSchemeName || ""),
      )?.scheme_id ??
      null;
    schemePolicyInitial = {
      region,
      schemeId: currentSchemeId,
    };

    if (currentSchemeId) {
      dom.schemePolicyEditScheme.value = String(currentSchemeId);
    }

    setSchemePolicySaveState();
  }

  function populateSchemeRuleSchemeOptions() {
    if (!dom.schemeRuleScheme || !dom.schemeRuleReplaceFromScheme) return;

    const options = schemeOptions
      .map(
        (s) =>
          `<option value="${text(s.scheme_id)}">
        ${text(s.scheme_name)} (${formatNumber(s.paid_qty)} + ${formatNumber(s.free_qty)})
      </option>`,
      )
      .join("");

    dom.schemeRuleScheme.innerHTML = options;
    dom.schemeRuleReplaceFromScheme.innerHTML = options;
  }

  function populateSchemeRuleScopeOptions() {
    if (
      !dom.schemeRuleScope ||
      !dom.schemeRuleScopeSearch ||
      !dom.schemeRuleScopeSelect
    ) {
      return;
    }

    const selectedScope = dom.schemeRuleScope.value || "PRODUCT";
    const q = String(dom.schemeRuleScopeSearch.value || "")
      .trim()
      .toLowerCase();

    let rows = schemeRuleScopeOptions.filter(
      (row) => row.policy_scope === selectedScope,
    );

    if (q) {
      rows = rows.filter((row) =>
        [
          row.display_name,
          row.scope_name,
          row.category_name,
          row.subcategory_name,
          row.group_name,
          row.sub_group_name,
          row.product_name,
          row.scope_key,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    rows = rows.slice(0, 250);

    dom.schemeRuleScopeSelect.innerHTML = rows.length
      ? rows
          .map(
            (row) =>
              `<option value="${text(row.scope_key)}" data-scope-id="${text(row.scope_id)}">
              ${text(row.display_name)}
            </option>`,
          )
          .join("")
      : `<option value="">No matching scope found</option>`;
  }

  function syncSchemeRuleApplyModeUi() {
    if (!dom.schemeRuleApplyMode || !dom.schemeRuleReplaceFromWrap) return;

    const isReplace = dom.schemeRuleApplyMode.value === "REPLACE_EXISTING_SCHEME";

    dom.schemeRuleReplaceFromWrap.style.display = isReplace ? "" : "none";
  }

  function readSchemeRuleFormValues() {
    const selectedOption =
      dom.schemeRuleScopeSelect?.selectedOptions?.[0] || null;

    return {
      policyScope: dom.schemeRuleScope?.value || "",
      scopeKey: dom.schemeRuleScopeSelect?.value || "",
      scopeId: selectedOption?.dataset?.scopeId
        ? Number(selectedOption.dataset.scopeId)
        : null,
      regionCode: dom.schemeRuleRegion?.value || "",
      schemeId: dom.schemeRuleScheme?.value
        ? Number(dom.schemeRuleScheme.value)
        : null,
      applyMode: dom.schemeRuleApplyMode?.value || "ALL_MATCHING",
      replaceFromSchemeId:
        dom.schemeRuleApplyMode?.value === "REPLACE_EXISTING_SCHEME" &&
        dom.schemeRuleReplaceFromScheme?.value
          ? Number(dom.schemeRuleReplaceFromScheme.value)
          : null,
      effectiveFrom: dom.schemeRuleEffectiveFrom?.value || activePeriodIso(),
      remarks: dom.schemeRuleRemarks?.value?.trim() || "",
    };
  }

  function setSchemeRuleSaveState() {
    if (!dom.schemeRuleEditSaveBtn) return;

    const values = readSchemeRuleFormValues();

    const valid =
      values.policyScope &&
      values.scopeId &&
      values.regionCode &&
      values.schemeId &&
      values.effectiveFrom &&
      values.remarks.length >= 5 &&
      (values.applyMode !== "REPLACE_EXISTING_SCHEME" ||
        values.replaceFromSchemeId);

    dom.schemeRuleEditSaveBtn.disabled = !valid;
  }

  function openSchemeRuleEditModal(row = null) {
    if (!dom.schemeRuleEditModal) return;

    schemeRuleEditReturnFocus = document.activeElement;

    populateSchemeRuleSchemeOptions();

    if (dom.schemeRuleScope) {
      dom.schemeRuleScope.value = row?.sku_id ? "SKU" : "PRODUCT";
    }

    if (dom.schemeRuleScopeSearch) {
      dom.schemeRuleScopeSearch.value =
        row?.product_name || row?.sku_display_name || "";
    }

    if (dom.schemeRuleRegion) {
      dom.schemeRuleRegion.value = "IK";
    }

    if (dom.schemeRuleApplyMode) {
      dom.schemeRuleApplyMode.value = "MISSING_ONLY";
    }

    if (dom.schemeRuleEffectiveFrom) {
      dom.schemeRuleEffectiveFrom.value = activePeriodIso();
    }

    if (dom.schemeRuleRemarks) {
      dom.schemeRuleRemarks.value = "";
    }

    populateSchemeRuleScopeOptions();

    if (row?.sku_id && dom.schemeRuleScopeSelect) {
      const skuKey = `SKU:${row.sku_id}`;
      if (
        [...dom.schemeRuleScopeSelect.options].some((opt) => opt.value === skuKey)
      ) {
        dom.schemeRuleScopeSelect.value = skuKey;
      }
    } else if (row?.product_id && dom.schemeRuleScopeSelect) {
      const productKey = `PRODUCT:${row.product_id}`;
      if (
        [...dom.schemeRuleScopeSelect.options].some(
          (opt) => opt.value === productKey,
        )
      ) {
        dom.schemeRuleScopeSelect.value = productKey;
      }
    }

    syncSchemeRuleApplyModeUi();
    setSchemeRuleSaveState();

    dom.schemeRuleEditModal.classList.remove("hidden");
    dom.schemeRuleEditModal.setAttribute("aria-hidden", "false");

    setTimeout(() => dom.schemeRuleScopeSearch?.focus(), 0);
  }

  function closeSchemeRuleEditModal() {
    if (!dom.schemeRuleEditModal) return;

    const active = document.activeElement;
    if (active && dom.schemeRuleEditModal.contains(active)) {
      active.blur();
    }

    dom.schemeRuleEditModal.classList.add("hidden");
    dom.schemeRuleEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      schemeRuleEditReturnFocus &&
      schemeRuleEditReturnFocus !== document.body &&
      document.contains(schemeRuleEditReturnFocus)
        ? schemeRuleEditReturnFocus
        : dom.drawerClose;

    schemeRuleEditReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemeRuleEdit() {
    const values = readSchemeRuleFormValues();

    if (!values.scopeId) {
      showToast("Please select a valid scope.", "error");
      setSchemeRuleSaveState();
      return;
    }

    if (!values.schemeId) {
      showToast("Please select a scheme.", "error");
      setSchemeRuleSaveState();
      return;
    }

    if (!values.remarks || values.remarks.length < 5) {
      showToast("Remarks / approval reference is required.", "error");
      setSchemeRuleSaveState();
      return;
    }

    if (
      values.applyMode === "REPLACE_EXISTING_SCHEME" &&
      !values.replaceFromSchemeId
    ) {
      showToast("Please select the scheme to replace.", "error");
      setSchemeRuleSaveState();
      return;
    }

    dom.schemeRuleEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving hierarchy scheme rule...");

    try {
      const { error } = await costingRpc("rpc_set_scheme_policy_rule", {
        p_policy_scope: values.policyScope,
        p_scope_id: values.scopeId,
        p_region_code: values.regionCode,
        p_scheme_id: values.schemeId,
        p_effective_from: values.effectiveFrom,
        p_apply_mode: values.applyMode,
        p_replace_from_scheme_id: values.replaceFromSchemeId,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeSchemeRuleEditModal();
      showToast(
        "Hierarchy scheme rule saved. Request Costing Refresh from the toolbar if downstream pricing needs recalculation.",
        "success",
        5200,
      );

      const skuId = getSelectedSkuId?.();
      if (getCurrentLens() === "policy-manager" && skuId) {
        await onPolicyDataChanged({ drawerTab: "scheme-policy", skuId });
      } else {
        await reloadRows();
      }
    } catch (err) {
      handleError("Failed to save hierarchy scheme rule", err);
    } finally {
      setLoadingMask(false);
      dom.schemeRuleEditSaveBtn.disabled = false;
      setSchemeRuleSaveState();
    }
  }

  function readSchemeRuleCloseFormValues() {
    return {
      effectiveTo: dom.schemeRuleCloseEffectiveTo?.value || activePeriodIso(),
      remarks: dom.schemeRuleCloseRemarks?.value?.trim() || "",
    };
  }

  function setSchemeRuleCloseSaveState() {
    if (!dom.schemeRuleCloseSaveBtn) return;

    const values = readSchemeRuleCloseFormValues();
    dom.schemeRuleCloseSaveBtn.disabled = values.remarks.length < 5;
  }

  function openSchemeRuleCloseModal(row) {
    if (!row || !dom.schemeRuleCloseModal) return;

    schemeRuleCloseRow = row;
    schemeRuleCloseReturnFocus = document.activeElement;

    if (dom.schemeRuleCloseLabel) {
      dom.schemeRuleCloseLabel.textContent = `#${row.policy_rule_id} | ${row.policy_scope} | ${row.scope_name} | ${row.region_code} | ${row.scheme_name}`;
    }

    if (dom.schemeRuleCloseEffectiveTo) {
      dom.schemeRuleCloseEffectiveTo.value = activePeriodIso();
    }

    if (dom.schemeRuleCloseRemarks) {
      dom.schemeRuleCloseRemarks.value = "";
    }

    dom.schemeRuleCloseModal.classList.remove("hidden");
    dom.schemeRuleCloseModal.setAttribute("aria-hidden", "false");

    setSchemeRuleCloseSaveState();

    setTimeout(() => dom.schemeRuleCloseRemarks?.focus(), 0);
  }

  function closeSchemeRuleCloseModal() {
    if (!dom.schemeRuleCloseModal) return;

    const active = document.activeElement;
    if (active && dom.schemeRuleCloseModal.contains(active)) {
      active.blur();
    }

    dom.schemeRuleCloseModal.classList.add("hidden");
    dom.schemeRuleCloseModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      schemeRuleCloseReturnFocus &&
      schemeRuleCloseReturnFocus !== document.body &&
      document.contains(schemeRuleCloseReturnFocus)
        ? schemeRuleCloseReturnFocus
        : dom.drawerClose;

    schemeRuleCloseRow = null;
    schemeRuleCloseReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemeRuleClose() {
    const row = schemeRuleCloseRow;

    if (!row?.policy_rule_id) {
      showToast("Scheme rule ID missing.", "error");
      return;
    }

    const values = readSchemeRuleCloseFormValues();

    if (!values.remarks || values.remarks.length < 5) {
      showToast("Close remarks / approval reference is required.", "error");
      setSchemeRuleCloseSaveState();
      return;
    }

    dom.schemeRuleCloseSaveBtn.disabled = true;
    setLoadingMask(true, "Closing scheme rule...");

    try {
      const { error } = await costingRpc("rpc_close_scheme_policy_rule", {
        p_policy_rule_id: row.policy_rule_id,
        p_effective_to: values.effectiveTo,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeSchemeRuleCloseModal();

      showToast("Scheme rule closed successfully.", "success", 4200);

      await reloadRows();
    } catch (err) {
      handleError("Failed to close scheme rule", err);
    } finally {
      setLoadingMask(false);
      dom.schemeRuleCloseSaveBtn.disabled = false;
      setSchemeRuleCloseSaveState();
    }
  }

  function closeSchemePolicyEditModal() {
    if (!dom.schemePolicyEditModal) return;

    const active = document.activeElement;
    if (active && dom.schemePolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.schemePolicyEditModal.classList.add("hidden");
    dom.schemePolicyEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      schemePolicyReturnFocus &&
      schemePolicyReturnFocus !== document.body &&
      document.contains(schemePolicyReturnFocus)
        ? schemePolicyReturnFocus
        : dom.drawerClose;

    schemePolicyReturnFocus = null;
    schemePolicyEditRow = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemePolicyEdit() {
    const row = schemePolicyEditRow;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }

    const region = dom.schemePolicyEditRegion?.value;
    const schemeId = Number(dom.schemePolicyEditScheme?.value);
    const initialSchemeId = Number(schemePolicyInitial.schemeId || 0);
    const effectiveFrom =
      dom.schemePolicyEditEffectiveFrom?.value || activePeriodIso();
    const remarks = dom.schemePolicyEditRemarks?.value?.trim() || null;

    if (schemeId === initialSchemeId) {
      showToast("No scheme change detected.", "info");
      setSchemePolicySaveState();
      return;
    }

    if (!region || !schemeId) {
      showToast("Region and scheme are required.", "error");
      return;
    }

    dom.schemePolicyEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving scheme policy...");

    try {
      const { error } = await costingRpc("rpc_set_sku_scheme_policy", {
        p_sku_id: row.sku_id,
        p_region_code: region,
        p_scheme_id: schemeId,
        p_effective_from: effectiveFrom,
        p_remarks: remarks,
      });

      if (error) throw error;

      closeSchemePolicyEditModal();
      showToast("Scheme policy saved. Refreshing policy view...", "success");

      await onPolicyDataChanged({ drawerTab: "scheme-policy", skuId: row.sku_id });
    } catch (err) {
      handleError("Failed to save scheme policy", err);
    } finally {
      setLoadingMask(false);
      dom.schemePolicyEditSaveBtn.disabled = false;
    }
  }

  function getTableHeaders(lensId) {
    if (lensId === "policy-manager") {
      return policyManagerHeaders(policyManagerTab);
    }
    if (lensId === "scheme-comparison") {
      return SCHEME_COMPARISON_HEADERS;
    }
    return null;
  }

  function getTableAlignments(lensId) {
    if (lensId === "policy-manager") {
      return policyManagerAlignments(policyManagerTab);
    }
    if (lensId === "scheme-comparison") {
      return SCHEME_COMPARISON_ALIGNMENTS;
    }
    return null;
  }

  function renderTableRow(lensId, row, trAttrs) {
    if (lensId === "policy-manager") {
      if (policyManagerTab === "scheme-rule-register") {
        return `<tr ${trAttrs}>
        <td>
          ${cpCellPrimaryHtml(`#${text(row.policy_rule_id)}`)}
          <div class="cp-muted-text">${text(row.rule_status)}</div>
        </td>
        <td>
          ${cpCellPrimary(row.policy_scope)}
          <div class="cp-muted-text">${text(row.scope_name)}</div>
        </td>
        <td>${text(row.region_code)}</td>
        <td>
          ${cpCellPrimary(row.scheme_name)}
          <div class="cp-muted-text">
            ${formatNumber(row.paid_qty)} + ${formatNumber(row.free_qty)}
          </div>
        </td>
        <td>
          ${text(row.apply_mode)}
          ${
            row.replace_from_scheme_name
              ? `<div class="cp-muted-text">From: ${text(row.replace_from_scheme_name)}</div>`
              : ""
          }
        </td>
        <td>${formatDate(row.effective_from)}</td>
        <td>${formatDate(row.effective_to)}</td>
        <td>${compactStatusText(row.rule_status)}</td>
        <td>${text(row.remarks)}</td>
        <td class="c-center">
          ${
            normalizeStatus(row.rule_status) === "ACTIVE"
              ? `<button
                  type="button"
                  class="icon-btn cp-danger-icon-btn"
                  data-close-scheme-rule-id="${text(row.policy_rule_id)}"
                  title="Close Scheme Rule"
                  aria-label="Close Scheme Rule"
                >
                  ×
                </button>`
              : `<span class="cp-muted-text">--</span>`
          }
        </td>
      </tr>`;
      }

      return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      <td class="c-right">${formatMoney(row.mrp_ik)}</td>
      <td class="c-right">${formatMoney(row.mrp_ok)}</td>
      <td class="c-right">${formatPercent(row.gst_percent)}</td>
      <td class="c-right">${formatPercent(row.ik_discount_percent)}</td>
      <td class="c-right">${formatPercent(row.ok_discount_percent)}</td>
      <td class="c-right">${formatPercent(row.contingency_percent)}</td>
      <td>
        ${cpCellPrimary(row.ik_selected_scheme_name)}
        <div class="cp-muted-text">${text(row.ik_policy_source_label)}</div>
      </td>
      <td>
        ${cpCellPrimary(row.ok_selected_scheme_name)}
        <div class="cp-muted-text">${text(row.ok_policy_source_label)}</div>
      </td>
      <td>${compactStatusText(row.pricing_bridge_status)}</td>
      <td>${compactStatusText(row.selling_price_bridge_status)}</td>
    </tr>`;
    }

    if (lensId === "scheme-comparison") {
      return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      <td>${text(row.scheme_name)}</td>
      <td class="c-right">${formatMoney(row.ik_net_sales_realisation)}</td>
      <td class="c-right">${formatPercent(row.ik_margin_percent_after_scheme)}</td>
      <td class="cp-muted-text">${text(row.ik_scheme_margin_band)}</td>
      <td class="c-right">${formatMoney(row.ok_net_sales_realisation)}</td>
      <td class="c-right">${formatPercent(row.ok_margin_percent_after_scheme)}</td>
      <td class="cp-muted-text">${text(row.ok_scheme_margin_band)}</td>
      <td>${compactStatusText(row.scheme_viability_status)}</td>
    </tr>`;
    }

    return null;
  }

  function renderPolicyManagerTabs(workbenchSummaryEl, onTabChange) {
    if (!workbenchSummaryEl) return;

    const tabs = [
      ["sku-overview", "SKU Policy Overview"],
      ["scheme-rule-register", "Scheme Rule Register"],
    ];

    workbenchSummaryEl.classList.add("is-visible");
    workbenchSummaryEl.innerHTML = `
    <div class="cp-workbench-compact-summary" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
      ${tabs
        .map(
          ([id, label]) => `
            <button
              type="button"
              class="cp-workbench-summary-card cp-manager-tab-card ${policyManagerTab === id ? "active" : ""}"
              data-policy-manager-tab="${id}"
            >
              <div class="cp-card-label">${text(label)}</div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

    workbenchSummaryEl
      .querySelectorAll("[data-policy-manager-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const nextTab = btn.dataset.policyManagerTab;
          if (!nextTab || nextTab === policyManagerTab) return;

          policyManagerTab = nextTab;
          await onTabChange();
        });
      });
  }

  function wirePolicyManagerTableActions(tableBody, getViewRow) {
    if (policyManagerTab !== "scheme-rule-register") return;

    tableBody.querySelectorAll("[data-close-scheme-rule-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();

        const policyRuleId = btn.dataset.closeSchemeRuleId;
        const row = getViewRow((r) =>
          String(r.policy_rule_id) === String(policyRuleId),
        );

        if (row) openSchemeRuleCloseModal(row);
      });
    });
  }

  function getPolicyManagerDrawerConfig(row, preferredTab) {
    const active = preferredTab || "overview";
    return {
      title: row.product_name || row.product_id || "Policy Manager",
      subtitle:
        row.sku_column_label || row.sku_display_name || row.sku_id || "",
      tabs: [
        { id: "overview", label: "Overview" },
        { id: "selling-policy", label: "Selling Policy" },
        { id: "scheme-policy", label: "Scheme Policy" },
        { id: "policy-history", label: "Policy History" },
        { id: "status", label: "Status" },
      ],
      activeTab: active,
    };
  }

  async function renderPolicyManagerDrawerTab(tabId, row) {
    if (tabId === "overview") {
      return detailPanel([
        kvSection("Policy Overview", [
          ["Product", text(row.product_name || row.product_id)],
          ["SKU", text(row.sku_column_label || row.sku_display_name || row.sku_id)],
          [
            "MRP IK / OK",
            `${formatMoney(row.mrp_ik)} / ${formatMoney(row.mrp_ok)}`,
          ],
          ["GST %", formatPercent(row.gst_percent)],
          ["IK Discount %", formatPercent(row.ik_discount_percent)],
          ["OK Discount %", formatPercent(row.ok_discount_percent)],
          ["Contingency %", formatPercent(row.contingency_percent)],
          [
            "IK Scheme",
            `${text(row.ik_selected_scheme_name)}<div class="cp-muted-text">${text(row.ik_policy_source_label)}</div>`,
          ],
          [
            "OK Scheme",
            `${text(row.ok_selected_scheme_name)}<div class="cp-muted-text">${text(row.ok_policy_source_label)}</div>`,
          ],
        ]),
      ]);
    }

    if (tabId === "selling-policy") {
      const editButton = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="editSellingPolicyBtn"
          title="Edit Selling Policy"
          aria-label="Edit Selling Policy"
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
        editButton +
        detailPanel([
          kvSection("Selling Policy", [
            ["Selling Price Policy ID", text(row.selling_price_policy_id)],
            ["GST %", formatPercent(row.gst_percent)],
            ["IK Discount %", formatPercent(row.ik_discount_percent)],
            ["OK Discount %", formatPercent(row.ok_discount_percent)],
            [
              "IK Fixed Discount Amount",
              formatOptionalMoney(row.ik_discount_amount),
            ],
            [
              "OK Fixed Discount Amount",
              formatOptionalMoney(row.ok_discount_amount),
            ],
            ["Contingency %", formatPercent(row.contingency_percent)],
            ["Effective From", formatDate(row.selling_price_effective_from)],
            ["Effective To", formatDate(row.selling_price_effective_to)],
            ["Active", text(row.selling_price_policy_active)],
            ["Remarks", text(row.selling_price_policy_remarks)],
          ]),
        ])
      );
    }

    if (tabId === "scheme-policy") {
      return simpleTable(
        [
          "Region",
          "Scheme",
          "Source",
          "Scope",
          "Apply Mode",
          "Paid Qty",
          "Free Qty",
          "Effective From",
          "Effective To",
          "Active",
        ],
        [
          {
            region: "IK",
            scheme: row.ik_selected_scheme_name,
            source: row.ik_policy_source_label,
            scope: row.ik_policy_scope,
            applyMode: row.ik_apply_mode,
            paid: row.ik_scheme_paid_qty,
            free: row.ik_scheme_free_qty,
            from: row.ik_scheme_effective_from,
            to: row.ik_scheme_effective_to,
            active: row.ik_scheme_policy_active,
          },
          {
            region: "OK",
            scheme: row.ok_selected_scheme_name,
            source: row.ok_policy_source_label,
            scope: row.ok_policy_scope,
            applyMode: row.ok_apply_mode,
            paid: row.ok_scheme_paid_qty,
            free: row.ok_scheme_free_qty,
            from: row.ok_scheme_effective_from,
            to: row.ok_scheme_effective_to,
            active: row.ok_scheme_policy_active,
          },
        ],
        (r) =>
          `<tr>
          <td>${text(r.region)}</td>
          <td>${text(r.scheme)}</td>
          <td>${text(r.source)}</td>
          <td>${text(r.scope)}</td>
          <td>${text(r.applyMode)}</td>
          <td class="c-right">${formatNumber(r.paid)}</td>
          <td class="c-right">${formatNumber(r.free)}</td>
          <td>${formatDate(r.from)}</td>
          <td>${formatDate(r.to)}</td>
          <td>${text(r.active)}</td>
        </tr>`,
      );
    }

    if (tabId === "policy-history") {
      const sellingRows = await fetchSellingPolicyHistory(row);
      const schemeRows = await fetchSchemePolicyHistory(row);

      const sellingTable = simpleTable(
        [
          "Policy ID",
          "GST %",
          "IK Discount %",
          "OK Discount %",
          "IK Fixed Discount",
          "OK Fixed Discount",
          "Contingency %",
          "Effective From",
          "Effective To",
          "Active",
          "Remarks",
          "Updated At",
        ],
        sellingRows,
        (r) =>
          `<tr>
          <td>${text(r.policy_id)}</td>
          <td class="c-right">${formatPercent(r.gst_percent)}</td>
          <td class="c-right">${formatPercent(r.ik_discount_percent)}</td>
          <td class="c-right">${formatPercent(r.ok_discount_percent)}</td>
          <td class="c-right">${formatOptionalMoney(r.ik_discount_amount)}</td>
          <td class="c-right">${formatOptionalMoney(r.ok_discount_amount)}</td>
          <td class="c-right">${formatPercent(r.contingency_percent)}</td>
          <td>${formatDate(r.effective_from)}</td>
          <td>${formatDate(r.effective_to)}</td>
          <td>${r.is_active ? statusChip("ACTIVE") : statusChip("CLOSED")}</td>
          <td>${text(r.remarks)}</td>
          <td>${formatDateTime(r.updated_at)}</td>
        </tr>`,
      );

      const schemeTable = simpleTable(
        [
          "Policy ID",
          "Level",
          "Region",
          "Scheme",
          "Paid Qty",
          "Free Qty",
          "Effective From",
          "Effective To",
          "Active",
          "Remarks",
          "Updated At",
        ],
        schemeRows,
        (r) =>
          `<tr>
          <td>${text(r.policy_id)}</td>
          <td>${text(r.policy_level)}</td>
          <td>${text(r.region_code)}</td>
          <td>${text(r.scheme_name)}</td>
          <td class="c-right">${formatNumber(r.paid_qty)}</td>
          <td class="c-right">${formatNumber(r.free_qty)}</td>
          <td>${formatDate(r.effective_from)}</td>
          <td>${formatDate(r.effective_to)}</td>
          <td>${r.is_active ? statusChip("ACTIVE") : statusChip("CLOSED")}</td>
          <td>${text(r.remarks)}</td>
          <td>${formatDateTime(r.updated_at)}</td>
        </tr>`,
      );

      return `
      <div class="cp-card" style="margin-bottom:10px">
        <div class="cp-card-label">Policy History</div>
        <div class="cp-card-value">
          This section shows the audit trail of selling price and scheme policy changes for the selected SKU.
        </div>
      </div>

      <h3 class="cp-section-title">Selling Price Policy History</h3>
      ${sellingTable}

      <h3 class="cp-section-title" style="margin-top:14px">Scheme Policy History</h3>
      ${schemeTable}
    `;
    }

    return detailPanel([
      kvSection("Policy Status", [
        ["Pricing Bridge Status", compactStatusText(row.pricing_bridge_status)],
        [
          "Selling Price Bridge Status",
          compactStatusText(row.selling_price_bridge_status),
        ],
        ["Selling Price Bridge Note", text(row.selling_price_bridge_note)],
        ["Refreshed At", formatDateTime(row.refreshed_at)],
      ]),
    ]);
  }

  function wirePolicyManagerDrawerActions(tabId, row) {
    if (tabId === "selling-policy") {
      document.getElementById("editSellingPolicyBtn")?.addEventListener(
        "click",
        () => openSellingPolicyEditModal(row),
      );
    }
  }

  function handleEscapeKey() {
    if (!dom.sellingPolicyEditModal?.classList.contains("hidden")) {
      closeSellingPolicyEditModal();
      return true;
    }
    if (!dom.schemePolicyEditModal?.classList.contains("hidden")) {
      closeSchemePolicyEditModal();
      return true;
    }
    if (!dom.schemeRuleEditModal?.classList.contains("hidden")) {
      closeSchemeRuleEditModal();
      return true;
    }
    if (!dom.schemeRuleCloseModal?.classList.contains("hidden")) {
      closeSchemeRuleCloseModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    dom.sellingPolicyEditCloseBtn?.addEventListener(
      "click",
      closeSellingPolicyEditModal,
    );
    dom.sellingPolicyEditCancelBtn?.addEventListener(
      "click",
      closeSellingPolicyEditModal,
    );
    dom.sellingPolicyEditSaveBtn?.addEventListener(
      "click",
      saveSellingPolicyEdit,
    );
    dom.sellingPolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.sellingPolicyEditModal) closeSellingPolicyEditModal();
    });
    [
      dom.sellingPolicyGstPercent,
      dom.sellingPolicyIkDiscountPercent,
      dom.sellingPolicyOkDiscountPercent,
      dom.sellingPolicyIkDiscountAmount,
      dom.sellingPolicyOkDiscountAmount,
      dom.sellingPolicyContingencyPercent,
    ].forEach((input) => {
      input?.addEventListener("input", setSellingPolicySaveState);
    });
    dom.schemePolicyEditCloseBtn?.addEventListener(
      "click",
      closeSchemePolicyEditModal,
    );
    dom.schemePolicyEditCancelBtn?.addEventListener(
      "click",
      closeSchemePolicyEditModal,
    );
    dom.schemePolicyEditSaveBtn?.addEventListener("click", saveSchemePolicyEdit);
    dom.schemePolicyEditRegion?.addEventListener("change", () => {
      populateSchemePolicySelectionForRegion(dom.schemePolicyEditRegion.value);
    });
    dom.schemePolicyEditScheme?.addEventListener("change", setSchemePolicySaveState);
    dom.schemePolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemePolicyEditModal) closeSchemePolicyEditModal();
    });
    dom.schemeRuleEditCloseBtn?.addEventListener("click", closeSchemeRuleEditModal);
    dom.schemeRuleEditCancelBtn?.addEventListener("click", closeSchemeRuleEditModal);
    dom.schemeRuleEditSaveBtn?.addEventListener("click", saveSchemeRuleEdit);
    dom.schemeRuleScope?.addEventListener("change", () => {
      if (dom.schemeRuleScopeSearch) {
        dom.schemeRuleScopeSearch.value = "";
      }

      populateSchemeRuleScopeOptions();
      setSchemeRuleSaveState();
    });
    dom.schemeRuleScopeSearch?.addEventListener("input", () => {
      populateSchemeRuleScopeOptions();
      setSchemeRuleSaveState();
    });
    dom.schemeRuleScopeSelect?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleRegion?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleScheme?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleReplaceFromScheme?.addEventListener(
      "change",
      setSchemeRuleSaveState,
    );
    dom.schemeRuleEffectiveFrom?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleRemarks?.addEventListener("input", setSchemeRuleSaveState);
    dom.schemeRuleApplyMode?.addEventListener("change", () => {
      syncSchemeRuleApplyModeUi();
      setSchemeRuleSaveState();
    });
    dom.schemeRuleEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeRuleEditModal) closeSchemeRuleEditModal();
    });
    dom.schemeRuleCloseCloseBtn?.addEventListener(
      "click",
      closeSchemeRuleCloseModal,
    );
    dom.schemeRuleCloseCancelBtn?.addEventListener(
      "click",
      closeSchemeRuleCloseModal,
    );
    dom.schemeRuleCloseSaveBtn?.addEventListener("click", saveSchemeRuleClose);
    dom.schemeRuleCloseEffectiveTo?.addEventListener(
      "change",
      setSchemeRuleCloseSaveState,
    );
    dom.schemeRuleCloseRemarks?.addEventListener(
      "input",
      setSchemeRuleCloseSaveState,
    );
  }

  return {
    bindEvents,
    handleEscapeKey,
    loadOptions,
    getPolicyManagerTab,
    setPolicyManagerTab,
    loadPolicyManagerRows,
    renderPolicyManagerTabs,
    wirePolicyManagerTableActions,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    getPolicyManagerDrawerConfig,
    renderPolicyManagerDrawerTab,
    wirePolicyManagerDrawerActions,
    loadSchemeComparisonRows,
    openSellingPolicyEditModal,
    openSchemeRuleCloseModal,
    openSchemeRuleEditModal,
    closeSellingPolicyEditModal,
    closeSchemePolicyEditModal,
    closeSchemeRuleEditModal,
    closeSchemeRuleCloseModal,
  };
}
