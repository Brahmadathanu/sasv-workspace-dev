-- WP05-W506-CONF-01 ROLLBACK PROCEDURE -- PREPARED, NOT EXECUTED. Do not run without explicit owner EMERGENCY approval.
--
-- !! SECURITY REGRESSION !! Running this restores the broad fn_costing_view_allowed() gate on the register and unclassified-staff views
-- and the unmasked staff_details column on the pool summary, RE-EXPOSING individual salary data to every user with VIEW on any costing
-- module. Containment-first policy: prefer a forward fix or an equivalent protective control over restoring the exposure. Use only if the
-- personnel gate itself breaks a legitimate workflow AND an alternative control is in place.
--
-- Interlock: the session must set  w506.personnel_gate_rollback_owner_emergency_approval  to the exact phrase below, otherwise abort:
--   set w506.personnel_gate_rollback_owner_emergency_approval = 'I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL';
--
-- Fail-closed: the live definition of each view must be EXACTLY the verified original, or the verified original with the single
-- deterministic change (reversing it must hash to the verified original); columns/owner/ACL/reloptions unchanged; the gate function
-- fn_costing_personnel_view_allowed() is intentionally left in place (additive, unused after rollback).
-- No top-level BEGIN/COMMIT (the runner owns the transaction); every persistent change is one DO statement.

do $rollback$
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
    raise exception 'W506-CONF-01 rollback aborted: live fingerprints have not been filled in from the owner readback (placeholders present)';
  end if;
  perform set_config('search_path', 'public, pg_temp', true);
  v_fps := array[c_fp_register, c_fp_review, c_fp_pool];
  if coalesce(current_setting('w506.personnel_gate_rollback_owner_emergency_approval', true), '') <> 'I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL' then
    raise exception 'W506-CONF-01 rollback aborted: owner emergency approval interlock not set';
  end if;

  if to_regprocedure('public.fn_costing_view_allowed()') is null
     or md5(pg_get_functiondef('public.fn_costing_view_allowed()'::regprocedure)) <> c_fp_gate_fn then
    raise exception 'W506-CONF-01 rollback aborted: public.fn_costing_view_allowed() missing or differs from the verified definition';
  end if;
  if to_regprocedure('public.app_has_permission(text,text)') is null then
    raise exception 'W506-CONF-01 rollback aborted: public.app_has_permission(text,text) missing';
  end if;

  for v_i in 1 .. array_length(v_views, 1) loop
    v_name := v_views[v_i]; v_fp := v_fps[v_i];
    v_oid := to_regclass('public.' || v_name);
    if v_oid is null or (select relkind from pg_class where oid = v_oid) <> 'v' then
      raise exception 'W506-CONF-01 rollback aborted: view public.% not found', v_name;
    end if;
    v_def := pg_get_viewdef(v_oid);

    select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum) as cols,
           c.relowner as own, c.relacl::text as acl, c.reloptions::text as opts, c.relkind as kind
      into v_pre from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.oid = v_oid group by c.relowner, c.relacl::text, c.reloptions::text, c.relkind;

    -- (old text, new text) for this view
    if v_name = 'v_costing_staff_cost_pool_summary' then
      select format_type(a.atttypid, a.atttypmod) into v_type from pg_attribute a where a.attrelid = v_oid and a.attname = 'staff_details';
      if v_type is null then raise exception 'W506-CONF-01 rollback aborted: staff_details column not found on %', v_name; end if;
      v_old_t := c_pool_old;
      v_new_t := E'\n                CASE\n                    WHEN ( SELECT ' || c_new_gate || E' AS fn_costing_personnel_view_allowed) THEN p.staff_details\n'
                 || E'                    ELSE NULL::' || v_type || E'\n                END AS staff_details,\n';
    else
      v_old_t := c_old_gate; v_new_t := c_new_gate;
    end if;

    if md5(v_def) = v_fp then
      raise notice 'W506-CONF-01 rollback: view % is already the verified original; nothing to do', v_name;
      continue;
    end if;
    -- must be exactly (verified original + the single change): the new text occurs once and reversing it restores the original
    if (length(v_def) - length(replace(v_def, v_new_t, ''))) <> length(v_new_t)
       or md5(replace(v_def, v_new_t, v_old_t)) <> v_fp then
      raise exception 'W506-CONF-01 rollback aborted: view % is neither the verified original nor the verified patched form (drift)', v_name;
    end if;
    v_new := replace(v_def, v_new_t, v_old_t);
    v_with := case when v_pre.opts is null then '' else ' with (' || trim(both '{}' from v_pre.opts) || ')' end;
    execute format('create or replace view public.%I%s as %s', v_name, v_with, v_new);
    v_rendered := pg_get_viewdef(v_oid);
    if md5(v_rendered) <> v_fp then
      raise exception 'W506-CONF-01 rollback aborted: restored definition of % does not hash to the verified original', v_name;
    end if;
    select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum) as cols,
           c.relowner as own, c.relacl::text as acl, c.reloptions::text as opts, c.relkind as kind
      into v_post from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.oid = v_oid group by c.relowner, c.relacl::text, c.reloptions::text, c.relkind;
    if v_pre.cols is distinct from v_post.cols or v_pre.own is distinct from v_post.own or v_pre.acl is distinct from v_post.acl
       or v_pre.opts is distinct from v_post.opts or v_pre.kind is distinct from v_post.kind then
      raise exception 'W506-CONF-01 rollback aborted: columns/owner/ACL/reloptions of % changed unexpectedly', v_name;
    end if;
  end loop;
end
$rollback$;
