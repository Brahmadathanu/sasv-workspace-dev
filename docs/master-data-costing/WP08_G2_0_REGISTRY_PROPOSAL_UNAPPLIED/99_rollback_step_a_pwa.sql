-- WP08 G2-0 registry proposal — UNAPPLIED. ROLLBACK OF STEP A. Provenance-safe and idempotent.
-- Deletes ONLY PWA rows with the exact module key, exact canonical route AND the exact updated_at stamp step A wrote
-- (APPLY RECEIPT). A registration that existed before step A can never match (step A refuses to run if one exists), and a
-- row edited since is left alone. Re-running deletes nothing more. Paste the receipt timestamp; a placeholder fails closed.
-- Run 98 (step B rollback) first if step B was applied.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('wp08_g2_0_registry_proposal'));
lock table public.app_module_clients in share row exclusive mode;
select set_config('g2_0.apply_ts', '<<PASTE_APPLY_TS_FROM_STEP_A_RECEIPT>>', true);

do $$
declare
  v_ts timestamptz := current_setting('g2_0.apply_ts', true)::timestamptz;  -- invalid/placeholder -> error -> nothing deleted
  v_deleted int;
begin
  delete from public.app_module_clients c
  using (values
    ('manage-products', 'public/shared/manage-products.html'),
    ('manage-rm-bom',   'public/shared/manage-rm-bom.html'),
    ('manage-sp-bom',   'public/shared/manage-sp-bom.html'),
    ('pm-templates',    'public/shared/manage-pm-bom.html')
  ) as v(module_key, pwa_route)
  where c.module_key = v.module_key and c.client_key = 'pwa'
    and c.route_path = v.pwa_route and c.updated_at = v_ts;
  get diagnostics v_deleted = row_count;
  raise notice 'G2-0 rollback of step A deleted % row(s)', v_deleted;
end $$;

select module_key, client_key, route_path, nav_enabled, launch_mode, updated_at from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates') order by module_key, client_key;

commit;
