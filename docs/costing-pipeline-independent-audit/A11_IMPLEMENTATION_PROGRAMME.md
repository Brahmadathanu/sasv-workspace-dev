# A11: findings register and implementation programme (DRAFT, partial)
Status, 2026-10-15 ~20:10 IST:
- Partial. **A7 (price chain vs 509/440) and A10 (isolated test qualification) are PENDING**, so final ranking, cut-over and UAT sections are provisional.
- No approvals are recorded except the user's D-010…D-014 policy directions.

## 1. Ranked defect register (P1 first; detail in gate docs)
| Rank | ID | Finding | Money impact (verified or analytical) | WP |
|---|---|---|---|---|
| 1 | A3-F1/F5 | Whole-batch-per-month workload | ₹8.20 lakh/month on 125 low-volume products. Mainstream 335 understated by about ₹7.46 lakh/month (+83% vs batch-true). | AU-5/6 |
| 2 | A1-F1…F4 | Max-of-max provision on a source that switched FYTD→MTD | POH ₹9.75 lakh vs ₹6.30 lakh FY average; all pools +₹4.46 lakh/month vs FY25-26 average | AU-3/4 |
| 3 | A0-F2 / A6-F1/F2/F6 | Run 119 can be superseded or mutated; "current" = newest; everything draft | Reference integrity of all prices | AU-2/2b |
| 4 | DIR-7 | Fuel & Gas ₹4.80 lakh/month from Q1 purchase timing | Fuel stock register shows about ₹2.1–4.7 lakh/month consumption | AU-4 (Finance) |
| 5 | A2-F1/F2 | Mehasamani factor 20× off; 2 SKUs with RM below ₹2/Kg | SKU-level; magnitude UNVERIFIED | AU-2c |
| 6 | D-011 | Discounts (₹2.40 lakh) as an expense; Forex gain treated as cost; insurance in the marketing pool | Loaded cost and price | AU-4 |
| 7 | A0 DIR-8 | 33 live migrations not in the repo | No rebuild or rollback | AU-1 |
| 8 | A2-F3/F5 | Blanket 0.91 density (246 SKUs); 554 SKUs on stale rates | ±RM % | AU-2c |
| 9 | A3-F6 | Extreme route workload on multi-avarthi thailams | ₹1.85–4.48 lakh per batch | AU-5 (Production) |
| 10 | A8-F1/F2 | Approval surface and run context spread across the client | Governance | AU-8 |
| 11 | A0-F3 | POH conservation gap of ₹1,181.76 | Small | AU-5 |

## 2. Work packages (independently releasable; each needs user go-ahead and A10 testing)
| WP | Content | Prerequisite | Approver | Status |
|---|---|---|---|---|
| AU-1 | Backfill the 33 migrations byte-identically and add a CI drift check | none | dev review | READY TO START (repo-only) |
| AU-2 | Run-119 lock: guard triggers on 15 tables, RPC fail-closed, fingerprint monitor | AU-1, isolated DB | user | BLOCKED on A10 environment |
| AU-2b | Run designation (REFERENCE/APPROVED), current-view rewrite, period-request guard | AU-2 | user | BLOCKED on A10 |
| AU-2c | Master-data corrections (P696, P678, P1038), SKU-level factors, density table, rate-age policy | Production/QA evidence | Production + Finance | WAITING ON EVIDENCE |
| AU-3 | Tally ingest hardening: basis validation, zero heads, template in git, voucher ingest | Tally template and owner (D-013) | Finance + IT | WAITING ON EVIDENCE |
| AU-4 | Normal-budget policy per head, signed values, interest layer, Discounts/Forex/insurance classification | Fuel vouchers, Finance budget (D-012) | **Finance** | WAITING ON FINANCE |
| AU-5 | Batch-true standard engine (promote the simulator), normal-capacity denominators, intermittent/PTO rules | AU-4 rates, A3-F6 validation | **Finance + Production** | DESIGNED |
| AU-6 | Absorption and variance ledger from actual batches (fix the BMR logging gap first) | AU-5 | Finance | DESIGNED |
| AU-7 | New governed run plus price chain recomputation for 509/440; run 119 preserved | AU-5, **A7** | user | PENDING A7 |
| AU-8 | Client: run-context service, role workspaces, approver-only actions, server-only pricing maths | AU-2b | user | DESIGNED |

**Suggested order:**
1. AU-1.
2. AU-2 and AU-2b, in parallel with the evidence chase for AU-3, AU-4 and AU-2c.
3. AU-5, then AU-6.
4. AU-7.
5. AU-8, alongside the others.

## 3. Pending before this programme is final
- **A7:** recompute the price chain (COP → loaded → marketing → GST → 40% → 5+1 → contingency → 7% → ₹5) for 509/440/69. Needs Sheets access (A0 DIR-6 access spec).
- **A10:** golden fixtures and the A6 adversarial tests on an isolated Supabase branch. This needs user approval for the branch cost.
- **Finance:** normal budget, Fuel vouchers (draft request ready, unsent), interest/exceptional classification sign-off.
- **Production:** route intensity, batch sizes and densities; BMR logging gap (Aug-26 has only 11 BMRs).
- **IT:** Tally agent template and owner.
- **Cut-over, monitoring and rollback plans** per WP: to be written after A10.
