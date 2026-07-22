/**
 * PPM-C1E — Product MRP Proposals
 *
 * Contract note (generated supabase.ts):
 * - rpc_generate_product_mrp_proposal({ p_derivation_policy_id, p_proposed_effective_from, p_reason, p_approval_reference? })
 * - rpc_adjust_product_mrp_proposal_line({ p_proposal_line_id, p_action, p_proposed_mrp_ik?, p_proposed_mrp_ok?, p_proposed_ok_pct?, p_reason? })
 * - rpc_submit_product_mrp_proposal({ p_proposal_id, p_submission_note })
 *
 * Deep-link query `proposalId` is deferred (no new URL param in this stage).
 */

import {
  countActiveMrpFilterFields,
  renderMrpActiveFilterChip,
  renderMrpFilterDrawerPanel,
} from "./costing-suite-mrp-proposal-shared.js";

export const MRP_PROPOSAL_VIEWS = [
  { id: "register", label: "Proposal Register" },
  { id: "workspace", label: "Proposal Workspace" },
];

const PROPOSAL_STATUS_OPTIONS = [
  "DRAFT",
  "SUBMITTED",
  "PARTIALLY_DECIDED",
  "APPROVED",
  "REJECTED",
  "APPLIED",
  "CANCELLED",
];

const CALC_STATUS_OPTIONS = [
  "REFERENCE_PACK",
  "CALCULATED",
  "CURRENT_MRP_MISSING",
  "NO_CHANGE",
  "MANUALLY_ADJUSTED",
  "BLOCKED",
];

const PACK_DIRECTION_OPTIONS = [
  "REFERENCE_PACK",
  "LARGER_PACK",
  "SMALLER_PACK",
];

const WARNING_KNOWN = {
  LARGE_PACK_REVIEW: "Large pack review",
  VERY_LARGE_PACK_REVIEW: "Very large pack review",
  TARGET_MRP_MISSING: "Target MRP missing",
};

const MRP_PROPOSAL_REGISTER_HEADERS = [
  "Proposal",
  "Product",
  "Effective date",
  "Status",
  "Reference Pack",
  "Total",
  "Eligible",
  "Blocked",
  "Adjusted",
  "Pending",
  "Review",
  "Created",
];

const MRP_PROPOSAL_REGISTER_ALIGNMENTS = [
  "c-left",
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
];

const MRP_PROPOSAL_LINE_HEADERS = [
  "Line",
  "SKU / Pack",
  "Direction",
  "Current IK / OK",
  "Calculated IK / OK",
  "Proposed IK / OK",
  "Mode",
  "Calc status",
  "Eligibility",
  "Warning / Blocker",
  "Decision",
];

const MRP_PROPOSAL_LINE_ALIGNMENTS = [
  "c-right",
  "c-left",
  "c-left",
  "c-right",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
  "c-left",
  "c-left",
  "c-left",
];

export function createMrpProposalHandlers(deps) {
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
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    numberOrNullFromInput,
    reloadRows,
    canEditPricingPolicyActions,
    formatTodayIsoIst,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav,
    /** Optional handoff into Proposal Decisions with independent selection. */
    openProposalDecisions,
  } = deps;

  /** @type {"register"|"workspace"} */
  let mrpProposalView = "register";
  let selectedMrpProposalId = null;
  let mrpProposalRegisterRawRows = [];
  let mrpProposalRegisterFilters = {
    status: [],
    reviewSummary: [],
    hasBlocked: null,
    hasAdjusted: null,
  };
  /** @type {null|boolean} */
  let mrpProposalRegisterFiltersOpen = null;
  let mrpProposalLinesRawRows = [];
  let mrpProposalLineFilters = {
    eligibility: [],
    calculationStatus: [],
    packDirection: [],
    calcMode: [],
    warning: [],
    decision: [],
  };
  /** @type {null|boolean} */
  let mrpProposalLineFiltersOpen = null;
  let mrpProposalHeaderCache = null;
  let mrpProposalGenerateReturnFocus = null;
  let mrpProposalGenerateSaving = false;
  let mrpProposalDerivationOptions = [];
  let mrpProposalAdjustRow = null;
  let mrpProposalAdjustReturnFocus = null;
  let mrpProposalAdjustSaving = false;
  let mrpProposalResetRow = null;
  let mrpProposalResetReturnFocus = null;
  let mrpProposalResetSaving = false;
  let mrpProposalSubmitReturnFocus = null;
  let mrpProposalSubmitSaving = false;

  function canEditPolicyActions() {
    return (
      typeof canEditPricingPolicyActions === "function" &&
      canEditPricingPolicyActions() === true
    );
  }

  function requireEditAccess(actionLabel = "this action") {
    if (canEditPolicyActions()) return true;
    showToast(`You do not have permission to ${actionLabel}.`, "error", 4200);
    return false;
  }

  function humanizeToken(value) {
    const raw = String(value || "").trim();
    if (!raw) return "--";
    return raw
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

  function compareNullableNumber(a, b) {
    const an = a == null || a === "" ? null : Number(a);
    const bn = b == null || b === "" ? null : Number(b);
    if (an === null && bn === null) return 0;
    if (an === null) return 1;
    if (bn === null) return -1;
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return 0;
    return an - bn;
  }

  function todayIsoIst() {
    if (typeof formatTodayIsoIst === "function") return formatTodayIsoIst();
    return new Date().toISOString().slice(0, 10);
  }

  function isMrpProposalsTabActive() {
    return getMrpGovernanceTab?.() === "mrp-proposals";
  }

  function getMrpProposalView() {
    return mrpProposalView;
  }

  function setMrpProposalView(view) {
    mrpProposalView = view === "workspace" ? "workspace" : "register";
  }

  function getSelectedMrpProposalId() {
    return selectedMrpProposalId;
  }

  function formatProposalStatus(status) {
    const raw = String(status || "").trim().toUpperCase();
    if (!raw) return "--";
    return humanizeToken(raw);
  }

  function formatEligibility(status) {
    const raw = String(status || "").trim().toUpperCase();
    if (raw === "ELIGIBLE") return "Eligible";
    if (raw === "BLOCKED") return "Blocked";
    return humanizeToken(raw);
  }

  function formatCalcStatus(status) {
    const raw = String(status || "").trim().toUpperCase();
    if (!raw) return "--";
    if (raw === "CURRENT_MRP_MISSING") return "Current MRP missing";
    if (raw === "NO_CHANGE") return "No change";
    if (raw === "MANUALLY_ADJUSTED") return "Manually adjusted";
    if (raw === "REFERENCE_PACK") return "Reference Pack";
    return humanizeToken(raw);
  }

  function formatPackDirection(direction) {
    const raw = String(direction || "").trim().toUpperCase();
    if (raw === "REFERENCE_PACK") return "Reference Pack";
    if (raw === "LARGER_PACK") return "Larger pack";
    if (raw === "SMALLER_PACK") return "Smaller pack";
    return humanizeToken(raw);
  }

  function formatWarningCode(code) {
    const raw = String(code || "").trim().toUpperCase();
    if (!raw) return "";
    if (WARNING_KNOWN[raw]) return WARNING_KNOWN[raw];
    return humanizeToken(raw);
  }

  function formatIkOkPair(ik, ok) {
    return `${formatOptionalMoney(ik)} / ${formatOptionalMoney(ok)}`;
  }

  function formatReferencePack(row) {
    const pack = [row.reference_pack_size, row.reference_pack_uom]
      .filter((v) => v !== null && v !== "")
      .join(" ");
    if (!pack && row.reference_sku_id == null) return "--";
    const sku =
      row.reference_sku_id != null ? `SKU ${row.reference_sku_id}` : "";
    return pack ? `${pack}${sku ? ` · ${sku}` : ""}` : sku || "--";
  }

  function formatPackLabel(row) {
    const pack = [row.pack_size, row.pack_uom]
      .filter((v) => v !== null && v !== "")
      .join(" ");
    return pack || "--";
  }

  function renderWarningBlockerCell(row) {
    const eligibility = String(row.eligibility_status || "")
      .trim()
      .toUpperCase();
    const blocker = String(row.blocker_code || "").trim();
    const warning = String(row.warning_code || "").trim();

    if (eligibility === "BLOCKED" || blocker) {
      const label = blocker ? humanizeToken(blocker) : "Blocked";
      return `<div class="cp-mrp-blocker-card"><div class="cp-card-label">Blocked</div><div class="cp-muted-text">${text(label)}</div></div>`;
    }
    if (warning) {
      return `<span class="cp-muted-text">${text(formatWarningCode(warning))}</span>`;
    }
    return `<span class="cp-muted-text">--</span>`;
  }

  function sortProposalRegisterRows(rows) {
    const sorted = [...(rows || [])];
    sorted.sort((a, b) => {
      const createdCmp = String(b.created_at || "").localeCompare(
        String(a.created_at || ""),
      );
      if (createdCmp) return createdCmp;
      return compareNullableNumber(b.proposal_id, a.proposal_id);
    });
    return sorted;
  }

  function sortProposalLineRows(rows) {
    const sorted = [...(rows || [])];
    sorted.sort((a, b) => {
      const lineCmp = compareNullableNumber(a.line_number, b.line_number);
      if (lineCmp) return lineCmp;
      return compareNullableNumber(a.proposal_line_id, b.proposal_line_id);
    });
    return sorted;
  }

  function matchesProposalRegisterFilters(row) {
    if (mrpProposalRegisterFilters.status.length) {
      const status = String(row.status || "").trim().toUpperCase();
      if (!mrpProposalRegisterFilters.status.includes(status)) return false;
    }
    if (mrpProposalRegisterFilters.reviewSummary.length) {
      const summary = String(row.review_summary_status || "")
        .trim()
        .toUpperCase();
      if (!mrpProposalRegisterFilters.reviewSummary.includes(summary)) {
        return false;
      }
    }
    if (mrpProposalRegisterFilters.hasBlocked === true) {
      if (!(Number(row.blocked_line_count) > 0)) return false;
    } else if (mrpProposalRegisterFilters.hasBlocked === false) {
      if (Number(row.blocked_line_count) > 0) return false;
    }
    if (mrpProposalRegisterFilters.hasAdjusted === true) {
      if (!(Number(row.manually_adjusted_line_count) > 0)) return false;
    } else if (mrpProposalRegisterFilters.hasAdjusted === false) {
      if (Number(row.manually_adjusted_line_count) > 0) return false;
    }
    return true;
  }

  function matchesProposalLineFilters(row) {
    if (mrpProposalLineFilters.eligibility.length) {
      const v = String(row.eligibility_status || "").trim().toUpperCase();
      if (!mrpProposalLineFilters.eligibility.includes(v)) return false;
    }
    if (mrpProposalLineFilters.calculationStatus.length) {
      const v = String(row.calculation_status || "").trim().toUpperCase();
      if (!mrpProposalLineFilters.calculationStatus.includes(v)) return false;
    }
    if (mrpProposalLineFilters.packDirection.length) {
      const v = String(row.pack_direction || "").trim().toUpperCase();
      if (!mrpProposalLineFilters.packDirection.includes(v)) return false;
    }
    if (mrpProposalLineFilters.calcMode.length) {
      const v = String(row.proposed_calc_mode || "").trim().toUpperCase();
      if (!mrpProposalLineFilters.calcMode.includes(v)) return false;
    }
    if (mrpProposalLineFilters.warning.length) {
      const v = String(row.warning_code || "").trim().toUpperCase();
      if (!mrpProposalLineFilters.warning.includes(v)) return false;
    }
    if (mrpProposalLineFilters.decision.length) {
      const v = String(row.decision || "").trim().toUpperCase();
      if (!mrpProposalLineFilters.decision.includes(v)) return false;
    }
    return true;
  }

  function getProposalRegisterFilteredRows() {
    return sortProposalRegisterRows(
      mrpProposalRegisterRawRows.filter(matchesProposalRegisterFilters),
    );
  }

  function getProposalLineFilteredRows() {
    return sortProposalLineRows(
      mrpProposalLinesRawRows.filter(matchesProposalLineFilters),
    );
  }

  function getMrpProposalFilteredRows() {
    if (mrpProposalView === "workspace") {
      if (selectedMrpProposalId == null) return [];
      return getProposalLineFilteredRows();
    }
    return getProposalRegisterFilteredRows();
  }

  function enrichProposalRegisterSearch(row) {
    return {
      ...row,
      __search_blob: [
        row.proposal_number,
        row.proposal_id,
        row.product_name,
        row.product_id,
        row.reference_sku_id,
        row.reference_pack_size,
        row.reference_pack_uom,
        row.approval_reference,
        row.reason,
        row.status,
        row.review_summary_status,
        row.submission_note,
      ]
        .filter((v) => v != null && v !== "")
        .join(" "),
    };
  }

  function enrichProposalLineSearch(row) {
    return {
      ...row,
      __search_blob: [
        row.sku_id,
        row.product_name,
        row.product_id,
        row.pack_size,
        row.pack_uom,
        row.line_number,
        row.warning_code,
        row.blocker_code,
        row.proposal_number,
        row.proposal_line_id,
        row.calculation_status,
        row.eligibility_status,
        row.decision,
        row.pack_direction,
      ]
        .filter((v) => v != null && v !== "")
        .join(" "),
    };
  }

  async function fetchProposalRegisterRows() {
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_product_mrp_proposal_register")
          .select("*")
          .order("created_at", { ascending: false })
          .order("proposal_id", { ascending: false }),
      1000,
    );
    mrpProposalRegisterRawRows = (rows || []).map(enrichProposalRegisterSearch);
    return mrpProposalRegisterRawRows;
  }

  async function fetchProposalLines(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) {
      mrpProposalLinesRawRows = [];
      return [];
    }
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_product_mrp_proposal_lines")
          .select("*")
          .eq("proposal_id", id)
          .order("line_number", { ascending: true })
          .order("proposal_line_id", { ascending: true }),
      2000,
    );
    mrpProposalLinesRawRows = (rows || []).map(enrichProposalLineSearch);
    return mrpProposalLinesRawRows;
  }

  function refreshHeaderCacheFromRegister() {
    if (selectedMrpProposalId == null) {
      mrpProposalHeaderCache = null;
      return null;
    }
    mrpProposalHeaderCache =
      mrpProposalRegisterRawRows.find(
        (r) => String(r.proposal_id) === String(selectedMrpProposalId),
      ) || null;
    return mrpProposalHeaderCache;
  }

  async function loadMrpProposalRows() {
    await fetchProposalRegisterRows();
    refreshHeaderCacheFromRegister();

    if (mrpProposalView === "workspace") {
      if (selectedMrpProposalId == null) {
        mrpProposalLinesRawRows = [];
        return [];
      }
      if (!mrpProposalHeaderCache) {
        // Invalid / deleted proposal → return to register safely.
        selectedMrpProposalId = null;
        mrpProposalView = "register";
        showToast(
          "The selected proposal is no longer available. Showing the proposal register.",
          "info",
          4200,
        );
        return getProposalRegisterFilteredRows();
      }
      await fetchProposalLines(selectedMrpProposalId);
      return getProposalLineFilteredRows();
    }

    return getProposalRegisterFilteredRows();
  }

  function collectReviewSummaryOptions() {
    const seen = new Set();
    mrpProposalRegisterRawRows.forEach((row) => {
      const v = String(row.review_summary_status || "").trim().toUpperCase();
      if (v) seen.add(v);
    });
    return [...seen].sort();
  }

  function collectLineWarningOptions() {
    const seen = new Set(Object.keys(WARNING_KNOWN));
    mrpProposalLinesRawRows.forEach((row) => {
      const v = String(row.warning_code || "").trim().toUpperCase();
      if (v) seen.add(v);
    });
    return [...seen].sort();
  }

  function toggleRegisterFilter(group, value, checked) {
    if (group === "hasBlocked" || group === "hasAdjusted") {
      if (!checked) {
        mrpProposalRegisterFilters[group] = null;
      } else {
        mrpProposalRegisterFilters[group] = value === "true";
      }
      return getMrpProposalFilteredRows();
    }
    if (!Array.isArray(mrpProposalRegisterFilters[group])) {
      return getMrpProposalFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    if (!normalized) return getMrpProposalFilteredRows();
    const set = new Set(mrpProposalRegisterFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpProposalRegisterFilters[group] = [...set];
    return getMrpProposalFilteredRows();
  }

  function clearRegisterFilters() {
    mrpProposalRegisterFilters = {
      status: [],
      reviewSummary: [],
      hasBlocked: null,
      hasAdjusted: null,
    };
    return getMrpProposalFilteredRows();
  }

  function toggleLineFilter(group, value, checked) {
    if (!Array.isArray(mrpProposalLineFilters[group])) {
      return getMrpProposalFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    if (!normalized) return getMrpProposalFilteredRows();
    const set = new Set(mrpProposalLineFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpProposalLineFilters[group] = [...set];
    return getMrpProposalFilteredRows();
  }

  function clearLineFilters() {
    mrpProposalLineFilters = {
      eligibility: [],
      calculationStatus: [],
      packDirection: [],
      calcMode: [],
      warning: [],
      decision: [],
    };
    return getMrpProposalFilteredRows();
  }

  function buildProposalRegisterFilterChips() {
    const chips = [];
    for (const status of mrpProposalRegisterFilters.status) {
      const label = `Status: ${formatProposalStatus(status)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-proposal-register-filter-chip-group",
          group: "status",
          valueAttr: "data-mrp-proposal-register-filter-chip-value",
          value: status,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    for (const status of mrpProposalRegisterFilters.reviewSummary) {
      const label = `Review: ${humanizeToken(status)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-proposal-register-filter-chip-group",
          group: "reviewSummary",
          valueAttr: "data-mrp-proposal-register-filter-chip-value",
          value: status,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    if (mrpProposalRegisterFilters.hasBlocked === true) {
      chips.push(
        renderMrpActiveFilterChip({
          label: "Has blocked lines",
          groupAttr: "data-mrp-proposal-register-filter-chip-group",
          group: "hasBlocked",
          valueAttr: "data-mrp-proposal-register-filter-chip-value",
          value: "true",
          ariaLabel: "Remove Has blocked lines filter",
        }),
      );
    }
    if (mrpProposalRegisterFilters.hasAdjusted === true) {
      chips.push(
        renderMrpActiveFilterChip({
          label: "Has manual adjustments",
          groupAttr: "data-mrp-proposal-register-filter-chip-group",
          group: "hasAdjusted",
          valueAttr: "data-mrp-proposal-register-filter-chip-value",
          value: "true",
          ariaLabel: "Remove Has manual adjustments filter",
        }),
      );
    }
    return chips.join("");
  }

  function buildProposalLineFilterChips() {
    const chips = [];
    const pushArray = (group, fieldLabel, formatFn) => {
      for (const value of mrpProposalLineFilters[group] || []) {
        const label = `${fieldLabel}: ${formatFn(value)}`;
        chips.push(
          renderMrpActiveFilterChip({
            label,
            groupAttr: "data-mrp-proposal-line-filter-chip-group",
            group,
            valueAttr: "data-mrp-proposal-line-filter-chip-value",
            value,
            ariaLabel: `Remove ${label} filter`,
          }),
        );
      }
    };
    pushArray("eligibility", "Eligibility", (v) =>
      v === "ELIGIBLE" ? "Eligible" : v === "BLOCKED" ? "Blocked" : humanizeToken(v),
    );
    pushArray("calculationStatus", "Calc status", formatCalcStatus);
    pushArray("packDirection", "Pack", formatPackDirection);
    pushArray("calcMode", "Mode", (v) =>
      v === "AUTO" ? "Automatic" : v === "MANUAL" ? "Manual" : humanizeToken(v),
    );
    pushArray("warning", "Warning", formatWarningCode);
    pushArray("decision", "Decision", (v) =>
      v === "PENDING"
        ? "Pending"
        : v === "APPROVED"
          ? "Approved"
          : v === "REJECTED"
            ? "Rejected"
            : humanizeToken(v),
    );
    return chips.join("");
  }

  function renderFilterCheckbox(dataAttr, group, value, label, checked) {
    const safe = String(value).replace(/"/g, "&quot;");
    return `<label class="cp-mrp-filter-item"><input type="checkbox" ${dataAttr}="${group}" value="${safe}" ${checked ? "checked" : ""}/> ${text(label)}</label>`;
  }

  function renderRegisterFilterPanel() {
    const reviewOptions = collectReviewSummaryOptions()
      .map((status) =>
        renderFilterCheckbox(
          "data-mrp-proposal-register-filter",
          "reviewSummary",
          status,
          humanizeToken(status),
          mrpProposalRegisterFilters.reviewSummary.includes(status),
        ),
      )
      .join("");

    const statusOptions = PROPOSAL_STATUS_OPTIONS.map((status) =>
      renderFilterCheckbox(
        "data-mrp-proposal-register-filter",
        "status",
        status,
        formatProposalStatus(status),
        mrpProposalRegisterFilters.status.includes(status),
      ),
    ).join("");

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpProposalRegisterFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Proposal status</div>
          <div class="cp-mrp-filter-options">${statusOptions}</div>
        </div>
        ${
          reviewOptions
            ? `<div class="cp-mrp-filter-group">
                <div class="cp-mrp-filter-title">Review summary</div>
                <div class="cp-mrp-filter-options">${reviewOptions}</div>
              </div>`
            : ""
        }
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Line signals</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox(
              "data-mrp-proposal-register-filter",
              "hasBlocked",
              "true",
              "Has blocked lines",
              mrpProposalRegisterFilters.hasBlocked === true,
            )}
            ${renderFilterCheckbox(
              "data-mrp-proposal-register-filter",
              "hasAdjusted",
              "true",
              "Has manual adjustments",
              mrpProposalRegisterFilters.hasAdjusted === true,
            )}
          </div>
        </div>
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpProposalRegisterFilters, [
      "status",
      "reviewSummary",
      "hasBlocked",
      "hasAdjusted",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-proposal-register-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function renderLineFilterPanel() {
    const warningOptions = collectLineWarningOptions()
      .map((code) =>
        renderFilterCheckbox(
          "data-mrp-proposal-line-filter",
          "warning",
          code,
          formatWarningCode(code),
          mrpProposalLineFilters.warning.includes(code),
        ),
      )
      .join("");

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpProposalLineFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Eligibility</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "eligibility", "ELIGIBLE", "Eligible", mrpProposalLineFilters.eligibility.includes("ELIGIBLE"))}
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "eligibility", "BLOCKED", "Blocked", mrpProposalLineFilters.eligibility.includes("BLOCKED"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Calculation status</div>
          <div class="cp-mrp-filter-options">
            ${CALC_STATUS_OPTIONS.map((s) =>
              renderFilterCheckbox(
                "data-mrp-proposal-line-filter",
                "calculationStatus",
                s,
                formatCalcStatus(s),
                mrpProposalLineFilters.calculationStatus.includes(s),
              ),
            ).join("")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Pack direction</div>
          <div class="cp-mrp-filter-options">
            ${PACK_DIRECTION_OPTIONS.map((s) =>
              renderFilterCheckbox(
                "data-mrp-proposal-line-filter",
                "packDirection",
                s,
                formatPackDirection(s),
                mrpProposalLineFilters.packDirection.includes(s),
              ),
            ).join("")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Calculation mode</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "calcMode", "AUTO", "Automatic", mrpProposalLineFilters.calcMode.includes("AUTO"))}
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "calcMode", "MANUAL", "Manual", mrpProposalLineFilters.calcMode.includes("MANUAL"))}
          </div>
        </div>
        ${
          warningOptions
            ? `<div class="cp-mrp-filter-group">
                <div class="cp-mrp-filter-title">Warning</div>
                <div class="cp-mrp-filter-options">${warningOptions}</div>
              </div>`
            : ""
        }
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Decision</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "decision", "PENDING", "Pending", mrpProposalLineFilters.decision.includes("PENDING"))}
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "decision", "APPROVED", "Approved", mrpProposalLineFilters.decision.includes("APPROVED"))}
            ${renderFilterCheckbox("data-mrp-proposal-line-filter", "decision", "REJECTED", "Rejected", mrpProposalLineFilters.decision.includes("REJECTED"))}
          </div>
        </div>
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpProposalLineFilters, [
      "eligibility",
      "calculationStatus",
      "packDirection",
      "calcMode",
      "warning",
      "decision",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-proposal-line-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function countLinesBy(predicate) {
    return mrpProposalLinesRawRows.filter(predicate).length;
  }

  function renderWorkspaceHeaderPanel() {
    const header = mrpProposalHeaderCache;
    if (!header) {
      return `
        <div class="cp-mrp-governance-empty" role="status" style="margin:8px 0">
          <div class="cp-mrp-governance-empty-title">No proposal selected</div>
          <p class="cp-mrp-governance-empty-body">Open a proposal from the Proposal Register to review lines, adjust eligible values, and submit for decision.</p>
        </div>`;
    }

    const status = String(header.status || "").trim().toUpperCase();
    const total = mrpProposalLinesRawRows.length || Number(header.total_line_count) || 0;
    const eligible =
      countLinesBy(
        (r) =>
          String(r.eligibility_status || "").toUpperCase() === "ELIGIBLE",
      ) || Number(header.eligible_line_count) || 0;
    const blocked =
      countLinesBy(
        (r) =>
          String(r.eligibility_status || "").toUpperCase() === "BLOCKED",
      ) || Number(header.blocked_line_count) || 0;
    const calculated = countLinesBy(
      (r) => String(r.calculation_status || "").toUpperCase() === "CALCULATED",
    );
    const noChange = countLinesBy(
      (r) => String(r.calculation_status || "").toUpperCase() === "NO_CHANGE",
    );
    const missing = countLinesBy(
      (r) =>
        String(r.calculation_status || "").toUpperCase() ===
        "CURRENT_MRP_MISSING",
    );
    const adjusted =
      countLinesBy((r) => r.is_manually_adjusted === true) ||
      Number(header.manually_adjusted_line_count) ||
      0;
    const pending =
      countLinesBy(
        (r) => String(r.decision || "").toUpperCase() === "PENDING",
      ) || Number(header.pending_line_count) || 0;
    const approved =
      countLinesBy(
        (r) => String(r.decision || "").toUpperCase() === "APPROVED",
      ) || Number(header.approved_line_count) || 0;
    const rejected =
      countLinesBy(
        (r) => String(r.decision || "").toUpperCase() === "REJECTED",
      ) || Number(header.rejected_line_count) || 0;

    const submitBtn =
      canEditPolicyActions() && status === "DRAFT"
        ? `<button type="button" class="icon-btn icon-btn-primary" id="mrpProposalSubmitBtn" title="Submit for Decision" aria-label="Submit for Decision">Submit for Decision</button>`
        : "";

    const decisionsLink =
      status && status !== "DRAFT"
        ? `<button type="button" class="icon-btn" id="mrpProposalOpenDecisionsBtn" title="Open Proposal Decisions" aria-label="Open Proposal Decisions">Open Proposal Decisions</button>`
        : "";

    return `
      <div class="cp-mrp-proposal-workspace-header" id="mrpProposalWorkspaceHeader">
        <div class="cp-summary-strip">
          <div class="cp-card">
            <div class="cp-card-label">Proposal</div>
            <div class="cp-card-value">${text(header.proposal_number || `Proposal ${header.proposal_id}`)}</div>
            <div class="cp-muted-text">ID ${text(header.proposal_id)}</div>
          </div>
          <div class="cp-card">
            <div class="cp-card-label">Product</div>
            <div class="cp-card-value">${text(header.product_name || "--")}</div>
            <div class="cp-muted-text">Product ${text(header.product_id)}</div>
          </div>
          <div class="cp-card">
            <div class="cp-card-label">Status</div>
            <div class="cp-card-value">${statusChip(formatProposalStatus(header.status))}</div>
            <div class="cp-muted-text">Effective ${formatDate(header.proposed_effective_from)}</div>
          </div>
          <div class="cp-card">
            <div class="cp-card-label">Reference Pack</div>
            <div class="cp-card-value">${text(formatReferencePack(header))}</div>
            <div class="cp-muted-text">Derivation ${text(header.derivation_policy_id || "--")}</div>
          </div>
        </div>
        <div class="cp-summary-strip" style="margin-top:8px">
          <div class="cp-card"><div class="cp-card-label">Total</div><div class="cp-card-value">${text(total)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Eligible</div><div class="cp-card-value">${text(eligible)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Blocked</div><div class="cp-card-value">${text(blocked)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Calculated</div><div class="cp-card-value">${text(calculated)}</div></div>
          <div class="cp-card"><div class="cp-card-label">No change</div><div class="cp-card-value">${text(noChange)}</div></div>
          <div class="cp-card"><div class="cp-card-label">MRP missing</div><div class="cp-card-value">${text(missing)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Adjusted</div><div class="cp-card-value">${text(adjusted)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Pending</div><div class="cp-card-value">${text(pending)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Approved</div><div class="cp-card-value">${text(approved)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Rejected</div><div class="cp-card-value">${text(rejected)}</div></div>
        </div>
        <div class="cp-muted-text" style="margin-top:8px;line-height:1.45">
          ${header.reason ? `Reason: ${text(header.reason)}` : "Reason: --"}
          ${header.approval_reference ? ` · Approval: ${text(header.approval_reference)}` : ""}
          · Created ${formatDateTime(header.created_at)}${header.created_by ? ` by ${text(header.created_by)}` : ""}
          ${header.submitted_at ? ` · Submitted ${formatDateTime(header.submitted_at)}${header.submitted_by ? ` by ${text(header.submitted_by)}` : ""}` : ""}
          ${header.applied_at ? ` · Applied ${formatDateTime(header.applied_at)}${header.applied_by ? ` by ${text(header.applied_by)}` : ""}` : ""}
        </div>
        ${
          submitBtn || decisionsLink
            ? `<div class="cp-mrp-create-toolbar" style="margin-top:8px">${submitBtn}${decisionsLink}</div>`
            : ""
        }
      </div>`;
  }

  function renderChromeHtml() {
    if (!isMrpProposalsTabActive()) return "";

    const nested = renderNestedSubviewNav({
      options: MRP_PROPOSAL_VIEWS,
      activeId: mrpProposalView,
      dataAttr: "data-mrp-proposal-view",
      selectId: "mrpProposalViewSelect",
      selectLabel: "View",
      selectAriaLabel: "Select MRP proposal view",
    });

    if (mrpProposalView === "workspace") {
      return `
        ${nested}
        ${renderWorkspaceHeaderPanel()}
      `;
    }

    return `
      ${nested}
    `;
  }

  function renderActiveFilterDrawerPanel() {
    if (!isMrpProposalsTabActive()) return null;
    if (mrpProposalView === "workspace") {
      if (selectedMrpProposalId == null) return null;
      return renderLineFilterPanel();
    }
    return renderRegisterFilterPanel();
  }

  function canAdjustProposalLine(row, header = mrpProposalHeaderCache) {
    if (!canEditPolicyActions()) return false;
    const proposalStatus = String(
      header?.status || row?.proposal_status || "",
    )
      .trim()
      .toUpperCase();
    if (proposalStatus !== "DRAFT") return false;
    if (String(row?.decision || "").trim().toUpperCase() !== "PENDING") {
      return false;
    }
    if (row?.applied_mrp_policy_id != null) return false;
    if (String(row?.eligibility_status || "").trim().toUpperCase() !== "ELIGIBLE") {
      return false;
    }
    if (row?.is_reference_pack === true) return false;
    return true;
  }

  function canResetProposalLine(row, header = mrpProposalHeaderCache) {
    if (!canEditPolicyActions()) return false;
    const proposalStatus = String(
      header?.status || row?.proposal_status || "",
    )
      .trim()
      .toUpperCase();
    if (proposalStatus !== "DRAFT") return false;
    if (String(row?.decision || "").trim().toUpperCase() !== "PENDING") {
      return false;
    }
    if (row?.applied_mrp_policy_id != null) return false;
    if (String(row?.eligibility_status || "").trim().toUpperCase() !== "ELIGIBLE") {
      return false;
    }
    // Reset only when a manual adjustment exists (or Reference Pack was adjusted).
    return row?.is_manually_adjusted === true;
  }

  function renderRegisterDrawerActions(row) {
    const status = String(row.status || "").trim().toUpperCase();
    const openBtn = `<button type="button" class="icon-btn icon-btn-primary" data-mrp-proposal-drawer-open="${text(row.proposal_id)}" title="Open proposal" aria-label="Open proposal">Open</button>`;
    const submitBtn =
      canEditPolicyActions() && status === "DRAFT"
        ? `<button type="button" class="icon-btn" data-mrp-proposal-drawer-submit="${text(row.proposal_id)}" title="Submit for Decision" aria-label="Submit for Decision">Submit</button>`
        : "";
    return `<div class="cp-drawer-action-bar">${openBtn}${submitBtn}</div>`;
  }

  function renderLineDrawerActions(row) {
    const parts = [];
    if (canAdjustProposalLine(row)) {
      parts.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-mrp-proposal-drawer-adjust="${text(row.proposal_line_id)}" title="Adjust line" aria-label="Adjust line">Adjust</button>`,
      );
    }
    if (canResetProposalLine(row)) {
      parts.push(
        `<button type="button" class="icon-btn" data-mrp-proposal-drawer-reset="${text(row.proposal_line_id)}" title="Reset to Calculated Values" aria-label="Reset to Calculated Values">Reset</button>`,
      );
    }
    if (!parts.length) return "";
    return `<div class="cp-drawer-action-bar">${parts.join("")}</div>`;
  }

  function renderRegisterRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.proposal_number || `Proposal ${row.proposal_id}`)}<div class="cp-muted-text">ID ${text(row.proposal_id)}</div></td>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">Product ${text(row.product_id)}</div></td>
      <td>${formatDate(row.proposed_effective_from)}</td>
      <td>${statusChip(formatProposalStatus(row.status))}</td>
      <td>${text(formatReferencePack(row))}</td>
      <td class="c-right">${text(row.total_line_count ?? "--")}</td>
      <td class="c-right">${text(row.eligible_line_count ?? "--")}</td>
      <td class="c-right">${text(row.blocked_line_count ?? "--")}</td>
      <td class="c-right">${text(row.manually_adjusted_line_count ?? "--")}</td>
      <td class="c-right">${text(row.pending_line_count ?? "--")}</td>
      <td>${text(humanizeToken(row.review_summary_status))}</td>
      <td>${formatDateTime(row.created_at)}</td>
    </tr>`;
  }

  function renderLineRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td class="c-right">${text(row.line_number ?? "--")}</td>
      <td>${cpCellPrimary(`SKU ${row.sku_id ?? "--"}`)}<div class="cp-muted-text">${text(formatPackLabel(row))}</div></td>
      <td>${text(formatPackDirection(row.pack_direction))}</td>
      <td class="c-right">${text(formatIkOkPair(row.current_mrp_ik, row.current_mrp_ok))}</td>
      <td class="c-right">${text(formatIkOkPair(row.calculated_mrp_ik, row.calculated_mrp_ok))}</td>
      <td class="c-right">${text(formatIkOkPair(row.proposed_mrp_ik, row.proposed_mrp_ok))}</td>
      <td>${text(row.proposed_calc_mode || "--")}</td>
      <td>${statusChip(formatCalcStatus(row.calculation_status))}</td>
      <td>${statusChip(formatEligibility(row.eligibility_status))}</td>
      <td>${renderWarningBlockerCell(row)}</td>
      <td>${text(humanizeToken(row.decision))}</td>
    </tr>`;
  }

  function getTableHeaders() {
    return mrpProposalView === "workspace"
      ? MRP_PROPOSAL_LINE_HEADERS
      : MRP_PROPOSAL_REGISTER_HEADERS;
  }

  function getTableAlignments() {
    return mrpProposalView === "workspace"
      ? MRP_PROPOSAL_LINE_ALIGNMENTS
      : MRP_PROPOSAL_REGISTER_ALIGNMENTS;
  }

  function renderTableRow(row, trAttrs) {
    if (mrpProposalView === "workspace") {
      if (selectedMrpProposalId == null) return null;
      return renderLineRow(row, trAttrs);
    }
    return renderRegisterRow(row, trAttrs);
  }

  function getDrawerConfig(row, preferredTab) {
    if (mrpProposalView === "workspace" || row?.proposal_line_id != null) {
      return {
        title:
          row.sku_id != null
            ? `SKU ${row.sku_id}`
            : `Line ${row.line_number ?? ""}`,
        subtitle: [
          row.proposal_number ||
            (row.proposal_id != null ? `Proposal ${row.proposal_id}` : ""),
          formatPackLabel(row),
          formatPackDirection(row.pack_direction),
        ]
          .filter(Boolean)
          .join(" · "),
        tabs: [
          { id: "line-identity", label: "Identity" },
          { id: "line-values", label: "MRP Values" },
          { id: "line-governance", label: "Governance" },
        ],
        activeTab: preferredTab || "line-identity",
      };
    }

    return {
      title: row.proposal_number || `Proposal ${row.proposal_id}`,
      subtitle: [
        row.product_name,
        formatProposalStatus(row.status),
        formatDate(row.proposed_effective_from),
      ]
        .filter(Boolean)
        .join(" · "),
      tabs: [
        { id: "proposal-summary", label: "Summary" },
        { id: "proposal-counts", label: "Counts" },
        { id: "proposal-evidence", label: "Evidence" },
      ],
      activeTab: preferredTab || "proposal-summary",
    };
  }

  function renderDrawerTab(tabId, row) {
    if (row?.proposal_line_id != null || mrpProposalView === "workspace") {
      if (tabId === "line-values") {
        return detailPanel([
          kvSection("Current canonical", [
            ["Current policy ID", text(row.current_mrp_policy_id)],
            ["Current IK MRP", formatOptionalMoney(row.current_mrp_ik)],
            ["Current OK MRP", formatOptionalMoney(row.current_mrp_ok)],
            ["Current uplift", formatOkPctFromDecimal(row.current_ok_pct)],
          ]),
          kvSection("Calculated proposal", [
            ["Calculated IK", formatOptionalMoney(row.calculated_mrp_ik)],
            ["Calculated OK", formatOptionalMoney(row.calculated_mrp_ok)],
            ["Calculated uplift", formatOkPctFromDecimal(row.calculated_ok_pct)],
            ["Calculated mode", text(row.calculated_calc_mode)],
            ["Calculation status", text(formatCalcStatus(row.calculation_status))],
          ]),
          kvSection("Proposed result", [
            ["Proposed IK", formatOptionalMoney(row.proposed_mrp_ik)],
            ["Proposed OK", formatOptionalMoney(row.proposed_mrp_ok)],
            ["Proposed uplift", formatOkPctFromDecimal(row.proposed_ok_pct)],
            ["Proposed mode", text(row.proposed_calc_mode)],
          ]),
        ]);
      }
      if (tabId === "line-governance") {
        return detailPanel([
          kvSection("Eligibility", [
            ["Eligibility", text(formatEligibility(row.eligibility_status))],
            ["Blocker code", text(row.blocker_code || "--")],
            [
              "Blocker (humanized)",
              text(row.blocker_code ? humanizeToken(row.blocker_code) : "--"),
            ],
            ["Warning code", text(row.warning_code || "--")],
            [
              "Warning",
              text(row.warning_code ? formatWarningCode(row.warning_code) : "--"),
            ],
          ]),
          kvSection("Manual adjustment", [
            [
              "Manually adjusted",
              text(row.is_manually_adjusted === true ? "Yes" : "No"),
            ],
            ["Adjustment reason", text(row.manual_adjustment_reason || "--")],
            ["Adjusted at", formatDateTime(row.manually_adjusted_at)],
            ["Adjusted by", text(row.manually_adjusted_by)],
          ]),
          kvSection("Decision / application", [
            ["Decision", text(humanizeToken(row.decision))],
            ["Decision reason", text(row.decision_reason || "--")],
            ["Decided at", formatDateTime(row.decided_at)],
            ["Decided by", text(row.decided_by)],
            ["Applied policy ID", text(row.applied_mrp_policy_id || "--")],
            ["Applied at", formatDateTime(row.applied_at)],
            ["Applied by", text(row.applied_by)],
          ]),
        ]);
      }
      return (
        renderLineDrawerActions(row) +
        detailPanel([
          kvSection("Identity", [
            ["Proposal line ID", text(row.proposal_line_id)],
            ["Line number", text(row.line_number)],
            ["SKU ID", text(row.sku_id)],
            ["Product", text(row.product_name)],
            ["Product ID", text(row.product_id)],
            ["Pack", text(formatPackLabel(row))],
            ["Pack direction", text(formatPackDirection(row.pack_direction))],
            [
              "Reference Pack line",
              text(row.is_reference_pack === true ? "Yes" : "No"),
            ],
          ]),
        ])
      );
    }

    if (tabId === "proposal-counts") {
      return detailPanel([
        kvSection("Line counts", [
          ["Total lines", text(row.total_line_count)],
          ["Eligible", text(row.eligible_line_count)],
          ["Blocked", text(row.blocked_line_count)],
          ["Manually adjusted", text(row.manually_adjusted_line_count)],
          ["No change", text(row.no_change_line_count)],
          ["Changed MRP", text(row.changed_mrp_line_count)],
          ["Pending decisions", text(row.pending_line_count)],
          ["Approved", text(row.approved_line_count)],
          ["Rejected", text(row.rejected_line_count)],
          ["Warnings", text(row.warning_line_count)],
        ]),
      ]);
    }

    if (tabId === "proposal-evidence") {
      return detailPanel([
        kvSection("Creation", [
          ["Created at", formatDateTime(row.created_at)],
          ["Created by", text(row.created_by)],
          ["Reason", text(row.reason || "--")],
          ["Approval reference", text(row.approval_reference || "--")],
        ]),
        kvSection("Submission", [
          ["Submitted at", formatDateTime(row.submitted_at)],
          ["Submitted by", text(row.submitted_by)],
          ["Submission note", text(row.submission_note || "--")],
        ]),
        kvSection("Application (read-only)", [
          ["Applied at", formatDateTime(row.applied_at)],
          ["Applied by", text(row.applied_by)],
        ]),
      ]);
    }

    return (
      renderRegisterDrawerActions(row) +
      detailPanel([
        kvSection("Proposal", [
          ["Proposal number", text(row.proposal_number)],
          ["Proposal ID", text(row.proposal_id)],
          ["Status", text(formatProposalStatus(row.status))],
          ["Review summary", text(humanizeToken(row.review_summary_status))],
          ["Effective from", formatDate(row.proposed_effective_from)],
          ["Derivation policy ID", text(row.derivation_policy_id)],
          ["Reference Pack", text(formatReferencePack(row))],
          ["Product", text(row.product_name)],
          ["Product ID", text(row.product_id)],
        ]),
      ])
    );
  }

  async function openProposalWorkspace(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) {
      showToast("Invalid proposal selection.", "error");
      return;
    }
    selectedMrpProposalId = id;
    mrpProposalView = "workspace";
    if (typeof reloadRows === "function") await reloadRows();
  }

  function returnToRegister() {
    mrpProposalView = "register";
    // Keep selected id so Workspace can reopen; do not force-clear.
  }

  // ---- Generate modal ----------------------------------------------------

  async function loadDerivationOptionsForGenerate() {
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_product_mrp_derivation_current")
          .select(
            `
            derivation_policy_id,
            product_id,
            product_name,
            status,
            reference_sku_id,
            reference_pack_size,
            reference_pack_uom,
            effective_from,
            effective_to
          `,
          )
          .order("product_name", { ascending: true }),
      1000,
    );
    // Prefer CONFIRMED policies; still show others for context but mark them.
    mrpProposalDerivationOptions = (rows || []).filter(
      (r) => r?.derivation_policy_id != null && r?.product_id != null,
    );
    return mrpProposalDerivationOptions;
  }

  function setGenerateError(message) {
    if (!dom.mrpProposalGenerateError) return;
    dom.mrpProposalGenerateError.hidden = !message;
    dom.mrpProposalGenerateError.textContent = message || "";
  }

  function populateGenerateProductSelect() {
    const select = dom.mrpProposalGenerateProduct;
    if (!select) return;
    const confirmed = mrpProposalDerivationOptions.filter(
      (r) => String(r.status || "").toUpperCase() === "CONFIRMED",
    );
    const source = confirmed.length ? confirmed : mrpProposalDerivationOptions;
    select.innerHTML = `<option value="">Select product</option>${source
      .map((r) => {
        const pack = [r.reference_pack_size, r.reference_pack_uom]
          .filter((v) => v !== null && v !== "")
          .join(" ");
        const label = `${r.product_name || `Product ${r.product_id}`}${pack ? ` · Ref ${pack}` : ""}`;
        return `<option value="${text(r.derivation_policy_id)}" data-product-id="${text(r.product_id)}">${text(label)}</option>`;
      })
      .join("")}`;
  }

  function updateGenerateContext() {
    const panel = dom.mrpProposalGenerateContext;
    if (!panel) return;
    const policyId = Number(dom.mrpProposalGenerateProduct?.value);
    const option = mrpProposalDerivationOptions.find(
      (r) => Number(r.derivation_policy_id) === policyId,
    );
    if (!option) {
      panel.innerHTML = `<div class="cp-muted-text">Select a product with a current derivation policy.</div>`;
      return;
    }
    const pack = [option.reference_pack_size, option.reference_pack_uom]
      .filter((v) => v !== null && v !== "")
      .join(" ");
    panel.innerHTML = `
      <div class="cp-preview-row"><span>Derivation policy</span><span class="cp-preview-value">${text(option.derivation_policy_id)}</span></div>
      <div class="cp-preview-row"><span>Policy status</span><span class="cp-preview-value">${text(humanizeToken(option.status))}</span></div>
      <div class="cp-preview-row"><span>Reference Pack</span><span class="cp-preview-value">${text(pack || `SKU ${option.reference_sku_id || "--"}`)}</span></div>
      <div class="cp-preview-row"><span>Effective from</span><span class="cp-preview-value">${formatDate(option.effective_from)}</span></div>
      <div class="cp-preview-row"><span>Effective to</span><span class="cp-preview-value">${option.effective_to ? formatDate(option.effective_to) : "Open"}</span></div>
    `;
  }

  async function openGenerateModal() {
    if (!requireEditAccess("generate a Product MRP Proposal")) return;
    mrpProposalGenerateReturnFocus = document.activeElement;
    setGenerateError("");
    setLoadingMask(true, "Loading derivation policies...");
    try {
      await loadDerivationOptionsForGenerate();
      populateGenerateProductSelect();
      if (dom.mrpProposalGenerateEffectiveFrom) {
        dom.mrpProposalGenerateEffectiveFrom.value = todayIsoIst();
      }
      if (dom.mrpProposalGenerateReason) dom.mrpProposalGenerateReason.value = "";
      if (dom.mrpProposalGenerateApprovalReference) {
        dom.mrpProposalGenerateApprovalReference.value = "";
      }
      updateGenerateContext();
      dom.mrpProposalGenerateModal?.classList.remove("hidden");
      dom.mrpProposalGenerateModal?.setAttribute("aria-hidden", "false");
      dom.mrpProposalGenerateProduct?.focus();
    } catch (err) {
      handleError("Failed to load derivation policies for proposal generation", err);
    } finally {
      setLoadingMask(false);
    }
  }

  function closeGenerateModal() {
    dom.mrpProposalGenerateModal?.classList.add("hidden");
    dom.mrpProposalGenerateModal?.setAttribute("aria-hidden", "true");
    setGenerateError("");
    mrpProposalGenerateSaving = false;
    if (mrpProposalGenerateReturnFocus?.focus) {
      try {
        mrpProposalGenerateReturnFocus.focus();
      } catch (_) {
        /* ignore */
      }
    }
    mrpProposalGenerateReturnFocus = null;
  }

  async function saveGenerateProposal() {
    if (!requireEditAccess("generate a Product MRP Proposal")) return;
    if (mrpProposalGenerateSaving) return;

    const derivationPolicyId = Number(dom.mrpProposalGenerateProduct?.value);
    const effectiveFrom = dom.mrpProposalGenerateEffectiveFrom?.value || "";
    const reason = String(dom.mrpProposalGenerateReason?.value || "").trim();
    const approval = String(
      dom.mrpProposalGenerateApprovalReference?.value || "",
    ).trim();

    if (!Number.isFinite(derivationPolicyId) || derivationPolicyId <= 0) {
      setGenerateError("Select a product with a derivation policy.");
      return;
    }
    if (!effectiveFrom) {
      setGenerateError("Effective from date is required.");
      return;
    }
    if (!reason) {
      setGenerateError("Reason is required.");
      return;
    }

    const selected = mrpProposalDerivationOptions.find(
      (r) => Number(r.derivation_policy_id) === derivationPolicyId,
    );
    if (
      selected &&
      String(selected.status || "").toUpperCase() !== "CONFIRMED"
    ) {
      setGenerateError(
        "Selected derivation policy is not Confirmed. Confirm the policy before generating a proposal.",
      );
      return;
    }

    mrpProposalGenerateSaving = true;
    if (dom.mrpProposalGenerateSaveBtn) dom.mrpProposalGenerateSaveBtn.disabled = true;
    setLoadingMask(true, "Generating Product MRP Proposal...");
    setGenerateError("");

    try {
      const payload = {
        p_derivation_policy_id: derivationPolicyId,
        p_proposed_effective_from: effectiveFrom,
        p_reason: reason,
      };
      if (approval) payload.p_approval_reference = approval;

      const { data, error } = await costingRpc(
        "rpc_generate_product_mrp_proposal",
        payload,
      );
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const newId = result?.proposal_id;
      closeGenerateModal();
      showToast(
        result?.proposal_number
          ? `Proposal ${result.proposal_number} generated.`
          : "Product MRP Proposal generated.",
        "success",
      );

      if (newId != null) {
        selectedMrpProposalId = Number(newId);
        mrpProposalView = "workspace";
      }
      if (typeof reloadRows === "function") await reloadRows();
    } catch (err) {
      handleError("Failed to generate Product MRP Proposal", err);
      setGenerateError(err?.message || "Generation failed.");
    } finally {
      mrpProposalGenerateSaving = false;
      setLoadingMask(false);
      syncWriteUi();
    }
  }

  // ---- Adjust modal ------------------------------------------------------

  function setAdjustError(message) {
    if (!dom.mrpProposalAdjustError) return;
    dom.mrpProposalAdjustError.hidden = !message;
    dom.mrpProposalAdjustError.textContent = message || "";
  }

  function syncAdjustModeFields() {
    const mode = String(dom.mrpProposalAdjustCalcMode?.value || "AUTO")
      .trim()
      .toUpperCase();
    const isAuto = mode !== "MANUAL";
    if (dom.mrpProposalAdjustMrpOkWrap) {
      dom.mrpProposalAdjustMrpOkWrap.hidden = isAuto;
    }
    if (dom.mrpProposalAdjustOkPctWrap) {
      dom.mrpProposalAdjustOkPctWrap.hidden = !isAuto;
    }
    if (dom.mrpProposalAdjustModeHint) {
      dom.mrpProposalAdjustModeHint.textContent = isAuto
        ? "Automatic OK calculation: provide IK MRP. OK uplift is optional; when omitted the server uses the proposal Reference Pack uplift."
        : "Manual values: provide both IK and OK MRP. Uplift is derived for preview only and is not sent.";
    }
    updateAdjustPreview();
  }

  function updateAdjustPreview() {
    const panel = dom.mrpProposalAdjustPreview;
    if (!panel) return;
    const mode = String(dom.mrpProposalAdjustCalcMode?.value || "AUTO")
      .trim()
      .toUpperCase();
    const ik = numberOrNullFromInput(dom.mrpProposalAdjustMrpIk);
    if (mode === "MANUAL") {
      const ok = numberOrNullFromInput(dom.mrpProposalAdjustMrpOk);
      let uplift = "--";
      if (ik != null && ik > 0 && ok != null && ok > 0) {
        uplift = formatOkPctFromDecimal(ok / ik - 1);
      }
      panel.innerHTML = `
        <div class="cp-preview-row"><span>Derived uplift</span><span class="cp-preview-value">${text(uplift)}</span></div>
        <div class="cp-muted-text">Uplift is not submitted for SET_MANUAL.</div>`;
      return;
    }
    const okPctUi = numberOrNullFromInput(dom.mrpProposalAdjustOkPct);
    panel.innerHTML = `
      <div class="cp-preview-row"><span>Proposed IK</span><span class="cp-preview-value">${ik != null ? formatMoney(ik) : "--"}</span></div>
      <div class="cp-preview-row"><span>OK uplift</span><span class="cp-preview-value">${okPctUi != null ? `${okPctUi}%` : "Reference Pack default"}</span></div>`;
  }

  function openAdjustModal(row) {
    if (!requireEditAccess("adjust a proposal line")) return;
    if (!canAdjustProposalLine(row)) {
      showToast("This proposal line cannot be adjusted in its current state.", "error");
      return;
    }
    mrpProposalAdjustRow = row;
    mrpProposalAdjustReturnFocus = document.activeElement;
    setAdjustError("");

    if (dom.mrpProposalAdjustContext) {
      dom.mrpProposalAdjustContext.innerHTML = `
        <div class="cp-preview-row"><span>Proposal</span><span class="cp-preview-value">${text(row.proposal_number || row.proposal_id)}</span></div>
        <div class="cp-preview-row"><span>Product</span><span class="cp-preview-value">${text(row.product_name)}</span></div>
        <div class="cp-preview-row"><span>SKU / Pack</span><span class="cp-preview-value">${text(`SKU ${row.sku_id} · ${formatPackLabel(row)}`)}</span></div>
        <div class="cp-preview-row"><span>Direction</span><span class="cp-preview-value">${text(formatPackDirection(row.pack_direction))}</span></div>
        <div class="cp-preview-row"><span>Current MRP</span><span class="cp-preview-value">${text(formatIkOkPair(row.current_mrp_ik, row.current_mrp_ok))}</span></div>
        <div class="cp-preview-row"><span>Calculated MRP</span><span class="cp-preview-value">${text(formatIkOkPair(row.calculated_mrp_ik, row.calculated_mrp_ok))}</span></div>
        <div class="cp-preview-row"><span>Proposed MRP</span><span class="cp-preview-value">${text(formatIkOkPair(row.proposed_mrp_ik, row.proposed_mrp_ok))}</span></div>
        <div class="cp-preview-row"><span>Warning</span><span class="cp-preview-value">${text(row.warning_code ? formatWarningCode(row.warning_code) : "--")}</span></div>
      `;
    }

    const mode =
      String(row.proposed_calc_mode || "AUTO").toUpperCase() === "MANUAL"
        ? "MANUAL"
        : "AUTO";
    if (dom.mrpProposalAdjustCalcMode) dom.mrpProposalAdjustCalcMode.value = mode;
    if (dom.mrpProposalAdjustMrpIk) {
      dom.mrpProposalAdjustMrpIk.value =
        row.proposed_mrp_ik != null ? String(row.proposed_mrp_ik) : "";
    }
    if (dom.mrpProposalAdjustMrpOk) {
      dom.mrpProposalAdjustMrpOk.value =
        row.proposed_mrp_ok != null ? String(row.proposed_mrp_ok) : "";
    }
    if (dom.mrpProposalAdjustOkPct) {
      const ui = uiPctFromDecimal(row.proposed_ok_pct);
      dom.mrpProposalAdjustOkPct.value = ui != null ? String(ui) : "";
    }
    if (dom.mrpProposalAdjustReason) dom.mrpProposalAdjustReason.value = "";
    syncAdjustModeFields();

    dom.mrpProposalAdjustModal?.classList.remove("hidden");
    dom.mrpProposalAdjustModal?.setAttribute("aria-hidden", "false");
    dom.mrpProposalAdjustMrpIk?.focus();
  }

  function closeAdjustModal() {
    dom.mrpProposalAdjustModal?.classList.add("hidden");
    dom.mrpProposalAdjustModal?.setAttribute("aria-hidden", "true");
    setAdjustError("");
    mrpProposalAdjustRow = null;
    mrpProposalAdjustSaving = false;
    if (mrpProposalAdjustReturnFocus?.focus) {
      try {
        mrpProposalAdjustReturnFocus.focus();
      } catch (_) {
        /* ignore */
      }
    }
    mrpProposalAdjustReturnFocus = null;
  }

  async function saveAdjustLine() {
    if (!requireEditAccess("adjust a proposal line")) return;
    if (mrpProposalAdjustSaving) return;
    const row = mrpProposalAdjustRow;
    if (!row || !canAdjustProposalLine(row)) {
      setAdjustError("This line is no longer adjustable.");
      return;
    }

    const mode = String(dom.mrpProposalAdjustCalcMode?.value || "AUTO")
      .trim()
      .toUpperCase();
    const reason = String(dom.mrpProposalAdjustReason?.value || "").trim();
    const ik = numberOrNullFromInput(dom.mrpProposalAdjustMrpIk);
    if (!reason) {
      setAdjustError("Adjustment reason is required.");
      return;
    }
    if (ik == null || ik <= 0) {
      setAdjustError("Proposed IK MRP must be greater than zero.");
      return;
    }

    /** @type {Record<string, unknown>} */
    let payload;
    if (mode === "MANUAL") {
      const ok = numberOrNullFromInput(dom.mrpProposalAdjustMrpOk);
      if (ok == null || ok <= 0) {
        setAdjustError("Proposed OK MRP must be greater than zero for manual mode.");
        return;
      }
      payload = {
        p_proposal_line_id: Number(row.proposal_line_id),
        p_action: "SET_MANUAL",
        p_proposed_mrp_ik: ik,
        p_proposed_mrp_ok: ok,
        p_proposed_ok_pct: null,
        p_reason: reason,
      };
    } else {
      const okPctUi = numberOrNullFromInput(dom.mrpProposalAdjustOkPct);
      if (okPctUi != null && okPctUi < 0) {
        setAdjustError("OK uplift cannot be negative.");
        return;
      }
      payload = {
        p_proposal_line_id: Number(row.proposal_line_id),
        p_action: "SET_AUTO",
        p_proposed_mrp_ik: ik,
        p_proposed_mrp_ok: null,
        p_reason: reason,
      };
      if (okPctUi != null) {
        payload.p_proposed_ok_pct = decimalFromUiPct(okPctUi);
      } else {
        payload.p_proposed_ok_pct = null;
      }
    }

    mrpProposalAdjustSaving = true;
    if (dom.mrpProposalAdjustSaveBtn) dom.mrpProposalAdjustSaveBtn.disabled = true;
    setLoadingMask(true, "Adjusting proposal line...");
    setAdjustError("");

    try {
      const { error } = await costingRpc(
        "rpc_adjust_product_mrp_proposal_line",
        payload,
      );
      if (error) throw error;
      closeAdjustModal();
      showToast("Proposal line adjusted.", "success");
      if (typeof reloadRows === "function") await reloadRows();
    } catch (err) {
      handleError("Failed to adjust proposal line", err);
      setAdjustError(err?.message || "Adjustment failed.");
    } finally {
      mrpProposalAdjustSaving = false;
      setLoadingMask(false);
      syncWriteUi();
    }
  }

  // ---- Reset modal -------------------------------------------------------

  function setResetError(message) {
    if (!dom.mrpProposalResetError) return;
    dom.mrpProposalResetError.hidden = !message;
    dom.mrpProposalResetError.textContent = message || "";
  }

  function openResetModal(row) {
    if (!requireEditAccess("reset a proposal line")) return;
    if (!canResetProposalLine(row)) {
      showToast("Reset is not available for this proposal line.", "error");
      return;
    }
    mrpProposalResetRow = row;
    mrpProposalResetReturnFocus = document.activeElement;
    setResetError("");
    if (dom.mrpProposalResetReason) dom.mrpProposalResetReason.value = "";
    if (dom.mrpProposalResetContext) {
      dom.mrpProposalResetContext.textContent = `SKU ${row.sku_id} · Line ${row.line_number ?? "--"} · ${formatPackLabel(row)}`;
    }
    dom.mrpProposalResetModal?.classList.remove("hidden");
    dom.mrpProposalResetModal?.setAttribute("aria-hidden", "false");
    dom.mrpProposalResetReason?.focus();
  }

  function closeResetModal() {
    dom.mrpProposalResetModal?.classList.add("hidden");
    dom.mrpProposalResetModal?.setAttribute("aria-hidden", "true");
    setResetError("");
    mrpProposalResetRow = null;
    mrpProposalResetSaving = false;
    if (mrpProposalResetReturnFocus?.focus) {
      try {
        mrpProposalResetReturnFocus.focus();
      } catch (_) {
        /* ignore */
      }
    }
    mrpProposalResetReturnFocus = null;
  }

  async function saveResetLine() {
    if (!requireEditAccess("reset a proposal line")) return;
    if (mrpProposalResetSaving) return;
    const row = mrpProposalResetRow;
    if (!row || !canResetProposalLine(row)) {
      setResetError("This line can no longer be reset.");
      return;
    }
    const reason = String(dom.mrpProposalResetReason?.value || "").trim();
    if (!reason) {
      setResetError("Reset reason is required.");
      return;
    }

    mrpProposalResetSaving = true;
    if (dom.mrpProposalResetSaveBtn) dom.mrpProposalResetSaveBtn.disabled = true;
    setLoadingMask(true, "Resetting proposal line...");
    setResetError("");

    try {
      const { error } = await costingRpc("rpc_adjust_product_mrp_proposal_line", {
        p_proposal_line_id: Number(row.proposal_line_id),
        p_action: "RESET",
        p_proposed_mrp_ik: null,
        p_proposed_mrp_ok: null,
        p_proposed_ok_pct: null,
        p_reason: reason,
      });
      if (error) throw error;
      closeResetModal();
      showToast("Proposal line reset to calculated values.", "success");
      if (typeof reloadRows === "function") await reloadRows();
    } catch (err) {
      handleError("Failed to reset proposal line", err);
      setResetError(err?.message || "Reset failed.");
    } finally {
      mrpProposalResetSaving = false;
      setLoadingMask(false);
      syncWriteUi();
    }
  }

  // ---- Submit modal ------------------------------------------------------

  function setSubmitError(message) {
    if (!dom.mrpProposalSubmitError) return;
    dom.mrpProposalSubmitError.hidden = !message;
    dom.mrpProposalSubmitError.textContent = message || "";
  }

  function openSubmitModal(proposalId = selectedMrpProposalId) {
    if (!requireEditAccess("submit a Product MRP Proposal")) return;
    const id = Number(proposalId);
    const header =
      mrpProposalRegisterRawRows.find((r) => Number(r.proposal_id) === id) ||
      (Number(mrpProposalHeaderCache?.proposal_id) === id
        ? mrpProposalHeaderCache
        : null);
    if (!header) {
      showToast("Proposal not found in the register.", "error");
      return;
    }
    if (String(header.status || "").toUpperCase() !== "DRAFT") {
      showToast("Only DRAFT proposals can be submitted.", "error");
      return;
    }

    selectedMrpProposalId = id;
    mrpProposalSubmitReturnFocus = document.activeElement;
    setSubmitError("");
    if (dom.mrpProposalSubmitNote) dom.mrpProposalSubmitNote.value = "";
    if (dom.mrpProposalSubmitIdentity) {
      dom.mrpProposalSubmitIdentity.textContent = `${header.proposal_number || `Proposal ${header.proposal_id}`} · ${header.product_name || ""}`;
    }
    dom.mrpProposalSubmitModal?.classList.remove("hidden");
    dom.mrpProposalSubmitModal?.setAttribute("aria-hidden", "false");
    dom.mrpProposalSubmitNote?.focus();
  }

  function closeSubmitModal() {
    dom.mrpProposalSubmitModal?.classList.add("hidden");
    dom.mrpProposalSubmitModal?.setAttribute("aria-hidden", "true");
    setSubmitError("");
    mrpProposalSubmitSaving = false;
    if (mrpProposalSubmitReturnFocus?.focus) {
      try {
        mrpProposalSubmitReturnFocus.focus();
      } catch (_) {
        /* ignore */
      }
    }
    mrpProposalSubmitReturnFocus = null;
  }

  async function saveSubmitProposal() {
    if (!requireEditAccess("submit a Product MRP Proposal")) return;
    if (mrpProposalSubmitSaving) return;
    const id = Number(selectedMrpProposalId);
    if (!Number.isFinite(id)) {
      setSubmitError("No proposal selected.");
      return;
    }
    const note = String(dom.mrpProposalSubmitNote?.value || "").trim();
    if (!note) {
      setSubmitError("Submission reason / note is required.");
      return;
    }

    mrpProposalSubmitSaving = true;
    if (dom.mrpProposalSubmitSaveBtn) {
      dom.mrpProposalSubmitSaveBtn.disabled = true;
    }
    setLoadingMask(true, "Submitting Product MRP Proposal...");
    setSubmitError("");

    try {
      const { data, error } = await costingRpc(
        "rpc_submit_product_mrp_proposal",
        {
          p_proposal_id: id,
          p_submission_note: note,
        },
      );
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      closeSubmitModal();
      showToast(
        result?.status
          ? `Proposal submitted (${humanizeToken(result.status)}).`
          : "Proposal submitted for decision.",
        "success",
      );
      mrpProposalView = "workspace";
      selectedMrpProposalId = id;
      if (typeof reloadRows === "function") await reloadRows();
    } catch (err) {
      handleError("Failed to submit Product MRP Proposal", err);
      setSubmitError(err?.message || "Submission failed.");
    } finally {
      mrpProposalSubmitSaving = false;
      setLoadingMask(false);
      syncWriteUi();
    }
  }

  function wireTableActions(_tableBody, _getViewRow) {
    // Row actions live in the detail drawer (see wireDrawerActions).
  }

  function wireDrawerActions(tabId, row) {
    if (!row) return;
    const isLine =
      row.proposal_line_id != null || mrpProposalView === "workspace";
    if (isLine) {
      if (tabId !== "line-identity") return;
      document
        .querySelector("[data-mrp-proposal-drawer-adjust]")
        ?.addEventListener("click", () => openAdjustModal(row));
      document
        .querySelector("[data-mrp-proposal-drawer-reset]")
        ?.addEventListener("click", () => openResetModal(row));
      return;
    }
    if (tabId !== "proposal-summary") return;
    document
      .querySelector("[data-mrp-proposal-drawer-open]")
      ?.addEventListener("click", () => {
        void openProposalWorkspace(row.proposal_id);
      });
    document
      .querySelector("[data-mrp-proposal-drawer-submit]")
      ?.addEventListener("click", () => {
        openSubmitModal(row.proposal_id);
      });
  }

  function wireChromeEvents(container, onLocalChange, onTabChange) {
    if (!container) return;

    const commitView = async (nextView) => {
      const next = nextView === "workspace" ? "workspace" : "register";
      if (next === "workspace" && selectedMrpProposalId == null) {
        showToast(
          "Select a proposal from the Proposal Register before opening the workspace.",
          "info",
          4200,
        );
        mrpProposalView = "register";
        const select = container.querySelector("#mrpProposalViewSelect");
        if (select) select.value = "register";
        container
          .querySelectorAll("[data-mrp-proposal-view]")
          .forEach((btn) => {
            const active = btn.dataset.mrpProposalView === "register";
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
          });
        return;
      }
      if (next === mrpProposalView) return;
      mrpProposalView = next;
      if (typeof onLocalChange === "function") await onLocalChange("view");
    };

    container.querySelectorAll("[data-mrp-proposal-view]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await commitView(btn.dataset.mrpProposalView);
      });
    });

    container
      .querySelector("#mrpProposalViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitView(event.target?.value);
      });

    container
      .querySelector("#mrpProposalSubmitBtn")
      ?.addEventListener("click", () => {
        openSubmitModal(selectedMrpProposalId);
      });

    container
      .querySelector("#mrpProposalOpenDecisionsBtn")
      ?.addEventListener("click", async () => {
        const proposalId = selectedMrpProposalId;
        if (typeof openProposalDecisions === "function") {
          await openProposalDecisions(proposalId, onTabChange);
          return;
        }
        if (typeof setMrpGovernanceTab === "function") {
          setMrpGovernanceTab("proposal-decisions");
        }
        if (typeof onTabChange === "function") {
          await onTabChange();
        } else if (typeof onLocalChange === "function") {
          await onLocalChange("tab");
        }
      });
  }

  function wireFilterDrawerEvents(container, onLocalChange) {
    if (!container) return;

    container
      .querySelectorAll("[data-mrp-proposal-register-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleRegisterFilter(
            input.dataset.mrpProposalRegisterFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-proposal-register-filter-clear]")
      ?.addEventListener("click", async () => {
        clearRegisterFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });

    container
      .querySelectorAll("[data-mrp-proposal-line-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleLineFilter(
            input.dataset.mrpProposalLineFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-proposal-line-filter-clear]")
      ?.addEventListener("click", async () => {
        clearLineFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });
  }

  function syncWriteUi() {
    const editable = canEditPolicyActions();
    [
      dom.mrpProposalGenerateSaveBtn,
      dom.mrpProposalAdjustSaveBtn,
      dom.mrpProposalResetSaveBtn,
      dom.mrpProposalSubmitSaveBtn,
    ].forEach((btn) => {
      if (btn) btn.disabled = !editable;
    });
  }

  function handleEscapeKey() {
    if (!dom.mrpProposalGenerateModal?.classList.contains("hidden")) {
      closeGenerateModal();
      return true;
    }
    if (!dom.mrpProposalAdjustModal?.classList.contains("hidden")) {
      closeAdjustModal();
      return true;
    }
    if (!dom.mrpProposalResetModal?.classList.contains("hidden")) {
      closeResetModal();
      return true;
    }
    if (!dom.mrpProposalSubmitModal?.classList.contains("hidden")) {
      closeSubmitModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    syncWriteUi();
    dom.mrpProposalGenerateCloseBtn?.addEventListener("click", closeGenerateModal);
    dom.mrpProposalGenerateCancelBtn?.addEventListener(
      "click",
      closeGenerateModal,
    );
    dom.mrpProposalGenerateSaveBtn?.addEventListener("click", () => {
      void saveGenerateProposal();
    });
    dom.mrpProposalGenerateModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpProposalGenerateModal) closeGenerateModal();
    });
    dom.mrpProposalGenerateProduct?.addEventListener("change", updateGenerateContext);

    dom.mrpProposalAdjustCloseBtn?.addEventListener("click", closeAdjustModal);
    dom.mrpProposalAdjustCancelBtn?.addEventListener("click", closeAdjustModal);
    dom.mrpProposalAdjustSaveBtn?.addEventListener("click", () => {
      void saveAdjustLine();
    });
    dom.mrpProposalAdjustModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpProposalAdjustModal) closeAdjustModal();
    });
    dom.mrpProposalAdjustCalcMode?.addEventListener("change", syncAdjustModeFields);
    [
      dom.mrpProposalAdjustMrpIk,
      dom.mrpProposalAdjustMrpOk,
      dom.mrpProposalAdjustOkPct,
    ].forEach((input) => {
      input?.addEventListener("input", updateAdjustPreview);
      input?.addEventListener("change", updateAdjustPreview);
    });

    dom.mrpProposalResetCloseBtn?.addEventListener("click", closeResetModal);
    dom.mrpProposalResetCancelBtn?.addEventListener("click", closeResetModal);
    dom.mrpProposalResetSaveBtn?.addEventListener("click", () => {
      void saveResetLine();
    });
    dom.mrpProposalResetModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpProposalResetModal) closeResetModal();
    });

    dom.mrpProposalSubmitCloseBtn?.addEventListener("click", closeSubmitModal);
    dom.mrpProposalSubmitCancelBtn?.addEventListener("click", closeSubmitModal);
    dom.mrpProposalSubmitSaveBtn?.addEventListener("click", () => {
      void saveSubmitProposal();
    });
    dom.mrpProposalSubmitModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpProposalSubmitModal) closeSubmitModal();
    });
  }

  function emptyStatusMessage() {
    if (mrpProposalView === "workspace") {
      if (selectedMrpProposalId == null) {
        return "Select a proposal from the Proposal Register to open the workspace.";
      }
      return "This proposal has no lines.";
    }
    return "No Product MRP Proposals are available yet.";
  }

  function noMatchMessage() {
    return mrpProposalView === "workspace"
      ? "No proposal lines match the current search or filters."
      : "No proposals match the current search or filters.";
  }

  function isWorkspaceView() {
    return mrpProposalView === "workspace";
  }

  return {
    isMrpProposalsTabActive,
    getMrpProposalView,
    setMrpProposalView,
    getSelectedMrpProposalId,
    loadMrpProposalRows,
    getMrpProposalFilteredRows,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    getDrawerConfig,
    renderDrawerTab,
    wireTableActions,
    wireDrawerActions,
    renderChromeHtml,
    renderActiveFilterDrawerPanel,
    wireChromeEvents,
    wireFilterDrawerEvents,
    handleEscapeKey,
    bindEvents,
    syncWriteUi,
    emptyStatusMessage,
    noMatchMessage,
    isWorkspaceView,
    openGenerateModal,
    openProposalWorkspace,
    returnToRegister,
  };
}
