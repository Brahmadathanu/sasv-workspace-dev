# WP-07 Operator journey: e-Aushadhi Review

> **Refreshed 31 Oct 2026 (IST).** Sections 6a, 6b, 9 and 10 below describe the screens on branch `feat/wp07-ux1-worklist` (tip `c5821b1`, not merged). Where older sections disagree, sections 9–10 win. Current state: [wp07/CURRENT_STATE.md](wp07/CURRENT_STATE.md).

Status as of 29 Oct 2026 (IST). Screens are on branch `feat/wp07-ux1-worklist` (tip `78cf8a6`; this document was last checked against `851804c` for sections 1-6), not yet merged into main. The server changes listed here are live for everyone.

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

## 6. Locked steps and saving lines (UX-5)

- When a step is VERIFIED its fields are read-only. Only "Reopen" unlocks them. Looking at a locked field never marks the form as changed.
- Leaving a product with unsaved changes shows an in-page box with **Stay** and **Leave without saving** (no Windows pop-up).
- A Composition line showing default suggestions has its own **Save for review**. Saving it makes you its saver.
- After "Correct source" the line goes back to Pending. Save it for review again.
- If the portal options for a product type are not loaded, the lists say so and Approve stays off. Options for six Product Types were loaded on 29 Oct.

## 7. Fill on portal (Readiness tab) and the portal entry gate (UX-3)

The Readiness tab has a **Fill on portal** section. It shows each step's status and what would be filled. It never shows or clicks the portal's final Submit.

### Turning portal entry on or off
- Only an Approver sees the switch. You must type a reason (10 to 1000 characters). The app reads the server again after every change.
- Turning it on does not fill or Save anything by itself.

### Messages you may see
| Message | What it means |
|---|---|
| "Portal entry is not enabled for this product yet." | The gate for this product is off. An Approver can turn it on. |
| "Portal entry is turned on. Automatic portal Save for this product is not available yet." | The gate is on, but the app cannot yet Save this product on the portal (worker unlock, UX-3 B2, not built). |
| "Portal entry is turned on, but these steps are not verified yet: ..." | Finish the two-person approval of the listed steps first. |
| "More than one person saved steps for review on this product, including you. An Approver who saved none of them must authorize the portal Save." | You and someone else both saved steps. You cannot authorize; an Approver who saved nothing on this product must. (Text change F1 pending in the app.) |
| "Only an Approver can turn on portal entry or authorize a Save." | You do not hold the Approver role. |
| "Already saved and confirmed on the portal." | Product 262. Closed; nothing to do. |

### Who can authorize a portal Save (strict two-person rule)
- An Approver who saved none of the product's steps (Details, Classification, any line).
- Today the only Approvers are the owner and Aneesh. If **both** saved steps on a product, nobody can authorize it.
- Each Save needs its own typed confirmation `SAVE PRODUCT <id>`. An unclear result stops; the app never retries by itself.

## 8. Known limits (29 Oct 2026) — partly stale as of 2026-10-31, see section 10

- Product 262 (Karpooradi Thailam) is Done and locked. Save, Arm and Dry run stay off with "Already saved and confirmed on the portal."
- Portal Save from the app works for no other product yet. The worker is still locked to 262 until UX-3 B2 is built and you choose the first product.
- Composition and QC portal fill show "not available in this phase".
- QC filling works only for Product 262. The server allows QC arming only for that product.
- The final portal Submit is never used by the app.
- The worklist screens are not merged into main yet. To use them, run the app from the branch folder.
- The pilot (owner and Aneesh) is still in progress; record findings on the pilot sheet.

## 6a. Composition table (UX-7, UX-9.1)
1. Open a product and go to **Composition**. All ingredient lines show as one table: Ingredient, Botanical name (hidden in narrow windows), part used, quantity and unit, mapping and review status.
2. The toolbar stays fixed. Row 1: the **funnel** (filters), search, and "Showing N of M". Row 2: **Set source reference** (left, light fill) and **Approve reviewed lines** (right, solid green).
3. Filters open in a side drawer titled "Filters (N)". When any filter is on, the funnel shows an amber dot. Escape closes the drawer.
4. Only the table scrolls, and only when the rows do not fit; the header stays in place.
5. Hover (or Tab to) the small "i" next to **Composition**: "Changes save automatically. Verify when the section is correct."
6. Click a row to open that line.

## 6b. The line window (UX-8, UX-8.1)
1. **Top**: line title and summary strip (botanical name, quantity and unit, part used, review status, attention).
2. **Source as imported**: collapsed; click to see the raw sheet values.
3. **Reference**: Source wording, Standard reference work, Portal reference, Mapping status. Mapping one wording in the Reference Dictionary tab covers every line with that wording. "-" means no reference text was imported.
4. **Notes**, then the action buttons (Save for review, Approve, Correct source, Resolve source issue, as allowed).
5. **Footer**: save status on the left (Unsaved changes, Saving..., Saved, Error); Previous, Next, Next line needing review on the right. Messages appear in the footer and do not move the buttons.
6. Close with X, clicking outside, or Esc; unsaved changes are saved first, or you choose Stay / Leave without saving.
- **Correct source** changes raw ingredient, scientific name, part, quantity, unit (reason required) and sends the line back to Pending. It does not change the reference wording — use Set source reference.

## 9. Set source reference (UX-9, server live 31 Oct 2026)
1. On Composition, click **Set source reference**. (Off, with a reason in the tooltip, if you have no Verifier/Approver role or the product's portal entry has started — today Product 262.)
2. Choose the wording from the known list. **Enter a new wording** is for Approvers only.
3. Choose which lines: blank lines (default), selected lines, or all lines. Lines that already have a *different* wording change only if you tick them, and only an Approver can.
4. Type a **reason** (10–500 characters; the counter shows "0/500").
5. Check the preview, then **Apply**. If Apply is greyed, hover it to see why.
6. All listed lines change together or none do. Changed lines go back to **Pending**: save them for review again, and a different person approves.
7. **Cancel** with typed text asks "Discard this source-reference change?" in the page.
- **Verified lines cannot be changed here.** Reopen the line first, then set the reference, then save and approve it again.
- "Preview is out of date" means someone changed a line meanwhile: rebuild the preview.
- You cannot clear a reference (set it back to blank) yet; that waits for the portal blank-reference answer.
- **Approve reviewed lines** approves the reviewed lines in one batch (four-eyes still applies per line). It is locked while a batch or a source-reference apply is running.

## 10. Known limits (31 Oct 2026)
- Product 262 is Done and locked; the worker (portal Save) is locked to 262; B2 unlock is on hold.
- The final portal Submit is never used. Each portal Save needs its own authorization.
- The worklist, Composition table and UX-9 screens are on the branch only, not merged into main.
- Unknown whether the portal accepts an ingredient with no reference (owner/Aneesh check).
- Small open polish items: floating tooltip does not follow page scroll; tab focus ring may be clipped.
- Pilot with Aneesh still in progress.
