/* eslint-env node */

const { QC_FILL_KEYS } = require("./qc-register-portal-contract");

function sameFillFields(left, right) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== QC_FILL_KEYS.length || rightKeys.length !== QC_FILL_KEYS.length) return false;
  return QC_FILL_KEYS.every((key) => Object.prototype.hasOwnProperty.call(left, key)
    && Object.prototype.hasOwnProperty.call(right, key)
    && String(left[key] ?? "") === String(right[key] ?? ""));
}

function rowsOf(payload) {
  const raw = payload?.data;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => raw[key]);
  }
  return null;
}

function assessQcListResponse(payload) {
  const status = payload?.status == null ? "" : String(payload.status);
  const rows = rowsOf(payload);
  if (status !== "1" || !Array.isArray(rows)) {
    return {
      settled: true,
      success: false,
      coverageComplete: false,
      rows: [],
      reason: "LIST_NOT_SUCCESS",
    };
  }
  const totalRaw = payload.total ?? payload.recordsTotal ?? payload.totalCount ?? null;
  const total = totalRaw == null || totalRaw === "" ? null : Number(totalRaw);
  const emptyPage = rows.length === 0;
  const totalMatches = Number.isFinite(total) && total === rows.length;
  const coverageComplete = emptyPage || totalMatches;
  return {
    settled: true,
    success: true,
    coverageComplete,
    rows,
    reason: coverageComplete ? "LIST_COVERED" : "LIST_COVERAGE_UNPROVEN",
  };
}

function normalizeQcListRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const values = {};
  for (const key of QC_FILL_KEYS) {
    if (row[key] == null) return null;
    values[key] = String(row[key]);
  }
  const portalRowId = row.id ?? row.hid ?? row.qc_id ?? row.portal_row_id ?? null;
  return {
    values,
    portalRowId: portalRowId == null ? "" : String(portalRowId).trim(),
  };
}

function assessQcListDuplicate(list, fillFields) {
  if (!list || list.success !== true || list.coverageComplete !== true) {
    return { ok: false, code: "BEFORE_LIST_INCOMPLETE" };
  }
  if (!Array.isArray(list.rows) || list.rows.length === 0) {
    return { ok: true, code: "NO_ROWS", matches: [] };
  }
  const matches = [];
  let unproven = false;
  for (const row of list.rows) {
    const normalized = normalizeQcListRow(row);
    if (!normalized) {
      unproven = true;
      continue;
    }
    if (sameFillFields(normalized.values, fillFields)) matches.push(normalized);
  }
  if (matches.length > 0) return { ok: false, code: "DUPLICATE_ROW", matches };
  if (unproven) return { ok: false, code: "DUPLICATE_UNPROVEN" };
  return { ok: true, code: "NO_MATCH", matches: [] };
}

function listEvidence(list) {
  return {
    settled: list?.settled === true,
    success: list?.success === true,
    coverageComplete: list?.coverageComplete === true,
    rows: Array.isArray(list?.rows) ? list.rows : [],
  };
}

module.exports = {
  assessQcListResponse,
  assessQcListDuplicate,
  listEvidence,
  normalizeQcListRow,
  rowsOf,
  sameFillFields,
};
