/* eslint-env node */

/**
 * Trusted Product Details live adapters (Playwright page + worker RPCs).
 * Constructed only by main-process worker when live arm is enabled.
 * Never accept renderer-supplied adapters / portal ids / payloads.
 *
 * RPC name strings live here (not in index.js) so foundation/first-entry
 * source guards that scan index.js remain valid while Phase A is disarmed.
 */

const fs = require("fs");
const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { EXPECTED_APPROVED_COPY_NAME } = require("./product-details-field-map");
const { createInPageFillScript } = require("./portal-dom-fill");
const { createInPageSaveOnceScript } = require("./portal-save-observe");
const { isProductDetailsLiveArmedFor } = require("./product-details-live-arm");

const RUN_BEGIN_RPC = "rpc_eaushadhi_worker_run_begin";
const RUN_RESUME_RPC = "rpc_eaushadhi_worker_run_resume";
const MARK_ENTERED_RPC = "rpc_eaushadhi_worker_mark_entered";
const MARK_PORTAL_VERIFIED_RPC = "rpc_eaushadhi_worker_mark_portal_verified";
const MARK_SAVE_AMBIGUOUS_RPC = "rpc_eaushadhi_worker_mark_save_ambiguous";
const APPROVED_COPY_MIME_TYPE = "application/pdf";

/**
 * Build a Playwright FilePayload for the governed approved Product Copy.
 * Never derives browser File.name from a temp path — name is the trusted constant.
 * Throws Error with .code set to a structured APPROVED_COPY_* class (no filesystem path in message).
 */
function prepareApprovedCopyFilePayload(localPath) {
  const pathStr = localPath == null ? "" : String(localPath).trim();
  if (!pathStr) {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_MISSING");
    err.code = "APPROVED_COPY_LOCAL_FILE_MISSING";
    throw err;
  }
  let exists = false;
  try {
    exists = fs.existsSync(pathStr);
  } catch {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_MISSING");
    err.code = "APPROVED_COPY_LOCAL_FILE_MISSING";
    throw err;
  }
  if (!exists) {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_MISSING");
    err.code = "APPROVED_COPY_LOCAL_FILE_MISSING";
    throw err;
  }
  let stat;
  try {
    stat = fs.statSync(pathStr);
  } catch {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_READ_FAILED");
    err.code = "APPROVED_COPY_LOCAL_FILE_READ_FAILED";
    throw err;
  }
  if (!stat || typeof stat.isFile !== "function" || !stat.isFile()) {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_NOT_REGULAR");
    err.code = "APPROVED_COPY_LOCAL_FILE_NOT_REGULAR";
    throw err;
  }
  if (!Number.isFinite(stat.size) || stat.size <= 0) {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_EMPTY");
    err.code = "APPROVED_COPY_LOCAL_FILE_EMPTY";
    throw err;
  }
  let buffer;
  try {
    buffer = fs.readFileSync(pathStr);
  } catch {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_READ_FAILED");
    err.code = "APPROVED_COPY_LOCAL_FILE_READ_FAILED";
    throw err;
  }
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) {
    const err = new Error("APPROVED_COPY_LOCAL_FILE_EMPTY");
    err.code = "APPROVED_COPY_LOCAL_FILE_EMPTY";
    throw err;
  }
  return {
    name: EXPECTED_APPROVED_COPY_NAME,
    mimeType: APPROVED_COPY_MIME_TYPE,
    buffer,
  };
}

function boundedShelfmonthDiagnostic(value) {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 128);
  return null;
}

function sanitizeShelfmonthEvidence(evidence) {
  const source = evidence && typeof evidence === "object" ? evidence : {};
  const responseValue =
    source.responseValue === "RegularAsPerClause" ||
    source.responseValue === "Applyforaccessofshelflife"
      ? source.responseValue
      : null;
  return {
    source: "GetproductDataUpdate_response",
    responseValue,
    domCheckedValue: boundedShelfmonthDiagnostic(source.domCheckedValue),
    responseMonth: boundedShelfmonthDiagnostic(source.responseMonth),
    domMonth: boundedShelfmonthDiagnostic(source.domMonth),
  };
}

function createInPageRereadScript() {
  return `async function __sasvRereadProductDetails(portalProductId) {
    var id = String(portalProductId == null ? '' : portalProductId).trim();
    if (!id) {
      return { ok: false, reason: 'portal_id_missing' };
    }
    if (typeof window.GetproductDataUpdate !== 'function') {
      return { ok: false, reason: 'GetproductDataUpdate_missing' };
    }

    var loadState = {
      settled: false,
      httpOk: null,
      status: null,
      url: null,
      error: null,
      responseObserved: false,
      responseParsed: false,
      responseShelfmonth: null,
      responseMonth: null,
    };
    function looksLikeGetUpdate(url) {
      return /GetproductDataUpdate|getproductdataupdate/i.test(String(url || ''));
    }
    function normalizeRecognizedShelfmonth(value) {
      if (typeof value !== 'string') return null;
      var normalized = value.trim();
      if (
        normalized !== 'RegularAsPerClause' &&
        normalized !== 'Applyforaccessofshelflife'
      ) return null;
      return normalized;
    }
    function boundedPrimitive(value) {
      if (value == null) return null;
      if (typeof value === 'number' || typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.slice(0, 128);
      return null;
    }
    function observeResponseData(data) {
      loadState.responseObserved = true;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      loadState.responseParsed = true;
      loadState.responseShelfmonth = normalizeRecognizedShelfmonth(data.shelfmonth);
      loadState.responseMonth = boundedPrimitive(data.month);
    }
    function observeXhrResponse(xhr) {
      loadState.responseObserved = true;
      var data = null;
      if (Object.prototype.toString.call(xhr.response) === '[object Object]') {
        data = xhr.response;
      } else {
        try {
          data = JSON.parse(String(xhr.responseText || ''));
        } catch (error) {
          data = null;
        }
      }
      observeResponseData(data);
      data = null;
    }
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__sasvRereadUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      if (looksLikeGetUpdate(xhr.__sasvRereadUrl)) {
        xhr.addEventListener('loadend', function() {
          loadState.url = xhr.__sasvRereadUrl;
          loadState.status = xhr.status;
          loadState.httpOk = xhr.status >= 200 && xhr.status < 300;
          if (loadState.httpOk) observeXhrResponse(xhr);
          loadState.settled = true;
        });
        xhr.addEventListener('error', function() {
          loadState.error = 'xhr_error';
          loadState.settled = true;
          loadState.httpOk = false;
        });
      }
      return origSend.apply(this, arguments);
    };
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url);
        if (!looksLikeGetUpdate(url)) {
          return origFetch.apply(this, arguments);
        }
        return origFetch.apply(this, arguments).then(function(res) {
          loadState.url = url;
          loadState.status = res.status;
          loadState.httpOk = res.ok === true;
          if (!loadState.httpOk) {
            loadState.settled = true;
            return res;
          }
          loadState.responseObserved = true;
          try {
            var clone = res.clone();
            Promise.resolve(clone.json()).then(function(data) {
              observeResponseData(data);
              data = null;
            }).catch(function() {
              loadState.responseParsed = false;
            }).then(function() {
              loadState.settled = true;
            });
          } catch (error) {
            loadState.responseParsed = false;
            loadState.settled = true;
          }
          return res;
        }).catch(function(err) {
          loadState.error = String(err && err.message ? err.message : err);
          loadState.httpOk = false;
          loadState.settled = true;
          throw err;
        });
      };
    }

    function normalizeId(value) {
      if (value == null) return null;
      var text = String(value).trim();
      if (!text || text === '0' || text === '-1') return null;
      return text;
    }
    function val(sel) {
      var el = document.querySelector(sel);
      return el && el.value != null ? String(el.value) : null;
    }
    function text(sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      if (el.selectedIndex >= 0 && el.options && el.options[el.selectedIndex]) {
        return String(el.options[el.selectedIndex].textContent || '').trim();
      }
      return el.value != null ? String(el.value) : null;
    }
    function multiSelectedLabels(sel) {
      var el = document.querySelector(sel);
      if (!el || !el.options) return [];
      return Array.prototype.filter.call(el.options, function(o) { return o.selected; })
        .map(function(o) { return String(o.textContent || o.label || '').trim(); })
        .filter(Boolean);
    }
    function multiSelectedValues(sel) {
      var el = document.querySelector(sel);
      if (!el || !el.options) return [];
      return Array.prototype.filter.call(el.options, function(o) { return o.selected; })
        .map(function(o) { return String(o.value == null ? '' : o.value).trim(); })
        .filter(Boolean)
        .sort();
    }
    function snapshotFields() {
      var shelf = document.querySelector('input[name="shelfmonth"]:checked');
      var drugsYes = document.getElementById('drug_yes');
      var drugsNo = document.getElementById('drug_no');
      var drugs = null;
      if (drugsYes && drugsYes.checked) drugs = 'YES';
      if (drugsNo && drugsNo.checked) drugs = 'NO';
      var actionEl = document.querySelector('#actiontype') || document.querySelector('[name="actiontype"]');
      return {
        name: val('#name'),
        type: val('#type'),
        categoryId: val('#categoryId'),
        subTypeId: val('#subTypeId'),
        permissionPurpose: {
          value: val('#permissionPurpose'),
          label: text('#permissionPurpose'),
        },
        compositionTitle: val('#compositionTitle'),
        disease: val('#disease'),
        indications: multiSelectedValues('select#indications'),
        indicationLabels: multiSelectedLabels('select#indications'),
        drugs: drugs,
        drugsValue: val('#drugsValue'),
        remarks: val('#remarks'),
        domCheckedShelfmonth: shelf ? boundedPrimitive(String(shelf.value)) : null,
        domMonth: boundedPrimitive(val('#month')),
        // Browser file inputs do not expose retained uploaded filenames after edit load.
        attachmentFileName: null,
        attachmentRereadUnavailable: true,
        hiddenId: normalizeId(val('#id')),
        actiontype: actionEl && actionEl.value != null ? String(actionEl.value) : null,
      };
    }

    try {
      try {
        window.GetproductDataUpdate(id);
      } catch (error) {
        return {
          ok: false,
          reason: 'GetproductDataUpdate_threw',
          error: String(error && error.message ? error.message : error),
        };
      }

      var deadline = Date.now() + 15000;
      while (!loadState.settled && Date.now() < deadline) {
        await new Promise(function(r) { setTimeout(r, 50); });
      }
      if (!loadState.settled) {
        return { ok: false, reason: 'reread_load_timeout', portalProductId: id };
      }
      if (loadState.httpOk !== true) {
        return {
          ok: false,
          reason: 'reread_load_http_failed',
          portalProductId: id,
          status: loadState.status,
          error: loadState.error,
        };
      }

      // Deterministic page-state proof: requested id loaded into #id (Edit shell).
      var stateDeadline = Date.now() + 5000;
      var fields = null;
      while (Date.now() < stateDeadline) {
        fields = snapshotFields();
        if (fields.hiddenId === id) break;
        await new Promise(function(r) { setTimeout(r, 50); });
      }
      if (!fields || fields.hiddenId !== id) {
        return {
          ok: false,
          reason: 'reread_requested_id_mismatch',
          portalProductId: id,
          actualHiddenId: fields ? fields.hiddenId : null,
        };
      }

      var responseShelfmonth = normalizeRecognizedShelfmonth(loadState.responseShelfmonth);
      var shelfmonthEvidence = {
        source: 'GetproductDataUpdate_response',
        responseValue: responseShelfmonth,
        domCheckedValue: fields.domCheckedShelfmonth,
        responseMonth: boundedPrimitive(loadState.responseMonth),
        domMonth: fields.domMonth,
      };
      if (!responseShelfmonth) {
        return {
          ok: false,
          reason: 'SHELFMONTH_REREAD_UNPROVEN',
          shelfmonthEvidence: shelfmonthEvidence,
        };
      }

      return {
        ok: true,
        source: 'GetproductDataUpdate',
        requestedId: id,
        loadedHiddenId: fields.hiddenId,
        idMatch: fields.hiddenId === id,
        portalProductId: id,
        loadUrl: loadState.url || null,
        attachmentRereadUnavailable: true,
        name: fields.name,
        type: fields.type,
        categoryId: fields.categoryId,
        subTypeId: fields.subTypeId,
        permissionPurpose: fields.permissionPurpose,
        compositionTitle: fields.compositionTitle,
        disease: fields.disease,
        indications: fields.indications,
        indicationLabels: fields.indicationLabels,
        drugs: fields.drugs,
        drugsValue: fields.drugsValue,
        remarks: fields.remarks,
        shelfmonth: responseShelfmonth,
        month: loadState.responseMonth != null ? loadState.responseMonth : fields.domMonth,
        shelfmonthEvidence: shelfmonthEvidence,
        attachmentFileName: null,
        hiddenId: fields.hiddenId,
        actiontype: fields.actiontype,
        retained: {
          name: fields.name,
          type: fields.type,
          categoryId: fields.categoryId,
          subTypeId: fields.subTypeId,
          permissionPurpose: fields.permissionPurpose,
          compositionTitle: fields.compositionTitle,
          disease: fields.disease,
          indications: fields.indications,
          indicationLabels: fields.indicationLabels,
          drugs: fields.drugs,
          drugsValue: fields.drugsValue,
          remarks: fields.remarks,
          shelfmonth: responseShelfmonth,
          month: loadState.responseMonth != null ? loadState.responseMonth : fields.domMonth,
          shelfmonthEvidence: shelfmonthEvidence,
          attachmentFileName: null,
          attachmentRereadUnavailable: true,
          hiddenId: fields.hiddenId,
          actiontype: fields.actiontype,
        },
      };
    } finally {
      XMLHttpRequest.prototype.open = origOpen;
      XMLHttpRequest.prototype.send = origSend;
      if (typeof origFetch === 'function') {
        window.fetch = origFetch;
      }
    }
  }
  return __sasvRereadProductDetails;`;
}

/**
 * @param {object} deps
 * @param {import('playwright').Page} deps.page
 * @param {Function} deps.callRpc
 * @param {object} [deps.authority]
 * @param {Function} [deps.log]
 */
function buildProductDetailsLiveAdapters(deps = {}) {
  const page = deps.page;
  const callRpc = deps.callRpc;
  const authority = deps.authority || {};
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const mode = deps.mode === "resume" ? "resume" : "start";

  if (!page || typeof page.evaluate !== "function") {
    throw new Error("buildProductDetailsLiveAdapters requires a Playwright page");
  }
  if (typeof callRpc !== "function") {
    throw new Error("buildProductDetailsLiveAdapters requires callRpc");
  }
  if (!isProductDetailsLiveArmedFor(FIRST_CONTROLLED_PRODUCT_ID)) {
    throw new Error("Live Product Details adapters refused: execution is disarmed");
  }

  const shared = {
    async fillForm({ fillPlan, classificationSteps, permissionResolution } = {}) {
      const result = await page.evaluate(
        async ({ source, plan }) => {
          // Trusted in-page factory string only — never renderer-supplied.
          // eslint-disable-next-line no-new-func
          const fn = new Function(source)();
          return fn(plan);
        },
        {
          source: createInPageFillScript(),
          plan: {
            fields: fillPlan?.fields || [],
            classificationSteps: classificationSteps || [],
            permissionResolution: permissionResolution || null,
          },
        },
      );
      const uploadField = (fillPlan?.fields || []).find((f) => f.key === "uploadAttachment" && f.fill);
      const localPath = authority.approvedLocalPath || null;
      let approvedCopyProof = null;
      if (uploadField) {
        if (!localPath) {
          const err = new Error("approved_local_path_missing_for_upload");
          err.code = "APPROVED_COPY_LOCAL_PATH_MISSING";
          throw err;
        }
        // Read into FilePayload in trusted Node — do not pass filesystem path to Playwright.
        const filePayload = prepareApprovedCopyFilePayload(localPath);
        const handle = await page.$("#uploadAttachment");
        if (!handle) {
          const err = new Error("uploadAttachment_input_missing");
          err.code = "UPLOAD_ATTACHMENT_INPUT_MISSING";
          throw err;
        }
        try {
          await handle.setInputFiles({
            name: EXPECTED_APPROVED_COPY_NAME,
            mimeType: APPROVED_COPY_MIME_TYPE,
            buffer: filePayload.buffer,
          });
        } catch (error) {
          const existing = String(error?.code || error?.message || "");
          if (/^APPROVED_COPY_|^UPLOAD_ATTACHMENT_/.test(existing)) throw error;
          const err = new Error("APPROVED_COPY_SET_INPUT_FILES_FAILED");
          err.code = "APPROVED_COPY_SET_INPUT_FILES_FAILED";
          log({
            phase: "product-details-fill",
            productId: FIRST_CONTROLLED_PRODUCT_ID,
            detail: "setInputFiles_failed",
            errorClass: "APPROVED_COPY_SET_INPUT_FILES_FAILED",
          });
          throw err;
        }
        const proof = await page.evaluate(() => {
          const el = document.querySelector("#uploadAttachment");
          return {
            length: el && el.files ? el.files.length : 0,
            name: el && el.files && el.files[0] ? el.files[0].name : null,
            type: el && el.files && el.files[0] ? el.files[0].type : null,
          };
        });
        if (proof.length !== 1 || proof.name !== EXPECTED_APPROVED_COPY_NAME) {
          const err = new Error("APPROVED_COPY_NOT_APPLIED");
          err.code = "APPROVED_COPY_NOT_APPLIED";
          throw err;
        }
        approvedCopyProof = {
          applied: true,
          fileName: proof.name,
          length: proof.length,
          mimeType: proof.type || null,
        };
        log({
          phase: "product-details-fill",
          productId: FIRST_CONTROLLED_PRODUCT_ID,
          detail: "uploadAttachment_set_filepayload",
          expectedFileName: EXPECTED_APPROVED_COPY_NAME,
          mimeType: APPROVED_COPY_MIME_TYPE,
          bufferBytes: filePayload.buffer.length,
        });
      }
      log({
        phase: "product-details-fill",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "dom_fill_complete",
        filledCount: Array.isArray(result?.filled) ? result.filled.length : null,
      });
      return {
        ...result,
        approvedCopyProof,
      };
    },

    async saveOnce() {
      const observation = await page.evaluate(async (source) => {
        // eslint-disable-next-line no-new-func
        const fn = new Function(source)();
        return fn();
      }, createInPageSaveOnceScript());
      log({
        phase: "product-details-save",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "save_once",
        invoked: observation?.invoked === true,
        settled: observation?.settled === true,
        hasPortalId: Boolean(observation?.portalProductId),
        businessSuccess: observation?.businessSuccess === true,
      });
      return observation;
    },

    /**
     * Record an AMBIGUOUS Save outcome on the active run before the executor
     * reports SAVE_AMBIGUOUS. Evidence is the bounded category payload built
     * by the executor — never HTML, cookies or tokens.
     */
    async markSaveAmbiguous(args = {}) {
      log({
        phase: "product-details-save-ambiguous",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "mark_save_ambiguous",
        reason: args.saveEvidence?.reason || null,
      });
      return callRpc(MARK_SAVE_AMBIGUOUS_RPC, {
        p_run_id: args.runId,
        p_expected_workflow_row_version: Number(args.expectedWorkflowRowVersion),
        p_expected_content_hash: args.expectedContentHash,
        p_save_evidence: args.saveEvidence || {},
      });
    },

    async markEntered(args = {}) {
      const portalRef = args.portalProductRef != null ? String(args.portalProductRef).trim() : "";
      if (!portalRef) {
        throw new Error("mark_entered_refused_missing_portal_product_ref");
      }
      log({
        phase: "product-details-entered",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "mark_entered",
        hasPortalId: true,
      });
      return callRpc(MARK_ENTERED_RPC, {
        p_run_id: args.runId,
        p_expected_workflow_row_version: Number(args.expectedWorkflowRowVersion),
        p_expected_content_hash: args.expectedContentHash,
        p_portal_product_ref: portalRef,
        p_entered_audit: args.enteredAudit || {},
      });
    },

    async reread({ portalProductId } = {}) {
      const id = portalProductId != null ? String(portalProductId).trim() : "";
      if (!id) {
        throw new Error("reread_refused_missing_portal_product_id");
      }
      const retained = await page.evaluate(
        async ({ source, id: pid }) => {
          // eslint-disable-next-line no-new-func
          const fn = new Function(source)();
          return fn(pid);
        },
        { source: createInPageRereadScript(), id },
      );
      log({
        phase: "product-details-reread",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "GetproductDataUpdate",
        ok: retained?.ok === true,
      });
      if (!retained || retained.ok !== true) {
        if (retained?.reason === "SHELFMONTH_REREAD_UNPROVEN") {
          const error = new Error("SHELFMONTH_REREAD_UNPROVEN");
          error.code = "SHELFMONTH_REREAD_UNPROVEN";
          error.shelfmonthEvidence = sanitizeShelfmonthEvidence(retained.shelfmonthEvidence);
          throw error;
        }
        throw new Error(retained?.reason || "reread_failed");
      }
      const loadedHiddenId =
        retained.loadedHiddenId != null
          ? String(retained.loadedHiddenId)
          : retained.hiddenId != null
            ? String(retained.hiddenId)
            : null;
      return {
        ...retained,
        shelfmonthEvidence: sanitizeShelfmonthEvidence(retained.shelfmonthEvidence),
        requestedId: id,
        loadedHiddenId,
        idMatch: loadedHiddenId === id,
        retained:
          retained.retained && typeof retained.retained === "object"
            ? retained.retained
            : {
                name: retained.name,
                type: retained.type,
                categoryId: retained.categoryId,
                subTypeId: retained.subTypeId,
                permissionPurpose: retained.permissionPurpose,
                compositionTitle: retained.compositionTitle,
                disease: retained.disease,
                indications: retained.indications,
                indicationLabels: retained.indicationLabels,
                drugs: retained.drugs,
                drugsValue: retained.drugsValue,
                remarks: retained.remarks,
                shelfmonth: retained.shelfmonth,
                month: retained.month,
                shelfmonthEvidence: sanitizeShelfmonthEvidence(retained.shelfmonthEvidence),
                attachmentFileName: retained.attachmentFileName,
                attachmentRereadUnavailable: retained.attachmentRereadUnavailable === true,
                hiddenId: loadedHiddenId,
                actiontype: retained.actiontype,
              },
      };
    },

    async markPortalVerified(args = {}) {
      log({
        phase: "product-details-portal-verified",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "mark_portal_verified",
      });
      return callRpc(MARK_PORTAL_VERIFIED_RPC, {
        p_run_id: args.runId,
        p_expected_workflow_row_version: Number(args.expectedWorkflowRowVersion),
        p_expected_content_hash: args.expectedContentHash,
        p_compare_report: args.compareReport,
      });
    },
  };

  if (mode === "resume") {
    return {
      ...shared,
      async runResume(args = {}) {
        log({ phase: "product-details-run-resume", productId: FIRST_CONTROLLED_PRODUCT_ID });
        return callRpc(RUN_RESUME_RPC, {
          p_run_id: args.runId,
          p_expected_workflow_row_version: Number(args.expectedWorkflowRowVersion),
          p_expected_content_hash: args.expectedContentHash,
        });
      },
    };
  }

  return {
    ...shared,
    async runBegin(args = {}) {
      log({ phase: "product-details-run-begin", productId: FIRST_CONTROLLED_PRODUCT_ID });
      return callRpc(RUN_BEGIN_RPC, {
        p_product_id: FIRST_CONTROLLED_PRODUCT_ID,
        p_expected_workflow_row_version: Number(args.expectedWorkflowRowVersion),
        p_expected_content_hash: args.expectedContentHash,
        p_expected_payload_hash: args.expectedPayloadHash ?? null,
        p_start_context: args.startContext || {
          operation: "product_details_only",
        },
      });
    },
  };
}

module.exports = {
  buildProductDetailsLiveAdapters,
  createInPageRereadScript,
  prepareApprovedCopyFilePayload,
  APPROVED_COPY_MIME_TYPE,
  RUN_BEGIN_RPC,
  RUN_RESUME_RPC,
  MARK_ENTERED_RPC,
  MARK_PORTAL_VERIFIED_RPC,
  MARK_SAVE_AMBIGUOUS_RPC,
};
