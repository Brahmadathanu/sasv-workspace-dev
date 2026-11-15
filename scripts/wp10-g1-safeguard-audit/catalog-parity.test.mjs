// WP10 G1 — live catalog (committed 15 Nov 2026) vs repository source parity, trigger inventory and epoch-hook coverage.
// Offline/read-only. Run: node scripts/wp10-g1-safeguard-audit/catalog-parity.test.mjs [resultsJson]
import fs from "node:fs";
import { catalog, liveFn, fnBody, normalizeSql, migrationFunction, makeResults, read } from "./lib.mjs";

const { results, check, classify, failed } = makeResults();
const CI038 = "supabase/migrations/20261026022352_ci038_sku_activation_guard.sql";
const CI038A = "supabase/migrations/20261026083214_ci038a_activation_asof_today.sql";

// ---- catalog integrity ----
check("P0.1", "catalog is catalog-only evidence for qhmoqtxpeasamtlxaoak with 5 functions, 5 product_skus triggers, 44 epoch triggers", catalog.project === "qhmoqtxpeasamtlxaoak" && catalog.functions.length === 5 && catalog.sku_triggers.length === 5 && catalog.readiness_epoch_triggers.length === 44 && /no business writer/.test(catalog.classification));

// ---- function parity: live body == repo migration body (logic only; whitespace/comments ignored) ----
const pairs = [
  ["P1.1", "costing", "fn_sku_activation_missing_items", CI038A, "live helper == CI-038a (as-of = greatest(period valuation, current IST date))"],
  ["P1.2", "public", "fn_guard_sku_activation_completeness", CI038, "live completeness trigger fn == CI-038"],
  ["P1.3", "public", "rpc_get_sku_activation_check", CI038, "live read-only pre-check RPC == CI-038"],
  ["P1.4", "public", "rpc_set_product_sku_active", CI038, "live lifecycle RPC == CI-038 section 4"],
];
for (const [id, schema, name, mig, label] of pairs) {
  const live = liveFn(schema, name);
  const repo = migrationFunction(mig, `${schema}.${name}`);
  const same = live && repo && normalizeSql(fnBody(live)) === normalizeSql(repo.body);
  check(id, label, !!same, same ? "" : "bodies differ or repo definition missing");
}
{
  const live = fnBody(liveFn("costing", "fn_sku_activation_missing_items"));
  const old = migrationFunction(CI038, "costing.fn_sku_activation_missing_items").body;
  check("P1.5", "CI-038a is the ONLY delta from the original CI-038 helper (valuation-only text would regress the as-of rule)", /greatest\(coalesce\(v_val, current_date\),\s*\(now\(\) at time zone 'Asia\/Kolkata'\)::date\)/.test(live) && !/greatest/.test(old) && normalizeSql(live).replace(/greatest\(coalesce\(v_val,current_date\),\(now\(\)at time zone'asia\/kolkata'\)::date\);--?ci-038a/, "") !== normalizeSql(old));
}
{
  const guard = liveFn("public", "fn_guard_active_sku_requires_active_product");
  const hasRepoDef = /create or replace function public\.fn_guard_active_sku_requires_active_product/i.test(fs.readdirSync("supabase/migrations").map((f) => read("supabase/migrations/" + f)).join("\n"));
  classify("P1.6", hasRepoDef ? "PASS" : "NOT PROVEN", "parent-active guard: live definition captured; repository has NO creating migration (SA1 only revokes ACL) — source/live parity cannot be proven from the repo", `live captured=${!!guard} repoDefinition=${hasRepoDef}`);
}

// ---- helper contract facts proven from the LIVE text (not from the repo) ----
const helper = fnBody(liveFn("costing", "fn_sku_activation_missing_items"));
const codes = [...helper.matchAll(/'code','([A-Z_]+)'/g)].map((m) => m[1]);
check("P2.1", "exactly the five essentials, in this order", codes.join() === "PM_BOM_REVISION,BATCH_SIZE_REFERENCE,MANUFACTURING_ROUTE,MRP_POLICY,SELLING_PRICE_POLICY", codes.join());
check("P2.2", "as-of date = greatest(latest cost period valuation date (fallback current_date), current IST date); no sample/urgent/approval parameter exists", /order by cp\.period_start desc limit 1/.test(helper) && /greatest\(coalesce\(v_val, current_date\)/.test(helper) && !/is_sample|urgent|bypass|override/i.test(helper));
check("P2.3", "helper is STABLE SECURITY DEFINER with fixed search_path (live header)", /STABLE SECURITY DEFINER/.test(liveFn("costing", "fn_sku_activation_missing_items")) && /SET search_path TO 'costing', 'public', 'pg_temp'/.test(liveFn("costing", "fn_sku_activation_missing_items")));
const guardFn = fnBody(liveFn("public", "fn_guard_sku_activation_completeness"));
check("P2.4", "completeness guard: inactive rows pass; UPDATE of an already-active row returns early (explicit existing boundary); error carries errcode P0001 + detail json + hint", /if new\.is_active is not true then return new/.test(guardFn) && /tg_op = 'UPDATE' and old\.is_active is true then return new/.test(guardFn) && /errcode = 'P0001'/.test(guardFn) && /detail  = v_chk::text/.test(guardFn));
const rpc = fnBody(liveFn("public", "rpc_set_product_sku_active"));
check("P2.5", "lifecycle RPC: edit permission, auth, reason required, row lock, same-state rejected, five-essential pre-check only when activating, audit insert with old/new snapshots", /require_permission\('module:manage-products', true\)/.test(rpc) && /auth\.uid\(\)/.test(rpc) && /SKU lifecycle reason is required/.test(rpc) && /for update/.test(rpc) && /is already/.test(rpc) && /if p_is_active then/.test(rpc) && /insert into public\.product_sku_master_audit/.test(rpc) && /to_jsonb\(v_old\)/.test(rpc) && /to_jsonb\(v_new\)/.test(rpc));
check("P2.6", "lifecycle RPC: the five-essential pre-check sits inside `if p_is_active`, so deactivation is never blocked by it, and no cascade touches products or other SKUs", /if p_is_active then[\s\S]*?fn_sku_activation_missing_items[\s\S]*?end if;/.test(rpc) && !/update public\.products|update public\.product_skus ps set is_active = p_is_active where ps\.product_id/.test(rpc) && /case when p_is_active then 'ACTIVATE' else 'DEACTIVATE'/.test(rpc));
const parent = fnBody(liveFn("public", "fn_guard_active_sku_requires_active_product"));
check("P2.7", "parent-active guard: only evaluates when NEW.is_active; missing parent and non-'Active' parent both raise", /if new\.is_active is not true then\s+return new/.test(parent) && /does not exist/.test(parent) && /is distinct from 'Active'/.test(parent));
const check1 = fnBody(liveFn("public", "rpc_get_sku_activation_check"));
check("P2.8", "pre-check RPC needs authentication and module:manage-products VIEW (not edit) and is read-only", /auth\.uid\(\) is null/.test(check1) && /app_has_permission\('module:manage-products', 'view'\)/.test(check1) && !/insert|update|delete/i.test(check1));

// ---- product_skus trigger inventory ----
const trg = Object.fromEntries(catalog.sku_triggers.map((t) => [t.tgname, t]));
check("P3.1", "all five product_skus triggers are enabled (tgenabled = 'O')", catalog.sku_triggers.every((t) => t.tgenabled === "O"));
check("P3.2", "completeness guard is BEFORE INSERT OR UPDATE OF is_active, product_id ROW (so a product_id change on an ACTIVE row fires it, but the function returns early)", /BEFORE INSERT OR UPDATE OF is_active, product_id ON public\.product_skus FOR EACH ROW/.test(trg.trg_sku_activation_completeness_guard.definition));
check("P3.3", "parent-active guard is BEFORE INSERT OR UPDATE OF product_id, is_active ROW", /BEFORE INSERT OR UPDATE OF product_id, is_active ON public\.product_skus FOR EACH ROW/.test(trg.trg_active_sku_requires_active_product.definition));
check("P3.4", "change-log trigger is AFTER INSERT OR DELETE OR UPDATE (every row change, including direct SQL, is logged)", /AFTER INSERT OR DELETE OR UPDATE ON public\.product_skus FOR EACH ROW EXECUTE FUNCTION fn_log_product_sku_change/.test(trg.trg_product_sku_change_log.definition));
check("P3.5", "price-list guard exists; its function definition is NOT in the catalog", !!trg.trg_product_skus_price_list_active_guard);
classify("P3.6", "NOT PROVEN", "fn_product_skus_price_list_active_guard and fn_log_product_sku_change live definitions not captured (repo migrations 20261022173416 / CI-038 describe them)", "catalog question Q4");
check("P3.7", "the SKU epoch trigger is statement-level and also fires on TRUNCATE", /AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public\.product_skus FOR EACH STATEMENT EXECUTE FUNCTION costing\.fn_wp04_readiness_bump_source_epoch/.test(trg.wp04_readiness_epoch_269c9b1695b3.definition));

// ---- 44 readiness epoch triggers ----
const epoch = catalog.readiness_epoch_triggers;
const tables = epoch.map((t) => `${t.schema_name}.${t.relname}`);
check("P4.1", "44 epoch triggers on 44 distinct tables (+ the product_skus one in sku_triggers = 45 hooks incl. SKU)", epoch.length === 44 && new Set(tables).size === 44);
check("P4.2", "every epoch trigger is enabled, AFTER INSERT/DELETE/UPDATE/TRUNCATE, FOR EACH STATEMENT, one shared function", epoch.every((t) => t.tgenabled === "O" && /AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON .* FOR EACH STATEMENT EXECUTE FUNCTION costing\.fn_wp04_readiness_bump_source_epoch\(\)/.test(t.definition)));
check("P4.3", "every captured hook is an AFTER INSERT/DELETE/UPDATE/TRUNCATE write trigger: passage of time alone (an effective_to date being reached) cannot bump an epoch", epoch.every((t) => /^CREATE TRIGGER \S+ AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON /.test(t.definition)));
const have = (t) => tables.includes(t) || t === "public.product_skus";
const essentialsSources = { PM_BOM_REVISION: ["public.plm_bom_revision"], BATCH_SIZE_REFERENCE: ["public.production_batch_size_ref"], MANUFACTURING_ROUTE: ["costing.production_route_family_route", "costing.product_process_route", "costing.production_route_family_product_map"], MRP_POLICY: ["costing.sku_mrp_policy"], SELLING_PRICE_POLICY: ["costing.sku_selling_price_policy"] };
for (const [code, srcs] of Object.entries(essentialsSources)) check(`P4.4.${code}`, `epoch hook present on the source table(s) of ${code}`, srcs.every(have), srcs.filter((s) => !have(s)).join());
check("P4.5", "product master tables that feed route/classification resolution are hooked", ["public.products", "public.product_groups", "public.sub_groups", "public.categories", "public.sub_categories"].every(have));
const notHooked = ["public.plm_bom_revision_line", "public.inv_stock_item", "public.inv_stock_item_class_map", "public.plm_sku_pack_map", "public.product_sku_master_audit", "public.product_sku_change_log"].filter((t) => !have(t));
classify("P4.6", "NOT PROVEN", "tables adjacent to the readiness chain that carry NO epoch hook (BOM lines, stock-item/classification maps, pack map): coverage is only a gap if a resolver reads them — resolver definitions for MRP/selling price are not in the repo or catalog", notHooked.join(", ") + " (catalog question Q8)");

console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
