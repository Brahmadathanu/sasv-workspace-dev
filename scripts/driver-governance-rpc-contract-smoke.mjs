/**
 * Gate — Driver Governance RPC contract smoke.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST,
  DRIVER_GOVERNANCE_EXCLUDED_RPC_NAMES,
  DRIVER_GOVERNANCE_RPC_ARG_KEYS,
  DRIVER_GOVERNANCE_RPC_NAMES,
  buildApproveDriverPolicyEnvelopeArgs,
  buildGetCostDriverGovernanceDetailArgs,
  buildGetCostDriverPolicyRegistryArgs,
  buildSubmitSpecialisedDriverPolicyArgs,
  enforceExactDriverGovernanceRpcKeys,
} from "../public/shared/js/costing-suite-driver-governance-helpers.js";
import { PRODUCTION_ROUTE_RPC_NAMES } from "../public/shared/js/costing-suite-production-route-helpers.js";
import { COST_BUILD_LENS_IDS } from "../public/shared/js/costing-suite-cost-build.js";

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

const expectedNames = [
  "rpc_get_cost_driver_policy_registry",
  "rpc_get_cost_driver_governance_detail",
  "rpc_submit_direct_labour_workload_policy_for_review",
  "rpc_approve_direct_labour_workload_policy",
  "rpc_submit_production_overhead_workload_policy_for_review",
  "rpc_approve_production_overhead_workload_policy",
  "rpc_submit_cost_driver_policy_envelope_for_review",
  "rpc_approve_cost_driver_policy_envelope",
];

assert(
  expectedNames.every((n) => Object.values(DRIVER_GOVERNANCE_RPC_NAMES).includes(n) || DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST.includes(n) || n.includes("get_")),
  "expected RPC names present",
);
assert(
  DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST.length === 6,
  "exactly six allowlisted action RPCs",
);
assert(
  DRIVER_GOVERNANCE_EXCLUDED_RPC_NAMES.includes(
    "rpc_create_cost_driver_policy_envelope_draft",
  ),
  "draft create excluded",
);

for (const name of Object.values(DRIVER_GOVERNANCE_RPC_NAMES)) {
  assert(
    Array.isArray(DRIVER_GOVERNANCE_RPC_ARG_KEYS[name]),
    `arg keys defined for ${name}`,
  );
}

assert(
  buildGetCostDriverPolicyRegistryArgs({}).ok,
  "registry builder ok",
);
assert(
  buildGetCostDriverGovernanceDetailArgs({ cost_element_code: "ADMINISTRATION" })
    .ok,
  "detail builder ok",
);
assert(
  buildSubmitSpecialisedDriverPolicyArgs({ record_id: 2 }).ok,
  "submit specialised ok",
);
assert(
  buildApproveDriverPolicyEnvelopeArgs({
    record_id: 2,
    approval_reference: "REF-ADMIN-OK",
  }).ok,
  "approve envelope ok",
);
assert(
  !enforceExactDriverGovernanceRpcKeys(
    DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
    { p_envelope_id: 2, p_approval_reference: "x", p_extra: 1 },
  ).ok,
  "approve envelope rejects extra keys",
);

assert(
  !PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_cost_driver_policy_registry",
  ) &&
    !PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_approve_cost_driver_policy_envelope",
    ),
  "Driver Governance RPCs not added to PRM inventory",
);

assert(
  COST_BUILD_LENS_IDS.length === 3,
  "cost-build controller still has exactly three legacy lenses",
);

const ctrl = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-driver-governance.js"),
  "utf8",
);
const shell = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
assert(shell.includes("PERM_PRM_EDIT"), "shell resolves PERM_PRM_EDIT");
assert(
  shell.includes("createDriverGovernanceController"),
  "shell wires driver governance controller",
);
assert(
  ctrl.includes("newTab: true") || shell.includes("newTab"),
  "PRM handoff can open new tab",
);
assert(
  !ctrl.includes("rpc_create_cost_driver_policy_envelope_draft"),
  "controller never references draft-create RPC",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll driver-governance RPC contract smokes passed");
