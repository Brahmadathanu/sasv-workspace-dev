-- WP10 G2 PROPOSAL 06 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval. GENERATED FILE: do not edit by hand.
-- Regenerate with: node scripts/wp10-g2-safeguards/gen-proposal-06.mjs  (draft-sql-static.test.mjs requires this file to equal the generator output).
-- Read-only pre-submit subgroup-impact PREVIEW (counterfactual contract: WP10_G2_COUNTERFACTUAL_PREVIEW_CONTRACT_DRAFT_2026-11-15.md).
--   public.rpc_wp10_preview_product_subgroup_impact(p_product_id integer, p_proposed_sub_group_id integer) -> jsonb  (STABLE, one statement snapshot)
-- It answers "what would this product's production-route validity be if its sub-group were X?" WITHOUT any write, temporary row substitution, rollback-based
-- dry run, builder or writer call. It is NON-AUTHORITATIVE for the save ('authoritative_for_save': false): proposal 05's transactional guard still decides
-- inside the writer, there is no approval token, no override and no bypass.
-- No live function is replaced. The five context-aware helpers are the CAPTURED live definitions with named, count-asserted substitutions (see the generator):
--   fn_wp10_resolve_route_family_ctx            <- fn_resolve_route_family_for_product: the two queries that read the sub-group from public.products read the
--                                                 (product, sub-group) pair instead; the group comes from public.sub_groups for THAT sub-group; product-map
--                                                 first, sub-group map second, group map third; windows, inclusive ends and ordering are the captured text.
--   fn_wp10_resolve_effective_route_family_route_ctx <- fn_resolve_effective_route_family_route: the family comes from the context-aware resolver.
--   fn_wp10_validate_product_process_route_ctx  <- fn_validate_product_process_route: ONLY the nested family lookup at the route's OWN effective-from date
--                                                 becomes context-aware (an outer selector change alone would validate the proposed family against the old one).
--   fn_wp10_validate_effective_product_process_route_ctx <- fn_validate_effective_product_process_route: family, family route and the product-route validator
--                                                 are the context-aware ones; product-route selection (incl. AMBIGUOUS_APPROVED_PRODUCT_ROUTE), the family-route
--                                                 validator, effective steps and overrides are the canonical captured functions, reused unchanged.
-- Unknown is never safe: any exception or malformed result is state UNKNOWN (reason EVALUATION_ERROR / AMBIGUOUS_APPROVED_PRODUCT_ROUTE / MALFORMED_RESULT).
-- Input errors (missing product / sub-group) raise; they are never reported as zero impact.
-- Permission: existing module:manage-products View only (no new target). Proposed grant (TEXT ONLY, never executed here): EXECUTE on the preview to authenticated.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array array['costing.fn_wp10_resolve_route_family_ctx(integer, date, integer)', 'costing.fn_wp10_resolve_effective_route_family_route_ctx(integer, date, integer)', 'costing.fn_wp10_validate_product_process_route_ctx(bigint, integer)', 'costing.fn_wp10_validate_effective_product_process_route_ctx(integer, date, integer)', 'costing.fn_wp10_route_state_ctx(integer, date, integer)', 'public.rpc_wp10_preview_product_subgroup_impact(integer, integer)'] loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  foreach t in array array['public.products', 'public.sub_groups', 'public.product_skus', 'costing.product_process_route', 'costing.production_route_family_route'] loop
    if to_regclass(t) is null then raise exception 'WP10-G2 preflight: required table % is missing.', t; end if;
  end loop;
  if to_regprocedure('public.app_has_permission(text, text)') is null then raise exception 'WP10-G2 preflight: required function public.app_has_permission(text, text) is missing.'; end if;
  for r in select * from (values
    ('costing.fn_resolve_route_family_for_product(integer, date)', '641fd0f7eb7438eed53c1c6170deb0ec'),
    ('costing.fn_resolve_effective_route_family_route(integer, date)', '5d7ac1d9e0427eae90b590ead55fe58a'),
    ('costing.fn_validate_product_process_route(bigint)', 'cc6cef1fac171ce812c9dd6702e4efbc'),
    ('costing.fn_validate_effective_product_process_route(integer, date)', 'a9396f97a23cba5bbaceada07bc6448a'),
    ('costing.fn_resolve_effective_product_process_route(integer, date)', '3c5a292804748daf679605382e1691fb'),
    ('costing.fn_validate_route_family_route(bigint)', '09cd3572e36000095b8b1eb1833491c8'),
    ('costing.fn_effective_product_process_route_steps(bigint)', '0968054cfb097874f54239c1c2ce3ab5')
  ) as d(sig, expected_md5) loop
    v := to_regprocedure(r.sig);
    if v is null then raise exception 'WP10-G2 preflight: required live function % is missing.', r.sig; end if;
    if md5(pg_get_functiondef(v)) <> r.expected_md5 then
      raise exception 'WP10-G2 preflight: live function % differs from the reviewed definition (md5 %, reviewed %); re-review before applying.', r.sig, md5(pg_get_functiondef(v)), r.expected_md5;
    end if;
  end loop;
  foreach t in array array['costing.fn_wp10_today_ist()', 'costing.fn_wp10_batch_size_state_as_of(bigint, date)'] loop
    v := to_regprocedure(t);
    c := case when v is null then null else obj_description(v, 'pg_proc') end;
    if v is null or c is null or c not like 'WP10-G2 01\_%' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      raise exception 'WP10-G2 preflight: prerequisite % (proposal 01) is missing, not applied by this procedure, or modified since.', t;
    end if;
  end loop;
end $wp10_preflight$;

-- derived helper 1 of 4 (captured text + named substitutions)
CREATE FUNCTION costing.fn_wp10_resolve_route_family_ctx(p_product_id integer, p_as_of_date date, p_sub_group_id integer)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_date date := coalesce(p_as_of_date,current_date);
  v_product_family bigint;
  v_subgroup_family bigint;
  v_group_family bigint;
begin
  select m.route_family_id
  into v_product_family
  from costing.production_route_family_product_map m
  join costing.production_route_family f on f.id=m.route_family_id
  where m.product_id=p_product_id
    and m.archived_at is null
    and m.status='APPROVED'
    and m.effective_from<=v_date
    and (m.effective_to is null or m.effective_to>=v_date)
    and f.archived_at is null
    and f.status='APPROVED'
    and f.effective_from<=v_date
    and (f.effective_to is null or f.effective_to>=v_date)
  order by m.effective_from desc,m.id desc
  limit 1;

  if v_product_family is not null then
    return v_product_family;
  end if;

  select sm.route_family_id
  into v_subgroup_family
  from (select p_product_id as id, p_sub_group_id as sub_group_id) p
  join costing.production_route_family_product_subgroup_map sm
    on sm.product_subgroup_id=p.sub_group_id
   and sm.archived_at is null
   and sm.status='APPROVED'
   and sm.effective_from<=v_date
   and (sm.effective_to is null or sm.effective_to>=v_date)
  join costing.production_route_family f
    on f.id=sm.route_family_id
   and f.archived_at is null
   and f.status='APPROVED'
   and f.effective_from<=v_date
   and (f.effective_to is null or f.effective_to>=v_date)
  where p.id=p_product_id
  order by sm.effective_from desc,sm.id desc
  limit 1;

  if v_subgroup_family is not null then
    return v_subgroup_family;
  end if;

  select gm.route_family_id
  into v_group_family
  from (select p_product_id as id, p_sub_group_id as sub_group_id) p
  join public.sub_groups sg on sg.id=p.sub_group_id
  join costing.production_route_family_product_group_map gm
    on gm.product_group_id=sg.product_group_id
   and gm.archived_at is null
   and gm.status='APPROVED'
   and gm.effective_from<=v_date
   and (gm.effective_to is null or gm.effective_to>=v_date)
  join costing.production_route_family f
    on f.id=gm.route_family_id
   and f.archived_at is null
   and f.status='APPROVED'
   and f.effective_from<=v_date
   and (f.effective_to is null or f.effective_to>=v_date)
  where p.id=p_product_id
  order by gm.effective_from desc,gm.id desc
  limit 1;

  return v_group_family;
end
$function$;

-- derived helper 2 of 4 (captured text + named substitutions)
CREATE FUNCTION costing.fn_wp10_resolve_effective_route_family_route_ctx(p_product_id integer, p_as_of_date date, p_sub_group_id integer)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
  with f as (
    select costing.fn_wp10_resolve_route_family_ctx(p_product_id,p_as_of_date,p_sub_group_id) route_family_id
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

-- derived helper 3 of 4 (captured text + named substitutions)
CREATE FUNCTION costing.fn_wp10_validate_product_process_route_ctx(p_product_route_id bigint, p_sub_group_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_route costing.product_process_route%rowtype;
  v_errors jsonb:='[]'::jsonb;
  v_family_id bigint;
  v_base_family_id bigint;
  v_release_only boolean:=false;
  v_batch_product_id integer;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_qc integer;
  v_duplicate_sequence boolean:=false;
begin
  select * into v_route from costing.product_process_route where id=p_product_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('PRODUCT_ROUTE_NOT_FOUND')); end if;
  if v_route.archived_at is not null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_PRODUCT_ROUTE'),'product_route_id',p_product_route_id);
  end if;

  v_family_id:=costing.fn_wp10_resolve_route_family_ctx(v_route.product_id,coalesce(v_route.effective_from,current_date),p_sub_group_id);
  select r.route_family_id,coalesce(f.allows_release_only_route,false)
    into v_base_family_id,v_release_only
  from costing.production_route_family_route r
  join costing.production_route_family f on f.id=r.route_family_id
  where r.id=v_route.base_route_family_route_id and r.archived_at is null and f.archived_at is null;

  if v_base_family_id is null then v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_ARCHIVED_OR_MISSING'); end if;
  if v_family_id is null then v_errors:=v_errors||jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ASSIGNMENT');
  elsif v_family_id<>v_base_family_id then v_errors:=v_errors||jsonb_build_array('ROUTE_FAMILY_ASSIGNMENT_MISMATCH'); end if;

  if not exists(
    select 1 from costing.production_route_family_route r
    join costing.production_route_family f on f.id=r.route_family_id
    where r.id=v_route.base_route_family_route_id and r.archived_at is null and f.archived_at is null and r.status='APPROVED'
  ) then v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_NOT_APPROVED'); end if;

  select product_id into v_batch_product_id from public.production_batch_size_ref where id=v_route.batch_size_ref_id;
  if v_batch_product_id is distinct from v_route.product_id then v_errors:=v_errors||jsonb_build_array('BATCH_REFERENCE_PRODUCT_MISMATCH'); end if;

  if exists(
    select 1 from costing.product_process_route_override o
    join costing.production_route_family_route_step s on s.id=o.base_step_id
    where o.product_route_id=p_product_route_id and s.family_route_id<>v_route.base_route_family_route_id
  ) then v_errors:=v_errors||jsonb_build_array('OVERRIDE_REFERENCES_FOREIGN_ROUTE_FAMILY_STEP'); end if;

  with es as materialized (select * from costing.fn_effective_product_process_route_steps(p_product_route_id)),
  counts as (
    select count(*)::integer steps,
           count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE')::integer rm,
           count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER')::integer fg,
           count(*) filter(where route_step_scope='PRODUCTION_PROCESS')::integer prod,
           count(*) filter(where route_step_scope='QC_OTHER_POOL')::integer qc
    from es
  ), dup as (select exists(select 1 from es group by sequence_no having count(*)>1) has_dup)
  select counts.steps,counts.rm,counts.fg,counts.prod,counts.qc,dup.has_dup
    into v_steps,v_rm,v_fg,v_prod,v_qc,v_duplicate_sequence
  from counts cross join dup;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_release_only then
    if v_prod<>0 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_MUST_NOT_HAVE_PRODUCTION_PROCESS_STEP'); end if;
    if v_qc<>1 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_REQUIRES_EXACTLY_ONE_QC_STEP'); end if;
    if v_steps<>3 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_REQUIRES_EXACTLY_THREE_STEPS'); end if;
  elsif v_prod<1 then
    v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP');
  end if;
  if coalesce(v_duplicate_sequence,false) then v_errors:=v_errors||jsonb_build_array('DUPLICATE_EFFECTIVE_SEQUENCE'); end if;
  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE'); end if;

  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,
    'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod,'qc_step_count',v_qc,
    'allows_release_only_route',v_release_only,'resolved_route_family_id',v_family_id);
end
$function$;

-- derived helper 4 of 4 (captured text + named substitutions)
CREATE FUNCTION costing.fn_wp10_validate_effective_product_process_route_ctx(p_product_id integer, p_as_of_date date, p_sub_group_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_date date:=coalesce(p_as_of_date,current_date);
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
  v_validation jsonb;
begin
  v_family_id:=costing.fn_wp10_resolve_route_family_ctx(p_product_id,v_date,p_sub_group_id);
  if v_family_id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_MAPPING'),'route_source',null,'product_id',p_product_id);
  end if;

  v_family_route_id:=costing.fn_wp10_resolve_effective_route_family_route_ctx(p_product_id,v_date,p_sub_group_id);
  if v_family_route_id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ROUTE'),'route_source',null,'product_id',p_product_id,'route_family_id',v_family_id);
  end if;

  v_product_route_id:=costing.fn_resolve_effective_product_process_route(p_product_id,v_date);
  if v_product_route_id is not null then
    return costing.fn_wp10_validate_product_process_route_ctx(v_product_route_id,p_sub_group_id)
      || jsonb_build_object('route_source','PRODUCT_ROUTE','product_id',p_product_id,'route_family_id',v_family_id,
                            'family_route_id',v_family_route_id,'product_route_id',v_product_route_id);
  end if;

  v_validation:=costing.fn_validate_route_family_route(v_family_route_id);
  return v_validation || jsonb_build_object(
    'route_source','ROUTE_FAMILY_INHERITED',
    'product_id',p_product_id,
    'route_family_id',v_family_id,
    'family_route_id',v_family_route_id,
    'product_route_id',null
  );
end
$function$;

create function costing.fn_wp10_route_state_ctx(p_product_id integer, p_as_of_date date, p_sub_group_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
declare
  v jsonb;
  v_state text;
  v_reasons jsonb;
  v_src text;
begin
  begin
    v := costing.fn_wp10_validate_effective_product_process_route_ctx(p_product_id, p_as_of_date, p_sub_group_id);
  exception when others then
    -- evaluation failure is UNKNOWN, never valid; only the canonical ambiguity code is surfaced, never raw exception text
    return jsonb_build_object('state', 'UNKNOWN', 'route_source', null, 'family_id', null, 'family_route_id', null, 'product_route_id', null,
      'reasons', jsonb_build_array(case when sqlerrm like 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE%' then 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE' else 'EVALUATION_ERROR' end));
  end;
  if v is null or jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v -> 'valid') is distinct from 'boolean' then
    return jsonb_build_object('state', 'UNKNOWN', 'route_source', null, 'family_id', null, 'family_route_id', null, 'product_route_id', null,
      'reasons', jsonb_build_array('MALFORMED_RESULT'));
  end if;
  v_state := case when (v ->> 'valid')::boolean then 'VALID' else 'INVALID' end;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_reasons
  from (select e from jsonb_array_elements_text(case when jsonb_typeof(v -> 'errors') = 'array' then v -> 'errors' else '[]'::jsonb end) e
        where e ~ '^[A-Z][A-Z0-9_]{0,63}$' limit 12) q;
  if v_state = 'INVALID' and jsonb_array_length(v_reasons) = 0 then v_reasons := jsonb_build_array('UNSPECIFIED_REASON'); end if;
  v_src := v ->> 'route_source';
  return jsonb_build_object(
    'state', v_state,
    'route_source', case when v_src in ('PRODUCT_ROUTE', 'ROUTE_FAMILY_INHERITED') then v_src else null end,
    'family_id', case when (v ->> 'route_family_id') ~ '^[0-9]{1,18}$' then (v ->> 'route_family_id')::bigint else null end,
    'family_route_id', case when (v ->> 'family_route_id') ~ '^[0-9]{1,18}$' then (v ->> 'family_route_id')::bigint else null end,
    'product_route_id', case when (v ->> 'product_route_id') ~ '^[0-9]{1,18}$' then (v ->> 'product_route_id')::bigint else null end,
    'reasons', v_reasons);
end
$fn$;

create function public.rpc_wp10_preview_product_subgroup_impact(p_product_id integer, p_proposed_sub_group_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $fn$
declare
  v_today date;
  v_stored integer;
  v_found boolean;
  v_active integer;
  v_before jsonb;
  v_prop jsonb;
  v_changed boolean;
  v_class text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.app_has_permission('module:manage-products', 'view') then raise exception 'Permission denied'; end if;
  if p_product_id is null or p_proposed_sub_group_id is null then
    raise exception using errcode = '22023', message = 'WP10_PREVIEW_INPUT: a product and a proposed sub-group are required.';
  end if;
  select p.sub_group_id, true into v_stored, v_found from public.products p where p.id = p_product_id;
  if not coalesce(v_found, false) then
    raise exception using errcode = 'P0002', message = format('WP10_PREVIEW_INPUT: product %s does not exist.', p_product_id);
  end if;
  if not exists (select 1 from public.sub_groups g where g.id = p_proposed_sub_group_id) then
    raise exception using errcode = 'P0002', message = format('WP10_PREVIEW_INPUT: sub-group %s does not exist.', p_proposed_sub_group_id);
  end if;
  -- one STABLE function = one statement snapshot for every read below; today's IST date comes from the single clock function of proposal 01
  v_today := costing.fn_wp10_today_ist();
  select count(*)::integer into v_active from public.product_skus s where s.product_id = p_product_id and s.is_active;
  v_before := costing.fn_wp10_route_state_ctx(p_product_id, v_today, v_stored);
  v_prop := costing.fn_wp10_route_state_ctx(p_product_id, v_today, p_proposed_sub_group_id);
  v_changed := v_stored is distinct from p_proposed_sub_group_id;
  v_class := case
    when not v_changed then 'NO_SUBGROUP_CHANGE'
    when v_before ->> 'state' = 'UNKNOWN' or v_prop ->> 'state' = 'UNKNOWN' then 'UNKNOWN'
    when v_before ->> 'state' = 'VALID' and v_prop ->> 'state' = 'INVALID' then 'ROUTE_LOSS'
    when v_before ->> 'state' = 'VALID' then 'VALID_TO_VALID'
    when v_prop ->> 'state' = 'VALID' then 'INVALID_TO_VALID'
    else 'INVALID_TO_INVALID' end;
  return jsonb_build_object(
    'assessment_kind', 'PRODUCT_SUBGROUP_ROUTE_IMPACT',
    'authoritative_for_save', false,
    'product_id', p_product_id,
    'stored_sub_group_id', v_stored,
    'proposed_sub_group_id', p_proposed_sub_group_id,
    'sub_group_changed', v_changed,
    'evaluated_on', v_today,
    'date_basis', 'CURRENT_IST_DATE',
    'active_sku_count', v_active,
    'before', v_before,
    'proposed', v_prop,
    'impact_class', v_class,
    'review_required', (v_class = 'UNKNOWN') or (v_class = 'ROUTE_LOSS' and v_active > 0),
    'context_digest', md5(concat_ws('|', p_product_id, v_stored, p_proposed_sub_group_id, v_today, v_active, v_before::text, v_prop::text)));
end
$fn$;

revoke all on function costing.fn_wp10_resolve_route_family_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_resolve_effective_route_family_route_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_validate_product_process_route_ctx(bigint, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_validate_effective_product_process_route_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_route_state_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function public.rpc_wp10_preview_product_subgroup_impact(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.rpc_wp10_preview_product_subgroup_impact(integer, integer) to authenticated;

-- RECEIPT (R5): stamps each created function with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid;
begin
  foreach t in array array['costing.fn_wp10_resolve_route_family_ctx(integer, date, integer)', 'costing.fn_wp10_resolve_effective_route_family_route_ctx(integer, date, integer)', 'costing.fn_wp10_validate_product_process_route_ctx(bigint, integer)', 'costing.fn_wp10_validate_effective_product_process_route_ctx(integer, date, integer)', 'costing.fn_wp10_route_state_ctx(integer, date, integer)', 'public.rpc_wp10_preview_product_subgroup_impact(integer, integer)'] loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 06_subgroup_impact_preview.sql md5:' || md5(pg_get_functiondef(v)));
  end loop;
end $wp10_receipt$;
commit;
