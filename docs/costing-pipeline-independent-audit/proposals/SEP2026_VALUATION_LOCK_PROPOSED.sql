-- PROPOSAL (NOT APPLIED). Lock September 2026 (valuation date 10 Sep) after the rerun succeeds.
-- State model (live): cost_periods.status OPEN|LOCKED|CLOSED paired by CHECK with valuation_date_status DRAFT|LOCKED|FINAL;
-- columns locked_at/locked_by/lock_reason/lock_approval_reference; audit table cost_period_governance_audit allows
-- event_type PERIOD_LOCKED / PERIOD_REOPENED (source GOVERNED_RPC) but no RPC implements them yet (only rpc_close_cost_period).
-- Effects: the refresh request refuses non-OPEN periods (so no further runs until reopened); rpc_set_cost_period_valuation_date is OPEN-only.
-- Long-term: add rpc_lock_cost_period/rpc_reopen_cost_period (AU-2 backlog), mirroring rpc_close_cost_period.
begin;
do $$ declare p costing.cost_periods%rowtype; begin
  select * into p from costing.cost_periods where period_start=date '2026-09-01' for update;
  if p.status<>'OPEN' or p.valuation_date_status<>'DRAFT' or p.valuation_date<>date '2026-09-10' then
    raise exception 'pre-check failed: % % %', p.status, p.valuation_date_status, p.valuation_date; end if;
  if exists (select 1 from costing.costing_refresh_run where period_start=p.period_start and overall_status not in ('SUCCESS','FAILED','CANCELLED'))
    then raise exception 'refresh in flight'; end if;
  if not exists (select 1 from costing.costing_refresh_run where period_start=p.period_start and overall_status='SUCCESS' and valuation_date=date '2026-09-10' and id>=122)
    then raise exception 'no successful rerun at 10 Sep'; end if;
  update costing.cost_periods set status='LOCKED', valuation_date_status='LOCKED', locked_at=now(),
    locked_by='dff17104-c02a-4bca-95b1-e8ddff46a9b6', lock_reason='Lock September 2026 valuation date 10-Sep-2026 for first APPROVED run; user approval',
    lock_approval_reference='USER-LOCK-SEP2026-20261016', updated_at=now()
   where period_start=p.period_start;
  insert into costing.cost_period_governance_audit(period_start,event_type,previous_status,new_status,previous_valuation_date,new_valuation_date,
    previous_valuation_date_status,new_valuation_date_status,reason,approval_reference,event_source,actor_user_id,evidence_json)
  values (p.period_start,'PERIOD_LOCKED','OPEN','LOCKED',p.valuation_date,p.valuation_date,'DRAFT','LOCKED',
    'Lock for first APPROVED run (user approval)','USER-LOCK-SEP2026-20261016','GOVERNED_RPC','dff17104-c02a-4bca-95b1-e8ddff46a9b6',
    jsonb_build_object('method','guarded manual transition; no lock RPC exists','runbook','AU4'));
end $$;
commit;
-- ROLLBACK (reopen): update costing.cost_periods set status='OPEN', valuation_date_status='DRAFT', reopened_at=now(),
--   reopened_by='dff17104-c02a-4bca-95b1-e8ddff46a9b6', reopen_reason='rollback of lock', reopen_approval_reference='USER-LOCK-SEP2026-20261016-RB', updated_at=now()
--   where period_start='2026-09-01' and status='LOCKED';
--   + insert a PERIOD_REOPENED audit row (LOCKED->OPEN, LOCKED->DRAFT). Not allowed once any run is APPROVED for the period.
