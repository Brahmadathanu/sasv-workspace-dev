-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view lab.v_coa_form50_lines set (security_invoker = true);
alter view lab.v_coa_issue_line_detail set (security_invoker = true);
alter view lab.v_coa_print_lines_issued set (security_invoker = true);
alter view lab.v_coa_render_lines set (security_invoker = true);
alter view lab.v_control_register_active set (security_invoker = true);
alter view lab.v_control_sample_sku_option set (security_invoker = true);
alter view lab.v_fg_product_with_group set (security_invoker = true);
alter view lab.v_protocol_subject_map set (security_invoker = true);
alter view lab.v_rm_pm_item_with_group set (security_invoker = true);
alter view lab.v_sample_receipt_fg_batch_picker set (security_invoker = true);
alter view lab.v_sample_receipt_fg_picker set (security_invoker = true);
alter view lab.v_sample_receipt_rm_picker set (security_invoker = true);
alter view lab.v_spec_profile_detail set (security_invoker = true);
alter view lab.v_test_with_default_method set (security_invoker = true);

revoke select on lab.v_coa_form50_lines, lab.v_coa_issue_line_detail, lab.v_coa_print_lines_issued,
  lab.v_coa_render_lines, lab.v_control_register_active, lab.v_control_sample_sku_option,
  lab.v_fg_product_with_group, lab.v_protocol_subject_map, lab.v_rm_pm_item_with_group,
  lab.v_sample_receipt_fg_batch_picker, lab.v_sample_receipt_fg_picker, lab.v_sample_receipt_rm_picker,
  lab.v_spec_profile_detail, lab.v_test_with_default_method from anon;