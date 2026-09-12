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
  executeProductDetails,
  planResumeAction,
} = require("./product-details-executor");
const { evaluateDuplicateGuard, DUPLICATE_OUTCOME } = require("./portal-duplicate-guard");

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
  "adapters",
  "origin",
  "path",
  "actiontype",
  "hiddenId",
  "staleEditState",
  "saveDataAvailable",
  "approvedFileName",
  "content_hash",
]);

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
 * Read-only duplicate search probe. Prefer LoadProductDataforLegacy when present.
 * Never mutates portal state.
 */
function createInPageDuplicateSearchProbe() {
  return async (searchTerm) => {
    const term = String(searchTerm || "").trim();
    if (!term) {
      return {
        source: "LoadProductDataforLegacy",
        searchApplied: false,
        searchTerm: term,
        totalCount: null,
        rows: null,
      };
    }
    if (typeof window.LoadProductDataforLegacy !== "function") {
      return {
        source: "LoadProductDataforLegacy",
        searchApplied: false,
        searchTerm: term,
        totalCount: null,
        rows: null,
        reason: "LoadProductDataforLegacy_unavailable",
      };
    }
    let raw;
    try {
      raw = await Promise.resolve(window.LoadProductDataforLegacy(term));
    } catch (error) {
      return {
        source: "LoadProductDataforLegacy",
        searchApplied: false,
        searchTerm: term,
        totalCount: null,
        rows: null,
        reason: "LoadProductDataforLegacy_threw",
        error: String(error && error.message ? error.message : error),
      };
    }
    const payload = raw && typeof raw === "object" ? raw : {};
    const rows = Array.isArray(payload.aaData)
      ? payload.aaData
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.rows)
          ? payload.rows
          : null;
    const totalCount =
      payload.TotalCount != null
        ? Number(payload.TotalCount)
        : payload.iTotalRecords != null
          ? Number(payload.iTotalRecords)
          : payload.totalCount != null
            ? Number(payload.totalCount)
            : null;
    const normalizedRows = Array.isArray(rows)
      ? rows.map((row) => {
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
      source: "LoadProductDataforLegacy",
      searchApplied: true,
      searchTerm: term,
      totalCount,
      rows: normalizedRows,
      coverageComplete:
        Number.isFinite(totalCount) &&
        Array.isArray(normalizedRows) &&
        totalCount === normalizedRows.length,
    };
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

async function runLiveDuplicateSearch(page, searchTerm) {
  if (!page || typeof page.evaluate !== "function") {
    return {
      ok: false,
      searchResponse: {
        source: "LoadProductDataforLegacy",
        searchApplied: false,
        searchTerm,
        totalCount: null,
        rows: null,
        reason: "page_unavailable",
      },
    };
  }
  const searchResponse = await page.evaluate(
    createInPageDuplicateSearchProbe(),
    searchTerm || EXPECTED_PORTAL_PRODUCT_NAME,
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

  try {
    await deps.callRpc("rpc_eaushadhi_require_permission", { p_edit: false });
  } catch (error) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: error?.message || "Permission check failed.",
      missing: ["permission"],
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
  if (!preflight || typeof preflight !== "object") {
    missing.push("preflight");
  }

  const workflowRowVersion =
    preflight?.workflow_row_version != null
      ? Number(preflight.workflow_row_version)
      : null;
  if (!Number.isInteger(workflowRowVersion)) missing.push("workflow_row_version");

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

  const entryStatus =
    content?.entry_status != null
      ? String(content.entry_status)
      : preflight?.entry_status != null
        ? String(preflight.entry_status)
        : null;
  if (entryStatus == null || String(entryStatus).trim() === "") {
    missing.push("entry_status");
  }

  const workerState =
    typeof deps.getWorkerState === "function" ? deps.getWorkerState() : null;
  if (workerState == null) missing.push("worker_state");

  let pageMeasure;
  if (typeof deps.measurePageState === "function") {
    pageMeasure = await deps.measurePageState({ workerState });
  } else {
    pageMeasure = { ok: false, code: "PAGE_PROBE_MISSING", pageState: null };
  }
  if (!pageMeasure?.ok || !pageMeasure.pageState) {
    missing.push("page_state");
  }

  let duplicateSearch = null;
  if (typeof deps.searchDuplicates === "function") {
    const dup = await deps.searchDuplicates({
      page: deps.page,
      searchTerm: EXPECTED_PORTAL_PRODUCT_NAME,
    });
    duplicateSearch = dup?.searchResponse || null;
  }
  if (!duplicateSearch) missing.push("duplicate_search");

  let permissionOptions = [];
  if (typeof deps.enumeratePermissionOptions === "function") {
    const perm = await deps.enumeratePermissionOptions({ page: deps.page });
    if (perm?.ok) permissionOptions = perm.options || [];
    else missing.push("permission_options");
  } else {
    missing.push("permission_options");
  }

  const approvedPresent = content?.evidence?.approved_product_copy_present === true;
  const approvedFileName =
    content?.evidence?.original_file_name || EXPECTED_APPROVED_COPY_NAME;
  let approvedResolved = approvedPresent === true;
  if (typeof deps.resolveApprovedCopy === "function") {
    const resolved = await deps.resolveApprovedCopy({
      productId,
      fileName: approvedFileName,
      evidence: content?.evidence || null,
    });
    approvedResolved = resolved?.ok === true;
    if (!approvedResolved) missing.push("approved_copy");
  } else if (!approvedPresent) {
    missing.push("approved_copy");
  }

  if (missing.length) {
    return {
      ok: false,
      code: "AUTHORITATIVE_EVIDENCE_MISSING",
      message: `Authoritative evidence incomplete: ${missing.join(", ")}.`,
      missing,
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
    };
  }

  return {
    ok: true,
    code: "AUTHORITY_COLLECTED",
    productId,
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
  };
}

function buildTrustedExecutorInput(authority, { userConfirmed = false } = {}) {
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
    duplicateSearch: authority.duplicateSearch,
    pageState: authority.pageState,
    permissionOptions: authority.permissionOptions,
    approvedFileName: authority.approvedFileName,
    userConfirmed: userConfirmed === true,
    authorityMode: true,
    // Explicitly never accept overrides on the trusted path.
    allowTestFieldGovernanceOverrides: false,
  };
}

function applyLiveArmGate(assessment, liveArmed) {
  const result = { ...assessment, liveArmed: liveArmed === true };
  if (result.preview) {
    result.preview = {
      ...result.preview,
      startEnabled: result.preview.startEnabled === true && liveArmed === true,
      blockers:
        liveArmed === true
          ? result.preview.blockers || []
          : [...(result.preview.blockers || []), "LIVE_EXECUTION_NOT_ARMED"],
    };
  }
  return result;
}

/**
 * Production preview: authoritative collection only.
 */
async function runTrustedProductDetailsPreview(deps = {}) {
  const liveArmed = deps.liveArmed === true;
  const authority = await collectAuthoritativeProductDetailsContext(deps);
  if (!authority.ok) {
    return applyLiveArmGate(
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
      liveArmed,
    );
  }

  const assessment = assessProductDetailsPreflight(
    buildTrustedExecutorInput(authority, { userConfirmed: false }),
  );
  assessment.authority = {
    source: "trusted_main_process",
    contentHash: authority.contentHash,
    workflowRowVersion: authority.workflowRowVersion,
    duplicateOutcome: evaluateDuplicateGuard(authority.duplicateSearch).outcome,
  };
  return applyLiveArmGate(assessment, liveArmed);
}

/**
 * Production start: fresh authoritative preflight, then optional execute.
 * Adapters are built only by deps.buildAdapters — never from renderer.
 */
async function runTrustedProductDetailsStart(deps = {}, command = {}) {
  const liveArmed = deps.liveArmed === true;
  const userConfirmed = command.userConfirmed === true;

  if (!liveArmed) {
    // Still collect authority so Start does not trust a prior renderer preview,
    // but never cross the mutation boundary while disarmed.
    const authority = await collectAuthoritativeProductDetailsContext(deps);
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
      preflight: authority.ok
        ? assessProductDetailsPreflight(
            buildTrustedExecutorInput(authority, { userConfirmed: false }),
          )
        : null,
    };
  }

  if (!userConfirmed) {
    return {
      ok: false,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "Explicit Start confirmation is required.",
      inventedFailureRpcCalled: false,
      mutated: false,
      runBegun: false,
    };
  }

  const authority = await collectAuthoritativeProductDetailsContext(deps);
  if (!authority.ok) {
    return {
      ok: false,
      code: authority.code,
      message: authority.message,
      missing: authority.missing || [],
      inventedFailureRpcCalled: false,
      mutated: false,
      runBegun: false,
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
  const adapters = await deps.buildAdapters({ authority, input });
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

  return executeProductDetails(input, adapters);
}

module.exports = {
  RENDERER_FORBIDDEN_OPTION_KEYS,
  DUPLICATE_OUTCOME,
  sanitizeRendererCommand,
  collectAuthoritativeProductDetailsContext,
  buildTrustedExecutorInput,
  runTrustedProductDetailsPreview,
  runTrustedProductDetailsStart,
  measureConnectedPageState,
  enumerateLivePermissionOptions,
  runLiveDuplicateSearch,
  createInPageProductDetailsProbe,
  createInPagePermissionOptionsProbe,
  createInPageDuplicateSearchProbe,
  applyLiveArmGate,
};
