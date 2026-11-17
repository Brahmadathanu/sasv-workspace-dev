# WP10 — four-master legacy Electron DML compatibility and safe-cutover assessment

**17 November 2026 — READ-ONLY SOURCE + CATALOG RECEIPT. No production DDL/GRANT/REVOKE, no master-data writer and no account modification.**

## Executive classification

- **Confirmed current database design gap:** On production Supabase, `public.categories`, `sub_categories`, `product_groups` and `sub_groups` all grant `authenticated` INSERT, UPDATE and DELETE; each broad `ALL` RLS policy has `USING` and `WITH CHECK` checking only `auth.uid() IS NOT NULL`. See [live catalog audit](WP10_LIVE_FOUR_MASTER_DIRECT_DML_SECURITY_AUDIT_2026-11-17.md).
- **Confirmed historically shipped source dependency:** The four root Electron classification management scripts **before** PR #445 wrote directly to these exact tables using Supabase `.insert()`, `.update()`, `.delete()`. The old source can still function against the current permissions. The repository alone does **not** prove which old versions are actively installed today.
- **Confirmed current main-source replacement:** The same four updated scripts use `rpc_wp10_create_*`, `rpc_wp10_rename_*` and `rpc_wp10_delete_*` and a canonical module-Edit gate. The current code makes table reads, not table CRUD writes. Installed package inclusion is already verified in WP10 source and unpacked ASAR receipts; actual installed signed-in classification acceptance is pending.
- **Risk:** Immediate unconditional REVOKE/strict policy cutover can break older installed clients; leaving authenticated ALL DML indefinitely exposes ungoverned edits from any legitimately signed-in identity. There is no safe blanket conclusion from either side.

## Pinpointed legacy source evidence

**Baseline `c5029409278445c89a1bc506c15824ec0fa91e63` — PR #445 base, before its governed-RPC replacement:**

| Legacy Electron root script | Direct DML target | Source call sites (lines, operations) |
|---|---|---|
| `js/categories.js` | `categories` | 96–97 INSERT; 127–128 DELETE; 177–178 UPDATE |
| `js/subcategories.js` | `sub_categories` | 106–107 INSERT; 131–132 DELETE; 163–164 UPDATE |
| `js/product-groups.js` | `product_groups` | 166–167 INSERT; 172–173 DELETE; 178–179 UPDATE |
| `js/subgroups.js` | `sub_groups` | 135–136 INSERT; line 154 DELETE; 182–183 UPDATE |

**Current `main`**: `js/categories.js`, `js/subcategories.js`, `js/product-groups.js`, `js/subgroups.js` retain SELECT table reads, but use governed named `rpc_wp10_*` for CRUD and call `initializeClassificationAccess('module:manage-*')`.

The pre-PR baseline verifies code **could** require direct DML, not whether the old binary was published, who currently runs it, or whether some legacy clients use other paths.

## Proposed risk-controlled sequence (NO ACTION AUTHORISED HERE)

1. **Inventory installed Windows fleet and rollback dependencies:** record app version/build SHA and launch/last-seen version where available through owner-authorised non-sensitive channel; identify Windows installations whose ASAR contains the old direct writers and the actual update/rollback pathway. Do not pull staff names, credentials, tokens or raw session/user logs into GitHub. **Fleet count/version share currently NOT TESTED.**
2. **Confirm new installed client compatibility:** build the reviewed combined Costing release candidate later (not automatically). With existing independently proven Editor/View-only/No-access categories, show that all four classification pages load and correctly deny restricted controls. Governed RPC positive CRUD acceptance must use a separately authorised disposable fixture/non-production system, not real master records.
3. **Prepare cutover change separately:** run a dependency/invariant assessment for four-table direct-writer `REVOKE INSERT, UPDATE, DELETE FROM authenticated` and/or stricter canonical permission RLS, including sequence grants and RPC function security/ownership, caller definitions, rollback, old-client error messages and support instructions. SQL is **not** implemented here. Keep SELECT and permitted RPC EXECUTE. **Do not equate a mere browser control gate with database protection.**
4. **Choose deployment policy:** either (A) complete compatible fleet migration then approve a separately pinned, tested and reversible ACL/RLS change; or (B) programme owner expressly accepts a *temporary known authorisation exposure* with receiving security owner and fixed deadline for cutover, without describing WP10 as secured. A hardening change must never be silently merged into optional PR #463.
5. **After change, verify with legitimate role JWTs:** independent signed-in negatives and Editor positives against intended PostgREST access, including inability to write direct base tables and continued authorised governed-RPC functionality; no tests that write live business records.
6. **Prepare Windows updater rollback safety:** ensure rollback would not restore a client requiring direct DML after the cutover; for an emergency rollback to legacy code, predefine maintenance/security containment instead of silently re-granting overly broad permissions.

## Decision and outstanding conditions

**Proposed release/security receiving owners:** programme owner (risk acceptance), Electron fleet/release maintainer (installed version migration), Supabase/security maintainer (ACL/RLS cutover), WP12 acceptance operator (role/JWT denial). These are role recommendations, **not delegated approvals**.

The exact count of deployed old binaries remains **UNKNOWN**; do not infer it from GitHub source history or updater tags. The existing historical version **6.1.0** and its tag are not sufficient proof of today's installed-client population.

**WP10 remains OPEN** pending installed-role/route acceptance and explicit bounded security/compatibility disposition. **WP11 CLOSED. WP12 OPEN. 11/13 CLOSED; Electron release HOLD.**

**No production SQL, data writes, grants, flags, account changes or installer publication occurred.**
