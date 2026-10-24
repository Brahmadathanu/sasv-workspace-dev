import json,psycopg,datetime
L2=json.load(open('/workspace/ci037/live2.json'));L3=json.load(open('/workspace/ci037/live3.json'))
cols=dict(L2['cols']); cols.update({'costing.'+k:v for k,v in L3['cols'].items()})
def dflt(t):
    if 'int' in t or 'numeric' in t or 'double' in t: return 0
    if t.startswith('date'): return datetime.date(2026,10,22)
    if 'timestamp' in t: return datetime.datetime(2026,10,22,tzinfo=datetime.timezone.utc)
    if t=='boolean': return False
    if t=='jsonb': return '{}'
    if t=='uuid': return None
    return 'X'
con=psycopg.connect("host=/tmp port=54337 user=postgres dbname=t",autocommit=True)
def ins(t,**kv):
    names=[];vals=[]
    for c in cols[t]:
        if c['n'] in kv: names.append(c['n']);vals.append(kv[c['n']])
        elif c['nn'] and c['n']!='id': names.append(c['n']);vals.append(dflt(c['t']))
    q=f"insert into {t} ({','.join(chr(34)+n+chr(34) for n in names)}) values ({','.join(['%s']*len(vals))}) returning id"
    return con.execute(q,vals).fetchone()[0]
for c in ['public.categories','public.sub_categories','public.product_groups','public.sub_groups']: pass
cat=ins('public.categories',id=1); sc=ins('public.sub_categories',id=1,category_id=1); pg=ins('public.product_groups',id=1,sub_category_id=1); sg=ins('public.sub_groups',id=1,product_group_id=1)
skus=[(975,30020,0,35649.70,480.92),(45,30,33,11.85,0.23),(51,400,33,131.95,3.89)]
for i,(s,_,_,_,_) in enumerate(skus):
    ins('public.products',id=s,sub_group_id=1); ins('public.product_skus',id=s,product_id=s)
for run,des,mode in [(1,'APPROVED','legacy'),(2,'REVOKED','cols'),(3,None,None)]:
    ins('costing.costing_refresh_run',id=run,period_start=datetime.date(2026,10,1),valuation_date=datetime.date(2026,10,22),overall_status='SUCCESS',valuation_context_source='CAPTURED_AT_REQUEST',finished_at=datetime.datetime(2026,10,22,run,tzinfo=datetime.timezone.utc))
    for s,mrp,disc,ilc,mkt in skus:
        basic=mrp/1.05; sell=basic*(1-disc/100); cont=sell*0.02
        pol=con.execute("insert into costing.sku_selling_price_policy(sku_id,contingency_percent,is_active,effective_from) values (%s,2,true,'2026-09-01') returning id",(s,)).fetchone()[0]
        pb=ins('costing.sku_pricing_bridge_snapshot',refresh_run_id=run,period_start=datetime.date(2026,10,1),sku_id=s,product_id=s,mrp_ik=mrp,mrp_ok=mrp,internal_loaded_cost_per_sku=ilc,marketing_expense_cost_per_sku_ik=mkt,marketing_expense_cost_per_sku_ok=mkt,ik_margin_amount_before_scheme=mrp-ilc-mkt,ok_margin_amount_before_scheme=mrp-ilc-mkt,pricing_bridge_status='READY',pricing_bridge_status_ik='READY',pricing_bridge_status_ok='READY')
        ins('costing.sku_selling_price_bridge_snapshot',selling_price_policy_id=pol,refresh_run_id=run,period_start=datetime.date(2026,10,1),sku_id=s,product_id=s,pricing_bridge_snapshot_id=pb,gst_percent=5,ik_basic_price=basic,ok_basic_price=basic,ik_discount_percent=disc,ok_discount_percent=disc,ik_selling_price=sell,ok_selling_price=sell,contingency_percent=2,ik_contingency_value=cont,ok_contingency_value=cont,selling_price_bridge_status='READY',selling_price_bridge_status_ik='READY',selling_price_bridge_status_ok='READY')
        ins('costing.sku_internal_loaded_cost_snapshot',refresh_run_id=run,period_start=datetime.date(2026,10,1),sku_id=s,product_id=s,internal_loaded_cost_per_sku=ilc,internal_loaded_cost_status='READY')
        ins('costing.sku_manufacturing_cop_snapshot',refresh_run_id=run,period_start=datetime.date(2026,10,1),sku_id=s,product_id=s)
        for r in ('IK','OK'):
            fq=1 if (s==51 and r=='OK') else 0; pq=5 if fq else 1
            ins('costing.sku_selected_scheme_policy_context_snapshot',refresh_run_id=run,period_start=datetime.date(2026,10,1),sku_id=s,product_id=s,region_code=r,paid_qty=pq,free_qty=fq,total_qty=pq+fq,resolution_status='DEFAULT_NO_SCHEME')
    if des:
        if mode=='legacy':
            fpj=con.execute("select costing.fn_compute_run_fingerprint(%s) - 'x'",(run,)).fetchone()[0]
            fpj={k:{kk:vv for kk,vv in v.items() if kk!='cols'} for k,v in fpj.items()}  # legacy capture: no column list (like run 119)
        else:
            fpj=con.execute("select costing.fn_compute_run_fingerprint(%s)",(run,)).fetchone()[0]
        fid=ins('costing.costing_run_fingerprint',refresh_run_id=run,purpose='TEST',captured_by='t',fingerprint=json.dumps(fpj))
        ins('costing.costing_run_designation',refresh_run_id=run,period_start=datetime.date(2026,10,1),designation=des,designated_by='t',reason='t',fingerprint_id=fid,designated_at=datetime.datetime(2026,10,22,run,tzinfo=datetime.timezone.utc))
print('seeded')
