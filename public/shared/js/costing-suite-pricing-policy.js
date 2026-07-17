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
  if (tab === "scheme-master") {
    return [
      "Scheme",
      "Paid Qty",
      "Free Qty",
      "Total Qty",
      "Effective Free Discount %",
      "Status",
      "Type",
      "Active Direct Policies",
      "Active Hierarchy Rules",
      "Viability Periods",
      "Updated At",
      "Actions",
    ];
  }
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
  if (tab === "scheme-master") {
    return [
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
      "c-center",
    ];
  }
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
    canEditPricingPolicyActions,
    formatTodayIsoIst,
  } = deps;

  function canEditPolicyActions() {
    return (
      typeof canEditPricingPolicyActions === "function" &&
      canEditPricingPolicyActions()
    );
  }

  function requireEditAccess(actionLabel = "this action") {
    if (canEditPolicyActions()) return true;
    showToast(`You do not have permission to ${actionLabel}.`, "error", 4200);
    return false;
  }

  function syncPricingPolicyWriteUi() {
    const editable = canEditPolicyActions();
    [
      dom.sellingPolicyEditSaveBtn,
      dom.schemePolicyEditSaveBtn,
      dom.schemeRuleEditSaveBtn,
      dom.schemeRuleCloseSaveBtn,
      dom.mrpPolicyEditSaveBtn,
      dom.schemeMasterCreateSaveBtn,
      dom.schemeMasterMetadataSaveBtn,
      dom.schemeMasterDeactivateSaveBtn,
      dom.schemeMasterReactivateSaveBtn,
    ].forEach((btn) => {
      if (btn) btn.disabled = !editable;
    });
  }

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
  let mrpPolicyEditRow = null;
  let mrpPolicyReturnFocus = null;
  let mrpPolicyHasCurrent = false;
  let mrpPolicySaving = false;
  let mrpInputDriver = null;
  let mrpFieldSyncing = false;
  let schemeMasterMetadataRow = null;
  let schemeMasterDeactivateRow = null;
  let schemeMasterReactivateRow = null;
  let schemeMasterHistoryRow = null;
  let schemeMasterReturnFocus = null;
  let schemeMasterSaving = false;
  const currentMrpPolicyCache = new Map();

  const MRP_CURRENT_SELECT = `
    policy_id,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    sku_is_active,
    mrp_ik,
    mrp_ok,
    ok_pct,
    calc_mode,
    effective_from,
    effective_to,
    reason,
    approval_reference,
    source_type,
    source_quality,
    previous_policy_id,
    created_at,
    created_by
  `;

  function todayIsoIst() {
    return typeof formatTodayIsoIst === "function"
      ? formatTodayIsoIst()
      : activePeriodIso();
  }

  function addDaysIsoIst(isoDate, days) {
    const [y, m, d] = String(isoDate || todayIsoIst())
      .split("-")
      .map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function invalidateMrpPolicyCache(skuId) {
    if (skuId == null || skuId === "") return;
    currentMrpPolicyCache.delete(String(skuId));
  }

  async function fetchCurrentMrpPolicy(skuId, { force = false } = {}) {
    if (skuId == null || skuId === "") {
      return { data: null, error: null };
    }

    const cacheKey = String(skuId);
    if (!force && currentMrpPolicyCache.has(cacheKey)) {
      return { data: currentMrpPolicyCache.get(cacheKey), error: null };
    }

    const { data, error } = await costingFrom("v_sku_mrp_current")
      .select(MRP_CURRENT_SELECT)
      .eq("sku_id", skuId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    const normalized = data?.sku_id ? data : null;
    currentMrpPolicyCache.set(cacheKey, normalized);
    return { data: normalized, error: null };
  }

  async function fetchMrpPolicyHistory(row) {
    if (!row?.sku_id) return [];

    const { data, error } = await costingFrom("v_sku_mrp_policy_history")
      .select("*")
      .eq("sku_id", row.sku_id)
      .order("effective_from", { ascending: false })
      .order("policy_id", { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  }

  function uiPctFromDecimal(ratio) {
    if (ratio === null || ratio === undefined || ratio === "") return null;
    const n = Number(ratio);
    if (!Number.isFinite(n)) return null;
    return n * 100;
  }

  function decimalFromUiPct(uiPct) {
    if (uiPct === null || uiPct === undefined || uiPct === "") return null;
    const n = Number(uiPct);
    if (!Number.isFinite(n)) return null;
    return n / 100;
  }

  function formatOkPctFromDecimal(ratio) {
    const ui = uiPctFromDecimal(ratio);
    if (ui === null) return "--";
    return formatPercent(ui);
  }

  function roundDerivedMrpOk(rawValue) {
    if (!Number.isFinite(rawValue)) return null;
    if (rawValue < 5) return rawValue;
    return Math.ceil(rawValue / 5) * 5;
  }

  function deriveExactOkPctDecimal(mrpIk, mrpOk) {
    const ik = Number(mrpIk);
    const ok = Number(mrpOk);
    if (!Number.isFinite(ik) || ik <= 0 || !Number.isFinite(ok)) return null;
    return ok / ik - 1;
  }

  function setMrpPolicyModalError(message) {
    if (!dom.mrpPolicyEditError) return;
    dom.mrpPolicyEditError.hidden = !message;
    dom.mrpPolicyEditError.textContent = message || "";
  }

  function readOkPctUiInput() {
    const raw = String(dom.mrpPolicyEditOkPct?.value ?? "").trim();
    if (raw === "") {
      return { isBlank: true, uiPct: null, invalid: false };
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return { isBlank: false, uiPct: null, invalid: true };
    }
    return { isBlank: false, uiPct: n, invalid: false };
  }

  function resolveMrpRpcPayload(values) {
    if (values.driver === "OK_PCT") {
      return {
        p_mrp_ok: null,
        p_ok_pct: values.okPctUi / 100,
      };
    }
    return {
      p_mrp_ok: values.mrpOk,
      p_ok_pct: null,
    };
  }

  function readMrpPolicyFormValues() {
    const okPctInput = readOkPctUiInput();
    return {
      calcMode: "AUTO",
      driver: mrpInputDriver,
      mrpIk: numberOrNullFromInput(dom.mrpPolicyEditMrpIk),
      mrpOk: numberOrNullFromInput(dom.mrpPolicyEditMrpOk),
      okPctUi: okPctInput.isBlank ? null : okPctInput.uiPct,
      okPctUiBlank: okPctInput.isBlank,
      okPctUiInvalid: okPctInput.invalid,
      effectiveFrom: dom.mrpPolicyEditEffectiveFrom?.value || "",
      reason: dom.mrpPolicyEditReason?.value?.trim() || "",
      approvalReference:
        dom.mrpPolicyEditApprovalReference?.value?.trim() || null,
    };
  }

  function computeMrpPreview(values = readMrpPolicyFormValues()) {
    const mrpIk = values.mrpIk;
    const driver = values.driver;

    if (!Number.isFinite(mrpIk) || mrpIk <= 0) {
      return { valid: false, message: "Enter a valid MRP IK to preview." };
    }

    if (values.okPctUiInvalid) {
      return { valid: false, message: "Enter a valid OK uplift %." };
    }

    if (driver !== "OK_MRP" && driver !== "OK_PCT") {
      return {
        valid: false,
        message: "Enter MRP OK or OK uplift % to see a preview.",
      };
    }

    if (driver === "OK_MRP") {
      const enteredOk = values.mrpOk;
      if (!Number.isFinite(enteredOk) || enteredOk <= 0) {
        return {
          valid: false,
          message: "Enter MRP OK greater than zero.",
        };
      }
      const exactPct = deriveExactOkPctDecimal(mrpIk, enteredOk);
      return {
        valid: true,
        calcMode: "AUTO",
        driver,
        controllingInput: "Calculated from OK MRP",
        mrpIk,
        mrpOk: enteredOk,
        okPctUi: uiPctFromDecimal(exactPct),
        okPctDecimal: exactPct,
        effectiveFrom: values.effectiveFrom,
        notes: [],
      };
    }

    if (values.okPctUiBlank) {
      return {
        valid: false,
        message: "Enter an OK uplift %.",
      };
    }
    const okPctDecimal = decimalFromUiPct(values.okPctUi);
    if (okPctDecimal === null || okPctDecimal < 0) {
      return {
        valid: false,
        message: "OK uplift % must be zero or greater.",
      };
    }
    const raw = mrpIk * (1 + okPctDecimal);
    const previewOk = roundDerivedMrpOk(raw);
    const exactPct = deriveExactOkPctDecimal(mrpIk, previewOk);
    return {
      valid: true,
      calcMode: "AUTO",
      driver,
      controllingInput: "Calculated from OK uplift %",
      mrpIk,
      mrpOk: previewOk,
      okPctUi: uiPctFromDecimal(exactPct),
      okPctDecimal: exactPct,
      effectiveFrom: values.effectiveFrom,
      notes: ["Derived MRP OK is rounded upward to the next ₹5 when ≥ ₹5."],
    };
  }

  function renderMrpPreviewHtml(preview) {
    if (!preview?.valid) {
      return `<div class="cp-muted-text">${text(preview?.message || "Enter values to see a preview.")}</div>`;
    }

    const notes = (preview.notes || [])
      .map((note) => `<div class="cp-muted-text">${text(note)}</div>`)
      .join("");

    return `
      <div class="cp-preview-row"><span>MRP IK</span><span class="cp-preview-value">${formatMoney(preview.mrpIk)}</span></div>
      <div class="cp-preview-row"><span>MRP OK</span><span class="cp-preview-value">${formatMoney(preview.mrpOk)}</span></div>
      <div class="cp-preview-row"><span>OK Uplift %</span><span class="cp-preview-value">${formatPercent(preview.okPctUi)}</span></div>
      <div class="cp-preview-row"><span>Effective From</span><span class="cp-preview-value">${formatDate(preview.effectiveFrom)}</span></div>
      <div class="cp-preview-row"><span>Controlling Input</span><span class="cp-preview-value">${text(preview.controllingInput || "--")}</span></div>
      ${notes}
    `;
  }

  function setMrpFieldValue(input, value) {
    if (!input) return;
    mrpFieldSyncing = true;
    input.value = value;
    mrpFieldSyncing = false;
  }

  function recalcMrpDependentField() {
    const mrpIk = numberOrNullFromInput(dom.mrpPolicyEditMrpIk);
    const hasIk = Number.isFinite(mrpIk) && mrpIk > 0;

    if (mrpInputDriver === "OK_MRP") {
      const mrpOk = numberOrNullFromInput(dom.mrpPolicyEditMrpOk);
      if (hasIk && Number.isFinite(mrpOk) && mrpOk > 0) {
        const exactPct = deriveExactOkPctDecimal(mrpIk, mrpOk);
        const uiPct = uiPctFromDecimal(exactPct);
        setMrpFieldValue(
          dom.mrpPolicyEditOkPct,
          uiPct === null ? "" : roundTo(uiPct, 4),
        );
      } else {
        setMrpFieldValue(dom.mrpPolicyEditOkPct, "");
      }
      return;
    }

    if (mrpInputDriver === "OK_PCT") {
      const okPctInput = readOkPctUiInput();
      const okPctDecimal = okPctInput.isBlank
        ? null
        : decimalFromUiPct(okPctInput.uiPct);
      if (
        hasIk &&
        !okPctInput.isBlank &&
        !okPctInput.invalid &&
        okPctDecimal !== null &&
        okPctDecimal >= 0
      ) {
        const previewOk = roundDerivedMrpOk(mrpIk * (1 + okPctDecimal));
        setMrpFieldValue(
          dom.mrpPolicyEditMrpOk,
          previewOk === null ? "" : previewOk,
        );
      } else {
        setMrpFieldValue(dom.mrpPolicyEditMrpOk, "");
      }
    }
  }

  function roundTo(value, decimals) {
    if (!Number.isFinite(value)) return value;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function updateMrpPolicyPreview() {
    if (!dom.mrpPolicyEditPreview) return;
    recalcMrpDependentField();
    const preview = computeMrpPreview();
    dom.mrpPolicyEditPreview.innerHTML = `
      <div class="cp-card-label">Preview (advisory)</div>
      ${renderMrpPreviewHtml(preview)}
    `;
    setMrpPolicySaveState();
  }

  function validateMrpPolicyForm(values = readMrpPolicyFormValues()) {
    const preview = computeMrpPreview(values);
    if (!preview.valid) {
      return { ok: false, message: preview.message || "Preview is invalid." };
    }
    if (!values.effectiveFrom) {
      return { ok: false, message: "Effective-from date is required." };
    }
    if (!values.reason) {
      return { ok: false, message: "Reason is required." };
    }
    return { ok: true, preview, values };
  }

  function setMrpPolicySaveState() {
    if (!dom.mrpPolicyEditSaveBtn) return;

    if (!canEditPolicyActions() || mrpPolicySaving) {
      dom.mrpPolicyEditSaveBtn.disabled = true;
      return;
    }

    const validation = validateMrpPolicyForm();
    dom.mrpPolicyEditSaveBtn.disabled = !validation.ok;
  }

  async function openMrpPolicyEditModal(row) {
    if (!requireEditAccess("set or revise SKU MRP")) return;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }
    if (!dom.mrpPolicyEditModal) return;

    setMrpPolicyModalError("");

    const { data: currentPolicy, error } = await fetchCurrentMrpPolicy(row.sku_id);
    if (error) {
      handleError("Failed to load current MRP policy", error);
      return;
    }

    if (currentPolicy?.sku_is_active === false) {
      showToast("This SKU is inactive and cannot receive MRP policy.", "error");
      return;
    }

    mrpPolicyEditRow = row;
    mrpPolicyHasCurrent = !!currentPolicy?.policy_id;
    mrpPolicyReturnFocus = document.activeElement;

    const skuLabel =
      row.sku_display_name ||
      row.sku_column_label ||
      `${row.pack_size || ""} ${row.pack_uom || ""}`.trim() ||
      row.sku_id ||
      "--";

    if (dom.mrpPolicyEditTitle) {
      dom.mrpPolicyEditTitle.textContent = mrpPolicyHasCurrent
        ? "Revise SKU MRP"
        : "Set SKU MRP";
    }
    if (dom.mrpPolicyEditSkuLabel) {
      dom.mrpPolicyEditSkuLabel.textContent = skuLabel;
    }

    const seededIk = currentPolicy?.mrp_ik ?? row.mrp_ik ?? "";
    const seededOk = currentPolicy?.mrp_ok ?? row.mrp_ok ?? "";
    setMrpFieldValue(dom.mrpPolicyEditMrpIk, seededIk);
    setMrpFieldValue(dom.mrpPolicyEditMrpOk, seededOk);
    setMrpFieldValue(dom.mrpPolicyEditOkPct, "");

    if (dom.mrpPolicyEditEffectiveFrom) {
      dom.mrpPolicyEditEffectiveFrom.value = mrpPolicyHasCurrent
        ? addDaysIsoIst(todayIsoIst(), 1)
        : todayIsoIst();
    }
    if (dom.mrpPolicyEditReason) dom.mrpPolicyEditReason.value = "";
    if (dom.mrpPolicyEditApprovalReference) {
      dom.mrpPolicyEditApprovalReference.value = "";
    }

    const hasSeededOk = Number.isFinite(Number(seededOk)) && Number(seededOk) > 0;
    mrpInputDriver = mrpPolicyHasCurrent && hasSeededOk ? "OK_MRP" : null;

    updateMrpPolicyPreview();

    dom.mrpPolicyEditModal.classList.remove("hidden");
    dom.mrpPolicyEditModal.setAttribute("aria-hidden", "false");

    setTimeout(() => dom.mrpPolicyEditMrpIk?.focus(), 0);
  }

  function closeMrpPolicyEditModal() {
    if (!dom.mrpPolicyEditModal) return;

    const active = document.activeElement;
    if (active && dom.mrpPolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.mrpPolicyEditModal.classList.add("hidden");
    dom.mrpPolicyEditModal.setAttribute("aria-hidden", "true");
    setMrpPolicyModalError("");

    const returnTarget =
      mrpPolicyReturnFocus &&
      mrpPolicyReturnFocus !== document.body &&
      document.contains(mrpPolicyReturnFocus)
        ? mrpPolicyReturnFocus
        : dom.drawerClose;

    mrpPolicyEditRow = null;
    mrpPolicyHasCurrent = false;
    mrpPolicyReturnFocus = null;
    mrpPolicySaving = false;
    mrpInputDriver = null;
    mrpFieldSyncing = false;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveMrpPolicyEdit() {
    if (!requireEditAccess("save SKU MRP policy")) return;

    const row = mrpPolicyEditRow;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }

    const validation = validateMrpPolicyForm();
    if (!validation.ok) {
      setMrpPolicyModalError(validation.message);
      setMrpPolicySaveState();
      return;
    }

    const { preview, values } = validation;
    mrpPolicySaving = true;
    dom.mrpPolicyEditSaveBtn.disabled = true;
    setMrpPolicyModalError("");
    setLoadingMask(true, "Saving MRP policy...");

    try {
      const { p_mrp_ok, p_ok_pct } = resolveMrpRpcPayload(values);

      const { error } = await costingRpc("rpc_set_sku_mrp_policy", {
        p_sku_id: row.sku_id,
        p_mrp_ik: preview.mrpIk,
        p_mrp_ok,
        p_ok_pct,
        p_calc_mode: "AUTO",
        p_effective_from: values.effectiveFrom,
        p_reason: values.reason,
        p_approval_reference: values.approvalReference,
      });

      if (error) throw error;

      invalidateMrpPolicyCache(row.sku_id);
      closeMrpPolicyEditModal();
      showToast("MRP policy saved.", "success", 4200);

      await onPolicyDataChanged({ drawerTab: "mrp-policy", skuId: row.sku_id });
    } catch (err) {
      const message = err?.message
        ? `Failed to save MRP policy: ${err.message}`
        : "Failed to save MRP policy.";
      setMrpPolicyModalError(message);
      handleError("Failed to save MRP policy", err);
    } finally {
      mrpPolicySaving = false;
      setLoadingMask(false);
      setMrpPolicySaveState();
    }
  }

  function formatMrpSourceQualityLabel(sourceQuality, sourceType) {
    const quality = String(sourceQuality || "").trim();
    const type = String(sourceType || "").trim();
    if (
      /legacy/i.test(quality) ||
      /legacy/i.test(type) ||
      quality.toUpperCase() === "LEGACY_BASELINE"
    ) {
      return `${text(quality || type || "Legacy baseline")}<div class="cp-muted-text">Legacy baseline — not historically verified for audit purposes.</div>`;
    }
    return text(quality || type || "--");
  }

  function renderMrpPolicyTabContent(row, currentPolicy) {
    const hasCurrent = !!currentPolicy?.policy_id;
    const packLabel = [row.pack_size, row.pack_uom].filter(Boolean).join(" ");

    const statusBlock = hasCurrent
      ? `<div class="cp-card" style="margin-bottom:10px">
          <div class="cp-card-label">Current MRP Status</div>
          <div class="cp-card-value">${statusChip("CURRENT POLICY")}</div>
        </div>`
      : `<div class="cp-mrp-blocker-card">
          <div class="cp-card-label">Current MRP Status</div>
          <div class="cp-card-value">${statusChip("BLOCKER")}</div>
          <div class="cp-muted-text" style="margin-top:6px">
            Control: <strong>SKU_MRP_MISSING</strong> · Severity: <strong>BLOCKER</strong>
          </div>
        </div>`;

    const editAction = canEditPolicyActions()
      ? `<div class="cp-drawer-action-bar">
          <button
            type="button"
            class="icon-btn icon-btn-primary"
            id="editMrpPolicyBtn"
            title="${hasCurrent ? "Revise MRP" : "Set MRP"}"
            aria-label="${hasCurrent ? "Revise MRP" : "Set MRP"}"
          >
            ${hasCurrent ? "Revise MRP" : "Set MRP"}
          </button>
        </div>`
      : "";

    const policyValues = hasCurrent
      ? kvSection("Current Policy Values", [
          ["MRP IK", formatOptionalMoney(currentPolicy.mrp_ik)],
          ["MRP OK", formatOptionalMoney(currentPolicy.mrp_ok)],
          ["OK Uplift %", formatOkPctFromDecimal(currentPolicy.ok_pct)],
          ["Calculation Mode", text(currentPolicy.calc_mode)],
          ["Effective From", formatDate(currentPolicy.effective_from)],
          ["Effective To", formatDate(currentPolicy.effective_to)],
          ["Reason", text(currentPolicy.reason)],
          ["Approval Reference", text(currentPolicy.approval_reference)],
          ["Source Type", text(currentPolicy.source_type)],
          [
            "Source Quality",
            formatMrpSourceQualityLabel(
              currentPolicy.source_quality,
              currentPolicy.source_type,
            ),
          ],
          ["Policy ID", text(currentPolicy.policy_id)],
          ["Previous Policy ID", text(currentPolicy.previous_policy_id)],
          ["Created At", formatDateTime(currentPolicy.created_at)],
          ["Created By", text(currentPolicy.created_by)],
        ])
      : kvSection("Current Policy Values", [
          ["MRP IK", formatOptionalMoney(row.mrp_ik)],
          ["MRP OK", formatOptionalMoney(row.mrp_ok)],
          [
            "Status",
            "No governed current MRP policy. Overview values may be absent until a policy is set.",
          ],
        ]);

    return (
      statusBlock +
      editAction +
      detailPanel([
        kvSection("SKU Identity", [
          ["Product", text(row.product_name || row.product_id)],
          ["Pack", text(packLabel || "--")],
          ["SKU ID", text(row.sku_id)],
        ]),
        policyValues,
      ])
    );
  }

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

  function schemeMasterRowValue(row, keys, fallback = null) {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }
    return fallback;
  }

  function schemeMasterRowNumber(row, keys) {
    const raw = schemeMasterRowValue(row, keys, null);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function schemeMasterRowBool(row, key) {
    return row?.[key] === true;
  }

  function formatSchemeQty(value) {
    if (value === null || value === undefined || value === "") return "--";
    const n = Number(value);
    if (!Number.isFinite(n)) return text(value);
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toFixed(4)));
  }

  function computeEffectiveFreeDiscountPct(paidQty, freeQty) {
    const paid = Number(paidQty);
    const free = Number(freeQty);
    if (!Number.isFinite(paid) || paid <= 0) return null;
    if (!Number.isFinite(free) || free < 0) return null;
    const total = paid + free;
    if (total <= 0) return null;
    return (free / total) * 100;
  }

  function formatEffectiveFreeDiscountPct(value) {
    if (value === null || value === undefined || value === "") return "--";
    const n = Number(value);
    if (!Number.isFinite(n)) return text(value);
    return `${n.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })}%`;
  }

  function schemeMasterEffectiveDiscount(row) {
    const fromView = schemeMasterRowNumber(row, [
      "effective_free_discount_pct",
      "effective_free_discount_percent",
    ]);
    if (fromView !== null) return fromView;
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    return computeEffectiveFreeDiscountPct(paid, free);
  }

  function schemeMasterTotalQty(row) {
    const fromView = schemeMasterRowNumber(row, ["total_qty"]);
    if (fromView !== null) return fromView;
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    if (paid === null && free === null) return null;
    return (paid || 0) + (free || 0);
  }

  function formatSchemeStructure(paidQty, freeQty) {
    return `${formatSchemeQty(paidQty)} + ${formatSchemeQty(freeQty)}`;
  }

  function schemeMasterStatusLabel(row) {
    const explicit = String(
      schemeMasterRowValue(row, ["scheme_status", "status"], ""),
    )
      .trim()
      .toUpperCase();
    if (explicit === "ACTIVE" || explicit === "INACTIVE") return explicit;
    if (row?.is_active === true) return "ACTIVE";
    if (row?.is_active === false) return "INACTIVE";
    return "--";
  }

  function schemeMasterTypeLabel(row) {
    return String(
      schemeMasterRowValue(row, ["scheme_type", "master_type"], "--"),
    )
      .trim()
      .toUpperCase() || "--";
  }

  function schemeMasterStatusChip(row) {
    const status = schemeMasterStatusLabel(row);
    if (status === "ACTIVE") return statusChip("ACTIVE");
    if (status === "INACTIVE") return statusChip("INACTIVE");
    return text(status);
  }

  function schemeMasterTypeBadge(row) {
    const type = schemeMasterTypeLabel(row);
    if (type === "SYSTEM") {
      return `${statusChip("SYSTEM")}<div class="cp-muted-text">System-defined</div>`;
    }
    if (type === "STANDARD") return statusChip("STANDARD");
    return text(type);
  }

  function schemeMasterDisplayName(row) {
    const name = schemeMasterRowValue(row, ["scheme_name", "display_name"], "--");
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    if (paid === null && free === null) return text(name);
    return `${text(name)}<div class="cp-muted-text">${formatSchemeStructure(paid, free)}</div>`;
  }

  function schemeMasterIdentityPlainText(row) {
    const name = schemeMasterRowValue(row, ["scheme_name"], "--");
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    const total = schemeMasterTotalQty(row);
    const discount = schemeMasterEffectiveDiscount(row);
    return `${name} · ${formatSchemeStructure(paid, free)} (total ${formatSchemeQty(total)}) · ${formatEffectiveFreeDiscountPct(discount)}`;
  }

  function schemeMasterIdentityText(row) {
    return schemeMasterIdentityPlainText(row);
  }

  function formatSchemeMasterEventLabel(eventType) {
    const key = String(eventType || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (key === "BASELINE") {
      return "Baseline — migration baseline, not original creation evidence";
    }
    const labels = {
      CREATED: "Created",
      METADATA_CORRECTED: "Metadata Corrected",
      DEACTIVATED: "Deactivated",
      REACTIVATED: "Reactivated",
    };
    return labels[key] || text(eventType);
  }

  function formatSchemeMasterActiveState(value) {
    if (value === true || String(value).toUpperCase() === "ACTIVE") {
      return "ACTIVE";
    }
    if (value === false || String(value).toUpperCase() === "INACTIVE") {
      return "INACTIVE";
    }
    if (value === null || value === undefined || value === "") return "--";
    return text(value);
  }

  function setSchemeMasterModalError(el, message) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  async function refreshSchemeAssignmentOptions() {
    await loadSchemeOptions();
    populateSchemePolicySchemeOptions();
    populateSchemeRuleSchemeOptions();
  }

  async function afterSchemeMasterMutation({ refreshHistory = false } = {}) {
    await refreshSchemeAssignmentOptions();
    await reloadRows();
    if (
      refreshHistory &&
      schemeMasterHistoryRow?.scheme_id &&
      !dom.schemeMasterHistoryModal?.classList.contains("hidden")
    ) {
      await renderSchemeMasterHistoryContent(schemeMasterHistoryRow);
    }
  }

  function computeSchemeCreatePreview() {
    const name = dom.schemeMasterCreateName?.value?.trim() || "";
    const paidQty = numberOrNullFromInput(dom.schemeMasterCreatePaidQty);
    const freeQty = numberOrNullFromInput(dom.schemeMasterCreateFreeQty);
    const freeQtyValue = freeQty === null ? 0 : freeQty;

    if (!name) {
      return { valid: false, message: "Enter a scheme name to preview." };
    }
    if (!Number.isFinite(paidQty) || paidQty <= 0) {
      return { valid: false, message: "Enter paid quantity greater than zero." };
    }
    if (!Number.isFinite(freeQtyValue) || freeQtyValue < 0) {
      return {
        valid: false,
        message: "Enter free quantity zero or greater.",
      };
    }

    const totalQty = paidQty + freeQtyValue;
    const discount = computeEffectiveFreeDiscountPct(paidQty, freeQtyValue);
    const structure = formatSchemeStructure(paidQty, freeQtyValue);

    return {
      valid: true,
      displayName: `${name} (${structure.replace(" + ", "+")})`,
      structure,
      totalQty,
      discount,
    };
  }

  function renderSchemeCreatePreviewHtml(preview) {
    if (!preview?.valid) {
      return `<div class="cp-muted-text">${text(preview?.message || "Enter values to see a preview.")}</div>`;
    }
    return `
      <div class="cp-preview-row"><span>Display Name</span><span class="cp-preview-value">${text(preview.displayName)}</span></div>
      <div class="cp-preview-row"><span>Paid + Free</span><span class="cp-preview-value">${text(preview.structure)}</span></div>
      <div class="cp-preview-row"><span>Total Quantity</span><span class="cp-preview-value">${formatSchemeQty(preview.totalQty)}</span></div>
      <div class="cp-preview-row"><span>Effective Free Discount %</span><span class="cp-preview-value">${formatEffectiveFreeDiscountPct(preview.discount)}</span></div>
    `;
  }

  function updateSchemeCreatePreview() {
    if (!dom.schemeMasterCreatePreview) return;
    const preview = computeSchemeCreatePreview();
    dom.schemeMasterCreatePreview.innerHTML = `
      <div class="cp-card-label">Preview</div>
      ${renderSchemeCreatePreviewHtml(preview)}
    `;
    setSchemeMasterCreateSaveState();
  }

  function setSchemeMasterCreateSaveState() {
    if (!dom.schemeMasterCreateSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterCreateSaveBtn.disabled = true;
      return;
    }
    const preview = computeSchemeCreatePreview();
    dom.schemeMasterCreateSaveBtn.disabled = !preview.valid;
  }

  function openSchemeMasterCreateModal() {
    if (!requireEditAccess("create schemes")) return;
    if (!dom.schemeMasterCreateModal) return;

    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterCreateError, "");

    if (dom.schemeMasterCreateName) dom.schemeMasterCreateName.value = "";
    if (dom.schemeMasterCreatePaidQty) dom.schemeMasterCreatePaidQty.value = "";
    if (dom.schemeMasterCreateFreeQty) dom.schemeMasterCreateFreeQty.value = "0";
    if (dom.schemeMasterCreateRemarks) dom.schemeMasterCreateRemarks.value = "";
    if (dom.schemeMasterCreateApprovalReference) {
      dom.schemeMasterCreateApprovalReference.value = "";
    }

    updateSchemeCreatePreview();
    dom.schemeMasterCreateModal.classList.remove("hidden");
    dom.schemeMasterCreateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterCreateName?.focus(), 0);
  }

  function closeSchemeMasterCreateModal() {
    if (!dom.schemeMasterCreateModal) return;
    dom.schemeMasterCreateModal.classList.add("hidden");
    dom.schemeMasterCreateModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterCreateError, "");
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemeMasterCreate() {
    if (!requireEditAccess("create schemes")) return;

    const preview = computeSchemeCreatePreview();
    if (!preview.valid) {
      setSchemeMasterModalError(
        dom.schemeMasterCreateError,
        preview.message || "Create form is invalid.",
      );
      setSchemeMasterCreateSaveState();
      return;
    }

    const paidQty = numberOrNullFromInput(dom.schemeMasterCreatePaidQty);
    const freeQty = numberOrNullFromInput(dom.schemeMasterCreateFreeQty);
    const remarks = dom.schemeMasterCreateRemarks?.value?.trim() || null;
    const approvalReference =
      dom.schemeMasterCreateApprovalReference?.value?.trim() || null;

    schemeMasterSaving = true;
    if (dom.schemeMasterCreateSaveBtn) dom.schemeMasterCreateSaveBtn.disabled = true;
    setSchemeMasterModalError(dom.schemeMasterCreateError, "");
    setLoadingMask(true, "Creating scheme...");

    try {
      const { error } = await costingRpc("rpc_create_scheme_master", {
        p_scheme_name: dom.schemeMasterCreateName?.value?.trim(),
        p_paid_qty: paidQty,
        p_free_qty: freeQty === null ? 0 : freeQty,
        p_remarks: remarks,
        p_approval_reference: approvalReference,
      });
      if (error) throw error;

      closeSchemeMasterCreateModal();
      showToast("Scheme created.", "success", 4200);
      policyManagerTab = "scheme-master";
      await afterSchemeMasterMutation();
    } catch (err) {
      const message = err?.message
        ? `Failed to create scheme: ${err.message}`
        : "Failed to create scheme.";
      setSchemeMasterModalError(dom.schemeMasterCreateError, message);
      handleError("Failed to create scheme", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterCreateSaveState();
    }
  }

  function openSchemeMasterMetadataModal(row) {
    if (!requireEditAccess("correct scheme metadata")) return;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_edit_metadata")) {
      showToast("This scheme cannot be edited.", "error");
      return;
    }
    if (!dom.schemeMasterMetadataModal) return;

    schemeMasterMetadataRow = row;
    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterMetadataError, "");

    if (dom.schemeMasterMetadataStructure) {
      dom.schemeMasterMetadataStructure.textContent = schemeMasterIdentityText(row);
    }
    if (dom.schemeMasterMetadataName) {
      dom.schemeMasterMetadataName.value = row.scheme_name || "";
    }
    if (dom.schemeMasterMetadataRemarks) {
      dom.schemeMasterMetadataRemarks.value = row.remarks || "";
    }
    if (dom.schemeMasterMetadataReason) dom.schemeMasterMetadataReason.value = "";
    if (dom.schemeMasterMetadataApprovalReference) {
      dom.schemeMasterMetadataApprovalReference.value = "";
    }

    setSchemeMasterMetadataSaveState();
    dom.schemeMasterMetadataModal.classList.remove("hidden");
    dom.schemeMasterMetadataModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterMetadataName?.focus(), 0);
  }

  function closeSchemeMasterMetadataModal() {
    if (!dom.schemeMasterMetadataModal) return;
    dom.schemeMasterMetadataModal.classList.add("hidden");
    dom.schemeMasterMetadataModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterMetadataError, "");
    schemeMasterMetadataRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setSchemeMasterMetadataSaveState() {
    if (!dom.schemeMasterMetadataSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterMetadataSaveBtn.disabled = true;
      return;
    }
    const name = dom.schemeMasterMetadataName?.value?.trim() || "";
    const reason = dom.schemeMasterMetadataReason?.value?.trim() || "";
    dom.schemeMasterMetadataSaveBtn.disabled = !(name && reason);
  }

  async function saveSchemeMasterMetadata() {
    if (!requireEditAccess("correct scheme metadata")) return;
    const row = schemeMasterMetadataRow;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_edit_metadata")) {
      showToast("This scheme cannot be edited.", "error");
      return;
    }

    const name = dom.schemeMasterMetadataName?.value?.trim() || "";
    const reason = dom.schemeMasterMetadataReason?.value?.trim() || "";
    if (!name || !reason) {
      setSchemeMasterModalError(
        dom.schemeMasterMetadataError,
        "Scheme name and correction reason are required.",
      );
      setSchemeMasterMetadataSaveState();
      return;
    }

    schemeMasterSaving = true;
    if (dom.schemeMasterMetadataSaveBtn) {
      dom.schemeMasterMetadataSaveBtn.disabled = true;
    }
    setSchemeMasterModalError(dom.schemeMasterMetadataError, "");
    setLoadingMask(true, "Saving scheme metadata...");

    try {
      const { error } = await costingRpc("rpc_update_scheme_master_metadata", {
        p_scheme_id: row.scheme_id,
        p_scheme_name: name,
        p_remarks: dom.schemeMasterMetadataRemarks?.value?.trim() || null,
        p_reason: reason,
        p_approval_reference:
          dom.schemeMasterMetadataApprovalReference?.value?.trim() || null,
      });
      if (error) throw error;

      closeSchemeMasterMetadataModal();
      showToast("Scheme metadata corrected.", "success", 4200);
      policyManagerTab = "scheme-master";
      await afterSchemeMasterMutation({ refreshHistory: true });
    } catch (err) {
      const message = err?.message
        ? `Failed to save scheme metadata: ${err.message}`
        : "Failed to save scheme metadata.";
      setSchemeMasterModalError(dom.schemeMasterMetadataError, message);
      handleError("Failed to save scheme metadata", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterMetadataSaveState();
    }
  }

  function openSchemeMasterDeactivateModal(row) {
    if (!requireEditAccess("deactivate schemes")) return;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_deactivate")) {
      showToast("This scheme cannot be deactivated.", "error");
      return;
    }
    if (!dom.schemeMasterDeactivateModal) return;

    schemeMasterDeactivateRow = row;
    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterDeactivateError, "");

    if (dom.schemeMasterDeactivateIdentity) {
      dom.schemeMasterDeactivateIdentity.textContent = schemeMasterIdentityText(row);
    }
    if (dom.schemeMasterDeactivateDirectPolicies) {
      dom.schemeMasterDeactivateDirectPolicies.textContent = formatSchemeQty(
        schemeMasterRowNumber(row, [
          "active_direct_policies",
          "active_direct_policy_count",
        ]),
      );
    }
    if (dom.schemeMasterDeactivateHierarchyRules) {
      dom.schemeMasterDeactivateHierarchyRules.textContent = formatSchemeQty(
        schemeMasterRowNumber(row, [
          "active_hierarchy_rules",
          "active_hierarchy_rule_count",
        ]),
      );
    }
    if (dom.schemeMasterDeactivateReplacementRefs) {
      dom.schemeMasterDeactivateReplacementRefs.textContent = formatSchemeQty(
        schemeMasterRowNumber(row, [
          "active_replacement_references",
          "active_replacement_reference_count",
        ]),
      );
    }
    if (dom.schemeMasterDeactivateReason) {
      dom.schemeMasterDeactivateReason.value = "";
    }
    if (dom.schemeMasterDeactivateApprovalReference) {
      dom.schemeMasterDeactivateApprovalReference.value = "";
    }

    setSchemeMasterDeactivateSaveState();
    dom.schemeMasterDeactivateModal.classList.remove("hidden");
    dom.schemeMasterDeactivateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterDeactivateReason?.focus(), 0);
  }

  function closeSchemeMasterDeactivateModal() {
    if (!dom.schemeMasterDeactivateModal) return;
    dom.schemeMasterDeactivateModal.classList.add("hidden");
    dom.schemeMasterDeactivateModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterDeactivateError, "");
    schemeMasterDeactivateRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setSchemeMasterDeactivateSaveState() {
    if (!dom.schemeMasterDeactivateSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterDeactivateSaveBtn.disabled = true;
      return;
    }
    const reason = dom.schemeMasterDeactivateReason?.value?.trim() || "";
    dom.schemeMasterDeactivateSaveBtn.disabled = !reason;
  }

  async function saveSchemeMasterDeactivate() {
    if (!requireEditAccess("deactivate schemes")) return;
    const row = schemeMasterDeactivateRow;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_deactivate")) {
      showToast("This scheme cannot be deactivated.", "error");
      return;
    }

    const reason = dom.schemeMasterDeactivateReason?.value?.trim() || "";
    if (!reason) {
      setSchemeMasterModalError(
        dom.schemeMasterDeactivateError,
        "Deactivation reason is required.",
      );
      setSchemeMasterDeactivateSaveState();
      return;
    }

    schemeMasterSaving = true;
    if (dom.schemeMasterDeactivateSaveBtn) {
      dom.schemeMasterDeactivateSaveBtn.disabled = true;
    }
    setSchemeMasterModalError(dom.schemeMasterDeactivateError, "");
    setLoadingMask(true, "Deactivating scheme...");

    try {
      const { error } = await costingRpc("rpc_deactivate_scheme_master", {
        p_scheme_id: row.scheme_id,
        p_reason: reason,
        p_approval_reference:
          dom.schemeMasterDeactivateApprovalReference?.value?.trim() || null,
      });
      if (error) throw error;

      closeSchemeMasterDeactivateModal();
      showToast("Scheme deactivated.", "success", 4200);
      policyManagerTab = "scheme-master";
      await afterSchemeMasterMutation({ refreshHistory: true });
    } catch (err) {
      const message = err?.message
        ? `Failed to deactivate scheme: ${err.message}`
        : "Failed to deactivate scheme.";
      setSchemeMasterModalError(dom.schemeMasterDeactivateError, message);
      handleError("Failed to deactivate scheme", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterDeactivateSaveState();
    }
  }

  function openSchemeMasterReactivateModal(row) {
    if (!requireEditAccess("reactivate schemes")) return;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_reactivate")) {
      showToast("This scheme cannot be reactivated.", "error");
      return;
    }
    if (!dom.schemeMasterReactivateModal) return;

    schemeMasterReactivateRow = row;
    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterReactivateError, "");

    if (dom.schemeMasterReactivateIdentity) {
      dom.schemeMasterReactivateIdentity.textContent = schemeMasterIdentityText(row);
    }
    if (dom.schemeMasterReactivateReason) {
      dom.schemeMasterReactivateReason.value = "";
    }
    if (dom.schemeMasterReactivateApprovalReference) {
      dom.schemeMasterReactivateApprovalReference.value = "";
    }

    setSchemeMasterReactivateSaveState();
    dom.schemeMasterReactivateModal.classList.remove("hidden");
    dom.schemeMasterReactivateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterReactivateReason?.focus(), 0);
  }

  function closeSchemeMasterReactivateModal() {
    if (!dom.schemeMasterReactivateModal) return;
    dom.schemeMasterReactivateModal.classList.add("hidden");
    dom.schemeMasterReactivateModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterReactivateError, "");
    schemeMasterReactivateRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setSchemeMasterReactivateSaveState() {
    if (!dom.schemeMasterReactivateSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterReactivateSaveBtn.disabled = true;
      return;
    }
    const reason = dom.schemeMasterReactivateReason?.value?.trim() || "";
    dom.schemeMasterReactivateSaveBtn.disabled = !reason;
  }

  async function saveSchemeMasterReactivate() {
    if (!requireEditAccess("reactivate schemes")) return;
    const row = schemeMasterReactivateRow;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_reactivate")) {
      showToast("This scheme cannot be reactivated.", "error");
      return;
    }

    const reason = dom.schemeMasterReactivateReason?.value?.trim() || "";
    if (!reason) {
      setSchemeMasterModalError(
        dom.schemeMasterReactivateError,
        "Reactivation reason is required.",
      );
      setSchemeMasterReactivateSaveState();
      return;
    }

    schemeMasterSaving = true;
    if (dom.schemeMasterReactivateSaveBtn) {
      dom.schemeMasterReactivateSaveBtn.disabled = true;
    }
    setSchemeMasterModalError(dom.schemeMasterReactivateError, "");
    setLoadingMask(true, "Reactivating scheme...");

    try {
      const { error } = await costingRpc("rpc_reactivate_scheme_master", {
        p_scheme_id: row.scheme_id,
        p_reason: reason,
        p_approval_reference:
          dom.schemeMasterReactivateApprovalReference?.value?.trim() || null,
      });
      if (error) throw error;

      closeSchemeMasterReactivateModal();
      showToast("Scheme reactivated.", "success", 4200);
      policyManagerTab = "scheme-master";
      await afterSchemeMasterMutation({ refreshHistory: true });
    } catch (err) {
      const message = err?.message
        ? `Failed to reactivate scheme: ${err.message}`
        : "Failed to reactivate scheme.";
      setSchemeMasterModalError(dom.schemeMasterReactivateError, message);
      handleError("Failed to reactivate scheme", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterReactivateSaveState();
    }
  }

  async function fetchSchemeMasterAudit(schemeId) {
    const { data, error } = await costingFrom("v_costing_scheme_master_audit")
      .select("*")
      .eq("scheme_id", schemeId)
      .order("event_at", { ascending: false })
      .order("audit_event_id", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  }

  async function renderSchemeMasterHistoryContent(row) {
    if (!dom.schemeMasterHistoryBody) return;

    dom.schemeMasterHistoryBody.innerHTML =
      `<div class="cp-muted-text">Loading history...</div>`;

    const rows = await fetchSchemeMasterAudit(row.scheme_id);
    if (!rows.length) {
      dom.schemeMasterHistoryBody.innerHTML =
        `<div class="status">No audit history available.</div>`;
      return;
    }

    const table = simpleTable(
      [
        "Event",
        "Event Date/Time",
        "Reason",
        "Approval Reference",
        "Actor",
        "Old Name",
        "New Name",
        "Paid/Free Structure",
        "Old Active State",
        "New Active State",
        "Old Remarks",
        "New Remarks",
      ],
      rows,
      (auditRow) => {
        const paid = schemeMasterRowNumber(auditRow, ["paid_qty"]);
        const free = schemeMasterRowNumber(auditRow, ["free_qty"]);
        const structure =
          paid === null && free === null
            ? "--"
            : formatSchemeStructure(paid, free);
        const oldName = schemeMasterRowValue(auditRow, [
          "old_scheme_name",
          "old_name",
        ]);
        const newName = schemeMasterRowValue(auditRow, [
          "new_scheme_name",
          "new_name",
        ]);
        const oldActive = formatSchemeMasterActiveState(
          schemeMasterRowValue(auditRow, [
            "old_is_active",
            "old_active_state",
          ], null),
        );
        const newActive = formatSchemeMasterActiveState(
          schemeMasterRowValue(auditRow, [
            "new_is_active",
            "new_active_state",
          ], null),
        );

        return `<tr>
          <td>${formatSchemeMasterEventLabel(auditRow.event_type || auditRow.event)}</td>
          <td>${formatDateTime(auditRow.event_at)}</td>
          <td>${text(auditRow.reason)}</td>
          <td>${text(auditRow.approval_reference)}</td>
          <td>${text(auditRow.actor || auditRow.event_actor || auditRow.created_by)}</td>
          <td>${text(oldName)}</td>
          <td>${text(newName)}</td>
          <td>${text(structure)}</td>
          <td>${text(oldActive)}</td>
          <td>${text(newActive)}</td>
          <td>${text(auditRow.old_remarks)}</td>
          <td>${text(auditRow.new_remarks)}</td>
        </tr>`;
      },
    );

    dom.schemeMasterHistoryBody.innerHTML = table;
  }

  async function openSchemeMasterHistoryModal(row) {
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!dom.schemeMasterHistoryModal) return;

    schemeMasterHistoryRow = row;
    schemeMasterReturnFocus = document.activeElement;

    if (dom.schemeMasterHistoryTitle) {
      dom.schemeMasterHistoryTitle.textContent = `Scheme History — ${row.scheme_name || row.scheme_id}`;
    }

    dom.schemeMasterHistoryModal.classList.remove("hidden");
    dom.schemeMasterHistoryModal.setAttribute("aria-hidden", "false");

    try {
      await renderSchemeMasterHistoryContent(row);
    } catch (err) {
      dom.schemeMasterHistoryBody.innerHTML =
        `<div class="status">Failed to load scheme history.</div>`;
      handleError("Failed to load scheme history", err);
    }
  }

  function closeSchemeMasterHistoryModal() {
    if (!dom.schemeMasterHistoryModal) return;
    dom.schemeMasterHistoryModal.classList.add("hidden");
    dom.schemeMasterHistoryModal.setAttribute("aria-hidden", "true");
    schemeMasterHistoryRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function renderSchemeMasterActions(row) {
    const schemeId = text(row.scheme_id);
    const canEdit = canEditPolicyActions();
    const historyBtn = `<button
      type="button"
      class="icon-btn"
      data-scheme-master-history-id="${schemeId}"
      title="History"
      aria-label="History"
    >History</button>`;

    if (!canEdit) {
      return `<div class="cp-scheme-master-actions">${historyBtn}</div>`;
    }

    const parts = [historyBtn];
    if (schemeMasterRowBool(row, "can_edit_metadata")) {
      parts.push(`<button
        type="button"
        class="icon-btn"
        data-scheme-master-edit-id="${schemeId}"
        title="Edit Metadata"
        aria-label="Edit Metadata"
      >Edit</button>`);
    }
    if (schemeMasterRowBool(row, "can_deactivate")) {
      parts.push(`<button
        type="button"
        class="icon-btn cp-danger-icon-btn"
        data-scheme-master-deactivate-id="${schemeId}"
        title="Deactivate"
        aria-label="Deactivate"
      >Deactivate</button>`);
    }
    if (schemeMasterRowBool(row, "can_reactivate")) {
      parts.push(`<button
        type="button"
        class="icon-btn icon-btn-primary"
        data-scheme-master-reactivate-id="${schemeId}"
        title="Reactivate"
        aria-label="Reactivate"
      >Reactivate</button>`);
    }

    return `<div class="cp-scheme-master-actions">${parts.join("")}</div>`;
  }

  function getPolicyManagerTab() {
    return policyManagerTab;
  }

  function setPolicyManagerTab(tabId) {
    policyManagerTab = tabId || "sku-overview";
  }

  async function loadPolicyManagerRows() {
    if (policyManagerTab === "scheme-master") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_scheme_master_register")
            .select("*")
            .order("scheme_name", { ascending: true }),
        1000,
      );
    }
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

    if (!canEditPolicyActions()) {
      dom.sellingPolicyEditSaveBtn.disabled = true;
      return;
    }

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
    if (!requireEditAccess("edit selling price policy")) return;
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
    if (!requireEditAccess("save selling price policy")) return;
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

    if (!canEditPolicyActions()) {
      dom.schemePolicyEditSaveBtn.disabled = true;
      return;
    }

    const currentSchemeId = Number(dom.schemePolicyEditScheme?.value || 0);
    const initialSchemeId = Number(schemePolicyInitial.schemeId || 0);

    const hasSchemeChange =
      currentSchemeId > 0 && currentSchemeId !== initialSchemeId;

    dom.schemePolicyEditSaveBtn.disabled = !hasSchemeChange;
  }

  function populateSchemePolicySchemeOptions() {
    if (!dom.schemePolicyEditScheme) return;

    const options = schemeOptions
      .map(
        (s) =>
          `<option value="${text(s.scheme_id)}">
        ${text(s.scheme_name)} (${formatNumber(s.paid_qty)} + ${formatNumber(s.free_qty)})
      </option>`,
      )
      .join("");

    dom.schemePolicyEditScheme.innerHTML = options
      ? options
      : `<option value="">No schemes available</option>`;
  }

  function schemeEffectiveFromForRegion(row, region) {
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row?.ik_scheme_effective_from || activePeriodIso();
    if (r === "OK") return row?.ok_scheme_effective_from || activePeriodIso();
    return activePeriodIso();
  }

  function schemeRemarksForRegion(row, region) {
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row?.ik_remarks || "";
    if (r === "OK") return row?.ok_remarks || "";
    return "";
  }

  function openSchemePolicyEditModal(row, regionCode = "IK") {
    if (!requireEditAccess("edit scheme policy")) return;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }
    if (!dom.schemePolicyEditModal) return;

    schemePolicyEditRow = row;
    schemePolicyReturnFocus = document.activeElement;

    const skuLabel =
      row.sku_display_name || row.sku_column_label || row.sku_id || "--";

    if (dom.schemePolicyEditSkuLabel) {
      dom.schemePolicyEditSkuLabel.textContent = skuLabel;
    }

    populateSchemePolicySchemeOptions();

    const region = String(regionCode || "IK").toUpperCase();
    if (dom.schemePolicyEditRegion) {
      dom.schemePolicyEditRegion.value = region;
      dom.schemePolicyEditRegion.disabled = true;
    }

    populateSchemePolicySelectionForRegion(region);

    if (dom.schemePolicyEditEffectiveFrom) {
      dom.schemePolicyEditEffectiveFrom.value = schemeEffectiveFromForRegion(
        row,
        region,
      );
    }
    if (dom.schemePolicyEditRemarks) {
      dom.schemePolicyEditRemarks.value = schemeRemarksForRegion(row, region);
    }

    dom.schemePolicyEditModal.classList.remove("hidden");
    dom.schemePolicyEditModal.setAttribute("aria-hidden", "false");

    setSchemePolicySaveState();

    setTimeout(() => dom.schemePolicyEditScheme?.focus(), 0);
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

    if (!canEditPolicyActions()) {
      dom.schemeRuleEditSaveBtn.disabled = true;
      return;
    }

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
    if (!requireEditAccess("create hierarchy scheme rules")) return;
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
    if (!requireEditAccess("save hierarchy scheme rules")) return;
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

    if (!canEditPolicyActions()) {
      dom.schemeRuleCloseSaveBtn.disabled = true;
      return;
    }

    const values = readSchemeRuleCloseFormValues();
    dom.schemeRuleCloseSaveBtn.disabled = values.remarks.length < 5;
  }

  function openSchemeRuleCloseModal(row) {
    if (!requireEditAccess("close hierarchy scheme rules")) return;
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
    if (!requireEditAccess("close hierarchy scheme rules")) return;
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

    if (dom.schemePolicyEditRegion) {
      dom.schemePolicyEditRegion.disabled = false;
    }

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemePolicyEdit() {
    if (!requireEditAccess("save scheme policy")) return;
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
      if (policyManagerTab === "scheme-master") {
        const paid = schemeMasterRowNumber(row, ["paid_qty"]);
        const free = schemeMasterRowNumber(row, ["free_qty"]);
        const total = schemeMasterTotalQty(row);
        const discount = schemeMasterEffectiveDiscount(row);
        return `<tr ${trAttrs}>
        <td>${schemeMasterDisplayName(row)}</td>
        <td class="c-right">${formatSchemeQty(paid)}</td>
        <td class="c-right">${formatSchemeQty(free)}</td>
        <td class="c-right">${formatSchemeQty(total)}</td>
        <td class="c-right">${formatEffectiveFreeDiscountPct(discount)}</td>
        <td>${schemeMasterStatusChip(row)}</td>
        <td>${schemeMasterTypeBadge(row)}</td>
        <td class="c-right">${formatSchemeQty(
          schemeMasterRowNumber(row, [
            "active_direct_policies",
            "active_direct_policy_count",
          ]),
        )}</td>
        <td class="c-right">${formatSchemeQty(
          schemeMasterRowNumber(row, [
            "active_hierarchy_rules",
            "active_hierarchy_rule_count",
          ]),
        )}</td>
        <td class="c-right">${formatSchemeQty(
          schemeMasterRowNumber(row, ["viability_periods", "viability_period_count"]),
        )}</td>
        <td>${formatDateTime(row.updated_at)}</td>
        <td class="c-center">${renderSchemeMasterActions(row)}</td>
      </tr>`;
      }

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
            canEditPolicyActions() &&
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
      ["scheme-master", "Scheme Master"],
      ["scheme-rule-register", "Scheme Rule Register"],
    ];

    const showCreateScheme =
      canEditPolicyActions() && policyManagerTab === "scheme-master";
    const showCreateRule =
      canEditPolicyActions() && policyManagerTab === "scheme-rule-register";

    workbenchSummaryEl.classList.add("is-visible");
    workbenchSummaryEl.innerHTML = `
    <div class="cp-policy-manager-tab-bar">
      <div class="cp-workbench-compact-summary cp-policy-manager-tab-cards">
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
      <div class="cp-policy-manager-tab-actions">
        ${
          showCreateScheme
            ? `<button
                type="button"
                class="icon-btn icon-btn-primary cp-policy-create-rule-btn"
                data-create-scheme-master
                title="Create Scheme"
                aria-label="Create Scheme"
              >
                Create Scheme
              </button>`
            : ""
        }
        ${
          showCreateRule
            ? `<button
                type="button"
                class="icon-btn icon-btn-primary cp-policy-create-rule-btn"
                data-create-scheme-rule
                title="Create Hierarchy Scheme Rule"
                aria-label="Create Hierarchy Scheme Rule"
              >
                Create Rule
              </button>`
            : ""
        }
      </div>
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

    workbenchSummaryEl
      .querySelector("[data-create-scheme-master]")
      ?.addEventListener("click", () => openSchemeMasterCreateModal());

    workbenchSummaryEl
      .querySelector("[data-create-scheme-rule]")
      ?.addEventListener("click", () => openSchemeRuleEditModal());
  }

  function wirePolicyManagerTableActions(tableBody, getViewRow) {
    if (policyManagerTab === "scheme-master") {
      tableBody
        .querySelectorAll("[data-scheme-master-history-id]")
        .forEach((btn) => {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const schemeId = btn.dataset.schemeMasterHistoryId;
            const row = getViewRow(
              (r) => String(r.scheme_id) === String(schemeId),
            );
            if (row) void openSchemeMasterHistoryModal(row);
          });
        });

      tableBody
        .querySelectorAll("[data-scheme-master-edit-id]")
        .forEach((btn) => {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const schemeId = btn.dataset.schemeMasterEditId;
            const row = getViewRow(
              (r) => String(r.scheme_id) === String(schemeId),
            );
            if (row) openSchemeMasterMetadataModal(row);
          });
        });

      tableBody
        .querySelectorAll("[data-scheme-master-deactivate-id]")
        .forEach((btn) => {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const schemeId = btn.dataset.schemeMasterDeactivateId;
            const row = getViewRow(
              (r) => String(r.scheme_id) === String(schemeId),
            );
            if (row) openSchemeMasterDeactivateModal(row);
          });
        });

      tableBody
        .querySelectorAll("[data-scheme-master-reactivate-id]")
        .forEach((btn) => {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const schemeId = btn.dataset.schemeMasterReactivateId;
            const row = getViewRow(
              (r) => String(r.scheme_id) === String(schemeId),
            );
            if (row) openSchemeMasterReactivateModal(row);
          });
        });
      return;
    }

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
        { id: "mrp-policy", label: "MRP Policy" },
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
            `${formatOptionalMoney(row.mrp_ik)} / ${formatOptionalMoney(row.mrp_ok)}`,
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

    if (tabId === "mrp-policy") {
      const { data: currentPolicy, error } = await fetchCurrentMrpPolicy(
        row.sku_id,
      );
      if (error) {
        throw error;
      }
      return renderMrpPolicyTabContent(row, currentPolicy);
    }

    if (tabId === "selling-policy") {
      const editButton = canEditPolicyActions()
        ? `
      <div class="cp-drawer-action-bar">
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
          Edit Selling Policy
        </button>
      </div>
    `
        : "";

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
      const schemeActions = canEditPolicyActions()
        ? `
      <div class="cp-drawer-action-bar">
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="editSchemePolicyIkBtn"
          title="Edit IK Scheme"
          aria-label="Edit IK Scheme"
        >
          Edit IK Scheme
        </button>
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="editSchemePolicyOkBtn"
          title="Edit OK Scheme"
          aria-label="Edit OK Scheme"
        >
          Edit OK Scheme
        </button>
      </div>
    `
        : "";

      const schemeTable = simpleTable(
        [
          "Region",
          "Scheme",
          "Source",
          "Scope",
          "Rule ID",
          "Apply Mode",
          "Paid Qty",
          "Free Qty",
          "Effective From",
          "Effective To",
          "Active",
          "Remarks",
        ],
        [
          {
            region: "IK",
            scheme: row.ik_selected_scheme_name,
            source: row.ik_policy_source_label,
            scope: row.ik_policy_scope,
            ruleId: row.ik_policy_rule_id,
            applyMode: row.ik_apply_mode,
            paid: row.ik_scheme_paid_qty,
            free: row.ik_scheme_free_qty,
            from: row.ik_scheme_effective_from,
            to: row.ik_scheme_effective_to,
            active: row.ik_scheme_policy_active,
            remarks: row.ik_remarks,
          },
          {
            region: "OK",
            scheme: row.ok_selected_scheme_name,
            source: row.ok_policy_source_label,
            scope: row.ok_policy_scope,
            ruleId: row.ok_policy_rule_id,
            applyMode: row.ok_apply_mode,
            paid: row.ok_scheme_paid_qty,
            free: row.ok_scheme_free_qty,
            from: row.ok_scheme_effective_from,
            to: row.ok_scheme_effective_to,
            active: row.ok_scheme_policy_active,
            remarks: row.ok_remarks,
          },
        ],
        (r) =>
          `<tr>
          <td>${text(r.region)}</td>
          <td>${text(r.scheme)}</td>
          <td>${text(r.source)}</td>
          <td>${text(r.scope)}</td>
          <td>${text(r.ruleId)}</td>
          <td>${text(r.applyMode)}</td>
          <td class="c-right">${formatNumber(r.paid)}</td>
          <td class="c-right">${formatNumber(r.free)}</td>
          <td>${formatDate(r.from)}</td>
          <td>${formatDate(r.to)}</td>
          <td>${text(r.active)}</td>
          <td>${text(r.remarks)}</td>
        </tr>`,
      );

      return schemeActions + schemeTable;
    }

    if (tabId === "policy-history") {
      const sellingRows = await fetchSellingPolicyHistory(row);
      const schemeRows = await fetchSchemePolicyHistory(row);
      const mrpRows = await fetchMrpPolicyHistory(row);

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

      const mrpTable = simpleTable(
        [
          "Lifecycle",
          "Policy ID",
          "MRP IK",
          "MRP OK",
          "OK Uplift %",
          "Mode",
          "Effective From",
          "Effective To",
          "Reason",
          "Approval Ref",
          "Source Type",
          "Source Quality",
          "Prev Policy",
          "Created At",
          "Created By",
          "Closed At",
          "Closed By",
        ],
        mrpRows,
        (r) =>
          `<tr>
          <td>${compactStatusText(r.lifecycle_label || r.status)}</td>
          <td>${text(r.policy_id)}</td>
          <td class="c-right">${formatOptionalMoney(r.mrp_ik)}</td>
          <td class="c-right">${formatOptionalMoney(r.mrp_ok)}</td>
          <td class="c-right">${formatOkPctFromDecimal(r.ok_pct)}</td>
          <td>${text(r.calc_mode)}</td>
          <td>${formatDate(r.effective_from)}</td>
          <td>${formatDate(r.effective_to)}</td>
          <td>${text(r.reason)}</td>
          <td>${text(r.approval_reference)}</td>
          <td>${text(r.source_type)}</td>
          <td>${formatMrpSourceQualityLabel(r.source_quality, r.source_type)}</td>
          <td>${text(r.previous_policy_id)}</td>
          <td>${formatDateTime(r.created_at)}</td>
          <td>${text(r.created_by)}</td>
          <td>${formatDateTime(r.closed_at)}</td>
          <td>${text(r.closed_by)}</td>
        </tr>`,
      );

      return `
      <div class="cp-card" style="margin-bottom:10px">
        <div class="cp-card-label">Policy History</div>
        <div class="cp-card-value">
          This section shows the audit trail of selling price, scheme, and MRP policy changes for the selected SKU.
        </div>
      </div>

      <h3 class="cp-section-title">Selling Price Policy History</h3>
      ${sellingTable}

      <h3 class="cp-section-title" style="margin-top:14px">Scheme Policy History</h3>
      ${schemeTable}

      <h3 class="cp-section-title" style="margin-top:14px">MRP Policy History</h3>
      ${mrpTable}
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
    if (tabId === "mrp-policy") {
      document.getElementById("editMrpPolicyBtn")?.addEventListener(
        "click",
        () => openMrpPolicyEditModal(row),
      );
    }

    if (tabId === "selling-policy") {
      document.getElementById("editSellingPolicyBtn")?.addEventListener(
        "click",
        () => openSellingPolicyEditModal(row),
      );
    }

    if (tabId === "scheme-policy") {
      document.getElementById("editSchemePolicyIkBtn")?.addEventListener(
        "click",
        () => openSchemePolicyEditModal(row, "IK"),
      );
      document.getElementById("editSchemePolicyOkBtn")?.addEventListener(
        "click",
        () => openSchemePolicyEditModal(row, "OK"),
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
    if (!dom.mrpPolicyEditModal?.classList.contains("hidden")) {
      closeMrpPolicyEditModal();
      return true;
    }
    if (!dom.schemeMasterCreateModal?.classList.contains("hidden")) {
      closeSchemeMasterCreateModal();
      return true;
    }
    if (!dom.schemeMasterMetadataModal?.classList.contains("hidden")) {
      closeSchemeMasterMetadataModal();
      return true;
    }
    if (!dom.schemeMasterDeactivateModal?.classList.contains("hidden")) {
      closeSchemeMasterDeactivateModal();
      return true;
    }
    if (!dom.schemeMasterReactivateModal?.classList.contains("hidden")) {
      closeSchemeMasterReactivateModal();
      return true;
    }
    if (!dom.schemeMasterHistoryModal?.classList.contains("hidden")) {
      closeSchemeMasterHistoryModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    syncPricingPolicyWriteUi();
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
    dom.mrpPolicyEditCloseBtn?.addEventListener("click", closeMrpPolicyEditModal);
    dom.mrpPolicyEditCancelBtn?.addEventListener("click", closeMrpPolicyEditModal);
    dom.mrpPolicyEditSaveBtn?.addEventListener("click", saveMrpPolicyEdit);
    dom.mrpPolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpPolicyEditModal) closeMrpPolicyEditModal();
    });
    const onMrpDriverInput = (driver) => () => {
      if (mrpFieldSyncing) return;
      mrpInputDriver = driver;
      updateMrpPolicyPreview();
    };
    dom.mrpPolicyEditMrpOk?.addEventListener("input", onMrpDriverInput("OK_MRP"));
    dom.mrpPolicyEditMrpOk?.addEventListener("change", onMrpDriverInput("OK_MRP"));
    dom.mrpPolicyEditOkPct?.addEventListener("input", onMrpDriverInput("OK_PCT"));
    dom.mrpPolicyEditOkPct?.addEventListener("change", onMrpDriverInput("OK_PCT"));
    [
      dom.mrpPolicyEditMrpIk,
      dom.mrpPolicyEditEffectiveFrom,
      dom.mrpPolicyEditReason,
      dom.mrpPolicyEditApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        if (mrpFieldSyncing) return;
        updateMrpPolicyPreview();
      });
      input?.addEventListener("change", () => {
        if (mrpFieldSyncing) return;
        updateMrpPolicyPreview();
      });
    });
    dom.schemeMasterCreateCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterCreateModal,
    );
    dom.schemeMasterCreateCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterCreateModal,
    );
    dom.schemeMasterCreateSaveBtn?.addEventListener("click", saveSchemeMasterCreate);
    dom.schemeMasterCreateModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterCreateModal) closeSchemeMasterCreateModal();
    });
    [
      dom.schemeMasterCreateName,
      dom.schemeMasterCreatePaidQty,
      dom.schemeMasterCreateFreeQty,
      dom.schemeMasterCreateRemarks,
      dom.schemeMasterCreateApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", updateSchemeCreatePreview);
      input?.addEventListener("change", updateSchemeCreatePreview);
    });
    dom.schemeMasterMetadataCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterMetadataModal,
    );
    dom.schemeMasterMetadataCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterMetadataModal,
    );
    dom.schemeMasterMetadataSaveBtn?.addEventListener(
      "click",
      saveSchemeMasterMetadata,
    );
    dom.schemeMasterMetadataModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterMetadataModal) {
        closeSchemeMasterMetadataModal();
      }
    });
    [
      dom.schemeMasterMetadataName,
      dom.schemeMasterMetadataRemarks,
      dom.schemeMasterMetadataReason,
      dom.schemeMasterMetadataApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setSchemeMasterMetadataSaveState);
      input?.addEventListener("change", setSchemeMasterMetadataSaveState);
    });
    dom.schemeMasterDeactivateCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterDeactivateModal,
    );
    dom.schemeMasterDeactivateCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterDeactivateModal,
    );
    dom.schemeMasterDeactivateSaveBtn?.addEventListener(
      "click",
      saveSchemeMasterDeactivate,
    );
    dom.schemeMasterDeactivateModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterDeactivateModal) {
        closeSchemeMasterDeactivateModal();
      }
    });
    [
      dom.schemeMasterDeactivateReason,
      dom.schemeMasterDeactivateApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setSchemeMasterDeactivateSaveState);
      input?.addEventListener("change", setSchemeMasterDeactivateSaveState);
    });
    dom.schemeMasterReactivateCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterReactivateModal,
    );
    dom.schemeMasterReactivateCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterReactivateModal,
    );
    dom.schemeMasterReactivateSaveBtn?.addEventListener(
      "click",
      saveSchemeMasterReactivate,
    );
    dom.schemeMasterReactivateModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterReactivateModal) {
        closeSchemeMasterReactivateModal();
      }
    });
    [
      dom.schemeMasterReactivateReason,
      dom.schemeMasterReactivateApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setSchemeMasterReactivateSaveState);
      input?.addEventListener("change", setSchemeMasterReactivateSaveState);
    });
    dom.schemeMasterHistoryCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterHistoryModal,
    );
    dom.schemeMasterHistoryDismissBtn?.addEventListener(
      "click",
      closeSchemeMasterHistoryModal,
    );
    dom.schemeMasterHistoryModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterHistoryModal) closeSchemeMasterHistoryModal();
    });
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
    openSchemePolicyEditModal,
    openMrpPolicyEditModal,
    openSchemeRuleCloseModal,
    openSchemeRuleEditModal,
    closeSellingPolicyEditModal,
    closeSchemePolicyEditModal,
    closeMrpPolicyEditModal,
    closeSchemeRuleEditModal,
    closeSchemeRuleCloseModal,
  };
}
