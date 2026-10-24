# AU-9 R2 corrected capacities: live apply (18 Oct 2026, 20:15 IST)
Approval: user, 20:11 IST: "apply R2 live, throughput machines on the 50 kg lot (T1), Kajjali on the 3.2 kg Khalvam, grinder rule v2". Jarvis was notified by the parent.

**Method**
- Supabase MCP `apply_migration` named `au9_r2_capacity_corrections`, recorded as **20261018144534** (20:15:34 IST).
- File passed unchanged: `PREPARED_AU9_R2_capacity_corrections.sql`, md5 9b2877c762f72b36a5eb0a32b3eca9a9, 35,112 bytes, committed in cf9334a. A copy is in `live/`.
- No `db push`. In-migration prechecks and post-checks passed.
- The before/after check query is `live/au9_r2_live_check.sql` (read-only).

| Check | Before | After | Result |
|---|---|---|---|
| Run 122 full fingerprint | 27459435…3ade (verify 49/50*) | same (49/50*) | identical |
| Run 122 basis, excluding the 18-Oct column | 059106b3…d84c (= captured) | same | identical |
| Run 128 fingerprint | f576397e…9cd5 (verify 51/51) | same | identical |
| Functions + views (1,554) | 6c463b7e…34c7 | same | identical |
| Run-128 load factors (898 rows; scaled factors and full rows) | 8d8ec7ab…eefde / 645ad3d2…57a6 | same | identical; equals the local replay hash |
| Load recompute at 16 Oct and 30 Nov (25,144 values) | 214ae952…6c118 | same | identical |
| Route capacity table | f2f655f9…78a8 | same | identical |
| Runs | 108, max 128 | same (md5 f7a1ad04…) | untouched |
| Cron 60 / 61 | paused | paused | unchanged |
| Readiness | 34 provisional / 114 need value / 3 / 20 | **74 provisional / 74 need value / 3 not operational / 20 not required** | as expected |

\* Pre-existing drift from the column added by 20261017235758; this is the same 1/50 as before.

**After the apply**
- Profiles: 298 (171 open).
- Journal: CREATE 188 / CLOSE 127 / SUPERSEDE 127.
- Equipment classes: 40 (36 active). DISINTEGRATOR, SEMI_AUTO_PULVERISER, VIBRO_SIFTER_HORIZONTAL and VIBRO_SIFTER_ROUND were added; PULVERISER_DISINTEGRATOR and VIBRO_SIFTER were retired.
- All 77 R2 rows are provisional, effective 1 Nov 2026, with no hours per load.

| Machines | Capacity |
|---|---|
| Rasoushadhi grinders 4–34 | 20 kg |
| Stone grinder 41 | 10 kg (the first one; **assumed**) |
| Stone grinders 42–44 | 5 kg |
| Khalvam sets 45–46 | 3.2 kg |
| Pills grinders 68–80 | 3 kg |
| Pills stone grinder 81 | 3 kg (**assumed**) |
| Wet grinder 174 | 2 kg |
| Fermentation tanks | 11 × 1,000 L and 2 × 500 L, at full capacity |
| Disintegrator | 28.33 kg/h |
| Pulverisers | 5 kg/h |
| Horizontal sifters | 9.43 kg/h |
| Round sifters | 1.1 kg/h |

The throughput figures are planning values only.

No costs changed: costing does not read these tables until G4. No refresh, Sheets, merge or deployment.

**Approved for G4, not yet built:**
- P26, grinder rule v2: 20 kg grinding; Kajjali on the 3.2 kg khalvam; Pills grinding 3 kg; wet grinder 2 kg.
- T1: pulverising, disintegrating and sieving steps stay on the 50 kg lot, with no time basis.
- P26 supersedes the 16:29 rule (P24).
