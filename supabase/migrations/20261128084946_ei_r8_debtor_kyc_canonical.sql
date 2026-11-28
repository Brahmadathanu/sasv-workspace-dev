-- Existing region/godown and costing.scheme_master are authoritative.
create table public.ei_debtor_district (
 id bigint generated always as identity primary key,
 region_id integer not null references public.regions(id),
 state_name text not null check (btrim(state_name)<>''),
 district_name text not null check (btrim(district_name)<>''),
 revision bigint not null default 1 check (revision>0),
 is_active boolean not null default true
);
create unique index ei_debtor_district_identity on public.ei_debtor_district(region_id,lower(btrim(state_name)),lower(btrim(district_name)));
create table public.ei_debtor_godown_district (
 godown_id integer not null references public.godowns(id),
 district_id bigint not null references public.ei_debtor_district(id),
 is_active boolean not null default true,
 revision bigint not null default 1 check (revision>0),
 primary key(godown_id,district_id)
);
create table public.ei_debtor_area (
 id bigint generated always as identity primary key,
 district_id bigint not null references public.ei_debtor_district(id),
 area_name text not null check(btrim(area_name)<>''),
 revision bigint not null default 1 check (revision>0),
 is_active boolean not null default true,
 unique(id,district_id)
);
create unique index ei_debtor_area_identity on public.ei_debtor_area(district_id,lower(btrim(area_name)));
create table public.ei_debtor_type (
 id bigint generated always as identity primary key,
 code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
 name text not null unique check (btrim(name)<>''),
 definition text not null check(btrim(definition)<>''),
 revision bigint not null default 1 check (revision>0),
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

 created_at timestamptz not null default now()
);
create table public.ei_debtor_alias (
 party_key text primary key check(party_key=lower(btrim(party_key)) and party_key<>''),
 debtor_id bigint not null references public.ei_debtor(id),
 source_name text not null check (party_key=lower(btrim(source_name))),
 is_primary boolean not null default false,
 is_active boolean not null default true,
 revision bigint not null default 1 check (revision>0),
 check (not is_primary or is_active)
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
 effective_from date not null check (isfinite(effective_from)),
 effective_to date check (isfinite(effective_to)),
 revision bigint not null check (revision>0),
 reason text not null check(btrim(reason)<>''),
 check(effective_to is null or effective_to>effective_from),
 unique(type_id,region_id,effective_from)
);
create table public.ei_debtor_terms_override (
 id bigint generated always as identity primary key,
 debtor_id bigint not null references public.ei_debtor(id),
 discount_percent numeric check(discount_percent between 0 and 100),
 scheme_id bigint references costing.scheme_master(id),
 effective_from date not null check (isfinite(effective_from)),
 effective_to date check (isfinite(effective_to)),
 revision bigint not null check (revision>0),
 reason text not null check(btrim(reason)<>''),
 check(effective_to is null or effective_to>effective_from),
 check(discount_percent is not null or scheme_id is not null),
 unique(debtor_id,effective_from)
);
create table public.ei_debtor_audit (
 id bigint generated always as identity primary key,
 entity_name text not null, entity_id bigint, operation text not null,
 actor_user_id uuid not null, reason text not null check (btrim(reason)<>''),
 event_at timestamptz not null default now(),
 old_record jsonb,new_record jsonb
);
-- Audit contains KYC PII: no direct client grants.
do $$
declare t text;
begin
 foreach t in array array['ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type','ei_debtor','ei_debtor_alias','ei_debtor_classification','ei_debtor_kyc','ei_debtor_type_terms','ei_debtor_terms_override','ei_debtor_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
 end loop;
end $$;
-- Backfill only observed identity, not unsupported classifications.
insert into public.ei_debtor(ledger_name)
select min(vendor_name) from public.tally_group_outstanding_snapshot
where group_name='Sundry Debtors' and nullif(btrim(vendor_name),'') is not null
group by lower(btrim(vendor_name));
insert into public.ei_debtor_alias(party_key,debtor_id,source_name,is_primary)
select lower(btrim(ledger_name)),id,ledger_name,true from public.ei_debtor;




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
 or (lifecycle_status='ACTIVE' and activated_at is not null and activated_by is not null and inactivated_at is null and inactivated_by is null)
 or (lifecycle_status='INACTIVE' and activated_at is not null and activated_by is not null and inactivated_at is not null and inactivated_by is not null and nullif(btrim(status_reason),'') is not null)
 );
-- Separate authorization; no permission assignments copied or granted.
insert into public.permission_targets(key,kind,label,is_assignable,meta)
values ('role:ei-debtor-kyc','role','Executive Intelligence — Debtor KYC',true,'{"confidential":true,"module_key":"executive-mis-dashboard"}'),
('role:ei-debtor-commercial','role','Executive Intelligence — Debtor commercial terms',true,'{"confidential":true,"module_key":"executive-mis-dashboard"}')
;
-- Every exposed KYC/commercial operation requires an identified executive actor.
-- Legacy service-role Finance access is independent of KYC and commercial access.
create function app_private.ei_debtor_require(p_target text, p_mode text)
returns void language plpgsql stable set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null
     or auth.jwt()->>'is_anonymous' = 'true'
     or not coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false)
     or (p_target is not null and not (
       coalesce(public.app_has_permission(p_target,p_mode),false)
       or (p_mode='view' and coalesce(public.app_has_permission(p_target,'edit'),false))
     )) then
    raise exception 'Debtor access denied' using errcode='42501';
  end if;
end;
$$;

create function app_private.ei_debtor_set_reason(p_reason text)
returns void language plpgsql set search_path = pg_catalog as $$
begin
  if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'A reason of 1–2000 characters is required' using errcode='22023';
  end if;
  perform set_config('ei.debtor_audit_reason',btrim(p_reason),true);
end;
$$;

create function app_private.ei_debtor_validate_keys(p_data jsonb, p_keys text[])
returns void language plpgsql immutable set search_path = pg_catalog as $$
begin
  if jsonb_typeof(p_data) is distinct from 'object' or p_data - p_keys <> '{}'::jsonb then
    raise exception 'Invalid or unexpected input fields' using errcode='22023';
  end if;
end;
$$;

create function app_private.ei_debtor_check_revision(p_actual bigint,p_expected bigint)
returns void language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'Stale revision' using errcode='40001';
  end if;
end;
$$;

-- Finance can read classification metadata and lifecycle status through its existing
-- invoker boundary. No client role gets a column privilege on the personal profile.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type',
    'ei_debtor','ei_debtor_alias','ei_debtor_classification','ei_debtor_kyc'
  ] loop
    execute format('create policy ei_debtor_finance_read on public.%I for select to authenticated using ((select public.ei_can_read_executive()))',t);
    if t='ei_debtor_kyc' then
      execute format('grant select (debtor_id,lifecycle_status) on public.%I to authenticated,service_role',t);
    else
      execute format('grant select on public.%I to authenticated,service_role',t);
    end if;
  end loop;
end;
$$;

create view app_private.ei_debtor_classification_effective
with (security_invoker=true) as
select c.*,
  g.id is not null and d.id is not null and gd.godown_id is not null
    and a.id is not null and t.id is not null as is_valid
from public.ei_debtor_classification c
left join public.godowns g on g.id=c.godown_id and g.region_id=c.region_id
left join public.ei_debtor_district d on d.id=c.district_id and d.region_id=c.region_id and d.is_active
left join public.ei_debtor_godown_district gd on gd.godown_id=g.id and gd.district_id=d.id and gd.is_active
left join public.ei_debtor_area a on a.id=c.area_id and a.district_id=d.id and a.is_active
left join public.ei_debtor_type t on t.id=c.type_id and t.is_active;
revoke all on app_private.ei_debtor_classification_effective from public,anon,authenticated,service_role;
grant select on app_private.ei_debtor_classification_effective to authenticated,service_role;

-- Row locks serialize classification validation with master changes. The first
-- call in a SAVE locks the proposed parents; activation without a patch locks
-- the current parents before checking effective validity.
create function app_private.ei_debtor_lock_hierarchy(c public.ei_debtor_classification)
returns void language plpgsql set search_path = pg_catalog, public as $$
begin
  if c.godown_id is not null then
    perform 1 from public.godowns where id=c.godown_id and region_id=c.region_id for share;
    if not found then raise exception 'Godown region mismatch' using errcode='23514'; end if;
  end if;
  if c.district_id is not null then
    perform 1 from public.ei_debtor_district where id=c.district_id and region_id=c.region_id and is_active for share;
    if not found then raise exception 'District is invalid or inactive' using errcode='23514'; end if;
    perform 1 from public.ei_debtor_godown_district
      where godown_id=c.godown_id and district_id=c.district_id and is_active for share;
    if not found then raise exception 'Godown does not cover district' using errcode='23514'; end if;
  end if;
  if c.area_id is not null then
    perform 1 from public.ei_debtor_area where id=c.area_id and district_id=c.district_id and is_active for share;
    if not found then raise exception 'Area is invalid or inactive' using errcode='23514'; end if;
  end if;
  if c.type_id is not null then
    perform 1 from public.ei_debtor_type where id=c.type_id and is_active for share;
    if not found then raise exception 'Type is invalid or inactive' using errcode='23514'; end if;
  end if;
end;
$$;

create function app_private.ei_debtor_audit_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_old jsonb := case when tg_op<>'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op<>'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new,v_old);
begin
  insert into public.ei_debtor_audit(entity_name,entity_id,operation,actor_user_id,reason,old_record,new_record)
  values (tg_table_name,coalesce(v_row->>'debtor_id',v_row->>'id',v_row->>'district_id')::bigint,
          tg_op,auth.uid(),current_setting('ei.debtor_audit_reason',true),v_old,v_new);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type',
    'ei_debtor','ei_debtor_alias','ei_debtor_classification','ei_debtor_kyc',
    'ei_debtor_type_terms','ei_debtor_terms_override'
  ] loop
    execute format('create trigger ei_debtor_audit after insert or update or delete on public.%I for each row execute function app_private.ei_debtor_audit_write()',t);
  end loop;
end;
$$;

create function app_private.ei_debtor_audit_immutable()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'Debtor audit history is immutable' using errcode='42501';
end;
$$;

create trigger ei_debtor_audit_immutable before update or delete or truncate
on public.ei_debtor_audit for each statement execute function app_private.ei_debtor_audit_immutable();

create unique index ei_debtor_ledger_name_key on public.ei_debtor (lower(btrim(ledger_name)));
create unique index ei_debtor_alias_primary on public.ei_debtor_alias (debtor_id) where is_primary;
create index ei_debtor_alias_debtor on public.ei_debtor_alias (debtor_id,party_key);
create index ei_debtor_audit_history_idx on public.ei_debtor_audit (entity_name,entity_id,id desc);

-- PostgreSQL enforces exclusion for all writers, even if they bypass the RPC.
alter table public.ei_debtor_type_terms add constraint ei_debtor_type_terms_nonoverlap
  exclude using gist (type_id extensions.gist_int8_ops with =, region_id extensions.gist_int4_ops with =, daterange(effective_from,effective_to,'[)') with &&);
alter table public.ei_debtor_terms_override add constraint ei_debtor_terms_override_nonoverlap
  exclude using gist (debtor_id extensions.gist_int8_ops with =, daterange(effective_from,effective_to,'[)') with &&);
create function app_private.ei_debtor_save(
  p_id bigint,p_revision bigint,p_class jsonb,p_profile jsonb,p_action text,p_reason text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  k public.ei_debtor_kyc%rowtype;
  c public.ei_debtor_classification%rowtype;
  v_actor uuid := auth.uid();
  v_next text;
  v_valid boolean;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-kyc','edit');
  perform app_private.ei_debtor_set_reason(p_reason);
  if p_action is null or p_action not in ('SAVE','ACTIVATE','INACTIVATE') then
    raise exception 'Invalid lifecycle action' using errcode='22023';
  end if;
  perform 1 from public.ei_debtor where id=p_id for update;
  if not found then raise exception 'Unknown debtor' using errcode='22023'; end if;
  select * into k from public.ei_debtor_kyc where debtor_id=p_id;
  perform app_private.ei_debtor_check_revision(coalesce(k.revision,0),p_revision);
  v_next := coalesce(k.lifecycle_status,'DRAFT');
  if (p_action='ACTIVATE' and v_next='ACTIVE')
     or (p_action='INACTIVATE' and (v_next<>'ACTIVE' or p_class is not null or p_profile is not null)) then
    raise exception 'Invalid lifecycle transition' using errcode='22023';
  end if;

  select * into c from public.ei_debtor_classification where debtor_id=p_id;
  if p_class is not null then
    perform app_private.ei_debtor_validate_keys(p_class,array['region_id','godown_id','district_id','area_id','type_id']);
    c := jsonb_populate_record(null::public.ei_debtor_classification,p_class);
  end if;
  if p_action='ACTIVATE' then v_next := 'ACTIVE';
  elsif p_action='INACTIVATE' then v_next := 'INACTIVE'; end if;
  if p_class is not null or v_next='ACTIVE' then
    perform app_private.ei_debtor_lock_hierarchy(c);
  end if;
  if p_class is not null then
    insert into public.ei_debtor_classification(debtor_id,region_id,godown_id,district_id,area_id,type_id,reason,updated_by)
    values(p_id,c.region_id,c.godown_id,c.district_id,c.area_id,c.type_id,btrim(p_reason),v_actor)
    on conflict(debtor_id) do update
      set region_id=excluded.region_id,godown_id=excluded.godown_id,district_id=excluded.district_id,
          area_id=excluded.area_id,type_id=excluded.type_id,reason=excluded.reason,
          updated_by=v_actor,updated_at=now(),revision=ei_debtor_classification.revision+1;
  end if;
  select is_valid into v_valid from app_private.ei_debtor_classification_effective where debtor_id=p_id;
  if v_next='ACTIVE' and not coalesce(v_valid,false) then
    raise exception 'Complete valid region, godown, district, area and debtor type required' using errcode='23514';
  end if;
  if p_profile is not null then
    perform app_private.ei_debtor_validate_keys(p_profile,array[
      'business_name','contact_person','phone','alternate_phone','email','address_line_1','address_line_2',
      'locality','postal_code','state_name','country_name','gstin','notes','verification_status']);
    if exists (select 1 from jsonb_each(p_profile) q where jsonb_typeof(q.value) not in ('string','null')) then
      raise exception 'Profile values must be strings or null' using errcode='22023';
    end if;
    k := jsonb_populate_record(k,(select coalesce(jsonb_object_agg(key,nullif(btrim(value),'')),'{}')
                                  from jsonb_each_text(p_profile)));
  end if;
  insert into public.ei_debtor_kyc(
    debtor_id,business_name,contact_person,phone,alternate_phone,email,address_line_1,address_line_2,
    locality,postal_code,state_name,country_name,gstin,notes,verification_status,lifecycle_status,revision,
    status_reason,activated_at,activated_by,inactivated_at,inactivated_by,updated_by)
  values(p_id,k.business_name,k.contact_person,k.phone,k.alternate_phone,k.email,k.address_line_1,k.address_line_2,
    k.locality,k.postal_code,k.state_name,k.country_name,k.gstin,k.notes,coalesce(k.verification_status,'UNVERIFIED'),
    v_next,p_revision+1,btrim(p_reason),
    case when p_action='ACTIVATE' then now() else k.activated_at end,
    case when p_action='ACTIVATE' then v_actor else k.activated_by end,
    case p_action when 'INACTIVATE' then now() when 'ACTIVATE' then null else k.inactivated_at end,
    case p_action when 'INACTIVATE' then v_actor when 'ACTIVATE' then null else k.inactivated_by end,v_actor)
  on conflict(debtor_id) do update set
    business_name=excluded.business_name,contact_person=excluded.contact_person,phone=excluded.phone,
    alternate_phone=excluded.alternate_phone,email=excluded.email,address_line_1=excluded.address_line_1,
    address_line_2=excluded.address_line_2,locality=excluded.locality,postal_code=excluded.postal_code,
    state_name=excluded.state_name,country_name=excluded.country_name,gstin=excluded.gstin,notes=excluded.notes,
    verification_status=excluded.verification_status,lifecycle_status=excluded.lifecycle_status,
    revision=excluded.revision,status_reason=excluded.status_reason,activated_at=excluded.activated_at,
    activated_by=excluded.activated_by,inactivated_at=excluded.inactivated_at,inactivated_by=excluded.inactivated_by,
    updated_by=v_actor,updated_at=now();
  return jsonb_build_object('debtor_id',p_id,'revision',p_revision+1,'status',v_next,
                            'classification_valid',coalesce(v_valid,false));
end;
$$;

create function app_private.ei_debtor_profile(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-kyc','view');
  select jsonb_build_object('identity',to_jsonb(d),'classification',to_jsonb(c)-'is_valid','profile',to_jsonb(k),
    'revision',coalesce(k.revision,0),'status',coalesce(k.lifecycle_status,'DRAFT'),
    'classification_valid',coalesce(c.is_valid,false),
    'aliases',(select coalesce(jsonb_agg(to_jsonb(a) order by a.is_primary desc,a.party_key),'[]')
               from public.ei_debtor_alias a where a.debtor_id=d.id))
  into v_result
  from public.ei_debtor d
  left join app_private.ei_debtor_classification_effective c on c.debtor_id=d.id
  left join public.ei_debtor_kyc k on k.debtor_id=d.id
  where d.id=p_id;
  return v_result;
end;
$$;

create function app_private.ei_debtor_observed_name(p_key text)
returns text language sql stable set search_path = pg_catalog, public as $$
  select min(vendor_name) from public.tally_group_outstanding_snapshot
  where group_name='Sundry Debtors' and lower(btrim(vendor_name))=p_key;
$$;

create function app_private.ei_debtor_register(p_party text,p_reason text)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_key text := lower(btrim(p_party));
  v_alias public.ei_debtor_alias%rowtype;
  v_name text;
  v_id bigint;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-kyc','edit');
  perform app_private.ei_debtor_set_reason(p_reason);
  if nullif(v_key,'') is null then raise exception 'Ledger name required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ei-debtor-alias:'||v_key,0));
  select * into v_alias from public.ei_debtor_alias where party_key=v_key;
  if found then
    if not v_alias.is_active then raise exception 'Ledger alias is reserved and inactive' using errcode='23505'; end if;
    return v_alias.debtor_id;
  end if;
  v_name := app_private.ei_debtor_observed_name(v_key);
  if v_name is null then raise exception 'Unknown Tally debtor ledger' using errcode='22023'; end if;
  insert into public.ei_debtor(ledger_name) values(v_name) returning id into v_id;
  insert into public.ei_debtor_alias(party_key,debtor_id,source_name,is_primary)
  values(v_key,v_id,v_name,true);
  return v_id;
end;
$$;

create function app_private.ei_debtor_alias_set(
  p_id bigint,p_party text,p_active boolean,p_revision bigint,p_reason text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_key text := lower(btrim(p_party));
  v_alias public.ei_debtor_alias%rowtype;
  v_name text;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-kyc','edit');
  perform app_private.ei_debtor_set_reason(p_reason);
  if nullif(v_key,'') is null or p_active is null then
    raise exception 'Ledger alias and active flag required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ei-debtor-alias:'||v_key,0));
  perform 1 from public.ei_debtor where id=p_id for key share;
  if not found then raise exception 'Unknown debtor' using errcode='22023'; end if;
  select * into v_alias from public.ei_debtor_alias where party_key=v_key;
  if found and v_alias.debtor_id<>p_id then
    raise exception 'Ledger alias already belongs to another debtor' using errcode='23505';
  end if;
  perform app_private.ei_debtor_check_revision(coalesce(v_alias.revision,0),p_revision);
  if v_alias.is_primary or p_active is not distinct from v_alias.is_active or (p_revision=0 and not p_active) then
    raise exception 'Invalid alias transition' using errcode='22023';
  end if;
  if p_revision=0 then
    v_name := app_private.ei_debtor_observed_name(v_key);
    if v_name is null then raise exception 'Unknown Tally debtor ledger' using errcode='22023'; end if;
    insert into public.ei_debtor_alias(party_key,debtor_id,source_name) values(v_key,p_id,v_name) returning * into v_alias;
  else
    update public.ei_debtor_alias set is_active=p_active,revision=revision+1
    where party_key=v_key returning * into v_alias;
  end if;
  return to_jsonb(v_alias);
end;
$$;
-- Revision zero creates. Updates are compare-and-swap operations. Parent keys and
-- type codes are immutable; deactivation can invalidate existing classification.
create function app_private.ei_debtor_master_set(
  p_kind text,p_id bigint,p_godown_id integer,p_revision bigint,p_data jsonb,p_reason text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
  v_parent bigint;
  v_active boolean;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-kyc','edit');
  perform app_private.ei_debtor_set_reason(p_reason);
  if p_revision is null or p_revision<0 or (p_kind is distinct from 'coverage' and
    (p_godown_id is not null or ((p_id is null)<>(p_revision=0)))) then
    raise exception 'Invalid master identity or revision' using errcode='22023';
  end if;
  if p_data ? 'is_active' and jsonb_typeof(p_data->'is_active')<>'boolean' then
    raise exception 'is_active must be boolean' using errcode='22023';
  end if;
  v_active := (p_data->>'is_active')::boolean;
  case p_kind
    when 'district' then
      perform app_private.ei_debtor_validate_keys(p_data,
        case when p_revision=0 then array['region_id','state_name','district_name','is_active']
             else array['state_name','district_name','is_active'] end);
      if p_revision=0 then
        insert into public.ei_debtor_district as d(region_id,state_name,district_name,is_active)
        values ((p_data->>'region_id')::int,btrim(p_data->>'state_name'),
                btrim(p_data->>'district_name'),coalesce(v_active,true))
        returning to_jsonb(d) into v_result;
      else
        update public.ei_debtor_district d
        set state_name=case when p_data?'state_name' then btrim(p_data->>'state_name') else d.state_name end,
            district_name=case when p_data?'district_name' then btrim(p_data->>'district_name') else d.district_name end,
            is_active=coalesce(v_active,d.is_active),revision=d.revision+1
        where id=p_id and revision=p_revision returning to_jsonb(d) into v_result;
      end if;
    when 'coverage' then
      perform app_private.ei_debtor_validate_keys(p_data,array['is_active']);
      if p_id is null or p_godown_id is null then
        raise exception 'District and godown IDs required' using errcode='22023';
      end if;
      if coalesce(v_active,true) then
        perform 1 from public.godowns g join public.ei_debtor_district d on d.region_id=g.region_id
        where g.id=p_godown_id and d.id=p_id and d.is_active for share of g,d;
        if not found then raise exception 'Coverage requires a district in the godown region' using errcode='23514'; end if;
      end if;
      if p_revision=0 then
        insert into public.ei_debtor_godown_district as gd(godown_id,district_id,is_active)
        values (p_godown_id,p_id,coalesce(v_active,true)) returning to_jsonb(gd) into v_result;
      else
        update public.ei_debtor_godown_district gd set is_active=coalesce(v_active,gd.is_active),revision=gd.revision+1
        where godown_id=p_godown_id and district_id=p_id and revision=p_revision returning to_jsonb(gd) into v_result;
      end if;
    when 'area' then
      perform app_private.ei_debtor_validate_keys(p_data,
        case when p_revision=0 then array['district_id','area_name','is_active'] else array['area_name','is_active'] end);
      if p_revision=0 then
        v_parent := (p_data->>'district_id')::bigint;
        perform 1 from public.ei_debtor_district where id=v_parent and is_active for share;
        if not found then raise exception 'Active district required' using errcode='23514'; end if;
        insert into public.ei_debtor_area as a(district_id,area_name,is_active)
        values(v_parent,btrim(p_data->>'area_name'),coalesce(v_active,true)) returning to_jsonb(a) into v_result;
      else
        update public.ei_debtor_area a
        set area_name=case when p_data?'area_name' then btrim(p_data->>'area_name') else a.area_name end,
            is_active=coalesce(v_active,a.is_active),revision=a.revision+1
        where id=p_id and revision=p_revision returning to_jsonb(a) into v_result;
      end if;
    when 'type' then
      perform app_private.ei_debtor_validate_keys(p_data,
        case when p_revision=0 then array['code','name','definition','is_active'] else array['name','definition','is_active'] end);
      if p_revision=0 then
        insert into public.ei_debtor_type as t(code,name,definition,is_active)
        values(upper(btrim(p_data->>'code')),btrim(p_data->>'name'),btrim(p_data->>'definition'),coalesce(v_active,true))
        returning to_jsonb(t) into v_result;
      else
        update public.ei_debtor_type t
        set name=case when p_data?'name' then btrim(p_data->>'name') else t.name end,
            definition=case when p_data?'definition' then btrim(p_data->>'definition') else t.definition end,
            is_active=coalesce(v_active,t.is_active),revision=t.revision+1
        where id=p_id and revision=p_revision returning to_jsonb(t) into v_result;
      end if;
    else
      raise exception 'Unknown master kind' using errcode='22023';
  end case;
  if v_result is null then raise exception 'Stale master revision' using errcode='40001'; end if;
  return v_result;
end;
$$;
-- Half-open effective windows. SET appends a policy; WITHDRAW closes the
-- latest override on a later date, causing independent fallback on that date.
create function app_private.ei_debtor_terms_write(
  p_debtor bigint,p_type bigint,p_region integer,p_revision bigint,p_discount numeric,
  p_scheme bigint,p_effective date,p_withdraw boolean,p_reason text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_last_id bigint;
  v_last_revision bigint;
  v_last_from date;
  v_last_to date;
  v_result jsonb;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-commercial','edit');
  perform app_private.ei_debtor_set_reason(p_reason);
  if p_withdraw is null or p_effective is null or not isfinite(p_effective)
     or (p_withdraw and (p_discount is not null or p_scheme is not null))
     or (p_debtor is not null and (p_type is not null or p_region is not null))
     or (p_debtor is null and (p_type is null or p_region is null or p_withdraw))
     or (not p_withdraw and p_discount is null and p_scheme is null)
     or p_discount not between 0 and 100 then
    raise exception 'Invalid commercial scope, date or terms' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    case when p_debtor is null then 'ei-type-terms:'||p_type||':'||p_region
         else 'ei-debtor-terms:'||p_debtor end,0));
  if p_scheme is not null then
    perform 1 from costing.scheme_master where id=p_scheme and is_active for share;
    if not found then raise exception 'Active scheme required' using errcode='22023'; end if;
  end if;
  if p_debtor is not null then
    select id,revision,effective_from,effective_to into v_last_id,v_last_revision,v_last_from,v_last_to
    from public.ei_debtor_terms_override where debtor_id=p_debtor order by effective_from desc limit 1;
  else
    perform 1 from public.ei_debtor_type where id=p_type and is_active for share;
    if not found then raise exception 'Active debtor type required' using errcode='22023'; end if;
    select id,revision,effective_from,effective_to into v_last_id,v_last_revision,v_last_from,v_last_to
    from public.ei_debtor_type_terms where type_id=p_type and region_id=p_region order by effective_from desc limit 1;
  end if;
  perform app_private.ei_debtor_check_revision(coalesce(v_last_revision,0),p_revision);
  if p_effective<=v_last_from or p_effective<v_last_to
     or (p_withdraw and (v_last_id is null or v_last_to is not null)) then
    raise exception 'Invalid change to effective interval' using errcode='22023';
  end if;
  if p_debtor is not null then
    update public.ei_debtor_terms_override o
    set effective_to=p_effective,revision=case when p_withdraw then o.revision+1 else o.revision end
    where id=v_last_id and effective_to is null returning to_jsonb(o) into v_result;
    if not p_withdraw then
      insert into public.ei_debtor_terms_override as o(debtor_id,discount_percent,scheme_id,effective_from,reason,revision)
      values(p_debtor,p_discount,p_scheme,p_effective,btrim(p_reason),p_revision+1) returning to_jsonb(o) into v_result;
    end if;
  else
    update public.ei_debtor_type_terms set effective_to=p_effective where id=v_last_id and effective_to is null;
    insert into public.ei_debtor_type_terms as t(type_id,region_id,discount_percent,scheme_id,effective_from,reason,revision)
    values(p_type,p_region,p_discount,p_scheme,p_effective,btrim(p_reason),p_revision+1) returning to_jsonb(t) into v_result;
  end if;
  return v_result;
end;
$$;

create function app_private.ei_debtor_terms_get(p_id bigint,p_date date)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-commercial','view');
  if p_date is null or not isfinite(p_date) then raise exception 'Finite date required' using errcode='22023'; end if;
  select jsonb_build_object(
    'discount_percent',coalesce(o.discount_percent,t.discount_percent),
    'discount_source',case when o.discount_percent is not null then 'OVERRIDE' when t.discount_percent is not null then 'TYPE' else 'UNCONFIGURED' end,
    'scheme_id',s.id,'scheme_name',s.scheme_name,'scheme_active',s.is_active,
    'scheme_source',case when o.scheme_id is not null then 'OVERRIDE' when t.scheme_id is not null then 'TYPE' else 'UNCONFIGURED' end,
    'region_id',c.region_id,'type_id',c.type_id)
  into v_result
  from public.ei_debtor d
  left join public.ei_debtor_classification c on c.debtor_id=d.id
  left join public.ei_debtor_terms_override o on o.debtor_id=d.id
    and daterange(o.effective_from,o.effective_to,'[)') @> p_date
  left join public.ei_debtor_type_terms t on t.type_id=c.type_id and t.region_id=c.region_id
    and daterange(t.effective_from,t.effective_to,'[)') @> p_date
  left join costing.scheme_master s on s.id=coalesce(o.scheme_id,t.scheme_id)
  where d.id=p_id;
  return v_result;
end;
$$;

create function app_private.ei_debtor_page_check(p_limit integer,p_offset integer,p_max integer)
returns void language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p_limit is null or p_limit not between 1 and p_max or p_offset is null or p_offset<0 then
    raise exception 'Invalid page limit or offset' using errcode='22023';
  end if;
end;
$$;

create function app_private.ei_debtor_terms_history(
  p_debtor bigint,p_type bigint,p_region integer,p_limit integer,p_offset integer
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-commercial','view');
  perform app_private.ei_debtor_page_check(p_limit,p_offset,200);
  if (p_debtor is null and (p_type is null or p_region is null))
     or (p_debtor is not null and (p_type is not null or p_region is not null)) then
    raise exception 'Invalid commercial scope' using errcode='22023';
  end if;
  with scoped as materialized (
    select to_jsonb(o) as item,effective_from,revision from public.ei_debtor_terms_override o where debtor_id=p_debtor
    union all
    select to_jsonb(t),effective_from,revision from public.ei_debtor_type_terms t where type_id=p_type and region_id=p_region
  ), page as (
    select * from scoped order by effective_from desc limit p_limit offset p_offset
  )
  select jsonb_build_object('total_rows',(select count(*) from scoped),
    'revision',coalesce((select max(revision) from scoped),0),
    'rows',coalesce(jsonb_agg(item order by effective_from desc),'[]')) into v_result from page;
  return v_result;
end;
$$;

create function app_private.ei_debtor_scheme_page(p_search text,p_limit integer,p_offset integer)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-commercial','view');
  perform app_private.ei_debtor_page_check(p_limit,p_offset,200);
  with scoped as materialized (
    select id,scheme_name from costing.scheme_master where is_active
      and scheme_name ilike '%'||coalesce(btrim(p_search),'')||'%'
  ), page as (
    select * from scoped order by scheme_name,id limit p_limit offset p_offset
  )
  select jsonb_build_object('total_rows',(select count(*) from scoped),
    'rows',coalesce(jsonb_agg(to_jsonb(page) order by scheme_name,id),'[]')) into v_result from page;
  return v_result;
end;
$$;

create function app_private.ei_debtor_audit_page(
  p_entity text,p_id bigint,p_limit integer,p_offset integer
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
begin
  if p_entity in ('ei_debtor_type_terms','ei_debtor_terms_override') then
    perform app_private.ei_debtor_require('role:ei-debtor-commercial','view');
  elsif p_entity in ('ei_debtor','ei_debtor_alias','ei_debtor_classification','ei_debtor_kyc',
                     'ei_debtor_district','ei_debtor_godown_district','ei_debtor_area','ei_debtor_type') then
    perform app_private.ei_debtor_require('role:ei-debtor-kyc','view');
  else
    raise exception 'Unknown audit entity' using errcode='22023';
  end if;
  perform app_private.ei_debtor_page_check(p_limit,p_offset,200);
  with page as (
    select * from public.ei_debtor_audit a where a.entity_name=p_entity and (p_id is null or a.entity_id=p_id)
    order by a.id desc limit p_limit offset p_offset
  )
  select jsonb_build_object('total_rows',(select count(*) from public.ei_debtor_audit a
    where a.entity_name=p_entity and (p_id is null or a.entity_id=p_id)),
    'rows',coalesce(jsonb_agg(to_jsonb(page) order by id desc),'[]')) into v_result from page;
  return v_result;
end;
$$;
create function app_private.ei_debtor_effective_status(p_status text,p_is_valid boolean)
returns text language sql immutable set search_path = pg_catalog as $$
  select case when p_status='ACTIVE' and not coalesce(p_is_valid,false) then 'INVALID'
              else coalesce(p_status,'DRAFT') end;
$$;

-- Keep the existing projection, caller privileges and latest-snapshot semantics.
create or replace view public.v_mis_finance_outstanding_detail
with (security_invoker=true,security_barrier=true) as
with latest_snapshot as (
  select max(as_of_date) as report_date from public.tally_group_outstanding_snapshot
)
select t.as_of_date as report_date,t.group_name,
  case t.group_name when 'Sundry Creditors' then 'Payables — Sundry Creditors'
                    when 'Sundry Debtors' then 'Receivables — Sundry Debtors' else t.group_name end as mis_group_name,
  t.bill_date_text,t.bill_ref,t.vendor_name as party_name,
  coalesce(t.opening_amount_value,0::numeric) as opening_amount_tally_value,
  coalesce(t.outstanding_amount_value,0::numeric) as outstanding_amount_tally_value,
  abs(coalesce(t.opening_amount_value,0::numeric)) as opening_amount_abs_line_value,
  abs(coalesce(t.outstanding_amount_value,0::numeric)) as outstanding_amount_abs_line_value,
  t.source_key,t.inserted_at,
  a.debtor_id,c.region_id,c.godown_id,c.district_id,c.area_id,c.type_id,
  case when t.group_name<>'Sundry Debtors' then null
       when a.debtor_id is null then 'UNMAPPED'
       else app_private.ei_debtor_effective_status(k.lifecycle_status,c.is_valid) end as kyc_status,
  t.id as bill_id
from public.tally_group_outstanding_snapshot t
join latest_snapshot l on l.report_date=t.as_of_date
left join public.ei_debtor_alias a
  on t.group_name='Sundry Debtors' and a.is_active and a.party_key=lower(btrim(t.vendor_name))
left join app_private.ei_debtor_classification_effective c on c.debtor_id=a.debtor_id
left join public.ei_debtor_kyc k on k.debtor_id=a.debtor_id
where t.group_name in ('Sundry Creditors','Sundry Debtors') and (select public.ei_can_read_executive());

create or replace view public.v_mis_finance_outstanding_party_summary
with (security_invoker=true,security_barrier=true) as
select report_date,group_name,mis_group_name,party_name,count(*) as bill_count,
  sum(outstanding_amount_tally_value) as signed_outstanding_tally_value,
  abs(sum(outstanding_amount_tally_value)) as outstanding_amount_mis_value,
  sum(outstanding_amount_abs_line_value) as absolute_bill_line_total,
  min(bill_date_text) as earliest_bill_date_text,max(bill_date_text) as latest_bill_date_text,
  debtor_id,region_id,godown_id,district_id,area_id,type_id,kyc_status
from public.v_mis_finance_outstanding_detail
where (select public.ei_can_read_executive())
group by report_date,group_name,mis_group_name,party_name,debtor_id,region_id,godown_id,district_id,area_id,type_id,kyc_status;

create function app_private.ei_debtor_filter(
  p_status text,p_region integer,p_godown integer,p_district bigint,p_area bigint,p_type bigint,
  p_region_id integer,p_godown_id integer,p_district_id bigint,p_area_id bigint,p_type_id bigint,p_partition text
) returns boolean language sql immutable set search_path = pg_catalog as $$
  select case
    when p_partition='unclassified' then p_status is not null and p_status<>'ACTIVE'
      and p_region_id is null and p_godown_id is null and p_district_id is null and p_area_id is null and p_type_id is null
    when p_partition='all' and p_region_id is null and p_godown_id is null and p_district_id is null
      and p_area_id is null and p_type_id is null then true
    when p_partition in ('classified','all') then p_status='ACTIVE'
      and (p_region_id is null or p_region=p_region_id)
      and (p_godown_id is null or p_godown=p_godown_id)
      and (p_district_id is null or p_district=p_district_id)
      and (p_area_id is null or p_area=p_area_id)
      and (p_type_id is null or p_type=p_type_id)
    else false end;
$$;

create function app_private.ei_debtor_partition_check(
  p_partition text,p_region_id integer,p_godown_id integer,p_district_id bigint,p_area_id bigint,p_type_id bigint
) returns void language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p_partition is null or p_partition not in ('all','classified','unclassified')
    or (p_partition='unclassified' and coalesce(p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id) is not null) then
    raise exception 'Invalid classification partition or conflicting selectors' using errcode='22023';
  end if;
end;
$$;

-- Retire only the three replaced signatures. PostgreSQL rejects unexpected
-- schema dependencies rather than dropping any dependent object.
drop function public.get_mis_finance_party_page(text,text,integer,integer);
drop function public.get_mis_finance_ageing_summary(date,text,integer[],integer,integer);
drop function public.get_mis_finance_ageing_party_page(text,text,date,text,integer[],integer,integer,integer,integer);

create function public.get_mis_finance_party_page(
  p_group_filter text default 'payables',p_search text default '',p_limit integer default 25,p_offset integer default 0,
  p_region_id integer default null,p_godown_id integer default null,p_district_id bigint default null,
  p_area_id bigint default null,p_type_id bigint default null,p_partition text default 'all'
) returns table(report_date date,mis_group_name text,party_name text,bill_count bigint,
  signed_outstanding_tally_value numeric,outstanding_amount_mis_value numeric,absolute_bill_line_total numeric,total_rows bigint,
  debtor_id bigint,region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text)
language plpgsql stable set search_path = pg_catalog, public as $$
begin
  perform app_private.ei_debtor_partition_check(p_partition,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id);
  return query
    select s.report_date,s.mis_group_name,s.party_name,s.bill_count,s.signed_outstanding_tally_value,
      s.outstanding_amount_mis_value,s.absolute_bill_line_total,count(*) over (),
      s.debtor_id,s.region_id,s.godown_id,s.district_id,s.area_id,s.type_id,s.kyc_status
    from public.v_mis_finance_outstanding_party_summary s
    where (select public.ei_can_read_executive())
      and (p_group_filter='all' or (p_group_filter='payables' and s.group_name='Sundry Creditors')
           or (p_group_filter='receivables' and s.group_name='Sundry Debtors'))
      and (coalesce(trim(p_search),'')='' or s.party_name ilike '%'||trim(p_search)||'%'
           or s.mis_group_name ilike '%'||trim(p_search)||'%')
      and app_private.ei_debtor_filter(s.kyc_status,s.region_id,s.godown_id,s.district_id,s.area_id,s.type_id,
        p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id,p_partition)
    order by s.outstanding_amount_mis_value desc,s.party_name,s.mis_group_name
    limit greatest(1,least(coalesce(p_limit,25),100)) offset greatest(0,coalesce(p_offset,0));
end;
$$;

create function public.ei_debtor_lookups()
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
begin
  perform app_private.ei_debtor_require(null,'view');
  return jsonb_build_object(
    'regions',(select coalesce(jsonb_agg(to_jsonb(r) order by code),'[]') from public.regions r),
    'godowns',(select coalesce(jsonb_agg(to_jsonb(g) order by code),'[]') from public.godowns g),
    'districts',(select coalesce(jsonb_agg(to_jsonb(d) order by state_name,district_name,id),'[]') from public.ei_debtor_district d),
    'coverage',(select coalesce(jsonb_agg(to_jsonb(c) order by godown_id,district_id),'[]') from public.ei_debtor_godown_district c),
    'areas',(select coalesce(jsonb_agg(to_jsonb(a) order by area_name,id),'[]') from public.ei_debtor_area a),
    'types',(select coalesce(jsonb_agg(to_jsonb(t) order by name,id),'[]') from public.ei_debtor_type t));
end;
$$;

create function public.ei_debtor_register_page(
  p_search text default '',p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  v_result jsonb;
begin
  perform app_private.ei_debtor_require('role:ei-debtor-kyc','view');
  perform app_private.ei_debtor_page_check(p_limit,p_offset,200);
  with outstanding as materialized (
    select coalesce(d.debtor_id,matched.debtor_id) as debtor_id,
      lower(btrim(d.party_name)) as party_key,d.party_name,d.report_date,d.bill_count,
      d.signed_outstanding_tally_value,d.kyc_status
    from public.v_mis_finance_outstanding_party_summary d
    left join public.ei_debtor_alias matched on matched.party_key=lower(btrim(d.party_name))
    where d.group_name='Sundry Debtors'
  ), registered as (
    select a.debtor_id,max(o.report_date) as report_date,sum(o.bill_count)::bigint as bill_count,
      coalesce(sum(o.signed_outstanding_tally_value),0) as signed_amount
    from public.ei_debtor_alias a join outstanding o on o.party_key=a.party_key and a.is_active
    group by a.debtor_id
  ), candidates as (
    select e.id as debtor_id,e.ledger_name,lower(btrim(e.ledger_name)) as party_key,
      r.report_date,coalesce(r.bill_count,0) as bill_count,coalesce(r.signed_amount,0) as signed_amount,
      app_private.ei_debtor_effective_status(k.lifecycle_status,c.is_valid) as kyc_status
    from public.ei_debtor e
    left join registered r on r.debtor_id=e.id
    left join app_private.ei_debtor_classification_effective c on c.debtor_id=e.id
    left join public.ei_debtor_kyc k on k.debtor_id=e.id
    union all
    select null,min(o.party_name),o.party_key,max(o.report_date),sum(o.bill_count)::bigint,
      coalesce(sum(o.signed_outstanding_tally_value),0),'UNMAPPED'
    from outstanding o where o.debtor_id is null and nullif(o.party_key,'') is not null group by o.party_key
  ), scoped as materialized (
    select * from candidates e where e.ledger_name ilike '%'||coalesce(btrim(p_search),'')||'%'
      or exists (select 1 from public.ei_debtor_alias a where a.debtor_id=e.debtor_id
                 and a.source_name ilike '%'||coalesce(btrim(p_search),'')||'%')
  ), page as (
    select * from scoped order by party_key limit p_limit offset p_offset
  )
  select jsonb_build_object('total_rows',(select count(*) from scoped),
    'rows',coalesce(jsonb_agg(to_jsonb(page) order by party_key),'[]')) into v_result from page;
  return v_result;
end;
$$;
create function app_private.ei_debtor_ageing_date(
  p_as_of date,p_basis text,p_bounds integer[],p_age_min integer,p_age_max integer
) returns date language plpgsql stable set search_path = pg_catalog, public as $$
declare
  v_date date;
begin
  if p_basis is distinct from 'bill_date' or p_bounds is null or array_ndims(p_bounds) is distinct from 1
    or cardinality(p_bounds) not between 1 and 5
    or exists (select 1 from unnest(p_bounds) with ordinality x(v,i)
      where v is null or v not between 1 and 3650 or (i>1 and v<=p_bounds[array_lower(p_bounds,1)+i::int-2]))
    or coalesce(p_age_min,0)<0 or coalesce(p_age_max,0)<0 or p_age_min>p_age_max then
    raise exception 'Invalid ageing basis, bounds or age range' using errcode='22023';
  end if;
  if not public.ei_can_read_executive() then
    raise exception 'Executive Intelligence access required' using errcode='42501';
  end if;
  v_date := coalesce(p_as_of,(select financial_position_date from public.mv_mis_executive_summary limit 1));
  if v_date is null or not isfinite(v_date) then
    raise exception 'Invalid or unavailable financial position date' using errcode='22023';
  end if;
  return v_date;
end;
$$;

-- This is the sole parser and age-range bill scope. Undated bills survive ranges.
-- The company sign is determined here, before any party search/classification.
create function app_private.ei_debtor_ageing_bills(
  p_as_of date,p_bounds integer[],p_age_min integer,p_age_max integer,
  p_group text,p_search text,p_party text,p_region_id integer,p_godown_id integer,
  p_district_id bigint,p_area_id bigint,p_type_id bigint,p_partition text
) returns table(bill public.v_mis_finance_outstanding_detail,age integer,bucket_no integer,
  company_polarity integer,party_polarity integer,selected boolean)
language sql stable set search_path = pg_catalog, public as $$
  with raw as materialized (
    select d as bill,
      case when nullif(btrim(d.bill_ref),'') is not null and btrim(d.bill_ref) !~* '^on[ -]?account$'
           then regexp_match(lower(btrim(d.bill_date_text)), '^([0-9]{1,2})-([a-z]{3})-([0-9]{2}|[0-9]{4})$') end as m
    from public.v_mis_finance_outstanding_detail d
  ), parts as (
    select bill,case when length(m[3])=2 then 2000+m[3]::int else m[3]::int end as yr,
      array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],m[2]) as mo,
      m[1]::int as dy
    from raw
  ), dates as (
    select bill,mo,case when yr between 1 and 9999 and mo between 1 and 12 and dy between 1 and 31
      then make_date(yr,mo,1)+dy-1 end as candidate from parts
  ), aged as materialized (
    select bill,case when extract(month from candidate)=mo then p_as_of-candidate end as age from dates
  ), scoped as (
    select bill,age,app_private.ei_debtor_filter((bill).kyc_status,(bill).region_id,(bill).godown_id,
      (bill).district_id,(bill).area_id,(bill).type_id,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id,p_partition)
      and (p_group='all' or (p_group='payables' and (bill).group_name='Sundry Creditors')
           or (p_group='receivables' and (bill).group_name='Sundry Debtors'))
      and (coalesce(btrim(p_search),'')='' or (bill).party_name ilike '%'||btrim(p_search)||'%'
           or (bill).mis_group_name ilike '%'||btrim(p_search)||'%')
      and (p_party is null or (bill).party_name=p_party) as selected
    from aged where age is null or ((p_age_min is null or age>=p_age_min) and (p_age_max is null or age<=p_age_max))
  )
  select bill,age,
    case when age is not null then (select count(*)::int from unnest(p_bounds) b where age>b) end,
    case when sum((bill).outstanding_amount_tally_value) over (partition by (bill).group_name)<0 then -1 else 1 end,
    case when sum((bill).outstanding_amount_tally_value) filter(where selected)
      over (partition by (bill).group_name,(bill).party_name)<0 then -1 else 1 end,
    selected
  from scoped;
$$;

-- One aggregation for company groups, selected receivables, and party rows.
create function app_private.ei_debtor_ageing_totals(
  p_as_of date,p_bounds integer[],p_age_min integer,p_age_max integer,p_by_party boolean,
  p_group text,p_search text,p_region_id integer,p_godown_id integer,p_district_id bigint,
  p_area_id bigint,p_type_id bigint,p_partition text
) returns table(scope text,gn text,pn text,bc bigint,pc bigint,signed_total numeric,total numeric,oldest integer,
  avg_age numeric,undated numeric,uc bigint,ba numeric[],bn integer[],debtor_id bigint,
  region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text)
language sql stable set search_path = pg_catalog, public as $$
  with scoped as materialized (
    select (b.bill).party_name as pn,(b.bill).mis_group_name as gn,(b.bill).group_name as group_name,
      (b.bill).outstanding_amount_tally_value as amt,b.age,b.bucket_no,b.company_polarity,b.party_polarity,
      (b.bill).debtor_id,(b.bill).region_id,(b.bill).godown_id,(b.bill).district_id,
      (b.bill).area_id,(b.bill).type_id,(b.bill).kyc_status,
      b.selected
    from app_private.ei_debtor_ageing_bills(p_as_of,p_bounds,p_age_min,p_age_max,
      p_group,p_search,null,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id,p_partition) b
  ), groupings as (
    select s.*, v.scope, case when p_by_party then s.pn end as party
    from scoped s
    cross join lateral (values
      ('company',not p_by_party),
      ('filtered',not p_by_party and s.group_name='Sundry Debtors' and s.selected and
        (p_partition<>'all' or coalesce(p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id) is not null)),
      ('party',p_by_party and s.selected)
    ) v(scope,include) where v.include
  ), oriented as materialized (
    select *,amt*(case when p_by_party then party_polarity else company_polarity end) as amount
    from groupings
  ), totals as (
    select scope,gn,party,count(*) as bc,count(distinct pn) as pc,sum(amt) as signed_total,sum(amount) as total,
      max(age) as oldest,
      sum(age::numeric*amount) filter(where age is not null and amount>0)
        /nullif(sum(amount) filter(where age is not null and amount>0),0) as avg_age,
      coalesce(sum(amount) filter(where age is null),0) as undated,count(*) filter(where age is null) as uc,
      min(debtor_id) as debtor_id,min(region_id) as region_id,min(godown_id) as godown_id,
      min(district_id) as district_id,min(area_id) as area_id,min(type_id) as type_id,min(kyc_status) as kyc_status
    from oriented group by scope,gn,party
  ), buckets as (
    select scope,gn,party,bucket_no,sum(amount) as amt,count(*)::int as cnt
    from oriented where bucket_no is not null group by scope,gn,party,bucket_no
  ), bucket_maps as (
    select scope,gn,party,jsonb_object_agg(bucket_no,amt) as amounts,jsonb_object_agg(bucket_no,cnt) as counts
    from buckets group by scope,gn,party
  )
  select t.scope,t.gn,t.party,t.bc,t.pc,t.signed_total,t.total,t.oldest,t.avg_age,t.undated,t.uc,
    array(select coalesce((b.amounts->>i::text)::numeric,0) from generate_series(0,cardinality(p_bounds)) i order by i),
    array(select coalesce((b.counts->>i::text)::integer,0) from generate_series(0,cardinality(p_bounds)) i order by i),
    t.debtor_id,t.region_id,t.godown_id,t.district_id,t.area_id,t.type_id,t.kyc_status
  from totals t
  left join bucket_maps b on b.scope=t.scope and b.gn=t.gn and b.party is not distinct from t.party;
$$;

create function public.get_mis_finance_ageing_summary(
  p_as_of date default null,p_basis text default 'bill_date',p_bounds integer[] default array[30,60,90],
  p_age_min integer default null,p_age_max integer default null,
  p_region_id integer default null,p_godown_id integer default null,p_district_id bigint default null,
  p_area_id bigint default null,p_type_id bigint default null,p_partition text default 'all'
) returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  v_date date := app_private.ei_debtor_ageing_date(p_as_of,p_basis,p_bounds,p_age_min,p_age_max);
  v_result jsonb;
  v_has_filter boolean := p_partition<>'all' or coalesce(p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id) is not null;
begin
  perform app_private.ei_debtor_partition_check(p_partition,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id);
  with result_rows as (
    select g.scope,g.group_key,jsonb_build_object(
      'group',g.group_key,'label',g.label,
      'bucket_amounts',coalesce(r.ba,array_fill(0::numeric,array[cardinality(p_bounds)+1])),
      'bucket_bill_counts',coalesce(r.bn,array_fill(0::integer,array[cardinality(p_bounds)+1])),
      'total_amount',coalesce(r.total,0),'bill_count',coalesce(r.bc,0),'party_count',coalesce(r.pc,0),
      'oldest_age_days',r.oldest,'weighted_avg_age_days',r.avg_age,'undated_amount',coalesce(r.undated,0),
      'undated_bill_count',coalesce(r.uc,0))
      || case when g.scope='filtered' then jsonb_build_object('signed_amount',coalesce(r.signed_total,0))
              else '{}'::jsonb end as item
    from (values ('company','payables','Payables — Sundry Creditors'),
                 ('company','receivables','Receivables — Sundry Debtors'),
                 ('filtered','receivables','Receivables — Sundry Debtors')) g(scope,group_key,label)
    left join app_private.ei_debtor_ageing_totals(v_date,p_bounds,p_age_min,p_age_max,false,
      'all','',p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id,p_partition) r
      on r.scope=g.scope and r.gn=g.label
  )
  select jsonb_build_object('as_of',v_date,'basis',p_basis,'bounds',p_bounds,
    'groups',jsonb_agg(item order by group_key) filter(where scope='company'))
    || case when v_has_filter then jsonb_build_object('filtered_receivables',
       (select item from result_rows where scope='filtered')) else '{}'::jsonb end
  into v_result from result_rows;
  return v_result;
end;
$$;

create function public.get_mis_finance_ageing_party_page(
  p_group_filter text default 'payables',p_search text default '',p_as_of date default null,
  p_basis text default 'bill_date',p_bounds integer[] default array[30,60,90],
  p_age_min integer default null,p_age_max integer default null,p_limit integer default 25,p_offset integer default 0,
  p_region_id integer default null,p_godown_id integer default null,p_district_id bigint default null,
  p_area_id bigint default null,p_type_id bigint default null,p_partition text default 'all'
) returns table(party_name text,mis_group_name text,bill_count bigint,outstanding_amount_mis_value numeric,
  signed_outstanding_tally_value numeric,bucket_amounts numeric[],bucket_bill_counts integer[],oldest_age_days integer,
  weighted_avg_age_days numeric,undated_amount numeric,total_rows bigint,
  debtor_id bigint,region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text)
language plpgsql stable set search_path = pg_catalog, public as $$
declare
  v_date date := app_private.ei_debtor_ageing_date(p_as_of,p_basis,p_bounds,p_age_min,p_age_max);
begin
  if p_group_filter is null or p_group_filter not in ('all','payables','receivables') then
    raise exception 'Invalid finance group' using errcode='22023';
  end if;
  perform app_private.ei_debtor_page_check(p_limit,p_offset,200);
  perform app_private.ei_debtor_partition_check(p_partition,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id);
  return query select r.pn,r.gn,r.bc,r.total,r.signed_total,r.ba,r.bn,r.oldest,r.avg_age,r.undated,count(*) over (),
    r.debtor_id,r.region_id,r.godown_id,r.district_id,r.area_id,r.type_id,r.kyc_status
  from app_private.ei_debtor_ageing_totals(v_date,p_bounds,p_age_min,p_age_max,true,
    p_group_filter,p_search,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id,p_partition) r
  order by r.total desc,r.pn,r.gn limit p_limit offset p_offset;
end;
$$;

-- Use the same bounded endpoint for bill drill-down and paged export.
create function public.get_mis_finance_bill_page(
  p_group_filter text default 'all',p_party text default null,p_as_of date default null,
  p_basis text default 'bill_date',p_bounds integer[] default array[30,60,90],
  p_age_min integer default null,p_age_max integer default null,p_limit integer default 100,p_offset integer default 0,
  p_region_id integer default null,p_godown_id integer default null,p_district_id bigint default null,
  p_area_id bigint default null,p_type_id bigint default null,p_partition text default 'all'
) returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  v_date date := app_private.ei_debtor_ageing_date(p_as_of,p_basis,p_bounds,p_age_min,p_age_max);
  v_result jsonb;
begin
  if p_group_filter is null or p_group_filter not in ('all','payables','receivables') then
    raise exception 'Invalid finance group' using errcode='22023';
  end if;
  perform app_private.ei_debtor_page_check(p_limit,p_offset,500);
  perform app_private.ei_debtor_partition_check(p_partition,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id);
  with scoped as materialized (
    select (b.bill).*,b.age as age_days,b.bucket_no,
      (b.bill).outstanding_amount_tally_value*b.company_polarity as company_amount,
      (b.bill).outstanding_amount_tally_value*b.party_polarity as party_amount
    from app_private.ei_debtor_ageing_bills(v_date,p_bounds,p_age_min,p_age_max,
      p_group_filter,'',p_party,p_region_id,p_godown_id,p_district_id,p_area_id,p_type_id,p_partition) b
    where b.selected
  ), page as (
    select * from scoped
    order by mis_group_name,party_name,age_days desc nulls last,bill_id limit p_limit offset p_offset
  )
  select jsonb_build_object('as_of',v_date,'total_rows',(select count(*) from scoped),
    'groups',(select coalesce(jsonb_agg(to_jsonb(g) order by group_name),'[]') from (
      select group_name,count(*) as bill_count,sum(outstanding_amount_tally_value) as signed_amount,
        sum(company_amount) as company_amount,sum(party_amount) as party_amount
      from scoped group by group_name) g),
    'rows',coalesce(jsonb_agg(to_jsonb(page) order by mis_group_name,party_name,age_days desc nulls last,bill_id),'[]'))
  into v_result from page;
  return v_result;
end;
$$;
-- Extend the existing alert catalogue while retaining the current metadata and old rows.
CREATE OR REPLACE FUNCTION public.ei_management_alerts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) THEN RAISE EXCEPTION 'Executive access denied' USING ERRCODE='42501'; END IF;
 WITH inventory AS (
 SELECT CASE WHEN count(*)=1 THEN max(report_date) END AS report_date,CASE WHEN count(*)=1 THEN max(valuation_gap_item_count) END AS valuation_gap_item_count,CASE WHEN count(*)=1 THEN max(unclassified_item_count) END AS unclassified_item_count,CASE WHEN count(*)=1 THEN max(duplicate_item_row_count) END AS duplicate_item_row_count,CASE WHEN count(*)=1 THEN max(missing_item_id_count) END AS missing_item_id_count FROM public.v_mis_inventory_tab_summary
 ), pipeline AS (
 SELECT CASE WHEN count(*)=1 THEN max(overdue_work_in_process_batch_count) END AS overdue_work_in_process_batch_count FROM public.v_mis_batch_pipeline
 ), fg AS (
 SELECT count(*) AS observed_groups,count(*) FILTER(WHERE recon_status='MISSING_LOG') AS missing_log_groups,max(transfer_date) AS evidence_date
 FROM public.v_fg_transfer_reconciliation WHERE transfer_date>=date_trunc('month',current_date)::date AND transfer_date<=current_date
 ), debtor_kyc AS (
 SELECT max(report_date) AS evidence_date,
   count(DISTINCT coalesce('debtor:'||debtor_id,'ledger:'||nullif(lower(btrim(party_name)),'')))
     FILTER (WHERE group_name='Sundry Debtors' AND kyc_status<>'ACTIVE') AS findings,
   coalesce(sum(outstanding_amount_tally_value) FILTER (WHERE group_name='Sundry Debtors' AND kyc_status<>'ACTIVE'),0)
     * CASE WHEN sum(outstanding_amount_tally_value) FILTER (WHERE group_name='Sundry Debtors')<0 THEN -1 ELSE 1 END AS exposure_amount
 FROM public.v_mis_finance_outstanding_detail
 ), alerts AS (
 SELECT v.key,v.label,i.report_date AS evidence_date,v.findings FROM inventory i CROSS JOIN LATERAL (VALUES
 ('inventory.valuation_gap','Inventory valuation gaps',i.valuation_gap_item_count),
 ('inventory.unclassified','Unclassified inventory',i.unclassified_item_count),
 ('inventory.duplicate_identity','Duplicate inventory identities',i.duplicate_item_row_count),
 ('inventory.missing_identity','Missing inventory identities',i.missing_item_id_count)) v(key,label,findings)
 UNION ALL SELECT 'production.overdue_wip','Overdue work in process',current_date,overdue_work_in_process_batch_count FROM pipeline
 UNION ALL SELECT 'fg.missing_log','FG transfer groups missing production log',evidence_date,CASE WHEN observed_groups>0 THEN missing_log_groups END FROM fg
 UNION ALL SELECT 'finance.debtor_kyc_incomplete','Outstanding debtors without active KYC',evidence_date,
   CASE WHEN evidence_date IS NOT NULL THEN findings END FROM debtor_kyc
 )
 SELECT jsonb_build_object('catalogue','INVENTORY_WIP_FG_INTEGRITY','coverage','PARTIAL_CATALOGUE','rows',coalesce(jsonb_agg(to_jsonb(alerts)||jsonb_build_object('state',CASE WHEN findings IS NULL THEN 'UNAVAILABLE' WHEN findings>0 THEN 'REVIEW' ELSE 'CLEAR' END,'severity','REVIEW_ONLY') || CASE WHEN key='finance.debtor_kyc_incomplete' THEN jsonb_build_object(
   'exposure_amount',(SELECT CASE WHEN evidence_date IS NOT NULL THEN exposure_amount END FROM debtor_kyc),
   'deep_link',jsonb_build_object('lens','finance','panel','debtor-kyc','partition','unclassified')) ELSE '{}'::jsonb END
 ORDER BY key),'[]'::jsonb)) INTO result FROM alerts;
 RETURN result;
END $function$;
-- Invoker entry points delegate to actor-checked functions in the unexposed schema.

create function public.ei_debtor_save(p_id bigint,p_revision bigint,p_class jsonb,p_profile jsonb,p_action text,p_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_save(p_id,p_revision,p_class,p_profile,p_action,p_reason);
$$;

create function public.ei_debtor_profile(p_id bigint)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_profile(p_id);
$$;

create function public.ei_debtor_register(p_party text,p_reason text)
returns bigint language sql security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_register(p_party,p_reason);
$$;

create function public.ei_debtor_alias_set(p_id bigint,p_party text,p_active boolean,p_revision bigint,p_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_alias_set(p_id,p_party,p_active,p_revision,p_reason);
$$;

create function public.ei_debtor_master_set(p_kind text,p_id bigint,p_godown_id integer,p_revision bigint,p_data jsonb,p_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_master_set(p_kind,p_id,p_godown_id,p_revision,p_data,p_reason);
$$;

create function public.ei_debtor_terms_set(p_debtor bigint,p_type bigint,p_region integer,p_revision bigint,p_discount numeric,p_scheme bigint,p_from date,p_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_terms_write(p_debtor,p_type,p_region,p_revision,p_discount,p_scheme,p_from,false,p_reason);
$$;

create function public.ei_debtor_terms_withdraw(p_debtor bigint,p_revision bigint,p_to date,p_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_terms_write(p_debtor,null,null,p_revision,null,null,p_to,true,p_reason);
$$;

create function public.ei_debtor_terms_get(p_id bigint,p_date date)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_terms_get(p_id,p_date);
$$;

create function public.ei_debtor_terms_history(p_debtor bigint default null,p_type bigint default null,p_region integer default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_terms_history(p_debtor,p_type,p_region,p_limit,p_offset);
$$;

create function public.ei_debtor_scheme_page(p_search text default '',p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_scheme_page(p_search,p_limit,p_offset);
$$;

create function public.ei_debtor_audit_page(p_entity text,p_id bigint default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select app_private.ei_debtor_audit_page(p_entity,p_id,p_limit,p_offset);
$$;

-- Restrict this migration's named function family. Explicitly deny service-role
-- KYC/commercial RPCs while keeping the installed Finance service contract.
do $$
declare
  f record;
  v_shared text[] := array[
    'ei_debtor_effective_status','ei_debtor_filter','ei_debtor_partition_check','ei_debtor_page_check',
    'ei_debtor_ageing_date','ei_debtor_ageing_bills','ei_debtor_ageing_totals'];
  v_public text[] := array[
    'ei_debtor_save','ei_debtor_profile','ei_debtor_register','ei_debtor_alias_set','ei_debtor_master_set',
    'ei_debtor_terms_set','ei_debtor_terms_withdraw','ei_debtor_terms_get','ei_debtor_terms_history',
    'ei_debtor_scheme_page','ei_debtor_audit_page','ei_debtor_register_page','ei_debtor_lookups',
    'get_mis_finance_party_page','get_mis_finance_ageing_summary','get_mis_finance_ageing_party_page','get_mis_finance_bill_page'];
  v_authenticated text[] := array[
    'ei_debtor_require','ei_debtor_save','ei_debtor_profile','ei_debtor_register','ei_debtor_alias_set',
    'ei_debtor_master_set','ei_debtor_terms_write','ei_debtor_terms_get','ei_debtor_terms_history',
    'ei_debtor_scheme_page','ei_debtor_audit_page'];
begin
  for f in
    select n.nspname,p.proname,p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname=any(v_public))
      or (n.nspname='app_private' and (p.proname=any(v_shared) or p.proname=any(v_authenticated)
        or p.proname in ('ei_debtor_audit_write','ei_debtor_audit_immutable','ei_debtor_lock_hierarchy',
                         'ei_debtor_set_reason','ei_debtor_validate_keys','ei_debtor_check_revision','ei_debtor_observed_name')))
  loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role';
    if f.nspname='public' or f.proname=any(v_shared) or f.proname=any(v_authenticated) then
      execute 'grant execute on function '||f.signature||' to authenticated';
    end if;
    if left(f.proname,16)='get_mis_finance_' or f.proname=any(v_shared) then
      execute 'grant execute on function '||f.signature||' to service_role';
    end if;
  end loop;
end;
$$;

revoke all on sequence public.ei_debtor_district_id_seq,public.ei_debtor_area_id_seq,
  public.ei_debtor_type_id_seq,public.ei_debtor_id_seq,public.ei_debtor_type_terms_id_seq,
  public.ei_debtor_terms_override_id_seq,public.ei_debtor_audit_id_seq from public,anon,authenticated,service_role;

comment on function public.get_mis_finance_ageing_summary(date,text,integer[],integer,integer,integer,integer,bigint,bigint,bigint,text)
  is 'Age of latest outstanding snapshot. Filters add an additive receivable subtotal; groups retain company polarity and scope.';
comment on function public.get_mis_finance_ageing_party_page(text,text,date,text,integer[],integer,integer,integer,integer,integer,integer,bigint,bigint,bigint,text)
  is 'Age of latest outstanding snapshot, with polarity normalized independently per selected party after age range. Undated bills are retained.';
comment on function public.get_mis_finance_bill_page(text,text,date,text,integer[],integer,integer,integer,integer,integer,integer,bigint,bigint,bigint,text)
  is 'Canonical bill drill-down and export, ordered deterministically with exact full-selection totals.';

notify pgrst,'reload schema';
