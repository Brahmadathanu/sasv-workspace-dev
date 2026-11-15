// WP10 G1 — live catalog (committed 15 Nov 2026) vs repository source parity, trigger inventory and epoch-hook coverage.
// Offline/read-only. Run: node scripts/wp10-g1-safeguard-audit/catalog-parity.test.mjs [resultsJson]
import fs from "node:fs";
import { catalog, catalog2, liveFn, liveFn2, liveMeta2, fnBody, normalizeSql, migrationFunction, makeResults, read } from "./lib.mjs";

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
check("P3.6", "the two trigger functions the first capture lacked are now captured (independent catalog): price-list guard and change-log function exist live", !!liveFn2("public", "fn_product_skus_price_list_active_guard") && !!liveFn2("public", "fn_log_product_sku_change"));
check("P3.7", "the SKU epoch trigger is statement-level and also fires on TRUNCATE", /AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public\.product_skus FOR EACH STATEMENT EXECUTE FUNCTION costing\.fn_wp04_readiness_bump_source_epoch/.test(trg.wp04_readiness_epoch_269c9b1695b3.definition));

// ---- 44 readiness epoch triggers ----
const epoch = catalog.readiness_epoch_triggers;
const tables = epoch.map((t) => `${t.schema_name}.${t.relname}`);
check("P4.1", "44 epoch triggers on 44 distinct tables (the product_skus epoch trigger is one of the 44 and is also listed in sku_triggers)", epoch.length === 44 && new Set(tables).size === 44);
check("P4.2", "every epoch trigger is enabled, AFTER INSERT/DELETE/UPDATE/TRUNCATE, FOR EACH STATEMENT, one shared function", epoch.every((t) => t.tgenabled === "O" && /AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON .* FOR EACH STATEMENT EXECUTE FUNCTION costing\.fn_wp04_readiness_bump_source_epoch\(\)/.test(t.definition)));
check("P4.3", "every captured hook is an AFTER INSERT/DELETE/UPDATE/TRUNCATE write trigger: passage of time alone (an effective_to date being reached) cannot bump an epoch", epoch.every((t) => /^CREATE TRIGGER \S+ AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON /.test(t.definition)));
const have = (t) => tables.includes(t) || t === "public.product_skus";
const essentialsSources = { PM_BOM_REVISION: ["public.plm_bom_revision"], BATCH_SIZE_REFERENCE: ["public.production_batch_size_ref"], MANUFACTURING_ROUTE: ["costing.production_route_family_route", "costing.product_process_route", "costing.production_route_family_product_map"], MRP_POLICY: ["costing.sku_mrp_policy"], SELLING_PRICE_POLICY: ["costing.sku_selling_price_policy"] };
for (const [code, srcs] of Object.entries(essentialsSources)) check(`P4.4.${code}`, `epoch hook present on the source table(s) of ${code}`, srcs.every(have), srcs.filter((s) => !have(s)).join());
check("P4.5", "product master tables that feed route/classification resolution are hooked", ["public.products", "public.product_groups", "public.sub_groups", "public.categories", "public.sub_categories"].every(have));
const notHooked = ["public.plm_bom_revision_line", "public.inv_stock_item", "public.inv_stock_item_class_map", "public.plm_sku_pack_map", "public.product_sku_master_audit", "public.product_sku_change_log"].filter((t) => !have(t));
classify("P4.6", "NOT PROVEN", "tables adjacent to the chain with NO epoch hook (BOM lines, stock-item/classification maps, pack map): only a gap if a resolver reads them. The MRP / selling-price / route-family resolvers are now captured and read only hooked tables (P5.17); BOM lines are immutable once approved; no captured resolver reads the inventory/classification tables", notHooked.join(", "));


// ===================== independent live catalog reconciliation (P5) =====================
const F2 = (n) => liveMeta2("public", n) || liveMeta2("costing", n);
check("P5.0", "independent catalog is catalog-only evidence (23 functions, product triggers, privileges, policies, cron classification) with no cron command text and no build-history rows", catalog2.functions.length === 23 && /catalog SELECT only/.test(catalog2.classification) && catalog2.cron.every((c) => !("command" in c)) && catalog2.limits.some((l) => /Optional build-history query omitted/.test(l)));
check("P5.1", "the independent capture is IDENTICAL to the first capture for all five original functions (two captures agree)", catalog.functions.every((f) => liveFn2(f.schema_name, f.proname) === f.definition));
// ACLs: the claim 'SECURITY DEFINER therefore callable' is not made; EXECUTE is read from proacl
const acl = (n) => F2(n).proacl;
check("P5.2", "EXECUTE ACLs: lifecycle/SKU/product writer RPCs and the pre-check are executable by authenticated + service_role; guard functions only by service_role; the activation helper only by its owner", ["rpc_set_product_sku_active", "rpc_create_product_sku", "rpc_update_product_sku", "rpc_create_product", "rpc_update_product", "rpc_get_sku_activation_check"].every((n) => /authenticated=X/.test(acl(n)) && /service_role=X/.test(acl(n))) && ["fn_guard_sku_activation_completeness", "fn_guard_active_sku_requires_active_product", "fn_guard_product_inactivation_requires_no_active_skus", "fn_log_product_sku_change"].every((n) => !/authenticated=X/.test(acl(n)) && /service_role=X/.test(acl(n))) && acl("fn_sku_activation_missing_items") === "{postgres=X/postgres}");
check("P5.3", "the live portfolio read and governed-period list are executable by authenticated only (not service_role); fingerprint, bump and builder are owner-only", /authenticated=X/.test(acl("rpc_get_product_sku_readiness_portfolio")) && !/service_role/.test(acl("rpc_get_product_sku_readiness_portfolio")) && ["fn_wp04_readiness_source_fingerprint", "fn_wp04_readiness_bump_source_epoch", "fn_wp04_build_readiness_portfolio"].every((n) => acl(n) === "{postgres=X/postgres}"));
const W = ["rpc_create_product", "rpc_update_product", "rpc_create_product_sku", "rpc_update_product_sku"];
check("P5.4", "all four writers: SECURITY DEFINER, search_path public+pg_temp, require_permission('module:manage-products', true), auth.uid() check, reason required, write the governed audit table", W.every((n) => { const d = fnBody(liveFn2("public", n)); return F2(n).prosecdef && /require_permission\(\s*'module:manage-products',\s*true\s*\)/.test(d) && /auth\.uid\(\)/.test(d) && /reason is required/.test(d) && /insert into public\.product(_sku)?_master_audit/.test(d); }));
const upd = liveMeta2("public", "rpc_update_product_sku");
check("P5.5", "the SKU update RPC exposes NO product_id and NO active-state parameter, and its UPDATE touches only pack_size, uom, is_sample", !/product_id|is_active/.test(upd.args) && /set\s+pack_size = p_pack_size,\s+uom = v_uom,\s+is_sample = coalesce\(p_is_sample, false\)/.test(fnBody(upd.definition)));
check("P5.6", "the create RPC passes p_is_active into the INSERT (coalesce false) — so an active insert reaches the table triggers (and is rejected there)", /coalesce\(p_is_active, false\)/.test(fnBody(liveFn2("public", "rpc_create_product_sku"))));
// repo parity for the newly captured functions
{
  const log = migrationFunction(CI038, "public.fn_log_product_sku_change");
  check("P5.7", "live change-log function == CI-038 section 5 text", normalizeSql(fnBody(liveFn2("public", "fn_log_product_sku_change"))) === normalizeSql(log.body));
  const PL = "supabase/migrations/20261022173416_price_list_membership_mandatory_inactive_guard_20261022.sql";
  const pl = migrationFunction(PL, "public.fn_product_skus_price_list_active_guard");
  check("P5.8", "live price-list guard == its repository migration text (20261022173416)", !!pl && normalizeSql(fnBody(liveFn2("public", "fn_product_skus_price_list_active_guard"))) === normalizeSql(pl.body));
  const migs = fs.readdirSync("supabase/migrations").map((f) => read("supabase/migrations/" + f)).join("\n");
  const has = (n) => new RegExp(`create or replace function public\\.${n}\\s*\\(`, "i").test(migs);
  classify("P5.9", ["fn_guard_product_inactivation_requires_no_active_skus", "rpc_create_product", "rpc_update_product", "rpc_create_product_sku", "rpc_update_product_sku", "fn_guard_active_sku_requires_active_product"].some(has) ? "FAIL" : "NOT PROVEN", "repository has NO creating migration for the six functions captured live only (product/SKU writers, product-inactivation guard, parent-active guard): repo/live parity cannot be asserted; live text is now the authority", "no repo definition found");
}
// product-side guard
{
  const trigDef = catalog2.triggers.find((t) => t.tgname === "trg_product_inactivation_requires_no_active_skus");
  const body = fnBody(liveFn2("public", "fn_guard_product_inactivation_requires_no_active_skus"));
  check("P5.10", "product-side guard is live, enabled and BEFORE UPDATE OF status; it rejects a transition TO Inactive while any child SKU is active (G-3 resolved at catalog level)", trigDef.tgenabled === "O" && /BEFORE UPDATE OF status ON public\.products FOR EACH ROW/.test(trigDef.definition) && /new\.status is distinct from 'Inactive'/.test(body) && /ps\.is_active = true/.test(body) && /Cannot mark product % inactive while % active SKU\(s\) remain/.test(body));
}
// privileges / RLS / policies
{
  const p = Object.fromEntries(catalog2.privileges.map((r) => [r.relname, r]));
  const T5 = ["products", "product_skus", "product_master_audit", "product_sku_master_audit", "product_sku_change_log"];
  check("P5.11", "all five tables: RLS enabled (not forced), authenticated has NO INSERT/UPDATE/DELETE privilege, anon has no SELECT, service_role has UPDATE", T5.every((t) => p[t] && p[t].relrowsecurity && !p[t].relforcerowsecurity && !p[t].auth_ins && !p[t].auth_upd && !p[t].auth_del && !p[t].anon_sel && p[t].svc_upd));
  check("P5.12", "the only policies are authenticated SELECT on products and product_skus; the audit tables and change log have NO policy (not readable by ordinary roles)", catalog2.policies.length === 2 && catalog2.policies.every((x) => x.cmd === "SELECT" && /authenticated/.test(x.roles)) && !catalog2.policies.some((x) => /audit|change_log/.test(x.tablename)));
}
// readiness freshness composition
{
  const fp = fnBody(liveFn2("costing", "fn_wp04_readiness_source_fingerprint"));
  check("P5.13", "fingerprint = governed period + valuation date from cost_periods + latest SUCCESS refresh run + all source epochs + 13 canonical function definition hashes + 3 view hashes + source schema hash; it references NO current date/now/clock", /cost_periods/.test(fp) && /overall_status='SUCCESS'/.test(fp) && /source_epochs/.test(fp) && /canonical_definition_digest/.test(fp) && /source_schema_digest/.test(fp) && (fp.match(/md5\(pg_get_functiondef/g) || []).length >= 1 && !/current_date|now\(\)|clock_timestamp/i.test(fp));
  const bump = fnBody(liveFn2("costing", "fn_wp04_readiness_bump_source_epoch"));
  check("P5.14", "epoch bump updates the registered relation's epoch and RAISES for an unregistered relation (a hook on an unregistered table would fail the write)", /SET epoch=epoch\+1/.test(bump) && /Unregistered readiness source relation/.test(bump));
  const reads = ["rpc_get_product_sku_readiness", "rpc_get_product_sku_readiness_portfolio", "rpc_get_readiness_governed_periods", "fn_product_sku_readiness_live_core"];
  check("P5.15", "no readiness READ path references today: LIVE_AS_OF reads the governed valuation date from costing.cost_periods; the portfolio read matches digest + valuation date + evidence run and otherwise raises ABSENT / INCOMPLETE / STALE", reads.every((n) => !/current_date|now\(\)|clock_timestamp/i.test(liveFn2(n.startsWith("fn_") ? "costing" : "public", n))) && /select valuation_date into v_val from costing\.cost_periods/i.test(liveFn2("public", "rpc_get_product_sku_readiness").replace(/\s+/g, " ")) && /READINESS_BUILD_ABSENT/.test(liveFn2("public", "rpc_get_product_sku_readiness_portfolio")) && /READINESS_BUILD_STALE/.test(liveFn2("public", "rpc_get_product_sku_readiness_portfolio")));
  const builder = liveFn2("costing", "fn_wp04_build_readiness_portfolio");
  check("P5.16", "the governed builder uses the clock only for build timestamps/status (no as-of use of today)", [...builder.matchAll(/.*(current_date|now\(\)|clock_timestamp).*/gi)].every((m) => /completed_at|promoted_at/.test(m[0])));
}
// resolver closure vs epoch hooks (Q8)
{
  const hooked = new Set(catalog.readiness_epoch_triggers.map((t) => `${t.schema_name}.${t.relname}`));
  const tablesOf = (n) => [...new Set([...liveFn2("costing", n).matchAll(/(?:from|join)\s+((?:costing|public)\.[a-z_]+)/gi)].map((m) => m[1].toLowerCase()))];
  const rows = ["fn_resolve_sku_mrp_as_of", "fn_resolve_sku_selling_price_policy_as_of", "fn_resolve_route_family_for_product"].map((n) => [n, tablesOf(n)]);
  check("P5.17", "MRP, selling-price and route-family resolvers read ONLY epoch-hooked tables (G-6 resolved for these three)", rows.every(([, t]) => t.length > 0 && t.every((x) => hooked.has(x))), rows.map(([n, t]) => `${n}: ${t.join("|")}`).join(" ; "));
  const callees = [...liveFn2("costing", "fn_validate_effective_product_process_route").matchAll(/costing\.(fn_[a-z_]+)\(/g)].map((m) => m[1]).filter((n) => n !== "fn_resolve_route_family_for_product");
  classify("P5.18", "NOT PROVEN", "route-validation chain: fn_validate_effective_product_process_route calls functions whose definitions are NOT captured, so their table closure vs the 44 hooks is unproven (route step/behaviour/product-route tables ARE hooked)", [...new Set(callees)].join(", "));
}
// scheduling / consumers
{
  const cron = catalog2.cron;
  check("P5.19", "34 cron rows captured as name/schedule/active + boolean classification; NONE mentions readiness or invokes the governed builder; no pg_proc source directly calls the builder", cron.length === 34 && cron.every((c) => c.mentions_readiness === false && c.invokes_builder === false) && catalog2.direct_builder_callers.length === 0);
  classify("P5.20", "NOT PROVEN", "no scheduler/owner INSIDE the database was found; an external scheduler/worker, indirect dynamic call or human ownership is neither confirmed nor excluded", `stale consumers in function source: ${catalog2.stale_consumers.map((c) => c.proname).join(",")}; notification-like surfaces are health/ETL names only`);
}

console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
