# PEC `20261112143000` history-only registration — execution report

Date: 14 November 2026 | Project: `qhmoqtxpeasamtlxaoak` (sasv-workspace) | Issues #383 / #388 | Authorization: staging commit `205bc5ac2dad9f29795901b98e3692bf208c2cbf` (owner "proceed", conditional on execution-time checks)

**RESULT: `20261112143000` registered as applied in `supabase_migrations.schema_migrations` (history only; no SQL replayed). Remote history 693 -> 694. The three R10 versions remain absent. Function definitions, ACLs and the other history rows unchanged.**

## Preflight (all passed before the repair)
- Staging fetched; head was `205bc5ac`; authorization text read (conditional approval, exactly one `migration repair 20261112143000 --status applied --linked`).
- Target: `supabase projects list` linked marker, linked project-ref file = `qhmoqtxpeasamtlxaoak`; SQL editor of the same project. CLI 2.48.3; `migration repair --help` verified (`--status applied`, `--linked`).
- Source frozen: `supabase/migrations/20261112143000_pec_safe_resync_preserve_manual_lines.sql`, git blob `05c6f6cd2cd17a72f4a72df1073925c594e1d8f2` (identical at 397dbef4, 205bc5ac and branch head; verified with `--no-filters` because Windows autocrlf changes a filtered hash).
- Live function `proc_indent_resync_from_pr_pec_internal(bigint,text)`: `md5(prosrc)` (CR removed) `8b9552216ffedbda167edb4500f9f809` = md5 of the file's function body (byte-identical); SECURITY DEFINER = true; `search_path=public`; ACL `postgres=X, service_role=X` only (authenticated EXECUTE false, anon 0); `pg_get_functiondef` md5 `b4ca2525ead97eba685ff30ab50d4959` (matches the owner-recorded value).
- History: 693 rows; `143000` absent; R10 (`20261113170715`, `20261113172424`, `20261114013211`) absent; versions above `20261112042921` = exactly the ten earlier registrations.
- Data: 0 draft indents. Baseline at execution: 48 indent headers, 1,598 lines, 1,023 line-map rows. Note: earlier snapshots showed 45 / 1,593; the difference is new approved indents created by users since (none draft), not by this work. The before/after comparison below uses the 48 / 1,598 baseline.
- Isolation: repair ran from a scratch workdir containing only the 143000 file (no other migration files, no R10).

## Execution
Exactly one command, from the isolated workdir:
`supabase migration repair 20261112143000 --status applied --linked`
Output: `Repaired migration history: [20261112143000] => applied` (exit 0). Not used: `db push`, `migration up`, `db reset`, `--include-all`, direct INSERT, any DDL/DML/GRANT.

## Independent verification (SQL read after the repair)
| Item | Before | After |
|---|---|---|
| History rows | 693 | **694** |
| `20261112143000` present | 0 | **1** |
| R10 versions present | 0 | 0 |
| Resync `md5(prosrc)` | 8b955221… | 8b955221… (unchanged) |
| Resync definition md5 | b4ca2525… | b4ca2525… (unchanged) |
| Resync ACL / SECDEF / search_path | postgres, service_role / true / public | unchanged |
| `proc_indent_add_line` md5 | a19fabfd… | unchanged |
| `proc_indent_set_source_pr` md5 | 5aa37e3f… | unchanged |
| Headers / drafts / lines / line-map | 48 / 0 / 1,598 / 1,023 | 48 / 0 / 1,598 / 1,023 |
| anon EXECUTE on `proc_indent*` | 0 | 0 |
| R10 collision-preview function | absent | absent |
`migration list --linked` shows 143000 in both Local and Remote columns; the ten earlier versions still remote.

## Remaining cautions and gates
1. **Do not run `db push`, `migration up` or `--include-all`.** Non-PEC history drift (local files without remote rows, remote rows without files) is unchanged and still blocks any bulk migration command.
2. R10 (three migrations) is not deployed and needs its own owner decision; R10 supersedes the 133000/143000 function bodies.
3. Registration records that the effect exists; it is not evidence of original chronological execution and does not close any release gate. Genuine Editor / View-only / no-access tests, concurrency tests, installed PWA and packaged Electron acceptance remain NOT TESTED; G0–G5 remain 0/6 formally closed.
4. Five historical business-data exceptions remain separately tracked in #393.
5. GitHub issues #383/#388 were **not** updated by this run (`gh` not authenticated on this machine); this report is the update.

No merge to `main`, frontend release, Electron deployment, R10 apply, indent modification or role change took place.
