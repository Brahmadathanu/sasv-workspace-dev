# PEC S5 — Unified Requirement Planning: Server Receipt and One-Package Client Handover

**Current checkpoint:** 23 November 2026 IST. **Tracking:** Issue #508; server draft PR #509.
**Production Supabase project:** `qhmoqtxpeasamtlxaoak`.
**Registered migration:** `20261122191542_pec_s5_unified_planning_ind_source_and_pr_reason`.
**Canonical repository source:** `supabase/migrations/20261122191542_pec_s5_unified_planning_ind_source_and_pr_reason.sql`.
**LF-normalized SHA-256:** `c1661a3bf194ddd6b2afef54eb88753ad81f9576adb3309627e7cf7356a88486`.
**Source branch:** `feat/pec-s5-unified-server-20261123`. Production SQL installed and verified; branch merge and client/release remain separate CI gates.

## 1. Business selection, one UI across all material classes

Two actual calculation methods (not separate class-specific modes):
- `plan` — **Plan-based requirement**: RM and PM use stock-netted production MRP; JIT uses its existing stock-netted MRP; IND uses an explicitly entered, monthly *operational planned requirement* (not a product BOM).
- `hybrid` — **Plan + Historical Consumption**: use the higher of the independently stock-netted plan and 12 fully completed calendar months' consumption projected over the selected 1–6 months, then outstanding approved/issued indent and appropriate MOQ/Nos rounding once. Never sum plan + consumption.
- `p_compare_history` is *informational*. ON displays supplementary historical comparison; OFF omits only optional comparative display. **Never change recommended quantity merely because comparison is toggled.** In hybrid mode the quantity-driving consumption figure must remain visible for audit even with comparison OFF.

Default method per route: RM Normal=hybrid; RM JIT=plan; PM=hybrid; IND=plan. Every class may choose either method, subject to real source validation and per-line gates. RM All is a per-item Normal+JIT split. IND's plan-only method cannot silently invent monthly plans from historical consumption.

## 2. Server RPC contract now installed

Read permission:
- `proc_pec_s5_review_plan(p_start date,p_end date,p_class integer,p_rm_scope text,p_method text,p_compare_history boolean)` returns JSON with `rows`, `plan_signature`, candidate/eligible/review counts, route/method/compare metadata. **Use this for client preview.**
- `proc_pec_s5_unified_plan(...same six args...)` returns SETOF jsonb and is the authoritative quantity/gate calculation behind the preview.
- `proc_pec_ind_list_planned_requirements(p_start date,p_end date)` returns monthly IND plan items, quantities, remarks and active flags for the operator modal; read permission required.

Edit permission:
- `proc_pec_ind_set_planned_requirement(p_stock_item_id bigint,p_month_start date,p_gross_required_qty numeric,p_reason text,p_is_active boolean)`. The stock item must be active IND with default UOM; valid calendar month (current through next 12), nonnegative quantity, meaningful reason; deactivate with `p_is_active=false`, not deletion. Never allow direct client table DML.
- `proc_pec_s5_generate_pr(p_pr_number text,p_effective_from_date date,p_horizon_start_month date,p_horizon_end_month date,p_material_class_id integer,p_rm_scope text,p_method text,p_compare_history boolean,p_generation_filters jsonb,p_notes text,p_expected_plan_signature text,p_confirm boolean)`. Requires Edit, actual confirmation, matching frozen preview signature, no identical-horizon/class/scope competing draft/active PR; transaction-locked generation, immutable evidence, review-required items at zero until authorised review. Only generate after a fresh explicit review and acknowledgement.

Classes: RM=1, PM=2, IND=5. RM scope `normal|jit|all`; PM/IND use internal scope `normal`. Method `plan|hybrid`. All source validation is server-owned: never trust `p_generation_filters` for class/method/scope.

Existing PR reconciliation, indent, vendor and lifecycle writers remain independent. New S5 PRs store `source=s5_unified`, method, compare, signature and timestamp in header generation filters and per-line frozen evidence.

## 3. Identifiable IND components, separate from RM/PM production BOM MRP

- `proc_pec_ind_planned_requirement` — source monthly operator plan, RLS enabled, direct authenticated access revoked.
- `v_mrp_material_gross_requirement_ind` — counterpart-named view alongside `v_mrp_material_gross_requirement_rm` and `..._pm`. Source is operational IND plan, **not** a new member of the existing production-BOM recursive RM/PM view; this avoids misclassifying IND as product-derived MRP.
- `proc_pec_ind_planned_requirement_audit` — append-only before/after INSERT/UPDATE evidence, direct access revoked.
- `proc_pec_ind_plan_audit_trg` — audit trigger.
- The above read/edit RPCs control access via canonical PEC module permission.

IND plan mode requires an entry (including explicit zero if applicable) for **each selected planning month** of a material. Partial horizon gets `IND_PLAN_HORIZON_REVIEW`. No entry means no fictitious planned candidate. IND hybrid can use valid positive historical consumption without a plan; an absent/incomplete plan with no consumption is review-required. Verified live figures: 72 active IND items; 44 have monthly history records, but only 8 have strictly positive 12-month consumption; mapped current stock from consumable/fuel sources. Flag absent/stale/multiple stock and UOM/MOQ mismatches, never silently assume zero stock.

In JIT `plan`, no consumption-only items are generated. In explicitly chosen JIT `hybrid`, historical-only JIT items may appear, subject to the same source/quantity gates. Current two-month sample produced 197 JIT hybrid candidates, 4 historical-only. JIT missing stock mapping is not by itself a veto; real stock, if present, is considered in the history alternative. Prior JIT indent aggregation timeout fix is preserved by MATERIALIZED balance aggregation.

## 4. Manual PR quantity reason — owner addition implemented at server

The existing `proc_pr_set_manual_delta` wrapper now fills an omitted/blank reason for a nonzero delta with neutral, auditable text:
`Manual quantity adjustment during PR review: [previous final quantity] to [new final quantity].`
The wrapper delegates actual write to the **unchanged** R10-protected internal function (draft status, header lock, internal finished-bulk prohibition, triggers). Custom entered reasons remain unchanged; returning to zero delta can clear the reason. No automatically invented stock shortage, approval or item-specific motive.

**Claude client:** on row final-quantity edit, fill the adjacent editable Reason cell immediately with a dynamic neutral old→new explanation if blank/auto-derived; never overwrite a manually customised reason. Save quantity and reason together via `proc_pr_set_manual_delta`, and show returned actual reason after refreshed PR lines. Replace previous unfinished `Item-specific justification:` placeholder blocker for ordinary manual adjustments; keep genuine additional justification where blocked/review-required exceptions call for an explicit operator decision. No ghost approvals.

## 5. Server verification and release constraints

- Live PostgreSQL 17.4.1: complete source DDL compiled under BEGIN…ROLLBACK; synthetic IND draft generated with frozen evidence, manual reason, stale signature rejection, duplicate-horizon rejection, no-access denial. View-only canonical claim read allowed; plan edit and PR writer denied. Audit and plan-edit signature invalidation passed. All tests were rolled back — **not genuine authenticated browser acceptance**.
- Exact S4 parity under rollback: RM Normal hybrid, PM hybrid and JIT plan-only payloads match their prior RPCs after stripping only S5 wrapper metadata; RM All no item/UOM duplicates.
- Plan-only previews: RM Normal 438 candidates / 409 eligible, PM 628 / 621 eligible (Nov 2026 one month). Two-month JIT hybrid 197 candidates / ~3.5 sec. Comparison ON/OFF preserves recommended quantities and gates for IND/JIT hybrid.
- Production installation registered once. Pre/post purchasing counts unchanged: **10 PR headers, 4,686 lines, 1,414 frozen-evidence rows**; zero real IND plan entries or audits and no generation writer called after installation. v6.3.3 stable remains unchanged.
- Supabase security advisor reports RLS/no-policy informational notices on new intentionally server-private tables; direct table grants revoked; security-definer authenticated RPC notices are expected under canonical `require_permission` guards. Never weaken server permissions to quiet advisory notices.
- Keep old S4/JIT RPCs until **actual installed v6.3.3 clients are upgraded and verified**. Do not DROP in the first S5 migration. After compatibility sunset, audit live callers, triggers, dependencies and PR frozen evidence before one minimal forward-only cleanup. Never delete historic PR/evidence/audit rows or rewrite five old CRLF migration files.
- After server PR #509 merges (exact reviewed SHA + CI), have Claude work in **one dedicated client branch** against fresh `main`; no SQL, grants, RLS, migrations or security guard edits in the client package.

## 6. Claude Code — one bulk client, packaging and publishing assignment

**End-to-end scope, not multiple piecemeal releases:**
1. Inspect Issue #508, this handover, latest main, existing `public/shared/procurement-execution-console.html`, `public/shared/js/procurement-execution-console.js`, S4/JIT tests and release workflows. Freeze server contract above. Do not modify protected SQL.
2. Replace route-specific JIT/hybrid planning selections with a single editable **Plan-based / Plan + Historical Consumption** method selector for RM Normal, RM JIT, PM and IND. Use defaults above. Explain the quantity consequence and comparison ON/OFF in concise plain English. Do not hide a calculation input that actually affects the chosen hybrid quantity.
3. For IND, add a compact operational monthly-plan editor within PR planning flow, using the installed list/upsert RPCs. Label this **Operational Planned Requirement**, not production MRP. Show missing-month review states and per-month explicit zero. Preserve edited reason and show after-save audit provenance. Do not create records unless the Editor explicitly saves.
4. Use exactly `proc_pec_s5_review_plan` then `proc_pec_s5_generate_pr` with matching plan_signature. Any route/method/period/history change resets acknowledgement and preview; a stale signature must show a refresh/review message. Keep a single required approval checkbox; history switch is optional and unambiguous. Separate View-only and Editor controls. Generic PR notes prefilled/editable for each method.
5. Manual quantity rows: dynamic neutral editable default Reason (before/after) immediately on change, compatible with server fallback. No incomplete placeholder-only obstruction for ordinary edits; preserve custom typed notes, draft-only and blocked-line safeguards. Test on actual editable row fixture.
6. Compact ERP styling, 390px and desktop 1440px browser screenshot evidence, semantic labels/focus, safe area, modal Escape and stacked modal ordering, no nested unnecessary scrollbars. Preserve five-lens paging, vendor-wise export, indent source reference and S4/JIT historic PR evidence.
7. Reconcile/remove verified redundant **client** code, old JIT-specific duplicated modal widgets, stale handlers/styles/tests, replacing with one coherent shared flow. Do not drop server RPC compatibility or old PR audits. Do not change e-Aushadhi, Costing or unrelated programmes.
8. CI: integrated PEC browser, protected-path negative, View-only/Editor simulated client tests, existing vendor export, Electron smoke, Windows NSIS+ZIP, updater manifest/hash/blockmap. Real authenticated UI and Windows installed update must be labelled NOT TESTED until actually performed.
9. After reviewed merge from exact main, create a **single new minor Electron stable release candidate, v6.4.0** (if the next free version), validate exact main and SHA-256, publish stable Latest through existing guarded workflow as owner requested. Preserve v6.3.3 historic assets, tag and updater files; installer remains unsigned and hash guidance is mandatory. Do not assert successful staff auto-update without a real installed pilot. Include PWA cache freshness only if changed assets require it.
10. Return single consolidated receipt: PR/main SHA, changed files and deleted redundant client elements, CI links, server migration pin, screenshots, installer hash, publication/workflow URL, Latest result and pending genuine pilot.

**No further server functionality should be improvised by Claude.** If a missing contract or real-source defect appears, stop that exact subcase and report it for server correction.

## 7. Progress ledger

Server source/DB: **PASS (installed, counts parity)** | Source migration/pin: **PASS (branch)** | GitHub CI and merge: **PENDING** | Client unified UI and IND plan editor: **NOT STARTED** | Manual reason client: **NOT STARTED** | Electron v6.4.0 package/publication: **NOT STARTED** | Genuine staff pilot: **NOT TESTED** | Legacy cleanup: candidate duplicates removed; client and future server compatibility cleanup pending.
