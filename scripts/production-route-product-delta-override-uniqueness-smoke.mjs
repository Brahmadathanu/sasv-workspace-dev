/**
 * Gate 4F.5D4-A — Product delta override_step_key edit self-collision.
 * Source/mock only. Does not mutate Product 161 / Route 48 / override 104.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectPrmProductDeltaStepKeys,
  validatePrmProductDeltaMasterIntegrity,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { buildUpsertProductOverrideArgs } from "../public/shared/js/costing-suite-production-route-rpc.js";
import { validatePrmProductDeltaForm } from "../public/shared/js/costing-suite-production-route-delta-form.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const formSrc = read(
  "public/shared/js/costing-suite-production-route-delta-form.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-delta-override-uniqueness-smoke.mjs",
);

const override104 = {
  override_id: 104,
  operation_type: "ADD_STEP",
  override_step_key: "VESSEL_PROCESSING",
  sequence_no: 62,
  activity_id: 1,
  cost_centre_id: 1,
  section_id: 1,
  subsection_id: 1,
  area_id: 1,
  behaviour_code: "INTERMITTENT_ATTENDED",
  resource_class_code: "MANUAL",
  route_step_scope: "PROCESS",
  direct_labour_scope: "INCLUDE",
  production_overhead_scope: "INCLUDE",
  expected_occurrence_count: 1,
  standard_cycle_count: 1,
  override_reason: "Vessel processing for this Product",
};
const override105 = {
  override_id: 105,
  operation_type: "ADD_STEP",
  override_step_key: "OTHER_STEP",
  sequence_no: 70,
};
const catalogues = {
  activities: [
    {
      activity_id: 1,
      section_id: 1,
      subsection_id: 1,
      area_id: 1,
      activity_name: "Vessel processing",
    },
  ],
  cost_centres: [{ cost_centre_id: 1, status: "APPROVED", name: "CC1" }],
  approved_cost_centres: [
    { cost_centre_id: 1, status: "APPROVED", name: "CC1" },
  ],
  behaviours: [
    { behaviour_code: "INTERMITTENT_ATTENDED" },
    { behaviour_code: "FULLY_ATTENDED" },
  ],
  resource_classes: [{ resource_class_code: "MANUAL" }],
};

const editValues = {
  ...override104,
  behaviour_code: "FULLY_ATTENDED",
  override_reason: "Updated manufacturing rationale for attended vessel work",
};

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const createDup = validatePrmProductDeltaForm(
  {
    ...editValues,
    override_step_key: "VESSEL_PROCESSING",
  },
  {
    options: catalogues,
    existingOverrides: [override104, override105],
    effectiveSteps: [{ step_key: "VESSEL_PROCESSING" }],
    excludeOverrideId: null,
  },
);
assert(
  createDup.ok === false &&
    (createDup.errors || []).some((e) =>
      /unique within this Product route/i.test(String(e)),
    ),
  "1 Create duplicate key against another override is rejected",
);

const editSameKey = validatePrmProductDeltaForm(editValues, {
  options: catalogues,
  existingOverrides: [override104, override105],
  effectiveSteps: [
    { step_key: "VESSEL_PROCESSING", sequence_no: 62 },
    { step_key: "OTHER_STEP", override_id: 105 },
  ],
  familySteps: [{ step_key: "RM_ISSUE" }],
  excludeOverrideId: 104,
});
assert(
  editSameKey.ok === true,
  "2 Edit with unchanged key on same override is allowed",
);

const editStealKey = validatePrmProductDeltaForm(
  {
    ...editValues,
    override_step_key: "OTHER_STEP",
  },
  {
    options: catalogues,
    existingOverrides: [override104, override105],
    effectiveSteps: [
      { step_key: "VESSEL_PROCESSING" },
      { step_key: "OTHER_STEP", override_id: 105 },
    ],
    excludeOverrideId: 104,
  },
);
assert(
  editStealKey.ok === false &&
    (editStealKey.errors || []).some((e) =>
      /unique within this Product route/i.test(String(e)),
    ),
  "3 Edit changing key to another row's key is rejected",
);

const editSameSeq = validatePrmProductDeltaForm(
  { ...editValues, sequence_no: 62 },
  {
    options: catalogues,
    existingOverrides: [override104, override105],
    excludeOverrideId: 104,
  },
);
assert(
  editSameSeq.ok === true,
  "4 Edit with unchanged sequence on same override is allowed",
);

const sequenceUniquenessGovernedClientSide =
  /sequence[^\n]{0,80}unique|unique[^\n]{0,80}sequence_no/i.test(
    formSrc +
      helpersSrc.match(
        /export function validatePrmProductDeltaMasterIntegrity[\s\S]*?\nexport function/,
      )?.[0] || "",
  );
const editOtherSeq = validatePrmProductDeltaForm(
  { ...editValues, sequence_no: 70 },
  {
    options: catalogues,
    existingOverrides: [override104, override105],
    excludeOverrideId: 104,
  },
);
assert(
  sequenceUniquenessGovernedClientSide
    ? editOtherSeq.ok === false
    : editOtherSeq.ok === true && !sequenceUniquenessGovernedClientSide,
  "5 sequence uniqueness: self-edit allowed; cross-row only if client-governed",
);

const upsertEdit = buildUpsertProductOverrideArgs({
  product_route_id: 48,
  override_id: 104,
  override: editValues,
});
assert(
  upsertEdit.ok === true &&
    Number(upsertEdit.params?.p_override_id) === 104 &&
    Number(upsertEdit.params?.p_product_route_id) === 48,
  "6 p_override_id is preserved and sent on edit",
);

assert(
  mainSrc.includes("saveProductOverride") &&
    mainSrc.includes("override_id: existing") &&
    editorSrc.includes("buildUpsertProductOverrideArgs({") &&
    /override_id,\s*\n\s*override: clean\[0\]/.test(editorSrc),
  "7 Save edit invokes upsert UPDATE path, not create",
);

assert(
  editorSrc.includes("RPC.productDeltaSave") &&
    mainSrc.includes(
      "normalizePrmIntegerId(existing.override_id ?? existing.id)",
    ),
  "7b edit save passes override_id into upsert",
);

const takenSelf = collectPrmProductDeltaStepKeys({
  overrides: [override104],
  effectiveSteps: [{ step_key: "VESSEL_PROCESSING" }],
  excludeOverrideId: 104,
});
assert(
  !takenSelf.has("VESSEL_PROCESSING"),
  "edit exclude removes override + matching effective self key",
);

const integrity = validatePrmProductDeltaMasterIntegrity(editValues, {
  options: catalogues,
  existingOverrides: [override104],
  effectiveSteps: [{ step_key: "VESSEL_PROCESSING" }],
  excludeOverrideId: 104,
});
assert(integrity.ok === true, "master integrity edit self-key passes");

assert(
  thisSrc.includes("Does not mutate Product 161") &&
    thisSrc.includes("Source/mock only") &&
    thisSrc.includes("validatePrmProductDeltaForm") &&
    thisSrc.includes("buildUpsertProductOverrideArgs") &&
    !/\bcostingRpc\s*\(/.test(thisSrc) &&
    !/\bcreateClient\b/.test(thisSrc),
  "8 no Product 161 / Route 48 live mutation in this smoke",
);

assert(
  /CACHE_NAME = "hub-cache-v318"/.test(swSrc),
  "SW bumped once to hub-cache-v318",
);

if (failed) {
  console.error(
    `production-route-product-delta-override-uniqueness-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-delta-override-uniqueness-smoke: all assertions passed",
);
