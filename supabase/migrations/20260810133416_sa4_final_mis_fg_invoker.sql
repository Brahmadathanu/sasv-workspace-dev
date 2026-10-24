-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_mis_fg_inventory_position set (security_invoker = true);
alter view public.v_mis_finished_goods_tab_summary set (security_invoker = true);