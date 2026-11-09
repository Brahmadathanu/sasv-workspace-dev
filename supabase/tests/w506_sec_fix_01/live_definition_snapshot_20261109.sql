-- W506 exact live function-definition source fixture (metadata only, no production data).
-- Captured SELECT-only 2026-11-09 from project qhmoqtxpeasamtlxaoak.
-- STRICTLY FOR DISPOSABLE LOCAL POSTGRES TESTS; NEVER RUN IN PRODUCTION.
-- Internal full-definition MD5: 553d103a5afedda3191c1aa62c33be7c
-- Public wrapper full-definition MD5: 6ba709477ecc7755fb6005b6e2203a2b
-- This file contains UNGUARDED ORIGINAL code and must not be used as a migration.
-- It does not contain production user rows, UUIDs, passwords or tokens.
-- Requires synthetic hr.staff, costing.staff_costing_classification, and public option/register view fixtures.
-- The psql invocation must define W506_LOCAL_ONLY=1; on any other invocation, exit without applying SQL.
\if :{?W506_LOCAL_ONLY}
  \if :W506_LOCAL_ONLY
  \else
    \echo W506 LOCAL FIXTURE REFUSED: W506_LOCAL_ONLY must be true.
    \quit 3
  \endif
\else
  \echo W506 LOCAL FIXTURE REFUSED: invoke only in disposable cluster with -v W506_LOCAL_ONLY=1.
  \quit 3
\endif

CREATE OR REPLACE FUNCTION costing.rpc_set_staff_costing_classification(p_staff_id bigint, p_costing_class text, p_allocation_pool text DEFAULT NULL::text, p_effective_from date DEFAULT NULL::date, p_allocation_weight numeric DEFAULT 1, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(staff_id bigint, employee_code text, designation text, classification_id bigint, costing_class text, allocation_pool text, effective_from date, effective_to date, allocation_weight numeric, classification_status text, remarks text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'hr'
AS $function$
declare
  v_staff_id bigint := p_staff_id;
  v_costing_class text := upper(nullif(trim(p_costing_class), ''));
  v_allocation_pool text := upper(nullif(trim(p_allocation_pool), ''));
  v_effective_from date := coalesce(p_effective_from, date_trunc('month', current_date)::date);
  v_allocation_weight numeric := coalesce(p_allocation_weight, 1);
  v_remarks text := nullif(trim(p_remarks), '');
  v_default_pool text;
  v_existing_id bigint;
  v_existing_effective_from date;
  v_new_id bigint;
begin
  if v_staff_id is null then
    raise exception 'Staff id is required.';
  end if;

  if not exists (
    select 1
    from hr.staff s
    where s.id = v_staff_id
  ) then
    raise exception 'Staff id % does not exist in hr.staff.', v_staff_id;
  end if;

  if v_costing_class is null then
    raise exception 'Costing class is required.';
  end if;

  select o.default_allocation_pool
  into v_default_pool
  from public.v_costing_staff_costing_class_options o
  where o.costing_class = v_costing_class;

  if v_default_pool is null then
    raise exception 'Invalid costing class: %', v_costing_class;
  end if;

  v_allocation_pool := coalesce(v_allocation_pool, v_default_pool);

  if v_allocation_pool <> v_default_pool then
    raise exception
      'Allocation pool % is not valid for costing class %. Expected %.',
      v_allocation_pool,
      v_costing_class,
      v_default_pool;
  end if;

  if v_effective_from is null then
    raise exception 'Effective from date is required.';
  end if;

  if v_allocation_weight <= 0 then
    raise exception 'Allocation weight must be greater than zero.';
  end if;

  if v_allocation_weight > 1 then
    raise exception 'Allocation weight cannot be greater than 1.';
  end if;

  /*
    Find current open-ended valid classification row.
    is_active = true means valid costing row.
    effective_to controls period closure.
  */
  select
    cls.id,
    cls.effective_from
  into
    v_existing_id,
    v_existing_effective_from
  from costing.staff_costing_classification cls
  where cls.staff_id = v_staff_id
    and cls.is_active = true
    and cls.effective_to is null
  order by cls.effective_from desc, cls.id desc
  limit 1;

  /*
    If an open row exists with the same effective_from, update it in place.
    This prevents a zero-length historical row and keeps the register clean.
  */
  if v_existing_id is not null and v_existing_effective_from = v_effective_from then
    update costing.staff_costing_classification cls
    set
      costing_class = v_costing_class,
      allocation_pool = v_allocation_pool,
      allocation_weight = v_allocation_weight,
      remarks = v_remarks,
      is_active = true,
      effective_to = null,
      updated_at = now()
    where cls.id = v_existing_id
    returning cls.id into v_new_id;
  else
    /*
      Close previous open-ended row historically.
      Do not set is_active = false.
      The row remains valid for historical periods up to effective_to.
    */
    if v_existing_id is not null then
      update costing.staff_costing_classification cls
      set
        effective_to = v_effective_from - 1,
        is_active = true,
        updated_at = now()
      where cls.id = v_existing_id;
    end if;

    insert into costing.staff_costing_classification (
      staff_id,
      costing_class,
      allocation_pool,
      effective_from,
      effective_to,
      allocation_weight,
      remarks,
      is_active,
      created_at,
      updated_at
    )
    values (
      v_staff_id,
      v_costing_class,
      v_allocation_pool,
      v_effective_from,
      null,
      v_allocation_weight,
      v_remarks,
      true,
      now(),
      now()
    )
    returning id into v_new_id;
  end if;

  return query
  select
    r.staff_id,
    r.employee_code,
    r.designation,
    r.classification_id,
    r.costing_class,
    r.allocation_pool,
    r.effective_from,
    r.effective_to,
    r.allocation_weight,
    r.classification_status,
    r.remarks,
    r.classification_updated_at as updated_at
  from public.v_costing_staff_classification_register r
  where r.classification_id = v_new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_set_staff_costing_classification(p_staff_id bigint, p_costing_class text, p_allocation_pool text DEFAULT NULL::text, p_effective_from date DEFAULT NULL::date, p_allocation_weight numeric DEFAULT 1, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(staff_id bigint, employee_code text, designation text, classification_id bigint, costing_class text, allocation_pool text, effective_from date, effective_to date, allocation_weight numeric, classification_status text, remarks text, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'hr'
AS $function$
  select *
  from costing.rpc_set_staff_costing_classification(
    p_staff_id,
    p_costing_class,
    p_allocation_pool,
    p_effective_from,
    p_allocation_weight,
    p_remarks
  );
$function$
;
