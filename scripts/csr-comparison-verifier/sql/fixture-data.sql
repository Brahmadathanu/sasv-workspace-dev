-- Deterministic fixture data (no random(), no clock). Periods 2025-01..2026-11 for 40 small SKUs (+7-period synthetic window
-- 2026-01..2026-07 is a subset), governed-run decoys, duplicate SKU/group keys, NULLs, zero denominators, and a 2105-SKU
-- cap month (2027-03) whose previous month (2027-02) holds 600 of them.
CREATE TABLE costing.fixture_labels (idx int PRIMARY KEY, label text NOT NULL, is_text boolean NOT NULL);
INSERT INTO costing.fixture_labels VALUES
 (1,'Raw Material Cost (RM)',false),(2,'Packing & Labelling Material Cost (PM)',false),(3,'Total Material Cost',false),
 (4,'Direct Labour (DL)',false),(5,'Manufacturing COP',false),(6,'Internal Loaded Cost',false),
 (7,'MRP: Inside Kerala (MRP IK)',false),(8,'MRP: Outside Kerala (MRP OK)',false),(9,'Selling Price: IK',false),
 (10,'Selling Price: OK',false),(11,'Sales Realisation: IK',false),(12,'Sales Realisation: OK',false),
 (13,'Profit Value: IK',false),(14,'Profit Value: OK',false),(15,'Profit on Sales Realisation: IK (%)',false),
 (16,'Profit on Sales Realisation: OK (%)',false),(17,'COP Percentage on MRP IK',false),(18,'COP Percentage on MRP OK',false),
 (19,'Cost Sheet Status',true),(20,'Cost Sheet Note',true),(21,'Unrelated Line (ignored by pivot)',false);

CREATE TABLE costing.fixture_periods AS
  SELECT d::date AS p, (row_number() OVER (ORDER BY d))::int AS i
  FROM generate_series('2025-01-01'::date, '2026-11-01'::date, interval '1 month') d;
INSERT INTO costing.fixture_periods VALUES ('2027-02-01', 100), ('2027-03-01', 101);

-- Governed run per period (2026-10 is a DRAFT run to exercise label/basis columns). 2024-01 deliberately has no run.
INSERT INTO costing.fixture_governed_run
  SELECT p, 1000 + i, CASE WHEN p = '2026-10-01' THEN 'DRAFT' ELSE 'APPROVED' END FROM costing.fixture_periods;

-- Small SKUs 1..40, governed runs only.
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT p.p, 1000 + p.i, s AS product_id,
  CASE WHEN s = 33 AND p.p = '2026-11-01' THEN NULL ELSE 'Product ' || lpad(((s + 1) / 2)::text, 3, '0') END,
  'Cat ' || (s % 3), 'Sub ' || (s % 5), 'Grp ' || (s % 4), 'SG ' || (s % 2), s,
  CASE WHEN s = 34 AND p.p = '2026-11-01' THEN NULL ELSE 'SKU ' || lpad(s::text, 3, '0') END,
  l.label,
  CASE WHEN l.is_text THEN NULL
       WHEN (s + l.idx) % 17 = 0 THEN NULL
       WHEN l.idx = 5 AND s % 10 = 0 AND p.p = '2026-10-01' THEN 0
       ELSE ((s * 37 + p.i * 13 + l.idx * 101) % 5000) / 100.0 END,
  CASE WHEN NOT l.is_text THEN NULL
       WHEN l.idx = 19 THEN CASE WHEN s % 2 = 0 THEN 'OK' ELSE 'Review' END
       WHEN s % 3 = 0 THEN NULL ELSE 'note ' || s END,
  p.p + interval '20 days' + (s || ' minutes')::interval
FROM costing.fixture_periods p CROSS JOIN generate_series(1, 40) s CROSS JOIN costing.fixture_labels l
WHERE p.i <= 23
  AND NOT (s % 9 = 0 AND p.p = '2026-10-01')          -- previous-month gap for Nov
  AND NOT (s % 11 = 0 AND p.p = '2025-11-01')         -- previous-year gap for Nov 2026
  AND NOT (s = 40 AND p.p < '2026-11-01');            -- brand-new SKU in the latest month

-- Decoys that the governed-run join must exclude: (a) non-governed run ids for the same period, (b) a governed run id of a
-- DIFFERENT period attached to a Nov row (period mismatch).
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT p.p, 9000 + p.i, s, 'Product DECOY', 'Cat X', 'Sub X', 'Grp X', 'SG X', s, 'SKU DECOY', l.label,
  CASE WHEN l.is_text THEN NULL ELSE 1000000 + s END, CASE WHEN l.is_text THEN 'DECOY' END, now()
FROM costing.fixture_periods p CROSS JOIN generate_series(1, 10) s CROSS JOIN costing.fixture_labels l
WHERE p.p IN ('2026-09-01','2026-10-01','2026-11-01');
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT '2026-11-01', 1000 + i, s, 'Product MISMATCH', 'Cat X', 'Sub X', 'Grp X', 'SG X', s, 'SKU MISMATCH', l.label,
  CASE WHEN l.is_text THEN NULL ELSE 777 END, CASE WHEN l.is_text THEN 'MISMATCH' END, now()
FROM costing.fixture_periods p CROSS JOIN generate_series(1, 5) s CROSS JOIN costing.fixture_labels l
WHERE p.p = '2026-10-01';

-- Duplicate SKU/group keys: SKU 7 has a second (product_name, label) group in Oct AND Nov => 2x2 join fan-out in Nov.
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT p.p, 1000 + p.i, 7, 'Dup Product', 'Cat D', 'Sub D', 'Grp D', 'SG D', 7, 'Dup Label ' || extract(month FROM p.p), l.label,
  CASE WHEN l.is_text THEN NULL ELSE 50 + l.idx END, CASE WHEN l.is_text THEN 'dup' END, p.p + interval '25 days'
FROM costing.fixture_periods p CROSS JOIN costing.fixture_labels l
WHERE p.p IN ('2026-10-01','2026-11-01') AND l.idx IN (5, 6, 9, 13, 19);
-- Duplicate line_label inside one group: max() must pick the larger (SKU 8, Nov Manufacturing COP).
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT '2026-11-01', 1000 + i, 8, 'Product ' || lpad(((8 + 1) / 2)::text, 3, '0'), 'Cat ' || (8 % 3), 'Sub ' || (8 % 5), 'Grp ' || (8 % 4), 'SG ' || (8 % 2), 8,
  'SKU 008', 'Manufacturing COP', 99999.99, NULL, now()
FROM costing.fixture_periods WHERE p = '2026-11-01';

-- Cap month: 2105 SKUs in 2027-03 (cap 2000 must bite), 600 of them in 2027-02. Three lines each.
INSERT INTO costing.cost_sheet_line_monthly_snapshot
SELECT p.p, 1000 + p.i, 100000 + n, 'Bulk ' || lpad(n::text, 6, '0'), 'Cat B', 'Sub B', 'Grp B', 'SG B', 100000 + n, 'BULK ' || lpad(n::text, 6, '0'),
  l.label, CASE WHEN l.is_text THEN NULL ELSE ((n * 31 + l.idx * 7 + p.i) % 9000) / 10.0 END, CASE WHEN l.is_text THEN 'OK' END,
  p.p + interval '3 days'
FROM costing.fixture_periods p JOIN costing.fixture_labels l ON l.idx IN (5, 6, 19)
CROSS JOIN generate_series(1, 2105) n
WHERE (p.p = '2027-03-01') OR (p.p = '2027-02-01' AND n <= 600);
ANALYZE costing.cost_sheet_line_monthly_snapshot;
