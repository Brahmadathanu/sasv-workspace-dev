-- Prospective cutover: CSA scenario-row ownership + scoped revise RPCs.
-- DO NOT apply to production until audited / separately instructed.
-- Does not mutate completed costing snapshots. Does not enqueue refreshes.

-- ---------------------------------------------------------------------------
-- 1. Regional scenario catalog includes NON_POSITIVE_NET_ACTUAL_HISTORY
-- ---------------------------------------------------------------------------
alter table costing.regional_sales_allocation_default_policy
  drop constraint if exists regional_sales_allocation_default_policy_scenario_chk;

alter table costing.regional_sales_allocation_default_policy
  add constraint regional_sales_allocation_default_policy_scenario_chk
  check (
    scenario_code = any (
      array[
        'NO_ELIGIBLE_REGIONAL_HISTORY'::text,
        'NO_POSITIVE_REGIONAL_HISTORY'::text,
        'NON_POSITIVE_NET_ACTUAL_HISTORY'::text
      ]
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Company as-of resolver: scenario-row units (no shared fallback)
-- ---------------------------------------------------------------------------
create or replace function costing.fn_resolve_sales_allocation_default_policy_as_of(
  p_scenario_code text,
  p_valuation_date date
)
returns table (
  policy_id bigint,
  scenario_code text,
  default_sales_units numeric,
  effective_from date,
  effective_to date,
  resolution_status text,
  qualifying_policy_count bigint,
  resolution_note text
)
language sql
stable
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
with n as (
  select upper(btrim(coalesce(p_scenario_code, ''))) as scenario_code,
         p_valuation_date as valuation_date
),
c as (
  select p.*
  from costing.sales_allocation_default_policy p
  cross join n
  where p.scenario_code = n.scenario_code
    and p.status in ('APPROVED', 'CLOSED')
    and p.effective_from <= n.valuation_date
    and (p.effective_to is null or p.effective_to >= n.valuation_date)
),
s as (select count(*)::bigint as n from c)
select
  case when s.n = 1 then c.id end,
  n.scenario_code,
  case when s.n = 1 then c.default_sales_units end,
  case when s.n = 1 then c.effective_from end,
  case when s.n = 1 then c.effective_to end,
  case
    when p_valuation_date is null then 'INVALID_CONTEXT'
    when n.scenario_code not in ('NEW_SKU_EXISTING_PRODUCT', 'NEW_PRODUCT_NO_HISTORY')
      then 'INVALID_SCENARIO'
    when s.n = 0 then 'MISSING'
    when s.n > 1 then 'AMBIGUOUS'
    else 'RESOLVED'
  end,
  s.n,
  case
    when p_valuation_date is null then 'Valuation date is required.'
    when n.scenario_code not in ('NEW_SKU_EXISTING_PRODUCT', 'NEW_PRODUCT_NO_HISTORY')
      then 'Sales-allocation default-policy scenario is invalid.'
    when s.n = 0 then 'No governed scenario policy is effective on the valuation date.'
    when s.n > 1 then 'Multiple governed scenario policies overlap on the valuation date.'
    else format(
      'Company CSA default policy %s supplies %s units for scenario %s.',
      c.id, c.default_sales_units, n.scenario_code
    )
  end
from n
cross join s
left join c on s.n = 1;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Regional as-of resolver: scenario-row units (no shared fallback)
-- ---------------------------------------------------------------------------
create or replace function costing.fn_resolve_regional_sales_default_policy_as_of(
  p_scenario_code text,
  p_region_code text,
  p_valuation_date date
)
returns table (
  policy_id bigint,
  scenario_code text,
  region_code text,
  default_sales_units numeric,
  effective_from date,
  effective_to date,
  resolution_status text,
  qualifying_policy_count bigint,
  resolution_note text
)
language sql
stable
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
with n as (
  select upper(btrim(coalesce(p_scenario_code, ''))) as scenario_code,
         upper(btrim(coalesce(p_region_code, ''))) as region_code,
         p_valuation_date as valuation_date
),
c as (
  select p.*
  from costing.regional_sales_allocation_default_policy p
  cross join n
  where p.scenario_code = n.scenario_code
    and p.region_code = n.region_code
    and p.status in ('APPROVED', 'CLOSED')
    and p.effective_from <= n.valuation_date
    and (p.effective_to is null or p.effective_to >= n.valuation_date)
),
s as (select count(*)::bigint as n from c)
select
  case when s.n = 1 then c.id end,
  n.scenario_code,
  n.region_code,
  case when s.n = 1 then c.default_sales_units end,
  case when s.n = 1 then c.effective_from end,
  case when s.n = 1 then c.effective_to end,
  case
    when p_valuation_date is null then 'INVALID_CONTEXT'
    when n.scenario_code not in (
      'NO_ELIGIBLE_REGIONAL_HISTORY',
      'NO_POSITIVE_REGIONAL_HISTORY',
      'NON_POSITIVE_NET_ACTUAL_HISTORY'
    ) then 'INVALID_SCENARIO'
    when n.region_code not in ('IK', 'OK') then 'INVALID_REGION'
    when s.n = 0 then 'MISSING'
    when s.n > 1 then 'AMBIGUOUS'
    else 'RESOLVED'
  end,
  s.n,
  case
    when p_valuation_date is null then 'Valuation date is required.'
    when n.scenario_code not in (
      'NO_ELIGIBLE_REGIONAL_HISTORY',
      'NO_POSITIVE_REGIONAL_HISTORY',
      'NON_POSITIVE_NET_ACTUAL_HISTORY'
    ) then 'Regional sales-allocation default scenario is invalid.'
    when n.region_code not in ('IK', 'OK') then 'Region must be IK or OK.'
    when s.n = 0 then 'No governed regional scenario policy is effective on the valuation date.'
    when s.n > 1 then 'Multiple governed regional scenario policies overlap on the valuation date.'
    else format(
      'Regional CSA default policy %s supplies %s units for %s / %s.',
      c.id, c.default_sales_units, n.scenario_code, n.region_code
    )
  end
from n
cross join s
left join c on s.n = 1;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Apply trigger: NON_POSITIVE scenario selection; quantity via CSA resolver
-- ---------------------------------------------------------------------------
create or replace function costing.fn_apply_regional_default_to_basis_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
declare
  v_scenario text;
  v_policy record;
  v_value record;
begin
  if coalesce(new.product_region_actual_evidence_row_count, 0) > 0
     and coalesce(new.product_region_actual_signed_billed_value, 0) > 0
     and new.regional_actual_units > 0 then
    return new;
  end if;

  if new.assumption_resolution_status = 'RESOLVED'
     and new.assumed_total_units > 0 then
    return new;
  end if;

  if coalesce(new.product_region_actual_evidence_row_count, 0) > 0
     and coalesce(new.product_region_actual_signed_billed_value, 0) <= 0 then
    v_scenario := 'NON_POSITIVE_NET_ACTUAL_HISTORY';
  elsif new.regional_actual_units > 0 then
    return new;
  elsif coalesce(new.product_region_actual_evidence_row_count, 0) = 0 then
    v_scenario := 'NO_ELIGIBLE_REGIONAL_HISTORY';
  elsif coalesce(new.product_regional_positive_actual_share, 0) <= 0 then
    v_scenario := 'NO_POSITIVE_REGIONAL_HISTORY';
  else
    return new;
  end if;

  select * into v_policy
  from costing.fn_resolve_regional_sales_default_policy_as_of(
    v_scenario, new.region_code, new.valuation_date
  );

  new.regional_default_resolution_status := v_policy.resolution_status;
  new.regional_default_resolution_note := v_policy.resolution_note;
  if v_policy.resolution_status is distinct from 'RESOLVED' then
    return new;
  end if;

  select * into v_value
  from costing.fn_resolve_regional_default_commercial_value(
    new.sku_id, new.region_code, v_policy.default_sales_units, new.valuation_date
  );

  new.regional_default_policy_id := v_policy.policy_id;
  new.regional_default_scenario := v_policy.scenario_code;
  new.regional_default_sales_units := v_policy.default_sales_units;
  new.regional_default_effective_from := v_policy.effective_from;
  new.regional_default_effective_to := v_policy.effective_to;
  new.regional_default_resolution_status := v_value.resolution_status;
  new.regional_default_resolution_note := v_value.resolution_note;
  new.regional_default_assumed_sales_value := v_value.resolved_sales_value;
  new.regional_default_value_source := v_value.value_resolution_source;

  if v_value.resolution_status is distinct from 'READY' then
    return new;
  end if;

  new.resolved_regional_units := v_policy.default_sales_units;
  new.resolved_regional_base_qty := v_policy.default_sales_units * new.sku_base_qty_per_unit;
  new.regional_basis_source := 'REGIONAL_DEFAULT_POLICY_UNITS';
  new.regional_basis_status := 'REVIEW_REQUIRED';
  new.regional_basis_note :=
    case
      when v_scenario = 'NON_POSITIVE_NET_ACTUAL_HISTORY' then
        format(
          'Eligible signed actual regional history exists, but its frozen 12-month net billed value is zero or negative. Actual evidence remains preserved; governed CSA policy %s supplies %s planning units for %s for costing allocation and requires review.',
          v_policy.policy_id, v_policy.default_sales_units, new.region_code
        )
      else
        format(
          'No higher-precedence positive regional physical basis is available. Governed regional default policy %s supplies %s total sales units for %s; commercial value is derived from governed standard pricing and requires review.',
          v_policy.policy_id, v_policy.default_sales_units, new.region_code
        )
    end;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Backend-owned scope expander
-- ---------------------------------------------------------------------------
create or replace function costing.fn_expand_sales_allocation_default_policy_scope(
  p_anchor_kind text,
  p_scenario_code text,
  p_region_code text,
  p_scope text
)
returns table (
  target_kind text,
  scenario_code text,
  region_code text,
  sort_ord integer
)
language plpgsql
stable
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
declare
  v_kind text := upper(btrim(coalesce(p_anchor_kind, '')));
  v_scenario text := upper(btrim(coalesce(p_scenario_code, '')));
  v_region text := upper(btrim(coalesce(p_region_code, '')));
  v_scope text := upper(btrim(coalesce(p_scope, '')));
begin
  if v_kind not in ('COMPANY', 'REGIONAL') then
    raise exception 'Invalid anchor kind. Expected COMPANY or REGIONAL.';
  end if;
  if coalesce(v_scope, '') = '' then
    raise exception 'Scope is required.';
  end if;

  if v_kind = 'COMPANY' then
    if v_scenario not in ('NEW_SKU_EXISTING_PRODUCT', 'NEW_PRODUCT_NO_HISTORY') then
      raise exception 'Invalid company allocation policy scenario.';
    end if;
    if v_scope not in ('THIS_POLICY', 'ALL_COMPANY', 'ALL_LINKED') then
      raise exception 'Invalid company scope. Expected THIS_POLICY, ALL_COMPANY, or ALL_LINKED.';
    end if;
  else
    if v_scenario not in (
      'NO_ELIGIBLE_REGIONAL_HISTORY',
      'NO_POSITIVE_REGIONAL_HISTORY',
      'NON_POSITIVE_NET_ACTUAL_HISTORY'
    ) then
      raise exception 'Invalid regional allocation policy scenario.';
    end if;
    if v_region not in ('IK', 'OK') then
      raise exception 'Region must be IK or OK.';
    end if;
    if v_scope not in ('THIS_POLICY', 'SAME_REGION_LINKED', 'ALL_REGIONAL', 'ALL_LINKED') then
      raise exception 'Invalid regional scope. Expected THIS_POLICY, SAME_REGION_LINKED, ALL_REGIONAL, or ALL_LINKED.';
    end if;
  end if;

  if v_kind = 'COMPANY' and v_scope = 'THIS_POLICY' then
    return query select 'COMPANY'::text, v_scenario, null::text, 1;
    return;
  end if;

  if v_kind = 'COMPANY' and v_scope = 'ALL_COMPANY' then
    return query
    values
      ('COMPANY'::text, 'NEW_SKU_EXISTING_PRODUCT'::text, null::text, 1),
      ('COMPANY'::text, 'NEW_PRODUCT_NO_HISTORY'::text, null::text, 2);
    return;
  end if;

  if v_kind = 'REGIONAL' and v_scope = 'THIS_POLICY' then
    return query select 'REGIONAL'::text, v_scenario, v_region, 1;
    return;
  end if;

  if v_kind = 'REGIONAL' and v_scope = 'SAME_REGION_LINKED' then
    return query
    values
      ('REGIONAL'::text, 'NO_ELIGIBLE_REGIONAL_HISTORY'::text, v_region, 10),
      ('REGIONAL'::text, 'NO_POSITIVE_REGIONAL_HISTORY'::text, v_region, 11),
      ('REGIONAL'::text, 'NON_POSITIVE_NET_ACTUAL_HISTORY'::text, v_region, 12);
    return;
  end if;

  -- ALL_REGIONAL or ALL_LINKED
  return query
  with regional as (
    select * from (
      values
        ('NO_ELIGIBLE_REGIONAL_HISTORY'::text, 10),
        ('NO_POSITIVE_REGIONAL_HISTORY'::text, 11),
        ('NON_POSITIVE_NET_ACTUAL_HISTORY'::text, 12)
    ) s(scenario_code, sort_ord)
  ),
  regions as (
    select * from (values ('IK'::text, 1), ('OK'::text, 2)) r(region_code, sort_ord)
  ),
  company as (
    select * from (
      values
        ('NEW_SKU_EXISTING_PRODUCT'::text, 1),
        ('NEW_PRODUCT_NO_HISTORY'::text, 2)
    ) c(scenario_code, sort_ord)
    where v_scope = 'ALL_LINKED'
  )
  select 'COMPANY'::text, c.scenario_code, null::text, c.sort_ord from company c
  union all
  select 'REGIONAL'::text, r.scenario_code, g.region_code, r.sort_ord * 10 + g.sort_ord
  from regional r
  cross join regions g
  where v_scope in ('ALL_REGIONAL', 'ALL_LINKED')
  order by 1, 4, 2, 3;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Internal mutation helpers (shared by single SET + scoped SET)
-- ---------------------------------------------------------------------------
create or replace function costing.fn_revise_sales_allocation_default_policy(
  p_actor uuid,
  p_scenario_code text,
  p_default_sales_units numeric,
  p_effective_from date,
  p_reason text,
  p_approval_reference text
)
returns costing.sales_allocation_default_policy
language plpgsql
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
declare
  v_scenario text := upper(btrim(coalesce(p_scenario_code, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_ref text := nullif(btrim(coalesce(p_approval_reference, '')), '');
  v_previous costing.sales_allocation_default_policy%rowtype;
  v_saved costing.sales_allocation_default_policy%rowtype;
begin
  if p_actor is null then
    raise exception 'Authenticated user context is required';
  end if;
  if v_scenario not in ('NEW_SKU_EXISTING_PRODUCT', 'NEW_PRODUCT_NO_HISTORY') then
    raise exception 'Invalid allocation policy scenario.';
  end if;
  if p_default_sales_units is null or p_default_sales_units <= 0 then
    raise exception 'Default sales units must be greater than zero.';
  end if;
  if p_effective_from is null then
    raise exception 'Effective-from date is required.';
  end if;
  if v_reason is null then
    raise exception 'Reason is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('PPM_SALES_ALLOCATION_DEFAULT:' || v_scenario, 0)
  );

  select p.* into v_previous
  from costing.sales_allocation_default_policy p
  where p.scenario_code = v_scenario
    and p.status = 'APPROVED'
    and p.effective_to is null
  order by p.effective_from desc, p.id desc
  limit 1
  for update;

  if found then
    if p_effective_from <= v_previous.effective_from then
      raise exception
        'New policy effective date must be later than the current open policy effective date %.',
        v_previous.effective_from;
    end if;
    update costing.sales_allocation_default_policy
    set effective_to = p_effective_from - 1,
        status = 'CLOSED',
        closed_at = clock_timestamp(),
        closed_by = p_actor
    where id = v_previous.id;
  end if;

  insert into costing.sales_allocation_default_policy (
    scenario_code, default_sales_units, effective_from, effective_to, status,
    reason, approval_reference, previous_policy_id, created_at, created_by
  ) values (
    v_scenario, p_default_sales_units, p_effective_from, null, 'APPROVED',
    v_reason, v_ref, v_previous.id, clock_timestamp(), p_actor
  )
  returning * into v_saved;

  return v_saved;
end;
$function$;

create or replace function costing.fn_revise_regional_sales_allocation_default_policy(
  p_actor uuid,
  p_scenario_code text,
  p_region_code text,
  p_default_sales_units numeric,
  p_effective_from date,
  p_reason text,
  p_approval_reference text
)
returns costing.regional_sales_allocation_default_policy
language plpgsql
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
declare
  v_scenario text := upper(btrim(coalesce(p_scenario_code, '')));
  v_region text := upper(btrim(coalesce(p_region_code, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_ref text := nullif(btrim(coalesce(p_approval_reference, '')), '');
  v_previous costing.regional_sales_allocation_default_policy%rowtype;
  v_saved costing.regional_sales_allocation_default_policy%rowtype;
begin
  if p_actor is null then
    raise exception 'Authenticated user context is required';
  end if;
  if v_scenario not in (
    'NO_ELIGIBLE_REGIONAL_HISTORY',
    'NO_POSITIVE_REGIONAL_HISTORY',
    'NON_POSITIVE_NET_ACTUAL_HISTORY'
  ) then
    raise exception 'Invalid regional allocation policy scenario.';
  end if;
  if v_region not in ('IK', 'OK') then
    raise exception 'Region must be IK or OK.';
  end if;
  if p_default_sales_units is null or p_default_sales_units <= 0 then
    raise exception 'Default sales units must be greater than zero.';
  end if;
  if p_effective_from is null then
    raise exception 'Effective-from date is required.';
  end if;
  if v_reason is null then
    raise exception 'Reason is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'PPM_REGIONAL_SALES_ALLOCATION_DEFAULT:' || v_scenario || ':' || v_region,
      0
    )
  );

  select p.* into v_previous
  from costing.regional_sales_allocation_default_policy p
  where p.scenario_code = v_scenario
    and p.region_code = v_region
    and p.status = 'APPROVED'
    and p.effective_to is null
  order by p.effective_from desc, p.id desc
  limit 1
  for update;

  if found then
    if p_effective_from <= v_previous.effective_from then
      raise exception
        'New policy effective date must be later than the current open policy effective date %.',
        v_previous.effective_from;
    end if;
    update costing.regional_sales_allocation_default_policy
    set effective_to = p_effective_from - 1,
        status = 'CLOSED',
        closed_at = clock_timestamp(),
        closed_by = p_actor
    where id = v_previous.id;
  end if;

  insert into costing.regional_sales_allocation_default_policy (
    scenario_code, region_code, default_sales_units, effective_from, status,
    reason, approval_reference, previous_policy_id, created_at, created_by
  ) values (
    v_scenario, v_region, p_default_sales_units, p_effective_from, 'APPROVED',
    v_reason, v_ref, v_previous.id, clock_timestamp(), p_actor
  )
  returning * into v_saved;

  return v_saved;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Compatibility single SET RPCs (share helpers; regional whitelist includes NON_POSITIVE)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_set_sales_allocation_default_policy(
  p_scenario_code text,
  p_default_sales_units numeric,
  p_effective_from date,
  p_reason text,
  p_approval_reference text default null::text
)
returns table (
  policy_id bigint,
  scenario_code text,
  default_sales_units numeric,
  effective_from date,
  effective_to date,
  status text,
  previous_policy_id bigint,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path to 'public', 'costing', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_saved costing.sales_allocation_default_policy%rowtype;
begin
  perform public.require_permission('module:pricing-policy-manager', true);
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authenticated user context is required';
  end if;
  v_saved := costing.fn_revise_sales_allocation_default_policy(
    v_actor, p_scenario_code, p_default_sales_units, p_effective_from, p_reason, p_approval_reference
  );
  return query
  select v_saved.id, v_saved.scenario_code, v_saved.default_sales_units, v_saved.effective_from,
         v_saved.effective_to, v_saved.status, v_saved.previous_policy_id, v_saved.created_at, v_saved.created_by;
end;
$function$;

create or replace function public.rpc_set_regional_sales_allocation_default_policy(
  p_scenario_code text,
  p_region_code text,
  p_default_sales_units numeric,
  p_effective_from date,
  p_reason text,
  p_approval_reference text default null::text
)
returns table (
  policy_id bigint,
  scenario_code text,
  region_code text,
  default_sales_units numeric,
  effective_from date,
  effective_to date,
  status text,
  previous_policy_id bigint,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path to 'public', 'costing', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_saved costing.regional_sales_allocation_default_policy%rowtype;
begin
  perform public.require_permission('module:pricing-policy-manager', true);
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authenticated user context is required';
  end if;
  v_saved := costing.fn_revise_regional_sales_allocation_default_policy(
    v_actor, p_scenario_code, p_region_code, p_default_sales_units,
    p_effective_from, p_reason, p_approval_reference
  );
  return query
  select v_saved.id, v_saved.scenario_code, v_saved.region_code, v_saved.default_sales_units,
         v_saved.effective_from, v_saved.effective_to, v_saved.status, v_saved.previous_policy_id,
         v_saved.created_at, v_saved.created_by;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Preview RPC (no writes; same expander as commit)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_preview_sales_allocation_default_policy_scope(
  p_anchor_kind text,
  p_scenario_code text,
  p_region_code text,
  p_scope text,
  p_default_sales_units numeric,
  p_effective_from date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'costing', 'pg_temp'
as $function$
declare
  v_targets jsonb := '[]'::jsonb;
  v_row record;
  v_current_units numeric;
  v_current_from date;
  v_current_id bigint;
  v_ok boolean := true;
  v_error text;
  v_count integer := 0;
begin
  perform public.require_permission('module:pricing-policy-manager', false);

  if p_default_sales_units is null or p_default_sales_units <= 0 then
    raise exception 'Default sales units must be greater than zero.';
  end if;
  if p_effective_from is null then
    raise exception 'Effective-from date is required.';
  end if;

  for v_row in
    select *
    from costing.fn_expand_sales_allocation_default_policy_scope(
      p_anchor_kind, p_scenario_code, p_region_code, p_scope
    )
    order by sort_ord, scenario_code, coalesce(region_code, '')
  loop
    v_count := v_count + 1;
    v_current_units := null;
    v_current_from := null;
    v_current_id := null;
    v_error := null;

    if v_row.target_kind = 'COMPANY' then
      select p.id, p.default_sales_units, p.effective_from
      into v_current_id, v_current_units, v_current_from
      from costing.sales_allocation_default_policy p
      where p.scenario_code = v_row.scenario_code
        and p.status = 'APPROVED'
        and p.effective_to is null
      order by p.effective_from desc, p.id desc
      limit 1;
    else
      select p.id, p.default_sales_units, p.effective_from
      into v_current_id, v_current_units, v_current_from
      from costing.regional_sales_allocation_default_policy p
      where p.scenario_code = v_row.scenario_code
        and p.region_code = v_row.region_code
        and p.status = 'APPROVED'
        and p.effective_to is null
      order by p.effective_from desc, p.id desc
      limit 1;
    end if;

    if v_current_id is not null and p_effective_from <= v_current_from then
      v_ok := false;
      v_error := format(
        'Effective-from must be later than open policy effective-from %s',
        v_current_from
      );
    end if;

    v_targets := v_targets || jsonb_build_array(
      jsonb_build_object(
        'target_kind', v_row.target_kind,
        'scenario_code', v_row.scenario_code,
        'region_code', v_row.region_code,
        'current_policy_id', v_current_id,
        'current_units', v_current_units,
        'current_effective_from', v_current_from,
        'proposed_units', p_default_sales_units,
        'proposed_effective_from', p_effective_from,
        'validation_ok', (v_error is null),
        'validation_error', v_error
      )
    );
  end loop;

  return jsonb_build_object(
    'anchor_kind', upper(btrim(p_anchor_kind)),
    'anchor_scenario_code', upper(btrim(p_scenario_code)),
    'anchor_region_code', nullif(upper(btrim(coalesce(p_region_code, ''))), ''),
    'scope', upper(btrim(p_scope)),
    'proposed_units', p_default_sales_units,
    'proposed_effective_from', p_effective_from,
    'target_count', v_count,
    'commit_allowed', v_ok and v_count > 0,
    'targets', v_targets,
    'warnings', jsonb_build_array(
      'Completed costing runs remain unchanged (including Run 108).',
      'Future costing refresh evidence may change.',
      'Exact-evidence acceptances may reopen when fingerprints change.'
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Atomic scoped commit RPC
-- ---------------------------------------------------------------------------
create or replace function public.rpc_set_sales_allocation_default_policies_scoped(
  p_anchor_kind text,
  p_scenario_code text,
  p_region_code text,
  p_scope text,
  p_default_sales_units numeric,
  p_effective_from date,
  p_reason text,
  p_approval_reference text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'costing', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_row record;
  v_company costing.sales_allocation_default_policy%rowtype;
  v_regional costing.regional_sales_allocation_default_policy%rowtype;
  v_created jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_preview jsonb;
begin
  perform public.require_permission('module:pricing-policy-manager', true);
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authenticated user context is required';
  end if;

  -- Validate-all-first via same expander/preview rules
  v_preview := public.rpc_preview_sales_allocation_default_policy_scope(
    p_anchor_kind, p_scenario_code, p_region_code, p_scope,
    p_default_sales_units, p_effective_from
  );
  if coalesce((v_preview ->> 'commit_allowed')::boolean, false) is not true then
    raise exception 'Scoped policy revision failed validation for one or more targets.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reason is required.';
  end if;

  for v_row in
    select *
    from costing.fn_expand_sales_allocation_default_policy_scope(
      p_anchor_kind, p_scenario_code, p_region_code, p_scope
    )
    order by sort_ord, scenario_code, coalesce(region_code, '')
  loop
    v_count := v_count + 1;
    if v_row.target_kind = 'COMPANY' then
      v_company := costing.fn_revise_sales_allocation_default_policy(
        v_actor, v_row.scenario_code, p_default_sales_units,
        p_effective_from, p_reason, p_approval_reference
      );
      v_created := v_created || jsonb_build_array(
        jsonb_build_object(
          'target_kind', 'COMPANY',
          'policy_id', v_company.id,
          'scenario_code', v_company.scenario_code,
          'region_code', null,
          'default_sales_units', v_company.default_sales_units,
          'effective_from', v_company.effective_from,
          'previous_policy_id', v_company.previous_policy_id,
          'status', v_company.status
        )
      );
    else
      v_regional := costing.fn_revise_regional_sales_allocation_default_policy(
        v_actor, v_row.scenario_code, v_row.region_code, p_default_sales_units,
        p_effective_from, p_reason, p_approval_reference
      );
      v_created := v_created || jsonb_build_array(
        jsonb_build_object(
          'target_kind', 'REGIONAL',
          'policy_id', v_regional.id,
          'scenario_code', v_regional.scenario_code,
          'region_code', v_regional.region_code,
          'default_sales_units', v_regional.default_sales_units,
          'effective_from', v_regional.effective_from,
          'previous_policy_id', v_regional.previous_policy_id,
          'status', v_regional.status
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'scope', upper(btrim(p_scope)),
    'created_count', v_count,
    'created_policies', v_created,
    'warnings', v_preview -> 'warnings'
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Deprecate temporary shared fallback create (no authenticated business use)
-- ---------------------------------------------------------------------------
revoke all on function costing.rpc_create_sales_planning_fallback_unit_policy(numeric, date, text, text)
  from public, anon, authenticated;

comment on table costing.sales_planning_fallback_unit_policy is
  'DEPRECATED AUDIT ARTIFACT. Temporary shared fallback units. CSA scenario policy rows are authoritative.';
comment on function costing.fn_resolve_sales_planning_fallback_units_as_of(date) is
  'DEPRECATED. Not used by costing as-of resolvers after CSA scenario-owned cutover.';
comment on function costing.rpc_create_sales_planning_fallback_unit_policy(numeric, date, text, text) is
  'DEPRECATED. Authenticated execute revoked. Use Pricing Policy Manager CSA scenario policies.';

-- ---------------------------------------------------------------------------
-- 11. Grants
-- ---------------------------------------------------------------------------
grant execute on function costing.fn_expand_sales_allocation_default_policy_scope(text, text, text, text)
  to authenticated, service_role;
grant execute on function public.rpc_preview_sales_allocation_default_policy_scope(text, text, text, text, numeric, date)
  to authenticated, service_role;
grant execute on function public.rpc_set_sales_allocation_default_policies_scoped(text, text, text, text, numeric, date, text, text)
  to authenticated, service_role;
grant execute on function public.rpc_set_sales_allocation_default_policy(text, numeric, date, text, text)
  to authenticated, service_role;
grant execute on function public.rpc_set_regional_sales_allocation_default_policy(text, text, numeric, date, text, text)
  to authenticated, service_role;
