# WP-07 QC Register — operator runbook: one native Save (Windows)

Save needs two keys: the app started with `EAUSHADHI_QC_NATIVE_SAVE=D7.3`, and the one-time `SAVE <product_id>` confirmation (currently `SAVE 262`; only Product 262 can be armed on the server). Only the Add QC Register green Submit (`#save_btn`, the per-row Save) is ever clicked, once, by the app. The portal's final Submit is never used.

## 1. Get the right code
```
cd /d "D:\ELECTRON PROJECTS\daily-worklog-app-wt-wp07-s2c-c1-qc-preparation-ui"
git pull
git rev-parse --short HEAD
```

## 2. Start with Save switched on
```
set EAUSHADHI_QC_NATIVE_SAVE=D7.3
npm start
```
PowerShell: `$env:EAUSHADHI_QC_NATIVE_SAVE="D7.3"; npm start`. Check the QC card shows the current UI build (D7.3.2).

## 3. Prepare (nothing is saved)
1. Portal: sign in, open Add Q.C (Quality Control) Register, choose the product. Leave the rest empty. Never press the portal Submit yourself.
2. App: both acknowledgements ticked, both notes filled.
3. Choose report to check → pick the product's report PDF (matched by SHA-256 and size, not name).
4. Check portal page → every line passes.
5. Dry run (no Save) → `DRY_RUN_PASS`, portal form empty again.
If Save stays disabled, the card line under it says what is missing.

## 4. Save (needs explicit authorization)
1. Save to portal (one row) → read the modal (product, 8 values, report name, laboratory warning, derived-date note).
2. Tick the authorization, type `SAVE <product_id>`, Confirm within 60 s.
3. Wait ~30 s without clicking. Do not press OK on any portal popup.
4. Never press Save again for that run (`ALREADY_CLICKED` blocks it).

## 5. Outcomes
- `CONFIRMED`: done.
- `AMBIGUOUS` / `NOT_RECORDED`: check the portal list by hand. If the row is there, tick "I checked the portal list", keep or edit the auto-filled note, click **Found on the list**.

## 6. Afterwards
Close the app. A normal `npm start` has Save off.
