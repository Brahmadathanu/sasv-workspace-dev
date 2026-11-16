# WP10 — Final bounded server-first release review receipt (2026-11-16)

## Verified current snapshot
- Review PR [#444](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/444) remains UNMERGED, on `review/wp10-crossflow-concurrency-20261116`. Independent GitHub reviewer submissions: **0** (latest check).
- Latest fully completed source/security CI [#43862099581](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43862099581) **SUCCESS**. Its job log contains 5/5 HTML-encoding regression tests, 77/77 isolated Postgres CRUD/security cases, 5/5 actual two-session concurrency checks, 59/59 mocked Chromium role/browser tests and 30/30 preview browser tests. These are NOT live-account tests.
- Read-only live `public.require_permission(text,boolean)` contract was inspected: authenticated UUID, matching canonical `user_permissions_canonical` row, View=true and Edit=true for write permission. `app_has_permission(text,text)` is a boolean-returning live permission function, matching the new client.
- Live FK dependency audit confirms category→subcategory→group→subgroup cascades; the RPC parent deletion checks explicitly reject children while FK constraints prevent deletion with downstream products/route mappings/scheme policy references.
- Live columns of the four masters and product-group kind are consistent with the staged SQL. Authenticated has SELECT/INSERT/UPDATE/DELETE on the four masters today and SELECT-only on the Product Group Kind lookup.
- **All twelve expected WP10 CRUD functions are ABSENT in live database (12/12), unexpected present=0**, as directly checked read only. SQL preflight retained in `scripts/wp10-g2-safeguards/read-only-four-level-server-install-preflight.sql`.

## Independent review B1–B4 remediation (Claude review, 2026-11-16)

Review verdict was BLOCKED on evidence/procedure, not an identified functional defect in the two SQL files. This receipt records the exact artifacts and remediation; the reviewer has not yet independently re-approved the changes.

### B1 — immutable approved artifact candidate
Frozen candidate **Git commit**: `7088f247665b8896c6b303e82765b9ad73cfa0f6`. The four SQL files below are unchanged since that commit (verify against the final PR head before actual approval). The SHA-256 values were calculated from their verbatim UTF-8 repository content, using PostgreSQL's `sha256(convert_to(...,'UTF8'))`, and independently match the reviewer's reported prefixes.

| Exact file under `scripts/wp10-g2-safeguards/` | Full SHA-256 |
|---|---|
| `review-only-parent-classification-governed-rpcs.sql` | `7463fb0d8bb54fc4eb30629715aa0052661de50dfd5c1d663a0abf66c35ae51f` |
| `review-only-subgroup-governed-rpcs.sql` | `1d0f1267f9dcea5dcfb99f39bad32d8e2af16fceb49d0c3aee8f5cc8a5f814cf` |
| `review-only-parent-classification-governed-rpcs-rollback.sql` | `d946bb15b21f373eb0da3da3904a6570bad1dfafb70ef7443a1f603a9f0342bd` |
| `review-only-subgroup-governed-rpcs-rollback.sql` | `abf7e2830f4fe32a4b0579cda66a35ce23af0e43bfc8144d20853a2d0b273a98` |

Manual copy/paste risk: obtain each complete SQL file from the exact commit (not an unpinned branch view), verify its checksum locally before pasting; avoid formatting, trimming or modifying whitespace. The GitHub **blob SHA is not a SHA-256 checksum**. Never run the two rollback files automatically merely because an installation step fails.

### B2–B3 — repeatable single-result Supabase Dashboard preflight
`scripts/wp10-g2-safeguards/read-only-four-level-server-install-preflight.sql` now checks expected columns, uncovered NOT NULL columns without defaults, inbound FK delete rules (only three expected guarded hierarchy cascades), canonical Editor assignments, 12 signature collisions, live permissions, lookup/dependency columns, and permission-function signatures. It emits **exactly one final row** with `wp10_preflight`, `passed_checks`, `failed_checks` and `check_details`. Tested SELECT-only against live Supabase on 2026-11-16: **PASS, 10 passed / 0 failed, 12 absent, 0 present**. Re-run immediately before the authorized installation, stop on BLOCKED. The three hierarchy CASCADE FKs are admitted only on their precisely named parent-child relationships, where guarded RPCs refuse deletion when children exist.

### B4 — strengthened isolated checks
`classification-crud-pg.test.mjs` now models cross-level Category-only edit rights, matches the live permission-guard error and search-path semantics more closely, checks each of the 12 catalog function signatures for `SECURITY DEFINER`, exact `search_path`, `authenticated` EXECUTE, and `anon` EXECUTE denial. Additional actual live FK classes are represented and exercised; the single-result preflight is also run against a disposable fixture. `classification-delete-concurrency.test.mjs` models concurrent parent deletion against child insertion in both orders using real isolated PostgreSQL sessions. **Automated evidence PASS:** [GitHub Actions run #43862099581](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43862099581), rerun after a GitHub fetch-main HTTP 403 infrastructure failure, completed SUCCESS for the source/test head `ccf878ad1a829e1d03ee354a6136f9ebcf62250f`. Logs: **77/77 isolated four-level PostgreSQL checks**, **5/5 real two-session parent-delete/child-create concurrency checks**, **59/59 mocked Chromium**, **30/30 browser preview**, and **5/5 HTML-encoding tests**. B4's automated evidence gap is therefore addressed, but **independent reviewer re-assessment remains required**. Documentation commits after the test head have not altered these SQL/test files.

### Partial install failure / safe recovery
Each SQL file has its **own** BEGIN/COMMIT; if parent installs successfully but subgroup fails, nine functions legitimately remain. Stop; capture error and catalog state. Do **not** blindly rerun the parent SQL; its collision preflight will fail by design. On separately authorized rollback, remove the nine functions using only the pinned parent rollback if no live client depends on them, or resolve the subgroup error and continue using the same reviewed pinned file. The opposite rollback order is subgroup first, then parent. Do not drop these functions once compatible clients consume them without a dependency and client cutover review.

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
