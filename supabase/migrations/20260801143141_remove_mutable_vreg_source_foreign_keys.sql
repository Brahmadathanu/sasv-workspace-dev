-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table costing.marketing_signed_billed_sales_evidence_snapshot
    drop constraint if exists marketing_sales_evidence_source_fk;

alter table costing.marketing_regional_sales_evidence_snapshot
    drop constraint if exists marketing_regional_evidence_source_fk;

comment on column costing.marketing_signed_billed_sales_evidence_snapshot.source_sales_row_id is
'Frozen source-row lineage identifier from public.tally_sales_vreg_snapshot. Intentionally not enforced by a foreign key because the ETL-managed source table is reloadable and may replace source rows after the immutable costing snapshot is captured.';

comment on column costing.marketing_regional_sales_evidence_snapshot.source_sales_row_id is
'Frozen source-row lineage identifier from public.tally_sales_vreg_snapshot. Intentionally not enforced by a foreign key because the ETL-managed source table is reloadable and may replace source rows after the immutable costing snapshot is captured.';

commit;