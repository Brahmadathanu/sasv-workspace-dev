import json, collections, csv, statistics as st
f=lambda v: float(v) if v not in (None,'') else 0.0
rows={r['sku_id']:r for r in json.load(open('rows.json'))}
cost={x['sku_id']:x for x in json.load(open('cost128.json'))}
so=collections.defaultdict(dict)
for r in json.load(open('stockout.json')): so[r['sku_id']][r['ms']]=r['zero_days']
L=["2025-10-01","2025-11-01","2025-12-01","2026-01-01","2026-02-01","2026-03-01","2026-04-01","2026-05-01","2026-06-01","2026-07-01","2026-08-01","2026-09-01"]
def maxm(r): return max(r['u'])
def avg(r): return sum(r['u'])/12
def ex_bulk(r):
    u=list(r['u']); i=L.index(r['peak_month']); u[i]=max(u[i]-r['maxday_line'],0); return max(u)
def since_launch(r):
    fm=r['first_sale_month']; n=sum(1 for m in L if m>=fm); return sum(r['u'])/max(n,1)
def instock_avg(r):
    z=so.get(r['sku_id'],{}); ms=[i for i,m in enumerate(L) if z.get(m,0)<10]
    if not ms: return avg(r)
    return sum(r['u'][i] for i in ms)/len(ms)
def dvs1(r):
    t=r['tags']
    if not r['in101']: return r['run128_units'],'UNCHANGED'
    if 'NEW_LAUNCH' in t: return since_launch(r),'LAUNCH_AVG_SINCE_FIRST_SALE'
    if 'RECURRING_PATTERN' in t and 'BULK_SINGLE_DAY' not in t: return avg(r),'DEMAND_SEASONAL_12M_AVG'
    if 'BULK_SINGLE_DAY' in t: return ex_bulk(r),'MAX_MONTH_EXCL_BULK_DAY'
    if 'SUPPLY_CONSTRAINT' in t: return instock_avg(r),'AVG_OF_IN_STOCK_MONTHS'
    if 'SPORADIC' in t: return avg(r),'IRREGULAR_12M_AVG'
    return r['run128_units'],'UNEXPLAINED_KEEP_RUN128_REVIEW'
policies={
 'P0_run128': lambda r:(r['run128_units'],'RUN128'),
 'P1_master_flag_only': lambda r:((avg(r),'MASTER_AVG') if r['master_seasonal'] and r['units_12m']>0 and r['run128_source']=='ACTUAL_MONTHLY_MAX' else ((maxm(r),'MAX') if r['in101'] else (r['run128_units'],'UNCHANGED'))),
 'P2_max_month_all': lambda r:((maxm(r),'MAX') if r['in101'] else (r['run128_units'],'UNCHANGED')),
 'P3_DVS1_evidence': dvs1,
 'P4_master_or_recurring_avg': lambda r:((avg(r),'AVG') if (r['in101'] and ('RECURRING_PATTERN' in r['tags'] or r['master_seasonal'])) else ((maxm(r),'MAX') if r['in101'] else (r['run128_units'],'UNCHANGED'))),
}
pools=['dl','poh','qc','ms','adm','fin']
base={p:sum(f(cost[s][p])*rows[s]['run128_units'] for s in rows if s in cost) for p in pools}
neg128=[s for s in rows if s in cost and min(f(cost[s]['mik']),f(cost[s]['mok']))<0]
out=[]; detail=[]
for name,fn in policies.items():
    u={}; meth={}
    for s,r in rows.items():
        u[s],meth[s]=fn(r)
    k={p: base[p]/sum(f(cost[s][p])*u[s] for s in rows if s in cost) for p in pools}
    dc=[]; neg=[]
    for s in rows:
        if s not in cost: continue
        c=cost[s]; d=sum((k[p]-1)*f(c[p]) for p in pools)
        cop=f(c['cop']); dcop=sum((k[p]-1)*f(c[p]) for p in ['dl','poh','qc','ms'])
        dc.append(dcop/cop if cop else 0)
        m=min(f(c['mik']),f(c['mok']))-d
        if m<0: neg.append(s)
        detail.append(dict(policy=name,sku_id=s,method=meth[s],run128_units=rows[s]['run128_units'],policy_units=round(u[s],3),cop128=round(cop,4),cop_policy=round(cop+dcop,4),ilc_delta=round(d,4),min_margin128=round(min(f(c['mik']),f(c['mok'])),4),min_margin_policy=round(m,4)))
    ch=sum(1 for s in rows if abs(u[s]-rows[s]['run128_units'])>1e-9)
    out.append(dict(policy=name,skus_changed=ch,units_total=round(sum(u.values()),1),**{'rate_x_'+p:round(1/k[p],4) for p in ['dl','poh','qc']},cost_x=round(k['dl'],4),
        median_cop_change_pct=round(100*st.median(dc),2),max_cop_change_pct=round(100*max(dc,key=abs),2),neg_margin=len(neg),new_neg=sorted(set(neg)-set(neg128)),cleared_neg=sorted(set(neg128)-set(neg))))
for o in out: print(o)
json.dump(out,open('sim_summary.json','w'))
with open('sim_per_sku.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=list(detail[0].keys())); w.writeheader(); [w.writerow(x) for x in detail if x['policy']!='P0_run128' and (x['run128_units']!=x['policy_units'] or x['policy']=='P3_DVS1_evidence' and x['method']!='UNCHANGED')]
print(collections.Counter(dvs1(r)[1] for r in rows.values() if r['in101']))
print('neg128',len(neg128))

# --- drivers and threshold sensitivity
r=rows[878]; print('878',r['tags'],r['top3_share'],r['top3_share_prev'],r['run128_units'],maxm(r))
contrib=sorted(((f(cost[s]['dl'])*(maxm(rows[s])-rows[s]['run128_units']),s,rows[s]['product'],rows[s]['pack']) for s in rows if rows[s]['in101'] and s in cost),reverse=True)[:8]
tot=sum(f(cost[s]['dl'])*(maxm(rows[s])-rows[s]['run128_units']) for s in rows if rows[s]['in101'] and s in cost)
print('P2 DL workload delta total',round(tot),'top',[(round(a),s,n,p) for a,s,n,p in contrib])
sens=[]
for thr in [0.5,0.6,0.7,0.8]:
    u={}
    for s,r in rows.items():
        if r['run128_source']!='ACTUAL_MONTHLY_MAX': u[s]=r['run128_units']; continue
        u[s]= avg(r) if (r['top3_share'] or 0)>=thr else maxm(r)
    n=sum(1 for s,r in rows.items() if r['run128_source']=='ACTUAL_MONTHLY_MAX' and (r['top3_share'] or 0)>=thr)
    k={p: base[p]/sum(f(cost[s][p])*u[s] for s in rows if s in cost) for p in pools}
    neg=sum(1 for s in rows if s in cost and min(f(cost[s]['mik']),f(cost[s]['mok']))-sum((k[p]-1)*f(cost[s][p]) for p in pools)<0)
    dc=[sum((k[p]-1)*f(cost[s][p]) for p in ['dl','poh','qc','ms'])/f(cost[s]['cop']) for s in rows if s in cost and f(cost[s]['cop'])]
    sens.append(dict(threshold=thr,seasonal_skus=n,dl_cost_x=round(k['dl'],4),poh_cost_x=round(k['poh'],4),qc_cost_x=round(k['qc'],4),median_cop_pct=round(100*st.median(dc),2),neg_margin=neg))
for x in sens: print(x)
json.dump(sens,open('sim_threshold_sensitivity.json','w'))
