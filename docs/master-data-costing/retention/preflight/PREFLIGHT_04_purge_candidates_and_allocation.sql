-- READ-ONLY preflight 04 (R4/R5/R6): run-linked inventory, candidate verdicts (after R1..R5 installed) and allocation estimates.
-- Allocated bytes != dead/reusable bytes != physically reclaimed bytes. Nothing below deletes or locks beyond catalog reads.
-- 4a. relations directly linked to a run header: expected 64 before R1/R2A (+ledger +evidence +receipts after) ; unindexed run columns flagged
SELECT n.nspname,c.relname,a.attname run_column,pg_size_pretty(pg_total_relation_size(c.oid)) allocated,c.reltuples::bigint est_rows,
  EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisvalid AND i.indkey[0]=con.conkey[1]) run_col_indexed,
  s.n_live_tup,s.n_dead_tup, round(100.0*s.n_dead_tup/greatest(s.n_live_tup+s.n_dead_tup,1),1) dead_pct
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=con.conkey[1] LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE con.contype='f' AND con.confrelid='costing.costing_refresh_run'::regclass AND array_length(con.conkey,1)=1
ORDER BY pg_total_relation_size(c.oid) DESC;
-- 4b. nested FK edges and which lack a leading index (each parent delete scans the child without one)
SELECT cn.nspname||'.'||cc.relname child,k.conname,pn.nspname||'.'||pc.relname parent,pg_size_pretty(pg_total_relation_size(cc.oid)) child_size,
  EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=cc.oid AND i.indisvalid AND i.indkey[0]=k.conkey[1]) leading_index
FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
WHERE k.contype='f' AND k.confrelid IN (SELECT conrelid FROM pg_constraint WHERE contype='f' AND confrelid='costing.costing_refresh_run'::regclass) AND k.confrelid<>'costing.costing_refresh_run'::regclass
ORDER BY pg_total_relation_size(cc.oid) DESC;
-- 4c. verdicts (requires R1-R5): planner result per run, today in Asia/Kolkata
-- SELECT * FROM costing_retention.fn_plan_retention();   -- ELIGIBLE / HOLD / RETAIN with reasons and blockers
-- 4d. per-run row and byte estimate for one candidate (indexed run columns only; NULL = not safely countable)
-- SELECT * FROM costing_retention.fn_purge_run_preview(<run_id>);
-- 4e. environment headroom and WAL for planning: retained WAL, replication slots, db size
SELECT pg_size_pretty(pg_database_size(current_database())) db_size,
  (SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir()) wal_dir,
  (SELECT count(*) FROM pg_replication_slots) replication_slots,
  current_setting('max_wal_size') max_wal_size,current_setting('autovacuum') autovacuum;
