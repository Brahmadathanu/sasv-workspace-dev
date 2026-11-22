-- PEC S5 candidate C: common read-only procurement planning RPC, NOT production-installed.
-- Dependencies: candidate A's v_mrp_material_gross_requirement_ind and governed plan table.
-- The two supported methods: plan, hybrid.  comparison flag is informational only.
-- 1 RM normal, 1 RM jit, 2 PM, 5 IND. Existing hybrid and JIT exact route delegates
-- preserve all current default quantity semantics; new routes use class-specific gates.

CREATE OR REPLACE FUNCTION public.proc_pec_s5_unified_plan(
  p_start date,p_end date,p_class integer,p_rm_scope text,
  p_method text,p_compare_history boolean DEFAULT true
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public AS $fn$
DECLARE
  v_month date := date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_h integer;
  v_scope text := coalesce(nullif(btrim(p_rm_scope),''),'normal');
  v_method text := lower(coalesce(nullif(btrim(p_method),''),''));
  v_cmp boolean := coalesce(p_compare_history,false);
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_start IS NULL OR p_end IS NULL
    OR p_start<>date_trunc('month',p_start)::date
    OR p_end<>date_trunc('month',p_end)::date
    OR p_end < p_start
    OR p_start < (v_month - interval '1 month')::date
    OR p_start > (v_month + interval '12 months')::date
    OR p_class NOT IN (1,2,5)
    OR v_method NOT IN ('plan','hybrid')
    OR (p_class=1 AND v_scope NOT IN ('normal','jit','all'))
    OR (p_class<>1 AND v_scope<>'normal')
  THEN RAISE EXCEPTION 'Invalid S5 class, route, method or planning horizon'; END IF;
  v_h := (12*extract(year from age(p_end,p_start))
    +extract(month from age(p_end,p_start))+1)::integer;
  IF v_h NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'S5 planning horizon must be 1–6 months';
  END IF;

  -- RM All is a genuine per-item split, not a blanket JIT exemption.
  IF p_class=1 AND v_scope='all' THEN
    RETURN QUERY SELECT x
      FROM public.proc_pec_s5_unified_plan(p_start,p_end,1,'normal',v_method,v_cmp) x;
    RETURN QUERY SELECT x
      FROM public.proc_pec_s5_unified_plan(p_start,p_end,1,'jit',v_method,v_cmp) x;
    RETURN;
  END IF;

  -- Exact baseline hybrid for RM Normal and PM: preserve the approved S4 source
  -- and frozen formula; history remains mandatory evidence even when an
  -- independent supplementary comparison control is switched OFF.
  IF p_class IN (1,2) AND v_method='hybrid' AND (p_class=2 OR v_scope='normal') THEN
    RETURN QUERY
    SELECT x || jsonb_build_object(
      'method','hybrid','planning_method','plan_plus_consumption',
      'history_comparison',v_cmp,'source','s4_hybrid',
      'material_scope',v_scope)
    FROM public.proc_pec_s4_new_pr_plan(p_start,p_end,p_class,v_scope) x;
    RETURN;
  END IF;

  -- Exact JIT plan-only route: mature, performance-fixed materialized indent balance.
  IF p_class=1 AND v_scope='jit' AND v_method='plan' THEN
    RETURN QUERY
    SELECT x || jsonb_build_object(
      'method','plan','planning_method','planned_demand',
      'history_comparison',v_cmp,'source','jit_mrp',
      'material_scope','jit')
    FROM public.proc_pec_jit_mrp_plan(p_start,p_end,v_cmp) x;
    RETURN;
  END IF;

  -- New RM Normal / PM plan-only route.  MRP.procure_qty already includes the
  -- MRP stock netting. Never deduct current stock a second time.
  IF p_class IN (1,2) AND v_method='plan' THEN
    RETURN QUERY
    WITH mrp AS MATERIALIZED (
      SELECT p.material_class_id::bigint class_id,p.stock_item_id,p.uom_id,
        sum(p.procure_qty)::numeric mrp_net,count(*)::integer mrp_months
      FROM public.v_mrp_procurement_plan p
      JOIN public.inv_stock_item si ON si.id=p.stock_item_id
      JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=p.stock_item_id
      WHERE p.month_start BETWEEN p_start AND p_end AND c.active
        AND p.material_class_id=p_class
        AND (p_class<>1 OR c.subcategory_code NOT IN
          ('finished_bulk_material','semifinished_goods'))
        AND (p_class<>1 OR si.rm_procurement_mode IS DISTINCT FROM 'jit_procured')
      GROUP BY 1,2,3
    ), stock AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
        count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN (SELECT DISTINCT stock_item_id FROM mrp) m ON m.stock_item_id=s.inv_stock_item_id
      GROUP BY 1
    ), indent AS MATERIALIZED (
      SELECT i.material_class_id class_id,i.stock_item_id,i.uom_id,
        sum(greatest(0,i.remaining_qty)) outstanding,
        count(*) FILTER (WHERE i.remaining_qty>0) open_lines
      FROM public.v_proc_indent_line_balance i
      WHERE i.material_class_id=p_class
      GROUP BY 1,2,3
    ), moq AS (
      SELECT q.stock_item_id,q.uom_id,count(*) policies,max(q.moq_qty) moq_qty
      FROM public.inv_stock_item_moq_policy q
      JOIN mrp m ON m.stock_item_id=q.stock_item_id AND m.uom_id=q.uom_id
      WHERE q.is_active AND (q.effective_from IS NULL OR q.effective_from<=v_today)
        AND (q.effective_to IS NULL OR q.effective_to>=v_today)
      GROUP BY 1,2
    ), x AS (
      SELECT m.*,si.name item_name,si.default_uom_id,u.code uom_code,
        s.stock_qty,s.source_count,s.source_kind,
        coalesce(i.outstanding,0) outstanding,
        coalesce(i.open_lines,0) open_lines,
        coalesce(q.policies,0) policies,q.moq_qty,
        CASE WHEN p_class=1 THEN (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot)
             ELSE (SELECT max(as_of_date) FROM public.tally_plm_stock_snapshot) END stock_as_of
      FROM mrp m JOIN public.inv_stock_item si ON si.id=m.stock_item_id
      LEFT JOIN public.inv_uom u ON u.id=m.uom_id
      LEFT JOIN stock s ON s.item_id=m.stock_item_id
      LEFT JOIN indent i ON i.class_id=m.class_id AND i.stock_item_id=m.stock_item_id AND i.uom_id=m.uom_id
      LEFT JOIN moq q ON q.stock_item_id=m.stock_item_id AND q.uom_id=m.uom_id
    ), y AS (
      SELECT x.*,greatest(0,mrp_net-outstanding) net_after_indent,
        CASE
         WHEN stock_qty IS NULL OR source_count<>1
           OR source_kind<>CASE WHEN p_class=1 THEN 'rm' ELSE 'plm' END
           THEN 'STOCK_MAPPING_REVIEW'
         WHEN stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today
           THEN 'STALE_STOCK_REVIEW'
         WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
         WHEN default_uom_id IS DISTINCT FROM uom_id OR uom_code IS NULL
           THEN 'UOM_REVIEW'
         WHEN policies>1 OR (moq_qty IS NOT NULL AND moq_qty<=0)
           OR (uom_code='Nos' AND moq_qty IS NOT NULL AND moq_qty<>ceil(moq_qty))
           THEN 'MOQ_POLICY_REVIEW'
         WHEN mrp_months<>v_h THEN 'MRP_HORIZON_REVIEW'
         WHEN mrp_net<0 THEN 'MRP_QUANTITY_REVIEW'
         ELSE 'AUTO_ELIGIBLE' END gate
      FROM x
    )
    SELECT jsonb_build_object(
      'mode','s5_unified','method','plan','planning_method','planned_demand',
      'history_comparison',v_cmp,'source','mrp_view',
      'material_scope',v_scope,'material_class_id',class_id,
      'stock_item_id',stock_item_id,'stock_item_name',item_name,
      'uom_id',uom_id,'uom_code',uom_code,
      'mrp_net_qty',mrp_net,'mrp_months',mrp_months,'coverage_months',v_h,
      'stock_qty',stock_qty,'stock_as_of',stock_as_of,
      'outstanding_indent_qty',outstanding,'outstanding_indent_lines',open_lines,
      'net_after_indent',net_after_indent,'moq_qty',moq_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
          WHEN moq_qty>0 THEN ceil(net_after_indent/moq_qty)*moq_qty
          WHEN uom_code='Nos' THEN ceil(net_after_indent)
          ELSE net_after_indent END,
      'consumption_only',false,'stock_netted_by','v_mrp_procurement_plan'
    ) FROM y ORDER BY item_name,stock_item_id;
    RETURN;
  END IF;

  -- JIT hybrid is permitted only when explicitly chosen. History can increase
  -- demand, but missing stock is allowed solely for this true JIT class.
  -- JIT items with actual mapped stock use that stock for the history alternative.
  IF p_class=1 AND v_scope='jit' AND v_method='hybrid' THEN
    RETURN QUERY
    WITH j AS MATERIALIZED (
      SELECT x AS obj FROM public.proc_pec_jit_mrp_plan(p_start,p_end,true) x
    ), st AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
         count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN (SELECT DISTINCT (obj->>'stock_item_id')::bigint AS id FROM j) k
        ON k.id=s.inv_stock_item_id
      GROUP BY 1
    ), x AS (
      SELECT j.obj,(j.obj->>'stock_item_id')::bigint item_id,
        (j.obj->>'mrp_net_qty')::numeric mrp_net,
        coalesce((j.obj->>'period_consumption')::numeric,0) consumption,
        coalesce((j.obj->>'outstanding_indent_qty')::numeric,0) outstanding,
        (j.obj->>'moq_qty')::numeric moq_qty,j.obj->>'uom_code' uom_code,
        j.obj->>'gate' original_gate,st.stock_qty,st.source_count,st.source_kind,
        (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot) stock_as_of
      FROM j LEFT JOIN st ON st.item_id=(j.obj->>'stock_item_id')::bigint
    ), y AS (
      SELECT x.*,greatest(0,consumption-coalesce(stock_qty,0)) usage_stock_net,
        CASE
        WHEN source_count IS NOT NULL AND
          (source_count<>1 OR source_kind<>'rm') THEN 'STOCK_MAPPING_REVIEW'
        WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
        WHEN stock_qty IS NOT NULL AND
          (stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today)
          THEN 'STALE_STOCK_REVIEW'
        ELSE original_gate END gate
      FROM x
    ), z AS (
      SELECT y.*,greatest(0,greatest(mrp_net,usage_stock_net)-outstanding) net_qty
      FROM y
    )
    SELECT obj || jsonb_build_object(
      'method','hybrid','planning_method','plan_plus_consumption',
      'history_comparison',v_cmp,'consumption_comparison',v_cmp,
      'source','jit_mrp_plus_history',
      'material_scope','jit',
      'stock_qty',stock_qty,'stock_as_of',stock_as_of,
      'stock_netted_consumption',usage_stock_net,
      'net_after_indent',net_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
         WHEN moq_qty>0 THEN ceil(net_qty/moq_qty)*moq_qty
         WHEN uom_code='Nos' THEN ceil(net_qty)
         ELSE net_qty END)
    FROM z ORDER BY obj->>'stock_item_name',item_id;

    -- In explicitly selected hybrid mode, JIT consumption-only materials may
    -- also enter the preview, but only with documented 12-month history and
    -- class/UOM/MOQ/indent safeguards. JIT PLAN mode never includes these.
    RETURN QUERY
    WITH usage AS MATERIALIZED (
      SELECT c.inv_stock_item_id item_id,
        sum(c.total_consumed_qty)::numeric used12,
        count(*) FILTER(WHERE c.total_consumed_qty>0)::integer positive_months
      FROM public.v_item_consumption_monthly_by_item c
      JOIN public.inv_stock_item si ON si.id=c.inv_stock_item_id
      JOIN public.v_inv_stock_item_with_class cat ON cat.stock_item_id=si.id
      WHERE si.active AND cat.active AND cat.category_id=1
        AND si.rm_procurement_mode='jit_procured'
        AND cat.subcategory_code NOT IN
          ('finished_bulk_material','semifinished_goods')
        AND c.month_start_date>=(v_month-interval '12 months')::date
        AND c.month_start_date<v_month
      GROUP BY 1
      HAVING sum(c.total_consumed_qty)>0
    ), planned_jit_ids AS MATERIALIZED (
      SELECT DISTINCT p.stock_item_id
      FROM public.v_mrp_procurement_plan p
      WHERE p.material_class_id=1 AND p.month_start BETWEEN p_start AND p_end
    ), k AS MATERIALIZED (
      SELECT u.*,si.name item_name,si.default_uom_id uom_id,
        uv.code uom_code,u.used12/12*v_h period_usage
      FROM usage u
      JOIN public.inv_stock_item si ON si.id=u.item_id
      LEFT JOIN public.inv_uom uv ON uv.id=si.default_uom_id
      LEFT JOIN planned_jit_ids p ON p.stock_item_id=u.item_id
      WHERE p.stock_item_id IS NULL
    ), st AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
         count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN k ON k.item_id=s.inv_stock_item_id GROUP BY 1
    ), ib AS MATERIALIZED (
      SELECT i.stock_item_id item_id,i.uom_id,
        sum(greatest(0,i.remaining_qty)) outstanding,
        count(*) FILTER(WHERE i.remaining_qty>0) open_lines
      FROM public.v_proc_indent_line_balance i
      WHERE i.material_class_id=1 GROUP BY 1,2
    ), mq AS MATERIALIZED (
      SELECT m.stock_item_id item_id,m.uom_id,
        count(*) policies,max(m.moq_qty) moq_qty
      FROM public.inv_stock_item_moq_policy m
      JOIN k ON k.item_id=m.stock_item_id AND k.uom_id=m.uom_id
      WHERE m.is_active AND (m.effective_from IS NULL OR m.effective_from<=v_today)
        AND (m.effective_to IS NULL OR m.effective_to>=v_today)
      GROUP BY 1,2
    ), x AS (
      SELECT k.*,s.stock_qty,s.source_count,s.source_kind,
        coalesce(i.outstanding,0) outstanding,coalesce(i.open_lines,0) open_lines,
        coalesce(m.policies,0) policies,m.moq_qty,
        (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot) stock_as_of
      FROM k LEFT JOIN st s ON s.item_id=k.item_id
      LEFT JOIN ib i ON i.item_id=k.item_id AND i.uom_id=k.uom_id
      LEFT JOIN mq m ON m.item_id=k.item_id AND m.uom_id=k.uom_id
    ), y AS (
      SELECT x.*,greatest(0,period_usage-coalesce(stock_qty,0)) usage_net,
        CASE
         WHEN source_count IS NOT NULL AND
           (source_count<>1 OR source_kind<>'rm') THEN 'STOCK_MAPPING_REVIEW'
         WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
         WHEN stock_qty IS NOT NULL AND
           (stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today)
           THEN 'STALE_STOCK_REVIEW'
         WHEN uom_code IS NULL THEN 'UOM_REVIEW'
         WHEN policies>1 OR (moq_qty IS NOT NULL AND moq_qty<=0)
           OR (uom_code='Nos' AND moq_qty IS NOT NULL AND moq_qty<>ceil(moq_qty))
           THEN 'MOQ_POLICY_REVIEW'
         ELSE 'AUTO_ELIGIBLE' END gate
      FROM x
    ), z AS (
      SELECT y.*,greatest(0,usage_net-outstanding) net_after_indent FROM y
    )
    SELECT jsonb_build_object(
      'mode','s5_unified','method','hybrid','planning_method','plan_plus_consumption',
      'history_comparison',v_cmp,'consumption_comparison',v_cmp,
      'source','jit_history_only','material_scope','jit',
      'material_class_id',1,'stock_item_id',item_id,
      'stock_item_name',item_name,'uom_id',uom_id,'uom_code',uom_code,
      'mrp_net_qty',0,'mrp_months',0,'coverage_months',v_h,
      'usage_12m',used12,'positive_months',positive_months,
      'period_consumption',period_usage,'stock_qty',stock_qty,
      'stock_as_of',stock_as_of,'stock_netted_consumption',usage_net,
      'outstanding_indent_qty',outstanding,'outstanding_indent_lines',open_lines,
      'net_after_indent',net_after_indent,'moq_qty',moq_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
          WHEN moq_qty>0 THEN ceil(net_after_indent/moq_qty)*moq_qty
          WHEN uom_code='Nos' THEN ceil(net_after_indent)
          ELSE net_after_indent END,
      'consumption_only',true
    ) FROM z ORDER BY item_name,item_id;
    RETURN;
  END IF;

  -- IND is NOT production-BOM-based MRP. Its explicit monthly operational plan
  -- is a separate namesake view, and consumption is an independent forecast.
  IF p_class=5 THEN
    RETURN QUERY
    WITH candidates AS MATERIALIZED (
      SELECT si.id item_id,si.name item_name,si.default_uom_id uom_id,
        u.code uom_code
      FROM public.inv_stock_item si
      JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=si.id
      LEFT JOIN public.inv_uom u ON u.id=si.default_uom_id
      WHERE si.active AND c.active AND c.category_id=5
    ), plans AS MATERIALIZED (
      SELECT p.stock_item_id item_id,p.uom_id,
        sum(p.gross_required_qty) planned_gross,count(*)::integer plan_months
      FROM public.v_mrp_material_gross_requirement_ind p
      WHERE p.month_start BETWEEN p_start AND p_end
      GROUP BY 1,2
    ), history AS MATERIALIZED (
      SELECT u.inv_stock_item_id item_id,sum(u.total_consumed_qty)::numeric used12,
        count(*) FILTER(WHERE u.total_consumed_qty>0)::integer positive_months
      FROM public.v_item_consumption_monthly_by_item u
      JOIN candidates c ON c.item_id=u.inv_stock_item_id
      WHERE u.month_start_date>=(v_month-interval '12 months')::date
        AND u.month_start_date<v_month
        AND u.source_kind='consumable'
      GROUP BY 1
    ), stock AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
        count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN candidates c ON c.item_id=s.inv_stock_item_id
      GROUP BY 1
    ), indent AS MATERIALIZED (
      SELECT i.stock_item_id item_id,i.uom_id,
        sum(greatest(0,i.remaining_qty)) outstanding,
        count(*) FILTER(WHERE i.remaining_qty>0) open_lines
      FROM public.v_proc_indent_line_balance i
      WHERE i.material_class_id=5 GROUP BY 1,2
    ), moq AS MATERIALIZED (
      SELECT p.stock_item_id item_id,p.uom_id,count(*) policies,max(p.moq_qty) moq_qty
      FROM public.inv_stock_item_moq_policy p
      JOIN candidates c ON c.item_id=p.stock_item_id AND c.uom_id=p.uom_id
      WHERE p.is_active AND (p.effective_from IS NULL OR p.effective_from<=v_today)
        AND (p.effective_to IS NULL OR p.effective_to>=v_today)
      GROUP BY 1,2
    ), x AS (
      SELECT c.*,p.planned_gross,p.plan_months,p.uom_id planned_uom,
        h.used12,h.positive_months,
        coalesce(h.used12,0)/12*v_h usage_projected,
        s.stock_qty,s.source_count,s.source_kind,
        CASE WHEN s.source_kind='fuel'
          THEN (SELECT max(as_of_date) FROM public.tally_fuel_stock_snapshot)
          ELSE (SELECT max(as_of_date) FROM public.tally_consumables_stock_snapshot) END stock_as_of,
        coalesce(i.outstanding,0) outstanding,coalesce(i.open_lines,0) open_lines,
        coalesce(m.policies,0) policies,m.moq_qty
      FROM candidates c
      LEFT JOIN plans p ON p.item_id=c.item_id
      LEFT JOIN history h ON h.item_id=c.item_id
      LEFT JOIN stock s ON s.item_id=c.item_id
      LEFT JOIN indent i ON i.item_id=c.item_id AND i.uom_id=c.uom_id
      LEFT JOIN moq m ON m.item_id=c.item_id AND m.uom_id=c.uom_id
      WHERE p.item_id IS NOT NULL OR (v_method='hybrid' AND coalesce(h.used12,0)>0)
    ), y AS (
      SELECT x.*,greatest(0,coalesce(planned_gross,0)-coalesce(stock_qty,0)) plan_stock_net,
        greatest(0,usage_projected-coalesce(stock_qty,0)) history_stock_net,
        CASE
         WHEN stock_qty IS NULL OR source_count<>1
           OR source_kind NOT IN ('consumable','fuel') THEN 'STOCK_MAPPING_REVIEW'
         WHEN stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today
           THEN 'STALE_STOCK_REVIEW'
         WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
         WHEN uom_code IS NULL OR
           (planned_uom IS NOT NULL AND planned_uom IS DISTINCT FROM uom_id)
           THEN 'UOM_REVIEW'
         WHEN policies>1 OR (moq_qty IS NOT NULL AND moq_qty<=0)
           OR (uom_code='Nos' AND moq_qty IS NOT NULL AND moq_qty<>ceil(moq_qty))
           THEN 'MOQ_POLICY_REVIEW'
         WHEN v_method='plan' AND coalesce(plan_months,0)<>v_h
           THEN 'IND_PLAN_HORIZON_REVIEW'
         WHEN v_method='hybrid' AND coalesce(used12,0)=0
           AND coalesce(plan_months,0)<>v_h
           THEN 'IND_DEMAND_SOURCE_REVIEW'
         ELSE 'AUTO_ELIGIBLE' END gate
      FROM x
    ), z AS (
      SELECT y.*,greatest(0,
        CASE WHEN v_method='plan' THEN plan_stock_net
        ELSE greatest(plan_stock_net,history_stock_net) END - outstanding
      ) net_after_indent
      FROM y
    )
    SELECT jsonb_build_object(
      'mode','s5_unified','method',v_method,'planning_method',
          CASE WHEN v_method='plan' THEN 'operational_plan' ELSE 'plan_plus_consumption' END,
      'history_comparison',v_cmp,'source','ind_operational_plan_plus_optional_history',
      'material_scope','normal','material_class_id',5,
      'stock_item_id',item_id,'stock_item_name',item_name,
      'uom_id',uom_id,'uom_code',uom_code,
      'mrp_net_qty',plan_stock_net,'planned_gross_qty',planned_gross,
      'plan_months',coalesce(plan_months,0),'coverage_months',v_h,
      'usage_12m',used12,'positive_months',coalesce(positive_months,0),
      'period_consumption',CASE WHEN v_method='hybrid' OR v_cmp THEN usage_projected END,
      'stock_qty',stock_qty,'stock_as_of',stock_as_of,
      'stock_netted_consumption',CASE WHEN v_method='hybrid' OR v_cmp THEN history_stock_net END,
      'outstanding_indent_qty',outstanding,'outstanding_indent_lines',open_lines,
      'net_after_indent',net_after_indent,'moq_qty',moq_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
        WHEN moq_qty>0 THEN ceil(net_after_indent/moq_qty)*moq_qty
        WHEN uom_code='Nos' THEN ceil(net_after_indent)
        ELSE net_after_indent END,
      'consumption_only',planned_gross IS NULL,
      'demand_source',CASE WHEN planned_gross IS NULL THEN 'historical_forecast'
          ELSE 'operator_plan' END
    ) FROM z ORDER BY item_name,item_id;
    RETURN;
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s5_unified_plan(date,date,integer,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s5_unified_plan(date,date,integer,text,text,boolean)
 TO authenticated;
