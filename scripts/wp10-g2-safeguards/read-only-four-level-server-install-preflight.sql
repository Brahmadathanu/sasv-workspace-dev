-- WP10: READ-ONLY server-first installation preflight. May be rerun before approval.
-- No DDL, no user data writes, no session changes.
with required_functions(sig) as (
  values ('public.rpc_wp10_create_category(text)'),('public.rpc_wp10_rename_category(integer,text)'),('public.rpc_wp10_delete_category(integer)'),
         ('public.rpc_wp10_create_subcategory(integer,text)'),('public.rpc_wp10_rename_subcategory(integer,text)'),('public.rpc_wp10_delete_subcategory(integer)'),
         ('public.rpc_wp10_create_product_group(integer,text,integer)'),('public.rpc_wp10_rename_product_group(integer,text)'),('public.rpc_wp10_delete_product_group(integer)'),
         ('public.rpc_wp10_create_subgroup(integer,text)'),('public.rpc_wp10_rename_subgroup(integer,text)'),('public.rpc_wp10_delete_subgroup(integer)')
)
select 'wp10_function_absent_preflight' as check_name,
       count(*) filter(where to_regprocedure(sig) is null) as absent_expected,
       count(*) filter(where to_regprocedure(sig) is not null) as unexpected_present,
       count(*) as total_expected from required_functions;

select 'permission_guard' as check_name, to_regprocedure('public.require_permission(text,boolean)') is not null as present;
select 'role_gate_signature' as check_name,
       to_regprocedure('public.app_has_permission(text,text)') is not null as present;

with master(table_name) as (values ('categories'),('sub_categories'),('product_groups'),('sub_groups'))
select 'four-level_roles' as check_name,table_name,
       has_table_privilege('authenticated',format('public.%I',table_name),'SELECT') as auth_select,
       has_table_privilege('authenticated',format('public.%I',table_name),'INSERT') as auth_insert,
       has_table_privilege('authenticated',format('public.%I',table_name),'UPDATE') as auth_update,
       has_table_privilege('authenticated',format('public.%I',table_name),'DELETE') as auth_delete
from master order by table_name;

select 'kind_lookup_select' as check_name,
       has_table_privilege('authenticated','public.product_group_kinds','SELECT') as auth_select;
select 'subgroup_dependency_columns' as check_name,
  exists(select 1 from information_schema.columns where table_schema='costing' and table_name='scheme_policy_rules' and column_name='sub_group_id') as scheme_rule_id,
  exists(select 1 from information_schema.columns where table_schema='costing' and table_name='production_route_family_product_subgroup_map' and column_name='product_subgroup_id') as route_subgroup_id,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='sub_group_id') as product_subgroup_id;
