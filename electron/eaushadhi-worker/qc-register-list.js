/* eslint-env node */

const { QC_FILL_KEYS } = require("./qc-register-portal-contract");

const QC_LIST_FIELD_ALIASES = Object.freeze({
  typeOfStudy: ["typeOfStudy", "typeofstudy", "type_of_study", "protocol"],
  startDate: ["startDate", "startdate", "start_date"],
  endDate: ["endDate", "enddate", "end_date"],
  reportDate: ["reportDate", "reportdate", "report_date"],
  batchNo: ["batchNo", "batchno", "batch_no", "batches"],
  duration: ["duration", "shelf_life", "shelflife", "shelf_life_months"],
  labName: ["labName", "labname", "lab_name", "laboratory"],
  qualityCntrl: ["qualityCntrl", "qualitycntrl", "quality_cntrl", "qc", "quality"],
});

function isoFromParts(year, month, day) {
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function canonicalQcFillValue(key, value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (key === "startDate" || key === "endDate" || key === "reportDate") {
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3])) || text;
    const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (dmy) return isoFromParts(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) || text;
    return text;
  }
  if (key === "batchNo") return text.split(",").map((part) => part.trim()).filter(Boolean).join(",");
  if (key === "duration" && /^\d+$/.test(text)) return String(Number(text));
  return text;
}

function sameFillFields(left, right) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== QC_FILL_KEYS.length || rightKeys.length !== QC_FILL_KEYS.length) return false;
  return QC_FILL_KEYS.every((key) => Object.prototype.hasOwnProperty.call(left, key)
    && Object.prototype.hasOwnProperty.call(right, key)
    && canonicalQcFillValue(key, left[key]) === canonicalQcFillValue(key, right[key]));
}

function readListField(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && row[name] != null) return row[name];
  }
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const name of Object.keys(row)) {
    if (wanted.has(String(name).toLowerCase()) && row[name] != null) return row[name];
  }
  return undefined;
}

function portalRowIdFromListRow(row) {
  const direct = [row?.id, row?.hid, row?.qc_id, row?.portal_row_id];
  for (const value of direct) {
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  const action = row?.action == null ? "" : String(row.action);
  const call = action.match(/(?:edit_qc|delete_qc)\(\s*['"]?(\d+)['"]?\s*\)/i);
  if (call) return call[1];
  const hid = action.match(/\bid\s*=\s*['"]hid(\d+)['"]/i);
  if (hid) return hid[1];
  return "";
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

function authoritativeTotal(payload) {
  const keys = ["TotalCount", "total", "recordsTotal", "totalCount", "iTotalRecords"];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(payload || {}, key)) continue;
    if (payload[key] == null || payload[key] === "") continue;
    const total = Number(payload[key]);
    if (Number.isInteger(total) && total >= 0) return { total, source: key };
  }
  return { total: null, source: null };
}

function assessQcListResponse(payload, pagination = {}) {
  const status = payload?.status == null ? "" : String(payload.status);
  const rows = rowsOf(payload);
  const requestedPage = pagination?.pageno == null || pagination.pageno === "" ? null : Number(pagination.pageno);
  const pageKnown = requestedPage === 0;
  if (status !== "1" || !Array.isArray(rows)) {
    return {
      settled: true,
      success: false,
      coverageComplete: false,
      rows: [],
      totalCount: null,
      requestedPage: pageKnown ? 0 : null,
      reason: "LIST_NOT_SUCCESS",
    };
  }
  const found = authoritativeTotal(payload);
  const total = found.total;
  const filteredRaw = payload?.recordsFiltered;
  const filtered = filteredRaw == null || filteredRaw === "" ? null : Number(filteredRaw);
  const filteredAgrees = filtered == null || (Number.isInteger(filtered) && filtered === total);
  const shortPage = total != null && rows.length < total;
  const coverageComplete = pageKnown && total != null && filteredAgrees && rows.length === total;
  let reason = "LIST_COVERED";
  let message = "";
  if (!coverageComplete) {
    if (!pageKnown) reason = "LIST_PAGE_UNPROVEN";
    else if (total == null) reason = "LIST_TOTAL_UNPROVEN";
    else if (shortPage) {
      reason = "LIST_INCOMPLETE";
      message = "List incomplete";
    } else reason = "LIST_COVERAGE_UNPROVEN";
  }
  return {
    settled: true,
    success: true,
    coverageComplete,
    rows,
    totalCount: total,
    totalSource: found.source,
    requestedPage: pageKnown ? 0 : null,
    reason,
    message,
    rowPresenceDecided: coverageComplete === true,
  };
}

function normalizeQcListRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const values = {};
  for (const key of QC_FILL_KEYS) {
    const raw = readListField(row, QC_LIST_FIELD_ALIASES[key]);
    if (raw == null) return null;
    values[key] = canonicalQcFillValue(key, raw);
  }
  return {
    values,
    portalRowId: portalRowIdFromListRow(row),
  };
}

function assessQcListDuplicate(list, fillFields) {
  if (list?.reason === "LIST_INCOMPLETE") {
    return { ok: false, code: "LIST_INCOMPLETE", message: "List incomplete" };
  }
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
    totalCount: Number.isInteger(list?.totalCount) ? list.totalCount : null,
    requestedPage: list?.requestedPage === 0 ? 0 : null,
    reason: list?.reason || null,
  };
}

function parseQcRawDate(value) {
  const text = value == null ? "" : String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false };
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return { ok: false };
  }
  return { ok: true, value: text };
}

function mapGetqcDataResponse(payload) {
  const source = payload && typeof payload === "object" ? payload : null;
  if (!source) return { ok: false, runStatus: "ROW_MISMATCH", reason: "date format unknown" };
  const dates = [
    ["startdate", "startDate"],
    ["enddate", "endDate"],
    ["reportdate", "reportDate"],
  ];
  const values = {
    typeOfStudy: source.typeofstudy == null ? "" : String(source.typeofstudy),
    batchNo: source.batchno == null ? "" : String(source.batchno),
    duration: source.duration == null ? "" : String(source.duration),
    labName: source.labname == null ? "" : String(source.labname),
    qualityCntrl: source.qc == null ? "" : String(source.qc),
  };
  for (const [rawKey, fillKey] of dates) {
    const parsed = parseQcRawDate(source[rawKey]);
    if (!parsed.ok) return { ok: false, runStatus: "ROW_MISMATCH", reason: "date format unknown" };
    values[fillKey] = parsed.value;
  }
  return { ok: true, values, count1: source.count1 == null ? null : source.count1 };
}

module.exports = {
  assessQcListResponse,
  authoritativeTotal,
  assessQcListDuplicate,
  listEvidence,
  mapGetqcDataResponse,
  canonicalQcFillValue,
  normalizeQcListRow,
  parseQcRawDate,
  portalRowIdFromListRow,
  rowsOf,
  sameFillFields,
};
