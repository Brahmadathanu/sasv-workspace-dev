# G6 G2 attestation deployability check — 21 October 2026

Status: **read-only PASS on definition fingerprints; DEPLOYMENT HOLD remains**.

Authoritative prepared file: `closure/prepared/HELD_G2_route_repetition_evidence_20261020.sql`, deliberately begins with unconditional exception `G2 HOLD: do not deploy incomplete approval safeguards`. It must not be applied as-is. Production was not modified.

Read-only `pg_proc` md5 comparison against five immutable expectations in that file:
- public.rpc_approve_product_route — d4dc989e28e8b096a9abb5300349965a MATCH
- public.rpc_approve_route_family_route — 4f410336d48374f448c07eb29c917038 MATCH
- public.rpc_delete_product_route_override — 53039ad1bf22ab04a69b8bab86e1629b MATCH
- public.rpc_submit_product_route_for_review — 3df5546eae854f033c7711083138f469 MATCH
- public.rpc_submit_route_family_route_for_review — 9e2bcd274203585230bf514200750cba MATCH

Read-only `to_regclass`/`to_regprocedure`:
- `costing.route_repetition_confirmation`: NULL, not installed.
- `costing.fn_g2_require_repetition_confirmation(text,bigint)`: NULL, not installed.
- `public.rpc_confirm_route_repetition(text,bigint,jsonb)`: NULL, not installed.

Therefore the prepared safeguards are compatible with the current *preflight RPC fingerprints*, but not installed. This is not a substitute for syntax, permission, stale-evidence, transaction concurrency, or isolated-postgres negative-case tests. Do not strip unconditional HOLD and deploy on production without approved controlled test and explicit migration authorisation.

Run136 numeric gate PASS (seven pools/17 integrity checks, one retained review); formal G6 and Google Sheets remains HOLD until this and related regressions pass. No fresh run justified.
