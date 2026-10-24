-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_guard_sku_regional_commercial_sales_assumption_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Regional commercial-sales assumption revisions are immutable and cannot be deleted.';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'ACTIVE'
       or new.closed_at is not null
       or new.closed_by is not null
       or new.closure_remarks is not null
       or new.closure_approval_reference is not null then
      raise exception 'New regional commercial-sales assumption revisions must be inserted as open ACTIVE revisions.';
    end if;
    return new;
  end if;

  if old.status is distinct from 'ACTIVE' or old.closed_at is not null then
    raise exception 'Terminal regional commercial-sales assumption revision % is immutable.', old.id;
  end if;

  if (to_jsonb(new) - array['status','closed_at','closed_by','updated_at','updated_by','closure_remarks','closure_approval_reference'])
     is distinct from
     (to_jsonb(old) - array['status','closed_at','closed_by','updated_at','updated_by','closure_remarks','closure_approval_reference']) then
    raise exception 'Regional commercial-sales assumption evidence is immutable; create a successor revision instead.';
  end if;

  if new.status = 'SUPERSEDED' then
    if new.closed_at is null or new.closed_by is null
       or new.closure_remarks is not null
       or new.closure_approval_reference is not null then
      raise exception 'SUPERSEDED transition requires closure actor/time and no explicit closure evidence.';
    end if;
  elsif new.status = 'CLOSED' then
    if new.closed_at is null or new.closed_by is null
       or new.closure_remarks is null or length(btrim(new.closure_remarks)) = 0
       or new.closure_approval_reference is null or length(btrim(new.closure_approval_reference)) = 0 then
      raise exception 'CLOSED transition requires closure actor/time, remarks and approval reference.';
    end if;
  else
    raise exception 'ACTIVE regional commercial-sales assumption revisions cannot be edited in place; create a successor revision or close the revision.';
  end if;

  if new.updated_at is null or new.updated_by is null then
    raise exception 'Regional commercial-sales assumption lifecycle transition requires updated actor/time.';
  end if;

  return new;
end;
$$;

revoke execute on function costing.fn_guard_sku_regional_commercial_sales_assumption_lifecycle() from public, anon, authenticated, service_role;

create trigger trg_sku_regional_commercial_sales_assumption_lifecycle
before insert or update or delete on costing.sku_regional_commercial_sales_assumption
for each row execute function costing.fn_guard_sku_regional_commercial_sales_assumption_lifecycle();