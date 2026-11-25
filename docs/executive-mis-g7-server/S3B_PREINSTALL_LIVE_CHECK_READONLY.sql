-- READ ONLY pre-install verification for the S3b migration (run by the owner/reviewer against production before install).
-- Every row must show ok = true (11 pinned fingerprints incl. fn_fg_reconcile_batch and fn_fg_mark_done_if_zero).
BEGIN READ ONLY;
WITH expected(obj, sha) AS (VALUES
 ('fn_fg_auto_zero(integer,text,numeric)','705fecd3e68576272af73b5230737c98689c9f538d88e40d723a5b935ae5a582'),
 ('fn_fg_force_close(integer,text,numeric)','c48578e7e08d311aebdefdaaf512bbfe2a87daecf61c2bde735f46d1e7cff10d'),
 ('fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)','9b9a1a4975679358a2628f3e598a75a2a4b0ac658173da9f6f1950cdd6629675'),
 ('trg_fg_bulk_internal_transfer_to_ledger()','6adab6d8180d2d0f15f8415acd51403691cc6f64c58b549b71ce386e6faa69c5'),
 ('trg_fg_ledger_from_dwl()','ffe12985b5e7c135766655c4893a886adc2d1a36bd6a181c80cd185649c2eec1'),
 ('trg_fg_ledger_from_es()','cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28'),
 ('trg_fg_ledger_reconcile_ins_stmt()','d4cdfe3dbc827d0e14122fe41993981e65b4903bd18d8da3d0013fd730cc2412'),
 ('trg_fg_ledger_reconcile_upd_stmt()','a298bcff5a7fede05d59c4d77c4673fd4fe5db2f5609914cb900dedfbf6b5f7b'),
 ('trg_fg_ledger_reconcile_del_stmt()','d09789baea588ff64d78e9b787ae769a4dff2df9f307547bfcdedd562cb995ad'),
 ('fn_fg_reconcile_batch(integer,text,numeric)','b229faad84f128420eb61caae3fb0678b15772d22b0d13f416c0332a92b9a7be'),
 ('fn_fg_mark_done_if_zero(integer,text,numeric)','278f4fdc43cc5886b57995407d6cc5cdc52404362fb0135ab19aedd440cacb6a'))
SELECT e.obj, e.sha = encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.' || e.obj)), 'UTF8')), 'hex') AS ok,
       encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.' || e.obj)), 'UTF8')), 'hex') AS live_sha
  FROM expected e
UNION ALL SELECT 'reconciler not client-executable',
       NOT (has_function_privilege('authenticated','public.fn_fg_reconcile_batch(integer,text,numeric)','EXECUTE')
         OR has_function_privilege('anon','public.fn_fg_reconcile_batch(integer,text,numeric)','EXECUTE')), NULL
UNION ALL SELECT 'no other invoker caller of helpers/reconciler',
       NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.prokind='f' AND NOT p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
           AND (p.prosrc ILIKE '%fn_fg_ledger_add%' OR p.prosrc ILIKE '%fn_fg_auto_zero%' OR p.prosrc ILIKE '%fn_fg_reconcile_batch%' OR p.prosrc ILIKE '%fn_fg_mark_done_if_zero%')
           -- accounted set == the migration's v_chain (10) + fn_fg_mark_done_if_zero: all converted/renamed by S3b, so NOT unknown callers
           AND p.oid::regprocedure::text NOT IN (
             'trg_fg_ledger_from_dwl()','trg_fg_ledger_from_es()','trg_fg_bulk_internal_transfer_to_ledger()',
             'fn_fg_auto_zero(integer,text,numeric)','fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)',
             'fn_fg_force_close(integer,text,numeric)','fn_fg_reconcile_batch(integer,text,numeric)',
             'trg_fg_ledger_reconcile_ins_stmt()','trg_fg_ledger_reconcile_upd_stmt()','trg_fg_ledger_reconcile_del_stmt()',
             'fn_fg_mark_done_if_zero(integer,text,numeric)')), NULL
UNION ALL SELECT 'fn_fg_mark_done_if_zero legacy name free', to_regprocedure('public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric)') IS NULL, NULL
UNION ALL SELECT 'mark_done is invoker, authenticated-callable, pinned search_path (expected pre-install state)',
       NOT p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE') AND p.proconfig::text LIKE '%search_path=%', NULL
  FROM pg_proc p WHERE p.oid = 'public.fn_fg_mark_done_if_zero(integer,text,numeric)'::regprocedure
UNION ALL SELECT 'live epsilon default exists and is positive (live value 0.01; wrapper bounds epsilon by it)',
       to_regprocedure('public.fn_fg_eps_default()') IS NOT NULL AND public.fn_fg_eps_default() > 0, NULL
UNION ALL SELECT 'force-close wrapper uses module:fg-bulk-stock (wrapper must use the same target)',
       regexp_replace(p.prosrc, '[[:space:]]+', '', 'g') ILIKE '%require_permission(''module:fg-bulk-stock'',true)%', NULL
  FROM pg_proc p WHERE p.oid = 'public.fn_fg_force_close(integer,text)'::regprocedure;
-- Also capture (outside this file) the full pg_get_functiondef text of all ten functions into the immutable deployment packet.
COMMIT;
