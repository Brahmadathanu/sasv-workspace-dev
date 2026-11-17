# WP11 — owner-approved formal closure (17 November 2026)

**DECISION: WP11 CLOSED.** Explicit programme-owner approval received 17 November 2026 following independent technical recommendation. **Formal programme: 11/13 CLOSED (WP00–WP09, WP11). WP10 and WP12 remain OPEN. Electron installer/release remains HOLD.**

## Accepted evidence and exact source

- WP11 Product SKU **Deactivate** control: merged contrast correction PR #448, and genuine authorised desktop SKU detail displayed a legible, unclipped red danger button labelled `Deactivate`; no button activation or mutation.
- PM BOM 390px incident: production v393 populated view had document `scrollWidth=847` with `clientWidth=390` and clipped header actions. Minimal responsive fix and service-worker generation v394 were independently reviewed, all twelve PR #469 CI workflows PASS; owner-authorised squash merge to main: `c6af2cb7539df2d2b6e596e86a2c27d7778c2f2f`.
- **Actual deployed production authenticated read-only witness** recorded on acceptance PR #465 head `f17ea250b9ea361cf9fe45943871a8ccd4c673b3`, in `COSTING_WP11_390PX_PM_BOM_AND_PWA_RECEIPT_2026-11-17.md`: hosted bundle **74/74 byte match** against merged main and shared-master gate PASS; service worker `hub-cache-v394`, existing v393 client upgraded on normal reload, activated with no waiting worker.
- Production genuinely populated template `100 g_Powder PP Packing` (two lines) measured `innerWidth=390`, `outerWidth=390`, `visualViewport.width=390.4`, `documentElement.scrollWidth=390`, `clientWidth=390`, `body.scrollWidth=390`. QA chip x=31–70, Reload x=140–176, Save x=196–232 all within viewport; Lines grid scrolls internally (712/325; `scrollLeft` 0→120), page `scrollX=0`. No Save, Deactivate or other writer invoked.
- Owner expressly authorised formal WP11 closure following review of that receipt. Previous simulated/preview evidence is retained but was **not** substituted for the real deployed production retest.

## Explicit boundaries

WP11 closure is scoped to the proven SKU Deactivate visibility and PM BOM responsive correction, with successful hosted delivery/update. It is **not** final authenticated confidentiality/security acceptance for six Costing modules, not eleven-flag real-role acceptance, not seven sensitive-view GET-denial proof, not a scoped/default-off Cost Comparison endpoint/timing proof, and not installed Windows NSIS/ZIP/updater/rollback evidence. Those WP12 gates stay OPEN/NOT TESTED as applicable.

WP10 classification client/server residuals, optional SQL PR #463, legacy DML/fleet compatibility, and route guards remain separate **WP10 OPEN** decisions; #463 is **unapplied**. PR #465 remains DRAFT and unmerged, containing the detailed receipt. Electron publication, installer packaging, production SQL, permissions and flags are not authorised by this closure.

**Next formal state:** WP00–WP09 CLOSED, WP10 OPEN, WP11 CLOSED, WP12 OPEN. **11/13 (84.6%) CLOSED**. Unconditional Electron release **HOLD**.
