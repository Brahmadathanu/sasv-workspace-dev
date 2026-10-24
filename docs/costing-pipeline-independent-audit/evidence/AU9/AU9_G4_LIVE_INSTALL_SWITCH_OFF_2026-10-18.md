# AU-9 G4 plant-aware loads: live install, switch OFF (18 Oct 2026, 21:19 IST)
**Approval.** User, 21:17 IST: "install G4 live with the switch OFF". Jarvis was notified by the parent.

**Not done** (not approved): no switch-on, no trial run, no cron change, no refresh.

**Method**
- Supabase MCP `apply_migration` named `au9_g4_plant_aware_loads`, recorded as **20261018154911** (21:19:11 IST).
- File passed unchanged: `PREPARED_AU9_G4_plant_aware_loads.sql`, md5 97a210fa45d484e6943eb4893e00e123, committed in 5fe478b. A copy is in `live/`.
- In-migration prechecks and post-checks passed.
- The read-only check queries are in `live/au9_g4_*.sql`.

| Check | Before | After | Result |
|---|---|---|---|
| Run 122 full fingerprint | 27459435…3ade (verify 49/50*) | same (49/50*) | identical |
| Run 122 basis, excluding the 18-Oct column | 059106b3…d84c (= captured) | same | identical |
| Run 128 fingerprint | f576397e…9cd5 (verify 51/51) | same | identical |
| All other functions and views (1,552, excluding the 2 patched RPCs and the new G4 functions) | 132a4718…f625 | 132a4718…f625 | **identical** |
| Overhead refresh RPC | 3087b71e… | 9a87d927… | changed **as reviewed** (= patched md5) |
| Labour refresh RPC | 3b68b6aa… | 653f851c… | changed **as reviewed** (= patched md5) |
| New G4 functions | 0 | 5 (execute: owner only) | as designed |
| Run-128 load factors, recomputed from step snapshots at 16 Oct and 30 Nov (898) | old path: 0 mismatches, 8d8ec7ab…eefde | **patched G4 path: 0 mismatches, 8d8ec7ab…eefde** | identical |
| Stored run-128 load rows / class-load recompute (25,144) / route capacity table | 645ad3d2… / 214ae952… / f2f655f9… | same | identical |
| Switch | — | **0 rows; mode OFF on 30 Nov 2026** | OFF |
| Step rules | — | 9 open, effective 1 Nov 2026 (journal +9 CREATE) | as designed |
| Provenance rows | — | 0 (table is run-scoped; runs 122/128 have none) | as designed |
| Runs (108, max 128), capacity profiles (298/171 open), readiness 74/74/3/20 | — | unchanged | untouched |
| Cron 60 / 61 | paused | paused | unchanged |

\* Pre-existing drift from the column added by 20261017235758; the values are unchanged.

**Patched calls.** Each RPC now makes 2 load calls through `fn_au9_g4_route_step_loads`.

One legacy call stays in each, by design: the AU-6L fail-closed class check.

**Cost effect.** None: while the switch is OFF, the wrapper returns the legacy loads.

**Still pending user approval, when November inputs are ready:**
1. Switch ON from 1 Nov 2026.
2. A job-61 window for a trial non-designated November run.
3. Review of the trial's provenance and its comparison with the local test.
