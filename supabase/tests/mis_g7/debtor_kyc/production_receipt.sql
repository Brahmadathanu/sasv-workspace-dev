-- Production verification. Run with the migration runner's read access.
-- This statement returns aggregates and catalogue evidence, never private records.
with detail as materialized (
  select * from public.v_mis_finance_outstanding_detail
), ageing as (
  select public.get_mis_finance_ageing_summary() as original_default,
         public.get_mis_finance_ageing_summary(p_bounds=>array[15,30,60,90,180],p_age_min=>31,p_age_max=>90) as original_custom,
         public.get_mis_finance_ageing_summary(p_partition=>'unclassified') as unclassified
), report_fingerprints as (
  select (select md5(jsonb_agg(to_jsonb(p)-array['debtor_id','region_id','godown_id','district_id','area_id','type_id','kyc_status'])::text)
    from public.get_mis_finance_party_page('all','',100,0) p) as legacy_party,
   (select md5(jsonb_agg(to_jsonb(p)-array['debtor_id','region_id','godown_id','district_id','area_id','type_id','kyc_status'])::text)
    from public.get_mis_finance_ageing_party_page('all','',null,'bill_date',array[15,30,60,90,180],31,90,200,0) p) as ageing_party
), kyc_tables as (
  select c.oid,c.relname,c.relrowsecurity
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and (c.relname='ei_debtor' or left(c.relname,10)='ei_debtor_')
), public_functions as (
  select p.oid,p.proname,p.pronargs,p.pronargdefaults
  from pg_proc p where p.pronamespace='public'::regnamespace and
    (left(p.proname,10)='ei_debtor_' or p.proname in
      ('get_mis_finance_party_page','get_mis_finance_ageing_summary','get_mis_finance_ageing_party_page','get_mis_finance_bill_page'))
)
select jsonb_build_object(
  'server_version',current_setting('server_version'),
  'migration',(select to_jsonb(m) from (select version,name,cardinality(statements) as statement_entries,
    encode(sha256(convert_to(statements[1],'UTF8')),'hex') as first_statement_sha256
    from supabase_migrations.schema_migrations where name='ei_r8_debtor_kyc_canonical') m),
  'detail',(select jsonb_agg(to_jsonb(d) order by group_name) from (
    select group_name,max(report_date) as report_date,count(*) as bills,count(distinct party_name) as parties,
      sum(outstanding_amount_tally_value) as signed from detail group by group_name) d),
  'company',(select to_jsonb(f) from public.v_mis_finance_tab_summary f limit 1),
  'ageing',(select original_default from ageing),
  'custom',(select original_custom from ageing),
  'unclassified',(select unclassified->'filtered_receivables' from ageing),
  'region_partitions',(select jsonb_object_agg(code,public.get_mis_finance_ageing_summary(p_region_id=>id)->'filtered_receivables') from public.regions),
  'fingerprints',(select to_jsonb(report_fingerprints) from report_fingerprints),
  'register',jsonb_build_object(
    'identities',(select count(*) from public.ei_debtor),'aliases',(select count(*) from public.ei_debtor_alias),
    'districts',(select count(*) from public.ei_debtor_district),'types',(select count(*) from public.ei_debtor_type),
    'classifications',(select count(*) from public.ei_debtor_classification),
    'profiles',(select count(*) from public.ei_debtor_kyc),'areas',(select count(*) from public.ei_debtor_area),
    'coverage',(select count(*) from public.ei_debtor_godown_district),
    'audit',(select count(*) from public.ei_debtor_audit),'overrides',(select count(*) from public.ei_debtor_terms_override),
    'type_terms',(select count(*) from public.ei_debtor_type_terms)),
  'permissions',jsonb_build_object(
    'assignable_targets',(select jsonb_agg(key order by key) from public.permission_targets
      where kind='role' and is_assignable and key in ('role:ei-debtor-kyc','role:ei-debtor-commercial')),
    'new_assignments',(select count(*) from public.user_permissions_canonical
      where target in ('role:ei-debtor-kyc','role:ei-debtor-commercial')),
    'executive_users',(select count(*) from public.user_permissions_canonical
      where target='module:executive-mis-dashboard' and can_view),
    'rls_tables',(select count(*) from kyc_tables where relrowsecurity),
    'direct_client_dml',(select count(*) from kyc_tables t cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
      where has_table_privilege(r.role_name,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE')),
    'direct_client_pii',(select count(*) from (values ('anon'),('authenticated'),('service_role')) r(role_name)
      where has_column_privilege(r.role_name,'public.ei_debtor_kyc','contact_person','SELECT')),
    'anonymous_rpc_exec',(select count(*) from public_functions where has_function_privilege('anon',oid,'EXECUTE')),
    'service_kyc_exec',(select count(*) from public_functions where left(proname,10)='ei_debtor_'
      and has_function_privilege('service_role',oid,'EXECUTE'))),
  'contracts',jsonb_build_object(
    'finance_signatures',(select jsonb_object_agg(proname,jsonb_build_array(pronargs,pronargdefaults))
      from public_functions where left(proname,16)='get_mis_finance_'),
    'finance_overloads',(select count(*) from (select proname from public_functions
      where left(proname,16)='get_mis_finance_' group by proname having count(*)<>1) f),
    'parallel_or_versioned_endpoints',(select count(*) from public_functions
      where proname ~ '_v[0-9]+$' or proname in
        ('ei_debtor_ageing','ei_debtor_alert','ei_debtor_bills','ei_debtor_summary','ei_debtor_party_page')),
    'interval_constraints',(select count(*) from pg_constraint where contype='x' and conname like 'ei_debtor_%_nonoverlap'),
    'finance_security_views',(select count(*) from pg_class where oid in
      ('public.v_mis_finance_outstanding_detail'::regclass,'public.v_mis_finance_outstanding_party_summary'::regclass)
      and reloptions @> array['security_invoker=true','security_barrier=true']))) as obj;
