# PEC final release packet — GO / NO-GO (one page)

14 November 2026 | Issue #388 | **Electron publication is NOT authorized. Release of the frontend (PR #347 → `main`, Netlify) is authorized by the owner under the conditions in *Owner decisions*.**

## Decision
**GO (conditional on fresh exact-head CI, clean mergeability and no new material blocker at merge time).** Server side is complete and verified in production; code is on staging and `#347` is conflict-free with green checks.

## Owner decisions recorded 14 Nov 2026
1. **Installed-PWA offline/reconnect: WAIVED for this release.** Status remains **NOT TESTED** (not converted to PASS). Waiver accepted by the owner. Evidence that exists: service worker active, cache holds the PEC assets byte-equal, network-first rules unit-tested (five freshness suites pass).
2. **Read exposure: temporarily accepted as a documented residual risk.** Any signed-in user can read indent/PR tables by design (security-invoker views in other modules depend on it). No read permission is expanded or redesigned in this release. A separate post-release permission-design follow-up issue, with an accountable owner, is created.
3. **#422** merged first (this document).
4. **G0–G5** recorded below from existing evidence, including the explicit G4 waiver.
5. **Release** of #347 → `main` and Netlify frontend deployment authorized, conditional as above. Electron publication is separate and not authorized.

## References
| Item | Value |
|---|---|
| `main` | `df66ca9332bfd489479be15e60c35599c1f08459` at packet time (moves with unrelated WP08 work; rechecked immediately before merge) |
| Staging `integration/pec-erp-staging-20261112` | code head `043658a509fccb1ded47fbaae5fea25ffb295c9a` (includes #411, #414, #418, #419) plus this docs commit |
| PR #347 (staging → `main`) | MERGEABLE; all 13 checks green at `043658a5` (integrated-pec, concurrency-harness, pg17-fixture, contract, offline-regression, mock-sw, focused-confidentiality, FG-BIT, verify x2, Netlify) |
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

## G0–G5 gate record
| Gate | Status | Basis |
|---|---|---|
| G0 | Evidence complete; owner release authorization recorded 14 Nov 2026 | existing evidence |
| G1 | PASS (technical): contract/policy | existing evidence |
| G2 | PASS (technical): 10 historical + `143000`, R10 x3, R-2, #400 installed and verified | existing evidence |
| G3 | PASS (technical): client | existing evidence |
| G4 | **PASS with explicit WAIVER**: Editor / View-only / No-access PASS on Netlify preview and packaged Windows Electron; provenance PASS; **installed-PWA offline/reconnect NOT TESTED, waived by owner for this release** | existing evidence + owner waiver |
| G5 | Release step: frontend release authorized; Electron publication **not** authorized | owner decision |

## Risks (final)
R-1 documented recoverable deadlock risk (vendor writers update many indent headers, never lines; clean `40P01` abort; independent of R10). R-2 technically corrected (production, verified). R-3 privileged-caller boundary (service/postgres skip wrapper permission and locks by design; DB locks and live FK still serialise them). **Residual R-4: read exposure** of indent/PR tables to any signed-in user remains by design and is **temporarily accepted by the owner**; post-release permission-design follow-up tracked in its own issue. **Residual R-5: installed-PWA offline/reconnect not tested (waived).** No new material blocker found.

## Rollback
Frontend (Netlify): republish the deploy that preceded the `main` merge, or revert the merge commit; PEC assets are network-first and the cache name is unchanged. Electron: nothing published; if published later, withdraw and re-publish the previous version. Database (forward-only, no business data written by any of these): R10a re-issue `143000`/`133000` bodies; R10b re-issue the original wrapper; R10c `DROP FUNCTION public.proc_indent_resync_collision_preview(bigint)` (client shows "preview unavailable"); R-2 remove ` for update`; #400 re-create the FOR ALL policies and re-grant INSERT/UPDATE/DELETE (restores the exposure). Never `db push`, `migration up`, `--include-all` or `db reset`; unrelated history drift remains.
