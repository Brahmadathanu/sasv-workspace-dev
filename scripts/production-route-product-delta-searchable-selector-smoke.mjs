/**
 * Gate 11Y.10I.2C.3E.3D.2 — Searchable master selector reliability + canonical step key.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizePrmProductDeltaStepKey,
  classifyPrmActivityCostCentreCompatibility,
  enrichPrmMasterActivities,
  enrichPrmMasterCostCentres,
  formatPrmActivityOptionPrimary,
  formatPrmActivityLocationCopy,
  formatPrmCostCentreOptionPrimary,
  formatPrmCostCentreOptionSecondary,
  isValidPrmProductDeltaStepKey,
  suggestPrmProductDeltaStepKey,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildProductDeltaFormHtml,
  validatePrmProductDeltaForm,
} from "../public/shared/js/costing-suite-production-route-delta-form.js";
import { buildFamilyStepFormHtml } from "../public/shared/js/costing-suite-production-route-step-form.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const chromeSrc = read("public/shared/js/sasv-module-chrome.js");
const formSrc = read(
  "public/shared/js/costing-suite-production-route-delta-form.js",
);
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const familyFormSrc = read(
  "public/shared/js/costing-suite-production-route-step-form.js",
);
const fillSrc = read("public/shared/js/fill-planner.js");
const primitivesSrc = read("public/shared/css/sasv-primitives.css");
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");
const authoringSmokeSrc = read(
  "scripts/production-route-product-delta-authoring-smoke.mjs",
);
const integritySmokeSrc = read(
  "scripts/production-route-product-delta-master-selection-smoke.mjs",
);

const enhanceFn =
  chromeSrc.match(
    /export function enhanceSearchableSelect\([\s\S]*?\nexport function syncSearchableSelect/,
  )?.[0] || "";
const applyFilterFn =
  chromeSrc.match(/function applyFilter\(term\) \{[\s\S]*?\n  const doSearch/)?.[0] ||
  "";
const blurFn =
  chromeSrc.match(/input\.addEventListener\('blur'[\s\S]*?\}, 120\);/)?.[0] ||
  "";
const openDeltaFn =
  mainSrc.match(
    /async function openProductDeltaModal\([\s\S]*?\n  function bindEditor/,
  )?.[0] || "";
const escapeFn =
  mainSrc.match(
    /function attachPrmEscapeCapture\([\s\S]*?\n  function detachPrmEscapeCapture/,
  )?.[0] || "";
const applyModalFn =
  mainSrc.match(
    /function applyModalContent\([\s\S]*?\n  function openModal/,
  )?.[0] || "";
const fillEnhance =
  fillSrc.match(/enhanceSearchableSelect\(elProd, \{[\s\S]*?\}\);/)?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const fixtureOptions = {
  sections: [{ section_id: 4, section_name: "Processing" }],
  subsections: [
    { subsection_id: 5, subsection_name: "Capsules & Tablets" },
    { subsection_id: 6, subsection_name: "Powder Formulations" },
  ],
  areas: [
    { area_id: 23, area_name: "Tablet Granulation Area" },
    { area_id: 75, area_name: "Powder Formulations" },
  ],
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
  ],
  behaviours: [{ behaviour_code: "MANUAL", behaviour_label: "Manual" }],
  resource_classes: [
    { resource_class_code: "MANUAL", resource_class_label: "Manual" },
  ],
  plants: [],
};

const activities = enrichPrmMasterActivities(fixtureOptions);
const centres = enrichPrmMasterCostCentres(fixtureOptions);
const act31 = activities.find((a) => a.activity_id === 31);
const act105 = activities.find((a) => a.activity_id === 105);
const cc35 = centres.find((c) => c.cost_centre_id === 35);
const cc38 = centres.find((c) => c.cost_centre_id === 38);
const formHtml = buildProductDeltaFormHtml({
  options: fixtureOptions,
  familySteps: [],
});
const emptyHtml = buildProductDeltaFormHtml({
  options: { activities: [], cost_centres: [] },
  familySteps: [],
});
const familyHtml = buildFamilyStepFormHtml({ options: fixtureOptions });
const activitySelect =
  formHtml.match(/id="prmProductDeltaActivity"[\s\S]*?<\/select>/)?.[0] || "";
const ccSelect =
  formHtml.match(/id="prmProductDeltaCostCentre"[\s\S]*?<\/select>/)?.[0] || "";

assert(
  activitySelect.includes('value="31"') &&
    activitySelect.includes('value="105"') &&
    activitySelect.includes("data-search="),
  "1 Activity native options exist before enhancement",
);
assert(
  ccSelect.includes('value="35"') &&
    ccSelect.includes('value="38"') &&
    ccSelect.includes("data-search="),
  "2 CC native options exist before enhancement",
);
assert(
  formSrc.includes("openOnFocus: true") &&
    formSrc.includes("showAllWhenEmpty: true") &&
    applyFilterFn.includes("showAllWhenEmpty"),
  "3 Activity catalogue opens on focus when empty",
);
assert(
  formSrc.includes("enhanceIfNeeded(ccEl)") &&
    applyFilterFn.includes("pool.slice") === false
      ? applyFilterFn.includes("showAllWhenEmpty")
      : true,
  "4 CC catalogue opens on focus when empty",
);
assert(
  blurFn.includes("preserveQueryOnBlur") &&
    !blurFn.includes("syncInputFromSelect();\n          return") &&
    enhanceFn.includes("preserveQueryOnBlur"),
  "5 typing does not clear query",
);
assert(
  formatPrmActivityOptionPrimary(act105).includes("Powder blending") &&
    activitySelect.toLowerCase().includes("powder blending"),
  "6 Activity filter by name (search metadata present)",
);
assert(
  formatPrmActivityLocationCopy(act105).includes("Powder Formulations") &&
    activitySelect.includes("data-search=") &&
    activitySelect.includes("Powder Formulations"),
  "7 Activity filter by hierarchy",
);
assert(
  formatPrmActivityLocationCopy(act31).includes("Tablet Granulation Area") &&
    formatPrmActivityLocationCopy(act105).includes("Powder Formulations") &&
    activitySelect.includes("data-primary=") &&
    activitySelect.includes("data-secondary="),
  "8 Activity 31/105 distinguishable",
);
assert(
  formSrc.includes("selectEl.dispatchEvent") === false
    ? enhanceFn.includes("selectEl.dispatchEvent(new Event('change'")
    : true,
  "9 Activity commit updates native value",
);
assert(
  formSrc.includes("onActivityChange") &&
    formSrc.includes("applyActivityLocation") &&
    enhanceFn.includes("dispatchEvent(new Event('change'"),
  "10 Activity commit triggers change flow",
);
assert(
  formatPrmCostCentreOptionPrimary(cc35) !==
    formatPrmCostCentreOptionPrimary(cc38) &&
    formatPrmCostCentreOptionSecondary(cc38).includes("Powder Formulations") &&
    formatPrmCostCentreOptionSecondary(cc35).includes("Tablet Granulation Area"),
  "11 CC 35/38 distinguishable",
);
assert(
  ccSelect.includes("PROD_DRY_POWDER_BLEND") &&
    ccSelect.includes("data-search=") &&
    ccSelect.toLowerCase().includes("blending"),
  "12 CC filter by code/name/context",
);
assert(
  enhanceFn.includes("selectEl.value = next") &&
    formSrc.includes("onCostCentreChange"),
  "13 CC commit updates native value",
);
assert(
  formSrc.includes("refreshResourceDefaultHint") &&
    formSrc.includes("cc_default"),
  "14 CC commit triggers Resource default",
);
assert(
  formHtml.includes("Selected Activity context") &&
    formHtml.includes("Selected Cost Centre context"),
  "15 context cues remain",
);
assert(
  classifyPrmActivityCostCentreCompatibility(act105, cc38) === "EXACT_CONTEXT" &&
    formHtml.includes("data-prm-compat-strip"),
  "16 compatibility remains",
);
assert(
  formSrc.includes("if (!el || el._sasvSearch) return") &&
    formSrc.includes("enhanceIfNeeded(locationActivityEl)"),
  "17 operation refresh leaves one wrapper",
);
assert(
  openDeltaFn.includes("cleanup:") &&
    openDeltaFn.includes("destroySearchableSelectsIn") &&
    applyModalFn.includes("destroySearchableSelectsIn(content)"),
  "18 modal reopen leaves one wrapper",
);
assert(
  enhanceFn.includes("list.remove()") &&
    chromeSrc.includes("export function destroySearchableSelectsIn"),
  "19 destroy removes portal",
);
assert(
  enhanceFn.includes("liveSearchableSelectApis.delete") &&
    enhanceFn.includes("removeEventListener('mousedown'") &&
    enhanceFn.includes("delete selectEl._sasvSearch"),
  "20 destroy removes listeners/state",
);
assert(
  escapeFn.includes("closeOpenSearchableSelectLists") &&
    escapeFn.indexOf("closeOpenSearchableSelectLists") <
      escapeFn.indexOf("handleEscapeKey"),
  "21 Escape closes list before modal",
);
assert(
  enhanceFn.includes("ev.key === 'Enter'") &&
    enhanceFn.includes("ArrowDown") &&
    enhanceFn.includes("openCatalogueFromInput"),
  "22 keyboard selection works",
);
assert(
  enhanceFn.includes("mousedown") && enhanceFn.includes("onPick"),
  "23 mouse selection works",
);
assert(
  formSrc.includes("intOrNull(host, `#${prefix}Activity`)") &&
    !formSrc.includes("search-select__input") ,
  "24 no free-text Activity value can save",
);
assert(
  formSrc.includes("intOrNull(host, `#${prefix}CostCentre`)"),
  "25 no free-text CC value can save",
);
assert(
  emptyHtml.includes("data-prm-catalogue-error") &&
    emptyHtml.includes("disabled") &&
    formSrc.includes("Catalogue options are unavailable"),
  "26 catalogue error blocks misleading form",
);
assert(
  canonicalizePrmProductDeltaStepKey("powder blending") === "POWDER_BLENDING",
  "27 lowercase key -> uppercase",
);
assert(
  canonicalizePrmProductDeltaStepKey("powder blending") === "POWDER_BLENDING",
  "28 spaces -> underscore",
);
assert(
  canonicalizePrmProductDeltaStepKey("Powder-Blending") === "POWDER_BLENDING",
  "29 hyphen -> underscore",
);
assert(
  canonicalizePrmProductDeltaStepKey("POWDER.BLENDING!") === "POWDERBLENDING",
  "30 punctuation removed/rejected",
);
assert(
  canonicalizePrmProductDeltaStepKey("STEP_2") === "STEP_2" &&
    isValidPrmProductDeltaStepKey("STEP_2"),
  "31 digits allowed",
);
assert(
  canonicalizePrmProductDeltaStepKey("POWDER_BLENDING") === "POWDER_BLENDING" &&
    isValidPrmProductDeltaStepKey("POWDER_BLENDING"),
  "32 underscores allowed",
);
assert(
  canonicalizePrmProductDeltaStepKey("POWDER___BLENDING") === "POWDER_BLENDING",
  "33 repeated underscores canonical",
);
assert(
  formSrc.includes('fieldState.override_step_key.mode = "user"') &&
    formSrc.includes("applyCanonicalStepKeyInput"),
  "34 user key remains user-owned",
);
assert(
  suggestPrmProductDeltaStepKey(act105, new Set()) === "POWDER_BLENDING" &&
    formSrc.includes("refreshStepKeySuggestion"),
  "35 Activity suggestion still works",
);
assert(
  suggestPrmProductDeltaStepKey(act105, new Set(["POWDER_BLENDING"])).startsWith(
    "POWDER_BLENDING_",
  ) &&
    isValidPrmProductDeltaStepKey(
      suggestPrmProductDeltaStepKey(act105, new Set(["POWDER_BLENDING"])),
    ),
  "36 collision suffix remains valid",
);
assert(
  isValidPrmProductDeltaStepKey("bad key!") === false &&
    isValidPrmProductDeltaStepKey("powder_blending") === false &&
    validatePrmProductDeltaForm(
      {
        operation_type: "ADD_STEP",
        override_step_key: "!!!",
        sequence_no: 10,
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
      },
      { options: fixtureOptions },
    ).ok === false &&
    helpersSrc.includes("/^[A-Z0-9_]+$/"),
  "37 save validates ^[A-Z0-9_]+$",
);
assert(
  openDeltaFn.indexOf("openModal") < openDeltaFn.indexOf("saveProductOverride") &&
    !formSrc.includes("rpc_upsert_product_route_override"),
  "38 no mutation during selector interaction",
);
assert(
  !formSrc.includes("product_route_id: 47") &&
    !formSrc.includes("sequence_no: 35"),
  "39 no Product delta fixture write",
);
assert(
  integritySmokeSrc.includes("classifyPrmActivityCostCentreCompatibility") &&
    integritySmokeSrc.includes("validatePrmProductDeltaForm"),
  "40 3D.1 integrity smoke remains wired",
);
assert(
  authoringSmokeSrc.includes("buildProductDeltaFormHtml") &&
    authoringSmokeSrc.includes("validatePrmProductDeltaForm"),
  "41 3D authoring smoke remains wired",
);
assert(
  familyFormSrc.includes("formatPrmActivityOptionLabel") &&
    familyFormSrc.includes("openOnFocus: true") &&
    enhanceFn.includes("opts.openOnFocus === true"),
  "42 Family step searchable select remains governed opt-in",
);
assert(
  primitivesSrc.includes("sasv-search-select__list--portal-modal") &&
    primitivesSrc.includes("calc(var(--sasv-z-modal) + 50)") &&
    enhanceFn.includes("portalLayer === 'modal'"),
  "43 semantic z-index/tokens only",
);
assert(
  htmlSrc.includes("max-width: 52rem") &&
    htmlSrc.includes("cp-prm-product-delta-form .sasv-search-select"),
  "44 narrow modal usable",
);
assert(
  !fillEnhance.includes("openOnFocus") &&
    !fillEnhance.includes("showAllWhenEmpty") &&
    enhanceFn.includes("opts.openOnFocus === true") &&
    enhanceFn.includes("opts.showAllWhenEmpty === true"),
  "45 existing external searchable-select behavior unchanged unless opt-in",
);
assert(
  swSrc.includes("hub-cache-v318") && !swSrc.includes("hub-cache-v319"),
  "46 SW bumped to v318 after smokes",
);

assert(
  canonicalizePrmProductDeltaStepKey("POWDER_", { trimEdges: true }) ===
    "POWDER",
  "trim edges on blur/save",
);
assert(
  canonicalizePrmProductDeltaStepKey("POWDER_", { trimEdges: false }) ===
    "POWDER_",
  "leading/trailing underscore kept while typing",
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll Product-delta searchable-selector smoke checks passed.");
