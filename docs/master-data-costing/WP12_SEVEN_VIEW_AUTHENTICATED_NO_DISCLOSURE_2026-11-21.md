# WP12 — seven sensitive-view real-session no-disclosure receipt (21 Nov 2026)

**Status:** REAL AUTHENTICATED NO-ACCESS SESSION OBSERVATION COMPLETE — 7/7 HTTP 200 WITH ZERO ROWS. **NOT 7/7 EXPLICIT HTTP DENIAL.** WP12 OPEN; programme 12/13 owner-closed.

## Procedure and actual owner-supplied output
An operator working in an existing authenticated Chrome No-access SASV Utilities Hub session ran the bounded script discussed in the current conversation. It imported the application's existing `/shared/js/supabaseClient.js`, confirmed `supabase.auth.getUser()` succeeded without printing identity, and issued sequential authenticated `.from(public_view).select('*').limit(1)` requests with 10 s per-request timeout. It logged **only** the case ID, HTTP status, and outcome classification, no business payloads or credentials. Observed console returned seven results; **all seven had HTTP status 200 and outcome NO ROW RETURNED**.

| Case | Public view | HTTP | Returned data |
|---|---|---:|---|
| V1 | `v_costing_material_manual_rate_register` | 200 | no row |
| V2 | `v_costing_material_manual_rate_history` | 200 | no row |
| V3 | `v_costing_material_review_acceptance_register` | 200 | no row |
| V4 | `v_costing_scheme_master_audit` | 200 | no row |
| V5 | `v_costing_pricing_sku_detailed_cost_sheet` | 200 | no row |
| V6 | `v_costing_pricing_cost_sheet_line_traceability` | 200 | no row |
| V7 | `v_costing_scheme_master_register` | 200 | no row |

**Interpretation:** Seven genuine authenticated *bounded no-disclosure observations* PASS. There was **no** 401/403 or explicit permission-error response. A 200/empty array is compatible with row-level/WHERE permission filtering, empty underlying datasets, or both and must **not** be asserted as a demonstrated 7/7 direct HTTP rejection. The response was bounded to at most one row per view; script was configured to stop on a visible row. Browser console indicated session existed; independent association of its JWT with canonical grant rows was not directly inspected (prior owner No-access navigation PASS 6/6 is separate role evidence).

## Independent live catalog corroboration after the operator result
Read-only production pg_catalog inspection confirmed all seven views currently exist, all seven grant `authenticated SELECT`, deny `anon SELECT`, and all seven `pg_get_viewdef` definitions contain explicit `app_has_permission` predicates. Five retain default/explicit `security_invoker=false`, two are `security_invoker=true`. This is static corroboration, **not** a substitute for real JWT denial nor proof of all potential query shapes.

## No-go and next work
No request body, response row, identity, token or credential was retained; no privileged service key, fake account, permission alteration, production write, PR merge or app release. No repeated probe is required merely to recapture the same observation.

The defensible acceptance label for this subgate: **7/7 REAL-SESSION NO DISCLOSURE ON BOUNDED GETS — PASS**, with **explicit HTTP denial NOT TESTED**, narrowly documented. Any actual leakage remains a blocking defect. If stricter HTTP denial is required as a mandatory contractual condition, a separately reviewed server change/test is needed; **do not** fabricate an error classification or automatically change the view ACLs (legitimate authorised readers rely on them).

**Next WP12 gate in order: R2 one normal Cost Sheet Review → Cost Comparison load in an existing legitimate CSR View-only session with browser Network metadata (endpoint category, HTTP status, elapsed ms; no cost amounts/headers or response body).** Preserve earlier owner-reported November visible success after ANALYZE; one timing sample is not p95. Then R3 signed-in controller/cache/flag state and R4 owner residual/closure decision.
