-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke select on public.v_proc_pr_header from authenticated;
revoke select on public.v_proc_pr_lines_ordered from authenticated;
revoke select on public.v_proc_indent_console from authenticated;
revoke select on public.v_proc_indent_lines_console_ordered from authenticated;
revoke select on public.v_proc_purchase_excess_console from authenticated;
revoke select on public.v_proc_excess_acceptance_audit_console from authenticated;
revoke select on public.v_proc_vendorwise_buylist_material_class_options from authenticated;
revoke select on public.v_proc_vendorwise_buylist_rm_scope_options from authenticated;
revoke select on public.proc_indent_line_sourcing_decision from authenticated;
revoke select on public.proc_vendor from authenticated;