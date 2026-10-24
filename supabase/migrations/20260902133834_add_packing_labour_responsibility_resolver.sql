-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.sku_packing_labour_workload_snapshot
  add column if not exists packing_responsibility_rule_id bigint null references costing.packing_labour_responsibility_rule(id),
  add column if not exists packing_responsibility_code text null,
  add column if not exists packing_responsibility_resolution_source text null;

alter table costing.sku_packing_labour_workload_snapshot
  drop constraint if exists sku_packing_labour_workload_snapshot_packing_responsibility_code_check;

alter table costing.sku_packing_labour_workload_snapshot
  add constraint sku_packing_labour_workload_snapshot_packing_responsibility_code_check
  check (packing_responsibility_code is null or packing_responsibility_code in ('SASV_INTERNAL_PACKING','EXTERNAL_FULLY_PACKED'));

create or replace function costing.fn_resolve_packing_labour_responsibility(
  p_route_family_id bigint,
  p_valuation_date date
)
returns table(
  rule_id bigint,
  route_family_id bigint,
  responsibility_code text,
  resolution_source text,
  rationale text
)
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_count bigint;
begin
  if p_route_family_id is null or p_valuation_date is null then
    raise exception 'route_family_id and valuation_date are required';
  end if;

  select count(*) into v_count
  from costing.packing_labour_responsibility_rule r
  where r.route_family_id=p_route_family_id
    and r.status='APPROVED'
    and p_valuation_date between r.effective_from and coalesce(r.effective_to,'infinity'::date);

  if v_count>1 then
    raise exception 'Multiple approved Packing Labour responsibility rules resolve for route family % as of %',p_route_family_id,p_valuation_date;
  end if;

  if v_count=1 then
    return query
    select r.id,r.route_family_id,r.responsibility_code,
           'APPROVED_ROUTE_FAMILY_RULE'::text,r.rationale
    from costing.packing_labour_responsibility_rule r
    where r.route_family_id=p_route_family_id
      and r.status='APPROVED'
      and p_valuation_date between r.effective_from and coalesce(r.effective_to,'infinity'::date)
    order by r.effective_from desc,r.id desc
    limit 1;
  else
    return query
    select null::bigint,p_route_family_id,'SASV_INTERNAL_PACKING'::text,
           'DEFAULT_INTERNAL_PACKING'::text,
           'No approved external fully-packed exception applies as of the valuation date; SASV internal packing remains the governed default.'::text;
  end if;
end;
$function$;

comment on function costing.fn_resolve_packing_labour_responsibility(bigint,date) is
'Resolves final SKU Packing Labour responsibility by approved route-family rule as of valuation date. Absence of an exception preserves SASV internal packing as the canonical default.';