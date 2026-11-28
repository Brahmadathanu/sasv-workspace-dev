-- Run as a privileged connection. Both SET LOCAL changes expire with the
-- transaction. The data returned contains no identity or profile fields.
begin read only;
set local statement_timeout='15s';
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from public.user_permissions_canonical where target='module:executive-mis-dashboard'
         and can_view order by user_id limit 1),'role','authenticated')::text,true) is not null as configured;
set local role authenticated;

do $$
begin
  if not public.ei_can_read_executive() then raise exception 'Missing executive actor'; end if;
  begin
    perform public.ei_debtor_profile(1::bigint);
    raise exception 'Unexpected KYC permission for executive-only actor';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ei_debtor_terms_get(1::bigint,current_date);
    raise exception 'Unexpected commercial permission for executive-only actor';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select jsonb_build_object(
  'alerts',public.ei_management_alerts(),
  'ageing',public.get_mis_finance_ageing_summary(),
  'can_read_finance',public.ei_can_read_executive(),
  'assignable_targets',(select jsonb_agg(key order by key) from public.permission_targets
    where kind='role' and is_assignable and key in ('role:ei-debtor-kyc','role:ei-debtor-commercial')),
  'bill_page',(select jsonb_build_object('size',jsonb_array_length(j->'rows'),'total_rows',j->'total_rows')
    from (select public.get_mis_finance_bill_page(p_group_filter=>'receivables',p_limit=>2) as j) p),
  'confidential_rpcs_denied',true
) as obj;
rollback;
