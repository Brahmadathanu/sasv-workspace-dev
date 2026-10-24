# G6 CI availability recheck — 21 October 2026

Owner asked to retry the interrupted G6 review. GitHub read-only PR lookup for #72 returned OPEN, unmerged, head SHA `c177d25ee3a534a8f61c2eedda82af248e6f57ed`, base SHA `80c14abb181e40c9a13c7db180646c5cab33d7b3`, 560 changed files and 386 commits. Last fetched mergeable field TRUE, but that is only GitHub merging feasibility, NOT costing/G6 release approval. Do not merge this broad PR before diff separation and release review.

GitHub Actions workflow runs query for exact PR head SHA returned **zero matching PR-triggered runs**. This is not proof CI ran or passed, and the available connector shows no new workflow dispatch action. Isolated native PostgreSQL transaction/negative/concurrency tests still lack execution evidence and therefore G6 server-foolproof status remains HOLD.

Current release G2 numerical PASS under bounded owner decision; run136 six stages SUCCESS, 626 READY /1 REVIEW, 17 integrity checks PASS and seven pools conserved. Run136 not designated; no new refresh, production test mutation or Google Sheets integration performed.

Next engineering work: run a narrowly scoped PostgreSQL 17 CI fixture through a reviewed test-only branch/workflow or authorised equivalent, with rejected roles, stale/changed/future acceptance, concurrent approval vs source edit, and immutable run protections. Split this isolated safeguard evidence from historical large PR #72 before release. Explicit G6 acceptance and run designation after tests.
