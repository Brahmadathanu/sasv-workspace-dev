-- DISPOSABLE LOCAL FIXTURE ONLY. Synthetic data, minimal stubs. Never run against Supabase.
-- Mirrors the *shape* (not the contents) of costing.cost_sheet_line_monthly_snapshot as documented in
-- docs/master-data-costing/CSR_READ_TIMEOUT_DIAGNOSIS_2026-11-05.md (indexes, ~1.4M rows, 63-col governed view).
\set ON_ERROR_STOP on
DROP SCHEMA IF EXISTS costing CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA costing; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.require_permission(text, boolean) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.app_has_permission(text, text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

CREATE TABLE costing.cost_sheet_line_monthly_snapshot (
  snapshot_period_start date NOT NULL, valuation_date date NOT NULL, refresh_run_id bigint NOT NULL,
  product_id int NOT NULL, product_name text, category_name text, subcategory_name text, group_name text, sub_group_name text,
  sku_id int NOT NULL, sku_column_label text,
  line_order int NOT NULL, line_label text NOT NULL, value_numeric numeric, value_text text, snapshot_refreshed_at timestamptz);
-- stub of the governed-run selector (production: ranked APPROVED else LATEST_SUCCESS per period)
CREATE TABLE costing.governed_run_stub (period_start date, refresh_run_id bigint, selection_basis text, valuation_date date);
CREATE VIEW costing.v_current_successful_costing_refresh_run AS SELECT * FROM costing.governed_run_stub;

CREATE TEMP TABLE labels(ord int, lbl text, txt boolean);
INSERT INTO labels VALUES
(1,'Raw Material Cost (RM)',false),(2,'Packing & Labelling Material Cost (PM)',false),(3,'Total Material Cost',false),
(4,'Direct Labour (DL)',false),(5,'Manufacturing COP',false),(6,'Internal Loaded Cost',false),
(7,'MRP: Inside Kerala (MRP IK)',false),(8,'MRP: Outside Kerala (MRP OK)',false),(9,'Selling Price: IK',false),
(10,'Selling Price: OK',false),(11,'Sales Realisation: IK',false),(12,'Sales Realisation: OK',false),
(13,'Profit Value: IK',false),(14,'Profit Value: OK',false),(15,'Profit on Sales Realisation: IK (%)',false),
(16,'Profit on Sales Realisation: OK (%)',false),(17,'COP Percentage on MRP IK',false),(18,'COP Percentage on MRP OK',false),
(19,'Cost Sheet Status',true),(20,'Cost Sheet Note',true),
(21,'Filler A',false),(22,'Filler B',false),(23,'Filler C',false),(24,'Filler D',false),
(25,'Filler E',false),(26,'Filler F',false),(27,'Filler G',false),(28,'Filler H',false),
(29,'Filler I',false),(30,'Filler J',false),(31,'Filler K',false),(32,'Filler L',false);

-- 35 periods (2024-01..2026-11), 2 runs each (governed + superseded draft), 630 SKUs, 32 lines ~= 1.41M rows.
-- 2025-11 is deliberately absent (no previous-year comparison for Nov 2026, as observed live).
-- run ids: period index*4 for governed, +1 for superseded draft; Oct 2026 governed = 143 APPROVED, Nov 2026 governed = 149 LATEST_SUCCESS.
CREATE TEMP TABLE periods AS
SELECT (date '2024-01-01' + (g||' month')::interval)::date AS p, g AS idx FROM generate_series(0,34) g
WHERE (date '2024-01-01' + (g||' month')::interval)::date <> date '2025-11-01';
CREATE TEMP TABLE runs AS
SELECT p, CASE p WHEN date '2026-10-01' THEN 143 WHEN date '2026-11-01' THEN 149 ELSE 1000+idx*4 END AS run_id,
       CASE p WHEN date '2026-11-01' THEN 'LATEST_SUCCESS' ELSE 'APPROVED' END AS basis, true AS governed FROM periods
UNION ALL SELECT p, CASE p WHEN date '2026-11-01' THEN 148 ELSE 1001+idx*4 END, 'SUPERSEDED', false FROM periods;
INSERT INTO costing.governed_run_stub SELECT p, run_id, basis, p+1 FROM runs WHERE governed;

-- Insert everything EXCEPT Nov 2026 first so statistics can be taken "stale" (as live: autoanalyse 24 Oct, pre-Nov).
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT r.p, r.p+1, r.run_id, (s % 90)+1, 'Product '||lpad(((s % 90)+1)::text,3,'0'), 'Cat '||(s%7), 'Sub '||(s%13), 'Grp '||(s%11), 'SGrp '||(s%17),
       s, 'SKU '||lpad(s::text,4,'0'), l.ord, l.lbl,
       CASE WHEN l.txt THEN NULL ELSE round((random()*1000)::numeric,4) END,
       CASE WHEN l.txt THEN CASE WHEN l.ord=19 THEN 'COMPLETE' ELSE 'note' END END, now()
FROM runs r CROSS JOIN generate_series(1,630) s CROSS JOIN labels l
WHERE r.p <> date '2026-11-01'
ORDER BY r.p, r.run_id, s, l.ord;

CREATE INDEX idx_cost_sheet_monthly_exact_tuple ON costing.cost_sheet_line_monthly_snapshot (snapshot_period_start, valuation_date, refresh_run_id);
CREATE INDEX idx_cost_sheet_snapshot_period_product ON costing.cost_sheet_line_monthly_snapshot (snapshot_period_start, product_id);
CREATE INDEX idx_cost_sheet_snapshot_period_sku ON costing.cost_sheet_line_monthly_snapshot (snapshot_period_start, sku_id);
CREATE INDEX idx_cost_sheet_monthly_run_sku ON costing.cost_sheet_line_monthly_snapshot (refresh_run_id, sku_id);
CREATE UNIQUE INDEX uq_cost_sheet_monthly_snapshot_line ON costing.cost_sheet_line_monthly_snapshot (snapshot_period_start, valuation_date, refresh_run_id, sku_id, line_order, line_label);
ANALYZE costing.cost_sheet_line_monthly_snapshot;   -- statistics WITHOUT Nov 2026 (stale scenario)

INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT r.p, r.p+1, r.run_id, (s % 90)+1, 'Product '||lpad(((s % 90)+1)::text,3,'0'), 'Cat '||(s%7), 'Sub '||(s%13), 'Grp '||(s%11), 'SGrp '||(s%17),
       s, 'SKU '||lpad(s::text,4,'0'), l.ord, l.lbl,
       CASE WHEN l.txt THEN NULL ELSE round((random()*1000)::numeric,4) END,
       CASE WHEN l.txt THEN CASE WHEN l.ord=19 THEN 'COMPLETE' ELSE 'note' END END, now()
FROM runs r CROSS JOIN generate_series(1,630) s CROSS JOIN labels l
WHERE r.p = date '2026-11-01'
ORDER BY r.p, r.run_id, s, l.ord;
SELECT 'rows' k, count(*) FROM costing.cost_sheet_line_monthly_snapshot;
