/**
 * PRM infinite scroll — paginated register lenses (source assertions only).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_INFINITE_SCROLL_LENSES,
  isPrmInfiniteScrollLens,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const subgroupSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
const shellSrc = read("public/shared/js/costing-suite-shell.js");

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  PRM_INFINITE_SCROLL_LENSES.length === 6 &&
    isPrmInfiniteScrollLens("route-readiness") &&
    isPrmInfiniteScrollLens("archived-routes"),
  "1 infinite-scroll lens registry",
);

assert(
  mainSrc.includes("loadMoreReadiness") &&
    mainSrc.includes("readinessHasMore") &&
    mainSrc.includes("loadMoreProductAssignments") &&
    mainSrc.includes("assignmentHasMore") &&
    mainSrc.includes("loadMoreFoundationReview") &&
    mainSrc.includes("foundationHasMore") &&
    mainSrc.includes("buildPrmInfiniteScrollFooterHtml") &&
    mainSrc.includes("setupPrmRegisterProgressiveScroll"),
  "2 main register loadMore + scroll footer wired",
);

assert(
  subgroupSrc.includes("loadMoreSubgroupMappings") &&
    subgroupSrc.includes("loadMoreArchivedRoutes") &&
    subgroupSrc.includes("buildPrmInfiniteScrollFooterHtml"),
  "3 subgroup/archive infinite scroll wired",
);

assert(
  shellSrc.includes("isPrmInfiniteScrollLens") &&
    shellSrc.includes("!isPrmInfiniteScrollLens(CURRENT_LENS)") &&
    mainSrc.includes("isPrmInfiniteScrollLens(state.activeLens)"),
  "4 shell hides pager and syncPageFromShell bypasses infinite-scroll lenses",
);

assert(
  mainSrc.includes("readinessLoadingMore") &&
    mainSrc.includes("assignmentLoadingMore") &&
    mainSrc.includes("foundationLoadingMore") &&
    mainSrc.includes("append: true"),
  "5 append mode state fields present",
);

assert(
  mainSrc.includes("resetOffset: true") &&
    mainSrc.includes("refreshProductAssignmentsAfterMutation") &&
    subgroupSrc.includes("loadSubgroupMappings({ resetOffset: true })"),
  "6 mutation refresh resets to first batch",
);

assert(
  mainSrc.includes("setupPrmRegisterProgressiveScroll") &&
    mainSrc.includes("wirePrmRegisterScroll") &&
    subgroupSrc.includes("wireSubgroupRegisterScroll") &&
    helpersSrc.includes("maybePrmRegisterAutoLoadChain") &&
    helpersSrc.includes("data-prm-load-more-sentinel"),
  "7 progressive scroll uses IO sentinel + auto-load chain",
);

if (failed) {
  console.error(
    `production-route-infinite-scroll-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-infinite-scroll-smoke: all assertions passed");
