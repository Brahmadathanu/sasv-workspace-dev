-- Offline fixture schema (#282). Reconstruction for regression purposes only: it is NOT a catalogue dump of production.
-- Table/column names are those the installed function body references; types are fixture assumptions (see docs).
CREATE SCHEMA costing; CREATE SCHEMA auth;
CREATE TABLE costing.cost_sheet_line_monthly_snapshot (
  snapshot_period_start date NOT NULL, refresh_run_id bigint NOT NULL,
  product_id bigint, product_name text, category_name text, subcategory_name text, group_name text, sub_group_name text,
  sku_id bigint, sku_column_label text, line_label text NOT NULL, value_numeric numeric, value_text text,
  snapshot_refreshed_at timestamptz);
CREATE INDEX idx_cost_sheet_monthly_exact_tuple ON costing.cost_sheet_line_monthly_snapshot (snapshot_period_start, refresh_run_id);
-- Governed-run pointer stand-in (real one is a view; only these three columns are consumed by the body).
CREATE TABLE costing.fixture_governed_run (period_start date PRIMARY KEY, refresh_run_id bigint NOT NULL, selection_basis text NOT NULL);
CREATE VIEW costing.v_current_successful_costing_refresh_run AS SELECT period_start, refresh_run_id, selection_basis FROM costing.fixture_governed_run;
-- Identity stubs controlled by session GUCs so guard paths are testable: fixture.uid (empty = unauthenticated), fixture.perm ('allow' | 'deny').
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('fixture.uid', true), '')::uuid $$;
CREATE FUNCTION public.require_permission(p_key text, p_edit boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF coalesce(current_setting('fixture.perm', true), 'deny') <> 'allow' THEN
  RAISE EXCEPTION 'denied' USING ERRCODE = 'P0001', DETAIL = 'denied:true'; END IF; END $$;
