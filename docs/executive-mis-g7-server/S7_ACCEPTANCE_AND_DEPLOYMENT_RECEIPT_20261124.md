# MIS G7 — S7 server acceptance, deployment package and final client integration (24 Nov 2026)

> **Revision 2 (receipt-evidence finding).** The package is now **three** forward-only migrations: **S7a** (route identity, status, helpers), **S7b** (NEW: exact FG receipt evidence in the signing and packing writers) and **S7c** (previews and exception summary; was "S7b" in revision 1). The authoritative identities, tests and blockers are in `S7_FINAL_REAL_CATALOG_ACCEPTANCE_RECEIPT_20261124.md`; where this document says "S7b" for previews/exceptions or lists only two migrations, that receipt is current.

**Status: G7 OPEN 7/11 (64%), G8 parked.** S7 is **prepared, tested in isolation, NOT installed**. No production write, migration installation, permission assignment, core sign-off, ENFORCE, merge, release, PEC cleanup, backfill or Costing change was made. Production stays AUDIT, core gate `CORE_MIGRATION_NOT_ACCEPTED`. S2–S6 files are untouched and never replayed.

## 1. What "isolated" means here (read this first)
* **Real**: the Costing route engine (8 functions) is loaded **verbatim from the repository migrations** (`s7/extract_route_engine.mjs`, latest definition wins); S2–S6 and the exact live DWL editor wrapper/core/parser run as accepted; PostgreSQL 16 (the only server available here; production is 17.4, same-major caveat applies).
* **Not available to this session**: the private production catalog packets (`.local/mis-g7-prod-baseline/{packet,supplement}.json`) are **absent**, so the real-catalog runner could not be executed and base tables outside the route engine are the committed shim (products, work logs, ledger, event tables, permission table). This is **dependency D-1** below; nothing was derived from production data or invented about production semantics.
* The route/Costing tables use real column shapes (hand-authored from the engine bodies, synthetic rows). The client was additionally driven against this real PostgreSQL (§5).

## 2. Candidate review: defects found and fixed in the S7 draft
| # | Finding in `S7_READ_CONTRACT_CANDIDATE_NOT_APPLIED.sql` | Proof | Resolution |
|---|---|---|---|
| 1 | Resolver pin was **62 hex characters** (a valid SHA-256 has 64): the install guard could never pass | length check in test | Pin is now `sha256(pg_proc.prosrc)` **derived from the committed S2 file** (`53c9c60c…a9e3`, version-independent); test proves file-derived value = installed value |
| 2 | `mis_preview_pack_fg_bulk_v1` read record `l` before assignment: **every pack-mode preview raised `record "l" is not assigned yet`** | executed the candidate: `ERROR: record "l" is not assigned yet` | scalars only; tested with NULL/absent line, 12 hostile inputs |
| 3 | Preview refusal codes diverged from the writers (`EVENT_NOT_BULK_AFFECTING` vs `EVENT_NOT_DEPLETING`; no `NO_DEPLETION_BASIS` vs `LEDGER_MISMATCH` split; no writer-order outcome) | parity tests vs S4/S4b | same codes; `preview_code` = first state-dependent outcome in the writers' order |
| 4 | Route context / exception summary could **raise** on engine errors (e.g. `AMBIGUOUS_APPROVED_PRODUCT_ROUTE`), aborting the whole report | engine mutation test | `ROUTE_RESOLUTION_ERROR`; never raises |
| 5 | `EFFECTIVE_DATE_ROUTE_GAP` (S2 contract) was dropped; all route failures became `PRODUCT_ROUTE_COVERAGE` | date-gap test | restored; non-coverage validation failures use new `ROUTE_INVALID` (+ `route_errors`) |
| 6 | Blanket "event table empty + zero permission assignments" precondition | — | replaced by **AUDIT-only + a compatibility proof**: every signature valid before S7 must verify bit-for-bit after, else the whole transaction rolls back (tested both ways). Permission assignment does not affect correctness and is no longer a blocker |
| 7 | Used `public.app_has_permission` (not in the live baseline) in a server read | — | `app_private.mis_g7_can_view` over `require_permission(target,false)` |
| 8 | Summary labelled every old unsigned batch UNSIGNED; units/scope implicit | — | governance **cut-over** table: unsigned + FG log before cut-over = `NOT_VERIFIED`, on/after = `UNSIGNED`; explicit `count_unit`, `scope`, separate `line_counts` |
| 9 | `MISSING_RECEIPT` required ledger `source_table='daily_work_log'`, narrower than what the signer accepts | — | any positive ledger row (parity with S2 evidence rule). **Which `source_table` values production uses is D-1 item 4** |
| 10 | No rollback | — | `S7_ROLLBACK_NOT_A_MIGRATION.sql` with guards (§6) |
| 11 | Engine not pinned | — | 8 `prosrc` pins; `MIS_G7_S7_ENGINE_DRIFT` if production's engine differs from the tested one |
| 12 | Failure paths dropped the `wl_*` fields S2 returned | — | preserved |
| – | **Client defect found by real-server testing**: evidence reference optional client-side but mandatory in S2 (`INVALID_INPUT`) | bridge test | required in the UI, the model and the hand-off |

## 3. Route identity verification (positive/negative namespaces)
* `route_step_id` = `base_step_id` (>0) for base and inherited steps, `-override_id` (<0) for `ADD_STEP`; `route_id` = `product_route_id` (>0) or `-family_route_id` (<0). Every id source is a `bigint` identity; install guard refuses any id ≤ 0 (tested by injecting `-5`). Positive/negative spaces cannot collide; step uniqueness inside a route is re-checked (`ndist = nsteps`).
* Real-engine cases tested: inherited family route; product route with ADD/REPLACE/BYPASS/ALTER_CYCLE; archived product route ignored; `effective_to`/`effective_from` boundaries inclusive and contiguous; date gap; no coverage; approved-route overlap; no FG stage; **two** mandatory FG stages; ambiguous BMR; engine failure.
* **Replaced / altered base steps keep their base id.** Safe because (a) the S2/S6 fingerprint (unchanged) binds `route_id`, `route_step_id`, occurrence, work log **and the effective activity**, so a route edit that changes the effective activity changes the fingerprint, and (b) approved routes/overrides are immutable by trigger. **Precedent noted**: migration `20260830031339` disabled those triggers and rewrote step activities in place; in that case the changed activity changes the fingerprint and the signature reports `SOURCE_CHANGED`. Non-activity attribute edits (cycle, mandatory flag) in such an administrative rewrite would not be detected; accepted risk, owner governance.
* `bigint`: ids above 2^53 travel as text in every response and as exact strings into RPC arguments (tested at 9007199254740993).
* Occurrence/idempotency review of S2 (pre-existing behaviour, **not changed**): `STAGE_ALREADY_SIGNED` is per (product, batch, step id, occurrence) and **route-agnostic**: a batch whose logs straddle two route versions that share a base step id cannot sign the same occurrence twice (conservative, never unsafe). The idempotency key binds actor + step + occurrence + log, replay is exact, and key reuse with a different request is refused (tested).
* **Verdict: the representation is safe for signing, correction, uniqueness and fingerprinting; no stronger identity design is required.** A signature on an S7-only identity (inherited route or added step) cannot be expressed by the S2 resolver, so rollback is refused once one exists (tested).

## 4. Acceptance tests (PostgreSQL 16)
`node --test supabase/tests/mis_g7/s7/mis_g7_s7_pg.test.mjs` → **29/29**. Covers: route-engine provenance and pins; install guards (ENFORCE, resolver drift, engine drift, id collision) leaving nothing installed; ACL/security (anon/PUBLIC denied, SECURITY DEFINER, STABLE, pinned search_path, private helpers and new tables closed); all route cases above; **context/signing parity** (every listed step resolves identically, every other id refused); occurrence/idempotency/correction; receipt evidence (UOM, quantity, ledger) with nothing inferred; persistence across sessions/users; corrected and source-changed states; **S6 Done closure keeps the signature while a quantity revision invalidates it**; unauthorized/anonymous/no-JWT refusals for every new RPC; preview-vs-posting parity (required, available, balance, excess) and preview-vs-ledger parity for corrections incl. removal, no-depletion and mismatched-depletion refusals; hostile/null inputs; previews never write (row counts unchanged, STABLE); exception summary states, units, scope, cut-over, bounds and **performance (400 batches over 92 days: ~0.3 s here)**; S2–S6 function definitions and ACLs byte-identical after S7; legacy DWL editor still works under AUDIT; staged rollback and re-install; rollback refused for S7-only identities and for incompatible signatures; install refused when a valid signature would stop verifying; corrected registry proposal (`permission_targets` first, FK `fk_app_modules_target` respected, zero assignments, fail-closed re-run); contract JSON ↔ catalog.
Existing server suites (`supabase/tests/mis_g7/*.test.mjs`, one assertion updated to allow the two S7 files and to verify only S2–S6 entries of the contract): **150 tests, 114 pass, 0 fail, 36 skipped** (packet-blocked / environment-gated, unchanged).

## 5. Client against the real isolated server
`scripts/mis-g7-client/bridge.test.mjs`: the real page in Chromium, every RPC/table read executed by PostgreSQL as `authenticated` with the user's JWT subject (no handwritten model) → **14/14**: signing without Production Route Manager access (the route comes from the server context; `rpc_get_effective_product_process_route` is never called), persisted status in a fresh session/other user, ADDED-step signing (route 21 / step −701), route/BMR/overlap gaps, preview = posting (2.5 kg required, 7.5 kg balance), unsigned-batch preview block, real measured excess (one key, ledger 0, excess receipt 5), unauthorized packer without excess controls, corrections (preview impact, depletion basis, removal, historical line blocked), source-changed → void → re-sign, live exception drill-down with paging and jump-to-batch, unauthorized roles, **S7-absent database** (page degrades to S2–S6, packing still works), 390px full-page modal, and the default-disabled hand-off (3 tests).

## 6. Installation package (owner review; none of this has been run in production)
| File | bytes | sha256 | git blob sha1 |
|---|---|---|---|
| `supabase/migrations/20261124120000_mis_g7_s7a_shared_route_identity_and_stage_status.sql` | 19258 | `e4c7c5bd3b9e8502c3b51589f6a2366058c2e3c8b4ce49c997761e1623f3ac02` | `6af60e3c86510672b910720895facc86b01a513a` |
| `supabase/migrations/20261124121000_mis_g7_s7b_governed_previews_and_exception_summary.sql` | 13475 | `6e7086b4a62d122e4b34e795d796a262a39acfd513f9e290478996b3fcfac4a5` | `f6fcfe0105d0a90be17717407499823c805ce2de` |
| `docs/executive-mis-g7-server/S7_ROLLBACK_NOT_A_MIGRATION.sql` | | `db273b7bc8940aec4939d49f385446c084bb4d41be8b2a09b1d335a9c91f7fb9` | |
| `docs/executive-mis-g7-server/CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql` | | `f37db6929995dc0e69bc92d7580de33924c763678d57c7c2759570356f3e2246` | |
| `docs/executive-mis-g7-server/client_rpc_contract.json` (`mis-g7-s2-s7/1`) | | `626e7d6bb59bf3d71a5b541ab92753ea97c1b072ee9ec1820567d3f6924170c3` | |
(The manifest `MIGRATION_IDENTITIES.json → pending_migrations` is the machine-readable source; a test fails on drift.)

**Preconditions (enforced in-file, fail closed, one transaction each):** mode `AUDIT`; resolver `prosrc` sha256 = pin; `mis_stage_fp` definition sha256 = production-verified `d438e858…359d4`; 8 Costing engine `prosrc` pins; no id ≤ 0 in the four route tables; required functions present; every previously valid signature still verifies after the replacement (else rollback of the whole transaction). **Order:** S7a → read-only receipt → S7b → read-only receipt. Run as one transaction each (the migration tool does; manual runs need `psql -1`). Do not `db push` from this branch (filename/version mismatch map unchanged).
**Original resolver preservation:** the exact `pg_get_functiondef` is persisted (hash-checked) in `app_private.mis_g7_s7_baseline`; rollback restores from it and verifies the hash. Tables `mis_g7_s7_baseline` and `mis_g7_governance_cutover` are retained on rollback.
**Rollback** (`S7B ROLLBACK`, then `S7A ROLLBACK`): refuses if S7B still installed; **refuses when any signature uses a route/step id ≤ 0** (`…_INCOMPATIBLE_IDENTITIES`); refuses when restoring the S2 resolver would invalidate any currently valid signature (`…_INCOMPATIBLE_SIGNATURES`, e.g. a signature on a REPLACEd step); otherwise restores the original resolver, hash-verified, and signed history is untouched.
**Post-install read-only receipts to collect:** the 4 RPCs exist, authenticated-only, anon/PUBLIC denied; `mis_resolve_batch_stage` baseline row hash = pin; `mis_g7_governance_cutover` = install date; 0 permission assignments for the five MIS targets; `mode = AUDIT`; one authenticated no-right call returns 42501 and one anonymous call is refused. **Cut-over date** defaults to the install date; changing it needs a new forward migration (owner decision).

## 7. Dependency request D-1 (one consolidated request; nothing here was assumed)
1. Deliver the private catalog packets (`packet.json`, `supplement.json`) to `.local/mis-g7-prod-baseline/` so `npm run test:mis-g7:real-catalog` and the S7 suite can be re-run on the real base tables; or approve S7 on the strength of §4 plus step 2.
2. Read-only production checks before installation (compare to the pins; any mismatch means stop): `sha256(prosrc)` of `costing.fn_resolve_route_family_for_product(integer,date)` = `fda6b65c…7660`, `fn_resolve_effective_route_family_route(integer,date)` = `065cb137…dad3`, `fn_resolve_effective_product_process_route(integer,date)` = `98b9f360…e177`, `fn_effective_product_process_route_steps(bigint)` = `6d3c21ff…b6d4`, `fn_effective_product_process_steps(integer,date)` = `f94e1ce7…7c8d`, `fn_validate_product_process_route(bigint)` = `7aaf0c6e…94a3`, `fn_validate_route_family_route(bigint)` = `1d8f0946…af2d`, `fn_validate_effective_product_process_route(integer,date)` = `f2773bdb…5461` (full values are in S7a); `app_private.mis_resolve_batch_stage` `prosrc` = `53c9c60c…a9e3`.
3. Shape check for the registry proposal: `\d public.permission_targets`, `\d public.app_modules`, `\d public.app_module_clients` (the test fixture mirrors only the columns named in the proposal and the FK `fk_app_modules_target`).
4. `SELECT source_table, reason_code, count(*) FROM public.fg_bulk_stock_ledger WHERE qty_base > 0 GROUP BY 1,2` and the live definition of view `public.fg_bulk_stock` (the signer and the summary treat **any** positive ledger row as receipt evidence; confirm that matches how receipts are really recorded).
5. Effective-date sanity for the 485 ADD_STEP / 178 ALTER_CYCLE / 63 BYPASS_STEP overrides: confirm none sits on an approved route whose routes overlap (the context refuses overlaps by design).

## 8. Authenticated production smoke matrix (owner; assigns nothing by itself)
Prerequisites (each a separate owner authorization): S7a/S7b installed; registry proposal applied; assign to ONE named test user `mis-batch-stage-signer` + `mis-fg-bulk-packing` (view+edit), to a second user additionally `mis-fg-excess-adjustment`, to an Executive MIS viewer nothing new. Use one low-value batch with FG receipt evidence; record stock first.
| # | As | Step | Expected |
|---|---|---|---|
| 1 | no MIS right | open Batch Governance | closed gate |
| 2 | signer | product → batch → pick the FG bulk log | route loads **without** Production Route Manager right; FG step auto-selected; inherited batches show an "inherited family route" label |
| 3 | signer | sign FG bulk with logged qty + weighing reference; repeat | signed, event id; identical retry replays; reload / second device shows **Signed** |
| 4 | signer | sign a non-FG step incl. a product-added step | signed (negative step id) |
| 5 | packer | unsigned batch: enter counts | preview says "FG bulk stage is not signed", Post disabled |
| 6 | packer | after step 3: counts | preview required/available/balance equals the receipt after posting; FG Bulk Stock agrees |
| 7 | packer | network off mid-post, Retry | "Outcome not confirmed" then replay; stock debited once |
| 8 | packer (no excess right) | counts above stock | shortfall shown, no excess controls |
| 9 | excess user | same with measured excess + reason + evidence | excess + packing together; balance correct |
| 10 | packer | correct one line, remove another | preview impact = receipt = ledger |
| 11 | packer | correct a known historical line | preview "no recorded depletion", confirm disabled |
| 12 | signer | change the signed FG log quantity | **Source changed** → void → re-sign; closing the batch to Done alone needs no re-sign |
| 13 | exec viewer | Exceptions tab and dashboard "Production evidence status" | live counts with units/cut-over; historical snapshot labelled non-live |
| 14 | any | Add/Edit Log Entry as before | unchanged (hand-off flag is false) |
| 15 | phone/Electron | open, HOME, excess modal | full-page modal; HOME returns to hub |
Stop on any unexpected stock movement. Roll back by removing the test user's assignments; signatures are append-only.

## 9. Remaining material deployment blockers
1. Owner authorization to install S7a/S7b and to apply the registry proposal; D-1 checks (esp. 2 and 4).
2. **R-1 (unchanged):** `public/sw.js` is a protected path and was not edited; hosted-PWA freshness for the new scripts needs a separately reviewed rule or cache-name advance at release.
3. Release of the hand-off needs a reviewed code change flipping `GOVERNED_LOGGING_HANDOFF`; Edit Log Entry hand-off is **not implemented** (2.6k-line editor under S5 chain protection; Batch Governance is its supervisory console).
4. Authenticated production acceptance (matrix above) before G7 can move; ENFORCE and core sign-off remain separately governed and unavailable here.
