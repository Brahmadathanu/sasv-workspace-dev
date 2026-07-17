-- PPM-S1 — Pricing Policy write RPC security smoke test
-- Run AFTER applying:
--   supabase/migrations/20260716150000_ppm_s1_secure_pricing_policy_write_rpcs.sql
--
-- PPM-S2.6 also extends section A with post-drop MRP canonical checks
-- (costing.sku_mrp_policy, public.rpc_set_sku_mrp_policy, MRP views).
-- public.sku_prices is dropped and must not be probed.
--
-- This file is read-only for automated checks.
-- Manual JWT / browser sections are clearly marked and must use controlled
-- staging records only.

-- =============================================================================
-- A. AUTOMATED VERIFICATION (read-only)
-- =============================================================================

-- A1–A4: existence, owner, SECURITY DEFINER, search_path, identity signatures
with expected(proname, identity_args) as (
  values
    (
      'rpc_set_sku_selling_price_policy',
      'bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text'
    ),
    (
      'rpc_set_sku_scheme_policy',
      'bigint, text, bigint, date, text'
    ),
    (
      'rpc_set_scheme_policy_rule',
      'text, bigint, text, bigint, date, text, bigint, text'
    ),
    (
      'rpc_close_scheme_policy_rule',
      'bigint, date, text'
    )
),
resolved as (
  select
    e.proname,
    e.identity_args,
    p.oid,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef as is_security_definer,
    coalesce(
      (
        select trim(both from option_value)
        from unnest(p.proconfig) as cfg(option_value)
        where option_value like 'search_path=%'
        limit 1
      ),
      ''
    ) as search_path_config,
    pg_get_functiondef(p.oid) as definition
  from expected e
  left join pg_proc p
    on p.proname = e.proname
   and pg_get_function_identity_arguments(p.oid) = e.identity_args
  left join pg_namespace n
    on n.oid = p.pronamespace
   and n.nspname = 'public'
)
select
  proname,
  identity_args,
  (oid is not null) as exists_with_identity_signature,
  owner_name,
  (owner_name = 'postgres') as owner_is_postgres,
  is_security_definer,
  search_path_config,
  (
    search_path_config = 'search_path=public, costing, pg_temp'
    or search_path_config = 'search_path="public", "costing", "pg_temp"'
  ) as search_path_ok,
  (
    definition ~* 'require_permission\s*\(\s*''module:pricing-policy-manager'''
  ) as has_pricing_policy_edit_guard
from resolved
order by proname;

-- Expect 4 rows; all flags true; owner_name = postgres.

-- A5–A9: EXECUTE privilege matrix via has_function_privilege()
with expected(proname, identity_args) as (
  values
    (
      'rpc_set_sku_selling_price_policy',
      'bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text'
    ),
    (
      'rpc_set_sku_scheme_policy',
      'bigint, text, bigint, date, text'
    ),
    (
      'rpc_set_scheme_policy_rule',
      'text, bigint, text, bigint, date, text, bigint, text'
    ),
    (
      'rpc_close_scheme_policy_rule',
      'bigint, date, text'
    )
),
roles(role_name) as (
  values
    ('public'),
    ('anon'),
    ('authenticated'),
    ('service_role'),
    ('postgres')
)
select
  e.proname,
  e.identity_args,
  r.role_name,
  has_function_privilege(
    r.role_name,
    format('public.%I(%s)', e.proname, e.identity_args),
    'EXECUTE'
  ) as has_execute,
  case r.role_name
    when 'public' then false
    when 'anon' then false
    when 'service_role' then false
    when 'authenticated' then true
    when 'postgres' then true
  end as expected_execute,
  has_function_privilege(
    r.role_name,
    format('public.%I(%s)', e.proname, e.identity_args),
    'EXECUTE'
  ) = case r.role_name
    when 'public' then false
    when 'anon' then false
    when 'service_role' then false
    when 'authenticated' then true
    when 'postgres' then true
  end as grant_matrix_ok
from expected e
cross join roles r
order by e.proname, r.role_name;

-- Expect grant_matrix_ok = true for all 20 rows (4 functions × 5 roles).

-- A10: No new direct table privileges for authenticated / anon / PUBLIC
-- on pricing/costing policy source tables (read-only check).
-- Capture this result before and after migration to confirm no broadening.
-- Note: public.sku_prices was dropped in the PPM-S2 cutover; do not probe it.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.table_privileges
where table_schema in ('public', 'costing')
  and grantee in ('authenticated', 'anon', 'PUBLIC')
  and privilege_type in (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  )
  and (
    table_name ilike '%selling_price_policy%'
    or table_name ilike '%scheme_policy%'
    or table_name ilike '%scheme_master%'
    or table_name = 'sku_mrp_policy'
  )
order by table_schema, table_name, grantee, privilege_type;

-- Expect: zero rows (or unchanged vs pre-migration baseline).
-- PPM-S1 must not grant INSERT/UPDATE/DELETE/TRUNCATE on these tables.

-- =============================================================================
-- A11–A14: PPM-S2 post-drop MRP canonical path (read-only)
-- =============================================================================

-- A11: No direct anon / authenticated / service_role access to
--      costing.sku_mrp_policy (SELECT / INSERT / UPDATE / DELETE / TRUNCATE).
with roles(role_name) as (
  values
    ('anon'),
    ('authenticated'),
    ('service_role')
),
privs(privilege_type) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE')
)
select
  'costing.sku_mrp_policy'::text as relation,
  r.role_name,
  p.privilege_type,
  has_table_privilege(
    r.role_name,
    'costing.sku_mrp_policy',
    p.privilege_type
  ) as has_privilege,
  false as expected_privilege,
  not has_table_privilege(
    r.role_name,
    'costing.sku_mrp_policy',
    p.privilege_type
  ) as access_denied_ok
from roles r
cross join privs p
order by r.role_name, p.privilege_type;

-- Expect: access_denied_ok = true for all 15 rows (3 roles × 5 privileges).

-- A12: public.rpc_set_sku_mrp_policy — existence, owner, SECURITY DEFINER,
--      exact search_path, permission guard.
with resolved as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef as is_security_definer,
    coalesce(
      (
        select trim(both from option_value)
        from unnest(p.proconfig) as cfg(option_value)
        where option_value like 'search_path=%'
        limit 1
      ),
      ''
    ) as search_path_config,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
   and n.nspname = 'public'
  where p.proname = 'rpc_set_sku_mrp_policy'
)
select
  proname,
  identity_args,
  (oid is not null) as exists_in_public,
  owner_name,
  (owner_name = 'postgres') as owner_is_postgres,
  is_security_definer,
  search_path_config,
  (
    search_path_config = 'search_path=public, costing, pg_temp'
    or search_path_config = 'search_path="public", "costing", "pg_temp"'
  ) as search_path_ok,
  (
    definition ~* 'require_permission\s*\(\s*''module:pricing-policy-manager'''
  ) as has_pricing_policy_edit_guard
from resolved;

-- Expect: one row; all flags true; owner_name = postgres.

-- A13: EXECUTE privilege matrix for public.rpc_set_sku_mrp_policy
--      authenticated = yes; anon / service_role / PUBLIC = no; postgres = yes.
with fn as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
   and n.nspname = 'public'
  where p.proname = 'rpc_set_sku_mrp_policy'
),
roles(role_name) as (
  values
    ('public'),
    ('anon'),
    ('authenticated'),
    ('service_role'),
    ('postgres')
)
select
  f.proname,
  f.identity_args,
  r.role_name,
  has_function_privilege(r.role_name, f.oid, 'EXECUTE') as has_execute,
  case r.role_name
    when 'public' then false
    when 'anon' then false
    when 'service_role' then false
    when 'authenticated' then true
    when 'postgres' then true
  end as expected_execute,
  has_function_privilege(r.role_name, f.oid, 'EXECUTE') = case r.role_name
    when 'public' then false
    when 'anon' then false
    when 'service_role' then false
    when 'authenticated' then true
    when 'postgres' then true
  end as grant_matrix_ok
from fn f
cross join roles r
order by r.role_name;

-- Expect: grant_matrix_ok = true for all 5 rows.
-- Especially: authenticated EXECUTE yes; anon / service_role EXECUTE no.

-- A14: Canonical MRP views exist in public.
with expected(view_name) as (
  values
    ('v_sku_mrp_current'),
    ('v_sku_mrp_effective'),
    ('v_sku_mrp_policy_history')
)
select
  e.view_name,
  (c.oid is not null) as exists_as_view,
  coalesce(n.nspname, 'public') as schema_name
from expected e
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
 and c.relname = e.view_name
 and c.relkind = 'v'
order by e.view_name;

-- Expect: three rows; exists_as_view = true; schema_name = public.

-- =============================================================================
-- B. MANUAL JWT PERMISSION MATRIX (controlled; not automated)
-- =============================================================================
--
-- Prepare three authenticated users / sessions:
--   U_NONE  — no row in user_permissions_canonical for
--             target = 'module:pricing-policy-manager'
--   U_VIEW  — can_view = true, can_edit = false
--   U_EDIT  — can_view = true, can_edit = true
--
-- Call each RPC via PostgREST / supabase.rpc with that user's JWT.
-- Use benign / controlled payloads only.
--
-- Expected:
--   U_NONE → denied (require_permission fail-closed)
--   U_VIEW → denied (need edit)
--   U_EDIT → allowed (business validation may still reject bad inputs)
--
-- Example probe shapes (replace IDs with controlled staging values):
--
--   select * from public.rpc_set_sku_selling_price_policy(
--     <sku_id>::bigint,
--     <gst>::numeric,
--     <ik_pct>::numeric,
--     <ok_pct>::numeric,
--     <ik_amt>::numeric,
--     <ok_amt>::numeric,
--     <contingency>::numeric,
--     current_date,
--     'PPM-S1 security probe'
--   );
--
--   select * from public.rpc_set_sku_scheme_policy(
--     <sku_id>::bigint,
--     'IK',
--     <scheme_id>::bigint,
--     current_date,
--     'PPM-S1 security probe'
--   );
--
--   select * from public.rpc_set_scheme_policy_rule(
--     <policy_scope>::text,
--     <scope_id>::bigint,
--     'IK',
--     <scheme_id>::bigint,
--     current_date,
--     'ASSIGN',
--     null::bigint,
--     'PPM-S1 security probe — close after test'
--   );
--
--   select * from public.rpc_close_scheme_policy_rule(
--     <policy_rule_id>::bigint,
--     current_date,
--     'PPM-S1 security probe close'
--   );
--
-- Do NOT require a direct postgres session call to succeed when auth.uid()
-- is null. Postgres acceptance is retained EXECUTE privilege only (section A).

-- =============================================================================
-- C. CONTROLLED BUSINESS REGRESSION (browser; edit-authorized user)
-- =============================================================================
--
-- As U_EDIT in Pricing Policy Manager:
--   1. Selling policy save          → rpc_set_sku_selling_price_policy
--   2. Direct SKU scheme assignment → rpc_set_sku_scheme_policy
--   3. Hierarchy scheme-rule create → rpc_set_scheme_policy_rule
--   4. Hierarchy scheme-rule close  → rpc_close_scheme_policy_rule
--
-- Any temporary hierarchy scheme rule created solely for testing MUST:
--   - contain a clear PPM-S1 test remark;
--   - use a narrowly selected scope;
--   - be closed immediately after verification.
--
-- As U_VIEW: confirm server rejection via direct supabase.rpc / DevTools.
-- Do not rely only on hidden buttons (client edit gating is out of PPM-S1).

-- =============================================================================
-- D. QUICK PASS/FAIL SUMMARY HELPER (read-only)
-- =============================================================================
with expected(proname, identity_args) as (
  values
    (
      'rpc_set_sku_selling_price_policy',
      'bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text'
    ),
    (
      'rpc_set_sku_scheme_policy',
      'bigint, text, bigint, date, text'
    ),
    (
      'rpc_set_scheme_policy_rule',
      'text, bigint, text, bigint, date, text, bigint, text'
    ),
    (
      'rpc_close_scheme_policy_rule',
      'bigint, date, text'
    )
),
fn as (
  select
    e.proname,
    e.identity_args,
    p.oid,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef,
    coalesce(
      (
        select trim(both from option_value)
        from unnest(p.proconfig) as cfg(option_value)
        where option_value like 'search_path=%'
        limit 1
      ),
      ''
    ) as search_path_config,
    pg_get_functiondef(p.oid) as definition
  from expected e
  join pg_proc p
    on p.proname = e.proname
   and pg_get_function_identity_arguments(p.oid) = e.identity_args
  join pg_namespace n
    on n.oid = p.pronamespace
   and n.nspname = 'public'
),
checks as (
  select
    count(*) filter (
      where oid is not null
        and owner_name = 'postgres'
        and prosecdef
        and (
          search_path_config = 'search_path=public, costing, pg_temp'
          or search_path_config = 'search_path="public", "costing", "pg_temp"'
        )
        and definition ~* 'require_permission\s*\(\s*''module:pricing-policy-manager'''
        and not has_function_privilege(
          'public',
          format('public.%I(%s)', proname, identity_args),
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          format('public.%I(%s)', proname, identity_args),
          'EXECUTE'
        )
        and not has_function_privilege(
          'service_role',
          format('public.%I(%s)', proname, identity_args),
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          format('public.%I(%s)', proname, identity_args),
          'EXECUTE'
        )
        and has_function_privilege(
          'postgres',
          format('public.%I(%s)', proname, identity_args),
          'EXECUTE'
        )
    ) as functions_passing,
    count(*) as functions_expected
  from fn
)
select
  functions_passing,
  functions_expected,
  (functions_passing = functions_expected) as ppm_s1_security_gate_pass
from checks;

-- Expect: functions_passing = 4, ppm_s1_security_gate_pass = true
