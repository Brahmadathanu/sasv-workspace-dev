/* eslint-env node */

const { normalizeCompositionReread, normalizeNativeCompositionList } = require("./composition-native-normalizer");

const PRODUCT_ID = 262;
const EXPECTED_ORIGIN = "https://www.e-aushadhi.gov.in";
const EXPECTED_ROUTE = "/admin/addcomposition";
const LIST_INITIAL_LENGTH = 10;
const LIST_MAX_ROWS = 50;
const REFERENCE_WAIT_MS = 5000;
const SAVE_OBSERVE_TIMEOUT_MS = 8000;
const SAVE_ENDPOINT_PATH = "/admin/SaveCompositionData";

function rpcArgs(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function buildCompositionLiveAdapters({ page, callRpc, getWorkerState, liveArmed, log } = {}) {
  if (!page || typeof page.evaluate !== "function") throw new Error("COMPOSITION_PAGE_UNAVAILABLE");
  if (typeof callRpc !== "function") throw new Error("COMPOSITION_RPC_UNAVAILABLE");
  const writeLog = typeof log === "function" ? log : () => {};

  async function pageIdentity(preflight, requireSaveCapability) {
    const state = typeof getWorkerState === "function" ? getWorkerState() : null;
    if (state !== "READY") return { ok: false, code: "WORKER_NOT_READY" };
    const measured = await page.evaluate(({ expectedOrigin, expectedRoute }) => {
      const url = new URL(window.location.href);
      const read = (selector) => {
        const el = document.querySelector(selector);
        const value = el && (el.value ?? el.getAttribute("value"));
        return { present: Boolean(el), value: value == null ? "" : String(value).trim() };
      };
      return {
        origin: url.origin,
        route: url.pathname.toLowerCase(),
        productid: read("#productid"),
        producthid: read("#producthid"),
        id: read("#id"),
        actiontype: read("#actiontype"),
        saveAvailable: typeof window.SaveData === "function",
        expectedOrigin,
        expectedRoute,
      };
    }, { expectedOrigin: EXPECTED_ORIGIN, expectedRoute: EXPECTED_ROUTE });
    const expectedRef = String(preflight?.portal_product_ref ?? "").trim();
    const productid = String(measured.productid?.value ?? "").trim();
    const producthid = String(measured.producthid?.value ?? "").trim();
    const actiontype = String(measured.actiontype?.value ?? "").trim();
    const id = String(measured.id?.value ?? "").trim();
    const field = (source) => ({
      present: source?.present === true,
      length: String(source?.value ?? "").trim().length,
      blank: String(source?.value ?? "").trim().length === 0,
    });
    const diagnostics = {
      productid: field(measured.productid),
      producthid: field(measured.producthid),
      id: { ...field(measured.id), classification: !measured.id?.present ? "MISSING" : !id ? "BLANK" : id === "0" ? "ZERO" : id === "-1" ? "NEGATIVE_ONE" : "NONBLANK" },
      actiontype: field(measured.actiontype),
      actionMode: !measured.actiontype?.present ? "MISSING" : !actiontype ? "BLANK" : actiontype === "add" ? "ADD" : /^(edit|update)$/i.test(actiontype) ? "EDIT_OR_UPDATE" : "OTHER",
      productidEqualsServerPortalRef: Boolean(productid && expectedRef && productid === expectedRef),
      producthidEqualsServerPortalRef: Boolean(producthid && expectedRef && producthid === expectedRef),
      productidEqualsProduct262: productid === String(PRODUCT_ID),
      producthidEqualsProduct262: producthid === String(PRODUCT_ID),
      productidEqualsProducthid: Boolean(productid && producthid && productid === producthid),
      nativeSaveAvailable: measured.saveAvailable === true,
    };
    if (measured.origin !== EXPECTED_ORIGIN) return { ok: false, code: "COMPOSITION_WRONG_ORIGIN", diagnostics };
    if (measured.route !== EXPECTED_ROUTE) return { ok: false, code: "COMPOSITION_WRONG_ROUTE", diagnostics };
    if (!measured.productid?.present || !productid) return { ok: false, code: "COMPOSITION_PRODUCT_TOKEN_MISSING", diagnostics };
    if (!diagnostics.productidEqualsServerPortalRef) return { ok: false, code: "COMPOSITION_PORTAL_TOKEN_MISMATCH", diagnostics };
    if (requireSaveCapability && actiontype !== "add") return { ok: false, code: "COMPOSITION_MUTATION_MODE_NOT_ADD", diagnostics };
    if (requireSaveCapability && measured.saveAvailable !== true) return { ok: false, code: "COMPOSITION_NATIVE_SAVE_UNAVAILABLE", diagnostics };
    return {
      ok: true,
      transportToken: productid,
      diagnostics,
      evidence: {
        actualRoute: measured.route,
        expectedRoute: EXPECTED_ROUTE,
        actualProductId: String(PRODUCT_ID),
        expectedProductId: String(PRODUCT_ID),
        actualPortalProductRef: productid,
        expectedPortalProductRef: expectedRef,
      },
    };
  }

  async function requestList(portalProductRef, length) {
    return page.evaluate(async ({ portalProductRef: token, length: boundedLength }) => {
      const params = new URLSearchParams({
        pageno: "0", length: String(boundedLength), search: "", order: "1,null", productid: token,
      });
      try {
        const response = await fetch(`../admin/LoadCompositionData?${params.toString()}`, {
          method: "POST", credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        const data = await response.json();
        const rows = data?.Data ?? data?.data ?? data?.aaData ?? data?.rows ?? [];
        const totalRaw = data?.TotalCount ?? data?.totalCount ?? data?.recordsTotal ?? rows.length;
        return {
          settled: true,
          success: response.ok && Array.isArray(rows),
          httpStatus: response.status,
          page: 0,
          requestedLength: boundedLength,
          totalCount: Number(totalRaw),
          rows: Array.isArray(rows) ? rows : [],
        };
      } catch {
        return { settled: true, success: false, page: 0, requestedLength: boundedLength, totalCount: null, rows: [] };
      }
    }, { portalProductRef, length });
  }

  async function requestReread(id) {
    return page.evaluate(async (rowId) => {
      try {
        const response = await fetch("../admin/GetCompositionDataUpdate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ id: rowId }),
        });
        const payload = await response.json();
        const data = payload?.Data ?? payload?.data ?? payload;
        return { settled: true, success: response.ok && data && typeof data === "object", httpStatus: response.status, data };
      } catch {
        return { settled: true, success: false, data: null };
      }
    }, id);
  }

  async function captureCompleteList(portalProductRef) {
    let native = await requestList(portalProductRef, LIST_INITIAL_LENGTH);
    if (!native.settled || !native.success || !Number.isInteger(native.totalCount) || native.totalCount < 0) {
      return { settled: true, success: false, coverageComplete: false, rows: [], code: "LIST_REQUEST_FAILED" };
    }
    if (native.totalCount > LIST_MAX_ROWS) {
      return { settled: true, success: true, coverageComplete: false, rows: [], totalCount: native.totalCount, code: "LIST_COVERAGE_LIMIT_EXCEEDED" };
    }
    if (native.rows.length !== native.totalCount && native.totalCount <= LIST_MAX_ROWS) {
      native = await requestList(portalProductRef, Math.max(native.totalCount, 1));
    }
    if (
      !native.settled || !native.success || native.page !== 0 ||
      native.requestedLength < native.totalCount || native.rows.length !== native.totalCount
    ) return { settled: true, success: false, coverageComplete: false, rows: [], code: "LIST_COVERAGE_INCOMPLETE" };
    const parsedIds = [];
    const rereads = [];
    const { parseNativeCompositionRowId } = require("./composition-native-normalizer");
    for (const row of native.rows) {
      const parsed = parseNativeCompositionRowId(row);
      if (!parsed.ok) return { settled: true, success: false, coverageComplete: false, rows: [], code: parsed.code };
      parsedIds.push(parsed.rowId);
      const reread = await requestReread(parsed.rowId);
      if (!reread.settled || !reread.success) return { settled: true, success: false, coverageComplete: false, rows: [], code: "LIST_REREAD_FAILED" };
      rereads.push(reread.data);
    }
    const normalized = normalizeNativeCompositionList({
      rows: native.rows, rereads, totalCount: native.totalCount, requestedLength: native.requestedLength,
    });
    if (!normalized.ok) return { settled: true, success: false, coverageComplete: false, rows: [], code: normalized.code };
    return {
      settled: true,
      success: true,
      coverageComplete: true,
      page: 0,
      requestedLength: native.requestedLength,
      totalCount: native.totalCount,
      rowIds: parsedIds,
      rows: normalized.rows,
    };
  }

  async function loadAuthority({ requireEditPermission = false, requireSaveCapability = false } = {}) {
    const permission = await callRpc("rpc_eaushadhi_require_permission", { p_edit: requireEditPermission === true });
    if (permission == null) return { ok: false, code: "COMPOSITION_PERMISSION_DENIED" };
    const preflight = await callRpc("rpc_eaushadhi_composition_execution_preflight", { p_product_id: PRODUCT_ID });
    if (!preflight || typeof preflight !== "object") return { ok: false, code: "COMPOSITION_PREFLIGHT_MISSING" };
    const content = await callRpc("rpc_eaushadhi_worker_content_get", {
      p_product_id: PRODUCT_ID,
      p_expected_workflow_row_version: Number(preflight.workflow_row_version),
    });
    const identity = await pageIdentity(preflight, requireSaveCapability === true);
    if (!identity.ok) return { ok: false, code: identity.code, message: "Composition page identity failed.", pageIdentityDiagnostics: identity.diagnostics || null };
    const portalListEvidence = await captureCompleteList(identity.transportToken);
    if (!portalListEvidence.coverageComplete) {
      return { ok: false, code: portalListEvidence.code || "LIST_COVERAGE_INCOMPLETE", message: "Complete Composition list was not proven." };
    }
    return { ok: true, preflight, content, pageIdentityEvidence: identity.evidence, pageIdentityDiagnostics: identity.diagnostics, portalListEvidence };
  }

  async function fillTarget(target) {
    const fields = {
      ingredientName: target?.ingredient_name,
      scientificName: target?.scientific_name,
      ingredientType: target?.ingredient_type?.portal_option_value,
      ingredientForm: target?.ingredient_form?.portal_option_value,
      partUsed: target?.part_used?.portal_option_value,
      quantity: target?.quantity_value,
      measurement: target?.measurement?.portal_option_value,
      reference: target?.reference?.portal_value,
    };
    if (Object.values(fields).some((value) => value == null || String(value).trim() === "")) throw new Error("TARGET_PROJECTION_INCOMPLETE");
    const result = await page.evaluate(async ({ fields: values, waitMs }) => {
      const one = (selectors) => selectors.map((s) => document.querySelector(s)).find(Boolean) || null;
      const text = (selectors, value) => {
        const el = one(selectors); if (!el) throw new Error("FIELD_MISSING");
        el.value = String(value); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const select = (selectors, value) => {
        const el = one(selectors); if (!el) throw new Error("SELECT_MISSING");
        const options = [...el.options].filter((o) => String(o.value) === String(value));
        if (options.length !== 1 || !String(value) || String(value) === "-1") throw new Error("SELECT_VALUE_UNPROVEN");
        el.value = String(value); el.dispatchEvent(new Event("change", { bubbles: true })); return el;
      };
      text(["#txtIng1", "#ingredientName", "input[name='ingredientName']"], values.ingredientName);
      text(["#txtBotanical1", "#botanicalName", "input[name='botanicalName']"], values.scientificName);
      select(["#ddlType1", "#ingredientTypeId", "select[name='ingredientTypeId']"], values.ingredientType);
      const reference = one(["#ddlRef1", "#referenceId", "select[name='referenceId']"]);
      const end = Date.now() + waitMs;
      while (Date.now() < end) {
        if (reference && !reference.disabled && [...reference.options].some((o) => String(o.value) === String(values.reference))) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      select(["#ddlRef1", "#referenceId", "select[name='referenceId']"], values.reference);
      select(["#ddlForm1", "#ingredientFormId", "select[name='ingredientFormId']"], values.ingredientForm);
      select(["#ddlPart1", "#partuseId", "select[name='partuseId']"], values.partUsed);
      text(["#txtQty1", "#quantity", "input[name='quantity']"], values.quantity);
      select(["#ddlUnit1", "#unitId", "select[name='unitId']"], values.measurement);
      return { ok: true };
    }, { fields, waitMs: REFERENCE_WAIT_MS });
    if (!result?.ok) throw new Error("COMPOSITION_FILL_FAILED");
    return result;
  }

  async function invokeSaveOnce(runId) {
    if (liveArmed !== true) return { invoked: false, invokeCount: 0, settled: true, noMutationProven: true };
    writeLog({ phase: "composition-save", runId, productId: PRODUCT_ID });
    const capability = await page.evaluate(() => ({
      actionMode: String(document.querySelector("#actiontype")?.value ?? document.querySelector("input[name='actiontype']")?.value ?? ""),
      saveAvailable: typeof window.SaveData === "function",
    }));
    if (capability.actionMode !== "add") {
      return { invoked: false, invokeCount: 0, settled: true, noMutationProven: true, rejectionReason: "NATIVE_ACTION_MODE_NOT_ADD" };
    }
    if (capability.saveAvailable !== true) {
      return { invoked: false, invokeCount: 0, settled: true, noMutationProven: true, rejectionReason: "NATIVE_SAVE_UNAVAILABLE" };
    }

    const matchingRequests = [];
    const matchingResponses = [];
    const isNativeSave = (request) => {
      try {
        const url = new URL(request.url());
        return request.method() === "POST" && url.origin === EXPECTED_ORIGIN && url.pathname === SAVE_ENDPOINT_PATH;
      } catch {
        return false;
      }
    };
    const onRequest = (request) => {
      if (isNativeSave(request)) matchingRequests.push(request);
    };
    const onResponse = (response) => {
      if (isNativeSave(response.request())) matchingResponses.push(response);
    };
    page.on("request", onRequest);
    page.on("response", onResponse);

    let invocation;
    try {
      invocation = await page.evaluate(() => {
        const actionMode = String(document.querySelector("#actiontype")?.value ?? document.querySelector("input[name='actiontype']")?.value ?? "");
        if (actionMode !== "add" || typeof window.SaveData !== "function") {
          return { invoked: false, returnedFalse: false };
        }
        const returned = window.SaveData();
        return { invoked: true, returnedFalse: returned === false };
      });
      const deadline = Date.now() + SAVE_OBSERVE_TIMEOUT_MS;
      while (Date.now() < deadline && matchingResponses.length === 0 && matchingRequests.length <= 1) {
        if (invocation?.returnedFalse === true && matchingRequests.length === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (matchingResponses.length > 0) await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      page.off("request", onRequest);
      page.off("response", onResponse);
    }

    if (invocation?.invoked !== true) {
      return { invoked: false, invokeCount: 0, settled: true, noMutationProven: true, rejectionReason: "NATIVE_ACTION_MODE_NOT_ADD" };
    }
    if (invocation.returnedFalse === true && matchingRequests.length === 0) {
      return {
        invoked: true, invokeCount: 1, settled: true, transportSuccess: false,
        businessSuccess: false, responseParsed: false, matchingRequestCount: 0,
        noMutationProven: true, rejectionReason: "NATIVE_SAVE_VALIDATION_REJECTED",
      };
    }
    if (matchingRequests.length !== 1 || matchingResponses.length !== 1) {
      return {
        invoked: true, invokeCount: 1, settled: false, transportSuccess: false,
        businessSuccess: false, responseParsed: false, matchingRequestCount: matchingRequests.length,
      };
    }
    const response = matchingResponses[0];
    let payload;
    let responseParsed = false;
    try {
      const raw = await response.text();
      if (raw.length <= 8192) {
        payload = JSON.parse(raw);
        responseParsed = payload != null && typeof payload === "object";
      }
    } catch {
      responseParsed = false;
    }
    return {
      invoked: true,
      invokeCount: 1,
      settled: true,
      transportSuccess: response.ok() === true,
      httpStatus: response.status(),
      responseParsed,
      businessSuccess: responseParsed && String(payload.status) === "1",
      matchingRequestCount: 1,
    };
  }

  async function rereadRow(rowId) {
    const native = await requestReread(rowId);
    if (!native.settled || !native.success) return { ok: false, code: "REREAD_FAILED" };
    const normalized = normalizeCompositionReread(native.data, rowId);
    return normalized.ok
      ? { ok: true, row: normalized.row, evidence: native.data }
      : normalized;
  }

  return {
    loadAuthority,
    recheckMutationIdentity: (portalProductRef) => pageIdentity(
      { portal_product_ref: portalProductRef },
      true,
    ),
    fillTarget,
    invokeSaveOnce,
    rereadRow,
    armRun: (args) => callRpc("rpc_eaushadhi_composition_run_arm", rpcArgs({
      p_product_id: args.productId,
      p_target_source_composition_line_id: args.targetSourceCompositionLineId,
      p_expected_workflow_row_version: args.expectedWorkflowRowVersion,
      p_expected_content_hash: args.expectedContentHash,
      p_expected_stage_row_version: args.expectedStageRowVersion,
      p_page_identity_evidence: args.pageIdentityEvidence,
      p_before_list_evidence: args.beforeListEvidence,
      p_planner_report: args.plannerReport,
    })),
    recordSave: (args) => callRpc("rpc_eaushadhi_composition_run_record_save", {
      p_run_id: args.runId,
      p_expected_stage_row_version: args.expectedStageRowVersion,
      p_expected_content_hash: args.expectedContentHash,
      p_outcome: args.outcome,
      p_save_evidence: args.saveEvidence,
    }),
    verifyRow: (args) => callRpc("rpc_eaushadhi_composition_run_verify_row", {
      p_run_id: args.runId,
      p_expected_stage_row_version: args.expectedStageRowVersion,
      p_expected_content_hash: args.expectedContentHash,
      p_after_list_evidence: args.afterListEvidence,
      p_reread_evidence: args.rereadEvidence,
      p_planner_report: args.plannerReport,
      p_resolved_portal_row_id: args.resolvedPortalRowId,
    }),
    markStageVerified: (args) => callRpc("rpc_eaushadhi_composition_stage_mark_portal_verified", {
      p_product_id: args.productId,
      p_expected_stage_row_version: args.expectedStageRowVersion,
      p_expected_workflow_row_version: args.expectedWorkflowRowVersion,
      p_expected_content_hash: args.expectedContentHash,
      p_final_list_evidence: args.finalListEvidence,
      p_planner_report: args.plannerReport,
    }),
  };
}

module.exports = {
  EXPECTED_ORIGIN,
  EXPECTED_ROUTE,
  LIST_INITIAL_LENGTH,
  LIST_MAX_ROWS,
  buildCompositionLiveAdapters,
};
