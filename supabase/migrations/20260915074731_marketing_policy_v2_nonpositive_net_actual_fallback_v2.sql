-- SOURCE-CONTROL PARITY for live ledger version 20260915074731
-- name: marketing_policy_v2_nonpositive_net_actual_fallback_v2
-- Captured from supabase_migrations.schema_migrations.statements (live).
-- DO NOT reapply to production (already applied).
--
do $$
declare
  v_old_policy costing.marketing_allocation_policy%rowtype;
  v_new_policy_id bigint;
  v_old_envelope_id bigint;
  v_new_envelope_id bigint;
  v_note text;
begin
  select * into v_old_policy
  from costing.marketing_allocation_policy
  where policy_code='MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1'
    and policy_version=1;
  if not found then raise exception 'Marketing allocation policy v1 not found'; end if;

  select id into v_old_envelope_id
  from costing.cost_driver_policy_envelope
  where cost_element_code='MARKETING_EXPENSE'
    and specialised_policy_schema='costing'
    and specialised_policy_table='marketing_allocation_policy'
    and specialised_policy_id=v_old_policy.id
    and lifecycle_status='APPROVED'
  order by id desc limit 1;
  if v_old_envelope_id is null then raise exception 'Approved Marketing policy envelope v1 not found'; end if;

  v_note:=v_old_policy.policy_note || ' For forward costing allocation only, if eligible Product × Region actual history exists but its frozen 12-month net signed tax-exclusive billed sales value is zero or negative, the signed actual history remains preserved for audit while a separately approved NON_POSITIVE_NET_ACTUAL_HISTORY regional planning default supplies the positive costing quantity/value basis. This exception does not rewrite historical sales or signed returns.';

  select id into v_new_policy_id
  from costing.marketing_allocation_policy
  where policy_code='MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1'
    and policy_version=2;

  if v_new_policy_id is null then
    insert into costing.marketing_allocation_policy(
      policy_code,policy_version,effective_from,effective_to,lookback_months,monetary_basis,
      common_allocation_level,regional_decomposition_mode,actual_precedence,retain_signed_returns,
      assumption_fallback_mode,regional_physical_basis_hierarchy,governed_region_codes,policy_note,is_active
    ) values (
      'MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1',2,'2026-09-10',null,
      v_old_policy.lookback_months,v_old_policy.monetary_basis,v_old_policy.common_allocation_level,
      v_old_policy.regional_decomposition_mode,v_old_policy.actual_precedence,v_old_policy.retain_signed_returns,
      v_old_policy.assumption_fallback_mode,v_old_policy.regional_physical_basis_hierarchy,
      v_old_policy.governed_region_codes,v_note,true
    ) returning id into v_new_policy_id;
  end if;

  select id into v_new_envelope_id
  from costing.cost_driver_policy_envelope
  where cost_element_code='MARKETING_EXPENSE'
    and specialised_policy_schema='costing'
    and specialised_policy_table='marketing_allocation_policy'
    and specialised_policy_id=v_new_policy_id
  order by id desc limit 1;

  if v_new_envelope_id is null then
    insert into costing.cost_driver_policy_envelope(
      cost_element_code,policy_code,policy_version,lifecycle_status,maturity_status,cutover_status,
      client_status,data_quality_status,formula_type,effective_from,effective_to,
      specialised_policy_schema,specialised_policy_table,specialised_policy_id,supersedes_envelope_id,
      approval_reference,policy_note,validation_note,created_by
    ) values (
      'MARKETING_EXPENSE','MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1',2,
      'DRAFT','PROVISIONAL_OPERATIONAL','PREVIEW_ONLY','CLIENT_READY','DATA_QUALITY_READY',
      'SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION','2026-09-10',null,
      'costing','marketing_allocation_policy',v_new_policy_id,v_old_envelope_id,
      'Gate 5.11BU.11Y.9B successor — non-positive net actual regional planning fallback, effective 2026-09-10',
      v_note,'Successor preserves signed actual history and adds a governed positive planning fallback only for net actual Product × Region billed value <= 0.',
      'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
    ) returning id into v_new_envelope_id;

    update costing.cost_driver_policy_envelope
       set lifecycle_status='REVIEW_REQUIRED',submitted_by='dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid,submitted_at=clock_timestamp()
     where id=v_new_envelope_id;
    update costing.cost_driver_policy_envelope
       set lifecycle_status='APPROVED',approved_by='dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid,approved_at=clock_timestamp()
     where id=v_new_envelope_id;
  end if;
end $$;

create or replace function costing.fn_resolve_marketing_allocation_policy(p_valuation_date date)
returns costing.marketing_allocation_policy
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare v_policy costing.marketing_allocation_policy%rowtype; v_count integer;
begin
  if p_valuation_date is null then raise exception 'valuation_date is required'; end if;
  with eligible as (
    select p.*,e.id envelope_id
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
    where not exists (select 1 from eligible s where s.supersedes_envelope_id=x.envelope_id)
  )
  select count(*)::integer into v_count from current_effective;
  if v_count<>1 then raise exception 'Exactly one approved effective Marketing allocation policy must resolve for %, found %',p_valuation_date,v_count; end if;

  with eligible as (
    select p.*,e.id envelope_id
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
    where not exists (select 1 from eligible s where s.supersedes_envelope_id=x.envelope_id)
  )
  select (jsonb_populate_record(null::costing.marketing_allocation_policy,to_jsonb(c)-'envelope_id')).*
  into v_policy
  from current_effective c
  order by c.policy_version desc,c.id desc limit 1;
  return v_policy;
end;
$function$;

alter table costing.regional_sales_allocation_default_policy drop constraint if exists regional_sales_default_scenario_chk;
alter table costing.regional_sales_allocation_default_policy add constraint regional_sales_default_scenario_chk
check (scenario_code=any(array['NO_ELIGIBLE_REGIONAL_HISTORY'::text,'NO_POSITIVE_REGIONAL_HISTORY'::text,'NON_POSITIVE_NET_ACTUAL_HISTORY'::text]));

do $$
declare v_next bigint;
begin
  lock table costing.regional_sales_allocation_default_policy in share row exclusive mode;
  select coalesce(max(id),0)+1 into v_next from costing.regional_sales_allocation_default_policy;
  if not exists(select 1 from costing.regional_sales_allocation_default_policy where scenario_code='NON_POSITIVE_NET_ACTUAL_HISTORY' and region_code='IK' and effective_from='2026-09-10' and status='APPROVED') then
    insert into costing.regional_sales_allocation_default_policy(id,scenario_code,region_code,default_sales_units,effective_from,status,reason,approval_reference,created_by)
    values(v_next,'NON_POSITIVE_NET_ACTUAL_HISTORY','IK',10,'2026-09-10','APPROVED','Forward costing fallback when eligible regional actual history exists but the frozen 12-month net signed billed sales value is zero or negative. Signed actual evidence remains unchanged.','GATE6C-SEP2026-REGIONAL-NONPOSITIVE-NET-FALLBACK-10','dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid);
    v_next:=v_next+1;
  end if;
  if not exists(select 1 from costing.regional_sales_allocation_default_policy where scenario_code='NON_POSITIVE_NET_ACTUAL_HISTORY' and region_code='OK' and effective_from='2026-09-10' and status='APPROVED') then
    insert into costing.regional_sales_allocation_default_policy(id,scenario_code,region_code,default_sales_units,effective_from,status,reason,approval_reference,created_by)
    values(v_next,'NON_POSITIVE_NET_ACTUAL_HISTORY','OK',10,'2026-09-10','APPROVED','Forward costing fallback when eligible regional actual history exists but the frozen 12-month net signed billed sales value is zero or negative. Signed actual evidence remains unchanged.','GATE6C-SEP2026-REGIONAL-NONPOSITIVE-NET-FALLBACK-10','dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid);
  end if;
end $$;

create or replace function costing.fn_resolve_regional_sales_default_policy_as_of(p_scenario_code text,p_region_code text,p_valuation_date date)
returns table(policy_id bigint,scenario_code text,region_code text,default_sales_units numeric,effective_from date,effective_to date,resolution_status text,qualifying_policy_count bigint,resolution_note text)
language sql stable security definer set search_path to 'costing','public','pg_temp'
as $function$
with n as (select upper(btrim(coalesce(p_scenario_code,''))) scenario_code,upper(btrim(coalesce(p_region_code,''))) region_code,p_valuation_date valuation_date),
c as (select p.* from costing.regional_sales_allocation_default_policy p cross join n where p.scenario_code=n.scenario_code and p.region_code=n.region_code and p.status in('APPROVED','CLOSED') and p.effective_from<=n.valuation_date and (p.effective_to is null or p.effective_to>=n.valuation_date)),
s as (select count(*)::bigint qualifying_count from c)
select case when s.qualifying_count=1 then c.id end,n.scenario_code,n.region_code,case when s.qualifying_count=1 then c.default_sales_units end,case when s.qualifying_count=1 then c.effective_from end,case when s.qualifying_count=1 then c.effective_to end,
case when p_valuation_date is null then 'INVALID_CONTEXT' when n.scenario_code not in('NO_ELIGIBLE_REGIONAL_HISTORY','NO_POSITIVE_REGIONAL_HISTORY','NON_POSITIVE_NET_ACTUAL_HISTORY') then 'INVALID_SCENARIO' when n.region_code not in('IK','OK') then 'INVALID_REGION' when s.qualifying_count=0 then 'MISSING' when s.qualifying_count>1 then 'AMBIGUOUS' else 'RESOLVED' end,
s.qualifying_count,
case when p_valuation_date is null then 'Valuation date is required.' when n.scenario_code not in('NO_ELIGIBLE_REGIONAL_HISTORY','NO_POSITIVE_REGIONAL_HISTORY','NON_POSITIVE_NET_ACTUAL_HISTORY') then 'Regional sales-allocation default scenario is invalid.' when n.region_code not in('IK','OK') then 'Region must be IK or OK.' when s.qualifying_count=0 then 'No governed regional default allocation-volume policy is effective on the valuation date.' when s.qualifying_count>1 then 'Multiple governed regional default policies overlap on the valuation date.' else 'Regional default allocation-volume policy resolved.' end
from n cross join s left join c on s.qualifying_count=1;
$function$;

create or replace function costing.fn_apply_regional_default_to_basis_snapshot()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp'
as $function$
declare v_scenario text; v_policy record; v_value record;
begin
  if coalesce(new.product_region_actual_evidence_row_count,0)>0 and coalesce(new.product_region_actual_signed_billed_value,0)>0 and new.regional_actual_units>0 then return new; end if;
  if new.assumption_resolution_status='RESOLVED' and new.assumed_total_units>0 then return new; end if;
  if coalesce(new.product_region_actual_evidence_row_count,0)>0 and coalesce(new.product_region_actual_signed_billed_value,0)<=0 then
    v_scenario:='NON_POSITIVE_NET_ACTUAL_HISTORY';
  elsif new.regional_actual_units>0 then return new;
  elsif coalesce(new.product_region_actual_evidence_row_count,0)=0 then v_scenario:='NO_ELIGIBLE_REGIONAL_HISTORY';
  elsif coalesce(new.product_regional_positive_actual_share,0)<=0 then v_scenario:='NO_POSITIVE_REGIONAL_HISTORY';
  else return new; end if;

  select * into v_policy from costing.fn_resolve_regional_sales_default_policy_as_of(v_scenario,new.region_code,new.valuation_date);
  new.regional_default_resolution_status:=v_policy.resolution_status; new.regional_default_resolution_note:=v_policy.resolution_note;
  if v_policy.resolution_status is distinct from 'RESOLVED' then return new; end if;
  select * into v_value from costing.fn_resolve_regional_default_commercial_value(new.sku_id,new.region_code,v_policy.default_sales_units,new.valuation_date);
  new.regional_default_policy_id:=v_policy.policy_id; new.regional_default_scenario:=v_policy.scenario_code; new.regional_default_sales_units:=v_policy.default_sales_units; new.regional_default_effective_from:=v_policy.effective_from; new.regional_default_effective_to:=v_policy.effective_to; new.regional_default_resolution_status:=v_value.resolution_status; new.regional_default_resolution_note:=v_value.resolution_note; new.regional_default_assumed_sales_value:=v_value.resolved_sales_value; new.regional_default_value_source:=v_value.value_resolution_source;
  if v_value.resolution_status is distinct from 'READY' then return new; end if;
  new.resolved_regional_units:=v_policy.default_sales_units; new.resolved_regional_base_qty:=v_policy.default_sales_units*new.sku_base_qty_per_unit; new.regional_basis_source:='REGIONAL_DEFAULT_POLICY_UNITS'; new.regional_basis_status:='REVIEW_REQUIRED';
  new.regional_basis_note:=case when v_scenario='NON_POSITIVE_NET_ACTUAL_HISTORY' then format('Eligible signed actual regional history exists, but its frozen 12-month net billed value is zero or negative. Actual evidence remains preserved; governed policy %s supplies %s planning units for %s for costing allocation and requires review.',v_policy.policy_id,v_policy.default_sales_units,new.region_code) else format('No higher-precedence positive regional physical basis is available. Governed regional default policy %s supplies %s total sales units for %s; commercial value is derived from governed standard pricing and requires review.',v_policy.policy_id,v_policy.default_sales_units,new.region_code) end;
  return new;
end;
$function$;

create or replace function costing.fn_reprice_regional_marketing_after_insert()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp'
as $function$
declare v_run_id bigint;
begin
  for v_run_id in select distinct refresh_run_id from new_rows loop
    with pr as materialized (
      select b.product_id,b.region_code,max(b.product_region_actual_evidence_row_count)::bigint actual_row_count,max(b.product_region_actual_signed_billed_value)::numeric actual_value,
      count(*) filter(where b.assumption_resolution_status='RESOLVED')::bigint explicit_count,coalesce(sum(b.assumed_sales_value) filter(where b.assumption_resolution_status='RESOLVED'),0::numeric) explicit_value,
      count(*) filter(where b.assumption_resolution_status<>'RESOLVED' and b.regional_default_resolution_status='READY' and b.regional_default_assumed_sales_value is not null)::bigint default_count,
      coalesce(sum(b.regional_default_assumed_sales_value) filter(where b.assumption_resolution_status<>'RESOLVED' and b.regional_default_resolution_status='READY'),0::numeric) default_value,
      sum(b.resolved_regional_base_qty) filter(where b.regional_basis_status in('READY','REVIEW_REQUIRED') and b.resolved_regional_base_qty>0)::numeric recipient_base_qty
      from costing.sku_regional_marketing_allocation_basis_snapshot b where b.refresh_run_id=v_run_id group by b.product_id,b.region_code
    ), resolved_pr as materialized (
      select pr.*,
      case when actual_row_count>0 and actual_value>0 then 'ACTUAL_SIGNED_BILLED_SALES' when actual_row_count>0 and actual_value<=0 and explicit_count>0 then 'APPROVED_REGIONAL_ASSUMPTION' when actual_row_count>0 and actual_value<=0 and default_count>0 then 'GOVERNED_REGIONAL_DEFAULT' when actual_row_count>0 then 'ACTUAL_SIGNED_BILLED_SALES' when explicit_count>0 then 'APPROVED_REGIONAL_ASSUMPTION' when default_count>0 then 'GOVERNED_REGIONAL_DEFAULT' else 'NO_ELIGIBLE_HISTORY' end value_source,
      case when actual_row_count>0 and actual_value>0 then actual_value when actual_row_count>0 and actual_value<=0 and explicit_count>0 then explicit_value when actual_row_count>0 and actual_value<=0 and default_count>0 then default_value when actual_row_count>0 then actual_value when explicit_count>0 then explicit_value when default_count>0 then default_value else 0::numeric end resolved_value
      from pr
    ), company as (select coalesce(sum(resolved_value),0::numeric) company_value from resolved_pr),
    calc as (select e.id,p.value_source,p.resolved_value,p.recipient_base_qty,c.company_value,case when c.company_value<>0 then p.resolved_value/c.company_value else null::numeric end monetary_share from costing.sku_regional_marketing_expense_allocation_snapshot e join resolved_pr p on p.product_id=e.product_id and p.region_code=e.region_code cross join company c where e.refresh_run_id=v_run_id)
    update costing.sku_regional_marketing_expense_allocation_snapshot e set marketing_value_source=c.value_source,resolved_product_region_marketing_sales_value=c.resolved_value,resolved_company_marketing_sales_value=c.company_value,product_region_monetary_allocation_share=c.monetary_share,product_region_marketing_allocation=case when c.monetary_share is null then null else e.marketing_pool_amount*c.monetary_share end,recipient_product_region_base_qty=c.recipient_base_qty,
    marketing_expense_cost_per_sku_region=case when e.regional_basis_status='BLOCKED' then null when c.recipient_base_qty is null or c.recipient_base_qty<=0 then null when e.sku_base_qty_per_unit is null or e.sku_base_qty_per_unit<=0 then null when c.monetary_share is null then null else (e.marketing_pool_amount*c.monetary_share/c.recipient_base_qty)*e.sku_base_qty_per_unit end,
    marketing_expense_allocation_status=case when e.regional_basis_status='BLOCKED' then 'BLOCKED' when c.recipient_base_qty is null or c.recipient_base_qty<=0 then 'BLOCKED' when e.sku_base_qty_per_unit is null or e.sku_base_qty_per_unit<=0 then 'BLOCKED' when c.monetary_share is null then 'BLOCKED' when c.value_source in('APPROVED_REGIONAL_ASSUMPTION','GOVERNED_REGIONAL_DEFAULT','NO_ELIGIBLE_HISTORY') then 'REVIEW_REQUIRED' when c.resolved_value<=0 then 'REVIEW_REQUIRED' when e.regional_basis_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' else 'READY' end,
    marketing_expense_allocation_note=case when e.regional_basis_status='BLOCKED' then 'Regional Marketing allocation is blocked because the governed SKU-region physical basis is blocked.' when c.recipient_base_qty is null or c.recipient_base_qty<=0 then 'Regional Marketing allocation is blocked because the Product × Region recipient base quantity is missing or nonpositive.' when e.sku_base_qty_per_unit is null or e.sku_base_qty_per_unit<=0 then 'Regional Marketing allocation is blocked because SKU base quantity per unit is missing or nonpositive.' when c.monetary_share is null then 'Regional Marketing allocation is blocked because the resolved company Marketing sales value is zero.' when c.value_source='GOVERNED_REGIONAL_DEFAULT' then 'Regional Marketing allocation uses a governed regional planning default because higher-precedence usable commercial evidence is unavailable or frozen net actual signed billed value is zero/negative; actual signed evidence remains preserved for audit and requires review.' when c.value_source='APPROVED_REGIONAL_ASSUMPTION' then 'Regional Marketing monetary allocation uses an approved regional planning assumption and requires review.' when c.value_source='NO_ELIGIBLE_HISTORY' then 'No eligible actual Product × Region sales rows, explicit assumption, or usable governed regional default exist. Regional Marketing allocation is zero and requires review.' when c.resolved_value<=0 then 'Actual eligible Product × Region signed billed value is zero or negative. Actual monetary precedence is retained and requires review.' when e.regional_basis_status='REVIEW_REQUIRED' then 'Actual Product × Region monetary share is combined with a governed assumed/default or region-scaled physical basis and requires review.' else 'Regional Marketing expense uses Product × Region signed tax-exclusive billed value and the governed regional base quantity.' end
    from calc c where e.id=c.id;
  end loop;
  return null;
end;
$function$;
