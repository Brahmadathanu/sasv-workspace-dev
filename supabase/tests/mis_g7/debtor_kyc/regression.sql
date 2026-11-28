\set metadata '''{debtor_id,region_id,godown_id,district_id,area_id,type_id,kyc_status}''::text[]'
select fixture.check('PostgreSQL 17 fixture',current_setting('server_version_num')::int/10000=17);
select fixture.check('historical identities only',
  (select count(*) from public.ei_debtor)=4 and (select count(*) from public.ei_debtor_alias)=4
  and (select count(*) from public.ei_debtor_district)=14 and (select count(*) from public.ei_debtor_type)=12
  and (select count(*) from public.ei_debtor_type where not is_active)=3
  and not exists(select 1 from public.ei_debtor_audit)
  and not exists(select 1 from public.ei_debtor_classification));
select fixture.check('two effective exclusion constraints',
  (select count(*) from pg_constraint where contype='x' and conname like 'ei_debtor_%_nonoverlap')=2);
select fixture.check('one unversioned RPC for each installed Finance contract',
  (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in
    ('get_mis_finance_party_page','get_mis_finance_ageing_summary','get_mis_finance_ageing_party_page'))=3
  and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace
    and (proname ~ '^ei_debtor_.*_v[0-9]+$' or proname in ('ei_debtor_bills','ei_debtor_summary','ei_debtor_party_page','ei_debtor_ageing','ei_debtor_alert'))));
select fixture.check('Finance views retain security settings',
  (select count(*) from pg_class where oid in ('public.v_mis_finance_outstanding_detail'::regclass,
   'public.v_mis_finance_outstanding_party_summary'::regclass)
   and reloptions @> array['security_invoker=true','security_barrier=true'])=2);
select fixture.check('no direct client DML across all KYC tables',
  not exists (select 1 from pg_tables t cross join (values ('anon'),('authenticated'),('service_role')) as r(role_name)
    where t.schemaname='public' and t.tablename like 'ei_debtor%'
      and has_table_privilege(r.role_name,format('public.%I',t.tablename),'INSERT, UPDATE, DELETE, TRUNCATE')));
select fixture.check('no direct profile, terms or audit read',
  not exists (select 1 from (values ('anon'),('authenticated'),('service_role')) as r(role_name)
    cross join (values ('ei_debtor_kyc'),('ei_debtor_audit'),('ei_debtor_type_terms'),('ei_debtor_terms_override')) as t(tablename)
    where has_table_privilege(r.role_name,'public.'||t.tablename,'SELECT'))
  and not has_column_privilege('authenticated','public.ei_debtor_kyc','contact_person','SELECT'));
select fixture.check('private internal functions deny direct client execution',
  not has_function_privilege('authenticated','app_private.ei_debtor_set_reason(text)','EXECUTE')
  and not has_function_privilege('authenticated','app_private.ei_debtor_audit_write()','EXECUTE')
  and not has_function_privilege('service_role','app_private.ei_debtor_terms_write(bigint,bigint,integer,bigint,numeric,bigint,date,boolean,text)','EXECUTE'));

select fixture.claim(1);
set role authenticated;
select fixture.check('assignable role targets visible to Admin Console query',
  (select count(*) from public.permission_targets where is_assignable and kind='role'
    and key in ('role:ei-debtor-kyc','role:ei-debtor-commercial'))=2);
select fixture.check('default ageing exact JSON parity',public.get_mis_finance_ageing_summary()=(select default_ageing from fixture.before));
select fixture.check('named range and custom ageing exact JSON parity',
  public.get_mis_finance_ageing_summary(p_as_of=>'2026-11-28',p_bounds=>array[15,30,60,90,180],p_age_min=>31,p_age_max=>90)
  =(select custom_ageing from fixture.before));
select fixture.check('named legacy party page exact legacy fields',
  (select jsonb_agg(to_jsonb(p)-:metadata) from public.get_mis_finance_party_page(p_group_filter=>'all',p_limit=>100) p)
  =(select parties from fixture.before));
select fixture.check('default ageing party page exact legacy fields',
  (select jsonb_agg(to_jsonb(p)-:metadata) from public.get_mis_finance_ageing_party_page() p)
  =(select default_parties from fixture.before));
select fixture.check('party polarity after search and age range',
  (select jsonb_agg(to_jsonb(p)-:metadata) from public.get_mis_finance_ageing_party_page(p_group_filter=>'all',
    p_search=>'Al',p_age_min=>31,p_age_max=>90,p_limit=>100) p)=(select filtered_parties from fixture.before));
select fixture.check('undated survives custom range',
  (public.get_mis_finance_ageing_summary(p_age_min=>31,p_age_max=>90)#>>'{groups,1,undated_bill_count}')::int=2);
select fixture.check('old management catalogue and all six rows unchanged',
  (select (a-'rows')||jsonb_build_object('rows',
    (select jsonb_agg(e order by e->>'key') from jsonb_array_elements(a->'rows') e where e->>'key'<>'finance.debtor_kyc_incomplete'))
   from (select public.ei_management_alerts() as a) q)=(select alerts from fixture.before));
select fixture.check('initial alert counts only outstanding parties',
  exists (select from jsonb_array_elements(public.ei_management_alerts()->'rows') e
     where e->>'key'='finance.debtor_kyc_incomplete' and (e->>'findings')::int=3
     and (e->>'exposure_amount')::numeric=107 and e#>>'{deep_link,partition}'='unclassified'));
select fixture.check('lookups preserve authoritative master keys',
  jsonb_array_length(public.ei_debtor_lookups()->'districts')=14
  and jsonb_array_length(public.ei_debtor_lookups()->'godowns')=2);
select fixture.check('historical register bounded and exact total on empty page',
  (public.ei_debtor_register_page(p_search=>'Historical',p_limit=>1)#>>'{rows,0,ledger_name}')='Historical only'
  and (public.ei_debtor_register_page(p_limit=>1,p_offset=>99)->>'total_rows')::int=4
  and public.ei_debtor_register_page(p_limit=>1,p_offset=>99)->'rows'='[]'::jsonb);
select id from public.ei_debtor where ledger_name='Alpha' \gset alpha_
select id from public.ei_debtor where ledger_name='Bravo' \gset bravo_
select id from public.ei_debtor_district where district_name='Thrissur' \gset ik_
select id from public.ei_debtor_type where code='AGENCY' \gset type_
select fixture.denied('cross-region coverage rejected',
  format('select public.ei_debtor_master_set(''coverage'',%s,20,0,''{}'',''test'')',:ik_id),'23514');
select public.ei_debtor_master_set('district',null,null,0,'{"region_id":2,"state_name":"Test State","district_name":"Test District"}','fixture') as ok \gset
select (:'ok'::jsonb->>'id')::bigint as id \gset ok_
select public.ei_debtor_master_set('coverage',:ik_id,10,0,'{}','fixture');
select public.ei_debtor_master_set('coverage',:ok_id,20,0,'{}','fixture');
select public.ei_debtor_master_set('area',null,null,0,jsonb_build_object('district_id',:ik_id,'area_name','Test IK'),'fixture') as ik_area \gset
select public.ei_debtor_master_set('area',null,null,0,jsonb_build_object('district_id',:ok_id,'area_name','Test OK'),'fixture') as ok_area \gset
select (:'ik_area'::jsonb->>'id')::bigint as id \gset ik_area_
select (:'ok_area'::jsonb->>'id')::bigint as id \gset ok_area_
select jsonb_build_object('region_id',1,'godown_id',10,'district_id',:ik_id,'type_id',:type_id) as missing \gset
select (:'missing'::jsonb||jsonb_build_object('area_id',:ik_area_id)) as alpha_class \gset
select jsonb_build_object('region_id',2,'godown_id',20,'district_id',:ok_id,'area_id',:ok_area_id,'type_id',:type_id) as bravo_class \gset

select fixture.check('incomplete draft saved',public.ei_debtor_save(:alpha_id,0,:'missing',null,'SAVE','draft')->>'status'='DRAFT');
select fixture.denied('mandatory area activation rejection',
  format('select public.ei_debtor_save(%s,1,null,null,''ACTIVATE'',''missing area'')',:alpha_id),'23514');
select fixture.denied('cross-region classification rejected',
  format('select public.ei_debtor_save(%s,1,%L,null,''ACTIVATE'',''cross'')',:alpha_id,:'alpha_class'::jsonb||'{"region_id":2}'),'23514');
select fixture.denied('unknown classification field rejected',
  format('select public.ei_debtor_save(%s,1,''{"updated_by":"forged"}'',null,''SAVE'',''bad'')',:alpha_id),'22023');
select fixture.denied('unknown profile field rejected',
  format('select public.ei_debtor_save(%s,1,null,''{"revision":70}'',''SAVE'',''bad'')',:alpha_id),'22023');
select fixture.check('activate with optional fields and terms NULL',
  public.ei_debtor_save(:alpha_id,1,:'alpha_class',null,'ACTIVATE','fully classified')->>'status'='ACTIVE');
select fixture.check('profile optional fields stay null',
  (public.ei_debtor_profile(:alpha_id)#>'{profile,contact_person}')='null'::jsonb
  and (public.ei_debtor_profile(:alpha_id)#>'{profile,address_line_1}')='null'::jsonb);
select fixture.check('second region active',
  public.ei_debtor_save(:bravo_id,0,:'bravo_class',null,'ACTIVATE','fully classified')->>'status'='ACTIVE');
select fixture.denied('stale profile revision rejected',
  format('select public.ei_debtor_save(%s,1,null,null,''SAVE'',''stale'')',:alpha_id),'40001');
select fixture.denied('active edits require valid classification',
  format('select public.ei_debtor_save(%s,2,%L,null,''SAVE'',''invalid'')',:alpha_id,:'missing'),'23514');
select fixture.check('populated PII stored',
  (public.ei_debtor_save(:alpha_id,2,null,'{"contact_person":"Synthetic Contact","phone":"5550100","verification_status":"VERIFIED"}',
    'SAVE','fixture personal profile')->>'revision')::int=3);

with base as (select public.get_mis_finance_ageing_summary(p_age_min=>31,p_age_max=>90) as s),
ik as (select public.get_mis_finance_ageing_summary(p_age_min=>31,p_age_max=>90,p_region_id=>1) as s),
ok as (select public.get_mis_finance_ageing_summary(p_age_min=>31,p_age_max=>90,p_region_id=>2) as s),
u as (select public.get_mis_finance_ageing_summary(p_age_min=>31,p_age_max=>90,p_partition=>'unclassified') as s)
select fixture.check('regional plus unclassified amounts and counts reconcile with opposing entry',
  (ok.s#>>'{filtered_receivables,total_amount}')::numeric=-30
  and (base.s#>>'{groups,1,total_amount}')::numeric=(ik.s#>>'{filtered_receivables,total_amount}')::numeric
    +(ok.s#>>'{filtered_receivables,total_amount}')::numeric+(u.s#>>'{filtered_receivables,total_amount}')::numeric
  and (base.s#>>'{groups,1,bill_count}')::int=(ik.s#>>'{filtered_receivables,bill_count}')::int
    +(ok.s#>>'{filtered_receivables,bill_count}')::int+(u.s#>>'{filtered_receivables,bill_count}')::int
  and base.s->'groups'=ik.s->'groups' and base.s->'groups'=ok.s->'groups' and base.s->'groups'=u.s->'groups'
  and not exists (select from generate_series(0,3) i where
    (base.s#>>array['groups','1','bucket_amounts',i::text])::numeric is distinct from
      (ik.s#>>array['filtered_receivables','bucket_amounts',i::text])::numeric+
      (ok.s#>>array['filtered_receivables','bucket_amounts',i::text])::numeric+
      (u.s#>>array['filtered_receivables','bucket_amounts',i::text])::numeric))
from base,ik,ok,u;

select fixture.check('Finance selectors classify receivables only and expose no profile',
  (select count(*) from public.get_mis_finance_party_page(p_group_filter=>'all',p_partition=>'classified'))=2
  and not exists (select 1 from public.get_mis_finance_party_page(p_group_filter=>'all') p
    where to_jsonb(p)::text like '%Synthetic Contact%' or to_jsonb(p)::text like '%5550100%'));
select fixture.check('active classification closes alert despite optional gaps',
  exists (select from jsonb_array_elements(public.ei_management_alerts()->'rows') e
     where e->>'key'='finance.debtor_kyc_incomplete' and (e->>'findings')::int=1));
select fixture.denied('master parent edits rejected',
  format('select public.ei_debtor_master_set(''area'',%s,null,1,''{"district_id":10}'',''test'')',:ik_area_id),'22023');
select fixture.check('master deactivation commits revision',
  (public.ei_debtor_master_set('area',:ik_area_id,null,1,'{"is_active":false}','retirement')->>'revision')::int=2);
select fixture.denied('stale master revision rejected',
  format('select public.ei_debtor_master_set(''area'',%s,null,1,''{"is_active":true}'',''test'')',:ik_area_id),'40001');
select fixture.check('invalidated active debtor remains in reports and alerts',
  exists(select from public.get_mis_finance_party_page(p_group_filter=>'receivables',p_partition=>'unclassified')
         where debtor_id=:alpha_id and kyc_status='INVALID' and signed_outstanding_tally_value=95)
  and exists (select from jsonb_array_elements(public.ei_management_alerts()->'rows') e
     where e->>'key'='finance.debtor_kyc_incomplete' and (e->>'findings')::int=2));
select fixture.denied('inactivation requires reason',
  format('select public.ei_debtor_save(%s,3,null,null,''INACTIVATE'','' '')',:alpha_id),'22023');
select fixture.check('inactivate invalidated ACTIVE debtor',
  (public.ei_debtor_save(:alpha_id,3,null,null,'INACTIVATE','inactivate')->>'status')='INACTIVE');
select fixture.denied('inactive debtor cannot reactivate with inactive area',
  format('select public.ei_debtor_save(%s,4,null,null,''ACTIVATE'',''test'')',:alpha_id),'23514');
select fixture.denied('cannot inactivate an inactive debtor',
  format('select public.ei_debtor_save(%s,4,null,null,''INACTIVATE'',''test'')',:alpha_id),'22023');
select public.ei_debtor_master_set('area',:ik_area_id,null,2,'{"is_active":true}','area restored');
select fixture.check('explicit reactivation preserves profile',
  public.ei_debtor_save(:alpha_id,4,null,null,'ACTIVATE','master restored')->>'status'='ACTIVE');
select fixture.check('audit history shows actor and reason',
  (public.ei_debtor_audit_page('ei_debtor_kyc',:alpha_id)#>>'{rows,0,actor_user_id}')='00000000-0000-0000-0000-000000000001'
  and (public.ei_debtor_audit_page('ei_debtor_kyc',:alpha_id)#>>'{rows,0,reason}')='master restored');

reset role;
insert into public.tally_group_outstanding_snapshot
  (id,as_of_date,group_name,bill_date_text,bill_ref,vendor_name,outstanding_amount_value,source_key)
values (11,'2026-11-28','Sundry Debtors','05-Oct-26','K','Unregistered',-1,'k'),
       (12,'2026-11-28','Sundry Debtors','05-Oct-26','L','New account',-3,'l');
set role authenticated;
select fixture.check('new unmatched names appear without losing amounts',
  public.ei_debtor_register_page(p_search=>'New account')#>>'{rows,0,kyc_status}'='UNMAPPED'
  and (public.get_mis_finance_bill_page(p_party=>'Unregistered')#>>'{groups,0,signed_amount}')::numeric=-1);
select fixture.denied('primary alias collision rejected',
  format('select public.ei_debtor_alias_set(%s,''Bravo'',true,0,''test'')',:alpha_id),'23505');
select fixture.denied('primary alias cannot be removed',
  format('select public.ei_debtor_alias_set(%s,''Alpha'',false,1,''test'')',:alpha_id),'22023');
select fixture.check('explicit observed alias resolves identity',
  (public.ei_debtor_alias_set(:alpha_id,' Unregistered ',true,0,'verified rename')->>'debtor_id')::bigint=:alpha_id);
select fixture.denied('alias stale revision rejected',
  format('select public.ei_debtor_alias_set(%s,''Unregistered'',false,0,''test'')',:alpha_id),'40001');
select fixture.check('alias deactivation preserves audit and reservation',
  (public.ei_debtor_alias_set(:alpha_id,'Unregistered',false,1,'alias corrected')->>'revision')::int=2);
select fixture.denied('reserved alias cannot silently be reassigned',
  format('select public.ei_debtor_alias_set(%s,''Unregistered'',true,2,''test'')',:bravo_id),'23505');
select fixture.check('new ledger registration is idempotent',
  public.ei_debtor_register(' New account ','register new') is not null);
select fixture.check('registered case variant resolves same identity',
  public.ei_debtor_register('NEW ACCOUNT','case variant')=(select id from public.ei_debtor where ledger_name='New account'));
select fixture.denied('registration requires observed ledger',
  'select public.ei_debtor_register(''unobserved'',''test'')','22023');

select fixture.claim(4);
select fixture.check('optional commercial terms initially unconfigured',
  public.ei_debtor_terms_get(:alpha_id,'2026-11-28')->>'scheme_source'='UNCONFIGURED'
  and public.ei_debtor_terms_get(:alpha_id,'2026-11-28')->'discount_percent'='null'::jsonb);
select fixture.check('scheme page uses active costing master and No Scheme',
  (public.ei_debtor_scheme_page()->>'total_rows')::int=2 and
  public.ei_debtor_scheme_page(p_search=>'No Scheme')#>>'{rows,0,scheme_name}'='No Scheme');
select public.ei_debtor_terms_set(null,:type_id,1,0,12,2,'2026-11-01','regional defaults');
select public.ei_debtor_terms_set(:alpha_id,null,null,0,0,null,'2026-11-10','explicit zero');
select fixture.check('zero override independently inherits scheme',
  public.ei_debtor_terms_get(:alpha_id,'2026-11-10') @> '{"discount_percent":0,"discount_source":"OVERRIDE","scheme_id":2,"scheme_source":"TYPE"}');
select public.ei_debtor_terms_set(:alpha_id,null,null,1,null,1,'2026-11-15','explicit No Scheme');
select fixture.check('No Scheme override independently inherits discount',
  public.ei_debtor_terms_get(:alpha_id,'2026-11-15') @> '{"discount_percent":12,"discount_source":"TYPE","scheme_id":1,"scheme_name":"No Scheme","scheme_source":"OVERRIDE"}');
select fixture.denied('infinite term date rejected',
  format('select public.ei_debtor_terms_set(%s,null,null,2,0,null,''infinity'',''test'')',:alpha_id),'22023');
select fixture.denied('inactive scheme cannot be selected',
  format('select public.ei_debtor_terms_set(%s,null,null,2,0,3,''2026-11-18'',''test'')',:alpha_id),'22023');
select fixture.denied('backward/overlapping terms rejected',
  format('select public.ei_debtor_terms_set(%s,null,null,2,0,null,''2026-11-13'',''test'')',:alpha_id),'22023');
select fixture.check('withdrawal closes interval and advances revision',
  public.ei_debtor_terms_withdraw(:alpha_id,2,'2026-11-20','withdraw override') @> '{"effective_to":"2026-11-20","revision":3}');
select fixture.check('withdrawal fallback retains previous effective values in history',
  public.ei_debtor_terms_get(:alpha_id,'2026-11-19')->>'scheme_name'='No Scheme'
  and public.ei_debtor_terms_get(:alpha_id,'2026-11-20')->>'scheme_source'='TYPE'
  and public.ei_debtor_terms_history(p_debtor=>:alpha_id,p_limit=>1) @> '{"revision":3,"total_rows":2}');
select fixture.check('commercial audit separately available',
  (public.ei_debtor_audit_page('ei_debtor_terms_override',:alpha_id)#>>'{rows,0,reason}')='withdraw override');
select fixture.denied('commercial role cannot read populated KYC',
  format('select public.ei_debtor_profile(%s)',:alpha_id));
select fixture.denied('commercial role cannot read KYC audit',
  format('select public.ei_debtor_audit_page(''ei_debtor_kyc'',%s)',:alpha_id));
select fixture.claim(6);
select fixture.check('commercial viewer can read terms',
  public.ei_debtor_terms_get(:alpha_id,'2026-11-20')->>'scheme_source'='TYPE');
select fixture.denied('commercial viewer cannot write terms',
  format('select public.ei_debtor_terms_set(%s,null,null,3,0,null,''2026-11-25'',''test'')',:alpha_id));
select fixture.claim(2);
select fixture.check('KYC viewer reads populated profile',
  public.ei_debtor_profile(:alpha_id)#>>'{profile,contact_person}'='Synthetic Contact');
select fixture.denied('KYC viewer cannot mutate',
  format('select public.ei_debtor_save(%s,5,null,null,''SAVE'',''test'')',:alpha_id));
select fixture.denied('KYC viewer cannot read commercial terms',
  format('select public.ei_debtor_terms_get(%s,''2026-11-17'')',:alpha_id));
select fixture.claim(3);
select fixture.denied('executive viewer cannot read populated PII',
  format('select public.ei_debtor_profile(%s)',:alpha_id));
select fixture.denied('private helper rechecks populated PII authorization',
  format('select app_private.ei_debtor_profile(%s)',:alpha_id));
select fixture.denied('direct populated PII column denied','select contact_person from public.ei_debtor_kyc');
select fixture.denied('executive viewer cannot read KYC audit',
  format('select public.ei_debtor_audit_page(''ei_debtor_kyc'',%s)',:alpha_id));
select fixture.check('executive viewer still sees legacy Finance', (select count(*) from public.get_mis_finance_party_page())>0);
select fixture.claim(5);
select fixture.denied('KYC role alone gives no executive profile access',format('select public.ei_debtor_profile(%s)',:alpha_id));
select fixture.denied('no executive access to ageing','select public.get_mis_finance_ageing_summary()');
select fixture.check('no executive access to legacy party data',(select count(*) from public.get_mis_finance_party_page())=0);
select fixture.claim(1,true);
select fixture.denied('anonymous JWT cannot use KYC even with actor grant',format('select public.ei_debtor_profile(%s)',:alpha_id));
select fixture.claim(null);
select fixture.denied('missing UID denied regardless of definer owner',format('select app_private.ei_debtor_profile(%s)',:alpha_id));
reset role;
set role service_role;
select fixture.check('service role retains installed Finance behavior',public.get_mis_finance_ageing_summary() is not null);
select fixture.claim(1);
select fixture.denied('service role cannot invoke KYC with editor JWT',format('select public.ei_debtor_profile(%s)',:alpha_id));
select fixture.denied('service role cannot select PII directly','select contact_person from public.ei_debtor_kyc');
reset role;
set role anon;
select fixture.denied('anon lacks public Finance RPC execute','select public.get_mis_finance_ageing_summary()');
select fixture.denied('anon lacks KYC execute',format('select public.ei_debtor_profile(%s)',:alpha_id));
reset role;

select fixture.claim(4);
select set_config('ei.debtor_audit_reason','test-only direct exclusion check',false);
select fixture.denied('database independently excludes overlapping override',
  format('insert into public.ei_debtor_terms_override(debtor_id,discount_percent,effective_from,reason,revision)
    values (%s,2,%L,%L,4)',:alpha_id,'2026-11-12','test'),'23P01');
select fixture.denied('database independently excludes overlapping default',
  format('insert into public.ei_debtor_type_terms(type_id,region_id,discount_percent,effective_from,reason,revision)
    values (%s,1,2,%L,%L,4)',:type_id,'2026-11-02','test'),'23P01');
select fixture.denied('audit records are immutable even for owner',
  'update public.ei_debtor_audit set reason=''tampered'' where false');
select fixture.denied('audit truncation forbidden','truncate public.ei_debtor_audit');
select fixture.claim(1);
set role authenticated;
select fixture.denied('oversized bill export rejected','select public.get_mis_finance_bill_page(p_limit=>501)','22023');
select fixture.denied('oversized identity page rejected','select public.ei_debtor_register_page(p_limit=>201)','22023');
select fixture.denied('invalid age bounds rejected','select public.get_mis_finance_ageing_summary(p_bounds=>array[60,30])','22023');
select fixture.denied('conflicting partition rejected',
  'select public.get_mis_finance_ageing_summary(p_partition=>''unclassified'',p_region_id=>1)','22023');
with p as (select public.get_mis_finance_bill_page(p_limit=>2) a,
                  public.get_mis_finance_bill_page(p_limit=>2,p_offset=>2) b,
                  public.get_mis_finance_bill_page(p_limit=>2,p_offset=>99) c)
select fixture.check('bill/export pages disjoint with exact totals even beyond final page',
  (a->>'total_rows')::int=11 and (b->>'total_rows')::int=11 and (c->>'total_rows')::int=11
  and c->'rows'='[]' and a->'groups'=b->'groups' and b->'groups'=c->'groups'
  and not exists (select from jsonb_array_elements(a->'rows') a1 join jsonb_array_elements(b->'rows') b1
    on a1->>'bill_id'=b1->>'bill_id')) from p;
select fixture.check('bill drill-down matches party-scoped ageing',
  (public.get_mis_finance_bill_page(p_party=>'Alpha',p_group_filter=>'receivables',p_age_min=>31,p_age_max=>90)
    #>>'{groups,0,party_amount}')::numeric=
  (select outstanding_amount_mis_value from public.get_mis_finance_ageing_party_page(
     p_search=>'Alpha',p_group_filter=>'receivables',p_age_min=>31,p_age_max=>90)));
reset role;

-- Compare latency and exact counts at the checkpoint's current-row scale.
begin;
insert into public.tally_group_outstanding_snapshot
  (id,as_of_date,group_name,bill_date_text,bill_ref,vendor_name,outstanding_amount_value,source_key)
select i,'2026-11-28',case when i%10=0 then 'Sundry Creditors' else 'Sundry Debtors' end,
  '14-Oct-26','N'||i,'Synthetic scale '||i%1480,-i,'n'||i from generate_series(100,5137) i;
set local statement_timeout='2s';
set local role authenticated;
\timing on
select fixture.check('5,049 bills, full receipt and bounded 200-row party response within 2 seconds per query',
  (select count(*) from public.get_mis_finance_ageing_party_page(p_group_filter=>'all',p_limit=>200))=200
  and (public.get_mis_finance_bill_page(p_limit=>1)->>'total_rows')::int=5049);
\timing off
rollback;
