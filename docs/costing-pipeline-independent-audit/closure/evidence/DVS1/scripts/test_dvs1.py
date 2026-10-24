import psycopg,json,sys
DB='host=/tmp port=54329 user=postgres'
with psycopg.connect(DB+' dbname=postgres',autocommit=True) as c:
    c.execute("drop database if exists dvs_t with (force)"); c.execute("create database dvs_t template dvs")
c=psycopg.connect(DB+' dbname=dvs_t',autocommit=True); X=c.execute
R={}
def mkrun(run):
    X("set session_replication_role=replica")
    X(f"delete from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={run}")
    if c.execute("select to_regclass('costing.sku_demand_volume_selection_snapshot')").fetchone()[0]:
        X(f"delete from costing.sku_demand_volume_selection_snapshot where refresh_run_id={run}")
    X(f"delete from costing.costing_refresh_run where id={run}")
    X(f"insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run, (select to_jsonb(r) || jsonb_build_object('id',{run},'overall_status','RUNNING','finished_at',null) from costing.costing_refresh_run r where id=128))")
    X("set session_replication_role=origin")
    return X("select * from costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-10-01','2026-10-16',%s)",(run,)).fetchone()
cols=[r[0] for r in X("select column_name from information_schema.columns where table_schema='costing' and table_name='sku_sales_allocation_basis_snapshot' and column_name not in ('id','refresh_run_id','refreshed_at') order by ordinal_position")]
sel=",".join(cols)
def rowdiff(a,b):
    return X(f"""select count(*) from ((select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={a} except all select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={b})
     union all (select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={b} except all select {sel} from costing.sku_sales_allocation_basis_snapshot where refresh_run_id={a})) d""").fetchone()[0]
def h128(): return X("select md5(string_agg(md5(t::text),'' order by id)) from costing.sku_sales_allocation_basis_snapshot t where refresh_run_id in (122,128)").fetchone()[0]
H0=h128()
R['legacy_replay_9128']=str(mkrun(9128))
X(open('out/PREPARED_DVS1_demand_volume_selection.sql').read())
R['install']='ok'
R['T0_switch_off_9129']=str(mkrun(9129))
R['T0_rowdiff_vs_legacy_replay']=rowdiff(9128,9129)
R['T0_lineage_rows']=X("select count(*) from costing.sku_demand_volume_selection_snapshot").fetchone()[0]
# T1: switch ON for the test period (fixture only: effective 2026-10-01 so the Oct run can exercise it)
X("update costing.demand_volume_selection_policy set status='APPROVED', effective_from='2026-10-01', approval_reference='TEST-ONLY' where version=1")
X("update costing.product_demand_seasonality set effective_from='2026-10-01'")
R['T1_switch_on_9130']=str(mkrun(9130))
R['T1_methods']=X("select method, count(*), count(*) filter (where applied_to_basis), count(*) filter (where diagnostic_flag) from costing.sku_demand_volume_selection_snapshot where refresh_run_id=9130 group by 1 order by 1").fetchall()
R['T1_basis_methods']=X("select monthly_driver_method, count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=9130 group by 1 order by 1").fetchall()
R['T1_kanji_878']=X("select method, selected_monthly_units::float, candidate_max_month::float, candidate_12m_avg::float, diagnostic_top3_share::float from costing.sku_demand_volume_selection_snapshot where refresh_run_id=9130 and sku_id=878").fetchone()
R['T1_kanji_878_basis']=X("select monthly_driver_method, monthly_allocation_units::float, left(monthly_driver_note,140) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=9130 and sku_id=878").fetchone()
R['T1_kanji_878_run128']=X("select monthly_driver_method, monthly_allocation_units::float from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=128 and sku_id=878").fetchone()
# rule-5 SKUs: identical to legacy max (same values as run 128 replay where run 128 was MAX)
R['T1_rule5_unchanged_vs_legacy']=X("""select count(*), count(*) filter (where a.monthly_allocation_units is distinct from b.monthly_allocation_units or a.monthly_driver_method is distinct from b.monthly_driver_method or a.monthly_driver_note is distinct from b.monthly_driver_note)
  from costing.sku_sales_allocation_basis_snapshot a join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=a.sku_id and b.refresh_run_id=9128
  join costing.sku_demand_volume_selection_snapshot s on s.refresh_run_id=9130 and s.sku_id=a.sku_id
 where a.refresh_run_id=9130 and s.method='MAX_MONTH' and b.monthly_driver_method='MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK'""").fetchone()
R['T1_change_vs_legacy']=X("""select count(*) filter (where a.monthly_allocation_units is distinct from b.monthly_allocation_units) changed,
   percentile_cont(0.5) within group (order by (a.monthly_allocation_units/b.monthly_allocation_units - 1)) filter (where a.monthly_allocation_units <> b.monthly_allocation_units)::float median_rel,
   min(a.monthly_allocation_units/b.monthly_allocation_units - 1)::float min_rel, max(a.monthly_allocation_units/b.monthly_allocation_units - 1)::float max_rel,
   sum(a.monthly_company_allocation_units)/count(*) filter (where true) company_units_after, sum(b.monthly_company_allocation_units)/count(*) company_units_before
  from costing.sku_sales_allocation_basis_snapshot a join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=a.sku_id and b.refresh_run_id=9128 where a.refresh_run_id=9130""").fetchone()
R['T1_transition']=X("""select b.monthly_driver_method, s.method, count(*) from costing.sku_sales_allocation_basis_snapshot b
  join costing.sku_demand_volume_selection_snapshot s on s.refresh_run_id=9130 and s.sku_id=b.sku_id where b.refresh_run_id=9128 group by 1,2 order by 1,2""").fetchall()
# pick test SKUs: a rule-5 SKU with >=3 positive months for events
sk=X("""select s.sku_id, s.candidate_max_month from costing.sku_demand_volume_selection_snapshot s where s.refresh_run_id=9130 and s.method='MAX_MONTH' and s.candidate_max_month > 50 and s.first_sale_month < '2025-01-01' order by s.sku_id limit 4""").fetchall()
(s1,m1),(s2,m2),(s3,m3),(s4,m4)=sk
peak=lambda s: X(f"""select c.month_start from costing.fn_costing_sales_monthly_as_of('2026-10-16') c where c.sku_id={s} and c.month_start>='2025-10-01' group by 1 order by sum(c.qty_clean) desc limit 1""").fetchone()[0]
p1,p2,p3=peak(s1),peak(s2),peak(s3)
X(f"insert into costing.demand_event_register(sku_id,event_month,event_type,units_affected,treatment,evidence_reference,status) values ({s1},'{p1}','BULK_INSTITUTIONAL_ORDER',{m1}/2,'EXCLUDE_UNITS','TEST','PROPOSED')")
mkrun(9131)
R['T2_proposed_event_no_effect']={'sku':s1,'method':X(f"select method from costing.sku_demand_volume_selection_snapshot where refresh_run_id=9131 and sku_id={s1}").fetchone()[0],'rowdiff_vs_9130':rowdiff(9130,9131)}
X(f"update costing.demand_event_register set status='CONFIRMED', approval_reference='TEST' where sku_id={s1}")
X(f"insert into costing.demand_event_register(sku_id,event_month,event_type,treatment,evidence_reference,status,approval_reference) values ({s2},'{p2}','SUPPLY_CONSTRAINT','EXCLUDE_MONTH','TEST','CONFIRMED','TEST')")
X(f"insert into costing.demand_event_register(sku_id,event_month,event_type,treatment,evidence_reference,status,approval_reference) values ({s3},'{p3}','EXHIBITION_FESTIVAL','INFORMATION_ONLY','TEST','CONFIRMED','TEST')")
X(f"insert into costing.sku_demand_volume_override(sku_id,effective_from,override_method,monthly_units,reason,approval_reference) values ({s4},'2026-10-01','FIXED_MONTHLY_UNITS',123,'TEST','TEST')")
X(f"insert into costing.sku_demand_volume_override(sku_id,effective_from,override_method,monthly_units,reason,approval_reference) values (878,'2026-10-01','FIXED_MONTHLY_UNITS',777,'TEST','TEST')")
mkrun(9132)
q=lambda s: X(f"""select s.method, s.selected_monthly_units::float, s.candidate_max_month::float, s.candidate_max_excl_events::float, s.candidate_in_stock_avg::float, b.monthly_driver_method, b.monthly_allocation_units::float, b.monthly_driver_source_month::text, left(b.monthly_driver_note,110)
   from costing.sku_demand_volume_selection_snapshot s join costing.sku_sales_allocation_basis_snapshot b on b.refresh_run_id=s.refresh_run_id and b.sku_id=s.sku_id where s.refresh_run_id=9132 and s.sku_id={s}""").fetchone()
R['T3_confirmed_exclude_units']=q(s1); R['T3_supply_constraint']=q(s2); R['T3_information_only']=q(s3); R['T3_override']=q(s4); R['T3_override_beats_seasonal_878']=q(878)
R['T3_others_unchanged_vs_9130']=X(f"""select count(*) from costing.sku_sales_allocation_basis_snapshot a join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=a.sku_id and b.refresh_run_id=9130
   where a.refresh_run_id=9132 and a.sku_id not in ({s1},{s2},{s3},{s4},878) and (a.monthly_allocation_units is distinct from b.monthly_allocation_units)""").fetchone()[0]
# fail-closed checks
def expect_fail(sql, tag):
    try:
        with c.transaction(): X(sql); mkrun(9133); raise RuntimeError('NOFAIL')
    except RuntimeError: R[tag]='DID NOT FAIL'
    except Exception as e: R[tag]='refused: '+str(e).split('\n')[0][:140]
expect_fail(f"insert into costing.sku_demand_volume_override(sku_id,effective_from,override_method,monthly_units,reason,approval_reference) values ({s4},'2026-09-01','FIXED_MONTHLY_UNITS',5,'TEST','TEST')", 'T4_overlapping_override')
expect_fail("insert into costing.demand_volume_selection_policy(policy_code,version,params,effective_from,status,approval_reference) select policy_code,2,params,'2026-10-01','APPROVED','TEST' from costing.demand_volume_selection_policy where version=1", 'T4_overlapping_policy')
expect_fail("update costing.costing_sales_feed_switch set seasonal_top3_share_threshold=null", 'T4_feed_off_with_dvs_on')
try:
    with c.transaction(): X("insert into costing.sku_demand_volume_selection_snapshot(refresh_run_id,period_start,valuation_date,sku_id,product_id,policy_id,method,selected_monthly_units,applied_to_basis) values (128,'2026-10-01','2026-10-16',1,1,1,'MAX_MONTH',1,false)"); R['T5_run128_lineage_insert']='ALLOWED (BAD)'
except Exception as e: R['T5_run128_lineage_insert']='refused: '+str(e).split('\n')[0][:120]
try:
    with c.transaction(): X("insert into costing.demand_event_register(sku_id,event_month,event_type,treatment,evidence_reference,status) values (1,'2026-01-01','OTHER','EXCLUDE_MONTH','x','CONFIRMED')"); R['T5_confirmed_without_approval']='ALLOWED (BAD)'
except Exception as e: R['T5_confirmed_without_approval']='refused: '+str(e).split('\n')[0][:100]
R['T6_runs_122_128_unchanged']=h128()==H0
print(json.dumps(R,indent=1,default=str))
