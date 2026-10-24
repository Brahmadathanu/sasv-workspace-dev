import json, math, collections, statistics as st, csv, sys
src=open('sim_g4.py').read().split("S=[run(")[0]
exec(src)   # factor(), run(), rules from R1 sim; we define new rules below
FIXED='FIXED'
def make_rule(K=3.2, T='T1', sieve=66):
    def r(a):
        if not a: return 50
        act=a['act']
        if a['plant']==29: return 20
        if a['plant']==174 or act.startswith('Wet grinding'): return 2
        if act=='Kajjali grinding': return K
        if act=='Pill grinding': return 3
        if a['sub']=='Rasoushadhi' and a['area']=='Grinding Area' and act=='Grinding': return 20
        tp=None
        if act in ('Pulverization','Pulverizing and Sieving','Wet pulverization'): tp=10
        elif act=='Disintegration' or a['plant']==2: tp=85
        elif act=='Sieving': tp=sieve
        if tp is not None:
            return 50 if T=='T1' else (FIXED if T=='T2' else tp)
        return 50
    return r
# patch factor to support FIXED
def factor(pool,p,rule,mult):
    s=scal.get((pool,p))
    if s is None: return None
    tot=sum(fa*loads(rc,s,mult) for rc,fa in steps[pool][p] if rc!='GRINDER')
    for a,fa in gsteps[pool].get(p,[]):
        c=rule(a); tot+=fa*(1 if c==FIXED else max(1,math.ceil(f(s['s'])/c)))
    return tot
globals()['factor']=factor
SC=[('R2-A recommended: grinders 20 kg, Kajjali khalvam 3.2 kg, Pills 3 kg, wet 2 kg; throughput steps stay on 50 kg default (T1)',make_rule()),
    ('R2-A with Kajjali on stone grinder 10 kg',make_rule(K=10)),
    ('R2-A with Kajjali on stone grinder 5 kg',make_rule(K=5)),
    ('R2-T2 throughput steps 1 load per batch',make_rule(T='T2')),
    ('R2-T3 throughput steps at kg per standard run (85/10/66 kg)',make_rule(T='T3')),
    ('R2-T3b as T3 with sieving on round sifter 22 kg',make_rule(T='T3',sieve=22)),
    ('R1 (superseded) for reference',rule_prop)]
S=[run(l,r) for l,r in SC]
WATCH=[1266,1157,1792,937,878,865]
out=[]
for r in S:
    per=sorted(r['per'],key=lambda x:x['pct']); km={x['sku']:x for x in per}
    print('\n'+r['scenario']); print({k:r[k] for k in ('median_pct','cheaper5','dearer5','neg_margin','new_neg','cleared')})
    print(' dearer:',[(x['sku'],x['name'][:22],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[-5:][::-1]])
    print(' cheaper:',[(x['sku'],x['name'][:22],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[:4]])
    print(' watch:',[(s,km[s]['name'][:16],km[s]['cop128'],km[s]['cop_new'],km[s]['pct']) for s in WATCH])
    print(' neg128:',[(s,km[s]['pct']) for s in NEG128])
    out.append(dict({k:v for k,v in r.items() if k!='per'},watch={s:[km[s]['cop128'],km[s]['cop_new'],km[s]['pct']] for s in WATCH},
        top_dearer=[(x['sku'],x['name'],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[-8:][::-1]],
        top_cheaper=[(x['sku'],x['name'],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[:8]]))
json.dump(out,open('g4r2_sim_summary.json','w'),indent=1)
with open('g4r2_sim_per_sku.csv','w',newline='') as fh:
    w=csv.writer(fh); w.writerow(['scenario','sku_id','product_id','product','pack','cop_run128','cop_scenario','pct'])
    for (l,_),r in zip(SC,S):
        for x in r['per']:
            if abs(x['pct'])>=0.005: w.writerow([l.split(' ')[0],x['sku'],x['product_id'],x['name'],x['pack'],x['cop128'],x['cop_new'],x['pct']])
