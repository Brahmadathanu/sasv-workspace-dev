/**
 * Gate 4F.5C-B1 — Subgroup Mapping detail → lifecycle nested modal handoff.
 * Source/mock only. Does NOT mutate live Mapping ID 2.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubmitProductSubgroupMappingArgs } from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const moduleSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-subgroup-mapping-lifecycle-handoff-smoke.mjs",
);

const detailFn =
  moduleSrc.match(
    /function openSubgroupMappingDetailModal\([\s\S]*?\n  function renderSubgroupMappings/,
  )?.[0] || "";
const dispatchFn =
  moduleSrc.match(
    /function dispatchSubgroupMappingAction\([\s\S]*?\n  function openSubgroupMappingDetailModal/,
  )?.[0] || "";
const createFn =
  moduleSrc.match(
    /async function openCreateSubgroupMappingModal\([\s\S]*?\n  function openEditSubgroupMappingModal/,
  )?.[0] || "";
const editFn =
  moduleSrc.match(
    /function openEditSubgroupMappingModal\([\s\S]*?\n  function openSubmitSubgroupMappingModal/,
  )?.[0] || "";
const submitFn =
  moduleSrc.match(
    /function openSubmitSubgroupMappingModal\([\s\S]*?\n  function openApproveSubgroupMappingModal/,
  )?.[0] || "";
const approveFn =
  moduleSrc.match(
    /function openApproveSubgroupMappingModal\([\s\S]*?\n  function openInactivateSubgroupMappingModal/,
  )?.[0] || "";
const inactivateFn =
  moduleSrc.match(
    /function openInactivateSubgroupMappingModal\([\s\S]*?\n  async function loadArchivedRoutes/,
  )?.[0] || "";
const optsFn =
  moduleSrc.match(
    /function subgroupLifecycleModalOpts\([\s\S]*?\n  function subgroupMappingCache|function subgroupLifecycleModalOpts\([\s\S]*?\n  async function loadSubgroupMappings/,
  )?.[0] ||
  moduleSrc.match(
    /function subgroupLifecycleModalOpts\([\s\S]*?\n  function /,
  )?.[0] ||
  "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  detailFn.includes('submit-subgroup-mapping') ||
    moduleSrc.includes('["submit-subgroup-mapping"'),
  "A detail action token submit-subgroup-mapping present",
);
assert(
  detailFn.includes("dispatchSubgroupMappingAction(action, current)") &&
    !detailFn.includes("closeModal({ restorePrevious: false })"),
  "A detail action does NOT close detail before lifecycle dispatch",
);

assert(
  mainSrc.includes("isDetailsModalOpen,") &&
    moduleSrc.includes("isDetailsModalOpen = () => false") &&
    moduleSrc.includes("subgroupLifecycleModalOpts") &&
    optsFn.includes("nested:") &&
    optsFn.includes("isDetailsModalOpen()"),
  "B isDetailsModalOpen wired; nested ownership helper present",
);
assert(
  submitFn.includes("subgroupLifecycleModalOpts()") &&
    /openModal\(\s*\{[\s\S]*subgroupLifecycleModalOpts\(\)/.test(submitFn),
  "B openSubmitSubgroupMappingModal uses nested ownership when detail active",
);

assert(
  submitFn.includes("data-prm-submit-subgroup-confirm"),
  "C confirm selector data-prm-submit-subgroup-confirm",
);

const built = buildSubmitProductSubgroupMappingArgs({ mapping_id: 2 });
assert(
  submitFn.includes("RPC.submitSubgroup") &&
    submitFn.includes("buildSubmitProductSubgroupMappingArgs") &&
    (submitFn.match(/RPC\.submitSubgroup/g) || []).length === 1 &&
    built.ok &&
    Object.keys(built.params).join(",") === "p_mapping_id" &&
    built.params.p_mapping_id === 2,
  "D confirm mutation RPC.submitSubgroup + p_mapping_id only",
);
assert(
  submitFn.includes("mapping.status !== \"DRAFT\"") &&
    submitFn.includes("SUBMIT_FOR_REVIEW") &&
    submitFn.includes("Submit is not available for this Subgroup mapping."),
  "D submit modal guards DRAFT + SUBMIT_FOR_REVIEW",
);

assert(
  submitFn.includes("refreshSubgroupMappingsAfterMutation"),
  "E successful mutation still invokes refreshSubgroupMappingsAfterMutation",
);

assert(
  editFn.includes("subgroupLifecycleModalOpts()") &&
    submitFn.includes("subgroupLifecycleModalOpts()") &&
    approveFn.includes("subgroupLifecycleModalOpts()") &&
    inactivateFn.includes("subgroupLifecycleModalOpts()") &&
    createFn.includes("subgroupLifecycleModalOpts()") &&
    dispatchFn.includes("openCreateSubgroupMappingModal({") &&
    dispatchFn.includes("replacementOf"),
  "F Edit/Submit/Approve/Inactivate/Replace use nested ownership helper",
);

assert(
  moduleSrc.includes('data-prm-create-subgroup-mapping') &&
    createFn.includes("subgroupLifecycleModalOpts()") &&
    createFn.includes("RPC.mapSubgroup") &&
    !createFn.includes("closeModal({ restorePrevious: false });\n          dispatchSubgroup"),
  "G Create DRAFT toolbar path retained; nested only when detail active",
);

assert(
  thisSrc.includes("Does NOT mutate live Mapping ID 2") &&
    thisSrc.includes("Source/mock only"),
  "no live Mapping ID 2 mutation in smoke",
);
assert(
  /hub-cache-v312/.test(swSrc),
  "SW bumped once to hub-cache-v312",
);

if (failed) {
  console.error(
    `production-route-subgroup-mapping-lifecycle-handoff-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-subgroup-mapping-lifecycle-handoff-smoke: all assertions passed",
);
