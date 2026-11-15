# WP10 G1 — Independent live reconciliation (15 November 2026)

**Audit correction / G2 HOLD. WP10 OPEN, programme 10/13.** Reviewed PR #439 at b84943457460936b945adaf235b41508822a7a2d, main 5ad28a87. Owner already authorised direct read-only audit; O5 is satisfied, not another approval question. No SQL write, writer/readiness/preview invocation, flag or permission change occurred.

## Metadata answers Q1–Q9
Evidence: WP10_G1_EVIDENCE/independent-live-catalog-2026-11-15.json. Full function text/ACLs were read instead of relying on name/regex inference. Cron commands are excluded to avoid collecting unrelated operational payloads.

| Question | Result / bounded interpretation |
|---|---|
| Q1 | Four live create/update writer definitions and ACLs captured. Public entry RPCs call require_permission and auth.uid, write governed audit records. SKU update arguments expose no product_id or active-state field. Active insert flag still reaches table triggers. Runtime writer success/denial was not tested. |
| Q2 | Five existing guard/helper/RPC ACLs captured. Do not infer role behaviour solely from SECURITY DEFINER; reconcile explicit EXECUTE and permission checks. |
| Q3 | Enabled products BEFORE UPDATE OF status trigger calls fn_guard_product_inactivation_requires_no_active_skus; its live text rejects Inactive transition with active child SKU(s). G-3's missing-product-guard uncertainty is resolved at catalog level. Zero-SKU product visibility remains a separate design question; historical counts are not current counts. |
| Q4 | Products, product_skus and audit/change-log tables have RLS enabled; authenticated INSERT/UPDATE/DELETE table privilege false for all five. Only authenticated SELECT policies on products/product_skus appeared. service_role UPDATE privilege true. Re-parent fixture is a privileged-writer structural boundary, not evidence that ordinary client users can bypass activation. Real identities were not tested. |
| Q5 | Fingerprint includes governed period/valuation date, matching successful evidence run, source epochs, canonical definition hashes and source schema hashes; it does not include today's date. Portfolio read matches digest/valuation/run and otherwise raises ABSENT/INCOMPLETE/STALE. This is period-as-of freshness, not a promise of present-day expiry detection. |
| Q6 | 34 cron rows captured as names/schedules/active plus boolean command classification. None directly mentions readiness or calls the builder; pg_proc source scan found no direct builder caller. External scheduler/worker, indirect dynamic calls and human ownership are NOT PROVEN. No schedule was created. |
| Q7 | Existing health/freshness table names captured; only the portfolio RPC directly references STALE/ABSENT tokens in function source. Names/source scan do not prove an alert consumer exists or that none exists externally. |
| Q8 | Four MRP/selling/route resolver definitions captured. Their base-table/dependency closure must now be compared to the 44-hook inventory before G-6 is treated as resolved. No live completeness functions called. |
| Q9 | Full readiness read definitions captured. Governed valuation date and activation helper's greatest(valuation,current IST date) serve different contracts. Calendar expiry after a fixed valuation need not invalidate that period's correct READY result. A current-operational expiry lens is a separate requirement and must not silently change LIVE_AS_OF semantics. |

Optional build-history rows were not read: no current build age or current SKU deficiency count is asserted.

## Corrections required before G2
1. Rewrite executive claims that ownership is absent or expiry is a confirmed high-severity freshness defect. Retain no direct cron/caller found with explicit scope; ask business owner for ownership rather than infer it from source.
2. Narrow re-parenting risk to privileged direct writers. Standard authenticated DML is denied and existing SKU update RPC cannot re-parent. Decide whether to prohibit such privileged changes or require reviewed remediation, without automatic deactivation.
3. P2 cannot evaluate today+N by calling fn_sku_activation_missing_items: signature is (sku_id, product_id default null); its date is internal. A valid future-expiry design needs effective-boundary inspection using canonical resolvers or a separately reviewed date-parameterised internal contract. Do not implement a second readiness calculator or alter existing activation/LIVE_AS_OF semantics.
4. Replace writer/product-inactivation/price-list/change-log/resolver stand-ins with live-verbatim definitions where now available, or explicitly retain uncaptured dependencies as stand-ins. Existing 43/43 and 7/7 results remain historical fixture evidence; no new live acceptance follows from this catalog read.
5. Reconcile transition/dependency CSVs, ACL claims, generator outputs and gap severity with this snapshot. Compare Q8 resolver tables to hooks; inspect schedules/callers outside the scanned catalog only if an actual source is identified. Do not create an alert/rebuild architecture from a partial absence claim.

## Independent review position and decisions
Branch reuse is acceptable because the old #434 branch is merged and #439 starts at current main; no migration differences should be discarded. Client use of the existing activation pre-check remains a plausible bounded improvement, with server rejection authoritative and existing fail-closed behaviour preserved.

O1–O4 remain business/design decisions, **not implementation authority**: propose a named Costing Control Center operator accountable to the owner; agree an explicit stale-age target after workload/current-build metadata are measured; consider a 30-day operational expiry horizon only after valid date semantics are designed; prefer rejecting unreviewed active re-parenting if the owner selects prevention. A scheduled database rebuild is a production writer operation requiring separate exact approval, not an ordinary read-only reminder.

G1 remains OPEN for one consolidated reconciliation on existing #439. ChatGPT can correct metadata/evidence directly; no additional DB-access handover or new source-audit PR is needed. Preserve all WP09 closure, WP11 defects and WP12 NOT TESTED cases. Do not merge or implement G2 from this audit.
