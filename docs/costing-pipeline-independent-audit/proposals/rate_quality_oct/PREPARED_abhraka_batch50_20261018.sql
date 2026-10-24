-- PREPARED, NOT APPLIED. Abhraka Bhasmam (product 54) standard batch 100 -> 50 kg (user statement 2026-10-18).
-- Route: governed RPC public.rpc_revise_supply_batch_size_reference (needs module:supply-batch-plan). It supersedes ref 501
-- (sets effective_to 2026-09-30) and inserts a new ref with supersedes_reference_id=501.
-- Effective 2026-10-01: Sep (valuation 2026-09-10) still resolves 100 kg by date (resolution ignores is_active), so run 122 is unchanged.
-- BOM: NO change. rm_bom_header 2821 (100 kg ref output, loss 0.1, 27 lines) is line-for-line identical to Abhraka Chendooram 2777, which already runs on a 50 kg batch.
-- Material cost is a ratio (line qty / (ref output x (1-loss))), so it is independent of batch size.
-- Guarded style as AU-2c (exact current values, exactly 1 row; ends in ROLLBACK until approved).
begin;
set local lock_timeout = '5s';
select set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
select set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6', true);
do $$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then raise exception 'run in progress'; end if;
  if not exists (select 1 from public.production_batch_size_ref where id=501 and product_id=54 and preferred_batch_size=100 and is_active and effective_to is null)
    then raise exception 'ref 501 moved'; end if;
  if (select reference_output_qty from public.rm_bom_header where id=2821 and product_id=54) <> 100 then raise exception 'BOM 2821 moved'; end if;
end $$;
select public.rpc_revise_supply_batch_size_reference(501, 50, 50, 50, date '2026-10-01',
  'User-confirmed standard batch 50 kg (same as Abhraka Chendooram); AU-6 2026-10-18',
  'Approval ref USER-APPROVAL-AU6-ABHRAKA-BATCH50-<DATE>');
select id, preferred_batch_size, effective_from, effective_to, is_active, supersedes_reference_id
  from public.production_batch_size_ref where product_id=54 order by id;
do $$ begin
  if (select count(*) from public.production_batch_size_ref where product_id=54 and preferred_batch_size=50 and effective_from='2026-10-01' and effective_to is null)<>1
    then raise exception 'expected exactly 1 new 50 kg ref'; end if;
end $$;
rollback;  -- change to COMMIT only with written approval
-- Optional (NOT recommended): rescale BOM 2821 to a 50 kg reference output. Halve all 27 lines; cost-neutral.
-- The RM BOM screen Apply/Save bug means this would have to be guarded SQL. Chendooram keeps 100 too, so leave both.
