/**
 * Gate 11Y.10I.2C.2A.2 — PRM Master-Options Hydration & Setup-Chip Hardening.
 * Non-mutating source/contract smoke only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_COST_CENTRE_LOADING_CHIP,
  PRM_COST_CENTRE_SETUP_CHIP,
  PRM_COST_CENTRE_UNAVAILABLE_CHIP,
  resolvePrmCostCentreSetupChip,
  summarizePrmCostCentreSetup,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const stepFormSrc = read("public/shared/js/costing-suite-production-route-step-form.js");
const ccSrc = read("public/shared/js/costing-suite-production-route-cost-centres.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const centres15 = Array.from({ length: 15 }, (_, i) => ({
  cost_centre_id: i + 1,
  status: "APPROVED",
  pool_scope: i < 10 ? "SHARED_ROUTE" : "EXCLUDED_OTHER_POOL",
}));

assert(
  resolvePrmCostCentreSetupChip({
    optionsStatus: "uninitialized",
  }).chip === PRM_COST_CENTRE_LOADING_CHIP &&
    resolvePrmCostCentreSetupChip({
      optionsStatus: "uninitialized",
    }).setupRequired === false,
  "1 uninitialized does not produce Setup required",
);
assert(
  resolvePrmCostCentreSetupChip({
    optionsStatus: "loading",
    options: { cost_centres: [] },
  }).chip === PRM_COST_CENTRE_LOADING_CHIP &&
    resolvePrmCostCentreSetupChip({
      optionsStatus: "loading",
    }).setupRequired === false,
  "2 loading does not produce Setup required",
);
assert(
  resolvePrmCostCentreSetupChip({
    optionsStatus: "ready",
    options: { cost_centres: centres15 },
  }).chip === "Cost centres: 15 approved",
  "3 ready + 15 approved -> 15 approved",
);
assert(
  resolvePrmCostCentreSetupChip({
    optionsStatus: "ready",
    options: { cost_centres: [] },
  }).chip === PRM_COST_CENTRE_SETUP_CHIP &&
    summarizePrmCostCentreSetup({ cost_centres: [] }).setupRequired === true,
  "4 ready + 0 -> Setup required",
);
assert(
  resolvePrmCostCentreSetupChip({
    optionsStatus: "error",
    options: { cost_centres: [] },
  }).chip === PRM_COST_CENTRE_UNAVAILABLE_CHIP &&
    resolvePrmCostCentreSetupChip({
      optionsStatus: "error",
    }).setupRequired === false,
  "5 error -> Unavailable",
);
assert(
  mainSrc.includes('optionsStatus: "uninitialized"') &&
    mainSrc.includes("renderSetupChip()") &&
    mainSrc.includes("resolvePrmCostCentreSetupChip"),
  "6 initial render before options response safe",
);
assert(
  /state\.optionsStatus = "ready"[\s\S]*renderSetupChip\(\)/.test(mainSrc) &&
    mainSrc.includes('state.optionsStatus = "loading"'),
  "7 successful options commit repaints setup chip",
);
assert(
  /active === "route-family-route-editor"[\s\S]*ensureMasterOptions\(/.test(
    mainSrc,
  ),
  "8 hard-refresh Route Editor ensures options",
);
assert(
  /familyRouteId == null[\s\S]*ensureMasterOptions|optionsPromise = ensureMasterOptions[\s\S]*familyRouteId == null/.test(
    mainSrc,
  ),
  "9 direct empty-state Route Editor ensures options",
);
assert(
  /loadFamilyDetail[\s\S]*ensureMasterOptions|Promise\.all\([\s\S]*loadFamilyDetail[\s\S]*optionsPromise/.test(
    mainSrc,
  ),
  "10 contextual Route Editor ensures options",
);
assert(
  /active === "product-route-editor"[\s\S]*ensureMasterOptions\(/.test(mainSrc),
  "11 Product Route Editor cold entry safe",
);
assert(
  /loadFoundationReview[\s\S]*ensureMasterOptions\(/.test(mainSrc) ||
    /foundationTotalCount[\s\S]*ensureMasterOptions\(/.test(mainSrc),
  "12 Foundation Review cold entry safe",
);
assert(
  /active === "production-cost-centres"[\s\S]*ensureMasterOptions\(/.test(
    mainSrc,
  ) && ccSrc.includes("createProductionCostCentresController"),
  "13 Cost Centres remains safe",
);
assert(
  !/refreshAfterAssignmentMutation[\s\S]{0,200}state\.options = null/.test(
    mainSrc,
  ) &&
    /refreshAfterAssignmentMutation[\s\S]*optionsStatus = "loading"/.test(
      mainSrc,
    ),
  "14 trusted READY object not replaced by transient empty/null",
);
assert(
  /refreshAfterAssignmentMutation[\s\S]*optionsStatus = "loading"[\s\S]*loadMasterOptions/.test(
    mainSrc,
  ),
  "15 refreshAfterAssignmentMutation uses hydration state",
);
assert(
  mainSrc.includes("syncCostCentreBlockerFromOptions") &&
    /optionsStatus !== "ready"|!isPrmMasterOptionsReady\(state\.optionsStatus\)/.test(
      mainSrc,
    ) &&
    mainSrc.includes("costCentreBlocker: true"),
  "16 costCentreBlocker not false-authoritative while unhydrated",
);
assert(
  mainSrc.includes("requireMasterOptionsForStepAuthoring") &&
    stepFormSrc.includes("activities"),
  "17 Activity catalogue unavailable until READY",
);
assert(
  stepFormSrc.includes("behaviours") &&
    mainSrc.includes("requireMasterOptionsForStepAuthoring"),
  "18 Behaviour catalogue unavailable until READY",
);
assert(
  stepFormSrc.includes("resource_classes") &&
    mainSrc.includes("requireMasterOptionsForStepAuthoring"),
  "19 Resource catalogue unavailable until READY",
);
assert(
  stepFormSrc.includes("filterPrmPlantsByLocation") &&
    mainSrc.includes("requireMasterOptionsForStepAuthoring"),
  "20 hierarchy catalogue unavailable until READY",
);
assert(
  stepFormSrc.includes("cost_centres") &&
    mainSrc.includes("requireMasterOptionsForStepAuthoring"),
  "21 Cost Centre catalogue unavailable until READY",
);
assert(
  rpcSrc.includes("rpc_get_production_route_master_options") &&
    !mainSrc.includes("rpc_count_production_cost_centres") &&
    !helpersSrc.includes("rpc_count_production_cost_centres"),
  "22 no new RPC inventory",
);
assert(!mainSrc.includes("apply_migration"), "23 no server changes");
assert(
  !mainSrc.includes("mutateCostCentreMaster") &&
    !editorSrc.includes("createCostCentre"),
  "24 no master mutation",
);
assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !editorSrc.includes("refreshCost"),
  "25 no costing refresh",
);
assert(
  !mainSrc.includes("run82Write") && !editorSrc.includes("Run-82"),
  "26 no Run-82 write",
);
assert(
  editorSrc.includes("createProductionRouteEditorController") &&
    editorSrc.includes("clone-family-route"),
  "27 C.2A unchanged",
);
assert(
  ccSrc.includes("createProductionCostCentresController") &&
    mainSrc.includes("production-cost-centres"),
  "28 Cost Centres C.1 unchanged",
);
assert(
  mainSrc.includes("route-family-mapping-review"),
  "29 Mapping Review unchanged",
);
assert(
  mainSrc.includes("route-family-foundation-review") &&
    mainSrc.includes("loadFoundationReview"),
  "30 Foundation Review business behavior unchanged",
);
assert(
  mainSrc.includes("PRODUCTION_ROUTE_MODULE_KEY") &&
    htmlSrc.includes("production-route-manager"),
  "31 CCC unchanged",
);
assert(
  htmlSrc.includes("cp-prm-setup-chip--loading") &&
    htmlSrc.includes("--sasv-") &&
    helpersSrc.includes("PRM_COST_CENTRE_LOADING_CHIP"),
  "32 semantic theme only",
);
assert(
  /CACHE_NAME = "hub-cache-v264"/.test(swSrc),
  "33 exactly one SW bump after all smokes pass (hub-cache-v264)",
);

if (failed) {
  console.error(
    `production-route-master-options-hydration-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-master-options-hydration-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_2A_2_BROWSER_ACCEPTANCE");
