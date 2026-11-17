-- Privilege statements a FUTURE reviewed migration would need for the candidate function (mirrors the installed function's grants).
-- NOT APPLIED anywhere. Executed ONLY in the throwaway fixture cluster by the offline tests (which create stand-in anon/authenticated roles).
REVOKE ALL ON FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(date,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(date,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(date,integer) TO authenticated;
