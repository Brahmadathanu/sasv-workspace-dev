-- ISOLATED ONLY. Alternative aggregation (group-by-period then sum) tested as "v_candB" against the applied LATERAL view copy "v_base".
-- v_base = body of the applied migration 20261108082334 with the view renamed; v_candB = same, only the LATERAL subquery replaced by:
--   LEFT JOIN LATERAL (SELECT COALESCE(sum(g.c),0)::bigint AS vs_snapshot_count, count(g.period_start) AS vs_period_count, max(g.period_start) AS vs_latest_period
--     FROM (SELECT s.period_start, count(*) AS c FROM costing.sku_scheme_viability_snapshot s WHERE s.scheme_id = sm.id GROUP BY s.period_start) g) viab ON true
-- Parity (all 34 columns, all 7 rows, both directions) -> expected 0 | 7
select (select count(*) from (select * from v_base except select * from v_candB) x) + (select count(*) from (select * from v_candB except select * from v_base) y) as diff_rows,
       (select count(*) from v_base) as rows_base;
