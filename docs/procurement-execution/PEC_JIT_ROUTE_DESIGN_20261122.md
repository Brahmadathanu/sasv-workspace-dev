# PEC — procurement-route-aware PR generation (issue #502): server design, evidence and gates

**Status:** source + disposable-fixture proof only. **Nothing is installed in production.** v6.3.1 (stable) is untouched; no release is published by this work.

## 1. Current behaviour (read from the repository, before any change)
| Item | Finding |
|---|---|
| `v_mrp_procurement_plan.procure_qty` | Already **stock-netted** (view exposes `opening_qty → net_need_qty → procure_qty`, with pre/post MOQ-ceiling columns). Stock must not be deducted from it again. |
| `proc_pec_s4_new_pr_plan` | Candidate = MRP rows ∪ consumption-only items; `recommended = ceil-by-MOQ(max(MRP, 12-month consumption − stock) − open indents)`; fail-closed gates in order: `STOCK_MAPPING_REVIEW` (no/duplicate/foreign stock row), `STALE_STOCK_REVIEW`, `NEGATIVE_STOCK_REVIEW`, `UOM_REVIEW`, `MOQ_POLICY_REVIEW`, `MRP_HORIZON_REVIEW`. A **stockless JIT item can never be AUTO_ELIGIBLE** (proved in the fixture baseline). |
| `proc_pec_s4_generate_pr` | Edit permission + `p_confirm`; shared horizon advisory lock + duplicate draft/active rule; `create_pr_from_mrp_plan_pec_internal` creates header + MRP lines (scope filter from `generation_filters.rm_scope`); frozen rows in `proc_pr_ccf_generation_evidence`; AUTO lines updated. Scope comes from the editable filter; items are still chosen by DB columns. |
| `proc_pec_s4_reconcile_draft`, `proc_pr_rebuild_from_mrp` | Both refuse a PR that already has frozen evidence rows ⇒ a JIT PR can never be hybrid-reconciled or MRP-rebuilt. |
| Client | `s4UpdateGenerateReady` requires a confirmed review of the plan for every scope; `generateDraftPr` calls the hybrid writer. |

## 2. Design (additive; the hybrid functions are not modified)
Migration `20261122153109_pec_jit_mrp_route_plan_and_generator.sql` (created with `supabase migration new`, CLI 3.2.0) adds exactly two SECURITY DEFINER functions:

* `proc_pec_jit_mrp_plan(p_start,p_end,p_compare_consumption default true)` — **view** permission.
* `proc_pec_jit_generate_pr(…, p_compare_consumption, p_confirm)` — **edit** permission, `p_confirm = true`.

Route is **server-owned**: class fixed to RM, items fixed to `rm_procurement_mode='jit_procured'` (and the existing FG-bulk/semi-finished exclusion); a caller-supplied `rm_scope` other than `jit` is rejected; server keys (`source`, `s4_mode='jit_mrp'`, `rm_scope='jit'`) overwrite any client-supplied filter keys.

Quantity: `MRP net (stock-netted by the view) − open approved/issued indent balance (same class/item/UOM, once) → governed MOQ once, else ceil for Nos`. Stock is **not** deducted again and **missing stock never vetoes**. Historical consumption is **optional, informational and never changes a quantity**; consumption-only items are **never** candidates. Remaining gates (fail-closed per line): `UOM_REVIEW`, `MOQ_POLICY_REVIEW`, `MRP_HORIZON_REVIEW`, `MRP_QUANTITY_REVIEW` (negative MRP).

Writer: same shared horizon advisory lock and duplicate rule as the hybrid generator (draft/active, class 1/NULL, scope jit/all), atomic, aborts if the evidence set and the MRP-created lines diverge, writes frozen evidence with `mode='jit_mrp'` (hybrid rows keep `hybrid_mrp_ccf`), records `jit_consumption_comparison`.

RM Normal, PM, IND and RM All keep the existing hybrid/legacy functions byte-for-byte; the client routes **RM + JIT Only** to the new pair and everything else unchanged. If the new functions are absent (migration not installed yet) the client falls back to the existing conservative hybrid review for JIT.

## 3. Proof (disposable PostgreSQL; production never touched)
`scripts/pec-jit-route-pg-fixture.sql` loads the **real** internal creator, S4 plan/generator/reconcile/guard migrations and the new migration: **45 assertions**, local PG16.15 and CI PG17 (`pec-jit-route-pg17.yml`). Highlights: hybrid plan fingerprints for RM normal / RM all / legacy JIT / PM / IND identical before and after the migration; stockless JIT with MRP → AUTO_ELIGIBLE (baseline hybrid vetoes it); genuine stock not deducted twice; open indent netted once (100−40=60; covered ⇒ 0); Nos ceil; MOQ once; conflicting MOQ, UOM mismatch, partial horizon, negative MRP flagged; consumption-only JIT item absent; View-only can read but not generate; no-access denied; forged filter claims overridden; duplicate horizon blocked and `all`-scope overlap blocked while a different-scope PR is not; reconcile of a JIT PR blocked; denied calls write nothing; ACL anon denied / authenticated allowed. Mutation checks (no indent netting, stock gate restored, edit-permission removed, duplicate guard removed) each fail the fixture.

## 4. Exception examples (all from the fixture)
| Item | Result |
|---|---|
| JIT stockless, MRP 100 | AUTO_ELIGIBLE, 100 |
| JIT, MRP 100, open indent 40 | AUTO_ELIGIBLE, 60 |
| JIT, MRP 30, open indent 50 | AUTO_ELIGIBLE, 0 |
| JIT Nos, MRP 10.2 | 11 |
| JIT, MRP 100, MOQ 30 | 120 |
| JIT, two active MOQ policies | `MOQ_POLICY_REVIEW`, no automatic qty (MRP qty kept on the line) |
| JIT, default UOM ≠ MRP UOM | `UOM_REVIEW` |
| JIT, MRP in 1 of 2 months | `MRP_HORIZON_REVIEW` |
| JIT with consumption but no MRP | not created (hybrid lists it only as `consumption_only` review) |

## 5. Approval gates
1. **Owner review** of this design and the migration (SQL SHA-256 pinned in `scripts/lib/pec-protected-path-guard.mjs`).
2. **Staging/rolled-back proof** of the migration against a production-shaped copy by a DB reviewer (the fixture is synthetic).
3. **Owner approval of the production install** of migration `20261122153109` (additive; rollback = `DROP FUNCTION public.proc_pec_jit_generate_pr(text,date,date,date,jsonb,text,boolean,boolean); DROP FUNCTION public.proc_pec_jit_mrp_plan(date,date,boolean);`). Do not use `db push`.
4. **Client PR** merged only *after* gate 3 (it falls back safely if the functions are missing, but the JIT route is inert until installed).
5. **Release** of any Electron version is a separate owner decision (v6.3.1 stays Latest).
6. **Open design decisions for the owner:** (a) `NULL` `rm_procurement_mode` items are treated as stock-required (not JIT) — confirm; (b) IND and other classes keep the legacy contract — confirm; (c) whether JIT items with a *positive current stock row* should ever be netted again (this design says no, because the MRP view already nets opening stock); (d) whether JIT PRs should later get a governed reconciliation path (currently blocked by the frozen-evidence rule).

## 6. Client package (stacked PR on the server branch)
* **Route:** RM + *JIT Only* → `proc_pec_jit_mrp_plan` / `proc_pec_jit_generate_pr`; every other class/scope keeps `proc_pec_s4_new_pr_plan` / `proc_pec_s4_generate_pr` and an identical plan signature. If the new functions are missing (PGRST202) the client falls back to the existing hybrid review/writer with a notice (never a bypass).
* **Review dialog (JIT):** rationale text, tiles (auto-eligible / review-required / netted vs open indents / above-MRP-in-history), MOQ/UOM/horizon exceptions first, **optional "Compare with historical consumption (recommended)"** (re-plans and clears the acknowledgement when toggled), explicit acknowledgement → Confirm → Generate. The confirmed signature includes route and comparison choice, so changing class, scope, months, route or comparison invalidates it.
* **Editable reason templates:** PR notes (normal vs JIT wording; swapped only while unedited, otherwise the user's text is kept and "Use suggested wording" is offered), reconcile reason (≥20 chars still enforced; attestation never pre-checked), add-line reason prefix, neutral status notes. The override prefix `Quantity adjusted … Item-specific justification: ` alone — or with fewer than 10 further characters — is rejected for add-line and inline quantity overrides (the previous silent "Quantity adjustment" default was removed).
* **Tests:** `pec-erp-c1-layout-smoke.mjs` (1440px + 390px; route, comparison, invalidation, fallback, View-only, templates) and static-smoke additions. Screenshots: `docs/procurement-execution/evidence/issue-502/`.
* **Not covered by a browser test:** the inline quantity-override rejection path (no PR-line fixture); it shares `pecReasonIsPlaceholderOnly` with the add-line test and is statically asserted.
