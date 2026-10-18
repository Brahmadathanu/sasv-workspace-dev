import json
M={m['plant_id']:m for m in json.load(open('mach_rows.json'))}
APPROVAL='USER-CORRECTED-20261018-AU9-R2'
q=lambda v: 'null' if v in (None,'') else "'"+str(v).replace("'","''")+"'"
U='user-corrected 2026-10-18 18:19 IST: '
rows=[];exp=[]
def charge(i,eq,rc,kg,ref,flags=None,prev=None,basis='SOLID_CHARGE_KG',unit='kg'):
    rows.append((i,'CAPACITY_BASED_PRODUCTION',eq,rc,'CHARGE',basis,unit,kg,kg,'USER_DECLARED',U+ref,flags)); exp.append((i,prev or eq))
def thr(i,eq,kgh,ref,prev):
    rows.append((i,'CAPACITY_BASED_PRODUCTION',eq,'GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',kgh,kgh,'USER_DECLARED',U+ref+'. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS')); exp.append((i,prev))
for i in range(4,35): charge(i,'RASOUSHADHI_LEVIGATION_GRINDER','GRINDER',20,'steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',M[i]['flags'] or None)
charge(41,'STONE_GRINDER','GRINDER',10,'first stone grinder 10 kg per charge (mapped to "Stone Grinder 1", lowest id) (supersedes R1 2 kg)','FIRST_STONE_GRINDER_MAPPED_BY_NAME_AND_LOWEST_ID')
for i in (42,43,44): charge(i,'STONE_GRINDER','GRINDER',5,'further stone grinder 5 kg per charge (supersedes R1 2 kg)')
for i in (45,46): charge(i,'MECHANISED_KHALVAM_SET','GRINDER',3.2,'mechanised khalvam 0.8 kg per unit, set of 4 = 3.2 kg per charge (supersedes R1 2 kg)')
for i in range(68,81): charge(i,'PILLS_WET_GRINDER','GRINDER',3,'Pills area grinder 3 kg per charge',M[i]['flags'] or None)
charge(81,'STONE_GRINDER','GRINDER',3,'Pills area grinder 3 kg per charge; this stone grinder in the Pills area ASSUMED 3 kg (confirm)','ASSUMPTION_PILLS_STONE_GRINDER_3KG')
charge(174,'WET_GRINDER','GRINDER',2,'wet grinder 2 kg per charge',M[174]['flags'] or None)
for i in [105,106,107,108,109,110,111,112,113,114,156,159,161]:
    v=1000 if '(1000 L)' in M[i]['plant_name'] else 500
    charge(i,f'FERMENTATION_TANK_{v}L','FERMENTATION_VESSEL',v,f'fermentation tank used at full capacity: working = rated {v} L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'+(';ALSO_LOGGED_AS_FG_BULK_STORAGE' if i in (159,161) else ''),basis='OUTPUT_VOLUME_L',unit='L')
thr(2,'DISINTEGRATOR',round(85/3,4),'disintegrator 85 kg in 3 h = 28.3333 kg/h','PULVERISER_DISINTEGRATOR')
for i in (127,129,131,132,133,134,135): thr(i,'SEMI_AUTO_PULVERISER',5,'pulveriser 10 kg in 2 h = 5 kg/h','PULVERISER_DISINTEGRATOR')
for i in (136,137): thr(i,'VIBRO_SIFTER_HORIZONTAL',round(66/7,4),'horizontal sifter 66 kg in 7 h = 9.4286 kg/h','VIBRO_SIFTER')
for i in (138,162): thr(i,'VIBRO_SIFTER_ROUND',1.1,'round sifter 22 kg in 20 h = 1.1 kg/h','VIBRO_SIFTER')
assert len(rows)==77 and len({r[0] for r in rows})==77
r1ids=list(range(4,35))+[41,42,43,44,45,46,105,106,107,108,109,110,111,112,113,114,156,159,161]
g2ids=[r[0] for r in rows if r[0] not in r1ids]
# expected current classes: R1 rows keep same class; G2 rows per inventory
R1EQ={i:('RASOUSHADHI_LEVIGATION_GRINDER' if i<35 else 'STONE_GRINDER' if i<45 else 'MECHANISED_KHALVAM_SET' if i<47 else ('FERMENTATION_TANK_1000L' if '(1000 L)' in M[i]['plant_name'] else 'FERMENTATION_TANK_500L')) for i in r1ids}
E=[(i,R1EQ[i] if i in R1EQ else M[i]['proposed_equipment_class']) for i in [r[0] for r in rows]]
num=lambda x: 'null' if x is None else repr(float(x)).rstrip('0').rstrip('.') if isinstance(x,float) else str(x)
R=',\n '.join("("+",".join([str(r[0])]+[q(x) for x in r[1:7]]+[num(r[7]),num(r[8])]+[q(x) for x in r[9:]])+")" for r in rows)
s=open('r2_template.sql').read().replace('@@ROWS@@',R).replace('@@EXPECT@@',','.join(f"({a},{q(b)})" for a,b in E)) \
  .replace('@@IDS_R1@@',','.join(map(str,r1ids))).replace('@@IDS_G2@@',','.join(map(str,g2ids))).replace('@@IDS@@',','.join(str(r[0]) for r in rows)).replace('@@APPROVAL@@',APPROVAL)
open('/workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_R2_capacity_corrections.sql','w').write(s)
print('ok', len(rows), 'g2', g2ids, set(b for a,b in E if a in g2ids))
