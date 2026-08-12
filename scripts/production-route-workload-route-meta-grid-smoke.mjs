/**
 * Gate 11Y.10I.2C.2B.2C.1 — Route tab Effective Route metadata grid polish.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  humanizeUnknownPrmCode,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");

const panelFn =
  mainSrc.match(
    /function buildEffectiveRoutePanelHtml\([\s\S]*?\n  function buildCandidateAdvisoryHtml/,
  )?.[0] || "";

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  panelFn.includes("cp-prm-workload-effective-meta") &&
    htmlSrc.includes(
      ".cp-prm-workload-product-summary .cp-prm-workload-effective-meta",
    ),
  "1 Effective Route metadata uses responsive grid",
);
assert(panelFn.includes("Route Family ID"), "2 Route Family ID preserved");
assert(panelFn.includes("Family Route ID"), "3 Family Route ID preserved");
assert(panelFn.includes("Product Route ID"), "4 Product Route ID preserved");
assert(
  panelFn.includes("Route Source") && panelFn.includes("route_source"),
  "5 Route Source preserved",
);
assert(
  panelFn.includes("Readiness") && panelFn.includes("readiness_status"),
  "6 Readiness preserved",
);
assert(
  panelFn.includes("Validation") &&
    panelFn.includes("routeValidationDetailHtml") &&
    panelFn.includes("effective.validation"),
  "7 Validation preserved",
);
assert(
  htmlSrc.includes("minmax(min(100%, 11rem), 1fr)"),
  "8 desktop multi-column",
);
assert(
  /@media \(max-width: 720px\)[\s\S]*cp-prm-workload-effective-meta[\s\S]*grid-template-columns:\s*1fr/.test(
    htmlSrc,
  ),
  "9 narrow one-column",
);
assert(
  /cp-prm-workload-effective-meta-value[\s\S]*min-width:\s*0[\s\S]*overflow-wrap:\s*anywhere/.test(
    htmlSrc,
  ) &&
    panelFn.includes("humanizeUnknownPrmCode") &&
    humanizeUnknownPrmCode("ROUTE_FAMILY_INHERITED") ===
      "Route Family Inherited",
  "10 long Route Source cannot overlap",
);
assert(
  panelFn.includes("buildEffectiveStepsTableHtml") &&
    panelFn.includes("Ordered steps"),
  "11 Ordered Steps unchanged",
);
assert(
  mainSrc.includes("data-prm-assignment-host") &&
    mainSrc.includes("Product Route Family Assignment"),
  "12 Assignment section unchanged",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82,
  "13 Run82 context unchanged",
);
assert(!/apply_migration|alter table/i.test(panelFn), "14 no RPC/server change");
assert(!/saveWorkload|writeWorkload/.test(panelFn), "15 no mutation");
assert(!panelFn.includes("refreshCosting"), "16 no refresh");
assert(!/rpc_.*run.?82.*write/i.test(panelFn), "17 no Run82 write");
assert(
  /CACHE_NAME = "hub-cache-v269"/.test(swSrc),
  "18 SW bumped once after smokes (hub-cache-v269)",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll 2B.2C.1 Route metadata grid smoke assertions passed");
