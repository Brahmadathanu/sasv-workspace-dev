-- ROLLBACK for candidate_index.UNAPPLIED.sql. Review-only. Run outside a transaction. Pure index drop: no data, view, grant or flag is involved.
drop index concurrently if exists costing.idx_sku_scheme_viability_snapshot_scheme_period;
