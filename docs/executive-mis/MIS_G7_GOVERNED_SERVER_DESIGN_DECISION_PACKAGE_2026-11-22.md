# Executive MIS G7 — governed production reporting design decision package

**Prepared:** 22 November 2026 IST  
**Status:** DESIGN FOR OWNER REVIEW; NOT APPROVED FOR INSTALLATION  
**Scope:** plan sealing, formal completion-event valuation, FG transfer reconciliation, no new client functionality yet  
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
