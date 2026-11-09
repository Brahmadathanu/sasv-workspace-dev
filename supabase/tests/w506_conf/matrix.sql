-- WP05-W506-CONF-01 identity matrix: the three Staff Governance views after the personnel gate. SYNTHETIC rows only.
\set ON_ERROR_STOP on
set client_min_messages = warning;
drop schema if exists t cascade; create schema t; create table t.result(n serial, test text, outcome text, detail text);
insert into public.user_permissions_canonical values
 ('00000000-0000-0000-0000-0000000000c1','module:cost-build-manager',true,true),        -- authorised editor
 ('00000000-0000-0000-0000-0000000000b1','module:cost-build-manager',true,false),       -- CBM view-only
 ('00000000-0000-0000-0000-0000000000d1','module:cost-build-manager',false,true),       -- CBM edit without view
 ('00000000-0000-0000-0000-0000000000e1','module:cost-sheet-review',true,false),        -- other module (CSR) only
 ('00000000-0000-0000-0000-0000000000f1','module:material-cost-manager',true,false),    -- other module (MCM) only
 ('00000000-0000-0000-0000-0000000000f2','module:costing-control-center',true,true);    -- CCC view+edit (other module edit)
create function t.counts(p_role text, p_uid text) returns text language plpgsql as $$
declare r int; v int; p int; d int;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid,''), true);
  select count(*) into r from public.v_costing_staff_classification_register;
  select count(*) into v from public.v_costing_unclassified_staff_for_costing;
  select count(*), count(staff_details) into p, d from public.v_costing_staff_cost_pool_summary;
  reset role;
  return r||'/'||v||'/'||p||'/'||d;
exception when others then reset role; return 'ERR:'||sqlstate;
end $$;
-- expected 'register/review/pool/pool_with_details'
create procedure t.chk(p_name text, p_role text, p_uid text, p_exp text) language plpgsql as $$
declare g text := t.counts(p_role, p_uid);
begin insert into t.result(test,outcome,detail) values (p_name, case when g = p_exp then 'PASS' else 'FAIL' end, 'got '||g||' want '||p_exp); end $$;
call t.chk('ID-N no grants',                         'authenticated','00000000-0000-0000-0000-0000000000a1','0/0/0/0');
call t.chk('unauthenticated (no JWT subject)',       'authenticated','',                                    '0/0/0/0');
call t.chk('CSR view-only (other module)',           'authenticated','00000000-0000-0000-0000-0000000000e1','0/0/1/0');
call t.chk('MCM view-only (other module)',           'authenticated','00000000-0000-0000-0000-0000000000f1','0/0/1/0');
call t.chk('CCC view+edit (other module edit)',      'authenticated','00000000-0000-0000-0000-0000000000f2','0/0/1/0');
call t.chk('CBM view-only',                          'authenticated','00000000-0000-0000-0000-0000000000b1','0/0/1/0');
call t.chk('CBM edit without view',                  'authenticated','00000000-0000-0000-0000-0000000000d1','0/0/0/0');
call t.chk('CBM view+edit (authorised editor)',      'authenticated','00000000-0000-0000-0000-0000000000c1','3/2/1/1');
call t.chk('postgres (refresh jobs / definer owner)','postgres','',                                         '3/2/1/1');
call t.chk('service_role',                           'service_role','',                                     '3/2/1/1');
do $$ declare g text := t.counts('anon','');
begin insert into t.result(test,outcome,detail) values ('anon role has no SELECT (grants unchanged)', case when g like 'ERR:42501' then 'PASS' else 'FAIL' end, g); end $$;
-- a SECURITY DEFINER function owned by the view owner (the Save/Close writers read the register this way) still sees all rows for any caller
create function public.t_definer_probe() returns bigint language sql security definer set search_path = public, pg_temp as $$ select count(*) from public.v_costing_staff_classification_register $$;
grant execute on function public.t_definer_probe() to authenticated;
do $$ declare n bigint; begin
  set local role authenticated; perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
  select public.t_definer_probe() into n; reset role;
  insert into t.result(test,outcome,detail) values ('definer-owned function (writer pattern) still reads the register as owner for a no-grant caller', case when n = 3 then 'PASS' else 'FAIL' end, 'rows='||n); end $$;
-- helper function ACL: authenticated + service_role only
do $$ begin insert into t.result(test,outcome,detail) values ('personnel gate helper: authenticated/service_role EXECUTE, anon/public none',
  case when has_function_privilege('authenticated','public.fn_costing_personnel_view_allowed()','execute') and has_function_privilege('service_role','public.fn_costing_personnel_view_allowed()','execute')
        and not has_function_privilege('anon','public.fn_costing_personnel_view_allowed()','execute') then 'PASS' else 'FAIL' end, ''); end $$;
-- static view facts
do $$ begin insert into t.result(test,outcome,detail) values ('register/review views gated by the personnel function; pool view keeps the broad gate and masks staff_details',
  case when pg_get_viewdef('public.v_costing_staff_classification_register'::regclass) like '%fn_costing_personnel_view_allowed()%'
        and pg_get_viewdef('public.v_costing_unclassified_staff_for_costing'::regclass) like '%fn_costing_personnel_view_allowed()%'
        and pg_get_viewdef('public.v_costing_staff_cost_pool_summary'::regclass) like '%WHERE ( SELECT fn_costing_view_allowed()%'
        and pg_get_viewdef('public.v_costing_staff_cost_pool_summary'::regclass) like '%fn_costing_personnel_view_allowed()%THEN p.staff_details%' then 'PASS' else 'FAIL' end, ''); end $$;
select test, outcome, detail from t.result order by n;
select 'FAILURES=' || count(*) filter (where outcome <> 'PASS') || ' OF ' || count(*) as summary from t.result;
