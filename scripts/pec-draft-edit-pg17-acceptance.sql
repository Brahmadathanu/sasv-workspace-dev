-- Isolated PostgreSQL 17 regression checks. Never run on live SASV.
\set ON_ERROR_STOP on
CREATE FUNCTION public.fixture_expect_denial(p_sql text,p_message text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    IF NOT (SQLERRM ILIKE CASE
         WHEN p_message IN ('stale date') THEN '%stale expected date%'
         WHEN p_message IN ('stale qty') THEN '%stale expected quantity%'
         WHEN p_message IN ('approved date','approved qty','linked source header','cancelled date') THEN '%only independent unapproved manual drafts%'
         WHEN p_message IN ('PR mapped header','PR mapped line') THEN '%PR-linked%'
         WHEN p_message IN ('allocated line','selected vendor') THEN '%sourcing or purchase allocation%'
         WHEN p_message='internal material increase' THEN '%increase of internal%'
         WHEN p_message IN ('zero quantity','nonfinite quantity') THEN '%positive finite%'
         WHEN p_message='blank reason' THEN '%reason must contain%'
         WHEN p_message='view-only rejected' THEN '%PEC edit permission denied%'
         WHEN p_message='no auth uid rejected' THEN '%authenticated user session required%'
         ELSE '%TEST_CASE_UNMAPPED%'
       END) THEN
      RAISE EXCEPTION 'wrong denial for %: %',p_message,SQLERRM;
    END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unexpectedly accepted: %',p_message; END IF;
  RAISE NOTICE 'PASS denied: %',p_message;
END $$;

SET test.user_id = '11111111-1111-4111-8111-111111111111';
SET test.can_edit = 'true';
SET ROLE authenticated;
DO $test$
DECLARE v_count int;
BEGIN
  PERFORM public.proc_indent_update_draft_date(1,'2026-11-11','2026-11-10','date corrected');
  IF (SELECT indent_date FROM public.proc_indent_header WHERE indent_id=1) IS DISTINCT FROM DATE '2026-11-11'
    THEN RAISE EXCEPTION 'positive date edit absent'; END IF;
  PERFORM public.proc_indent_update_draft_manual_line_qty(101,12,10,'revised required quantity');
  IF (SELECT requested_qty FROM public.proc_indent_line WHERE indent_line_id=101) <> 12
    THEN RAISE EXCEPTION 'positive qty edit absent'; END IF;
  IF (SELECT count(*) FROM public.proc_lifecycle_audit WHERE event_type='INDENT_DRAFT_DATE_EDITED'
      AND reason='date corrected' AND actor_user_id=auth.uid()) <> 1
    THEN RAISE EXCEPTION 'date explicit audit missing'; END IF;
  IF (SELECT count(*) FROM public.proc_lifecycle_audit WHERE event_type='INDENT_DRAFT_MANUAL_QTY_EDITED'
      AND reason='revised required quantity' AND actor_user_id=auth.uid()) <> 1
    THEN RAISE EXCEPTION 'qty explicit audit missing'; END IF;
  IF (SELECT count(*) FROM public.proc_lifecycle_audit WHERE event_type IN ('INDENT_UPDATED','INDENT_LINE_CHANGED')) <> 2
    THEN RAISE EXCEPTION 'existing update triggers not exercised'; END IF;
  RAISE NOTICE 'PASS: valid date + qty, reason/actor audit, lifecycle update triggers';
END $test$;
-- Each rejected call must throw; simple SQL DO helper rolls back local statement
-- side effects on exception and avoids leaving false-positive tests.
-- Mock test helpers live only inside ephemeral database.
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(1,'2026-11-13','2026-11-10','stale')$$,'stale date');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(101,13,10,'stale')$$,'stale qty');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(2,'2026-11-13','2026-11-10','approved')$$,'approved date');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(102,20,10,'approved')$$,'approved qty');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(3,'2026-11-13','2026-11-10','pr')$$,'linked source header');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(4,'2026-11-13','2026-11-10','pr map')$$,'PR mapped header');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(104,20,10,'pr map')$$,'PR mapped line');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(105,20,10,'allocated')$$,'allocated line');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(107,20,10,'selected')$$,'selected vendor');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(106,20,10,'internal')$$,'internal material increase');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(101,0,12,'zero')$$,'zero quantity');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(101,'NaN',12,'NaN')$$,'nonfinite quantity');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(1,'2026-11-13','2026-11-11','')$$,'blank reason');
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(8,'2026-11-13','2026-11-10','closed')$$,'cancelled date');
-- Historical reduction on an internal material is allowed by same G0 policy.
SELECT public.proc_indent_update_draft_manual_line_qty(106,9,10,'historical reduction');
DO $$ BEGIN
IF (SELECT requested_qty FROM public.proc_indent_line WHERE indent_line_id=106) <> 9 THEN
 RAISE EXCEPTION 'internal reduction did not apply'; END IF;
RAISE NOTICE 'PASS: internal historical reduction'; END $$;
RESET ROLE;
SET test.can_edit = 'false';
SET ROLE authenticated;
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_date(1,'2026-11-12','2026-11-11','view only')$$,'view-only rejected');
RESET ROLE;
SET test.can_edit = 'true';
SET test.user_id = '';
SET ROLE authenticated;
SELECT public.fixture_expect_denial(
 $$SELECT public.proc_indent_update_draft_manual_line_qty(101,13,12,'missing user')$$,'no auth uid rejected');
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon',
 'public.proc_indent_update_draft_date(bigint,date,date,text)','EXECUTE')
 OR has_function_privilege('anon',
 'public.proc_indent_update_draft_manual_line_qty(bigint,numeric,numeric,text)','EXECUTE')
 THEN RAISE EXCEPTION 'anon can execute draft edit'; END IF;
 IF NOT has_function_privilege('authenticated',
 'public.proc_indent_update_draft_date(bigint,date,date,text)','EXECUTE')
 THEN RAISE EXCEPTION 'editor role lacks RPC execute'; END IF;
 RAISE NOTICE 'PASS: grants deny anon, allow authenticated'; END $$;
-- No alteration to published procurement snapshots, no hidden approved edit.
DO $$ BEGIN
 IF (SELECT requested_qty FROM public.proc_indent_line WHERE indent_line_id=102) <> 10
 OR (SELECT indent_date FROM public.proc_indent_header WHERE indent_id=2) <> DATE '2026-11-10'
 THEN RAISE EXCEPTION 'approved indent changed'; END IF;
 RAISE NOTICE 'PASS: approved untouched'; END $$;
SELECT 'PEC_DRAFT_PG17_FIXTURE_PASS' AS result;
