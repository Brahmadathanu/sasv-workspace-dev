# Authoritative architecture simplification and hard-retirement directive
**Decision:** USER-DIRECTIVE-20261020-LEAN-ARCHITECTURE. **Status:** Binding design instruction; implementation NOT YET EXECUTED. Applies to the standalone costing-pipeline-independent-audit closure programme, NOT other Costing Suite/WP07 programmes.

## Business principle
Build only necessary, maintainable, resilient, auditable, future-proof costing architecture. Minimise dependencies and run-failure modes. Do not proliferate policies, switches, tables, views, redundant bridges or exception layers merely to preserve an obsolete design. When replacing an architecture, **hard remove obsolete executable paths and unused objects** after dependencies, historical-run immutability, migration/ETL/rollback and consumer impact are proven. Do NOT retain dual active old/new implementations or unexplained architectural remnants. Historical audit evidence, approved snapshots, immutable migration history and lineage are NOT obsolete debris and must be preserved. Hard removal is a future separately approved and tested migration; NOT an instruction to drop production objects now.

## Non-negotiables
1. `public.production_batch_size_ref` is the already enforced **standard manufacturing batch** source and must not be treated as an anomaly or overridden due to observed high workloads.
2. Manufacturing labour and production overhead allocations are based on justified manufacturing workload, not current sales. Physical machine working charge is an optional intermediate driver where it correctly explains genuinely repeated charge-dependent operations; total eligible workload is the shared-pool allocation denominator. Machine rated throughput (kg/h, Nos/h) belongs to planning, not a kg/charge monetary allocator (P28).
3. Avoid universal equipment capacity requirements. Categorise route activities by: (a) fixed per validated batch/occurrence; (b) valid physical machine charge for truly repeatable operations; (c) planning-only throughput. This three-mode scheme is an architectural **proposal requiring tests and change authorisation**, not an activated policy. If a simpler equivalent accounting invariant is demonstrated, prefer that.
4. Any previously class-scaled MANUAL, DRYER, GRINDER, vessel, etc. step must be checked for real process stage input and physical charges; stage input may differ from finished batch. Separate occurrence and cycle scaling, never double count. No fabricated capacities, cost-balancing plugs or concealed fallback.
5. The 74 missing machine profiles are NOT automatically 74 financial blockers. Determine which machines are actually required for the chosen costing driver. Capacity planning can continue separately and must not gate costing without evidence of a genuine dependency.
6. Keep existing approved runs 122/128, fingerprint, period locks and historical comparisons immutable; prospective new valuation only through governed approval. DVS-1 and G4 switches OFF; cron jobs 60/61 inactive. No price revision or Sheets until G6.
7. Before every hard deletion: inventory references (functions, views, triggers, RLS/grants, ETL, client, cron, tests, migrations); provide dependency graph, old->new contract, performance and regression proof, historical audit strategy, data retention/rollback strategy; patch consumers; deploy with a separately authorised plan; confirm no obsolete live executable paths or dangling references. Supabase migrations are append-only evidence; never delete historical applied migration records.
8. Do not delete valid production planning capacity data or approved evidence in the name of simplicity. Separate **data worth retaining** from **redundant executable architecture to retire**.

## Investigation findings so far (verified read only)
- Run128 G1 arithmetic reconciles including internal material conversion.
- Dhanyamlam product51: route144 inherited, standard batch1155 L; 8 occurrences x8 cycles at certain steps, 3 class loads.
- Karkkidaka Kanji product695: route154 inherited, standard batch50000 Nos, approved 0.5 kg/unit; legacy load 500 on seven steps (six nonzero DL factors), dryer machine119 missing capacity.
- Thippili Rasayanam product957: approved product route73 and overrides, 770 kg standard batch; class grinder/dryer x16 and named mixer125 missing capacity.
- Named Disintegrator machine2 is 28.3333 kg/hour planning-throughput, not kg/charge.
- Legacy class defaults: MANUAL=50 kg, GRINDER=50 kg, DRYER=50 kg, MIXER=200 kg, vessels output-based. All 17 future G4 fallbacks currently permitted, risking apparent success with unverified capacities.
- G4 resolver and mode selector both hard-gate 1 Nov 2026; product-level solid/output inputs not physical per-stage charge inputs. No stage-charge correction deployed.
- Repo progress G0 DONE; G1 VERIFIED; G2 OPEN; G3 DVS-1 installed OFF, policy decision work OPEN; G4 W2 installed but G4 OFF and CI012/CI034 prepared; G5 NOT STARTED; G6 NOT READY.

## Required next work / retirement method
A. **Design minimisation gate:** inventory current legacy and G4 objects plus read/write consumers. Prove actual functionality required for correct cost pool spread. Classify each current function/table as KEEP / REPLACE / HARD-RETIRE / HISTORICAL-PRESERVE / PLANNING-ONLY. Estimate blast radius and loss-free transition. Keep independent downstream systems untouched.
B. **Minimal implementation:** choose smallest auditable driver and bounded data model, unit-safe per step. Run deterministic tests on 51/695/957, high labour concentration, missing machine, and normal products; explain absolute and relative allocation effect. Ensure every eligible cost pool conserves value, no zero/unallocated orphan and no duplicate cost.
C. **Plan hard removal:** retire superseded runtime objects and branches via controlled migration once dependents are cut over. Avoid dual active legacy and replacement paths. Preserve immutable runs and required compatibility to query historical snapshots.
D. **Gate authority:** read-only evidence, design, isolated SQL/tests and repo doc commits allowed. Live migration, object drop, switch/policy effective date, cron, run, period, merge and deployment require express user approval before execution.
E. **Parallel documentation:** update PROGRAMME.md, IMPLEMENTATION_RULES.md, decision log, issue register, changelog and index as steps complete. Show accurate VERIFIED vs PREPARED vs APPLIED statuses; concise workflow recap after each interaction.

**Release criterion:** demonstrably simpler, auditable, low-maintenance costing route engine with no unwanted active remnants and preserved historical integrity, not maximum physical machine modelling.
