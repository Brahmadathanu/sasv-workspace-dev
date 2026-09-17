/* eslint-env node */

/**
 * Trusted Product Details live adapters (Playwright page + worker RPCs).
 * Constructed only by main-process worker when live arm is enabled.
 * Never accept renderer-supplied adapters / portal ids / payloads.
 *
 * RPC name strings live here (not in index.js) so foundation/first-entry
 * source guards that scan index.js remain valid while Phase A is disarmed.
 */

const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { EXPECTED_APPROVED_COPY_NAME } = require("./product-details-field-map");
const { createInPageFillScript } = require("./portal-dom-fill");
const { createInPageSaveOnceScript } = require("./portal-save-observe");
const { isProductDetailsLiveArmedFor } = require("./product-details-live-arm");

const RUN_BEGIN_RPC = "rpc_eaushadhi_worker_run_begin";
const MARK_ENTERED_RPC = "rpc_eaushadhi_worker_mark_entered";
const MARK_PORTAL_VERIFIED_RPC = "rpc_eaushadhi_worker_mark_portal_verified";

function createInPageRereadScript() {
  return `async function __sasvRereadProductDetails(portalProductId) {
    var id = String(portalProductId == null ? '' : portalProductId).trim();
    if (!id) {
      return { ok: false, reason: 'portal_id_missing' };
    }
    if (typeof window.GetproductDataUpdate !== 'function') {
      return { ok: false, reason: 'GetproductDataUpdate_missing' };
    }
    try {
      window.GetproductDataUpdate(id);
    } catch (error) {
      return {
        ok: false,
        reason: 'GetproductDataUpdate_threw',
        error: String(error && error.message ? error.message : error),
      };
    }
    await new Promise(function(r) { setTimeout(r, 400); });
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
    var shelf = document.querySelector('input[name="shelfmonth"]:checked');
    var drugsYes = document.getElementById('drug_yes');
    var drugsNo = document.getElementById('drug_no');
    var drugs = null;
    if (drugsYes && drugsYes.checked) drugs = 'YES';
    if (drugsNo && drugsNo.checked) drugs = 'NO';
    var fileInput = document.getElementById('uploadAttachment');
    var attachmentFileName = null;
    if (fileInput && fileInput.files && fileInput.files[0] && fileInput.files[0].name) {
      attachmentFileName = String(fileInput.files[0].name);
    }
    return {
      ok: true,
      source: 'GetproductDataUpdate',
      portalProductId: id,
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
      indications: multiSelectedLabels('select#indications'),
      drugs: drugs,
      drugsValue: val('#drugsValue'),
      remarks: val('#remarks'),
      shelfmonth: shelf ? String(shelf.value) : null,
      month: val('#month'),
      attachmentFileName: attachmentFileName,
      hiddenId: val('#id'),
    };
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

  if (!page || typeof page.evaluate !== "function") {
    throw new Error("buildProductDetailsLiveAdapters requires a Playwright page");
  }
  if (typeof callRpc !== "function") {
    throw new Error("buildProductDetailsLiveAdapters requires callRpc");
  }
  if (!isProductDetailsLiveArmedFor(FIRST_CONTROLLED_PRODUCT_ID)) {
    throw new Error("Live Product Details adapters refused: execution is disarmed");
  }

  return {
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
      if (uploadField) {
        if (!localPath) {
          throw new Error("approved_local_path_missing_for_upload");
        }
        const handle = await page.$("#uploadAttachment");
        if (!handle) {
          throw new Error("uploadAttachment_input_missing");
        }
        await handle.setInputFiles(localPath);
        log({
          phase: "product-details-fill",
          productId: FIRST_CONTROLLED_PRODUCT_ID,
          detail: "uploadAttachment_set",
          expectedFileName: EXPECTED_APPROVED_COPY_NAME,
        });
      }
      log({
        phase: "product-details-fill",
        productId: FIRST_CONTROLLED_PRODUCT_ID,
        detail: "dom_fill_complete",
        filledCount: Array.isArray(result?.filled) ? result.filled.length : null,
      });
      return result;
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
        throw new Error(retained?.reason || "reread_failed");
      }
      return retained;
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
}

module.exports = {
  buildProductDetailsLiveAdapters,
  createInPageRereadScript,
  RUN_BEGIN_RPC,
  MARK_ENTERED_RPC,
  MARK_PORTAL_VERIFIED_RPC,
};
