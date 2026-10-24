import psycopg,json
DB='host=/tmp port=54329 user=postgres'
with psycopg.connect(DB+' dbname=postgres',autocommit=True) as c:
    c.execute("drop database if exists c34 with (force)"); c.execute("create database c34 template dvs_t"); c.execute("alter database c34 set timezone to 'UTC'")
c=psycopg.connect(DB+' dbname=c34',autocommit=True); X=c.execute; R={}
X("update costing.demand_volume_selection_policy set status='DRAFT', effective_from='2026-11-01'"); X("delete from costing.sku_demand_volume_override")
def mkrun(run):
    X("set session_replication_role=replica")
    X(f"delete from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={run}"); X(f"delete from costing.costing_refresh_run where id={run}")
    X(f"insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run, (select to_jsonb(r) || jsonb_build_object('id',{run},'overall_status','RUNNING','finished_at',null) from costing.costing_refresh_run r where id=128))")
    X("set session_replication_role=origin")
    X("select costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-10-01','2026-10-16',%s)",(run,))
cols=[r[0] for r in X("select column_name from information_schema.columns where table_schema='costing' and table_name='sku_sales_allocation_basis_snapshot' and column_name not in ('id','refresh_run_id','refreshed_at') order by ordinal_position")]
T='costing.sku_sales_allocation_basis_snapshot'
def diff(a,b,excl=()):
    s=",".join(x for x in cols if x not in excl)
    return X(f"select count(*) from ((select {s} from {T} where refresh_run_id={a} except all select {s} from {T} where refresh_run_id={b}) union all (select {s} from {T} where refresh_run_id={b} except all select {s} from {T} where refresh_run_id={a})) z").fetchone()[0]
def sdiff(a,b): return X(f"select jsonb_object_agg(k,n) from (select coalesce(x.allocation_basis_status,'-')||' -> '||coalesce(y.allocation_basis_status,'-') k, count(*) n from {T} x join {T} y on y.sku_id=x.sku_id and y.refresh_run_id={b} where x.refresh_run_id={a} and x.allocation_basis_status is distinct from y.allocation_basis_status group by 1) z").fetchone()[0]
mkrun(9150)                                    # current RPC, today's view contents
X("create table public.vsmc_backup as select * from public.v_sales_monthly_clean")
X("delete from public.v_sales_monthly_clean where month_start = (select max(month_start) from public.v_sales_monthly_clean)")  # simulate running on another day (window moved)
X("update public.v_sales_monthly_clean set qty_clean = null where sku_id % 7 = 0")
mkrun(9151)
R['before_fix: other day vs today, all-column row diffs']=diff(9150,9151); R['before_fix: status changes']=sdiff(9150,9151)
X("truncate public.v_sales_monthly_clean; insert into public.v_sales_monthly_clean select * from public.vsmc_backup")
X(open('out/PREPARED_CI034_valuation_anchored_basis_status.sql').read()); R['install']='ok'
R['rpc_md5_after']=X("select md5(pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure))").fetchone()[0]
mkrun(9152)
R['after_fix vs before_fix (same day): diffs outside status']=diff(9150,9152,('allocation_basis_status',))
R['after_fix vs before_fix: status changes']=sdiff(9150,9152)
X("delete from public.v_sales_monthly_clean where month_start = (select max(month_start) from public.v_sales_monthly_clean)")
X("update public.v_sales_monthly_clean set qty_clean = null where sku_id % 7 = 0")
mkrun(9153)
R['after_fix: other day vs today, all-column row diffs']=diff(9152,9153)
R['run128_status_vs_after_fix']=sdiff(128,9152)
try:
    X(open('out/PREPARED_CI034_valuation_anchored_basis_status.sql').read()); R['reapply']='allowed (BAD)'
except Exception as e: R['reapply']='refused: '+str(e).split('\n')[0][:90]
print(json.dumps(R,indent=1))
