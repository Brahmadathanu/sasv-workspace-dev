\set ON_ERROR_STOP 1
-- PROVISIONAL capacity table (per load). basis WEIGHT => loads=ceil(M/cap); FIXED => 1 per batch
drop table if exists sim.cap;
create table sim.cap(rc text primary key, basis text, cap_kg numeric, cap_l numeric, source text);
insert into sim.cap values
('GRINDER','WEIGHT',50,50,'PROVISIONAL - user to confirm (pulveriser/grinder charge kg)'),
('DRYER_OR_OVEN','WEIGHT',50,50,'PROVISIONAL - 24-tray dryer ~2 kg/tray'),
('PROCESSING_VESSEL','WEIGHT',220,500,'EVIDENCE daily_work_log P90 single-vessel batch (kg 220 / L 500)'),
('EXTRACTION_SYSTEM','WEIGHT',370,500,'EVIDENCE daily_work_log SS Cooker P90 single-vessel batch'),
('FILTRATION_SYSTEM','WEIGHT',220,500,'follows processing vessel'),
('FERMENTATION_VESSEL','WEIGHT',3000,3000,'EVIDENCE plant names (1500/3000 L tanks); max used'),
('TABLET_OR_CAPSULE_EQUIPMENT','WEIGHT',50,50,'PROVISIONAL'),
('MIXING_EQUIPMENT','WEIGHT',200,200,'PROVISIONAL'),
('MANUAL','WEIGHT',50,50,'PROVISIONAL - manual handling lot'),
('CALCINATION','WEIGHT',25,25,'PROVISIONAL - puta charge'),
('TRADITIONAL_FURNACE','WEIGHT',25,25,'PROVISIONAL'),
('STORAGE_OCCUPANCY','FIXED',null,null,'1 per batch'),
('GENERAL_AREA','FIXED',null,null,'1 per batch'),
('EXTERNAL_JOB_WORK','FIXED',null,null,'1 per batch');
update sim.cap set cap_kg=cap_kg*:capmult, cap_l=cap_l*:capmult where basis='WEIGHT';
-- batch masses per product: m_solid (solid RM kg charged, scaled to batch_size_ref) for solid-handling steps;
-- m_out (output batch, kg or L) for vessel/liquid steps. Kit/Kanji = pack mass (BOM is per gram).
drop table if exists sim.bm;
create table sim.bm as select m.product_id, m.uom, m.bs,
  case when m.product_id=685 then m.bs*0.275 when m.product_id=695 then m.bs*0.5 when m.uom='Kg' then m.bs else m.bs*b.kg/nullif(m.ref,0) end m_solid,
  case when m.product_id=685 then m.bs*0.275 when m.product_id=695 then m.bs*0.5 when m.uom in ('Kg','L') then m.bs else m.bs*m.bom_mass/nullif(m.ref,0) end m_out,
  case when m.uom='L' then 'L' else 'Kg' end out_uom
 from sim.mass m left join sim.bomsplit b using(product_id);
alter table sim.cap add mass_basis text;
update sim.cap set mass_basis = case when rc in ('PROCESSING_VESSEL','EXTRACTION_SYSTEM','FILTRATION_SYSTEM','FERMENTATION_VESSEL') then 'OUTPUT' else 'SOLID' end;
create or replace function sim.loads(p_rc text, p_product bigint) returns numeric language sql stable as $$
 select case when c.basis is null then null when c.basis='FIXED' then 1
   else greatest(1, ceil(coalesce(case when c.mass_basis='OUTPUT' then b.m_out else coalesce(nullif(b.m_solid,0),b.m_out) end,0)
          / case when c.mass_basis='OUTPUT' and b.out_uom='L' then c.cap_l else c.cap_kg end)) end
 from sim.cap c left join sim.bm b on b.product_id=p_product where c.rc=p_rc $$;
-- ratios
drop table if exists sim.r;
create table sim.r as
with ps as (select s.product_id, sum(s.step_factor) f, sum(s.step_factor*sim.loads(s.resource_class_code,s.product_id)) fl, bool_or(sim.loads(s.resource_class_code,s.product_id) is null) unm
  from costing.product_production_overhead_step_snapshot s where s.refresh_run_id=:run group by 1),
ds as (select s.product_id, sum(s.step_labour_factor) f, sum(s.step_labour_factor*sim.loads(s.resource_class_code,s.product_id)) fl, bool_or(sim.loads(s.resource_class_code,s.product_id) is null) unm
  from costing.product_direct_labour_step_snapshot s where s.refresh_run_id=:run group by 1)
select coalesce(ps.product_id,ds.product_id) product_id, coalesce(ps.fl/nullif(ps.f,0),1) r_poh, coalesce(ds.fl/nullif(ds.f,0),1) r_dl, coalesce(ps.unm,false) or coalesce(ds.unm,false) unmapped
 from ps full join ds using(product_id);
-- product reallocation (full absorption: same pool, shares re-derived)
drop table if exists sim.p;
create table sim.p as
with poh as (select w.product_id, w.workload_units wl, w.workload_units/nullif(w.company_ready_workload_units,0) sh, coalesce(r.r_poh,1) r from costing.product_production_overhead_workload_snapshot w left join sim.r r using(product_id) where w.refresh_run_id=:run),
 dl as (select w.product_id, w.direct_labour_workload_units wl, w.product_workload_share sh, coalesce(r.r_dl,1) r from costing.product_direct_labour_workload_snapshot w left join sim.r r using(product_id) where w.refresh_run_id=:run)
select coalesce(poh.product_id,dl.product_id) product_id, poh.wl poh_wl, poh.r poh_r, poh.sh poh_sh, dl.wl dl_wl, dl.r dl_r, dl.sh dl_sh
 from poh full join dl using(product_id);
alter table sim.p add poh_sh_new numeric, add dl_sh_new numeric;
update sim.p set poh_sh_new = case when coalesce(poh_sh,0)=0 then poh_sh else poh_wl*poh_r / (select sum(poh_wl*poh_r) from sim.p where poh_sh>0) end,
                 dl_sh_new  = case when coalesce(dl_sh,0)=0 then dl_sh else dl_wl*dl_r / (select sum(dl_wl*dl_r) from sim.p where dl_sh>0) end;
