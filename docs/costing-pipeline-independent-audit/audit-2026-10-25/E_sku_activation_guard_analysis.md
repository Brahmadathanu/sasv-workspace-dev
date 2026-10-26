# E — SKU activation guard (WP-10) — Step 1 analysis (read-only)
Prepared 26 Oct 2026 (IST). No DB writes, no migrations, no repo changes. Repo checkout: /workspace/audit-wt @ c7f5030.

## 1. What "complete for costing" already means (source of truth)
No new rules are invented. The server already has ONE approved readiness authority (WP-01 contract, WP-02/03 closed):
- `public.rpc_get_product_sku_readiness(p_sku_id, p_period_start, 'LIVE_AS_OF', null)` — per-SKU, SECURITY DEFINER, returns summary + dependencies[] (code, status, owner module, UI route).
- `costing.fn_wp04_build_readiness_portfolio(p_period_start)` — builds the same assessment for all SKUs into `costing.product_sku_readiness_portfolio_item / _incidence` (current build id 4, period Sep-2026, built 5 Oct 2026 17:31 IST, 1,793 SKUs).
- Status vocabulary: READY / REVIEW_REQUIRED / BLOCKED (BLOCKER) / UNKNOWN. WP-01 says REVIEW_REQUIRED still calculates; only BLOCKED fails closed.

| # | Requirement (plain words) | Dependency code | Grain | Evaluated by | Proposed for guard? |
|---|---|---|---|---|---|
| 1 | Product exists and is Active | (lifecycle) | Product | trigger `fn_guard_active_sku_requires_active_product` — ALREADY ENFORCED | already live |
| 2 | Pack size > 0 and unit filled | SKU master | SKU | `rpc_create_product_sku` / `rpc_update_product_sku` — ALREADY ENFORCED | already live |
| 3 | Approved packing-material BOM revision | PM_BOM_REVISION | SKU | readiness RPC (PM-BOM resolver) | YES (hard) |
| 4 | Batch size reference | BATCH_SIZE_REFERENCE | Product | readiness RPC | YES (hard) |
| 5 | Manufacturing (production) route | MANUFACTURING_ROUTE | Product | readiness RPC / `costing.v_product_process_route_readiness` | YES (hard) |
| 6 | MRP policy | MRP_POLICY | SKU | readiness RPC (MRP resolver) | YES (hard) |
| 7 | Selling price / GST policy | SELLING_PRICE_POLICY | SKU | readiness RPC | YES (hard) |
| 8 | Common commercial sales basis | COMMON_COMMERCIAL_BASIS | SKU x period | readiness RPC | NO — sales evidence, a brand-new SKU cannot have it; governed default exists (see open Q2) |
| 9 | Scheme policy | SELECTED_SCHEME_POLICY | SKU x region | readiness RPC (default "no scheme" is valid) | NO |
| 10 | Overhead allocations (labour, production OH, QC, stores, admin, finance, marketing) | DIRECT_LABOUR … MARKETING_EXPENSE | global policy + SKU evidence | readiness RPC | NO — these show UNKNOWN only because upstream items are missing; they resolve once 3–7 do |
| 11 | Regional marketing evidence | REGIONAL_MARKETING_EVIDENCE | SKU x region | readiness RPC | NO (review only) |
| 12 | Material (RM) rates | material evidence | downstream | costing run | NO (run-time evidence, not master data) |

Note: formulation/RM BOM is not a separate readiness dependency; it is covered through route/batch size and the costing run. "Price list" flags (price_list_ik/ok) are not a costing prerequisite (trigger only forces them false when inactive).

**Recommended requirement set for the guard: items 3–7 must be not BLOCKED** (items 1–2 already enforced). Everything else stays a warning.

## 2. Live counts (portfolio build 4 = Sep 2026 context, joined to TODAY's active flag)
SKUs today: 627 active, 1,166 inactive (1,793 total; all in build 4).

Overall severity — active SKUs: READY 486, REVIEW_REQUIRED 138, BLOCKER 3. Inactive: BLOCKER 1,118, REVIEW 14, UNKNOWN 33, READY 1.

| Requirement | Active SKUs failing (BLOCKED) | Inactive SKUs failing |
|---|---|---|
| PM BOM revision | 1 | 1,117 |
| Batch size reference | 2 | 516 |
| Manufacturing route | 0 | 508 |
| MRP policy | 1 | 1,105 |
| Selling price policy | 1 | 1,101 |
| (Commercial sales basis — not in guard) | 1 | 1,107 |
| **Fail ANY of items 3–7** | **3** | **≈1,118** (the inactive BLOCKER group) |

Pack size/unit bad: 0. Active SKU on inactive product: 0.

### Fix list (active SKUs that would fail)
| SKU | Product | Pack | Missing |
|---|---|---|---|
| 1797 | Special Medicine 2 | 5 g | PM BOM, MRP policy, selling price policy, sales basis (all overheads UNKNOWN as a result). Activated 15 Oct 2026 05:31 IST AFTER the build — a live example of the gap this guard closes. Looks like a placeholder/test product — confirm. |
| 333 | Mahavathanthaka Thailam | 50 mL | Batch size reference |
| 603 | Jathyadi Ghritham | 50 mL | Batch size reference |

These stay active (untouched) and go on the fix list. Note: 333 and 603 are BLOCKER yet active; check whether they were in approved run 143 (not verified here).

## 3. How SKUs are created/activated today
- Triggers on `public.product_skus`: `trg_active_sku_requires_active_product` (BEFORE INSERT/UPDATE OF product_id,is_active), `trg_product_skus_price_list_active_guard` (BEFORE INSERT/UPDATE), `wp04_readiness_epoch_…` (AFTER, statement — marks portfolio stale).
- Server writers: only `rpc_create_product_sku` (insert), `rpc_update_product_sku` and `rpc_set_product_sku_active` (updates; only the latter changes is_active). All SECURITY DEFINER, permission `module:manage-products`, write `product_sku_master_audit`.
- Client: only `js/products.js` (Manage Products): create at line 2132 always sends `p_is_active: false`; activation at line 2234 via `rpc_set_product_sku_active`. No other client file inserts/updates product_skus (others are reads). No bulk/import script found in repo (scripts/product-sku-lifecycle-smoke.mjs is a smoke test — it may activate a test SKU and could need a ready fixture).
- **Finding: off-RPC changes exist.** SKUs 17 and 114 went from active to inactive after 5 Oct with NO audit event, i.e. someone updated the table directly (SQL editor/service role). Audit table holds 47 DEACTIVATE and only 1 ACTIVATE ever.

## 4. Proposed design (for approval; no SQL yet)
- **Where:** a BEFORE INSERT OR UPDATE OF is_active trigger on `public.product_skus` (catches RPC, SQL editor and any future import), firing only when `NEW.is_active = true AND (TG_OP='INSERT' OR OLD.is_active = false)`. Plus a friendly pre-check inside `rpc_set_product_sku_active` so the user gets a clean message.
- **Check:** call a small internal helper that reuses the readiness resolvers for items 3–7 (LIVE_AS_OF, latest governed period from `rpc_get_latest_governed_cost_period_start()`), NOT the full readiness RPC (that averages 4.9 s, max 8 s — too slow/heavy for a trigger and partly depends on sales evidence).
- **Message:** "Cannot activate SKU <id> (<product> <pack>): missing PM BOM revision, MRP policy, selling price policy. Fix in PM BOM Manager / Pricing Policy Manager." — built from the dependency owner routes.
- **Allowed:** create inactive with anything missing; edit pack/sample while inactive; deactivate any time; existing active SKUs untouched (guard only fires on the false→true transition / active insert).
- **Optional override:** an approval-reference-based bypass (e.g. only when `p_approval_reference` given by a Costing approver) — decide in Q3.
- **Client (Cursor plan):** Manage Products shows the missing items before Activate and disables/warns accordingly.

## 5. Risks
1. Effective-dated rules: MRP/selling policy may be effective from a future date → SKU looks blocked today. Need as-of date choice (Q1).
2. Product-level items (batch size, route) — activating a 2nd pack of an existing product is fine if product is ready; a new product needs route + batch size first. Production may need to activate before costing data exists (e.g. sample/trial packs) — Q3.
3. Performance: resolver calls inside a trigger; must be single-SKU and fast (<300 ms target); test on SKU 2/1798/1400.
4. Direct SQL/service-role updates will also be blocked (good), but any planned bulk reactivation must fix data first.
5. Smoke script `product-sku-lifecycle-smoke.mjs` may break if it activates an incomplete test SKU.
6. Portfolio build is from 5 Oct (Sep period); counts are indicative — re-run a fresh read-only per-SKU check before applying.

## 6. Rollback outline
Drop the new trigger (and helper function); restore previous `rpc_set_product_sku_active` body from saved pre-image in `supabase/rollback-evidence/`. No data changes involved, so rollback is instant and lossless.

## 7. Open questions for Dr. Brahmadathan
- Q1 Which date to check against — today, or the current governed costing period (Oct 2026)?
- Q2 Should missing sales basis also block? (Recommend no — new SKUs never have sales yet.)
- Q3 Exception path: sample SKUs (is_sample) and urgent production activations — exempt, or allow with an approver's reference?
- Q4 SKU 1797 "Special Medicine 2" — real product or test? Deactivate or complete it?
- Q5 Who made the unaudited deactivations of SKUs 17 and 114? Should direct table edits be audited by trigger too?

## Unverified
- Live per-SKU readiness RPC was not called for all SKUs (too heavy); counts come from the stored 5 Oct portfolio build joined to today's active flags.
- Whether 333/603 were priced in run 143.
- Exact internal resolver function names for items 3–7 (to be listed at migration-prep stage).
