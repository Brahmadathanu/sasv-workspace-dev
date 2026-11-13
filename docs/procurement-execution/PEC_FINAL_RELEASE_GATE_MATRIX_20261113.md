# PEC final release gate matrix (issue #388, Batch E)

**13 Nov 2026 · No gate is closed by this document. G0–G5 remain 0/6 closed pending owner sign-off.** Legend: PASS = observed and evidenced · FAIL · BLOCKED = cannot proceed without a named external input · NOT TESTED. "Green CI" is never promoted to acceptance.

## 1. Exact heads (re-validated 13 Nov 2026)
| Item | Branch | Head SHA | State |
|---|---|---|---|
| Staging #347 | `integration/pec-erp-staging-20261112` | `b97af2b0c0e230c663870c2ee1466237f10d1c2f` | draft; 8/8 GitHub checks + Netlify success (run IDs below) |
| Core server #317 | `fix/pec-g0-uom-writer-integration-20261112` | `eb39167151b02b80250d855b094db53ccf88a817` | draft, unmerged |
| Paged reads #323 | `feat/pec-g1-paged-read-contracts-20261112` | `359de7a287ca345fc2f27391f2e557911aadd2de` | draft, unmerged |
| Add Line #374 | `server/pec-r2-indent-addline-status-guard-20261112` | `e2522775bb4cd328c8cdce25238c89ff7d45759d` | draft; wrapper separately installed live, unregistered |
| SAFE prototype #385 | `test/pec-safe-collision-guard-r9-20261113` | `8cb270ec00efc3573fdf4e244b300325fd78eb7e` | draft; superseded in practice by #389 (not merged) |
| **R10 server #389** (new) | `claude/pec-r10-safe-resync-concurrency-20261113` | `ac01d4211541314bb152eccd5c0f4f7383337a62` | draft → staging |
| **R12 client #390** (new) | `claude/pec-r12-resync-collision-ux-20261113` | `949ee6caa1a121d219b227d54c17adbb7ed241db` | draft → staging |
| **R11 evidence #391** (new) | `claude/pec-r11-operator-release-evidence-20261113` | code head `a15e22e88e2575023f1677a709a01f778d4d6601` (+ docs-only follow-up commits) | draft → staging |
`main` = `4a857c02ee8c59f1f9bc09754fd7f89104b39971`.

## 2. CI / test evidence
| Evidence | Result |
|---|---|
| #347 @`b97af2b0` GitHub Actions: integrated-pec `43468921709`, FG-BIT/ESLint `43468921334`, offline-regression `43468921412`, contract `43468921269`, focused-confidentiality `43468921401`, mock-sw `43468922023`, verify `43468921578` + `43468921266`; Netlify header/redirect rules success (Pages-changed neutral) | **PASS** (CI only) |
| #389 PG17 (postgres:17.12) guarded source S1–S9, T1–T7, P1–P5 + negative controls (legacy, #385 prototype must fail) — run `43477350470` | **PASS** |
| #389 local PG16.15, 4 consecutive guarded runs, 0 failures; controls: legacy fails S1,S2,S3a,S3c,T1–T5,T7; prototype fails T1–T5,T7 | PASS (local) |
| #390 integrated-pec run `43477268064` (includes R12 UX smoke, five-lens, static, layout, R2/R2c suites) | **PASS** (success; `verify` `43477268311` also success) |
| #391 integrated-pec run `43477615962` (code head `a15e22e8`; includes operator contract test, provenance `--local`) | **PASS** (success) |
| Local (this session): R12 UX smoke, five-lens fast-track, c1 static/layout, resync-mode contract, c2 vendor, paging, r2/r2b/r2c, protected-path guard + mutation, PWA freshness (13 pass), VWL reliability, operator contract (15 pass incl. negative-RPC smoke) | PASS |
| Mutation sensitivity: harness controls (#389), UX guard/ack removal (#390), probe-arg drift (#391) each shown to fail | PASS |

## 3. Gates
| Gate | Status | Evidence | Blockers | Owner |
|---|---|---|---|---|
| **G0** baseline / inventory | **NOT TESTED (not signed)** | static 253-control inventory, 43-RPC catalogue, heads re-validated here; 0 open review threads on #347/#317/#323/#374 (API) | owner signature | Owner |
| **G1** contract / policy | **BLOCKED** | R8/R9 fail-closed policy implemented in #389 (23514, pre-write, RESET unchanged); lock order + preview contract proposed | owner decision on #383 disposition; approval of new preview ACL; Gap 2 review (`proc_indent_set_source_pr` lock order) | Owner / DB reviewer |
| **G2** server correction | **BLOCKED** | 10 migration files byte-identical on staging; effects PASS-bounded for 8 versions, #2 PARTIAL, #5 HOLD (matrix) | 0/11 registered; per-version owner approval; `20261112143000` HOLD (#383); R10 not applied; #374 file not on staging | Owner |
| **G3** client modernisation | **PASS (technical) – not formally closed** | #347 green CI at head; owner R2c visual PASS (recorded earlier); R12 draft with fixture tests and 375/1280 screenshots | owner formal close; R12 depends on server preview (degrades gracefully if absent) | Owner |
| **G4** independent acceptance | **NOT TESTED** (roles) / **BLOCKED** (hosted provenance from sandbox) | harness + contract + provenance script + runbook ready; no authorized operator session exists in this environment | Editor / View-only / no-access operator runs; PWA freshness; Windows packaged Electron; owner phone confirmation | Operator + Owner |
| **G5** owner final release | **NOT AUTHORIZED** | — | all above; ordered merge approval; Netlify/Electron release decision | Owner |

Role/row detail (all human): Editor NOT TESTED · View-only NOT TESTED · No-access NOT TESTED · direct writer denial NOT TESTED · Add Line positive draft NOT TESTED (no draft exists; 45/45 approved) · installed PWA NOT TESTED · Windows Electron NOT TESTED · production-host provenance: host answered but differs from staging (not promoted, as expected); preview host unreachable from sandbox → BLOCKED.

## 4. Findings → owner map
| Finding | Where | Disposition / owner |
|---|---|---|
| #383: 3 stock-item identity mismatches in 1,023 maps + 2 unmapped lines (historical, pre-12-Nov) | issue #383 | untouched; owner disposition required before `143000` registration |
| SAFE overwrote colliding unmapped line (R7 boundary) | #385 → #389 | fixed in source (draft, unapplied) – Owner approval to apply |
| Unlocked resync TOCTOU / lost manual edit (demonstrated: control T1) | #389 | fixed in source; Gap 1 (service-role new-line insert) and Gap 2 documented |
| Legacy PR writers vs resync deadlock under interleaving (control T7) | #389 | fixed by PR-header-first order; keep T7 in CI |
| `require_permission` not defined in repo; preview item-name view columns unverified vs live | #389/#391 | DB reviewer verifies on a staging copy |
| New preview RPC ACL (`authenticated`, `service_role`) | #389 | separate owner approval; not covered by #374 approval |
| Existing guard tests touched by R12 (RPC allow-list gained preview name; five-lens smoke ticks new RESET acknowledgement) | #390 | additive; no assertion weakened |
| CRLF blobs in 5 historical migration files vs `.gitattributes eol=lf` | repo | cosmetic phantom diffs in some checkouts; files untouched |

## 5. Owner approvals required (none granted by this package)
1. #383 disposition → un-HOLD or permanently exclude `20261112143000`.
2. Per-version approval for each §1 "Candidate" in `PEC_RELEASE_MIGRATION_MATRIX_20261113.md` (never blanket); #2 needs view-parity first.
3. Approval to apply #389 migrations (guard/lock order; preview + its new ACL) to a staging copy, then production, via normal forward push *after* reconciliation.
4. Authorization for authorized operators to run the runbook with existing identities.
5. Ordered merge plan (#374 → staging → #347 → main) and Netlify/Electron release.

## 6. Exact steps to final PEC release
1. Owner: record #383 disposition. 2. DB reviewer: dry-run #389 on a staging DB copy; verify `require_permission` wording and `v_proc_indent_lines_console_ordered` columns; review Gap 2. 3. Owner: approve R10 apply/ACL; operator applies via reviewed process (not in this package). 4. Owner approves, operator executes per-version `repair` (one at a time, matrix §3 CLI 3.1.0 plan). 5. Merge #374 → staging; merge #389, #390, #391 → staging; re-run CI at the exact head. 6. Operators run runbook A–F with Editor, View-only, no-access, PWA and Windows Electron; fill template (PASS only if performed). 7. Owner signs G0–G5 against that evidence. 8. Merge #347 → main once; deploy; re-run provenance check against production host; owner closes #383/gates.
