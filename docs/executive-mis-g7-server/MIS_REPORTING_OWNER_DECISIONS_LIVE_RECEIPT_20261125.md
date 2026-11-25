# Executive MIS — owner decisions and live reporting acceptance receipt

Date: 2026-11-25 IST. Candidate reviewed: e2fc15ab10db33e7868656c98df0c2f2ebdd452d, draft PR #526. Main package version 6.5.0; PR mergeable at last check, not merged. Recommended reporting release 6.6.0 subject to final stable-version check.

## Owner decisions — approved
D1 Temporarily disable Batch Governance navigation, preserving registry and permissions.
D2 Continue management alerts as reporting-only MIS functionality.
D3 Retain frozen production planning as an independent MIS requirement.
D4 Defer verified completed-production value until canonical Production Work Log supplies reliable completion evidence.
D5 Route improvements through existing Production Route Manager and Production Work Log.
No ENFORCE or operational assignments. These decisions are approved, not a claim that D2/D3 implementation or formal G7/G8 acceptance is finished.

## D1 production receipt
Exact approved proposal blob 074bdc52a194d3d94c9ecda32b20b11764fd038b, docs/executive-mis-g7-server/REGISTRY_BATCH_GOVERNANCE_DORMANCY_PROPOSAL_NOT_APPLIED.sql at reviewed head. Applied its transaction once after precheck: one visible module, two enabled client navigation rows, zero assignments, AUDIT. Postcheck: one active/assignable module hidden, two navigation routes disabled, six MIS targets retained, zero operational assignments, AUDIT, CORE_MIGRATION_NOT_ACCEPTED. Navigation flags only; no deletes, permission grants, new migration or history rewrite. Do not replay. Registry is dormant pending independent PWL cutover.

## Live reporting acceptance evidence
Read-only reconciliation window 2026-10-26 through 2026-11-24:
Independent SQL and actual deployed evidence RPC both return 121 distinct product-batches, 173 packing lines, 41 lines without negative depletion evidence. RPC states overlap: NOT_VERIFIED 121, UNSIGNED 28, MISSING_ROUTE 78, MISSING_RECEIPT 28; 255 findings. Historical reference 29 lines is not this window's live count. All positive FG receipt logs: 1671 OK, 9 NO_SOURCE_LEDGER, 1680 total. Zero signed-stage events and operational assignments at earlier same acceptance check.

November 1–24 monetary report:
Previous-month approved run 143, valuation 2026-10-22 verified against costing period status. Independent calculation groups receipts by product/UOM and applies governed component snapshots (RM, direct labour, production OH, QC, internal conversion and RM-attributed stores, PM excluded). 81 events, 2 unvalued, covered reference value INR 3230986.84 matches actual RPC at currency precision. Receipt correction event count 0 per RPC. Partial coverage, not certified completed-production value. Independent Tally aggregation latest 2026-11-24 snapshot: 228 lines, INR 3726189.40, zero missing amounts, exact match. Actual RPC marks plan unavailable pending freeze, achievement null, completed value null / NOT_VERIFIED, NOT_COMPARABLE, transfer NOT_CHECKED_BY_BOOK_TOTAL.

Separate live v_fg_transfer_reconciliation aggregation for Nov 1–24: MATCHED 106 groups INR 3668354.77; MISSING_LOG 6 groups INR 57834.63; sum INR 3726189.40. No other categories returned. This is current reconciliation view evidence, not an immutable historical as-of report or proof of comparable SKU reference cost policy C1–C3. Do not claim that the existing monetary RPC contains this detailed split. No source corrections authorized.

Read-only SQL permission context: existing view-only MIS target successfully invoked evidence RPC for Aug 25–Nov 24: 309 batches, 541 lines, 143 without depletion, 669 findings, requested 50 rows returned. Wall time including connector ~4.8s. Monetary RPC ~2.6s; separate transfer aggregation ~4.4s. Both public reporting functions STABLE, authenticated EXECUTE true, anon false. These are SQL-level checks with transaction-local claim context, not genuine signed-in browser or authenticated-role end-to-end acceptance. Do not publish private identity details. No load benchmark.

## Next bounded package
Keep G7 OPEN 7/11 (64%), PWL 0/7, G8 parked pending formal gate acceptance. Owner D1–D5 answered. Reporting-only candidate can proceed to final acceptance; D2 alerts and D3 frozen planning remain MIS obligations, not silently closed or transferred. Detailed transfer exception display and C1–C3/T1–T3 immutable report finalisation remain explicitly open where not yet implemented; decide release scope via owner review, not by inventing metrics. D4 approved deferral to PWL. D5 route stewardship assigned to PRM/PWL. Prepare a bounded reporting release now with unavailable labels intact, and separate remaining MIS work packages. Do not call the whole MIS programme complete.
Claude: reconcile latest main if needed, verify preserved PWL branch, retain eleven migration identities and WP10 protections, update closure documentation and registry proposal status notice, verify dashboard wording for live count versus dated reference, run final reporting/guard tests, prepare unpublished Windows candidate with actual version and packaged smoke, provide A1–A6 owner acceptance instructions. No operational code, ENFORCE, permissions, core sign-off, merge or publication without separate authorization. No protected PEC file changes.
