/* eslint-env node */

const { parseCompositionRowId } = require("./composition-contract");

const OPAQUE_ID = /^[A-Za-z0-9_-]{1,96}$/;
const PLAIN_DECIMAL = /^\+?\d+(?:\.\d+)?$/;

function boundedText(value, max = 512) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFC").trim();
  return text && text.length <= max ? text : null;
}

function parseNativeCompositionRowId(row) {
  const fragments = [row?.edit, row?.delete, row?.editMarkup, row?.deleteMarkup]
    .filter((value) => typeof value === "string" && value.length)
    .join(" ");
  return parseCompositionRowId(fragments);
}

function normalizeCompositionReread(reread, expectedId) {
  const id = boundedText(String(reread?.id ?? ""), 96);
  const expected = boundedText(String(expectedId ?? ""), 96);
  if (!id || !expected || !OPAQUE_ID.test(id) || id !== expected) {
    return { ok: false, code: "REREAD_ID_MISMATCH" };
  }
  if (String(reread?.status ?? "") !== "1") {
    return { ok: false, code: "REREAD_STATUS_NOT_ACTIVE", portalRowId: id };
  }
  const quantity = boundedText(String(reread?.quantity ?? ""), 64);
  const normalized = {
    portalRowId: id,
    ingredientName: boundedText(reread?.ingredientName),
    scientificName: boundedText(reread?.botanicalName),
    ingredientTypeValue: boundedText(String(reread?.ingredientTypeId ?? ""), 96),
    ingredientFormValue: boundedText(String(reread?.ingredientFormId ?? ""), 96),
    partUsedValue: boundedText(String(reread?.partuseId ?? ""), 96),
    quantity,
    measurement: {
      representation: "VALUE",
      value: boundedText(String(reread?.unitname ?? ""), 96),
    },
    reference: {
      representation: "VALUE",
      value: boundedText(String(reread?.referenceId ?? ""), 96),
    },
  };
  const missing = [];
  for (const key of [
    "ingredientName",
    "scientificName",
    "ingredientTypeValue",
    "ingredientFormValue",
    "partUsedValue",
  ]) {
    if (!normalized[key]) missing.push(key);
  }
  if (!quantity || !PLAIN_DECIMAL.test(quantity)) missing.push("quantity");
  if (!normalized.measurement.value) missing.push("measurement.value");
  if (!normalized.reference.value) missing.push("reference.value");
  return missing.length
    ? { ok: false, code: "REREAD_FIELDS_UNPROVEN", portalRowId: id, missing }
    : { ok: true, code: "REREAD_NORMALIZED", row: normalized };
}

function normalizeNativeCompositionList({ rows, rereads, totalCount, requestedLength } = {}) {
  if (!Array.isArray(rows) || !Array.isArray(rereads)) {
    return { ok: false, code: "LIST_ROWS_INVALID" };
  }
  if (!Number.isInteger(totalCount) || totalCount < 0 || totalCount !== rows.length) {
    return { ok: false, code: "LIST_COUNT_MISMATCH" };
  }
  if (!Number.isInteger(requestedLength) || requestedLength < totalCount) {
    return { ok: false, code: "LIST_COVERAGE_INCOMPLETE" };
  }
  const normalized = [];
  const ids = new Set();
  for (let index = 0; index < rows.length; index += 1) {
    const parsed = parseNativeCompositionRowId(rows[index]);
    if (!parsed.ok) return { ok: false, code: parsed.code, index };
    if (ids.has(parsed.rowId)) {
      return { ok: false, code: "DUPLICATE_PORTAL_ROW_ID", portalRowId: parsed.rowId };
    }
    ids.add(parsed.rowId);
    const reread = normalizeCompositionReread(rereads[index], parsed.rowId);
    if (!reread.ok) return { ...reread, index };
    normalized.push(reread.row);
  }
  return {
    ok: true,
    code: "LIST_NORMALIZED",
    rows: normalized,
    totalCount,
    requestedLength,
  };
}

module.exports = {
  normalizeCompositionReread,
  normalizeNativeCompositionList,
  parseNativeCompositionRowId,
};
