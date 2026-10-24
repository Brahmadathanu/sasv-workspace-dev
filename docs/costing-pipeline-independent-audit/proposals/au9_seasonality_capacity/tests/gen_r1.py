import json
M={m['plant_id']:m for m in json.load(open('mach_rows.json'))}
APPROVAL='USER-SUPPLIED-20261018-AU9-R1'
q=lambda v: 'null' if v in (None,'') else "'"+str(v).replace("'","''")+"'"
rows=[];exp=[]
G='user-supplied 2026-10-18 16:19 IST: '
for i in range(4,35):
    rows.append((i,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED',G+'steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)', M[i]['flags'] or None)); exp.append((i,'RASOUSHADHI_LEVIGATION_GRINDER'))
for i in range(41,45):
    rows.append((i,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED',G+'stone grinder 2 kg per charge (rated); working 2 kg provisional', M[i]['flags'] or None)); exp.append((i,'STONE_GRINDER'))
for i in (45,46):
    rows.append((i,'CAPACITY_BASED_PRODUCTION','MECHANISED_KHALVAM_SET','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED',G+'mechanised (not manual) khalvam set of 4 units x 500 g = 2 kg per charge; working 2 kg provisional', None)); exp.append((i,'KHALVAM_MANUAL_LEVIGATION'))
for i in [105,106,107,108,109,110,111,112,113,114,156,159,161]:
    v=1000 if '(1000 L)' in M[i]['plant_name'] else 500
    fl='TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'+(';ALSO_LOGGED_AS_FG_BULK_STORAGE' if i in (159,161) else '')
    rows.append((i,'CAPACITY_BASED_PRODUCTION',f'FERMENTATION_TANK_{v}L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',v,None,'NAME_DERIVED',f'user 2026-10-18 16:20 IST: used as a fermentation tank. Rated {v} L from plant name; working volume / fill % not supplied', fl)); exp.append((i,'WATER_TANK_USED_AS_FERMENTATION'))
assert len(rows)==50
R=',\n '.join("("+",".join([str(r[0])]+[q(x) if not isinstance(x,(int,float)) or isinstance(x,bool) else str(x) for x in r[1:7]]+[str(r[7]) if r[7] else 'null', str(r[8]) if r[8] else 'null']+[q(x) for x in r[9:]])+")" for r in rows)
E=','.join(f"({a},{q(b)})" for a,b in exp)
ids=','.join(str(r[0]) for r in rows)
s=open('r1_template.sql').read().replace('@@ROWS@@',R).replace('@@EXPECT@@',E).replace('@@IDS@@',ids).replace('@@APPROVAL@@',APPROVAL)
open('/workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_R1_capacity_revisions.sql','w').write(s)
print('ok',len(rows))
