-- PROPOSAL (NOT APPLIED). SKU 1797 PM mapping + governed PM-BOM revision (eff. 2026-09-01) + governed label rate.
-- All steps run through the EXISTING governed RPCs, executed as the approving user (auth.uid() = Dr. Brahmadathan U,
-- dff17104-c02a-4bca-95b1-e8ddff46a9b6, who holds module:pm-templates edit and module:material-cost-manager edit), on his
-- explicit instruction, because the PM-template client cannot map this SKU. The RPCs record him as creator/approver.
begin;
select set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6',true),
       set_config('request.jwt.claims','{"sub":"dff17104-c02a-4bca-95b1-e8ddff46a9b6","role":"authenticated"}',true);
do $$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then raise exception 'REFRESH_IN_FLIGHT'; end if;
  if not exists (select 1 from public.product_skus where id=1797 and product_id=824 and pack_size=5 and uom='g' and is_active) then raise exception 'SKU_1797_MISMATCH'; end if;
  if not exists (select 1 from public.inv_stock_item where id=2796 and active) then raise exception 'LABEL_2796_MISSING'; end if;
  if exists (select 1 from public.plm_bom_revision where sku_id=1797 and status in ('APPROVED','SUPERSEDED','DRAFT')) then raise exception 'SKU_1797_ALREADY_HAS_REVISION'; end if;
  if auth.uid() is distinct from 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid then raise exception 'ACTOR_NOT_SET'; end if;
end $$;
-- A) mapping (mirror of SKU 1321 10 g)
insert into public.plm_sku_pack_map(sku_id,tpl_id,notes) values (1797,2,'2026-10-16 mirror of SKU 1321 (10 g); user-instructed') on conflict (sku_id) do nothing;
insert into public.plm_sku_plm_override(sku_id,op,stock_item_id,qty_per_reference_output,uom_id,wastage_pct,is_optional,remarks)
select 1797,'set',2796,1,5,0,false,'Label 5 g (mirrors 1321 override 645)'
where not exists (select 1 from public.plm_sku_plm_override where sku_id=1797 and stock_item_id=2796);
select public.fn_plm_rebuild_sku(1797);
-- B0) approver permission: nobody holds role:pm-bom-revision-approve on live (checked 2026-10-16). Grant it to the user (persistent; revoke line in ROLLBACK).
insert into public.user_permissions_canonical(user_id,target,can_view,can_edit)
select 'dff17104-c02a-4bca-95b1-e8ddff46a9b6','role:pm-bom-revision-approve',true,true
where not exists (select 1 from public.user_permissions_canonical where user_id='dff17104-c02a-4bca-95b1-e8ddff46a9b6' and target='role:pm-bom-revision-approve');
-- B) governed PM-BOM revision, effective 2026-09-01
do $$ declare v_id bigint; begin
  select public.rpc_plm_bom_revision_create_draft(1797, date '2026-09-01') into v_id;
  perform public.rpc_plm_bom_revision_approve(v_id, date '2026-09-01',
    'SKU 1797 mirrors SKU 1321 packing (tpl 2) with label 2796; client module could not map', 'USER-DIRECT-2026-10-16-SKU1797');
end $$;
-- C) governed label rate (proxy). rpc_set_material_manual_rate is BROKEN for MANUAL_ENTRY on live (identical def md5 fdd0b0ef…):
-- it reads the unassigned record v_vendor_offer inside CASE -> 'record v_vendor_offer is not assigned yet'. So write the identical row it would write:
update costing.material_manual_rates set status='INACTIVE', effective_to=date '2026-08-31', last_updated_at=now(), last_updated_by=auth.uid()
 where stock_item_id=2796 and status='ACTIVE';
insert into costing.material_manual_rates(stock_item_id,rate_value,rate_uom_id,effective_from,effective_to,reason,status,rate_origin,source_snapshot,created_by,last_updated_by)
select 2796, 0.64, null, date '2026-09-01', null,
 'Proxy: Tally PLM stock rate of Label - Special Medicine 2 10 G = 0.64/Nos (as of 2026-09-10, unchanged to 2026-10-16); 5 G label has no Tally rate (qty 0). User instruction 2026-10-16.',
 'ACTIVE','MANUAL_ENTRY',
 jsonb_build_object('source','tally_plm_stock_snapshot','proxy_item','Label - Special Medicine 2 10 G','proxy_stock_item_id',2216,'proxy_rate',0.64,'proxy_as_of','2026-09-10','written_directly_reason','rpc_set_material_manual_rate MANUAL_ENTRY defect'),
 auth.uid(), auth.uid()
where not exists (select 1 from costing.material_manual_rates where stock_item_id=2796 and status='ACTIVE' and rate_value=0.64);
-- verify
do $$ begin
  if (public.plm_sku_bom_revision_as_of(1797, date '2026-09-10')).id is null then raise exception 'VERIFY_REVISION'; end if;
  if (select count(*) from public.plm_bom_line l join public.plm_bom_header h on h.id=l.plm_bom_id where h.sku_id=1797)<>4 then raise exception 'VERIFY_LINES'; end if;
  if not exists (select 1 from costing.material_manual_rates where stock_item_id=2796 and status='ACTIVE' and rate_value=0.64 and effective_from<='2026-09-10') then raise exception 'VERIFY_RATE'; end if;
end $$;
commit;
-- ROLLBACK: rate -> update costing.material_manual_rates set status='INACTIVE', effective_to=effective_from, last_updated_at=now() where stock_item_id=2796 and status='ACTIVE' and rate_value=0.64;
--           permission -> delete from public.user_permissions_canonical where user_id='dff17104-c02a-4bca-95b1-e8ddff46a9b6' and target='role:pm-bom-revision-approve';
--           revision: APPROVED revisions are immutable and cannot be cancelled; emergency only (needs approval):
--           set local app.plm_bom_revision_mutate_context='GOVERNED'; update public.plm_bom_revision set status='CANCELLED' where sku_id=1797;
--           mapping -> delete override/map, delete plm_bom_line/header for sku 1797.
