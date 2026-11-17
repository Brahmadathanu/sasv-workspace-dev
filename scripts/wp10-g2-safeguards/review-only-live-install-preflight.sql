-- WP10 05+CL15+RM1 independent live PRE-FLIGHT / NO WRITERS.
-- Safe to execute on the authorised Supabase project in a READ-ONLY transaction.
-- Any FAIL/DRIFT/UNKNOWN must block installation until independently reconciled.
-- Output = one JSON document. This DOES NOT install or approve anything.
begin read only;
set local statement_timeout='20s';
with expected(signature,expected_md5) as (
 values
 ('public.rpc_approve_product_route(bigint,text)','d4dc989e28e8b096a9abb5300349965a'),
 ('public.rpc_approve_product_route_family_assignment(bigint,text,date)','11c3bad591333b9991c92c992af6c44f'),
 ('public.rpc_approve_product_subgroup_route_family_mapping(bigint,text,date)','aa730dd371974f479828c7974e2abb63'),
 ('public.rpc_approve_route_family_mapping(bigint,text,date)','afad5c67f5cef27700aafdee90f2416c'),
 ('public.rpc_approve_route_family_route(bigint,text)','4f410336d48374f448c07eb29c917038'),
 ('public.rpc_inactivate_product_route_family_assignment(bigint,date)','a6ce1b4ba1bd009a7974eff63e74da17'),
 ('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)','0e8f4efd43c3f527ddde5f9527e02391'),
 ('public.rpc_supersede_product_route(bigint,bigint)','8b80bd77d82ad3a0158f797e93cd8326'),
 ('public.rpc_supersede_route_family_route(bigint,bigint)','a450c7e1300797271924c10321e66f55'),
 ('costing.fn_validate_effective_product_process_route(integer,date)','a9396f97a23cba5bbaceada07bc6448a'),
 ('costing.fn_resolve_effective_product_process_route(integer,date)','3c5a292804748daf679605382e1691fb'),
 ('costing.fn_resolve_effective_route_family_route(integer,date)','5d7ac1d9e0427eae90b590ead55fe58a')
),
functions as (
 select signature,expected_md5,
  case when to_regprocedure(signature) is null then null
       else md5(pg_get_functiondef(to_regprocedure(signature))) end live_md5
 from expected
),
candidate(sig) as (
 values
 ('public.fn_wp10_product_route_impact_before()'),
 ('public.fn_wp10_product_route_impact_after()'),
 ('public.fn_wp10_activation_parent_lock()'),
 ('costing.fn_wp10_rm1_deferred_mapping_impact()'),
 ('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text)'),
 ('costing.fn_wp10_rm1_reason_audit_immutable()')
),
candidate_triggers(tgname) as (
 values ('trg_wp10_product_route_impact_before'),('trg_wp10_product_route_impact_after'),
 ('trg_aa_wp10_activation_parent_lock'),('trg_wp10_rm1_product_mapping_impact'),
 ('trg_wp10_rm1_subgroup_mapping_impact'),('trg_wp10_rm1_group_mapping_impact'),
 ('trg_wp10_rm1_reason_audit_immutable'),('trg_wp10_rm1_reason_audit_no_truncate')
),
metrics as (
 select
  (select count(*) from costing.production_route_family_product_group_map m
   where m.status='APPROVED' and m.archived_at is null) approved_group_mappings,
  (select count(*) from costing.production_route_family_product_map m
   where m.status='APPROVED' and m.archived_at is null) approved_product_mappings,
  (select count(*) from costing.production_route_family_product_subgroup_map m
   where m.status='APPROVED' and m.archived_at is null) approved_subgroup_mappings,
  (select count(*) from candidate where to_regprocedure(sig) is not null) unexpected_candidate_functions,
  (select count(*) from pg_trigger where not tgisinternal
   and tgname in (select tgname from candidate_triggers)) unexpected_candidate_triggers,
  has_table_privilege('authenticated','public.sub_groups','UPDATE') authenticated_subgroup_update,
  has_table_privilege('authenticated','public.product_groups','UPDATE') authenticated_group_update,
  has_table_privilege('authenticated','costing.production_route_family_product_map','UPDATE') authenticated_direct_mapping_update,
  (select count(*) from information_schema.tables
   where table_schema='costing' and table_name='production_route_family_product_subgroup_inactivation_audit') preexisting_audit_tables
)
select jsonb_pretty(jsonb_build_object(
 'classification','WP10_REVIEW_ONLY_READ_ONLY_PREFLIGHT',
 'checked_at',now(),
 'rpc_definition_parity', (select jsonb_agg(jsonb_build_object('sig',signature,'match',live_md5=expected_md5,
   'live_md5',live_md5,'expected_md5',expected_md5) order by signature) from functions),
 'rpc_drift_count',(select count(*) from functions where live_md5 is distinct from expected_md5),
 'candidate_functions_preinstalled',metrics.unexpected_candidate_functions,
 'candidate_triggers_preinstalled',metrics.unexpected_candidate_triggers,
 'audit_table_preexists',metrics.preexisting_audit_tables,
 'approved_product_mappings',metrics.approved_product_mappings,
 'approved_subgroup_mappings',metrics.approved_subgroup_mappings,
 'approved_group_mappings',metrics.approved_group_mappings,
 'authenticated_subgroup_parent_update',metrics.authenticated_subgroup_update,
 'authenticated_group_update',metrics.authenticated_group_update,
 'authenticated_direct_mapping_update',metrics.authenticated_direct_mapping_update,
 'next_action',case when
 (select count(*) from functions where live_md5 is distinct from expected_md5)>0
 or metrics.unexpected_candidate_functions>0
 or metrics.unexpected_candidate_triggers>0
 or metrics.preexisting_audit_tables>0
 or metrics.approved_group_mappings>0
 then 'STOP_AND_RECONCILE' else 'REVIEW_ROLE_LOCK_FLEET_AND_OWNER_APPROVAL_STILL_REQUIRED' end
)) as wp10_read_only_preflight
from metrics;
commit;
