> **SUPERSEDED — see [PRICE_REVISION_FEED_CONTRACT_v2.md](PRICE_REVISION_FEED_CONTRACT_v2.md).** `public.v_costing_pricing_price_revision_feed_approved` no longer exists (retired 22 Oct 2026). Kept as history.

# Approved price revision feed: contract v1

- **Status:** LIVE since 19 Oct 2026 07:15 IST (migration 20261019014458). Written from the live view definitions on 19 Oct 07:40 IST, using read-only queries. Copies of the live definitions are in `live_source/`.
- **Owner and approver:** Dr. Brahmadathan U.
- **Consumers:** the price-revision Sheet (ChatGPT) and any other approved-price consumer.
- **The rule:** the feed carries only APPROVED costing runs. A draft never appears in it.

## 1. Objects and access

| Object | Use | Access (live) |
|---|---|---|
| `public.v_costing_pricing_price_revision_feed_approved` | **Consumers use this one.** Exposed through Supabase REST. | Granted to `authenticated` and `service_role`; `anon` has no grant. Rows are returned only when `current_user` is `service_role` or `postgres`, or when the logged-in user has `module:costing-control-center` *view* permission (`app_has_permission`). Otherwise 0 rows come back, with no error. |
| `costing.v_price_revision_feed_approved` | Base view (internal). Not exposed to client roles. | `service_role` SELECT only. |

Further details:
- Both views are owned by `postgres` and run with owner rights (not security_invoker), so the consumer needs no rights on the underlying snapshot tables.
- Neither view is updatable (`information_schema.views`: is_updatable = NO). The public view's ACL shows `authenticated=arwdDxtm` because of Supabase default privileges. Write attempts still fail, but a tidy-up to SELECT-only is proposed (§9, decision C1).
- Definition md5s (install guards): costing `628a0ab31d675334fb61de6fa936c1d8`, public `5bf957f5e4628cccfb2ce0421c8b6c0e`. They depend on the pointer `5cc25791…` and on `costing.v_sku_detailed_cost_sheet` `d20e3c32…`.

## 2. Grain and key
- **One row per (period_start, sku_id).** The key is `(period_start, sku_id)`; live has 0 duplicates. Within one period, `refresh_run_id` is constant, so `(refresh_run_id, sku_id)` is also unique.
- Every SKU in the approved run's pricing bridge appears, including SKUs with status REVIEW_REQUIRED or BLOCKED. Filter on `cost_sheet_status` if you want only priced-ready SKUs.

## 3. Columns (30, in this order)

Notes for the whole table:
- **Types** are as live.
- **Money** is ₹ per SKU unit, meaning per pack of `pack_size` `pack_uom`.
- **Percentages** are on a 0–100 scale.
- **MRP** includes GST.
- **Nullability:** view columns are technically nullable. "Observed" means the null count on live for Sep (run 122) and Oct (run 128), which is **0 for every column**.

Source key used in the table:
- pb = `costing.sku_pricing_bridge_snapshot`
- ilc = `costing.sku_internal_loaded_cost_snapshot`
- sp = `costing.sku_selling_price_bridge_snapshot`
- ptr = `costing.v_current_successful_costing_refresh_run` (built on `costing.costing_refresh_run`)
- des = `costing.v_costing_run_effective_designation` (built on `costing.costing_run_designation`)

| # | Column | Type | Meaning / units | Source |
|---|---|---|---|---|
| 1 | period_start | date | Costing month (1st of month) | ptr.period_start (= run period) |
| 2 | valuation_date | date | Valuation date captured when the run was requested (rates as of this date) | ptr.valuation_date |
| 3 | refresh_run_id | bigint | The approved costing run | ptr.refresh_run_id |
| 4 | run_label | text | 'Approved run N' | computed |
| 5 | approved_at | timestamptz | When the run was approved (UTC; show in IST) | des.designated_at |
| 6 | approved_by | text | Approver name | des.designated_by |
| 7 | designation_id | bigint | Approval record id (Oct = 4, Sep = 2) | des.designation_id (`costing_run_designation.id`) |
| 8 | is_latest_approved_period | boolean | TRUE on rows of the latest calendar month that has an approved run (§5) | computed |
| 9 | sku_id | bigint | SKU | pb.sku_id |
| 10 | product_id | bigint | Product | pb.product_id |
| 11 | product_name | text | Product name | pb.product_name |
| 12 | pack_size | numeric | Pack size (in pack_uom) | pb.pack_size |
| 13 | pack_uom | text | Pack unit | pb.pack_uom |
| 14 | mrp_ik | numeric | MRP Inside Kerala, ₹ incl. GST (governed MRP policy) | pb.mrp_ik |
| 15 | mrp_ok | numeric | MRP Outside Kerala, ₹ incl. GST | pb.mrp_ok |
| 16 | material_cost_per_sku | numeric | **Total material** = RM + PM, ₹/SKU | ilc.material_cost_per_sku |
| 17 | direct_labour_cost_per_sku | numeric | Direct labour, ₹/SKU | ilc.direct_labour_cost_per_sku |
| 18 | manufacturing_cop_per_sku | numeric | Manufacturing cost of production = prime + production overhead + QC overhead + materials-stores overhead; prime = material + direct labour + internal material conversion | ilc.manufacturing_cop_per_sku |
| 19 | internal_loaded_cost_per_sku | numeric | Internal loaded cost = COP + admin overhead + finance-admin overhead | ilc.internal_loaded_cost_per_sku |
| 20 | pricing_cost_per_sku | numeric | Internal loaded cost + **national** marketing expense. **Not** the cost used in the margins (see 23–26) | pb.pricing_cost_per_sku |
| 21 | ik_selling_price | numeric | IK selling price to trade = basic price (MRP ÷ (1+GST%)) − policy discount | sp.ik_selling_price |
| 22 | ok_selling_price | numeric | OK selling price, same rule | sp.ok_selling_price |
| 23 | ik_margin_amount_before_scheme | numeric | **MRP_IK − (internal loaded cost + IK regional marketing)**, ₹/SKU, before any scheme | pb.ik_margin_amount_before_scheme |
| 24 | ik_margin_percent_before_scheme | numeric | 23 ÷ MRP_IK × 100 (**on MRP**, not on selling price) | pb |
| 25 | ok_margin_amount_before_scheme | numeric | MRP_OK − (internal loaded cost + OK regional marketing) | pb |
| 26 | ok_margin_percent_before_scheme | numeric | 25 ÷ MRP_OK × 100 | pb |
| 27 | ik_negative_margin | boolean | 23 < 0 | computed |
| 28 | ok_negative_margin | boolean | 25 < 0 | computed |
| 29 | cost_sheet_status | text | READY / REVIEW_REQUIRED / BLOCKED (worst of the three bridge statuses) | `v_sku_detailed_cost_sheet` |
| 30 | refreshed_at | timestamptz | Latest snapshot write time of the three bridges (UTC) | greatest(ilc, pb, sp).refreshed_at |

Formula checks on Oct run 128 (live, 627 SKUs, tolerance ₹0.005): every identity in rows 18, 19, 20, 21 and 23–26 holds on all 627 SKUs. The prime identity holds only with internal conversion included: 8 SKUs carry it, total ₹2.55.

## 4. Status and run identifiers
- **Run:** `refresh_run_id`, `run_label`, `valuation_date` and `period_start`.
- **Approval:** `designation_id`, `approved_at` and `approved_by`, taken from the run's latest designation record.
- **Fingerprint reference:** not a column in v1. The run's integrity capture is the latest `costing.costing_run_fingerprint` row for the run (service_role): Oct 128 → id 13 (REBASELINE, 51 tables); approval capture id 11. Sep 122 → id 12; approval capture id 4. Both runs verify with 0 drift (W5).
- **Per-SKU status:** `cost_sheet_status`. Oct 128 has 590 READY and 37 REVIEW_REQUIRED.
- **Month status** (OPEN/LOCKED/CLOSED, any newer draft, any active run) is not in the feed. Read it from `public.v_costing_pricing_period_run_status`, which has `period_status`, `display_label` and `newer_draft_run_id`.

## 5. Which months and runs appear (selection rules)
1. **A month appears only if it has an approved run.** That means the governed pointer selects a run with `selection_basis = 'APPROVED'` *and* that run's latest designation is APPROVED.
   - Months with only drafts are **excluded**. Today Jul (run 80) and Aug (run 82) are excluded.
2. **One run per month.**
   - The pointer ranks APPROVED first, then the latest finish time, then the highest id.
   - If two runs in one month were ever both APPROVED, the later-finished one wins. Today's designate RPC does not stop a second approval; W2 will make approval single-valued per month.
3. **Revoked approval:** if a run's latest designation becomes REVOKED, its month **drops out** of the feed (unless another APPROVED run exists for that month). The feed never falls back to a draft.
4. **Supersession:**
   - Any new run for a month that already holds an APPROVED run needs a recorded, time-limited supersession authorisation (database guard).
   - While the new run is a draft, the feed **keeps the approved run unchanged**. This was tested locally (W1-13) with a +10% price draft.
   - Only after the new run is approved does the feed switch to it.
   - Old run rows are never deleted.
5. **is_latest_approved_period** = `period_start = max(period_start)` over all months in the feed, i.e. the latest **calendar month** with an approved run, not the most recent approval.
   - It moves forward when a later month gets approved.
   - It moves back if the latest month's approval is revoked.
   - Today: Oct = TRUE, Sep = FALSE.
6. **Lock or close status does not affect inclusion.** Sep and Oct are LOCKED; both are in the feed.

## 6. Recommended Sheets query
- **Latest approved month** (REST, page in 1000-row ranges):
  `GET /rest/v1/v_costing_pricing_price_revision_feed_approved?select=*&is_latest_approved_period=eq.true&order=product_name.asc,sku_id.asc`
- **Pinned and reproducible** (recommended for a price proposal):
  `...?refresh_run_id=eq.128&order=product_name.asc,sku_id.asc`
- **SQL equivalent:** `select * from public.v_costing_pricing_price_revision_feed_approved where is_latest_approved_period order by product_name, sku_id;`
- **Credentials:** use a logged-in user with costing-control-center view permission, or the service key held server-side. With an ordinary user lacking that permission, the result is 0 rows, not an error.
- **Sheet header:** record `refresh_run_id`, `designation_id`, `approved_at` (shown in IST) and `valuation_date`.
- **Before overwriting a tab,** stop if `refresh_run_id` changed unexpectedly.

## 7. Reconciliation checks and October control totals (run 128, live 19 Oct)

| Check | Rule | Oct run 128 value |
|---|---|---|
| Rows / distinct SKUs / products | rows = distinct sku_id | **627 / 627 / 453** |
| Run, approval | one run per month | run 128, designation 4, approved 18 Oct 2026 14:18:51 IST by Dr. Brahmadathan U; valuation date 16 Oct 2026 |
| Status | | READY 590, REVIEW_REQUIRED 37, BLOCKED 0 |
| Negative margin | count ik_negative_margin / ok_negative_margin | **9 / 9** (9 SKUs negative in either) |
| Σ mrp_ik / Σ mrp_ok | | 301,559 / 328,526 |
| Σ material (RM + PM) | | **110,465.2761** (RM 104,112.0906 + PM 6,353.1855, from cost-sheet lines) |
| Σ direct labour | | 7,946.5919 |
| Σ COP − material − DL | = production OH 5,505.8548 + QC OH 1,739.3999 + stores OH 632.6304 + conversion 2.55 | 126,292.3032 − 110,465.2761 − 7,946.5919 = **7,880.4352** |
| Σ manufacturing COP | | **126,292.3032** |
| Σ internal loaded − COP | = admin OH 9,884.9202 + finance-admin OH 1,215.0953 | **11,100.0154** |
| Σ internal loaded cost | | **137,392.3186** |
| Σ pricing cost − internal loaded | = national marketing | **21,847.8008** |
| Σ pricing cost | | **159,240.1194** |
| Σ mrp_ik − Σ ik_margin | = IK pricing cost (ILC + IK regional marketing 3,428.7315) | 301,559 − 160,737.9499 = **140,821.0501** |
| Σ mrp_ok − Σ ok_margin | = OK pricing cost (ILC + OK regional marketing 3,099.5634) | 328,526 − 188,034.1180 = **140,491.8820** |
| Σ ik / ok selling price | | 282,770.9167 / 308,437.7619 |
| Σ ik / ok margin before scheme | | 160,737.9499 / 188,034.1180 |
| Per-SKU % check | ik_margin_percent = 100 × ik_margin / mrp_ik | 0 exceptions |

These are plain sums over SKUs (per pack, unweighted), meant only as control totals.
- **September (run 122):** 634 rows / 634 SKUs, **74 IK / 70 OK negative**, designation 2, valuation date 10 Sep 2026.

## 8. What the feed does NOT carry, and where the authoritative value already lives
To avoid parallel pricing logic, the Sheet should **read** these values, not recompute them:

| Item the Sheet uses | In feed v1? | Authoritative live source (same run) |
|---|---|---|
| RM / PM split | No (total only) | `public.v_cost_sheet_snapshot_sku_monthly_comparison_governed` (`rm_cost`, `pm_cost`; one governed run per month) |
| Itemised overheads (production, QC, stores, admin, finance-admin), internal conversion, national marketing | No | `public.v_costing_pricing_sku_detailed_cost_sheet` (join on `refresh_run_id`, `sku_id`) |
| Regional (IK/OK) marketing and pricing cost used in the margins | No | Derive as `mrp − margin` (exact), or ask for v2 columns from `sku_pricing_bridge_snapshot.pricing_cost_per_sku_ik/_ok` |
| **Trade discount ("40%")** | No (only the resulting selling price) | Per-SKU policy, **not a flat 40%**: Oct values are 0 / 32 / 33 / 40%. Read `ik/ok_discount_percent`, `ik/ok_discount_amount`, `ik/ok_basic_price` and `gst_percent` from `public.v_costing_pricing_sku_detailed_cost_sheet` (source `sku_selling_price_bridge_snapshot`, policy `sku_selling_price_policy`). |
| Contingency / other expense | No | Same view: `contingency_percent` (2% in Oct), `ik/ok_contingency_value` |
| Schemes, scheme-effective price, net sales realisation, margin after scheme | No | `public.v_costing_pricing_sku_scheme_comparison`, filtered on `refresh_run_id` (source `sku_scheme_viability_snapshot`, run-scoped and fingerprinted; run 128 has 6 schemes × 627 SKUs = 3,762 rows) |
| Selected-scheme "Sales Realisation" / "Profit Value" lines | No | Cost-sheet lines (`cost_sheet_line_monthly_snapshot`). Oct 128: realisation IK 273,686.7669 / OK 299,169.4433; profit IK 136,294.4483 / OK 161,777.1247; negative profit 15 IK / 13 OK |

Proposed (decision C2): a feed **v2** that adds these columns from the same approved run, so the Sheet needs one source. Until then, join the views above on `refresh_run_id` and `sku_id`.

## 9. Versioning and change policy
- **v1 is frozen:** the 30 columns, their order and the meanings above. Consumers must select columns by name.
- **Allowed without a version bump:** none. Any change goes through a migration with a definition-md5 guard and user approval, and must be recorded in this contract and the CHANGELOG.
- **Additive change (new columns appended at the end):** contract v1.x and a notice to consumers. Existing columns are unchanged.
- **Breaking change (rename, remove, meaning or formula change, grain change):** a new view `..._v2`. v1 is kept unchanged for at least one costing month after v2 goes live, then retired by a recorded decision.
- **Data changes** never happen in place. A new approved run shows up as a different `refresh_run_id` and `designation_id`. Approved runs are immutable (row and header guards) and fingerprinted.
- **Open decisions:**
  - C1: tighten the public views' grants to SELECT only.
  - C2: feed v2 columns (§8).
  - C3: add a fingerprint id column.
