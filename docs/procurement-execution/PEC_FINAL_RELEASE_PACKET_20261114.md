# PEC final release packet — GO / NO-GO (one page)

14 November 2026 | Issue #388 | **No `main` merge, production frontend release or Electron publication has been done or is authorized by this page.**

## Decision
**CONDITIONAL GO.** Server side is complete and verified in production; code is on staging and `#347` is conflict-free with green checks. Release (staging → `main`, frontend deploy) may proceed once the three items under *Open mandatory items* are closed by you.

## References
| Item | Value |
|---|---|
| `main` | `df66ca9332bfd489479be15e60c35599c1f08459` (moves with unrelated WP08 work; last re-merge pin was main `0a3eeb71`, later commits are docs-only and merge cleanly) |
| Staging `integration/pec-erp-staging-20261112` | code head `043658a509fccb1ded47fbaae5fea25ffb295c9a` (includes #411, #414, #418, #419) plus this docs commit |
| PR #347 (staging → `main`, draft) | MERGEABLE; all checks green at `a961106a`; re-running at `043658a5` (delta = #419, CI-proven) |
| Production migration history | **699 rows**; latest `20261114160000`; historical PEC 11/11, R10 3/3, R-2 and #400 each registered under their original version |
| Client assets (SHA-256, LF) | html `fff5848f…71d0`, js `522f43fb…bbb`, css `c104d4ea…4314`; `CACHE_NAME` `hub-cache-v393`; `public/sw.js` = main + PEC rules, pinned `86245dbd…7239` |

## #400 production step — executed 14 Nov 2026 (owner-approved)
`20261114160000_pec_revoke_authenticated_dml_policy_link_tables.sql`, SHA-256 `068710bf9eafe6745bf214c95ed2e0315dc1819757d23bfb53a4392037080f20`, 3,768 bytes, git blob `fa018938…`, identical on staging. Preflight matched the packet (history 698, target absent, exactly the four `*_authenticated_crud` policies, baseline counts). Applied once in its own transaction through the hash-verified SQL editor (editor SHA-256 = pinned hash before running); then `supabase migration repair 20261114160000 --status applied --linked` (single version; no `db push` / `migration up` / `--include-all`).
| Check | Before | After |
|---|---|---|
| History | 698 | **699** (`20261114160000 pec_revoke_authenticated_dml_policy_link_tables`) |
| Policies on the four tables | four FOR ALL | **one FOR SELECT each** (same predicate); total policies 330 → 330 |
| `authenticated` non-SELECT privileges on the six tables | 24 | **0**; SELECT kept on all six |
| `anon` privileges on the six tables | 14 | **0** |
| All 879 functions (definition md5 / ACL md5) | `7d91e42e…` / `e1e75362…` | **identical** |
| ACLs of all other tables and views | `ec2b5c28…` | **identical** |
| Business rows (counts; 5,955-row fingerprint) | 48 / 0 drafts / 1,598 / 1,023 / 7 / 3,272 / 7; `15ab44c8…` | **identical** |
Disposable PG17 evidence (PR #419, runs 43605771532 and 43605771609 at `3970edcd`): pre-fix exposure confirmed (G7c, G9a); post-fix 48 denied write attempts across no-access, View-only, Editor, anon (G9); reads and security-invoker views unchanged (G10); SECURITY DEFINER wrapper and `service_role` workflows preserved (G11); privileges (G12); nothing else moved (G13). **No write probe was run against production.**

## G0–G5
G0 evidence complete (owner signature pending). G1 contract/policy PASS (technical). G2 server PASS (technical): 10 historical + `143000`, R10 ×3, R-2, #400 installed and verified. G3 client PASS (technical). G4 PARTIAL: Editor / View-only / No-access PASS on the Netlify preview and on the packaged Windows Electron app; provenance PASS; **installed-PWA offline NOT TESTED**. G5 not authorized.

## Risks (final)
R-1 documented recoverable deadlock risk (vendor writers update many indent headers, never lines; clean `40P01` abort; independent of R10). R-2 technically corrected (production, verified). R-3 privileged-caller boundary (service/postgres skip wrapper permission and locks by design; DB locks and live FK still serialise them). **Read exposure** of indent/PR tables to any signed-in user remains by design: reads are load-bearing for security-invoker views in other modules; restricting them needs a designed permission model. No new material blocker found.

## Open mandatory items (yours)
1. **Installed-PWA offline/reconnect**: not testable here (no installed device; browser pane cannot go offline). Close by running it on a device (open PEC online, go offline and reopen, reconnect and reload; hashes as above), or explicitly waive. Evidence that exists: service worker active, cache holds the PEC assets byte-equal, network-first rules unit-tested (five freshness suites pass).
2. **Read-exposure decision** (accept for this release, or commission the permission design).
3. **Final authorization** for the `main` merge and frontend release (Electron publication separately) and the G0–G5 sign-offs.

## Rollback
Frontend (Netlify): republish the deploy that preceded the `main` merge, or revert the merge commit; PEC assets are network-first and the cache name is unchanged. Electron: nothing published; if published later, withdraw and re-publish the previous version. Database (forward-only, no business data written by any of these): R10a re-issue `143000`/`133000` bodies; R10b re-issue the original wrapper; R10c `DROP FUNCTION public.proc_indent_resync_collision_preview(bigint)` (client shows "preview unavailable"); R-2 remove ` for update`; #400 re-create the FOR ALL policies and re-grant INSERT/UPDATE/DELETE (restores the exposure). Never `db push`, `migration up`, `--include-all` or `db reset`; unrelated history drift remains.
