begin;
\i supabase/migrations_draft/20261016101000_standard_batch_basis.sql
set local session_replication_role=replica; -- local test only: products not loaded
delete from public.production_batch_size_ref where product_id in (696,1038,900001,424242);
insert into public.production_batch_size_ref(product_id,preferred_batch_size,min_batch_size,max_batch_size,effective_from,is_active) values (696,32,32,32,'2026-08-06',true),(1038,16.32,16.32,16.32,'2025-10-24',true);
-- Examples (illustrative evidence rows): 1038 Palthulli verified history; 696 Mehasamani approved standard only.
insert into costing.product_standard_batch_basis(product_id,basis_tier,batch_size,batch_uom,net_output_base,source_refs,rationale,calc_sql,effective_from,confidence,approval_status)
values (1038,1,16.32,'Kg',17.12,'{"bmr":["5835","6393","6811"],"fg":"v_tally_fg_transfer_event_core"}','mean FG kg of 3 complete batches','avg(sum tally_total_in_base per batch)','2026-01-01','MEDIUM','APPROVED'),
       (900001,3,10,'Kg',9.5,'{"note":"test"}','provisional','x','2026-01-01','LOW','PROPOSED');
do $t$ begin
  assert (select basis_tier from costing.fn_resolve_standard_batch(1038,'2026-09-10'))=1,'S1 history wins';
  assert (select status='RESOLVED' and basis_tier=2 and batch_size=32 from costing.fn_resolve_standard_batch(696,'2026-09-10')),'S2 approved std from production_batch_size_ref';
  assert (select status from costing.fn_resolve_standard_batch(696,'2026-07-01'))='UNRESOLVED_FAIL_CLOSED','S3 effective-dated';
  assert (select status from costing.fn_resolve_standard_batch(900001,'2026-09-10'))='PROVISIONAL','S4 provisional';
  assert (select status from costing.fn_resolve_standard_batch(424242,'2026-09-10'))='UNRESOLVED_FAIL_CLOSED','S5 fail closed';
  raise notice 'STANDARD BATCH TESTS 5/5 PASS';
end $t$;
rollback;
