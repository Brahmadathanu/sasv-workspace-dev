# Executive MIS G7 — governed production reporting design decision package

**Prepared:** 22 November 2026 IST  
**Status:** REVISED P1–P3 LIVE-GOVERNED PLANNING DESIGN accepted for design direction by owner; C1–C3/T1–T3 review ongoing; NOT APPROVED FOR INSTALLATION  
**Scope:** live governed plan and registered-batch reconciliation (supersedes mandatory plan sealing), formal completion-event valuation, FG transfer reconciliation; no new client functionality yet  
**Existing backend:** Supabase `qhmoqtxpeasamtlxaoak`  
**Source-of-truth ledger:** `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md` on `docs/executive-mis-workflow-20261119` (draft PR #485; still unmerged into `main`)  
**Already accepted:** sole `public.get_mis_production_value_summary(date,date)` with bounded approved-reference receipt subtotal; PR #493 client merged to `main`.  
**Absolute HOLD:** no DDL/DML, no new RPC, no employee-level disclosure, no permissions expansion, no global timeout change, no Costing Suite/Electron release change, no PR #485 merge, no invented full-COP actual or plan achievement.

## Executive decision

The current Executive MIS financial production cards are intentionally **indicative, not formally comparable**. A frozen plan, a verified completed-output event, and a reconciled transfer snapshot cannot be safely constructed by summing current views. The three reporting concepts must be verified independently, then aligned by **month, event basis, normalized UOM, cost basis, approved rate cutoff, source version and security context**.

**Recommended architecture:** preserve existing operational planning, BMR and ledger systems as the writers; add *only a derived, governed MIS read model* if the existing tables cannot provide immutable per-period evidence. No changes to existing production workflows merely to serve MIS. One canonical aggregate RPC remains the client interface. The default is NULL/unavailable when evidence cannot be verified.

### Non-negotiable distinctions

| Concept | Business meaning | Eligible source | Explicit exclusion |
|---|---|---|---|
| Frozen production plan | Owner-approved monthly intended bulk output at documented input version | Sealed effective product/month UOM lines | Current `v_product_bulk_consolidated_effective` or `forecast_run.status=OK` alone |
| Bulk receipt | Positive physical arrival into FG bulk storage, time of storage | Provenance-checked `fg_bulk_stock_ledger` + original work-log event | Done/production completion inferred from receipt alone |
| Completed bulk output | Distinct accepted finished bulk quantity for one governed batch/process route with completed event and date | BMR/route lifecycle + supporting evidence + accepted completion event | Arbitrarily `MAX(completed_on)`, summing repeated receipts, heterogeneous Done work logs |
| FG transfer to stores | Goods moved via FG voucher/book records | Tally voucher-line snapshot | Bulk receipt or manufacturing COP |
| FG transfer reconciliation | Voucher/log event matched on explicit keys and common cutoff | Tally-line group + governed work-log event match/exception | Equality of total rupees alone |
| Comparable achievement | Approved plan value vs verified completed-output value on identical bulk-stage rate and time basis | Only when both inputs achieve verified full coverage | Book value divided by plan, mixed Kg/L/Nos, or partially covered receipt value |

## I. EXISTING DATABASE OBJECTS — reuse first

1. **Planning chain:** `sku_forecast_monthly_base` (PK by `sku_id,region_id,godown_id,month_start`, with `run_id`), `forecast_run`, `production_qty_overrides`, `v_product_bulk_consolidated_effective`. The source PK does not make separate past full-run snapshots recoverable. November 2026: 1,974 current forecast keys across seven run IDs; 1,938 from forecast run 122; 506 active overrides updated after that run closed.
2. **Published plans:** existing `plan_publish_headers(id,plan_key,as_of_date,created_by,created_at,...)` and `plan_publish_lines(plan_id,sku_id,region_id,godown_id,month_start,demand_baseline,supply_llt,supply_seasonal,supply_final,...)`. In the sampled Oct–Nov 2026 `as_of_date` window, zero November-dated publish headers were found; this does **not** prove absence of earlier/other-key published planning data. These are SKU supply/demand facts, not automatically approved final product bulk-making quantities.
3. **Batch planning and BMR:** `batch_plan_headers` (plan title, window, status, plan_month), `batch_plan_batches` (product, month, batch_size, optional BMR link), `bmr_details` (id, product_id, bn, batch_size, uom, lifecycle_status); `bmr_administrative_corrections` carries old/new BMR identities, snapshots, operation type/result and executed time. 2,205 BMR records/2,202 active at sampled time. These can provide batch identity and correction lineage but are **not equivalent to completion acceptance** without evidence of stage/route and actual finished-quantity signoff.
4. **Production events:** `fg_bulk_stock_ledger` provides source ids, product, batch, movement date, quantity/base UOM; `daily_work_log` supplies storage quantity and status, completed_on, log_date. In Nov 1–21 IST: 80 ledger postings link to 80 unique work-log IDs, with exact quantity/UOM/date parity; 61 Done postings, 19 In Storage; 61 batch keys, 19 repeated keys. Product 183/batch 5521 has two Done completion dates, 9 and 12 Nov.
5. **Tally:** `tally_fg_transfer_voucher_lines` has unique as-of+store+voucher+line keys, voucher_date, amount, batch code, flags. `v_fg_transfer_reconciliation` FULL JOINs Tally and work-log grouped transfer events by transfer date/product/batch; use only for bounded proof, not as new high-cost interactive source.
6. **Executive freshness:** `mv_mis_executive_summary.mv_refreshed_at` describes materialized-view freshness, unlike the current live pipeline and snapshot-selected Tally values. Never stamp these sources with one invented "as of" timestamp.

**Decision constraint:** before proposing *any* new table, independently prove whether existing `plan_publish_headers/lines` or `batch_plan_headers/batches` can already provide the exact required immutable effective product bulk plan. If they can, prefer an explicit approval/immutability layer on those records rather than cloning the whole business model.

## II. Proposed plan seal contract (DESIGN — no schema applied)

### Recommendation

A **period-specific approved effective-plan snapshot**, with immutable product-UOM lines and an approval/supersession record, should be the source for MIS planned bulk quantity and valuation. Preserve the original planning source key fingerprints, including all seven contributing `run_id` values, source-view selection cutoff, applied overrides and stock/WIP adjustments.

### Candidate logical header (illustrative, not an approved physical table)

`seal_id; month_start; plan_type='BULK_PRODUCTION'; version; state=DRAFT|SEALED|SUPERSEDED|REVOKED; source_as_of_ist; generated_at; sealed_at; sealed_by; approval_reference; successor_seal_id; canonical_line_hash; input_fingerprint; approved_reference_cost_run_id; approved_rate_cutoff; policy_version; exceptions_json`.

Candidate line: `seal_id; product_id; base_uom; planned_bulk_qty_base; source_rule; forecast_run_id(s); override_ids/hashes; carry/WIP basis; conversion evidence; validation_status; source_fingerprint`.

- `SEALED` transitions require transactional validation of all line identities and source fingerprints, immutable line contents thereafter, and a **uniqueness rule for one current accepted seal per period/policy**; supersession creates a **new version**, never overwrites the prior sealed lines.
- A draft may refresh after source updates. A sealed snapshot may **not** refresh merely because a forecast, override or stock source changes.
- Any later plan correction needs an owner-approved new version carrying **reason, timestamp and diff**, with original version retained. A post-month-end retroactive plan replacement is never silent.
- Plan monetary value is computed **only** if a validated approved product bulk-stage reference rate exists for each included line in the nominated approved costing run. No naïve packaged-SKU COP conversion or double product UOM multiplication. Missing-rate rows generate transparent coverage; achievement stays N/A if a full comparable cohort has not been approved.

### Owner policy decisions still required

**P1 — Sealing authority and timing:** who approves/seals the monthly bulk production plan (role/account/management), at which business cutoff, and whether amendments after month start require the same or higher approval? Recommend explicit owner-designated production-management approval after forecast/override review, before the first production valuation; no automatic seal at forecast run close.

**P2 — Effective-plan source selection:** adopt the finally approved *effective* product/month bulk quantity after active overrides, carry and valid UOM normalization, not a raw forecast row; what happens to exceptional/manual plans or missing product mappings? Recommend exception HOLD rather than silently omitting rows.

**P3 — Rate version:** use the latest approved **previous-month** costing run at report cutoff only after bulk-stage component parity; seal cost-run identity separately from physical plan version. No client-side financial calculation.

## III. Proposed normalized formal completion contract (DESIGN — no schema applied)

### Recommendation

Derive normalized event identities from existing BMR, production-route and FG bulk ledger records in a **server-only read model**. Do not introduce a second production writer or repurpose daily_work_log to fabricate completion events.

Candidate event: `event_id; event_type=STORAGE_RECEIPT|BULK_COMPLETION|CORRECTION|REVERSAL|INTERNAL_TRANSFER; source_table; source_pk; product_id; batch_number; canonical_bmr_id; plan_batch_id; route_version; occurred_at; completed_at; quantity; base_uom; qty_conversion_rule; status=VERIFIED|RECEIPT_ONLY|REVIEW|EXCLUDED; correction_parent_event_id; evidence_hash; owner_acceptance_reference`.

**Rules:**
- Physical storage movements are separately recognizable and sum as receipts only after reversal/correction treatment; no implicit one-receipt-one-completion assumption.
- One formal completion requires governed BMR/route identity, explicit accepted output, completion date, lifecycle status and correction evidence. The original event cannot be deleted or silently overwritten.
- Multiple receipts for one (product,batch) may be progressive output and remain valid receipts, **but** cannot each generate a distinct formal completed event without independent signoff.
- Conflicting completion dates (fixture product_id 183, batch 5521: 9 vs 12 Nov) are **REVIEW**; no arbitrary latest-date selection. Verify against authoritative BMR/process-route signoff and whether the batch represents two independent completion operations.
- Status `Done` and `completed_on` in a generic work-log activity do not make that row production completion. A 680-row November Done count must not become an MIS completed-batch count.
- Completion monetary value remains NULL for any non-verifiable accepted cohort; distinguish numeric subtotal of fully covered accepted events from total completed value, disclose number of excluded events/quantity by UOM.

### Owner policy decisions still required

**C1 — Accepted completion point:** define the stage that means *bulk manufacturing fully completed* (e.g. final bulk QC/production signoff versus first FG bulk storage) for each product/process route, with canonical evidence source and timing.

**C2 — Partial completions:** whether split/incremental bulk receipts can be recognized separately once stage-accepted or only after whole batch completion. Recommendation: display partial receipts separately; formal completed-batch count increments only upon unique approved end-of-bulk signoff.

**C3 — Corrections:** how superseded/voided BMR links, reworked batches, and backdated or multiple completed_on events are handled; recommendation: immutable event history and REVIEW until independent proof, never retroactive silent mutation.

## IV. Proposed transfer reconciliation contract (DESIGN — no schema applied)

Use existing Tally book snapshot as the **accounting basis**, keeping all as-of, voucher keys and transfer stores. Build a **bounded reconciled evidence summary** only after source exception classification; no direct unbounded FULL JOIN on every browser request.

Candidate summary: `report_month; cutoff_ist; tally_snapshot_as_of; log_source_cutoff; voucher_lines; voucher_groups; book_transfer_value; matched_groups; matched_amount; missing_log_groups; missing_log_amount; extra_log_groups; mismatch_groups; not_valued_groups; exceptions_reviewed; reconciliation_state=NOT_CHECKED|PARTIAL|RECONCILED|BLOCKED; basis_note; source_fingerprint`.

**Observed Nov 1–21**: 226 voucher lines/110 grouped transfer events, book total **₹37,11,850.56**. 103 matched/valued groups; 1 matched/not-valued **₹9,422.10**; 6 missing-log groups **₹64,100.27**. Book amount equals reconciliation-book amount, but the process is **NOT RECONCILED**. The matching key is current transfer_date + product_id + batch_code; assess late logs, mapping and corrections before assigning human review states.

### Owner policy decisions still required

**T1 — Late-work-log grace period:** specify whether a missing log is immediately an exception or pending for N days after voucher date, with immutable age/provenance record. Recommendation: pending grace period only if supported by actual workflow; beyond grace is OPEN_EXCEPTION, never silently matched.

**T2 — Acceptance of exceptional transfer groups:** require reviewed exceptions with reason/actor/time, including six missing-log groups and one NOT_VALUED group; no automatic "RECONCILED" when a summary amount matches.

**T3 — Monetary basis:** retain Tally transferred FG **book value** as a separate accounting KPI; do not compare with approved bulk production reference COP until specifically governed cost-basis parity.

## V. Security and performance architecture

- Preserve `public.get_mis_production_value_summary(date,date)` as the **sole** browser production monetary contract. Extending its JSON shape, not an alternate v2 function, is the preferred migration route once reviewed.
- Canonical RPC checks `auth.uid() IS NOT NULL` and `public.app_has_permission('module:executive-mis-dashboard','view')` before any aggregate disclosure. New internal snapshots must be private with no direct authenticated/anon grants unless a separate RLS-verified requirement mandates them; never copy preexisting source table grants as authorization for MIS.
- Do not use a slow live effective-plan CTE within the authenticated request; prospective bounded snapshot reads must demonstrate latency safely below the 8-second signed-in role statement timeout, with genuine session tests.
- Full confidentiality regression: genuine MIS View, signed-in no-MIS-View, anonymous; do not simulate sessions or weaken existing role checks. Data writer grants and approval authority must be separate from read-only dashboard access. Do not disclose staff/salary or batch-level confidential source fields to the frontend.
- Source lineage captured by server-only IDs/digests, not user-identifying information in client logs. `SECURITY DEFINER` fixed search_path, narrowly reviewed owner, function EXECUTE grants; zero direct raw data exposure via new API.
- A new schema requires independently reviewed constraints (immutable seal status/line guard, unique current period seal, FKs, idempotent event key), RLS policies/private schema authority, audit log, backfill mode, index/query plan and rollback. No speculative DDL is authorized by this design.

## VI. Offline test matrix BEFORE any approval

| Test | Required invariant |
|---|---|
| Forecast source changes after seal | SEALED plan version and hash unchanged |
| Override added after forecast close | Original forecast does NOT silently become approved effective plan |
| Multiple runs feed one month | Source versions identifiable; no hidden duplication |
| Same product/batch receives two storage postings | Two receipts, not two verified completed batches |
| Conflicting completed_on events | REVIEW, no fabricated date |
| Qty/UOM mismatch or correction/reversal | No doubled output, explicit excluded coverage |
| BMR link superseded | Retain old/new lineage, do not reassign historical events silently |
| Tally 226 lines vs 110 groups | Book sum parity with correct grouping and source date |
| Six missing transfer logs | Not reconciled regardless of book total |
| One matched NOT_VALUED | Explicit exception; no cost-basis fabrication |
| Different Tally snapshot dates | Stable source selection at chosen cutoff |
| Unapproved or missing cost run | NULL rate-dependent values, N/A comparable achievement |
| Legitimate View/no-view/anonymous sessions | Access only for canonical module View |
| 390px mobile dashboard | Clear N/A/coverage badges after server acceptance |
| Query timeouts and source failure | Localized error, no hung dashboard, no permission bypass |

## VII. Exact staged work packages

**G7-D1 (now, server/ChatGPT):** resolve P1–P3, C1–C3, T1–T3 in policy review with source owners. Prepare one complete logical object/dependency graph and a **migration proposal** including check constraints, private ACL, function parity, down/rollback and 8-second budget. Run offline fixture harness first. **Stop before production installation.**

**G7-D2 (requires owner signoff):** implement only the approved private server objects and bounded read model, in independently staged migration(s); verify security, unchanged current money RPC fields and aggregate coverage, signed-in positive/negative and read latency. Hold if any unknown is not accepted.

**G7-D3 (only after server accepted):** one coherent Claude client bulk assignment for newly approved plan/completion/reconciliation presentation and responsive tests. No UI claim of plan achievement until same-rate coverage and source cutoff parity.

**G7-D4:** independent merge integration, production PWA authenticated acceptance, documentation branch reconciliation, explicit completion/close gate. G8 remains parked, G9/G10 pending; Costing Suite/Electron packaging never triggered by this programme.

## VIII. Design approval matrix

| Topic | Default recommendation | Decision state |
|---|---|---|
| Plan seal authority | Named production-management approver with documented owner authorization | PENDING |
| Plan freeze time | After forecast/overrides reviewed, before period KPI recognized | PENDING |
| Plan amendments | New version and reason/approver; never update accepted seal | PENDING |
| Normalized planned UOM | Existing governed product bulk-base UOM, no cross-UOM totals | RECOMMENDATION |
| Completion authority | BMR/process-route final signoff + accepted bulk output | PENDING |
| Multiple receipts | Separate receipts, one completion only with evidence | RECOMMENDATION |
| Conflicting completion dates | REVIEW until independently resolved | RECOMMENDATION |
| Missing transfer logs | Explicit exceptions and agreed grace/age policy | PENDING |
| Tally values | Retain book basis separately from manufacturing COP | ACCEPTED CONTRACT |
| Permission to view | Executive MIS canonical View permission, no Edit required | ACCEPTED CONTRACT |
| Programme release | After G7 and G9/G10, independent from Costing Electron | LOCKED |

**Important:** The recommendations are **not** silent owner approvals. The next decision is to adopt or amend this *single* design policy. Only then author/install physical schema. No asynchronous work is scheduled.


## IX. P1–P3 revised decision — LIVE GOVERNED PLAN, NOT MANDATORY FROZEN TARGET (22 November 2026)

**Owner's operating clarification:** SASV normally does not adjust quantities after quantities have been planned and one or more batches registered; however, governed changes can occur. Management reporting must reflect the *current authorized operational position* rather than an obsolete fixed forecast. The owner requested the planning design be corrected on that basis; this is approval of design direction, **not** permission for SQL installation or a formal closed G7 gate.

**This section supersedes every conflicting P1–P3 recommendation earlier in this document requiring a mandatory immutable monthly seal for the active plan KPI.** Preserve earlier proposals only as superseded decision history. Do not make a frozen plan a prerequisite for *displaying current production requirements*. Keep formal comparability/cost-coverage and latency gates separate.

### Source checks performed on live database, read-only

- `public.v_product_bulk_consolidated_effective` selects `v_product_bulk_consolidated` (which depends on net-need-after-WIP, batch-size selection and carry-forward), joins active `production_qty_overrides`, and computes `final_make_qty=greatest(0,planned_make_qty+coalesce(override_delta,0))`. The user's description of the effective view is correct.
- `public.v_product_bulk_consolidated_effective_with_batches` **calculates a suggested** `batch_count/batch_sizes/residual_qty` through `compute_batches(final_make_qty,...)`. It does **not** mean those batches were officially registered.
- Actual registered batches live in `batch_plan_batches` with links to `batch_plan_headers` and `bmr_details`; `v_batch_plan_batches_status` reports whether each plan batch maps to a BMR, whether WIP, and whether planned vs BMR batch size differs. Read-only November query returned **81** `batch_plan_batches` rows linked to BMR (October: 75/75). This is a **scoped inventory**, not proof all currently recommended November quantities were registered or all 81 are approved/active for the same plan version. Header states observed overall: `applied=5`, `draft=5`, `submitted=1`; header status and product-month boundaries must be considered before counting eligible registered batches.
- The original heavy live planning view exceeded the authenticated MIS RPC's timeout budget in a prior bounded query. No UI should call it naively in every 8-second signed-in monetary RPC; use a narrowly governed efficient/refreshable read model if required, with clear freshness timestamp and stale/failure status. No new cache or scheduler is approved here.

### Revised management-information contract

1. **CURRENT EFFECTIVE REQUIREMENT (live operational):** per product, month and product base UOM, use the existing effective view's `final_make_qty` (and only valid positive/appropriate rows), with `source_calculated_at` / `last_refreshed_at` as truthfully available. This is a dynamically recalculated recommendation, not an approval or immutable history. Apply later authorized overrides and changed stock/WIP as allowed by the existing governed upstream writers.
2. **REGISTERED BATCH COMMITMENT (actual governance state):** separately count/sum current eligible registered batch-plan lines, their BMR links and sizes, filtering by header status, product/month and valid lifecycle, and handling replacements/reassignment/voids. Do **not** add suggested `compute_batches` rows to real registrations, and do not equate `BMR mapped` with complete production.
3. **ACTIONABLE DIFFERENCE:** show remaining unregistered current requirement, extra registered capacity, and material quantity drift **per product/UOM only**, with statuses e.g. `ALIGNED`, `REQUIRES_REVIEW`, `SOURCE_INCOMPLETE`; first verify that effective requirement represents a *total production target* rather than *unregistered residual* for this period. If upstream view already deducts registered/WIP quantities, simple `final_make_qty - sum(registered)` would double deduct and is forbidden until source-semantic parity is proved. Display current requirement and registration as separate numbers before deriving a gap.
4. **GOVERNED CHANGES:** when a legitimate plan or registered batch changes, live report updates accordingly. Preserve who/when/why through existing source governance; if history is incomplete, propose a narrow audit only after evidence. An optional dated **comparison baseline** (e.g., initial plan when batch registration began) may support trend analysis, but must not override the live KPI and is not required before G7 read-only operational reporting.
5. **PERIOD AND AS-OF INTEGRITY:** for a selected month and historical cutoff, do **not** label the latest mutable view as the state *on that historic day*. If no audited time-versioned source exists, report `CURRENT_STATE_FOR_SELECTED_MONTH` with genuine refresh time, or `HISTORICAL_PLAN_AS_OF_UNAVAILABLE`; never imply a historical plan was reconstructed. Keep cutoff-limited transfer events and current-state planning visibly separate. Show current-month status honestly even if plan was adjusted recently.
6. **MONEY AND ACHIEVEMENT:** a live plan can become an indicative monetary **current-target** only after rate/bulk-UOM coverage and loading performance are proven. Verified finished-SKU transfer output must be valued on a comparable approved manufacturing cost basis. Management should see `current_target_value`, `finished_transfer_manufacturing_value` and a clearly labeled *achievement versus current target* only when both comparability, coverage and cutoffs meet agreed criteria; any revision can change this percentage and must be marked as a live target. Keep `planned_reference_covered_value=NULL` and `plan_achievement_pct=NULL` in the installed canonical RPC until those proofs and separate SQL authorization are complete. Tally book transfer material-based value is distinct and never the numerator.

### Revised P1–P3 disposition

- **P1:** No mandatory monthly plan freeze or new plan-approval workflow for MIS. Existing authorized forecast, override and registered-batch governance remains authoritative. **Design direction ACCEPTED by owner**, permissions and change history need follow-up audit.
- **P2:** `v_product_bulk_consolidated_effective` is the **live calculation source**; registered batches/BMR are a separate operational commitment. **Design direction ACCEPTED**, reconciliation semantics and performance proof pending.
- **P3:** Use the approved suitable costing reference only after product bulk-stage rate, UOM, complete-cost basis and accepted-rate cutoff checks; distinguish current-target value, verified completed-SKU manufacturing value and Tally book value. **Previously accepted financial safeguards unchanged**, full rate parity not yet tested.

**Revised next bounded work:** read-only source-semantic proof that the effective view is gross total target versus residual after WIP/registered batches; inspect batch_plan_header states and BMR registration correction lifecycle; design a fast live-view refresh/availability contract; write offline scenarios for registered batches vs changed live requirements; then revise the one canonical server RPC proposal. C1–C3 must be reoriented to finished SKUs transferred and batch-wide exhausted/adjusted closure per owner's operations explanation. T1–T3 recon exceptions still require process clarification. Absolutely no SQL install or client refactor here.


## X. Live requirement versus actual batch registration — bounded semantic proof (22 November 2026)

**Authority:** live Supabase metadata and scoped SELECT only; no implementation, no installer/release changes. These findings refine P1–P3 but do NOT close G7.

### Proven view dependencies and operations

1. `v_product_bulk_required_monthly` converts positive SKU net forecast needs into product bulk-base quantity as `SUM(net_units * pack_size * conversion_to_base)`. Do not convert it a second time.
2. `v_product_bulk_net_to_make` applies available bulk stock `v_product_bulk_soh`, carrying unused stock across forecast months. It represents the **net quantity to manufacture after current bulk SOH**, not a gross initial forecast.
3. `v_product_bulk_net_to_make_after_wip` further deducts **eligible current WIP expected net output**, allocated across months, where `v_wip_expected_output_base` has a matching product, BOM and base UOM. WIP candidates originate from `v_wip_batches`, which reads `daily_work_log` with `status='Doing'` OR `status='In Storage' AND activity='Intermediate storage'`; it is **not** a list of all BMR-registered batches. Estimated output uses `batch_size*(1-process_loss_pct)` if eligible. The WIP pool is not tied exclusively to the month when the relevant plan batch was registered; it is dynamically allocated from the earliest requirement month.
4. `v_product_bulk_adjusted_to_base` uses reference preferred/min/max sizes to adjust production batches with carry-forward across months.
5. `v_product_bulk_consolidated_effective` adds current active overrides and produces `final_make_qty=greatest(0, adjusted_bulk_to_make+override_delta)`. This is the **current additional effective making requirement given stock and eligible WIP**, not conclusively the historical approved overall monthly target.
6. `v_product_bulk_consolidated_effective_with_batches` calls `compute_batches` on `final_make_qty`, producing **suggested** sizes/count, not actual registered batches.

### Independent registration check and critical status safeguard

- For month 2026-11, `batch_plan_headers.id=33` is **`status='draft'`**, even though its 81 current `batch_plan_batches` records are BMR linked and have `source_rule='auto'`. Those links are operational evidence, **not** a substitute for an `applied` plan-header approval. All 81 are unique product+BMR keys in the latest read. The October comparison header `id=31` was `applied` with 75 linked rows.
- Of the 81 November registered batch-plan rows, **16** match a currently eligible-looking `v_wip_batches` product+batch identity. They overlap the upstream WIP pool's *candidate* set, but additional BOM/UOM/loss eligibility is required before concluding every such row contributes an actual quantitative WIP deduction. The other registered BMR-linked rows must **not** automatically be treated as already in process.
- A preliminary join on batch number alone once yielded **82 joined rows / 17 WIP joins**, revealing possible join multiplication from an insufficient key, *not* 82 genuine registered rows. The corrected independent query uses 81 distinct `batch_plan_batches` IDs and an `EXISTS` match requiring **product_id and BMR batch number**, giving 16 WIP matches. All future comparisons must use product + batch (and governed BMR/route identity when available), not batch string alone.

### Decision: do not calculate a naïve requirement-minus-registered difference

**A tempting but invalid expression** is `final_make_qty - SUM(all registered batch sizes)`. The numerator is *already net of bulk stock and eligible current WIP*, while the denominator may include unstarted, currently active, finished, superseded, and `draft` plan batches. Some of the registered quantities are also already represented in the WIP deduction; subtracting them can double count. Without establishing the correct cohort and baseline, the difference and any purported variance/achievement are misleading.

**G7 live reporting contract, now refined:**
- `CURRENT_ADDITIONAL_MAKE_REQUIREMENT`: separately labeled live `final_make_qty` from the effective view, with source-calculation timestamp or honest freshness status. Do not rename it `APPROVED_MONTHLY_TARGET`.
- `REGISTERED_BATCH_PLAN`: separate eligible batch records and header governance state; distinguish `DRAFT`, `SUBMITTED`, `APPLIED`. BMR registration and WIP evidence are separately labeled and never implicitly equivalent.
- `WIP_EXPECTED_OUTPUT`: a third, clearly labeled, *estimated* quantity (only rows with valid product/BOM/UOM and policy) which already contributes to the netting in the effective requirement.
- `GAP`, `REVISED_PLAN_VALUE`, `ACHIEVEMENT_PCT`: remain unavailable until a mathematically valid same-cohort comparison is constructed and reviewed, including risk that registered batches may have been fulfilled or originated in a different month.
- For history, a current recalculation against a past selected month is **not** an as-of reconstruction. Preserve `CURRENT_STATE_FOR_SELECTED_MONTH` versus historical event cutoff.

### Follow-up read-only acceptance cases before server design

A. Applied plan with all registered batches still unstarted; B. Draft BMR-linked rows; C. A subset already WIP included in `v_wip_expected_output_base`; D. WIP without registered current-month plan; E. finished/partially transferred batches; F. an authorized manual override; G. stock change and multi-month carry; H. repeat batch numbers across distinct products; I. missing/mismatched UOM or BOM. Ensure source filters, quantities and batch status cannot be conflated. Demonstrate acceptable performance without invoking the known >6s live full view in the 8s authenticated reporting request.

**Next:** proceed to read-only case matrices and coherent same-population semantics before drafting any SQL installation. C1–C3 are separately being corrected toward finished-SKU transfer as an output event and whole-batch exhaust/approved-loss closure; T1–T3 require precise reconciliation-status meaning. **No database writes or release changes authorized.**


## XI. WIP materialized-view distinction and finished-SKU transfer state model (22 November 2026)

**Scope:** independent READ-ONLY metadata/view-definition and bounded November queries. No migration/permissions/release changes.

### WIP freshness: resolve owner's question precisely

- `public.mv_wip_rollup` and `public.mv_bottled_rollup` are **ordinary public wrapper views**, each reading `app_private.mv_wip_rollup` and `app_private.mv_bottled_rollup` respectively. Both `app_private` objects are genuine materialized views (`pg_class.relkind='m'`). The private WIP MV's definition sums current `v_wip_batches.batch_size` at refresh time, not the same eligible expected-net output as the planning WIP deduction. A refresh timestamp/schedule for the private MV was **not established** in this check. Do not label this cached WIP rollup real-time.
- The **effective planning WIP deduction** follows `v_product_bulk_net_to_make_after_wip -> v_wip_expected_output_base -> v_wip_batches -> public.daily_work_log`, plus `rm_bom_header` and `inv_uom`. All these intermediate WIP nodes are ordinary views, not materialized. `v_wip_batches` selects `Doing` or `In Storage` with Intermediate storage activity; `v_wip_expected_output_base` derives eligible expected output `batch_size*(1-process_loss_pct)` with product/BOM/UOM checks. This is based on current source-record state at query time, but can be expensive and is NOT a guarantee of event-perfect as-of history.
- `v_product_bulk_soh -> fg_bulk_stock` is also through ordinary views; `fg_bulk_stock` sums `fg_bulk_stock_ledger.qty_base` by product/batch. Unlike the separate private MVs, its correctness/freshness depends on ledger completeness and event corrections. Thus **do not change MIS planning source** merely because other reporting MVs exist; performance optimization, if needed, requires a bounded cache with explicit freshness timestamp and no false historical claims.

### Packaging/FG movement evidence

- `public.event_type_lkp` explicitly has packaging types such as `Bottling`, `Bottling and labelling`, `Bottling, labelling and cartoning`, pouch/carton/capsule actions with `is_packaging=true`, `affects_bulk_stock=-1`, `affects_bottled_stock=+1`. `Transfer to FG store` has `is_packaging=true`, `affects_bulk_stock=0`, `affects_bottled_stock=-1`. This is **strong source-definition evidence** for three distinct flows: bulk stock, packaged-but-not-transferred stock, and FG transfer. Do not subtract the same quantity from bulk a second time when transferred out of packaged stock.
- `packaging_events` relates to `daily_work_log` through `work_log_id`; `event_skus` carries `sku_id` and pack count. `bottled_stock_on_hand` derives the signed inventory position by batch/SKU from `event_type_lkp.affects_bottled_stock`, and translates pack counts into product-base quantity using SKU pack size/conversion. This view is ordinary/current, and distinct from the cached private `mv_bottled_rollup`.
- Scoped November 1–21 `daily_work_log.log_date` packaging event census: `Transfer to FG store` **130 packaging_events**, across **80 distinct batch_number strings**, total **73,572 packs** across linked event_skus. Other packaging actions include 102 `Bottling, labelling and cartoning`, 6 monocarton packing, 3 Bottling, 3 capsule carton packing, 2 pouch packing, 1 dangler/carton and 1 bottling/labelling. These pack counts span products and SKU sizes, **never add them to claim a homogeneous bulk production quantity**.
- Independently `v_tally_fg_transfer_event` for Nov 1–21 had **110 transfer date/product/batch groups across 86 product/batch keys**, all 110 with `tally_total_in_base` present, and no observed `all_sku_mapped` or `all_godown_mapped` failures in that subset; 104 MATCHED and 6 MISSING_LOG from contemporaneous reconciler. **130 packaging-event records ≠ 110 grouped Tally events**—date basis, duplicate/multiple work logs, and grouping differ. This alone is neither an integrity bug nor proof of parity.

### Revised C1–C3 operational semantics (owner-provided, NOT YET ALL SOURCE-VERIFIED)

- **Finished production transfer event:** verified quantity of a SKU converted from completed manufacturing/packing and transferred to FG. A batch can contribute multiple partial transfers on different days. Every such transfer represents already-finished processing for that *transferred quantity*; do not wait for whole-batch closure to recognize it.
- **Entire batch closure:** separate status triggered only when all accountable batch material has been converted to finished SKUs and transferred, **net of authorized process losses, residual stock and adjustments**. Do not infer closure from a `Done` intermediate-storage log, a single transfer, or a zero balance without verifying correction/quantity provenance.
- **Two types of value:** FG transfer *Tally book amount* remains the established book basis; finished-transferred *manufacturing cost* would require SKU-wise transferred quantity plus correctly attributable approved manufacturing-cost rate and consistent date/basis. No current server evidence yet proves the exact SKU transfer full-cost numerator and total-batch closure. Keep formal achievement `NULL / NOT_COMPARABLE` until that proof.
- **Date semantics:** transfer date measures amount finished/transferred in the period, whereas whole-batch closure date can be later. Batch completed-count and transferred-output value are therefore **different KPIs**.
- **Action for next bounded audit:** reconcile SKU-level `event_skus` transfer counts with work-log SKU breakdown and Tally voucher lines by product+batch+date+SKU, establish source precedence for completed-transferred output, then test total packing/transfer/outstanding bulk/packaged quantities and losses for selected batches. Distinguish historical-as-of transfer events from mutable current balances. Security and ≤8s authenticated latency remain gates.

**Decision:** no need to introduce a new WIP MV for correctness. Preserve direct planning dependency and optionally optimize with a fresh, labeled read model only if performance requires it. Finished-SKU transfers are the candidate operational output evidence; full-batch closure requires a separately verified conservation/accounting rule. No SQL installation was authorized by this inspection.


## XII. FG bulk ledger balance and whole-batch transfer-closure audit (22 November 2026)

**Owner raised the existing `fg_bulk_stock` and `fg_bulk_stock_ledger` as potentially sufficient stock-balance truth. Independently verified live object definitions and bounded SELECTs. All checks read-only; no DML, schema, or release change.**

### Exact existing flow

- `public.fg_bulk_stock_ledger` is the physical append/movement table; `public.fg_bulk_stock` is an **ordinary view** grouping by product ID and batch and summing `qty_base`. It exposes `qty_on_hand` and base UOM, rounding to three decimals and clamping abs(raw sum)<0.005 to displayed zero. It already carries source movement timestamp and category metadata.
- The ledger includes positive FG bulk storage receipts; `event_skus` packaging consumption entries, typically negative; storage update/delete corrections; balanced internal transfers (out/in); manual adjustments and small-balance cleanup. Therefore the stock view **already gives current remaining bulk**, and a second MIS bulk-stock ledger is unnecessary.
- `public.bottled_stock_on_hand` is an **ordinary view** built from `packaging_events + event_skus`, signed by `event_type_lkp.affects_bottled_stock`, grouped by batch/SKU and filtered to positive `on_hand`; it exposes pack counts and `total_qty_in_base` for finished-packaged-not-yet-transferred stock. Ensure product ID comes via `product_skus`; never join on batch string alone. `Transfer to FG store` has `affects_bottled_stock=-1`, `affects_bulk_stock=0`, while packing has bulk -1 and packaged +1. Transfers must **not** consume bulk twice.
- The private `app_private.mv_bottled_rollup` is separate and cached; the direct packaged-stock balance is not itself a materialized view.

### Verified live balance census

- `fg_bulk_stock` produced **1,281 product/batch stock keys** in scoped full current view: **44 positive remaining**, **1,237 displayed zero**, **0 negative displayed balance**. These are **current** balances, not number of batches completed in November and not historical cutoff balances.
- `fg_bulk_stock_ledger` presently has **6,864 movement rows**. Its reason-source census includes **764 `manual_adjustment` rows from `fn_fg_force_close` across 678 batch keys**, plus **187 `auto_zero_epsilon` rows**; separate `fg_bulk_internal_transfer` entries have matching in/out movement records. Hence **zero bulk can reflect a governed adjustment, not necessarily that every gram was packed**.
- Current `bottled_stock_on_hand` has **7 positive batch/SKU rows** (sum of 4,304 pack units, not a cross-SKU bulk quantity). Joining by product+batch to the 1,281 bulk keys found **2 product/batch keys with displayed zero bulk but positive packaged stock still awaiting transfer**. The total number of packaged rows need not equal the number of distinct affected batch keys; a row is batch×SKU.
- **Critical business distinction:** `fn_fg_force_close` posts a counter movement `-current bulk balance` with `reason_code='manual_adjustment'` then runs `fn_fg_reconcile_batch`. `fn_fg_auto_zero` neutralizes small nonzero balances under epsilon. `fn_fg_reconcile_batch` marks related `daily_work_log` FG bulk-storage rows `Done` when the adjusted/remaining **bulk ledger balance** is within tolerance. It does **not** verify that all finished SKUs were transferred to FG. Thus `daily_work_log.status='Done'` in FG storage is a **bulk-balance-reconciled status**, not end-to-end batch-fully-transferred status. Some different completed_on timestamps may be explainable by when source rows were recorded or adjusted, not necessarily erroneous completion events.

### Revised C1–C3 output and closure rule

**Separate at least these states** for one governed (product_id,batch/BMR):
1. `IN_PROCESS_OR_BULK_REMAINING`: positive true bulk balance or eligible in-process material; report bulk remainder in base UOM.
2. `PACKED_PENDING_TRANSFER`: packed SKU units remain positive in `bottled_stock_on_hand`, regardless of whether bulk balance displays zero.
3. `PARTIALLY_TRANSFERRED`: one or more valid finished SKU transfers occurred while bulk and/or packaged balances remain, including partial transfers across days.
4. `ZERO_BULK_PENDING_RECONCILIATION`: ledger balance zero but non-packing force-close/manual adjustment/corrections are present without independently accepted quantity-disposition evidence; cannot mark production wholly fulfilled solely from zero balance.
5. `FULLY_TRANSFERRED_CONFIRMED`: all attributable batch bulk accounted for via valid packaging consumption, approved loss/adjustment, AND no positive packaged-SKU stock remains, AND transfer reconciliation/outstanding issues are resolved. This is a **proposed acceptance contract, not an already implemented status**. Confirm whether all transfers need Tally+work-log parity or a governed source hierarchy, and whether approved loss can qualify as fully accounted rather than fully transferred, before implementing.
6. `REVIEW`: mapping, UOM, correction, stale sources, negative history or discrepancy prevents a confident status.

**Crucial qualifiers:** `fg_bulk_stock.qty_on_hand` rounds/clamps, so audit closure against **raw SUM(ledger.qty_base)** with approved product-base-UOM epsilon, rather than trusting the displayed zero alone. `bottled_stock_on_hand` filters to strictly positive balances, so validate for negative/overdrawn SKU-batch net values before asserting full transfer. Do not count a batch as fully closed solely because `daily_work_log.status='Done'`, `fg_bulk_stock.qty_on_hand=0`, or a force-close adjustment occurred. A batch may have both zero bulk and remaining packaged stock. Corrections/late movements may reopen any live computed status; for historical metrics need time-bounded source events and truthful freshness.

### Next bounded independent proof

A. Trace ledger movement reasons to `packaging_events/event_skus` and raw batch net balances for 2 zero-bulk-but-packed keys plus one force-closed batch; B. reconcile SKU-packed increments, finished SKU transfer decrements and positive packaged on-hand by product+batch+SKU, not mixed pack counts; C. validate Tally/work-log/packaging transfer source selection and partial-transfer dates; D. prove how approved process losses/manual force-close amounts are characterized; E. define negative-balances/epsilon exceptions and historical-as-of cutoff. No parallel stock ledger, direct unbounded view in MIS RPC, or batch-complete achievements until evidence and owner source-policy acceptance.
