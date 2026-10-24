-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke select on table
  public.proc_pr_header,
  public.proc_pr_line,
  public.proc_indent_header,
  public.proc_indent_line,
  public.proc_indent_line_sourcing_decision,
  public.proc_indent_priority_override,
  public.proc_indent_excess_acceptance,
  public.proc_snapshot_refresh_run,
  public.proc_snapshot_refresh_run_stage,
  public.proc_snapshot_refresh_log,
  public.proc_vendor_item_candidate_snapshot,
  public.proc_indent_line_balance_snapshot,
  public.proc_indent_line_priority_snapshot,
  public.proc_vendor_item_candidate_generation,
  public.proc_indent_line_balance_generation,
  public.proc_indent_line_priority_generation,
  public.proc_vendor
from anon;

revoke select on table
  public.v_proc_pr_header,
  public.v_proc_pr_lines_ordered,
  public.v_proc_indent_console,
  public.v_proc_indent_lines_console_ordered,
  public.v_proc_purchase_excess_console,
  public.v_proc_excess_acceptance_audit_console,
  public.v_proc_vendorwise_buylist_material_class_options,
  public.v_proc_vendorwise_buylist_rm_scope_options,
  public.v_proc_indent_line_buylist_base,
  public.v_proc_vendorwise_buylist
from anon;