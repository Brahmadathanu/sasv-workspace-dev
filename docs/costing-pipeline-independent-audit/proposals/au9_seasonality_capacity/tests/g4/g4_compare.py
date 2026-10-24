# Compare the G4 local engine (switch ON, simulated November run) with the R2-A re-simulation, and OFF with run 128.
import csv, json, sys, os
os.chdir('/workspace/au9')
src=open('sim_g4_r2.py').read().split("SC=[")[0]
exec(src)                                   # sim machinery + make_rule() + patched factor()
DB={}
for r in csv.DictReader(open('g4/g4_on_factors.csv')): DB[(r['allocation_pool'],int(r['product_id']))]=(float(r['factor']),float(r['legacy']))
sim_rule=make_rule()
fact_sim={k:factor(k[0],k[1],sim_rule,{}) for k in scal}
dif=[(k,fact_sim[k],DB[k][0]) for k in scal if abs(fact_sim[k]-DB[k][0])>1e-6]
print('factor rows',len(scal),'engine vs R2-A simulation factor differences:',len(dif), dif[:5])
R_sim=run('R2-A simulation',sim_rule)
_f=factor
def factor_db(pool,p,rule,mult): return DB[(pool,p)][0] if rule=='DB' else (DB[(pool,p)][1] if rule=='LEGACY' else _f(pool,p,rule,mult))
globals()['factor']=factor_db
R_db=run('G4 engine ON (run 9001)','DB'); R_off=run('G4 engine OFF','LEGACY')
out={}
for R in (R_sim,R_db,R_off):
    per=sorted(R['per'],key=lambda x:x['pct']); km={x['sku']:x for x in per}
    out[R['scenario']]=dict(median_pct=R['median_pct'],dearer5=R['dearer5'],cheaper5=R['cheaper5'],neg_margin=R['neg_margin'],new_neg=R['new_neg'],cleared=R['cleared'],
        max_abs_change_rs=round(max(abs(x['cop_new']-x['cop128']) for x in per),2),
        top=[(x['sku'],x['name'],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[-6:][::-1]],
        watch={s:(km[s]['name'],km[s]['cop128'],km[s]['cop_new'],km[s]['pct']) for s in (658,1266,1157,1792,937,878,865)})
    print('\n',R['scenario'],json.dumps({k:v for k,v in out[R['scenario']].items() if k not in ('top','watch')}))
    print(' top:',out[R['scenario']]['top']); print(' watch:',out[R['scenario']]['watch'])
skud=[(a['sku'],a['cop_new'],b['cop_new']) for a,b in zip(sorted(R_sim['per'],key=lambda x:x['sku']),sorted(R_db['per'],key=lambda x:x['sku'])) if abs(a['cop_new']-b['cop_new'])>0.005]
print('\nSKU COP differences engine vs simulation (> Rs 0.005):',len(skud))
json.dump(out,open('g4/g4_compare_summary.json','w'),indent=1)
with open('g4/g4_engine_per_sku.csv','w',newline='') as fh:
    w=csv.writer(fh); w.writerow(['sku_id','product_id','product','pack','cop_run128','cop_g4_on','pct'])
    for x in sorted(R_db['per'],key=lambda x:-x['pct']): w.writerow([x['sku'],x['product_id'],x['name'],x['pack'],x['cop128'],x['cop_new'],x['pct']])
