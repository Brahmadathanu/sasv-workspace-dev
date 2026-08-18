/**
 * Regression: restoreFocusAfterModalClose must import buildPrmFocusRestoreOptions.
 * Missing import aborted navigate() after closeModal (Open Family Route from Summary).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route.js"),
  "utf8",
);
const helpersSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route-helpers.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const importBlock =
  mainSrc.match(
    /import \{[\s\S]*?\} from "\.\/costing-suite-production-route-helpers\.js";/,
  )?.[0] || "";

assert(
  helpersSrc.includes("export function buildPrmFocusRestoreOptions"),
  "helper exports buildPrmFocusRestoreOptions",
);
assert(
  importBlock.includes("buildPrmFocusRestoreOptions"),
  "production-route.js imports buildPrmFocusRestoreOptions",
);
assert(
  mainSrc.includes("buildPrmFocusRestoreOptions(openerModality)"),
  "restoreFocusAfterModalClose uses helper",
);
const closeModalFn =
  mainSrc.match(
    /function closeModal\(\{ restorePrevious = true \} = \{\}\) \{[\s\S]*?\n  function clearWorkloadProductModalChrome/,
  )?.[0] || "";
assert(
  closeModalFn.includes("focused.blur()") &&
    closeModalFn.indexOf("focused.blur()") <
      closeModalFn.indexOf('modal.setAttribute("aria-hidden", "true")'),
  "closeModal blurs focused descendant before aria-hidden",
);
assert(
  /CACHE_NAME = "hub-cache-v323"/.test(swSrc),
  "SW bumped to hub-cache-v323",
);

if (failed) {
  console.error(`production-route-focus-restore-import-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-focus-restore-import-smoke: all assertions passed");
