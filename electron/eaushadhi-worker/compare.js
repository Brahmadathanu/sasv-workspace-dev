/* eslint-env node */

const { namesEqualExact, normalizeLookupName } = require("./lookup-equality");

const COMPARE_RESULT = Object.freeze({
  MATCH: "MATCH",
  MISMATCH: "MISMATCH",
  UNAVAILABLE: "UNAVAILABLE",
});

function normalizeText(value) {
  if (value == null) return "";
  return String(value).normalize("NFC").trim();
}

function textsEqual(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function sortActionLabels(actions) {
  const list = Array.isArray(actions) ? actions : [];
  return list
    .map((item) => normalizeText(item?.label ?? item?.portal_option_value ?? item))
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function compositionKey(row, index) {
  return String(
    row?.source_composition_line_id ??
      row?.id ??
      `idx:${index}`,
  );
}

function pushDiff(diffs, path, intended, actual, kind) {
  diffs.push({ path, intended, actual, kind });
}

function fieldEntry(path, expected, actual, result) {
  return { path, expected, actual, result };
}

function comparePresentText(path, expected, actual, equalFn) {
  if (actual === undefined) {
    const expectedMissing = expected == null || expected === "";
    if (expectedMissing) {
      return fieldEntry(path, expected, actual, COMPARE_RESULT.MATCH);
    }
    return fieldEntry(path, expected, actual, COMPARE_RESULT.UNAVAILABLE);
  }
  if (equalFn(expected, actual)) {
    return fieldEntry(path, expected, actual, COMPARE_RESULT.MATCH);
  }
  return fieldEntry(path, expected, actual, COMPARE_RESULT.MISMATCH);
}

function compareGovernedSnapshot(intended, portal) {
  const fields = [];
  const intendedProduct = intended?.product || {};
  const portalProduct = portal?.product;

  if (portalProduct === undefined) {
    fields.push(
      fieldEntry(
        "product.portal_product_name",
        intendedProduct.portal_product_name || intendedProduct.canonical_product_name,
        undefined,
        COMPARE_RESULT.UNAVAILABLE,
      ),
    );
  } else {
    const expectedName =
      intendedProduct.portal_product_name || intendedProduct.canonical_product_name;
    const actualName =
      portalProduct.portal_product_name || portalProduct.canonical_product_name;
    fields.push(
      comparePresentText(
        "product.portal_product_name",
        expectedName,
        actualName,
        namesEqualExact,
      ),
    );
  }

  const intendedDetails = intended?.details || {};
  const portalDetails = portal?.details;
  for (const key of [
    "permission_purpose_label",
    "composition_title",
    "diseases_conditions",
    "combined_restricted_declaration",
  ]) {
    const path = `details.${key}`;
    if (portalDetails === undefined) {
      fields.push(fieldEntry(path, intendedDetails[key], undefined, COMPARE_RESULT.UNAVAILABLE));
      continue;
    }
    fields.push(
      comparePresentText(path, intendedDetails[key], portalDetails[key], textsEqual),
    );
  }

  if (portal?.actions === undefined) {
    fields.push(
      fieldEntry("actions", sortActionLabels(intended?.actions), undefined, COMPARE_RESULT.UNAVAILABLE),
    );
  } else {
    const intendedActions = sortActionLabels(intended?.actions);
    const portalActions = sortActionLabels(portal.actions);
    fields.push(
      fieldEntry(
        "actions",
        intendedActions,
        portalActions,
        JSON.stringify(intendedActions) === JSON.stringify(portalActions)
          ? COMPARE_RESULT.MATCH
          : COMPARE_RESULT.MISMATCH,
      ),
    );
  }

  const intendedLines = Array.isArray(intended?.composition) ? intended.composition : [];
  if (portal?.composition === undefined) {
    fields.push(
      fieldEntry("composition", intendedLines.length, undefined, COMPARE_RESULT.UNAVAILABLE),
    );
  } else {
    const portalLines = Array.isArray(portal.composition) ? portal.composition : [];
    fields.push(
      fieldEntry(
        "composition.line_count",
        intendedLines.length,
        portalLines.length,
        intendedLines.length === portalLines.length
          ? COMPARE_RESULT.MATCH
          : COMPARE_RESULT.MISMATCH,
      ),
    );
    const portalByKey = new Map(
      portalLines.map((row, index) => [compositionKey(row, index), row]),
    );
    intendedLines.forEach((row, index) => {
      const key = compositionKey(row, index);
      const actual = portalByKey.get(key);
      if (!actual) {
        fields.push(
          fieldEntry(`composition[${key}]`, row, undefined, COMPARE_RESULT.UNAVAILABLE),
        );
        return;
      }
      fields.push(
        comparePresentText(
          `composition[${key}].ingredient_name`,
          row.ingredient_name,
          actual.ingredient_name,
          textsEqual,
        ),
      );
      fields.push(
        comparePresentText(
          `composition[${key}].scientific_name`,
          row.scientific_name,
          actual.scientific_name,
          textsEqual,
        ),
      );
      fields.push(
        comparePresentText(
          `composition[${key}].quantity_value`,
          row.quantity_value,
          actual.quantity_value,
          (a, b) => String(a ?? "") === String(b ?? ""),
        ),
      );
      fields.push(
        comparePresentText(
          `composition[${key}].unit_text`,
          row.unit_text,
          actual.unit_text,
          textsEqual,
        ),
      );
      fields.push(
        comparePresentText(
          `composition[${key}].part_used`,
          row.part_used?.label,
          actual.part_used?.label,
          textsEqual,
        ),
      );
    });
  }

  const equal = fields.every((item) => item.result === COMPARE_RESULT.MATCH);
  return { equal, fields };
}

function compareIntendedVsPortal(intended, portal, options = {}) {
  const diffs = [];
  const treatActionsAsSet = options.actionsAsSet !== false;
  const intendedProduct = intended?.product || {};
  const portalProduct = portal?.product || {};

  if (!textsEqual(intendedProduct.canonical_product_name, portalProduct.canonical_product_name)) {
    pushDiff(
      diffs,
      "product.canonical_product_name",
      intendedProduct.canonical_product_name,
      portalProduct.canonical_product_name,
      "text",
    );
  }

  const intendedDetails = intended?.details || {};
  const portalDetails = portal?.details || {};
  for (const key of [
    "permission_purpose_label",
    "composition_title",
    "diseases_conditions",
    "combined_restricted_declaration",
  ]) {
    if (!textsEqual(intendedDetails[key], portalDetails[key])) {
      pushDiff(diffs, `details.${key}`, intendedDetails[key], portalDetails[key], "text");
    }
  }

  const intendedActions = treatActionsAsSet
    ? sortActionLabels(intended?.actions)
    : (intended?.actions || []).map((item) => normalizeText(item?.label ?? item));
  const portalActions = treatActionsAsSet
    ? sortActionLabels(portal?.actions)
    : (portal?.actions || []).map((item) => normalizeText(item?.label ?? item));
  if (JSON.stringify(intendedActions) !== JSON.stringify(portalActions)) {
    pushDiff(diffs, "actions", intendedActions, portalActions, "set");
  }

  const intendedLines = Array.isArray(intended?.composition) ? intended.composition : [];
  const portalLines = Array.isArray(portal?.composition) ? portal.composition : [];
  const portalByKey = new Map(
    portalLines.map((row, index) => [compositionKey(row, index), row]),
  );
  const intendedKeys = new Set(
    intendedLines.map((row, index) => compositionKey(row, index)),
  );

  intendedLines.forEach((row, index) => {
    const key = compositionKey(row, index);
    const actual = portalByKey.get(key);
    if (!actual) {
      pushDiff(diffs, `composition[${key}]`, row, null, "missing_row");
      return;
    }
    if (!textsEqual(row.ingredient_name, actual.ingredient_name)) {
      pushDiff(
        diffs,
        `composition[${key}].ingredient_name`,
        row.ingredient_name,
        actual.ingredient_name,
        "text",
      );
    }
    if (!textsEqual(row.scientific_name, actual.scientific_name)) {
      pushDiff(
        diffs,
        `composition[${key}].scientific_name`,
        row.scientific_name,
        actual.scientific_name,
        "text",
      );
    }
    if (String(row.quantity_value ?? "") !== String(actual.quantity_value ?? "")) {
      pushDiff(
        diffs,
        `composition[${key}].quantity_value`,
        row.quantity_value,
        actual.quantity_value,
        "quantity",
      );
    }
    if (!textsEqual(row.unit_text, actual.unit_text)) {
      pushDiff(
        diffs,
        `composition[${key}].unit_text`,
        row.unit_text,
        actual.unit_text,
        "unit",
      );
    }
    if (!textsEqual(row.part_used?.label, actual.part_used?.label)) {
      pushDiff(
        diffs,
        `composition[${key}].part_used`,
        row.part_used?.label,
        actual.part_used?.label,
        "text",
      );
    }
  });

  portalLines.forEach((row, index) => {
    const key = compositionKey(row, index);
    if (!intendedKeys.has(key)) {
      pushDiff(diffs, `composition[${key}]`, null, row, "extra_row");
    }
  });

  const report = compareGovernedSnapshot(intended, portal);
  return {
    equal: diffs.length === 0,
    diffs,
    fields: report.fields,
    governedEqual: report.equal,
  };
}

module.exports = {
  COMPARE_RESULT,
  normalizeText,
  normalizeLookupName,
  namesEqualExact,
  compareIntendedVsPortal,
  compareGovernedSnapshot,
};
