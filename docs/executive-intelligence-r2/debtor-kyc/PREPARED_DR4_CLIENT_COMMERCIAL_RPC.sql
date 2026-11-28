-- DR4: public invoker entry points, private explicitly authorized implementation.
-- All KYC/terms writes remain RPC-only; no direct client DML.
create function public.ei_debtor_save_v1(p_id bigint,p_revision bigint,p_class jsonb,p_profile jsonb,p_action text,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
 select app_private.ei_debtor_save(p_id,p_revision,p_class,p_profile,p_action,p_reason)
$$;
grant execute on function app_private.ei_debtor_save(bigint,bigint,jsonb,jsonb,text,text) to authenticated;
revoke all on function public.ei_debtor_save_v1(bigint,bigint,jsonb,jsonb,text,text) from public,anon;
grant execute on function public.ei_debtor_save_v1(bigint,bigint,jsonb,jsonb,text,text) to authenticated;
-- Private helper performs explicit identity and permission checks even if directly invoked.
create function app_private.ei_debtor_require(p_role text,p_mode text) returns void
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
 or not coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false)
 or (p_role is not null and not coalesce(public.app_has_permission(p_role,p_mode),false)) then
 raise exception 'Debtor access denied' using errcode='42501'; end if;
end $$;
revoke all on function app_private.ei_debtor_require(text,text) from public,anon,authenticated;
-- Master maintenance, append only (no destructive geography reparenting).
create function app_private.ei_debtor_master_add(p_kind text,p_data jsonb,p_reason text) returns bigint
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id bigint;
begin
 perform app_private.ei_debtor_require('role:ei-debtor-kyc','edit');
 if nullif(btrim(p_reason),'') is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Reason and data required' using errcode='22023'; end if;
 case p_kind
 when 'district' then insert into public.ei_debtor_district(region_id,state_name,district_name) values((p_data->>'region_id')::int,btrim(p_data->>'state_name'),btrim(p_data->>'district_name')) returning id into v_id;
 when 'coverage' then insert into public.ei_debtor_godown_district(godown_id,district_id) values((p_data->>'godown_id')::int,(p_data->>'district_id')::bigint) returning district_id into v_id;
 when 'area' then insert into public.ei_debtor_area(district_id,area_name) values((p_data->>'district_id')::bigint,btrim(p_data->>'area_name')) returning id into v_id;
 when 'type' then insert into public.ei_debtor_type(code,name,definition) values(upper(btrim(p_data->>'code')),btrim(p_data->>'name'),btrim(p_data->>'definition')) returning id into v_id;
 else raise exception 'Unknown master kind' using errcode='22023'; end case;
 insert into public.ei_debtor_audit(entity_name,entity_id,operation,actor_user_id,new_record) values('master:'||p_kind,v_id,'ADD',auth.uid(),jsonb_build_object('reason',p_reason,'data',p_data));
 return v_id;
end $$;
create function public.ei_debtor_master_add_v1(p_kind text,p_data jsonb,p_reason text) returns bigint language sql security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_master_add(p_kind,p_data,p_reason)$$;
-- Register a new ledger only when present in the source, serialize on normalized key.
create function app_private.ei_debtor_register(p_party text,p_reason text) returns bigint
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_key text:=lower(btrim(p_party)); v_id bigint;
begin
 perform app_private.ei_debtor_require('role:ei-debtor-kyc','edit');
 if nullif(v_key,'') is null or nullif(btrim(p_reason),'') is null then raise exception 'Party and reason required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ei-debtor:'||v_key,0));
 select debtor_id into v_id from public.ei_debtor_alias where party_key=v_key;
 if found then return v_id; end if;
 if not exists(select 1 from public.tally_group_outstanding_snapshot where group_name='Sundry Debtors' and lower(btrim(vendor_name))=v_key) then raise exception 'Unknown Tally debtor' using errcode='22023'; end if;
 insert into public.ei_debtor(ledger_name) values(btrim(p_party)) returning id into v_id;
 insert into public.ei_debtor_alias values(v_key,v_id,btrim(p_party));
 insert into public.ei_debtor_audit(entity_name,entity_id,operation,actor_user_id,new_record) values('registration',v_id,'ADD',auth.uid(),jsonb_build_object('reason',p_reason));
 return v_id;
end $$;
create function public.ei_debtor_register_v1(p_party text,p_reason text) returns bigint language sql security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_register(p_party,p_reason)$$;
-- Effective terms serialized on policy identity; close previous open interval only when
-- appending a later policy. No retrospective overwrite of existing policy history.
create function app_private.ei_debtor_terms_set(p_debtor bigint,p_type bigint,p_region integer,p_discount numeric,p_scheme bigint,p_from date,p_reason text) returns bigint
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id bigint; v_last date; v_end date;
begin
 perform app_private.ei_debtor_require('role:ei-debtor-commercial','edit');
 if p_from is null or not isfinite(p_from) or nullif(btrim(p_reason),'') is null or (p_discount is null and p_scheme is null) or (p_discount is not null and p_discount not between 0 and 100) then raise exception 'Invalid terms' using errcode='22023'; end if;
 if p_scheme is not null and not exists(select 1 from costing.scheme_master where id=p_scheme and is_active) then raise exception 'Inactive scheme' using errcode='22023'; end if;
 if p_debtor is not null then
 if p_type is not null or p_region is not null then raise exception 'Mixed policy scope' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ei-debtor-terms:'||p_debtor,0));
 select effective_from,effective_to into v_last,v_end from public.ei_debtor_terms_override where debtor_id=p_debtor order by effective_from desc limit 1;
 if v_last is not null and (p_from<=v_last or (v_end is not null and p_from<v_end)) then raise exception 'Overlapping terms' using errcode='22023'; end if;
 update public.ei_debtor_terms_override set effective_to=p_from where debtor_id=p_debtor and effective_to is null;
 insert into public.ei_debtor_terms_override(debtor_id,discount_percent,scheme_id,effective_from,reason) values(p_debtor,p_discount,p_scheme,p_from,p_reason) returning id into v_id;
 else
 if p_type is null or p_region is null then raise exception 'Type and region required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ei-type-terms:'||p_type||':'||p_region,0));
 select effective_from,effective_to into v_last,v_end from public.ei_debtor_type_terms where type_id=p_type and region_id=p_region order by effective_from desc limit 1;
 if v_last is not null and (p_from<=v_last or (v_end is not null and p_from<v_end)) then raise exception 'Overlapping terms' using errcode='22023'; end if;
 update public.ei_debtor_type_terms set effective_to=p_from where type_id=p_type and region_id=p_region and effective_to is null;
 insert into public.ei_debtor_type_terms(type_id,region_id,discount_percent,scheme_id,effective_from,reason) values(p_type,p_region,p_discount,p_scheme,p_from,p_reason) returning id into v_id;
 end if; return v_id;
end $$;
create function public.ei_debtor_terms_set_v1(p_debtor bigint,p_type bigint,p_region integer,p_discount numeric,p_scheme bigint,p_from date,p_reason text) returns bigint language sql security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_terms_set(p_debtor,p_type,p_region,p_discount,p_scheme,p_from,p_reason)$$;
create function app_private.ei_debtor_terms_get(p_id bigint,p_date date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v jsonb;
begin
 perform app_private.ei_debtor_require('role:ei-debtor-commercial','view');
 if p_date is null or not isfinite(p_date) then raise exception 'Invalid date' using errcode='22023'; end if;
 select jsonb_build_object('discount_percent',coalesce(o.discount_percent,t.discount_percent),'discount_source',case when o.discount_percent is not null then 'OVERRIDE' when t.discount_percent is not null then 'TYPE' else 'UNCONFIGURED' end,'scheme_id',coalesce(o.scheme_id,t.scheme_id),'scheme_source',case when o.scheme_id is not null then 'OVERRIDE' when t.scheme_id is not null then 'TYPE' else 'UNCONFIGURED' end,'scheme_active',s.is_active,'scheme_name',s.scheme_name)
 into v from public.ei_debtor d left join public.ei_debtor_classification c on c.debtor_id=d.id
 left join lateral(select * from public.ei_debtor_terms_override where debtor_id=d.id and effective_from<=p_date and (effective_to is null or effective_to>p_date) order by effective_from desc limit 1)o on true
 left join lateral(select * from public.ei_debtor_type_terms where type_id=c.type_id and region_id=c.region_id and effective_from<=p_date and (effective_to is null or effective_to>p_date) order by effective_from desc limit 1)t on true
 left join costing.scheme_master s on s.id=coalesce(o.scheme_id,t.scheme_id) where d.id=p_id;
 return v;
end $$;
create function public.ei_debtor_terms_get_v1(p_id bigint,p_date date) returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_terms_get(p_id,p_date)$$;
-- Safe status-only helper; no profile fields exposed.
grant execute on function app_private.ei_debtor_status(bigint) to authenticated;
create function public.ei_debtor_status_v1(p_id bigint) returns text language sql stable security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_status(p_id)$$;
-- Scope grants exact signatures, no schema-wide grants.
do $$
declare sig text;
begin
 foreach sig in array array['app_private.ei_debtor_master_add(text,jsonb,text)','public.ei_debtor_master_add_v1(text,jsonb,text)','app_private.ei_debtor_register(text,text)','public.ei_debtor_register_v1(text,text)','app_private.ei_debtor_terms_set(bigint,bigint,integer,numeric,bigint,date,text)','public.ei_debtor_terms_set_v1(bigint,bigint,integer,numeric,bigint,date,text)','app_private.ei_debtor_terms_get(bigint,date)','public.ei_debtor_terms_get_v1(bigint,date)','public.ei_debtor_status_v1(bigint)'] loop
 execute 'revoke all on function '||sig||' from public,anon,authenticated';
 execute 'grant execute on function '||sig||' to authenticated';
 end loop;
end $$;
