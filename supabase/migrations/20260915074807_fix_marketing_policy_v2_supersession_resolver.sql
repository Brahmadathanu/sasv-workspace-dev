-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_resolve_marketing_allocation_policy(p_valuation_date date)
returns costing.marketing_allocation_policy
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare v_policy costing.marketing_allocation_policy%rowtype; v_count integer;
begin
  if p_valuation_date is null then raise exception 'valuation_date is required'; end if;

  with eligible as (
    select p.*,e.id envelope_id,e.supersedes_envelope_id
    from costing.marketing_allocation_policy p
    join costing.cost_driver_policy_envelope e
      on e.specialised_policy_schema='costing'
     and e.specialised_policy_table='marketing_allocation_policy'
     and e.specialised_policy_id=p.id
     and e.cost_element_code='MARKETING_EXPENSE'
     and e.lifecycle_status='APPROVED'
     and e.effective_from<=p_valuation_date
     and (e.effective_to is null or e.effective_to>=p_valuation_date)
    where p.is_active and p.effective_from<=p_valuation_date
      and (p.effective_to is null or p.effective_to>=p_valuation_date)
  ), current_effective as (
    select x.* from eligible x
    where not exists (
      select 1 from eligible s where s.supersedes_envelope_id=x.envelope_id
    )
  )
  select count(*)::integer into v_count from current_effective;

  if v_count<>1 then
    raise exception 'Exactly one approved effective Marketing allocation policy must resolve for %, found %',p_valuation_date,v_count;
  end if;

  with eligible as (
    select p.*,e.id envelope_id,e.supersedes_envelope_id
    from costing.marketing_allocation_policy p
    join costing.cost_driver_policy_envelope e
      on e.specialised_policy_schema='costing'
     and e.specialised_policy_table='marketing_allocation_policy'
     and e.specialised_policy_id=p.id
     and e.cost_element_code='MARKETING_EXPENSE'
     and e.lifecycle_status='APPROVED'
     and e.effective_from<=p_valuation_date
     and (e.effective_to is null or e.effective_to>=p_valuation_date)
    where p.is_active and p.effective_from<=p_valuation_date
      and (p.effective_to is null or p.effective_to>=p_valuation_date)
  ), current_effective as (
    select x.* from eligible x
    where not exists (
      select 1 from eligible s where s.supersedes_envelope_id=x.envelope_id
    )
  )
  select (jsonb_populate_record(null::costing.marketing_allocation_policy,to_jsonb(c)-'envelope_id'-'supersedes_envelope_id')).*
  into v_policy
  from current_effective c
  order by c.policy_version desc,c.id desc
  limit 1;

  return v_policy;
end;
$function$;