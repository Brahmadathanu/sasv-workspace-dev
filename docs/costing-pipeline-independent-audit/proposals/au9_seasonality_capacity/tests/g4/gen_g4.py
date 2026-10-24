# Generates PREPARED_AU9_G4_plant_aware_loads.sql from g4_template.sql and the reviewed live RPC definitions.
import hashlib, re
T=open('g4_template.sql').read()
POH=open('REVIEWED_rpc_refresh_production_overhead_workload_snapshot.sql').read(); DL=open('REVIEWED_rpc_refresh_sku_direct_labour_component_split_snapshot.sql').read()
md5=lambda t: hashlib.md5(t.encode()).hexdigest()
OLD_POH_CALL="costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)"
NEW_POH_CALL="costing.fn_au9_g4_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, e.base_step_id, e.override_id, e.activity_id)"
OLD_DL_CALL="costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)"
NEW_DL_CALL="costing.fn_au9_g4_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, nullif(e->>'base_step_id','')::bigint, nullif(e->>'override_id','')::bigint, nullif(e->>'activity_id','')::integer)"
POH_ANCHOR="    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.\n"
POH_INS="""    -- AU-9 G4: per-step load provenance and labour/overhead consistency (only when plant-aware loads are on).
    if costing.fn_au9_g4_load_mode(p_valuation_date) is not null then
      perform costing.fn_au9_g4_capture_provenance(p_refresh_run_id, v_period_start, p_valuation_date, 'PRODUCTION_OVERHEAD',
                t.product_id, ch.solid_kg, ch.output_qty, ch.output_uom, f.step_evidence)
         from tmp_po_product t
         join tmp_po_charge ch on ch.product_id = t.product_id
         join tmp_po_foundation f on f.product_id = t.product_id
        where t.raw_route_factor is not null;
      if exists (select 1 from costing.route_step_load_provenance_snapshot d
                   join costing.route_step_load_provenance_snapshot p on p.refresh_run_id = d.refresh_run_id and p.product_id = d.product_id
                    and p.effective_step_key = d.effective_step_key
                  where d.refresh_run_id = p_refresh_run_id and d.allocation_pool = 'MANUFACTURING_LABOUR' and p.allocation_pool = 'PRODUCTION_OVERHEAD'
                    and (d.loads is distinct from p.loads or d.resolution_basis is distinct from p.resolution_basis)) then
        raise exception 'AU-9 G4: Manufacturing Labour and Production Overhead resolved the same route step differently in run %', p_refresh_run_id;
      end if;
    end if;

"""
DL_ANCHOR="      from tmp_dl_scale s;\n"
DL_INS="""      from tmp_dl_scale s;
    -- AU-9 G4: per-step load provenance (only when plant-aware loads are on).
    if costing.fn_au9_g4_load_mode(p_valuation_date) is not null then
      perform costing.fn_au9_g4_capture_provenance(p_refresh_run_id, v_period_start, p_valuation_date, 'MANUFACTURING_LABOUR',
                s.product_id, s.solid_kg, s.output_qty, s.output_uom, t.labour_step_evidence)
         from tmp_dl_scale s join tmp_dl_product t on t.product_id = s.product_id;
    end if;
"""
POH_STEPS=[('poh_calls',OLD_POH_CALL,NEW_POH_CALL,2),
 ('poh_detail_cols',"as e(sequence_no numeric, resource_class_code text)","as e(sequence_no numeric, resource_class_code text, base_step_id bigint, override_id bigint, activity_id integer)",1),
 ('poh_provenance',POH_ANCHOR,POH_INS+POH_ANCHOR,1),
 ('poh_result',"'route_load_scaling',v_rl,","'route_load_scaling',v_rl,'plant_aware_load_switch_id',costing.fn_au9_g4_load_mode(p_valuation_date),",1)]
DL_STEPS=[('dl_calls',OLD_DL_CALL,NEW_DL_CALL,2),('dl_provenance',DL_ANCHOR,DL_INS,1)]
def apply(t,steps):
    for lab,o,n,c in steps:
        assert t.count(o)==c,(lab,t.count(o)); t=t.replace(o,n)
    return t
def plsql(steps):
    out=[]
    for lab,o,n,c in steps:
        assert '$g4' not in o+n and '$$' not in o+n
        out.append(f"""      v_cnt := (length(v_new) - length(replace(v_new, $g4o${o}$g4o$, ''))) / length($g4o${o}$g4o$);
      if v_cnt <> {c} then raise exception 'AU9-G4: patch anchor {lab} found % times (expected {c})', v_cnt; end if;
      v_new := replace(v_new, $g4o${o}$g4o$, $g4n${n}$g4n$);""")
    return "\n".join(out)
POHN=apply(POH,POH_STEPS); DLN=apply(DL,DL_STEPS)
open('PATCHED_rpc_refresh_production_overhead_workload_snapshot.sql','w').write(POHN); open('PATCHED_rpc_refresh_sku_direct_labour_component_split_snapshot.sql','w').write(DLN)
S=T.replace('@@POH_MD5_ORIG@@',md5(POH)).replace('@@POH_MD5_NEW@@',md5(POHN)).replace('@@DL_MD5_ORIG@@',md5(DL)).replace('@@DL_MD5_NEW@@',md5(DLN))
S=S.replace('@@POH_STEPS@@',plsql(POH_STEPS)).replace('@@DL_STEPS@@',plsql(DL_STEPS))
assert '@@' not in S
out='../../PREPARED_AU9_G4_plant_aware_loads.sql'
open(out,'w').write(S); print('written',len(S),md5(S),'poh',md5(POH),md5(POHN),'dl',md5(DL),md5(DLN))
