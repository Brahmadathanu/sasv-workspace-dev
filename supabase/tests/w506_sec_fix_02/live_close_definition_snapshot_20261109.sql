-- W506 companion CLOSE writer exact live-definition snapshot; SELECT-only captured 2026-11-09.
-- SECURITY: ORIGINAL UNGUARDED FUNCTION TEXT. TEST FIXTURE ONLY, NEVER PRODUCTION MIGRATION.
-- Project: qhmoqtxpeasamtlxaoak; PostgreSQL 17.4. No data rows, credentials, users, tokens.
-- Internal full-definition MD5: 1c9884c0ca0321eda6055feaa6bd64de; prosrc md5: 82f1b8b699f078505f1fd7211d9d2741
-- Public wrapper full-definition MD5: a8254681b64a6e78b59f1d2b00d9a7df; prosrc md5: af0b4c4dfb69a6349a6e88ec433f2af9
-- Internal prefix before first BEGIN: 174 chars, md5 255b487148e29e51fa841048e8d248c9
-- Live owner/ACL/config: internal postgres, {postgres=X/postgres}, ["search_path=costing, public, hr"]
-- Live owner/ACL/config: wrapper postgres, {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}, ["search_path=public, costing, hr"]
-- ACL and owner metadata documented above, not applied here; synthetic scaffold owns fixture roles.
-- DISPOSABLE-ONLY psql interlock: invoke with -v W506_CLOSE_LOCAL_ONLY=1.
\if :{?W506_CLOSE_LOCAL_ONLY}
  \if :W506_CLOSE_LOCAL_ONLY
  \else
    \echo CLOSE FIXTURE REFUSED: W506_CLOSE_LOCAL_ONLY required
    \quit 3
  \endif
\else
  \echo CLOSE FIXTURE REFUSED: run only in a disposable cluster with -v W506_CLOSE_LOCAL_ONLY=1
  \quit 3
\endif

CREATE OR REPLACE FUNCTION costing.rpc_close_staff_costing_classification(p_classification_id bigint, p_effective_to date DEFAULT NULL::date, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(staff_id bigint, employee_code text, designation text, classification_id bigint, costing_class text, allocation_pool text, effective_from date, effective_to date, allocation_weight numeric, classification_status text, remarks text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'hr'
AS $function$
declare
  v_effective_to date := coalesce(p_effective_to, current_date);
  v_remarks text := nullif(trim(p_remarks), '');
  v_staff_id bigint;
  v_effective_from date;
begin
  if p_classification_id is null then
    raise exception 'Classification id is required.';
  end if;

  select
    cls.staff_id,
    cls.effective_from
  into
    v_staff_id,
    v_effective_from
  from costing.staff_costing_classification cls
  where cls.id = p_classification_id;

  if v_staff_id is null then
    raise exception 'Classification id % not found.', p_classification_id;
  end if;

  if v_effective_to < v_effective_from then
    raise exception
      'Effective to date % cannot be before effective from date %.',
      v_effective_to,
      v_effective_from;
  end if;

  /*
    Closing means ending validity, not voiding history.
    Keep is_active = true so older costing periods can still read this row.
  */
  update costing.staff_costing_classification cls
  set
    effective_to = v_effective_to,
    is_active = true,
    remarks = coalesce(v_remarks, cls.remarks),
    updated_at = now()
  where cls.id = p_classification_id;

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
  where r.staff_id = v_staff_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_close_staff_costing_classification(p_classification_id bigint, p_effective_to date DEFAULT NULL::date, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(staff_id bigint, employee_code text, designation text, classification_id bigint, costing_class text, allocation_pool text, effective_from date, effective_to date, allocation_weight numeric, classification_status text, remarks text, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'hr'
AS $function$
  select *
  from costing.rpc_close_staff_costing_classification(
    p_classification_id,
    p_effective_to,
    p_remarks
  );
$function$;

