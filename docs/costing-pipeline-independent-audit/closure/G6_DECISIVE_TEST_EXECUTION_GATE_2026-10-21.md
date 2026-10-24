# G6 decisive execution gate — 21 October 2026

User requested swift, safe completion and explicitly directed an end to repetitive inspections.

## Verified now
- PR #72 (costing/au4-normal-budget) is **OPEN**, not merged. No evidence of release from this PR.
- GitHub commit workflow lookup for commit `c636f88f8c4d5c84816b62bb51ecd47aa1abed3d` returned **zero** associated PR-triggered workflow runs. **This is not a claim that no workflow exists anywhere or that other commits were never tested.**
- Current execution environment: Node.js available; `psql`, `postgres`, and `docker` are NOT installed. A local PostgreSQL concurrency test cannot be run here.
- Earlier mathematical Node fixtures (12/12) do not cover SQL isolation or RPC authorization.
- G2 current-release numerical scope already CLOSED by owner. Future attestation remains held/uninstalled but is not G2 release numerical blocker.
- Run136 six-stage SUCCESS, 626 READY/1 REVIEW, seven-pool monetary conservation PASS, 17/17 existing integrity checks PASS; zero 135→136 differences across 627 SKU material/internal/IK/OK amounts; no approved designation.
- Regional acceptance RPC's permission and eligible-row predicate inspected. Anonymous schema USAGE denied; generic authenticated INSERT on sensitive tables denied. No executed concurrent negative-case tests.

## Binding gate decision
**G6 financial and current-release numerical gate PASS; G6 FULL SERVER RELEASE CERTIFICATION HOLD.**
The remaining test cannot be *safely* replaced by additional production metadata queries or by a declaration of PASS. Do not execute negative writes against production. Do not re-run costing unless inputs or calculation logic actually change.

## Single scoped unblock path
Use an existing isolated PostgreSQL runner or introduce a minimal temporary GitHub Actions test job on an isolated PostgreSQL service (without Supabase production keys). Execute the exact currently deployed regional approval and designation SQL plus dependencies in a fixture, with:
1. authenticated allowed vs unauthorised/anon rejected;
2. evidence changed, retired, future dated, blank reason and ineligible default rejected;
3. parallel transactions serializing an acceptance against a source change, and concurrent duplicate acceptance;
4. rollback and immutable historical run protections.

If live schema extraction into an isolated fixture is incomplete, record precise missing dependencies, do not misrepresent fixtures as live parity. Run outcome and artifacts must be committed to branch before G6 release. Any new workflow or migration needs normal repo review; production live migration/designation requires separate user authorisation.

## Scope handoff
No Sheets integration or change. User will share additional server-side requirements once the server is release-certified; do not solicit them prematurely.
