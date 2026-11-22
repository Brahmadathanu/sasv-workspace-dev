-- PEC S4 Consumption Coverage Floor (CCF) — read-only, permission-gated PR preview.
-- No purchase requisition/indent/stock data is updated. Explicitly NOT a buying approval.
-- This is a server-first, evidence-bearing Phase A surface. Writer remains separate.
-- All quantity candidates use 12 completed calendar months (zero months included).
-- Consumption originates from material issue vouchers, not an independent demand source.
CREATE OR REPLACE FUNCTION public.proc_pec_ccf_pr_preview(p_pr_id bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF NOT EXISTS (SELECT 1 FROM public.proc_pr_header WHERE pr_id=p_pr_id) THEN
    RAISE EXCEPTION 'PR not found' USING ERRCODE='P0002';
  END IF;
  RETURN QUERY
  WITH h AS (
    SELECT pr_id,pr_number,status,material_class_id,horizon_start_month,horizon_end_month,created_at,
      (12*EXTRACT(YEAR FROM age(horizon_end_month,horizon_start_month))
        +EXTRACT(MONTH FROM age(horizon_end_month,horizon_start_month))+1)::integer coverage_months
    FROM public.proc_pr_header WHERE pr_id=p_pr_id
  ), l AS (
    SELECT h.*, pl.pr_line_id,pl.stock_item_id,pl.uom_id,
       pl.system_suggested_qty,pl.requested_qty,COALESCE(pl.manual_delta_qty,0)::numeric manual_delta_qty,
       GREATEST(0,pl.requested_qty+COALESCE(pl.manual_delta_qty,0)) AS effective_qty,
       si.name item_name,si.active item_active,iu.code uom_code,iu.dimension_id
    FROM h JOIN public.proc_pr_line pl ON pl.pr_id=h.pr_id
    JOIN public.inv_stock_item si ON si.id=pl.stock_item_id
    LEFT JOIN public.inv_uom iu ON iu.id=pl.uom_id
  ), consumption AS (
    SELECT l.pr_line_id,COALESCE(sum(c.total_consumed_qty),0)::numeric issue_qty_12m,
       count(c.month_start_date) FILTER (WHERE c.total_consumed_qty>0)::integer usage_month_count,
       max(c.month_start_date) AS latest_usage_month
    FROM l LEFT JOIN public.v_item_consumption_monthly_by_item c
     ON c.inv_stock_item_id=l.stock_item_id
     AND c.month_start_date>= (l.horizon_start_month - interval '12 months')::date
     AND c.month_start_date< l.horizon_start_month
    GROUP BY l.pr_line_id
  ), stock AS (
    SELECT s.inv_stock_item_id stock_item_id,COUNT(*)::integer source_rows,
       SUM(s.qty_value)::numeric on_hand_qty,
       MAX(s.source_kind) source_kind
    FROM public.v_stock_current_by_item s
    JOIN (SELECT DISTINCT stock_item_id FROM l) q ON q.stock_item_id=s.inv_stock_item_id
    GROUP BY s.inv_stock_item_id
  ), indents AS (
    SELECT ib.material_class_id,ib.stock_item_id,ib.uom_id,
       SUM(GREATEST(0,ib.remaining_qty))::numeric outstanding_indent_qty,
       COUNT(*) FILTER (WHERE ib.remaining_qty>0)::integer outstanding_indent_lines
    FROM public.v_proc_indent_line_balance ib
    JOIN (SELECT DISTINCT material_class_id,stock_item_id,uom_id FROM l) q
      ON q.material_class_id=ib.material_class_id AND q.stock_item_id=ib.stock_item_id AND q.uom_id=ib.uom_id
    GROUP BY ib.material_class_id,ib.stock_item_id,ib.uom_id
  ), moq AS (
    SELECT m.stock_item_id,m.uom_id,COUNT(*)::integer policy_count,MAX(m.moq_qty)::numeric moq_qty
    FROM public.inv_stock_item_moq_policy m JOIN (SELECT DISTINCT stock_item_id,uom_id FROM l) q
      ON q.stock_item_id=m.stock_item_id AND q.uom_id=m.uom_id
    CROSS JOIN h
    WHERE m.is_active AND (m.effective_from IS NULL OR m.effective_from<=h.horizon_start_month)
       AND (m.effective_to IS NULL OR m.effective_to>=h.horizon_start_month)
    GROUP BY m.stock_item_id,m.uom_id
  ), watermarks AS (
    SELECT (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot) rm_as_of,
           (SELECT max(as_of_date) FROM public.tally_plm_stock_snapshot) pm_as_of
  ), detail AS (
    SELECT l.*,c.issue_qty_12m,c.usage_month_count,c.latest_usage_month,
      s.on_hand_qty,s.source_kind,s.source_rows,
      COALESCE(i.outstanding_indent_qty,0) outstanding_indent_qty,
      COALESCE(i.outstanding_indent_lines,0) outstanding_indent_lines,
      COALESCE(m.policy_count,0) policy_count,m.moq_qty,
      (c.issue_qty_12m / 12) AS avg_calendar_12m,
      (c.issue_qty_12m / 12 * l.coverage_months) AS gross_consumption_coverage,
      GREATEST(0,(c.issue_qty_12m / 12 * l.coverage_months) - COALESCE(s.on_hand_qty,0)) AS stock_netted_coverage,
      CASE WHEN s.source_kind='rm' THEN w.rm_as_of
           WHEN s.source_kind='plm' THEN w.pm_as_of END AS stock_watermark
    FROM l JOIN consumption c ON c.pr_line_id=l.pr_line_id
    LEFT JOIN stock s ON s.stock_item_id=l.stock_item_id
    LEFT JOIN indents i ON i.material_class_id=l.material_class_id
      AND i.stock_item_id=l.stock_item_id AND i.uom_id=l.uom_id
    LEFT JOIN moq m ON m.stock_item_id=l.stock_item_id AND m.uom_id=l.uom_id
    CROSS JOIN watermarks w
  ), computed AS (
    SELECT d.*,
      GREATEST(0,d.stock_netted_coverage-d.outstanding_indent_qty) AS net_coverage_after_indent,
      CASE WHEN d.on_hand_qty IS NULL OR d.uom_code IS NULL OR d.policy_count>1
               OR (d.uom_code='Nos' AND d.moq_qty IS NOT NULL AND d.moq_qty<>ceil(d.moq_qty))
           THEN NULL::numeric
           WHEN d.moq_qty>0 THEN ceil(GREATEST(0,d.stock_netted_coverage-d.outstanding_indent_qty)/d.moq_qty)*d.moq_qty
           WHEN d.uom_code='Nos' THEN ceil(GREATEST(0,d.stock_netted_coverage-d.outstanding_indent_qty))
           ELSE GREATEST(0,d.stock_netted_coverage-d.outstanding_indent_qty)
      END AS rounded_ccf_candidate
    FROM detail d
  )
  SELECT jsonb_build_object(
    'pr_id',pr_id,'pr_number',pr_number,'pr_status',status,
    'pr_line_id',pr_line_id,'stock_item_id',stock_item_id,'stock_item_name',item_name,
    'material_class_id',material_class_id,'uom_id',uom_id,'uom_code',uom_code,
    'coverage_months',coverage_months,'usage_12m',issue_qty_12m,
    'months_with_usage',usage_month_count,'latest_usage_month',latest_usage_month,
    'calendar_monthly_average',avg_calendar_12m,
    'gross_coverage',gross_consumption_coverage,'stock_on_hand',on_hand_qty,
    'stock_source',source_kind,'stock_as_of',stock_watermark,
    'mrp_suggested_qty',system_suggested_qty,'pr_effective_qty',effective_qty,
    'manual_delta_qty',manual_delta_qty,'outstanding_indent_qty',outstanding_indent_qty,
    'outstanding_indent_lines',outstanding_indent_lines,
    'stock_netted_coverage',stock_netted_coverage,
    'net_coverage_after_indents',net_coverage_after_indent,
    'moq_policy_count',policy_count,'moq_qty',moq_qty,
    'illustrative_ccf_floor',rounded_ccf_candidate,
    'illustrative_increment',CASE WHEN rounded_ccf_candidate IS NOT NULL
      THEN GREATEST(0,rounded_ccf_candidate-effective_qty) ELSE NULL END,
    'review_state',CASE
      WHEN NOT item_active THEN 'INACTIVE_ITEM'
      WHEN manual_delta_qty<0 THEN 'MANUAL_OVERRIDE_REVIEW'
      WHEN on_hand_qty IS NULL OR stock_watermark IS NULL THEN 'STOCK_SOURCE_REVIEW'
      WHEN uom_code IS NULL OR policy_count>1 THEN 'UOM_OR_MOQ_POLICY_REVIEW'
      WHEN uom_code='Nos' AND moq_qty<>ceil(moq_qty) THEN 'COUNT_MOQ_REVIEW'
      WHEN usage_month_count=0 THEN 'NO_USAGE_HISTORY'
      WHEN outstanding_indent_lines>0 THEN 'OUTSTANDING_INDENTS_REVIEW'
      ELSE 'ANCHOR_AND_POLICY_REVIEW' END,
    'advisory_only',true,
    'approved_incremental_pr_qty',NULL
  )
  FROM computed
  ORDER BY pr_line_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.proc_pec_ccf_pr_preview(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proc_pec_ccf_pr_preview(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_ccf_pr_preview(bigint) TO authenticated;
