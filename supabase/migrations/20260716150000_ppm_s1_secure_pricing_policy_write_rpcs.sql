-- PPM-S1 — Secure Existing Pricing Policy Write RPCs
-- Date: 2026-07-16
--
-- Purpose:
--   Harden the four Pricing Policy Manager write RPCs with the canonical
--   module edit-permission guard and narrow EXECUTE grants.
--
-- Method:
--   Live function bodies are not versioned in this repository. This migration
--   reads each existing definition via pg_get_functiondef, injects only the
--   canonical permission guard as the first executable statement after BEGIN,
--   hardens search_path to public, costing, pg_temp, then re-creates the
--   function. Business validation, effective-dating, table writes and return
--   shapes are preserved verbatim.
--
-- Scope:
--   - public.rpc_set_sku_selling_price_policy
--   - public.rpc_set_sku_scheme_policy
--   - public.rpc_set_scheme_policy_rule
--   - public.rpc_close_scheme_policy_rule
--
-- Out of scope:
--   client changes, MRP/Scheme Master writes, pricing calculations, snapshots,
--   refresh stages, module registry, require_permission body, table grants.

begin;

do $ppm_s1$
declare
  v_funcs text[][] := array[
    array[
      'rpc_set_sku_selling_price_policy',
      'bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text'
    ],
    array[
      'rpc_set_sku_scheme_policy',
      'bigint, text, bigint, date, text'
    ],
    array[
      'rpc_set_scheme_policy_rule',
      'text, bigint, text, bigint, date, text, bigint, text'
    ],
    array[
      'rpc_close_scheme_policy_rule',
      'bigint, date, text'
    ]
  ];
  v_i integer;
  v_name text;
  v_args text;
  v_oid oid;
  v_def text;
  v_new text;
  v_body_start integer;
  v_begin_rel integer;
  v_begin_abs integer;
  v_prefix text;
  v_suffix text;
  v_guard constant text := $g$
perform public.require_permission(
    'module:pricing-policy-manager',
    true
);
$g$;
begin
  for v_i in 1 .. array_length(v_funcs, 1) loop
    v_name := v_funcs[v_i][1];
    v_args := v_funcs[v_i][2];

    select p.oid
    into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_name
      and pg_get_function_identity_arguments(p.oid) = v_args;

    if v_oid is null then
      raise exception
        'PPM-S1: function public.%(%) not found',
        v_name,
        v_args;
    end if;

    if not (select p.prosecdef from pg_proc p where p.oid = v_oid) then
      raise exception
        'PPM-S1: public.%(%) is not SECURITY DEFINER',
        v_name,
        v_args;
    end if;

    v_def := pg_get_functiondef(v_oid);
    v_new := v_def;

    -- Harden search_path in the CREATE statement.
    if v_new ~* 'SET\s+search_path\s+TO\s+' then
      v_new := regexp_replace(
        v_new,
        'SET\s+search_path\s+TO\s+[^;\n]+',
        'SET search_path TO ''public'', ''costing'', ''pg_temp''',
        'i'
      );
    elsif v_new ~* 'SET\s+search_path\s*=' then
      v_new := regexp_replace(
        v_new,
        'SET\s+search_path\s*=\s*[^;\n]+',
        'SET search_path TO ''public'', ''costing'', ''pg_temp''',
        'i'
      );
    elsif v_new ~* 'SECURITY\s+DEFINER' then
      v_new := regexp_replace(
        v_new,
        'SECURITY\s+DEFINER',
        $r$SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'$r$,
        'i'
      );
    else
      raise exception
        'PPM-S1: cannot locate SECURITY DEFINER / search_path for public.%(%)',
        v_name,
        v_args;
    end if;

    -- Inject module edit guard as first executable statement after BEGIN.
    if v_new !~* 'require_permission\s*\(\s*''module:pricing-policy-manager''' then
      v_body_start := position(E'\nAS $' in v_new);
      if v_body_start = 0 then
        v_body_start := position(' AS $' in v_new);
      end if;
      if v_body_start = 0 then
        raise exception
          'PPM-S1: cannot locate function body marker for public.%(%)',
          v_name,
          v_args;
      end if;

      v_begin_rel := regexp_instr(
        substr(v_new, v_body_start),
        '(?i)\yBEGIN\y'
      );
      if v_begin_rel is null or v_begin_rel = 0 then
        raise exception
          'PPM-S1: cannot locate BEGIN in body for public.%(%)',
          v_name,
          v_args;
      end if;

      v_begin_abs := v_body_start + v_begin_rel - 1;
      v_prefix := left(v_new, v_begin_abs + 4);
      v_suffix := substr(v_new, v_begin_abs + 5);
      v_new := v_prefix || E'\n' || v_guard || v_suffix;
    end if;

    execute v_new;
  end loop;
end;
$ppm_s1$;

-- ---------------------------------------------------------------------------
-- EXECUTE grant hardening (exact identity signatures)
-- ---------------------------------------------------------------------------

revoke execute on function public.rpc_set_sku_selling_price_policy(
  bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text
) from public;
revoke execute on function public.rpc_set_sku_selling_price_policy(
  bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text
) from anon;
revoke execute on function public.rpc_set_sku_selling_price_policy(
  bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text
) from service_role;
grant execute on function public.rpc_set_sku_selling_price_policy(
  bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text
) to authenticated;
grant execute on function public.rpc_set_sku_selling_price_policy(
  bigint, numeric, numeric, numeric, numeric, numeric, numeric, date, text
) to postgres;

revoke execute on function public.rpc_set_sku_scheme_policy(
  bigint, text, bigint, date, text
) from public;
revoke execute on function public.rpc_set_sku_scheme_policy(
  bigint, text, bigint, date, text
) from anon;
revoke execute on function public.rpc_set_sku_scheme_policy(
  bigint, text, bigint, date, text
) from service_role;
grant execute on function public.rpc_set_sku_scheme_policy(
  bigint, text, bigint, date, text
) to authenticated;
grant execute on function public.rpc_set_sku_scheme_policy(
  bigint, text, bigint, date, text
) to postgres;

revoke execute on function public.rpc_set_scheme_policy_rule(
  text, bigint, text, bigint, date, text, bigint, text
) from public;
revoke execute on function public.rpc_set_scheme_policy_rule(
  text, bigint, text, bigint, date, text, bigint, text
) from anon;
revoke execute on function public.rpc_set_scheme_policy_rule(
  text, bigint, text, bigint, date, text, bigint, text
) from service_role;
grant execute on function public.rpc_set_scheme_policy_rule(
  text, bigint, text, bigint, date, text, bigint, text
) to authenticated;
grant execute on function public.rpc_set_scheme_policy_rule(
  text, bigint, text, bigint, date, text, bigint, text
) to postgres;

revoke execute on function public.rpc_close_scheme_policy_rule(
  bigint, date, text
) from public;
revoke execute on function public.rpc_close_scheme_policy_rule(
  bigint, date, text
) from anon;
revoke execute on function public.rpc_close_scheme_policy_rule(
  bigint, date, text
) from service_role;
grant execute on function public.rpc_close_scheme_policy_rule(
  bigint, date, text
) to authenticated;
grant execute on function public.rpc_close_scheme_policy_rule(
  bigint, date, text
) to postgres;

notify pgrst, 'reload schema';

commit;
