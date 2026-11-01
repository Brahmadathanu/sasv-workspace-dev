-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table hr.staff enable row level security;
revoke all on table hr.staff from anon;

alter table lab.analysis_record enable row level security;
revoke all on table lab.analysis_record from anon;

alter table lab.outsourced_report enable row level security;
revoke all on table lab.outsourced_report from anon;

alter table lab.staff_role enable row level security;
revoke all on table lab.staff_role from anon;

alter table lab.staff_role_map enable row level security;
revoke all on table lab.staff_role_map from anon;