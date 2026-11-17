-- WP10 RM1 REVIEW ONLY / NOT APPROVED FOR PRODUCTION.
-- Drops ONLY candidate RM1 mapping-check triggers and the private helper, preserving
-- original Route Manager RPCs, approved history, CL15/05 and all Phase1 WP10 components.
-- Refuses on object changes, unexpected missing targets or receipt drift. No CASCADE.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $rollback$
declare rec record; v oid; comment_text text; prefix constant text:='WP10-RM1-REVIEW md5:';
begin
  v:=to_regprocedure('costing.fn_wp10_rm1_deferred_mapping_impact()');
  if v is null then raise exception 'RM1 rollback denied: function missing'; end if;
  comment_text:=obj_description(v,'pg_proc');
  if comment_text is null or left(comment_text,length(prefix))<>prefix
     or substring(comment_text from length(prefix)+1)<>md5(pg_get_functiondef(v))
  then raise exception 'RM1 rollback denied: helper receipt drift'; end if;
  for rec in select * from (values
    ('costing.production_route_family_product_map','trg_wp10_rm1_product_mapping_impact'),
    ('costing.production_route_family_product_subgroup_map','trg_wp10_rm1_subgroup_mapping_impact'),
    ('costing.production_route_family_product_group_map','trg_wp10_rm1_group_mapping_impact')
  ) as x(tbl,tg) loop
    select t.oid into v from pg_trigger t
    where t.tgrelid=rec.tbl::regclass and t.tgname=rec.tg and not t.tgisinternal;
    if v is null then raise exception 'RM1 rollback denied: trigger missing %',rec.tg; end if;
    comment_text:=obj_description(v,'pg_trigger');
    if comment_text is null or left(comment_text,length(prefix))<>prefix
      or substring(comment_text from length(prefix)+1)<>md5(pg_get_triggerdef(v))
    then raise exception 'RM1 rollback denied: trigger receipt drift %',rec.tg; end if;
  end loop;
end $rollback$;
drop trigger trg_wp10_rm1_product_mapping_impact on costing.production_route_family_product_map;
drop trigger trg_wp10_rm1_subgroup_mapping_impact on costing.production_route_family_product_subgroup_map;
drop trigger trg_wp10_rm1_group_mapping_impact on costing.production_route_family_product_group_map;
drop function costing.fn_wp10_rm1_deferred_mapping_impact();
commit;
