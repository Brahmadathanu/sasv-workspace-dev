\set ON_ERROR_STOP on
-- Standalone disposable PG17 schema fixture. NEVER connect this to production.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE TABLE public.proc_indent_header (indent_id bigint PRIMARY KEY, status text NOT NULL, source_pr_id bigint, updated_at timestamptz, updated_by text);
CREATE TABLE public.proc_indent_line (indent_line_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, indent_id bigint, material_class_id bigint, stock_item_id bigint, uom_id bigint, requested_qty numeric, manual_reason text, updated_at timestamptz, UNIQUE(indent_id,material_class_id,stock_item_id,uom_id));
CREATE OR REPLACE FUNCTION public.require_permission(p_target text,p_action text) RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN IF current_setting('pec.fixture_can_edit',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'PEC permission denied' USING ERRCODE='42501'; END IF; END $fn$;
CREATE OR REPLACE FUNCTION public.proc_indent_add_line_pec_internal(p_indent_id bigint,p_material_class_id bigint,p_stock_item_id bigint,p_uom_id bigint,p_requested_qty numeric DEFAULT 0,p_reason text DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $fn$ DECLARE v_status text; v_line bigint; BEGIN SELECT status INTO v_status FROM public.proc_indent_header WHERE indent_id=p_indent_id; IF v_status IN ('closed','cancelled') THEN RAISE EXCEPTION 'Indent is not editable'; END IF; IF v_status IN ('approved','issued') AND NULLIF(TRIM(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Reason required'; END IF; INSERT INTO public.proc_indent_line(indent_id,material_class_id,stock_item_id,uom_id,requested_qty,manual_reason) VALUES (p_indent_id,p_material_class_id,p_stock_item_id,p_uom_id,p_requested_qty,p_reason) ON CONFLICT(indent_id,material_class_id,stock_item_id,uom_id) DO UPDATE SET requested_qty=EXCLUDED.requested_qty,manual_reason=EXCLUDED.manual_reason RETURNING indent_line_id INTO v_line; RETURN v_line; END $fn$;
-- Seed the previously existing authenticated wrapper + ACL, since CREATE OR REPLACE must preserve it.
CREATE OR REPLACE FUNCTION public.proc_indent_add_line(p_indent_id bigint,p_material_class_id bigint,p_stock_item_id bigint,p_uom_id bigint,p_requested_qty numeric DEFAULT 0,p_reason text DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$ BEGIN PERFORM public.require_permission('module:procurement-execution-console','t'); RETURN public.proc_indent_add_line_pec_internal(p_indent_id,p_material_class_id,p_stock_item_id,p_uom_id,p_requested_qty,p_reason); END $fn$;
REVOKE ALL ON FUNCTION public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION public.proc_indent_add_line_pec_internal(bigint,bigint,bigint,bigint,numeric,text) FROM PUBLIC;
INSERT INTO public.proc_indent_header(indent_id,status,source_pr_id) VALUES (1,'draft',NULL),(2,'draft',990),(3,'approved',NULL),(4,'approved',980),(5,'issued',NULL),(6,'closed',NULL),(7,'cancelled',NULL);
INSERT INTO public.proc_indent_line(indent_id,material_class_id,stock_item_id,uom_id,requested_qty,manual_reason) VALUES (3,1,301,1,5,'original'),(5,1,501,1,9,'original');
\i supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql
DO $fn$ BEGIN IF has_function_privilege('anon','public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text)','EXECUTE') THEN RAISE EXCEPTION 'anon wrapper ACL unexpectedly permitted'; END IF; IF has_function_privilege('authenticated','public.proc_indent_add_line_pec_internal(bigint,bigint,bigint,bigint,numeric,text)','EXECUTE') THEN RAISE EXCEPTION 'internal function unexpectedly executable'; END IF; IF NOT has_function_privilege('authenticated','public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text)','EXECUTE') THEN RAISE EXCEPTION 'wrapper ACL was lost'; END IF; END $fn$;
CREATE OR REPLACE FUNCTION public.pec_fixture_expect_denied(p_indent bigint,p_item bigint,p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN PERFORM public.proc_indent_add_line(p_indent,1,p_item,1,8,p_reason); RAISE EXCEPTION 'UNEXPECTED_ALLOW'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'UNEXPECTED_ALLOW' THEN RAISE; END IF; END $fn$;
SET ROLE authenticated;
SET pec.fixture_can_edit = 'yes';
-- Editor: draft manual new allowed; all other new rows denied.
SELECT public.proc_indent_add_line(1,1,101,1,8,NULL) AS draft_manual_new_allowed;
SELECT public.pec_fixture_expect_denied(2,201,NULL);
SELECT public.pec_fixture_expect_denied(3,302,'approved reason');
SELECT public.pec_fixture_expect_denied(4,401,'approved PR-linked reason');
SELECT public.pec_fixture_expect_denied(5,502,'issued reason');
SELECT public.pec_fixture_expect_denied(6,601,'closed');
SELECT public.pec_fixture_expect_denied(7,701,'cancelled');
-- Existing approved and issued keys are corrections, not new rows: reason required.
SELECT public.pec_fixture_expect_denied(3,301,NULL);
SELECT public.proc_indent_add_line(3,1,301,1,7,'governed correction') AS approved_existing_corrected;
SELECT public.proc_indent_add_line(5,1,501,1,11,'governed correction') AS issued_existing_corrected;
-- Even an Editor loses the RPC when the PEC Edit permission flag is missing.
SET pec.fixture_can_edit = 'no';
SELECT public.pec_fixture_expect_denied(1,102,NULL);
RESET ROLE;
DO $fn$ DECLARE n int; qty numeric; BEGIN SELECT count(*) INTO n FROM public.proc_indent_line; IF n <> 3 THEN RAISE EXCEPTION 'expected 3 total lines, got %',n; END IF; SELECT requested_qty INTO qty FROM public.proc_indent_line WHERE indent_id=3 AND stock_item_id=301; IF qty <> 7 THEN RAISE EXCEPTION 'existing approved correction failed'; END IF; END $fn$;
DROP FUNCTION public.pec_fixture_expect_denied(bigint,bigint,text);
SELECT 'PEC_R2_ADD_LINE_PG17_FIXTURE_PASS' AS result;
