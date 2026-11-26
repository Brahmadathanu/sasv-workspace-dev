# Retention implementation receipt — PR #491 / Issue #539

**State: candidates + tests only. NOT deployed, NOTHING purged, no cron, no release, PR #491 draft/unmerged, #539 open.**

## 26 Nov 2026 continuation (R3 integration, R4 dependency engineering, R7 retirement)
Start: tested checkpoint `8d3570d` (assignment commit `de62058`). **Code head `40fc3d2`; later commits are documentation only.**

### Evidence (this head; earlier green runs are not transferred)
| Evidence | Result |
|---|---|
| PG17 `retention-pg17` job, run [45793781270](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781270) (job 139819109969) | **success**, `server_version=17.12`, `RETENTION_PG_ALL_PASS count=23`, all 5 fidelity pins true (pointer view, effective-designation view, period-status view, terminal guard, designated guard), new Node suites 26/26 |
| `client-regression` job (full history), same run, job 139819110564 | **success**: new suites 26/26; touched existing suites: failing at head 2 = failing at the pre-R3/R7 checkpoint 2 (same two, pre-existing: `sec-a2-strip` "shell: the single injected permission line…" and `review-worklist` "protected files unchanged…" — both fail identically on `8d3570d`); **no new failure** |
| Existing workflows on this head | WP05 offline costing regression [45793781273](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781273) **success** (it had failed on `337cc42` because a historical shell-baseline test saw the R3/R7 hunks; fixed in `40fc3d2` by `scripts/lib/retention-r3r7-strip.mjs`, byte-verified against `8d3570d`), WP05 W5-06 confidentiality [45793781399](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781399) **success**, WP12 eleven-flag Chromium matrix [45793781332](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781332) **success**, S3L PG17 [45793781305](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781305) **success**, S3R Windows [45793781393](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781393) **success**; PEC integrated browser [45793781269](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781269) and S3F/S3G [45793781268](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45793781268) were still running when this was written (not conclusions) |
| Local real-Chromium fixtures | cross-links 5/5 (2 retirement tests), nav-groups-browser 12/12, flag-sweep-browser 21/21 |
| Local PG16.15 | `tests/run_all.sh` exit 0, 23 PASS (`evidence/PG16_LOCAL_RECEIPT_2026-11-26.txt`) |

### Broad regression check (post-handback correction)
A full local head-vs-base comparison of every `scripts/costing-*` / `csr-*` non-browser suite (base = fresh worktree of `8d3570d`, full history) found **two regressions that CI's touched-suite job did not cover**: `costing-ccc-uxf1` "badge module…only additions" (the removed run-scoped lens line) and `costing-table-tools-pkg2` "pkg2 CSS…" (scope guard saw my cost-sheet-review.html subtitle edit). Fixed: the subtitle edit was reverted (no HTML change; "scheme viability" remains accurate for the selected-scheme drawer) and the uxf1 test tolerates exactly the one retired-lens line. The other nine failing suites in that comparison fail identically at the base (pre-existing). My first comparison script reported `base=0` because I removed its base worktree mid-run; that number was invalid and is withdrawn.

### Delivered
| Area | What | Where |
|---|---|---|
| R3 server | Fail-closed **manifest + installer** patching 3 real resolver helpers (≈ 10 public material-trace/MS/QC RPCs) and 13 public exact-run readers after their permission statements, null/default context unchanged, blocks only removed detail; SECURITY-DEFINER/plpgsql/pin/CRLF/ACL checks; DEFERRED rows for 2 functions needing live definitions | `candidates/R3B_*.sql`, `tests/13_*` |
| R3 verification | Evidence-based UNVERIFIED→AVAILABLE (finished SUCCESS governed run + captured fingerprint + zero-drift re-verification + non-empty cost sheet), governed RPC, approval gate `DETAILS_VERIFIED` (new approvals only; legacy Sep 122/Oct 143 untouched), stale `newer_draft_run_id` fixed with every extended period-status column preserved | same |
| R3 client | `costing-run-guard.js` at the shell's single `costingFrom`/`costingRpc` injection point (covers every explicit-run read), approval-screen availability pre-check + **Verify run details**, race/mismatch/unknown handling | `public/shared/js/`, `scripts/costing-retention/run-guard.test.mjs` (8) |
| R4 | Relation-by-relation reviewed proposed seed (46 rows with reasons; `confirm_live` flags), 21 index candidates (CONCURRENTLY, not applied) with decision rule, dependency review incl. material-review acceptance, seed-vs-repo-FK consistency tests, **reconciled install order tested in fresh databases** (R4 engine → manual pilot → R5 planner disabled; R5 before R4 refused) | `candidates/R4_PROPOSED_ALLOWLIST_SEED.sql`, `R4_INDEX_CANDIDATES.sql`, `R4_DEPENDENCY_REVIEW.md`, `tests/14_*`, `scripts/costing-retention/r4-seed-consistency.test.mjs` (6), `preflight/PREFLIGHT_06_*` |
| R7 | Client lens retired (route config, registry, nav groups, run-scoped set, deep-link redirect with notice, control-centre drill), stage-1 server candidate dropping only the public all-scheme API view with dependency checks | `scripts/costing-retention/scheme-comparison-retirement.test.mjs` (4), browser tests, `candidates/R7_*.sql`, `tests/15_*`, `R6_R7_PLAN.md` |
| Docs | `R3_CONSUMER_AUDIT.md` (integrated / excluded / direct-API exposure), `DEPLOYMENT_SEQUENCE.md` (16 gated steps, rollbacks), `R4_DEPENDENCY_REVIEW.md`, `R6_R7_PLAN.md` | |

### Regression results (this branch)
* Local PG16.15, `tests/run_all.sh`: exit 0, **23 PASS**, all fidelity pins true (receipt `evidence/PG16_LOCAL_RECEIPT_2026-11-26.txt`). PG17.12 is the CI evidence (below).
* Node: `scripts/costing-retention/*.test.mjs` **24/24**.
* Existing suites touched by the retirement/guard: **no new failure versus the pre-R3/R7 checkpoint** with full history (2 pre-existing failures identical at both; the earlier "38" count came from the shallow clone and is withdrawn).
* Real Chromium fixtures: cross-links 5/5 (incl. 2 retirement tests), nav-groups-browser 12/12, flag-sweep-browser 21/21 (counts updated deliberately 30→29 non-PPM lenses, 32→31 total).
* Deliberate expectation changes (not loosened): lens counts, `scheme-comparison` ownership, approval screen RPC allow-list (+2 retention RPCs, forbidden list unchanged).

### Genuine outstanding blockers (production-only or live-evidence)
1. **`PREFLIGHT_06` live packet** is required before install: md5 pins for the 16 manifest functions (installer refuses NULL), resolution of the 2 DEFERRED functions, the remaining ~25 of 64 live direct relations (seed names 31+8 only), live size/rows/index state for the index decisions and the `confirm_live` rows, and the live reader list (non-FK consumers).
2. **Verification evidence on live**: runs without a captured fingerprint cannot become AVAILABLE (they stay readable UNVERIFIED); whether Sep 122 / Oct 143 have fingerprints is unknown from the repo (PREFLIGHT_06 E). Fingerprint re-verification is a heavy per-run hash — run one at a time.
3. Direct SELECT of an exact-run **view** for a purged run returns an empty set (not wrong data); the UI is guarded, a custom API client is not (view-level guard needs live view definitions).
4. Index set and waivers need live data and operational approval; executor login provisioning; allowlist review; scheduler enablement; R2C approval; R6 maintenance authorisation — all unchanged production gates.
5. R7: dead controller code in the shell retained pending browser-proven removal; writer narrowing and stage-2 view drops not done (precise requirements in `R6_R7_PLAN.md`).
6. November approval is still required before Sep 122 / Oct 143 become purgeable (R4/R5 hold them as active pricing authority).

---
# Earlier receipt (25 Nov 2026, preserved)

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
| `f5ab9cf` | Consolidated receipt, consumer audit, deployment sequence |
| `af8b96f` | R4 CRLF-tolerant guard patches vs real live md5 pins; byte-faithful fixture |

## Where the code is
`docs/master-data-costing/retention/candidates/` R1, R2A, R2B, R2C, R3, R4 (+allowlist generator), R5 · `preflight/` PREFLIGHT_00–05 (read-only) · `tests/` fixture + 12 suites · `evidence/` local receipt · `R3_CONSUMER_AUDIT.md` · `R6_R7_PLAN.md` · `DEPLOYMENT_SEQUENCE.md` · `.github/workflows/retention-r1-r5-pg17.yml` · client: `public/shared/js/costing-run-detail-availability.js` + `scripts/costing-retention/run-detail-availability.test.mjs`.

## Test results (exact)
* **Local, PostgreSQL 16.15** (the sandbox could not obtain a PG17 server: PGDG blocked by the egress proxy and a manual binary download was refused by the session's safety control; I did not work around it): `tests/run_all.sh` → **exit 0, 19 PASS lines**, receipt `evidence/PG16_LOCAL_RECEIPT_2026-11-25.txt`. Client: `node --test scripts/costing-retention/run-detail-availability.test.mjs` → **6/6 pass**.
* **PostgreSQL 17.12 (GitHub Actions, `retention-r1-r5-pg17`, postgres:17 service, no secrets):** run `45663226024` on code head `af8b96f` → **success, `server_version=17.12`, `RETENTION_PG_ALL_PASS count=19`, all `FIDELITY … true` (pointer/designation/period views and both guards equal the live md5 pins), client 6/6**. Earlier run `45662712904` (head `f5ab9cf`, before the CRLF-fidelity fix) also passed 19/19. Commits after `af8b96f` are documentation only.
* Pre-existing unrelated failure in this clone: `scripts/costing-recalculation/recalculation.test.mjs` "material acceptance remains byte-identical…" (`git show 85a163f…` — historical object absent in the shallow clone). Fails identically without my changes.
* **Fixture fidelity (asserted, not informational):** the fixture's pointer view, effective-designation view, period-status view and both snapshot guards reproduce the **live md5 pins** byte-for-byte (`FIDELITY … true`), and R3/R4 are installed in the tests against those real pins (no override). Finding while doing this: the live terminal-guard body contains **CRLF** line endings; my first extractor normalised them and the anchor patch would have matched nothing in production (fail-closed abort, i.e. undeployable). R4 now verifies the pin on the original bytes, then normalises CRLF→LF before anchoring, and the extractor is byte-faithful.

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
