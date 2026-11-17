# Costing Suite — actual packaged Windows Electron login renderer proof (17 November 2026)

**PASS — real packaged Chromium/Electron unauthenticated login renderer; NOT authenticated, installed NSIS/ZIP, or an authorised release.**

## Receipt

- [GitHub Actions Windows run **44055823446**](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44055823446), job **133944809196**: **SUCCESS**.
- CI synthetic PR checkout `a1b33ab78e8cdf5df8c7a086ab987b37e3ca943b`. App source metadata version **6.1.0**. **Not a release SHA or tagged build**.
- Lockfile-pinned `npm ci` and `electron-builder --win --dir --publish never` produced an unpacked Windows executable and `app.asar`. **30/30 exact ASAR source parity PASS**.
- Before running the EXE, CI installed and confirmed an **outbound Windows Firewall BLOCK for its exact path**. Script refuses launch absent confirmation; after completion, it force-terminates the process tree and CI removes the firewall rule.
- Running the actual packaged executable started the bundled local Express server. **26/26 localhost-served assets matched source bytes**, including four classification masters and six Costing modules.
- **New:** Connected to the **packaged Electron instance's own Chromium renderer** over loopback CDP; inspected **only** its initial unauthenticated `http://localhost:3000/login.html` page. Confirmed title `SASV WORKSPACE | Login`, visible `#email` and `#password` controls and `Sign In` heading. CI printed `WINDOWS_LOCAL_HTTP_PASS 26/26 localhost source byte parity; renderer=PASS; outbound firewall confirmed; no login`.
- Artifact ID **14315179730**, name `costing-windows-unpacked-source-parity`, contains JSON/source receipts only—no binaries, credentials, or application session storage.
- Reproducible script: `scripts/costing-release/windows-unpacked-local-http-smoke.mjs`; workflow: `.github/workflows/costing-windows-unpacked-rehearsal.yml`.

## What this advances—and does not

This upgrades the prior Windows smoke from **unpacked ASAR and local HTTP** to **actual packaged unauthenticated renderer** verification. **The login page is a public screen**, not proof that real permissions, Costing, classification or sensitive data views work. Nothing authenticated to Supabase. Not a Windows installer acceptance, and auto-updater was not exercised; outward access was deliberately blocked to prevent the app's startup GitHub update check.

**Outstanding mandatory gates:** genuine Editor/View-only/No-access signed-in user sessions; negative GETs for seven sensitive views; normal CSR Cost Comparison default-OFF read; populated WP11 390px PM BOM and Deactivate UI; real installed PWA service worker and feature-flag restoration; final NSIS/ZIP installation and update/rollback; exact owner release SHA/version approval.

**State:** WP10/WP11/WP12 OPEN, formal programme 10/13 CLOSED. Optional Route Manager 05+CL15+RM1 guards remain separately draft/unapplied in PR #463. PR #465 contains this evidence and source-only test changes; `main` unchanged, no production SQL/permissions, no published Electron release.
