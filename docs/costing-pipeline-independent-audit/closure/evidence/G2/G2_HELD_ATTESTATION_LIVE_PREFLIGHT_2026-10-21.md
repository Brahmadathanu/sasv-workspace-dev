# G2 held attestation — 21 October 2026 preflight verification

Read-only Supabase and GitHub inspection. No deployment, refresh, approval, route change or Sheets.

- Repository implementation rules require prepared SQL under closure/prepared, byte-identical isolated PostgreSQL fixture verification, guarded preflight, and separate live authorisation.
- Canonical staged artifact exists: closure/prepared/HELD_G2_route_repetition_evidence_20261020.sql, deliberately starts with unconditional exception "G2 HOLD: do not deploy incomplete approval safeguards". It would add an immutable route_repetition_confirmation table, approval gate and confirmation RPC, and modify existing route approval/submit/override calls. Earlier static tests were 25/25 PASS, but do not count as PG/permission/concurrency tests.
- Live RPC function md5 values equal all five fingerprints embedded in staged preflight:
  rpc_approve_product_route(bigint,text) d4dc989e28e8b096a9abb5300349965a;
  rpc_approve_route_family_route(bigint,text) 4f410336d48374f448c07eb29c917038;
  rpc_delete_product_route_override(bigint,bigint) 53039ad1bf22ab04a69b8bab86e1629b;
  rpc_submit_product_route_for_review(bigint) 3df5546eae854f033c7711083138f469;
  rpc_submit_route_family_route_for_review(bigint) 9e2bcd274203585230bf514200750cba.
- Live schema has NONE of route_repetition_confirmation, fn_g2_require_repetition_confirmation(text,bigint), rpc_confirm_route_repetition(text,bigint,jsonb). This confirms undeployed, not a failed current safeguard.
- Approved route161 previously verified with 9 steps and 0 nested 2-factor rows, route144 historical 9 and 6. G2 preventive route attestation stays HELD. CI-032 open. Do not strip HOLD and deploy without PostgreSQL integration tests for missing evidence, stale edit, spoofed actor, cross-route confirmation, reviewer permissions, locking and concurrent edits.
- All run131 accounting pool conservation is documented at RUN131_INTERNAL_OVERHEAD_CONSERVATION_2026-10-21.md, previous commit 364e8371742356ca93d2ea65d17abea1abe29d97. Run131 frozen SUCCESS/UNAPPROVED; G6/Sheets blocked.
