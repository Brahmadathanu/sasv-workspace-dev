# PEC R10 — production execution report

Date: 14 November 2026 | Project `qhmoqtxpeasamtlxaoak` (sasv-workspace) | Issue #388 | Authorization: staging commit `4dfaf3e6e2f3b6d91ec44eef1a5bb886f30f9da3` (owner "Okay go ahead": C1, C2 and the exact three forward migrations, conditional on preflights)

**RESULT: all three R10 migrations installed in ascending order, each verified before the next, and each registered in migration history under its original version. History 694 → 697. No business row changed. No unexpected ACL change.** Role/device acceptance is NOT TESTED (see §6).

## 1. Method (version-preserving; nothing bulk)
- Source frozen at staging head `4dfaf3e6`; git blobs and SHA-256 (CRLF-normalised) re-verified equal to the reviewed values:
| Version | Blob | SHA-256 |
|---|---|---|
| 20261113170715 | `9eea22705ceb3e7ebbe22aa4eae6b0faf1adf66b` | `43b51cd98dc37635bc7c2ccfb9b76df1fcc89062e38e1886b754e3f8d19a624b` |
| 20261113172424 | `8e26bb633c17311c1bd68d28829c107383fb0b88` | `7c379d30f32ebb7f1f8db6c82c8cbbe897e0cfcb05ed8273cf688ae4ad24925d` |
| 20261114013211 | `b9ff65bfec44947fcb753f10400a5c98c35e00ce` | `420f64a00ee544f29cbc64a33b1c47c6c0c74184a8574cb06b3d4aa450243961` |
- Apply: the exact file text was loaded into the project's SQL editor, and the editor content's SHA-256 was computed in the browser and shown equal to the reviewed hash **before every run** (so the SQL executed is byte-identical to the file). Each file ran as its own transaction (`BEGIN … COMMIT` inside the file). The editor's "destructive operation" notice appeared once (pattern-match on `delete`/`truncate` text inside function bodies; nothing executes at install) and was confirmed.
- History: `supabase migration repair <version> --status applied --linked` (CLI 2.48.3) from a scratch workdir containing only the three R10 files, one version at a time, after that file's post-checks. Not used: `db push`, `migration up`, `--include-all`, `db reset`, direct INSERT into history tables, any historical SQL replay.
- Target proven: linked project-ref `qhmoqtxpeasamtlxaoak`, `current_database()` in that project's SQL editor.

## 2. Preflight (all matched the authorization baseline)
694 history rows; 11/11 historical PEC versions present (110000 … 220000 incl. 143000); R10 versions 0/3; resync src md5 `8b955221…` / def `b4ca2525…`, SECDEF, `search_path=public`, ACL postgres+service_role; `proc_indent_set_source_pr` src `87f86ca8…` / def `5aa37e3f…`; set_source_pr internal src `5c7b97a0…`; PR writers `e25a14a9…` / `3833c192…` (= `133000`), SECURITY INVOKER; only the four lifecycle-audit triggers on the six PEC tables; preview function absent; view columns present; 0 anon EXECUTE on `proc_indent*`; business baseline 48 headers, 0 drafts, 1,598 lines, 1,023 mappings, 7 PR headers, 3,272 PR lines, indent-side data fingerprint `1a49ea4ab8f23c26724320041735f052`.

## 3. Per-migration results
| Version | Applied | Installed bodies (md5 of `prosrc` = md5 of file body) | Attributes / ACL | History |
|---|---|---|---|---|
| 20261113170715 | success | resync `9296f1c7984820b7ddaa153c8e42ac1c`; PR add_line `9272e432c1e8688702323dc6cb0c7686`; PR manual_delta `83f5eaca03819568e9ae1f6658659c3a` | SECDEF/`search_path`/ACL unchanged (resync SECDEF, postgres+service_role; PR writers INVOKER, postgres+service_role) | registered |
| 20261113172424 | success | preview `eec5cb629d50bb4f4418d30da6867362` | STABLE, SECURITY DEFINER, `search_path=pg_catalog, public, pg_temp`; ACL exactly postgres, authenticated, service_role; anon false; PUBLIC none | registered |
| 20261114013211 | success | set_source_pr wrapper `13a16ae71fd22a5eb53069c9db71803d` | SECDEF, `search_path=public`, ACL postgres+authenticated+service_role unchanged; internal still postgres+service_role only | registered |
Expected md5s were computed independently from the files with a script (not from the database).

## 4. Overall post-state
| Item | Before | After |
|---|---|---|
| History rows | 694 | **697** (the three R10 versions) |
| Versions above `20261112042921` | 11 historical | 11 historical + the three R10 |
| Resync internal ACL | postgres, service_role | unchanged |
| Preview function | absent | present; EXECUTE postgres/authenticated/service_role only |
| anon EXECUTE on `proc_indent*` | 0 | 0 |
| Triggers on the six PEC tables | four audit triggers | unchanged |
| Headers / drafts / lines / mappings | 48 / 0 / 1,598 / 1,023 | 48 / 0 / 1,598 / 1,023 |
| PR headers / PR lines / pr→indent maps | 7 / 3,272 / 7 | 7 / 3,272 / 7 |
| Indent-side data fingerprint | `1a49ea4a…2f` | identical |
Unchanged functions confirmed: `proc_indent_add_line` def `a19fabfd…`, `proc_indent_resync_from_pr` def `6a3ea6df…`, set_source_pr internal def `d25b5b37…`. Existing approved indents were never touched or used as fixtures; no function that writes business rows was called.

## 5. Authorization checks (HTTP, anonymous)
Anonymous (public anon key from the shipped client, no session) → `POST /rest/v1/rpc/proc_indent_resync_collision_preview`: **HTTP 401, SQLSTATE `42501`, "permission denied for function proc_indent_resync_collision_preview"**. Earlier run of the same anonymous probe against the preview, the source-PR wrapper and the internal resync with correct arguments also returned HTTP 401. A catalog check shows `anon` and PUBLIC have no EXECUTE. These record **anonymous** denial only; genuine signed-in role outcomes are in §6.

## 6. Authenticated acceptance (runbook) — status
Unchanged build under test: staging `a429679a` assets (the later commits are docs-only). Claude cannot sign in or hold sessions, so every signed-in item stays unexecuted.
| id | check | Editor | View-only | No-access |
|---|---|---|---|---|
| F1 | served build == tested SHA | PASS (automatic; previous run) | same | same |
| F2 | 5-lens navigation | NOT TESTED | NOT TESTED | n/a |
| F3 | edit controls per role | NOT TESTED | NOT TESTED | n/a |
| F4 | server denial over HTTP (signed-in) | n/a | NOT TESTED | NOT TESTED |
| F4a | preview RPC: anonymous denial | PASS (401 / 42501, §5) | | |
| F4b | preview RPC: View-only allowed, no-access denied (`P0001` "Permission denied …") | | NOT TESTED | NOT TESTED |
| F5 | writer on draft fixture | NOT TESTED (no draft; no approved fixture) | n/a | n/a |
| F6 | installed PWA freshness | NOT TESTED | | |
| F7 | Windows packaged Electron | NOT TESTED | NOT TESTED | NOT TESTED |
Operator commands: `PEC_OPERATOR_EXECUTION_RUNBOOK_20261113.md` §C against `https://deploy-preview-347--sasv-utilities-hub.netlify.app`, one identity at a time; for F4b the operator should additionally call the preview with an existing indent id as the View-only and no-access identities and record only HTTP status and SQLSTATE.

## 7. Remaining release blockers and cautions
1. Signed-in Editor / View-only / no-access acceptance, PWA and packaged Electron: NOT TESTED. Any proven unauthorized access is a release blocker. G0–G5 remain unsigned.
2. Concurrency evidence is the synthetic PG17 CI fixture only (C1 accepted); no live runtime concurrency proof.
3. Uncorrected residuals: R-1 (vendor bulk writers vs resync line-lock inversion, would surface as `40P01`), R-2 (approval stale line count), R-3 (service-role bypass). Need explicit release-risk disposition.
4. Follow-ups open: #399 (strict Netlify preview provenance check), #400 (read/ACL exposure and grant hardening incl. anon DML grants on the line-map table).
5. Do not run `db push`, `migration up` or `--include-all`: unrelated non-PEC history drift remains.
6. No `main` merge, frontend release or Electron deployment performed.
7. Rollback is forward-only by a separately reviewed migration (re-issue `143000`/`133000` bodies and the original wrapper; `DROP FUNCTION` for the preview). Not needed so far.
8. Issue #388 was not updated by this run (`gh` not authenticated here).
