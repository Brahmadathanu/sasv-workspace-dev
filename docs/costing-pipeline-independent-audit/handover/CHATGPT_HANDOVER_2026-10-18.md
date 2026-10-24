# Independent-auditor handover (for ChatGPT): 16 Oct 07:31 IST to 18 Oct 14:30 IST, 2026

Prepared by Aryabhatta (costing executor) for Dr. Brahmadathan U, 18 Oct 2026. You do not need any chat context to read this. All times are IST.
Repo: `Brahmadathanu/sasv-workspace-dev`, branch `costing/au4-normal-budget` (draft PR #72, **not merged**). Paths below are relative to `docs/costing-pipeline-independent-audit/` unless they start with `docs/`.
Live DB: Supabase project `qhmoqtxpeasamtlxaoak`. I re-checked the facts below with read-only queries on 18 Oct at 14:25.

**Status labels used here**
- **APPROVED**: the user decided it, and it is live where stated.
- **APPROVED, NOT BUILT**: the decision is made but no code exists yet.
- **PROVISIONAL**: live but a judgement value that the user still has to confirm.
- **OPEN**: no decision yet.
- **SUPERSEDED**: replaced and no longer valid.

## 0. Cut-off
- The repo has **no file explicitly named as a ChatGPT handover**.
- The last item that came from the auditor or directive side is `DIRECTIVE_2026-10-16.md`: the consolidated continuation directive of 16 Oct 07:31, recorded "as relayed". Its 07:46 clarification is in `DIRECTIVE_2026-10-16b.md`.
- The record before that is the 15 Oct evening user decisions D-017 to D-024, "recorded with ChatGPT/Grok as assistants", plus the live deployment of 15 Oct 22:35.
- **Cut-off used: 16 Oct 2026 07:31 IST.** Everything after it is covered below. If your last conveyance was later, skip the sections before it.
- Governance (GOV-015): the user is the sole decision authority. ChatGPT and Grok assistants are analysts, not approvers. ChatGPT owns the Google Sheets. The executor never edits Sheets.

## 1. Where things stand (18 Oct 14:30)
| Item | State |
|---|---|
| September 2026 | Period LOCKED, valuation 10 Sep LOCKED (ref USER-LOCK-SEP2026-20261016). **Run 122 APPROVED**; run 119 REFERENCE |
| October 2026 | Period LOCKED, valuation **16 Oct LOCKED** (ref USER-APPROVAL-20261018-OCT-LOCK-OPTION-A). **Run 128 APPROVED** 14:18 |
| Runs 124–127 (Oct) | SUCCESS, never designated (superseded by 128) |
| Current-run view | Sep → 122, Oct → 128, both selection_basis APPROVED |
| Cron | Job 60 (daily request) and job 61 (stage processor) both **paused**. Job 61 is enabled only for an approved run window |
| Run 122 integrity | Fingerprint over the 56 run tables is unchanged since 16 Oct (md5 ccb9c707…, 353,819 rows, run row 547983c7). Checked before and after every live change |
| Periods closed? | Neither period is CLOSED/FINAL. `rpc_close_cost_period` has not been used |

## 2. User decisions since the cut-off (dated)
| When (IST) | Decision | Status |
|---|---|---|
| 16 Oct 07:46 | Clarification directive: cron pause runbook, period-lifecycle design, AU-4 normal budget per head, carriage inward, standard-batch fallback (draft only) | done as drafts |
| 16 Oct 08:50 | Classify 7 unclassified staff (finance-admin and packing labour) | APPROVED, live |
| 16 Oct 09:30–10:35 | Cost-head policy ledger (52 heads); Fuel & Gas normal ₹1,61,969/mo; tier-2 standard batch from production_batch_size_ref; central-office method kept; PF/ESI via the roster | APPROVED (the ledger is mostly PROVISIONAL values) |
| 16 Oct 11:53 | AU-2c master-data fixes: BOMs 678, 1038, 696 and conversion factors | APPROVED, live |
| 16 Oct 12:34 | Ledger engine link (migration 20261016070413) | APPROVED, live |
| 16 Oct 14:53 | Registration Charges 0 → ₹2,400; ledger switch ON | APPROVED, live |
| 16 Oct 17:25 / 18:55 | SKU 1797: PM BOM revision 684, MRP ₹200, selling terms. Manufacturing labour normal rate ₹128.02 for Sep. Review rows non-blocking. Acceptance pass rule amended | APPROVED, live |
| 16 Oct 20:05 | Check 25 signed off. September locked by a guarded one-off SQL. Run 122 APPROVED. 33 negative-margin SKUs to pricing review | APPROVED, live |
| 16 Oct ~20:30 | **AU-5 batch-true conversion cost** from 1 Oct, with re-based labour and POH rate rows (ref USER-APPROVAL-AU5-REBASED-20261016). October period opened | APPROVED, live |
| 16 Oct ~23:00 | **AU-5 insert-path fix**: batch-true workload is written at insert time, with no UPDATE of immutable snapshots | APPROVED, live |
| 17 Oct 07:20–15:58 | October rate quality: carry rules R1/R2 (645 items). 175 rule defaults. **Band C rates are true rates as entered**: Chayilyam ₹32,000/kg, Mathalam ₹240, Rasam ₹35,000 (known future purchase rates); Gorochanam ₹16.79 L/kg (true past purchase); Kuzhiyaana ₹30 with BOM qty 59 Nos confirmed. 10 band C new items, 4 user-confirmed items and 2 BOM-confirmed items (SRM002, Nandukkal). R3 auto-refresh from Tally withdrawn (Tally can lag real prices) | APPROVED, live (841 acceptances) |
| 17 Oct 18:45 | **C1 inactivation** of 5 single-pack SKUs with no sales: 1617, 1538, 1481, 1401, 1705 | APPROVED, live |
| 18 Oct 05:26 | **AU-6 bundle**: default-volume v2 hierarchy; Abhraka Bhasmam batch 50 kg plus a 0.33 kg/month plan; **recurring HO admin ₹5,00,000/month** (separate from Central Office Charges); 59 qty-driver and 204 regional acceptances. **CF-1 carry-forward and the 6-month manual-rate review approved from 1 Nov** | APPROVED, live (CF-1: APPROVED, NOT BUILT) |
| 18 Oct 08:34 | Route scaling Option A (symmetric power exponent); kit K1+K4; Kanji 878 batch confirmed at 50,000 packs | exponent **SUPERSEDED 09:06**; kit/Kanji APPROVED |
| 18 Oct 09:06 | **Power-exponent scaling (AU-6A) rejected**; replaced by the equipment-loads method (AU-6L) | the AU-6A exponent is SUPERSEDED |
| 18 Oct 09:22 | Build combined v2: QC per batch, kit/Kanji unit fix, equipment-loads with provisional capacities, costing-only sales feed, seasonal rule | APPROVED (local build) |
| 18 Oct 10:13 | Install combined v2 live; make Kvatha products 468/1340 (SKUs 1769/1770) inactive; rerun October | APPROVED, live |
| 18 Oct 12:57 | Read-only re-check of lapsed acceptances against run 127, with a materiality rule | done |
| 18 Oct 13:08 | Re-accept only the **155 safe regional rows plus 2 safe defaults** (SKUs 251, 1149). Do NOT accept the 45 material rows, SKU 1771 or the Kvatha rows | APPROVED, live |
| 18 Oct 13:12 | Rerun October (run 128); do not approve | done |
| 18 Oct 14:14 | "Finalise valuation, approve 128, lock October using sanctioned functions only." The executor STOPPED because no lock function exists | stopped, nothing changed |
| 18 Oct 14:17 | **Option A**: lock October with a one-off guarded SQL like September, then approve run 128 with notes. Option C (proper lock/reopen functions) for November onward | APPROVED, live; option C APPROVED, NOT BUILT |

## 3. Live changes (all through Supabase MCP; never `db push`)
### 3.1 Migrations since the cut-off
| Version | Name | Effect |
|---|---|---|
| 20261016070413 | au4_cost_head_policy_ledger_engine_link | The 52-head ledger feeds pool provisions (switch ON since 14:53) |
| 20261016150830 | au5_batch_true_install_switch_off | Batch-true switch, variance tables, hook |
| 20261016150908 | au5_rebased_rates_switch_on_effective_oct2026 | Labour v3 / POH v2 rate rows APPROVED from 1 Oct; switch ON from 1 Oct |
| 20261016170817 | au5_insert_path_batch_true | POH and labour writers use route factor × unrounded qty ÷ batch_size_ref at insert (no UPDATEs; immutable triggers kept) |
| 20261017235758 | au6_default_volume_v2 | Default-volume hierarchy v2, plan table, 2% cap, cap log |
| 20261018000020 | au6_recurring_cost_pool_provision | Effective-dated recurring provisions (HO admin ₹5 L/mo from 1 Oct, review 31 Mar 2027) |
| 20261018044644 | au6_combined_v2 | QC per batch; kit 865 / Kanji 878 unit fix; equipment-loads workload with 16 capacity rows (13 provisional); costing-only sales feed with the seasonal rule. Every part has its own switch from 1 Oct; September gates closed |

### 3.2 Data changes (governed RPCs, acting as the user, guarded by exact counts)
| Change | Reference / audit ids |
|---|---|
| 7 staff classifications | remarks AU4-7STAFF-20261016 |
| AU-2c BOM and factor fixes (678, 1038, 696) | PR #70 `AU2C_APPLIED_2026-10-16.md` |
| SKU 1797: template 2, label 2796 at ₹0.64, PM revision 684; MRP policy 1829 ₹200; selling policy 1322 | 16 Oct 17:25 / 18:55 |
| Manufacturing labour rate policy v2 ₹128.02 (Sep) | AU4_LABOUR_NORMAL_RATE_RUN121 |
| September lock | USER-LOCK-SEP2026-20261016; audit PERIOD_LOCKED; designation 2 (run 122) |
| October period created | rpc_ensure_cost_period; audit 11 |
| October material-rate acceptances: 841 ACTIVE (645 R1/R2 + 175 defaults + 5 band C true rates + 10 + 4 + 2) | `proposals/rate_quality_oct/APPLIED_*.sql` |
| C1 inactivation of 5 SKUs | USER-DECISION-20261017-C1-INACTIVATE; SKU audit 46–50 |
| Default policies 1/2 closed 30 Sep; v2 ids 6/7 from 1 Oct | migration 20261017235758 |
| Abhraka Bhasmam batch ref 501 (100 kg) → 554 (50 kg) from 1 Oct; plan id 1 at 0.33 kg/mo to 30 Sep 2027 | USER-APPROVAL-AU6-ABHRAKA-BATCH50-20261018 / -PLAN-20261018 |
| HO admin recurring provision id 1, ₹5,00,000/mo ADMIN_OVERHEAD | USER-APPROVAL-AU6-HO-ADMIN-20261018 |
| Qty-driver acceptances: 59 (ids 72–130) + 2 (131, 132) = **61** | 18 Oct 05:26 / 13:11 |
| Regional marketing acceptances: 204 (ids 369–572) + 155 (573–727) = **359** | USER-APPROVAL-20261018-RUN127-SAFE-REACCEPT |
| Kvatha: SKUs 1769/1770 inactive (SKU audit 51, 52); products 468/1340 inactive (product audit 14, 15) | USER-DECISION-20261018-KVATHA-INACTIVATE |
| October lock: OPEN/DRAFT → LOCKED/LOCKED at 14:18:51; audit 13 PERIOD_LOCKED | USER-APPROVAL-20261018-OCT-LOCK-OPTION-A |
| Run 128 APPROVED: designation 4, fingerprint 11, by the user's uid. The reason records the 4 notes in §6 | same ref |

## 4. Runs and results
| Run | Period | Requested | Status | Blocked / review / ready | Neg-margin SKUs | Note |
|---|---|---|---|---|---|---|
| 120 | Sep | 16 Oct 15:15 | FAILED | – | – | SKU 1797 had no PM BOM |
| 121 | Sep | 16 Oct 17:22 | SUCCESS | 1 / 145 / – | 74 | |
| 122 | Sep | 16 Oct 19:19 | SUCCESS | 0 / 146 / 488 | 74 (33 to pricing) | **APPROVED** |
| 123 | Oct | 16 Oct 21:10 | FAILED | – | – | stage 03 hit the immutable-snapshot trigger, fixed by the insert-path migration |
| 124 | Oct | 16 Oct 22:38 | SUCCESS | 0 / 621 / 13 | 35 | first batch-true run; material acceptances had lapsed |
| 125 | Oct | 17 Oct 16:10 | SUCCESS | 0 / 189 / 445 | 35 | after the 841 rate acceptances |
| 126 | Oct | 18 Oct 05:30 | SUCCESS | 0 / 184 / 445 | 37 | AU-6 bundle (default v2, Abhraka, HO ₹5 L) |
| 127 | Oct | 18 Oct 10:18 | SUCCESS | 0 / 137 / 490 | 9 | combined v2 plus Kvatha inactive |
| 128 | Oct | 18 Oct 13:13 | SUCCESS | **0 / 37 / 590** | **9** | after the 155+2 re-acceptances; costs identical to 127; **APPROVED** |

### Pools (₹/month, all fully absorbed in run 128; variance ≈ 0)
| Pool | Run 122 (Sep) | Run 128 (Oct) |
|---|---|---|
| Direct labour (manufacturing 7,06,203 + packing 6,63,449) | 13,69,652 | 13,69,652 |
| Production overhead | 6,70,935.04 | 6,70,935.04 |
| QC | 1,42,241.67 | 1,42,241.67 |
| Materials/stores | 2,60,508.53 | 2,60,508.53 |
| Admin | 11,71,359.78 | **16,71,359.78** (+₹5 L HO) |
| Finance admin | 2,05,450.46 | 2,05,450.46 |
| Marketing | 29,64,501.01 | 29,64,501.01 |
| **Total** | **67,84,648** | **72,84,648** |

### Key SKUs: manufacturing cost per unit (₹, read from the live snapshots)
| SKU | Run 122 (Sep) | Run 128 (Oct) | Main reason |
|---|---|---|---|
| 879 Mehasamani 20 g | 113.37 | 7.47 | batch-true conversion plus equipment loads |
| 988 Thampira Chendooram 5 g | 3,886.71 | 23.85 | batch overload removed |
| 1792 Abhraka Bhasmam 1 kg | 10,525.57 | 5,532.41 | batch-true, batch 50 kg, plan 0.33 kg, QC per batch, loads |
| 865 Kashaya Vasthi Kit | 839.91 | 57.20 | kit unit fix (1 kit, not 275 g) |
| 878 Karkkidaka Kanji 500 g | 98.28 | 95.65 | Kanji unit fix plus seasonal average |
| 1797 Special Medicine 2 5 g | 23.03 | 22.34 | |
| 876 Dahasanthi 20 g | 5.29 | 5.40 | |
| 637 Dhanwantharam Gulika 100 | 21.79 | 20.61 | |
| 111 Rasnadi 50 g | 28.63 | 29.67 | |
| 1769 / 1770 Kvatha 200 g | costed | inactive | |

October rates per batch-true unit (run 127/128): labour 182.87, POH 160.84, QC 127.16.

## 5. Policies now in force (details in `POLICY_REGISTER.md`)
| Policy | Status |
|---|---|
| AU-5 batch-true conversion cost (insert path) from 1 Oct | APPROVED, live |
| Default-volume v2: actual max month → governed manual assumption → new-product plan → smart default (new product: min(10 packs, 1 batch/yr); new SKU: min(10 packs, 10% of product)), capped at 2% of the pool; >12 months on default → BLOCKED | APPROVED, live |
| Recurring HO admin ₹5 L/month (separate from Central Office Charges), review 31 Mar 2027 | APPROVED, live |
| Abhraka Bhasmam batch 50 kg plus 0.33 kg/month plan | APPROVED, live |
| Rate quality: acceptances per period/valuation; band C never auto-carried; the 5 band C true rates as entered; no Tally auto-refresh | APPROVED, live |
| QC per batch (AU-6Q) | APPROVED, live |
| Kit 865 / Kanji 878 unit fix (K1+K4) | APPROVED, live |
| Equipment-loads scaling (AU-6L) | APPROVED method, live; **capacities PROVISIONAL** |
| Costing-only sales feed: company-wide net, negatives to 0, no godown filter | APPROVED, live |
| Seasonal rule: best (max) month for steady SKUs; 12-month average when the top 3 months are ≥ 60% of the year (101 SKUs) | APPROVED rule; **60% threshold PROVISIONAL** (executor's choice) |
| Inactivations: C1 (5 SKUs), Kvatha (2 SKUs + 2 products) | APPROVED, live |
| Review rows non-blocking; negative margins go to pricing review | APPROVED |
| CF-1 monthly carry-forward plus 6-month manual-rate review from 1 Nov | APPROVED, NOT BUILT |
| Lock/reopen functions (option C) for November onward | APPROVED direction, NOT BUILT |
| Power-exponent route scaling (AU-6A, Options A/B) | **SUPERSEDED** 18 Oct 09:06 |
| Tally auto-refresh of band C rates (R3) | **WITHDRAWN** 17 Oct |

## 6. Run 128 approval notes (recorded in the designation reason)
1. Capacities are provisional (equipment-loads config `route_equipment_load_capacity`, 13 of 16 rows provisional).
2. The 60% seasonal cut-off was chosen by Aryabhatta, not by the user.
3. 37 open reviews are accepted as known exceptions (non-blocking):
   - 2 prime-cost: 1771/1772 Brihat Chagaladi.
   - 35 pricing-bridge (material regional-marketing rows): 18 one-month sellers, 4 with marketing cost per unit up >10%, 13 with large unit moves. Margin effect is ≤ 0.2% of price.
4. 9 negative-margin SKUs go to pricing review: 42, 43 (Dhanyamlam), 159, 193, 975 (Linga Chendooram), 1174, 1264, 1365, 1552.

## 7. Evidence index
| Topic | File |
|---|---|
| Sep lock and approval, AU-5 install, run log 16 Oct | `AU4_HANDOVER_LOG.md`, `evidence/AU5/AU5_LIVE_INSTALL_2026-10-16.md` |
| Run 123 failure, insert-path fix, run 124 | `evidence/AU5/AU5_INSERT_PATH_FIX_RUN124.md` |
| AU-7 price proposal from run 122 (634 SKUs) | `AU7_PRICE_PROPOSAL_RUN122.md`, `evidence/AU7/` |
| October rate quality (841) | `proposals/rate_quality_oct/OCT_RATE_QUALITY_DECISION_PACK.md`, `APPLIED_*.sql`, `evidence/AU5/OCT_band_C_rate_decisions.csv` |
| Run 125 and qty-driver review | `evidence/AU5/OCT_RUN125_RERUN_2026-10-17.md`, `OCT_RUN125_QTY_DRIVER_REVIEW.md` |
| Default-volume hierarchy, C1 | `evidence/AU5/OCT_DEFAULT_VOLUME_HIERARCHY_AND_C1_INACTIVATION.md` |
| Abhraka plus HO admin | `evidence/AU5/AU6_ABHRAKA_BATCH50_AND_HO_ADMIN_2026-10-18.md` |
| AU-6 apply, run 126, run 122 fingerprint method | `evidence/AU6/AU6_APPLY_AND_OCT_RUN126_2026-10-18.md`, `evidence/AU6/run122_fingerprint.sql` |
| QC per batch / small batch and kit RCA / superseded exponent build | `evidence/AU6Q/`, `evidence/AU6S/`, `evidence/AU6A/` (exponent part superseded) |
| Equipment loads and sales gap; combined v2 build | `evidence/AU6L/AU6L_LOADS_METHOD_AND_SALES_GAP_2026-10-18.md`, `AU6L_COMBINED_V2_BUILD_AND_REPLAY_2026-10-18.md` |
| Combined v2 live apply, Kvatha, run 127 | `evidence/AU6L/AU6L_LIVE_APPLY_AND_OCT_RERUN_2026-10-18.md`, `evidence/AU6L/live/APPLIED_au6_combined_v2_20261018044644.sql` (+ diff) |
| Acceptance re-check and 155+2 re-accept | `evidence/AU6L/AU6L_ACCEPTANCE_RECHECK_RUN127_2026-10-18.md`, `AU6L_RUN127_SAFE_REACCEPT_2026-10-18.md`, `live/*.csv`, `live/reaccept_run127_safe.sql` |
| Run 128 | `evidence/AU6L/AU6L_OCT_RUN128_2026-10-18.md` |
| Close stopped (options A/B/C); lock and approval | `evidence/AU6L/AU6L_OCT_CLOSE_STOPPED_2026-10-18.md`, `AU6L_OCT_LOCK_AND_APPROVAL_2026-10-18.md`, `live/OCT2026_LOCK_AND_APPROVE_RUN128_APPLIED.sql` |
| Policies, decisions, backlog | `POLICY_REGISTER.md`, `POLICY_MONTHLY_CARRY_FORWARD_CF1.md`, `DECISIONS_AND_OPEN_QUESTIONS.md`, `docs/master-data-costing/PARKED_BACKLOG.md`, `CHANGELOG.md` |

## 8. Open items, and what to verify independently
### 8.1 Open items (owner: the user)
| # | Item | Type |
|---|---|---|
| 1 | Confirm the provisional equipment capacities (grinder/sieve/dryers/manual lot/tablet 50 kg; planetary mixer 200 kg; puta 25 kg; vessel 220 kg/500 L; cooker 370 kg/500 L; fermentation tank 3,000 L) | PROVISIONAL |
| 2 | Confirm or change the 60% seasonal threshold; check that one-month sellers (18–19 SKUs) should really get the 12-month average | PROVISIONAL |
| 3 | 37 known exceptions (§6) | accepted for Oct; revisit in Nov |
| 4 | 9 negative-margin SKUs | pricing review |
| 5 | The regional-marketing basis function still uses 275/500 units for kit 865 / Kanji 878 (costing side is fixed) | OPEN (minor) |
| 6 | The marketing-side 10-unit default: costing now uses the v2 smart default, but regional marketing still uses a flat 10 units | OPEN, undecided |
| 7 | Inactive SKU 1790 (Kanji 1000 g): FG transfer of 108 Pkt is valued as 108,000 Nos. Same unit pattern as 878 | OPEN (data fix before any reactivation) |
| 8 | Preview/explain functions (`fn_preview_production_overhead_workload`, `fn_preview_direct_labour_shadow_workload`, `rpc_get_route_workload_management_explain_core`) still show unscaled factors. Run snapshots are correct | OPEN (display only) |
| 9 | Build CF-1 plus the manual-rate review before the November run (AU8-P01) | APPROVED, NOT BUILT |
| 10 | Build `rpc_lock_cost_period` / `rpc_reopen_cost_period` (option C) before the November close | APPROVED direction, NOT BUILT; build and apply need approval |
| 11 | AU-8 UI: CF-1 panel, recurring-provision register, RM BOM header save fix, regional-marketing acceptance surface (UX-P01) | APPROVED designs, NOT BUILT |
| 12 | Cost-head ledger: 40 PROVISIONAL and 5 UNRESOLVED heads; PF/ESI employer contribution not in the roster; POH fixed/variable split provisional | OPEN |

### 8.2 Suggested independent checks for ChatGPT
1. **Run 122 unchanged**: re-run `evidence/AU6/run122_fingerprint.sql`. Expect md5 ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows, run row 547983c7554dd1716042da362d49c331.
2. **Run 128 absorption**: the sum of per-SKU allocations × units equals each pool in §4 (labour, POH, QC, admin incl. ₹5 L, finance admin).
3. **Governance**:
   - October audit row 13 matches the before and after state.
   - Designation 4 has the user's uid, and `fn_verify_run_fingerprint(128)` shows 0 drift.
   - Runs 124–127 are undesignated.
   - Cron 60/61 inactive.
4. **Option A legitimacy**: compare `evidence/AU6L/live/OCT2026_LOCK_AND_APPROVE_RUN128_APPLIED.sql` with `proposals/SEP2026_VALUATION_LOCK_PROPOSED.sql`. Confirm the guards (exact row, prior state, no run in flight, run SUCCESS at the valuation date).
5. **Rate quality**: spot-check the 5 band C true rates against purchase evidence, and the 841 acceptance fingerprints against run 124 evidence.
6. **Seasonal rule**: re-derive the 101 seasonal SKUs from `costing.fn_costing_sales_monthly_as_of` (top 3 months ≥ 60%). Look at how sensitive the result is to 50% and 70% thresholds.
7. **Equipment loads**: recompute 3 products by hand (e.g. Mehasamani, Abhraka, Dhanwantharam Gulika): ceil(charge ÷ capacity) per weight-driven step, fixed steps 1 per batch.
8. **HO admin**: confirm that the ₹5 L does not double count Central Office Charges (₹8.72 L/mo in the ledger). The user says they are separate. Ask for evidence.
9. **Default-volume v2**: the default share of workload is ≤ 2% (run 126: 0.9%), with no SKU on default for > 12 months.
10. **Migrations**: the live versions in §3.1 match the repo files. The prepared packages stay outside `supabase/migrations`; the applied copies are in `evidence/AU6L/live/` and `evidence/AU6/`.

## 9. Pending Sheets outputs (ChatGPT owns Sheets; the executor made no Sheet edits)
| Output | What needs updating for October run 128 |
|---|---|
| Price-revision proposal (spreadsheet `1HBte4Y4WFPGWark1jnQvNv_5spMuBA-6Om2KdNltXVM`, tabs `price-revision-proposal` / `-filtered`) | The last server-side proposal is AU-7 v1 from **run 122** (634 SKUs, `evidence/AU7/`). For October, regenerate from **run 128** (627 active SKUs; valuation 16 Oct LOCKED; run APPROVED). Use the same rule: min MRP = OK commercial cost ÷ (0.5·(1−contingency)/(1+GST) − 0.07); proposed = ceil5(max(current, min)). Carry run id, valuation date, status and rate lineage per row. The executor can produce the CSV/XLSX read-only on request |
| Removed SKUs | Mark 1617, 1538, 1481, 1401, 1705 (C1) and 1769, 1770 (Kvatha) inactive or removed |
| HOLD_AU5 list (173 in AU-7 v1) | Most holds came from the batch overload that AU-5/AU-6 fixed (e.g. Thampira 3,886.71 → 23.85; Mehasamani 113.37 → 7.47). Re-classify them from run 128 |
| Negative-margin / pricing review | Replace the 33 (Sep) with the **9** (Oct) list in §6 |
| Known-exceptions tab (if kept) | 37 open reviews (§6) |
| Pool / overhead summary (if kept) | Admin pool +₹5 L HO (₹16.71 L); total ₹72.85 L/month; labour/POH/QC rates per batch-true unit 182.87 / 160.84 / 127.16 |

Nothing in this handover authorises a Sheet edit, a price change, a merge or a deploy. Each needs its own explicit user approval.
