-- WP10 RM1 REVIEW ONLY: deferred final-state veto on route-mapping transitions affecting active SKUs.
-- Never run against Supabase without independent owner approval / complete route-writer review.
-- This prototype covers product-level and subgroup-level maps ONLY. Group, family/route,
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
 if exists (select 1 from pg_trigger where tgname in ('trg_wp10_rm1_subgroup_mapping_impact','trg_wp10_rm1_product_mapping_impact') and not tgisinternal) then
  raise exception 'RM1 trigger exists; no adopt or overwrite';
 end if;
end $rm1_preflight$;
create function costing.fn_wp10_rm1_deferred_mapping_impact()
returns trigger language plpgsql security definer
set search_path=costing,public,pg_temp
as $rm1$
declare p record; v_json jsonb; v_valid text; v_today date;
begin
 -- A deferred constraint trigger sees final multi-row replacement state at COMMIT.
 -- Inactive/terminal history edits unrelated to a formerly approved map are untouched.
 if old.status is distinct from 'APPROVED' or old.archived_at is not null then return null; end if;
 if to_jsonb(old) is not distinct from to_jsonb(new) then return null; end if;
 -- Ignore immutable metadata-only changes; protect only route-affecting transitions.
 if old.status is not distinct from new.status
    and old.route_family_id is not distinct from new.route_family_id
    and old.effective_from is not distinct from new.effective_from
    and old.effective_to is not distinct from new.effective_to
    and old.archived_at is not distinct from new.archived_at
 then return null; end if;
 v_today:=costing.fn_wp10_today_ist();
 -- Product FOR UPDATE conflicts with activation's parent SHARE lock, forcing serialisation.
 -- Every evaluated product with one or more active SKUs must retain a valid route.
 for p in
  select distinct pr.id
  from public.products pr
  where (tg_table_name='production_route_family_product_map'
         and pr.id in ((to_jsonb(old)->>'product_id')::integer,(to_jsonb(new)->>'product_id')::integer))
     or (tg_table_name='production_route_family_product_subgroup_map'
         and pr.sub_group_id in ((to_jsonb(old)->>'product_subgroup_id')::integer,(to_jsonb(new)->>'product_subgroup_id')::integer))
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
after update on costing.production_route_family_product_map
deferrable initially deferred for each row
execute function costing.fn_wp10_rm1_deferred_mapping_impact();
create constraint trigger trg_wp10_rm1_subgroup_mapping_impact
after update on costing.production_route_family_product_subgroup_map
deferrable initially deferred for each row
execute function costing.fn_wp10_rm1_deferred_mapping_impact();
commit;
