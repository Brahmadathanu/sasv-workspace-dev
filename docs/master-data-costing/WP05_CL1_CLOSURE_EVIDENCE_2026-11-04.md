# WP05-CL1 — closure evidence register (test-only package) — 4 Nov 2026

Baseline `main` `195b13c4df32a5fdcf22ee304066e96c1b138481`. This package adds checked-in assertions (`scripts/costing-wp05-closure/wp05-closure.test.mjs`, 13 tests) and this register. **No source, flag, metadata, server or Supabase change; WP05 is not declared closed by this document.** The "Proposed Gate Status" in §5 is text for the owner/independent reviewer to accept or amend.

## 1. What is delivered on `main` (WP05 + dependent packages)
| Package | PR | Flag (default OFF) | Checked-in evidence |
|---|---|---|---|
| P01 SKU Control vs Readiness parity | #132 | `COSTING_RUN_STATUS_V1` family / readiness usability | `scripts/costing-readiness-usability`, `wp04-readiness-client-contract-smoke` |
| P02 Production Route corrections (C1–C3, fixed-context labels) | #131 | `COSTING_PRM_CORRECTIONS_V1` | `scripts/costing-prm-corrections` (node + Chromium) |
| N1 grouped navigation | #133 | `COSTING_NAV_GROUPS_V1` | `scripts/costing-nav-groups` |
| N2 Material Cost / Cost Build grouping, trace-tab fail-closed | #136 | `COSTING_NAV_GROUPS_V1` | `scripts/costing-nav-mcm-cbm` |
| N3 cross-links | #134 | `COSTING_NAV_GROUPS_V1` | `scripts/costing-cross-links` |
| N4 PRM navigation context | #135 | `COSTING_PRM_NAV_CONTEXT_V1` | `scripts/costing-prm-nav-context` |
| W6 Pricing Policy five-group projection | #139 | `COSTING_NAV_GROUPS_V1` | `scripts/costing-w6-pricing-nav` |
| U11 worklist label harmonisation | #144 | `COSTING_UX_CONSISTENCY_V1` | `scripts/costing-ux-consistency` |
| A7 material review acceptance regression | #146 | — (existing workflow) | `scripts/costing-material-review-acceptance` |
| CL1 closure checks (this package) | draft | — | `scripts/costing-wp05-closure` |
| CDE-1a draft-run evidence section | #149 draft | `COSTING_REVIEW_WORKLIST_V1` | `scripts/costing-draft-run-evidence` |

## 2. New assertions in this package (what each proves)
| Test group | Proves | Closure item |
|---|---|---|
| Flag inventory | exactly **eleven** `COSTING_*_V1` flags exist in `public/shared/js`; a twelfth fails the test until the matrix is extended | WP12 flag matrix |
| Flag semantics | each flag is OFF for missing/`null`/`""`/`"0"`/`"true"`/`" 1"`/numbers/booleans/missing or throwing storage and ON only for exact `"1"` | default-OFF compatibility |
| Flag independence | an 11 × 11 matrix: setting one key enables only that flag; each flag reads only its own key | ON/OFF combinations |
| Route table | six modules; `permissionTarget = module:<key>`; page file exists; default lens allowed; every allowed lens registered; no lens silently dropped | six-module acceptance |
| Lens ownership | every registered lens resolves to exactly one owning module; legacy PPM aliases map to `pricing-policy-manager`; unknown/empty → `null`; `scheme-comparison` → `cost-sheet-review` | deep-link integrity |
| Suite/lens agreement | each suite lens is registered and points back; no lens in two suites | registry integrity |
| C6 resolver | which `recommended_ui_route` codes navigate and where; `COST_APPROVAL_WORKBENCH`, `COST_REVIEW_WORKBENCH` and unknown codes stay non-navigable; targets carry the governed period/ids and never a run id; every navigable target names a real module and one of its lenses | C6 (characterisation) |
| C8 | exhaustive fail-closed matrix of `resolveTraceNavVisibility` (flag × resolved × rm × pm × current lens, including non-boolean inputs) | C8/D8 |
| S3 / C9 | no PPM workspace named Status; SKU Policy Overview is not period-scoped; Commercial Sales Assumptions is the only period-scoped PPM workspace; the registry nevertheless marks `policy-manager` and `mrp-governance` `periodScoped:false` | S3 resolved as "not locatable", C9 pinned |
| Test-only guard | nothing under `public/`, `supabase/`, `sql/` or `package*.json` differs from the base | scope |

Mutation checks: loosening one flag comparison, renaming one permission target, relaxing the trace gate, and making `COST_APPROVAL_WORKBENCH` navigable each fail the suite.

## 3. Residual register after this package
| ID | Item | Disposition | Gate |
|---|---|---|---|
| C1–C3 | P02 corrections | delivered; owner signed-in ON acceptance outstanding | owner |
| C5 / D5 | runs 80/82 fixed contexts | labelled; selector needs a server selection contract | server first |
| C6 | `COST_APPROVAL_WORKBENCH`/`COST_REVIEW_WORKBENCH` unmapped | behaviour pinned; destination needs O-8 | owner |
| C8 | trace tabs without trace roles | closed by existing N2 tests plus the exhaustive matrix | none |
| C9 | `policy-manager.periodScoped:false` vs period-scoped CSA | pinned as a characterisation; not changed | owner authority |
| S2 | printable Cost Sheet vs SKU Cost Details divergence | needs a read-only data comparison | owner/server session |
| S3 | PPM "Status tab" period handling | not locatable; SKU Policy Overview is non-period by design | closed as n/a |
| S9 | KPI strip reloads on every CCC lens | cost not measured | measure first |
| D3 | CCC-edit can accept reviews without MCM-edit | open | owner policy |
| D2 / D4 | Readiness↔SKU Control merge; CSA relocation | Tier-2, explicitly **non-blocking** for WP05 closure: both are optional re-organisations that change no delivered behaviour and need parity usability work first | optional |
| CDE-1b | real draft-evidence provider | needs the protected read contract (CDE-2) | owner/server |

## 4. Owner signed-in acceptance checklist (cannot be run in the cloud)
For each of the eleven flags, as a signed-in role with the relevant module access, flag OFF then ON: the six Costing modules open; lens switch; period switch; deep link (`?lens=`, `?module=`); a view-only role sees no write control; no console error. Specific: N1 grouped nav + context chip; N2 trace entries hidden for users without trace rights; P02 C1–C3; run-picker 143↔148; CDE-1a unavailable state (provider not connected). Record role, date, browser, result.

## 5. Proposed Gate Status text (not applied)
`WP05 — OPEN until (a) PRs #149 and the CL1/G1 packages are reviewed and merged by the owner, (b) the §4 signed-in checklist is recorded, and (c) C6/C9/D3 are decided or explicitly parked. Tier-2 items D2/D4 are parked as non-blocking. CL2 (table-level fix link) depends on O-8.`
