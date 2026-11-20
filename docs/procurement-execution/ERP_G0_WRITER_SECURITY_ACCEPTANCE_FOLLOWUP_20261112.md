# PEC G0 — Read-only writer and access acceptance follow-up (12 Nov 2026)

**Scope:** Live Supabase inspection + source parity. No synthetic or real PR/indent INSERT, no destructive MRP rebuild, no Tally PO dependency. This is evidence toward gates, **not** formal gate sign-off.

## Concrete old-PR simulation (no writes)

`proc_indent_create_from_pr_pec_internal` eligibility was reproduced as a SELECT over two active historical PRs containing internal classified materials:

| PR | Positive PR lines | Eligible external procurement after category filter | Excluded internal lines |
|---|---:|---:|---:|
| PR-2026-01 | 208 | 206 | 2 |
| PR-2026-04 | 244 | 243 | 1 |

Excluded item rows: #427 Kasturikalpa Rasayanam 114 ML, Nos (97 in PR-2026-01 and 107 in PR-2026-04); #545 Lokamayahara Kasthuri (Gulika) Box (20 manual delta in PR-2026-01). The manual override is preserved in the **historical PR**, but it will not be copied to **new external procurement indents** under the newly governed internal-material exclusion. Existing approved indents remain untouched.

The present database has one draft indent, #202, manually created (`source_pr_id IS NULL`) with one existing line; no empty-header example was identified. Thus static function guard is confirmed, but its behavior is not proved by a live insertion experiment.

## Writer privilege checks

Public API entrypoints `create_pr_from_mrp_plan`, `proc_pr_rebuild_from_mrp`, `proc_indent_create_from_pr`, `proc_indent_resync_from_pr` retain `SECURITY DEFINER` and explicit `authenticated` EXECUTE privilege. The corresponding `*_pec_internal` helpers are `SECURITY DEFINER` but **not directly executable** by `authenticated` or `anon`; only postgres/service_role grant present. This confirms the intended call boundary at the catalog ACL level, **not** an actual authenticated user E2E transaction.

The strictly read-only `mrp_uom_factor_strict(bigint,bigint)` helper currently has public/anon/authenticated EXECUTE; its definitions have no table writes. Treat surface/API permission review as an explicit gate rather than silently changing grants.

## Security-invoker parity caveat

Adjacent views `v_mrp_material_gross_requirement`, `v_mrp_material_month_grid`, `v_mrp_procurement_plan`, and `v_inv_stock_item_with_class` use `security_invoker=true`. Live `v_mrp_material_gross_requirement_rm` currently has **no security_invoker reloption** and is owned by postgres. That option is preserved (no security change in this acceptance turn).

In an explicit **BEGIN ... ALTER VIEW ... SET (security_invoker=true); SET LOCAL ROLE authenticated; SELECT LIMIT 10; ROLLBACK** test, the query was allowed but returned **zero rows** for bare `authenticated` without a signed-in JWT. Such a test is NOT representative of a real app session; changing the view setting without session-aware RLS parity evidence could disrupt access. The transaction was rolled back and live reloptions remain NULL. Need test with authorized actual authenticated session/RLS fixtures and verify precise privilege grants before any security_invoker migration.

## Source-control migration parity

On branch `docs/pec-erp-g0-baseline-20261111`, migration `supabase/migrations/20261112114000_pec_uom_and_internal_pr_guard.sql` was fetched and compared with live `pg_get_functiondef`: **6/6 tracked function definitions exact-text present** (strict UOM helper, monthly rebuild, PR create/rebuild, indent create/resync), all TRUE. The view definition is captured in that migration, and the production view remains without explicit security_invoker option. The branch remains unmerged; do not claim that source-control merge/deploy gate passed.

## Outstanding owner-facing acceptance sequence

1. **Plan baseline decision:** December old 357 product drivers vs current 141; 250 old products no longer present and 46 changed. Hold destructive MRP rebuild until current plan is reconciled/approved.
2. **Isolated authenticated writer tests** for PR generate/rebuild, manual delta preservation, old active PR→indent category filtering, empty-indent rejection, draft resync, duplicate prevention, permissions and audit-trigger behavior; preferably isolated PostgreSQL and then hosted acceptance with authorized account.
3. **Session-aware view security/RLS parity** before `security_invoker` adjustment; no grants broadened.
4. **Legacy internal commitments:** seven positive approved-indent balance lines across four indent numbers #84/#156/#191/#220 require operator lifecycle review, not automatic cancellation.
5. **S4 hybrid** remains out of scope until eligibility and UOM/stock anchors verified. No new production PR/indent test records were written.

**PEC G0 remains active; formal gates 0/6.**

## Follow-up static fixture and public-wrapper permission chain

All four publicly callable `SECURITY DEFINER` wrappers (`create_pr_from_mrp_plan`, `proc_pr_rebuild_from_mrp`, `proc_indent_create_from_pr`, `proc_indent_resync_from_pr`) have **confirmed** `require_permission('module:procurement-execution-console','t')` before calling their corresponding private `*_pec_internal` writer. User-specific runtime authorization **has not** yet been exercised, so no formal permission pass is claimed.

Live **9/9** read-only synthetic predicate fixtures passed: ordinary RM positive, finished-bulk excluded, semi-finished excluded, internal manual delta excluded, negative final qty excluded, zero final qty excluded, packaging positive allowed, inactive RM excluded, and external manual delta allowed. Exact reproducible SELECT in `ERP_G0_PR_INDENT_ELIGIBILITY_9_CASE_FIXTURE_20261112.sql` (commit `9164cf2`). This is a **predicate oracle**, not an RPC transaction test.
