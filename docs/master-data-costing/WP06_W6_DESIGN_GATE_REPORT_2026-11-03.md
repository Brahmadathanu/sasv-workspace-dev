# WP06 / W6 — Design-gate report (3 Nov 2026)

**Outcome: STOPPED at the design gate. No code changed.** Base `main` `85a163f2bc36476953939bfb637b81f632d6b9b9` verified (N1 merged as #133, working tree clean).

## 1. Authorisation check

| Requirement | Evidence | Result |
|---|---|---|
| N1 merged | `85a163f` = "MDC-07 N1 … (#133)" | Met |
| WP06 design approved | `WP-06-PRICING-POLICY-MANAGER.md`: "Approved design / contract: Not yet approved"; gate `WP06G0 — NOT STARTED`; `MASTER_PROGRAMME.md` WP06 unchecked | **Not met** |
| Owner brief | A6: "Nothing here is authorised beyond a written owner brief" — the brief makes implementation conditional on an approved W6 design | Conditional |

A3 accepts Tier 1 presentation grouping and maps PPM workspaces to labels, and N1 ships a `controllerManaged` PPM contract, but neither is a WP06 approved design for the PPM controller. The contract and the controller already disagree (below), so implementing would mean choosing the design myself.

## 2. Evidence for the design

**Current controller (`costing-suite-pricing-policy.js`)** — 3 presentation groups, 10 workspaces, strip order = array order:
- `mrp-policy-setup` "MRP Policy Setup": sku-mrp-policies, product-derivation-policies
- `mrp-change-workflow` "MRP Change Workflow": mrp-proposals, proposal-decisions, approved-for-application, applied-proposal-history
- `selling-schemes` "Selling & Schemes": sku-overview, scheme-master, scheme-rule-register, commercial-sales-assumptions

Legacy lens ids `mrp-governance` (workspaces 1–6) and `policy-manager` (7–10) and `PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE` resolve inbound URLs; default landing `sku-overview`. Group ids are validated in-controller (`validatePricingPolicyNavigation`, ~L283–310) and exercised by `scripts/ppm-n6-nav-resolver-smoke.mjs`.

**N1 contract (`costing-nav-groups.js`, `COSTING_PPM_NAV_GROUP_CONTRACT`, 5 groups, all 10 ids):** `sku-policies` {sku-overview}; `mrp` {sku-mrp-policies, product-derivation-policies}; `mrp-change-workflow` {proposals, decisions, approved, applied history}; `schemes` {scheme-master, scheme-rule-register}; `costing-inputs` {commercial-sales-assumptions}. The shell never renders it and N1 tests assert it never consumes it.

## 3. Decisions required from the owner

1. **Adopt the N1 5-group contract verbatim?** It moves `sku-overview` out of "Selling & Schemes" (and to the front of the strip, changing display order but not the default landing), moves Commercial Sales Assumptions to a separate "Costing inputs" group (grouping only; relocation D4 stays deferred), and renames group ids/labels. Any amendment (e.g. splitting "Proposal Decisions" from the rest of the change workflow, which the brief asks to distinguish) requires an N1 helper edit, which this package may not make.
2. **Group ids:** the controller's existing ids (`mrp-policy-setup`, `selling-schemes`) are pinned by its validator and smoke script; confirm they may be replaced and those checks updated within W6's focused tests.
3. **Label wording:** approve exact group and workspace labels (current workspace labels are already distinct; proposed change is group labels only unless you want e.g. "Proposal Decisions" renamed). Single-workspace groups ("SKU policies", "Costing inputs") need an explicit nod.
4. **Flag consumption:** N1 declares PPM `controllerManaged`; confirm the controller may read the existing exact-`1` `COSTING_NAV_GROUPS_V1` flag itself (no new flag, no shell change). Flag-OFF must remain byte-identical to today's 3-group strip.
5. **C9 (`policy-manager.periodScoped:false` while CSA is period-scoped):** the mismatch lives in `costing-suite-registry.js` (L158), which is N1-owned and outside W6's files. The controller's own metadata is already correct (only CSA has `supportsPeriod`). Choose: (a) document C9 and fix it in a separate N1-owner registry change, or (b) authorise that one-line registry edit explicitly. W6 cannot fix it in-scope.
6. **Start WP06:** record G0→design-approved in `WP-06` so the entry criterion is satisfied.

## 4. Unchanged by this report
Policy-edit permissions, proposal decision governance (D7 maker-checker still undecided and out of scope), effective-dated data behaviour, RPC sets, `?workspace=` URLs, legacy lens redirects, and workspace identity. No server writes, migrations, cache bump, flag activation or deployment. No PR opened.

## 5. Ready to implement once decided
Plan: controller-only grouped strip behind the N1 flag (OFF path untouched), new focused test file for deep links, legacy redirects, permissions and Chromium interaction, then full LF/CRLF suite (baseline 511 after N1; re-verify). Draft PR, stop at independent review.
