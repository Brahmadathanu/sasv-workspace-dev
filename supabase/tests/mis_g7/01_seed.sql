INSERT INTO public.products VALUES (1,'P1','kg',0.001),(2,'P2','L',NULL),(3,'P3','kg',1),(4,'P4','kg',1),(5,'P5','kg',1);
INSERT INTO public.product_skus VALUES (10,1,0.5,'kg'),(11,1,500,'g'),(20,2,1,'bottle'),(30,3,1,'kg');
INSERT INTO public.activities VALUES (1,'Mixing'),(2,'FG bulk storage'),(3,'Filling');
INSERT INTO public.event_type_lkp(label,affects_bulk_stock,is_packaging,active) VALUES ('Bottling',-1,true,true),('Labelling',-1,true,true),('Cartoning',-1,true,true),('Capsule monocarton',-1,true,true),('Transfer to FG store',0,true,true),
  ('FG bulk storage',1,false,true);   -- live: FG receipt activity (+1, not packaging)
UPDATE public.event_type_lkp SET code = label;
-- P1: one approved route with mandatory FG step. P3: no route. P4: route without FG step. P5: overlapping routes.
INSERT INTO costing.product_process_route(id,product_id,status,effective_from,effective_to,base_route_family_route_id) VALUES
 (1,1,'APPROVED','2026-01-01',NULL,1),(4,4,'APPROVED','2026-01-01',NULL,4),
 (51,5,'APPROVED','2026-01-01',NULL,5),(52,5,'APPROVED','2026-01-01',NULL,5);
INSERT INTO costing.production_route_family_route_step(id,family_route_id,activity_id,is_mandatory) VALUES
 (1,1,1,true),(2,1,2,true),(41,4,1,true),(51,5,2,true);
INSERT INTO public.test_perm VALUES
 ('00000000-0000-0000-0000-000000000001','module:mis-batch-stage-signer'),
 ('00000000-0000-0000-0000-000000000002','module:mis-fg-bulk-packing'),
 ('00000000-0000-0000-0000-000000000002','module:fg-bulk-stock'),
 ('00000000-0000-0000-0000-000000000002','module:edit-log-entry'),  -- governed DWL editor wrapper permission (live)  -- canonical FG bulk stock permission (force-close wrapper + mark-done wrapper)
 ('00000000-0000-0000-0000-000000000003','module:mis-fg-bulk-packing'),
 ('00000000-0000-0000-0000-000000000003','module:mis-fg-excess-adjustment');
-- P3/P4/P5 batches (historical-style: DWL exists, route missing/gapped/overlapping)
INSERT INTO public.bmr_details VALUES (301,3,'X3','Released'),(401,4,'X4','Released'),(501,5,'X5','Released');
INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES
 ('P3','X3','FG bulk storage','2026-11-10','Done',10,'kg'),
 ('P4','X4','FG bulk storage','2026-11-10','Done',10,'kg'),
 ('P5','X5','FG bulk storage','2026-11-10','Done',10,'kg');
CREATE OR REPLACE FUNCTION public.t_mkbatch(p_bn text, p_qty numeric) RETURNS int LANGUAGE plpgsql AS $$
DECLARE w int; f int; e int; BEGIN
  INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT coalesce(max(id),1000)+1 FROM public.bmr_details),1,p_bn,'Released');
  INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom)
    VALUES ('P1',p_bn,'FG bulk storage','2026-11-10','Done',p_qty,'kg') RETURNING id INTO w;
  -- receipt is written by the (shimmed) trg_fg_ledger_from_dwl, as live
  INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1',p_bn,'Filling','2026-11-11','Done') RETURNING id INTO f;
  INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (f,'Bottling') RETURNING id INTO e;
  RETURN w; END $$;
