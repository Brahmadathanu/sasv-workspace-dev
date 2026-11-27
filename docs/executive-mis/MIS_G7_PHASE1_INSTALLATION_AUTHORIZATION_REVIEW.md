# MIS G7 phase-1 server preview — installation authorization checkpoint

**20 Nov 2026 (IST)** — OWNER REVIEW PACKAGE, **NO LIVE SQL APPLIED**.

## Current position
The owner conditionally accepted G6 economic methodology and authorized G7 DESIGN/OFFLINE ONLY. Do not interpret "go ahead" as approval for database mutations. The candidate phase-1 server change is one **additive** function only:
`public.get_mis_production_preview_v1(p_report_month date, p_as_of_date date DEFAULT NULL) RETURNS jsonb`.
Source SQL (authoritative): `docs/executive-mis/MIS_G7_PHASE1_RPC_MIGRATION_DRAFT.sql` on `docs/executive-mis-workflow-20261119`, **NOT executable against production without fresh owner authorization**.

## Business content and deliberate omissions

- Source rate = approved **preceding-month** cost run, not latest draft; for Nov report, Oct approved run 143. No rate if prior month lacks an approved run.
- Product bulk-reference rate = product RM + manufacturing direct labour + production overhead + product QC + internal conversion + RM share of stores allocation. PM share remains in packing; existing Costing policy unchanged.
- Plan = current **live indicative** product-base production quantity; not a frozen baseline.
- Actual = positive FG bulk storage movement entries, counted once per ledger event; excludes packaging, transfers, manually forced closing and non-bulk event kinds. Historical legacy correction/delete/In Storage entries trigger a conservative **correction-lineage HOLD**, not unreliable reconciled value.
- FG transfer = Tally book transfer value on same reporting cutoff, distinct accounting basis, exception count.
- Formal completion and plan achievement = **NULL / NOT COMPARABLE**, not invented.
- Missing approved rates/UOM mismatches are excluded from covered value and counted. **Covered value does not mean complete value.**

## Verified during design (read-only production metadata and local offline fixtures)

- Approved Oct run 143, 22 Oct valuation, Nov still without approved run.
- 627 approved SKU snapshots support manufacturing rate components, stores allocation and stores workload; keys unique for tested run. 453 nonnegative stores RM product rate entries with finite denominators; RM/PM attribution reconciles to approved stores total.
- November 79 positive FG bulk storage entries in inspected period; 74 Kg / 4 L / 1 Nos base units match products. 77/79 receipt rows map to approved October cost; 2 rows unvalued.
- Existing permission target is `executive-mis-dashboard`; exposed function's role authorization must evaluate user-specific canonical permissions. Direct authenticated SELECT on costing tables currently denied, and must remain denied.
- Candidate function signature absent on production (additive). Static source inspection 10/10 targeted safeguards present.
- Existing local fixture suite **12/12 PASS**; local synthetic 20-test suite **20/20 PASS**. Local 20-test file differs from exact committed repository 20-case source; therefore **exact committed 20-case execution NOT VERIFIED**. These tests exercise mocked decisions only, not SQL or live auth.

## Mandatory independent checks **before** claiming installation successful

1. Database SQL parser/compile acceptance of exact GitHub bytes, schema qualification, function owner, pg_catalog/pg_temp search path, return shape and date/currency types. Offline parser not available in this session; **NOT TESTED**.
2. Bounded production query plan for current month: positive index use on timestamp receipt bounds, reasonable costing snapshot and planning view scans, correct privilege surface, no repeated heavy production load. EXPLAIN **NOT TESTED**; perform only after approved read-only review authorization where required.
3. Within the authorized installation transaction: `REVOKE EXECUTE FROM PUBLIC/anon`, `GRANT EXECUTE TO authenticated`, after creation, before transaction COMMIT. Verify no other signature exists/overridden. Rollback on any failed installation check.
4. Independently authenticated **MIS View** session PASS, **signed-in no MIS View** DENY, and **anon** DENY. Auth identity must not be spoofed; no staff account creation or role weakening.
5. Aggregate parity Nov against approved run 143, 100 planned products, 79 observed receipts, 2 unvalued, RM stores scope and Tally transfer books. Time cutoff/rate run and correction hold labels verified. Avoid mixing cutoff observations from separate moments.
6. No direct grants on `costing.*`, no source writes, no existing MIS function/view replacement, no scheduling, no client changes. Nothing touches Costing release checkout, PWA worker, packaging, installer or Electron metadata.

## Possible risks

- A security-definer function **can bypass RLS**. The proposal has explicit `auth.uid()` plus canonical module permission and tightly bounded JSON aggregates, but this must pass real negative-access tests and reviewed function ownership before publication.
- Date-local accounting semantics: physical receipt `timestamptz` bounded in Asia/Kolkata; Tally transfer `date` bounded to same day. Existing historical corrections are **not** reconstructed by the preview.
- The callable version performs current-source scans; performance must be measured. Heavy cost should trigger design revision rather than indiscriminate index creation.
- A preview on a different report month needs prior-month approved run; no silent older fallback.
- This additive preview is **not full G7 closure**: immutable plan snapshots, canonical completion and future route logger adapters still need later controlled work.

## Rollback (future authorization only)

Because the phase-1 proposal creates only a new function, rollback is limited to:
`BEGIN; REVOKE ALL ON FUNCTION public.get_mis_production_preview_v1(date,date) FROM PUBLIC, anon, authenticated; DROP FUNCTION IF EXISTS public.get_mis_production_preview_v1(date,date); COMMIT;`
Confirm no other dependent client/objects before rollback. No changes to source records or other MIS modules.

## Exact proposed owner approval — OPTIONAL, NOT ASSUMED

"I authorize a narrowly bounded G7 phase-1 database installation on Supabase project qhmoqtxpeasamtlxaoak of only the independently reviewed additive function `public.get_mis_production_preview_v1(date,date)` from `docs/executive-mis/MIS_G7_PHASE1_RPC_MIGRATION_DRAFT.sql`, subject to successful preflight, strict grants, rollback, performance and authenticated access checks. This does not authorize MIS client work, merging, deployments, Costing Suite changes or release."

**If no approval:** remain DESIGN ONLY; do not install. After authorized server installation and successful independent SERVER ACCEPTED receipt, hand off `docs/executive-mis/MIS_CLAUDE_BULK_CLIENT_HANDOFF_AFTER_G7_SERVER_ACCEPTANCE.md` to Claude as one package; not before.
