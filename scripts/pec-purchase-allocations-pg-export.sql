-- Emits the REAL output of the five V1 RPCs (from the PG fixture database) as one JSON document in the
-- PostgREST shape (paged = [{row_data,total_count}], summary = object). Run after
-- scripts/pec-purchase-allocations-pg-fixture.sql in the same database:
--   psql -X -At -f scripts/pec-purchase-allocations-pg-export.sql > pa-contract.json   (single day 23 Nov 2026)
SELECT set_config('pec.fixture_access', 'view', false) \g /dev/null
WITH p AS (SELECT '2026-11-23'::date d1, '2026-11-23'::date d2)
SELECT jsonb_pretty(jsonb_build_object(
 'summary', (SELECT proc_pec_purchase_alloc_summary(d1, d2) FROM p),
 'summary_filtered', (SELECT proc_pec_purchase_alloc_summary('2026-11-23', '2026-11-23', p_q => 'Root', p_indent_q => '300')),
 'indent', (SELECT jsonb_agg(jsonb_build_object('row_data', row_data, 'total_count', total_count)) FROM p, proc_pec_purchase_alloc_indent_paged(d1, d2, p_limit => 200)),
 'material', (SELECT jsonb_agg(jsonb_build_object('row_data', row_data, 'total_count', total_count)) FROM p, proc_pec_purchase_alloc_material_paged(d1, d2, p_limit => 200)),
 'material_filtered', (SELECT jsonb_agg(jsonb_build_object('row_data', row_data, 'total_count', total_count)) FROM proc_pec_purchase_alloc_material_paged('2026-11-23', '2026-11-23', p_q => 'Root', p_indent_q => '300')),
 'vendor', (SELECT jsonb_agg(jsonb_build_object('row_data', row_data, 'total_count', total_count)) FROM p, proc_pec_purchase_alloc_vendor_paged(d1, d2, p_limit => 200)),
 'trail', (SELECT jsonb_agg(jsonb_build_object('row_data', row_data, 'total_count', total_count)) FROM p, proc_pec_purchase_alloc_trail_paged(d1, d2, p_limit => 200)),
 'trail_filtered', (SELECT jsonb_agg(jsonb_build_object('row_data', row_data, 'total_count', total_count)) FROM proc_pec_purchase_alloc_trail_paged('2026-11-23', '2026-11-23', p_q => 'Root', p_indent_q => '300'))
));
