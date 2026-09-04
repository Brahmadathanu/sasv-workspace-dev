import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { mountModuleActionIcons } from "./sasv-module-chrome.js";
import { showToast } from "./toast.js";
import {
  AUTOSAVE_DEBOUNCE_MS,
  CLASS_LENSES,
  COMPOSITION_ATTENTION_FILTERS,
  COMPOSITION_REVIEW_LENSES,
  EVIDENCE_BUCKET,
  ERROR_KIND,
  QUEUE_RENDER_CHUNK,
  REVIEW_LENSES,
  SYSTEM_LENSES,
  WORKFLOW_STAGES,
  WORKSPACE_TABS,
  actionSetVerifyPendingCopy,
  actionsDirty,
  actionsDraftFromRows,
  applyCombinedRestrictedDeclaration,
  autosaveStateLabel,
  buildApprovedProductCopyPath,
  canPromoteFormulation,
  canVerifyProductWorkflow,
  canCorrectWorkingSourceLine,
  canEditReviewedSection,
  canReopenReviewedSection,
  canSubmitSourceResolution,
  canSubmitWorkingSourceCorrection,
  canVerifyActionSet,
  canVerifyCompositionLine,
  canVerifyProductDetails,
  classifyRpcError,
  combinedRestrictedDeclarationState,
  COMBINED_RESTRICTED_DECLARATION_LABEL,
  COMBINED_RESTRICTED_YES_UNAVAILABLE_COPY,
  compositionFiltersAreActive,
  compositionIsComplete,
  customActionDraftRows,
  composeActionsDraft,
  detailsDraftFromReview,
  detailsDirty,
  displayText,
  entryStatusChipClass,
  filterCompositionLines,
  findQueueRow,
  filterQueueRows,
  flushDebounced,
  formatFileSize,
  formatIssueDetails,
  formatRawQuantityDisplay,
  formatShowingCount,
  formatVerifiedTotal,
  idsEqual,
  isEditableKeyboardTarget,
  isVerifiedStatus,
  issuesForLine,
  isVocabActionLabel,
  joinHtmlParts,
  lineDirty,
  lineDraftFromRow,
  lineHasResolvableSourceIssue,
  lineSelectionsComplete,
  lineVerifyPendingCopy,
  mergePreservedLineDraft,
  nextQueueRenderCount,
  nextRequiredAction,
  nextRovingIndex,
  normalizeEntryStatus,
  normalizeReviewStatus,
  openErrorOrBlockerCount,
  optionId,
  parseOptionalNumericQuantity,
  portalFieldSpecs,
  productDetailsVerifyPendingCopy,
  promoteUnavailableReason,
  provenanceLabel,
  queueKpis,
  resetQueueRenderCount,
  resolveFieldProvenance,
  reviewStatusChipClass,
  safeText,
  scheduleDebounced,
  severityLabel,
  severityRank,
  shouldAppendQueueChunk,
  sourceFieldDisplay,
  suggestionBasisSummary,
  summarizeVerifyReviewedLines,
  syncWorkingSourceQuantityDraft,
  userMessageForError,
  validateEvidenceFile,
  workingActionReviewStatus,
  workingSourceChanges,
  workingSourceDraftFromRow,
  SUGGESTION_FIELD_KEYS,
  toggleVocabActionDraft,
  toInt,
  verifyProductUnavailableReason,
  verifyReviewedConfirmLabel,
  verifyReviewedEmptyGuidance,
  visibleQueueRows,
  workflowStageComplete,
} from "./eaushadhi-review-helpers.js";
import {
  EaushadhiRpcError,
  fetchProductQueue,
  correctWorkingSourceLine,
  fetchSourceIssueContext,
  loadProductWorkspace,
  loadSessionCatalogs,
  promoteVerifiedFormulation,
  registerApprovedProductCopy,
  removeApprovedProductCopyObject,
  reopenLineReview,
  reopenProductActions,
  reopenProductReview,
  resolveSourceIssue,
  saveLineReview,
  saveProductActions,
  saveProductReview,
  signedApprovedProductCopyUrl,
  uploadApprovedProductCopyObject,
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
    focusedProductId: null,
    openedProductId: null,
  },
  compositionView: {
    search: "",
    reviewLens: "all",
    attention: "all",
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
  resolvedSourceByLine: new Map(),
  sourceResolve: {
    open: false,
    lineId: null,
    context: null,
    confirmIdentity: false,
    confirmPartUsed: false,
    notes: "",
    trigger: null,
  },
  sourceCorrect: {
    open: false,
    lineId: null,
    before: null,
    draft: null,
    trigger: null,
  },
  reopen: {
    open: false,
    kind: null,
    lineId: null,
    reason: "",
    trigger: null,
  },
  verifyReviewed: { open: false },
  lineSaveStatus: new Map(),
  detailsSaveStatus: "",
  actionsSaveStatus: "",
  actionsReviewStatus: "PENDING",
  copy: null,
  copyPick: null,
};

let searchTimer = null;
let compositionSearchTimer = null;
const autosaveTimers = new Map();
const lineInflight = new Set();
const lineQueued = new Set();
const lineHalted = new Set();
let detailsInflight = false;
let detailsQueued = false;
let detailsHalted = false;
let actionsInflight = false;
let actionsQueued = false;
let actionsHalted = false;

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

function setHintEl(id, text) {
  const el = $(id);
  if (!el) return;
  const value = safeText(text);
  el.hidden = !value;
  el.textContent = value;
}

function syncDetailsVerifyUi() {
  const btn = $("btnVerifyDetails");
  if (!btn) return;
  const ok = canVerifyProductDetails(state.detailsDraft, {
    canEdit: canWrite(),
    saveStatus: state.detailsSaveStatus,
  });
  const reason = productDetailsVerifyPendingCopy(state.detailsDraft, {
    saveStatus: state.detailsSaveStatus,
  });
  btn.disabled = !ok || !canWrite() || state.busy;
  btn.dataset.forceDisabled = ok ? "false" : "true";
  if (reason) btn.title = reason;
  else btn.removeAttribute("title");
  setHintEl("detailsVerifyHint", reason);
}

function syncActionsVerifyUi() {
  const btn = $("btnVerifyActions");
  if (!btn) return;
  const ok = canVerifyActionSet({
    actions: state.actionsDraft,
    reviewStatus: state.actionsReviewStatus,
    saveStatus: state.actionsSaveStatus,
    canEdit: canWrite(),
  });
  const reason = actionSetVerifyPendingCopy({
    actions: state.actionsDraft,
    reviewStatus: state.actionsReviewStatus,
    saveStatus: state.actionsSaveStatus,
  });
  btn.disabled = !ok || !canWrite() || state.busy;
  btn.dataset.forceDisabled = ok ? "false" : "true";
  if (reason) btn.title = reason;
  else btn.removeAttribute("title");
  setHintEl("actionsVerifyHint", reason);
}

function syncLineVerifyUi(lineId) {
  const id = String(lineId);
  const btn = document.querySelector(`[data-line-verify="${id}"]`);
  if (!btn) return;
  const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, id));
  const draft = state.lineDrafts.get(id);
  const saveStatus = state.lineSaveStatus.get(id) || "";
  const ok = canVerifyCompositionLine({
    draft,
    issues: state.issues,
    lineId: id,
    reviewStatus: row?.review_status,
    saveStatus,
    canEdit: canWrite(),
  });
  const reason = lineVerifyPendingCopy({
    draft,
    issues: state.issues,
    lineId: id,
    reviewStatus: row?.review_status,
    saveStatus,
  });
  btn.disabled = !ok || !canWrite() || state.busy;
  btn.dataset.forceDisabled = ok ? "false" : "true";
  btn.title = reason || "Confirm the reviewed portal mapping as correct.";
}

function toastError(err) {
  showToast(userMessageForError(err) || "Something went wrong.", "error", 5200);
}

function workspaceIsDirty() {
  if (!state.selectedProductId) return false;
  if (detailsDirty(state.detailsDraft, state.detailsBaseline)) return true;
  if (actionsDirty(state.actionsDraft, state.actionsBaseline)) return true;
  for (const [id, draft] of state.lineDrafts.entries()) {
    if (lineDirty(draft, state.lineBaselines.get(id))) return true;
  }
  if (autosaveTimers.size) return true;
  return false;
}

function lockNoteHtml() {
  return `<span class="ea-lock-note"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><rect x="4" y="7" width="8" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"></rect><path d="M6 7V5a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor" stroke-width="1.4"></path></svg> Verified - reopen to edit</span>`;
}

function autosaveHtml(status, id) {
  const label = autosaveStateLabel(status);
  if (!label) return `<span class="ea-autosave" ${id ? `id="${escapeHtml(id)}"` : ""} hidden></span>`;
  const live = status === "failed" || status === "stale" ? ' aria-live="polite"' : "";
  const cls =
    status === "failed" || status === "stale" ? "ea-autosave is-failed" : "ea-autosave";
  return `<span class="${cls}" ${id ? `id="${escapeHtml(id)}"` : ""} ${live}>${escapeHtml(label)}</span>`;
}

function patchAutosaveEl(id, status) {
  const el = $(id);
  if (!el) return;
  const label = autosaveStateLabel(status);
  el.hidden = !label;
  el.textContent = label;
  el.classList.toggle("is-failed", status === "failed" || status === "stale");
  if (status === "failed" || status === "stale") el.setAttribute("aria-live", "polite");
  else el.removeAttribute("aria-live");
  if (id === "detailsAutosave") syncDetailsVerifyUi();
  if (id === "actionsAutosave") syncActionsVerifyUi();
  if (String(id).startsWith("line-save-")) syncLineVerifyUi(String(id).slice("line-save-".length));
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
      return `<button type="button" class="kpi ${tone}${active ? " is-active" : ""}" data-review-lens="${escapeHtml(lens)}" data-kpi="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}" tabindex="-1">
        <span class="kpi-label">${escapeHtml(label)}</span>
        <span class="kpi-value">${escapeHtml(String(value))}</span>
      </button>`;
    })
    .join("");
}

function renderLensGroup(hostId, items, current, attr, { role = "radio" } = {}) {
  const host = $(hostId);
  if (!host) return;
  const className = hostId === "reviewLenses" ? "review-lens" : "lens-pill";
  host.innerHTML = items
    .map((item) => {
      const selected = current === item.id;
      const selectedAttrs =
        role === "tab"
          ? `role="tab" aria-selected="${selected ? "true" : "false"}"`
          : `role="radio" aria-checked="${selected ? "true" : "false"}"`;
      return `<button type="button" class="${className}" data-${attr}="${escapeHtml(item.id)}" ${selectedAttrs} tabindex="${selected ? "0" : "-1"}">${escapeHtml(item.label)}</button>`;
    })
    .join("");
}

function renderLenses() {
  renderLensGroup("reviewLenses", REVIEW_LENSES, state.queueView.reviewLens, "review-lens", {
    role: "tab",
  });
  renderLensGroup("systemLenses", SYSTEM_LENSES, state.queueView.systemLens, "system-lens");
  renderLensGroup("classLenses", CLASS_LENSES, state.queueView.classLens, "class-lens");
}

function renderCompositionFilterLenses() {
  renderLensGroup(
    "compositionReviewLenses",
    COMPOSITION_REVIEW_LENSES,
    state.compositionView.reviewLens,
    "comp-review-lens",
  );
  renderLensGroup(
    "compositionAttentionLenses",
    COMPOSITION_ATTENTION_FILTERS,
    state.compositionView.attention,
    "comp-attention-lens",
  );
  const clear = $("compositionSearchClear");
  if (clear) clear.hidden = !safeText(state.compositionView.search);
  const search = $("compositionSearch");
  if (search && search.value !== state.compositionView.search) {
    search.value = state.compositionView.search;
  }
  const barClear = $("btnClearCompositionFiltersBar");
  if (barClear) {
    barClear.hidden = !compositionFiltersAreActive(state.compositionView);
  }
}

function queueRowHtml(row) {
  const ready = row.is_ready_for_entry === true;
  const blockers = toInt(row.open_blockers);
  const portal = toInt(row.open_portal_issues);
  const issues =
    blockers || portal
      ? `B ${blockers} / P ${portal}`
      : "None";
  return `<tr class="queue-row" data-product-id="${escapeHtml(row.product_id)}" tabindex="-1">
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

function visibleQueueRowEls() {
  return Array.from(document.querySelectorAll("#queueTbody tr.queue-row[data-product-id]"));
}

function applyQueueRowRoving() {
  const rows = visibleQueueRowEls();
  if (!rows.length) return;
  const wanted = String(state.queueView.focusedProductId || "");
  const active =
    rows.find((row) => String(row.dataset.productId) === wanted) || rows[0];
  rows.forEach((row) => {
    const on = row === active;
    row.tabIndex = on ? 0 : -1;
    row.classList.toggle("is-focused", on);
  });
  state.queueView.focusedProductId = active.dataset.productId;
  return active;
}

function focusQueueRow(productId, { scroll = true } = {}) {
  if (productId != null) state.queueView.focusedProductId = productId;
  const active = applyQueueRowRoving();
  if (!active) return null;
  active.focus();
  if (scroll) active.scrollIntoView({ block: "nearest" });
  return active;
}

function handleRovingKey(event, host, { wrap = true, autoActivate = true, onActivate } = {}) {
  const key = event.key;
  if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(key)) return;
  if (isEditableKeyboardTarget(event.target)) return;
  const items = Array.from(host.querySelectorAll("button"));
  const current = items.indexOf(event.target.closest("button"));
  if (current < 0) return;
  event.preventDefault();
  if (key === "Enter" || key === " ") {
    onActivate?.(items[current]);
    return;
  }
  const next = nextRovingIndex(current, items.length, key, { wrap });
  items[next]?.focus();
  if (autoActivate) onActivate?.(items[next]);
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
  applyQueueRowRoving();
  if (restoreScroll) {
    requestAnimationFrame(() => restoreQueueScroll());
  }
}

function appendQueueChunk({ force = false } = {}) {
  if (isProductMode()) return false;
  const wrap = $("queueTableWrap");
  const tbody = $("queueTbody");
  if (!wrap || !tbody) return false;
  const filtered = filteredQueue();
  if (state.queueView.renderedCount >= filtered.length) return false;
  if (
    !force &&
    !shouldAppendQueueChunk({
      scrollTop: wrap.scrollTop,
      clientHeight: wrap.clientHeight,
      scrollHeight: wrap.scrollHeight,
    })
  ) {
    return false;
  }
  const next = nextQueueRenderCount(state.queueView.renderedCount, filtered.length);
  const extra = filtered.slice(state.queueView.renderedCount, next);
  if (!extra.length) return false;
  const empty = tbody.querySelector(".empty-state");
  if (empty) tbody.innerHTML = "";
  tbody.insertAdjacentHTML("beforeend", extra.map(queueRowHtml).join(""));
  state.queueView.renderedCount = next;
  updateShowingCount(Math.min(next, filtered.length), filtered.length);
  applyQueueRowRoving();
  return true;
}

function optionHtml(options, selectedId, extra = []) {
  const seen = new Set();
  const list = [...extra, ...(Array.isArray(options) ? options : [])];
  const parts = ['<option value="">Select...</option>'];
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
    return `<button type="button" class="workflow-step${complete ? " is-complete" : ""}" role="tab" id="wf-tab-${escapeHtml(stage.id)}" data-tab="${escapeHtml(stage.id)}" aria-controls="tab-${escapeHtml(stage.id)}" aria-selected="${selected ? "true" : "false"}" tabindex="${selected ? "0" : "-1"}">
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
    safeText(row.system_label),
    safeText(row.medicine_class_label),
    [safeText(row.dosage_form_label), safeText(row.subtype_label)].filter(Boolean).join(" / "),
  ]
    .filter(Boolean)
    .join(" / ");
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

function combinedDeclarationControl(draft) {
  const current = combinedRestrictedDeclarationState(draft);
  const value = current === "yes" ? "true" : current === "no" ? "false" : "";
  const yesUnavailable = current !== "yes";
  const groupId = "decl-combined-restricted-label";
  const options = [
    ["true", "Yes", yesUnavailable],
    ["false", "No", false],
    ["", "Not reviewed", false],
  ];
  return `<div class="form-field">
    <span class="meta-label" id="${escapeHtml(groupId)}">${escapeHtml(COMBINED_RESTRICTED_DECLARATION_LABEL)}</span>
    <div class="seg-control" role="radiogroup" aria-labelledby="${escapeHtml(groupId)}" data-bool-key="combinedRestricted">
      ${options
        .map(
          ([val, text, blocked]) =>
            `<button type="button" data-edit-action="true" role="radio" data-bool-value="${escapeHtml(val)}" aria-checked="${current === (val === "true" ? "yes" : val === "false" ? "no" : "unreviewed") ? "true" : "false"}" tabindex="${value === val ? "0" : "-1"}"${
              blocked
                ? ` disabled data-force-disabled="true" title="${escapeHtml(COMBINED_RESTRICTED_YES_UNAVAILABLE_COPY)}"`
                : ""
            }>${escapeHtml(text)}</button>`,
        )
        .join("")}
    </div>
    ${
      yesUnavailable
        ? `<p class="muted-note">${escapeHtml(COMBINED_RESTRICTED_YES_UNAVAILABLE_COPY)}</p>`
        : `<p class="muted-note">At least one stored restricted-ingredient declaration is Yes. Choose No only when all five underlying declarations are confirmed No.</p>`
    }
  </div>`;
}

function parseBoolButton(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function applyDeclarationChoice(value) {
  if (!state.detailsDraft) return;
  if (value === true) return;
  state.detailsDraft = applyCombinedRestrictedDeclaration(state.detailsDraft, value);
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
  const locked = isVerifiedStatus(review.review_status);
  const suggested = review.suggested_permission_purpose_label
    ? `Suggested: ${review.suggested_permission_purpose_label}`
    : "";
  const disable = locked ? " disabled" : "";
  const detailsVerifyOk = canVerifyProductDetails(draft, {
    canEdit: canWrite(),
    saveStatus: state.detailsSaveStatus,
  });
  const detailsVerifyHint = productDetailsVerifyPendingCopy(draft, {
    saveStatus: state.detailsSaveStatus,
  });
  host.innerHTML = `
    <div class="section-card${locked ? " is-verified" : ""}">
      <h3 class="section-title">Regulatory purpose</h3>
      ${locked ? lockNoteHtml() : ""}
      <div class="form-field">
        <label for="fldPurpose">Permission Purpose</label>
        <select id="fldPurpose" class="sasv-control" data-edit-action="true"${disable}>${optionHtml(state.catalogs.permissionPurposeOptions, draft.permissionPurposeTermId)}</select>
        <span class="muted-note">${escapeHtml(suggested)}</span>
      </div>
    </div>
    <div class="section-card${locked ? " is-verified" : ""}">
      <h3 class="section-title">Product description</h3>
      <div class="form-field">
        <label for="fldTitle">Composition Title</label>
        <input id="fldTitle" class="sasv-control" data-edit-action="true" value="${escapeHtml(draft.compositionTitle || "")}"${disable} />
      </div>
      <div class="form-field">
        <label for="fldDiseases">Diseases / Conditions</label>
        <textarea id="fldDiseases" class="sasv-control" rows="3" data-edit-action="true"${disable}>${escapeHtml(draft.diseasesConditions || "")}</textarea>
      </div>
    </div>
    <div class="section-card${locked ? " is-verified" : ""}">
      <h3 class="section-title">Controlled declarations</h3>
      <p class="muted-note">SASV in-scope products are recorded as No. Null remains Not reviewed and never defaults to No. Changes save automatically. Verify when the section is correct.</p>
      ${combinedDeclarationControl(draft)}
      <div class="form-field" style="margin-top:10px">
        <label for="fldReviewNotes">Review notes</label>
        <textarea id="fldReviewNotes" class="sasv-control" rows="2" data-edit-action="true"${disable}>${escapeHtml(draft.reviewNotes || "")}</textarea>
      </div>
      ${autosaveHtml(state.detailsSaveStatus, "detailsAutosave")}
      <div class="action-row">
        ${
          locked
            ? `${chip("success", "Verified")}
        ${
          canReopenReviewedSection({ reviewStatus: review.review_status, canEdit: canWrite() })
            ? `<button type="button" class="icon-btn with-label ea-reopen-btn" id="btnReopenDetails" data-edit-action="true">Reopen Product Details</button>`
            : ""
        }`
            : `<button type="button" class="icon-btn with-label primary" id="btnVerifyDetails" data-edit-action="true"${
                detailsVerifyOk ? "" : " data-force-disabled=\"true\""
              }${detailsVerifyHint ? ` title="${escapeHtml(detailsVerifyHint)}"` : ""}>Verify Product Details</button>`
        }
      </div>
      ${
        locked
          ? ""
          : `<p class="disabled-reason" id="detailsVerifyHint"${detailsVerifyHint ? "" : " hidden"}>${escapeHtml(detailsVerifyHint)}</p>`
      }
    </div>`;
  if (locked) {
    host.querySelectorAll("[data-bool-value]").forEach((el) => {
      el.disabled = true;
      el.dataset.forceDisabled = "true";
    });
  }
  applyPermissionUi();
}

function renderComposition() {
  const host = $("tab-composition");
  const filtered = filterCompositionLines(state.lines, state.issues, state.compositionView);
  const count = $("compositionRowCount");
  if (count) count.textContent = formatShowingCount(filtered.length, state.lines.length);
  if (!state.lines.length) {
    host.innerHTML = `<div class="section-card empty-state">No composition lines returned for this product.</div>`;
    return;
  }
  if (!filtered.length) {
    host.innerHTML = `<div class="section-card empty-state">
      <p>No ingredient lines match the current composition filters.</p>
      <button type="button" class="icon-btn with-label" id="btnClearCompositionFilters">Clear filters</button>
    </div>`;
    return;
  }
  const specs = portalFieldSpecs();
  const labels = {
    INGREDIENT_TYPE: "Ingredient Type",
    INGREDIENT_FORM: "Ingredient Form",
    PART_USED: "Part Used",
    MEASUREMENT_UNIT: "Unit",
  };
  host.innerHTML = filtered
    .map((row) => {
      const id = optionId(row.source_composition_line_id);
      const draft = state.lineDrafts.get(id) || lineDraftFromRow(row);
      const lineIssues = issuesForLine(state.issues, id);
      const hasBlocker = lineIssues.some((issue) => severityRank(issue.severity) >= 3);
      const hasError = lineIssues.some((issue) => severityRank(issue.severity) === 2);
      const topSev = lineIssues
        .slice()
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
      const locked = isVerifiedStatus(row.review_status);
      const fields = specs
        .map((spec) => {
          const selectedNow = draft[spec.draftKey];
          const fieldId = `line-${id}-${spec.draftKey}`;
          const provenance = resolveFieldProvenance({
            reviewStatus: row.review_status,
            selectedId: selectedNow,
            suggestedId: row[spec.suggestedKey],
            suggestionBasis: row.suggestion_basis,
            fieldKey: SUGGESTION_FIELD_KEYS[spec.domain],
          });
          return `<div class="portal-field form-field">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(labels[spec.domain] || spec.domain)}</label>
            <select id="${escapeHtml(fieldId)}" class="sasv-control" data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="${escapeHtml(spec.draftKey)}"${locked ? " disabled" : ""}>
              ${optionHtml(state.catalogs.portalOptions[spec.domain], selectedNow)}
            </select>
            ${provenanceChipHtml(id, spec.draftKey, provenance)}
          </div>`;
        })
        .join("");
      const qty = formatRawQuantityDisplay(row.raw_quantity_text, row.raw_unit_text);
      const scientific = escapeHtml(safeText(row.raw_scientific_name));
      const nameHtml = scientific
        ? `<span class="line-ingredient">${escapeHtml(sourceFieldDisplay(row.raw_ingredient_name))}</span><span class="line-scientific">${scientific}</span>`
        : `<span class="line-ingredient">${escapeHtml(sourceFieldDisplay(row.raw_ingredient_name))}</span>`;
      const notesId = `line-${id}-reviewNotes`;
      const canResolve = !locked && lineHasResolvableSourceIssue(state.issues, id);
      const canCorrect = canCorrectWorkingSourceLine({
        reviewStatus: row.review_status,
        approvedFormulationPresent: state.evidence?.approved_formulation_present,
      });
      const saveStatus = state.lineSaveStatus.get(String(id)) || "";
      const lineVerifyHint = lineVerifyPendingCopy({
        draft,
        issues: state.issues,
        lineId: id,
        reviewStatus: row.review_status,
        saveStatus,
      });
      const lineVerifyOk = canVerifyCompositionLine({
        draft,
        issues: state.issues,
        lineId: id,
        reviewStatus: row.review_status,
        saveStatus,
        canEdit: canWrite(),
      });
      const resolved = state.resolvedSourceByLine.get(String(id));
      return `<article class="line-card${hasBlocker ? " has-blocker" : hasError ? " has-error" : ""}${locked ? " is-verified" : ""}" data-line-id="${escapeHtml(id)}">
        <div class="working-source-block">
          <span class="working-source-label">Working source</span>
          <div class="line-head">
            <span class="line-no">${escapeHtml(displayText(row.source_row_no))}</span>
            <span class="line-title">${nameHtml}</span>
            <span class="line-qty">${escapeHtml(qty || "-")}</span>
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
          <div class="line-sub">Part used: ${escapeHtml(sourceFieldDisplay(row.raw_part_used))}</div>
          <p class="muted-note working-source-audit">Imported source retained for audit</p>
        </div>
        ${
          resolved
            ? `<div class="line-resolution">Governed resolution: ${joinHtmlParts([
                escapeHtml(resolved.identity),
                escapeHtml(resolved.part),
              ])}</div>`
            : ""
        }
        <span class="portal-mapping-label">Portal mapping</span>
        <div class="portal-fields">${fields}</div>
        <div class="line-notes-row">
          <label class="visually-hidden" for="${escapeHtml(notesId)}">Notes</label>
          <input id="${escapeHtml(notesId)}" class="sasv-control" data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="reviewNotes" value="${escapeHtml(draft.reviewNotes || "")}" placeholder="Notes" aria-label="Notes"${locked ? " disabled" : ""} />
          ${autosaveHtml(saveStatus, `line-save-${id}`)}
          ${
            locked
              ? `${chip("success", "Verified")} ${lockNoteHtml()}
          ${
            canReopenReviewedSection({ reviewStatus: row.review_status, canEdit: canWrite() })
              ? `<button type="button" class="icon-btn with-label ea-reopen-btn" data-edit-action="true" id="btn-reopen-${escapeHtml(id)}" data-line-reopen="${escapeHtml(id)}">Reopen for correction</button>`
              : ""
          }`
              : `<button type="button" class="icon-btn with-label primary" data-edit-action="true" data-line-verify="${escapeHtml(id)}"${
                  lineVerifyOk ? "" : " data-force-disabled=\"true\""
                } title="${escapeHtml(lineVerifyHint || "Confirm the reviewed portal mapping as correct.")}">Verify line</button>
          ${
            canCorrect
              ? `<button type="button" class="icon-btn with-label" data-edit-action="true" id="btn-correct-${escapeHtml(id)}" data-source-correct="${escapeHtml(id)}" title="Edit the current working source before approval.">Correct source</button>`
              : ""
          }`
          }
        </div>
        ${
          lineIssues.length
            ? `<div class="line-issues">${renderIssues(lineIssues, "")}
              ${
                canResolve
                  ? `<button type="button" class="icon-btn with-label source-resolve-btn" data-edit-action="true" id="btn-resolve-${escapeHtml(id)}" data-source-resolve="${escapeHtml(id)}">Resolve source issue</button>`
                  : ""
              }
            </div>`
            : ""
        }
      </article>`;
    })
    .join("");
  applyPermissionUi();
}

function modalFocusables(dialogId) {
  const root = $(dialogId);
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hidden && el.offsetParent !== null);
}

function trapModalTab(event, dialogId) {
  if (event.key !== "Tab") return;
  const items = modalFocusables(dialogId);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function sourceCorrectChanges() {
  return workingSourceChanges(state.sourceCorrect.before, state.sourceCorrect.draft);
}

function syncSourceCorrectConfirm() {
  const btn = $("sourceCorrectConfirm");
  if (!btn) return;
  const draft = state.sourceCorrect.draft || {};
  const ok = canSubmitWorkingSourceCorrection({
    ingredientName: draft.raw_ingredient_name,
    correctionReason: draft.correction_reason,
    numericQuantity: draft.raw_quantity_value,
    hasChanges: sourceCorrectChanges().length > 0,
  });
  btn.disabled = !ok || !canWrite() || state.busy;
  btn.dataset.forceDisabled = ok ? "false" : "true";
}

function renderSourceCorrectPreview() {
  const changes = sourceCorrectChanges();
  if (!changes.length) {
    return `<p id="srcCorrectPreviewHost" class="muted-note">No working-source fields have changed yet.</p>`;
  }
  return `<section id="srcCorrectPreviewHost" class="ea-source-preview" aria-labelledby="srcCorrectPreviewTitle">
    <h3 id="srcCorrectPreviewTitle">Changes to apply</h3>
    <div class="ea-change-list">
    ${changes
      .map(
        (change) => `<div class="ea-change-item">
          <p class="ea-change-field">${escapeHtml(change.label)}</p>
          <dl>
            <div class="ea-change-pair">
              <dt>Before</dt>
              <dd>${escapeHtml(change.before)}</dd>
            </div>
            <div class="ea-change-pair">
              <dt>After</dt>
              <dd class="is-after">${escapeHtml(change.after)}</dd>
            </div>
          </dl>
        </div>`,
      )
      .join("")}
    </div>
  </section>`;
}

function renderSourceCorrectBody() {
  const host = $("sourceCorrectBody");
  const draft = state.sourceCorrect.draft;
  if (!host || !draft) return;
  const numericDisplay =
    draft.raw_quantity_value == null || draft.raw_quantity_value === ""
      ? ""
      : String(draft.raw_quantity_value);
  host.innerHTML = `
    <p id="sourceCorrectIntro" class="ea-callout">These values are the current working source. The original imported row remains retained for provenance. After line/formulation approval, corrections require versioning.</p>
    <section class="ea-form-group" aria-labelledby="srcIdentityTitle">
      <h3 id="srcIdentityTitle" class="section-title">Source identity</h3>
      <div class="ea-identity-grid">
        <div class="form-field">
          <label for="srcCorrectIngredient">Ingredient name</label>
          <input id="srcCorrectIngredient" class="sasv-control" type="text" data-edit-action="true" value="${escapeHtml(draft.raw_ingredient_name)}" required />
        </div>
        <div class="form-field">
          <label for="srcCorrectScientific">Scientific name</label>
          <input id="srcCorrectScientific" class="sasv-control" type="text" data-edit-action="true" value="${escapeHtml(draft.raw_scientific_name)}" />
        </div>
        <div class="form-field ea-span-2">
          <label for="srcCorrectPart">Part Used / source wording</label>
          <input id="srcCorrectPart" class="sasv-control" type="text" data-edit-action="true" value="${escapeHtml(draft.raw_part_used)}" />
          <p class="muted-note">Source wording only. This is not the portal Part Used list.</p>
        </div>
      </div>
    </section>
    <section class="ea-form-group" aria-labelledby="srcQtyTitle">
      <h3 id="srcQtyTitle" class="section-title">Quantity</h3>
      <div class="ea-quantity-grid">
        <div class="form-field">
          <label for="srcCorrectQtyText">Quantity text</label>
          <input id="srcCorrectQtyText" class="sasv-control" type="text" data-edit-action="true" value="${escapeHtml(draft.raw_quantity_text)}" />
        </div>
        <div class="form-field">
          <label for="srcCorrectQtyNum">Numeric quantity</label>
          <input id="srcCorrectQtyNum" class="sasv-control" type="text" inputmode="decimal" data-edit-action="true" value="${escapeHtml(numericDisplay)}" />
        </div>
        <div class="form-field">
          <label for="srcCorrectUnit">Unit</label>
          <input id="srcCorrectUnit" class="sasv-control" type="text" data-edit-action="true" value="${escapeHtml(draft.raw_unit_text)}" />
        </div>
      </div>
      <p class="muted-note">Quantity text preserves licensed/source wording. Numeric quantity is only used where applicable. No unit conversion is performed.</p>
    </section>
    <section class="ea-form-group" aria-labelledby="srcCorrectionTitle">
      <h3 id="srcCorrectionTitle" class="section-title">Correction</h3>
      <div class="form-field">
        <label for="srcCorrectReason">Correction reason</label>
        <textarea id="srcCorrectReason" class="sasv-control" rows="4" data-edit-action="true" required>${escapeHtml(draft.correction_reason || "")}</textarea>
      </div>
    </section>
    ${renderSourceCorrectPreview()}`;
  syncSourceCorrectConfirm();
  applyPermissionUi();
}

function closeSourceCorrect() {
  const trigger = state.sourceCorrect.trigger;
  state.sourceCorrect = {
    open: false,
    lineId: null,
    before: null,
    draft: null,
    trigger: null,
  };
  const backdrop = $("sourceCorrectBackdrop");
  if (backdrop) backdrop.hidden = true;
  if (trigger && typeof trigger.focus === "function") trigger.focus();
}

function openSourceCorrect(lineId, trigger) {
  const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
  if (!row) return;
  if (
    !canCorrectWorkingSourceLine({
      reviewStatus: row.review_status,
      approvedFormulationPresent: state.evidence?.approved_formulation_present,
    })
  ) {
    return;
  }
  if (state.sourceResolve.open) closeSourceResolve();
  const draft = workingSourceDraftFromRow(row);
  state.sourceCorrect.trigger = trigger || document.getElementById(`btn-correct-${lineId}`);
  state.sourceCorrect.lineId = lineId;
  state.sourceCorrect.before = { ...draft };
  state.sourceCorrect.draft = draft;
  const backdrop = $("sourceCorrectBackdrop");
  if (backdrop) backdrop.hidden = false;
  state.sourceCorrect.open = true;
  renderSourceCorrectBody();
  $("sourceCorrectDialog")?.focus();
  requestAnimationFrame(() => {
    $("srcCorrectIngredient")?.focus();
  });
}

function updateSourceCorrectPreview() {
  const host = $("srcCorrectPreviewHost");
  if (!host) return;
  const temp = document.createElement("div");
  temp.innerHTML = renderSourceCorrectPreview();
  const next = temp.firstElementChild;
  if (next) host.replaceWith(next);
  syncSourceCorrectConfirm();
  applyPermissionUi();
}

function patchSourceCorrectDraft(field, value) {
  if (!state.sourceCorrect.draft) return;
  state.sourceCorrect.draft = {
    ...state.sourceCorrect.draft,
    [field]: value,
  };
  if (
    field === "raw_quantity_text" ||
    field === "raw_quantity_value" ||
    field === "raw_unit_text"
  ) {
    const beforeText = state.sourceCorrect.draft.raw_quantity_text;
    state.sourceCorrect.draft = syncWorkingSourceQuantityDraft(state.sourceCorrect.draft, field);
    const qtyText = $("srcCorrectQtyText");
    if (qtyText && state.sourceCorrect.draft.raw_quantity_text !== beforeText) {
      qtyText.value = state.sourceCorrect.draft.raw_quantity_text;
    }
  }
  updateSourceCorrectPreview();
}

async function submitSourceCorrect() {
  const draft = state.sourceCorrect.draft;
  const lineId = state.sourceCorrect.lineId;
  if (!draft || !lineId) return;
  const changes = sourceCorrectChanges();
  if (
    !canSubmitWorkingSourceCorrection({
      ingredientName: draft.raw_ingredient_name,
      correctionReason: draft.correction_reason,
      numericQuantity: draft.raw_quantity_value,
      hasChanges: changes.length > 0,
    })
  ) {
    return;
  }
  const numeric = parseOptionalNumericQuantity(draft.raw_quantity_value);
  await runMutation(async () => {
    await correctWorkingSourceLine({
      sourceCompositionLineId: lineId,
      rawIngredientName: safeText(draft.raw_ingredient_name),
      rawScientificName: safeText(draft.raw_scientific_name) || null,
      rawPartUsed: safeText(draft.raw_part_used) || null,
      rawQuantityText: safeText(draft.raw_quantity_text) || null,
      rawQuantityValue: numeric,
      rawUnitText: safeText(draft.raw_unit_text) || null,
      correctionReason: safeText(draft.correction_reason),
    });
    state.resolvedSourceByLine.delete(String(lineId));
    state.lineDrafts.delete(optionId(lineId));
    closeSourceCorrect();
    showToast("Working source corrected. The line has been returned to review.", "success");
    await reloadSelected({
      preserveDrafts: true,
      restoreComposition: true,
      focusLineId: lineId,
      focusControl: "correct",
    });
  });
}

function syncSourceResolveConfirm() {
  const btn = $("sourceResolveConfirm");
  if (!btn) return;
  const ok = canSubmitSourceResolution({
    confirmIdentity: state.sourceResolve.confirmIdentity,
    confirmPartUsed: state.sourceResolve.confirmPartUsed,
  });
  btn.disabled = !ok || !canWrite() || state.busy;
  btn.dataset.forceDisabled = ok ? "false" : "true";
}

function renderSourceResolveBody() {
  const host = $("sourceResolveBody");
  const ctx = state.sourceResolve.context || {};
  const identity =
    displayText(ctx.canonical_scientific_name, "") ||
    displayText(ctx.canonical_ingredient_name, "");
  const partLabel = displayText(ctx.suggested_part_used_label, "");
  const basis = suggestionBasisSummary(ctx.suggestion_basis);
  const hasPart = Boolean(optionId(ctx.suggested_part_used_term_id));
  if (!host) return;
  host.innerHTML = `
    <section class="ea-source-block" aria-labelledby="srcEvidenceTitle">
      <h3 id="srcEvidenceTitle" class="section-title">Source evidence</h3>
      <p class="muted-note">Read-only source values. Canonical values are not substituted here.</p>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Ingredient</span><span class="meta-value">${escapeHtml(sourceFieldDisplay(ctx.raw_ingredient_name))}</span></div>
        <div class="meta-item"><span class="meta-label">Scientific Name</span><span class="meta-value">${escapeHtml(sourceFieldDisplay(ctx.raw_scientific_name))}</span></div>
        <div class="meta-item"><span class="meta-label">Part Used</span><span class="meta-value">${escapeHtml(sourceFieldDisplay(ctx.raw_part_used))}</span></div>
        <div class="meta-item"><span class="meta-label">Source row</span><span class="meta-value">${escapeHtml(displayText(ctx.source_row_no))}</span></div>
      </div>
    </section>
    <section class="ea-governed-block" aria-labelledby="srcGovernedTitle">
      <h3 id="srcGovernedTitle" class="section-title">Governed canonical proposal</h3>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Canonical identity</span><span class="meta-value">${escapeHtml(displayText(ctx.canonical_ingredient_name))}</span></div>
        <div class="meta-item"><span class="meta-label">Canonical scientific name</span><span class="meta-value">${escapeHtml(displayText(ctx.canonical_scientific_name))}</span></div>
        <div class="meta-item"><span class="meta-label">Suggested Part Used</span><span class="meta-value">${escapeHtml(hasPart ? partLabel : "No governed part suggestion")}</span></div>
      </div>
      ${basis ? `<p class="muted-note">${escapeHtml(basis)}</p>` : ""}
      ${
        identity
          ? `<label class="ea-confirm-row">
              <input id="srcConfirmIdentity" type="checkbox" data-edit-action="true" ${state.sourceResolve.confirmIdentity ? "checked" : ""} />
              <span>Confirm canonical identity: ${escapeHtml(identity)}</span>
            </label>`
          : `<p class="muted-note">No governed canonical identity is available to confirm.</p>`
      }
      ${
        hasPart
          ? `<label class="ea-confirm-row">
              <input id="srcConfirmPart" type="checkbox" data-edit-action="true" ${state.sourceResolve.confirmPartUsed ? "checked" : ""} />
              <span>Confirm Part Used: ${escapeHtml(partLabel)}</span>
            </label>`
          : `<p class="muted-note">Part Used can remain unresolved until a governed suggestion is available.</p>`
      }
      <div class="form-field">
        <label for="srcResolutionNotes">Resolution notes</label>
        <textarea id="srcResolutionNotes" class="sasv-control" rows="3" data-edit-action="true">${escapeHtml(state.sourceResolve.notes)}</textarea>
      </div>
    </section>`;
  syncSourceResolveConfirm();
  applyPermissionUi();
}

function closeSourceResolve() {
  const trigger = state.sourceResolve.trigger;
  state.sourceResolve = {
    open: false,
    lineId: null,
    context: null,
    confirmIdentity: false,
    confirmPartUsed: false,
    notes: "",
    trigger: null,
  };
  const backdrop = $("sourceResolveBackdrop");
  if (backdrop) backdrop.hidden = true;
  if (trigger && typeof trigger.focus === "function") trigger.focus();
}

async function openSourceResolve(lineId, trigger) {
  if (!lineHasResolvableSourceIssue(state.issues, lineId)) return;
  if (state.sourceCorrect.open) {
    state.sourceCorrect.trigger = null;
    closeSourceCorrect();
  }
  state.sourceResolve.trigger = trigger || document.getElementById(`btn-resolve-${lineId}`);
  state.sourceResolve.lineId = lineId;
  state.sourceResolve.confirmIdentity = false;
  state.sourceResolve.confirmPartUsed = false;
  state.sourceResolve.notes = "";
  const backdrop = $("sourceResolveBackdrop");
  const body = $("sourceResolveBody");
  if (body) body.innerHTML = `<p class="muted-note">Loading governed source context...</p>`;
  if (backdrop) backdrop.hidden = false;
  state.sourceResolve.open = true;
  $("sourceResolveDialog")?.focus();
  try {
    const context = await fetchSourceIssueContext(lineId);
    if (!state.sourceResolve.open || !idsEqual(state.sourceResolve.lineId, lineId)) return;
    state.sourceResolve.context = context;
    renderSourceResolveBody();
    const first = $("srcConfirmIdentity") || $("srcConfirmPart") || $("srcResolutionNotes") || $("sourceResolveCancel");
    first?.focus();
  } catch (err) {
    toastError(err);
    closeSourceResolve();
  }
}

async function submitSourceResolve() {
  const ctx = state.sourceResolve.context || {};
  const confirmIdentity = state.sourceResolve.confirmIdentity === true;
  const confirmPartUsed = state.sourceResolve.confirmPartUsed === true;
  if (!canSubmitSourceResolution({ confirmIdentity, confirmPartUsed })) {
    showToast("Confirm the canonical identity and/or Part Used before saving.", "error");
    return;
  }
  const lineId = state.sourceResolve.lineId;
  await runMutation(async () => {
    await resolveSourceIssue({
      sourceCompositionLineId: lineId,
      expectedResolutionId: ctx.current_resolution_id,
      confirmCurrentIdentity: confirmIdentity,
      partUsedTermId: confirmPartUsed ? ctx.suggested_part_used_term_id : null,
      resolutionNotes: safeText(state.sourceResolve.notes) || null,
    });
    state.resolvedSourceByLine.set(String(lineId), {
      identity: safeText(ctx.canonical_scientific_name) || safeText(ctx.canonical_ingredient_name),
      part: confirmPartUsed ? safeText(ctx.suggested_part_used_label) : "",
    });
    showToast("Source issue resolved using governed canonical evidence.", "success");
    closeSourceResolve();
    await reloadSelected({
      preserveDrafts: true,
      restoreComposition: true,
      focusLineId: lineId,
      focusControl: "resolve",
    });
  });
}

function renderActions() {
  const host = $("tab-actions");
  const vocab = state.catalogs.pharmacologicalActionOptions || [];
  const rows = state.actionsDraft;
  const customRows = customActionDraftRows(rows, vocab);
  const selectedVocab = new Set(
    (Array.isArray(rows) ? rows : [])
      .map((item) => safeText(item).toLowerCase())
      .filter(Boolean),
  );
  const locked = isVerifiedStatus(state.actionsReviewStatus);
  const disable = locked ? " disabled" : "";
  const actionsVerifyOk = canVerifyActionSet({
    actions: rows,
    reviewStatus: state.actionsReviewStatus,
    saveStatus: state.actionsSaveStatus,
    canEdit: canWrite(),
  });
  const actionsVerifyHint = actionSetVerifyPendingCopy({
    actions: rows,
    reviewStatus: state.actionsReviewStatus,
    saveStatus: state.actionsSaveStatus,
  });
  host.innerHTML = `
    <div class="section-card${locked ? " is-verified" : ""}">
      <h3 class="section-title">Pharmacological action</h3>
      ${locked ? lockNoteHtml() : `<p class="muted-note">Select every applicable action from the server vocabulary. Additional exact wording can be added. Changes save automatically. Verify when the complete set is correct.</p>`}
      ${autosaveHtml(state.actionsSaveStatus, "actionsAutosave")}
      ${
        vocab.length
          ? `<div class="action-vocab-list" role="group" aria-label="Pharmacological action vocabulary">
        ${vocab
          .map((item, index) => {
            const label = safeText(item?.label);
            if (!label) return "";
            const id = `action-vocab-${index}`;
            const checked = selectedVocab.has(label.toLowerCase());
            return `<label class="action-vocab-item" for="${escapeHtml(id)}">
              <input id="${escapeHtml(id)}" type="checkbox" data-edit-action="true" data-action-vocab-toggle="${escapeHtml(label)}"${checked ? " checked" : ""}${disable} />
              <span>${escapeHtml(label)}</span>
            </label>`;
          })
          .join("")}
      </div>`
          : `<div class="empty-state">No pharmacological action vocabulary was returned by the server.</div>`
      }
      ${
        customRows.length
          ? `<div class="action-list" id="actionList">
        ${customRows
          .map((text, index) => {
            return `<div class="action-item" data-action-index="${index}">
              <input class="sasv-control" data-edit-action="true" data-action-text="${index}" value="${escapeHtml(text)}" placeholder="Enter exact approved wording"${disable} />
              ${
                locked
                  ? ""
                  : `<button type="button" class="icon-btn" data-edit-action="true" data-action-remove="${index}" aria-label="Remove custom action" title="Remove custom action">Remove</button>`
              }
            </div>`;
          })
          .join("")}
      </div>`
          : ""
      }
      <div class="action-row">
        ${
          locked
            ? `${chip("success", "Verified")}
        ${
          canReopenReviewedSection({
            reviewStatus: state.actionsReviewStatus,
            canEdit: canWrite(),
          })
            ? `<button type="button" class="icon-btn with-label ea-reopen-btn" id="btnReopenActions" data-edit-action="true">Reopen Actions</button>`
            : ""
        }`
            : `<button type="button" class="icon-btn with-label" id="btnAddAction" data-edit-action="true">Add custom action</button>
        <button type="button" class="icon-btn with-label primary" id="btnVerifyActions" data-edit-action="true"${
          actionsVerifyOk ? "" : " data-force-disabled=\"true\""
        }${actionsVerifyHint ? ` title="${escapeHtml(actionsVerifyHint)}"` : ""}>Verify Actions</button>`
        }
      </div>
      ${
        locked
          ? ""
          : `<p class="disabled-reason" id="actionsVerifyHint"${actionsVerifyHint ? "" : " hidden"}>${escapeHtml(actionsVerifyHint)}</p>`
      }
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
  const copy = state.copy;
  const pick = state.copyPick;
  const hasCopy = Boolean(copy?.storage_path) || evidence.approved_product_copy_present === true;
  host.innerHTML = `
    <div class="section-card">
      <h3 class="section-title">Approved Product Copy</h3>
      ${hasCopy && copy ? `
        <div class="ea-copy-meta">
          <div><strong>${escapeHtml(displayText(copy.original_file_name))}</strong></div>
          <div class="muted-note">${escapeHtml(displayText(copy.mime_type))} / ${escapeHtml(formatFileSize(copy.file_size_bytes))}</div>
          <div class="muted-note">${escapeHtml(copy.created_at ? String(copy.created_at).slice(0, 10) : "-")}</div>
        </div>
        <div class="action-row">
          <button type="button" class="icon-btn with-label" id="btnOpenCopy">Open copy</button>
          <button type="button" class="icon-btn with-label" id="btnReplaceCopy" data-edit-action="true">Replace copy</button>
        </div>
      ` : `
        ${chip("neutral", "Pending")}
        <p class="muted-note">Accepted: PDF / JPG / PNG. Max 20 MB.</p>
      `}
      ${
        !hasCopy || pick
          ? `<div class="form-field" style="margin-top:10px">
        <label for="fldCopyFile">Choose file</label>
        <input id="fldCopyFile" type="file" accept="application/pdf,image/jpeg,image/png" data-edit-action="true" />
      </div>`
          : ""
      }
      ${
        pick?.file
          ? `<div class="ea-copy-meta">
          <div>${escapeHtml(pick.file.name)}</div>
          <div class="muted-note">${escapeHtml(pick.file.type || "-")} / ${escapeHtml(formatFileSize(pick.file.size))}</div>
        </div>
        <div class="action-row">
          <button type="button" class="icon-btn with-label primary" id="btnUploadCopy" data-edit-action="true">Upload copy</button>
          <button type="button" class="icon-btn with-label" id="btnCancelCopy">Cancel</button>
        </div>`
          : ""
      }
      ${pick?.error ? `<p class="muted-note ea-autosave is-failed" aria-live="polite">${escapeHtml(pick.error)}</p>` : ""}
    </div>
    <div class="section-card">
      <h3 class="section-title">Evidence status</h3>
      <div class="evidence-list">
        ${evidenceCard(
          "Approved Product Copy",
          hasCopy,
          "Upload a licensed product copy to complete this evidence item.",
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
  applyPermissionUi();
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
  const promoteArgs = {
    canEdit: canWrite(),
    productReviewStatus: review.review_status,
    compositionReviewComplete: row.composition_review_complete,
    verifiedLines: row.verified_lines ?? evidence.composition_lines_verified,
    compositionLines: row.composition_lines ?? evidence.composition_lines_total,
    openBlockers: row.open_blockers,
    errorOrBlockerIssueCount: issueCount,
    approvedFormulationPresent: evidence.approved_formulation_present,
    workflowRowVersion: row.workflow_row_version,
  };
  const verifyArgs = {
    canEdit: canWrite(),
    compositionReviewComplete: row.composition_review_complete,
    verifiedLines: row.verified_lines ?? evidence.composition_lines_verified,
    compositionLines: row.composition_lines ?? evidence.composition_lines_total,
    openBlockers: row.open_blockers,
    workflowRowVersion: row.workflow_row_version,
  };
  const promoteReason = promoteUnavailableReason(promoteArgs);
  const verifyReason = verifyProductUnavailableReason(verifyArgs);
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
        <textarea id="fldPromoteNotes" class="sasv-control" rows="2" data-edit-action="true">${escapeHtml(state.promoteNotes)}</textarea>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label primary" id="btnPromote" data-edit-action="true" ${
          promoteOk ? "" : `data-force-disabled="true" title="${escapeHtml(promoteReason)}"`
        }>Promote Verified Formulation</button>
      </div>
      ${promoteOk ? "" : `<p class="disabled-reason">${escapeHtml(promoteReason)}</p>`}`
          : ""
      }
      ${
        showVerify
          ? `<div class="form-field" style="margin-top:12px">
        <label for="fldVerifyNotes">Internal product verification notes</label>
        <textarea id="fldVerifyNotes" class="sasv-control" rows="2" data-edit-action="true">${escapeHtml(state.verifyNotes)}</textarea>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnVerifyProduct" data-edit-action="true" ${
          verifyOk ? "" : `data-force-disabled="true" title="${escapeHtml(verifyReason)}"`
        }>Verify Product internally</button>
      </div>
      ${verifyOk ? "" : `<p class="disabled-reason">${escapeHtml(verifyReason)}</p>`}`
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
  const filters = $("compositionFilters");
  if (filters) filters.hidden = tab !== "composition";
  if (tab === "composition") renderCompositionFilterLenses();
  if (tab === "overview") renderOverview();
  else if (tab === "details") renderDetails();
  else if (tab === "composition") renderComposition();
  else if (tab === "actions") renderActions();
  else if (tab === "evidence") renderEvidence();
  else if (tab === "readiness") renderReadiness();
}

function selectWorkflowTab(next, { focusTab = false } = {}) {
  if (!WORKSPACE_TABS.includes(next)) return;
  if (state.tab === "details") {
    syncDetailsDraftFromForm();
    void flushDetailsAutosave();
  }
  if (state.tab === "composition") void flushAllLineAutosaves();
  if (state.tab === "actions") void flushActionsAutosave();
  state.tab = next;
  renderActiveTab();
  if (focusTab) {
    $("workspaceTabs")?.querySelector(`[data-tab="${next}"]`)?.focus();
  }
}

function applyCompositionFilterChange() {
  renderCompositionFilterLenses();
  renderComposition();
  const scroll = $("workspaceScroll");
  if (scroll) scroll.scrollTop = 0;
}

function clearCompositionFilters() {
  state.compositionView = { search: "", reviewLens: "all", attention: "all" };
  applyCompositionFilterChange();
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
  syncDetailsVerifyUi();
}

function applyWorkspacePayload(payload, { preserveDrafts = false } = {}) {
  state.review = payload.review;
  state.lines = payload.lines || [];
  state.actions = payload.actions || [];
  state.evidence = payload.evidence;
  state.issues = payload.issues || [];
  state.copy = payload.copy || null;
  state.actionsReviewStatus = workingActionReviewStatus(state.actions);
  if (!preserveDrafts) {
    state.lineSaveStatus = new Map();
    state.detailsSaveStatus = "";
    state.actionsSaveStatus = "";
    state.copyPick = null;
    lineHalted.clear();
    detailsHalted = false;
    actionsHalted = false;
  }
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
    await flushDetailsAutosave();
    await flushAllLineAutosaves();
    await flushActionsAutosave();
  }
  saveQueueScroll();
  state.queueView.focusedProductId = productId;
  state.queueView.openedProductId = productId;
  state.compositionView = { search: "", reviewLens: "all", attention: "all" };
  const gen = ++state.loadGen;
  state.busy = true;
  setStatus("Loading product review workspace...");
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

async function reloadSelected({
  preserveDrafts = false,
  restoreComposition = false,
  focusLineId = null,
  focusControl = null,
} = {}) {
  if (!state.selectedProductId) return;
  const scroll = restoreComposition ? $("workspaceScroll")?.scrollTop : null;
  const gen = ++state.loadGen;
  const payload = await loadProductWorkspace(state.selectedProductId);
  if (gen !== state.loadGen) return;
  await refreshQueue({ silent: true });
  applyWorkspacePayload(payload, { preserveDrafts });
  renderProductHeader();
  renderActiveTab();
  if (restoreComposition && state.tab === "composition") {
    requestAnimationFrame(() => {
      if (scroll != null && $("workspaceScroll")) {
        $("workspaceScroll").scrollTop = scroll;
      }
      const correctBtn = focusLineId
        ? document.getElementById(`btn-correct-${focusLineId}`)
        : null;
      const resolveBtn = focusLineId
        ? document.getElementById(`btn-resolve-${focusLineId}`)
        : null;
      const card = focusLineId
        ? document.querySelector(`.line-card[data-line-id="${focusLineId}"]`)
        : null;
      const preferred =
        focusControl === "correct"
          ? correctBtn
          : focusControl === "resolve"
            ? resolveBtn
            : resolveBtn || correctBtn;
      (preferred || card?.querySelector("select") || card)?.focus?.();
    });
  }
}

async function backToQueue() {
  if (!confirmLeaveDirty()) return;
  await flushDetailsAutosave();
  await flushAllLineAutosaves();
  await flushActionsAutosave();
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
  requestAnimationFrame(() => {
    restoreQueueScroll();
    const wanted = state.queueView.openedProductId || state.queueView.focusedProductId;
    const rows = visibleQueueRowEls();
    const exists = rows.some((row) => String(row.dataset.productId) === String(wanted));
    if (exists) focusQueueRow(wanted);
    else if (rows[0]) focusQueueRow(rows[0].dataset.productId);
    else $("queueSearch")?.focus();
  });
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
  if (verify) {
    const reason = productDetailsVerifyPendingCopy(state.detailsDraft, {
      saveStatus: state.detailsSaveStatus,
    });
    if (
      !canVerifyProductDetails(state.detailsDraft, {
        canEdit: canWrite(),
        saveStatus: state.detailsSaveStatus,
      })
    ) {
      showToast(reason || "Product Details are not ready to verify.", "error");
      return;
    }
  }
  if (!verify) {
    await persistDetails(false);
    return;
  }
  await runMutation(async () => {
    await persistDetails(true);
    showToast("Product details verified.", "success");
    await reloadSelected();
  });
}

function linePayload(draft, verify) {
  return {
    sourceCompositionLineId: draft.sourceCompositionLineId,
    expectedRowVersion: draft.rowVersion,
    ingredientTypeOptionId: draft.ingredientTypeOptionId,
    ingredientFormOptionId: draft.ingredientFormOptionId,
    partUsedOptionId: draft.partUsedOptionId,
    measurementOptionId: draft.measurementOptionId,
    verify,
    reviewNotes: safeText(draft.reviewNotes) || null,
  };
}

async function persistLine(lineId, verify) {
  const id = String(lineId);
  if (lineHalted.has(id) && !verify) return null;
  const draft = state.lineDrafts.get(id);
  if (!draft) return null;
  const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, id));
  if (!verify && row && isVerifiedStatus(row.review_status)) return null;
  state.lineSaveStatus.set(id, "saving");
  patchAutosaveEl(`line-save-${id}`, "saving");
  const result = await saveLineReview(linePayload(draft, verify));
  if (result?.row_version != null) draft.rowVersion = result.row_version;
  state.lineBaselines.set(id, { ...draft });
  if (row && result?.review_status) row.review_status = result.review_status;
  state.lineSaveStatus.set(id, "saved");
  patchAutosaveEl(`line-save-${id}`, "saved");
  const chipHost = document.querySelector(`.line-card[data-line-id="${id}"] .line-head`);
  if (chipHost && result?.review_status) {
    const chips = chipHost.querySelectorAll(".status-chip");
    if (chips[0]) {
      chips[0].className = `status-chip ${reviewStatusChipClass(result.review_status)}`;
      chips[0].textContent = displayText(result.review_status, "PENDING");
    }
  }
  return result;
}

async function autosaveLine(lineId) {
  const id = String(lineId);
  if (lineHalted.has(id) || !canWrite()) return;
  if (lineInflight.has(id)) {
    lineQueued.add(id);
    return;
  }
  lineInflight.add(id);
  try {
    await persistLine(id, false);
  } catch (err) {
    handleAutosaveError(err, "line", id);
  } finally {
    lineInflight.delete(id);
    if (lineQueued.has(id)) {
      lineQueued.delete(id);
      void autosaveLine(id);
    }
  }
}

function queueLineAutosave(lineId, immediate) {
  const id = String(lineId);
  if (immediate) {
    flushDebounced(autosaveTimers, `line:${id}`);
    void autosaveLine(id);
    return;
  }
  scheduleDebounced(autosaveTimers, `line:${id}`, AUTOSAVE_DEBOUNCE_MS, () => {
    void autosaveLine(id);
  });
}

async function flushAllLineAutosaves() {
  const keys = [...autosaveTimers.keys()].filter((key) => String(key).startsWith("line:"));
  for (const key of keys) {
    const id = String(key).slice(5);
    if (flushDebounced(autosaveTimers, key)) await autosaveLine(id);
  }
}

async function persistDetails(verify) {
  const draft = state.detailsDraft;
  if (!draft) return null;
  if (!verify && detailsHalted) return null;
  if (!verify && isVerifiedStatus(state.review?.review_status)) return null;
  state.detailsSaveStatus = "saving";
  patchAutosaveEl("detailsAutosave", "saving");
  const result = await saveProductReview({
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
  if (result?.row_version != null && state.detailsDraft) {
    state.detailsDraft.rowVersion = result.row_version;
  }
  state.detailsBaseline = { ...state.detailsDraft };
  if (result?.review_status && state.review) state.review.review_status = result.review_status;
  state.detailsSaveStatus = "saved";
  patchAutosaveEl("detailsAutosave", "saved");
  return result;
}

async function autosaveDetails() {
  if (detailsHalted || !canWrite()) return;
  if (detailsInflight) {
    detailsQueued = true;
    return;
  }
  detailsInflight = true;
  try {
    await persistDetails(false);
  } catch (err) {
    handleAutosaveError(err, "details");
  } finally {
    detailsInflight = false;
    if (detailsQueued) {
      detailsQueued = false;
      void autosaveDetails();
    }
  }
}

function queueDetailsAutosave(immediate) {
  if (immediate) {
    flushDebounced(autosaveTimers, "details");
    void autosaveDetails();
    return;
  }
  scheduleDebounced(autosaveTimers, "details", AUTOSAVE_DEBOUNCE_MS, () => {
    void autosaveDetails();
  });
}

async function flushDetailsAutosave() {
  if (flushDebounced(autosaveTimers, "details")) await autosaveDetails();
}

async function persistActions(verify) {
  if (!verify && actionsHalted) return null;
  if (!verify && isVerifiedStatus(state.actionsReviewStatus)) return null;
  const actions = state.actionsDraft.map((item) => safeText(item)).filter(Boolean);
  state.actionsSaveStatus = "saving";
  patchAutosaveEl("actionsAutosave", "saving");
  const result = await saveProductActions({
    productId: state.selectedProductId,
    expectedWorkflowRowVersion: state.queueRow?.workflow_row_version,
    actions,
    verify,
  });
  if (result?.workflow_row_version != null && state.queueRow) {
    state.queueRow.workflow_row_version = result.workflow_row_version;
  }
  if (result?.review_status) state.actionsReviewStatus = result.review_status;
  state.actionsBaseline = [...state.actionsDraft];
  state.actionsSaveStatus = "saved";
  patchAutosaveEl("actionsAutosave", "saved");
  return result;
}

async function autosaveActions() {
  if (actionsHalted || !canWrite()) return;
  if (actionsInflight) {
    actionsQueued = true;
    return;
  }
  actionsInflight = true;
  try {
    await persistActions(false);
  } catch (err) {
    handleAutosaveError(err, "actions");
  } finally {
    actionsInflight = false;
    if (actionsQueued) {
      actionsQueued = false;
      void autosaveActions();
    }
  }
}

function queueActionsAutosave(immediate) {
  if (immediate) {
    flushDebounced(autosaveTimers, "actions");
    void autosaveActions();
    return;
  }
  scheduleDebounced(autosaveTimers, "actions", AUTOSAVE_DEBOUNCE_MS, () => {
    void autosaveActions();
  });
}

async function flushActionsAutosave() {
  if (flushDebounced(autosaveTimers, "actions")) await autosaveActions();
}

function handleAutosaveError(err, scope, lineId) {
  console.error("[eaushadhi] autosave failed", err);
  const kind = err instanceof EaushadhiRpcError ? err.kind : classifyRpcError(err).kind;
  const publicMessage = userMessageForError(err);
  const message = /^save failed/i.test(publicMessage)
    ? publicMessage
    : `Save failed. ${publicMessage}`;
  if (kind === ERROR_KIND.STALE) {
    if (scope === "line") {
      lineHalted.add(String(lineId));
      state.lineSaveStatus.set(String(lineId), "stale");
      patchAutosaveEl(`line-save-${lineId}`, "stale");
    } else if (scope === "details") {
      detailsHalted = true;
      state.detailsSaveStatus = "stale";
      patchAutosaveEl("detailsAutosave", "stale");
    } else {
      actionsHalted = true;
      state.actionsSaveStatus = "stale";
      patchAutosaveEl("actionsAutosave", "stale");
    }
    showToast("Server data changed - refresh/review required", "error", 6400);
    return;
  }
  if (scope === "line") {
    state.lineSaveStatus.set(String(lineId), "failed");
    patchAutosaveEl(`line-save-${lineId}`, "failed");
  } else if (scope === "details") {
    state.detailsSaveStatus = "failed";
    patchAutosaveEl("detailsAutosave", "failed");
  } else {
    state.actionsSaveStatus = "failed";
    patchAutosaveEl("actionsAutosave", "failed");
  }
  showToast(message, "error", 5200);
}

async function waitLineIdle(lineId) {
  const id = String(lineId);
  while (lineInflight.has(id)) {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

async function submitLine(lineId, verify) {
  const draft = state.lineDrafts.get(String(lineId));
  if (!draft) return;
  if (verify) {
    const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
    const saveStatus = state.lineSaveStatus.get(String(lineId)) || "";
    const reason = lineVerifyPendingCopy({
      draft,
      issues: state.issues,
      lineId,
      reviewStatus: row?.review_status,
      saveStatus,
    });
    if (
      !canVerifyCompositionLine({
        draft,
        issues: state.issues,
        lineId,
        reviewStatus: row?.review_status,
        saveStatus,
        canEdit: canWrite(),
      })
    ) {
      showToast(reason || "This line is not ready to verify.", "error");
      return;
    }
  }
  flushDebounced(autosaveTimers, `line:${lineId}`);
  await waitLineIdle(lineId);
  if (!verify) {
    await autosaveLine(lineId);
    return;
  }
  await runMutation(async () => {
    await persistLine(lineId, true);
    showToast("Line verified.", "success");
    await reloadSelected({ preserveDrafts: true, restoreComposition: true, focusLineId: lineId });
  });
}

async function submitActions(verify) {
  if (verify) {
    const reason = actionSetVerifyPendingCopy({
      actions: state.actionsDraft,
      reviewStatus: state.actionsReviewStatus,
      saveStatus: state.actionsSaveStatus,
    });
    if (
      !canVerifyActionSet({
        actions: state.actionsDraft,
        reviewStatus: state.actionsReviewStatus,
        saveStatus: state.actionsSaveStatus,
        canEdit: canWrite(),
      })
    ) {
      showToast(reason || "Pharmacological actions are not ready to verify.", "error");
      return;
    }
  }
  if (!verify) {
    await persistActions(false);
    return;
  }
  await runMutation(async () => {
    await persistActions(true);
    showToast("Pharmacological actions verified.", "success");
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

function reopenCopy(kind) {
  if (kind === "line") {
    return {
      title: "Reopen for correction",
      body: "This ingredient has already been verified. Reopening it will return the line to In Review.",
      confirm: "Reopen line",
    };
  }
  if (kind === "details") {
    return {
      title: "Reopen Product Details",
      body: "Product Details have already been verified. Reopening will return the section to In Review.",
      confirm: "Reopen Product Details",
    };
  }
  return {
    title: "Reopen Actions",
    body: "Pharmacological actions have already been verified. Reopening will return the section to In Review.",
    confirm: "Reopen Actions",
  };
}

function renderReopenBody() {
  const host = $("reopenBody");
  if (!host) return;
  const copy = reopenCopy(state.reopen.kind);
  $("reopenTitle").textContent = copy.title;
  $("reopenConfirm").textContent = copy.confirm;
  host.innerHTML = `
    <p class="muted-note">${escapeHtml(copy.body)}</p>
    <div class="form-field">
      <label for="fldReopenReason">Reason for reopening</label>
      <textarea id="fldReopenReason" class="sasv-control" rows="3" data-edit-action="true" required>${escapeHtml(state.reopen.reason || "")}</textarea>
    </div>`;
  const btn = $("reopenConfirm");
  const ok = Boolean(safeText(state.reopen.reason));
  if (btn) {
    btn.disabled = !ok || !canWrite();
    btn.dataset.forceDisabled = ok ? "false" : "true";
  }
  applyPermissionUi();
}

function closeReopen() {
  const trigger = state.reopen.trigger;
  state.reopen = { open: false, kind: null, lineId: null, reason: "", trigger: null };
  const backdrop = $("reopenBackdrop");
  if (backdrop) backdrop.hidden = true;
  if (trigger && typeof trigger.focus === "function") trigger.focus();
}

function openReopen(kind, trigger, lineId = null) {
  state.reopen = {
    open: true,
    kind,
    lineId,
    reason: "",
    trigger: trigger || null,
  };
  const backdrop = $("reopenBackdrop");
  if (backdrop) backdrop.hidden = false;
  renderReopenBody();
  $("reopenDialog")?.focus();
  requestAnimationFrame(() => $("fldReopenReason")?.focus());
}

async function submitReopen() {
  const reason = safeText(state.reopen.reason);
  if (!reason) return;
  const kind = state.reopen.kind;
  const lineId = state.reopen.lineId;
  await runMutation(async () => {
    if (kind === "line") {
      const draft = state.lineDrafts.get(String(lineId));
      await reopenLineReview({
        sourceCompositionLineId: lineId,
        expectedRowVersion: draft?.rowVersion,
        reason,
      });
    } else if (kind === "details") {
      await reopenProductReview({
        productId: state.selectedProductId,
        expectedRowVersion: state.detailsDraft?.rowVersion,
        reason,
      });
    } else {
      await reopenProductActions({
        productId: state.selectedProductId,
        expectedWorkflowRowVersion: state.queueRow?.workflow_row_version,
        reason,
      });
    }
    closeReopen();
    showToast("Section reopened for correction.", "success");
    await reloadSelected({
      restoreComposition: kind === "line",
      focusLineId: kind === "line" ? lineId : null,
      focusControl: kind === "line" ? "correct" : null,
    });
    if (kind === "line") {
      document.getElementById(`btn-reopen-${lineId}`)?.blur();
      document.querySelector(`.line-card[data-line-id="${lineId}"] select`)?.focus();
    }
  });
}

function renderVerifyReviewedBody() {
  const host = $("verifyReviewedBody");
  if (!host) return;
  const summary = summarizeVerifyReviewedLines(state.lines, state.lineDrafts, state.issues);
  const eligible = summary.eligible.length;
  const guidance = verifyReviewedEmptyGuidance(eligible);
  host.innerHTML = `
    <p><strong>Eligible: ${eligible}</strong></p>
    <p class="muted-note">Skipped:</p>
    <ul>
      <li>Pending: ${summary.pending}</li>
      <li>Blocking/error issue: ${summary.blocking}</li>
      <li>Incomplete mapping: ${summary.incomplete}</li>
    </ul>
    ${guidance ? `<p class="disabled-reason">${escapeHtml(guidance)}</p>` : ""}`;
  const btn = $("verifyReviewedConfirm");
  if (btn) {
    btn.textContent = verifyReviewedConfirmLabel(eligible);
    const ok = eligible > 0 && canWrite();
    btn.disabled = !ok || state.busy;
    btn.dataset.forceDisabled = ok ? "false" : "true";
  }
  applyPermissionUi();
}

function closeVerifyReviewed() {
  state.verifyReviewed.open = false;
  const backdrop = $("verifyReviewedBackdrop");
  if (backdrop) backdrop.hidden = true;
  $("btnVerifyReviewedLines")?.focus();
}

function openVerifyReviewed() {
  state.verifyReviewed.open = true;
  const backdrop = $("verifyReviewedBackdrop");
  if (backdrop) backdrop.hidden = false;
  renderVerifyReviewedBody();
  $("verifyReviewedDialog")?.focus();
}

async function submitVerifyReviewed() {
  const summary = summarizeVerifyReviewedLines(state.lines, state.lineDrafts, state.issues);
  const ids = summary.eligible.slice();
  if (!ids.length) {
    showToast(verifyReviewedEmptyGuidance(0), "error");
    return;
  }
  closeVerifyReviewed();
  let verified = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      flushDebounced(autosaveTimers, `line:${id}`);
      await waitLineIdle(id);
      const draft = state.lineDrafts.get(String(id));
      if (!draft || !lineSelectionsComplete(draft)) {
        failed += 1;
        continue;
      }
      await persistLine(id, true);
      verified += 1;
    } catch (err) {
      failed += 1;
      console.error("[eaushadhi] verify reviewed line failed", err);
    }
  }
  showToast(
    failed ? `Verified ${verified}. Failed ${failed}.` : `Verified ${verified} reviewed lines.`,
    failed ? "warning" : "success",
    5200,
  );
  await reloadSelected({ restoreComposition: true });
}

async function hashFileSha256(file) {
  if (!file || !globalThis.crypto?.subtle) return null;
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function pickCopyFile(file) {
  const check = validateEvidenceFile(file);
  if (!check.ok) {
    state.copyPick = { file: null, error: check.error };
  } else {
    state.copyPick = { file, error: "" };
  }
  renderEvidence();
}

async function uploadSelectedCopy() {
  const file = state.copyPick?.file;
  const check = validateEvidenceFile(file);
  if (!check.ok) {
    state.copyPick = { file, error: check.error };
    renderEvidence();
    return;
  }
  const token =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = buildApprovedProductCopyPath(state.selectedProductId, file.name, token);
  if (!path) {
    showToast("Cannot build a storage path for this product.", "error");
    return;
  }
  await runMutation(async () => {
    await uploadApprovedProductCopyObject(path, file, file.type);
    try {
      const sha = await hashFileSha256(file);
      await registerApprovedProductCopy({
        productId: state.selectedProductId,
        storageBucket: EVIDENCE_BUCKET,
        storagePath: path,
        originalFileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        contentSha256: sha,
        mappingNotes: null,
      });
    } catch (err) {
      await removeApprovedProductCopyObject(path);
      throw err;
    }
    state.copyPick = null;
    showToast("Approved Product Copy registered.", "success");
    await reloadSelected();
  });
}

async function openCurrentCopy() {
  const path = state.copy?.storage_path;
  if (!path) return;
  try {
    const url = await signedApprovedProductCopyUrl(path, 60);
    if (!url) throw new Error("Could not open copy.");
    window.open(url, "_blank", "noopener");
  } catch (err) {
    toastError(err);
  }
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
  });
  $("homeBtn")?.addEventListener("click", async () => {
    if (!confirmLeaveDirty()) return;
    await flushDetailsAutosave();
    await flushAllLineAutosaves();
    await flushActionsAutosave();
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
  $("queueSearch")?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (safeText(state.queueView.search)) {
      $("queueSearch").value = "";
      state.queueView.search = "";
      syncSearchClear();
      applyQueueFilterChange();
      return;
    }
    $("queueSearch").blur();
    const firstLens = $("reviewLenses")?.querySelector('button[tabindex="0"]');
    (firstLens || visibleQueueRowEls()[0] || $("refreshBtn"))?.focus();
  });
  $("queueSearchClear")?.addEventListener("click", () => {
    $("queueSearch").value = "";
    state.queueView.search = "";
    syncSearchClear();
    applyQueueFilterChange();
    $("queueSearch")?.focus();
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
  $("reviewLenses")?.addEventListener("keydown", (event) => {
    handleRovingKey(event, $("reviewLenses"), {
      onActivate: (btn) => {
        state.queueView.reviewLens = btn.dataset.reviewLens || "all";
        applyQueueFilterChange();
        $("reviewLenses")?.querySelector(`[data-review-lens="${state.queueView.reviewLens}"]`)?.focus();
      },
    });
  });
  $("systemLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-system-lens]");
    if (!btn) return;
    state.queueView.systemLens = btn.dataset.systemLens || "all";
    applyQueueFilterChange();
  });
  $("systemLenses")?.addEventListener("keydown", (event) => {
    handleRovingKey(event, $("systemLenses"), {
      onActivate: (btn) => {
        state.queueView.systemLens = btn.dataset.systemLens || "all";
        applyQueueFilterChange();
        $("systemLenses")?.querySelector(`[data-system-lens="${state.queueView.systemLens}"]`)?.focus();
      },
    });
  });
  $("classLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-class-lens]");
    if (!btn) return;
    state.queueView.classLens = btn.dataset.classLens || "all";
    applyQueueFilterChange();
  });
  $("classLenses")?.addEventListener("keydown", (event) => {
    handleRovingKey(event, $("classLenses"), {
      onActivate: (btn) => {
        state.queueView.classLens = btn.dataset.classLens || "all";
        applyQueueFilterChange();
        $("classLenses")?.querySelector(`[data-class-lens="${state.queueView.classLens}"]`)?.focus();
      },
    });
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
  $("queueTbody")?.addEventListener("keydown", (event) => {
    if (isEditableKeyboardTarget(event.target)) return;
    const row = event.target.closest("tr.queue-row[data-product-id]");
    if (!row) return;
    const rows = visibleQueueRowEls();
    const current = rows.indexOf(row);
    if (current < 0) return;
    if (event.key === "Enter") {
      event.preventDefault();
      openProduct(row.dataset.productId);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      focusQueueRow(row.dataset.productId);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      if (rows[0]) focusQueueRow(rows[0].dataset.productId);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      appendQueueChunk({ force: true });
      const nextRows = visibleQueueRowEls();
      const last = nextRows[nextRows.length - 1];
      if (last) focusQueueRow(last.dataset.productId);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = nextRovingIndex(current, rows.length, event.key, { wrap: false });
      if (rows[next]) focusQueueRow(rows[next].dataset.productId);
    }
  });
  $("workspaceTabs")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn) return;
    selectWorkflowTab(btn.dataset.tab);
  });
  $("workspaceTabs")?.addEventListener("keydown", (event) => {
    handleRovingKey(event, $("workspaceTabs"), {
      onActivate: (btn) => selectWorkflowTab(btn.dataset.tab, { focusTab: true }),
    });
  });

  $("compositionSearch")?.addEventListener("input", (event) => {
    const value = event.target.value || "";
    clearTimeout(compositionSearchTimer);
    compositionSearchTimer = setTimeout(() => {
      state.compositionView.search = value;
      applyCompositionFilterChange();
    }, 180);
  });
  $("compositionSearchClear")?.addEventListener("click", () => {
    $("compositionSearch").value = "";
    state.compositionView.search = "";
    applyCompositionFilterChange();
    $("compositionSearch")?.focus();
  });
  $("btnClearCompositionFiltersBar")?.addEventListener("click", () => {
    clearCompositionFilters();
    $("compositionSearch")?.focus();
  });
  $("compositionReviewLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-comp-review-lens]");
    if (!btn) return;
    state.compositionView.reviewLens = btn.dataset.compReviewLens || "all";
    applyCompositionFilterChange();
  });
  $("compositionReviewLenses")?.addEventListener("keydown", (event) => {
    handleRovingKey(event, $("compositionReviewLenses"), {
      onActivate: (btn) => {
        state.compositionView.reviewLens = btn.dataset.compReviewLens || "all";
        applyCompositionFilterChange();
        $("compositionReviewLenses")
          ?.querySelector(`[data-comp-review-lens="${state.compositionView.reviewLens}"]`)
          ?.focus();
      },
    });
  });
  $("compositionAttentionLenses")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-comp-attention-lens]");
    if (!btn) return;
    state.compositionView.attention = btn.dataset.compAttentionLens || "all";
    applyCompositionFilterChange();
  });
  $("compositionAttentionLenses")?.addEventListener("keydown", (event) => {
    handleRovingKey(event, $("compositionAttentionLenses"), {
      onActivate: (btn) => {
        state.compositionView.attention = btn.dataset.compAttentionLens || "all";
        applyCompositionFilterChange();
        $("compositionAttentionLenses")
          ?.querySelector(`[data-comp-attention-lens="${state.compositionView.attention}"]`)
          ?.focus();
      },
    });
  });

  $("tab-details")?.addEventListener("click", (event) => {
    if (event.target.id === "btnVerifyDetails") submitDetails(true);
    if (event.target.id === "btnReopenDetails") openReopen("details", event.target);
    const boolBtn = event.target.closest("[data-bool-value]");
    if (boolBtn && state.detailsDraft && canEditReviewedSection(state.review?.review_status)) {
      const group = boolBtn.closest("[data-bool-key]");
      const key = group?.dataset.boolKey;
      if (key === "combinedRestricted") {
        applyDeclarationChoice(parseBoolButton(boolBtn.dataset.boolValue));
        syncDetailsVerifyUi();
        queueDetailsAutosave(true);
        renderDetails();
        return;
      }
      if (key) {
        state.detailsDraft[key] = parseBoolButton(boolBtn.dataset.boolValue);
        group.querySelectorAll("[data-bool-value]").forEach((el) => {
          const on = el === boolBtn;
          el.setAttribute("aria-checked", String(on));
          el.tabIndex = on ? 0 : -1;
        });
        syncDetailsVerifyUi();
        queueDetailsAutosave(true);
      }
    }
  });
  $("tab-details")?.addEventListener("keydown", (event) => {
    const group = event.target.closest("[data-bool-key][role='radiogroup']");
    if (!group) return;
    handleRovingKey(event, group, {
      onActivate: (btn) => {
        const key = group.dataset.boolKey;
        if (!key || !state.detailsDraft) return;
        if (!canEditReviewedSection(state.review?.review_status)) return;
        if (key === "combinedRestricted") {
          applyDeclarationChoice(parseBoolButton(btn.dataset.boolValue));
          btn.focus();
          syncDetailsVerifyUi();
          queueDetailsAutosave(true);
          renderDetails();
          return;
        }
        state.detailsDraft[key] = parseBoolButton(btn.dataset.boolValue);
        group.querySelectorAll("[data-bool-value]").forEach((el) => {
          const on = el === btn;
          el.setAttribute("aria-checked", String(on));
          el.tabIndex = on ? 0 : -1;
        });
        btn.focus();
        syncDetailsVerifyUi();
        queueDetailsAutosave(true);
      },
    });
  });
  $("tab-details")?.addEventListener("input", (event) => {
    if (state.tab !== "details") return;
    syncDetailsDraftFromForm();
    if (["fldTitle", "fldDiseases", "fldReviewNotes"].includes(event.target.id)) {
      queueDetailsAutosave(false);
    }
  });
  $("tab-details")?.addEventListener("change", (event) => {
    if (state.tab !== "details") return;
    syncDetailsDraftFromForm();
    if (event.target.id === "fldPurpose") queueDetailsAutosave(true);
  });
  $("tab-details")?.addEventListener("focusout", (event) => {
    if (["fldTitle", "fldDiseases", "fldReviewNotes"].includes(event.target.id)) {
      void flushDetailsAutosave();
    }
  });

  $("btnVerifyReviewedLines")?.addEventListener("click", openVerifyReviewed);

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
    if (key !== "reviewNotes") queueLineAutosave(lineId, true);
    syncLineVerifyUi(lineId);
  });
  $("tab-composition")?.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.draftKey !== "reviewNotes") return;
    const draft = state.lineDrafts.get(String(el.dataset.lineId));
    if (draft) draft.reviewNotes = el.value;
    queueLineAutosave(el.dataset.lineId, false);
  });
  $("tab-composition")?.addEventListener("focusout", (event) => {
    const el = event.target;
    if (el.dataset.draftKey !== "reviewNotes") return;
    flushDebounced(autosaveTimers, `line:${el.dataset.lineId}`);
    void autosaveLine(el.dataset.lineId);
  });
  $("tab-composition")?.addEventListener("click", (event) => {
    if (event.target.id === "btnClearCompositionFilters") {
      clearCompositionFilters();
      return;
    }
    const verify = event.target.closest("[data-line-verify]");
    const resolve = event.target.closest("[data-source-resolve]");
    const correct = event.target.closest("[data-source-correct]");
    const reopen = event.target.closest("[data-line-reopen]");
    if (verify) submitLine(verify.dataset.lineVerify, true);
    if (resolve) openSourceResolve(resolve.dataset.sourceResolve, resolve);
    if (correct) openSourceCorrect(correct.dataset.sourceCorrect, correct);
    if (reopen) openReopen("line", reopen, reopen.dataset.lineReopen);
  });

  $("tab-actions")?.addEventListener("click", (event) => {
    if (event.target.id === "btnAddAction") {
      state.actionsDraft = [...state.actionsDraft, ""];
      renderActions();
      queueActionsAutosave(true);
      return;
    }
    if (event.target.id === "btnVerifyActions") {
      submitActions(true);
      return;
    }
    if (event.target.id === "btnReopenActions") {
      openReopen("actions", event.target);
      return;
    }
    const remove = event.target.closest("[data-action-remove]");
    if (remove) {
      const vocab = state.catalogs.pharmacologicalActionOptions || [];
      const custom = customActionDraftRows(state.actionsDraft, vocab);
      const i = Number(remove.dataset.actionRemove);
      custom.splice(i, 1);
      state.actionsDraft = composeActionsDraft(vocab, [
        ...state.actionsDraft.filter((item) => isVocabActionLabel(item, vocab)),
        ...custom,
      ]);
      renderActions();
      queueActionsAutosave(true);
    }
  });
  $("tab-actions")?.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.actionText == null) return;
    const vocab = state.catalogs.pharmacologicalActionOptions || [];
    const custom = customActionDraftRows(state.actionsDraft, vocab);
    custom[Number(el.dataset.actionText)] = el.value;
    state.actionsDraft = composeActionsDraft(vocab, [
      ...state.actionsDraft.filter((item) => isVocabActionLabel(item, vocab)),
      ...custom,
    ]);
    syncActionsVerifyUi();
    queueActionsAutosave(false);
  });
  $("tab-actions")?.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.actionVocabToggle == null) return;
    const vocab = state.catalogs.pharmacologicalActionOptions || [];
    state.actionsDraft = composeActionsDraft(
      vocab,
      toggleVocabActionDraft(state.actionsDraft, el.dataset.actionVocabToggle, el.checked),
    );
    syncActionsVerifyUi();
    queueActionsAutosave(true);
  });
  $("tab-actions")?.addEventListener("focusout", (event) => {
    if (event.target.dataset.actionText == null) return;
    void flushActionsAutosave();
  });

  $("tab-evidence")?.addEventListener("change", (event) => {
    if (event.target.id !== "fldCopyFile") return;
    pickCopyFile(event.target.files?.[0] || null);
  });
  $("tab-evidence")?.addEventListener("click", (event) => {
    if (event.target.id === "btnUploadCopy") void uploadSelectedCopy();
    if (event.target.id === "btnCancelCopy") {
      state.copyPick = null;
      renderEvidence();
    }
    if (event.target.id === "btnOpenCopy") void openCurrentCopy();
    if (event.target.id === "btnReplaceCopy") {
      state.copyPick = { file: null, error: "" };
      renderEvidence();
      requestAnimationFrame(() => $("fldCopyFile")?.click());
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

  $("sourceResolveClose")?.addEventListener("click", closeSourceResolve);
  $("sourceResolveCancel")?.addEventListener("click", closeSourceResolve);
  $("sourceResolveConfirm")?.addEventListener("click", submitSourceResolve);
  $("sourceResolveBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "sourceResolveBackdrop") closeSourceResolve();
  });
  $("sourceResolveBody")?.addEventListener("change", (event) => {
    if (event.target.id === "srcConfirmIdentity") {
      state.sourceResolve.confirmIdentity = event.target.checked === true;
      syncSourceResolveConfirm();
    }
    if (event.target.id === "srcConfirmPart") {
      state.sourceResolve.confirmPartUsed = event.target.checked === true;
      syncSourceResolveConfirm();
    }
  });
  $("sourceResolveBody")?.addEventListener("input", (event) => {
    if (event.target.id === "srcResolutionNotes") {
      state.sourceResolve.notes = event.target.value || "";
    }
  });

  $("sourceCorrectClose")?.addEventListener("click", closeSourceCorrect);
  $("sourceCorrectCancel")?.addEventListener("click", closeSourceCorrect);
  $("sourceCorrectConfirm")?.addEventListener("click", submitSourceCorrect);
  $("sourceCorrectBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "sourceCorrectBackdrop") closeSourceCorrect();
  });
  $("sourceCorrectBody")?.addEventListener("input", (event) => {
    const id = event.target.id;
    const value = event.target.value;
    if (id === "srcCorrectIngredient") patchSourceCorrectDraft("raw_ingredient_name", value);
    if (id === "srcCorrectScientific") patchSourceCorrectDraft("raw_scientific_name", value);
    if (id === "srcCorrectPart") patchSourceCorrectDraft("raw_part_used", value);
    if (id === "srcCorrectQtyText") patchSourceCorrectDraft("raw_quantity_text", value);
    if (id === "srcCorrectQtyNum") patchSourceCorrectDraft("raw_quantity_value", value);
    if (id === "srcCorrectUnit") patchSourceCorrectDraft("raw_unit_text", value);
    if (id === "srcCorrectReason") patchSourceCorrectDraft("correction_reason", value);
  });

  $("reopenClose")?.addEventListener("click", closeReopen);
  $("reopenCancel")?.addEventListener("click", closeReopen);
  $("reopenConfirm")?.addEventListener("click", submitReopen);
  $("reopenBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "reopenBackdrop") closeReopen();
  });
  $("reopenBody")?.addEventListener("input", (event) => {
    if (event.target.id !== "fldReopenReason") return;
    state.reopen.reason = event.target.value || "";
    const btn = $("reopenConfirm");
    const ok = Boolean(safeText(state.reopen.reason));
    if (btn) {
      btn.disabled = !ok || !canWrite() || state.busy;
      btn.dataset.forceDisabled = ok ? "false" : "true";
    }
  });

  $("verifyReviewedClose")?.addEventListener("click", closeVerifyReviewed);
  $("verifyReviewedCancel")?.addEventListener("click", closeVerifyReviewed);
  $("verifyReviewedConfirm")?.addEventListener("click", submitVerifyReviewed);
  $("verifyReviewedBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "verifyReviewedBackdrop") closeVerifyReviewed();
  });

  document.addEventListener("keydown", (event) => {
    if (state.sourceResolve.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSourceResolve();
        return;
      }
      trapModalTab(event, "sourceResolveDialog");
      return;
    }
    if (state.sourceCorrect.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSourceCorrect();
        return;
      }
      trapModalTab(event, "sourceCorrectDialog");
      return;
    }
    if (state.reopen.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeReopen();
        return;
      }
      trapModalTab(event, "reopenDialog");
      return;
    }
    if (state.verifyReviewed.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeVerifyReviewed();
        return;
      }
      trapModalTab(event, "verifyReviewedDialog");
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (isProductMode() || isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      $("queueSearch")?.focus();
    }
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
  setStatus("Loading product queue...");
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
