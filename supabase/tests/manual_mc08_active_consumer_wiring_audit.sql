-- MC08 read-only ACTUAL refresh-consumer wiring audit (production-safe SELECT).
-- This checks whether approval would still leave legacy monetary consumers active.
with funcs as (
 select p.proname,pg_get_functiondef(p.oid) ddl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname in (
 'rpc_refresh_manufacturing_cop_chain',
 'rpc_refresh_sku_direct_labour_allocation_snapshot',
 'rpc_refresh_sku_overhead_allocation_snapshot')
), summary as (
 select proname,count(*) as overloads,
 bool_or(position('fn_preview_manufacturing_rate_readiness' in ddl)>0) as mentions_rate_readiness,
 bool_or(position('fn_preview_mc06_split_overhead' in ddl)>0) as mentions_shadow,
 bool_or(position('rpc_refresh_sku_direct_labour_allocation_snapshot' in ddl)>0) as calls_direct_labour,
 bool_or(position('rpc_refresh_sku_overhead_allocation_snapshot' in ddl)>0) as calls_overhead
 from funcs group by proname
)
select *,case
 when proname='rpc_refresh_manufacturing_cop_chain' and calls_direct_labour and calls_overhead
 then 'LEGACY_CHAIN_CONFIRMED'
 when proname in ('rpc_refresh_sku_direct_labour_allocation_snapshot','rpc_refresh_sku_overhead_allocation_snapshot')
 and not mentions_rate_readiness and not mentions_shadow
 then 'RATE_CONSUMPTION_NOT_WIRED'
 else 'REVIEW_FUNCTION_BODY_AND_RECONCILE'
 end as verdict
from summary order by proname;
-- Before any MC08 cutover, replace the provisional monetary consumers by a
-- separately reviewed consumer implementation, with approved-budget matching,
-- unit conversion gates, run scope, source conservation, and exceptions.
-- DO NOT equate a status flip or migration presence with deployed engine parity.
