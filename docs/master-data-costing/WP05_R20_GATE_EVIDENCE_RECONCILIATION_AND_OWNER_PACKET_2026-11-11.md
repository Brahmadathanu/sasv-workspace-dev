> **SUPERSEDING OWNER DECISIONS — 11 NOV 2026 (R21):** D-1 bounded SEC-A1/A2 source/metadata/isolated evidence **APPROVED** with actual writer behavioural denial **NOT TESTED** and governed future isolated nonproduction follow-up; D-2 six-view closure-critical role/consumer verification path **APPROVED** (catalogue confirmed, effective access unproven); D-4 #24 functional recovery with explicit timing limitation **APPROVED**, 4-second p95 and October non-regression **HOLD**. Read [R21](WP05_R21_OWNER_D1_D2_D4_AND_CRITICAL_VIEW_SUBSET_2026-11-11.md). All below undecided wording is historic decision-packet text. No other R20 item approved; W5-04/W5-06/W5-10 OPEN, programme 6/13.

# WP05 R20 — per-gate evidence reconciliation, minimum path to 7/13, and owner decision packet (11 November 2026)

**Classification: documentation only, no promotion.** Issue [#282](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/282) (part B); related [#273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273) and WP05 tracker [#267](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/267). **WP05 OPEN; formal programme 6/13.** Nothing here approves, performs or proposes a production action: no migration, grant, role or permission change, writer-denial RPC, preview call, feature flag, cache bump, deploy or Electron release. Evidence cited is from repository records; where a claim was operator- or owner-reported, it is labelled so.

Sources reconciled: [B1 retained gate ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md) (`3d5d2c2`), [R17](WP05_R17_CSR_SIGNED_IN_IDENTITY_AND_PERFORMANCE_GATE_2026-11-11.md) (`439caac`), [R18](WP05_R18_CSR_PLANNER_OPTIMIZATION_SCREEN_2026-11-11.md) (`3d5d2c2`), [W5-05 owner closure](WP05_W505_OWNER_CLOSURE_WITH_LIMITS_2026-11-11.md) (`a99d4cf`), [formal gate audit](WP05_FORMAL_CLOSURE_GATE_AUDIT_2026-11-08.md) (`dda3b71`), [AE1](WP05_AE1_AUTHENTICATED_EVIDENCE_RECONCILIATION_2026-11-08.md) and [PAR1](WP05_PAR1_S2_S9_REAL_DATA_PARITY_2026-11-08.md) (`87512dd`), [R9 policy](WP05_R9_OWNER_POLICY_DIRECTIONS_ACCEPTED_2026-11-10.md) (`04167f2`) and [R9 historical F](WP05_R9_HISTORICAL_F_RECOVERY_RECONCILIATION_2026-11-10.md) (`b6bc672`), [R8](WP05_R8_SEC_PRM_LIVE_BOUNDARY_AND_OWNER_DECISION_2026-11-10.md) (`c2622a9`), [R3/R4/R5](WP05_R5_DECISION_SEPARATION_AND_LATER_WORKPACK_TRIAGE_2026-11-10.md) (`87512dd`), [W5-06 CONF residual disposition](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md) (`87512dd`). SHAs are the last commit touching each file on `main` `0173e96`.

> **Baseline note.** #282 recorded `main` `439caac` at dispatch. At work start `main` was `0173e96` (adds #283 R18 and an FG-BIT CI change). No Costing-served file changed between them.

## 1. Per-gate table W5-01 … W5-10

Disposition vocabulary is the repository's: **PASS**, **PASS WITH RECORDED LIMITS**, **PARTIAL**, **OPEN**. No row is promoted by this document.

| Gate | Disposition | Credited evidence (SHA / record) | Not credited / limit |
|---|---|---|---|
| **W5-01** Inventory and design | **PASS** | A1–A7 and Tier-1 design acceptance 2 Nov; formal audit `dda3b71` | no re-audit without drift |
| **W5-02** Tier-1 implementation | **PASS (code level)** | PRs #131/#132 (`fc39b1b0`, `86f1c18c`), N1–N4/W6, formal audit `dda3b71`; W6 pin repair `85eae297` | merge ≠ live authenticated pass; source provenance must be cited per build |
| **W5-03** Restricted identity + build | **PARTIAL** | 8 Nov v392 / 72-of-72 hosted assets accepted as WP06 A1 baseline (audit `dda3b71`); v393 Staff Governance live tests (`47170b5d`, W5-06 record `87512dd`); drift readings in section 2 | not accepted as the WP05 baseline; v393 ≠ 72/72; owner ruling **Q-BUILD** unanswered |
| **W5-04** 40-lens functional evidence | **OPEN** | AE1 frozen 13 P / 4 F / 2 NA / 21 NT (`87512dd`); AE2 +14 partial render fragments (not whole-lens P); later recoveries: Scheme Master #224, three CSR functional views, and **#24 Cost Comparison functional recovery via the scoped RPC** (R17 `439caac`: ID-V 3 × HTTP 200, owner saw rows) | **#24 timing: HOLD** (browser 5.75 / 4.08 / 4.37 s unit unstated; edge origin 5386 / 3642 / 3970 ms; no p95; October non-regression absent); historical F #19/#23/#24/#35 frozen (`b6bc672`); 21 NT retained; B1-T1 = 0 lenses transferred |
| **W5-05** Factual run/SKU parity | **PASS WITH RECORDED LIMITS** | Owner closure `a99d4cf`: S2 READY/REVIEW run 149 bounded PASS; SKU 105 NULL/NULL PARTIAL-AS-DESIGNED; S9 Nov run 149 = 121/506/1 of 628, Oct run 143 = 627/0/0; L1 Oct 627/627 selling, 600/627 scheme; Nov run 151 629/629, 601/629 | not a universal parity claim; run 149 ≠ 151; **the B1 ledger snapshot table (line 25) still says PARTIAL — stale, superseded by `a99d4cf`** |
| **W5-06** Authorisation / negative identity / confidentiality | **OPEN (parent)**; two subgates credited | (i) Staff Governance confidentiality release subgate — owner-accepted with residuals 10 Nov (`87512dd`); (ii) **CCC-scoped Cost Comparison RPC read authorisation PASS**: ID-V HTTP 200 ×3; ID-N / ID-X / ID-O HTTP 400 `P0001` `denied:true` 0 rows; grants restored (R17 `439caac`) | SEC-A1/A2 behavioural writer denial not proven (source/MD5 evidence only, R8 `c2622a9`); 49 shared views not hardened; F1 unallowlisted; CSR-only account for Staff Governance NT; single reused account tested sequentially; no token-revocation test |
| **W5-07** Flag control | **PARTIAL** | NAV_GROUPS ON/OFF and Lock Screen inspection (audit `dda3b71`); production global flags OFF; new `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` verified default OFF, exact-`"1"` only, no fallback/retry (R19 tests) | privilege-sensitive LOCK-P01 and specialist client guards; the eleven-flag integrated matrix belongs to WP12 B1-T2 |
| **W5-08** Authority / routes | **PARTIAL** | WP06 C6/O-8, D3, C9, D7 classifications; Q-PRM/Q-ID/Q-VIEW/Q-F1/Q-D3 **directions** approved (R9 `04167f2`); L1 server defect fixed and live-verified | F1 unallowlisted; C5/D5 labelling design/test not done; O-2 route registry; D3 least-privilege contract; directions carry no implementation authority |
| **W5-09** Risk / deferral metadata | **PARTIAL** | PARKED_BACKLOG and A5 C/D inventories; WP12 B1-T2/T3 receiving IDs; consolidated register in section 5 of this record | per-item owner, milestone, residual risk and explicit acceptance incomplete; section 5 is a draft for the owner, not acceptance |
| **W5-10** Owner Gate Status | **OPEN** | — | `WP-05-COSTING-SUITE-RATIONALISATION.md` still `[~] IN PROGRESS`; sign-off only after the above |

**Tally:** PASS / PASS-with-limits: W5-01, W5-02, W5-05 (3 of 10). PARTIAL: W5-03, 07, 08, 09. OPEN: W5-04, W5-06, W5-10.

### Reconciliation findings (documentation discrepancies, no evidence changed)

1. **Stale W5-05 row.** The ledger table still reads PARTIAL although the owner closure `a99d4cf` and the R17/R18 banners record PASS WITH RECORDED LIMITS. This PR corrects that single row and adds a pointer (section 6).
2. **W5-06 scope wording.** R17 is explicit that the CCC-scoped RPC denial is *not* a statement that other shared Costing views deny CSR-only access; ID-O's denial is specific to this CCC-gated function.
3. **#24 is two separate things.** Functional recovery (credited) and 4 s timing (HOLD). R17 and W5-05 closure already say this; the AE1 F row stays frozen.
4. **Evidence class mixing risk.** Sequential permission cases on one reused trial account are real HTTP evidence, but are not simultaneous distinct accounts and not session-revocation evidence.

## 2. Served-source drift since the W5-03 reference point (repository-only, refreshed)

`git diff 85eae297..0173e96` over `public/`: Costing-relevant changes are only `public/shared/js/costing-cost-comparison-read.js` (new, 158 lines), `costing-feature-flags.js` (+13), `costing-suite-shell.js` (+23) — all from `69c0713` (#276, default-off flag) — and `public/sw.js` (+6: FG-BIT network-first entries from #277, **not** Costing). `CACHE_NAME` is still `hub-cache-v393`. This extends the overnight pack's five-file/four-commit finding (`47170b5d`, `cf41740e`, `ff2e79bb`) by this one default-off change. It supports, but does not replace, owner ruling Q-BUILD.

## 3. Minimum remaining independent actions to reach formal 7/13

7/13 requires the owner's signature on `WP-05-COSTING-SUITE-RATIONALISATION.md` (W5-10). The list below is the smallest set that makes that signature defensible. Type: **D** owner decision on existing evidence; **R** repository-only work; **E** new evidence; **S** blocked on the separate server track.

### 3a. WP05-owned (lenses, authority, security)

| # | Gate | Action | Type | Notes |
|---|---|---|---|---|
| 1 | W5-04 | Decide how #24 closes: (a) wait for a server optimisation and 20+ cold and warm samples per period, or (b) accept functional recovery with a **recorded timing limit**, as was done for W5-05 | D (+S for a) | The harness from R19 makes (a) measurable. Frozen AE1 F is not overwritten either way |
| 2 | W5-04 | Group the 21 NT lenses: (i) credit from existing records, (ii) owner-accepted bounded deferral, (iii) genuinely required read-only checks. Do **not** replay all 40 | R then D | AE1 says 15 of 21 are possibly creditable from local D: reports that are not in Git; a worker cannot credit them without a supplied copy |
| 3 | W5-04 | Re-state the four historical F (#19, #23, #24, #35) with exact error, build, identity and later recovery scope | R (mostly done in `b6bc672`) | no promotion |
| 4 | W5-06 | SEC-A1/A2: decide residual acceptance (packet D-1) | D | no production writer probe |
| 5 | W5-06 | 49 shared views: decide closure-critical vs backlog (packet D-2) | D | R5 lane: hardening backlog unless exposure is shown |
| 6 | W5-08 | F1: keep blocked and record deferral owner/milestone, or authorise a static data-grain review (packet D-3) | D | |
| 7 | W5-08 | C5/D5, D3 contract, O-2: record accepted deferrals with owner/milestone (section 5) | D | directions already approved; implementation is not required to sign |
| 8 | W5-03 | Q-BUILD: accept v392 baseline plus the documented v393/default-off drift | D | evidence exists (section 2) |
| 9 | W5-07 | Accept the bounded flag record (NAV_GROUPS, Lock Screen, new RPC flag default-off) for WP05, given WP12 owns the eleven-flag matrix | D | |
| 10 | W5-09 | Convert section 5 into the accepted deferral register (owner, milestone, residual risk, acceptance) | R then D | |
| 11 | W5-10 | Owner sign-off | D | only after 1–10 |

Items 2 and 3 are the only repository work that can proceed without the owner; everything else needs a ruling on evidence already in hand. **Only item 1(a) depends on new technical work.**

### 3b. Already transferred to WP12 (not required for WP05 sign-off)

B1-T2-1/2 (final-build eleven-flag and six-module interactions) and B1-T3-1/2 (final-build cross-module routes/responsive/Electron), accepted by WP12 on 10 Nov. B1-T1 = zero. Executing these is not part of the 7/13 path; WP05 must not claim them, and WP12 must not treat mock-backed suites as final rollout proof.

### 3c. Protected, not to be edited

Historical F #19/#23/#24/#35 and all NT lens rows; the AE1 13 / 4 / 2 / 21 baseline; Nov run 149 vs 151 distinction; the original 5-Nov `57014` and the 11-Nov `500 @ 8.15 s` incident record.

## 4. Owner decision packet (decision-ready, nothing approved here)

**D-1 SEC-A1/A2 residual writer guards.** Facts: live `md5(prosrc)` of the three SEC-A1 internals equals the 4 Nov post-apply hashes (`50712d2c`, `326211fd`, `32077cdd`); the SEC-A2 approval-preview writer equals `9911a0c6`; each requires CCC View **and** Edit; the client hides the Review button and refuses `openPreviewForRun` unless `canEdit()` (R8 `c2622a9`, static inspection). Isolated CI tests exercise negative-permission and Save/Close guard contracts (W5-06 record). **No behavioural negative-role writer-denial PASS exists, and none will be produced against production.**
 *Options:* **A** accept source + metadata + isolated-test evidence as sufficient for WP05, label behavioural denial NOT TESTED with a named later milestone (consistent with Q-ID); **B** require an isolated non-production behavioural harness before sign-off; **C** keep W5-06 open indefinitely. *Assistant recommendation:* A, if the owner is comfortable that the residual is a confirmatory-evidence gap rather than a suspected hole; B if not. Either way, no production writer invocation.

**D-2 49 shared views.** Facts: 49 live-matched; Staff Governance fixed; ten P1 views have possible overexposure but effective-user leakage is not proven; three P1 consumers traced (R4); the Q-VIEW hybrid direction is approved without implementation authority (R9).
 *Options:* **A** classify the broad rewrite as hardening backlog with owner/milestone and a trigger ("exposure shown"), keeping WP05 sign-off independent; **B** make a defined subset of P1 views closure-critical, each needing an exact consumer/column/negative-role contract and separate approval before any change. *Recommendation:* A, with B only for any view where a concrete cross-role exposure is demonstrated read-only.

**D-3 F1 and preview dependencies.** Facts: wrapper/internal source parity verified; underlying `daily_work_log`/route datasets carry sensitive PRM View-level read scope; F1 remains UNALLOWLISTED / NOT EXECUTED (R8).
 *Options:* **A** keep F1 blocked from read-only acceptance; record deferral with owner/milestone; **B** authorise a static data-grain/dependency review (no execution) first. *Recommendation:* B then A if the review finds nothing; no execution either way.

**D-4 Cost Comparison #24 timing** — see 3a item 1. Single choice: (a) wait for measured optimisation or (b) accept with recorded timing limit. R18 rejected two naive rewrites; the keyset-first hypothesis is unauthored, and is the server track's.

**D-5 Q-BUILD** — accept the v392 baseline plus drift in section 2.

**D-6 Accepted deferrals to ratify** (section 5).

*Single most valuable owner response:* answers to D-1, D-2 and D-4, because they decide whether any further evidence-gathering is needed at all.

## 5. Draft consolidated deferral register (for W5-09; **not accepted until the owner says so**)

| Item | Origin | Current state | Proposed owner / milestone | Residual risk |
|---|---|---|---|---|
| C6/O-8 unmapped routes | WP06 | owner-accepted deferral | WP06 backlog | route gaps; no guessed destinations |
| D3 CCC-edit vs MCM-edit | WP06, Q-D3 | distinct authorities preserved | WP05/WP12 contract if workflow needs it | privilege confusion |
| C9 route registry; O-2 server registry | WP06 | accepted / open | owner | stale routes |
| D7 maker-checker policy | WP06 | accepted | owner | — |
| C5/D5 run 80/82 vs as-of | Q-PRM | direction approved | future UI label design/test | ambiguity of two temporal contexts |
| F1 preview RPC | Q-F1 | blocked | D-3 | privileged data exposure |
| CSR-only Staff Governance identity | W5-06 D1 | NOT TESTED, accepted for that release | when a legitimate identity exists | residual untested role |
| Export button visible for restricted staff | #262 | tracked UX hardening | #262 | UX only, no disclosure observed |
| ID-V password rotation / global sign-out | 8 Nov | owner-confirmed, token revocation untested | owner | stale session |
| CSV/export `select('*')` over-collection | R3/R5 | backlog | owner policy | over-collection, not proven leak |
| CDE-2 SQL candidate | formal audit | gated, unapplied, client unconnected | WP12 dependency check | none until applied |
| A14 Windows installer | WP12 | WP12 only | WP12 | — |
| Scheme Master #224 planner reliability | R10 | idx valid but unused; no reliability proof | #224 | historical `57014` may recur |
| Cost Comparison scoped-RPC client modules cache-first in `sw.js` (F-1) | R19 | observed, not fixed | owner decision | stale modules after a later edit |
| Flag-OFF Cost Comparison has no 2000-row truncation notice (F-2) | R19 | observed, not fixed | owner decision | silent truncation on legacy path |

## 6. Edits made to existing records in this PR

Only the stale W5-05 row of the ledger's gate snapshot and a one-line pointer to this document at the top of the ledger. No evidence, count or status elsewhere is changed. **WP05 OPEN; programme 6/13.**


## 7. Post-#292 source-status reconciliation (11 November 2026; additive)

- Source main `342ff80336ff19dc4175e8cbe5fe1fffccd9cf79` from #293 was checked before merge. Exact PR #292 head `554e7bcfea6c905c18a3886b8636e2b43ecd7d7f` passed all five GitHub Actions workflows: confidentiality `43064791773`, CSR verifier `43064791594`, offline costing regression `43064791959`, CSR PWA freshness `43064791774`, FG-BIT `43064791680`; individual jobs successful. Source change five paths: `public/sw.js` (two added Cost Comparison child patterns), R19 note, R19 client contract, focused SW test and focused workflow. #293 was docs-only with no overlapping paths and GitHub reported mergeable.
- #292 was marked ready and squash-merged as `86fddaf3e486f9888f2623163bff81ab9c2122cf`. #290 was closed without merging as superseded. `hub-cache-v393` retained; `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` remains default-OFF; no production SQL/role/grant/permission changes. Existing network-first offline fallback and other routing retained. **This is repository-and-CI evidence, not hosted PWA deployment or authenticated activated-SW acceptance.** R19's original F-1 observation remains historical, now corrected for merged source only. R19 F-2 and F-3 remain open findings.
- W5-04: #24 functional recovery is evidenced, timing 4-second p95 remains **HOLD**; preserve AE1 13 P / 4 F / 2 NA / 21 NT snapshot. Treat missing complete 40-lens evidence separately from proven critical defects; 15 NT have partial later screen fragments, not whole-lens P. Redacted local D: files have not been inspected here. W5-06: CCC-scoped ID-V/N/X/O and restored role grants are already proven; **do not repeat**. SEC-A1/A2 writer behavioral denial is NOT TESTED; no production writer probe. 49 shared views lack complete role-exposure disposition; potential P1 risk is not proven leak. F1 remains unallowlisted.
- **Owner decisions still requested, not presumed accepted:** D-1: accept source/live metadata/isolated guard contracts with behavioural writer-denial NOT TESTED as a named governed deferral (recommended if no concrete contrary evidence), *or* require isolated nonproduction behavioral proof. D-2: defer broad 49-view hardening with owner/milestone and immediate closure-critical escalation of any demonstrated effective-role leak (recommended), *or* nominate exact subset for acceptance. D-4: accept #24 *functional* recovery with explicit 4-second p95 **unproven** timing limit and performance backlog (recommended for programme closure), *or* require measured optimisation before signoff. No decision has been made by this appended record.
- Critical correction means demonstrated unauthorised disclosure, missing authorization guard or wrong functional answer on a closure-critical route; absent operator evidence and unproven p95 are **missing evidence/limits**, not automatically a new critical defect; other identified risks require named owner, milestone and explicit acceptance before W5-10. Keep formal WP05 OPEN / 6 of 13 until owner sign-off.
