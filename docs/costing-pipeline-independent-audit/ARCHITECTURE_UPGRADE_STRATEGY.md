# Architecture upgrade strategy: costing suite (A4/A5/A6/A9 inputs)
Status: **PROPOSAL**, grounded in verified A0, A1 and A3 findings. Nothing here is approved or implemented. Each WP needs a user go-ahead, an isolated branch DB test (A10) and a Finance sign-off where marked.

## 1. Why the current design gives wrong prices (verified root causes)
| # | Root cause | Evidence | Financial effect |
|---|---|---|---|
| R1 | Workload charges a whole batch every month (min 1) instead of using batch-true standards | A3-F1/F5; 600 charged vs 280.37 forecast vs about 140 actual completed batches/month | ₹8.20 lakh/month on 125 low-volume products; the 335 mainstream products understated by about ₹7.46 lakh/month (+83% under batch-true) |
| R2 | Expense provision = abs() + max-of-max over a source that changed basis mid-year | A1-F1…F5, D-013 trace | POH ₹9.75 lakh vs ₹6.30 lakh FY average; sign errors (Forex) |
| R3 | No separation of standard cost, period absorption and variance | A3, D-014 | Absorption problems are pushed into SKU unit cost |
| R4 | Snapshots and runs not structurally immutable; refresh RPCs re-runnable on SUCCESS runs | A0 sweep 2, V1–V3 | Historical reference (run 119) can drift silently |
| R5 | 33 live migrations not in the repo | A0 sweep 2 | No reproducible build, review or rollback |
| R6 | Raw data not normalised: Tally snapshots drop heads, mix bases, no ETL provenance or owner | D-013 | Silent wrong inputs |

## 2. Target model (A9 design principles)
1. **Three separate ledgers.**
   - Standard cost card per product and SKU: a versioned, approved policy.
   - Period actuals from Tally vouchers.
   - Absorption/variance ledger: standard × actual batches vs actual spend.
   - SKU price never absorbs a variance.
2. **Standard batch costing (D-014).**
   - Per product: normal batch (preferred size validated against BMR average and min/max refs) × route workload per batch × approved rate ÷ expected net output (yield).
   - The live `fn_simulate_preferred_batch_*` (STABLE) already implements this formula and should be promoted, not re-invented.
   - Intermittent, unsold or PTO products keep a determinable standard. They are excluded from the rate denominator unless they are produced.
3. **Rate denominators** = Finance-approved normal capacity (D-012). Candidates are workload units at about 140 completed batches/month or budgeted volume. Never use rounded batch counts.
4. **Expense basis** = a Finance-approved normal budget per head, with an effective-dated policy table.
   - The provision view becomes a comparison tool only: FY actuals, recent months, abnormal items flagged.
   - Signed values are kept. Gains reduce cost or are excluded.
   - Financing costs (interest) form their own layer below COP (D-011).
5. **Source integrity.**
   - The Tally ingest stores the period FROM/TO actually returned, and every head including zeros.
   - A validation step rejects basis changes (FYTD vs MTD), compared with the previous day.
   - The agent request templates go into version control.
   - Voucher-level ingest replaces closing-balance snapshots for expense heads.
6. **Immutable runs and period close.**
   - Run-reference lock table, guard triggers on all snapshot tables, refresh RPCs fail-closed on non-RUNNING runs.
   - Fingerprint monitor.
   - Period close is a separate, user-authorised step.
7. **Migration discipline.** Every live change goes via a repo file with a matching version. A CI check runs a live/repo hash diff.

## 3. Implementation work packages (independently releasable; order = financial risk first)
| WP | Scope | Depends on | Sign-off |
|---|---|---|---|
| AU-1 | Backfill 33 live migrations into the repo, byte-identical, plus CI drift check | none | dev review |
| AU-2 | Run-119 lock: reference-lock table, guard triggers on 15 unprotected snapshots, RPC fail-closed on SUCCESS runs, fingerprint check | AU-1 | user |
| AU-3 | Tally ingest hardening: period/basis validation, zero-row heads, template under version control, voucher ingest for expense heads | Tally owner, D-013 | Finance + IT |
| AU-4 | Normal-budget policy table and comparison pack (actuals, abnormal items, capacity), signed values, interest layer | AU-3 evidence, Fuel vouchers | **Finance** |
| AU-5 | Batch-true standard cost engine: promote the simulator, normal-capacity denominators, yield, intermittent/PTO rules, A3 evidence table as UAT | AU-4 rates, production validation of route intensity (A3-F6) | **Finance + Production** |
| AU-6 | Absorption/variance ledger from actual completed batches (FG transfer and BMR, after the BMR logging gap is fixed) | AU-5 | Finance |
| AU-7 | Price chain re-run (A7) on corrected COP for 509/440 with a new run; run 119 preserved | AU-5, Sheets access | user |

## 4. Gates still to execute against this design
- A2: master data and UOM cardinality.
- A6: full lifecycle, partly done in A0 sweep 2.
- A7: price chain, blocked on Sheets.
- A10: needs an isolated branch DB. Creating a Supabase branch has a cost, so the user must approve it first.
