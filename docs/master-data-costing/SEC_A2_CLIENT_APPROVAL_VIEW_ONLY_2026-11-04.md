# SEC-A2 client permission parity — approval preview (4 Nov 2026)

**Current status: implemented on isolated draft PR, NOT MERGED or DEPLOYED.** The server-side SEC-A2 correction is already live under migration `20261104160256`: `rpc_costing_preview_approval_impact(bigint)` requires CCC edit because preview writes an acknowledgement. The client still needed an edit-permission affordance and direct-action guard. This work belongs to the existing [unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), not a separate programme.

## Scope

- `public/shared/js/costing-suite-shell.js`: inject reactive `canEdit: () => PERM_CONTROL_CENTER_EDIT === true` in the costing-approval controller. This uses the **specific CCC edit** grant, not the active module's edit permission; fail closed until actual canonical permissions load.
- `public/shared/js/costing-approval-screen.js`: default `canEdit` callback to denied; show **View only — approval requires Costing Control Center edit permission** for draft runs in read-only context rather than a clickable preview; check `canEdit` before direct preview calls, approval/finalisation calls and submit/button-state changes; close an in-flight preview modal if permission was lost while the preview was pending.
- `scripts/costing-approval/approval-controller.test.mjs`: explicitly inject CCC edit in legacy test fixture; four SEC-A2 tests cover draft rendering/read-only denial, editor preview, mid-session permission revocation and lost permission while preview pending.

## Server/client contract

- No approval preview call on page load, or on view-only navigation.
- CCC-edit user retains the draft **Review for approval** action and normal preview-ack flow.
- View-only user may inspect non-mutating run list but cannot create a preview acknowledgement through the controller; fake/forced handlers are also gated.
- Server remains the ultimate authorisation authority, including token granting and guarded approval.
- This client change does **not** grant read-only preview access or modify the approval-preview RPC. A future truly read-only preview would need a separately governed server API contract rather than weakening SEC-A2.

## Review and test gates

This branch needs **actual local Node/Chromium full-suite execution** on both LF and CRLF, 0 skipped; run `scripts/costing-approval/approval-controller.test.mjs` and other Costing flag/browser suites, including the WP12 console/RPC sweep. Static GitHub review cannot honestly claim these tests were executed. Review the exact 3-file product/test scope and rebase if main changes. Only after review/owner merge decision may this go to main; flags remain default OFF and no Electron/PWA release is implied.

## Programme

Formal closure remains **5/13 (38%)**. SEC-A1/SEC-A2 server guards are applied but role-level production acceptance has not occurred. Six-module signed-in view-only account unavailable as of latest aggregate permission audit; WP05/WP06/MDC-07/WP12 closure and CDE-2 remain separate gates. No Supabase, migration, grants, production data, flag, cache, Electron, Manage Activities or e-Aushadhi WP07 change is authorised by this PR.
