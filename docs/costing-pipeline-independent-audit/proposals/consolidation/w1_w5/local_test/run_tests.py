import psycopg, subprocess, json, sys, hashlib
DSN="host=/tmp port=55439 user=postgres dbname=w1w5"
R=[]  # (id, test, expected, actual, pass)
def rec(i,t,exp,act,ok): R.append((i,t,str(exp),str(act),bool(ok))); print(('PASS' if ok else 'FAIL'),i,t,'| exp',exp,'| got',act, flush=True)
def reset(): subprocess.run(['bash','reset.sh'],check=True)
def apply(f): subprocess.run(['psql','-h','/tmp','-p','55439','-U','postgres','-d','w1w5','-X','-q','-v','ON_ERROR_STOP=1','-f',f],check=True,capture_output=True,text=True)
def conn(): return psycopg.connect(DSN, autocommit=True)
def q(c,s,a=None): return c.execute(s,a).fetchall()
def one(c,s,a=None): return c.execute(s,a).fetchone()[0]
def err(c,s,a=None):
    try:
        with c.transaction(): c.execute(s,a)
        return None
    except Exception as e: return str(e).split('\n')[0]
DEFS="""select 'F '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('costing','public') and p.prokind='f'
 union all select 'V '||n.nspname||'.'||c.relname, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind='v'
 union all select 'T '||n.nspname||'.'||c.relname, md5(string_agg(a.attname||a.atttypid::regtype::text, ',' order by attnum)) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where n.nspname='costing' and c.relkind='r' group by n.nspname, c.relname
 union all select 'K '||conrelid::regclass||'.'||conname, md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace='costing'::regnamespace"""
DATA="""select t, (select md5(string_agg(x::text,'|' order by x::text)) from (select 1) z) from costing.fn_costing_run_scoped_tables() t"""
def defs(c): return dict(q(c,DEFS))
def datahash(c):
    out={}
    for (t,) in q(c,"select * from costing.fn_costing_run_scoped_tables()"):
        out[t]=one(c,f"select count(*)||':'||md5(coalesce(string_agg(x::text,'|' order by x::text),'')) from costing.{t} x where refresh_run_id in (122,128)")
    return out
def drift(c,run): return sorted(r[0] for r in q(c,"select table_name from costing.fn_verify_run_fingerprint(%s) where not matches",(run,)))
FEEDHASH="select md5(string_agg(x::text,'|' order by x::text)) from costing.v_price_revision_feed_approved x"
CLOSE="select costing.rpc_close_cost_period('2026-09-01','tester','Local W5 close test','LOCAL-TEST')"
def clone_run(c, src, dst, period=None, bump=False):
    for (t,) in q(c,"select * from costing.fn_costing_run_scoped_tables()"):
        cols=[r[0] for r in q(c,"select attname from pg_attribute where attrelid=%s::regclass and attnum>0 and not attisdropped and attidentity='' and attgenerated='' order by attnum",(f'costing.{t}',))]
        sel=[]
        for col in cols:
            if col=='refresh_run_id': sel.append(str(dst))
            elif period and col in ('period_start','snapshot_period_start'): sel.append(f"'{period}'::date")
            elif bump and t=='sku_selling_price_bridge_snapshot' and col in ('ik_selling_price','ok_selling_price'): sel.append(f"round({col}*1.10,2)")
            elif bump and t=='cost_sheet_line_monthly_snapshot' and col=='value_numeric': sel.append("value_numeric+1")
            else: sel.append(col)
        c.execute(f"insert into costing.{t}({','.join(cols)}) select {','.join(sel)} from costing.{t} where refresh_run_id={src}")
def new_run(c, rid, period, vdate):
    c.execute("""insert into costing.costing_refresh_run(id,period_start,overall_status,valuation_date,period_status_at_request,valuation_date_status_at_request,valuation_context_source,valuation_context_captured_at,requested_at,started_at)
                 values (%s,%s,'RUNNING',%s,'OPEN','DRAFT','CAPTURED_AT_REQUEST',now(),now(),now())""",(rid,period,vdate))
def finish(c,rid): c.execute("update costing.costing_refresh_run set overall_status='SUCCESS', finished_at=now() where id=%s",(rid,))

# ================= PHASE 1: W1 =================
reset(); c=conn()
base=defs(c)
rec('B1','Fixture definitions equal live (pointer, cost sheet, both comparison views)','live md5s',
    [base['V costing.v_current_successful_costing_refresh_run'][:8],base['V costing.v_sku_detailed_cost_sheet'][:8],base['V costing.v_cost_sheet_snapshot_sku_monthly_comparison'][:8],base['V public.v_cost_sheet_snapshot_sku_monthly_comparison'][:8]],
    [base['V costing.v_current_successful_costing_refresh_run'],base['V costing.v_sku_detailed_cost_sheet'],base['V costing.v_cost_sheet_snapshot_sku_monthly_comparison'],base['V public.v_cost_sheet_snapshot_sku_monthly_comparison']]==['5cc25791985abf5d336fb9311da3d6f1','d20e3c3212c77496a9de29e92fc4036f','7e3254c229aaec04e5467a6886584d60','b20a9206d651ea3361a462fac8b069be'])
old_oct_mixed=one(c,"""select count(*) from costing.v_cost_sheet_snapshot_sku_monthly_comparison o where snapshot_period_start='2026-10-01'""")
apply('pkg/PREPARED_W1_approved_run_feed_and_labels.sql')
rec('W1-0','W1 SQL installs; in-file prechecks/postchecks pass','no error','installed',True)
r=q(c,"select period_start::text, refresh_run_id, count(*), count(*) filter (where ik_negative_margin), count(*) filter (where ok_negative_margin), bool_or(is_latest_approved_period) from costing.v_price_revision_feed_approved group by 1,2 order by 1")
rec('W1-1','Feed: Sep run 122 = 634 SKUs, 74 IK / 70 OK negative','2026-09-01,122,634,74,70,latest=f',r[0],r[0]==('2026-09-01',122,634,74,70,False))
rec('W1-2','Feed: Oct run 128 = 627 SKUs, 9 IK / 9 OK negative, latest approved','2026-10-01,128,627,9,9,latest=t',r[1],r[1]==('2026-10-01',128,627,9,9,True) and len(r)==2)
diff=one(c,"""select count(*) from ((select sku_id,period_start,refresh_run_id,ik_selling_price,ok_selling_price,pricing_cost_per_sku,ik_margin_amount_before_scheme,ok_margin_amount_before_scheme from costing.v_price_revision_feed_approved)
  except (select sku_id,period_start,refresh_run_id,ik_selling_price,ok_selling_price,pricing_cost_per_sku,ik_margin_amount_before_scheme,ok_margin_amount_before_scheme from costing.v_sku_detailed_cost_sheet where refresh_run_id in (122,128))) z""")
rec('W1-3','Feed values identical to the approved runs\' cost sheet (v_sku_detailed_cost_sheet 122/128)',0,diff,diff==0)
st=dict((str(a),b) for a,b in q(c,"select period_start, display_label from costing.v_costing_period_run_status"))
exp={'2026-07-01':'DRAFT run 80 - not approved','2026-08-01':'DRAFT run 82 - not approved','2026-09-01':'Approved run 122','2026-10-01':'Approved run 128'}
rec('W1-4','Status labels per month',exp,{k:st.get(k) for k in exp},all(st.get(k)==v for k,v in exp.items()))
g=q(c,"select snapshot_period_start::text, array_agg(distinct snapshot_refresh_run_id), count(*) from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed group by 1 order by 1")
rec('W1-5','Governed Cost comparison: one run per month (Sep 122 / Oct 128)',"[('2026-09-01',[122],634),('2026-10-01',[128],627)]",g,g==[('2026-09-01',[122],634),('2026-10-01',[128],627)])
gv=one(c,"""with p as (select sku_id, max(value_numeric) filter (where line_label='Selling Price: IK') ik from costing.cost_sheet_line_monthly_snapshot where refresh_run_id=128 group by 1)
  select count(*) from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed g join p using (sku_id) where g.snapshot_period_start='2026-10-01' and g.selling_price_ik is distinct from p.ik""")
mix=one(c,"""select count(*) from costing.v_cost_sheet_snapshot_sku_monthly_comparison o join costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed g using (snapshot_period_start, sku_id)
  where snapshot_period_start='2026-10-01' and row(o.total_material_cost,o.selling_price_ik,o.selling_price_ok,o.internal_loaded_cost,o.profit_value_ik,o.profit_value_ok) is distinct from row(g.total_material_cost,g.selling_price_ik,g.selling_price_ok,g.internal_loaded_cost,g.profit_value_ik,g.profit_value_ok)""")
rec('W1-6','Governed Oct values = run 128 lines exactly (IK selling price)',0,gv,gv==0)
rec('W1-7','Old vs governed comparison for Oct today (runs 127 and 128 hold equal values, so no visible difference yet; see W1-16)','info',mix,True)
oldcols=[r[0] for r in q(c,"select attname from pg_attribute where attrelid='public.v_cost_sheet_snapshot_sku_monthly_comparison'::regclass and attnum>0 order by attnum")]
newcols=[r[0] for r in q(c,"select attname from pg_attribute where attrelid='public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass and attnum>0 order by attnum")]
rec('W1-8','Public governed comparison keeps every old column in order (client compatible) + 7 run columns',f'{len(oldcols)}+7',f'{len(oldcols)}+{len(newcols)-len(oldcols)}',newcols[:len(oldcols)]==oldcols and len(newcols)==len(oldcols)+7)
e1=err(c,"set role anon; select 1 from public.v_costing_pricing_price_revision_feed_approved limit 1")
c.execute("reset role")
e2=err(c,"set role authenticated; select 1 from costing.v_price_revision_feed_approved limit 1"); c.execute("reset role")
c.execute("set role authenticated"); n_auth=one(c,"select count(*) from public.v_costing_pricing_price_revision_feed_approved"); n_st=one(c,"select count(*) from public.v_costing_pricing_period_run_status"); n_cmp=one(c,"select count(*) from public.v_cost_sheet_snapshot_sku_monthly_comparison_governed"); c.execute("reset role")
rec('W1-9','Grants: anon denied; authenticated denied on costing.* but reads public wrappers (permission stub=true)','denied/denied/1261,6,1261',f"{'denied' if e1 else 'ALLOWED'}/{'denied' if e2 else 'ALLOWED'}/{n_auth},{n_st},{n_cmp}",bool(e1) and bool(e2) and (n_auth,n_st,n_cmp)==(1261,6,1261))
after=defs(c)
changed=sorted(k for k in base if after.get(k)!=base[k]); added=sorted(k for k in after if k not in base)
rec('W1-10','No existing function/view/table/constraint changed; only 6 views added','changed=[]; added=6 views',f'changed={changed}; added={added}',changed==[] and added==sorted(['V costing.v_price_revision_feed_approved','V costing.v_costing_period_run_status','V costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed','V public.v_costing_pricing_price_revision_feed_approved','V public.v_costing_pricing_period_run_status','V public.v_cost_sheet_snapshot_sku_monthly_comparison_governed']))
apply('pkg/PREPARED_W1_approved_run_feed_and_labels.sql')
rec('W1-11','W1 SQL re-run is idempotent (no definition change)','same',defs(c)==after,defs(c)==after)
# ---- simulated new draft for a month that already has an approved run
fh0=one(c,FEEDHASH)
e=err(c,"insert into costing.costing_refresh_run(period_start,overall_status,valuation_date,period_status_at_request,valuation_date_status_at_request,valuation_context_source,valuation_context_captured_at) values ('2026-10-01','QUEUED','2026-10-01','LOCKED','FINAL','CAPTURED_AT_REQUEST',now())")
rec('W1-12','New Oct run without authorisation is refused (existing guard)','AU2_PERIOD_HOLDS_APPROVED_RUN',e,e and 'AU2_PERIOD_HOLDS_APPROVED_RUN' in e)
vd=one(c,"select valuation_date::text from costing.costing_refresh_run where id=128")
c.execute("insert into costing.costing_period_refresh_authorization(period_start,authorised_by,reason,valid_until) values ('2026-10-01','Local test','Local W1 simulated draft test',now()+interval '1 hour')")
new_run(c,129,'2026-10-01',vd); clone_run(c,128,129,bump=True)
lbl=one(c,"select display_state||' | '||display_label from costing.v_costing_period_run_status where period_start='2026-10-01'")
c.execute("update costing.costing_refresh_run set overall_status='RUNNING' where id=129")  # still running
lbl_run=one(c,"select active_run_id from costing.v_costing_period_run_status where period_start='2026-10-01'")
finish(c,129)
fh1=one(c,FEEDHASH); ptr=one(c,"select refresh_run_id from costing.v_current_successful_costing_refresh_run where period_start='2026-10-01'")
lbl=one(c,"select display_state||' | '||display_label from costing.v_costing_period_run_status where period_start='2026-10-01'")
g129=one(c,"select array_agg(distinct snapshot_refresh_run_id) from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed where snapshot_period_start='2026-10-01'")
old129=one(c,"""select count(*) from costing.v_cost_sheet_snapshot_sku_monthly_comparison o join costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed g using (snapshot_period_start, sku_id) where snapshot_period_start='2026-10-01' and o.selling_price_ik is distinct from g.selling_price_ik""")
draftp=one(c,"select count(*) from costing.v_sku_detailed_cost_sheet where refresh_run_id=129 and ik_selling_price is not null")
rec('W1-13','Simulated DRAFT run 129 (Oct, +10% prices, 627 SKUs) does not reach the feed','feed hash unchanged; pointer 128',f'draft rows={draftp}; hash same={fh0==fh1}; pointer={ptr}',fh0==fh1 and ptr==128 and draftp>0)
rec('W1-14','Oct label while run 129 is RUNNING shows active run','active_run_id=129',lbl_run,lbl_run==129)
rec('W1-15','Oct label after draft 129 succeeds','APPROVED_NEWER_DRAFT | Approved run 128 (newer DRAFT run 129 - not approved)',lbl,lbl=='APPROVED_NEWER_DRAFT | Approved run 128 (newer DRAFT run 129 - not approved)')
rec('W1-16','Governed Cost comparison stays on run 128; old view picks up draft prices','governed [128]; old view differs',f'governed {g129}; old view differing SKUs={old129}',g129==[128] and old129>0)
# new month with only a draft
c.execute("insert into costing.cost_periods(period_start,status,created_at,updated_at,period_end,valuation_date,valuation_date_source,valuation_date_status,valuation_date_set_at) values ('2026-11-01','OPEN',now(),now(),'2026-11-30','2026-11-01','GOVERNED_MANUAL','DRAFT',now())")
new_run(c,130,'2026-11-01','2026-11-01'); clone_run(c,128,130,period='2026-11-01'); finish(c,130)
nov=one(c,"select count(*) from costing.v_price_revision_feed_approved where period_start='2026-11-01'")
novl=one(c,"select display_state||' | '||display_label||' | latest_appr='||is_latest_approved_period from costing.v_costing_period_run_status where period_start='2026-11-01'")
octl=one(c,"select is_latest_approved_period from costing.v_costing_period_run_status where period_start='2026-10-01'")
novg=one(c,"select min(snapshot_run_label)||' / '||count(*) from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed where snapshot_period_start='2026-11-01'")
rec('W1-17','Simulated Nov DRAFT run 130: not in feed; labelled DRAFT; Oct stays latest approved','0 rows; DRAFT | DRAFT run 130 - not approved; Oct latest=t',f'{nov} rows; {novl}; Oct latest={octl}',nov==0 and novl=='DRAFT | DRAFT run 130 - not approved | latest_appr=false' and octl)
rec('W1-18','Governed Cost comparison labels Nov draft rows','DRAFT run 130 - not approved / 627',novg,novg=='DRAFT run 130 - not approved / 627')
fh2=one(c,FEEDHASH); rec('W1-19','Feed unchanged after both simulated drafts','same hash',fh2==fh0,fh2==fh0)
c.close()

# ================= PHASE 2: W5 =================
reset(); c=conn()
base=defs(c); d0=datahash(c)
rec('W5-0a','Before W5: run 122 drift (live behaviour reproduced)',['sku_sales_allocation_basis_snapshot'],drift(c,122),drift(c,122)==['sku_sales_allocation_basis_snapshot'])
e=err(c,CLOSE); rec('W5-0b','Before W5: closing Sep is refused','AU2_CLOSE_FINGERPRINT_DRIFT',e,e and 'AU2_CLOSE_FINGERPRINT_DRIFT' in e)
apply('pkg/PREPARED_W1_approved_run_feed_and_labels.sql'); mid=defs(c)
apply('pkg/PREPARED_W5_fingerprint_fixed_columns.sql')
rec('W5-1','W5 SQL installs (after W1); in-file prechecks/postchecks pass','no error','installed',True)
rec('W5-2','After W5, before re-baseline: run 128 clean, run 122 still shows only the known drift','128=[]; 122=[sab]',f'128={drift(c,128)}; 122={drift(c,122)}',drift(c,128)==[] and drift(c,122)==['sku_sales_allocation_basis_snapshot'])
same128=one(c,"""select bool_and((n.value->>'md5')=(f.fingerprint->n.key->>'md5') and (n.value->>'rows')=(f.fingerprint->n.key->>'rows')) and count(*)=(select count(*) from jsonb_object_keys((select fingerprint from costing.costing_run_fingerprint where id=11)))
  from jsonb_each(costing.fn_compute_run_fingerprint(128)) n, costing.costing_run_fingerprint f where f.id=11""")
rec('W5-3','New capture method reproduces approved capture 11 (run 128) byte for byte','true',same128,same128)
e=err(c,CLOSE); rec('W5-4','Close Sep still refused before re-baseline','AU2_CLOSE_FINGERPRINT_DRIFT',e,e and 'AU2_CLOSE_FINGERPRINT_DRIFT' in e)
RB="select costing.rpc_rebaseline_run_fingerprint(%s,%s,%s::jsonb,'tester','Local negative test of W5','LOCAL')"
e=err(c,RB,(122,4,'{}')); rec('W5-5','Re-baseline 122 without exclusions refused (values differ)','W5_REBASELINE_REFUSED ... values differ',e[:110] if e else e,e and 'W5_REBASELINE_REFUSED' in e and 'values differ' in e)
e=err(c,RB,(122,11,'{"sku_sales_allocation_basis_snapshot":["monthly_driver_plan_id"]}')); rec('W5-6','Re-baseline 122 against run 128 capture refused','W5_REBASELINE_BAD_REFERENCE',e[:90] if e else e,e and 'BAD_REFERENCE' in e)
e=err(c,RB,(122,4,'{"sku_sales_allocation_basis_snapshot":["no_such_col"]}')); rec('W5-7','Excluding a non-existent column refused','excluded column does not exist',e[:150] if e else e,e and 'does not exist' in e)
e=err(c,RB,(122,4,'{"sku_sales_allocation_basis_snapshot":["sku_id"]}')); rec('W5-8','Excluding a column that holds values refused','non-null values',e[:160] if e else e,e and 'non-null values' in e)
c.execute("insert into costing.costing_run_fingerprint(refresh_run_id,purpose,captured_by,fingerprint) values (127,'CHECK','tester',costing.fn_compute_run_fingerprint(127))")
ref127=one(c,"select max(id) from costing.costing_run_fingerprint where refresh_run_id=127")
c.execute("update costing.sku_selling_price_bridge_snapshot set ik_selling_price=ik_selling_price+1 where id=(select min(id) from costing.sku_selling_price_bridge_snapshot where refresh_run_id=127)")
d127=drift(c,127); e=err(c,RB,(127,ref127,'{}'))
rec('W5-9','Non-designated run 127 with a changed value: drift detected and re-baseline refused','drift [selling bridge]; REFUSED',f'{d127}; {e[:60] if e else e}',d127==['sku_selling_price_bridge_snapshot'] and e and 'REFUSED' in e)
c.execute("set role authenticated"); e=err(c,RB,(122,4,'{"sku_sales_allocation_basis_snapshot":["monthly_driver_plan_id"]}')); c.execute("reset role")
rec('W5-10','authenticated role cannot call the re-baseline function','permission denied',e[:60] if e else e,e and 'permission denied' in e)
n0=one(c,"select count(*) from costing.costing_run_fingerprint")
apply('pkg/PREPARED_W5_rebaseline_runs_122_128.sql')
j=q(c,"select refresh_run_id, reference_fingerprint_id, evidence->>'all_identical', jsonb_array_length(evidence->'tables') from costing.costing_run_fingerprint_rebaseline order by 1")
rec('W5-11','Re-baseline file: 2 journal rows, all tables identical to approved captures 4 and 11','[(122,4,true,6),(128,11,true,6)] (6 local tables; live 50/51)',j,j==[(122,4,'true',6),(128,11,'true',6)])
rec('W5-12','After re-baseline: run 122 and run 128 verify with zero drift','122=[]; 128=[]',f'122={drift(c,122)}; 128={drift(c,128)}',drift(c,122)==[] and drift(c,128)==[])
n1=one(c,"select count(*) from costing.costing_run_fingerprint"); apply('pkg/PREPARED_W5_rebaseline_runs_122_128.sql'); n2=one(c,"select count(*) from costing.costing_run_fingerprint")
rec('W5-13','Re-baseline re-run is idempotent (no extra captures)',f'{n0}->{n0+2}->{n0+2}',f'{n0}->{n1}->{n2}',n1==n0+2 and n2==n1)
apply('pkg/PREPARED_W5_fingerprint_fixed_columns.sql'); rec('W5-14','W5 SQL re-run after re-baseline is idempotent','no error','ok',True)
try:
    with c.transaction():
        res=one(c,CLOSE); st=one(c,"select status||'/'||valuation_date_status from costing.cost_periods where period_start='2026-09-01'")
        raise RuntimeError('rollback')
except RuntimeError: pass
rec('W5-15','Close Sep accepted on approved run 122 after re-baseline (local, rolled back)','CLOSED 2026-09-01 on approved run 122; CLOSED/FINAL',f'{res}; {st}',res=='CLOSED 2026-09-01 on approved run 122' and st=='CLOSED/FINAL')
e=err(c,"update costing.costing_run_fingerprint_rebaseline set reason='tamper tamper'"); e2=err(c,"delete from costing.costing_run_fingerprint_rebaseline")
rec('W5-16','Re-baseline journal is append-only','AU2_APPEND_ONLY x2',f'{bool(e and "AU2_APPEND_ONLY" in e)},{bool(e2 and "AU2_APPEND_ONLY" in e2)}',e and e2 and 'AU2_APPEND_ONLY' in e and 'AU2_APPEND_ONLY' in e2)
# future column addition
new_run(c,131,'2026-08-01','2026-08-01'); clone_run(c,82,131) if one(c,"select count(*) from costing.sku_pricing_bridge_snapshot where refresh_run_id=82")>0 else clone_run(c,128,131,period='2026-08-01'); finish(c,131)
cap131=one(c,"select purpose||':'||(fingerprint->'sku_pricing_bridge_snapshot' ? 'cols')::text from costing.costing_run_fingerprint where refresh_run_id=131 order by id desc limit 1")
c.execute("alter table costing.sku_sales_allocation_basis_snapshot add column w5_test_col numeric")
c.execute("alter table costing.sku_selling_price_bridge_snapshot add column w5_test_col2 text default 'x'")
legacy=one(c,"""select count(*) from costing.fn_costing_run_scoped_tables() t where t in ('sku_sales_allocation_basis_snapshot','sku_selling_price_bridge_snapshot')""")
rec('W5-17','New run 131 success capture records column lists (after-run trigger, unchanged)','RUN_SUCCESS:true',cap131,cap131=='RUN_SUCCESS:true')
rec('W5-18','Add 2 test columns (one with default values): no drift for 122, 128, 131','[] [] []',f'{drift(c,122)} {drift(c,128)} {drift(c,131)}',drift(c,122)==[] and drift(c,128)==[] and drift(c,131)==[])
c.execute("alter table costing.sku_sales_allocation_basis_snapshot drop column w5_test_col"); c.execute("alter table costing.sku_selling_price_bridge_snapshot drop column w5_test_col2")
c.execute("alter table costing.sku_pricing_bridge_snapshot rename column pricing_bridge_status to pbs_renamed") if one(c,"select count(*) from pg_attribute where attrelid='costing.sku_pricing_bridge_snapshot'::regclass and attname='pricing_bridge_status'") else None
dr=drift(c,128); err_txt=one(c,"select current_value->>'error' from costing.fn_verify_run_fingerprint(128) where table_name='sku_pricing_bridge_snapshot'")
rec('W5-19','A removed/renamed hashed column is reported as drift (not an error, not silently ignored)','128 drift [pricing bridge]',f'{dr}; {str(err_txt)[:70]}',dr==['sku_pricing_bridge_snapshot'] and err_txt and 'MISSING' in err_txt)
c.execute("alter table costing.sku_pricing_bridge_snapshot rename column pbs_renamed to pricing_bridge_status")
d1=datahash(c); rec('W5-20','Run 122/128 snapshot data unchanged by W5 + re-baseline (all scoped tables)','identical',d0==d1,d0==d1)
c.close(); reset(); c=conn(); base=defs(c); apply('pkg/PREPARED_W1_approved_run_feed_and_labels.sql'); apply('pkg/PREPARED_W5_fingerprint_fixed_columns.sql'); apply('pkg/PREPARED_W5_rebaseline_runs_122_128.sql'); after=defs(c)
changed=sorted(k for k in base if after.get(k)!=base[k]); added=sorted(k for k in after if k not in base)
expc=['F costing.fn_compute_run_fingerprint(p_refresh_run_id bigint)','F costing.fn_verify_run_fingerprint(p_refresh_run_id bigint)','K costing.costing_run_fingerprint.costing_run_fingerprint_purpose_check']
rec('W5-21','Full install: only the 2 fingerprint functions + purpose check changed','changed='+str(expc),f'changed={changed}',changed==expc)
rec('W5-22','Full install: added objects','6 views + 3 functions + 1 table + its constraints',added,True)
keep=['F costing.rpc_close_cost_period(p_period_start date, p_closed_by text, p_reason text, p_approval_reference text)','F costing.rpc_designate_costing_run(p_refresh_run_id bigint, p_designation text, p_designated_by text, p_reason text)','F costing.fn_after_refresh_run_au2()','F costing.fn_costing_run_scoped_tables()','V costing.v_current_successful_costing_refresh_run']
rec('W5-23','Close / designate / after-run / scope / pointer definitions unchanged','unchanged',all(after[k]==base[k] for k in keep),all(after[k]==base[k] for k in keep))
c.close()
json.dump(R,open('logs/results.json','w'),indent=1)
print('\nTOTAL',len(R),'PASS',sum(r[4] for r in R))
