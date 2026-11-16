# WP10 → WP12 receiving cases: pre-submit impact preview

**NOT TESTED by the WP10 draft package.** All results in the draft PR are isolated PostgreSQL and mocked Chromium. These cases carry the preview's real-role, hosted, cache and release obligations into WP12; none is PASS until performed under separate owner authority. They add to, and never replace, every existing WP12 security/PWA/hosted/Electron/Windows obligation. WP10–WP12 OPEN; programme 10/13.

| ID | Case | Needs | Status |
|---|---|---|---|
| WP10-PV-1 | Real Manage Products editor (View+Edit) sees the preview for a changed sub-group on an existing product; a View-only user cannot reach the editor; a user without Manage Products View gets "Permission denied" from the endpoint (not a zero-impact answer) | real identities, applied proposal 06 | NOT TESTED |
| WP10-PV-2 | Preview against real data: stored-context result equals what the canonical validator reports for the same product/date; proposed result for a sub-group in a different group; product-map precedence; a product route whose family differs at its own effective-from date | applied 06 on a production-like database, read-only | NOT TESTED |
| WP10-PV-3 | Absent endpoint (06 not applied) shows the explicit "not available" text in the hosted PWA and the installed Electron/Windows client; save still works | hosted + installed clients | NOT TESTED |
| WP10-PV-4 | Cache/release: after a deploy, an installed PWA with the old shell cached loads parent and helper with matching `?v=` tokens; an old cached helper is not paired with a new parent; flag OFF behaviour is byte-identical | installed controller, two releases | NOT TESTED |
| WP10-PV-5 | Preview followed by the authoritative writer: favourable preview then a server rejection (proposal 05) is shown without any success claim; UNKNOWN/ROUTE_LOSS never block by themselves in the client | real writer, applied 05 | NOT TESTED |
| WP10-PV-6 | Read-only: repeated previews change no business/audit/epoch fingerprint on the real database; `BEGIN READ ONLY` works | applied 06, operator with read access | NOT TESTED |
| WP10-PV-7 | Measure preview latency/lock behaviour on production-scale route data and establish the actual role/PostgREST query timeout. The SQL file's `SET LOCAL statement_timeout = '30s'` limits its installation transaction only; it does not establish a persistent endpoint timeout. | separately authorised production-scale read-only run and timeout configuration review | NOT TESTED |
| WP10-PV-8 | Mobile (390) and desktop (1280) layout on real devices, retaining the inherited WP11 PM BOM mobile overflow and SKU Deactivate contrast defects (not hidden, not fixed here) | real devices | NOT TESTED |

Execution of any case needs a separate exact owner decision; the SQL application manifest (`WP10_G2_UNAPPLIED_SQL_APPLICATION_MANIFEST_2026-11-15.md`) is not permission to apply.
