-- S3M: READ-ONLY FULL-DEPENDENCY INVENTORY FOR HISTORICAL RUN DETAIL.
-- Catalog-derived, no hardcoded 64-table deletion list. Produces one JSON
-- object per FK relation with exact run-id child column, backup designations,
-- delete action, pg size, and later-generation SQL to inventory per-run rows.
--
-- IMPORTANT: This is a catalog scan only. It DOES NOT prove that a child row
-- can be deleted, or even that every non-FK business reference was found.
WITH fks AS (
 SELECT con.oid,con.conname,con.conrelid,con.confrelid,con.confdeltype,
        con.conkey,con.confkey,con.convalidated
 FROM pg_constraint con
 WHERE con.contype='f'
   AND con.confrelid='costing.costing_refresh_run'::regclass
),
direct AS (
 SELECT f.conrelid AS relation_oid, n.nspname AS schema_name,
        c.relname AS table_name,
        f.conname AS fk_name, f.confdeltype AS on_delete,
        a.attname AS run_column,
        f.convalidated AS fk_validated,
        pg_total_relation_size(c.oid) AS allocated_bytes,
        EXISTS(
          SELECT 1 FROM pg_constraint inc
          WHERE inc.contype='f' AND inc.confrelid=c.oid
        ) AS referenced_by_other_fks,
        EXISTS(
          SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid
             AND NOT t.tgisinternal AND t.tgenabled<>'D'
        ) AS active_business_trigger
 FROM fks f
 JOIN pg_class c ON c.oid=f.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=f.conkey[1]
 WHERE array_length(f.conkey,1)=1
)
SELECT schema_name, table_name, run_column, fk_name, on_delete,
       fk_validated, allocated_bytes, referenced_by_other_fks,
       active_business_trigger,
       CASE
         WHEN table_name ~ '(acceptance|designation|approval|authorization|fingerprint|_stage$|behaviour_split)'
           THEN 'HOLD_GOVERNANCE_OR_STATE'
         WHEN referenced_by_other_fks THEN 'HOLD_NESTED_FK_REVIEW'
         ELSE 'DETAIL_CANDIDATE_REQUIRES_ARCHIVE_AND_GUARD'
       END AS preliminary_storage_class,
       format(
         'SELECT %L AS relation_name, %L AS run_column, count(*) AS matching_rows FROM %I.%I WHERE %I = 87;',
         schema_name||'.'||table_name,run_column,
         schema_name,table_name,run_column
       ) AS per_run_87_readonly_count_sql
FROM direct
ORDER BY allocated_bytes DESC, schema_name, table_name;

-- No output from this file is authorisation to DELETE, UPDATE or TRUNCATE.
-- Specifically preserve approval/acceptance/origin metadata regardless of
-- apparent absence of FK children. Review non-FK business consumers as well.
