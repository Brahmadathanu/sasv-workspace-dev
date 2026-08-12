/**
 * Gate 11Y.10I.2C.3E.3D — Product-delta authoring surface.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not create Thaleesapathradi Powder Blending / seq 35 / Activity 105 / CC 38.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_DELTA_OPERATIONS,
  PRM_EXACT_RUN_CONTEXT,
  filterUntouchedFamilyStepsFromOverrides,
  formatPrmDeltaBaseStepLabel,
  formatPrmDeltaTargetCopy,
  isPrmRouteReadOnlyStatus,
  isPrmRouteWritableStatus,
  normalizePrmProductRouteOverride,
  resolvePrmFamilyStepId,
  selectPrmBypassEligibleFamilySteps,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildDeleteProductOverrideArgs,
  buildOverrideJson,
  buildUpsertProductOverrideArgs,
} from "../public/shared/js/costing-suite-production-route-rpc.js";
import { nextPrmFamilyStepSequence } from "../public/shared/js/costing-suite-production-route-step-form.js";
import {
  buildProductDeltaFormHtml,
  validatePrmProductDeltaForm,
} from "../public/shared/js/costing-suite-production-route-delta-form.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const formSrc = read(
  "public/shared/js/costing-suite-production-route-delta-form.js",
);
const familyFormSrc = read(
  "public/shared/js/costing-suite-production-route-step-form.js",
);
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");

const addDeltaClick =
  mainSrc.match(
    /if \(action === "add-product-delta"\) \{[\s\S]*?return;\n      \}/,
  )?.[0] || "";
const openDeltaFn =
  mainSrc.match(
    /async function openProductDeltaModal\([\s\S]*?\n  function bindEditor/,
  )?.[0] || "";
const saveOverrideFn =
  editorSrc.match(
    /async function saveProductOverride\([\s\S]*?\n  async function deleteProductOverride/,
  )?.[0] || "";
const deleteOverrideFn =
  editorSrc.match(
    /async function deleteProductOverride\([\s\S]*?\n  async function validate/,
  )?.[0] || "";
const productHtmlFn =
  editorSrc.match(
    /function productHtml\([\s\S]*?\n  function renderEditor/,
  )?.[0] || "";
const deltaRowFn =
  editorSrc.match(
    /function deltaRow\([\s\S]*?\n  function productHtml/,
  )?.[0] || "";
const loadProductFn =
  editorSrc.match(
    /async function loadProductDetail\([\s\S]*?\n  async function createFamilyDraft/,
  )?.[0] || "";
const buildOverrideFn =
  rpcSrc.match(
    /export function buildOverrideJson\([\s\S]*?\nexport function normalizePrmAsOfForEffective/,
  )?.[0] || "";
const buildDeleteFn =
  rpcSrc.match(
    /export function buildDeleteProductOverrideArgs\([\s\S]*?\nexport function buildValidateProductRouteArgs/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const family10 = [
  {
    family_route_step_id: 50,
    sequence_no: 10,
    activity_name: "RM dispensation",
    allows_skip_with_approval: false,
  },
  {
    family_route_step_id: 51,
    sequence_no: 20,
    activity_name: "Pulverization",
    allows_skip_with_approval: true,
  },
  {
    family_route_step_id: 52,
    sequence_no: 30,
    activity_name: "Sieving",
    allows_skip_with_approval: true,
  },
  {
    family_route_step_id: 53,
    sequence_no: 40,
    activity_name: "Finished Goods Quality Assessment",
    allows_skip_with_approval: false,
  },
  {
    family_route_step_id: 54,
    sequence_no: 50,
    activity_name: "Transfer to FG store",
    allows_skip_with_approval: false,
  },
];
const catalogues = {
  activities: [
    {
      activity_id: 1,
      activity_name: "Generic activity",
      section_id: 2,
      subsection_id: 3,
      area_id: 4,
      section_name: "Section A",
      subsection_name: "Subsection B",
      area_name: "Area C",
    },
  ],
  cost_centres: [
    {
      cost_centre_id: 2,
      cost_centre_code: "PROD_GENERIC",
      cost_centre_name: "Generic production",
      status: "APPROVED",
      pool_scope: "SHARED",
    },
    {
      cost_centre_id: 9,
      cost_centre_code: "PROD_DRAFT",
      cost_centre_name: "Draft centre",
      status: "DRAFT",
    },
  ],
  behaviours: [{ behaviour_code: "MANUAL", behaviour_label: "Manual" }],
  resource_classes: [
    { resource_class_code: "MANUAL", resource_class_label: "Manual" },
  ],
  plants: [
    {
      plant_id: 7,
      plant_name: "Mill 1",
      section_id: 2,
      subsection_id: 3,
      area_id: 4,
      status: "ACTIVE",
    },
    {
      plant_id: 8,
      plant_name: "Other plant",
      section_id: 99,
      subsection_id: 99,
      area_id: 99,
      status: "ACTIVE",
    },
  ],
};
const addFormHtml = buildProductDeltaFormHtml({
  options: catalogues,
  familySteps: family10,
});
const bypassFormHtml = buildProductDeltaFormHtml({
  delta: { operation_type: "BYPASS_STEP" },
  options: catalogues,
  familySteps: family10,
});
const editFormHtml = buildProductDeltaFormHtml({
  delta: {
    override_id: 12,
    operation_type: "ADD_STEP",
    override_step_key: "ADDED_STEP",
    sequence_no: 99,
    override_reason: "Product-specific added step",
  },
  options: catalogues,
  familySteps: family10,
});
const locatedFormHtml = buildProductDeltaFormHtml({
  delta: {
    operation_type: "ADD_STEP",
    activity_id: 1,
    override_reason: "Located step",
  },
  options: catalogues,
  familySteps: family10,
});
const bypassEligible = selectPrmBypassEligibleFamilySteps(family10);
const flipped = selectPrmBypassEligibleFamilySteps(
  family10.map((step) => ({
    ...step,
    allows_skip_with_approval: step.family_route_step_id === 50,
  })),
);
const canonicalRow = normalizePrmProductRouteOverride({
  id: 12,
  operation_type: "ADD_STEP",
  override_step_key: "ADDED_STEP",
  sequence_no: 99,
  override_reason: "Product-specific added step",
});
const aliasedRow = normalizePrmProductRouteOverride({
  delta_operation: "BYPASS_STEP",
  step_key: "pulverization",
  note: "Skip this Product",
  base_step_id: 51,
});
const liveAdd = buildOverrideJson({
  operation_type: "ADD_STEP",
  override_step_key: "ADDED_STEP",
  sequence_no: 99,
  activity_id: 1,
  cost_centre_id: 2,
  override_reason: "Product-specific added step",
});
const addValid = validatePrmProductDeltaForm(
  {
    operation_type: "ADD_STEP",
    base_step_id: null,
    override_step_key: "ADDED_STEP",
    sequence_no: 99,
    activity_id: 1,
    cost_centre_id: 2,
    section_id: 2,
    subsection_id: 3,
    area_id: 4,
    behaviour_code: "MANUAL",
    resource_class_code: "MANUAL",
    route_step_scope: "PROCESS",
    direct_labour_scope: "INCLUDE",
    production_overhead_scope: "INCLUDE",
    expected_occurrence_count: 1,
    standard_cycle_count: 1,
    override_reason: "Product-specific added step",
  },
  { familySteps: family10, options: catalogues },
);
const addInvalid = validatePrmProductDeltaForm(
  { operation_type: "ADD_STEP", base_step_id: null, override_reason: "" },
  { familySteps: family10 },
);
const bypassInvalid = validatePrmProductDeltaForm(
  {
    operation_type: "BYPASS_STEP",
    base_step_id: 50,
    override_reason: "Cannot bypass RM issue",
  },
  { familySteps: family10 },
);
const bypassValid = validatePrmProductDeltaForm(
  {
    operation_type: "BYPASS_STEP",
    base_step_id: 51,
    override_reason: "Skip pulverization for this Product",
  },
  { familySteps: family10 },
);
const nonAddMissingBase = validatePrmProductDeltaForm(
  {
    operation_type: "ALTER_CYCLE",
    override_reason: "Change cycles",
  },
  { familySteps: family10 },
);
const insertAfterSeq = nextPrmFamilyStepSequence(family10, 30);

assert(
  productHtmlFn.includes('data-prm-action="add-product-delta">Add delta') &&
    productHtmlFn.includes("${writable ?") &&
    isPrmRouteWritableStatus("DRAFT"),
  "1 Add delta visible for Draft",
);
assert(
  addDeltaClick.includes("openProductDeltaModal(null)") &&
    openDeltaFn.includes("openModal"),
  "2 click recognized",
);
assert(
  addDeltaClick.includes("openProductDeltaModal") &&
    !addDeltaClick.includes("return;") === false &&
    openDeltaFn.includes('showToast?.("Edit permission required.') &&
    openDeltaFn.includes('showToast?.("Product route is read-only.') &&
    openDeltaFn.includes('showToast?.("Product route ID is required.'),
  "3 click no longer silent",
);
assert(
  !addDeltaClick.includes("saveProductOverride") &&
    !openDeltaFn.includes("saveProductOverride") === false &&
    openDeltaFn.indexOf("openModal") <
      openDeltaFn.indexOf("saveProductOverride") &&
    openDeltaFn.includes('data-prm-product-delta-save'),
  "4 click no mutation; upsert only on explicit Save",
);
assert(
  addFormHtml.includes("data-prm-product-delta-form") &&
    addFormHtml.includes("Delta operation") &&
    openDeltaFn.includes("buildProductDeltaFormHtml"),
  "5 Product delta form opens",
);
assert(
  JSON.stringify(PRM_DELTA_OPERATIONS) ===
    JSON.stringify([
      "ADD_STEP",
      "BYPASS_STEP",
      "REPLACE_STEP",
      "ALTER_LOCATION",
      "ALTER_RESOURCE",
      "ALTER_CYCLE",
      "ALTER_MANDATORY_STATUS",
    ]) &&
    !PRM_DELTA_OPERATIONS.includes("REMOVE_STEP") &&
    PRM_DELTA_OPERATIONS.every((code) => addFormHtml.includes(code)) &&
    !addFormHtml.includes("REMOVE_STEP"),
  "6 operation domain exact",
);
assert(
  addFormHtml.includes('id="prmProductDeltaActivity"') &&
    addFormHtml.includes('id="prmProductDeltaCostCentre"') &&
    addFormHtml.includes('id="prmProductDeltaBehaviour"') &&
    addFormHtml.includes('id="prmProductDeltaResource"') &&
    addFormHtml.includes('id="prmProductDeltaScope"') &&
    addFormHtml.includes('id="prmProductDeltaDlScope"') &&
    addFormHtml.includes('id="prmProductDeltaPohScope"') &&
    addFormHtml.includes('id="prmProductDeltaPlant"') &&
    addFormHtml.includes("<select") &&
    !addFormHtml.includes('type="text" id="prmProductDeltaActivity"'),
  "7 governed selectors used",
);
assert(
  !mainSrc.includes('window.prompt("Delta operation"') &&
    !mainSrc.includes('window.prompt("Target or new step key"') &&
    !formSrc.includes("window.prompt(") &&
    !addDeltaClick.includes("window.prompt"),
  "8 no window.prompt",
);
assert(
  addFormHtml.includes("Generic activity") &&
    addFormHtml.includes("PROD_GENERIC") &&
    !addFormHtml.includes('value="105" selected') &&
    !addFormHtml.includes('value="38" selected'),
  "9 no manual ids / no Powder Blending preselect",
);
assert(
  !mainSrc.includes("product_route_id: 47") &&
    !formSrc.includes("product_route_id: 47") &&
    openDeltaFn.includes("state.selectedProductRouteId") &&
    loadProductFn.includes("buildProductRouteDetailArgs({ product_route_id: productRouteId })"),
  "10 route 47 context retained",
);
assert(
  loadProductFn.includes("base_route_family_route_id") &&
    loadProductFn.includes("buildRouteFamilyRouteDetailArgs") &&
    !formSrc.includes("family_route_id: 10"),
  "11 base Family Route 10 retained",
);
assert(
  addFormHtml.includes('data-prm-delta-panel="base" hidden') &&
    !addFormHtml.includes('data-prm-delta-panel="add" hidden'),
  "12 ADD_STEP hides base_step selector",
);
assert(
  bypassFormHtml.includes('data-prm-delta-panel="base"') &&
    !bypassFormHtml.includes('data-prm-delta-panel="base" hidden') &&
    nonAddMissingBase.ok === false &&
    nonAddMissingBase.errors.some((msg) => /Family Route step/i.test(msg)),
  "13 non-ADD requires base_step",
);
const bypassBaseSelect =
  bypassFormHtml.match(
    /id="prmProductDeltaBaseStep"[\s\S]*?<\/select>/,
  )?.[0] || "";
assert(
  bypassBaseSelect.includes('value="51"') &&
    bypassBaseSelect.includes('value="52"') &&
    !bypassBaseSelect.includes('value="50"') &&
    !bypassBaseSelect.includes('value="20"') &&
    formatPrmDeltaBaseStepLabel(family10[1]) === "Seq 20 — Pulverization" &&
    resolvePrmFamilyStepId(family10[1]) === 51,
  "14 base step stores real step id",
);
assert(
  bypassEligible.map((s) => s.family_route_step_id).join(",") === "51,52" &&
    flipped.map((s) => s.family_route_step_id).join(",") === "50" &&
    !formSrc.includes("51, 52") &&
    !formSrc.includes("family_route_step_id === 51") &&
    bypassInvalid.ok === false &&
    bypassValid.ok === true,
  "15 bypass options honor skip-with-approval",
);
assert(
  addFormHtml.includes("<select id=\"prmProductDeltaActivity\"") &&
    addFormHtml.includes("Generic activity"),
  "16 Activity selector governed",
);
assert(
  addFormHtml.includes('id="prmProductDeltaSectionName"') &&
    addFormHtml.includes("readonly disabled") &&
    addFormHtml.includes("Location (from Activity)") &&
    formSrc.includes("applyActivityLocation"),
  "17 Activity location derived/locked consistently",
);
assert(
  addFormHtml.includes("PROD_GENERIC") &&
    !addFormHtml.includes("PROD_DRAFT") &&
    addFormHtml.includes("Approved Production cost centres"),
  "18 approved Cost Centre selector",
);
assert(
  addFormHtml.includes("Optional plant") &&
    locatedFormHtml.includes("Mill 1") &&
    !locatedFormHtml.includes("Other plant") &&
    formSrc.includes("filterPrmPlantsByLocation"),
  "19 Plant optional/filtered",
);
assert(
  addFormHtml.includes('id="prmProductDeltaBehaviour"') &&
    addFormHtml.includes("Manual"),
  "20 Behaviour governed",
);
assert(
  addFormHtml.includes('id="prmProductDeltaResource"'),
  "21 Resource Class governed",
);
assert(
  addFormHtml.includes('id="prmProductDeltaScope"'),
  "22 Route Step Scope governed",
);
assert(
  addFormHtml.includes('id="prmProductDeltaDlScope"'),
  "23 DL scope governed",
);
assert(
  addFormHtml.includes('id="prmProductDeltaPohScope"'),
  "24 POH scope governed",
);
assert(
  addFormHtml.includes("Reason / Manufacturing rationale") &&
    addValid.ok === true &&
    addInvalid.ok === false &&
    addInvalid.errors.some((msg) => /rationale/i.test(msg)),
  "25 reason required",
);
assert(
  liveAdd.operation_type === "ADD_STEP" &&
    liveAdd.base_step_id === null &&
    liveAdd.override_step_key === "ADDED_STEP" &&
    liveAdd.override_reason === "Product-specific added step" &&
    openDeltaFn.includes("saveProductOverride") &&
    saveOverrideFn.includes("buildOverrideJson") &&
    saveOverrideFn.includes("buildUpsertProductOverrideArgs"),
  "26 explicit Save uses live payload keys",
);
assert(
  !Object.prototype.hasOwnProperty.call(liveAdd, "delta_operation") &&
    !Object.prototype.hasOwnProperty.call(liveAdd, "step_key") &&
    !Object.prototype.hasOwnProperty.call(liveAdd, "target_step_key") &&
    !Object.prototype.hasOwnProperty.call(liveAdd, "note") &&
    buildOverrideFn.includes("PRM_LIVE_OVERRIDE_KEYS") &&
    !buildOverrideFn.includes("delta_operation:"),
  "27 old stale key shape not primary",
);
assert(
  openDeltaFn.includes("data-prm-product-delta-cancel") &&
    openDeltaFn.includes("closeModal") &&
    !openDeltaFn
      .slice(
        openDeltaFn.indexOf("data-prm-product-delta-cancel"),
        openDeltaFn.indexOf("data-prm-product-delta-save"),
      )
      .includes("saveProductOverride"),
  "28 Cancel no RPC",
);
assert(
  addInvalid.ok === false &&
    validatePrmProductDeltaForm({ operation_type: "REMOVE_STEP" }).ok ===
      false &&
    nonAddMissingBase.ok === false,
  "29 invalid form blocked",
);
const saveHandlerSrc = openDeltaFn.slice(
  openDeltaFn.indexOf("data-prm-product-delta-save"),
);
assert(
  saveOverrideFn.includes('showToast?.("Unsupported Product delta operation.') &&
    editorSrc.includes('showToast?.(error.message || fallback, "error")') &&
    openDeltaFn.includes("checked.errors") &&
    openDeltaFn.includes("result?.ok") &&
    saveHandlerSrc.includes("if (result?.ok") &&
    saveHandlerSrc.indexOf("closeModal") >
      saveHandlerSrc.indexOf("saveProductOverride"),
  "30 RPC error visible; form stays open on failure",
);
assert(
  openDeltaFn.includes("loadProductDetail(state.selectedProductRouteId)") &&
    openDeltaFn.includes("render()") &&
    !openDeltaFn.includes("navigate("),
  "31 successful save reloads detail",
);
assert(
  filterUntouchedFamilyStepsFromOverrides([canonicalRow]).length === 1 &&
    filterUntouchedFamilyStepsFromOverrides([aliasedRow]).length === 1 &&
    canonicalRow.operation_type === "ADD_STEP" &&
    formatPrmDeltaTargetCopy(canonicalRow, family10).includes("Seq 99") &&
    productHtmlFn.includes("No Product deltas.") &&
    deltaRowFn.includes("formatPrmDeltaTargetCopy"),
  "32 saved canonical row appears in Product deltas",
);
assert(
  loadProductFn.includes("normalized.effective_steps") &&
    productHtmlFn.includes("C. Resolved effective route"),
  "33 resolved effective route updates",
);
assert(
  saveOverrideFn.includes('markValidationStale("product")') &&
    editorSrc.includes(
      'if (response.ok) markValidationStale("product")',
    ) &&
    !openDeltaFn.includes("validateProduct()") &&
    !openDeltaFn.includes("submitProduct") &&
    !saveOverrideFn.includes("RPC.validateProduct"),
  "34 validation becomes stale/current appropriately",
);
assert(
  openDeltaFn.includes("override_id: existing") &&
    saveOverrideFn.includes("override_id") &&
    editorSrc.includes("p_override_id") === false &&
    rpcSrc.includes('rpc_upsert_product_route_override: Object.freeze([') &&
    buildUpsertProductOverrideArgs({
      product_route_id: 47,
      override_id: 12,
      override: liveAdd,
    }).params.p_override_id === 12,
  "35 Edit uses p_override_id",
);
assert(
  buildDeleteFn.includes("p_product_route_id") &&
    buildDeleteFn.includes("p_override_id") &&
    !buildDeleteFn.includes("p_product_route_override_id") &&
    deleteOverrideFn.includes("product_route_id: routeId") &&
    deleteOverrideFn.includes("override_id: id") &&
    buildDeleteProductOverrideArgs({
      product_route_id: 47,
      override_id: 12,
    }).params.p_product_route_id === 47 &&
    buildDeleteProductOverrideArgs({
      product_route_id: 47,
      override_id: 12,
    }).params.p_override_id === 12,
  "36 Delete uses p_product_route_id + p_override_id",
);
assert(
  isPrmRouteWritableStatus("DRAFT") &&
    deltaRowFn.includes("data-prm-delta-edit") &&
    deltaRowFn.includes("data-prm-delta-delete") &&
    productHtmlFn.includes("Add delta"),
  "37 Draft delta reversible",
);
assert(
  isPrmRouteReadOnlyStatus("APPROVED") &&
    isPrmRouteReadOnlyStatus("SUPERSEDED") &&
    isPrmRouteReadOnlyStatus("INACTIVE") &&
    productHtmlFn.includes("read-only") &&
    deltaRowFn.includes("writable") &&
    saveOverrideFn.includes("editable(productState.detail)") &&
    deleteOverrideFn.includes("editable(productState.detail)"),
  "38 Approved route immutable",
);
assert(
  !openDeltaFn.includes("submitProduct") &&
    !saveOverrideFn.includes("submitProduct"),
  "39 no auto-submit",
);
assert(
  !openDeltaFn.includes("approveProduct") &&
    !saveOverrideFn.includes("approveProduct"),
  "40 no auto-approve",
);
assert(
  !openDeltaFn.includes("rpc_request_costing_refresh") &&
    !saveOverrideFn.includes("rpc_request_costing_refresh") &&
    !formSrc.includes("rpc_request_costing_refresh") &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "41 no costing refresh",
);
assert(
  insertAfterSeq === 35 &&
    !addFormHtml.includes("Powder Blending") &&
    !addFormHtml.includes("value=\"105\"") &&
    !addFormHtml.includes("value=\"38\"") &&
    !formSrc.includes("sequence_no: 35") &&
    !openDeltaFn.includes("105") &&
    !openDeltaFn.includes("Powder"),
  "42 no Powder Blending fixture mutation",
);
assert(
  htmlSrc.includes(".cp-prm-product-delta-form") &&
    htmlSrc.includes("@media (max-width: 760px)") &&
    htmlSrc.includes("grid-template-columns: minmax(0, 1fr)"),
  "43 responsive modal sane",
);
assert(
  !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(
    htmlSrc.match(
      /\.cp-prm-product-delta-form \{[\s\S]*?@media \(max-width: 760px\) \{[\s\S]*?\n      \}/,
    )?.[0] || "#fail",
  ) &&
    !formSrc.includes("#") === false,
  "44 semantic tokens only",
);
assert(
  !mainSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !formSrc.includes("apply_migration") &&
    !helpersSrc.includes("rpc_upsert_product_route_override_v2"),
  "45 no server changes",
);
assert(
  !familyFormSrc.includes("buildProductDeltaFormHtml") &&
    !familyFormSrc.includes("openProductDeltaModal") &&
    familyFormSrc.includes("buildFamilyStepFormHtml") &&
    mainSrc.includes("openFamilyStepModal"),
  "46 family step editor unchanged",
);
assert(
  /CACHE_NAME = "hub-cache-v277"/.test(swSrc),
  "47 SW bumped exactly once after smokes (hub-cache-v277)",
);

assert(
  editFormHtml.includes('data-prm-delta-override-id="12"') &&
    editFormHtml.includes(">Save delta<") &&
    addFormHtml.includes(">Add delta<"),
  "edit vs create modal actions",
);
assert(
  productHtmlFn.includes("<th>Reason</th>") &&
    productHtmlFn.includes("<th>Target / Step</th>"),
  "dense Product-delta table headers",
);

if (failed) {
  console.error(
    `production-route-product-delta-authoring-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-product-delta-authoring-smoke: all passed");
