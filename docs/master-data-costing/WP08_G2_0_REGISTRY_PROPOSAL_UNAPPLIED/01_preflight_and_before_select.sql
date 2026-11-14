-- WP08 G2-0 registry proposal — UNAPPLIED. READ-ONLY (SELECT / assertion only). Safe to run first.
-- Confirms the four modules exist exactly as the owner-approved contract records them and shows the BEFORE state.

-- 1) Assertion block: raises (changes nothing) if the live registry differs from the contract.
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
    and (module_key, route_path) in (
      ('manage-products', 'manage-products.html'),
      ('manage-rm-bom',   'manage-rm-bom.html'),
      ('manage-sp-bom',   'manage-sp-bom.html'),
      ('pm-templates',    'manage-pm-bom.html'));
  if v_bad <> 4 then
    raise exception 'G2-0 preflight: expected 4 legacy Electron route rows, found %', v_bad;
  end if;
end $$;

-- 2) BEFORE select (record the output in the PR / change ticket).
select module_key, target_key, label, section_key, sort_order, min_nav_mode, client_key, route_path, nav_enabled
from public.v_app_module_registry
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates')
order by module_key, client_key;

select module_key, client_key, route_path, nav_enabled, launch_mode
from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates')
order by module_key, client_key;
