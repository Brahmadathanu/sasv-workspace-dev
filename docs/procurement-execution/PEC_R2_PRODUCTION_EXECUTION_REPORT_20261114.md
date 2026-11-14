# PEC R-2 correction — production execution report (issue #412, PR #414)

Date: 14 November 2026 | Project `qhmoqtxpeasamtlxaoak` (sasv-workspace) | Authorization: owner "Go ahead", recorded in commit `8ec2a3ec5f7785415953def24ce41886128cf718` (decision packet, exact file only)

**RESULT: the exact migration `20261114135500_pec_indent_set_status_header_lock.sql` is installed and registered under its original version. History 697 -> 698. Function body, security attributes, ACLs, public wrapper, all other functions, audit triggers and business data verified unchanged except the intended one-token body change. No writer probe, no approved-indent action, no other migration.**

## 1. Source verification
Branch head fetched = approval commit `8ec2a3ec…`; the migration file at that commit: git blob `eafd188429084aa0d9797306c59c6978690d3e6e`, 3,826 bytes, LF, SHA-256 `1dd812008e520db3a1c1ee2a3f62fe56f76350b23de417423831e6ce67d14823` = reviewed value. Function body md5 `8d4b0494dd3a19f33f6612087da523ad`; the same body with its single added ` for update;` reverted = `052dfcbd06e19746213aaada2b588036` (the live pre-change md5).

## 2. Preflight (live, read-only) — all equal to the authorization baseline
CLI 2.48.3; linked project-ref and `projects list` marker = `qhmoqtxpeasamtlxaoak`; `current_database()` = `postgres` in that project's SQL editor.
| Item | Pre-state |
|---|---|
| History | 697 rows; `20261114135500` absent; latest are the three R10 versions |
| `proc_indent_set_status_pec_internal(bigint,text,date)` | body md5 `052dfcbd06e19746213aaada2b588036`; def md5 `a34f1a9e14255f5f3e32b91ad6af66e2`; SECURITY DEFINER; `search_path=public`; ACL `postgres, service_role`; anon/authenticated EXECUTE false; returns void, volatile |
| Public wrapper `proc_indent_set_status(bigint,text,date)` | body md5 `485aa8313da44dc3cd99c575e52a714f`; def md5 `6a0e7aba491f007fb2f6f528282ce5ad`; SECURITY DEFINER; `search_path=public`; ACL `postgres, authenticated, service_role` |
| All other `public` functions (878) | combined definition md5 `256257ee407c75b004cbac5a836b77e3` |
| ACL/policy fingerprint (function ACLs + SECDEF + config, table/view ACLs, policy count) | `7afb899701688e9692f66865f979dea1` |
| Triggers on the six PEC tables | the four `trg_proc_lifecycle_audit_*` triggers only |
| Business baseline | 48 headers (48 approved, 0 drafts), 1,598 lines, 1,023 line maps, 7 PR headers, 3,272 PR lines, 7 PR-indent links; data fingerprint (headers incl. dates, lines, maps, PR headers/lines, links) `b923b5d545ffd939c41399296c3cc319` |
No unexplained difference; execution proceeded.

## 3. Execution
- Apply: the exact file text was loaded into the project's SQL editor; the editor content's SHA-256 was computed in the browser and equalled `1dd81200…4823` (3,826 bytes, LF) **before** the run. One run, the file's own `BEGIN … COMMIT` transaction. Result: success, no error, no confirmation dialog.
- Register: only after the installation verified, from a scratch workdir containing only this one file: `supabase migration repair 20261114135500 --status applied --linked` -> `Repaired migration history: [20261114135500] => applied` (exit 0).
- Not run: `db push`, `migration up`, `--include-all`, any other migration, any writer probe, any action on approved indents; no GRANT/REVOKE (the file has none).

## 4. Post-state (independent SQL read)
| Item | Before | After |
|---|---|---|
| History rows | 697 | **698**; row `20261114135500 : pec_indent_set_status_header_lock`; versions above `20261113000000`: the three R10 versions + this one |
| Internal function body md5 | `052dfcbd…` | **`8d4b0494dd3a19f33f6612087da523ad`** (= file body); minus the one token = `052dfcbd…`; ` for update;` occurs exactly once |
| Definition md5 | `a34f1a9e…` | `8586fb9afd87097fa2406f81e78ae2b3` (expected: body changed) |
| SECDEF / search_path / ACL / return / volatility / owner | as above | **identical** (SECURITY DEFINER, `search_path=public`, `postgres, service_role`, void, volatile, postgres) |
| anon / authenticated EXECUTE on the internal function | false / false | false / false |
| Public wrapper | md5 `485aa831…`, def `6a0e7aba…`, ACL as above | **identical** |
| All other functions (878) | `256257ee…` | **identical** |
| ACL/policy fingerprint | `7afb8997…` | **identical** |
| Audit triggers | four | **same four** |
| Headers / drafts / approved / lines / maps / PR headers / PR lines / links | 48 / 0 / 48 / 1,598 / 1,023 / 7 / 3,272 / 7 | **identical** |
| Business data fingerprint | `b923b5d5…` | **identical** |

## 5. What this does and does not establish
Installed and verified against the pinned source; no procurement record, grant, role or approved indent was changed. The corrected behaviour itself was demonstrated on a disposable PG17 database (PR #414 CI run 43600010499, head `1055c890…`); **no writer or race test was run against production**, by design. Registration records that the effect exists; it is not evidence of chronological execution.

## 6. Remaining items for release-gate reconciliation
1. R-2 (#412): technically corrected in production; formal closure of the blocker is the owner's decision.
2. Protected-path pin: the migration is pinned only to the branch `claude/pec-r2-approval-race-fix-20261114`; before integration into staging the pin's head list needs a reviewed change.
3. Siblings noted in the packet (issue/close/override/autoclose read status unlocked) remain out of scope; R-1 and R-3 per the corrected ledger; #400 open.
4. Other release gates unchanged: installed-PWA offline/device, launched Electron with real sessions, independent-operator role repeat, G0–G5 sign-off. No `main` merge, frontend deployment or Electron release occurred.
5. Rollback, if ever needed: a separately approved forward migration re-issuing the previous body (remove ` for update`).
