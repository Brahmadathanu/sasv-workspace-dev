-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $$
DECLARE
  v_actor uuid := 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid;
  v_source jsonb := jsonb_build_object(
    'source_file','CS - RM RATES',
    'spreadsheet_id','14Rgm4x7lj18Kuw8k5gksNg5RAhi2TyLfC2yFCt3BGl4',
    'sheet_name','MANUAL AND OTHER RM RATES',
    'evidence_date','2026-09-04',
    'purpose','Gate 6C governed costing rate evidence'
  );
BEGIN
  INSERT INTO costing.material_manual_rates
    (stock_item_id, rate_value, rate_uom_id, effective_from, reason, status,
     created_by, last_updated_by, rate_origin, source_snapshot)
  SELECT i.id, x.rate_value, i.default_uom_id, DATE '2026-09-04',
         'Governed costing rate adopted from CS - RM RATES / MANUAL AND OTHER RM RATES on 2026-09-04 for an otherwise unresolved required material rate.',
         'ACTIVE', v_actor, v_actor, 'MANUAL_ENTRY',
         v_source || jsonb_build_object('sheet_item_name',x.item_name,'sheet_rate',x.rate_value)
  FROM (VALUES
    ('Apheen'::text, 600::numeric),
    ('Arayaalin Patta (D)', 63.06),
    ('Bacopa monnieri Extract 20%', 1500),
    ('Brandy', 1493.33),
    ('Cherupayar Parippu', 70),
    ('Ithi Patta (D)', 63.06),
    ('Karuvilanchi Kootam (D)', 300),
    ('Kattu Padavala Thandu (F)', 30),
    ('Oolan Thakara (F)', 30),
    ('Pambin Kandam', 1000),
    ('Phyllanthus amarus Extract 2.5%', 1500),
    ('Siriyar Nangai (F)', 30),
    ('Thaivela (D)', 60),
    ('Udumbu - Valuthu', 1500),
    ('Vettila Valli (D)', 60)
  ) AS x(item_name, rate_value)
  JOIN inv_stock_item i ON i.name=x.item_name AND i.active=true
  WHERE NOT EXISTS (
    SELECT 1 FROM costing.material_manual_rates m
    WHERE m.stock_item_id=i.id
      AND m.status='ACTIVE'
      AND m.effective_from <= DATE '2026-09-04'
      AND (m.effective_to IS NULL OR m.effective_to >= DATE '2026-09-04')
  );
END $$;