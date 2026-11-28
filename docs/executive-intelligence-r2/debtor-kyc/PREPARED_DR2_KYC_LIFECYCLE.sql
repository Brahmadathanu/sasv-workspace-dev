-- PREPARED DR2 lifecycle extension; apply only after DR1 and full fixture verification.
alter table public.ei_debtor_kyc
 add column lifecycle_status text not null default 'DRAFT' check(lifecycle_status in ('DRAFT','ACTIVE','INACTIVE')),
 add column revision bigint not null default 1 check(revision>0),
 add column field_dispositions jsonb not null default '{}'::jsonb check(jsonb_typeof(field_dispositions)='object'),
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
-- Pure validation building block. Dispositions must be explicit and allowed per field.
-- Mandatory fields cannot be bypassed. Additional master/terms validity checks required.
create function public.ei_debtor_kyc_field_errors(p_values jsonb,p_dispositions jsonb)
returns text[] language sql immutable security invoker set search_path=pg_catalog as $$
 select coalesce(array_agg(f.name order by f.ord) filter(where
 case when nullif(btrim(p_values->>f.name),'') is not null then
   upper(btrim(p_values->>f.name)) in ('NA','N/A','NIL') or p_dispositions ? f.name
 else not coalesce((p_dispositions->>f.name)=any(f.allowed),false) end
 ),array[]::text[])
 from (values
 (1,'business_name',array[]::text[]),(2,'contact_person',array['NA']::text[]),
 (3,'address_line_1',array[]::text[]),(4,'address_line_2',array['NA','NIL']),
 (5,'locality',array[]::text[]),(6,'state_name',array[]::text[]),
 (7,'country_name',array[]::text[]),(8,'postal_code',array[]::text[]),
 (9,'phone',array[]::text[]),(10,'alternate_phone',array['NA','NIL']),
 (11,'email',array['NA','NIL']),(12,'gstin',array['NA','NIL']),
 (13,'notes',array['NA','NIL'])
 ) f(ord,name,allowed)
$$;
revoke all on function public.ei_debtor_kyc_field_errors(jsonb,jsonb) from public,anon,authenticated;
-- This building block is not an activation RPC. Full validation must also
-- verify contact format, dispositions/reasons, geography, type, terms,
-- actor/revision, audit, and lifecycle transitions under transaction lock.
-- No client grants on new tables; no direct writes or production execution.
