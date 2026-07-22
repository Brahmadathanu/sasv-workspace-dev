/**
 * PPM-C1G.1 — Applied Proposal History (read-only)
 *
 * Trace chain:
 *   Proposal → Proposal Line → applied_mrp_policy_id
 *   → v_sku_mrp_policy_history.policy_id → previous_policy_id
 *
 * No write RPCs. Independent selectedAppliedProposalId.
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
  humanizeMrpToken,
  enrichMrpProposalRegisterSearch,
  enrichMrpProposalLineSearch,
  fetchMrpProposalRegisterRows,
  fetchMrpProposalLines,
  countActiveMrpFilterFields,
  renderMrpActiveFilterChip,
  renderMrpFilterDrawerPanel,
} from "./costing-suite-mrp-proposal-shared.js";

export const MRP_APPLIED_HISTORY_VIEWS = [
  { id: "register", label: "Applied Register" },
  { id: "workspace", label: "Trace Workspace" },
];

const POLICY_HISTORY_SELECT = `
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
  lifecycle_label,
  status,
  effective_from,
  effective_to,
  reason,
  approval_reference,
  source_type,
  source_quality,
  source_snapshot,
  previous_policy_id,
  created_at,
  created_by,
  closed_at,
  closed_by
`;

const POLICY_ID_CHUNK = 150;

const REGISTER_HEADERS = [
  "Proposal",
  "Product",
  "Effective date",
  "Applied lines",
  "Rejected lines",
  "Blocked lines",
  "Applied at",
  "Applied by",
  "Application note",
  "Trace status",
];

const REGISTER_ALIGNMENTS = [
  "c-left",
  "c-left",
  "c-left",
  "c-right",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
  "c-left",
  "c-left",
];

const LINE_HEADERS = [
  "Line",
  "SKU / Pack",
  "Decision",
  "Eligibility",
  "Proposed IK / OK",
  "Proposed mode",
  "Application outcome",
  "Applied policy ID",
  "Canonical IK / OK",
  "Canonical mode",
  "Effective period",
  "Previous policy ID",
  "Trace status",
];

const LINE_ALIGNMENTS = [
  "c-right",
  "c-left",
  "c-left",
  "c-left",
  "c-right",
  "c-left",
  "c-left",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
  "c-right",
  "c-left",
];

export function createMrpAppliedHistoryHandlers(deps) {
  const {
    costingFrom,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatPercent,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    formatNumber,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    reloadRows,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav,
  } = deps;

  /** @type {"register"|"workspace"} */
  let mrpAppliedHistoryView = "register";
  let selectedAppliedProposalId = null;
  let mrpAppliedRegisterRawRows = [];
  let mrpAppliedRegisterFilters = {
    traceStatus: [],
    hasRejected: null,
    hasBlocked: null,
  };
  /** @type {null|boolean} */
  let mrpAppliedRegisterFiltersOpen = null;
  let mrpAppliedLinesRawRows = [];
  let mrpAppliedLineFilters = {
    outcome: [],
    decision: [],
    eligibility: [],
    calcMode: [],
    traceStatus: [],
  };
  /** @type {null|boolean} */
  let mrpAppliedLineFiltersOpen = null;
  let mrpAppliedHeaderCache = null;
  /** @type {Map<string, object>} policy_id → history row */
  let canonicalPolicyById = new Map();
  let mrpAppliedLoadError = null;

  const fmt = { text, formatOptionalMoney, statusChip };

  function isMrpAppliedHistoryTabActive() {
    return getMrpGovernanceTab?.() === "applied-proposal-history";
  }

  function getMrpAppliedHistoryView() {
    return mrpAppliedHistoryView;
  }

  function setMrpAppliedHistoryView(view) {
    mrpAppliedHistoryView = view === "workspace" ? "workspace" : "register";
  }

  function getSelectedAppliedProposalId() {
    return selectedAppliedProposalId;
  }

  function activateProposal(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) return;
    selectedAppliedProposalId = id;
    mrpAppliedHistoryView = "workspace";
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

  function nearlyEqualMoney(a, b) {
    const an = a == null || a === "" ? null : Number(a);
    const bn = b == null || b === "" ? null : Number(b);
    if (an === null && bn === null) return true;
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;
    return Math.abs(an - bn) < 0.000001;
  }

  function formatOkPct(ratio) {
    if (ratio === null || ratio === undefined || ratio === "") return "--";
    const n = Number(ratio);
    if (!Number.isFinite(n)) return "--";
    return formatPercent(n * 100);
  }

  function formatSourceType(sourceType) {
    const raw = String(sourceType || "").trim().toUpperCase();
    if (raw === "PROPOSAL_APPLICATION") return "Proposal application";
    return humanizeMrpToken(raw);
  }

  function formatEffectivePeriod(row) {
    const from = formatDate(row?.effective_from);
    const to = row?.effective_to ? formatDate(row.effective_to) : "Open";
    return `${from} → ${to}`;
  }

  function moneyDelta(from, to) {
    const a = Number(from);
    const b = Number(to);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "--";
    const d = b - a;
    const sign = d > 0 ? "+" : "";
    return `${sign}${formatOptionalMoney(d)}`;
  }

  function pctChange(from, to) {
    const a = Number(from);
    const b = Number(to);
    if (!Number.isFinite(a) || a === 0 || !Number.isFinite(b)) return "--";
    const pct = ((b - a) / a) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${formatNumber(pct)}%`;
  }

  /**
   * Parse source_snapshot safely and extract recognizable proposal-application keys.
   */
  function summarizeSourceSnapshot(snapshot) {
    if (snapshot == null || snapshot === "") {
      return { rows: [], technical: null };
    }
    let parsed = snapshot;
    if (typeof snapshot === "string") {
      try {
        parsed = JSON.parse(snapshot);
      } catch {
        return {
          rows: [["Evidence", "Technical text available"]],
          technical: String(snapshot).slice(0, 1200),
        };
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        rows: [["Evidence", "Technical evidence available"]],
        technical: JSON.stringify(parsed),
      };
    }

    const candidates = [
      ["proposal_id", "Proposal ID"],
      ["proposalId", "Proposal ID"],
      ["proposal_number", "Proposal number"],
      ["proposalNumber", "Proposal number"],
      ["proposal_line_id", "Proposal line ID"],
      ["proposalLineId", "Proposal line ID"],
      ["derivation_policy_id", "Derivation policy ID"],
      ["derivationPolicyId", "Derivation policy ID"],
      ["reference_sku_id", "Reference SKU ID"],
      ["referenceSkuId", "Reference SKU ID"],
      ["reference_pack_sku_id", "Reference SKU ID"],
      ["proposed_effective_from", "Proposed effective date"],
      ["proposedEffectiveFrom", "Proposed effective date"],
      ["applied_at", "Application timestamp"],
      ["appliedAt", "Application timestamp"],
      ["applied_by", "Application actor"],
      ["appliedBy", "Application actor"],
      ["application_note", "Application note"],
      ["applicationNote", "Application note"],
    ];

    const rows = [];
    const seenLabels = new Set();
    for (const [key, label] of candidates) {
      if (parsed[key] == null || parsed[key] === "") continue;
      if (seenLabels.has(label)) continue;
      seenLabels.add(label);
      rows.push([label, text(parsed[key])]);
    }

    return {
      rows,
      technical: JSON.stringify(parsed, null, 2),
      keys: Object.keys(parsed),
    };
  }

  function getCanonical(policyId) {
    if (policyId == null) return null;
    return canonicalPolicyById.get(String(policyId)) || null;
  }

  /**
   * Line-level application/trace outcome for presentation.
   */
  function getLineTraceMeta(row) {
    const decision = String(row?.decision || "").trim().toUpperCase();
    const eligibility = String(row?.eligibility_status || "")
      .trim()
      .toUpperCase();
    const appliedId = row?.applied_mrp_policy_id;
    const hasLink = appliedId != null;
    const canonical = hasLink ? getCanonical(appliedId) : null;
    const abnormalities = [];

    if (
      (decision === "REJECTED" || eligibility === "BLOCKED") &&
      hasLink
    ) {
      abnormalities.push(
        decision === "REJECTED"
          ? "Rejected line has an applied policy link."
          : "Blocked line has an applied policy link.",
      );
      return {
        outcome: "TRACE_ABNORMALITY",
        lineTrace: "ATTENTION",
        abnormalities,
        canonical,
      };
    }

    if (eligibility === "BLOCKED" && !hasLink) {
      return {
        outcome: "EXCLUDED_BLOCKED",
        lineTrace: "COMPLETE",
        abnormalities,
        canonical: null,
      };
    }
    if (decision === "REJECTED" && !hasLink) {
      return {
        outcome: "EXCLUDED_REJECTED",
        lineTrace: "COMPLETE",
        abnormalities,
        canonical: null,
      };
    }

    if (decision === "APPROVED") {
      if (!hasLink) {
        abnormalities.push("Approved line is missing applied_mrp_policy_id.");
        return {
          outcome: "APPROVED_NOT_LINKED",
          lineTrace: "ATTENTION",
          abnormalities,
          canonical: null,
        };
      }
      if (!canonical) {
        abnormalities.push(
          `Applied policy ID ${appliedId} was not found in canonical history.`,
        );
        return {
          outcome: "LINK_UNRESOLVED",
          lineTrace: "ATTENTION",
          abnormalities,
          canonical: null,
        };
      }

      const source = String(canonical.source_type || "").trim().toUpperCase();
      if (source && source !== "PROPOSAL_APPLICATION") {
        abnormalities.push(
          `Canonical source is ${formatSourceType(source)} (expected Proposal application).`,
        );
      }
      if (
        !nearlyEqualMoney(row.proposed_mrp_ik, canonical.mrp_ik) ||
        !nearlyEqualMoney(row.proposed_mrp_ok, canonical.mrp_ok)
      ) {
        abnormalities.push(
          "Proposal proposed MRP and canonical MRP values differ.",
        );
      }
      if (
        canonical.previous_policy_id != null &&
        !getCanonical(canonical.previous_policy_id)
      ) {
        abnormalities.push(
          `Previous policy ID ${canonical.previous_policy_id} is unresolved.`,
        );
      }

      return {
        outcome: "APPLIED",
        lineTrace: abnormalities.length ? "ATTENTION" : "COMPLETE",
        abnormalities,
        canonical,
      };
    }

    if (decision === "PENDING") {
      abnormalities.push("Pending decision on an APPLIED proposal.");
      return {
        outcome: "NOT_COMPLETE",
        lineTrace: "ATTENTION",
        abnormalities,
        canonical: null,
      };
    }

    return {
      outcome: "NOT_COMPLETE",
      lineTrace: "ATTENTION",
      abnormalities: ["Unexpected line decision state."],
      canonical: null,
    };
  }

  function formatOutcome(code) {
    if (code === "APPLIED") return "Applied";
    if (code === "EXCLUDED_REJECTED") return "Excluded — rejected";
    if (code === "EXCLUDED_BLOCKED") return "Excluded — blocked";
    if (code === "APPROVED_NOT_LINKED") return "Approved but not linked";
    if (code === "LINK_UNRESOLVED") return "Applied link unresolved";
    if (code === "TRACE_ABNORMALITY") return "Trace abnormality";
    if (code === "NOT_COMPLETE") return "Not decision-complete";
    return humanizeMrpToken(code);
  }

  function formatTraceStatus(code) {
    if (code === "COMPLETE") return "Complete";
    if (code === "ATTENTION") return "Attention required";
    return humanizeMrpToken(code);
  }

  function computeProposalTraceStatus(header, lines) {
    const status = String(header?.status || "").toUpperCase();
    if (status !== "APPLIED") {
      return {
        code: "ATTENTION",
        label: "Attention required",
        notes: [`Proposal status is ${formatMrpProposalStatusLabel(status, { decisionContext: true })}.`],
      };
    }
    const notes = [];
    let attention = false;
    (lines || []).forEach((row) => {
      const meta = getLineTraceMeta(row);
      if (meta.lineTrace === "ATTENTION") {
        attention = true;
        meta.abnormalities.forEach((n) => notes.push(n));
      }
    });
    if (attention) {
      return {
        code: "ATTENTION",
        label: "Attention required",
        notes: [...new Set(notes)].slice(0, 12),
      };
    }
    return {
      code: "COMPLETE",
      label: "Complete",
      notes: ["All approved lines link to resolved proposal-application canonical policies."],
    };
  }

  async function fetchPoliciesByIds(policyIds) {
    const unique = [
      ...new Set(
        (policyIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    if (!unique.length) return [];

    const all = [];
    for (let i = 0; i < unique.length; i += POLICY_ID_CHUNK) {
      const chunk = unique.slice(i, i + POLICY_ID_CHUNK);
      const rows = await fetchAllRows(
        () =>
          costingFrom("v_sku_mrp_policy_history")
            .select(POLICY_HISTORY_SELECT)
            .in("policy_id", chunk),
        1000,
      );
      all.push(...(rows || []));
    }
    return all;
  }

  function mergePoliciesIntoMap(rows) {
    (rows || []).forEach((row) => {
      if (row?.policy_id == null) return;
      const key = String(row.policy_id);
      // First win; duplicate match is an abnormality detected later if needed.
      if (!canonicalPolicyById.has(key)) {
        canonicalPolicyById.set(key, row);
      }
    });
  }

  function sortRegisterRows(rows) {
    const sorted = [...(rows || [])];
    sorted.sort((a, b) => {
      const aAt = a.applied_at || a.approved_at || a.created_at || "";
      const bAt = b.applied_at || b.approved_at || b.created_at || "";
      const cmp = String(bAt).localeCompare(String(aAt));
      if (cmp) return cmp;
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
    // Register is already APPLIED-scoped; optional filters only.
    if (mrpAppliedRegisterFilters.hasRejected === true) {
      if (!(Number(row.rejected_line_count) > 0)) return false;
    }
    if (mrpAppliedRegisterFilters.hasBlocked === true) {
      if (!(Number(row.blocked_line_count) > 0)) return false;
    }
    // Trace status at register level is approximate from counts only (no per-row line fetch).
    // Full trace status is computed in workspace. Register filter for Complete/Attention
    // uses pending-like abnormal signals if available — otherwise allow all when selected.
    if (mrpAppliedRegisterFilters.traceStatus.length) {
      // Without loaded lines we cannot certify Complete. Keep rows if filter empty; if set,
      // do not exclude in register (document: workspace owns certainties).
      // Soft: no exclusion at register.
    }
    return true;
  }

  function matchesLineFilters(row) {
    const meta = getLineTraceMeta(row);
    if (mrpAppliedLineFilters.outcome.length) {
      if (!mrpAppliedLineFilters.outcome.includes(meta.outcome)) return false;
    }
    if (mrpAppliedLineFilters.decision.length) {
      const v = String(row.decision || "").trim().toUpperCase();
      if (!mrpAppliedLineFilters.decision.includes(v)) return false;
    }
    if (mrpAppliedLineFilters.eligibility.length) {
      const v = String(row.eligibility_status || "").trim().toUpperCase();
      if (!mrpAppliedLineFilters.eligibility.includes(v)) return false;
    }
    if (mrpAppliedLineFilters.calcMode.length) {
      const mode = String(
        meta.canonical?.calc_mode || row.proposed_calc_mode || "",
      )
        .trim()
        .toUpperCase();
      if (!mrpAppliedLineFilters.calcMode.includes(mode)) return false;
    }
    if (mrpAppliedLineFilters.traceStatus.length) {
      if (!mrpAppliedLineFilters.traceStatus.includes(meta.lineTrace)) {
        return false;
      }
    }
    return true;
  }

  function getRegisterFilteredRows() {
    return sortRegisterRows(
      mrpAppliedRegisterRawRows.filter(matchesRegisterFilters),
    );
  }

  function getLineFilteredRows() {
    return sortLineRows(mrpAppliedLinesRawRows.filter(matchesLineFilters));
  }

  function getMrpAppliedHistoryFilteredRows() {
    if (mrpAppliedHistoryView === "workspace") {
      if (selectedAppliedProposalId == null) return [];
      return getLineFilteredRows();
    }
    return getRegisterFilteredRows();
  }

  function refreshHeaderCache() {
    if (selectedAppliedProposalId == null) {
      mrpAppliedHeaderCache = null;
      return null;
    }
    mrpAppliedHeaderCache =
      mrpAppliedRegisterRawRows.find(
        (r) => String(r.proposal_id) === String(selectedAppliedProposalId),
      ) || null;
    return mrpAppliedHeaderCache;
  }

  async function loadCanonicalTraceForLines(lines) {
    canonicalPolicyById = new Map();
    const appliedIds = (lines || [])
      .map((r) => r.applied_mrp_policy_id)
      .filter((id) => id != null);

    const primary = await fetchPoliciesByIds(appliedIds);
    mergePoliciesIntoMap(primary);

    const prevIds = [];
    canonicalPolicyById.forEach((row) => {
      if (row.previous_policy_id != null) {
        if (!canonicalPolicyById.has(String(row.previous_policy_id))) {
          prevIds.push(row.previous_policy_id);
        }
      }
    });
    if (prevIds.length) {
      const predecessors = await fetchPoliciesByIds(prevIds);
      mergePoliciesIntoMap(predecessors);
    }
  }

  async function loadMrpAppliedHistoryRows() {
    mrpAppliedLoadError = null;
    try {
      const rows = await fetchMrpProposalRegisterRows(costingFrom, fetchAllRows);
      mrpAppliedRegisterRawRows = (rows || [])
        .filter((r) => String(r.status || "").toUpperCase() === "APPLIED")
        .map(enrichMrpProposalRegisterSearch);
      refreshHeaderCache();

      if (mrpAppliedHistoryView === "workspace") {
        if (selectedAppliedProposalId == null) {
          mrpAppliedLinesRawRows = [];
          canonicalPolicyById = new Map();
          return [];
        }
        if (!mrpAppliedHeaderCache) {
          selectedAppliedProposalId = null;
          mrpAppliedHistoryView = "register";
          showToast(
            "The selected proposal is no longer available. Showing the applied register.",
            "info",
            4200,
          );
          return getRegisterFilteredRows();
        }
        if (String(mrpAppliedHeaderCache.status || "").toUpperCase() !== "APPLIED") {
          const status = mrpAppliedHeaderCache.status;
          selectedAppliedProposalId = null;
          mrpAppliedHistoryView = "register";
          mrpAppliedLinesRawRows = [];
          canonicalPolicyById = new Map();
          showToast(
            `Proposal is ${formatMrpProposalStatusLabel(status, { decisionContext: true })} — not applied history.`,
            "info",
            4800,
          );
          return getRegisterFilteredRows();
        }

        setLoadingMask?.(true, "Loading applied proposal trace...");
        const lines = await fetchMrpProposalLines(
          costingFrom,
          fetchAllRows,
          selectedAppliedProposalId,
        );
        mrpAppliedLinesRawRows = (lines || []).map((row) => {
          const enriched = enrichMrpProposalLineSearch(row);
          return {
            ...enriched,
            __search_blob: [
              enriched.__search_blob,
              row.applied_mrp_policy_id,
              row.decision_reason,
            ]
              .filter(Boolean)
              .join(" "),
          };
        });
        await loadCanonicalTraceForLines(mrpAppliedLinesRawRows);
        return getLineFilteredRows();
      }

      return getRegisterFilteredRows();
    } catch (err) {
      mrpAppliedLoadError = err;
      handleError("Failed to load Applied Proposal History", err);
      throw err;
    } finally {
      setLoadingMask?.(false);
    }
  }

  function toggleRegisterFilter(group, value, checked) {
    if (group === "hasRejected" || group === "hasBlocked") {
      mrpAppliedRegisterFilters[group] = checked ? value === "true" : null;
      return getMrpAppliedHistoryFilteredRows();
    }
    if (!Array.isArray(mrpAppliedRegisterFilters[group])) {
      return getMrpAppliedHistoryFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    const set = new Set(mrpAppliedRegisterFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpAppliedRegisterFilters[group] = [...set];
    return getMrpAppliedHistoryFilteredRows();
  }

  function clearRegisterFilters() {
    mrpAppliedRegisterFilters = {
      traceStatus: [],
      hasRejected: null,
      hasBlocked: null,
    };
    return getMrpAppliedHistoryFilteredRows();
  }

  function toggleLineFilter(group, value, checked) {
    if (!Array.isArray(mrpAppliedLineFilters[group])) {
      return getMrpAppliedHistoryFilteredRows();
    }
    const normalized = String(value || "").trim().toUpperCase();
    const set = new Set(mrpAppliedLineFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    mrpAppliedLineFilters[group] = [...set];
    return getMrpAppliedHistoryFilteredRows();
  }

  function clearLineFilters() {
    mrpAppliedLineFilters = {
      outcome: [],
      decision: [],
      eligibility: [],
      calcMode: [],
      traceStatus: [],
    };
    return getMrpAppliedHistoryFilteredRows();
  }

  function renderFilterCheckbox(dataAttr, group, value, label, checked) {
    const safe = String(value).replace(/"/g, "&quot;");
    return `<label class="cp-mrp-filter-item"><input type="checkbox" ${dataAttr}="${group}" value="${safe}" ${checked ? "checked" : ""}/> ${text(label)}</label>`;
  }

  function buildAppliedRegisterFilterChips() {
    const chips = [];
    if (mrpAppliedRegisterFilters.hasRejected === true) {
      chips.push(
        renderMrpActiveFilterChip({
          label: "Has rejected lines",
          groupAttr: "data-mrp-applied-register-filter-chip-group",
          group: "hasRejected",
          valueAttr: "data-mrp-applied-register-filter-chip-value",
          value: "true",
          ariaLabel: "Remove Has rejected lines filter",
        }),
      );
    }
    if (mrpAppliedRegisterFilters.hasBlocked === true) {
      chips.push(
        renderMrpActiveFilterChip({
          label: "Has blocked lines",
          groupAttr: "data-mrp-applied-register-filter-chip-group",
          group: "hasBlocked",
          valueAttr: "data-mrp-applied-register-filter-chip-value",
          value: "true",
          ariaLabel: "Remove Has blocked lines filter",
        }),
      );
    }
    for (const status of mrpAppliedRegisterFilters.traceStatus || []) {
      const label = `Trace status: ${formatTraceStatus(status)}`;
      chips.push(
        renderMrpActiveFilterChip({
          label,
          groupAttr: "data-mrp-applied-register-filter-chip-group",
          group: "traceStatus",
          valueAttr: "data-mrp-applied-register-filter-chip-value",
          value: status,
          ariaLabel: `Remove ${label} filter`,
        }),
      );
    }
    return chips.join("");
  }

  function buildAppliedLineFilterChips() {
    const chips = [];
    const pushArray = (group, fieldLabel, formatFn) => {
      for (const value of mrpAppliedLineFilters[group] || []) {
        const label = `${fieldLabel}: ${formatFn(value)}`;
        chips.push(
          renderMrpActiveFilterChip({
            label,
            groupAttr: "data-mrp-applied-line-filter-chip-group",
            group,
            valueAttr: "data-mrp-applied-line-filter-chip-value",
            value,
            ariaLabel: `Remove ${label} filter`,
          }),
        );
      }
    };
    pushArray("outcome", "Outcome", formatOutcome);
    pushArray("decision", "Decision", formatMrpDecisionLabel);
    pushArray("eligibility", "Eligibility", formatMrpEligibility);
    pushArray("calcMode", "Mode", (v) =>
      v === "AUTO" ? "Automatic" : v === "MANUAL" ? "Manual" : humanizeMrpToken(v),
    );
    pushArray("traceStatus", "Trace status", formatTraceStatus);
    return chips.join("");
  }

  function renderRegisterFilterPanel() {
    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpAppliedRegisterFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Line signals</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-applied-register-filter", "hasRejected", "true", "Has rejected lines", mrpAppliedRegisterFilters.hasRejected === true)}
            ${renderFilterCheckbox("data-mrp-applied-register-filter", "hasBlocked", "true", "Has blocked lines", mrpAppliedRegisterFilters.hasBlocked === true)}
          </div>
        </div>
        <div class="cp-muted-text" style="margin:6px 0 8px;line-height:1.4">
          Trace Complete / Attention is certified in the Trace Workspace after lines and canonical policies are loaded.
        </div>
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpAppliedRegisterFilters, [
      "hasRejected",
      "hasBlocked",
      "traceStatus",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-applied-register-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function renderLineFilterPanel() {
    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="mrpAppliedLineFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Application outcome</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "outcome", "APPLIED", "Applied", mrpAppliedLineFilters.outcome.includes("APPLIED"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "outcome", "EXCLUDED_REJECTED", "Excluded — rejected", mrpAppliedLineFilters.outcome.includes("EXCLUDED_REJECTED"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "outcome", "EXCLUDED_BLOCKED", "Excluded — blocked", mrpAppliedLineFilters.outcome.includes("EXCLUDED_BLOCKED"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "outcome", "APPROVED_NOT_LINKED", "Approved but not linked", mrpAppliedLineFilters.outcome.includes("APPROVED_NOT_LINKED"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "outcome", "LINK_UNRESOLVED", "Applied link unresolved", mrpAppliedLineFilters.outcome.includes("LINK_UNRESOLVED"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "outcome", "TRACE_ABNORMALITY", "Trace abnormality", mrpAppliedLineFilters.outcome.includes("TRACE_ABNORMALITY"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Decision</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "decision", "APPROVED", "Approved", mrpAppliedLineFilters.decision.includes("APPROVED"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "decision", "REJECTED", "Rejected", mrpAppliedLineFilters.decision.includes("REJECTED"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Eligibility</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "eligibility", "ELIGIBLE", "Eligible", mrpAppliedLineFilters.eligibility.includes("ELIGIBLE"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "eligibility", "BLOCKED", "Blocked", mrpAppliedLineFilters.eligibility.includes("BLOCKED"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Canonical mode</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "calcMode", "AUTO", "Automatic", mrpAppliedLineFilters.calcMode.includes("AUTO"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "calcMode", "MANUAL", "Manual", mrpAppliedLineFilters.calcMode.includes("MANUAL"))}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Trace status</div>
          <div class="cp-mrp-filter-options">
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "traceStatus", "COMPLETE", "Complete", mrpAppliedLineFilters.traceStatus.includes("COMPLETE"))}
            ${renderFilterCheckbox("data-mrp-applied-line-filter", "traceStatus", "ATTENTION", "Attention required", mrpAppliedLineFilters.traceStatus.includes("ATTENTION"))}
          </div>
        </div>
      </div>`;

    const activeCount = countActiveMrpFilterFields(mrpAppliedLineFilters, [
      "outcome",
      "decision",
      "eligibility",
      "calcMode",
      "traceStatus",
    ]);

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-mrp-applied-line-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function countBy(predicate) {
    return mrpAppliedLinesRawRows.filter(predicate).length;
  }

  function renderWorkspaceHeaderPanel() {
    const header = mrpAppliedHeaderCache;
    if (!header) {
      return `
        <div class="cp-mrp-governance-empty" role="status" style="margin:8px 0">
          <div class="cp-mrp-governance-empty-title">Select an applied proposal</div>
          <p class="cp-mrp-governance-empty-body">Open an applied proposal from the Applied Register to inspect proposal-to-line-to-canonical MRP provenance. This workspace is read-only.</p>
        </div>`;
    }

    const proposalTrace = computeProposalTraceStatus(
      header,
      mrpAppliedLinesRawRows,
    );
    const total = mrpAppliedLinesRawRows.length || Number(header.total_line_count) || 0;
    const appliedOk = countBy((r) => getLineTraceMeta(r).outcome === "APPLIED");
    const missingLink = countBy(
      (r) => getLineTraceMeta(r).outcome === "APPROVED_NOT_LINKED",
    );
    const unresolved = countBy(
      (r) => getLineTraceMeta(r).outcome === "LINK_UNRESOLVED",
    );
    const rejected = countBy(
      (r) => getLineTraceMeta(r).outcome === "EXCLUDED_REJECTED",
    );
    const blocked = countBy(
      (r) => getLineTraceMeta(r).outcome === "EXCLUDED_BLOCKED",
    );
    const resolvedCanonical = appliedOk;
    const abnormal = countBy(
      (r) => getLineTraceMeta(r).lineTrace === "ATTENTION",
    );

    return `
      <div class="cp-mrp-proposal-workspace-header" id="mrpAppliedWorkspaceHeader">
        <div class="cp-muted-text" style="margin-bottom:8px;line-height:1.45">
          Read-only provenance from Product MRP Proposal → proposal line → canonical SKU MRP policy revision. No application or repair actions are available here.
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
            <div class="cp-card-value">${statusChip(formatMrpProposalStatusLabel(header.status, { decisionContext: true }))}</div>
            <div class="cp-muted-text">Effective ${formatDate(header.proposed_effective_from)}</div>
          </div>
          <div class="cp-card">
            <div class="cp-card-label">Trace status</div>
            <div class="cp-card-value">${statusChip(proposalTrace.label)}</div>
            <div class="cp-muted-text">${text(proposalTrace.notes[0] || "")}</div>
          </div>
        </div>
        <div class="cp-summary-strip" style="margin-top:8px">
          <div class="cp-card"><div class="cp-card-label">Total</div><div class="cp-card-value">${text(total)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Applied + resolved</div><div class="cp-card-value">${text(appliedOk)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Link missing</div><div class="cp-card-value">${text(missingLink)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Link unresolved</div><div class="cp-card-value">${text(unresolved)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Rejected</div><div class="cp-card-value">${text(rejected)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Blocked</div><div class="cp-card-value">${text(blocked)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Canonical resolved</div><div class="cp-card-value">${text(resolvedCanonical)}</div></div>
          <div class="cp-card"><div class="cp-card-label">Abnormalities</div><div class="cp-card-value">${text(abnormal)}</div></div>
        </div>
        <div class="cp-muted-text" style="margin-top:8px;line-height:1.45">
          ${header.reason ? `Reason: ${text(header.reason)}` : "Reason: --"}
          ${header.approval_reference ? ` · Approval: ${text(header.approval_reference)}` : ""}
          · Reference ${text(formatMrpReferencePack(header))}
          · Derivation ${text(header.derivation_policy_id || "--")}
          ${header.applied_at ? ` · Applied ${formatDateTime(header.applied_at)}${header.applied_by ? ` by ${text(header.applied_by)}` : ""}` : ""}
          ${header.submission_note || header.application_note || header.reason ? "" : ""}
        </div>
        ${
          // application_note may not exist; register has no separate field in all deployments —
          // show submission_note when present as related evidence.
          header.submission_note
            ? `<div class="cp-muted-text" style="margin-top:4px">Submission note: ${text(header.submission_note)}</div>`
            : ""
        }
        ${
          proposalTrace.code === "ATTENTION" && proposalTrace.notes.length
            ? `<ul class="cp-muted-text" style="margin:8px 0 0;padding-left:18px;line-height:1.45">${proposalTrace.notes
                .map((n) => `<li>${text(n)}</li>`)
                .join("")}</ul>`
            : ""
        }
      </div>`;
  }

  function renderChromeHtml() {
    if (!isMrpAppliedHistoryTabActive()) return "";
    const nested = renderNestedSubviewNav({
      options: MRP_APPLIED_HISTORY_VIEWS,
      activeId: mrpAppliedHistoryView,
      dataAttr: "data-mrp-applied-view",
      selectId: "mrpAppliedHistoryViewSelect",
      selectLabel: "View",
      selectAriaLabel: "Select applied proposal history view",
    });

    if (mrpAppliedHistoryView === "workspace") {
      return `
        ${nested}
        ${renderWorkspaceHeaderPanel()}
      `;
    }
    return `${nested}`;
  }

  function renderActiveFilterDrawerPanel() {
    if (!isMrpAppliedHistoryTabActive()) return null;
    if (mrpAppliedHistoryView === "workspace") {
      if (selectedAppliedProposalId == null) return null;
      return renderLineFilterPanel();
    }
    return renderRegisterFilterPanel();
  }

  function registerTraceHint(row) {
    // Soft register hint — full certification only after line load.
    const approved = Number(row.approved_line_count) || 0;
    if (approved <= 0) return statusChip("Attention required");
    return statusChip("Open to certify");
  }

  function renderRegisterDrawerActions(row) {
    return `<div class="cp-drawer-action-bar"><button type="button" class="icon-btn icon-btn-primary" data-mrp-applied-drawer-open="${text(row.proposal_id)}" title="Open trace workspace" aria-label="Open trace workspace">Open</button></div>`;
  }

  function renderRegisterRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.proposal_number || `Proposal ${row.proposal_id}`)}<div class="cp-muted-text">ID ${text(row.proposal_id)}</div></td>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">Product ${text(row.product_id)}</div></td>
      <td>${formatDate(row.proposed_effective_from)}</td>
      <td class="c-right">${text(row.approved_line_count ?? "--")}</td>
      <td class="c-right">${text(row.rejected_line_count ?? "--")}</td>
      <td class="c-right">${text(row.blocked_line_count ?? "--")}</td>
      <td>${formatDateTime(row.applied_at)}</td>
      <td>${text(row.applied_by || "--")}</td>
      <td>${text(row.submission_note || "--")}</td>
      <td>${registerTraceHint(row)}</td>
    </tr>`;
  }

  function renderLineRow(row, trAttrs) {
    const meta = getLineTraceMeta(row);
    const canonical = meta.canonical;
    return `<tr ${trAttrs}>
      <td class="c-right">${text(row.line_number ?? "--")}</td>
      <td>${cpCellPrimary(`SKU ${row.sku_id ?? "--"}`)}<div class="cp-muted-text">${text(formatMrpPackLabel(row))}</div></td>
      <td>${statusChip(formatMrpDecisionLabel(row.decision))}</td>
      <td>${statusChip(formatMrpEligibility(row.eligibility_status))}</td>
      <td class="c-right">${text(formatMrpIkOkPair(row.proposed_mrp_ik, row.proposed_mrp_ok, fmt))}</td>
      <td>${text(row.proposed_calc_mode || "--")}</td>
      <td>${statusChip(formatOutcome(meta.outcome))}</td>
      <td class="c-right">${text(row.applied_mrp_policy_id || "--")}</td>
      <td class="c-right">${canonical ? text(formatMrpIkOkPair(canonical.mrp_ik, canonical.mrp_ok, fmt)) : "--"}</td>
      <td>${text(canonical?.calc_mode || "--")}</td>
      <td>${canonical ? text(formatEffectivePeriod(canonical)) : "--"}</td>
      <td class="c-right">${text(canonical?.previous_policy_id || "--")}</td>
      <td>${statusChip(formatTraceStatus(meta.lineTrace))}</td>
    </tr>`;
  }

  function getTableHeaders() {
    return mrpAppliedHistoryView === "workspace"
      ? LINE_HEADERS
      : REGISTER_HEADERS;
  }

  function getTableAlignments() {
    return mrpAppliedHistoryView === "workspace"
      ? LINE_ALIGNMENTS
      : REGISTER_ALIGNMENTS;
  }

  function renderTableRow(row, trAttrs) {
    if (mrpAppliedHistoryView === "workspace") {
      if (selectedAppliedProposalId == null) return null;
      return renderLineRow(row, trAttrs);
    }
    return renderRegisterRow(row, trAttrs);
  }

  function getDrawerConfig(row, preferredTab) {
    if (mrpAppliedHistoryView === "workspace" || row?.proposal_line_id != null) {
      const meta = getLineTraceMeta(row);
      return {
        title:
          row.sku_id != null
            ? `SKU ${row.sku_id}`
            : `Line ${row.line_number ?? ""}`,
        subtitle: [
          row.proposal_number,
          formatOutcome(meta.outcome),
          formatTraceStatus(meta.lineTrace),
        ]
          .filter(Boolean)
          .join(" · "),
        tabs: [
          { id: "line-identity", label: "Proposal Line" },
          { id: "line-proposed", label: "Proposed MRP" },
          { id: "line-canonical", label: "Canonical Policy" },
          { id: "line-predecessor", label: "Predecessor" },
          { id: "line-evidence", label: "Evidence" },
          { id: "line-audit", label: "Trace Audit" },
        ],
        activeTab: preferredTab || "line-audit",
      };
    }

    return {
      title: row.proposal_number || `Proposal ${row.proposal_id}`,
      subtitle: [
        row.product_name,
        "Applied",
        formatDateTime(row.applied_at),
      ]
        .filter(Boolean)
        .join(" · "),
      tabs: [
        { id: "proposal-summary", label: "Summary" },
        { id: "proposal-evidence", label: "Application Evidence" },
      ],
      activeTab: preferredTab || "proposal-summary",
    };
  }

  function renderDrawerTab(tabId, row) {
    if (row?.proposal_line_id != null || mrpAppliedHistoryView === "workspace") {
      const meta = getLineTraceMeta(row);
      const canonical = meta.canonical;
      const prev =
        canonical?.previous_policy_id != null
          ? getCanonical(canonical.previous_policy_id)
          : null;

      if (tabId === "line-proposed") {
        return detailPanel([
          kvSection("Proposed MRP", [
            ["Proposed IK", formatOptionalMoney(row.proposed_mrp_ik)],
            ["Proposed OK", formatOptionalMoney(row.proposed_mrp_ok)],
            ["Proposed uplift", formatOkPct(row.proposed_ok_pct)],
            ["Proposed mode", text(row.proposed_calc_mode)],
            [
              "Manually adjusted",
              text(row.is_manually_adjusted === true ? "Yes" : "No"),
            ],
            ["Adjustment reason", text(row.manual_adjustment_reason || "--")],
          ]),
        ]);
      }

      if (tabId === "line-canonical") {
        if (!canonical) {
          return detailPanel([
            kvSection("Canonical policy", [
              ["Applied policy ID", text(row.applied_mrp_policy_id || "--")],
              ["Resolution", text("Not resolved in canonical history")],
            ]),
          ]);
        }
        const mismatch =
          !nearlyEqualMoney(row.proposed_mrp_ik, canonical.mrp_ik) ||
          !nearlyEqualMoney(row.proposed_mrp_ok, canonical.mrp_ok);
        return detailPanel([
          mismatch
            ? `<div class="cp-mrp-blocker-card" style="margin-bottom:10px"><div class="cp-card-label">Trace attention required</div><div class="cp-muted-text">Proposal and canonical values differ.</div></div>`
            : "",
          kvSection("Canonical policy", [
            ["Policy ID", text(canonical.policy_id)],
            ["Canonical IK", formatOptionalMoney(canonical.mrp_ik)],
            ["Canonical OK", formatOptionalMoney(canonical.mrp_ok)],
            ["Canonical uplift", formatOkPct(canonical.ok_pct)],
            ["Mode", text(canonical.calc_mode)],
            ["Lifecycle", text(humanizeMrpToken(canonical.lifecycle_label))],
            ["Effective period", text(formatEffectivePeriod(canonical))],
            ["Source", text(formatSourceType(canonical.source_type))],
            ["Quality", text(humanizeMrpToken(canonical.source_quality))],
            ["Created at", formatDateTime(canonical.created_at)],
            ["Created by", text(canonical.created_by)],
          ]),
        ]);
      }

      if (tabId === "line-predecessor") {
        if (!canonical) {
          return detailPanel([
            kvSection("Predecessor", [
              ["Status", text("Canonical policy not resolved")],
            ]),
          ]);
        }
        if (canonical.previous_policy_id == null) {
          return detailPanel([
            kvSection("Predecessor", [
              ["Status", text("Initial canonical policy for this SKU")],
            ]),
          ]);
        }
        if (!prev) {
          return detailPanel([
            kvSection("Predecessor", [
              ["Previous policy ID", text(canonical.previous_policy_id)],
              ["Status", text("Previous policy link unresolved")],
            ]),
          ]);
        }
        return detailPanel([
          kvSection("Previous policy", [
            ["Previous policy ID", text(prev.policy_id)],
            ["Previous IK", formatOptionalMoney(prev.mrp_ik)],
            ["Previous OK", formatOptionalMoney(prev.mrp_ok)],
            ["Previous mode", text(prev.calc_mode)],
            ["Previous effective period", text(formatEffectivePeriod(prev))],
          ]),
          kvSection("Change summary", [
            ["Change in IK", text(moneyDelta(prev.mrp_ik, canonical.mrp_ik))],
            ["Change in OK", text(moneyDelta(prev.mrp_ok, canonical.mrp_ok))],
            ["IK change %", text(pctChange(prev.mrp_ik, canonical.mrp_ik))],
            ["OK change %", text(pctChange(prev.mrp_ok, canonical.mrp_ok))],
          ]),
        ]);
      }

      if (tabId === "line-evidence") {
        const snap = summarizeSourceSnapshot(canonical?.source_snapshot);
        return detailPanel([
          kvSection("Application evidence", [
            ["Applied policy ID", text(row.applied_mrp_policy_id || "--")],
            ["Applied at (line)", formatDateTime(row.applied_at)],
            ["Applied by (line)", text(row.applied_by)],
            [
              "Proposal applied at",
              formatDateTime(mrpAppliedHeaderCache?.applied_at),
            ],
            [
              "Proposal applied by",
              text(mrpAppliedHeaderCache?.applied_by),
            ],
            [
              "Submission note",
              text(mrpAppliedHeaderCache?.submission_note || "--"),
            ],
          ]),
          snap.rows.length
            ? kvSection("Source snapshot summary", snap.rows)
            : kvSection("Source snapshot summary", [
                ["Summary", text(canonical ? "No recognized snapshot fields" : "--")],
              ]),
          snap.technical
            ? kvSection("Additional source evidence", [
                [
                  "source_snapshot",
                  `<pre class="cp-mrp-snapshot-pre">${text(snap.technical)}</pre>`,
                ],
              ])
            : "",
        ]);
      }

      if (tabId === "line-audit") {
        return detailPanel([
          kvSection("Trace audit", [
            ["Line outcome", text(formatOutcome(meta.outcome))],
            ["Trace status", text(formatTraceStatus(meta.lineTrace))],
            [
              "Abnormalities",
              meta.abnormalities.length
                ? meta.abnormalities.map((a) => text(a)).join("<br/>")
                : text("None detected"),
            ],
          ]),
        ]);
      }

      return detailPanel([
        kvSection("Proposal line", [
          ["Proposal line ID", text(row.proposal_line_id)],
          ["Line number", text(row.line_number)],
          ["SKU ID", text(row.sku_id)],
          ["Pack", text(formatMrpPackLabel(row))],
          ["Direction", text(formatMrpPackDirection(row.pack_direction))],
          ["Decision", text(formatMrpDecisionLabel(row.decision))],
          ["Eligibility", text(formatMrpEligibility(row.eligibility_status))],
          [
            "Warning",
            text(row.warning_code ? formatMrpWarningCode(row.warning_code) : "--"),
          ],
          [
            "Blocker",
            text(row.blocker_code ? humanizeMrpToken(row.blocker_code) : "--"),
          ],
          ["Calculation status", text(formatMrpCalcStatus(row.calculation_status))],
        ]),
      ]);
    }

    if (tabId === "proposal-evidence") {
      return detailPanel([
        kvSection("Application", [
          ["Applied at", formatDateTime(row.applied_at)],
          ["Applied by", text(row.applied_by)],
          ["Submission note", text(row.submission_note || "--")],
          ["Approval reference", text(row.approval_reference || "--")],
          ["Reason", text(row.reason || "--")],
          ["Approved at", formatDateTime(row.approved_at)],
          ["Approved by", text(row.approved_by)],
        ]),
      ]);
    }

    return (
      renderRegisterDrawerActions(row) +
      detailPanel([
        kvSection("Proposal", [
          ["Proposal", text(row.proposal_number)],
          ["Product", text(row.product_name)],
          ["Effective from", formatDate(row.proposed_effective_from)],
          ["Reference Pack", text(formatMrpReferencePack(row))],
          ["Derivation policy", text(row.derivation_policy_id)],
          ["Approved lines", text(row.approved_line_count)],
          ["Rejected lines", text(row.rejected_line_count)],
          ["Blocked lines", text(row.blocked_line_count)],
        ]),
      ])
    );
  }

  async function openAppliedWorkspace(proposalId) {
    const id = Number(proposalId);
    if (!Number.isFinite(id)) {
      showToast("Invalid proposal selection.", "error");
      return;
    }
    selectedAppliedProposalId = id;
    mrpAppliedHistoryView = "workspace";
    if (typeof reloadRows === "function") await reloadRows();
  }

  function wireTableActions(_tableBody) {
    // Row actions live in the detail drawer (see wireDrawerActions).
  }

  function wireDrawerActions(tabId, row) {
    if (!row || tabId !== "proposal-summary") return;
    document
      .querySelector("[data-mrp-applied-drawer-open]")
      ?.addEventListener("click", () => {
        void openAppliedWorkspace(row.proposal_id);
      });
  }

  function wireChromeEvents(container, onLocalChange) {
    if (!container) return;

    const commitView = async (nextView) => {
      const next = nextView === "workspace" ? "workspace" : "register";
      if (next === "workspace" && selectedAppliedProposalId == null) {
        showToast(
          "Select an applied proposal from the Applied Register before opening the trace workspace.",
          "info",
          4200,
        );
        mrpAppliedHistoryView = "register";
        const select = container.querySelector("#mrpAppliedHistoryViewSelect");
        if (select) select.value = "register";
        container.querySelectorAll("[data-mrp-applied-view]").forEach((btn) => {
          const active = btn.dataset.mrpAppliedView === "register";
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        return;
      }
      if (next === mrpAppliedHistoryView) return;
      mrpAppliedHistoryView = next;
      if (typeof onLocalChange === "function") await onLocalChange("view");
    };

    container.querySelectorAll("[data-mrp-applied-view]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await commitView(btn.dataset.mrpAppliedView);
      });
    });

    container
      .querySelector("#mrpAppliedHistoryViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitView(event.target?.value);
      });
  }

  function wireFilterDrawerEvents(container, onLocalChange) {
    if (!container) return;

    container
      .querySelectorAll("[data-mrp-applied-register-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleRegisterFilter(
            input.dataset.mrpAppliedRegisterFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-applied-register-filter-clear]")
      ?.addEventListener("click", async () => {
        clearRegisterFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });

    container
      .querySelectorAll("[data-mrp-applied-line-filter]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleLineFilter(
            input.dataset.mrpAppliedLineFilter,
            input.value,
            input.checked,
          );
          if (typeof onLocalChange === "function") await onLocalChange("filter");
        });
      });

    container
      .querySelector("[data-mrp-applied-line-filter-clear]")
      ?.addEventListener("click", async () => {
        clearLineFilters();
        if (typeof onLocalChange === "function") await onLocalChange("filter");
      });
  }

  function emptyStatusMessage() {
    if (mrpAppliedLoadError) {
      return "Unable to load Applied Proposal History.";
    }
    if (mrpAppliedHistoryView === "workspace") {
      if (selectedAppliedProposalId == null) {
        return "Select an applied proposal to inspect its trace.";
      }
      return "No proposal lines found for this applied proposal.";
    }
    return "No applied proposals exist yet.";
  }

  function noMatchMessage() {
    return mrpAppliedHistoryView === "workspace"
      ? "No proposal lines match the current search or filters."
      : "No applied proposals match the current filters.";
  }

  return {
    isMrpAppliedHistoryTabActive,
    getMrpAppliedHistoryView,
    setMrpAppliedHistoryView,
    getSelectedAppliedProposalId,
    activateProposal,
    loadMrpAppliedHistoryRows,
    getMrpAppliedHistoryFilteredRows,
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
    handleEscapeKey: () => false,
    bindEvents: () => {},
    syncWriteUi: () => {},
    emptyStatusMessage,
    noMatchMessage,
  };
}
