# SEC-A2 client permission parity — approval preview (4 Nov 2026)

**Current status: final-head client regression verified, draft PR #174, NOT MERGED or DEPLOYED.** The server-side SEC-A2 correction is already live under migration `20261104160256`: `rpc_costing_preview_approval_impact(bigint)` requires CCC edit because preview writes an acknowledgement. The client still needed an edit-permission affordance and direct-action guard. This work belongs to the existing [unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), not a separate programme.

## Scope

- `public/shared/js/costing-suite-shell.js`: inject reactive `canEdit: () => PERM_CONTROL_CENTER_EDIT === true` in the costing-approval controller. This uses the **specific CCC edit** grant, not the active module's edit permission; fail closed until actual canonical permissions load.
- `public/shared/js/costing-approval-screen.js`: default `canEdit` callback to denied; show **View only — approval requires Costing Control Center edit permission** for draft runs in read-only context rather than a clickable preview; check `canEdit` before direct preview calls, approval/finalisation calls and submit/button-state changes; close an in-flight preview modal if permission was lost while the preview was pending.
- `scripts/costing-approval/approval-controller.test.mjs`: explicitly inject CCC edit in legacy test fixture; seven SEC-A2 tests cover view-only denial, editor preview, mid-session and in-confirmation revocation, pending preview revocation, fail-closed default, and denial messages.
- `scripts/lib/sec-a2-strip.mjs` and its tests update historical text-pinning guards by reversing only the audited SEC-A2 hunks; a changed or duplicated hunk stays visible to legacy comparisons.
- `scripts/sec-a2-approval-wiring/approval-shell-wiring.test.mjs` exercises the real Costing Control Center page at 1280/390 px with an inert backend; guards no viewer preview RPC and one editor preview RPC.

## Server/client contract

- No approval preview call on page load, or on view-only navigation.
- CCC-edit user retains the draft **Review for approval** action and normal preview-ack flow.
- View-only user may inspect non-mutating run list but cannot create a preview acknowledgement through the controller; fake/forced handlers are also gated.
- Server remains the ultimate authorisation authority, including token granting and guarded approval.
- This client change does **not** grant read-only preview access or modify the approval-preview RPC. A future truly read-only preview would need a separately governed server API contract rather than weakening SEC-A2.

## Final-head review and regression evidence

Tested head `c653d9f104b78321bdebe6475f1dbe4f9827b127`, branch merged with `main` `d66eff0` without rewriting history. Claude reported focused approval-controller tests **87/87**; full LF **969 pass, 0 fail, 18 skip / 987 total**; full CRLF **969 pass, 0 fail, 18 skip / 987 total**. Chromium tests executed, none skipped. Pristine `main` comparison was **955 pass, 0 fail, 18 skip / 973 total**. The eighteen skips are all in unrelated `scripts/manage-activities/electron.test.mjs`, where an Electron window could not start in the sandbox. **Do not describe these results as zero-skipped or as verified Electron/Windows acceptance.**

Seven controller mutation variants and three shell wiring variants reportedly failed the tests when deliberately changed; mutations were restored. The known unrelated `scripts/manage-activities/page.test.mjs` scheduling-sensitive Chromium timeout requires a separate hardening package; do not silently expand this PR's scope.

Independent GitHub source/patch review completed: only the two production JS files carry application changes, and SEC-A2 test/infrastructure modifications are tightly scoped. The exact tested JS head is cited above; if documentation-only commits change the branch head afterward, the test result remains attributable to that prior code-equivalent head, **not a new full-suite execution**.

**Remaining gate:** owner merge decision. No production authenticated role test, no live view-only account proof and no Electron installer/release acceptance were performed. No flag, deployment, server or cache change was made by this PR.

## Programme

Formal closure remains **5/13 (38%)**. SEC-A1/SEC-A2 server guards are applied but role-level production acceptance has not occurred. Six-module signed-in view-only account unavailable as of latest aggregate permission audit; WP05/WP06/MDC-07/WP12 closure and CDE-2 remain separate gates. No Supabase, migration, grants, production data, flag, cache, Electron, Manage Activities or e-Aushadhi WP07 change is authorised by this PR.
