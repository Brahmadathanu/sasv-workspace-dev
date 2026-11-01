-- backfilled from live schema_migrations on 2026-10-24, CI-016

create function lab.fn_get_repeat_analysis_context(p_bmr_id integer)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','lab','public','pg_temp' as $$
declare u uuid:=auth.uid(); prior jsonb; request_data jsonb; existing jsonb;
begin
 if u is null or (not lab.fn_user_has_workflow_action(u,'RECEIVE_SAMPLE') and not lab.fn_user_has_workflow_action(u,'APPROVE_REPEAT_ANALYSIS')) then raise exception 'Not authorized to view repeat-analysis context';end if;
 select jsonb_build_object('analysis_id',id,'analysis_register_no',analysis_register_no,'status',status,'batch_no',batch_no_snapshot)
 into prior from lab.analysis_record where analysis_subject_type='FG_BATCH' and bmr_id=p_bmr_id and status in ('SCRUTINY_PASSED','APPROVED_FOR_COA','COA_GENERATED') order by created_at desc,id desc limit 1;
 select jsonb_build_object('analysis_id',id,'analysis_register_no',analysis_register_no,'status',status)
 into existing from lab.analysis_record where analysis_subject_type='FG_BATCH' and bmr_id=p_bmr_id and not lab.fn_analysis_status_is_terminal(status) order by created_at desc,id desc limit 1;
 select jsonb_build_object('id',id,'status',status,'reason',reason,'requested_at',requested_at,'decided_at',decided_at,'decision_remarks',decision_remarks,'expires_at',expires_at)
 into request_data from lab.repeat_analysis_authorization where bmr_id=p_bmr_id and (requested_by=u or lab.fn_user_has_workflow_action(u,'APPROVE_REPEAT_ANALYSIS')) order by requested_at desc,id desc limit 1;
 return jsonb_build_object('bmr_id',p_bmr_id,'prior_completed_analysis',prior,'active_analysis',existing,'latest_visible_request',request_data,'repeat_approval_required',prior is not null);
end $$;
create function lab.fn_list_repeat_analysis_requests(p_status text default 'REQUESTED')
returns table(id bigint,bmr_id integer,batch_no text,product_name text,prior_analysis_register_no text,reason text,status text,requested_at timestamptz,expires_at timestamptz)
language plpgsql stable security definer set search_path='pg_catalog','lab','public','pg_temp' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not lab.fn_user_has_workflow_action(u,'APPROVE_REPEAT_ANALYSIS') then raise exception 'Not authorized to review repeat-analysis requests';end if;
 return query select r.id,r.bmr_id,b.bn,p.item,ar.analysis_register_no,r.reason,r.status,r.requested_at,r.expires_at
 from lab.repeat_analysis_authorization r join public.bmr_details b on b.id=r.bmr_id join public.products p on p.id=b.product_id join lab.analysis_record ar on ar.id=r.prior_analysis_id
 where p_status is null or r.status=p_status order by r.requested_at desc,r.id desc limit 250;
end $$;
revoke all on function lab.fn_get_repeat_analysis_context(integer) from public,anon;
revoke all on function lab.fn_list_repeat_analysis_requests(text) from public,anon;
grant execute on function lab.fn_get_repeat_analysis_context(integer) to authenticated;
grant execute on function lab.fn_list_repeat_analysis_requests(text) to authenticated;
