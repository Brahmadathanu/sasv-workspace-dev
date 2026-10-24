# AU-2c SKU evidence; AU-5/AU-6 design; Sheets proposal flow
## SKU 1277 (product 1038 Palthulli, 5 mL)
Batch ref 16.32 kg (min=pref=max). BMRs: 5835, 6393, 6811, 0146 (0146 created 2026-09-28, no transfer yet). FG transfers per batch: 5835 → 2,784 packs/17.68 kg; 6393 → 2,604/16.54 kg; 6811 → 2,700/17.15 kg. Net output ≈ 2,600–2,780 packs/batch (yield 101–108% on kg basis ⇒ mL→kg density conversion needs check). Standard cost/pack = product batch cost ÷ net output (~2,700), not per-SKU minimum batch.
## SKU 879 (product 696, 20 g)
Approved batch 32 kg (2026-08-06). **No BMR and no FG transfer** in records ⇒ no observed output; theoretical 1,600 packs if wholly packed in 20 g. Needs plan frequency before costing.
## AU-5/AU-6 design
- Standard cost per product = batch reference cost ÷ governed net output (base qty), then per SKU = × pack base qty. No SKU-level duplication of product cost.
- Actual period expenditure: Tally heads by period with source lineage (snapshot id, as_of date), purchases vs consumption separated.
- Absorption/variance ledger: absorbed = rate × workload of actual completed batches (BMR completion + FG transfer, first-transfer dedup); variance = actual − absorbed per head; spending vs volume split.
- Integration: new stages after cost build in job 61 pipeline; ledger keyed to refresh_run_id and valuation_date; never writes designated runs.
## Google Sheets proposal flow (future; existing sheet untouched)
Server view exports proposals with version, valuation_date, run id/designation status, rate lineage (budget head, denominator source); new tab/new sheet only; read-back is advisory, approval stays server-side designation.
