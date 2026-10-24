# Step 115 — AU9 October policy bridge: accurate scope and governance

User-provided effective-date distribution: plant capacity profiles 298; fallback policies 17; route step rules 9, all with effective_from=2026-11-01.

Fresh independent live query establishes **only 171 plant profiles effective on November 1**, because 127 superseded/closed records share the same effective_from but have no period including November 1. Also 17 fallbacks +9 rules effective November1 = **197 active policy records to consider** (171+17+9), NOT 324. Never clone all historical rows.

All 3 tables have exclusion constraints to prevent overlap, close-only triggers and forward effective-date guards, with revision journaling. Source of truth must remain the valid effective versions; no in-place changes or disabling triggers.

PROPOSED October bridge (NOT AUTHORIZED OR DEPLOYED): create newly approved bounded 2026-10-23 to 2026-11-01 rows only for the effective Nov1 data. An approval must specifically authorize earlier validity of these exact capacities/rules. Check forward-date guard semantics and journal/revision requirements, absence of overlapping original policies, uniqueness and proper supersession refs; no rewriting frozen histories. Change AU9 G4 function checks to Oct23 only after scoped forward bridge and plant_aware_load_switch approval. Manual oil cloth filtration stage1391/activity197 must be handled as a distinct physical process; existing isolated resolver only affects joint attribution, not global AU9 provenance.

NO database writes, no switch activation, no refresh-function deployments. Run136 immutable. G0 OPEN.
