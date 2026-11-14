# PEC R-2 approval-race correction — deployment decision packet (issue #412)

Date: 14 November 2026 | Draft PR #414 (stacked on #411) | Evidence head `1055c89007c1e650b3c2210cebd24673d495dcc4` | **PROPOSAL ONLY: nothing applied to production, no live record touched, no merge to `main`.**

## 1. Recommendation
**Approve the exact migration for a separate production step, with the gate in section 6.** It is a one-token change, preserves every existing rule and ACL, closes the demonstrated race, and passed all deterministic PG17 tests with the byte-identical live function body. R-2 stays a PEC final-promotion blocker until the migration is approved, applied, verified and registered, or until the owner explicitly accepts the risk (not presumed).

## 2. The defect (reproduced, not inferred)
Live function `proc_indent_set_status_pec_internal(bigint,text,date)` (md5 of body `052dfcbd06e19746213aaada2b588036`, read from the live catalog 14 Nov 2026) reads the indent status and `count(*)` of lines **without locking the header**, then updates the header. R10's resync takes the header `FOR UPDATE` first and, when the source PR's final lines are all zero, deletes every mapped line. Interleaving: approval counts 3 lines, resync empties the draft and commits, approval's UPDATE then runs.
- **R2a (CONFIRMED, live body):** indent ends `approved` with **0 lines**.
- **R2d (CONFIRMED, live body):** two concurrent approvals of the same draft both succeed; the second UPDATE silently repeats the transition.
Impact: an approved procurement indent that can never be fulfilled, created without any error. It needs a draft indent whose source PR collapses to zero final lines at the moment of approval: rare, but silent.

## 3. The correction (exact file)
`supabase/migrations/20261114135500_pec_indent_set_status_header_lock.sql`, git blob / SHA-256 (LF-normalised) `1dd812008e520db3a1c1ee2a3f62fe56f76350b23de417423831e6ce67d14823`.
- `CREATE OR REPLACE FUNCTION public.proc_indent_set_status_pec_internal(...)` with **one added token**: the first header read is `... where indent_id = p_indent_id for update;`. Status check, line-count decision and UPDATE now happen under the header row lock.
- Everything else is byte-identical to the live body: signature and defaults, `SECURITY DEFINER`, `SET search_path TO 'public'`, every error code and message, the UPDATE statements (so the lifecycle-audit trigger sees the same changes), and both `proc_request_snapshot_refresh` calls.
- No `GRANT` / `REVOKE`; `CREATE OR REPLACE` retains the ACL (CI also fails the build if a grant appears in the file). The public wrapper `proc_indent_set_status` (permission gate `require_permission(...,'t')`) is **not** touched.
- Rollback: a forward migration re-issuing the previous body (remove ` for update`); no data rollback exists because the change writes no data.

## 4. Evidence (CI, disposable `postgres:17`, synthetic data, real live body copy)
Runs on head `1055c890…`: [PG17 suite 43600010499](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43600010499) **success**; [Integrated Browser Acceptance 43600010517](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43600010517) **success**. All suites: guarded sources FAILS=0 (existing S/T/P/SR regression, F2 matrix, roles, risk), negative controls fail where required, repeat run identical, 0 leftover databases, guard mutation test 13/13 mutants killed.
| Test | Result | What it proves |
|---|---|---|
| L1 | PASS | the fixture's approval/vendor bodies are byte-identical to live |
| R2a, R2d | **CONFIRMED** (live body) | the defect, kept as negative controls (they must keep reproducing on the live body) |
| R2h | PASS | corrected body = live body + exactly one ` for update;`; signature, SECURITY DEFINER, search_path, ACL, return type, volatility unchanged |
| R2i | PASS | 14 outcomes identical before/after (success and error text for zero-line, non-draft, unknown indent, bad status, NULLs, issue/close/cancel rules) |
| R2j | PASS | approve→issue→close and approve→cancel give identical rows, dates and audit trail |
| R2b | PASS | corrected approval vs resync: resync waits, approval keeps its 3 lines, resync then rejected |
| R2k | PASS | opposite order: resync first, then approval is denied ("Cannot approve indent without lines"), nothing written |
| R2d_fixed | PASS | second concurrent approval waits and is rejected ("Only draft indents can be approved"); exactly one audit row |
| R2e | PASS | Add Line waits for the approval, then is rejected `23514` |
| R2f | PASS | source-PR reassignment (R10b wrapper) waits for the approval, then is rejected |
| R2g | PASS | 20 rounds: approval × resync × reassignment × approved-line correction (snapshot lock) × close × PR status — no deadlock; "approved ⇒ at least one line" held every round |
Real migration file, not a text substitution, is what the tests load.

## 5. Compatibility review
- **R10 lock order** (indent header → PR header → lines): the corrected function locks only the indent header, and does so earlier than before. It takes no PR-header lock. No inversion with resync, the Add Line wrapper, reassignment, or PR writers.
- **Snapshot refresh:** live `proc_request_snapshot_refresh_pec_internal` takes `pg_advisory_xact_lock(hashtext('procurement_snapshot_refresh_request'))` held to commit. The approval already called it **after** its header UPDATE; the new lock is still taken before it, so the global lock stays last in the order for every caller (approval, issue/close/cancel, Add Line corrections). The fixture models this lock exactly.
- **Other status transitions** that run through this function (issue, close, cancel) now also decide under the header lock; they are otherwise unchanged (R2i/R2j). Separate functions (`proc_indent_issue_pec_internal`, `proc_indent_close_strict_pec_internal`, `proc_indent_close_with_override_pec_internal`, `proc_indent_autoclose_if_fully_allocated`) read status unlocked and are **out of scope**: they act only on approved/issued indents, which resync never edits, so they cannot create the zero-line state; a stale-status race between them remains a lower-severity item.
- **Observable behaviour changes (all strictly stricter, no rule change):** a concurrent second approval now waits and is rejected instead of silently repeating; Add Line and reassignment racing an approval now wait and are then refused (this is what the Add Line wrapper's own comment already intends: "serialize with lifecycle transitions"). Approval holds the header row slightly longer.
- **Interface / auth semantics:** no signature, permission, ACL or response change; the genuine-role checks and client acceptance already recorded need not be repeated for this migration. If the owner wants a signed-in smoke after deployment, it is a read of the approval screen with a non-approved fixture only; no approved indent is used.

## 6. Production gate (only after separate owner approval of this exact file)
Pre-checks, all must hold or STOP: staging/branch blob and SHA-256 equal section 3; target project `qhmoqtxpeasamtlxaoak`; history 697 rows and `20261114135500` absent; live `proc_indent_set_status_pec_internal` md5(prosrc) = `052dfcbd06e19746213aaada2b588036`, `SECURITY DEFINER`, `search_path=public`, ACL recorded; wrapper `proc_indent_set_status` definition unchanged (record md5); only the four lifecycle-audit triggers on the six PEC tables; business baseline recorded (headers, lines, mappings, approved count, data fingerprint).
Apply: the file's exact text in its own transaction, editor hash equal to the pinned SHA-256 before running (same method as R10), then `supabase migration repair 20261114135500 --status applied --linked` for that single version (no `db push`, no `migration up`, no `--include-all`).
Post-checks: body md5 = md5 of the file body; body minus ` for update` = `052dfcbd…`; attributes and ACL unchanged; wrapper unchanged; row counts and data fingerprint unchanged; history 698. No test on any of the approved production indents.
Repository step to land it: the protected-path pin currently allows the file only on the branch `claude/pec-r2-approval-race-fix-20261114`; before integration into staging the pin's head list must be changed to the staging branch in a reviewed commit.

## 7. Limits and honest gaps
Fixture evidence, not live runtime: the lifecycle-audit trigger and the snapshot-refresh lock are modelled (their live bodies were read; the audit trigger body for the header was not copied); the vendor-balance view is a stand-in (irrelevant to this function). Concurrency is shown by deterministic barriers plus a 20-round probe, not exhaustively. Siblings noted in section 5 are not corrected here.

## 8. Owner decisions required
1. Approve (or decline) the exact migration in section 3 for production, **or** record an explicit risk acceptance for R-2.
2. If approved: authorise the version-preserving apply + single-version registration in section 6, and the later pin change to the staging branch.
3. Decide whether the sibling status writers (issue/close/override/autoclose) get their own bounded review (recommended: separate, lower priority).
4. R-1 and R-3 dispositions per `PEC_RESIDUAL_RISK_LEDGER_20261114.md` (corrected descriptions).


## Owner production authorization — 14 November 2026 (subsequent decision)

**OWNER APPROVED — EXACT ONE MIGRATION, CONDITIONALLY EXECUTABLE.** After independent live/source/CI review in issue #412, the owner responded **"Go ahead"** to the explicit question: "Do you approve production execution of exactly `20261114135500` under these safeguards?" This authorizes the *existing*, unchanged `20261114135500_pec_indent_set_status_header_lock.sql` only (source pinned SHA-256 `1dd812008e520db3a1c1ee2a3f62fe56f76350b23de417423831e6ce67d14823`) for linked project `qhmoqtxpeasamtlxaoak`, subject to §6 fail-closed checks. Authorization includes single-original-version history registration using `supabase migration repair 20261114135500 --status applied --linked` **after** successful exact-file SQL execution and verification. Approval does **not** authorize other migrations or history registrations.

**Fresh read-only baseline at authorization:** remote history `697` entries, target version absent; 48 indent headers / 0 drafts / 1,598 lines / 1,023 line mappings. Internal status-function body MD5 `052dfcbd06e19746213aaada2b588036`, SECURITY DEFINER, `search_path=public`, anon/authenticated EXECUTE false. Operator must independently reconfirm source, ACL, four audit triggers, public wrapper, full data fingerprint and target before execution, STOP on drift or incomplete evidence.

**Execution scope:** same guarded single-file transaction process used for approved R10; register only the exact original version after the function installation succeeds; independently compare installed body against pinned source with the sole `FOR UPDATE` addition, preserve business rows, wrapper, ACL and audit semantics, and return evidence. No privileged real-record writer probe, `db push`, `migration up`, `--include-all`, unrelated REVOKE/GRANT, role alteration, `main` merge, PWA/Electron release or signing G0–G5. Protected-path pin change needs separate code review before integration.

**This paragraph records owner approval, not execution or successful deployment.**
