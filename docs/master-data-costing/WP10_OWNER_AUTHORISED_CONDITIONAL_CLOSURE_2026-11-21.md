# WP10 — owner-authorised conditional formal closure (21 November 2026 IST)

**OWNER DECISION: WP10 CLOSED CONDITIONALLY.** The owner explicitly replied "I approve and please proceed" to the proposed bounded WP10 closure after accepting the remaining documented testing limitations and transfer of relevant verification to WP12. **Formal programme: 12/13 CLOSED** (WP00–WP11); **WP12 remains OPEN**. This is a governance status decision; no SQL, source, role, feature flag, business data or release was changed by the closure record.

## Verified completion
- Classification system Stage A applied on 18 November: four public masters' policies require canonical View **and** Edit for direct writes; provisioned-user SELECT; exact state-aware migration `20261118161406_wp10_four_master_stage_a_state_reconciliation` registered and independently checked.
- Stage B performed with **separate explicit owner approval** on 21 November: production migration `20261121094820_wp10_four_master_stage_b_revoke_authenticated_direct_dml`. `authenticated` INSERT/UPDATE/DELETE on `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups` revoked (12/12 privileges false), SELECT retained. Independent read-only live postflight passed, four Stage A policy sets intact; 12 governed `rpc_wp10_*` remain authenticated EXECUTE/anon denied.
- Owner confirmed **every managed staff machine** is installed on SASV Workspace **v6.2.0**. The published release source `ebb59a4954b245bc7912e9872682d440f318f6ed` contains all 12 governed-RPC classification writers. Private ASAR binary hashes were **not** separately collected.
- After Stage B, the owner directly reported **Editor PASS**, **View-only PASS**, **No-access PASS** in installed app. No-access account: classification modules were **not displayed** in navigation. Owner observations are credited within that exact scope; they are not an independently recorded login/JWT.
- Independent non-identity database permission aggregate: 1 classification Editor (View+Edit in at least one of four targets), 3 users with classification View and no classification Edit, 0 Edit-without-View. This cannot prove which JWT account was used for the owner’s UI check.

## Explicit owner-accepted residuals and receiving
| Residual | Classification | Receiver / next milestone |
| --- | --- | --- |
| Genuine No-access direct-URL/deep-link denial (not just hidden navigation) | **NOT TESTED; accepted as residual, NOT PASS** | WP12 real-role security receiving, using an already permitted session |
| Real-JWT Editor positive / View-only and No-access RPC writer denials | **NOT TESTED; accepted as residual, NOT PASS** | WP12 genuine role receiving; use isolated disposable data for positive writes, not production master records |
| Per-installed-ASAR SHA-256 comparison to approved release | **NOT TESTED; accepted as residual, NOT PASS** | Installed Windows provenance/maintenance acceptance at next applicable packaged release milestone; not a reason to roll back the owner-accepted v6.2.0 fleet |
| WP10 optional 04/05/CL15 product/first-SKU concurrency guards; optional SQL PR #463 | **NOT APPLIED; separately governed** | Existing explicit proposals and owner decisions; not included in this closure and never implicitly authorised |

Any genuine confidentiality breach, unlawful role bypass, or functional regression is a **stop-the-line defect**, not an owner-accepted waiver. Do not weaken or re-GRANT authenticated direct DML without separate security incident approval. Keep related work under proper ownership; transferring evidence does not turn NOT TESTED into PASS.

## Authority and scope
The owner’s conditional closure followed the three staff-reported PASS observations, the Stage A/B deployed receipts and exact residual statement. WP10 is no longer a general release HOLD based on the old direct-DML gap: that gap was resolved in catalog. **WP12 remains independently open** for its six-module, seven sensitive-view, Cost Comparison performance, flags/runtime and remaining authorised role tests.

The already-published **v6.2.0** Electron release is not reversed and no new release is authorised here. Draft PRs #476/#477/#471/#463 remain under independent source/merge governance; this closure does **not** approve merging stale Stage A SQL or repeating migrations. No other workpack closure is inferred.

## Sources and provenance
- Production: `docs/master-data-costing/WP10_STAGE_B_PRODUCTION_CUTOVER_RECEIPT_2026-11-21.md` (draft PR #476 branch).
- Staff role and residual evidence: `docs/master-data-costing/WP10_STAGE_B_OWNER_ROLE_ACCEPTANCE_AND_CLOSURE_DECISION_2026-11-21.md` (draft PR #476 branch).
- Stage A migration receipt: `docs/master-data-costing/WP10_STAGE_A_MIGRATION_HISTORY_REGISTERED_RECEIPT_2026-11-19.md` (draft PR #477 branch).
- Latest programme handover: draft PR #491, dated 20 November, historically states 11/13; this receipt supersedes that historical status.

**Next workflow priority: WP12 ONLY.** Storage optimization/Selected Scheme Viability and repository cleanup remain parked until WP12 closure decision.
