# WP05 R27 — D-2 six-view owner permission-policy decision matrix (12 November 2026)

**Classification: DESIGN / OWNER DECISION REQUEST.** R20 D-2 **approved the six-view closure-critical subset and verification**, not any new permission rule. No permission-policy selection, security migration, role/account change or production access test is approved by this document. The previous R21–R26 evidence and #297 remain authoritative. Formal WP05 OPEN, 6/13.

## Latest read-only metadata cross-check

Production project `qhmoqtxpeasamtlxaoak`, queried **pg_class + PostgreSQL ACL/reloptions/owner + view definition MD5 only**, no view rows or identity data, on 12 November 2026:

| View (public schema) | Owner | SQL anon SELECT | SQL authenticated SELECT | security_invoker | Definition MD5 |
|---|---|---|---|---|---|
| `v_costing_material_manual_rate_register` | postgres | No | Yes | false | `8a4c73fd3f4562679af3ed0638fa87` |
| `v_costing_material_manual_rate_history` | postgres | No | Yes | false | `e827e401cc2bb8ccadf782ee5b98add4` |
| `v_costing_material_review_acceptance_register` | postgres | No | Yes | false | `df6c6771423c2aecb0130822a804a239` |
| `v_costing_scheme_master_audit` | postgres | No | Yes | false | `001024540bdeab9f2e5aa4ec2a6f6c53` |
| `v_costing_pricing_sku_detailed_cost_sheet` | postgres | No | Yes | **true** | `85585c98e6f184fb9a4eb3351b008c2e` |
| `v_costing_pricing_cost_sheet_line_traceability` | postgres | No | Yes | false | `b67b4ee28e0eb19804c073cb83e14e11` |

The adjacent PPM scheme register and rule register views also have `authenticated` SELECT and `security_invoker=true`; Scheme audit is an **exception**. All six selected definitions end in `WHERE (SELECT fn_costing_view_allowed())`, whose code admits CCC/CBM/CSR/MCM View but omits PPM. `app_has_permission` delegates via `auth.uid()` to exact canonical `can_view` (R23). SQL `authenticated` SELECT **does not imply legitimate business reader status**, and postgres-owned, non-invoker views **must not be assumed protected by underlying table RLS**.

## Six-view intended-reader policy matrix — PROPOSED, NOT APPROVED

| Family / exact views | Confirmed consumer and displayed business need | Suggested minimum positive reader | Negative role / special exception needing business decision | Proposed disposition |
|---|---|---|---|---|
| MCM vendor provenance: `v_costing_material_manual_rate_register`, `v_costing_material_manual_rate_history` | MCM list, bulk history and item history consume full vendor origin, source rates, MOQ, lead time and remarks (R25) | **MCM View** for rate-management evidence, subject to owner confirmation of vendor detail entitlement | Are CCC-only / CSR-only / CBM-only viewers allowed supplier-origin and negotiated terms, or should they see only a rate/status projection? Procurement role may be separate. **Do not silently remove provenance columns**. | Closure-critical business policy pending; exact consumer test required |
| CCC material acceptance: `v_costing_material_review_acceptance_register` | Material-cost controller loads acceptance register and close-acceptance UI shows actor email, note and reasons | **CCC View** for audit/status as a *proposal*, with MCM cross-reader only if explicitly business-justified | Distinguish CCC/MCM **View** to read acceptance from CCC/MCM **Edit** to close it; CSR-only and CBM-only audit-actor access unapproved | Closure-critical business policy pending; do not execute close/write |
| PPM scheme audit: `v_costing_scheme_master_audit` | PPM Scheme History reads event, actor, approval reference and old/new remarks; #303 actor presentation fixed at source in #306 | **PPM View** for read-only history if owner approves, no implicit Edit requirement | **CCC/CBM/CSR/MCM-only** should not independently unlock sensitive PPM history *unless owner explicitly authorises exceptions*. Current helper omits PPM and includes these four. | **First decision candidate — exact view-specific permission policy**; current source-level risk, authenticated outcomes NT |
| CSR per-SKU detailed costing: `v_costing_pricing_sku_detailed_cost_sheet` | Shared Costing shell SKU detail tabs use labour, overhead, MRP and pricing bridge | **CSR View** for Cost Sheet detail | Confirm CCC/MCM legitimate SKU detail cross-read; because `security_invoker=true`, source ACL/RLS are additional independent gate; do not assert CCC-only access without test | Closure-critical classification pending; no blanket helper change |
| CSR Cost Sheet lineage: `v_costing_pricing_cost_sheet_line_traceability` | Printable Cost Sheet line explanation retrieves explicit field list including evidence JSON / drill filter and exact run | **CSR View** for authorised line explanation | Trace-specialist or MCM/CCC cross-access depends on business purpose, and sensitive JSON may require narrower presentation. Do not remove required drill features | Closure-critical classification pending, source projection already explicit |

These **are not existing permissions**, a verified negative-role matrix, or a request to immediately implement five separate changes. The owner may retain a justified cross-module exception on any individual view after its consumer and sensitivity requirements are documented.

## Single earliest owner ruling required

**Q-R27-PPM-AUDIT (pending):** Adopt **PPM View** as the positive read entitlement for *Scheme Master audit history*; deny users whose only Costing View permission is CCC, CBM, CSR or MCM, with no broad helper change. The alternative is to explicitly authorise named cross-module audit readers, specifying each allowed module and field level. Neither choice implies giving PPM Edit or opening unrestricted actor identifiers. **The owner has not yet decided.**

**No implementation until approved.** Once selected, prepare one minimal **view-specific** server migration candidate (not a rewrite of `fn_costing_view_allowed` globally) preserving the same 20 columns/client history and avoiding widened source-table grants; derive exact DB roles, view dependencies, roll-back, isolated positive/negative fixture and precondition fingerprint. Allow existing privileged support access only where explicitly warranted. Stage production migration only on a later explicit owner approval after reviewing candidate and rollback. Real signed-in tests require a separately agreed no-row-export protocol.

## Verification and governance gates

- **Already proved:** R22 live outer predicate and call sites; R23 exact permission chain/source dependency; R24 isolated logic model 6/6; R25 rendered/extracted fields; R26 #303 actor client fix merged #306 with all exact-head workflows successful.
- **Missing:** binding business-reader entitlement for any of six, effective authenticated role behaviour for each, complete cross-module consumer/export compatibility, and any owner-approved/view-specific SQL remediation.
- **Not required to repeat:** CCC Cost Comparison scoped ID-V/N/X/O signed-in proofs and Staff Governance accepted confidentiality tests; SEC-A1/A2 direct production writer denial remains intentionally NOT TESTED per D-1; Cost Comparison four-second p95 still HOLD per D-4.
- **Explicit stop rule:** no production GRANT/REVOKE, view rewrite, row read, staff/vendor export, role impersonation, account/session provisioning, production writer/preview invocation, SW cache bump, feature flag activation or Electron release. A source-level permission mismatch can be a **material policy risk** without being labelled a confirmed actual user data breach.

**Status:** W5-06 / D-2 **OPEN** (business-rule gate and effective-role evidence unresolved); W5-04/W5-09/W5-10 OPEN/PARTIAL as documented; formal programme **6/13**. R27 is the smallest decision-ready packet for #297, not another exploratory 49-view audit.
