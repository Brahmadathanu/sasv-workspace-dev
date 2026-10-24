-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_def text;
  v_old text := 'where p.avg_rate_value is not null and p.avg_rate_value>0 and p.voucher_date<=p_as_of_date';
  v_new text := 'where p.avg_rate_value is not null and p.avg_rate_value>0 and p.canonical_qty_value is not null and p.canonical_qty_value>0 and p.voucher_date<=p_as_of_date';
begin
  select pg_get_functiondef('costing.fn_resolve_material_rates_as_of(bigint[],date)'::regprocedure)
    into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'Expected purchase candidate predicate not found; migration aborted';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;