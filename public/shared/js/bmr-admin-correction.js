/**
 * BMR Administrative Correction — shared service helpers.
 * All mutations go through rpc_admin_correct_bmr_plan_mapping.
 * No direct writes to bmr_details / batch_plan_batches / corrections tables.
 * Never calls the retired authenticated plan-batch unlink RPC.
 *
 * BMR number is an immutable batch identity. In-place number correction
 * is retired from the interactive client workflow.
 */

export const ADMIN_CORRECTION_ROLE = "role:manager-bmr-admin-correction";

/** Locked interactive client allowlist — not derived from preview keys. */
export const CLIENT_SUPPORTED_OPERATIONS = Object.freeze([
  "REMAP_BMR",
  "UNLINK_BMR",
  "CORRECT_BMR_SIZE",
]);

export const OPERATION_TYPES = Object.freeze({
  REMAP_BMR: "REMAP_BMR",
  UNLINK_BMR: "UNLINK_BMR",
  CORRECT_BMR_SIZE: "CORRECT_BMR_SIZE",
});

/** Labels for live operations shown in the modal. */
export const OPERATION_LABELS = Object.freeze({
  REMAP_BMR: "Remap BMR",
  UNLINK_BMR: "Remove Mapping",
  CORRECT_BMR_SIZE: "Correct BMR Size",
});

/** Defensive history-only label for the retired number-correction operation. */
export const RETIRED_OPERATION_LABEL = "BMR Number Correction — Retired";

export const SIZE_EPS = 1e-6;
export const MIN_REASON_LENGTH = 10;
export const BMR_CANDIDATE_WINDOW_MARGIN_DAYS = 7;

export const COPY = Object.freeze({
  unlinkNotice:
    "The BMR will be removed from this planned batch.\nThe planned batch and its planned size will remain unchanged.",
  sizeMismatchWarning:
    "The corrected BMR size will not match the planned batch size.\n\nThe BMR will therefore be automatically unlinked from this planned batch.\nThe planned batch size will remain unchanged.",
  sizeMatchNotice:
    "The corrected BMR size matches the planned batch size.\nThe mapping will be retained.",
  sizeAutoUnlinkSuccess:
    "The BMR size was corrected. The BMR was automatically unlinked from this planned batch. The approved planned size was preserved.",
  sizeSnapshotSyncNotice:
    "Correcting BMR size updates the BMR size snapshot used by linked work-log and laboratory displays where those surfaces read the current BMR size. The planned batch size remains unchanged.",
  plannedSizeUnchanged: "Planned batch size was unchanged.",
  bmrNumberImmutable:
    "A BMR number is an immutable batch identity.\n\nTo use a different batch number, create a new BMR with the required number and batch size, then remap the planned batch when the BMRs are operationally eligible.",
  createAndRemapGuidance:
    "Need a different BMR number?\n\nCreate the required BMR first. If neither the current nor target BMR has operational evidence and the product and planned size match, use Remap BMR.",
  remapBlockedEvidence:
    "This BMR already has operational records and cannot be reassigned through the ordinary administrative remap workflow.",
});

async function getSupabase() {
  const { supabase } = await import("./supabaseClient.js");
  return supabase;
}

/**
 * Create a stable client request id for one correction session.
 * Reuse across retries; do not regenerate per submit attempt.
 */
export function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bac-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

/** @returns {{ clientRequestId: string }} */
export function createCorrectionSession() {
  return { clientRequestId: createClientRequestId() };
}

export function isClientSupportedOperation(operationType) {
  return CLIENT_SUPPORTED_OPERATIONS.includes(operationType);
}

export function sizesMatch(a, b, eps = SIZE_EPS) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= eps;
}

/**
 * UI prediction for size correction outcome. Server result is authoritative.
 * @returns {"retain"|"auto_unlink"|"unknown"}
 */
export function previewSizeOutcome(proposedSize, plannedBatchSize) {
  const proposed = Number(proposedSize);
  const planned = Number(plannedBatchSize);
  if (!Number.isFinite(proposed) || !Number.isFinite(planned)) return "unknown";
  return sizesMatch(proposed, planned) ? "retain" : "auto_unlink";
}

export function parseJsonPayload(data) {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data === "object") return data;
  return null;
}

export function canOfferAdminCorrection({
  canAdminCorrect,
  isMapped,
  mappedBatchPlanBatchId,
}) {
  return (
    !!canAdminCorrect &&
    !!isMapped &&
    mappedBatchPlanBatchId != null &&
    mappedBatchPlanBatchId !== "" &&
    Number.isFinite(Number(mappedBatchPlanBatchId))
  );
}

/**
 * @param {string} reason
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateReason(reason) {
  const trimmed = String(reason ?? "").trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      message: `Reason is required (at least ${MIN_REASON_LENGTH} characters).`,
    };
  }
  return { ok: true };
}

/**
 * Client-side UX validation only. Server remains final.
 * Always sends p_new_bn: null — number correction is retired.
 * @returns {{ ok: boolean, message?: string, payload?: object }}
 */
export function validateCorrectionForm({
  operationType,
  reason,
  supportingReference,
  impactAcknowledged,
  targetBmrId,
  newBatchSize,
  currentBatchSize,
  clientRequestId,
  batchPlanBatchId,
}) {
  if (!batchPlanBatchId || !Number.isFinite(Number(batchPlanBatchId))) {
    return { ok: false, message: "Plan batch is required." };
  }
  if (!clientRequestId) {
    return { ok: false, message: "Missing client request id for this session." };
  }
  if (operationType === "CORRECT_BMR_NUMBER") {
    return {
      ok: false,
      message:
        "BMR number correction is retired. Create a new BMR and use Remap BMR when eligible.",
    };
  }
  if (!isClientSupportedOperation(operationType)) {
    return { ok: false, message: "Select a correction operation." };
  }

  const reasonCheck = validateReason(reason);
  if (!reasonCheck.ok) return reasonCheck;

  if (!impactAcknowledged) {
    return {
      ok: false,
      message: "Impact acknowledgement is required before submitting.",
    };
  }

  const payload = {
    p_operation_type: operationType,
    p_batch_plan_batch_id: Number(batchPlanBatchId),
    p_reason: String(reason).trim(),
    p_supporting_reference: String(supportingReference ?? "").trim() || null,
    p_impact_acknowledged: true,
    p_client_request_id: String(clientRequestId),
    p_target_bmr_id: null,
    p_new_bn: null,
    p_new_batch_size: null,
  };

  if (operationType === OPERATION_TYPES.REMAP_BMR) {
    const tid = Number(targetBmrId);
    if (!Number.isFinite(tid) || tid <= 0) {
      return { ok: false, message: "Select an eligible target BMR to remap." };
    }
    payload.p_target_bmr_id = tid;
  }

  if (operationType === OPERATION_TYPES.CORRECT_BMR_SIZE) {
    const size = Number(newBatchSize);
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, message: "Enter a valid corrected BMR size." };
    }
    if (sizesMatch(size, currentBatchSize)) {
      return { ok: false, message: "BMR size is unchanged — nothing to correct." };
    }
    payload.p_new_batch_size = size;
  }

  return { ok: true, payload };
}

/**
 * Map server failures to clear user-facing messages.
 * Technical detail is returned separately for console diagnostics.
 */
export function mapAdminCorrectionError(err) {
  const raw =
    (err && (err.message || err.error_description || err.details || err.hint)) ||
    "";
  const code = (err && (err.code || err.hint || "")) || "";
  const blob = `${code} ${raw}`.toLowerCase();
  const diagnostic = raw || code || String(err ?? "unknown error");

  let userMessage = "Administrative correction failed.";

  if (
    /permission|not authorized|forbidden|42501|insufficient/.test(blob) ||
    code === "42501"
  ) {
    userMessage =
      "Insufficient permission for administrative correction. The exceptional admin-correction role is required.";
  } else if (
    /correct_bmr_number|bmr number.*(immutable|retired)|number correction.*(retired|not supported|immutable)/.test(
      blob,
    )
  ) {
    userMessage =
      "BMR number is an immutable batch identity. Create a new BMR and remap when eligible.";
  } else if (/not found|plan batch not found|does not exist/.test(blob)) {
    userMessage = "Plan batch not found.";
  } else if (
    /submitted|applied|plan status|invalid status|eligible_plan|header_status/.test(
      blob,
    )
  ) {
    userMessage =
      "Plan status is not eligible. Administrative correction requires submitted or applied plans.";
  } else if (
    /work.?log|lab(oratory)?|operational evidence|correction_blocked|evidence/.test(
      blob,
    )
  ) {
    userMessage =
      "Operational evidence exists (work-log or laboratory analysis). Administrative correction is blocked.";
  } else if (/product mismatch|same product|product_id/.test(blob)) {
    userMessage = "Target BMR product does not match the planned batch product.";
  } else if (
    /size mismatch|exact.*size|planned.?size|batch_size/.test(blob) &&
    /target|remap|candidate|eligible/.test(blob)
  ) {
    userMessage =
      "Target BMR size must equal the planned batch size for remapping.";
  } else if (/already mapped|mapped elsewhere|in use/.test(blob)) {
    userMessage = "Target BMR is already mapped elsewhere.";
  } else if (/unchanged.*size|size.*unchanged|same size|identical size/.test(blob)) {
    userMessage = "BMR size is unchanged — nothing to correct.";
  } else if (/reason|min(imum)?.*(10|ten)|too short/.test(blob)) {
    userMessage = `Reason is required (at least ${MIN_REASON_LENGTH} characters).`;
  } else if (/acknowledg|impact_acknowledged|p_impact/.test(blob)) {
    userMessage = "Impact acknowledgement is required.";
  } else if (code === "23505" || /unique|duplicate|already exists/.test(blob)) {
    userMessage =
      "Uniqueness conflict for the corrected BMR size. Choose a different value.";
  } else if (
    /stale|concurrency|concurrent|conflict|mapping changed|reload/.test(blob)
  ) {
    userMessage =
      "Mapping changed concurrently. Reload the preview and try again.";
  } else if (
    /network|fetch|failed to fetch|timeout|abort|ECONN|offline/.test(blob)
  ) {
    userMessage =
      "Network error. You can retry — the same request id will be reused.";
  } else if (/idempotent|already completed|replay/.test(blob)) {
    userMessage =
      "This correction was already completed (idempotent replay). Refresh to see the current state.";
  } else if (raw && raw.length <= 220) {
    userMessage = raw;
  } else if (raw) {
    userMessage = "Administrative correction failed (see console for details).";
  }

  return { userMessage, diagnostic };
}

export async function previewAdminCorrection(batchPlanBatchId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("rpc_preview_bmr_admin_correction", {
    p_batch_plan_batch_id: Number(batchPlanBatchId),
  });
  if (error) throw error;
  const parsed = parseJsonPayload(data);
  if (!parsed) throw new Error("Preview returned an empty or invalid payload.");
  return parsed;
}

export async function executeAdminCorrection(params) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc(
    "rpc_admin_correct_bmr_plan_mapping",
    {
      p_operation_type: params.p_operation_type,
      p_batch_plan_batch_id: Number(params.p_batch_plan_batch_id),
      p_target_bmr_id:
        params.p_target_bmr_id == null ? null : Number(params.p_target_bmr_id),
      // Compatibility field retained by server; client never corrects BN in-place.
      p_new_bn: null,
      p_new_batch_size:
        params.p_new_batch_size == null
          ? null
          : Number(params.p_new_batch_size),
      p_reason: params.p_reason,
      p_supporting_reference: params.p_supporting_reference ?? null,
      p_impact_acknowledged: !!params.p_impact_acknowledged,
      p_client_request_id: String(params.p_client_request_id),
    },
  );
  if (error) throw error;
  const parsed = parseJsonPayload(data);
  if (!parsed) throw new Error("Correction returned an empty or invalid payload.");
  return parsed;
}

/**
 * Scoped history only — never use as a global list-badge feed.
 */
export async function getAdminCorrectionHistory({
  bmrId = null,
  batchPlanBatchId = null,
  limit = 50,
} = {}) {
  const supabase = await getSupabase();
  const args = { p_limit: limit };
  if (bmrId != null && Number.isFinite(Number(bmrId))) {
    args.p_bmr_id = Number(bmrId);
  }
  if (
    batchPlanBatchId != null &&
    Number.isFinite(Number(batchPlanBatchId))
  ) {
    args.p_batch_plan_batch_id = Number(batchPlanBatchId);
  }
  const { data, error } = await supabase.rpc(
    "rpc_get_bmr_admin_correction_history",
    args,
  );
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function shiftIsoDate(dateStr, dayDelta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

/**
 * Potentially eligible remap candidates from bmr_card_not_initiated.
 * Usability filter only — server validation is final.
 */
export async function loadRemapCandidates({
  productId,
  plannedBatchSize,
  excludeBmrId = null,
  monthFrom = null,
  monthTo = null,
  monthStart = null,
  marginDays = BMR_CANDIDATE_WINDOW_MARGIN_DAYS,
} = {}) {
  const supabase = await getSupabase();
  const pid = Number(productId);
  const planned = Number(plannedBatchSize);
  if (!Number.isFinite(pid) || !Number.isFinite(planned)) return [];

  let query = supabase
    .from("bmr_card_not_initiated")
    .select("bmr_id,bn,batch_size,uom,created_at,product_id")
    .eq("product_id", pid)
    .order("bn");

  let from = monthFrom;
  let to = monthTo;
  if (!from && !to && monthStart) {
    const start = String(monthStart).slice(0, 10);
    from = shiftIsoDate(start, -marginDays);
    const endMonth = new Date(`${start}T00:00:00`);
    endMonth.setMonth(endMonth.getMonth() + 1);
    endMonth.setDate(endMonth.getDate() - 1);
    to = shiftIsoDate(endMonth.toISOString().slice(0, 10), marginDays);
  }

  if (from) {
    try {
      const fromDt = new Date(`${from}T00:00:00`);
      fromDt.setDate(fromDt.getDate() - (monthFrom ? marginDays : 0));
      const fromStr = fromDt.toISOString().slice(0, 19).replace("T", " ");
      query = query.gte("created_at", fromStr);
    } catch {
      query = query.gte("created_at", `${from} 00:00:00`);
    }
  }
  if (to) {
    try {
      const toDt = new Date(`${to}T23:59:59`);
      toDt.setDate(toDt.getDate() + (monthTo ? marginDays : 0));
      const toStr = toDt.toISOString().slice(0, 19).replace("T", " ");
      query = query.lte("created_at", toStr);
    } catch {
      query = query.lte("created_at", `${to} 23:59:59`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const exclude = excludeBmrId == null ? null : Number(excludeBmrId);
  return (data || [])
    .filter((r) => sizesMatch(r.batch_size, planned))
    .filter((r) => (exclude == null ? true : Number(r.bmr_id) !== exclude))
    .map((r) => ({
      bmr_id: r.bmr_id,
      bn: r.bn,
      batch_size: r.batch_size,
      uom: r.uom,
      created_at: r.created_at,
      product_id: r.product_id,
      label: `${r.bn} · ${r.batch_size} ${r.uom || ""} (potentially eligible)`.trim(),
    }));
}

export function labelForOperationType(operationType) {
  if (operationType === "CORRECT_BMR_NUMBER") return RETIRED_OPERATION_LABEL;
  return OPERATION_LABELS[operationType] || operationType || "—";
}

export function isRetiredOperationType(operationType) {
  return operationType === "CORRECT_BMR_NUMBER";
}

/**
 * Active Change History operation filter chips.
 * CORRECT_BMR_NUMBER is intentionally excluded (retired; no selectable filter).
 * Defensive table/detail rendering still uses labelForOperationType.
 */
export const HISTORY_OPERATION_FILTER_OPTIONS = Object.freeze([
  { value: "REMAP_BMR", label: "Remap BMR" },
  { value: "UNLINK_BMR", label: "Remove Mapping" },
  { value: "CORRECT_BMR_SIZE", label: "Correct BMR Size" },
]);

export const HISTORY_RESULT_LABELS = Object.freeze({
  REMAPPED: "Remapped",
  UNLINKED: "Unlinked",
  BMR_SIZE_CORRECTED_MAPPING_RETAINED: "Corrected and mapping retained",
  BMR_SIZE_CORRECTED_AUTO_UNLINKED_SIZE_MISMATCH:
    "Corrected and automatically unlinked",
  BMR_NUMBER_CORRECTED_MAPPING_RETAINED: "BMR Number Correction — Retired",
});

/** Active result filter chips (retired number-correction result excluded). */
export const HISTORY_RESULT_FILTER_OPTIONS = Object.freeze([
  { value: "REMAPPED", label: "Remapped" },
  { value: "UNLINKED", label: "Mapping removed" },
  {
    value: "BMR_SIZE_CORRECTED_MAPPING_RETAINED",
    label: "Size corrected — mapping retained",
  },
  {
    value: "BMR_SIZE_CORRECTED_AUTO_UNLINKED_SIZE_MISMATCH",
    label: "Size corrected — automatically unlinked",
  },
]);

export const HISTORY_PAGE_SIZES = Object.freeze([25, 50, 100]);
/** Fixed internal page size for Change History infinite scroll (matches Manage/Explore density). */
export const HISTORY_INFINITE_PAGE_SIZE = 50;
export const HISTORY_SEARCH_DEBOUNCE_MS = 400;

export function labelForOperationResult(operationResult) {
  if (operationResult == null || operationResult === "") return "—";
  const key = String(operationResult);
  if (HISTORY_RESULT_LABELS[key]) return HISTORY_RESULT_LABELS[key];
  return humanizeToken(key);
}

function humanizeToken(value) {
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Table executed-by display.
 * executed_by_name → shortened UUID → Unknown user
 */
export function formatExecutedByName(row) {
  const name = row?.executed_by_name;
  if (name != null && String(name).trim()) return String(name).trim();
  const id = row?.executed_by;
  if (id != null && String(id).trim()) {
    const s = String(id).trim();
    return s.length > 8 ? `${s.slice(0, 8)}…` : s;
  }
  return "Unknown user";
}

export function formatExecutedByFull(row) {
  const name = row?.executed_by_name;
  const id = row?.executed_by;
  if (name != null && String(name).trim()) {
    return {
      display: String(name).trim(),
      uuid: id != null ? String(id) : null,
    };
  }
  if (id != null && String(id).trim()) {
    return { display: "Unknown user", uuid: String(id) };
  }
  return { display: "Unknown user", uuid: null };
}

function asObject(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value : null;
}

/** Defensive read of validation_snapshot operational evidence fields. */
export function parseValidationEvidence(row) {
  const snap = asObject(row?.validation_snapshot) || {};
  return {
    work_log_count: snap.work_log_count ?? null,
    lab_analysis_count: snap.lab_analysis_count ?? null,
    control_sample_count: snap.control_sample_count ?? null,
    operationally_used:
      snap.operationally_used == null ? null : !!snap.operationally_used,
    snapshot_sync_required:
      snap.snapshot_sync_required == null
        ? null
        : !!snap.snapshot_sync_required,
  };
}

/** Defensive read of validation_snapshot.snapshot_sync. */
export function parseSnapshotSync(row) {
  const snap = asObject(row?.validation_snapshot) || {};
  const sync = asObject(snap.snapshot_sync) || {};
  return {
    work_logs_updated: sync.work_logs_updated ?? null,
    lab_analyses_updated: sync.lab_analyses_updated ?? null,
    control_samples_updated: sync.control_samples_updated ?? null,
    process_output_quantities_changed:
      sync.process_output_quantities_changed == null
        ? null
        : !!sync.process_output_quantities_changed,
  };
}

function nullIfEmpty(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function normalizePage(page) {
  const n = Number(page);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function normalizePageSize(pageSize) {
  const n = Number(pageSize);
  if (HISTORY_PAGE_SIZES.includes(n)) return n;
  return 25;
}

/**
 * Search the full administrative-correction register.
 * Always sends p_executed_by: null from this UI.
 * Does not client-sort rows — server order is authoritative.
 */
export async function searchAdminCorrectionHistory(args = {}) {
  const supabase = await getSupabase();
  const page = normalizePage(args.p_page ?? args.page);
  const pageSize = normalizePageSize(args.p_page_size ?? args.pageSize);
  const productRaw = args.p_product_id ?? args.productId;
  const productId =
    productRaw == null || productRaw === ""
      ? null
      : Number.isFinite(Number(productRaw))
        ? Number(productRaw)
        : null;

  const payload = {
    p_search: nullIfEmpty(args.p_search ?? args.search),
    p_date_from: nullIfEmpty(args.p_date_from ?? args.dateFrom),
    p_date_to: nullIfEmpty(args.p_date_to ?? args.dateTo),
    p_operation_type: nullIfEmpty(args.p_operation_type ?? args.operationType),
    p_operation_result: nullIfEmpty(
      args.p_operation_result ?? args.operationResult,
    ),
    p_product_id: productId,
    p_executed_by: null,
    p_page: page,
    p_page_size: pageSize,
  };

  const { data, error } = await supabase.rpc(
    "rpc_search_bmr_admin_correction_history",
    payload,
  );
  if (error) throw error;
  const parsed = parseJsonPayload(data) || {};
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const totalCount = Number(parsed.total_count);
  const totalPages = Number(parsed.total_pages);
  let pageOut = Number(parsed.page);
  if (!Number.isFinite(pageOut) || pageOut < 1) pageOut = page;
  const sizeOut = Number(parsed.page_size);
  const safeTotalPages =
    Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0;
  if (safeTotalPages > 0 && pageOut > safeTotalPages) pageOut = safeTotalPages;

  return {
    rows,
    total_count: Number.isFinite(totalCount) ? totalCount : 0,
    page: pageOut,
    page_size: Number.isFinite(sizeOut) ? sizeOut : pageSize,
    total_pages: safeTotalPages,
    sort: parsed.sort || { executed_at: "desc", id: "desc" },
    filters: parsed.filters || {},
    request_args: payload,
  };
}

export function describeOperationResult(result) {
  const opResult = result?.operation_result || "";
  if (opResult === "BMR_SIZE_CORRECTED_AUTO_UNLINKED_SIZE_MISMATCH") {
    return COPY.sizeAutoUnlinkSuccess;
  }
  if (opResult === "UNLINKED") return "Mapping removed. Planned batch size unchanged.";
  if (opResult === "REMAPPED") return "Mapped to the selected target BMR.";
  if (opResult === "BMR_NUMBER_CORRECTED_MAPPING_RETAINED") {
    return RETIRED_OPERATION_LABEL;
  }
  if (opResult === "BMR_SIZE_CORRECTED_MAPPING_RETAINED") {
    return "BMR size corrected. Mapping retained.";
  }
  return opResult || "Completed.";
}

export function formatHistoryOldNew(row) {
  const oldParts = [];
  const newParts = [];
  if (row.old_bn != null || row.new_bn != null) {
    oldParts.push(`BN ${row.old_bn ?? "—"}`);
    newParts.push(`BN ${row.new_bn ?? "—"}`);
  }
  if (row.old_bmr_batch_size != null || row.new_bmr_batch_size != null) {
    oldParts.push(`Size ${row.old_bmr_batch_size ?? "—"}`);
    newParts.push(`Size ${row.new_bmr_batch_size ?? "—"}`);
  }
  if (row.old_bmr_id != null || row.new_bmr_id != null) {
    oldParts.push(`BMR# ${row.old_bmr_id ?? "—"}`);
    newParts.push(`BMR# ${row.new_bmr_id ?? "—"}`);
  }
  return {
    oldValue: oldParts.join(" · ") || "—",
    newValue: newParts.join(" · ") || "—",
  };
}
