// Map server refusal messages to plain business language.
// If the first line starts with CODE:, map by that code before any free-text pattern.
// MONTHEND_* refusals have no error codes — match by message start after coded/text maps.
// Permission / owner / reason / reference text matches still come before MONTHEND_*.

export const ALREADY_DONE_RELOAD = "ALREADY_DONE_RELOAD";
export const REOPEN_PREVIEW = "REOPEN_PREVIEW";

function firstLine(message) {
  return String(message || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function extractCode(message) {
  const line = firstLine(message);
  const match = line.match(/^([A-Z][A-Z0-9_]*)\s*:/);
  return match ? match[1] : "";
}

function detailAfterCode(message) {
  const line = firstLine(message);
  const idx = line.indexOf(":");
  if (idx < 0) return line;
  return line.slice(idx + 1).trim();
}

function monthendPrefix(message) {
  const line = firstLine(message);
  if (line.startsWith("MONTHEND_PERIOD_NOT_FINISHED")) return "MONTHEND_PERIOD_NOT_FINISHED";
  if (line.startsWith("MONTHEND_VALUATION_DATE_MISMATCH")) return "MONTHEND_VALUATION_DATE_MISMATCH";
  if (line.startsWith("MONTHEND_PERIOD_NOT_OPEN")) return "MONTHEND_PERIOD_NOT_OPEN";
  if (line.startsWith("MONTHEND_RUN_NOT_FOUND")) return "MONTHEND_RUN_NOT_FOUND";
  return "";
}

function mapCodedMessage(code, message) {
  switch (code) {
    case "W2_RUN_DATE_BEFORE_APPROVED":
      return { kind: code, title: "The date is before the approved run's date. Choose a later date.", detail: firstLine(message), action: null };
    case "CI041_FUTURE_DATE":
      return { kind: code, title: "The date cannot be in the future.", detail: firstLine(message), action: null };
    case "CI041_DATE_OUTSIDE_PERIOD":
      return { kind: code, title: "The date must fall within the month.", detail: firstLine(message), action: null };
    case "CI041_BAD_PERIOD":
      return { kind: code, title: "The month is not valid. Reload and choose the month again.", detail: firstLine(message), action: null };
    case "CI041_DATE_REQUIRED":
      return { kind: code, title: "A month and date are required.", detail: firstLine(message), action: null };
    case "W2_PREVIEW_REQUIRED":
      return {
        kind: code,
        title: "Open the impact preview first.",
        detail: firstLine(message),
        action: REOPEN_PREVIEW,
      };
    case "W2_PREVIEW_ACK_EXPIRED":
      return {
        kind: code,
        title: "The preview has expired (valid 15 minutes). Open it again.",
        detail: firstLine(message),
        action: REOPEN_PREVIEW,
      };
    case "W2_PREVIEW_OUTDATED":
      return {
        kind: code,
        title: "Something changed since the preview was opened. Open it again and review.",
        detail: firstLine(message),
        action: REOPEN_PREVIEW,
      };
    case "W2_PREVIEW_ACK_ALREADY_USED":
      return {
        kind: code,
        title: "This approval is already recorded. Reloading the latest status.",
        detail: firstLine(message),
        action: ALREADY_DONE_RELOAD,
      };
    case "W2_PREVIEW_ACK_NOT_FOR_RUN":
    case "W2_PREVIEW_ACK_OTHER_USER":
      return {
        kind: code,
        title: "This preview cannot be used for this approval. Open a new preview.",
        detail: firstLine(message),
        action: REOPEN_PREVIEW,
      };
    case "W2_STALE_DRAFT_ACK_REQUIRED":
      return {
        kind: code,
        title: "Later entries exist. Tick 'approve anyway' or wait for the next draft.",
        detail: firstLine(message),
        action: null,
      };
    case "W2_APPROVAL_CHECKS_FAILED": {
      const detail = detailAfterCode(message) || firstLine(message);
      return {
        kind: code,
        title: "This draft cannot be approved:",
        detail,
        action: null,
      };
    }
    case "W2_ACTIVE_RUN":
      return {
        kind: code,
        title: "A costing run is still in progress for this month. Try again when it finishes.",
        detail: firstLine(message),
        action: null,
      };
    case "W2_USE_NEW_APPROVAL_ROUTE":
      return {
        kind: code,
        title: "Wrong approval route — contact the costing owner.",
        detail: firstLine(message),
        action: null,
      };
    case "W2_OWNER_ONLY":
      return {
        kind: "owner",
        title: "Only the costing governance owner can approve.",
        detail: firstLine(message),
        action: null,
      };
    case "W2_AUTH_REQUIRED":
      return {
        kind: "auth",
        title: "Please sign in again.",
        detail: firstLine(message),
        action: null,
      };
    case "W2_REASON_REQUIRED":
      return {
        kind: "reason",
        title: "Please enter a reason (at least 10 characters).",
        detail: firstLine(message),
        action: null,
      };
    case "W2_APPROVAL_REFERENCE_REQUIRED":
      return {
        kind: "reference",
        title: "Please enter the approval reference.",
        detail: firstLine(message),
        action: null,
      };
    default:
      return null;
  }
}

function mapTextPatterns(message) {
  const lower = String(message || "").toLowerCase();
  const line = firstLine(message);

  if (/permission denied for module:costing-control-center/i.test(message)) {
    return {
      kind: "permission",
      title: "You don't have edit permission for the Costing Control Centre.",
      detail: line,
      action: null,
    };
  }

  if (/only the costing governance owner/i.test(message) || /owner.?only/i.test(lower)) {
    return {
      kind: "owner",
      title: "Only the costing governance owner can approve.",
      detail: line,
      action: null,
    };
  }

  if (/not authenticated|sign in again|jwt|auth required/i.test(lower)) {
    return {
      kind: "auth",
      title: "Please sign in again.",
      detail: line,
      action: null,
    };
  }

  if (/reason.*(required|at least)/i.test(lower)) {
    return {
      kind: "reason",
      title: "Please enter a reason (at least 10 characters).",
      detail: line,
      action: null,
    };
  }

  if (/approval.?reference.*required/i.test(lower)) {
    return {
      kind: "reference",
      title: "Please enter the approval reference.",
      detail: line,
      action: null,
    };
  }

  if (
    line.includes("only for an OPEN period") ||
    /^Costing period \S+ does not exist/.test(line)
  ) {
    return {
      kind: "period",
      title: "This month is locked or closed; no recalculation is possible.",
      detail: line,
      action: null,
    };
  }

  return null;
}

function mapMonthend(prefix, message) {
  const serverText = firstLine(message);
  const titles = {
    MONTHEND_PERIOD_NOT_FINISHED: "The month has not ended yet.",
    MONTHEND_VALUATION_DATE_MISMATCH: "This run is not dated at the month end.",
    MONTHEND_PERIOD_NOT_OPEN: "This month is not open for month-end finalisation.",
    MONTHEND_RUN_NOT_FOUND: "Run not found.",
  };
  return {
    kind: prefix,
    title: titles[prefix],
    detail: serverText,
    action: null,
  };
}

export function mapCostingApprovalError(rawMessage) {
  const message = String(rawMessage?.message || rawMessage || "");
  const code = extractCode(message);
  if (code) {
    const coded = mapCodedMessage(code, message);
    if (coded) return coded;
  }

  const textMapped = mapTextPatterns(message);
  if (textMapped) return textMapped;

  const monthend = monthendPrefix(message);
  if (monthend) return mapMonthend(monthend, message);

  return {
    kind: "unknown",
    title: "The server refused:",
    detail: firstLine(message) || "Unknown refusal.",
    action: null,
  };
}

const LOCK_ERROR_TITLES = Object.freeze({
  W2_AUTH_REQUIRED: "Please sign in again.",
  W2_OWNER_ONLY: "Only the costing owner can lock a month.",
  W2_REASON_REQUIRED: "Please give a reason (at least 10 characters).",
  W2_APPROVAL_REFERENCE_REQUIRED: "Please give an approval reference.",
  W2_PERIOD_NOT_FOUND: "This month does not exist in costing.",
  W2_LOCK_REQUIRES_APPROVED_RUN:
    "This month has no approved run, so it cannot be locked.",
  W2_ACTIVE_RUN:
    "A run is queued or running for this month. Try again after it finishes.",
  W2_PERIOD_NOT_FINISHED:
    "This month has not ended yet, so it cannot be locked.",
  MONTHEND_PERIOD_NOT_FINISHED:
    "This month has not ended yet, so it cannot be locked.",
  W2_BATCH_NULL_ARRAY: "Choose at least one month.",
  W2_BATCH_EMPTY: "Choose at least one month.",
  W2_BATCH_NULL_ELEMENT: "Choose at least one month.",
  W2_BATCH_UNKNOWN_MONTH: "One or more months do not exist in costing.",
});

const LOCK_ERROR_TITLES_WITH_DETAIL = Object.freeze({
  W2_LOCK_REQUIRES_OPEN:
    "This month is not open (it is already locked or closed).",
  W2_FINGERPRINT_DRIFT:
    "The approved run's data no longer matches its fingerprint. Do not lock; tell the costing assistant.",
  W2_BATCH_DUPLICATE_MONTH: "A month is listed twice.",
  W2_BATCH_NOT_FIRST_OF_MONTH:
    "Months must be given as the first day of the month.",
  W2_BATCH_MIXED_QUARTER: "Lock one calendar quarter at a time.",
});

export function mapCostingLockError(rawMessage) {
  const message = String(rawMessage?.message || rawMessage || "");
  const line = firstLine(message);

  // This server text contains a colon inside the module name, so it must be
  // recognized before extracting a CODE prefix.
  if (
    line.startsWith(
      "Permission denied for module:costing-control-center (edit=true)",
    )
  ) {
    return {
      kind: "permission",
      title: "You do not have costing permission.",
      detail: line,
      action: null,
    };
  }

  if (line === "Not authenticated") {
    return {
      kind: "auth",
      title: "Please sign in again.",
      detail: line,
      action: null,
    };
  }

  // A few lock refusals are emitted without a colon. In that case the whole
  // first line is the code; otherwise the text before the first colon is it.
  const colon = line.indexOf(":");
  const code = colon < 0 ? line : line.slice(0, colon).trim();
  const title = LOCK_ERROR_TITLES[code];
  if (title) {
    return { kind: code, title, detail: line, action: null };
  }
  const detailedTitle = LOCK_ERROR_TITLES_WITH_DETAIL[code];
  if (detailedTitle) {
    return { kind: code, title: detailedTitle, detail: line, action: null };
  }

  return {
    kind: "unknown",
    title: "The server refused:",
    detail: line || "Unknown refusal.",
    action: null,
  };
}

export function formatMappedErrorForDisplay(mapped) {
  if (!mapped) return "";
  if (!mapped.detail || mapped.detail === mapped.title) return mapped.title;
  return `${mapped.title}\n${mapped.detail}`;
}
