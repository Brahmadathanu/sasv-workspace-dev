# Retention implementation receipt — PR #491 / Issue #539 (25 Nov 2026)

**State: implemented as migration candidates + isolated tests. NOT deployed. NO production mutation. PR #491 NOT merged.**
Starting point: assignment commit `bfb05fa8`. Prior run-87 archive workflow not restarted (S3K superseded, see `SUPERSEDED_DRAFTS.md`).

## Commits (all on top of `bfb05fa`)
| Commit | Content |
|---|---|
| `931fba9` | R1, R2A, R2B, R2C candidates; PG fixture; R2 adversarial suite |
| `badf729` | R3 availability guard (SQL) + tests |
| `b696ec7` | R4 guarded purge + R3 client contract module/tests + race/rollback/silent-skip tests |
| `baddba7` | R5 planner/tick, five read-only live preflights, PG17 workflow, acceptance runner |
| `54e7474` | Alignment to the 25 Nov owner decision (details below), docs, evidence |
| head of branch | + this receipt, consumer audit, deployment sequence (see `git log`) |

## Where the code is
`docs/master-data-costing/retention/candidates/` R1, R2A, R2B, R2C, R3, R4 (+allowlist generator), R5 · `preflight/` PREFLIGHT_00–05 (read-only) · `tests/` fixture + 12 suites · `evidence/` local receipt · `R3_CONSUMER_AUDIT.md` · `R6_R7_PLAN.md` · `DEPLOYMENT_SEQUENCE.md` · `.github/workflows/retention-r1-r5-pg17.yml` · client: `public/shared/js/costing-run-detail-availability.js` + `scripts/costing-retention/run-detail-availability.test.mjs`.

## Test results (exact)
* **Local, PostgreSQL 16.15** (the sandbox could not obtain a PG17 server: PGDG blocked by the egress proxy and a manual binary download was refused by the session's safety control; I did not work around it): `tests/run_all.sh` → **exit 0, 19 PASS lines**, receipt `evidence/PG16_LOCAL_RECEIPT_2026-11-25.txt`. Client: `node --test scripts/costing-retention/run-detail-availability.test.mjs` → **6/6 pass**.
* **PostgreSQL 17: NOT yet proven.** The `retention-r1-r5-pg17` workflow (postgres:17 service, no secrets, pull_request-triggered) is the PG17 evidence; it also requires `server_version=17…`. Result of its first run on this branch is reported on PR #491 (not claimed here).
* Pre-existing unrelated failure in this clone: `scripts/costing-recalculation/recalculation.test.mjs` "material acceptance remains byte-identical…" (`git show 85a163f…` — historical object absent in the shallow clone). Fails identically without my changes.
* Fixture fidelity (informational): extracted real governance views reproduce W2's live md5 pins (`FIDELITY … =true` ×3); the S3L terminal-guard copy md5 differs on PG16 (`false`), designated guard matches — re-check on PG17 CI; R4 aborts on any guard drift anyway.

### What the suites prove
R1: one ledger row per run, FAILED/RUNNING never "available", null `valuation_date` preserved, state machine, immutable provenance, purged is terminal but mirrors run status (bug found by test and fixed), registration/lifecycle transactional with rollback, no API-role access.
R2: baseline payload parity (all fields + fingerprints), digest/algorithm/version recorded; real RPCs (regional + sales): permission gate unchanged, insert, conflict re-accept, **renewal to a different source run**, renewal with an uncovered field differing, rollback leaves no event, multirow mixed upsert = exactly one event per written row, concurrent insert/upsert race and same-row updates, invalid/cross-run/changed evidence refused, direct pointer spoofing (also for a role holding raw DML), delete/truncate blocked, deferred + immediate constraint behaviour with capture triggers disabled, roles; R2C drops exactly 3 FKs and keeps permanent + run FKs; after simulated purge of source snapshots: status-only revocation works, reactivation/field changes refused, RPCs refuse purged runs, no orphan events.
R3: pointer view parity for every non-purged run, no silent fallback (purged top-ranked ⇒ no current run), approval preflight `DETAILS_AVAILABLE` on the **real** `fn_w2_run_checks` text, permission-gated UI RPC, client fail-closed contract.
R4: authority model (API roles, forged contexts, wrong run/table/xid, GUC-style bypass), drift (unclassified relation, permanent→purgeable FK, cascading FK), cross-run reference, rollback, silent-skip guard fails closed, FAILED run, exact accounting (35 rows/7 tables), idempotency, governance/run-header/designation counts unchanged, resumable partial state, concurrent drivers (one seal, exact counts), serialisation with the period-governance lock used by approval, stale preview recomputed, protected populations.
R5: IST boundary dates, dry-run/disabled/enabled, month turnover Nov→Dec→Mar, cutover (November approved ⇒ Sep/Oct approved runs released and purged through the scoped designated-guard exception with designation history untouched), failure then retry, in-flight purge stays sticky, month release (immutable, validated), overlapping ticks refused, dedicated login least privilege.

## Corrections to earlier drafts (all reproduced before fixing)
R1 seeding aborted on a NULL `valuation_date`; R2B did not parse; R2B recursive pointer trigger with `pg_trigger_depth()` authority and over-strict source check (would break live renewals) replaced by BEFORE-reserve/AFTER-record capture; R2A baseline lacked field parity/algorithm id. After re-reading the owner decision I also corrected my own first R4/R5 (never purge designated runs; window ignored first authoritative month) — fixed and retested.

## Owner decisions implemented / assumptions to confirm
Implemented: Nov 2026 first authoritative month; pre-Nov dev data purge-eligible incl. previously approved runs **after** pricing cutover; window = current + 3 previous (never before Nov 2026); final-only retained months; November/current month fully protected; designation + header + audit rows never deleted; HOLD instead of silent breakage; no archive prerequisite.
Assumptions (please confirm): (1) active pricing authority = approved run of the latest approved period, plus pre-Nov approved runs while no authoritative-month approval exists; (2) an unapproved older authoritative month stays HOLD until approved or `retention_month_release` recorded (no automatic expiry); (3) unapproved pre-Nov displayed drafts may go (month then shows "no current run"); (4) `DETAILS_UNVERIFIED` SUCCESS runs count as available until verified.

## Remaining blockers / not done
1. **PG17 proof pending** (CI) and **live catalog contract unverified**: five tables are reconstructed from code references; `PREFLIGHT_00` must be all-true on production before relying on any fixture result. Baseline 727 regional + 245 sales **not requerable here** (no production access) — preflight 01 re-queries.
2. **Allowlist review** of all ~66 run-linked relations (generator provided; owner/DBA must review; purge refuses while unclassified). Unindexed nested FKs (48 reported) need an index or recorded waiver per large child.
3. **Client wiring** of the availability contract into cost-sheet/comparison/approval screens (list in `R3_CONSUMER_AUDIT.md`); exact-run RPCs not individually wired (46 candidates, live list via `PREFLIGHT_03`); `newer_draft_run_id` label can name a purged draft.
4. Non-FK semantic consumers of snapshot detail beyond the acceptance tables (e.g. material review acceptance matching) are **not audited from the repo** — run `PREFLIGHT_02/03` live.
5. Dedicated `sasv_retention_executor` login must be provisioned by a DBA outside the repo; scheduler/cron deliberately **not created or changed**; `purge_enabled` defaults false.
6. R6 physical reclamation (maintenance authorisation, headroom) and R7 Scheme Comparison retirement are plans only: R7 audit found the snapshot is **not** independent (stage-03 refresh, scheme-master register, KPI, pricing/profit views) — no removal made.
7. November cutover requires an owner approval of a November run (precise blocked consumer and proposed fix in `DEPLOYMENT_SEQUENCE.md`).

## Production deployment sequence (summary — full table with gates/rollbacks in `DEPLOYMENT_SEQUENCE.md`)
0 PREFLIGHT_00 → 1 R1 → 2 R2A → 3 R2B → 4 R3 → 5 client wiring PR → 6 R2C (separately approved; preflight 01+02) → 7 DBA provisions executor login → 8 R4 install (both guard pins) → 9 review/seed allowlist, structural blockers empty → 10 single-run pilot purge (pre-Nov draft) with receipts → 11 R5 install (disabled) and DRY_RUN across a month boundary → 12 enable + scheduler (separate approval) → 13 physical reclamation (separate authorisation). Never reorder R4 before R2C/R3.
