> **FINAL ISOLATED PG17 EVIDENCE (12 NOV 2026):** [Exact-head workflow 43193552682](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43193552682) **8/8 PASS** on original 38-column view and production-parity SQL ACL. CCC-only, MCM-only, mixed positive; CBM/CSR/PPM, MCM Edit-only and no-reader negative. Reapply guard, temporary SQL ACL drift denial, exact original rollback, second rollback denial all pass. Candidate definition MD5 `0dcc3db262a30a9b770720dcb48e6376` pinned in the rollback file; original restore MD5 `df6c6771423c2aecb0130822a804a239`. All identities and acceptance row data synthetic; real signed-in staff results **NOT TESTED**. **No production SQL executed**.

# WP05 R42 — Owner-approved CCC/MCM full Acceptance Register reader policy (12 November 2026)

**Q-R38-CCC BUSINESS POLICY APPROVED — PRODUCTION SQL EXECUTION NOT APPROVED.** The owner expressly selected **CCC View OR MCM View** as the ordinary-reader entitlement for full `public.v_costing_material_review_acceptance_register`, **including `accepted_by` / `accepted_by_email`, `acceptance_reason`, `acceptance_note` and all other existing fields**. A View grant conveys **no** Edit, approval, Close or writer-RPC entitlement; existing writer checks remain untouched. CCC-only or MCM-only should read; CBM/CSR/PPM-only and MCM Edit-only without View should not. Mixed CCC/MCM users should read. No blanket global Costing reader shortcut.

## Live read-only preflight metadata

- View: `public.v_costing_material_review_acceptance_register`, owner postgres, 38 fields (including `accepted_by_email varchar(255)` and `accepted_by uuid`).
- Exact original `md5(pg_get_viewdef(oid,true))`: **`df6c6771423c2aecb0130822a804a239`**.
- Original SQL ACL: **`{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}`**. Unlike the MCM rate views, this view already grants `service_role` SQL SELECT; that must be preserved, not copied from a different view.
- Original `reloptions`: **NULL**, so `security_invoker` not explicitly set; candidate retains this exact property.
- Only referenced relation from view dependency catalog: `costing.v_material_review_acceptance_register`, 38 output attributes.
- Prior WHERE predicate was shared `fn_costing_view_allowed()`, admitting CCC, CBM, CSR and MCM View. The candidate changes **only this view's ordinary authenticated reader predicate** to `app_has_permission('module:costing-control-center','view') OR app_has_permission('module:material-cost-manager','view')`, while preserving original current_user privileged support logic and SQL grants.
- No actual material-acceptance data rows, user IDs or personnel details were read in preparation.

## Exact reviewer candidate

- **Review-only SQL:** `docs/master-data-costing/candidates/WP05_R42_CCC_MCM_ACCEPTANCE_APPLY_REVIEW_ONLY.sql` in **draft PR #330**. Guards the original view MD5, 38-column count, owner, ACL, reloptions, authenticated/anon/service_role privilege status; `BEGIN` / `COMMIT`; replaces full exact 38-field source; postchecks reader predicate, source relation, owner/grants/options.
- **Review-only guarded rollback:** `WP05_R42_CCC_MCM_ACCEPTANCE_ROLLBACK_REVIEW_ONLY.sql` in same draft. Pins exact tested candidate MD5 **`0dcc3db262a30a9b770720dcb48e6376`** (isolated PG17); restores exact original MD5 **`df6c6771423c2aecb0130822a804a239`**. Refuses unrelated intervening changes; **NOT run in production**.
- **Isolated CI:** `.github/workflows/wp05-r42-ccc-mcm-acceptance.yml`, `scripts/wp05-r42-acceptance/ccc-mcm-acceptance-pg17.test.mjs`, typed empty source and exact original view SQL. All test accounts and data synthetic, PostgreSQL 17 only. Tests original source fingerprint, CCC/MCM/mixed positive, CBM/CSR/PPM, edit-only/no-view negative, unchanged owner/ACL/options, no authenticated UPDATE, original source restoration and fail-closed rollback.
- Initial fixture run exposed the deliberate rollback fingerprint placeholder: candidate SQL/reader tests passed but rollback was rightly rejected. This was **not** a production error; the hash was read from the actual isolated candidate and pinned before the final rerun.

## Operational boundaries

**No owner permission to run R42 SQL on live Supabase**, merge SQL to deployment paths, change user roles, modify staff permissions, access acceptance rows, invoke Close or acceptance writer, alter shared `fn_costing_view_allowed`, deploy frontend or change other views. Following a complete green exact-head isolated suite and independent SQL review, obtain a **separate, explicit production-execution approval** naming the one-view PR/SQL and guarded rollback. Immediately before any later execution recheck live MD5, 38 name/types, ACL, owner, options, function and permission target. STOP on drift. After execution (only if approved), capture minimal catalogue proof; real signed-in CCC/MCM positive and CBM/CSR negative results require separately governed privacy-preserving sessions.

## WP05 gate truth

- **Q-R38-CCC policy APPROVED.** Design-only decision is complete.
- **R42 candidate prepared**, production **HOLD**.
- MCM rate reader policy R40 and PPM Scheme audit R34 remain live/verified at catalogue level; do not regress them.
- Remaining **Q-R38-CSR cost sheet & traceability** reader-policy decision **OPEN**.
- W5-06 **OPEN**, D-1 writer-denial in-production behavioural test NOT TESTED under previous governance, D-4 p95 4-second HOLD; formal WP05 **6/13**.
