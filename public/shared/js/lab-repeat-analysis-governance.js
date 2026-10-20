export const REPEAT_STATUS = Object.freeze({
  PENDING: "Approval Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONSUMED: "Authorization Consumed",
  EXPIRED: "Authorization Expired",
});

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
    const expiry = value.expires_at || value.valid_until || value.approval_expires_at;
    if (expiry && new Date(expiry).getTime() < Date.now()) return REPEAT_STATUS.EXPIRED;
    value = value.status || value.request_status;
  }
  return REPEAT_STATUS[normalizeRepeatStatus(value)];
}

export function isUsableApproval(request) {
  if (!request || normalizeRepeatStatus(request.status || request.request_status) !== "APPROVED") {
    return false;
  }
  if (request.consumed_at || request.is_consumed === true) return false;
  const expiry = request.expires_at || request.valid_until || request.approval_expires_at;
  return !expiry || new Date(expiry).getTime() >= Date.now();
}

export function meaningfulRepeatReason(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length >= 12 && /[a-z0-9]/i.test(text);
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
