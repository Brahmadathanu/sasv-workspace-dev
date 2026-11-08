# WP06 owner-decision package for first formal 6/13 gate — 8 November 2026

**Prepared for owner consideration only. No options below are approved merely by being listed here.** Formal costing programme **5/13** until a complete work-pack gate and owner signature. Sources: [WP06 ledger](WP06_FORMAL_CLOSURE_GATE_LEDGER_2026-11-08.md), [WP06 ID-V ON/OFF acceptance](WP06_IDV_NAV_GROUPS_ON_OFF_ACCEPTANCE_2026-11-08.md), [original owner record](OWNER_ACCEPTANCE_RECORD_2026-11-04.md) §4–6, [shared acceptance contract](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md) §8.

## A. What is already proven

- W6 five-group navigation + G1/F7–F9 client code and mock tests were merged and audited.
- Hosted authenticated ID-V with 6 view/0 edit privileges; v392 source/assets 72/72 verified. Browser-local NAV_GROUPS ON: 20/20 PPM deep links and 6/6 legacy/default routes, proper five groups; flags restored OFF; zero guard violations / server-delivered writes. No global flag activation.
- **Nine of ten PPM workspaces PASS** on both 1280 and 390 widths. **Scheme Master desktop 1280 F** due to 500/`57014`, seven rows at 390; earlier OFF desktop also failed. **Do not conceal this failure in signoff**. [Focused live plan review](SCHEME_MASTER_COLD_PATH_PLAN_REVIEW_2026-11-08.md). Commercial Sales Assumptions COMPANY/REGIONAL default-policy modals remain untested signed-in.
- Other-identity server-denial tests and full cross-module 40-lens/11-flag coverage remain incomplete. View-only observation is NOT proof of server-side denial.

## B. Decision sheet (owner fields intentionally blank)

| Decision | Current fact | Recommended proposed disposition for owner to evaluate | Residual risk / later milestone | **Owner decision (pending)** |
|---|---|---|---|---|
| **G-SCOPE** | Shared §8 literally calls for 40-lens and 11-flag signed-in evidence for a work-pack; WP06's own scope names ten PPM workspaces | Approve *amendment* that gives WP06 a bounded PPM-specific 10-workspace flag-ON/OFF gate while retaining non-PPM matrix/negative identities for WP05/WP12. Requires explicit acceptance-contract update if approved | Intermodule/flag interaction and denial tests remain unproved; retain WP12 matrix and WP05 security gate, not waived | PENDING |
| **G-BUILD** | Verified served source `main@883a9f1c`, cache v392, assets 72/72; recent non-docs drift absent | Confirm the named build as authorised evidence baseline, NOT production rollout approval | Cannot credit evidence to a different client source without source-parity verification | PENDING |
| **C9** | Shared registry marks policy manager not period-scoped; commercial sales assumptions has its own period filter, which worked for ID-V | Leave registry as-is and document workspace-specific picker, defer refactor to shared-registry follow-up | Period semantics may confuse users/future integrations | PENDING |
| **D7** | Maker-checker requirement for assumptions/default-policy/MRP is not yet settled | Park **policy decision**, maintain existing permissions/governance; do not silently authorise approvals | Approval-duty segregation remains policy question; milestone governance/policy review before change | PENDING |
| **F-4** | Integer-unit constraint on assumptions is server-contract question | Leave validation server-authoritative; defer UI/control changes | Fractional quantities may be accepted/rejected inconsistently until rule formalised; server specification gate | PENDING |
| **C6 / O-8** | `COST_REVIEW_WORKBENCH` / `COST_APPROVAL_WORKBENCH` route destination unmapped | Park new workbench navigation rather than invent a page; disclose limitation | Incomplete workbench navigation; WP05 IA/registry follow-up | PENDING |
| **D3** | CCC-edit can accept material-cost reviews without MCM-edit; existing server behaviour not changed | Record observed semantics and defer any least-privilege change to WP05 security decision | Cross-module privilege segregation still undecided; WP05 server-authorisation gate | PENDING |
| **Known desktop Scheme Master 57014** | Genuine ID-V 1280 F, 390 P; migration still installed | **Keep as BLOCKER for unqualified WP06 10/10**, or owner explicitly accepts a risk-bound deferral only after documenting user impact, workaround, verified cold-path follow-up and deadline; no auto deferral | Desktop users may fail to view Scheme Master; issue #224 performance review | PENDING |
| **CSA default-policy modals** | Signed-in open/cancel for COMPANY/REGIONAL IK/OK not yet recorded | Complete one bounded read-only modal verification before closure; do not park without owner reason | Context/region field correctness not live verified; issue #222 | PENDING |
| **Negative identities / writer denial** | ID-V shows no visible write actions, but ID-N/ID-X/ID-O and server denial not proven | Preserve independent security gate; do not invoke writer RPCs on production; owner decides future isolated proof | Authorization regressions; WP05/WP12 isolated security testing | PENDING |

**Important:** The shared contract cannot be silently narrowed by an assistant or by Claude. If G-SCOPE is approved, write an explicit versioned amendment documenting exactly which gates are transferred (and to where), retaining named owner and risk. A deferred risk is not a passed functional test.

## C. Minimum remaining proofs before asking for Gate Status

1. Resolve or expressly and defensibly defer Scheme Master desktop failure after issue #224's root-cause assessment; no more false all-green signoffs.
2. One narrowly supervised ID-V read-only navigation of CSA default-policy revise modals (COMPANY and REGIONAL IK/OK), cancel/close without saving; exact source and network proof.
3. Owner decides G-SCOPE, G-BUILD, C6, C9, D3, D7, F-4 and records deferred risk/milestone/owner in `PARKED_BACKLOG.md`.
4. Reconcile actual PPM 10-workspace P/F/NA/NT results and outstanding broader §8 obligations, then *only after full criteria* record dated owner acceptance and formal WP06 Gate Status in `WP-06-PRICING-POLICY-MANAGER.md`.

**No production SQL/permissions/flags/deploy/refresh approved by this document. No work-pack is closed.**


## D. Owner decisions and subsequent evidence — superseding addendum, 8 November 2026

**Owner approved** the recommended dispositions **G-SCOPE, G-BUILD, C9, D7, F-4, C6/O-8, D3 and Scheme Master** in the conversation on 8 Nov 2026, explicitly instructing the repository acceptance-contract amendment, deferred risk registration and formal reconciliation. Earlier `PENDING` cells in §B are historical and **superseded for these named decisions**, not a present refusal or missing approval. Other-identity/writer-denial tests were *not* separately approved for production invocation; A1 moves them to WP05/WP12, not a PASS.

- **G-SCOPE — APPROVED:** A1 to shared §8: WP06 bounded to the ten PPM workspaces under NAV_GROUPS OFF/ON and restricted ID-V; cross-module 40-lens/11-flag and negative identity tests retained under WP05/WP12.
- **G-BUILD — APPROVED:** served `main@883a9f1c`, cache v392, verified 72/72 assets accepted as the ID-V test evidence baseline, not production rollout.
- **C9 — DEFER:** keep PPM registry periodScoped false and independent CSA picker, revisit shared registry.
- **D7 — DEFER:** maker-checker policy decision; no write/approval-authority change.
- **F-4 — DEFER:** server-authoritative integer-unit decision; no client validation change.
- **C6/O-8 — DEFER:** unmapped review/approval workbench routes; do not invent destinations.
- **D3 — DEFER:** CCC-edit/MCM-edit cross-module review acceptance semantics to WP05 security.
- **Scheme Master — RISK-ACCEPTED FOR BOUNDED WP06 FUNCTIONAL ACCEPTANCE, MONITOR:** approved concurrent `(scheme_id,period_start)` index installed and validated live, **1624 kB**, valid/ready. Owner observed initial seven schemes plus **3/3 desktop refresh PASS**, after the earlier 1280px ON/OFF 500/57014 failures. Do not erase earlier F or claim measured DB speedup: the post-build safe planner still preferred the older period/status index. Keep #224 under monitoring.
- **CSA modal — EVIDENCED BY OWNER:** page PASS, Revise dialog PASS, COMPANY/REGIONAL IK/OK scope controls PASS, Cancel without save PASS. This is an owner-reported visual/open/cancel test, not an independent network trace or server-side write-denial proof.

**Formal closure:** bounded WP06 functional acceptance can be considered, but the initial failed ID-V 1280 run remains recorded and later owner observations lack exact served-build/HTTP timing capture. The owner's approval of the dispositions is **not a separate explicit final Gate Status signature**. Reconcile in `WP-06-PRICING-POLICY-MANAGER.md`; keep programme **5/13** pending its final sign-off record. No SQL, user/permission change, flag rollout or new client deployment is authorised by this addendum.
