# Inputs: sim_rates.json = A7F_01 output; A7 evidence CSVs. Output: A7F_PROVISIONAL_REPRODUCTION.csv
import json,csv,collections,statistics as st
sim={x[0]:x for x in json.load(open('sim_rates.json'))}
E='/workspace/sasv-workspace-dev/docs/costing-pipeline-independent-audit/evidence/A7/'
r119={int(float(x['sku_id'])):x for x in csv.DictReader(open(E+'run119_price_chain_extract.csv'))}
S=list(csv.DictReader(open(E+'sheet_price_revision_proposal_509.csv')))
f=lambda v: float(v) if v not in ('',None) else None
out=[]
for s in S:
    k=int(float(s['SKU ID']));sl=f(s['Provisional Loaded Cost (₹/SKU)']);b=r119[k];m=sim.get(k)
    model=None
    if m and m[2] is not None and m[1] is not None:
        model=f(b['loaded'])-(f(b['dl']) or 0)-(f(b['poh']) or 0)+m[2]*float(m[1])*f(b['pack_size'])
    e=(sl-model)/model if model else None
    c='NO_MODEL' if e is None else 'MATCH_0.1%' if abs(e)<=0.001 else 'MATCH_1%' if abs(e)<=0.01 else 'MISMATCH'
    r119off=abs(sl/f(b['loaded'])-1)>0.01
    out.append([k,s['Product'],s['Pack Size'],s['UOM'],round(sl,4),round(f(b['loaded']),4),'' if model is None else round(model,4),'' if e is None else round(e*100,4),c,int(r119off)])
print('all509',collections.Counter(o[8] for o in out))
print('the454',collections.Counter(o[8] for o in out if o[9]))
mis=[o for o in out if o[8] in('MISMATCH','NO_MODEL')]
for o in sorted(mis,key=lambda o:-abs(o[7] or 0))[:15]: print(o)
csv.writer(open('A7F_PROVISIONAL_REPRODUCTION.csv','w')).writerows([['sku_id','product','pack','uom','sheet_loaded','run119_loaded','model_loaded','err_pct','class','run119_off_gt1pct']]+out)
