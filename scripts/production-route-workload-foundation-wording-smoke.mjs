/**
 * Gate 11Y.10I.2C.2B.2B.1 — Remove stale Workload Foundation policy-review wording.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_BATCH_LABELS,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const swSrc = read("public/sw.js");

const STALE =
  "The applicable denominator for each POH factor remains under policy review.";
const NEW =
  "The Product workload share is determined against the eligible company workload captured for the applicable pool in the exact costing run.";

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  !helpersSrc.includes(STALE) &&
    !PRM_WORKLOAD_BATCH_LABELS.denominatorReview.includes(
      "remains under policy review",
    ),
  "1 stale phrase remains under policy review absent from Foundation denominator wording",
);
assert(
  PRM_WORKLOAD_BATCH_LABELS.denominatorReview === NEW &&
    helpersSrc.includes(NEW),
  "2 new exact-run workload-denominator wording present",
);
assert(
  PRM_WORKLOAD_BATCH_LABELS.rawExplain.includes(
    "fractional/proportional batch-equivalent candidate",
  ) &&
    PRM_WORKLOAD_BATCH_LABELS.roundedExplain.includes(
      "integer standard-batch count for fixed batch workload",
    ) &&
    mainSrc.includes("PRM_WORKLOAD_BATCH_LABELS.denominatorReview") &&
    mainSrc.includes("buildWorkloadFoundationHtml"),
  "3 Foundation fields unchanged",
);
assert(
  mainSrc.includes("buildWorkloadExplainDlPanelHtml") &&
    mainSrc.includes("buildWorkloadExplainPohPanelHtml") &&
    mainSrc.includes("PRM_WORKLOAD_EXPLAIN_DL_FORMULA") &&
    mainSrc.includes("PRM_WORKLOAD_EXPLAIN_POH_FORMULA"),
  "4 DL/POH Explain unchanged",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82,
  "5 Run82 context unchanged",
);
assert(
  PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "6 Route Readiness Run80 unchanged",
);
assert(
  !helpersSrc.includes("apply_migration") &&
    !/create table|alter table/i.test(helpersSrc),
  "7 no server change",
);
assert(
  !/saveWorkload|writeWorkload|mutateWorkload/.test(mainSrc),
  "8 no mutation",
);
assert(
  !mainSrc.includes("refreshCostingFromFoundationWording"),
  "9 no refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v269"/.test(swSrc),
  "10 SW bumped once after smokes (hub-cache-v269)",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll 2B.2B.1 wording smoke assertions passed");
