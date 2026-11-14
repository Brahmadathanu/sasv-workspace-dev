-- PEC G0: repeatable DB-internal writer integration acceptance.
-- IMPORTANT: explicitly begins and ends with ROLLBACK. Creates no retained PR,
-- indent, mappings, or audit rows. PostgreSQL sequences may advance.
-- Fixture: live historical active PR id 1; manual RM Ampar #64 (g, UOM 2).
-- This is NOT a substitute for authenticated public-RPC acceptance.
BEGIN;
DO $preflight$
BEGIN
 IF (SELECT status FROM public.proc_pr_header WHERE pr_id=1) <> 'active' THEN
   RAISE EXCEPTION 'PEC G0 fixture PR #1 no longer active';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.v_inv_stock_item_with_class
   WHERE stock_item_id=64 AND subcategory_code NOT IN ('finished_bulk_material','semifinished_goods')
 ) THEN RAISE EXCEPTION 'PEC G0 manual Ampar fixture not ordinary external RM'; END IF;
END $preflight$;

CREATE TEMP TABLE _pec_g0_test (pr_id bigint, indent_id bigint) ON COMMIT DROP;
INSERT INTO _pec_g0_test(pr_id)
SELECT public.proc_pr_create_revision_from_active_pec_internal(
  1,'PEC G0 ROLLBACK-ONLY regression PR revision');
UPDATE _pec_g0_test t
SET indent_id=public.proc_indent_create_from_pr_pec_internal(
  t.pr_id,'PEC-G0-ROLLBACK-ONLY',DATE '2026-11-12',
  'PEC G0 ROLLBACK-ONLY regression indent',false);

DO $initial$
DECLARE v_pr bigint;v_indent bigint;
BEGIN
 SELECT pr_id,indent_id INTO STRICT v_pr,v_indent FROM _pec_g0_test;
 IF (SELECT count(*) FROM public.proc_pr_line WHERE pr_id=v_pr)<>450
 THEN RAISE EXCEPTION 'PEC G0 revision expected 450 rows'; END IF;
 IF (SELECT count(*) FROM public.proc_indent_line WHERE indent_id=v_indent)<>206
 THEN RAISE EXCEPTION 'PEC G0 new indent expected 206 rows'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.proc_indent_line l
   JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=l.stock_item_id
   WHERE l.indent_id=v_indent AND c.subcategory_code IN
     ('finished_bulk_material','semifinished_goods')
 ) THEN RAISE EXCEPTION 'PEC G0 internal category leaked into external indent'; END IF;
 IF (SELECT count(*) FROM public.proc_pr_indent_line_map WHERE indent_id=v_indent)<>206
 THEN RAISE EXCEPTION 'PEC G0 lineage initially not 206'; END IF;
END $initial$;

-- Set status inside the *rolled-back fixture* to meet resync precondition.
UPDATE public.proc_pr_header SET status='active'
WHERE pr_id=(SELECT pr_id FROM _pec_g0_test);
INSERT INTO public.proc_indent_line
(indent_id,material_class_id,stock_item_id,uom_id,requested_qty,manual_reason)
VALUES ((SELECT indent_id FROM _pec_g0_test),1,64,2,10,
        'PEC G0 ROLLBACK-ONLY manual item');

CREATE TEMP TABLE _pec_g0_removed ON COMMIT DROP AS
SELECT l.pr_line_id,l.stock_item_id,l.uom_id
FROM public.proc_pr_line l
WHERE l.pr_id=(SELECT pr_id FROM _pec_g0_test)
AND l.requested_qty+coalesce(l.manual_delta_qty,0)>0
ORDER BY l.pr_line_id LIMIT 1;

UPDATE public.proc_pr_line SET requested_qty=0,manual_delta_qty=0
WHERE pr_line_id=(SELECT pr_line_id FROM _pec_g0_removed);

SELECT public.proc_indent_resync_from_pr_pec_internal(
  (SELECT indent_id FROM _pec_g0_test),'safe');

DO $safe$
DECLARE i bigint;
BEGIN
 SELECT indent_id INTO STRICT i FROM _pec_g0_test;
 IF (SELECT count(*) FROM public.proc_indent_line WHERE indent_id=i)<>206
 OR (SELECT count(*) FROM public.proc_indent_line WHERE indent_id=i AND stock_item_id=64)<>1
 OR (SELECT count(*) FROM public.proc_pr_indent_line_map WHERE indent_id=i)<>205
 OR EXISTS (SELECT 1 FROM public.proc_indent_line l
   JOIN _pec_g0_removed x ON x.stock_item_id=l.stock_item_id AND x.uom_id=l.uom_id
   WHERE l.indent_id=i)
 THEN RAISE EXCEPTION 'PEC G0 SAFE resync failed manual preservation/obsolete mapped deletion'; END IF;
END $safe$;

-- Restore PR quantity within disposable fixture before full RESET.
UPDATE public.proc_pr_line l SET requested_qty=10,manual_delta_qty=0
WHERE l.pr_line_id=(SELECT pr_line_id FROM _pec_g0_removed);
SELECT public.proc_indent_resync_from_pr_pec_internal(
  (SELECT indent_id FROM _pec_g0_test),'reset');
DO $reset$
DECLARE i bigint;
BEGIN
 SELECT indent_id INTO STRICT i FROM _pec_g0_test;
 IF (SELECT count(*) FROM public.proc_indent_line WHERE indent_id=i)<>206
 OR EXISTS (SELECT 1 FROM public.proc_indent_line WHERE indent_id=i AND stock_item_id=64)
 OR (SELECT count(*) FROM public.proc_pr_indent_line_map WHERE indent_id=i)<>206
 THEN RAISE EXCEPTION 'PEC G0 RESET resync failed PR-only replacement'; END IF;
END $reset$;

SELECT 'PEC_G0_ROLLBACK_WRITER_INTEGRATION_PASS' AS result,
 (SELECT count(*) FROM public.proc_pr_line WHERE pr_id=(SELECT pr_id FROM _pec_g0_test)) revision_lines,
 (SELECT count(*) FROM public.proc_indent_line WHERE indent_id=(SELECT indent_id FROM _pec_g0_test)) reset_indent_lines,
 (SELECT count(*) FROM public.proc_pr_indent_line_map WHERE indent_id=(SELECT indent_id FROM _pec_g0_test)) reset_line_maps;
ROLLBACK;
