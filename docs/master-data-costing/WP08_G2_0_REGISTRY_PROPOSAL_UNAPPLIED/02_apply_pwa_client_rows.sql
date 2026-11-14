-- WP08 G2-0 registry proposal — UNAPPLIED. STEP A: create the four PWA client rows. FAILS CLOSED.
-- DO NOT RUN until (1) the PR is merged and the PWA is deployed, (2) scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs
-- verify <origin> has printed a GATE TOKEN for the DEPLOYED bytes, and (3) the owner gives the separate production approval.
--
-- Behaviour: all-or-nothing. If ANY of the four PWA rows already exists (identical or not) the script raises and writes
-- NOTHING: an existing registration is never overwritten and never claimed. There is no upsert clause. A row
-- created here is stamped with this transaction's now() as updated_at; that value (APPLY RECEIPT) is the only thing
-- step A's rollback will accept, so rollback can delete only rows this script created.
-- Scope: public.app_module_clients only. No permission, grant, RLS, app_modules or label/section/sort/min_nav_mode change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('wp08_g2_0_registry_proposal'));
lock table public.app_module_clients in share row exclusive mode;

-- Deployment gate: paste the token printed by deploy-gate.mjs verify (it only prints after the DEPLOYED sw.js, pages,
-- scripts and styles match the reviewed bytes). The expected value below is regenerated from the reviewed files and
-- checked by the repository tests; a token for any other bytes is rejected.
select set_config('g2_0.deploy_gate_token', '<<PASTE_GATE_TOKEN_FROM_deploy-gate.mjs_verify>>', true);

do $$
declare
  v_expected constant text := 'g2-0-2cb6da61e0f896616188681ef0b7b13a';
  v_bad int;
  v_existing int;
  v_inserted int;
begin
  if coalesce(current_setting('g2_0.deploy_gate_token', true), '') <> v_expected then
    raise exception 'G2-0 step A refused: deployment gate token missing or does not match the reviewed bytes';
  end if;

  select count(*) into v_bad
  from (values
    ('manage-products', 'module:manage-products'),
    ('manage-rm-bom',   'module:manage-rm-bom'),
    ('manage-sp-bom',   'module:manage-sp-bom'),
    ('pm-templates',    'module:pm-templates')
  ) as expected(module_key, target_key)
  left join public.app_modules m on m.module_key = expected.module_key and m.target_key = expected.target_key
  where m.module_key is null;
  if v_bad <> 0 then
    raise exception 'G2-0 step A refused: % expected module/target pair(s) missing from public.app_modules', v_bad;
  end if;

  select count(*) into v_existing
  from public.app_module_clients
  where client_key = 'pwa'
    and module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates');
  if v_existing <> 0 then
    raise exception 'G2-0 step A refused (fail closed): % PWA registration(s) already exist; nothing was written', v_existing;
  end if;

  insert into public.app_module_clients (module_key, client_key, route_path, nav_enabled, launch_mode, updated_at)
  select e.module_key, 'pwa', v.pwa_route, e.nav_enabled, e.launch_mode, now()
  from public.app_module_clients e
  join (values
    ('manage-products', 'public/shared/manage-products.html'),
    ('manage-rm-bom',   'public/shared/manage-rm-bom.html'),
    ('manage-sp-bom',   'public/shared/manage-sp-bom.html'),
    ('pm-templates',    'public/shared/manage-pm-bom.html')   -- registry key stays pm-templates (module:pm-templates)
  ) as v(module_key, pwa_route) on v.module_key = e.module_key
  where e.client_key = 'electron';
  get diagnostics v_inserted = row_count;
  if v_inserted <> 4 then
    raise exception 'G2-0 step A refused: expected to create 4 PWA rows from 4 Electron rows, would create %', v_inserted;
  end if;
end $$;

-- APPLY RECEIPT: keep this value; step A's rollback needs it.
select 'APPLY_RECEIPT' as receipt, now() as apply_ts;

select module_key, client_key, route_path, nav_enabled, launch_mode, updated_at
from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates')
order by module_key, client_key;

commit;
