/**
 * Gate 11Y.10I.2C.3E.3D.3 — Product Route Editor explicit validation + freshness.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not validate, submit, approve, or alter Product Route 47.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractValidationIssues,
  isValidationSuccessful,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  buildValidateProductRouteArgs,
  buildValidateRouteFamilyRouteArgs,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-validate-handoff-smoke.mjs",
);
const authoringSmokeSrc = read(
  "scripts/production-route-product-delta-authoring-smoke.mjs",
);
const integritySmokeSrc = read(
  "scripts/production-route-product-delta-master-selection-smoke.mjs",
);
const selectorSmokeSrc = read(
  "scripts/production-route-product-delta-searchable-selector-smoke.mjs",
);

const productHtmlFn =
  editorSrc.match(
    /function productHtml\([\s\S]*?\n  function renderEditor/,
  )?.[0] || "";
const validationHtmlFn =
  editorSrc.match(
    /function validationHtml\([\s\S]*?\n  function familyHtml/,
  )?.[0] || "";
const validateFn =
  editorSrc.match(
    /async function validate\(mode\) \{[\s\S]*?\n  async function submit/,
  )?.[0] || "";
const loadProductFn =
  editorSrc.match(
    /async function loadProductDetail\([\s\S]*?\n  async function createFamilyDraft/,
  )?.[0] || "";
const bindEditorFn =
  mainSrc.match(/function bindEditor\(host, mode\) \{[\s\S]*?\n    if \(mode === "family"\) \{/)?.[0] ||
  "";
const validateBindFn =
  mainSrc.match(
    /if \(action === `validate-\$\{mode\}`\) \{[\s\S]*?\n      if \(action === `submit-\$\{mode\}`\)/,
  )?.[0] || "";
const familyValidateBind =
  validateBindFn.match(
    /if \(mode === "family"\) \{[\s\S]*?return;\n        \}/,
  )?.[0] || "";
const productValidateBind =
  validateBindFn.match(
    /const button = event\.target\.closest\([\s\S]*?return;\n      \}/,
  )?.[0] || "";
const openDeltaFn =
  mainSrc.match(
    /async function openProductDeltaModal\([\s\S]*?\n  function bindEditor/,
  )?.[0] || "";
const deleteReloadFn =
  mainSrc.match(
    /async function deleteProductOverride[\s\S]*?\n          return result;/,
  )?.[0] ||
  mainSrc.match(
    /data-prm-delta-delete[\s\S]*?return result;\n        \}\);/,
  )?.[0] ||
  "";
const buildValidateProductFn =
  rpcSrc.match(
    /export function buildValidateProductRouteArgs\([\s\S]*?\nexport function buildSubmitProductRouteArgs/,
  )?.[0] || "";
const familyHtmlFn =
  editorSrc.match(
    /function familyHtml\([\s\S]*?\n  function deltaRow/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const passPayload = {
  valid: true,
  errors: [],
  step_count: 6,
  production_step_count: 3,
  rm_boundary_count: 1,
  fg_boundary_count: 1,
  resolved_route_family_id: 9,
};
const failPayload = {
  valid: false,
  errors: [
    {
      code: "MISSING_PRODUCTION_STEP",
      message: "Resolved route is missing a required production step.",
    },
  ],
};

assert(
  productHtmlFn.includes('data-prm-action="validate-product"') &&
    productHtmlFn.includes("lifecycle.validateLabel"),
  "1 Product Draft Validate button renders",
);
assert(
  /data-prm-action="validate-product"/.test(productHtmlFn) &&
    productHtmlFn.includes('type="button"'),
  "2 type=\"button\" present",
);
assert(
  productHtmlFn.includes('data-prm-action="validate-product"') &&
    !productHtmlFn.includes('data-prm-action="validate-family"'),
  "3 action id = validate-product",
);
assert(
  bindEditorFn.includes("function bindEditor") &&
    validateBindFn.includes('action === `validate-${mode}`') &&
    productValidateBind.includes("editor.validateProduct()"),
  "4 bindEditor recognizes validate-product",
);
assert(
  validateFn.includes("const response = await invoke(") &&
    validateFn.includes("RPC.validateProduct") &&
    !/if\s*\(\s*(target|productState)\.validationFresh/.test(validateFn),
  "5 explicit click always calls validator",
);
assert(
  validateFn.includes("Do not skip merely because validationFresh is already true") &&
    !validateFn.includes("if (target.validationFresh) return") &&
    productValidateBind.includes("editor.validateProduct()"),
  "6 validationFresh=true does not short-circuit explicit click",
);
assert(
  validateFn.includes(
    "buildValidateProductRouteArgs({ product_route_id: productId() })",
  ) &&
    editorSrc.includes(
      "productState.detail?.product_route_id",
    ),
  "7 correct product_route_id passed",
);

const built = buildValidateProductRouteArgs({ product_route_id: 47 });
assert(
  built.ok === true &&
    Object.keys(built.params).join(",") === "p_product_route_id" &&
    built.params.p_product_route_id === 47 &&
    PRM_RPC_ARG_KEYS.rpc_validate_product_route.join(",") ===
      "p_product_route_id" &&
    !buildValidateProductFn.includes("p_product_id") &&
    !buildValidateProductFn.includes("p_route_family_id") &&
    !buildValidateProductFn.includes("p_family_route_id"),
  "8 adapter uses p_product_route_id",
);
assert(
  editorSrc.includes('validateProduct: "rpc_validate_product_route"') &&
    validateFn.includes("RPC.validateProduct") &&
    rpcSrc.includes("rpc_validate_product_route: buildValidateProductRouteArgs"),
  "9 rpc_validate_product_route used",
);

const familyBuilt = buildValidateRouteFamilyRouteArgs({ family_route_id: 10 });
assert(
  familyHtmlFn.includes('data-prm-action="validate-family"') &&
    familyValidateBind.includes("editor.validateFamily()") &&
    !productValidateBind.includes("validateFamily") &&
    !productValidateBind.includes("rpc_validate_route_family_route") &&
    familyBuilt.ok === true,
  "10 family validator not used",
);
assert(
  isValidationSuccessful(passPayload) === true &&
    validateFn.includes("target.validationFresh = isValidationSuccessful(response.data)") &&
    productValidateBind.includes('showToast?.("Validation passed", "success")'),
  "11 valid=true handled",
);
assert(
  extractValidationIssues(passPayload).length === 0 &&
    validateFn.includes("issues: extractValidationIssues(response.data)"),
  "12 errors=[] handled",
);
assert(
  productValidateBind.includes('"Validation passed"') &&
    productValidateBind.includes('showToast?.("Validation passed", "success")'),
  "13 success toast = Validation passed",
);
assert(
  validateFn.includes("target.validation = response.data") &&
    validateFn.includes("target.validationFresh = isValidationSuccessful(response.data)") &&
    !productValidateBind.includes("loadProductDetail"),
  "14 validationFresh becomes true after success",
);
assert(
  validationHtmlFn.includes("Validation current") &&
    validationHtmlFn.includes("Route validation passed.") &&
    validationHtmlFn.includes("Validation requires refresh") &&
    validationHtmlFn.includes(
      "Previous validation passed before the latest route change.",
    ) &&
    validationHtmlFn.includes("Validation failed"),
  "15 strip repaints current/pass",
);
assert(
  productHtmlFn.includes("C. Resolved effective route") &&
    productHtmlFn.includes("productState.effective.map") &&
    !productValidateBind.includes("loadProductDetail") &&
    !productValidateBind.includes("loadReadiness") &&
    !productValidateBind.includes("loadFamilyHistory"),
  "16 resolved 6-step route preserved",
);
assert(
  productHtmlFn.includes("B. Product deltas") &&
    productHtmlFn.includes("productState.overrides.map") &&
    !productValidateBind.includes("saveProductOverride") &&
    !productValidateBind.includes("deleteProductOverride"),
  "17 Product overrides preserved",
);
assert(
  productHtmlFn.includes("formatPrmRouteStatusLabel(routeStatus(header))") &&
    !productValidateBind.includes("submitProduct") &&
    !productValidateBind.includes("approveProduct"),
  "18 Draft status preserved",
);
assert(
  !productValidateBind.includes("submitProduct") &&
    !productValidateBind.includes("submit-product") &&
    !validateFn.includes("RPC.submitProduct"),
  "19 no auto-submit",
);
assert(
  !productValidateBind.includes("approveProduct") &&
    !productValidateBind.includes("approve-product") &&
    !validateFn.includes("RPC.approveProduct"),
  "20 no auto-approve",
);
assert(
  !productValidateBind.includes("refresh") &&
    !validateFn.includes("rpc_refresh") &&
    !validateFn.includes("Stage 03") &&
    !productValidateBind.includes("costing refresh"),
  "21 no costing refresh",
);
assert(
  isValidationSuccessful(failPayload) === false &&
    validateFn.includes("target.validationFresh = isValidationSuccessful(response.data)") &&
    productValidateBind.includes('showToast?.("Validation failed", "warning")'),
  "22 invalid result sets fresh=false",
);
assert(
  extractValidationIssues(failPayload).length === 1 &&
    validationHtmlFn.includes("extractValidationIssues") &&
    validationHtmlFn.includes("formatPrmValidationLabel") &&
    validationHtmlFn.includes("issue.message || issue.code"),
  "23 invalid errors rendered",
);
assert(
  validateFn.includes("rpcFailed: true") &&
    validateFn.includes("if (family) target.validationFresh = false") &&
    productValidateBind.includes("result?.rpcFailed || result?.error") &&
    /if \(result\?\.rpcFailed \|\| result\?\.error\) \{\s*return result;/.test(
      productValidateBind,
    ) &&
    productValidateBind.indexOf("rpcFailed") <
      productValidateBind.indexOf("Validation failed"),
  "24 RPC failure gets error feedback",
);
assert(
  productValidateBind.includes("withMutation(button") &&
    productValidateBind.includes("Validating…") &&
    mainSrc.includes("if (mutationInFlight)") &&
    mainSrc.includes('button.setAttribute("aria-busy", "true")'),
  "25 double-click/in-flight guarded",
);
assert(
  editorSrc.includes('if (response.ok) markValidationStale("product")') &&
    openDeltaFn.includes("preserveValidationStale: true") &&
    openDeltaFn.includes("loadProductDetail(state.selectedProductRouteId"),
  "26 delta save marks validation stale",
);
assert(
  loadProductFn.includes("preserveValidationStale = false") &&
    loadProductFn.includes("preserveValidationStale") &&
    loadProductFn.includes("? false") &&
    openDeltaFn.includes("preserveValidationStale: true") &&
    isValidationSuccessful(passPayload) === true,
  "27 detail reload after delta save does NOT restore fresh",
);
assert(
  deleteReloadFn.includes("deleteProductOverride") &&
    deleteReloadFn.includes("preserveValidationStale: true") &&
    editorSrc.includes("Unable to delete Product delta."),
  "28 delta delete marks validation stale",
);
assert(
  deleteReloadFn.includes("preserveValidationStale: true") &&
    loadProductFn.includes(
      "productState.validationFresh = preserveValidationStale",
    ),
  "29 detail reload after delta delete does NOT restore fresh",
);
assert(
  productHtmlFn.includes("resolvePrmProductRouteLifecycleActions") &&
    productHtmlFn.includes("lifecycle.submitVisible") &&
    productHtmlFn.includes("lifecycle.submitEnabled") &&
    editorSrc.includes('if (status !== "DRAFT")') &&
    editorSrc.includes(
      "Validate after the latest edits before submitting.",
    ),
  "30 Submit remains disabled after mutation until Validate; DRAFT-only submit",
);
assert(
  productHtmlFn.includes("lifecycle.submitEnabled") &&
    validateFn.includes("target.validationFresh = isValidationSuccessful(response.data)") &&
    !productValidateBind.includes("loadProductDetail"),
  "31 successful Validate enables Submit according to existing rules",
);
assert(
  loadProductFn.includes("preserveValidationStale = false") &&
    loadProductFn.includes(
      ": isValidationSuccessful(productState.validation)",
    ) &&
    mainSrc.includes("editor.loadProductDetail(productRouteId)") &&
    mainSrc.includes("editor.loadProductDetail(openId)"),
  "32 clean initial route open behavior not unnecessarily broken",
);
assert(
  !productValidateBind.includes("selectedProductRouteId") &&
    !validateFn.includes("selectedProductRouteId") &&
    mainSrc.includes("state.selectedProductRouteId = productRouteId"),
  "33 selectedProductRouteId preserved",
);
assert(
  productHtmlFn.includes("This Product route version is read-only.") &&
    productHtmlFn.includes("isPrmRouteReadOnlyStatus(routeStatus(header))") &&
    productHtmlFn.includes('data-prm-action="approve-product"') &&
    productHtmlFn.includes('data-prm-action="supersede-product"'),
  "34 Approved/read-only behavior unchanged",
);
assert(
  familyHtmlFn.includes('data-prm-action="validate-family"') &&
    familyValidateBind.includes("editor.validateFamily()") &&
    editorSrc.includes('validateFamily: "rpc_validate_route_family_route"') &&
    productValidateBind.includes("editor.validateProduct()") &&
    !productValidateBind.includes("validateFamily") &&
    !productValidateBind.includes("rpc_validate_route_family_route"),
  "35 Family validate action present; Product path unchanged",
);
assert(
  !editorSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !mainSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION"),
  "36 no server files",
);
assert(
  !thisSrc.includes("from \"../public/shared/js/supabase") &&
    !productValidateBind.includes("saveProductOverride") &&
    !productValidateBind.includes("deleteProductOverride") &&
    !productValidateBind.includes("submitProduct") &&
    built.params.p_product_route_id === 47,
  "37 no Route 47 write in fixtures",
);

function runPriorSmoke(relativePath, label) {
  const result = spawnSync(process.execPath, [join(root, relativePath)], {
    encoding: "utf8",
    cwd: root,
  });
  if (result.status !== 0) {
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
  assert(result.status === 0, label);
}

runPriorSmoke(
  "scripts/production-route-product-delta-authoring-smoke.mjs",
  "38 prior 3D smoke green",
);
runPriorSmoke(
  "scripts/production-route-product-delta-master-selection-smoke.mjs",
  "39 prior 3D.1 smoke green",
);
runPriorSmoke(
  "scripts/production-route-product-delta-searchable-selector-smoke.mjs",
  "40 prior 3D.2 smoke green",
);

assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "SW cache name present",
  "41 SW bumped exactly once after smokes",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-product-validate-handoff-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-product-validate-handoff-smoke: all passed");
