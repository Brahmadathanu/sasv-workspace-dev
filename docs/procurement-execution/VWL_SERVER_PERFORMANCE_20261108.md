# PEC-VWL-R2 — Live server search recovery (2026-11-08)

## Incident and owner approval
Vendor-wise Buying List search in PEC was slow and sometimes timed out. PR #238 fixed client concurrency, but live internal RPC search `cap` exceeded a 3500 ms statement timeout. User authorized the bounded server correction on 2026-11-08 after read-only diagnosis.

## Diagnosis
The 2026-11-05 manual-indent ordering migration added an indent-origin scalar subquery on `public.v_proc_indent_console` to `public.v_proc_indent_lines_console_ordered`. That console view computes aggregate allocation data although only `source_pr_id` is needed. For all **36** current indent headers, the origin matched `proc_indent_header.source_pr_id` (0 mismatches).

Before correction, `EXPLAIN (ANALYZE, BUFFERS)` of ordered view with LIMIT 20 exceeded 2500 ms. A separate, simplified direct-header test finished in 3.15 ms (not a like-for-like baseline).

## Applied production migration
Supabase project `qhmoqtxpeasamtlxaoak`, live migration **20261108165005**, named `pec_vwl_r2_direct_indent_origin_lookup`. The SQL is preserved verbatim in `supabase/migrations/20261108165005_pec_vwl_r2_direct_indent_origin_lookup.sql`. This PR is **reconciliation of already executed live SQL**, not authorization to run it again.

The dynamic replacement changes only `FROM v_proc_indent_console h` to `FROM proc_indent_header h` in the view's scalar subquery; a unique-match guard and origin-parity guard prevent unexpected replacements. No column, grouping, manual/PR sorting, security grants, or data changed.

## Verified post-apply
- Ordered view: 1577 rows across 36 indents; 0 missing canonical serials. LIMIT 20 execution: **44.565 ms**.
- Manual indent rows: 552, all canonical serials equal row-number by `indent_line_id` (0 mismatches).
- PR-origin ordered rows: 1025 across 6 indents.
- Internal filtered buylist RPC with `p_q='cap'`: 13 rows, **109.748 ms** execution (vs pre-change timeout 3500 ms).
- Internal unfiltered RPC count: 825 rows, **1215.007 ms** execution.
- View owner remains postgres; direct SELECT remains denied for anon and authenticated.
- Live Electron/PWA signed-in acceptance, export parity, and comprehensive old/new row-value parity have **not** been established. Do not claim full incident closure on these tests alone.

## Rollback
Only if operationally necessary and approved, restore the original scalar source in the same view:
`FROM proc_indent_header h` back to `FROM v_proc_indent_console h`, with an exact-match guard and prior definition/contract/security verification. This would restore the original performance issue; prefer root-cause triage if a separate regression appears.

## Operational follow-up
Verify vendor search, item search, rapid typing, split-only, manual indent serial, PR ordering, exports and role-based access in a signed-in hosted/Electron session. The client PR #238 merge alone does not update installed Electron builds. Avoid service-worker or Electron release changes in this reconciliation PR.
