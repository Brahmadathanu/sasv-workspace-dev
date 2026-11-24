# MIS G7 — S7 final acceptance receipt, revision 2 (exact FG receipt evidence)

> **STATUS NOTICE (24 Nov 2026, release candidate):** this document is a historical receipt. All eleven migrations (S2–S6 + S7a/S7b/S7c) and the permission registry are now LIVE in production; `MIGRATION_IDENTITIES.json` has no pending entries. Wording below that says "prepared", "pending" or "not installed" describes the state at the time of writing. Do not replay anything.


**G7 OPEN 7/11 (64%), G8 parked.** S7 is **prepared and isolated-tested, NOT installed**. No production write, installation, user assignment, core sign-off, ENFORCE, merge, release, backfill or PEC change. The five protected PEC files are untouched and uncommitted; no `git stash` was used.

## 0. Read this first: the private packets did not reach this session
The request says both production catalog packets are attached. **They are not present in this environment** (`.local/` does not exist; `/mnt/attach`, `/mnt/user-data/*` are empty; no `packet.json`/`supplement.json` anywhere on the filesystem). Nothing was fabricated, so:
* **The real-catalog replay of S7a/S7b/S7c and of the registry proposal was NOT executed.** I wrote the runner (`supabase/tests/mis_g7/s7/mis_g7_s7_real_catalog_pg.test.mjs`, 7 tests) and it skips with an explicit `BLOCKED` reason (verified: 7 skipped). It has **never run against real data** and will probably need first-run fixture adjustments; every assertion states the live fact it checks.
* **The live FG receipt trigger could not be audited** (it is in the packet). The receipt rule below is built from the live ledger distribution you reported, not from the trigger source. Its one structural assumption — *a legitimate receipt update keeps the net of the work log's own ledger rows equal to the log's current quantity* — is exactly what the real-catalog test (`RECEIPT AUDIT with the REAL triggers`) and the read-only pre-install SQL (§6) will confirm or refute.
To run it: put the two files under `.local/mis-g7-prod-baseline/` (git-ignored) and run `node --test supabase/tests/mis_g7/s7/mis_g7_s7_real_catalog_pg.test.mjs`.

## 1. The receipt-evidence finding and the correction
**Defect (pre-existing in installed S2/S4, exposed by your ledger distribution):** the signer accepted a certified quantity if "the batch ledger holds at least that much POSITIVE stock", and the packer accepted "any positive ledger row exists". Positive rows also come from packaging returns (`event_skus` 338), internal transfers (`fg_bulk_internal_transfer` 15) and manual entries/corrections (2), so those do not prove an original FG production receipt. **Demonstrated** by test: with S2 as installed, a log whose receipt rows were removed and whose batch only had a positive *transfer* row was signed successfully.
**Rule (S7a helper `app_private.mis_g7_fg_receipt`, used by S7b writers and S7c reads):** the certified receipt is the NET of ledger rows with `source_table = 'daily_work_log'` AND `source_id = that FG work log` AND the same product and batch AND `reason_code` in the receipt family (`'FG bulk storage'`, `'FG bulk storage (In Storage)'`, `'FG bulk storage (update)'` — the three reasons you reported), and it must equal the work log's current storage quantity (tolerance 0.0005 base units for numeric scale), the log must be an FG bulk storage log of that product/batch with positive quantity in the product base UOM. Findings: `OK`, `NO_SOURCE_LEDGER`, `LEDGER_MISMATCH`, `NOT_FG_RECEIPT_LOG`, `QTY_NOT_POSITIVE`, `UOM_MISMATCH` (+ `NO_FG_LOG` at batch level). Updates are accounted for by netting (delta rows, reverse-and-repost, in-place update all tested). Transfers, packaging movements and manual entries never count.
**One contract everywhere:**
| Surface | Behaviour |
|---|---|
| `mis_sign_batch_stage_v1` (patched by S7b) | no own ledger receipt → `FG_RECEIPT_EVIDENCE_MISSING` (+`receipt`); net ≠ log → NEW `FG_RECEIPT_LEDGER_MISMATCH` (+`log_qty`, `ledger_net_base`); existing quantity/UOM/identity checks unchanged |
| `mis_pack_fg_bulk_v1` (patched by S7b) | `FG_RECEIPT_MISSING` judged on the **signed stage's work log** (+`receipt`) |
| `mis_preview_pack_fg_bulk_v1` (S7c) | same evidence selection as the packer (`receipt_code`, `receipt_present`); batch-level only when nothing is signed |
| exception summary (S7c) | `MISSING_RECEIPT` with `detail` = finding code (`NO_SOURCE_LEDGER`, `LEDGER_MISMATCH`, `NO_FG_LOG`…) instead of "no positive row" |
**S7b mechanism (forward-only, S2/S4 files untouched):** each installed writer is patched in place by one exact text substitution, guarded by `sha256(prosrc)` pins of the installed source (derived from the committed S2/S4 files), exactly-one-anchor check and a pinned result hash; originals are persisted (hash-checked) for exact rollback. Writers keep their signature, ACL, SECURITY DEFINER and `search_path` (tested).

## 2. Migration identities (sha256 / git blob sha1)
| File | bytes | sha256 | git blob |
|---|---|---|---|
| `20261124120000_mis_g7_s7a_shared_route_identity_and_stage_status.sql` | 24071 | `511d4f5914f2921e4c214c7205835447c02393f1dff02c64f3c0feff441aca1d` | `e1e9060aa6e63157eceb136f8535c1ced960d46f` |
| `20261124121000_mis_g7_s7b_exact_fg_receipt_evidence.sql` | 5779 | `abc8def6efe0d9e1508458eda3d35815de7b37f920fbeb93f57313f036620f7e` | `b102af59bb7ead096c6ee163ae8522a57e595be5` |
| `20261124122000_mis_g7_s7c_governed_previews_and_exception_summary.sql` | 14632 | `1d7df765fb4aac595ab23b161452ec6dc8fa0aeb76d06605a4ca185c986309cb` | `b0a78bf127e021c1e09b9dbdd0d94ce87ec9aee7` |
| `S7_ROLLBACK_NOT_A_MIGRATION.sql` (sections S7C, S7B, S7A) | | `57a624086286df0c3e8f25d3d0d437401940dc1754b2f92b337e3b98b5eafbfe` | |
| `S7_PREINSTALL_LIVE_CHECK_READONLY.sql` | | `2d0579794f4655814dae57b31b735cae24fb1687e39ceed68c60da3da1d0c259` | |
| `CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql` (unchanged) | | `f37db6929995dc0e69bc92d7580de33924c763678d57c7c2759570356f3e2246` | |
| `client_rpc_contract.json` (`mis-g7-s2-s7/1`) | | `5347cd10ac477b45f349011489d638f7aed128325ed7e7ba7c932fa811bf1e99` | |
Patch pins in S7b: signer prosrc `2a4134f2…0005` → `acf75601…d194`; packer prosrc `97673b20…165c` → `e663eeaa…aef2`. Install order **S7a → S7b → S7c**, one transaction each; each guard fails closed and leaves nothing installed. Rollback order **S7C → S7B → S7A**.

## 3. Tests (isolated PostgreSQL 16, real Costing engine, S2–S6 as accepted)
| Suite | Result |
|---|---|
| `supabase/tests/mis_g7/s7/mis_g7_s7_pg.test.mjs` (S7a/b/c) | **36/36** |
| Existing server suites (`supabase/tests/mis_g7/*.test.mjs` + `prod_equivalent/*`) | **150 tests: 114 pass, 0 fail, 36 skipped** (packet-gated/environment-gated, unchanged) |
| `s7/mis_g7_s7_real_catalog_pg.test.mjs` (real catalog) | **0 run, 7 BLOCKED** (packets absent, §0) |
| Client: contract 24, static 13, dashboard 2, handwritten-model browser 19 | 58/58 |
| Client against the real isolated PostgreSQL (`bridge.test.mjs`) | **16/16** (adds the two receipt tests) |
| Regression, baseline-compared (57 related suites vs the previous head) | identical outcomes |
New receipt tests: pin/patch/ACL/baseline and drift/ENFORCE/no-S7a refusals; helper unit cases (exact, missing, unrelated positive stock, transfer-only, packaging return, mixed stock, wrong log/product/UOM/quantity, reason family, `In Storage`); signer old-vs-new behaviour and mismatch code; legitimate updates (delta, reverse-and-repost, in-place, log edit → `SOURCE_CHANGED` → void → re-sign, silent ledger drift refused); packer/preview/summary classification parity incl. S6 Done closure (signature and receipt unaffected), real source change (`STAGE_SOURCE_CHANGED`), several FG receipt logs per batch; contract ↔ catalog (`codes_s7b`); rollback restores the exact signer/packer/resolver and ACLs; the read-only SQL really is read-only and passes every pin.
Existing S2 behaviour exposed earlier (not changed): `STAGE_ALREADY_SIGNED` is route-agnostic per step id (conservative).

## 4. Client
The UI explains the new refusals: "No ledger receipt was posted for this FG work log… transfers, packaging returns and manual stock entries are not receipts", `FG_RECEIPT_LEDGER_MISMATCH` wording, receipt finding text in the preview, and receipt detail text in the exception table. A real-server test shows a transfer-only batch refused in the UI and listed as "Missing FG receipt — No ledger receipt posted by the FG work log". Evidence reference remains mandatory.

## 5. Security and rollback evidence
All new functions SECURITY DEFINER/STABLE where read-only, pinned `search_path`, anon/PUBLIC denied, private helpers closed, new tables RLS-closed (tested). S2–S6 definitions and ACLs byte-identical after S7 except the three intentionally replaced functions. Rollback: S7C drops reads; S7B restores the exact S2/S4 definitions from the baseline (hash-checked; always safe — the old rule is weaker); S7A refuses once an S7-only identity signature exists or when restoring would invalidate a valid signature; install refused if a valid signature would stop verifying.

## 6. Genuine material deployment blockers
1. **Packets / live trigger audit (§0).** Deliver `.local/mis-g7-prod-baseline/{packet,supplement}.json` and run the real-catalog runner, **or** run `S7_PREINSTALL_LIVE_CHECK_READONLY.sql` on production and review §2a: `no_source_ledger_rows` and `net_differs_from_log` are the logs that would NOT be certifiable (they are not signed today; they would be refused, which is the intent, but a large `net_differs_from_log` would mean the "(update)" semantics differ from the assumption and the rule/tolerance must be revisited before S7b). Also review §2b (expected: the seven pairs you listed, no rows pointing at non-FG or missing logs).
2. **Owner authorization** to install S7a → S7b → S7c and to apply the registry proposal (separate).
3. **R-1:** `public/sw.js` is protected and not edited; hosted-PWA freshness needs a separately reviewed rule at release.
4. Hand-off into Add Log Entry stays default-disabled (flag false); Edit Log Entry hand-off not implemented.
5. Authenticated production smoke matrix (`S7_ACCEPTANCE_AND_DEPLOYMENT_RECEIPT_20261124.md` §8, plus: sign a batch whose only positive stock is a transfer and confirm the refusal) before G7 can move.
