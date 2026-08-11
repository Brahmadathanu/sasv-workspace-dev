/**
 * Gate — Driver Governance helpers smoke.
 */
import {
  DRIVER_GOVERNANCE_ACTION_CODES,
  DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST,
  DRIVER_GOVERNANCE_CANONICAL_ELEMENTS,
  DRIVER_GOVERNANCE_EXCLUDED_RPC_NAMES,
  DRIVER_GOVERNANCE_FORBIDDEN_RPC_SUBSTRINGS,
  DRIVER_GOVERNANCE_LENS_ID,
  DRIVER_GOVERNANCE_PERMISSION_TARGET,
  DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET,
  DRIVER_GOVERNANCE_RPC_NAMES,
  buildApproveDriverPolicyEnvelopeArgs,
  buildApproveSpecialisedDriverPolicyArgs,
  buildDriverGovernanceActionArgs,
  buildDriverGovernanceLogicSections,
  buildDriverGovernancePrmHandoffLinks,
  buildGetCostDriverGovernanceDetailArgs,
  buildGetCostDriverPolicyRegistryArgs,
  buildSubmitDriverPolicyEnvelopeArgs,
  buildSubmitSpecialisedDriverPolicyArgs,
  enforceExactDriverGovernanceRpcKeys,
  evaluateDriverGovernanceActionDispatch,
  filterVisibleDriverGovernanceActions,
  isDriverGovernanceLens,
  isMeaningfulDriverGovernanceApprovalReference,
  isPrmOwnedDriverCostElement,
  normalizeDriverGovernanceCode,
  normalizeDriverGovernanceFormulaExplanation,
  unwrapDriverGovernanceDetailPayload,
  unwrapDriverGovernanceRegistryPayload,
} from "../public/shared/js/costing-suite-driver-governance-helpers.js";
import {
  COSTING_SUITE_MODULES,
  LENS_REGISTRY,
} from "../public/shared/js/costing-suite-registry.js";
import { COSTING_ROUTE_CONFIG } from "../public/shared/js/costing-route-config.js";
import { COST_BUILD_LENS_IDS } from "../public/shared/js/costing-suite-cost-build.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("OK", msg);
  else {
    failed += 1;
    console.error("FAIL", msg);
  }
}

assert(isDriverGovernanceLens("driver-governance"), "isDriverGovernanceLens true");
assert(!isDriverGovernanceLens("cost-governance"), "isDriverGovernanceLens false for other");

assert(
  COSTING_ROUTE_CONFIG["cost-build-manager"].allowedLensIds.includes(
    DRIVER_GOVERNANCE_LENS_ID,
  ),
  "driver-governance registered in route-config",
);
assert(
  LENS_REGISTRY["driver-governance"]?.suiteId === "cost-build" &&
    LENS_REGISTRY["driver-governance"]?.periodScoped === false,
  "driver-governance lens metadata",
);
assert(
  COSTING_SUITE_MODULES.find((s) => s.id === "cost-build")?.lensIds.includes(
    "driver-governance",
  ),
  "driver-governance in suite lensIds",
);

assert(
  COST_BUILD_LENS_IDS.includes("cost-governance") &&
    COST_BUILD_LENS_IDS.includes("staff-governance") &&
    COST_BUILD_LENS_IDS.includes("manual-provisions") &&
    !COST_BUILD_LENS_IDS.includes("driver-governance"),
  "existing three Cost Build lenses preserved; driver-governance separate",
);

const reg = buildGetCostDriverPolicyRegistryArgs({});
assert(
  reg.ok &&
    JSON.stringify(Object.keys(reg.params).sort()) ===
      JSON.stringify(["p_cost_element_code"]),
  "registry RPC builder exact keys",
);
assert(
  !enforceExactDriverGovernanceRpcKeys(DRIVER_GOVERNANCE_RPC_NAMES.registry, {
    ...reg.params,
    p_extra: true,
  }).ok,
  "registry rejects unsupported keys",
);

const det = buildGetCostDriverGovernanceDetailArgs({
  cost_element_code: "DIRECT_LABOUR",
});
assert(
  det.ok &&
    det.params.p_cost_element_code === "DIRECT_LABOUR" &&
    JSON.stringify(Object.keys(det.params).sort()) ===
      JSON.stringify(["p_cost_element_code"]),
  "detail RPC builder exact keys",
);

const subSpec = buildSubmitSpecialisedDriverPolicyArgs({ record_id: 2 });
assert(
  subSpec.ok &&
    JSON.stringify(Object.keys(subSpec.params).sort()) ===
      JSON.stringify(["p_policy_id"]) &&
    subSpec.params.p_policy_id === 2,
  "specialised submit args exact keys",
);
const apprSpec = buildApproveSpecialisedDriverPolicyArgs({
  record_id: 2,
  approval_reference: "APPROVE-DL-001",
});
assert(
  apprSpec.ok &&
    JSON.stringify(Object.keys(apprSpec.params).sort()) ===
      JSON.stringify(["p_approval_reference", "p_policy_id"]),
  "specialised approve args exact keys",
);
const subEnv = buildSubmitDriverPolicyEnvelopeArgs({ record_id: 2 });
assert(
  subEnv.ok &&
    JSON.stringify(Object.keys(subEnv.params).sort()) ===
      JSON.stringify(["p_envelope_id"]),
  "envelope submit args exact keys",
);
const apprEnv = buildApproveDriverPolicyEnvelopeArgs({
  record_id: 3,
  approval_reference: "APPROVE-ADMIN-001",
});
assert(
  apprEnv.ok &&
    JSON.stringify(Object.keys(apprEnv.params).sort()) ===
      JSON.stringify(["p_approval_reference", "p_envelope_id"]),
  "envelope approve args exact keys",
);

assert(
  !buildDriverGovernanceActionArgs({
    action_code: "APPROVE",
    enabled: true,
    rpc: "rpc_unknown_policy_thing",
    record_id: 1,
  }).ok,
  "unknown action RPC rejected",
);

assert(
  !buildSubmitSpecialisedDriverPolicyArgs({ record_id: 0 }).ok &&
    !buildSubmitSpecialisedDriverPolicyArgs({ record_id: -1 }).ok,
  "record_id must be positive",
);

assert(
  !evaluateDriverGovernanceActionDispatch(
    {
      action_code: "APPROVE",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PERMISSION_TARGET,
    },
    {
      canEditCbm: true,
      canEditPrm: false,
      selectedCostElementCode: "ADMINISTRATION",
      actionCostElementCode: "FINANCE_ADMIN",
      actionToken: 1,
      detailActionToken: 1,
    },
  ).ok,
  "stale action rejected when cost element mismatches",
);

assert(
  !evaluateDriverGovernanceActionDispatch(
    {
      action_code: "APPROVE",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PERMISSION_TARGET,
    },
    {
      canEditCbm: true,
      actionToken: 1,
      detailActionToken: 2,
      selectedCostElementCode: "ADMINISTRATION",
      actionCostElementCode: "ADMINISTRATION",
    },
  ).ok,
  "stale action token rejected",
);

assert(
  DRIVER_GOVERNANCE_EXCLUDED_RPC_NAMES.includes(
    "rpc_create_cost_driver_policy_envelope_draft",
  ) &&
    !DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST.includes(
      "rpc_create_cost_driver_policy_envelope_draft",
    ),
  "draft-create RPC absent from UI dispatcher allowlist",
);

assert(
  !isMeaningfulDriverGovernanceApprovalReference("ab") &&
    isMeaningfulDriverGovernanceApprovalReference("APPROVE-1"),
  "approval reference min length 5",
);

const visibleEnv = filterVisibleDriverGovernanceActions(
  [
    {
      action_code: "APPROVE",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PERMISSION_TARGET,
    },
  ],
  { canEditCbm: false, canEditPrm: true },
);
assert(visibleEnv.length === 0, "CBM edit required for envelope actions");

const visibleDl = filterVisibleDriverGovernanceActions(
  [
    {
      action_code: "SUBMIT_FOR_REVIEW",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.submitDirectLabour,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET,
    },
  ],
  { canEditCbm: true, canEditPrm: false },
);
assert(visibleDl.length === 0, "PRM edit required for DL/POH actions");

const visibleDlOk = filterVisibleDriverGovernanceActions(
  [
    {
      action_code: "SUBMIT_FOR_REVIEW",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.submitDirectLabour,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET,
    },
  ],
  { canEditCbm: false, canEditPrm: true },
);
assert(visibleDlOk.length === 1, "PRM edit shows DL submit");

const viewOnly = filterVisibleDriverGovernanceActions(
  [
    {
      action_code: "APPROVE",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PERMISSION_TARGET,
    },
  ],
  { canEditCbm: false, canEditPrm: false, viewOnly: true },
);
assert(viewOnly.length === 0, "view-only state hides mutation controls");

const links = buildDriverGovernancePrmHandoffLinks();
assert(
  links.some((l) => l.lens === "shared-workload-preview") &&
    links.some((l) => l.lens === "route-families") &&
    links.some((l) => l.lens === "product-route-assignments") &&
    links.some((l) => l.lens === "route-readiness"),
  "PRM links use correct lens IDs",
);

assert(isPrmOwnedDriverCostElement("DIRECT_LABOUR"), "DL is PRM-owned");
assert(!isPrmOwnedDriverCostElement("MARKETING_EXPENSE"), "Marketing not PRM-owned");

const unreg = unwrapDriverGovernanceDetailPayload({
  cost_element: { code: "MARKETING_EXPENSE", label: "Marketing Expense" },
  registry: { is_registered: false },
  detail: {},
  actions: [],
  owner_module: "cost-build-manager",
  cutover_authorised: false,
});
assert(unreg.is_unregistered === true, "unregistered state renders safely");

const withFactors = unwrapDriverGovernanceDetailPayload({
  detail: {
    current_policy: { policy_id: 2, status: "DRAFT" },
    scope_factors: [{ name: "A", value: 1 }],
    behaviour_factors: [],
    resource_factors: null,
  },
  actions: [],
});
assert(
  withFactors.detail.scope_factors.length === 1 &&
    withFactors.detail.behaviour_factors.length === 0 &&
    withFactors.detail.resource_factors.length === 0,
  "factor sections omitted when empty (empty arrays)",
);

assert(
  DRIVER_GOVERNANCE_CANONICAL_ELEMENTS.length === 7 &&
    DRIVER_GOVERNANCE_CANONICAL_ELEMENTS[0].code === "DIRECT_LABOUR" &&
    DRIVER_GOVERNANCE_CANONICAL_ELEMENTS[6].code === "MARKETING_EXPENSE",
  "seven canonical elements in sort order",
);

const fallbackOnly = unwrapDriverGovernanceRegistryPayload([]);
assert(
  fallbackOnly.length === 7 &&
    fallbackOnly.every((r) => r.validation_status == null),
  "fallback is used only for zero usable server rows",
);

const serverSeven = unwrapDriverGovernanceRegistryPayload([
  {
    cost_element_code: "DIRECT_LABOUR",
    cost_element_label: "Direct Labour",
    sort_order: 1,
    lifecycle_status: "REVIEW_REQUIRED",
    formula_type: "STANDARD_BATCH_ROUTE_ATTENDANCE",
    effective_from: "2026-08-06",
  },
  {
    cost_element_code: "PRODUCTION_OVERHEAD",
    cost_element_label: "Production Overhead",
    sort_order: 2,
    lifecycle_status: "APPROVED",
  },
  {
    cost_element_code: "QUALITY_CONTROL_OVERHEAD",
    cost_element_label: "Quality Control Overhead",
    sort_order: 3,
    is_registered: false,
  },
  {
    cost_element_code: "MATERIALS_STORES_OVERHEAD",
    cost_element_label: "Materials / Stores Overhead",
    sort_order: 4,
    is_registered: false,
  },
  {
    cost_element_code: "ADMIN_OVERHEAD",
    cost_element_label: "Administrative Overhead",
    sort_order: 5,
    lifecycle_status: "REVIEW_REQUIRED",
  },
  {
    cost_element_code: "FINANCE_ADMIN_OVERHEAD",
    cost_element_label: "Finance/Admin Overhead",
    sort_order: 6,
    lifecycle_status: "REVIEW_REQUIRED",
  },
  {
    cost_element_code: "MARKETING_EXPENSE",
    cost_element_label: "Marketing Expense",
    sort_order: 7,
    is_registered: false,
  },
]);
assert(serverSeven.length === 7, "seven-row server registry does not become eleven");
assert(
  new Set(serverSeven.map((r) => r.cost_element_code)).size === 7,
  "no duplicate logical cost elements",
);
assert(
  serverSeven.filter((r) => r.cost_element_code === "DIRECT_LABOUR").length === 1,
  "DIRECT_LABOUR appears once",
);
assert(
  serverSeven.filter((r) => r.cost_element_code === "ADMIN_OVERHEAD").length === 1,
  "ADMIN_OVERHEAD appears once",
);
assert(
  serverSeven.filter((r) => r.cost_element_code === "FINANCE_ADMIN_OVERHEAD")
    .length === 1,
  "FINANCE_ADMIN_OVERHEAD appears once",
);
assert(
  serverSeven.filter((r) => r.cost_element_code === "MARKETING_EXPENSE").length ===
    1,
  "MARKETING_EXPENSE appears once",
);
assert(
  !serverSeven.some((r) => r.cost_element_code === "ADMINISTRATION") &&
    !serverSeven.some((r) => r.cost_element_code === "QUALITY_CONTROL") &&
    !serverSeven.some((r) => r.cost_element_label === "Administration"),
  "no label-based duplication with legacy fallback codes",
);
assert(
  serverSeven[0].lifecycle_status === "REVIEW_REQUIRED" &&
    serverSeven[0].formula_type === "STANDARD_BATCH_ROUTE_ATTENDANCE" &&
    serverSeven[0].effective_from === "2026-08-06",
  "Direct Labour REVIEW_REQUIRED is rendered from fresh response",
);

const mixedLegacyLabels = unwrapDriverGovernanceRegistryPayload([
  {
    cost_element_code: "ADMIN_OVERHEAD",
    cost_element_label: "Administrative Overhead",
    sort_order: 5,
  },
  {
    cost_element_code: "QUALITY_CONTROL_OVERHEAD",
    cost_element_label: "Quality Control Overhead",
    sort_order: 3,
  },
]);
assert(
  mixedLegacyLabels.length === 2 &&
    !mixedLegacyLabels.some((r) => r.cost_element_code === "ADMINISTRATION"),
  "rows are keyed by cost_element_code, not label",
);

assert(
  normalizeDriverGovernanceCode("Finance/Admin") === "FINANCE_ADMIN_OVERHEAD",
  "Finance/Admin code normalizes",
);

const dlFresh = unwrapDriverGovernanceDetailPayload({
  cost_element: { code: "DIRECT_LABOUR", label: "Direct Labour" },
  detail: {
    current_policy: {
      policy_id: 2,
      lifecycle_status: "REVIEW_REQUIRED",
      formula_type: "STANDARD_BATCH_ROUTE_ATTENDANCE",
      effective_from: "2026-08-06",
    },
    formula_explanation: {
      title: "Direct Labour workload",
      purpose: "Allocate DL using route attendance.",
      equation: "DL = attendance × rate",
      calculation_steps: ["Collect attendance", "Apply rate"],
      evidence_basis: ["BMR attendance"],
      status_treatment: "REVIEW_REQUIRED blocks cutover",
      redistribution_rule: "Recompute next refresh",
      interpretation: "Policy awaiting approval",
      future_improvements: "Add skill weighting",
      unknown_server_key: { nested: true },
    },
  },
  actions: [
    {
      action_code: "APPROVE",
      enabled: true,
      rpc: DRIVER_GOVERNANCE_RPC_NAMES.approveDirectLabour,
      record_id: 2,
      required_module: DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET,
    },
  ],
});
assert(
  dlFresh.detail.current_policy.lifecycle_status === "REVIEW_REQUIRED",
  "fresh detail lifecycle REVIEW_REQUIRED",
);
assert(
  Array.isArray(dlFresh.actions) &&
    dlFresh.actions.every((a) => a.action_code !== "SUBMIT_FOR_REVIEW"),
  "old Submit action is discarded after reload (fresh actions only)",
);
assert(
  dlFresh.detail.formula_explanation?.title === "Direct Labour workload" &&
    dlFresh.detail.formula_explanation?.equation === "DL = attendance × rate",
  "formula_explanation fields render safely",
);

const logicSections = buildDriverGovernanceLogicSections(
  dlFresh.detail.formula_explanation,
);
assert(
  logicSections.some((s) => s.id === "purpose") &&
    logicSections.some((s) => s.id === "calculation_steps") &&
    !JSON.stringify(logicSections).includes("unknown_server_key"),
  "unknown explanation keys do not break the drawer",
);

const sparseExpl = normalizeDriverGovernanceFormulaExplanation({
  title: "",
  purpose: "Purpose only",
  equation: "",
  calculation_steps: [],
  evidence_basis: [],
  status_treatment: null,
  redistribution_rule: "  ",
  interpretation: undefined,
  future_improvements: "Later",
});
assert(
  sparseExpl.purpose === "Purpose only" &&
    sparseExpl.future_improvements === "Later" &&
    sparseExpl.equation == null &&
    sparseExpl.calculation_steps.length === 0,
  "empty explanation fields are omitted",
);
assert(
  !buildDriverGovernanceLogicSections(sparseExpl).some(
    (s) => s.id === "equation" || s.id === "calculation_steps",
  ),
  "empty equation/steps omitted from Driver Logic sections",
);

const ctrlJs = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-driver-governance.js"),
  "utf8",
);
const helpersJs = fs.readFileSync(
  path.join(
    root,
    "public/shared/js/costing-suite-driver-governance-helpers.js",
  ),
  "utf8",
);
assert(
  !ctrlJs.includes("JSON.stringify(d.formula_explanation") &&
    !ctrlJs.includes("JSON.stringify(explanation") &&
    ctrlJs.includes("Driver Logic") &&
    ctrlJs.includes("buildDriverGovernanceLogicSections"),
  "raw JSON is not shown",
);
assert(
  !/\.from\(\s*["'][^"']*policy/.test(ctrlJs) &&
    !/\.from\(\s*["'][^"']*factor/.test(ctrlJs),
  "no direct policy/factor table CRUD in controller",
);
for (const bad of DRIVER_GOVERNANCE_FORBIDDEN_RPC_SUBSTRINGS) {
  // Cutover disclaimer / labels may mention Stage 03; ban RPC-like tokens only.
  if (bad === "stage03" || bad === "stage_03") {
    assert(
      !/rpc_[a-z0-9_]*stage_?03/i.test(ctrlJs),
      `forbidden Stage 03 RPC absent from controller`,
    );
    continue;
  }
  assert(
    !ctrlJs.toLowerCase().includes(bad.toLowerCase()) ||
      bad === "rpc_create_cost_driver_policy_envelope_draft",
    `forbidden substring absent from controller: ${bad}`,
  );
}
assert(
  !ctrlJs.includes("rpc_create_cost_driver_policy_envelope_draft") &&
    helpersJs.includes("rpc_create_cost_driver_policy_envelope_draft"),
  "draft-create listed only as excluded, not invoked",
);
assert(
  !ctrlJs.includes("rpc_refresh_cost") &&
    !ctrlJs.includes("create_costing_snapshot") &&
    !/rpc_[a-z0-9_]*stage_?03/i.test(ctrlJs),
  "no refresh / snapshot / Stage 03 RPC",
);

assert(
  DRIVER_GOVERNANCE_ACTION_CODES.SUBMIT_FOR_REVIEW === "SUBMIT_FOR_REVIEW",
  "submit action code constant",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll driver-governance helpers smokes passed");
