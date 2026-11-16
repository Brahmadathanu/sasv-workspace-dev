# WP10 — Final bounded server-first release review receipt (2026-11-16)

## Verified current snapshot
- Draft PR [#444](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/444) remains UNMERGED, on `review/wp10-crossflow-concurrency-20261116`. Independent GitHub reviewer submissions: **0** (latest check).
- Last completed source/security CI [#43854502311](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43854502311) **SUCCESS**. Its job log contains 5/5 dedicated HTML-encoding regression tests, 57/57 isolated Postgres CRUD/security cases, 59/59 mocked Chromium role/browser tests and 30/30 preview browser tests. These are NOT live-account tests.
- Read-only live `public.require_permission(text,boolean)` contract was inspected: authenticated UUID, matching canonical `user_permissions_canonical` row, View=true and Edit=true for write permission. `app_has_permission(text,text)` is a boolean-returning live permission function, matching the new client.
- Live FK dependency audit confirms category→subcategory→group→subgroup cascades; the RPC parent deletion checks explicitly reject children while FK constraints prevent deletion with downstream products/route mappings/scheme policy references.
- Live columns of the four masters and product-group kind are consistent with the staged SQL. Authenticated has SELECT/INSERT/UPDATE/DELETE on the four masters today and SELECT-only on the Product Group Kind lookup.
- **All twelve expected WP10 CRUD functions are ABSENT in live database (12/12), unexpected present=0**, as directly checked read only. SQL preflight retained in `scripts/wp10-g2-safeguards/read-only-four-level-server-install-preflight.sql`.

## Exact server-first action ready for independent review
Install only:
1. `scripts/wp10-g2-safeguards/review-only-parent-classification-governed-rpcs.sql` (9 permission-checked CRUD functions).
2. `scripts/wp10-g2-safeguards/review-only-subgroup-governed-rpcs.sql` (3 permission-checked CRUD functions).

These files have transactional preflights, fixed SQL contracts and EXECUTE grants only for authenticated principals, with canonical Edit checks inside each SECURITY DEFINER function. No client release, revoke, CL15 proposal or flag change belongs to this bounded installation.

## Non-negotiable hold
- **Independent reviewer approval has not been recorded.** Do not describe our source inspection or simulated role fixtures as external approval. Do not apply on an ambiguous general continuation command when exact production SQL review/approval remains required.
- The production rollout must have an exact-head recheck and independent security review; then obtain explicit owner approval to apply the two named SQL files to project `qhmoqtxpeasamtlxaoak`.
- Keep all four existing authenticated direct DML grants during server-first installation, preventing old Electron clients from breaking, at the cost of temporary unmitigated direct-DML exposure.
- Remaining CL15/Route Manager concurrency, old Electron cutover and live-role acceptance remain separate gates. WP10 OPEN.

## Proposed next operator receipt after authorization
Capture before: live function absence, grants, migration history, row counts. Execute two reviewed SQL units under their own transactions. Capture after: exact twelve function signatures, ownership, EXECUTE ACLs, SECURITY DEFINER/search_path, unchanged table privileges, unchanged row counts, rollback file ready. Any failure is a HOLD, not an invitation to relax safeguards.
