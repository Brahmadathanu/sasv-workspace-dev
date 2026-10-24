-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_route_family_step_immutable()
returns trigger
language plpgsql
set search_path=costing,public
as $$
declare v_status text;
begin
  if tg_op='DELETE' then
    select status into v_status from costing.production_route_family_route where id=old.family_route_id;
    if v_status in('APPROVED','SUPERSEDED','INACTIVE') then
      raise exception 'Steps of an approved or closed Route Family route are immutable; create a new route version';
    end if;
    return old;
  end if;
  select status into v_status from costing.production_route_family_route where id=coalesce(new.family_route_id,old.family_route_id);
  if v_status in('APPROVED','SUPERSEDED','INACTIVE') then
    raise exception 'Steps of an approved or closed Route Family route are immutable; create a new route version';
  end if;
  return new;
end
$$;

drop trigger if exists trg_route_family_immutable on costing.production_route_family;
create trigger trg_route_family_immutable
before update or delete on costing.production_route_family
for each row execute function costing.fn_route_parent_immutable();

drop trigger if exists trg_route_family_mapping_immutable on costing.production_route_family_product_group_map;
create trigger trg_route_family_mapping_immutable
before update or delete on costing.production_route_family_product_group_map
for each row execute function costing.fn_route_parent_immutable();

drop trigger if exists trg_route_family_route_immutable on costing.production_route_family_route;
create trigger trg_route_family_route_immutable
before update or delete on costing.production_route_family_route
for each row execute function costing.fn_route_parent_immutable();

drop trigger if exists trg_route_family_route_step_immutable on costing.production_route_family_route_step;
create trigger trg_route_family_route_step_immutable
before insert or update or delete on costing.production_route_family_route_step
for each row execute function costing.fn_route_family_step_immutable();