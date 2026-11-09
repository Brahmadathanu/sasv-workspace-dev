-- Role/behaviour matrix against the EXACT live function definitions (snapshot) + synthetic dependencies. Synthetic rows only.
\set ON_ERROR_STOP on
set client_min_messages = warning;
drop schema if exists t cascade; create schema t; create table t.result(n serial, test text, outcome text, detail text);
create function t.state() returns text language sql as $$ select coalesce(md5(string_agg(c::text, '|' order by id)), 'empty') from costing.staff_costing_classification c $$;
create function t.attempt(p_path text, p_uid text, p_class text, p_staff bigint default 1, p_from date default null, p_role text default 'authenticated') returns text
language plpgsql as $$
begin
  begin
    execute format('set local role %I', p_role);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
    if p_path = 'public' then
      perform * from public.rpc_set_staff_costing_classification(p_staff, p_class, null, p_from, 1, 'synthetic remarks');
    else
      perform * from costing.rpc_set_staff_costing_classification(p_staff, p_class, null, p_from, 1, 'synthetic remarks');
    end if;
    reset role; return 'OK';
  exception when others then reset role; return 'ERR:' || sqlstate || ':' || sqlerrm;
  end;
end $$;
-- denied = an error that is NOT one of the function's own validation/no-such-staff errors, and no table change
create procedure t.expect_denied(p_name text, p_path text, p_uid text, p_class text default 'MANUFACTURING', p_staff bigint default 1, p_role text default 'authenticated')
language plpgsql as $$
declare s0 text := t.state(); r text := t.attempt(p_path, p_uid, p_class, p_staff, null, p_role); s1 text := t.state();
begin
  insert into t.result(test, outcome, detail) values (p_name,
    case when r like 'ERR:%' and r !~ 'is required|does not exist in hr.staff|Invalid costing class|Allocation' and s0 = s1 then 'PASS' else 'FAIL' end,
    r || ' | table unchanged=' || (s0 = s1));
end $$;

-- 1. denial matrix via the PUBLIC wrapper (authenticated); invalid inputs must still yield the PERMISSION error first
call t.expect_denied('wrapper ID-N (no grants)',                 'public', '00000000-0000-0000-0000-0000000000a1');
call t.expect_denied('wrapper ID-O (other module only)',         'public', '00000000-0000-0000-0000-0000000000e1');
call t.expect_denied('wrapper ID-V (CBM view-only)',             'public', '00000000-0000-0000-0000-0000000000b1');
call t.expect_denied('wrapper ID-X (CBM edit, no view)',         'public', '00000000-0000-0000-0000-0000000000d1');
call t.expect_denied('wrapper edit on another module only',      'public', '00000000-0000-0000-0000-0000000000f1');
call t.expect_denied('wrapper unauthenticated',                  'public', null);
call t.expect_denied('wrapper denied identity + empty class (permission error before validation)', 'public', '00000000-0000-0000-0000-0000000000a1', '');
call t.expect_denied('wrapper denied identity + nonexistent staff (permission error before lookup)', 'public', '00000000-0000-0000-0000-0000000000b1', 'MANUFACTURING', 999);
call t.expect_denied('wrapper denied identity + null staff id (permission error before validation)', 'public', '00000000-0000-0000-0000-0000000000d1', 'MANUFACTURING', null);
-- 2. no direct bypass of the internal function: privileged connection with no matching identity is still denied
call t.expect_denied('internal direct, privileged role, ID-N',            'internal', '00000000-0000-0000-0000-0000000000a1', 'MANUFACTURING', 1, 'postgres');
call t.expect_denied('internal direct, privileged role, ID-V',            'internal', '00000000-0000-0000-0000-0000000000b1', 'MANUFACTURING', 1, 'postgres');
call t.expect_denied('internal direct, privileged role, unauthenticated', 'internal', null, 'MANUFACTURING', 1, 'postgres');
call t.expect_denied('internal direct, service_role-style claim-less call', 'internal', '', 'MANUFACTURING', 1, 'postgres');
do $$ declare s0 text := t.state(); r text := t.attempt('internal','00000000-0000-0000-0000-0000000000c1','MANUFACTURING',1,null,'authenticated');
begin insert into t.result(test,outcome,detail) values ('internal direct as authenticated (no EXECUTE; ACL unchanged)',
  case when r like 'ERR:42501:%' and s0 = t.state() then 'PASS' else 'FAIL' end, r); end $$;
-- 3. authorised CBM view+edit through the real function bodies
do $$ declare r text; n0 int; begin
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1','manufacturing',1,date '2026-11-01');
  insert into t.result(test,outcome,detail) values ('CBM view+edit via wrapper: insert path (lower-case class normalised, default pool)',
    case when r = 'OK' and (select count(*) from costing.staff_costing_classification where staff_id=1 and costing_class='MANUFACTURING' and allocation_pool='DIRECT_LABOUR' and effective_to is null and is_active)=1 then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1','MANUFACTURING',1,date '2026-11-01');
  insert into t.result(test,outcome,detail) values ('CBM view+edit via wrapper: same effective_from updates in place (still one row)',
    case when r = 'OK' and (select count(*) from costing.staff_costing_classification where staff_id=1)=1 then 'PASS' else 'FAIL' end, r);
  r := t.attempt('internal','00000000-0000-0000-0000-0000000000c1','PACKING',1,date '2026-12-01','postgres');
  insert into t.result(test,outcome,detail) values ('CBM view+edit via internal (privileged caller): new effective_from closes previous row',
    case when r = 'OK' and (select count(*) from costing.staff_costing_classification where staff_id=1)=2
              and exists (select 1 from costing.staff_costing_classification where staff_id=1 and effective_to = date '2026-11-30')
              and exists (select 1 from costing.staff_costing_classification where staff_id=1 and costing_class='PACKING' and effective_to is null) then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1','NOSUCH',1,null);
  insert into t.result(test,outcome,detail) values ('CBM view+edit passes the guard and reaches the live validation (Invalid costing class)',
    case when r like 'ERR:%Invalid costing class%' then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1','MANUFACTURING',999,null);
  insert into t.result(test,outcome,detail) values ('CBM view+edit reaches the live staff lookup (does not exist in hr.staff)',
    case when r like 'ERR:%does not exist in hr.staff%' then 'PASS' else 'FAIL' end, r);
  -- returned columns through the wrapper (RETURNS TABLE contract preserved end to end)
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
  insert into t.result(test,outcome,detail)
    select 'wrapper returns the 12-column table row after the guard', case when count(*)=1 and max(classification_status)='CLASSIFIED' then 'PASS' else 'FAIL' end, ''
    from public.rpc_set_staff_costing_classification(2,'ADMIN',null,date '2026-11-01',1,'synthetic');
end $$;
-- 4. guard is the first executable statement of the installed internal function
do $$ declare p pg_proc := (select p from pg_proc p where p.oid='costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure);
begin insert into t.result(test,outcome,detail) values ('installed internal body: guard immediately follows the first BEGIN, before validation and writes',
  case when p.prosrc ~* '\mbegin\M\s+perform public\.require_permission\(''module:cost-build-manager'', true\);\s+if v_staff_id is null then'
        and position('require_permission' in p.prosrc) < position('Staff id is required' in p.prosrc)
        and position('require_permission' in p.prosrc) < position('insert into costing.staff_costing_classification' in p.prosrc) then 'PASS' else 'FAIL' end, ''); end $$;
select test, outcome, detail from t.result order by n;
select 'FAILURES=' || count(*) filter (where outcome <> 'PASS') || ' OF ' || count(*) as summary from t.result;
