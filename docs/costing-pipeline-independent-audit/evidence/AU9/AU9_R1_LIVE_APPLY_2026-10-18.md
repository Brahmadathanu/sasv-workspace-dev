# AU-9 R1 capacity revisions: live apply (18 Oct 2026, 16:31 IST)
Approval: user, 16:29 IST: "apply the 50 capacity revisions live and approve the grinder rule (Grinding 8 kg, Kajjali 2 kg, rest default)". Jarvis was notified by the parent.

**Method**
- Supabase MCP `apply_migration` named `au9_r1_capacity_revisions`, recorded as **20261018110111** (16:31:11 IST).
- File passed unchanged: `PREPARED_AU9_R1_capacity_revisions.sql`, md5 6e1bd6897ac948d562aff8c3b728b49a, 25,848 bytes, committed in e77932e. A copy is in `live/`.
- No `db push`. In-migration prechecks and post-checks passed.

| Check | Before | After | Result |
|---|---|---|---|
| Run 122 full fingerprint | 27459435…3ade (verify 1/50*) | 27459435…3ade (1/50*) | identical |
| Run 122 basis, excluding the empty 18-Oct column | 059106b3…84c | 059106b3…84c | identical (= captured) |
| Run 128 fingerprint | f576397e…9cd5 (verify 0/51) | same | identical |
| Functions + views (1,554) | 6c463b7e…34c7 | 6c463b7e…34c7 | identical |
| Run-128 load factors (898) | b2188e1e…b9da | same | identical |
| Runs (108, max 128), periods, designations (3) | — | — | untouched |
| Cron 60 / 61 | paused | paused | unchanged |
| Readiness | 133 needs value / 15 unclassified / 3 / 20 | **34 ready-provisional / 0 unclassified / 114 needs value** / 3 not operational / 20 not required | as expected |

\* Pre-existing drift from the column added by 20261017235758; the values are unchanged.

**Revised (50 open rows, all provisional, effective 1 Nov 2026)**

| Machines | Revised profile |
|---|---|
| Grinders 4–34 | 8 kg rated / 8 kg working |
| Stone grinders 41–44 | 2 / 2 kg |
| Mechanised khalvam sets 45–46 | 2 / 2 kg (new class) |
| Fermentation tanks | 11 × 1,000 L and 2 × 500 L rated; working volume pending |

**Totals after the apply**
- Profiles: 221 (171 open + 50 voided before effect).
- Journal: CREATE 188 / CLOSE 50 / SUPERSEDE 50.
- Equipment classes: 36 (34 active).
- Constraint `pcp_dates` is now `effective_to >= effective_from`.

No costs changed (costing does not read these tables until G4). No refresh, Sheets or merge.

**Grinder fallback rule:** approved by the user and recorded as P24 (APPROVED-NOT-BUILT, for G4).
