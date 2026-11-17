# WP10 RM1 — independent read-only installation preflight receipt (17 Nov 2026)

**Environment:** Supabase project `qhmoqtxpeasamtlxaoak` | `BEGIN READ ONLY` | `statement_timeout=20s` | captured `2026-11-17T05:15:47.419152+00:00` (10:45:47 IST). **No DML/DDL, RPC writer calls, permissions or product data changed.**

**Reproducible source:** `scripts/wp10-g2-safeguards/review-only-live-install-preflight.sql`. It outputs one JSON document containing exactly pinned live function definitions, candidate-object absence, row counts and privilege boundary. The first execution returned:

| Gate | Actual | Disposition |
|---|---:|---|
| Pinned canonical resolver/validator and PRM RPC hashes | **12/12 MATCH** | PASS for this catalog snapshot |
| RPC definition drift | **0** | PASS |
| Candidate 05/CL15/RM1 functions already installed | **0** | PASS |
| Candidate triggers already installed | **0** | PASS |
| Private audit table already installed | **0** | PASS |
| Non-archived APPROVED product maps | **379** | Baseline |
| Non-archived APPROVED subgroup maps | **16** | Baseline |
| Non-archived APPROVED group maps | **0** | Conditional governance warning |
| `authenticated` UPDATE on route mapping table | **false** | PASS for direct DML surface |
| `authenticated` UPDATE on `sub_groups` | **true** | **OPEN RISK / separate hierarchy governance** |
| `authenticated` UPDATE on `product_groups` | **true** | **OPEN RISK / separate hierarchy governance** |

The read-only preflight's own next action is `REVIEW_ROLE_LOCK_FLEET_AND_OWNER_APPROVAL_STILL_REQUIRED`, **not** “install”. The snapshot does not assert privileged role-specific dynamic RPC authorization, production lock behavior, established compatibility of all installed Electron clients, or safety of future group inheritance. It does not justify retroactive valuation edits, historical route status broadening, or row-level permission revocation.

**Next non-bypassable gates:** (1) latest exact-head unified candidate CI including mapping target-change and audit TRUNCATE cases, (2) independent full writer and lock-order review, (3) reason-RPC legacy fleet/role cutover decision, (4) client/production schema cache visibility and real authenticated role tests, (5) exact SHA-256 manifest and rollback reviewed for the installation candidate, (6) separate owner approval. Historical G2/CI-032 remains independent and OPEN. WP10/11/12 OPEN; formal programme 10/13 CLOSED.

**Current source-of-truth:** [draft PR #463](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/463), [issue #464](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/464), and [unified installation review](WP10_UNIFIED_05_CL15_RM1_DEPLOYMENT_REVIEW_PACKAGE_2026-11-17.md).
