# MDC-07 / WP07 — P5 history navigation contract clarification (14 November 2026)

**Governance:** documentation-only interpretation. WP07 remains **OPEN**; programme remains **7/13**. The observed 14 November P5 **FAIL against the wording of the 13 November post-fix addendum is preserved** and is not reclassified as an executed PASS.

## Source records
- Original WP07 owner checklist: `MDC07_WP07_OWNER_READ_ONLY_ACCEPTANCE_CHECKLIST_2026-11-12.md`.
- Bulk verification: `MDC07_WP07_BULK_VERIFICATION_AND_CLOSURE_EVIDENCE_2026-11-12.md`.
- Post-fix manual checklist (P5): `MDC07_WP07_POST_FIX_ACCEPTANCE_ADDENDUM_2026-11-13.md`.
- Actual authenticated observation: `MDC07_WP07_AUTHENTICATED_POST_FIX_ACCEPTANCE_EVIDENCE_2026-11-14.md`, §5.
- Tracking: issue #367, P8 presentation follow-up #395.

## Discrepancy
The post-fix addendum P5 stated: from the explicitly scoped Workload URL, **click a different lens pill**, then Back/Forward, and expect the scoped state to return. On 14 November the browser instead recorded `replaceState` (no `pushState`), with Back exiting the module; that is **FAIL against P5's literal expectation**.

However, the older owner checklist B4 explicitly states that **in-page pill clicks do not create history entries (existing behaviour)**. C10 tests Back/Forward over **three separately opened `?lens=` URLs**, with the active destination following the URL. The bulk verification also documents `replaceState` for pills and says the behaviour is not an N1 regression. Accordingly, P5's expected history restoration after a *pill click* conflicts with the older contract.

## Disposition and conforming verification
- Treat **P5 as an addendum test-authoring / expectation mismatch**, *not as proof of a new navigation regression*. Retain the observed FAIL in the immutable 14 November acceptance record.
- **Do not change the application's `replaceState` / `pushState` behaviour** or the N1-protected shell merely to make the mismatched P5 pass.
- If further PRM-specific signed-in evidence is wanted, open three explicit PRM `?lens=` URLs as separate browser navigation entries, then Back, Back, Forward, checking URL, active lens and context for each step. Record that as a **new distinct test**, not a retroactive P5 PASS. This exact PRM test remains **NOT TESTED** in the 14 November run.
- The separate P8 context-chip issue remains **OPEN** (#395). A successful #380 data-filter retest does not imply N4 chip presentation is accepted.

No application files, user permissions, browser flags or production data are changed by this clarification. Formal WP07 closure and acceptance of outstanding residuals require an explicit owner decision.
