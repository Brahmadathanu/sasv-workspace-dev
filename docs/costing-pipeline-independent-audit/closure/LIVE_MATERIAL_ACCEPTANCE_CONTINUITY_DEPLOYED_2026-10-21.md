# Live installation — Material acceptance continuity (2026-10-21)

Programme: Costing Pipeline Independent Audit / server closure ONLY.
Scope: costing.fn_material_review_acceptance_matches. No refresh, re-acceptance, data backfill, pricing export or sheet sync.

## Approval and implementation
User explicitly requested commit and deployment of the minimal correction on 21 Oct 2026.
Prepared SQL committed to costing/au4-normal-budget at b95d4f09134c4b19714048dd961879beec9d1b36.
Supabase project qhmoqtxpeasamtlxaoak: apply_migration name costing_material_same_evidence_inmonth_continuity_20261021 returned success.
Logic: ACTIVE acceptance, same costing month, earlier-or-same source valuation date, acceptance effective dates covering target, exact stock item/area/route/issue/warning/action context and null-safe equality across numeric rate, rate source, rate date, manual rate ID, purchase fact ID and stock valuation source. The source valuation-date limit remains in place, but the requirement for exact SAME valuation date is replaced by bounded in-month forward continuity conditional on full provenance identity.

## Post-deployment read-only verification
Compared 841 historical ACTIVE material acceptance groups from 16 Oct against frozen run131 20 Oct lines, invoking live matcher on each relevant line:
- RM carried 232, changed evidence still rejected 118, absent 7.
- PM carried 269, changed evidence rejected 207, absent 8.
- Total continuity 501; still review 325; absent 15.
Backward 15 Oct and cross-month 1 Nov matcher both FALSE for sample acceptance861 originating 16 Oct.
No approvals inserted or amended. Run131 remains prior frozen SUCCESS but unapproved and its control counts remain historical snapshot, not automatically recomputed.
Run128 APPROVED historical snapshot preserved. G2 attestation held. G6 open. Sheets and pricing blocked.

## Next
Prospective refresh requires separately governed run request. Resolve 311 changed stock-valuation date cases and 14 changed numeric rate cases under legitimate rate-quality policy; preserve controls. Investigate seven pricing-bridge reviews and full financial conservation. No artificial ledger plugs.
