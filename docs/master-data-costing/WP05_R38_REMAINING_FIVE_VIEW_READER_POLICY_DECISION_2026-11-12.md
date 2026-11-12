# WP05 R38 — Remaining five D-2 views, business-reader decision packet (12 Nov 2026)

**READ-ONLY REVIEW / POLICY PROPOSALS, NOT OWNER APPROVAL.** Follow-up to R37 owner's visible Scheme History confirmation and approved/applied R28/R34 Scheme audit correction. The five remaining closure-critical views are **not changed**. This is a bounded business decision packet for issue #297; W5-06 OPEN and programme **6/13**.

## Current live metadata, rechecked without source-view row SELECT

All five views are owned by `postgres`, have `authenticated` SQL SELECT, disallow `anon` SELECT, and retain the *shared* `WHERE (SELECT fn_costing_view_allowed())` gate checking any CCC/CBM/CSR/MCM View. This gate is **not necessarily correct** for sensitive module-specific output; table grants and invoker mode separately matter.

| View | MD5 definition | Cols | security_invoker | SQL service_role grant | Notes |
|---|---|---:|---|---|---|
| `v_costing_material_manual_rate_register` | `8a4c73fd3f4562679af3ed0638fa87e4` | 34 | false | absent | Depends on manual-rate history and review views; includes vendor provenance |
| `v_costing_material_manual_rate_history` | `e827e401cc2bb8ccadf782ee5b98add4` | 32 | false | absent | Directly includes material manual rate records and supplier details |
| `v_costing_material_review_acceptance_register` | `df6c6771423c2aecb0130822a804a239` | 38 | default false | **present** | Controller acceptance including actor and note |
| `v_costing_pricing_sku_detailed_cost_sheet` | `85585c98e6f184fb9a4eb3351b008c2e` | 44 | **true** | **present** | SQL base-table/view grants plus RLS may impose extra restrictions |
| `v_costing_pricing_cost_sheet_line_traceability` | `b67b4ee28e0eb19804c073cb83e14e11` | 40 | default false | **present** | Includes JSON trace/evidence drill details |

**Crucial lesson from R31:** `service_role` appearance in an outer permission predicate is **not equivalent to a SQL SELECT grant**. Do not carry a single view's grants/owner-rights assumptions to another. The two manual rate views have no explicit `service_role` grant, whereas the other three do.

## Source-level business need — previously verified under R25

- **MCM manual rate register and history:** client `costing-suite-material-cost.js` uses `select('*')` in register and history views; actual UI renders origin/vendor name, source vendor rate, MOQ, lead time, validity and remarks. Preserve required provenance in authorised flow.
- **CCC material acceptance:** the controller reads `select('*')` and uses acceptance status, responsible actor email and acceptance note; reading acceptance is separate from authority to close/approve/write.
- **CSR detailed Cost Sheet:** shell's SKU detail reader uses `select('*')` and displays material, labour, overhead, MRP, selling/pricing bridges. Invoker-rights mode means a simple outer predicate change is not enough to establish real caller access.
- **CSR line traceability:** printable Cost Sheet line source uses explicit selected column list, including `trace_source_snapshot`, `evidence_json`, and `drill_filter_json`; trace explanation must not be broken by uninformed field projection changes.

## Three independent owner business policy decisions (none approved)

**Q-R38-MCM:** Should full rate register/history with source vendor identities, negotiated rates, MOQ, lead time and remarks be read by **MCM View only**? Or should specific CCC/CSR/CBM View roles also see the *full provenance*? If some other module needs only effective cost/status, a separate restricted projection may be preferable to broad full-history access. Procurement permissions are distinct and not silently implied.

**Q-R38-CCC:** Should the material review acceptance register including actor identity and notes be read by **CCC View only**? Or may **MCM View** also read the full acceptance history (or a summary)? CCC/MCM Edit and existing writer-close governance are entirely separate.

**Q-R38-CSR:** Should **CSR View only** read full SKU detailed Cost Sheet and traceability JSON? Or should specific CCC/CBM/MCM View users also access full details/line evidence? Note detailed SKU view has `security_invoker=true`, so additional underlying access/RLS verification is required and automatic cross-read must not be promised.

**Recommendation:** start with the primary module View in all three as **least-privilege default**, but do not turn this into production SQL until the owner confirms necessary cross-module flows and sensitivity boundaries. Unlike the already approved PPM audit policy, it is possible that supervisors in CCC legitimately need full CSR Cost Sheet, and MCM needs acceptance status. Source verification alone does not settle that business judgment.

## Engineering and verification gates after exact owner approval

1. For each family, inventory the real callers and any cross-module UI screens/exports. Verify that limiting the view does not silently break other legitimate consumers.
2. Prepare separate guarded view-specific candidates and isolated PG17 role-test fixtures that preserve all existing output contracts and each view's actual `relacl`, `security_invoker` option and dependencies. For MCM register/history, test nested-view dependency and rate-origin consumers. For CSR detail, verify source ACL/RLS effects under real `security_invoker=true`.
3. Obtain **separate production execution approval** after independent review. No alteration to global `fn_costing_view_allowed`, no blanket revocations, role provisioning, sensitive row exports or ungoverned writer tests.
4. For real signed-in tests, collect minimal success/denial evidence without copying vendor, staff, cost-sheet or trace JSON payloads. An empty result under a view WHERE-deny gate is not a confirmed caller permission PASS.

**Current status:** Q-R38-MCM / Q-R38-CCC / Q-R38-CSR = **PENDING OWNER POLICY DECISIONS**. All five live view definitions unchanged by this review. R37 owner-observed Scheme audit history remains positive, denied-role evidence not proven; W5-06 OPEN; WP05 formal **6/13**. D-1 writer denial NT, D-4 p95 four-second HOLD, AE1 frozen baseline unchanged.
