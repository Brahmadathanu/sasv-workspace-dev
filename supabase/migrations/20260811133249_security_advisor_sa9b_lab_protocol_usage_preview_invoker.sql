-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view lab.v_protocol_usage_preview set (security_invoker = true);
revoke select on lab.v_protocol_usage_preview from anon;