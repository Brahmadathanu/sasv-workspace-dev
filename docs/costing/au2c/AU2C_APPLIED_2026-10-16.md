# AU-2c fixes APPLIED to live — 2026-10-16 ~11:53 IST (user-authorised, single guarded transaction)
Guards: no QUEUED/RUNNING refresh; all 6 old values pre-checked; each update required exactly 1 row.
| Product | Field | Old | New |
|---|---|---|---|
| 678 Ilaneer Kuzhambu (SKU 859) | rm_bom_header 2283 reference_output_qty | 28039 | **55** (factor 0.000714 kept) |
| 1038 Palthulli (SKU 1277) | rm_bom_header 2379 reference_output_qty | 2697 | **5.44** |
| 1038 Palthulli | products.conversion_to_base | 0.00127 | **0.000704** |
| 696 Mehasamani (SKU 879) | rm_bom_header 2289 reference_output_qty | 320 | **32** (= batch_size_ref 507) |
| 696 Mehasamani | products.conversion_to_base | 0.02 | **0.001** |
Verified after commit: all five values read back as new. SKU 1277 is now RESOLVED. Effective from the next costing run; frozen runs are unchanged.

## Rollback (guarded on new values)
```sql
begin;
update public.rm_bom_header set reference_output_qty=28039 where id=2283 and product_id=678 and reference_output_qty=55;
update public.rm_bom_header set reference_output_qty=2697  where id=2379 and product_id=1038 and reference_output_qty=5.44;
update public.rm_bom_header set reference_output_qty=320   where id=2289 and product_id=696  and reference_output_qty=32;
update public.products set conversion_to_base=0.00127 where id=1038 and conversion_to_base=0.000704;
update public.products set conversion_to_base=0.02    where id=696  and conversion_to_base=0.001;
commit;
```

## Why the client save kept the old values (diagnosis, no code change)
`js/manage-rm-bom.js`: the "Edit header" modal's Apply only copies values into the main form ("Header updated. Press Save to persist."). Save (`fn_rm_bom_upsert`) sends the main-form values. If Save is pressed before Apply, or after a reload (`loadBom` resets the form), the old values are re-sent. The RPC still bumps `last_updated_at`, which matches what we saw (timestamp changed, value unchanged). Product `conversion_to_base` has no editor in this screen.
Proposed fix:
1. Apply in the modal saves directly through the same RPC, or Save is blocked while the modal has unapplied edits.
2. After saving, read back and compare with the entered value, warning on any mismatch.
3. Show the "unsaved changes" state in the header pill.
