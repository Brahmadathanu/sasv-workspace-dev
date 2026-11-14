# MDC-07 / WP07 — current-main closure gap audit (12 November 2026)

**Status: evidence reconciliation only; WP07 remains OPEN, programme 7/13.** This file does not authorise flag activation, production SQL, writer/preview calls, permissions, PWA/Electron deployment, or an owner sign-off.

## Pinned source and scope

- Latest GitHub `main` checked against handover SHA `3a93432713bf86203d1e0c6ad5ebac1ce34a2413`: **identical (ahead 0, behind 0)**.
- Read authoritative `COSTING_PROGRAMME_NEW_CHAT_HANDOVER_AFTER_WP05_R63_2026-11-12.md`, `MASTER_PROGRAMME.md`, `WP-07-COSTING-NAVIGATION.md`, WP05 R62/R63 and `WP-12-REGRESSION-AND-DOCUMENTATION.md`. WP05 is **CLOSED WITH BOUNDED RESIDUALS**; six-module View-only account restored. WP12 B1-T2/T3 retains final integration; B1-T1 receives zero individual lenses.
- **Merged/visible client scope:** N1 #133; N3 #134; N2 #136 (+ guard #138); N4 #135; W6 #139. Earlier WP07 body says W6 draft awaiting review, but its 3 Nov authoritative banner records it merged; retain historical paragraphs, do not represent them as current.
- **U11 was also implemented, contrary to older WP07 gate copy.** PR #144 is titled “U11 sentence-case review-worklist status labels.” `public/shared/js/costing-status-labels.js` on current `main` has `COSTING_CONTROL_STATUS_DISPLAY_LABELS` for precisely four first-control status codes; `scripts/costing-ux-consistency/u11-control-status.test.mjs` is present and asserts flag-OFF legacy labels, exact-`1` flag-ON labels, raw-code/group invariance, unknown-code fallback and historical source strip. PR #144 recorded LF/CRLF 610/610 at its tested branch head; **this audit did not rerun those tests or independently verify their CI on today's `main`**.
- Existing N1–N4/W6 combined automated baseline is recorded in WP07 as LF/CRLF 605/605, 0 skips, 61 Chromium tests per platform; dated pre-merge/test-tree equivalence, **not today's post-main regression run**. Later PR #144 610/610 is a scoped source claim, not proof of hosted signed-in functionality.

## Exact remaining WP07 closeout gate

| Gate | Evidence available | Current classification / next safe action |
|---|---|---|
| Tier-1 N1–N4/W6 code integrated | Historical merged SHAs, scope guards and mock Chromium suites documented in WP07 | **SOURCE RECORDED / MERGED**. Verify current main with full-history isolated LF/CRLF Node/Chromium suite; inspect failures rather than inferring pass |
| U11 terminology | Current-main helper and focused test present; PR #144 branch report 610/610 | **IMPLEMENTED / NOT RECENTLY RERUN**. Include focused U11 test in current-main rerun; reconcile WP11 UX ownership, do not duplicate work |
| Security and flag-OFF parity | Default-OFF source contracts and historical 96-link parity plus role-aware trace browser harness | **HISTORIC ISOLATED EVIDENCE**. No automatic extension to real signed-in permissions; preserve all existing guards |
| Real signed-in WP07 navigation | No new authenticated six-module ON, restricted role, deep-link/selected-context and populated-data acceptance in this audit | **NOT TESTED**. Plan a narrow read-only owner-operated/authorized session on exact hosted build only; no global flag enablement |
| Independent WP07 reviewer and owner gate | No new formal WP07 acceptance or owner closure instruction | **OPEN**. Request targeted review of source/test/acceptance results, disposition only demonstrated regressions, then an explicit owner closure decision |
| WP12 final build | B1-T2 11-flag integration; B1-T3 final PWA/Electron/Windows and responsive routes | **RECEIVED / OPEN under WP12**; must not be required to run prematurely or declared PASS as a WP07 mock test |

## Fast safe execution order

1. Perform an isolated full-history checkout of the exact main SHA; run `node --test $(find scripts -name '*.test.*' | sort)` on LF and CRLF, with Playwright actually available and zero unexpected skips; run focused U11 and navigation tests, reconcile suite counts/known legacy scripts. No production access needed.
2. Independently review navigation groups, MCM trace fail-closed, PRM identity hydration, PPM legacy workspace routes, reverse cross-links, and four U11 labels. Prefer small scoped fixture fixes only for demonstrated faults; preserve shared `public/shared` ownership.
3. Prepare WP07-specific authenticated, **read-only**, exact-build acceptance checklist: role-limited visibility, ON/OFF NAV_GROUPS plus N4 context, six module journeys and back/forward, PPM legacy links, fixed-historical versus LIVE_AS_OF, 390/1280, no mutation; do not use existing trial account to change permissions without approval.
4. Reconcile WP07 formal milestones and owner gate **only after** actual evidence and owner decision. Advance WP08 G1 navigation path inventory while pending; leave WP12 release evidence in WP12.

## Non-regression and boundary

Do not reopen accepted WP05 work absent a concrete regression; do not replay #355 R57 SQL or test privileged PRM previews. R62 fourteen residual receiving entries remain binding. Approved September/October costing runs, pricing policies, rights and default-OFF flags are untouched. This audit is documentation only; no fresh tests, hosted browser action or CI pass is claimed.
