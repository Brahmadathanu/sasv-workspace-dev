-- ISOLATED SYNTHETIC FIXTURE (scratch PostgreSQL only; NEVER run on Supabase). Shape inferred from the committed view contract;
-- the real table DDL / index DDL is NOT in the repo, so real column width, bloat and visibility-map state are UNVERIFIED.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema costing; create extension if not exists pgcrypto;
create table costing.scheme_master(id bigint primary key, scheme_name text, paid_qty numeric, free_qty numeric, is_active boolean, is_system_defined boolean,
 remarks text, approval_reference text, created_at timestamptz default now(), created_by text, updated_at timestamptz, updated_by text, metadata_update_reason text,
 deactivated_at timestamptz, deactivated_by text, deactivation_reason text, reactivated_at timestamptz, reactivated_by text, reactivation_reason text);
create table costing.sku_scheme_policy(id bigserial primary key, scheme_id bigint, is_active boolean);
create table costing.scheme_policy_rules(id bigserial primary key, scheme_id bigint, replace_from_scheme_id bigint, is_active boolean);
create table costing.sku_scheme_viability_snapshot(id bigserial primary key, refresh_run_id bigint, period_start date, sku_id bigint, scheme_id bigint,
 scheme_viability_status text, pad text);
create index idx_sku_scheme_viability_snapshot_scheme on costing.sku_scheme_viability_snapshot(scheme_id);
create index idx_sku_scheme_snapshot_period_status on costing.sku_scheme_viability_snapshot(period_start, scheme_viability_status, sku_id, scheme_id);
create index idx_snap_refresh_run on costing.sku_scheme_viability_snapshot(refresh_run_id);
create function public.fn_costing_view_allowed() returns boolean language sql stable as $$ select current_user in ('postgres','service_role') or pg_has_role(current_user,'authenticated','member') and coalesce(current_setting('app.costing_view','t'),'off')='on' $$;
insert into costing.scheme_master(id,scheme_name,paid_qty,free_qty,is_active,is_system_defined)
 select i,'Scheme '||chr(64+i),case when i=7 then 0 else 10 end,i,i<>6,i=1 from generate_series(1,7) i;
insert into costing.sku_scheme_policy(scheme_id,is_active) select 1+(i%5),i%3<>0 from generate_series(1,120) i;
insert into costing.scheme_policy_rules(scheme_id,replace_from_scheme_id,is_active) select 1+(i%4),1+((i+1)%5),i%2=0 from generate_series(1,40) i;
-- 6 populated schemes (scheme 7 empty), 36 periods x ~1,070 sku rows ≈ 231k rows, mimics planner estimate in the log review
insert into costing.sku_scheme_viability_snapshot(refresh_run_id,period_start,sku_id,scheme_id,scheme_viability_status,pad)
 select p, date '2024-01-01' + (p*30), sku, s, (array['READY','BLOCKED','REVIEW_REQUIRED'])[1+(sku%3)], repeat(md5(random()::text),12)
 from generate_series(1,36) p, generate_series(1,1070) sku, generate_series(1,6) s;
-- interleave physical order (refresh jobs append per run, not per scheme): already period-major here
vacuum analyze costing.sku_scheme_viability_snapshot; analyze costing.scheme_master; analyze costing.sku_scheme_policy; analyze costing.scheme_policy_rules;
