-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_count integer;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_production_overhead_workload_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then
    raise exception 'Target POH refresh function not found';
  end if;

  v_def := pg_get_functiondef(v_oid);
  v_new := v_def;

  v_count := (length(v_new)-length(replace(v_new,$p$when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'$p$,''))) / length($p$when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'$p$);
  if v_count <> 1 then raise exception 'Unexpected POH zero-factor classification pattern count: %',v_count; end if;

  v_new := replace(v_new,
    $p$when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'$p$,
    $p$when (sf.route_factor is null or sf.route_factor<=0)
           and f.foundation_status not like 'BLOCKED%'
           and coalesce(sf.effective_step_count,0)>0
           and coalesce(sf.included_step_count,0)=0
           and coalesce(sf.passive_step_count,0)=0
           and coalesce(sf.excluded_step_count,0)=coalesce(sf.effective_step_count,0)
        then 'READY_ZERO_PRODUCTION_OVERHEAD'
      when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'$p$);

  v_count := (length(v_new)-length(replace(v_new,$p$workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')$p$,''))) / length($p$workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')$p$);
  if v_count <> 7 then raise exception 'Unexpected POH eligibility pattern count: %',v_count; end if;

  v_new := replace(v_new,
    $p$workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')$p$,
    $p$workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')$p$);

  v_count := (length(v_new)-length(replace(v_new,$p$when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'$p$,''))) / length($p$when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'$p$);
  if v_count <> 1 then raise exception 'Unexpected POH product-note pattern count: %',v_count; end if;

  v_new := replace(v_new,
    $p$when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'$p$,
    $p$when t.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route contains effective steps, all explicitly excluded from Production Overhead. Production Overhead is validly zero and non-blocking.'
              when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'$p$);

  v_count := (length(v_new)-length(replace(v_new,$p$when pw.workload_status='READY' then 'READY' else 'BLOCKED' end$p$,''))) / length($p$when pw.workload_status='READY' then 'READY' else 'BLOCKED' end$p$);
  if v_count <> 1 then raise exception 'Unexpected POH allocation-status pattern count: %',v_count; end if;

  v_new := replace(v_new,
    $p$when pw.workload_status='READY' then 'READY' else 'BLOCKED' end$p$,
    $p$when pw.workload_status in ('READY','READY_ZERO_PRODUCTION_OVERHEAD') then 'READY' else 'BLOCKED' end$p$);

  v_count := (length(v_new)-length(replace(v_new,$p$case when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'$p$,''))) / length($p$case when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'$p$);
  if v_count <> 1 then raise exception 'Unexpected POH allocation-note pattern count: %',v_count; end if;

  v_new := replace(v_new,
    $p$case when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'$p$,
    $p$case when pw.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route is explicitly outside the Production Overhead pool; this SKU receives valid zero Production Overhead while the full pool remains allocated across positive-workload eligible Products.'
              when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'$p$);

  execute v_new;
end
$do$;