/**
 * Gate 11Y.10I.2C.3F.2B.2C.1 — Family Route Editor explicit validation + freshness.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not validate, submit, approve, or alter Family Route 11.
 */
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
  "scripts/production-route-family-validate-handoff-smoke.mjs",
);
const productSmokeSrc = read(
  "scripts/production-route-product-validate-handoff-smoke.mjs",
);

const familyHtmlFn =
  editorSrc.match(
    /function familyHtml\([\s\S]*?\n  function deltaRow/,
  )?.[0] || "";
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
const submitFn =
  editorSrc.match(
    /async function submit\(mode\) \{[\s\S]*?\n  async function approve/,
  )?.[0] || "";
const loadFamilyFn =
  editorSrc.match(
    /async function loadFamilyDetail\([\s\S]*?\n  async function loadProductDetail/,
  )?.[0] || "";
const loadProductFn =
  editorSrc.match(
    /async function loadProductDetail\([\s\S]*?\n  async function createFamilyDraft/,
  )?.[0] || "";
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
const familyIdFn =
  editorSrc.match(/const familyId = \(\) =>[\s\S]*?const productId/)?.[0] || "";
const saveFamilyFn =
  editorSrc.match(
    /async function saveFamilyStep\([\s\S]*?\n  async function deleteFamilyStep/,
  )?.[0] || "";
const deleteFamilyFn =
  editorSrc.match(
    /async function deleteFamilyStep\([\s\S]*?\n  async function applyFamilyStepOrder/,
  )?.[0] || "";
const applyOrderFn =
  editorSrc.match(
    /async function applyFamilyStepOrder\([\s\S]*?\n  async function updateProductDraft/,
  )?.[0] || "";
const buildValidateFamilyFn =
  rpcSrc.match(
    /export function buildValidateRouteFamilyRouteArgs\([\s\S]*?\nexport function buildSubmitRouteFamilyRouteArgs/,
  )?.[0] || "";

const saveReloadFn =
  mainSrc.match(
    /const result = await editor\.saveFamilyStep\([\s\S]*?return result;/,
  )?.[0] || "";
const deleteReloadFn =
  mainSrc.match(
    /const result = await editor\.deleteFamilyStep\([\s\S]*?return result;/,
  )?.[0] || "";
const orderReloadFn =
  mainSrc.match(
    /await editor\.applyFamilyStepOrder\([\s\S]*?render\(\);/,
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
  production_step_count: 4,
  rm_boundary_count: 1,
  fg_boundary_count: 1,
};
const failPayload = {
  valid: false,
  errors: [
    {
      code: "REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY",
      message: "Requires exactly one RM issue boundary",
    },
  ],
};

assert(
  familyHtmlFn.includes('data-prm-action="validate-family"') &&
    familyHtmlFn.includes(">Validate</button>"),
  "1 validate-family button/action",
);
assert(
  validateBindFn.includes('action === `validate-${mode}`') &&
    familyValidateBind.includes("editor.validateFamily()"),
  "2 Family click branch exists",
);
assert(
  familyValidateBind.includes("withMutation(familyButton") &&
    mainSrc.includes("if (mutationInFlight)") &&
    mainSrc.includes('button.setAttribute("aria-busy", "true")'),
  "3 withMutation used",
);
assert(
  familyValidateBind.includes("Validating…") &&
    familyValidateBind.includes("familyButton.textContent = originalLabel"),
  "4 Validating… state",
);
assert(
  validateFn.includes("const response = await invoke(") &&
    validateFn.includes("RPC.validateFamily") &&
    validateFn.includes(
      "Do not skip merely because validationFresh is already true",
    ) &&
    !validateFn.includes("if (target.validationFresh) return"),
  "5 explicit Validate always invokes RPC",
);
assert(
  validateFn.includes("if (!canEdit()) return denied();") &&
    validateFn.indexOf("if (!canEdit()) return denied();") <
      validateFn.indexOf("RPC.validateFamily"),
  "5a validate(mode) checks canEdit before RPC",
);
assert(
  submitFn.includes("if (!canEdit()) return denied();") &&
    submitFn.indexOf("if (!canEdit()) return denied();") <
      submitFn.indexOf("RPC.submitFamily"),
  "5b submit(mode) checks canEdit before RPC",
);
assert(
  validateBindFn.includes("if (!canEdit())") &&
    validateBindFn.includes('showToast?.("Edit permission required.", "warning")') &&
    validateBindFn.indexOf("if (!canEdit())") <
      validateBindFn.indexOf("editor.validateFamily()"),
  "5c family Validate handler denies view-only callers",
);
assert(
  familyIdFn.includes("familyState.detail?.family_route_id") &&
    familyIdFn.indexOf("detail?.family_route_id") <
      familyIdFn.indexOf("route_family_route_id") &&
    !/\.route_family_id/.test(familyIdFn) &&
    validateFn.includes(
      "buildValidateRouteFamilyRouteArgs({ family_route_id: familyId() })",
    ),
  "6 family_route_id resolution",
);

const built = buildValidateRouteFamilyRouteArgs({ family_route_id: 11 });
assert(
  built.ok === true &&
    Object.keys(built.params).join(",") === "p_family_route_id" &&
    built.params.p_family_route_id === 11 &&
    PRM_RPC_ARG_KEYS.rpc_validate_route_family_route.join(",") ===
      "p_family_route_id" &&
    !buildValidateFamilyFn.includes("p_route_family_id") &&
    !buildValidateFamilyFn.includes("p_product_route_id") &&
    !buildValidateFamilyFn.includes("p_product_id"),
  "7 p_family_route_id only",
);
assert(
  editorSrc.includes('validateFamily: "rpc_validate_route_family_route"') &&
    validateFn.includes("RPC.validateFamily") &&
    rpcSrc.includes(
      "rpc_validate_route_family_route: buildValidateRouteFamilyRouteArgs",
    ),
  "8 rpc_validate_route_family_route",
);
assert(
  !familyValidateBind.includes("validateProduct") &&
    !familyValidateBind.includes("rpc_validate_product_route") &&
    !validateFn.includes("buildValidateProductRouteArgs({ family_route_id") &&
    buildValidateProductRouteArgs({ product_route_id: 47 }).params
      .p_product_route_id === 47,
  "9 Product validator never called",
);
assert(
  validateFn.includes("target.validation = response.data") &&
    isValidationSuccessful(passPayload) === true,
  "10 success payload stored",
);
assert(
  validateFn.includes(
    "target.validationFresh = isValidationSuccessful(response.data)",
  ) && isValidationSuccessful(passPayload) === true,
  "11 success sets validationFresh true",
);
assert(
  familyValidateBind.includes('showToast?.("Validation passed", "success")'),
  "12 Validation passed toast",
);
assert(
  validateFn.includes("target.validation = response.data") &&
    extractValidationIssues(failPayload).length === 1,
  "13 invalid payload stored",
);
assert(
  isValidationSuccessful(failPayload) === false &&
    validateFn.includes(
      "target.validationFresh = isValidationSuccessful(response.data)",
    ),
  "14 invalid sets validationFresh false",
);
assert(
  familyValidateBind.includes('showToast?.("Validation failed", "warning")') &&
    familyHtmlFn.includes("Route invalid — open route details"),
  "15 Validation failed toast",
);
assert(
  validateFn.includes("rpcFailed: true") &&
    validateFn.includes("if (family) target.validationFresh = false") &&
    familyValidateBind.includes("result?.rpcFailed || result?.error") &&
    /if \(result\?\.rpcFailed \|\| result\?\.error\) \{\s*return result;/.test(
      familyValidateBind,
    ) &&
    familyValidateBind.indexOf("rpcFailed") <
      familyValidateBind.indexOf("Validation failed"),
  "16 RPC error does not double-toast failure",
);
assert(
  familyValidateBind.includes("render()") &&
    !familyValidateBind.includes("loadReadiness") &&
    !familyValidateBind.includes("loadFamilyHistory") &&
    !familyValidateBind.includes("loadFamilyDetail"),
  "17 render remains current Family Route Editor",
);
assert(
  !familyValidateBind.includes("selectedFamilyRouteId") &&
    !validateFn.includes("selectedFamilyRouteId") &&
    mainSrc.includes("state.selectedFamilyRouteId = familyRouteId"),
  "18 selected Route 11 preserved",
);
assert(
  familyHtmlFn.includes("steps.map((step) => stepRow(step") &&
    familyHtmlFn.includes("data-prm-family-step-table") &&
    !familyValidateBind.includes("familyState.steps = []") &&
    !familyValidateBind.includes("clearFamilyEditorContext"),
  "19 six step rows not cleared",
);
assert(
  !familyValidateBind.includes("submitFamily") &&
    !familyValidateBind.includes("submit-family") &&
    !validateFn.includes("RPC.submitFamily"),
  "20 no Submit in validation handler",
);
assert(
  !familyValidateBind.includes("approveFamily") &&
    !familyValidateBind.includes("approve-family") &&
    !validateFn.includes("RPC.approveFamily"),
  "21 no Approve",
);
assert(
  !familyValidateBind.includes("supersedeFamily") &&
    !familyValidateBind.includes("supersede-family") &&
    !validateFn.includes("RPC.supersedeFamily"),
  "22 no Supersede",
);
assert(
  !familyValidateBind.includes("rpc_refresh") &&
    !validateFn.includes("rpc_refresh") &&
    !familyValidateBind.includes("costing refresh") &&
    !validateFn.includes("Stage 03"),
  "23 no costing refresh",
);
assert(
  saveFamilyFn.includes('if (response.ok) markValidationStale("family")') &&
    saveReloadFn.includes('preserveValidationStale: true'),
  "24 markValidationStale after Add/Edit",
);
assert(
  deleteFamilyFn.includes('if (response.ok) markValidationStale("family")') &&
    deleteReloadFn.includes('preserveValidationStale: true'),
  "25 stale after Delete",
);
assert(
  applyOrderFn.includes('markValidationStale("family")') &&
    orderReloadFn.includes('preserveValidationStale: true'),
  "26 stale after reorder",
);
assert(
  loadFamilyFn.includes("preserveValidationStale = false") &&
    loadFamilyFn.includes("preserveValidationStale") &&
    loadFamilyFn.includes(
      "familyState.validationFresh = preserveValidationStale",
    ),
  "27 loadFamilyDetail supports preserveValidationStale",
);
assert(
  saveReloadFn.includes("preserveValidationStale: true") &&
    deleteReloadFn.includes("preserveValidationStale: true") &&
    orderReloadFn.includes("preserveValidationStale: true"),
  "28 post-mutation reload uses preserveValidationStale true",
);
assert(
  loadFamilyFn.includes("? false") &&
    loadFamilyFn.includes(
      ": isValidationSuccessful(familyState.validation)",
    ) &&
    isValidationSuccessful(passPayload) === true,
  "29 old valid=true detail cannot restore freshness after mutation",
);
assert(
  loadFamilyFn.includes("preserveValidationStale = false") &&
    mainSrc.includes("editor.loadFamilyDetail(familyRouteId)") &&
    !/loadFamilyDetail\(familyRouteId,\s*\{\s*preserveValidationStale:\s*true/.test(
      mainSrc,
    ),
  "30 initial clean open may initialize from stored validation",
);
assert(
  familyHtmlFn.includes(
    'data-prm-action="submit-family" ${familyState.validationFresh ? "" : "disabled"}',
  ) &&
    submitFn.includes("if (!target.validationFresh)") &&
    submitFn.includes("Validate after the latest edits before submitting."),
  "31 Submit disabled while stale",
);
assert(
  familyHtmlFn.includes("familyState.validationFresh") &&
    validateFn.includes(
      "target.validationFresh = isValidationSuccessful(response.data)",
    ) &&
    !familyValidateBind.includes("submitFamily"),
  "32 Submit enabled only after successful explicit Validate",
);
assert(
  productHtmlFn.includes('data-prm-action="validate-product"') &&
    productValidateBind.includes("editor.validateProduct()") &&
    productValidateBind.includes("withMutation(button") &&
    productValidateBind.includes('showToast?.("Validation passed", "success")') &&
    loadProductFn.includes("preserveValidationStale = false") &&
    productSmokeSrc.includes("35 Family validate action present; Product path unchanged"),
  "33 Product Validate path unchanged",
);
assert(
  !editorSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !mainSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !thisSrc.includes("from \"../public/shared/js/supabase"),
  "34 no server files changed",
);

assert(
  !familyValidateBind.includes("saveFamilyStep") &&
    !familyValidateBind.includes("deleteFamilyStep") &&
    built.params.p_family_route_id === 11,
  "no live Route 11 write in fixtures",
);
assert(
  /CACHE_NAME = "hub-cache-v291"/.test(swSrc),
  "SW bumped exactly once to hub-cache-v291",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-family-validate-handoff-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-validate-handoff-smoke: all passed");
