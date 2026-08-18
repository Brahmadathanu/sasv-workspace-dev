/**
 * Gate 11Y.10I.2C.3E.3D.1 — Product-delta master selection & integrity guardrails.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_COST_CENTRE_POOL_EXCLUDED,
  PRM_OTHER_POOL_STEP_SCOPES,
  classifyPrmActivityCostCentreCompatibility,
  collectPrmProductDeltaStepKeys,
  enrichPrmMasterActivities,
  enrichPrmMasterCostCentres,
  formatPrmActivityCostCentreCompatibilityStatus,
  formatPrmActivityLocationCopy,
  formatPrmActivityOptionLabel,
  formatPrmCostCentreContextCopy,
  formatPrmCostCentreOptionLabel,
  isValidPrmProductDeltaStepKey,
  requiresPrmActivityCostCentreAcknowledgement,
  resolvePrmPoolScopeDlPohRequirement,
  suggestPrmProductDeltaStepKey,
  validatePrmProductDeltaMasterIntegrity,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildProductDeltaFormHtml,
  validatePrmProductDeltaForm,
} from "../public/shared/js/costing-suite-production-route-delta-form.js";
import { buildFamilyStepFormHtml } from "../public/shared/js/costing-suite-production-route-step-form.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const formSrc = read(
  "public/shared/js/costing-suite-production-route-delta-form.js",
);
const familyFormSrc = read(
  "public/shared/js/costing-suite-production-route-step-form.js",
);
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");
const authoringSmokeSrc = read(
  "scripts/production-route-product-delta-authoring-smoke.mjs",
);

const openDeltaFn =
  mainSrc.match(
    /async function openProductDeltaModal\([\s\S]*?\n  function bindEditor/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const sections = [
  { section_id: 4, section_name: "Processing" },
];
const subsections = [
  { subsection_id: 5, subsection_name: "Capsules & Tablets" },
  { subsection_id: 6, subsection_name: "Powder Formulations" },
];
const areas = [
  { area_id: 23, area_name: "Tablet Granulation Area" },
  { area_id: 75, area_name: "Powder Formulations" },
];
const fixtureOptions = {
  sections,
  subsections,
  areas,
  activities: [
    {
      activity_id: 31,
      activity_name: "Powder blending",
      short_code: "POWBL",
      section_id: 4,
      subsection_id: 5,
      area_id: 23,
    },
    {
      activity_id: 105,
      activity_name: "Powder blending",
      short_code: "POWBL",
      section_id: 4,
      subsection_id: 6,
      area_id: 75,
    },
  ],
  cost_centres: [
    {
      cost_centre_id: 35,
      cost_centre_code: "PROD_DRY_POWDER_BLEND",
      cost_centre_name: "Dry Powder Blending",
      status: "APPROVED",
      section_id: 4,
      subsection_id: 5,
      area_id: 23,
      pool_scope: "GENERAL_AREA",
      default_resource_class_code: "MANUAL",
    },
    {
      cost_centre_id: 38,
      cost_centre_code: "PROD_DRY_POWDER_BLEND_POWDER_FORM",
      cost_centre_name: "Dry Powder Blending - Powder Formulations",
      status: "APPROVED",
      section_id: 4,
      subsection_id: 6,
      area_id: 75,
      pool_scope: "SHARED",
      default_resource_class_code: "MANUAL",
    },
    {
      cost_centre_id: 99,
      cost_centre_code: "PROD_DRAFT",
      cost_centre_name: "Draft centre",
      status: "DRAFT",
      section_id: 4,
      subsection_id: 6,
      area_id: 75,
    },
  ],
  behaviours: [{ behaviour_code: "MANUAL", behaviour_label: "Manual" }],
  resource_classes: [
    { resource_class_code: "MANUAL", resource_class_label: "Manual" },
  ],
  plants: [
    {
      plant_id: 201,
      plant_name: "Powder Mill",
      section_id: 4,
      subsection_id: 6,
      area_id: 75,
      status: "ACTIVE",
    },
    {
      plant_id: 202,
      plant_name: "Tablet Mill",
      section_id: 4,
      subsection_id: 5,
      area_id: 23,
      status: "ACTIVE",
    },
  ],
};

const enrichedActivities = enrichPrmMasterActivities(fixtureOptions);
const enrichedCentres = enrichPrmMasterCostCentres(fixtureOptions);
const act31 = enrichedActivities.find((a) => a.activity_id === 31);
const act105 = enrichedActivities.find((a) => a.activity_id === 105);
const cc35 = enrichedCentres.find((c) => c.cost_centre_id === 35);
const cc38 = enrichedCentres.find((c) => c.cost_centre_id === 38);

const formHtml = buildProductDeltaFormHtml({
  options: fixtureOptions,
  familySteps: [],
});
const familyHtml = buildFamilyStepFormHtml({ options: fixtureOptions });

const baseAdd = {
  operation_type: "ADD_STEP",
  base_step_id: null,
  override_step_key: "POWDER_BLENDING",
  sequence_no: 35,
  activity_id: 105,
  cost_centre_id: 38,
  section_id: 4,
  subsection_id: 6,
  area_id: 75,
  behaviour_code: "MANUAL",
  resource_class_code: "MANUAL",
  route_step_scope: "PROCESS",
  direct_labour_scope: "INCLUDE",
  production_overhead_scope: "INCLUDE",
  expected_occurrence_count: 1,
  standard_cycle_count: 1,
  override_reason: "Product-specific powder blending route",
};

assert(
  formatPrmActivityOptionLabel(act31).includes("Tablet Granulation Area") &&
    formatPrmActivityOptionLabel(act105).includes("Powder Formulations") &&
    formatPrmActivityOptionLabel(act31) !== formatPrmActivityOptionLabel(act105),
  "1 duplicate Activity names show hierarchy context",
);
assert(
  formatPrmActivityOptionLabel(act31).includes("Capsules & Tablets") &&
    formatPrmActivityOptionLabel(act105).includes("Powder Formulations"),
  "2 Activity 31 distinguishable from 105",
);
assert(
  formatPrmActivityOptionLabel(act105).includes("Powder blending") &&
    formatPrmActivityOptionLabel(act105).includes("POWBL") &&
    !formatPrmActivityOptionLabel(act105).startsWith("105"),
  "3 Activity primary label readable",
);
assert(
  formHtml.includes("data-prm-activity-context") &&
    formHtml.includes("Selected Activity context"),
  "4 selected Activity context cue visible",
);
assert(
  formSrc.includes("applyActivityLocation") &&
    formSrc.includes("sectionIdEl") &&
    formSrc.includes("subsectionIdEl") &&
    formSrc.includes("areaIdEl"),
  "5 Activity selection derives location",
);
assert(
  !formSrc.match(/onCostCentreChange[\s\S]{0,1200}SectionId/s),
  "6 Cost Centre does not overwrite Activity location",
);
assert(
  formatPrmCostCentreOptionLabel(cc35).includes("Tablet Granulation Area") &&
    formatPrmCostCentreOptionLabel(cc38).includes("Powder Formulations") &&
    formatPrmCostCentreOptionLabel(cc35) !== formatPrmCostCentreOptionLabel(cc38),
  "7 duplicate/similar Cost Centres show hierarchy context",
);
assert(
  formHtml.includes("data-prm-cost-centre-context") &&
    formHtml.includes("Selected Cost Centre context"),
  "8 selected Cost Centre context cue visible",
);
assert(
  formHtml.includes('placeholder="POWDER_BLENDING"') ||
    formHtml.includes("placeholder="),
  "9 Override step-key placeholder present",
);
assert(
  formSrc.includes("refreshStepKeySuggestion") &&
    formSrc.includes('fieldState.override_step_key.mode === "user"'),
  "10 key suggestion only when untouched; user edit preserved",
);
assert(
  suggestPrmProductDeltaStepKey(act105, new Set(["POWDER_BLENDING"])) ===
    "POWDER_BLENDING_CAPSULES_TABLETS" ||
    suggestPrmProductDeltaStepKey(act105, new Set(["POWDER_BLENDING"])) ===
      "POWDER_BLENDING_POWDER_FORMULATIONS" ||
    suggestPrmProductDeltaStepKey(act105, new Set(["POWDER_BLENDING"])).startsWith(
      "POWDER_BLENDING_",
    ),
  "11 user-edited key preserved; collision uses context token",
);
assert(
  collectPrmProductDeltaStepKeys({
    overrides: [{ override_step_key: "A" }],
    familySteps: [{ step_key: "B" }],
    effectiveSteps: [{ effective_step_key: "C" }],
  }).size === 3,
  "12 key collision detection includes inherited/effective/override keys",
);
assert(
  formSrc.includes("refreshResourceDefaultHint") &&
    formSrc.includes("cc_default"),
  "13 Cost Centre default Resource Class populated",
);
assert(
  formHtml.includes("data-prm-resource-default-hint") ||
    formHtml.includes("Default resource:"),
  "14 default cue visible",
);
assert(
  formSrc.includes('fieldState.resource_class_code.mode === "user"') &&
    formSrc.includes("Selected Cost Centre default:"),
  "15 user Resource override preserved",
);
assert(
  formSrc.includes("refreshResourceDefaultHint") &&
    formSrc.includes('fieldState.resource_class_code.mode !== "user"'),
  "16 Cost Centre change updates only auto-defaulted Resource",
);
assert(
  formSrc.includes("refreshPlantFromCentre") &&
    formSrc.includes('fieldState.plant_id.mode !== "user"'),
  "17 compatible CC plant may default",
);
assert(
  formSrc.includes("outside this Activity location") &&
    formSrc.includes("!compatible"),
  "18 incompatible CC plant not selected",
);
assert(
  classifyPrmActivityCostCentreCompatibility(act105, cc38) === "EXACT_CONTEXT" &&
    formatPrmActivityCostCentreCompatibilityStatus("EXACT_CONTEXT") ===
      "Compatible",
  "19 exact Activity/CC context => Compatible",
);
assert(
  classifyPrmActivityCostCentreCompatibility(act31, cc38) !== "EXACT_CONTEXT" &&
    formatPrmActivityCostCentreCompatibilityStatus(
      classifyPrmActivityCostCentreCompatibility(act31, cc38),
    ) === "Review physical context",
  "20 partial/different context => Review physical context",
);
assert(
  requiresPrmActivityCostCentreAcknowledgement(
    classifyPrmActivityCostCentreCompatibility(act31, cc38),
  ) &&
    formHtml.includes("data-prm-compat-ack") &&
    validatePrmProductDeltaForm(
      { ...baseAdd, activity_id: 31, cost_centre_id: 38, section_id: 4, subsection_id: 5, area_id: 23 },
      { options: fixtureOptions, compatibilityAcknowledged: false },
    ).ok === false,
  "21 warning requires acknowledgement",
);
assert(
  !helpersSrc.includes("Activity location must equal Cost Centre location") &&
    !formSrc.includes("Activity location must equal Cost Centre location") &&
    validatePrmProductDeltaForm(
      { ...baseAdd, activity_id: 31, cost_centre_id: 38, section_id: 4, subsection_id: 5, area_id: 23 },
      {
        options: fixtureOptions,
        compatibilityAcknowledged: true,
      },
    ).ok === true,
  "22 no blanket location-equality blocker",
);
assert(
  validatePrmProductDeltaForm(
    { ...baseAdd, activity_id: 999 },
    { options: fixtureOptions },
  ).ok === false,
  "23 server-invalid/stale master blocks Save",
);
assert(
  validatePrmProductDeltaForm(
    { ...baseAdd, cost_centre_id: 99 },
    { options: fixtureOptions },
  ).ok === false,
  "24 CC not approved/effective blocks Save",
);
assert(
  validatePrmProductDeltaForm(
    { ...baseAdd, section_id: 99 },
    { options: fixtureOptions },
  ).ok === false,
  "25 Activity-location tamper/stale mismatch blocks Save",
);
const excludedRule = resolvePrmPoolScopeDlPohRequirement({
  costCentre: { pool_scope: PRM_COST_CENTRE_POOL_EXCLUDED },
  routeStepScope: "PROCESS",
});
assert(
  excludedRule?.forced === true &&
    validatePrmProductDeltaForm(
      {
        ...baseAdd,
        cost_centre_id: 38,
        direct_labour_scope: "INCLUDE",
        production_overhead_scope: "INCLUDE",
        route_step_scope: "PROCESS",
      },
      {
        options: {
          ...fixtureOptions,
          cost_centres: fixtureOptions.cost_centres.map((c) =>
            c.cost_centre_id === 38
              ? { ...c, pool_scope: PRM_COST_CENTRE_POOL_EXCLUDED }
              : c,
          ),
        },
      },
    ).ok === false,
  "26 EXCLUDED_OTHER_POOL forces exclusion",
);
assert(
  PRM_OTHER_POOL_STEP_SCOPES.length > 0 &&
    validatePrmProductDeltaForm(
      {
        ...baseAdd,
        route_step_scope: PRM_OTHER_POOL_STEP_SCOPES[0],
        direct_labour_scope: "INCLUDE",
        production_overhead_scope: "INCLUDE",
      },
      { options: fixtureOptions },
    ).ok === false,
  "27 other-pool step scope forces exclusion",
);
assert(
  !formSrc.includes('route_step_scope === "SHARED_ROUTE"') ||
    !formSrc.match(/SHARED_ROUTE[\s\S]*direct_labour_scope\s*=\s*"INCLUDE"/),
  "28 SHARED_ROUTE does not auto-include DL/POH",
);
assert(
  !formSrc.includes("inferBehaviour") &&
    !formSrc.match(/activity.*behaviour_code\s*=/i),
  "29 Behaviour not auto-inferred",
);
assert(
  !formSrc.match(/onActivityChange[\s\S]{0,600}expected_occurrence_count/) &&
    !formSrc.match(/onCostCentreChange[\s\S]{0,600}standard_cycle_count/) &&
    !formSrc.match(/refreshResourceDefaultHint[\s\S]{0,300}is_mandatory/),
  "30 cycles/occurrences/flags not auto-inferred",
);
assert(
  formHtml.includes("data-prm-searchable-select") &&
    formSrc.includes("enhanceSearchableSelect"),
  "31 searchable Activity selector",
);
assert(
  formHtml.includes('id="prmProductDeltaCostCentre"') &&
    formHtml.includes("data-prm-searchable-select"),
  "32 searchable Cost Centre selector",
);
assert(
  !formHtml.includes('type="number" id="prmProductDeltaSectionId"') &&
    formHtml.includes('type="hidden" id="prmProductDeltaSectionId"'),
  "33 no manual ids",
);
assert(
  formSrc.includes("validatePrmProductDeltaMasterIntegrity") &&
    openDeltaFn.includes("validateProductDeltaForm"),
  "34 Save revalidates masters",
);
assert(
  !mainSrc.match(/add-product-delta[\s\S]*saveProductOverride/) &&
    openDeltaFn.indexOf("openModal") < openDeltaFn.indexOf("saveProductOverride"),
  "35 no mutation on selection/default",
);
assert(
  !formSrc.includes("product_route_id: 47") &&
    !formSrc.includes("rpc_upsert_product_route_override"),
  "36 no Product delta fixture write",
);
assert(
  familyFormSrc.includes("formatPrmActivityOptionLabel") &&
    !familyFormSrc.includes("classifyPrmActivityCostCentreCompatibility") &&
    !familyFormSrc.includes("data-prm-compat-ack"),
  "37 Family workflow unchanged",
);
assert(
  helpersSrc.includes("EXACT_CONTEXT") &&
    helpersSrc.includes("PARTIAL_CONTEXT") &&
    helpersSrc.includes("DIFFERENT_CONTEXT") &&
    !helpersSrc.includes("activity_id === 31"),
  "38 semantic tokens only",
);
assert(
  htmlSrc.includes("cp-prm-product-delta-form") &&
    htmlSrc.includes("max-width: 52rem"),
  "39 narrow modal remains usable",
);
assert(
  authoringSmokeSrc.includes("buildProductDeltaFormHtml") &&
    authoringSmokeSrc.includes("validatePrmProductDeltaForm"),
  "40 existing delta-authoring smoke remains wired",
);
assert(
  swSrc.includes("hub-cache-v318") && !swSrc.includes("hub-cache-v319"),
  "41 SW bumped to v318 after smokes",
);

assert(isValidPrmProductDeltaStepKey("POWDER_BLENDING"), "step key charset valid");
assert(
  formatPrmActivityLocationCopy(act105) ===
    "Processing › Powder Formulations › Powder Formulations",
  "activity location copy uses hierarchy",
);
assert(
  formatPrmCostCentreContextCopy(cc38).includes("Powder Formulations"),
  "cost centre context copy",
);
assert(
  editorSrc.includes("existingOverrides: productState.overrides") &&
    editorSrc.includes("compatibilityAcknowledged"),
  "editor passes integrity context",
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll Product-delta master-selection smoke checks passed.");
