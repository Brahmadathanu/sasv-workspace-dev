import psycopg, json, subprocess, sys, uuid
P='/workspace/au4wt/docs/costing-pipeline-independent-audit/closure/prepared/'
FILES=['PREPARED_TB1_tally_snapshot_write_lockdown.sql','PREPARED_TB2_costing_view_permission_gate.sql','PREPARED_TB3_function_search_path.sql',
       'PREPARED_TB5_ilc_imc_atomic_view.sql','PREPARED_TB6_fingerprint_algorithm_version.sql','PREPARED_TB7_capacity_value_origin.sql']
adm=psycopg.connect("host=/tmp port=54329 user=postgres dbname=postgres",autocommit=True)
adm.execute("drop database if exists tb_t with (force)"); adm.execute("create database tb_t template tb")
c=psycopg.connect("host=/tmp port=54329 user=postgres dbname=tb_t",autocommit=True)
for fdef in ['fn_run_fingerprint_current_columns','fn_run_fingerprint_table_hash','fn_compute_run_fingerprint','fn_verify_run_fingerprint']:
    try: c.execute(open(f'/workspace/tb/def_costing.{fdef}.sql').read())
    except Exception as e: print('fpdef',fdef,e)
for f in json.load(open('/workspace/tb/sec_facts.json'))['mutable_fns']:
    c.execute(f['def'])
    assert c.execute("select md5(pg_get_functiondef(oid)) from pg_proc where oid=%s::regprocedure",(f['f']+'('+','.join(a.split()[-1] for a in f['args'].split(', ') if a)+')',)).fetchone()[0]==f['md5'], f['f']
U_NONE,U_COST,U_ETL=str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4())
c.execute("insert into public.user_permissions_canonical(user_id,target,can_view,can_edit) values (%s,'module:costing-control-center',true,false)",(U_COST,))
c.execute("insert into public.hub_user_access(user_id,utility_id,level) select %s,id,'use' from public.hub_utilities where key='hub_admin'",(U_ETL,))
assert c.execute("select public.is_etl_admin(%s)",(U_ETL,)).fetchone()[0]
views=[r[0] for r in c.execute("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and (c.relname like 'v_costing%%' or c.relname like 'v_cost_sheet%%') order by 1")]
ung=json.load(open('/workspace/tb/ungated_views.json'))
def as_user(uid, sql, role='authenticated', args=None):
    with c.transaction():
        c.execute(f"set local role {role}")
        if uid: c.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid,))
        try: return ('ok',c.execute(sql,args).fetchall())
        except Exception as e: return ('err',str(e).splitlines()[0])
    return None
def sig(v):
    try:
        with c.transaction(): return c.execute(f"select count(*), md5(coalesce(string_agg(t::text,'|' order by t::text),'')) from public.{v} t").fetchone()
    except Exception as e: return ('ERR', str(e).splitlines()[0][:100])
def cols(v): return c.execute("select string_agg(attname||':'||format_type(atttypid,atttypmod),',' order by attnum) from pg_attribute where attrelid=%s::regclass and attnum>0",('public.'+v,)).fetchone()[0]
def vstate():
    out={}
    for v in views:
        s=sig(v); out[v]={'pg':list(s),'cols':cols(v),
          'cost':as_user(U_COST,f"select count(*), md5(coalesce(string_agg(t::text,'|' order by t::text),'')) from public.{v} t"),
          'none':as_user(U_NONE,f"select count(*) from public.{v}"),
          'anon':as_user(None,f"select count(*) from public.{v}",'anon')[0]}
    return out
def fpverify():
    return c.execute("select r, costing.fn_verify_run_fingerprint(r)::text from unnest(array[119,121,122,124,125,126,127,128]::bigint[]) r").fetchall()
fns=["select costing.fn_fy_start('2026-02-10'), costing.fn_fy_start('2026-10-19')",
     "select costing.fn_sales_allocation_quantity_driver_fingerprint(1,2,'2026-10-01','m','s','2026-09-01',3,4,'x',5.5,6.25)",
     "select costing.fn_regional_marketing_evidence_fingerprint(1,2,' ke ','2026-10-01','b',1,2,3,4,'s','m',7.5,0.25)",
     "select * from public.fn_tally_classify_export_window('2026-10-19','2026-04-01','2026-10-19','2026-04-01','2026-10-19','FYTD')",
     "select * from public.fn_tally_classify_export_window('2026-10-19','2026-10-01','2026-10-19','2026-10-01','2026-10-19',null)",
     "select costing.fn_apply_batch_true_standard(1)"]
def fnout():
    o=[]
    for q in fns:
        try: o.append(str(c.execute(q).fetchall()))
        except Exception as e: o.append('ERR '+str(e).splitlines()[0])
    for args in [("short","R"),("long enough reason","")]:
        try: c.execute("select costing.fn_w2_require_text(%s,%s)",args); o.append('ok')
        except Exception as e: o.append('ERR '+str(e).splitlines()[0])
    return o
tally=[r[0] for r in c.execute("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and (relname like 'tally%%' or relname='etl_jobs') order by 1")]
def tstate():
    out={}
    for t in tally:
        n=c.execute(f"select count(*) from public.{t}").fetchone()[0]
        def tryw(uid,role,sql):
            with c.transaction() as tx:
                c.execute(f"set local role {role}")
                if uid: c.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid,))
                try: cur=c.execute(sql); r=('ok',cur.rowcount)
                except Exception as e: r=('err',str(e).splitlines()[0][:80])
                raise psycopg.Rollback(tx)
            return r
        d={'rows':n}
        d['none_read']=tryw(U_NONE,'authenticated',f"select 1 from public.{t}")
        d['none_update']=tryw(U_NONE,'authenticated',f"update public.{t} set {c.execute('select attname from pg_attribute where attrelid=%s::regclass and attnum=1',('public.'+t,)).fetchone()[0]}={c.execute('select attname from pg_attribute where attrelid=%s::regclass and attnum=1',('public.'+t,)).fetchone()[0]}")
        d['none_delete']=tryw(U_NONE,'authenticated',f"delete from public.{t}")
        d['none_truncate']=tryw(U_NONE,'authenticated',f"truncate public.{t}")
        d['etl_delete']=tryw(U_ETL,'authenticated',f"delete from public.{t}")
        d['svc_delete']=tryw(None,'service_role',f"delete from public.{t}")
        d['anon_read']=tryw(None,'anon',f"select 1 from public.{t}")
        d['anon_truncate']=tryw(None,'anon',f"truncate public.{t}")
        out[t]=d
    return out
R={'users':{'none':'authenticated, no costing permission','cost':'module:costing-control-center view','etl':'hub_admin use (ETL admin)'}}
R['before']={'views':vstate(),'fp':fpverify(),'fns':fnout(),'tally':tstate()}
R['apply']={}
for f in FILES:
    r=subprocess.run(['psql','-h','/tmp','-p','54329','-U','postgres','-d','tb_t','-v','ON_ERROR_STOP=1','-1','-q','-f',P+f],capture_output=True,text=True)
    R['apply'][f]={'rc':r.returncode,'stderr':r.stderr.strip()[-600:]}
    print(f,r.returncode,r.stderr.strip()[-300:])
R['after']={'views':vstate(),'fp':fpverify(),'fns':fnout(),'tally':tstate()}
# RPC/definer path and dependants
c.execute("create function public.zz_definer_probe() returns bigint language sql security definer as $$ select count(*) from public.v_costing_staff_classification_register $$")
c.execute("grant execute on function public.zz_definer_probe() to authenticated")
R['after']['definer_rpc_as_none']=as_user(U_NONE,"select public.zz_definer_probe()")
R['after']['definer_rpc_pg']=c.execute("select public.zz_definer_probe()").fetchone()[0]
R['after']['dependant_costing_view_none']=as_user(U_NONE,"select count(*) from costing.v_cost_pool_monthly_combined")
R['before_dependant_pg']=c.execute("select count(*) from costing.v_cost_pool_monthly_combined").fetchone()[0]
R['after']['tb5']=c.execute("select refresh_run_id,count(*),max(abs(prime_identity_gap)),max(abs(ilc_identity_gap)),count(*) filter (where internal_material_conversion_cost_per_sku<>0),sum(internal_material_conversion_cost_per_sku)::text from costing.v_sku_internal_loaded_cost_atomic group by 1 order by 1").fetchall()
R['after']['tb6_method']=c.execute("select id,refresh_run_id,purpose,method,algorithm_version from costing.v_run_fingerprint_method order by id").fetchall()
with c.transaction() as tx:
    try:
        r=c.execute("insert into costing.costing_run_fingerprint(refresh_run_id,purpose,captured_by,fingerprint) values (128,'REBASELINE','tb-test','{}') returning algorithm_version, scoped_table_set_md5").fetchone()
        R['after']['tb6_new_row_defaults']=list(r)
    except Exception as e: R['after']['tb6_new_row_defaults']='ERR '+str(e).splitlines()[0]
    raise psycopg.Rollback(tx)
R['after']['tb7_counts']=c.execute("select source_table, value_origin, count(*) filter (where effective_to is null), count(*) from costing.v_capacity_value_origin group by 1,2 order by 1,2").fetchall()
rows=c.execute("select source_table,id,plant_id,resource_class_code,equipment_class_code,value,unit,is_provisional,value_origin,basis_note,approval_reference,effective_from from costing.v_capacity_value_origin where effective_to is null order by source_table, value_origin, resource_class_code, id").fetchall()
import csv
with open('/workspace/tb/run/capacity_value_origin_current.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['source_table','id','plant_id','resource_class','equipment_class','value','unit','is_provisional','value_origin','basis_note','approval_reference','effective_from']); w.writerows(rows)
json.dump(R,open('/workspace/tb/run/results.json','w'),indent=1,default=str)
