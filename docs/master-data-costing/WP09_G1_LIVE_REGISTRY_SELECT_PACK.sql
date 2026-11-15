-- WP09 G1 — READ-ONLY live registry capture pack (SELECT only). NOT EXECUTED by the G1 audit session (no Supabase access there).
-- Project: qhmoqtxpeasamtlxaoak. Run in a read-only SQL session (Supabase SQL editor with a read-only role is sufficient).
-- No INSERT/UPDATE/DELETE/DDL, no grants/permissions/users are read (no user_permissions, no role members, no customer data).
-- Export each result set as JSON and assemble { "registry": Q1, "sections": Q2, "modules": Q3 }, then run:
--   node scripts/wp09-g1-launcher-audit/registry-verify.mjs export.json docs/master-data-costing/WP09_G1_EVIDENCE
begin read only;

-- Q1 per-client registry rows (the exact view both launchers read), INCLUDING non-navigable rows
select module_key, target_key, label, description, section_key, section_label, sort_order,
       min_nav_mode, route_path, nav_enabled, client_key
from public.v_app_module_registry
order by client_key, section_key, sort_order, label;

-- Q2 navigation sections (active and inactive)
select * from public.app_nav_sections order by sort_order, key;

-- Q3 module definitions incl. inactive (85 expected; 6 inactive) — column set differs by schema version, so select *
select * from public.app_modules order by module_key;

-- Q4 client assignment rows incl. launch_mode and nav flags
select * from public.app_module_clients order by client_key, module_key;

-- Q5 consistency probes
select client_key, count(*) filter (where nav_enabled) as active_nav, count(*) as total
from public.app_module_clients group by client_key order by client_key;

select client_key, route_path, count(*) as n
from public.app_module_clients where nav_enabled group by client_key, route_path having count(*) > 1;

select section_key, client_key, sort_order, array_agg(module_key order by label) as tied_modules
from public.v_app_module_registry where nav_enabled
group by section_key, client_key, sort_order having count(*) > 1 order by 1, 2, 3;

rollback;
