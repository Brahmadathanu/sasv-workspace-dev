# PEC final release gate matrix (issue #388, Batch E)

**13 Nov 2026 · No gate is closed by this document. G0–G5 remain 0/6 closed pending owner sign-off.** Legend: PASS = observed and evidenced · FAIL · BLOCKED = cannot proceed without a named external input · NOT TESTED. "Green CI" is never promoted to acceptance.

## 1. Exact heads (re-validated 13 Nov 2026)
| Item | Branch | Head SHA | State |
|---|---|---|---|
| Staging #347 | `integration/pec-erp-staging-20261112` | `b97af2b0c0e230c663870c2ee1466237f10d1c2f` | draft; 8/8 GitHub checks + Netlify success (run IDs below) |
| Core server #317 | `fix/pec-g0-uom-writer-integration-20261112` | `eb39167151b02b80250d855b094db53ccf88a817` | draft, unmerged |
| Paged reads #323 | `feat/pec-g1-paged-read-contracts-20261112` | `359de7a287ca345fc2f27391f2e557911aadd2de` | draft, unmerged |
| Add Line #374 | `server/pec-r2-indent-addline-status-guard-20261112` | `e2522775bb4cd328c8cdce25238c89ff7d45759d` | draft, untouched; PG fixture PASS, integrated-pec FAIL (protected-path guard); `unstable` — **superseded for integration by #392**; wrapper separately installed live, unregistered |
| **#374 integration #392** (new, R13) | `claude/pec-r13-addline-374-integration-20261114` | `f4fcaa5cb62f1c6ea0029e8fbd79fe2fb4a0af70` | draft → staging, mergeable `clean` |
| SAFE prototype #385 | `test/pec-safe-collision-guard-r9-20261113` | `8cb270ec00efc3573fdf4e244b300325fd78eb7e` | draft; superseded in practice by #389 (not merged) |
| **R10 server #389** (new) | `claude/pec-r10-safe-resync-concurrency-20261113` | `fb64b3fe9a150e3d29ffe90450d921f45939d3ad` (R10 + R10b), mergeable `clean` | draft → staging |
| **R12 client #390** (new) | `claude/pec-r12-resync-collision-ux-20261113` | `b579f8cf53ddb6e509db33e37156a97d1e329233`, mergeable `clean` | draft → staging |
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

### 2b. R13 corrections (14 Nov 2026) — exact-head CI
| Evidence | Result |
|---|---|
| #392 @`f4fcaa5c`: integrated-pec [43541041856](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43541041856) (the check that failed on #374) and Add Line PG17 fixture [43541041966](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43541041966) | **PASS** |
| #389 @`fb64b3fe` PG17.12 [43541610952](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43541610952): guarded S/T/P/**SR1–SR8** + controls (legacy and #385 prototype must fail SR2–SR4, T1…) | **PASS** |
| #390 @`b579f8cf` integrated-pec [43541694587](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43541694587) (adds client↔server preview contract test; SKIPPED on that branch alone, mandatory when #389 is present) | **PASS** |
| Protected-path guard: 19/19 unit tests, real-guard mutation smoke 3/3 (fake SQL, SW, edited reviewed migration all rejected); real guard with a wrong head branch rejects the reviewed migration | **PASS** |
| Simulated sequential merge of #392→#389→#390→#391 onto staging `b97af2b0`: 0 conflicts, 0 duplicate migration versions, order `…220000 < 20261113170715 < 20261113172424 < 20261114013211`; local run of integrated suite (paging, VWL, PLM, five-lens 246 controls/0 FAIL, layout, C2 vendor, fast-track, R12 UX, R2/R2b(390 PASS)/R2c(263 PASS), preview contract 3/3, harness guarded 0 fails on PG16) | **PASS** (local; sim head not pushed) |
| Netlify preview provenance for the new PRs | not produced for these PRs; preview host unreachable from sandbox → **BLOCKED** |

## 3. Gates
| Gate | Status | Evidence | Blockers | Owner |
|---|---|---|---|---|
| **G0** baseline / inventory | **NOT TESTED (not signed)** | static 253-control inventory, 43-RPC catalogue, heads re-validated here; 0 open review threads on #347/#317/#323/#374 (API) | owner signature | Owner |
| **G1** contract / policy | **BLOCKED** | R8/R9 fail-closed policy implemented in #389 (23514, pre-write, RESET unchanged); lock order incl. **source-PR reassignment (R10b lock prelude, SR1–SR8)**; preview contract proposed and contract-tested against the client | owner decision on #383 disposition; approval of new preview ACL; DB reviewer must confirm the live `proc_indent_set_source_pr_pec_internal` body matches the modelled shape (body is not in the repo) | Owner / DB reviewer |
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
| `set_source_pr` checked status before locking (stale decision; control SR2 reassigns an approved indent) | #389 R10b | wrapper lock prelude, internal body untouched; DB reviewer confirms live body; service-role bypass documented as residual |
| #374 integrated-pec FAIL: any `supabase/` path is rejected on non-integration branches | #392 | pinned exception (path + head + SHA-256) mutation-tested; global guard unchanged; #374 branch untouched |
| Existing guard tests touched by R12 (RPC allow-list gained preview name; five-lens smoke ticks new RESET acknowledgement) | #390 | additive; no assertion weakened |
| CRLF blobs in 5 historical migration files vs `.gitattributes eol=lf` | repo | cosmetic phantom diffs in some checkouts; files untouched |

## 5. Owner approvals required (none granted by this package)
1. #383 disposition → un-HOLD or permanently exclude `20261112143000`.
2. Per-version approval for each §1 "Candidate" in `PEC_RELEASE_MIGRATION_MATRIX_20261113.md` (never blanket); #2 needs view-parity first.
3. Approval to apply #389 migrations (guard/lock order; preview + its new ACL) to a staging copy, then production, via normal forward push *after* reconciliation.
4. Authorization for authorized operators to run the runbook with existing identities.
5. Ordered merge plan (#374 → staging → #347 → main) and Netlify/Electron release.

## 5b. Safe merge sequence (all into `integration/pec-erp-staging-20261112`, drafts → ready only by owner)
1. **#392** first (its guard exception lets the reviewed Add Line file ride a non-integration head; carries the only SQL already live). Close/retarget **#374** per owner choice — do not merge both (identical migration, duplicate file).
2. **#389** (R10 + R10b migrations; independent PG17 workflow; does not trigger the client suite). 3. **#390** (needs no SQL to run; full preview contract test activates once #389 is in staging). 4. **#391** (docs/scripts; update gate matrix SHAs at merge).
Constraints found: after #389 lands, the protected-path guard will reject its three migrations on `#347 → main` unless an owner-approved follow-up adds them to `INTEGRATION_PROTECTED_PATHS` (path-only, same pattern as the 11 existing); history repair precedes applying R10/R10b (they are new versions); no PR needs to be rebased.

## 6. Exact steps to final PEC release
1. Owner: record #383 disposition. 2. DB reviewer: dry-run #389 on a staging DB copy; verify `require_permission` wording and `v_proc_indent_lines_console_ordered` columns; review Gap 2. 3. Owner: approve R10 apply/ACL; operator applies via reviewed process (not in this package). 4. Owner approves, operator executes per-version `repair` (one at a time, matrix §3 CLI 3.1.0 plan). 5. Merge in §5b order (#392, #389, #390, #391) → staging; re-run CI at the exact head. 6. Operators run runbook A–F with Editor, View-only, no-access, PWA and Windows Electron; fill template (PASS only if performed). 7. Owner signs G0–G5 against that evidence. 8. Merge #347 → main once; deploy; re-run provenance check against production host; owner closes #383/gates.

## 14 November — integrated staging technical readiness and decision boundary

**Current exact integrated head:** `67c4fac8fe5533030a4aeb0b495407a430e8eebf` on draft PR #347 (`integration/pec-erp-staging-20261112`). All four reviewed PRs **#392, #389, #390, #391 merged to staging only**. GitHub workflows **10/10 completed SUCCESS** at this exact head, including protected SQL/SW path mutation checks, integrated PEC browser and contract suite, Add Line PG17 fixture and R10 PG17 concurrency harness. Netlify deploy-preview status SUCCESS. This establishes **staging source/CI readiness**, not signed-in browser or production deployment acceptance.

**Guard correction:** the three R10 migration source files `20261113170715`, `20261113172424`, `20261114013211` are each pinned to the integration branch by exact SHA-256; altered contents, client-branch edits, SW and arbitrary SQL still fail. Exact run evidence in GitHub Actions for head above. Previously failed merged-head run `a4592898` is superseded; it was a new-path allowlist failure rather than a PG17 concurrency failure.

**Live read-only confirmation:** `20261112114000`'s `v_mrp_material_gross_requirement_rm` SQL matches current `pg_get_viewdef` after whitespace normalisation, upgrading version #2 to **bounded definition parity PASS**. Query of `supabase_migrations.schema_migrations` found none of the **eleven legacy + three R10** versions registered (0/14). This is **not** authorization for repair; the underlying production objects/effects may already exist and a blind `db push` would be unsafe.

**Owner decision needed for issue #383:** recommend *historical-baseline exception with no automatic data correction*: record the 3 mismatched mapped stock-item identities and 2 unmapped-but-PR-matching quantities as historical pre-12-Nov exceptions; leave all **approved** indents unchanged; require separate forensic disposition before any remedial data migration. Owner must expressly decide whether this evidence suffices for history-only registration of `20261112143000` or requires a continued HOLD. Until approved, **HOLD remains**.

**Release work remaining:** 
- DB reviewer staging-copy rehearsal of migration and ACL effects, with explicit review of preview `SECURITY DEFINER` and new `authenticated`/`service_role` EXECUTE grant. Catalog verification of existing `require_permission(text,boolean)` and preview-view column names is PASS; no live R10 preview exists yet.
- Owner per-version **11 individual** history dispositions; no blanket repair. Three R10 versions require separate approval for application, never pre-authorised by staging CI.
- Signed-in Editor, View-only, no-access acceptance, installed PWA and packaged Windows Electron remain **NOT TESTED**; no live draft indent exists for positive real writer testing. Follow `PEC_OPERATOR_EXECUTION_RUNBOOK_20261113.md` without inventing role evidence.
- Formal **G0–G5 remain 0/6 closed**; no promotion of #347 to `main`, no production migration or Netlify/Electron release until owner gate signoff.

**Critical-path interpretation:** combined technical integration CI = **PASS (10/10)**; database dry-run and owner approvals = **BLOCKED / NOT TESTED**; genuine role/device acceptance = **NOT TESTED**; production release = **NOT AUTHORIZED**.

## 14 November — owner-bounded #383 historical baseline disposition

The owner instructed **proceed** following the recommendation to accept the five legacy PR→indent mapping anomalies as a **documented historical baseline**, without modifying approved indents. Record this as **BASELINE ACCEPTED / DATA UNCHANGED**, not correction, causality proof, or clearance for any production write.

- Three wrong-stock-item current PR-line maps and two unmapped-but-PR-matching manual indent lines remain as recorded pre-12-Nov historical exceptions.
- Separate forensic and any future remediation work is tracked in [issue #393](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/393), which requires independent approval before modifying approved business records.
- **Issue #383 remains OPEN as the governing history-registration decision; version `20261112143000` remains HOLD.** The owner has not approved registration or history repair for that version, nor for any other version.
- This bounded baseline decision removes the need for repeat exploratory research **before continuing technical/operator preflight**, but does not waive the official G0–G5 or migration-history gates.
- Genuine Editor, View-only, no-access, installed PWA and Windows Electron acceptance remain NOT TESTED. All G0–G5 remain 0/6 formally closed.

Operator next-step order: staging-copy DB rehearsal and ACL checks → per-version written history approvals → authorized role/PWA/Electron runbook → owner sign-off → production merge/deployment only on separate explicit release authorization. No production SQL execution or history change accompanied this disposition.
