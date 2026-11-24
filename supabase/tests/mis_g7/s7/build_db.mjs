// Shared isolated-database builder for the S7 acceptance (server tests and the client-against-real-server browser tests).
// shim base tables + REAL Costing route engine (verbatim from the migrations) + S2..S6 exactly as accepted + synthetic fixture rows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS, PATCHED_CORE_MIGRATION, FINGERPRINT_MIGRATION, seedShimFingerprintsSql, installLiveEditor } from '../pg_harness.mjs';
import { extractRouteEngine } from './extract_route_engine.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
export const mig = (f) => fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8');
export const S7A = '20261124120000_mis_g7_s7a_shared_route_identity_and_stage_status.sql';
export const S7B = '20261124121000_mis_g7_s7b_governed_previews_and_exception_summary.sql';
export const U = (n) => `00000000-0000-0000-0000-0000000000${n}`;
export const SIGNER = U('01'), PACKER = U('02'), EXCESS = U('03'), NOBODY = U('04'), SIGNV = U('11'), PACKV = U('12'), EXECV = U('21');
export const asTx = (sql) => `BEGIN;\n${sql}\nCOMMIT;`;
const seedSql = () => `
INSERT INTO public.sections VALUES (1);
INSERT INTO public.subsections VALUES (10,1);
INSERT INTO public.areas VALUES (100,1,10);
INSERT INTO public.plant_machinery VALUES (1000,1,10,100);
INSERT INTO public.sub_groups VALUES (1,1);
INSERT INTO public.products(id,item,uom_base,conversion_to_base,sub_group_id) VALUES
 (21,'Inherited','kg',1,1),(22,'ProductRoute','kg',1,1),(23,'NoRoute','kg',1,1),(24,'NoFgStage','kg',1,1),(25,'Overlap','kg',1,1),
 (26,'ArchivedProductRoute','kg',1,1),(27,'DupFg','kg',1,1),(28,'AmbiguousBmr','kg',1,1),(29,'DateGap','kg',1,1),(30,'Perf','kg',1,1);
INSERT INTO public.activities(id,activity_name,section_id,sub_section_id,area_id) VALUES
 (5,'RM issue',1,10,100),(1,'Mixing',1,10,100),(2,'FG bulk storage',1,10,100),(6,'FG transfer',1,10,100),(4,'Labelling',1,10,100),(7,'Blending',1,10,100),(8,'Heating',1,10,100);
INSERT INTO public.product_skus VALUES (10,21,0.5,'kg'),(11,21,0.25,'kg'),(20,22,0.5,'kg'),(21,22,0.25,'kg');
INSERT INTO public.event_type_lkp(label,affects_bulk_stock,is_packaging,active,code) VALUES ('Bottling',-1,true,true,'Bottling'),('FG bulk storage',1,false,true,'FG bulk storage'),('Sample',0,true,true,'Sample');
INSERT INTO costing.production_cost_centre(id) VALUES (1);
INSERT INTO costing.production_route_behaviour VALUES ('STD',true); INSERT INTO costing.production_resource_class VALUES ('GENERAL',true);
INSERT INTO costing.production_route_family(id,status,effective_from) VALUES (1,'APPROVED','2020-01-01'),(2,'APPROVED','2020-01-01'),(3,'APPROVED','2020-01-01'),(4,'APPROVED','2020-01-01');
-- F1 route 11: RM issue, Mixing, Labelling(repeatable, optional), FG bulk storage(mandatory), FG transfer boundary
INSERT INTO costing.production_route_family_route(id,route_family_id,status,effective_from) VALUES (11,1,'APPROVED','2020-01-01'),(12,2,'APPROVED','2020-01-01'),(13,3,'APPROVED','2020-01-01');
INSERT INTO costing.production_route_family_route(id,route_family_id,route_version,status,effective_from,effective_to) VALUES (14,4,1,'APPROVED','2020-01-01','2021-12-31');
INSERT INTO costing.production_route_family_route(id,route_family_id,route_version,status,effective_from) VALUES (15,4,2,'APPROVED','2023-01-01');
INSERT INTO costing.production_route_family_route_step(id,family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,is_mandatory,allows_repeat) VALUES
 (101,11,'RM',10,5,1,1,10,100,'STD','GENERAL','BOUNDARY_RM_ISSUE',true,false),(102,11,'MIX',20,1,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),
 (105,11,'LAB',25,4,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',false,true),(103,11,'FG',30,2,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),
 (104,11,'FGT',40,6,1,1,10,100,'STD','GENERAL','BOUNDARY_FG_TRANSFER',true,false),
 -- F2: valid route WITHOUT an FG bulk storage step
 (201,12,'RM',10,5,1,1,10,100,'STD','GENERAL','BOUNDARY_RM_ISSUE',true,false),(202,12,'MIX',20,1,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(204,12,'FGT',40,6,1,1,10,100,'STD','GENERAL','BOUNDARY_FG_TRANSFER',true,false),
 -- F3: TWO mandatory FG bulk storage steps
 (301,13,'RM',10,5,1,1,10,100,'STD','GENERAL','BOUNDARY_RM_ISSUE',true,false),(302,13,'FGA',20,2,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(303,13,'FGB',30,2,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(304,13,'FGT',40,6,1,1,10,100,'STD','GENERAL','BOUNDARY_FG_TRANSFER',true,false),
 -- F4 (date gap family): versions 14 (to 2021-12-31) and 15 (from 2023-01-01)
 (401,14,'RM',10,5,1,1,10,100,'STD','GENERAL','BOUNDARY_RM_ISSUE',true,false),(402,14,'MIX',20,1,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(403,14,'FG',30,2,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(404,14,'FGT',40,6,1,1,10,100,'STD','GENERAL','BOUNDARY_FG_TRANSFER',true,false),
 (501,15,'RM',10,5,1,1,10,100,'STD','GENERAL','BOUNDARY_RM_ISSUE',true,false),(502,15,'MIX',20,1,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(503,15,'FG',30,2,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',true,false),(504,15,'FGT',40,6,1,1,10,100,'STD','GENERAL','BOUNDARY_FG_TRANSFER',true,false);
INSERT INTO costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) VALUES
 (21,1,'APPROVED','2020-01-01'),(22,1,'APPROVED','2020-01-01'),(24,2,'APPROVED','2020-01-01'),(25,1,'APPROVED','2020-01-01'),(26,1,'APPROVED','2020-01-01'),
 (27,3,'APPROVED','2020-01-01'),(28,1,'APPROVED','2020-01-01'),(29,4,'APPROVED','2020-01-01'),(30,1,'APPROVED','2020-01-01');
INSERT INTO public.production_batch_size_ref VALUES (1,22),(2,25),(3,26);
-- P22: product routes 20 (2026-01-01..2026-10-31) and 21 (from 2026-11-01) with the four override kinds on 21
INSERT INTO costing.product_process_route(id,product_id,base_route_family_route_id,batch_size_ref_id,status,effective_from,effective_to) VALUES (20,22,11,1,'APPROVED','2026-01-01','2026-10-31'),(21,22,11,1,'APPROVED','2026-11-01',NULL);
INSERT INTO costing.product_process_route_override(id,product_route_id,operation_type,base_step_id,override_step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope) VALUES
 (701,21,'ADD_STEP',NULL,'HEAT',15,8,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',1,1,false,false,false,'INCLUDE','INCLUDE'),
 (702,21,'REPLACE_STEP',102,NULL,20,7,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',1,1,true,false,false,'INCLUDE','INCLUDE');
INSERT INTO costing.product_process_route_override(id,product_route_id,operation_type,base_step_id) VALUES (703,21,'BYPASS_STEP',105);
INSERT INTO costing.product_process_route_override(id,product_route_id,operation_type,base_step_id,expected_occurrence_count,standard_cycle_count) VALUES (704,21,'ALTER_CYCLE',103,2,2);
-- P25: two overlapping approved product routes
INSERT INTO costing.product_process_route(id,product_id,base_route_family_route_id,batch_size_ref_id,status,effective_from) VALUES (51,25,11,2,'APPROVED','2026-01-01'),(52,25,11,2,'APPROVED','2026-06-01');
-- P26: ONLY an archived product route (must be ignored; inherits the family route)
INSERT INTO costing.product_process_route(id,product_id,base_route_family_route_id,batch_size_ref_id,status,effective_from,archived_at) VALUES (61,26,11,3,'APPROVED','2026-01-01',now());
INSERT INTO public.test_perm VALUES
 ('${SIGNER}','module:mis-batch-stage-signer',true,true),('${SIGNV}','module:mis-batch-stage-signer',true,false),
 ('${PACKER}','module:mis-fg-bulk-packing',true,true),('${PACKV}','module:mis-fg-bulk-packing',true,false),
 ('${EXCESS}','module:mis-fg-bulk-packing',true,true),('${EXCESS}','module:mis-fg-excess-adjustment',true,true),
 ('${EXECV}','module:executive-mis-dashboard',true,false),('${EXCESS}','module:executive-mis-dashboard',true,false);
CREATE VIEW public.fg_bulk_stock AS SELECT l.product_id, p.item, l.batch_number AS bn, sum(l.qty_base) AS qty_on_hand, p.uom_base AS on_hand_qty_uom FROM public.fg_bulk_stock_ledger l JOIN public.products p ON p.id = l.product_id GROUP BY l.product_id, p.item, l.batch_number, p.uom_base;
GRANT SELECT ON public.fg_bulk_stock TO authenticated;
CREATE FUNCTION public.s7_batch(p_item text, p_bn text, p_date date, p_qty numeric DEFAULT 10) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE w int; pid int; BEGIN
  SELECT id INTO pid FROM public.products WHERE item = p_item;
  INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT coalesce(max(id),1000)+1 FROM public.bmr_details),pid,p_bn,'Released');
  INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES (p_item,p_bn,'FG bulk storage',p_date,'In Progress',p_qty,'kg') RETURNING id INTO w;
  RETURN w; END $$;
CREATE FUNCTION public.s7_log(p_item text, p_bn text, p_act text, p_date date) RETURNS integer LANGUAGE sql AS $$
  INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES (p_item,p_bn,p_act,p_date,'In Progress') RETURNING id $$;
CREATE FUNCTION public.s7_event(p_wl int, p_type text DEFAULT 'Bottling') RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (p_wl,p_type) RETURNING id $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;`;


export const run1 = (pg, db, sql, opts) => { const r = pg.psql(db, sql, opts); if (r.status !== 0) throw new Error(`${db}: ${r.err}\n${sql.slice(0, 200)}`); return r; };
/** Builds `pre7` (S2–S6 + fixture, S7 NOT installed) and clones each name in `withS7` with S7a+S7b installed (one transaction each). */
export function buildS7Databases(pg, withS7 = ['s7']) {
  pg.createDb('pre7');
  run1(pg, 'pre7', fs.readFileSync(path.join(here, '../00_base_schema_shim.sql'), 'utf8'));
  installLiveEditor(pg, 'pre7');
  run1(pg, 'pre7', fs.readFileSync(path.join(here, 'route_engine_fixture.sql'), 'utf8'));
  run1(pg, 'pre7', extractRouteEngine().sql);
  for (const f of MIGRATIONS) { if (f.includes('s3b_')) run1(pg, 'pre7', seedShimFingerprintsSql()); run1(pg, 'pre7', mig(f)); }
  run1(pg, 'pre7', mig(PATCHED_CORE_MIGRATION)); run1(pg, 'pre7', mig(FINGERPRINT_MIGRATION));
  run1(pg, 'pre7', seedSql());
  for (const d of withS7) { if (pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status !== 0) throw new Error('clone ' + d); run1(pg, d, asTx(mig(S7A))); run1(pg, d, asTx(mig(S7B))); }
}
