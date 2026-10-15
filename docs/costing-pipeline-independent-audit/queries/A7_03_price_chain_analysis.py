import csv,json,re,math,collections
def L(f): return list(csv.DictReader(open(f)))
def fl(x):
    try: return float(x)
    except: return None
r119={int(r['sku_id']):r for r in L('run119.csv')}
s=open('/workspace/agent-tools/079d7f9c-6db8-4974-bc1c-ab69daca6303.txt').read()
j=json.loads(s); s=j['result'] if isinstance(j,dict) else s
d=json.loads(re.search(r'\[\{"json_build_object":(.*)\}\]\s*</untrusted',s,re.S).group(1))
sim={x['sku_id']:x for x in d['sku']}; master={x['sku_id']:x for x in d['master']}
a3={int(r['product_id']):r for r in L('../A3_125_OVERCHARGED_PRODUCTS.csv')}
s509=L('sheet_509.csv'); s440=L('sheet_440.csv')
key=lambda p,ps,u:(p.strip().lower(),round(fl(ps) or 0,3),(u or '').strip().lower())
by_key={key(r['Product'],r['Pack Size'],r['UOM']):r for r in s509}
# (a) reconciliation
ids509={int(float(r['SKU ID'])) for r in s509}
m440=[];um440=[]
for r in s440:
    k=key(r['Product'],r['Pack Size'],r['UOM'])
    (m440 if k in by_key else um440).append(r)
ids440={int(float(by_key[key(r['Product'],r['Pack Size'],r['UOM'])]['SKU ID'])) for r in m440}
active={k for k,v in master.items() if v['active'] and not v['sample']}
recon=dict(sheet509=len(s509),sheet509_unique=len(ids509),in_run119=len(ids509&set(r119)),not_in_run119=sorted(ids509-set(r119)),
  not_in_master=sorted(ids509-set(master)),inactive_master=sorted(i for i in ids509 if i in master and not master[i]['active']),
  sheet440=len(s440),s440_matched_to_509=len(m440),s440_unmatched=[r['Product']+' '+r['Pack Size'] for r in um440],
  held_509_minus_440=len(ids509-ids440),run119_not_in_509=len(set(r119)-ids509),active_master_not_in_run119=len(active-set(r119)),
  run119_ready_ok=sum(1 for v in r119.values() if v['pricing_bridge_status_ok']=='READY'))
# chain
def minmrp(comm,g,c): return comm/(0.5*(1-c)/(1+g)-0.07)
def ceil5(x): return math.ceil(x/5-1e-9)*5
POH_SCALE=629880.04/974980.28  # FY25-26 avg / selected (A1-F2) ANALYTICAL
out=[]
for r in s509:
    i=int(float(r['SKU ID'])); v=r119.get(i); g=fl(r['GST (%)'])/100; c=fl(r['Contingency (%)'])/100
    cur=fl(r['Current OK MRP (₹)']); prop=fl(r['Proposed MRP (₹) — exception-screened'])
    sl=fl(r['Provisional Loaded Cost (₹/SKU)']); sm=fl(r['Marketing Cost (₹/SKU)'])
    o=dict(sku_id=i,product=r['Product'],pack=r['Pack Size'],uom=r['UOM'],in440=i in ids440,cur_ok_mrp=cur,proposed=prop,
           sheet_loaded=sl,sheet_mkt=sm,sheet_min=fl(r['Analytical Minimum MRP (₹) — NOT APPROVED']))
    o['recalc_min']=minmrp(sl+sm,g,c); o['recalc_prop']=ceil5(max(cur or 0,o['recalc_min']))
    o['formula_ok']=abs(o['recalc_min']-o['sheet_min'])<0.05 if o['sheet_min'] else None
    o['prop_rule_ok']=(prop==o['recalc_prop']) if prop else None
    if v:
        L119=fl(v['loaded']); M119=fl(v['mkt_ok']) or 0
        o.update(r119_loaded=L119,r119_mkt=M119,r119_mrp_ok=fl(v['mrp_ok']),loaded_diff=sl-L119,mkt_diff=sm-M119)
        dlpoh=fl(v['dl'])+fl(v['poh']); sv=sim.get(i)
        bt=(sv['sim_per_base']*sv['conv']*fl(v['pack_size'])) if sv and sv['sim_per_base'] and sv['conv'] else None
        # scenario deltas to loaded cost (₹/SKU), ANALYTICAL
        o['d_batch']=(bt-dlpoh) if bt is not None else None
        o['d_provision']=fl(v['poh'])*(POH_SCALE-1)
        flag=[]
        if i==879: flag.append('UNIT_FACTOR_20X(A2-F1)')
        if i in (859,1277): flag.append('RM_IMPLAUSIBLE(A2-F2)')
        if v['product_id'] and int(v['product_id']) in a3: flag.append('A3_125_LOWVOL')
        o['flags']=';'.join(flag)
        base=L119+M119  # scenarios on run-119 system basis (sheet loaded is an untraceable provisional layer)
        o['min_r119']=minmrp(base,g,c); o['gap_r119']=(prop-o['min_r119']) if prop else None
        for nm,dd in [('batch',o['d_batch'] or 0),('prov',o['d_provision']),('comb',(o['d_batch'] or 0)+o['d_provision'])]:
            o['min_'+nm]=minmrp(base+dd,g,c); o['gap_'+nm]=(prop-o['min_'+nm]) if prop else None
    out.append(o)
# classification for 440
for o in out:
    if not o['in440']: o['class']='NOT_SUBMITTED(HOLD_69)'; continue
    fl_=o.get('flags',''); gb=o.get('gap_batch'); gc=o.get('gap_comb')
    if 'r119_loaded' not in o: o['class']='HOLD'; o['reason']='not in run119'; continue
    if 'UNIT' in fl_ or 'RM_IMPL' in fl_: o['class']='HOLD'; o['reason']='master-data defect'; continue
    worst=min(x for x in [gb,gc] if x is not None) if (gb is not None) else o['gap_r119']
    sp=-worst/o['proposed']*100 if worst<0 else 0
    high=o['proposed']>o['cur_ok_mrp'] and o['min_comb']<=o['cur_ok_mrp']
    if sp>10: o['class']='HOLD'; o['reason']=f'proposed below corrected min MRP by {sp:.1f}%'
    elif sp>0: o['class']='AT_RISK_LOW'; o['reason']=f'proposed below corrected min MRP by {sp:.1f}%'
    elif high: o['class']='AT_RISK_HIGH'; o['reason']='increase not supported once batch/provision defects corrected (corrected min <= current MRP)'
    elif o['d_batch'] is None or 'A3_125' in fl_: o['class']='AT_RISK_LOW'; o['reason']='no batch simulation / low-volume cost basis to restate'
    else: o['class']='SAFE'; o['reason']='proposed >= corrected min MRP in all scenarios and increase justified'
keys=sorted({k for o in out for k in o},key=lambda k:list(out[0]).index(k) if k in out[0] else 99)
w=csv.DictWriter(open('A7_SKU_PRICE_CHAIN.csv','w'),fieldnames=keys); w.writeheader(); w.writerows(out)
# run119 full-range sensitivity (all 635) at current OK MRP
full=[]
for i,v in r119.items():
    sv=sim.get(i); dlpoh=fl(v['dl'])+fl(v['poh'])
    bt=(sv['sim_per_base']*sv['conv']*fl(v['pack_size'])) if sv and sv['sim_per_base'] and sv['conv'] else None
    db=(bt-dlpoh) if bt is not None else None; dp=fl(v['poh'])*(POH_SCALE-1)
    g=(fl(v['gst_percent']) or 5)/100; c=(fl(v['contingency_percent']) or 2)/100
    comm=(fl(v['loaded']) or 0)+(fl(v['mkt_ok']) or 0)
    full.append(dict(sku_id=i,product=v['product_name'],pack=v['pack_size'],uom=v['pack_uom'],in509=i in ids509,in440=i in ids440,mrp_ok=fl(v['mrp_ok']),loaded=fl(v['loaded']),d_batch=db,d_provision=dp,
      min_mrp_r119=minmrp(comm,g,c),min_mrp_combined=minmrp(comm+(db or 0)+dp,g,c),lowvol125=int(v['product_id'] or 0) in a3))
w=csv.DictWriter(open('A7_FULL_RANGE_SENSITIVITY.csv','w'),fieldnames=full[0].keys()); w.writeheader(); w.writerows(full)
# summary
S=collections.OrderedDict(recon=recon)
S['formula_ok']=collections.Counter(o['formula_ok'] for o in out); S['prop_rule_ok']=collections.Counter(o['prop_rule_ok'] for o in out)
dd=[o for o in out if 'loaded_diff' in o]
S['loaded_diff_abs_gt_1pct']=sum(1 for o in dd if abs(o['loaded_diff'])>0.01*o['r119_loaded'])
S['loaded_diff_sum']=sum(o['loaded_diff'] for o in dd); S['loaded_diff_median']=sorted(o['loaded_diff'] for o in dd)[len(dd)//2]
S['mkt_diff_gt_1pct']=sum(1 for o in dd if abs(o['mkt_diff'])>0.01*max(o['r119_mkt'],0.01))
S['mrp_diff']=sum(1 for o in dd if o['r119_mrp_ok']!=o['cur_ok_mrp'])
S['class440']=collections.Counter(o['class'] for o in out)
S['hold_reasons']=collections.Counter(o.get('reason','').split(' by ')[0] for o in out if o['class']=='HOLD')
S['nobatch_sim']=sum(1 for o in dd if o['d_batch'] is None)
for grp,flt in [('509',lambda x:x['in509']),('440',lambda x:x['in440']),('not_in_sheet',lambda x:not x['in509']),('all635',lambda x:True)]:
    g=[x for x in full if flt(x)]
    S['range_'+grp]=dict(n=len(g),underpriced_at_current_mrp_r119=sum(1 for x in g if x['mrp_ok'] and x['min_mrp_r119']>x['mrp_ok']),
      underpriced_combined=sum(1 for x in g if x['mrp_ok'] and x['min_mrp_combined']>x['mrp_ok']),
      cost_up=sum(1 for x in g if (x['d_batch'] or 0)+x['d_provision']>0),cost_down=sum(1 for x in g if (x['d_batch'] or 0)+x['d_provision']<0))
p=[o for o in out if o['in440'] and 'gap_comb' in o]
S['prop_rule']='proposed = ceil5(max(current OK MRP, analytical min))'
S['440_too_low_comb']=sum(1 for o in p if o['gap_comb']<0); S['440_too_high_comb_vs_current']=sum(1 for o in p if o['proposed']>o['cur_ok_mrp'] and o['min_comb']<=o['cur_ok_mrp'])
S['440_increase_count']=sum(1 for o in p if o['proposed']>o['cur_ok_mrp'])
json.dump(S,open('A7_SUMMARY.json','w'),indent=1,default=str); print(json.dumps(S,indent=1,default=str))
