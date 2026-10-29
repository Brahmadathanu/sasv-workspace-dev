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
  CANONICAL_PROMOTE_NOTES,
  CANONICAL_VERIFY_NOTES,
  FIRST_CONTROLLED_PRODUCT_ID,
  isFirstControlledEntryProduct,
  canPromoteFormulation,
  canVerifyProductWorkflow,
  canCorrectWorkingSourceLine,
  canEditReviewedSection,
  canSubmitSourceResolution,
  canSubmitPostEntryIngredientFormReconcile,
  canSubmitWorkingSourceCorrection,
  canVerifyActionSet,
  canVerifyClassification,
  canVerifyCompositionLine,
  canVerifyProductDetails,
  classificationDirty,
  classificationDraftFromReview,
  classificationScopedOptionsUnloaded,
  classificationSuggestionCopy,
  classificationVerifyPendingCopy,
  CLASSIFICATION_OPTIONS_UNLOADED_COPY,
  CLASSIFICATION_SUBTYPE_INDEPENDENCE_NOTE,
  clearIncompatibleClassificationChildren,
  classifyRpcError,
  combinedRestrictedDeclarationState,
  COMBINED_RESTRICTED_DECLARATION_LABEL,
  COMBINED_RESTRICTED_YES_UNAVAILABLE_COPY,
  compositionFiltersAreActive,
  compositionIsComplete,
  customActionDraftRows,
  composeActionsDraft,
  DEFAULT_IN_PROGRESS_PORTAL_REASON,
  detailsDraftFromReview,
  detailsDirty,
  eligibleIngredientFormReconcileOptions,
  isPortalDiseasesVerified,
  portalDiseasesCharsetOk,
  portalFieldsDraftFromRow,
  portalFieldsDirty,
  portalFieldsSaveReady,
  portalTextDraftFromRow,
  portalTextEditableValue,
  PORTAL_SHELFMONTH_ROUTE_OPTIONS,
  displayText,
  DOCUMENT_PURPOSE,
  EVIDENCE_CONTRACT_UNAVAILABLE,
  EVIDENCE_EXTENSION_REQUIRED_COPY,
  EVIDENCE_FILENAME_RENAME_COPY,
  EVIDENCE_MIME_EXTENSION_MISMATCH_COPY,
  entryStatusChipClass,
  evidenceFileExtension,
  evidenceFileNameMatchesExpected,
  evidenceFileTypeMatchesExtension,
  filterCompositionLines,
  findQueueRow,
  filterQueueRows,
  flushDebounced,
  formatFileSize,
  formatIssueDetails,
  formatRawQuantityDisplay,
  formatShowingCount,
  formatVerifiedTotal,
  governedCopyUploadReady,
  idsEqual,
  isEditableKeyboardTarget,
  isVerifiedStatus,
  issuesForLine,
  isVocabActionLabel,
  joinHtmlParts,
  lineDirty,
  lineDraftFromRow,
  lineHasResolvableSourceIssue,
  lineSaveForReviewUi,
  lineSelectionsComplete,
  lineVerifyPendingCopy,
  normalizeReviewNotesForDisplay,
  mergePreservedLineDraft,
  nextQueueRenderCount,
  nextRequiredAction,
  nextRovingIndex,
  normalizeEntryStatus,
  normalizeReviewStatus,
  preEntryReopenAvailability,
  postEntryIngredientFormReconcileAvailability,
  openErrorOrBlockerCount,
  optionId,
  parseOptionalNumericQuantity,
  portalFieldSpecs,
  portalFillStepperModel,
  classificationSelectedOptionDisplay,
  productDetailsVerifyPendingCopy,
  promoteUnavailableReason,
  provenanceLabel,
  resetQueueRenderCount,
  resolveClassificationSubtypeMode,
  resolveFieldProvenance,
  reviewStatusChipClass,
  safeText,
  scheduleDebounced,
  selectableClassificationOptions,
  severityLabel,
  severityRank,
  shouldAppendQueueChunk,
  shouldApplyPromoteNotesDefault,
  shouldApplyVerifyNotesDefault,
  sourceFieldDisplay,
  suggestionBasisSummary,
  summarizeVerifyReviewedLines,
  syncWorkingSourceQuantityDraft,
  approvalNoticeFromError,
  bulkApprovalSummary,
  fourEyesMessage,
  stageApprovalBlock,
  stageSaverCopy,
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
  associateReferenceMappingsByLine,
  filterReferenceDictionary,
  positiveReferenceSelectionId,
  referenceMatchLabel,
  referenceGovernanceLabel,
} from "./eaushadhi-reference-mapping.js";
import {
  createReferenceAliasDraft,
  createReferencePortalMappingDraft,
  createReferenceWork,
  EaushadhiRpcError,
  fetchReferenceAliasCandidates,
  fetchReferenceDictionary,
  fetchReferenceWorkOptions,
  fetchProductQueue,
  fetchWorklist,
  fetchMyRoles,
  fetchStageReviewState,
  fetchDocumentUploadContract,
  fetchProductClassificationOptions,
  fetchProductPortalText,
  correctWorkingSourceLine,
  fetchSourceIssueContext,
  verifyReferenceAlias,
  verifyReferenceMapping,
  loadProductWorkspace,
  loadSessionCatalogs,
  promoteVerifiedFormulation,
  registerApprovedProductCopy,
  removeApprovedProductCopyObject,
  reopenLineReview,
  reconcilePostEntryLineIngredientForm,
  reopenProductActions,
  reopenProductClassification,
  reopenProductReview,
  resolveSourceIssue,
  saveLineReview,
  saveProductActions,
  saveProductClassificationReview,
  saveProductReview,
  saveProductDossierPortalFields,
  saveProductPortalText,
  signedApprovedProductCopyUrl,
  uploadApprovedProductCopyObject,
  uploadQcReportObject,
  removeQcReportObject,
  verifyProduct,
} from "./eaushadhi-review-api.js";
import {
  CACHE_NAME_UX1,
  ROLE_FALLBACK,
  WORKLIST_QUEUES,
  WORKLIST_TAB_KEY,
  actionDecision,
  decorateWorkspace,
  filterWorklistRows,
  nextActionDecision,
  normalizeWorklistRow,
  placeTechnicalDrawer,
  setActionState,
  signedInRoleLabel,
  worklistLevelChoices,
  worklistEmptyHtml,
  worklistFiltersActive,
  worklistModalHtml,
  worklistRowHtml,
  worklistTabsHtml,
  workspaceTabForStage,
} from "./eaushadhi-review-worklist.js";
import {
  captureWorkerPortalContract,
  connectWorkerBrowser,
  getWorkerStatus,
  onWorkerStatus,
  openWorkerCaptureFolder,
  recheckWorkerLogin,
  readQcPreparation,
  readQcReport,
  loadQcProtocolOptions,
  loadQcLaboratoryOptions,
  readQcPreparationWorkspace,
  reviewQcPreparation,
  saveQcPreparation,
  verifyQcPreparationSource,
  reopenQcPreparation,
  recheckQcEvidence,
  readQcReadiness,
  acceptQcFact,
  correctQcFactAcceptance,
  verifyQcProtocolMapping,
  readQcFillPreflight,
  executeQcPrepRun,
  recordQcLabDecision,
  listQcReports,
  reserveQcReport,
  registerQcReport,
  verifyQcReportBytes,
  runWorkerFoundationCheck,
  runWorkerEntryDryRun,
  previewWorkerProductDetails,
  previewWorkerComposition,
  rebasePortalProjectionProductDetails,
  reconcileAmbiguousSaveProductDetails,
  recoverAmbiguousSaveExactOneProductDetails,
  resumeWorkerProductDetails,
  startWorkerProductDetails,
  startWorkerCompositionLine,
  stopWorkerBrowser,
  verifyWorkerCompositionStage,
  workerApiAvailable,
} from "./eaushadhi-review-worker-client.js";

const $ = (id) => document.getElementById(id);

const access = {
  userId: null,
  canView: false,
  canEdit: false,
  loaded: false,
  loadError: false,
};

const state = {
  surface: "queue",
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
      REFERENCE: [],
    },
    permissionPurposeOptions: [],
    pharmacologicalActionOptions: [],
  },
  selectedProductId: null,
  myRoles: { ...ROLE_FALLBACK },
  stageReview: [],
  stageReviewLoaded: false,
  stageReviewFailed: false,
  approvalNotice: null,
  pendingApproval: null,
  worklist: null,
  worklistRow: null,
  worklistError: false,
  worklistQueue: "TO_VERIFY",
  worklistCategory: "all",
  worklistSubcategory: "all",
  worklistGroup: "all",
  worklistBlocked: false,
  worklistQuery: "",
  worklistRenderedCount: 0,
  worklistScrollTop: 0,
  worklistFocusedId: null,
  tab: "overview",
  queueRow: null,
  review: null,
  lines: [],
  referenceMappings: [],
  referenceDictionary: {
    loaded: false,
    loading: false,
    error: null,
    rows: [],
    search: "",
    statusFilter: "all",
  },
  referenceWorkOptions: [],
  referenceWorkOptionsLoaded: false,
  actions: [],
  evidence: null,
  issues: [],
  dossierPortalFields: null,
  detailsDraft: null,
  detailsBaseline: null,
  portalFieldsDraft: null,
  portalFieldsBaseline: null,
  portalFieldsSaveStatus: "",
  portalTextRow: null,
  portalTextDraft: null,
  portalTextSaveStatus: "",
  classification: null,
  classificationDraft: null,
  classificationBaseline: null,
  classificationOptions: {
    PRODUCT_TYPE: [],
    PRODUCT_CATEGORY: [],
    PRODUCT_SUBTYPE: [],
  },
  classificationSaveStatus: "",
  lineDrafts: new Map(),
  lineBaselines: new Map(),
  actionsDraft: [],
  actionsBaseline: [],
  promoteNotes: "",
  promoteNotesOrigin: "unset",
  verifyNotes: "",
  verifyNotesOrigin: "unset",
  workerStatus: null,
  workerFoundationResult: null,
  workerQcPreparationReadResult: null,
  workerQcReportReadResult: null,
  qcPrepOpen: true,
  qcPrepRequest: 0,
  qcPrepLoading: false,
  qcPrepLoadedFor: null,
  qcPrepOptions: [],
  qcPrepLabs: [],
  qcPrepLabsUnavailable: false,
  qcPrepDefaultsApplied: false,
  qcPrepFieldsComplete: false,
  qcPrepServer: null,
  qcPrepAmbiguous: false,
  qcPrepForm: null,
  qcPrepDirty: false,
  qcPrepNotice: "",
  qcPrepPreserveNotice: "",
  qcPrepReloadFeedback: false,
  qcPrepReasons: [],
  qcPrepNoteOverrides: {
    date_evidence_note: false,
    report_date_evidence_note: false,
    report_evidence_note: false,
  },
  qcReportRequest: 0,
  qcReportUploadRequest: 0,
  qcReportLoading: false,
  qcReportLoadedFor: null,
  qcReports: [],
  qcReportNotice: "",
  qcReportWarning: "",
  qcReportFile: null,
  qcReportFileProductId: null,
  qcReportFilePreparationId: null,
  qcReportSha: "",
  qcReportFileError: "",
  qcReportLastSize: null,
  qcReportVerifyRequest: 0,
  qcReportVerifying: false,
  qcReportConfirmOpen: false,
  qcReportByteResult: null,
  qcFactScope: "",
  qcFactRows: null,
  qcFactAttest: false,
  qcFactNotice: "",
  qcFactHighlights: [],
  qcSourceVerifyRunning: false,
  qcSourceConfirmOpen: false,
  qcReopenRunning: false,
  qcEvidenceRecheck: null,
  qcEvidenceRequest: 0,
  qcEvidenceLoadedFor: null,
  qcEvidenceLoading: false,
  qcReadiness: null,
  qcReadinessRequest: 0,
  qcReadinessLoadedFor: null,
  qcReadinessLoading: false,
  qcReadinessNotice: "",
  qcLabDraftScope: "",
  qcLabDocumentReference: "",
  qcLabRationale: "",
  qcLabAttest: false,
  qcLabDraftSeeded: false,
  qcFactAcceptScope: "",
  qcFactAcceptDrafts: null,
  qcGovernanceRunning: false,
  qcGovernanceConfirmOpen: false,
  qcFactCorrectScope: "",
  qcFactCorrectDrafts: null,
  qcFactCorrectOpen: "",
  qcFactCorrectNotice: "",
  qcMappingScope: "",
  qcMappingReason: "",
  qcMappingAttest: false,
  qcMappingSeeded: false,
  qcMappingNotice: "",
  qcFillPreflight: null,
  qcFillRequest: 0,
  qcFillLoadedFor: null,
  qcFillLoading: false,
  qcFillNotice: "",
  qcFillAckScope: "",
  qcFillProvisionalAck: false,
  qcFillProvisionalNote: "",
  qcFillDerivedAck: false,
  qcFillDerivedNote: "",
  qcFillDerivedNoteTouched: false,
  qcFillAckSeeded: false,
  qcFillRun: null,
  qcFillRunNotice: "",
  qcFillReportName: "",
  qcFillInspectOk: false,
  qcFillChosenReportName: "",
  qcFillInspectFileResult: null,
  qcFillCheckedReport: null,
  qcFillDryRun: null,
  qcNativeSaveStatus: { buildAuthorized: false, tag: "D7.3" },
  qcNativeSaveReport: null,
  qcPrepRunBusy: false,
  qcReportVerifyError: "",
  qcReportVerifyCode: "",
  qcReportOfferNewVersion: false,
  workerDryRunResult: null,
  workerProductDetailsPreview: null,
  workerProductDetailsResult: null,
  workerReconcileResult: null,
  workerRebaseResult: null,
  workerExactOneRecoveryResult: null,
  workerCompositionPreview: null,
  workerCompositionResult: null,
  workerCaptureResult: null,
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
  postEntryReconcile: {
    open: false,
    lineId: null,
    targetIngredientFormOptionId: null,
    reason: "",
    trigger: null,
  },
  verifyReviewed: { open: false },
  productDetailsConfirm: {
    open: false,
    mode: null,
    trigger: null,
    resolve: null,
  },
  compositionConfirm: { open: false, trigger: null, resolve: null },
  compositionStageVerifyConfirm: { open: false, trigger: null, resolve: null },
  lineSaveStatus: new Map(),
  detailsSaveStatus: "",
  actionsSaveStatus: "",
  actionsReviewStatus: "PENDING",
  copy: null,
  copyPick: null,
  copyContract: null,
  copyContractError: "",
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
let portalFieldsInflight = false;
let portalFieldsQueued = false;
let portalFieldsHalted = false;
let classificationInflight = false;
let classificationQueued = false;
let classificationHalted = false;
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
  const surfaces = {
    queue: "queuePanel",
    product: "workspacePanel",
    "reference-dictionary": "referenceDictionaryPanel",
  };
  if (!Object.hasOwn(surfaces, mode)) throw new Error(`Unknown application surface: ${mode}`);
  state.surface = mode;
  const dictionaryButton = $("openReferenceDictionaryBtn");
  if (dictionaryButton) {
    const dictionaryActive = mode === "reference-dictionary";
    dictionaryButton.disabled = dictionaryActive;
    dictionaryButton.setAttribute("aria-disabled", String(dictionaryActive));
  }
  if (mode !== "reference-dictionary") closeReferenceDictionaryFilterMenu();
  document.body.classList.toggle("ea-mode-queue", mode === "queue");
  document.body.classList.toggle("ea-mode-product", mode === "product");
  document.body.classList.toggle("ea-mode-reference-dictionary", mode === "reference-dictionary");
  Object.entries(surfaces).forEach(([surface, panelId]) => {
    const panel = $(panelId);
    if (!panel) return;
    const active = surface === mode;
    panel.hidden = !active;
    panel.inert = !active;
    if (active) panel.removeAttribute("aria-hidden");
    else panel.setAttribute("aria-hidden", "true");
  });
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

function syncPortalFieldsUi() {
  // Portal dossier fields have no verify action; autosave status only.
}

function portalFieldsEditable() {
  return canWrite() && normalizeEntryStatus(state.queueRow?.entry_status) === "NOT_STARTED";
}

function currentPreEntryReopenAvailability(kind, lineId = null) {
  let reviewStatus = null;
  if (kind === "line") {
    reviewStatus = state.lines.find((row) =>
      idsEqual(row?.source_composition_line_id, lineId),
    )?.review_status;
  } else if (kind === "details") {
    reviewStatus = state.review?.review_status;
  } else if (kind === "classification") {
    reviewStatus = state.classification?.review_status;
  } else if (kind === "actions") {
    reviewStatus = state.actionsReviewStatus;
  }
  const entryStatus = state.queueRow?.entry_status;
  return preEntryReopenAvailability({
    reviewStatus,
    canEdit: canWrite(),
    entryStatus,
  });
}

function preEntryReopenButton({ kind, lineId = null, id, label, dataAttribute = "" }) {
  const availability = currentPreEntryReopenAvailability(kind, lineId);
  if (!availability.visible) return "";
  const disabled = availability.enabled
    ? ""
    : ` disabled aria-disabled="true" data-force-disabled="true" title="${escapeHtml(availability.reason)}"`;
  return `<button type="button" class="icon-btn with-label ea-reopen-btn" id="${escapeHtml(id)}" data-edit-action="true"${dataAttribute}${disabled}>${escapeHtml(label)}</button>`;
}

function currentPostEntryIngredientFormReconcile(lineId) {
  const id = String(lineId || "");
  const line = state.lines.find((row) => idsEqual(row?.source_composition_line_id, id));
  const draft = state.lineDrafts.get(id) || (line ? lineDraftFromRow(line) : null);
  const queueRow = state.queueRow;
  const availability = postEntryIngredientFormReconcileAvailability({
    productId: state.selectedProductId,
    reviewStatus: line?.review_status,
    canEdit: canWrite(),
    entryStatus: queueRow?.entry_status,
    lineRowVersion: draft?.rowVersion,
    workflowRowVersion: queueRow?.workflow_row_version,
  });
  return {
    line,
    draft,
    availability,
    options: eligibleIngredientFormReconcileOptions(
      state.catalogs.portalOptions.INGREDIENT_FORM,
    ),
  };
}

function postEntryIngredientFormReconcileButton(lineId) {
  const authority = currentPostEntryIngredientFormReconcile(lineId);
  if (!authority.availability.visible) return "";
  return `<button type="button" class="icon-btn with-label" data-edit-action="true" id="btn-reconcile-${escapeHtml(lineId)}" data-line-reconcile="${escapeHtml(lineId)}">Reconcile mapping</button>`;
}

const CANONICAL_DISEASES_LOCK_STATUSES = Object.freeze([
  "IN_PROGRESS",
  "ENTERED",
  "PORTAL_VERIFIED",
  "SUBMITTED",
]);

function canonicalDiseasesLocked() {
  return CANONICAL_DISEASES_LOCK_STATUSES.includes(
    normalizeEntryStatus(state.queueRow?.entry_status),
  );
}

function portalTextReasonRequired() {
  return normalizeEntryStatus(state.queueRow?.entry_status) === "IN_PROGRESS";
}

function newPortalTextDraft(row) {
  const fresh = portalTextDraftFromRow(row);
  return {
    ...fresh,
    editableText: portalTextEditableValue(fresh),
    reason:
      safeText(fresh.portalReviewNotes) ||
      (portalTextReasonRequired() ? DEFAULT_IN_PROGRESS_PORTAL_REASON : ""),
  };
}

function portalTextDirty(draft, row) {
  if (!draft) return false;
  const baseline = newPortalTextDraft(row);
  return (
    safeText(draft.editableText) !== safeText(baseline.editableText) ||
    safeText(draft.reason) !== safeText(baseline.reason)
  );
}

function portalTextBlockingReason() {
  const draft = state.portalTextDraft;
  if (!draft) return "Portal text is unavailable for this product.";
  if (draft.rowVersion == null) {
    return "Portal text row version is unavailable. Refresh the product before saving.";
  }
  const text = safeText(draft.editableText);
  if (!text) return "Portal text is required.";
  if (!portalDiseasesCharsetOk(text)) {
    return "Portal text contains characters the portal rejects. Allowed: A-Z a-z 0-9 space , ; : / @ . ' -";
  }
  if (portalTextReasonRequired() && !safeText(draft.reason)) {
    return "A reason is required while portal entry is IN_PROGRESS.";
  }
  return "";
}

function syncPortalTextUi() {
  const hint = portalTextBlockingReason();
  const ok = !hint && canWrite();
  ["btnVerifyPortalDiseases", "btnSavePortalDiseases"].forEach((id) => {
    const btn = $(id);
    if (!btn) return;
    btn.disabled = !ok || state.busy;
    btn.dataset.forceDisabled = ok ? "false" : "true";
    if (hint) btn.title = hint;
    else btn.removeAttribute("title");
  });
  setHintEl("portalDiseasesHint", hint);
}

function stageRow(stage, itemKey = null) {
  const key = itemKey == null || itemKey === "" ? "" : String(itemKey);
  return (state.stageReview || []).find((row) => row?.stage === stage && String(row.item_key || "") === key) || null;
}

function stageGate(stage, itemKey = null) {
  if (state.stageReviewFailed === true || state.stageReviewLoaded !== true) return null;
  return stageApprovalBlock(stageRow(stage, itemKey), { failed: false, loaded: true });
}

function combineApproval(fieldOk, fieldReason, stage, itemKey = null) {
  if (fieldOk !== true) return { ok: false, reason: fieldReason || "", code: "" };
  const gate = stageGate(stage, itemKey);
  if (gate) return { ok: false, reason: gate.userMessage, code: gate.code };
  return { ok: true, reason: "", code: "" };
}

function stageSaverHtml(stage, itemKey = null) {
  const id = itemKey == null || itemKey === "" ? `stageSaver-${stage}` : `stageSaver-${stage}-${itemKey}`;
  const text = state.stageReviewLoaded === true && state.stageReviewFailed !== true
    ? stageSaverCopy(stageRow(stage, itemKey), qcIstStamp)
    : "";
  return `<p class="muted-note" id="${escapeHtml(id)}"${text ? "" : " hidden"}>${escapeHtml(text)}</p>`;
}

function approvalNoticeHtml(stage, itemKey = "") {
  const notice = state.approvalNotice;
  if (!notice || notice.stage !== stage || String(notice.itemKey || "") !== String(itemKey || "")) return "";
  const tech = notice.technical
    ? `<details class="worklist-tech"><summary>Technical details</summary><div class="ea-change-item"><dl>
        <div class="ea-change-pair"><dt>Code</dt><dd>${escapeHtml(notice.technical.code || "Not recorded")}</dd></div>
        <div class="ea-change-pair"><dt>Call</dt><dd>${escapeHtml(notice.technical.rpc || "Not recorded")}</dd></div>
        <div class="ea-change-pair"><dt>Hint</dt><dd>${escapeHtml(notice.technical.hint || "Not recorded")}</dd></div>
      </dl></div></details>`
    : "";
  if (!notice.unknown) return tech;
  return `<p class="disabled-reason">${escapeHtml(`${notice.text} ${notice.next}`)}</p>${tech}`;
}

function rememberApprovalRefusal(err) {
  const pending = state.pendingApproval;
  if (!pending) return;
  const notice = approvalNoticeFromError(err);
  state.approvalNotice = {
    stage: pending.stage,
    itemKey: pending.itemKey || "",
    ...notice,
    technical: state.myRoles?.is_approver === true ? {
      code: notice.code || safeText(err?.original?.code || err?.code),
      rpc: safeText(err?.rpcName),
      hint: safeText(err?.original?.hint || err?.hint),
    } : null,
  };
}

async function loadStageReview(productId) {
  try {
    const rows = await fetchStageReviewState(productId);
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch (err) {
    console.error("[eaushadhi] stage review state failed", err);
    return { rows: [], failed: true };
  }
}

function applyStageReviewResult(result) {
  state.stageReview = result?.rows || [];
  state.stageReviewFailed = result?.failed === true;
  state.stageReviewLoaded = result?.failed !== true;
}

function paintStageSaver(stage, itemKey = null) {
  const id = itemKey == null || itemKey === "" ? `stageSaver-${stage}` : `stageSaver-${stage}-${itemKey}`;
  const el = document.getElementById(id);
  if (!el) return;
  const text = state.stageReviewLoaded === true && state.stageReviewFailed !== true
    ? stageSaverCopy(stageRow(stage, itemKey), qcIstStamp)
    : "";
  el.hidden = !text;
  el.textContent = text;
}

function applyStageReviewChrome() {
  paintStageSaver("details");
  paintStageSaver("classification");
  paintStageSaver("actions");
  for (const row of state.lines || []) {
    const lineId = row?.source_composition_line_id;
    paintStageSaver("line", lineId);
    syncLineVerifyUi(lineId);
  }
  const preparationId = state.qcPrepServer?.preparation_id;
  if (preparationId) paintStageSaver("qc", preparationId);
  syncDetailsVerifyUi();
  syncClassificationVerifyUi();
  syncActionsVerifyUi();
  if (isProductMode()) applyWorkspaceChrome();
}

async function refreshStageReview({ render = false } = {}) {
  const productId = state.selectedProductId;
  if (!productId) return;
  const result = await loadStageReview(productId);
  if (!idsEqual(state.selectedProductId, productId)) return;
  applyStageReviewResult(result);
  if (render && isProductMode()) renderActiveTab();
  else applyStageReviewChrome();
}

function applyApprovalButton(btn, decision, hintId) {
  if (!btn) return;
  const blocked = decision.ok !== true;
  btn.disabled = blocked || !canWrite() || state.busy;
  btn.dataset.forceDisabled = blocked ? "true" : "false";
  if (decision.code) btn.dataset.blockCode = decision.code;
  else delete btn.dataset.blockCode;
  if (decision.reason) btn.title = decision.reason;
  else btn.removeAttribute("title");
  setHintEl(hintId, decision.reason);
}

function syncDetailsVerifyUi() {
  const btn = $("btnVerifyDetails");
  if (!btn) return;
  const fieldOk = canVerifyProductDetails(state.detailsDraft, {
    canEdit: canWrite(),
    saveStatus: state.detailsSaveStatus,
  });
  const fieldReason = productDetailsVerifyPendingCopy(state.detailsDraft, {
    saveStatus: state.detailsSaveStatus,
  });
  applyApprovalButton(btn, combineApproval(fieldOk, fieldReason, "details"), "detailsVerifyHint");
}

function syncActionsVerifyUi() {
  const btn = $("btnVerifyActions");
  if (!btn) return;
  const fieldOk = canVerifyActionSet({
    actions: state.actionsDraft,
    reviewStatus: state.actionsReviewStatus,
    saveStatus: state.actionsSaveStatus,
    canEdit: canWrite(),
  });
  const fieldReason = actionSetVerifyPendingCopy({
    actions: state.actionsDraft,
    reviewStatus: state.actionsReviewStatus,
    saveStatus: state.actionsSaveStatus,
  });
  applyApprovalButton(btn, combineApproval(fieldOk, fieldReason, "actions"), "actionsVerifyHint");
}

function syncClassificationVerifyUi() {
  const btn = $("btnVerifyClassification");
  if (!btn) return;
  const fieldOk = canVerifyClassification(state.classificationDraft, {
    canEdit: canWrite(),
    saveStatus: state.classificationSaveStatus,
    reviewStatus: state.classification?.review_status,
    categoryOptions: state.classificationOptions.PRODUCT_CATEGORY,
    subtypeOptions: state.classificationOptions.PRODUCT_SUBTYPE,
  });
  const fieldReason = classificationVerifyPendingCopy(state.classificationDraft, {
    saveStatus: state.classificationSaveStatus,
    reviewStatus: state.classification?.review_status,
    categoryOptions: state.classificationOptions.PRODUCT_CATEGORY,
    subtypeOptions: state.classificationOptions.PRODUCT_SUBTYPE,
  });
  applyApprovalButton(btn, combineApproval(fieldOk, fieldReason, "classification"), "classificationVerifyHint");
}

function syncLineSaveReviewUi(lineId) {
  const id = String(lineId);
  const btn = document.querySelector(`[data-line-save="${id}"]`);
  if (!btn) return;
  const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, id));
  const ui = lineSaveForReviewUi({
    reviewStatus: row?.review_status,
    draft: state.lineDrafts.get(id),
    baseline: state.lineBaselines.get(id),
    stageRow: stageRow("line", id),
    canWrite: canWrite(),
    busy: state.busy,
  });
  if (!ui.visible) {
    btn.hidden = true;
    btn.disabled = true;
    btn.dataset.forceDisabled = "true";
    return;
  }
  btn.hidden = false;
  btn.textContent = ui.label;
  btn.disabled = !ui.enabled;
  btn.dataset.forceDisabled = ui.enabled ? "false" : "true";
  if (ui.title) btn.title = ui.title;
  else btn.removeAttribute("title");
}

function syncLineVerifyUi(lineId) {
  const id = String(lineId);
  syncLineSaveReviewUi(id);
  const btn = document.querySelector(`[data-line-verify="${id}"]`);
  if (!btn) return;
  const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, id));
  const draft = state.lineDrafts.get(id);
  const saveStatus = state.lineSaveStatus.get(id) || "";
  const fieldOk = canVerifyCompositionLine({
    draft,
    issues: state.issues,
    lineId: id,
    reviewStatus: row?.review_status,
    saveStatus,
    canEdit: canWrite(),
  });
  const fieldReason = lineVerifyPendingCopy({
    draft,
    issues: state.issues,
    lineId: id,
    reviewStatus: row?.review_status,
    saveStatus,
  });
  const decision = combineApproval(fieldOk, fieldReason, "line", id);
  btn.disabled = decision.ok !== true || !canWrite() || state.busy;
  btn.dataset.forceDisabled = decision.ok ? "false" : "true";
  if (decision.code) btn.dataset.blockCode = decision.code;
  else delete btn.dataset.blockCode;
  if (decision.reason) btn.title = decision.reason;
  else btn.removeAttribute("title");
}

function toastError(err) {
  showToast(userMessageForError(err) || "Something went wrong.", "error", 5200);
}

function workspaceIsDirty() {
  if (!state.selectedProductId) return false;
  if (detailsDirty(state.detailsDraft, state.detailsBaseline)) return true;
  if (portalFieldsDirty(state.portalFieldsDraft, state.portalFieldsBaseline)) return true;
  if (classificationDirty(state.classificationDraft, state.classificationBaseline)) return true;
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

function autosaveForReview(id) {
  if (id === "detailsAutosave") return normalizeReviewStatus(state.review?.review_status) === "IN_REVIEW";
  if (id === "classificationAutosave") return normalizeReviewStatus(state.classification?.review_status) === "IN_REVIEW";
  if (id === "actionsAutosave") return normalizeReviewStatus(state.actionsReviewStatus) === "IN_REVIEW";
  if (String(id).startsWith("line-save-")) {
    const lineId = String(id).slice("line-save-".length);
    const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
    return normalizeReviewStatus(row?.review_status) === "IN_REVIEW";
  }
  return false;
}

function autosaveHtml(status, id) {
  const label = autosaveStateLabel(status, { forReview: autosaveForReview(id) });
  if (!label) return `<span class="ea-autosave" ${id ? `id="${escapeHtml(id)}"` : ""} hidden></span>`;
  const live = status === "failed" || status === "stale" ? ' aria-live="polite"' : "";
  const cls =
    status === "failed" || status === "stale" ? "ea-autosave is-failed" : "ea-autosave";
  return `<span class="${cls}" ${id ? `id="${escapeHtml(id)}"` : ""} ${live}>${escapeHtml(label)}</span>`;
}

function patchAutosaveEl(id, status) {
  const el = $(id);
  if (!el) return;
  const label = autosaveStateLabel(status, { forReview: autosaveForReview(id) });
  el.hidden = !label;
  el.textContent = label;
  el.classList.toggle("is-failed", status === "failed" || status === "stale");
  if (status === "failed" || status === "stale") el.setAttribute("aria-live", "polite");
  else el.removeAttribute("aria-live");
  if (id === "detailsAutosave") syncDetailsVerifyUi();
  if (id === "portalFieldsAutosave") syncPortalFieldsUi();
  if (id === "portalTextAutosave") syncPortalTextUi();
  if (id === "actionsAutosave") syncActionsVerifyUi();
  if (id === "classificationAutosave") syncClassificationVerifyUi();
  if (String(id).startsWith("line-save-")) syncLineVerifyUi(String(id).slice("line-save-".length));
}

async function confirmLeaveDirty(returnFocus = "backToQueueBtn") {
  if (!workspaceIsDirty()) return true;
  return openQcConfirm({
    title: "Unsaved review edits",
    message: "You have unsaved review edits. Discard them?",
    okLabel: "Leave without saving",
    cancelLabel: "Stay",
    returnFocus,
    idPrefix: "leaveDirtyConfirm",
  });
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
    const label = safeText(opt?.label);
    if (!label) continue;
    const selected = idsEqual(id, selectedId) ? " selected" : "";
    parts.push(
      `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`,
    );
  }
  if (selectedId && !seen.has(String(selectedId))) {
    const display = classificationSelectedOptionDisplay(list, selectedId);
    parts.push(
      `<option value="${escapeHtml(selectedId)}" selected>${escapeHtml(
        display.label || "Selected option is not in the current list. Re-open the product or contact the administrator.",
      )}</option>`,
    );
  }
  return parts.join("");
}

function classificationOptionHtml(options, selectedId, { emptyLabel = "Select..." } = {}) {
  const seen = new Set();
  const list = selectableClassificationOptions(options);
  const parts = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
  for (const opt of list) {
    const id = optionId(opt?.portal_option_id ?? opt?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = safeText(opt?.label);
    if (!label) continue;
    const selected = idsEqual(id, selectedId) ? " selected" : "";
    parts.push(
      `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`,
    );
  }
  if (selectedId && !seen.has(String(selectedId))) {
    const display = classificationSelectedOptionDisplay(options, selectedId);
    parts.push(
      `<option value="${escapeHtml(selectedId)}" selected>${escapeHtml(display.label)}</option>`,
    );
  }
  return parts.join("");
}

function classificationSubtypeOptionHtml(draft, { optionsUnloaded = false } = {}) {
  const mode = resolveClassificationSubtypeMode({
    ...(draft || {}),
    preserveBlank: false,
  });
  const selected =
    mode === "OPTION" ? optionId(draft?.productSubtypeOptionId) : null;
  // BLANK and UNRESOLVED both render as correctable "Not yet resolved" plus
  // fill-eligible options only (no Blank / "-" choices).
  return classificationOptionHtml(state.classificationOptions.PRODUCT_SUBTYPE, selected, {
    emptyLabel: optionsUnloaded ? CLASSIFICATION_OPTIONS_UNLOADED_COPY : "Not yet resolved",
  });
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

function workflowStagesWithQc() {
  const stages = [];
  for (const stage of WORKFLOW_STAGES) {
    if (stage.id === "evidence") stages.push({ id: "qc", label: "QC Register" });
    stages.push(stage);
  }
  return stages.map((stage, index) => ({ ...stage, step: index + 1 }));
}

function renderWorkflowNav() {
  const host = $("workspaceTabs");
  if (!host) return;
  const ctx = stageCtx();
  host.innerHTML = workflowStagesWithQc().map((stage) => {
    const selected = state.tab === stage.id;
    const complete = stage.id === "qc" ? false : workflowStageComplete(stage.id, ctx);
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

function portalShelfmonthOptionsHtml(selectedValue) {
  const selected = safeText(selectedValue);
  const options = [
    `<option value="">Select route...</option>`,
    ...PORTAL_SHELFMONTH_ROUTE_OPTIONS.map(
      (item) =>
        `<option value="${escapeHtml(item.value)}"${
          selected === item.value ? " selected" : ""
        }>${escapeHtml(item.label)}</option>`,
    ),
  ];
  return options.join("");
}

function renderDetails() {
  const host = $("tab-details");
  const draft = state.detailsDraft || detailsDraftFromReview(state.review);
  const portalDraft = state.portalFieldsDraft || portalFieldsDraftFromRow(state.dossierPortalFields);
  const portalTextDraft = state.portalTextDraft || newPortalTextDraft(state.portalTextRow);
  const review = state.review || {};
  const locked = isVerifiedStatus(review.review_status);
  const portalEditable = portalFieldsEditable();
  const portalDisable = portalEditable ? "" : " disabled";
  const canonicalLocked = canonicalDiseasesLocked();
  const portalTextStatus = portalTextDraft.portalReviewStatus || "PENDING";
  const portalTextChipClass =
    portalTextStatus === "REVIEW_REQUIRED" ? "warning" : reviewStatusChipClass(portalTextStatus);
  const portalTextHint = portalTextBlockingReason();
  const portalReasonRequired = portalTextReasonRequired();
  const portalTextAvailable = state.portalTextRow != null;
  const suggested = review.suggested_permission_purpose_label
    ? `Suggested: ${review.suggested_permission_purpose_label}`
    : "";
  const disable = locked
    ? ' disabled aria-disabled="true" data-force-disabled="true"'
    : "";
  const detailsVerifyOk = canVerifyProductDetails(draft, {
    canEdit: canWrite(),
    saveStatus: state.detailsSaveStatus,
  });
  const detailsVerifyHint = productDetailsVerifyPendingCopy(draft, {
    saveStatus: state.detailsSaveStatus,
  });
  const detailsDecision = combineApproval(detailsVerifyOk, detailsVerifyHint, "details");
  const classDraft =
    state.classificationDraft || classificationDraftFromReview(state.classification);
  const classLocked = isVerifiedStatus(
    state.classification?.review_status ?? classDraft.reviewStatus,
  );
  const classDisable = classLocked
    ? ' disabled aria-disabled="true" data-force-disabled="true"'
    : "";
  const typeSelected = optionId(classDraft.productTypeOptionId);
  const childDisable = classDisable || (!typeSelected ? " disabled" : "");
  const classSuggestions = classificationSuggestionCopy(state.classification);
  const categoryUnloaded = classificationScopedOptionsUnloaded(
    state.classificationOptions.PRODUCT_CATEGORY,
    { productTypeSelected: Boolean(typeSelected) },
  );
  const subtypeUnloaded = classificationScopedOptionsUnloaded(
    state.classificationOptions.PRODUCT_SUBTYPE,
    { productTypeSelected: Boolean(typeSelected) },
  );
  const classVerifyOk = canVerifyClassification(classDraft, {
    canEdit: canWrite(),
    saveStatus: state.classificationSaveStatus,
    reviewStatus: state.classification?.review_status,
    categoryOptions: state.classificationOptions.PRODUCT_CATEGORY,
    subtypeOptions: state.classificationOptions.PRODUCT_SUBTYPE,
  });
  const classVerifyHint = classificationVerifyPendingCopy(classDraft, {
    saveStatus: state.classificationSaveStatus,
    reviewStatus: state.classification?.review_status,
    categoryOptions: state.classificationOptions.PRODUCT_CATEGORY,
    subtypeOptions: state.classificationOptions.PRODUCT_SUBTYPE,
  });
  const classDecision = combineApproval(classVerifyOk, classVerifyHint, "classification");
  const classStatus = normalizeReviewStatus(
    state.classification?.review_status ?? classDraft.reviewStatus,
  ) || "PENDING";
  host.innerHTML = `
    <div class="section-card${classLocked ? " is-verified" : ""}" id="portalClassificationCard">
      <div class="section-title-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h3 class="section-title" style="margin:0">Portal Classification</h3>
        ${chip(reviewStatusChipClass(classStatus), displayText(classStatus, "PENDING"))}
      </div>
      ${classLocked ? lockNoteHtml() : ""}
      <div class="form-field">
        <label for="fldClassProductType">Product Type</label>
        <select id="fldClassProductType" class="sasv-control" data-edit-action="true" data-classification-field="type"${classDisable}>
          ${classificationOptionHtml(state.classificationOptions.PRODUCT_TYPE, classDraft.productTypeOptionId)}
        </select>
        <span class="muted-note">Suggested Product Type: ${escapeHtml(classSuggestions.productType)}</span>
      </div>
      <div class="form-field">
        <label for="fldClassCategory">Category / Dosage Form</label>
        <select id="fldClassCategory" class="sasv-control" data-edit-action="true" data-classification-field="category"${childDisable}>
          ${classificationOptionHtml(state.classificationOptions.PRODUCT_CATEGORY, classDraft.productCategoryOptionId, {
            emptyLabel: categoryUnloaded ? CLASSIFICATION_OPTIONS_UNLOADED_COPY : "Select...",
          })}
        </select>
        <span class="muted-note">Suggested Category: ${escapeHtml(classSuggestions.productCategory)}</span>
        ${
          categoryUnloaded
            ? `<span class="muted-note" id="classCategoryUnloadedNote">${escapeHtml(CLASSIFICATION_OPTIONS_UNLOADED_COPY)}</span>`
            : ""
        }
      </div>
      <div class="form-field">
        <label for="fldClassSubtype">Portal Sub Type</label>
        <select id="fldClassSubtype" class="sasv-control" data-edit-action="true" data-classification-field="subtype"${childDisable}>
          ${classificationSubtypeOptionHtml(classDraft, { optionsUnloaded: subtypeUnloaded })}
        </select>
        <span class="muted-note">Portal Sub Type: ${escapeHtml(classSuggestions.productSubtype)}</span>
        <span class="muted-note">${escapeHtml(CLASSIFICATION_SUBTYPE_INDEPENDENCE_NOTE)}</span>
        ${
          subtypeUnloaded
            ? `<span class="muted-note" id="classSubtypeUnloadedNote">${escapeHtml(CLASSIFICATION_OPTIONS_UNLOADED_COPY)}</span>`
            : ""
        }
      </div>
      <div class="form-field">
        <label for="fldClassNotes">Review Notes</label>
        <textarea id="fldClassNotes" class="sasv-control" rows="2" data-edit-action="true" data-classification-field="notes"${classDisable}>${escapeHtml(classDraft.reviewNotes || "")}</textarea>
      </div>
      ${autosaveHtml(state.classificationSaveStatus, "classificationAutosave")}
      ${stageSaverHtml("classification")}
      <div class="action-row">
        ${
          classLocked
            ? `${chip("success", "Verified")}
        ${
          preEntryReopenButton({
            kind: "classification",
            id: "btnReopenClassification",
            label: "Reopen Portal Classification",
          })
        }`
            : `<button type="button" class="icon-btn with-label primary" id="btnVerifyClassification" data-edit-action="true"${
                classDecision.ok ? "" : " data-force-disabled=\"true\""
              }${classDecision.code ? ` data-block-code="${escapeHtml(classDecision.code)}"` : ""}${
                classDecision.reason ? ` title="${escapeHtml(classDecision.reason)}"` : ""
              }>Approve</button>`
        }
      </div>
      ${approvalNoticeHtml("classification")}
      ${
        classLocked
          ? ""
          : `<p class="disabled-reason" id="classificationVerifyHint"${classDecision.reason ? "" : " hidden"}>${escapeHtml(classDecision.reason)}</p>`
      }
    </div>
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
        <textarea id="fldDiseases" class="sasv-control" rows="3" data-edit-action="true"${disable}${
          canonicalLocked ? " readonly" : ""
        }>${escapeHtml(draft.diseasesConditions || "")}</textarea>
        ${
          canonicalLocked
            ? `<span class="muted-note">Canonical text is locked after portal entry began (${escapeHtml(normalizeEntryStatus(state.queueRow?.entry_status))}). Correct the portal projection below instead.</span>`
            : ""
        }
      </div>
    </div>
    <div class="section-card" id="portalDiseasesCard">
      <div class="section-title-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h3 class="section-title" style="margin:0">e-Aushadhi Portal Text</h3>
        ${chip(portalTextChipClass, displayText(portalTextStatus, "PENDING"))}
      </div>
      <p class="muted-note">Portal-safe projection of Diseases / Conditions. The canonical text above is preserved; only this projection is typed into the Government portal.</p>
      ${
        portalTextAvailable
          ? `
      <div class="form-field">
        <label for="fldPortalDiseases">Portal Diseases / Conditions</label>
        <textarea id="fldPortalDiseases" class="sasv-control" rows="3" data-edit-action="true" placeholder="Portal-safe text">${escapeHtml(portalTextDraft.editableText || "")}</textarea>
        <span class="muted-note">Canonical: ${escapeHtml(displayText(portalTextDraft.canonicalText || draft.diseasesConditions))}</span>
        ${
          safeText(portalTextDraft.suggestedPortalText)
            ? `<span class="muted-note">Suggested: ${escapeHtml(portalTextDraft.suggestedPortalText)}</span>`
            : ""
        }
        <span class="muted-note">Generation version: ${escapeHtml(displayText(portalTextDraft.generationVersion))}</span>
      </div>
      <div class="form-field">
        <label for="fldPortalDiseasesReason">Reason${portalReasonRequired ? " (required)" : ""}</label>
        <textarea id="fldPortalDiseasesReason" class="sasv-control" rows="2" data-edit-action="true">${escapeHtml(portalTextDraft.reason || "")}</textarea>
      </div>
      ${autosaveHtml(state.portalTextSaveStatus, "portalTextAutosave")}
      <div class="action-row">
        <button type="button" class="icon-btn with-label primary" id="btnVerifyPortalDiseases" data-edit-action="true"${
          portalTextHint ? ` data-force-disabled="true" title="${escapeHtml(portalTextHint)}"` : ""
        }>Accept &amp; Verify Portal Text</button>
        <button type="button" class="icon-btn with-label" id="btnSavePortalDiseases" data-edit-action="true"${
          portalTextHint ? ` data-force-disabled="true" title="${escapeHtml(portalTextHint)}"` : ""
        }>Save for Review</button>
      </div>
      <p class="disabled-reason" id="portalDiseasesHint"${portalTextHint ? "" : " hidden"}>${escapeHtml(portalTextHint)}</p>`
          : `<p class="muted-note">Portal projection is not available for this product yet.</p>`
      }
    </div>
    <div class="section-card">
      <h3 class="section-title">Portal entry fields</h3>
      <p class="muted-note">Governed portal remarks and shelf-life route for Product Details execution. Saved to the product dossier; worker reads these via content_get.</p>
      ${
        portalEditable
          ? ""
          : `<p class="muted-note">Portal dossier fields lock once entry has begun (${escapeHtml(normalizeEntryStatus(state.queueRow?.entry_status))}).</p>`
      }
      <div class="form-field">
        <label for="fldPortalRemarks">Portal Remarks</label>
        <textarea id="fldPortalRemarks" class="sasv-control" rows="2" data-edit-action="true" placeholder="Required before portal entry"${portalDisable}>${escapeHtml(portalDraft.remarks || "")}</textarea>
        ${
          safeText(portalDraft.remarks)
            ? ""
            : `<span class="muted-note">Unresolved: portal remarks are required.</span>`
        }
      </div>
      <div class="form-field">
        <label for="fldPortalShelfmonthRoute">Shelf-life Route</label>
        <select id="fldPortalShelfmonthRoute" class="sasv-control" data-edit-action="true"${portalDisable}>
          ${portalShelfmonthOptionsHtml(portalDraft.portalShelfmonthRoute)}
        </select>
        ${
          safeText(portalDraft.portalShelfmonthRoute)
            ? ""
            : `<span class="muted-note">Unresolved: choose the exact portal shelf-life route.</span>`
        }
      </div>
      ${autosaveHtml(state.portalFieldsSaveStatus, "portalFieldsAutosave")}
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
      ${stageSaverHtml("details")}
      <div class="action-row">
        ${
          locked
            ? `${chip("success", "Verified")}
        ${
          preEntryReopenButton({
            kind: "details",
            id: "btnReopenDetails",
            label: "Reopen Product Details",
          })
        }`
            : `<button type="button" class="icon-btn with-label primary" id="btnVerifyDetails" data-edit-action="true"${
                detailsDecision.ok ? "" : " data-force-disabled=\"true\""
              }${detailsDecision.code ? ` data-block-code="${escapeHtml(detailsDecision.code)}"` : ""}${
                detailsDecision.reason ? ` title="${escapeHtml(detailsDecision.reason)}"` : ""
              }>Approve</button>`
        }
      </div>
      ${approvalNoticeHtml("details")}
      ${
        locked
          ? ""
          : `<p class="disabled-reason" id="detailsVerifyHint"${detailsDecision.reason ? "" : " hidden"}>${escapeHtml(detailsDecision.reason)}</p>`
      }
    </div>`;
  if (locked) {
    host.querySelectorAll("[data-bool-value]").forEach((el) => {
      el.disabled = true;
      el.dataset.forceDisabled = "true";
    });
  }
  syncPortalTextUi();
  applyPermissionUi();
}

function renderComposition() {
  const host = $("tab-composition");
  const filtered = filterCompositionLines(state.lines, state.issues, state.compositionView);
  const executionPanel = compositionPortalExecutionHtml();
  const count = $("compositionRowCount");
  if (count) count.textContent = formatShowingCount(filtered.length, state.lines.length);
  if (!state.lines.length) {
    host.innerHTML = `${executionPanel}<div class="section-card empty-state">No composition lines returned for this product.</div>`;
    return;
  }
  if (!filtered.length) {
    host.innerHTML = `${executionPanel}<div class="section-card empty-state">
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
  host.innerHTML = executionPanel + filtered
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
      const lockedControlAttrs = locked
        ? ' disabled aria-disabled="true" data-force-disabled="true"'
        : "";
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
            <select id="${escapeHtml(fieldId)}" class="sasv-control" data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="${escapeHtml(spec.draftKey)}"${lockedControlAttrs}>
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
      const lineDecision = combineApproval(lineVerifyOk, lineVerifyHint, "line", id);
      const saveReviewUi = lineSaveForReviewUi({
        reviewStatus: row.review_status,
        draft,
        baseline: state.lineBaselines.get(String(id)),
        stageRow: stageRow("line", id),
        canWrite: canWrite(),
        busy: state.busy,
      });
      const resolved = state.resolvedSourceByLine.get(String(id));
      const reference = row.referenceMapping || null;
      const referenceBlock = `<section class="reference-mapping-block${reference ? "" : " is-blocked"}"${reference ? ` data-reference-mapping-id="${escapeHtml(reference.mapping_id)}"` : ""}>
        <div><span class="muted-note">Source Reference</span><strong>${escapeHtml(row.raw_reference_text || reference?.source_reference_examples?.[0] || "-")}</strong></div>
        <div><span class="muted-note">Canonical Reference Work</span><strong>${escapeHtml(reference?.canonical_label || "Not mapped")}</strong></div>
        <div><span class="muted-note">e-Aushadhi Projection</span><strong>${escapeHtml(reference?.portal_label && reference?.portal_external_id ? `${reference.portal_label} / ${reference.portal_external_id}` : "Not mapped")}</strong></div>
        <div><span class="muted-note">Reference Governance</span>${chip(reference?.reference_ready === true ? "success" : "warning", referenceGovernanceLabel(reference))}</div>
      </section>`;
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
        ${referenceBlock}
        <div class="line-notes-row">
          <label class="visually-hidden" for="${escapeHtml(notesId)}">Notes</label>
          <textarea id="${escapeHtml(notesId)}" class="sasv-control" rows="2" data-edit-action="true" data-line-id="${escapeHtml(id)}" data-draft-key="reviewNotes" placeholder="Notes" aria-label="Notes"${lockedControlAttrs}>${escapeHtml(normalizeReviewNotesForDisplay(draft.reviewNotes || ""))}</textarea>
          ${autosaveHtml(saveStatus, `line-save-${id}`)}
          ${stageSaverHtml("line", id)}
          ${
            locked
              ? `${chip("success", "Verified")} ${lockNoteHtml()}
          ${
            preEntryReopenButton({
              kind: "line",
              lineId: id,
              id: `btn-reopen-${id}`,
              label: "Reopen for correction",
              dataAttribute: ` data-line-reopen="${escapeHtml(id)}"`,
            })
          }
          ${postEntryIngredientFormReconcileButton(id)}`
              : `${
                  saveReviewUi.visible
                    ? `<button type="button" class="icon-btn with-label" data-edit-action="true" data-line-save="${escapeHtml(id)}"${
                        saveReviewUi.enabled ? "" : " data-force-disabled=\"true\""
                      }${saveReviewUi.title ? ` title="${escapeHtml(saveReviewUi.title)}"` : ""}>${escapeHtml(saveReviewUi.label)}</button>`
                    : ""
                }
          <button type="button" class="icon-btn with-label primary" data-edit-action="true" data-line-verify="${escapeHtml(id)}"${
                  lineDecision.ok ? "" : " data-force-disabled=\"true\""
                }${lineDecision.code ? ` data-block-code="${escapeHtml(lineDecision.code)}"` : ""}${
                  lineDecision.reason ? ` title="${escapeHtml(lineDecision.reason)}"` : ""
                }>Approve</button>
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

function compositionPortalExecutionHtml() {
  if (!isFirstControlledEntryProduct(state.selectedProductId)) return "";
  const preview = state.workerCompositionPreview;
  const missing = Array.isArray(preview?.missingSourceLineIds) ? preview.missingSourceLineIds : [];
  const matches = Array.isArray(preview?.matchedSourceLineIds) ? preview.matchedSourceLineIds : [];
  const blockers = Array.isArray(preview?.blockers) ? preview.blockers : [];
  const active = preview?.activeRun;
  const eligible = new Set(Array.isArray(preview?.executionEligibleSourceLineIds) ? preview.executionEligibleSourceLineIds.map(Number) : []);
  const blockerText = blockers.map((item) => typeof item === "string" ? item : item?.code || item?.reason || (item?.sourceCompositionLineId ? `Line ${item.sourceCompositionLineId}` : "Blocked"));
  return `<section class="section-card composition-portal-execution" aria-labelledby="compositionPortalExecutionTitle">
    <h3 id="compositionPortalExecutionTitle">Composition portal execution</h3>
    <p class="muted-note">Read-only portal comparison. Governed Composition editing remains separate.</p>
    <div class="action-row">
      <button type="button" class="icon-btn with-label" id="btnWorkerCompositionPreview" data-edit-action="true"${state.busy ? ' data-force-disabled="true"' : ""}>Preview portal state</button>
      ${missing.map((id) => {
        const enabled = Number(id) === 931 && eligible.has(931) && preview?.controlledPhase2Eligible === true && canWrite() && !state.busy;
        const label = Number(id) === 931 ? "Enter line 931 - Kēram" : `Enter line ${id}`;
        return `<button type="button" class="icon-btn with-label primary"${enabled ? "" : ' disabled aria-disabled="true"'} data-composition-start-line="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
      }).join("")}
      ${active ? '<button type="button" class="icon-btn with-label" disabled aria-disabled="true">Recover active run</button>' : ""}
      ${(() => {
        const stageVerifyEnabled =
          preview?.stageVerifyEnabled === true &&
          preview?.finalStageVerifyEligible === true &&
          canWrite() &&
          !state.busy;
        return `<button type="button" class="icon-btn with-label" id="btnWorkerCompositionVerifyStage" data-edit-action="true"${stageVerifyEnabled ? "" : ' disabled aria-disabled="true"'}>Verify Composition stage</button>`;
      })()}
    </div>
    <p class="muted-note"><strong>${preview?.liveArmed === true ? "Composition live execution is armed for the trusted Phase-2 target." : "Composition live execution is not armed."}</strong></p>
    <p class="muted-note">${preview ? escapeHtml([
      `Status ${preview.code || "unknown"}`,
      `Stage ${preview.stage?.stage_status || "NOT_STARTED"}`,
      `Governed ${preview.governedCount ?? 0}`,
      `Portal ${preview.portalCount ?? 0}`,
      `Matches ${matches.length}`,
      `Missing ${missing.length ? missing.join(", ") : "none"}`,
      blockerText.length ? `Blockers ${blockerText.join(", ")}` : "",
      active ? `Active run ${active.runStatus || "unknown"}` : "No active run",
    ].filter(Boolean).join(". ")) : "Run Preview portal state to collect fresh trusted evidence."}</p>
  </section>`;
}

function dictionaryStatusLabel(status) {
  const value = String(status || "").toUpperCase();
  if (value === "VERIFIED") return "Verified";
  if (value === "DRAFT") return "Suggested";
  return "Mapping required";
}

function usageText(row) {
  return `${Number(row?.line_count || 0)} composition lines / ${Number(row?.product_count || 0)} products`;
}

function referenceWorkOptionHtml(selectedId) {
  const selected = String(selectedId ?? "");
  return `<option value="">Select canonical Reference Work</option>${state.referenceWorkOptions.map((option) => {
    const id = option.controlled_term_id;
    return `<option value="${escapeHtml(id)}"${String(id) === selected ? " selected" : ""}>${escapeHtml(option.label)}${option.code ? ` / ${escapeHtml(option.code)}` : ""}</option>`;
  }).join("")}`;
}

function dictionaryRows() {
  return filterReferenceDictionary(state.referenceDictionary.rows, state.referenceDictionary);
}

let referenceDictionaryFilterMenuOpen = false;

function referenceDictionaryFilterItems() {
  return [...$("referenceDictionaryFilterMenu")?.querySelectorAll('[role="menuitemradio"]') || []];
}

function closeReferenceDictionaryFilterMenu({ restoreFocus = false } = {}) {
  const menu = $("referenceDictionaryFilterMenu");
  const trigger = $("referenceDictionaryFilterBtn");
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  referenceDictionaryFilterMenuOpen = false;
  if (restoreFocus) trigger?.focus();
}

function openReferenceDictionaryFilterMenu() {
  closeWorkerMenu();
  const menu = $("referenceDictionaryFilterMenu");
  const trigger = $("referenceDictionaryFilterBtn");
  if (!menu || !trigger) return;
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  referenceDictionaryFilterMenuOpen = true;
  const items = referenceDictionaryFilterItems();
  (items.find((item) => item.getAttribute("aria-checked") === "true") || items[0])?.focus();
}

function toggleReferenceDictionaryFilterMenu() {
  if (referenceDictionaryFilterMenuOpen) closeReferenceDictionaryFilterMenu({ restoreFocus: true });
  else openReferenceDictionaryFilterMenu();
}

function selectReferenceDictionaryFilter(value) {
  if (!["all", "mapping-required", "suggested", "ready"].includes(value)) return;
  state.referenceDictionary.statusFilter = value;
  closeReferenceDictionaryFilterMenu({ restoreFocus: true });
  renderReferenceDictionary();
}

function renderReferenceDictionary() {
  const rows = dictionaryRows();
  const allRows = state.referenceDictionary.rows;
  const filterLabels = { all: "All", "mapping-required": "Mapping required", suggested: "Suggested", ready: "Ready" };
  const activeFilterLabel = filterLabels[state.referenceDictionary.statusFilter] || filterLabels.all;
  const filterButton = $("referenceDictionaryFilterBtn");
  if (filterButton) {
    const label = state.referenceDictionary.statusFilter === "all"
      ? "Filter Reference Dictionary"
      : `Filter Reference Dictionary: ${activeFilterLabel}`;
    filterButton.title = label;
    filterButton.setAttribute("aria-label", label);
    filterButton.classList.toggle("is-active", state.referenceDictionary.statusFilter !== "all");
  }
  $("referenceDictionaryFilterMenu")?.querySelectorAll("[data-reference-filter]").forEach((option) => {
    option.setAttribute("aria-checked", String(option.dataset.referenceFilter === state.referenceDictionary.statusFilter));
  });

  const status = $("referenceDictionaryStatus");
  if (status) {
    status.textContent = state.referenceDictionary.loading
      ? "Loading Reference Dictionary..."
      : state.referenceDictionary.error || `${rows.length} of ${allRows.length} source references shown.`;
    status.className = state.referenceDictionary.error ? "ea-autosave is-failed" : "muted-note";
  }

  const sourceHost = $("sourceReferenceDictionaryRows");
  if (sourceHost) sourceHost.innerHTML = rows.length ? rows.map((row) => {
    const portal = row.portal_label && row.portal_external_id ? `${row.portal_label} / ${row.portal_external_id}` : "Not mapped";
    return `<tr class="reference-dictionary-row" tabindex="0" data-reference-source="${escapeHtml(row.source_reference_text)}" aria-label="Review Reference Mapping for ${escapeHtml(row.source_reference_text)}">
      <td data-label="Source Reference"><strong>${escapeHtml(row.source_reference_text)}</strong></td>
      <td data-label="Usage">${escapeHtml(usageText(row))}</td>
      <td data-label="Canonical Reference Work">${escapeHtml(row.canonical_label || "Not mapped")}</td>
      <td data-label="Source Mapping">${chip(row.source_to_canonical_ready === true ? "success" : "warning", dictionaryStatusLabel(row.alias_mapping_status))}</td>
      <td data-label="e-Aushadhi Reference">${escapeHtml(portal)}</td>
      <td data-label="Portal Mapping">${chip(row.canonical_to_portal_ready === true ? "success" : "warning", dictionaryStatusLabel(row.portal_mapping_status))}</td>
      <td data-label="Overall" class="reference-dictionary-overall">${chip(row.reference_ready === true ? "success" : "warning", row.reference_ready === true ? "Ready" : "Mapping required")}<span class="reference-row-chevron" aria-hidden="true">›</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-state">No source references match the current filters.</td></tr>`;
  applyPermissionUi();
}

async function loadReferenceDictionary({ force = false } = {}) {
  if (state.referenceDictionary.loading || (state.referenceDictionary.loaded && !force)) return;
  state.referenceDictionary.loading = true;
  state.referenceDictionary.error = null;
  renderReferenceDictionary();
  try {
    state.referenceDictionary.rows = await fetchReferenceDictionary();
    state.referenceDictionary.loaded = true;
  } catch (error) {
    state.referenceDictionary.error = error.message || "Reference Dictionary could not be loaded.";
    throw error;
  } finally {
    state.referenceDictionary.loading = false;
    renderReferenceDictionary();
  }
}

async function openReferenceDictionary() {
  if (isProductMode()) {
    if (!(await confirmLeaveDirty("openReferenceDictionaryBtn"))) return;
    await flushAllLineAutosaves();
    await flushDetailsAutosave();
    await flushClassificationAutosave();
    await flushActionsAutosave();
    state.selectedProductId = null;
  }
  setAppMode("reference-dictionary");
  renderReferenceDictionary();
  await loadReferenceDictionary();
  $("referenceDictionarySearch")?.focus();
}

function requirePositiveReferenceSelection(root, selector, feedbackSelector, message) {
  const select = root.querySelector(selector);
  const feedback = root.querySelector(feedbackSelector);
  const selectedId = positiveReferenceSelectionId(select?.value);
  const valid = selectedId !== null;
  select?.setAttribute("aria-invalid", valid ? "false" : "true");
  if (feedback) feedback.hidden = valid;
  if (!valid) {
    select?.focus();
    throw new Error(message);
  }
  return selectedId;
}

function bindRequiredReferenceSelection(dialog, selector, feedbackSelector, buttonSelector) {
  const select = dialog.querySelector(selector);
  const confirm = dialog.querySelector(buttonSelector);
  const feedback = dialog.querySelector(feedbackSelector);
  const sync = () => {
    const selectedId = positiveReferenceSelectionId(select?.value);
    const valid = selectedId !== null;
    if (confirm) confirm.disabled = !valid || !canWrite();
    select?.setAttribute("aria-invalid", valid ? "false" : "true");
    if (feedback) feedback.hidden = valid;
  };
  select?.addEventListener("change", sync);
  sync();
}

async function ensureReferenceWorkOptions() {
  if (state.referenceWorkOptionsLoaded) return;
  state.referenceWorkOptions = await fetchReferenceWorkOptions();
  state.referenceWorkOptionsLoaded = true;
}

function portalOptionText(row) {
  return row.portal_label && row.portal_external_id ? `${row.portal_label} / ${row.portal_external_id}` : "Not selected";
}

let referenceReviewSource = null;
let referenceReviewTrigger = null;
let referenceReviewCandidates = [];
let referenceReviewSelectedCanonicalId = null;

function currentReferenceReviewRow() {
  return state.referenceDictionary.rows.find((row) => row.source_reference_text === referenceReviewSource) || null;
}

function referenceCandidateHtml() {
  return referenceReviewCandidates.slice(0, 10).map((item) =>
    `<li><strong>${escapeHtml(item.canonical_label)}</strong> / ${escapeHtml(referenceMatchLabel(item.match_basis))} / score ${escapeHtml(item.similarity_score)}</li>`,
  ).join("") || "<li>No suggested candidates.</li>";
}

function sourceReferenceSectionHtml(row) {
  const status = String(row.alias_mapping_status || "").toUpperCase();
  if (status === "VERIFIED") {
    return `<section class="reference-review-section" aria-labelledby="referenceSourceSectionTitle">
      <h3 id="referenceSourceSectionTitle" tabindex="-1">Section A - Source Reference Mapping</h3>
      <div class="reference-dialog-summary">
        <div><span class="muted-note">Source Reference</span><strong>${escapeHtml(row.source_reference_text)}</strong></div>
        <div><span class="muted-note">Canonical Reference Work</span><strong>${escapeHtml(row.canonical_label || "Not mapped")}</strong></div>
        <div><span class="muted-note">Match Basis</span><strong>${escapeHtml(referenceMatchLabel(row.alias_match_basis))}</strong></div>
        <div><span class="muted-note">Mapping Status</span>${chip("success", "Verified")}</div>
      </div>
    </section>`;
  }
  const selectedId = status === "DRAFT"
    ? row.canonical_term_id
    : referenceReviewSelectedCanonicalId || referenceReviewCandidates[0]?.canonical_term_id || null;
  const draftCopy = status === "DRAFT"
    ? `<div class="reference-dialog-summary">
        <div><span class="muted-note">Current suggestion</span><strong>${escapeHtml(row.canonical_label || "Not mapped")}</strong></div>
        <div><span class="muted-note">Match Basis</span><strong>${escapeHtml(referenceMatchLabel(row.alias_match_basis))}</strong></div>
        <div><span class="muted-note">Mapping Status</span>${chip("warning", "Suggested")}</div>
      </div>`
    : `<div><span class="muted-note">Candidate guidance (diagnostic only)</span><ul class="reference-candidates">${referenceCandidateHtml()}</ul></div>`;
  const action = status === "DRAFT" ? "Confirm & verify source mapping" : "Create source mapping draft";
  const actionAttr = status === "DRAFT" ? "data-reference-source-verify" : "data-reference-source-draft";
  return `<section class="reference-review-section" aria-labelledby="referenceSourceSectionTitle">
    <h3 id="referenceSourceSectionTitle" tabindex="-1">Section A - Source Reference Mapping</h3>
    ${draftCopy}
    <label for="referenceCanonicalOption">Canonical Reference Work</label>
    <select id="referenceCanonicalOption" class="sasv-control" required aria-describedby="referenceCanonicalRequired referenceCanonicalHelp" data-edit-action="true">${referenceWorkOptionHtml(selectedId)}</select>
    <p id="referenceCanonicalRequired" class="disabled-reason" hidden>Select a canonical Reference Work before continuing.</p>
    <p id="referenceCanonicalHelp" class="reference-mapping-helper">${status === "DRAFT" ? "Changing the suggested Reference Work will be recorded as a manual mapping." : "Creating a draft does not verify the source mapping."}</p>
    ${status === "DRAFT" ? "" : `<div class="reference-work-create"><label for="newReferenceWorkLabel">New canonical Reference Work</label><div><input id="newReferenceWorkLabel" class="sasv-control" type="text" data-edit-action="true" /><button type="button" class="icon-btn with-label" data-reference-work-create data-edit-action="true">Create canonical work</button></div><p class="reference-mapping-helper">Creates a reusable canonical work only. The source draft still requires a separate action.</p></div>`}
    <div class="reference-section-actions"><button type="button" class="icon-btn with-label primary" ${actionAttr} data-edit-action="true">${action}</button></div>
  </section>`;
}

function portalReferenceSectionHtml(row) {
  const sharedNote = `<p class="ea-callout reference-shared-note">Shared mapping: applies to every source wording resolving to this canonical Reference Work.</p>`;
  if (!positiveReferenceSelectionId(row.canonical_term_id)) {
    return `<section class="reference-review-section is-unavailable" aria-labelledby="referencePortalSectionTitle">
      <h3 id="referencePortalSectionTitle" tabindex="-1">Section B - Shared Canonical to e-Aushadhi Mapping</h3>
      ${sharedNote}<p class="muted-note">Source Reference Mapping must first establish a canonical Reference Work.</p>
    </section>`;
  }
  const status = String(row.portal_mapping_status || "").toUpperCase();
  if (status === "VERIFIED") {
    return `<section class="reference-review-section" aria-labelledby="referencePortalSectionTitle">
      <h3 id="referencePortalSectionTitle" tabindex="-1">Section B - Shared Canonical to e-Aushadhi Mapping</h3>
      ${sharedNote}<div class="reference-dialog-summary">
        <div><span class="muted-note">Canonical Reference Work</span><strong>${escapeHtml(row.canonical_label)}</strong></div>
        <div><span class="muted-note">e-Aushadhi Reference</span><strong>${escapeHtml(portalOptionText(row))}</strong></div>
        <div><span class="muted-note">Mapping Status</span>${chip("success", "Verified")}</div>
      </div>
    </section>`;
  }
  const action = status === "DRAFT" ? "Confirm & verify portal mapping" : "Create portal mapping draft";
  const actionAttr = status === "DRAFT" ? "data-reference-portal-verify" : "data-reference-portal-draft";
  return `<section class="reference-review-section" aria-labelledby="referencePortalSectionTitle">
    <h3 id="referencePortalSectionTitle" tabindex="-1">Section B - Shared Canonical to e-Aushadhi Mapping</h3>
    ${sharedNote}<div class="reference-dialog-summary">
      <div><span class="muted-note">Canonical Reference Work</span><strong>${escapeHtml(row.canonical_label)}</strong></div>
      ${status === "DRAFT" ? `<div><span class="muted-note">Current suggestion</span><strong>${escapeHtml(portalOptionText(row))}</strong></div><div><span class="muted-note">Mapping Status</span>${chip("warning", "Suggested")}</div>` : ""}
    </div>
    <label for="referencePortalOption">e-Aushadhi Reference option</label>
    <select id="referencePortalOption" class="sasv-control" required aria-describedby="referencePortalRequired referencePortalHelp" data-edit-action="true">${optionHtml(state.catalogs.portalOptions.REFERENCE, status === "DRAFT" ? row.portal_option_id : null)}</select>
    <p id="referencePortalRequired" class="disabled-reason" hidden>Select an e-Aushadhi Reference option before continuing.</p>
    <p id="referencePortalHelp" class="reference-mapping-helper">${status === "DRAFT" ? "Changing the suggested option will be recorded as a manual mapping." : "Creates a global draft mapping. Verification is a separate step."}</p>
    <div class="reference-section-actions"><button type="button" class="icon-btn with-label primary" ${actionAttr} data-edit-action="true">${action}</button></div>
  </section>`;
}

function syncReferenceReviewSelection(dialog, selectSelector, feedbackSelector, buttonSelector) {
  bindRequiredReferenceSelection(dialog, selectSelector, feedbackSelector, buttonSelector);
}

function renderReferenceReviewDialog(row, { focusSection = null } = {}) {
  const dialog = $("referenceReviewDialog");
  const body = dialog?.querySelector("[data-reference-review-body]");
  if (!dialog || !body || !row) return;
  body.innerHTML = `<div class="reference-dialog-summary reference-review-identity">
      <div><span class="muted-note">Source Reference</span><strong>${escapeHtml(row.source_reference_text)}</strong></div>
      <div><span class="muted-note">Usage</span><strong>${escapeHtml(usageText(row))}</strong></div>
    </div>${sourceReferenceSectionHtml(row)}${portalReferenceSectionHtml(row)}`;
  if (dialog.querySelector("[data-reference-source-draft]")) syncReferenceReviewSelection(dialog, "#referenceCanonicalOption", "#referenceCanonicalRequired", "[data-reference-source-draft]");
  if (dialog.querySelector("[data-reference-source-verify]")) syncReferenceReviewSelection(dialog, "#referenceCanonicalOption", "#referenceCanonicalRequired", "[data-reference-source-verify]");
  if (dialog.querySelector("[data-reference-portal-draft]")) syncReferenceReviewSelection(dialog, "#referencePortalOption", "#referencePortalRequired", "[data-reference-portal-draft]");
  if (dialog.querySelector("[data-reference-portal-verify]")) syncReferenceReviewSelection(dialog, "#referencePortalOption", "#referencePortalRequired", "[data-reference-portal-verify]");
  applyPermissionUi();
  if (focusSection) requestAnimationFrame(() => dialog.querySelector(focusSection)?.focus());
}

function closeReferenceReviewDialog() {
  const dialog = $("referenceReviewDialog");
  if (dialog?.open) dialog.close();
}

async function refreshReferenceReviewAfterMutation({ focusSection, message }) {
  await loadReferenceDictionary({ force: true });
  const freshRow = currentReferenceReviewRow();
  if (!freshRow) {
    closeReferenceReviewDialog();
    showToast("Reference Dictionary reloaded; the selected source row is no longer available.", "info");
    return;
  }
  referenceReviewSelectedCanonicalId = null;
  renderReferenceReviewDialog(freshRow, { focusSection });
  showToast(message, "success");
}

async function runReferenceReviewMutation(button, mutation, refreshOptions) {
  if (!canWrite() || button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await mutation();
    await refreshReferenceReviewAfterMutation(refreshOptions);
  } catch (error) {
    if (button) button.disabled = false;
    toastError(error);
  }
}

async function handleReferenceReviewAction(event) {
  const dialog = $("referenceReviewDialog");
  const row = currentReferenceReviewRow();
  const button = event.target.closest("button");
  if (!dialog || !row || !button) return;
  if (button.matches("[data-reference-source-draft]")) {
    const termId = requirePositiveReferenceSelection(dialog, "#referenceCanonicalOption", "#referenceCanonicalRequired", "Select a canonical Reference Work before creating the draft.");
    await runReferenceReviewMutation(button, () => createReferenceAliasDraft(row.source_reference_text, termId), { focusSection: "#referenceSourceSectionTitle", message: "Global source mapping draft created." });
  } else if (button.matches("[data-reference-source-verify]")) {
    const termId = requirePositiveReferenceSelection(dialog, "#referenceCanonicalOption", "#referenceCanonicalRequired", "Select a canonical Reference Work before verifying.");
    await runReferenceReviewMutation(button, () => verifyReferenceAlias(row.alias_mapping_id, row.alias_mapping_status, termId), { focusSection: "#referenceSourceSectionTitle", message: "Global source mapping verified." });
  } else if (button.matches("[data-reference-work-create]")) {
    const input = dialog.querySelector("#newReferenceWorkLabel");
    const label = String(input?.value || "").trim();
    if (!label) { input?.focus(); return; }
    if (!canWrite() || button.disabled) return;
    button.disabled = true;
    try {
      const created = await createReferenceWork(label);
      state.referenceWorkOptions = await fetchReferenceWorkOptions();
      state.referenceWorkOptionsLoaded = true;
      referenceReviewSelectedCanonicalId = created?.controlled_term_id || null;
      await loadReferenceDictionary({ force: true });
      const freshRow = currentReferenceReviewRow();
      if (!freshRow) {
        closeReferenceReviewDialog();
        showToast("Reference Dictionary reloaded; the selected source row is no longer available.", "info");
        return;
      }
      renderReferenceReviewDialog(freshRow, { focusSection: "#referenceSourceSectionTitle" });
      showToast("Canonical Reference Work created. Create the source mapping draft separately.", "success");
    } catch (error) {
      button.disabled = false;
      toastError(error);
    }
  } else if (button.matches("[data-reference-portal-draft]")) {
    const optionId = requirePositiveReferenceSelection(dialog, "#referencePortalOption", "#referencePortalRequired", "Select an e-Aushadhi Reference option before creating the draft.");
    await runReferenceReviewMutation(button, () => createReferencePortalMappingDraft(row.canonical_term_id, optionId), { focusSection: "#referencePortalSectionTitle", message: "Global portal mapping draft created." });
  } else if (button.matches("[data-reference-portal-verify]")) {
    const optionId = requirePositiveReferenceSelection(dialog, "#referencePortalOption", "#referencePortalRequired", "Select an e-Aushadhi Reference option before verifying.");
    await runReferenceReviewMutation(button, () => verifyReferenceMapping({ mappingId: row.portal_mapping_id, expectedStatus: row.portal_mapping_status, portalOptionId: optionId }), { focusSection: "#referencePortalSectionTitle", message: "Global portal mapping verified." });
  }
}

async function openReferenceReview(row, trigger) {
  referenceReviewSource = row.source_reference_text;
  referenceReviewTrigger = trigger;
  referenceReviewSelectedCanonicalId = null;
  await ensureReferenceWorkOptions();
  referenceReviewCandidates = row.alias_mapping_id ? [] : await fetchReferenceAliasCandidates(row.source_reference_text);
  const dialog = document.createElement("dialog");
  dialog.id = "referenceReviewDialog";
  dialog.className = "sasv-modal reference-dictionary-modal";
  dialog.innerHTML = `<form method="dialog" class="modal-card reference-dictionary-modal-card">
    <h2 id="referenceReviewTitle" tabindex="-1">Review Reference Mapping</h2>
    <div data-reference-review-body></div>
    <div class="modal-actions"><button type="submit" class="icon-btn with-label">Close</button></div>
  </form>`;
  dialog.setAttribute("aria-labelledby", "referenceReviewTitle");
  dialog.addEventListener("click", (event) => void handleReferenceReviewAction(event).catch(toastError));
  dialog.addEventListener("close", () => {
    dialog.remove();
    const refreshedTrigger = document.querySelector(`[data-reference-source="${CSS.escape(referenceReviewSource)}"]`);
    (refreshedTrigger || referenceReviewTrigger)?.focus?.();
    referenceReviewSource = null;
    referenceReviewTrigger = null;
    referenceReviewCandidates = [];
    referenceReviewSelectedCanonicalId = null;
  }, { once: true });
  document.body.append(dialog);
  renderReferenceReviewDialog(row);
  dialog.showModal();
  $("referenceReviewTitle")?.focus();
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
    showToast("Source corrected. The line is back to Pending. Save it for review again.", "success");
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
  const disable = locked
    ? ' disabled aria-disabled="true" data-force-disabled="true"'
    : "";
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
  const actionsDecision = combineApproval(actionsVerifyOk, actionsVerifyHint, "actions");
  host.innerHTML = `
    <div class="section-card${locked ? " is-verified" : ""}">
      <h3 class="section-title">Pharmacological action</h3>
      ${locked ? lockNoteHtml() : `<p class="muted-note">Select every applicable action from the server vocabulary. Additional exact wording can be added. Changes save automatically. Verify when the complete set is correct.</p>`}
      ${autosaveHtml(state.actionsSaveStatus, "actionsAutosave")}
      ${stageSaverHtml("actions")}
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
          preEntryReopenButton({
            kind: "actions",
            id: "btnReopenActions",
            label: "Reopen Actions",
          })
        }`
            : `<button type="button" class="icon-btn with-label" id="btnAddAction" data-edit-action="true">Add custom action</button>
        <button type="button" class="icon-btn with-label primary" id="btnVerifyActions" data-edit-action="true"${
          actionsDecision.ok ? "" : " data-force-disabled=\"true\""
        }${actionsDecision.code ? ` data-block-code="${escapeHtml(actionsDecision.code)}"` : ""}${
          actionsDecision.reason ? ` title="${escapeHtml(actionsDecision.reason)}"` : ""
        }>Approve</button>`
        }
      </div>
      ${approvalNoticeHtml("actions")}
      ${
        locked
          ? ""
          : `<p class="disabled-reason" id="actionsVerifyHint"${actionsDecision.reason ? "" : " hidden"}>${escapeHtml(actionsDecision.reason)}</p>`
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

function copyCardSubline(hasCopy, copy, pick) {
  if (pick?.file) {
    const prefix = hasCopy ? "Replace with" : "Selected";
    return `${prefix} ${displayText(pick.file.name)} / ${displayText(pick.file.type || "-")} / ${formatFileSize(pick.file.size)}`;
  }
  if (hasCopy && copy) {
    return `${displayText(copy.original_file_name)} / ${displayText(copy.mime_type)} / ${formatFileSize(copy.file_size_bytes)} / ${copy.created_at ? String(copy.created_at).slice(0, 10) : "-"}`;
  }
  return "PDF / JPG / PNG. Max 20 MB";
}

function copyCardActions(hasCopy, pick, canUpload) {
  if (pick?.file) {
    return `<button type="button" class="icon-btn with-label primary" id="btnUploadCopy" data-edit-action="true"${
      canUpload ? "" : ` data-force-disabled="true"`
    }>Upload copy</button>
        <button type="button" class="icon-btn with-label" id="btnCancelCopy">Cancel</button>`;
  }
  if (hasCopy) {
    return `<button type="button" class="icon-btn with-label" id="btnOpenCopy">Open copy</button>
        <button type="button" class="icon-btn with-label" id="btnReplaceCopy" data-edit-action="true">Replace copy</button>`;
  }
  return `<button type="button" class="icon-btn with-label" id="btnChooseCopy" data-edit-action="true" aria-label="Choose approved product copy file" title="PDF, JPG, or PNG. Max 20 MB.">Choose file</button>`;
}

const QC_REPORT_MAX_BYTES = 2 * 1024 * 1024;

function qcReportTooLargeMessage(size) {
  const mb = (Number(size) / (1024 * 1024)).toFixed(2);
  return `PDF is larger than 2 MB (${mb} MB). Reduce it before uploading.`;
}

function qcReportFileProblem(file, header) {
  const name = String(file?.name || "");
  if (!/\.pdf$/i.test(name) || file?.type !== "application/pdf") return "Choose a PDF file.";
  const bytes = header instanceof Uint8Array ? header : Uint8Array.from(header || []);
  const pdf = bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
  if (!pdf) return "The file does not start with %PDF-.";
  const size = Number(file?.size);
  if (!(size > 0)) return "The PDF is empty.";
  if (size > QC_REPORT_MAX_BYTES) return qcReportTooLargeMessage(size);
  return "";
}

function qcReportObjectId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "";
}

function qcReportStorageExists(error) {
  const status = Number(error?.status || error?.statusCode || error?.original?.status || error?.original?.statusCode || 0);
  const message = String(error?.message || error?.original?.message || "");
  return status === 409 || /exists/i.test(message);
}

function qcReportRemovalWarning(path) {
  return `Uploaded file could not be removed after a failed registration: ${path}. Tell Jarvis/support.`;
}

function qcRegisteredReport(preparationId) {
  const rows = (state.qcReports || []).filter((row) => (
    row?.status === "REGISTERED" && String(row?.preparation_id) === String(preparationId || "")
  ));
  rows.sort((left, right) => Number(right.version_no) - Number(left.version_no));
  return rows[0] || null;
}

function qcReportNextFile(reports, preparationId) {
  const rows = (Array.isArray(reports) ? reports : []).filter((row) => String(row?.preparation_id) === String(preparationId || ""));
  const reserved = rows.filter((row) => row.status === "RESERVED").sort((left, right) => Number(right.version_no) - Number(left.version_no));
  if (reserved[0]?.expected_file_name) {
    return { fileName: reserved[0].expected_file_name, label: reserved[0].expected_file_name };
  }
  const max = rows.reduce((highest, row) => Math.max(highest, Number(row.version_no) || 0), 0);
  const nn = String(max + 1).padStart(2, "0");
  const fileName = `EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V${nn}.pdf`;
  return { fileName, label: `assigned at upload (next: V${nn})` };
}

async function executeQcReportUpload(input) {
  const steps = [];
  if (input?.busy === true) return { ok: false, blocked: true, steps };
  if (input?.dirty === true) return { ok: false, inline: "Save or reload the QC form first.", steps };
  const size = Number(input.file?.size);
  if (!Number.isInteger(size) || size <= 0) return { ok: false, message: "The PDF is empty.", steps };
  if (size > QC_REPORT_MAX_BYTES) return { ok: false, message: qcReportTooLargeMessage(size), steps };
  const preparation = input.preparation;
  const reserved = await input.reserve({
    preparationId: preparation.preparation_id,
    expectedRowVersion: preparation.row_version,
    forceNew: input.forceNew === true,
    fileSize: size,
  });
  steps.push("reserve");
  if (!input.isCurrent()) return { ok: false, abandoned: true, steps };
  if (reserved?.ok === false) return { ok: false, message: reserved.message || "QC test report upload failed.", steps };
  const reservation = reserved.reservation;
  const path = reservation.expected_storage_path;
  let uploaded;
  try {
    uploaded = await input.upload(path, input.file, { upsert: false, contentType: "application/pdf" });
  } catch (error) {
    if (qcReportStorageExists(error)) {
      return {
        ok: false,
        inline: "A file already exists at the reserved path. Reload; contact support if it persists.",
        steps,
      };
    }
    return { ok: false, message: error?.message || "QC test report upload failed.", steps };
  }
  steps.push("upload");
  if (!input.isCurrent()) {
    let removed = false;
    try {
      removed = await input.remove(path) !== false;
    } catch {
      removed = false;
    }
    return {
      ok: false,
      abandoned: true,
      warning: removed ? "" : qcReportRemovalWarning(path),
      steps,
    };
  }
  const objectId = qcReportObjectId(uploaded?.id);
  if (!objectId) {
    let removed = false;
    try {
      removed = await input.remove(path) !== false;
    } catch {
      removed = false;
    }
    return {
      ok: false,
      inline: "Upload could not be registered (no object id). Nothing was registered.",
      warning: removed ? "" : qcReportRemovalWarning(path),
      steps,
    };
  }
  const registered = await input.register({
    reservationId: reservation.reservation_id,
    expectedRowVersion: preparation.row_version,
    objectId,
    originalFileName: input.file.name,
    sha256: input.sha256,
    fileSize: size,
  });
  steps.push("register");
  if (!input.isCurrent()) return { ok: false, abandoned: true, steps };
  if (registered?.ok === false) {
    let removed = false;
    try {
      removed = await input.remove(path) !== false;
    } catch {
      removed = false;
    }
    return {
      ok: false,
      message: registered.message || "QC test report upload failed.",
      warning: removed ? "" : qcReportRemovalWarning(path),
      offerNewVersion: reserved.reused === true
        && String(registered.message || "").startsWith("Stale reservation")
        && String(registered.message || "").includes("reload and retry"),
      steps,
    };
  }
  const form = {
    ...(input.form || {}),
    report_filename: reservation.expected_file_name,
    report_sha256: input.sha256,
  };
  if (input.overrides?.report_evidence_note !== true) {
    form.report_evidence_note = input.generatedNotes(form, input.protocolOptions).report_evidence_note;
  }
  const saved = await input.save({
    preparationId: preparation.preparation_id,
    expectedRowVersion: preparation.row_version,
    payload: input.payloadFromForm(form),
    lastReadStatus: preparation.preparation_status,
  });
  steps.push("save");
  if (!input.isCurrent()) return { ok: false, abandoned: true, steps };
  if (saved?.ok === false) {
    return {
      ok: false,
      message: "Report registered, but the QC draft could not be updated. Open QC Register, Reload, then Save.",
      steps,
    };
  }
  const version = String(reservation.version_no).padStart(2, "0");
  let verification = null;
  if (typeof input.verify === "function") {
    if (typeof input.onVerifyStart === "function") input.onVerifyStart();
    verification = await input.verify({ reservationId: reservation.reservation_id });
    steps.push("verify");
    if (!input.isCurrent()) return { ok: false, abandoned: true, steps, verification };
  }
  return {
    ok: true,
    steps,
    reservationId: reservation.reservation_id,
    fileName: reservation.expected_file_name,
    sha256: input.sha256,
    verification,
    toast: `QC test report V${version} registered; draft saved (version ${saved.row_version}).`,
  };
}

function qcReportSizeText(size) {
  const bytes = Number(size);
  const count = Number.isFinite(bytes) ? bytes : 0;
  const kb = (count / 1024).toFixed(1);
  const mb = (count / 1048576).toFixed(2);
  return `${count} bytes (${kb} KB / ${mb} MB)`;
}

function qcReportByteReasonText(code) {
  if (code === "SHA256_MISMATCH") return "file on server differs from the file you picked";
  if (code === "SIZE_MISMATCH_STORAGE_METADATA") return "stored size does not match the storage metadata";
  if (code === "SIZE_OUT_OF_RANGE_2MB") return "over 2 MB";
  if (code === "NOT_PDF_HEADER") return "not a PDF";
  return String(code || "");
}

function qcReportByteLabel(report, session) {
  const sessionMatches = Boolean(session) && Boolean(report)
    && String(session.reservation_id) === String(report.reservation_id);
  const status = sessionMatches ? session.integrity_status : report?.integrity_status;
  if (status === "VERIFIED_BYTES") return "verified";
  if (status === "BYTES_MISMATCH") return "mismatch";
  return "pending";
}

function qcReportShowByteCheck(model) {
  if (model?.electron !== true || model?.canWrite !== true) return false;
  if (model?.verifying === true || model?.confirmOpen === true) return true;
  if (model.verifyCode === "OBJECT_CHANGED" || model.verifyCode === "NETWORK") return true;
  return model.integrityStatus === "UNVERIFIED_BYTES" && Boolean(model.latestRegistered);
}

function clearQcReportSelectionIfScopeChanged(productId, preparationId) {
  if (!state.qcReportFile) return false;
  const sameProduct = state.qcReportFileProductId === productId;
  const samePreparation = String(state.qcReportFilePreparationId || "") === String(preparationId || "");
  if (sameProduct && samePreparation) return false;
  state.qcReportFile = null;
  state.qcReportSha = "";
  state.qcReportFileError = "";
  state.qcReportFileProductId = null;
  state.qcReportFilePreparationId = null;
  return true;
}

function qcReportByteCheckWarning(version) {
  return `The server will read the stored PDF and compute its SHA-256. If the checksum does not match, the file is not a valid PDF, or it is over 2 MB, this version (V${version}) is permanently marked BYTES_MISMATCH and cannot be re-checked. You would need to upload a new version. Continue?`;
}

function resolveReturnFocus(returnFocus, returnFocusId) {
  if (returnFocus && typeof returnFocus === "object" && typeof returnFocus.focus === "function") {
    return returnFocus;
  }
  const id =
    (typeof returnFocus === "string" && returnFocus) ||
    (typeof returnFocusId === "string" && returnFocusId) ||
    "";
  return id ? document.getElementById(id) : null;
}

function openQcConfirm(options) {
  const {
    title,
    message,
    okLabel,
    cancelLabel,
    returnFocusId,
    returnFocus,
    idPrefix,
    reasonRequired,
    attestLabel,
    extraText,
  } = options || {};
  if (openQcConfirm.showing === true) return Promise.resolve(false);
  openQcConfirm.showing = true;
  const prefix = idPrefix || "qcConfirm";
  const trigger = resolveReturnFocus(returnFocus, returnFocusId);
  const focusId =
    (typeof returnFocusId === "string" && returnFocusId) ||
    (typeof returnFocus === "string" && returnFocus) ||
    "";
  const gated = reasonRequired === true || Boolean(attestLabel);
  return new Promise((resolve) => {
    let closed = false;
    const backdrop = document.createElement("div");
    backdrop.id = `${prefix}Backdrop`;
    backdrop.className = "sasv-modal-backdrop ea-source-resolve";
    const dialog = document.createElement("div");
    dialog.id = `${prefix}Dialog`;
    dialog.className = "sasv-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", `${prefix}Title`);
    dialog.tabIndex = -1;
    const header = document.createElement("div");
    header.className = "sasv-modal__header";
    const titleEl = document.createElement("h2");
    titleEl.id = `${prefix}Title`;
    titleEl.className = "sasv-modal__title";
    titleEl.textContent = String(title || "");
    header.append(titleEl);
    const body = document.createElement("div");
    body.id = `${prefix}Body`;
    body.className = "sasv-modal__body";
    const paragraph = document.createElement("p");
    paragraph.className = "sasv-modal__message";
    paragraph.textContent = String(message ?? "");
    body.append(paragraph);
    if (extraText) {
      const extra = document.createElement("p");
      extra.id = `${prefix}Extra`;
      extra.textContent = String(extraText);
      body.append(extra);
    }
    let reasonInput = null;
    if (reasonRequired === true) {
      reasonInput = document.createElement("textarea");
      reasonInput.id = `${prefix}Reason`;
      body.append(reasonInput);
    }
    let attestInput = null;
    if (attestLabel) {
      attestInput = document.createElement("input");
      attestInput.type = "checkbox";
      attestInput.id = `${prefix}Attest`;
      const attestWrap = document.createElement("label");
      const attestText = document.createElement("span");
      attestText.textContent = ` ${attestLabel}`;
      attestWrap.append(attestInput, attestText);
      body.append(attestWrap);
    }
    const footer = document.createElement("div");
    footer.className = "sasv-modal__footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = `${prefix}Cancel`;
    cancelBtn.className = "icon-btn with-label";
    cancelBtn.textContent = String(cancelLabel || "Cancel");
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.id = `${prefix}Ok`;
    okBtn.className = "icon-btn with-label primary";
    okBtn.textContent = String(okLabel || "OK");
    if (gated) okBtn.disabled = true;
    footer.append(cancelBtn, okBtn);
    dialog.append(header, body, footer);
    backdrop.append(dialog);

    const syncOk = () => {
      if (!gated) return;
      const note = String(reasonInput?.value || "").trim();
      const reasonOk = reasonRequired !== true || (note.length >= 10 && note.length <= 2000);
      const attestOk = !attestLabel || attestInput.checked === true;
      okBtn.disabled = !(reasonOk && attestOk);
    };
    reasonInput?.addEventListener("input", syncOk);
    attestInput?.addEventListener("change", syncOk);

    const close = (accepted) => {
      if (closed) return;
      closed = true;
      openQcConfirm.showing = false;
      document.removeEventListener("keydown", onKeydown, true);
      backdrop.remove();
      const button = (focusId && document.getElementById(focusId)) || trigger;
      if (button && typeof button.focus === "function") button.focus();
      if (accepted && typeof accepted === "object") resolve(accepted);
      else resolve(accepted === true);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(false);
        return;
      }
      trapModalTab(event, `${prefix}Dialog`);
    };

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    cancelBtn.addEventListener("click", () => close(false));
    okBtn.addEventListener("click", () => {
      if (okBtn.disabled) return;
      if (gated) {
        close({
          ok: true,
          reasonNote: String(reasonInput?.value || "").trim(),
          attest: attestInput ? attestInput.checked === true : true,
        });
        return;
      }
      close(true);
    });
    document.body.append(backdrop);
    document.addEventListener("keydown", onKeydown, true);
    cancelBtn.focus();
  });
}

function openQcByteCheckConfirm(message) {
  return openQcConfirm({
    title: "Check bytes on server",
    message,
    okLabel: "OK, check bytes",
    returnFocusId: "btnQcReportCheckBytes",
    idPrefix: "qcByteCheckConfirm",
  });
}

async function runConfirmedQcReportByteCheck(version, confirm, verify) {
  const msg = qcReportByteCheckWarning(version);
  if ((await confirm(msg)) !== true) return false;
  await verify();
  return true;
}

function qcTestReportCardModel() {
  const preparation = state.qcPrepServer;
  clearQcReportSelectionIfScopeChanged(state.selectedProductId, preparation?.preparation_id || "");
  const activeFile = state.qcReportFile;
  const next = qcReportNextFile(state.qcReports, preparation?.preparation_id);
  const latest = qcRegisteredReport(preparation?.preparation_id);
  const sessionReport = latest || (state.qcReportByteResult
    ? { reservation_id: state.qcReportByteResult.reservation_id, integrity_status: state.qcReportByteResult.integrity_status }
    : null);
  const electron = workerApiAvailable();
  const allowed = isFirstControlledEntryProduct(state.selectedProductId);
  const uploadDisabled = !canWrite()
    || !electron
    || !preparation
    || preparation.preparation_status === "VERIFIED"
    || state.qcPrepDirty === true
    || state.busy === true
    || !activeFile
    || !state.qcReportSha
    || Boolean(state.qcReportFileError);
  const sessionMatches = Boolean(latest) && Boolean(state.qcReportByteResult)
    && String(state.qcReportByteResult.reservation_id) === String(latest.reservation_id);
  const activeSession = sessionMatches || !latest ? state.qcReportByteResult : null;
  return {
    electron,
    productAllowed: allowed,
    canWrite: canWrite(),
    status: preparation
      ? qcPrepStatusText(preparation, state.qcPrepLoading)
      : "No QC preparation saved yet.",
    reports: state.qcReports,
    latestRegistered: latest,
    integrityStatus: latest?.integrity_status || "",
    byteCheck: qcReportByteLabel(sessionReport, state.qcReportByteResult),
    reasons: Array.isArray(activeSession?.reasons) ? activeSession.reasons : [],
    verifiedSha: activeSession?.verified_sha256 || "",
    verifiedSize: activeSession?.verified_size_bytes ?? null,
    verifying: state.qcReportVerifying === true,
    confirmOpen: state.qcReportConfirmOpen === true,
    verifyError: state.qcReportVerifyError,
    verifyCode: state.qcReportVerifyCode,
    offerNewVersion: state.qcReportOfferNewVersion === true,
    sha: preparation ? qcPrepForm().report_sha256 : "",
    lastSize: state.qcReportLastSize,
    nextLabel: next.label,
    nextFileName: next.fileName,
    chosenName: activeFile?.name || "",
    chosenSizeText: activeFile ? qcReportSizeText(activeFile.size) : "",
    shaPreview: state.qcReportSha,
    fileError: state.qcPrepDirty ? "Save or reload the QC form first." : state.qcReportFileError,
    warning: state.qcReportWarning,
    notice: state.qcReportNotice,
    uploadDisabled,
  };
}

function queueQcReportLoad() {
  if (!workerApiAvailable() || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (access.canView !== true || state.qcReportLoading || state.qcReportLoadedFor === state.selectedProductId) return;
  state.qcReportLoading = true;
  const productId = state.selectedProductId;
  const request = ++state.qcReportRequest;
  queueMicrotask(() => {
    void loadQcReportList(productId, request);
  });
}

async function loadQcReportList(productId, request) {
  try {
    const token = await sessionAccessToken();
    if (request !== state.qcReportRequest || state.selectedProductId !== productId) return;
    const listed = await listQcReports(productId, token);
    if (request !== state.qcReportRequest || state.selectedProductId !== productId) return;
    if (listed?.ok === false) {
      state.qcReportNotice = listed.message || "QC test report list failed.";
      state.qcReports = [];
    } else {
      state.qcReports = Array.isArray(listed?.reports) ? listed.reports : [];
      state.qcReportNotice = "";
    }
    state.qcReportLoadedFor = productId;
  } catch (error) {
    if (request !== state.qcReportRequest || state.selectedProductId !== productId) return;
    state.qcReportNotice = userMessageForError(error);
    state.qcReportLoadedFor = productId;
  } finally {
    if (request === state.qcReportRequest) state.qcReportLoading = false;
    if (state.selectedProductId === productId) {
      if (state.tab === "evidence") renderEvidence();
      if (state.tab === "qc") renderQc();
    }
  }
}

async function pickQcReportFile(file) {
  state.qcReportFile = file;
  state.qcReportSha = "";
  state.qcReportFileError = "";
  try {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const problem = qcReportFileProblem(file, header);
    if (problem) {
      state.qcReportFileError = problem;
      state.qcReportFile = null;
      state.qcReportFileProductId = null;
      state.qcReportFilePreparationId = null;
    } else {
      state.qcReportFileProductId = state.selectedProductId;
      state.qcReportFilePreparationId = state.qcPrepServer?.preparation_id || "";
      state.qcReportSha = await hashFileSha256(file) || "";
      if (!state.qcReportSha) state.qcReportFileError = "SHA-256 could not be computed.";
    }
  } catch (error) {
    state.qcReportFileError = userMessageForError(error);
    state.qcReportFile = null;
    state.qcReportFileProductId = null;
    state.qcReportFilePreparationId = null;
  }
  if (state.tab === "evidence") renderEvidence();
}

async function submitQcReportUpload() {
  if (state.busy || !workerApiAvailable() || !canWrite()) return;
  if (!isFirstControlledEntryProduct(state.selectedProductId)) return;
  const preparation = state.qcPrepServer;
  if (!preparation || preparation.preparation_status === "VERIFIED" || !state.qcReportFile || !state.qcReportSha) return;
  if (state.qcPrepDirty) {
    state.qcReportFileError = "Save or reload the QC form first.";
    if (state.tab === "evidence") renderEvidence();
    return;
  }
  const productId = state.selectedProductId;
  const request = ++state.qcReportUploadRequest;
  state.busy = true;
  state.qcReportWarning = "";
  try {
    const token = await sessionAccessToken();
    const result = await executeQcReportUpload({
      dirty: state.qcPrepDirty,
      busy: false,
      preparation,
      file: state.qcReportFile,
      sha256: state.qcReportSha,
      form: qcPrepForm(),
      overrides: state.qcPrepNoteOverrides,
      protocolOptions: state.qcPrepOptions,
      generatedNotes: qcPrepGeneratedNotes,
      payloadFromForm: qcPrepPayloadFromForm,
      isCurrent: () => state.qcReportUploadRequest === request && state.selectedProductId === productId,
      reserve: (draft) => reserveQcReport(productId, token, draft),
      upload: (path, file) => uploadQcReportObject(path, file),
      remove: (path) => removeQcReportObject(path),
      register: (draft) => registerQcReport(productId, token, draft),
      save: (draft) => saveQcPreparation(productId, token, draft),
    });
    if (result.warning && state.qcReportUploadRequest === request && state.selectedProductId === productId) {
      state.qcReportWarning = result.warning;
    }
    if (state.qcReportUploadRequest !== request || state.selectedProductId !== productId) return;
    state.qcReportVerifying = false;
    state.qcReportOfferNewVersion = result.offerNewVersion === true;
    if (result.ok === true) {
      state.qcReportLastSize = state.qcReportFile?.size || null;
      state.qcReportFile = null;
      state.qcReportFileProductId = null;
      state.qcReportFilePreparationId = null;
      state.qcReportSha = "";
      state.qcReportFileError = "";
      showToast(result.toast, "success");
      state.busy = false;
      state.qcReportLoadedFor = null;
      state.qcEvidenceLoadedFor = null;
      state.qcEvidenceLoading = false;
      reloadQcPreparationWorkspace();
      queueQcReportLoad();
      return;
    }
    if (result.offerNewVersion === true) {
      state.qcReportFileError = "This reservation is out of date. Reserve a new version";
      showToast(state.qcReportFileError, "error");
    } else {
      state.qcReportFileError = result.inline || result.message || "";
      if (result.message && !result.inline) showToast(result.message, "error");
    }
  } catch (error) {
    if (state.qcReportUploadRequest !== request || state.selectedProductId !== productId) return;
    state.qcReportFileError = userMessageForError(error);
    showToast(state.qcReportFileError, "error");
  } finally {
    if (state.qcReportUploadRequest === request) {
      state.busy = false;
      state.qcReportVerifying = false;
    }
    if (state.selectedProductId === productId && state.tab === "evidence") renderEvidence();
  }
}

function clearQcReportFile() {
  state.qcReportFile = null;
  state.qcReportFileProductId = null;
  state.qcReportFilePreparationId = null;
  state.qcReportSha = "";
  state.qcReportFileError = "";
  if (state.tab === "evidence") renderEvidence();
}

async function submitQcReportByteCheck() {
  if (state.qcReportVerifying === true || state.qcReportConfirmOpen === true) return;
  if (state.busy || !workerApiAvailable() || !canWrite()) return;
  if (!isFirstControlledEntryProduct(state.selectedProductId)) return;
  const latest = qcRegisteredReport(state.qcPrepServer?.preparation_id);
  if (!latest?.reservation_id) return;
  const productId = state.selectedProductId;
  const version = String(latest.version_no).padStart(2, "0");
  let request = state.qcReportVerifyRequest;
  let checked = null;
  state.qcReportConfirmOpen = true;
  try {
    const ran = await runConfirmedQcReportByteCheck(version, openQcByteCheckConfirm, async () => {
      if (state.qcReportVerifying || state.selectedProductId !== productId) return;
      request = ++state.qcReportVerifyRequest;
      state.qcReportVerifying = true;
      state.qcReportVerifyError = "";
      state.qcReportVerifyCode = "";
      if (state.tab === "evidence") renderEvidence();
      const token = await sessionAccessToken();
      if (state.qcReportVerifyRequest !== request || state.selectedProductId !== productId) return;
      checked = await verifyQcReportBytes(productId, token, { reservationId: latest.reservation_id });
    });
    if (ran !== true) return;
    if (checked == null) return;
    if (state.qcReportVerifyRequest !== request || state.selectedProductId !== productId) return;
    if (checked?.ok === true) {
      state.qcReportByteResult = {
        reservation_id: latest.reservation_id,
        integrity_status: checked.integrity_status,
        reasons: checked.reasons || [],
        verified_sha256: checked.verified_sha256 || "",
        verified_size_bytes: checked.verified_size_bytes ?? null,
      };
      state.qcReportVerifyError = "";
      state.qcReportVerifyCode = "";
      state.qcReportLoadedFor = null;
      state.qcEvidenceLoadedFor = null;
      state.qcEvidenceLoading = false;
      queueQcReportLoad();
    } else {
      state.qcReportVerifyError = checked?.message || "QC test report byte check failed.";
      state.qcReportVerifyCode = checked?.code || "";
    }
  } catch (error) {
    if (state.qcReportVerifyRequest !== request || state.selectedProductId !== productId) return;
    state.qcReportVerifyError = userMessageForError(error);
    state.qcReportVerifyCode = "NETWORK";
  } finally {
    state.qcReportConfirmOpen = false;
    if (state.qcReportVerifyRequest === request) state.qcReportVerifying = false;
    if (state.selectedProductId === productId && state.tab === "evidence") renderEvidence();
    const button = document.getElementById("btnQcReportCheckBytes");
    if (button && typeof button.focus === "function") button.focus();
  }
}

async function reserveNewQcReportVersion() {
  if (state.busy || state.qcReportOfferNewVersion !== true || !workerApiAvailable() || !canWrite()) return;
  const preparation = state.qcPrepServer;
  if (!preparation || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  const productId = state.selectedProductId;
  const request = ++state.qcReportUploadRequest;
  state.busy = true;
  try {
    const token = await sessionAccessToken();
    const reserved = await reserveQcReport(productId, token, {
      preparationId: preparation.preparation_id,
      expectedRowVersion: preparation.row_version,
      forceNew: true,
      fileSize: state.qcReportFile?.size,
    });
    if (state.qcReportUploadRequest !== request || state.selectedProductId !== productId) return;
    if (reserved?.ok === false) {
      state.qcReportFileError = reserved.message || "QC test report upload failed.";
      return;
    }
    state.qcReportOfferNewVersion = false;
    state.qcReportLoadedFor = null;
    queueQcReportLoad();
  } catch (error) {
    if (state.qcReportUploadRequest !== request || state.selectedProductId !== productId) return;
    state.qcReportFileError = userMessageForError(error);
  } finally {
    if (state.qcReportUploadRequest === request) state.busy = false;
    if (state.selectedProductId === productId && state.tab === "evidence") renderEvidence();
  }
}

function qcTestReportCardHtml(model) {
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  if (model.electron !== true) {
    return `<section class="section-card" id="qcTestReportCard"><h3 class="section-title">QC Test Report (Product 262)</h3><p class="muted-note">QC test report upload is available only in the SASV Electron app.</p></section>`;
  }
  if (model.productAllowed !== true) {
    return `<section class="section-card" id="qcTestReportCard"><h3 class="section-title">QC Test Report (Product 262)</h3><p class="muted-note">QC test report upload is available for Product 262 only in this release.</p></section>`;
  }
  const reports = Array.isArray(model.reports) ? model.reports : [];
  const rows = reports.map((row) => `<li>V${esc(String(row.version_no).padStart(2, "0"))} ${esc(row.status)} ${esc(row.expected_file_name)}</li>`).join("");
  const latest = model.latestRegistered;
  const version = latest ? String(latest.version_no).padStart(2, "0") : "";
  const b1 = version ? `B1: Report registered (V${version})` : "B1: Report registered";
  const b2 = `B2: Server byte check: ${model.byteCheck || "pending"}`;
  const reasons = (Array.isArray(model.reasons) ? model.reasons : [])
    .map((code) => qcReportByteReasonText(code))
    .filter(Boolean);
  const detailSha = model.byteCheck === "verified" ? (model.verifiedSha || "") : (model.sha || "");
  const detailSize = model.byteCheck === "verified" && model.verifiedSize != null
    ? `${model.verifiedSize} bytes`
    : (model.lastSize ? `${model.lastSize} bytes` : "");
  const details = latest
    ? `<details id="qcReportByteDetails"><summary>Details</summary><p>File name: ${esc(latest.expected_file_name || "")}</p><p>SHA-256 ${esc(detailSha)}</p><p>Size ${esc(detailSize)}</p>${model.bytesCheckedAt ? `<p>Checked ${esc(model.bytesCheckedAt)}</p>` : ""}</details>`
    : "";
  let latestLine = `<p class="muted-note">No report uploaded.</p>`;
  if (model.verifying) {
    latestLine = `<p class="muted-note" id="qcReportByteStatus">Verifying bytes on server...</p>`;
  } else if (latest && model.byteCheck === "verified") {
    latestLine = `<p class="muted-note ea-autosave is-verified" id="qcReportByteStatus">Bytes verified ✓</p>${details}<p class="muted-note">${esc(b1)}. ${esc(b2)}</p>`;
  } else if (latest && model.byteCheck === "mismatch") {
    const reasonLine = reasons.length ? `${reasons.join("; ")}. ` : "";
    latestLine = `<p class="muted-note ea-autosave is-failed" id="qcReportByteStatus">Bytes mismatch</p>${details}<p class="muted-note">${esc(reasonLine)}This version is final. Upload a corrected file as a new version. ${esc(b1)}. ${esc(b2)}</p>`;
  } else if (latest) {
    latestLine = `<p class="muted-note" id="qcReportByteStatus">Bytes not yet verified</p>${details}<p class="muted-note">${esc(b1)}. ${esc(b2)}</p>`;
  }
  const checkButton = qcReportShowByteCheck(model)
    ? `<button type="button" class="icon-btn with-label" id="btnQcReportCheckBytes"${model.verifying || model.confirmOpen ? " disabled" : ""}>Check bytes on server</button>`
    : "";
  const newVersionButton = model.offerNewVersion && model.electron === true && model.canWrite === true
    ? `<button type="button" class="icon-btn with-label" id="btnQcReportReserveNew">Reserve a new version</button>`
    : "";
  const chosen = model.chosenName
    ? `<div id="qcReportChosenFile"><p class="muted-note" id="qcReportSelectedFile">Selected: ${esc(model.chosenName)} (${esc(model.chosenSizeText)})</p><p class="muted-note qc-report-sha" id="qcReportShaPreview">SHA-256 ${esc(model.shaPreview || "")}</p><button type="button" class="icon-btn with-label" id="btnQcReportClearFile">Clear</button></div>`
    : "";
  return `<section class="section-card" id="qcTestReportCard">
    <h3 class="section-title">QC Test Report (Product 262)</h3>
    <p class="muted-note">${esc(model.status || "")}</p>
    ${latestLine}
    <ul class="progress-list">${rows}</ul>
    <p class="muted-note" id="qcReportNextName">Next file name: ${esc(model.nextLabel)}</p>
    <p class="muted-note qc-prep-block">${esc(model.nextFileName)}</p>
    <button type="button" class="icon-btn with-label" id="btnQcReportCopyName">Copy name</button>
    ${chosen}
    ${model.fileError ? `<p class="muted-note ea-autosave is-failed" id="qcReportFileError">${esc(model.fileError)}</p>` : ""}
    ${model.verifyError ? `<p class="muted-note ea-autosave is-failed" id="qcReportVerifyError">${esc(model.verifyError)}</p>` : ""}
    ${checkButton}
    ${newVersionButton}
    ${model.warning ? `<p class="muted-note ea-autosave is-failed" id="qcReportWarning">${esc(model.warning)}</p>` : ""}
    ${model.notice ? `<p class="muted-note" id="qcReportNotice">${esc(model.notice)}</p>` : ""}
    <input id="fldQcReportFile" type="file" accept="application/pdf,.pdf" />
    <button type="button" class="icon-btn with-label" id="btnQcReportUpload"${model.uploadDisabled ? " disabled" : ""}>Upload</button>
  </section>`;
}

function renderEvidence() {
  const host = $("tab-evidence");
  queueQcPreparationLoad();
  queueQcReportLoad();
  queueQcEvidenceRecheck();
  const evidence = state.evidence || {};
  const row = state.queueRow || {};
  const blocking = toInt(evidence.blocking_issue_count ?? row.open_blockers);
  const copy = state.copy;
  const pick = state.copyPick;
  const hasCopy = Boolean(copy?.storage_path) || evidence.approved_product_copy_present === true;
  const expectedName = state.copyContract?.expected_file_name || "";
  const canUpload = governedCopyUploadReady({ file: pick?.file, contract: state.copyContract }) && !pick?.error;
  const copyChip = pick?.file || !hasCopy ? chip("neutral", "Pending") : chip("success", "Present");
  host.innerHTML = `
    <div class="section-card ea-copy-card">
      <div class="ea-copy-head">
        <div class="ea-copy-title-group">
          <h3 class="section-title">Approved Product Copy</h3>
          ${copyChip}
        </div>
        <div class="ea-copy-actions">${copyCardActions(hasCopy, pick, canUpload)}</div>
      </div>
      <p class="ea-copy-sub muted-note">${escapeHtml(copyCardSubline(hasCopy, copy, pick))}</p>
      ${pick?.error ? `<p class="ea-copy-sub muted-note ea-autosave is-failed" aria-live="polite">${escapeHtml(pick.error)}</p>` : ""}
      <div class="ea-expected-file">
        <span class="meta-label">Expected filename</span>
        <div class="ea-expected-file-row">
          <span class="ea-expected-file-name" id="eaExpectedFileName">${escapeHtml(expectedName || "Unavailable")}</span>
          <button type="button" class="icon-btn with-label" id="btnCopyExpectedFileName"${expectedName ? "" : " disabled"}>Copy</button>
        </div>
      </div>
      ${state.copyContractError ? `<p class="muted-note ea-autosave is-failed ea-copy-contract-error" aria-live="polite">${escapeHtml(state.copyContractError)}</p>` : ""}
      <input id="fldCopyFile" class="ea-copy-file" type="file" accept="application/pdf,image/jpeg,image/png" hidden data-edit-action="true" />
    </div>
    ${qcTestReportCardHtml(qcTestReportCardModel())}
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

function workerStatusLabel(status) {
  return status?.label || "Disconnected";
}

function toolbarWorkerStatusText() {
  if (!workerApiAvailable()) return "Unavailable";
  return workerStatusLabel(state.workerStatus);
}

function isConnectPrimaryState(workerState) {
  return !workerState || workerState === "IDLE" || workerState === "FAILED";
}

function workerStatusTone(workerState, available) {
  if (!available || !workerState || workerState === "IDLE") return "neutral";
  if (workerState === "AUTH_REQUIRED") return "warning";
  if (workerState === "READY") return "success";
  if (workerState === "FAILED") return "danger";
  return "neutral";
}

let workerMenuOpen = false;
let lastWorkerToolbarKey = "";

function closeWorkerMenu({ restoreFocus = false } = {}) {
  const menu = $("eaWorkerMenu");
  const more = $("btnWorkerMenuTrigger");
  workerMenuOpen = false;
  if (menu) menu.hidden = true;
  if (more) more.setAttribute("aria-expanded", "false");
  if (restoreFocus) more?.focus();
}

function positionWorkerMenu() {
  const menu = $("eaWorkerMenu");
  const more = $("btnWorkerMenuTrigger");
  if (!menu || !more || menu.hidden) return;
  const rect = more.getBoundingClientRect();
  menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  menu.style.right = `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`;
  menu.style.left = "auto";
}

function openWorkerMenu() {
  const menu = $("eaWorkerMenu");
  const more = $("btnWorkerMenuTrigger");
  if (!menu || !more) return;
  workerMenuOpen = true;
  menu.hidden = false;
  more.setAttribute("aria-expanded", "true");
  positionWorkerMenu();
  menu.querySelector('.ea-worker-menuitem:not([hidden]):not(:disabled):not([aria-disabled="true"])')?.focus();
}

function toggleWorkerMenu() {
  if (workerMenuOpen) closeWorkerMenu();
  else openWorkerMenu();
}

function setMenuActionDisabled(el, disabled) {
  setForceDisabled(el, disabled);
  if (!el) return;
  if (disabled) el.setAttribute("aria-disabled", "true");
  else el.removeAttribute("aria-disabled");
}

const STOP_BROWSER_HINT =
  "Stop Browser — closes the dedicated browser; does not log out of e-Aushadhi.";

function syncWorkerActionVisibility(connectPrimary) {
  const stop = $("btnWorkerStop");
  const connect = $("btnWorkerConnect");
  if (!stop || !connect) return;
  connect.hidden = !connectPrimary;
  stop.hidden = connectPrimary;
  stop.title = STOP_BROWSER_HINT;
  stop.setAttribute("aria-label", STOP_BROWSER_HINT);
}

function captureToolbarTitle() {
  const outcome = state.workerCaptureResult?.ok === true ? state.workerCaptureResult.auth_outcome : "";
  if (outcome) return `Capture Portal Contract (last: ${outcome})`;
  return "Capture Portal Contract";
}

function setForceDisabled(el, disabled) {
  if (!el) return;
  if (disabled) el.dataset.forceDisabled = "true";
  else delete el.dataset.forceDisabled;
}

function syncWorkerToolbarUi() {
  const available = workerApiAvailable();
  const status = state.workerStatus;
  const busy = state.busy;
  const workerState = status?.state;
  const connectPrimary = isConnectPrimaryState(workerState);
  const connectDisabled =
    !available ||
    busy ||
    (workerState && workerState !== "IDLE" && workerState !== "FAILED");
  const stopDisabled = !available || busy || !workerState || workerState === "IDLE";
  const recheckVisible = available && workerState === "AUTH_REQUIRED";
  const recheckDisabled = !available || busy || workerState !== "AUTH_REQUIRED";
  const captureEnabled = available && !busy && workerState === "READY";
  const folderDisabled = !available || busy || state.workerCaptureResult?.ok !== true;
  const toolbarKey = `${available ? "electron" : "pwa"}:${workerState || "none"}`;
  if (toolbarKey !== lastWorkerToolbarKey) closeWorkerMenu();
  lastWorkerToolbarKey = toolbarKey;
  syncWorkerActionVisibility(connectPrimary);
  const recheck = $("btnWorkerRecheckLogin");
  if (recheck) recheck.hidden = !recheckVisible;
  const statusEl = $("workerBrowserStatus");
  if (statusEl) statusEl.textContent = toolbarWorkerStatusText();
  const trigger = $("btnWorkerMenuTrigger");
  if (trigger) trigger.dataset.tone = workerStatusTone(workerState, available);
  setMenuActionDisabled($("btnWorkerConnect"), connectDisabled);
  setMenuActionDisabled($("btnWorkerRecheckLogin"), recheckDisabled);
  setMenuActionDisabled($("btnWorkerStop"), stopDisabled);
  setMenuActionDisabled($("btnWorkerCapture"), !captureEnabled);
  setMenuActionDisabled($("btnWorkerOpenCapture"), folderDisabled);
  const captureBtn = $("btnWorkerCapture");
  if (captureBtn) {
    const title = captureToolbarTitle();
    captureBtn.title = title;
    captureBtn.setAttribute("aria-label", title);
  }
  applyPermissionUi();
  ["btnWorkerConnect", "btnWorkerRecheckLogin", "btnWorkerStop", "btnWorkerCapture", "btnWorkerOpenCapture"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (el.disabled) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  });
  if (workerMenuOpen) positionWorkerMenu();
}

function refreshReadinessIfActive() {
  if (state.tab === "readiness" && state.selectedProductId) renderReadiness();
}

const QC_PREP_DATE_BASIS = "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN";
const QC_PREP_CANONICAL_REPORT_FILENAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const QC_PREP_OTHER_TEXT_RE = /^[a-zA-Z0-9()-_ .]*$/;
const QC_PREP_BATCH_TEXT_RE = /^[A-Za-z0-9./_-]+(,[A-Za-z0-9./_-]+)*$/;
const QC_PREP_REASON_LABELS = {
  PROTOCOL_REQUIRED: "Testing protocol is required.",
  PROTOCOL_INVALID: "Testing protocol is not an active QC protocol.",
  OTHER_PROTOCOL_TEXT_REQUIRED: "Describe the other testing protocol.",
  OTHER_PROTOCOL_TEXT_UNEXPECTED: "Other protocol text is only used when the protocol is Others.",
  STUDY_START_DATE_REQUIRED_OR_INVALID: "Study start date must be YYYY-MM-DD.",
  STUDY_END_DATE_REQUIRED_OR_INVALID: "Study end date must be YYYY-MM-DD.",
  REPORT_DATE_REQUIRED_OR_INVALID: "Report date must be YYYY-MM-DD.",
  STUDY_START_DATE_INVALID: "Study start date is not a real calendar date.",
  STUDY_END_DATE_INVALID: "Study end date is not a real calendar date.",
  REPORT_DATE_INVALID: "Report date is not a real calendar date.",
  STUDY_DATE_ORDER_INVALID: "Study end date is before the study start date.",
  REPORT_DATE_BEFORE_STUDY_START: "Report date is before the study start date.",
  CROSS_SECTIONAL_DATE_BASIS_REQUIRED: "Choose the operator-reviewed cross-sectional date basis.",
  MANUAL_DATE_EVIDENCE_REQUIRED: "Date evidence note is required.",
  REPORT_DATE_CONFIRMATION_REQUIRED: "Report-date evidence note is required.",
  SHELF_LIFE_REQUIRED: "Shelf life months must be an integer from 1 to 9999.",
  BATCHES_REQUIRED: "At least one batch number is required.",
  BATCH_NUMBER_REQUIRED: "Each batch needs a batch number.",
  DUPLICATE_BATCH_NUMBER: "Batch numbers must be unique.",
  BATCH_FORMAT_INVALID: "Batch numbers must be comma-separated, with no spaces or duplicates, and 2–256 characters.",
  QC_MODE_REQUIRED: "Choose IN or OUT laboratory status.",
  SOURCE_REPORT_ISSUER_REQUIRED: "OUT reports need the source report issuer.",
  PORTAL_LABORATORY_CANDIDATE_REQUIRED: "Choose a portal laboratory when laboratory status is OUT.",
  PORTAL_LABORATORY_CANDIDATE_UNKNOWN: "Portal laboratory must match a name from the portal laboratory list.",
  REPORT_FILENAME_REQUIRED: "Report filename is required.",
  REPORT_FILENAME_NONCANONICAL: "Report filename must be the canonical Product 262 report name.",
  OTHER_PROTOCOL_TEXT_INVALID: "Other testing protocol text must be 1–125 characters and use only the portal's accepted characters.",
  STUDY_END_NOT_AFTER_START: "Study end date must be after the study start date.",
  REPORT_DATE_BEFORE_STUDY_END: "Report date must be on or after the study end date.",
  REPORT_SHA256_REQUIRED: "Claimed SHA-256 must be 64 lowercase hex characters.",
  REPORT_EVIDENCE_REQUIRED: "Report evidence note is required.",
  PAYLOAD_NOT_OBJECT: "The draft is not a valid form.",
};

function emptyQcPrepForm() {
  return {
    testing_protocol_term_id: "",
    other_testing_protocol_text: "",
    study_start_date: "",
    study_end_date: "",
    date_basis: "",
    date_evidence_note: "",
    shelf_life_months: "",
    batches: "",
    report_date: "",
    report_date_evidence_note: "",
    quality_control_mode: "",
    source_report_issuer: "",
    source_report_approval_no: "",
    portal_laboratory_candidate: "",
    report_filename: "",
    report_sha256: "",
    report_evidence_note: "",
  };
}

function qcPrepForm() {
  if (!state.qcPrepForm) state.qcPrepForm = emptyQcPrepForm();
  return state.qcPrepForm;
}

function qcPrepFormFromPayload(payload) {
  const form = emptyQcPrepForm();
  const src = payload && typeof payload === "object" ? payload : {};
  if (src.testing_protocol_term_id != null && String(src.testing_protocol_term_id).trim()) {
    form.testing_protocol_term_id = String(src.testing_protocol_term_id).trim();
  }
  for (const key of [
    "other_testing_protocol_text",
    "study_start_date",
    "study_end_date",
    "date_basis",
    "date_evidence_note",
    "report_date",
    "report_date_evidence_note",
    "quality_control_mode",
    "source_report_issuer",
    "source_report_approval_no",
    "report_filename",
    "report_sha256",
    "report_evidence_note",
  ]) {
    if (src[key] != null && String(src[key]).trim()) form[key] = String(src[key]);
  }
  if (typeof src.portal_laboratory_candidate === "string" && src.portal_laboratory_candidate.length > 0) {
    form.portal_laboratory_candidate = src.portal_laboratory_candidate;
  }
  if (src.shelf_life_months != null && String(src.shelf_life_months).trim()) {
    form.shelf_life_months = String(src.shelf_life_months);
  }
  if (Array.isArray(src.batches) && src.batches.length) {
    form.batches = src.batches.map((item) => String(item?.batch_no ?? "")).join(",");
  }
  return form;
}

function qcPrepFmtDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function qcPrepGeneratedNotes(form, options) {
  const list = Array.isArray(options) ? options : [];
  const selected = list.find((item) => String(item?.term_id) === String(form?.testing_protocol_term_id || ""));
  const protocolCode = selected?.code || "";
  const protocolLabel = selected?.label || "";
  const otherText = String(form?.other_testing_protocol_text || "").trim();
  const protocolText = protocolCode === "OTHER"
    ? (protocolLabel && otherText ? `${protocolLabel} – ${otherText}` : "")
    : protocolLabel;
  const start = String(form?.study_start_date || "");
  const end = String(form?.study_end_date || "");
  const report = String(form?.report_date || "");
  const batchText = String(form?.batches || "");
  const batchesOk = batchText !== "" && !qcPrepBatchTextInvalid(batchText);
  const dateOk = (value) => value !== "" && !qcPrepDateYearImplausible(value);
  const batchList = batchText.split(",").join(", ");
  const issuer = String(form?.source_report_issuer || "").trim();
  const sha = String(form?.report_sha256 || "").trim();
  const reportName = String(form?.report_filename || "");
  const filename = /^EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V[0-9]{2}\.pdf$/.test(reportName)
    ? reportName
    : "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
  const dateNote = dateOk(start) && dateOk(end) && batchesOk && protocolText
    ? `Study period ${qcPrepFmtDate(start)} to ${qcPrepFmtDate(end)} entered manually by the operator on the operator-reviewed cross-sectional manufacturing-span basis for batch(es) ${batchList}; testing protocol: ${protocolText}. Dates are not derived automatically.`
    : "";
  const reportDateNote = dateOk(report) && issuer
    ? `Report date ${qcPrepFmtDate(report)} entered manually as printed on the QC test report issued by ${issuer}.`
    : "";
  const evidenceNote = issuer && dateOk(report) && batchesOk
    ? `QC test report issued by ${issuer}, dated ${qcPrepFmtDate(report)}, covering batch(es) ${batchList}; canonical file ${filename}; SHA-256 ${sha || "to be computed at upload (D2)"}; report bytes not yet verified (B2).`
    : "";
  return {
    date_evidence_note: dateNote,
    report_date_evidence_note: reportDateNote,
    report_evidence_note: evidenceNote,
  };
}

function qcPrepNoteOverridesForLoad(form, options) {
  const generated = qcPrepGeneratedNotes(form, options);
  const overrides = {};
  for (const key of ["date_evidence_note", "report_date_evidence_note", "report_evidence_note"]) {
    const saved = String(form?.[key] || "");
    overrides[key] = saved !== "" && saved !== generated[key];
  }
  return overrides;
}

function qcPrepDisplayNotes(form, options, overrides) {
  const generated = qcPrepGeneratedNotes(form, options);
  const flags = overrides || {};
  const displayed = {};
  for (const key of ["date_evidence_note", "report_date_evidence_note", "report_evidence_note"]) {
    displayed[key] = flags[key] === true ? String(form?.[key] || "") : generated[key];
  }
  return displayed;
}

function qcPrepApplyGeneratedNotes(form = qcPrepForm()) {
  const displayed = qcPrepDisplayNotes(form, state.qcPrepOptions || [], state.qcPrepNoteOverrides || {});
  form.date_evidence_note = displayed.date_evidence_note;
  form.report_date_evidence_note = displayed.report_date_evidence_note;
  form.report_evidence_note = displayed.report_evidence_note;
  return displayed;
}

function qcPrepSyncNoteViews() {
  const form = qcPrepForm();
  const pairs = [
    ["date_evidence_note", "qcPrepDateNoteView"],
    ["report_date_evidence_note", "qcPrepReportDateNoteView"],
    ["report_evidence_note", "qcPrepEvidenceNoteView"],
  ];
  for (const [key, id] of pairs) {
    const view = document.getElementById(id);
    if (view) view.textContent = form[key] || "";
  }
}

function qcPrepProtocolCode(form) {
  const match = state.qcPrepOptions.find((item) => String(item.term_id) === String(form.testing_protocol_term_id));
  return match?.code || "";
}

function qcPrepPayloadFromForm(form) {
  const payload = {};
  if (String(form.testing_protocol_term_id || "").trim()) {
    payload.testing_protocol_term_id = String(form.testing_protocol_term_id).trim();
  }
  const other = String(form.other_testing_protocol_text || "").trim();
  if (other && qcPrepProtocolCode(form) === "OTHER") payload.other_testing_protocol_text = other;
  for (const key of ["study_start_date", "study_end_date", "report_date"]) {
    const value = String(form[key] || "").trim();
    if (value) payload[key] = value;
  }
  if (form.date_basis === QC_PREP_DATE_BASIS) payload.date_basis = QC_PREP_DATE_BASIS;
  for (const key of [
    "date_evidence_note",
    "report_date_evidence_note",
    "source_report_issuer",
    "source_report_approval_no",
    "report_evidence_note",
  ]) {
    const value = String(form[key] || "").trim();
    if (value) payload[key] = value;
  }
  const laboratory = String(form.portal_laboratory_candidate ?? "");
  if (laboratory.length > 0) payload.portal_laboratory_candidate = laboratory;
  payload.report_filename = QC_PREP_CANONICAL_REPORT_FILENAME;
  if (/^EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V[0-9]{2}\.pdf$/.test(String(form.report_filename || ""))) {
    payload.report_filename = String(form.report_filename);
  }
  if (String(form.shelf_life_months || "").trim()) payload.shelf_life_months = String(form.shelf_life_months).trim();
  const batchText = String(form.batches ?? "");
  if (batchText.length > 0) {
    payload.batches = batchText.split(",").map((batch_no) => ({ batch_no }));
  }
  if (form.quality_control_mode === "IN" || form.quality_control_mode === "OUT") {
    payload.quality_control_mode = form.quality_control_mode;
  }
  if (String(form.report_sha256 || "").trim()) payload.report_sha256 = String(form.report_sha256).trim();
  return payload;
}

function qcPrepBatchTextInvalid(text) {
  const value = String(text ?? "");
  if (!value) return false;
  const items = value.split(",");
  return value.length < 2
    || value.length > 256
    || !QC_PREP_BATCH_TEXT_RE.test(value)
    || new Set(items).size !== items.length;
}

function qcPrepOtherTextInvalid(text) {
  const value = String(text ?? "").trim();
  if (!value) return false;
  return value.length > 125 || !/\S/.test(value) || !QC_PREP_OTHER_TEXT_RE.test(value);
}

function qcPrepDateYearImplausible(value, now = new Date()) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const year = Number(text.slice(0, 4));
  return year < 1900 || year > now.getUTCFullYear() + 1;
}

function qcPrepDateOrderMessages(start, end, report, now = new Date()) {
  const studyStart = String(start || "");
  const studyEnd = String(end || "");
  const reportDate = String(report || "");
  const incomplete = (value) => qcPrepDateYearImplausible(value, now);
  const ready = (value) => Boolean(value) && !incomplete(value);
  return {
    end: ready(studyStart) && ready(studyEnd) && studyEnd <= studyStart
      ? "Study end date must be after the study start date."
      : "",
    report: ready(studyEnd) && ready(reportDate) && reportDate < studyEnd
      ? "Report date must be on or after the study end date."
      : "",
    beforeStart: ready(studyStart) && ready(reportDate) && reportDate < studyStart,
  };
}

function qcPrepLocalHints(form, now = new Date()) {
  const hints = [];
  const start = String(form.study_start_date || "");
  const end = String(form.study_end_date || "");
  const report = String(form.report_date || "");
  const dates = qcPrepDateOrderMessages(start, end, report, now);
  if (dates.end) hints.push("STUDY_END_NOT_AFTER_START");
  if (dates.report) hints.push("REPORT_DATE_BEFORE_STUDY_END");
  if (dates.beforeStart) hints.push("REPORT_DATE_BEFORE_STUDY_START");
  if (qcPrepDateYearImplausible(start, now)) hints.push("STUDY_START_DATE_REQUIRED_OR_INVALID");
  if (qcPrepDateYearImplausible(end, now)) hints.push("STUDY_END_DATE_REQUIRED_OR_INVALID");
  if (qcPrepDateYearImplausible(report, now)) hints.push("REPORT_DATE_REQUIRED_OR_INVALID");
  if (qcPrepProtocolCode(form) === "OTHER") {
    const other = String(form.other_testing_protocol_text || "");
    if (!other.trim()) hints.push("OTHER_PROTOCOL_TEXT_REQUIRED");
    else if (qcPrepOtherTextInvalid(other)) hints.push("OTHER_PROTOCOL_TEXT_INVALID");
  }
  if (qcPrepBatchTextInvalid(form.batches)) hints.push("BATCH_FORMAT_INVALID");
  const shelf = String(form.shelf_life_months || "").trim();
  if (shelf && (!/^[0-9]{1,4}$/.test(shelf) || Number(shelf) < 1)) hints.push("SHELF_LIFE_REQUIRED");
  if (form.quality_control_mode === "OUT" && !String(form.source_report_issuer || "").trim()) {
    hints.push("SOURCE_REPORT_ISSUER_REQUIRED");
  }
  if (form.quality_control_mode === "OUT" && !String(form.portal_laboratory_candidate ?? "").length) {
    hints.push("PORTAL_LABORATORY_CANDIDATE_REQUIRED");
  } else if (String(form.portal_laboratory_candidate ?? "").length) {
    const known = (state.qcPrepLabs || []).some((item) => item.label === form.portal_laboratory_candidate);
    if (!state.qcPrepLabsUnavailable && !known) hints.push("PORTAL_LABORATORY_CANDIDATE_UNKNOWN");
  }
  return hints;
}

function qcPrepReasonText(code, now = new Date()) {
  const maxYear = now.getUTCFullYear() + 1;
  if (code === "STUDY_START_DATE_REQUIRED_OR_INVALID") {
    return `Study start date must be a valid date (year 1900–${maxYear}).`;
  }
  if (code === "STUDY_END_DATE_REQUIRED_OR_INVALID") {
    return `Study end date must be a valid date (year 1900–${maxYear}).`;
  }
  if (code === "REPORT_DATE_REQUIRED_OR_INVALID") {
    return `Report date must be a valid date (year 1900–${maxYear}).`;
  }
  return QC_PREP_REASON_LABELS[code] || String(code);
}

function updateQcPrepDateMessages(form = qcPrepForm()) {
  const messages = qcPrepDateOrderMessages(form.study_start_date, form.study_end_date, form.report_date);
  const endEl = document.getElementById("qcPrepDateOrder");
  const reportEl = document.getElementById("qcPrepReportDateOrder");
  if (endEl) {
    endEl.textContent = messages.end;
    endEl.hidden = !messages.end;
  }
  if (reportEl) {
    reportEl.textContent = messages.report;
    reportEl.hidden = !messages.report;
  }
  const checks = document.getElementById("qcPrepFormChecks");
  if (!checks) return;
  const hints = [...new Set(qcPrepLocalHints(form))].map((code) => qcPrepReasonText(code));
  checks.replaceChildren();
  if (!hints.length) {
    const note = document.createElement("p");
    note.className = "muted-note";
    note.textContent = "None";
    checks.append(note);
    return;
  }
  const list = document.createElement("ul");
  list.className = "progress-list";
  for (const hint of hints) {
    const item = document.createElement("li");
    item.textContent = hint;
    list.append(item);
  }
  checks.append(list);
}

function resetQcPreparationWorkspace() {
  state.qcPrepRequest += 1;
  state.qcPrepLoading = false;
  state.qcPrepLoadedFor = null;
  state.qcPrepOptions = [];
  state.qcPrepLabs = [];
  state.qcPrepLabsUnavailable = false;
  state.qcPrepDefaultsApplied = false;
  state.qcPrepFieldsComplete = false;
  state.qcPrepServer = null;
  state.qcPrepAmbiguous = false;
  state.qcPrepForm = emptyQcPrepForm();
  state.qcPrepDirty = false;
  state.qcPrepNotice = "";
  state.qcPrepPreserveNotice = "";
  state.qcPrepReloadFeedback = false;
  state.qcPrepReasons = [];
  state.qcPrepNoteOverrides = {
    date_evidence_note: false,
    report_date_evidence_note: false,
    report_evidence_note: false,
  };
  state.qcPrepOpen = true;
  state.qcReportRequest += 1;
  state.qcReportUploadRequest += 1;
  state.qcReportLoading = false;
  state.qcReportLoadedFor = null;
  state.qcReports = [];
  state.qcReportNotice = "";
  state.qcReportWarning = "";
  state.qcReportFile = null;
  state.qcReportFileProductId = null;
  state.qcReportFilePreparationId = null;
  state.qcReportSha = "";
  state.qcReportFileError = "";
  state.qcReportLastSize = null;
  state.qcReportVerifyRequest += 1;
  state.qcReportVerifying = false;
  state.qcReportConfirmOpen = false;
  state.qcReportByteResult = null;
  state.qcReportVerifyError = "";
  state.qcReportVerifyCode = "";
  state.qcReportOfferNewVersion = false;
  state.qcFactScope = "";
  state.qcFactRows = null;
  state.qcFactAttest = false;
  state.qcFactNotice = "";
  state.qcFactHighlights = [];
  state.qcSourceVerifyRunning = false;
  state.qcSourceConfirmOpen = false;
  state.qcReopenRunning = false;
  state.qcEvidenceRecheck = null;
  state.qcEvidenceRequest += 1;
  state.qcEvidenceLoadedFor = null;
  state.qcEvidenceLoading = false;
  state.qcReadiness = null;
  state.qcReadinessRequest += 1;
  state.qcReadinessLoadedFor = null;
  state.qcReadinessLoading = false;
  state.qcReadinessNotice = "";
  state.qcLabDraftScope = "";
  state.qcLabDocumentReference = "";
  state.qcLabRationale = "";
  state.qcLabAttest = false;
  state.qcLabDraftSeeded = false;
  state.qcFactAcceptScope = "";
  state.qcFactAcceptDrafts = null;
  state.qcGovernanceRunning = false;
  state.qcGovernanceConfirmOpen = false;
  state.qcFactCorrectScope = "";
  state.qcFactCorrectDrafts = null;
  state.qcFactCorrectOpen = "";
  state.qcFactCorrectNotice = "";
  state.qcMappingScope = "";
  state.qcMappingReason = "";
  state.qcMappingAttest = false;
  state.qcMappingSeeded = false;
  state.qcMappingNotice = "";
  state.qcFillRequest += 1;
  state.qcFillPreflight = null;
  state.qcFillLoadedFor = null;
  state.qcFillLoading = false;
  state.qcFillNotice = "";
  state.qcFillInspectOk = false;
  state.qcFillChosenReportName = "";
  state.qcFillInspectFileResult = null;
  state.qcFillDerivedNoteTouched = false;
  state.qcFillCheckedReport = null;
  state.qcFillDryRun = null;
}

function qcPrepCurrent() {
  return state.qcPrepRequest;
}

function qcPrepFormIsEmpty(form) {
  if (!form) return true;
  const empty = emptyQcPrepForm();
  return Object.keys(empty).every((key) => form[key] === empty[key]);
}

function applyQcPreparationDefaults(form, context) {
  const dateBasis = "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN";
  const otherText = "Cross Sectional Approach (API Vol VIII Page No:226)";
  const laboratoryName = "HARIDEV FORMULATIONS";
  const productId = Number(context?.productId);
  const eligible = productId === 262
    && context?.hasPreparation !== true
    && context?.dirty !== true
    && context?.formEmpty === true;
  if (!eligible) return { form, applied: false, save: false };
  const protocolOptions = Array.isArray(context?.protocolOptions) ? context.protocolOptions : [];
  const other = protocolOptions.find((item) => item?.code === "OTHER");
  const laboratoryOptions = Array.isArray(context?.laboratoryOptions) ? context.laboratoryOptions : [];
  const haridev = laboratoryOptions.find((item) => item?.label === laboratoryName);
  return {
    applied: true,
    save: false,
    form: {
      ...form,
      testing_protocol_term_id: other ? String(other.term_id) : "",
      other_testing_protocol_text: otherText,
      date_basis: dateBasis,
      shelf_life_months: "36",
      quality_control_mode: "OUT",
      portal_laboratory_candidate: haridev ? haridev.label : "",
      study_start_date: "",
      study_end_date: "",
      report_date: "",
      date_evidence_note: "",
      report_date_evidence_note: "",
      source_report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
      source_report_approval_no: "",
      batches: "",
      report_sha256: "",
      report_evidence_note: "",
    },
  };
}

function qcPrepStatusText(server, loading) {
  if (server) {
    const status = String(server.preparation_status ?? "").split("READY").join("");
    const verifiedAt = String(server.verified_at || "not verified").split("READY").join("");
    return `Status ${status}, row version ${server.row_version}, verified at ${verifiedAt}.`;
  }
  if (loading) return "Loading QC preparation.";
  return "No QC preparation saved yet.";
}

function qcPrepWorkspaceHtml(model) {
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const disabled = model.disabled || "";
  const reasons = Array.isArray(model.reasons) ? model.reasons : [];
  const serverReasons = [...new Set(Array.isArray(model.serverReasons) ? model.serverReasons : [])];
  const localHints = [...new Set(Array.isArray(model.localHints) ? model.localHints : [])];
  const reasonItems = (items) => (items.length
    ? `<ul class="progress-list">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
    : `<p class="muted-note">None</p>`);
  const reasonList = reasons.length
    ? `<ul class="progress-list">${reasons.map((code) => `<li>${esc(code)}</li>`).join("")}</ul>`
    : model.fieldsComplete
      ? `<p class="muted-note">Fields complete (draft only)</p>`
      : `<p class="muted-note">No server review reasons yet.</p>`;
  const maxQcDateYear = new Date().getUTCFullYear() + 1;
  const dateIncomplete = (value) => {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const year = Number(text.slice(0, 4));
    return year < 1900 || year > maxQcDateYear;
  };
  const studyEndOrder = model.studyStart && model.studyEnd
    && !dateIncomplete(model.studyStart) && !dateIncomplete(model.studyEnd)
    && model.studyEnd <= model.studyStart
    ? "Study end date must be after the study start date."
    : "";
  const reportDateOrder = model.studyEnd && model.reportDate
    && !dateIncomplete(model.studyEnd) && !dateIncomplete(model.reportDate)
    && model.reportDate < model.studyEnd
    ? "Report date must be on or after the study end date."
    : "";
  const batchFormatMessage = "Batch numbers must be comma-separated, with no spaces or duplicates, and 2–256 characters.";
  const batchValue = String(model.batches ?? "");
  const batchItems = batchValue.split(",");
  const batchFormatInvalid = batchValue.length > 0 && (
    batchValue.length < 2
    || batchValue.length > 256
    || !/^[A-Za-z0-9./_-]+(,[A-Za-z0-9./_-]+)*$/.test(batchValue)
    || new Set(batchItems).size !== batchItems.length
  );
  const formChecks = batchFormatInvalid && !localHints.includes(batchFormatMessage)
    ? [...localHints, batchFormatMessage]
    : localHints;
  const byteCheck = model.byteCheck === "verified" || model.byteCheck === "mismatch" ? model.byteCheck : "pending";
  const b1Text = model.reportRegistered && model.reportVersion
    ? `B1: Report registered (V${model.reportVersion})`
    : "B1: Report registered";
  const b2Text = `B2: Server byte check: ${byteCheck}`;
  const checklist = [
    ["C2 — Lab report PDF uploaded (PDF, ≤ 2 MB)", model.reportRegistered === true, false],
    [b1Text, false, true],
    [b2Text, false, true],
    ["B3 — Evidence governance accepted", false, false],
    ["B4 — QC portal readiness confirmed", false, false],
    ["Portal entry (manual, later)", false, false],
  ].map(([item, done, plain]) => (
    plain
      ? `<li>${esc(item)}</li>`
      : done
        ? `<li>${esc(item)}: done (registered)</li>`
        : `<li>${esc(item)} — not done</li>`
  )).join("");
  const labs = Array.isArray(model.labs) ? model.labs : [];
  const selectedLab = labs.find((item) => item.label === model.lab);
  const labMissing = model.lab && !labs.some((item) => item.label === model.lab);
  const protocolOptions = Array.isArray(model.protocolOptions) ? model.protocolOptions : [];
  const noteOverrides = model.noteOverrides || {};
  const noteBlock = (label, key, viewId, editId, textareaId, text) => {
    const editing = noteOverrides[key] === true;
    const box = `<label class="qc-prep-block"><input id="${editId}" type="checkbox" data-qc-note="${key}"${editing ? " checked" : ""}${disabled}> Edit note</label>`;
    if (editing) {
      return `<div class="form-field form-span-2 qc-prep-block"><span class="meta-label">${esc(label)}</span>${box}<textarea id="${textareaId}" class="qc-prep-block"${disabled}>${esc(text)}</textarea></div>`;
    }
    return `<div class="form-field form-span-2 qc-prep-block"><span class="meta-label">${esc(label)}</span>${box}<p class="muted-note qc-prep-block" id="${viewId}">${esc(text)}</p></div>`;
  };
  return `
    <section class="section-card qc-prep-workspace" id="qcPreparationWorkspace">
      <h3 class="section-title">QC Register</h3>
      <p class="muted-note">${esc(model.status)}</p>
      ${model.verified ? `<p class="muted-note">Verified — editing is not available in C1.</p>` : ""}
      <p class="muted-note">Reference for Product 262: the current report issuer appears to be NUPAL; Haridev Formulations is a possible portal laboratory candidate. Neither is saved or verified automatically.</p>
      <p class="muted-note">PDF bytes are not uploaded or verified. QC portal readiness remains blocked.</p>
      ${model.defaultsNote ? `<p class="muted-note">Defaults filled — review every value before saving.</p>` : ""}
      ${model.labsUnavailable ? `<p class="muted-note">Laboratory list unavailable</p>` : ""}
      ${model.notice ? `<p class="muted-note" id="qcPrepNotice">${esc(model.notice)}</p>` : `<p class="muted-note" id="qcPrepNotice"></p>`}
      <section class="section-card">
        <h4 class="section-title">Study facts (sent to portal)</h4>
        <div class="form-grid">
          <label class="form-field">Testing protocol
            <select id="qcPrepProtocol"${disabled}>
              <option value="">Select protocol</option>
              ${model.savedProtocolMissing ? `<option value="${esc(model.protocolId)}" selected>Saved protocol term</option>` : ""}
              ${protocolOptions.map((item) => `<option value="${esc(item.term_id)}"${String(item.term_id) === String(model.protocolId) ? " selected" : ""}>${esc(item.label)}</option>`).join("")}
            </select>
          </label>
          ${model.showOther ? `<label class="form-field form-span-2">Other testing protocol
            <input id="qcPrepOther" value="${esc(model.otherText)}"${disabled}>
          </label>` : ""}
          <label class="form-field">Study start date
            <input id="qcPrepStart" type="date" value="${esc(model.studyStart)}"${disabled}>
          </label>
          <label class="form-field">Study end date
            <input id="qcPrepEnd" type="date" value="${esc(model.studyEnd)}"${disabled}>
          </label>
          <p class="muted-note" id="qcPrepDateOrder"${studyEndOrder ? "" : " hidden"}>${esc(studyEndOrder)}</p>
          <label class="form-field">Report date
            <input id="qcPrepReportDate" type="date" value="${esc(model.reportDate)}"${disabled}>
          </label>
          <p class="muted-note" id="qcPrepReportDateOrder"${reportDateOrder ? "" : " hidden"}>${esc(reportDateOrder)}</p>
          <label class="form-field">Date basis
            <select id="qcPrepDateBasis"${disabled}>
              <option value="">Blank</option>
              <option value="${esc(model.dateBasis)}"${model.dateBasisSelected ? " selected" : ""}>Operator-reviewed cross-sectional manufacturing span</option>
            </select>
          </label>
          <label class="form-field">Shelf life months
            <input id="qcPrepShelf" inputmode="numeric" value="${esc(model.shelf)}"${disabled}>
          </label>
          <label class="form-field form-span-2">Batch numbers (comma-separated, no spaces, e.g. A101,A102)
            <input id="qcPrepBatches" value="${esc(model.batches)}"${disabled}>
          </label>
          ${batchFormatInvalid ? `<p class="muted-note" id="qcPrepBatchFormat">${esc(batchFormatMessage)}</p>` : ""}
          <fieldset class="form-field">
            <legend class="meta-label">Laboratory status</legend>
            <label><input id="qcPrepModeIn" type="radio" name="qcPrepMode" value="IN"${model.mode === "IN" ? " checked" : ""}${disabled}> IN</label>
            <label><input id="qcPrepModeOut" type="radio" name="qcPrepMode" value="OUT"${model.mode === "OUT" ? " checked" : ""}${disabled}> OUT</label>
          </fieldset>
          <label class="form-field form-span-2">Portal laboratory
            <select id="qcPrepPortalLab" class="form-span-2 qc-prep-lab-select"${disabled}>
              <option value="">Select laboratory</option>
              ${labMissing ? `<option value="${esc(model.lab)}" selected>${esc(model.lab)}</option>` : ""}
              ${labs.map((item) => `<option value="${esc(item.label)}"${item.label === model.lab ? " selected" : ""}>${esc(item.label)}</option>`).join("")}
            </select>
          </label>
          ${selectedLab ? `<p class="muted-note qc-prep-block">${esc(selectedLab.label)} portal id ${esc(selectedLab.external_id)}</p>` : ""}
        </div>
      </section>
      <section class="section-card">
        <h4 class="section-title">Evidence &amp; notes (not sent to portal)</h4>
        <div class="form-grid">
          <label class="form-field">Source report issuer
            <input id="qcPrepIssuer" value="${esc(model.issuer)}"${disabled}>
          </label>
          <label class="form-field">Issuing lab Form-48 approval no. (evidence only; not sent to portal)
            <input id="qcPrepApproval" value="${esc(model.approval)}"${disabled}>
          </label>
          ${noteBlock("Date evidence note", "date_evidence_note", "qcPrepDateNoteView", "qcPrepEditDateNote", "qcPrepDateNote", model.dateNote)}
          ${noteBlock("Report-date evidence note", "report_date_evidence_note", "qcPrepReportDateNoteView", "qcPrepEditReportDateNote", "qcPrepReportDateNote", model.reportDateNote)}
          ${noteBlock("Report evidence note", "report_evidence_note", "qcPrepEvidenceNoteView", "qcPrepEditEvidenceNote", "qcPrepEvidenceNote", model.evidence)}
        </div>
      </section>
      <section class="section-card">
        <h4 class="section-title">Test report</h4>
        <p class="muted-note qc-prep-block" id="qcPrepFileName">File name: EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf</p>
        <button type="button" class="icon-btn with-label" id="btnQcPrepCopyName">Copy name</button>
        <p class="muted-note qc-prep-block" id="qcPrepShaView">SHA-256: ${model.sha ? esc(model.sha) : "computed at upload (D2)"}</p>
        ${model.reportRegistered ? `<p class="muted-note qc-prep-block" id="qcPrepRegisteredReport">Test report: V${esc(model.reportVersion)} registered \u2013 ${esc(model.reportFileName)}; SHA-256 ${esc(model.sha)}. ${esc(b1Text)}. ${esc(b2Text)}</p><button type="button" class="icon-btn with-label" id="btnOpenEvidenceFromQc">Open Evidence tab</button>` : `<p class="muted-note qc-prep-block" id="qcPrepRegisteredReport">No report uploaded. Upload in the Evidence tab.</p>`}
        <p class="muted-note qc-prep-block">Portal upload limit: PDF ≤ 2 MB. Upload is in the Evidence tab.</p>
      </section>
      ${reasonList}
      <ul class="progress-list" id="qcPrepChecklist">${checklist}</ul>
      <div id="qcPrepResult" class="muted-note" role="status" aria-live="polite">
        ${model.notice ? `<p>${esc(model.notice)}</p>` : ""}
        <h4 class="meta-label">Server review</h4>
        ${reasonItems(serverReasons)}
        <h4 class="meta-label">Form checks</h4>
        <div id="qcPrepFormChecks">${reasonItems(formChecks)}</div>
      </div>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnQcPrepReview"${model.reviewDisabled ? " disabled" : ""}>Check (server review)</button>
        <button type="button" class="icon-btn with-label" id="btnQcPrepSave" data-edit-action="true"${model.saveDisabled ? " disabled" : ""}>Save for review</button>
        <button type="button" class="icon-btn with-label" id="btnQcPrepReload"${model.reloadDisabled ? " disabled" : ""}>Reload server copy</button>
      </div>
    </section>`;
}

async function loadQcPreparationWorkspace(productId, request) {
  try {
    const token = await sessionAccessToken();
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    const options = await loadQcProtocolOptions(productId, token);
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    if (options?.ok === false) {
      state.qcPrepNotice = options.message;
      state.qcPrepLoadedFor = productId;
      if (state.qcPrepReloadFeedback) showToast(String(options.message || "QC preparation workspace failed."), "error");
      return;
    }
    state.qcPrepOptions = Array.isArray(options?.options) ? options.options : [];
    let labsUnavailable = false;
    let labs = [];
    try {
      const listed = await loadQcLaboratoryOptions(productId, token);
      if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
      if (listed?.ok === false) labsUnavailable = true;
      else labs = Array.isArray(listed?.options) ? listed.options : [];
    } catch {
      if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
      labsUnavailable = true;
    }
    state.qcPrepLabsUnavailable = labsUnavailable;
    state.qcPrepLabs = labs;
    const read = await readQcPreparationWorkspace(productId, token);
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    if (read?.ok === false) {
      state.qcPrepNotice = labsUnavailable ? "" : read?.message;
      state.qcPrepLoadedFor = productId;
      if (state.qcPrepReloadFeedback) showToast(String(state.qcPrepNotice || read?.message || "QC preparation workspace failed."), "error");
      return;
    }
    state.qcPrepAmbiguous = read?.ambiguous === true;
    state.qcPrepServer = read?.preparation || null;
    state.qcPrepReasons = Array.isArray(read?.preparation?.review?.reasons) ? read.preparation.review.reasons : [];
    state.qcPrepFieldsComplete = false;
    if (!state.qcPrepDirty) {
      const loadedForm = qcPrepFormFromPayload(read?.preparation?.draft_payload);
      const applied = applyQcPreparationDefaults(loadedForm, {
        productId,
        protocolOptions: state.qcPrepOptions,
        laboratoryOptions: state.qcPrepLabs,
        hasPreparation: Boolean(read?.preparation),
        dirty: false,
        formEmpty: qcPrepFormIsEmpty(loadedForm),
      });
      state.qcPrepForm = applied.form;
      state.qcPrepDefaultsApplied = applied.applied === true;
      state.qcPrepNoteOverrides = read?.preparation
        ? qcPrepNoteOverridesForLoad(applied.form, state.qcPrepOptions)
        : {
          date_evidence_note: false,
          report_date_evidence_note: false,
          report_evidence_note: false,
        };
      qcPrepApplyGeneratedNotes(state.qcPrepForm);
    }
    state.qcPrepLoadedFor = productId;
    if (read?.ambiguous) state.qcPrepNotice = "More than one preparation uses the governed source key. Reload before editing.";
    else if (state.qcPrepReloadFeedback) {
      state.qcPrepNotice = "Server copy reloaded.";
      showToast("Server copy reloaded", "success");
    } else if (state.qcPrepPreserveNotice) {
      state.qcPrepNotice = state.qcPrepPreserveNotice;
    } else state.qcPrepNotice = "";
  } catch (error) {
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    state.qcPrepNotice = userMessageForError(error);
    state.qcPrepLoadedFor = productId;
    if (state.qcPrepReloadFeedback) showToast(state.qcPrepNotice, "error");
  } finally {
    const reloadFeedback = state.qcPrepReloadFeedback === true && request === qcPrepCurrent();
    const preserveNotice = Boolean(state.qcPrepPreserveNotice) && request === qcPrepCurrent();
    if (request === qcPrepCurrent()) {
      state.qcPrepLoading = false;
      state.qcPrepReloadFeedback = false;
      state.qcPrepPreserveNotice = "";
    }
    if (state.selectedProductId === productId) {
      renderQcSurface();
      if (state.tab === "evidence") renderEvidence();
      if (reloadFeedback) revealQcPrepResult("btnQcPrepReload");
      else if (preserveNotice) revealQcPrepResult("btnQcPrepSave");
    }
  }
}

function revealQcPrepResult(focusId) {
  document.getElementById("qcPrepResult")?.scrollIntoView({ block: "nearest" });
  if (focusId) document.getElementById(focusId)?.focus();
}

function reloadQcPreparationWorkspace(options = {}) {
  if (state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  state.qcPrepDirty = false;
  state.qcPrepLoadedFor = null;
  state.qcPrepLoading = true;
  state.qcPrepNotice = options.preserveNotice || "";
  state.qcPrepPreserveNotice = options.preserveNotice || "";
  state.qcPrepReloadFeedback = options.feedback === true;
  renderQcSurface();
  if (options.feedback === true) revealQcPrepResult("btnQcPrepReload");
  const productId = state.selectedProductId;
  const request = ++state.qcPrepRequest;
  void loadQcPreparationWorkspace(productId, request);
}

const QC_SOURCE_FACT_FIELDS = [
  ["study_start_date", "Study start date"],
  ["study_end_date", "Study end date"],
  ["report_date", "Report date"],
  ["testing_protocol", "Testing protocol"],
  ["batches", "Batches"],
  ["shelf_life_months", "Shelf life"],
];

function qcIssuerShortName(issuer) {
  const text = String(issuer || "").trim();
  const match = text.match(/\(([^)]+)\)/);
  if (match && match[1].trim()) return match[1].trim();
  return text.slice(0, 20);
}

function qcFactPreviewValue(key, form, options) {
  if (key === "testing_protocol") {
    const other = String(form?.other_testing_protocol_text || "").trim();
    if (other) return other;
    const match = (options || []).find((item) => String(item.term_id) === String(form?.testing_protocol_term_id));
    return match?.label || "";
  }
  return String(form?.[key] ?? "");
}

const QC_STUDY_START_FALLBACK = "Study period entered by operator on the manufacturing-span basis; not printed in the report";
const QC_FACT_PAGE_HINT = /\b(p\.?|page|pp\.?|sec(tion)?|§|table|annex)\s*\d/i;
const QC_SUGGESTED_FACT_KEYS = ["study_end_date", "report_date", "batches", "shelf_life_months"];

function qcProtocolEvidenceNote(form, options) {
  const protocolSource = String(form?.other_testing_protocol_text || "").trim()
    || String((options || []).find((item) => String(item.term_id) === String(form?.testing_protocol_term_id))?.label || "").trim();
  return `Protocol chosen by operator: ${protocolSource}; not stated in the report`;
}

function qcFactDefaultRows(form, options) {
  const shortName = qcIssuerShortName(form?.source_report_issuer);
  const yesText = `${shortName} report p.1`.replace(/^\s+/, "");
  const dateNote = String(form?.date_evidence_note || "").trim();
  const row = (supported, text) => ({ supported: supported === true, text: String(text || "") });
  return {
    study_start_date: row(false, dateNote.length >= 10 ? dateNote : QC_STUDY_START_FALLBACK),
    study_end_date: row(true, yesText),
    report_date: row(true, yesText),
    testing_protocol: row(false, qcProtocolEvidenceNote(form, options)),
    batches: row(true, yesText),
    shelf_life_months: row(true, yesText),
  };
}

function qcFactRowError(row) {
  const text = String(row?.text || "").trim();
  if (row?.supported === true) return text.length < 5 ? "Enter at least 5 characters for the page or section." : "";
  return text.length < 10 ? "Enter at least 10 characters for the evidence note." : "";
}

function qcFactRowsCurrent() {
  const preparationId = state.qcPrepServer?.preparation_id || "";
  const scope = `${state.selectedProductId || ""}:${preparationId}`;
  if (state.qcFactScope === scope && state.qcFactRows) return state.qcFactRows;
  state.qcFactScope = scope;
  state.qcFactRows = qcFactDefaultRows(qcPrepForm(), state.qcPrepOptions);
  state.qcFactAttest = false;
  state.qcFactHighlights = [];
  return state.qcFactRows;
}

function qcEvidenceReasonText(code) {
  const text = String(code || "");
  if (text === "NOT_SOURCE_VERIFIED") return "Not verified yet";
  if (text === "BINDING_SUPERSEDED") return "Reopened — verify again";
  if (text === "BINDING_STALE_PREPARATION_VERSION" || text === "PAYLOAD_HASH_CHANGED") return "Draft edited after verification";
  if (text === "SUPERSEDED_BY_NEWER_REPORT") return "A newer report version was registered";
  if (text.startsWith("OBJECT_")) return "Stored report changed";
  if (text.startsWith("TUPLE_MISMATCH_")) return "Evidence record mismatch";
  return "Needs re-verify";
}

function qcEvidenceBadge(recheck) {
  const reasons = Array.isArray(recheck?.reasons) ? recheck.reasons.map((reason) => String(reason)) : [];
  const unique = new Set(reasons);
  if (unique.size === 2 && unique.has("NOT_SOURCE_VERIFIED") && unique.has("NO_BINDING")) {
    return { tone: "pending", label: "Not verified yet", detail: "" };
  }
  if (recheck?.valid === true) return { tone: "valid", label: "Evidence valid ✓", detail: "" };
  const detail = reasons.length ? qcEvidenceReasonText(reasons[0]) : "Needs re-verify";
  return { tone: "attention", label: "Needs re-verify", detail };
}

function qcSourceFactsBlockReason(input) {
  if (input?.electron !== true) return "Verify source facts is available only in the SASV Electron app.";
  if (input?.canWrite !== true) return "You need edit permission for e-Aushadhi.";
  if (input?.busy === true) return "Wait for the current action to finish.";
  if (input?.dirty === true) return "Save or reload the QC form first.";
  const status = input?.preparation?.preparation_status || "";
  if (status === "VERIFIED") return "Already verified.";
  if (status !== "REVIEW_REQUIRED") return "Save a QC draft before verifying source facts.";
  if (Array.isArray(input?.serverReasons) && input.serverReasons.length > 0) return "The server review still has items to correct.";
  const report = input?.latestRegistered;
  if (!report || report.integrity_status !== "VERIFIED_BYTES") return "Run 'Check bytes on server' first.";
  const knownSha = String(report.verified_sha256 || input?.verifiedSha || "").trim();
  const draftName = String(input?.reportFilename || "").trim();
  const reportName = String(report.expected_file_name || "").trim();
  const shaDiffers = knownSha !== "" && String(input?.reportSha || "") !== knownSha;
  const nameDiffers = draftName !== "" && reportName !== "" && draftName !== reportName;
  if (shaDiffers || nameDiffers) {
    return "The draft does not match the verified report. Save the draft again from the latest report.";
  }
  return "";
}

function qcSourceFactsModel() {
  const preparation = state.qcPrepServer;
  const form = qcPrepForm();
  const latest = qcRegisteredReport(preparation?.preparation_id);
  const sessionMatches = latest && state.qcReportByteResult
    && String(state.qcReportByteResult.reservation_id) === String(latest.reservation_id);
  const verifiedSha = latest?.verified_sha256 || (sessionMatches ? state.qcReportByteResult.verified_sha256 : "") || "";
  const report = latest ? { ...latest, verified_sha256: verifiedSha || latest.verified_sha256 || "" } : null;
  let blockReason = qcSourceFactsBlockReason({
    electron: workerApiAvailable(),
    canWrite: canWrite(),
    busy: state.busy === true || state.qcSourceVerifyRunning === true,
    dirty: state.qcPrepDirty === true,
    preparation,
    serverReasons: state.qcPrepReasons,
    latestRegistered: report,
    reportSha: form.report_sha256,
    reportFilename: form.report_filename,
    verifiedSha,
  });
  const qcGate = !blockReason && typeof stageGate === "function"
    ? stageGate("qc", preparation?.preparation_id)
    : null;
  if (qcGate) blockReason = qcGate.userMessage;
  const verified = preparation?.preparation_status === "VERIFIED";
  const savedRows = verified ? qcRowsFromFactEvidence(state.qcEvidenceRecheck?.fact_evidence) : null;
  const rows = verified ? savedRows : qcFactRowsCurrent();
  const rowErrors = verified || !rows
    ? {}
    : Object.fromEntries(QC_SOURCE_FACT_FIELDS.map(([key]) => [key, qcFactRowError(rows[key])]));
  const rowsValid = !verified && rows != null && Object.values(rowErrors).every((error) => error === "");
  const version = latest ? String(latest.version_no).padStart(2, "0") : "";
  return {
    blockReason,
    blockCode: qcGate?.code || "",
    enabled: blockReason === "" && verified !== true,
    readOnly: verified === true,
    savedMissing: verified === true && savedRows == null,
    rows,
    rowErrors,
    previews: Object.fromEntries(QC_SOURCE_FACT_FIELDS.map(([key]) => [key, qcFactPreviewValue(key, form, state.qcPrepOptions)])),
    attest: state.qcFactAttest === true,
    canSubmit: blockReason === "" && verified !== true && state.qcFactAttest === true && rowsValid && state.qcSourceConfirmOpen !== true,
    canReopen: verified === true && canWrite() && state.busy !== true && state.qcSourceConfirmOpen !== true && state.qcReopenRunning !== true,
    nextVersion: Number(preparation?.row_version) + 1,
    version,
    sha12: String(form.report_sha256 || "").slice(0, 12),
    notice: state.qcFactNotice,
    highlights: Array.isArray(state.qcFactHighlights) ? state.qcFactHighlights : [],
    badge: qcEvidenceBadge(state.qcEvidenceRecheck),
    running: state.qcSourceVerifyRunning === true,
    reopenRunning: state.qcReopenRunning === true,
  };
}

function qcRowsFromFactEvidence(factEvidence) {
  if (!factEvidence || typeof factEvidence !== "object" || Array.isArray(factEvidence)) return null;
  const rows = {};
  for (const [key] of QC_SOURCE_FACT_FIELDS) {
    const item = factEvidence[key];
    if (!item || typeof item !== "object" || typeof item.supported_by_report !== "boolean") return null;
    rows[key] = item.supported_by_report === true
      ? { supported: true, text: String(item.source_reference || "") }
      : { supported: false, text: String(item.evidence_note || "") };
  }
  return rows;
}

function qcFactPageHintMissing(row) {
  if (row?.supported !== true) return false;
  return !QC_FACT_PAGE_HINT.test(String(row.text || ""));
}

function qcSourceVerifyFactLines(rows) {
  return QC_SOURCE_FACT_FIELDS.map(([key, label]) => {
    const row = rows?.[key] || { supported: false, text: "" };
    const text = String(row.text || "").trim();
    const shown = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    return row.supported === true ? `${label}: Shown — ${shown}` : `${label}: Not shown — note: ${shown}`;
  }).join("\n");
}

function qcFactEvidenceFromRows(rows) {
  const evidence = {};
  for (const [key] of QC_SOURCE_FACT_FIELDS) {
    const row = rows[key] || { supported: false, text: "" };
    const text = String(row.text || "").trim();
    evidence[key] = row.supported === true
      ? { supported_by_report: true, source_reference: text }
      : { supported_by_report: false, evidence_note: text };
  }
  return evidence;
}

function qcSourceFactsCardHtml(model) {
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const badge = model.badge || { tone: "pending", label: "Not verified yet", detail: "" };
  const badgeClass = badge.tone === "valid" ? "ea-autosave is-verified" : "muted-note";
  const badgeStyle = badge.tone === "attention" ? "color:#8a5a00" : "";
  const rows = model.readOnly === true
    ? (model.savedMissing ? "" : QC_SOURCE_FACT_FIELDS.map(([key, label]) => {
      const row = model.rows?.[key] || { supported: false, text: "" };
      return `<div class="form-field form-span-2" data-qc-fact="${esc(key)}">
        <span class="meta-label">${esc(label)}</span>
        <p>Shown in the report: ${row.supported === true ? "Yes" : "No"}</p>
        <p>${esc(row.text || "")}</p>
      </div>`;
    }).join(""))
    : QC_SOURCE_FACT_FIELDS.map(([key, label]) => {
      const row = model.rows?.[key] || { supported: false, text: "" };
      const error = model.rowErrors?.[key] || "";
      const highlighted = (model.highlights || []).includes(key) ? " data-qc-fact-highlight=\"true\"" : "";
      const fieldLabel = row.supported === true ? "Where in the report (page/section)" : "Why this is correct (evidence note)";
      const suggested = QC_SUGGESTED_FACT_KEYS.includes(key) && row.supported === true
        ? `<p class="muted-note">Suggested — confirm against the PDF</p>`
        : "";
      const warning = qcFactPageHintMissing(row)
        ? `<p class="qc-fact-hint" id="qcFactHint-${esc(key)}" style="color:#8a5a00">This does not look like a page or section in the report. If the value is not printed in the report, choose No and write a note.</p>`
        : "";
      return `<div class="form-field form-span-2" data-qc-fact="${esc(key)}"${highlighted}>
      <span class="meta-label">${esc(label)}</span>
      <p class="muted-note">Saved value: ${esc(model.previews?.[key] || "")}</p>
      <label>Shown in the report?
        <select id="qcFactSupported-${esc(key)}" data-qc-fact-key="${esc(key)}" data-qc-fact-role="supported" onwheel="this.blur()"${model.enabled ? "" : " disabled"}>
          <option value="yes"${row.supported === true ? " selected" : ""}>Yes</option>
          <option value="no"${row.supported === true ? "" : " selected"}>No</option>
        </select>
      </label>
      <label>${esc(fieldLabel)}
        <input id="qcFactText-${esc(key)}" data-qc-fact-key="${esc(key)}" data-qc-fact-role="text" value="${esc(row.text || "")}"${model.enabled ? "" : " disabled"}>
      </label>
      ${suggested}
      ${warning}
      ${error ? `<p class="qc-fact-error" id="qcFactError-${esc(key)}" style="color:#9b1c1c">${esc(error)}</p>` : ""}
    </div>`;
    }).join("");
  return `<section class="section-card" id="qcSourceFactsCard">
    <h3 class="section-title">Verify source facts <span id="qcEvidenceBadge" class="${badgeClass}"${badgeStyle ? ` style="${badgeStyle}"` : ""}>${esc(badge.label)}</span></h3>
    ${badge.detail ? `<p class="muted-note" id="qcEvidenceBadgeDetail">${esc(badge.detail)}</p>` : `<p class="muted-note" id="qcEvidenceBadgeDetail"></p>`}
    ${typeof stageSaverHtml === "function" ? stageSaverHtml("qc", state.qcPrepServer?.preparation_id) : ""}
    ${model.blockReason && model.readOnly !== true ? `<p class="disabled-reason" id="qcSourceFactsBlock">${esc(model.blockReason)}</p>` : ""}
    ${model.savedMissing ? `<p id="qcSourceFactsSavedMissing">Saved fact evidence is not available in this view</p>` : ""}
    <div class="form-grid">${rows}</div>
    ${model.readOnly === true ? "" : `<label class="qc-prep-block"><input id="qcFactAttest" type="checkbox"${model.attest ? " checked" : ""}${model.enabled ? "" : " disabled"}> I have reviewed every fact above against the verified QC test report (V${esc(model.version)}).</label>`}
    ${model.notice ? `<p class="muted-note ea-autosave is-failed" id="qcSourceFactsNotice">${esc(model.notice)}</p>` : ""}
    <div class="action-row">
      ${model.readOnly === true ? "" : `<button type="button" class="icon-btn with-label primary" id="btnQcVerifySourceFacts"${model.canSubmit ? "" : " disabled"}${model.blockCode ? ` data-block-code="${esc(model.blockCode)}"` : ""}>${model.running ? "Approving..." : "Approve"}</button>`}
      ${model.canReopen || model.reopenRunning ? `<button type="button" class="icon-btn with-label" id="btnQcReopenSourceFacts"${model.canReopen ? "" : " disabled"}>${model.reopenRunning ? "Reopening..." : "Reopen for re-verification"}</button>` : ""}
    </div>
    ${typeof approvalNoticeHtml === "function" ? approvalNoticeHtml("qc", state.qcPrepServer?.preparation_id) : ""}
  </section>`;
}

function queueQcEvidenceRecheck() {
  if (!workerApiAvailable() || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (access.canView !== true) return;
  const preparationId = state.qcPrepServer?.preparation_id || "";
  if (!preparationId) {
    if (state.qcEvidenceLoadedFor === "") return;
    state.qcEvidenceRecheck = { valid: false, reasons: ["NOT_SOURCE_VERIFIED", "NO_BINDING"] };
    state.qcEvidenceLoadedFor = "";
    return;
  }
  if (state.qcEvidenceLoading === true || state.qcEvidenceLoadedFor === preparationId) return;
  state.qcEvidenceLoading = true;
  const productId = state.selectedProductId;
  const request = ++state.qcEvidenceRequest;
  queueMicrotask(() => {
    void loadQcEvidenceRecheck(productId, preparationId, request);
  });
}

async function loadQcEvidenceRecheck(productId, preparationId, request) {
  try {
    const token = await sessionAccessToken();
    if (request !== state.qcEvidenceRequest || state.selectedProductId !== productId) return;
    const result = await recheckQcEvidence(productId, token, { preparationId });
    if (request !== state.qcEvidenceRequest || state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcEvidenceRecheck = { valid: false, reasons: [result.message || "RECHECK_FAILED"] };
    } else {
      state.qcEvidenceRecheck = result;
    }
    state.qcEvidenceLoadedFor = preparationId;
  } catch (error) {
    if (request !== state.qcEvidenceRequest || state.selectedProductId !== productId) return;
    state.qcEvidenceRecheck = { valid: false, reasons: [userMessageForError(error)] };
    state.qcEvidenceLoadedFor = preparationId;
  } finally {
    if (request === state.qcEvidenceRequest) state.qcEvidenceLoading = false;
    if (state.selectedProductId === productId) {
      if (state.tab === "qc") renderQc();
      else queueQcReadinessLoad();
      if (state.tab === "evidence") renderEvidence();
      if (state.tab === "readiness") renderReadiness();
    }
  }
}

function onQcSourceFactField(event) {
  const target = event.target;
  if (!target?.closest?.("#qcSourceFactsCard")) return;
  const key = target.getAttribute?.("data-qc-fact-key");
  if (target.id === "qcFactAttest") {
    state.qcFactAttest = target.checked === true;
    if (state.tab === "qc") renderQc();
    return;
  }
  if (!key) return;
  if (target.getAttribute("data-qc-fact-role") === "supported" && event.type !== "change") return;
  const rows = qcFactRowsCurrent();
  const current = rows[key] || { supported: false, text: "" };
  if (target.getAttribute("data-qc-fact-role") === "supported") {
    rows[key] = { supported: target.value === "yes", text: current.text };
  } else {
    rows[key] = { supported: current.supported === true, text: target.value };
  }
  state.qcFactRows = rows;
  if (event.type === "change") {
    const focusId = target.id;
    if (state.tab === "qc") {
      renderQc();
      document.getElementById(focusId)?.focus();
    }
  }
}

async function submitQcSourceVerify() {
  if (state.qcSourceVerifyRunning === true || state.qcSourceConfirmOpen === true) return;
  const model = qcSourceFactsModel();
  if (model.canSubmit !== true) return;
  const preparation = state.qcPrepServer;
  const productId = state.selectedProductId;
  const version = model.version;
  state.qcSourceConfirmOpen = true;
  state.qcFactNotice = "";
  try {
    const submittedRows = structuredClone(qcFactRowsCurrent());
    const accepted = await openQcConfirm({
      title: "Approve source facts",
      message: `This marks the QC draft as source-verified against V${version} (SHA-256 ${model.sha12}…). Any later edit will require verifying again. Continue?\n${qcSourceVerifyFactLines(submittedRows)}`,
      okLabel: "Approve",
      returnFocusId: "btnQcVerifySourceFacts",
      idPrefix: "qcSourceVerifyConfirm",
    });
    if (accepted !== true) return;
    if (state.selectedProductId !== productId) return;
    state.qcSourceVerifyRunning = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await verifyQcPreparationSource(productId, token, {
      preparationId: preparation.preparation_id,
      expectedRowVersion: preparation.row_version,
      attest: true,
      factEvidence: qcFactEvidenceFromRows(submittedRows),
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.pendingApproval = { stage: "qc", itemKey: String(preparation?.preparation_id || "") };
      rememberApprovalRefusal({ message: result.message, code: result.message });
      state.pendingApproval = null;
      state.qcFactNotice = userMessageForError({ message: result.message }) || "QC source verification failed.";
      state.qcFactHighlights = Array.isArray(result.details?.facts) ? result.details.facts : [];
      await refreshStageReview({ render: true });
      return;
    }
    showToast(`Source facts approved (version ${result.row_version})`, "success");
    state.qcFactNotice = "";
    state.qcFactHighlights = [];
    state.qcEvidenceLoadedFor = null;
    state.qcEvidenceLoading = false;
    await refreshStageReview();
    reloadQcPreparationWorkspace();
  } catch (error) {
    if (state.selectedProductId !== productId) return;
    state.qcFactNotice = userMessageForError(error);
  } finally {
    state.qcSourceConfirmOpen = false;
    state.qcSourceVerifyRunning = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcReopen() {
  if (state.qcReopenRunning === true || state.qcSourceConfirmOpen === true || openQcConfirm.showing === true) return;
  const model = qcSourceFactsModel();
  if (model.canReopen !== true) return;
  const preparation = state.qcPrepServer;
  const productId = state.selectedProductId;
  state.qcSourceConfirmOpen = true;
  state.qcFactNotice = "";
  try {
    const accepted = await openQcConfirm({
      title: "Reopen for re-verification",
      message: "The current evidence record stays in the audit trail. The draft returns to Review required (version " + model.nextVersion + ").",
      okLabel: "Reopen for re-verification",
      returnFocusId: "btnQcReopenSourceFacts",
      idPrefix: "qcReopenConfirm",
      reasonRequired: true,
      attestLabel: "I understand the current verification will be superseded and the draft must be verified again",
    });
    if (accepted?.ok !== true) return;
    if (state.selectedProductId !== productId) return;
    state.qcReopenRunning = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await reopenQcPreparation(productId, token, {
      preparationId: preparation.preparation_id,
      expectedRowVersion: preparation.row_version,
      attest: true,
      reasonNote: accepted.reasonNote,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcFactNotice = result.message || "Reopen failed.";
      return;
    }
    showToast(`Reopened for re-verification (version ${result.row_version})`, "success");
    state.qcFactRows = null;
    state.qcFactScope = "";
    state.qcFactAttest = false;
    state.qcFactNotice = "";
    state.qcFactHighlights = [];
    state.qcEvidenceLoadedFor = null;
    state.qcEvidenceLoading = false;
    reloadQcPreparationWorkspace();
  } catch (error) {
    if (state.selectedProductId !== productId) return;
    state.qcFactNotice = userMessageForError(error);
  } finally {
    state.qcSourceConfirmOpen = false;
    state.qcReopenRunning = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

const QC_BASIS_CATEGORY_OPTIONS = [
  ["MANUFACTURING_RECORDS", "Manufacturing records"],
  ["PHARMACOPOEIA_OR_MONOGRAPH", "Pharmacopoeia or monograph"],
  ["REGULATORY_GUIDANCE", "Regulatory guidance"],
  ["LABORATORY_CORRESPONDENCE", "Laboratory correspondence"],
  ["OPERATOR_DETERMINATION", "Operator determination"],
  ["OPERATOR_DERIVATION", "Operator derivation"],
];

function qcReadinessFactLabel(factKey) {
  const match = QC_SOURCE_FACT_FIELDS.find(([key]) => key === String(factKey || "").toLowerCase());
  return match ? match[1] : String(factKey || "").replaceAll("_", " ");
}

function qcReadinessReasonText(code) {
  const text = String(code || "");
  if (text.startsWith("FACT_ACCEPTANCE_MISSING_")) {
    return `${qcReadinessFactLabel(text.slice("FACT_ACCEPTANCE_MISSING_".length))} needs acceptance by a colleague`;
  }
  if (text.startsWith("FACT_SELF_ACCEPTED_")) {
    return `${qcReadinessFactLabel(text.slice("FACT_SELF_ACCEPTED_".length))} was accepted by the same person who verified; a different editor must accept`;
  }
  if (text === "LAB_DECISION_MISSING") return "Record the laboratory decision";
  if (text === "LAB_DECISION_STALE_BINDING") return "Laboratory decision was made on older evidence; record a correction";
  if (text === "LAB_DECISION_WITHDRAWN") return "Laboratory decision withdrawn";
  if (text.startsWith("EVIDENCE_")) return qcEvidenceReasonText(text.slice("EVIDENCE_".length));
  if (text === "PAYLOAD_DRIFT_SINCE_VERIFY") return "Draft edited after verification";
  return qcEvidenceReasonText(text);
}

function qcReadinessBadge(readiness) {
  const status = String(readiness?.status || "");
  if (status === "READY") return { tone: "ready", label: "Ready", style: "color:#166534" };
  if (status === "READY_PROVISIONAL") return { tone: "provisional", label: "Ready (provisional)", style: "color:#8a5a00" };
  return { tone: "not-ready", label: "Not ready", style: "color:#c2410c" };
}

function qcActorLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "unknown";
  return text.slice(0, 8);
}

function qcIstStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} IST`;
}

function qcHtmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function queueQcReadinessLoad() {
  if (!workerApiAvailable() || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (access.canView !== true) return;
  const preparationId = state.qcPrepServer?.preparation_id || "";
  if (!preparationId) {
    if (state.qcReadinessLoadedFor === "") return;
    state.qcReadiness = null;
    state.qcReadinessLoadedFor = "";
    return;
  }
  if (state.qcEvidenceLoadedFor !== preparationId) return;
  if (state.qcReadinessLoading === true || state.qcReadinessLoadedFor === preparationId) return;
  state.qcReadinessLoading = true;
  const productId = state.selectedProductId;
  const request = ++state.qcReadinessRequest;
  queueMicrotask(() => {
    void loadQcReadiness(productId, preparationId, request);
  });
}

async function loadQcReadiness(productId, preparationId, request) {
  try {
    const token = await sessionAccessToken();
    if (request !== state.qcReadinessRequest || state.selectedProductId !== productId) return;
    const result = await readQcReadiness(productId, token, { preparationId });
    if (request !== state.qcReadinessRequest || state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcReadiness = null;
      state.qcReadinessNotice = result.message || "QC readiness failed.";
    } else {
      state.qcReadiness = result;
      state.qcReadinessNotice = "";
    }
    state.qcReadinessLoadedFor = preparationId;
  } catch (error) {
    if (request !== state.qcReadinessRequest || state.selectedProductId !== productId) return;
    state.qcReadiness = null;
    state.qcReadinessNotice = userMessageForError(error);
    state.qcReadinessLoadedFor = preparationId;
  } finally {
    if (request === state.qcReadinessRequest) state.qcReadinessLoading = false;
    if (state.selectedProductId === productId) {
      if (state.tab === "qc") renderQc();
      if (state.tab === "readiness") renderReadiness();
    }
  }
}

function qcReadinessCardHtml() {
  const esc = qcHtmlEscape;
  const readiness = state.qcReadiness;
  const badge = qcReadinessBadge(readiness);
  const reasons = Array.isArray(readiness?.reasons) ? readiness.reasons.map((code) => qcReadinessReasonText(code)) : [];
  const facts = [];
  for (const fact of readiness?.report_supported_facts || []) {
    facts.push(`${qcReadinessFactLabel(fact)}: Shown in the report`);
  }
  for (const item of readiness?.operator_asserted_facts || []) {
    if (item?.accepted === true) {
      facts.push(`${qcReadinessFactLabel(item.fact)}: Accepted by ${qcActorLabel(item.accepted_by)} on ${qcIstStamp(item.accepted_at)}`);
    } else if (item?.fact) {
      facts.push(`${qcReadinessFactLabel(item.fact)}: Not accepted`);
    }
  }
  const verified = readiness?.verified_by
    ? `Verified by ${qcActorLabel(readiness.verified_by)} on ${qcIstStamp(readiness.verified_at)}`
    : "";
  const lab = readiness?.lab_basis;
  const statement = lab?.statement ? String(lab.statement) : "";
  return `<section class="section-card" id="qcReadinessCard">
    <h3 class="section-title">Readiness <span id="qcReadinessBadge" data-qc-readiness-tone="${esc(badge.tone)}" style="${esc(badge.style)}">${esc(readiness ? badge.label : "Not ready")}</span></h3>
    ${state.qcReadinessLoading ? `<p class="muted-note" id="qcReadinessLoading">Reading readiness.</p>` : ""}
    ${state.qcReadinessNotice ? `<p class="muted-note" id="qcReadinessNotice">${esc(state.qcReadinessNotice)}</p>` : ""}
    ${verified ? `<p id="qcReadinessVerified">${esc(verified)}</p>` : ""}
    ${reasons.length ? `<ul id="qcReadinessReasons">${reasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>` : ""}
    ${facts.length ? `<ul id="qcReadinessFacts">${facts.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}
    ${lab ? `<p id="qcReadinessIssuer">Report issuer: ${esc(lab.report_issuer || "")}</p><p id="qcReadinessPortalLab">Portal laboratory: ${esc(lab.portal_laboratory || "")}</p>` : ""}
    ${statement ? `<p id="qcLabProvisionalStatement">${esc(statement)}</p>` : ""}
  </section>`;
}

function qcTodayStamp() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function qcLabSuggestions(form) {
  const lab = String(form?.portal_laboratory_candidate || "").trim();
  const issuer = qcIssuerShortName(form?.source_report_issuer);
  return {
    documentReference: `Operator decision ${qcTodayStamp()} – cross laboratory tie-up`,
    rationale: lab && issuer
      ? `${lab} selected provisionally as portal laboratory; ${issuer} remains the report issuer; legal identity not verified`
      : "",
  };
}

function qcPortalLabLine(form) {
  const label = String(form?.portal_laboratory_candidate || "").trim();
  const match = (state.qcPrepLabs || []).find((item) => item.label === label);
  if (!label) return "";
  if (match?.external_id != null && String(match.external_id) !== "") return `${label}, portal id ${match.external_id}`;
  return label;
}

function qcEnsureLabDraft(form) {
  const scope = `${state.selectedProductId || ""}:${state.qcPrepServer?.preparation_id || ""}`;
  const suggestion = qcLabSuggestions(form);
  if (state.qcLabDraftScope !== scope || state.qcLabDraftSeeded !== true) {
    state.qcLabDraftScope = scope;
    if (suggestion.rationale) {
      state.qcLabDocumentReference = suggestion.documentReference;
      state.qcLabRationale = suggestion.rationale;
      state.qcLabAttest = false;
      state.qcLabDraftSeeded = true;
    }
  }
  return suggestion;
}

function qcLabFieldsReady() {
  const reference = String(state.qcLabDocumentReference || "").trim();
  const rationale = String(state.qcLabRationale || "").trim();
  return reference.length >= 5 && rationale.length >= 10 && rationale.length <= 2000 && state.qcLabAttest === true;
}

function qcGovernanceBlocked() {
  return state.qcGovernanceRunning === true
    || state.qcGovernanceConfirmOpen === true
    || state.qcSourceConfirmOpen === true
    || state.qcSourceVerifyRunning === true
    || state.qcReopenRunning === true
    || openQcConfirm.showing === true;
}

function qcLabDecisionCardHtml() {
  const form = qcPrepForm();
  if (form.quality_control_mode !== "OUT" || canWrite() !== true) return "";
  const esc = qcHtmlEscape;
  qcEnsureLabDraft(form);
  const lab = state.qcReadiness?.lab_basis || null;
  const blocked = qcGovernanceBlocked();
  const ready = qcLabFieldsReady() && !blocked && Number(state.qcReadiness?.preparation_row_version) > 0;
  const hasHead = lab?.lab_basis_id != null && Number(lab.lab_basis_id) > 0;
  const decision = lab
    ? `<div id="qcLabDecisionCurrent">
        <p>Action: ${esc(lab.decision_action || "")}</p>
        <p>Status: ${esc(lab.internal_selection || "")}</p>
        <p>Recorded by ${esc(qcActorLabel(lab.recorded_by))} on ${esc(qcIstStamp(lab.recorded_at))}</p>
        <p>${esc(lab.rationale || "")}</p>
      </div>`
    : "";
  const buttons = hasHead
    ? `<button type="button" class="icon-btn with-label" id="btnQcLabCorrect"${ready ? "" : " disabled"}>Correct</button>
       <button type="button" class="icon-btn with-label" id="btnQcLabReplace"${ready ? "" : " disabled"}>Replace</button>
       <button type="button" class="icon-btn with-label" id="btnQcLabWithdraw"${ready ? "" : " disabled"}>Withdraw</button>`
    : `<button type="button" class="icon-btn with-label primary" id="btnQcLabRecord"${ready ? "" : " disabled"}>${state.qcGovernanceRunning ? "Recording..." : "Record"}</button>`;
  return `<section class="section-card" id="qcLabDecisionCard">
    <h3 class="section-title">Record laboratory decision</h3>
    <p id="qcLabIssuer">Report issuer: ${esc(form.source_report_issuer || "")}</p>
    <p id="qcLabPortal">Portal laboratory: ${esc(qcPortalLabLine(form))}</p>
    <p id="qcLabBasis">Basis: Cross laboratory tie-up</p>
    ${decision}
    <label>Document reference
      <input id="qcLabDocumentReference" value="${esc(state.qcLabDocumentReference || "")}">
    </label>
    <label>Rationale
      <textarea id="qcLabRationale">${esc(state.qcLabRationale || "")}</textarea>
    </label>
    <label><input id="qcLabAttest" type="checkbox"${state.qcLabAttest ? " checked" : ""}> I attest this laboratory decision.</label>
    <div class="action-row">${buttons}</div>
  </section>`;
}

function qcLabConfirmMessage(action, form) {
  const lab = String(form?.portal_laboratory_candidate || "").trim() || "the portal laboratory";
  const issuer = qcIssuerShortName(form?.source_report_issuer) || "The report issuer";
  if (action === "INITIAL") {
    return `Records ${lab} as PROVISIONAL portal laboratory for this evidence version. ${issuer} stays the issuer. Continue?`;
  }
  if (action === "CORRECTION") {
    return `Records a correction for this evidence version. ${lab} stays the provisional portal laboratory. ${issuer} stays the issuer. Continue?`;
  }
  if (action === "REPLACEMENT") {
    return `Replaces the laboratory decision for this evidence version. ${issuer} stays the issuer. Continue?`;
  }
  return `Withdraws the laboratory decision for this evidence version. ${issuer} stays the issuer. Continue?`;
}

function refreshQcAfterGovernanceWrite() {
  state.qcEvidenceLoadedFor = null;
  state.qcEvidenceLoading = false;
  state.qcReadinessLoadedFor = null;
  state.qcReadiness = null;
  state.qcReadinessLoading = false;
  state.qcFillLoadedFor = null;
  state.qcFillPreflight = null;
  state.qcFillLoading = false;
  state.qcFactAcceptDrafts = null;
  state.qcFactCorrectDrafts = null;
  state.qcFactCorrectOpen = "";
  state.qcMappingSeeded = false;
  state.qcMappingAttest = false;
  reloadQcPreparationWorkspace();
}

async function submitQcLabDecision(action) {
  if (qcGovernanceBlocked()) return;
  const form = qcPrepForm();
  const preparation = state.qcPrepServer;
  const readiness = state.qcReadiness;
  if (!preparation || form.quality_control_mode !== "OUT" || canWrite() !== true) return;
  if (!qcLabFieldsReady()) return;
  const headId = readiness?.lab_basis?.lab_basis_id ?? null;
  if (action === "INITIAL" && headId != null) return;
  if (action !== "INITIAL" && !(Number(headId) > 0)) return;
  const version = readiness?.preparation_row_version;
  if (!(Number(version) > 0)) return;
  const productId = state.selectedProductId;
  const titles = {
    INITIAL: "Record laboratory decision",
    CORRECTION: "Correct laboratory decision",
    REPLACEMENT: "Replace laboratory decision",
    WITHDRAWAL: "Withdraw laboratory decision",
  };
  const focus = {
    INITIAL: "btnQcLabRecord",
    CORRECTION: "btnQcLabCorrect",
    REPLACEMENT: "btnQcLabReplace",
    WITHDRAWAL: "btnQcLabWithdraw",
  };
  state.qcGovernanceConfirmOpen = true;
  state.qcReadinessNotice = "";
  try {
    const accepted = await openQcConfirm({
      title: titles[action] || "Record laboratory decision",
      message: qcLabConfirmMessage(action, form),
      okLabel: titles[action] || "Record laboratory decision",
      returnFocusId: focus[action] || "btnQcLabRecord",
      idPrefix: `qcLab${action}Confirm`,
    });
    if (accepted !== true) return;
    if (state.selectedProductId !== productId) return;
    state.qcGovernanceRunning = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const reference = String(state.qcLabDocumentReference || "").trim();
    const rationale = String(state.qcLabRationale || "").trim();
    const result = await recordQcLabDecision(productId, token, {
      preparationId: preparation.preparation_id,
      expectedRowVersion: version,
      action,
      supersedesLabBasisId: action === "INITIAL" ? null : headId,
      basisType: "CROSS_LABORATORY_TIE_UP",
      documentReference: reference,
      rationale,
      attest: true,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcReadinessNotice = result.message || "Laboratory decision failed.";
      return;
    }
    showToast(`Laboratory decision recorded (${result.decision_action || action})`, "success");
    state.qcLabAttest = false;
    refreshQcAfterGovernanceWrite();
  } catch (error) {
    if (state.selectedProductId !== productId) return;
    state.qcReadinessNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcGovernanceRunning = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function qcFactAcceptDraft(factKey) {
  const scope = `${state.selectedProductId || ""}:${state.qcPrepServer?.preparation_id || ""}`;
  if (state.qcFactAcceptScope !== scope || !state.qcFactAcceptDrafts) {
    state.qcFactAcceptScope = scope;
    state.qcFactAcceptDrafts = {};
  }
  if (!state.qcFactAcceptDrafts[factKey]) {
    state.qcFactAcceptDrafts[factKey] = { category: "", note: "", attest: false, touched: false };
  }
  const draft = state.qcFactAcceptDrafts[factKey];
  if (draft.touched !== true && !String(draft.note || "").trim()) {
    const suggestion = qcFactBasisSuggestion(factKey, qcPrepForm());
    if (suggestion.note) {
      draft.category = suggestion.category;
      draft.note = suggestion.note;
    }
  }
  return draft;
}

function qcFactAcceptReady(draft) {
  const note = String(draft?.note || "").trim();
  return QC_BASIS_CATEGORY_OPTIONS.some(([value]) => value === draft?.category)
    && note.length >= 10
    && note.length <= 2000
    && draft?.attest === true;
}

function qcFactAcceptCardHtml() {
  if (canWrite() !== true) return "";
  const pending = (state.qcReadiness?.operator_asserted_facts || []).filter((item) => item && item.accepted !== true && item.fact);
  if (!pending.length) return "";
  const esc = qcHtmlEscape;
  const verifiedBy = String(state.qcReadiness?.verified_by || "");
  const selfAccept = verifiedBy !== "" && String(access.userId || "") === verifiedBy;
  const blocked = qcGovernanceBlocked();
  const rows = pending.map((item) => {
    const draft = qcFactAcceptDraft(item.fact);
    const ready = qcFactAcceptReady(draft) && !blocked && Number(state.qcReadiness?.preparation_row_version) > 0;
    const options = [`<option value="">Choose a basis</option>`].concat(QC_BASIS_CATEGORY_OPTIONS.map(([value, label]) => (
      `<option value="${esc(value)}"${draft.category === value ? " selected" : ""}>${esc(label)}</option>`
    ))).join("");
    return `<div class="form-field form-span-2" data-qc-accept-row="${esc(item.fact)}">
      <span class="meta-label">${esc(qcReadinessFactLabel(item.fact))}</span>
      <p>Not accepted</p>
      ${item.note ? `<p>${esc(item.note)}</p>` : ""}
      <label>Basis category
        <select id="qcFactAcceptCategory-${esc(item.fact)}" data-qc-accept-fact="${esc(item.fact)}" data-qc-accept-role="category">${options}</select>
      </label>
      <label>Basis note
        <textarea id="qcFactAcceptNote-${esc(item.fact)}" data-qc-accept-fact="${esc(item.fact)}" data-qc-accept-role="note">${esc(draft.note || "")}</textarea>
      </label>
      <label><input id="qcFactAcceptAttest-${esc(item.fact)}" type="checkbox" data-qc-accept-fact="${esc(item.fact)}" data-qc-accept-role="attest"${draft.attest ? " checked" : ""}> I attest this fact acceptance.</label>
      <button type="button" class="icon-btn with-label primary" id="btnQcFactAccept-${esc(item.fact)}" data-qc-accept-fact="${esc(item.fact)}"${ready ? "" : " disabled"}>Accept</button>
    </div>`;
  }).join("");
  return `<section class="section-card" id="qcFactAcceptCard">
    <h3 class="section-title">Accept operator-asserted fact</h3>
    ${selfAccept ? `<p id="qcFactAcceptSelfWarning">You verified this evidence. Your acceptance will be recorded but will not count. A different editor must accept.</p>` : ""}
    ${rows}
  </section>`;
}

async function submitQcFactAccept(factKey) {
  if (qcGovernanceBlocked()) return;
  if (canWrite() !== true || !factKey) return;
  const draft = qcFactAcceptDraft(factKey);
  if (!qcFactAcceptReady(draft)) return;
  const preparation = state.qcPrepServer;
  const version = state.qcReadiness?.preparation_row_version;
  if (!preparation || !(Number(version) > 0)) return;
  const productId = state.selectedProductId;
  const note = String(draft.note || "").trim();
  const category = draft.category;
  state.qcGovernanceConfirmOpen = true;
  state.qcReadinessNotice = "";
  try {
    const accepted = await openQcConfirm({
      title: "Accept operator-asserted fact",
      message: `Accept ${qcReadinessFactLabel(factKey)} for this evidence version. Continue?`,
      okLabel: "Accept",
      returnFocusId: `btnQcFactAccept-${factKey}`,
      idPrefix: "qcFactAcceptConfirm",
    });
    if (accepted !== true) return;
    if (state.selectedProductId !== productId) return;
    state.qcGovernanceRunning = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await acceptQcFact(productId, token, {
      preparationId: preparation.preparation_id,
      expectedRowVersion: version,
      factKey,
      basisCategory: category,
      basisNote: note,
      attest: true,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcReadinessNotice = result.message || "Fact acceptance failed.";
      return;
    }
    showToast(`Accepted ${qcReadinessFactLabel(factKey)}`, "success");
    refreshQcAfterGovernanceWrite();
  } catch (error) {
    if (state.selectedProductId !== productId) return;
    state.qcReadinessNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcGovernanceRunning = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function qcFactBatchList(form) {
  const raw = form?.batches;
  const parts = Array.isArray(raw)
    ? raw.map((item) => (item && typeof item === "object" ? item.batch_no : item))
    : String(raw || "").split(",");
  return parts.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
}

function qcFactDisplayDate(value) {
  const iso = qcPrepFmtDate(value);
  if (iso) return iso;
  const text = String(value || "").trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) return text;
  return "";
}

function qcFactBasisSuggestion(factKey, form) {
  const list = state.qcPrepOptions || [];
  const selected = list.find((item) => String(item?.term_id) === String(form?.testing_protocol_term_id || ""));
  const protocolCode = selected?.code || "";
  const protocolLabel = selected?.label || "";
  const issuer = qcIssuerShortName(form?.source_report_issuer);
  const reportName = String(form?.report_filename || "").trim();
  if (factKey === "study_start_date") {
    const date = qcFactDisplayDate(form?.study_start_date);
    const batches = qcFactBatchList(form);
    if (!date || !batches || !issuer || !reportName) return { category: "", note: "" };
    return {
      category: "OPERATOR_DERIVATION",
      note: `Study start date ${date} derived by the operator as the earliest batch manufacturing date among batches ${batches} stated on the ${issuer} certificate of analysis / QC test report (${reportName}). The report does not state a study start date.`,
    };
  }
  if (factKey === "testing_protocol") {
    const other = String(form?.other_testing_protocol_text || "").trim();
    if (!protocolLabel || !issuer) return { category: "", note: "" };
    if (protocolCode === "OTHER") {
      if (!other) return { category: "", note: "" };
      return {
        category: "OPERATOR_DETERMINATION",
        note: `Testing protocol "${protocolLabel}: ${other}" was chosen by the operator. It is not stated on the ${issuer} report.`,
      };
    }
    return {
      category: "OPERATOR_DETERMINATION",
      note: `Testing protocol "${protocolLabel}" was chosen by the operator. It is not stated on the ${issuer} report.`,
    };
  }
  return { category: "", note: "" };
}

function qcBasisCategoryLabel(code) {
  const match = QC_BASIS_CATEGORY_OPTIONS.find(([value]) => value === code);
  return match ? match[1] : String(code || "");
}

const QC_FILL_QUALIFICATION = "Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified.";
const QC_FILL_PROVISIONAL_PREFILL = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection; NUPAL is the report issuer; legal identity and portal eligibility are not verified.";
const QC_FILL_SAVE_BLOCKED = "The portal control that runs Save is labelled Submit. Save was not pressed.";
const QC_FILL_BLOCKER_TEXT = {
  READINESS_NOT_READY: "Readiness is not Ready (provisional) yet",
  PRODUCT_DETAILS_NOT_PORTAL_VERIFIED: "Product details are not verified on the portal",
  COMPOSITION_NOT_PORTAL_VERIFIED: "Composition is not verified on the portal",
  PROTOCOL_MAPPING_NOT_VERIFIED: "The 'Others' protocol mapping is not verified yet",
  STUDY_START_NOT_FLAGGED_DERIVED: "Study start date must be accepted as 'Operator derivation' (correct the acceptance)",
  OTHER_PROTOCOL_TEXT_MISSING: "Others protocol text is missing",
};
const QC_FILL_FIELD_ROWS = [
  ["typeOfStudy", "Type of study"],
  ["startDate", "Start date"],
  ["endDate", "End date"],
  ["reportDate", "Report date"],
  ["batchNo", "Batch numbers"],
  ["duration", "Duration (months)"],
  ["labName", "Laboratory (portal id)"],
  ["qualityCntrl", "Quality control"],
];

function qcFillBlockerText(code) {
  const text = String(code || "");
  if (Object.prototype.hasOwnProperty.call(QC_FILL_BLOCKER_TEXT, text)) return QC_FILL_BLOCKER_TEXT[text];
  return text;
}

function queueQcFillPreflight() {
  if (!workerApiAvailable() || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (access.canView !== true) return;
  const preparationId = state.qcPrepServer?.preparation_id || "";
  if (!preparationId) {
    if (state.qcFillLoadedFor === "") return;
    state.qcFillPreflight = null;
    state.qcFillLoadedFor = "";
    return;
  }
  if (state.qcReadinessLoadedFor !== preparationId) return;
  if (state.qcFillLoading === true || state.qcFillLoadedFor === preparationId) return;
  state.qcFillLoading = true;
  const productId = state.selectedProductId;
  const request = ++state.qcFillRequest;
  queueMicrotask(() => {
    void loadQcFillPreflight(productId, preparationId, request);
  });
}

async function loadQcFillPreflight(productId, preparationId, request) {
  try {
    const token = await sessionAccessToken();
    if (request !== state.qcFillRequest || state.selectedProductId !== productId) return;
    const result = await readQcFillPreflight(productId, token, { preparationId });
    if (request !== state.qcFillRequest || state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcFillPreflight = null;
      state.qcFillNotice = result.message || "QC filling preflight failed.";
    } else {
      state.qcFillPreflight = result;
      state.qcFillNotice = "";
    }
    try {
      const status = await executeQcPrepRun(productId, token, { action: "nativeSaveStatus", preparationId });
      if (request === state.qcFillRequest && state.selectedProductId === productId) {
        state.qcNativeSaveStatus = {
          buildAuthorized: status?.buildAuthorized === true,
          tag: status?.tag || "D7.3",
        };
      }
    } catch {
      if (request === state.qcFillRequest) state.qcNativeSaveStatus = { buildAuthorized: false, tag: "D7.3" };
    }
    state.qcFillLoadedFor = preparationId;
  } catch (error) {
    if (request !== state.qcFillRequest || state.selectedProductId !== productId) return;
    state.qcFillPreflight = null;
    state.qcFillNotice = userMessageForError(error);
    state.qcFillLoadedFor = preparationId;
  } finally {
    if (request === state.qcFillRequest) state.qcFillLoading = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function qcFactCorrectDraft(item) {
  const factKey = String(item?.fact || "");
  const scope = `${state.selectedProductId || ""}:${state.qcPrepServer?.preparation_id || ""}`;
  if (state.qcFactCorrectScope !== scope || !state.qcFactCorrectDrafts) {
    state.qcFactCorrectScope = scope;
    state.qcFactCorrectDrafts = {};
  }
  const existing = state.qcFactCorrectDrafts[factKey];
  if (!existing || (existing.touched !== true && String(existing.acceptanceId) !== String(item?.acceptance_id ?? ""))) {
    const suggestion = qcFactBasisSuggestion(factKey, qcPrepForm());
    const oldLabel = qcBasisCategoryLabel(item?.basis_category);
    const oldNote = String(item?.basis_note || "");
    state.qcFactCorrectDrafts[factKey] = {
      category: suggestion.category || "",
      note: suggestion.note || "",
      reason: `Earlier basis "${oldLabel}: ${oldNote}" was inaccurate. Corrected to state the actual basis.`,
      attest: false,
      touched: false,
      acceptanceId: item?.acceptance_id,
    };
  }
  return state.qcFactCorrectDrafts[factKey];
}

function qcFactCorrectReady(draft) {
  const note = String(draft?.note || "").trim();
  const reason = String(draft?.reason || "").trim();
  return QC_BASIS_CATEGORY_OPTIONS.some(([value]) => value === draft?.category)
    && note.length >= 10
    && note.length <= 2000
    && reason.length >= 10
    && reason.length <= 2000
    && draft?.attest === true;
}

function qcFactCorrectCardHtml() {
  if (canWrite() !== true) return "";
  const accepted = (state.qcReadiness?.operator_asserted_facts || []).filter((item) => item && item.accepted === true && item.fact);
  if (!accepted.length) return "";
  const esc = qcHtmlEscape;
  const verifiedBy = String(state.qcReadiness?.verified_by || "");
  const selfCorrect = verifiedBy !== "" && String(access.userId || "") === verifiedBy;
  const blocked = qcGovernanceBlocked();
  const rows = accepted.map((item) => {
    const draft = qcFactCorrectDraft(item);
    const open = state.qcFactCorrectOpen === item.fact;
    const ready = qcFactCorrectReady(draft) && !blocked && Number(state.qcReadiness?.preparation_row_version) > 0 && Number(item.acceptance_id) > 0;
    const chain = Number(item.chain_length) > 1 ? `Correction ${item.chain_length}` : "";
    const options = QC_BASIS_CATEGORY_OPTIONS.map(([value, label]) => (
      `<option value="${esc(value)}"${draft.category === value ? " selected" : ""}>${esc(label)}</option>`
    )).join("");
    const editor = open
      ? `<label>Basis category
          <select id="qcFactCorrectCategory-${esc(item.fact)}" data-qc-correct-fact="${esc(item.fact)}" data-qc-correct-role="category">${options}</select>
        </label>
        <label>Basis note
          <textarea id="qcFactCorrectNote-${esc(item.fact)}" data-qc-correct-fact="${esc(item.fact)}" data-qc-correct-role="note">${esc(draft.note || "")}</textarea>
        </label>
        <label>Correction reason
          <textarea id="qcFactCorrectReason-${esc(item.fact)}" data-qc-correct-fact="${esc(item.fact)}" data-qc-correct-role="reason">${esc(draft.reason || "")}</textarea>
        </label>
        <label><input id="qcFactCorrectAttest-${esc(item.fact)}" type="checkbox" data-qc-correct-fact="${esc(item.fact)}" data-qc-correct-role="attest"${draft.attest ? " checked" : ""}> I confirm this basis is accurate and I am accountable for this correction.</label>
        <button type="button" class="icon-btn with-label primary" id="btnQcFactCorrectSave-${esc(item.fact)}" data-qc-correct-fact="${esc(item.fact)}"${ready ? "" : " disabled"}>Correct</button>`
      : `<button type="button" class="icon-btn with-label" id="btnQcFactCorrect-${esc(item.fact)}" data-qc-correct-fact="${esc(item.fact)}"${blocked ? " disabled" : ""}>Correct</button>`;
    return `<div class="form-field form-span-2" data-qc-correct-row="${esc(item.fact)}">
      <span class="meta-label">${esc(qcReadinessFactLabel(item.fact))}</span>
      <p>Basis: ${esc(qcBasisCategoryLabel(item.basis_category))}</p>
      <p>${esc(item.basis_note || "")}</p>
      <p>Accepted by ${esc(qcActorLabel(item.accepted_by))} on ${esc(qcIstStamp(item.accepted_at))}</p>
      ${chain ? `<p>${esc(chain)}</p>` : ""}
      ${editor}
    </div>`;
  }).join("");
  return `<section class="section-card" id="qcFactCorrectCard">
    <h3 class="section-title">Correct an accepted fact</h3>
    <p id="qcFactCorrectHistory">Original kept; history is append-only.</p>
    ${selfCorrect ? `<p id="qcFactCorrectSelfWarning">You verified this evidence. Your correction will be recorded but will not count. A different editor must correct or accept.</p>` : ""}
    ${state.qcFactCorrectNotice ? `<p class="muted-note" id="qcFactCorrectNotice">${esc(state.qcFactCorrectNotice)}</p>` : ""}
    ${rows}
  </section>`;
}

async function submitQcFactCorrect(factKey) {
  if (qcGovernanceBlocked()) return;
  if (canWrite() !== true || !factKey) return;
  const item = (state.qcReadiness?.operator_asserted_facts || []).find((row) => row?.fact === factKey && row?.accepted === true);
  if (!item) return;
  const draft = qcFactCorrectDraft(item);
  if (!qcFactCorrectReady(draft)) return;
  const preparation = state.qcPrepServer;
  const version = state.qcReadiness?.preparation_row_version;
  if (!preparation || !(Number(version) > 0) || !(Number(item.acceptance_id) > 0)) return;
  const productId = state.selectedProductId;
  const note = String(draft.note || "").trim();
  const reason = String(draft.reason || "").trim();
  const category = draft.category;
  const oldLabel = qcBasisCategoryLabel(item.basis_category);
  const oldNote = String(item.basis_note || "");
  state.qcGovernanceConfirmOpen = true;
  state.qcFactCorrectNotice = "";
  try {
    const accepted = await openQcConfirm({
      title: "Correct an accepted fact",
      message: `Correct ${qcReadinessFactLabel(factKey)}. Old basis: ${oldLabel}: ${oldNote}. New basis: ${qcBasisCategoryLabel(category)}: ${note}. Reason: ${reason}`,
      okLabel: "Correct",
      returnFocusId: `btnQcFactCorrectSave-${factKey}`,
      idPrefix: "qcFactCorrectConfirm",
    });
    if (accepted !== true) return;
    if (state.selectedProductId !== productId) return;
    state.qcGovernanceRunning = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await correctQcFactAcceptance(productId, token, {
      preparationId: preparation.preparation_id,
      expectedRowVersion: version,
      supersedesAcceptanceId: item.acceptance_id,
      basisCategory: category,
      basisNote: note,
      correctionReason: reason,
      attest: true,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcFactCorrectNotice = result.message || "Fact correction failed.";
      return;
    }
    showToast(`Corrected ${qcReadinessFactLabel(factKey)}`, "success");
    refreshQcAfterGovernanceWrite();
  } catch (error) {
    if (state.selectedProductId !== productId) return;
    state.qcFactCorrectNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcGovernanceRunning = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function qcEnsureMappingDraft(optionId) {
  const scope = `${state.selectedProductId || ""}:${state.qcPrepServer?.preparation_id || ""}:${optionId}`;
  if (state.qcMappingScope !== scope || state.qcMappingSeeded !== true) {
    state.qcMappingScope = scope;
    state.qcMappingReason = `Others (portal option ${optionId}) confirmed by the operator against the live addQCRegister Type of Study list.`;
    state.qcMappingAttest = false;
    state.qcMappingSeeded = true;
  }
}

function qcProtocolMappingCardHtml() {
  const mapping = state.qcFillPreflight?.protocol_mapping;
  const status = String(mapping?.mapping_status || "");
  if (status !== "DRAFT" && status !== "VERIFIED") return "";
  const esc = qcHtmlEscape;
  if (status === "VERIFIED") {
    return `<section class="section-card" id="qcProtocolMappingCard">
      <h3 class="section-title">Verify 'Others' protocol mapping</h3>
      <p id="qcProtocolMappingVerified">Others mapping verified</p>
    </section>`;
  }
  if (canWrite() !== true) return "";
  const optionId = mapping.portal_option_id;
  qcEnsureMappingDraft(optionId);
  const reason = String(state.qcMappingReason || "").trim();
  const ready = reason.length >= 10 && reason.length <= 2000 && state.qcMappingAttest === true && !qcGovernanceBlocked() && Number(mapping.mapping_id) > 0 && Number(optionId) > 0;
  return `<section class="section-card" id="qcProtocolMappingCard">
    <h3 class="section-title">Verify 'Others' protocol mapping</h3>
    <p id="qcProtocolMappingLine">term "Others" to portal option ${esc(optionId)} "Others" (Type of Study list on /admin/addQCRegister).</p>
    <p id="qcProtocolMappingCheck">Open the live portal Add QC Register page and confirm 'Others' is listed under Type of Study.</p>
    ${state.qcMappingNotice ? `<p class="muted-note" id="qcMappingNotice">${esc(state.qcMappingNotice)}</p>` : ""}
    <label>Reason
      <textarea id="qcMappingReason">${esc(state.qcMappingReason || "")}</textarea>
    </label>
    <label><input id="qcMappingAttest" type="checkbox"${state.qcMappingAttest ? " checked" : ""}> I attest this protocol mapping.</label>
    <button type="button" class="icon-btn with-label primary" id="btnQcMappingVerify"${ready ? "" : " disabled"}>Verify</button>
  </section>`;
}

async function submitQcProtocolMapping() {
  if (qcGovernanceBlocked()) return;
  if (canWrite() !== true) return;
  const mapping = state.qcFillPreflight?.protocol_mapping;
  if (String(mapping?.mapping_status || "") !== "DRAFT") return;
  const reason = String(state.qcMappingReason || "").trim();
  if (reason.length < 10 || reason.length > 2000 || state.qcMappingAttest !== true) return;
  if (!(Number(mapping.mapping_id) > 0) || !(Number(mapping.portal_option_id) > 0)) return;
  const productId = state.selectedProductId;
  const optionId = mapping.portal_option_id;
  state.qcGovernanceConfirmOpen = true;
  state.qcMappingNotice = "";
  try {
    const accepted = await openQcConfirm({
      title: "Verify Others protocol mapping",
      message: `Verify Others mapping to portal option ${optionId}. Reason: ${reason}`,
      okLabel: "Verify",
      returnFocusId: "btnQcMappingVerify",
      idPrefix: "qcMappingVerifyConfirm",
    });
    if (accepted !== true) return;
    if (state.selectedProductId !== productId) return;
    state.qcGovernanceRunning = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await verifyQcProtocolMapping(productId, token, {
      mappingId: mapping.mapping_id,
      expectedStatus: "DRAFT",
      expectedPortalOptionId: optionId,
      mappingReason: reason,
      attest: true,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcMappingNotice = result.message || "Protocol mapping verification failed.";
      return;
    }
    showToast("Others mapping verified", "success");
    state.qcMappingAttest = false;
    refreshQcAfterGovernanceWrite();
  } catch (error) {
    if (state.selectedProductId !== productId) return;
    state.qcMappingNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcGovernanceRunning = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

let qcFillInspectPendingFile = null;

function qcSeedFillAcks() {
  const preparationId = state.qcPrepServer?.preparation_id || "";
  const loaded = state.qcFillPreflight && state.qcFillLoadedFor === preparationId ? "loaded" : "pending";
  const scope = `${state.selectedProductId || ""}:${preparationId}:${loaded}`;
  if (state.qcFillAckScope === scope) {
    if (loaded === "loaded" && state.qcFillDerivedNoteTouched !== true && String(state.qcFillDerivedNote || "").trim() === "") {
      const derivedNow = Array.isArray(state.qcFillPreflight?.context?.derived_facts) ? state.qcFillPreflight.context.derived_facts : [];
      const noteNow = derivedNow.map((item) => String(item?.basis_note || "").trim()).filter(Boolean).join(" ");
      if (noteNow.length >= 10 && noteNow.length <= 2000) state.qcFillDerivedNote = noteNow;
    }
    return;
  }
  const sameCard = String(state.qcFillAckScope || "").startsWith(`${state.selectedProductId || ""}:${preparationId}:`);
  state.qcFillAckScope = scope;
  state.qcFillAckSeeded = true;
  if (!sameCard) {
    state.qcFillProvisionalAck = false;
    state.qcFillProvisionalNote = QC_FILL_PROVISIONAL_PREFILL;
    state.qcFillDerivedAck = false;
    state.qcFillDerivedNote = "";
    state.qcFillDerivedNoteTouched = false;
  }
  if (state.qcFillDerivedNoteTouched === true) return;
  const derived = Array.isArray(state.qcFillPreflight?.context?.derived_facts) ? state.qcFillPreflight.context.derived_facts : [];
  const note = derived.map((item) => String(item?.basis_note || "").trim()).filter(Boolean).join(" ");
  if (note.length >= 10 && note.length <= 2000) state.qcFillDerivedNote = note;
  else if (!sameCard) state.qcFillDerivedNote = "";
}

function qcFillArmBlockReason() {
  const preflight = state.qcFillPreflight;
  if (!preflight) return "Preflight has not loaded.";
  if ((preflight.blockers || []).length > 0) return "Blockers are still present.";
  if (canWrite() !== true) return "You do not have edit rights.";
  if (!workerApiAvailable()) return "The portal worker is not available.";
  if (state.qcPrepRunBusy === true || state.qcGovernanceConfirmOpen === true) return "A QC filling step is already running.";
  const provisional = preflight.readiness?.status === "READY_PROVISIONAL";
  const derived = Array.isArray(preflight.context?.derived_facts) ? preflight.context.derived_facts : [];
  const provisionalNote = String(state.qcFillProvisionalNote || "").trim();
  const derivedNote = String(state.qcFillDerivedNote || "").trim();
  if (provisional && state.qcFillProvisionalAck !== true) return "Tick the provisional laboratory acknowledgement.";
  if (provisional && (provisionalNote.length < 10 || provisionalNote.length > 2000)) return "The laboratory note must be 10–2000 characters.";
  if (derived.length > 0 && state.qcFillDerivedAck !== true) return "Tick the derived-date acknowledgement.";
  if (derived.length > 0 && (derivedNote.length < 10 || derivedNote.length > 2000)) return "The derived note must be 10–2000 characters.";
  return "";
}

function qcFillArmReady() {
  return !qcFillArmBlockReason();
}

function qcFillPreflightCardHtml() {
  if (access.canView !== true) return "";
  qcSeedFillAcks();
  const esc = qcHtmlEscape;
  const preflight = state.qcFillPreflight;
  const blockers = Array.isArray(preflight?.blockers) ? preflight.blockers : [];
  const blockerHtml = blockers.length
    ? `<ul id="qcFillBlockers">${blockers.map((code) => `<li>${esc(qcFillBlockerText(code))}</li>`).join("")}</ul>`
    : (preflight ? `<p id="qcFillNoBlockers" style="color:#166534">No blockers</p>` : "");
  const fields = preflight?.fill_fields || {};
  const fieldRows = QC_FILL_FIELD_ROWS.map(([key, label]) => (
    `<tr><th>${esc(label)}</th><td>${esc(fields?.[key] ?? "")}</td></tr>`
  )).join("");
  const context = preflight?.context || {};
  const derived = Array.isArray(context.derived_facts) ? context.derived_facts : [];
  const derivedHtml = derived.map((item) => (
    `<li>${esc(qcReadinessFactLabel(item?.fact))}: ${esc(item?.basis_note || "")}</li>`
  )).join("");
  const runs = Array.isArray(preflight?.runs) ? preflight.runs : [];
  const runHtml = runs.map((run) => {
    const when = qcIstStamp(run?.armed_at);
    return `<li>${esc([run?.run_status, when].filter(Boolean).join(" "))}</li>`;
  }).join("");
  const provisional = preflight?.readiness?.status === "READY_PROVISIONAL";
  const writable = canWrite() === true && workerApiAvailable();
  const armDisabled = qcFillArmReady() ? "" : " disabled";
  const armed = state.qcFillRun?.runStatus === "SAVE_ARMED" && state.qcFillRun?.clickState === "not-clicked";
  const latest = runs[0] || null;
  const latestStatus = String(latest?.run_status || "");
  const recovery = ["SAVE_AMBIGUOUS", "SAVE_UNAUTHORIZED", "SAVE_FOUND_UNAUTHORIZED"].includes(latestStatus)
    || (latestStatus === "SAVE_ARMED" && !state.qcFillRun);
  const recapture = state.qcFillRecaptureFor === state.selectedProductId ? state.qcFillRecapture : null;
  const recaptureKeys = Array.isArray(recapture?.listRowKeys) ? recapture.listRowKeys : [];
  const recaptureAction = recapture?.listActionMarkup || {};
  const recaptureDates = recapture?.listDateSamples || {};
  const recaptureSaveKeys = recapture?.saveDataQcdetailsKeys || {};
  const recaptureList = (items) => (Array.isArray(items) && items.length ? items.map((item) => esc(item)).join(", ") : "none");
  const recaptureYes = (value) => (value === true ? "yes" : "no");
  const recaptureHtml = recapture ? `<details id="qcFillRecapture"><summary>Recapture (read-only)</summary><p>List row keys: ${recaptureList(recaptureKeys)}</p><p>Action markup: hid ${recaptureYes(recaptureAction.hid)}, edit_qc ${recaptureYes(recaptureAction.edit_qc)}, delete_qc ${recaptureYes(recaptureAction.delete_qc)}, downloadButtonClass ${recaptureYes(recaptureAction.downloadButtonClass)}</p><p>Raw dates: startdate ${esc(recaptureDates.startdate || "")}, enddate ${esc(recaptureDates.enddate || "")}, reportdate ${esc(recaptureDates.reportdate || "")}</p><p>Add payload keys: ${recaptureList(recaptureSaveKeys.add)}</p><p>Edit payload keys: ${recaptureList(recaptureSaveKeys.edit)}</p><p>Script hash: ${esc(recapture.scriptHash || "")}</p></details>` : "";
  const dryRun = state.qcFillDryRun;
  const armReason = qcFillArmBlockReason();
  const dryRunReason = state.qcFillInspectOk === true ? armReason : [armReason, "Run Check portal page first (it must pass)."].filter(Boolean).join(" ");
  const dryRunEnabled = state.qcFillInspectOk === true && !armReason;
  const fileWords = {
    NO_FILE: "No report file was checked.",
    SHA256_DIFFERS: "The file contents do not match the verified report.",
    SIZE_DIFFERS: "The file size does not match the verified report.",
    NO_EXPECTED_HASH: "The verified report hash is missing.",
  };
  const shortSha = (value) => String(value || "").slice(0, 12);
  const fileBlock = dryRun?.report?.file;
  const fileLines = fileBlock?.expected
    ? `<p>Expected: ${esc(fileBlock.expected.filename || "")}, ${esc(fileBlock.expected.size)} bytes, sha256 ${esc(shortSha(fileBlock.expected.sha256))}</p><p>Seen: ${esc(fileBlock.chosen?.filename || "")}, ${esc(fileBlock.chosen?.size)} bytes, sha256 ${esc(shortSha(fileBlock.chosen?.sha256))}${fileBlock.reason ? `. ${esc(fileWords[fileBlock.reason] || fileBlock.reason)}` : ""}</p>`
    : `<p>File match: ${fileBlock?.match === true ? "yes" : "no"}.</p>`;
  const dryFieldRows = Array.isArray(dryRun?.report?.fields)
    ? dryRun.report.fields.map((row) => `<tr><th>${esc(row.key)}</th><td>${row.match ? "match" : "differs"}</td></tr>`).join("")
    : "";
  const dryRunHtml = dryRun ? `<div id="qcFillDryRunReport"><p>Dry run: ${esc(dryRun.outcome || "")}. Clicked: false.${dryRun.report?.arm?.reused === true ? " Reused the open run." : ""}</p>${dryRun.banner ? `<p id="qcFillDryRunBanner" style="color:#991b1b">${esc(dryRun.banner)}</p>` : ""}${dryFieldRows ? `<table id="qcFillDryRunFields"><tbody>${dryFieldRows}</tbody></table>` : ""}${fileLines}<p>Pre-save go: ${dryRun.report?.pre_save?.go === true ? "yes" : "no"}. Reset: ${dryRun.report?.reset?.ok === true ? "cleared" : "not cleared"}.</p><p>Payload keys: ${esc((dryRun.report?.payloadKeys || []).join(", "))}</p><p>${esc(dryRun.report?.serverNote || "The server run stays SAVE_ARMED or PRE_SAVE_ABORTED. That is expected.")}</p></div>` : "";
  const chosenName = String(state.qcFillChosenReportName || "");
  const inspectResult = state.qcFillInspectFileResult;
  const inspectFileHtml = chosenName ? `<p id="qcFillInspectFileName">Report to check: ${esc(chosenName)}. Click Check portal page to check it.</p>` : "";
  const inspectResultHtml = inspectResult ? `<p id="qcFillInspectFileResult">${inspectResult.ok === true ? "The report matched." : esc(fileWords[inspectResult.reason] || "The report did not match.")}</p>` : "";
  const nativeStatus = state.qcNativeSaveStatus || { buildAuthorized: false, tag: "D7.3" };
  const nativeOn = nativeStatus.buildAuthorized === true;
  const nativeDryPass = dryRun?.outcome === "DRY_RUN_PASS"
    && String(dryRun?.report?.preparationId || "") === String(state.qcPrepServer?.preparation_id || "");
  const saveDone = state.qcNativeSaveReport?.clicked === true
    || ["SAVE_AMBIGUOUS", "SAVE_CONFIRMED", "SAVE_UNAUTHORIZED", "SAVE_REJECTED", "SAVE_FOUND_UNAUTHORIZED", "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED", "FULLY_VERIFIED"].includes(latestStatus);
  const nativeEnabled = nativeOn
    && nativeDryPass
    && state.qcFillInspectOk === true
    && state.qcFillProvisionalAck === true
    && state.qcFillDerivedAck === true
    && state.qcPrepRunBusy !== true
    && !saveDone;
  const missingSave = [];
  if (state.qcFillInspectOk !== true) missingSave.push("Check portal page passed");
  if (!nativeDryPass) missingSave.push("Dry run passed in this session");
  if (state.qcFillProvisionalAck !== true || state.qcFillDerivedAck !== true) missingSave.push("both acknowledgements ticked");
  if (state.qcPrepRunBusy === true) missingSave.push("the current step to finish");
  let nativeHint = "";
  if (!nativeOn) nativeHint = "Save is off in this build (start with EAUSHADHI_QC_NATIVE_SAVE=D7.3)";
  else if (!nativeEnabled && saveDone) nativeHint = "Save already done for this run.";
  else if (!nativeEnabled && missingSave.length) nativeHint = `Save needs: ${missingSave.join(" · ")}`;
  const resolveParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date());
  const resolvePick = (type) => resolveParts.find((part) => part.type === type)?.value || "";
  const resolveDate = `${resolvePick("day")}-${resolvePick("month")}-${resolvePick("year")}`;
  const resolveLab = String((preflight?.fill_fields || state.qcNativeSaveReport?.filled_values || {}).labName || "").replace(/\s+/g, " ").trim();
  const resolveCount = state.qcNativeSaveReport?.after_count;
  const resolveCountKnown = resolveCount != null && resolveCount !== "" && Number.isFinite(Number(resolveCount));
  const resolveDefault = resolveCountKnown && resolveLab
    ? `Operator checked e-Aushadhi QC list on ${resolveDate} (IST): ${Number(resolveCount)} Karpooradi Thailam row(s) seen, lab ${resolveLab}.`
    : `Operator checked the e-Aushadhi QC list on ${resolveDate}.`;
  const resolveNote = state.qcFillResolveNoteTouched === true ? String(state.qcFillResolveNote || "") : resolveDefault;
  const saveReport = state.qcNativeSaveReport;
  const saveReportHtml = saveReport
    ? `<div id="qcNativeSaveReport"><p>Save outcome: ${esc(saveReport.outcome || "")}. List: ${esc(saveReport.listDelta || "")}.</p><p>${esc(saveReport.message || "")}</p></div>`
    : "";
  return `<section class="section-card" id="qcFillPreflightCard" data-build="UX-1">
    <h3 class="section-title">Portal filling preflight (B5)</h3>
    ${state.qcFillLoading ? `<p class="muted-note" id="qcFillLoading">Reading preflight.</p>` : ""}
    ${state.qcFillNotice ? `<p class="muted-note" id="qcFillNotice">${esc(state.qcFillNotice)}</p>` : ""}
    ${state.qcFillRunNotice ? `<p class="muted-note" id="qcFillRunNotice">${esc(state.qcFillRunNotice)}</p>` : ""}
    ${blockerHtml}
    <div id="qcFillFieldScroll"><table id="qcFillFields"><tbody>${fieldRows}</tbody></table></div>
    <p id="qcFillOthersNote">For Others, the portal saves the description itself as the type of study.</p>
    <p id="qcFillIssuer">Report issuer: ${esc(context.report_issuer || "")}</p>
    <p id="qcFillPortalLab">Portal laboratory: ${esc(context.laboratory_label || "")}</p>
    <p id="qcFillQualification">${esc(QC_FILL_QUALIFICATION)}</p>
    ${preflight?.protocol_mapping?.mapping_status === "VERIFIED" ? `<p id="qcFillMappingState">Others mapping ${esc(preflight.protocol_mapping.mapping_id)} is verified and read-only.</p>` : ""}
    ${derivedHtml ? `<ul id="qcFillDerivedFacts">${derivedHtml}</ul>` : ""}
    <p id="qcFillDerivedLabel">Required when filling starts.</p>
    ${provisional ? `<label><input id="qcFillProvisionalAck" type="checkbox"${state.qcFillProvisionalAck ? " checked" : ""}${writable ? "" : " disabled"}> ${esc(QC_FILL_PROVISIONAL_PREFILL)}</label>
    <label>Provisional laboratory note
      <textarea id="qcFillProvisionalNote"${writable ? "" : " disabled"}>${esc(state.qcFillProvisionalNote || "")}</textarea>
    </label>` : ""}
    <label><input id="qcFillDerivedAck" type="checkbox"${state.qcFillDerivedAck ? " checked" : ""}${writable && derived.length ? "" : " disabled"}> I acknowledge the derived value is suitable for the portal field</label>
    <label>Acknowledgement note
      <textarea id="qcFillDerivedNote"${writable && derived.length ? "" : " disabled"}>${esc(state.qcFillDerivedNote || "")}</textarea>
    </label>
    <p id="qcFillScope">Save only; Submit is not allowed.</p>
    <p id="qcFillSaveBlocked">${esc(QC_FILL_SAVE_BLOCKED)}</p>
    <p id="qcFillButtonsReason">${esc(dryRunReason)}</p>
    ${writable ? `<button type="button" class="icon-btn with-label" id="btnQcFillInspect">Check portal page</button>
    <button type="button" class="icon-btn with-label" id="btnQcFillDryRun"${dryRunEnabled ? "" : ` disabled title="${esc(dryRunReason)}"`}>Dry run (no Save)</button>
    <button type="button" class="icon-btn with-label" id="btnQcNativeSave"${nativeEnabled ? "" : " disabled"}${nativeHint ? ` title="${esc(nativeHint)}"` : ""}>Save to portal (one row)</button>
    ${nativeHint ? `<p class="muted-note why-disabled" id="qcNativeSaveHint">${esc(nativeHint)}</p>` : ""}
    <button type="button" class="icon-btn with-label" id="btnQcFillInspectFile">Choose report to check</button>
    ${inspectFileHtml}
    ${inspectResultHtml}
    <input id="qcFillInspectFile" type="file" accept="application/pdf,.pdf" hidden>
    <button type="button" class="icon-btn with-label primary" id="btnQcFillArm"${armDisabled}${armDisabled ? ` title="${esc(armReason)}"` : ""}>Arm filling</button>
    <button type="button" class="icon-btn with-label" id="btnQcFillFields"${armed && !state.qcPrepRunBusy ? "" : " disabled"}>Fill portal fields</button>
    <button type="button" class="icon-btn with-label" id="btnQcFillChooseReport"${state.qcFillRun?.filled ? "" : " disabled"}>Choose verified report</button>
    <input id="qcFillReportFile" type="file" accept="application/pdf,.pdf" hidden>
    <button type="button" class="icon-btn with-label" id="btnQcFillReview"${state.qcFillRun?.reportReady ? "" : " disabled"}>Review before Save</button>
    <p id="qcFillOrderHint">Dry run arms its own run, or reuses an open dry-run run for this preparation. Do not click Arm filling first.</p>` : ""}
    ${recovery && writable ? `<p id="qcFillCheckList">Check the portal list.</p>
    <label>Note<textarea id="qcFillResolveNote">${esc(resolveNote)}</textarea></label>
    <label><input id="qcFillResolveAttest" type="checkbox"> I checked the portal list for this product.</label>
    <button type="button" class="icon-btn with-label" id="btnQcFillFound">Found on the list</button>
    <button type="button" class="icon-btn with-label" id="btnQcFillMissing">Not on the list</button>
    ${latestStatus === "SAVE_ARMED" ? `<button type="button" class="icon-btn with-label" id="btnQcFillUnknown">Record unknown result</button>` : ""}` : ""}
    ${latestStatus === "SAVE_CONFIRMED" && writable ? `<button type="button" class="icon-btn with-label" id="btnQcFillVerify">Read the saved row</button>` : ""}
    ${runHtml ? `<ul id="qcFillRuns">${runHtml}</ul>` : ""}
    ${dryRunHtml}
    ${saveReportHtml}
    ${recaptureHtml}
    <p class="muted-note" id="qcFillBuild">UI build UX-1</p>
  </section>`;
}

async function submitQcFillInspect() {
  if (state.qcPrepRunBusy || canWrite() !== true || !workerApiAvailable()) return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  const file = qcFillInspectPendingFile;
  state.qcGovernanceConfirmOpen = true;
  try {
    const accepted = await openQcConfirm({
      title: "Check portal page",
      message: "This reads Add QC Register, the QC list, and the laboratory options. It does not arm filling and it does not press Save.",
      okLabel: "Check page",
      returnFocusId: "btnQcFillInspect",
      idPrefix: "qcFillInspectConfirm",
    });
    if (accepted !== true || state.selectedProductId !== productId) return;
    state.qcPrepRunBusy = true;
    state.qcFillRunNotice = "";
    state.qcFillRecapture = null;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    let bytes = null;
    if (file) bytes = new Uint8Array(await file.arrayBuffer());
    const result = await executeQcPrepRun(productId, token, {
      action: "inspect",
      preparationId,
      userConfirmed: true,
      filename: file?.name || "",
      bytes,
    });
    if (state.selectedProductId !== productId) return;
    state.qcFillInspectOk = result?.ok === true;
    state.qcFillInspectFileResult = result?.report ? { ok: result.report.ok === true, reason: result.report.reason || null } : null;
    state.qcFillCheckedReport = file && result?.report?.ok === true ? { name: file.name, bytes } : null;
    qcFillInspectPendingFile = null;
    state.qcFillRecapture = result?.recapture && typeof result.recapture === "object" ? result.recapture : null;
    state.qcFillRecaptureFor = productId;
    state.qcFillRunNotice = result?.message || "Save was not pressed. Filling was not armed.";
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcFillDryRun() {
  if (Number(state.selectedProductId) === 262) return;
  if (state.qcFillInspectOk !== true || !qcFillArmReady()) return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  const report = state.qcFillCheckedReport;
  state.qcGovernanceConfirmOpen = true;
  try {
    const accepted = await openQcConfirm({
      title: "Dry run (no Save)",
      message: "This fills Add QC Register, checks the values, and clears the form. It does not press Save.",
      okLabel: "Dry run",
      returnFocusId: "btnQcFillDryRun",
      idPrefix: "qcFillDryRunConfirm",
    });
    if (accepted !== true || state.selectedProductId !== productId) return;
    state.qcPrepRunBusy = true;
    state.qcFillRunNotice = "";
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "dryRun",
      preparationId,
      userConfirmed: true,
      provisionalAck: state.qcFillProvisionalAck === true,
      provisionalNote: state.qcFillProvisionalNote,
      derivedAck: state.qcFillDerivedAck === true,
      derivedNote: state.qcFillDerivedNote,
      filename: report?.name || "",
      bytes: report?.bytes || null,
    });
    if (state.selectedProductId !== productId) return;
    if (result && typeof result === "object") {
      delete result.pre_save_token;
      delete result.token;
    }
    state.qcFillDryRun = result || null;
    state.qcFillRunNotice = result?.banner || result?.message || "Save was not pressed.";
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function openQcNativeSaveDialog(details) {
  if (openQcNativeSaveDialog.showing === true) return Promise.resolve(false);
  openQcNativeSaveDialog.showing = true;
  const lines = [
    `Product: ${details.productName} (${details.productId})`,
    ...QC_FILL_FIELD_ROWS.map(([key, label]) => `${label}: ${details.fields?.[key] ?? ""}`),
    `Report file: ${details.filename}`,
    `SHA-256: ${details.sha12}`,
    `Run: ${details.runId}`,
    "Provisional laboratory: HARIDEV FORMULATIONS. Readiness: READY_PROVISIONAL.",
    `Derived start date: ${details.derivedNote}`,
    "This presses the green Submit button on Add QC Register once. It saves one row that stays editable and deletable. It does not submit anything else.",
  ];
  return new Promise((resolve) => {
    let closed = false;
    const backdrop = document.createElement("div");
    backdrop.id = "qcNativeSaveBackdrop";
    backdrop.className = "sasv-modal-backdrop ea-source-resolve";
    const dialog = document.createElement("div");
    dialog.id = "qcNativeSaveDialog";
    dialog.className = "sasv-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "qcNativeSaveTitle");
    dialog.tabIndex = -1;
    const header = document.createElement("div");
    header.className = "sasv-modal__header";
    const titleEl = document.createElement("h2");
    titleEl.id = "qcNativeSaveTitle";
    titleEl.className = "sasv-modal__title";
    titleEl.textContent = "Save to portal (one row)";
    header.append(titleEl);
    const body = document.createElement("div");
    body.id = "qcNativeSaveBody";
    body.className = "sasv-modal__body";
    for (const line of lines) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      body.append(paragraph);
    }
    const tick = document.createElement("input");
    tick.type = "checkbox";
    tick.id = "qcNativeSaveAuthorize";
    const tickLabel = document.createElement("label");
    const tickText = document.createElement("span");
    tickText.textContent = " I authorize one Save for this run";
    tickLabel.append(tick, tickText);
    const typed = document.createElement("input");
    typed.type = "text";
    typed.id = "qcNativeSavePhrase";
    typed.autocomplete = "off";
    body.append(tickLabel, typed);
    const footer = document.createElement("div");
    footer.className = "sasv-modal__footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "qcNativeSaveCancel";
    cancelBtn.className = "icon-btn with-label";
    cancelBtn.textContent = "Cancel";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.id = "qcNativeSaveOk";
    okBtn.className = "icon-btn with-label primary";
    okBtn.textContent = "Confirm";
    okBtn.disabled = true;
    footer.append(cancelBtn, okBtn);
    dialog.append(header, body, footer);
    backdrop.append(dialog);
    okBtn.setAttribute("data-requires-role", "APPROVER");
    const syncOk = () => {
      const phraseOk = tick.checked === true && typed.value === "SAVE 262";
      const decision = actionDecision({
        id: "qcNativeSaveOk",
        label: "Confirm",
        disabled: !phraseOk,
        requiresRole: "APPROVER",
        title: phraseOk ? "" : "Type SAVE 262 and tick the acknowledgement.",
        ...workspaceActionContext(),
      });
      setActionState(okBtn, decision);
    };
    tick.addEventListener("change", syncOk);
    typed.addEventListener("input", syncOk);
    syncOk();
    const close = (accepted) => {
      if (closed) return;
      closed = true;
      openQcNativeSaveDialog.showing = false;
      document.removeEventListener("keydown", onKeydown, true);
      backdrop.remove();
      const button = document.getElementById("btnQcNativeSave");
      if (button && typeof button.focus === "function") button.focus();
      resolve(accepted === true);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(false);
        return;
      }
      trapModalTab(event, "qcNativeSaveDialog");
    };
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    cancelBtn.addEventListener("click", () => close(false));
    okBtn.addEventListener("click", () => {
      if (okBtn.disabled || Number(state.selectedProductId) === 262) return;
      close(true);
    });
    document.body.append(backdrop);
    document.addEventListener("keydown", onKeydown, true);
    cancelBtn.focus();
  });
}

async function submitQcNativeSave() {
  if (Number(state.selectedProductId) === 262) return;
  const nativeOn = state.qcNativeSaveStatus?.buildAuthorized === true;
  const dryRun = state.qcFillDryRun;
  const preparationId = state.qcPrepServer?.preparation_id || "";
  const ready = nativeOn
    && dryRun?.outcome === "DRY_RUN_PASS"
    && String(dryRun?.report?.preparationId || "") === String(preparationId)
    && state.qcFillInspectOk === true
    && state.qcFillProvisionalAck === true
    && state.qcFillDerivedAck === true
    && state.qcPrepRunBusy !== true;
  if (!ready) return;
  const productId = state.selectedProductId;
  const report = state.qcFillCheckedReport;
  const sha = String(dryRun?.report?.file?.expected?.sha256 || dryRun?.report?.file?.chosen?.sha256 || "");
  const accepted = await openQcNativeSaveDialog({
    productName: "Karpooradi Thailam",
    productId: 262,
    fields: state.qcFillPreflight?.fill_fields || {},
    filename: dryRun?.report?.file?.expected?.filename || report?.name || "",
    sha12: sha.slice(0, 12),
    runId: dryRun?.report?.run_id || "",
    derivedNote: state.qcFillDerivedNote || "",
  });
  if (accepted !== true || state.selectedProductId !== productId) return;
  state.qcPrepRunBusy = true;
  state.qcFillRunNotice = "";
  if (state.tab === "qc") renderQc();
  try {
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "nativeSaveConfirm",
      preparationId,
      runId: dryRun?.report?.run_id || "",
      fingerprint: dryRun?.report?.fingerprint || "",
      userConfirmed: true,
      provisionalAck: state.qcFillProvisionalAck === true,
      provisionalNote: state.qcFillProvisionalNote,
      derivedAck: state.qcFillDerivedAck === true,
      derivedNote: state.qcFillDerivedNote,
      filename: report?.name || "",
      bytes: report?.bytes || null,
    });
    if (state.selectedProductId !== productId) return;
    if (result && typeof result === "object") {
      delete result.pre_save_token;
      delete result.token;
      delete result.nonce;
      delete result.confirmNonce;
    }
    state.qcNativeSaveReport = result?.report || null;
    state.qcFillRunNotice = result?.message || "";
    const latest = state.qcFillPreflight?.runs?.[0];
    if (latest && result?.runStatus) latest.run_status = result.runStatus;
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcFillArm() {
  if (Number(state.selectedProductId) === 262) return;
  if (!qcFillArmReady()) return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  state.qcGovernanceConfirmOpen = true;
  try {
    const accepted = await openQcConfirm({
      title: "Arm QC filling",
      message: "This reads the portal QC list and arms filling for product 262. It does not press Save.",
      okLabel: "Arm filling",
      returnFocusId: "btnQcFillArm",
      idPrefix: "qcFillArmConfirm",
    });
    if (accepted !== true || state.selectedProductId !== productId) return;
    state.qcPrepRunBusy = true;
    state.qcFillRunNotice = "";
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "arm",
      preparationId,
      userConfirmed: true,
      provisionalAck: state.qcFillProvisionalAck === true,
      provisionalNote: state.qcFillProvisionalNote,
      derivedAck: state.qcFillDerivedAck === true,
      derivedNote: state.qcFillDerivedNote,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcFillRunNotice = result.message || "Filling was not started.";
      return;
    }
    state.qcFillRun = { ...(result.session || {}), runStatus: result.runStatus, clickState: "not-clicked" };
    state.qcFillRunNotice = "Filling is armed. Save was not pressed.";
    state.qcFillLoadedFor = "";
    queueQcFillPreflight();
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcFillFields() {
  if (state.qcPrepRunBusy || state.qcFillRun?.runStatus !== "SAVE_ARMED") return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  state.qcGovernanceConfirmOpen = true;
  try {
    const accepted = await openQcConfirm({
      title: "Fill portal fields",
      message: "This types the frozen values into Add QC Register. It does not press Save.",
      okLabel: "Fill fields",
      returnFocusId: "btnQcFillFields",
      idPrefix: "qcFillFieldsConfirm",
    });
    if (accepted !== true || state.selectedProductId !== productId) return;
    state.qcPrepRunBusy = true;
    if (state.tab === "qc") renderQc();
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "fill",
      preparationId,
      userConfirmed: true,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcFillRunNotice = result.message || "The page does not match the frozen values. Nothing was saved. Start filling again.";
      state.qcFillRun = null;
      return;
    }
    state.qcFillRun = { ...(state.qcFillRun || {}), ...(result.session || {}), filled: true };
    state.qcFillRunNotice = "The portal form matches the frozen values. Save was not pressed.";
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcGovernanceConfirmOpen = false;
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcFillReport(file) {
  if (!file || state.qcPrepRunBusy || !state.qcFillRun?.filled) return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  state.qcPrepRunBusy = true;
  state.qcFillReportName = file.name;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "checkPdf",
      preparationId,
      filename: file.name,
      bytes,
    });
    if (state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcFillRunNotice = result.message || "This file does not match the verified QC report. It was not attached.";
      return;
    }
    state.qcFillRun = { ...(state.qcFillRun || {}), reportReady: true };
    state.qcFillRunNotice = "The verified report is attached. Save was not pressed.";
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function openQcFillSaveReview() {
  if (openQcConfirm.showing === true) return Promise.resolve(false);
  openQcConfirm.showing = true;
  const prefix = "qcFillSaveReview";
  const fields = state.qcFillPreflight?.fill_fields || {};
  const context = state.qcFillPreflight?.context || {};
  return new Promise((resolve) => {
    let closed = false;
    const backdrop = document.createElement("div");
    backdrop.id = `${prefix}Backdrop`;
    backdrop.className = "sasv-modal-backdrop ea-source-resolve";
    const dialog = document.createElement("div");
    dialog.id = `${prefix}Dialog`;
    dialog.className = "sasv-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    const title = document.createElement("h2");
    title.id = `${prefix}Title`;
    title.className = "sasv-modal__title";
    title.textContent = "Review QC Register before Save";
    const body = document.createElement("div");
    body.className = "sasv-modal__body";
    body.id = `${prefix}Body`;
    for (const [key, label] of QC_FILL_FIELD_ROWS) {
      const line = document.createElement("p");
      line.textContent = `${label}: ${fields[key] ?? ""}`;
      body.append(line);
    }
    const fileLine = document.createElement("p");
    fileLine.textContent = `Attached report: ${state.qcFillReportName || ""}`;
    const issuer = document.createElement("p");
    issuer.textContent = `Report issuer: ${context.report_issuer || ""}`;
    const lab = document.createElement("p");
    lab.textContent = `Portal laboratory: ${context.laboratory_label || ""}`;
    const qualification = document.createElement("p");
    qualification.id = "qcFillReviewQualification";
    qualification.textContent = QC_FILL_QUALIFICATION;
    const derived = document.createElement("p");
    derived.textContent = `Derived-date note: ${state.qcFillDerivedNote || ""}`;
    const scope = document.createElement("p");
    scope.id = "qcFillReviewScope";
    scope.textContent = "Save only; Submit is not allowed.";
    const blocked = document.createElement("p");
    blocked.id = "qcFillReviewBlocked";
    blocked.textContent = QC_FILL_SAVE_BLOCKED;
    body.append(fileLine, issuer, lab, qualification, derived, scope, blocked);
    const footer = document.createElement("div");
    footer.className = "sasv-modal__footer";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.id = `${prefix}Cancel`;
    cancel.className = "icon-btn with-label";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.id = `${prefix}Ok`;
    ok.className = "icon-btn with-label primary";
    ok.textContent = "Save";
    ok.disabled = true;
    footer.append(cancel, ok);
    const header = document.createElement("div");
    header.className = "sasv-modal__header";
    header.append(title);
    dialog.append(header, body, footer);
    backdrop.append(dialog);
    const close = (accepted) => {
      if (closed) return;
      closed = true;
      openQcConfirm.showing = false;
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      document.getElementById("btnQcFillReview")?.focus();
      resolve(accepted === true);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    };
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    document.body.append(backdrop);
    document.addEventListener("keydown", onKey, true);
    dialog.focus();
  });
}

async function submitQcFillReview() {
  if (!state.qcFillRun?.reportReady || state.qcPrepRunBusy) return;
  const accepted = await openQcFillSaveReview();
  if (accepted !== true) return;
  state.qcFillRunNotice = QC_FILL_SAVE_BLOCKED;
  if (state.tab === "qc") renderQc();
}

async function submitQcFillResolve(resolution) {
  if (state.qcPrepRunBusy || state.qcGovernanceConfirmOpen) return;
  const note = String(document.getElementById("qcFillResolveNote")?.value || "").trim();
  const attest = document.getElementById("qcFillResolveAttest")?.checked === true;
  if (note.length < 10 || !attest) {
    state.qcFillRunNotice = "Tick the attestation and write at least 10 characters.";
    renderQc();
    return;
  }
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  const runId = state.qcFillPreflight?.runs?.[0]?.run_id;
  state.qcPrepRunBusy = true;
  try {
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "resolve",
      preparationId,
      runId,
      resolution,
      note,
      attest: true,
      userConfirmed: true,
    });
    if (state.selectedProductId !== productId) return;
    state.qcFillRunNotice = result?.message || "Check the portal list.";
    if (result?.runStatus === "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED" || result?.display?.text) {
      state.qcFillRunNotice = result.display?.text || state.qcFillRunNotice;
    }
    state.qcFillLoadedFor = "";
    queueQcFillPreflight();
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcFillUnknown() {
  if (state.qcPrepRunBusy) return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  const accepted = await openQcConfirm({
    title: "Unknown Save result",
    message: "This session cannot tell whether Save was pressed. Check the portal list. This records the result as unknown and does not press Save again.",
    okLabel: "Record unknown result",
    returnFocusId: "btnQcFillUnknown",
    idPrefix: "qcFillUnknownConfirm",
  });
  if (accepted !== true) return;
  state.qcPrepRunBusy = true;
  try {
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "recover",
      preparationId,
      userConfirmed: true,
    });
    if (state.selectedProductId !== productId) return;
    state.qcFillRunNotice = result?.message || "Check the portal list.";
    state.qcFillLoadedFor = "";
    queueQcFillPreflight();
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

async function submitQcFillVerify() {
  if (state.qcPrepRunBusy) return;
  const productId = state.selectedProductId;
  const preparationId = state.qcPrepServer?.preparation_id;
  state.qcPrepRunBusy = true;
  try {
    const token = await sessionAccessToken();
    const result = await executeQcPrepRun(productId, token, {
      action: "verify",
      preparationId,
      runId: state.qcFillPreflight?.runs?.[0]?.run_id,
      userConfirmed: true,
    });
    if (state.selectedProductId !== productId) return;
    state.qcFillRunNotice = result?.display?.text || result?.message || "The row was not verified.";
    state.qcFillLoadedFor = "";
    queueQcFillPreflight();
  } catch (error) {
    if (state.selectedProductId === productId) state.qcFillRunNotice = userMessageForError(error);
  } finally {
    state.qcPrepRunBusy = false;
    if (state.selectedProductId === productId && state.tab === "qc") renderQc();
  }
}

function onQcGovernanceField(event) {
  const target = event.target;
  const focusId = target?.id || "";
  const selectionStart = target?.selectionStart;
  const selectionEnd = target?.selectionEnd;
  if (target?.id === "qcLabDocumentReference" || target?.id === "qcLabRationale" || target?.id === "qcLabAttest") {
    state.qcLabDraftSeeded = true;
    if (target.id === "qcLabDocumentReference") state.qcLabDocumentReference = target.value;
    if (target.id === "qcLabRationale") state.qcLabRationale = target.value;
    if (target.id === "qcLabAttest") state.qcLabAttest = target.checked === true;
  } else if (target?.getAttribute?.("data-qc-accept-fact")) {
    const key = target.getAttribute("data-qc-accept-fact");
    const draft = qcFactAcceptDraft(key);
    draft.touched = true;
    const role = target.getAttribute("data-qc-accept-role");
    if (role === "category") draft.category = target.value;
    if (role === "note") draft.note = target.value;
    if (role === "attest") draft.attest = target.checked === true;
  } else if (target?.getAttribute?.("data-qc-correct-fact")) {
    const key = target.getAttribute("data-qc-correct-fact");
    const item = (state.qcReadiness?.operator_asserted_facts || []).find((row) => row?.fact === key);
    const draft = item ? qcFactCorrectDraft(item) : null;
    if (!draft) return;
    draft.touched = true;
    const role = target.getAttribute("data-qc-correct-role");
    if (role === "category") draft.category = target.value;
    if (role === "note") draft.note = target.value;
    if (role === "reason") draft.reason = target.value;
    if (role === "attest") draft.attest = target.checked === true;
  } else if (target?.id === "qcMappingReason" || target?.id === "qcMappingAttest") {
    state.qcMappingSeeded = true;
    if (target.id === "qcMappingReason") state.qcMappingReason = target.value;
    if (target.id === "qcMappingAttest") state.qcMappingAttest = target.checked === true;
  } else if (target?.id === "qcFillProvisionalNote" || target?.id === "qcFillProvisionalAck" || target?.id === "qcFillDerivedNote" || target?.id === "qcFillDerivedAck") {
    state.qcFillAckSeeded = true;
    if (target.id === "qcFillProvisionalNote") state.qcFillProvisionalNote = target.value;
    if (target.id === "qcFillDerivedNote") {
      state.qcFillDerivedNote = target.value;
      state.qcFillDerivedNoteTouched = true;
    }
    if (target.id === "qcFillProvisionalAck") state.qcFillProvisionalAck = target.checked === true;
    if (target.id === "qcFillDerivedAck") state.qcFillDerivedAck = target.checked === true;
  } else if (target?.id === "qcFillResolveNote") {
    state.qcFillResolveNote = target.value;
    state.qcFillResolveNoteTouched = true;
    return;
  } else {
    return;
  }
  if (state.tab !== "qc") return;
  renderQc();
  const el = document.getElementById(focusId);
  if (!el) return;
  el.focus();
  if (typeof selectionStart === "number" && typeof el.setSelectionRange === "function") {
    el.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
  }
}

function qcPreparationWorkspaceMarkup() {
  const available = workerApiAvailable();
  if (!available) {
    return `<section class="section-card qc-prep-workspace"><h3 class="section-title">QC Preparation (Product 262)</h3><p class="muted-note">QC preparation is available only in the SASV Electron app.</p></section>`;
  }
  const form = qcPrepForm();
  const verified = state.qcPrepServer?.preparation_status === "VERIFIED";
  const locked = verified || !canWrite() || state.busy || state.qcPrepLoading || state.qcPrepLabsUnavailable;
  const protocolCode = qcPrepProtocolCode(form);
  const showOther = protocolCode === "OTHER" || String(form.other_testing_protocol_text || "").trim() !== "";
  const knownIds = new Set(state.qcPrepOptions.map((item) => String(item.term_id)));
  const savedMissing = Boolean(form.testing_protocol_term_id) && !knownIds.has(String(form.testing_protocol_term_id));
  const serverReasons = [...new Set(state.qcPrepReasons || [])].map((code) => qcPrepReasonText(code));
  const localHints = [...new Set(qcPrepLocalHints(form))].map((code) => qcPrepReasonText(code));
  const reasons = [...new Set([...serverReasons, ...localHints])];
  const fieldsComplete = state.qcPrepFieldsComplete === true && reasons.length === 0;
  return qcPrepWorkspaceHtml({
    open: state.qcPrepOpen,
    status: qcPrepStatusText(state.qcPrepServer, state.qcPrepLoading),
    verified,
    disabled: locked ? " disabled" : "",
    notice: state.qcPrepNotice,
    defaultsNote: state.qcPrepDefaultsApplied === true,
    labsUnavailable: state.qcPrepLabsUnavailable === true,
    fieldsComplete,
    reasons,
    serverReasons,
    localHints,
    showOther,
    protocolOptions: state.qcPrepOptions,
    protocolId: form.testing_protocol_term_id,
    savedProtocolMissing: savedMissing,
    otherText: form.other_testing_protocol_text,
    studyStart: form.study_start_date,
    studyEnd: form.study_end_date,
    reportDate: form.report_date,
    dateBasis: QC_PREP_DATE_BASIS,
    dateBasisSelected: form.date_basis === QC_PREP_DATE_BASIS,
    dateNote: form.date_evidence_note,
    reportDateNote: form.report_date_evidence_note,
    shelf: form.shelf_life_months,
    batches: form.batches,
    mode: form.quality_control_mode,
    issuer: form.source_report_issuer,
    approval: form.source_report_approval_no,
    lab: form.portal_laboratory_candidate,
    labs: state.qcPrepLabs,
    sha: form.report_sha256,
    evidence: form.report_evidence_note,
    noteOverrides: state.qcPrepNoteOverrides,
    reportRegistered: Boolean(qcRegisteredReport(state.qcPrepServer?.preparation_id)),
    reportVersion: qcRegisteredReport(state.qcPrepServer?.preparation_id)
      ? String(qcRegisteredReport(state.qcPrepServer?.preparation_id).version_no).padStart(2, "0")
      : "",
    reportFileName: qcRegisteredReport(state.qcPrepServer?.preparation_id)?.expected_file_name || "",
    byteCheck: qcReportByteLabel(
      qcRegisteredReport(state.qcPrepServer?.preparation_id),
      state.qcReportByteResult,
    ),
    reviewDisabled: access.canView !== true || !available || state.busy || state.qcPrepLoading,
    saveDisabled: !canWrite() || locked,
    reloadDisabled: access.canView !== true || state.busy,
  }) + qcSourceFactsCardHtml(qcSourceFactsModel()) + qcReadinessCardHtml() + qcLabDecisionCardHtml() + qcFactAcceptCardHtml() + qcFactCorrectCardHtml() + qcProtocolMappingCardHtml() + qcFillPreflightCardHtml();
}

function qcPrepReadField(id) {
  return document.getElementById(id)?.value ?? "";
}

function syncQcPrepFormFromDom() {
  const form = qcPrepForm();
  if (!document.getElementById("qcPrepProtocol")) return form;
  form.testing_protocol_term_id = qcPrepReadField("qcPrepProtocol");
  if (qcPrepProtocolCode(form) !== "OTHER") form.other_testing_protocol_text = "";
  else form.other_testing_protocol_text = qcPrepReadField("qcPrepOther");
  form.study_start_date = qcPrepReadField("qcPrepStart");
  form.study_end_date = qcPrepReadField("qcPrepEnd");
  form.report_date = qcPrepReadField("qcPrepReportDate");
  form.date_basis = qcPrepReadField("qcPrepDateBasis");
  if (state.qcPrepNoteOverrides?.date_evidence_note && document.getElementById("qcPrepDateNote")) {
    form.date_evidence_note = qcPrepReadField("qcPrepDateNote");
  }
  if (state.qcPrepNoteOverrides?.report_date_evidence_note && document.getElementById("qcPrepReportDateNote")) {
    form.report_date_evidence_note = qcPrepReadField("qcPrepReportDateNote");
  }
  form.shelf_life_months = qcPrepReadField("qcPrepShelf");
  form.batches = qcPrepReadField("qcPrepBatches");
  const selectedMode = document.querySelector("input[name='qcPrepMode']:checked");
  form.quality_control_mode = selectedMode?.value || "";
  form.source_report_issuer = qcPrepReadField("qcPrepIssuer");
  form.source_report_approval_no = qcPrepReadField("qcPrepApproval");
  form.portal_laboratory_candidate = qcPrepReadField("qcPrepPortalLab");
  if (state.qcPrepNoteOverrides?.report_evidence_note && document.getElementById("qcPrepEvidenceNote")) {
    form.report_evidence_note = qcPrepReadField("qcPrepEvidenceNote");
  }
  return form;
}

let qcPrepPendingFocusId = "";
let qcPrepPendingBlurId = "";
let qcPrepTabDirection = 0;
let qcPrepTabFieldId = "";

function onQcPrepField(event) {
  const target = event.target;
  if (target?.closest?.("#qcLabDecisionCard") || target?.closest?.("#qcFactAcceptCard") || target?.closest?.("#qcFactCorrectCard") || target?.closest?.("#qcProtocolMappingCard") || target?.closest?.("#qcFillPreflightCard")) {
    onQcGovernanceField(event);
    return;
  }
  if (target?.closest?.("#qcSourceFactsCard")) {
    onQcSourceFactField(event);
    return;
  }
  if (!target?.closest?.("#qcPreparationWorkspace")) return;
  if (state.qcPrepServer?.preparation_status === "VERIFIED" || !canWrite()) return;
  syncQcPrepFormFromDom();
  state.qcPrepDirty = true;
  const noteKey = target.getAttribute?.("data-qc-note");
  if (noteKey && event.type === "change") {
    state.qcPrepNoteOverrides[noteKey] = target.checked === true;
    if (target.checked !== true) {
      qcPrepForm()[noteKey] = qcPrepGeneratedNotes(qcPrepForm(), state.qcPrepOptions || [])[noteKey];
    }
    renderQc();
    return;
  }
  qcPrepApplyGeneratedNotes();
  qcPrepSyncNoteViews();
  if ((target.id === "qcPrepStart" || target.id === "qcPrepEnd" || target.id === "qcPrepReportDate")
    && (event.type === "input" || event.type === "change")) {
    return;
  }
  state.qcPrepReasons = [];
  state.qcPrepFieldsComplete = false;
  if (target.id === "qcPrepProtocol") {
    if (qcPrepProtocolCode(qcPrepForm()) !== "OTHER") qcPrepForm().other_testing_protocol_text = "";
    renderQc();
  }
  if (target.id === "qcPrepPortalLab") renderQc();
  const liveField = target.id === "qcPrepBatches"
    || target.id === "qcPrepShelf"
    || target.id === "qcPrepOther"
    || target.id === "qcPrepIssuer"
    || target.name === "qcPrepMode";
  if (event.type === "change" && liveField) {
    const changedId = target.id || "";
    const active = document.activeElement;
    const activeId = active?.id && active.id !== changedId && active.closest?.("#qcPreparationWorkspace")
      ? active.id
      : "";
    const recordedId = qcPrepPendingBlurId === changedId ? qcPrepPendingFocusId : "";
    const destinationId = event.relatedTarget?.id || recordedId || activeId;
    const tabDirection = qcPrepTabFieldId === changedId ? qcPrepTabDirection : 0;
    qcPrepPendingFocusId = "";
    qcPrepPendingBlurId = "";
    qcPrepTabDirection = 0;
    qcPrepTabFieldId = "";
    renderQc();
    focusQcPrepFieldChangeDestination(changedId, destinationId === changedId ? "" : destinationId, tabDirection);
  }
}

function focusQcPrepFieldChangeDestination(changedId, destinationId, tabDirection) {
  const destination = destinationId && destinationId !== changedId
    ? document.getElementById(destinationId)
    : null;
  if (destination) {
    destination.focus({ preventScroll: false });
    return;
  }
  if (tabDirection !== 1 && tabDirection !== -1) return;
  const root = document.getElementById("qcPreparationWorkspace");
  if (!root || !changedId) return;
  const focusable = [...root.querySelectorAll("a[href], button, input, select, textarea, summary")].filter((el) => {
    return !el.disabled && el.tabIndex >= 0;
  });
  const index = focusable.findIndex((el) => el.id === changedId);
  if (index < 0) return;
  const neighbor = focusable[index + tabDirection];
  if (!neighbor || neighbor.id === changedId) return;
  neighbor.focus({ preventScroll: false });
}

function releaseQcPrepReviewBusy(snapshot) {
  return {
    busy: snapshot?.ownsBusy === true ? false : snapshot?.busy === true,
    render: snapshot?.selectedProductId === snapshot?.productId,
  };
}

async function submitQcPreparationReview() {
  if (access.canView !== true || state.busy || state.qcPrepLoading) return;
  if (!workerApiAvailable() || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  const productId = state.selectedProductId;
  const request = ++state.qcPrepRequest;
  const form = syncQcPrepFormFromDom();
  qcPrepApplyGeneratedNotes(form);
  let ownsBusy = false;
  state.busy = true;
  ownsBusy = true;
  try {
    const token = await sessionAccessToken();
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    const result = await reviewQcPreparation(productId, token, qcPrepPayloadFromForm(form));
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcPrepNotice = userMessageForError({ message: result.message }) || "QC preparation workspace failed.";
      showToast(state.qcPrepNotice, "error");
      return;
    }
    state.qcPrepReasons = Array.isArray(result?.review?.reasons) ? result.review.reasons : [];
    state.qcPrepFieldsComplete = state.qcPrepReasons.length === 0;
    if (state.qcPrepFieldsComplete) {
      state.qcPrepNotice = "Fields complete (draft only)";
      showToast("Fields complete (draft only)", "success");
    } else {
      state.qcPrepNotice = "Server review found items to complete.";
      showToast(`Server review: ${state.qcPrepReasons.length} item(s) to complete`, "warning");
    }
  } catch (error) {
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    state.qcPrepNotice = userMessageForError(error);
    showToast(state.qcPrepNotice, "error");
  } finally {
    const settled = releaseQcPrepReviewBusy({
      ownsBusy,
      busy: state.busy,
      selectedProductId: state.selectedProductId,
      productId,
    });
    state.busy = settled.busy;
    if (settled.render) {
      renderQc();
      revealQcPrepResult("btnQcPrepReview");
    }
  }
}

async function submitQcPreparationSave() {
  if (!canWrite() || state.busy || state.qcPrepLoading || state.qcPrepAmbiguous || state.qcPrepLabsUnavailable) return;
  if (!workerApiAvailable() || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (state.qcPrepServer?.preparation_status === "VERIFIED") return;
  const productId = state.selectedProductId;
  const request = ++state.qcPrepRequest;
  const form = syncQcPrepFormFromDom();
  qcPrepApplyGeneratedNotes(form);
  const server = state.qcPrepServer;
  state.busy = true;
  try {
    const token = await sessionAccessToken();
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    const result = await saveQcPreparation(productId, token, {
      preparationId: server?.preparation_id ?? null,
      expectedRowVersion: server ? server.row_version : 0,
      payload: qcPrepPayloadFromForm(form),
      lastReadStatus: server?.preparation_status ?? null,
    });
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    if (result?.ok === false) {
      state.qcPrepNotice = userMessageForError({ message: result.message }) || "QC preparation workspace failed.";
      showToast(state.qcPrepNotice, "error");
      return;
    }
    const notice = `Draft saved (version ${result.row_version})`;
    showToast(notice, "success");
    state.qcPrepDirty = false;
    state.qcEvidenceLoadedFor = null;
    state.qcEvidenceLoading = false;
    state.busy = false;
    await refreshStageReview();
    reloadQcPreparationWorkspace({ preserveNotice: notice });
  } catch (error) {
    if (request !== qcPrepCurrent() || state.selectedProductId !== productId) return;
    state.qcPrepNotice = userMessageForError(error);
    showToast(state.qcPrepNotice, "error");
  } finally {
    if (request === qcPrepCurrent()) state.busy = false;
    if (state.selectedProductId === productId) renderQc();
  }
}

function workerFoundationSummary(result) {
  if (!result) return "No foundation check has been run for this product.";
  const reasons = Array.isArray(result.preflight?.reasons)
    ? result.preflight.reasons
    : [];
  const reasonText = reasons.length ? reasons.join("; ") : "None";
  return [
    `Result: ${result.errorKind || "OK"}`,
    `Preflight eligible: ${result.preflight?.eligible === true ? "yes" : "no"}`,
    `Reasons: ${reasonText}`,
    `Payload hash: ${result.payloadHash || "n/a"}`,
    `Entry status unchanged: ${result.entryStatus || "n/a"}`,
    "This check does not fill the portal, Save, or change ENTERED / PORTAL_VERIFIED / SUBMITTED.",
  ].join(" ");
}

const QC_PREPARATION_READ_EMPTY_LIST =
  "QC preparation read probe did not return an empty preparation list.";

function workerQcPreparationReadSummary(result) {
  if (!result) return "QC preparation read probe has not been run.";
  if (result.ok === true && result.recordCount === 0) {
    return "QC preparation read probe returned no preparations.";
  }
  if (result.errorKind === "AUTHORIZATION" || result.errorKind === "UNAUTHORIZED_RENDERER") {
    return "QC preparation read probe: not authorized.";
  }
  if (result.errorKind === "UNSUPPORTED_PLATFORM") {
    return "QC preparation read probe is available only in the SASV Electron app.";
  }
  if (result.errorKind === "PRODUCT_NOT_ALLOWED") {
    return "QC preparation read probe accepts only product 262.";
  }
  if (result.message === QC_PREPARATION_READ_EMPTY_LIST) return QC_PREPARATION_READ_EMPTY_LIST;
  return "QC preparation read probe failed.";
}

function renderWorkerFoundationCard() {
  const available = workerApiAvailable();
  const busy = state.busy;
  const checkDisabled = !available || busy || !state.selectedProductId;
  const probeProduct = isFirstControlledEntryProduct(state.selectedProductId);
  queueQcPreparationLoad();
  const probeBlocked = access.canView !== true || !available || busy;
  const browserLine = available
    ? `Browser session: ${workerStatusLabel(state.workerStatus)}. Connect, capture, and folder controls are in the page header.`
    : "Browser session: Unavailable. The dedicated e-Aushadhi browser worker is available only in the SASV Electron app. PWA cannot launch Edge.";
  const probeBlock = probeProduct
    ? `
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnQcPreparationRead"${
          probeBlocked ? ` disabled aria-disabled="true"` : ""
        }>QC preparation read probe</button>
      </div>
      <p class="muted-note" id="workerQcPreparationReadResult">${escapeHtml(
        available
          ? workerQcPreparationReadSummary(state.workerQcPreparationReadResult)
          : "QC preparation read probe is available only in the SASV Electron app.",
      )}</p>
      <p class="muted-note">Expected to report a non-empty list after the first preparation is saved.</p>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnQcReportRead"${
          probeBlocked ? ` disabled aria-disabled="true"` : ""
        }>QC report read probe</button>
      </div>
      <p class="muted-note" id="workerQcReportReadResult">${escapeHtml(
        available
          ? workerQcReportReadSummary(state.workerQcReportReadResult)
          : "QC report read probe is available only in the SASV Electron app.",
      )}</p>`
    : "";
  return `
    <div class="section-card worker-foundation-card">
      <h3>Product execution check</h3>
      <p class="muted-note">Internal verification is not portal entry and is not portal verification.</p>
      <p class="muted-note" id="workerReadinessBrowserContext">${escapeHtml(browserLine)}</p>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnWorkerFoundation" data-edit-action="true" ${
          checkDisabled ? `data-force-disabled="true"` : ""
        }>Foundation Check</button>
      </div>
      <p class="muted-note" id="workerFoundationResult">${escapeHtml(workerFoundationSummary(state.workerFoundationResult))}</p>
      ${probeBlock}
    </div>`;
}

function workerQcReportReadSummary(result) {
  if (!result) return "QC report read probe has not been run.";
  if (result.ok === true && result.recordCount === 0) {
    return "QC report read probe returned no report reservations.";
  }
  if (result.errorKind === "AUTHORIZATION" || result.errorKind === "UNAUTHORIZED_RENDERER") {
    return "QC report read probe: not authorized.";
  }
  if (result.errorKind === "UNSUPPORTED_PLATFORM") {
    return "QC report read probe is available only in the SASV Electron app.";
  }
  if (result.errorKind === "PRODUCT_NOT_ALLOWED") {
    return "QC report read probe accepts only product 262.";
  }
  if (result.message === "QC report read probe did not return an empty report list.") {
    return result.message;
  }
  return "QC report read probe failed.";
}

function workerDryRunSummary(result) {
  if (!result) return "No entry-readiness dry-run has been run for Karpooradi.";
  const phases = Array.isArray(result.phases)
    ? result.phases.map((item) => `${item.id}: ${item.status}`).join("; ")
    : "";
  return [
    `Result: ${result.errorKind || "OK"}`,
    `Worker: ${result.workerState || "n/a"}`,
    `Content hash: ${result.contentHash || "n/a"}`,
    `Payload hash: ${result.payloadHash || "n/a"}`,
    result.stoppedPhase ? `Stopped at: ${result.stoppedPhase}` : "",
    result.message || "",
    phases,
  ]
    .filter(Boolean)
    .join(" ");
}

const PRODUCT_DETAILS_APPROVED_COPY_V01 =
  "EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V01.pdf";

function productDetailsConfirmBodyHtml(mode) {
  if (mode === "recover") {
    return `<p><strong>Karpooradi Thailam</strong> already exists in e-Aushadhi.</p>
      <p>No Save will occur.</p>
      <p>The existing portal record will be reread and adopted only if all governed Product Details fields match exactly.</p>
      <p>No Composition or final Submit will occur.</p>`;
  }
  const resumeNote =
    mode === "resume"
      ? "<p>An interrupted Product Details run was detected. Confirming will resume/reconcile the existing run on the same worker run id.</p>"
      : "";
  return `${resumeNote}
    <p><strong>Karpooradi Thailam</strong> (Product ${FIRST_CONTROLLED_PRODUCT_ID})</p>
    <ul>
      <li>Product Details only - will write to the Government e-Aushadhi portal</li>
      <li>Will NOT add Composition</li>
      <li>Will NOT final-submit the product</li>
      <li>Will attach governed approved copy: ${escapeHtml(PRODUCT_DETAILS_APPROVED_COPY_V01)}</li>
    </ul>`;
}

function closeProductDetailsConfirm(accepted) {
  const trigger = state.productDetailsConfirm.trigger;
  const resolve = state.productDetailsConfirm.resolve;
  state.productDetailsConfirm = {
    open: false,
    mode: null,
    trigger: null,
    resolve: null,
  };
  const backdrop = $("productDetailsConfirmBackdrop");
  if (backdrop) backdrop.hidden = true;
  if (trigger && typeof trigger.focus === "function") trigger.focus();
  if (typeof resolve === "function") resolve(accepted === true);
}

function openProductDetailsConfirmModal({ mode, trigger }) {
  const normalizedMode = mode === "resume" || mode === "recover" ? mode : "start";
  const title = $("productDetailsConfirmTitle");
  const body = $("productDetailsConfirmBody");
  const okBtn = $("productDetailsConfirmOk");
  if (title) {
    title.textContent =
      normalizedMode === "recover"
        ? "Recover Saved Portal Identity"
        : normalizedMode === "resume"
        ? "Resume Karpooradi Product Details"
        : "Start Product Details";
  }
  if (body) body.innerHTML = productDetailsConfirmBodyHtml(normalizedMode);
  if (okBtn) {
    okBtn.textContent =
      normalizedMode === "recover"
        ? "Confirm & Recover"
        : normalizedMode === "resume"
          ? "Resume & Continue"
          : "Confirm & Start";
  }
  state.productDetailsConfirm = {
    open: true,
    mode: normalizedMode,
    trigger: trigger || null,
    resolve: null,
  };
  const backdrop = $("productDetailsConfirmBackdrop");
  if (backdrop) backdrop.hidden = false;
  return new Promise((resolve) => {
    state.productDetailsConfirm.resolve = resolve;
    $("productDetailsConfirmDialog")?.focus();
    requestAnimationFrame(() => {
      okBtn?.focus();
    });
  });
}

function closeCompositionConfirm(accepted) {
  const { trigger, resolve } = state.compositionConfirm;
  state.compositionConfirm = { open: false, trigger: null, resolve: null };
  const backdrop = $("compositionConfirmBackdrop");
  if (backdrop) backdrop.hidden = true;
  trigger?.focus?.();
  if (typeof resolve === "function") resolve(accepted === true);
}

function openCompositionConfirmModal(trigger) {
  state.compositionConfirm = { open: true, trigger: trigger || null, resolve: null };
  const backdrop = $("compositionConfirmBackdrop");
  if (backdrop) backdrop.hidden = false;
  return new Promise((resolve) => {
    state.compositionConfirm.resolve = resolve;
    $("compositionConfirmDialog")?.focus();
    requestAnimationFrame(() => $("compositionConfirmOk")?.focus());
  });
}

function closeCompositionStageVerifyConfirm(accepted) {
  const { trigger, resolve } = state.compositionStageVerifyConfirm;
  state.compositionStageVerifyConfirm = { open: false, trigger: null, resolve: null };
  const backdrop = $("compositionStageVerifyConfirmBackdrop");
  if (backdrop) backdrop.hidden = true;
  trigger?.focus?.();
  if (typeof resolve === "function") resolve(accepted === true);
}

function openCompositionStageVerifyConfirmModal(trigger) {
  state.compositionStageVerifyConfirm = { open: true, trigger: trigger || null, resolve: null };
  const backdrop = $("compositionStageVerifyConfirmBackdrop");
  if (backdrop) backdrop.hidden = false;
  return new Promise((resolve) => {
    state.compositionStageVerifyConfirm.resolve = resolve;
    $("compositionStageVerifyConfirmDialog")?.focus();
    requestAnimationFrame(() => $("compositionStageVerifyConfirmOk")?.focus());
  });
}

function workerProductDetailsPreviewSummary(preview) {
  if (!preview) return "No Product Details preview yet.";
  const blockers = preview.preview?.blockers || preview.blockers || [];
  const start = preview.preview?.startEnabled === true;
  const resume = preview.preview?.resumeEnabled === true;
  const code = preview.code || "";
  const bits = [
    code ? `Status ${code}` : null,
    resume
      ? `Resume enabled${preview.preview?.resumeMessage ? `: ${preview.preview.resumeMessage}` : ""}`
      : null,
    start ? "Start enabled" : "Start disabled",
    blockers.length ? `Blockers: ${blockers.join(", ")}` : null,
    preview.liveArmed === false ? "Live execution disarmed" : null,
  ].filter(Boolean);
  return bits.join(". ") || "Preview complete.";
}

function renderEntryDryRunCard() {
  if (!isFirstControlledEntryProduct(state.selectedProductId)) return "";
  const available = workerApiAvailable();
  const busy = state.busy;
  const workerState = state.workerStatus?.state || "IDLE";
  const readyChip = state.queueRow?.is_ready_for_entry === true ? "READY" : "Not ready";
  const checkDisabled = !available || busy;
  const completeness = state.workerDryRunResult?.contractCompleteness;
  const contractLine = completeness
    ? `Lookup ${completeness.productLookup ? "complete" : "incomplete"}; Details ${
        completeness.productDetails ? "complete" : "incomplete"
      }; Composition ${completeness.composition ? "complete" : "incomplete"}`
    : "Contract readiness: incomplete until capture proves deterministic execution.";
  const pdPreview = state.workerProductDetailsPreview;
  const startEnabled = pdPreview?.preview?.startEnabled === true;
  const resumeEnabled = pdPreview?.preview?.resumeEnabled === true;
  const resumePath = resumeEnabled;
  const startDisabled = !available || busy || !startEnabled || resumePath;
  const resumeDisabled = !available || busy || !resumeEnabled;
  const resumeMessage =
    pdPreview?.preview?.resumeMessage ||
    "Interrupted Product Details run detected. Resume/reconcile the existing run.";
  const warning =
    pdPreview?.preview?.warning ||
    "This action will write Product Details to the Government e-Aushadhi portal. It will NOT add Composition and will NOT final-submit the product.";
  const portalTextVerified = isPortalDiseasesVerified(state.portalTextRow);
  const trustedAmbiguousRecovery =
    pdPreview?.preview?.ambiguousSaveRecoverable === true ||
    pdPreview?.ambiguousSaveRecoverable === true;
  const trustedExactOneRecovery =
    pdPreview?.preview?.ambiguousSaveExactOneRecoverable === true ||
    pdPreview?.ambiguousSaveExactOneRecoverable === true;
  const sameSessionAmbiguous = lastWorkerResultIsSaveAmbiguous();
  const showReconcile =
    portalTextVerified && (trustedAmbiguousRecovery || sameSessionAmbiguous);
  const showExactOneRecovery = portalTextVerified && trustedExactOneRecovery;
  const showRebase = showReconcile && reconcileIsNoneReady(state.workerReconcileResult);
  const rebaseDone = state.workerRebaseResult?.ok === true;
  const reconcileDisabled = !available || busy;
  const exactOneRecoveryDisabled = !available || busy;
  return `
    <div class="section-card worker-entry-dryrun-card">
      <h3>First controlled entry readiness</h3>
      <p class="muted-note">Product ${FIRST_CONTROLLED_PRODUCT_ID} only. This check does not enter the portal, Save, or Submit.</p>
      <p class="muted-note">Internal ${escapeHtml(readyChip)}. Worker ${escapeHtml(workerStatusLabel(state.workerStatus))} (${escapeHtml(workerState)}).</p>
      <p class="muted-note">${escapeHtml(contractLine)}</p>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnWorkerEntryDryRun" data-edit-action="true" ${
          checkDisabled ? `data-force-disabled="true"` : ""
        }>Check Entry Readiness</button>
      </div>
      <p class="muted-note" id="workerDryRunResult">${escapeHtml(workerDryRunSummary(state.workerDryRunResult))}</p>
    </div>
    <div class="section-card worker-product-details-card">
      <h3>Karpooradi Product Details execution</h3>
      <p class="muted-note">Product ${FIRST_CONTROLLED_PRODUCT_ID} - Karpooradi Thailam - Create Product Details only.</p>
      <p class="muted-note">${escapeHtml(warning)}</p>
      ${
        resumePath
          ? `<p class="muted-note" id="workerProductDetailsResumeNotice">${escapeHtml(resumeMessage)}</p>`
          : ""
      }
      <p class="muted-note">Lifecycle: NOT_STARTED -> IN_PROGRESS -> ENTERED -> PORTAL_VERIFIED (stop). No Composition. No submit.</p>
      <div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnWorkerProductDetailsPreview" data-edit-action="true" ${
          checkDisabled ? `data-force-disabled="true"` : ""
        }>Preview Product Details</button>
        <button type="button" class="icon-btn with-label primary" id="btnWorkerProductDetailsStart" data-edit-action="true" ${
          startDisabled ? `data-force-disabled="true"` : ""
        }>Start Product Details</button>
        <button type="button" class="icon-btn with-label primary" id="btnWorkerProductDetailsResume" data-edit-action="true" ${
          resumeDisabled ? `data-force-disabled="true"` : ""
        }>Resume Product Details</button>
      </div>
      <p class="muted-note" id="workerProductDetailsPreviewResult">${escapeHtml(
        workerProductDetailsPreviewSummary(pdPreview),
      )}</p>
      <p class="muted-note" id="workerProductDetailsStartResult">${escapeHtml(
        state.workerProductDetailsResult
          ? `${state.workerProductDetailsResult.code || ""} ${state.workerProductDetailsResult.message || ""}`.trim()
          : "Start remains blocked until preview clears every gate and live execution is armed.",
      )}</p>
      ${
        portalTextVerified
          ? ""
          : `<p class="muted-note" id="workerPortalTextGate">Portal projection must be VERIFIED in Product Details before ambiguous-save reconciliation is offered.</p>`
      }
      ${
        showExactOneRecovery
          ? `<div class="action-row">
        <button type="button" class="icon-btn with-label primary" id="btnWorkerRecoverExactOneIdentity" data-edit-action="true" ${
          exactOneRecoveryDisabled ? `data-force-disabled="true"` : ""
        }>Recover Saved Portal Identity</button>
      </div>
      <p class="muted-note">No Save will occur; existing portal product will be reread and adopted only if exact governed comparison matches.</p>
      <p class="muted-note" id="workerExactOneRecoveryResult">${escapeHtml(
        workerExactOneRecoverySummary(state.workerExactOneRecoveryResult),
      )}</p>
      ${workerExactOneRecoveryMismatchHtml(state.workerExactOneRecoveryResult)}`
          : ""
      }
      ${
        showReconcile
          ? `<div class="action-row">
        <button type="button" class="icon-btn with-label" id="btnWorkerReconcileAmbiguous" data-edit-action="true" ${
          reconcileDisabled ? `data-force-disabled="true"` : ""
        }>Reconcile Ambiguous Save</button>
        ${
          showRebase
            ? `<button type="button" class="icon-btn with-label" id="btnWorkerRebasePortalProjection" data-edit-action="true" ${
                reconcileDisabled ? `data-force-disabled="true"` : ""
              }>Rebase existing run authority</button>`
            : ""
        }
      </div>
      <p class="muted-note" id="workerReconcileResult">${escapeHtml(workerReconcileSummary(state.workerReconcileResult))}</p>
      ${
        rebaseDone
          ? `<p class="muted-note" id="workerRebaseResult">${escapeHtml(
              state.workerRebaseResult?.message ||
                "Run authority rebased onto the verified portal projection.",
            )} Resume Product Details is now available - start it manually when you are ready.</p>`
          : ""
      }`
          : ""
      }
    </div>`;
}

function lastWorkerResultIsSaveAmbiguous() {
  const result = state.workerProductDetailsResult;
  if (!result) return false;
  return String(result.code || result.errorKind || "").toUpperCase() === "SAVE_AMBIGUOUS";
}

function reconcileIsNoneReady(result) {
  if (!result || result.ok !== true) return false;
  const outcome = String(
    result.outcome ?? result.reconcileOutcome ?? result.duplicateOutcome ?? result.code ?? "",
  ).toUpperCase();
  return outcome.includes("NONE");
}

function workerReconcileSummary(result) {
  if (!result) {
    return "Read-only reconciliation has not been run for the ambiguous save.";
  }
  return [result.code || (result.ok === true ? "OK" : "BLOCKED"), result.message || ""]
    .filter(Boolean)
    .join(" ");
}

function workerExactOneRecoverySummary(result) {
  if (!result) {
    return "Recover Saved Portal Identity has not been run.";
  }
  return [result.code || (result.ok === true ? "OK" : "BLOCKED"), result.message || ""]
    .filter(Boolean)
    .join(" ");
}

function formatRecoveryMismatchValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") {
    return `label=${String(value.label ?? "")}; value=${String(value.value ?? "")}`;
  }
  return value == null ? "null" : String(value);
}

function workerExactOneRecoveryMismatchHtml(result) {
  const items = Array.isArray(result?.compareMismatches)
    ? result.compareMismatches.slice(0, 12)
    : [];
  if (!items.length) return "";
  return `<div class="muted-note" id="workerExactOneRecoveryMismatches">
    <strong>Governed field mismatches</strong>
    <ul>${items
      .map(
        (item) => `<li>
          <strong>${escapeHtml(item?.path || "unknown")}</strong><br>
          Expected: ${escapeHtml(formatRecoveryMismatchValue(item?.expected))}<br>
          Actual: ${escapeHtml(formatRecoveryMismatchValue(item?.actual))}<br>
          Result: ${escapeHtml(item?.result || "MISMATCH")}
        </li>`,
      )
      .join("")}</ul>
  </div>`;
}

async function submitWorkerConnect() {
  if (!canWrite() || state.busy) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const result = await connectWorkerBrowser();
    if (result?.state) state.workerStatus = result;
    if (result?.ok === false) {
      showToast(result.message || "Connect failed", "error");
    }
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    refreshReadinessIfActive();
  }
}

async function submitWorkerRecheckLogin() {
  if (!canWrite() || state.busy) return;
  const status = state.workerStatus?.state;
  if (status !== "AUTH_REQUIRED") return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const result = await recheckWorkerLogin();
    if (result?.state) state.workerStatus = result;
    if (result?.ok === false) {
      showToast(result.message || "Login recheck failed", "error");
    }
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    refreshReadinessIfActive();
  }
}

async function submitWorkerStop() {
  if (state.busy) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const result = await stopWorkerBrowser();
    if (result?.state) state.workerStatus = result;
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    refreshReadinessIfActive();
  }
}

async function submitWorkerFoundationCheck() {
  if (!canWrite() || state.busy || !state.selectedProductId) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const result = await runWorkerFoundationCheck(state.selectedProductId, token);
    state.workerFoundationResult = result;
    if (result?.errorKind === "CONTRACT_INCOMPLETE" || result?.errorKind === "PREFLIGHT_DENIED") {
      showToast(result.message || "Foundation check stopped as designed.", "info");
    } else if (result?.ok === false) {
      showToast(result.message || "Foundation check failed", "error");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitQcPreparationReadProbe() {
  if (access.canView !== true || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (!workerApiAvailable()) return;
  const productId = state.selectedProductId;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await readQcPreparation(productId, token);
    if (state.selectedProductId !== productId) return;
    state.workerQcPreparationReadResult = result;
    if (result?.ok === true && result.recordCount === 0) {
      showToast("QC preparation read probe returned no preparations.", "info");
    } else if (result?.errorKind === "AUTHORIZATION" || result?.errorKind === "UNAUTHORIZED_RENDERER") {
      showToast("Not authorized for e-Aushadhi automation.", "error");
    } else if (result?.errorKind === "UNSUPPORTED_PLATFORM") {
      showToast("QC preparation read probe is available only in the SASV Electron app.", "info");
    } else if (result?.message === QC_PREPARATION_READ_EMPTY_LIST) {
      showToast(QC_PREPARATION_READ_EMPTY_LIST, "error");
    } else {
      showToast("QC preparation read probe failed.", "error");
    }
  } catch (error) {
    state.workerQcPreparationReadResult = {
      ok: false,
      errorKind: "CRASH",
      message: "QC preparation read probe failed.",
    };
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitQcReportReadProbe() {
  if (access.canView !== true || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (!workerApiAvailable()) return;
  const productId = state.selectedProductId;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    if (state.selectedProductId !== productId) return;
    const result = await readQcReport(productId, token);
    if (state.selectedProductId !== productId) return;
    state.workerQcReportReadResult = result;
    if (result?.ok === true && result.recordCount === 0) {
      showToast("QC report read probe returned no report reservations.", "info");
    } else if (result?.errorKind === "AUTHORIZATION" || result?.errorKind === "UNAUTHORIZED_RENDERER") {
      showToast("Not authorized for e-Aushadhi automation.", "error");
    } else if (result?.message === "QC report read probe did not return an empty report list.") {
      showToast(result.message, "error");
    } else {
      showToast("QC report read probe failed.", "error");
    }
  } catch (error) {
    state.workerQcReportReadResult = {
      ok: false,
      errorKind: "CRASH",
      message: "QC report read probe failed.",
    };
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerEntryDryRun() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await runWorkerEntryDryRun(state.selectedProductId, token);
    state.workerDryRunResult = result;
    if (result?.errorKind === "CONTRACT_INCOMPLETE") {
      showToast(result.message || "Entry dry-run stopped as designed.", "info");
    } else if (result?.ok === false) {
      showToast(result.message || "Entry dry-run failed", "error");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerProductDetailsPreview() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await previewWorkerProductDetails(state.selectedProductId, token);
    state.workerProductDetailsPreview = result;
    const recoveryReady =
      result?.ok === true &&
      (result?.code === "RECOVERY_PREFLIGHT_PASS" ||
        result?.preview?.ambiguousSaveExactOneRecoverable === true);
    if (recoveryReady) {
      showToast("Recovery preview ready.", "success");
    } else if (result?.ok === false || result?.preview?.startEnabled !== true) {
      showToast(result?.message || "Product Details Start remains blocked.", "info");
    } else {
      showToast("Product Details preview ready.", "success");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerProductDetailsStart() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (state.workerProductDetailsPreview?.preview?.resumeEnabled === true) {
    showToast("Use Resume Product Details for the interrupted run.", "info");
    return;
  }
  if (state.workerProductDetailsPreview?.preview?.startEnabled !== true) {
    showToast("Start Product Details is disabled until preview gates pass.", "info");
    return;
  }
  const ok = await openProductDetailsConfirmModal({
    mode: "start",
    trigger: $("btnWorkerProductDetailsStart"),
  });
  if (!ok) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await startWorkerProductDetails(state.selectedProductId, token, {
      userConfirmed: true,
    });
    state.workerProductDetailsResult = result;
    if (result?.code === "LIVE_EXECUTION_NOT_ARMED") {
      showToast(result.message || "Live execution is disarmed.", "info");
    } else if (result?.ok === false) {
      showToast(result.message || "Product Details start blocked.", "error");
    } else if (result?.ok === true) {
      showToast(result.message || "Product Details completed.", "success");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerProductDetailsResume() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (state.workerProductDetailsPreview?.preview?.resumeEnabled !== true) {
    showToast("Resume Product Details is disabled until preview enables resume.", "info");
    return;
  }
  const ok = await openProductDetailsConfirmModal({
    mode: "resume",
    trigger: $("btnWorkerProductDetailsResume"),
  });
  if (!ok) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await resumeWorkerProductDetails(state.selectedProductId, token, {
      userConfirmed: true,
    });
    state.workerProductDetailsResult = result;
    if (result?.code === "LIVE_EXECUTION_NOT_ARMED") {
      showToast(result.message || "Live execution is disarmed.", "info");
    } else if (result?.ok === false) {
      showToast(result.message || "Product Details resume blocked.", "error");
    } else if (result?.ok === true) {
      showToast(result.message || "Product Details resumed.", "success");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerReconcileAmbiguousSave() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (!isPortalDiseasesVerified(state.portalTextRow)) {
    showToast("Verify the portal projection before reconciling the ambiguous save.", "info");
    return;
  }
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await reconcileAmbiguousSaveProductDetails(state.selectedProductId, token, {
      userConfirmed: true,
    });
    state.workerReconcileResult = result;
    state.workerRebaseResult = null;
    if (result?.ok === false) {
      showToast(result.message || "Ambiguous-save reconciliation blocked.", "error");
    } else {
      showToast(result?.message || "Read-only reconciliation complete.", "success");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerRebasePortalProjection() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (!reconcileIsNoneReady(state.workerReconcileResult)) {
    showToast("Rebase becomes available after reconciliation proves no portal duplicate.", "info");
    return;
  }
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await rebasePortalProjectionProductDetails(state.selectedProductId, token, {
      userConfirmed: true,
    });
    state.workerRebaseResult = result;
    if (result?.ok === false) {
      showToast(result.message || "Portal projection rebase blocked.", "error");
    } else {
      // Resume stays manual: never auto-resume after a rebase.
      showToast(
        result?.message || "Run authority rebased. Resume Product Details when ready.",
        "success",
      );
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function submitWorkerRecoverExactOneIdentity() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (!isPortalDiseasesVerified(state.portalTextRow)) {
    showToast("Verify the portal projection before recovering the saved portal identity.", "info");
    return;
  }
  const pdPreview = state.workerProductDetailsPreview;
  const recoverable =
    pdPreview?.preview?.ambiguousSaveExactOneRecoverable === true ||
    pdPreview?.ambiguousSaveExactOneRecoverable === true;
  if (!recoverable) {
    showToast("Recover Saved Portal Identity is only available for trusted EXACT_ONE recovery state.", "info");
    return;
  }
  const ok = await openProductDetailsConfirmModal({
    mode: "recover",
    trigger: $("btnWorkerRecoverExactOneIdentity"),
  });
  if (!ok) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await recoverAmbiguousSaveExactOneProductDetails(
      state.selectedProductId,
      token,
      { userConfirmed: true },
    );
    state.workerExactOneRecoveryResult = result;
    if (result?.code === "LIVE_EXECUTION_NOT_ARMED") {
      showToast(result.message || "Live execution is disarmed.", "info");
    } else if (result?.ok === false) {
      showToast(result.message || "Identity recovery blocked.", "error");
    } else if (result?.ok === true) {
      showToast(result.message || "Portal identity adopted and verified.", "success");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    renderReadiness();
  }
}

async function sessionAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token;
}

async function submitWorkerCompositionPreview() {
  if (!canWrite() || state.busy || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  state.busy = true;
  renderComposition();
  try {
    const token = await sessionAccessToken();
    const result = await previewWorkerComposition(state.selectedProductId, token);
    state.workerCompositionPreview = result;
    showToast(
      result?.ok === true ? "Composition portal preview complete." : result?.message || "Composition preview is blocked.",
      result?.ok === true ? "info" : "error",
    );
  } finally {
    state.busy = false;
    renderComposition();
  }
}

async function submitWorkerCompositionStart(trigger) {
  const preview = state.workerCompositionPreview;
  const eligible = Array.isArray(preview?.executionEligibleSourceLineIds)
    && preview.executionEligibleSourceLineIds.map(Number).includes(931)
    && preview?.controlledPhase2Eligible === true;
  if (!canWrite() || state.busy || !eligible || !isFirstControlledEntryProduct(state.selectedProductId)) return;
  if (!(await openCompositionConfirmModal(trigger))) return;
  state.busy = true;
  renderComposition();
  try {
    const token = await sessionAccessToken();
    const result = await startWorkerCompositionLine(state.selectedProductId, 931, token, { userConfirmed: true });
    state.workerCompositionResult = result;
    showToast(result?.message || (result?.ok ? "Composition line verified." : "Composition line execution stopped."), result?.ok ? "success" : "error");
    state.workerCompositionPreview = await previewWorkerComposition(state.selectedProductId, token);
  } finally {
    state.busy = false;
    renderComposition();
  }
}

async function submitWorkerCompositionVerifyStage() {
  const preview = state.workerCompositionPreview;
  const eligible =
    preview?.finalStageVerifyEligible === true &&
    preview?.stageVerifyEnabled === true &&
    canWrite() &&
    !state.busy &&
    isFirstControlledEntryProduct(state.selectedProductId);
  if (!eligible) return;
  if (!(await openCompositionStageVerifyConfirmModal($("btnWorkerCompositionVerifyStage")))) return;
  state.busy = true;
  renderComposition();
  try {
    const token = await sessionAccessToken();
    const result = await verifyWorkerCompositionStage(state.selectedProductId, token, {
      userConfirmed: true,
    });
    state.workerCompositionResult = result;
    if (result?.code === "COMPOSITION_PORTAL_VERIFIED" && result?.ok === true) {
      showToast(result.message || "Composition stage is portal verified.", "success");
    } else {
      showToast(
        result?.message || "Composition stage verification stopped. Run Preview again.",
        "error",
      );
    }
    state.workerCompositionPreview = await previewWorkerComposition(state.selectedProductId, token);
    renderReadiness();
  } finally {
    state.busy = false;
    renderComposition();
  }
}

async function submitWorkerCapture() {
  if (!canWrite() || state.busy) return;
  const status = state.workerStatus?.state;
  if (status !== "READY") return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await captureWorkerPortalContract(token);
    state.workerCaptureResult = result;
    if (result?.ok === false) {
      showToast(result.message || "Portal contract capture failed", "error");
    } else {
      showToast("Portal contract capture saved locally.", "success");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    refreshReadinessIfActive();
  }
}

async function submitWorkerOpenCapture() {
  if (!canWrite() || state.busy) return;
  state.busy = true;
  syncWorkerToolbarUi();
  try {
    const token = await sessionAccessToken();
    const result = await openWorkerCaptureFolder(token);
    if (result?.ok === false) {
      showToast(result.message || "Could not open the capture folder", "error");
    }
  } catch (error) {
    showToast(userMessageForError(error), "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
    refreshReadinessIfActive();
  }
}

function queueQcPreparationLoad() {
  const available = workerApiAvailable();
  const probeProduct = isFirstControlledEntryProduct(state.selectedProductId);
  if (
    probeProduct &&
    available &&
    access.canView === true &&
    !state.qcPrepLoading &&
    state.qcPrepLoadedFor !== state.selectedProductId
  ) {
    state.qcPrepLoading = true;
    const productId = state.selectedProductId;
    const request = ++state.qcPrepRequest;
    queueMicrotask(() => {
      void loadQcPreparationWorkspace(productId, request);
    });
  }
}

function renderQcSurface() {
  if (state.tab === "qc") renderQc();
  else if (state.tab === "readiness") renderReadiness();
}

function qcReadinessSummaryText() {
  if (!isFirstControlledEntryProduct(state.selectedProductId)) {
    return "QC Register entry is available for Product 262 only in this release.";
  }
  if (!state.qcPrepServer && !state.qcPrepLoading) return "No QC preparation saved yet.";
  const openChecks = qcPrepLocalHints(qcPrepForm()).length;
  const registered = qcRegisteredReport(state.qcPrepServer?.preparation_id);
  const version = registered ? String(registered.version_no).padStart(2, "0") : "";
  const b1 = version ? `B1: Report registered (V${version})` : "B1: Report registered";
  const byte = qcReportByteLabel(registered, state.qcReportByteResult);
  const readinessLabel = state.qcReadiness?.status ? qcReadinessBadge(state.qcReadiness).label : "not loaded";
  return `QC Register: ${qcPrepStatusText(state.qcPrepServer, state.qcPrepLoading)} — ${openChecks} form checks open. ${b1}. B2: Server byte check: ${byte}. B4 readiness: ${readinessLabel}.`;
}

function renderQc() {
  const host = $("tab-qc");
  if (!host) return;
  queueQcPreparationLoad();
  queueQcReportLoad();
  queueQcEvidenceRecheck();
  queueQcReadinessLoad();
  queueQcFillPreflight();
  if (!workerApiAvailable()) {
    host.innerHTML = `<section class="section-card qc-prep-workspace"><h3 class="section-title">QC Register</h3><p class="muted-note">QC preparation is available only in the SASV Electron app.</p></section>`;
    return;
  }
  if (!isFirstControlledEntryProduct(state.selectedProductId)) {
    host.innerHTML = `<section class="section-card qc-prep-workspace"><h3 class="section-title">QC Register</h3><p class="muted-note">QC Register entry is available for Product 262 only in this release.</p></section>`;
    return;
  }
  host.innerHTML = qcPreparationWorkspaceMarkup();
  applyPermissionUi();
}

function renderFillOnPortalSection() {
  const model = portalFillStepperModel({
    productId: state.selectedProductId,
    review: state.review,
    classification: state.classification,
    lines: state.lines,
    actionsDraft: state.actionsDraft,
    actionsReviewStatus: state.actionsReviewStatus,
    stageReview: state.stageReview,
  });
  const statusHtml = model.statusRows
    .map(
      (row) =>
        `<div class="readiness-chip"><span>${escapeHtml(row.label)}</span>${chip(
          reviewStatusChipClass(row.status),
          row.statusLabel,
        )}</div>`,
    )
    .join("");
  if (model.closedProduct) {
    return `<div class="section-card" id="fillOnPortalSection">
      <h3 class="section-title">Fill on portal</h3>
      <p class="muted-note" id="fillOnPortalClosedNote">${escapeHtml(model.closedMessage)}</p>
    </div>`;
  }
  const stepsHtml = model.portalSteps
    .map(
      (step) =>
        `<div class="portal-fill-step" data-portal-fill-step="${escapeHtml(step.id)}">
          <strong>${escapeHtml(step.label)}</strong>
          <p class="muted-note">${escapeHtml(step.reason)}</p>
        </div>`,
    )
    .join("");
  const warningHtml = model.samePersonWarning
    ? `<p class="muted-note" id="fillOnPortalSamePersonWarning">${escapeHtml(model.samePersonWarning)}</p>`
    : "";
  return `<div class="section-card" id="fillOnPortalSection">
      <h3 class="section-title">Fill on portal</h3>
      <p class="muted-note" id="fillOnPortalEntryNote">${escapeHtml(model.portalEntryMessage)}</p>
      ${warningHtml}
      <div class="readiness-compact" id="fillOnPortalStatusList">${statusHtml}</div>
      <div class="portal-fill-steps" id="fillOnPortalSteps">${stepsHtml}</div>
      <p class="muted-note">This section is display-only in this build. It does not Save, Submit, or Authorize portal entry.</p>
    </div>`;
}

function renderReadiness() {
  queueQcPreparationLoad();
  queueQcEvidenceRecheck();
  queueQcReadinessLoad();
  const host = $("tab-readiness");
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  const issueCount = openErrorOrBlockerCount(state.issues);
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
  const verifyArgs = currentVerifyArgs();
  const promoteOk = canPromoteFormulation(promoteArgs);
  const verifyOk = canVerifyProductWorkflow(verifyArgs);
  const blockersClear = toInt(row.open_blockers) === 0 && issueCount === 0;
  const gates = [
    ["Product Details", normalizeReviewStatus(review.review_status) === "VERIFIED", false],
    ["Pharmacological Action", evidence.pharmacological_action_present === true, false],
    ["Composition", compositionIsComplete(row, evidence), false],
    ["Blocking issues", blockersClear, !blockersClear],
    ["Approved Product Copy", evidence.approved_product_copy_present === true, false],
    ["Approved Formulation", evidence.approved_formulation_present === true, false],
  ];
  const classificationStatus =
    normalizeReviewStatus(state.classification?.review_status) || "PENDING";
  const ready = row.is_ready_for_entry === true;
  const showPromote = evidence.approved_formulation_present !== true;
  const showVerify = normalizeReviewStatus(review.review_status ?? row.review_status) !== "VERIFIED";
  const promoteReason = promoteUnavailableReason(promoteArgs);
  const verifyReason = verifyProductUnavailableReason(verifyArgs);
  host.innerHTML = `
    <div class="section-card" id="qcReadinessSummary">
      <p class="muted-note">${escapeHtml(qcReadinessSummaryText())}</p>
      <button type="button" class="icon-btn with-label" id="btnOpenQcTab">Open QC Register</button>
    </div>
    <div class="section-card">
      <div class="readiness-banner ${ready ? "is-ready" : "is-not-ready"}">${
        ready ? "READY FOR E-AUSHADHI" : "NOT READY"
      }</div>
      <div class="readiness-compact">
        <div class="readiness-chip"><span>Portal Classification</span>${chip(
          reviewStatusChipClass(classificationStatus),
          displayText(classificationStatus, "PENDING"),
        )}</div>
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
    </div>
    ${renderFillOnPortalSection()}
    ${renderWorkerFoundationCard()}
    ${renderEntryDryRunCard()}`;
  applyPermissionUi();
}

function workspaceActionContext() {
  const lines = Array.isArray(state.lines) ? state.lines : [];
  const issues = Array.isArray(state.issues) ? state.issues : [];
  return {
    isApprover: state.myRoles?.is_approver === true,
    productId: state.selectedProductId,
    openIssues: issues.filter((issue) => !issue?.status || issue.status === "OPEN").length,
    unverifiedLines: lines.filter((line) => line?.review_status !== "VERIFIED").length,
    lineCount: lines.length,
  };
}

function applyWorkspaceChrome() {
  const panel = document.querySelector(`#workspacePanel [data-tab-panel="${state.tab}"]`);
  if (!panel) return;
  decorateWorkspace(panel, workspaceActionContext());
  placeTechnicalDrawer(panel, {
    isApprover: state.myRoles?.is_approver === true,
    cacheName: CACHE_NAME_UX1,
  });
}

function renderSignedInRole() {
  const node = $("signedInRole");
  if (!node) return;
  node.textContent = signedInRoleLabel(state.myRoles);
}

function showWorklistMode(on) {
  const home = $("worklistHome");
  const fallback = $("worklistFallback");
  const oldControls = $("legacyQueueControls");
  const oldTable = $("queueTableWrap");
  if (home) home.hidden = !on;
  if (fallback) fallback.hidden = on || state.worklistError !== true;
  if (oldControls) oldControls.hidden = on;
  if (oldTable) oldTable.hidden = on;
}

function readWorklistQueue() {
  try {
    const saved = localStorage.getItem(WORKLIST_TAB_KEY);
    return WORKLIST_QUEUES.some((item) => item.id === saved) ? saved : "TO_VERIFY";
  } catch {
    return "TO_VERIFY";
  }
}

function rememberWorklistQueue(queue) {
  try {
    localStorage.setItem(WORKLIST_TAB_KEY, queue);
  } catch {
    /* the queue still works for this visit */
  }
}

let worklistSearchTimer = 0;

function optionListHtml(choices, selected) {
  return choices.map((choice) => {
    const value = String(choice.value).replace(/"/g, "&quot;");
    const label = String(choice.label).replace(/</g, "&lt;");
    const on = choice.value === selected ? " selected" : "";
    return `<option value="${value}"${on}>${label}</option>`;
  }).join("");
}

function filteredWorklist() {
  return filterWorklistRows(state.worklist || [], {
    queue: state.worklistQueue,
    category: state.worklistCategory,
    subcategory: state.worklistSubcategory,
    group: state.worklistGroup,
    blockedOnly: state.worklistBlocked === true,
    query: state.worklistQuery,
  });
}

function queueWorklistRows() {
  return (state.worklist || []).filter((row) => row.queue === state.worklistQueue);
}

function setLevelSelect(select, rows, level, selected) {
  if (!select) return selected || "all";
  const choices = worklistLevelChoices(rows, level);
  let value = selected || "all";
  if (!choices.some((choice) => choice.value === value)) value = "all";
  select.innerHTML = optionListHtml(choices, value);
  select.value = value;
  return value;
}

function syncWorklistFilterControls() {
  const rows = queueWorklistRows();
  const category = setLevelSelect($("worklistCategory"), rows, "category", state.worklistCategory);
  const subcategory = setLevelSelect(
    $("worklistSubcategory"),
    filterWorklistRows(rows, { category }),
    "subcategory",
    state.worklistSubcategory,
  );
  const group = setLevelSelect(
    $("worklistGroup"),
    filterWorklistRows(rows, { category, subcategory }),
    "group",
    state.worklistGroup,
  );
  state.worklistCategory = category;
  state.worklistSubcategory = subcategory;
  state.worklistGroup = group;
  const blocked = $("worklistBlocked");
  if (blocked) blocked.checked = state.worklistBlocked === true;
  const dot = $("worklistFilterDot");
  if (dot) {
    dot.hidden = !worklistFiltersActive({
      category,
      subcategory,
      group,
      blockedOnly: state.worklistBlocked,
    });
  }
  const clear = $("worklistSearchClear");
  if (clear) clear.hidden = !safeText(state.worklistQuery);
  syncWorklistFilteredCount(filterWorklistRows(rows, {
    category: state.worklistCategory,
    subcategory: state.worklistSubcategory,
    group: state.worklistGroup,
    blockedOnly: state.worklistBlocked === true,
    query: state.worklistQuery,
  }).length);
}

function syncWorklistFilteredCount(total) {
  const node = $("worklistFilteredCount");
  if (!node) return;
  const active = worklistFiltersActive({
    category: state.worklistCategory,
    subcategory: state.worklistSubcategory,
    group: state.worklistGroup,
    blockedOnly: state.worklistBlocked,
  }) || Boolean(safeText(state.worklistQuery));
  if (!active) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  const count = Number(total) || 0;
  node.hidden = false;
  node.textContent = `${count} ${count === 1 ? "product" : "products"}`;
}

function refreshChildClassificationDrafts() {
  const rows = queueWorklistRows();
  const category = $("worklistCategory")?.value || "all";
  const subcategory = setLevelSelect(
    $("worklistSubcategory"),
    filterWorklistRows(rows, { category }),
    "subcategory",
    $("worklistSubcategory")?.value || "all",
  );
  setLevelSelect(
    $("worklistGroup"),
    filterWorklistRows(rows, { category, subcategory }),
    "group",
    $("worklistGroup")?.value || "all",
  );
}

function worklistRowEls() {
  return Array.from(document.querySelectorAll("#worklistBody tr.queue-row[data-product-id]"));
}

function applyWorklistRoving() {
  const rows = worklistRowEls();
  if (!rows.length) return null;
  const wanted = String(state.worklistFocusedId || "");
  const active = rows.find((row) => String(row.dataset.productId) === wanted) || rows[0];
  rows.forEach((row) => {
    const on = row === active;
    row.tabIndex = on ? 0 : -1;
    row.classList.toggle("is-focused", on);
  });
  state.worklistFocusedId = active.dataset.productId;
  return active;
}

function focusWorklistRow(productId) {
  if (productId != null) state.worklistFocusedId = productId;
  const active = applyWorklistRoving();
  if (!active) return null;
  active.focus();
  active.scrollIntoView({ block: "nearest" });
  return active;
}

function saveWorklistScroll() {
  const wrap = $("worklistTableWrap");
  if (wrap) state.worklistScrollTop = wrap.scrollTop;
}

function restoreWorklistScroll() {
  const wrap = $("worklistTableWrap");
  if (!wrap) return;
  wrap.scrollTop = state.worklistScrollTop || 0;
}

function renderWorklist({ resetChunk = false, restoreScroll = false } = {}) {
  const rows = state.worklist || [];
  const tabs = $("worklistTabs");
  if (tabs) tabs.innerHTML = worklistTabsHtml(rows, state.worklistQueue);
  syncWorklistFilterControls();
  const filtered = filteredWorklist();
  if (resetChunk) {
    state.worklistRenderedCount = resetQueueRenderCount(filtered.length);
    state.worklistScrollTop = 0;
    const wrap = $("worklistTableWrap");
    if (wrap) wrap.scrollTop = 0;
  }
  if (state.worklistRenderedCount <= 0 && filtered.length) {
    state.worklistRenderedCount = resetQueueRenderCount(filtered.length);
  }
  if (state.worklistRenderedCount > filtered.length) state.worklistRenderedCount = filtered.length;
  const visible = visibleQueueRows(filtered, state.worklistRenderedCount);
  const body = $("worklistBody");
  if (!body) return;
  const markup = visible.length ? visible.map((row) => worklistRowHtml(row)).join("") : worklistEmptyHtml();
  const template = document.createElement("template");
  template.innerHTML = `<table><tbody>${markup}</tbody></table>`;
  const fragment = document.createDocumentFragment();
  const built = template.content.querySelector("tbody");
  while (built?.firstChild) fragment.append(built.firstChild);
  body.replaceChildren(fragment);
  applyWorklistRoving();
  if (restoreScroll) requestAnimationFrame(() => restoreWorklistScroll());
}

function appendWorklistChunk({ force = false } = {}) {
  if (isProductMode()) return false;
  const wrap = $("worklistTableWrap");
  const body = $("worklistBody");
  if (!wrap || !body) return false;
  const filtered = filteredWorklist();
  if (state.worklistRenderedCount >= filtered.length) return false;
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
  const next = nextQueueRenderCount(state.worklistRenderedCount, filtered.length);
  const extra = filtered.slice(state.worklistRenderedCount, next);
  if (!extra.length) return false;
  const template = document.createElement("template");
  template.innerHTML = `<table><tbody>${extra.map((row) => worklistRowHtml(row)).join("")}</tbody></table>`;
  const fragment = document.createDocumentFragment();
  const built = template.content.querySelector("tbody");
  while (built?.firstChild) fragment.append(built.firstChild);
  body.append(fragment);
  state.worklistRenderedCount = next;
  applyWorklistRoving();
  return true;
}

function placeWorklistFilterPopover() {
  const drawer = $("worklistFilterDrawer");
  const button = $("worklistFilterBtn");
  if (!drawer || !button) return;
  const rect = button.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(320, window.innerWidth - margin * 2);
  let left = rect.left;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
  if (left < margin) left = margin;
  let top = rect.bottom + 6;
  drawer.style.width = `${Math.round(width)}px`;
  drawer.style.left = `${Math.round(left)}px`;
  drawer.style.top = `${Math.round(top)}px`;
  const height = drawer.getBoundingClientRect().height;
  if (top + height > window.innerHeight - margin && rect.top - 6 - height >= margin) {
    drawer.style.top = `${Math.round(rect.top - 6 - height)}px`;
  }
}

function setWorklistFiltersOpen(open) {
  const drawer = $("worklistFilterDrawer");
  const button = $("worklistFilterBtn");
  const home = $("worklistHome");
  if (!drawer || !button) return;
  const wasOpen = drawer.hidden !== true;
  if (setWorklistFiltersOpen.onKey) {
    document.removeEventListener("keydown", setWorklistFiltersOpen.onKey, true);
    setWorklistFiltersOpen.onKey = null;
  }
  if (setWorklistFiltersOpen.onPointer) {
    document.removeEventListener("pointerdown", setWorklistFiltersOpen.onPointer, true);
    setWorklistFiltersOpen.onPointer = null;
  }
  drawer.hidden = !open;
  button.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) {
    drawer.style.top = "";
    drawer.style.left = "";
    drawer.style.width = "";
    const table = $("worklistTableWrap");
    if (home && table && drawer.parentElement !== home) home.insertBefore(drawer, table);
    syncWorklistFilterControls();
    if (wasOpen) button.focus();
    return;
  }
  document.body.append(drawer);
  placeWorklistFilterPopover();
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setWorklistFiltersOpen(false);
      return;
    }
    trapModalTab(event, "worklistFilterDrawer");
  };
  const onPointer = (event) => {
    if (drawer.contains(event.target) || button.contains(event.target)) return;
    setWorklistFiltersOpen(false);
  };
  setWorklistFiltersOpen.onKey = onKey;
  setWorklistFiltersOpen.onPointer = onPointer;
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onPointer, true);
  $("worklistCategory")?.focus();
}

function closeWorklistModal({ restoreFocus = true } = {}) {
  if (openWorklistModal.onKey) document.removeEventListener("keydown", openWorklistModal.onKey, true);
  const backdrop = $("worklistModalBackdrop");
  const productId = backdrop?.dataset.productId;
  backdrop?.remove();
  if (restoreFocus && productId) focusWorklistRow(productId);
}

function openWorklistModal(productId) {
  const row = (state.worklist || []).find((item) => Number(item.product_id) === Number(productId));
  if (!row || $("worklistModalBackdrop")) return;
  state.worklistFocusedId = productId;
  const roles = {
    ...(state.myRoles || {}),
    selfApproval: String(row.last_changed_by || "") !== "" && String(row.last_changed_by) === String(state.myRoles?.user_id || ""),
  };
  const decision = nextActionDecision(row, roles);
  const backdrop = document.createElement("div");
  backdrop.id = "worklistModalBackdrop";
  backdrop.className = "sasv-modal-backdrop";
  backdrop.dataset.productId = String(row.product_id);
  const dialog = document.createElement("div");
  dialog.id = "worklistModalDialog";
  dialog.className = "sasv-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "worklistModalTitle");
  dialog.tabIndex = -1;
  const header = document.createElement("div");
  header.className = "sasv-modal__header";
  const title = document.createElement("h2");
  title.id = "worklistModalTitle";
  title.className = "sasv-modal__title";
  const name = document.createElement("span");
  name.textContent = row.product_name || "Product";
  const id = document.createElement("span");
  id.className = "worklist-modal-id muted-note";
  id.textContent = row.product_id == null ? "" : String(row.product_id);
  title.append(name, id);
  header.append(title);
  const body = document.createElement("div");
  body.className = "sasv-modal__body";
  body.innerHTML = worklistModalHtml(row, roles);
  const footer = document.createElement("div");
  footer.className = "sasv-modal__footer";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.id = "worklistModalClose";
  closeBtn.className = "icon-btn with-label";
  closeBtn.textContent = "Close";
  const primary = document.createElement("button");
  primary.type = "button";
  primary.id = "worklistModalPrimary";
  primary.className = "icon-btn with-label primary";
  primary.textContent = decision.buttonLabel || "View";
  footer.append(closeBtn, primary);
  dialog.append(header, body, footer);
  backdrop.append(dialog);
  document.body.append(backdrop);
  setActionState(primary, decision);
  const stage = workspaceTabForStage(row.next_stage);
  const close = () => closeWorklistModal();
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  closeBtn.addEventListener("click", close);
  primary.addEventListener("click", () => {
    if (primary.disabled) return;
    closeWorklistModal({ restoreFocus: false });
    void openWorklistProduct(row.product_id, stage).catch(toastError);
  });
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    trapModalTab(event, "worklistModalDialog");
  };
  openWorklistModal.onKey = onKey;
  document.addEventListener("keydown", onKey, true);
  dialog.focus();
}

async function loadMyRoles() {
  try {
    const roles = await fetchMyRoles();
    state.myRoles = {
      user_id: roles?.user_id || null,
      is_verifier: roles?.is_verifier === true,
      is_approver: roles?.is_approver === true,
      can_edit: roles?.can_edit === true,
    };
  } catch {
    state.myRoles = { ...ROLE_FALLBACK };
  }
  renderSignedInRole();
}

async function loadReviewHome() {
  state.worklistQueue = readWorklistQueue();
  await loadMyRoles();
  let worklistError = null;
  try {
    state.worklist = (await fetchWorklist()).map((row) => normalizeWorklistRow(row));
  } catch (error) {
    worklistError = error;
    state.worklist = null;
  }
  try {
    state.catalogs = await loadSessionCatalogs();
  } catch (error) {
    if (!worklistError) throw error;
  }
  renderLenses();
  if (worklistError) {
    state.worklistError = true;
    showWorklistMode(false);
    try {
      state.queue = await fetchProductQueue();
      renderQueue({ resetChunk: true });
    } catch (error) {
      toastError(error);
      setStatus(error.message || "Failed to load the product queue.", "error");
    }
    return;
  }
  state.worklistError = false;
  showWorklistMode(true);
  renderWorklist({ resetChunk: true });
}

async function ensureProductQueue() {
  if (Array.isArray(state.queue) && state.queue.length) return;
  try {
    state.queue = await fetchProductQueue();
  } catch {
    state.queue = state.queue || [];
  }
}

async function openWorklistProduct(productId, stage) {
  saveWorklistScroll();
  await ensureProductQueue();
  await openProduct(productId);
  if (Number(state.selectedProductId) !== Number(productId)) return;
  selectWorkflowTab(workspaceTabForStage(stage));
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
  else if (tab === "qc") renderQc();
  else if (tab === "evidence") renderEvidence();
  else if (tab === "readiness") renderReadiness();
  applyWorkspaceChrome();
}

function selectWorkflowTab(next, { focusTab = false } = {}) {
  if (next !== "qc" && !WORKSPACE_TABS.includes(next)) return;
  if (state.tab === "details") {
    syncDetailsDraftFromForm();
    syncClassificationDraftFromForm();
    syncPortalTextDraftFromForm();
    void flushDetailsAutosave();
    void flushClassificationAutosave();
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

function syncPortalFieldsDraftFromForm() {
  if (!state.portalFieldsDraft) return;
  state.portalFieldsDraft = {
    ...state.portalFieldsDraft,
    remarks: $("fldPortalRemarks")?.value ?? "",
    portalShelfmonthRoute: $("fldPortalShelfmonthRoute")?.value ?? "",
  };
  syncPortalFieldsUi();
}

function syncPortalTextDraftFromForm() {
  if (!state.portalTextDraft) return;
  const textEl = $("fldPortalDiseases");
  const reasonEl = $("fldPortalDiseasesReason");
  if (!textEl && !reasonEl) return;
  state.portalTextDraft = {
    ...state.portalTextDraft,
    editableText: textEl ? textEl.value : state.portalTextDraft.editableText,
    reason: reasonEl ? reasonEl.value : state.portalTextDraft.reason,
  };
  syncPortalTextUi();
}

function syncClassificationDraftFromForm() {
  if (!state.classificationDraft) return;
  const subtypeId = optionId($("fldClassSubtype")?.value);
  // Recover BLANK -> UNRESOLVED/OPTION from the operator's corrected form state.
  const subtypeMode = resolveClassificationSubtypeMode({
    subtypeMode: state.classificationDraft.subtypeMode,
    productSubtypeOptionId: subtypeId,
    preserveBlank: false,
  });
  state.classificationDraft = {
    ...state.classificationDraft,
    productTypeOptionId: optionId($("fldClassProductType")?.value),
    productCategoryOptionId: optionId($("fldClassCategory")?.value),
    productSubtypeOptionId: subtypeMode === "OPTION" ? subtypeId : null,
    subtypeMode,
    reviewNotes: $("fldClassNotes")?.value ?? "",
  };
  syncClassificationVerifyUi();
}

function applyWorkspacePayload(payload, { preserveDrafts = false } = {}) {
  state.review = payload.review;
  state.referenceMappings = payload.referenceMappings || [];
  state.lines = associateReferenceMappingsByLine(payload.lines, state.referenceMappings);
  state.actions = payload.actions || [];
  state.evidence = payload.evidence;
  state.issues = payload.issues || [];
  state.copy = payload.copy || null;
  state.classification = payload.classification || null;
  state.dossierPortalFields = payload.dossierPortalFields || null;
  state.portalTextRow = payload.portalText || null;
  state.classificationOptions = payload.classificationOptions || {
    PRODUCT_TYPE: [],
    PRODUCT_CATEGORY: [],
    PRODUCT_SUBTYPE: [],
  };
  if (payload.copyContract?.error) {
    state.copyContract = null;
    state.copyContractError = userMessageForError(payload.copyContract.error) || EVIDENCE_CONTRACT_UNAVAILABLE;
  } else if (payload.copyContract) {
    state.copyContract = payload.copyContract;
    state.copyContractError = payload.copyContract.expected_file_name && payload.copyContract.expected_storage_path
      ? ""
      : EVIDENCE_CONTRACT_UNAVAILABLE;
    if (state.copyContractError) state.copyContract = null;
  }
  state.actionsReviewStatus = workingActionReviewStatus(state.actions);
  if (!preserveDrafts) {
    state.lineSaveStatus = new Map();
    state.detailsSaveStatus = "";
    state.portalFieldsSaveStatus = "";
    state.portalTextSaveStatus = "";
    state.classificationSaveStatus = "";
    state.actionsSaveStatus = "";
    state.copyPick = null;
    lineHalted.clear();
    detailsHalted = false;
    portalFieldsHalted = false;
    classificationHalted = false;
    actionsHalted = false;
  }
  const freshDetails = detailsDraftFromReview(state.review);
  if (preserveDrafts && state.detailsDraft && detailsDirty(state.detailsDraft, state.detailsBaseline)) {
    state.detailsDraft = { ...state.detailsDraft, rowVersion: freshDetails.rowVersion };
  } else {
    state.detailsDraft = freshDetails;
  }
  state.detailsBaseline = freshDetails;

  const freshPortalFields = portalFieldsDraftFromRow(state.dossierPortalFields);
  if (
    preserveDrafts &&
    state.portalFieldsDraft &&
    portalFieldsDirty(state.portalFieldsDraft, state.portalFieldsBaseline)
  ) {
    state.portalFieldsDraft = {
      ...state.portalFieldsDraft,
      rowVersion: freshPortalFields.rowVersion,
    };
  } else {
    state.portalFieldsDraft = freshPortalFields;
  }
  state.portalFieldsBaseline = freshPortalFields;

  const freshPortalText = newPortalTextDraft(state.portalTextRow);
  if (preserveDrafts && portalTextDirty(state.portalTextDraft, state.portalTextRow)) {
    state.portalTextDraft = {
      ...state.portalTextDraft,
      ...freshPortalText,
      editableText: state.portalTextDraft.editableText,
      reason: state.portalTextDraft.reason,
    };
  } else {
    state.portalTextDraft = freshPortalText;
  }

  const freshClassification = classificationDraftFromReview(state.classification);
  if (
    preserveDrafts &&
    state.classificationDraft &&
    classificationDirty(state.classificationDraft, state.classificationBaseline)
  ) {
    state.classificationDraft = {
      ...state.classificationDraft,
      rowVersion: freshClassification.rowVersion,
      reviewStatus: freshClassification.reviewStatus,
    };
  } else {
    state.classificationDraft = freshClassification;
  }
  state.classificationBaseline = freshClassification;

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
  renderLenses();
  if (!isProductMode()) renderQueue();
  if (isProductMode()) renderProductHeader();
  if (!silent) setStatus("");
}

async function openProduct(productId, returnFocus = null) {
  if (state.selectedProductId && !idsEqual(state.selectedProductId, productId)) {
    if (!(await confirmLeaveDirty(returnFocus != null ? returnFocus : "backToQueueBtn"))) return;
    await flushDetailsAutosave();
    await flushClassificationAutosave();
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
    const [payload, stageReview] = await Promise.all([
      loadProductWorkspace(productId),
      loadStageReview(productId),
    ]);
    if (gen !== state.loadGen) return;
    if (!idsEqual(state.selectedProductId, productId)) {
      state.workerFoundationResult = null;
      state.workerQcPreparationReadResult = null;
      state.workerQcReportReadResult = null;
      resetQcPreparationWorkspace();
      state.workerDryRunResult = null;
      state.workerCompositionPreview = null;
      state.workerProductDetailsPreview = null;
      state.workerProductDetailsResult = null;
      state.workerReconcileResult = null;
      state.workerRebaseResult = null;
      state.workerExactOneRecoveryResult = null;
    }
    applyStageReviewResult(stageReview);
    state.selectedProductId = Number(productId);
    state.worklistRow = (state.worklist || []).find((row) => Number(row.product_id) === Number(productId)) || null;
    state.queueRow = findQueueRow(state.queue, productId);
    state.tab = "overview";
    state.preservedAfterStale = false;
    state.promoteNotes = "";
    state.promoteNotesOrigin = "unset";
    state.verifyNotes = "";
    state.verifyNotesOrigin = "unset";
    applyWorkspacePayload(payload, { preserveDrafts: false });
    applyPromoteNotesIfNeeded();
    applyVerifyNotesIfNeeded();
    await syncCopyContractAfterWorkspace();
    setAppMode("product");
    renderProductHeader();
    renderActiveTab();
    setStatus("");
  } catch (err) {
    toastError(err);
    setStatus(err.message || "Failed to load product.", "error");
  } finally {
    state.busy = false;
    syncWorkerToolbarUi();
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
  const [payload, stageReview] = await Promise.all([
    loadProductWorkspace(state.selectedProductId),
    loadStageReview(state.selectedProductId),
  ]);
  if (gen !== state.loadGen) return;
  applyStageReviewResult(stageReview);
  await refreshQueue({ silent: true });
  applyWorkspacePayload(payload, { preserveDrafts });
  applyPromoteNotesIfNeeded();
  applyVerifyNotesIfNeeded();
  await syncCopyContractAfterWorkspace();
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
      const reconcileBtn = focusLineId
        ? document.getElementById(`btn-reconcile-${focusLineId}`)
        : null;
      const card = focusLineId
        ? document.querySelector(`.line-card[data-line-id="${focusLineId}"]`)
        : null;
      const preferred =
        focusControl === "correct"
          ? correctBtn
          : focusControl === "resolve"
            ? resolveBtn
            : focusControl === "reconcile"
              ? reconcileBtn
              : resolveBtn || correctBtn;
      (preferred || card?.querySelector("select") || card)?.focus?.();
    });
  }
}

async function backToQueue() {
  if (!(await confirmLeaveDirty("backToQueueBtn"))) return;
  await flushDetailsAutosave();
  await flushClassificationAutosave();
  await flushAllLineAutosaves();
  await flushActionsAutosave();
  state.selectedProductId = null;
  state.stageReview = [];
  state.stageReviewLoaded = false;
  state.stageReviewFailed = false;
  state.approvalNotice = null;
  state.pendingApproval = null;
  state.workerFoundationResult = null;
  state.workerQcPreparationReadResult = null;
  state.workerQcReportReadResult = null;
  resetQcPreparationWorkspace();
  state.workerDryRunResult = null;
  state.workerCompositionPreview = null;
  state.workerProductDetailsPreview = null;
  state.workerProductDetailsResult = null;
  state.workerReconcileResult = null;
  state.workerRebaseResult = null;
  state.workerExactOneRecoveryResult = null;
  state.portalTextRow = null;
  state.portalTextDraft = null;
  state.portalTextSaveStatus = "";
  state.promoteNotes = "";
  state.promoteNotesOrigin = "unset";
  state.verifyNotes = "";
  state.verifyNotesOrigin = "unset";
  state.copyContract = null;
  state.copyContractError = "";
  state.copyPick = null;
  state.queueRow = null;
  state.review = null;
  state.classification = null;
  state.classificationDraft = null;
  state.classificationBaseline = null;
  state.classificationSaveStatus = "";
  state.classificationOptions = {
    PRODUCT_TYPE: [],
    PRODUCT_CATEGORY: [],
    PRODUCT_SUBTYPE: [],
  };
  state.lines = [];
  state.actions = [];
  state.issues = [];
  state.detailsDraft = null;
  state.lineDrafts = new Map();
  state.postEntryReconcile = {
    open: false,
    lineId: null,
    targetIngredientFormOptionId: null,
    reason: "",
    trigger: null,
  };
  state.preservedAfterStale = false;
  $("staleBanner").hidden = true;
  setAppMode("queue");
  renderLenses();
  syncSearchClear();
  const search = $("queueSearch");
  if (search) search.value = state.queueView.search;
  if ($("worklistHome") && !$("worklistHome").hidden) renderWorklist({ restoreScroll: true });
  else renderQueue({ restoreScroll: true });
  requestAnimationFrame(() => {
    if ($("worklistHome") && !$("worklistHome").hidden) {
      restoreWorklistScroll();
      const wanted = state.worklistFocusedId;
      const rows = worklistRowEls();
      const exists = rows.some((row) => String(row.dataset.productId) === String(wanted));
      if (exists) focusWorklistRow(wanted);
      else if (rows[0]) focusWorklistRow(rows[0].dataset.productId);
      else $("worklistSearch")?.focus();
      return;
    }
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
  if (state.postEntryReconcile.open) closePostEntryReconcile();
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
    if (state.pendingApproval) {
      rememberApprovalRefusal(err);
      state.pendingApproval = null;
      await refreshStageReview({ render: true });
    }
    if (err instanceof EaushadhiRpcError && err.kind === ERROR_KIND.STALE) {
      await handleStale(err);
    } else {
      toastError(err);
    }
  } finally {
    state.pendingApproval = null;
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
  state.pendingApproval = { stage: "details", itemKey: "" };
  state.approvalNotice = null;
  await runMutation(async () => {
    await persistDetails(true);
    showToast("Product details approved.", "success");
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

async function persistLine(lineId, verify, { refresh = true } = {}) {
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
  if (refresh) await refreshStageReview();
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
  await refreshStageReview();
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

async function persistPortalFields() {
  const draft = state.portalFieldsDraft;
  if (!draft || !portalFieldsEditable()) return null;
  if (portalFieldsHalted) return null;
  if (!portalFieldsSaveReady(draft)) return null;
  state.portalFieldsSaveStatus = "saving";
  patchAutosaveEl("portalFieldsAutosave", "saving");
  const result = await saveProductDossierPortalFields({
    productId: state.selectedProductId,
    expectedRowVersion: draft.rowVersion,
    remarks: safeText(draft.remarks),
    portalShelfmonthRoute: safeText(draft.portalShelfmonthRoute),
  });
  if (result?.row_version != null && state.portalFieldsDraft) {
    state.portalFieldsDraft.rowVersion = result.row_version;
  }
  if (state.dossierPortalFields && result) {
    state.dossierPortalFields = {
      ...state.dossierPortalFields,
      remarks: result.remarks,
      portal_shelfmonth_route: result.portal_shelfmonth_route,
      row_version: result.row_version,
    };
  }
  state.portalFieldsBaseline = { ...state.portalFieldsDraft };
  state.portalFieldsSaveStatus = "saved";
  patchAutosaveEl("portalFieldsAutosave", "saved");
  return result;
}

async function autosavePortalFields() {
  if (portalFieldsHalted || !portalFieldsEditable()) return;
  if (portalFieldsInflight) {
    portalFieldsQueued = true;
    return;
  }
  portalFieldsInflight = true;
  try {
    await persistPortalFields();
  } catch (err) {
    handleAutosaveError(err, "portalFields");
  } finally {
    portalFieldsInflight = false;
    if (portalFieldsQueued) {
      portalFieldsQueued = false;
      void autosavePortalFields();
    }
  }
}

function queuePortalFieldsAutosave(immediate) {
  if (immediate) {
    flushDebounced(autosaveTimers, "portalFields");
    void autosavePortalFields();
    return;
  }
  scheduleDebounced(autosaveTimers, "portalFields", AUTOSAVE_DEBOUNCE_MS, () => {
    void autosavePortalFields();
  });
}

async function flushPortalFieldsAutosave() {
  if (flushDebounced(autosaveTimers, "portalFields")) await autosavePortalFields();
}

async function refreshPortalTextFromServer(result) {
  let row = null;
  if (result && typeof result === "object") {
    if (result.selected_portal_text !== undefined || result.canonical_text !== undefined) {
      row = result;
    } else if (result.selected_diseases_conditions_portal_text !== undefined) {
      // portal_text_save returns the product_review row; normalize to get-RPC shape.
      row = {
        product_id: result.product_id,
        canonical_text: result.selected_diseases_conditions_text,
        suggested_portal_text: result.suggested_diseases_conditions_portal_text,
        selected_portal_text: result.selected_diseases_conditions_portal_text,
        generation_version: result.diseases_conditions_portal_generation_version,
        portal_review_status: result.diseases_conditions_portal_review_status,
        portal_review_notes: result.diseases_conditions_portal_review_notes,
        row_version: result.row_version,
        reviewed_by: result.diseases_conditions_portal_reviewed_by,
        reviewed_at: result.diseases_conditions_portal_reviewed_at,
      };
    }
  }
  if (!row) {
    row = await fetchProductPortalText(state.selectedProductId).catch(() => null);
  }
  if (!row) return;
  state.portalTextRow = { ...(state.portalTextRow || {}), ...row };
  state.portalTextDraft = newPortalTextDraft(state.portalTextRow);
}

async function persistPortalText(verify) {
  const draft = state.portalTextDraft;
  if (!draft) return null;
  state.portalTextSaveStatus = "saving";
  patchAutosaveEl("portalTextAutosave", "saving");
  const result = await saveProductPortalText({
    productId: state.selectedProductId,
    expectedRowVersion: draft.rowVersion,
    portalText: safeText(draft.editableText),
    verify,
    reason: safeText(draft.reason) || null,
  });
  await refreshPortalTextFromServer(result);
  state.portalTextSaveStatus = "saved";
  patchAutosaveEl("portalTextAutosave", "saved");
  return result;
}

async function submitPortalText(verify) {
  syncPortalTextDraftFromForm();
  const blocked = portalTextBlockingReason();
  if (blocked) {
    showToast(blocked, "error");
    return;
  }
  await runMutation(async () => {
    try {
      await persistPortalText(verify);
    } catch (err) {
      const stale = err instanceof EaushadhiRpcError && err.kind === ERROR_KIND.STALE;
      state.portalTextSaveStatus = stale ? "stale" : "failed";
      patchAutosaveEl("portalTextAutosave", state.portalTextSaveStatus);
      if (stale) await refreshPortalTextFromServer(null);
      throw err;
    }
    showToast(
      verify ? "Portal text verified." : "Portal text saved for review.",
      "success",
    );
    renderDetails();
  });
}

async function persistClassification(verify) {
  const draft = state.classificationDraft;
  if (!draft) return null;
  if (!verify && classificationHalted) return null;
  if (!verify && isVerifiedStatus(state.classification?.review_status)) return null;
  const subtypeMode = resolveClassificationSubtypeMode(draft);
  state.classificationSaveStatus = "saving";
  patchAutosaveEl("classificationAutosave", "saving");
  const result = await saveProductClassificationReview({
    productId: state.selectedProductId,
    expectedRowVersion: draft.rowVersion,
    productTypeOptionId: draft.productTypeOptionId,
    productCategoryOptionId: draft.productCategoryOptionId,
    productSubtypeOptionId: subtypeMode === "OPTION" ? draft.productSubtypeOptionId : null,
    subtypeMode,
    reviewNotes: safeText(draft.reviewNotes) || null,
    verify,
  });
  if (result?.row_version != null && state.classificationDraft) {
    state.classificationDraft.rowVersion = result.row_version;
    state.classificationDraft.reviewStatus = result.review_status || state.classificationDraft.reviewStatus;
    state.classificationDraft.subtypeMode = result.selected_subtype_mode || subtypeMode;
  }
  if (state.classification && result) {
    state.classification = {
      ...state.classification,
      ...result,
      review_status: result.review_status,
      row_version: result.row_version,
      selected_subtype_mode: result.selected_subtype_mode,
    };
  }
  state.classificationBaseline = { ...state.classificationDraft };
  state.classificationSaveStatus = "saved";
  patchAutosaveEl("classificationAutosave", "saved");
  await refreshStageReview();
  return result;
}

async function autosaveClassification() {
  if (classificationHalted || !canWrite()) return;
  if (classificationInflight) {
    classificationQueued = true;
    return;
  }
  classificationInflight = true;
  try {
    await persistClassification(false);
  } catch (err) {
    handleAutosaveError(err, "classification");
  } finally {
    classificationInflight = false;
    if (classificationQueued) {
      classificationQueued = false;
      void autosaveClassification();
    }
  }
}

function queueClassificationAutosave(immediate) {
  if (immediate) {
    flushDebounced(autosaveTimers, "classification");
    void autosaveClassification();
    return;
  }
  scheduleDebounced(autosaveTimers, "classification", AUTOSAVE_DEBOUNCE_MS, () => {
    void autosaveClassification();
  });
}

async function flushClassificationAutosave() {
  if (flushDebounced(autosaveTimers, "classification")) await autosaveClassification();
}

async function reloadClassificationScopedOptions(typeId) {
  if (!typeId) {
    state.classificationOptions = {
      ...state.classificationOptions,
      PRODUCT_CATEGORY: [],
      PRODUCT_SUBTYPE: [],
    };
    return;
  }
  const [categories, subtypes] = await Promise.all([
    fetchProductClassificationOptions("PRODUCT_CATEGORY", typeId),
    fetchProductClassificationOptions("PRODUCT_SUBTYPE", typeId),
  ]);
  state.classificationOptions = {
    ...state.classificationOptions,
    PRODUCT_CATEGORY: categories,
    PRODUCT_SUBTYPE: subtypes,
  };
}

async function handleClassificationTypeChange() {
  if (!state.classificationDraft) return;
  if (!canEditReviewedSection(state.classification?.review_status)) return;
  const typeId = optionId($("fldClassProductType")?.value);
  state.classificationDraft.productTypeOptionId = typeId;
  await reloadClassificationScopedOptions(typeId);
  const cleared = clearIncompatibleClassificationChildren({
    productTypeOptionId: typeId,
    productCategoryOptionId: state.classificationDraft.productCategoryOptionId,
    productSubtypeOptionId: state.classificationDraft.productSubtypeOptionId,
    categoryOptions: state.classificationOptions.PRODUCT_CATEGORY,
    subtypeOptions: state.classificationOptions.PRODUCT_SUBTYPE,
  });
  state.classificationDraft = {
    ...state.classificationDraft,
    ...cleared,
  };
  renderDetails();
  queueClassificationAutosave(true);
}

async function submitClassification(verify) {
  syncClassificationDraftFromForm();
  if (verify) {
    const reason = classificationVerifyPendingCopy(state.classificationDraft, {
      saveStatus: state.classificationSaveStatus,
      reviewStatus: state.classification?.review_status,
    });
    if (
      !canVerifyClassification(state.classificationDraft, {
        canEdit: canWrite(),
        saveStatus: state.classificationSaveStatus,
        reviewStatus: state.classification?.review_status,
      })
    ) {
      showToast(reason || "Portal Classification is not ready to verify.", "error");
      return;
    }
  }
  flushDebounced(autosaveTimers, "classification");
  if (!verify) {
    await autosaveClassification();
    return;
  }
  state.pendingApproval = { stage: "classification", itemKey: "" };
  state.approvalNotice = null;
  await runMutation(async () => {
    await persistClassification(true);
    showToast("Portal Classification approved.", "success");
    await reloadSelected({ preserveDrafts: false });
  });
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
  await refreshStageReview();
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
    } else if (scope === "portalFields") {
      portalFieldsHalted = true;
      state.portalFieldsSaveStatus = "stale";
      patchAutosaveEl("portalFieldsAutosave", "stale");
    } else if (scope === "classification") {
      classificationHalted = true;
      state.classificationSaveStatus = "stale";
      patchAutosaveEl("classificationAutosave", "stale");
      showToast("Server data changed - refresh/review required", "error", 6400);
      void reloadSelected({ preserveDrafts: false });
      return;
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
  } else if (scope === "portalFields") {
    state.portalFieldsSaveStatus = "failed";
    patchAutosaveEl("portalFieldsAutosave", "failed");
  } else if (scope === "classification") {
    state.classificationSaveStatus = "failed";
    patchAutosaveEl("classificationAutosave", "failed");
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
  const id = String(lineId);
  const draft = state.lineDrafts.get(id);
  if (!draft) return;
  const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
  if (verify) {
    const saveStatus = state.lineSaveStatus.get(id) || "";
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
  } else {
    const saveUi = lineSaveForReviewUi({
      reviewStatus: row?.review_status,
      draft,
      baseline: state.lineBaselines.get(id),
      stageRow: stageRow("line", id),
      canWrite: canWrite(),
      busy: state.busy,
    });
    if (!saveUi.visible || !saveUi.enabled) {
      showToast(saveUi.title || "This line cannot be saved for review right now.", "error");
      syncLineSaveReviewUi(id);
      return;
    }
  }
  flushDebounced(autosaveTimers, `line:${lineId}`);
  await waitLineIdle(lineId);
  if (!verify) {
    if (lineHalted.has(id) || !canWrite()) {
      showToast(
        "This line has a save conflict. Refresh the product, then save for review again.",
        "error",
      );
      syncLineSaveReviewUi(id);
      syncLineVerifyUi(id);
      return;
    }
    await autosaveLine(lineId);
    syncLineSaveReviewUi(id);
    syncLineVerifyUi(id);
    return;
  }
  state.pendingApproval = { stage: "line", itemKey: String(lineId) };
  state.approvalNotice = null;
  await runMutation(async () => {
    await persistLine(lineId, true);
    showToast("Line approved.", "success");
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
  state.pendingApproval = { stage: "actions", itemKey: "" };
  state.approvalNotice = null;
  await runMutation(async () => {
    await persistActions(true);
    showToast("Pharmacological actions approved.", "success");
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
  if (kind === "classification") {
    return {
      title: "Reopen Portal Classification",
      body: "Portal Classification has already been verified. Reopening will return the section to In Review.",
      confirm: "Reopen Portal Classification",
    };
  }
  return {
    title: "Reopen Actions",
    body: "Pharmacological actions have already been verified. Reopening will return the section to In Review.",
    confirm: "Reopen Actions",
  };
}

function ingredientFormOptionDisplay(option, fallbackId = null) {
  if (!option) return fallbackId ? `Option ${fallbackId}` : "Not selected";
  const label = displayText(option.label, `Option ${fallbackId || ""}`);
  const externalId = safeText(option.external_id);
  return externalId ? `${label} / ${externalId}` : label;
}

function syncPostEntryReconcileConfirm(authority = null) {
  const current = authority || currentPostEntryIngredientFormReconcile(
    state.postEntryReconcile.lineId,
  );
  const targetId = state.postEntryReconcile.targetIngredientFormOptionId;
  const targetEligible = current.options.some((option) =>
    idsEqual(option.portal_option_id ?? option.id, targetId),
  );
  const ok = targetEligible && canSubmitPostEntryIngredientFormReconcile({
    availability: current.availability,
    currentIngredientFormOptionId: current.draft?.ingredientFormOptionId,
    targetIngredientFormOptionId: targetId,
    reason: state.postEntryReconcile.reason,
  });
  const button = $("postEntryReconcileConfirm");
  if (button) {
    button.disabled = !ok || state.busy;
    button.dataset.forceDisabled = ok ? "false" : "true";
  }
  return ok;
}

function renderPostEntryReconcileBody() {
  const host = $("postEntryReconcileBody");
  if (!host) return;
  const authority = currentPostEntryIngredientFormReconcile(
    state.postEntryReconcile.lineId,
  );
  const currentId = authority.draft?.ingredientFormOptionId;
  const currentOption = (state.catalogs.portalOptions.INGREDIENT_FORM || []).find(
    (option) => idsEqual(option.portal_option_id ?? option.id, currentId),
  );
  host.innerHTML = `
    <div class="form-field">
      <span class="muted-note">Ingredient name</span>
      <strong>${escapeHtml(sourceFieldDisplay(authority.line?.raw_ingredient_name))}</strong>
    </div>
    <div class="form-field">
      <span class="muted-note">Current Ingredient Form</span>
      <strong>${escapeHtml(ingredientFormOptionDisplay(currentOption, currentId))}</strong>
    </div>
    <div class="form-field">
      <label for="fldPostEntryIngredientForm">Proposed Ingredient Form</label>
      <select id="fldPostEntryIngredientForm" class="sasv-control" data-edit-action="true" required>
        ${optionHtml(authority.options, state.postEntryReconcile.targetIngredientFormOptionId)}
      </select>
    </div>
    <div class="form-field">
      <label for="fldPostEntryReconcileReason">Reason</label>
      <textarea id="fldPostEntryReconcileReason" class="sasv-control" rows="3" data-edit-action="true" required>${escapeHtml(state.postEntryReconcile.reason)}</textarea>
    </div>
    <p class="muted-note">Post-entry reconciliation updates the governed Composition mapping only. It does not modify the e-Aushadhi portal.</p>`;
  syncPostEntryReconcileConfirm(authority);
  applyPermissionUi();
}

function closePostEntryReconcile() {
  const trigger = state.postEntryReconcile.trigger;
  state.postEntryReconcile = {
    open: false,
    lineId: null,
    targetIngredientFormOptionId: null,
    reason: "",
    trigger: null,
  };
  const backdrop = $("postEntryReconcileBackdrop");
  if (backdrop) backdrop.hidden = true;
  trigger?.focus?.();
}

function openPostEntryReconcile(lineId, trigger) {
  const authority = currentPostEntryIngredientFormReconcile(lineId);
  if (!authority.availability.enabled || !authority.line || !authority.draft) {
    showToast(authority.availability.reason || "This reconciliation action is unavailable.", "info");
    return false;
  }
  if (!authority.options.length) {
    showToast("No governed Ingredient Form options are currently available.", "info");
    return false;
  }
  state.postEntryReconcile = {
    open: true,
    lineId: String(lineId),
    targetIngredientFormOptionId: null,
    reason: "",
    trigger: trigger || null,
  };
  $("postEntryReconcileBackdrop").hidden = false;
  renderPostEntryReconcileBody();
  $("postEntryReconcileDialog")?.focus();
  requestAnimationFrame(() => $("fldPostEntryIngredientForm")?.focus());
  return true;
}

async function submitPostEntryReconcile() {
  const lineId = state.postEntryReconcile.lineId;
  const authority = currentPostEntryIngredientFormReconcile(lineId);
  const targetId = state.postEntryReconcile.targetIngredientFormOptionId;
  const reason = safeText(state.postEntryReconcile.reason);
  const targetEligible = authority.options.some((option) =>
    idsEqual(option.portal_option_id ?? option.id, targetId),
  );
  const canSubmit = targetEligible && canSubmitPostEntryIngredientFormReconcile({
    availability: authority.availability,
    currentIngredientFormOptionId: authority.draft?.ingredientFormOptionId,
    targetIngredientFormOptionId: targetId,
    reason,
  });
  if (!canSubmit) {
    showToast(
      authority.availability.reason || "Choose a different governed Ingredient Form and provide a reason.",
      "info",
    );
    return;
  }
  await runMutation(async () => {
    try {
      await reconcilePostEntryLineIngredientForm({
        sourceCompositionLineId: authority.line.source_composition_line_id,
        expectedLineRowVersion: authority.draft.rowVersion,
        expectedWorkflowRowVersion: state.queueRow.workflow_row_version,
        ingredientFormOptionId: targetId,
        reason,
      });
    } catch (err) {
      if (!(err instanceof EaushadhiRpcError && err.kind === ERROR_KIND.STALE)) {
        closePostEntryReconcile();
        await reloadSelected({ restoreComposition: true, focusLineId: lineId });
      }
      throw err;
    }
    closePostEntryReconcile();
    showToast("Ingredient Form mapping reconciled.", "success");
    await reloadSelected({
      restoreComposition: true,
      focusLineId: lineId,
      focusControl: "reconcile",
    });
  });
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
  const availability = currentPreEntryReopenAvailability(kind, lineId);
  if (!availability.enabled) {
    if (availability.reason) showToast(availability.reason, "info");
    return false;
  }
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
  return true;
}

async function submitReopen() {
  const reason = safeText(state.reopen.reason);
  if (!reason) return;
  const kind = state.reopen.kind;
  const lineId = state.reopen.lineId;
  const availability = currentPreEntryReopenAvailability(kind, lineId);
  if (!availability.enabled) {
    closeReopen();
    showToast(availability.reason || "This pre-entry correction action is unavailable.", "info");
    return;
  }
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
    } else if (kind === "classification") {
      await reopenProductClassification({
        productId: state.selectedProductId,
        expectedRowVersion: state.classificationDraft?.rowVersion,
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
  let approved = 0;
  const failures = [];
  for (const id of ids) {
    try {
      flushDebounced(autosaveTimers, `line:${id}`);
      await waitLineIdle(id);
      const draft = state.lineDrafts.get(String(id));
      if (!draft || !lineSelectionsComplete(draft)) {
        failures.push("OTHER");
        continue;
      }
      await persistLine(id, true, { refresh: false });
      approved += 1;
    } catch (err) {
      console.error("[eaushadhi] approve reviewed line failed", err);
      failures.push(fourEyesMessage(err)?.code || "OTHER");
    }
  }
  const grouped = bulkApprovalSummary(failures);
  const toast = grouped
    ? (approved ? `Approved ${approved}. ${grouped}.` : `${grouped}.`)
    : `Approved ${approved} reviewed lines.`;
  showToast(toast, failures.length ? "warning" : "success", 5200);
  await refreshStageReview();
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

function currentPromoteEligibility() {
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  return canPromoteFormulation({
    canEdit: canWrite(),
    productReviewStatus: review.review_status,
    compositionReviewComplete: row.composition_review_complete,
    verifiedLines: row.verified_lines ?? evidence.composition_lines_verified,
    compositionLines: row.composition_lines ?? evidence.composition_lines_total,
    openBlockers: row.open_blockers,
    errorOrBlockerIssueCount: openErrorOrBlockerCount(state.issues),
    approvedFormulationPresent: evidence.approved_formulation_present,
    workflowRowVersion: row.workflow_row_version,
  });
}

function currentVerifyArgs() {
  const row = state.queueRow || {};
  const review = state.review || {};
  const evidence = state.evidence || {};
  return {
    canEdit: canWrite(),
    compositionReviewComplete: row.composition_review_complete,
    verifiedLines: row.verified_lines ?? evidence.composition_lines_verified,
    compositionLines: row.composition_lines ?? evidence.composition_lines_total,
    openBlockers: row.open_blockers,
    workflowRowVersion: row.workflow_row_version,
    dossierReady: row.dossier_ready === true || evidence.dossier_ready === true,
    entryStatus: row.entry_status,
    reviewStatus: review.review_status ?? row.review_status,
  };
}

function currentVerifyEligibility() {
  return canVerifyProductWorkflow(currentVerifyArgs());
}

function applyPromoteNotesIfNeeded() {
  if (
    shouldApplyPromoteNotesDefault({
      formulationPromoted: state.evidence?.approved_formulation_present === true,
      promotionEligible: currentPromoteEligibility(),
      notes: state.promoteNotes,
      origin: state.promoteNotesOrigin,
    })
  ) {
    state.promoteNotes = CANONICAL_PROMOTE_NOTES;
    state.promoteNotesOrigin = "default";
  }
}

function applyVerifyNotesIfNeeded() {
  if (
    shouldApplyVerifyNotesDefault({
      alreadyVerified:
        normalizeReviewStatus(
          state.review?.review_status ?? state.queueRow?.review_status,
        ) === "VERIFIED",
      verificationEligible: currentVerifyEligibility(),
      notes: state.verifyNotes,
      origin: state.verifyNotesOrigin,
    })
  ) {
    state.verifyNotes = CANONICAL_VERIFY_NOTES;
    state.verifyNotesOrigin = "default";
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Copy failed.");
}

async function copyExpectedFilename() {
  const text = state.copyContract?.expected_file_name;
  if (!text) {
    showToast("No expected filename to copy.", "error");
    return;
  }
  await copyTextWithToast(text);
}

async function copyQcPrepReportFilename() {
  await copyTextWithToast("EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf");
}

async function copyQcReportNextName() {
  const next = qcReportNextFile(state.qcReports, state.qcPrepServer?.preparation_id);
  if (!next.fileName) return;
  await copyTextWithToast(next.fileName);
}

async function copyTextWithToast(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }
    showToast("Expected filename copied.", "success");
  } catch {
    try {
      fallbackCopyText(text);
      showToast("Expected filename copied.", "success");
    } catch {
      showToast("Copy failed.", "error");
    }
  }
}

async function ensureCopyContract(extension) {
  const ext = String(extension || "").toLowerCase();
  const current = state.copyContract;
  if (
    current &&
    !state.copyContractError &&
    Number(current.product_id) === Number(state.selectedProductId) &&
    current.document_purpose === DOCUMENT_PURPOSE.APPROVED_PRODUCT_COPY &&
    current.extension === ext &&
    current.expected_file_name &&
    current.expected_storage_path
  ) {
    return current;
  }
  try {
    const row = await fetchDocumentUploadContract({
      productId: state.selectedProductId,
      documentPurpose: DOCUMENT_PURPOSE.APPROVED_PRODUCT_COPY,
      extension: ext,
    });
    if (!row?.expected_file_name || !row?.expected_storage_path) {
      state.copyContract = null;
      state.copyContractError = EVIDENCE_CONTRACT_UNAVAILABLE;
      return null;
    }
    state.copyContract = row;
    state.copyContractError = "";
    return row;
  } catch (err) {
    state.copyContract = null;
    state.copyContractError = userMessageForError(err) || EVIDENCE_CONTRACT_UNAVAILABLE;
    return null;
  }
}

async function syncCopyContractAfterWorkspace() {
  const file = state.copyPick?.file;
  if (file) {
    const ext = evidenceFileExtension(file);
    if (!ext || !evidenceFileTypeMatchesExtension(file)) return;
    await ensureCopyContract(ext);
    return;
  }
  if (state.copyContract?.expected_file_name && state.copyContract?.expected_storage_path) return;
  await ensureCopyContract("pdf");
}

async function pickCopyFile(file) {
  if (!file) return;
  const check = validateEvidenceFile(file);
  if (!check.ok) {
    state.copyPick = { file: null, error: check.error };
    renderEvidence();
    return;
  }
  const ext = evidenceFileExtension(file);
  if (!ext) {
    state.copyPick = { file, error: EVIDENCE_EXTENSION_REQUIRED_COPY };
    renderEvidence();
    return;
  }
  if (!evidenceFileTypeMatchesExtension(file)) {
    state.copyPick = { file, error: EVIDENCE_MIME_EXTENSION_MISMATCH_COPY };
    renderEvidence();
    return;
  }
  const contract = await ensureCopyContract(ext);
  if (!contract?.expected_file_name || !contract?.expected_storage_path) {
    state.copyPick = {
      file,
      error: state.copyContractError || EVIDENCE_CONTRACT_UNAVAILABLE,
    };
    renderEvidence();
    return;
  }
  if (!evidenceFileNameMatchesExpected(file.name, contract.expected_file_name)) {
    state.copyPick = { file, error: EVIDENCE_FILENAME_RENAME_COPY };
    renderEvidence();
    return;
  }
  state.copyPick = { file, error: "" };
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
  const ext = evidenceFileExtension(file);
  if (!ext) {
    state.copyPick = { file, error: EVIDENCE_EXTENSION_REQUIRED_COPY };
    renderEvidence();
    return;
  }
  if (!evidenceFileTypeMatchesExtension(file)) {
    state.copyPick = { file, error: EVIDENCE_MIME_EXTENSION_MISMATCH_COPY };
    renderEvidence();
    return;
  }
  const contract = await ensureCopyContract(ext);
  if (!governedCopyUploadReady({ file, contract })) {
    const error = !evidenceFileTypeMatchesExtension(file)
      ? EVIDENCE_MIME_EXTENSION_MISMATCH_COPY
      : !contract?.expected_storage_path
        ? state.copyContractError || EVIDENCE_CONTRACT_UNAVAILABLE
        : evidenceFileNameMatchesExpected(file.name, contract.expected_file_name)
          ? state.copyContractError || EVIDENCE_CONTRACT_UNAVAILABLE
          : EVIDENCE_FILENAME_RENAME_COPY;
    state.copyPick = { file, error };
    renderEvidence();
    return;
  }
  const path = contract.expected_storage_path;
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
  renderLenses();
  renderQueue({ resetChunk: true });
}

function wireEvents() {
  mountModuleActionIcons({
    home: $("homeBtn"),
    refresh: $("refreshBtn"),
  });
  onWorkerStatus((status) => {
    state.workerStatus = status;
    syncWorkerToolbarUi();
    refreshReadinessIfActive();
  });
  void getWorkerStatus().then((status) => {
    if (status?.state) state.workerStatus = status;
    syncWorkerToolbarUi();
  });
  $("eaWorkerToolbar")?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    if (target.closest("#btnWorkerMenuTrigger")) {
      event.preventDefault();
      event.stopPropagation();
      closeReferenceDictionaryFilterMenu();
      toggleWorkerMenu();
      return;
    }
    const action = target.closest("button");
    if (!action || action.disabled || action.getAttribute("aria-disabled") === "true") return;
    const id = action.id;
    if (id === "btnWorkerConnect" || id === "btnWorkerRecheckLogin" || id === "btnWorkerStop" || id === "btnWorkerCapture" || id === "btnWorkerOpenCapture") {
      closeWorkerMenu();
    }
    if (id === "btnWorkerConnect") void submitWorkerConnect();
    if (id === "btnWorkerRecheckLogin") void submitWorkerRecheckLogin();
    if (id === "btnWorkerStop") void submitWorkerStop();
    if (id === "btnWorkerCapture") void submitWorkerCapture();
    if (id === "btnWorkerOpenCapture") void submitWorkerOpenCapture();
  });
  document.addEventListener("click", (event) => {
    if (!workerMenuOpen) return;
    const toolbar = $("eaWorkerToolbar");
    const node = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (toolbar && node && toolbar.contains(node)) return;
    closeWorkerMenu();
  });
  $("referenceDictionaryFilterBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleReferenceDictionaryFilterMenu();
  });
  $("referenceDictionaryFilterMenu")?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-reference-filter]");
    if (!option) return;
    selectReferenceDictionaryFilter(option.dataset.referenceFilter);
  });
  document.addEventListener("click", (event) => {
    if (!referenceDictionaryFilterMenuOpen) return;
    const control = event.target instanceof Element
      ? event.target.closest(".reference-dictionary-filter-control")
      : null;
    if (!control) closeReferenceDictionaryFilterMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (!referenceDictionaryFilterMenuOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeReferenceDictionaryFilterMenu({ restoreFocus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = referenceDictionaryFilterItems();
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    items[(current + direction + items.length) % items.length].focus();
  });
  document.addEventListener("keydown", (event) => {
    if (!workerMenuOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeWorkerMenu({ restoreFocus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...$("eaWorkerMenu").querySelectorAll('.ea-worker-menuitem:not([hidden]):not(:disabled):not([aria-disabled="true"])')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    items[(current + direction + items.length) % items.length].focus();
  });
  window.addEventListener("resize", () => {
    if (workerMenuOpen) positionWorkerMenu();
  });
  $("homeBtn")?.addEventListener("click", async () => {
    if (!(await confirmLeaveDirty("homeBtn"))) return;
    await flushDetailsAutosave();
    await flushClassificationAutosave();
    await flushAllLineAutosaves();
    await flushActionsAutosave();
    Platform.goHome();
  });
  $("refreshBtn")?.addEventListener("click", async () => {
    try {
      if (state.surface === "reference-dictionary") await loadReferenceDictionary({ force: true });
      else if (state.selectedProductId) await reloadSelected({ preserveDrafts: true });
      else await loadReviewHome();
    } catch (err) {
      toastError(err);
    }
  });
  $("worklistRefresh")?.addEventListener("click", () => void loadReviewHome().catch(toastError));
  $("worklistTabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-worklist-queue]");
    if (!button) return;
    state.worklistQueue = button.dataset.worklistQueue;
    rememberWorklistQueue(state.worklistQueue);
    renderWorklist({ resetChunk: true });
  });
  $("worklistFilterBtn")?.addEventListener("click", () => {
    const drawer = $("worklistFilterDrawer");
    if (!drawer) return;
    setWorklistFiltersOpen(drawer.hidden);
  });
  $("worklistFilterDrawer")?.addEventListener("click", (event) => {
    if (event.target === $("worklistFilterDrawer")) setWorklistFiltersOpen(false);
  });
  $("worklistCategory")?.addEventListener("change", refreshChildClassificationDrafts);
  $("worklistSubcategory")?.addEventListener("change", () => {
    const category = $("worklistCategory")?.value || "all";
    const subcategory = $("worklistSubcategory")?.value || "all";
    setLevelSelect(
      $("worklistGroup"),
      filterWorklistRows(queueWorklistRows(), { category, subcategory }),
      "group",
      $("worklistGroup")?.value || "all",
    );
  });
  $("worklistFilterApply")?.addEventListener("click", () => {
    state.worklistCategory = $("worklistCategory")?.value || "all";
    state.worklistSubcategory = $("worklistSubcategory")?.value || "all";
    state.worklistGroup = $("worklistGroup")?.value || "all";
    state.worklistBlocked = $("worklistBlocked")?.checked === true;
    setWorklistFiltersOpen(false);
    renderWorklist({ resetChunk: true });
  });
  $("worklistFilterClear")?.addEventListener("click", () => {
    state.worklistCategory = "all";
    state.worklistSubcategory = "all";
    state.worklistGroup = "all";
    state.worklistBlocked = false;
    renderWorklist({ resetChunk: true });
  });
  $("worklistSearch")?.addEventListener("input", (event) => {
    window.clearTimeout(worklistSearchTimer);
    const value = event.target.value || "";
    worklistSearchTimer = window.setTimeout(() => {
      state.worklistQuery = value;
      syncWorklistFilterControls();
      renderWorklist({ resetChunk: true });
    }, 180);
  });
  $("worklistSearch")?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (safeText(state.worklistQuery)) {
      $("worklistSearch").value = "";
      state.worklistQuery = "";
      renderWorklist({ resetChunk: true });
      return;
    }
    $("worklistSearch").blur();
    const row = worklistRowEls()[0];
    (row || $("worklistFilterBtn"))?.focus();
  });
  $("worklistSearchClear")?.addEventListener("click", () => {
    const search = $("worklistSearch");
    if (search) search.value = "";
    state.worklistQuery = "";
    renderWorklist({ resetChunk: true });
    $("worklistSearch")?.focus();
  });
  $("worklistTableWrap")?.addEventListener("scroll", () => {
    saveWorklistScroll();
    appendWorklistChunk();
  }, { passive: true });
  $("worklistBody")?.addEventListener("click", (event) => {
    const row = event.target.closest("tr.queue-row[data-product-id]");
    if (!row) return;
    openWorklistModal(row.dataset.productId);
  });
  $("worklistBody")?.addEventListener("keydown", (event) => {
    if (isEditableKeyboardTarget(event.target)) return;
    const row = event.target.closest("tr.queue-row[data-product-id]");
    if (!row) return;
    const rows = worklistRowEls();
    const current = rows.indexOf(row);
    if (current < 0) return;
    if (event.key === "Enter") {
      event.preventDefault();
      openWorklistModal(row.dataset.productId);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      let rowsNow = rows;
      let next = nextRovingIndex(current, rowsNow.length, event.key, { wrap: false });
      if (event.key === "ArrowDown" && next === current && appendWorklistChunk({ force: true })) {
        rowsNow = worklistRowEls();
        next = current + 1;
      }
      if (rowsNow[next]) focusWorklistRow(rowsNow[next].dataset.productId);
    }
  });
  $("backToQueueBtn")?.addEventListener("click", backToQueue);
  $("openReferenceDictionaryBtn")?.addEventListener("click", () => void openReferenceDictionary().catch(toastError));
  $("openReferenceDictionaryFromCompositionBtn")?.addEventListener("click", () => void openReferenceDictionary().catch(toastError));
  $("backFromReferenceDictionaryBtn")?.addEventListener("click", () => {
    closeWorkerMenu();
    setAppMode("queue");
    $("openReferenceDictionaryBtn")?.focus();
  });
  $("refreshReferenceDictionaryBtn")?.addEventListener("click", () => void loadReferenceDictionary({ force: true }).catch(toastError));
  $("referenceDictionarySearch")?.addEventListener("input", (event) => {
    state.referenceDictionary.search = event.target.value || "";
    renderReferenceDictionary();
  });
  $("referenceDictionaryPanel")?.addEventListener("click", (event) => {
    const sourceRow = event.target.closest("tr[data-reference-source]");
    if (!sourceRow) return;
    const row = state.referenceDictionary.rows.find((item) => item.source_reference_text === sourceRow.dataset.referenceSource);
    if (row) void openReferenceReview(row, sourceRow).catch(toastError);
  });
  $("referenceDictionaryPanel")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const sourceRow = event.target.closest("tr[data-reference-source]");
    if (!sourceRow) return;
    event.preventDefault();
    const row = state.referenceDictionary.rows.find((item) => item.source_reference_text === sourceRow.dataset.referenceSource);
    if (row) void openReferenceReview(row, sourceRow).catch(toastError);
  });
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
    openProduct(row.dataset.productId, row);
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
      openProduct(row.dataset.productId, row);
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
    if (event.target.id === "btnVerifyPortalDiseases") void submitPortalText(true);
    if (event.target.id === "btnSavePortalDiseases") void submitPortalText(false);
    if (event.target.id === "btnVerifyClassification") void submitClassification(true);
    if (event.target.id === "btnReopenClassification") openReopen("classification", event.target);
    const boolBtn = event.target.closest("[data-bool-value]");
    if (
      boolBtn
      && state.detailsDraft
      && canEditReviewedSection(state.review?.review_status)
      && !isVerifiedStatus(state.review?.review_status)
    ) {
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
    if (event.target.id === "fldClassNotes") {
      if (isVerifiedStatus(state.classification?.review_status)) {
        event.target.value = state.classificationDraft?.reviewNotes || "";
        return;
      }
      syncClassificationDraftFromForm();
      queueClassificationAutosave(false);
      return;
    }
    if (["fldPortalRemarks", "fldPortalShelfmonthRoute"].includes(event.target.id)) {
      syncPortalFieldsDraftFromForm();
      queuePortalFieldsAutosave(false);
      return;
    }
    if (["fldPortalDiseases", "fldPortalDiseasesReason"].includes(event.target.id)) {
      // Portal projection has no autosave: it is saved only by its explicit buttons.
      syncPortalTextDraftFromForm();
      return;
    }
    if (isVerifiedStatus(state.review?.review_status)) {
      const draft = state.detailsDraft;
      if (!draft) return;
      if (event.target.id === "fldTitle") event.target.value = draft.compositionTitle || "";
      if (event.target.id === "fldDiseases") event.target.value = draft.diseasesConditions || "";
      if (event.target.id === "fldReviewNotes") event.target.value = draft.reviewNotes || "";
      return;
    }
    syncDetailsDraftFromForm();
    if (["fldTitle", "fldDiseases", "fldReviewNotes"].includes(event.target.id)) {
      queueDetailsAutosave(false);
    }
  });
  $("tab-details")?.addEventListener("change", (event) => {
    if (state.tab !== "details") return;
    if (event.target.id === "fldClassProductType") {
      if (isVerifiedStatus(state.classification?.review_status)) {
        event.target.value = optionId(state.classificationDraft?.productTypeOptionId) || "";
        return;
      }
      void handleClassificationTypeChange();
      return;
    }
    if (event.target.id === "fldClassCategory" || event.target.id === "fldClassSubtype") {
      if (isVerifiedStatus(state.classification?.review_status)) {
        const draft = state.classificationDraft;
        if (event.target.id === "fldClassCategory") {
          event.target.value = optionId(draft?.productCategoryOptionId) || "";
        } else {
          event.target.value = optionId(draft?.productSubtypeOptionId) || "";
        }
        return;
      }
      syncClassificationDraftFromForm();
      queueClassificationAutosave(true);
      renderDetails();
      return;
    }
    if (event.target.id === "fldPortalShelfmonthRoute") {
      syncPortalFieldsDraftFromForm();
      queuePortalFieldsAutosave(true);
      return;
    }
    if (isVerifiedStatus(state.review?.review_status)) {
      if (event.target.id === "fldPurpose") {
        event.target.value = optionId(state.detailsDraft?.permissionPurposeTermId) || "";
      }
      return;
    }
    syncDetailsDraftFromForm();
    if (event.target.id === "fldPurpose") queueDetailsAutosave(true);
  });
  $("tab-details")?.addEventListener("focusout", (event) => {
    if (event.target.id === "fldClassNotes") {
      void flushClassificationAutosave();
      return;
    }
    if (["fldPortalRemarks", "fldPortalShelfmonthRoute"].includes(event.target.id)) {
      void flushPortalFieldsAutosave();
      return;
    }
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
    const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
    const draft = state.lineDrafts.get(String(lineId));
    if (!draft) return;
    if (!row || isVerifiedStatus(row.review_status)) {
      el.value =
        key === "reviewNotes"
          ? normalizeReviewNotesForDisplay(draft.reviewNotes || "")
          : draft[key] || "";
      return;
    }
    draft[key] = key === "reviewNotes" ? el.value : optionId(el.value);
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
    const lineId = el.dataset.lineId;
    const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
    const draft = state.lineDrafts.get(String(lineId));
    if (!row || isVerifiedStatus(row.review_status)) {
      if (draft) el.value = normalizeReviewNotesForDisplay(draft.reviewNotes || "");
      return;
    }
    if (draft) draft.reviewNotes = el.value;
    queueLineAutosave(lineId, false);
    syncLineSaveReviewUi(lineId);
  });
  $("tab-composition")?.addEventListener("focusout", (event) => {
    const el = event.target;
    if (el.dataset.draftKey !== "reviewNotes") return;
    const lineId = el.dataset.lineId;
    const row = state.lines.find((item) => idsEqual(item.source_composition_line_id, lineId));
    if (!row || isVerifiedStatus(row.review_status)) return;
    flushDebounced(autosaveTimers, `line:${lineId}`);
    void autosaveLine(lineId).then(() => syncLineSaveReviewUi(lineId));
  });
  $("tab-composition")?.addEventListener("click", (event) => {
    if (event.target.id === "btnWorkerCompositionPreview") {
      void submitWorkerCompositionPreview();
      return;
    }
    if (event.target.id === "btnWorkerCompositionVerifyStage" && !event.target.disabled) {
      void submitWorkerCompositionVerifyStage();
      return;
    }
    const compositionStart = event.target.closest("[data-composition-start-line]");
    if (compositionStart && Number(compositionStart.dataset.compositionStartLine) === 931 && !compositionStart.disabled) {
      void submitWorkerCompositionStart(compositionStart);
      return;
    }
    if (event.target.id === "btnClearCompositionFilters") {
      clearCompositionFilters();
      return;
    }
    const saveReview = event.target.closest("[data-line-save]");
    const verify = event.target.closest("[data-line-verify]");
    const resolve = event.target.closest("[data-source-resolve]");
    const correct = event.target.closest("[data-source-correct]");
    const reopen = event.target.closest("[data-line-reopen]");
    const reconcile = event.target.closest("[data-line-reconcile]");
    if (saveReview) void submitLine(saveReview.dataset.lineSave, false);
    if (verify) submitLine(verify.dataset.lineVerify, true);
    if (resolve) openSourceResolve(resolve.dataset.sourceResolve, resolve);
    if (correct) openSourceCorrect(correct.dataset.sourceCorrect, correct);
    if (reopen) openReopen("line", reopen, reopen.dataset.lineReopen);
    if (reconcile) openPostEntryReconcile(reconcile.dataset.lineReconcile, reconcile);
  });

  $("tab-actions")?.addEventListener("click", (event) => {
    if (isVerifiedStatus(state.actionsReviewStatus) && event.target.id !== "btnReopenActions") {
      return;
    }
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
    if (isVerifiedStatus(state.actionsReviewStatus)) {
      renderActions();
      return;
    }
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
    if (isVerifiedStatus(state.actionsReviewStatus)) {
      renderActions();
      return;
    }
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
    const file = event.target.files?.[0];
    if (!file) return;
    void pickCopyFile(file);
  });
  $("tab-evidence")?.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn.id === "btnCopyExpectedFileName") void copyExpectedFilename();
    if (btn.id === "btnChooseCopy") {
      $("fldCopyFile")?.click();
    }
    if (btn.id === "btnUploadCopy") void uploadSelectedCopy();
    if (btn.id === "btnCancelCopy") {
      state.copyPick = null;
      renderEvidence();
    }
    if (btn.id === "btnOpenCopy") void openCurrentCopy();
    if (btn.id === "btnReplaceCopy") {
      state.copyPick = { file: null, error: "" };
      renderEvidence();
      requestAnimationFrame(() => $("fldCopyFile")?.click());
    }
    if (btn.id === "btnQcReportCopyName") void copyQcReportNextName();
    if (btn.id === "btnQcReportUpload") void submitQcReportUpload();
    if (btn.id === "btnQcReportClearFile") clearQcReportFile();
    if (btn.id === "btnQcReportCheckBytes") void submitQcReportByteCheck();
    if (btn.id === "btnQcReportReserveNew") void reserveNewQcReportVersion();
  });
  $("tab-evidence")?.addEventListener("change", (event) => {
    if (event.target.id !== "fldQcReportFile") return;
    const file = event.target.files?.[0];
    if (!file) return;
    void pickQcReportFile(file);
  });

  $("tab-readiness")?.addEventListener("click", (event) => {
    if (event.target.id === "btnPromote") submitPromote();
    if (event.target.id === "btnVerifyProduct") submitVerifyProduct();
    if (event.target.id === "btnWorkerFoundation") submitWorkerFoundationCheck();
    if (event.target.id === "btnQcPreparationRead") submitQcPreparationReadProbe();
    if (event.target.id === "btnQcReportRead") submitQcReportReadProbe();
    if (event.target.id === "btnOpenQcTab") selectWorkflowTab("qc");
    if (event.target.id === "btnWorkerEntryDryRun") submitWorkerEntryDryRun();
    if (event.target.id === "btnWorkerProductDetailsPreview") submitWorkerProductDetailsPreview();
    if (event.target.id === "btnWorkerProductDetailsStart") submitWorkerProductDetailsStart();
    if (event.target.id === "btnWorkerProductDetailsResume") submitWorkerProductDetailsResume();
    if (event.target.id === "btnWorkerReconcileAmbiguous") {
      void submitWorkerReconcileAmbiguousSave();
    }
    if (event.target.id === "btnWorkerRebasePortalProjection") {
      void submitWorkerRebasePortalProjection();
    }
    if (event.target.id === "btnWorkerRecoverExactOneIdentity") {
      void submitWorkerRecoverExactOneIdentity();
    }
  });
  $("tab-readiness")?.addEventListener("input", (event) => {
    if (event.target.id === "fldPromoteNotes") {
      state.promoteNotes = event.target.value;
      state.promoteNotesOrigin = "user";
    }
    if (event.target.id === "fldVerifyNotes") {
      state.verifyNotes = event.target.value;
      state.verifyNotesOrigin = "user";
    }
  });
  $("tab-qc")?.addEventListener("click", (event) => {
    if (event.target.id === "btnQcPrepReview") void submitQcPreparationReview();
    if (event.target.id === "btnQcPrepSave") void submitQcPreparationSave();
    if (event.target.id === "btnQcPrepReload") reloadQcPreparationWorkspace({ feedback: true });
    if (event.target.id === "btnQcPrepCopyName") void copyQcPrepReportFilename();
    if (event.target.id === "btnOpenEvidenceFromQc") selectWorkflowTab("evidence");
    if (event.target.id === "btnQcVerifySourceFacts") void submitQcSourceVerify();
    if (event.target.id === "btnQcReopenSourceFacts") void submitQcReopen();
    if (event.target.id === "btnQcLabRecord") void submitQcLabDecision("INITIAL");
    if (event.target.id === "btnQcLabCorrect") void submitQcLabDecision("CORRECTION");
    if (event.target.id === "btnQcLabReplace") void submitQcLabDecision("REPLACEMENT");
    if (event.target.id === "btnQcLabWithdraw") void submitQcLabDecision("WITHDRAWAL");
    if (String(event.target.id || "").startsWith("btnQcFactAccept-")) {
      void submitQcFactAccept(event.target.getAttribute("data-qc-accept-fact"));
    }
    if (String(event.target.id || "").startsWith("btnQcFactCorrect-") && !String(event.target.id || "").startsWith("btnQcFactCorrectSave-")) {
      const factKey = event.target.getAttribute("data-qc-correct-fact");
      if (factKey && state.qcFactCorrectOpen !== factKey) {
        state.qcFactCorrectOpen = factKey;
        if (state.tab === "qc") renderQc();
      }
    }
    if (String(event.target.id || "").startsWith("btnQcFactCorrectSave-")) {
      void submitQcFactCorrect(event.target.getAttribute("data-qc-correct-fact"));
    }
    if (event.target.id === "btnQcMappingVerify") void submitQcProtocolMapping();
    if (event.target.id === "btnQcFillArm") void submitQcFillArm();
    if (event.target.id === "btnQcFillInspect") void submitQcFillInspect();
    if (event.target.id === "btnQcFillDryRun") void submitQcFillDryRun();
    if (event.target.id === "btnQcNativeSave") void submitQcNativeSave();
    if (event.target.id === "btnQcFillInspectFile") document.getElementById("qcFillInspectFile")?.click();
    if (event.target.id === "btnQcFillFields") void submitQcFillFields();
    if (event.target.id === "btnQcFillChooseReport") document.getElementById("qcFillReportFile")?.click();
    if (event.target.id === "btnQcFillReview") void submitQcFillReview();
    if (event.target.id === "btnQcFillFound") void submitQcFillResolve("FOUND_SAVED");
    if (event.target.id === "btnQcFillMissing") void submitQcFillResolve("NOT_SAVED");
    if (event.target.id === "btnQcFillUnknown") void submitQcFillUnknown();
    if (event.target.id === "btnQcFillVerify") void submitQcFillVerify();
  });
  $("tab-qc")?.addEventListener("input", onQcPrepField);
  $("tab-qc")?.addEventListener("change", onQcPrepField);
  $("tab-qc")?.addEventListener("change", (event) => {
    if (event.target?.id === "qcFillInspectFile") {
      qcFillInspectPendingFile = event.target.files?.[0] || null;
      event.target.value = "";
      state.qcFillChosenReportName = qcFillInspectPendingFile?.name || "";
      state.qcFillInspectFileResult = null;
      if (qcFillInspectPendingFile && state.tab === "qc") renderQc();
      return;
    }
    if (event.target?.id !== "qcFillReportFile") return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void submitQcFillReport(file);
  });
  $("tab-qc")?.addEventListener("wheel", (event) => {
    const select = event.target?.closest?.("select[data-qc-fact-role='supported']");
    if (!select) return;
    event.preventDefault();
    select.blur();
  });
  $("tab-qc")?.addEventListener("focusout", (event) => {
    if (!event.target?.closest?.("#qcPreparationWorkspace")) return;
    qcPrepPendingBlurId = event.target?.id || "";
    qcPrepPendingFocusId = event.relatedTarget?.id || "";
    const dateBlur = event.target.id === "qcPrepStart"
      || event.target.id === "qcPrepEnd"
      || event.target.id === "qcPrepReportDate";
    if (dateBlur && event.relatedTarget !== event.target) {
      syncQcPrepFormFromDom();
      qcPrepApplyGeneratedNotes();
      qcPrepSyncNoteViews();
      updateQcPrepDateMessages();
    }
  });
  $("tab-qc")?.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !event.target?.closest?.("#qcPreparationWorkspace")) return;
    qcPrepTabFieldId = event.target?.id || "";
    qcPrepTabDirection = event.shiftKey ? -1 : 1;
  });
  $("tab-qc")?.addEventListener("toggle", (event) => {
    if (event.target?.id === "qcPreparationWorkspace") state.qcPrepOpen = event.target.open;
  }, true);

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

  $("postEntryReconcileClose")?.addEventListener("click", closePostEntryReconcile);
  $("postEntryReconcileCancel")?.addEventListener("click", closePostEntryReconcile);
  $("postEntryReconcileConfirm")?.addEventListener("click", submitPostEntryReconcile);
  $("postEntryReconcileBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "postEntryReconcileBackdrop") closePostEntryReconcile();
  });
  $("postEntryReconcileBody")?.addEventListener("change", (event) => {
    if (event.target.id !== "fldPostEntryIngredientForm") return;
    state.postEntryReconcile.targetIngredientFormOptionId = optionId(event.target.value);
    syncPostEntryReconcileConfirm();
  });
  $("postEntryReconcileBody")?.addEventListener("input", (event) => {
    if (event.target.id !== "fldPostEntryReconcileReason") return;
    state.postEntryReconcile.reason = event.target.value || "";
    syncPostEntryReconcileConfirm();
  });

  $("verifyReviewedClose")?.addEventListener("click", closeVerifyReviewed);
  $("verifyReviewedCancel")?.addEventListener("click", closeVerifyReviewed);
  $("verifyReviewedConfirm")?.addEventListener("click", submitVerifyReviewed);
  $("verifyReviewedBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "verifyReviewedBackdrop") closeVerifyReviewed();
  });

  $("productDetailsConfirmClose")?.addEventListener("click", () => closeProductDetailsConfirm(false));
  $("productDetailsConfirmCancel")?.addEventListener("click", () => closeProductDetailsConfirm(false));
  $("productDetailsConfirmOk")?.addEventListener("click", () => closeProductDetailsConfirm(true));
  $("productDetailsConfirmBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "productDetailsConfirmBackdrop") closeProductDetailsConfirm(false);
  });
  $("compositionConfirmClose")?.addEventListener("click", () => closeCompositionConfirm(false));
  $("compositionConfirmCancel")?.addEventListener("click", () => closeCompositionConfirm(false));
  $("compositionConfirmOk")?.addEventListener("click", () => closeCompositionConfirm(true));
  $("compositionConfirmBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "compositionConfirmBackdrop") closeCompositionConfirm(false);
  });
  $("compositionStageVerifyConfirmClose")?.addEventListener("click", () => closeCompositionStageVerifyConfirm(false));
  $("compositionStageVerifyConfirmCancel")?.addEventListener("click", () => closeCompositionStageVerifyConfirm(false));
  $("compositionStageVerifyConfirmOk")?.addEventListener("click", () => closeCompositionStageVerifyConfirm(true));
  $("compositionStageVerifyConfirmBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "compositionStageVerifyConfirmBackdrop") closeCompositionStageVerifyConfirm(false);
  });

  document.addEventListener("keydown", (event) => {
    if (state.compositionStageVerifyConfirm.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCompositionStageVerifyConfirm(false);
        return;
      }
      trapModalTab(event, "compositionStageVerifyConfirmDialog");
      return;
    }
    if (state.compositionConfirm.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCompositionConfirm(false);
        return;
      }
      trapModalTab(event, "compositionConfirmDialog");
      return;
    }
    if (state.productDetailsConfirm.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeProductDetailsConfirm(false);
        return;
      }
      trapModalTab(event, "productDetailsConfirmDialog");
      return;
    }
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
    if (state.postEntryReconcile.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePostEntryReconcile();
        return;
      }
      trapModalTab(event, "postEntryReconcileDialog");
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
      if ($("worklistHome") && !$("worklistHome").hidden) $("worklistSearch")?.focus();
      else $("queueSearch")?.focus();
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
  syncWorkerToolbarUi();
  setStatus("Loading product queue...");
  try {
    await loadReviewHome();
    setStatus("");
  } catch (err) {
    console.error("[eaushadhi] initial load failed", err);
    toastError(err);
    setStatus(err.message || "Failed to load the product queue.", "error");
  }
}

initPage();
