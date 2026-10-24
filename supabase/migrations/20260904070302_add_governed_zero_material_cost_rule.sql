-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.material_zero_cost_rule (
    id bigserial primary key,
    stock_item_id bigint not null references public.inv_stock_item(id),
    classification_code text not null,
    effective_from date not null,
    effective_to date null,
    status text not null default 'DRAFT',
    reason text not null,
    approval_reference text null,
    approved_by uuid null,
    approved_at timestamptz null,
    created_by uuid null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint material_zero_cost_rule_status_chk check (status in ('DRAFT','APPROVED','CANCELLED')),
    constraint material_zero_cost_rule_classification_chk check (classification_code in ('INTERNAL_FREE_BYPRODUCT','INTERNAL_FREE_TRANSFER','OTHER_GOVERNED_ZERO_COST')),
    constraint material_zero_cost_rule_date_chk check (effective_to is null or effective_to >= effective_from),
    constraint material_zero_cost_rule_approval_chk check (
      (status='APPROVED' and approval_reference is not null and approved_by is not null and approved_at is not null)
      or status<>'APPROVED'
    )
);

create index if not exists material_zero_cost_rule_lookup_idx
on costing.material_zero_cost_rule(stock_item_id,status,effective_from,effective_to);

create or replace function costing.fn_resolve_material_rates_as_of(p_stock_item_ids bigint[], p_as_of_date date)
returns table(stock_item_id bigint, as_of_date date, resolution_status text, selected_rate numeric, rate_source text, rate_date date, selected_uom_id bigint, selected_manual_rate_id bigint, selected_purchase_fact_id bigint, selected_vendor_id bigint, selected_stock_valuation_source text, selected_stock_valuation_priority integer, warning_flag boolean, warning_code text, warning_text text, manual_candidate_count bigint, purchase_candidate_count bigint, stock_valuation_candidate_count bigint, resolution_note text)
language sql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with requested_items as materialized (
    select distinct x.stock_item_id
    from unnest(coalesce(p_stock_item_ids,array[]::bigint[])) as x(stock_item_id)
    where x.stock_item_id is not null
),
zero_candidates as materialized (
    select z.stock_item_id,z.id,z.classification_code,z.effective_from,
           count(*) over(partition by z.stock_item_id)::bigint as candidate_count,
           row_number() over(partition by z.stock_item_id order by z.effective_from desc,z.id desc) as candidate_rank
    from costing.material_zero_cost_rule z
    join requested_items ri on ri.stock_item_id=z.stock_item_id
    where z.status='APPROVED'
      and z.effective_from<=p_as_of_date
      and (z.effective_to is null or z.effective_to>=p_as_of_date)
),
zero_summary as materialized (
    select ri.stock_item_id,
           coalesce(max(zc.candidate_count),0)::bigint as candidate_count,
           max(zc.classification_code) filter(where zc.candidate_rank=1) as classification_code,
           max(zc.effective_from) filter(where zc.candidate_rank=1) as effective_from
    from requested_items ri left join zero_candidates zc on zc.stock_item_id=ri.stock_item_id
    group by ri.stock_item_id
),
manual_candidates as materialized (
    select mr.stock_item_id,mr.id,mr.rate_value,mr.rate_uom_id,mr.effective_from,mr.rate_origin,mr.source_vendor_id,
           count(*) over(partition by mr.stock_item_id)::bigint as candidate_count,
           row_number() over(partition by mr.stock_item_id order by mr.effective_from desc,mr.id desc) as candidate_rank
    from costing.material_manual_rates mr
    join requested_items ri on ri.stock_item_id=mr.stock_item_id
    where mr.status='ACTIVE' and mr.effective_from<=p_as_of_date and (mr.effective_to is null or mr.effective_to>=p_as_of_date)
),
manual_summary as materialized (
    select ri.stock_item_id,coalesce(max(mc.candidate_count),0)::bigint as candidate_count,
           max(mc.id) filter(where mc.candidate_rank=1) as selected_manual_rate_id,
           max(mc.rate_value) filter(where mc.candidate_rank=1) as selected_rate,
           max(mc.rate_uom_id) filter(where mc.candidate_rank=1) as selected_uom_id,
           max(mc.effective_from) filter(where mc.candidate_rank=1) as rate_date,
           max(mc.rate_origin) filter(where mc.candidate_rank=1) as rate_origin,
           max(mc.source_vendor_id) filter(where mc.candidate_rank=1) as selected_vendor_id
    from requested_items ri left join manual_candidates mc on mc.stock_item_id=ri.stock_item_id
    group by ri.stock_item_id
),
purchase_candidates as materialized (
    select p.inv_stock_item_id as stock_item_id,p.purchase_fact_id,p.voucher_date,sic.default_uom_id as uom_id,
           case when va.status='mapped' then va.vendor_id else null end as vendor_id,p.avg_rate_value as rate_value,
           count(*) over(partition by p.inv_stock_item_id)::bigint as candidate_count,
           row_number() over(partition by p.inv_stock_item_id order by p.voucher_date desc,p.purchase_fact_id desc) as candidate_rank
    from public.v_purchases_by_item p
    join requested_items ri on ri.stock_item_id=p.inv_stock_item_id
    join public.v_inv_stock_item_with_class sic on sic.stock_item_id=p.inv_stock_item_id
    left join public.proc_vendor_alias va on va.source_system='tally' and va.alias_key=public.normalise_alias_key(p.supplier_name)
    where p.avg_rate_value is not null and p.avg_rate_value>0 and p.voucher_date<=p_as_of_date
),
purchase_summary as materialized (
    select ri.stock_item_id,coalesce(max(pc.candidate_count),0)::bigint as candidate_count,
           max(pc.purchase_fact_id) filter(where pc.candidate_rank=1) as selected_purchase_fact_id,
           max(pc.voucher_date) filter(where pc.candidate_rank=1) as rate_date,
           max(pc.uom_id) filter(where pc.candidate_rank=1) as selected_uom_id,
           max(pc.vendor_id) filter(where pc.candidate_rank=1) as selected_vendor_id,
           max(pc.rate_value) filter(where pc.candidate_rank=1) as selected_rate
    from requested_items ri left join purchase_candidates pc on pc.stock_item_id=ri.stock_item_id
    group by ri.stock_item_id
),
requested_aliases as materialized (
    select distinct a.inv_stock_item_id as stock_item_id,a.alias_key
    from public.inv_stock_item_alias a join requested_items ri on ri.stock_item_id=a.inv_stock_item_id
    where a.source_system='tally' and a.status='mapped' and a.inv_stock_item_id is not null
),
stock_source_rows as materialized (
    select ra.stock_item_id,'RM_STOCK_SNAPSHOT'::text as valuation_source,1::integer as valuation_source_priority,
           s.as_of_date,s.tally_item_name,s.qty_value,s.rate_value,null::numeric as stock_value
    from public.tally_rm_stock_snapshot s join requested_aliases ra on ra.alias_key=public.normalise_alias_key(s.tally_item_name)
    where s.as_of_date<=p_as_of_date and s.rate_value is not null and s.rate_value>0 and s.qty_value is not null and s.qty_value<>0
    union all
    select ra.stock_item_id,'PM_STOCK_SNAPSHOT'::text,2::integer,s.as_of_date,s.tally_item_name,s.qty_value,s.rate_value,null::numeric
    from public.tally_plm_stock_snapshot s join requested_aliases ra on ra.alias_key=public.normalise_alias_key(s.tally_item_name)
    where s.as_of_date<=p_as_of_date and s.rate_value is not null and s.rate_value>0 and s.qty_value is not null and s.qty_value<>0
    union all
    select ra.stock_item_id,'GENERAL_STOCK_BY_NAME'::text,3::integer,s.as_of_date,s.tally_item_name,s.qty_units,s.stock_rate,s.stock_value
    from public.tally_stock_by_name s join requested_aliases ra on ra.alias_key=public.normalise_alias_key(s.tally_item_name)
    where s.as_of_date<=p_as_of_date and s.stock_rate is not null and s.stock_rate>0 and s.qty_units is not null and s.qty_units<>0
),
latest_stock_source_dates as materialized (
    select sr.stock_item_id,sr.valuation_source,sr.valuation_source_priority,max(sr.as_of_date) as valuation_date
    from stock_source_rows sr group by sr.stock_item_id,sr.valuation_source,sr.valuation_source_priority
),
stock_source_aggregates as materialized (
    select sr.stock_item_id,sr.valuation_source,sr.valuation_source_priority,sr.as_of_date as valuation_date,
           case when sum(coalesce(sr.stock_value,0))<>0 and sum(sr.qty_value)<>0
                then sum(sr.stock_value)/nullif(sum(sr.qty_value),0)
                else sum(sr.qty_value*sr.rate_value)/nullif(sum(sr.qty_value),0) end as valuation_rate
    from stock_source_rows sr join latest_stock_source_dates ld
      on ld.stock_item_id=sr.stock_item_id and ld.valuation_source=sr.valuation_source
     and ld.valuation_source_priority=sr.valuation_source_priority and ld.valuation_date=sr.as_of_date
    group by sr.stock_item_id,sr.valuation_source,sr.valuation_source_priority,sr.as_of_date
),
ranked_stock_sources as materialized (
    select sa.*,count(*) over(partition by sa.stock_item_id)::bigint as candidate_source_count,
           row_number() over(partition by sa.stock_item_id order by sa.valuation_source_priority,sa.valuation_date desc,sa.valuation_source) as source_rank
    from stock_source_aggregates sa
),
stock_summary as materialized (
    select ri.stock_item_id,coalesce(max(rs.candidate_source_count),0)::bigint as candidate_source_count,
           max(rs.valuation_source) filter(where rs.source_rank=1) as valuation_source,
           max(rs.valuation_source_priority) filter(where rs.source_rank=1) as valuation_source_priority,
           max(rs.valuation_date) filter(where rs.source_rank=1) as valuation_date,
           max(rs.valuation_rate) filter(where rs.source_rank=1) as valuation_rate
    from requested_items ri left join ranked_stock_sources rs on rs.stock_item_id=ri.stock_item_id
    group by ri.stock_item_id
)
select ri.stock_item_id,p_as_of_date,
       case when zs.candidate_count>1 then 'AMBIGUOUS'
            when zs.candidate_count=1 then 'RESOLVED'
            when ms.candidate_count>1 then 'AMBIGUOUS'
            when ms.candidate_count=1 then 'RESOLVED'
            when ps.selected_purchase_fact_id is not null then 'RESOLVED'
            when ss.valuation_source is not null then 'RESOLVED' else 'MISSING' end,
       case when zs.candidate_count>1 then null::numeric when zs.candidate_count=1 then 0::numeric
            when ms.candidate_count>1 then null::numeric when ms.candidate_count=1 then ms.selected_rate
            when ps.selected_purchase_fact_id is not null then ps.selected_rate
            when ss.valuation_source is not null then ss.valuation_rate else null::numeric end,
       case when zs.candidate_count>1 then null::text when zs.candidate_count=1 then 'GOVERNED_ZERO_COST'
            when ms.candidate_count>1 then null::text when ms.candidate_count=1 then 'MANUAL_RATE'
            when ps.selected_purchase_fact_id is not null then 'LAST_PURCHASE'
            when ss.valuation_source is not null then 'STOCK_VALUATION' else null::text end,
       case when zs.candidate_count=1 then zs.effective_from when ms.candidate_count=1 then ms.rate_date
            when ps.selected_purchase_fact_id is not null then ps.rate_date when ss.valuation_source is not null then ss.valuation_date else null::date end,
       case when zs.candidate_count=1 then sic.default_uom_id when ms.candidate_count=1 then ms.selected_uom_id
            when ms.candidate_count=0 and ps.selected_purchase_fact_id is not null then ps.selected_uom_id else null::bigint end,
       case when zs.candidate_count=0 and ms.candidate_count=1 then ms.selected_manual_rate_id else null::bigint end,
       case when zs.candidate_count=0 and ms.candidate_count=0 and ps.selected_purchase_fact_id is not null then ps.selected_purchase_fact_id else null::bigint end,
       case when zs.candidate_count=0 and ms.candidate_count=1 then ms.selected_vendor_id
            when zs.candidate_count=0 and ms.candidate_count=0 and ps.selected_purchase_fact_id is not null then ps.selected_vendor_id else null::bigint end,
       case when zs.candidate_count=0 and ms.candidate_count=0 and ps.selected_purchase_fact_id is null and ss.valuation_source is not null then ss.valuation_source else null::text end,
       case when zs.candidate_count=0 and ms.candidate_count=0 and ps.selected_purchase_fact_id is null and ss.valuation_source is not null then ss.valuation_source_priority else null::integer end,
       case when zs.candidate_count>1 then true when zs.candidate_count=1 then false
            when ms.candidate_count>1 then true when ms.candidate_count=1 then true
            when ps.selected_purchase_fact_id is not null and ps.rate_date<p_as_of_date-180 then true
            when ps.selected_purchase_fact_id is null and ss.valuation_source is not null then true else false end,
       case when zs.candidate_count>1 then 'AMBIGUOUS_ZERO_COST_RULE'
            when zs.candidate_count=1 then null::text
            when ms.candidate_count>1 then 'AMBIGUOUS_MANUAL_RATE' when ms.candidate_count=1 then 'MANUAL_RATE_USED'
            when ps.selected_purchase_fact_id is not null and ps.rate_date<p_as_of_date-180 then 'STALE_PURCHASE_RATE'
            when ps.selected_purchase_fact_id is null and ss.valuation_source is not null then 'STOCK_VALUATION_FALLBACK'
            when ps.selected_purchase_fact_id is null and ss.valuation_source is null then 'MISSING_MATERIAL_RATE' else null::text end,
       case when zs.candidate_count>1 then format('%s approved zero-cost rules qualify for stock item %s as of %s.',zs.candidate_count,ri.stock_item_id,p_as_of_date)
            when zs.candidate_count=1 then format('Governed zero-cost rule %s effective from %s was used.',zs.classification_code,zs.effective_from)
            when ms.candidate_count>1 then format('%s active manual material rates qualify for stock item %s as of %s.',ms.candidate_count,ri.stock_item_id,p_as_of_date)
            when ms.candidate_count=1 then format('Manual material rate %s effective from %s was used.',ms.selected_rate,ms.rate_date)
            when ps.selected_purchase_fact_id is not null and ps.rate_date<p_as_of_date-180 then format('Latest qualifying purchase rate is dated %s, more than 180 days before valuation date %s.',ps.rate_date,p_as_of_date)
            when ps.selected_purchase_fact_id is null and ss.valuation_source is not null then format('No qualifying manual or purchase rate was available. Stock valuation %s dated %s was used.',ss.valuation_source,ss.valuation_date)
            when ps.selected_purchase_fact_id is null and ss.valuation_source is null then format('No qualifying manual, purchase, or mapped stock valuation rate exists for stock item %s on or before %s.',ri.stock_item_id,p_as_of_date)
            else null::text end,
       case when zs.candidate_count=0 then ms.candidate_count else 0::bigint end,
       case when zs.candidate_count=0 and ms.candidate_count=0 then ps.candidate_count else 0::bigint end,
       case when zs.candidate_count=0 and ms.candidate_count=0 and ps.selected_purchase_fact_id is null then ss.candidate_source_count else 0::bigint end,
       case when zs.candidate_count>1 then 'Zero-cost rule ambiguity blocks fallback resolution.'
            when zs.candidate_count=1 then 'Resolved from approved governed zero-cost material rule.'
            when ms.candidate_count>1 then 'Manual-rate ambiguity blocks all fallback resolution.'
            when ms.candidate_count=1 and ms.rate_origin='VENDOR_RATE_BOOK' then 'Resolved from governed manual-rate record originating from the vendor rate book.'
            when ms.candidate_count=1 then 'Resolved from governed manual-rate entry.'
            when ps.selected_purchase_fact_id is not null then format('Resolved latest qualifying purchase fact %s dated %s.',ps.selected_purchase_fact_id,ps.rate_date)
            when ss.valuation_source is not null then format('Resolved %s valuation dated %s using governed source priority %s.',ss.valuation_source,ss.valuation_date,ss.valuation_source_priority)
            else 'Material rate could not be resolved.' end
from requested_items ri
join zero_summary zs on zs.stock_item_id=ri.stock_item_id
join manual_summary ms on ms.stock_item_id=ri.stock_item_id
join purchase_summary ps on ps.stock_item_id=ri.stock_item_id
join stock_summary ss on ss.stock_item_id=ri.stock_item_id
join public.inv_stock_item sic on sic.id=ri.stock_item_id
order by ri.stock_item_id;
$function$;