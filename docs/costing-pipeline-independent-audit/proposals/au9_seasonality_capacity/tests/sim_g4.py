import json, math, collections, statistics as st, csv
exec(open('capsim.py').read().split("# validate")[0])   # CAP, scal, steps, loads(), f
G=json.load(open('grind128.json')); D=json.load(open('grind128_dl.json'))
attr={(g['p'],g['key']):g for g in G}
miss=[d for d in D if (d['p'],d['key']) not in attr]; print('DL grinder steps without POH match:',len(miss))
gsteps={'PRODUCTION_OVERHEAD':collections.defaultdict(list),'MANUFACTURING_LABOUR':collections.defaultdict(list)}
for g in G: gsteps['PRODUCTION_OVERHEAD'][g['p']].append((attr[(g['p'],g['key'])],f(g['f'])))
for d in D: gsteps['MANUFACTURING_LABOUR'][d['p']].append((attr.get((d['p'],d['key'])),f(d['f'])))
def rule_base(a): return 50
def rule_strict(a): return 8 if a and a['plant']==29 else 50
def rule_prop(a):
    if not a: return 50
    if a['plant']==29: return 8
    if a['act']=='Kajjali grinding': return 2
    if a['sub']=='Rasoushadhi' and a['area']=='Grinding Area' and a['act']=='Grinding': return 8
    return 50
def rule_all8(a): return 8 if a and (a['plant']==29 or (a['sub']=='Rasoushadhi' and a['area']=='Grinding Area')) else 50
def rule_all2(a): return 2 if a and (a['plant']==29 or (a['sub']=='Rasoushadhi' and a['area']=='Grinding Area')) else 50
def factor(pool,p,rule,mult):
    s=scal.get((pool,p))
    if s is None: return None
    tot=sum(fa*loads(rc,s,mult) for rc,fa in steps[pool][p] if rc!='GRINDER')
    for a,fa in gsteps[pool].get(p,[]):
        tot+=fa*max(1,math.ceil(f(s['s'])/rule(a)))
    return tot
bad=sum(1 for (pool,p),s in scal.items() if abs(factor(pool,p,rule_base,{})-f(s['sc']))>1e-6); print('baseline mismatches',bad,'of',len(scal))
basis={x['sku_id']:x for x in json.load(open('basis.json'))}
cost={x['sku_id']:x for x in json.load(open('cost128.json'))}
pack={x['s']:f(x['pl']) for x in json.load(open('pack128.json'))}
mbe={x['p']:f(x['mbe']) for x in j['wp']}
def shares(pool,rule,mult):
    w={p:(factor(pool,p,rule,mult) or 0)*mbe.get(p,0) for (pl,p) in scal if pl==pool}; t=sum(w.values()); return {p:v/t for p,v in w.items()}
B={pool:shares(pool,rule_base,{}) for pool in steps}
NEG128=[42,43,159,193,975,1174,1264,1365,1552]
KEY=[878,865]
def run(label,rule,mult={}):
    N={pool:shares(pool,rule,mult) for pool in steps}
    per=[];neg=[]
    for s,c in cost.items():
        p=basis[s]['product_id']; cop=f(c['cop']); d=0
        for pool,col in (('MANUFACTURING_LABOUR','dl'),('PRODUCTION_OVERHEAD','poh')):
            if B[pool].get(p): d+=(f(c[col])-(pack.get(s,0) if col=='dl' else 0))*(N[pool][p]/B[pool][p]-1)
        if min(f(c['mik']),f(c['mok']))-d<0: neg.append(s)
        per.append(dict(sku=s,product_id=p,name=basis[s]['product_name'],pack=f"{basis[s]['pack_size']} {basis[s]['pack_uom']}",cop128=round(cop,2),cop_new=round(cop+d,2),pct=round(100*d/cop,2) if cop else 0))
    pc=[x['pct'] for x in per]
    return dict(scenario=label,median_pct=round(st.median(pc),2),cheaper5=sum(1 for x in pc if x<-5),dearer5=sum(1 for x in pc if x>5),
                neg_margin=len(neg),neg_list=sorted(neg),new_neg=sorted(set(neg)-set(NEG128)),cleared=sorted(set(NEG128)-set(neg)),per=per)
S=[run('A proposed rule (Grinding 8 kg, Kajjali 2 kg, pulverisers/pills 50 kg default)',rule_prop),
   run('B strict G4: only route steps naming a machine (6 steps, Grinder 26) get 8 kg',rule_strict),
   run('C all Rasoushadhi grinding at 8 kg (incl. Kajjali)',rule_all8),
   run('D all Rasoushadhi grinding at 2 kg (stone/khalvam)',rule_all2),
   run('E = A + fermentation steps at 1,000 L tanks',rule_prop,{'FERMENTATION_VESSEL':1/3})]
out=[]
for r in S:
    per=sorted(r['per'],key=lambda x:x['pct'])
    print('\n'+r['scenario']); print({k:r[k] for k in ('median_pct','cheaper5','dearer5','neg_margin','new_neg','cleared')})
    print(' dearer:',[(x['sku'],x['name'][:24],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[-6:][::-1]])
    print(' cheaper:',[(x['sku'],x['name'][:24],x['pack'],x['cop128'],x['cop_new'],x['pct']) for x in per[:4]])
    km={x['sku']:x for x in per}
    print(' key:',[(s,km[s]['name'][:18],km[s]['cop128'],km[s]['cop_new'],km[s]['pct']) for s in KEY+NEG128])
    out.append({k:v for k,v in r.items() if k!='per'})
json.dump(out,open('g4_sim_summary.json','w'),indent=1)
with open('g4_sim_per_sku.csv','w',newline='') as fh:
    w=csv.writer(fh); w.writerow(['scenario','sku_id','product_id','product','pack','cop_run128','cop_scenario','pct'])
    for r in S:
        for x in r['per']:
            if abs(x['pct'])>=0.005: w.writerow([r['scenario'][:1],x['sku'],x['product_id'],x['name'],x['pack'],x['cop128'],x['cop_new'],x['pct']])
# step classification summary
C=collections.Counter()
for g in G: C[(rule_prop(g), 'linked' if g['plant'] else 'class-only', g['act'] if rule_prop(g)!=50 else ('Pulverizer section' if g['sec']=='Pulverizer Section' else g['act']))]+=1
print('\nPOH grinder steps by proposed capacity:',sorted(C.items(),key=lambda x:-x[1]))
print('products affected by 8/2 kg:',len({g['p'] for g in G if rule_prop(g)!=50}))
