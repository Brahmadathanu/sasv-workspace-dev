-- CI-038 ROLLBACK
-- A) IMMEDIATE structural rollback (right after apply, before anyone relies on it).
--    No business data is touched by CI-038, so this is lossless.
begin;
drop trigger if exists trg_sku_activation_completeness_guard on public.product_skus;
drop trigger if exists trg_product_sku_change_log on public.product_skus;
drop function if exists public.fn_guard_sku_activation_completeness();
drop function if exists public.fn_log_product_sku_change();
drop function if exists public.rpc_get_sku_activation_check(bigint);
drop function if exists costing.fn_sku_activation_missing_items(bigint, bigint);
-- restore the pre-CI-038 rpc_set_product_sku_active body:
\i rollback_preimage_rpc_set_product_sku_active.sql
drop table if exists public.product_sku_change_log;   -- A only: discards log rows
commit;

-- B) NON-DESTRUCTIVE rollback (after it has been in use; keep the audit evidence):
--    run everything in A EXCEPT the final DROP TABLE; then
--    alter table public.product_sku_change_log rename to product_sku_change_log_ci038_archive;
--    (keeps who-changed-what rows for audit; nothing else to undo)
-- NOTE for apply via Supabase MCP: \i is psql-only; paste the preimage file body instead.
