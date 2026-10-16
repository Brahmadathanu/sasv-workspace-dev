-- PROPOSAL (NOT APPLIED). SKU 1797 "Special Medicine 2" 5 g: mirror the SKU 1321 (10 g) PM mapping.
-- 1321: plm_sku_pack_map tpl 2 "10 g / 5 g_Bhasmam PP Packing" (carton 1250 @0.003333, jar 1296, wad 1420)
--       + plm_sku_plm_override op=set item 2216 "Label - Special Medicine 2 10 G" qty 1 uom 5.
-- 1797: same template; override op=set item 2796 "Label - Special Medicine 2 5 G" (exists, active, created 2026-10-13).
-- Guards: idempotent; refuses if a refresh is in flight. The map/override triggers rebuild plm_bom_header; rebuild is also called explicitly.
begin;
do $$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then raise exception 'REFRESH_IN_FLIGHT'; end if;
  if not exists (select 1 from public.product_skus where id=1797 and product_id=824 and pack_size=5 and uom='g') then raise exception 'SKU_1797_MISMATCH'; end if;
  if not exists (select 1 from public.inv_stock_item where id=2796 and active) then raise exception 'LABEL_2796_MISSING'; end if;
end $$;
insert into public.plm_sku_pack_map(sku_id,tpl_id,notes) values (1797,2,'2026-10-16 mirror of SKU 1321 (10 g); user-requested')
  on conflict (sku_id) do nothing;
insert into public.plm_sku_plm_override(sku_id,op,stock_item_id,qty_per_reference_output,uom_id,wastage_pct,is_optional,remarks)
select 1797,'set',2796,1,5,0,false,'Label 5 g (mirrors 1321 override 645)'
where not exists (select 1 from public.plm_sku_plm_override where sku_id=1797 and stock_item_id=2796);
select public.fn_plm_rebuild_sku(1797);
-- expect 4 lines: carton, jar, wad, label 2796
select l.line_no, l.stock_item_id, l.qty_per_reference_output from public.plm_bom_line l join public.plm_bom_header h on h.id=l.plm_bom_id where h.sku_id=1797 order by 1;
commit;

-- STEP B (governed revision; needs an authenticated user holding module:pm-templates edit). Preferred: PM-template screen ->
-- create draft for SKU 1797 -> approve with effective_from 2026-09-01 (covers valuation 2026-09-10).
-- SQL equivalent (run as that user):
--   select id from public.rpc_plm_bom_revision_create_draft(1797, date '2026-09-01');
--   select public.rpc_plm_bom_revision_approve(<draft_id>, date '2026-09-01', 'Mirror 10 g mapping; label 5 g', 'User 2026-10-16');

-- ROLLBACK (before step B only; approved revisions are immutable, so after B use rpc_plm_bom_revision_cancel or a superseding revision):
-- begin; delete from public.plm_sku_plm_override where sku_id=1797 and stock_item_id=2796;
--        delete from public.plm_sku_pack_map where sku_id=1797 and tpl_id=2;
--        delete from public.plm_bom_line where plm_bom_id in (select id from public.plm_bom_header where sku_id=1797);
--        delete from public.plm_bom_header where sku_id=1797;  -- SKU had no header before (rebuild skips unmapped SKUs)
--        commit;
-- Local test (supabase/tests/au2c/sku1797_local_test.sql): apply gives 4 lines (1250 @0.003333, 1296, 1420, label 2796); re-apply is a no-op (1 map, 1 override); rollback as above.
