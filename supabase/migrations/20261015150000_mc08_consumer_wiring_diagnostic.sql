-- MC08 release guard: SHADOW/FINANCIAL APPROVAL DO NOT ACTIVATE CONSUMERS.
-- Diagnostic only, no refresh-chain mutation.
create or replace function costing.fn_preview_mc08_consumer_wiring(p_run_id bigint)
returns table(component text, active_rate_reference boolean, status text)
language sql stable set search_path=costing,pg_temp as $x$
with f as (
select p.proname,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='costing' and p.proname in
('rpc_refresh_sku_direct_labour_allocation_snapshot','rpc_refresh_sku_overhead_allocation_snapshot')
and pg_get_function_identity_arguments(p.oid) like '%bigint%'
)
select proname,position('fn_resolve_manufacturing_standard_rate' in definition)>0,
case when position('fn_resolve_manufacturing_standard_rate' in definition)>0
then 'REVIEW_REQUIRED_MONETARY_PARITY' else 'BLOCKED_LEGACY_RATE_CONSUMER' end
from f;
$x$;
comment on function costing.fn_preview_mc08_consumer_wiring(bigint) is
'Read-only fail-closed introspection. Presence of a function reference is never proof of rate integration or refresh readiness.';
