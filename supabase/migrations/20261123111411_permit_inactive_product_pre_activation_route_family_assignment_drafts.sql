-- Applied to live SASV on 2026-11-23 as migration version 20261123111411.
-- Pre-activation route-family onboarding must not require the product to be
-- operationally active merely to create or review an assignment.
-- Preserve ACTIVE requirement for APPROVED and all other states.
-- No permissions, approval references, authorization checks or history policies changed.
--
-- The same trigger function remains the authority; this migration changes
-- exactly one conditional. Fail closed if the pre-existing definition drifts.

do $$
declare
  v_oid oid := 'costing.fn_product_route_family_assignment_guard()'::regprocedure;
  v_def text;
  v_old text := 'if v_product_status is distinct from ''ACTIVE'' then';
  v_new text := 'if v_product_status is distinct from ''ACTIVE'' and new.status not in (''DRAFT'',''IN_REVIEW'') then';
begin
  select pg_get_functiondef(v_oid) into v_def;
  if position(v_old in v_def)=0 then
    if position(v_new in v_def)>0 then
      raise notice 'Already patched';
      return;
    else
      raise exception 'Expected guard clause absent; no change';
    end if;
  end if;
  if length(v_def)-length(replace(v_def,v_old,'')) <> length(v_old) then
    raise exception 'Unexpected duplicate guard occurrence';
  end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;
