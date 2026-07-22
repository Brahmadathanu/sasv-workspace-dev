/**
 * PPM-C1G — Approved for Application
 *
 * Contract note (generated supabase.ts):
 * - rpc_apply_product_mrp_proposal({
 *     p_proposal_id: number,
 *     p_application_note?: string
 *   })
 *
 * Independent of C1E/C1F selection state.
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
  countActiveMrpFilterFields,
  renderMrpActiveFilterChip,
  renderMrpFilterDrawerPanel,
} from "./costing-suite-mrp-proposal-shared.js";

export const MRP_APPLICATION_VIEWS = [
  { id: "register", label: "Application Register" },
  { id: "workspace", label: "Application Workspace" },
];

const REGISTER_HEADERS = [
  "Proposal",
  "Product",
  "Effective date",
  "Status",
  "Approved lines",
  "Rejected lines",
  "Blocked lines",
  "Application readiness",
  "Approved at",
];

const REGISTER_ALIGNMENTS = [
  "c-left",
  "c-left",
  "c-left",
  "c-left",
  "c-right",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
];

const LINE_HEADERS = [
  "Line",
  "SKU / Pack",
  "Current MRP",
  "Proposed MRP",
  "Mode",
  "Eligibility",
  "Decision",
  "Application outcome",
  "Applied policy ID",
];

const LINE_ALIGNMENTS = [
  "c-right",
  "c-left",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
  "c-left",
  "c-left",
  "c-right",
];

export function createMrpApplicationHandlers(deps) {
  const {
    dom,
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
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
    invalidateMrpPolicyCache,
    onPolicyDataChanged,
    openAppliedHistory,
  } = deps;

  /** @type {"register"|"workspace"} */
  let mrpApplicationView = "register";
  let selectedApplicationProposalId = null;
  let mrpApplicationRegisterRawRows = [];
  /** Default: awaiting application (APPROVED). */
  let mrpApplicationRegisterFilters = {
    workflow: ["AWAITING"],
    reviewSummary: [],
    hasApproved: null,
    hasRejected: null,
    hasBlocked: null,
  };
  /** @type {null|boolean} */
  let mrpApplicationRegisterFiltersOpen = null;
  let mrpApplicationLinesRawRows = [];
  let mrpApplicationLineFilters = {
    outcome: [],
    decision: [],
    eligibility: [],
    mode: [],
  };
  /** @type {null|boolean} */
  let mrpApplicationLineFiltersOpen = null;
  let mrpApplicationHeaderCache = null;
  let mrpApplicationModalReturnFocus = null;
  let mrpApplicationModalSaving = false;

  const fmt = { text, formatOptionalMoney, statusChip };

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

  function isMrpApplicationTabActive() {
    return getMrpGovernanceTab?.() === "approved-for-application";
  }

  function getMrpApplicationView() {
    return mrpApplicationView;
  }

  function setMrpApplicationView(view) {
    mrpApplicationView = view === "workspace" ? "workspace" : "register";
  }

  function getSelectedApplicationProposalId() {
    return selectedApplicationProposalId;
  }

  /**
   * Called from PPM-C1F "Open Approved for Application".
   */
  function activateProposal(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) return;
    selectedApplicationProposalId = id;
    mrpApplicationView = "workspace";
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

  /**
   * Application outcome for a proposal line.
   * Precedence: blocked → rejected → pending → applied → awaiting.
   */
  function getLineApplicationOutcome(row) {
    const eligibility = String(row?.eligibility_status || "")
      .trim()
      .toUpperCase();
    const decision = String(row?.decision || "").trim().toUpperCase();

    if (eligibility === "BLOCKED") return "EXCLUDED_BLOCKED";
    if (decision === "REJECTED") return "EXCLUDED_REJECTED";
    if (decision === "PENDING") return "NOT_COMPLETE";
    if (decision === "APPROVED" && row?.applied_mrp_policy_id != null) {
      return "APPLIED";
    }
    if (decision === "APPROVED") return "AWAITING";
    return "NOT_COMPLETE";
  }

  function formatApplicationOutcome(code) {
    if (code === "AWAITING") return "Awaiting application";
    if (code === "APPLIED") return "Applied";
    if (code === "EXCLUDED_REJECTED") return "Excluded — rejected";
    if (code === "EXCLUDED_BLOCKED") return "Excluded — blocked";
    if (code === "NOT_COMPLETE") return "Not decision-complete";
    return humanizeMrpToken(code);
  }

  function isAwaitingApplyLine(row) {
    return getLineApplicationOutcome(row) === "AWAITING";
  }

  function computeReadiness(header, lines) {
    const status = String(header?.status || "").trim().toUpperCase();
    if (status === "APPLIED") {
      return {
        code: "APPLIED",
        label: "Already applied",
        notes: ["Application completed."],
      };
    }
    if (status !== "APPROVED") {
      return {
        code: "NOT_READY",
        label: "Not ready",
        notes: [`Proposal status is ${formatProposalStatus(status)}.`],
      };
    }

    const notes = [];
    const pending = (lines || []).filter(
      (r) => String(r.decision || "").toUpperCase() === "PENDING",
    ).length;
    const awaiting = (lines || []).filter(isAwaitingApplyLine).length;
    const approvedAlreadyLinked = (lines || []).filter(
      (r) =>
        String(r.decision || "").toUpperCase() === "APPROVED" &&
        r.applied_mrp_policy_id != null,
    ).length;

    if (pending > 0) notes.push(`${pending} pending decision(s) remain.`);
    if (awaiting === 0) notes.push("No approved eligible unapplied lines.");
    if (approvedAlreadyLinked > 0) {
      notes.push(
        `${approvedAlreadyLinked} approved line(s) already have application links.`,
      );
    }

    if (pending === 0 && awaiting > 0) {
      return {
        code: "READY",
        label: "Ready for application",
        notes: [
          "The server will perform final validation and apply all eligible approved lines atomically.",
          ...notes,
        ],
      };
    }

    return {
      code: "NOT_READY",
      label: "Not ready",
      notes: notes.length
        ? notes
        : ["Proposal is not ready for canonical application."],
    };
  }

  function sortRegisterRows(rows) {
    const sorted = [...(rows || [])];
    const workflow = mrpApplicationRegisterFilters.workflow || [];
    const appliedOnly =
      workflow.includes("APPLIED") && !workflow.includes("AWAITING") && !workflow.includes("ALL");

    sorted.sort((a, b) => {
      if (appliedOnly) {
        const aAt = a.applied_at || a.approved_at || a.created_at || "";
        const bAt = b.applied_at || b.approved_at || b.created_at || "";
        const cmp = String(bAt).localeCompare(String(aAt));
        if (cmp) return cmp;
        return compareNullableNumber(b.proposal_id, a.proposal_id);
      }
      // Awaiting application: oldest approved work first (approved_at asc).
      const aAt = a.approved_at || a.submitted_at || a.created_at || "";
      const bAt = b.approved_at || b.submitted_at || b.created_at || "";
      const cmp = String(aAt).localeCompare(String(bAt));
      if (cmp) return cmp;
      return compareNullableNumber(a.proposal_id, b.proposal_id);
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
    const workflow = mrpApplicationRegisterFilters.workflow || [];

    if (workflow.length && !workflow.includes("ALL")) {
      let ok = false;
      for (const token of workflow) {
        if (token === "AWAITING" && status === "APPROVED") ok = true;
        if (token === "APPLIED" && status === "APPLIED") ok = true;
        if (token === status) ok = true;
      }
      if (!ok) return false;
    } else if (!workflow.length) {
      if (status !== "APPROVED") return false;
    }

    if (mrpApplicationRegisterFilters.reviewSummary.length) {
      const summary = String(row.review_summary_status || "")
        .trim()
        .toUpperCase();
      if (!mrpApplicationRegisterFilters.reviewSummary.includes(summary)) {
        return false;
      }
    }

    const flag = (key, countField) => {
      const v = mrpApplicationRegisterFilters[key];
      if (v === true && !(Number(row[countField]) > 0)) return false;
      if (v === false && Number(row[countField]) > 0) return false;
      return true;
    };
    if (!flag("hasApproved", "approved_line_count")) return false;
    if (!flag("hasRejected", "rejected_line_count")) return false;
    if (!flag("hasBlocked", "blocked_line_count")) return false;
    return true;
  }

  function matchesLineFilters(row) {
    if (mrpApplicationLineFilters.outcome.length) {
      const outcome = getLineApplicationOutcome(row);
      if (!mrpApplicationLineFilters.outcome.includes(outcome)) return false;
    }
    if (mrpApplicationLineFilters.decision.length) {
      const v = String(row.decision || "").trim().toUpperCase();
      if (!mrpApplicationLineFilters.decision.includes(v)) return false;
    }
    if (mrpApplicationLineFilters.eligibility.length) {
      const v = String(row.eligibility_status || "").trim().toUpperCase();
      if (!mrpApplicationLineFilters.eligibility.includes(v)) return false;
    }
    if (mrpApplicationLineFilters.mode.length) {
      const v = String(row.proposed_calc_mode || "").trim().toUpperCase();
      if (!mrpApplicationLineFilters.mode.includes(v)) return false;
    }
    return true;
  }

  function getRegisterFilteredRows() {
    return sortRegisterRows(
      mrpApplicationRegisterRawRows.filter(matchesRegisterFilters),
    );
  }

  function getLineFilteredRows() {
    return sortLineRows(
      mrpApplicationLinesRawRows.filter(matchesLineFilters),
    );
  }

  function getMrpApplicationFilteredRows() {
    if (mrpApplicationView === "workspace") {
      if (selectedApplicationProposalId == null) return [];
      return getLineFilteredRows();
    }
    return getRegisterFilteredRows();
  }

  function refreshHeaderCache() {
    if (selectedApplicationProposalId == null) {
      mrpApplicationHeaderCache = null;
      return null;
    }
    mrpApplicationHeaderCache =
      mrpApplicationRegisterRawRows.find(
        (r) => String(r.proposal_id) === String(selectedApplicationProposalId),
      ) || null;
    return mrpApplicationHeaderCache;
  }

  async function loadMrpApplicationRows() {
    const rows = await fetchMrpProposalRegisterRows(costingFrom, fetchAllRows);
    mrpApplicationRegisterRawRows = (rows || []).map(
      enrichMrpProposalRegisterSearch,
    );
    refreshHeaderCache();

    if (mrpApplicationView === "workspace") {
      if (selectedApplicationProposalId == null) {
        mrpApplicationLinesRawRows = [];
        return [];
      }
      if (!mrpApplicationHeaderCache) {
        selectedApplicationProposalId = null;
        mrpApplicationView = "register";
        showToast(
          "The selected proposal is no longer available. Showing the application register.",
          "info",
          4200,
        );
        return getRegisterFilteredRows();
      }

      const status = String(mrpApplicationHeaderCache.status || "")
        .trim()
        .toUpperCase();
      if (status !== "APPROVED" && status !== "APPLIED") {
        showToast(
          `Proposal is ${formatProposalStatus(status)}. Application actions are unavailable.`,
          "info",
          4800,
        );
      }

      const lines = await fetchMrpProposalLines(
        costingFrom,
        fetchAllRows,
        selectedApplicationProposalId,
      );
      mrpApplicationLinesRawRows = (lines || []).map(enrichMrpProposalLineSearch);
      return getLineFilteredRows();
    }

    return getRegisterFilteredRows();
  }

  function collectReviewSummaryOptions() {
    const seen = new Set();
    mrpApplicationRegisterRawRows.forEach((row) => {
      const status = String(row.status || "").toUpperCase();
      if (status !== "APPROVED" && status !== "APPLIED") return;
      const v = String(row.review_summary_status || "").trim().toUpperCase();
      if (v) seen.add(v);
    });
    return [...seen].sort();
  }

  function toggleRegisterFilter(group, value, checked) {
    if (
      group === "hasApproved" ||
      group === "hasRejected" ||
      group === "hasBlocked"
    ) {
      mrpApplicationRegisterFilters[group] = checked ? value === "true" : null;
      return getMrpApplicationFilteredRows();
    }
    if (group === "workflow") {
      const token = String(value || "").trim().toUpperCase();
      if (token === "ALL") {
        mrpApplicationRegisterFilters.workflow = checked ? ["ALL"] : ["AWAITING"];
        return getMrpApplicationFilteredRows();
      }
      const set = new Set(
        (mrpApplicationRegisterFilters.workflow || []).filter((t) => t !== "ALL"),
      );
      if (checked) set.add(token);
      else set.delete(token);
      mrpApplicationRegisterFilters.workflow = set.size ? [...set] : ["AWAITING"];
      return getMrpApplicationFilteredRows();
    }
    if (!Array.isArray(mrpApplicationRegisterFilters[group])) {
      return getMrpApplicationFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    const set = new Set(mrpApplicationRegisterFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpApplicationRegisterFilters[group] = [...set];
    return getMrpApplicationFilteredRows();
  }

  function clearRegisterFilters() {
    mrpApplicationRegisterFilters = {
      workflow: ["AWAITING"],
      reviewSummary: [],
      hasApproved: null,
      hasRejected: null,
      hasBlocked: null,
    };
    return getMrpApplicationFilteredRows();
  }

  function toggleLineFilter(group, value, checked) {
    if (!Array.isArray(mrpApplicationLineFilters[group])) {
      return getMrpApplicationFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    const set = new Set(mrpApplicationLineFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpApplicationLineFilters[group] = [...set];
    return getMrpApplicationFilteredRows();
  }

  function clearLineFilters() {
    mrpApplicationLineFilters = {
      outcome: [],
      decision: [],
      eligibility: [],
      mode: [],
    };
    return getMrpApplicationFilteredRows();
  }

  function renderFilterCheckbox(dataAttr, group, value, label, checked) {
    const safe = String(value).replace(/"/g, "&quot;");
    return `<label class="cp-mrp-filter-item"><input type="checkbox" ${dataAttr}="${group}" value="${safe}" ${checked ? "checked" : ""}/> ${text(label)}</label>`;
  }

  function formatApplicationWorkflowLabel(token) {
    if (token === "AWAITING") return "Awaiting application";
    if (token === "APPLIED") return "Applied";
    if (token === "ALL") return "All (approved + applied)";
    return humanizeMrpToken(token);
  }

  function buildApplicationRegisterFilterChips() {
    const chips = [];
    for (const token of mrpApplicationRegisterFilters.workflow || []) {
      const label = `Workflow: ${formatApplicationWorkflowLabel(token)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-application-register-filter-chip-group",
          group: "workflow",
          valueAttr: "data-mrp-application-register-filter-chip-value",
          value: token,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    for (const status of mrpApplicationRegisterFilters.reviewSummary || []) {
      const label = `Review: ${humanizeMrpToken(status)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-application-register-filter-chip-group",
          group: "reviewSummary",
          valueAttr: "data-mrp-application-register-filter-chip-value",
          value: status,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    const boolChips = [
      ["hasApproved", "Has approved lines"],
      ["hasRejected", "Has rejected lines"],
      ["hasBlocked", "Has blocked lines"],
    ];
    for (const [group, chipLabel] of boolChips) {
      if (mrpApplicationRegisterFilters[group] === true) {
        chips.push(
          renderMrpActiveFilterChip({
            label: chipLabel,
            groupAttr: "data-mrp-application-register-filter-chip-group",
            group,
            valueAttr: "data-mrp-application-register-filter-chip-value",
            value: "true",
            ariaLabel: `Remove ${chipLabel} filter`,
          }),
        );
      }
    }
    return chips.join("");
  }

  function buildApplicationLineFilterChips() {
    const chips = [];
    const pushArray = (group, fieldLabel, formatFn) => {
      for (const value of mrpApplicationLineFilters[group] || []) {
        const label = `${fieldLabel}: ${formatFn(value)}`;
        chips.push(
          renderMrpActiveFilterChip({
            label,
            groupAttr: "data-mrp-application-line-filter-chip-group",
            group,
            valueAttr: "data-mrp-application-line-filter-chip-value",
            value,
            ariaLabel: `Remove ${label} filter`,
          }),
        );
      }
    };
    pushArray("outcome", "Outcome", formatApplicationOutcome);
    pushArray("decision", "Decision", formatMrpDecisionLabel);
    pushArray("eligibility", "Eligibility", formatMrpEligibility);
    pushArray("mode", "Mode", (v) =>
      v === "AUTO" ? "Automatic" : v === "MANUAL" ? "Manual" : humanizeMrpToken(v),
    );
    return chips.join("");
  }

  function renderRegisterFilterPanel() {
    const workflow = mrpApplicationRegisterFilters.workflow || [];
    const reviewOptions = collectReviewSummaryOptions()
      .map((status) =>
        renderFilterCheckbox(
          "data-mrp-application-register-filter",
          "reviewSummary",
          status,
          humanizeMrpToken(status),
          mrpApplicationRegisterFilters.reviewSummary.includes(status),
        ),
      )
      .join("");

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpApplicationRegisterFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Workflow</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-application-register-filter", "workflow", "AWAITING", "Awaiting application", workflow.includes("AWAITING") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-application-register-filter", "workflow", "APPLIED", "Applied", workflow.includes("APPLIED") && !workflow.includes("ALL"))}
            ${renderFilterCheckbox("data-mrp-application-register-filter", "workflow", "ALL", "All (approved + applied)", workflow.includes("ALL"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Line signals</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-application-register-filter", "hasApproved", "true", "Has approved lines", mrpApplicationRegisterFilters.hasApproved === true)}
            ${renderFilterCheckbox("data-mrp-application-register-filter", "hasRejected", "true", "Has rejected lines", mrpApplicationRegisterFilters.hasRejected === true)}
            ${renderFilterCheckbox("data-mrp-application-register-filter", "hasBlocked", "true", "Has blocked lines", mrpApplicationRegisterFilters.hasBlocked === true)}
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

    const activeCount = countActiveMrpFilterFields(mrpApplicationRegisterFilters, [
      "workflow",
      "reviewSummary",
      "hasApproved",
      "hasRejected",
      "hasBlocked",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-application-register-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function renderLineFilterPanel() {
    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpApplicationLineFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Application outcome</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-application-line-filter", "outcome", "AWAITING", "Awaiting application", mrpApplicationLineFilters.outcome.includes("AWAITING"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "outcome", "APPLIED", "Applied", mrpApplicationLineFilters.outcome.includes("APPLIED"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "outcome", "EXCLUDED_REJECTED", "Excluded — rejected", mrpApplicationLineFilters.outcome.includes("EXCLUDED_REJECTED"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "outcome", "EXCLUDED_BLOCKED", "Excluded — blocked", mrpApplicationLineFilters.outcome.includes("EXCLUDED_BLOCKED"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "outcome", "NOT_COMPLETE", "Not decision-complete", mrpApplicationLineFilters.outcome.includes("NOT_COMPLETE"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Decision</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-application-line-filter", "decision", "APPROVED", "Approved", mrpApplicationLineFilters.decision.includes("APPROVED"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "decision", "REJECTED", "Rejected", mrpApplicationLineFilters.decision.includes("REJECTED"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "decision", "PENDING", "Pending", mrpApplicationLineFilters.decision.includes("PENDING"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Eligibility</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-application-line-filter", "eligibility", "ELIGIBLE", "Eligible", mrpApplicationLineFilters.eligibility.includes("ELIGIBLE"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "eligibility", "BLOCKED", "Blocked", mrpApplicationLineFilters.eligibility.includes("BLOCKED"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Mode</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-application-line-filter", "mode", "AUTO", "Automatic", mrpApplicationLineFilters.mode.includes("AUTO"))}
            ${renderFilterCheckbox("data-mrp-application-line-filter", "mode", "MANUAL", "Manual", mrpApplicationLineFilters.mode.includes("MANUAL"))}
          </div>
        </div>
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpApplicationLineFilters, [
      "outcome",
      "decision",
      "eligibility",
      "mode",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-application-line-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function countLinesBy(predicate) {
    return mrpApplicationLinesRawRows.filter(predicate).length;
  }

  function canApplyProposal(header = mrpApplicationHeaderCache) {
    if (!canEditPolicyActions()) return false;
    if (String(header?.status || "").toUpperCase() !== "APPROVED") return false;
    const awaiting = mrpApplicationLinesRawRows.filter(isAwaitingApplyLine).length;
    return awaiting > 0;
  }

  function renderRegisterReadiness(row) {
    const status = String(row.status || "").toUpperCase();
    if (status === "APPLIED") return statusChip("Already applied");
    if (status === "APPROVED") {
      const approved = Number(row.approved_line_count) || 0;
      const pending = Number(row.pending_line_count) || 0;
      if (pending > 0) return text("Not ready — pending decisions");
      if (approved <= 0) return text("Not ready — no approved lines");
      return statusChip("Ready for application");
    }
    return text(formatProposalStatus(status));
  }

  function renderWorkspaceHeaderPanel() {
    const header = mrpApplicationHeaderCache;
    if (!header) {
      return `
        <div class="cp-mrp-governance-empty" role="status" style="margin:8px 0">
          <div class="cp-mrp-governance-empty-title">No proposal selected</div>
          <p class="cp-mrp-governance-empty-body">Open an approved proposal from the Application Register to review readiness and apply approved MRP policies atomically.</p>
        </div>`;
    }

    const status = String(header.status || "").trim().toUpperCase();
    const readiness = computeReadiness(header, mrpApplicationLinesRawRows);
    const total = mrpApplicationLinesRawRows.length || Number(header.total_line_count) || 0;
    const approved =
      countLinesBy((r) => String(r.decision || "").toUpperCase() === "APPROVED") ||
      Number(header.approved_line_count) ||
      0;
    const rejected =
      countLinesBy((r) => String(r.decision || "").toUpperCase() === "REJECTED") ||
      Number(header.rejected_line_count) ||
      0;
    const blocked =
      countLinesBy(
        (r) => String(r.eligibility_status || "").toUpperCase() === "BLOCKED",
      ) || Number(header.blocked_line_count) || 0;
    const pending =
      countLinesBy((r) => String(r.decision || "").toUpperCase() === "PENDING") ||
      Number(header.pending_line_count) ||
      0;
    const alreadyApplied = countLinesBy(
      (r) => getLineApplicationOutcome(r) === "APPLIED",
    );
    const toApply = countLinesBy(isAwaitingApplyLine);

    const applyBtn =
      canApplyProposal(header)
        ? `<button type="button" class="icon-btn icon-btn-primary" id="mrpApplicationApplyBtn" title="Apply Approved MRP Policies" aria-label="Apply Approved MRP Policies">Apply Approved MRP Policies</button>`
        : "";

    const historyLink =
      status === "APPLIED"
        ? `<button type="button" class="icon-btn" id="mrpApplicationOpenHistoryBtn" title="Open Applied Proposal History" aria-label="Open Applied Proposal History">Open Applied Proposal History</button>`
        : "";

    const previewRows = mrpApplicationLinesRawRows
      .filter(isAwaitingApplyLine)
      .slice(0, 12)
      .map(
        (r) => `
        <tr>
          <td>${text(`SKU ${r.sku_id}`)}<div class="cp-muted-text">${text(formatMrpPackLabel(r))}</div></td>
          <td class="c-right">${text(formatMrpIkOkPair(r.current_mrp_ik, r.current_mrp_ok, fmt))}</td>
          <td class="c-right">${text(formatMrpIkOkPair(r.proposed_mrp_ik, r.proposed_mrp_ok, fmt))}</td>
          <td>${text(r.proposed_calc_mode || "--")}</td>
          <td>${formatDate(header.proposed_effective_from)}</td>
          <td class="c-right">${text(r.current_mrp_policy_id || "--")}</td>
        </tr>`,
      )
      .join("");

    return `
      <div class="cp-mrp-proposal-workspace-header" id="mrpApplicationWorkspaceHeader">
        <div class="cp-muted-text" style="margin-bottom:8px;line-height:1.45">
          Application revises canonical SKU MRP for eligible <strong>approved</strong> lines only. Rejected and blocked lines are excluded. The operation is atomic and server-controlled.
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
            <div class="cp-card-label">Readiness</div>
            <div class="cp-card-value">${statusChip(readiness.label)}</div>
            <div class="cp-muted-text">${text(readiness.notes[0] || "")}</div>
          </div>
        </div>
        <div class="cp-summary-strip" style="margin-top:8px">
          <div class="cp-card"><div class="cp-card-label">Total</div><div class="cp-card-value">${text(total)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Approved</div><div class="cp-card-value">${text(approved)}</div></div>
          <div class="cp-card"><div class="cp-card-label">To apply</div><div class="cp-card-value">${text(toApply)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Rejected</div><div class="cp-card-value">${text(rejected)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Blocked</div><div class="cp-card-value">${text(blocked)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Pending</div><div class="cp-card-value">${text(pending)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Already applied</div><div class="cp-card-value">${text(alreadyApplied)}</div></div>
        </div>
        <div class="cp-muted-text" style="margin-top:8px;line-height:1.45">
          ${header.reason ? `Reason: ${text(header.reason)}` : "Reason: --"}
          ${header.approval_reference ? ` · Approval: ${text(header.approval_reference)}` : ""}
          · Reference ${text(formatMrpReferencePack(header))}
          · Derivation ${text(header.derivation_policy_id || "--")}
          ${header.approved_at ? ` · Approved ${formatDateTime(header.approved_at)}${header.approved_by ? ` by ${text(header.approved_by)}` : ""}` : ""}
          ${header.applied_at ? ` · Applied ${formatDateTime(header.applied_at)}${header.applied_by ? ` by ${text(header.applied_by)}` : ""}` : ""}
        </div>
        ${
          readiness.notes.length > 1
            ? `<ul class="cp-muted-text" style="margin:8px 0 0;padding-left:18px;line-height:1.45">${readiness.notes
                .slice(1)
                .map((n) => `<li>${text(n)}</li>`)
                .join("")}</ul>`
            : ""
        }
        ${
          status === "APPLIED"
            ? `<div class="cp-muted-text" style="margin-top:8px"><strong>Application completed</strong>. Reapplication is not available.</div>`
            : ""
        }
        ${
          toApply > 0 && status === "APPROVED"
            ? `<div style="margin-top:10px">
                <div class="cp-card-label" style="margin-bottom:6px">Application preview — approved lines to apply (${text(toApply)})</div>
                <div class="cp-table-wrap"><table>
                  <thead><tr>
                    <th>SKU / Pack</th><th class="c-right">Current</th><th class="c-right">Proposed</th>
                    <th>Mode</th><th>Effective from</th><th class="c-right">Previous policy</th>
                  </tr></thead>
                  <tbody>${previewRows || `<tr><td colspan="6">No awaiting lines.</td></tr>`}</tbody>
                </table></div>
                ${toApply > 12 ? `<div class="cp-muted-text" style="margin-top:4px">Showing first 12 of ${text(toApply)} lines.</div>` : ""}
                <div class="cp-muted-text" style="margin-top:6px">Excluded: ${text(rejected)} rejected · ${text(blocked)} blocked · ${text(pending)} pending</div>
              </div>`
            : ""
        }
        ${
          applyBtn || historyLink
            ? `<div class="cp-mrp-create-toolbar" style="margin-top:8px">${applyBtn}${historyLink}</div>`
            : ""
        }
      </div>`;
  }

  function renderChromeHtml() {
    if (!isMrpApplicationTabActive()) return "";
    const nested = renderNestedSubviewNav({
      options: MRP_APPLICATION_VIEWS,
      activeId: mrpApplicationView,
      dataAttr: "data-mrp-application-view",
      selectId: "mrpApplicationViewSelect",
      selectLabel: "View",
      selectAriaLabel: "Select approved-for-application view",
    });

    if (mrpApplicationView === "workspace") {
      return `
        ${nested}
        ${renderWorkspaceHeaderPanel()}
      `;
    }

    return `${nested}`;
  }

  function renderActiveFilterDrawerPanel() {
    if (!isMrpApplicationTabActive()) return null;
    if (mrpApplicationView === "workspace") {
      if (selectedApplicationProposalId == null) return null;
      return renderLineFilterPanel();
    }
    return renderRegisterFilterPanel();
  }

  function renderRegisterDrawerActions(row) {
    return `<div class="cp-drawer-action-bar"><button type="button" class="icon-btn icon-btn-primary" data-mrp-application-drawer-open="${text(row.proposal_id)}" title="Open application workspace" aria-label="Open application workspace">Open</button></div>`;
  }

  function renderRegisterRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.proposal_number || `Proposal ${row.proposal_id}`)}<div class="cp-muted-text">ID ${text(row.proposal_id)}</div></td>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">Product ${text(row.product_id)}</div></td>
      <td>${formatDate(row.proposed_effective_from)}</td>
      <td>${statusChip(formatProposalStatus(row.status))}</td>
      <td class="c-right">${text(row.approved_line_count ?? "--")}</td>
      <td class="c-right">${text(row.rejected_line_count ?? "--")}</td>
      <td class="c-right">${text(row.blocked_line_count ?? "--")}</td>
      <td>${renderRegisterReadiness(row)}</td>
      <td>${formatDateTime(row.approved_at || row.submitted_at)}</td>
    </tr>`;
  }

  function renderLineRow(row, trAttrs) {
    const outcome = getLineApplicationOutcome(row);
    return `<tr ${trAttrs}>
      <td class="c-right">${text(row.line_number ?? "--")}</td>
      <td>${cpCellPrimary(`SKU ${row.sku_id ?? "--"}`)}<div class="cp-muted-text">${text(formatMrpPackLabel(row))}</div></td>
      <td class="c-right">${text(formatMrpIkOkPair(row.current_mrp_ik, row.current_mrp_ok, fmt))}</td>
      <td class="c-right">${text(formatMrpIkOkPair(row.proposed_mrp_ik, row.proposed_mrp_ok, fmt))}</td>
      <td>${text(row.proposed_calc_mode || "--")}</td>
      <td>${statusChip(formatMrpEligibility(row.eligibility_status))}</td>
      <td>${statusChip(formatMrpDecisionLabel(row.decision))}</td>
      <td>${statusChip(formatApplicationOutcome(outcome))}${outcome === "EXCLUDED_BLOCKED" || outcome === "EXCLUDED_REJECTED" ? `<div class="cp-muted-text">${renderMrpWarningBlockerCell(row, fmt)}</div>` : ""}</td>
      <td class="c-right">${text(row.applied_mrp_policy_id || "--")}</td>
    </tr>`;
  }

  function getTableHeaders() {
    return mrpApplicationView === "workspace" ? LINE_HEADERS : REGISTER_HEADERS;
  }

  function getTableAlignments() {
    return mrpApplicationView === "workspace"
      ? LINE_ALIGNMENTS
      : REGISTER_ALIGNMENTS;
  }

  function renderTableRow(row, trAttrs) {
    if (mrpApplicationView === "workspace") {
      if (selectedApplicationProposalId == null) return null;
      return renderLineRow(row, trAttrs);
    }
    return renderRegisterRow(row, trAttrs);
  }

  function getDrawerConfig(row, preferredTab) {
    if (mrpApplicationView === "workspace" || row?.proposal_line_id != null) {
      return {
        title:
          row.sku_id != null
            ? `SKU ${row.sku_id}`
            : `Line ${row.line_number ?? ""}`,
        subtitle: [
          row.proposal_number,
          formatApplicationOutcome(getLineApplicationOutcome(row)),
        ]
          .filter(Boolean)
          .join(" · "),
        tabs: [
          { id: "line-identity", label: "Identity" },
          { id: "line-values", label: "MRP Values" },
          { id: "line-application", label: "Application" },
        ],
        activeTab: preferredTab || "line-application",
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
    if (row?.proposal_line_id != null || mrpApplicationView === "workspace") {
      if (tabId === "line-values") {
        return detailPanel([
          kvSection("Current / Proposed", [
            ["Current IK / OK", text(formatMrpIkOkPair(row.current_mrp_ik, row.current_mrp_ok, fmt))],
            ["Proposed IK / OK", text(formatMrpIkOkPair(row.proposed_mrp_ik, row.proposed_mrp_ok, fmt))],
            ["Mode", text(row.proposed_calc_mode)],
            ["Calculation status", text(formatMrpCalcStatus(row.calculation_status))],
          ]),
        ]);
      }
      if (tabId === "line-application") {
        const outcome = getLineApplicationOutcome(row);
        return detailPanel([
          kvSection("Application outcome", [
            ["Outcome", text(formatApplicationOutcome(outcome))],
            ["Decision", text(formatMrpDecisionLabel(row.decision))],
            ["Eligibility", text(formatMrpEligibility(row.eligibility_status))],
            ["Applied policy ID", text(row.applied_mrp_policy_id || "--")],
            ["Applied at", formatDateTime(row.applied_at)],
            ["Applied by", text(row.applied_by)],
            ["Warning", text(row.warning_code ? formatMrpWarningCode(row.warning_code) : "--")],
            ["Blocker", text(row.blocker_code ? humanizeMrpToken(row.blocker_code) : "--")],
          ]),
        ]);
      }
      return detailPanel([
        kvSection("Identity", [
          ["Proposal line ID", text(row.proposal_line_id)],
          ["Line number", text(row.line_number)],
          ["SKU ID", text(row.sku_id)],
          ["Pack", text(formatMrpPackLabel(row))],
          ["Pack direction", text(formatMrpPackDirection(row.pack_direction))],
        ]),
      ]);
    }

    if (tabId === "proposal-counts") {
      return detailPanel([
        kvSection("Counts", [
          ["Total", text(row.total_line_count)],
          ["Approved", text(row.approved_line_count)],
          ["Rejected", text(row.rejected_line_count)],
          ["Blocked", text(row.blocked_line_count)],
          ["Pending", text(row.pending_line_count)],
        ]),
      ]);
    }

    if (tabId === "proposal-evidence") {
      return detailPanel([
        kvSection("Decision / application", [
          ["Approved at", formatDateTime(row.approved_at)],
          ["Approved by", text(row.approved_by)],
          ["Applied at", formatDateTime(row.applied_at)],
          ["Applied by", text(row.applied_by)],
          ["Approval reference", text(row.approval_reference || "--")],
          ["Reason", text(row.reason || "--")],
        ]),
      ]);
    }

    return (
      renderRegisterDrawerActions(row) +
      detailPanel([
        kvSection("Proposal", [
          ["Proposal", text(row.proposal_number)],
          ["Status", text(formatProposalStatus(row.status))],
          ["Effective from", formatDate(row.proposed_effective_from)],
          ["Product", text(row.product_name)],
          ["Reference Pack", text(formatMrpReferencePack(row))],
          ["Derivation policy", text(row.derivation_policy_id)],
        ]),
      ])
    );
  }

  async function openApplicationWorkspace(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) {
      showToast("Invalid proposal selection.", "error");
      return;
    }
    selectedApplicationProposalId = id;
    mrpApplicationView = "workspace";
    if (typeof reloadRows === "function") await reloadRows();
  }

  // ---- Apply modal -------------------------------------------------------

  function setApplyError(message) {
    if (!dom.mrpApplicationApplyError) return;
    dom.mrpApplicationApplyError.hidden = !message;
    dom.mrpApplicationApplyError.textContent = message || "";
  }

  function openApplyModal() {
    if (!requireEditAccess("apply approved MRP policies")) return;
    const header = mrpApplicationHeaderCache;
    if (!canApplyProposal(header)) {
      showToast(
        "This proposal is not ready for canonical application.",
        "error",
      );
      return;
    }

    mrpApplicationModalReturnFocus = document.activeElement;
    setApplyError("");

    const toApply = mrpApplicationLinesRawRows.filter(isAwaitingApplyLine).length;
    const rejected = countLinesBy(
      (r) => getLineApplicationOutcome(r) === "EXCLUDED_REJECTED",
    );
    const blocked = countLinesBy(
      (r) => getLineApplicationOutcome(r) === "EXCLUDED_BLOCKED",
    );

    if (dom.mrpApplicationApplyIdentity) {
      dom.mrpApplicationApplyIdentity.innerHTML = `
        <div class="cp-preview-row"><span>Proposal</span><span class="cp-preview-value">${text(header.proposal_number || header.proposal_id)}</span></div>
        <div class="cp-preview-row"><span>Product</span><span class="cp-preview-value">${text(header.product_name)}</span></div>
        <div class="cp-preview-row"><span>Effective date</span><span class="cp-preview-value">${formatDate(header.proposed_effective_from)}</span></div>
        <div class="cp-preview-row"><span>Approved lines to apply</span><span class="cp-preview-value">${text(toApply)}</span></div>
        <div class="cp-preview-row"><span>Rejected lines excluded</span><span class="cp-preview-value">${text(rejected)}</span></div>
        <div class="cp-preview-row"><span>Blocked lines excluded</span><span class="cp-preview-value">${text(blocked)}</span></div>
      `;
    }
    if (dom.mrpApplicationApplyNote) dom.mrpApplicationApplyNote.value = "";

    dom.mrpApplicationApplyModal?.classList.remove("hidden");
    dom.mrpApplicationApplyModal?.setAttribute("aria-hidden", "false");
    dom.mrpApplicationApplyNote?.focus();
  }

  function closeApplyModal() {
    dom.mrpApplicationApplyModal?.classList.add("hidden");
    dom.mrpApplicationApplyModal?.setAttribute("aria-hidden", "true");
    setApplyError("");
    mrpApplicationModalSaving = false;
    if (mrpApplicationModalReturnFocus?.focus) {
      try {
        mrpApplicationModalReturnFocus.focus();
      } catch (_) {
        /* ignore */
      }
    }
    mrpApplicationModalReturnFocus = null;
  }

  async function saveApplyProposal() {
    if (!requireEditAccess("apply approved MRP policies")) return;
    if (mrpApplicationModalSaving) return;
    const header = mrpApplicationHeaderCache;
    if (!canApplyProposal(header)) {
      setApplyError("This proposal is no longer ready for application.");
      return;
    }

    const note = String(dom.mrpApplicationApplyNote?.value || "").trim();
    mrpApplicationModalSaving = true;
    if (dom.mrpApplicationApplySaveBtn) {
      dom.mrpApplicationApplySaveBtn.disabled = true;
    }
    setLoadingMask(true, "Applying approved MRP policies...");
    setApplyError("");

    const skuIdsToInvalidate = [
      ...new Set(
        mrpApplicationLinesRawRows
          .filter(isAwaitingApplyLine)
          .map((r) => r.sku_id)
          .filter((id) => id != null),
      ),
    ];

    try {
      /** @type {Record<string, unknown>} */
      const payload = {
        p_proposal_id: Number(header.proposal_id),
      };
      if (note) payload.p_application_note = note;

      const { data, error } = await costingRpc(
        "rpc_apply_product_mrp_proposal",
        payload,
      );
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      closeApplyModal();
      showToast(
        result?.proposal_number
          ? `Proposal ${result.proposal_number} applied to canonical MRP.`
          : "Approved MRP policies applied atomically.",
        "success",
      );

      skuIdsToInvalidate.forEach((skuId) => {
        if (typeof invalidateMrpPolicyCache === "function") {
          invalidateMrpPolicyCache(skuId);
        }
      });

      if (typeof onPolicyDataChanged === "function") {
        await onPolicyDataChanged({
          drawerTab: "mrp-policy",
          productId: header.product_id,
          skuId: skuIdsToInvalidate[0] ?? null,
        });
      } else if (typeof reloadRows === "function") {
        await reloadRows();
      }
    } catch (err) {
      handleError("Failed to apply Product MRP Proposal", err);
      const msg = err?.message || "Application failed.";
      setApplyError(
        `${msg} No partial application was retained. The proposal and canonical MRP remain unchanged unless the server reports otherwise.`,
      );
      // Reload in case server mutated unexpectedly (should not on rollback).
      try {
        if (typeof reloadRows === "function") await reloadRows();
      } catch (_) {
        /* ignore secondary reload failure */
      }
    } finally {
      mrpApplicationModalSaving = false;
      setLoadingMask(false);
      syncWriteUi();
    }
  }

  function wireTableActions(_tableBody) {
    // Row actions live in the detail drawer (see wireDrawerActions).
  }

  function wireDrawerActions(tabId, row) {
    if (!row || tabId !== "proposal-summary") return;
    document
      .querySelector("[data-mrp-application-drawer-open]")
      ?.addEventListener("click", () => {
        void openApplicationWorkspace(row.proposal_id);
      });
  }

  function wireChromeEvents(container, onLocalChange, onTabChange) {
    if (!container) return;

    const commitView = async (nextView) => {
      const next = nextView === "workspace" ? "workspace" : "register";
      if (next === "workspace" && selectedApplicationProposalId == null) {
        showToast(
          "Select a proposal from the Application Register before opening the workspace.",
          "info",
          4200,
        );
        mrpApplicationView = "register";
        const select = container.querySelector("#mrpApplicationViewSelect");
        if (select) select.value = "register";
        container
          .querySelectorAll("[data-mrp-application-view]")
          .forEach((btn) => {
            const active = btn.dataset.mrpApplicationView === "register";
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
          });
        return;
      }
      if (next === mrpApplicationView) return;
      mrpApplicationView = next;
      if (typeof onLocalChange === "function") await onLocalChange("view");
    };

    container.querySelectorAll("[data-mrp-application-view]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await commitView(btn.dataset.mrpApplicationView);
      });
    });

    container
      .querySelector("#mrpApplicationViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitView(event.target?.value);
      });

    container
      .querySelector("#mrpApplicationApplyBtn")
      ?.addEventListener("click", () => {
        openApplyModal();
      });

    container
      .querySelector("#mrpApplicationOpenHistoryBtn")
      ?.addEventListener("click", async () => {
        const proposalId = selectedApplicationProposalId;
        if (typeof openAppliedHistory === "function") {
          await openAppliedHistory(proposalId, onTabChange);
          return;
        }
        if (typeof setMrpGovernanceTab === "function") {
          setMrpGovernanceTab("applied-proposal-history");
        }
        if (typeof onTabChange === "function") await onTabChange();
        else if (typeof onLocalChange === "function") await onLocalChange("tab");
      });
  }

  function wireFilterDrawerEvents(container, onLocalChange) {
    if (!container) return;

    container
      .querySelectorAll("[data-mrp-application-register-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleRegisterFilter(
            input.dataset.mrpApplicationRegisterFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-application-register-filter-clear]")
      ?.addEventListener("click", async () => {
        clearRegisterFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });

    container
      .querySelectorAll("[data-mrp-application-line-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleLineFilter(
            input.dataset.mrpApplicationLineFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-application-line-filter-clear]")
      ?.addEventListener("click", async () => {
        clearLineFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });
  }

  function syncWriteUi() {
    const editable = canEditPolicyActions();
    if (dom.mrpApplicationApplySaveBtn) {
      dom.mrpApplicationApplySaveBtn.disabled = !editable;
    }
  }

  function handleEscapeKey() {
    if (!dom.mrpApplicationApplyModal?.classList.contains("hidden")) {
      closeApplyModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    syncWriteUi();
    dom.mrpApplicationApplyCloseBtn?.addEventListener("click", closeApplyModal);
    dom.mrpApplicationApplyCancelBtn?.addEventListener("click", closeApplyModal);
    dom.mrpApplicationApplySaveBtn?.addEventListener("click", () => {
      void saveApplyProposal();
    });
    dom.mrpApplicationApplyModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpApplicationApplyModal) closeApplyModal();
    });
  }

  function emptyStatusMessage() {
    if (mrpApplicationView === "workspace") {
      if (selectedApplicationProposalId == null) {
        return "Select an approved proposal from the Application Register to open the workspace.";
      }
      return "This proposal has no lines.";
    }
    return "No proposals are awaiting canonical MRP application.";
  }

  function noMatchMessage() {
    return mrpApplicationView === "workspace"
      ? "No proposal lines match the current search or filters."
      : "No proposals match the current application filters.";
  }

  return {
    isMrpApplicationTabActive,
    getMrpApplicationView,
    setMrpApplicationView,
    getSelectedApplicationProposalId,
    activateProposal,
    loadMrpApplicationRows,
    getMrpApplicationFilteredRows,
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
