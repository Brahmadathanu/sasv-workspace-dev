-- DRAFT (not applied). Autonomous, idempotent, effective-dated cost-period lifecycle. Default DISABLED.
create table if not exists costing.cost_period_lifecycle_policy (
  id bigserial primary key,
  effective_from date not null unique,
  auto_create_current boolean not null default false,
  track_draft_valuation_date boolean not null default false,
  approved_by text, approval_reference text, created_at timestamptz not null default now()
);
insert into costing.cost_period_lifecycle_policy(effective_from) values ('2026-01-01') on conflict do nothing;

create or replace function costing.fn_cost_period_lifecycle_tick(p_business_date date default costing.fn_india_business_date())
returns jsonb language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare pol record; v_start date := date_trunc('month',p_business_date)::date; cp record; v_created boolean:=false; v_moved boolean:=false;
begin
  select * into pol from costing.cost_period_lifecycle_policy where effective_from<=p_business_date order by effective_from desc limit 1;
  if pol is null then return jsonb_build_object('status','NO_POLICY'); end if;
  if pol.auto_create_current and not exists(select 1 from costing.cost_periods where period_start=v_start) then
    perform costing.rpc_ensure_cost_period(v_start); v_created:=true;
  end if;
  select * into cp from costing.cost_periods where period_start=v_start for update;
  if cp is null then return jsonb_build_object('status','PERIOD_NOT_GOVERNED','period_start',v_start); end if;
  -- never alter LOCKED/CLOSED, manual dates, or periods holding a designated run
  if pol.track_draft_valuation_date and cp.status='OPEN' and cp.valuation_date_status='DRAFT'
     and cp.valuation_date_source='SYSTEM_DEFAULT' and p_business_date>cp.valuation_date and p_business_date<=cp.period_end
     and not exists(select 1 from costing.costing_run_designation d where d.period_start=v_start) then
    update costing.cost_periods set valuation_date=p_business_date, valuation_date_set_at=statement_timestamp(),
      valuation_date_change_reason='Lifecycle tick: DRAFT system default tracks business date', updated_at=statement_timestamp()
      where period_start=v_start;
    insert into costing.cost_period_governance_audit(period_start,event_type,previous_status,new_status,previous_valuation_date,new_valuation_date,
      previous_valuation_date_status,new_valuation_date_status,reason,event_source,evidence_json,occurred_at)
    values (v_start,'VALUATION_DATE_CHANGED','OPEN','OPEN',cp.valuation_date,p_business_date,'DRAFT','DRAFT',
      'Lifecycle tick (policy '||pol.id||')','SYSTEM',jsonb_build_object('policy_id',pol.id),statement_timestamp());
    v_moved:=true;
  end if;
  return jsonb_build_object('status','OK','period_start',v_start,'created',v_created,'valuation_date_moved',v_moved,'policy_id',pol.id);
end $f$;
revoke all on function costing.fn_cost_period_lifecycle_tick(date) from public, anon, authenticated;
-- Integration (separate later step, NOT in this draft): job 60 request fn calls tick first; returns PERIOD_HOLDS_APPROVED_RUN gracefully.
