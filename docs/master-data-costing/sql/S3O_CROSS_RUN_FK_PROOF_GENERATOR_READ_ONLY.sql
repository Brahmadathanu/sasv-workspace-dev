-- S3O: PG catalog-derived cross-run foreign-key integrity preview.
-- SELECT ONLY: generates one SQL SELECT per nested FK relation. Review each
-- generated statement and EXECUTE AS READ ONLY; never convert to DELETE.
-- A cross-run link must HOLD both runs until an explicit resolution is approved.
WITH direct AS (
 SELECT con.conrelid AS relid, att.attname AS run_column
 FROM pg_constraint con JOIN pg_attribute att
   ON att.attrelid=con.conrelid AND att.attnum=con.conkey[1]
 WHERE con.contype='f'
   AND con.confrelid='costing.costing_refresh_run'::regclass
   AND array_length(con.conkey,1)=1
),
nested AS (
 SELECT f.oid, f.conname, f.conrelid, f.confrelid, f.conkey, f.confkey,
        f.confdeltype, child.run_column AS child_run_column,
        parent.run_column AS parent_run_column
 FROM pg_constraint f
 JOIN direct child ON child.relid=f.conrelid
 JOIN direct parent ON parent.relid=f.confrelid
 WHERE f.contype='f'
),
joined_columns AS (
 SELECT f.oid, string_agg(format(
     'c.%I = p.%I', ca.attname,pa.attname
   ),' AND ' ORDER BY z.ordinality) AS join_sql
 FROM nested f
 JOIN LATERAL unnest(f.conkey,f.confkey) WITH ORDINALITY AS z(child_att,parent_att,ordinality) ON TRUE
 JOIN pg_attribute ca ON ca.attrelid=f.conrelid AND ca.attnum=z.child_att
 JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=z.parent_att
 GROUP BY f.oid
)
SELECT n.conname AS nested_fk, n.conrelid::regclass::text AS child_table,
       n.confrelid::regclass::text AS parent_table,
       n.confdeltype AS delete_action,
       format(
        'SELECT %L AS fk_name, count(*) AS cross_run_rows FROM %s c JOIN %s p ON %s WHERE c.%I IS DISTINCT FROM p.%I AND (c.%I = 87 OR p.%I = 87);',
        n.conname,n.conrelid::regclass,n.confrelid::regclass,j.join_sql,
        n.child_run_column,n.parent_run_column,n.child_run_column,n.parent_run_column
       ) AS run87_cross_link_count_sql
FROM nested n JOIN joined_columns j USING(oid)
ORDER BY child_table,parent_table,nested_fk;
-- FKs not recorded in the database catalog, external spreadsheets and view
-- consumers are separate review gates.
