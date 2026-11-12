# WP05 R55 — PPM-only Scheme Master empty: confirmed reader-gate defect (12 November 2026)

**OWNER PWA RETEST: Scheme Master EMPTY, History EMPTY/INCONCLUSIVE. R55 FIX REVIEWED IN ISOLATION ONLY; PRODUCTION SQL NOT AUTHORISED.** Stage 4 is NOT a PASS. Owner observed PPM-only navigation PASS and other Pricing Policy read POPULATED; first Scheme Master list EMPTY; after clearing search and filters, Scheme Master list remained EMPTY. History cannot be normally selected if the list has no scheme; the user entered EMPTY as a retest result, but do **not** credit actual audit-reader denial or History PASS/FAIL. 

## Root cause established by live read-only metadata

- `public.v_costing_scheme_master_register` is invoked by `public/shared/js/costing-suite-pricing-policy.js` (Scheme Master workspace, `loadPolicyManagerRows`, explicit column projection and paging). The view's actual terminal WHERE is `fn_costing_view_allowed()`.
- Live `public.fn_costing_view_allowed()` allows service infrastructure plus **CCC, CBM, CSR or MCM View**, but **excludes PPM View**. The designated test account currently has **PPM View only**, all six Edit false, verified in `public.v_user_permissions_effective`. Therefore the view rejects the PPM-only reader and can return zero rows without error; this accounts for the persistent empty Scheme Master.
- The Register has **7 existing source-result rows** under a privileged read-only query, whereas `v_costing_scheme_master_audit` has **7 rows**. These counts do not prove signed-in staff access; they confirm source data exists. Scheme Audit already has the explicit PPM-only view gate (MD5 `e2b9eb3c1b86d073183cd376f704cf58`).
- Register original definition MD5 `8fdc0306bd2f1efbe0638c7c13ba4dda`, 34 fields, owner postgres, ACL `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`, `security_invoker=true`. Underlying `costing.scheme_master` and `costing.sku_scheme_viability_snapshot` authenticated grants, schema USAGE and RLS `auth.uid() IS NOT NULL` remain in place.
- This is a **specific Register view's ordinary-reader-gate mismatch**, not evidence that the global helper must be expanded. Changing the helper would unnecessarily widen other Costing sources. Neither production Register nor permission functions have been modified during R55.

## Recommended narrow reader policy / proposed SQL

**Request owner approval:** change **only** `public.v_costing_scheme_master_register` to a PPM View-only ordinary reader predicate (with existing postgres/service_role technical support branch), matching Scheme Master Audit ownership. Other CCC/CBM/CSR/MCM-only users would no longer get access through this view. Although the named client consumer is Pricing Policy Manager, this is a real access restriction and must be an explicit owner decision, not an implied change.

- Exact guarded view SQL: `docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_APPLY_REVIEW_ONLY.sql` in **draft PR #351**.
- Exact guarded rollback: `docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_ROLLBACK_REVIEW_ONLY.sql` with isolated candidate fingerprint `903cb8eae3702bf72e41213ec2c89c6e`, restoring original `8fdc0306bd2f1efbe0638c7c13ba4dda`.
- A single-view `CREATE OR REPLACE VIEW ... WITH (security_invoker=true)` is guarded on exact original MD5, 34 outputs, owner and ACL. It retains original projected 34 fields, joins, SQL grants, source RLS and technical context; no GRANT, staff permissions, shared helper, writers or frontend change.
- Synthetic PostgreSQL 17 test `scripts/wp05-r55-scheme-register/scheme-register-pg17.test.mjs` with catalog-derived typed table dependencies and authenticated RLS fixture: **8/8 PASS** on [workflow 43212823520](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43212823520), including original PPM deny reproduction, new PPM populated result, CCC/CSR/CBM/MCM/PPM Edit-only denied, invariant owner/grants/invoker, fail-closed apply and ACL-drift rollback and exact original restore. This is isolated fixture evidence, not hosted PWA permission acceptance.
- Rollback not executed. Production correction **NOT EXECUTED** and cannot be executed until owner approves **both proposed Register readership and separate production execution**. The draft is unmerged; never replay candidate SQL as migration.

## Owner PWA retest and stage decision

Keep designated test account in **PPM View-only** (other five View=false, all six Edit=false) until a separately approved correction is deployed. Once deployed, normal sign-out/sign-in and clear search/filters; expect 7 currently defined scheme rows (actual count may evolve), then open a scheme known to have history and verify History. No prices, schemes, actors, rates or token payload need be shared.

**Do not advance Stage 5 or restore original six-View/no-Edit baseline** before PPM positive check is resolved unless the owner expressly opts to stop acceptance and restore the account while retaining Stage 4 as FAIL/INCONCLUSIVE. The final baseline remains six View=true and all Edit=false; all original meta fields preserved.

WP05 R48 CSR-only owner PASS; R52 CCC-only owner PASS after R50 failure/R51 recovery; R53 MCM-only bounded owner PASS except in-context acceptance not observed; R54/R55 PPM-only partial with Scheme Master gate failure. W5-06 OPEN, WP05 formal 6/13. No additional production changes from R55.
