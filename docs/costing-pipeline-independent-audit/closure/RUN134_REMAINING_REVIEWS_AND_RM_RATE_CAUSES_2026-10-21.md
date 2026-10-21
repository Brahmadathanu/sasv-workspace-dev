# Run134 outstanding review — investigation and decision gate (21 October 2026)

Read-only analysis. No deployment, approval, new refresh or publication.

## Population / classification
Final 627 SKU control snapshot: 480 READY, 16 MATERIAL_REVIEW_REQUIRED, 131 PRICING_BRIDGE_REVIEW_REQUIRED. All 16 material cases have precisely one unaccepted RM line and zero unaccepted PM lines, covering SKU IDs 32,39,139,335,336,469,565,566,567,569,577,578,824,892,893,949. Shared product repeats must be treated as issue incidence, not independent approval counts.

Pricing region statuses (147 total pricing REVIEW including 16 whose first control is MATERIAL): IK+OK REVIEW 82, OK-only REVIEW 45, IK-only REVIEW 20. Aggregate component cross-tab for 147 pricing reviews: (internal READY, marketing READY, allocation READY) 65; (READY, REVIEW, REVIEW) 56; (READY, REVIEW, READY) 10; (internal REVIEW, marketing READY, allocation READY) 15; (REVIEW, REVIEW, REVIEW) 1. Hence there are 131 first-control pricing reviews, not 147 distinct additional ones.

Regional marketing evidence in all 627x2 region snapshots: 540 IK plus 514 OK are actual signed sales/actual units READY. Regional review rows include 72 OK + 59 IK actual signed sales with REGION_SCALED_COMMON_BASIS; 40 OK + 28 IK governed default monetary / default units; 1 OK actual signed sales/default units. These are region rows, not distinct SKU counts and cannot be summed to infer unique reviewed SKUs. Review policy should not be suppressed merely because values calculate.

## RM financial delta
Three changed material SKU costs 133 -> 134 all trace to stock item 874 Somalatha (F): LAST_PURCHASE changed 550 (purchase fact 45441, 2026-04-13) to 600 (purchase fact 152484, 2026-10-20). SKU623 Saraswatha Ghritham +INR1.034090909, SKU634 Amara Ghritham +INR2.585227273, SKU658 Manasamithra Vatakam +INR0.75. Product RM lines summed differences +7.5757576,+18.9393939,+0.0150000 per product base. Each run had 28,36,59 line counts. source_line_key values changed wholesale between run IDs, thus a join on source_line_key gives no matches and must not be used to infer numeric source parity. Stable purchase_stock_item_id grouped comparison isolated only item874 in all three products. Verify purchase fact legitimacy if seeking final financial attestation; do not treat rate movement as approval-policy artifact.

## Recommendation for user discussion
Retain true 16 RM review requirements until root material / acceptance conditions verified, not blanket approve. Keep fact-based regional marketing READY and substantive review for mixed/default sources. Investigate actual regional evidence availability and proportional fallback policy without fictional sales or forced READY. Require deliberate policy decision before any status changes. No changes to allocation, cost, or rate logic indicated by the 3 rate movements. G2 prospective safeguard HELD, G6 OPEN, Sheets BLOCKED. No subsequent refresh until agreed targeted correction and independent tests.
