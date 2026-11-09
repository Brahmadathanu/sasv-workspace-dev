# WP05 formal closure gate audit — 8 November 2026

**Status: WP05 OPEN; programme 6/13 (46.2%).** This is a documentation-only reconciliation of the existing WP05 evidence and owner-approved WP06 closure. It does not narrow WP05's acceptance contract, authorise production writes or itself close WP05.

## 1. Scope and baseline

Workpack authority: [WP-05-COSTING-SUITE-RATIONALISATION.md](WP-05-COSTING-SUITE-RATIONALISATION.md). WP05 is the **Costing Suite functional rationalisation audit**, not a distinct new database audit. Its approved Tier-1 contract retains six modules, 32 top-level lens IDs, ten PPM workspaces, permissions and RPC authority, LIVE_AS_OF versus run-scoped semantics, and deep links. Tier-2 controller/screen consolidation is **not authorised**.

Audit inventory/design: A1–A7 (six modules, 32 lenses + ten PPM workspaces; not the historical miscount 37), Tier-1 owner design acceptance 2 Nov 2026; P01 readiness usability #132, P02 PRM defect correction #131, navigation N1/N2/N3/N4/W6 implementation merged. Source/test evidence in WP05 workpack and current checkpoint; **merge does not equal live authenticated pass**.

Shared authenticated acceptance contract §8 with **8 Nov A1 amendment**: the *global* 40-lens/11-flag and negative-identity obligations still apply to WP05/WP12; A1 narrows **WP06 only**. Never silently reinterpret WP05 as ten-workspace or declare the broader matrix complete. The owner's WP06 C6/C9/D3/D7 deferrals are documented, but **WP05 security and authority questions are not independently resolved** by WP06 closure.

## 2. Current mandatory gate ledger

| Gate | Credited existing evidence | Current disposition | Minimum remaining proof or owner decision |
|---|---|---|---|
| W5-01 audit inventory and design | WP05 A1–A7, Tier-1 2 Nov approval, distinctions GROUP vs COMBINE | **PASS** | No fresh inventory sweep without drift evidence |
| W5-02 implemented Tier-1 packages, tests and merge | #131/#132 and N1–N4/W6; documented LF/CRLF regression and audited merges | **PASS (code)** | Verify exact source/build provenance for any new signed-in session; no code work invented |
| W5-03 restricted ID-V + build identity | Six module can_view/zero can_edit verified; hosted main v392 / 72 of 72 source assets, earlier 1280/390 evidence; owner accepted this build for WP06 | **PARTIAL for WP05** | Owner separately accepts evidence baseline for WP05; preserve source-parity proof when needed |
| W5-04 full 40-lens and 11-flag six-module matrix | Hosted ID-V run 119 observations and 14-lens classification; targeted NAV_GROUPS ON/OFF 20/20 PPM deep links, six legacy routes; Lock Screen ON one focused run; Scheme Master post-index owner 7-row + 3 refresh passes; CSA visual 4/4 | **OPEN** | Fill exact per-lens/per-flag gaps under shared §8, or seek a **new explicit owner-approved WP05 contract amendment** retaining remaining obligations under WP12; cannot transfer by inference |
| W5-05 factual SKU, period and run parity | Nov readiness build #6 current, 1,793 SKUs/603 operational; October approved 143/November latest successful 149; three CSR read surfaces owner PASS (functional only) | **PARTIAL** | S2: printable versus SKU Cost Details for three real READY/REVIEW/BLOCKED SKUs and same run/cost/status; S9: CCC KPI versus SKU Control after period switch; record actual values, not remembered figures |
| W5-06 read-only authorisation and negative identities | ID-V zero edit observed, network guard no mutating RPC; RM/PM trace explicitly restricted; client SEC-A2 merged | **OPEN for server-denial** | ID-N/ID-X/ID-O negative identity evidence and SEC-A1/SEC-A2 server denial require *separately approved no-side-effect test plan*. No writer RPCs on production solely to prove denial |
| W5-07 control of feature flags | NAV_GROUPS browser-local ON, OFF restore verified; production global flag OFF | **PARTIAL** | Remaining 11-flag test matrix evidence per §8; ensure restoration of all browser overrides, no global activation |
| W5-08 overlapping authority and route dispositions | WP06 accepted C6/O-8 unmapped routes deferred, D3 CCC-edit/MCM-edit semantics preserved, C9 registry, D7 maker-checker policy | **PARTIAL for WP05** | WP05-specific risk acceptance for C5/D5 historical fixed run 80/82 selector, D3 least privilege/security, S2, S9, O-2 server registry and any outstanding A5 findings; no guessing missing destinations |
| W5-09 backlog metadata for every deferral | PARKED_BACKLOG has C6/O-8, D3, C9, D7, F4 and security residual rows with owner, risk and milestone; A5 audit records C1–C9/D1–D10 | **PARTIAL** | Reconcile each WP05-specific unaccepted concern, document ID/behaviour/risk/milestone/owner acceptance; distinguish WP12 from WP05 commitments |
| W5-10 owner Gate Status and final handover | Owner approved final WP06 only; WP05 workpack still says IN PROGRESS | **OPEN** | Only after required evidence and owner decisions, owner explicitly signs `WP-05-COSTING-SUITE-RATIONALISATION.md`; then programme moves 6→7/13 |

## 3. What to test next (minimal no-write wave)

**Priority A — repo-only reconciliation first (no browser needed):** compare the 40-lens runner's available output and 119-observation report with current 14-lens matrix, selector acceptance and source-parity records. Original redacted evidence lives outside Git (on operator D:), so a cloud worker **cannot** claim to inspect it without a supplied copy. Build a 40-lens ledger P/F/NA/NT and flag matrix, credit actual evidence, distinguish *restricted* from passing. Separately inventory unresolved A5 decisions and parked items. Do not replay all forty just to populate a table.

**Priority B — focused owner/read-only real-data UI:** three SKU S2 parity examples (READY, REVIEW, BLOCKED SKU 105 only if it actually meets the historical test contract), S9 CCC period-switch KPI parity, and selector-dependent PRM sub-tabs/drawers only where exact read-safe RPC allowlist and selected context are confirmed. Do not call preview/refresh/approve/decide/accept or unclassified RPC. Record source build, identity, period, run, dates, actual values/screenshots redacted, and network request names.

**Priority C — separate owner security-policy decision:** If existing contract's 40-lens/11-flag and negative server-denial scope materially exceeds WP05 independent rationalisation, owner may approve **new B1 contract amendment** specifically for WP05, with exact transferred WP12 integrated-matrix items and retained WP05-specific authority/SEC tests. Until then, §8 applies literally. **WP06 A1 is not approval of B1**. Design a no-side-effect server denial harness for owner review; NEVER invoke mutating SEC functions on production to test denial.

## 4. Dispositions that must not be smuggled into WP05 closure

- **C5/D5:** PRM fixed run 80/82 contexts are historical fixtures. Label accurately; no latest-run resolver, run selector or replay without new server contract.
- **C6/O-8, D3, C9, D7:** WP06 owner accepted deferrals; WP05 can credit their documented classification but still owns privilege and route governance implications.
- **S2 / S9:** real-data parity not proven by static audit or synthetic preview. Either test with exact compared numbers or expressly seek owner-approved risk deferral with named milestone.
- **CDE-2:** gated candidate with SQL unapplied and client adapter unconnected; neither assumed a prerequisite to *audit* closure nor declared integrated for WP12; determine exact dependency rather than applying automatically.
- **CSR 57014 and Scheme Master #224:** separate historical intermittent read paths. Three owner CSR reads were functional PASS (not a timing result); Scheme Master post-index 3/3 refreshes pass without planner attribution. Do not overwrite failure records.
- **A14 Windows installer** remains WP12 only, unless the owner changes the contract; no Electron release authorised.
- **C drive critically low; D evidence local:** never delete or install automatically. A new Claude Code local session may review redacted 40-lens evidence on D: with operator control; use cloud Claude only for repo-only analysis.

## 5. Exit decision

**Not ready for formal WP05 owner sign-off today.** Main reasons: current shared §8 acceptance obligations and negative identities not fulfilled or re-scoped, S2/S9 data parity and WP05 owner decisions incomplete. This is the smallest credible path to 7/13; no additional functional implementation inferred. Owner sign-off must follow a reconciled evidence package and written decision, not this audit report.

**No production SQL, data, permission, flag, deploy, cache, Electron release or mutation performed by this audit.**

## 6. Addendum — WP05-AE1 evidence reconciliation (8 November 2026)

[WP05_AE1_AUTHENTICATED_EVIDENCE_RECONCILIATION_2026-11-08.md](WP05_AE1_AUTHENTICATED_EVIDENCE_RECONCILIATION_2026-11-08.md) reconciles the 40-lens and 11-flag evidence from repository records only (local D: reports were not accessible and not credited). Result: 40 rows = 13 P / 4 F (historical, owner-reported recovery) / 2 NA / 21 NT (15 possibly creditable from the inaccessible D: report, 6 independently missing/blocked; Staff Governance and Route Family Route Editor reclassified NT/PARTIAL after review R1–R2); flags: one with PPM-only authenticated ON evidence, one with a single focused run, nine with none. **W5-04, W5-05, W5-06 remain as above. WP05 remains OPEN; programme remains 6/13.** No scope amendment or owner decision is recorded by AE1.

## 7. Addendum — WP05-PAR1 S2/S9 parity preflight (8 November 2026)

[WP05_PAR1_S2_S9_REAL_DATA_PARITY_2026-11-08.md](WP05_PAR1_S2_S9_REAL_DATA_PARITY_2026-11-08.md): source preflight complete, no S2/S9 RPC blocker; live parity **NOT TESTED** (no ID-V signed-in context available). W5-05 stays PARTIAL; WP05 remains OPEN; programme remains 6/13.

**Update (8 November 2026, live read-only run):** the PAR1 record section 8 now holds observed results: S2 PASS (two SKUs) and PARTIAL (BLOCKER SKU, costs NULL by design); S9-PARITY PASS for Nov and Oct 2026, on a verified hosted build and a proven view-only ID-V. Evidence only; W5-05 stays PARTIAL pending owner review; WP05 remains OPEN; programme remains 6/13. Finding L1 (Selling/Scheme Policy coverage population scope, historical periods) is recorded in section 8.5.1 of that record as a repository-confirmed defect with live verification pending; it does not invalidate the S9 Readiness/Review/Blocked parity. ID-V password rotation and session revocation remain pending.


## 8. Addendum — owner-confirmed ID-V credential and session cleanup (8 November 2026)

PAR1 §8.8 records the owner-confirmed password rotation and Utilities Hub global sign-out following the completed read-only acceptance run. The temporary storage-state file was deleted and its absence verified. Supabase dashboard **Last sign-in: 8 November 2026, 23:28 IST** is contextual only, not proof of refresh-token revocation. **The sign-out action is owner-confirmed; token revocation has not been independently tested.** This does not satisfy W5-06 negative-identity/server-denial obligations or close WP05. Programme remains **6/13**.

## 9. Addendum — WP05-CLD1 offline closure-acceleration documents (8 November 2026) — PROPOSAL / NOT EXECUTED

Static, repository-only design and decision documents (no SQL, production, auth, code, flag or deployment action): [L1 KPI correction design](WP05_CLD1_L1_KPI_CORRECTION_DESIGN_2026-11-08.md), [security/RPC static audit](WP05_CLD1_SECURITY_RPC_STATIC_AUDIT_2026-11-08.md), [residual reconciliation and owner decision queue](WP05_CLD1_RESIDUAL_RECONCILIATION_AND_OWNER_DECISIONS_2026-11-08.md) (includes an optional **B1 decision template, not approved**). No gate status, owner approval or ledger count in this audit is changed. **WP05 remains OPEN; programme remains 6/13.**


## 10. Addendum — WP05-CLD2 live SELECT-only readback (9 November 2026)

[WP05_CLD2_LIVE_CATALOGUE_READBACK_2026-11-09.md](WP05_CLD2_LIVE_CATALOGUE_READBACK_2026-11-09.md) confirms live L1 CROSS JOIN scope mismatch, frozen snapshot columns and 143/149/151 data grain, live PRM F1/SEC permission-gate definitions, and run-82 workload count 495. **No RPC executed and no DML.** L1 scheme bilateral-selection semantics and preview callees remain unresolved; security negative-identity behaviour not tested. PAR1 run 149 remains historical; current-successful Nov run 151 was selected on 9 November. **WP05 OPEN; 6/13; no gate/owner decision promotion.**

## 11. Addendum — WP05-CLD3 static trace and decision matrix (9 November 2026) — PROPOSAL / NOT EXECUTED

[WP05_CLD3_STATIC_TRACE_2026-11-09.md](WP05_CLD3_STATIC_TRACE_2026-11-09.md) (scheme-policy semantics incl. a run-scoped selected-scheme snapshot, preview/`rpc_get_*` call trees, PRM run-82 zero-row predicates, proposed SELECT-only readbacks) and [WP05_CLD3_OWNER_DECISION_MATRIX_2026-11-09.md](WP05_CLD3_OWNER_DECISION_MATRIX_2026-11-09.md). Repository-only; no SQL, production, auth, code, flag or deployment action. No gate status, owner approval or ledger count is changed; B1 not approved; shared §8 remains binding. **WP05 remains OPEN; programme remains 6/13.**


## 12. Addendum — CLD3 live selected-scheme readback (9 November 2026)

[WP05_CLD3_LIVE_SELECTED_SCHEME_READBACK_2026-11-09.md](WP05_CLD3_LIVE_SELECTED_SCHEME_READBACK_2026-11-09.md) documents SELECT-only verification of selected scheme resolution by frozen run: bilateral RESOLVED **600/627** (Oct 143), **601/628** (Nov 149), **601/629** (Nov 151), with exactly one IK+OK row per SKU in all three. Current-policy 601/629 parity supports S-A as a candidate, not an approved KPI correction. F1 live wrapper/internal metadata confirmed without execution; no runner allowlist expansion or negative-identity PASS. **WP05 OPEN, 6/13; no gate promotion or B1 approval.**


## 13. Addendum — WP05 owner decision-ready closure path (9 November 2026) — PROPOSAL / NOT APPROVED

[WP05_OWNER_DECISION_READY_CLOSURE_PATH_2026-11-09.md](WP05_OWNER_DECISION_READY_CLOSURE_PATH_2026-11-09.md) reconciles W5-01…10, PAR1 S2/S9, live CLD2/CLD3 findings, security and flag obligations, and recommends considering only the narrow B1-T2/T3 transfer to WP12 first (T1 zero rows without enumerated receiver). Original §8 remains binding; all owner rulings PENDING, no evidence class or gate promoted. **WP05 OPEN, programme 6/13.**


## 14. Addendum — owner decisions D1–D3 and pending B1/security plans (9 November 2026)

The owner explicitly agreed to three recommendations in chat: **[D1](WP05_OWNER_DECISIONS_2026-11-09.md)** to prepare narrow Option B (B1 final text remains **NOT APPROVED**), **D2** to accept bounded S2/S9 factual parity evidence with BLOCKER SKU 105 remaining PARTIAL, and **D3** to prepare—but **NOT execute**—a no-side-effect negative-identity/SEC plan. Drafts: [B1 amendment for review](WP05_B1_NARROW_AMENDMENT_DRAFT_2026-11-09.md) and [security verification plan](WP05_NO_SIDE_EFFECT_SECURITY_PLAN_DRAFT_2026-11-09.md). The original §8 remains binding. S2/S9 sub-obligation owner-accepted; W5-05 as a whole remains PARTIAL pending full gate reconciliation. **No security behavioural evidence credited, B1 transfer effected, or WP05 gate status promoted. WP05 OPEN, 6/13; AE1 unchanged.**


## 15. Addendum — targeted W5-06 security catalogue readback (9 November 2026)

[WP05_W506_TARGETED_SECURITY_CATALOGUE_2026-11-09.md](WP05_W506_TARGETED_SECURITY_CATALOGUE_2026-11-09.md) records **SELECT-only** live public-wrapper and internal-delegate signatures/ACLs, CCC-edit guards, and confirmation that `rpc_costing_preview_approval_impact` writes an acknowledgement. No RPC or identity-based denial test was executed. A direct `authenticated` EXECUTE grant on one internal-source material-review function is flagged for governance review, not described as a demonstrated bypass. **W5-06 remains OPEN**, B1 pending, WP05 OPEN, programme 6/13.


## 16. Addendum — W5-06 shared-view authority and negative-identity expectation matrix (9 November 2026)

[WP05_W506_SHARED_VIEW_AUTHORITY_AND_IDENTITY_MATRIX_2026-11-09.md](WP05_W506_SHARED_VIEW_AUTHORITY_AND_IDENTITY_MATRIX_2026-11-09.md) records SELECT-only metadata: **49 shared-helper gated costing views; 48 with PostgreSQL authenticated SELECT, zero with anon SELECT**, including four staff/personnel-related view names for sensitivity review; one RM-line trace view lacks authenticated SELECT. Separately, `authenticated` has costing-schema USAGE plus EXECUTE on the guarded internal-source acceptance function, without any observed bypass. The live shared helper is any-one-of-four module view grants; ID-O therefore cannot be presumed universally denied on all cross-module view reads. **No view rows, RPC or negative identity executed.** Correct per-view/role policy remains owner-decision pending; W5-06 OPEN, B1 draft only, WP05 OPEN, 6/13.


## 17. Addendum — 49-view column sensitivity and consumer inventory (9 November 2026)

[WP05_W506_49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY_2026-11-09.md](WP05_W506_49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY_2026-11-09.md) records metadata-only column review for all **49** shared-helper costing views, plus repository-backed and provisional client ownership. Individual salary fields (`basic_salary`, allowances, total salary) and `staff_details` in CBM staff views are verified **column names**, not queried values; provider-rate, trace, actor-audit views need scoped business policy decisions. **No per-view hardening yet approved and no access changes applied.** W5-06 OPEN, WP05 OPEN, 6/13; B1 draft only.
