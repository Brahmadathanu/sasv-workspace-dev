-- ROUTE 2 / STEP 3b -- OPTIONAL independent control number for the archive.
-- Run as administrator. READ ONLY with a HARD budget enforced by PostgreSQL:
--   BEGIN READ ONLY; SET LOCAL statement_timeout/lock_timeout; DO ...; COMMIT;
-- PostgreSQL 17 note (tested): statement_timeout changed with set_config() INSIDE a DO block does NOT
-- apply to that running statement, so the limits are set with SET LOCAL BEFORE the DO. They then cap the
-- whole DO (all 64 counts) at 120 s; a per-relation timeout is not possible inside one DO.
-- The loop additionally stops cleanly at 100 s with a HOLD that names how far it got.
-- It counts rows only (one count(*) per direct relation WHERE run column = 87); no business data is printed.
-- Compare the printed total with the archive manifest total; any difference is a HOLD.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '150s';
DO $r2c$
DECLARE
  rel record; v_total bigint := 0; n bigint; v_start timestamptz := clock_timestamp(); v_rels int := 0;
  me pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM pg_roles WHERE rolname = current_user;
  IF NOT (me.rolsuper OR me.rolbypassrls) AND EXISTS (
       SELECT 1 FROM pg_class WHERE relnamespace = 'costing'::regnamespace AND (relrowsecurity OR relforcerowsecurity)) THEN
    RAISE EXCEPTION 'R2C HOLD: current_user % cannot bypass RLS; counts would be partial', current_user;
  END IF;
  FOR rel IN
    SELECT DISTINCT nn.nspname AS s, c.relname AS t, att.attname AS col
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace nn ON nn.oid = c.relnamespace
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
       AND nn.nspname = 'costing' AND array_length(con.conkey,1) = 1
     ORDER BY 1, 2, 3
  LOOP
    IF clock_timestamp() - v_start > interval '100 seconds' THEN
      RAISE EXCEPTION 'R2C HOLD: control count passed 100 s after % relations; not a complete control', v_rels;
    END IF;
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = 87', rel.s, rel.t, rel.col) INTO n;
    v_total := v_total + n; v_rels := v_rels + 1;
  END LOOP;
  IF v_rels <> 64 THEN RAISE EXCEPTION 'R2C HOLD: counted % relations, expected 64', v_rels; END IF;
  RAISE NOTICE 'R2_04 CONTROL: run 87 rows across % direct relations = % (elapsed %)', v_rels, v_total, clock_timestamp() - v_start;
END
$r2c$;
COMMIT;
