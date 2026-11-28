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
-- hierarchy, active masters, area applicability, resolved commercial terms,
-- authorized actor, optimistic revision, audit and transactional transitions.
create function public.ei_debtor_classification_field_errors(
 p_region_id integer,p_godown_id integer,p_district_id bigint,p_area_id bigint,
 p_type_id bigint,p_area_required boolean,p_discount numeric,p_scheme_id bigint)
returns text[] language sql immutable security invoker set search_path=pg_catalog as $$
 select array_remove(array[
 case when p_region_id is null then 'region_id' end,
 case when p_godown_id is null then 'godown_id' end,
 case when p_district_id is null then 'district_id' end,
 case when coalesce(p_area_required,true) and p_area_id is null then 'area_id' end,
 case when p_type_id is null then 'type_id' end,
 case when p_discount is null or p_discount not between 0 and 100 then 'discount_percent' end,
 case when p_scheme_id is null then 'scheme_id' end
 ]::text[],null)
$$;
revoke all on function public.ei_debtor_classification_field_errors(integer,integer,bigint,bigint,bigint,boolean,numeric,bigint) from public,anon,authenticated;
-- Not an activation RPC. No direct client grants or production execution.
