// Assembles the ISOLATED PostgreSQL fixture used by transition-fixture.test.mjs. It runs only in a throw-away local cluster
// (scripts/wp08-g2-0-shared-master-data/pg-harness.mjs: unix socket, no network, destroyed afterwards). Nothing connects to Supabase.
//
// Provenance of every object (the tests assert this table):
//   LIVE-VERBATIM  : function/trigger text copied byte-for-byte from the committed live catalog capture
//                    (helper has ONE documented transformation: the two clock tokens now() -> public.fixture_now() so time can be fixed)
//   REPO-VERBATIM  : function text copied from a repository migration (plm_sku_bom_revision_as_of, SKU change log)
//   STAND-IN       : fixture-only objects replacing live objects whose definitions are NOT captured (writer RPCs for product/SKU
//                    create/update, product-inactivation guard, resolvers for route/MRP/selling price, epoch bump function,
//                    freshness fingerprint). They model the DOCUMENTED contract only and are never evidence of live behaviour.
import { catalog, liveFn, migrationFunction, read } from "./lib.mjs";

const CI038 = "supabase/migrations/20261026022352_ci038_sku_activation_guard.sql";
const GATE_A = "supabase/migrations/20260913093738_plm_bom_revision_governance_gate_a.sql";

export const PROVENANCE = {
  "costing.fn_sku_activation_missing_items": "LIVE-VERBATIM (clock tokens only)",
  "public.fn_guard_sku_activation_completeness": "LIVE-VERBATIM",
  "public.fn_guard_active_sku_requires_active_product": "LIVE-VERBATIM",
  "public.rpc_set_product_sku_active": "LIVE-VERBATIM",
  "public.rpc_get_sku_activation_check": "LIVE-VERBATIM",
  "trg_active_sku_requires_active_product": "LIVE-VERBATIM",
  "trg_sku_activation_completeness_guard": "LIVE-VERBATIM",
  "public.plm_sku_bom_revision_as_of": "REPO-VERBATIM (gate A migration)",
  "public.fn_log_product_sku_change + trg_product_sku_change_log": "REPO-VERBATIM (CI-038 section 5)",
  "fx_standin_rpc_create_product_sku / _update_product_sku / _update_product_status": "STAND-IN (live definitions NOT captured)",
  "fx_standin_guard_product_inactivation": "STAND-IN (live definition NOT captured; documented in WP-02-G1)",
  "costing.fn_resolve_* / fn_validate_* resolvers": "STAND-IN (MRP / selling-price live definitions NOT captured; route resolvers differ)",
  "costing.fn_wp04_readiness_bump_source_epoch + fx_fingerprint/fx_read": "STAND-IN (live definitions NOT captured; models the documented V2.2 freshness comparison)",
};

const clockPatched = (def) => def.replace(/\(now\(\) at time zone 'Asia\/Kolkata'\)::date/, "(public.fixture_now() at time zone 'Asia/Kolkata')::date");

export function fixtureSql() {
  const helper = clockPatched(liveFn("costing", "fn_sku_activation_missing_items"));
  if (helper === liveFn("costing", "fn_sku_activation_missing_items")) throw new Error("clock token not found in live helper");
  const asOf = migrationFunction(GATE_A, "public.plm_sku_bom_revision_as_of").statement;
  const ci038 = read(CI038);
  const changeLog = ci038.slice(ci038.indexOf("create table if not exists public.product_sku_change_log"), ci038.lastIndexOf("commit;"));
  const trg = Object.fromEntries(catalog.sku_triggers.map((t) => [t.tgname, t.definition]));
  const epochTriggers = catalog.readiness_epoch_triggers
    .filter((t) => ["costing.cost_periods", "costing.production_route_family_route", "costing.sku_mrp_policy", "costing.sku_selling_price_policy", "public.plm_bom_revision", "public.production_batch_size_ref", "public.products"].includes(`${t.schema_name}.${t.relname}`))
    .map((t) => t.definition);
  return `
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create schema auth; create schema costing;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('fixture.uid', true),'')::uuid $$;
create function public.fixture_now() returns timestamptz language sql stable as $$ select coalesce(nullif(current_setting('fixture.now', true),'')::timestamptz, now()) $$;
-- permission stand-ins: fixture.perms = 'module:manage-products:edit,module:manage-products:view'
create function public.require_permission(p_target text, p_edit boolean) returns void language plpgsql as $$ begin
  if not (',' || coalesce(current_setting('fixture.perms', true),'') || ',') like ('%,' || p_target || ':' || case when p_edit then 'edit' else 'view' end || ',%') then
    raise exception 'Permission denied for % (%)', p_target, case when p_edit then 'edit' else 'view' end; end if; end $$;
create function public.app_has_permission(p_target text, p_mode text) returns boolean language sql as $$
  select (',' || coalesce(current_setting('fixture.perms', true),'') || ',') like ('%,' || p_target || ':' || p_mode || ',%') $$;

create table public.products(id bigserial primary key, item text, status text not null default 'Active');
create table public.product_skus(id bigserial primary key, product_id bigint not null references public.products(id), pack_size numeric not null, uom text not null, is_active boolean not null default false, is_sample boolean not null default false);
create table public.plm_bom_revision(id bigserial primary key, sku_id bigint, status text, effective_from date, effective_to date);
create table public.production_batch_size_ref(id bigserial primary key, product_id bigint, is_active boolean not null default true, effective_from date, effective_to date);
create table costing.cost_periods(period_start date primary key, valuation_date date);
create table costing.production_route_family_route(id bigserial primary key, route_family_id bigint, archived_at timestamptz, status text, effective_from date, effective_to date);
create table costing.fx_product_route_family(product_id bigint, route_family_id bigint);
create table costing.sku_mrp_policy(id bigserial primary key, sku_id bigint, effective_from date, effective_to date);
create table costing.sku_selling_price_policy(id bigserial primary key, sku_id bigint, effective_from date, effective_to date);
create table public.product_sku_master_audit(id bigserial primary key, sku_id bigint, product_id bigint, event_type text, old_snapshot jsonb, new_snapshot jsonb, reason text, approval_reference text, actor_user_id uuid, created_at timestamptz not null default now());

-- STAND-IN resolvers (documented semantics only)
create function costing.fn_resolve_route_family_for_product(p int, d date) returns bigint language sql stable as $$ select route_family_id from costing.fx_product_route_family where product_id = p limit 1 $$;
create function costing.fn_validate_effective_product_process_route(p int, d date) returns jsonb language sql stable as $$
  select jsonb_build_object('valid', exists(select 1 from costing.fx_product_route_family m join costing.production_route_family_route r on r.route_family_id = m.route_family_id
    where m.product_id = p and r.archived_at is null and r.status = 'APPROVED' and r.effective_from <= d and (r.effective_to is null or r.effective_to >= d))) $$;
create function costing.fn_resolve_sku_mrp_as_of(s bigint, d date) returns table(resolution_status text) language sql stable as $$
  select case count(*) when 1 then 'RESOLVED' when 0 then 'MISSING' else 'AMBIGUOUS' end from costing.sku_mrp_policy where sku_id = s and effective_from <= d and (effective_to is null or effective_to >= d) $$;
create function costing.fn_resolve_sku_selling_price_policy_as_of(s bigint, d date) returns table(resolution_status text) language sql stable as $$
  select case count(*) when 1 then 'RESOLVED' when 0 then 'MISSING' else 'AMBIGUOUS' end from costing.sku_selling_price_policy where sku_id = s and effective_from <= d and (effective_to is null or effective_to >= d) $$;

-- REPO-VERBATIM resolver
${asOf};

-- LIVE-VERBATIM helper (clock tokens only) and guards
${helper};
${liveFn("public", "fn_guard_active_sku_requires_active_product")};
${liveFn("public", "fn_guard_sku_activation_completeness")};
${liveFn("public", "rpc_get_sku_activation_check")};
${liveFn("public", "rpc_set_product_sku_active")};

-- REPO-VERBATIM change log (CI-038 section 5)
${changeLog}

-- LIVE-VERBATIM trigger definitions
${trg.trg_active_sku_requires_active_product};
${trg.trg_sku_activation_completeness_guard};

-- STAND-IN readiness epoch + freshness model
create table costing.readiness_portfolio_source_epoch(source_name text primary key, epoch bigint not null default 0);
create function costing.fn_wp04_readiness_bump_source_epoch() returns trigger language plpgsql as $$ begin
  insert into costing.readiness_portfolio_source_epoch(source_name, epoch) values (tg_table_schema || '.' || tg_table_name, 1)
  on conflict (source_name) do update set epoch = costing.readiness_portfolio_source_epoch.epoch + 1; return null; end $$;
${catalog.sku_triggers.find((t) => t.tgname.startsWith("wp04_readiness_epoch_")).definition};
${epochTriggers.join(";\n")};
create function costing.fx_fingerprint(p date) returns text language sql stable as $$
  select md5(coalesce((select valuation_date::text from costing.cost_periods where period_start = p), '') || '|' ||
             coalesce((select string_agg(source_name || ':' || epoch, ',' order by source_name) from costing.readiness_portfolio_source_epoch), '')) $$;
create table costing.fx_build(id bigserial primary key, period_start date, digest text, status text, is_current boolean default true);
create function costing.fx_build_now(p date) returns bigint language plpgsql as $$ declare v bigint; begin
  update costing.fx_build set is_current = false where period_start = p and is_current;
  insert into costing.fx_build(period_start, digest, status) values (p, costing.fx_fingerprint(p), 'COMPLETED') returning id into v; return v; end $$;
create function costing.fx_read(p date) returns text language plpgsql as $$ begin
  if not exists(select 1 from costing.fx_build where period_start = p and is_current) then raise exception 'READINESS_BUILD_ABSENT'; end if;
  if exists(select 1 from costing.fx_build where period_start = p and is_current and status = 'COMPLETED' and digest = costing.fx_fingerprint(p)) then return 'FRESH'; end if;
  raise exception 'READINESS_BUILD_STALE'; end $$;

-- STAND-IN product-side guard (live fn_guard_product_inactivation_requires_no_active_skus NOT captured)
create function public.fx_standin_guard_product_inactivation() returns trigger language plpgsql as $$ begin
  if new.status is distinct from 'Active' and old.status = 'Active' and exists(select 1 from public.product_skus where product_id = new.id and is_active) then
    raise exception 'Cannot inactivate product %: active SKUs exist', new.id; end if; return new; end $$;

-- STAND-IN writer RPCs (documented WP-02/WP-03 contract: permission edit, reason, positive pack, nonblank uom, duplicate identity, audit)
create function public.fx_standin_rpc_create_product_sku(p_product_id bigint, p_pack_size numeric, p_uom text, p_is_active boolean, p_is_sample boolean, p_reason text, p_approval_reference text default null) returns bigint language plpgsql as $$
declare v_id bigint; begin
  perform public.require_permission('module:manage-products', true);
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(p_pack_size, 0) <= 0 then raise exception 'Pack size must be positive'; end if;
  if btrim(coalesce(p_uom, '')) = '' then raise exception 'UOM is required'; end if;
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'Reason is required'; end if;
  if exists(select 1 from public.product_skus where product_id = p_product_id and pack_size = p_pack_size and uom = p_uom) then raise exception 'Duplicate SKU identity'; end if;
  insert into public.product_skus(product_id, pack_size, uom, is_active, is_sample) values (p_product_id, p_pack_size, p_uom, coalesce(p_is_active, false), coalesce(p_is_sample, false)) returning id into v_id;
  insert into public.product_sku_master_audit(sku_id, product_id, event_type, new_snapshot, reason, approval_reference, actor_user_id)
    select id, product_id, 'CREATE', to_jsonb(s), p_reason, p_approval_reference, auth.uid() from public.product_skus s where s.id = v_id;
  return v_id; end $$;
create function public.fx_standin_rpc_update_product_sku(p_sku_id bigint, p_pack_size numeric, p_uom text, p_is_sample boolean, p_reason text) returns void language plpgsql as $$
declare v_old public.product_skus%rowtype; begin
  perform public.require_permission('module:manage-products', true);
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'Reason is required'; end if;
  select * into v_old from public.product_skus where id = p_sku_id for update;
  update public.product_skus set pack_size = p_pack_size, uom = p_uom, is_sample = p_is_sample where id = p_sku_id;
  insert into public.product_sku_master_audit(sku_id, product_id, event_type, old_snapshot, new_snapshot, reason, actor_user_id)
    select id, product_id, 'UPDATE', to_jsonb(v_old), to_jsonb(s), p_reason, auth.uid() from public.product_skus s where s.id = p_sku_id; end $$;
create function public.fx_standin_rpc_update_product_status(p_id bigint, p_status text) returns void language plpgsql as $$ begin
  perform public.require_permission('module:manage-products', true); update public.products set status = p_status where id = p_id; end $$;

-- scenario helpers
create table public.fx_log(id bigserial primary key, label text, ok boolean, sqlstate text, msg text, detail text);
create function public.fx_try(p_label text, p_sql text) returns void language plpgsql as $$ declare v_state text; v_msg text; v_detail text; begin
  begin execute p_sql; insert into public.fx_log(label, ok) values (p_label, true);
  exception when others then get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text, v_detail = pg_exception_detail;
    insert into public.fx_log(label, ok, sqlstate, msg, detail) values (p_label, false, v_state, v_msg, v_detail); end; end $$;
create function public.fx_complete(p_sku bigint, p_product bigint, p_skip text default '') returns void language plpgsql as $$ begin
  if p_skip <> 'PM_BOM' then insert into public.plm_bom_revision(sku_id, status, effective_from, effective_to) values (p_sku, 'APPROVED', date '2026-01-01', null); end if;
  if p_skip <> 'BATCH' and not exists(select 1 from public.production_batch_size_ref where product_id = p_product) then insert into public.production_batch_size_ref(product_id, effective_from) values (p_product, date '2026-01-01'); end if;
  if p_skip <> 'ROUTE' and not exists(select 1 from costing.fx_product_route_family where product_id = p_product) then
    insert into costing.fx_product_route_family values (p_product, 900 + p_product); insert into costing.production_route_family_route(route_family_id, status, effective_from) values (900 + p_product, 'APPROVED', date '2026-01-01'); end if;
  if p_skip <> 'MRP' then insert into costing.sku_mrp_policy(sku_id, effective_from) values (p_sku, date '2026-01-01'); end if;
  if p_skip <> 'SELLING' then insert into costing.sku_selling_price_policy(sku_id, effective_from) values (p_sku, date '2026-01-01'); end if; end $$;
insert into costing.cost_periods values (date '2026-09-01', date '2026-09-10');
`;
}

/** session preamble: fixed clock, identity and permissions */
export const session = ({ now = "2026-11-15 10:00:00+05:30", uid = "00000000-0000-0000-0000-0000000000e1", perms = "module:manage-products:edit,module:manage-products:view" } = {}) =>
  `select set_config('fixture.now','${now}',false), set_config('fixture.uid','${uid}',false), set_config('fixture.perms','${perms}',false);\n`;
