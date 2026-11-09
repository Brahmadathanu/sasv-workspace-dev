-- Identity matrix, run AFTER the migration. Records PASS/FAIL rows; psql variable :guarded must be 'on'.
\set ON_ERROR_STOP on
set client_min_messages = warning;
create schema if not exists t; drop table if exists t.result; create table t.result(n serial, test text, outcome text, detail text);
create or replace function t.state() returns text language sql as
  $$ select coalesce(md5(string_agg(c::text, '|' order by staff_id)), 'empty') from costing.staff_costing_classification c $$;
-- attempt(path, uid, class) -> 'OK' | 'ERR:<sqlstate>:<message>' ; role is switched inside a sub-transaction
create or replace function t.attempt(p_path text, p_uid text, p_class text, p_role text default 'authenticated') returns text
language plpgsql as $$
begin
  begin
    execute format('set local role %I', p_role);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
    if p_path = 'public' then
      perform public.rpc_set_staff_costing_classification(900, p_class, 'POOL', date '2026-11-01', 1, 'synthetic test');
    else
      perform costing.rpc_set_staff_costing_classification(900, p_class, 'POOL', date '2026-11-01', 1, 'synthetic test');
    end if;
    reset role;
    return 'OK';
  exception when others then
    reset role;
    return 'ERR:' || sqlstate || ':' || sqlerrm;
  end;
end $$;
create or replace procedure t.expect_denied(p_name text, p_path text, p_uid text, p_class text default 'OPERATIONS', p_role text default 'authenticated')
language plpgsql as $$
declare s0 text := t.state(); r text; s1 text;
begin
  r := t.attempt(p_path, p_uid, p_class, p_role); s1 := t.state();
  insert into t.result(test, outcome, detail) values (p_name,
    case when r like 'ERR:%' and r !~ 'costing class required|staff id required' and s0 = s1 then 'PASS' else 'FAIL' end, r || ' | table unchanged=' || (s0 = s1));
end $$;

-- 1. denial matrix through the PUBLIC wrapper (authenticated) -- no write may occur
call t.expect_denied('wrapper ID-N (no grants)',            'public', '00000000-0000-0000-0000-0000000000a1');
call t.expect_denied('wrapper ID-O (CSR view only)',        'public', '00000000-0000-0000-0000-0000000000e1');
call t.expect_denied('wrapper ID-V (CBM view-only)',        'public', '00000000-0000-0000-0000-0000000000b1');
call t.expect_denied('wrapper ID-X (CBM edit, no view)',    'public', '00000000-0000-0000-0000-0000000000d1');
call t.expect_denied('wrapper edit on other module only',   'public', '00000000-0000-0000-0000-0000000000f1');
call t.expect_denied('wrapper unauthenticated (no sub)',    'public', null);
-- 2. guard runs BEFORE validation: invalid input from a denied identity yields the permission error, not the validation error
call t.expect_denied('wrapper denied identity + invalid class -> permission error first', 'public', '00000000-0000-0000-0000-0000000000a1', '');
-- 3. no direct bypass of the internal function: privileged connection (owner/superuser) with NO matching identity is still denied
call t.expect_denied('internal direct, privileged role, ID-N',           'internal', '00000000-0000-0000-0000-0000000000a1', 'OPERATIONS', 'postgres');
call t.expect_denied('internal direct, privileged role, ID-V',           'internal', '00000000-0000-0000-0000-0000000000b1', 'OPERATIONS', 'postgres');
call t.expect_denied('internal direct, privileged role, unauthenticated','internal', null, 'OPERATIONS', 'postgres');
-- 4. internal function stays non-executable by authenticated (privilege error, still no write)
do $$ declare s0 text := t.state(); r text := t.attempt('internal','00000000-0000-0000-0000-0000000000c1','OPERATIONS','authenticated');
begin insert into t.result(test,outcome,detail) values ('internal direct as authenticated (ACL unchanged)',
  case when r like 'ERR:%' and r !~ 'costing class required' and s0 = t.state() then 'PASS' else 'FAIL' end, r); end $$;

-- 5. positive: CBM view+edit through wrapper and via privileged internal call
do $$ declare r text; begin
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1','OPERATIONS');
  insert into t.result(test,outcome,detail) values ('wrapper CBM view+edit -> allowed and row written',
    case when r = 'OK' and exists(select 1 from costing.staff_costing_classification where staff_id=900 and costing_class='OPERATIONS') then 'PASS' else 'FAIL' end, r);
  r := t.attempt('internal','00000000-0000-0000-0000-0000000000c1','PACKING','postgres');
  insert into t.result(test,outcome,detail) values ('internal CBM view+edit (privileged caller) -> allowed (update path)',
    case when r = 'OK' and exists(select 1 from costing.staff_costing_classification where staff_id=900 and costing_class='PACKING' and updated_n=1) then 'PASS' else 'FAIL' end, r);
  r := t.attempt('public','00000000-0000-0000-0000-0000000000c1','');
  insert into t.result(test,outcome,detail) values ('wrapper CBM view+edit + invalid class -> validation error (guard passed)',
    case when r like 'ERR:P0001:costing class required' then 'PASS' else 'FAIL' end, r);
end $$;

-- 6. metadata and wrapper preserved
do $$ declare w oid := 'public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure;
 i oid := 'costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure; p pg_proc; q pg_proc;
begin
  select * into p from pg_proc where oid = i; select * into q from pg_proc where oid = w;
  insert into t.result(test,outcome,detail) values
   ('internal: SECURITY DEFINER, VOLATILE, search_path config, returns jsonb preserved',
    case when p.prosecdef and p.provolatile='v' and p.proconfig = array['search_path=costing, public, pg_temp'] and p.prorettype='jsonb'::regtype then 'PASS' else 'FAIL' end, coalesce(p.proconfig::text,'null')),
   ('internal: ACL unchanged (authenticated/anon no EXECUTE)',
    case when not has_function_privilege('authenticated', i, 'EXECUTE') and not has_function_privilege('anon', i, 'EXECUTE') then 'PASS' else 'FAIL' end, coalesce(p.proacl::text,'null')),
   ('wrapper: unchanged signature, SQL language, SECURITY DEFINER, authenticated EXECUTE, anon none',
    case when q.prosecdef and q.prolang = (select oid from pg_language where lanname='sql') and has_function_privilege('authenticated', w, 'EXECUTE')
              and not has_function_privilege('anon', w, 'EXECUTE') and q.pronargs = 6 then 'PASS' else 'FAIL' end, coalesce(q.proacl::text,'null')),
   ('internal body: guard is the first statement after BEGIN',
    case when p.prosrc ~* '\mbegin\M\s+perform public\.require_permission\(''module:cost-build-manager'', true\);' and position('require_permission' in lower(p.prosrc)) < position('update ' in lower(p.prosrc)) then 'PASS' else 'FAIL' end, '');
end $$;
select test, outcome, detail from t.result order by n;
select 'FAILURES=' || count(*) filter (where outcome <> 'PASS') || ' OF ' || count(*) as summary from t.result;
