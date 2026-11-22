# Executive MIS G7 — governed production reporting design decision package

**Prepared:** 22 November 2026 IST  
**Status (current, 22 November 2026):** P1–P3 live-governed planning accepted as design direction; C1–C3 stock/packing/transfer evidence substantially audited but full-COP/whole-batch criteria and historical exceptions remain OPEN; T1–T3 process reconciliation remains OPEN. Mandatory accounted FG bulk, governed positive excess output, and inline authorized packing modal are OWNER-ACCEPTED BUSINESS/UX POLICY for future route logging—not installed. NO SERVER/CLIENT INSTALLATION AUTHORIZED.  
**Scope:** live governed plan and registered-batch reconciliation (supersedes mandatory plan sealing), formal completion-event valuation, FG transfer reconciliation; no new client functionality yet  
**Existing backend:** Supabase `qhmoqtxpeasamtlxaoak`  
**Source-of-truth ledger:** `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md` on `docs/executive-mis-workflow-20261119` (draft PR #485; still unmerged into `main`)  
**Already accepted:** sole `public.get_mis_production_value_summary(date,date)` with bounded approved-reference receipt subtotal; PR #493 client merged to `main`.  
**Absolute HOLD:** no DDL/DML, no new RPC, no employee-level disclosure, no permissions expansion, no global timeout change, no Costing Suite/Electron release change, no PR #485 merge, no invented full-COP actual or plan achievement.

## Executive decision

> **CURRENT AUTHORITATIVE PRECEDENCE NOTICE (22 November 2026):** Sections IX–XVIII and the canonical workflow §§34–43 supersede conflicting earlier G7 proposals in this document. In particular, an immutable frozen monthly plan is **not** required for the primary current-state requirement KPI; an actual FG bulk storage receipt, its `Done` status or a rounded zero bulk balance is **not** proof of whole-batch FG transfer; and a source-backed extra bulk quantity can be entered by an explicitly authorized operator from the packing in-page modal with a single guarded atomic excess-plus-pack post. Sections I–VIII are preserved as historical design history and are **not** operative policy where inconsistent. Production route changes are a separate governed workstream. The accepted monetary RPC is still partial/indicative; plan and whole-completed value and achievement remain unavailable pending proof and explicit installation approval.

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


## XIII. End-to-end representative batch ledger, packing and FG transfer parity — 22 November 2026

**Audit:** Read-only live scoped data in Supabase project `qhmoqtxpeasamtlxaoak`. Owner suggested using existing `fg_bulk_stock` and `fg_bulk_stock_ledger`; this bounded proof uses exactly those records plus `packaging_events`, `event_skus`, `bottled_stock_on_hand`, `event_type_lkp` and `v_fg_transfer_reconciliation`. No DDL, DML, mutation, permissions, client, cache or release changes.

### Fixture 1 — product_id 106 / batch 6394 (Ksheerabala Thailam 101 Avarthi Soft Gel Capsule)

- Product base UOM = **Nos**; ledger `FG bulk storage` +104,100 Nos (8-Jan-2026); `Capsule monocarton packing (SKU)` -104,100 Nos (9-Jan). **Raw bulk ledger balance exactly 0** (not a rounded artifact).
- SKU 62, 100 Nos per pack: 1,041 packs produced = **104,100 Nos**; `Transfer to FG store` has **seven distinct SKU transfer event lines totaling 700 packs = 70,000 Nos**, dated 13-Jan through 13-Oct-2026. **341 packs = 34,100 Nos remain in packaged stock** (positive `bottled_stock_on_hand`).
- Tally reconciliation for the matching product/batch shows **seven matched OK transfer groups**, 10,000 Nos each, aligned with 70,000 Nos actual transfers. This is a full packaging-but-partial transfer case, **NOT full batch transfer closure**, even though the bulk ledger reads 0.

### Fixture 2 — product_id 966 / batch 5144 (Kungileeya Vennei)

- Product base UOM = **Kg**. Ledger `FG bulk storage` +30.080 Kg (24-Feb-2026); SKU packaging consumption -7.200 Kg on 25-Feb and -20.200 Kg on 26-Feb, total **27.400 Kg packed**; plus `fn_fg_force_close` `manual_adjustment` **-2.680 Kg** (26-Feb). Thus **30.080 - 27.400 - 2.680 = 0.000 Kg raw bulk**. The -2.680 Kg is an adjustment, **NOT proven accepted process loss or finished output**, and must not be silently valued as packed production.
- SKU 1239, 50 g pack: 144 + 404 = **548 packs produced (27.400 Kg)**; FG transfer event lines 144 + 211 = **355 packs (17.750 Kg)** on 26-Feb and 8-Jun. Hence **193 packs = 9.650 Kg positive packaged stock remains**.
- Tally reconciliation reports two transfer groups MATCHED/OK at **7.200 Kg + 10.550 Kg = 17.750 Kg**, matching the packaging transfer quantity. Again **zero bulk is not full batch transfer**; it additionally has a force-close exception requiring approved disposition evidence.

### Raw packaged stock negative-net caveat

A separate read-only full aggregation of signed `packaging_events` × `event_skus` × `event_type_lkp.affects_bottled_stock`, grouped by product_id, batch_number and sku_id, returned **2,781 batch/SKU keys: 7 positive, 2,765 zero, 9 negative** at query time. Existing `bottled_stock_on_hand` explicitly filters `WHERE h.on_hand > 0`, so **negative SKU/batch balance exceptions are hidden from that view**. The nine cases are not yet classified (over-transfer, correcting event, duplicate, date issue, mapping or legacy), and no production records were altered. A future closure check must evaluate signed **unfiltered** net positions, require no negative unresolved SKU balances, and use `bottled_stock_on_hand` only as the positive waiting-to-transfer lens. Never infer fully transferred from the emptiness of positive-stock rows alone.

### Governed C1–C3 closure policy refinement

1. **Bulk consumed into packaged output** is proven from bulk ledger `event_skus` negative packaging entries, with documented adjustments separately.
2. **Packed awaiting FG transfer** is measured by SKU-level signed packaging `+count` versus transfer `-count` movements using product+batch+SKU key, and product-base conversion only when UOM evidence passes; no mixed pack totals.
3. **Finished output transferred** is recognized for each validated `Transfer to FG store` event, independent of whether the entire batch is closed. Tally voucher reconciliation remains a separate evidence quality flag, not a substitute for a manufacturing full-COP rate.
4. **Fully transferred batch** must have no valid bulk remaining above governed tolerance, **no positive packaged SKU remaining**, **no negative/unresolved SKU balance**, no unreviewed force-close/correction or unexplained loss, and transfer/packing lineage parity. Distinguish `FULLY_ACCOUNTED_WITH_ACCEPTED_ADJUSTMENT` from `ALL_PRODUCTION_TRANSFERRED`; never call an unreviewed material write-off "completed manufacturing".
5. **Status remains REVIEW** if any evidence is missing, contradictory or historically stale. As-of transfer metrics are event-based; current balances are not a historical month-end reconstruction.

### Next bounded acceptance case

Investigate the nine negative packaged SKU keys as grouped exception categories without changing data; sample positive/zero/negative balances by common source key; verify the effect of adjustments and corrections on transfer-line integrity, establish whether event stock accounting excludes non-packed stages, and define whether the operational module's **force-close** is a permissible *closed-accounted* status but never evidence of **all finished stock transferred**. Do not add schema or alter canonical RPC pending owner approval and validated performance/security.


## XIV. Nine negative packaged-SKU balances — bounded exception classification (22 November 2026)

**Scope and result:** independently inspected live `packaging_events` + `event_skus` signed by `event_type_lkp.affects_bottled_stock`, grouped strictly on **product_id + batch_number + sku_id**. Checked raw event/work-log references, dates, and the matching product+batch `fg_bulk_stock_ledger` movements. Read-only SELECT only, no data repairs, writes, permissions or deployment. **Nine** negative SKU-batch balances persist in the queried current record history. Dates range **29-Sep-2025 to 24-Feb-2026** (event-specific spans below); these are legacy/historical relative to November 2026, not nine proven new/current-month transfer failures.

| Product | Batch | SKU | Packed packs | Transferred packs | Signed deficit (packs) | Date span in packaging/work logs | Classification at evidence gate |
|---|---|---|---:|---:|---:|---|---|
| 118 Avipathi Choornam | 6172 | 77 (50 g) | 2554 | 2599 | -45 | 11–20 Dec 2025 | Extra 45-pack transfer beyond recorded packing; bulk has force-close adjustment |
| 189 Asanavilwadi Enna | 6396 | 1774 (450 mL) | 0 | 115 | -115 | 23 Jan 2026 | No positive packing event for this SKU; another SKU 205 exists in same batch, and storage update/delete + 3 force-close rows require review |
| 328 Murivenna | 6237 | 572 (100 mL) | 2730 | 3570 | -840 | 11–18 Nov 2025 | Transfer of 840 packs precedes first recorded packing event by one day; four SKUs exist in batch; force-close adjustment |
| 396 Chandraprabha Gulika | 6111 | 636 (100 Nos) | 150 | 443 | -293 | 23 Oct–6 Nov 2025 | Extra late transfer events beyond 150 packs recorded; no force-close ledger found |
| 396 Chandraprabha Gulika | 6259 | 636 (100 Nos) | 0 | 446 | -446 | 17–24 Feb 2026 | No packing events for this SKU/batch; no FG bulk ledger rows found for this batch |
| 439 Vilwadi Gulika | 6002 | 649 (100 Nos) | 105 | 803 | -698 | 25 Oct–10 Nov 2025 | Extra 698 packs transferred; bulk ledger contains distinct `manual_stock_out` -69,800 Nos, suggesting a stock-documentation pathway that **does not prove packaged output** |
| 443 Karuthavattu Gulika | 6031 | 651 (50 Nos) | 0 | 326 | -326 | 18 Nov 2025 | No packing events; bulk ledger has a net-zero Bottling pair, no positive FG bulk storage receipt in scoped ledger |
| 752 Keezharnelli Tablet | 4978 | 930 (100 Nos) | 920 | 973 | -53 | 29 Sep–20 Oct 2025 | Extra 53 packs transferred after recorded complete packing/transfer of 920; no FG bulk ledger rows found for this batch |
| 959 Amukkura Lehyam | 4974 | 1231 (400 g) | 0 | 683 | -683 | 31 Oct–3 Nov 2025 | No packing events for this SKU; ledger has storage update and force-close adjustment; requires historical provenance review |

**Arithmetic invariant:** four of nine (products 189, 396/batch6259, 443, 959) have **zero positive packing packs** for that exact SKU/batch; the other five have recorded packing but greater FG transfer packs. All nine transfer events above are linked to existing `daily_work_log` rows and packaging-event IDs; this is not a missing-`Transfer to FG store` event problem. All nine negative balances are hidden from `bottled_stock_on_hand` because it filters positive `on_hand > 0`.

**Important limitations:** these are **signed pack-ledger exceptions**, not confirmation of theft, over-shipment or erroneous Tally entries. No user should change stock based only on this MIS investigation. Historical packing may be absent from the event model, there may be pre-migration balances, backdated corrections, repeated/alias mapping, or independent manual stock movements. The latest Tally snapshot dated 2026-11-22 does not necessarily preserve the needed historical voucher-line populations for these batches; a full all-snapshot join was not attempted, so **Tally independent parity on these nine is NOT TESTED**. Product 189 and 328 have other SKUs in the same batch, but those do **not** cancel negative stock for a different SKU unless audited, authorized conversion/repacking exists. The absence of FG bulk ledger rows for certain batches does **not** prove no physical bulk existed; only the scoped ledger records are absent.

**C1–C3 classification accepted as design recommendation, subject to owner policy approval:**
- `PACKAGED_STOCK_EXCEPTION_NEGATIVE`: signed net <0 at product+batch+SKU. Mark batch `REVIEW` even if displayed FG bulk balance 0 and positive packaged-stock view is empty.
- `PACKAGED_STOCK_PENDING_TRANSFER`: signed net >0. Recognize packed but not yet transferred independently.
- `PACKAGED_STOCK_BALANCED`: signed net =0 and completeness of source history verified; on its own not enough for whole-batch closure.
- `LEGACY_COVERAGE_UNVERIFIED`: pre-existing transfer without governed opening packaged stock / pack-production history. Need approved migration cutover date and opening balances before declaring a true over-transfer.
- `BULK_ADJUSTMENT_REVIEW`: a force-close/manual adjustment exists and material disposition has not been independently accepted; do not treat it as packed output, nor as completed transfer.
- `FULLY_TRANSFERRED_CONFIRMED`: only with raw (unrounded) FG bulk balance within approved epsilon, no positive or negative SKU balances, all corrections/adjustments accounted, complete transfer-source lineage with reconciled SKU quantities, and appropriate historical starting balances.

**Next narrow source-policy decision:** identify historically complete packaging-event coverage/cutover and whether an approved packaged-stock opening balance exists; scrutinize the nine legacy cases against earlier Tally snapshots, original stock documents and correction reasons before any data repair or irreversible full-batch classification. For ongoing periods, a guarded event-based closure model is viable using the existing ledger; a separate duplicate stock ledger remains unnecessary.

**Programme status:** G7 remains OPEN. No application code, SQL migration, production repair or Costing Suite/Electron release action authorized.


## XV. Future compulsory FG bulk accounting checkpoint — owner proposal and current trigger gap (22 November 2026)

**Owner proposal (under design review, no implementation authorization):** all product/batch production routes should pass an accountable FG bulk stage before any SKU packaging event; older logging allowed routes to bypass that stage. Owner suggests backfill and future enforcement as part of migration from generic work logs to product-route-based logging.

### Independent read-only proof

- `trg_fg_ledger_from_es` (AFTER INSERT/UPDATE/DELETE on `event_skus`) computes bulk consumption for events whose `event_type_lkp.affects_bulk_stock <> 0`. It explicitly contains `IF NOT EXISTS (SELECT 1 FROM fg_bulk_stock_ledger WHERE product_id = ... AND batch_number = ...) THEN RETURN COALESCE(NEW,OLD);` **This silently skips the bulk movement** where batch lacks any existing ledger row, rather than enforcing prerequisite registration. Thus bulk-stock balance can be absent while packing and subsequent FG transfer event quantities exist.
- `fn_fg_ledger_check_negative` (BEFORE INSERT on `fg_bulk_stock_ledger`) rejects a new insert that makes the **existing** product/batch bulk sum negative. It does **not** validate the absence of unposted packing events or enforce that all earlier packaging was ledger-accounted. `enforce_packaging_event_type` only validates membership in packaging event-type lookup; it does not enforce prior FG bulk recognition.
- `trg_fg_ledger_from_dwl` posts non-packaging FG bulk storage when `storage_qty`, active event type and base UOM match; once sourced, product/batch/activity/location cannot be silently changed, and quantity correction requires governed writer context. These existing integrity guards must remain intact.
- Read-only population census at current inspection: **1,900 distinct (product_id,batch_number)** with `event_type_lkp.affects_bulk_stock<0` packaging events in `packaging_events + event_skus`. Of these, **645** have **no ledger row at all**; **649** have **no positive `reason_code LIKE 'FG bulk storage%'` ledger receipt**. Difference of four represents keys with some ledger movements but not a qualifying positive storage receipt. Cohorts are cross-period/current historical data, not 2026-Nov exceptions or a quantified physical storage deficit. The 645/649 categories are NOT a proof that 645 historical physical warehouse transactions occurred and are absent.
- Prior nine negative packaged SKU balances represent **packing-versus-transfer signed pack-accounting exceptions**; mandatory FG bulk ledger alone cannot resolve missing packing event/SKU transfer entries, historical opening pack balances, duplicate or invalid transfer counts.

### Revised architecture recommendation — **mandatory accounting checkpoint, not invented physical interim handling**

1. Every **new route-controlled batch** must have a governed **`BULK_OUTPUT_ACCEPTED` / `FG_BULK_ACCOUNTING_READY`** source event with product+batch/BMR+route version+accepted actual output+base UOM+effective timestamp and provenance **before** any bulk-consuming SKU packing event. Route defines whether physical intermediate FG bulk storage/movement happened; direct processing-to-packaging routes still require bulk-output accountability, not a fake temporary storage transfer.
2. For physical interim storage routes, existing `FG bulk storage` DWL/ledger receipts remain genuine location stock movements; for direct-route batches, a **route-defined controlled transfer into the bulk-accounting domain** (not fabricated old storage/warehouse event) can support ledger conservation. Exact movement semantics, source tables and location inventory must be independently designed; **do not add synthetic ledger receipts** without authorized source and matching existing stock.
3. **New packaging guard** at the *governed writer/atomic event boundary* must verify the specific batch's initialized bulk-accounting record, accepted quantity, current available base-UOM balance and route eligibility, then post consumption exactly once. It must fail closed if missing; avoid an AFTER-trigger silently returning and leaving a successful unposted event. Review concurrency/lock idempotency, correction reversal, and failure atomicity. Do not tighten directly on all legacy update/delete paths without migration plan.
4. **Separate SKU transfer guard** must validate that enough packaged quantity is available by **product+batch+SKU** (or is explicitly covered by an approved opening balance/correction) before FG transfer is accepted; never let signed packaged stock go negative silently. Consider destination Tally posting latency as reconciliation, not permission to fabricate packed stock.
5. **Historical backfill under classification**, not a blanket positive `fg_bulk_stock_ledger` insert. Partition the 645 no-ledger, four ledger-without-receipt, and already-covered cohorts by route and time. Seek original production quantities/BMR, process-loss and route evidence, actual packing event consumption, former opening stocks, pre-migration data sources and Tally. Compute an **offline reconstructed movement schedule** with exact product/UOM/source proofs and net-current-balance effect **zero unless explicitly authorized**; an unsupported quantity receives `LEGACY_UNVERIFIED`, not invented stock. Require owner-reviewed exceptions and idempotent migration keys. Never backdate a new warehouse receipt as though physically evidenced.
6. **Phased activation:** (A) catalogue route types and historical coverage; (B) audit source-of-truth/fixture and reversible migration scripts with before/after fingerprints, disabled guard for legacy traffic; (C) prospective guarded rollout **only for newly created route-controlled batches after owner-approved cutover**; (D) separately migrate permitted existing/open batches after reconciliation; (E) only then consider older signed ledger cohort cleanups by authorized evidence, never silently.
7. **No false success metric:** mandatory FG bulk accounting can repair the *missing bulk-ledger source event class*, but negative packaged net balances are an independent source-accounting problem. Closure requires correct bulk+packed+transferred conservation, accepted adjustments, coverage, and historical cutover boundaries. Do not assert that the nine existing negative SKU positions will disappear from just installing the bulk prerequisite.

### Independent acceptance before any DDL/DML or client package

- Valid direct-production-to-packaging route without physical storage must pass the **accounting checkpoint** but must not claim fictitious warehouse handling.
- Missing registered bulk output + attempted packaging fails atomically, with no work-log, `event_skus` or ledger partial write.
- Insufficient bulk qty, wrong product/BMR/batch/route/UOM, duplicate event replay and simultaneous packing writers fail safely; authorized corrections and reversals stay fully auditable.
- A correctly registered output and valid packing creates **exactly one** bulk debit.
- An FG transfer exceeding same SKU/batch available packed stock is blocked or governed by an explicit correction; no negative packaged balances.
- Force-close and epsilon adjustment remain visible as separate disposition types, not counted as finished produced output.
- Historical backfill is reproducible, traceable, with source documents, no unauthorized increase in net inventory and preservation of existing Costing, BMR, FG-BIT, Tally and Electron workflows.
- Security: no new authenticated or anon data grants, canonical worker authorization, no client-supplied privilege escalation; bounded query/lock performance and rollback tested.

**Decision request for owner:** accept **future mandatory bulk-accounting checkpoint and separate SKU transfer availability guard** as architectural policies; defer historical migration and enforcement until a scoped source-data recovery plan, permission/caller audit and exact rollout/rollback package are independently reviewed. This belongs to product-route-based logging governance and must be coordinated with (not silently implemented inside) G7 Executive MIS reporting. No production change authorized here.


## XVI. Owner acceptance — mandatory accountable FG bulk and governed excess-output top-up (22 November 2026)

**Owner explicitly accepted principle 1**: every future batch should pass a governed accountable FG bulk output stage before bulk-consuming packaging; physical intermediate storage remains route-dependent. **Owner also accepted principle 2 with a mandatory operational exception**: packaging may not consume more than available accountable bulk, but genuine excess production output may be **added** through an authorized top-up, analogous in governance (not in stock-movement direction) to force-closing a remainder. This is business-policy acceptance for future design, **not** authorization for new SQL, historic backfill, live enforcement or stock correction.

### Precise accepted business contract

- Example: batch has **100 kg accountable FG bulk**. Actual accepted process output is **104 kg**. Operator must first record a distinct **`FG_BULK_ADDITIONAL_OUTPUT` +4 kg** event with actual measured excess, batch/BMR/route, source activity/lot, UOM and time, reason, approver and evidence; *then* 104 kg of packing can be posted. Never create +4 kg automatically because someone attempted 104 kg packing.
- Excess addition must represent **measured genuine physical bulk output**, not an override to make a validation error disappear. Posting it is a new positive stock movement and thus is different from `fn_fg_force_close`, which posts a negative counter-movement to remove the residual. Both deserve reason and audit trail but have different effect on valuation and material accounting.
- A controlled correction path may update/offset an existing recorded output if that is the true business event; the writer must distinguish **correcting an erroneous original quantity** from **adding genuine later process output**. Idempotent request/source IDs, no duplication, rollback via compensating entries, role permission and atomic quantity checks are mandatory.
- New guard must check current batch raw base-UOM balance **after** any approved additional-output event, rather than simply rejecting permanent excess. Same-batch, proper route-stage, product identity, UOM, permissions, source timestamp and process-loss accounting are verified. Reject insufficient balance and do not allow silently skipped ledger deduction; no automatic top-up linked to a packing attempt.
- Loss and excess shall be separately disclosed for correct stock/production costing. An extra output event can change expected yield, allocation/unit cost, quantity recorded for production, and eventual SKU transfer quantities; do not assume previous-month reference COP changes automatically, and do not alter approved Costing snapshots without independent costing governance.
- At time of future-route switch, existing historical no-ledger cohorts require separately proven source-backed backfill; never guess excess quantities from packaging/transfer deficits. The nine historical negative packaged-SKU balances are **not fixed** by FG bulk top-ups; still need packaging-versus-transfer source history and corrections.
- Before implementing, investigate existing `rpc_create_daily_work_log_with_packaging` writer guard and permission model; the current `trg_fg_ledger_from_dwl` permits a source-supported positive FG bulk receipt, and `fn_fg_bulk_batch_balance(integer,text)` supplies raw numeric sum. Read-only positive ledger reason census showed most entries are `FG bulk storage` from daily work logs; a distinct controlled excess-output writer is **not established** by this audit. Designing a new route writer or narrowly extending the existing one requires reviewed migration and explicit owner installation authorization.

### Exact future acceptance tests

A. 100 kg acknowledged +4 kg measured and authorized +104 kg packed = 0 bulk, separate +4 audit; B. 100 kg acknowledged, attempt packing 104 without top-up -> atomic reject and unchanged ledger; C. invalid/mismatched UOM, wrong BMR/route, insufficient evidence, no authority -> reject; D. twice-replayed top-up -> single event; E. concurrent pack/top-up race -> serializable/locked accurate balance; F. corrected original quantity vs true extra output never double-add; G. top-up, subsequent loss/force-close and late correction shown separately in MIS, not mislabeled finished product; H. negative packaged-SKU transfer still blocked independently.

**Gate outcome:** principles 1 and 2 (with excess-output addition) **BUSINESS ACCEPTED FOR ROUTE-BASED DESIGN**. Historial backfill, writer implementation, guard deployment, DDL/DML, client and Electron/Costing remain HOLD pending separate detailed approval. Next policy question: define which existing production users may authorize/sign off the measured excess, whether a quantity tolerance needs escalation, and whether this is an immediate additional output or a correction of original receipt. Do not assume permissions or thresholds.


## XVII. Excess-output writer feasibility, permission review and implementation hold (22 November 2026)

**Owner authorization scope:** accepted route-based **business rules**, not installation/permissions/SQL/legacy backfill. Reopened exact live PostgreSQL function definitions, policy metadata and authenticated/anon grants read-only. This bounded review is a technical implementation design, **not approval of privilege modifications**.

### Existing mechanisms reverified

1. `public.fn_fg_bulk_batch_balance(integer,text)` returns **raw SUM(fg_bulk_stock_ledger.qty_base)** for product/batch (not a rounded UI balance). It can support an atomic guard only when combined with suitable per-batch locking and a correctly authorized writer.
2. `public.rpc_create_daily_work_log_with_packaging(...)` is an authenticated-executable SECURITY DEFINER wrapper checking `public.require_permission('module:add-log-entry',true)`; core is also SECURITY DEFINER but authenticated EXECUTE is revoked. Core inserts `daily_work_log`, then `packaging_events`/`event_skus` if status Done and activity is packaging; those rows drive existing stock ledger triggers. No independent inventory-approved surplus-output workflow was identified in this function.
3. `public.fn_fg_force_close(p_work_log_id,p_user)` is authenticated-executable SECURITY DEFINER checking `public.require_permission('module:fg-bulk-stock',true)`; three-argument helper's authenticated execute is not granted. It negates the balance through a `manual_adjustment` and reconciles; this is **not** a positive bulk-output authority and should not be reversed/reused to fabricate additional receipts.
4. **Security finding needing separate corrective governance:** `public.fg_bulk_stock_ledger` has RLS enabled, yet `pg_policies` reports `fg_bulk_stock_ledger_authenticated_crud` `FOR ALL TO authenticated` with `USING/WITH CHECK ((SELECT auth.uid()) IS NOT NULL)`; `has_table_privilege('authenticated', ..., 'INSERT'/'UPDATE'/'SELECT')` all true. Thus the current policy is **authentication-only**, not a module-specific editor/writer authorization. The effect on all legacy callers, other grants and trigger paths requires a dedicated security compatibility audit. Do **not** alter grants/RLS/ledger triggers as an incidental MIS change.
5. `public.daily_work_log` has authenticated SELECT policy and table privilege to insert/update but no general authenticated INSERT policy was returned; packaging/events only show authenticated SELECT policies in the sampled metadata. The governed RPCs and trigger permissions are therefore essential. No live non-admin impersonation or negative-access tests were performed in this read-only review.

### Proposed excess-output business transaction (not SQL code)

- **Source record:** accepted output of product/BMR/batch (route and batch stage version), measured extra quantity in correct base UOM, proof/reference, reason `ACTUAL_YIELD_EXCESS` distinct from `CORRECTION_OF_RECORDED_OUTPUT`, and who/time plus approved decision. Prevent client-controlled actor identities/authorization.
- **Approval model recommended for owner review:** ordinary authorized production user can *submit measured excess*; permitted product-route/production supervisor (exact canonical permission target to be decided) approves positive adjustment. A separate safety trigger for unusually large variance should be determined from evidence rather than a made-up threshold. If SASV expects single-person approval for small deviations, that is a separate explicit owner choice, not assumed.
- **Posting:** transaction verifies approved source, valid BMR/route, original and adjusted outputs, UOM and product identity; obtains batch-scoped concurrency lock; checks same source/idempotency key; posts **one** positive ledger movement with reference to accepted excess event. A separate correction offsets an erroneous prior quantity instead of double-add. Approved excess is tracked separately from initial output and later force-close loss.
- **Packing:** route writer checks approved FG bulk receipt/accounting checkpoint and **current raw available quantity >= proposed consumption**, and atomically posts SKU lines and signed bulk ledger debit. Missing checkpoint or insufficient quantity aborts the complete work-log/SKU/ledger transaction rather than accepting the event with no ledger movement. Pending request for extra output is not stock.
- **Signed packaged transfer check:** available packages by exact product+batch+SKU, including any governed opening stock and reversals, must cover FG transfer. Positive bulk extra does **not** automatically legitimize an unbacked finished-SKU transfer.
- **Valuation:** added output affects actual yield, batch quantity and potentially computed unit manufacturing costs. Report it as a distinct physical output adjustment; do not silently reopen approved costing runs or assume reference COP recalculation.
- **Visibility:** show `initial accepted output`, `approved additional output`, `packing consumption`, `force-close/approved losses`, `current raw remaining bulk`, `packaged awaiting transfer`, and `finished SKUs transferred` without mixing source-grain or hiding exceptions.

### Test and release hold

Negative tests: authenticated-but-unprivileged actor, read-only MIS actor, no-access actor, duplicate idempotency key, concurrent double consume, bulk top-up without approval, wrong BMR/route/UOM, material threshold escalation, correction-versus-true-excess double-add, posting after route closure, and legacy path not yet migrated. Positive: accepted 100 + approved 4 - packing 104 = 0 with single source-linked ledger posting and auditable authorization. Writer/permission changes must go through **separate owner-approved route/stock governance**, never by adding public RPCs or widening permissions on the MIS read-only workstream. Production installation, data backfill, ledger security tightening and client packages remain **HOLD**. Executive MIS G7 OPEN, six of eleven formal gates closed.


## XVIII. Owner correction — inline excess-bulk modal at the packing action (22 November 2026)

**Explicit owner acceptance and UX correction:** In the new product-route packaging workflow, when the proposed packing quantity exceeds available accountable FG bulk, **an already-authorized person must be able to register the real measured excess quantity directly from an in-page modal, and then post that original packaging action without leaving the module**. This supersedes any assumption in §XVII that *every* positive excess must await a separate supervisor's second-person approval. If the initiating user possesses the **specific canonical excess-output authorization**, they may approve/post their own evidenced excess in the same workflow; otherwise they must not be given a bypass. Owner's correction is UX/business-policy approval, not authorization to install SQL, deploy client, backfill inventory or expand permissions.

### User-facing interaction contract

1. User enters SKU packing counts; server-side guarded preview calculates **required product-base bulk consumption**, exact product+batch/BMR identity, and raw available bulk using the current transaction-safe stock truth, *not* a stale client-side display. If sufficient, standard posting continues.
2. If `required > available`, preserve the entire packing draft and show an **in-page modal** (not a detached new page), with contextual batch/product, current available bulk, required bulk, **calculated shortage**, source UOM, and the measured additional quantity. The default suggestion may be exactly the shortage but it must remain explicitly editable and confirmed as **genuinely produced bulk**; it must never be silently accepted or automatically booked.
3. If the user has the **explicit excess-add permission**, show **Add excess and post packing**, with reason/actual measurement/evidence and acknowledgement; verify permission on the server. If not authorized, the interface cannot post an excess. Offer an authorized approval pathway (submit/request approval or route to permitted person) without losing draft, subject to separately agreed roles/UX; don't imply every `module:add-log-entry` user has excess-add privileges.
4. On authorized confirmation the *preferred design* is **one atomic server command**: recheck current stock and source permission under batch lock; create idempotent, source-linked actual-excess recognition **+delta** and then post packing work-log/packaging/SKU events with its matching bulk deduction; commit only if all steps pass. Any error must roll back the proposed excess and packing together so a failed pack does not create stranded positive bulk. Preserve original packing draft for retry. If staging or independently saving an excess receipt is necessary due to real measured inventory, it must use a separately explicit action and show the remaining stock; never claim it happened if it did not.
5. In all cases protect correction-of-original-quantity versus true additional yield, source evidence, route/BMR/BOM/pack UOM consistency, idempotency and concurrent packing/top-up attempts. The quantity added can exceed the immediate packing shortage only when separately evidenced/authorized as genuine measured output; any balance thereafter remains visible in current FG bulk stock. No client-supplied actor/privilege.
6. After success show updated bulk stock and packing receipt, excess ledger source ID and actor, with a separate variance annotation for production/costing. No fresh phantom physical storage activity for direct-route products, and **never** convert an excess modal into a generic direct-edit control for `fg_bulk_stock_ledger`.
7. Accessibility/UX: compact consistent ERP modal with light-filled inputs, clear validation, predictable focus, keyboard interaction and sensible narrow-screen layout; avoid unnecessary counter labels; use theme tokens, not hardcoded palette; preserve uniform in-module modal pattern. Server response/error states distinguish `INSUFFICIENT_BULK`, `NOT_AUTHORIZED`, `CONCURRENT_STOCK_CHANGE`, `INVALID_EVIDENCE` and `NOT_READY_FOR_PACKING` without disclosing restricted records.

### Acceptance tests

- Authorized operator: available 100 kg, draft packing 104 kg; shortage 4 kg; modal adds evidenced 4 kg and original packing posts in **one atomic operation** with +4 and -104 ledger movements; final stock 0 and exactly one completed packing event.
- Authorized operator rejects/cancels modal: no excess or packaging write; draft survives.
- Unauthorized user: no excess action and server rejects forced request; draft preserved for an approved operator.
- Concurrent writers race: recompute shortage; don't double-add, double-pack or create negative stock; stable idempotency key yields one event on retry.
- Measured excess smaller than shortage: remaining shortage still blocks packing; measured excess greater than shortage: require explicit independent evidence, not automatic client generated quantity.
- Packing UOM/BMR/product mismatch or failed SKU breakdown: **both** excess and packing roll back.
- Corrected original bulk-output entry and force-close remain distinct from true positive yield; existing ledger permission risks remain a HOLD gate.
- Additional-output variance impacts production report but never mutates already-approved costing run values without separate governance.

**Governance:** Server security/stock writer work belongs in a separate approved product-route/FG-stock work package, followed by a detailed Claude bulk client package when appropriate; neither is an incidental MIS G7 patch. No enforcement, migration, data correction or release authorized by this decision. G7 OPEN, 6/11 formal gates.
