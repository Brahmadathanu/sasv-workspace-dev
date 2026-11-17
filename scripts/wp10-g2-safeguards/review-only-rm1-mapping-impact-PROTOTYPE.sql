-- WP10 RM1 REVIEW ONLY: deferred final-state veto on route-mapping transitions affecting active SKUs.
-- Never run against Supabase without independent owner approval / complete route-writer review.
-- This prototype covers product-, subgroup-, and group-level maps ONLY. Family/route,
-- product_route and sub_groups parent mutations remain unresolved and prevent any global claim.
-- Requires the separately reviewed CL15 activation-parent SHARE lock as an atomic prerequisite.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $rm1_preflight$
begin
 if to_regprocedure('public.fn_wp10_activation_parent_lock()') is null then
  raise exception 'RM1 requires the CL15 parent lock; cannot install standalone';
 end if;
 if to_regprocedure('costing.fn_wp10_rm1_deferred_mapping_impact()') is not null then
  raise exception 'RM1 helper exists; no overwrite';
 end if;
 if exists (select 1 from pg_trigger where tgname in ('trg_wp10_rm1_subgroup_mapping_impact','trg_wp10_rm1_product_mapping_impact','trg_wp10_rm1_group_mapping_impact') and not tgisinternal) then
  raise exception 'RM1 trigger exists; no adopt or overwrite';
 end if;
end $rm1_preflight$;
create function costing.fn_wp10_rm1_deferred_mapping_impact()
returns trigger language plpgsql security definer
set search_path=costing,public,pg_temp
as $rm1$
declare p record; v_json jsonb; v_valid text; v_today date; v_old jsonb; v_new jsonb;
begin
 -- A deferred constraint trigger validates the final multi-row transaction state.
 -- BOTH demotion of an approved mapping AND newly-approved shadowing must be checked.
 -- Specifically: a Draft -> Approved product override can take precedence over a valid
 -- subgroup route; old.status='APPROVED' alone is NOT a sufficient event filter.
 v_new:=to_jsonb(new);
 if tg_op='INSERT' then
   v_old:='{}'::jsonb;
   if new.status is distinct from 'APPROVED' or new.archived_at is not null then return null; end if;
 else
   v_old:=to_jsonb(old);
   if v_old is not distinct from v_new then return null; end if;
   if (old.status is distinct from 'APPROVED' or old.archived_at is not null)
     and (new.status is distinct from 'APPROVED' or new.archived_at is not null)
   then return null; end if;
   -- Ignore metadata-only changes to an already approved mapping.
   if old.status is not distinct from new.status
      and old.route_family_id is not distinct from new.route_family_id
      and old.effective_from is not distinct from new.effective_from
      and old.effective_to is not distinct from new.effective_to
      and old.archived_at is not distinct from new.archived_at
   then return null; end if;
 end if;
 v_today:=costing.fn_wp10_today_ist();
 -- Product FOR UPDATE conflicts with activation's parent SHARE lock, forcing serialisation.
 -- Every evaluated product with one or more active SKUs must retain a valid route.
 for p in
  select distinct pr.id
  from public.products pr
  where (tg_table_name='production_route_family_product_map'
         and pr.id in ((v_old->>'product_id')::integer,(v_new->>'product_id')::integer))
     or (tg_table_name='production_route_family_product_subgroup_map'
         and pr.sub_group_id in ((v_old->>'product_subgroup_id')::integer,(v_new->>'product_subgroup_id')::integer))
     or (tg_table_name='production_route_family_product_group_map'
         and exists (select 1 from public.sub_groups sg where sg.id=pr.sub_group_id
           and sg.product_group_id in ((v_old->>'product_group_id')::integer,(v_new->>'product_group_id')::integer)))
  order by pr.id
 loop
  perform 1 from public.products x where x.id=p.id for update;
  if not exists (select 1 from public.product_skus ps where ps.product_id=p.id and ps.is_active) then
   continue;
  end if;
  begin
   v_json:=costing.fn_validate_effective_product_process_route(p.id,v_today);
   v_valid:=v_json->>'valid';
  exception when others then
   v_valid:=null;
  end;
  if v_valid is distinct from 'true' then
   raise exception using errcode='P0001',
    message=format('WP10_RM1_ROUTE_IMPACT_REJECTED: mapping change would leave active SKU route invalid or unknown for product %s.',p.id),
    detail=format('mapping_table=%s; mapping_id=%s; outcome=%s',tg_table_name,new.id,coalesce(v_valid,'UNKNOWN')),
    hint='Approve a valid effective replacement before changing the old mapping, or deactivate affected SKUs with the governed lifecycle first.';
  end if;
 end loop;
 return null;
end $rm1$;
revoke all on function costing.fn_wp10_rm1_deferred_mapping_impact() from public,anon,authenticated;

create constraint trigger trg_wp10_rm1_product_mapping_impact
after insert or update on costing.production_route_family_product_map
deferrable initially deferred for each row
execute function costing.fn_wp10_rm1_deferred_mapping_impact();
create constraint trigger trg_wp10_rm1_subgroup_mapping_impact
after insert or update on costing.production_route_family_product_subgroup_map
deferrable initially deferred for each row
execute function costing.fn_wp10_rm1_deferred_mapping_impact();
create constraint trigger trg_wp10_rm1_group_mapping_impact
after insert or update on costing.production_route_family_product_group_map
deferrable initially deferred for each row
execute function costing.fn_wp10_rm1_deferred_mapping_impact();
do $rm1_receipts$
declare f oid; t oid; rec record;
begin
 f:=to_regprocedure('costing.fn_wp10_rm1_deferred_mapping_impact()');
 if f is null then raise exception 'RM1 source function missing'; end if;
 execute format('comment on function %s is %L',f::regprocedure,'WP10-RM1-REVIEW md5:'||md5(pg_get_functiondef(f)));
 for rec in select * from (values
   ('costing.production_route_family_product_map','trg_wp10_rm1_product_mapping_impact'),
   ('costing.production_route_family_product_subgroup_map','trg_wp10_rm1_subgroup_mapping_impact'),
   ('costing.production_route_family_product_group_map','trg_wp10_rm1_group_mapping_impact')
 ) as x(tbl,tg) loop
  select oid into t from pg_trigger
   where tgrelid=rec.tbl::regclass and tgname=rec.tg and not tgisinternal;
  if t is null then raise exception 'RM1 trigger receipt target missing: %',rec.tg; end if;
  execute format('comment on trigger %I on %s is %L',
    rec.tg,rec.tbl,'WP10-RM1-REVIEW md5:'||md5(pg_get_triggerdef(t)));
 end loop;
end $rm1_receipts$;
commit;
