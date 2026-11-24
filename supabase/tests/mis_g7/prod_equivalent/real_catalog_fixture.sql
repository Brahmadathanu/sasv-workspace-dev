-- SYNTHETIC fixture rows only (no real users, products or business data) for the real-catalog acceptance suite.
-- Master data is inserted with session_replication_role=replica because several live triggers on those tables call objects that
-- are NOT in the captured packet (product_sku_change_log, fn_sku_activation_missing_items, ...). All stock-bearing DML
-- (DWL, packaging events, SKU lines, ledger) runs later with every live trigger enabled.
-- TEST-ONLY STAND-IN (NOT a production reconstruction): the live DML triggers mark_supply_rollups_dirty() UPDATE public.supply_rollup_refresh_queue,
-- which was not in the captured packet. A one-row queue table with only the two columns the trigger touches lets live DML run.
CREATE TABLE IF NOT EXISTS public.supply_rollup_refresh_queue(id int PRIMARY KEY, last_requested timestamptz);
INSERT INTO public.supply_rollup_refresh_queue VALUES (1, now()) ON CONFLICT DO NOTHING;
GRANT ALL ON public.supply_rollup_refresh_queue TO authenticated, service_role;
BEGIN;
SET LOCAL session_replication_role = replica;
INSERT INTO public.sections(id,section_name) OVERRIDING SYSTEM VALUE VALUES (1,'SYN-SECTION');
INSERT INTO public.subsections(id,section_id,subsection_name) OVERRIDING SYSTEM VALUE VALUES (1,1,'SYN-SUB');
INSERT INTO public.areas(id,section_id,subsection_id,area_name) OVERRIDING SYSTEM VALUE VALUES (1,1,1,'SYN-AREA');
INSERT INTO public.activity_kinds(id,name,name_norm,short_code) VALUES ('00000000-0000-0000-0000-00000000aa01','SYN','syn','SYN');
INSERT INTO public.activities(id,activity_name,section_id,sub_section_id,area_id,kind_id) OVERRIDING SYSTEM VALUE VALUES
 (1,'Mixing',1,1,1,'00000000-0000-0000-0000-00000000aa01'),(2,'FG bulk storage',1,1,1,'00000000-0000-0000-0000-00000000aa01'),(3,'Filling',1,1,1,'00000000-0000-0000-0000-00000000aa01');
INSERT INTO public.event_type_lkp(code,label,affects_bulk_stock,is_packaging,active) VALUES
 ('Bottling','Bottling',-1,true,true),('Labelling','Labelling',-1,true,true),('Cartoning','Cartoning',-1,true,true),
 ('Transfer to FG store','Transfer to FG store',0,true,true),('FG bulk storage','FG bulk storage',1,false,true);
INSERT INTO public.products(id,item,sub_group_id,status,uom_base,conversion_to_base) OVERRIDING SYSTEM VALUE VALUES
 (1,'SYN-P1',1,'Active','Kg',0.001),(2,'SYN-P2',1,'Active','L',1),(3,'SYN-P3',1,'Active','Kg',0.001),(4,'SYN-P4',1,'Active','Kg',0.001),(5,'SYN-P5',1,'Active','Kg',0.001);
INSERT INTO public.product_skus(id,product_id,pack_size,uom) OVERRIDING SYSTEM VALUE VALUES (10,1,0.5,'Kg'),(11,1,500,'g'),(20,2,1,'L'),(30,3,1,'Kg');
INSERT INTO costing.production_resource_class(code,label,description) VALUES ('SYN','syn','syn');
INSERT INTO costing.production_route_behaviour(code,label,description) VALUES ('SYN','syn','syn');
INSERT INTO costing.production_cost_centre(id,cost_centre_code,cost_centre_name,cost_centre_type) OVERRIDING SYSTEM VALUE VALUES (1,'SYN','syn','PROCESS_AREA_CENTRED');
INSERT INTO costing.production_route_family(id,family_code,family_name,status,effective_from,approval_reference,approved_at) OVERRIDING SYSTEM VALUE VALUES (1,'SYN-F1','syn','APPROVED','2026-01-01','SYN-APPROVAL',now()),(4,'SYN-F4','syn','APPROVED','2026-01-01','SYN-APPROVAL',now()),(5,'SYN-F5','syn','APPROVED','2026-01-01','SYN-APPROVAL',now());
INSERT INTO costing.production_route_family_route(id,route_family_id,route_code,route_version,route_name,status,effective_from,approval_reference,approved_at) OVERRIDING SYSTEM VALUE VALUES
 (1,1,'SYN-R1',1,'r1','APPROVED','2026-01-01','SYN-APPROVAL',now()),(4,4,'SYN-R4',1,'r4','APPROVED','2026-01-01','SYN-APPROVAL',now()),(5,5,'SYN-R5',1,'r5','APPROVED','2026-01-01','SYN-APPROVAL',now());
INSERT INTO public.production_batch_size_ref(id,product_id,preferred_batch_size) OVERRIDING SYSTEM VALUE VALUES (1,1,100),(3,3,100),(4,4,100),(5,5,100);
INSERT INTO costing.product_process_route(id,product_id,base_route_family_route_id,route_version,route_code,batch_size_ref_id,status,effective_from,effective_to,approval_reference,approved_at,evidence_status) OVERRIDING SYSTEM VALUE VALUES
 (1,1,1,1,'SYN-PR1',1,'APPROVED','2026-01-01',NULL,'SYN-APPROVAL',now(),'MANUAL_COMPLETE'),
 (4,4,4,1,'SYN-PR4',4,'APPROVED','2026-01-01',NULL,'SYN-APPROVAL',now(),'MANUAL_COMPLETE'),
 (51,5,5,1,'SYN-PR51',5,'APPROVED','2026-01-01','2026-06-30','SYN-APPROVAL',now(),'MANUAL_COMPLETE'),
 (52,5,5,2,'SYN-PR52',5,'APPROVED','2026-07-01',NULL,'SYN-APPROVAL',now(),'MANUAL_COMPLETE');
INSERT INTO costing.production_route_family_route_step(id,family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,is_mandatory) OVERRIDING SYSTEM VALUE VALUES
 (1,1,'mix',1,1,1,1,1,1,'SYN','SYN','PRODUCTION_PROCESS',true),(2,1,'fg',2,2,1,1,1,1,'SYN','SYN','BOUNDARY_FG_TRANSFER',true),
 (41,4,'mix',1,1,1,1,1,1,'SYN','SYN','PRODUCTION_PROCESS',true),(51,5,'fg',1,2,1,1,1,1,'SYN','SYN','BOUNDARY_FG_TRANSFER',true);
INSERT INTO public.permission_targets(key,kind,label) VALUES
 ('module:mis-batch-stage-signer','module','syn'),('module:mis-fg-bulk-packing','module','syn'),('module:fg-bulk-stock','module','syn'),('module:edit-log-entry','module','syn'),
 ('module:mis-fg-excess-adjustment','module','syn'),('module:mis-g7-enforcement-admin','module','syn'),('module:mis-g7-core-migration-signoff','module','syn')
 ON CONFLICT (key) DO NOTHING;
INSERT INTO public.user_permissions_canonical(user_id,target,can_view,can_edit) VALUES
 ('00000000-0000-0000-0000-000000000001','module:mis-batch-stage-signer',true,true),
 ('00000000-0000-0000-0000-000000000002','module:mis-fg-bulk-packing',true,true),
 ('00000000-0000-0000-0000-000000000002','module:fg-bulk-stock',true,true),
 ('00000000-0000-0000-0000-000000000002','module:edit-log-entry',true,true),
 ('00000000-0000-0000-0000-000000000003','module:mis-fg-bulk-packing',true,true),
 ('00000000-0000-0000-0000-000000000003','module:mis-fg-excess-adjustment',true,true),
 ('00000000-0000-0000-0000-0000000000ad','module:mis-g7-enforcement-admin',true,true),
 ('00000000-0000-0000-0000-0000000000ae','module:mis-g7-enforcement-admin',true,false),
 ('00000000-0000-0000-0000-0000000000af','module:edit-log-entry',true,false),
 ('00000000-0000-0000-0000-0000000000b0','module:mis-g7-core-migration-signoff',true,true);
COMMIT;
-- batch factory (synthetic): BMR + FG receipt DWL (live trigger posts the ledger receipt) + a Filling DWL carrying a packaging event.
-- Real triggers are ENABLED here. Done is set through the live governed-reconciliation setting so the live guard is exercised honestly.
CREATE OR REPLACE FUNCTION public.t_mkbatch(p_bn text, p_qty numeric, p_product int DEFAULT 1) RETURNS int LANGUAGE plpgsql AS $$
DECLARE w int; f int; it text; BEGIN
  SELECT item INTO it FROM public.products WHERE id=p_product;
  PERFORM set_config('session_replication_role','replica',true);
  INSERT INTO public.bmr_details(item,bn,batch_size,uom,product_id,lifecycle_status) VALUES (it,p_bn,100,'Kg',p_product,'ACTIVE');
  PERFORM set_config('session_replication_role','origin',true);
  INSERT INTO public.daily_work_log(log_date,section_id,subsection_id,area_id,item,batch_number,batch_size,batch_uom,activity,started_on,due_date,status,storage_qty,storage_qty_uom)
    VALUES ('2026-11-10',1,1,1,it,p_bn,100,'Kg','FG bulk storage','2026-11-10','2026-11-12','Doing',p_qty,'Kg') RETURNING id INTO w;
  INSERT INTO public.daily_work_log(log_date,section_id,subsection_id,area_id,item,batch_number,batch_size,batch_uom,activity,started_on,due_date,status)
    VALUES ('2026-11-11',1,1,1,it,p_bn,100,'Kg','Filling','2026-11-11','2026-11-12','Doing') RETURNING id INTO f;
  INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (f,'Bottling');
  RETURN w; END $$;
-- TEST-ONLY helper: calls the EXACT live 30-argument DWL editor wrapper with an overlay patch (SECURITY INVOKER: caller's role/JWT applies).
CREATE FUNCTION public.t_edit_dwl(p_id bigint, p_patch jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(daily_work_log_id bigint, packaging_event_id bigint, inserted_event_sku_count integer)
LANGUAGE plpgsql AS $$
DECLARE d public.daily_work_log; r public.daily_work_log;
BEGIN
  SELECT * INTO d FROM public.daily_work_log WHERE id = p_id;
  IF NOT FOUND THEN d.id := p_id; END IF;
  r := jsonb_populate_record(NULL::public.daily_work_log, to_jsonb(d) || coalesce(p_patch, '{}'::jsonb));
  RETURN QUERY SELECT * FROM public.rpc_update_daily_work_log_with_packaging(r.id, r.log_date, r.section_id, r.subsection_id, r.area_id, r.plant_id, r.item,
    r.batch_number, r.batch_size, r.batch_uom, r.activity, r.juice_or_decoction, r.specify, r.count_of_saravam, r.fuel, r.fuel_under, r.fuel_over,
    r.started_on, r.due_date, r.status, r.completed_on, r.qty_after_process, r.qty_uom, r.remarks, r.lab_ref_number, r.sku_breakdown,
    r.storage_qty, r.storage_qty_uom, r.rm_juice_qty, r.rm_juice_uom);
END $$;
GRANT EXECUTE ON FUNCTION public.t_edit_dwl(bigint, jsonb) TO authenticated;
-- editor-flow batch: BMR + FG receipt row (live trigger posts the receipt) + a packaging work log with no chain yet. Returns the packaging DWL id.
CREATE FUNCTION public.t_mkbatch_real(p_bn text, p_qty numeric, p_act text DEFAULT 'Bottling', p_product int DEFAULT 1) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE f bigint; it text; BEGIN
  SELECT item INTO it FROM public.products WHERE id=p_product;
  PERFORM set_config('session_replication_role','replica',true);
  INSERT INTO public.bmr_details(item,bn,batch_size,uom,product_id,lifecycle_status) VALUES (it,p_bn,100,'Kg',p_product,'ACTIVE');
  PERFORM set_config('session_replication_role','origin',true);
  INSERT INTO public.daily_work_log(log_date,section_id,subsection_id,area_id,item,batch_number,batch_size,batch_uom,activity,started_on,due_date,status,storage_qty,storage_qty_uom)
    VALUES ('2026-11-10',1,1,1,it,p_bn,100,'Kg','FG bulk storage','2026-11-10','2026-11-12','Doing',p_qty,'Kg');
  INSERT INTO public.daily_work_log(log_date,section_id,subsection_id,area_id,item,batch_number,batch_size,batch_uom,activity,started_on,due_date,status)
    VALUES ('2026-11-11',1,1,1,it,p_bn,100,'Kg',p_act,'2026-11-11','2026-11-12','Doing') RETURNING id INTO f;
  RETURN f; END $$;
-- historical-style batches (DWL exists, route missing / gapped / overlapping); BMR via replica as above
SELECT public.t_mkbatch('X3',10,3);
SELECT public.t_mkbatch('X4',10,4);
SELECT public.t_mkbatch('X5',10,5);
