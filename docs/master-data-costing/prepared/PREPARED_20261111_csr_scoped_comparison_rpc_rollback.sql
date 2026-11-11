-- PREPARED ROLLBACK, NOT EXECUTED (#273). Roll the client flag back (COSTING_CSR_SCOPED_COMPARISON_RPC_V1 off) FIRST.
-- Drops only the one function the forward file created. Refuses to drop anything else.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $rb$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND p.proname = 'rpc_get_cost_sheet_sku_monthly_comparison_scoped';
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly one scoped RPC, found %; stop', n; END IF;
END
$rb$;
DROP FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer);
COMMIT;
