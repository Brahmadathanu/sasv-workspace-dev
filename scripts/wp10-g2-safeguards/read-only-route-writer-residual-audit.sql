-- WP10 Route Mutation Residual Audit — READ ONLY. DO NOT replace production acceptance.
-- Exact source counts depend on query date; run from a SELECT-only principal.
select 'subgroup_mapping' as source,m.status,count(*) as mappings,count(distinct m.product_subgroup_id) as nodes
from costing.production_route_family_product_subgroup_map m
where m.archived_at is null group by m.status
union all
select 'group_mapping',m.status,count(*),count(distinct m.product_group_id)
from costing.production_route_family_product_group_map m
where m.archived_at is null group by m.status
order by 1,2;

select count(distinct m.id) as effective_approved_subgroup_mappings,
       count(distinct p.id) as associated_products,
       count(distinct s.id) as associated_active_skus
from costing.production_route_family_product_subgroup_map m
left join public.products p on p.sub_group_id=m.product_subgroup_id
left join public.product_skus s on s.product_id=p.id and s.is_active=true
where m.status='APPROVED' and m.archived_at is null
  and m.effective_from<=current_date
  and (m.effective_to is null or m.effective_to>=current_date);
-- This does NOT prove the associated products lack a fallback product-level route.

select n.nspname,c.relname,
       has_table_privilege('authenticated',c.oid,'INSERT') as auth_insert,
       has_table_privilege('authenticated',c.oid,'UPDATE') as auth_update,
       has_table_privilege('authenticated',c.oid,'DELETE') as auth_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='costing' and c.relname in
 ('production_route_family_product_group_map','production_route_family_product_subgroup_map',
  'production_route_family_route','production_route_family')
order by c.relname;

select p.proname,pg_get_function_identity_arguments(p.oid) arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('rpc_approve_product_subgroup_route_family_mapping',
  'rpc_inactivate_product_subgroup_route_family_mapping',
  'rpc_approve_route_family_mapping',
  'rpc_map_product_subgroup_to_route_family')
order by p.proname;
