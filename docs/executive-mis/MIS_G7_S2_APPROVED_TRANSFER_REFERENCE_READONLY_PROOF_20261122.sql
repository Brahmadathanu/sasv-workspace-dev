-- EXECUTIVE MIS G7-S2 : BOUNDED READ-ONLY VERIFICATION FIXTURE
-- DO NOT DEPLOY AS MIGRATION. DO NOT USE AS PUBLIC RPC.
-- Live verification source: November 1-21 2026, Tally snapshot as-of 2026-11-22.
-- G7 POLICY APPROVED; server installation NOT authorized.
-- This script proves eligible source-to-SKU-to-APPROVED-rate coverage ONLY,
-- not completed-production manufacturing valuation, ledger parity, or historical finalization.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '8000ms';

WITH
parameters AS (
  SELECT date '2026-11-01' AS report_month,
         date '2026-11-21' AS transfer_end_date,
         date '2026-11-22' AS observed_snapshot_as_of,
         date '2026-11-01' AS eligible_cost_period_upper_bound
),
approved AS (
  SELECT s.approved_run_id AS run_id,
         s.period_start AS reference_cost_period,
         s.approved_run_valuation_date AS reference_valuation_date
  FROM costing.v_costing_period_run_status AS s
  JOIN costing.v_costing_run_effective_designation AS d
    ON d.refresh_run_id = s.approved_run_id
   AND d.period_start = s.period_start
   AND d.designation = 'APPROVED'
  JOIN costing.costing_refresh_run AS r
    ON r.id = s.approved_run_id
   AND r.period_start = s.period_start
   AND r.overall_status = 'SUCCESS'
   AND r.valuation_context_source = 'CAPTURED_AT_REQUEST'
  CROSS JOIN parameters p
  WHERE s.approved_run_id IS NOT NULL
    AND s.period_start <= p.eligible_cost_period_upper_bound
  ORDER BY s.period_start DESC, s.approved_run_id DESC
  LIMIT 1
),
lines AS (
  SELECT t.as_of_date, t.transfer_store, t.voucher_guid,
         t.inventory_line_no, t.batch_line_no, t.voucher_date,
         t.batch_code, t.item_name, t.qty_value, t.qty_unit_text,
         t.transfer_amount, t.is_cancelled, t.is_optional,
         a.sku_id,
         sk.pack_size AS master_pack_size, sk.uom AS master_pack_uom,
         k.pack_size AS rate_pack_size, k.pack_uom AS rate_pack_uom,
         k.manufacturing_cop_per_sku,
         k.manufacturing_cop_status,
         CASE
           WHEN a.sku_id IS NULL THEN 'SKU_UNMAPPED'
           WHEN sk.id IS NULL THEN 'SKU_MASTER_MISSING'
           WHEN k.sku_id IS NULL THEN 'NO_APPROVED_RATE'
           WHEN k.manufacturing_cop_status IS DISTINCT FROM 'READY'
             OR k.manufacturing_cop_per_sku IS NULL
             OR k.manufacturing_cop_per_sku < 0 THEN 'RATE_UNUSABLE'
           WHEN sk.pack_size IS DISTINCT FROM k.pack_size
             OR sk.uom IS DISTINCT FROM k.pack_uom THEN 'PACK_DEFINITION_MISMATCH'
           WHEN public.f_norm_key(t.qty_unit_text) NOT IN (
             'btl','bottle','nos','no','pcs','piece','pack','pkt',
             'box','jar','tin','tube','sachet','strip','unit','units'
           ) THEN 'QUANTITY_NOT_IN_PACKS'
           WHEN t.qty_value IS NULL OR t.qty_value <= 0 THEN 'QUANTITY_UNUSABLE'
           ELSE 'COVERED'
         END AS coverage_reason
  FROM public.tally_fg_transfer_voucher_lines t
  CROSS JOIN parameters p
  CROSS JOIN approved r
  LEFT JOIN public.sku_aliases a ON a.alias_key = public.f_norm_key(t.item_name)
  LEFT JOIN public.product_skus sk ON sk.id = a.sku_id
  LEFT JOIN costing.sku_internal_loaded_cost_snapshot k
    ON k.refresh_run_id = r.run_id AND k.sku_id = a.sku_id
  WHERE t.as_of_date = p.observed_snapshot_as_of
    AND t.voucher_date >= p.report_month
    AND t.voucher_date <= p.transfer_end_date
    AND NOT COALESCE(t.is_cancelled, false)
    AND NOT COALESCE(t.is_optional, false)
),
classified AS (
  SELECT l.*, CASE WHEN coverage_reason = 'COVERED'
                      THEN qty_value * manufacturing_cop_per_sku
                      ELSE NULL END AS covered_reference_value
  FROM lines l
)
SELECT
  (SELECT run_id FROM approved) AS approved_reference_run_id,
  (SELECT reference_cost_period FROM approved) AS reference_cost_period,
  (SELECT reference_valuation_date FROM approved) AS reference_valuation_date,
  coverage_reason,
  COUNT(*) AS voucher_line_count,
  ROUND(SUM(transfer_amount),2) AS book_transfer_amount,
  ROUND(SUM(covered_reference_value),2) AS covered_reference_subtotal
FROM classified
GROUP BY coverage_reason
ORDER BY coverage_reason;
COMMIT;

-- Observed, 22-Nov-2026 read-only dry-run equivalent:
-- run 143 / Oct 2026 / 2026-10-22
-- COVERED: 224 lines; Tally book ₹3,702,135.26; approved-reference subtotal ₹3,984,998.88
-- NO_APPROVED_RATE: 2 lines; Tally book ₹9,715.30; reference NULL
-- Uncovered: SKU1350 batch SP873 (174 packets), SKU41 batch 6957 (10 bottles).
-- Total book ₹3,711,850.56; 226 original voucher lines; zero SKU unmapped/duplicates.
-- IMPORTANT: this script fixes the snapshot fixture to the observed as-of; production RPC
-- must dynamically select an actually complete eligible as-of snapshot, not this hard-coded date.
-- IMPORTANT: transferring with a Tally voucher is not a verified production completion.
