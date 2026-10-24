-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_actor uuid := 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid;
  v_old_id bigint;
  v_new_id bigint;
  v_product_id bigint;
begin
  select id into v_old_id from inv_stock_item where name='Bulk Stock - Sringi Parpam' and active=true;
  select id into v_new_id from inv_stock_item where name='Bulk Stock - Special Medicine 2' and active=true;
  select id into v_product_id from products where item='Special Medicine 2' and status ilike 'active';

  if v_old_id is null or v_new_id is null or v_product_id is null then
    raise exception 'Required Sringi/Special Medicine 2 identities not found';
  end if;

  update rm_bom_line
     set stock_item_id = v_new_id,
         remarks = concat_ws(' ', nullif(remarks,''), 'Governed identity correction 2026-09-04: Sringi Parpam is represented by Special Medicine 2; remapped Bulk Stock - Sringi Parpam to Bulk Stock - Special Medicine 2; quantity/UOM unchanged.')
   where stock_item_id = v_old_id;

  if not exists (
    select 1 from costing.internal_material_source_lineage
     where consume_stock_item_id=v_new_id
       and source_product_id=v_product_id
       and status='APPROVED'
       and effective_to is null
  ) then
    insert into costing.internal_material_source_lineage
      (consume_stock_item_id,source_product_id,transfer_uom_id,lineage_type,
       material_layer_method,conversion_layer_method,status,effective_from,
       evidence_note,approval_reference,approved_by,approved_at,created_by,created_at,updated_at)
    values
      (v_new_id,v_product_id,1,'INTERNAL_MANUFACTURED_BULK',
       'SOURCE_PRODUCT_RM_STANDARD_COST','SOURCE_PRODUCT_MANUFACTURING_CONVERSION_BURDEN',
       'APPROVED','2026-09-04',
       'User-confirmed identity: Sringi Parpam BOM consumption corresponds to internally manufactured Special Medicine 2. Source Product 824 has governed RM BOM; internal costing must explode source-product RM cost rather than use direct Tally bulk valuation.',
       'GATE6C-SRINGI-SPECIAL-MEDICINE-2-2026-09-04',v_actor,now(),v_actor,now(),now());
  end if;
end $$;