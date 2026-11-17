# Costing Suite — network-isolated packaged Windows runtime smoke (17 November 2026)

**PASS — non-publishing, unpacked Electron Windows runtime; not a signed-in, NSIS/ZIP-installed or published release.**

## Exact CI evidence

- [Windows GitHub Actions run 44035814359](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44035814359), job **133878302958** — **SUCCESS**.
- Exact CI source checkout: `d7a802066f5cec34675f7370d15ddcdd1d76ece2` (synthetic review-branch PR merge, **not a tagged release**).
- Windows unpacked build: `npx electron-builder --win --dir --publish never`, package metadata **6.1.0**, app.asar source parity **30/30 PASS**.
- Before startup, workflow installed **an outbound BLOCK firewall rule specific to `dist/win-unpacked/SASV Workspace.exe`**. The launch script requires `COSTING_OUTBOUND_FIREWALL_CONFIRMED=1` and Windows platform. The rule was successfully removed by an unconditional cleanup step.
- The actual packaged Electron binary launched from `dist/win-unpacked`, its own bundled Express static server responded at `http://127.0.0.1:3000`, and **26/26 HTTP GET responses** were byte-identical to the reviewed source at the exact corresponding route. Coverage includes login page, four classification root management pages, their four JS clients and security helpers, six Costing HTML pages, four shared master HTML pages, Costing shell/feature flags, Product/PM BOM clients and `sw.js`.
- Output: **`WINDOWS_LOCAL_HTTP_PASS 26/26 localhost source byte parity; outbound firewall confirmed; no login`**. Process tree terminated after test. Evidence GitHub artifact **14307047444** (`costing-windows-unpacked-source-parity`, source/manifest/local HTTP JSON and boundaries only; **no binaries or credentials**).
- Source: `scripts/costing-release/windows-unpacked-local-http-smoke.mjs`; workflow: `.github/workflows/costing-windows-unpacked-rehearsal.yml`.

## Boundaries of this evidence

This establishes **packaged Electron launches and its embedded local HTTP server serves the reviewed HTML/JS/SW bytes**, on a disposable Windows CI runner. It does not establish that any protected screen renders authorised data or that an Electron/Netlify browser cache has the latest activated service worker.

The application `main.js` contains an automatic GitHub update check after `app.whenReady()`. The per-executable outbound firewall block is therefore necessary in this rehearsal: without positive confirmation, the runtime step refuses to launch. No updater download/installation, external API authentication, real staff/vendor/product read, writer action or installer release is part of this test. A passed local HTTP result must **never** be described as successful signed-in ERP functionality.

**Release-stopping gates remain:** genuine existing Editor/View-only/No-access six-module and classified master acceptance, seven sensitive-view negative GETs, normal Cost Comparison default-OFF response, populated 390px WP11 visual checks, installed PWA current controller/flags, actual Windows NSIS/ZIP installation and update/revert checks, and exact owner publish authority. Optional WP10 G2 05/CL15/RM1 production SQL is held separately in draft PR #463 and remains unapplied.

**Programme:** 10/13 closed, WP10/11/12 OPEN. Draft PR #465 retains this evidence without main merge or publication.
