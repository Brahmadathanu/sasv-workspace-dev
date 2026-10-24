# Live internal-source canonical acceptance correction — 21 Oct 2026

Programme: Costing Pipeline Independent Audit / server closure. User authorised continuing corrections. Scope limited to costing.fn_resolve_internal_material_rm_rates_as_of.

## Defect
Internal-source resolver terminal RM review was joining material_review_acceptance_register with hardcoded exact source_valuation_date=p_as_of_date and exact rate/date equality, bypassing the approved costing.fn_material_review_acceptance_matches continuity policy. This induced false INTERNAL_SOURCE_REVIEW_REQUIRED despite unchanged approved terminal RM source rationale.

## Repair
Replaced the terminal RM review acceptance join only with a lateral call to the canonical governed matcher, passing original period and valuation context, stock item, exact issue/warning/action codes, numeric rate, rate source and date, manual/purchase provenance IDs and stock valuation source. No change to source-product RM cost composition, source quantity, rate precedence, blocking-line tests, or pricing. Full function prepared and committed in docs/costing-pipeline-independent-audit/closure/prepared/PREPARED_20261021_internal_source_use_canonical_material_acceptance.sql at aad552ca49caaeb64303ebdbd4a951b058e9c655. Supabase project qhmoqtxpeasamtlxaoak apply_migration costing_internal_source_canonical_material_acceptance_20261021 returned success.

## Read-only live positive tests
costing.fn_resolve_internal_material_rm_rates_as_of('2026-10-20') reports for affected source products:
stock158 source824 rate2910.362123256860099 RESOLVED review_line_count0 blocking_line_count0
stock1080 source277 rate2967.878597200178255 RESOLVED reviews0 blocks0
stock1083 source275 rate574.625420875420876 RESOLVED reviews0 blocks0
stock1092 source260 rate382.407242030527497 RESOLVED reviews0 blocks0
stock1150 source278 rate3164.653809620772963 RESOLVED reviews0 blocks0.

The five values remain unchanged versus historical run131 frozen drilldown. Latest historical run131 is still frozen SUCCESS and UNAPPROVED. This does not retroactively change run131 review counts. No refresh initiated, no acceptance records inserted/updated, no pricing or Sheets deployment.

## Remaining
Check pricing bridge control group (not equivalent to 612 propagated SKU REVIEW_REQUIRED statuses), final cost conservation and G2 preventive route attestation, then initiate one governed refreshed run and verify before G6 signoff.
