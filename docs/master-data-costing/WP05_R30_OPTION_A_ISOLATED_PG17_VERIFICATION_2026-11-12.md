# WP05 R30 — Option A audit-view isolated PostgreSQL 17 verification (12 November 2026)

**Evidence checkpoint only.** Owner approved *PPM View-only business policy* under R28, not production execution. Candidate PR [#311](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/311) remains **DRAFT, UNMERGED**, and neither its apply nor rollback SQL was run on production. Formal programme 6/13, W5-06 OPEN.

## Executed evidence in disposable GitHub-hosted PostgreSQL 17

The PR #311 test branch adds a GitHub Actions `postgres:17` isolated service. The server logs identify **PostgreSQL 17.11**; the host `psql` client is 18.6, which is **not** the database-server version. This is a synthetic database named `wp05_fixture` with no production credentials or data. Test script refuses non-local PGHOST and non-fixture PGDATABASE.

| Test gate | Outcome |
|---|---|
| Reconstructed original 20-column view has **exact** original live `pg_get_viewdef` MD5 `001024540bdeab9f2e5aa4ec2a6f6c53` | PASS |
| Current shared helper: PPM-only synthetic reader 0; CCC/CBM/CSR/MCM-only readers satisfy original rule | PASS |
| Option A SQL actually parses and applies via `psql`; view stays 20 columns, postgres-owned, `authenticated` SELECT yes and `anon` SELECT no | PASS |
| New rule: PPM View-only and PPM+CCC mixed reader positive; CCC/CBM/CSR/MCM-only negative | PASS |
| Edit-only PPM without View and absent identity negative; synthetic privileged service access preserved | PASS |
| Apply fails closed on unexpected starting view hash | PASS |
| Rollback refuses **an intervening edited PPM view** with the same 20-column structure | PASS |
| Rollback restores exact original definition hash and original synthetic reader results | PASS |
| Wrong-start rollback fails closed | PASS |

**Exact-head GitHub Actions run:** [43162569109](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43162569109): **9/9 PostgreSQL integration tests passed**, separate offline structural contract job **PASS**. Deliberately raised SQL precondition/rollback exceptions in negative cases are expected; no unexplained failed tests. The isolated candidate definition fingerprint is `e2b9eb3c1b86d073183cd376f704cf58`, now pinned in the **review-only** rollback guard. The production original fingerprint was independently rechecked **catalogue-only**, and remained `001024540bdeab9f2e5aa4ec2a6f6c53`.

## What this does and does not establish

**Established:** PostgreSQL 17 parses and executes the view-specific candidate against a synthetic fixture; the PPM-only access decision and four excluded Costing-only paths behave as specified with isolated `SET LOCAL ROLE authenticated` and test JWT claim values; original object attributes and SQL view grants survive; rollback and intervening-edit guard work.

**Still NOT TESTED:** production signed-in PPM and unrelated-module JWT sessions, real application/browser behaviour, actual row disclosure or denial in Supabase, production schema migration, deployment/active service worker, production postchange verification and full integration with other five D-2 views. The function fixture follows source-observed semantics but is not the live Supabase identity/permission implementation. The isolated tests are not a substitute for owner-authorised production operations or authenticated acceptance.

## Governance disposition

- **R28 owner Option A:** APPROVED policy.
- **R29 / draft #311:** SQL, rollback and synthetic PostgreSQL validation prepared; **no production execution authority**; independent review should still inspect exact latest view owner, grants, column types, hash, reentrancy, input permissions and rollback before requesting second approval.
- **W5-06 D-2:** One of six closure-critical views has approved policy and verified *isolated* correction candidate. The other five owner reader policies remain undecided. Parent W5-06 **OPEN**.
- **W5-04:** D-4 functional Cost Comparison recovery accepted but p95 four-second **HOLD**.
- **D-1 writer denial:** bounded source/metadata accepted; direct production behavioural denial **NOT TESTED**.
- **AE1:** historic 13P/4F/2NA/21NT frozen; formal WP05 **6/13**.

No production view rows, personal identities, database writes or privileges were accessed or changed during this check.
