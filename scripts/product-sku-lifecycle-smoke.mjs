import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const products = readFileSync(join(root, "js/products.js"), "utf8");
const html = readFileSync(join(root, "manage-products.html"), "utf8");
const sw = readFileSync(join(root, "public/sw.js"), "utf8");
const types = readFileSync(join(root, "public/shared/js/types/supabase.ts"), "utf8");
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260930133000_wp02_manage_products_readiness_read_access.sql",
  ),
  "utf8",
);

let failed = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${message}`);
}

const createCall = products.slice(
  products.indexOf('rpc("rpc_create_product_sku"'),
  products.indexOf("if (error) {", products.indexOf('rpc("rpc_create_product_sku"')),
);
const updateCall = products.slice(
  products.indexOf('rpc("rpc_update_product_sku"'),
  products.indexOf("if (error) {", products.indexOf('rpc("rpc_update_product_sku"')),
);
const activeCall = products.slice(
  products.indexOf('rpc("rpc_set_product_sku_active"'),
  products.indexOf("if (error) {", products.indexOf('rpc("rpc_set_product_sku_active"')),
);
const readinessCall = products.slice(
  products.indexOf('rpc("rpc_get_product_sku_readiness"'),
  products.indexOf("if (error) {", products.indexOf('rpc("rpc_get_product_sku_readiness"')),
);

assert(createCall.includes("rpc_create_product_sku"), "create uses rpc_create_product_sku");
assert(createCall.includes("p_is_active: false"), "create sends p_is_active false");
assert(updateCall.includes("rpc_update_product_sku"), "pack edit uses rpc_update_product_sku");
assert(!/p_is_active/.test(updateCall), "pack edit does not send an active flag");
assert(activeCall.includes("rpc_set_product_sku_active"), "lifecycle uses rpc_set_product_sku_active");
assert(
  !/\.from\(\s*["']product_skus["']\s*\)[\s\S]{0,180}\.(insert|update|upsert|delete)\(/.test(products),
  "no direct product_skus mutation chain",
);
assert(
  !/\b(INSERT|UPDATE|UPSERT|DELETE)\s+.*product_skus/i.test(products),
  "no direct product_skus SQL writes in the client",
);
assert(
  products.includes('.from("product_skus")') &&
    products.includes('.select("id, product_id, pack_size, uom, is_sample, is_active")'),
  "child SKU table use is a SELECT",
);
assert(!products.includes("rpc_list_product_skus"), "no SKU list RPC was introduced");
assert(readinessCall.includes('p_context_type: "LIVE_AS_OF"'), "readiness uses LIVE_AS_OF");
assert(readinessCall.includes("p_refresh_run_id: null"), "readiness sends a null refresh-run id");
assert(
  products.includes("rpc_get_latest_governed_cost_period_start"),
  "period comes from the governed-period RPC",
);
assert(!products.includes("2026-09"), "client has no hard-coded 2026-09 period");
assert(
  !/new Date\(/.test(products) && !products.includes("toISOString"),
  "client has no browser current-date period logic",
);
assert(
  !products.includes("p_valuation_date") &&
    readinessCall.includes("p_refresh_run_id: null"),
  "client sends a null refresh run and does not choose a valuation date",
);
const readinessSource = products.slice(products.indexOf("function loadGovernedPeriodStart"));
assert(
  !/overall_severity\s*=/.test(readinessSource) &&
    !readinessSource.includes("Math.max") &&
    readinessSource.includes("summary.overall_severity"),
  "client displays server overall severity and does not calculate it",
);
assert(
  products.includes('if (severity === "READY") return "Ready"') &&
    products.includes('return "Unavailable"'),
  "unknown or missing severity renders Unavailable",
);
assert(
  /let unsaved = false;/.test(products) && /let skuDirty = false;/.test(products),
  "product unsaved and SKU dirty stay separate flags",
);
assert(
  products.includes("if (!canWriteModule()) return") &&
    products.includes("skuAddBtn.hidden = !show || !canEdit") &&
    products.includes('skuCreateBtn.hidden = !(show && canEdit'),
  "view-only users cannot use SKU mutation actions",
);
assert(
  products.includes('rpc("rpc_update_product"') && products.includes("surfaceRpcError"),
  "product deactivation remains on rpc_update_product and surfaces server errors",
);
assert(!products.includes("rpc_set_product_sku_active") || !/childSku/.test(products), "product path does not deactivate child SKUs");
assert(sw.includes('const CACHE_NAME = "hub-cache-v328"'), "service worker generation is hub-cache-v328");
assert(html.includes('id="skuLifecycleSection"') && html.includes("SKUs &amp; readiness"), "SKU readiness section exists");
assert(html.includes(">SKU master<") && html.includes("Readiness &amp; remediation"), "master and readiness stay separate");
assert(!html.includes('id="skuIsActive"'), "activation is not a master checkbox");
assert(html.includes('id="skuToggleActiveBtn"'), "activation has a dedicated action");
assert(migration.includes("rpc_get_latest_governed_cost_period_start"), "migration adds the period RPC");
assert(migration.includes("app_has_permission('module:manage-products', 'view')"), "migration allows Manage Products view");
assert(migration.includes("max(period_start)"), "period RPC reads max period_start");
assert(!migration.includes("rpc_create_product_sku"), "migration does not alter SKU writers");
assert(types.includes("rpc_get_product_sku_readiness:"), "types include the readiness RPC");
assert(types.includes("rpc_get_latest_governed_cost_period_start:"), "types include the period RPC");
assert(!types.includes("rpc_list_product_skus"), "types do not add a SKU list RPC");

if (failed) {
  console.error(`FAILED product-sku-lifecycle-smoke (${failed})`);
  process.exit(1);
}
console.log("PASSED product-sku-lifecycle-smoke");
