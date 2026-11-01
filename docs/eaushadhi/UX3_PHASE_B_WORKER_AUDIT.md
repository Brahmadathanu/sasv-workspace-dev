# UX-3 Phase B — Worker / renderer Product 262 audit

Date: 2026-10-29. Branch tip at audit: `f20eec8`.  
Purpose: list every place the Electron worker, main process, and renderer still assume Product 262, and how Category / Sub Type map to portal dropdowns. Read-only inventory for Phase B.

## Verdict (stop condition)

**Phase B as approved cannot ship without a design change beyond the plan.**

Approved build says: after Authorize, run the **existing Product Details executor in full** (one native `SaveData`), for a **non-262** product the owner enables. Product **262 stays closed** in Fill on portal.

The existing executor and live arm are **hard-locked to Product 262 (Karpooradi)** end-to-end. Expanding only the Fill on portal UI / gate RPCs / `save_authorization` does **not** let a non-262 product start or Save. Unlocking the worker for arbitrary products is a separate design (field map, approved-copy filename, name lock, live-arm list, IPC gates) — not in the approved Phase B slice.

Therefore: **STOP before building gate UI / Authorize / worker `save_authorization` wiring.** Owner must choose how to proceed (section at end).

---

## 1. Canonical locks

| Location | What |
|----------|------|
| `electron/eaushadhi-worker/product-lock.js` | `FIRST_CONTROLLED_PRODUCT_ID = 262`, `isFirstControlledProduct` |
| `electron/eaushadhi-worker/product-details-live-arm.js` | `productIds: [262]`, `isProductDetailsLiveArmedFor` requires id === 262 |
| `public/shared/js/eaushadhi-review-helpers.js` | `FIRST_CONTROLLED_PRODUCT_ID`, `isFirstControlledEntryProduct` |

Main (`main.js`) and preload only register IPC; they do not hardcode 262.

---

## 2. Electron worker — Product Details

| Area | Files (representative) | Behaviour |
|------|------------------------|-----------|
| Live arm | `product-details-live-arm.js` | Live mutation only for 262 |
| Adapters | `product-details-live-adapters.js` | Throws if not armed; `p_product_id` stamped 262 |
| Orchestration | `index.js` preview/start/resume/reconcile/rebase/recover | Rejects `id !== 262` (`PRODUCT_LOCK_REJECTED`) |
| Trusted path | `product-details-trusted.js` | Collect/build/start/resume force 262; Karpooradi duplicate search default |
| Field contract | `product-details-field-map.js` | Name must be `Karpooradi Thailam`; approved copy `EAUSHADHI_P0262_…_V01.pdf`; subtype portal value **`31`** and label **`-`** required (`rejectKuzhambuSubtype`) |
| Executor | `product-details-executor.js` | Preflight/start/resume hard-lock 262; never treats `"262"` as a portal product id |
| Approved copy | `approved-copy-resolve.js` | 262 + governed P0262 filename |
| Dry-run | `dry-run.js` | First-controlled product only |
| Portal hygiene | `portal-duplicate-guard.js`, `portal-save-observe.js` | Forbid treating `"262"` as portal id |

`run_begin` today: worker builds hashes + `start_context` (`operation: "product_details_only"`). Renderer must not call `fetchWorkerRunBegin` (existing contract smoke).

---

## 3. Electron worker — Composition and QC (out of Phase B fill scope)

| Area | Lock |
|------|------|
| Composition | Product 262 + line **931** (`composition-contract.js`, executor, live-arm, `index.js`) |
| QC prep / report / register | Product 262 only; Karpooradi filenames and labels |

Phase B plan already keeps Composition and QC **blocked** in the Fill on portal stepper. These locks remain.

---

## 4. Renderer

| Area | Behaviour |
|------|-----------|
| Fill on portal (`portalFillStepperModel`) | 262 → closed copy only; no steps |
| Worklist (`PORTAL_CONFIRMED_PRODUCT_ID`) | 262 forced DONE / portal-lock; “Already saved and confirmed on the portal.” |
| Worker client QC | 262 arm/dryRun/nativeSave/save refused as closed |
| Control | PD dry-run / Karpooradi execution / QC / Composition portal panels gated by `isFirstControlledEntryProduct` (262 only) |
| QC typed save | Phrase `SAVE 262` (separate from Fill on portal) |

---

## 5. Category and Sub Type → portal dropdowns

### Load

1. RPC `rpc_eaushadhi_product_classification_options`
2. Client `fetchProductClassificationOptions(domain, productTypeOptionId)`  
   - `PRODUCT_TYPE`: no parent  
   - `PRODUCT_CATEGORY` / `PRODUCT_SUBTYPE`: require selected Product Type id  
3. Workspace load and type-change reload fill Category / Sub Type for that type.

### Fill eligibility (client)

In `eaushadhi-review-helpers.js`:

- `fill_eligible === false` → not selectable  
- Dash / blank labels → not selectable  
- **Intended:** portal values **31 / 32** (and dash labels) are Sub Type placeholders (“No sub type”), not fill targets  

**Note for Part A follow-up:** the current `isPortalPlaceholderSubtypeOption` / `isFillEligibleClassificationOption` apply the 31/32 rule to **any** option passed in, not only when rendering Sub Type. Phase B build note requires restricting 31/32 to the **Sub Type list only** (Categories must not be treated as placeholders solely because of external id 31/32).

### Display of selected placeholder Sub Type

When the selected Sub Type is filtered out of the dropdown (e.g. id 274, portal value 31, label `-` under Ayurvedic Proprietary — Product 262 evidence), the UI shows:

`No sub type (portal shows '-')`

Missing options show the administrator copy; never `Current value <id>`.

### Worker fill vs review UI

Worker Product Details fill uses governed content (`content_get`) portal option **values** for type / category / subtype selects. Karpooradi worker contract still requires subtype value **31** / `-`. Review UI does not offer `-` as a fill-selectable choice.

### Six previously empty Product Types

Live reference data now holds Category / Sub Type options for more than the earlier two types (Ayurvedic Proprietary, Siddha Classical). The review client already loads options **by selected Product Type**; empty lists still use the unloaded-options message when a type has no rows. No worker change required for option loading itself.

---

## 6. What Phase B UI could do without worker unlock (insufficient alone)

| Piece | Feasible without 262 unlock? |
|-------|------------------------------|
| Gate get/set wrappers + Approver toggle | Yes (server PKG3a) |
| Authorize modal + typed `SAVE PRODUCT <id>` | Yes (UI only) |
| Pass `save_authorization` into worker start_context | Only if worker accepts that product id |
| Full PD executor + one SaveData for **non-262** | **No** — hard locks + Karpooradi field contract |
| Full PD executor for **262** | Conflicts with “262 stays closed” |

---

## 7. Owner decisions required before build

1. **Unlock Product Details live path for gate-enabled non-262 products** (live-arm list + product-lock + generalize or replace Karpooradi field/approved-copy contracts), then implement Phase B as planned; or  
2. **Narrow Phase B** to gate UI + Authorize modal + refusal mapping only, **without** calling the PD executor until a later worker package; or  
3. **Other owner-defined path**.

Also confirm: restrict portal value 31/32 placeholder logic to **Sub Type only** (small client fix, approved in the build brief) — can ship with whichever Phase B slice is chosen.

---

## 8. False positives (not product 262)

Capture helpers using `262144` byte limits are unrelated to product id 262.
