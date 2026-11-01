-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table lab.analysis_status_history enable row level security;
alter table lab.protocol_category enable row level security;

alter table lab.analysis_reference_exception enable row level security;
alter table lab.analysis_result_calculation_summary enable row level security;
alter table lab.analysis_result_observation enable row level security;
alter table lab.reference_source_master enable row level security;
alter table lab.staff_role_action_map enable row level security;
alter table lab.workflow_action_master enable row level security;