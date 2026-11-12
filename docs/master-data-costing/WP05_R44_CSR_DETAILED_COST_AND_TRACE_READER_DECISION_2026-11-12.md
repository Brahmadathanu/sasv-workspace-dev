# WP05 R44 — Final D-2 business reader decision: detailed SKU Cost Sheet and line traceability (12 November 2026)

**READ-ONLY OWNER DECISION PACKET / NO OWNER APPROVAL OF Q-R38-CSR YET.** Following Q-R38-PPM Scheme History live correction (R34), Q-R38-MCM rate views live correction (R40) and Q-R38-CCC acceptance live correction (R43), the two CSR Cost Sheet-related views are the only members of the original six-view D-2 subset without a new owner-selected reader policy. This package does **not** change either database view or any staff role, app code, RLS rule, underlying schema or service_role grant.

## Current live metadata (verified 12 Nov 2026)

| Public view | Original/current definition MD5 | Owner | SQL ACL | Options | Output columns |
|---|---|---|---|---|---:|
| `v_costing_pricing_sku_detailed_cost_sheet` | `85585c98e6f184fb9a4eb3351b008c2e` | postgres | `{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}` | **`{security_invoker=true}`** | 44 |
| `v_costing_pricing_cost_sheet_line_traceability` | `b67b4ee28e0eb19804c073cb83e14e11` | postgres | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}` | NULL (owner-rights default) | 40 |

Both use an outer `WHERE (SELECT fn_costing_view_allowed())`, which allows CCC, CBM, CSR or MCM View for ordinary signed-in users. Neither view uses the already-corrected PPM/MCM/Acceptance specific predicates. `anon` SELECT is not granted. Both currently have an explicit `service_role` SQL SELECT grant; do **not** use the two Manual Rate views' different ACL as a replacement.

The detailed SKU view depends on `costing.v_sku_detailed_cost_sheet_current` (44 output references). That source currently has `authenticated` SQL SELECT, `security_invoker=false`, `authenticated` schema USAGE and no `service_role` SELECT, so **source ACL and source RLS/effective session behaviour must be separately verified** before labelling a role as permitted. Invoker mode on the outer view is material, not cosmetic.

The line-traceability view depends on the direct `costing.cost_sheet_line_traceability_snapshot` plus production/QC, direct labour, overhead, stores, marketing and finance allocation snapshot sources. Changes must preserve their joins/derived values and exact selected JSON field contract.

## Verified real client consumers (source, not user-session proof)

- `public/shared/js/costing-suite-shell.js`, `fetchSkuDetail` around lines 7625–7636: `costingFrom('v_costing_pricing_sku_detailed_cost_sheet').select('*').eq('period_start', ACTIVE_PERIOD_START).eq('sku_id',skuId).limit(1)`; `renderSkuTab` uses the returned detail in multiple SKU-level tabs. This is a **shared Costing Suite shell**, rather than a demonstrably CSR-exclusive reader.
- `public/shared/js/costing-suite-cost-sheet.js`, `TRACEABILITY_VIEW` and line explanation around lines 5949–5995: explicit field projection containing `trace_source_snapshot`, `evidence_json` and `drill_filter_json`, filtered by exact period, valuation date, refresh run, SKU/product and line. It supports printable Cost Sheet explanations; narrowing field projection blindly would break drill functionality.
- This source evidence does **not** establish that CCC, CBM or MCM currently uses each tab in a signed-in session, or that any non-CSR user is entitled to full cost-sheet evidence; business policy must decide.

## Owner decision required: Q-R38-CSR

**Option A — CSR View only** for *both* full detailed SKU Cost Sheet and line traceability. This is strictest functional segregation; it would revoke implied access from CCC/CBM/MCM-only viewers of these specific full views. It requires consumer audit and perhaps a new restricted summary view for CCC if Costing Control Center needs selected SKU cost status. It is **not** inherently safe to implement without that shared-shell compatibility plan.

**Option B — CSR View OR CCC View** for *both* full detail and full traceability, with CBM/MCM-only roles denied unless an additional explicit owner exception is granted. This retains a full costing oversight path for CCC and allows CSR detailed review. This is the **recommended working policy to discuss**, provided the owner confirms CCC legitimately needs the entire line-evidence/JSON payload and not merely summary status. A restricted CCC projection may be preferable if CCC needs totals only.

**Option C — different readership by sensitivity:** CSR View for full `line_traceability` (incl evidence JSON), and CSR OR CCC View for `sku_detailed_cost_sheet`. This limits detailed audit provenance while allowing CCC full SKU calculations. It introduces a deliberate per-view distinction; the shared source consumer must handle it. It may be more appropriate when CCC needs costs but not line source evidence.

**Option D — explicitly named other roles** (CBM and/or MCM) for one or both full views, with justification and defined output scope; no inference that a costing-module navigation right implies underlying sensitive detail entitlement.

**No option has been approved by the owner.** This R44 report records choices without implementing them or inferring a decision from “go ahead.” The owner should choose A, B, C, or a precisely scoped variant before any guarded SQL candidate is built. Do not change global `fn_costing_view_allowed`.

## If/when approved — engineering control gates

1. Verify shared shell actual route/lens consumers under authorized roles, and preserve required Cost Sheet overview/print/trace paths.
2. Preserve all 44 and 40 column names/types, original view owners, grants, **differing** `security_invoker` settings (detail true, trace NULL). For detailed view, also test source view ACL and source access separately; do not infer success from outer WHERE predicate alone.
3. Build two distinct guarded candidates/rollback sources with exact original hashes, atomic apply if approved together, and executable isolated PostgreSQL 17 fixture with source dependencies (synthetic only).
4. Run separately approved real signed-in positive/negative acceptance using no cost-sheet row/JSON export. For WHERE-denied views, an empty result may be ambiguous. **No production SQL until subsequent explicit owner execution approval.**

## Retained status

R34 Scheme audit, R40 MCM full rates, and R43 CCC/MCM acceptance are catalogue-level live corrections. Real effective signed-in reader-denial matrices remain incomplete. Q-R38-CSR remains **PENDING**. W5-06 **OPEN**, formal WP05 **6/13**. D-1 writer denial and D-4 p95 hold continue under existing governance. No additional execution is implied by this decision packet.
