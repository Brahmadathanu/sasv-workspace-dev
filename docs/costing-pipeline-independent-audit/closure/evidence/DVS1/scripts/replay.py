import psycopg,sys,json
RUN=int(sys.argv[1]) if len(sys.argv)>1 else 9128
db=sys.argv[2] if len(sys.argv)>2 else 'dvs'
c=psycopg.connect(f"host=/tmp port=54329 user=postgres dbname={db}",autocommit=True)
c.execute("set session_replication_role=replica")
c.execute(f"delete from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={RUN}")
c.execute(f"delete from costing.costing_refresh_run where id={RUN}")
c.execute(f"insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run, (select to_jsonb(r) || jsonb_build_object('id',{RUN},'overall_status','RUNNING','finished_at',null) from costing.costing_refresh_run r where id=128))")
c.execute("set session_replication_role=origin")
c.execute("select costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-10-01','2026-10-16',%s)",(RUN,))
cols=[r[0] for r in c.execute("select column_name from information_schema.columns where table_schema='costing' and table_name='sku_sales_allocation_basis_snapshot' and column_name not in ('id','refresh_run_id','refreshed_at') order by ordinal_position")]
sel=",".join(cols)
diff=c.execute(f"""select count(*) from ((select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=128 except all select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={RUN})
 union all (select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={RUN} except all select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=128)) d""").fetchone()[0]
n=c.execute(f"select count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={RUN}").fetchone()[0]
percol={}
for col in cols:
    k=c.execute(f"select count(*) from costing.sku_sales_allocation_basis_snapshot a full join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=a.sku_id and b.refresh_run_id={RUN} where a.refresh_run_id=128 and a.{col} is distinct from b.{col}").fetchone()[0]
    if k: percol[col]=k
print(json.dumps({'run':RUN,'rows':n,'row_diffs':diff,'cols_differing':percol}))
