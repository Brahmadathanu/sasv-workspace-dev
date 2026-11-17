# WP10 G2/CL15/RM1 — checksum-pinned atomic candidate and rollback (REVIEW ONLY)

**17 November 2026 IST | Owner approval for engineering/testing only | NOT A PRODUCTION MIGRATION**

## Purpose and current status

The existing Route Family Management system already has permission-checked approval, immutable history, effective-date constraints and approved route validation. Live read-only canonical route checks found **455/455 currently active-SKU products valid** (and 455/455 at +7/+30 days for the *same* cohort), including 100 subgroup-inherited. The purpose here is **preventive continuity on cross-table mapping mutations**, not repairing damaged live routes.

The following **unapplied source files** are bundled in exactly this order:
1. Historical proposal `docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/05_product_route_impact_guard.sql`.
2. `scripts/wp10-g2-safeguards/review-only-activation-parent-lock-PROPOSAL.sql` (CL15).
3. `scripts/wp10-g2-safeguards/review-only-rm1-mapping-impact-PROTOTYPE.sql` (current + newly-approved future-date continuity).
4. `scripts/wp10-g2-safeguards/review-only-rm1-subgroup-inactivation-reason-contract.sql` (new 3-arg wrapper and private write-once-by-trigger reason register; preserves the existing 2-arg RPC).

**Install source generator:** `node scripts/wp10-g2-safeguards/gen-unified-05-cl15-rm1-review.mjs --manifest`. Output in raw SQL mode has **one explicit BEGIN/COMMIT**. Each component's original source SHA-256 and the generated full SQL SHA-256 are deterministic. Use the **exact GitHub commit SHA plus generator manifest**, not a guessed or manually concatenated SQL payload. CI runs its `--check` and an isolated PostgreSQL actual-install test. This generator **does not execute SQL, modify migration history, or use Supabase credentials**.

**Reverse-order rollback generator:** `node scripts/wp10-g2-safeguards/gen-unified-05-cl15-rm1-rollback-review.mjs --manifest`. Its three source steps drop (a) the compatibility 3-arg function under exact definition-receipt guard, (b) the three RM1 mapping impact triggers and helper, and (c) the original 05 + CL15 impact/parent-lock triggers and helpers under their own definition receipts, all within one transaction. **It never drops the private reason-audit table, its records, or its immutability trigger.** The existing governed two-argument RPC and Phase1 01/02/03/06 remain installed. Rollback is **not** a client rollback: clients continuing to send the new 3-argument RPC will fail afterwards. Client contingency is a separate gate.

## Independent safety tests and evidence

- Existing controls: 05+CL15 race tests; product/subgroup/group map impact, new approval and direct approved INSERT, approval-shadowing precedence, currently valid replacement, 2-session concurrency, current + future effective dates.
- Observed max fan-out: 41 active products under one subgroup mapping, tested with true fixture lifecycle SKU activation. Test is *not* a production throughput SLO.
- 3-arg audited reason wrapper and permission negative; old 2-arg EXECUTE retained, and tested reason-bypass remains open.
- Private reason audit refuses UPDATE and DELETE, including a deliberately tampering privileged fixture actor. Its table is retained after wrapper rollback (no historical reason data deletion).
- Unified install test checks four-component atomic install, six expected cross-table triggers, harmful route-change veto, safe audited fallback, reverse-order receipt rollback, surviving audit record and audit immutability.
- Missing governed base 2-arg RPC is a **fail-closed full-transaction install** condition (no partial 05/CL15/RM1 objects). Source generator self-checks output transaction count.
- **All evidence from disposable PostgreSQL and mocked Chromium is lower than signed-in, real production-role acceptance.** Do not report a passing application or Windows/Electron release from CI alone.

## Deployment STOP gates (no waiver from this document)

1. **Actual server preflight, read-only, exact current live hashes:** canonical validators, all governed mapping and route writers, existing triggers, grants, RLS, route-family approval status; unexpected drift or existing candidate objects means stop. Count active affected-product baseline and verify safe lock performance for the observed fan-out (plus worst-case future growth).
2. **Independent SQL/security review:** user role/permission and SECURITY DEFINER search path, 05+CL15 lock order, RM1 mapping IN/OUT transitions, future cutover, function audit behavior, 3-arg RPC exposure and PostgREST schema cache; check role-specific denial with no writer calls against production. Source hash and PostgreSQL extension/version compatible.
3. **Unresolved legacy-client decision:** old 2-arg inactivation remains executable by authenticated roles, so the optional reason is **not compulsory across all callers**. Inventory installed Electron fleet and third-party consumers; separately decide between compatibility phase and eventual governed permission revoke. Do not silently revoke, drop, or falsely assert compulsory reason governance.
4. **Unresolved separate writer domains:** current proposed mapping triggers do not cover Route Family lifecycle, route-version/step changes, product-route override edits and direct public.sub_groups.product_group_id mutation (authenticated table-level UPDATE + sign-in-only RLS), all potentially route-dependent. They require a bounded risk conclusion before claiming **global** route invariance.
5. **Historical G2/CI-032:** already known since 20 Oct; 7 overlapping product and 10 family approved/superseded route pairs. Do **not** expand historical resolver status eligibility or touch frozen-costing snapshot attribution in this package.
6. **Owner-authorised live installation and rollback:** must name the exact generated SHA-256, staged live preflight and tested rollback receipt, expected client fallback, expected lock/timeout behavior and maintenance window. A general “go ahead/proceed” is **not** that named authorisation. No production role/flag/DDL or `main` merge by default.
7. **WP11/WP12 independent acceptance:** real signed-in PM BOM narrow layout and SKU contrast, Editor/View/No-access privacy, feature flag OFF/ON/OFF, PWA freshness and packaged Windows Electron NSIS/ZIP parity remain separate and must not be marked PASS by these backend fixtures.

## Disposition

Package is **REVIEW-ONLY, UNAPPLIED**, not ready for an unconditional production installation or for WP10 closure. [Draft PR #463](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/463), [issue #464](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/464) and the existing [G2/CI-032 reconciliation](WP10_RM1_G2_CI032_HISTORICAL_ROUTE_RECONCILIATION_2026-11-17.md) remain authoritative. Formal programme: **10/13 closed, WP10–WP12 open**.
