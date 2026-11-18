# WP10 Stage A reconciliation — read-only verification SQL

`R1_reconciliation_verify_readonly.sql` is the single read-only verification script for `WP10_STAGE_A_MIGRATION_RECONCILIATION_PACKAGE_2026-11-18.md`.
Run it as `postgres` once BEFORE and once AFTER the (separately owner-approved) history registration and compare the two outputs.
It is not a migration, grants nothing, writes nothing, and returns counts and fingerprints only (no identities). Never place it in `supabase/migrations`.
