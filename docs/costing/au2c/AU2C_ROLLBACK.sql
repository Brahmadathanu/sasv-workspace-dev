-- AU-2c rollback (restores exact pre-change values captured 2026-10-15). Guarded on the new values.
begin;
set local lock_timeout = '5s';
update public.rm_bom_header set reference_output_qty = 28039 where id = 2283 and product_id = 678 and reference_output_qty = 28.039;
update public.products set conversion_to_base = 0.02 where id = 696 and conversion_to_base = 0.001;
update public.rm_bom_header set reference_output_qty = 320 where id = 2289 and product_id = 696 and reference_output_qty in (16,32);
-- notes suffix 'AU-2c 2026-10 ...' is left as audit trail; strip manually if required.
commit;
-- Frozen runs (incl. 119) are unaffected either way; only the next run reads master data.
