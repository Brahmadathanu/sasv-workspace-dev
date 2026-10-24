-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke insert, update, delete, truncate, references, trigger on public.v_batch_overrides_effective from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_batch_plan_mapping from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_bmr_batch_sizes from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_bmr_with_map_flag from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_costing_policy_manager_scheme_options from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_costing_pricing_material_costing_diagnostics from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_costing_scheme_master_register from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_etl_recent_detailed from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_last_heartbeat from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_tally_expenses_today from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.v_uom_picker from anon, authenticated;