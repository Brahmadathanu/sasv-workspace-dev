# Electron 45.4.1 upgrade and main-process hardening (19 Nov 2026)

**STATUS: DRAFT, stacked on PR #480 (dependency hardening). Nothing is published; the Electron release remains on HOLD. No updater activation, no database privilege change.** Owner approved the target (Electron 45.4.1) and the version proposal 6.2.0 (assigned later, in the release PR; `package.json` stays 6.1.0 here).

## 1. What changed
| Area | Change |
|---|---|
| `package.json` / lock | `electron` ^36.2.1 -> **^45.4.1** (locked 45.4.1: Chromium 156, Node 24.22.3, V8 15.6). New scripts: `predev`/`prestart`/`electron:install` run `install-electron` (Electron 42+ no longer downloads its binary in `postinstall`), and `test:electron`. |
| `main.js` | Embedded static server now **loopback only** (127.0.0.1 and ::1) instead of all interfaces, no wildcard CORS, `x-powered-by` off; `webSecurity:false` **removed** (default on); `open-module-url` IPC accepts only app-origin pages and clamps window size; same-origin window/navigation policy (see 2); main window loads after the server is listening; port overridable by `SASV_STATIC_PORT` (tests only, 3000 otherwise). |
| `electron/security-hardening.js` | New, pure-Node helpers behind those changes (unit tested). |
| Tests / CI | `scripts/electron-smoke/*` (unit + Playwright-Electron smoke) and `.github/workflows/electron-smoke-windows.yml`. |
No renderer page, preload (`preload.js`), IPC channel name, updater setting, signing or publish configuration was changed.

## 2. Investigation results (the three flagged items)
- **Express listener binding:** `listen(3000)` had no host, so the app directory was served on every network interface of the PC. Now bound to loopback; verified: reachable on 127.0.0.1, **refused on the machine's LAN address**.
- **Wildcard CORS:** `Access-Control-Allow-Origin: *` let any web page read the local server. The app only calls it from its own origin, so the headers were removed; verified no `access-control-allow-origin` on GET or OPTIONS.
- **`webSecurity:false`:** the comment said it was for CORS. The pages are same-origin with the embedded server; the remote API (Supabase) sends its own CORS headers (the PWA relies on that); CDN scripts load as classic scripts or CORS-enabled modules (esm.sh); module windows opened through `open-module-url` already ran with `webSecurity` on. Removed; verified a CORS-enabled cross-origin API works, a non-CORS one is blocked, and the login page's third-party scripts/modules still load. **Residual risk:** an endpoint without CORS headers that the app calls only from a screen not exercised by automation (the audit found none; absolute `fetch` targets are Supabase only). This is why the owner checklist still matters.
- **Related (same root cause):** `open-module-url` opened any URL (including `file:` and `https:`) in a window carrying the privileged preload; now restricted. `window.open`/links: app pages and `about:blank` popups (print/report) are allowed, other http(s) links open in the default browser, other schemes are dropped; top-level navigation of an app window off the app origin is blocked (electron-prompt style windows are unaffected). Existing page usage (`window.open` with relative app pages and `about:blank`) matches the policy.

## 3. Electron 36 -> 45 compatibility review
Checked the official breaking-changes list for 37 to 45 against this code (`main.js`, `preload.js`, `electron/**`).
| Breaking change | Applies here? |
|---|---|
| 45: sandboxed preloads lose `events`/`timers`/`url`/`Buffer`/`setImmediate` | No: `preload.js` requires only `electron` (`contextBridge`, `ipcRenderer`). Verified live (preload API present). |
| 45: `window.open` children of unsandboxed windows | No: windows are sandbox-default (`nodeIntegration:false`). |
| 45: `safeStorage` sync methods deprecated; 44: clipboard rearchitecture; 43: dialog `defaultPath` default; 42: `clearStorageData` quotas, offscreen DSF default, postinstall download removed; 41: PDF/cookie causes; 39: popup resizable; 37: `ProtocolResponse.session` | Code search: no use of `safeStorage`, `clipboard`, `dialog.show*`, `clearStorageData`, custom `protocol`. Offscreen window is used only for `printToPDF`: verified (valid PDF). 42's postinstall change is handled by the new `install-electron` scripts and CI step. |
| 44: ia32 builds dropped | No: builds are x64 (`arch=x64` in the packaging log). |
| 44: ANGLE statically linked | Packaged output no longer has `libEGL.dll`/`libGLESv2.dll`; the project does not reference them. |
| Native modules | None in production dependencies (no install scripts, no `.node` files outside `electron`'s own installer and dev-only `sharp`); `@electron/rebuild` ran with nothing to rebuild. |
Note `electron-reload` (dev only) and `electron-prompt` are unchanged; `electron-prompt` loads only inside the app's window context, as before.

## 4. Verification (automated, this machine, Windows)
Throw-away `--user-data-dir`, random loopback port, unpackaged so the updater is inactive; no sign-in and no production calls.
| Check | Result |
|---|---|
| Boots on Electron 45.4.1 / Chromium 156; app version from package.json; unpackaged | pass |
| Login page served from loopback static server; preload bridge (`app`, `electronAPI`, `sopAPI`, `auth`) present; context isolation (no Node globals in the page) | pass |
| IPC round trips (`get-app-version`, `auth:whoami`, `updater:get-state`, `updater:check`) | pass |
| Static server: loopback only, no CORS headers, nothing on the LAN address | pass |
| `webSecurity` on (CORS enforced); login page CDN scripts/modules load | pass |
| Window/navigation policy; `open-module-url` validation and size clamp | pass |
| PDF export (`printToPDF`) and DOCX export (`html-to-docx`) | pass |
| **Updater** (`electron-updater` 6.8.11) discovers a newer version from a **local** generic feed; no download, no install, no GitHub | pass |
| Same 9 checks against the **built `app.asar`** (served from inside the ASAR) | pass |
| Unit tests of the hardening helpers (8) | pass |
| Windows packaging `electron-builder --win nsis zip --publish never` (Electron 45.4.1, x64, no signing) | pass |
| Packaged ASAR: 4,524 files, 0 missing; 29/30 key files identical to git, the difference is `main.js` (intended); governed RPC classification writers only, no direct writers; `security-hardening.js` included | pass |
| `npm audit`: runtime 0; all dependencies 8 (0 critical, 1 high, 7 moderate; Electron's 45 advisories and `extract-zip` cleared) | pass |
Remaining 8 are build/dev tooling only: `sharp` (branding script), `glob`/`minimatch`, and the electron-builder family (macOS dmg/universal), none shipped.
Not run: the packaged `.exe`/installer (launching it would start the real auto-updater against GitHub), a real sign-in, and any authenticated screen.

## 5. Remaining owner decisions and actions
1. **Packaged-app pass (about 10-15 minutes, no writers):** with the unpacked app from this branch (`npm ci`, `npx install-electron` not needed for the packaged build): sign in; open the six Costing and four Classification modules; confirm Home/back; open one print/report popup; confirm no error dialogs. This covers sign-in, Supabase calls under `webSecurity`, and screens automation cannot reach.
2. **Code signing** (sign vs pilot-only risk acceptance), unchanged from PR #480.
3. **Release version** 6.2.0 applied in a separate release PR on its own exact head.
4. **Fleet gates** (inventory pilot with PR #471, installed-migration check) and Stage B remain blocked as before.
5. Merge order: #480, then retarget this PR to `main`.
Rollback: revert this PR; the previous Electron 36.9.5 build path is restored. Nothing published or deployed is affected.
