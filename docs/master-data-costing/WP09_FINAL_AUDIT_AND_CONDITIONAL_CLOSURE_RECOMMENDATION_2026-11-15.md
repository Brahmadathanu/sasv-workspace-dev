# WP09 final audit and conditional-closure recommendation — 15 November 2026

**READY FOR OWNER DECISION; NOT CLOSED. Programme 9/13.** G1 accepted, A→C implementation independently corrected/tested, #434/#437 merged. The source audit/IA objective is fulfilled. Recommend conditional WP09 closure with presentation kept default-off and the receiving gates below binding before activation/release. Owner approval is still required; this is not a signature or work-pack closure.

## Post-merge proof
Reviewed implementation merge 6e8572df39fe3b3667001e33cf30b454ac067cd2; docs main a3fdcb10766a462e56d569ef9fc4c1e4178871d9. Post-merge GitHub verify, integrated-pec and contract checks all completed SUCCESS. No runtime code changed in this follow-up.

Direct unauthenticated HTTPS GETs of the six PWA runtime assets on https://sasv-utilities-hub.netlify.app returned HTTP 200 and SHA-256 byte matches to main: launcher-presentation.js, launcher-presentation-contract.js, launcher-presentation.css, module-registry.js, hub-auth.js and sw.js. Raw result: WP09_G2_EVIDENCE/post-merge-served-assets-2026-11-15.json. This proves served bytes for those files, not a Netlify production deploy commit identifier, active installed-worker version, authenticated UX or Electron packaging. No flag was activated, browser login used, role changed or writer executed.

Source/mock evidence remains registry 21/21, source 50/50, mutation 22/22, G2 contract 38/38, scope 23/23, lifecycle 5/5, G2 Chromium 87/87 and G1 OFF Chromium 33/33. The documented WP08 two source-scope failures remain historical; no untested role is marked PASS.

## Explicit receiving ledger — acceptance responsibility, not PASS

| ID | Residual / receiving owner | Required milestone and blocking condition | Current status |
|---|---|---|---|
| W12-WP09-01 | WP12 role/launcher acceptance; owner provides authorised identities, ChatGPT verifies | Before presentation activation: real editor/read/locked/denied in both clients, families/search/pins, revocation and account switch under delayed reads; 390/1280. Any denied disclosure or enabled locked destination blocks rollout. | NOT TESTED |
| W12-WP09-02 | WP12 PWA/service-worker release verification | Before PWA rollout: old active controller, update/activation/reload, stale importer/dependency combinations, warm/offline cache and rollback with flag removed. Served sw.js bytes alone do not satisfy this. | NOT TESTED |
| W12-WP09-03 | WP12 Electron/Windows and integrated release | Before packaged release: packaged routes, six-Costing entries, registered child pages, pin/search/family keyboard behaviour, flag OFF/ON/restore; final integrated eleven-Costing-flag matrix plus launcher flag recorded separately. No Step B repointing without its separate authority. | NOT TESTED |
| W12-WP09-04 | WP12 hosted resolver/build checks | Before activation/release: final build provenance and inherited hosted resolver cases including W12-WP08-01…08; unknown Pricing destinations remain text-only. | NOT TESTED; six direct asset responses MATCH |
| W12-WP09-05 | WP12 security/page verification | Before exposing affected lab pages: real role checks for registry/page permission-name differences (test-method-master-manager vs lab-test-method-master; lab-workflow-access-control-manager vs lab-workflow-access-control). No alias added. Any demonstrated disclosure blocks release. | NOT TESTED |

These are now explicitly recorded in the WP12 authority as receiving obligations, without authorising flag activation or changing existing WP05/WP07/WP08 receiving cases. WP11 PM BOM 390px overflow and SKU Deactivate contrast #429 remain in WP11, unresolved.

## Bounded non-launcher dispositions proposed for owner acceptance

1. Keep current live sections and all individual routes/permission targets. A→C remains the approved presentation direction; B is deferred.
2. Keep the launcher flag default-off until the receiving tests pass and activation is separately authorised. Do not reopen WP08/PEC or treat source merges as release acceptance.
3. Keep MRP console as intended canonical season-profile owner, conditional on F-A schema/RLS/dependency evidence and F-B/F-C reviewed migration of legacy links/writer. No legacy page is removed; source field parity is not database safety proof.
4. Park optional production-overrides archival and recents display as future hygiene; neither is a missing live launcher or a WP09 audit blocker. Preserve legacy source until exact cleanup is reviewed.
5. Carry all failed/NOT TESTED items unchanged into their owning gates. Formal closure would advance programme to 10/13 only after the owner's separate explicit decision is recorded.

## Next work

If the owner accepts these bounded dispositions, record conditional WP09 closure and start WP10 G0: audit future Product/SKU creation safeguards against actual creation/activation/readiness flows. WP10 remains not started pending that gate decision. No additional Claude assignment or handover is needed for WP09. Do not activate presentation or execute production SQL as part of closure or WP10 audit.
