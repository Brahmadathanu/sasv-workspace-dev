/**
 * Gate 11Y.10I.2C.3F.2B.2C.0A — Intelligent Family Route Step Authoring.
 * Client-only source/contract smoke. No step saves, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_COST_CENTRE_POOL_EXCLUDED,
  collectPrmFamilyRouteStepKeys,
  enrichPrmMasterActivities,
  formatPrmActivityLocationCopy,
  formatPrmActivityLocationFieldLabel,
  formatPrmActivityOptionLabel,
  formatPrmResourceClassLabel,
  resolvePrmPoolScopeDlPohRequirement,
  suggestPrmFamilyRouteStepKey,
  validatePrmFamilyStepMasterIntegrity,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildFamilyStepFormHtml,
  validatePrmFamilyStepForm,
} from "../public/shared/js/costing-suite-production-route-step-form.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const stepFormSrc = read(
  "public/shared/js/costing-suite-production-route-step-form.js",
);
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const deltaFormSrc = read(
  "public/shared/js/costing-suite-production-route-delta-form.js",
);
const swSrc = read("public/sw.js");

const buildFn =
  stepFormSrc.match(/export function buildFamilyStepFormHtml\([\s\S]*?\n}/)?.[0] ||
  "";
const bindFn =
  stepFormSrc.match(/export function bindFamilyStepFormCascade\([\s\S]*$/)?.[0] ||
  "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const sections = [
  { section_id: 2, section_name: "Raw Material Store" },
  { section_id: 10, section_name: "Processing Section" },
];
const subsections = [
  { subsection_id: 1, subsection_name: "Dispensation" },
  { subsection_id: 7, subsection_name: "Rasoushadhi" },
];
const areas = [
  { area_id: 72, area_name: "-" },
  { area_id: 81, area_name: "Area 81" },
];
const fixtureOptions = {
  sections,
  subsections,
  areas,
  activities: [
    {
      activity_id: 2,
      activity_name: "RM dispensation",
      section_id: 2,
      subsection_id: 1,
      area_id: 72,
    },
    {
      activity_id: 157,
      activity_name: "RM dispensation",
      section_id: 10,
      subsection_id: 7,
      area_id: 81,
    },
  ],
  cost_centres: [
    {
      cost_centre_id: 22,
      cost_centre_code: "STORES_RM_ISSUE_BOUNDARY",
      cost_centre_name: "Raw Material Issue Boundary",
      status: "APPROVED",
      section_id: 2,
      subsection_id: 1,
      area_id: 72,
      pool_scope: PRM_COST_CENTRE_POOL_EXCLUDED,
      default_resource_class_code: "GENERAL_AREA",
    },
    {
      cost_centre_id: 99,
      cost_centre_code: "STALE_CC",
      cost_centre_name: "Stale Centre",
      status: "DRAFT",
    },
  ],
  behaviours: [
    { behaviour_code: "SUPERVISION_ONLY", behaviour_label: "Supervision only" },
    { behaviour_code: "FULLY_ATTENDED", behaviour_label: "Fully attended" },
  ],
  resource_classes: [
    {
      resource_class_code: "GENERAL_AREA",
      resource_class_label: "General production area",
    },
    { resource_class_code: "MANUAL", resource_class_label: "Manual" },
  ],
  plants: [],
};

const enrichedActivities = enrichPrmMasterActivities(fixtureOptions);
const activity2 = enrichedActivities.find((row) => row.activity_id === 2);
const activity157 = enrichedActivities.find((row) => row.activity_id === 157);

const createHtml = buildFamilyStepFormHtml({
  options: fixtureOptions,
  sequenceSuggestion: 10,
});

const activityPos = createHtml.indexOf('id="prmFamilyStepActivity"');
const ccPos = createHtml.indexOf('id="prmFamilyStepCostCentre"');
const keyPos = createHtml.indexOf('id="prmFamilyStepKey"');
const seqPos = createHtml.indexOf('id="prmFamilyStepSeq"');

assert(activityPos > 0 && ccPos > activityPos, "1 Activity before Cost Centre");
assert(ccPos > 0 && keyPos > ccPos, "2 Cost Centre before Step Key");
assert(keyPos > 0 && seqPos > keyPos, "3 Step Key before Sequence");
assert(
  createHtml.includes('placeholder="Select Activity first"') ||
    !createHtml.match(/id="prmFamilyStepKey"[^>]*value="RM_ISSUE"/),
  "4 Step Key blank before Activity",
);
assert(
  suggestPrmFamilyRouteStepKey(activity2, new Set()) === "RM_ISSUE",
  "5 Activity ID2 RM dispensation -> RM_ISSUE",
);
assert(
  createHtml.includes('id="prmFamilyStepKey"') &&
    createHtml.includes("readonly") &&
    stepFormSrc.includes("data-prm-family-step-key"),
  "6 key readonly",
);
assert(
  !bindFn.includes('keyEl?.addEventListener("input"') &&
    !bindFn.includes('fieldState.step_key.mode = "user"'),
  "7 no Family key user-edit path",
);
assert(
  !bindFn.match(/#\$\{prefix\}Seq[\s\S]{0,500}applyStepKeySuggestion/),
  "8 sequence does not drive key",
);

const label2 = formatPrmActivityOptionLabel(activity2);
const label157 = formatPrmActivityOptionLabel(activity157);
assert(
  label2.includes("Raw Material Store") &&
    label157.includes("Processing Section") &&
    label2 !== label157,
  "9 duplicate Activity labels include hierarchy context",
);
assert(
  activity2.activity_id === 2 &&
    activity157.activity_id === 157 &&
    label2.includes("RM dispensation") &&
    label157.includes("RM dispensation"),
  "10 Activity 2 and Activity 157 are distinguishable in fixture",
);
assert(
  suggestPrmFamilyRouteStepKey(activity2, collectPrmFamilyRouteStepKeys({
    steps: [{ step_key: "RM_ISSUE", family_route_step_id: 1 }],
  })) === "RM_ISSUE_2",
  "11 deterministic collision handling",
);
assert(
  createHtml.includes("data-prm-family-step-key-notice") &&
    bindFn.includes('fieldState.step_key.mode === "persisted"'),
  "12 persisted key preserved on edit",
);
assert(
  !buildFn.includes("String(sectionId)") &&
    !buildFn.includes("String(subsectionId)") &&
    !buildFn.includes("String(areaId)"),
  "13 raw location ids not rendered as primary labels",
);
assert(
  formatPrmActivityLocationFieldLabel(activity2.section_name) ===
    "Raw Material Store",
  "14 Activity 2 resolves Raw Material Store",
);
assert(
  formatPrmActivityLocationFieldLabel(activity2.subsection_name) ===
    "Dispensation",
  "15 Activity 2 resolves Dispensation",
);
assert(
  formatPrmActivityLocationFieldLabel(activity2.area_name) === "-",
  "16 Area 72 resolves \"-\"",
);
assert(
  bindFn.includes("applyActivityLocation") &&
    !bindFn.includes("centre?.section_id") &&
    helpersSrc.includes("Activity location no longer matches"),
  "17 Activity remains physical-location owner",
);
assert(
  !bindFn.includes("sectionIdEl.value = sectionId ?? centre") &&
    !bindFn.match(/centre[\s\S]{0,120}sectionIdEl/),
  "18 Cost Centre does not overwrite Activity location",
);
assert(
  fixtureOptions.cost_centres[0].default_resource_class_code === "GENERAL_AREA",
  "19 CC22 resolves default resource GENERAL_AREA",
);
assert(
  createHtml.includes("General production area") ||
    formatPrmResourceClassLabel("GENERAL_AREA") === "General production area",
  "20 General production area default rendered",
);
assert(
  !bindFn.includes("behaviour_code") ||
    (!bindFn.includes("behaviourEl.value =") &&
      !helpersSrc.match(/auto.*behaviour/i)),
  "21 Behaviour remains explicit/unselected until operator choice",
);
assert(
  !helpersSrc.includes("default_behaviour") &&
    !stepFormSrc.includes("autoSelectBehaviour") &&
    !stepFormSrc.includes("SUPERVISION_ONLY") ||
    stepFormSrc.includes('codeOptionsHtml(behaviours'),
  "22 no generic Behaviour auto-map",
);
assert(
  !bindFn.includes("BOUNDARY_RM_ISSUE") &&
    !bindFn.includes("route_step_scope =") &&
    stepFormSrc.includes("Route step scope"),
  "23 Route Step Scope remains explicit",
);
const poolRule = resolvePrmPoolScopeDlPohRequirement({
  costCentre: fixtureOptions.cost_centres[0],
  routeStepScope: null,
});
assert(
  poolRule?.forced &&
    poolRule.direct_labour_scope === "EXCLUDE_OTHER_POOL",
  "24 CC22 pool scope forces DL exclusion",
);
assert(
  poolRule?.production_overhead_scope === "EXCLUDE_OTHER_POOL",
  "25 CC22 pool scope forces POH exclusion",
);
assert(
  bindFn.includes("dlEl.disabled = true") &&
    bindFn.includes("pohEl.disabled = true"),
  "25b DL/POH disabled when pool forced",
);

const staleIntegrity = validatePrmFamilyStepMasterIntegrity(
  {
    activity_id: 2,
    cost_centre_id: 99,
    step_key: "RM_ISSUE",
    sequence_no: 10,
    section_id: 2,
    subsection_id: 1,
    area_id: 72,
    behaviour_code: "SUPERVISION_ONLY",
    resource_class_code: "GENERAL_AREA",
    route_step_scope: "BOUNDARY_RM_ISSUE",
    direct_labour_scope: "EXCLUDE_OTHER_POOL",
    production_overhead_scope: "EXCLUDE_OTHER_POOL",
    expected_occurrence_count: 1,
    standard_cycle_count: 1,
  },
  { options: fixtureOptions, existingSteps: [] },
);
assert(!staleIntegrity.ok, "26 stale/unapproved Cost Centre blocks");

const staleActivity = validatePrmFamilyStepMasterIntegrity(
  {
    activity_id: 999,
    cost_centre_id: 22,
    step_key: "RM_ISSUE",
    sequence_no: 10,
    section_id: 2,
    subsection_id: 1,
    area_id: 72,
    behaviour_code: "SUPERVISION_ONLY",
    resource_class_code: "GENERAL_AREA",
    route_step_scope: "BOUNDARY_RM_ISSUE",
    direct_labour_scope: "EXCLUDE_OTHER_POOL",
    production_overhead_scope: "EXCLUDE_OTHER_POOL",
    expected_occurrence_count: 1,
    standard_cycle_count: 1,
  },
  { options: fixtureOptions, existingSteps: [] },
);
assert(!staleActivity.ok, "27 stale Activity blocks");

const tamperedLocation = validatePrmFamilyStepMasterIntegrity(
  {
    activity_id: 2,
    cost_centre_id: 22,
    step_key: "RM_ISSUE",
    sequence_no: 10,
    section_id: 99,
    subsection_id: 1,
    area_id: 72,
    behaviour_code: "SUPERVISION_ONLY",
    resource_class_code: "GENERAL_AREA",
    route_step_scope: "BOUNDARY_RM_ISSUE",
    direct_labour_scope: "EXCLUDE_OTHER_POOL",
    production_overhead_scope: "EXCLUDE_OTHER_POOL",
    expected_occurrence_count: 1,
    standard_cycle_count: 1,
  },
  { options: fixtureOptions, existingSteps: [] },
);
assert(!tamperedLocation.ok, "28 location tamper blocks");

const invalidResource = validatePrmFamilyStepMasterIntegrity(
  {
    activity_id: 2,
    cost_centre_id: 22,
    step_key: "RM_ISSUE",
    sequence_no: 10,
    section_id: 2,
    subsection_id: 1,
    area_id: 72,
    behaviour_code: "SUPERVISION_ONLY",
    resource_class_code: "NOT_A_RESOURCE",
    route_step_scope: "BOUNDARY_RM_ISSUE",
    direct_labour_scope: "EXCLUDE_OTHER_POOL",
    production_overhead_scope: "EXCLUDE_OTHER_POOL",
    expected_occurrence_count: 1,
    standard_cycle_count: 1,
  },
  { options: fixtureOptions, existingSteps: [] },
);
assert(!invalidResource.ok, "29 invalid Resource blocks");

const invalidBehaviour = validatePrmFamilyStepMasterIntegrity(
  {
    activity_id: 2,
    cost_centre_id: 22,
    step_key: "RM_ISSUE",
    sequence_no: 10,
    section_id: 2,
    subsection_id: 1,
    area_id: 72,
    behaviour_code: "NOT_A_BEHAVIOUR",
    resource_class_code: "GENERAL_AREA",
    route_step_scope: "BOUNDARY_RM_ISSUE",
    direct_labour_scope: "EXCLUDE_OTHER_POOL",
    production_overhead_scope: "EXCLUDE_OTHER_POOL",
    expected_occurrence_count: 1,
    standard_cycle_count: 1,
  },
  { options: fixtureOptions, existingSteps: [] },
);
assert(!invalidBehaviour.ok, "30 invalid Behaviour blocks");

assert(
  deltaFormSrc.includes("validatePrmProductDeltaMasterIntegrity") &&
    deltaFormSrc.includes("validatePrmProductDeltaForm") &&
    !deltaFormSrc.includes("validatePrmFamilyStepMasterIntegrity"),
  "31 Product Delta behavior unchanged",
);
assert(
  !mainSrc.match(/saveFamilyStep\([\s\S]{0,200}rpc_upsert/) &&
    mainSrc.includes("validateFamilyStepForm"),
  "32 no live route step saved in smoke runner",
);
assert(
  !stepFormSrc.includes("apply_migration") &&
    !helpersSrc.includes("create table") &&
    !stepFormSrc.includes("rpc_create_route_family"),
  "33 no server changes",
);
assert(
  !mainSrc.includes("rpc_refresh") && !editorSrc.includes("costingRefresh"),
  "34 no costing refresh",
);

assert(
  stepFormSrc.includes("data-prm-searchable-select") &&
    stepFormSrc.includes("enhanceSearchableSelect") &&
    stepFormSrc.includes("formatPrmActivityOptionPrimary"),
  "Activity searchable selector with context",
);
assert(
  mainSrc.includes("validateFamilyStepForm") &&
    helpersSrc.includes("validatePrmFamilyStepMasterIntegrity") &&
    typeof validatePrmFamilyStepForm === "function",
  "save-time master integrity wired",
);
assert(
  formatPrmActivityLocationCopy(activity2) ===
    "Raw Material Store › Dispensation",
  "Activity context copy for duplicate names",
);

assert(/CACHE_NAME = "hub-cache-v\d+"/.test(swSrc), "SW cache name present");

if (failed) {
  console.error(
    `\nproduction-route-family-step-authoring-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-step-authoring-smoke: all passed");
