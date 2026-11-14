-- WP08 G2-0 registry proposal — UNAPPLIED. ROLLBACK OF STEP B. Provenance-safe and idempotent.
-- Reverts ONLY Electron rows that still hold the canonical route AND the exact updated_at stamp step B wrote (REPOINT
-- RECEIPT). Rows that were canonical before step B, or edited since, are left untouched. Re-running reverts nothing more.
-- Paste the receipt timestamp below; an unreplaced placeholder fails closed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('wp08_g2_0_registry_proposal'));
lock table public.app_module_clients in share row exclusive mode;
select set_config('g2_0.repoint_ts', '<<PASTE_REPOINT_TS_FROM_STEP_B_RECEIPT>>', true);

do $$
declare
  v_ts timestamptz := current_setting('g2_0.repoint_ts', true)::timestamptz;  -- invalid/placeholder -> error -> nothing written
  v_changed int;
begin
  update public.app_module_clients c
  set route_path = v.legacy_route, updated_at = now()
  from (values
    ('manage-products', 'manage-products.html', 'public/shared/manage-products.html'),
    ('manage-rm-bom',   'manage-rm-bom.html',   'public/shared/manage-rm-bom.html'),
    ('manage-sp-bom',   'manage-sp-bom.html',   'public/shared/manage-sp-bom.html'),
    ('pm-templates',    'manage-pm-bom.html',   'public/shared/manage-pm-bom.html')
  ) as v(module_key, legacy_route, new_route)
  where c.module_key = v.module_key and c.client_key = 'electron'
    and c.route_path = v.new_route and c.updated_at = v_ts;
  get diagnostics v_changed = row_count;
  raise notice 'G2-0 rollback of step B reverted % row(s)', v_changed;
end $$;

select module_key, client_key, route_path, updated_at from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates') order by module_key, client_key;

commit;
