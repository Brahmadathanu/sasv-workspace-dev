> **Current verified checkpoint — 8 Nov 2026 (supersedes earlier opening status banners):** Scheme Master optimisation applied live, tested under real ID-V and reconciled in main via #214; November Readiness build #6 COMPLETED/CURRENT (run 149, 1,793 SKUs, 603 operational), 1280/390 ID-V acceptance PASSED; 14-lens evidence classification #215 merged. This is *narrow finding-level acceptance*, not formal programme closure: **5/13 remains**. Remaining: targeted selector/sub-tab acceptance, CSR 57014 timeouts, broader WP05/06/12, SEC-A1/A2 and CDE gates. **C: disk full** on local test PC; do not delete without owner approval. Authoritative dated handover: [CURRENT_CHECKPOINT_AND_CLAUDE_HANDOVER_2026-11-08.md](CURRENT_CHECKPOINT_AND_CLAUDE_HANDOVER_2026-11-08.md). Issue [#211](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/211) contains live evidence. No new data/SQL/flag/deploy action authorised by this doc.

# Costing Suite programme — completion matrix — 6 Nov 2026

**Documentation only. Closes nothing. Formal closure remains 5/13 (38%).** **Revision 3 (7 Nov), reconciled to merged evidence on `main` `f95c7d4`:** merged: #200, #201, #202, #203, #204 and #205 on `main`; #199 into the preview branch only (`preview/costing-wp05-wp06-wp12-20261105` includes it). Open: the issue #206 PR (acceptance runner and operator package). Merged is not deployed: no PWA deploy, cache bump or Electron release has happened. Synthetic and isolated tests are **not** real authenticated acceptance.

## 1. Matrix

| Area | State | Evidence / where |
|---|---|---|
| **Completed and independently verified** | WP-1, WP00–WP04 formally CLOSED (5/13). Merged client packages: N1–N4/W6/U11, A7, CL1, CDE-1a (#149), P01/P02, G1/G1b–G1d, F7–F9, SEC-A2 client (#174), PRM Cost Centres view-only fix (#178). Server: SEC-A1/SEC-A2 live (source hashes verified); six-module `min_nav_mode` correction; CSR snapshot ANALYZE (owner CSR three-read retest PASS, not a timed benchmark) | `PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md` and its dated banners |
| **Implemented on the preview branch only (merged there, not on `main`), awaiting acceptance** | WP12 synthetic preview (6 modules, 11 flags, 31/40 lenses populated) via #197, plus line-level printable Cost Sheet fixtures via #199 (GitHub Actions run 42235330839 success on `87cf915`). The WP05/WP06/MDC-07 signed-in acceptance record is still blank | handback R.0–R.9; #199 |
| **Merged on `main` this week, not deployed** | #204 and #205 (CDE-2 audit; unapplied SQL candidate and packages, nothing applied); plus: #200 CS-A4-LEFT-CLIP fix (CSS-only insertion; printable sheet's left side was unreachable at ≤768 px; local LF/CRLF 999/981/0/18; no CI exists for `main`); #201 CDE-1b adapter (unconnected, guard-tested); #203 live CDE-2 contract corrections; #202 the first matrix revision | `main` history |
| **Missing client functionality (on `main`)** | CDE-1b adapter exists but is **unconnected** (wiring plan in `CDE2_FINAL_REVIEW_PACKAGE_2026-11-06.md` §8; blocked on the server RPC); CDE-3 regional review acceptance UI (owner decision); WP08 IA08-1 repo half; WP09 IA09-1 held for O-7; WP10 policy; WP11 broader pass. Preview-only gaps: line traceability / Explain drawer, multi-SKU printable columns, PRM Workload Preview / Mapping Review / Foundation Review (no payload contract), PRM editors needing a selection + detail RPC (`PARKED_BACKLOG.md` PREV-P01) | handback R.6; closure path §5 |
| **Missing server contracts** | CDE-2 RPC: **does not exist**; a corrected candidate (gate `false`, every call denied) is on `main` (merged #205, unapplied) with isolated PostgreSQL 16 and real-Chromium evidence, awaiting owner decisions D3a/c and a server read-back; run selector for fixed runs 80/82 (C5/D5); CSR parameterised read RPC (design only; October planner +1.7%, not approved); WP08 registry metadata (O-2 export); November readiness build absent (`READINESS_BUILD_ABSENT`) | CDE2 final review package; CSR docs |
| **Remaining tests** | Signed-in 11-flag × 6-module ON/OFF on an authorised integrated build with source SHA + asset digest; authenticated read-only route (handback R.7); SEC-A1/A2 server deny-path proof (needs a no-side-effect plan); Windows A14 installer proof; S2 printable ↔ SKU detail parity and S9 KPI requery on real data; final regression on the final head | owner record; WP12 files |
| **Owner acceptance required** | Fill `OWNER_ACCEPTANCE_RECORD_2026-11-04.md`; decide O-2, O-5 (D3, D5, D7, C9), O-7, O-8, CDE2-D1…D5; visual approval of CBM/PRM screens (the 17 uploaded screenshots do not cover them) | owner record §§1–5 |
| **Dependencies / blockers** | Isolated, authorised, no-write backend or the real read route (the test identity has 52 unrelated edit grants, so it is Costing-scoped view-only only); run 150 FAILED must not be retried/approved; no PWA/Electron release before WP00–WP12 complete | run-150 record; handback R.7 |

## 2. Pull requests from 6 Nov: status by merged evidence


| PR | Target | State | Contents / evidence |
|---|---|---|---|
| [#199](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/199) | preview branch | **merged** (preview branch only) | line-level printable Cost Sheet fixtures + 6 tests; CI run 42235330839 success on `87cf915`; an earlier head failed CI because a local `node_modules` symlink was committed, removed |
| [#200](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/200) | `main` | **merged** | CS-A4-LEFT-CLIP fix; 999 / 981 / 0 / 18 skipped (LF and CRLF clone) at `9682ee6`; **not deployed** |
| [#201](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/201) | `main` | **merged** | CDE-1b adapter (unconnected) + first SQL proposal (since declared non-executable by #203) |
| [#202](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/202) | `main` | **merged** | first revision of this matrix |
| [#203](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/203) | `main` | **merged** | live CDE-2 contract corrections (documentation) |
| [#204](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/204) | `main` | **merged** | CDE-2 eligibility/immutability/privilege audit (documentation) |
| [#205](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/205) | `main` | **merged** | **unapplied** CDE-2 SQL candidate (D3 gate false), 20 isolated-PostgreSQL/Chromium/served-asset tests (LF and CRLF 1027 / 1009 / 0 / 18 skipped at merge head), final review package, acceptance execution package, 11 deferred-register rows. Nothing applied; CDE-1b still unconnected |
| issue #206 PR | `main` | **open (this change)** | hardened build verifier, operator-guided read-only acceptance runner (40 lenses, request-level write guard, fail-closed identity proof), operator package, 4 deferred findings. **Executed against local fakes only; no hosted run, no restricted identity** |

## 3. How the defect (CS-A4-LEFT-CLIP) was found; fixed on `main` (#200), not deployed
The text assertions of the new test passed while the screenshots showed the sheet clipped on a phone. Measured: `.cost-sheet-a4-wrap{display:flex;justify-content:center}` with a 794px child in a 360px container puts the child at left −202px (unscrollable). The first fix edited existing CSS and tripped six historical package guard tests (0-failure baseline → 6 failures); it was redone as an individually approved insertion using the repo's own `APPROVED_HTML_INSERTIONS` mechanism rather than loosening those guards.

## 4. Not claimed
No work pack is closed. No real authenticated, populated-production-data, Windows, PWA or Electron proof exists for anything above. The 18 baseline Electron skips on `main` are skips, not passes.

## 5. Critical path
1. Owner decisions on CDE-2 (D3a/c, D5, D10 and the rest: recommended selections in the CDE-2 final review package §7) and a server read-back, then separate migration authorisation, then gate flip, then wiring. 2. In parallel and independent of CDE-2: the owner creates restricted identities, authorises one integrated build and runs the authenticated acceptance package. 3. Only then can any WP05/WP06/WP12 closure be proposed. No PR is merged without the owner's separate approval.

## 6. Authenticated acceptance pathway (preparation only; nothing here is executed or authorised)
Executable form: [acceptance operator package](WP05_WP06_WP12_ACCEPTANCE_OPERATOR_PACKAGE_2026-11-07.md) (issue #206 PR: runner, verifier, identity proof) on top of the [6 Nov execution package](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md) (merged), built on the existing read-only route (WP12 handback R.7) and the [owner acceptance record](OWNER_ACCEPTANCE_RECORD_2026-11-04.md).

| Step | Status |
|---|---|
| Candidate integrated build | Netlify builds a deploy preview per PR (bot comments). Each is `main` plus that PR; after merges, `main` at an exact SHA. It contains all merged work, which a normal production deploy of v390 does not. **Unverified:** nobody has loaded it, recorded the served asset digest, or confirmed it is acceptable to use. It is a candidate, not an authorised test build |
| Backend exposure | A deploy preview talks to the **production** Supabase project. A signed-in session is therefore a production read; the route forbids Preview, Approve, Finalise, Refresh, Recalculate, Lock, Accept, Close, Save, Create, Request draft, Apply and Decide. No no-write backend exists |
| Identity | The existing Costing test login is Costing-scoped view-only (6 grants `can_view` only) but also holds 52 unrelated edit grants. It must never be used to claim "cannot write anywhere" |
| Owner actions needed before any PASS can be recorded | (1) authorise one named build and record source SHA + served asset digest + cache note; (2) authorise the production-read session by the account holder; (3) account holder runs handback R.7 steps 1-6 flag-OFF then Navigation-only, with `scripts/costing-preview/rpc-inventory.mjs` and the Network `rpc_` filter, and restores all flags OFF; (4) decide whether #200 should be in the tested build (it changes what a phone shows for the printable sheet) |
| Not testable even then | CDE-2 panel (RPC not applied), SEC-A1/A2 denial proofs (need a no-side-effect plan), November readiness (`READINESS_BUILD_ABSENT`), Windows A14 installer |

A PASS cannot be recorded for any WP until these are done by the owner. Until then the honest status of every signed-in row is **NOT TESTED**.
