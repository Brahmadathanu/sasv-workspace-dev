-- Read-only checks after CI-038 is applied
select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.product_skus'::regclass and not tgisinternal;
select has_function_privilege('anon','public.rpc_get_sku_activation_check(bigint)','execute') anon_chk,       -- expect f
       has_function_privilege('authenticated','costing.fn_sku_activation_missing_items(bigint,bigint)','execute') auth_helper, -- expect f
       has_table_privilege('authenticated','public.product_sku_change_log','select') auth_log;                 -- expect f
select prosrc like '%fn_sku_activation_missing_items%' rpc_patched from pg_proc where proname='rpc_set_product_sku_active'; -- expect t
-- active SKUs that would fail today (expect 0; guard never touches them anyway)
select count(*) from public.product_skus s where s.is_active and jsonb_array_length(costing.fn_sku_activation_missing_items(s.id)->'missing')>0;
-- sample message for a known-incomplete inactive SKU
select costing.fn_sku_activation_missing_items(17), costing.fn_sku_activation_missing_items(114);
