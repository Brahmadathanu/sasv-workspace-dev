-- Live applied via Supabase migration costing_monthend_owner_finalization_atomic_20261021
CREATE OR REPLACE FUNCTION public.rpc_costing_finalize_monthend_run(p_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_run costing.costing_refresh_run%rowtype; v_period costing.cost_periods%rowtype; v_approved bigint; v_result jsonb; v_lock jsonb;
begin
 perform public.require_permission('module:costing-control-center',true);
 perform costing.fn_w2_owner_name();
 perform costing.fn_w2_require_text(p_reason,p_approval_reference);
 select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
 if not found then raise exception 'MONTHEND_RUN_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||v_run.period_start::text,0));
 select * into v_period from costing.cost_periods where period_start=v_run.period_start for update;
 if not found or v_period.status<>'OPEN' or v_period.valuation_date_status<>'DRAFT' then raise exception 'MONTHEND_PERIOD_NOT_OPEN'; end if;
 if costing.fn_india_business_date() <= v_period.period_end then raise exception 'MONTHEND_PERIOD_NOT_FINISHED'; end if;
 if v_run.valuation_date is distinct from v_period.period_end or v_period.valuation_date is distinct from v_period.period_end then raise exception 'MONTHEND_VALUATION_DATE_MISMATCH'; end if;
 select refresh_run_id into v_approved from costing.v_costing_run_effective_designation where period_start=v_run.period_start and designation='APPROVED' order by designated_at desc limit 1;
 if v_approved=p_refresh_run_id then
  v_result:=jsonb_build_object('already_approved',p_refresh_run_id);
 elsif v_approved is null then
  v_result:=public.rpc_costing_approve_run(p_refresh_run_id,p_reason,p_approval_reference);
 else
  v_result:=public.rpc_costing_supersede_approved_run(p_refresh_run_id,p_reason,p_approval_reference);
 end if;
 v_lock:=public.rpc_costing_lock_period(v_run.period_start,'Month-end approved closure: '||p_reason,p_approval_reference);
 return jsonb_build_object('approval',v_result,'lock',v_lock);
end $function$
;
REVOKE ALL ON FUNCTION public.rpc_costing_finalize_monthend_run(bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_costing_finalize_monthend_run(bigint,text,text) TO authenticated;
