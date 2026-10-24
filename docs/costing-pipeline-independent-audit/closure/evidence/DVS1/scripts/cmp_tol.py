import psycopg,sys,json
RUN=int(sys.argv[1]); db=sys.argv[2] if len(sys.argv)>2 else 'dvs'; base=int(sys.argv[3]) if len(sys.argv)>3 else 128
c=psycopg.connect(f"host=/tmp port=54329 user=postgres dbname={db}")
cols=c.execute("select column_name,data_type from information_schema.columns where table_schema='costing' and table_name='sku_sales_allocation_basis_snapshot' and column_name not in ('id','refresh_run_id','refreshed_at') order by ordinal_position").fetchall()
out={}
for col,t in cols:
    if t=='numeric':
        r=c.execute(f"""select count(*) filter (where (a.{col} is null) <> (b.{col} is null) or abs(a.{col}-b.{col}) > 1e-9*greatest(abs(a.{col}),1)),
                     max(abs(a.{col}-b.{col})) from costing.sku_sales_allocation_basis_snapshot a join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=a.sku_id and b.refresh_run_id={RUN} where a.refresh_run_id={base}""").fetchone()
        if r[0] or (r[1] or 0)>0: out[col]={'material_diffs':r[0],'max_abs':str(r[1])}
    else:
        expr=lambda x: f"replace({x}::text,'>= 0.60 of','>= 0.6 of')" if t=='text' else f"{x}::text"
        k=c.execute(f"select count(*) from costing.sku_sales_allocation_basis_snapshot a join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=a.sku_id and b.refresh_run_id={RUN} where a.refresh_run_id={base} and {expr('a.'+col)} is distinct from {expr('b.'+col)}").fetchone()[0]
        if k: out[col]={'diffs':k}
n=c.execute(f"select count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={RUN}").fetchone()[0]
print(json.dumps({'rows':n,'columns':out}))
