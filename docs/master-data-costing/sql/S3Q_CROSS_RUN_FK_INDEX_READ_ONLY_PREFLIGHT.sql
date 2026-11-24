-- S3Q production READ-ONLY query planning preflight.
-- Shows whether referencing FK columns are covered by a leading index.
-- No CREATE INDEX: build only from measured plans and separately approved DDL.
WITH direct AS (
 SELECT DISTINCT conrelid AS rel
 FROM pg_constraint
 WHERE contype='f' AND confrelid='costing.costing_refresh_run'::regclass
), nested AS (
 SELECT f.oid,f.conname,f.conrelid,f.confrelid,f.conkey,
        f.conkey[1] AS first_fk_attnum
 FROM pg_constraint f
 WHERE f.contype='f'
   AND f.conrelid IN (SELECT rel FROM direct)
   AND f.confrelid IN (SELECT rel FROM direct)
)
SELECT n.conname AS fk_name,
       n.conrelid::regclass::text AS child_table,
       n.confrelid::regclass::text AS parent_table,
       pg_total_relation_size(n.conrelid) AS child_allocated_bytes,
       EXISTS (
         SELECT 1 FROM pg_index idx
         WHERE idx.indrelid=n.conrelid AND idx.indisvalid
           AND idx.indkey[0] = n.first_fk_attnum
       ) AS referring_fk_has_leading_index,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_index idx
         WHERE idx.indrelid=n.conrelid AND idx.indisvalid
           AND idx.indkey[0] = n.first_fk_attnum
       ) THEN 'INDEXED_REVIEW_QUERY_PLAN'
       ELSE 'UNINDEXED_HOLD_UNTIL_QUERY_PLAN_OR_OFFLINE_DATA_RESTORE'
       END AS production_audit_gate
FROM nested n
ORDER BY referring_fk_has_leading_index,
         pg_total_relation_size(n.conrelid) DESC,n.conname;

-- At 2026-11-24 inspection: 62 internal FKs, 14 leading indexed,
-- 48 missing a referring-side leading index. Index presence does not
-- independently prove efficient two-way cross-run verification.
-- No production writes or expensive joins are required for this inventory.
