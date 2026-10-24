# Step 143 — Data Validation Master for Promotions (23 October 2026)

Created native Google Sheets tab `DATA VALIDATION MASTER` (sheetId 1206261000) at index2, immediately before `MARKETING PROMOTIONS MASTER`, within workbook `SASV - PRICE REVISION PROPOSAL` (ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`).

Exactly four columns: A Scheme IK, B Discount IK (%), C Scheme OK, D Discount OK (%).
- Scheme choices sourced initially from live `costing.scheme_master` active six schemes: No Scheme, 5 + 1, 8 + 1, 11 + 1, 16 + 2, 100 + 30.
- Current approved-run master discount choices (same in both regions): 0, 32, 33, 40 (numeric percentage points, not fractional proportions).
- Lists are copied static working validation data. Adding a new justified proposal discount or scheme to the relevant regional list within A2:D100 makes it available automatically. Neither list is a live database query. IK and OK lists are deliberately independent even though they presently contain the same choices.

Native strict `ONE_OF_RANGE` Google data validation with drop-down UI applied to `MARKETING PROMOTIONS MASTER` proposed columns N (Scheme Proposed IK), O (Discount Proposed IK), P (Scheme Proposed OK), Q (Discount Proposed OK), all future rows 2–700. References respectively to `'DATA VALIDATION MASTER'!$A$2:$A$100`, B2:B100, C2:C100, D2:D100. Validation metadata retrieved and verified on N2:Q3. Existing 627 rows and their static master/proposed values not overwritten. Master reference columns J:M intentionally not constrained.

Discounts are values such as 33 to represent 33 percent. Regional validation lists can diverge later. Do not assume all desired future discount rates already exist: insert new authorized rates in the validation master before selecting them in a proposed cell. Scheme's display names are from source choices, not yet a separate scheme-to-quantity formula; plan and validate paid/free quantity mapping in later proposal calculation stage. No commercial database changes.

Current checkpoint: Stage06B complete; validation controls complete; Stage06C broader policy precedence not yet designed, no proposal math.
