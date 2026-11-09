-- WP05-W506-SEC-FIX-02 role/behaviour matrix for the CLOSE writer against the EXACT live function definitions (snapshot)
-- + synthetic dependencies. Synthetic rows only. Disposable cluster only (run via run_live_equivalent.sh).
\set ON_ERROR_STOP on
set client_min_messages = warning;
drop schema if exists t cascade; create schema t; create table t.result(n serial, test text, outcome text, detail text);
create function t.state() returns text language sql as $$ select coalesce(md5(string_agg(c::text, '|' order by id)), 'empty') from costing.staff_costing_classification c $$;
create function t.attempt(p_path text, p_uid text, p_id bigint, p_to date default null, p_remarks text default 'synthetic close', p_role text default 'authenticated') returns text
language plpgsql as $$
begin
  begin
    execute format('set local role %I', p_role);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
    if p_path = 'public' then
      perform * from public.rpc_close_staff_costing_classification(p_id, p_to, p_remarks);
    else
      perform * from costing.rpc_close_staff_costing_classification(p_id, p_to, p_remarks);
    end if;
    reset role; return 'OK';
  exception when others then reset role; return 'ERR:' || sqlstate || ':' || sqlerrm;
  end;
end $$;
-- denied = an error that is NOT one of the function's own validation errors, and no table change
create procedure t.expect_denied(p_name text, p_path text, p_uid text, p_id bigint default 1, p_to date default date '2026-12-31', p_role text default 'authenticated')
language plpgsql as $$
declare s0 text := t.state(); r text := t.attempt(p_path, p_uid, p_id, p_to, 'synthetic close', p_role); s1 text := t.state();
begin
  insert into t.result(test, outcome, detail) values (p_name,
    case when r like 'ERR:%' and r !~ 'is required|not found|cannot be before' and s0 = s1 then 'PASS' else 'FAIL' end,
    r || ' | table unchanged=' || (s0 = s1));
end $$;

-- 1. denial matrix via the PUBLIC wrapper (authenticated); invalid inputs must still yield the PERMISSION error first
call t.expect_denied('wrapper ID-N (no grants)',                 'public', '00000000-0000-0000-0000-0000000000a1');
call t.expect_denied('wrapper ID-O (other module only)',         'public', '00000000-0000-0000-0000-0000000000e1');
call t.expect_denied('wrapper ID-V (CBM view-only)',             'public', '00000000-0000-0000-0000-0000000000b1');
call t.expect_denied('wrapper ID-X (CBM edit, no view)',         'public', '00000000-0000-0000-0000-0000000000d1');
call t.expect_denied('wrapper edit on another module only',      'public', '00000000-0000-0000-0000-0000000000f1');
call t.expect_denied('wrapper unauthenticated',                  'public', null);
call t.expect_denied('wrapper service_role-style JWT-less call (claim-less)', 'public', '', 1, date '2026-12-31', 'service_role');
call t.expect_denied('wrapper denied identity + nonexistent id (permission error before lookup)', 'public', '00000000-0000-0000-0000-0000000000a1', 999);
call t.expect_denied('wrapper denied identity + null id (permission error before validation)',    'public', '00000000-0000-0000-0000-0000000000b1', null);
call t.expect_denied('wrapper denied identity + date before effective_from (permission error before validation)', 'public', '00000000-0000-0000-0000-0000000000d1', 1, date '2020-01-01');
-- 2. no direct bypass of the internal function: privileged connection with no matching identity is still denied
call t.expect_denied('internal direct, privileged role, ID-N',            'internal', '00000000-0000-0000-0000-0000000000a1', 1, date '2026-12-31', 'postgres');
call t.expect_denied('internal direct, privileged role, ID-V',            'internal', '00000000-0000-0000-0000-0000000000b1', 1, date '2026-12-31', 'postgres');
call t.expect_denied('internal direct, privileged role, unauthenticated', 'internal', null, 1, date '2026-12-31', 'postgres');
call t.expect_denied('internal direct, claim-less call',                  'internal', '', 1, date '2026-12-31', 'postgres');
do $$ declare s0 text := t.state(); r text := t.attempt('internal','00000000-0000-0000-0000-0000000000c1',1,date '2026-12-31','x','authenticated');
begin insert into t.result(test,outcome,detail) values ('internal direct as authenticated (no EXECUTE; ACL unchanged)',
  case when r like 'ERR:42501:%' and s0 = t.state() then 'PASS' else 'FAIL' end, r); end $$;
-- 3. authorised CBM view+edit through the real function bodies
do $$ declare r text; begin
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1',1,date '2026-12-31','closed by synthetic editor');
  insert into t.result(test,outcome,detail) values ('CBM view+edit via wrapper: closes row 1 (effective_to set, remarks updated, is_active kept true)',
    case when r = 'OK' and exists (select 1 from costing.staff_costing_classification where id=1 and effective_to = date '2026-12-31' and remarks='closed by synthetic editor' and is_active) then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1',1,date '2026-12-30',null);
  insert into t.result(test,outcome,detail) values ('CBM view+edit: null remarks keeps existing remarks; new effective_to applied',
    case when r = 'OK' and exists (select 1 from costing.staff_costing_classification where id=1 and effective_to = date '2026-12-30' and remarks='closed by synthetic editor') then 'PASS' else 'FAIL' end, r);
  r := t.attempt('internal','00000000-0000-0000-0000-0000000000c1',2,null,'default date','postgres');
  insert into t.result(test,outcome,detail) values ('CBM view+edit via internal (privileged caller): null effective_to defaults to current_date',
    case when r = 'OK' and exists (select 1 from costing.staff_costing_classification where id=2 and effective_to = current_date and remarks='default date') then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1',null,null);
  insert into t.result(test,outcome,detail) values ('CBM view+edit passes the guard and reaches live validation (Classification id is required)',
    case when r like 'ERR:%Classification id is required%' then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1',999,null);
  insert into t.result(test,outcome,detail) values ('CBM view+edit reaches the live lookup (Classification id 999 not found)',
    case when r like 'ERR:%not found%' then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1',1,date '2020-01-01');
  insert into t.result(test,outcome,detail) values ('CBM view+edit reaches the live date validation (cannot be before effective from)',
    case when r like 'ERR:%cannot be before%' then 'PASS' else 'FAIL' end, r);
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
  insert into t.result(test,outcome,detail)
    select 'wrapper returns the 12-column table row after the guard', case when count(*)=1 and max(effective_to)=date '2026-12-29' and max(classification_status)='CLASSIFIED' then 'PASS' else 'FAIL' end, ''
    from public.rpc_close_staff_costing_classification(1, date '2026-12-29', 'synthetic');
end $$;
-- 4. guard is the first executable statement of the installed internal function
do $$ declare p pg_proc := (select p from pg_proc p where p.oid='costing.rpc_close_staff_costing_classification(bigint,date,text)'::regprocedure);
begin insert into t.result(test,outcome,detail) values ('installed internal body: guard immediately follows the first BEGIN, before validation and the UPDATE',
  case when p.prosrc ~* '\mbegin\M\s+perform public\.require_permission\(''module:cost-build-manager'', true\);\s+if p_classification_id is null then'
        and position('require_permission' in p.prosrc) < position('Classification id is required' in p.prosrc)
        and position('require_permission' in p.prosrc) < position('update costing.staff_costing_classification' in p.prosrc) then 'PASS' else 'FAIL' end, ''); end $$;
select test, outcome, detail from t.result order by n;
select 'FAILURES=' || count(*) filter (where outcome <> 'PASS') || ' OF ' || count(*) as summary from t.result;
