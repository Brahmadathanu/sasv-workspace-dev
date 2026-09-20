/* eslint-env node */

/**
 * Trusted production orchestration for Karpooradi Product Details.
 *
 * Renderer may supply only productId / accessToken / userConfirmed (+ optional
 * non-authoritative correlationId). All governance evidence is collected here
 * from server RPCs and the connected browser page.
 */

const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const {
  EXPECTED_PORTAL_PRODUCT_NAME,
  EXPECTED_APPROVED_COPY_NAME,
} = require("./product-details-field-map");
const {
  assessProductDetailsPreflight,
  assessProductDetailsResumePreflight,
  executeProductDetails,
  executeProductDetailsResume,
  planResumeAction,
} = require("./product-details-executor");
const { evaluateDuplicateGuard, DUPLICATE_OUTCOME, MAX_LIST_ROWS } = require("./portal-duplicate-guard");

/** Read-only portal projection authority (Product Details diseases text). */
const PORTAL_TEXT_GET_RPC = "rpc_eaushadhi_product_portal_text_get";
/** Server-enforced rebase of an existing run onto the verified projection. */
const REBASE_PORTAL_PROJECTION_RPC = "rpc_eaushadhi_worker_run_rebase_portal_projection";

const RENDERER_FORBIDDEN_OPTION_KEYS = Object.freeze([
  "content",
  "contentHash",
  "finalContentHash",
  "workflowRowVersion",
  "payloadHash",
  "entryStatus",
  "reviewStatus",
  "classificationVerified",
  "isReadyForEntry",
  "duplicateSearch",
  "pageState",
  "permissionOptions",
  "fieldGovernanceOverrides",
  "remarks",
  "portal_remarks",
  "shelfmonth",
  "portal_shelfmonth_route",
  "adapters",
  "origin",
  "path",
  "actiontype",
  "hiddenId",
  "staleEditState",
  "saveDataAvailable",
  "approvedFileName",
  "content_hash",
  "requireEditPermission",
  "p_edit",
  // Trusted-only diagnostic hook — never accepted from renderer IPC.
  "reportPreviewStageFailure",
  // Live arm / portal identity — trusted main-process only.
  "liveArmed",
  "PRODUCT_DETAILS_LIVE_ARM",
  "productIds",
  "portalProductId",
  "portalProductRef",
  "buildAdapters",
  "approvedLocalPath",
  "approvedCopyCleanup",
  "runId",
  "run_id",
  "activeRun",
  "active_run",
  "activeRunCount",
  "resume",
  "resumeEnabled",
  "portalProductRef",
  "portal_product_ref",
  "startContentHash",
  "start_content_hash",
  "resumeSourceReady",
  "compositionReviewComplete",
  "classificationReviewComplete",
  "dossierReady",
  "openBlockers",
  "openPortalIssues",
  // Ambiguous-save reconciliation / portal projection rebase evidence —
  // server truth only, never renderer-supplied.
  "reconciliationEvidence",
  "saveEvidence",
  "lastSaveOutcome",
  "last_save_outcome",
  "save_outcome",
  "markSaveAmbiguous",
  "rebaseEvidence",
  "duplicate_outcome",
  "coverage_complete",
]);

/** Empty / null portal product refs only — never invent entered proof. */
function portalRefIsEmpty(ref) {
  if (ref == null) return true;
  const text = String(ref).trim();
  return text === "" || text.toLowerCase() === "null";
}

/**
 * Durable ambiguous-save recovery eligibility from trusted preflight authority only.
 * Requires successfully obtained preflight (`preflightObtained === true`).
 * Never trusts renderer SAVE_AMBIGUOUS / local history / save evidence blobs.
 */
function deriveAmbiguousSaveRecoverable(authority = {}) {
  if (!authority || authority.preflightObtained !== true) return false;
  if (Number(authority.activeRunCount) !== 1) return false;
  const run = authority.activeRun;
  if (!run || typeof run !== "object") return false;
  if (String(run.run_status ?? run.runStatus ?? "").toUpperCase() !== "RUNNING") {
    return false;
  }
  if (
    String(run.last_save_outcome ?? run.lastSaveOutcome ?? "").toUpperCase() !==
    "AMBIGUOUS"
  ) {
    return false;
  }
  if (String(authority.entryStatus ?? authority.entry_status ?? "").toUpperCase() !== "IN_PROGRESS") {
    return false;
  }
  if (!portalRefIsEmpty(authority.workflowPortalRef ?? authority.workflow_portal_ref)) {
    return false;
  }
  if (!portalRefIsEmpty(run.portal_product_ref ?? run.portalProductRef)) {
    return false;
  }
  return true;
}

function attachAmbiguousSaveRecoverable(assessment, authority) {
  const flag = deriveAmbiguousSaveRecoverable(authority) === true;
  const next = assessment && typeof assessment === "object" ? assessment : {};
  next.ambiguousSaveRecoverable = flag;
  if (next.preview && typeof next.preview === "object") {
    next.preview = { ...next.preview, ambiguousSaveRecoverable: flag };
  } else {
    next.preview = {
      ...(next.preview && typeof next.preview === "object" ? next.preview : {}),
      ambiguousSaveRecoverable: flag,
    };
  }
  return next;
}

/**
 * Resume-source readiness independent of entry_status / is_ready_for_entry.
 * Ordinary Start still uses is_ready_for_entry (NOT_STARTED-only).
 */
function computeResumeSourceReady(src = {}) {
  const reviewOk =
    String(src.reviewStatus ?? src.review_status ?? "").toUpperCase() === "VERIFIED";
  const compositionOk =
    src.compositionReviewComplete === true || src.composition_review_complete === true;
  const classificationOk =
    src.classificationReviewComplete === true ||
    src.classification_review_complete === true;
  const dossierOk = src.dossierReady === true || src.dossier_ready === true;
  const blockers = Number(src.openBlockers ?? src.open_blockers);
  const portalIssues = Number(src.openPortalIssues ?? src.open_portal_issues);
  return (
    reviewOk &&
    compositionOk &&
    classificationOk &&
    dossierOk &&
    Number.isFinite(blockers) &&
    blockers === 0 &&
    Number.isFinite(portalIssues) &&
    portalIssues === 0
  );
}
function notifyPreviewStageFailure(deps, stage, code, error) {
  if (typeof deps?.reportPreviewStageFailure !== "function") return;
  try {
    deps.reportPreviewStageFailure({ stage, code, error });
  } catch {
    // Diagnostics must never break fail-closed preview.
  }
}

/** Best-effort approved-copy cache cleanup. Never throws. Never logs paths. */
function invokeApprovedCopyCleanup(authority) {
  try {
    if (typeof authority?.approvedCopyCleanup === "function") {
      authority.approvedCopyCleanup();
    }
  } catch {
    // ignore
  }
}

/**
 * Strip renderer payload to the only allowed command fields.
 * Forbidden keys are discarded (never forwarded into governance).
 */
function sanitizeRendererCommand(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const forbiddenPresent = RENDERER_FORBIDDEN_OPTION_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(src, key),
  );
  return {
    userConfirmed: src.userConfirmed === true,
    correlationId:
      src.correlationId != null && String(src.correlationId).trim()
        ? String(src.correlationId).trim().slice(0, 128)
        : null,
    forbiddenPresent,
  };
}

function createInPageProductDetailsProbe() {
  return () => {
    const origin = String(location.origin || "");
    const path = String(location.pathname || "");
    const actionEl =
      document.querySelector("#actiontype") ||
      document.querySelector("[name='actiontype']");
    const idEl = document.querySelector("#id");
    const hiddenId = idEl && idEl.value != null ? String(idEl.value) : "";
    const actiontype = actionEl && actionEl.value != null ? String(actionEl.value) : "";
    const editHints = Boolean(
      document.querySelector(".edit-mode, #editMode, [data-mode='edit']") ||
        /edit/i.test(actiontype),
    );
    return {
      origin,
      path,
      actiontype,
      hiddenId,
      staleEditState: editHints && String(hiddenId).trim() !== "",
      saveDataAvailable: typeof window.SaveData === "function",
    };
  };
}

function createInPagePermissionOptionsProbe() {
  return () => {
    const el = document.querySelector("#permissionPurpose");
    if (!el || !el.options) return [];
    return Array.from(el.options).map((opt) => ({
      value: String(opt.value),
      label: String(opt.textContent || opt.label || "").trim(),
    }));
  };
}

/**
 * Read-only duplicate search via the proven DataTable list POST:
 * POST ../admin/LoadProductDataforLegacy?pageno&length&search&order&licenseid
 * with blank transport search and no business request body.
 *
 * Does NOT call window.LoadProductDataforLegacy even if it exists.
 * Does NOT infer NONE from visible table rows.
 * Does NOT use successive pageno>0 pagination (not contract-proven).
 * License comes from document.getElementById("licenseid"), matching portal source.
 * targetName is local exact-comparison authority only — never written to search=.
 */
function createInPageDuplicateSearchProbe() {
  return async (targetName) => {
    const resolvedTarget = String(targetName || "").trim() || "Karpooradi Thailam";
    const endpointRel = "../admin/LoadProductDataforLegacy";
    const maxListRows = 500;

    function extract(payload) {
      const obj = payload && typeof payload === "object" ? payload : null;
      if (!obj) {
        return { totalCount: null, rows: null, businessFailure: false };
      }
      const status = obj.status;
      const statusText =
        status == null ? "" : String(status).trim().toLowerCase();
      const businessFailure =
        status === 0 ||
        status === false ||
        statusText === "0" ||
        statusText === "false";
      const rowsRaw = Array.isArray(obj.aaData)
        ? obj.aaData
        : Array.isArray(obj.statusData)
          ? obj.statusData
          : Array.isArray(obj.data)
            ? obj.data
            : Array.isArray(obj.rows)
              ? obj.rows
              : null;
      const totalCount =
        obj.TotalCount != null
          ? Number(obj.TotalCount)
          : obj.iTotalRecords != null
            ? Number(obj.iTotalRecords)
            : obj.totalCount != null
              ? Number(obj.totalCount)
              : null;
      const rows = Array.isArray(rowsRaw)
        ? rowsRaw.map(function (row) {
            if (row == null) return { name: "" };
            if (typeof row === "string") return { name: row };
            if (Array.isArray(row)) return { name: String(row[1] || row[0] || "") };
            return {
              name: String(row.name || row.product_name || row.ProductName || ""),
              id: row.id != null ? row.id : row.product_id,
            };
          })
        : null;
      return {
        totalCount: Number.isFinite(totalCount) ? totalCount : null,
        rows: rows,
        businessFailure: businessFailure,
        portalStatus: status,
        portalMessage: obj.message != null ? String(obj.message) : null,
      };
    }

    function baseEvidence(extra) {
      return Object.assign(
        {
          source: "LoadProductDataforLegacy",
          mechanism: "datatable_list_post",
          transportSearch: "",
          transportSearchBlank: true,
          targetName: resolvedTarget,
          localExactEvaluation: true,
          usedGlobalWindowFn: false,
          globalWindowFnPresent: typeof window.LoadProductDataforLegacy === "function",
        },
        extra || {},
      );
    }

    function buildListUrl(params) {
      const qs = new URLSearchParams();
      qs.set("pageno", String(params.pageno != null ? params.pageno : 0));
      qs.set("length", String(params.length != null ? params.length : 10));
      qs.set("search", String(params.search != null ? params.search : ""));
      qs.set("order", String(params.order != null ? params.order : "1,null"));
      qs.set("licenseid", String(params.licenseid != null ? params.licenseid : ""));
      return endpointRel + "?" + qs.toString();
    }

    async function postList(params) {
      const listUrl = buildListUrl(params);
      if (window.jQuery && typeof window.jQuery.ajax === "function") {
        return await new Promise(function (resolve, reject) {
          window.jQuery.ajax({
            url: listUrl,
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            success: resolve,
            error: function (_xhr, status, err) {
              reject(new Error(String(err || status || "ajax_failed")));
            },
          });
        });
      }
      const url = new URL(listUrl, location.href).href;
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!res.ok) throw new Error("http_" + res.status);
      return await res.json();
    }

    // Match portal source: document.getElementById("licenseid").value
    const licenseEl = document.getElementById("licenseid");
    const licenseid =
      licenseEl && licenseEl.value != null ? String(licenseEl.value) : "";
    const blankParams = {
      pageno: 0,
      length: 10,
      search: "",
      order: "1,null",
      licenseid: licenseid,
    };

    let pageFetches = 0;
    let firstPayload;
    try {
      firstPayload = await postList(blankParams);
      pageFetches += 1;
    } catch (error) {
      return baseEvidence({
        totalCount: null,
        rows: null,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "list_request_failed",
        error: String(error && error.message ? error.message : error),
      });
    }

    if (!firstPayload || typeof firstPayload !== "object") {
      return baseEvidence({
        totalCount: null,
        rows: null,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "malformed_response",
      });
    }

    let extracted = extract(firstPayload);
    if (extracted.businessFailure) {
      return baseEvidence({
        totalCount: null,
        rows: null,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "portal_business_failure",
        portalStatus: extracted.portalStatus,
        portalMessage: extracted.portalMessage,
      });
    }
    if (!Number.isFinite(extracted.totalCount) || extracted.totalCount < 0) {
      return baseEvidence({
        totalCount: extracted.totalCount,
        rows: extracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "total_count_unavailable",
      });
    }
    if (!Array.isArray(extracted.rows)) {
      return baseEvidence({
        totalCount: extracted.totalCount,
        rows: null,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "rows_missing",
      });
    }
    if (extracted.rows.length > extracted.totalCount) {
      return baseEvidence({
        totalCount: extracted.totalCount,
        rows: extracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "rows_exceed_total_count",
      });
    }

    if (extracted.totalCount === 0) {
      if (extracted.rows.length !== 0) {
        return baseEvidence({
          totalCount: 0,
          rows: extracted.rows,
          coverageComplete: false,
          pageFetches: pageFetches,
          reason: "total_zero_with_rows",
        });
      }
      return baseEvidence({
        totalCount: 0,
        rows: [],
        coverageComplete: true,
        pageFetches: pageFetches,
      });
    }

    if (extracted.rows.length === extracted.totalCount) {
      return baseEvidence({
        totalCount: extracted.totalCount,
        rows: extracted.rows,
        coverageComplete: true,
        pageFetches: pageFetches,
      });
    }

    if (extracted.totalCount > maxListRows) {
      return baseEvidence({
        totalCount: extracted.totalCount,
        rows: extracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "total_count_over_bound",
        maxListRows: maxListRows,
      });
    }

    const firstTotal = extracted.totalCount;
    let fullPayload;
    try {
      fullPayload = await postList({
        pageno: 0,
        length: firstTotal,
        search: "",
        order: "1,null",
        licenseid: licenseid,
      });
      pageFetches += 1;
    } catch (error) {
      return baseEvidence({
        totalCount: firstTotal,
        rows: extracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "full_refetch_failed",
        error: String(error && error.message ? error.message : error),
      });
    }

    if (!fullPayload || typeof fullPayload !== "object") {
      return baseEvidence({
        totalCount: firstTotal,
        rows: extracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "malformed_response",
      });
    }

    const fullExtracted = extract(fullPayload);
    if (fullExtracted.businessFailure) {
      return baseEvidence({
        totalCount: firstTotal,
        rows: extracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "portal_business_failure",
        portalStatus: fullExtracted.portalStatus,
        portalMessage: fullExtracted.portalMessage,
      });
    }
    if (!Number.isFinite(fullExtracted.totalCount)) {
      return baseEvidence({
        totalCount: firstTotal,
        rows: fullExtracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "total_count_unavailable",
      });
    }
    if (fullExtracted.totalCount !== firstTotal) {
      return baseEvidence({
        totalCount: fullExtracted.totalCount,
        rows: fullExtracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "total_count_changed",
        firstTotalCount: firstTotal,
      });
    }
    if (!Array.isArray(fullExtracted.rows)) {
      return baseEvidence({
        totalCount: firstTotal,
        rows: null,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "rows_missing",
      });
    }
    if (fullExtracted.rows.length !== firstTotal) {
      return baseEvidence({
        totalCount: firstTotal,
        rows: fullExtracted.rows,
        coverageComplete: false,
        pageFetches: pageFetches,
        reason: "full_refetch_incomplete",
      });
    }

    return baseEvidence({
      totalCount: firstTotal,
      rows: fullExtracted.rows,
      coverageComplete: true,
      pageFetches: pageFetches,
    });
  };
}

async function measureConnectedPageState({ page, workerState }) {
  if (workerState !== "READY") {
    return {
      ok: false,
      code: "WORKER_NOT_READY",
      pageState: { workerState, saveDataAvailable: false },
    };
  }
  if (!page || typeof page.evaluate !== "function") {
    return {
      ok: false,
      code: "PAGE_UNAVAILABLE",
      pageState: { workerState, saveDataAvailable: false },
    };
  }
  const measured = await page.evaluate(createInPageProductDetailsProbe());
  return {
    ok: true,
    pageState: {
      workerState,
      origin: measured.origin,
      path: measured.path,
      actiontype: measured.actiontype,
      hiddenId: measured.hiddenId,
      staleEditState: measured.staleEditState === true,
      saveDataAvailable: measured.saveDataAvailable === true,
    },
  };
}

async function enumerateLivePermissionOptions(page) {
  if (!page || typeof page.evaluate !== "function") {
    return { ok: false, code: "PERMISSION_OPTIONS_UNAVAILABLE", options: [] };
  }
  const options = await page.evaluate(createInPagePermissionOptionsProbe());
  return {
    ok: Array.isArray(options),
    options: Array.isArray(options) ? options : [],
  };
}

async function runLiveDuplicateSearch(page, targetName) {
  if (!page || typeof page.evaluate !== "function") {
    return {
      ok: false,
      searchResponse: {
        source: "LoadProductDataforLegacy",
        mechanism: "datatable_list_post",
        transportSearch: "",
        transportSearchBlank: true,
        targetName: targetName || EXPECTED_PORTAL_PRODUCT_NAME,
        localExactEvaluation: true,
        totalCount: null,
        rows: null,
        coverageComplete: false,
        reason: "page_unavailable",
      },
    };
  }
  const searchResponse = await page.evaluate(
    createInPageDuplicateSearchProbe(),
    targetName || EXPECTED_PORTAL_PRODUCT_NAME,
  );
  return { ok: true, searchResponse };
}

/**
 * Collect authoritative server + browser evidence. Never trusts renderer body.
 */
async function collectAuthoritativeProductDetailsContext(deps = {}) {
  const productId = Number(deps.productId);
  const missing = [];
  if (productId !== FIRST_CONTROLLED_PRODUCT_ID) {
    return {
      ok: false,
      code: "PRODUCT_LOCK_REJECTED",
      message: `Product Details accepts only product_id ${FIRST_CONTROLLED_PRODUCT_ID}.`,
      missing: ["productId"],
    };
  }
  if (typeof deps.callRpc !== "function") {
    return {
      ok: false,
      code: "AUTHORITATIVE_EVIDENCE_MISSING",
      message: "Trusted RPC adapter missing.",
      missing: ["callRpc"],
    };
  }

  // INTERNAL trusted flag only — never from renderer IPC.
  const requireEditPermission = deps.requireEditPermission === true;
  try {
    await deps.callRpc("rpc_eaushadhi_require_permission", {
      p_edit: requireEditPermission,
    });
  } catch (error) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: error?.message || "Permission check failed.",
      missing: ["permission"],
      requireEditPermission,
    };
  }

  let preflight;
  try {
    preflight = await deps.callRpc("rpc_eaushadhi_worker_preflight", {
      p_product_id: productId,
    });
  } catch (error) {
    return {
      ok: false,
      code: "AUTHORITATIVE_EVIDENCE_MISSING",
      message: error?.message || "worker_preflight failed.",
      missing: ["preflight"],
    };
  }
  const preflightObtained = !!(preflight && typeof preflight === "object");
  if (!preflightObtained) {
    missing.push("preflight");
  }

  const workflowRowVersion =
    preflight?.workflow_row_version != null
      ? Number(preflight.workflow_row_version)
      : null;
  if (!Number.isInteger(workflowRowVersion)) missing.push("workflow_row_version");

  // Parse active-run markers as soon as preflight is obtained so later probe
  // failures can still fail-closed-derive durable recovery visibility.
  const activeRunCountEarly = Number(preflight?.active_run_count ?? 0);
  let activeRunEarly = null;
  if (preflight?.active_run && typeof preflight.active_run === "object") {
    const raw = preflight.active_run;
    activeRunEarly = {
      run_id: raw.run_id ?? null,
      run_status: raw.run_status ?? null,
      start_content_hash: raw.start_content_hash ?? null,
      start_payload_hash: raw.start_payload_hash ?? null,
      current_workflow_row_version: raw.current_workflow_row_version ?? null,
      portal_product_ref: raw.portal_product_ref ?? null,
      started_at: raw.started_at ?? null,
      last_save_outcome: raw.last_save_outcome ?? null,
      last_save_observed_at: raw.last_save_observed_at ?? null,
    };
  }
  const entryStatusEarly =
    preflight?.entry_status != null ? String(preflight.entry_status) : null;
  const workflowPortalRefEarly = preflight?.portal_product_ref ?? null;
  const preflightRecoverySlice = {
    preflightObtained,
    preflight: preflightObtained ? preflight : null,
    activeRunCount: preflightObtained ? activeRunCountEarly : 0,
    activeRun: preflightObtained ? activeRunEarly : null,
    entryStatus: entryStatusEarly,
    workflowPortalRef: workflowPortalRefEarly,
  };

  let content = null;
  if (Number.isInteger(workflowRowVersion)) {
    try {
      content = await deps.callRpc("rpc_eaushadhi_worker_content_get", {
        p_product_id: productId,
        p_expected_workflow_row_version: workflowRowVersion,
      });
    } catch (error) {
      return {
        ok: false,
        code: "AUTHORITATIVE_EVIDENCE_MISSING",
        message: error?.message || "content_get failed.",
        missing: ["content_get"],
        ...preflightRecoverySlice,
      };
    }
  }
  if (!content || typeof content !== "object") missing.push("content");
  const contentHash = content?.content_hash || null;
  if (!contentHash) missing.push("content_hash");

  const reviewStatus =
    content?.product?.review_status ||
    content?.review?.review_status ||
    preflight?.review_status ||
    null;
  if (reviewStatus == null || String(reviewStatus).trim() === "") {
    missing.push("review_status");
  }

  const classificationVerified =
    content?.classification?.is_verified === true ||
    String(content?.classification?.review_status || "").toUpperCase() === "VERIFIED";
  if (content?.classification == null) missing.push("classification");

  const isReadyForEntry =
    preflight?.is_ready_for_entry === true || content?.is_ready_for_entry === true;
  if (
    preflight?.is_ready_for_entry == null &&
    content?.is_ready_for_entry == null
  ) {
    missing.push("is_ready_for_entry");
  }

  const compositionReviewComplete = preflight?.composition_review_complete === true;
  const classificationReviewComplete =
    preflight?.classification_review_complete === true;
  const dossierReady = preflight?.dossier_ready === true;
  const openBlockers =
    preflight?.open_blockers != null ? Number(preflight.open_blockers) : null;
  const openPortalIssues =
    preflight?.open_portal_issues != null ? Number(preflight.open_portal_issues) : null;
  const resumeSourceReady = computeResumeSourceReady({
    reviewStatus,
    compositionReviewComplete,
    classificationReviewComplete,
    dossierReady,
    openBlockers,
    openPortalIssues,
  });

  const entryStatus =
    content?.entry_status != null
      ? String(content.entry_status)
      : preflight?.entry_status != null
        ? String(preflight.entry_status)
        : null;
  if (entryStatus == null || String(entryStatus).trim() === "") {
    missing.push("entry_status");
  }

  const activeRunCount = preflightObtained ? activeRunCountEarly : Number(preflight?.active_run_count ?? 0);
  const activeRun = preflightObtained ? activeRunEarly : null;
  const contentHashMatchesRunStart =
    activeRun && contentHash
      ? String(activeRun.start_content_hash || "") === String(contentHash)
      : activeRun
        ? false
        : null;

  const workerState =
    typeof deps.getWorkerState === "function" ? deps.getWorkerState() : null;
  if (workerState == null) missing.push("worker_state");

  let pageMeasure;
  if (typeof deps.measurePageState === "function") {
    try {
      pageMeasure = await deps.measurePageState({ workerState });
    } catch (error) {
      // Unexpected probe throw — fail closed without leaking raw error to renderer.
      notifyPreviewStageFailure(deps, "page_state", "PAGE_PROBE_FAILED", error);
      return {
        ok: false,
        code: "PAGE_PROBE_FAILED",
        message: "Product Details page probe failed.",
        missing: ["page_state"],
        ...preflightRecoverySlice,
        entryStatus,
        workflowPortalRef: workflowPortalRefEarly,
      };
    }
  } else {
    pageMeasure = { ok: false, code: "PAGE_PROBE_MISSING", pageState: null };
  }
  if (!pageMeasure?.ok || !pageMeasure.pageState) {
    missing.push("page_state");
  }

  let duplicateSearch = null;
  if (typeof deps.searchDuplicates === "function") {
    try {
      const dup = await deps.searchDuplicates({
        page: deps.page,
        searchTerm: EXPECTED_PORTAL_PRODUCT_NAME,
      });
      duplicateSearch = dup?.searchResponse || null;
    } catch (error) {
      notifyPreviewStageFailure(
        deps,
        "duplicate_search",
        "DUPLICATE_SEARCH_FAILED",
        error,
      );
      return {
        ok: false,
        code: "DUPLICATE_SEARCH_FAILED",
        message: "Product Details duplicate search failed.",
        missing: ["duplicate_search"],
        ...preflightRecoverySlice,
        entryStatus,
        workflowPortalRef: workflowPortalRefEarly,
      };
    }
  }
  if (!duplicateSearch) missing.push("duplicate_search");

  let permissionOptions = [];
  if (typeof deps.enumeratePermissionOptions === "function") {
    try {
      const perm = await deps.enumeratePermissionOptions({ page: deps.page });
      if (perm?.ok) permissionOptions = perm.options || [];
      else missing.push("permission_options");
    } catch (error) {
      notifyPreviewStageFailure(
        deps,
        "permission_options",
        "PERMISSION_OPTIONS_FAILED",
        error,
      );
      return {
        ok: false,
        code: "PERMISSION_OPTIONS_FAILED",
        message: "Product Details permission options probe failed.",
        missing: ["permission_options"],
        ...preflightRecoverySlice,
        entryStatus,
        workflowPortalRef: workflowPortalRefEarly,
      };
    }
  } else {
    missing.push("permission_options");
  }

  const approvedPresent = content?.evidence?.approved_product_copy_present === true;
  const approvedFileName =
    content?.evidence?.original_file_name || EXPECTED_APPROVED_COPY_NAME;
  let approvedResolved = false;
  let approvedResolution = null;
  // Metadata alone is never enough. Resolver must be present and succeed.
  if (typeof deps.resolveApprovedCopy !== "function") {
    missing.push("approved_copy_resolver");
  } else if (!approvedPresent) {
    missing.push("approved_copy");
  } else {
    try {
      approvedResolution = await deps.resolveApprovedCopy({
        productId,
        fileName: approvedFileName,
        expectedFileName: EXPECTED_APPROVED_COPY_NAME,
        evidence: content?.evidence || null,
      });
    } catch (error) {
      // Thrown resolver failures only. Structured { ok:false, code } returns stay below.
      notifyPreviewStageFailure(
        deps,
        "approved_copy",
        "APPROVED_COPY_RESOLUTION_FAILED",
        error,
      );
      return {
        ok: false,
        code: "APPROVED_COPY_RESOLUTION_FAILED",
        message: "Approved product copy resolution failed.",
        missing: ["approved_copy"],
        ...preflightRecoverySlice,
        entryStatus,
        workflowPortalRef: workflowPortalRefEarly,
      };
    }
    approvedResolved = approvedResolution?.ok === true;
    if (!approvedResolved) missing.push("approved_copy");
  }

  if (missing.length) {
    return {
      ok: false,
      code: "AUTHORITATIVE_EVIDENCE_MISSING",
      message: `Authoritative evidence incomplete: ${missing.join(", ")}.`,
      missing,
      preflightObtained,
      preflight,
      content,
      contentHash,
      workflowRowVersion,
      reviewStatus,
      classificationVerified,
      isReadyForEntry,
      entryStatus,
      pageState: pageMeasure?.pageState || null,
      duplicateSearch,
      permissionOptions,
      approvedFileName,
      activeRunCount,
      activeRun,
      contentHashMatchesRunStart,
      resumeSourceReady,
      compositionReviewComplete,
      classificationReviewComplete,
      dossierReady,
      openBlockers,
      openPortalIssues,
      workflowPortalRef: workflowPortalRefEarly,
    };
  }

  return {
    ok: true,
    code: "AUTHORITY_COLLECTED",
    productId,
    requireEditPermission,
    preflightObtained: true,
    preflight,
    content,
    contentHash,
    workflowRowVersion,
    payloadHash: content?.payload_hash || preflight?.payload_hash || null,
    reviewStatus: String(reviewStatus),
    classificationVerified: classificationVerified === true,
    isReadyForEntry: isReadyForEntry === true,
    entryStatus: String(entryStatus),
    pageState: pageMeasure.pageState,
    duplicateSearch,
    permissionOptions,
    approvedFileName,
    approvedResolved,
    approvedLocalPath: approvedResolution?.localPath || null,
    // Trusted-only cleanup handle — never forwarded to renderer.
    approvedCopyCleanup:
      typeof approvedResolution?.cleanup === "function" ? approvedResolution.cleanup : null,
    activeRunCount,
    activeRun,
    contentHashMatchesRunStart,
    workflowPortalRef: workflowPortalRefEarly,
    resumeSourceReady: resumeSourceReady === true,
    compositionReviewComplete: compositionReviewComplete === true,
    classificationReviewComplete: classificationReviewComplete === true,
    dossierReady: dossierReady === true,
    openBlockers,
    openPortalIssues,
  };
}

function buildTrustedExecutorInput(authority, { userConfirmed = false, resume = false } = {}) {
  const duplicateOutcome = evaluateDuplicateGuard(authority.duplicateSearch).outcome;
  const resumePlan = planResumeAction({
    entryStatus: authority.entryStatus,
    activeRunCount: authority.activeRunCount,
    activeRun: authority.activeRun,
    workflowPortalRef: authority.workflowPortalRef,
    duplicateOutcome,
    duplicateSearch: authority.duplicateSearch,
  });
  return {
    productId: FIRST_CONTROLLED_PRODUCT_ID,
    content: authority.content,
    contentHash: authority.contentHash,
    finalContentHash: authority.contentHash,
    workflowRowVersion: authority.workflowRowVersion,
    payloadHash: authority.payloadHash || null,
    entryStatus: authority.entryStatus,
    reviewStatus: authority.reviewStatus,
    classificationVerified: authority.classificationVerified === true,
    isReadyForEntry: authority.isReadyForEntry === true,
    resumeSourceReady: authority.resumeSourceReady === true,
    compositionReviewComplete: authority.compositionReviewComplete === true,
    classificationReviewComplete: authority.classificationReviewComplete === true,
    dossierReady: authority.dossierReady === true,
    openBlockers: authority.openBlockers,
    openPortalIssues: authority.openPortalIssues,
    duplicateSearch: authority.duplicateSearch,
    duplicateOutcome,
    pageState: authority.pageState,
    permissionOptions: authority.permissionOptions,
    approvedFileName: authority.approvedFileName,
    activeRun: authority.activeRun || null,
    activeRunCount: authority.activeRunCount ?? 0,
    contentHashMatchesRunStart: authority.contentHashMatchesRunStart,
    workflowPortalRef: authority.workflowPortalRef ?? null,
    resumePlan,
    userConfirmed: userConfirmed === true,
    resume: resume === true,
    authorityMode: true,
    // Explicitly never accept overrides on the trusted path.
    allowTestFieldGovernanceOverrides: false,
  };
}

function applyLiveArmGate(assessment, liveArmed) {
  const result = { ...assessment, liveArmed: liveArmed === true };
  if (result.preview) {
    const extraBlockers =
      liveArmed === true ? [] : ["LIVE_EXECUTION_NOT_ARMED"];
    result.preview = {
      ...result.preview,
      startEnabled: result.preview.startEnabled === true && liveArmed === true,
      resumeEnabled: result.preview.resumeEnabled === true && liveArmed === true,
      blockers:
        liveArmed === true
          ? result.preview.blockers || []
          : [...(result.preview.blockers || []), ...extraBlockers],
    };
  }
  return result;
}

/**
 * Production preview: authoritative collection only.
 */
async function runTrustedProductDetailsPreview(deps = {}) {
  const liveArmed = deps.liveArmed === true;
  // Preview is view-only. Renderer cannot override this.
  const authority = await collectAuthoritativeProductDetailsContext({
    ...deps,
    requireEditPermission: false,
  });
  try {
    if (!authority.ok) {
      return applyLiveArmGate(
        attachAmbiguousSaveRecoverable(
          {
            ok: false,
            code: authority.code,
            message: authority.message,
            missing: authority.missing || [],
            authority,
            preview: {
              productId: FIRST_CONTROLLED_PRODUCT_ID,
              productName: EXPECTED_PORTAL_PRODUCT_NAME,
              startEnabled: false,
              blockers: [authority.code, ...(authority.missing || [])],
              governanceBlockers: [],
              contentHash: authority.contentHash || null,
              workflowRowVersion: authority.workflowRowVersion || null,
            },
          },
          authority,
        ),
        liveArmed,
      );
    }

    const executorInput = buildTrustedExecutorInput(authority, { userConfirmed: false });
    const assessment = assessProductDetailsPreflight(executorInput);
    const resumePlan = executorInput.resumePlan;
    assessment.resumePlan = resumePlan;

    const entryUpper = String(authority.entryStatus).toUpperCase();
    if (
      (entryUpper === "IN_PROGRESS" || entryUpper === "ENTERED") &&
      resumePlan.resumeEnabled === true
    ) {
      const resumeAssessment = assessProductDetailsResumePreflight({
        ...executorInput,
        resume: true,
      });
      assessment.resumePreflight = resumeAssessment;
      if (resumeAssessment.ok === true) {
        assessment.ok = true;
        assessment.code = "RESUME_PREFLIGHT_PASS";
        assessment.message =
          resumeAssessment.message ||
          "Interrupted Product Details run detected. Resume/reconcile the existing run.";
        assessment.preview = {
          ...(resumeAssessment.preview || assessment.preview),
          startEnabled: false,
          resumeEnabled: true,
          resumeMessage:
            resumeAssessment.preview?.resumeMessage ||
            resumePlan.message ||
            "Interrupted Product Details run detected. Resume/reconcile the existing run.",
          blockers: resumeAssessment.preview?.blockers || [],
        };
      } else {
        assessment.ok = false;
        assessment.code = resumeAssessment.code || assessment.code;
        assessment.message = resumeAssessment.message || assessment.message;
        assessment.preview = {
          ...(resumeAssessment.preview || assessment.preview),
          startEnabled: false,
          resumeEnabled: false,
          resumeMessage:
            resumeAssessment.preview?.resumeMessage ||
            resumePlan.message ||
            assessment.message,
          blockers: resumeAssessment.preview?.blockers || assessment.preview?.blockers || [],
        };
      }
    } else if (resumePlan) {
      assessment.preview = {
        ...assessment.preview,
        resumeEnabled: false,
        resumeMessage: resumePlan.message || null,
      };
    }

    assessment.authority = {
      source: "trusted_main_process",
      contentHash: authority.contentHash,
      workflowRowVersion: authority.workflowRowVersion,
      duplicateOutcome: evaluateDuplicateGuard(authority.duplicateSearch).outcome,
      activeRunCount: authority.activeRunCount,
      requireEditPermission: false,
    };
    return applyLiveArmGate(attachAmbiguousSaveRecoverable(assessment, authority), liveArmed);
  } finally {
    // Preview never uploads — release downloaded temp copy after assessment.
    invokeApprovedCopyCleanup(authority);
  }
}

/**
 * Production start: fresh authoritative preflight, then optional execute.
 * Adapters are built only by deps.buildAdapters — never from renderer.
 */
async function runTrustedProductDetailsStart(deps = {}, command = {}) {
  const liveArmed = deps.liveArmed === true;
  const userConfirmed = command.userConfirmed === true;

  // Start always requires edit permission. Renderer cannot override this.
  const startDeps = {
    ...deps,
    requireEditPermission: true,
  };

  if (!liveArmed) {
    // Still collect authority so Start does not trust a prior renderer preview,
    // but never cross the mutation boundary while disarmed.
    const authority = await collectAuthoritativeProductDetailsContext(startDeps);
    try {
      return {
        ok: false,
        code: "LIVE_EXECUTION_NOT_ARMED",
        message:
          "Live Product Details execution is implemented but disarmed. No run_begin / SaveData / mark_* will run until separate live approval arms it.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        resumePlan: planResumeAction({ runStatus: null }),
        authorityCode: authority.code,
        authorityMissing: authority.missing || [],
        requireEditPermission: true,
        preflight: authority.ok
          ? assessProductDetailsPreflight(
              buildTrustedExecutorInput(authority, { userConfirmed: false }),
            )
          : null,
      };
    } finally {
      invokeApprovedCopyCleanup(authority);
    }
  }

  if (!userConfirmed) {
    return {
      ok: false,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "Explicit Start confirmation is required.",
      inventedFailureRpcCalled: false,
      mutated: false,
      runBegun: false,
      requireEditPermission: true,
    };
  }

  const authority = await collectAuthoritativeProductDetailsContext(startDeps);
  try {
    if (!authority.ok) {
      return {
        ok: false,
        code: authority.code,
        message: authority.message,
        missing: authority.missing || [],
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        requireEditPermission: true,
      };
    }

    const input = buildTrustedExecutorInput(authority, { userConfirmed: true });
    if (typeof deps.buildAdapters !== "function") {
      return {
        ok: false,
        code: "ADAPTERS_NOT_BUILT",
        message: "Trusted adapters were not constructed by main process.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
      };
    }
    const adapters = await deps.buildAdapters({ authority, input, mode: "start" });
    if (!adapters || typeof adapters !== "object" || adapters.__fromRenderer === true) {
      return {
        ok: false,
        code: "ADAPTERS_REJECTED",
        message: "Renderer-origin adapters are forbidden.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
      };
    }

    return await executeProductDetails(input, adapters);
  } finally {
    invokeApprovedCopyCleanup(authority);
  }
}

/**
 * Production resume/reconcile: fresh authoritative preflight, then optional execute.
 */
async function runTrustedProductDetailsResume(deps = {}, command = {}) {
  const liveArmed = deps.liveArmed === true;
  const userConfirmed = command.userConfirmed === true;

  const resumeDeps = {
    ...deps,
    requireEditPermission: true,
  };

  if (!liveArmed) {
    const authority = await collectAuthoritativeProductDetailsContext(resumeDeps);
    try {
      return {
        ok: false,
        code: "LIVE_EXECUTION_NOT_ARMED",
        message:
          "Live Product Details resume is implemented but disarmed. No run_resume / SaveData / mark_* will run until separate live approval arms it.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        runResumed: false,
        resumePlan: planResumeAction({
          entryStatus: authority.entryStatus,
          activeRunCount: authority.activeRunCount,
          activeRun: authority.activeRun,
          workflowPortalRef: authority.workflowPortalRef,
          duplicateOutcome: authority.duplicateSearch
            ? evaluateDuplicateGuard(authority.duplicateSearch).outcome
            : null,
        }),
        authorityCode: authority.code,
        authorityMissing: authority.missing || [],
        requireEditPermission: true,
        preflight: authority.ok
          ? assessProductDetailsResumePreflight(
              buildTrustedExecutorInput(authority, { userConfirmed: false, resume: true }),
            )
          : null,
      };
    } finally {
      invokeApprovedCopyCleanup(authority);
    }
  }

  if (!userConfirmed) {
    return {
      ok: false,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "Explicit Resume confirmation is required.",
      inventedFailureRpcCalled: false,
      mutated: false,
      runBegun: false,
      runResumed: false,
      requireEditPermission: true,
    };
  }

  const authority = await collectAuthoritativeProductDetailsContext(resumeDeps);
  try {
    if (!authority.ok) {
      return {
        ok: false,
        code: authority.code,
        message: authority.message,
        missing: authority.missing || [],
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        runResumed: false,
        requireEditPermission: true,
      };
    }

    const input = buildTrustedExecutorInput(authority, { userConfirmed: true, resume: true });
    if (typeof deps.buildAdapters !== "function") {
      return {
        ok: false,
        code: "ADAPTERS_NOT_BUILT",
        message: "Trusted adapters were not constructed by main process.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }
    const adapters = await deps.buildAdapters({ authority, input, mode: "resume" });
    if (!adapters || typeof adapters !== "object" || adapters.__fromRenderer === true) {
      return {
        ok: false,
        code: "ADAPTERS_REJECTED",
        message: "Renderer-origin adapters are forbidden.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }
    if (typeof adapters.runBegin === "function") {
      return {
        ok: false,
        code: "RESUME_HAS_RUN_BEGIN",
        message: "Resume adapters must not include runBegin.",
        inventedFailureRpcCalled: false,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    return await executeProductDetailsResume(input, adapters);
  } finally {
    invokeApprovedCopyCleanup(authority);
  }
}

/** Supabase RPCs may return a single row or a one-row array. */
function firstRpcRow(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  return payload && typeof payload === "object" ? payload : null;
}

/**
 * Portal projection must be VERIFIED with a non-empty selected text before any
 * ambiguous-save reconciliation or rebase is offered. Read-only.
 */
async function assertPortalProjectionVerified(callRpc, productId) {
  if (typeof callRpc !== "function") {
    return {
      ok: false,
      code: "PORTAL_PROJECTION_UNKNOWN",
      message: "Portal projection authority is unavailable.",
    };
  }
  let row;
  try {
    row = firstRpcRow(await callRpc(PORTAL_TEXT_GET_RPC, { p_product_id: productId }));
  } catch (error) {
    return {
      ok: false,
      code: "PORTAL_PROJECTION_UNKNOWN",
      message: error?.message || "Portal projection could not be read.",
    };
  }
  const status = String(
    row?.portal_review_status ?? row?.portalReviewStatus ?? "",
  ).toUpperCase();
  const selected = String(
    row?.selected_portal_text ?? row?.selectedPortalText ?? "",
  ).trim();
  if (status !== "VERIFIED" || !selected) {
    return {
      ok: false,
      code: "PORTAL_PROJECTION_NOT_VERIFIED",
      message:
        "Portal projection is not VERIFIED; reconciliation and rebase remain blocked.",
    };
  }
  return { ok: true, portalReviewStatus: "VERIFIED" };
}

/** Coverage proof for blank-list local exact-name duplicate search. */
function duplicateCoverageComplete(duplicateSearch) {
  const src = duplicateSearch || {};
  if (src.coverageComplete !== true) return false;
  if (src.localExactEvaluation !== true) return false;
  if (src.transportSearchBlank !== true) return false;
  if (String(src.transportSearch ?? "").trim() !== "") return false;
  const source = String(src.source || "").toLowerCase();
  if (!/loadproductdataforlegacy/.test(source)) return false;
  return true;
}

/**
 * Evaluate the fresh duplicate authority for reconcile/rebase.
 * Both paths require DUPLICATE_OUTCOME.NONE with proven coverage.
 */
function assessFreshDuplicateNone(authority) {
  const duplicate = evaluateDuplicateGuard(authority.duplicateSearch);
  const coverageComplete = duplicateCoverageComplete(authority.duplicateSearch);
  if (duplicate.ok !== true || duplicate.outcome !== DUPLICATE_OUTCOME.NONE) {
    return {
      ok: false,
      code: "RECONCILE_DUPLICATE_NOT_NONE",
      message:
        duplicate.message ||
        "Duplicate search did not prove NONE; reconciliation is blocked.",
      duplicateOutcome: duplicate.outcome || null,
      coverageComplete,
    };
  }
  if (!coverageComplete) {
    return {
      ok: false,
      code: "RECONCILE_COVERAGE_UNPROVEN",
      message: "Duplicate search coverage is unproven; reconciliation is blocked.",
      duplicateOutcome: duplicate.outcome,
      coverageComplete: false,
    };
  }
  return {
    ok: true,
    duplicateOutcome: DUPLICATE_OUTCOME.NONE,
    coverageComplete: true,
  };
}

/**
 * Read-only reconciliation after an AMBIGUOUS Save.
 * Never fills, never Saves, never run_begin / run_resume, never mark_*.
 */
async function runTrustedAmbiguousSaveReconcile(deps = {}, command = {}) {
  const sanitized = sanitizeRendererCommand(command);
  const blockedShape = {
    mutated: false,
    runBegun: false,
    runResumed: false,
    filled: false,
    saved: false,
    rebaseEligible: false,
    inventedFailureRpcCalled: false,
  };

  if (sanitized.userConfirmed !== true) {
    return {
      ok: false,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "Explicit reconciliation confirmation is required.",
      ...blockedShape,
    };
  }

  // Reconciliation is read-only: never request edit permission.
  const authority = await collectAuthoritativeProductDetailsContext({
    ...deps,
    requireEditPermission: false,
  });
  try {
    if (!authority.ok) {
      return {
        ok: false,
        code: authority.code,
        message: authority.message,
        missing: authority.missing || [],
        ...blockedShape,
      };
    }

    const portal = await assertPortalProjectionVerified(
      deps.callRpc,
      FIRST_CONTROLLED_PRODUCT_ID,
    );
    if (!portal.ok) {
      return { ok: false, code: portal.code, message: portal.message, ...blockedShape };
    }

    const duplicate = assessFreshDuplicateNone(authority);
    if (!duplicate.ok) {
      return {
        ok: false,
        code: duplicate.code,
        message: duplicate.message,
        duplicateOutcome: duplicate.duplicateOutcome,
        coverageComplete: duplicate.coverageComplete,
        ...blockedShape,
      };
    }

    return {
      ok: true,
      code: "RECONCILE_DUPLICATE_NONE",
      message:
        "Read-only reconciliation proved no portal duplicate. Rebase the existing run authority when ready.",
      duplicateOutcome: DUPLICATE_OUTCOME.NONE,
      coverageComplete: true,
      runId: authority.activeRun?.run_id ?? null,
      workflowRowVersion: authority.workflowRowVersion,
      ...blockedShape,
      rebaseEligible: true,
    };
  } finally {
    invokeApprovedCopyCleanup(authority);
  }
}

/**
 * Rebase an existing ambiguous-save run onto the verified portal projection.
 * Calls exactly one mutating RPC. Never fills, Saves, run_begin or run_resume;
 * Resume stays a separate, manual user action.
 */
async function runTrustedPortalProjectionRebase(deps = {}, command = {}) {
  const sanitized = sanitizeRendererCommand(command);
  const blockedShape = {
    mutated: false,
    runBegun: false,
    runResumed: false,
    filled: false,
    saved: false,
    rebased: false,
    resumeAvailable: false,
    inventedFailureRpcCalled: false,
  };

  if (sanitized.userConfirmed !== true) {
    return {
      ok: false,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "Explicit rebase confirmation is required.",
      ...blockedShape,
    };
  }

  const authority = await collectAuthoritativeProductDetailsContext({
    ...deps,
    requireEditPermission: true,
  });
  let refreshed = null;
  try {
    if (!authority.ok) {
      return {
        ok: false,
        code: authority.code,
        message: authority.message,
        missing: authority.missing || [],
        ...blockedShape,
      };
    }

    const activeRun = authority.activeRun || null;
    const runId = activeRun?.run_id ?? activeRun?.runId ?? null;
    if (Number(authority.activeRunCount) !== 1 || !runId) {
      return {
        ok: false,
        code: "ACTIVE_RUN_INVALID",
        message: "Rebase requires exactly one active run with run_id.",
        ...blockedShape,
      };
    }

    const portal = await assertPortalProjectionVerified(
      deps.callRpc,
      FIRST_CONTROLLED_PRODUCT_ID,
    );
    if (!portal.ok) {
      return {
        ok: false,
        code: portal.code,
        message: portal.message,
        runId,
        ...blockedShape,
      };
    }

    const duplicate = assessFreshDuplicateNone(authority);
    if (!duplicate.ok) {
      return {
        ok: false,
        code: duplicate.code,
        message: duplicate.message,
        duplicateOutcome: duplicate.duplicateOutcome,
        coverageComplete: duplicate.coverageComplete,
        runId,
        ...blockedShape,
      };
    }

    // Only proven read-only duplicate evidence travels to the server.
    // The AMBIGUOUS marker itself is server state — never asserted from here.
    const reconciliationEvidence = {
      source: "LoadProductDataforLegacy",
      duplicate_outcome: "NONE",
      coverage_complete: true,
    };

    let rebaseResult;
    try {
      rebaseResult = await deps.callRpc(REBASE_PORTAL_PROJECTION_RPC, {
        p_run_id: runId,
        p_expected_workflow_row_version: Number(authority.workflowRowVersion),
        p_reconciliation_evidence: reconciliationEvidence,
      });
    } catch (error) {
      return {
        ok: false,
        code: "REBASE_PORTAL_PROJECTION_FAILED",
        message: error?.message || "Portal projection rebase failed.",
        runId,
        requiresReadOnlyReconciliation: true,
        ...blockedShape,
      };
    }

    const returnedRow = firstRpcRow(rebaseResult);
    const returnedRunId = returnedRow?.run_id ?? returnedRow?.runId ?? null;
    if (!returnedRunId || String(returnedRunId) !== String(runId)) {
      return {
        ok: false,
        code: "REBASE_RUN_ID_MISMATCH",
        message: "Rebase did not return the same active run_id; refusing to continue.",
        runId,
        requiresReadOnlyReconciliation: true,
        ...blockedShape,
      };
    }

    const returnedContentHash =
      returnedRow?.content_hash != null
        ? String(returnedRow.content_hash)
        : returnedRow?.contentHash != null
          ? String(returnedRow.contentHash)
          : null;

    // Rebase already mutated server state. Fresh authority must prove the
    // post-rebase run identity/hash before Resume is advertised. Never fall
    // back to pre-rebase hash, never retry rebase, never auto-Resume.
    const refreshBlocked = {
      ...blockedShape,
      mutated: true,
      rebased: false,
      resumeAvailable: false,
      requiresReadOnlyReconciliation: true,
      runId,
      message:
        "Portal projection rebase completed on the server, but fresh authority could not be proven. Reload authority before Resume. Do not retry rebase automatically.",
    };

    try {
      refreshed = await collectAuthoritativeProductDetailsContext({
        ...deps,
        requireEditPermission: false,
      });
    } catch (error) {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        message:
          error?.message ||
          refreshBlocked.message,
      };
    }

    if (!refreshed || refreshed.ok !== true) {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        refreshCode: refreshed?.code || null,
        missing: refreshed?.missing || [],
      };
    }

    if (Number(refreshed.activeRunCount) !== 1) {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        refreshCode: "ACTIVE_RUN_INVALID",
        message:
          "Portal projection rebase completed, but refreshed authority does not show exactly one active run.",
      };
    }

    const refreshedRunId =
      refreshed.activeRun?.run_id ?? refreshed.activeRun?.runId ?? null;
    if (!refreshedRunId || String(refreshedRunId) !== String(runId)) {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        refreshCode: "REBASE_RUN_ID_MISMATCH",
        message:
          "Portal projection rebase completed, but refreshed active run_id does not match the pre-rebase run.",
      };
    }

    if (String(refreshed.entryStatus || "").toUpperCase() !== "IN_PROGRESS") {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        refreshCode: "ENTRY_STATUS_INVALID",
        message:
          "Portal projection rebase completed, but refreshed workflow is not IN_PROGRESS.",
      };
    }

    const refreshedHash =
      refreshed.contentHash != null && String(refreshed.contentHash).trim() !== ""
        ? String(refreshed.contentHash)
        : null;
    if (!refreshedHash) {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        refreshCode: "CONTENT_HASH_MISSING",
        message:
          "Portal projection rebase completed, but refreshed content hash is missing.",
      };
    }

    if (
      returnedContentHash &&
      String(returnedContentHash).trim() !== "" &&
      String(returnedContentHash) !== refreshedHash
    ) {
      return {
        ok: false,
        code: "REBASE_AUTHORITY_REFRESH_FAILED",
        ...refreshBlocked,
        refreshCode: "CONTENT_HASH_MISMATCH",
        message:
          "Portal projection rebase completed, but refreshed content hash does not match the rebase RPC result.",
      };
    }

    return {
      ok: true,
      code: "PORTAL_PROJECTION_REBASED",
      message:
        "Run authority rebased onto the verified portal projection. Resume Product Details manually when you are ready.",
      runId,
      contentHash: refreshedHash,
      workflowRowVersion: refreshed.workflowRowVersion ?? null,
      duplicateOutcome: DUPLICATE_OUTCOME.NONE,
      coverageComplete: true,
      mutated: true,
      runBegun: false,
      runResumed: false,
      filled: false,
      saved: false,
      rebased: true,
      resumeAvailable: true,
      inventedFailureRpcCalled: false,
    };
  } finally {
    invokeApprovedCopyCleanup(authority);
    if (refreshed) invokeApprovedCopyCleanup(refreshed);
  }
}

module.exports = {
  RENDERER_FORBIDDEN_OPTION_KEYS,
  DUPLICATE_OUTCOME,
  sanitizeRendererCommand,
  collectAuthoritativeProductDetailsContext,
  buildTrustedExecutorInput,
  deriveAmbiguousSaveRecoverable,
  attachAmbiguousSaveRecoverable,
  runTrustedProductDetailsPreview,
  runTrustedProductDetailsStart,
  runTrustedProductDetailsResume,
  runTrustedAmbiguousSaveReconcile,
  runTrustedPortalProjectionRebase,
  PORTAL_TEXT_GET_RPC,
  REBASE_PORTAL_PROJECTION_RPC,
  measureConnectedPageState,
  enumerateLivePermissionOptions,
  runLiveDuplicateSearch,
  createInPageProductDetailsProbe,
  createInPagePermissionOptionsProbe,
  createInPageDuplicateSearchProbe,
  applyLiveArmGate,
  computeResumeSourceReady,
  MAX_LIST_ROWS,
};
