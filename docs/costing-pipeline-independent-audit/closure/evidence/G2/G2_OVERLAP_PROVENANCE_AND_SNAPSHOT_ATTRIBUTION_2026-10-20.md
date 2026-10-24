# G2 route overlap provenance and frozen snapshot attribution — 20 October 2026

Read-only source evidence. No live changes.

Family32 v2/34 and v3/38 were approved 18 minutes apart on 2026-08-24 and overlap that whole day. Family68 v1/105 and v2/106 were approved around 54 minutes apart on 2026-08-28; v1 is SUPERSEDED but has null effective_to. Family94 v1/132 and v2/137 also approved same date. Product957 v1/72 and v2/73 were approved about two minutes apart 2026-08-25 with inclusive same-day overlap; products752 and 985 predecessor and successor approved same day with predecessor effective_to null. All inspected examples are MANUAL with explicit supersedes lineage. Same-day approval proximity supports a route-preparation hypothesis but does not prove production non-use.

Frozen DL and POH snapshots run122 and run128 each contain 25 recipients referencing the sampled routes. In both pools and both runs, sampled attribution includes family38 (13 records), family106 (10), family137 (1), and product73 via family41 (1). Sampled predecessor IDs 34,105,132,72,174,178 do not appear among the selected snapshot routes. The snapshot recipient sample size for both runs is 25; it is NOT the number of affected historical batches and NOT complete provenance for all 17 overlapping pairs. Full scan and earlier valuation periods still necessary.

Decision: prohibit unqualified APPROVED+SUPERSEDED date resolution. Require documented per-interval provenance, duplicate fail-closed behaviour, and explicit handling of same-day supersessions. Do not infer which route actually applied from approval timestamps alone. Keep immutable run122/128; no historical route-row edits without separate approval. G2/CI-032 HIGH OPEN.
