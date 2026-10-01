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
    "supabase/migrations/20260930073040_wp02_manage_products_readiness_read_access.sql",
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
assert(sw.includes('const CACHE_NAME = "hub-cache-v330"'), "service worker generation is hub-cache-v330");
assert(html.includes('id="skuLifecycleSection"') && html.includes(">SKUs<"), "SKU tab exists");
assert(html.includes('id="productPicker"') && !html.includes('id="productList"') && !html.includes('class="sidebar"'), "product rail is no longer the rendered navigation");
assert(html.includes('role="tablist"') && html.includes(">Product Master<") && html.includes(">Readiness<"), "workspace has three accessible tabs");
assert(html.includes('id="tabSkus"') && html.includes("disabled"), "SKU and readiness tabs can be unavailable");
assert(products.includes("enhanceSearchableSelect(productPicker") && products.includes("selectedId = id"), "product picker resolves through the existing selected product authority");
assert(html.includes('id="skuRegister"') && html.includes('id="skuCardList"'), "desktop SKU register and small-screen SKU cards exist");
assert(html.includes('id="readinessRegister"') && html.includes('id="readinessDetailSurface"'), "readiness register and bounded detail exist");
assert(html.includes('class="mp-surface"') && !html.includes('id="skuList"'), "deep SKU and readiness detail are not an inline page stack");
assert(
  html.includes(">SKU master<") &&
    html.includes('id="skuMasterFields"') &&
    html.includes('id="readinessDetailSurface"') &&
    html.indexOf('id="readinessDetailSurface"') > html.indexOf('id="skuToggleActiveBtn"'),
  "SKU master and readiness detail stay separate",
);
assert(!html.includes('id="skuIsActive"'), "activation is not a master checkbox");
assert(html.includes('id="skuToggleActiveBtn"'), "activation has a dedicated action");
assert(migration.includes("rpc_get_latest_governed_cost_period_start"), "migration adds the period RPC");
assert(migration.includes("app_has_permission('module:manage-products', 'view')"), "migration allows Manage Products view");
assert(migration.includes("max(period_start)"), "period RPC reads max period_start");
assert(!migration.includes("rpc_create_product_sku"), "migration does not alter SKU writers");
assert(types.includes("rpc_get_product_sku_readiness:"), "types include the readiness RPC");
assert(types.includes("rpc_get_latest_governed_cost_period_start:"), "types include the period RPC");
assert(!types.includes("rpc_list_product_skus"), "types do not add a SKU list RPC");

const renderSource = products.slice(
  products.indexOf("function renderSkuReadiness"),
  products.indexOf("function skuPackIdentity"),
);
assert(renderSource.includes("lifecycle.product_status"), "renderer uses product_status");
assert(renderSource.includes("lifecycle.sku_is_active"), "renderer uses sku_is_active");
assert(renderSource.includes("issue.raw_status"), "renderer uses dependency raw_status");
assert(renderSource.includes("issue.effective_status"), "renderer supports effective_status");
assert(renderSource.includes("issue.reason_code"), "renderer uses reason_code");
assert(renderSource.includes("issue.recommended_ui_route"), "renderer uses recommended_ui_route");
assert(!renderSource.includes("recommended_route"), "renderer does not use recommended_route");
assert(!renderSource.includes("lifecycle.state") && !renderSource.includes("lifecycle.status"), "renderer does not use invented lifecycle aliases");
assert(products.includes("created.sku_id") && !products.includes("created.id"), "new SKU reselection uses sku_id");
assert(
  products.includes("function loadAllSkuReadiness") &&
    products.includes("rows.map(async (row) => fetchSkuReadiness(row.id))") &&
    products.includes("skuReadinessById.get(String(row.id))"),
  "all child SKU rows load readiness and selection reuses it",
);
assert(products.includes('title: "Create SKU"') && products.includes("Create an inactive SKU"), "create has its own governance confirmation");
assert(products.includes('title: "Update SKU"') && products.includes("Update SKU ${selectedSkuId}"), "update has its own governance confirmation");
assert(products.includes('title: nextActive ? "Activate SKU" : "Deactivate SKU"'), "activate and deactivate have distinct governance titles");
assert(products.includes("will become Active") && products.includes("will become Inactive"), "lifecycle confirmations name the target state");
assert(products.includes("danger: !nextActive"), "deactivation uses danger treatment");
assert(!products.includes('requireSkuGovernance("save")'), "SKU actions do not share a generic save confirmation");
assert(
  products.includes("Pack size must be greater than zero.") && html.includes('min="0.000001"'),
  "invalid pack size is rejected before governance",
);
assert(renderSource.includes("payload.shared_issues"), "renderer consumes payload.shared_issues");
assert(renderSource.includes("issue.issue_code"), "renderer uses shared issue_code");
assert(renderSource.includes("issue.status"), "renderer uses shared-issue status");
assert(renderSource.includes("issue.reason_code"), "renderer uses shared-issue reason_code");
assert(renderSource.includes("issue.recommended_ui_route"), "renderer uses shared-issue recommended_ui_route");
assert(renderSource.includes('status === "READY"'), "dependency READY is suppressed");
assert(renderSource.includes('status === "RESOLVED"'), "dependency RESOLVED is suppressed");
assert(renderSource.includes('status === "NOT_REQUIRED"'), "dependency NOT_REQUIRED is suppressed");
assert(renderSource.includes('issue.applicability === "NOT_REQUIRED"'), "NOT_REQUIRED applicability is suppressed");
assert(!renderSource.includes('status === "BLOCKED"'), "BLOCKED dependencies remain renderable");
assert(!renderSource.includes('status === "REVIEW_REQUIRED"'), "REVIEW_REQUIRED dependencies remain renderable");
assert(!renderSource.includes('status === "UNKNOWN"'), "UNKNOWN dependencies remain renderable");
assert(
  !/overall_severity\s*=/.test(renderSource),
  "no local overall-readiness calculation is introduced",
);
assert(renderSource.includes("mp-readiness-grid"), "readiness summary uses a definition grid");
assert(
  renderSource.includes("summary.product_master_foundation_status") &&
    renderSource.includes("summary.sku_master_foundation_status") &&
    renderSource.includes("summary.costing_foundation_status") &&
    renderSource.includes("summary.evidence_quality_status") &&
    renderSource.includes("summary.costing_outcome_status") &&
    renderSource.includes("summary.overall_severity"),
  "readiness grid uses the canonical server summary fields",
);
assert(
  renderSource.includes("control.control_note") &&
    renderSource.includes("control.control_severity") &&
    renderSource.includes("control.cost_sheet_status") &&
    renderSource.includes("control.first_control_status") &&
    renderSource.includes("control.recommended_ui_route"),
  "downstream control evidence stays visible",
);
assert(renderSource.includes("Remediation"), "unresolved remediation stays in its own block");
assert(
  products.includes('skuCreateBtn.hidden = !(show && canEdit && skuDraft === "new")'),
  "Create SKU is available only for a new draft",
);
assert(
  products.includes("skuSaveBtn.hidden = !(show && canEdit && selectedSkuId && skuDirty)"),
  "Save SKU is shown only when an existing SKU is dirty",
);
assert(
  products.includes('skuToggleActiveBtn.hidden = !(show && canEdit && row && skuDraft !== "new")'),
  "Activate and Deactivate stay hidden for a new draft",
);
const skuMasterMarkup = html.slice(
  html.indexOf('id="skuMasterFields"'),
  html.indexOf('id="skuToggleActiveBtn"'),
);
assert(
  skuMasterMarkup.includes("</fieldset>") && html.includes('id="skuToggleActiveBtn"'),
  "lifecycle action stays outside the SKU master fieldset",
);

if (failed) {
  console.error(`FAILED product-sku-lifecycle-smoke (${failed})`);
  process.exit(1);
}
console.log("PASSED product-sku-lifecycle-smoke");
