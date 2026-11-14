-- WP08 G2-0 registry proposal — UNAPPLIED. READ-ONLY: SELECT / assertion only, writes nothing.
-- Run first. It asserts the contract, then REPORTS the per-module state that steps A and B will enforce, using the SAME
-- predicates (a module is ABSENT / IDENTICAL / CONFLICT on the PWA client; an Electron row is LEGACY / CANONICAL / OTHER).

-- 1) Contract assertion (raises; changes nothing): the four module/target pairs and four Electron rows must exist.
do $$
declare v_bad int;
begin
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
    raise exception 'G2-0 preflight: % expected module/target pair(s) missing from public.app_modules', v_bad;
  end if;

  select count(*) into v_bad
  from public.app_module_clients
  where client_key = 'electron'
    and module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates');
  if v_bad <> 4 then
    raise exception 'G2-0 preflight: expected 4 Electron rows, found %', v_bad;
  end if;
end $$;

-- 2) Per-module state report. Step A requires every pwa_state = ABSENT. Step B requires every electron_state = LEGACY
--    (or, for a no-op re-run, every one CANONICAL). Anything else is a partial/conflicting state: fix by hand, never by script.
select v.module_key,
       case when p.module_key is null then 'ABSENT'
            when p.route_path = v.pwa_route then 'IDENTICAL' else 'CONFLICT' end as pwa_state,
       p.route_path as pwa_route_now,
       case when e.route_path = v.legacy_route then 'LEGACY'
            when e.route_path = v.pwa_route then 'CANONICAL' else 'OTHER' end as electron_state,
       e.route_path as electron_route_now
from (values
  ('manage-products', 'manage-products.html', 'public/shared/manage-products.html'),
  ('manage-rm-bom',   'manage-rm-bom.html',   'public/shared/manage-rm-bom.html'),
  ('manage-sp-bom',   'manage-sp-bom.html',   'public/shared/manage-sp-bom.html'),
  ('pm-templates',    'manage-pm-bom.html',   'public/shared/manage-pm-bom.html')
) as v(module_key, legacy_route, pwa_route)
left join public.app_module_clients p on p.module_key = v.module_key and p.client_key = 'pwa'
left join public.app_module_clients e on e.module_key = v.module_key and e.client_key = 'electron'
order by v.module_key;

-- 3) BEFORE select (record the output in the change ticket).
select module_key, target_key, label, section_key, sort_order, min_nav_mode, client_key, route_path, nav_enabled
from public.v_app_module_registry
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates')
order by module_key, client_key;

select module_key, client_key, route_path, nav_enabled, launch_mode, updated_at
from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates')
order by module_key, client_key;
