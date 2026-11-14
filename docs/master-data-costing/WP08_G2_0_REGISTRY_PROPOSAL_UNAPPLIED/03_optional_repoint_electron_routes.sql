-- WP08 G2-0 registry proposal — UNAPPLIED. STEP B (OPTIONAL, LAST): repoint Electron rows to the canonical path. FAILS CLOSED.
-- NOT REQUIRED for correctness: the root manage-*.html redirect stubs keep the legacy Electron routes working.
-- DO NOT RUN until every installed Electron build contains public/shared/manage-*.html (an older build would 404).
--
-- All-or-nothing: all four Electron rows must be LEGACY (manage-*.html) -> they are repointed and stamped with now().
-- If all four are already CANONICAL the script is a no-op (it reports and changes nothing). Any mixed/other state
-- raises and writes nothing. Rollback accepts only the stamp this script wrote, so it never reverts a route that was
-- already canonical before this script ran.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('wp08_g2_0_registry_proposal'));
lock table public.app_module_clients in share row exclusive mode;

do $$
declare
  v_legacy int;
  v_canonical int;
  v_total int;
  v_changed int;
begin
  select count(*) filter (where c.route_path = v.legacy_route),
         count(*) filter (where c.route_path = v.new_route),
         count(*)
    into v_legacy, v_canonical, v_total
  from (values
    ('manage-products', 'manage-products.html', 'public/shared/manage-products.html'),
    ('manage-rm-bom',   'manage-rm-bom.html',   'public/shared/manage-rm-bom.html'),
    ('manage-sp-bom',   'manage-sp-bom.html',   'public/shared/manage-sp-bom.html'),
    ('pm-templates',    'manage-pm-bom.html',   'public/shared/manage-pm-bom.html')
  ) as v(module_key, legacy_route, new_route)
  join public.app_module_clients c on c.module_key = v.module_key and c.client_key = 'electron';

  if v_total <> 4 then
    raise exception 'G2-0 step B refused: expected 4 Electron rows, found %', v_total;
  end if;
  if v_canonical = 4 then
    raise notice 'G2-0 step B: all four Electron rows are already canonical; nothing changed';
    return;
  end if;
  if v_legacy <> 4 then
    raise exception 'G2-0 step B refused (fail closed): mixed or unexpected Electron routes (legacy=%, canonical=%); nothing was written', v_legacy, v_canonical;
  end if;

  update public.app_module_clients c
  set route_path = v.new_route, updated_at = now()
  from (values
    ('manage-products', 'manage-products.html', 'public/shared/manage-products.html'),
    ('manage-rm-bom',   'manage-rm-bom.html',   'public/shared/manage-rm-bom.html'),
    ('manage-sp-bom',   'manage-sp-bom.html',   'public/shared/manage-sp-bom.html'),
    ('pm-templates',    'manage-pm-bom.html',   'public/shared/manage-pm-bom.html')
  ) as v(module_key, legacy_route, new_route)
  where c.module_key = v.module_key and c.client_key = 'electron' and c.route_path = v.legacy_route;
  get diagnostics v_changed = row_count;
  if v_changed <> 4 then
    raise exception 'G2-0 step B refused: expected to repoint 4 rows, would repoint %', v_changed;
  end if;
end $$;

select 'REPOINT_RECEIPT' as receipt, now() as repoint_ts;

select module_key, client_key, route_path, updated_at from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates') order by module_key, client_key;

commit;
