# WP05 — owner decision-ready closure path (9 November 2026)

**STATUS: PROPOSAL ONLY — NOT APPROVED / NOT EXECUTED. WP05 OPEN; programme 6/13.** This note reconciles the original acceptance contract, merged AE1/AE2/PAR1 and CLD1–CLD3 evidence, and owner-approved WP06 amendment A1. It is a decision aid, **not** WP05 sign-off, B1 approval, a new lens PASS, or authorisation to execute security tests, preview RPCs, SQL writes, migrations, flags or releases. Authority: tracking issue #234 and `WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md` §§3–10.

## 1. Binding rule and accepted baseline

The original shared §8 remains **binding on WP05** unless the owner explicitly approves a separate amendment B1. A1 narrows **WP06 only**, not WP05. The §8 closure requirements include a verified owner-authorised build, restricted ID-V, 40-lens P/F/NA/NT matrix with no unexplained F, real-data checks, zero mutating requests, flag restoration, accepted documented residual risks, and owner sign-off. §3 defines eleven default-OFF flags and the separate ON modes. WP12 separately owns integrated acceptance and Windows A14.

**Frozen baseline (do not reclassify by inference):** AE1's forty entries = **13 P / 4 historical F / 2 restricted NA / 21 NT**. AE2's fourteen additional `RD-v391/OFF` render/data-presence sub-observations are not whole-lens PASS. Historical F are Scheme Master (#224 57014), Printable Cost Sheet (57014), Cost Comparison (57014), Production Cost Centres (unknown RPC): keep them historically failing, with separate later recovery records; do not overwrite. The two NA are restricted RM/PM trace lenses for ID-V, not data-path successes.

**Accepted evidence bounded by tested source:** PAR1 on ID-V served v392, 72/72 source assets verified, all flags OFF: S2 READY and REVIEW_REQUIRED examples MATCH, BLOCKER SKU 105 **PARTIAL** (NULL costs on both sides, matching status/run/MRP); S9 Nov **run 149**, 121/506/1 of 628, and Oct approved **run 143**, 627/0/0 of 627, parity PASS as guarded client-view reads plus UI observation at 1280/390, **not individual SKU click-through**. Nov `v_current_successful_costing_refresh_run` later advanced to run **151** / valuation 2026-11-09 / 629 SKUs; this does not rewrite PAR1's prior run. L1 current-policy `CROSS JOIN` historical KPI defect is live-confirmed but separate from S9 readiness/review/blocker parity.

**Security provenance:** ID-V password rotation and Utilities Hub global sign-out are **owner-confirmed**, file absent, refresh-token invalidation not independently proved. Live catalogue confirms CCC-edit checks in inspected SEC-A1/A2 functions and PRM-view F1 wrapper, **not negative-identity behavioural server denial**. The costing view helper permits reads if a user can view any one of CCC/CBM/CSR/MCM; TB2 documents 49 gated views. Security classification and least privilege remain open. Preview functions are not approved/allowlisted merely because a bounded static scan found no writes.

## 2. Gate-by-gate closure dependencies (no promotion in this document)

| Gate | Current recorded gate | Concrete closure action / evidence still missing | Can avoid PC? |
|---|---|---|---|
| W5-01 Inventory/design | PASS | None absent material drift | Yes |
| W5-02 Tier-1 implementation | PASS (code) | Preserve hashes and test baselines; reverify served build if new UI testing | Yes |
| W5-03 ID-V/build identity | PARTIAL | Owner decision to accept verified v392 72/72 as WP05 baseline, with its exact tested source/identity and newer-client drift caveat | Owner decision, no PC |
| W5-04 40-lens matrix | OPEN | Classify all 21 NT and 4 historical F with exact proofs or a **written B1** that transfers only enumerated integration obligations; required PRM safety and critical lens gaps remain WP05 | Local D evidence needed only if crediting it; otherwise cloud/owner choice |
| W5-05 S2/S9 factual parity | PARTIAL | Owner explicitly accept two S2 MATCH, SKU 105 NULL-as-designed PARTIAL, and two run-scoped S9 PASS with UI-click limitation; decide whether these meet gate scope or require a targeted third comparable blocked SKU (if one exists) | Owner decision |
| W5-06 negative identities/SEC | OPEN | Separately approved no-side-effect proof plan for ID-N, ID-X, ID-O; catalogue/ACL checks and safe read-only denial; writer-denial **must not be proved by firing writers in production** | Catalogue yes; authenticated behaviour may require owner-controlled environment |
| W5-07 flag control | PARTIAL | Per shared §3/§8 integrated flag coverage or B1's exact enumerated transfer; restore all browser overrides OFF, no global activation | Local/browser if testing; no for drafting |
| W5-08 authority/route | PARTIAL | D3 CCC vs MCM edit governance, C5/D5 fixed run 80/82 + moving as-of, C6/O-8, O-2 route registry, F1/preview safety, outstanding A5 items: explicit disposition | Owner decision; some catalogue |
| W5-09 deferment ledger | PARTIAL | For each deferral record exact ID, behaviour, evidence, risk, named milestone, receiving WP12 acceptance (if transferred), and owner approval | No |
| W5-10 owner final sign-off | OPEN | Only after W5-03…09 criteria/decisions satisfied: owner signs `WP-05-COSTING-SUITE-RATIONALISATION.md` Gate Status; **then**, and not before, programme 6→7/13 | Owner only |

## 3. Two legitimate routes — decision remains PENDING

**Route A: retain original §8 for WP05 (default; no amendment).** Complete 40-lens and 11-flag evidence, negative identities and authority checks before WP05 sign-off. Preserves maximal acceptance but repeats some integrated WP12 work and requires more authenticated browser/evidence time. This is the only currently binding route.

**Route B: approve a narrow B1 amendment (recommended for consideration, not granted).** Keep **WP05-specific functional correctness and security** under WP05, and transfer **only repeated integrated breadth** to WP12. Proposed transfer candidates:
- **B1-T1:** matrix-wide repeated render/responsive/deep-link checks on low-risk lenses already unambiguously classified at an accepted source build, *but only when an exact list of IDs and source-linked evidence is attached*. No blanket movement of 21 NT; partial, restricted, failed and server-unsafe rows cannot be relabelled pass. Without a named list, **T1 transfers zero rows**.
- **B1-T2:** the remaining cross-module ON/OFF interaction sweep for eleven flags (incl. all-ON) to WP12 final integrated acceptance. WP05 must still prove the specific privilege-sensitive guards it implemented (e.g. LOCK-P01) and safe default-OFF/restore behaviour. Historical v391 ALL_ON 2/12 failures are retained and require targeted resolution or explicit owner residual-risk acceptance; they are not erased.
- **B1-T3:** broad six-module deep-link/responsive compatibility rerun on the final release build to WP12, *not* unresolved functional wiring, unclassified preview RPCs or C5/D5 fixed-run semantics.
- **B1 receiving gate:** a named WP12 issue/workpack paragraph must enumerate every transferred test, expected client/version/flag state, evidence requirement and acceptance **before rollout**. WP05 cannot sign off until that receiver is recorded and the owner accepts the risk.

**Mandatory WP05 retention even under B1:** W5-06 negative identity/SEC writer-denial policy and view-gate breadth; D3 CCC/MCM authority; F1/preview no-side-effect authority; real-data S2/S9 limits; Staff 7/42 explanation and sub-tab disposition; historical Scheme/CSR/PRM failures; cost/routing integrity; exact-run 80/82 and moving-as-of semantics; observed L1 defect with named remediation owner/milestone; trace-role restricted expected NA; 40-row inventory and honest P/F/NA/NT labels. **B1 cannot turn NT into P, F into P, or a proposed readback into a test result.**

**Recommendation:** take *only* B1-T2 and B1-T3 forward for owner consideration first, because WP12 already has explicit integrated acceptance responsibility. Keep T1 unapproved until a row-by-row ID list establishes the transfer has no functional/security hole. Do not adopt any part of B1 through this document; all routes remain optional pending explicit owner response.

## 4. Smallest remaining proof waves, ordered by risk and cost

| Wave | Strict scope | Acceptance evidence / stopping condition | Owner intervention |
|---|---|---|---|
| **P0 — security decision** | Catalogue/repo/metadata only: verify view-gate policy and function ACLs; draft ID-N/ID-X/ID-O **read-only** negative-identity plan and SEC-A1/A2 denial argument; independent reviewer approves specific per-function routes | Exact identities, target grants, expected denial response, no mutating endpoint, permitted method; any unresolved SECURITY DEFINER scope stays OPEN | Owner approves plan before behavioural testing |
| **P1 — owner factual decisions** | Accept PAR1's bounded S2/S9 as recorded, Staff 7/42 period-filter explanation, PRM run-82 zero as `UNCLASSIFIED`, and L1 frozen-run data findings. These are *classifications*, not a schema fix | Owner decision ledger; no silent 7/13 | One written decision |
| **P2 — targeted UI only if required** | Source-verified ID-V on chosen build; test only mandatory uncredited functional rows and historical F recovery (e.g. #224, CSR, PRM Cost Centres) with safe reader paths. Do not rerun 40 by default; no preview/unknown call | Per-lens actual timing/rows/error/network names, two widths, flag state and screenshots; stop on blocked request; never edit roles | PC/browser only if no equivalent authorised cloud execution exists |
| **P3 — F1/PRM** | Compare live body and all transitive callees with repository definitions before **any** per-signature allowlist consideration; run-82 bounded candidate-count funnel at historical/current as-of with separately reviewed SELECTs | Live body parity, no-side-effect proof by independent reviewer; map/foundation source-count disposition. No preview called by default | Owner approval only if new readbacks/behaviour proposed |
| **P4 — implementation separate from closure** | L1 historical coverage server correction only after owner confirms frozen valuation semantics; selling-policy snapshot + bilateral selected-scheme `RESOLVED_POLICY` are strong live-data-supported candidates (run 143 600/627; 149 601/628; 151 601/629), not an approved migration | Separate versioned migration PR, before/after comparisons, permission preservation, rollback plan; no automatic deploy | Explicit later implementation approval |
| **P5 — final** | Reconcile gate ledger, deferrals and B1 (if adopted); produce owner-signable WP05 handover | Only when all retained gates satisfied; verify WP12 receive items | Explicit owner sign-off |

A key economy: do **not** block a documentation audit on a speculative L1 implementation or a complete new client rebuild. But also do **not** use audit status to bless unsafe RPCs or unproved privileges.

## 5. Exact owner decision register (all PENDING)

| Decision ID | Proposed ruling for owner consideration | What the ruling does **not** imply |
|---|---|---|
| **D-W5-03** | Accept the verified v392 72/72 ID-V source baseline for WP05 *at the tested source only* | No new served build/provenance claim |
| **D-W5-05** | Accept S2 two PASS plus one BLOCKER-design PARTIAL and S9 two PASS as bounded factual parity evidence; retain known UI click-through limit | Not a universal 40-lens PASS or L1 policy-card correction |
| **D-STAFF** | Accept 7 vs 42 as explained by selected-month filter, retain lens NT/PARTIAL until all sub-tabs accounted | No whole-lens promotion |
| **D-C5** | Preserve fixed run 80/82 contracts and as-of-current-day drift; zero candidate reviews remain unclassified | No invented selector, missing data claim, or RPC PASS |
| **D-L1** | Define historical policy coverage at frozen valuation date using explicit policy resolution (IK+OK for schemes), subject to exact resolver equivalence check; proceed later via separate controlled fix | No SQL/migration approval |
| **D-F1** | Accept static analysis as limited evidence only; hold preview functions denied until live callee/grain verification | No execution/allowlist authority |
| **D-SEC** | Authorise preparing a separate no-side-effect negative-identity test plan (not its execution); recognise live CCC edit checks and broader shared view gate | No behavioural server denial PASS |
| **D-B1** | Choose Route A, or approve/amend a *fully enumerated* Route B transfer with named WP12 receiver; recommended first consider T2/T3 only | Does not close W5-06 or change AE1 ledger |
| **D-DEFERRALS** | Preserve #224 monitoring, CSR timeout history, C6/O8, D3, D7, CDE-2 and A14 with owners/milestones; do not automatically implement | No waiver or silent acceptance of unresolved risks |

**No owner ruling is recorded by this file.** To enact a ruling, require an explicit owner message referencing decision IDs, risk wording and (for B1) exact transferable matrix rows + WP12 receipt. Decision state becomes APPROVED only after that act and corresponding governed documentation review.

## 6. Authorisation boundary

This proposal authorises **nothing** beyond documentation review. No Supabase calls, SQL, preview/refresh/approve/save RPC, production mutation, role/auth change, grant update, account/session operation, feature toggle, deployment or Electron build. The user may choose to delegate repository-only preparations to cloud Claude; it does not confer authority for live/privileged actions. No new acceptance test was run as part of this document.

**WP05 remains OPEN; programme completion stays 6/13; AE1 13 P / 4 historical F / 2 restricted NA / 21 NT unchanged.**
