# B2 decision sheet: letting the app Save one more product on the portal

29 Oct 2026 IST. Plan only. Nothing changes on the live system from this sheet.

## What B2 is, in one line
Today the app can do a portal Save only for Product 262 (already done and closed). B2 lets it Save Product Details for one more product, chosen by you, under the two-person rule. Final Submit is never used.

## Decisions you need to make (3)
| # | Question | My recommended default | Risk if wrong |
|---|---|---|---|
| 1 | Which product goes first? | A product of the same type as 262 (Ayurvedic Proprietary Medicine), whose Details and Classification were saved by one of you and approved by the other in the pilot, and where the other person saved nothing. Candidate: **TO CONFIRM**. Amrithakalpam Capsule (740) is the pilot product; its product type is **TO CONFIRM**, and it can go first only if it is that type and fully approved. | A different type uses other portal option lists, so first use would test two new things at once. |
| 2 | Approved-copy file name for products other than 262 | Same pattern as 262: `EAUSHADHI_P<id, 4 digits>_<NAME IN CAPITALS, underscores>_APPROVED_PRODUCT_COPY_V01.pdf` (262 is `EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V01.pdf`). The app must stop if the stored file name does not match exactly. | A loose rule could attach the wrong file to the portal. |
| 3 | Blank sub type "-" (portal ids 31/32) on non-262 products | Allow "-" only when the approved Classification has no sub type, and only if "-" is in the loaded portal list for that type; otherwise stop. | Refusing it would block products that truly have no sub type; allowing it everywhere could hide a missed choice. |

Who may authorize the Save: only an Approver who saved none of that product's steps. Today the only Approvers are you and Aneesh. So on a product where you **both** saved steps, nobody can authorize (see ADR-08). Pick the first product with this in mind.

## Already decided (by me, within your standing rules)
- One product at a time, controlled by the server gate: only the chosen product is switched on.
- Stay at that one product until its first Save is accepted (CONFIRMED). Only then consider a second.
- Product 262 stays closed. The app never offers it for portal entry again.
- No change to the live server rules. The live rule has no expiry or one-time code for this Save; the typed text `SAVE PRODUCT <id>` plus the server checks are the authorization. Adding an expiry would be a separate server package needing your approval.
- Cache number stays `hub-cache-v376` until the merge to main.
- If a Save result is unclear, the app stops and reports. It never tries again by itself.

## What happens after you decide
1. You tell me the three answers. I fill them into package C (CODEX_PACKAGES.md) for Codex to refine the plan.
2. I audit Codex's plan; you approve; Codex builds; I audit the build.
3. Switching the gate on for the chosen product is a live change: it needs your explicit yes, a note to Aryabhatta, and one Approver to do it in the app.
4. The real portal Save needs your explicit authorization at the time.

## Jarvis build-audit checklist
- [ ] No `FIRST_CONTROLLED_PRODUCT_ID` / `productIds: [262]` / `isFirstControlledEntryProduct` left on the Product Details path; Composition and QC still 262-locked.
- [ ] Permission comes only from the server (gate get + run_begin answer); any error or missing answer = refuse.
- [ ] Product 262 refused for portal entry.
- [ ] `start_context.save_authorization` = `{confirmed: true, typed_confirmation: "SAVE PRODUCT <id>"}` with the open product's id; typed text checked before sending; no client-made nonce, token or hash presented as authority.
- [ ] All 5 refusal codes mapped to plain text; each stops with no retry.
- [ ] Field map and approved-copy name come from approved records and loaded portal options; any mismatch is a hard stop before Save.
- [ ] Sub type "-" handled exactly as decision 3.
- [ ] Final Submit not clickable or reachable (smoke assertion present).
- [ ] One native Save per authorization; ambiguous Save stops and is not repeated.
- [ ] No Supabase files changed; no direct writes to regulatory tables; cache still v376.
- [ ] All smoke scripts pass with counts reported (UX-3 phase A, UX-5, UX-1, UX-2, worker product-details smokes).
- [ ] Owner on-screen check planned on the chosen product before any live gate change.
