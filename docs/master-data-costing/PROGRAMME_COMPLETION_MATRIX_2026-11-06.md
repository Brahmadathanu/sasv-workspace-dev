# Costing Suite programme — completion matrix — 6 Nov 2026

**Documentation only. Closes nothing. Formal closure remains 5/13 (38%).** Reconciled against `main` `12d61d5` and the preview branch `preview/costing-wp05-wp06-wp12-20261105` `163a9bb` (not a broad re-audit: it uses the four authoritative documents, the 6 Nov WP12 handback, PR #197/#198 and the open PR list). No Supabase write, costing refresh, run approval, flag activation, PWA deployment, Electron release or e-Aushadhi change was made by the work listed here. Synthetic tests below are **not** real authenticated acceptance.

## 1. Matrix

| Area | State | Evidence / where |
|---|---|---|
| **Completed and independently verified** | WP-1, WP00–WP04 formally CLOSED (5/13). Merged client packages: N1–N4/W6/U11, A7, CL1, CDE-1a (#149), P01/P02, G1/G1b–G1d, F7–F9, SEC-A2 client (#174), PRM Cost Centres view-only fix (#178). Server: SEC-A1/SEC-A2 live (source hashes verified); six-module `min_nav_mode` correction; CSR snapshot ANALYZE (owner CSR three-read retest PASS, not a timed benchmark) | `PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md` and its dated banners |
| **Implemented on the preview branch only, awaiting acceptance** | WP12 synthetic preview (6 modules, 11 flags, 31/40 lenses populated; merged into `preview/costing-wp05-wp06-wp12-20261105` only via #197, never into `main`; 93/93 LF+CRLF per CI #42219549331). The WP05/WP06/MDC-07 signed-in acceptance record is still blank | handback R.0–R.9 |
| **Proposed in open draft PRs (NOT merged, NOT evidence of completion)** | #199 line-level printable Cost Sheet in the preview; #200 fix for defect CS-A4-LEFT-CLIP (printable sheet's left side unreachable at ≤768px); #201 CDE-1b adapter (unconnected) and a CDE-2 SQL proposal. Their tests are branch evidence only; none of this is on `main` | §2 |
| **Missing client functionality (on `main`)** | CDE-1b (no provider adapter exists on `main`; one is proposed in #201); CDE-3 regional review acceptance UI (owner decision); WP08 IA08-1 repo half; WP09 IA09-1 held for O-7; WP10 policy; WP11 broader pass. Preview-only gaps: line traceability / Explain drawer, multi-SKU printable columns, PRM Workload Preview / Mapping Review / Foundation Review (no payload contract, not invented), PRM editors needing a selection + detail RPC | handback R.6; closure path §5 |
| **Missing server contracts** | CDE-2 RPC (D1–D5 undecided; SQL proposal drafted, inert); run selector for fixed runs 80/82 (C5/D5); CSR parameterised read RPC (design only; October planner +1.7% regression, not approved); WP08 registry metadata (O-2 export); November readiness build absent (`READINESS_BUILD_ABSENT`) | CDE2 package + live audit; CSR docs |
| **Remaining tests** | Signed-in 11-flag × 6-module ON/OFF on an authorised integrated build with source SHA + asset digest; authenticated read-only route (handback R.7); SEC-A1/A2 server deny-path proof (needs a no-side-effect plan); Windows A14 installer proof; S2 printable ↔ SKU detail parity and S9 KPI requery on real data; final regression on the final head | owner record; WP12 files |
| **Owner acceptance required** | Fill `OWNER_ACCEPTANCE_RECORD_2026-11-04.md`; decide O-2, O-5 (D3, D5, D7, C9), O-7, O-8, CDE2-D1…D5; visual approval of CBM/PRM screens (the 17 uploaded screenshots do not cover them) | owner record §§1–5 |
| **Dependencies / blockers** | Isolated, authorised, no-write backend or the real read route (the test identity has 52 unrelated edit grants, so it is Costing-scoped view-only only); run 150 FAILED must not be retried/approved; no PWA/Electron release before WP00–WP12 complete | run-150 record; handback R.7 |

## 2. Open draft PRs from 6 Nov (none merged; status as of the head shown, CI where run)

| PR | Target | Contents | Evidence |
|---|---|---|---|
| [#199](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/199) | preview branch | Line-level printable Cost Sheet fixtures, 6 tests, CI step, screenshots; records CS-A4-LEFT-CLIP | Head `87cf915`: GitHub Actions [run 42235330839](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42235330839) success (zero-skip assertions + CRLF clean-clone step). Local: LF 70/70 + sweep 29/29, CRLF 99/99. An earlier head (`c0cd224`) failed CI at the clean-tree check because a local `node_modules` symlink had been committed by mistake; removed |
| [#200](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/200) | `main` | CS-A4-LEFT-CLIP: one scope-guard-approved CSS insertion + exactness tests + regression test | Head `9682ee6`, 0 commits behind `main` `12d61d5`: LF and CRLF-clone full suites 999 / 981 pass / 0 fail / 18 baseline skips (baseline 991/973/0/18). No GitHub Actions workflow exists for `main`, so there is no CI run for this PR |
| [#201](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/201) | `main` | CDE-1b: inert fail-closed RPC adapter (unconnected, guard-tested) + CDE-2 SQL proposal for server review | Head `20355f1` (code identical to tested `7111bb4`; later commit is documentation only): LF full suite 999 / 981 / 0 / 18; CRLF clone on the evidence directory only (50/50) |

## 3. How the defect (CS-A4-LEFT-CLIP) was found; fix proposed, not merged
The text assertions of the new test passed while the screenshots showed the sheet clipped on a phone. Measured: `.cost-sheet-a4-wrap{display:flex;justify-content:center}` with a 794px child in a 360px container puts the child at left −202px (unscrollable). The first fix edited existing CSS and tripped six historical package guard tests (0-failure baseline → 6 failures); it was redone as an individually approved insertion using the repo's own `APPROVED_HTML_INSERTIONS` mechanism rather than loosening those guards.

## 4. Not claimed
No work pack is closed. No real authenticated, populated-production-data, Windows, PWA or Electron proof exists for anything above. The 18 baseline Electron skips on `main` are skips, not passes.

## 5. Suggested review order
1. #200 (small, self-contained production CSS fix; owner decides whether and when it ships, since it needs a normal PWA/cache decision).
2. #199 (preview tooling only; stacks on the preview branch).
3. #201 (nothing connects it; the SQL proposal is for the server session, not for application).
No PR should be merged without the owner's separate approval; none was merged here.

## 6. Authenticated acceptance pathway (preparation only; nothing here is executed or authorised)
Uses the existing read-only route (WP12 handback R.7) and the [owner acceptance record](OWNER_ACCEPTANCE_RECORD_2026-11-04.md); it adds no new audit.

| Step | Status |
|---|---|
| Candidate integrated build | Netlify automatically built deploy previews for #200 and #201 (bot comments on those PRs). Each is `main` `12d61d5` plus that PR, so it contains all merged work, which a normal production deploy of v390 does not. **Unverified:** nobody has loaded it, recorded the served asset digest, or confirmed it is acceptable to use. It is a candidate, not an authorised test build |
| Backend exposure | A deploy preview talks to the **production** Supabase project. A signed-in session is therefore a production read; the route forbids Preview, Approve, Finalise, Refresh, Recalculate, Lock, Accept, Close, Save, Create, Request draft, Apply and Decide. No no-write backend exists |
| Identity | The existing Costing test login is Costing-scoped view-only (6 grants `can_view` only) but also holds 52 unrelated edit grants. It must never be used to claim "cannot write anywhere" |
| Owner actions needed before any PASS can be recorded | (1) authorise one named build and record source SHA + served asset digest + cache note; (2) authorise the production-read session by the account holder; (3) account holder runs handback R.7 steps 1-6 flag-OFF then Navigation-only, with `scripts/costing-preview/rpc-inventory.mjs` and the Network `rpc_` filter, and restores all flags OFF; (4) decide whether #200 should be in the tested build (it changes what a phone shows for the printable sheet) |
| Not testable even then | CDE-2 panel (RPC absent), SEC-A1/A2 denial proofs (need a no-side-effect plan), November readiness (`READINESS_BUILD_ABSENT`), Windows A14 installer |

A PASS cannot be recorded for any WP until these are done by the owner. Until then the honest status of every signed-in row is **NOT TESTED**.
