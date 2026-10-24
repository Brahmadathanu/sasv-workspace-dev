-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke select on table public.v_proc_indent_line_buylist_base from authenticated;
revoke select on table public.v_proc_indent_line_vendor_candidates from authenticated;
revoke select on table public.v_proc_indent_line_vendor_ranked from authenticated;
revoke select on table public.v_proc_indent_lines_console from authenticated;
revoke select on table public.v_proc_indent_sourcing_variance from authenticated;
revoke select on table public.v_proc_procurement_action_queue from authenticated;
revoke select on table public.v_proc_vendorwise_buylist from authenticated;