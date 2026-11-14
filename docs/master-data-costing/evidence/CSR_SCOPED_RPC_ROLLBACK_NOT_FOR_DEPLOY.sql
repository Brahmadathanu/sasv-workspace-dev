-- REVIEW-ONLY ROLLBACK for evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql (#273).
-- NOT EXECUTED. Do not run without explicit owner approval. The forward change is purely additive
-- (one new function), so rollback is dropping it. No view, index, policy, grant on tables, data or
-- statement_timeout is touched by either direction.
BEGIN;
DO $rb$
BEGIN
  IF to_regprocedure('public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)') IS NULL THEN
    RAISE NOTICE 'scoped RPC not present; nothing to roll back';
  END IF;
END
$rb$;
DROP FUNCTION IF EXISTS public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer);
COMMIT;
-- Client rollback is separate: the client PR must keep the original view read behind a flag so reverting
-- the flag restores today's behaviour without a database change. Roll the client back FIRST, then drop.
