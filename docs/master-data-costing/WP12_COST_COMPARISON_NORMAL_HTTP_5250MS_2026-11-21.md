# WP12 — owner-observed default-OFF Cost Comparison normal-use HTTP receipt (21 November 2026 IST)

**WP12 OPEN; 12/13 formally closed.**

## Owner-provided genuine Chrome Network observation
The owner submitted: **"WP12 Cost Comparison normal November 2026 load: endpoint=view, HTTP status=200, duration=5250 ms, UI result=loaded."**

The user was instructed to use a legitimate existing Cost Sheet Review View-only session, the normal Cost Sheet Review → Cost Comparison screen and Chrome Network metadata, opening November 2026 once. This is an **owner-reported** normal-use observation; the assistant did not control or independently inspect the browser session, network response or authenticated identity. No sensitive values, headers, URLs with filters, cookies, JWTs or response bodies were collected.

| Receiving field | Observed |
| --- | --- |
| Period | November 2026 |
| Path category | governed base comparison view (`v_cost_sheet_snapshot_sku_monthly_comparison_governed`) |
| HTTP status | **200** |
| Network duration | **5,250 ms (5.25 s)** |
| Visible result | **Table loaded** |
| Client-side scoped comparison RPC flag | NOT DIRECTLY INSPECTED (the reported endpoint is consistent with OFF path) |
| Timing sample count | **ONE**; not a p95 or stability measurement |

**Interpretation:** The ordinary base-view path **PASS** for a successful single real-world read. The measured **5.25 s exceeds 4.0 s** for this one request, so the specific observed sample does NOT meet a per-request 4s target. This does **not** demonstrate the p95 ≤4s threshold passes or fails, and does not establish an intermittent timeout is resolved across all devices. Prior genuine timeout/500 evidence remains historical and is not erased by a single 200. No repeat or load testing was performed.

The earlier owner-reported post-ANALYZE November visible success remains credited separately. Planner statistics live as at previous read-only audit: `last_analyze=2026-11-17 15:58:48 UTC`, `n_mod_since_analyze=0`. No new database maintenance is justified by this observation alone.

## Next WP12 gate
**R3:** In the same legitimate signed-in browser, read (not change) active service-worker/controller/cache and each of eleven browser-local Costing feature-flag states, including the comparison flag. Use only supported Chrome Developer Tools; no script that changes storage, no flag ON, no new session, no privileged data requests. Record names/status/worker version only; avoid dumping all localStorage or auth tokens. Where browser capability disallows inspection, mark NOT TESTED. The live ON/ALL-ON feature rollout is separately gated and not implied.

**R4 future owner decision:** determine whether p95 ≤4s remains strict WP12 closure condition or is accepted as a monitored reliability objective with owner and milestone (e.g. issue #273); current 5.25s sample and old timeouts must be explicitly considered. Do not label 4s p95 PASS. Separate seven-view receiving recorded 7/7 bounded 200/empty no disclosure; no explicit HTTP denial proven.

No new SQL, index, view rewrite, flag mutation, master-data write, migration, PR merge, Electron release or installer operation was performed. Storage, selected-scheme and cleanup programmes remain parked.
