-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_enforce_prm_approval_reference()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'APPROVED'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'APPROVED'
       or new.approval_reference is distinct from old.approval_reference
     )
  then
    if new.approval_reference is null
       or new.approval_reference !~ '^PRM-[A-Za-z0-9][A-Za-z0-9._-]*$'
    then
      raise exception 'APPROVAL_REFERENCE_MUST_USE_PRM_FORMAT: table=%, id=%, reference=%',
        tg_table_name,
        coalesce(new.id::text,'<new>'),
        coalesce(new.approval_reference,'<null>');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_prm_approval_reference on costing.production_route_family;
create trigger trg_enforce_prm_approval_reference
before insert or update on costing.production_route_family
for each row execute function costing.fn_enforce_prm_approval_reference();

drop trigger if exists trg_enforce_prm_approval_reference on costing.production_route_family_route;
create trigger trg_enforce_prm_approval_reference
before insert or update on costing.production_route_family_route
for each row execute function costing.fn_enforce_prm_approval_reference();

drop trigger if exists trg_enforce_prm_approval_reference on costing.production_route_family_product_map;
create trigger trg_enforce_prm_approval_reference
before insert or update on costing.production_route_family_product_map
for each row execute function costing.fn_enforce_prm_approval_reference();

drop trigger if exists trg_enforce_prm_approval_reference on costing.product_process_route;
create trigger trg_enforce_prm_approval_reference
before insert or update on costing.product_process_route
for each row execute function costing.fn_enforce_prm_approval_reference();

drop trigger if exists trg_enforce_prm_approval_reference on costing.production_cost_centre;
create trigger trg_enforce_prm_approval_reference
before insert or update on costing.production_cost_centre
for each row execute function costing.fn_enforce_prm_approval_reference();