# WP10 read-only Windows inventory utility (draft)

This is a **local operator instrument**, not a remote fleet scanner, release agent, updater, security test, or evidence that legacy installations have migrated.

## Preflight

Run only on a **permitted SASV Windows workstation** with the user's approval and ordinary local access. The command does not require admin elevation. Do not disable workplace execution policies or DevTools restrictions. Do not run from an untrusted download or use a permissions bypass.

In a trusted checked-out repository, inspect the script before running:

```powershell
powershell -NoProfile -File .\scripts\wp10-fleet\inventory-installed-sasv.ps1
```

The default prints JSON locally. For a private file instead, explicitly supply a local path:

```powershell
powershell -NoProfile -File .\scripts\wp10-fleet\inventory-installed-sasv.ps1 -OutFile "$env:TEMP\sasv-fleet-local.json"
```

Do **not** commit individual output files or upload them to a PR, ChatGPT or public support channel. Share only an approved aggregate: count of installations, versions present, hashes matched against trusted reference release artifacts, and unresolved/unmanaged installations.

The script scopes discovery to the uninstall registry and known SASV Workspace installation directories. It reads executable ProductVersion, optional uninstall DisplayVersion, executable SHA-256 and `resources/app.asar` SHA-256. It never launches the app, triggers the updater, talks to Supabase, inspects session data, requests elevation, reads arbitrary user folders, or changes permissions. No installed locations, Windows username, hostname, email, JWT, Supabase rows or product/master business data are included in JSON.

The output field `rpc_only_classification_proven` deliberately remains `false` even if a version is new. A version label or an unknown digest is not sufficient to prove the installed binary contains the governed RPC-only four-script implementation. The exact hash must be matched by a separately approved release artifact/inventory. The absence of a discovered binary is not evidence that no old installation exists.

## Verification and known limits

- Static source safeguards: `node --test scripts/wp10-fleet/inventory-installed-sasv.test.mjs`.
- **Windows execution/real installation observation: NOT TESTED by this draft.** Must be run and accepted on an actual authorised Windows workstation before relying on any inventory conclusions.
- Test with an existing legitimate SASV installed binary before fleet-wide use; report discovery misses (portable copy, renamed folder, older installer path) rather than widening the search to personal directories without approval.
- Do not modify the registry, collect per-person telemetry or mass deploy this utility under this PR.
- WP10 and WP12 OPEN; WP11 CLOSED; 11/13 formally CLOSED. Electron release HOLD; broad four-table authenticated DML remains a confirmed weakness; optional SQL PR #463 unapplied.

See [WP10 fleet and DML cutover gate](../../docs/master-data-costing/WP10_ELECTRON_FLEET_MIGRATION_AND_DIRECT_DML_CUTOVER_GATE_2026-11-17.md).
