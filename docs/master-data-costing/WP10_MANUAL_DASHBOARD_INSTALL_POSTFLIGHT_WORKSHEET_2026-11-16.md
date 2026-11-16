# WP10 — Manual Dashboard execution/postflight operator worksheet (review only)

**Do not run installation files until the independent reviewer clears B1–B4 and the owner explicitly authorizes the two exact SQL files on project `qhmoqtxpeasamtlxaoak`.** This worksheet is not itself an authorization.

Use the pinned exact file checksums in `WP10_SERVER_FIRST_PRODUCTION_READINESS_RECEIPT_2026-11-16.md`. Run `scripts/wp10-g2-safeguards/read-only-four-level-server-install-preflight.sql` first. Continue only if its single result displays **PASS / 10 passed / 0 failed** and **12 absent**. Take a screenshot/record of that result.

If authorized: execute the parent nine-RPC file as one complete SQL Editor query, confirm success, then execute the subgroup three-RPC file as one complete query. Record timestamps, project, exact repository commit, both SHA-256 checksums, SQL Editor execution results and any errors. **Do not execute any REVOKE or CL15/route guard file in this phase.**

## Read-only installation postflight (run only after explicit installation authorization)

This query performs no writes and produces one summary row.

```sql
with expected(signature) as (
 values
 ('public.rpc_wp10_create_category(text)'),('public.rpc_wp10_rename_category(integer,text)'),('public.rpc_wp10_delete_category(integer)'),
 ('public.rpc_wp10_create_subcategory(integer,text)'),('public.rpc_wp10_rename_subcategory(integer,text)'),('public.rpc_wp10_delete_subcategory(integer)'),
 ('public.rpc_wp10_create_product_group(integer,text,integer)'),('public.rpc_wp10_rename_product_group(integer,text)'),('public.rpc_wp10_delete_product_group(integer)'),
 ('public.rpc_wp10_create_subgroup(integer,text)'),('public.rpc_wp10_rename_subgroup(integer,text)'),('public.rpc_wp10_delete_subgroup(integer)')
), catalog as (
 select e.signature,p.prosecdef,p.proconfig,p.proacl,
  case when p.oid is null then false else has_function_privilege('authenticated',p.oid,'EXECUTE') end as auth_exec,
  case when p.oid is null then true else has_function_privilege('anon',p.oid,'EXECUTE') end as anon_exec,
  case when p.oid is null then true else exists(
    select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE'
  ) end as public_exec
 from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
), fn_check as (
 select signature,
  (prosecdef is true and proconfig @> array['search_path=pg_catalog, public, pg_temp']
   and auth_exec is true and anon_exec is false and public_exec is false) as ok
 from catalog
), table_check as (
 select t.name,
  has_table_privilege('authenticated',format('public.%I',t.name),'SELECT')
  and has_table_privilege('authenticated',format('public.%I',t.name),'INSERT')
  and has_table_privilege('authenticated',format('public.%I',t.name),'UPDATE')
  and has_table_privilege('authenticated',format('public.%I',t.name),'DELETE') as ok
 from (values ('categories'),('sub_categories'),('product_groups'),('sub_groups')) t(name)
)
select case when (select bool_and(ok) from fn_check) and (select bool_and(ok) from table_check)
 then 'PASS' else 'BLOCKED' end as postflight,
 (select count(*) filter(where ok) from fn_check) as rpc_catalog_passed,
 (select count(*) from fn_check) as rpc_catalog_expected,
 (select count(*) filter(where ok) from table_check) as table_grants_unchanged,
 (select count(*) from table_check) as tables_expected,
 (select coalesce(jsonb_agg(signature), '[]'::jsonb) from fn_check where not ok) as failing_rpc_signatures,
 (select coalesce(jsonb_agg(name), '[]'::jsonb) from table_check where not ok) as failing_tables;
```

Expected after a successful bounded install: **PASS; 12/12 RPC catalog checks; 4/4 existing table-grant checks**, no failures. Compare table row counts to separately captured pre-install counts; this query does not claim an unchanged data fingerprint. Do not conduct experimental CRUD against business master rows.

## Partial success recovery
If the first file succeeds and second fails, the parent nine functions remain. Stop and preserve the error, do not rerun parent (its collision preflight must fail), and do not perform blanket cleanup. Independently review whether to retry only the subgroup file or separately authorize the parent rollback. Rollback before client release is simpler but never automatic.

If installed RPCs are later used by a released compatible client, dropping them can break that client. Keep the independent owner gate for rollback.
