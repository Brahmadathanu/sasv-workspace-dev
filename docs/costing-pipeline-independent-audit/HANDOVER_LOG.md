# Handover log
## 2026-10-15 17:30 IST — Grok sweep 1 (A0, A1, A3)
Branch `docs/costing-pipeline-independent-audit`; base main `71c30f1`. Read-only only: no live writes, migrations, refreshes, Sheet edits, merges.
Done: A0 matrix; A1 provision logic + POH head forensics; A3 batch mechanism + named cases. Queries in `queries/`.
Blocked: Google Sheet 509/440/69 (no access); PR #66 test execution (no isolated DB); Tally ETL code (not in repo/DB).
Next precise step: A1 sweep 2 — full per-head table for the other five pools and Fuel & Gas voucher check (needs Tally export), then A3 sweep 2 — actual completed-batch frequency from FG transfer/BMR data for the 125 ≥10× products.

## 2026-10-15 ~19:00 IST: Grok sweep 2
- User decisions D-010…D-014 and DIR-6/7/8 recorded verbatim.
- A0, A1 and A3 complete for audit scope. Architecture strategy drafted.
- Blocked:
  - Sheets: needs Viewer access via a Drive connection or link sharing, or CSV exports.
  - Isolated DB for A10/PR #66: Supabase branch creation has a cost, so user approval is needed.
  - Tally agent template and owner.
  - Fuel vouchers: request drafted in FINANCE_REQUEST_FUEL_GAS_VOUCHERS.md, not sent.
- Next: A2 master-data/UOM cardinality, then A6 full lifecycle, then A7 once Sheets access exists.

## 2026-10-15 ~19:45 IST: A2 + A6
- A2 and A6 are complete for the audit scope and folded into the strategy (AU-2b, AU-2c).
- Next: A8 (architecture inventory of the app) or A7 once Sheets access exists. A10 needs approval for an isolated DB.

## 2026-10-15 ~20:10 IST: A8 + A11 draft
- See A8_ARCHITECTURE_INVENTORY.md and A11_IMPLEMENTATION_PROGRAMME.md.
- Next: get Sheets access (A7) and approval for an isolated DB (A10); AU-1 can start as repo-only work if the user authorises it.

## 2026-10-15 ~18:10 IST: AU-1 (user-authorised)
- Branch `costing/au1-migration-backfill` from main `71c30f1`. Commit `fb0c6b4`. **DRAFT PR #67**; not merged and not applied to the DB.
- 33 live-only migrations (20261014104950…20261015021210) added, byte-identical to live `statements[0]`.
- Added `scripts/migration-drift-check.mjs` (read-only, uses a JSON export) and its README.
- Drift since 20261014104950: 33 matched exactly. 1 renamed (ppm, live 20261015045233 vs repo 20261015053000, same content). 0 missing, 0 extra.
- Not added (owned elsewhere): wp07 20261013095629 and 20261013155440 (Jarvis branch), WP05 S1 20261013183522 (PR #60).

## 2026-10-15 (evening IST): Grok: reproducibility, local DB, PR #67 re-verification, AU-2, AU-3
- **Reproducibility**: `scripts/audit/reproduce-findings/` reproduces **40/40** quoted figures (read-only).
- **Local test DB (free)**: PG17 rebuilt from live DDL fetched read-only (`scripts/audit/local-db/`). Parity: **4485/4504** definitions md5-identical. The 18 missing definitions depend on hr/lab/regulatory schemas; 1 view differs only in parenthesis deparsing; 1 extra sequence comes from 63-char name truncation. No paid branch was used.
- **PR #67 (AU-1)**: independent byte check **33/33** identical (`evidence/AU1_PR67_BYTE_VERIFICATION.md`).
- **AU-2/2b**: draft PR **#68**, `costing/au2-run-governance`. Covers the designation marker (who, when, why), append-only governance tables, per-run fingerprints, designated-run and terminal-run guards, refresh refusal for periods holding a designated run (single-use recorded supersession), current run selected by marker, and a governed period close. **37/37** A6 attack tests pass locally. Not applied live.
- **AU-3**: draft PR **#69**, `costing/au3-tally-period-interpretation`. Covers regime detection (FYTD vs reset window), per-head monthly normalisation with lineage, a user-confirmed window override, and a side-by-side corrected provision view. **21/21** synthetic tests pass. On real data (local only): 178/179 provisions are unchanged and 1 is corrected. Provisions are effectively frozen at the 31 Jul FYTD figures.
- **Awaiting the user**: merge or apply of #67, #68 and #69; designation of run 119 (REFERENCE or APPROVED); confirmation of the Tally window starts for 08-08, 09-04 and 10-06, or an ETL change to explicit FROM/TO.

## 2026-10-15 A7 complete (Grok)
A7_PRICE_CHAIN_RECONCILIATION.md + evidence/A7 + queries A7_01–03. 440 = 293 SAFE / 101 AT-RISK-high / 43 AT-RISK-low / 3 HOLD (+69 sheet hold). Sheet loaded cost untraceable to any run (A7-F1); 19 board MRPs missing from run 119 (A7-F2).

## 2026-10-15 (late evening IST): Grok: decisions D-017..D-020, #67 readiness, #68 risk, #69 contract, A7 follow-up, AU-2c, AU-3c
- **#67**: READY for merge authorisation (`evidence/AU1_PR67_MERGE_READINESS.md`). Never run `supabase db push` / `migration repair` / `migration up`.
- **#68**: LOW risk with two conditions: apply between runs (enforced by a preflight), and accept that REFERENCE on 119 makes 118 the Sep current run (527 SKUs, Rs 220.77 total, max Rs 46.65/SKU). Tests 52/52, rollback IDENTICAL, runbook `AU2_RISK_AND_APPLY_RUNBOOK.md`.
- **#69**: AU-3 21/21, **AU-3b 34/34**, JS classifier 15/15, real-data parity 178/179 unchanged. **Fixed a blocking bug**: the contract gate would have broken the service_role ETL even in mode OFF (it is now SECURITY DEFINER, with tests S1–S4). Open item: confirm SVFROMDATE/SVTODATE on a real raw Tally response.
- **AU-3c (on the #69 branch, draft only)**: revoke authenticated INSERT/UPDATE/DELETE on `tally_expenses_snapshot` and replace the ALL policy with a SELECT-only one. Caller proof: only service_role has written since 2026-08-11; 0 statements by authenticated/anon; 0 DB functions or repo clients write it. Local test passes and rollback is IDENTICAL.
- **A7 follow-up** (`A7F_PROVISIONAL_COST_AND_MRP_DATING.md`): the sheet's Provisional Loaded Cost reproduces the BASELINE batch model **509/509 (454/454) exactly** (max error Rs 0.0000). A7-F1 is withdrawn and restated as "reproducible but unapproved inputs". A7-F2 is reclassified: the board MRPs were entered on 2026-10-15 (10:26–11:25 IST), backdated, after run 119 started (14-Oct 17:20 IST), so this is effective-dating, not a defect. Register vs policy start-date mismatch for SKUs 381/647/955 (P3).
- **AU-2c**: draft PR **#70** `costing/au2c-master-data-proposals`. 859 BOM output 28,039→28.039 Kg (+Rs 5.19/pack, ≈+Rs 7.3k/month); 1277 waits on BMR evidence (≈+Rs 5.4k/month if ×1000); 879 factor 0.02→0.001 together with BOM output 320→16/32 Kg. Guarded SQL ends in ROLLBACK; local tests 12/12. Plus the AU-4 normal-budget preparation pack (per-head worksheet, decisions D-B1..D-B4).
- **Awaiting the user**: #67 merge; #68 apply window plus acceptance of 118 as current; the REFERENCE designation of 119; #69 deploy (OFF); AU-3c revoke; AU-2c evidence and approval; budget basis; Q-A7F-1..3.
