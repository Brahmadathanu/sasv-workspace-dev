/**
 * Gate 4F.5D4-B — Product Submit DRAFT-only + soft-nav paint assert.
 * Source/mock only. Does not mutate Product 161 / Route 48.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrmProductRouteLifecycleActions } from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const shellSrc = read("public/shared/js/costing-suite-shell.js");
const swSrc = read("public/sw.js");

const productHtmlFn =
  editorSrc.match(/function productHtml\(options = \{\}\) \{[\s\S]*?\n  function renderEditor/)?.[0] ||
  "";
const submitFn =
  editorSrc.match(/async function submit\(mode\) \{[\s\S]*?\n  async function approve/)?.[0] ||
  "";
const navigateFn =
  mainSrc.match(
    /function navigate\(lens, params = \{\}, replace = false\) \{[\s\S]*?\n  async function navigateToFamilyRouteEditor/,
  )?.[0] ||
  mainSrc.match(
    /function navigate\(lens, params = \{\}, replace = false\) \{[\s\S]*?\n  function navigateToFamilyRouteEditor/,
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

const draftReady = resolvePrmProductRouteLifecycleActions({
  status: "DRAFT",
  canEdit: true,
  validation: { valid: true },
  validationFresh: true,
});
const reviewReady = resolvePrmProductRouteLifecycleActions({
  status: "REVIEW_REQUIRED",
  canEdit: true,
  validation: { valid: true },
  validationFresh: true,
});

assert(
  draftReady.submitVisible === true && draftReady.submitEnabled === true,
  "1 DRAFT + validated Submit visible and enabled",
);
assert(
  reviewReady.submitVisible === false &&
    reviewReady.approveVisible === true &&
    reviewReady.canAddDelta === true,
  "2 REVIEW_REQUIRED hides Submit; Approve + deltas remain",
);
assert(
  helpersSrc.includes("export function resolvePrmProductRouteLifecycleActions") &&
    productHtmlFn.includes("resolvePrmProductRouteLifecycleActions") &&
    productHtmlFn.includes("lifecycle.submitVisible"),
  "3 Product editor uses product lifecycle for Submit visibility",
);
assert(
  submitFn.includes('if (status !== "DRAFT")') &&
    mainSrc.includes("Submit for review is available for DRAFT routes only"),
  "4 client guards block Submit when not DRAFT",
);
assert(
  navigateFn.includes("Could not open the selected view") &&
    navigateFn.includes("syncShellLens(resolved)") &&
    shellSrc.includes('reason: "soft_nav_lock"'),
  "5 soft-nav re-asserts lens chrome and blocks competing paint under lock",
);
assert(
  !mainSrc.includes("Product 161 live") &&
    swSrc.includes("hub-cache-v318"),
  "6 no live Route 48 mutation; SW v318",
);

if (failed) {
  console.error(
    `production-route-product-submit-draft-gate-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-submit-draft-gate-smoke: all assertions passed",
);
