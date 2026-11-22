-- S3C / LIVE-VERIFIED CATALOGUE: CHILD-FIRST DEPENDENCY-ORDER INSPECTION
-- Read-only. Not a deletion executor. The depth is a priority heuristic,
-- not proof a table may be dropped/deleted, and cannot replace row-level FK checks.
WITH RECURSIVE run_children AS (
  SELECT DISTINCT conrelid AS relid
  FROM pg_constraint
  WHERE contype = 'f' AND confrelid='costing.costing_refresh_run'::regclass
),
edges AS (
  SELECT confrelid AS parent_oid, conrelid AS child_oid, conname, confdeltype
  FROM pg_constraint
  WHERE contype='f'
    AND (
      confrelid IN (SELECT relid FROM run_children)
      OR confrelid='costing.costing_refresh_run'::regclass
    )
),
walk AS (
  SELECT relid AS relation_oid, 0 AS depth, ARRAY[relid]::oid[] AS visited
  FROM run_children
  UNION ALL
  SELECT edges.child_oid, walk.depth+1, walk.visited || edges.child_oid
  FROM walk
  JOIN edges ON edges.parent_oid=walk.relation_oid
  WHERE NOT edges.child_oid = ANY(walk.visited)
    AND walk.depth < 25
),
depths AS (
  SELECT relation_oid, max(depth) AS max_child_depth
  FROM walk GROUP BY relation_oid
)
SELECT n.nspname AS schema_name, c.relname AS table_name,
       d.max_child_depth AS child_first_priority,
       pg_total_relation_size(c.oid) AS table_allocated_bytes,
       EXISTS (
         SELECT 1 FROM information_schema.columns col
         WHERE col.table_schema=n.nspname AND col.table_name=c.relname
           AND col.column_name='refresh_run_id'
       ) AS supports_direct_run_filter,
       EXISTS (
         SELECT 1 FROM pg_constraint fk
         WHERE fk.contype='f' AND fk.conrelid=c.oid
           AND fk.confrelid='costing.costing_refresh_run'::regclass
       ) AS has_direct_header_fk
FROM depths d
JOIN pg_class c ON c.oid=d.relation_oid
JOIN pg_namespace n ON n.oid=c.relnamespace
ORDER BY child_first_priority DESC, schema_name, table_name;

-- To test every child chain and detect cycles independently:
WITH RECURSIVE roots AS (
  SELECT DISTINCT conrelid AS oid
  FROM pg_constraint WHERE contype='f' AND confrelid='costing.costing_refresh_run'::regclass
), edges AS (
  SELECT confrelid AS parent, conrelid AS child, conname
  FROM pg_constraint WHERE contype='f'
), paths AS (
  SELECT oid AS root_oid, oid AS current_oid, ARRAY[oid]::oid[] AS visited,
         false AS cycle
  FROM roots
  UNION ALL
  SELECT p.root_oid,e.child,p.visited||e.child,
         e.child=ANY(p.visited)
  FROM paths p JOIN edges e ON e.parent=p.current_oid
  WHERE NOT p.cycle AND cardinality(p.visited)<26
)
SELECT COUNT(*) FILTER (WHERE cycle) AS cyclic_paths_found,
       MAX(cardinality(visited)-1) AS deepest_fk_hops,
       COUNT(DISTINCT current_oid) AS relations_seen
FROM paths;

-- Additional checks needed before any execution:
--  * non-FK references in RPCs, views, reports, or external spreadsheets
--  * row-level FK references crossing run IDs, and accepted evidence records
--  * existing October 143 approved fallback until November approved run is ready
--  * independent rollback archive, immutable governance and stage verifications
--  * concurrent writer, lock timeout, batch idempotence and selective vacuum plan
