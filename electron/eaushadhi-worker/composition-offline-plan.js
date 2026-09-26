/* eslint-env node */

const { assessCompositionSnapshotAuthority } = require("./composition-contract");

const PLAN_CODE = Object.freeze({
  ALREADY_COMPLETE: "ALREADY_COMPLETE",
  OFFLINE_MISSING: "OFFLINE_MISSING",
  BLOCKED_HASH_AUTHORITY: "BLOCKED_HASH_AUTHORITY",
  BLOCKED_LINE_AUTHORITY: "BLOCKED_LINE_AUTHORITY",
  BLOCKED_EMPTY_GOVERNED_COMPOSITION: "BLOCKED_EMPTY_GOVERNED_COMPOSITION",
  BLOCKED_PAGE_IDENTITY: "BLOCKED_PAGE_IDENTITY",
  BLOCKED_LIST_COVERAGE: "BLOCKED_LIST_COVERAGE",
  BLOCKED_PORTAL_ROW_UNPARSEABLE: "BLOCKED_PORTAL_ROW_UNPARSEABLE",
  BLOCKED_REFERENCE_REPRESENTATION: "BLOCKED_REFERENCE_REPRESENTATION",
  BLOCKED_CONFLICT: "BLOCKED_CONFLICT",
  BLOCKED_DUPLICATE: "BLOCKED_DUPLICATE",
  BLOCKED_UNEXPLAINED_EXTRA: "BLOCKED_UNEXPLAINED_EXTRA",
  BLOCKED_AMBIGUOUS: "BLOCKED_AMBIGUOUS",
});

const CONTROLLED_REPRESENTATIONS = new Set(["VALUE", "PROVEN_LABEL"]);
const PORTAL_ROW_ID = /^[A-Za-z0-9_-]{1,96}$/;
const PLAIN_DECIMAL = /^\+?\d+(?:\.\d+)?$/;

function normalizeText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  return normalized || null;
}

function canonicalizeQuantity(value) {
  if (typeof value !== "string" || !PLAIN_DECIMAL.test(value)) return null;
  const unsigned = value.startsWith("+") ? value.slice(1) : value;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const fractional = fractionalPart.replace(/0+$/, "");
  return fractional ? `${integer}.${fractional}` : integer;
}

function normalizeAuditId(value) {
  if (Number.isSafeInteger(value) && value > 0) return { value, key: String(value) };
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return { value, key: value };
  }
  return null;
}

function normalizeControlledValue(value) {
  return normalizeText(value);
}

function projectGovernedLine(line) {
  const sourceId = normalizeAuditId(line?.source_composition_line_id);
  const projection = {
    sourceCompositionLineId: sourceId?.value ?? null,
    ingredientName: normalizeText(line?.ingredient_name),
    scientificName: normalizeText(line?.scientific_name),
    ingredientTypeValue: normalizeControlledValue(line?.ingredient_type?.portal_option_value),
    ingredientFormValue: normalizeControlledValue(line?.ingredient_form?.portal_option_value),
    partUsedValue: normalizeControlledValue(line?.part_used?.portal_option_value),
    quantity: canonicalizeQuantity(line?.quantity_value),
    measurementUnitValue: normalizeControlledValue(line?.measurement?.portal_option_value),
    measurementUnitLabel:
      line?.measurement?.label == null ? null : normalizeText(line.measurement.label),
    referenceValue: normalizeControlledValue(line?.reference?.portal_value),
    referenceLabel:
      line?.reference?.portal_label == null ? null : normalizeText(line.reference.portal_label),
  };
  const missing = Object.entries(projection)
    .filter(([key, value]) => !["measurementUnitLabel", "referenceLabel"].includes(key) && value == null)
    .map(([key]) => key);
  if (line?.measurement?.label != null && projection.measurementUnitLabel == null) {
    missing.push("measurementUnitLabel");
  }
  if (line?.reference?.portal_label != null && projection.referenceLabel == null) {
    missing.push("referenceLabel");
  }
  if (missing.length) {
    return {
      ok: false,
      sourceCompositionLineId: projection.sourceCompositionLineId,
      blocker: "GOVERNED_SEMANTIC_FIELD_INVALID",
      fields: missing,
    };
  }
  const semanticSignature = JSON.stringify([
    projection.ingredientName,
    projection.scientificName,
    projection.ingredientTypeValue,
    projection.ingredientFormValue,
    projection.partUsedValue,
    projection.quantity,
    projection.measurementUnitValue,
    projection.referenceValue,
  ]);
  const candidateIdentityAnchor = JSON.stringify([
    projection.ingredientName,
    projection.scientificName,
  ]);
  return {
    ok: true,
    sourceIdKey: sourceId.key,
    projection,
    semanticSignature,
    candidateIdentityAnchor,
  };
}

/**
 * Normalized portal rows are synthetic/offline evidence only. This is NOT a
 * proven native e-Aushadhi response schema and performs no native parsing.
 */
function normalizeOfflinePortalRow(row, index) {
  const portalRowId = typeof row?.portalRowId === "string" ? row.portalRowId : "";
  const measurementRepresentation = row?.measurement?.representation;
  const referenceRepresentation = row?.reference?.representation;
  if (referenceRepresentation === "PROVEN_LABEL") {
    return {
      ok: false,
      code: "REFERENCE_VALUE_SEMANTICS_UNPROVEN",
      index,
      portalRowId: PORTAL_ROW_ID.test(portalRowId) ? portalRowId : null,
    };
  }
  const projection = {
    portalRowId: PORTAL_ROW_ID.test(portalRowId) ? portalRowId : null,
    ingredientName: normalizeText(row?.ingredientName),
    scientificName: normalizeText(row?.scientificName),
    ingredientTypeValue: normalizeControlledValue(row?.ingredientTypeValue),
    ingredientFormValue: normalizeControlledValue(row?.ingredientFormValue),
    partUsedValue: normalizeControlledValue(row?.partUsedValue),
    quantity: canonicalizeQuantity(row?.quantity),
    measurement: {
      representation: CONTROLLED_REPRESENTATIONS.has(measurementRepresentation)
        ? measurementRepresentation
        : null,
      value: normalizeControlledValue(row?.measurement?.value),
    },
    reference: {
      representation: referenceRepresentation === "VALUE" ? "VALUE" : null,
      value: normalizeControlledValue(row?.reference?.value),
    },
  };
  const missing = [];
  for (const key of [
    "portalRowId",
    "ingredientName",
    "scientificName",
    "ingredientTypeValue",
    "ingredientFormValue",
    "partUsedValue",
    "quantity",
  ]) {
    if (projection[key] == null) missing.push(key);
  }
  if (!projection.measurement.representation) missing.push("measurement.representation");
  if (!projection.measurement.value) missing.push("measurement.value");
  if (!projection.reference.representation) missing.push("reference.representation");
  if (!projection.reference.value) missing.push("reference.value");
  if (missing.length) {
    return {
      ok: false,
      code: "PORTAL_ROW_UNPARSEABLE",
      index,
      portalRowId: projection.portalRowId,
      fields: missing,
    };
  }
  return {
    ok: true,
    projection,
    candidateIdentityAnchor: JSON.stringify([
      projection.ingredientName,
      projection.scientificName,
    ]),
  };
}

function measurementMatches(governed, portal) {
  if (portal.measurement.representation === "VALUE") {
    return portal.measurement.value === governed.measurementUnitValue;
  }
  return (
    portal.measurement.representation === "PROVEN_LABEL" &&
    governed.measurementUnitLabel != null &&
    portal.measurement.value === governed.measurementUnitLabel
  );
}

function portalMatchesGoverned(governed, portal) {
  return (
    portal.ingredientName === governed.ingredientName &&
    portal.scientificName === governed.scientificName &&
    portal.ingredientTypeValue === governed.ingredientTypeValue &&
    portal.ingredientFormValue === governed.ingredientFormValue &&
    portal.partUsedValue === governed.partUsedValue &&
    portal.quantity === governed.quantity &&
    measurementMatches(governed, portal) &&
    portal.reference.representation === "VALUE" &&
    portal.reference.value === governed.referenceValue
  );
}

function differingFields(governed, portal) {
  const fields = [];
  for (const [key, portalKey] of [
    ["ingredientName", "ingredientName"],
    ["scientificName", "scientificName"],
    ["ingredientTypeValue", "ingredientTypeValue"],
    ["ingredientFormValue", "ingredientFormValue"],
    ["partUsedValue", "partUsedValue"],
    ["quantity", "quantity"],
  ]) {
    if (governed[key] !== portal[portalKey]) fields.push(key);
  }
  if (!measurementMatches(governed, portal)) fields.push("measurement");
  if (portal.reference.value !== governed.referenceValue) fields.push("reference");
  return fields;
}

function validPageIdentity(evidence) {
  const blockers = [];
  const actualRoute = normalizeText(evidence?.actualRoute);
  const expectedRoute = normalizeText(evidence?.expectedRoute);
  if (!actualRoute || !expectedRoute || evidence.actualRoute !== evidence.expectedRoute) {
    blockers.push("PAGE_ROUTE_MISMATCH");
  }
  const actualProduct = normalizeAuditId(evidence?.actualProductId);
  const expectedProduct = normalizeAuditId(evidence?.expectedProductId);
  if (!actualProduct || !expectedProduct || evidence.actualProductId !== evidence.expectedProductId) {
    blockers.push("PRODUCT_ID_MISMATCH");
  }
  const portalRefRequired =
    evidence?.actualPortalProductRef != null || evidence?.expectedPortalProductRef != null;
  if (portalRefRequired) {
    const actualRef = normalizeText(evidence?.actualPortalProductRef);
    const expectedRef = normalizeText(evidence?.expectedPortalProductRef);
    if (!actualRef || !expectedRef || evidence.actualPortalProductRef !== evidence.expectedPortalProductRef) {
      blockers.push("PORTAL_PRODUCT_REF_MISMATCH");
    }
  }
  return { ok: blockers.length === 0, blockers };
}

function baseResult(code, ok, detail = {}) {
  return {
    ok,
    code,
    mutationAllowed: false,
    governedCount: detail.governedCount ?? 0,
    portalCount: detail.portalCount ?? 0,
    matches: detail.matches || [],
    missing: detail.missing || [],
    conflicts: detail.conflicts || [],
    duplicates: detail.duplicates || [],
    extras: detail.extras || [],
    blockers: detail.blockers || [],
  };
}

function buildOfflineCompositionExecutionPlan({
  governedSnapshot,
  expectedContentHash,
  pageIdentityEvidence,
  portalListEvidence,
} = {}) {
  const compositionLines = governedSnapshot?.composition;
  const snapshot = assessCompositionSnapshotAuthority({
    currentContentHash: governedSnapshot?.content_hash,
    expectedContentHash,
    compositionLines,
  });
  if (!snapshot.ready) {
    const hashBlocked = snapshot.blockers.some((code) =>
      ["CONTENT_HASH_MISSING", "EXPECTED_CONTENT_HASH_MISSING", "CONTENT_HASH_DRIFT"].includes(code),
    );
    return baseResult(
      hashBlocked ? PLAN_CODE.BLOCKED_HASH_AUTHORITY : PLAN_CODE.BLOCKED_LINE_AUTHORITY,
      false,
      { blockers: snapshot.blockers },
    );
  }
  if (compositionLines.length === 0) {
    return baseResult(PLAN_CODE.BLOCKED_EMPTY_GOVERNED_COMPOSITION, false, {
      blockers: ["EMPTY_GOVERNED_COMPOSITION"],
    });
  }

  const pageIdentity = validPageIdentity(pageIdentityEvidence);
  if (!pageIdentity.ok) {
    return baseResult(PLAN_CODE.BLOCKED_PAGE_IDENTITY, false, {
      governedCount: compositionLines.length,
      blockers: pageIdentity.blockers,
    });
  }

  const listBlockers = [];
  if (portalListEvidence?.settled !== true) listBlockers.push("LIST_NOT_SETTLED");
  if (portalListEvidence?.success !== true) listBlockers.push("LIST_NOT_SUCCESSFUL");
  if (portalListEvidence?.coverageComplete !== true) listBlockers.push("LIST_COVERAGE_INCOMPLETE");
  if (!Array.isArray(portalListEvidence?.rows)) listBlockers.push("LIST_ROWS_INVALID");
  if (listBlockers.length) {
    return baseResult(PLAN_CODE.BLOCKED_LIST_COVERAGE, false, {
      governedCount: compositionLines.length,
      blockers: listBlockers,
    });
  }

  const governed = compositionLines.map(projectGovernedLine);
  const governedFailures = governed.filter((item) => !item.ok);
  const sourceIdKeys = governed.filter((item) => item.ok).map((item) => item.sourceIdKey);
  if (new Set(sourceIdKeys).size !== sourceIdKeys.length) {
    governedFailures.push({ blocker: "DUPLICATE_SOURCE_COMPOSITION_LINE_ID" });
  }
  if (governedFailures.length) {
    return baseResult(PLAN_CODE.BLOCKED_LINE_AUTHORITY, false, {
      governedCount: compositionLines.length,
      portalCount: portalListEvidence.rows.length,
      blockers: governedFailures,
    });
  }

  const portal = portalListEvidence.rows.map(normalizeOfflinePortalRow);
  const referenceFailures = portal.filter(
    (item) => !item.ok && item.code === "REFERENCE_VALUE_SEMANTICS_UNPROVEN",
  );
  if (referenceFailures.length) {
    return baseResult(PLAN_CODE.BLOCKED_REFERENCE_REPRESENTATION, false, {
      governedCount: governed.length,
      portalCount: portal.length,
      blockers: referenceFailures,
    });
  }
  const portalFailures = portal.filter((item) => !item.ok);
  if (portalFailures.length) {
    return baseResult(PLAN_CODE.BLOCKED_PORTAL_ROW_UNPARSEABLE, false, {
      governedCount: governed.length,
      portalCount: portal.length,
      blockers: portalFailures,
    });
  }

  const normalizedPortal = portal.map((item) => item.projection);
  const duplicateRowIds = [...new Set(normalizedPortal.map((row) => row.portalRowId))]
    .filter((id) => normalizedPortal.filter((row) => row.portalRowId === id).length > 1)
    .map((portalRowId) => ({ kind: "DUPLICATE_PORTAL_ROW_ID", portalRowId }));
  if (duplicateRowIds.length) {
    return baseResult(PLAN_CODE.BLOCKED_DUPLICATE, false, {
      governedCount: governed.length,
      portalCount: normalizedPortal.length,
      duplicates: duplicateRowIds,
      blockers: ["DUPLICATE_PORTAL_ROW_ID"],
    });
  }

  const governedBySignature = new Map();
  const governedByAnchor = new Map();
  for (const item of governed) {
    if (!governedBySignature.has(item.semanticSignature)) governedBySignature.set(item.semanticSignature, []);
    governedBySignature.get(item.semanticSignature).push(item);
    if (!governedByAnchor.has(item.candidateIdentityAnchor)) governedByAnchor.set(item.candidateIdentityAnchor, []);
    governedByAnchor.get(item.candidateIdentityAnchor).push(item);
  }

  const exactPortalBySignature = new Map();
  const conflicts = [];
  const extras = [];
  const ambiguous = [];
  for (const portalItem of portal) {
    const exactSignatures = [...governedBySignature.entries()]
      .filter(([, governedItems]) => portalMatchesGoverned(governedItems[0].projection, portalItem.projection))
      .map(([signature]) => signature);
    if (exactSignatures.length > 1) {
      ambiguous.push({ portalRowId: portalItem.projection.portalRowId, kind: "MULTIPLE_EXACT_SIGNATURES" });
      continue;
    }
    if (exactSignatures.length === 1) {
      const signature = exactSignatures[0];
      if (!exactPortalBySignature.has(signature)) exactPortalBySignature.set(signature, []);
      exactPortalBySignature.get(signature).push(portalItem.projection);
      continue;
    }
    const anchorCandidates = governedByAnchor.get(portalItem.candidateIdentityAnchor) || [];
    if (anchorCandidates.length === 0) {
      extras.push({
        portalRowId: portalItem.projection.portalRowId,
        candidateIdentityAnchor: portalItem.candidateIdentityAnchor,
      });
    } else if (anchorCandidates.length === 1) {
      conflicts.push({
        sourceCompositionLineId: anchorCandidates[0].projection.sourceCompositionLineId,
        portalRowId: portalItem.projection.portalRowId,
        fields: differingFields(anchorCandidates[0].projection, portalItem.projection),
      });
    } else {
      ambiguous.push({
        portalRowId: portalItem.projection.portalRowId,
        kind: "NON_UNIQUE_CANDIDATE_IDENTITY_ANCHOR",
      });
    }
  }

  if (ambiguous.length) {
    return baseResult(PLAN_CODE.BLOCKED_AMBIGUOUS, false, {
      governedCount: governed.length,
      portalCount: normalizedPortal.length,
      blockers: ambiguous,
    });
  }

  const semanticDuplicates = [];
  for (const [signature, portalItems] of exactPortalBySignature) {
    const governedItems = governedBySignature.get(signature) || [];
    if (portalItems.length > governedItems.length) {
      semanticDuplicates.push({
        kind: "PORTAL_SEMANTIC_COUNT_EXCEEDS_GOVERNED",
        semanticSignature: signature,
        portalRowIds: portalItems.map((item) => item.portalRowId),
      });
    }
  }
  if (semanticDuplicates.length) {
    return baseResult(PLAN_CODE.BLOCKED_DUPLICATE, false, {
      governedCount: governed.length,
      portalCount: normalizedPortal.length,
      duplicates: semanticDuplicates,
      blockers: ["PORTAL_SEMANTIC_COUNT_EXCEEDS_GOVERNED"],
    });
  }
  if (conflicts.length) {
    return baseResult(PLAN_CODE.BLOCKED_CONFLICT, false, {
      governedCount: governed.length,
      portalCount: normalizedPortal.length,
      conflicts,
      blockers: ["SEMANTIC_CONFLICT"],
    });
  }
  if (extras.length) {
    return baseResult(PLAN_CODE.BLOCKED_UNEXPLAINED_EXTRA, false, {
      governedCount: governed.length,
      portalCount: normalizedPortal.length,
      extras,
      blockers: ["UNEXPLAINED_PORTAL_ROW"],
    });
  }

  const matches = [];
  const missing = [];
  for (const [signature, governedItems] of governedBySignature) {
    const portalItems = exactPortalBySignature.get(signature) || [];
    if (governedItems.length > 1 && portalItems.length > 0) {
      return baseResult(PLAN_CODE.BLOCKED_AMBIGUOUS, false, {
        governedCount: governed.length,
        portalCount: normalizedPortal.length,
        blockers: [{ kind: "NON_UNIQUE_SEMANTIC_OCCURRENCE", semanticSignature: signature }],
      });
    }
    if (portalItems.length === 1) {
      matches.push({
        sourceCompositionLineId: governedItems[0].projection.sourceCompositionLineId,
        portalRowId: portalItems[0].portalRowId,
      });
    }
    if (portalItems.length < governedItems.length) {
      if (governedItems.length > 1) {
        return baseResult(PLAN_CODE.BLOCKED_AMBIGUOUS, false, {
          governedCount: governed.length,
          portalCount: normalizedPortal.length,
          blockers: [{ kind: "MISSING_OCCURRENCE_NOT_SOURCE_IDENTIFIABLE", semanticSignature: signature }],
        });
      }
      const item = governedItems[0];
      missing.push({
        sourceCompositionLineId: item.projection.sourceCompositionLineId,
        semanticSignature: item.semanticSignature,
        projection: item.projection,
      });
    }
  }

  if (missing.length) {
    return baseResult(PLAN_CODE.OFFLINE_MISSING, true, {
      governedCount: governed.length,
      portalCount: normalizedPortal.length,
      matches,
      missing,
    });
  }
  return baseResult(PLAN_CODE.ALREADY_COMPLETE, true, {
    governedCount: governed.length,
    portalCount: normalizedPortal.length,
    matches,
  });
}

module.exports = {
  PLAN_CODE,
  buildOfflineCompositionExecutionPlan,
  canonicalizeQuantity,
  normalizeText,
};
