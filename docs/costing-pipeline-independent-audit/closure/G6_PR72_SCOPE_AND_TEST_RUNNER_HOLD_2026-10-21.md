# G6 release readiness check — 21 October 2026

**Disposition: financial PASS; release/security HOLD.** Read-only inspection, no production or Google Sheets mutation.

## Repository release branch
GitHub pull request #72 `costing/au4-normal-budget` → main is **OPEN, DRAFT**, with **559 changed files**, 106505 additions and 1 deletion according to live PR metadata. GitHub reports `mergeable=true`, but this only means mechanical mergeability, **not security acceptance, targeted scope, reviewed files, passing CI or release suitability**. No merge was performed. The unusually broad diff must be scoped or independently reviewed before using PR#72 for deployment.

## Runtime isolated PostgreSQL availability
Active execution environment: Node.js available; neither `psql`, `postgres`, `pg_ctl`, Docker nor Podman executable is available. GitHub connector offers historical Actions-run/job inspection and rerun capabilities, but no general new workflow dispatch through the tools inspected. No isolated PostgreSQL concurrent transaction test executed in this checkpoint.

## Verified SQL safeguards and limits
- `costing.rpc_accept_regional_marketing_review`: SECURITY DEFINER + application permission check, nonempty reason, current queue eligibility, evidence fingerprint stored, idempotent unique conflict key; no source-row `FOR UPDATE` visible in definition. Source mutation race remains an independent verification item.
- Effective ACL: direct generic authenticated insertion into acceptance/designation tables denied, anonymous execution of acceptance RPC denied; anon has no costing schema USAGE. Those checks do not prove complete API access control or role-isolated transaction behavior.
- `fn_regional_marketing_review_status` source inspection supports ACTIVE/date/fingerprint and governed actual-monthly matching, but is not a substitute for negative-case tests.

## Previously closed
G2 current-release numerical gate closed by owner, prospective route-attestation safeguard moved to future hardening, deliberately NOT installed. Run136 six stages SUCCESS; 627 SKUs, 626 READY and 1 held regional assumption review; seven pools conserved, 17/17 exact integrity checks PASS, run135→136 627/627 stable.

## Required for formal server 'fool proof' declaration
1. Obtain isolated PostgreSQL controlled parallel-session / denied-role / changed-evidence test results for the **deployed** approval RPC and governed continuity paths.
2. Isolate/review the broad draft PR#72 delta; confirm exact currently deployed migration parity vs repository, and exclude deliberately held G2 SQL from runner.
3. Confirm security, RPC role permissions and snapshot/designation mutation guards; close CI-019/CI-033 as applicable.
4. Explicit G6 owner signoff and run136 designation only after above.
No Sheets preparation details requested yet; Sheets integration remains blocked.
