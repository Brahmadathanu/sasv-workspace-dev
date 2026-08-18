/**
 * Gate 4F.5D3-A — Product Route draft create / editor-entry correction.
 * Source/mock only. Does not mutate Product 161, assignment 76, batch 528, or server.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_EMPTY_STATES,
  PRM_PRODUCT_ROUTE_SOURCES,
  resolveProductionRouteLens,
  isPrmProductRouteEditorCreateContext,
  resolvePrmFamilyRouteCreateProvenanceContext,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-route-create-editor-entry-smoke.mjs",
);

const slice = (src, startRe, endRe) => {
  const start = src.search(startRe);
  if (start < 0) return "";
  const rest = src.slice(start);
  const endMatch = rest.slice(1).search(endRe);
  return endMatch < 0 ? rest : rest.slice(0, endMatch + 1);
};

const navigateFn = slice(
  mainSrc,
  /function navigate\(lens, params = \{\}, replace = false\) \{/,
  /\n  function navigateToFamilyRouteEditor/,
);
const submitFn = slice(
  mainSrc,
  /async function submitProductRouteCreateDraft\(/,
  /\n  function openProductHistoryRoute/,
);
const openCreateFn = slice(
  mainSrc,
  /async function openProductRouteCreateFromRow\(/,
  /\n  async function submitProductRouteCreateDraft/,
);
const runFn =
  mainSrc.match(
    /async function runSummaryAction\([\s\S]*?\n  async function openProductCandidateAdvisory/,
  )?.[0] || "";
const loadProductEditorBranch =
  mainSrc.match(
    /if \(active === "product-route-editor"\) \{[\s\S]*?\n    if \(active === "historical-candidate-review"\)/,
  )?.[0] || "";
const loadFn = loadProductEditorBranch;
const productHtmlFn = slice(
  editorSrc,
  /function productHtml\(/,
  /\n  function familyHtml|\n  function renderEditor/,
);

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  PRM_PRODUCT_ROUTE_SOURCES.includes("ROUTE_FAMILY_ONLY") &&
    submitFn.includes("PRM_PRODUCT_ROUTE_SOURCES") &&
    /source_type:\s*PRM_PRODUCT_ROUTE_SOURCES\[0\]/.test(submitFn) &&
    !/source_type:\s*"MANUAL"/.test(submitFn),
  "A Product Route draft create uses ROUTE_FAMILY_ONLY not MANUAL",
);

const familyProv = resolvePrmFamilyRouteCreateProvenanceContext({});
assert(
  familyProv.source_type === "MANUAL" &&
    helpersSrc.includes('source_type: "MANUAL"') &&
    helpersSrc.includes("resolvePrmFamilyRouteCreateProvenanceContext"),
  "B Family Route creation provenance remains MANUAL",
);

assert(
  /else if \(resolved === "product-route-editor"\) \{[\s\S]*?isPrmProductRouteEditorCreateContext[\s\S]*?productRouteCreateHandoff = null;\s*\n\s*\}/.test(
    navigateFn,
  ) &&
    !/isPrmProductRouteEditorCreateContext\([\s\S]*?\}\) \{\s*state\.productRouteCreateHandoff = null;\s*\} else \{[\s\S]*productRouteCreateHandoff = null/.test(
      navigateFn,
    ) &&
    navigateFn.includes("Create context") &&
    navigateFn.includes("preserve handoff"),
  "C navigate() preserves productRouteCreateHandoff for create context",
);

assert(
  isPrmProductRouteEditorCreateContext({
    product_id: 161,
    product_route_id: null,
  }) === true &&
    resolveProductionRouteLens("product-route-editor", {
      product_id: 161,
    }) === "product-route-editor" &&
    loadFn.includes("hydrateProductRouteCreateHandoff") &&
    loadFn.includes("ok: true, create: true"),
  "D product_id + null product_route_id remains on editor/create mode",
);

assert(
  resolveProductionRouteLens("product-route-editor", {
    allowEditorWithoutId: true,
  }) === "product-route-editor" &&
    /allowEditorWithoutId[\s\S]*product-route-editor/.test(mainSrc) &&
    !/lens === "product-route-editor"[\s\S]{0,120}navigate\(active/.test(mainSrc),
  "E bare product-route-editor does NOT silently redirect to Route Readiness",
);

assert(
  PRM_EMPTY_STATES.productEditor.includes("No Product Route selected") &&
    PRM_EMPTY_STATES.productEditor.includes("Route Readiness") &&
    productHtmlFn.includes("cp-prm-empty-state") &&
    loadFn.includes("empty: true"),
  "F bare editor renders clear empty-state / selection cue",
);

assert(
  !openCreateFn.includes("editor.createProductDraft") &&
    !openCreateFn.includes("rpc_create_product_route_draft") &&
    openCreateFn.includes('await navigate("product-route-editor", { product_id: productId })'),
  "G Summary Create Product route does NOT invoke create RPC prematurely",
);

assert(
  submitFn.includes("editor.createProductDraft") &&
    submitFn.includes("withMutation") &&
    editorSrc.includes("buildCreateProductRouteDraftArgs") &&
    rpcSrc.includes("rpc_create_product_route_draft") &&
    rpcSrc.includes("buildCreateProductRouteDraftArgs"),
  "H Create DRAFT invokes builder + editor.createProductDraft RPC path",
);

assert(
  submitFn.includes("extractCreatedProductRouteId") === false &&
    submitFn.includes("result.product_route_id") &&
    submitFn.includes("product_route_id: createdId") &&
    /navigate\(\s*"product-route-editor"/.test(submitFn) &&
    submitFn.includes("missing_product_route_id"),
  "I successful create uses returned product_route_id and opens editor",
);

assert(
  (() => {
    const effectiveBranch =
      runFn.match(
        /if \(action === "effective" \|\| action === "view-effective-route"\) \{[\s\S]*?navigate\("effective-route-viewer", \{ product_id: effectiveProductId \}\);\s*return;\s*\}/,
      )?.[0] || "";
    return (
      effectiveBranch.includes("normalizePrmIntegerId(productId)") &&
      effectiveBranch.includes("effectiveProductId") &&
      effectiveBranch.includes(
        "Product is required to view the effective route",
      ) &&
      !effectiveBranch.includes("product-route-editor")
    );
  })(),
  "J View effective normalizes product_id and opens effective-route-viewer",
);

assert(
  /action\.includes\("open-product"\)[\s\S]*openProductRouteCreateFromRow\(row\)/.test(
    runFn,
  ) && !runFn.includes("No current Product route is available to open."),
  "Open Product with no route hands off to create context",
);

assert(
  /Does not mutate Product 161/.test(thisSrc) &&
    /Source\/mock only/.test(thisSrc) &&
    !/\bcostingRpc\s*\(/.test(thisSrc) &&
    !/\bp_batch_size_ref_id\s*:\s*528\b/.test(thisSrc) &&
    !/\bassignment_id\s*:\s*76\b/.test(thisSrc),
  "K no Product 161 / batch 528 / assignment 76 mutation in this smoke",
);

assert(
  /CACHE_NAME = "hub-cache-v318"/.test(swSrc),
  "SW bumped once to hub-cache-v318",
);

if (failed) {
  console.error(
    `production-route-product-route-create-editor-entry-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-route-create-editor-entry-smoke: all assertions passed",
);
