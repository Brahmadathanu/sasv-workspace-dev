-- ======================================================================================================================
-- MIS G7 reporting reconciliation — READ ONLY. Run by the owner / server lane in the Supabase SQL editor (role postgres) BEFORE accepting the
-- reporting candidate. It recomputes, with INDEPENDENT SQL, the figures the Executive MIS "Production evidence status" section reads from
-- public.mis_get_governance_exception_summary_v1, so the dashboard can be compared with the base tables. Nothing here writes
-- (BEGIN READ ONLY ... ROLLBACK). Replace the two dates in each query's `p` CTE (the dashboard window; max 92 days).
-- Each query is validated in CI against the isolated PostgreSQL fixture (scripts/mis-g7-reporting/reconcile.pg.test.mjs); it has NOT been run
-- against production by the author (no production access from the implementation environment).
-- ======================================================================================================================
begin read only;

-- @Q1 window totals — must equal the dashboard: total_batches, PACKING_LINES, PACKING_LINES_WITHOUT_DEPLETION (same "distinct" units as the RPC).
with p as (select date '2026-10-26' as d_from, date '2026-11-24' as d_to),
logs as (
  select pr.id as pid, w.batch_number from public.daily_work_log w join public.products pr on pr.item = w.item, p
   where w.log_date between p.d_from and p.d_to and w.activity = 'FG bulk storage' and btrim(coalesce(w.batch_number, '')) <> ''),
pack as (
  select pr.id as pid, w.batch_number, es.id as line_id
    from public.daily_work_log w join public.products pr on pr.item = w.item
    join public.packaging_events pe on pe.work_log_id = w.id
    join public.event_type_lkp e on e.label = pe.event_type::text and e.active and e.is_packaging and e.affects_bulk_stock < 0
    join public.event_skus es on es.packaging_event_id = pe.id, p
   where w.log_date between p.d_from and p.d_to and btrim(coalesce(w.batch_number, '')) <> ''),
nodep as (
  select * from pack pl where not exists (
    select 1 from public.fg_bulk_stock_ledger g where g.source_table = 'event_skus' and g.source_id = pl.line_id::integer
       and g.product_id = pl.pid and g.batch_number = pl.batch_number and g.qty_base < 0))
select (select count(*) from (select pid, batch_number from logs union select pid, batch_number from pack) b) as total_batches,
       (select count(*) from pack) as packing_lines,
       (select count(*) from nodep) as packing_lines_without_depletion;

-- @Q2 FG receipt evidence over ALL positive FG bulk storage logs (reference for the 1,671 OK / 9 missing figure of 24 Nov 2026; counts drift as logs are added).
select coalesce(app_private.mis_g7_fg_receipt(pr.id, w.batch_number, w.id)->>'code', 'NULL') as receipt_code, count(*) as logs
  from public.daily_work_log w join public.products pr on pr.item = w.item
 where w.activity = 'FG bulk storage' and w.storage_qty > 0
 group by 1 order by 1;

-- @Q3 governed-evidence footprint — expected today: no assignments of the five operational targets, no governed batches signed unless the owner activated it.
select (select count(*) from app_private.mis_batch_stage_event) as stage_events,
       (select count(*) from public.user_permissions_canonical where target in ('module:mis-batch-stage-signer','module:mis-fg-bulk-packing',
          'module:mis-fg-excess-adjustment','module:mis-g7-enforcement-admin','module:mis-g7-core-migration-signoff','module:mis-batch-governance')) as operational_assignments;

rollback;
