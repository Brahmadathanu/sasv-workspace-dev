-- READ-ONLY generator for the REVIEWED purge allowlist. It prints INSERT candidates from the live catalog; a human must review every
-- line and edit the classification before anything is applied. Nothing here writes. Unknown => PERMANENT (fail closed).
-- Suggested heuristics (NOT authority): '*snapshot*' run-scoped detail => SNAPSHOT_PURGEABLE; scheme comparison cache => CACHE_PURGEABLE;
-- anything named acceptance/designation/approval/authorization/fingerprint/audit/ledger/receipt/event/register/split/cutover/behaviour => PERMANENT.
SELECT format('(%L,%L,%L,%L,''REVIEWER_NAME'',%L), -- %s allocated, run column %s',
  n.nspname,c.relname,a.attname,
  CASE WHEN c.relname ~ '(acceptance|designation|approval|authori[sz]ation|fingerprint|audit|ledger|receipt|event|register|split|cutover|behaviour|_stage$)' THEN 'PERMANENT'
       WHEN c.relname='sku_scheme_viability_snapshot' THEN 'CACHE_PURGEABLE'
       WHEN c.relname ~ 'snapshot' THEN 'SNAPSHOT_PURGEABLE'
       ELSE 'PERMANENT' END,
  'REVIEW: '||CASE WHEN c.relname ~ 'snapshot' THEN 'run-scoped detail?' ELSE 'governance/other?' END,
  pg_size_pretty(pg_total_relation_size(c.oid)),a.attname) AS values_row
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=con.conkey[1]
WHERE con.contype='f' AND con.confrelid='costing.costing_refresh_run'::regclass AND array_length(con.conkey,1)=1
ORDER BY pg_total_relation_size(c.oid) DESC;
-- Apply as:  INSERT INTO costing_retention.purge_allowlist(table_schema,table_name,run_column,classification,reviewed_by,note) VALUES <reviewed rows>;
-- then:      SELECT * FROM costing_retention.fn_purge_structural_blockers();   -- must be empty
