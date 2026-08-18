/**
 * Gate 11Y.10I.2C.3F.2B.2C.0 — Family Route step-key governance.
 * Client-only source/contract smoke. No step saves, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizePrmFamilyRouteStepKey,
  collectPrmFamilyRouteStepKeys,
  isValidPrmFamilyRouteStepKey,
  suggestPrmFamilyRouteStepKey,
  validatePrmFamilyRouteStepKey,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

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

const bindFn =
  stepFormSrc.match(
    /export function bindFamilyStepFormCascade\([\s\S]*$/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const rmActivity = { activity_name: "RM dispensation" };
const taken = collectPrmFamilyRouteStepKeys({
  steps: [{ step_key: "RM_ISSUE", family_route_step_id: 1 }],
});

assert(
  !stepFormSrc.includes("step_${pad}") &&
    !helpersSrc.includes("step_${pad}") &&
    !stepFormSrc.match(/`\$\{short\}_\$\{pad\}`/),
  "1 generic step_10 default removed",
);
assert(
  suggestPrmFamilyRouteStepKey(rmActivity, new Set()) === "RM_ISSUE",
  "2 RM dispensation -> RM_ISSUE",
);
assert(
  suggestPrmFamilyRouteStepKey({ activity_name: "Disintegration" }, new Set()) ===
    "DISINTEGRATION",
  "3 Disintegration -> DISINTEGRATION",
);
assert(
  suggestPrmFamilyRouteStepKey({ activity_name: "Pulverization" }, new Set()) ===
    "PULVERIZATION",
  "4 Pulverization -> PULVERIZATION",
);
assert(
  suggestPrmFamilyRouteStepKey({ activity_name: "Sieving" }, new Set()) === "SIEVING",
  "5 Sieving -> SIEVING",
);
assert(
  suggestPrmFamilyRouteStepKey(
    { activity_name: "Finished Goods Quality Assessment" },
    new Set(),
  ) === "QC_ASSESSMENT",
  "6 FG Quality -> QC_ASSESSMENT",
);
assert(
  suggestPrmFamilyRouteStepKey(
    { activity_name: "Transfer to FG store" },
    new Set(),
  ) === "FG_TRANSFER",
  "7 FG Transfer -> FG_TRANSFER",
);
assert(
  canonicalizePrmFamilyRouteStepKey("rm_issue") === "RM_ISSUE" &&
    isValidPrmFamilyRouteStepKey("RM_ISSUE"),
  "8 uppercase canonicalization",
);
assert(
  canonicalizePrmFamilyRouteStepKey("Dry Fine Powder", { trimEdges: true }) ===
    "DRY_FINE_POWDER",
  "9 spaces -> underscore",
);
assert(
  canonicalizePrmFamilyRouteStepKey("QC-Assessment", { trimEdges: true }) ===
    "QC_ASSESSMENT" &&
    !isValidPrmFamilyRouteStepKey("QC-Assessment"),
  "10 punctuation handling",
);
assert(
  bindFn.includes('fieldState.step_key.mode === "persisted"') &&
    bindFn.includes("data-prm-family-step-key-notice"),
  "11 persisted step key preserved across Activity change",
);
assert(
  bindFn.includes("applyStepKeySuggestion") &&
    bindFn.includes("activityEl?.addEventListener(\"change\""),
  "12 Activity change updates untouched suggestion",
);
assert(
  suggestPrmFamilyRouteStepKey(rmActivity, taken) === "RM_ISSUE_2" &&
    (mainSrc.includes("validateFamilyStepForm") ||
      mainSrc.includes("findDuplicateFamilyStepKey")) &&
    helpersSrc.includes("Step key must be unique"),
  "13 duplicate blocked with meaningful suffix then save guard",
);
assert(
  !bindFn.includes("#${prefix}Seq") ||
    !bindFn.match(/Seq[\s\S]{0,400}applyStepKeySuggestion/),
  "14 sequence change does not rename step key",
);
assert(
  editorSrc.includes("normalized?.step_key") &&
    editorSrc.includes("excludeStepId"),
  "15 existing route steps unchanged on edit load",
);
assert(
  deltaFormSrc.includes("canonicalizePrmProductDeltaStepKey") &&
    helpersSrc.includes("canonicalizePrmProductDeltaStepKey") &&
    helpersSrc.includes("isValidPrmProductDeltaStepKey"),
  "16 Product Delta helper regression preserved",
);
assert(
  !mainSrc.includes("saveFamilyStep(") ||
    mainSrc.indexOf("validateFamilyStepForm") <
      mainSrc.indexOf("saveFamilyStep"),
  "17 no live step saved in smoke runner",
);
assert(
  !stepFormSrc.includes("apply_migration") &&
    !helpersSrc.includes("create table") &&
    !stepFormSrc.includes("rpc_create_route_family"),
  "18 no server schema changes",
);
assert(
  !mainSrc.includes("rpc_refresh") && !editorSrc.includes("costingRefresh"),
  "19 no costing refresh",
);

assert(
  stepFormSrc.includes("readonly") &&
    stepFormSrc.includes("data-prm-family-step-key") &&
    !bindFn.includes('keyEl?.addEventListener("input"'),
  "step key field wired for readonly governance",
);
assert(validatePrmFamilyRouteStepKey("RM_ISSUE").ok, "validate helper accepts RM_ISSUE");
assert(/CACHE_NAME = "hub-cache-v291"/.test(swSrc), "SW bumped to hub-cache-v291");

if (failed) {
  console.error(
    `\nproduction-route-family-route-step-key-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-route-step-key-smoke: all passed");
