-- WP10 classification SELECT hardening - 05 LIVE DEPENDENCY CATALOG (READ-ONLY). PROPOSED / UNAPPLIED.
-- Lists the database objects that depend on the four classification tables so the reader matrix can be confirmed against the LIVE catalog:
--   * views / materialized views with a pg_depend link to the tables, with security_invoker (true = the caller's own RLS applies),
--   * functions whose source text mentions a table (a text heuristic, NOT dependency tracking) with SECURITY DEFINER / INVOKER.
-- SECURITY DEFINER objects run as their owner and (RLS not forced) are unaffected by the read policy; INVOKER objects are the ones a read-policy change can alter.
-- Output rows: kind | object | mode. No data values are returned. Runs in a read-only transaction.
begin read only;
with t as (
  select c.oid from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relname in ('categories', 'sub_categories', 'product_groups', 'sub_groups')
),
views as (
  select distinct n.nspname, v.relname, v.relkind,
         coalesce((select o.option_value from pg_options_to_table(v.reloptions) o where o.option_name = 'security_invoker'), 'false') as security_invoker
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
  join pg_class v on v.oid = r.ev_class and v.relkind in ('v', 'm')
  join pg_namespace n on n.oid = v.relnamespace
  where d.refobjid in (select oid from t) and v.oid not in (select oid from t)
),
fns as (
  select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog', 'information_schema') and p.prokind = 'f'
    and p.prosrc ~* '\m(categories|sub_categories|product_groups|sub_groups)\M'
)
select 'view' as kind, nspname || '.' || relname as object, 'security_invoker=' || security_invoker as mode from views
union all
select 'function', nspname || '.' || proname || '(' || args || ')', case when prosecdef then 'SECURITY DEFINER' else 'INVOKER' end from fns
order by 1, 2;
rollback;
