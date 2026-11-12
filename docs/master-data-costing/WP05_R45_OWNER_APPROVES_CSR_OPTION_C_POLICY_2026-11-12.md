> **R45 FINAL CURRENT-MAIN CANDIDATE / SOURCE-CONTRACT CHECK — 12 NOV 2026:** Clean **DRAFT [PR #338](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/338)** supersedes closed-unmerged #336. Same six exact tested SQL/rollback/typed fixtures and CI source blobs on owner-approved policy main branch; one extra static client-reader contract test asserts shared SKU detail fetch/fallback and trace evidence JSON field selection. [Exact-head PG17 workflow 43198955208](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43198955208) **10/10 PASS**, including real PostgreSQL apply/rollback. Exact tested candidate MD5s unchanged: detail `4faaae56558dddbc3b418146f2ab8c59`, trace `800a546b711a9658e9f81a58b6e78303`. Production reread after candidate tests: original live view definitions remain `85585c98e6f184fb9a4eb3351b008c2e` and `b67b4ee28e0eb19804c073cb83e14e11`. No production SQL executed; signed-in cross-role UI acceptance **NOT TESTED**; separate production approval mandatory.

> **R45 EXACT-HEAD ISOLATED PG17 RESULTS — 12 NOV 2026:** [Workflow 43198293117](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43198293117) **9/9 PASS** with exact production-definition SQL, typed synthetic snapshot dependencies, detail's nested invoker source view, non-empty synthetic data, CCC/CSR positive, CCC trace negative, CBM/MCM/PPM/edit-only negative, unchanged ACL/reloptions, fail-closed reapply/rollback and exact restore. Candidate `pg_get_viewdef` MD5s now pinned in guarded rollback: detail `4faaae56558dddbc3b418146f2ab8c59`, trace `800a546b711a9658e9f81a58b6e78303`. **No SQL run on live Supabase; production EXECUTION HOLD.** Synthetic fixture correction: trace's grant order differs from detailed view's, accurately recreated after first strict drift failure. Source client fallback `data?.[0] || row` avoids exceptions for an empty SKU-detail response, but **does not establish full CBM/MCM screen parity**; role-specific browser compatibility remains NOT TESTED.

# WP05 R45 — Q-R38-CSR Option C owner-approved policy and guarded candidate (12 Nov 2026)

**OWNER POLICY APPROVED, PRODUCTION EXECUTION NOT AUTHORISED.** The owner explicitly chose **Option C**:
- `public.v_costing_pricing_sku_detailed_cost_sheet` (44 output columns): **CSR View OR CCC View** may read full detailed SKU Cost Sheet.
- `public.v_costing_pricing_cost_sheet_line_traceability` (40 output columns): **CSR View only** may read line-evidence source, `evidence_json`, `drill_filter_json`, and full trace data.
- CBM, MCM, PPM or unrelated module View does not automatically confer access; Edit-only does not grant View. No change to writers, approvals, staff privileges, outer source grants, system service role grants or global `fn_costing_view_allowed`.
- Owner directed isolated testing and guarded SQL+rollback preparation only; **separate owner approval is mandatory before any production SQL execution**.

## Client compatibility review

Exact source on current main:
- Shared `public/shared/js/costing-suite-shell.js` `fetchSkuDetail` (~7625) uses `v_costing_pricing_sku_detailed_cost_sheet.select('*')`, filtered to period and SKU, one result; `renderSkuTab` uses it in multiple SKU tabs. CCC is retained for this full view specifically to protect Costing Control Center's oversight workflow. CBM/MCM-only SKU detail views may lose enrichment under the proposed change; an exact signed-in cross-module compatibility check remains required. If some legitimate CBM/MCM function depends on the full view, owner must decide on an exception or a narrower projection; do not silently reopen full traceability.
- `public/shared/js/costing-suite-cost-sheet.js` `TRACEABILITY_VIEW` line explanation (~5949) uses an explicit field projection including `trace_source_snapshot`, `evidence_json`, and `drill_filter_json`, with exact period, valuation, run, SKU, product and line. Preserving all original columns enables the CSR reader contract; CCC can still see SKU-level costs but should not automatically see restricted line source evidence.
- The two views do **not** share an identical technical security contract. Detailed SKU view has **`security_invoker=true`** and reads `costing.v_sku_detailed_cost_sheet_current` (currently `authenticated` SELECT and schema usage, source view `security_invoker=false`); the trace view has **NULL** reloptions (default owner rights) and joins ten Costing snapshots. This difference must survive replacement. Real signed-in source ACL/RLS effects remain separate and **NOT TESTED**.

## Live preflight (read-only, no Costing rows)

| Property | Detailed SKU view | Traceability |
|---|---|---|
| Original exact definition MD5 | `85585c98e6f184fb9a4eb3351b008c2e` | `b67b4ee28e0eb19804c073cb83e14e11` |
| Output columns | 44 | 40 |
| Owner | postgres | postgres |
| SQL ACL | `{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}` |
| reloptions | `{security_invoker=true}` | NULL |
| Ordinary source gate (before) | shared CCC/CBM/CSR/MCM | shared CCC/CBM/CSR/MCM |

## Candidate review files

- `docs/master-data-costing/candidates/WP05_R45_CSR_OPTION_C_APPLY_REVIEW_ONLY.sql`: exact complete view SQL from current catalogue, only two specified reader predicates changed, atomic transaction, preflight fingerprints/owner/ACL/options/column count guards, postcondition checks, no GRANT or global helper change.
- `docs/master-data-costing/candidates/WP05_R45_CSR_OPTION_C_ROLLBACK_REVIEW_ONLY.sql`: exact old definitions and transactional rollback, **candidate MD5 placeholders must be pinned after isolated PostgreSQL parsing before this is executable**. Do not use any unpinned rollback.
- `scripts/wp05-r45-csr-option-c/fixtures/source-dependencies.sql`: catalog-derived typed empty snapshots and nested `costing.v_sku_detailed_cost_sheet_current` source-view representation, explicitly preserving its original security-invoker setting and grants; no live data.
- `scripts/wp05-r45-csr-option-c/fixtures/original-views.sql`: exact full original 44- and 40-column view text, including derived source fields and SQL ACL.
- `scripts/wp05-r45-csr-option-c/csr-option-c-pg17.test.mjs` and `.github/workflows/wp05-r45-csr-option-c.yml`: isolated real PostgreSQL 17 apply/rollback and synthetic permission role matrix with nested view dependency, original/differing reloptions, real original SQL ACL, fail-closed guards, no privileged production identity.

## Stop rule and programme status

No production SQL, account/user or permission edits, real sensitive Costing row reads, client deployment, role impersonation, or rollback. Even after isolated tests pass, separately review common client readers and obtain **specific production owner approval** for the two-view transaction. Do not merge the review-only SQL as a migration file, or replay it in a future release without a migration reconciliation plan. Real authenticated positive/negative roles still NOT TESTED.

R34 Scheme audit, R40 full MCM rate views, and R43 CCC+MCM acceptance remain live and unchanged. The CSR policy choice makes the **six-view business policy selection complete**, but W5-06 **OPEN** until execution and acceptance evidence are completed; formal WP05 remains **6/13**. D-1 writer behavioural test and D-4 p95 4-second HOLD unchanged.
