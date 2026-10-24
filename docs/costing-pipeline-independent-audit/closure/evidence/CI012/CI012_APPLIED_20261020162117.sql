-- PREPARED_CI012_no_backdating_guard.sql
-- PREPARED ONLY. NOT APPLIED. Needs explicit user approval; apply via apply_migration (name ci012_no_backdating_guard).
-- Policy P38 / CI-012: in-month effective dates going forward only, with no backdating and no proration.
-- Live evidence (19 Oct, read-only): most effective-dated costing masters are routinely written with an effective_from
-- before their creation date (e.g. selling price policy 656/656, product route maps 259/440 in the last 120 days).
-- A blanket refusal would break those workflows, so the guard is tiered and configured per table:
--   FORWARD_ONLY    : refuse effective_from / effective_to (insert, or change on update) earlier than today (IST)
--                     or on/before the frozen-through date.
--   NOT_INTO_FROZEN : refuse dates on/before the frozen-through date (latest valuation date of a LOCKED/CLOSED period
--                     or of a REFERENCE/APPROVED run); in-month dates after it are allowed.
--   AUDIT_ONLY      : allow, but log any write that FORWARD_ONLY would have refused (review before promoting).
-- Frozen snapshots and approved runs are already immutable (AU2 guards); this guard keeps masters from being re-dated
-- underneath frozen valuations. It never changes an existing row.
-- Out of scope (not attached): QC tables (WP07 area, Jarvis), registers/snapshots
-- (material_review_acceptance_register, sku_selected_scheme_policy_context_snapshot), demand_event_register (historical by nature).

do $$ declare t text; begin
  foreach t in array array['plant_capacity_profile','capacity_fallback_policy','route_step_capacity_rule','plant_aware_load_switch',
    'cost_head_policy_ledger','demand_volume_selection_policy','product_demand_seasonality','sku_demand_volume_override'] loop
    if to_regclass('costing.'||t) is null then raise exception 'CI012 GUARD: costing.% missing', t; end if;
  end loop;
  if to_regclass('costing.effective_date_guard_config') is not null then raise exception 'CI012 GUARD: already installed'; end if;
end $$;

create table costing.effective_date_guard_config (
  table_name regclass primary key,
  mode text not null check (mode in ('FORWARD_ONLY','NOT_INTO_FROZEN','AUDIT_ONLY')),
  note text,
  approval_reference text,
  updated_at timestamptz not null default now());

create table costing.effective_date_backdate_log (
  id bigint generated always as identity primary key,
  logged_at timestamptz not null default now(),
  table_name text not null, op text not null, row_id text,
  column_name text not null, new_date date not null,
  ist_today date not null, frozen_through date,
  mode text not null,
  db_user text not null default current_user, app_user uuid default auth.uid());

create or replace function costing.fn_frozen_valuation_through()
returns date language sql stable security definer set search_path to 'costing','public','pg_temp' as $f$
  select max(d) from (
    select p.valuation_date d from costing.cost_periods p where p.status in ('LOCKED','CLOSED')
    union all
    select r.valuation_date from costing.v_costing_run_effective_designation e
      join costing.costing_refresh_run r on r.id = e.refresh_run_id
     where e.designation in ('REFERENCE','APPROVED')) z
$f$;

create or replace function costing.fn_guard_effective_date_forward()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare
  v_mode text; v_today date := (now() at time zone 'Asia/Kolkata')::date; v_frozen date;
  n jsonb := to_jsonb(new); o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  c text; d date; v_bad_fwd boolean; v_bad_frozen boolean;
begin
  select g.mode into v_mode from costing.effective_date_guard_config g where g.table_name = tg_relid;
  if v_mode is null then return new; end if;
  v_frozen := costing.fn_frozen_valuation_through();
  foreach c in array array['effective_from','effective_to'] loop
    continue when not (n ? c) or n->>c is null;
    continue when tg_op = 'UPDATE' and (o->>c) is not distinct from (n->>c);
    d := (n->>c)::date;
    v_bad_frozen := v_frozen is not null and d <= v_frozen;
    v_bad_fwd := d < v_today or v_bad_frozen;
    if v_mode = 'FORWARD_ONLY' and v_bad_fwd then
      raise exception 'CI012_BACKDATE_REFUSED: costing.% % = % is earlier than today % or on/before frozen-through %; in-month changes are forward-only (P38)',
        tg_table_name, c, d, v_today, v_frozen using errcode = 'P0001';
    elsif v_mode = 'NOT_INTO_FROZEN' and v_bad_frozen then
      raise exception 'CI012_BACKDATE_REFUSED: costing.% % = % is on/before frozen-through valuation date %', tg_table_name, c, d, v_frozen using errcode = 'P0001';
    elsif v_mode = 'AUDIT_ONLY' and v_bad_fwd then
      insert into costing.effective_date_backdate_log (table_name, op, row_id, column_name, new_date, ist_today, frozen_through, mode)
      values (tg_table_name, tg_op, n->>'id', c, d, v_today, v_frozen, v_mode);
    end if;
  end loop;
  return new;
end $f$;

-- Initial configuration: capacity, cost-head ledger and DVS-1 masters are FORWARD_ONLY (no backdated writes in their
-- live history except the ledger's initial load); every other effective-dated costing master is AUDIT_ONLY.
insert into costing.effective_date_guard_config (table_name, mode, note) values
 ('costing.plant_capacity_profile','FORWARD_ONLY','CI-012 capacity'),
 ('costing.capacity_fallback_policy','FORWARD_ONLY','CI-012 capacity'),
 ('costing.route_step_capacity_rule','FORWARD_ONLY','CI-012 capacity'),
 ('costing.plant_aware_load_switch','FORWARD_ONLY','CI-012 capacity switch'),
 ('costing.cost_head_policy_ledger','FORWARD_ONLY','P38 ledger changes forward only'),
 ('costing.demand_volume_selection_policy','FORWARD_ONLY','DVS-1'),
 ('costing.product_demand_seasonality','FORWARD_ONLY','DVS-1'),
 ('costing.sku_demand_volume_override','FORWARD_ONLY','DVS-1');
insert into costing.effective_date_guard_config (table_name, mode, note)
select c.oid::regclass, 'AUDIT_ONLY', 'observe two weeks, then promote to NOT_INTO_FROZEN'
  from pg_class c join information_schema.columns k on k.table_schema = 'costing' and k.table_name = c.relname and k.column_name = 'effective_from'
 where c.relnamespace = 'costing'::regnamespace and c.relkind = 'r'
   and c.relname not in ('qc_workload_policy','qc_batch_true_switch','material_review_acceptance_register',
                         'sku_selected_scheme_policy_context_snapshot','effective_date_guard_config')
   and c.relname not like '%snapshot%'
   and not exists (select 1 from costing.effective_date_guard_config g where g.table_name = c.oid::regclass);

do $$ declare r record; begin
  for r in select table_name from costing.effective_date_guard_config loop
    execute format('create trigger trg_ci012_effective_date_guard before insert or update on %s for each row execute function costing.fn_guard_effective_date_forward()', r.table_name);
  end loop; end $$;

do $$ declare t text; begin
  foreach t in array array['effective_date_guard_config','effective_date_backdate_log'] loop
    execute format('alter table costing.%I enable row level security', t);
    execute format('revoke all on costing.%I from public', t);
    if exists (select 1 from pg_roles where rolname='anon') then execute format('revoke all on costing.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on costing.%I from authenticated', t); end if;
  end loop; end $$;
revoke all on function costing.fn_guard_effective_date_forward() from public;

do $$ begin
  if (select count(*) from costing.effective_date_guard_config where mode='FORWARD_ONLY') <> 8 then raise exception 'CI012 POST: forward-only tables <> 8'; end if;
  if (select count(*) from pg_trigger where tgname='trg_ci012_effective_date_guard') <> (select count(*) from costing.effective_date_guard_config)
    then raise exception 'CI012 POST: trigger count mismatch'; end if;
end $$;
