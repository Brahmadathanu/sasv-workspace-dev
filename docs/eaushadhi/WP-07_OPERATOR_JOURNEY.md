# WP-07 Operator journey: e-Aushadhi Review

Status as of 27 Oct 2026 (IST). Screens are on branch `feat/wp07-ux1-worklist` (tip `851804c`), not yet merged into main. The server changes listed here are live for everyone.

## 1. Who does what

- **Verifier**: checks a step and saves it for review.
- **Approver**: approves a step that a different person saved for review. Approver rights can be granted to trusted colleagues.
- Roles are kept in `regulatory.eaushadhi_role_grant`. Today there are 4 active grants: the owner and one colleague each hold Verifier and Approver.
- Nobody can grant or change their own role. A removed role is marked inactive with who and when; rows are never deleted.
- Every colleague with access sees all products, not only their own.
- The header shows "Signed in as ..." with your roles, or "View only".

## 2. The worklist

1. Open e-Aushadhi Review. The list shows all 931 products in scope, one row each.
2. Pick one of the 6 tabs (queues): **To verify**, **Needs data**, **Needs fix**, **Awaiting approval**, **Ready for portal**, **Done**.
3. Search by name, ID or classification. The filter icon in the search card narrows the list by Category, Sub-category, Group, or Only blocked.
4. Scroll down, or press Arrow Down. More products load 40 at a time (infinite scroll).
5. Click a row. A dialog opens with the product name and ID, the classification path, eight stage pills, and one main next-step button. If a button is off, a short reason is shown under it.

Queue counts on 27 Oct 2026 after the bulk seed: To verify 438, Needs data 440, Needs fix 51, Awaiting approval 1, Done 1 (total 931).

### Classification shown on the list

- The list uses the canonical hierarchy **Category > Sub-category > Group > Sub-group** from the product master. Every product has a group.
- It is not guessed from the Google Sheet tab name or the dosage form. The old "Family" value is retired. The sheet tab name is kept only as "Source sheet" in the approver-only Technical details.

## 3. The two-person rule (four-eyes)

Every approval must come from a different person than the one who saved the step for review. It covers Product details, Classification, each Ingredient line, Pharmacological actions and QC preparation.

The steps are always:
1. Person A opens the step, checks it, and saves it. The screen shows "Saved for review".
2. Person B, an Approver, opens the same step and approves it.

If an approval is refused, the app shows one of these reasons:

| Code | Plain meaning |
|---|---|
| `APPROVER_ROLE_REQUIRED` | You need the Approver role for this step. |
| `FOUR_EYES_NOT_SAVED_FOR_REVIEW` | Nobody has saved this step for review yet. Save it first. |
| `FOUR_EYES_SAME_PERSON` | You saved this step. A different person must approve it. |
| `FOUR_EYES_CHANGED_ON_APPROVE` | You changed the values while approving. Save for review first; a different person then approves. |

Approvals made before the rule existed, including all of Product 262, stay as they are.

### Who counts as "saved for review by"

Each step records `saved_for_review_by` and `saved_for_review_at`. Only the database sets them.

- The saver changes only when someone changes the checked values of that step, or on the first save of an empty step.
- If someone re-saves your work without changing it, you stay the saver. You still cannot approve it, and they can.
- Saving portal text or notes does not change the saver.
- Reopening an approved step clears the saver. A working-source correction on a line also clears it. Someone must save again before anyone can approve.
- Approving does not change the saver.
- Caveat for Pharmacological actions: the action set is replaced as a whole when saved, so whoever re-saves the set becomes its saver, even if nothing changed.

### Stage state

The app reads each step's status, saver, and whether you can approve from one server function, `rpc_eaushadhi_stage_review_state_v1(p_product_id)`. It returns one row per step (details, classification, each line, actions, QC) with a block code from the table above, or none.

## 4. Review records for all products (bulk seed, 27 Oct 2026)

- Before 27 Oct only 133 products had review records, from a one-time manual seed on 2 Sep. Opening any other product gave "workflow product not found".
- On 27 Oct the owner approved a bulk seed for the 358 products with sheet data: a workflow row, a Product details review row and a Classification review row each, plus 4,608 ingredient line reviews across 313 of them. The other 45 have no ingredient lines, so their Composition step shows "no data".
- Totals now: 491 workflow rows and 6,895 line reviews.
- Every seeded row starts as pending with no saver, so nothing can be approved until a person saves it for review.
- Seeded lines carry default suggestions (for example "Active ingredients", "As per text", and the unit and part used where they match). The final choices are left empty for the verifier.
- Pharmacological action records were not seeded. They are not needed to open a product.
- The 440 products with no sheet data have no review records and stay in **Needs data** until their data arrives.

## 5. Data sources

- Therapeutic data: the "TG - " sheets. Ingredients: the "PROD ING - " sheets. These were imported once (tag `WP07_SHEET_IMPORT_20261024`). Corrections are made in the database from now on, not in the sheets. The 24 Oct imports are still marked as staged.
- QC data: only from COA PDFs.

## 6. Known limits (27 Oct 2026)

- The Composition step has not yet been tested on screen with seeded products. The pilot will test it.
- The portal text card is avoided until the pilot is done.
- Product 262 (Karpooradi Thailam) is Done and locked. Save, Arm and Dry run stay off with "Already saved and confirmed on the portal."
- QC filling works only for Product 262. The server allows QC arming only for that product.
- Portal filling screens (the portal stepper, UX-3) are not built yet. The final portal Submit is never used by the app.
- The worklist screens are not merged into main yet. To use them, run the app from the branch folder.
