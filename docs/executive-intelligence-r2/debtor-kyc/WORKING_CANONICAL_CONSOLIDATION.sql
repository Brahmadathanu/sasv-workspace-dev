-- CANONICAL CONSOLIDATION WORKTREE ONLY. NOT READY FOR DEPLOYMENT.
-- DR1–DR6 combined to remove _v1 RPC identities. Further Finance/Alerts integration and security hardening required.
-- Deliberately NOT registered as production migration.

-- ==== PREPARED_DR1_FOUNDATION.sql ====
-- PREPARED ONLY: review and test before migration registration.
-- Existing region/godown and costing.scheme_master are authoritative.
create table public.ei_debtor_district (
 id bigint generated always as identity primary key,
 region_id integer not null references public.regions(id),
 state_name text not null check (btrim(state_name)<>''),
 district_name text not null check (btrim(district_name)<>''),
 is_active boolean not null default true
);
create unique index ei_debtor_district_identity on public.ei_debtor_district(region_id,lower(btrim(state_name)),lower(btrim(district_name)));
create table public.ei_debtor_godown_district (
 godown_id integer not null references public.godowns(id),
 district_id bigint not null references public.ei_debtor_district(id),
 primary key(godown_id,district_id)
);
create table public.ei_debtor_area (
 id bigint generated always as identity primary key,
 district_id bigint not null references public.ei_debtor_district(id),
 area_name text not null check(btrim(area_name)<>''),
 is_active boolean not null default true,
 unique(id,district_id)
);
create unique index ei_debtor_area_identity on public.ei_debtor_area(district_id,lower(btrim(area_name)));
create table public.ei_debtor_type (
 id bigint generated always as identity primary key,
 code text not null unique,
 name text not null unique,
 definition text not null check(btrim(definition)<>''),
 is_active boolean not null default true
);
insert into public.ei_debtor_type(code,name,definition,is_active) values
 ('AGENCY','Agency','Authorized retail sales outlet operating under an agency arrangement.',true),
 ('NON_AGENCY','Non-agency','Retail customer without an agency arrangement.',true),
 ('DEALER','Dealer','Independent reseller purchasing goods for resale.',true),
 ('DISTRIBUTOR','Distributor','Commercial intermediary supplying a network of downstream resellers.',true),
 ('OTC','OTC Seller','Outlet primarily selling over-the-counter products.',true),
 ('SPECIAL','Special Scheme','Customer covered by a separately approved commercial arrangement.',false),
 ('STAFF','Staff','Employee account for authorized staff purchases.',true),
 ('STALL','Celebration Stalls','Temporary outlet operated for an event or celebration.',false),
 ('STAR_AGENCY','Star Agency','Agency designated under a separately approved premium agency category.',false),
 ('SUPERMARKET','Supermarket','Organized retail store selling a broad range of consumer goods.',true),
 ('DOCTOR','Doctor','Medical practitioner purchasing products under an approved practitioner account.',true),
 ('SUPER_STOCKIST','Super Stockist','Intermediary holding stock and supplying distributors or dealers over a defined territory.',true);
insert into public.ei_debtor_district(region_id,state_name,district_name)
select r.id,'Kerala',x.name from public.regions r cross join (values ('Thiruvananthapuram'),('Kollam'),('Pathanamthitta'),('Alappuzha'),('Kottayam'),('Idukki'),('Ernakulam'),('Thrissur'),('Palakkad'),('Malappuram'),('Kozhikode'),('Wayanad'),('Kannur'),('Kasaragod')) x(name) where r.code='IK';
-- No unverified godown coverage, areas, debtor types or discounts are assigned.
create table public.ei_debtor (
 id bigint generated always as identity primary key,
 ledger_name text not null check(btrim(ledger_name)<>''),
 tally_guid text unique,
 created_at timestamptz not null default now()
);
create table public.ei_debtor_alias (
 party_key text primary key check(party_key=lower(btrim(party_key)) and party_key<>''),
 debtor_id bigint not null references public.ei_debtor(id),
 source_name text not null
);
create table public.ei_debtor_classification (
 debtor_id bigint primary key references public.ei_debtor(id),
 region_id integer references public.regions(id),
 godown_id integer references public.godowns(id),
 district_id bigint references public.ei_debtor_district(id),
 area_id bigint,
 type_id bigint references public.ei_debtor_type(id),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid,
 reason text not null check(btrim(reason)<>''),
 foreign key(godown_id,district_id) references public.ei_debtor_godown_district(godown_id,district_id),
 foreign key(area_id,district_id) references public.ei_debtor_area(id,district_id),
 check(godown_id is null or region_id is not null),
 check(district_id is null or godown_id is not null),
 check(area_id is null or district_id is not null)
);
create table public.ei_debtor_kyc (
 debtor_id bigint primary key references public.ei_debtor(id),
 business_name text, contact_person text, phone text, alternate_phone text, email text,
 address_line_1 text, address_line_2 text, locality text, postal_code text, state_name text, country_name text,
 gstin text, verification_status text not null default 'UNVERIFIED' check(verification_status in ('UNVERIFIED','VERIFIED','REVIEW')),
 notes text, updated_at timestamptz not null default now(), updated_by uuid
);
create table public.ei_debtor_type_terms (
 id bigint generated always as identity primary key,
 type_id bigint not null references public.ei_debtor_type(id),
 region_id integer not null references public.regions(id),
 discount_percent numeric check(discount_percent between 0 and 100),
 scheme_id bigint references costing.scheme_master(id),
 effective_from date not null, effective_to date,
 reason text not null check(btrim(reason)<>''),
 check(effective_to is null or effective_to>effective_from),
 unique(type_id,region_id,effective_from)
);
create table public.ei_debtor_terms_override (
 id bigint generated always as identity primary key,
 debtor_id bigint not null references public.ei_debtor(id),
 discount_percent numeric check(discount_percent between 0 and 100),
 scheme_id bigint references costing.scheme_master(id),
 effective_from date not null, effective_to date,
 reason text not null check(btrim(reason)<>''),
 check(effective_to is null or effective_to>effective_from),
 check(discount_percent is not null or scheme_id is not null),
 unique(debtor_id,effective_from)
);
create table public.ei_debtor_audit (
 id bigint generated always as identity primary key,
 entity_name text not null, entity_id bigint, operation text not null,
 actor_user_id uuid, event_at timestamptz not null default now(),
 old_record jsonb,new_record jsonb
);
-- Audit contains KYC PII: no direct client grants.
do $$
declare t text;
begin
 foreach t in array array['ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type','ei_debtor','ei_debtor_alias','ei_debtor_classification','ei_debtor_kyc','ei_debtor_type_terms','ei_debtor_terms_override','ei_debtor_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
end $$;
-- Backfill only observed identity, not unsupported classifications.
insert into public.ei_debtor(ledger_name)
select min(vendor_name) from public.tally_group_outstanding_snapshot
where group_name='Sundry Debtors' and nullif(btrim(vendor_name),'') is not null
group by lower(btrim(vendor_name));
insert into public.ei_debtor_alias(party_key,debtor_id,source_name)
select lower(btrim(ledger_name)),id,ledger_name from public.ei_debtor;
-- No policies or RPC write access until authorization, temporal and audit tests pass.


-- ==== PREPARED_DR2_KYC_LIFECYCLE.sql ====
-- PREPARED DR2 lifecycle extension; apply only after DR1 and full fixture verification.
alter table public.ei_debtor_kyc
 add column lifecycle_status text not null default 'DRAFT' check(lifecycle_status in ('DRAFT','ACTIVE','INACTIVE')),
 add column revision bigint not null default 1 check(revision>0),
 add column status_reason text,
 add column activated_at timestamptz,
 add column activated_by uuid,
 add column inactivated_at timestamptz,
 add column inactivated_by uuid,
 add constraint ei_debtor_kyc_status_metadata check (
 (lifecycle_status='DRAFT' and activated_at is null and inactivated_at is null)
 or (lifecycle_status='ACTIVE' and activated_at is not null and inactivated_at is null)
 or (lifecycle_status='INACTIVE' and inactivated_at is not null and nullif(btrim(status_reason),'') is not null)
 );
-- Separate authorization; no permission assignments copied or granted.
insert into public.permission_targets(key,kind,label,is_assignable,meta)
values ('role:ei-debtor-kyc','role','Executive Intelligence — Debtor KYC',true,'{"confidential":true,"module_key":"executive-mis-dashboard"}'),
('role:ei-debtor-commercial','role','Executive Intelligence — Debtor commercial terms',true,'{"confidential":true,"module_key":"executive-mis-dashboard"}')
on conflict(key) do nothing;
create function public.ei_can_access_debtor_kyc(p_mode text)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select case when p_mode not in ('view','edit') or p_mode is null then false
 when current_user in ('postgres','service_role') then true
 else public.ei_can_read_executive() and coalesce(public.app_has_permission('role:ei-debtor-kyc',p_mode),false) end
$$;
revoke all on function public.ei_can_access_debtor_kyc(text) from public,anon;
grant execute on function public.ei_can_access_debtor_kyc(text) to authenticated,service_role;
-- Revised owner requirement: optional KYC profile fields remain SQL NULL.
-- No field-disposition JSON, magic NA/NIL values, or mandatory contact/address gate.
-- Preliminary classification presence validation; full RPC must enforce actual
-- hierarchy, active masters, mandatory area membership (commercial terms optional),
-- authorized actor, optimistic revision, audit and transactional transitions.
create function public.ei_debtor_classification_field_errors(
 p_region_id integer,p_godown_id integer,p_district_id bigint,p_area_id bigint,
 p_type_id bigint)
returns text[] language sql immutable security invoker set search_path=pg_catalog as $$
 select array_remove(array[
 case when p_region_id is null then 'region_id' end,
 case when p_godown_id is null then 'godown_id' end,
 case when p_district_id is null then 'district_id' end,
 case when p_area_id is null then 'area_id' end,
 case when p_type_id is null then 'type_id' end
 ]::text[],null)
$$;
revoke all on function public.ei_debtor_classification_field_errors(integer,integer,bigint,bigint,bigint) from public,anon,authenticated;
-- Not an activation RPC. No direct client grants or production execution.


-- ==== PREPARED_DR3_GUARDED_LIFECYCLE.sql ====
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


-- ==== PREPARED_DR4_CLIENT_COMMERCIAL_RPC.sql ====
-- DR4: public invoker entry points, private explicitly authorized implementation.
-- All KYC/terms writes remain RPC-only; no direct client DML.
create function public.ei_debtor_save(p_id bigint,p_revision bigint,p_class jsonb,p_profile jsonb,p_action text,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
 select app_private.ei_debtor_save(p_id,p_revision,p_class,p_profile,p_action,p_reason)
$$;
grant execute on function app_private.ei_debtor_save(bigint,bigint,jsonb,jsonb,text,text) to authenticated;
revoke all on function public.ei_debtor_save(bigint,bigint,jsonb,jsonb,text,text) from public,anon;
grant execute on function public.ei_debtor_save(bigint,bigint,jsonb,jsonb,text,text) to authenticated;
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
create function public.ei_debtor_master_add(p_kind text,p_data jsonb,p_reason text) returns bigint language sql security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_master_add(p_kind,p_data,p_reason)$$;
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
create function public.ei_debtor_register(p_party text,p_reason text) returns bigint language sql security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_register(p_party,p_reason)$$;
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
create function public.ei_debtor_terms_set(p_debtor bigint,p_type bigint,p_region integer,p_discount numeric,p_scheme bigint,p_from date,p_reason text) returns bigint language sql security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_terms_set(p_debtor,p_type,p_region,p_discount,p_scheme,p_from,p_reason)$$;
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
create function public.ei_debtor_terms_get(p_id bigint,p_date date) returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_terms_get(p_id,p_date)$$;
-- Safe status-only helper; no profile fields exposed.
grant execute on function app_private.ei_debtor_status(bigint) to authenticated;
create function public.ei_debtor_status(p_id bigint) returns text language sql stable security invoker set search_path=pg_catalog,public as $$select app_private.ei_debtor_status(p_id)$$;
-- Scope grants exact signatures, no schema-wide grants.
do $$
declare sig text;
begin
 foreach sig in array array['app_private.ei_debtor_master_add(text,jsonb,text)','public.ei_debtor_master_add(text,jsonb,text)','app_private.ei_debtor_register(text,text)','public.ei_debtor_register(text,text)','app_private.ei_debtor_terms_set(bigint,bigint,integer,numeric,bigint,date,text)','public.ei_debtor_terms_set(bigint,bigint,integer,numeric,bigint,date,text)','app_private.ei_debtor_terms_get(bigint,date)','public.ei_debtor_terms_get(bigint,date)','public.ei_debtor_status(bigint)'] loop
 execute 'revoke all on function '||sig||' from public,anon,authenticated';
 execute 'grant execute on function '||sig||' to authenticated';
 end loop;
end $$;


-- ==== PREPARED_DR5_REPORTING.sql ====
-- DR5: receivables reporting, no modification of original v6.6.1 functions.
-- Use existing bill detail and one company-wide polarity; no loss through classification.
create function public.ei_debtor_bills(p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false,p_party text default null)
returns table(report_date date,party_name text,debtor_id bigint,region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text,bill_date_text text,bill_ref text,signed_amount numeric,amount numeric)
language sql stable security invoker set search_path=pg_catalog,public as $$
 with raw as materialized(select d.*,case when sum(d.outstanding_amount_tally_value) over()<0 then -1 else 1 end polarity from public.v_mis_finance_outstanding_detail d where group_name='Sundry Debtors'),
 mapped as materialized(select r.*,a.debtor_id,c.region_id,c.godown_id,c.district_id,c.area_id,c.type_id,
 case when a.debtor_id is null then 'UNMAPPED' when public.ei_debtor_status(a.debtor_id)='ACTIVE' and not public.ei_debtor_classification_valid(a.debtor_id) then 'INVALID' else public.ei_debtor_status(a.debtor_id) end kyc
 from raw r left join public.ei_debtor_alias a on a.party_key=lower(btrim(r.party_name)) left join public.ei_debtor_classification c on c.debtor_id=a.debtor_id)
 select m.report_date,m.party_name,m.debtor_id,m.region_id,m.godown_id,m.district_id,m.area_id,m.type_id,m.kyc,m.bill_date_text,m.bill_ref,m.outstanding_amount_tally_value,m.outstanding_amount_tally_value*m.polarity
 from mapped m where (p_region is null or m.region_id=p_region) and (p_godown is null or m.godown_id=p_godown) and (p_district is null or m.district_id=p_district) and (p_area is null or m.area_id=p_area) and (p_type is null or m.type_id=p_type) and (not coalesce(p_incomplete,false) or m.kyc<>'ACTIVE') and (p_party is null or m.party_name=p_party)
$$;
create function public.ei_debtor_summary(p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('report_date',max(report_date),'party_count',count(distinct party_name),'bill_count',count(*),'amount',coalesce(sum(amount),0),'signed_amount',coalesce(sum(signed_amount),0),'incomplete_party_count',count(distinct party_name) filter(where kyc_status<>'ACTIVE'),'incomplete_amount',coalesce(sum(amount) filter(where kyc_status<>'ACTIVE'),0))
 from public.ei_debtor_bills(p_region,p_godown,p_district,p_area,p_type,p_incomplete,null)
$$;
create function public.ei_debtor_party_page(p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false,p_search text default '',p_limit integer default 50,p_offset integer default 0)
returns table(party_name text,debtor_id bigint,region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text,bill_count bigint,amount numeric,total_rows bigint)
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 if p_limit is null or p_limit not between 1 and 200 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 return query select b.party_name,b.debtor_id,b.region_id,b.godown_id,b.district_id,b.area_id,b.type_id,b.kyc_status,count(*),sum(b.amount),count(*) over()
 from public.ei_debtor_bills(p_region,p_godown,p_district,p_area,p_type,p_incomplete,null)b
 where coalesce(b.party_name,'') ilike '%'||coalesce(btrim(p_search),'')||'%'
 group by b.party_name,b.debtor_id,b.region_id,b.godown_id,b.district_id,b.area_id,b.type_id,b.kyc_status order by sum(b.amount) desc,b.party_name limit p_limit offset p_offset;
end $$;
-- Separate alert payload, no contact data.
create function public.ei_debtor_alert() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('code','DEBTOR_KYC_INCOMPLETE','count',count(distinct party_name),'amount',coalesce(sum(amount),0),'bill_count',count(*),'report_date',max(report_date)) from public.ei_debtor_bills(null,null,null,null,null,true,null)
$$;
do $$
declare sig text;
begin
 foreach sig in array array['public.ei_debtor_bills(integer,integer,bigint,bigint,bigint,boolean,text)','public.ei_debtor_summary(integer,integer,bigint,bigint,bigint,boolean)','public.ei_debtor_party_page(integer,integer,bigint,bigint,bigint,boolean,text,integer,integer)','public.ei_debtor_alert()'] loop
 execute 'revoke all on function '||sig||' from public,anon,authenticated';
 execute 'grant execute on function '||sig||' to authenticated';
 end loop;
end $$;


-- ==== PREPARED_DR6_AGEING_LOOKUPS.sql ====
-- DR6: ageing reuses bill-date semantics, company-wide polarity, filters.
create function public.ei_debtor_ageing(p_as_of date default null,p_bounds integer[] default array[30,60,90],p_age_min integer default null,p_age_max integer default null,p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false,p_party text default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_date date; v_result jsonb;
begin
 if not public.ei_can_read_executive() then raise exception 'Access denied' using errcode='42501'; end if;
 if p_bounds is null or array_ndims(p_bounds) is distinct from 1 or array_lower(p_bounds,1)<>1 or cardinality(p_bounds) not between 1 and 5 or exists(select 1 from unnest(p_bounds) with ordinality u(v,i) where v is null or v not between 1 and 3650 or (i>1 and v<=p_bounds[(i-1)::int])) or coalesce(p_age_min,0)<0 or coalesce(p_age_max,0)<0 or p_age_min>p_age_max then raise exception 'Invalid ageing parameters' using errcode='22023'; end if;
 select coalesce(p_as_of,max(report_date)) into v_date from public.ei_debtor_bills();
 if v_date is null or not isfinite(v_date) then raise exception 'Invalid date' using errcode='22023'; end if;
 with raw as materialized(select b.*,case when nullif(btrim(b.bill_ref),'') is not null and btrim(b.bill_ref)!~*'^on[ -]?account$' then regexp_match(lower(btrim(b.bill_date_text)),'^([0-9]{1,2})-([a-z]{3})-([0-9]{2}|[0-9]{4})$') end m from public.ei_debtor_bills(p_region,p_godown,p_district,p_area,p_type,p_incomplete,p_party)b),
 parts as (select *,case when length(m[3])=2 then 2000+m[3]::int else m[3]::int end yr,array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],m[2]) mo,m[1]::int dy from raw),
 dates as (select *,case when yr between 1 and 9999 and mo between 1 and 12 and dy between 1 and 31 then make_date(yr,mo,1)+dy-1 end candidate from parts),
 aged as (select *,case when extract(month from candidate)=mo then v_date-candidate end age from dates),
 scoped as materialized(select *,case when age is not null then (select count(*)::int from unnest(p_bounds) b where age>b) end bi from aged where age is null or ((p_age_min is null or age>=p_age_min) and (p_age_max is null or age<=p_age_max))),
 buckets as(select bi,sum(amount) amt,count(*) cnt from scoped where bi is not null group by bi)
 select jsonb_build_object('as_of',v_date,'basis','bill_date','bounds',p_bounds,'total_amount',coalesce(sum(amount),0),'bill_count',count(*),'party_count',count(distinct party_name),'oldest_age_days',max(age),'weighted_avg_age_days',sum(age::numeric*amount) filter(where age is not null and amount>0)/nullif(sum(amount) filter(where age is not null and amount>0),0),'undated_amount',coalesce(sum(amount) filter(where age is null),0),'undated_bill_count',count(*) filter(where age is null),'bucket_amounts',array(select coalesce(b.amt,0) from generate_series(0,cardinality(p_bounds)) i left join buckets b on b.bi=i order by i),'bucket_bill_counts',array(select coalesce(b.cnt,0) from generate_series(0,cardinality(p_bounds)) i left join buckets b on b.bi=i order by i)) into v_result from scoped;
 return v_result;
end $$;
revoke all on function public.ei_debtor_ageing(date,integer[],integer,integer,integer,integer,bigint,bigint,bigint,boolean,text) from public,anon;
grant execute on function public.ei_debtor_ageing(date,integer[],integer,integer,integer,integer,bigint,bigint,bigint,boolean,text) to authenticated;
-- Master lookup uses report RLS; profiles remain separate.
create function public.ei_debtor_lookups() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select case when public.ei_can_read_executive() then jsonb_build_object(
 'regions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.code),'[]') from public.regions r),
 'godowns',(select coalesce(jsonb_agg(to_jsonb(g) order by g.code),'[]') from public.godowns g),
 'districts',(select coalesce(jsonb_agg(to_jsonb(d) order by d.state_name,d.district_name),'[]') from public.ei_debtor_district d),
 'coverage',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.ei_debtor_godown_district c),
 'areas',(select coalesce(jsonb_agg(to_jsonb(a) order by a.area_name),'[]') from public.ei_debtor_area a),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.name),'[]') from public.ei_debtor_type t)) end
$$;
revoke all on function public.ei_debtor_lookups() from public,anon;
grant execute on function public.ei_debtor_lookups() to authenticated;
-- Dedicated profile getter: no privileged bypass.
create function public.ei_debtor_profile(p_id bigint) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare j jsonb;
begin
 if not (public.ei_can_access_debtor_kyc('view') or public.ei_can_access_debtor_kyc('edit')) then raise exception 'KYC access required' using errcode='42501'; end if;
 select jsonb_build_object('identity',to_jsonb(d),'classification',to_jsonb(c),'profile',to_jsonb(k),'revision',coalesce(k.revision,0),'status',coalesce(k.lifecycle_status,'DRAFT'),'classification_valid',public.ei_debtor_classification_valid(d.id)) into j from public.ei_debtor d left join public.ei_debtor_classification c on c.debtor_id=d.id left join public.ei_debtor_kyc k on k.debtor_id=d.id where d.id=p_id;
 return j;
end $$;
revoke all on function public.ei_debtor_profile(bigint) from public,anon;
grant execute on function public.ei_debtor_profile(bigint) to authenticated;


-- Exclusion constraints: prevent concurrent effective-term overlaps, including open-ended intervals.
-- btree_gist is installed in extensions schema in the target PostgreSQL.
alter table public.ei_debtor_type_terms add constraint ei_debtor_type_terms_nonoverlap exclude using gist (type_id with =, region_id with =, daterange(effective_from, effective_to, '[)') with &&);
alter table public.ei_debtor_terms_override add constraint ei_debtor_terms_override_nonoverlap exclude using gist (debtor_id with =, daterange(effective_from, effective_to, '[)') with &&);
