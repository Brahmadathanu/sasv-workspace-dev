# G2 route 48 focused lineage audit, 20 October 2026

READ-ONLY. Family43 Linga Chendooram route48 v1 SUPERSEDED effective Aug26–Aug26; route49 v2 APPROVED from Aug26 with no explicit supersedes link to 48; route82 v3 APPROVED from Aug28 with supersedes_route_id=49. The latter two appear temporally overlapping from visible columns; archival state was NOT retrieved, and no constraint violation is asserted until archival is checked.

Direct Labour and Production Overhead workload snapshot tables returned zero references for family_route_id 48 across all available refresh runs (no refresh_run_id filter applied). This does not prove the route was never used outside those snapshots.

Complete predecessor scan of all other routes is still blocked. Do not mutate lineage or dates. Verify archival/effective status of 49 and 82 first, then audit route48 origin and historical selection. G2 open; live unchanged.
