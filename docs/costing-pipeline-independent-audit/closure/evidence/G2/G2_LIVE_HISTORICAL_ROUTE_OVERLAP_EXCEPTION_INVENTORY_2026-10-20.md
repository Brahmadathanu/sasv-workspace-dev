# G2 LIVE READ-ONLY historical-route overlap audit — 20 Oct 2026

**New HIGH blocker to naive historical status broadening. No data writes.**

On non-archived routes, count statuses: family 87 APPROVED, 18 SUPERSEDED; product 107 APPROVED, 9 SUPERSEDED.

A read-only self-join using inclusive date ranges and status IN (APPROVED,SUPERSEDED) revealed **10 overlapping family-route pairs and 7 overlapping product-route pairs**. The existing database GiST exclusions apply only where status=APPROVED; they do not exclude intersections with SUPERSEDED.

Family pairs by family ID: 32 (34/38), 33 (35/39), 34 (36/40), 35 (37/41), 68 (105/106), 94 (132/137), 95 (133/138), 96 (134/139), 97 (135/140), 98 (136/141). Nine are same-day closed predecessor/approved successor inclusive at 2026-08-24 or 2026-08-30. Family 68 105 SUPERSEDED has open-ended effective_to, overlaps 106 APPROVED from 2026-08-28.

Product pairs: product 752 (178/187), 758 (179/188), 759 (180/189), 957 (72/73), 985 (174/183), 1005 (175/184), 1011 (176/185). Six pairs have open-ended SUPERSEDED predecessors overlapping APPPROVED successors from 2026-08-28; product957 72/73 has the same-day 2026-08-25 inclusive boundary.

**Decision:** Previous candidate of simply extending historical resolver predicate to SUPERSEDED is **not safe**. It would expose ambiguous route matching on actual recorded dates. Do not silently select the higher version or patch historical effective dates without source/provenance review. Investigate how these records were created, whether their as-of periods encode actual operational applicability versus bootstrap supersession, and compare immutable historical snapshots. Adopt fail-closed treatment with explicit exception inventory and approved correction policy. No production writes or migration.

G2/CI-032 HIGH OPEN, additional historical-overlap stop gate. Route144 and run122/128 unchanged.
