/* eslint-env node */

/**
 * Explicit Product Details field contract for first controlled product (262).
 * Fail-closed (1A): SaveData-required fields without governed sources block Start.
 * Permission Purpose (2B): exact visible option-label match only.
 */

const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { namesEqualExact, normalizeLookupName } = require("./lookup-equality");

const FIELD_CLASS = Object.freeze({
  REQUIRED_GOVERNED: "REQUIRED_GOVERNED",
  CONDITIONAL_GOVERNED: "CONDITIONAL_GOVERNED",
  PROVEN_NOT_APPLICABLE: "PROVEN_NOT_APPLICABLE",
});

const EXPECTED_PORTAL_PRODUCT_NAME = "Karpooradi Thailam";
const EXPECTED_APPROVED_COPY_NAME =
  "EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V01.pdf";

/**
 * SaveData-observed controls for the Ayurveda add branch.
 * Unresolved country/month/shelfmonth/remarks stay REQUIRED_GOVERNED without source → gate fails.
 */
const FIELD_CONTRACT = Object.freeze([
  {
    key: "name",
    selector: "#name",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "product.portal_product_name",
  },
  {
    key: "type",
    selector: "#type",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "classification.product_type.portal_option_value",
  },
  {
    key: "categoryId",
    selector: "#categoryId",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "classification.product_category.portal_option_value",
    dependsOn: ["type"],
  },
  {
    key: "subTypeId",
    selector: "#subTypeId",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "classification.product_subtype.portal_option_value",
    dependsOn: ["type", "categoryId"],
  },
  {
    key: "permissionPurpose",
    selector: "#permissionPurpose",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "details.permission_purpose_label",
    resolveMode: "exact_option_label",
  },
  {
    key: "compositionTitle",
    selector: "#compositionTitle",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "details.composition_title",
  },
  {
    key: "disease",
    selector: "#disease",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "details.diseases_conditions",
  },
  {
    key: "indications",
    selector: "select#indications",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "actions",
    multiple: true,
  },
  {
    key: "drugs",
    selector: "#drug_yes|#drug_no",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "details.combined_restricted_declaration",
  },
  {
    key: "drugsValue",
    selector: "#drugsValue",
    classification: FIELD_CLASS.CONDITIONAL_GOVERNED,
    sourcePath: "details.restricted_drugs_text",
    when: { drugs: "YES" },
  },
  {
    key: "uploadAttachment",
    selector: "#uploadAttachment",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: "evidence.approved_product_copy",
  },
  {
    key: "remarks",
    selector: "#remarks",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: null,
    governanceMissing: true,
  },
  {
    key: "countryApplicable",
    selector: "#countryApplicable",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: null,
    governanceMissing: true,
  },
  {
    key: "countryId",
    selector: "#countryId",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: null,
    governanceMissing: true,
  },
  {
    key: "month",
    selector: "#month",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: null,
    governanceMissing: true,
  },
  {
    key: "shelfmonth",
    selector: "input[name='shelfmonth'],#shelfmonth",
    classification: FIELD_CLASS.REQUIRED_GOVERNED,
    sourcePath: null,
    governanceMissing: true,
  },
]);

function getByPath(obj, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function assertProductLock(productId, content) {
  const id = Number(productId);
  if (id !== FIRST_CONTROLLED_PRODUCT_ID) {
    return {
      ok: false,
      code: "PRODUCT_LOCK_REJECTED",
      message: `Product Details execution accepts only product_id ${FIRST_CONTROLLED_PRODUCT_ID}.`,
    };
  }
  const name =
    content?.product?.portal_product_name || content?.product?.canonical_product_name || "";
  if (!namesEqualExact(name, EXPECTED_PORTAL_PRODUCT_NAME)) {
    return {
      ok: false,
      code: "PRODUCT_NAME_MISMATCH",
      message: `Portal product name must be exactly ${EXPECTED_PORTAL_PRODUCT_NAME}.`,
    };
  }
  return { ok: true };
}

function rejectKuzhambuSubtype(content) {
  const subtype = content?.classification?.product_subtype || {};
  const label = String(subtype.label || "");
  const value = String(subtype.portal_option_value || "");
  if (/kuzhambu/i.test(label) || /kuzhambu/i.test(value)) {
    return {
      ok: false,
      code: "INTERNAL_SUBTYPE_REJECTED",
      message: 'Internal subtype "Kuzhambu" must never be portal-mapped.',
    };
  }
  if (String(subtype.portal_option_value) !== "31" || String(subtype.label) !== "-") {
    return {
      ok: false,
      code: "SUBTYPE_NOT_VERIFIED_PORTAL",
      message: 'Karpooradi subtype must be portal option value "31" with label "-".',
    };
  }
  return { ok: true };
}

/**
 * Permission Purpose 2B: exact unique visible label match.
 */
function resolvePermissionPurposeByExactLabel(governedLabel, liveOptions) {
  const expected = normalizeLookupName(governedLabel);
  if (!expected) {
    return { ok: false, code: "PERMISSION_LABEL_MISSING", matches: [] };
  }
  const list = Array.isArray(liveOptions) ? liveOptions : [];
  const matches = list.filter((opt) => namesEqualExact(opt?.label ?? opt?.text ?? "", expected));
  if (matches.length === 0) {
    return { ok: false, code: "PERMISSION_LABEL_ZERO_MATCH", matches: [] };
  }
  if (matches.length > 1) {
    return { ok: false, code: "PERMISSION_LABEL_MULTIPLE_MATCH", matches };
  }
  const hit = matches[0];
  return {
    ok: true,
    governedLabel: expected,
    resolvedPortalValue: hit.value != null ? String(hit.value) : String(hit.label || ""),
    resolvedLabel: normalizeLookupName(hit.label ?? hit.text ?? ""),
  };
}

function indicationValues(content) {
  const actions = Array.isArray(content?.actions) ? content.actions : [];
  return actions
    .map((item) => String(item?.portal_option_value || item?.label || "").trim())
    .filter(Boolean);
}

function buildFillPlan(content, options = {}) {
  const lock = assertProductLock(FIRST_CONTROLLED_PRODUCT_ID, content);
  if (!lock.ok) return { ok: false, ...lock, fields: [], blockers: [lock.code] };

  const subtypeGate = rejectKuzhambuSubtype(content);
  if (!subtypeGate.ok) {
    return { ok: false, ...subtypeGate, fields: [], blockers: [subtypeGate.code] };
  }

  const blockers = [];
  const fields = [];
  const drugs = String(content?.details?.combined_restricted_declaration || "").toUpperCase();

  const overrides =
    options.fieldGovernanceOverrides && typeof options.fieldGovernanceOverrides === "object"
      ? options.fieldGovernanceOverrides
      : null;

  for (const spec of FIELD_CONTRACT) {
    if (spec.governanceMissing || spec.sourcePath == null) {
      const overrideVal = overrides?.[spec.key];
      // Production never supplies overrides; offline harness may inject explicit values
      // only to exercise the executor path without inventing live portal defaults.
      if (overrideVal != null && String(overrideVal).trim() !== "") {
        fields.push({
          ...spec,
          governed: true,
          expected: String(overrideVal),
          fill: true,
          fromOverride: true,
        });
        continue;
      }
      if (spec.classification === FIELD_CLASS.REQUIRED_GOVERNED) {
        blockers.push({
          key: spec.key,
          code: "FIELD_GOVERNANCE_INCOMPLETE",
          message: `Required field ${spec.key} has no governed portal source.`,
        });
      }
      fields.push({
        ...spec,
        governed: false,
        expected: null,
        fill: false,
      });
      continue;
    }

    if (spec.key === "drugsValue" && drugs !== "YES") {
      fields.push({
        ...spec,
        governed: true,
        expected: null,
        fill: false,
        skipped: true,
        reason: "conditional_not_applicable",
      });
      continue;
    }

    if (spec.key === "drugs") {
      if (drugs !== "YES" && drugs !== "NO") {
        blockers.push({
          key: "drugs",
          code: "DRUGS_DECLARATION_UNREVIEWED",
          message: "combined_restricted_declaration must be YES or NO.",
        });
      }
      fields.push({
        ...spec,
        governed: true,
        expected: drugs,
        fill: drugs === "YES" || drugs === "NO",
      });
      continue;
    }

    if (spec.key === "indications") {
      const values = indicationValues(content);
      if (!values.length) {
        blockers.push({
          key: "indications",
          code: "INDICATIONS_EMPTY",
          message: "Governed actions/indications are empty.",
        });
      }
      fields.push({
        ...spec,
        governed: true,
        expected: values,
        fill: values.length > 0,
      });
      continue;
    }

    if (spec.key === "uploadAttachment") {
      const present = content?.evidence?.approved_product_copy_present === true;
      const fileName =
        content?.evidence?.original_file_name ||
        options.approvedFileName ||
        null;
      if (!present) {
        blockers.push({
          key: "uploadAttachment",
          code: "APPROVED_COPY_MISSING",
          message: "Approved product copy is not present in governed evidence.",
        });
      } else if (
        fileName &&
        !namesEqualExact(fileName, EXPECTED_APPROVED_COPY_NAME) &&
        !String(fileName).includes("KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY")
      ) {
        blockers.push({
          key: "uploadAttachment",
          code: "APPROVED_COPY_NAME_MISMATCH",
          message: `Expected approved copy ${EXPECTED_APPROVED_COPY_NAME}.`,
        });
      }
      fields.push({
        ...spec,
        governed: true,
        expected: fileName || EXPECTED_APPROVED_COPY_NAME,
        fill: present,
      });
      continue;
    }

    if (spec.key === "permissionPurpose") {
      const label = getByPath(content, spec.sourcePath);
      if (!normalizeLookupName(label)) {
        blockers.push({
          key: "permissionPurpose",
          code: "PERMISSION_LABEL_MISSING",
          message: "permission_purpose_label is missing.",
        });
      }
      fields.push({
        ...spec,
        governed: true,
        expected: normalizeLookupName(label),
        fill: Boolean(normalizeLookupName(label)),
        resolveMode: "exact_option_label",
      });
      continue;
    }

    const expected = getByPath(content, spec.sourcePath);
    if (expected == null || expected === "") {
      blockers.push({
        key: spec.key,
        code: "FIELD_VALUE_MISSING",
        message: `Governed value missing for ${spec.key}.`,
      });
      fields.push({ ...spec, governed: false, expected: null, fill: false });
      continue;
    }

    fields.push({
      ...spec,
      governed: true,
      expected: typeof expected === "object" ? expected : String(expected),
      fill: true,
    });
  }

  const ok = blockers.length === 0;
  return {
    ok,
    code: ok ? "FIELD_GATE_PASS" : "FIELD_GOVERNANCE_INCOMPLETE",
    message: ok
      ? "Required Product Details governance gate passed."
      : "Required Product Details fields lack governed portal sources.",
    fields,
    blockers,
    expectedPortalProductName: EXPECTED_PORTAL_PRODUCT_NAME,
    expectedApprovedCopyName: EXPECTED_APPROVED_COPY_NAME,
  };
}

function assessRequiredFieldGate(content, options = {}) {
  return buildFillPlan(content, options);
}

module.exports = {
  FIELD_CLASS,
  FIELD_CONTRACT,
  EXPECTED_PORTAL_PRODUCT_NAME,
  EXPECTED_APPROVED_COPY_NAME,
  assertProductLock,
  rejectKuzhambuSubtype,
  resolvePermissionPurposeByExactLabel,
  buildFillPlan,
  assessRequiredFieldGate,
  indicationValues,
};
