/* eslint-env node */

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
    .map((item) => normalizeText(item?.label ?? item))
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

  return {
    equal: diffs.length === 0,
    diffs,
  };
}

module.exports = {
  normalizeText,
  compareIntendedVsPortal,
};
