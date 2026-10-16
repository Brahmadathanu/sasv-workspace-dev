begin;
\i supabase/migrations_draft/20261016101000_standard_batch_basis.sql
-- Examples (illustrative evidence rows): 1038 Palthulli verified history; 696 Mehasamani approved standard only.
insert into costing.product_standard_batch_basis(product_id,basis_tier,batch_size,batch_uom,net_output_base,source_refs,rationale,calc_sql,effective_from,confidence,approval_status)
values (1038,1,16.32,'Kg',17.12,'{"bmr":["5835","6393","6811"],"fg":"v_tally_fg_transfer_event_core"}','mean FG kg of 3 complete batches','avg(sum tally_total_in_base per batch)','2026-01-01','MEDIUM','APPROVED'),
       (1038,2,16.32,'Kg',16.32,'{"ref":179}','production_batch_size_ref','preferred_batch_size','2025-10-24','HIGH','APPROVED'),
       (696,2,32,'Kg',32,'{"ref":507}','production-approved fixed batch, no BMR/FG history','preferred_batch_size, yield 100% assumed','2026-08-06','MEDIUM','APPROVED'),
       (900001,3,10,'Kg',9.5,'{"note":"test"}','provisional','x','2026-01-01','LOW','PROPOSED');
do $t$ begin
  assert (select basis_tier from costing.fn_resolve_standard_batch(1038,'2026-09-10'))=1,'S1 history wins';
  assert (select status from costing.fn_resolve_standard_batch(696,'2026-09-10'))='RESOLVED','S2 approved std';
  assert (select status from costing.fn_resolve_standard_batch(696,'2026-07-01'))='UNRESOLVED_FAIL_CLOSED','S3 effective-dated';
  assert (select status from costing.fn_resolve_standard_batch(900001,'2026-09-10'))='PROVISIONAL','S4 provisional';
  assert (select status from costing.fn_resolve_standard_batch(424242,'2026-09-10'))='UNRESOLVED_FAIL_CLOSED','S5 fail closed';
  raise notice 'STANDARD BATCH TESTS 5/5 PASS';
end $t$;
rollback;
