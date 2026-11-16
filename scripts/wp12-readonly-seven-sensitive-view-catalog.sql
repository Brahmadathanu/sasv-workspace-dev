-- WP12 repeatable production read-only catalog drift audit of seven owner-reviewed sensitive views.
-- Does NOT execute a view, inspect business rows, change roles, or simulate signed-in JWT behavior.
WITH expected(view_name, definition_md5, expected_invoker) AS (
  VALUES
    ('v_costing_material_manual_rate_register','38b4262bfae719ca3f736185784fd047',false),
    ('v_costing_material_manual_rate_history','01029a39e47a300aa7860d17b2f39cae',false),
    ('v_costing_material_review_acceptance_register','0dcc3db262a30a9b770720dcb48e6376',false),
    ('v_costing_scheme_master_audit','e2b9eb3c1b86d073183cd376f704cf58',false),
    ('v_costing_pricing_sku_detailed_cost_sheet','4faaae56558dddbc3b418146f2ab8c59',true),
    ('v_costing_pricing_cost_sheet_line_traceability','800a546b711a9658e9f81a58b6e78303',false),
    ('v_costing_scheme_master_register','903cb8eae3702bf72e41213ec2c89c6e',true)
),
observed AS (
  SELECT e.view_name, c.oid IS NOT NULL AS exists_now,
    (c.oid IS NOT NULL AND md5(pg_get_viewdef(c.oid,true))=e.definition_md5) AS definition_match,
    (c.oid IS NOT NULL AND coalesce(
       (SELECT o.option_value::boolean FROM pg_options_to_table(c.reloptions) o WHERE o.option_name='security_invoker'),false
      )=e.expected_invoker) AS invoker_match,
    (c.oid IS NOT NULL AND has_table_privilege('authenticated',c.oid,'SELECT')) AS authenticated_select
  FROM expected e
  LEFT JOIN pg_class c ON c.relname=e.view_name AND c.relnamespace='public'::regnamespace AND c.relkind='v'
)
SELECT CASE WHEN count(*)=7 AND bool_and(exists_now AND definition_match AND invoker_match AND authenticated_select)
  THEN 'PASS' ELSE 'BLOCKED' END AS wp12_seven_view_catalog,
  count(*) AS expected_views,
  count(*) FILTER (WHERE exists_now AND definition_match AND invoker_match AND authenticated_select) AS passing_views,
  coalesce(jsonb_agg(view_name) FILTER (WHERE NOT(exists_now AND definition_match AND invoker_match AND authenticated_select)),'[]'::jsonb) AS deviations
FROM observed;
