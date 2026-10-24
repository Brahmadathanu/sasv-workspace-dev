-- CI-037 ROLLBACK B — non-destructive post-use rollback. PREPARED, NOT APPLIED.
-- Use once any run holds CI-037 data. Only unhooks the helper from the refresh chain, so future runs stop
-- producing CI-037 rows. Keeps the side table, its data (immutable for designated runs), the helper function,
-- the view columns and comments. Re-running CI-037_profit_fix.sql's hook block re-enables it.
begin;
do $do$
declare v_def text; v_hook constant text := 'perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);'; v_n int;
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_hook, ''))) / length(v_hook);
  if v_n > 1 then raise exception 'CI037_UNHOOK: hook found % times; manual review needed', v_n; end if;
  if v_n = 1 then
    execute regexp_replace(v_def, E'\n[ \t]*' || replace(replace(v_hook, '(', '\('), ')', '\)'), '');
    if pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure) like '%' || v_hook || '%' then
      raise exception 'CI037_UNHOOK: hook still present after removal';
    end if;
    raise notice 'CI037_UNHOOK: removed';
  else
    raise notice 'CI037_UNHOOK: not present; no change';
  end if;
end $do$;
commit;
