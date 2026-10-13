// preload.js
/* eslint-env node */

const { contextBridge, ipcRenderer } = require("electron");

// One expose per key. Do NOT repeat exposeInMainWorld for the same key.
contextBridge.exposeInMainWorld("app", {
  openModuleUrl: (absUrl, opts = {}) =>
    ipcRenderer.send("open-module-url", { absUrl, opts }),
});

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getUpdateState: () => ipcRenderer.invoke("updater:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  onUpdateStatus: (cb) => {
    const handler = (_evt, payload) => cb && cb(payload);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  },
  restartNow: () => ipcRenderer.invoke("updater:restart"),
});

contextBridge.exposeInMainWorld("sopAPI", {
  exportPdf: (title) => ipcRenderer.invoke("sop:export-pdf", { title }),
  exportPdfFromHtml: (title, html, options) =>
    ipcRenderer.invoke("sop:export-pdf-from-html", { title, html, options }),
  exportDocxFromHtml: (title, html, options) =>
    ipcRenderer.invoke("sop:exportDocxFromHtml", { title, html, options }),
});

// Authentication API: small, safe surface for renderer to query session
contextBridge.exposeInMainWorld("auth", {
  getUser: () => ipcRenderer.invoke("auth:whoami"),
  hasPermission: (moduleName, action) =>
    ipcRenderer.invoke("auth:hasPermission", moduleName, action),
  setSession: (user) => ipcRenderer.invoke("auth:setSession", user),
});

contextBridge.exposeInMainWorld("eaushadhiWorkerAPI", {
  getStatus: () => ipcRenderer.invoke("eaushadhi-worker:get-status"),
  connect: () => ipcRenderer.invoke("eaushadhi-worker:connect"),
  recheckLogin: () => ipcRenderer.invoke("eaushadhi-worker:recheck-login"),
  stop: () => ipcRenderer.invoke("eaushadhi-worker:stop"),
  runFoundationCheck: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:foundation-check", {
      productId,
      accessToken,
    }),
  runEntryDryRun: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:entry-dry-run", {
      productId,
      accessToken,
    }),
  previewProductDetails: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:product-details-preview", {
      productId,
      accessToken,
    }),
  startProductDetails: (productId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:product-details-start", {
      productId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  resumeProductDetails: (productId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:product-details-resume", {
      productId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  reconcileAmbiguousSaveProductDetails: (productId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:product-details-reconcile-ambiguous", {
      productId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  rebasePortalProjectionProductDetails: (productId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:product-details-rebase-portal", {
      productId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  recoverAmbiguousSaveExactOneProductDetails: (productId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:product-details-recover-ambiguous-exact-one", {
      productId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  previewComposition: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:composition-preview", { productId, accessToken }),
  startCompositionLine: (productId, sourceCompositionLineId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:composition-start-line", {
      productId,
      sourceCompositionLineId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  recoverCompositionRun: (productId, runId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:composition-recover-run", {
      productId,
      runId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  verifyCompositionStage: (productId, accessToken, options) =>
    ipcRenderer.invoke("eaushadhi-worker:composition-verify-stage", {
      productId,
      accessToken,
      userConfirmed: options?.userConfirmed === true,
    }),
  capturePortalContract: (accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:capture-contract", { accessToken }),
  openCaptureFolder: (accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:open-capture-folder", { accessToken }),
  readQcPreparation: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-preparation-read", {
      productId,
      accessToken,
    }),
  readQcReport: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-report-read", {
      productId,
      accessToken,
    }),
  loadQcProtocolOptions: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-protocol-options", {
      productId,
      accessToken,
    }),
  loadQcLaboratoryOptions: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-laboratory-options", {
      productId,
      accessToken,
    }),
  readQcPreparationWorkspace: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-preparation-workspace-read", {
      productId,
      accessToken,
    }),
  reviewQcPreparation: (productId, accessToken, payload) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-preparation-review", {
      productId,
      accessToken,
      payload,
    }),
  verifyQcPreparationSource: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-preparation-verify-source", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
      expectedRowVersion: draft?.expectedRowVersion,
      attest: draft?.attest === true,
      factEvidence: draft?.factEvidence,
    }),
  reopenQcPreparation: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-preparation-reopen", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
      expectedRowVersion: draft?.expectedRowVersion,
      attest: draft?.attest === true,
      reasonNote: draft?.reasonNote,
    }),
  recheckQcEvidence: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-evidence-recheck", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
    }),
  readQcReadiness: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-readiness", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
    }),
  acceptQcFact: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-fact-accept", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
      expectedRowVersion: draft?.expectedRowVersion,
      factKey: draft?.factKey,
      basisCategory: draft?.basisCategory,
      basisNote: draft?.basisNote,
      attest: draft?.attest === true,
    }),
  correctQcFactAcceptance: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-fact-correct", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
      expectedRowVersion: draft?.expectedRowVersion,
      supersedesAcceptanceId: draft?.supersedesAcceptanceId,
      basisCategory: draft?.basisCategory,
      basisNote: draft?.basisNote,
      correctionReason: draft?.correctionReason,
      attest: draft?.attest === true,
    }),
  verifyQcProtocolMapping: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-protocol-mapping-verify", {
      productId,
      accessToken,
      mappingId: draft?.mappingId,
      expectedStatus: draft?.expectedStatus,
      expectedPortalOptionId: draft?.expectedPortalOptionId,
      mappingReason: draft?.mappingReason,
      attest: draft?.attest === true,
    }),
  readQcFillPreflight: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-fill-preflight", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
    }),
  recordQcLabDecision: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-lab-decision", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
      expectedRowVersion: draft?.expectedRowVersion,
      action: draft?.action,
      supersedesLabBasisId: draft?.supersedesLabBasisId ?? null,
      basisType: draft?.basisType,
      documentReference: draft?.documentReference,
      rationale: draft?.rationale,
      attest: draft?.attest === true,
    }),
  saveQcPreparation: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-preparation-save", {
      productId,
      accessToken,
      preparationId: draft?.preparationId ?? null,
      expectedRowVersion: draft?.expectedRowVersion,
      payload: draft?.payload,
      lastReadStatus: draft?.lastReadStatus ?? null,
    }),
  listQcReports: (productId, accessToken) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-report-list", {
      productId,
      accessToken,
    }),
  reserveQcReport: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-report-reserve", {
      productId,
      accessToken,
      preparationId: draft?.preparationId,
      expectedRowVersion: draft?.expectedRowVersion,
      forceNew: draft?.forceNew === true,
      fileSize: draft?.fileSize,
    }),
  registerQcReport: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-report-register", {
      productId,
      accessToken,
      reservationId: draft?.reservationId,
      expectedRowVersion: draft?.expectedRowVersion,
      objectId: draft?.objectId,
      originalFileName: draft?.originalFileName,
      sha256: draft?.sha256,
      fileSize: draft?.fileSize,
    }),
  verifyQcReportBytes: (productId, accessToken, draft) =>
    ipcRenderer.invoke("eaushadhi-worker:qc-report-verify-bytes", {
      productId,
      accessToken,
      reservationId: draft?.reservationId,
    }),
  onStatus: (cb) => {
    const handler = (_evt, payload) => cb && cb(payload);
    ipcRenderer.on("eaushadhi-worker:status", handler);
    return () => ipcRenderer.removeListener("eaushadhi-worker:status", handler);
  },
});

console.log("preload ready: app, electronAPI, sopAPI, auth, eaushadhiWorkerAPI exposed");
