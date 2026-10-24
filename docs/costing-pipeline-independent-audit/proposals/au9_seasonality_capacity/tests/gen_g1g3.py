import json, re
M=json.load(open('mach_rows.json'))
OUT='/workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_G1_G3_capacity_master.sql'
APPROVAL='USER-APPROVAL-20261018-AU9-G1G3'
EFF='2026-11-01'
q=lambda v: 'null' if v in (None,'') else "'"+str(v).replace("'","''")+"'"
EQ={ # code: (description, applicability, resource class, mode, unit)
}
rows=[]
for m in M:
    app=m['proposed_applicability']; eq=m['proposed_equipment_class']; rc=m['proposed_costing_resource_class'] or None
    mode=m['capacity_mode'] or 'NONE'; basis=m['charge_basis'] or 'NOT_APPLICABLE'; unit=m['physical_unit'] or None
    rated=m['proposed_rated_capacity'] or None; ev='NONE'; evref=None
    flags=m['flags']
    if eq=='STEAM_JACKETED_DISTILLATION': rc='DISTILLATION_UNIT'
    if eq in ('WATER_TANK_USED_AS_FERMENTATION','KHALVAM_MANUAL_LEVIGATION'):
        # user 18 Oct 15:36: questions open -> UNKNOWN, provisional, no numbers
        evref=('Name states '+str(int(rated))+' L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN') if rated else 'Manual tool vs capacity asset question OPEN'
        app='UNKNOWN'; mode='NONE'; basis='NOT_APPLICABLE'; unit=None; rated=None; ev='NAME_DERIVED' if 'WATER' in eq else 'NONE'
    elif rated:
        ev='NAME_DERIVED'; evref=f"Rated {int(rated)} L from plant name; effective working volume not yet supplied"
    if app not in ('CAPACITY_BASED_PRODUCTION','CAPACITY_BASED_PACKING','UNKNOWN'):
        mode='NONE'; basis='NOT_APPLICABLE'; unit=None; rated=None
    if app=='CAPACITY_BASED_PACKING': unit='packs/min'
    EQ.setdefault(eq,(eq.replace('_',' ').title(), app, rc, mode, unit))
    rows.append((m['plant_id'],m['plant_name'],app,eq,rc,mode,basis,unit,rated,ev,evref,m['work_log_evidence'] or None,flags or None))
eqsql=',\n '.join(f"({q(k)},{q(v[0])},{q(v[1])},{q(v[2])},{q(v[3])},{q(v[4])})" for k,v in sorted(EQ.items()))
bf=',\n '.join(f"({r[0]},{q(r[1])},{q(r[2])},{q(r[3])},{q(r[4])},{q(r[5])},{q(r[6])},{q(r[7])},{r[8] if r[8] else 'null'}::numeric,{q(r[9])},{q(r[10])},{q(r[11])},{q(r[12])})" for r in rows)
sql=open('g1g3_template.sql').read().replace('@@EQ@@',eqsql).replace('@@BACKFILL@@',bf).replace('@@APPROVAL@@',APPROVAL).replace('@@EFF@@',EFF).replace('@@NEQ@@',str(len(EQ)))
open(OUT,'w').write(sql)
import collections
print(len(EQ), collections.Counter(r[2] for r in rows), sum(1 for r in rows if r[8]))
