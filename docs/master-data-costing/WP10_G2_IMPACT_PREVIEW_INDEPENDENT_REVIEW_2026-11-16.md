# WP10 G2 impact preview — Independent review (16 November 2026 IST)

**Corrected source pending fresh CI execution. PR #442 stays draft. WP10 OPEN; programme 10/13. No source merge, SQL application or flag activation authority is inferred.**

Reviewed author head `af2070014a8bcc218e86e248f8ee08370da0bfba`, base main `38f61c34c39df9ca7dd4b2697ddeaf21f84d262b`. All author-head checks were green. The independent correction below is on the same PR branch, not a new client assignment.

## Source/SQL review

Proposal 06 is mechanically derived from the committed captured functions. Named/count-checked substitutions propagate proposed-subgroup context through both outer selectors and the product validator's family lookup at the route's effective-from date. Product-map precedence, proposed subgroup's group, effective windows, route-version ordering, product-route ambiguity, inherited routes, overrides and fixed per-route validation dates remain canonical. The three reused callees are fingerprinted, and generator/parity/static checks cover the derivation. The RPC checks identity/Manage Products View, uses a statement-stable read snapshot and returns non-authoritative structured states; no business write/dry run is used. All SQL remains unapplied.

Absence checks, prerequisite/live-definition fingerprints, receipts and fail-closed rollback include 06. The generated application manifest matches committed SQL hashes. It is an application proposal, not execution permission or proof of production performance/security/real-role acceptance.

Fresh local reviewer checks before/after the bounded client correction: client units 14 PASS, source/safety 11 PASS, SQL static/generator/manifest 25 PASS. Browser and PostgreSQL execution will be taken from exact-head CI, not fabricated from this environment's unavailable binaries.

## Additional client findings and corrections

| ID | Finding | Correction / regression |
|---|---|---|
| IR1 | `wp10ProductAttemptValid` checked selected product/subgroup/access but did not compare the full product draft or loaded state. Changing name/status/PTO while import/confirmation was pending could silently replace the displayed save summary with a different payload. The draft was rebuilt from the form immediately before the write. | Capture canonical draft and loaded-snapshot signatures plus editing state. Revalidate these after import, on preview rendering and before the writer. New IR1a/IR1b tests cover import-time changes, name/status/PTO changes and a fresh retry. IR-M1 removes only draft validation and demonstrates the unconfirmed replacement reaching the writer. |
| IR2 | The reservation check was inside the changed-subgroup branch. While a preview was pending/open, changing back to the stored subgroup and submitting again took the non-preview branch and could attach another listener to the shared confirmation controls. | Check a pending product attempt at entry, before classifying a new submission. The flag-ON governance dialog also refuses a second owner of its shared controls, covering ordinary saves and other governance callers. IR2a/IR2b cover pending/open reclassification; IR3 covers repeated ordinary saves. IR-M2 removes the two relevant protections and demonstrates the second save writing. |

These are source-level control-flow findings; the new mocked-controller tests/mutations must execute successfully in CI before a merge recommendation. Existing M2 now removes the added shared-dialog protection too; otherwise it no longer creates the duplicated-dialog fault it is intended to detect. This is a documented defence-in-depth mutation adjustment, not a runtime exemption. Flag-OFF behaviour is unchanged.

The correction changes only `products.js`, the preview browser regressions and review documentation. Helper contents, content-hash token `6b42977628`, generated SQL, application hashes, grants-as-text, SW and migrations are unchanged.

## Remaining gates

Run exact-head WP10 offline CI (expected preview Chromium suite now 30 checks, with every existing suite retained) and integrated-pec. Record actual totals/artifacts and an independent verdict before requesting an owner source-merge decision. No source approval for #441 is reused as approval for #442.

Production-scale performance, real identities, installed PWA/cache activation/offline, hosted resolver and packaged Electron/Windows remain NOT TESTED. The SQL manifest is not production authority; no query against the production project was needed to repeat completed catalog work. WP08/PEC stay closed, WP09 closure/flag unchanged, WP11 defects and all WP12 receiving cases retained. G1 bounds and known baseline failures remain; five historical CRLF-only migration differences untouched and unstaged.
