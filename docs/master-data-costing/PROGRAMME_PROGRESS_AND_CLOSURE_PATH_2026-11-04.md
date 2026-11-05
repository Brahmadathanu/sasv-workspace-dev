> **Signed-in PWA owner acceptance — 5 Nov 2026 (newest):** All six Costing modules can now be opened through the PWA using the approved Costing-specific view-only account. CCC dashboard and most read-only tables load; confidential RM/PM traces correctly restrict. November Readiness shows `READINESS_BUILD_ABSENT` (zero current November portfolio builds; not a permission error). Production Route Manager **Cost Centres** read list/detail were incorrectly edit-gated in the client despite view-allowed server RPCs; a narrow client patch is **DRAFT/NOT MERGED OR DEPLOYED**. Two separate CSR reads returned PostgreSQL 57014 statement timeouts. See [authenticated PWA findings](AUTHENTICATED_PWA_SIX_MODULE_ACCEPTANCE_2026-11-05.md). Signed-in server-side denial checks, Cost Centres post-fix and flags acceptance remain NOT TESTED; formal closure **5/13 (38%)**.

> **Live Costing navigation correction — 5 Nov 2026 (latest):** Owner-approved six-row `public.app_modules.min_nav_mode` change `view`→`read` applied and independently verified. All six Costing registry entries now support clickable **read-only** access in PWA **and** Electron (6/6 each); unrelated navigation unchanged. Test account remains 6/6 Costing `can_view=true, can_edit=false`, 52 unrelated edit grants preserved. Owner's earlier screenshot is **pre-fix FAIL**; signed-in **post-fix** module navigation and screen-level acceptance remain **NOT TESTED**. See [six-module read-navigation correction](SIX_MODULE_READ_NAVIGATION_CORRECTION_2026-11-05.md). Formal closure unchanged **5/13 (38%)**. No feature flags, deploy, cache, release or costing writes.

> **Test identity enabled — 5 Nov 2026 (latest):** The owner-approved existing SASV test login now has **all six Costing Suite permissions `can_view=true`, `can_edit=false`**, verified in canonical and effective views. Six rows added transactionally; account permission totals **73→79**, existing edit grants **52→52**. The account **is not globally read-only**, because 52 unrelated edit grants remain; no broader rights were changed. See [VIEW_ONLY_TEST_IDENTITY_GRANTS_2026-11-05.md](VIEW_ONLY_TEST_IDENTITY_GRANTS_2026-11-05.md). Genuine signed-in browser/navigation, server deny-path and all-eleven-flags acceptance remain **NOT TESTED**, pending a controlled login on a verified integrated client. Formal programme **5/13 (38%)**; no flag activation, deploy, approval run, cache or Electron release.

> **Authenticated acceptance gate — 5 Nov 2026 (latest):** SEC-A2 client PR [#174](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/174) **is squash-merged** into `main` `2e8a74b17dd35795ea76ce6e89d35047b1c39e16`, superseding older ‘draft/not merged’ banners below. LF and CRLF at final tested client head each reported **969 passed, 0 failed, 18 baseline Electron skips (987 total)**; Chromium ran. Both server guards SEC-A1/SEC-A2 remain installed by verified live source hashes. [Live role-readiness audit and non-mutating acceptance plan](AUTHENTICATED_ROLE_ACCEPTANCE_GATE_2026-11-05.md): **zero all-six-module view-only accounts**; database SQL connection runs as postgres without `auth.uid`, so genuine signed-in view-only/editor tests remain **NOT TESTED**. No account/grants were created, no approval RPCs executed, no flags activated or application deployed. Formal closure remains **5/13 (38%)**.

> **SEC-A2 client permission parity — 4 Nov 2026 (draft PR #174, NOT MERGED):** Server SEC-A1/SEC-A2 edit gates are live. Client draft PR [#174](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/174) now hides the approval-preview action for CCC view-only users and guards direct preview/approval/finalisation calls; editor path and permission-revocation tests were added. See [SEC-A2 client gate record](SEC_A2_CLIENT_APPROVAL_VIEW_ONLY_2026-11-04.md). The code-equivalent final tested head `c653d9f` reports LF/CRLF **969/987 passed, 0 failed, 18 baseline Electron skips** in each; Chromium ran. The draft is not deployed or activated and does not satisfy signed-in owner or Electron acceptance; formal closure remains **5/13 (38%)**. Older current-status banners below retain their dated historical meaning.

> **SEC-A2 live correction — 4 Nov 2026 (most recent):** Supabase migration `20261104160256` implemented a CCC-**edit** requirement for `rpc_costing_preview_approval_impact` before it can insert approval-preview acknowledgement tokens. Verified final source MD5 `9911a0c6f2b9c40f762059757e44560e`, original function security/grants retained, and 0 acknowledgement rows before/after. See [SEC-A2 live verification](SEC_A2_APPROVAL_PREVIEW_EDIT_GATE_LIVE_2026-11-04.md). **Both SEC-A1 and SEC-A2 are now installed**, but authenticated view-only denial / editor success and six-module owner acceptance are NOT TESTED. Formal programme **5/13 (38%)**, unchanged; flags default OFF, no release or client deployment. Historical earlier SEC-A2 'OPEN' banners below are superseded by this current status.

> **LIVE SEC-A1 completion checkpoint — 4 Nov 2026:** Supabase migration `20261104155525` (`sec_a1_material_review_ccc_edit_permission_guard_20261104`) successfully applied to project `qhmoqtxpeasamtlxaoak`. Both material-review acceptance overloads and closure now require CCC edit at internal function entry; three new expected body MD5s, SECURITY DEFINER/owner/search_path and wrapper grants verified. [Full post-apply evidence](SEC_A1_LIVE_APPLICATION_AND_VERIFICATION_2026-11-04.md). **Server code correction COMPLETE, live role-level testing NOT YET DONE**; SEC-A2 preview acknowledgement and dedicated view-only account remain open, signed-in acceptance NOT TESTED. Historical 'prepared/not applied' statements below refer to the *pre-application state*, superseded by this checkpoint. Formal programme **5/13 (38%)**; no client deploy, cache, Electron or feature activation.

> **SEC-A1 next milestone prepared — 4 Nov 2026:** [Permission correction plan](SEC_A1_MATERIAL_REVIEW_PERMISSION_REMEDIATION_PLAN_2026-11-04.md) now includes three current-live-definition guarded SQL replacements, rollback and isolated role tests, **not yet applied or approved for production**. This advances server-acceptance preparation, not formal WP closure. Programme **5/13 (38%)**, recent integration wave **3/3**; owner signed-in test HOLD, SEC-A2 and owner governance pending.

> **Later audited checkpoint — 4 Nov 2026, after #169/#170:** [PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md](PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md) records SELECT-only live RPC/permission findings. GitHub `main` now `1e776603`; #170 scope-guard repair and #169 WP12 console/RPC coverage are merged (reported 873/873 LF and CRLF on #169 final tested head). Older `main` / draft-PR counts below are dated evidence. **Formal ledger still 5/13 (38%); integrated feature wave 3/3. Signed-in WP05/WP06/MDC-07/WP12 acceptance is HOLD** pending server authorization correction and a genuine view-only account. No production write, flags, deployment, cache or Electron change.

# Programme progress indicator and WP05 / WP06 closure path — 4 Nov 2026
> **New-chat continuation (4 Nov):** [CHAT_HANDOVER_2026-11-04.md](CHAT_HANDOVER_2026-11-04.md) is the concise execution handover with verified merge history, current draft PRs, pending policy decisions, and the next gated actions. Use it with fresh GitHub checks; it does not supersede the owner acceptance or CDE-2 contract details below.


**Authoritative as of GitHub `main` `18cee239b3f03ed6d1a60c7fe19d7d885ee3ae35` (4 Nov 2026, after #163).** Read live SHAs from GitHub, not from older banners. This file reconciles the repository documentation with what is actually merged; it **closes nothing**. Formal closure is an owner decision. No code, flag, Supabase, deployment, cache, Electron or e-Aushadhi change is made by this file. e-Aushadhi WP-07 remains paused.

## 1. Progress indicator

**Formally closed: 5 of 13 substantive work packs** (WP00–WP04; plus the WP-1 control plane). Unchanged since 25 Oct — no work pack has been formally closed by the owner since.

| WP | Formal status | Implementation (cloud-verifiable) | Remaining to close | Gate owner |
|---|---|---|---|---|
| WP-1, WP00–WP04 | **CLOSED** | complete | — | — |
| WP05 Costing rationalisation | OPEN | Tier 1 delivered: P01 #132, P02 #131, N1–N4/W6 #133–#136/#139, U11 #144, A7 #146, CL1 #151, CDE-1a #149 | §3 | owner |
| WP06 Pricing Policy Manager | OPEN | W6 five-group nav #139; G1 audit #152; G1b #154, G1c #155, G1d #153; F-7 #161, F-9 #162, F-8 #163 | §4 | owner |
| MDC-07 (Costing navigation) | OPEN | N1–N4, W6, U11 merged (it is the same delivery as WP05 Tier 1) | same signed-in checklist as WP05 | owner |
| WP08 Master-data navigation | NOT STARTED (audit briefs only) | none in code | IA08-1 mapping, IA08-2 metadata proposal, IA08-3 cross-links | owner decision O-2 |
| WP09 Launcher audit | NOT STARTED | none in code | IA09-1 hub search/collapse (needs O-7), IA09-2/3 | owner decision O-7 |
| WP10 Creation safeguards | NOT STARTED | audit only (#145) | policy decision | owner |
| WP11 UX consistency | PARTIAL | U11 label harmonisation merged | broader pass | — |
| WP12 Regression / proof | PARTIAL | eleven-flag × six-module sweep #160 (mock); package suites | signed-in matrix, A14 installer proof, final run on final head | owner |

Release target unchanged: complete WP00–WP12 first, then the full Electron release gate. Electron version `6.1.0`, service-worker cache `hub-cache-v390` — neither changed.

**Active blockers**
1. Owner-authorised signed-in ON/OFF acceptance for the eleven Costing flags **on a client build containing the merged changes** — gates WP05, MDC-07, WP06 closure and WP12. Record tested source SHA, bundle/build and cache version and provenance. The published Electron v6.1.0 and current PWA v390 have not been updated for this integration wave; testing either older deployment cannot establish acceptance of the newly merged changes. Use an explicitly authorised isolated test/preview build with suitable roles, without publishing or changing production assets.
2. Owner decisions: O-5 (D3, D5, D7, C9), O-8 (`COST_REVIEW_WORKBENCH` destination), O-2 / O-7 (WP08 / WP09), CDE-2 principle.
3. Server-first items: protected draft-run read contract (CDE-2), run-selector contract for fixed runs 80/82 (C5/D5).
4. No WP06 code PR remains open: #163 (F-8) is merged; stacked #157/#158/#159 were closed unmerged (superseded).

**Next immediate milestone:** owner review of this closure path and of the CDE-2 package ([CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md](CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md)); in parallel, the owner fills [OWNER_ACCEPTANCE_RECORD_2026-11-04.md](OWNER_ACCEPTANCE_RECORD_2026-11-04.md).

## 2. Documentation reconciliation (what older text says versus `main`)
| Statement in older documents | Actual |
|---|---|
| `MASTER_PROGRAMME.md` "Active work pack: None… No package other than N1 is authorised"; "N2/N3/N4/W6/U11 not started" | N1–N4, W6, U11 are all merged (3–4 Nov). Banner in `MASTER_PROGRAMME.md` now points here. |
| `WP05_CL1` §5 condition (a): "#149 and the CL1/G1 packages are reviewed and merged" | **Satisfied**: CL1 #151, G1 #152, CDE-1a #149 are merged. Conditions (b) and (c) remain. |
| `WP-06` file shows only the 3 Nov W6 findings | G1/G1b/G1c/G1d/F-7/F-9 are merged on 4 Nov; F-8 is #163 (merged). Banner added. |
| PR #145 §5 says nine flags | **Eleven** default-OFF Costing flags (corrected in #150/#160; the #160 sweep and CL1 test pin the number). |
| #157/#158/#159 (stacked F-7/F-9/F-8) | Closed unmerged; superseded by merged #161, #162, #163. |
| `WP12` status file "Baseline `43a93ef`" | Main has since gained #161, #162, #163. |
| Test totals | Per-PR figures (e.g. #162: LF/CRLF 798/798; #160: 733/733) were measured on different bases and **must not be added**. The main-head figure is in §6. |

Still-open documentation PRs (all draft, none merged): #141, #142, #143, #145, #147, #148, #150 (evidence/briefs), #114, #116, #119 (older), #137 (storage retention), #118/#122 (e-Aushadhi, paused). They carry evidence the owner may wish to merge in one reconciliation pass; this file does not assume they are merged.

## 3. WP05 — shortest safe path to formal closure
Proposed closure conditions (from CL1 §5), status now:
- (a) delivery packages merged — **DONE**.
- (b) owner records the signed-in ON/OFF checklist (CL1 §4: eleven flags × six modules, lens/period switch, deep links, view-only role, no console error; role, date, browser, result) **against an authorised test build proven to contain the merged head**, with source/build/cache provenance and all test flags restored OFF. This cannot be satisfied by an older deployed client.
- (c) C6 / C9 / D3 decided *or explicitly parked*. Recommendation that needs no code:
  - C6 (`COST_REVIEW_WORKBENCH`/`COST_APPROVAL_WORKBENCH` unmapped): park; the honest "no dedicated screen" text stays; CDE-1a gives per-component links. CL2 is then optional and not a closure blocker.
  - C9 (`policy-manager.periodScoped:false` vs period-scoped CSA): park as a documented characterisation (pinned by CL1 tests).
  - D3 (CCC-edit can accept reviews without MCM-edit): owner policy decision, or park with the current behaviour recorded.
- Tier-2 items D2/D4 and CDE-1b stay non-blocking.

**Other residual evidence must be explicitly reconciled:** C5/D5 historical fixed runs 80/82 remain labelled and lack a server selector contract; S2 read-only printable Cost Sheet ↔ SKU detail parity and S9 dashboard KPI requery measurement require evidence or an explicit owner-approved deferral and future gate. Review the complete WP05 closure ledger (including relevant C1–C3 and rights conditions) before gate sign-off. **Candidate closure path:** one or more owner-authorised signed-in test sessions, recorded policy dispositions and a Gate Status edit **only if** each remaining item is either verified or deliberately deferred with owner rationale and a future gate. No further code is currently identified for the delivered Tier-1 fixes, but live acceptance may reveal defects.

## 4. WP06 — shortest safe path to formal closure
Delivered: five-group projection, task-flow audit with F-1…F-6, CSA modal concurrency (G1d), default-policy revise modal tests (G1b) and in-flight fix (F-7), MRP proposal flow tests (G1c) and in-flight fix (F-9). Remaining:
1. **#163 (F-8)** — merged (pre-merge combined-tree LF/CRLF 823/823, Chromium 195/195, per the integration record). No WP06 code remains.
2. **G2 / C9** — owner chooses option (a) *leave and document* (recommended; closes G2 by documentation) or (b) per-workspace scope metadata (shared registry, single writer, needs a registry-wide period test).
3. **D7** (maker-checker on assumptions / default policy / MRP) — owner policy; if not decided, record as parked. Not a client defect.
4. **Server questions** carried from the audit: whether integer units are required (F-4). Park unless the owner decides.
5. Signed-in acceptance of the ten Pricing Policy workspaces — covered by the same checklist as §3(b), with the CSA and default-policy modals exercised read-only unless the owner chooses to make a real change.

**Scope of code completion:** the identified WP06 F-1/F-2/F-7/F-8/F-9 fixes are merged; this is not a guarantee that no further defects will emerge in populated-data or signed-in acceptance. **Candidate closure path:** document owner decisions or explicit deferrals for C9, D7 and F-4; verify read-only role behaviour and all ten workspaces on the tested merged build; reconcile other WP06 gate rows before owner sign-off.

## 5. Next bounded work (client, draft PRs, in this order)
1. This documentation PR (reconciliation, closure path, CDE-2 owner package, owner acceptance record, §7 consolidation plan). The genuine blockers are owner acceptance and decisions, so no further audit or feature code is proposed.
2. After owner answers: WP06-G2 documentation edit, or CL2 if O-8 names a destination.
3. WP09 IA09-1 hub search/section collapse — **held until the owner answers O-7** (building it would decide flag-versus-default implicitly); then presentation-only, single writer on `utilities-hub/index.html` / `hub-auth.js`, never touching e-Aushadhi rows.
4. WP08 IA08-1 repo-side half (page ↔ hub) can start; the registry-row half needs the O-2 export.
5. CDE-1b only after CDE-2 is implemented and read back by the server session.
6. WP12 final matrix on the final head (all eleven flags OFF/ON, LF + CRLF + Chromium) after the above.

## 6. Baseline on current `main`
Pre-merge #163 evidence: LF and CRLF 823/823, Chromium 195/195. My own full-history LF run on `5698ca6` was 819/819 (823 minus the 4 guard tests #163 adds). A post-merge run on `18cee23` is stated in the PR body. Docs-only changes add no tests.

## 7. Draft documentation PRs — overlap and consolidation plan
Judged from PR descriptions and file lists (#148, #150 and the CDE-1a code were re-read; the others were not re-read in full). None should be merged merely because it exists.

| PR | Content | Verdict |
|---|---|---|
| #148 | CDE-2 proposal + CDE-1a brief | CDE-1a brief **obsolete** (#149 merged). CDE-2 text **superseded** by [CDE2_OWNER_REVIEW_PACKAGE](CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md) (#165), which keeps its principles and adds the client field map. Close after the owner accepts #165; branch preserved. |
| #147 | CDE-1 panel design | Implemented by #149; historical. Close, branch preserved. |
| #150 | Briefs WP05/06/08/09 | CL1, G1, G1b–G1d executed. Keep **one** version trimmed to the unexecuted briefs (IA08/IA09, decisions) and corrected to **36 PWA / 79 Electron entries, not 115 in one launcher**. |
| #145 | Source-evidence map, WP12 acceptance matrix A1–A15 | The WP12 reference: keep; correct "nine flags" to eleven and the registry counts. |
| #143 | Full-programme audit, residual register | Overlaps #145 and the CL1 register (do not keep two registers). Merge only as a dated historical record, or close. |
| #142 | Execution plan + night brief; edits `MASTER_PROGRAMME.md` | Night brief executed; plan superseded by this file; its `MASTER_PROGRAMME` edit will conflict. Close. |
| #141 | Live read-only run-status audit (CS-R3) | Unique dated live evidence (runs 143/148/149, SKU 105). Keep; merge as evidence after owner OK. |
| #114, #116, #119 | 1 Nov orchestration, Gate 1B read contract, CCC dashboard design | #114 superseded by `COSTING_SUITE_UNIFIED_WORKFLOW`; #116 overlaps CDE-2 (confirm it is the same need, else fold in); #119 partly realised by the UXF work. Owner to confirm each. |
| #137 | Storage retention audit | Separate parked topic; leave. |
| #118, #122, #59 | e-Aushadhi WP-07 | Paused; **untouched**. |
| #92–#94, #97 | Tally migration parity | Outside this programme; untouched. |
| #164 | Manage Activities UX | Separate scope; untouched. |

Proposed end state: merge #165, one trimmed #150, corrected #145 and #141; close #148, #147, #142 (and #143 unless kept as history); decide #114/#116/#119. Every merge or close is an owner decision.

## 8. Acceptance provenance and deferred-issue governance (4 Nov correction)

The signed-in owner record is a **test protocol, not authorisation to deploy**. Before a PASS is recorded, identify the exact Git source SHA, served JS/CSS asset or packaged installer identity, Electron/PWA and cache versions, role and environment. The isolated preview/test environment must be explicitly authorised by the owner and must contain the current integrated code. If the only available client is published Electron v6.1.0 or PWA cache v390 without the new source, record **NOT TESTED** for recently merged functionality. Local browser flags are temporary test inputs, not production activation. Use view-only credentials, avoid approve/lock/recalculate/save/accept operations, and restore and verify all eleven flags OFF afterward.

A deferred issue is not a verified pass: the Gate Status record must identify the issue ID, observed current behaviour, reason for deferral, residual risk, named later work pack or server gate, and explicit owner acceptance. In particular, C5/D5 historical run 80/82 selection remains server-first; S2 printable cost-sheet parity and S9 KPI requery proof must be evidenced or formally deferred. This procedure does not itself close WP05, WP06, MDC-07 or WP12.
