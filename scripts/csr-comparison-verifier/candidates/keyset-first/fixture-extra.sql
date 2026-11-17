-- Extra SYNTHETIC fixture for the keyset-first candidate (opt-in; loaded after sql/fixture-data.sql). Deterministic, no clock/random.
-- Periods: Y0 = 2027-05-01 (previous-year base), M0 = 2028-04-01 (previous month, governed DRAFT), C = 2028-05-01 (current, APPROVED),
-- 2028-06-01 (previous month = C, no previous year).
-- Every current group has a UNIQUE (product_name, sku_column_label, sku_id) so ordering is fully determined except the intentional
-- fan-out ties (one current group x several historical groups share identical sort keys).
CREATE TABLE costing.fx_periods (p date PRIMARY KEY, run_id bigint NOT NULL, basis text NOT NULL);
INSERT INTO costing.fx_periods VALUES ('2027-05-01', 5001, 'APPROVED'), ('2028-04-01', 5002, 'DRAFT'), ('2028-05-01', 5003, 'APPROVED'), ('2028-06-01', 5004, 'APPROVED');
INSERT INTO costing.fixture_governed_run SELECT p, run_id, basis FROM costing.fx_periods;

-- Helper: write one whole sku group (all 21 labels). p_zero_cop => Manufacturing COP = 0; p_nulls => every numeric/text NULL.
CREATE FUNCTION costing.fx_put(p_period date, p_run bigint, p_sku bigint, p_prod text, p_label text, p_v numeric,
                               p_zero_cop boolean DEFAULT false, p_nulls boolean DEFAULT false, p_cat text DEFAULT 'FX Cat') RETURNS void
LANGUAGE sql AS $$
  INSERT INTO costing.cost_sheet_line_monthly_snapshot
  SELECT p_period, p_run, p_sku, p_prod, p_cat, 'FX Sub', 'FX Grp', 'FX SG', p_sku, p_label, l.label,
    CASE WHEN l.is_text THEN NULL WHEN p_nulls THEN NULL WHEN l.idx = 5 AND p_zero_cop THEN 0 ELSE p_v + l.idx * 1.25 END,
    CASE WHEN NOT l.is_text THEN NULL WHEN p_nulls THEN NULL WHEN l.idx = 19 THEN 'OK' ELSE 'fx ' || p_sku END,
    p_period + interval '10 days' + (p_sku % 1000 || ' minutes')::interval
  FROM costing.fixture_labels l $$;

-- 200001 A: NAME CHANGE across runs. C = 'FX Alpha New'; M0 = 'FX Alpha Old'; Y0 has TWO groups => 1x1x2 fan-out.
SELECT costing.fx_put('2028-05-01', 5003, 200001, 'FX Alpha New', 'A-L', 100);
SELECT costing.fx_put('2028-04-01', 5002, 200001, 'FX Alpha Old', 'A-L', 90);
SELECT costing.fx_put('2027-05-01', 5001, 200001, 'FX Alpha Older', 'A-L', 80);
SELECT costing.fx_put('2027-05-01', 5001, 200001, 'FX Alpha Legacy', 'A-L2', 70);
-- 200002 B: DUPLICATE SKU in the CURRENT period (two current groups) and two previous-month groups => 2x2 (x1 yoy).
SELECT costing.fx_put('2028-05-01', 5003, 200002, 'FX Beta', 'B-L', 110);
SELECT costing.fx_put('2028-05-01', 5003, 200002, 'FX Beta Renamed', 'B-L', 111, p_cat => 'FX Cat 2');
SELECT costing.fx_put('2028-04-01', 5002, 200002, 'FX Beta P1', 'B-L', 100);
SELECT costing.fx_put('2028-04-01', 5002, 200002, 'FX Beta P2', 'B-L', 101);
SELECT costing.fx_put('2027-05-01', 5001, 200002, 'FX Beta', 'B-L', 95);
-- 200003 C: ALL numeric/text values NULL (current, previous month, previous year) and a NULL sku_column_label.
SELECT costing.fx_put('2028-05-01', 5003, 200003, 'FX Gamma', NULL, 0, p_nulls => true);
SELECT costing.fx_put('2028-04-01', 5002, 200003, 'FX Gamma', NULL, 0, p_nulls => true);
SELECT costing.fx_put('2027-05-01', 5001, 200003, 'FX Gamma', NULL, 0, p_nulls => true);
-- 200004 D: MISSING previous month (has previous year).   200005 E: MISSING previous year (has previous month).
SELECT costing.fx_put('2028-05-01', 5003, 200004, 'FX Delta', 'D-L', 120);
SELECT costing.fx_put('2027-05-01', 5001, 200004, 'FX Delta', 'D-L', 100);
SELECT costing.fx_put('2028-05-01', 5003, 200005, 'FX Epsilon', 'E-L', 130);
SELECT costing.fx_put('2028-04-01', 5002, 200005, 'FX Epsilon', 'E-L', 125);
-- 200006 F: NO history at all.
SELECT costing.fx_put('2028-05-01', 5003, 200006, 'FX Zeta', 'Z-L', 140);
-- 200007 G: NULL product_name (sorts last) and ZERO previous-month COP (percent NULL, numeric change defined).
SELECT costing.fx_put('2028-05-01', 5003, 200007, NULL, 'G-L', 150);
SELECT costing.fx_put('2028-04-01', 5002, 200007, NULL, 'G-L', 140, p_zero_cop => true);
-- NULL sku_id: a current group with NULL sku_id (must be kept, never joins history) + a NULL-sku_id previous-month group (must not join).
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT p, r, NULL, 'FX NoSku', 'FX Cat', 'FX Sub', 'FX Grp', 'FX SG', NULL, 'N-L', l.label,
  CASE WHEN l.is_text THEN NULL ELSE 10 + l.idx END, CASE WHEN l.is_text THEN 'nosku' END, p + interval '11 days'
FROM (VALUES ('2028-05-01'::date, 5003::bigint), ('2028-04-01'::date, 5002::bigint)) v(p, r) CROSS JOIN costing.fixture_labels l;
-- 200008 H: only a NON-governed run exists for the previous month (decoy) => previous month must be NULL.
SELECT costing.fx_put('2028-05-01', 5003, 200008, 'FX Eta', 'H-L', 160);
SELECT costing.fx_put('2028-04-01', 5902, 200008, 'FX Eta', 'H-L', 999);
-- Fillers 200010..200029: tie-free ordering for limit-boundary sweeps (some with previous month, some with previous year).
SELECT costing.fx_put('2028-05-01', 5003, 200000 + n, 'FX Fill ' || lpad(n::text, 3, '0'), 'F-' || n, 200 + n) FROM generate_series(10, 29) n;
SELECT costing.fx_put('2028-04-01', 5002, 200000 + n, 'FX Fill ' || lpad(n::text, 3, '0'), 'F-' || n, 190 + n) FROM generate_series(10, 29) n WHERE n % 2 = 0;
SELECT costing.fx_put('2027-05-01', 5001, 200000 + n, 'FX Fill ' || lpad(n::text, 3, '0'), 'F-' || n, 150 + n) FROM generate_series(10, 29) n WHERE n % 3 = 0;
-- Alternate (NON-governed) run of the CURRENT period with different values: run-selection tests flip the pointer to it in-test.
SELECT costing.fx_put('2028-05-01', 5903, 200001, 'FX Alpha ALT', 'A-L', 555);
SELECT costing.fx_put('2028-05-01', 5903, 200010, 'FX Fill 010 ALT', 'F-10', 777);
-- 2028-06: previous month = C (approved), no previous year.
SELECT costing.fx_put('2028-06-01', 5004, 200001, 'FX Alpha New', 'A-L', 105);
SELECT costing.fx_put('2028-06-01', 5004, 200010, 'FX Fill 010', 'F-10', 210);
ANALYZE costing.cost_sheet_line_monthly_snapshot;
