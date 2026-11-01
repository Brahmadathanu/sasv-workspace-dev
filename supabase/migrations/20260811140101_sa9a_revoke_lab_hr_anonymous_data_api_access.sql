-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke select on table lab.v_analysis_header from anon;
revoke select on table lab.v_analysis_pending_scrutiny from anon;
revoke select on table lab.v_analysis_ready_for_coa from anon;
revoke select on table lab.v_analysis_result_entry from anon;
revoke select on table lab.v_coa_full_render from anon;
revoke select on table lab.v_coa_print_header from anon;
revoke select on table lab.v_coa_print_lines from anon;
revoke select on table lab.v_coa_render_header from anon;
revoke select on table lab.v_outsourced_report from anon;
revoke select on table lab.v_spec_change_request_review_counts from anon;
revoke select on table lab.v_spec_change_request_review_queue from anon;

revoke all privileges on table lab.analysis_result from anon;
revoke all privileges on table lab.analysis_status_history from anon;
revoke all privileges on table lab.protocol_category from anon;