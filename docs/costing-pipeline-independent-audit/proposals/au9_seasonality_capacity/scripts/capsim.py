import json, math, collections, statistics as st, csv
j=json.load(open('cap128.json'))
f=lambda v: float(v) if v not in (None,'') else 0.0
CAP={'GRINDER':('W','S',50,None),'DRYER_OR_OVEN':('W','S',50,None),'MANUAL':('W','S',50,None),'TABLET_OR_CAPSULE_EQUIPMENT':('W','S',50,None),
 'MIXING_EQUIPMENT':('W','S',200,None),'CALCINATION':('W','S',25,None),'TRADITIONAL_FURNACE':('W','S',25,None),
 'PROCESSING_VESSEL':('W','O',220,500),'FILTRATION_SYSTEM':('W','O',220,500),'EXTRACTION_SYSTEM':('W','O',370,500),'FERMENTATION_VESSEL':('W','O',None,3000),
 'GENERAL_AREA':('F',None,None,None),'STORAGE_OCCUPANCY':('F',None,None,None),'EXTERNAL_JOB_WORK':('F',None,None,None)}
scal={(x['pool'],x['p']):x for x in j['scal']}
steps={'PRODUCTION_OVERHEAD':collections.defaultdict(list),'MANUFACTURING_LABOUR':collections.defaultdict(list)}
for x in j['poh']: steps['PRODUCTION_OVERHEAD'][x['p']].append((x['rc'],f(x['f'])))
for x in j['dl']: steps['MANUFACTURING_LABOUR'][x['p']].append((x['rc'],f(x['f'])))
def loads(rc,s,mult):
    c=CAP.get(rc)
    if c is None or c[0]=='F': return 1
    basis,cb,kg,l=c; m=mult.get(rc,1.0)
    if cb=='O':
        q=f(s['o']); cap=(l if s['ou']=='L' and l else (kg or l))
    else:
        q=f(s['s']); cap=kg or l
    return max(1, math.ceil(q/(cap*m))) if cap else 1
def factor(pool,p,mult):
    s=scal.get((pool,p))
    if s is None: return None
    return sum(fa*loads(rc,s,mult) for rc,fa in steps[pool][p])
# validate
bad=0; n=0
for (pool,p),s in scal.items():
    v=factor(pool,p,{}); n+=1
    if abs(v-f(s['sc']))>1e-6: bad+=1
print('validate mismatches',bad,'of',n)

basis={x['sku_id']:x for x in json.load(open('basis.json'))}
cost={x['sku_id']:x for x in json.load(open('cost128.json'))}
pack={x['s']:f(x['pl']) for x in json.load(open('pack128.json'))}
mbe={x['p']:f(x['mbe']) for x in j['wp']}
def shares(pool,mult):
    w={p:(factor(pool,p,mult) or 0)*mbe.get(p,0) for (pl,p) in scal if pl==pool}
    t=sum(w.values()); return {p:v/t for p,v in w.items()}
base={pool:shares(pool,{}) for pool in steps}
def run(mult,label):
    new={pool:shares(pool,mult) for pool in steps}
    dc=[]; neg=0; per=[]
    for s,c in cost.items():
        p=basis[s]['product_id']; cop=f(c['cop'])
        mdl=f(c['dl'])-pack.get(s,0); poh=f(c['poh'])
        rdl=new['MANUFACTURING_LABOUR'].get(p,0)/base['MANUFACTURING_LABOUR'][p] if base['MANUFACTURING_LABOUR'].get(p) else 1
        rpo=new['PRODUCTION_OVERHEAD'].get(p,0)/base['PRODUCTION_OVERHEAD'][p] if base['PRODUCTION_OVERHEAD'].get(p) else 1
        d=mdl*(rdl-1)+poh*(rpo-1)
        if cop: dc.append(d/cop)
        if min(f(c['mik']),f(c['mok']))-d<0: neg+=1
        per.append((d/cop if cop else 0,s,basis[s]['product_name'],basis[s]['pack_size']+' '+basis[s]['pack_uom'],round(cop,2),round(cop+d,2)))
    per.sort()
    return dict(scenario=label,median_cop_pct=round(100*st.median(dc),2),p10_pct=round(100*sorted(dc)[len(dc)//10],2),p90_pct=round(100*sorted(dc)[9*len(dc)//10],2),
        skus_up5=sum(1 for x in dc if x>0.05),skus_down5=sum(1 for x in dc if x<-0.05),max_up_pct=round(100*max(dc),1),max_down_pct=round(100*min(dc),1),neg_margin=neg,
        top_up=[(x[1],x[2][:22],x[3],x[4],x[5]) for x in per[-3:]],top_down=[(x[1],x[2][:22],x[3],x[4],x[5]) for x in per[:3]])
W=[k for k,v in CAP.items() if v[0]=='W']
res=[run({},'S0 run 128 capacities')]
res.append(run({k:0.5 for k in W},'S1 all capacities x0.5'))
res.append(run({k:2.0 for k in W},'S2 all capacities x2'))
for k in W:
    res.append(run({k:0.5},f'S3 {k} x0.5'))
res.append(run({'FERMENTATION_VESSEL':0.5},'S4 fermentation 1,500 L (smaller tanks)'))
res.append(run({'GRINDER':0.2},'S5 grinders 10 kg (levigation-size)'))
res.append(run({'MANUAL':2.0},'S6 manual lot 100 kg'))
for r in res: print({k:v for k,v in r.items() if k not in ('top_up','top_down')})
json.dump(res,open('cap_sensitivity.json','w'),indent=1)
# products with >1 loads per class at baseline
cnt=collections.Counter()
for (pool,p),s in scal.items():
    if pool!='PRODUCTION_OVERHEAD': continue
    for rc,fa in steps[pool][p]:
        if loads(rc,s,{})>1: cnt[rc]+=1
print('steps with >1 load (POH):',cnt)
