import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { mountModuleActionIcons } from "./sasv-module-chrome.js";
import { showToast } from "./toast.js";
import {
  ERROR_KIND,
  QUEUE_FILTERS,
  WORKSPACE_TABS,
  actionsDirty,
  actionsDraftFromRows,
  canPromoteFormulation,
  canVerifyProductWorkflow,
  detailsDraftFromReview,
  detailsDirty,
  displayText,
  entryStatusChipClass,
  findQueueRow,
  filterQueueRows,
  formatIssueDetails,
  formatVerifiedTotal,
  idsEqual,
  issuesForLine,
  lineDirty,
  lineDraftFromRow,
  lineHasBlockerOrError,
  lineSelectionsComplete,
  mergePreservedLineDraft,
  normalizeEntryStatus,
  normalizeReviewStatus,
  openErrorOrBlockerCount,
  optionId,
  portalFieldSpecs,
  provenanceLabel,
  queueKpis,
  resolveFieldProvenance,
  reviewStatusChipClass,
  safeText,
  severityLabel,
  severityRank,
  SUGGESTION_FIELD_KEYS,
  toInt,
} from "./eaushadhi-review-helpers.js";
import {
  EaushadhiRpcError,
  fetchProductQueue,
  loadProductWorkspace,
  loadSessionCatalogs,
  promoteVerifiedFormulation,
  saveLineReview,
  saveProductActions,
  saveProductReview,
  verifyProduct,
} from "./eaushadhi-review-api.js";

const $ = (id) => document.getElementById(id);

const access = {
  userId: null,
  canView: false,
  canEdit: false,
  loaded: false,
  loadError: false,
};

const state = {
  queue: [],
  filterId: "all",
  search: "",
  catalogs: {
    portalOptions: {
      INGREDIENT_TYPE: [],
      INGREDIENT_FORM: [],
      PART_USED: [],
      MEASUREMENT_UNIT: [],
    },
    permissionPurposeOptions: [],
    pharmacologicalActionOptions: [],
  },
  selectedProductId: null,
  tab: "overview",
  queueRow: null,
  review: null,
  lines: [],
  actions: [],
  evidence: null,
  issues: [],
  detailsDraft: null,
  detailsBaseline: null,
  lineDrafts: new Map(),
  lineBaselines: new Map(),
  actionsDraft: [],
  actionsBaseline: [],
  promoteNotes: "",
  verifyNotes: "",
  loadGen: 0,
  busy: false,
  preservedAfterStale: false,
};

let searchTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function canWrite() {
  return access.canEdit === true;
}

function setStatus(message, type = "info") {
  const el = $("statusArea");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.removeAttribute("data-type");
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.dataset.type = type;
}

function setAccessDenied(message) {
  const status = $("accessStatus");
  const panel = $("mainPanel");
  if (status) {
    status.hidden = false;
    status.textContent = message;
  }
  if (panel) panel.hidden = true;
}

function applyPermissionUi() {
  const banner = $("viewOnlyBanner");
  if (banner) banner.hidden = !(access.canView && !access.canEdit);
  document.body.classList.toggle("view-only-mode", access.canView && !access.canEdit);
  document.querySelectorAll("[data-edit-action='true']").forEach((el) => {
    if (
      !(
        el instanceof HTMLButtonElement ||
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }
    el.disabled = !canWrite() || state.busy || el.dataset.forceDisabled === "true";
  });
}

function toastError(err) {
  const message =
    err instanceof EaushadhiRpcError
      ? err.message
      : err?.message || "Something went wrong.";
  showToast(message, "error", 5200);
}

function workspaceIsDirty() {
  if (!state.selectedProductId) return false;
  if (detailsDirty(state.detailsDraft, state.detailsBaseline)) return true;
  if (actionsDirty(state.actionsDraft, state.actionsBaseline)) return true;
  for (const [id, draft] of state.lineDrafts.entries()) {
    if (lineDirty(draft, state.lineBaselines.get(id))) return true;
  }
  return false;
}

function confirmLeaveDirty() {
  if (!workspaceIsDirty()) return true;
  return window.confirm("You have unsaved review edits. Discard them?");
}

function parseBoolSelect(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function chip(statusClass, label) {
  return `<span class="status-chip ${escapeHtml(statusClass)}">${escapeHtml(label)}</span>`;
}

function presentChip(flag, yesLabel = "Present", noLabel = "Not present") {
  return flag
    ? chip("success", yesLabel)
    : chip("neutral", noLabel);
}

function renderFilters() {
  const host = $("queueFilters");
  if (!host) return;
  host.innerHTML = QUEUE_FILTERS.map(
    (item) =>
      `<button type="button" class="lens-pill" data-filter="${escapeHtml(item.id)}" aria-pressed="${
        state.filterId === item.id ? "true" : "false"
      }">${escapeHtml(item.label)}</button>`,
  ).join("");
}

function renderKpis() {
  const kpis = queueKpis(state.queue);
  $("kpiProducts").textContent = String(kpis.products);
  $("kpiPending").textContent = String(kpis.pending);
  $("kpiInReview").textContent = String(kpis.inReview);
  $("kpiVerified").textContent = String(kpis.verified);
  $("kpiBlocked").textContent = String(kpis.blocked);
  $("kpiReady").textContent = String(kpis.ready);
}

function renderQueue() {
  const tbody = $("queueTbody");
  if (!tbody) return;
  const rows = filterQueueRows(state.queue, {
    filterId: state.filterId,
    search: state.search,
  });
  const count = $("queueRowCount");
  if (count) count.textContent = `${rows.length} shown`;
  if (!state.queue.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">No products in the e-Aushadhi review queue.</div></td></tr>`;
    return;
  }
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">No products match the current search or filter.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((row) => {
      const ready = row.is_ready_for_entry === true;
      return `<tr class="queue-row${idsEqual(row.product_id, state.selectedProductId) ? " is-active" : ""}" data-product-id="${escapeHtml(row.product_id)}">
        <td>${escapeHtml(displayText(row.product_name))}</td>
        <td>${escapeHtml(displayText(row.system_label))}</td>
        <td>${escapeHtml(displayText(row.medicine_class_label))}</td>
        <td>${escapeHtml(displayText(row.dosage_form_label))}</td>
        <td>${escapeHtml(displayText(row.subtype_label))}</td>
        <td>${chip(reviewStatusChipClass(row.review_status), displayText(row.review_status, "PENDING"))}</td>
        <td>${escapeHtml(formatVerifiedTotal(row.verified_lines, row.composition_lines))}</td>
        <td>${escapeHtml(String(toInt(row.open_blockers)))}</td>
        <td>${escapeHtml(String(toInt(row.open_portal_issues)))}</td>
        <td>${ready ? chip("success", "READY") : chip("neutral", "Not ready")}</td>
        <td>${chip(entryStatusChipClass(row.entry_status), normalizeEntryStatus(row.entry_status))}</td>
      </tr>`;
    })
    .join("");
}

function optionHtml(options, selectedId, extra = []) {
  const seen = new Set();
  const list = [...extra, ...(Array.isArray(options) ? options : [])];
  const parts = ['<option value="">Select…</option>'];
  for (const opt of list) {
    const id = optionId(opt?.portal_option_id ?? opt?.term_id ?? opt?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = displayText(opt?.label, id);
    const selected = idsEqual(id, selectedId) ? " selected" : "";
    parts.push(
      `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`,
    );
  }
  if (selectedId && !seen.has(String(selectedId))) {
    parts.push(
      `<option value="${escapeHtml(selectedId)}" selected>Current value ${escapeHtml(selectedId)}</option>`,
    );
  }
  return parts.join("");
}

function renderIssues(issues, emptyText) {
  const list = Array.isArray(issues) ? issues : [];
  if (!list.length) {
    return `<div class="muted-note">${escapeHtml(emptyText)}</div>`;
  }
  return list
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map((issue) => {
      const sev = severityLabel(issue.severity);
      const details = formatIssueDetails(issue.details_json);
      return `<div class="issue-row">
        <div><span class="sev-text">${escapeHtml(sev)}</span> ${chip(
          sev === "BLOCKER" || sev === "ERROR" ? "danger" : "warning",
          sev,
        )}</div>
        <div>
          <strong>${escapeHtml(displayText(issue.issue_code))}</strong>
          <div class="muted-note">${escapeHtml(displayText(issue.status))} ${
            issue.source_composition_line_id
              ? `· source line ${escapeHtml(issue.source_composition_line_id)}`
              : ""
          }</div>
          ${details ? `<div>${escapeHtml(details)}</div>` : ""}
        </div>
        <div class="muted-note">${escapeHtml(String(issue.created_at || "").slice(0, 19))}</div>
      </div>`;
    })
    .join("");
}

function renderOverview() {
  const host = $("tab-overview");
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Canonical product</h3>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Product Name</span><span class="meta-value">${escapeHtml(displayText(review.product_name || row.product_name))}</span></div>
        <div class="meta-item"><span class="meta-label">System</span><span class="meta-value">${escapeHtml(displayText(review.system_label || row.system_label))}</span></div>
        <div class="meta-item"><span class="meta-label">Medicine Class</span><span class="meta-value">${escapeHtml(displayText(review.medicine_class_label || row.medicine_class_label))}</span></div>
        <div class="meta-item"><span class="meta-label">Dosage Form</span><span class="meta-value">${escapeHtml(displayText(review.dosage_form_label || row.dosage_form_label))}</span></div>
        <div class="meta-item"><span class="meta-label">Product Subtype</span><span class="meta-value">${escapeHtml(displayText(review.subtype_label || row.subtype_label))}</span></div>
      </div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Review and readiness</h3>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Product Review</span><span>${chip(reviewStatusChipClass(review.review_status || row.review_status), displayText(review.review_status || row.review_status, "PENDING"))}</span></div>
        <div class="meta-item"><span class="meta-label">Composition</span><span class="meta-value">${escapeHtml(formatVerifiedTotal(row.verified_lines ?? evidence.composition_lines_verified, row.composition_lines ?? evidence.composition_lines_total))}</span></div>
        <div class="meta-item"><span class="meta-label">Open blockers</span><span class="meta-value">${escapeHtml(String(toInt(row.open_blockers)))}</span></div>
        <div class="meta-item"><span class="meta-label">Portal issues</span><span class="meta-value">${escapeHtml(String(toInt(row.open_portal_issues)))}</span></div>
        <div class="meta-item"><span class="meta-label">Approved Product Copy</span>${presentChip(evidence.approved_product_copy_present)}</div>
        <div class="meta-item"><span class="meta-label">Approved Formulation</span>${presentChip(evidence.approved_formulation_present)}</div>
        <div class="meta-item"><span class="meta-label">Pharmacological Action</span>${presentChip(evidence.pharmacological_action_present)}</div>
        <div class="meta-item"><span class="meta-label">READY FOR E-AUSHADHI</span>${row.is_ready_for_entry === true ? chip("success", "READY") : chip("neutral", "Not ready")}</div>
        <div class="meta-item"><span class="meta-label">Portal entry status</span>${chip(entryStatusChipClass(row.entry_status), normalizeEntryStatus(row.entry_status))} <span class="muted-note">Display only</span></div>
      </div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Live reconciliation issues</h3>
      ${renderIssues(state.issues, "No open or in-review issues for this product.")}
    </div>`;
}

function renderDetails() {
  const host = $("tab-details");
  const draft = state.detailsDraft || detailsDraftFromReview(state.review);
  const review = state.review || {};
  const suggested = review.suggested_permission_purpose_label
    ? `Suggested: ${review.suggested_permission_purpose_label}`
    : "";
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Product details review</h3>
      <p class="muted-note">Suggested values may be prefilled. Verification is always an explicit action. Current status: ${escapeHtml(displayText(review.review_status, "PENDING"))}.</p>
      <div class="form-grid">
        <div class="form-field">
          <label for="fldPurpose">Permission Purpose</label>
          <select id="fldPurpose" data-edit-action="true">${optionHtml(state.catalogs.permissionPurposeOptions, draft.permissionPurposeTermId)}</select>
          <span class="muted-note">${escapeHtml(suggested)}</span>
        </div>
        <div class="form-field form-span-2">
          <label for="fldTitle">Composition Title</label>
          <input id="fldTitle" data-edit-action="true" value="${escapeHtml(draft.compositionTitle || "")}" />
        </div>
        <div class="form-field form-span-2">
          <label for="fldDiseases">Diseases / Conditions</label>
          <textarea id="fldDiseases" rows="3" data-edit-action="true">${escapeHtml(draft.diseasesConditions || "")}</textarea>
        </div>
        ${[
          ["fldBhang", "Contains Bhang", draft.containsBhang],
          ["fldOpium", "Contains Opium", draft.containsOpium],
          ["fldNarcotic", "Contains Other Narcotic", draft.containsOtherNarcotic],
          ["fldSchedule", "Contains Schedule E1", draft.containsScheduleE1],
          ["fldAlcohol", "Contains Self-generated Alcohol", draft.containsSelfGeneratedAlcohol],
        ]
          .map(
            ([id, label, value]) => `<div class="form-field"><label for="${id}">${label}</label>
              <select id="${id}" data-edit-action="true">
                <option value=""${value == null ? " selected" : ""}>Select…</option>
                <option value="true"${value === true ? " selected" : ""}>Yes</option>
                <option value="false"${value === false ? " selected" : ""}>No</option>
              </select></div>`,
          )
          .join("")}
        <div class="form-field form-span-2">
          <label for="fldReviewNotes">Review notes</label>
          <textarea id="fldReviewNotes" rows="2" data-edit-action="true">${escapeHtml(draft.reviewNotes || "")}</textarea>
        </div>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnSaveDetails" data-edit-action="true">Save as In Review</button>
        <button type="button" class="icon-btn with-label primary" id="btnVerifyDetails" data-edit-action="true">Verify Product Details</button>
      </div>
    </div>`;
  applyPermissionUi();
}

function renderComposition() {
  const host = $("tab-composition");
  if (!state.lines.length) {
    host.innerHTML = `<div class="section-card empty-state">No composition lines returned for this product.</div>`;
    return;
  }
  const specs = portalFieldSpecs();
  host.innerHTML = state.lines
    .map((row) => {
      const id = optionId(row.source_composition_line_id);
      const draft = state.lineDrafts.get(id) || lineDraftFromRow(row);
      const lineIssues = issuesForLine(state.issues, id);
      const hasBlocker = lineIssues.some((issue) => severityRank(issue.severity) >= 3);
      const hasError = lineIssues.some((issue) => severityRank(issue.severity) === 2);
      const fields = specs
        .map((spec) => {
          const selectedNow = draft[spec.draftKey];
          const provenance = resolveFieldProvenance({
            reviewStatus: row.review_status,
            selectedId: selectedNow,
            suggestedId: row[spec.suggestedKey],
            suggestionBasis: row.suggestion_basis,
            fieldKey: SUGGESTION_FIELD_KEYS[spec.domain],
          });
          return `<div class="form-field">
            <label>${escapeHtml(spec.domain.replace(/_/g, " "))}</label>
            <select data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="${escapeHtml(spec.draftKey)}">
              ${optionHtml(state.catalogs.portalOptions[spec.domain], selectedNow)}
            </select>
            <span class="prov-chip" data-prov-for="${escapeHtml(id)}-${escapeHtml(spec.draftKey)}">${escapeHtml(provenanceLabel(provenance))}</span>
          </div>`;
        })
        .join("");
      return `<article class="line-card${hasBlocker ? " has-blocker" : hasError ? " has-error" : ""}" data-line-id="${escapeHtml(id)}">
        <div class="line-source">
          <div><span class="source-label">Source row</span>${escapeHtml(displayText(row.source_row_no))}</div>
          <div><span class="source-label">Source ingredient</span>${escapeHtml(displayText(row.raw_ingredient_name))}</div>
          <div><span class="source-label">Scientific name</span>${escapeHtml(displayText(row.raw_scientific_name))}</div>
          <div><span class="source-label">Raw part used</span>${escapeHtml(displayText(row.raw_part_used))}</div>
          <div><span class="source-label">Raw quantity</span>${escapeHtml(displayText(row.raw_quantity_text))}</div>
          <div><span class="source-label">Raw unit</span>${escapeHtml(displayText(row.raw_unit_text))}</div>
          <div><span class="source-label">Line review</span>${chip(reviewStatusChipClass(row.review_status), displayText(row.review_status, "PENDING"))}</div>
        </div>
        <div class="portal-fields">${fields}</div>
        <div class="form-field" style="margin-top:8px">
          <label>Line notes</label>
          <input data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="reviewNotes" value="${escapeHtml(draft.reviewNotes || "")}" />
        </div>
        ${
          lineIssues.length
            ? `<div class="section-title" style="margin-top:8px">Line issues</div>${renderIssues(lineIssues, "")}`
            : ""
        }
        <div class="action-row">
          <button type="button" class="icon-btn with-label" data-edit-action="true" data-line-save="${escapeHtml(id)}">Save as In Review</button>
          <button type="button" class="icon-btn with-label primary" data-edit-action="true" data-line-verify="${escapeHtml(id)}" ${
            lineHasBlockerOrError(state.issues, id) ? 'title="This line has BLOCKER or ERROR issues"' : ""
          }>Verify Line</button>
        </div>
      </article>`;
    })
    .join("");
  applyPermissionUi();
}

function renderActions() {
  const host = $("tab-actions");
  const vocab = state.catalogs.pharmacologicalActionOptions || [];
  const rows = state.actionsDraft.length ? state.actionsDraft : [""];
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Pharmacological action</h3>
      <p class="muted-note">Choose existing verified wording or type approved wording exactly. The module does not invent therapeutic claims.</p>
      <div class="action-list" id="actionList">
        ${rows
          .map((text, index) => {
            const match = vocab.find(
              (item) =>
                safeText(item.label).toLowerCase() === safeText(text).toLowerCase(),
            );
            return `<div class="action-item" data-action-index="${index}">
              <select data-edit-action="true" data-action-vocab="${index}">
                <option value="">Use typed wording</option>
                ${vocab
                  .map(
                    (item) =>
                      `<option value="${escapeHtml(item.label)}"${
                        match && idsEqual(item.term_id, match.term_id) ? " selected" : ""
                      }>${escapeHtml(item.label)}</option>`,
                  )
                  .join("")}
              </select>
              <input data-edit-action="true" data-action-text="${index}" value="${escapeHtml(text)}" placeholder="Approved pharmacological action wording" />
              <button type="button" class="icon-btn" data-edit-action="true" data-action-up="${index}" title="Move up">↑</button>
              <button type="button" class="icon-btn" data-edit-action="true" data-action-down="${index}" title="Move down">↓</button>
              <button type="button" class="icon-btn" data-edit-action="true" data-action-remove="${index}" title="Remove">×</button>
            </div>`;
          })
          .join("")}
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnAddAction" data-edit-action="true">Add action</button>
        <button type="button" class="icon-btn with-label" id="btnSaveActions" data-edit-action="true">Save as In Review</button>
        <button type="button" class="icon-btn with-label primary" id="btnVerifyActions" data-edit-action="true">Verify Actions</button>
      </div>
    </div>`;
  applyPermissionUi();
}

function renderEvidence() {
  const host = $("tab-evidence");
  const evidence = state.evidence || {};
  const row = state.queueRow || {};
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Evidence status</h3>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Approved Product Copy</span>${presentChip(evidence.approved_product_copy_present)}</div>
        <div class="meta-item"><span class="meta-label">Approved Formulation</span>${presentChip(evidence.approved_formulation_present)}</div>
        <div class="meta-item"><span class="meta-label">Pharmacological Action</span>${presentChip(evidence.pharmacological_action_present)}</div>
        <div class="meta-item"><span class="meta-label">Composition verified</span><span class="meta-value">${escapeHtml(formatVerifiedTotal(evidence.composition_lines_verified ?? row.verified_lines, evidence.composition_lines_total ?? row.composition_lines))}</span></div>
        <div class="meta-item"><span class="meta-label">Blocking issues</span><span class="meta-value">${escapeHtml(String(toInt(evidence.blocking_issue_count ?? row.open_blockers)))}</span></div>
      </div>
      <p class="muted-note">Approved Product Copy upload and registration are unavailable until the dedicated storage backend is enabled. This module does not upload to other buckets or accept a manual storage path.</p>
    </div>`;
}

function renderReadiness() {
  const host = $("tab-readiness");
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  const issueCount = openErrorOrBlockerCount(state.issues);
  const promoteOk = canPromoteFormulation({
    canEdit: canWrite(),
    productReviewStatus: review.review_status,
    compositionReviewComplete: row.composition_review_complete,
    verifiedLines: row.verified_lines ?? evidence.composition_lines_verified,
    compositionLines: row.composition_lines ?? evidence.composition_lines_total,
    openBlockers: row.open_blockers,
    errorOrBlockerIssueCount: issueCount,
    approvedFormulationPresent: evidence.approved_formulation_present,
    workflowRowVersion: row.workflow_row_version,
  });
  const verifyOk = canVerifyProductWorkflow({
    canEdit: canWrite(),
    compositionReviewComplete: row.composition_review_complete,
    verifiedLines: row.verified_lines ?? evidence.composition_lines_verified,
    compositionLines: row.composition_lines ?? evidence.composition_lines_total,
    openBlockers: row.open_blockers,
    workflowRowVersion: row.workflow_row_version,
  });
  const items = [
    ["Product Details VERIFIED", normalizeReviewStatus(review.review_status) === "VERIFIED"],
    ["Pharmacological Action present", evidence.pharmacological_action_present === true],
    ["Composition complete", row.composition_review_complete === true],
    ["Blocking issues clear", toInt(row.open_blockers) === 0 && issueCount === 0],
    ["Approved Product Copy present", evidence.approved_product_copy_present === true],
    ["Approved Formulation present", evidence.approved_formulation_present === true],
    ["Server READY FOR E-AUSHADHI", row.is_ready_for_entry === true],
  ];
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Readiness checklist</h3>
      <p class="muted-note">READY is the server queue flag. Verifying a form does not by itself mark a product ready for e-Aushadhi, and it does not mean portal entry has started.</p>
      ${items
        .map(
          ([label, ok]) =>
            `<div class="readiness-item"><span>${escapeHtml(label)}</span>${ok ? chip("success", "Met") : chip("neutral", "Not met")}</div>`,
        )
        .join("")}
      <div class="form-field" style="margin-top:12px">
        <label for="fldPromoteNotes">Promotion notes</label>
        <textarea id="fldPromoteNotes" rows="2" data-edit-action="true">${escapeHtml(state.promoteNotes)}</textarea>
      </div>
      <div class="form-field">
        <label for="fldVerifyNotes">Product verification notes</label>
        <textarea id="fldVerifyNotes" rows="2" data-edit-action="true">${escapeHtml(state.verifyNotes)}</textarea>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label primary" id="btnPromote" data-edit-action="true" ${
          promoteOk ? "" : 'data-force-disabled="true"'
        }>Promote Verified Formulation</button>
        <button type="button" class="icon-btn with-label" id="btnVerifyProduct" data-edit-action="true" ${
          verifyOk ? "" : 'data-force-disabled="true"'
        }>Verify Product</button>
      </div>
      <p class="muted-note">Portal entry statuses (${escapeHtml(normalizeEntryStatus(row.entry_status))}) are display-only in this module.</p>
    </div>`;
  applyPermissionUi();
}

function renderActiveTab() {
  const tab = state.tab;
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tab;
  });
  document.querySelectorAll(".workspace-tab").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.tab === tab));
  });
  if (tab === "overview") renderOverview();
  else if (tab === "details") renderDetails();
  else if (tab === "composition") renderComposition();
  else if (tab === "actions") renderActions();
  else if (tab === "evidence") renderEvidence();
  else if (tab === "readiness") renderReadiness();
}

function showWorkspace(show) {
  $("queuePanel").hidden = show;
  $("workspacePanel").hidden = !show;
}

function syncDetailsDraftFromForm() {
  if (!state.detailsDraft) return;
  state.detailsDraft = {
    ...state.detailsDraft,
    permissionPurposeTermId: optionId($("fldPurpose")?.value),
    compositionTitle: $("fldTitle")?.value ?? "",
    diseasesConditions: $("fldDiseases")?.value ?? "",
    containsBhang: parseBoolSelect($("fldBhang")?.value),
    containsOpium: parseBoolSelect($("fldOpium")?.value),
    containsOtherNarcotic: parseBoolSelect($("fldNarcotic")?.value),
    containsScheduleE1: parseBoolSelect($("fldSchedule")?.value),
    containsSelfGeneratedAlcohol: parseBoolSelect($("fldAlcohol")?.value),
    reviewNotes: $("fldReviewNotes")?.value ?? "",
  };
}

function applyWorkspacePayload(payload, { preserveDrafts = false } = {}) {
  state.review = payload.review;
  state.lines = payload.lines || [];
  state.actions = payload.actions || [];
  state.evidence = payload.evidence;
  state.issues = payload.issues || [];
  const freshDetails = detailsDraftFromReview(state.review);
  if (preserveDrafts && state.detailsDraft && detailsDirty(state.detailsDraft, state.detailsBaseline)) {
    state.detailsDraft = { ...state.detailsDraft, rowVersion: freshDetails.rowVersion };
  } else {
    state.detailsDraft = freshDetails;
  }
  state.detailsBaseline = freshDetails;

  const nextDrafts = new Map();
  const nextBaselines = new Map();
  for (const row of state.lines) {
    const id = optionId(row.source_composition_line_id);
    const fresh = lineDraftFromRow(row);
    nextBaselines.set(id, fresh);
    if (preserveDrafts) {
      const merged = mergePreservedLineDraft(row, state.lineDrafts.get(id));
      nextDrafts.set(id, merged.draft);
      if (merged.preserved) state.preservedAfterStale = true;
    } else {
      nextDrafts.set(id, fresh);
    }
  }
  state.lineDrafts = nextDrafts;
  state.lineBaselines = nextBaselines;

  const freshActions = actionsDraftFromRows(state.actions);
  if (preserveDrafts && actionsDirty(state.actionsDraft, state.actionsBaseline)) {
    state.actionsDraft = [...state.actionsDraft];
  } else {
    state.actionsDraft = freshActions;
  }
  state.actionsBaseline = freshActions;
  $("staleBanner").hidden = !state.preservedAfterStale;
}

async function refreshQueue({ silent = false } = {}) {
  const rows = await fetchProductQueue();
  state.queue = rows;
  if (state.selectedProductId) {
    state.queueRow = findQueueRow(state.queue, state.selectedProductId);
  }
  renderKpis();
  renderQueue();
  if (!silent) setStatus("");
}

async function openProduct(productId) {
  if (state.selectedProductId && !idsEqual(state.selectedProductId, productId)) {
    if (!confirmLeaveDirty()) return;
  }
  const gen = ++state.loadGen;
  state.busy = true;
  setStatus("Loading product review workspace…");
  try {
    const payload = await loadProductWorkspace(productId);
    if (gen !== state.loadGen) return;
    state.selectedProductId = Number(productId);
    state.queueRow = findQueueRow(state.queue, productId);
    state.tab = "overview";
    state.preservedAfterStale = false;
    applyWorkspacePayload(payload, { preserveDrafts: false });
    $("workspaceTitle").textContent = displayText(
      payload.review?.product_name || state.queueRow?.product_name,
      "Product",
    );
    $("workspaceSub").textContent = [
      displayText(state.queueRow?.system_label, ""),
      displayText(state.queueRow?.medicine_class_label, ""),
    ]
      .filter(Boolean)
      .join(" · ");
    showWorkspace(true);
    renderActiveTab();
    renderQueue();
    setStatus("");
  } catch (err) {
    toastError(err);
    setStatus(err.message || "Failed to load product.", "error");
  } finally {
    state.busy = false;
    applyPermissionUi();
  }
}

async function reloadSelected({ preserveDrafts = false } = {}) {
  if (!state.selectedProductId) return;
  const gen = ++state.loadGen;
  const payload = await loadProductWorkspace(state.selectedProductId);
  if (gen !== state.loadGen) return;
  await refreshQueue({ silent: true });
  applyWorkspacePayload(payload, { preserveDrafts });
  renderActiveTab();
}

function backToQueue() {
  if (!confirmLeaveDirty()) return;
  state.selectedProductId = null;
  state.queueRow = null;
  state.review = null;
  state.lines = [];
  state.actions = [];
  state.issues = [];
  state.detailsDraft = null;
  state.lineDrafts = new Map();
  state.preservedAfterStale = false;
  $("staleBanner").hidden = true;
  showWorkspace(false);
  renderQueue();
}

async function handleStale(err) {
  state.preservedAfterStale = true;
  showToast(err.message, "warning", 6400);
  try {
    await reloadSelected({ preserveDrafts: true });
  } catch (reloadErr) {
    toastError(reloadErr);
  }
}

async function runMutation(fn) {
  if (!canWrite()) {
    showToast("This action is not available with read-only access.", "error");
    return;
  }
  if (state.busy) return;
  state.busy = true;
  applyPermissionUi();
  try {
    await fn();
    state.preservedAfterStale = false;
    $("staleBanner").hidden = true;
  } catch (err) {
    console.error("[eaushadhi] mutation failed", err);
    if (err instanceof EaushadhiRpcError && err.kind === ERROR_KIND.STALE) {
      await handleStale(err);
    } else {
      toastError(err);
    }
  } finally {
    state.busy = false;
    applyPermissionUi();
  }
}

async function submitDetails(verify) {
  syncDetailsDraftFromForm();
  const draft = state.detailsDraft;
  await runMutation(async () => {
    await saveProductReview({
      productId: state.selectedProductId,
      expectedRowVersion: draft.rowVersion,
      permissionPurposeTermId: draft.permissionPurposeTermId,
      compositionTitle: safeText(draft.compositionTitle) || null,
      diseasesConditionsText: safeText(draft.diseasesConditions) || null,
      containsBhang: draft.containsBhang,
      containsOpium: draft.containsOpium,
      containsOtherNarcotic: draft.containsOtherNarcotic,
      containsScheduleE1: draft.containsScheduleE1,
      containsSelfGeneratedAlcohol: draft.containsSelfGeneratedAlcohol,
      reviewNotes: safeText(draft.reviewNotes) || null,
      verify,
    });
    showToast(verify ? "Product details verified." : "Product details saved.", "success");
    await reloadSelected();
  });
}

async function submitLine(lineId, verify) {
  const draft = state.lineDrafts.get(String(lineId));
  if (!draft) return;
  if (verify && !lineSelectionsComplete(draft)) {
    showToast("All four portal dropdowns are required before verifying a line.", "error");
    return;
  }
  await runMutation(async () => {
    await saveLineReview({
      sourceCompositionLineId: draft.sourceCompositionLineId,
      expectedRowVersion: draft.rowVersion,
      ingredientTypeOptionId: draft.ingredientTypeOptionId,
      ingredientFormOptionId: draft.ingredientFormOptionId,
      partUsedOptionId: draft.partUsedOptionId,
      measurementOptionId: draft.measurementOptionId,
      verify,
      reviewNotes: safeText(draft.reviewNotes) || null,
    });
    showToast(verify ? "Line verified." : "Line saved.", "success");
    await reloadSelected({ preserveDrafts: true });
  });
}

async function submitActions(verify) {
  const actions = state.actionsDraft.map((item) => safeText(item)).filter(Boolean);
  await runMutation(async () => {
    const result = await saveProductActions({
      productId: state.selectedProductId,
      expectedWorkflowRowVersion: state.queueRow?.workflow_row_version,
      actions,
      verify,
    });
    if (result?.workflow_row_version != null && state.queueRow) {
      state.queueRow.workflow_row_version = result.workflow_row_version;
    }
    showToast(verify ? "Pharmacological actions verified." : "Pharmacological actions saved.", "success");
    await reloadSelected();
  });
}

async function submitPromote() {
  state.promoteNotes = $("fldPromoteNotes")?.value || state.promoteNotes;
  await runMutation(async () => {
    await promoteVerifiedFormulation({
      productId: state.selectedProductId,
      expectedWorkflowRowVersion: state.queueRow?.workflow_row_version,
      approvalNotes: safeText(state.promoteNotes) || null,
    });
    showToast("Verified formulation promoted.", "success");
    await reloadSelected();
  });
}

async function submitVerifyProduct() {
  state.verifyNotes = $("fldVerifyNotes")?.value || state.verifyNotes;
  await runMutation(async () => {
    await verifyProduct({
      productId: state.selectedProductId,
      expectedRowVersion: state.queueRow?.workflow_row_version,
      notes: safeText(state.verifyNotes) || null,
    });
    showToast("Product internally verified. This is not portal entry.", "success");
    await reloadSelected();
  });
}

function wireEvents() {
  mountModuleActionIcons({
    home: $("homeBtn"),
    refresh: $("refreshBtn"),
    search: $("queueSearchClear"),
  });
  $("homeBtn")?.addEventListener("click", () => {
    if (!confirmLeaveDirty()) return;
    Platform.goHome();
  });
  $("refreshBtn")?.addEventListener("click", async () => {
    try {
      if (state.selectedProductId) await reloadSelected({ preserveDrafts: true });
      else await refreshQueue();
    } catch (err) {
      toastError(err);
    }
  });
  $("backToQueueBtn")?.addEventListener("click", backToQueue);
  $("queueSearch")?.addEventListener("input", (event) => {
    const value = event.target.value || "";
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = value;
      renderQueue();
    }, 180);
  });
  $("queueSearchClear")?.addEventListener("click", () => {
    $("queueSearch").value = "";
    state.search = "";
    renderQueue();
  });
  $("queueFilters")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-filter]");
    if (!btn) return;
    state.filterId = btn.dataset.filter;
    renderFilters();
    renderQueue();
  });
  $("queueTbody")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-product-id]");
    if (!row) return;
    openProduct(row.dataset.productId);
  });
  $("workspaceTabs")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn) return;
    const next = btn.dataset.tab;
    if (!WORKSPACE_TABS.includes(next)) return;
    if (state.tab === "details") syncDetailsDraftFromForm();
    state.tab = next;
    renderActiveTab();
  });

  $("tab-details")?.addEventListener("click", (event) => {
    if (event.target.id === "btnSaveDetails") submitDetails(false);
    if (event.target.id === "btnVerifyDetails") submitDetails(true);
  });
  $("tab-details")?.addEventListener("input", () => {
    if (state.tab === "details") syncDetailsDraftFromForm();
  });
  $("tab-details")?.addEventListener("change", () => {
    if (state.tab === "details") syncDetailsDraftFromForm();
  });

  $("tab-composition")?.addEventListener("change", (event) => {
    const el = event.target;
    const lineId = el.dataset.lineId;
    const key = el.dataset.draftKey;
    if (!lineId || !key) return;
    const draft = state.lineDrafts.get(String(lineId));
    if (!draft) return;
    draft[key] = key === "reviewNotes" ? el.value : optionId(el.value);
    const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
    const spec = portalFieldSpecs().find((item) => item.draftKey === key);
    if (row && spec) {
      const chipEl = document.querySelector(
        `[data-prov-for="${lineId}-${key}"]`,
      );
      if (chipEl) {
        chipEl.textContent = provenanceLabel(
          resolveFieldProvenance({
            reviewStatus: row.review_status,
            selectedId: draft[key],
            suggestedId: row[spec.suggestedKey],
            suggestionBasis: row.suggestion_basis,
            fieldKey: SUGGESTION_FIELD_KEYS[spec.domain],
          }),
        );
      }
    }
  });
  $("tab-composition")?.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.draftKey !== "reviewNotes") return;
    const draft = state.lineDrafts.get(String(el.dataset.lineId));
    if (draft) draft.reviewNotes = el.value;
  });
  $("tab-composition")?.addEventListener("click", (event) => {
    const save = event.target.closest("[data-line-save]");
    const verify = event.target.closest("[data-line-verify]");
    if (save) submitLine(save.dataset.lineSave, false);
    if (verify) submitLine(verify.dataset.lineVerify, true);
  });

  $("tab-actions")?.addEventListener("click", (event) => {
    if (event.target.id === "btnAddAction") {
      state.actionsDraft = [...state.actionsDraft, ""];
      renderActions();
      return;
    }
    if (event.target.id === "btnSaveActions") {
      submitActions(false);
      return;
    }
    if (event.target.id === "btnVerifyActions") {
      submitActions(true);
      return;
    }
    const up = event.target.closest("[data-action-up]");
    const down = event.target.closest("[data-action-down]");
    const remove = event.target.closest("[data-action-remove]");
    if (up) {
      const i = Number(up.dataset.actionUp);
      if (i > 0) {
        const next = [...state.actionsDraft];
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
        state.actionsDraft = next;
        renderActions();
      }
    }
    if (down) {
      const i = Number(down.dataset.actionDown);
      if (i < state.actionsDraft.length - 1) {
        const next = [...state.actionsDraft];
        [next[i + 1], next[i]] = [next[i], next[i + 1]];
        state.actionsDraft = next;
        renderActions();
      }
    }
    if (remove) {
      const i = Number(remove.dataset.actionRemove);
      state.actionsDraft = state.actionsDraft.filter((_, idx) => idx !== i);
      if (!state.actionsDraft.length) state.actionsDraft = [""];
      renderActions();
    }
  });
  $("tab-actions")?.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.actionText == null) return;
    const i = Number(el.dataset.actionText);
    state.actionsDraft[i] = el.value;
  });
  $("tab-actions")?.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.actionVocab == null) return;
    const i = Number(el.dataset.actionVocab);
    if (el.value) {
      state.actionsDraft[i] = el.value;
      const input = document.querySelector(`[data-action-text="${i}"]`);
      if (input) input.value = el.value;
    }
  });

  $("tab-readiness")?.addEventListener("click", (event) => {
    if (event.target.id === "btnPromote") submitPromote();
    if (event.target.id === "btnVerifyProduct") submitVerifyProduct();
  });
  $("tab-readiness")?.addEventListener("input", (event) => {
    if (event.target.id === "fldPromoteNotes") state.promoteNotes = event.target.value;
    if (event.target.id === "fldVerifyNotes") state.verifyNotes = event.target.value;
  });

  window.addEventListener("beforeunload", (event) => {
    if (!workspaceIsDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function loadAccessState() {
  access.userId = null;
  access.canView = false;
  access.canEdit = false;
  access.loaded = false;
  access.loadError = false;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user?.id) {
    window.location.href = "/login.html";
    throw sessionError || new Error("No active session");
  }
  access.userId = session.user.id;

  const { data: perms, error } = await supabase.rpc("get_user_permissions", {
    p_user_id: access.userId,
  });
  if (error || !Array.isArray(perms)) {
    access.loadError = true;
    access.loaded = true;
    console.error("[eaushadhi] get_user_permissions failed", error || perms);
    return;
  }
  const hit = perms.find(
    (row) => row?.target === "module:e-aushadhi-automation",
  );
  access.canView = hit?.can_view === true;
  access.canEdit = hit?.can_edit === true;
  access.loaded = true;
}

async function initPage() {
  renderFilters();
  wireEvents();
  try {
    await loadAccessState();
  } catch (err) {
    console.error("[eaushadhi] session failed", err);
    return;
  }
  if (access.loadError) {
    setAccessDenied("Permission check failed. The module is closed until access can be confirmed.");
    return;
  }
  if (access.canView !== true) {
    setAccessDenied("You do not have permission to open e-Aushadhi Review & Control.");
    return;
  }
  applyPermissionUi();
  setStatus("Loading product queue…");
  try {
    const [queueRows, catalogs] = await Promise.all([
      fetchProductQueue(),
      loadSessionCatalogs(),
    ]);
    state.queue = queueRows;
    state.catalogs = catalogs;
    renderKpis();
    renderQueue();
    setStatus("");
  } catch (err) {
    console.error("[eaushadhi] initial load failed", err);
    toastError(err);
    setStatus(err.message || "Failed to load the product queue.", "error");
  }
}

initPage();
