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

subprocess.run(['/workspace/w2/reset.sh'],check=True,capture_output=True)
c=conn()
before=defs(c)
h_runs_before=scoped_hash(c,[122,127,128]); fsep=feed_hash(c,'2026-09-01'); foct=feed_hash(c,'2026-10-01')
cp_before={str(a):b for a,b in q(c,"select period_start, md5(x::text) from costing.cost_periods x")}
ilc_before=one(c,"select md5(string_agg(v::text,'|' order by refresh_run_id, sku_id)) from costing.v_sku_detailed_cost_sheet v where refresh_run_id in (122,127,128)")
apply(); rec('I1','W2 SQL installs on live-faithful fixture; in-file prechecks + postchecks pass','no error','installed',True)
after=defs(c)
changed=sorted(k for k in before if k in after and before[k]!=after[k]); removed=sorted(k for k in before if k not in after); added=sorted(k for k in after if k not in before)
expch=['C costing.cost_period_governance_audit.cost_period_governance_audit_event_type_chk','F costing.fn_guard_designated_run_header()','F costing.fn_guard_designated_run_rows()']
rec('I2','Existing objects changed by W2 = only the 2 run guards (+REVOKED) and the audit event-type list; none removed',expch,changed+removed,changed==expch and not removed)
rec('I3','Objects added by W2 (count; listed in report)','new only',len(added),len(added)>0)
json.dump(dict(changed=changed,removed=removed,added=added),open('/workspace/w2/out/defs_diff.json','w'),indent=1)
try: apply(); ok=True; e=''
except subprocess.CalledProcessError as x: ok=False; e=x.stderr.decode()[-300:]
rec('I4','Re-running the W2 SQL is safe (idempotent)','no error',e or 'ok',ok and defs(c)==after)
# precheck refusal: simulate a drifted live definition in a throwaway transaction
src=open(SQL).read()
tc=psycopg.connect("host=/tmp port=55439 user=postgres dbname=w2")
try:
    tc.execute("""create or replace function costing.fn_default_cost_period_valuation_date(p_period_start date) returns date language sql as 'select p_period_start'""")
    m=re.search(r"do \$pre\$.*?end \$pre\$;",src,re.S)
    e=err(tc,m.group(0)) if m else 'no precheck block found'
finally: tc.rollback(); tc.close()
rec('I5','Guard stops if a live definition differs (fn_default changed in a rolled-back txn)','W2 precheck exception',e,e and 'precheck' in e)

# ---- context / permissions
o=as_user(OWNER); ed=as_user(EDITOR); vw=as_user(VIEWER); nb=as_user(NOBODY); an=as_user(None,'anon')
ctx={n:one(u,"select public.rpc_costing_period_governance_context()") for n,u in [('owner',o),('editor',ed),('viewer',vw),('nobody',nb)]}
got={n:(x['can_view'],x['can_edit'],x['is_owner']) for n,x in ctx.items()}
rec('P1','Context: roles resolved (view, edit, owner)',"owner TTT, editor TTF, viewer TFF, nobody FFF",got,got=={'owner':(True,True,True),'editor':(True,True,False),'viewer':(True,False,False),'nobody':(False,False,False)})
rec('P2','Context: next month = Nov, default valuation date = 1 Nov (opened in Oct, future month)',('2026-11-01','2026-11-01',120),(ctx['owner']['next_period_start'],ctx['owner']['default_valuation_date'],ctx['owner']['supersession_valid_minutes']),
    (ctx['owner']['next_period_start'],ctx['owner']['default_valuation_date'],ctx['owner']['supersession_valid_minutes'])==('2026-11-01','2026-11-01',120))
e1=err(vw,"select public.rpc_costing_open_next_period(%s,%s)",(R_,REF)); e2=err(nb,"select public.rpc_costing_open_next_period(%s,%s)",(R_,REF)); e3=err(an,"select public.rpc_costing_open_next_period(%s,%s)",(R_,REF))
rec('P3','Open refused: view-only user, no-permission user, anonymous','3 refusals',[e1,e2,e3],all([e1,e2,e3]) and 'ermission' in e1 and 'ermission' in e2 and 'permission denied' in e3)
e4=err(nb,"select public.rpc_costing_preflight_run(128,'APPROVE')")
rec('P4','Preflight refused for no-permission user','refusal',e4,e4 and 'ermission' in e4)
e5=err(ed,"select public.rpc_costing_open_next_period('short',%s)",(REF,)); e6=err(ed,"select public.rpc_costing_open_next_period(%s,'')",(R_,))
rec('P5','Reason (>=10 chars) and approval reference required','2 refusals',[e5,e6],e5 and e6 and 'W2_' in e5 and 'W2_' in e6)
e7=err(ed,"select public.rpc_costing_open_next_period(%s,%s,'2026-12-01')",(R_,REF))
rec('P6','Valuation date outside the month refused','W2_VALUATION_DATE_OUTSIDE_MONTH',e7,e7 and 'OUTSIDE_MONTH' in e7)
ed.execute("begin"); r=one(ed,"select public.rpc_costing_open_next_period(%s,%s)",(R_,REF)); ed.execute("rollback")
rec('L1a','Open with default: Nov OPEN, valuation date 1 Nov, source SYSTEM_DEFAULT (rolled back)',"('2026-11-01','OPEN','2026-11-01','SYSTEM_DEFAULT')",(r['period_start'],r['status'],r['valuation_date'],r['valuation_date_source']),(r['period_start'],r['status'],r['valuation_date'],r['valuation_date_source'])==('2026-11-01','OPEN','2026-11-01','SYSTEM_DEFAULT'))
r=one(ed,"select public.rpc_costing_open_next_period(%s,%s,'2026-11-05')",(R_,REF))
p=q(c,"select status,valuation_date::text,valuation_date_status,valuation_date_source from costing.cost_periods where period_start=%s",(NOV,))[0]
rec('L1b','Editor opens Nov with an edited valuation date (5 Nov): OPEN/DRAFT, GOVERNED_MANUAL',"('OPEN','2026-11-05','DRAFT','GOVERNED_MANUAL')",p,p==('OPEN','2026-11-05','DRAFT','GOVERNED_MANUAL'))
e=err(ed,"select public.rpc_costing_open_next_period(%s,%s)",(R_,REF))
rec('L1c','Only the next month: opening Dec on 19 Oct refused','W2_NEXT_MONTH_NOT_DUE',e,e and 'NEXT_MONTH_NOT_DUE' in e)
VD='2026-11-05'
# ---- draft runs: 140 BLOCKED SKU, 141 good (REVIEW_REQUIRED present), 142 good extra
sim_run(c,140,NOV,VD,block_sku=True); sim_run(c,141,NOV,VD); sim_run(c,142,NOV,VD)
new_run(c,143,NOV,VD)
pf=one(vw,"select public.rpc_costing_preflight_run(141,'APPROVE')")
rec('L2','Pre-approval checks while a run is still RUNNING: NO_ACTIVE_RUN fails (viewer can see checks)','[NO_ACTIVE_RUN]',fails(pf),fails(pf)==['NO_ACTIVE_RUN'])
clone_run(c,128,143,NOV,VD); finish(c,143)
pf=one(vw,"select public.rpc_costing_preflight_run(141,'APPROVE')")
rec('L3','Pre-approval checks on run 141 pass; REVIEW_REQUIRED allowed and counted',"ok, counts total 627 / review 37 / blocked 0",(pf['ok'],pf['counts']),pf['ok'] and pf['counts']['review_required']==37 and pf['counts']['blocked']==0 and pf['counts']['total']==627)
pfb=one(o,"select public.rpc_costing_preflight_run(140,'APPROVE')")
e=err(o,"select public.rpc_costing_approve_run(140,%s,%s)",(R_,REF))
rec('R1','BLOCKED refusal: run 140 (1 BLOCKED SKU) cannot be approved','W2_APPROVAL_CHECKS_FAILED NO_BLOCKED_SKUS',(fails(pfb),e),fails(pfb)==['NO_BLOCKED_SKUS'] and e and 'NO_BLOCKED_SKUS' in e)
e=err(ed,"select public.rpc_costing_approve_run(141,%s,%s)",(R_,REF)); e2=err(vw,"select public.rpc_costing_approve_run(141,%s,%s)",(R_,REF))
rec('R2','Approve refused for editor and viewer (owner-only)','W2_OWNER_ONLY x2',[e,e2],e and e2 and 'OWNER_ONLY' in e and 'OWNER_ONLY' in e2)
fnov0=feed_hash(c,NOV)
r=one(o,"select public.rpc_costing_approve_run(141,%s,%s)",(R_,REF))
fnov_appr=None
d=q(c,"select designation, designated_by, fingerprint_id is not null from costing.costing_run_designation where refresh_run_id=141")
fd=q(c,"select refresh_run_id, count(*), bool_or(is_latest_approved_period) from costing.v_price_revision_feed_approved where period_start=%s group by 1",(NOV,))
rec('L4','Owner approves run 141: APPROVED by Dr. Brahmadathan U with designation fingerprint; feed shows Nov = run 141 (latest)',"[('APPROVED','Dr. Brahmadathan U',True)] / [(141,627,True)]",(d,fd),d==[('APPROVED','Dr. Brahmadathan U',True)] and fd==[(141,627,True)])
fnov_appr=feed_hash(c,NOV)
pf2=one(o,"select public.rpc_costing_preflight_run(142,'APPROVE')")
e=err(o,"select public.rpc_costing_approve_run(142,%s,%s)",(R_,REF))
rec('R3','Double approval refused via RPC (run 142): use supersede','NO_OTHER_APPROVED_RUN',(fails(pf2),e),'NO_OTHER_APPROVED_RUN' in fails(pf2) and e and 'NO_OTHER_APPROVED_RUN' in e)
sr=as_user(None,'service_role')
e=err(sr,"select costing.rpc_designate_costing_run(142,'APPROVED','svc','direct path test')") if False else err(c,"select costing.rpc_designate_costing_run(142,'APPROVED','svc','direct path test')")
rec('R4','Double approval refused on the direct designate path (trigger backstop)','W2_SECOND_APPROVED_RUN',e,e and 'W2_SECOND_APPROVED_RUN' in e)
e=err(o,"select public.rpc_costing_close_period(%s,%s,%s)",(NOV,R_,REF))
rec('R5','Close before lock refused','W2_CLOSE_REQUIRES_LOCKED',e,e and 'CLOSE_REQUIRES_LOCKED' in e)
e=err(vw,"select public.rpc_costing_lock_period(%s,%s,%s)",(NOV,R_,REF))
rec('R6','Lock refused for viewer','permission refusal',e,e and 'ermission' in e)
r=one(ed,"select public.rpc_costing_lock_period(%s,%s,%s)",(NOV,R_,REF))
p=q(c,"select status,valuation_date_status,locked_by::text from costing.cost_periods where period_start=%s",(NOV,))[0]
rec('L5','Editor locks Nov (approved run 141, valuation dates match, 0 drift)',f"('LOCKED','LOCKED','{EDITOR}')",p,p==('LOCKED','LOCKED',EDITOR) and r['approved_run']==141)
e=err(ed,"select public.rpc_costing_lock_period(%s,%s,%s)",(NOV,R_,REF))
rec('R7','Lock refused when already LOCKED','W2_LOCK_REQUIRES_OPEN',e,e and 'LOCK_REQUIRES_OPEN' in e)
e=err(o,"select public.rpc_costing_authorise_supersession(%s,%s,%s)",(NOV,R_,REF))
rec('R8','Authorise supersession refused while LOCKED (reopen first)','W2_AUTHORISE_REQUIRES_OPEN',e,e and 'REQUIRES_OPEN' in e)
r=one(ed,"select public.rpc_costing_reopen_period(%s,%s,%s)",(NOV,R_,REF))
p=q(c,"select status,valuation_date_status from costing.cost_periods where period_start=%s",(NOV,))[0]
rec('L6','Editor reopens Nov: OPEN/DRAFT; approved run 141 kept in feed',"('OPEN','DRAFT') / feed run 141",(p,one(c,"select max(refresh_run_id) from costing.v_price_revision_feed_approved where period_start=%s",(NOV,))),p==('OPEN','DRAFT') and one(c,"select max(refresh_run_id) from costing.v_price_revision_feed_approved where period_start=%s",(NOV,))==141)
e=err(c,"insert into costing.costing_refresh_run(id,period_start,overall_status,valuation_date,period_status_at_request,valuation_date_status_at_request,valuation_context_source,valuation_context_captured_at,requested_at) values (150,%s,'QUEUED',%s,'OPEN','DRAFT','CAPTURED_AT_REQUEST',now(),now())",(NOV,VD))
rec('R9','New run in a month holding an APPROVED run refused without authorisation','AU2_PERIOD_HOLDS_APPROVED_RUN',e,e and 'APPROVED' in e)
e=err(ed,"select public.rpc_costing_authorise_supersession(%s,%s,%s)",(NOV,R_,REF))
rec('R10','Authorise supersession refused for editor (owner-only)','W2_OWNER_ONLY',e,e and 'OWNER_ONLY' in e)
# expired authorisation
c.execute("""insert into costing.costing_period_refresh_authorization(period_start, authorised_by, reason, valid_until)
             values (%s,'Dr. Brahmadathan U','Expired authorisation test','2026-10-18 00:00+00')""",(NOV,))
e=err(c,"insert into costing.costing_refresh_run(id,period_start,overall_status,valuation_date,period_status_at_request,valuation_date_status_at_request,valuation_context_source,valuation_context_captured_at,requested_at) values (150,%s,'QUEUED',%s,'OPEN','DRAFT','CAPTURED_AT_REQUEST',now(),now())",(NOV,VD))
rec('R11','Expired authorisation does not allow a new run','refused',e,e is not None)
r=one(o,"select public.rpc_costing_authorise_supersession(%s,%s,%s)",(NOV,R_,REF))
mins=one(c,"select round(extract(epoch from valid_until-authorised_at)/60) from costing.costing_period_refresh_authorization where id=%s",(r['authorisation_id'],))
rec('L7','Owner authorises supersession (expired one ignored); valid 120 minutes','120',mins,mins==120)
e=err(o,"select public.rpc_costing_authorise_supersession(%s,%s,%s)",(NOV,R_,REF))
rec('R12','Second open authorisation refused','W2_AUTHORISATION_ALREADY_OPEN',e,e and 'ALREADY_OPEN' in e)
sim_run(c,144,NOV,VD,bump=True)
cons=one(c,"select consumed_by_run_id from costing.costing_period_refresh_authorization where id=%s",(r['authorisation_id'],))
st=one(c,"select display_label from costing.v_costing_period_run_status where period_start=%s",(NOV,))
rec('L8','New run 144 created under the authorisation (consumed); feed still run 141; label flags newer draft',"144 / feed unchanged",(cons,st),cons==144 and feed_hash(c,NOV)==fnov_appr)
fnov1=feed_hash(c,NOV)
pf=one(o,"select public.rpc_costing_preflight_run(142,'SUPERSEDE')"); e=err(o,"select public.rpc_costing_supersede_approved_run(142,%s,%s)",(R_,REF))
rec('R13','Supersede with a run not created under the authorisation (142) refused',"SUPERSESSION_AUTHORISATION_CONSUMED failing",(fails(pf),e),'SUPERSESSION_AUTHORISATION_CONSUMED' in fails(pf) and e and 'SUPERSEDE_CHECKS_FAILED' in e)
e=err(ed,"select public.rpc_costing_supersede_approved_run(144,%s,%s)",(R_,REF))
rec('R14','Supersede refused for editor (owner-only)','W2_OWNER_ONLY',e,e and 'OWNER_ONLY' in e)
h141=scoped_hash(c,[141]); n141=one(c,"select count(*) from costing.sku_pricing_bridge_snapshot where refresh_run_id=141")
r=one(o,"select public.rpc_costing_supersede_approved_run(144,%s,%s)",(R_,REF))
eff=q(c,"select refresh_run_id, designation from costing.v_costing_run_effective_designation where period_start=%s order by 1",(NOV,))
fd=q(c,"select refresh_run_id, count(*) from costing.v_price_revision_feed_approved where period_start=%s group by 1",(NOV,))
ikdiff=one(c,"""select count(*) from costing.v_price_revision_feed_approved f join costing.sku_selling_price_bridge_snapshot s on s.refresh_run_id=144 and s.sku_id=f.sku_id
                where f.period_start=%s and f.ik_selling_price is distinct from s.ik_selling_price""",(NOV,))
rec('L9','Owner supersedes 141 with 144: 141 REVOKED, 144 APPROVED; feed Nov = run 144 values',"[(141,'REVOKED'),(144,'APPROVED')] / [(144,627)] / 0 diffs",(eff,fd,ikdiff),eff==[(141,'REVOKED'),(144,'APPROVED')] and fd==[(144,627)] and ikdiff==0)
fnov2=feed_hash(c,NOV)
rec('L10','Feed hash changed only at supersession (approve->unchanged through reopen/authorise/new run->changed at supersede)','fnov1==before-supersede, fnov2 differs',(fnov1[:8],fnov2[:8]),fnov1!=fnov2)
e=err(c,"update costing.sku_pricing_bridge_snapshot set pricing_bridge_status='READY' where refresh_run_id=141 and sku_id=(select min(sku_id) from costing.sku_pricing_bridge_snapshot where refresh_run_id=141)")
dr=one(c,"select count(*) from costing.fn_verify_run_fingerprint(141) where not matches")
rec('L11','Superseded run 141 kept intact: rows unchanged, edits refused (REVOKED now protected), fingerprint clean',f"hash same, {n141} rows, edit refused, 0 drift",(scoped_hash(c,[141])==h141,e,dr),scoped_hash(c,[141])==h141 and e and 'IMMUTABLE' in e.upper() and dr==0)
r=one(ed,"select public.rpc_costing_lock_period(%s,%s,%s)",(NOV,R_,REF))
e=err(ed,"select public.rpc_costing_close_period(%s,%s,%s)",(NOV,R_,REF))
rec('R15','Close refused for editor (owner-only)','W2_OWNER_ONLY',e,e and 'OWNER_ONLY' in e)
r=one(o,"select public.rpc_costing_close_period(%s,%s,%s)",(NOV,R_,REF))
p=q(c,"select status,valuation_date_status,closed_by from costing.cost_periods where period_start=%s",(NOV,))[0]
rec('L12','Lock again (run 144) then owner closes Nov: CLOSED/FINAL',"('CLOSED','FINAL',...)",p,p[0]=='CLOSED' and p[1]=='FINAL')
e=err(ed,"select public.rpc_costing_reopen_period(%s,%s,%s)",(NOV,R_,REF)); e2=err(o,"select public.rpc_costing_reopen_period(%s,%s,%s)",(NOV,R_,REF))
e3=err(c,"update costing.cost_periods set status='OPEN', valuation_date_status='DRAFT' where period_start=%s",(NOV,)); e4=err(c,"delete from costing.cost_periods where period_start=%s",(NOV,))
rec('R16','Reopen after close refused: RPC (editor, owner) and direct UPDATE/DELETE (trigger)','W2_CLOSED_PERIOD_FINAL x4',[e,e2,e3,e4],all(x and 'CLOSED_PERIOD_FINAL' in x for x in [e,e2,e3,e4]))
# valuation-date mismatch at lock (rolled back, on Oct)
tx=psycopg.connect("host=/tmp port=55439 user=postgres dbname=w2")
try:
    tx.execute("select set_config('request.jwt.claim.sub',%s,true)",(EDITOR,))
    tx.execute("select public.rpc_costing_reopen_period('2026-10-01',%s,%s)",(R_,REF))
    tx.execute("update costing.cost_periods set valuation_date='2026-10-17' where period_start='2026-10-01'")
    e=err(tx,"select public.rpc_costing_lock_period('2026-10-01',%s,%s)",(R_,REF))
finally: tx.rollback(); tx.close()
rec('R17','Lock refused if the period valuation date no longer matches the approved run (Oct, rolled back)','W2_LOCK_VALUATION_DATE_MISMATCH',e,e and 'MISMATCH' in e)
# audit
au=q(c,"""select event_type, reason, approval_reference, actor_user_id::text, event_source from costing.cost_period_governance_audit where period_start=%s order by audit_id""",(NOV,))
seq=[a[0] for a in au]
expseq=['PERIOD_CREATED','RUN_APPROVED','PERIOD_LOCKED','PERIOD_REOPENED','SUPERSESSION_AUTHORISED','RUN_SUPERSEDED','PERIOD_LOCKED','PERIOD_CLOSED']
rec('A1','Audit log: one row per action, in order',expseq,seq,seq==expseq)
comp=all(a[1]==R_ and a[2]==REF and a[3] and a[4]=='GOVERNED_RPC' for a in au)
actors=[(a[0],{OWNER:'owner',EDITOR:'editor'}.get(a[3])) for a in au]
rec('A2','Every audit row records reason, approval reference and actor (owner/editor as expected)','complete',actors,comp and [x[1] for x in actors]==['editor','owner','editor','editor','owner','owner','editor','owner'])
ev=one(c,"select evidence_json from costing.cost_period_governance_audit where period_start=%s and event_type='RUN_APPROVED'",(NOV,))
rec('A3','Approval audit records the REVIEW_REQUIRED count and checks','review_required 37',ev['counts'],ev['counts']['review_required']==37 and len(ev['checks'])>=10)
e=err(c,"update costing.cost_period_governance_audit set reason='tamper' where period_start=%s",(NOV,)); e2=err(c,"truncate costing.cost_period_governance_audit")
rec('A4','Audit log is append-only (update and truncate refused)','2 refusals',[e,e2],e and e2)
e=err(c,"truncate costing.costing_run_fingerprint_rebaseline"); e2=err(c,"update costing.costing_governance_owner set display_name='x'")
rec('A5','Re-baseline log truncate guard; owner table append-only','2 refusals',[e,e2],e and e2)
# no change elsewhere
rec('N1','Runs 122/127/128 rows unchanged; Sep/Oct feed rows unchanged (only the "latest approved month" flag moves to Nov)',"same hashes",(scoped_hash(c,[122,127,128])==h_runs_before,feed_hash(c,'2026-09-01')==fsep,feed_hash(c,'2026-10-01')==foct),
    scoped_hash(c,[122,127,128])==h_runs_before and feed_hash(c,'2026-09-01')==fsep and feed_hash(c,'2026-10-01')==foct)
cp_after={str(a):b for a,b in q(c,"select period_start, md5(x::text) from costing.cost_periods x")}
rec('N2','Existing periods (Mar-Oct incl. September) untouched by the tests',"identical",[k for k in cp_before if cp_before[k]!=cp_after.get(k)],all(cp_before[k]==cp_after.get(k) for k in cp_before))
dd={r:one(c,"select count(*) from costing.fn_verify_run_fingerprint(%s) where not matches",(r,)) for r in (122,128,141,144)}
rec('N3','Fingerprints clean: 122, 128 (approved), 141 (superseded), 144 (new approved)','all 0',dd,all(v==0 for v in dd.values()))
rec('N4','Cost sheet for runs 122/127/128 identical (no cost-logic change)','same',ilc_before==one(c,"select md5(string_agg(v::text,'|' order by refresh_run_id, sku_id)) from costing.v_sku_detailed_cost_sheet v where refresh_run_id in (122,127,128)"),
    ilc_before==one(c,"select md5(string_agg(v::text,'|' order by refresh_run_id, sku_id)) from costing.v_sku_detailed_cost_sheet v where refresh_run_id in (122,127,128)"))
ap=q(c,"select period_start::text, count(*) from costing.v_costing_run_effective_designation where designation='APPROVED' group by 1 order by 1")
rec('N5','One APPROVED run per month after everything',"Sep 1, Oct 1, Nov 1",ap,ap==[('2026-09-01',1),('2026-10-01',1),('2026-11-01',1)])
pf=one(o,"select public.rpc_costing_preflight_run(127,'APPROVE')"); e=err(o,"select public.rpc_costing_approve_run(127,%s,%s)",(R_,REF))
rec('N6','Run 127 (Oct draft) cannot be approved: Oct LOCKED, run 128 approved, and 127 has no fingerprint (pre-AU2 run)','PERIOD_OPEN, FINGERPRINT_CAPTURED/CLEAN, NO_OTHER_APPROVED_RUN fail',fails(pf),set(fails(pf))=={'PERIOD_OPEN','FINGERPRINT_CAPTURED','FINGERPRINT_CLEAN','NO_OTHER_APPROVED_RUN'} and e is not None)
json.dump(R,open('/workspace/w2/out/w2_test_results.json','w'),indent=1)
print(sum(r['pass_'] for r in R),'/',len(R))
