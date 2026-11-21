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

## Safety guards (added after review)

- **Local fixed drives only.** Every install location, and every file that is read or hashed, must be a drive-letter path on a *fixed* drive. UNC paths, device paths, mapped network drives, removable and optical media are rejected before anything is read. Each rejection adds a generic warning; no path is reported.
- **No links.** A path that is, or passes through, a junction or symbolic link is rejected, because a link could redirect a read to a network or foreign location.
- **StrictMode-safe registry reads.** Missing optional values (`DisplayName`, `InstallLocation`, `DisplayVersion`) no longer raise errors or warning floods, and a SASV registry entry without `InstallLocation` is reported once instead of aborting its discovery.
- **`-OutFile` never overwrites.** The target must be a new file in an existing local folder that is not a link. This is validated before any discovery, and the file is created with `CreateNew`. An existing file or directory, a missing parent, a UNC or removable path, or an invalid path stops the script with an error.

## Verification and known limits

- Automated: `node --test scripts/wp10-fleet/inventory-installed-sasv.test.mjs` runs static source safeguards and, on Windows, guard-function checks on synthetic values plus bad `-OutFile` aborts (no discovery). Three end-to-end tests against a *fake* install in a temp folder run only on CI (an ephemeral runner, workflow `wp10-fleet-inventory-windows.yml`) or with `WP10_FLEET_E2E=1` on a disposable machine, because discovery also reads the real uninstall registry. They never scan a staff machine.
- **Real installed-workstation observation: NOT TESTED.** A fake-install run on a CI runner proves the instrument works; it must still be run and accepted on an actual authorised SASV workstation before relying on any inventory conclusions. RPC-only compatibility stays UNKNOWN without a trusted release manifest.
- Test with an existing legitimate SASV installed binary before fleet-wide use; report discovery misses (portable copy, renamed folder, older installer path) rather than widening the search to personal directories without approval.
- Do not modify the registry, collect per-person telemetry or mass deploy this utility under this PR.
- WP10 and WP12 OPEN; WP11 CLOSED; 11/13 formally CLOSED. Electron release HOLD; broad four-table authenticated DML remains a confirmed weakness; optional SQL PR #463 unapplied.

See [WP10 fleet and DML cutover gate](../../docs/master-data-costing/WP10_ELECTRON_FLEET_MIGRATION_AND_DIRECT_DML_CUTOVER_GATE_2026-11-17.md).
