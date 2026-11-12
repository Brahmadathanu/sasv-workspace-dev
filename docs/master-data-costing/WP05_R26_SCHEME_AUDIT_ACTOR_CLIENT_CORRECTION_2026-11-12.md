> **POST-MERGE SOURCE + CI RECONCILIATION — 12 NOV 2026:** PR [#306](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/306) squash-merged as `254a2d8ab0e75f321c8bc656bb65e25040da5ee4` after all six exact-head GitHub Actions workflow runs succeeded: actor-contract `43148589151`, PPM/W6 historical regression `43148588895`, confidentiality `43148589072`, CSR PWA freshness `43148588899`, offline costing `43148589011`, FG-BIT `43148589009`. W6 source pin changed **only** to reverse the exact imported actor helper and renderer reference when comparing with the immutable historical file. The new eight-check committed actor suite succeeded in CI. Issue #303 closed as *source fix completed*, but **hosted authenticated PWA, active-SW acceptance and Electron release remain NOT TESTED**; no PPM audit role-policy remediation/approval is implied. W5-06 OPEN, WP05 6/13. Any previous 'CI pending' wording below is historical pre-merge.

# WP05 R26 — Scheme Master History Actor client contract correction (12 November 2026)

**Scope:** separate issue [#303](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/303) within owner-approved D-2 subset [#297](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/297). **Client-only presentation fix, not an authorisation change.** Parent WP05 OPEN, programme 6/13. See R23–R25 for the independently open PPM audit reader-policy mismatch.

## Verified defect and chosen bounded remedy

- Live view catalogue `public.v_costing_scheme_master_audit` includes `actor_user_id uuid`, not `actor`, `event_actor` or `created_by`. The client `buildSchemeMasterHistoryHtml` previously read only those nonexistent aliases and therefore could not display an actor sourced solely from `actor_user_id`. This is a **confirmed source-contract mismatch**, not a claim about actual populated screen rows.
- The view has no display name or email field. We **do not** invent a person name, join personnel records, add a directory query or expand the live view/privileges. The display formatter retains an existing named legacy actor label when present, otherwise renders a reduced stable reference `Actor ID a1b2c3d4…cccc` for a valid `actor_user_id` UUID, or `--` when absent/malformed.
- `costing-suite-pricing-policy.js` imports `costing-suite-scheme-audit-actor.mjs` and renders the token through the existing `text(...)` HTML escaping function. The change touches no Scheme History reason, old/new value, approval-reference or write-guard logic.
- `public/sw.js` adds only the exact new child import path to the existing network-first/cached-offline fallback branch so an installed PWA does not serve a stale actor helper after the network-first parent updates. `hub-cache-v393` retained. No global feature flag changed.
- The source and module are shared by PWA and Electron; this records source parity, **not** proof of hosted SW activation, authenticated PPM data visibility, or an Electron build/release.

## Test scope and evidence

`node --test scripts/wp05-scheme-audit-actor/scheme-audit-actor.test.mjs`

The isolated formatter was exercised under Node v22.16.0 before repository integration: **6/6 pass** for valid UUID masking, missing/null actor, legacy label precedence, whitespace fallback, invalid/non-string UUID, stable tokens. The committed suite additionally has two source-contract checks for the parent renderer escaping and SW network-first registration; **eight-test full integration result must be obtained from the actual committed branch/CI before acceptance**, not inferred from the earlier six tests. All tests are synthetic; no production audit row accessed.

## Separate security gate

A visual Actor repair is **not** a fix for the non-invoker Scheme Master audit view's current four-module `fn_costing_view_allowed()` helper. PPM-only view access and non-PPM cross-module audit permission remain owner-policy/effective-role questions. No migration, GRANT, role provisioning, authenticated identity probe or writer RPC is in this package; W5-06 remains OPEN and security PASS must not be inferred from a client test.

## Release and gate state

Source merge, CI, hosted PWA cache freshness and signed-in behaviour are distinct evidence stages; this document claims no hosted deployment or v393 acceptance. AE1 frozen 13 P / 4 F / 2 NA / 21 NT preserved. W5-04, W5-06, W5-10 OPEN; formal programme 6/13.
