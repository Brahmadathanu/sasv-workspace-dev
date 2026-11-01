-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  r record;
  ddl text;
begin
  for r in
    select p.oid,n.nspname as schema_name,p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f'
      and (n.nspname,p.proname) in (
        ('lab','fn_create_current_active_spec_snapshot_for_analysis'),
        ('lab','fn_create_effective_spec_snapshot_for_analysis'),
        ('lab','fn_get_analysis_spec_locks'),
        ('lab','fn_rebuild_base_spec_from_protocol'),
        ('lab','fn_resolve_current_active_spec_lines'),
        ('lab','fn_resolve_effective_spec_lines'),
        ('lab','fn_resolve_pm_subcategory_for_item'),
        ('lab','fn_save_protocol_pm_subcategory_mapping'),
        ('lab','fn_save_spec_override_direct'),
        ('lab','fn_set_active_pm_protocol_for_subcategory_family'),
        ('lab','fn_set_active_pm_subcategory_spec_profile_family'),
        ('lab','fn_submit_analysis_reference_proposal'),
        ('lab','fn_supersede_spec_override'),
        ('public','fn_assert_is_plm_item'),
        ('public','validate_plm_bom_line')
      )
  loop
    ddl := pg_get_functiondef(r.oid);
    if position('''PLM''' in ddl) = 0 then
      raise exception 'Expected PLM literal not found in %.%', r.schema_name, r.proname;
    end if;
    execute replace(ddl, '''PLM''', '''PM''');
  end loop;

  for r in
    select n.nspname as schema_name,c.relname as view_name,pg_get_viewdef(c.oid,true) as def
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='v'
      and (n.nspname,c.relname) in (
        ('lab','v_pending_spec_change_requests'),
        ('lab','v_protocol_usage_preview'),
        ('lab','v_spec_change_request_history'),
        ('lab','v_spec_override_register'),
        ('public','v_item_consumption_rm_pm_monthly'),
        ('public','v_pm_reservation_priority_current_month')
      )
  loop
    if position('''PLM''' in r.def) = 0 then
      raise exception 'Expected PLM literal not found in %.%', r.schema_name, r.view_name;
    end if;
    execute format('create or replace view %I.%I as %s',r.schema_name,r.view_name,replace(r.def,'''PLM''','''PM'''));
  end loop;

  alter view lab.v_protocol_usage_preview set (security_invoker=true);
  alter view public.v_item_consumption_rm_pm_monthly set (security_invoker=true);
  alter view public.v_pm_reservation_priority_current_month set (security_invoker=true);
end $$;