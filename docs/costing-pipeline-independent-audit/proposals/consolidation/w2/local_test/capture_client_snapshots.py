# W2 local test harness: governed period lifecycle on the live-faithful fixture (runs 122/127/128).
import json, subprocess, sys, re, hashlib, psycopg
sys.path.insert(0,'/workspace/w1w5')
OWNER='dff17104-c02a-4bca-95b1-e8ddff46a9b6'; EDITOR='00000000-0000-0000-0000-0000000000e1'; VIEWER='00000000-0000-0000-0000-0000000000a1'; NOBODY='00000000-0000-0000-0000-0000000000f0'
SQL='/workspace/w2/PREPARED_W2_governed_period_lifecycle.sql'
R=[]
def rec(i,name,exp,got,ok):
    R.append(dict(id=i,test=name,expected=str(exp),got=str(got),pass_=bool(ok))); print(('PASS' if ok else 'FAIL'),i,name,'|',str(got)[:160])
def conn(): return psycopg.connect("host=/tmp port=55439 user=postgres dbname=w2",autocommit=True)
def q(c,s,p=None): return c.execute(s,p).fetchall()
def one(c,s,p=None): return c.execute(s,p).fetchone()[0]
def as_user(uid, role='authenticated'):
    u=conn(); u.execute(f"set role {role}")
    if uid: u.execute("select set_config('request.jwt.claim.sub', %s, false)",(uid,))
    return u
def err(c,s,p=None):
    try: c.execute(s,p); return None
    except Exception as e: return str(e).split('\n')[0]
def apply(): subprocess.run(['psql','-h','/tmp','-p','55439','-U','postgres','-d','w2','-X','-q','-v','ON_ERROR_STOP=1','-f',SQL],check=True,capture_output=True)
def defs(c):
    d={}
    for n,h in q(c,"""select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('costing','public') and p.prokind in ('f','p')"""): d['F '+n]=h
    for n,h in q(c,"""select c.oid::regclass::text, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind in ('v','m')"""): d['V '+n]=h
    for n,h in q(c,"""select conrelid::regclass||'.'||conname, md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace in ('costing'::regnamespace,'public'::regnamespace)"""): d['C '+n]=h
    for n,h in q(c,"""select tgrelid::regclass||'.'||tgname, md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal"""): d['T '+n]=h
    return d
def scoped_hash(c, runs):
    h=hashlib.md5()
    for (t,) in q(c,"select * from costing.fn_costing_run_scoped_tables() order by 1"):
        h.update(str(one(c,f"select md5(coalesce(string_agg(x::text,'|' order by x::text),'')) from costing.{t} x where refresh_run_id = any(%s)",(runs,))).encode())
    return h.hexdigest()
def feed_hash(c, period):
    return one(c,"select md5(coalesce(string_agg((to_jsonb(f)-'is_latest_approved_period')::text,'|' order by sku_id),'')) from costing.v_price_revision_feed_approved f where period_start=%s",(period,))
def clone_run(c, src, dst, period, vdate, bump=False, block_sku=False):
    for (t,) in q(c,"select * from costing.fn_costing_run_scoped_tables()"):
        cols=[r[0] for r in q(c,"select attname from pg_attribute where attrelid=%s::regclass and attnum>0 and not attisdropped and attidentity='' and attgenerated='' order by attnum",(f'costing.{t}',))]
        sel=[]
        for col in cols:
            if col=='refresh_run_id': sel.append(str(dst))
            elif col in ('period_start','snapshot_period_start'): sel.append(f"'{period}'::date")
            elif col=='valuation_date': sel.append(f"'{vdate}'::date")
            elif bump and t=='sku_selling_price_bridge_snapshot' and col in ('ik_selling_price','ok_selling_price'): sel.append(f"round({col}*1.10,2)")
            elif block_sku and t=='sku_pricing_bridge_snapshot' and col=='pricing_bridge_status': sel.append("case when sku_id=(select min(sku_id) from costing.sku_pricing_bridge_snapshot where refresh_run_id=%s) then 'BLOCKED' else pricing_bridge_status end" % src)
            else: sel.append(col)
        c.execute(f"insert into costing.{t}({','.join(cols)}) select {','.join(sel)} from costing.{t} where refresh_run_id={src}")
def new_run(c, rid, period, vdate):
    c.execute("""insert into costing.costing_refresh_run(id,period_start,overall_status,valuation_date,period_status_at_request,valuation_date_status_at_request,valuation_context_source,valuation_context_captured_at,requested_at,started_at)
                 values (%s,%s,'RUNNING',%s,'OPEN','DRAFT','CAPTURED_AT_REQUEST',now(),now(),now())""",(rid,period,vdate))
def finish(c,rid): c.execute("update costing.costing_refresh_run set overall_status='SUCCESS', finished_at=clock_timestamp() where id=%s",(rid,))
def sim_run(c,rid,period,vdate,src=128,**kw): new_run(c,rid,period,vdate); clone_run(c,src,rid,period,vdate,**kw); finish(c,rid)
def fails(chk): return [x['code'] for x in chk['checks'] if not x['pass']]
R_='Reason recorded for W2 local test'; REF='W2-LOCAL-TEST'
NOV='2026-11-01'


import datetime, decimal
def J(x):
    if isinstance(x,(datetime.date,datetime.datetime)): return x.isoformat()
    if isinstance(x,decimal.Decimal): return float(x)
    return str(x)
subprocess.run(['/workspace/w2/reset.sh'],check=True,capture_output=True); apply()
c=conn(); o=as_user(OWNER); ed=as_user(EDITOR); vw=as_user(VIEWER)
S={}
def snap(name):
    rows=[dict(zip([d.name for d in cur.description],r)) for cur in [c.execute("select * from public.v_costing_pricing_period_run_status where period_start>='2026-09-01' order by period_start")] for r in cur.fetchall()]
    S[name]={'ctx':{n:one(u,"select public.rpc_costing_period_governance_context()") for n,u in [('owner',o),('editor',ed),('viewer',vw)]},'rows':rows}
snap('initial')
one(ed,"select public.rpc_costing_open_next_period(%s,%s,'2026-11-05')",(R_,REF)); VD='2026-11-05'
sim_run(c,140,NOV,VD,block_sku=True); sim_run(c,141,NOV,VD)
snap('nov_open_drafts')
S['preflight_blocked']=one(o,"select public.rpc_costing_preflight_run(140,'APPROVE')")
S['preflight_ok']=one(o,"select public.rpc_costing_preflight_run(141,'APPROVE')")
new_run(c,142,NOV,VD); snap('nov_active_run'); clone_run(c,128,142,NOV,VD); finish(c,142)
one(o,"select public.rpc_costing_approve_run(141,%s,%s)",(R_,REF)); snap('nov_approved')
one(ed,"select public.rpc_costing_lock_period(%s,%s,%s)",(NOV,R_,REF)); snap('nov_locked')
one(ed,"select public.rpc_costing_reopen_period(%s,%s,%s)",(NOV,R_,REF)); snap('nov_reopened')
one(o,"select public.rpc_costing_authorise_supersession(%s,%s,%s)",(NOV,R_,REF)); sim_run(c,144,NOV,VD,bump=True); snap('nov_newer_draft')
S['preflight_supersede']=one(o,"select public.rpc_costing_preflight_run(144,'SUPERSEDE')")
one(o,"select public.rpc_costing_supersede_approved_run(144,%s,%s)",(R_,REF)); snap('nov_superseded')
one(ed,"select public.rpc_costing_lock_period(%s,%s,%s)",(NOV,R_,REF)); one(o,"select public.rpc_costing_close_period(%s,%s,%s)",(NOV,R_,REF)); snap('nov_closed')
json.dump(S,open('/workspace/w2client/scripts/costing-period-governance/w2_local_snapshots.json','w'),indent=1,default=J)
print({k:[ (r['period_start'],r['period_status'],r['display_label']) for r in v['rows'] if str(r['period_start'])=='2026-11-01'] for k,v in S.items() if isinstance(v,dict) and 'rows' in v})
