# WP08 — Independent G2 audit and conditional closure recommendation (15 November 2026)

**Disposition: CONDITIONAL CLOSURE RECOMMENDED ONLY AFTER OWNER SCOPE ACCEPTANCE; NOT A WP08 SIGN-OFF.** The work package is **OPEN**, with 8/13 programme WPs closed. No new source changes, SQL, grants, flags, deployments or Electron release are authorised by this report.

## 1. Evidence independently examined

- Source authority: `WP-08-MASTER-DATA-NAVIGATION.md`; `WP08_G2_OWNER_APPROVED_SHARED_PLATFORM_CONTRACT_2026-11-14.md`; `WP08_G1_SOURCE_PINNED_NAVIGATION_AUDIT_REPORT_2026-11-14.md`; `WP08_G2_1_BULK_IMPLEMENTATION_AND_GATE_REPORT_2026-11-14.md`; `WP08_G2_1_HOSTED_ACCEPTANCE_REPORT_2026-11-15.md`. Older G0/G1 unstarted and G2-1 draft-stage text is **historical**, not current evidence.
- G2-0: shared-source migration and source/security tests merged via #409/#416 and follow-up; production registry Step A applied under owner authorisation with receipt `2026-11-14 15:00:14.880955+00`, unchanged Electron routes; authenticated PWA four-launcher PASS and read-data PASS; issue #410 completed. Electron Step B was explicitly *not authorised/executed*.
- G2-1: PR #427 merged squash `63b536f3712b91d63aff55ece1990844309f91dd`; 7/7 CI workflows PASS including inherited shared-service-worker regression, Netlify deploy preview PASS. Not a PEC work-package reopening. Final docs and positive-role PWA evidence in PR #428, merged squash `f284682726a4eb3669b8236392481bba75b14d27`.
- Hosted deployed-byte verification, `g2-0-23f194af7e8fbdf8277a36946e370cd0` gate PASS and 11 G2-1 changed `public/` assets exact-match: **operator-attested**, recorded in the hosted report; independent audit reviewed the retained report, not a repeat direct fetch from this environment.
- Independent read-only live definition of `rpc_pm_ovr_list(bigint)` and its `rpc_plm_ovr_list(bigint)` callee showed SELECT-only SQL (even though both are declared VOLATILE), with no function execution. No writer or preview/rebuild RPC was run during WP08 acceptance.

## 2. Gate-by-gate conclusion

| WP08 subject | Disposition | Boundaries |
|---|---|---|
| G1 source/navigation audit, Product/SKU/route contract | **PASS** | Historical G1 gaps were source-traced; no evidence for removing launcher entries |
| G2-0 canonical shared PWA/Electron implementation | **PASS for shared-source migration and tested route parity** | Actual final Windows/Electron binary acceptance **NOT TESTED**, WP12 |
| G2-0 live four-row PWA registry + launcher | **PASS** | No Step B Electron repoint; original Electron routes preserved |
| G2-1 permission-gated resolver (four exact destinations) | **SOURCE/ISOLATED TEST PASS; hosted Costing-side clicks NOT TESTED** | Do not call the four Costing-side paths live PASS |
| G2-1 selection-only Product/RM/PM/SP links | **HOSTED POSITIVE-ROLE PASS** | Product 1/SKU 1, RM 18 lines, PM Overrides, SP owner_item_id 1100 with 37 lines; invalid IDs/Back-Forward verified; no writers |
| G2-1 destination permission denial and view-only controls | **ISOLATED PASS; real negative/view-only identities NOT TESTED** | No new grants/accounts; retain WP12 role matrix or a small WP08 residual check if owner requires pre-closure |
| New-tab opening (browser) | **PARTIAL** | target=_blank / noopener / href observed; browser automation pane blocked opened tab; direct destination independently PASS; Electron child-window **NOT TESTED** |
| 390px PM BOM | **FAIL**, existing WP11 UX-P05 | Page scrollWidth 563px at viewport 390px; do not label PASS |
| Pricing Policy `MRP_GOVERNANCE` / `SELLING_SCHEME_POLICIES` | **AMBIGUOUS / TEXT ONLY** | Multiple plausible workspaces; current PPM does not apply Product/SKU URL identity |
| `BATCH_SIZES` / `REGIONAL_MARKETING_REVIEW` | **UNMAPPED**, by design | No destination was proven; no new route may be invented |
| Product/SKU→RM/PM/PRM and RM→Product handoffs | **HOSTED POSITIVE-ROLE PASS** | SP BOM owner key is a stock item; there is no presumed Product→SP association |
| Costing→Master Data `MANAGE_PRODUCTS` / `PM_BOM_MANAGER` | **NOT IMPLEMENTED; OPTIONAL owner-scope decision** | Inbound contracts now exist, but Costing route config does not own those targets |
| Final integrated flags/Electron release/security | **NOT TESTED / WP12 OPEN** | No release-wide PASS or WP12 closure implied |

## 3. Owner decisions — choose one bounded disposition per item

1. **Pricing workspace policy.** Recommendation: **retain text-only** for `MRP_GOVERNANCE` and `SELLING_SCHEME_POLICIES` in WP08; send workspace selection and genuine Product/SKU focus to a separately approved PPM contract/work package. Nonbinding candidates from G2-1 report: `sku-mrp-policies` and `sku-overview`; do **not** activate based on this recommendation.
2. **Costing→Master Data reverse bridges.** Recommendation: defer `MANAGE_PRODUCTS` and `PM_BOM_MANAGER` reverse route additions until registry/permission and live Costing-side target evidence are acceptance-tested as a single bounded follow-up. Retain existing server route text; no fabricated navigation.
3. **Unmapped route owners.** Recommend keep `BATCH_SIZES` and `REGIONAL_MARKETING_REVIEW` explicitly unmapped until the actual owning module and consumer contract are identified. This is not an authorisation to build a new top-level module.
4. **Identity/role release evidence.** Recommend preserve the real denied/view-only **NOT TESTED** as a named WP12 acceptance obligation (or, if the owner requires it for WP08 specifically, perform one bounded non-mutating identity run before closure). Do not translate isolated mock PASS to live PASS.
5. **Electron Step B.** Recommend **continue to defer** production registry route repoint pending Electron packaged-asset and direct/legacy URL proof at WP12; do not execute `03_optional_repoint_electron_routes.sql` under the earlier Step A approval.

## 4. Work-package routing and ownership

| Concern | Assigned boundary |
|---|---|
| Product/SKU/BOM/PRM resolver, source sharing and initial handoffs | WP08 implemented; retained evidence |
| Larger launcher information architecture, item grouping and top-level consolidation | **WP09**; G1 found no proven redundant launcher entry. Do not remove labels or entries in WP08 |
| PM BOM 390px horizontal overflow, UX-P05; Product SKU Deactivate label contrast | **WP11**; latter tracked in **issue #429**. Never press live Deactivate to test contrast |
| Hosted Costing-side resolver verification, denied/view-only identities, installed-PWA freshness, Electron route/new-window behaviour, 11-flag integrated and Windows final release | **WP12 integrated acceptance** unless owner chooses a WP08-specific preclosure subgate; carry statuses unchanged |
| PPM SKU/Product identity consumer and mapping of ambiguous workspaces | **Separate PPM governance design decision**; can be future work after WP08 without pretending linked identity works |
| Unproven `BATCH_SIZES` / `REGIONAL_MARKETING_REVIEW` destinations | Explicit unmapped backlog awaiting an identified owner |
| Historical PEC CI check | Shared repository safety check **passed**; **not** PEC development or a WP08 functional gate |

## 5. Conditional closure decision

**Recommend that the owner approve a bounded WP08 completion scope**, consisting of G1 + G2-0 + implemented G2-1 and positive-role PWA acceptance, while formally receiving the named WP09/WP11/WP12/PPM obligations above. The programme could advance from **8/13 to 9/13** *only after* the owner accepts the exact transfers and WP08 final sign-off is recorded. **This report does not close WP08 or amend the programme count.**

**Do not recommend unconditional closure yet**, because live Costing-side navigation and denied/view-only tests remain NOT TESTED, PM BOM mobile remains FAIL, new-tab/Electron remains PARTIAL/NOT TESTED, and Pricing mappings still require an explicit non-activation decision. None should be silently relabelled PASS.

Next required action: present the five owner dispositions above for acceptance, make sure the WP12 receiving workpack/backlog explicitly retains the inherited test cases, then issue a signed WP08 closure decision or commission only the single narrow preclosure check the owner chooses. Avoid redoing G2-0, G2-1 implementation or PEC. No code changes in this documentation-only audit.
