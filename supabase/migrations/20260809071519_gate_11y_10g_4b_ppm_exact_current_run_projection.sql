-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $migration$
DECLARE
  v_def text;
  v_old text := E'  WHERE sps.period_start = (( SELECT max(x.period_start) AS max\n           FROM costing.sku_selling_price_bridge_snapshot x));';
  v_new text := E'  WHERE EXISTS (\n    SELECT 1\n    FROM costing.v_current_successful_costing_refresh_run current_run\n    WHERE current_run.period_start = sps.period_start\n      AND current_run.refresh_run_id = sps.refresh_run_id\n      AND current_run.period_start = (\n        SELECT max(latest_run.period_start)\n        FROM costing.v_current_successful_costing_refresh_run latest_run\n      )\n  );';
BEGIN
  v_def := pg_get_viewdef('costing.v_costing_policy_manager_sku_overview'::regclass, true);

  IF md5(v_def) <> 'bd014e0f9175ce0dd898f8fd7c3c94b8' THEN
    RAISE EXCEPTION 'Gate 11Y.10G.4B aborted: unexpected costing.v_costing_policy_manager_sku_overview definition hash %', md5(v_def);
  END IF;

  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'Gate 11Y.10G.4B aborted: expected period-only predicate not found';
  END IF;

  v_def := replace(v_def, v_old, v_new);

  EXECUTE 'CREATE OR REPLACE VIEW costing.v_costing_policy_manager_sku_overview AS ' || v_def;
END
$migration$;

COMMENT ON VIEW costing.v_costing_policy_manager_sku_overview IS
'Operational PPM SKU overview. Gate 11Y.10G.4B hardens the latest-period projection to the canonical current successful governed refresh run via costing.v_current_successful_costing_refresh_run; historical selling-price bridge snapshots remain intact.';