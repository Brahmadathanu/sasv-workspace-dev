-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old_count integer;
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'costing'
    and p.proname = 'fn_resolve_material_rates_as_of'
    and pg_get_function_identity_arguments(p.oid) = 'p_stock_item_ids bigint[], p_as_of_date date';

  if v_oid is null then
    raise exception 'Target function costing.fn_resolve_material_rates_as_of(bigint[],date) not found';
  end if;

  v_def := pg_get_functiondef(v_oid);
  v_old_count := (length(v_def) - length(replace(v_def, 'qty_value<>0', ''))) / length('qty_value<>0')
               + (length(v_def) - length(replace(v_def, 'qty_units<>0', ''))) / length('qty_units<>0');

  if v_old_count <> 3 then
    raise exception 'Expected exactly 3 non-zero stock quantity predicates, found %', v_old_count;
  end if;

  v_new := replace(v_def, 'qty_value<>0', 'qty_value>0');
  v_new := replace(v_new, 'qty_units<>0', 'qty_units>0');

  execute v_new;
end
$migration$;