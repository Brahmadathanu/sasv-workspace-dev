-- READ-ONLY preflight 02: non-FK consumers of acceptance->snapshot id columns (R2C gate; must return zero rows to proceed).
SELECT 'function' kind,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' obj
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('costing','public') AND p.prokind IN ('f','p')
  AND pg_get_functiondef(p.oid) ~* '(acceptance|a)\.(source_snapshot_id|regional_basis_snapshot_id|regional_marketing_snapshot_id)'
  AND p.proname NOT LIKE 'fn_evidence_%' AND p.proname NOT IN ('fn_regional_source_ok','fn_sales_source_ok','fn_acceptance_source_findings','fn_acceptance_source_findings_raw')
UNION ALL
SELECT 'view',c.oid::regclass::text FROM pg_class c WHERE c.relkind IN ('v','m') AND EXISTS (SELECT 1 FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid
  JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
  WHERE r.ev_class=c.oid AND d.refobjid IN ('costing.regional_marketing_evidence_acceptance'::regclass,'costing.sales_allocation_quantity_driver_acceptance'::regclass)
    AND a.attname IN ('source_snapshot_id','regional_basis_snapshot_id','regional_marketing_snapshot_id'))
UNION ALL
-- any other table referencing the acceptance tables
SELECT 'fk_into_acceptance',conrelid::regclass::text||'.'||conname FROM pg_constraint WHERE contype='f' AND confrelid IN ('costing.regional_marketing_evidence_acceptance'::regclass,'costing.sales_allocation_quantity_driver_acceptance'::regclass);
