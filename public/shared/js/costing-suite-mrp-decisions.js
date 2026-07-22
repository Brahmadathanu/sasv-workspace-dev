/**
 * PPM-C1F — Product MRP Proposal Decisions
 *
 * Contract note (generated supabase.ts):
 * - rpc_decide_product_mrp_proposal_line({
 *     p_proposal_line_id,
 *     p_decision,          // APPROVED | REJECTED
 *     p_decision_reason    // required (not p_reason)
 *   })
 *
 * Independent of PPM-C1E selectedMrpProposalId.
 * Deep-link proposalId remains deferred.
 */

import {
  formatMrpProposalStatusLabel,
  formatMrpDecisionLabel,
  formatMrpEligibility,
  formatMrpCalcStatus,
  formatMrpPackDirection,
  formatMrpWarningCode,
  formatMrpIkOkPair,
  formatMrpReferencePack,
  formatMrpPackLabel,
  renderMrpWarningBlockerCell,
  humanizeMrpToken,
  enrichMrpProposalRegisterSearch,
  enrichMrpProposalLineSearch,
  fetchMrpProposalRegisterRows,
  fetchMrpProposalLines,
  MRP_CALC_STATUS_OPTIONS,
  MRP_PACK_DIRECTION_OPTIONS,
  countActiveMrpFilterFields,
  renderMrpActiveFilterChip,
  renderMrpFilterDrawerPanel,
} from "./costing-suite-mrp-proposal-shared.js";

export const MRP_DECISION_VIEWS = [
  { id: "register", label: "Decision Register" },
  { id: "workspace", label: "Decision Workspace" },
];

const DECISION_ACTIVE_STATUSES = ["SUBMITTED", "PARTIALLY_DECIDED"];
const DECISION_TERMINAL_STATUSES = [
  "APPROVED",
  "REJECTED",
  "APPLIED",
  "CANCELLED",
];
const DECISION_ENABLED_STATUSES = ["SUBMITTED", "PARTIALLY_DECIDED"];

const REGISTER_HEADERS = [
  "Proposal",
  "Product",
  "Effective date",
  "Status",
  "Total lines",
  "Pending",
  "Approved",
  "Rejected",
  "Blocked",
  "Review summary",
  "Submitted at",
];

const REGISTER_ALIGNMENTS = [
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

const LINE_HEADERS = [
  "Line",
  "SKU / Pack",
  "Direction",
  "Current MRP",
  "Calculated MRP",
  "Proposed MRP",
  "Mode",
  "Calculation status",
  "Eligibility",
  "Warning / Blocker",
  "Decision",
];

const LINE_ALIGNMENTS = [
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

export function createMrpDecisionHandlers(deps) {
  const {
    dom,
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatPercent,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    reloadRows,
    canEditPricingPolicyActions,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav,
    openMrpProposals,
    openApprovedForApplication,
  } = deps;

  /** @type {"register"|"workspace"} */
  let mrpDecisionView = "register";
  let selectedDecisionProposalId = null;
  let mrpDecisionRegisterRawRows = [];
  /** Default: active decision work only. */
  let mrpDecisionRegisterFilters = {
    workflow: ["PENDING_DECISIONS"], // semantic: SUBMITTED + PARTIALLY_DECIDED
    reviewSummary: [],
    hasPending: null,
    hasBlocked: null,
    hasApproved: null,
    hasRejected: null,
  };
  /** @type {null|boolean} */
  let mrpDecisionRegisterFiltersOpen = null;
  /** Latest shell tab-change handler from wireChromeEvents (handoff strip sync). */
  let mrpDecisionTabChangeHandler = null;
  let mrpDecisionLinesRawRows = [];
  let mrpDecisionLineFilters = {
    decision: ["PENDING"],
    eligibility: [],
    calculationStatus: [],
    packDirection: [],
    warning: [],
    adjustment: [],
  };
  /** @type {null|boolean} */
  let mrpDecisionLineFiltersOpen = null;
  let mrpDecisionHeaderCache = null;
  let mrpDecisionModalRow = null;
  /** @type {"APPROVED"|"REJECTED"|null} */
  let mrpDecisionModalDecision = null;
  let mrpDecisionModalReturnFocus = null;
  let mrpDecisionModalSaving = false;
  /** After last pending is cleared, prefer showing all lines. */
  let preferAllLinesAfterComplete = false;

  const fmt = {
    text,
    formatPercent,
    formatOptionalMoney,
    statusChip,
  };

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

  function isMrpDecisionsTabActive() {
    return getMrpGovernanceTab?.() === "proposal-decisions";
  }

  function getMrpDecisionView() {
    return mrpDecisionView;
  }

  function setMrpDecisionView(view) {
    mrpDecisionView = view === "workspace" ? "workspace" : "register";
  }

  function getSelectedDecisionProposalId() {
    return selectedDecisionProposalId;
  }

  /**
   * Called from PPM-C1E "Open Proposal Decisions" handoff.
   * Independent of selectedMrpProposalId.
   */
  function activateProposal(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) return;
    selectedDecisionProposalId = id;
    mrpDecisionView = "workspace";
    preferAllLinesAfterComplete = false;
    mrpDecisionLineFilters = {
      ...mrpDecisionLineFilters,
      decision: ["PENDING"],
    };
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

  function formatProposalStatus(status) {
    return formatMrpProposalStatusLabel(status, { decisionContext: true });
  }

  function formatDecision(decision) {
    return formatMrpDecisionLabel(decision);
  }

  function isDecisionEnabledStatus(status) {
    return DECISION_ENABLED_STATUSES.includes(
      String(status || "").trim().toUpperCase(),
    );
  }

  function sortRegisterRows(rows) {
    const sorted = [...(rows || [])];
    sorted.sort((a, b) => {
      const aSub = a.submitted_at || a.created_at || "";
      const bSub = b.submitted_at || b.created_at || "";
      const subCmp = String(bSub).localeCompare(String(aSub));
      if (subCmp) return subCmp;
      return compareNullableNumber(b.proposal_id, a.proposal_id);
    });
    return sorted;
  }

  function sortLineRows(rows) {
    const sorted = [...(rows || [])];
    sorted.sort((a, b) => {
      const lineCmp = compareNullableNumber(a.line_number, b.line_number);
      if (lineCmp) return lineCmp;
      return compareNullableNumber(a.proposal_line_id, b.proposal_line_id);
    });
    return sorted;
  }

  function matchesRegisterFilters(row) {
    const status = String(row.status || "").trim().toUpperCase();
    const workflow = mrpDecisionRegisterFilters.workflow;

    if (workflow.length) {
      const wantsAll = workflow.includes("ALL");
      if (!wantsAll) {
        let ok = false;
        for (const token of workflow) {
          if (token === "PENDING_DECISIONS") {
            if (DECISION_ACTIVE_STATUSES.includes(status)) ok = true;
          } else if (token === "TERMINAL") {
            if (DECISION_TERMINAL_STATUSES.includes(status)) ok = true;
          } else if (token === status) {
            ok = true;
          }
        }
        if (!ok) return false;
      }
    } else {
      // Safety default: exclude DRAFT when no workflow selected
      if (status === "DRAFT") return false;
    }

    if (mrpDecisionRegisterFilters.reviewSummary.length) {
      const summary = String(row.review_summary_status || "")
        .trim()
        .toUpperCase();
      if (!mrpDecisionRegisterFilters.reviewSummary.includes(summary)) {
        return false;
      }
    }

    const flag = (key, countField) => {
      const v = mrpDecisionRegisterFilters[key];
      if (v === true && !(Number(row[countField]) > 0)) return false;
      if (v === false && Number(row[countField]) > 0) return false;
      return true;
    };
    if (!flag("hasPending", "pending_line_count")) return false;
    if (!flag("hasBlocked", "blocked_line_count")) return false;
    if (!flag("hasApproved", "approved_line_count")) return false;
    if (!flag("hasRejected", "rejected_line_count")) return false;
    return true;
  }

  function matchesLineFilters(row) {
    if (mrpDecisionLineFilters.decision.length) {
      const v = String(row.decision || "").trim().toUpperCase();
      if (!mrpDecisionLineFilters.decision.includes(v)) return false;
    }
    if (mrpDecisionLineFilters.eligibility.length) {
      const v = String(row.eligibility_status || "").trim().toUpperCase();
      if (!mrpDecisionLineFilters.eligibility.includes(v)) return false;
    }
    if (mrpDecisionLineFilters.calculationStatus.length) {
      const v = String(row.calculation_status || "").trim().toUpperCase();
      if (!mrpDecisionLineFilters.calculationStatus.includes(v)) return false;
    }
    if (mrpDecisionLineFilters.packDirection.length) {
      const v = String(row.pack_direction || "").trim().toUpperCase();
      if (!mrpDecisionLineFilters.packDirection.includes(v)) return false;
    }
    if (mrpDecisionLineFilters.warning.length) {
      const v = String(row.warning_code || "").trim().toUpperCase();
      if (!mrpDecisionLineFilters.warning.includes(v)) return false;
    }
    if (mrpDecisionLineFilters.adjustment.length) {
      const manual = row.is_manually_adjusted === true;
      const wantsManual = mrpDecisionLineFilters.adjustment.includes("MANUAL");
      const wantsOriginal =
        mrpDecisionLineFilters.adjustment.includes("ORIGINAL");
      if (wantsManual && wantsOriginal) {
        /* both → no restriction */
      } else if (wantsManual && !manual) return false;
      else if (wantsOriginal && manual) return false;
    }
    return true;
  }

  function getRegisterFilteredRows() {
    return sortRegisterRows(
      mrpDecisionRegisterRawRows.filter(matchesRegisterFilters),
    );
  }

  function getLineFilteredRows() {
    return sortLineRows(mrpDecisionLinesRawRows.filter(matchesLineFilters));
  }

  function getMrpDecisionFilteredRows() {
    if (mrpDecisionView === "workspace") {
      if (selectedDecisionProposalId == null) return [];
      return getLineFilteredRows();
    }
    return getRegisterFilteredRows();
  }

  function refreshHeaderCache() {
    if (selectedDecisionProposalId == null) {
      mrpDecisionHeaderCache = null;
      return null;
    }
    mrpDecisionHeaderCache =
      mrpDecisionRegisterRawRows.find(
        (r) => String(r.proposal_id) === String(selectedDecisionProposalId),
      ) || null;
    return mrpDecisionHeaderCache;
  }

  async function loadMrpDecisionRows() {
    const rows = await fetchMrpProposalRegisterRows(costingFrom, fetchAllRows);
    mrpDecisionRegisterRawRows = (rows || []).map(enrichMrpProposalRegisterSearch);
    refreshHeaderCache();

    if (mrpDecisionView === "workspace") {
      if (selectedDecisionProposalId == null) {
        mrpDecisionLinesRawRows = [];
        return [];
      }
      if (!mrpDecisionHeaderCache) {
        selectedDecisionProposalId = null;
        mrpDecisionView = "register";
        showToast(
          "The selected proposal is no longer available. Showing the decision register.",
          "info",
          4200,
        );
        return getRegisterFilteredRows();
      }
      const lines = await fetchMrpProposalLines(
        costingFrom,
        fetchAllRows,
        selectedDecisionProposalId,
      );
      mrpDecisionLinesRawRows = (lines || []).map(enrichMrpProposalLineSearch);

      const pendingLeft = mrpDecisionLinesRawRows.filter(
        (r) => String(r.decision || "").toUpperCase() === "PENDING",
      ).length;
      if (preferAllLinesAfterComplete || pendingLeft === 0) {
        mrpDecisionLineFilters = { ...mrpDecisionLineFilters, decision: [] };
        preferAllLinesAfterComplete = true;
      }

      return getLineFilteredRows();
    }

    return getRegisterFilteredRows();
  }

  function collectReviewSummaryOptions() {
    const seen = new Set();
    mrpDecisionRegisterRawRows.forEach((row) => {
      const v = String(row.review_summary_status || "").trim().toUpperCase();
      if (v) seen.add(v);
    });
    return [...seen].sort();
  }

  function collectLineWarningOptions() {
    const seen = new Set();
    mrpDecisionLinesRawRows.forEach((row) => {
      const v = String(row.warning_code || "").trim().toUpperCase();
      if (v) seen.add(v);
    });
    return [...seen].sort();
  }

  function toggleRegisterFilter(group, value, checked) {
    if (
      group === "hasPending" ||
      group === "hasBlocked" ||
      group === "hasApproved" ||
      group === "hasRejected"
    ) {
      mrpDecisionRegisterFilters[group] = checked ? value === "true" : null;
      return getMrpDecisionFilteredRows();
    }
    if (group === "workflow") {
      const token = String(value || "").trim().toUpperCase();
      if (!token) return getMrpDecisionFilteredRows();
      if (token === "ALL") {
        mrpDecisionRegisterFilters.workflow = checked ? ["ALL"] : ["PENDING_DECISIONS"];
        return getMrpDecisionFilteredRows();
      }
      const set = new Set(
        (mrpDecisionRegisterFilters.workflow || []).filter((t) => t !== "ALL"),
      );
      if (checked) set.add(token);
      else set.delete(token);
      mrpDecisionRegisterFilters.workflow = set.size
        ? [...set]
        : ["PENDING_DECISIONS"];
      return getMrpDecisionFilteredRows();
    }
    if (!Array.isArray(mrpDecisionRegisterFilters[group])) {
      return getMrpDecisionFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    const set = new Set(mrpDecisionRegisterFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpDecisionRegisterFilters[group] = [...set];
    return getMrpDecisionFilteredRows();
  }

  function clearRegisterFilters() {
    mrpDecisionRegisterFilters = {
      workflow: ["PENDING_DECISIONS"],
      reviewSummary: [],
      hasPending: null,
      hasBlocked: null,
      hasApproved: null,
      hasRejected: null,
    };
    return getMrpDecisionFilteredRows();
  }

  function toggleLineFilter(group, value, checked) {
    if (!Array.isArray(mrpDecisionLineFilters[group])) {
      return getMrpDecisionFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    const set = new Set(mrpDecisionLineFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpDecisionLineFilters[group] = [...set];
    preferAllLinesAfterComplete = false;
    return getMrpDecisionFilteredRows();
  }

  function clearLineFilters() {
    mrpDecisionLineFilters = {
      decision: [],
      eligibility: [],
      calculationStatus: [],
      packDirection: [],
      warning: [],
      adjustment: [],
    };
    preferAllLinesAfterComplete = true;
    return getMrpDecisionFilteredRows();
  }

  function renderFilterCheckbox(dataAttr, group, value, label, checked) {
    const safe = String(value).replace(/"/g, "&quot;");
    return `<label class="cp-mrp-filter-item"><input type="checkbox" ${dataAttr}="${group}" value="${safe}" ${checked ? "checked" : ""}/> ${text(label)}</label>`;
  }

  function formatDecisionWorkflowLabel(token) {
    if (token === "PENDING_DECISIONS") return "Pending decisions";
    if (token === "PARTIALLY_DECIDED") return "Partially decided";
    if (token === "APPROVED") return "Approved for application";
    if (token === "ALL") return "All (incl. Draft)";
    if (token === "REJECTED") return "Rejected";
    if (token === "APPLIED") return "Applied";
    if (token === "CANCELLED") return "Cancelled";
    return formatProposalStatus(token);
  }

  function buildDecisionRegisterFilterChips() {
    const chips = [];
    for (const token of mrpDecisionRegisterFilters.workflow || []) {
      const label = `Workflow: ${formatDecisionWorkflowLabel(token)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-decision-register-filter-chip-group",
          group: "workflow",
          valueAttr: "data-mrp-decision-register-filter-chip-value",
          value: token,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    for (const status of mrpDecisionRegisterFilters.reviewSummary || []) {
      const label = `Review: ${humanizeMrpToken(status)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-decision-register-filter-chip-group",
          group: "reviewSummary",
          valueAttr: "data-mrp-decision-register-filter-chip-value",
          value: status,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    const boolChips = [
      ["hasPending", "Has pending lines"],
      ["hasBlocked", "Has blocked lines"],
      ["hasApproved", "Has approved lines"],
      ["hasRejected", "Has rejected lines"],
    ];
    for (const [group, chipLabel] of boolChips) {
      if (mrpDecisionRegisterFilters[group] === true) {
        chips.push(
          renderMrpActiveFilterChip({
            label: chipLabel,
            groupAttr: "data-mrp-decision-register-filter-chip-group",
            group,
            valueAttr: "data-mrp-decision-register-filter-chip-value",
            value: "true",
            ariaLabel: `Remove ${chipLabel} filter`,
          }),
        );
      }
    }
    return chips.join("");
  }

  function buildDecisionLineFilterChips() {
    const chips = [];
    const pushArray = (group, fieldLabel, formatFn) => {
      for (const value of mrpDecisionLineFilters[group] || []) {
        const label = `${fieldLabel}: ${formatFn(value)}`;
        chips.push(
          renderMrpActiveFilterChip({
            label,
            groupAttr: "data-mrp-decision-line-filter-chip-group",
            group,
            valueAttr: "data-mrp-decision-line-filter-chip-value",
            value,
            ariaLabel: `Remove ${label} filter`,
          }),
        );
      }
    };
    pushArray("decision", "Decision", formatDecision);
    pushArray("eligibility", "Eligibility", formatMrpEligibility);
    pushArray("calculationStatus", "Calc status", formatMrpCalcStatus);
    pushArray("packDirection", "Pack", formatMrpPackDirection);
    pushArray("warning", "Warning", formatMrpWarningCode);
    pushArray("adjustment", "Adjustment", (v) =>
      v === "ORIGINAL"
        ? "Original calculated"
        : v === "MANUAL"
          ? "Manually adjusted"
          : humanizeMrpToken(v),
    );
    return chips.join("");
  }

  function renderRegisterFilterPanel() {
    const workflow = mrpDecisionRegisterFilters.workflow || [];
    const has = (token) => workflow.includes(token) || workflow.includes("ALL");
    const reviewOptions = collectReviewSummaryOptions()
      .map((status) =>
        renderFilterCheckbox(
          "data-mrp-decision-register-filter",
          "reviewSummary",
          status,
          humanizeMrpToken(status),
          mrpDecisionRegisterFilters.reviewSummary.includes(status),
        ),
      )
      .join("");

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpDecisionRegisterFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Workflow state</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "PENDING_DECISIONS", "Pending decisions", workflow.includes("PENDING_DECISIONS") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "PARTIALLY_DECIDED", "Partially decided", has("PARTIALLY_DECIDED") && !workflow.includes("ALL") && !workflow.includes("PENDING_DECISIONS"))}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "APPROVED", "Approved for application", has("APPROVED") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "REJECTED", "Rejected", has("REJECTED") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "APPLIED", "Applied", has("APPLIED") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "CANCELLED", "Cancelled", has("CANCELLED") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "workflow", "ALL", "All (incl. Draft)", workflow.includes("ALL"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Line signals</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "hasPending", "true", "Has pending lines", mrpDecisionRegisterFilters.hasPending === true)}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "hasBlocked", "true", "Has blocked lines", mrpDecisionRegisterFilters.hasBlocked === true)}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "hasApproved", "true", "Has approved lines", mrpDecisionRegisterFilters.hasApproved === true)}
            ${renderFilterCheckbox("data-mrp-decision-register-filter", "hasRejected", "true", "Has rejected lines", mrpDecisionRegisterFilters.hasRejected === true)}
          </div>
        </div>
        ${
          reviewOptions
            ? `<div class="cp-mrp-filter-group">
                <div class="cp-mrp-filter-title">Review summary</div>
                <div class="cp-mrp-filter-options">${reviewOptions}</div>
              </div>`
            : ""
        }
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpDecisionRegisterFilters, [
      "workflow",
      "reviewSummary",
      "hasPending",
      "hasBlocked",
      "hasApproved",
      "hasRejected",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-decision-register-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function renderLineFilterPanel() {
    const warningOptions = collectLineWarningOptions()
      .map((code) =>
        renderFilterCheckbox(
          "data-mrp-decision-line-filter",
          "warning",
          code,
          formatMrpWarningCode(code),
          mrpDecisionLineFilters.warning.includes(code),
        ),
      )
      .join("");

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpDecisionLineFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Decision</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "decision", "PENDING", "Pending", mrpDecisionLineFilters.decision.includes("PENDING"))}
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "decision", "APPROVED", "Approved", mrpDecisionLineFilters.decision.includes("APPROVED"))}
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "decision", "REJECTED", "Rejected", mrpDecisionLineFilters.decision.includes("REJECTED"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Eligibility</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "eligibility", "ELIGIBLE", "Eligible", mrpDecisionLineFilters.eligibility.includes("ELIGIBLE"))}
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "eligibility", "BLOCKED", "Blocked", mrpDecisionLineFilters.eligibility.includes("BLOCKED"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Calculation status</div>
          <div class="cp-mrp-filter-options">
            ${MRP_CALC_STATUS_OPTIONS.map((s) =>
              renderFilterCheckbox(
                "data-mrp-decision-line-filter",
                "calculationStatus",
                s,
                formatMrpCalcStatus(s),
                mrpDecisionLineFilters.calculationStatus.includes(s),
              ),
            ).join("")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Pack direction</div>
          <div class="cp-mrp-filter-options">
            ${MRP_PACK_DIRECTION_OPTIONS.map((s) =>
              renderFilterCheckbox(
                "data-mrp-decision-line-filter",
                "packDirection",
                s,
                formatMrpPackDirection(s),
                mrpDecisionLineFilters.packDirection.includes(s),
              ),
            ).join("")}
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
          <div class="cp-mrp-filter-title">Adjustment</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "adjustment", "ORIGINAL", "Original calculated", mrpDecisionLineFilters.adjustment.includes("ORIGINAL"))}
            ${renderFilterCheckbox("data-mrp-decision-line-filter", "adjustment", "MANUAL", "Manually adjusted", mrpDecisionLineFilters.adjustment.includes("MANUAL"))}
          </div>
        </div>
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpDecisionLineFilters, [
      "decision",
      "eligibility",
      "calculationStatus",
      "packDirection",
      "warning",
      "adjustment",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-decision-line-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function countLinesBy(predicate) {
    return mrpDecisionLinesRawRows.filter(predicate).length;
  }

  function renderWorkspaceHeaderPanel() {
    const header = mrpDecisionHeaderCache;
    if (!header) {
      return `
        <div class="cp-mrp-governance-empty" role="status" style="margin:8px 0">
          <div class="cp-mrp-governance-empty-title">No proposal selected</div>
          <p class="cp-mrp-governance-empty-body">Open a submitted proposal from the Decision Register to approve or reject proposal lines. Approval marks lines eligible for later canonical application — it does not change canonical SKU MRP immediately.</p>
        </div>`;
    }

    const status = String(header.status || "").trim().toUpperCase();
    const total =
      mrpDecisionLinesRawRows.length || Number(header.total_line_count) || 0;
    const pending =
      countLinesBy((r) => String(r.decision || "").toUpperCase() === "PENDING") ||
      Number(header.pending_line_count) ||
      0;
    const approved =
      countLinesBy((r) => String(r.decision || "").toUpperCase() === "APPROVED") ||
      Number(header.approved_line_count) ||
      0;
    const rejected =
      countLinesBy((r) => String(r.decision || "").toUpperCase() === "REJECTED") ||
      Number(header.rejected_line_count) ||
      0;
    const eligible =
      countLinesBy(
        (r) => String(r.eligibility_status || "").toUpperCase() === "ELIGIBLE",
      ) || Number(header.eligible_line_count) || 0;
    const blocked =
      countLinesBy(
        (r) => String(r.eligibility_status || "").toUpperCase() === "BLOCKED",
      ) || Number(header.blocked_line_count) || 0;
    const adjusted =
      countLinesBy((r) => r.is_manually_adjusted === true) ||
      Number(header.manually_adjusted_line_count) ||
      0;
    const warnings =
      countLinesBy((r) => String(r.warning_code || "").trim()) ||
      Number(header.warning_line_count) ||
      0;

    const completeNote =
      pending === 0
        ? `<div class="cp-muted-text" style="margin-top:8px;line-height:1.45"><strong>Decision review complete</strong> for this proposal. Status: ${text(formatProposalStatus(header.status))}.</div>`
        : "";

    const applyLink =
      status === "APPROVED"
        ? `<button type="button" class="icon-btn" id="mrpDecisionOpenApplicationBtn" title="Open Approved for Application" aria-label="Open Approved for Application">Open Approved for Application</button>`
        : "";

    return `
      <div class="cp-mrp-proposal-workspace-header" id="mrpDecisionWorkspaceHeader">
        <div class="cp-muted-text" style="margin-bottom:8px;line-height:1.45">
          Line approval marks eligibility for later canonical MRP application. It does not change canonical SKU MRP immediately.
        </div>
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
            <div class="cp-card-value">${text(formatMrpReferencePack(header))}</div>
            <div class="cp-muted-text">Derivation ${text(header.derivation_policy_id || "--")}</div>
          </div>
        </div>
        <div class="cp-summary-strip" style="margin-top:8px">
          <div class="cp-card"><div class="cp-card-label">Total</div><div class="cp-card-value">${text(total)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Pending</div><div class="cp-card-value">${text(pending)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Approved</div><div class="cp-card-value">${text(approved)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Rejected</div><div class="cp-card-value">${text(rejected)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Eligible</div><div class="cp-card-value">${text(eligible)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Blocked</div><div class="cp-card-value">${text(blocked)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Adjusted</div><div class="cp-card-value">${text(adjusted)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Warnings</div><div class="cp-card-value">${text(warnings)}</div></div>
        </div>
        <div class="cp-muted-text" style="margin-top:8px;line-height:1.45">
          ${header.reason ? `Reason: ${text(header.reason)}` : "Reason: --"}
          ${header.approval_reference ? ` · Approval: ${text(header.approval_reference)}` : ""}
          ${header.submission_note ? ` · Submission note: ${text(header.submission_note)}` : ""}
          · Created ${formatDateTime(header.created_at)}${header.created_by ? ` by ${text(header.created_by)}` : ""}
          ${header.submitted_at ? ` · Submitted ${formatDateTime(header.submitted_at)}${header.submitted_by ? ` by ${text(header.submitted_by)}` : ""}` : ""}
          ${header.applied_at ? ` · Applied ${formatDateTime(header.applied_at)}${header.applied_by ? ` by ${text(header.applied_by)}` : ""}` : ""}
        </div>
        ${completeNote}
        ${applyLink ? `<div class="cp-mrp-create-toolbar" style="margin-top:8px">${applyLink}</div>` : ""}
      </div>`;
  }

  function renderChromeHtml() {
    if (!isMrpDecisionsTabActive()) return "";
    const nested = renderNestedSubviewNav({
      options: MRP_DECISION_VIEWS,
      activeId: mrpDecisionView,
      dataAttr: "data-mrp-decision-view",
      selectId: "mrpDecisionViewSelect",
      selectLabel: "View",
      selectAriaLabel: "Select proposal decision view",
    });

    if (mrpDecisionView === "workspace") {
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
    if (!isMrpDecisionsTabActive()) return null;
    if (mrpDecisionView === "workspace") {
      if (selectedDecisionProposalId == null) return null;
      return renderLineFilterPanel();
    }
    return renderRegisterFilterPanel();
  }

  function canApproveLine(row, header = mrpDecisionHeaderCache) {
    if (!canEditPolicyActions()) return false;
    if (!isDecisionEnabledStatus(header?.status || row?.proposal_status)) {
      return false;
    }
    if (String(row?.decision || "").toUpperCase() !== "PENDING") return false;
    if (row?.applied_mrp_policy_id != null) return false;
    if (String(row?.eligibility_status || "").toUpperCase() !== "ELIGIBLE") {
      return false;
    }
    return true;
  }

  function canRejectLine(row, header = mrpDecisionHeaderCache) {
    if (!canEditPolicyActions()) return false;
    if (!isDecisionEnabledStatus(header?.status || row?.proposal_status)) {
      return false;
    }
    if (String(row?.decision || "").toUpperCase() !== "PENDING") return false;
    if (row?.applied_mrp_policy_id != null) return false;
    return true;
  }

  function renderRegisterDrawerActions(row) {
    const status = String(row.status || "").trim().toUpperCase();
    if (status === "DRAFT") {
      return `<div class="cp-drawer-action-bar"><button type="button" class="icon-btn" data-mrp-decision-drawer-open-proposals="${text(row.proposal_id)}" title="Open in MRP Proposals" aria-label="Open in MRP Proposals">Open in Proposals</button></div>`;
    }
    return `<div class="cp-drawer-action-bar"><button type="button" class="icon-btn icon-btn-primary" data-mrp-decision-drawer-open="${text(row.proposal_id)}" title="Open decision workspace" aria-label="Open decision workspace">Open</button></div>`;
  }

  function renderLineDrawerActions(row) {
    const parts = [];
    if (canApproveLine(row)) {
      parts.push(
        `<button type="button" class="icon-btn icon-btn-primary" data-mrp-decision-drawer-approve="${text(row.proposal_line_id)}" title="Approve Line" aria-label="Approve Line">Approve</button>`,
      );
    }
    if (canRejectLine(row)) {
      parts.push(
        `<button type="button" class="icon-btn cp-danger-icon-btn" data-mrp-decision-drawer-reject="${text(row.proposal_line_id)}" title="Reject Line" aria-label="Reject Line">Reject</button>`,
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
      <td class="c-right">${text(row.total_line_count ?? "--")}</td>
      <td class="c-right">${text(row.pending_line_count ?? "--")}</td>
      <td class="c-right">${text(row.approved_line_count ?? "--")}</td>
      <td class="c-right">${text(row.rejected_line_count ?? "--")}</td>
      <td class="c-right">${text(row.blocked_line_count ?? "--")}</td>
      <td>${text(humanizeMrpToken(row.review_summary_status))}</td>
      <td>${formatDateTime(row.submitted_at || row.created_at)}</td>
    </tr>`;
  }

  function renderLineRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td class="c-right">${text(row.line_number ?? "--")}</td>
      <td>${cpCellPrimary(`SKU ${row.sku_id ?? "--"}`)}<div class="cp-muted-text">${text(formatMrpPackLabel(row))}</div></td>
      <td>${text(formatMrpPackDirection(row.pack_direction))}</td>
      <td class="c-right">${text(formatMrpIkOkPair(row.current_mrp_ik, row.current_mrp_ok, fmt))}</td>
      <td class="c-right">${text(formatMrpIkOkPair(row.calculated_mrp_ik, row.calculated_mrp_ok, fmt))}</td>
      <td class="c-right">${text(formatMrpIkOkPair(row.proposed_mrp_ik, row.proposed_mrp_ok, fmt))}</td>
      <td>${text(row.proposed_calc_mode || "--")}</td>
      <td>${statusChip(formatMrpCalcStatus(row.calculation_status))}</td>
      <td>${statusChip(formatMrpEligibility(row.eligibility_status))}</td>
      <td>${renderMrpWarningBlockerCell(row, fmt)}</td>
      <td>${statusChip(formatDecision(row.decision))}<div class="cp-muted-text">${text(row.decision_reason || "")}</div></td>
    </tr>`;
  }

  function getTableHeaders() {
    return mrpDecisionView === "workspace" ? LINE_HEADERS : REGISTER_HEADERS;
  }

  function getTableAlignments() {
    return mrpDecisionView === "workspace"
      ? LINE_ALIGNMENTS
      : REGISTER_ALIGNMENTS;
  }

  function renderTableRow(row, trAttrs) {
    if (mrpDecisionView === "workspace") {
      if (selectedDecisionProposalId == null) return null;
      return renderLineRow(row, trAttrs);
    }
    return renderRegisterRow(row, trAttrs);
  }

  function getDrawerConfig(row, preferredTab) {
    if (mrpDecisionView === "workspace" || row?.proposal_line_id != null) {
      return {
        title:
          row.sku_id != null
            ? `SKU ${row.sku_id}`
            : `Line ${row.line_number ?? ""}`,
        subtitle: [
          row.proposal_number ||
            (row.proposal_id != null ? `Proposal ${row.proposal_id}` : ""),
          formatMrpPackLabel(row),
          formatDecision(row.decision),
        ]
          .filter(Boolean)
          .join(" · "),
        tabs: [
          { id: "line-identity", label: "Identity" },
          { id: "line-values", label: "MRP Values" },
          { id: "line-decision", label: "Decision" },
          { id: "line-governance", label: "Governance" },
        ],
        activeTab: preferredTab || "line-decision",
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
    if (row?.proposal_line_id != null || mrpDecisionView === "workspace") {
      if (tabId === "line-values") {
        return detailPanel([
          kvSection("Current canonical", [
            ["Current policy ID", text(row.current_mrp_policy_id)],
            ["Current IK MRP", formatOptionalMoney(row.current_mrp_ik)],
            ["Current OK MRP", formatOptionalMoney(row.current_mrp_ok)],
          ]),
          kvSection("Calculated proposal", [
            ["Calculated IK", formatOptionalMoney(row.calculated_mrp_ik)],
            ["Calculated OK", formatOptionalMoney(row.calculated_mrp_ok)],
            ["Calculation status", text(formatMrpCalcStatus(row.calculation_status))],
          ]),
          kvSection("Proposed result", [
            ["Proposed IK", formatOptionalMoney(row.proposed_mrp_ik)],
            ["Proposed OK", formatOptionalMoney(row.proposed_mrp_ok)],
            ["Proposed mode", text(row.proposed_calc_mode)],
          ]),
        ]);
      }
      if (tabId === "line-decision") {
        const appliedNote =
          row.applied_mrp_policy_id != null
            ? "Applied to canonical policy"
            : String(row.decision || "").toUpperCase() === "APPROVED"
              ? "Canonical application pending"
              : "--";
        return (
          renderLineDrawerActions(row) +
          detailPanel([
            kvSection("Decision", [
              ["Decision", text(formatDecision(row.decision))],
              ["Decision reason", text(row.decision_reason || "--")],
              ["Decided at", formatDateTime(row.decided_at)],
              ["Decided by", text(row.decided_by)],
            ]),
            kvSection("Application status", [
              ["Status", text(appliedNote)],
              ["Applied policy ID", text(row.applied_mrp_policy_id || "--")],
              ["Applied at", formatDateTime(row.applied_at)],
              ["Applied by", text(row.applied_by)],
            ]),
          ])
        );
      }
      if (tabId === "line-governance") {
        return detailPanel([
          kvSection("Eligibility", [
            ["Eligibility", text(formatMrpEligibility(row.eligibility_status))],
            ["Blocker code", text(row.blocker_code || "--")],
            [
              "Blocker",
              text(row.blocker_code ? humanizeMrpToken(row.blocker_code) : "--"),
            ],
            ["Warning code", text(row.warning_code || "--")],
            [
              "Warning",
              text(
                row.warning_code ? formatMrpWarningCode(row.warning_code) : "--",
              ),
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
        ]);
      }
      return detailPanel([
        kvSection("Identity", [
          ["Proposal line ID", text(row.proposal_line_id)],
          ["Line number", text(row.line_number)],
          ["SKU ID", text(row.sku_id)],
          ["Product", text(row.product_name)],
          ["Pack", text(formatMrpPackLabel(row))],
          ["Pack direction", text(formatMrpPackDirection(row.pack_direction))],
        ]),
      ]);
    }

    if (tabId === "proposal-counts") {
      return detailPanel([
        kvSection("Decision counts", [
          ["Total lines", text(row.total_line_count)],
          ["Pending", text(row.pending_line_count)],
          ["Approved", text(row.approved_line_count)],
          ["Rejected", text(row.rejected_line_count)],
          ["Blocked", text(row.blocked_line_count)],
          ["Eligible", text(row.eligible_line_count)],
        ]),
      ]);
    }

    if (tabId === "proposal-evidence") {
      return detailPanel([
        kvSection("Submission", [
          ["Submitted at", formatDateTime(row.submitted_at)],
          ["Submitted by", text(row.submitted_by)],
          ["Submission note", text(row.submission_note || "--")],
          ["Reason", text(row.reason || "--")],
          ["Approval reference", text(row.approval_reference || "--")],
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
          ["Review summary", text(humanizeMrpToken(row.review_summary_status))],
          ["Effective from", formatDate(row.proposed_effective_from)],
          ["Derivation policy ID", text(row.derivation_policy_id)],
          ["Reference Pack", text(formatMrpReferencePack(row))],
          ["Product", text(row.product_name)],
        ]),
      ])
    );
  }

  async function openDecisionWorkspace(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) {
      showToast("Invalid proposal selection.", "error");
      return;
    }
    selectedDecisionProposalId = id;
    mrpDecisionView = "workspace";
    preferAllLinesAfterComplete = false;
    mrpDecisionLineFilters = {
      ...mrpDecisionLineFilters,
      decision: ["PENDING"],
    };
    if (typeof reloadRows === "function") await reloadRows();
  }

  // ---- Decision modal ----------------------------------------------------

  function setDecisionError(message) {
    if (!dom.mrpDecisionLineModalError) return;
    dom.mrpDecisionLineModalError.hidden = !message;
    dom.mrpDecisionLineModalError.textContent = message || "";
  }

  function openDecisionModal(row, decision) {
    const actionLabel =
      decision === "APPROVED" ? "approve a proposal line" : "reject a proposal line";
    if (!requireEditAccess(actionLabel)) return;

    if (decision === "APPROVED" && !canApproveLine(row)) {
      showToast("This proposal line cannot be approved in its current state.", "error");
      return;
    }
    if (decision === "REJECTED" && !canRejectLine(row)) {
      showToast("This proposal line cannot be rejected in its current state.", "error");
      return;
    }

    mrpDecisionModalRow = row;
    mrpDecisionModalDecision = decision;
    mrpDecisionModalReturnFocus = document.activeElement;
    setDecisionError("");

    const isApprove = decision === "APPROVED";
    if (dom.mrpDecisionLineModalTitle) {
      dom.mrpDecisionLineModalTitle.textContent = isApprove
        ? "Approve Line"
        : "Reject Line";
    }
    if (dom.mrpDecisionLineModalSaveBtn) {
      dom.mrpDecisionLineModalSaveBtn.textContent = isApprove
        ? "Approve Line"
        : "Reject Line";
      dom.mrpDecisionLineModalSaveBtn.classList.toggle(
        "icon-btn-primary",
        isApprove,
      );
      dom.mrpDecisionLineModalSaveBtn.classList.toggle(
        "cp-danger-icon-btn",
        !isApprove,
      );
    }
    if (dom.mrpDecisionLineModalNote) {
      dom.mrpDecisionLineModalNote.textContent = isApprove
        ? "Approving this line marks it eligible for later canonical MRP application. It does not change the canonical SKU MRP immediately."
        : "Rejected lines will not be included in canonical MRP application.";
    }
    if (dom.mrpDecisionLineModalContext) {
      dom.mrpDecisionLineModalContext.innerHTML = `
        <div class="cp-preview-row"><span>Product</span><span class="cp-preview-value">${text(row.product_name)}</span></div>
        <div class="cp-preview-row"><span>SKU / Pack</span><span class="cp-preview-value">${text(`SKU ${row.sku_id} · ${formatMrpPackLabel(row)}`)}</span></div>
        <div class="cp-preview-row"><span>Proposed IK</span><span class="cp-preview-value">${formatOptionalMoney(row.proposed_mrp_ik)}</span></div>
        <div class="cp-preview-row"><span>Proposed OK</span><span class="cp-preview-value">${formatOptionalMoney(row.proposed_mrp_ok)}</span></div>
        <div class="cp-preview-row"><span>Proposed mode</span><span class="cp-preview-value">${text(row.proposed_calc_mode || "--")}</span></div>
        <div class="cp-preview-row"><span>Calculation status</span><span class="cp-preview-value">${text(formatMrpCalcStatus(row.calculation_status))}</span></div>
        <div class="cp-preview-row"><span>Eligibility</span><span class="cp-preview-value">${text(formatMrpEligibility(row.eligibility_status))}</span></div>
        <div class="cp-preview-row"><span>Blocker</span><span class="cp-preview-value">${text(row.blocker_code ? humanizeMrpToken(row.blocker_code) : "--")}</span></div>
        <div class="cp-preview-row"><span>Warning</span><span class="cp-preview-value">${text(row.warning_code ? formatMrpWarningCode(row.warning_code) : "--")}</span></div>
      `;
    }
    if (dom.mrpDecisionLineModalReason) {
      dom.mrpDecisionLineModalReason.value = "";
    }

    dom.mrpDecisionLineModal?.classList.remove("hidden");
    dom.mrpDecisionLineModal?.setAttribute("aria-hidden", "false");
    dom.mrpDecisionLineModalReason?.focus();
  }

  function closeDecisionModal() {
    dom.mrpDecisionLineModal?.classList.add("hidden");
    dom.mrpDecisionLineModal?.setAttribute("aria-hidden", "true");
    setDecisionError("");
    mrpDecisionModalRow = null;
    mrpDecisionModalDecision = null;
    mrpDecisionModalSaving = false;
    if (mrpDecisionModalReturnFocus?.focus) {
      try {
        mrpDecisionModalReturnFocus.focus();
      } catch (_) {
        /* ignore */
      }
    }
    mrpDecisionModalReturnFocus = null;
  }

  async function saveDecision() {
    const decision = mrpDecisionModalDecision;
    const row = mrpDecisionModalRow;
    const actionLabel =
      decision === "APPROVED" ? "approve a proposal line" : "reject a proposal line";
    if (!requireEditAccess(actionLabel)) return;
    if (mrpDecisionModalSaving) return;
    if (!row || !decision) {
      setDecisionError("Decision context is missing.");
      return;
    }
    if (decision === "APPROVED" && !canApproveLine(row)) {
      setDecisionError("This line is no longer eligible for approval.");
      return;
    }
    if (decision === "REJECTED" && !canRejectLine(row)) {
      setDecisionError("This line can no longer be rejected.");
      return;
    }

    const reason = String(dom.mrpDecisionLineModalReason?.value || "").trim();
    if (!reason) {
      setDecisionError("Decision reason is required.");
      return;
    }

    mrpDecisionModalSaving = true;
    if (dom.mrpDecisionLineModalSaveBtn) {
      dom.mrpDecisionLineModalSaveBtn.disabled = true;
    }
    setLoadingMask(
      true,
      decision === "APPROVED" ? "Approving proposal line..." : "Rejecting proposal line...",
    );
    setDecisionError("");

    try {
      const { error } = await costingRpc("rpc_decide_product_mrp_proposal_line", {
        p_proposal_line_id: Number(row.proposal_line_id),
        p_decision: decision,
        p_decision_reason: reason,
      });
      if (error) throw error;

      closeDecisionModal();
      showToast(
        decision === "APPROVED"
          ? "Line approved for later canonical application."
          : "Line rejected.",
        "success",
      );

      // Preserve filters; if this was last pending, load will switch to all lines.
      const remainingPending = mrpDecisionLinesRawRows.filter(
        (r) =>
          String(r.proposal_line_id) !== String(row.proposal_line_id) &&
          String(r.decision || "").toUpperCase() === "PENDING",
      ).length;
      if (remainingPending === 0) preferAllLinesAfterComplete = true;

      if (typeof reloadRows === "function") await reloadRows();
    } catch (err) {
      handleError("Failed to record proposal-line decision", err);
      setDecisionError(err?.message || "Decision failed.");
    } finally {
      mrpDecisionModalSaving = false;
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
      row.proposal_line_id != null || mrpDecisionView === "workspace";
    if (isLine) {
      if (tabId !== "line-decision") return;
      document
        .querySelector("[data-mrp-decision-drawer-approve]")
        ?.addEventListener("click", () => openDecisionModal(row, "APPROVED"));
      document
        .querySelector("[data-mrp-decision-drawer-reject]")
        ?.addEventListener("click", () => openDecisionModal(row, "REJECTED"));
      return;
    }
    if (tabId !== "proposal-summary") return;
    document
      .querySelector("[data-mrp-decision-drawer-open]")
      ?.addEventListener("click", () => {
        void openDecisionWorkspace(row.proposal_id);
      });
    document
      .querySelector("[data-mrp-decision-drawer-open-proposals]")
      ?.addEventListener("click", async () => {
        const proposalId = row.proposal_id;
        if (typeof openMrpProposals === "function") {
          await openMrpProposals(proposalId, mrpDecisionTabChangeHandler);
          return;
        }
        if (typeof setMrpGovernanceTab === "function") {
          setMrpGovernanceTab("mrp-proposals");
        }
        if (typeof reloadRows === "function") await reloadRows();
      });
  }

  function wireChromeEvents(container, onLocalChange, onTabChange) {
    if (!container) return;
    mrpDecisionTabChangeHandler = onTabChange;

    const commitView = async (nextView) => {
      const next = nextView === "workspace" ? "workspace" : "register";
      if (next === "workspace" && selectedDecisionProposalId == null) {
        showToast(
          "Select a proposal from the Decision Register before opening the workspace.",
          "info",
          4200,
        );
        mrpDecisionView = "register";
        const select = container.querySelector("#mrpDecisionViewSelect");
        if (select) select.value = "register";
        container.querySelectorAll("[data-mrp-decision-view]").forEach((btn) => {
          const active = btn.dataset.mrpDecisionView === "register";
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        return;
      }
      if (next === mrpDecisionView) return;
      mrpDecisionView = next;
      if (typeof onLocalChange === "function") await onLocalChange("view");
    };

    container.querySelectorAll("[data-mrp-decision-view]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await commitView(btn.dataset.mrpDecisionView);
      });
    });

    container
      .querySelector("#mrpDecisionViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitView(event.target?.value);
      });

    container
      .querySelector("#mrpDecisionOpenApplicationBtn")
      ?.addEventListener("click", async () => {
        const proposalId = selectedDecisionProposalId;
        if (typeof openApprovedForApplication === "function") {
          await openApprovedForApplication(proposalId, onTabChange);
          return;
        }
        if (typeof setMrpGovernanceTab === "function") {
          setMrpGovernanceTab("approved-for-application");
        }
        if (typeof onTabChange === "function") await onTabChange();
        else if (typeof onLocalChange === "function") await onLocalChange("tab");
      });
  }

  function wireFilterDrawerEvents(container, onLocalChange) {
    if (!container) return;

    container
      .querySelectorAll("[data-mrp-decision-register-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleRegisterFilter(
            input.dataset.mrpDecisionRegisterFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-decision-register-filter-clear]")
      ?.addEventListener("click", async () => {
        clearRegisterFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });

    container
      .querySelectorAll("[data-mrp-decision-line-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleLineFilter(
            input.dataset.mrpDecisionLineFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-decision-line-filter-clear]")
      ?.addEventListener("click", async () => {
        clearLineFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });
  }

  function syncWriteUi() {
    const editable = canEditPolicyActions();
    if (dom.mrpDecisionLineModalSaveBtn) {
      dom.mrpDecisionLineModalSaveBtn.disabled = !editable;
    }
  }

  function handleEscapeKey() {
    if (!dom.mrpDecisionLineModal?.classList.contains("hidden")) {
      closeDecisionModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    syncWriteUi();
    dom.mrpDecisionLineModalCloseBtn?.addEventListener("click", closeDecisionModal);
    dom.mrpDecisionLineModalCancelBtn?.addEventListener(
      "click",
      closeDecisionModal,
    );
    dom.mrpDecisionLineModalSaveBtn?.addEventListener("click", () => {
      void saveDecision();
    });
    dom.mrpDecisionLineModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpDecisionLineModal) closeDecisionModal();
    });
  }

  function emptyStatusMessage() {
    if (mrpDecisionView === "workspace") {
      if (selectedDecisionProposalId == null) {
        return "Select a proposal from the Decision Register to open the workspace.";
      }
      if (
        mrpDecisionLineFilters.decision.includes("PENDING") &&
        mrpDecisionLinesRawRows.length &&
        !mrpDecisionLinesRawRows.some(
          (r) => String(r.decision || "").toUpperCase() === "PENDING",
        )
      ) {
        return "Decision review complete — no pending lines remain. Clear filters to review all lines.";
      }
      return "This proposal has no lines.";
    }
    return "No proposals are awaiting decision.";
  }

  function noMatchMessage() {
    return mrpDecisionView === "workspace"
      ? "No proposal lines match the current search or filters."
      : "No proposals match the current decision filters.";
  }

  return {
    isMrpDecisionsTabActive,
    getMrpDecisionView,
    setMrpDecisionView,
    getSelectedDecisionProposalId,
    activateProposal,
    loadMrpDecisionRows,
    getMrpDecisionFilteredRows,
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
  };
}
