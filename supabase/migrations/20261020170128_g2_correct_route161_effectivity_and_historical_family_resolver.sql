-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $fix$
declare
  v_old costing.production_route_family_route%rowtype;
  v_new costing.production_route_family_route%rowtype;
begin
  lock table costing.production_route_family_route in access exclusive mode;
  select * into v_old from costing.production_route_family_route where id=144;
  select * into v_new from costing.production_route_family_route where id=161;
  if (now() at time zone 'Asia/Kolkata')::date <> date '2026-10-20'
     or costing.fn_frozen_valuation_through() >= date '2026-10-20'
     or md5(pg_get_functiondef('costing.fn_route_parent_immutable()'::regprocedure)) <> '6c8e27f016fb9cafdb6e97096da121d3'
     or md5(pg_get_functiondef('costing.fn_resolve_effective_route_family_route(integer,date)'::regprocedure)) <> '39f8f62fc99b856ee2e8be443e735be7'
     or v_old.status <> 'SUPERSEDED' or v_old.effective_to <> date '2026-10-20'
     or v_old.route_family_id <> 101 or v_old.effective_from <> date '2026-08-30'
     or v_new.status <> 'APPROVED' or v_new.effective_from <> date '2026-10-21'
     or v_new.supersedes_route_id <> 144 or v_new.route_family_id <> 101
     or v_new.route_version <> 2
     or (select count(*) from costing.production_route_family_route_step where family_route_id=161) <> 9
  then raise exception 'G2 route date correction preflight mismatch; no changes applied'; end if;
  -- Temporary, transaction-scoped immutable-trigger exception to correct an approved
  -- header date. ACCESS EXCLUSIVE locking prevents concurrent writes. The trigger is
  -- restored before this transaction can commit; all other triggers remain active.
  alter table costing.production_route_family_route disable trigger trg_route_family_route_immutable;
  update costing.production_route_family_route
     set effective_from=date '2026-10-20',updated_at=now()
   where id=161;
  update costing.production_route_family_route
     set effective_to=date '2026-10-19',updated_at=now()
   where id=144;
  alter table costing.production_route_family_route enable trigger trg_route_family_route_immutable;
  if (select t.tgenabled from pg_trigger t where t.tgrelid='costing.production_route_family_route'::regclass and t.tgname='trg_route_family_route_immutable') <> 'O'
  then raise exception 'G2 immutable trigger not enabled after correction'; end if;
end $fix$;

create or replace function costing.fn_resolve_effective_route_family_route(
  p_product_id integer, p_as_of_date date default CURRENT_DATE)
returns bigint
language sql stable security definer
set search_path to 'costing','public'
as $function$
  with f as (
    select costing.fn_resolve_route_family_for_product(p_product_id,p_as_of_date) route_family_id
  )
  select r.id
  from costing.production_route_family_route r,f
  where r.route_family_id=f.route_family_id
    and r.archived_at is null
    and r.status in ('APPROVED','SUPERSEDED')
    and r.effective_from<=coalesce(p_as_of_date,current_date)
    and (r.effective_to is null or r.effective_to>=coalesce(p_as_of_date,current_date))
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1
$function$;

do $post$
begin
  if costing.fn_resolve_effective_route_family_route(51,date '2026-10-16') <> 144
     or costing.fn_resolve_effective_route_family_route(51,date '2026-10-19') <> 144
     or costing.fn_resolve_effective_route_family_route(51,date '2026-10-20') <> 161
     or costing.fn_resolve_effective_route_family_route(51,date '2026-10-21') <> 161
     or (select count(*) from costing.production_route_family_route where id=144 and status='SUPERSEDED' and effective_to=date '2026-10-19') <> 1
     or (select count(*) from costing.production_route_family_route where id=161 and status='APPROVED' and effective_from=date '2026-10-20') <> 1
     or (select t.tgenabled from pg_trigger t where t.tgrelid='costing.production_route_family_route'::regclass and t.tgname='trg_route_family_route_immutable') <> 'O'
     or md5(pg_get_functiondef('costing.fn_route_parent_immutable()'::regprocedure)) <> '6c8e27f016fb9cafdb6e97096da121d3'
  then raise exception 'G2 corrected date/historical resolver postcondition failed'; end if;
end $post$;