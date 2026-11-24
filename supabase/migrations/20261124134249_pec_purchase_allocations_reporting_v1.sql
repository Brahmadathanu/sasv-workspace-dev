create function public._proc_pec_pa_report(p_mode text, p_date_from date, p_date_to date, p_material_class_code text default null, p_q text default null, p_indent_q text default null, p_vendor_q text default null, p_status text default 'all', p_limit integer default 50, p_offset integer default 0, p_indent_id bigint default null, p_stock_item_id bigint default null, p_uom_id bigint default null, p_vendor_key text default null, p_purchase_fact_id bigint default null)
returns table(row_data jsonb,total_count bigint)
language plpgsql stable security invoker set search_path=pg_catalog,public,pg_temp as $fn$
begin
 if p_mode not in ('summary','indent','material','vendor','trail') or p_mode is null then raise exception 'Invalid report mode' using errcode='22023'; end if;
 if p_date_from is null or p_date_to is null or p_date_from>p_date_to then raise exception 'Invalid voucher date range' using errcode='22023'; end if;
 if p_status is null or p_status not in ('all','allocated','partial','unallocated') then raise exception 'Invalid allocation status' using errcode='22023'; end if;
 if p_material_class_code is not null and upper(btrim(p_material_class_code)) not in ('RM','PM','PLM','IND') then raise exception 'Invalid material class' using errcode='22023'; end if;
 if p_limit is null or p_limit not between 1 and 200 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Invalid paging' using errcode='22023'; end if;
 return query
 with a as materialized (
   select x.* from public.v_proc_indent_fifo_allocation x
 ), ar as (
   select x.purchase_fact_id,sum(x.allocated_qty) as allocated_qty from a x group by 1
 ), ac as (
   select x.purchase_fact_id,sum(x.accepted_qty) accepted_qty from public.proc_indent_excess_acceptance x group by 1
 ), receipts as materialized (
   select e.purchase_fact_id,e.voucher_date,
      case when v.vendor_id is not null then 'vendor:'||v.vendor_id::text else 'supplier:'||coalesce(v.supplier_name,'') end vendor_key,
      v.vendor_id,coalesce(v.supplier_name,'') supplier_name,
      e.material_class_id,c.code material_class_code,e.stock_item_id,i.name stock_item_name,e.uom_id,u.code uom_code,
      e.purchase_qty gross_qty,e.net_qty effective_qty,coalesce(ar.allocated_qty,0) allocated_qty,
      e.net_qty-coalesce(ar.allocated_qty,0) unallocated_qty,coalesce(ac.accepted_qty,0) accepted_qty,
      e.net_qty-coalesce(ar.allocated_qty,0)-coalesce(ac.accepted_qty,0) net_unallocated_qty
   from public.v_proc_fifo_effective_receipts e
   join public.v_proc_purchase_fact_with_vendor v using(purchase_fact_id)
   join public.inv_class_category c on c.id=e.material_class_id
   join public.inv_stock_item i on i.id=e.stock_item_id
   join public.inv_uom u on u.id=e.uom_id
   left join ar using(purchase_fact_id) left join ac using(purchase_fact_id)
   where e.voucher_date between p_date_from and p_date_to
     and (p_material_class_code is null or c.code=case when upper(btrim(p_material_class_code))='PLM' then 'PM' else upper(btrim(p_material_class_code)) end)
     and (nullif(btrim(p_q),'') is null or strpos(lower(i.name),lower(btrim(p_q)))>0 or strpos(lower(i.code),lower(btrim(p_q)))>0)
     and (nullif(btrim(p_vendor_q),'') is null or strpos(lower(coalesce(v.supplier_name,'')),lower(btrim(p_vendor_q)))>0)
     and (p_stock_item_id is null or e.stock_item_id=p_stock_item_id)
     and (p_uom_id is null or e.uom_id=p_uom_id)
     and (p_purchase_fact_id is null or e.purchase_fact_id=p_purchase_fact_id)
     and (p_vendor_key is null or p_vendor_key=case when v.vendor_id is not null then 'vendor:'||v.vendor_id::text else 'supplier:'||coalesce(v.supplier_name,'') end)
     and (p_status='all' or (e.net_qty>0 and ((p_status='allocated' and coalesce(ar.allocated_qty,0)=e.net_qty) or (p_status='partial' and coalesce(ar.allocated_qty,0)>0 and coalesce(ar.allocated_qty,0)<e.net_qty) or (p_status='unallocated' and coalesce(ar.allocated_qty,0)=0))))
 ), am as materialized (
   select x.* from a x join receipts z using(purchase_fact_id)
   where (nullif(btrim(p_indent_q),'') is null or strpos(lower(x.indent_number),lower(btrim(p_indent_q)))>0)
     and (p_indent_id is null or x.indent_id=p_indent_id)
 ), amr as (
   select x.purchase_fact_id,sum(x.allocated_qty) matching_allocated_qty from am x group by 1
 ), r as materialized (
   select z.*,coalesce(amr.matching_allocated_qty,0) matching_allocated_qty
   from receipts z left join amr using(purchase_fact_id)
   where (nullif(btrim(p_indent_q),'') is null and p_indent_id is null) or amr.purchase_fact_id is not null
 ), totals as (
   select r.vendor_key,r.uom_id,r.uom_code,sum(r.gross_qty) as gross_qty,
sum(r.effective_qty) as effective_qty,
sum(r.allocated_qty) as allocated_qty,
sum(r.matching_allocated_qty) as matching_allocated_qty,
sum(r.unallocated_qty) as unallocated_qty,
sum(r.accepted_qty) as accepted_qty,
sum(r.net_unallocated_qty) as net_unallocated_qty
   from r where p_mode in ('summary','vendor')
   group by grouping sets ((r.uom_id,r.uom_code),(r.vendor_key,r.uom_id,r.uom_code))
 ), it as (
   select x.indent_id,x.uom_id,z.uom_code,sum(x.allocated_qty) allocated_qty
   from am x join r z using(purchase_fact_id)
   where p_mode='indent' group by 1,2,3
 ), ig as (
   select x.indent_id,x.indent_number,x.approved_date,count(distinct x.indent_line_id) material_line_count
   from am x where p_mode='indent' group by 1,2,3
 ), mg as (
   select r.material_class_id,r.material_class_code,r.stock_item_id,r.stock_item_name,r.uom_id,r.uom_code,count(*) purchase_fact_count,sum(r.gross_qty) as gross_qty,
sum(r.effective_qty) as effective_qty,
sum(r.allocated_qty) as allocated_qty,
sum(r.matching_allocated_qty) as matching_allocated_qty,
sum(r.unallocated_qty) as unallocated_qty,
sum(r.accepted_qty) as accepted_qty,
sum(r.net_unallocated_qty) as net_unallocated_qty
   from r where p_mode='material' group by 1,2,3,4,5,6
 ), vg as (
   select r.vendor_key,r.vendor_id,min(r.supplier_name) supplier_name,count(distinct (r.material_class_id,r.stock_item_id,r.uom_id)) material_count,count(*) purchase_fact_count
   from r where p_mode='vendor' group by 1,2
 ), relevant_lines as (
   select distinct x.indent_line_id from am x where p_mode='trail'
 ), ba as (
   select x.indent_line_id,
     coalesce(sum(x.allocated_qty) filter(where x.voucher_date<p_date_from),0) before_qty,
     coalesce(sum(x.allocated_qty) filter(where x.voucher_date between p_date_from and p_date_to),0) period_qty,
     coalesce(sum(x.allocated_qty) filter(where x.voucher_date<=p_date_to),0) through_qty
   from a x join relevant_lines l using(indent_line_id) group by 1
 ), b as (
   select l.indent_id,l.indent_number,l.indent_line_id,l.indent_line_sort_no,l.approved_date,l.requested_qty,
     case when l.approved_date<p_date_from then l.requested_qty-coalesce(ba.before_qty,0) else 0 end opening_balance,
     case when l.approved_date between p_date_from and p_date_to then l.requested_qty else 0 end period_new_demand_qty,
     coalesce(ba.period_qty,0) period_allocated_qty,
     case when l.approved_date<=p_date_to then l.requested_qty-coalesce(ba.through_qty,0) else 0 end closing_balance,
     l.remaining_qty current_balance
   from public.v_proc_indent_lines_console_ordered l join relevant_lines rl using(indent_line_id) left join ba using(indent_line_id)
 ), rows_out as (
   select jsonb_build_object('date_from',p_date_from,'date_to',p_date_to,
      'purchase_fact_count',(select count(*) from r),
      'affected_indent_count',(select count(distinct x.indent_id) from am x),
      'affected_indent_line_count',(select count(distinct x.indent_line_id) from am x),
      'totals_by_uom',coalesce((select jsonb_agg(to_jsonb(t)-'vendor_key' order by t.uom_code,t.uom_id) from totals t where t.vendor_key is null),'[]'::jsonb),
      'coverage','Positive purchase facts, including fully returned receipts; allocations cover currently approved and issued indents.',
      'balance_basis','Opening and closing balances are reconstructed under current FIFO and governed requirements; current balance is live. Receipt return adjustments may restate earlier periods.') j,
      null::numeric sn,null::text st,null::bigint ss,null::date sd,null::bigint si,null::bigint tie,null::bigint tie2
   where p_mode='summary'
   union all
   select to_jsonb(g)||jsonb_build_object('totals_by_uom',coalesce((select jsonb_agg(to_jsonb(t)-'indent_id' order by t.uom_code,t.uom_id) from it t where t.indent_id=g.indent_id),'[]'::jsonb)),
      case when g.indent_number ~ '^[0-9]+$' then g.indent_number::numeric end,g.indent_number,null,null,g.indent_id,null,null from ig g
   union all
   select to_jsonb(g),null,lower(g.stock_item_name),g.material_class_id,null,g.stock_item_id,g.uom_id,null from mg g
   union all
   select to_jsonb(g)||jsonb_build_object('totals_by_uom',coalesce((select jsonb_agg(to_jsonb(t)-'vendor_key' order by t.uom_code,t.uom_id) from totals t where t.vendor_key=g.vendor_key),'[]'::jsonb)),
      null,lower(g.supplier_name),null,null,null,null,null from vg g
   union all
   select jsonb_build_object('purchase_fact_id',r.purchase_fact_id,'voucher_date',r.voucher_date,'vendor_key',r.vendor_key,'vendor_id',r.vendor_id,'supplier_name',r.supplier_name,'material_class_id',r.material_class_id,'material_class_code',r.material_class_code,'stock_item_id',r.stock_item_id,'stock_item_name',r.stock_item_name,'uom_id',r.uom_id,'uom_code',r.uom_code,'gross_qty',r.gross_qty,'effective_qty',r.effective_qty,'unallocated_qty',r.unallocated_qty,'accepted_qty',r.accepted_qty,'net_unallocated_qty',r.net_unallocated_qty,'receipt_allocated_qty',r.allocated_qty,'indent_id',b.indent_id,'indent_number',b.indent_number,'indent_line_id',b.indent_line_id,'indent_line_sort_no',b.indent_line_sort_no,'approved_date',b.approved_date,'requested_qty',b.requested_qty,'opening_balance',b.opening_balance,'period_new_demand_qty',b.period_new_demand_qty,'period_allocated_qty',b.period_allocated_qty,'closing_balance',b.closing_balance,'current_balance',b.current_balance,'allocated_qty',x.allocated_qty,'row_kind','allocation'),
      case when b.indent_number ~ '^[0-9]+$' then b.indent_number::numeric end,b.indent_number,b.indent_line_sort_no,r.voucher_date,r.purchase_fact_id,b.indent_line_id,null
   from am x join r using(purchase_fact_id) join b using(indent_line_id) where p_mode='trail'
   union all
   select jsonb_build_object('purchase_fact_id',r.purchase_fact_id,'voucher_date',r.voucher_date,'vendor_key',r.vendor_key,'vendor_id',r.vendor_id,'supplier_name',r.supplier_name,'material_class_id',r.material_class_id,'material_class_code',r.material_class_code,'stock_item_id',r.stock_item_id,'stock_item_name',r.stock_item_name,'uom_id',r.uom_id,'uom_code',r.uom_code,'gross_qty',r.gross_qty,'effective_qty',r.effective_qty,'unallocated_qty',r.unallocated_qty,'accepted_qty',r.accepted_qty,'net_unallocated_qty',r.net_unallocated_qty,'receipt_allocated_qty',r.allocated_qty,'indent_id',null,'indent_number',null,'indent_line_id',null,'indent_line_sort_no',null,'approved_date',null,'requested_qty',null,'opening_balance',null,'period_new_demand_qty',null,'period_allocated_qty',null,'closing_balance',null,'current_balance',null,'allocated_qty',null,'row_kind','unallocated'),
      null,null,null,r.voucher_date,r.purchase_fact_id,null,null
   from r where p_mode='trail' and (r.unallocated_qty>0 or r.effective_qty=0) and nullif(btrim(p_indent_q),'') is null and p_indent_id is null
 )
 select z.j,count(*) over() from rows_out z
 order by z.sn nulls last,z.st nulls last,z.ss nulls last,z.sd nulls last,z.si nulls last,z.tie nulls last,z.tie2 nulls last,z.j->>'vendor_key'
 limit p_limit offset p_offset;
end
$fn$;
revoke all on function public._proc_pec_pa_report(text,date,date,text,text,text,text,text,integer,integer,bigint,bigint,bigint,text,bigint) from public,anon,authenticated,service_role;
create function public.proc_pec_purchase_alloc_summary(p_date_from date, p_date_to date, p_material_class_code text default null, p_q text default null, p_indent_q text default null, p_vendor_q text default null, p_status text default 'all')
 returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $fn$
 begin
 perform public.require_permission('module:procurement-execution-console',false);
 return (select q.row_data from public._proc_pec_pa_report('summary',p_date_from,p_date_to,p_material_class_code,p_q,p_indent_q,p_vendor_q,p_status,1,0) q);
 end $fn$;
 revoke all on function public.proc_pec_purchase_alloc_summary(date,date,text,text,text,text,text) from public,anon,authenticated,service_role;
 grant execute on function public.proc_pec_purchase_alloc_summary(date,date,text,text,text,text,text) to authenticated,service_role;
create function public.proc_pec_purchase_alloc_indent_paged(p_date_from date, p_date_to date, p_material_class_code text default null, p_q text default null, p_indent_q text default null, p_vendor_q text default null, p_status text default 'all', p_limit integer default 50, p_offset integer default 0)
 returns table(row_data jsonb,total_count bigint)
 language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $fn$
 begin
 perform public.require_permission('module:procurement-execution-console',false);
 return query select q.row_data,q.total_count from public._proc_pec_pa_report('indent',p_date_from,p_date_to,p_material_class_code,p_q,p_indent_q,p_vendor_q,p_status,p_limit,p_offset) q;
 end $fn$;
 revoke all on function public.proc_pec_purchase_alloc_indent_paged(date,date,text,text,text,text,text,integer,integer) from public,anon,authenticated,service_role;
 grant execute on function public.proc_pec_purchase_alloc_indent_paged(date,date,text,text,text,text,text,integer,integer) to authenticated,service_role;
create function public.proc_pec_purchase_alloc_material_paged(p_date_from date, p_date_to date, p_material_class_code text default null, p_q text default null, p_indent_q text default null, p_vendor_q text default null, p_status text default 'all', p_limit integer default 50, p_offset integer default 0)
 returns table(row_data jsonb,total_count bigint)
 language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $fn$
 begin
 perform public.require_permission('module:procurement-execution-console',false);
 return query select q.row_data,q.total_count from public._proc_pec_pa_report('material',p_date_from,p_date_to,p_material_class_code,p_q,p_indent_q,p_vendor_q,p_status,p_limit,p_offset) q;
 end $fn$;
 revoke all on function public.proc_pec_purchase_alloc_material_paged(date,date,text,text,text,text,text,integer,integer) from public,anon,authenticated,service_role;
 grant execute on function public.proc_pec_purchase_alloc_material_paged(date,date,text,text,text,text,text,integer,integer) to authenticated,service_role;
create function public.proc_pec_purchase_alloc_vendor_paged(p_date_from date, p_date_to date, p_material_class_code text default null, p_q text default null, p_indent_q text default null, p_vendor_q text default null, p_status text default 'all', p_limit integer default 50, p_offset integer default 0)
 returns table(row_data jsonb,total_count bigint)
 language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $fn$
 begin
 perform public.require_permission('module:procurement-execution-console',false);
 return query select q.row_data,q.total_count from public._proc_pec_pa_report('vendor',p_date_from,p_date_to,p_material_class_code,p_q,p_indent_q,p_vendor_q,p_status,p_limit,p_offset) q;
 end $fn$;
 revoke all on function public.proc_pec_purchase_alloc_vendor_paged(date,date,text,text,text,text,text,integer,integer) from public,anon,authenticated,service_role;
 grant execute on function public.proc_pec_purchase_alloc_vendor_paged(date,date,text,text,text,text,text,integer,integer) to authenticated,service_role;
create function public.proc_pec_purchase_alloc_trail_paged(p_date_from date, p_date_to date, p_material_class_code text default null, p_q text default null, p_indent_q text default null, p_vendor_q text default null, p_status text default 'all', p_limit integer default 50, p_offset integer default 0, p_indent_id bigint default null, p_stock_item_id bigint default null, p_uom_id bigint default null, p_vendor_key text default null, p_purchase_fact_id bigint default null)
 returns table(row_data jsonb,total_count bigint)
 language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $fn$
 begin
 perform public.require_permission('module:procurement-execution-console',false);
 return query select q.row_data,q.total_count from public._proc_pec_pa_report('trail',p_date_from,p_date_to,p_material_class_code,p_q,p_indent_q,p_vendor_q,p_status,p_limit,p_offset,p_indent_id,p_stock_item_id,p_uom_id,p_vendor_key,p_purchase_fact_id) q;
 end $fn$;
 revoke all on function public.proc_pec_purchase_alloc_trail_paged(date,date,text,text,text,text,text,integer,integer,bigint,bigint,bigint,text,bigint) from public,anon,authenticated,service_role;
 grant execute on function public.proc_pec_purchase_alloc_trail_paged(date,date,text,text,text,text,text,integer,integer,bigint,bigint,bigint,text,bigint) to authenticated,service_role;
notify pgrst, 'reload schema';