# G2 historical route overlap: completeness gate (20 October 2026)

Status: G2 OPEN, live read-only only. This checkpoint does not claim a new scan passed.

Prior verified inventory: 10 family-route overlapping pairs (families 32, 33, 34, 35, 68, 94, 95, 96, 97, 98), and 7 product-route overlapping pairs (products 752, 758, 759, 957, 985, 1005, 1011). These arise when both APPROVED and SUPERSEDED are considered and inclusive date ranges overlap. Several old versions are open-ended. Previously inspected frozen runs 122 and 128 contained selected successors, but only sampled attribution was checked.

Fresh read-only queries for the full lineage and successor linkage were blocked in this checkpoint, including a one-family query. Thus the following are NOT certified: all 17 predecessor lineage links, earliest historic route usage, whether each overlap is operational versus bootstrap, and all-run predecessor attribution.

Gate before candidate repair: recover database read access, execute a complete pair-wise lineage report and all-route snapshot attribution across frozen runs, classify same-day vs open-ended cases, determine whether dates permit any unambiguous old-route period, preserve status and approval provenance without editing history, and test fail-closed ambiguity. Do not blindly add SUPERSEDED to resolver predicates. No live changes.
