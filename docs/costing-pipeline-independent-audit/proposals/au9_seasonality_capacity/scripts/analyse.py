import json, math, collections, csv
f=lambda v: float(v) if v not in (None,'') else 0.0
basis={x['sku_id']:x for x in json.load(open('basis.json'))}
cost={x['sku_id']:x for x in json.load(open('cost128.json'))}
mon=collections.defaultdict(dict); 
for r in json.load(open('monthly.json')):
    mon[r['sku_id']][r['month_start']]=r
daily=collections.defaultdict(dict)
for r in json.load(open('daily.json')): daily[r['sku_id']][r['ms']]=r
so=collections.defaultdict(dict)
for r in json.load(open('stockout.json')): so[r['sku_id']][r['ms']]=(r['zero_days'],r['snap_days'])
def months(y0,m0,n):
    out=[]; y,m=y0,m0
    for i in range(n):
        out.append(f"{y:04d}-{m:02d}-01"); m+=1
        if m>12: m=1; y+=1
    return out
L=months(2025,10,12); P=months(2024,10,12)
firsts={}
for s,d in mon.items():
    pos=[k for k,v in d.items() if f(v['u'])>0]
    firsts[s]=min(pos) if pos else None
rows=[]
for s,b in basis.items():
    d=mon.get(s,{})
    u=[max(f(d.get(m,{}).get('u')),0) for m in L]
    up=[max(f(d.get(m,{}).get('u')),0) for m in P]
    bl=[f(d.get(m,{}).get('b')) for m in L]
    tot=sum(u); totp=sum(up)
    top3=sum(sorted(u,reverse=True)[:3]); share=top3/tot if tot>0 else None
    top3p=sum(sorted(up,reverse=True)[:3]); sharep=top3p/totp if totp>0 else None
    stat=share is not None and share>=0.6
    src=b['allocation_basis_source']; meth=b['monthly_driver_method'] or ''
    in101='SEASONAL' in (b['monthly_driver_method'] or '') or 'SEASONAL' in (src or '')
    selling=sum(1 for x in u if x>0)
    idx=sorted(range(12),key=lambda i:-u[i])[:3]
    idxp=sorted(range(12),key=lambda i:-up[i])[:3] if totp>0 else []
    # recurrence: top-3 calendar months overlap with prior year (+-1 month tolerance)
    ov=sum(1 for i in idx if any(abs(i-j) in (0,1,11) for j in idxp))
    peak_m=L[idx[0]]; peak=u[idx[0]]
    dd=daily.get(s,{}).get(peak_m)
    maxline=f(dd['maxline']) if dd else 0; days=dd['days'] if dd else 0
    bulk_share12=maxline/tot if tot>0 else 0
    bulk_share_m=maxline/peak if peak>0 else 0
    free_peak=(peak - f(d.get(peak_m,{}).get('b')))/peak if peak>0 else 0
    free_all=(tot-sum(bl))/tot if tot>0 else 0
    fm=firsts.get(s)
    launch = fm is not None and fm >= '2025-07-01'
    # stockout: zero-stock days in non-peak months >=10 or in month before peak
    zs=so.get(s,{}); zero_total=sum(z for z,_ in zs.values())
    zero_months=sum(1 for m in L if zs.get(m,(0,1))[0]>=10)
    prod=b['product_id']; ms=bool(b['is_seasonal'])
    rows.append(dict(sku_id=s,product_id=prod,product=b['product_name'],pack=f"{b['pack_size']} {b['pack_uom']}",
        master_seasonal=ms, season_profile_id=b['season_profile_id'], in101=in101, units_12m=round(tot,1), units_prev12m=round(totp,1),
        top3_share=round(share,3) if share is not None else None, top3_share_prev=round(sharep,3) if sharep is not None else None,
        selling_months=selling, peak_month=peak_m, peak_units=peak, avg_units=round(tot/12,3),
        recur_overlap=ov, maxday_line=maxline, maxday_share_of_peak=round(bulk_share_m,3), maxday_share_12m=round(bulk_share12,3),
        peak_days=days, free_share_peak=round(free_peak,3), free_share_12m=round(free_all,3), first_sale_month=fm, launch_recent=launch,
        stockout_months_ge10d=zero_months, run128_units=f(b['monthly_allocation_units']), run128_source=src, u=u))
json.dump(rows,open('rows.json','w'))
r101=[r for r in rows if r['in101']]
print('in101',len(r101),'stat recomputed', sum(1 for r in rows if r['top3_share'] is not None and r['top3_share']>=0.6))
print('mismatch', [r['sku_id'] for r in rows if r['in101'] != (r['top3_share'] is not None and r['top3_share']>=0.6 and r['run128_source']!='DEFAULT')][:30])
print(collections.Counter(r['run128_source'] for r in rows))
print('master seasonal SKUs active', sum(r['master_seasonal'] for r in rows), 'in101', sum(r['master_seasonal'] and r['in101'] for r in rows))
