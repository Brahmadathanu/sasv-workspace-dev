# WP05 R47 — Authenticated six-view acceptance and shortest closure runway (12 November 2026)

**ACCEPTANCE PROCEDURE READY. NO NEW LIVE USER-SESSION TEST HAS BEEN PERFORMED.** Six selected D-2 reader-policy database corrections are applied and catalogue-verified (R34, R40, R43, R46). This is not W5-06 or WP05 closure. Scheme History was previously owner-confirmed visible (R37), not an independently captured permission trace. Formal WP05 remains 6/13 and technical stage 4/7.

## Live six-view implementation facts

| View | Authorized ordinary reader | Live exact definition MD5 |
|---|---|---|
| v_costing_scheme_master_audit | PPM View | e2b9eb3c1b86d073183cd376f704cf58 |
| v_costing_material_manual_rate_register | MCM View | 38b4262bfae719ca3f736185784fd047 |
| v_costing_material_manual_rate_history | MCM View | 01029a39e47a300aa7860d17b2f39cae |
| v_costing_material_review_acceptance_register | CCC or MCM View | 0dcc3db262a30a9b770720dcb48e6376 |
| v_costing_pricing_sku_detailed_cost_sheet | CSR or CCC View | 4faaae56558dddbc3b418146f2ab8c59 |
| v_costing_pricing_cost_sheet_line_traceability | CSR View only | 800a546b711a9658e9f81a58b6e78303 |

The live catalogue confirms predicates and original output/ACL contracts; actual signed-in user separation is NOT TESTED. Previous isolated PostgreSQL fixture tests are not a substitute.

## First positive browser check: existing CSR + CCC View identity

The latest aggregate canonical permission inventory: three permission-record groups have CSR and CCC View together; none have CSR without CCC or CCC without CSR; one has another Costing/PPM View without either. These are NOT proof of active user sessions or effective inherited permissions. Never impersonate, alter staff permissions, create test accounts, or use administrative SQL as a signed-in actor.

1. In the normal signed-in SASV PWA using an **existing authorized CSR+CCC user**, choose a period and SKU already known to have a populated detailed Cost Sheet.
2. Open the SKU and detailed Cost Sheet. Confirm that actual **detailed cost and section fields** render, not only the overview/list row. The shared source reader in costing-suite-shell.js returns the original row when the detail query returns no records; a visible overview alone does NOT prove successful detailed read.
3. Open **line explanation/traceability** on a populated Cost Sheet line. Verify an actual explanation/evidence section appears; dialog opening alone is insufficient.
4. Record only four non-sensitive outcomes: normal signed-in PWA yes/no; known populated data yes/no; detailed SKU result **populated/empty/error**; line evidence result **populated/empty/error**. The owner may additionally report date and displayed build identifier. **Do not share SKU IDs, cost amounts, vendor/source data, trace JSON, personnel IDs, JWTs, request headers or data-rich screenshots.**
5. Two populated results are a meaningful owner-observed POSITIVE for a **mixed CSR+CCC role**. They do NOT prove CCC-only line trace denial or CSR-only access. Empty or HTTP 200 returning [] is INCONCLUSIVE because view-denied and legitimate empty source may look identical. Client error is FAIL/INVESTIGATE.
6. No CCC-only or CSR-only permission-record group currently exists; do not manufacture one to claim proof. Isolated PostgreSQL role matrix supports intended design, but live negative remains NOT TESTED.
7. If a legitimately existing user with neither CSR nor CCC View is separately available, an owner-supervised read-only negative may be observed without changing roles; this cannot be labelled CCC-only negative.

## Second optional positive observation: MCM

An existing authorised MCM View normal session may open Manual Rate Manager Register, bulk History, and known-item History. Record only **populated/empty/error** for each, no supplier/rate/actor material. Material Review Acceptance register is also read by the MCM client; confirming its existing workflow is worthwhile. Prior aggregate permission inventory found MCM+other View records but no MCM-only ones. Keep role-conditional test labels accurate.

## WP05 final path (do not reopen completed gates by default)

- W5-01 design, W5-02 implementation: PASS at code/design level.
- W5-05 factual SKU/run parity: **PASS WITH RECORDED LIMITS** (11 Nov owner closure). Preserve, don't silently reopen.
- W5-03 build/identity: the historic v392 72/72 acceptance does not establish all current v393/main client assets; reconcile changed served files and verified build.
- W5-04: AE1 historic 40-lens 13 PASS / 4 historical FAIL / 2 restricted NA / 21 NOT TESTED; credit later targeted recoveries separately and list exact remaining critical, safe reads.
- W5-06: accepted scoped Staff Governance confidentiality subgate plus six production D-2 view corrections; real effective user authorization, negative actor tests and parent SEC-A1/A2 still require sound disposition.
- W5-07: WP05-specific flag/LOCK-P01 controls remain partial; broader B1 11-flag interactions transferred to WP12.
- W5-08: authoritative routes, F1 safe-preview contract, C5/D5 run semantics and L1 recorded limits require risk/owner classification without invoking unknown writer calls.
- W5-09: exact deferral issue, owner, milestone, receiving workpack and residual risk metadata incomplete.
- W5-10: **not signed**, must not advance from formal 6/13 to 7/13 without owner acceptance.
- D-1 real writer-denial execution: **NOT TESTED** under intentional prior owner safe no-call governance. Do NOT casually invoke real writer RPCs.
- D-4 Cost Comparison p95 four-second objective: **HOLD**, not performance PASS.
- WP12 B1-T2/T3 received; B1-T1 individual WP05 lens coverage remains WP05-owned.

**Next independent package:** reconcile exact W5-03–09 source/build/version scoped evidence, historical failures and unresolved critical lens reads. Focus on one small set of read-only browser observations rather than all 40 lenses. Any owner final signature requires explicit unresolved risk disposition.

No production SQL, user permission changes, account creation, client deployment, sensitive row reads or actual hosted browser actions were undertaken for R47.
