# WP12 seven sensitive views — current catalog read-only inspection (19 Nov 2026)

**STATUS: CATALOG-ONLY OBSERVATION; NEGATIVE JWT HTTP STILL NOT TESTED.** Inspection ran against live project `qhmoqtxpeasamtlxaoak`, without querying view data, impersonating an account, altering permissions or performing HTTP probes.

## Findings
All seven `public` views exist, are owned by `postgres`, grant `authenticated` SELECT and deny `anon` SELECT. Their definitions all include an explicit `public.app_has_permission(...,'view')`-based predicate and an explicit privileged `CURRENT_USER` exception for postgres/service_role. **Only two** have `security_invoker=true`; the remaining **five** have `security_invoker=false` or no option (default definer). A previous summary describing all seven as `security_invoker` is too broad and must be corrected. It is not proof of data leakage because every view has explicit permission filters; it is not proof of JWT denial either.

| View | security_invoker | Canonical intended View permission in view text |
| --- | --- | --- |
| `v_costing_material_manual_rate_register` | false | `module:material-cost-manager` |
| `v_costing_material_manual_rate_history` | false | `module:material-cost-manager` |
| `v_costing_material_review_acceptance_register` | default false | `module:costing-control-center` OR `module:material-cost-manager` |
| `v_costing_scheme_master_audit` | default false | `module:pricing-policy-manager` |
| `v_costing_pricing_sku_detailed_cost_sheet` | true | `module:cost-sheet-review` OR `module:costing-control-center` |
| `v_costing_pricing_cost_sheet_line_traceability` | default false | `module:cost-sheet-review` |
| `v_costing_scheme_master_register` | true | `module:pricing-policy-manager` |

**Do not modify** these views or recommend blindly switching all five to `security_invoker=true` in production: that would alter underlying-table permissions and could break legitimate reads. First prove actual caller-context semantics and HTTP effects in nonproduction, then examine whether any tighter design is needed.

## Live checks performed
- Existence, `pg_class.reloptions`, owner and `has_table_privilege('anon'/'authenticated',...,'SELECT')`.
- Source definition `pg_get_viewdef` inspected for explicit permission predicates and the intended module keys; no business rows requested.
- Observed five non-invoker views with explicit `WHERE (SELECT CURRENT_USER privileged OR app_has_permission(...,'view'))` gating. Catalog presence of the predicate is a partial static security check, not a real signed-in negative test.

## Receiving dependency
For each V1–V7 listed in `WP12_AUTHENTICATED_BROWSER_RECEIVING_HANDOFF_2026-11-17.md`, use a genuine independently authorised signed-in denied user and approved minimal HTTP test procedure to capture only HTTP status and whether protected rows are exposed. A 200/empty array does not demonstrate HTTP denial. No fabricated JWT, SQL role spoofing, privileged service key or data-bearing response log.

## Status
Seven catalogs **EXIST / PERMISSION PREDICATE PRESENT**, two invoker / five definer; **JWT negative HTTP 0/7 tested in this session**. Do not mark 7/7 JWT PASS. WP10/WP12 OPEN; WP11 and previous positive PWA Costing evidence retained; Electron HOLD.
