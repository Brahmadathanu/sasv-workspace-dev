# WP05 W5-06 — Genuine authenticated Staff Governance acceptance

**Status: PREPARED, NOT EXECUTED.** No login, JWT, salary record, browser screenshot, or production write is included in this repository. This does not close W5-06.

## Preconditions

- Production site `https://sasv-utilities-hub.netlify.app` must still serve the v393 confidentiality client.
- Use a legitimate, **operator-controlled** signed-in session for **each** of: `cbm-view` (both existing view-only accounts, separately), `csr-view`, and `cbm-editor`. Do not create or alter accounts/permissions merely for testing.
- Capture each session **outside the repository** using `scripts/costing-acceptance/capture-storage-state.mjs` in a visible browser. It never asks for a password and stores the resulting session file in the operator's private local directory, mode 600 on Unix.
- Produce a separate private canonical permission proof for the exact same user, using a SELECT-only authorised extract of *all* `public.user_permissions_canonical` rows for that user. The file shape is `{"user_id_sha256_12":"<first 12 lower-case hex digits of SHA256(UUID)>","rows":[{"target":"module:cost-build-manager","can_view":true,"can_edit":false},...]}`. Its exact permissions must match the signed-in `get_user_permissions` result. Keep UUID and proof file **outside the repo**; never put passwords, tokens or UUIDs in command arguments, logs or PRs. No proof should be generated from an unidentified session.
- Ensure Playwright is installed in the local operator environment; do not attempt login inside GitHub Actions.

## Operator sequence (one account per run)

```bash
node scripts/costing-acceptance/capture-storage-state.mjs --base https://sasv-utilities-hub.netlify.app --out /private/w506/account1.storage.json
node scripts/costing-w506-conf-acceptance/live-staff-governance-acceptance.mjs --role cbm-view --storage-state /private/w506/account1.storage.json --canonical-proof /private/w506/account1.proof.json --out /private/w506/account1.result.json
```

Repeat for the second CBM view-only identity, a CSR-only costing viewer (`--role csr-view`) and the CBM editor (`--role cbm-editor`), using separate session/proof/result files. Substitute an appropriate secure directory for `/private/w506`; that example path is not expected to exist.

The runner only navigates to the Staff Governance screen; it does **not click any mutating control**. It intercepts browser requests using the existing Costing acceptance network allow-list and **aborts any non-read or unknown backend request**. It retrieves the signed-in account's own permission list, compares it against the private canonical extract and hash of the session user, and issues read-only PostgREST `HEAD` count requests for the register, review and pool views. For non-editor users it also makes one minimal `GET staff_details&limit=1` only to check whether the value is NULL; the actual response body is **never returned to Node or written to evidence**. For editor accounts it uses `HEAD` + `staff_details=not.is.null` to count authorised details without downloading them.

The acceptance report contains only a category label, boolean checks and generic failure categories. It does not contain tokens, UUIDs, staff identities, salary amounts or response bodies. A verified restricted user must see zero individual register/review rows and zero unmasked pool details while preserving positive aggregate rows. The authorised editor must retain positive register/pool counts and some accessible nested details. UI network observations must show **no individual personnel requests by restricted users**, no wildcard/raw salary-component projections in client personnel requests, and a recognised permitted module screen (CBM Staff Governance for CBM accounts; Cost Sheet Review for CSR-only). The approved CBM editor may request `total_salary_cost` and `salary_source_note`, but not basic/allowance/employer/other salary components or nested `staff_details`.

Exit codes: `0` all checks passed, `1` safety or access expectation failed, `2` bad invocation, `3` **NOT TESTED** (missing proof/session, browser or API failure), `4` **FAILED SECURITY** (unsafe/unknown network operation attempted). STOP on any nonzero exit. Never report `NOT TESTED` as PASS.

**After testing:** securely delete the private storage-state files, keep only redacted reports in restricted owner evidence, and follow existing test-account session revocation/rotation policy. No screenshots, protected rows or JWTs in GitHub.

## Boundaries and complementary checks

This dedicated acceptance is intentionally limited to the production browser's signed-in identity, selected Staff Governance navigation and server-side row/masking tests. It is **not** a comprehensive six-module acceptance; see `scripts/costing-acceptance/acceptance-runner.mjs`. It does not click Save/Close, does not prove action-button denial through user interaction, and does not inventory outside-repo BI/Edge Function consumers. These should be separately documented before W5-06 formal closure. No service-role impersonation or database permission mutation is allowed.

Pure-contract CI: `node --test scripts/costing-w506-conf-acceptance/live-staff-governance-acceptance.test.mjs`. CI must never run the real signed-in production acceptance or store session/proof files.
