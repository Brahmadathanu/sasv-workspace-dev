const OPAQUE_ID = /^[A-Za-z0-9_-]{1,96}$/;
const ALLOWED_EDIT_SHAPES = [
  /GetCompositionDataUpdate\(\s*['"]([A-Za-z0-9_-]{1,96})['"]\s*\)/g,
  /data-composition-id\s*=\s*['"]([A-Za-z0-9_-]{1,96})['"]/g,
];

const COMPOSITION_LIVE_ARM_DEFAULT = false;

function compositionLiveArmEnabled(environment = process.env) {
  return COMPOSITION_LIVE_ARM_DEFAULT && environment?.EAUSHADHI_COMPOSITION_LIVE_ARM === "true";
}

function assessCompositionLineAuthority(line) {
  const reference = line?.reference || {};
  const blockers = [];
  if (line?.review_status !== "VERIFIED") blockers.push("LINE_REVIEW_NOT_VERIFIED");
  if (reference.reference_ready !== true) blockers.push("REFERENCE_NOT_READY");
  if (reference.source_to_canonical_ready !== true) {
    blockers.push("REFERENCE_SOURCE_MAPPING_NOT_READY");
  }
  if (reference.canonical_to_portal_ready !== true) {
    blockers.push("REFERENCE_PORTAL_MAPPING_NOT_READY");
  }
  if (reference.alias_mapping_status !== "VERIFIED") {
    blockers.push("REFERENCE_ALIAS_NOT_VERIFIED");
  }
  if (reference.portal_mapping_status !== "VERIFIED") {
    blockers.push("REFERENCE_PORTAL_NOT_VERIFIED");
  }
  if (typeof reference.portal_value !== "string" || !reference.portal_value.trim()) {
    blockers.push("REFERENCE_PORTAL_VALUE_MISSING");
  }
  return { ready: blockers.length === 0, blockers };
}

function assessCompositionSnapshotAuthority({
  currentContentHash,
  expectedContentHash,
  compositionLines,
} = {}) {
  const blockers = [];
  const currentHashPresent =
    typeof currentContentHash === "string" && currentContentHash.trim().length > 0;
  const expectedHashPresent =
    typeof expectedContentHash === "string" && expectedContentHash.trim().length > 0;

  if (!currentHashPresent) blockers.push("CONTENT_HASH_MISSING");
  if (!expectedHashPresent) blockers.push("EXPECTED_CONTENT_HASH_MISSING");
  if (currentHashPresent && expectedHashPresent && currentContentHash !== expectedContentHash) {
    blockers.push("CONTENT_HASH_DRIFT");
  }

  const linesValid = Array.isArray(compositionLines);
  if (!linesValid) blockers.push("COMPOSITION_LINES_INVALID");
  const lineFailures = linesValid
    ? compositionLines.flatMap((line, index) => {
        const authority = assessCompositionLineAuthority(line);
        return authority.ready ? [] : [{ index, blockers: authority.blockers }];
      })
    : [];
  if (lineFailures.length > 0) blockers.push("COMPOSITION_LINE_AUTHORITY_FAILED");

  return {
    ready: blockers.length === 0,
    blockers,
    lineFailures,
  };
}

function parseCompositionRowId(editMarkup) {
  if (typeof editMarkup !== "string" || editMarkup.length === 0 || editMarkup.length > 2048) {
    return { ok: false, code: "ROW_ID_CONTRACT_UNPROVEN", rowId: null };
  }
  const ids = [];
  for (const pattern of ALLOWED_EDIT_SHAPES) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(editMarkup); match; match = pattern.exec(editMarkup)) ids.push(match[1]);
  }
  const unique = [...new Set(ids)].filter((value) => OPAQUE_ID.test(value));
  return unique.length === 1
    ? { ok: true, code: "ROW_ID_CONTRACT_PROVEN", rowId: unique[0] }
    : { ok: false, code: "ROW_ID_CONTRACT_UNPROVEN", rowId: null };
}

function classifyCompositionUnitname(actual, expectedPortalValue, expectedPortalLabel) {
  const value = typeof actual === "string" ? actual.trim() : "";
  if (value && value === String(expectedPortalValue).trim()) {
    return { ok: true, code: "UNITNAME_PORTAL_VALUE" };
  }
  if (value && value === String(expectedPortalLabel).trim()) {
    return { ok: true, code: "UNITNAME_PORTAL_LABEL" };
  }
  return { ok: false, code: "UNITNAME_CONTRACT_UNPROVEN" };
}

function assessFirstLineBootstrap({ editMarkup, reread, expectedUnitValue, expectedUnitLabel } = {}) {
  const parsed = parseCompositionRowId(editMarkup);
  if (!parsed.ok) return { ...parsed, proceedToNextLine: false, retrySave: false };
  if (String(reread?.id ?? "") !== parsed.rowId) {
    return { ok: false, code: "REREAD_ID_MISMATCH", proceedToNextLine: false, retrySave: false };
  }
  const unit = classifyCompositionUnitname(reread?.unitname, expectedUnitValue, expectedUnitLabel);
  return { ...unit, rowId: parsed.rowId, proceedToNextLine: false, retrySave: false };
}

module.exports = {
  COMPOSITION_LIVE_ARM_DEFAULT,
  assessCompositionLineAuthority,
  assessCompositionSnapshotAuthority,
  assessFirstLineBootstrap,
  classifyCompositionUnitname,
  compositionLiveArmEnabled,
  parseCompositionRowId,
};
