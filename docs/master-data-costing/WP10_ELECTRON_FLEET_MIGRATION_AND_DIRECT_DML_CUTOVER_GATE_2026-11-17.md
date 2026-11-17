# WP10 — Electron fleet migration and direct-DML cutover gate
**Prepared 17 Nov 2026. READ-ONLY source analysis / prospective protocol. NO releases, installed-client inventory, schema change, network telemetry, DML or role impersonation.**

## Verified dependencies
- The pre-PR #445 source (baseline `c5029409278445c89a1bc506c15824ec0fa91e63`) contains direct Supabase table INSERT/UPDATE/DELETE in the four root classification scripts, detailed in [legacy cutover assessment](WP10_FOUR_MASTER_LEGACY_ELECTRON_DML_CUTOVER_ASSESSMENT_2026-11-17.md). Current `main` uses 12 governed RPC CRUD calls.
- Production catalog confirms these 12 functions have `authenticated` EXECUTE and deny `anon`; this is catalog privilege evidence, **not** successful authenticated Editor/View-only HTTP role acceptance.
- Live four-table `authenticated` broad DML permissions plus `auth.uid() IS NOT NULL` RLS policies are a **confirmed current security design gap**; see [live security audit](WP10_LIVE_FOUR_MASTER_DIRECT_DML_SECURITY_AUDIT_2026-11-17.md).
- Current `main.js` uses `electron-updater` with a GitHub release feed, `autoDownload=true`, `autoInstallOnAppQuit=true`; packaged clients check at startup, ~30-minute intervals, focus (after 10 minutes) and resume. **Downloading or checking does not prove installation**, particularly when the app has not exited. Current `package.json` is still version `6.1.0`; repository documentation describes an existing published v6.1.0 release as of 3 Nov, but the actual currently installed version distribution remains **NOT TESTED**.
- Windows packaging and version/release assignment require the separate Costing/WP12 approval sequence; do not silently roll an intermediate installer just for this migration.

## Receiving stages and no-go tests
| Gate | Minimum required receiving evidence | Classification today |
|---|---|---|
| F1 fleet inventory | Privately gather installed app version and binary/release artifact provenance from each managed workstation; identify any unmanaged/offline copies, update failure and planned rollback assets; report counts only in reviewed governance docs, no staff IDs | **NOT TESTED** |
| F2 release candidate | Owner selects exact new version + main descendant SHA; build NSIS/ZIP non-published, verify SHA-256, `latest.yml`, signing expectations, all 4 JS/HTML + 2 shared helpers in ASAR | **NOT TESTED / release HOLD** |
| F3 new-client compatibility | Independently proven existing Editor, pure View-only and No-access identities; four modules read and gate as expected; disposable NON-production CRUD fixtures through governed RPC only | **NOT TESTED** |
| F4 installed migration | Each managed installation actually running updated binary after restart, verified by app version + source/ASAR fingerprint; merely downloaded updater is insufficient. Specify offline/updater-failure support procedure | **NOT TESTED** |
| F5 ACL/security candidate | Separate exact diff/hash/rollback for four-table direct DML privileges and policies, sequence/security-definer function/ownership dependencies; strict negative controls and restore plan | **NOT APPROVED** |
| F6 post-cutover | Legitimate independent role/JWT denial against direct-table INSERT/UPDATE/DELETE and permitted RPC positives; zero confidential response bodies and no live master-record writes. Rehearsal on disposable database before production | **NOT TESTED** |
| F7 rollback | Verify that the supported recovery installation stays RPC-only. Never silently roll back to direct-DML binary after permissions are narrowed or silently reopen broad grants | **NOT TESTED** |

## Candidate narrow correction (FOR SEPARATE REVIEW ONLY)
Prefer **an exact four-table direct-DML privilege removal only after confirming replacement clients and dependencies**; preserve SELECT, per-module security, legitimate `authenticated` RPC EXECUTE and schema dependencies. Examine ordinary direct write privileges and RLS together: a GRANT/REVOKE-only or policy-only patch must be justified by server-side effective permission testing. Assess sequence privileges, trigger side effects, references from other clients, definer function behaviour, lost edit access, and rollback before choosing the exact SQL. Do **not** use this draft to execute a revoke or modify a policy.

### Rollout policy
A published update is not fleet telemetry. Installed desktop copies may remain offline, run older code until restart, or be unmanaged. The operator must obtain an **actual version inventory** through an approved IT management process, not infer migration from updater configuration, GitHub download counts, or `latest.yml`.

**Decision alternatives:** (A) security-hardening cutover once F1–F4 pass and F5–F6 are authorised; (B) explicit owner-dated temporary risk exception with receiving security owner, compensating controls and planned expiry. B does not mean direct DML is secure and must not silently close WP10.

## Existing Costing control plane
- WP11 **CLOSED**, programme **11/13 (84.6%)**; WP10/WP12 OPEN.
- Optional guards PR #463 remain **DRAFT/UNAPPLIED**, not a substitute for four-table ACL remediations.
- No separate Electron installer/update/publish and no production SQL/RLS/grants/users/flags may be changed without exact owner approval.
- Existing acceptance PR #465 is DRAFT and retains the live WP11/Costing receipts; no new release identity is accepted by this document.

## Next permitted actions
1. Prepare a redacted offline Windows inventory worksheet: machine-local app version, package/ASAR digest, install type, updater downloaded/installed distinction, known status of old classification scripts. Keep any host identifiers outside committed evidence.
2. Compare fleet versions with the last RPC-only known build SHA; identify the actual earliest safe release (unknown today).
3. Once the owner nominates authorised existing role sessions, execute the fail-closed WP12 read-only permissions/negative-view protocol; defer any production write checks.
4. Retain release HOLD pending the real installed Windows acceptance gates and owner release-version decision.
