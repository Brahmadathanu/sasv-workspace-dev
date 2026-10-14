/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");
const { isAllowedPageUrl } = require("./origin-guard");
const { loadPortalContract } = require("./contracts/portal-contract");
const {
  createInPageIdentityScript,
  createInPageListScript,
  createInPagePayloadKeysScript,
  createInPagePortalFactsScript,
  createInPageQcFillScript,
  createInPageReadFormScript,
  createInPageRereadScript,
  createInPageResetScript,
} = require("./qc-register-dom-fill");
const { createInPageSaveObserveScript } = require("./qc-register-save-observe");
const { QC_PORTAL_CONTRACT } = require("./qc-register-portal-contract");
const { assessQcListResponse } = require("./qc-register-list");
const { createInPageRecaptureScript } = require("./qc-register-recapture");

async function evaluateFactory(page, source, arg) {
  return page.evaluate(
    async ({ source: factorySource, arg: factoryArg }) => {
      // Trusted in-page factory string only.
      // eslint-disable-next-line no-new-func
      const fn = new Function(factorySource)();
      return factoryArg === undefined ? fn() : fn(factoryArg);
    },
    { source, arg },
  );
}

function buildQcPrepRunLive({ getPage, getWorkerState, log } = {}) {
  const writeLog = typeof log === "function" ? log : () => {};

  function currentPage() {
    const page = typeof getPage === "function" ? getPage() : null;
    if (!page || typeof page.evaluate !== "function") {
      throw workerError(ERROR_KINDS.WORKER_NOT_READY, "Connect the portal browser before filling.");
    }
    const state = typeof getWorkerState === "function" ? getWorkerState() : "READY";
    if (state !== "READY" && state !== "RUNNING") {
      throw workerError(ERROR_KINDS.WORKER_NOT_READY, "The portal browser is not ready.");
    }
    const currentUrl = typeof page.url === "function" ? page.url() : "";
    if (!isAllowedPageUrl(currentUrl, loadPortalContract())) {
      throw workerError(ERROR_KINDS.DISALLOWED_ORIGIN, "The portal page is not an allowed e-Aushadhi page.");
    }
    return page;
  }

  return {
    async pageIdentity() {
      const page = currentPage();
      const measured = await evaluateFactory(page, createInPageIdentityScript());
      writeLog({ phase: "qc-prep-arm", detail: "page-identity", route: measured?.route || null });
      return measured;
    },
    async readList() {
      const page = currentPage();
      const raw = await evaluateFactory(page, createInPageListScript());
      const assessed = assessQcListResponse(raw?.payload, { pageno: 0 });
      writeLog({
        phase: "qc-prep-arm",
        detail: "list",
        success: assessed.success,
        coverageComplete: assessed.coverageComplete,
        rowCount: assessed.rows.length,
      });
      return {
        ...assessed,
        domRowIds: Array.isArray(raw?.domRowIds) ? raw.domRowIds : [],
        payload: raw?.payload ?? null,
      };
    },
    async readRecapture() {
      const page = currentPage();
      const raw = await evaluateFactory(page, createInPageRecaptureScript());
      return {
        saveDataSource: typeof raw?.saveDataSource === "string" ? raw.saveDataSource : "",
        scriptText: typeof raw?.scriptText === "string" ? raw.scriptText : "",
      };
    },
    async readPortalFacts() {
      const page = currentPage();
      return evaluateFactory(page, createInPagePortalFactsScript());
    },
    async reread(spec) {
      const page = currentPage();
      const raw = await evaluateFactory(page, createInPageRereadScript(), spec);
      writeLog({ phase: "qc-prep-verify", detail: "reread", httpStatus: raw?.httpStatus || null });
      return raw;
    },
    async fill(plan) {
      const page = currentPage();
      return evaluateFactory(page, createInPageQcFillScript(), plan);
    },
    async readForm() {
      const page = currentPage();
      return evaluateFactory(page, createInPageReadFormScript());
    },
    async payloadKeys() {
      const page = currentPage();
      return evaluateFactory(page, createInPagePayloadKeysScript());
    },
    async resetForm(spec) {
      const page = currentPage();
      const handle = await page.$(`#${QC_PORTAL_CONTRACT.fileInputId}`);
      if (handle && typeof handle.setInputFiles === "function") {
        await handle.setInputFiles([]);
      }
      await evaluateFactory(page, createInPageResetScript(), spec || {});
      return evaluateFactory(page, createInPageReadFormScript());
    },
    async attach(file) {
      const page = currentPage();
      const handle = await page.$(`#${QC_PORTAL_CONTRACT.fileInputId}`);
      if (!handle) {
        throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC report file control is not on the page.");
      }
      await handle.setInputFiles({
        name: file.filename,
        mimeType: "application/pdf",
        buffer: file.buffer,
      });
      const proof = await page.evaluate((inputId) => {
        const el = document.getElementById(inputId);
        const first = el && el.files ? el.files[0] : null;
        return { length: el && el.files ? el.files.length : 0, name: first ? first.name : "" };
      }, QC_PORTAL_CONTRACT.fileInputId);
      return proof;
    },
    async observeSave(spec = {}) {
      const page = currentPage();
      return evaluateFactory(page, createInPageSaveObserveScript(), {
        controlId: QC_PORTAL_CONTRACT.saveControlId,
        timeoutMs: 8000,
        allowClick: spec.allowClick === true,
      });
    },
  };
}

module.exports = {
  buildQcPrepRunLive,
  evaluateFactory,
};
