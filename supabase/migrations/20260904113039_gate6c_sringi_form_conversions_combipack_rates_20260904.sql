-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_actor uuid := 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid;
  v_actor_text text := 'dff17104-c02a-4bca-95b1-e8ddff46a9b6';
  v_nos_uom bigint;
  v_kg_uom bigint;
begin
  select id into v_nos_uom from inv_uom where code='Nos';
  select id into v_kg_uom from inv_uom where code='Kg';

  -- 1) Sringi Parpam internal source identity: legacy bulk stock is produced by Product 'Special Medicine 2'.
  if not exists (
    select 1 from costing.internal_material_source_lineage
    where consume_stock_item_id = (select id from inv_stock_item where name='Bulk Stock - Sringi Parpam')
      and status='APPROVED'
      and (effective_to is null or effective_to >= date '2026-09-04')
  ) then
    insert into costing.internal_material_source_lineage
      (consume_stock_item_id,source_product_id,transfer_uom_id,lineage_type,
       material_layer_method,conversion_layer_method,status,effective_from,
       evidence_note,approval_reference,approved_by,approved_at,created_by,created_at,updated_at)
    select i.id,p.id,v_kg_uom,'INTERNAL_MANUFACTURED_BULK',
           'SOURCE_PRODUCT_RM_STANDARD_COST','SOURCE_PRODUCT_MANUFACTURING_CONVERSION_BURDEN',
           'APPROVED',date '2026-09-04',
           'Governed identity correction: Bulk Stock - Sringi Parpam consumed in downstream BOM is manufactured under active source Product Special Medicine 2; source product RM BOM is the authoritative material-cost lineage.',
           'GATE6C-SRINGI-SPECIAL-MEDICINE-2-20260904',v_actor,now(),v_actor,now(),now()
    from inv_stock_item i cross join products p
    where i.name='Bulk Stock - Sringi Parpam' and p.item='Special Medicine 2' and p.status ilike 'active';
  end if;

  -- 2) Governed RM form conversions.
  insert into inv_rm_form_conversion
    (consume_stock_item_id,purchase_stock_item_id,factor,is_active,effective_from,
     consume_uom_id,purchase_uom_id,notes,created_by,updated_by)
  select c.id,p.id,x.factor,true,date '2026-09-04',v_kg_uom,v_kg_uom,x.notes,v_actor_text,v_actor_text
  from (values
    ('Chutti Thiruthali (D)','Thiruthaali (F)',10::numeric,'Confirmed form conversion: dried Chutti Thiruthali requirement is costed from purchased Thiruthaali (F), factor 10.'::text),
    ('Thiruthali (D)','Thiruthaali (F)',10::numeric,'Confirmed form conversion: dried Thiruthali requirement is costed from purchased Thiruthaali (F), factor 10.'::text),
    ('Anchilathetti Veru (D)','Anchilathetti Samoolam (F)',14::numeric,'Confirmed by-product conversion: 2.5 Kg Anchilathetti Veru (D) obtained from 35 Kg Anchilathetti Samoolam (F); purchase-form factor = 35/2.5 = 14.'::text),
    ('Chempan Njerinjil (F)','Chempan Njerinjil (D)',10::numeric,'Confirmed form conversion: Chempan Njerinjil (F) consuming form is costed from Chempan Njerinjil (D), factor 10.'::text)
  ) as x(consume_name,purchase_name,factor,notes)
  join inv_stock_item c on c.name=x.consume_name
  join inv_stock_item p on p.name=x.purchase_name
  where not exists (
    select 1 from inv_rm_form_conversion e
    where e.consume_stock_item_id=c.id and e.is_active=true
  );

  -- 3) Rheumorid Balm 5 g is a prepared packaged SKU unit, not Kg.
  update inv_stock_item
     set default_uom_id=v_nos_uom
   where name='Rheumorid Balm_5 g' and default_uom_id<>v_nos_uom;

  update rm_bom_line l
     set uom_id=v_nos_uom,
         remarks=concat_ws(' | ',nullif(l.remarks,''),'Governed UOM correction 2026-09-04: Rheumorid Balm_5 g is a prepared packaged SKU consumed by Nos; quantity unchanged.')
    from inv_stock_item i
   where l.stock_item_id=i.id and i.name='Rheumorid Balm_5 g' and l.uom_id<>v_nos_uom;

  -- 4) Approved prepared-SKU costing rates for Lumbar Spondylosis Combipack components.
  insert into costing.material_manual_rates
    (stock_item_id,rate_value,rate_uom_id,effective_from,reason,status,created_by,last_updated_by,rate_origin,source_snapshot)
  select i.id,x.rate_value,v_nos_uom,date '2026-09-04',x.reason,'ACTIVE',v_actor,v_actor,'MANUAL_ENTRY',
         jsonb_build_object('approval_reference','GATE6C-LUMBAR-COMBIPACK-RATES-20260904','basis','user-approved prepared packaged SKU costing rate')
  from (values
    ('Sudhipathram Kashayam_100 mL',9.84::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Gandharvahasthadi Kashayam_100 mL',13.27::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Nirgundyadi Erandam Soft Gel Capsule_4 Nos',3.91::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Vathamarmakan Capsule_4 Nos',7.51::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Chathilinga Thailam Soft Gel Capsule_4 Nos',4.91::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Kayarajanka Thailam_25 mL',15.16::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Murivenna_25 mL',11.92::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text),
    ('Rheumorid Balm_5 g',8.92::numeric,'Approved costing rate for prepared packaged SKU used in Lumbar Spondylosis Combipack.'::text)
  ) as x(item_name,rate_value,reason)
  join inv_stock_item i on i.name=x.item_name
  where not exists (
    select 1 from costing.material_manual_rates m
    where m.stock_item_id=i.id and m.status='ACTIVE'
      and m.effective_from<=date '2026-09-04'
      and (m.effective_to is null or m.effective_to>=date '2026-09-04')
  );

  -- 5) User-approved arbitrary direct fallback rate for Chempan Njerinjil (F).
  -- Canonical RM costing with the active F->D conversion still resolves on the D purchase form first.
  insert into costing.material_manual_rates
    (stock_item_id,rate_value,rate_uom_id,effective_from,reason,status,created_by,last_updated_by,rate_origin,source_snapshot)
  select i.id,30::numeric,v_kg_uom,date '2026-09-04',
         'User-approved arbitrary costing fallback for Chempan Njerinjil (F); active form conversion to Chempan Njerinjil (D) remains authoritative for converted RM costing.',
         'ACTIVE',v_actor,v_actor,'MANUAL_ENTRY',
         jsonb_build_object('approval_reference','GATE6C-CHEMPAN-NJERINJIL-F-20260904','basis','user-approved arbitrary costing fallback')
  from inv_stock_item i
  where i.name='Chempan Njerinjil (F)'
    and not exists (
      select 1 from costing.material_manual_rates m
      where m.stock_item_id=i.id and m.status='ACTIVE'
        and m.effective_from<=date '2026-09-04'
        and (m.effective_to is null or m.effective_to>=date '2026-09-04')
    );
end $$;