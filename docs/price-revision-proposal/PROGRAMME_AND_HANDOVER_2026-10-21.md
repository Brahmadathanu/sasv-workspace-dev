# SASV PRICE REVISION PROPOSAL — programme charter and handover (2026-10-21)

**New workstream** separated from `docs/costing-pipeline-independent-audit/` cron/closure engineering. This charter authorizes PLANNING and LIVE READ-ONLY audit only; no view drop, pricing revision, or Google Sheet modification is approved yet. Stage-by-stage live workbook review with owner acceptance gates. Minimal formatting. No work on legacy SASV - TEMPORARY WORKS.

## Sources
- Live Supabase: project `qhmoqtxpeasamtlxaoak`; costing engine authoritative; last G6 formally approved run136 as of 2026-10-21, October valuation 2026-10-20.
- Target Google workbook: `SASV - PRICE REVISION PROPOSAL` — https://docs.google.com/spreadsheets/d/1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q/edit; ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`; current only empty Sheet1, en_GB locale / Etc/GMT timezone. Inspect live before changes.
- Previously proposal prep in `SASV - TEMPORARY WORKS`; do not modify it.
- Requisite view candidates: `costing.v_price_revision_feed_approved`, `public.v_costing_pricing_price_revision_feed_approved`. Also detailed `costing.v_sku_detailed_cost_sheet`, `costing.v_sku_detailed_cost_sheet_current`. DO NOT DROP existing views until dependency audit, replacement contract, role/API/RLS, and rollback evidence.

## User requirements
1. Audit Ksheerabala Thailam 101 Avarthi and 41 Avarthi allocation values and trace denominator, labour, batch sizes, per-SKU driver, budget allocation, no sales/batch-size denominator substitution. Run136 sample 10mL: 101 = SKU191 product183, material 35.7075, labour 13.0363, prime 48.7438, manufacturing COP 59.4206, internal loaded 66.8882, marketing 10.3547, pricing 77.2428, READY. 41 = SKU193 product184, material 12.9283, labour 60.0344, prime 72.9627, manufacturing COP 131.1401, internal loaded 138.6077, marketing 0, pricing 138.6077, READY. These numbers are observed, **NOT approved as economically correct**. Exclude 101 soft gel capsules (different product).
2. Inventory all cost sheet components and authoritative definitions/formula bridges, including RM versus PM **separately** if present in underlying snapshots: material, conversion, direct labour, prime, production/QC/material stores overhead, manufacturing COP, admin/finance overhead, internal loaded, marketing/pricing expense, pricing cost, tax, MRP, discounts, discounts net, scheme, selling, contingency and margins; do not double-count aggregates or infer current scheme coverage.
3. Inspect price-revision feed views and their dependencies and refresh-date governance. Rename/reconstruct only via versioned migration with contract tests and parity/rollback, no blind DROP.
4. Dedicated workbook: `master_data` database-provenanced static imported data, `promotion_master` current database marketing rules and sheet-controlled proposals, `revision_objectives` effective-dated targets (e.g. profit/MRP >=7%), `price_revision_ik`, `price_revision_ok`. Formula-driven with minimal manual intervention. Fixed current values versus editable proposed values. User archives a snapshot tab dated on completion while live proposal tabs continue.
5. Scoping of discounts/schemes: all products, product group, subgroup, product, SKU; specificity and effective date with precedence and conflict detection. IK/OK independent MRPs and downstream calculations. Explicit current vs proposed and date logic; factor schemes into realized sales correctly, not just percentages. Group identities must come from actual source.
6. Live inspection and user gate after each stage, minimal sheet styling.

## Proposed gated sequence
G0 baseline audit: read repo rules/history and live DB, exact view definitions/dependencies and run selection; inspect current workbook; validate two Ksheerabala allocation cases and all component formulas. Show findings to user.
G1 data contract: agree SKU grain, product classification, IK/OK mapping, current policy source, full field dictionary, null/error/currency conventions, run as-of freshness and treatment of supersessions. User gate.
G2 SQL feed reconstruction: only necessary complete stable feed, dated governed run selection (approved baseline; explicit policy for latest approved versus latest successful), preserve dependent objects, migrations and sampled/aggregate parity. User gate.
G3 master_data: first live workbook write; minimal header styling, stable import table, counts/dedup/freshness, compare SQL; user live acceptance.
G4 promotion_master: current values visible and sheet-controlled dated proposed hierarchy, specific scopes, conflict and validity alerts; user gate.
G5 revision_objectives: goal metric formally defined (profit divided by MRP or sales realization, before/after tax?), effective dates, IK/OK, change-policy, user gate.
G6 IK & OK formula-only proposal tabs; current vs proposal, effective promotion lookup, objective-driven required MRP with rounding and exceptions, scheme 5+1 or equivalent cost realization formula; transparent intermediate cost bridges. Validate sample SKUs, group rules, error cases and totals. User gate.
G7 final sheet usability, refresh protocol/protect manually maintained inputs, dated static snapshot archival, documented ownership, reconciliation and completion.

## Critical open decisions to resolve in new chat by evidence/proposal, not upfront long questioning
- 41 Avarthi labour+overhead high despite READY; check batch basis and allocation, do not change cost engine without evidence.
- Which source is authoritative for current scheme and discount (view vs policy/scheme snapshots), and which region/channel semantics?
- Profit on MRP >=7% definition: gross margin vs profit net of discount/scheme/contingency/marketing, taxes, denominator MRP (tax inclusive), scheme free units, rounding. User approval after numerical demonstration.
- Price revision master static snapshot versus refreshed approved run: explicit refresh operation to prevent imports overwriting proposed entries; stable keys preserve row alignment.
- Impact on other apps from existing feed view removal; rebuild safely.

## Non-goals/controls
No change to costing release G6, approved run136, weekly cron jobs, downstream Sheets elsewhere, costing suite module implementations, or prior month status. User wants concise and plain English, incremental progress, each stage verifiable in live workbook. Maintain programme progress in THIS folder only.
