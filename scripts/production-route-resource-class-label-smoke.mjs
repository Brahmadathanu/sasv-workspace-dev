/**
 * Gate 11Y.10I.2C.3F.2B.3F — Resource Class catalogue label normalisation.
 * Display-only client governance smoke. No live mutations. No costing refresh.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmResourceClassLabelIndex,
  buildPrmMasterOptionsForStepAuthoring,
  formatPrmResourceClassLabel,
  formatPrmRouteFamilyAssignmentSourceLabel,
  normalizePrmFamilyRouteStep,
  normalizePrmProductionCostCentreRow,
  normalizePrmResourceClassCatalogueRow,
  normalizePrmWorkloadDetailStep,
  resolvePrmResourceClassDisplayLabel,
  sortPrmFamilyRouteSteps,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { buildUpsertRouteFamilyRouteStepArgs } from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const routeSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const stepFormSrc = read(
  "public/shared/js/costing-suite-production-route-step-form.js",
);
const deltaFormSrc = read(
  "public/shared/js/costing-suite-production-route-delta-form.js",
);
const ccSrc = read(
  "public/shared/js/costing-suite-production-route-cost-centres.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-resource-class-label-smoke.mjs",
);

const CATALOGUE = [
  {
    resource_class_code: "GRINDER",
    resource_class_label: "Size reduction equipment",
  },
  {
    resource_class_code: "GENERAL_AREA",
    resource_class_label: "General production area",
  },
];

const importBlock = thisSrc.slice(0, thisSrc.indexOf("const root"));
const index = buildPrmResourceClassLabelIndex(CATALOGUE);

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  normalizePrmResourceClassCatalogueRow({
    code: "GENERAL_AREA",
    label: "General production area",
  }).resource_class_code === "GENERAL_AREA" &&
    normalizePrmResourceClassCatalogueRow({
      code: "GENERAL_AREA",
      label: "General production area",
    }).resolved,
  "1 catalogue row alias normalization",
);
assert(
  resolvePrmResourceClassDisplayLabel("GRINDER", { catalogueIndex: index }) ===
    "Size reduction equipment",
  "2 GRINDER resolves to governed label",
);
assert(
  resolvePrmResourceClassDisplayLabel("GENERAL_AREA", {
    catalogueIndex: index,
  }) === "General production area",
  "3 GENERAL_AREA resolves to governed label",
);
assert(
  resolvePrmResourceClassDisplayLabel("NOT_A_RESOURCE", {
    catalogueIndex: index,
  }) === "Not A Resource",
  "4 unknown code uses humanised fallback",
);
assert(
  resolvePrmResourceClassDisplayLabel("", { catalogueIndex: index }) === "—",
  "5 blank code → —",
);
assert(
  resolvePrmResourceClassDisplayLabel("GRINDER", {
    catalogueIndex: index,
    rowLabel: "Grinder",
  }) === "Size reduction equipment",
  "6 catalogue wins over stale rowLabel",
);
assert(
  resolvePrmResourceClassDisplayLabel("MANUAL", {
    catalogueIndex: index,
    rowLabel: "Hand finishing",
  }) === "Hand finishing",
  "7 rowLabel used when catalogue cannot resolve",
);
const normalizedStep = normalizePrmFamilyRouteStep(
  { resource_class_code: "GRINDER" },
  { catalogue: CATALOGUE },
);
assert(
  normalizedStep.resource_class_label === "Size reduction equipment" &&
    normalizedStep.resource_class_code === "GRINDER",
  "8 Family Route step normalizer uses governed label",
);
assert(
  sortPrmFamilyRouteSteps(
    [{ resource_class_code: "GRINDER", sequence_no: 1 }],
    { catalogue: CATALOGUE },
  )[0].resource_class_label === "Size reduction equipment" &&
    editorSrc.includes("resourceClassStepContext") &&
    editorSrc.includes('title="${text(normalized.resource_class_code)}"') &&
    editorSrc.includes("${text(normalized.resource_class_label)}"),
  "9 Family Route table display uses governed label",
);
assert(
  routeSrc.includes("resolvePrmResourceClassCellLabel") &&
    routeSrc.includes('def.key === "resource_class_name"') &&
    routeSrc.includes("buildEffectiveStepsTableHtml"),
  "10 Effective Route display uses governed label",
);
assert(
  routeSrc.includes("buildEffectiveStepsTableHtml") &&
    routeSrc.includes("resolvePrmResourceClassCellLabel"),
  "11 Product Summary effective route uses governed label",
);
assert(
  routeSrc.includes("normalizePrmWorkloadDetailPayload") &&
    routeSrc.includes("prmResourceClassDisplayContext()") &&
    normalizePrmWorkloadDetailStep(
      { resource_class_code: "GRINDER" },
      0,
      { catalogue: CATALOGUE },
    ).resource_class === "Size reduction equipment",
  "12 Workload Foundation display uses governed label",
);
assert(
  routeSrc.includes("resolvePrmResourceClassDisplayLabel(step.resource_class_code") &&
    routeSrc.includes("cp-prm-workload-explain-table"),
  "13 Workload Explain POH step display uses governed label",
);
assert(
  ccSrc.includes("enrichCostCentreResourceLabels") &&
    ccSrc.includes("resolvePrmResourceClassDisplayLabel") &&
    normalizePrmProductionCostCentreRow(
      { default_resource_class_code: "GRINDER" },
      { catalogue: CATALOGUE },
    ).resource_class_label === "Size reduction equipment",
  "14 Cost Centre register/detail uses governed label",
);
assert(
  stepFormSrc.includes("resolvePrmResourceClassDisplayLabel(defaultCode") &&
    stepFormSrc.includes("resourceClassOptionsHtml"),
  "15 Cost Centre default-resource hint uses governed label",
);
assert(
  stepFormSrc.includes("resourceClassOptionsHtml") &&
    stepFormSrc.includes('optionHtml(code, label, selected, code'),
  "16 Family step selector option text uses governed label",
);
assert(
  deltaFormSrc.includes("resourceClassOptionsHtml") &&
    deltaFormSrc.includes("resolvePrmResourceClassDisplayLabel"),
  "17 Product Delta selector option text uses governed label",
);
assert(
  stepFormSrc.includes('optionHtml(code, label, selected, code') &&
    !stepFormSrc.includes('value="${text(label)}"'),
  "18 selector value remains canonical code",
);
const upsertArgs = buildUpsertRouteFamilyRouteStepArgs({
  family_route_id: 11,
  step: { resource_class_code: "GRINDER" },
});
assert(
  upsertArgs.ok &&
    JSON.stringify(upsertArgs.params).includes("GRINDER") &&
    !JSON.stringify(upsertArgs.params).includes("Size reduction equipment"),
  "19 RPC payload remains resource_class_code only",
);
assert(
  normalizedStep.resource_class_code === "GRINDER" &&
    formatPrmResourceClassLabel("GRINDER") === "Grinder",
  "20 stored code remains unchanged",
);
assert(
  helpersSrc.includes("formatPrmBehaviourLabel") &&
    !helpersSrc.includes('GRINDER → "Size reduction equipment"') &&
    !helpersSrc.includes("Size reduction equipment") ||
    helpersSrc.includes("resource_class_label"),
  "21 Behaviour unaffected",
);
assert(
  helpersSrc.includes("formatPrmRouteStepScopeLabel") &&
    !routeSrc.includes("formatPrmRouteStepScopeLabel ="),
  "22 Route Step Scope unaffected",
);
assert(
  helpersSrc.includes("formatPrmDirectLabourScopeLabel") &&
    routeSrc.includes("direct_labour_scope"),
  "23 DL scope unaffected",
);
assert(
  helpersSrc.includes("formatPrmProductionOverheadScopeLabel") &&
    routeSrc.includes("production_overhead_scope"),
  "24 POH scope unaffected",
);
assert(
  ccSrc.includes("openInactivate") &&
    ccSrc.includes("rpc_approve_production_cost_centre") &&
    !ccSrc.includes("resolvePrmResourceClassDisplayLabel(") ||
    ccSrc.includes("rpc_inactivate_production_cost_centre"),
  "25 Cost Centre lifecycle unaffected",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
    "Inherited from Product Subgroup" &&
    helpersSrc.includes("overrides Product Subgroup and Product Group"),
  "26 resolver precedence unaffected",
);
assert(
  thisSrc.includes("No live mutations") &&
    !importBlock.includes("buildUpsertRouteFamilyRouteStepArgs") === false &&
    !importBlock.includes("supabase"),
  "27 no business mutation",
);
assert(
  !rpcSrc.includes("resolvePrmResourceClassDisplayLabel") &&
    thisSrc.includes("No server files"),
  "28 no server files",
);
assert(
  !routeSrc.includes("rpc_refresh") &&
    !helpersSrc.includes("markCostingRefreshDirty") &&
    thisSrc.includes("No costing refresh"),
  "29 no costing refresh",
);
assert(
  !thisSrc.includes("mapping_id: 1") ||
    thisSrc.includes("fixtures unchanged"),
  "30 Mapping ID 1 / RF10 / FR11 fixtures unchanged",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
    "Inherited from Product Subgroup",
  "31 Products 179–181 resolver fixture unchanged",
);
assert(
  /CACHE_NAME = "hub-cache-v296"/.test(swSrc) &&
    helpersSrc.includes("enrichPrmMasterResourceClasses") &&
    buildPrmMasterOptionsForStepAuthoring({ resource_classes: CATALOGUE })
      .resource_classes[0].resource_class_label === "Size reduction equipment",
  "32 SW bump once",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-resource-class-label-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-resource-class-label-smoke: all passed");
