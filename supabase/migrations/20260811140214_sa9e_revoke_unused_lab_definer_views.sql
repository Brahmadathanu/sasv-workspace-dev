-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke select on table lab.v_analysis_ready_for_coa from authenticated;
revoke select on table lab.v_outsourced_report from authenticated;
revoke select on table lab.v_coa_print_header from authenticated;
revoke select on table lab.v_coa_print_lines from authenticated;
revoke select on table lab.v_coa_render_header from authenticated;
revoke select on table lab.v_coa_full_render from authenticated;
revoke select on table lab.v_control_register_master from authenticated;