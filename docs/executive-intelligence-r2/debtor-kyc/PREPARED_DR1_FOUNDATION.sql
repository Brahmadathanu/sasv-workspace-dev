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
