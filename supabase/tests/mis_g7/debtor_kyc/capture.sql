create table fixture.before as
select public.get_mis_finance_ageing_summary() as default_ageing,
  public.get_mis_finance_ageing_summary(p_as_of=>'2026-11-28',p_bounds=>array[15,30,60,90,180],
                                       p_age_min=>31,p_age_max=>90) as custom_ageing,
  (select jsonb_agg(to_jsonb(p)) from public.get_mis_finance_party_page(p_group_filter=>'all',p_limit=>100) p) as parties,
  (select jsonb_agg(to_jsonb(p)) from public.get_mis_finance_ageing_party_page(p_group_filter=>'all',
     p_search=>'Al',p_age_min=>31,p_age_max=>90,p_limit=>100) p) as filtered_parties,
  (select jsonb_agg(to_jsonb(p)) from public.get_mis_finance_ageing_party_page() p) as default_parties;
select fixture.claim(1);
alter table fixture.before add column alerts jsonb;
update fixture.before set alerts=public.ei_management_alerts();
grant select on fixture.before to authenticated,service_role;
