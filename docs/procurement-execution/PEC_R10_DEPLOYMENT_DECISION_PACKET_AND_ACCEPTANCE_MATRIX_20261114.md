# PEC R10 — deployment decision packet and authenticated acceptance matrix

Date: 14 November 2026 | Issue #388 (also #383) | Staging head reviewed: `a429679a852fa739c0209f54467bca1f6dd3ac50` (PR #347) | Project `qhmoqtxpeasamtlxaoak`
Scope of this run: **read-only**. No production migration, grant, history change, business write, merge or release was performed. Migration history (11/11 historical PEC) was not touched.

## 1. Recommendation (one line)
**APPROVE WITH CONDITIONS** — R10a (`170715`) and R10b (`013211`) are source-correct against the live functions, CI-proven on PG17, and carry no ACL change. R10c (`172424`, the preview RPC) adds a new EXECUTE grant and needs its own explicit owner yes. Do **not** apply until the two open conditions in §6 are accepted or closed. Production apply is a separate step after approval.

## 2. Exact artefacts (verified)
| Order | Version | File blob (git) | SHA-256 (CRLF-normalised, `scripts/pec-r10-migration-hash-audit.mjs`) | Commit |
|---|---|---|---|---|
| 1 | 20261113170715 | `9eea22705ceb3e7ebbe22aa4eae6b0faf1adf66b` | `43b51cd98dc37635bc7c2ccfb9b76df1fcc89062e38e1886b754e3f8d19a624b` | a022b7d1 |
| 2 | 20261113172424 | `8e26bb633c17311c1bd68d28829c107383fb0b88` | `7c379d30f32ebb7f1f8db6c82c8cbbe897e0cfcb05ed8273cf688ae4ad24925d` | eeb90307 |
| 3 | 20261114013211 | `b9ff65bfec44947fcb753f10400a5c98c35e00ce` | `420f64a00ee544f29cbc64a33b1c47c6c0c74184a8574cb06b3d4aa450243961` | fb64b3fe |
Ordering: all three sort after the newest registered version (`20261112220000`) and after `20261112143000`; none is registered remotely (history 694 rows). All three are already in staging head `a429679a`.

## 3. Workstream A — database readiness
**A1 Source diff vs. live (PASS).** Diffs against the registered bodies are exactly the intended changes:
- Resync (vs `143000`): indent header `FOR UPDATE`; PR header `FOR SHARE`; ordered `FOR UPDATE` on all indent lines; SAFE-only collision guard raising `23514` before any write. Nothing else.
- `proc_pr_add_line_pec_internal` (vs `133000`): one change — `FOR UPDATE` on the PR header read.
- `proc_pr_set_manual_delta_pec_internal` (vs `133000`): PR header `FOR UPDATE` plus status re-read and existence re-check under the lock.
- Live attributes match what `CREATE OR REPLACE` will re-assert: resync `SECURITY DEFINER`, `search_path=public`; the two PR writers `SECURITY INVOKER`. Live resync body = `143000` body (md5 `8b955221…`), so R10a replaces exactly the registered version.
- **R10b (live read, previously "not in repo"):** live `proc_indent_set_source_pr` = `require_permission(…,'t')` + delegate (md5 `87f86ca8…`), exactly the template R10b assumes. Live `proc_indent_set_source_pr_pec_internal` (md5 `5c7b97a0…`, ACL postgres/service_role only) was read in full: status checks, then `UPDATE proc_indent_header`, map deactivate + insert. It writes **no** indent lines or line-map rows and takes no locks — the harness model is accurate, and R10b's prelude closes its check-then-write window.

**A2 Writers, triggers, lock order (PASS with residuals).**
- Live triggers on the six PEC tables: only the four lifecycle-audit AFTER row triggers (indent/PR header and line). The line trigger ignores `updated_at`-only changes and writes an audit row; it takes no lock on the PEC tables. No other triggers.
- Writers found by scanning all `public` function bodies (24 functions touch the six tables). Beyond the R10 inventory: indent set_status/issue/close/delete_draft/vendor writers, PR set_status/revision/delete_draft/requested-qty/reason writers. Lock order check: indent writers touch the indent header only; PR writers touch the PR header only; none takes PR-header-then-indent-header. No cycle with the R10 order (indent header → PR header → lines).
- **Residual R-1:** vendor bulk writers (`apply_vendor_to_same_item_lines`, `clear_vendor_assignment_for_same_item_lines`) are gated only by "not closed/cancelled", so they can touch **draft** lines without the header lock, in scan order; resync locks lines in id order. A theoretical two-row lock inversion would end in Postgres `40P01` (one transaction aborts, nothing corrupts). Not covered by the harness.
- **Residual R-2:** `proc_indent_set_status_pec_internal` reads status and line count without a lock, then updates the header. An approval racing a resync that deletes all lines could approve against a stale line count. Very unlikely (needs a PR whose final lines all go to zero) and unchanged by R10; noted, not fixed here.
- **Residual R-3 (pre-existing):** `service_role`/`postgres` callers bypass wrapper locks (already documented in R10).

**A3 Grants and the preview RPC (PASS, with an observation).**
- Preview ACL (new): `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role` — same pattern as the approved #323 reads. First statement `require_permission('module:procurement-execution-console', false)` (View).
- Live `require_permission` (read in full): requires `auth.uid()`; a matching `user_permissions_canonical` row with `can_view`, and `can_edit` when edit is requested; otherwise `RAISE EXCEPTION 'Permission denied for …'` → SQLSTATE `P0001` with permission wording (not `42501`). This resolves the runbook's "unverifiable wording" item: it matches the harness classifier (`P0001` + permission wording). Denial is by exception, so HTTP ≥ 400 is expected.
- **Is View-only appropriate? Yes.** Exposed: indent line quantity and manual reason, PR final quantity and reason, item name, UOM, counts. Today **any signed-in user** already has direct table `SELECT` on `proc_indent_line`/`proc_indent_header`/`proc_pr_line`/`proc_pr_header` (policy `auth.uid() is not null`), and the other View-gated reads (`proc_pec_indent_headers_paged`, `proc_pec_pr_headers_paged`) use the same `false` gate. The preview is therefore strictly narrower than existing exposure and introduces no new data category. Live view `v_proc_indent_lines_console_ordered` has the columns the preview uses (`indent_line_id`, `stock_item_name`, `uom_code`) — the earlier "unverified column" caveat is closed.
- Live permission population for the module (counts only): 5 rows — 3 editors, 2 view-only, 0 without view flag.
- **Observation O-1 (not changed here):** `anon` holds full DML (`arwdDxtm`) on `proc_pr_indent_line_map`, and `authenticated` holds `arwd` on it and on `proc_pr_to_indent_map`; protection is RLS enabled with no policies (default deny). Also all signed-in users can read indent/PR tables regardless of PEC permission. Recommend a separate owner-approved grant-hardening item (REVOKE anon, REVOKE authenticated DML). R10 neither worsens nor fixes this.

**A4 Rehearsal (CI evidence only).** The harness `scripts/pec-r10/concurrency-harness.sh guarded` applies `133000` → `143000` → the three R10 files in order on a fresh fixture DB, then runs S1–S9, T1–T7, P1–P5, SR1–SR8 and the two negative-control sources. GitHub Actions run `43587704566` ("PEC R10 SAFE resync concurrency PG17", job `concurrency-harness`, **success**, 14 Nov 2026 10:57–11:01 UTC, head `a429679a`, `postgres:17` service). Also green on the same head: `pg17-fixture`, `integrated-pec`, `contract`, `verify`×2, `offline-regression`, `focused-confidentiality`, Netlify deploy preview.
- **Local re-run: NOT DONE** — this machine has no Postgres or Docker (WSL Ubuntu has none installed); nothing was installed.
- **Rehearsal on a copy of live data: NOT TESTED / BLOCKED** — no approved disposable or staging copy exists; creating one is a separate decision.
- The harness uses synthetic fixtures and a model of the set-source internal; this packet's live reads confirm that model, but nothing has run against live triggers/RLS.

**A5 Behaviour claims (from the CI harness, not re-run by me).** SAFE collision → `23514` with state unchanged (S1–S3); preview vs writer agree over five states, runs in a READ ONLY transaction, ineligible states return `eligible=false` (P1–P4); preview ACL (P5); no-permission denial first, no mutation (SR8); deadlock probes 20 rounds (T7, SR6); approved indents unreachable because the status gate is unchanged and the writer rejects non-draft before any write. Live today: 48 indent headers, **0 drafts** — a production apply changes no existing row.

## 4. Production execution gate (to be run only after approval)
Pre-checks (all must hold; any difference → STOP):
1. Staging blobs equal §2; SHA-256 equal §2; CLI target `qhmoqtxpeasamtlxaoak`.
2. History 694 rows; `20261112143000` present; the three R10 versions absent; versions above `20261112042921` are exactly the eleven registered ones.
3. Resync `md5(prosrc)` = `8b9552216ffedbda167edb4500f9f809`, SECDEF, `search_path=public`, ACL postgres/service_role; set_source_pr md5 `87f86ca869ea5fe1a8c43bee41626d04`, internal md5 `5c7b97a0b68aa2626e38666e2679e04d`; PR add_line / manual_delta bodies byte-equal to `133000`.
4. 0 draft indents (if any exist, stop and review); no preview function exists.
5. Only the four audit triggers on the six tables.
Execution (one file at a time, each in its own transaction, no `db push`): apply `170715` → verify → apply `013211` → verify → (only if R10c approved) apply `172424` → verify → `supabase migration repair <v> --status applied --linked` per file.
Post-checks: new function md5s equal the file bodies; resync/set_source_pr/PR writers' SECDEF/config/ACL unchanged; preview ACL exactly authenticated + service_role, anon 0; indent/line/map counts unchanged; history +3 (or +2).
Rollback: forward migration only (re-issue the `143000`/`133000` bodies and the c8a wrapper; `DROP FUNCTION` for the preview). No data rollback is needed because no data is written.

## 5. Risks remaining
R-1, R-2, R-3, O-1 above; fixture-only rehearsal; role/PWA/Electron acceptance not executed (§7); the UI that consumes the preview must degrade when the RPC is absent (stated in the R10 doc, not re-verified here).

## 6. Conditions for the approval
- **C1:** owner accepts fixture-only (CI) rehearsal as sufficient, **or** approves a disposable/staging copy to rehearse on first (recommended if the owner wants live-trigger and RLS evidence).
- **C2:** separate explicit yes for the new preview EXECUTE grant (R10c); R10a/R10b need no grant.
Not conditions but recommended: open a follow-up for O-1 and R-1/R-2.

## 7. Workstream B — authenticated acceptance matrix
Tested SHA: `a429679a852fa739c0209f54467bca1f6dd3ac50`; preview host `deploy-preview-347--sasv-utilities-hub.netlify.app` (Netlify check success, deploy `6af83e9a501040ad4c69aa6f`). No credentials or sessions were used by Claude.
| id | check | Editor | View-only | No-access | evidence |
|---|---|---|---|---|---|
| F1 | served build == tested SHA | PASS (automatic, role-independent) | same | same | provenance script: JS, CSS, `sw.js` byte-identical (CACHE_NAME `hub-cache-v393`); HTML differs **only** by the 4-line Netlify preview-injected div (hash equals repo after removing it: `fff5848f…71d0`). The script itself exits `1` on this preview-only injection — the checker should tolerate it (follow-up). |
| B-self | operator harness self-tests | PASS | | | `node --check` ok; `node --test` 15/15 |
| F2 | 5-lens navigation | NOT TESTED | NOT TESTED | n/a | needs a human session |
| F3 | edit controls per role | NOT TESTED | NOT TESTED | n/a | needs a human session |
| F4 | direct server denial (RPC, HTTP, SQLSTATE) | n/a | NOT TESTED | NOT TESTED | expected `P0001` "Permission denied for module:procurement-execution-console (edit=true/false)", HTTP ≥ 400; no actual HTTP response was captured |
| F5 | writer functional (draft fixture) | NOT TESTED | n/a | n/a | no owner-approved draft fixture; 0 drafts exist |
| F6 | installed PWA freshness | NOT TESTED | | | no installed PWA/device here; expected CACHE_NAME `hub-cache-v393` |
| F7 | Windows packaged Electron parity | NOT TESTED | NOT TESTED | NOT TESTED | no packaged build run; build/hash steps not executed |
Why role rows are not run: the harness refuses non-interactive terminals and requires each operator to sign in personally in the opened browser; Claude does not sign in or handle credentials. Commands to run, one identity at a time, are in `PEC_OPERATOR_EXECUTION_RUNBOOK_20261113.md` §C with `--url=https://deploy-preview-347--sasv-utilities-hub.netlify.app`. Live population is 3 editor and 2 view-only accounts; a no-access identity must be an existing account without the grant.
Accepted PEC R2c UI behaviour: no client file changed in this run.

## 8. Evidence limits
All live reads were in the SQL editor, read-only (catalog and aggregate counts; no identities or business rows recorded). CI results come from the public GitHub API for the exact head; job logs were not downloaded. Registration/approval is not proof of execution; G0–G5 remain unsigned.


## Owner decision — 14 November 2026: R10 forward deployment, conditional

**Owner APPROVED the bounded R10 release path** by replying "Okay go ahead" to the explicit proposal to resolve the two conditions together and then use Claude Desktop for three versioned migration deployments. Interpret this as:
- **C1 APPROVED:** accept existing exact-head GitHub PG17 synthetic CI rehearsal as sufficient for *this bounded production migration gate*, without creating a live-data database clone. This is not a claim of live concurrency/runtime acceptance or final release approval.
- **C2 APPROVED:** authorize the new STABLE SECURITY DEFINER `proc_indent_resync_collision_preview(bigint)` to enforce `require_permission('module:procurement-execution-console', false)` and grant `EXECUTE` **only** to `authenticated` and `service_role`, explicitly revoking `PUBLIC` and `anon` as in the pinned `20261113172424` source. Genuine-role negative checks are still mandatory before final release.
- **Production forward installation CONDITIONALLY APPROVED:** exact existing source versions **`20261113170715`**, **`20261113172424`**, **`20261114013211`**, individually in original-version order, subject to frozen SHA/hash and function/ACL/trigger/status preflights, individual transaction success and post-checks, a version-aware history recording without unrestricted bulk push, and halt-on-unexpected-drift. Do not edit source or silently substitute a different migration/version. Preserve the names and run the three files in ascending version order.

**Execution boundary:** This is permission for the three pre-reviewed forward migrations only, including their expressly scoped preview grants. **No** business-row mutation (existing approved indents are never test fixtures), unrelated grant hardening (#400), vendor writer/status race patches, new source changes, RLS modifications, full-project migration repair/push, `main` merge, PWA/Electron release, or formal G0–G5 sign-off. Rollback must use a separately reviewed forward migration; never replay older migrations. If actual execution requires an unsafe direct history insert, ambiguous source/version handling or disallowed bulk migration command, **STOP** instead of improvising.

**Fresh connected production read-only baseline at authorization:** 694 official migration history rows; R10 registrations 0/3; 48 indent headers, zero drafts, 1,598 indent lines, 1,023 line mappings; preview RPC absent; resync definition MD5 `b4ca2525ead97eba685ff30ab50d4959`; source-PR wrapper definition MD5 `5aa37e3f9d61fd4d2ac4b186a6e5d85c`. Real signed-in Editor/View-only/no-access and installed PWA/Windows Electron tests remain NOT TESTED. The *authorization* is recorded here; **R10 deployment is not asserted executed**.

**Remaining follow-ups:** #399 strict Netlify preview provenance checker; #400 separate read/ACL exposure assessment. Any proven unauthorized access becomes a release blocker. R-1 vendor bulk writer line-lock inversion and R-2 approval stale line-count residuals remain uncorrected and require explicit release-risk disposition.

> **Correction (14 Nov 2026, see `PEC_RESIDUAL_RISK_LEDGER_20261114.md`):** residual R-1 above is mis-described. The vendor bulk writers never lock or update indent lines; they update many indent header rows in query order, so the residual is two multi-header writers deadlocking each other (clean `40P01` abort, independent of R10), not a resync line-lock inversion. R-3 is narrower than stated: the live FK and the resync line locks serialise direct inserts/updates by privileged callers behind an in-flight resync; only the wrapper permission check and lock prelude are skipped, by design. R-2 is now a reproduced integrity defect (issue #412, draft PR #414).
