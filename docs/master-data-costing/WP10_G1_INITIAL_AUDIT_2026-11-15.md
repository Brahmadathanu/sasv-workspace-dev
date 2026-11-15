# WP10 G1 — Initial Product/SKU safeguard audit, 15 November 2026

**G0 entry satisfied, G1 IN PROGRESS. No implementation change. Programme 10/13 after WP09 owner closure.** One comprehensive source/fixture assignment: [issue #438](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/438). No Claude coding session has been dispatched by ChatGPT.

## Independently observed baseline
Source pin at kickoff: 6d934c6701c33d46c48ea52ad902424f0bc82b5f. Repository entry sources: public/shared/js/products.js, public/shared/manage-products.html, scripts/product-sku-lifecycle-smoke.mjs and supabase/migrations/20261026022352_ci038_sku_activation_guard.sql. Source includes rpc_create_product / rpc_update_product, rpc_create_product_sku / rpc_update_product_sku, and lifecycle rpc_set_product_sku_active. Client SKU creation explicitly supplies p_is_active=false. UI activation text distinguishes operational activation from costing READY.

Live metadata-only catalog SELECT from qhmoqtxpeasamtlxaoak captures five function definitions, five product_skus triggers and 44 source-epoch triggers in WP10_G1_EVIDENCE/live-guard-catalog-2026-11-15.json. No business-row writer, preview, role impersonation or completeness function was executed. No current SKU failure counts are inferred.

| Concern | Observed contract | Remaining proof |
|---|---|---|
| New activation | Enabled BEFORE trigger plus lifecycle RPC check use costing.fn_sku_activation_missing_items. Five essentials: approved PM BOM, effective batch size, valid approved production route, resolved MRP, resolved selling/GST. | Isolated transition fixtures; direct-table and RPC role checks, creation/update writer definitions still to inventory. |
| As-of date | Live helper uses latest cost period, then greatest(coalesced valuation/current_date, current IST date), reflecting CI-038a. | Reconcile exact migration trail and period/expiry scenarios; do not regress to older CI-038 valuation-only text. |
| Parent product | Enabled BEFORE trigger rejects active SKU when parent missing or not Active. | Trace product deactivation path and active SKU reassignment before claiming coverage or a defect. |
| Audit trail | Enabled AFTER INSERT/DELETE/UPDATE change-log trigger exists; lifecycle RPC also writes governed lifecycle audit with reason and auth/permission check. | Inspect audit function, writer paths and RLS/ACL metadata; runtime audit immutability not tested. |
| Existing active rows | Completeness trigger explicitly returns early on UPDATE when old.is_active is true. This is an existing deliberate activation boundary. | Analyse active edits and later dependency changes through recurring readiness; not sufficient evidence of a bypass defect. |
| Later changes | 44 enabled readiness epoch triggers cover product/SKU, PM revision, batch reference, several routes, policy and costing inputs. | Prove consumer freshness, schedules, expiry without row change, visible remediation/owner and failure handling. Trigger presence is not monitoring acceptance. |

## Audit direction
Reuse WP01–WP04 canonical readiness, source epochs, portfolio and remediation contracts. Do not implement a second readiness service or automatically deactivate SKUs. Separate prevention at creation/activation from detection after dependency/expiry changes. Operational Active, master completeness and costing readiness remain distinct. Missing/unknown evidence cannot silently become READY.

G1 must deliver full writer/transition/dependency matrix, exact live/source parity questions, meaningful offline positive/negative fixtures, baseline failures and minimal ranked G2 recommendations. Issue #438 contains the single bulk package. ChatGPT handles live read-only questions and independent review; no production writes, security/registry/flag/deployment or source guard weakening is authorised. G1 is not complete merely because existing activation guards exist.
