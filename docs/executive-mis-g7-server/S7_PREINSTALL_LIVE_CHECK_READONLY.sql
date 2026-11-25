-- MIS G7 S7 pre-install LIVE check. READ-ONLY (SELECT only). Run immediately before S7a/S7b/S7c; every `pass` must be true.
-- Section 2 is the receipt-semantics evidence for S7b: it measures how many live FG receipt work logs would be certifiable under the exact-source rule
-- (net of the work log's own 'FG bulk storage*' ledger rows = its logged quantity). Review the numbers; the rule is deliberately strict.

-- 1. pins and state (all must be true)
SELECT 'mode is AUDIT' AS check_name, (SELECT mode FROM app_private.mis_g7_enforcement) = 'AUDIT' AS pass
UNION ALL SELECT 'no signed stage events', NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event)
UNION ALL SELECT 'no MIS permission assignments for the five new targets', NOT EXISTS (SELECT 1 FROM public.user_permissions_canonical WHERE target IN
  ('module:mis-batch-stage-signer','module:mis-fg-bulk-packing','module:mis-fg-excess-adjustment','module:mis-g7-enforcement-admin','module:mis-g7-core-migration-signoff') AND (can_view OR can_edit))
UNION ALL SELECT 'no route id <= 0', NOT EXISTS (SELECT 1 FROM costing.production_route_family_route_step WHERE id <= 0)
  AND NOT EXISTS (SELECT 1 FROM costing.product_process_route_override WHERE id <= 0) AND NOT EXISTS (SELECT 1 FROM costing.product_process_route WHERE id <= 0)
  AND NOT EXISTS (SELECT 1 FROM costing.production_route_family_route WHERE id <= 0)
UNION ALL SELECT 'S2 resolver prosrc pin', encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure),'UTF8')),'hex') = '53c9c60c22ddfa33e4628d43e228789505c53bfcae9925f622e7d68b08eba9e3'
UNION ALL SELECT 'S6 fingerprint definition pin', encode(sha256(convert_to(pg_get_functiondef('app_private.mis_stage_fp(integer,text,integer,bigint,integer)'::regprocedure),'UTF8')),'hex') = 'd438e858f03325bfbecc6f564999bd359d81d7ee24ecf2a4b7c98a92dab359d4'
UNION ALL SELECT 'S2 signer prosrc pin (S7b anchor)', encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)'::regprocedure),'UTF8')),'hex') = '2a4134f23aa2409af4ca8ca0e94936e3fdbf03761c0ba7df4a99a2b9e0420005'
UNION ALL SELECT 'S4 packer prosrc pin (S7b anchor)', encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)'::regprocedure),'UTF8')),'hex') = '97673b20153679e09f42f858d0e5b2ee4d2db559f5580244bb6c266f781f165c'
UNION ALL SELECT 'engine pin ' || v.sig, encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure(v.sig)),'UTF8')),'hex') = v.h FROM (VALUES
  ('costing.fn_resolve_route_family_for_product(integer,date)', 'fda6b65c85b998e497627129a23d290af222dc1cea15ca7a84916b9c83817660'),
  ('costing.fn_resolve_effective_route_family_route(integer,date)', '065cb137b51b484f0b716887af3ba0fd5943687b729ef37e8b0ef7e9eae2dad3'),
  ('costing.fn_resolve_effective_product_process_route(integer,date)', '98b9f3605ee6179a4dfbb35f538f03a4a1291784c60b857beac8d48b8b59e177'),
  ('costing.fn_effective_product_process_route_steps(bigint)', '6d3c21fff37c8cca324ae7fe64e07b911a4e0b8c23337a7324ecb5c0b9a0b6d4'),
  ('costing.fn_effective_product_process_steps(integer,date)', 'f94e1ce737060a54eac2374b73f6aa7819df05a58fc15130739665d350627c8d'),
  ('costing.fn_validate_product_process_route(bigint)', '7aaf0c6ee6547af64f0bf492b4f2e3786d78f2ed3f7582dc44704836e89194a3'),
  ('costing.fn_validate_route_family_route(bigint)', '1d8f0946ec7c895bfcc1835b98fb23be6237abdce9859f8478656223c850af2d'),
  ('costing.fn_validate_effective_product_process_route(integer,date)', 'f2773bdb1ccda5f4708e9449c70c20655faeaeac0c964ca53877a8da637e5461')) v(sig, h);

-- 2a. receipt semantics: FG work logs vs their own ledger source rows (informational; no pass/fail)
WITH fg AS (
  SELECT w.id, w.storage_qty, w.storage_qty_uom, p.uom_base FROM public.daily_work_log w JOIN public.products p ON p.item = w.item WHERE w.activity = 'FG bulk storage'),
net AS (
  SELECT g.source_id, sum(g.qty_base) AS n, count(*) AS c FROM public.fg_bulk_stock_ledger g
   WHERE g.source_table = 'daily_work_log' AND (g.reason_code = 'FG bulk storage' OR g.reason_code LIKE 'FG bulk storage (%)') GROUP BY g.source_id)
SELECT count(*) FILTER (WHERE fg.storage_qty > 0)                                                            AS fg_logs_with_positive_qty,
       count(*) FILTER (WHERE fg.storage_qty > 0 AND net.source_id IS NULL)                                  AS no_source_ledger_rows,
       count(*) FILTER (WHERE fg.storage_qty > 0 AND net.source_id IS NOT NULL AND abs(net.n - fg.storage_qty) <= 0.0005) AS exact_net_equals_log,
       count(*) FILTER (WHERE fg.storage_qty > 0 AND net.source_id IS NOT NULL AND abs(net.n - fg.storage_qty) > 0.0005)  AS net_differs_from_log,
       max(abs(net.n - fg.storage_qty)) FILTER (WHERE net.source_id IS NOT NULL)                              AS max_abs_difference,
       count(*) FILTER (WHERE fg.storage_qty > 0 AND fg.storage_qty_uom IS DISTINCT FROM fg.uom_base)         AS uom_not_base
  FROM fg LEFT JOIN net ON net.source_id = fg.id;

-- 2b. every (source_table, reason_code) pair carrying POSITIVE stock (expected: the seven pairs in the owner's finding) and rows pointing at non-FG or missing work logs
SELECT g.source_table, g.reason_code, count(*) AS rows, sum(g.qty_base) AS qty_base_sum
  FROM public.fg_bulk_stock_ledger g WHERE g.qty_base > 0 GROUP BY 1, 2 ORDER BY 1, 2;
SELECT count(*) FILTER (WHERE w.id IS NULL) AS source_ids_without_work_log,
       count(*) FILTER (WHERE w.id IS NOT NULL AND w.activity <> 'FG bulk storage') AS source_ids_on_non_fg_logs
  FROM public.fg_bulk_stock_ledger g LEFT JOIN public.daily_work_log w ON w.id = g.source_id
 WHERE g.source_table = 'daily_work_log' AND (g.reason_code = 'FG bulk storage' OR g.reason_code LIKE 'FG bulk storage (%)');
-- 2c. a sample of mismatching logs for manual review (bounded)
SELECT w.id, w.batch_number, w.storage_qty, net.n, net.c
  FROM public.daily_work_log w JOIN (SELECT source_id, sum(qty_base) n, count(*) c FROM public.fg_bulk_stock_ledger
        WHERE source_table = 'daily_work_log' AND (reason_code = 'FG bulk storage' OR reason_code LIKE 'FG bulk storage (%)') GROUP BY 1) net ON net.source_id = w.id
 WHERE w.activity = 'FG bulk storage' AND abs(net.n - w.storage_qty) > 0.0005 ORDER BY abs(net.n - w.storage_qty) DESC LIMIT 25;
