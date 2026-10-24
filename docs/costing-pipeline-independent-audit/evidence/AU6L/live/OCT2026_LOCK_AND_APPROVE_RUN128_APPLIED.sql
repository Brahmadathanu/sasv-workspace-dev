begin;
select set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
do $$ declare p costing.cost_periods%rowtype; n int; v_des bigint; begin
  select count(*) into n from costing.cost_periods where period_start=date '2026-10-01';
  if n<>1 then raise exception 'guard: expected exactly 1 October period row, found %', n; end if;
  select * into p from costing.cost_periods where period_start=date '2026-10-01' for update;
  if p.status<>'OPEN' or p.valuation_date_status<>'DRAFT' or p.valuation_date<>date '2026-10-16' then
    raise exception 'pre-check failed: % % %', p.status, p.valuation_date_status, p.valuation_date; end if;
  if exists (select 1 from costing.costing_refresh_run where period_start=p.period_start and overall_status not in ('SUCCESS','FAILED','CANCELLED'))
    then raise exception 'refresh in flight'; end if;
  if not exists (select 1 from costing.costing_refresh_run where id=128 and period_start=p.period_start and overall_status='SUCCESS' and valuation_date=date '2026-10-16')
    then raise exception 'run 128 not SUCCESS at 16 Oct'; end if;
  if exists (select 1 from costing.v_costing_run_effective_designation where period_start=p.period_start)
    then raise exception 'October already has a designation'; end if;
  update costing.cost_periods set status='LOCKED', valuation_date_status='LOCKED', locked_at=now(),
    locked_by='dff17104-c02a-4bca-95b1-e8ddff46a9b6', lock_reason='Lock October 2026 valuation date 16-Oct-2026 for APPROVED run 128; user approval (option A, same method as September)',
    lock_approval_reference='USER-APPROVAL-20261018-OCT-LOCK-OPTION-A', updated_at=now()
   where period_start=p.period_start and status='OPEN' and valuation_date_status='DRAFT';
  get diagnostics n = row_count;
  if n<>1 then raise exception 'guard: lock updated % rows', n; end if;
  insert into costing.cost_period_governance_audit(period_start,event_type,previous_status,new_status,previous_valuation_date,new_valuation_date,
    previous_valuation_date_status,new_valuation_date_status,reason,approval_reference,event_source,actor_user_id,evidence_json)
  values (p.period_start,'PERIOD_LOCKED','OPEN','LOCKED',p.valuation_date,p.valuation_date,'DRAFT','LOCKED',
    'Lock for APPROVED run 128 (user approval, option A)','USER-APPROVAL-20261018-OCT-LOCK-OPTION-A','GOVERNED_RPC','dff17104-c02a-4bca-95b1-e8ddff46a9b6',
    jsonb_build_object('method','guarded manual transition mirroring SEP2026_VALUATION_LOCK_PROPOSED.sql; no lock RPC exists','runbook','AU6L','approved_at','2026-10-18 14:17 IST'));
  v_des := costing.rpc_designate_costing_run(128,'APPROVED','Dr. Brahmadathan U',
    'APPROVED October 2026 run (valuation 16-Oct LOCKED); USER-APPROVAL-20261018-OCT-LOCK-OPTION-A (user 2026-10-18 14:17 IST). Notes: capacities provisional (equipment-loads config, route_equipment_load_capacity); 60% seasonal cut-off chosen by Aryabhatta; 37 open reviews accepted as known exceptions (non-blocking); 9 negative-margin SKUs to pricing review.');
  if v_des is null then raise exception 'designation failed'; end if;
  if (select count(*) from costing.v_costing_run_effective_designation where period_start=p.period_start and designation='APPROVED')<>1 then raise exception 'guard: approved count'; end if;
end $$;
select (select to_jsonb(c) from (select period_start,status,valuation_date,valuation_date_status,locked_at,lock_approval_reference from costing.cost_periods where period_start='2026-10-01') c) period,
 (select json_agg(json_build_object('r',refresh_run_id,'d',designation,'id',id,'fp',fingerprint_id,'uid',designated_by_uid)) from costing.costing_run_designation) des,
 (select json_agg(json_build_object('id',audit_id,'ev',event_type,'at',occurred_at)) from costing.cost_period_governance_audit where period_start='2026-10-01') audit;
commit;
