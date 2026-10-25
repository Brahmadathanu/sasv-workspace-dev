export const REPEAT_STATUS = Object.freeze({
  PENDING: "Approval Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONSUMED: "Authorization Consumed",
  EXPIRED: "Authorization Expired",
  REQUIRED: "Repeat Approval Required",
});
export const REPEAT_REQUEST_STATUS = "REQUESTED";
export const REPEAT_REASON_MIN_LENGTH = 15;

export function unwrapRpcJson(value) {
  const row = Array.isArray(value) ? value[0] : value;
  if (row == null) return null;
  if (typeof row === "string") {
    try {
      return JSON.parse(row);
    } catch {
      return row;
    }
  }
  if (typeof row !== "object") return row;
  return row;
}

export function normalizeRepeatStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status.includes("CONSUM")) return "CONSUMED";
  if (status.includes("EXPIR")) return "EXPIRED";
  if (status.includes("REJECT")) return "REJECTED";
  if (status.includes("APPROV")) return "APPROVED";
  return "PENDING";
}

export function repeatStatusLabel(value) {
  if (value && typeof value === "object") {
    if (value.consumed_at || value.is_consumed === true) return REPEAT_STATUS.CONSUMED;
    const status = normalizeRepeatStatus(value.status || value.request_status);
    if (status === "APPROVED") {
      const expiryTime = new Date(value.expires_at).getTime();
      if (!value.expires_at || !Number.isFinite(expiryTime)) return REPEAT_STATUS.REQUIRED;
      return expiryTime > Date.now() ? REPEAT_STATUS.APPROVED : REPEAT_STATUS.EXPIRED;
    }
    return REPEAT_STATUS[status];
  }
  const status = normalizeRepeatStatus(value);
  return status === "APPROVED" ? REPEAT_STATUS.REQUIRED : REPEAT_STATUS[status];
}

export function isUsableApproval(request) {
  if (!request || normalizeRepeatStatus(request.status || request.request_status) !== "APPROVED") {
    return false;
  }
  if (request.consumed_at || request.is_consumed === true) return false;
  if (!request.expires_at) return false;
  const expiryTime = new Date(request.expires_at).getTime();
  return Number.isFinite(expiryTime) && expiryTime > Date.now();
}

export function meaningfulRepeatReason(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length >= REPEAT_REASON_MIN_LENGTH && /[a-z0-9]/i.test(text);
}

export function priorAnalysisRegisterNumber(row) {
  return row?.prior_analysis_register_no || "—";
}

export function contextDecision(raw) {
  const context = unwrapRpcJson(raw) || {};
  const prior = context.prior_completed_analysis || null;
  const active = context.active_analysis || null;
  const request = context.latest_visible_request || null;
  if (active) return { kind: "ACTIVE_BLOCK", context, prior, active, request };
  if (!prior) return { kind: "FIRST_ANALYSIS", context, prior, active, request };
  if (isUsableApproval(request)) {
    return { kind: "APPROVED_REPEAT", context, prior, active, request };
  }
  return { kind: "AUTHORIZATION_REQUIRED", context, prior, active, request };
}

export function pickRegisterNumber(record) {
  return record?.analysis_register_no || record?.register_no || record?.analysis_ref || "—";
}
