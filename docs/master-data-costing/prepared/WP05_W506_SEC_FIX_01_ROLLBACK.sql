-- WP05-W506-SEC-FIX-01 ROLLBACK PROCEDURE -- PREPARED, NOT EXECUTED. Do not run without explicit owner approval.
-- Restores costing.rpc_set_staff_costing_classification to its pre-fix body by removing exactly the inserted guard
-- statement, then asserts the recorded pre-fix fingerprint. Rolling back RE-OPENS the missing-authorisation finding
-- (any authenticated user can write staff classifications through the public wrapper); do so only if the guard
-- itself breaks a legitimate workflow and an alternative control is in place.
begin;
do $rollback$
declare
  c_internal_fp constant text := '553d103a5afedda3191c1aa62c33be7c';
  c_insert constant text := E'\n  perform public.require_permission(''module:cost-build-manager'', true);\n';
  v_oid oid; v_n int; v_src text; v_def text; v_restored text; v_new_def text;
begin
  select count(*), min(p.oid) into v_n, v_oid from pg_proc p
   where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_set_staff_costing_classification';
  if v_n <> 1 then raise exception 'rollback aborted: expected one internal function, found %', v_n; end if;
  select prosrc into v_src from pg_proc where oid = v_oid;
  v_def := pg_get_functiondef(v_oid);
  if (length(v_src) - length(replace(v_src, c_insert, ''))) <> length(c_insert) then
    raise exception 'rollback aborted: inserted guard text not found exactly once';
  end if;
  v_restored := replace(v_src, c_insert, '');
  if md5(v_restored) <> c_internal_fp and md5(replace(v_def, v_src, v_restored)) <> c_internal_fp then
    raise exception 'rollback aborted: restored body does not match the recorded pre-fix fingerprint';
  end if;
  v_new_def := replace(v_def, v_src, v_restored);
  execute v_new_def;
  if (select prosrc from pg_proc where oid = v_oid) <> v_restored then
    raise exception 'rollback aborted: installed body differs from the verified restored body';
  end if;
end
$rollback$;
commit;
