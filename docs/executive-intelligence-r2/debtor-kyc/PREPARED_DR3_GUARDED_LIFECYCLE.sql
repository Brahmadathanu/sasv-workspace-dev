-- Candidate DR3: invoker RLS, guarded lifecycle, current reporting.
-- No change to existing Finance RPCs.
create function public.ei_debtor_classification_valid(p_debtor_id bigint)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select exists(select 1 from public.ei_debtor_classification c
 join public.godowns g on g.id=c.godown_id and g.region_id=c.region_id
 join public.ei_debtor_district d on d.id=c.district_id and d.region_id=c.region_id and d.is_active
 join public.ei_debtor_godown_district gd on gd.godown_id=g.id and gd.district_id=d.id
 join public.ei_debtor_area a on a.id=c.area_id and a.district_id=d.id and a.is_active
 join public.ei_debtor_type t on t.id=c.type_id and t.is_active
 where c.debtor_id=p_debtor_id)
$$;
create function public.ei_debtor_check_hierarchy() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if TG_TABLE_NAME='ei_debtor_godown_district' then
  if not exists(select 1 from public.godowns g join public.ei_debtor_district d on d.region_id=g.region_id where g.id=new.godown_id and d.id=new.district_id) then raise exception 'Cross-region coverage' using errcode='23514'; end if;
 else
  if new.godown_id is not null and not exists(select 1 from public.godowns g where g.id=new.godown_id and g.region_id=new.region_id) then raise exception 'Godown region mismatch' using errcode='23514'; end if;
  if new.district_id is not null and not exists(select 1 from public.ei_debtor_district d where d.id=new.district_id and d.region_id=new.region_id and d.is_active) then raise exception 'District invalid' using errcode='23514'; end if;
  if new.area_id is not null and not exists(select 1 from public.ei_debtor_area a where a.id=new.area_id and a.district_id=new.district_id and a.is_active) then raise exception 'Area invalid' using errcode='23514'; end if;
  if new.type_id is not null and not exists(select 1 from public.ei_debtor_type t where t.id=new.type_id and t.is_active) then raise exception 'Type inactive' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger ei_debtor_coverage_guard before insert or update on public.ei_debtor_godown_district for each row execute function public.ei_debtor_check_hierarchy();
create trigger ei_debtor_class_guard before insert or update on public.ei_debtor_classification for each row execute function public.ei_debtor_check_hierarchy();
-- Private audit function; only trigger invocation, no client execute privilege.
create function app_private.ei_debtor_audit_write() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 insert into public.ei_debtor_audit(entity_name,operation,actor_user_id,old_record,new_record)
 values(TG_TABLE_NAME,TG_OP,auth.uid(),case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end);
 return null;
end $$;
revoke all on function app_private.ei_debtor_audit_write() from public,anon,authenticated;
-- Explicit policies: public classification is report metadata; personal profile restricted.
do $$
declare t text;
begin
 foreach t in array array['ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type','ei_debtor','ei_debtor_alias','ei_debtor_classification'] loop
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy ei_debtor_report_read on public.%I for select to authenticated using (public.ei_can_read_executive())',t);
 end loop;
end $$;
-- Profile access separate; status only is exposed through the report helper.
grant select on public.ei_debtor_kyc to authenticated,service_role;
create policy ei_debtor_kyc_read on public.ei_debtor_kyc for select to authenticated using (public.ei_can_access_debtor_kyc('view') or public.ei_can_access_debtor_kyc('edit'));
-- Status helper does not expose profile or allow privileged bypass of EI gate.
create function app_private.ei_debtor_status(p_id bigint) returns text language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare s text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) then raise exception 'Access denied' using errcode='42501'; end if;
 select lifecycle_status into s from public.ei_debtor_kyc where debtor_id=p_id;
 return coalesce(s,'DRAFT');
end $$;
revoke all on function app_private.ei_debtor_status(bigint) from public,anon,authenticated;
-- Private mutation entry, called only through a separately authorized wrapper.
create function app_private.ei_debtor_save(p_id bigint,p_revision bigint,p_class jsonb,p_profile jsonb,p_action text,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare k public.ei_debtor_kyc%rowtype; c public.ei_debtor_classification%rowtype; v_actor uuid:=auth.uid(); v_next text;
begin
 if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' or not coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) or not coalesce(public.app_has_permission('role:ei-debtor-kyc','edit'),false) then raise exception 'KYC editor required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('SAVE','ACTIVATE','INACTIVATE') or nullif(btrim(p_reason),'') is null or p_revision is null then raise exception 'Invalid action, reason or revision' using errcode='22023'; end if;
 perform 1 from public.ei_debtor where id=p_id for update;
 if not found then raise exception 'Unknown debtor' using errcode='22023'; end if;
 select * into k from public.ei_debtor_kyc where debtor_id=p_id;
 if coalesce(k.revision,0)<>p_revision then raise exception 'Stale revision' using errcode='40001'; end if;
 v_next:=coalesce(k.lifecycle_status,'DRAFT');
 if p_action='ACTIVATE' and v_next='ACTIVE' or p_action='INACTIVATE' and v_next<>'ACTIVE' then raise exception 'Invalid transition' using errcode='22023'; end if;
 if p_action='INACTIVATE' and (p_class is not null or p_profile is not null) then raise exception 'Inactivate separately from edits' using errcode='22023'; end if;
 if p_class is not null then
  if jsonb_typeof(p_class)<>'object' then raise exception 'Invalid classification' using errcode='22023'; end if;
  c:=jsonb_populate_record(null::public.ei_debtor_classification,p_class);
  insert into public.ei_debtor_classification(debtor_id,region_id,godown_id,district_id,area_id,type_id,reason,updated_by)
  values(p_id,c.region_id,c.godown_id,c.district_id,c.area_id,c.type_id,p_reason,v_actor)
  on conflict(debtor_id) do update set region_id=excluded.region_id,godown_id=excluded.godown_id,district_id=excluded.district_id,area_id=excluded.area_id,type_id=excluded.type_id,reason=excluded.reason,updated_by=v_actor,updated_at=now(),revision=ei_debtor_classification.revision+1;
 end if;
 if p_action='ACTIVATE' then v_next:='ACTIVE'; elsif p_action='INACTIVATE' then v_next:='INACTIVE'; end if;
 if v_next='ACTIVE' and not public.ei_debtor_classification_valid(p_id) then raise exception 'Complete valid region, godown, district, area and debtor type required' using errcode='23514'; end if;
 if p_profile is not null then
  if jsonb_typeof(p_profile)<>'object' then raise exception 'Invalid profile' using errcode='22023'; end if;
  k:=jsonb_populate_record(k,p_profile - array['debtor_id','lifecycle_status','revision','status_reason','activated_at','activated_by','inactivated_at','inactivated_by','updated_at','updated_by','verification_status']);
 end if;
 insert into public.ei_debtor_kyc(debtor_id,business_name,contact_person,phone,alternate_phone,email,address_line_1,address_line_2,locality,postal_code,state_name,country_name,gstin,notes,lifecycle_status,revision,status_reason,activated_at,activated_by,inactivated_at,inactivated_by,updated_by)
 values(p_id,k.business_name,k.contact_person,k.phone,k.alternate_phone,k.email,k.address_line_1,k.address_line_2,k.locality,k.postal_code,k.state_name,k.country_name,k.gstin,k.notes,v_next,p_revision+1,p_reason,
 case when p_action='ACTIVATE' then now() else k.activated_at end,case when p_action='ACTIVATE' then v_actor else k.activated_by end,
 case when p_action='INACTIVATE' then now() when p_action='ACTIVATE' then null else k.inactivated_at end,case when p_action='INACTIVATE' then v_actor when p_action='ACTIVATE' then null else k.inactivated_by end,v_actor)
 on conflict(debtor_id) do update set business_name=excluded.business_name,contact_person=excluded.contact_person,phone=excluded.phone,alternate_phone=excluded.alternate_phone,email=excluded.email,address_line_1=excluded.address_line_1,address_line_2=excluded.address_line_2,locality=excluded.locality,postal_code=excluded.postal_code,state_name=excluded.state_name,country_name=excluded.country_name,gstin=excluded.gstin,notes=excluded.notes,lifecycle_status=excluded.lifecycle_status,revision=excluded.revision,status_reason=excluded.status_reason,activated_at=excluded.activated_at,activated_by=excluded.activated_by,inactivated_at=excluded.inactivated_at,inactivated_by=excluded.inactivated_by,updated_by=v_actor,updated_at=now();
 return jsonb_build_object('debtor_id',p_id,'revision',p_revision+1,'status',v_next,'classification_valid',public.ei_debtor_classification_valid(p_id));
end $$;
revoke all on function app_private.ei_debtor_save(bigint,bigint,jsonb,jsonb,text,text) from public,anon,authenticated;
-- Do not expose private functions until wrapper grants and negative role tests are complete.
do $$
declare t text;
begin
 foreach t in array array['ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type','ei_debtor','ei_debtor_alias','ei_debtor_classification','ei_debtor_kyc','ei_debtor_type_terms','ei_debtor_terms_override'] loop
 execute format('create trigger ei_debtor_audit after insert or update or delete on public.%I for each row execute function app_private.ei_debtor_audit_write()',t);
 end loop;
end $$;
revoke all on function public.ei_debtor_classification_valid(bigint) from public,anon;
grant execute on function public.ei_debtor_classification_valid(bigint) to authenticated,service_role;
revoke all on function public.ei_debtor_check_hierarchy() from public,anon,authenticated;
