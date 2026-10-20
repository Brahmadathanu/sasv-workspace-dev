# G2 route 144 source correction — verified master, prospective design

Date: 20 Oct 2026. Status: **VERIFIED LIVE MASTER / PROPOSED CORRECTION**. No DB writes.

## Live definition
Route ID 144, family ID 101, route code `SHUKTHAM_SERIAL_THERMAL_ACIDIC_EXTRACTION_ROUTE`, version 1, APPROVED effective 2026-08-30, no effective_to and no superseding version. Approval reference `PRM-RFR-R144-SHUKTHAM-APP-20260830`. Note: despite family/route being Shuktham, frozen run128 shows only product51 Dhanyamlam using this route; confirm semantic match against manufacturing/BMR, not just mathematics.

Nine step records, source `costing.production_route_family_route_step`, id/sequence/class/occurrence/cycle:
- 1590 /10 MANUAL 1/1
- 1591 /20 GRINDER 1/1
- 1592 /30 PROCESSING_VESSEL 1/1
- 1593 /40 PROCESSING_VESSEL **8/8**
- 1594 /50 MANUAL **8/8**
- 1595 /60 PROCESSING_VESSEL **8/8**
- 1596 /70 STORAGE_OCCUPANCY **8/8**
- 1597 /80 GENERAL_AREA **8/8**
- 1598 /90 GENERAL_AREA **8/8**

**Owner-confirmed:** actual total eight repetitions, occurrence/cycle duplicate, not sixty-four. Preserve standard batch 1,155 L.

## Prospective minimal correction
Create a governed new version (do not edit approved old version in place). On the six steps set one recurrence field to 8 and the other to 1, with meaningful semantics selected after route source/BMR validation. Do not alter physical source quantity, standard batch, activity assignment, expense pools, or equipment loads as part of this narrow repetition correction. Verify route effective-date non-overlap, old version resolution for old valuations, new version for approved successor valuations and approved ADD/BYPASS override precedence.

Eight repetitions × any physically proven independent equipment charges is NOT equivalent to eight times eight. Existing scaled-load candidates require separate physical validation. Recompute DL and POH from the new effective route and full-population denominator; never take product51's old cost and divide by eight.

## Source checks required before implementation
1. Confirm route-name/production-process match for family 101 Shuktham and Dhanyamlam. Similar fermentation process may be valid, but do not assume.
2. Verify production route family membership and future effective assignments beyond frozen run128.
3. Check versioned route creation APIs/approval triggers; prepare isolated fixture for prospective version and both financial writers.
4. Test no duplicate scaling, legitimate long cycles (101/41/40) unaffected, zero-scope eight products unaffected, valid absolute pool conservation including internal transfer.
5. Obtain consolidated explicit approval for future migration, route version and eventual obsolete-engine hard retirement.

G2 OPEN; CI-032 HIGH OPEN. Live runs122/128 and all production objects unchanged.
