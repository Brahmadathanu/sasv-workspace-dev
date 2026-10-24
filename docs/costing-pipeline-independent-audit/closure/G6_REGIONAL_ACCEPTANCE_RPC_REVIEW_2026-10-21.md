# G6 safeguard RPC review — 21 October 2026

Read-only production inspection; no migration, run, acceptance, designation, or Google Sheets write.

Confirmed SQL definition of `costing.rpc_accept_regional_marketing_review(bigint,bigint,text,text,text)`: SECURITY DEFINER, fixed `search_path`, calls `public.require_permission('module:costing-control-center',true)` before lookup and mutation; rejects blank reasons, missing queue row, and `is_acceptance_eligible=false`. Insert is protected by a five-field ON CONFLICT key (period, valuation, SKU, region, evidence fingerprint), and replaces acceptance metadata on repeat acceptances.

**Risk to test:** function body lacks an explicit FOR UPDATE row lock (definition textual search and inspection); ON CONFLICT provides uniqueness/idempotent key handling but this is not proof of concurrent source evidence freshness or rejection of an acceptance racing source changes. The eligibility and fingerprint come from a queue snapshot, not a fresh lock on every upstream source. Concurrent/stale-evidence isolated PostgreSQL regression is required before final G6 signoff.

Prior effective table ACL checks: generic authenticated role cannot INSERT into acceptance or designation table, nor SELECT acceptance table; costing schema USAGE is true. Security-definer wrapper's permission check observed, but role-isolated execution and other RPCs remain untested. Tool blocked certain ACL queries last turn; not claimed PASS.

Run136 financial conservation and run integrity PASS; G2 attestation SQL remains HELD/unreleased; G6 formal HOLD. No Sheets publication.
