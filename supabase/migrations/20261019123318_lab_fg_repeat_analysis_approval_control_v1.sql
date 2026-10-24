-- backfilled from live schema_migrations on 2026-10-24, CI-016

create table lab.repeat_analysis_authorization (
 id bigint generated always as identity primary key,
 bmr_id integer not null references public.bmr_details(id),
 prior_analysis_id bigint not null references lab.analysis_record(id),
 reason text not null check(length(btrim(reason))>=15),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','REJECTED','CONSUMED')),
 requested_by uuid not null, requested_at timestamptz not null default now(),
 decided_by uuid,decided_at timestamptz,decision_remarks text,expires_at timestamptz,
 consumed_analysis_id bigint unique,consumed_at timestamptz
);
create unique index uq_lab_repeat_approval_open on lab.repeat_analysis_authorization(bmr_id) where status in ('REQUESTED','APPROVED');
alter table lab.analysis_record add column repeat_authorization_id bigint references lab.repeat_analysis_authorization(id);
alter table lab.workflow_action_master drop constraint chk_lab_workflow_action_code;
alter table lab.workflow_action_master add constraint chk_lab_workflow_action_code check (action_code in ('RECEIVE_SAMPLE','ENTER_RESULT','CREATE_REFERENCE_EXCEPTION','SUBMIT_FOR_SCRUTINY','RETURN_FOR_CORRECTION','PASS_SCRUTINY','APPROVE_FOR_COA','REOPEN_AFTER_APPROVAL','ISSUE_COA','REVIEW_SPEC_CHANGE_REQUEST','APPROVE_REPEAT_ANALYSIS'));
insert into lab.workflow_action_master(action_code,action_name,description,is_active) values ('APPROVE_REPEAT_ANALYSIS','Approve Repeat Analysis','Governed authorization to re-analyse an FG batch',true);
insert into lab.staff_role_action_map(role_id,action_id,is_allowed) select r.id,a.id,true from lab.staff_role r cross join lab.workflow_action_master a where r.role_code='PERSON_IN_CHARGE' and a.action_code='APPROVE_REPEAT_ANALYSIS';
create function lab.fn_request_repeat_analysis(p_bmr_id integer,p_reason text) returns bigint
language plpgsql security definer set search_path='pg_catalog','lab','public','pg_temp' as $$
declare u uuid:=auth.uid(); old_id bigint; result bigint;
begin
 if u is null or not lab.fn_user_has_workflow_action(u,'RECEIVE_SAMPLE') then raise exception 'Not permitted to request repeat analysis';end if;
 if length(btrim(coalesce(p_reason,'')))<15 then raise exception 'Justification must contain at least 15 characters';end if;
 perform pg_advisory_xact_lock(hashtextextended('LAB_ACTIVE_FG_BMR:'||p_bmr_id::text,0));
 select id into old_id from lab.analysis_record where bmr_id=p_bmr_id and analysis_subject_type='FG_BATCH' and status in ('SCRUTINY_PASSED','APPROVED_FOR_COA','COA_GENERATED') order by created_at desc,id desc limit 1;
 if old_id is null then raise exception 'No completed analysis found';end if;
 if exists(select 1 from lab.analysis_record where bmr_id=p_bmr_id and analysis_subject_type='FG_BATCH' and not lab.fn_analysis_status_is_terminal(status)) then raise exception 'An active analysis already exists';end if;
 insert into lab.repeat_analysis_authorization(bmr_id,prior_analysis_id,reason,requested_by) values(p_bmr_id,old_id,p_reason,u) returning id into result;
 return result;
end $$;
create function lab.fn_decide_repeat_analysis(p_request_id bigint,p_approve boolean,p_remarks text) returns text
language plpgsql security definer set search_path='pg_catalog','lab','public','pg_temp' as $$
declare u uuid:=auth.uid(); r lab.repeat_analysis_authorization%rowtype; decision text;
begin
 if u is null or not lab.fn_user_has_workflow_action(u,'APPROVE_REPEAT_ANALYSIS') then raise exception 'Not authorized to approve repeat analysis';end if;
 if length(btrim(coalesce(p_remarks,'')))<10 then raise exception 'Decision justification must contain at least 10 characters';end if;
 select * into r from lab.repeat_analysis_authorization where id=p_request_id for update;
 if not found or r.status<>'REQUESTED' then raise exception 'Not a pending request';end if;
 if r.requested_by=u then raise exception 'Self-approval prohibited';end if;
 decision:=case when p_approve then 'APPROVED' else 'REJECTED' end;
 update lab.repeat_analysis_authorization set status=decision,decided_by=u,decided_at=now(),decision_remarks=p_remarks,expires_at=case when p_approve then now()+interval '7 days' else null end where id=p_request_id;
 return decision;
end $$;
create function lab.trg_guard_repeat_analysis() returns trigger language plpgsql set search_path='pg_catalog','lab','public','pg_temp' as $$
declare prior bigint; approval_id bigint; approver uuid; requester uuid;
begin
 if new.analysis_subject_type<>'FG_BATCH' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('LAB_ACTIVE_FG_BMR:'||new.bmr_id::text,0));
 select id into prior from lab.analysis_record where analysis_subject_type='FG_BATCH' and bmr_id=new.bmr_id and status in ('SCRUTINY_PASSED','APPROVED_FOR_COA','COA_GENERATED') order by created_at desc,id desc limit 1;
 if prior is null then return new;end if;
 if new.repeat_authorization_id is null then
  begin new.repeat_authorization_id:=nullif(current_setting('lab.repeat_authorization_id',true),'')::bigint; exception when others then new.repeat_authorization_id:=null;end;
 end if;
 select id,decided_by,requested_by into approval_id,approver,requester
 from lab.repeat_analysis_authorization where id=new.repeat_authorization_id and bmr_id=new.bmr_id and prior_analysis_id=prior and status='APPROVED' and expires_at>now() and consumed_at is null for update;
 if approval_id is null or requester is distinct from auth.uid() or requester=approver then
 raise exception using errcode='23514',message='Repeat FG analysis requires approved administrative authorization',detail=format('bmr_id=%s; previous_analysis_id=%s',new.bmr_id,prior),hint='Request repeat analysis approval before registering this sample.';
 end if;
 return new;
end $$;
create trigger trg_analysis_record_zy_repeat_gate before insert on lab.analysis_record for each row execute function lab.trg_guard_repeat_analysis();
create function lab.trg_consume_repeat_analysis() returns trigger language plpgsql set search_path='pg_catalog','lab','public','pg_temp' as $$
begin
 if new.repeat_authorization_id is not null then
 update lab.repeat_analysis_authorization set status='CONSUMED',consumed_analysis_id=new.id,consumed_at=now() where id=new.repeat_authorization_id and status='APPROVED' and expires_at>now();
 if not found then raise exception 'Repeat authorization not consumable';end if;
 end if;
 return new;
end $$;
create trigger trg_analysis_record_after_repeat_consume after insert on lab.analysis_record for each row execute function lab.trg_consume_repeat_analysis();
create function lab.fn_receive_repeat_sample(p_request_id bigint,p_sample_received_date date,p_physical_register_ref text,p_analysed_by_staff_id bigint,p_person_in_charge_staff_id bigint,p_remarks text default null)
returns table(analysis_id bigint,analysis_register_no text,status text)
language plpgsql security definer set search_path='pg_catalog','lab','public','pg_temp' as $$
declare r lab.repeat_analysis_authorization%rowtype; u uuid:=auth.uid(); pid bigint; bn text;
begin
 if u is null or not lab.fn_user_has_workflow_action(u,'RECEIVE_SAMPLE') then raise exception 'Not permitted to register sample';end if;
 select * into r from lab.repeat_analysis_authorization where id=p_request_id and status='APPROVED' and expires_at>now() and requested_by=u for update;
 if not found then raise exception 'No valid approved repeat-analysis request for user';end if;
 select product_id,bn into pid,bn from public.bmr_details where id=r.bmr_id;
 perform set_config('lab.repeat_authorization_id',p_request_id::text,true);
 return query select * from lab.fn_receive_sample_and_create_analysis(u,'FG_BATCH',p_sample_received_date,p_physical_register_ref,p_analysed_by_staff_id,p_person_in_charge_staff_id,pid,bn,null,null,p_remarks);
 perform set_config('lab.repeat_authorization_id','',true);
end $$;
revoke all on lab.repeat_analysis_authorization from anon,authenticated;
revoke all on function lab.fn_request_repeat_analysis(integer,text) from public,anon;
revoke all on function lab.fn_decide_repeat_analysis(bigint,boolean,text) from public,anon;
revoke all on function lab.fn_receive_repeat_sample(bigint,date,text,bigint,bigint,text) from public,anon;
grant execute on function lab.fn_request_repeat_analysis(integer,text) to authenticated;
grant execute on function lab.fn_decide_repeat_analysis(bigint,boolean,text) to authenticated;
grant execute on function lab.fn_receive_repeat_sample(bigint,date,text,bigint,bigint,text) to authenticated;
