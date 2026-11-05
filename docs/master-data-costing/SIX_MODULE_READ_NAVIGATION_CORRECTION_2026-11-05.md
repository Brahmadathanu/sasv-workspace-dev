# Six Costing modules — read-only navigation correction (5 November 2026)

**Status: APPROVED, APPLIED AND VERIFIED IN LIVE DATABASE. Signed-in PWA post-fix acceptance PENDING.**

## Trigger and root cause

In a legitimate signed-in view-only PWA session, the owner observed all six Costing module cards rendered as greyed-out **View only** and not clickable. This was not a permission grant failure: the existing SASV acceptance test login had all six canonical and effective grants `can_view=true, can_edit=false`. The live `public.v_app_module_registry` exposed `min_nav_mode='view'` for the six modules across **both** PWA and Electron client entries.

Repository contract in `public/shared/js/module-registry.js` distinguishes `view` (visible but locked) from `read` (clickable without edit permission). `public/utilities-hub/js/hub-auth.js` suppresses navigation for `accessLevel='view'` and permits it for `read`. The valid database check allows `view`, `edit`, `read`. This is not an application-code or cache issue.

## Owner approval and bounded live correction

Owner explicitly approved changing **only** these `public.app_modules.min_nav_mode` values from `view` to `read`:

- `costing-control-center`
- `material-cost-manager`
- `cost-build-manager`
- `pricing-policy-manager`
- `production-route-manager`
- `cost-sheet-review`

A guarded single transaction checked all six source rows were active, navigable and `view`; it also checked that exactly one unrelated active/read-row baseline existed. It updated **exactly six** `public.app_modules` rows, changing `min_nav_mode` and `updated_at`, and required `read` in the six PWA and six Electron registry entries before committing.

Post-commit independent `SELECT` checks confirmed six source rows `read`; registry **6/6 PWA + 6/6 Electron** `read`; unrelated `read` count unchanged at 1. The test identity retains **79 canonical permissions**, with **73 view grants**, **52 existing edit grants**, and **6/6 Costing module grants view-only**. No user permission updates occurred in this correction.

## Security distinction and acceptance

This is a **global Costing navigation policy** applicable to any user already holding Costing view access. It is **not** an elevation to `can_edit`, and it is not proof that every Costing screen safely gates write actions. SEC-A1/SEC-A2 server guards and the merged client approval guard remain in effect.

The owner's original screenshot is **FAIL before correction**. Post-correction signed-in browser behaviour, flags, actual module read-only content, network RPC allowlist, browser-console errors and responsive layout are **NOT TESTED**, and formal work-pack closure is unchanged at **5/13 (38%)**.

Next acceptance: In a fresh signed-in PWA session, reload the Utilities Hub, verify six Costing cards clickable and labelled **Read only**, open each module on a read-only path, and inspect CCC draft-run status without invoking any preview acknowledgement or write-capable RPC. Use latest reviewed assets. Never click Approve, Finalise, Accept, Close, Save, Refresh/Recalculate, or other operational writes. Record exceptions in the existing [owner acceptance record](OWNER_ACCEPTANCE_RECORD_2026-11-04.md). No new deploy, flag activation, cache bump, Electron version or costing run is implied.

For a narrowly scoped rollback if owner directs: restore `min_nav_mode='view'` on the same six `public.app_modules` records only, after verifying current values remain `read`; doing so intentionally re-locks view-only Hub navigation.
