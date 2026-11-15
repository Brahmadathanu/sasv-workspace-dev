// Assembles the ISOLATED PostgreSQL fixture used by the WP10 G1 transition and mutation suites. It runs only in a throw-away local
// cluster (scripts/wp08-g2-0-shared-master-data/pg-harness.mjs: unix socket, no network, destroyed afterwards). Nothing connects to Supabase.
//
// Reconciled with the independent live catalog (15 Nov 2026, WP10_G1_EVIDENCE/independent-live-catalog-2026-11-15.json). Provenance classes
// (asserted by transition-fixture F13):
//   LIVE-VERBATIM : function/trigger text copied byte-for-byte from a committed live catalog capture. Exceptions are listed explicitly:
//                   the activation helper has ONE transformation (its single `now()` token -> public.fixture_now() so time can be fixed).
//   REPO-VERBATIM : text from a repository migration (plm_sku_bom_revision_as_of, SKU change-log table).
//   STAND-IN      : fixture-only objects replacing live objects whose definitions are NOT captured or depend on uncaptured objects.
//   MODEL         : a stand-in whose control flow is copied from captured live text but which reads fixture tables.
import { catalog, liveFn, liveFn2, migrationFunction, read } from "./lib.mjs";
import { catalog2 } from "./lib.mjs";

const CI038 = "supabase/migrations/20261026022352_ci038_sku_activation_guard.sql";
const GATE_A = "supabase/migrations/20260913093738_plm_bom_revision_governance_gate_a.sql";

export const PROVENANCE = {
  "costing.fn_sku_activation_missing_items": "LIVE-VERBATIM (clock token only)",
  "public.fn_guard_sku_activation_completeness": "LIVE-VERBATIM",
  "public.fn_guard_active_sku_requires_active_product": "LIVE-VERBATIM",
  "public.fn_guard_product_inactivation_requires_no_active_skus + trigger": "LIVE-VERBATIM",
  "public.fn_product_skus_price_list_active_guard + trigger": "LIVE-VERBATIM",
  "public.fn_log_product_sku_change": "LIVE-VERBATIM",
  "public.rpc_set_product_sku_active": "LIVE-VERBATIM",
  "public.rpc_get_sku_activation_check": "LIVE-VERBATIM",
  "public.rpc_create_product_sku": "LIVE-VERBATIM",
  "public.rpc_update_product_sku": "LIVE-VERBATIM",
  "public.rpc_update_product": "LIVE-VERBATIM",
  "costing.fn_resolve_sku_mrp_as_of": "LIVE-VERBATIM",
  "costing.fn_resolve_sku_selling_price_policy_as_of": "LIVE-VERBATIM",
  "costing.fn_resolve_route_family_for_product": "LIVE-VERBATIM",
  "costing.fn_wp04_readiness_bump_source_epoch": "LIVE-VERBATIM",
  "costing.fn_wp04_readiness_source_fingerprint": "LIVE-VERBATIM (missing referenced functions hash as NULL in the fixture)",
  "trigger definitions (product_skus x4, products x1 guard, epoch hooks)": "LIVE-VERBATIM",
  "public.plm_sku_bom_revision_as_of": "REPO-VERBATIM (gate A migration)",
  "public.product_sku_change_log table": "REPO-VERBATIM (CI-038 section 5)",
  "costing.fn_validate_effective_product_process_route": "STAND-IN (live text captured but calls four uncaptured route functions)",
  "costing.fx_read / fx_build_now": "MODEL (control flow copied from the live portfolio RPC text; reads fixture build table)",
  "public.require_permission / app_has_permission / auth.uid / normalize_key": "STAND-IN (live text not captured)",
  "public.rpc_create_product": "NOT EXECUTED in the fixture (captured; product creation is outside the SKU transition scenarios)",
};

const clockPatched = (def) => def.replace(/\(now\(\) at time zone 'Asia\/Kolkata'\)::date/, "(public.fixture_now() at time zone 'Asia/Kolkata')::date");
const HOOKED = ["public.product_skus", "public.products", "public.sub_groups", "public.plm_bom_revision", "public.production_batch_size_ref", "costing.cost_periods", "costing.production_route_family", "costing.production_route_family_route", "costing.production_route_family_product_map", "costing.production_route_family_product_subgroup_map", "costing.production_route_family_product_group_map", "costing.sku_mrp_policy", "costing.sku_selling_price_policy"];

export function fixtureSql() {
  const helper = clockPatched(liveFn("costing", "fn_sku_activation_missing_items"));
  if (helper === liveFn("costing", "fn_sku_activation_missing_items")) throw new Error("clock token not found in live helper");
  const asOf = migrationFunction(GATE_A, "public.plm_sku_bom_revision_as_of").statement;
  const ci038 = read(CI038);
  const changeLogTable = ci038.slice(ci038.indexOf("create table if not exists public.product_sku_change_log"), ci038.indexOf("create or replace function public.fn_log_product_sku_change"));
  const trg = Object.fromEntries(catalog.sku_triggers.map((t) => [t.tgname, t.definition]));
  const productGuardTrigger = catalog2.triggers.find((t) => t.tgname === "trg_product_inactivation_requires_no_active_skus").definition;
  const epochDefs = catalog.readiness_epoch_triggers.filter((t) => HOOKED.includes(`${t.schema_name}.${t.relname}`)).map((t) => t.definition);
  const epochSeed = HOOKED.map((r) => `('${r}')`).join(",");
  return `
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create schema auth; create schema costing;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('fixture.uid', true),'')::uuid $$;
create function public.fixture_now() returns timestamptz language sql stable as $$ select coalesce(nullif(current_setting('fixture.now', true),'')::timestamptz, now()) $$;
create function public.require_permission(p_target text, p_edit boolean) returns void language plpgsql as $$ begin
  if not (',' || coalesce(current_setting('fixture.perms', true),'') || ',') like ('%,' || p_target || ':' || case when p_edit then 'edit' else 'view' end || ',%') then
    raise exception 'Permission denied for % (%)', p_target, case when p_edit then 'edit' else 'view' end; end if; end $$;
create function public.app_has_permission(p_target text, p_mode text) returns boolean language sql as $$
  select (',' || coalesce(current_setting('fixture.perms', true),'') || ',') like ('%,' || p_target || ':' || p_mode || ',%') $$;
create function public.normalize_key(t text) returns text language sql immutable as $$ select lower(btrim(t)) $$;

create table public.sub_groups(id integer primary key, product_group_id integer);
create table public.season_profile(id integer primary key);
create table public.products(id serial primary key, item text, sub_group_id integer references public.sub_groups(id), malayalam_name text, status text not null default 'Active', uom_base text, conversion_to_base numeric,
  is_seasonal boolean default false, is_llt boolean default false, manufacture_lead_time_months integer, season_profile_id integer, is_pto boolean default false);
create table public.product_skus(id bigserial primary key, product_id bigint not null references public.products(id), pack_size numeric not null, uom text not null, is_active boolean not null default false, is_sample boolean not null default false, price_list_ik boolean, price_list_ok boolean);
create table public.plm_bom_revision(id bigserial primary key, sku_id bigint, status text, effective_from date, effective_to date);
create table public.production_batch_size_ref(id bigserial primary key, product_id bigint, is_active boolean not null default true, effective_from date, effective_to date);
create table costing.cost_periods(period_start date primary key, valuation_date date);
create table costing.costing_refresh_run(id bigserial primary key, period_start date, valuation_date date, overall_status text, finished_at timestamptz);
create table costing.production_route_family(id bigint primary key, archived_at timestamptz, status text, effective_from date, effective_to date);
create table costing.production_route_family_route(id bigserial primary key, route_family_id bigint, archived_at timestamptz, status text, effective_from date, effective_to date);
create table costing.production_route_family_product_map(id bigserial primary key, product_id integer, route_family_id bigint, archived_at timestamptz, status text, effective_from date, effective_to date);
create table costing.production_route_family_product_subgroup_map(id bigserial primary key, product_subgroup_id integer, route_family_id bigint, archived_at timestamptz, status text, effective_from date, effective_to date);
create table costing.production_route_family_product_group_map(id bigserial primary key, product_group_id integer, route_family_id bigint, archived_at timestamptz, status text, effective_from date, effective_to date);
create table costing.sku_mrp_policy(id bigserial primary key, sku_id bigint, status text, mrp_ik numeric, mrp_ok numeric, ok_pct numeric, calc_mode text, effective_from date, effective_to date, source_type text, source_quality text, approval_reference text);
create table costing.sku_selling_price_policy(id bigserial primary key, sku_id bigint, is_active boolean, gst_percent numeric, ik_discount_percent numeric, ok_discount_percent numeric, ik_discount_amount numeric, ok_discount_amount numeric, contingency_percent numeric, effective_from date, effective_to date, remarks text);
create table public.product_sku_master_audit(id bigserial primary key, sku_id bigint, product_id bigint, event_type text, old_snapshot jsonb, new_snapshot jsonb, reason text, approval_reference text, actor_user_id uuid, created_at timestamptz not null default now());
create table public.product_master_audit(id bigserial primary key, product_id integer, event_type text, old_snapshot jsonb, new_snapshot jsonb, reason text, approval_reference text, actor_user_id uuid, created_at timestamptz not null default now());
create view costing.v_cost_driver_policy_registry as select 1 as x;
create view costing.v_sku_commercial_sales_basis as select 1 as x;
create view costing.v_regional_marketing_evidence_review_queue as select 1 as x;

-- REPO-VERBATIM resolver and change-log table
${asOf};
${changeLogTable}

-- LIVE-VERBATIM resolvers (independent catalog)
${liveFn2("costing", "fn_resolve_sku_mrp_as_of")};
${liveFn2("costing", "fn_resolve_sku_selling_price_policy_as_of")};
${liveFn2("costing", "fn_resolve_route_family_for_product")};
-- STAND-IN route validation (live text calls four uncaptured functions): valid = a family resolves and an approved family route is effective
create function costing.fn_validate_effective_product_process_route(p_product_id integer, p_as_of_date date default current_date) returns jsonb language sql stable as $$
  select jsonb_build_object('valid', coalesce((select exists(select 1 from costing.production_route_family_route r where r.route_family_id = costing.fn_resolve_route_family_for_product(p_product_id, p_as_of_date)
    and r.archived_at is null and r.status = 'APPROVED' and r.effective_from <= p_as_of_date and (r.effective_to is null or r.effective_to >= p_as_of_date))), false)) $$;

-- LIVE-VERBATIM activation helper (clock token only), guards and RPCs
${helper};
${liveFn("public", "fn_guard_active_sku_requires_active_product")};
${liveFn("public", "fn_guard_sku_activation_completeness")};
${liveFn("public", "rpc_get_sku_activation_check")};
${liveFn("public", "rpc_set_product_sku_active")};
${liveFn2("public", "fn_guard_product_inactivation_requires_no_active_skus")};
${liveFn2("public", "fn_product_skus_price_list_active_guard")};
${liveFn2("public", "fn_log_product_sku_change")};
${liveFn2("public", "rpc_create_product_sku")};
${liveFn2("public", "rpc_update_product_sku")};
${liveFn2("public", "rpc_update_product")};

-- LIVE-VERBATIM triggers
${trg.trg_active_sku_requires_active_product};
${trg.trg_product_skus_price_list_active_guard};
${trg.trg_sku_activation_completeness_guard};
${trg.trg_product_sku_change_log};
${productGuardTrigger};

-- LIVE-VERBATIM epoch substrate: registered relations, bump function, hooks, fingerprint
create table costing.readiness_portfolio_source_epoch(source_relation text primary key, epoch bigint not null default 0, touched_at timestamptz);
insert into costing.readiness_portfolio_source_epoch(source_relation) values ${epochSeed};
${liveFn2("costing", "fn_wp04_readiness_bump_source_epoch")};
${epochDefs.join(";\n")};
${liveFn2("costing", "fn_wp04_readiness_source_fingerprint")};

-- MODEL of the live portfolio read (control flow copied from the captured RPC text)
create table costing.fx_build(id bigserial primary key, period_start date, valuation_date date, evidence_refresh_run_id bigint, status text, is_current boolean default true, source_fingerprint_digest text);
create function costing.fx_build_now(p date) returns bigint language plpgsql as $$ declare v bigint; fp record; begin
  update costing.fx_build set is_current = false where period_start = p and is_current;
  select * into fp from costing.fn_wp04_readiness_source_fingerprint(p);
  insert into costing.fx_build(period_start, valuation_date, evidence_refresh_run_id, status, source_fingerprint_digest)
    values (p, (fp.fingerprint->>'valuation_date')::date, nullif(fp.fingerprint->>'evidence_refresh_run_id','')::bigint, 'COMPLETED', fp.digest) returning id into v; return v; end $$;
create function costing.fx_read(p_period date) returns text language plpgsql as $$ declare v_period date := date_trunc('month', p_period::timestamp)::date; v_id bigint; v_status text; begin
  select b.id into v_id from costing.fn_wp04_readiness_source_fingerprint(v_period) fp join costing.fx_build b on b.period_start = v_period
    and b.valuation_date = (fp.fingerprint->>'valuation_date')::date and b.evidence_refresh_run_id is not distinct from nullif(fp.fingerprint->>'evidence_refresh_run_id','')::bigint
    and b.status = 'COMPLETED' and b.is_current and b.source_fingerprint_digest = fp.digest order by b.id desc limit 1;
  if v_id is not null then return 'FRESH'; end if;
  if not exists(select 1 from costing.fx_build b where b.period_start = v_period and b.is_current) then raise exception 'READINESS_BUILD_ABSENT'; end if;
  select status into v_status from costing.fx_build where period_start = v_period and is_current order by id desc limit 1;
  if v_status <> 'COMPLETED' then raise exception 'READINESS_BUILD_INCOMPLETE'; end if;
  raise exception 'READINESS_BUILD_STALE'; end $$;

-- scenario helpers
create table public.fx_log(id bigserial primary key, label text, ok boolean, sqlstate text, msg text, detail text);
create function public.fx_try(p_label text, p_sql text) returns void language plpgsql as $$ declare v_state text; v_msg text; v_detail text; begin
  begin execute p_sql; insert into public.fx_log(label, ok) values (p_label, true);
  exception when others then get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text, v_detail = pg_exception_detail;
    insert into public.fx_log(label, ok, sqlstate, msg, detail) values (p_label, false, v_state, v_msg, v_detail); end; end $$;
-- make a SKU/product satisfy all five essentials (p_skip names one to leave out). Route via a PRODUCT-level approved family map.
create function public.fx_complete(p_sku bigint, p_product bigint, p_skip text default '') returns void language plpgsql as $$ begin
  if p_skip <> 'PM_BOM' then insert into public.plm_bom_revision(sku_id, status, effective_from, effective_to) values (p_sku, 'APPROVED', date '2026-01-01', null); end if;
  if p_skip <> 'BATCH' and not exists(select 1 from public.production_batch_size_ref where product_id = p_product) then insert into public.production_batch_size_ref(product_id, effective_from) values (p_product, date '2026-01-01'); end if;
  if p_skip <> 'ROUTE' and not exists(select 1 from costing.production_route_family_product_map where product_id = p_product) then
    insert into costing.production_route_family(id, status, effective_from) values (900 + p_product, 'APPROVED', date '2026-01-01');
    insert into costing.production_route_family_product_map(product_id, route_family_id, status, effective_from) values (p_product, 900 + p_product, 'APPROVED', date '2026-01-01');
    insert into costing.production_route_family_route(route_family_id, status, effective_from) values (900 + p_product, 'APPROVED', date '2026-01-01'); end if;
  if p_skip <> 'MRP' then insert into costing.sku_mrp_policy(sku_id, status, effective_from) values (p_sku, 'APPROVED', date '2026-01-01'); end if;
  if p_skip <> 'SELLING' then insert into costing.sku_selling_price_policy(sku_id, is_active, effective_from) values (p_sku, true, date '2026-01-01'); end if; end $$;
insert into costing.cost_periods values (date '2026-09-01', date '2026-09-10');
insert into costing.costing_refresh_run(period_start, valuation_date, overall_status, finished_at) values (date '2026-09-01', date '2026-09-10', 'SUCCESS', timestamptz '2026-09-11 10:00+05:30');
insert into public.sub_groups values (1, 1), (2, 1), (3, 2);
`;
}

/** session preamble: fixed clock, identity and permissions */
export const session = ({ now = "2026-11-15 10:00:00+05:30", uid = "00000000-0000-0000-0000-0000000000e1", perms = "module:manage-products:edit,module:manage-products:view" } = {}) =>
  `select set_config('fixture.now','${now}',false), set_config('fixture.uid','${uid}',false), set_config('fixture.perms','${perms}',false);\n`;
