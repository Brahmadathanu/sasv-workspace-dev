-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_name text;
  v_def text;
  v_owner text;
  v_names text[] := array[
    'v_costing_pricing_control_dashboard_snapshot',
    'v_costing_pricing_sku_control_status_snapshot',
    'v_costing_pricing_material_action_queue_snapshot',
    'v_costing_pricing_material_action_drilldown_snapshot',
    'v_costing_pricing_review_workbench_summary_snapshot',
    'v_costing_pricing_review_top_action_items_snapshot',
    'v_costing_pricing_review_action_item_drilldown_snapshot',
    'v_costing_pricing_control_integrity_audit_snapshot'
  ];
begin
  foreach v_name in array v_names loop
    select regexp_replace(pg_get_viewdef(c.oid, true), ';\s*$', ''), pg_get_userbyid(c.relowner)
      into v_def, v_owner
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = v_name
      and c.relkind = 'v';

    if v_def is null then
      raise exception 'Required CCC view public.% not found', v_name;
    end if;

    execute format(
      'create or replace view public.%I as
         select q.*
         from (%s) q
         where current_user in (''service_role'', ''postgres'')
            or public.app_has_permission(''module:costing-control-center'', ''view'')',
      v_name,
      v_def
    );

    execute format('alter view public.%I owner to %I', v_name, v_owner);
    execute format('revoke all privileges on public.%I from public', v_name);
    execute format('revoke all privileges on public.%I from anon', v_name);
    execute format('revoke all privileges on public.%I from authenticated', v_name);
    execute format('revoke all privileges on public.%I from service_role', v_name);
    execute format('grant select on public.%I to authenticated', v_name);
    execute format('grant select on public.%I to service_role', v_name);
  end loop;
end
$$;