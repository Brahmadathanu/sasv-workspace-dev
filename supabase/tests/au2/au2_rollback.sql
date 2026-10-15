-- AU-2 rollback (DRAFT). Deliberately NOT in supabase/migrations so no CLI push can pick it up.
-- Effect: removes every AU-2 enforcement point and restores the live current-run view byte-for-byte.
-- Keeps the three governance tables and their rows (append-only evidence of decisions); dropping them is a
-- separate, explicit user decision (section C).
begin;
set local lock_timeout = '5s';
-- A. triggers (every trg_au2_* in schema costing)
do $$ declare r record; begin
  for r in select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='costing' and t.tgname like 'trg_au2_%' and not t.tgisinternal loop
    execute format('drop trigger %I on costing.%I', r.tgname, r.relname);
  end loop; end $$;
-- B. current-run view: exact live definition as of 2026-10-15 (selection by latest finished_at).
-- The AU-2 view has one extra trailing column, so it must be dropped and recreated; dependent views are
-- recreated by capturing and replaying their definitions.
create temp table _au2_deps on commit drop as
  with recursive d as (
    select distinct dc.oid, 1 lvl from pg_depend dp join pg_rewrite rw on rw.oid=dp.objid join pg_class dc on dc.oid=rw.ev_class
     where dp.refobjid='costing.v_current_successful_costing_refresh_run'::regclass and dc.oid<>dp.refobjid
    union
    select dc.oid, d.lvl+1 from d join pg_depend dp on dp.refobjid=d.oid join pg_rewrite rw on rw.oid=dp.objid join pg_class dc on dc.oid=rw.ev_class
     where dc.oid<>d.oid)
  select c.oid, n.nspname, c.relname, c.relkind, max(d.lvl) lvl,
         pg_get_viewdef(c.oid) def,
         (select string_agg(format('grant %s on %I.%I to %I;', a.privilege_type, n.nspname, c.relname, a.grantee), ' ')
            from information_schema.role_table_grants a where a.table_schema=n.nspname and a.table_name=c.relname and a.grantee<>'postgres') grants,
         obj_description(c.oid,'pg_class') cmt, c.reloptions
    from d join pg_class c on c.oid=d.oid join pg_namespace n on n.oid=c.relnamespace group by c.oid,n.nspname,c.relname,c.relkind;
create temp table _au2_basegrants on commit drop as
  select format('grant %s on costing.v_current_successful_costing_refresh_run to %I;', privilege_type, grantee) g
    from information_schema.role_table_grants
   where table_schema='costing' and table_name='v_current_successful_costing_refresh_run' and grantee<>'postgres';
create temp table _au2_baseowner on commit drop as select pg_get_userbyid(relowner) o from pg_class where oid='costing.v_current_successful_costing_refresh_run'::regclass;
do $$ begin if exists (select 1 from _au2_deps where relkind='m') then raise exception 'AU2_ROLLBACK_ABORT: materialized view depends on current-run view; handle manually'; end if; end $$;
drop view costing.v_current_successful_costing_refresh_run cascade;
create view costing.v_current_successful_costing_refresh_run as
 SELECT id AS refresh_run_id,
    period_start,
    valuation_date,
    overall_status,
    valuation_context_source,
    source_trigger,
    requested_scope,
    requested_at,
    started_at,
    finished_at
   FROM ( SELECT r.id,
            r.period_start,
            r.requested_scope,
            r.source_trigger,
            r.request_note,
            r.requested_by,
            r.requested_at,
            r.started_at,
            r.finished_at,
            r.overall_status,
            r.current_stage_code,
            r.error_stage_code,
            r.error_message,
            r.latest_stage_order,
            r.material_snapshot_status,
            r.cost_build_status,
            r.cost_sheet_status,
            r.control_status,
            r.final_snapshot_status,
            r.final_blocked_count,
            r.final_review_required_count,
            r.final_ready_count,
            r.created_at,
            r.updated_at,
            r.valuation_date,
            r.period_status_at_request,
            r.valuation_date_status_at_request,
            r.valuation_context_source,
            r.valuation_context_captured_at,
            row_number() OVER (PARTITION BY r.period_start ORDER BY r.finished_at DESC NULLS LAST, r.id DESC) AS governed_run_rank
           FROM costing.costing_refresh_run r
          WHERE ((r.overall_status = 'SUCCESS'::text) AND (r.valuation_context_source = 'CAPTURED_AT_REQUEST'::text))) ranked
  WHERE (governed_run_rank = 1);
do $$ declare r record; begin
  execute format('alter view costing.v_current_successful_costing_refresh_run owner to %I', (select o from _au2_baseowner));
  for r in select g from _au2_basegrants loop execute r.g; end loop;
  for r in select * from _au2_deps order by lvl loop
    execute format('create view %I.%I %s as %s', r.nspname, r.relname,
                   case when r.reloptions is not null then 'with ('||array_to_string(r.reloptions,',')||')' else '' end, r.def);
    if r.grants is not null then execute r.grants; end if;
    if r.cmt is not null then execute format('comment on view %I.%I is %L', r.nspname, r.relname, r.cmt); end if;
  end loop; end $$;
-- D. RPCs stop being callable
revoke all on function costing.rpc_designate_costing_run(bigint,text,text,text), costing.rpc_authorize_period_refresh(date,text,text,int),
                       costing.rpc_close_cost_period(date,text,text,text) from public, anon, authenticated, service_role;
commit;
-- C. (only on explicit user decision) drop governance tables:
--   drop table costing.costing_period_refresh_authorization, costing.costing_run_designation, costing.costing_run_fingerprint cascade;
