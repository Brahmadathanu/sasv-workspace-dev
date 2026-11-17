-- WP10 RM1 REVIEW-ONLY: rollback the 3-arg COMPATIBILITY RPC, not the audit log.
-- CAUTION: clients still sending p_inactivation_reason will fail after this rollback.
-- Existing two-arg legacy RPC is preserved and can bypass compulsory reason capture.
-- The private audit table and every historical audit row are RETAINED. No CASCADE.
-- Not authorised for production execution.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $receipt$
declare v oid; actual text; prefix constant text:='WP10-RM1-REASON-REVIEW md5:';
begin
 v:=to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text)');
 if v is null then raise exception 'Reason wrapper missing; fail-closed rollback'; end if;
 actual:=obj_description(v,'pg_proc');
 if actual is null or left(actual,length(prefix))<>prefix or
 substring(actual from length(prefix)+1)<>md5(pg_get_functiondef(v))
 then raise exception 'Reason wrapper definition receipt has drifted'; end if;
 if to_regclass('costing.production_route_family_product_subgroup_inactivation_audit') is null
 then raise exception 'Audit retention target missing; do not roll back'; end if;
 if to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)') is null
 then raise exception 'Governed legacy RPC missing; do not roll back'; end if;
end $receipt$;
drop function public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text);
-- Intentionally no DROP TABLE and no DELETE FROM audit.
commit;
