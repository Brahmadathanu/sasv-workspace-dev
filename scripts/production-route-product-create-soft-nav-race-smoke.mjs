/**
 * Gate 4F.5D3-C — Product Summary → Product Route Editor soft-nav race.
 * Source/mock only. Does not mutate Product 161, assignment 76, batch 528, or server.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_PRODUCT_ROUTE_SOURCES,
  isPrmProductRouteEditorCreateContext,
  resolveProductionRouteLens,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const shellSrc = read("public/shared/js/costing-suite-shell.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-create-soft-nav-race-smoke.mjs",
);

const openCreateFn =
  mainSrc.match(
    /async function openProductRouteCreateFromRow\([\s\S]*?\n  async function submitProductRouteCreateDraft/,
  )?.[0] || "";
const submitFn =
  mainSrc.match(
    /async function submitProductRouteCreateDraft\([\s\S]*?\n  function openProductHistoryRoute/,
  )?.[0] || "";
const syncShellFn =
  shellSrc.match(
    /syncShellLens:\s*\(lensId\)\s*=>\s*\{[\s\S]*?\n  \},/,
  )?.[0] || "";
const switchLensFn =
  shellSrc.match(
    /async function switchLens\(lensId\) \{[\s\S]*?\n\}/,
  )?.[0] || "";
const renderPillsFn =
  shellSrc.match(/function renderLensPills\(\) \{[\s\S]*?\n\}/)?.[0] || "";
const onLensExitFn =
  mainSrc.match(/function onLensExit\(\) \{[\s\S]*?\n  \}/)?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  openCreateFn.includes(
    'await navigate("product-route-editor", { product_id: productId })',
  ) &&
    openCreateFn.includes("state.productRouteCreateHandoff = {") &&
    openCreateFn.lastIndexOf("state.productRouteCreateHandoff = {") <
      openCreateFn.lastIndexOf(
        'await navigate("product-route-editor", { product_id: productId })',
      ),
  "A openProductRouteCreateFromRow awaits navigate to product-route-editor",
);

assert(
  !openCreateFn.includes("editor.createProductDraft") &&
    !openCreateFn.includes("rpc_create_product_route_draft") &&
    submitFn.includes("editor.createProductDraft"),
  "B Summary Create Product route still performs NO premature create RPC",
);

assert(
  openCreateFn.includes("await navigate(") &&
    /Create context[\s\S]*preserve handoff|productRouteCreateHandoff = null/.test(
      mainSrc,
    ) &&
    isPrmProductRouteEditorCreateContext({
      product_id: 161,
      product_route_id: null,
    }) === true,
  "C create handoff survives navigation until editor create context",
);

assert(
  syncShellFn.includes("withProgrammaticLensSync") &&
    !/\bswitchLens\s*\(/.test(syncShellFn) &&
    !/\bloadRowsForLens\s*\(/.test(syncShellFn) &&
    shellSrc.includes("if (isProgrammaticLensSync) return") &&
    renderPillsFn.includes("withProgrammaticLensSync") &&
    shellSrc.includes("softNavLockLens") &&
    shellSrc.includes("if (softNavLockLens) return") &&
    shellSrc.includes("beginPrmSoftNavLock") &&
    mainSrc.includes("beginPrmSoftNavLock(resolved)") &&
    mainSrc.includes("endPrmSoftNavLock()"),
  "D programmatic syncShellLens/renderLensPills does not invoke competing switchLens/load",
);

assert(
  /if \(!lensId \|\| lensId === CURRENT_LENS\) return;/.test(switchLensFn) &&
    switchLensFn.includes("softNavLockLens") &&
    onLensExitFn.includes("productRouteCreateHandoff = null") &&
    syncShellFn.includes("withProgrammaticLensSync") &&
    !syncShellFn.includes("onLensExit") &&
    /table\.style\.display = "none"/.test(mainSrc) &&
    mainSrc.includes('nextLens === "product-route-editor"'),
  "E redundant same-target lens sync does not call onLensExit or clear handoff",
);

assert(
  shellSrc.includes('lensSelect?.addEventListener("change"') &&
    shellSrc.includes("if (isProgrammaticLensSync) return") &&
    shellSrc.includes("programmaticLensSyncDepth") &&
    shellSrc.includes("setTimeout(() => {") &&
    switchLensFn.includes("productionRouteCtrl.onLensExit") &&
    switchLensFn.includes("loadRowsForLens"),
  "F genuine user lens change still performs normal switchLens lifecycle",
);

assert(
  resolveProductionRouteLens("product-route-editor", {
    product_id: 161,
  }) === "product-route-editor" &&
    mainSrc.includes("hydrateProductRouteCreateHandoff") &&
    mainSrc.includes("ok: true, create: true"),
  "G product-route-editor with product_id only remains in create mode",
);

assert(
  /source_type:\s*PRM_PRODUCT_ROUTE_SOURCES\[0\]/.test(submitFn) &&
    PRM_PRODUCT_ROUTE_SOURCES[0] === "ROUTE_FAMILY_ONLY" &&
    !/source_type:\s*"MANUAL"/.test(submitFn) &&
    submitFn.includes("editor.createProductDraft"),
  "H Create DRAFT still uses ROUTE_FAMILY_ONLY + existing RPC path",
);

assert(
  submitFn.includes("product_route_id: createdId") &&
    /navigate\(\s*"product-route-editor"/.test(submitFn) &&
    submitFn.includes("missing_product_route_id"),
  "I successful Create DRAFT still opens returned product_route_id",
);

assert(
  mainSrc.includes("RPC.generalReadiness") &&
    /async function loadReadiness[\s\S]*?RPC\.generalReadiness/.test(mainSrc),
  "J Route Readiness general-as-of remains unchanged",
);

assert(
  mainSrc.includes("loadProductAssignments") &&
    !openCreateFn.includes("loadProductAssignments"),
  "K Product Assignments remain unchanged by create handoff",
);

assert(
  mainSrc.includes("PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT") &&
    mainSrc.includes("PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT") &&
    mainSrc.includes("PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT"),
  "L exact-run Workload/Mapping/Foundation remain unchanged",
);

assert(
  thisSrc.includes("Does not mutate Product 161") &&
    !/\bcostingRpc\s*\(/.test(thisSrc) &&
    !/\bp_batch_size_ref_id\s*:\s*528\b/.test(thisSrc),
  "no Product 161 / batch 528 live mutation in this smoke",
);

assert(
  /CACHE_NAME = "hub-cache-v318"/.test(swSrc),
  "SW bumped once to hub-cache-v318",
);

if (failed) {
  console.error(
    `production-route-product-create-soft-nav-race-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-create-soft-nav-race-smoke: all assertions passed",
);
