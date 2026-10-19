import csv,psycopg,collections,json
D='/workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/data/'
C={r['sku_id']:r for r in csv.DictReader(open(D+'seasonality_sku_classification.csv'))}
P5={r['sku_id']:r for r in csv.DictReader(open(D+'seasonality_policy_simulation_per_sku.csv')) if r['policy'].startswith('P5')}
P2={r['sku_id']:r for r in csv.DictReader(open(D+'seasonality_policy_simulation_per_sku.csv')) if r['policy'].startswith('P2')}
c=psycopg.connect('host=/tmp port=54329 user=postgres dbname=dvs_t')
rows=c.execute("""select s.sku_id, p.item, ps.pack_size||' '||ps.uom, b.monthly_allocation_units, s.candidate_max_month, s.candidate_12m_avg, s.diagnostic_top3_share
 from costing.sku_demand_volume_selection_snapshot s join costing.sku_sales_allocation_basis_snapshot b on b.refresh_run_id=128 and b.sku_id=s.sku_id
 join public.product_skus ps on ps.id=s.sku_id join public.products p on p.id=ps.product_id
 where s.refresh_run_id=9130 and s.diagnostic_flag order by s.sku_id""").fetchall()
REASON={'MASTER_SEASONAL':('Product is marked seasonal in the product master','Approve as demand-seasonal: keep the 12-month average'),
 'RECURRING_PATTERN':('The same months peak every year (true seasonal demand)','Approve as demand-seasonal: keep the 12-month average'),
 'BULK_SINGLE_DAY':('The peak month is mostly one large order on a single day (bulk/institutional)','Record the order as a one-off event (exclude it); use the next-highest month'),
 'PROMOTION':('The peak month is driven by free goods / a scheme','Record the scheme as a one-off event (exclude it); use the next-highest month'),
 'SUPPLY_CONSTRAINT':('Out of stock for 10+ days in some months, so the other months are understated','Record the stock-out months; use the average of the in-stock months'),
 'NEW_LAUNCH':('Recently launched; sales are still ramping up','Accept the peak month (the DVS-1 default)'),
 'UNEXPLAINED':('No event, stock-out or pattern found in the data','Accept the peak month (the DVS-1 default)')}
out=[];cnt=collections.Counter()
for sku,item,pack,u128,mx,avg,t3 in rows:
    k=C.get(str(sku),{}); r=k.get('primary_reason') or 'UNEXPLAINED'
    try: fs=float(k.get('free_share_peak') or 0)
    except: fs=0
    if r not in ('MASTER_SEASONAL','RECURRING_PATTERN') and fs>=0.2: r='PROMOTION'
    if r not in REASON: r='UNEXPLAINED'
    cnt[r]+=1
    why,ans=REASON[r]
    mx=float(mx); avg=float(avg); u128=float(u128)
    if r in ('MASTER_SEASONAL','RECURRING_PATTERN'): exp=avg
    elif r in ('BULK_SINGLE_DAY','PROMOTION'):
        md=float(k.get('maxday_line') or 0); exp=max(mx-md, avg) if r=='BULK_SINGLE_DAY' else None
    elif r in ('NEW_LAUNCH','UNEXPLAINED'): exp=mx
    else: exp=None
    p=P5.get(str(sku)) or P2.get(str(sku))
    cop128=float(p['cop128']) if p else None; copn=float(p['cop_policy']) if p else None
    pct=(copn/cop128-1)*100 if p and cop128 else None
    out.append({'sku_id':sku,'product':item,'pack':pack,'current_basis_units_per_month(run128: 12-month average)':round(u128,2),
      'dvs1_default_units_per_month(peak month)':round(mx,2),'change_if_default_pct':round((mx/u128-1)*100,1),
      'top3_months_share':round(float(t3),2),'why_flagged':why,'reason_code':r,'tags_from_data':k.get('tags',''),
      'stockout_months_ge10d':k.get('stockout_months_ge10d',''),'largest_single_day_units':k.get('maxday_line',''),
      'proposed_default_answer':ans,'expected_basis_if_answer_accepted':'' if exp is None else round(exp,2),
      'cop_per_unit_run128':'' if cop128 is None else round(cop128,4),'cop_per_unit_if_dvs1_default':'' if copn is None else round(copn,4),
      'cop_change_pct_if_dvs1_default':'' if pct is None else round(pct,2),
      'user_answer (ACCEPT / SEASONAL / EVENT / STOCKOUT / OVERRIDE n)':'','user_note':''})
out.sort(key=lambda x:(x['reason_code'],-abs(x['cop_change_pct_if_dvs1_default'] or 0)))
w=csv.DictWriter(open('out/DVS1_REVIEW_WORKSHEET_86.csv','w'),fieldnames=list(out[0])); w.writeheader(); w.writerows(out)
top=sorted([o for o in out if o['cop_change_pct_if_dvs1_default']!=''],key=lambda x:-abs(x['cop_change_pct_if_dvs1_default']))[:10]
json.dump({'n':len(out),'by_reason':cnt,'with_cost':sum(1 for o in out if o['cop_change_pct_if_dvs1_default']!=''),'top10':top},open('out/ws86_summary.json','w'),indent=1,default=str)
print(len(out),cnt, sum(1 for o in out if o['cop_change_pct_if_dvs1_default']!=''))
for t in top: print(t['sku_id'],t['product'],t['pack'],t['current_basis_units_per_month(run128: 12-month average)'],t['dvs1_default_units_per_month(peak month)'],t['cop_per_unit_run128'],t['cop_per_unit_if_dvs1_default'],t['cop_change_pct_if_dvs1_default'],t['reason_code'])
