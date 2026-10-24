import psycopg,json,datetime
c=psycopg.connect('host=/tmp port=54329 user=postgres dbname=ebd',autocommit=True); X=c.execute; X("set timezone='UTC'")
R={}
X("update costing.demand_volume_selection_policy set status='DRAFT', effective_from='2026-11-01', approval_reference='USER-APPROVAL-20261018-AU9-DVS1 (in principle)'")
X("delete from costing.sku_demand_volume_override")
def mkrun(run):
    X("set session_replication_role=replica")
    X(f"delete from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={run}")
    X(f"delete from costing.costing_refresh_run where id={run}")
    X(f"insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run, (select to_jsonb(r) || jsonb_build_object('id',{run},'overall_status','RUNNING','finished_at',null) from costing.costing_refresh_run r where id=128))")
    X("set session_replication_role=origin")
    X("select costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-10-01','2026-10-16',%s)",(run,))
cols=[r[0] for r in X("select column_name from information_schema.columns where table_schema='costing' and table_name='sku_sales_allocation_basis_snapshot' and column_name not in ('id','refresh_run_id','refreshed_at') order by ordinal_position")]
sel=",".join(cols); T='costing.sku_sales_allocation_basis_snapshot'
mkrun(9140)
X(open('out/PREPARED_CI012_no_backdating_guard.sql').read()); R['install']='ok'
R['config']=X("select mode, count(*) from costing.effective_date_guard_config group by 1 order by 1").fetchall()
R['frozen_through']=str(X("select costing.fn_frozen_valuation_through()").fetchone()[0])
today=X("select (now() at time zone 'Asia/Kolkata')::date").fetchone()[0]; R['ist_today']=str(today)
mkrun(9141)
R['refresh_after_guard_rowdiff']=X(f"select count(*) from ((select {sel} from {T} where refresh_run_id=9140 except all select {sel} from {T} where refresh_run_id=9141) union all (select {sel} from {T} where refresh_run_id=9141 except all select {sel} from {T} where refresh_run_id=9140)) z").fetchone()[0]
def t(tag, sql):
    try:
        with c.transaction(): X(sql); R[tag]='allowed'; raise psycopg.errors.QueryCanceled('rb')
    except psycopg.errors.QueryCanceled: pass
    except Exception as e: R[tag]='refused: '+str(e).split('\n')[0][:110]
y=today-datetime.timedelta(days=1); tm=today+datetime.timedelta(days=1)
P='costing.plant_capacity_profile'
t('FWD insert yesterday', f"insert into {P}(label,effective_from) values ('x','{y}')")
t('FWD insert 2026-10-10 (frozen)', f"insert into {P}(label,effective_from) values ('x','2026-10-10')")
t('FWD insert today', f"insert into {P}(label,effective_from) values ('x','{today}')")
t('FWD insert tomorrow', f"insert into {P}(label,effective_from) values ('x','{tm}')")
X(f"insert into {P}(label,effective_from) values ('keep','2026-11-01')")
t('FWD close row with effective_to yesterday', f"update {P} set effective_to='{y}' where label='keep'")
t('FWD close row with effective_to today', f"update {P} set effective_to='{today}' where label='keep'")
t('FWD update other column only', f"update {P} set label='keep2' where label='keep'")
t('DVS override backdated', f"insert into costing.sku_demand_volume_override(sku_id,effective_from,override_method,monthly_units,reason,approval_reference) values (1,'{y}','FIXED_MONTHLY_UNITS',5,'t','t')")
t('ledger backdated', f"insert into costing.cost_head_policy_ledger(label,effective_from) values ('x','2026-10-01')")
A='costing.sales_allocation_default_policy'
n0=X("select count(*) from costing.effective_date_backdate_log").fetchone()[0]
X(f"update {A} set effective_to = effective_to where false")
row=X(f"select to_jsonb(p) from {A} p order by id desc limit 1").fetchone()[0]
X("set session_replication_role=origin")
try:
    X(f"update {A} set effective_from = date '2026-10-05' where id = {row['id']}"); R['AUDIT backdated update']='allowed'
except Exception as e: R['AUDIT backdated update']='refused (other guard): '+str(e).split('\n')[0][:120]
R['audit_log_rows']=X("select jsonb_agg(jsonb_build_array(table_name,op,column_name,new_date,mode)) from costing.effective_date_backdate_log").fetchone()[0]
X("update costing.effective_date_guard_config set mode='NOT_INTO_FROZEN' where table_name='costing.new_product_volume_plan'::regclass")
nr=X("select to_jsonb(p) from costing.new_product_volume_plan p limit 1").fetchone()[0]
t('NOT_INTO_FROZEN set 2026-10-10', f"update costing.new_product_volume_plan set effective_from='2026-10-10' where id={nr['id']}")
t('NOT_INTO_FROZEN set 2026-10-17 (after frozen, before today)', f"update costing.new_product_volume_plan set effective_from='2026-10-17' where id={nr['id']}")
R['runs_122_128_untouched']=X("select md5(string_agg(md5(t::text),'' order by id)) from costing.sku_sales_allocation_basis_snapshot t where refresh_run_id in (122,128)").fetchone()[0]==psycopg.connect('host=/tmp port=54329 user=postgres dbname=dvs').execute("select md5(string_agg(md5(t::text),'' order by id)) from costing.sku_sales_allocation_basis_snapshot t where refresh_run_id in (122,128)").fetchone()[0]
print(json.dumps(R,indent=1,default=str))
