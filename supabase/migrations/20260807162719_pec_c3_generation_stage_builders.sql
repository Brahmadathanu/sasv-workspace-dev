-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_build_vendor_candidate_generation_internal(p_run_id bigint)
returns table(refreshed_count integer, refreshed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer := 0;
begin
  if p_run_id is null then raise exception 'p_run_id is required'; end if;
  if not exists (
    select 1 from public.proc_snapshot_refresh_run r
    where r.run_id=p_run_id and r.refresh_name='procurement_execution_snapshots'
      and r.status in ('PENDING','RUNNING')
  ) then raise exception 'Active procurement refresh run not found: %', p_run_id; end if;

  delete from public.proc_vendor_item_candidate_generation where run_id=p_run_id;

  insert into public.proc_vendor_item_candidate_generation(
    run_id, material_class_id, stock_item_id, vendor_id,
    rate_value, evidence, source_summary, refreshed_at
  )
  with allc as (
    select r.material_class_id,r.stock_item_id,r.vendor_id,r.rate_value,
           'rate_book'::text source,
           jsonb_build_object('rate_id',r.rate_id,'valid_from',r.valid_from,'valid_to',r.valid_to,
                              'min_order_qty',r.min_order_qty,'lead_time_days',r.lead_time_days) source_meta
    from public.v_proc_vendor_item_rate_effective r
    where r.material_class_id is not null and r.stock_item_id is not null
      and r.vendor_id is not null and r.rate_value is not null and r.rate_value>0
    union all
    select lp.material_class_id,lp.stock_item_id,lp.last_vendor_id,lp.last_rate_value,
           'last_purchase',jsonb_build_object('last_purchase_date',lp.last_purchase_date)
    from public.v_proc_item_vendor_last_purchase lp
    where lp.material_class_id is not null and lp.stock_item_id is not null
      and lp.last_vendor_id is not null and lp.last_rate_value is not null and lp.last_rate_value>0
    union all
    select br.material_class_id,br.stock_item_id,br.best_vendor_id_180d,br.best_rate_value_180d,
           'best_rate_180d',jsonb_build_object('best_rate_date',br.best_rate_date_180d)
    from public.v_proc_item_vendor_best_rate_180d br
    where br.material_class_id is not null and br.stock_item_id is not null
      and br.best_vendor_id_180d is not null and br.best_rate_value_180d is not null and br.best_rate_value_180d>0
    union all
    select ba.material_class_id,ba.stock_item_id,ba.best_avg_vendor_id_last3,ba.best_avg_rate_last3,
           'best_avg_last3',jsonb_build_object('last_seen_date',ba.best_avg_last_seen_date)
    from public.v_proc_item_vendor_best_avg_last3 ba
    where ba.material_class_id is not null and ba.stock_item_id is not null
      and ba.best_avg_vendor_id_last3 is not null and ba.best_avg_rate_last3 is not null and ba.best_avg_rate_last3>0
  ), dedup as (
    select a.material_class_id,a.stock_item_id,a.vendor_id,min(a.rate_value) rate_value,
           jsonb_agg(jsonb_build_object('source',a.source,'meta',a.source_meta) order by a.source) evidence,
           string_agg(distinct a.source, ', ' order by a.source) source_summary
    from allc a join public.proc_vendor v on v.vendor_id=a.vendor_id and coalesce(v.is_active,true)=true
    group by a.material_class_id,a.stock_item_id,a.vendor_id
  )
  select p_run_id,d.material_class_id,d.stock_item_id,d.vendor_id,d.rate_value,
         coalesce(d.evidence,'[]'::jsonb),d.source_summary,v_now
  from dedup d;
  get diagnostics v_count=row_count;
  return query select v_count,v_now;
end;$$;

create or replace function public.proc_build_indent_balance_generation_internal(p_run_id bigint)
returns table(refreshed_count integer, refreshed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_now timestamptz:=now(); v_count integer:=0;
begin
  if p_run_id is null then raise exception 'p_run_id is required'; end if;
  if not exists (
    select 1 from public.proc_snapshot_refresh_run r
    where r.run_id=p_run_id and r.refresh_name='procurement_execution_snapshots'
      and r.status in ('PENDING','RUNNING')
  ) then raise exception 'Active procurement refresh run not found: %', p_run_id; end if;

  delete from public.proc_indent_line_balance_generation where run_id=p_run_id;
  insert into public.proc_indent_line_balance_generation(
    run_id,indent_line_id,indent_id,material_class_id,stock_item_id,remaining_qty,refreshed_at
  )
  select p_run_id,lb.indent_line_id,lb.indent_id,lb.material_class_id,lb.stock_item_id,lb.remaining_qty,v_now
  from public.v_proc_indent_line_balance lb
  where lb.remaining_qty>0;
  get diagnostics v_count=row_count;
  return query select v_count,v_now;
end;$$;

create or replace function public.proc_build_indent_priority_generation_internal(p_run_id bigint)
returns table(refreshed_count integer, refreshed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_now timestamptz:=now(); v_count integer:=0; v_balance_count integer:=0;
begin
  if p_run_id is null then raise exception 'p_run_id is required'; end if;
  if not exists (
    select 1 from public.proc_snapshot_refresh_run r
    where r.run_id=p_run_id and r.refresh_name='procurement_execution_snapshots'
      and r.status in ('PENDING','RUNNING')
  ) then raise exception 'Active procurement refresh run not found: %', p_run_id; end if;

  select count(*)::integer into v_balance_count
  from public.proc_indent_line_balance_generation where run_id=p_run_id;
  if v_balance_count=0 then
    raise exception 'Stage 03 requires same-run Stage 02 balance generation for run %', p_run_id;
  end if;

  delete from public.proc_indent_line_priority_generation where run_id=p_run_id;

  insert into public.proc_indent_line_priority_generation(
    run_id,indent_line_id,indent_id,indent_number,approved_date,
    material_class_id,material_class_code,material_class_label,
    stock_item_id,stock_item_name,uom_id,uom_code,
    stock_qty,avg_monthly_6m,mos_months,missing_stock_record,missing_consumption_record,
    criticality_class,criticality_reason,lead_time_days,urgency_band,urgency_score,urgency_reason,
    prod_pull_score,prod_pull_why,net_excess_qty,aging_days,
    score_mos,score_lead_time,score_criticality,score_manual_urgency,score_prod_pull,score_aging,penalty_oversupply,
    priority_score_system,priority_band_system,
    override_band,override_reason,overridden_at,overridden_by,priority_band_final,priority_why,refreshed_at
  )
  with overs as (
    select material_class_id,stock_item_id,uom_id,excess_qty
    from public.v_proc_indent_excess_supply_net
  ), base as (
    select b.run_id,b.indent_line_id,b.indent_id,h.indent_number,h.approved_date,
           b.material_class_id,c.code material_class_code,c.label material_class_label,
           b.stock_item_id,si.name stock_item_name,l.uom_id,u.code uom_code,
           l.requested_qty,greatest(coalesce(l.requested_qty,0)-coalesce(b.remaining_qty,0),0) allocated_qty,
           b.remaining_qty,
           mos.stock_qty,mos.avg_monthly_6m,mos.mos_months,mos.missing_stock_record,mos.missing_consumption_record,
           coalesce(crit.criticality_class,'C') criticality_class,crit.reason criticality_reason,
           coalesce(lt.lead_time_days,0) lead_time_days,
           urg.urgency_band,urg.urgency_score,urg.reason urgency_reason,
           pp.prod_pull_score,pp.prod_pull_why,coalesce(o.excess_qty,0) net_excess_qty,
           current_date-h.approved_date aging_days
    from public.proc_indent_line_balance_generation b
    join public.proc_indent_header h on h.indent_id=b.indent_id
    join public.proc_indent_line l on l.indent_line_id=b.indent_line_id
    left join public.inv_class_category c on c.id=b.material_class_id
    left join public.inv_stock_item si on si.id=b.stock_item_id
    left join public.inv_uom u on u.id=l.uom_id
    left join public.v_proc_item_mos mos on mos.stock_item_id=b.stock_item_id
    left join public.v_proc_item_criticality_effective crit on crit.stock_item_id=b.stock_item_id
    left join public.v_proc_item_lead_time_effective lt on lt.stock_item_id=b.stock_item_id
    left join public.v_proc_item_production_urgency_effective urg on urg.stock_item_id=b.stock_item_id
    left join public.v_proc_prod_pull_by_item pp on pp.material_class_id=b.material_class_id and pp.stock_item_id=b.stock_item_id
    left join overs o on o.material_class_id=b.material_class_id and o.stock_item_id=b.stock_item_id and o.uom_id=l.uom_id
    where b.run_id=p_run_id and b.remaining_qty>0
  ), scored as (
    select x.*,
      case when x.mos_months is null and coalesce(x.stock_qty,0)=0 then 70
           when x.mos_months is null then 20 when x.mos_months<=0.5 then 100
           when x.mos_months<=1.0 then 80 when x.mos_months<=2.0 then 50
           when x.mos_months<=3.0 then 30 else 10 end score_mos,
      case when x.lead_time_days>=60 then 40 when x.lead_time_days>=30 then 25
           when x.lead_time_days>=14 then 15 else 5 end score_lead_time,
      case x.criticality_class when 'A' then 40 when 'B' then 20 else 5 end score_criticality,
      case when x.urgency_band='high' then 35 when x.urgency_band='medium' then 20
           when x.urgency_band='low' then 10 else 0 end score_manual_urgency,
      least(60::numeric,greatest(0::numeric,ln(coalesce(x.prod_pull_score,0)+1)*10)) score_prod_pull,
      least(20::numeric,greatest(0::numeric,x.aging_days::numeric/7*5)) score_aging,
      case when x.net_excess_qty<=0 then 0 when coalesce(x.prod_pull_score,0)>0 then 0 else -20 end penalty_oversupply
    from base x
  ), final as (
    select s.*,
      (s.score_mos+s.score_lead_time+s.score_criticality+s.score_manual_urgency)::numeric+s.score_prod_pull+s.score_aging+s.penalty_oversupply::numeric priority_score_system
    from scored s
  )
  select p_run_id,f.indent_line_id,f.indent_id,f.indent_number,f.approved_date,
         f.material_class_id,f.material_class_code,f.material_class_label,
         f.stock_item_id,f.stock_item_name,f.uom_id,f.uom_code,
         f.stock_qty,f.avg_monthly_6m,f.mos_months,f.missing_stock_record,f.missing_consumption_record,
         f.criticality_class,f.criticality_reason,f.lead_time_days,f.urgency_band,f.urgency_score,f.urgency_reason,
         f.prod_pull_score,f.prod_pull_why,f.net_excess_qty,f.aging_days,
         f.score_mos,f.score_lead_time,f.score_criticality,f.score_manual_urgency,f.score_prod_pull,f.score_aging,f.penalty_oversupply,
         f.priority_score_system,
         case when f.priority_score_system>=140 then 'P1' when f.priority_score_system>=90 then 'P2' else 'P3' end,
         ovr.override_band,ovr.override_reason,ovr.overridden_at,ovr.overridden_by,
         coalesce(ovr.override_band,case when f.priority_score_system>=140 then 'P1' when f.priority_score_system>=90 then 'P2' else 'P3' end),
         jsonb_build_object('mos_months',f.mos_months,'stock_qty',f.stock_qty,'avg_monthly_6m',f.avg_monthly_6m,
           'lead_time_days',f.lead_time_days,'criticality_class',f.criticality_class,'urgency_band',f.urgency_band,
           'prod_pull_score',f.prod_pull_score,'aging_days',f.aging_days,'net_excess_qty',f.net_excess_qty,
           'components',jsonb_build_object('score_mos',f.score_mos,'score_lead_time',f.score_lead_time,
             'score_criticality',f.score_criticality,'score_manual_urgency',f.score_manual_urgency,
             'score_prod_pull',f.score_prod_pull,'score_aging',f.score_aging,'penalty_oversupply',f.penalty_oversupply)),
         v_now
  from final f
  left join public.proc_indent_priority_override ovr on ovr.indent_line_id=f.indent_line_id;
  get diagnostics v_count=row_count;
  return query select v_count,v_now;
end;$$;

revoke all on function public.proc_build_vendor_candidate_generation_internal(bigint) from public, anon, authenticated;
revoke all on function public.proc_build_indent_balance_generation_internal(bigint) from public, anon, authenticated;
revoke all on function public.proc_build_indent_priority_generation_internal(bigint) from public, anon, authenticated;
grant execute on function public.proc_build_vendor_candidate_generation_internal(bigint) to postgres, service_role;
grant execute on function public.proc_build_indent_balance_generation_internal(bigint) to postgres, service_role;
grant execute on function public.proc_build_indent_priority_generation_internal(bigint) to postgres, service_role;