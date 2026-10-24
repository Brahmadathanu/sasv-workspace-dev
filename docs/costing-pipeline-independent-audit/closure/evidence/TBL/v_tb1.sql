begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b8fd6239-cc4b-4123-87d0-0a89fc2c84bd',true);
select set_config('request.jwt.claims','{"sub":"b8fd6239-cc4b-4123-87d0-0a89fc2c84bd","role":"authenticated"}',true);
select jsonb_build_object(
 'reads_as_ordinary', jsonb_build_object('stock_by_name',(select count(*) from public.tally_stock_by_name),'purchases',(select count(*) from public.tally_purchases_vreg_snapshot),'rm_rms',(select count(*) from public.tally_rm_rms_stock_snapshot),'etl_jobs',(select count(*) from public.etl_jobs)),
 'ordinary_is_etl_admin', public.is_etl_admin('b8fd6239-cc4b-4123-87d0-0a89fc2c84bd'),
 'cost_user_is_etl_admin', public.is_etl_admin('dff17104-c02a-4bca-95b1-e8ddff46a9b6'),
 'auth_truncate', (select count(*) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and (c.relname like 'tally%' or c.relname='etl_jobs') and has_table_privilege('authenticated',c.oid,'TRUNCATE')),
 'anon_any', (select count(*) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and (c.relname like 'tally%' or c.relname='etl_jobs') and has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')),
 'svc_write', (select count(*) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and (c.relname like 'tally%' or c.relname='etl_jobs') and has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')),
 'svc_bypassrls', (select rolbypassrls from pg_roles where rolname='service_role'),
 'write_pols', (select count(*) from pg_policies where schemaname='public' and policyname like '%_etl_admin_write'),
 'crud_pols', (select count(*) from pg_policies where schemaname='public' and policyname like '%_authenticated_crud')
) r;
