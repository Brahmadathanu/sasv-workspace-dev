import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { mountModuleActionIcons } from "./sasv-module-chrome.js";
import { showToast } from "./toast.js";
import {
  CLASS_LENSES,
  ERROR_KIND,
  QUEUE_RENDER_CHUNK,
  REVIEW_LENSES,
  SYSTEM_LENSES,
  WORKFLOW_STAGES,
  WORKSPACE_TABS,
  actionsDirty,
  actionsDraftFromRows,
  canPromoteFormulation,
  canVerifyProductWorkflow,
  compositionIsComplete,
  detailsDraftFromReview,
  detailsDirty,
  displayText,
  entryStatusChipClass,
  findQueueRow,
  filterQueueRows,
  formatIssueDetails,
  formatShowingCount,
  formatVerifiedTotal,
  idsEqual,
  issuesForLine,
  lineDirty,
  lineDraftFromRow,
  lineHasBlockerOrError,
  lineSelectionsComplete,
  mergePreservedLineDraft,
  nextQueueRenderCount,
  nextRequiredAction,
  normalizeEntryStatus,
  normalizeReviewStatus,
  openErrorOrBlockerCount,
  optionId,
  portalFieldSpecs,
  provenanceLabel,
  queueKpis,
  resetQueueRenderCount,
  resolveFieldProvenance,
  reviewStatusChipClass,
  safeText,
  severityLabel,
  severityRank,
  shouldAppendQueueChunk,
  SUGGESTION_FIELD_KEYS,
  toInt,
  visibleQueueRows,
  workflowStageComplete,
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
  queueView: {
    search: "",
    reviewLens: "all",
    systemLens: "all",
    classLens: "all",
    renderedCount: QUEUE_RENDER_CHUNK,
    scrollTop: 0,
  },
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

function setAppMode(mode) {
  document.body.classList.toggle("ea-mode-queue", mode === "queue");
  document.body.classList.toggle("ea-mode-product", mode === "product");
}

function isProductMode() {
  return document.body.classList.contains("ea-mode-product");
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

function chip(statusClass, label) {
  return `<span class="status-chip ${escapeHtml(statusClass)}">${escapeHtml(label)}</span>`;
}

function provenanceChipHtml(lineId, draftKey, provenance) {
  const code = provenance || "no_suggestion";
  return `<span class="prov-chip" data-provenance="${escapeHtml(code)}" data-prov-for="${escapeHtml(lineId)}-${escapeHtml(draftKey)}">${escapeHtml(provenanceLabel(code))}</span>`;
}

function filteredQueue() {
  return filterQueueRows(state.queue, {
    search: state.queueView.search,
    reviewLens: state.queueView.reviewLens,
    systemLens: state.queueView.systemLens,
    classLens: state.queueView.classLens,
  });
}

function saveQueueScroll() {
  const wrap = $("queueTableWrap");
  if (wrap) state.queueView.scrollTop = wrap.scrollTop;
}

function restoreQueueScroll() {
  const wrap = $("queueTableWrap");
  if (!wrap) return;
  wrap.scrollTop = state.queueView.scrollTop;
}

function resetQueueChunkAndScroll() {
  const filtered = filteredQueue();
  state.queueView.renderedCount = resetQueueRenderCount(filtered.length);
  state.queueView.scrollTop = 0;
  const wrap = $("queueTableWrap");
  if (wrap) wrap.scrollTop = 0;
}

function syncSearchClear() {
  const clear = $("queueSearchClear");
  if (clear) clear.hidden = !safeText(state.queueView.search);
}

function renderKpis() {
  const host = $("kpiStrip");
  if (!host) return;
  const kpis = queueKpis(state.queue);
  const items = [
    ["all", "products", "Products", kpis.products, "is-products"],
    ["pending", "pending", "Pending", kpis.pending, "is-pending"],
    ["in_review", "in_review", "In Review", kpis.inReview, "is-in-review"],
    ["verified", "verified", "Verified", kpis.verified, "is-verified"],
    ["blocked", "blocked", "Blocked", kpis.blocked, "is-blocked"],
    ["ready", "ready", "Ready", kpis.ready, "is-ready"],
  ];
  host.innerHTML = items
    .map(([lens, key, label, value, tone]) => {
      const active = state.queueView.reviewLens === lens;
      return `<button type="button" class="kpi ${tone}${active ? " is-active" : ""}" data-review-lens="${escapeHtml(lens)}" data-kpi="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}">
        <span class="kpi-label">${escapeHtml(label)}</span>
        <span class="kpi-value">${escapeHtml(String(value))}</span>
      </button>`;
    })
    .join("");
}

function renderLensGroup(hostId, items, current, attr) {
  const host = $(hostId);
  if (!host) return;
  host.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="${hostId === "reviewLenses" ? "review-lens" : "lens-pill"}" data-${attr}="${escapeHtml(item.id)}" aria-pressed="${
          current === item.id ? "true" : "false"
        }">${escapeHtml(item.label)}</button>`,
    )
    .join("");
}

function renderLenses() {
  renderLensGroup("reviewLenses", REVIEW_LENSES, state.queueView.reviewLens, "review-lens");
  renderLensGroup("systemLenses", SYSTEM_LENSES, state.queueView.systemLens, "system-lens");
  renderLensGroup("classLenses", CLASS_LENSES, state.queueView.classLens, "class-lens");
}

function queueRowHtml(row) {
  const ready = row.is_ready_for_entry === true;
  const blockers = toInt(row.open_blockers);
  const portal = toInt(row.open_portal_issues);
  const issues =
    blockers || portal
      ? `B ${blockers} · P ${portal}`
      : "None";
  return `<tr class="queue-row" data-product-id="${escapeHtml(row.product_id)}">
    <td class="cell-product">${escapeHtml(displayText(row.product_name))}</td>
    <td><div class="cell-stack"><span class="primary">${escapeHtml(displayText(row.system_label))}</span><span class="secondary">${escapeHtml(displayText(row.medicine_class_label))}</span></div></td>
    <td><div class="cell-stack"><span class="primary">${escapeHtml(displayText(row.dosage_form_label))}</span><span class="secondary">${escapeHtml(displayText(row.subtype_label))}</span></div></td>
    <td>${chip(reviewStatusChipClass(row.review_status), displayText(row.review_status, "PENDING"))}</td>
    <td class="num-cell">${escapeHtml(formatVerifiedTotal(row.verified_lines, row.composition_lines))}</td>
    <td class="num-cell">${escapeHtml(issues)}</td>
    <td>${ready ? chip("success", "READY") : chip("neutral", "Not ready")}</td>
    <td>${chip(entryStatusChipClass(row.entry_status), normalizeEntryStatus(row.entry_status))}</td>
  </tr>`;
}

function updateShowingCount(shown, total) {
  const count = $("queueRowCount");
  if (count) count.textContent = formatShowingCount(shown, total);
}

function paintQueueBody(rows, emptyMessage) {
  const tbody = $("queueTbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${escapeHtml(emptyMessage)}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(queueRowHtml).join("");
}

function renderQueue({ resetChunk = false, restoreScroll = false } = {}) {
  const filtered = filteredQueue();
  if (resetChunk) resetQueueChunkAndScroll();
  if (state.queueView.renderedCount <= 0 && filtered.length) {
    state.queueView.renderedCount = resetQueueRenderCount(filtered.length);
  }
  if (state.queueView.renderedCount > filtered.length) {
    state.queueView.renderedCount = filtered.length;
  }
  const visible = visibleQueueRows(filtered, state.queueView.renderedCount);
  updateShowingCount(visible.length, filtered.length);
  if (!state.queue.length) {
    paintQueueBody([], "No products in the e-Aushadhi review queue.");
  } else if (!filtered.length) {
    paintQueueBody([], "No products match the current search or filter.");
  } else {
    paintQueueBody(visible, "");
  }
  if (restoreScroll) {
    requestAnimationFrame(() => restoreQueueScroll());
  }
}

function appendQueueChunk() {
  if (isProductMode()) return;
  const wrap = $("queueTableWrap");
  const tbody = $("queueTbody");
  if (!wrap || !tbody) return;
  const filtered = filteredQueue();
  if (state.queueView.renderedCount >= filtered.length) return;
  if (
    !shouldAppendQueueChunk({
      scrollTop: wrap.scrollTop,
      clientHeight: wrap.clientHeight,
      scrollHeight: wrap.scrollHeight,
    })
  ) {
    return;
  }
  const next = nextQueueRenderCount(state.queueView.renderedCount, filtered.length);
  const extra = filtered.slice(state.queueView.renderedCount, next);
  if (!extra.length) return;
  const empty = tbody.querySelector(".empty-state");
  if (empty) tbody.innerHTML = "";
  tbody.insertAdjacentHTML("beforeend", extra.map(queueRowHtml).join(""));
  state.queueView.renderedCount = next;
  updateShowingCount(Math.min(next, filtered.length), filtered.length);
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
    return emptyText ? `<div class="muted-note">${escapeHtml(emptyText)}</div>` : "";
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
          ${details ? `<div class="muted-note">${escapeHtml(details)}</div>` : ""}
        </div>
        <div class="muted-note">${escapeHtml(String(issue.created_at || "").slice(0, 19))}</div>
      </div>`;
    })
    .join("");
}

function stageCtx() {
  return {
    queueRow: state.queueRow || {},
    evidence: state.evidence || {},
    review: state.review || {},
  };
}

function renderWorkflowNav() {
  const host = $("workspaceTabs");
  if (!host) return;
  const ctx = stageCtx();
  host.innerHTML = WORKFLOW_STAGES.map((stage) => {
    const selected = state.tab === stage.id;
    const complete = workflowStageComplete(stage.id, ctx);
    return `<button type="button" class="workflow-step${complete ? " is-complete" : ""}" data-tab="${escapeHtml(stage.id)}" aria-selected="${selected ? "true" : "false"}">
      <span class="step-no">${escapeHtml(String(stage.step))}</span>
      <span>${escapeHtml(stage.label)}</span>
    </button>`;
  }).join("");
}

function renderProductHeader() {
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  $("workspaceTitle").textContent = displayText(
    review.product_name || row.product_name,
    "Product",
  );
  const meta = [
    displayText(row.system_label, ""),
    displayText(row.medicine_class_label, ""),
    [displayText(row.dosage_form_label, ""), displayText(row.subtype_label, "")]
      .filter((part) => part && part !== "—")
      .join(" / "),
  ]
    .filter((part) => part && part !== "—")
    .join(" · ");
  $("workspaceMeta").textContent = meta;
  const badges = $("workspaceBadges");
  if (badges) {
    badges.innerHTML = [
      chip(
        reviewStatusChipClass(review.review_status || row.review_status),
        displayText(review.review_status || row.review_status, "PENDING"),
      ),
      `<span class="status-chip neutral">Composition ${escapeHtml(
        formatVerifiedTotal(
          row.verified_lines ?? evidence.composition_lines_verified,
          row.composition_lines ?? evidence.composition_lines_total,
        ),
      )}</span>`,
      row.is_ready_for_entry === true
        ? chip("success", "READY")
        : chip("neutral", "Not ready"),
    ].join("");
  }
}

function boolSegment(key, label, value) {
  const current = value === true ? "true" : value === false ? "false" : "";
  return `<div class="form-field">
    <label>${escapeHtml(label)}</label>
    <div class="seg-control" data-bool-key="${escapeHtml(key)}">
      <button type="button" data-edit-action="true" data-bool-value="true" aria-pressed="${current === "true"}">Yes</button>
      <button type="button" data-edit-action="true" data-bool-value="false" aria-pressed="${current === "false"}">No</button>
      <button type="button" data-edit-action="true" data-bool-value="" aria-pressed="${current === ""}">Not reviewed</button>
    </div>
  </div>`;
}

function parseBoolButton(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function renderOverview() {
  const host = $("tab-overview");
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  const ctx = stageCtx();
  const next = nextRequiredAction({
    reviewStatus: review.review_status || row.review_status,
    queueRow: row,
    evidence,
    pharmacologicalActionPresent: evidence.pharmacological_action_present,
  });
  const progress = [
    ["Product Details", "details"],
    ["Composition", "composition"],
    ["Pharmacological Action", "actions"],
    ["Evidence", "evidence"],
    ["Readiness", "readiness"],
  ];
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">What is this product?</h3>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Product Name</span><span class="meta-value">${escapeHtml(displayText(review.product_name || row.product_name))}</span></div>
        <div class="meta-item"><span class="meta-label">System</span><span class="meta-value">${escapeHtml(displayText(row.system_label))}</span></div>
        <div class="meta-item"><span class="meta-label">Medicine Class</span><span class="meta-value">${escapeHtml(displayText(row.medicine_class_label))}</span></div>
        <div class="meta-item"><span class="meta-label">Dosage / Subtype</span><span class="meta-value">${escapeHtml(displayText(row.dosage_form_label))} / ${escapeHtml(displayText(row.subtype_label))}</span></div>
      </div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Review Progress</h3>
      <div class="progress-list">
        ${progress
          .map(
            ([label, id]) =>
              `<div class="progress-row"><span>${escapeHtml(label)}</span>${
                workflowStageComplete(id, ctx)
                  ? chip("success", "Complete")
                  : chip("neutral", "Incomplete")
              }</div>`,
          )
          .join("")}
      </div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Next required action</h3>
      <div class="next-action">${escapeHtml(next.label)}</div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Attention required</h3>
      ${renderIssues(state.issues, "No open issues for this product.")}
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
      <h3 class="section-title">Regulatory purpose</h3>
      <div class="form-field">
        <label for="fldPurpose">Permission Purpose</label>
        <select id="fldPurpose" data-edit-action="true">${optionHtml(state.catalogs.permissionPurposeOptions, draft.permissionPurposeTermId)}</select>
        <span class="muted-note">${escapeHtml(suggested)}</span>
      </div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Product description</h3>
      <div class="form-field">
        <label for="fldTitle">Composition Title</label>
        <input id="fldTitle" data-edit-action="true" value="${escapeHtml(draft.compositionTitle || "")}" />
      </div>
      <div class="form-field">
        <label for="fldDiseases">Diseases / Conditions</label>
        <textarea id="fldDiseases" rows="3" data-edit-action="true">${escapeHtml(draft.diseasesConditions || "")}</textarea>
      </div>
    </div>
    <div class="section-card">
      <h3 class="section-title">Controlled declarations</h3>
      <p class="muted-note">Null remains Not reviewed. These controls never default to No.</p>
      <div class="form-grid">
        ${boolSegment("containsBhang", "Bhang", draft.containsBhang)}
        ${boolSegment("containsOpium", "Opium", draft.containsOpium)}
        ${boolSegment("containsOtherNarcotic", "Other Narcotic", draft.containsOtherNarcotic)}
        ${boolSegment("containsScheduleE1", "Schedule E1", draft.containsScheduleE1)}
        ${boolSegment("containsSelfGeneratedAlcohol", "Self-generated Alcohol", draft.containsSelfGeneratedAlcohol)}
      </div>
      <div class="form-field" style="margin-top:10px">
        <label for="fldReviewNotes">Review notes</label>
        <textarea id="fldReviewNotes" rows="2" data-edit-action="true">${escapeHtml(draft.reviewNotes || "")}</textarea>
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
  const labels = {
    INGREDIENT_TYPE: "Ingredient Type",
    INGREDIENT_FORM: "Ingredient Form",
    PART_USED: "Part Used",
    MEASUREMENT_UNIT: "Unit",
  };
  host.innerHTML = state.lines
    .map((row) => {
      const id = optionId(row.source_composition_line_id);
      const draft = state.lineDrafts.get(id) || lineDraftFromRow(row);
      const lineIssues = issuesForLine(state.issues, id);
      const hasBlocker = lineIssues.some((issue) => severityRank(issue.severity) >= 3);
      const hasError = lineIssues.some((issue) => severityRank(issue.severity) === 2);
      const topSev = lineIssues
        .slice()
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
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
          return `<div class="portal-field form-field">
            <label>${escapeHtml(labels[spec.domain] || spec.domain)}</label>
            <select data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="${escapeHtml(spec.draftKey)}">
              ${optionHtml(state.catalogs.portalOptions[spec.domain], selectedNow)}
            </select>
            ${provenanceChipHtml(id, spec.draftKey, provenance)}
          </div>`;
        })
        .join("");
      const qty = [displayText(row.raw_quantity_text, ""), displayText(row.raw_unit_text, "")]
        .filter((part) => part && part !== "—")
        .join(" ");
      const names = [displayText(row.raw_ingredient_name), displayText(row.raw_scientific_name)]
        .filter((part) => part && part !== "—")
        .join(" · ");
      return `<article class="line-card${hasBlocker ? " has-blocker" : hasError ? " has-error" : ""}" data-line-id="${escapeHtml(id)}">
        <div class="line-head">
          <span class="line-no">${escapeHtml(displayText(row.source_row_no))}</span>
          <span class="line-title">${escapeHtml(names)}</span>
          <span class="line-qty">${escapeHtml(qty || "—")}</span>
          ${chip(reviewStatusChipClass(row.review_status), displayText(row.review_status, "PENDING"))}
          ${
            topSev
              ? chip(
                  severityRank(topSev.severity) >= 2 ? "danger" : "warning",
                  severityLabel(topSev.severity),
                )
              : ""
          }
        </div>
        <div class="line-sub">Source part: ${escapeHtml(displayText(row.raw_part_used))}</div>
        <div class="portal-fields">${fields}</div>
        <div class="line-notes-row">
          <input data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="reviewNotes" value="${escapeHtml(draft.reviewNotes || "")}" placeholder="Notes" />
          <button type="button" class="icon-btn with-label" data-edit-action="true" data-line-save="${escapeHtml(id)}">Save</button>
          <button type="button" class="icon-btn with-label primary" data-edit-action="true" data-line-verify="${escapeHtml(id)}" ${
            lineHasBlockerOrError(state.issues, id)
              ? 'title="This line has BLOCKER or ERROR issues"'
              : ""
          }>Verify</button>
        </div>
        ${
          lineIssues.length
            ? `<div class="line-issues">${renderIssues(lineIssues, "")}</div>`
            : ""
        }
      </article>`;
    })
    .join("");
  applyPermissionUi();
}

function renderActions() {
  const host = $("tab-actions");
  const vocab = state.catalogs.pharmacologicalActionOptions || [];
  const rows = state.actionsDraft;
  const empty = !rows.length;
  const showReorder = rows.length > 1;
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Pharmacological action</h3>
      ${
        empty
          ? `<div class="empty-state">No pharmacological action reviewed yet.</div>`
          : `<div class="action-list" id="actionList">
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
              <input data-edit-action="true" data-action-text="${index}" value="${escapeHtml(text)}" placeholder="Enter exact approved wording" />
              ${
                showReorder
                  ? `<button type="button" class="icon-btn" data-edit-action="true" data-action-up="${index}" title="Move up">↑</button>
              <button type="button" class="icon-btn" data-edit-action="true" data-action-down="${index}" title="Move down">↓</button>`
                  : ""
              }
              <button type="button" class="icon-btn" data-edit-action="true" data-action-remove="${index}" title="Remove">×</button>
            </div>`;
          })
          .join("")}
      </div>`
      }
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnAddAction" data-edit-action="true">Add Action</button>
        <button type="button" class="icon-btn with-label" id="btnSaveActions" data-edit-action="true">Save as In Review</button>
        <button type="button" class="icon-btn with-label primary" id="btnVerifyActions" data-edit-action="true">Verify Actions</button>
      </div>
    </div>`;
  applyPermissionUi();
}

function evidenceCard(title, met, pendingCopy) {
  return `<div class="evidence-card ${met ? "is-met" : "is-pending"}">
    <div>
      <strong>${escapeHtml(title)}</strong>
      ${!met && pendingCopy ? `<div class="muted-note">${escapeHtml(pendingCopy)}</div>` : ""}
    </div>
    ${met ? chip("success", "Present") : chip("neutral", "Pending")}
  </div>`;
}

function renderEvidence() {
  const host = $("tab-evidence");
  const evidence = state.evidence || {};
  const row = state.queueRow || {};
  const blocking = toInt(evidence.blocking_issue_count ?? row.open_blockers);
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Evidence status</h3>
      <div class="evidence-list">
        ${evidenceCard(
          "Approved Product Copy",
          evidence.approved_product_copy_present === true,
          "Upload setup pending. Dedicated copy storage is not enabled yet.",
        )}
        ${evidenceCard(
          "Approved Formulation",
          evidence.approved_formulation_present === true,
          "Promote a verified formulation when eligible.",
        )}
        ${evidenceCard(
          "Pharmacological Action",
          evidence.pharmacological_action_present === true,
        )}
        ${evidenceCard(
          "Composition verification",
          compositionIsComplete(row, evidence),
          formatVerifiedTotal(
            evidence.composition_lines_verified ?? row.verified_lines,
            evidence.composition_lines_total ?? row.composition_lines,
          ),
        )}
        <div class="evidence-card ${blocking ? "is-pending" : "is-met"}">
          <div><strong>Blocking issues</strong></div>
          ${blocking ? chip("danger", String(blocking)) : chip("success", "None")}
        </div>
      </div>
    </div>`;
}

function gateStatus(met, blocked) {
  if (blocked) return { label: "Blocked", cls: "danger" };
  if (met) return { label: "Met", cls: "success" };
  return { label: "Pending", cls: "neutral" };
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
  const blockersClear = toInt(row.open_blockers) === 0 && issueCount === 0;
  const gates = [
    ["Product Details", normalizeReviewStatus(review.review_status) === "VERIFIED", false],
    ["Pharmacological Action", evidence.pharmacological_action_present === true, false],
    ["Composition", compositionIsComplete(row, evidence), false],
    ["Blocking issues", blockersClear, !blockersClear],
    ["Approved Product Copy", evidence.approved_product_copy_present === true, false],
    ["Approved Formulation", evidence.approved_formulation_present === true, false],
  ];
  const ready = row.is_ready_for_entry === true;
  const showPromote = evidence.approved_formulation_present !== true;
  const showVerify = ready !== true;
  host.innerHTML = `
    <div class="section-card">
      <div class="readiness-banner ${ready ? "is-ready" : "is-not-ready"}">${
        ready ? "READY FOR E-AUSHADHI" : "NOT READY"
      }</div>
      <div class="readiness-compact">
        ${gates
          .map(([label, met, blocked]) => {
            const status = gateStatus(met, blocked);
            return `<div class="readiness-chip"><span>${escapeHtml(label)}</span>${chip(status.cls, status.label)}</div>`;
          })
          .join("")}
      </div>
      ${
        showPromote
          ? `<div class="form-field" style="margin-top:12px">
        <label for="fldPromoteNotes">Promotion notes</label>
        <textarea id="fldPromoteNotes" rows="2" data-edit-action="true">${escapeHtml(state.promoteNotes)}</textarea>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label primary" id="btnPromote" data-edit-action="true" ${
          promoteOk ? "" : 'data-force-disabled="true" title="Promotion prerequisites are not met"'
        }>Promote Verified Formulation</button>
      </div>`
          : ""
      }
      ${
        showVerify
          ? `<div class="form-field" style="margin-top:12px">
        <label for="fldVerifyNotes">Internal product verification notes</label>
        <textarea id="fldVerifyNotes" rows="2" data-edit-action="true">${escapeHtml(state.verifyNotes)}</textarea>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnVerifyProduct" data-edit-action="true" ${
          verifyOk ? "" : 'data-force-disabled="true" title="Internal verification prerequisites are not met"'
        }>Verify Product internally</button>
      </div>`
          : ""
      }
      <p class="muted-note">These actions prepare internal records only. They do not enter or submit the Government portal.</p>
      <p class="muted-note">Portal entry statuses (${escapeHtml(normalizeEntryStatus(row.entry_status))}) are display-only in this module.</p>
    </div>`;
  applyPermissionUi();
}

function renderActiveTab() {
  const tab = state.tab;
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tab;
  });
  renderWorkflowNav();
  if (tab === "overview") renderOverview();
  else if (tab === "details") renderDetails();
  else if (tab === "composition") renderComposition();
  else if (tab === "actions") renderActions();
  else if (tab === "evidence") renderEvidence();
  else if (tab === "readiness") renderReadiness();
}

function syncDetailsDraftFromForm() {
  if (!state.detailsDraft) return;
  state.detailsDraft = {
    ...state.detailsDraft,
    permissionPurposeTermId: optionId($("fldPurpose")?.value),
    compositionTitle: $("fldTitle")?.value ?? "",
    diseasesConditions: $("fldDiseases")?.value ?? "",
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
  renderLenses();
  if (!isProductMode()) renderQueue();
  if (isProductMode()) renderProductHeader();
  if (!silent) setStatus("");
}

async function openProduct(productId) {
  if (state.selectedProductId && !idsEqual(state.selectedProductId, productId)) {
    if (!confirmLeaveDirty()) return;
  }
  saveQueueScroll();
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
    setAppMode("product");
    renderProductHeader();
    renderActiveTab();
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
  renderProductHeader();
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
  setAppMode("queue");
  renderKpis();
  renderLenses();
  syncSearchClear();
  const search = $("queueSearch");
  if (search) search.value = state.queueView.search;
  renderQueue({ restoreScroll: true });
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

function applyQueueFilterChange() {
  renderKpis();
  renderLenses();
  renderQueue({ resetChunk: true });
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
      state.queueView.search = value;
      syncSearchClear();
      applyQueueFilterChange();
    }, 180);
  });
  $("queueSearchClear")?.addEventListener("click", () => {
    $("queueSearch").value = "";
    state.queueView.search = "";
    syncSearchClear();
    applyQueueFilterChange();
  });
  $("kpiStrip")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-review-lens]");
    if (!btn) return;
    state.queueView.reviewLens = btn.dataset.reviewLens || "all";
    applyQueueFilterChange();
  });
  $("reviewLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-review-lens]");
    if (!btn) return;
    state.queueView.reviewLens = btn.dataset.reviewLens || "all";
    applyQueueFilterChange();
  });
  $("systemLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-system-lens]");
    if (!btn) return;
    state.queueView.systemLens = btn.dataset.systemLens || "all";
    applyQueueFilterChange();
  });
  $("classLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-class-lens]");
    if (!btn) return;
    state.queueView.classLens = btn.dataset.classLens || "all";
    applyQueueFilterChange();
  });
  $("queueTableWrap")?.addEventListener(
    "scroll",
    () => {
      state.queueView.scrollTop = $("queueTableWrap")?.scrollTop || 0;
      appendQueueChunk();
    },
    { passive: true },
  );
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
    const boolBtn = event.target.closest("[data-bool-value]");
    if (boolBtn && state.detailsDraft) {
      const group = boolBtn.closest("[data-bool-key]");
      const key = group?.dataset.boolKey;
      if (key) {
        state.detailsDraft[key] = parseBoolButton(boolBtn.dataset.boolValue);
        group.querySelectorAll("[data-bool-value]").forEach((el) => {
          el.setAttribute("aria-pressed", String(el === boolBtn));
        });
      }
    }
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
      const chipEl = document.querySelector(`[data-prov-for="${lineId}-${key}"]`);
      if (chipEl) {
        const next = resolveFieldProvenance({
          reviewStatus: row.review_status,
          selectedId: draft[key],
          suggestedId: row[spec.suggestedKey],
          suggestionBasis: row.suggestion_basis,
          fieldKey: SUGGESTION_FIELD_KEYS[spec.domain],
        });
        chipEl.dataset.provenance = next;
        chipEl.textContent = provenanceLabel(next);
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
  const hit = perms.find((row) => row?.target === "module:e-aushadhi-automation");
  access.canView = hit?.can_view === true;
  access.canEdit = hit?.can_edit === true;
  access.loaded = true;
}

async function initPage() {
  setAppMode("queue");
  renderLenses();
  renderKpis();
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
    renderLenses();
    renderQueue({ resetChunk: true });
    setStatus("");
  } catch (err) {
    console.error("[eaushadhi] initial load failed", err);
    toastError(err);
    setStatus(err.message || "Failed to load the product queue.", "error");
  }
}

initPage();
