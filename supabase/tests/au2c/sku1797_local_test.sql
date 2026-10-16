-- Local test (box PG17 copy only). Fixtures inside one transaction; everything rolled back.
begin;
set local session_replication_role=replica;
insert into public.products(id,item,sub_group_id,status,uom_base,conversion_to_base) values (824,'Special Medicine 2',1,'Active','Kg',0.001) on conflict do nothing;
insert into public.product_skus(id,product_id,pack_size,uom,is_active) values (1797,824,5,'g',true) on conflict do nothing;
insert into public.inv_stock_item(id,code,name,active,default_uom_id) values (1250,'C','100 ML x 70 Nos - Carton',true,5),(1296,'J','10 G PP Jar',true,5),(1420,'W','10 G PP Wad',true,5),(2796,'L','Label - Special Medicine 2 5 G',true,5) on conflict do nothing;
insert into public.inv_uom(id,code,dimension_id) values (5,'Nos',1) on conflict do nothing;
insert into public.plm_tpl_header(id,code,reference_output_qty,reference_output_uom_id,process_loss_pct) values (2,'10 g / 5 g_Bhasmam PP Packing',1,5,0) on conflict do nothing;
insert into public.plm_tpl_line(tpl_id,line_no,stock_item_id,qty_per_reference_output,uom_id,wastage_pct,is_optional) values (2,1,1250,0.003333,5,0,false),(2,2,1296,1,5,0,false),(2,3,1420,1,5,0,false);
set local session_replication_role=origin;
\i docs/costing/au2c/SKU1797_PM_MAPPING_PROPOSED.sql
