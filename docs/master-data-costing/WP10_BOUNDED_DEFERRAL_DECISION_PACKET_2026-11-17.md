> **IMPORTANT CORRECTION — 17 NOV LIVE CATALOG:** See [live four-master DML/security assessment](WP10_LIVE_FOUR_MASTER_DIRECT_DML_SECURITY_AUDIT_2026-11-17.md) now committed on `main`. Each classification table has INSERT/UPDATE/DELETE granted to `authenticated` and a broad RLS ALL policy that checks only non-null `auth.uid()`, not module Edit grants. **This direct-DML gap is CONFIRMED, not a hypothetical future risk.** The proposed blanket deferral below is NOT recommended unconditionally. Before WP10 security closure or unconditional Electron release, either remediate through a safely sequenced legacy fleet cutover and actual negative-role tests, or obtain an explicit time-bounded, named-owner acceptance of this known exposure. Optional PR #463 guard installation alone does not fix table ACL/RLS. No permission change was applied by this audit. WP10 OPEN; WP11 CLOSED; WP12 OPEN; 11/13 CLOSED; release HOLD.\n\n# WP10 — Bounded deferral decision packet for owner approval (17 Nov 2026)

**Status: PROPOSAL for programme-owner decision. Nothing here is applied, merged or closed. WP10 formal status remains OPEN. Deferred work is NOT completed work.**

## 1. Separation of scope

| Part | Content | State |
|---|---|---|
| Essential installed functionality | 12 classification RPCs installed and verified (12/12, grants unchanged 4/4); four classification clients merged (#445 at `13168b29`) | PASS within existing receipts; Electron installed-runtime acceptance NOT TESTED |
| Optional preventive safeguards | Draft PR #463 (`3c077eb91dc56143887ff823bda2080faf5729c7`): atomic 05 + CL15 + RM1 guards, reason-audit, audited rollback | DRAFT, UNAPPLIED, not in release scope |

## 2. Decision requested

Defer PR #463 and the residuals below out of the Costing/Electron release scope, with the named receiving owners and milestone. Do **not** merge or execute #463 on `qhmoqtxpeasamtlxaoak` under this decision; any production SQL needs a separate exact-hash owner authorisation.

| Residual | Risk if deferred | Receiving owner (role, to confirm) | Gate before it can be resolved |
|---|---|---|---|
| Legacy Electron compatibility (2-arg RPC, reasonless callers) | Old installs keep working; reason capture not compulsory for all callers | Electron fleet owner + server maintainer | Installed-fleet inventory and cutover; no silent REVOKE |
| Direct table DML on the four classification masters | Authenticated table DML remains a bypass of governed RPCs | Server/security maintainer | Fleet migrated to RPC-only clients; separately reviewed four-table REVOKE |
| Route / hierarchy writer coverage | Candidate mapping triggers do not cover all lifecycle, version, override or hierarchy writers; direct subgroup parent changes. 455/455 route census is a point-in-time scope, not a guarantee | Route governance owner + server maintainer | Independent writer-graph policy before claiming route invariance or resuming group inheritance |
| Locking, fan-out, deadlock | 41-product fixture is not production performance proof | Server maintainer | Live lock budget; pinned generated install/rollback SHA-256 from exact files |
| Rollback | Rollback must retain reason-event history; clients on the removed overload must be assessed | Server maintainer + release operator | Receipt-verified reverse rollback rehearsed; consumer assessment |
| Historical G2/CI-032 overlaps (7 product / 10 family) | Pre-existing; not remapped | Route/costing owner | Separate historical policy; no resolver broadening |

## 3. Proposed milestone

"Post-release server hardening" — begins only after (a) Costing release gates pass or are separately deferred by the owner, and (b) the installed Windows fleet inventory exists. Milestone date to be named by the owner; none is assumed here.

## 4. Closure conditions that remain after this deferral

WP10 formal closure additionally requires: installed Electron acceptance (four classification modules, Editor / View-only / No-access, direct-route denial, governed-RPC-only CRUD) and an explicit owner closure decision. Deferral alone does not close WP10.

## 5. Owner choices

- [ ] Approve bounded deferral as written
- [ ] Approve with amendments (owner/milestone/exclusions)
- [ ] Reject — require some safeguard before release (specify which)
