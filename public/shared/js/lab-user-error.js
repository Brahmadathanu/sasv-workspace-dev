/**
 * Bounded laboratory client helpers.
 * Server RPCs remain authoritative. These checks are UX and presentation only.
 */

export const LAB_RANGE_ORDER_MESSAGE =
  "Minimum value cannot be greater than maximum value.";

export const LAB_INVALID_SPEC_MESSAGE =
  "The applicable laboratory specification contains an invalid value or range. Please check the specification before continuing.";

export const LAB_INVALID_EFFECTIVE_SPEC_READINESS_MESSAGE =
  "The applicable laboratory specification contains an invalid value or range. Please check the specification before starting analysis.";

export const LAB_ACTIVE_ANALYSIS_MESSAGE =
  "An active analysis already exists for this batch. Complete or cancel the existing analysis before starting another.";

export const LAB_PERMISSION_MESSAGE =
  "You do not have permission to perform this action.";

export const LAB_SESSION_MESSAGE = "Session expired. Please log in again.";

export const LAB_SPEC_RESOLUTION_MESSAGE =
  "No current active specification could be resolved. Please check the current active specification setup before starting analysis.";

export const LAB_NETWORK_MESSAGE =
  "The server could not be reached. Please check your connection and try again.";

export const LAB_UNKNOWN_MESSAGE =
  "The operation could not be completed. Please try again or contact support.";

export const LAB_RANGE_NUMBER_MESSAGE =
  "Minimum and maximum values must be valid numbers.";

const TECHNICAL_TEXT_RE =
  /sqlstate|postgres|postgrest|\bpgrst\b|violates\b|new row for relation|check constraint|\bchk_|relation\s+["']|constraint\s+["']|syntax error|operator does not exist|null value in column|stack trace|\n\s*at\s+|schema cache|duplicate key value/i;

function asText(value) {
  if (value == null) return "";
  return String(value);
}

function collectErrorParts(error) {
  if (error == null) return { message: "", blob: "", code: "" };
  if (typeof error === "string") {
    return { message: error, blob: error, code: "" };
  }

  const nested = error.error && typeof error.error === "object" ? error.error : null;
  const message = asText(error.message || nested?.message || error.details || "");
  const code = asText(error.code || nested?.code || "");
  const parts = [
    message,
    error.details,
    error.hint,
    code,
    error.error_description,
    nested?.details,
    nested?.hint,
    nested?.code,
  ]
    .filter((part) => part != null && part !== "")
    .map((part) => String(part));

  return { message, blob: parts.join("\n"), code };
}

export function looksLikeTechnicalLabError(text) {
  return TECHNICAL_TEXT_RE.test(asText(text));
}

function isActiveAnalysisFailure(blob, code) {
  if (/active analysis already exists/i.test(blob)) return true;
  return code === "23505" && /analysis/i.test(blob);
}

function isInvalidSpecificationFailure(blob) {
  if (
    /INVALID_RANGE_ORDER|INVALID_EFFECTIVE_SPEC|SPEC_VALUE_RULE_VIOLATION|chk_lab_spec_line_value_rules|chk_lab_spec_override_value_rules/i.test(
      blob,
    )
  ) {
    return true;
  }
  return /new row for relation/i.test(blob) && /spec_/i.test(blob);
}

function isPermissionFailure(blob, code) {
  if (code === "42501") return true;
  return /permission denied|insufficient privilege|row-level security/i.test(blob);
}

function isSessionFailure(blob, code) {
  if (code === "PGRST301") return true;
  return /jwt|not authenticated|invalid claim|session expired|auth session missing|invalid token|refresh token/i.test(
    blob,
  );
}

function isNetworkFailure(blob) {
  return /failed to fetch|networkerror|network request failed|econnrefused|enotfound|etimedout|timeout|load failed|bad gateway|service unavailable|gateway timeout|\b502\b|\b503\b|\b504\b/i.test(
    blob,
  );
}

export function normalizeLabUserError(error, options = {}) {
  const { message, blob, code } = collectErrorParts(error);
  const hay = blob || message;
  const context = options.context || "";

  if (hay.includes(LAB_RANGE_ORDER_MESSAGE)) return LAB_RANGE_ORDER_MESSAGE;
  if (isActiveAnalysisFailure(hay, code)) return LAB_ACTIVE_ANALYSIS_MESSAGE;
  if (isInvalidSpecificationFailure(hay)) return LAB_INVALID_SPEC_MESSAGE;
  if (isPermissionFailure(hay, code)) return LAB_PERMISSION_MESSAGE;
  if (isSessionFailure(hay, code)) return LAB_SESSION_MESSAGE;
  if (isNetworkFailure(hay)) return LAB_NETWORK_MESSAGE;
  if (code === "SPEC_RESOLUTION_FAILED" || /SPEC_RESOLUTION_FAILED/i.test(hay)) {
    return LAB_SPEC_RESOLUTION_MESSAGE;
  }

  const safeMessage = message.trim();
  if (safeMessage && !looksLikeTechnicalLabError(safeMessage)) return safeMessage;
  if (context === "spec-resolution") return LAB_SPEC_RESOLUTION_MESSAGE;
  return LAB_UNKNOWN_MESSAGE;
}

function coerceFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateFiniteRange(minRaw, maxRaw) {
  const min = coerceFiniteNumber(minRaw);
  const max = coerceFiniteNumber(maxRaw);

  if (min == null || max == null) {
    return { ok: false, error: LAB_RANGE_NUMBER_MESSAGE };
  }
  if (min > max) {
    return { ok: false, error: LAB_RANGE_ORDER_MESSAGE };
  }
  return { ok: true, min, max, error: "" };
}

export function rangePayloadError(specType, minRaw, maxRaw) {
  if (asText(specType).trim().toUpperCase() !== "RANGE") return "";
  return validateFiniteRange(minRaw, maxRaw).error || "";
}

function parseSnapshot(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

function readOwn(source, keys) {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return undefined;
}

export function validateProposedRangeForApproval(request) {
  const snapshot = parseSnapshot(request?.proposed_reference_snapshot);
  const typeRaw =
    readOwn(snapshot, ["spec_type", "override_spec_type"]) ??
    request?.proposed_spec_type ??
    request?.requested_spec_type ??
    "";
  if (asText(typeRaw).trim().toUpperCase() !== "RANGE") {
    return { ok: true, error: "" };
  }

  let minRaw = readOwn(snapshot, ["min_value", "override_min_value", "min"]);
  let maxRaw = readOwn(snapshot, ["max_value", "override_max_value", "max"]);
  if (minRaw === undefined) minRaw = request?.proposed_min_value;
  if (maxRaw === undefined) maxRaw = request?.proposed_max_value;

  const result = validateFiniteRange(minRaw, maxRaw);
  return result.ok
    ? { ok: true, error: "" }
    : { ok: false, error: result.error };
}

export function reviewRangeApprovalBlock(action, request) {
  if (asText(action).trim().toLowerCase() !== "approve") {
    return { blocked: false, error: "" };
  }
  const result = validateProposedRangeForApproval(request);
  return { blocked: !result.ok, error: result.error || "" };
}

export function buildValidateCurrentActiveSpecArgs(
  subjectType,
  productId,
  stockItemId,
) {
  const normalizedSubject = asText(subjectType).trim().toUpperCase();
  const isFg = normalizedSubject === "FG";
  const isInventorySubject =
    normalizedSubject === "RM" || normalizedSubject === "PM";
  const hasProduct = productId != null && productId !== "";
  const hasStockItem = stockItemId != null && stockItemId !== "";

  return {
    p_subject_type: normalizedSubject,
    p_product_id: isFg && hasProduct ? Number(productId) : null,
    p_stock_item_id: isInventorySubject && hasStockItem ? Number(stockItemId) : null,
  };
}

function asLineArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeEffectiveSpecValidation(data) {
  const payload = data && typeof data === "object" ? data : {};
  return {
    ok: payload.ok === true,
    code: asText(payload.code),
    message: asText(payload.message),
    invalid_count: payload.invalid_count ?? 0,
    invalid_lines: asLineArray(payload.invalid_lines),
  };
}

export function readinessFailureCopy(validation) {
  const normalized = normalizeEffectiveSpecValidation(validation);
  const code = normalized.code.trim().toUpperCase();

  if (normalized.ok === true) {
    return { ready: true, label: "", sub: "" };
  }

  if (code === "INVALID_EFFECTIVE_SPEC") {
    const line = normalized.invalid_lines[0];
    const testName = asText(line?.test_name).trim();
    const lineMessage = asText(line?.message).trim();
    if (testName && lineMessage && !looksLikeTechnicalLabError(lineMessage)) {
      return {
        ready: false,
        label: `Specification validation failed: ${testName} — ${lineMessage}`,
        sub: "Please check the specification before starting analysis.",
      };
    }
    return {
      ready: false,
      label: LAB_INVALID_EFFECTIVE_SPEC_READINESS_MESSAGE,
      sub: "",
    };
  }

  return {
    ready: false,
    label: normalizeLabUserError(
      { message: normalized.message, code: normalized.code },
      { context: "spec-resolution" },
    ),
    sub: "Please check the protocol and base specification before starting analysis.",
  };
}
