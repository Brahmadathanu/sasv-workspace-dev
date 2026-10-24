# Step 146 — Verified scheme viability arithmetic from live database (23 October 2026)

Primary source: inspected full function definition of `costing.rpc_refresh_sku_scheme_viability_snapshot(date,date,bigint)`, not the deprecated overload `(date)` which intentionally raises. Its current per-scheme run snapshot computes:
- `total_qty = paid_qty + free_qty`
- `scheme_effective_selling_price = selling_price * paid_qty / total_qty`
- initial net sales realization = scheme effective selling price minus contingency value minus marketing expense cost per SKU.
- profit = net realization minus internal loaded cost per SKU.
- Profit on Sales Realization % = profit / net realization * 100 where realization > 0.
- Later region-aware update of these same snapshot rows sets IK / OK net sales realization = respective scheme effective selling price - respective contingency - **respective regional marketing expense**, and profit = that net realization - internal loaded cost. This latter regional result is the pertinent current contract; regional pricing cost = internal loaded cost + regional marketing expense, so equivalently profit = effective selling price - contingency - regional pricing cost. DO NOT subtract regional marketing twice and DO NOT separately charge free-unit material cost after multiplying revenue by paid/(paid+free).

Read-only verified concrete data: latest approved run140 SKU1 (Abhayarishtam, 450mL) IK MRP ₹95, GST5%, basic/selling price 90.4761904762 without discount; contingency 2% of basic = ₹1.8095238095. In historical run140 all six scheme choices in `sku_scheme_viability_snapshot` for this SKU:
- No Scheme 1+0: effective 90.4762, net 87.7959, profit 33.1649.
- 5+1: effective 75.3968, net 72.7165, profit 18.0855.
- 8+1: effective 80.4233, net 77.7430, profit 23.1120.
- 11+1: effective 82.9365, net 80.2562, profit 25.6252.
- 16+2: effective 80.4233, net 77.7430, profit 23.1120.
- 100+30: effective 69.5971, net 66.9167, profit 12.2858.

Proposed workbook formulas should reference only controlled in-workbook data; scheme master should include static paid and free quantity lookups for each scheme and region in DATA VALIDATION MASTER, not parse arbitrary display labels in many rows. Further viability equations:
  basic = proposedMRP/(1+GST/100);
  discount = basic*proposedDiscountPct/100;
  selling = basic-discount;
  effective = selling*paid/(paid+free);
  contingency = basic*existingContingencyPct/100;
  realization = effective-contingency (before marketing expense) [commercial gross realization after contingency];
  net realization after marketing = effective-contingency-regionalMarketing;
  profit = net realization after marketing-internalLoaded = effective-contingency-regionalPricingCost.

For the pre-existing `Profit on Sales Realization (%)` template, use database-authoritative **net realization after marketing**, not sales without marketing. Specify the Selling Price metric denominator as pre-scheme selling price unless changed by deliberate user governance. Profit on MRP uses GST-inclusive MRP denominator. None of these profit denominator choices should be silently conflated. A free scheme 5+1 reduces average realized price per unit through multiplying by 5/6; do not double subtract free unit cost.

TEMPORARY WORK SHEET source workbook looked up as `1HBte4Y4WFPGWark1jnQvNv_5spMuBA-6Om2KdNltXVM`; read its `temporary-work` and `Temp Work` tabs which were unrelated, and did not establish trustworthy comparable commercial formulas from there. Live canonical procedure + scheme snapshots provide primary ground truth, no need to copy obsolete sheet formulas.

Next task: populate static scheme paid/free lookup in DATA VALIDATION MASTER, formula specification and independent parity tests across 6 scheme choices in IK/OK, then create separate viability worksheets and exact + upward-to-₹5 MRPs, without altering Supabase policy.
