-- WP05-W506-CONF-01 -- personnel-confidentiality gate for the three Staff Governance public views.
-- PROPOSED / FOR REVIEW ONLY. NOT APPLIED. Applying it to production is a separate, explicit owner decision.
--
-- Finding (issue #234; repository + SELECT-only catalogue evidence): v_costing_staff_classification_register and
-- v_costing_unclassified_staff_for_costing expose individual salary components; v_costing_staff_cost_pool_summary exposes the nested
-- staff_details; all three are readable by every user passing the broad public.fn_costing_view_allowed() (VIEW on ANY of four costing
-- modules) because of TB2 (20261019134900).
--
-- Change (temporary policy; a dedicated personnel-costing permission later only changes ONE function body):
--   1. NEW public.fn_costing_personnel_view_allowed(): postgres/service_role (refresh jobs, SECURITY DEFINER writers) OR the caller holds
--      module:cost-build-manager VIEW AND EDIT (same policy as the deployed Save/Close writer guards).
--   2. register + unclassified-staff views: row gate becomes the personnel gate (non-personnel callers get zero rows).
--   3. pool-summary view: row gate UNCHANGED (aggregate costing reporting preserved); only the nested staff_details column is NULLed
--      for non-personnel callers (same column name/type/order).
-- Not changed: any GRANT/REVOKE on the views, fn_costing_view_allowed(), the Save/Close functions and wrappers, any table/RLS.
--
-- Transaction management: no top-level BEGIN/COMMIT (the runner owns any enclosing transaction and the history row). Every persistent
-- change to the views happens inside the single DO statement below (atomic by itself). The new helper function is additive and harmless
-- if the DO block later aborts.
--
-- Fail-closed design:
--  * Exact full-definition md5 (pg_get_viewdef) of each target view AND of fn_costing_view_allowed() must equal an owner-readback value;
--    the constants below are PLACEHOLDERS and the migration ABORTS until real fingerprints are filled in from a SELECT-only readback.
--  * Each patch is an exact-once textual substitution on the live definition; anything else aborts.
--  * Post-checks: reverse substitution reproduces the original md5; column names/types/order, owner, ACL and reloptions unchanged.
--  * Idempotent: an already-patched view is accepted only if reversing the substitution restores the verified original fingerprint.
-- Rollback (a SECURITY REGRESSION, containment-first): docs/master-data-costing/prepared/WP05_W506_CONF_01_ROLLBACK.sql (not executed).

create or replace function public.fn_costing_personnel_view_allowed()
returns boolean language sql stable security invoker set search_path = public, pg_temp as $f$
  select current_user = any (array['postgres','service_role']::name[])
      or (public.app_has_permission('module:cost-build-manager','view')
          and public.app_has_permission('module:cost-build-manager','edit'))
$f$;
comment on function public.fn_costing_personnel_view_allowed() is
  'WP05-W506-CONF-01: row/column gate for individual staff and salary data (temporary: Cost Build Manager view AND edit)';
revoke all on function public.fn_costing_personnel_view_allowed() from public, anon;
grant execute on function public.fn_costing_personnel_view_allowed() to authenticated, service_role;

do $migration$
declare
  -- OWNER READBACK REQUIRED (SELECT-only): md5(pg_get_viewdef(oid)) of each view and md5(pg_get_functiondef(oid)) of the gate function.
  c_fp_register constant text := '<<W506_CONF_FP_REGISTER>>';
  c_fp_review   constant text := '<<W506_CONF_FP_REVIEW>>';
  c_fp_pool     constant text := '<<W506_CONF_FP_POOL>>';
  c_fp_gate_fn  constant text := '<<W506_CONF_FP_GATE_FN>>';
  c_old_gate    constant text := 'fn_costing_view_allowed()';
  c_new_gate    constant text := 'fn_costing_personnel_view_allowed()';
  -- pool view: exact rendered select-list line of the nested column, and its rendered replacement (CASE keeps name/type/order)
  c_pool_old    constant text := E'\n            p.staff_details,\n';
  v_views text[] := array['v_costing_staff_classification_register','v_costing_unclassified_staff_for_costing','v_costing_staff_cost_pool_summary'];
  v_fps   text[];
  v_name text; v_fp text; v_oid oid; v_def text; v_new text; v_rendered text; v_old_t text; v_new_t text;
  v_pre record; v_post record; v_type text; v_with text; v_i int;
begin
  if c_fp_register !~ '^[0-9a-f]{32}$' or c_fp_review !~ '^[0-9a-f]{32}$' or c_fp_pool !~ '^[0-9a-f]{32}$' or c_fp_gate_fn !~ '^[0-9a-f]{32}$' then
    raise exception 'W506-CONF-01 aborted: live fingerprints have not been filled in from the owner readback (placeholders present)';
  end if;
  perform set_config('search_path', 'public, pg_temp', true);
  v_fps := array[c_fp_register, c_fp_review, c_fp_pool];

  if to_regprocedure('public.fn_costing_view_allowed()') is null
     or md5(pg_get_functiondef('public.fn_costing_view_allowed()'::regprocedure)) <> c_fp_gate_fn then
    raise exception 'W506-CONF-01 aborted: public.fn_costing_view_allowed() missing or differs from the verified definition';
  end if;
  if to_regprocedure('public.fn_costing_personnel_view_allowed()') is null then
    raise exception 'W506-CONF-01 aborted: personnel gate function missing';
  end if;
  if to_regprocedure('public.app_has_permission(text,text)') is null then
    raise exception 'W506-CONF-01 aborted: public.app_has_permission(text,text) missing';
  end if;

  for v_i in 1 .. array_length(v_views, 1) loop
    v_name := v_views[v_i]; v_fp := v_fps[v_i];
    v_oid := to_regclass('public.' || v_name);
    if v_oid is null or (select relkind from pg_class where oid = v_oid) <> 'v' then
      raise exception 'W506-CONF-01 aborted: view public.% not found', v_name;
    end if;
    v_def := pg_get_viewdef(v_oid);

    select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum) as cols,
           c.relowner as own, c.relacl::text as acl, c.reloptions::text as opts, c.relkind as kind
      into v_pre from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.oid = v_oid group by c.relowner, c.relacl::text, c.reloptions::text, c.relkind;

    -- (old text, new text) for this view
    if v_name = 'v_costing_staff_cost_pool_summary' then
      select format_type(a.atttypid, a.atttypmod) into v_type from pg_attribute a where a.attrelid = v_oid and a.attname = 'staff_details';
      if v_type is null then raise exception 'W506-CONF-01 aborted: staff_details column not found on %', v_name; end if;
      v_old_t := c_pool_old;
      v_new_t := E'\n                CASE\n                    WHEN ( SELECT ' || c_new_gate || E' AS fn_costing_personnel_view_allowed) THEN p.staff_details\n'
                 || E'                    ELSE NULL::' || v_type || E'\n                END AS staff_details,\n';
    else
      v_old_t := c_old_gate; v_new_t := c_new_gate;
    end if;

    if md5(v_def) <> v_fp then
      -- possibly already patched: the new text must occur exactly once and reversing it must restore the verified original
      if (length(v_def) - length(replace(v_def, v_new_t, ''))) <> length(v_new_t)
         or md5(replace(v_def, v_new_t, v_old_t)) <> v_fp then
        raise exception 'W506-CONF-01 aborted: view % is neither the verified original nor the verified patched form (drift)', v_name;
      end if;
      raise notice 'W506-CONF-01: view % already patched (verified); nothing to do', v_name;
      continue;
    end if;

    -- exact-once anchor on the verified original
    if (length(v_def) - length(replace(v_def, v_old_t, ''))) <> length(v_old_t) then
      raise exception 'W506-CONF-01 aborted: anchor is not present exactly once in %', v_name;
    end if;
    v_new := replace(v_def, v_old_t, v_new_t);

    v_with := case when v_pre.opts is null then '' else ' with (' || trim(both '{}' from v_pre.opts) || ')' end;
    execute format('create or replace view public.%I%s as %s', v_name, v_with, v_new);

    -- post-checks (any failure aborts the whole DO statement)
    v_rendered := pg_get_viewdef(v_oid);
    if v_rendered is distinct from v_new or v_rendered = v_def or md5(replace(v_rendered, v_new_t, v_old_t)) <> v_fp then
      raise exception 'W506-CONF-01 aborted: installed definition of % is not exactly the verified original plus the single change', v_name;
    end if;
    select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum) as cols,
           c.relowner as own, c.relacl::text as acl, c.reloptions::text as opts, c.relkind as kind
      into v_post from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.oid = v_oid group by c.relowner, c.relacl::text, c.reloptions::text, c.relkind;
    if v_pre.cols is distinct from v_post.cols or v_pre.own is distinct from v_post.own or v_pre.acl is distinct from v_post.acl
       or v_pre.opts is distinct from v_post.opts or v_pre.kind is distinct from v_post.kind then
      raise exception 'W506-CONF-01 aborted: columns/owner/ACL/reloptions of % changed unexpectedly', v_name;
    end if;
  end loop;
end
$migration$;
