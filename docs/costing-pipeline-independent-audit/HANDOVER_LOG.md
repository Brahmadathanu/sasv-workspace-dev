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
