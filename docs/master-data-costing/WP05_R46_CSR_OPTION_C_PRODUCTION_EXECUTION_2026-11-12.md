# WP05 R46 — CSR Option C two-view production execution (12 November 2026)

**OWNER AUTHORISED / PRODUCTION APPLIED / LIVE CATALOGUE PASS.** After the owner approved Q-R38-CSR Option C for **CSR or CCC View** access to the detailed SKU Cost Sheet and **CSR View alone** for full line traceability, and after a separate review-only SQL/rollback in draft PR #338 passed isolated tests, the owner expressly said **“Go ahead with it”**. This is the separate production execution approval for the exact reviewed two-view candidate, not any general permission/writer authorisation.

## Exact production operation

- SASV Supabase project `qhmoqtxpeasamtlxaoak`.
- Source: [review-only draft PR #338](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/338), `docs/master-data-costing/candidates/WP05_R45_CSR_OPTION_C_APPLY_REVIEW_ONLY.sql`, Git blob **`2b19ea1546c7629ca4557097370cf13c69c29081`**. This is exactly the code tested in [PG17 CI 43198955208](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43198955208), **10/10 PASS**. The review branch was one documentation commit behind main at execution time, with **no change to the tested SQL blob**; production source MD5s remained original.
- Fresh live preflight confirmed both exact original definition hashes, 44/40 names/types/counts, `postgres` owner, the original **different** `relacl` ordering, `security_invoker=true` on the detail view versus NULL reloptions on traceability, authenticated and service_role SQL SELECT granted, anon SELECT absent, and both canonical module targets active/assignable.
- `costing.v_sku_detailed_cost_sheet_current` original source-view ACL grants authenticated SQL SELECT, source `security_invoker=false`, and authenticated costing-schema USAGE; no underlying grants or definitions were altered. All three shared permission functions had unchanged source MD5 before applying.
- Executed exactly one reviewed guarded `BEGIN … CREATE OR REPLACE VIEW (two views) … COMMIT` transaction using Supabase `execute_sql`, with 3-second lock and 60-second statement timeout, original-definition precondition guards and postcondition verification. **No migration history entry** was created. Future migrations must reconcile already-applied SQL, not silently replay this candidate.
- Guarded rollback exists in draft #338, `WP05_R45_CSR_OPTION_C_ROLLBACK_REVIEW_ONLY.sql`, with exact tested candidate fingerprints; **rollback NOT executed** and should never be used without independent incident/owner authority and preflight.

## Post-production verified definition hashes

| View | Before MD5 | After MD5 | Output columns |
|---|---|---|---:|
| `public.v_costing_pricing_sku_detailed_cost_sheet` | `85585c98e6f184fb9a4eb3351b008c2e` | **`4faaae56558dddbc3b418146f2ab8c59`** | 44 |
| `public.v_costing_pricing_cost_sheet_line_traceability` | `b67b4ee28e0eb19804c073cb83e14e11` | **`800a546b711a9658e9f81a58b6e78303`** | 40 |

Both **exactly** match the PG17 isolated candidate and preserve owner/grants/invoker modes. Detailed Cost Sheet ordinary-user WHERE now requires `app_has_permission('module:cost-sheet-review','view') OR app_has_permission('module:costing-control-center','view')`, and full traceability ordinary-user WHERE requires **only** `app_has_permission('module:cost-sheet-review','view')`. The preexisting technical service-role branch and actual SQL grants are retained; no new GRANT/REVOKE or Edit/Close permission.

Independent post-deployment metadata verified other four original D-2 members unchanged:
- Scheme audit `e2b9eb3c1b86d073183cd376f704cf58`.
- MCM manual-rate History `01029a39e47a300aa7860d17b2f39cae`.
- MCM manual-rate Register `38b4262bfae719ca3f736185784fd047`.
- CCC/MCM acceptance `0dcc3db262a30a9b770720dcb48e6376`.

Shared functions also unchanged:
`app_has_permission` `12727b365c1728d3830eeab039b6e344`, `app_has_permission_core` `b75d5b4ee5cc6c464149c5743e165b95`, `fn_costing_view_allowed` `b7efb09b90fa3e9332915ba5d223568c`.

## Completion and retention boundaries

**Six-view D-2 owner policy selection and production DDL corrections now COMPLETE at catalogue level.** This means the six reviewed view definitions are updated; it does **not** mean real role-aware signed-in application access is proved. Actual CSR View positive/full trace read, CCC positive SKU detail + denied full trace read, CBM/MCM negative and shared-shell UI parity in PWA are **NOT TESTED** here. The direct view predicate may return empty arrays, which cannot establish actual denial or a positive entitlement in an empty dataset. The previously owner-observed Scheme History visible is retained at its stated evidence level.

No sensitive Cost Sheet rows, trace evidence JSON, pricing/labour/overhead payloads, user records, auth sessions, role assignments, writer/close RPCs, frontend flags or PWA build were changed or exported. The service_role SQL grants, invoker behaviours and all client source files remain unchanged.

**WP05 W5-06 remains OPEN** pending governed real signed-in access evidence and remaining closure gates. Formal WP05 **6/13** and technical workflow **4/7** are unchanged by this catalogue-only implementation. The D-1 writer behavioural test and D-4 comparison p95 hold also remain under their prior dispositions.
