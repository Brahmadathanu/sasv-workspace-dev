-- ROUTE 2 / STEP 3b -- OPTIONAL independent control number for the archive.
-- Run as administrator (any role that sees all rows). READ ONLY and budgeted:
--   * transaction forced read-only,
--   * per-statement timeout 20s, lock timeout 2s, hard overall budget 120s checked between relations,
--   * one count(*) per direct relation filtered on run 87 (no row data is read or printed).
-- Compare the printed total with the archive manifest total; any difference is a HOLD.
-- This is separate from R2_03 so the cheap permission audit never scans production tables.
DO $r2c$
DECLARE
  rel record; v_total bigint := 0; n bigint; v_start timestamptz := clock_timestamp(); v_rels int := 0;
BEGIN
  PERFORM set_config('transaction_read_only', 'on', true);
  PERFORM set_config('statement_timeout', '20s', true);
  PERFORM set_config('lock_timeout', '2s', true);
  FOR rel IN
    SELECT DISTINCT nn.nspname AS s, c.relname AS t, att.attname AS col
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace nn ON nn.oid = c.relnamespace
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
       AND nn.nspname = 'costing' AND array_length(con.conkey,1) = 1
     ORDER BY 1, 2, 3
  LOOP
    IF clock_timestamp() - v_start > interval '120 seconds' THEN
      RAISE EXCEPTION 'R2C HOLD: control count exceeded its 120s budget after % relations', v_rels;
    END IF;
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = 87', rel.s, rel.t, rel.col) INTO n;
    v_total := v_total + n; v_rels := v_rels + 1;
  END LOOP;
  IF v_rels <> 64 THEN RAISE EXCEPTION 'R2C HOLD: counted % relations, expected 64', v_rels; END IF;
  RAISE NOTICE 'R2_04 CONTROL: run 87 rows across % direct relations = % (elapsed %)', v_rels, v_total, clock_timestamp() - v_start;
END
$r2c$;
