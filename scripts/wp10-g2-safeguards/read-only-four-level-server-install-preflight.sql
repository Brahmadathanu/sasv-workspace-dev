-- WP10 B2/B3: single-result, read-only Supabase SQL Editor installation preflight.
-- PASS only when every check passes. No writes, grants, role switching, or DDL.
with required_functions(signature) as (
 values ('public.rpc_wp10_create_category(text)'),('public.rpc_wp10_rename_category(integer,text)'),('public.rpc_wp10_delete_category(integer)'),
 ('public.rpc_wp10_create_subcategory(integer,text)'),('public.rpc_wp10_rename_subcategory(integer,text)'),('public.rpc_wp10_delete_subcategory(integer)'),
 ('public.rpc_wp10_create_product_group(integer,text,integer)'),('public.rpc_wp10_rename_product_group(integer,text)'),('public.rpc_wp10_delete_product_group(integer)'),
 ('public.rpc_wp10_create_subgroup(integer,text)'),('public.rpc_wp10_rename_subgroup(integer,text)'),('public.rpc_wp10_delete_subgroup(integer)')
), expected_columns(tbl,col) as (
 values ('categories','id'),('categories','category_name'),
 ('sub_categories','id'),('sub_categories','category_id'),('sub_categories','subcategory_name'),
 ('product_groups','id'),('product_groups','sub_category_id'),('product_groups','group_name'),('product_groups','kind_id'),
 ('sub_groups','id'),('sub_groups','product_group_id'),('sub_groups','sub_group_name'),
 ('product_group_kinds','id')
), supplied_columns(tbl,col) as (
 values ('categories','category_name'),('sub_categories','category_id'),('sub_categories','subcategory_name'),
 ('product_groups','sub_category_id'),('product_groups','group_name'),('product_groups','kind_id'),
 ('sub_groups','product_group_id'),('sub_groups','sub_group_name')
), missing_columns as (
 select e.tbl||'.'||e.col as name from expected_columns e
 where not exists(select 1 from pg_attribute a
 join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname=e.tbl and a.attname=e.col and a.attnum>0 and not a.attisdropped)
), uncovered_notnull as (
 select c.relname||'.'||a.attname as name from pg_attribute a
 join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('categories','sub_categories','product_groups','sub_groups')
 and a.attnum>0 and not a.attisdropped and a.attnotnull
 and a.attidentity='' and a.attgenerated=''
 and not exists(select 1 from pg_attrdef d where d.adrelid=a.attrelid and d.adnum=a.attnum)
 and not exists(select 1 from supplied_columns s where s.tbl=c.relname and s.col=a.attname)
), inbound_fk as (
 select con.conname,con.conrelid::regclass::text as child,con.confrelid::regclass::text as parent,
 con.confdeltype as rule
 from pg_constraint con where con.contype='f'
 and con.confrelid in ('public.categories'::regclass,'public.sub_categories'::regclass,
                       'public.product_groups'::regclass,'public.sub_groups'::regclass)
), unsafe_fk as (
 select child||' -> '||parent||' ('||conname||', delete='||rule||')' as name
 from inbound_fk where not (rule in ('a','r') or
  (rule='c' and (child,parent) in (
   ('public.sub_categories','public.categories'),
   ('public.product_groups','public.sub_categories'),
   ('public.sub_groups','public.product_groups'))))
), expected_cascades(child,parent) as (
 values ('public.sub_categories','public.categories'),
 ('public.product_groups','public.sub_categories'),('public.sub_groups','public.product_groups')
), missing_cascades as (
 select child||' -> '||parent as name from expected_cascades e
 where not exists(select 1 from inbound_fk f where f.child=e.child and f.parent=e.parent and f.rule='c')
), required_targets(target) as (
 values ('module:manage-categories'),('module:manage-subcategories'),
 ('module:manage-product-groups'),('module:manage-subgroups')
), missing_targets as (
 select t.target as name from required_targets t
 where not exists(select 1 from public.user_permissions_canonical p
 where p.target=t.target and p.can_view=true and p.can_edit=true)
), masters(tbl) as (values ('categories'),('sub_categories'),('product_groups'),('sub_groups')),
 insufficient_grants as (
 select m.tbl as name from masters m where
 not (has_table_privilege('authenticated',format('public.%I',m.tbl),'SELECT')
 and has_table_privilege('authenticated',format('public.%I',m.tbl),'INSERT')
 and has_table_privilege('authenticated',format('public.%I',m.tbl),'UPDATE')
 and has_table_privilege('authenticated',format('public.%I',m.tbl),'DELETE'))
), required_dependencies(signature) as (
 values ('public.require_permission(text,boolean)'),('public.app_has_permission(text,text)')
), missing_dependencies as (
 select signature as name from required_dependencies where to_regprocedure(signature) is null
), checks(check_name,passed,details) as (
 select '12 RPCs absent',count(*)=12 and count(*) filter(where to_regprocedure(signature) is not null)=0,
        'Absent='||(count(*) filter(where to_regprocedure(signature) is null))::text||
        '; present='||(count(*) filter(where to_regprocedure(signature) is not null))::text from required_functions
 union all select 'permission functions exist',count(*)=0,coalesce(string_agg(name,', '),'none missing') from missing_dependencies
 union all select 'required master columns exist',count(*)=0,coalesce(string_agg(name,', '),'none missing') from missing_columns
 union all select 'insert NOT NULL/default coverage',count(*)=0,coalesce(string_agg(name,', '),'none uncovered') from uncovered_notnull
 union all select 'no unexpected destructive inbound FK',count(*)=0,coalesce(string_agg(name,', '),'none unsafe') from unsafe_fk
 union all select 'three guarded hierarchy cascade FKs exist',count(*)=0,coalesce(string_agg(name,', '),'none missing') from missing_cascades
 union all select 'four canonical targets have an Editor grant',count(*)=0,coalesce(string_agg(name,', '),'none missing') from missing_targets
 union all select 'old Electron four-master DML baseline',count(*)=0,coalesce(string_agg(name,', '),'none missing') from insufficient_grants
 union all select 'product group kinds SELECT',has_table_privilege('authenticated','public.product_group_kinds','SELECT'),'authenticated SELECT required'
 union all select 'scheme/route/product dependency columns',
   (select count(*)=3 from information_schema.columns
    where (table_schema,table_name,column_name) in (
     ('costing','scheme_policy_rules','sub_group_id'),
     ('costing','production_route_family_product_subgroup_map','product_subgroup_id'),
     ('public','products','sub_group_id'))),
   'Three specific subgroup dependent columns must exist'
)
select case when bool_and(passed) then 'PASS' else 'BLOCKED' end as wp10_preflight,
 count(*) filter(where passed) as passed_checks,
 count(*) filter(where not passed) as failed_checks,
 jsonb_pretty(jsonb_agg(jsonb_build_object('check',check_name,'pass',passed,'detail',details) order by check_name)) as check_details
from checks;
