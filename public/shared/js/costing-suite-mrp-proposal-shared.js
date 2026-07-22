/**
 * Shared Product MRP Proposal formatters and loaders for PPM-C1E / PPM-C1F.
 * Keeps one register/lines fetch shape without duplicating selection state.
 */

export const MRP_CALC_STATUS_OPTIONS = [
  "REFERENCE_PACK",
  "CALCULATED",
  "CURRENT_MRP_MISSING",
  "NO_CHANGE",
  "MANUALLY_ADJUSTED",
  "BLOCKED",
];

export const MRP_PACK_DIRECTION_OPTIONS = [
  "REFERENCE_PACK",
  "LARGER_PACK",
  "SMALLER_PACK",
];

export const MRP_WARNING_KNOWN = {
  LARGE_PACK_REVIEW: "Large pack review",
  VERY_LARGE_PACK_REVIEW: "Very large pack review",
  TARGET_MRP_MISSING: "Target MRP missing",
};

export function humanizeMrpToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "--";
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {string|null|undefined} status
 * @param {{ decisionContext?: boolean }} [opts]
 */
export function formatMrpProposalStatusLabel(status, opts = {}) {
  const raw = String(status || "").trim().toUpperCase();
  if (!raw) return "--";
  if (raw === "SUBMITTED") return "Submitted";
  if (raw === "PARTIALLY_DECIDED") return "Partially decided";
  if (raw === "APPROVED") {
    return opts.decisionContext ? "Approved for application" : "Approved";
  }
  if (raw === "REJECTED") return "Rejected";
  if (raw === "APPLIED") return "Applied";
  if (raw === "CANCELLED") return "Cancelled";
  if (raw === "DRAFT") return "Draft";
  return humanizeMrpToken(raw);
}

export function formatMrpDecisionLabel(decision) {
  const raw = String(decision || "").trim().toUpperCase();
  if (raw === "PENDING") return "Pending";
  if (raw === "APPROVED") return "Approved";
  if (raw === "REJECTED") return "Rejected";
  return humanizeMrpToken(raw);
}

export function formatMrpEligibility(status) {
  const raw = String(status || "").trim().toUpperCase();
  if (raw === "ELIGIBLE") return "Eligible";
  if (raw === "BLOCKED") return "Blocked";
  return humanizeMrpToken(raw);
}

export function formatMrpCalcStatus(status) {
  const raw = String(status || "").trim().toUpperCase();
  if (!raw) return "--";
  if (raw === "CURRENT_MRP_MISSING") return "Current MRP missing";
  if (raw === "NO_CHANGE") return "No change";
  if (raw === "MANUALLY_ADJUSTED") return "Manually adjusted";
  if (raw === "REFERENCE_PACK") return "Reference Pack";
  return humanizeMrpToken(raw);
}

export function formatMrpPackDirection(direction) {
  const raw = String(direction || "").trim().toUpperCase();
  if (raw === "REFERENCE_PACK") return "Reference Pack";
  if (raw === "LARGER_PACK") return "Larger pack";
  if (raw === "SMALLER_PACK") return "Smaller pack";
  return humanizeMrpToken(raw);
}

export function formatMrpWarningCode(code) {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return "";
  if (MRP_WARNING_KNOWN[raw]) return MRP_WARNING_KNOWN[raw];
  return humanizeMrpToken(raw);
}

export function formatMrpIkOkPair(ik, ok, { formatOptionalMoney }) {
  return `${formatOptionalMoney(ik)} / ${formatOptionalMoney(ok)}`;
}

export function formatMrpReferencePack(row) {
  const pack = [row?.reference_pack_size, row?.reference_pack_uom]
    .filter((v) => v !== null && v !== "")
    .join(" ");
  if (!pack && row?.reference_sku_id == null) return "--";
  const sku =
    row?.reference_sku_id != null ? `SKU ${row.reference_sku_id}` : "";
  return pack ? `${pack}${sku ? ` · ${sku}` : ""}` : sku || "--";
}

export function formatMrpPackLabel(row) {
  const pack = [row?.pack_size, row?.pack_uom]
    .filter((v) => v !== null && v !== "")
    .join(" ");
  return pack || "--";
}

export function renderMrpWarningBlockerCell(row, { text }) {
  const eligibility = String(row?.eligibility_status || "")
    .trim()
    .toUpperCase();
  const blocker = String(row?.blocker_code || "").trim();
  const warning = String(row?.warning_code || "").trim();

  if (eligibility === "BLOCKED" || blocker) {
    const label = blocker ? humanizeMrpToken(blocker) : "Blocked";
    return `<div class="cp-mrp-blocker-card"><div class="cp-card-label">Blocked</div><div class="cp-muted-text">${text(label)}</div></div>`;
  }
  if (warning) {
    return `<span class="cp-muted-text">${text(formatMrpWarningCode(warning))}</span>`;
  }
  return `<span class="cp-muted-text">--</span>`;
}

export function enrichMrpProposalRegisterSearch(row) {
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
      row.submission_note,
      row.status,
      row.review_summary_status,
    ]
      .filter((v) => v != null && v !== "")
      .join(" "),
  };
}

export function enrichMrpProposalLineSearch(row) {
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
      row.decision_reason,
      row.manual_adjustment_reason,
      row.pack_direction,
    ]
      .filter((v) => v != null && v !== "")
      .join(" "),
  };
}

export async function fetchMrpProposalRegisterRows(costingFrom, fetchAllRows) {
  return fetchAllRows(
    () =>
      costingFrom("v_product_mrp_proposal_register")
        .select("*")
        .order("created_at", { ascending: false })
        .order("proposal_id", { ascending: false }),
    1000,
  );
}

export async function fetchMrpProposalLines(
  costingFrom,
  fetchAllRows,
  proposalId,
) {
  const id = Number(proposalId);
  if (!Number.isFinite(id)) return [];
  return fetchAllRows(
    () =>
      costingFrom("v_product_mrp_proposal_lines")
        .select("*")
        .eq("proposal_id", id)
        .order("line_number", { ascending: true })
        .order("proposal_line_id", { ascending: true }),
    2000,
  );
}

/* ---------- PPM-C1H3 filter disclosure (presentation only) ---------- */

function escapeMrpHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMrpAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Count one per filter field that has an active value (not per selected enum).
 * Arrays count as one when non-empty; booleans count when true.
 */
export function countActiveMrpFilterFields(filters, fieldKeys) {
  let count = 0;
  for (const key of fieldKeys || []) {
    const value = filters?.[key];
    if (Array.isArray(value)) {
      if (value.length > 0) count += 1;
    } else if (value === true) {
      count += 1;
    } else if (value != null && value !== false && value !== "") {
      count += 1;
    }
  }
  return count;
}

/**
 * Session disclosure tri-state: null = auto (open when activeCount > 0).
 */
export function resolveMrpFilterDisclosureOpen(manualState, activeCount) {
  if (manualState === true) return true;
  if (manualState === false) return false;
  return Number(activeCount) > 0;
}

/**
 * @param {{
 *   label: string,
 *   groupAttr: string,
 *   group: string,
 *   valueAttr: string,
 *   value: string,
 *   ariaLabel?: string,
 * }} chip
 */
export function renderMrpActiveFilterChip(chip) {
  const label = String(chip.label || "").trim();
  const aria = escapeMrpHtml(
    chip.ariaLabel || (label ? `Remove ${label} filter` : "Remove filter"),
  );
  return `<button
    type="button"
    class="cp-active-filter-chip"
    ${chip.groupAttr}="${escapeMrpAttr(chip.group)}"
    ${chip.valueAttr}="${escapeMrpAttr(chip.value)}"
    aria-label="${aria}"
  >
    <span class="cp-active-filter-chip-label">${escapeMrpHtml(label)}</span>
    <span class="cp-active-filter-chip-remove" aria-hidden="true">×</span>
  </button>`;
}

/**
 * Presentation-only filter disclosure shell.
 * Empty chip rows and inactive clear-all omit height.
 *
 * @param {{
 *   id: string,
 *   title?: string,
 *   isOpen: boolean,
 *   activeCount?: number,
 *   chipsHtml?: string,
 *   bodyHtml: string,
 *   clearAllAttr?: string,
 *   clearAllLabel?: string,
 * }} opts
 */
export function renderMrpFilterDisclosure(opts = {}) {
  const id = String(opts.id || "mrpFilter").trim() || "mrpFilter";
  const bodyId = `${id}Body`;
  const isOpen = !!opts.isOpen;
  const activeCount = Number(opts.activeCount) || 0;
  const title = opts.title || "Filters";
  const chipsHtml = String(opts.chipsHtml || "").trim();
  const clearAttr = String(opts.clearAllAttr || "").trim();
  const clearLabel = opts.clearAllLabel || "Clear all";

  const badge =
    activeCount > 0
      ? `<span class="cp-filter-disclosure-badge" aria-hidden="true">${activeCount}</span><span class="cp-visually-hidden">, ${activeCount} active</span>`
      : "";

  const clearBtn =
    activeCount > 0 && clearAttr
      ? `<button type="button" class="cp-filter-clear-all" ${clearAttr}>${escapeMrpHtml(clearLabel)}</button>`
      : "";

  const chipsRow = chipsHtml
    ? `<div class="cp-active-filter-chips">${chipsHtml}</div>`
    : "";

  return `
    <div class="cp-filter-disclosure" data-mrp-filter-disclosure="${escapeMrpAttr(id)}">
      <div class="cp-filter-disclosure-toolbar">
        <button
          type="button"
          class="cp-filter-disclosure-toggle"
          data-mrp-filter-disclosure-toggle="${escapeMrpAttr(id)}"
          aria-expanded="${isOpen ? "true" : "false"}"
          aria-controls="${escapeMrpAttr(bodyId)}"
        >
          <span class="cp-filter-disclosure-toggle-label">${escapeMrpHtml(title)}</span>
          ${badge}
        </button>
        ${chipsRow}
        ${clearBtn}
      </div>
      <div
        class="cp-filter-disclosure-body${isOpen ? " is-open" : ""}"
        id="${escapeMrpAttr(bodyId)}"
        ${isOpen ? "" : "hidden"}
      >
        ${opts.bodyHtml || ""}
      </div>
    </div>`;
}

/**
 * Floating meta-drawer panel body (funnel button hosts this).
 * Badge-only chrome — no chips toolbar (layout reclaim).
 *
 * @param {{
 *   bodyHtml: string,
 *   activeCount?: number,
 *   clearAllAttr?: string,
 *   clearAllLabel?: string,
 *   summaryLabel?: string,
 * }} opts
 * @returns {{ html: string, activeCount: number }}
 */
export function renderMrpFilterDrawerPanel(opts = {}) {
  const activeCount = Number(opts.activeCount) || 0;
  const clearAttr = String(opts.clearAllAttr || "").trim();
  const clearLabel = opts.clearAllLabel || "Clear all";
  const summary =
    activeCount > 0
      ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied`
      : opts.summaryLabel || "No filters applied";

  const clearBtn = clearAttr
    ? `<button type="button" class="peq-filter-action-btn" ${clearAttr}>${escapeMrpHtml(clearLabel)}</button>`
    : "";

  const html = `
    <div class="mrp-filter-drawer-panel">
      ${opts.bodyHtml || ""}
      <div class="peq-filter-summary">${escapeMrpHtml(summary)}</div>
      <div class="peq-filter-actions">
        ${clearBtn}
      </div>
    </div>`;

  return { html, activeCount };
}

/**
 * Wire Filters toggle without reloading rows (session-local UI state only).
 */
export function wireMrpFilterDisclosureToggle(
  container,
  disclosureId,
  setManualOpen,
) {
  if (!container || !disclosureId) return;
  const toggle = container.querySelector(
    `[data-mrp-filter-disclosure-toggle="${disclosureId}"]`,
  );
  const body = container.querySelector(`#${disclosureId}Body`);
  if (!toggle || !body) return;

  toggle.addEventListener("click", () => {
    const currentlyOpen = !body.hidden && body.getAttribute("hidden") == null;
    const nextOpen = !currentlyOpen;
    if (typeof setManualOpen === "function") setManualOpen(nextOpen);
    body.hidden = !nextOpen;
    if (nextOpen) {
      body.removeAttribute("hidden");
      body.classList.add("is-open");
    } else {
      body.setAttribute("hidden", "");
      body.classList.remove("is-open");
    }
    toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  });
}
