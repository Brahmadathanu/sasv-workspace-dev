import json,csv,math,re
def load(f):
    t=open(f).read(); j=json.loads(t[t.index('{"result"'):t.rindex('}')+1])['result']
    a=j[j.index('[{'):j.rindex('}]')+2]; v=json.loads(a)[0]; return list(v.values())[0]
rows=load('/workspace/agent-tools/0b59cc08-0610-4e01-b9df-4e0789d5038e.txt')
ok={d['s']:d for d in load('/workspace/agent-tools/6272fd55-3885-4dc1-a934-6aaed03c234d.txt')}
E7='/workspace/sasv-workspace-dev/docs/costing-pipeline-independent-audit/evidence/A7/'
f=lambda x: float(x) if x not in (None,'','nan') else None
s509={int(float(r['SKU ID'])):r for r in csv.DictReader(open(E7+'sheet_price_revision_proposal_509.csv'))}
s440=set()
for r in csv.DictReader(open(E7+'sheet_price_revision_proposal_filtered_440.csv')):
    s440.add((r['Product'].strip().lower(),f(r['Pack Size']),r['UOM'].strip().lower()))
a3=set(int(float(r.get('product_id') or 0)) for r in csv.DictReader(open('/workspace/sasv-workspace-dev/docs/costing-pipeline-independent-audit/A3_125_OVERCHARGED_PRODUCTS.csv')))
neg=set(int(r['sku_id']) for r in csv.DictReader(open('/workspace/au4wt/docs/costing-pipeline-independent-audit/evidence/run121_negative_margin_skus.csv')) if r['first_control_status']!='READY_FOR_COST_REVIEW')
def minmrp(comm,g,c): return comm/(0.5*(1-c)/(1+g)-0.07)
def ceil5(x): return math.ceil(x/5-1e-9)*5
out=[]
for r in rows:
    s=r['sku_id']; o=ok.get(s,{}); g=(r['gst_percent'] or 5)/100; c=(r['contingency_percent'] or 2)/100
    comm=o.get('pok') or ((r['loaded'] or 0)+(r['mkt'] or 0))
    mn=minmrp(comm,g,c); cur=r['mrp_ok']; prop=ceil5(max(cur or 0,mn))
    fl=[]
    if r['allocation_basis_source'] and 'DEFAULT' in r['allocation_basis_source']: fl.append('SLOW_MOVER_DEFAULT_VOLUME(AU-5)')
    if r['product_id'] in a3: fl.append('LOWVOL_BATCH_OVERLOAD(A3,AU-5)')
    if s==879: fl.append('MEHASAMANI_KNOWN_EXCEPTION')
    if s in neg: fl.append('NEG_MARGIN_PRICING_REVIEW')
    if (r['rm_manual_rate_line_count'] or 0)+(r['pm_manual_rate_line_count'] or 0)>0: fl.append('MANUAL_RATE')
    if (r['rm_stale_purchase_rate_line_count'] or 0)+(r['pm_stale_purchase_rate_line_count'] or 0)>0: fl.append('STALE_PURCHASE_RATE')
    if (r['fallback_lines'] or 0)>0: fl.append('STOCK_VALUATION_FALLBACK')
    old=s509.get(s); oldp=f(old['Proposed MRP (₹) — exception-screened']) if old else None
    in440=(r['product_name'].strip().lower(),float(r['pack_size']),r['pack_uom'].strip().lower()) in s440
    rec='SELF_FUNDED' if not fl or fl==['STALE_PURCHASE_RATE'] else 'REVIEW'
    if 'SLOW_MOVER_DEFAULT_VOLUME(AU-5)' in fl or 'LOWVOL_BATCH_OVERLOAD(A3,AU-5)' in fl or 'MEHASAMANI_KNOWN_EXCEPTION' in fl: rec='HOLD_AU5'
    d=dict(version='AU7-run122-v1',run_id=122,valuation_date='2026-09-10',valuation_status='LOCKED',run_designation='APPROVED',
      sku_id=s,product=r['product_name'],pack=r['pack_size'],uom=r['pack_uom'],rm=r['rm'],pm=r['pm'],material=r['mat'],dl=r['dl'],poh=r['poh'],qc=r['qc'],ms=r['ms'],cop=r['cop'],
      loaded=r['loaded'],mkt_ok=o.get('mok'),commercial_ok=comm,gst_pct=r['gst_percent'],contingency_pct=r['contingency_percent'],
      mrp_ik_current=r['mrp_ik'],mrp_ok_current=cur,ok_margin_pct_current=r['ok_margin_pct'],analytical_min_mrp=round(mn,2),proposed_mrp_ok=prop,
      change_pct=round((prop/cur-1)*100,1) if cur else None,
      rate_lineage=f"RM manual {r['rm_manual_rate_line_count']}/review {r['rm_review_rate_line_count']}/stale {r['rm_stale_purchase_rate_line_count']}; PM manual {r['pm_manual_rate_line_count']}/review {r['pm_review_rate_line_count']}/stale {r['pm_stale_purchase_rate_line_count']}; fallback {r['fallback_lines']}; volume basis {r['allocation_basis_source']}",
      mrp_policy_id=r['mrp_policy_id'],selling_policy_id=r['selling_price_policy_id'],control_severity=r['control_severity'],first_control_status=r['first_control_status'],
      flags=';'.join(fl),recommendation=rec,in509=bool(old),in440=in440,old_proposed_mrp=oldp,
      old_loaded=f(old['Provisional Loaded Cost (₹/SKU)']) if old else None,delta_vs_old=(prop-oldp) if oldp else None)
    d['reason_big_move']=''
    if oldp and abs(prop-oldp)>=max(10,0.1*oldp):
        rs=[]
        if s in (859,1038,1277,696,879): rs.append('AU-2c master-data fix')
        if d['old_loaded'] and r['loaded'] and abs(r['loaded']-d['old_loaded'])>0.1*d['old_loaded']: rs.append(f"loaded cost {d['old_loaded']:.2f}->{r['loaded']:.2f} (ledger: interest excluded, fuel normal, repairs; staff/7)")
        if 'SLOW_MOVER_DEFAULT_VOLUME(AU-5)' in fl: rs.append('default-volume overload')
        if 'LOWVOL' in d['flags'] if 'flags' in d else False: pass
        if any('LOWVOL' in x for x in fl): rs.insert(0,'low-volume batch overload (A3; old sheet used provisional batch-corrected cost)')
        d['reason_big_move']='; '.join(rs) or 'cost basis change'
    out.append(d)
keys=list(out[0].keys())
with open('AU7_price_proposal_run122.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=keys); w.writeheader(); w.writerows(out)
ids={d['sku_id'] for d in out}
m=[d for d in out if d['in509']]; dl=[d['delta_vs_old'] for d in m if d['delta_vs_old'] is not None]
S=dict(total=len(out),matched509=len(m),new_vs509=len(out)-len(m),missing_from_run=sorted(set(s509)-ids),in440=sum(d['in440'] for d in out),
 up=sum(1 for d in out if d['change_pct'] and d['change_pct']>0),nochange=sum(1 for d in out if d['change_pct']==0),
 same_as_old=sum(1 for x in dl if x==0),higher=sum(1 for x in dl if x>0),lower=sum(1 for x in dl if x<0),big=sum(1 for d in out if d['reason_big_move']),
 rec={k:sum(1 for d in out if d['recommendation']==k) for k in ('SELF_FUNDED','REVIEW','HOLD_AU5')},
 flags={k:sum(1 for d in out if k in d['flags']) for k in ('SLOW_MOVER','LOWVOL','MEHASAMANI','NEG_MARGIN','MANUAL_RATE','STALE','FALLBACK')},
 nomrp=sum(1 for d in out if not d['mrp_ok_current']))
big=sorted([d for d in out if d['reason_big_move']],key=lambda d:-abs(d['delta_vs_old']))[:8]
S['top_big']=[(d['sku_id'],d['product'],d['pack'],d['uom'],d['old_proposed_mrp'],d['proposed_mrp_ok'],d['reason_big_move'][:60]) for d in big]
json.dump(S,open('AU7_SUMMARY.json','w'),indent=1,default=str); print(json.dumps(S,indent=1,default=str))
import openpyxl
wb=openpyxl.Workbook(); ws=wb.active; ws.title='proposal'; ws.append(keys)
for d in out: ws.append([d[k] for k in keys])
w2=wb.create_sheet('summary')
for k,v in S.items(): w2.append([k,json.dumps(v,default=str)])
wb.save('/workspace/AU7_price_proposal_run122.xlsx')
