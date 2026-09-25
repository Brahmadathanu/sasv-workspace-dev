import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  COMPOSITION_LIVE_ARM_DEFAULT,
  assessCompositionLineAuthority,
  assessCompositionSnapshotAuthority,
  assessFirstLineBootstrap,
  classifyCompositionUnitname,
  compositionLiveArmEnabled,
  parseCompositionRowId,
} = require("../electron/eaushadhi-worker/composition-contract.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260923115648_eaushadhi_reference_mapping_composition_bootstrap.sql"), "utf8");
const api = fs.readFileSync(path.join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const control = fs.readFileSync(path.join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const compositionContractSource = fs.readFileSync(path.join(root, "electron/eaushadhi-worker/composition-contract.js"), "utf8");
const mappingHelperSource = fs.readFileSync(path.join(root, "public/shared/js/eaushadhi-reference-mapping.js"), "utf8");
const mappingHelpers = await import(`data:text/javascript;base64,${Buffer.from(mappingHelperSource).toString("base64")}`);

assert.match(migration, /'REFERENCE'/);
assert.match(
  migration,
  /returns table\(\s*portal_option_id bigint,\s*external_id text,\s*label text,\s*domain_code text,\s*is_active boolean\s*\)/,
);
assert.match(
  migration,
  /select\s+po\.id,\s*po\.external_id,\s*po\.label,\s*po\.domain_code,\s*po\.is_active\s+from regulatory\.portal_option po/,
);
assert.match(
  migration,
  /p_domain_code not in \('INGREDIENT_TYPE','INGREDIENT_FORM','PART_USED','MEASUREMENT_UNIT','REFERENCE'\)/,
);
assert.match(migration, /\('28','Sahasrayoga'\)/);
assert.doesNotMatch(migration, /\('-1',/);
assert.match(migration, /'REFERENCE_WORK',\s*'SAHASRAYOGAM'/);
assert.match(migration, /source_composition_line_id in \(929, 930, 931\)/);
assert.match(migration, /PARENT_WORK_TRANSLITERATION_MATCH/);
assert.match(migration, /mapping_status = 'VERIFIED'/);
assert.match(migration, /rpc_eaushadhi_require_permission\(true\)/);
assert.match(migration, /from public, anon/);
assert.match(migration, /REFERENCE option/);
assert.match(migration, /Only a DRAFT reference mapping may transition to VERIFIED/);
assert.match(migration, /trg_one_verified_reference_mapping/);
assert.match(migration, /case when m\.mapping_status = 'VERIFIED' and po\.is_active then po\.external_id end/);
assert.match(migration, /jsonb_build_object\('portal_value'/);
assert.doesNotMatch(migration, /(?:m|candidate|v_mapping|new)\.is_active/);
assert.doesNotMatch(migration, /comparison_evidence\s*,\s*is_active/);
assert.match(migration, /mapping_status in \('DRAFT', 'VERIFIED'\)/);
assert.match(migration, /effective_from is null/);
assert.match(migration, /effective_to is null/);
assert.match(migration, /source_composition_line_ids bigint\[\]/);
assert.match(migration, /source_reference_by_line jsonb/);
assert.match(migration, /return v_payload \|\| jsonb_build_object\('content_hash', v_hash\)/);
assert.doesNotMatch(migration, /return jsonb_build_object\('payload',\s*v_payload/);
assert.match(migration, /mapping_status,\s*mapping_reason, match_basis, comparison_evidence\s*\)[\s\S]*?'DRAFT'/);
assert.doesNotMatch(migration, /insert into regulatory\.term_portal_mapping[\s\S]{0,1200}verified_by/);
assert.match(migration, /when v_option\.id = v_mapping\.portal_option_id then m\.match_basis/);
assert.match(migration, /when v_option\.id = v_mapping\.portal_option_id then m\.comparison_evidence/);
assert.match(migration, /else 'MANUAL'/);
for (const field of [
  "original_suggested_portal_option_id",
  "original_suggested_external_id",
  "original_suggested_label",
  "verified_portal_option_id",
  "verified_external_id",
  "verified_label",
  "MANUAL_SELECTION",
]) assert.match(migration, new RegExp(field));
assert.match(migration, /v_original_option\.label/);
assert.match(migration, /v_option\.label/);
assert.doesNotMatch(migration, /p_(?:portal_label|match_basis|comparison_evidence)/);

assert.match(api, /fetchPortalOptions\("REFERENCE"\)/);
assert.match(api, /rpc_eaushadhi_reference_mapping_verify/);
assert.match(control, /Source Reference/);
assert.match(control, /Canonical Reference Work/);
assert.match(control, /Reference Governance/);
assert.match(control, /referenceGovernanceLabel\(reference\)/);
assert.doesNotMatch(control, /data-reference-review=/);
assert.doesNotMatch(control, /isReferenceActionOwner/);
assert.doesNotMatch(control, /suggested_reference_work_term_id|selected_reference_work_term_id/);
assert.equal(mappingHelpers.referenceGovernanceLabel({ reference_ready: true }), "Verified globally");
assert.equal(mappingHelpers.referenceGovernanceLabel({ reference_ready: false }), "Global reference mapping required");
assert.equal(mappingHelpers.referenceGovernanceLabel(null), "Global reference mapping required");

const mappings = [
  {
    mapping_id: 10,
    canonical_code: "WORK_A",
    source_composition_line_ids: [929, 930],
    source_reference_by_line: { 929: "Work A - One", 930: "Work A - Two" },
  },
  {
    mapping_id: 20,
    canonical_code: "WORK_B",
    source_composition_line_ids: [931, 940],
    source_reference_by_line: { 931: "Work B - One", 940: "Work B - Two" },
  },
];
const associated = mappingHelpers.associateReferenceMappingsByLine([
  { source_composition_line_id: 929 },
  { source_composition_line_id: 930 },
  { source_composition_line_id: 931 },
  { source_composition_line_id: 999 },
], mappings);
assert.deepEqual(associated.map((line) => line.referenceMapping?.mapping_id ?? null), [10, 10, 20, null]);
assert.deepEqual(associated.map((line) => line.raw_reference_text), ["Work A - One", "Work A - Two", "Work B - One", ""]);
assert.equal(mappingHelpers.associateReferenceMappingsByLine(
  [{ source_composition_line_id: 999 }],
  [{ mapping_id: 10, source_composition_line_ids: [929] }],
)[0].referenceMapping, null);

assert.equal(mappingHelpers.referenceMappingReady({
  mapping_status: "DRAFT",
  portal_external_id: "28",
  reference_ready: false,
}), false);
assert.equal(mappingHelpers.referenceMappingReady({
  mapping_status: "VERIFIED",
  portal_external_id: "",
  reference_ready: true,
}), true);
assert.deepEqual(mappingHelpers.referenceMappingPresentation({
  mapping_status: "DRAFT",
  reference_ready: false,
}), { ready: false, label: "Suggested", reviewable: true });
assert.deepEqual(mappingHelpers.referenceMappingPresentation({
  mapping_status: "VERIFIED",
  reference_ready: true,
}), { ready: true, label: "Verified", reviewable: false });
assert.deepEqual(mappingHelpers.referenceMappingPresentation({
  mapping_status: "VERIFIED",
  reference_ready: false,
}), { ready: false, label: "Verified — not currently usable", reviewable: false });

const governedReadyLine = () => ({
  review_status: "VERIFIED",
  reference: {
    reference_ready: true,
    source_to_canonical_ready: true,
    canonical_to_portal_ready: true,
    alias_mapping_status: "VERIFIED",
    portal_mapping_status: "VERIFIED",
    portal_value: "28",
  },
});
const assessReferenceOverride = (referenceOverride, lineOverride = {}) => {
  const line = governedReadyLine();
  return assessCompositionLineAuthority({
    ...line,
    ...lineOverride,
    reference: { ...line.reference, ...referenceOverride },
  });
};

assert.deepEqual(assessCompositionLineAuthority(governedReadyLine()), {
  ready: true,
  blockers: [],
});
assert.deepEqual(
  assessReferenceOverride({}, { review_status: "IN_REVIEW" }).blockers,
  ["LINE_REVIEW_NOT_VERIFIED"],
);
assert.deepEqual(assessReferenceOverride({ alias_mapping_status: "DRAFT" }).blockers, [
  "REFERENCE_ALIAS_NOT_VERIFIED",
]);
assert.deepEqual(assessReferenceOverride({ portal_mapping_status: "DRAFT" }).blockers, [
  "REFERENCE_PORTAL_NOT_VERIFIED",
]);
assert.deepEqual(assessReferenceOverride({ source_to_canonical_ready: false }).blockers, [
  "REFERENCE_SOURCE_MAPPING_NOT_READY",
]);
assert.deepEqual(assessReferenceOverride({ canonical_to_portal_ready: false }).blockers, [
  "REFERENCE_PORTAL_MAPPING_NOT_READY",
]);
assert.deepEqual(assessReferenceOverride({ reference_ready: false }).blockers, [
  "REFERENCE_NOT_READY",
]);
for (const portalValue of [undefined, null, "", "   ", 28]) {
  assert.deepEqual(assessReferenceOverride({ portal_value: portalValue }).blockers, [
    "REFERENCE_PORTAL_VALUE_MISSING",
  ]);
}
assert.equal(assessCompositionLineAuthority({
  review_status: "VERIFIED",
  reference: { mapping_status: "VERIFIED", portal_value: "28" },
}).ready, false);
assert.equal(assessCompositionLineAuthority({
  review_status: "VERIFIED",
  reference: { source_text: "Sahasrayōgam - Sujanapriya" },
}).ready, false);
assert.deepEqual(assessReferenceOverride({ portal_value: undefined, portal_label: "Sahasrayoga" }).blockers, [
  "REFERENCE_PORTAL_VALUE_MISSING",
]);

const snapshotPass = assessCompositionSnapshotAuthority({
  currentContentHash: "governed-hash-1",
  expectedContentHash: "governed-hash-1",
  compositionLines: [governedReadyLine(), governedReadyLine()],
});
assert.deepEqual(snapshotPass, { ready: true, blockers: [], lineFailures: [] });
assert.deepEqual(assessCompositionSnapshotAuthority({
  expectedContentHash: "governed-hash-1",
  compositionLines: [governedReadyLine()],
}).blockers, ["CONTENT_HASH_MISSING"]);
assert.deepEqual(assessCompositionSnapshotAuthority({
  currentContentHash: "governed-hash-1",
  compositionLines: [governedReadyLine()],
}).blockers, ["EXPECTED_CONTENT_HASH_MISSING"]);
assert.deepEqual(assessCompositionSnapshotAuthority({
  currentContentHash: "governed-hash-2",
  expectedContentHash: "governed-hash-1",
  compositionLines: [governedReadyLine()],
}).blockers, ["CONTENT_HASH_DRIFT"]);
assert.deepEqual(assessCompositionSnapshotAuthority({
  currentContentHash: "governed-hash-1",
  expectedContentHash: "governed-hash-1",
  compositionLines: null,
}).blockers, ["COMPOSITION_LINES_INVALID"]);
const failedLine = governedReadyLine();
failedLine.reference.alias_mapping_status = "DRAFT";
assert.deepEqual(assessCompositionSnapshotAuthority({
  currentContentHash: "governed-hash-1",
  expectedContentHash: "governed-hash-1",
  compositionLines: [governedReadyLine(), failedLine],
}), {
  ready: false,
  blockers: ["COMPOSITION_LINE_AUTHORITY_FAILED"],
  lineFailures: [{ index: 1, blockers: ["REFERENCE_ALIAS_NOT_VERIFIED"] }],
});

assert.equal(parseCompositionRowId("<a onclick=\"GetCompositionDataUpdate('abc_12')\">Edit</a>").rowId, "abc_12");
assert.equal(parseCompositionRowId("<a onclick=\"unknown('12')\">Edit</a>").code, "ROW_ID_CONTRACT_UNPROVEN");
assert.equal(parseCompositionRowId("GetCompositionDataUpdate('1'); GetCompositionDataUpdate('2')").ok, false);
assert.equal(classifyCompositionUnitname("9", "9", "ML").code, "UNITNAME_PORTAL_VALUE");
assert.equal(classifyCompositionUnitname("ML", "9", "ML").code, "UNITNAME_PORTAL_LABEL");
assert.equal(classifyCompositionUnitname("millilitre", "9", "ML").code, "UNITNAME_CONTRACT_UNPROVEN");
assert.equal(assessFirstLineBootstrap({ editMarkup: "bad", reread: {}, expectedUnitValue: "9", expectedUnitLabel: "ML" }).retrySave, false);
assert.equal(assessFirstLineBootstrap({ editMarkup: "GetCompositionDataUpdate('7')", reread: { id: "8", unitname: "9" }, expectedUnitValue: "9", expectedUnitLabel: "ML" }).code, "REREAD_ID_MISMATCH");
assert.equal(COMPOSITION_LIVE_ARM_DEFAULT, false);
assert.equal(compositionLiveArmEnabled({ EAUSHADHI_COMPOSITION_LIVE_ARM: "true" }), false);
assert.doesNotMatch(`${migration}\n${api}\n${control}`, /DeleteCompositionData/);
assert.doesNotMatch(
  compositionContractSource,
  /SaveCompositionData|DeleteCompositionData|AddCompositionData|(?<!Get)CompositionDataUpdate/,
);

console.log("eaushadhi reference mapping + composition bootstrap smoke: PASS");
