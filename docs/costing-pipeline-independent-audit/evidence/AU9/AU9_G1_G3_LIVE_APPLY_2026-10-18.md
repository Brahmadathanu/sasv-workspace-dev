# AU-9 G1–G3 live apply (18 Oct 2026, 16:08 IST)
Approval: user, 16:07 IST: "Yes, apply G1–G3 live with the machine-delete block" (`USER-APPROVAL-20261018-AU9-G1G3`). Jarvis was notified by the parent.

**Method**
- Supabase MCP `apply_migration`, named `au9_g1_g3_capacity_master`, recorded as version **20261018103837** (16:08:37 IST).
- The file body was passed unchanged: `PREPARED_AU9_G1_G3_capacity_master.sql`, md5 6b3e6346e28d56ecef50ec5d6fdd602e, 72,978 bytes, committed in 76a8f4f. A copy is in `live/`.
- No `db push`. The file stays outside `supabase/migrations`.
- The in-migration prechecks and post-checks all passed (the call returned success).

## Before / after (read-only checks)
| Check | Before | After | Result |
|---|---|---|---|
| Run 122 full fingerprint (md5 of `fn_compute_run_fingerprint`) | 27459435…3ade | 27459435…3ade | identical |
| Run 122 `fn_verify_run_fingerprint` | 1/50 drift* | 1/50 drift* | unchanged |
| Run 122 basis snapshot, excluding the empty 18-Oct column | 059106b3…84c (= captured) | 059106b3…84c | identical |
| Run 128 fingerprint | f576397e…9cd5; verify 0/51 | f576397e…9cd5; verify 0/51 | identical |
| Pre-existing costing/public functions + views (1,550) | d1d4d3ec…51ec | d1d4d3ec…51ec | identical |
| Run-128 load factors (898) | b2188e1e…b9da | b2188e1e…b9da | identical |
| Refresh runs (108, max id 128) | 43ec1edd… | 43ec1edd… | untouched |
| Cost periods | 058389e8… | 058389e8… | untouched |
| Designations | 3 | 3 | untouched |
| Cron 60 / 61 | inactive / inactive | inactive / inactive | still paused |

\* This is the pre-existing drift from the nullable column added by 20261017235758; the values are unchanged (see G1_G3_LOCAL_TEST_REPORT.md §4).

## Created objects (verified)
| Object | Live |
|---|---|
| Applicability classes | 6 |
| Equipment classes | 33 |
| Plant capacity profiles | 171, all provisional, effective 2026-11-01 |
| Revision journal | 188 |
| Fallback policy | 17 (14 class default, 3 single load) |
| Guard / journal triggers | 8 |
| Grants | `authenticated`: SELECT only on all 6 objects |

**Applicability:** capacity-based production 136 · packing 10 · non-capacity 7 · utility 3 · UNKNOWN 15 (water tanks + Khalvam: open questions).

**Readiness:** BLOCKED_NEEDS_CAPACITY 133 · BLOCKED_UNCLASSIFIED 15 · NOT_REQUIRED 20 · NOT_OPERATIONAL 3.

**Behaviour change (approved):** hard-deleting a machine, or an area or section that cascades to machines, now fails with an FK error. Use retire (AU-8) when it is built.

No refresh, no cost change, no Sheets, no merge.
